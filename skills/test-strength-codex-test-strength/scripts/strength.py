import sys
import os
import re
import subprocess
import time
import tempfile
import shutil
import ast
import copy
import random
import json
import difflib
from pathlib import Path

# --- Mutation Site Model ---
class MutationSite:
    def __init__(self, node_id, op_type, node, line_no, func_name, function_line, info=None):
        self.node_id = node_id        # Unique string ID
        self.op_type = op_type        # 'boundary', 'negation', 'return_value', 'arithmetic', 'boolean', 'deletion'
        self.line_no = line_no        # Line number of the mutation
        self.func_name = func_name    # Name of the function
        self.function_line = function_line
        self.target = (
            type(node).__name__, node.lineno, node.col_offset,
            node.end_lineno, node.end_col_offset,
        )
        self.info = info              # Extra info (e.g., type-matched return value)

    @property
    def function_key(self):
        return f"{self.func_name}:{self.function_line}"

# --- Helper Functions ---
def run_git(args, cwd=None):
    res = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Git command failed: git {' '.join(args)}\nError: {res.stderr.strip()}")
    return res.stdout.strip()

def find_base_ref(cwd=None):
    for branch in ["origin/main", "origin/master", "main", "master"]:
        try:
            base = run_git(["merge-base", "HEAD", branch], cwd=cwd)
            if base:
                return base
        except Exception:
            continue
    return None

def parse_changed_lines(diff_output):
    changed_lines = set()
    for line in diff_output.splitlines():
        if line.startswith("@@ "):
            match = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
            if match:
                start = int(match.group(1))
                length = int(match.group(2)) if match.group(2) is not None else 1
                if length == 0:
                    changed_lines.add(start)
                    changed_lines.add(start + 1)
                else:
                    for l in range(start, start + length):
                        changed_lines.add(l)
    return changed_lines

def get_changed_lines(file_path, base_ref=None, cwd=None):
    args = ["diff", "-U0"]
    if base_ref:
        args.append(base_ref)
    args.extend(["--", file_path])
    try:
        diff_out = run_git(args, cwd=cwd)
        return parse_changed_lines(diff_out)
    except Exception as e:
        return set()

def get_return_type_matched_values(func_node, return_node):
    ret_ann = func_node.returns
    guessed_type = None
    if isinstance(ret_ann, ast.Name):
        guessed_type = ret_ann.id
    elif isinstance(ret_ann, ast.Subscript):
        if isinstance(ret_ann.value, ast.Name):
            guessed_type = ret_ann.value.id
            
    val = return_node.value
    val_type = None
    if isinstance(val, ast.Constant):
        val_type = type(val.value).__name__
    elif isinstance(val, (ast.List, ast.Tuple, ast.Set)):
        val_type = 'list'
    elif isinstance(val, ast.Dict):
        val_type = 'dict'
        
    final_type = guessed_type or val_type
    mutated_vals = []
    
    is_none_literal = isinstance(val, ast.Constant) and val.value is None
    if not is_none_literal:
        mutated_vals.append(ast.Constant(value=None))
        
    if final_type in ('int', 'float'):
        is_zero = isinstance(val, ast.Constant) and val.value == 0
        mutated_vals.append(ast.Constant(value=1 if is_zero else 0))
    elif final_type in ('str', 'bytes'):
        is_empty = isinstance(val, ast.Constant) and val.value in ("", b"")
        mutated_vals.append(ast.Constant(value="x" if is_empty else ""))
    elif final_type in ('list', 'dict', 'tuple', 'set', 'List', 'Dict', 'Tuple', 'Set'):
        is_empty = False
        if isinstance(val, (ast.List, ast.Tuple, ast.Set)) and len(val.elts) == 0:
            is_empty = True
        elif isinstance(val, ast.Dict) and len(val.keys) == 0:
            is_empty = True
        mutated_vals.append(ast.List(elts=[ast.Constant(value=1)] if is_empty else [], ctx=ast.Load()))
    elif final_type == 'bool':
        is_true = isinstance(val, ast.Constant) and val.value is True
        mutated_vals.append(ast.Constant(value=False if is_true else True))
        
    return mutated_vals

def iter_function_nodes(function_node):
    """Yield nodes owned by a function, excluding nested functions and classes."""
    stack = [function_node]
    while stack:
        current = stack.pop()
        yield current
        for child in ast.iter_child_nodes(current):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            stack.append(child)


def collect_mutation_sites(file_path, file_ast, changed_lines):
    sites = []
    node_counter = 0
    
    for node in ast.walk(file_ast):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_lines = set(range(node.lineno, node.end_lineno + 1))
            if not func_lines.intersection(changed_lines):
                continue
                
            func_name = node.name
            
            function_nodes = list(iter_function_nodes(node))
            for child in function_nodes:
                # 1. Boundary
                if isinstance(child, ast.Compare) and len(child.ops) == 1:
                    op = child.ops[0]
                    if isinstance(op, (ast.Lt, ast.LtE, ast.Gt, ast.GtE)):
                        node_id = f"{file_path}|{node.lineno}|{func_name}|boundary|{node_counter}"
                        node_counter += 1
                        sites.append(MutationSite(node_id, 'boundary', child, child.lineno, func_name, node.lineno))
                        
                # 2. Negation
                if isinstance(child, ast.If):
                    node_id = f"{file_path}|{node.lineno}|{func_name}|negation|{node_counter}"
                    node_counter += 1
                    sites.append(MutationSite(node_id, 'negation', child, child.lineno, func_name, node.lineno))
                    
                # 3. Return value
                if isinstance(child, ast.Return) and child.value is not None:
                    replacements = get_return_type_matched_values(node, child)
                    for idx, repl in enumerate(replacements):
                        node_id = f"{file_path}|{node.lineno}|{func_name}|return_value|{node_counter}_{idx}"
                        node_counter += 1
                        sites.append(MutationSite(node_id, 'return_value', child, child.lineno, func_name, node.lineno, info=repl))
                        
                # 4. Arithmetic
                if isinstance(child, ast.BinOp):
                    if isinstance(child.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
                        node_id = f"{file_path}|{node.lineno}|{func_name}|arithmetic|{node_counter}"
                        node_counter += 1
                        sites.append(MutationSite(node_id, 'arithmetic', child, child.lineno, func_name, node.lineno))
                        
                # 5. Boolean
                if isinstance(child, ast.BoolOp):
                    if isinstance(child.op, (ast.And, ast.Or)):
                        node_id = f"{file_path}|{node.lineno}|{func_name}|boolean|{node_counter}"
                        node_counter += 1
                        sites.append(MutationSite(node_id, 'boolean', child, child.lineno, func_name, node.lineno))
            
            # 6. Deletion
            deletion_candidates = []
            for child in function_nodes:
                for attr in ('body', 'orelse', 'finalbody'):
                    if hasattr(child, attr):
                        lst = getattr(child, attr)
                        if isinstance(lst, list):
                            for stmt in lst:
                                if isinstance(stmt, (ast.Assign, ast.AugAssign)) or (isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call)):
                                    deletion_candidates.append(stmt)
                                    
            for stmt in deletion_candidates:
                node_id = f"{file_path}|{node.lineno}|{func_name}|deletion|{node_counter}"
                node_counter += 1
                sites.append(MutationSite(node_id, 'deletion', stmt, stmt.lineno, func_name, node.lineno))
                
    return sites

# --- AST Node Transformer ---
class MutationTransformer(ast.NodeTransformer):
    def __init__(self, target, op_type, info):
        self.target = target
        self.op_type = op_type
        self.info = info

    def visit(self, node):
        node_target = (
            type(node).__name__, getattr(node, "lineno", None),
            getattr(node, "col_offset", None), getattr(node, "end_lineno", None),
            getattr(node, "end_col_offset", None),
        )
        if node_target == self.target:
            return self.apply_mutation(node)
        return super().visit(node)

    def apply_mutation(self, node):
        if self.op_type == 'boundary':
            new_node = copy.deepcopy(node)
            op = new_node.ops[0]
            if isinstance(op, ast.Lt):
                new_node.ops[0] = ast.LtE()
            elif isinstance(op, ast.LtE):
                new_node.ops[0] = ast.Lt()
            elif isinstance(op, ast.Gt):
                new_node.ops[0] = ast.GtE()
            elif isinstance(op, ast.GtE):
                new_node.ops[0] = ast.Gt()
            return new_node
            
        elif self.op_type == 'negation':
            new_node = copy.deepcopy(node)
            test = new_node.test
            if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
                new_node.test = test.operand
            else:
                new_node.test = ast.UnaryOp(op=ast.Not(), operand=test)
            return new_node
            
        elif self.op_type == 'return_value':
            new_node = copy.deepcopy(node)
            new_node.value = self.info
            return new_node
            
        elif self.op_type == 'arithmetic':
            new_node = copy.deepcopy(node)
            if isinstance(new_node.op, ast.Add):
                new_node.op = ast.Sub()
            elif isinstance(new_node.op, ast.Sub):
                new_node.op = ast.Add()
            elif isinstance(new_node.op, ast.Mult):
                new_node.op = ast.Div()
            elif isinstance(new_node.op, ast.Div):
                new_node.op = ast.Mult()
            return new_node
            
        elif self.op_type == 'boolean':
            new_node = copy.deepcopy(node)
            if isinstance(new_node.op, ast.And):
                new_node.op = ast.Or()
            elif isinstance(new_node.op, ast.Or):
                new_node.op = ast.And()
            return new_node
            
        elif self.op_type == 'deletion':
            return ast.Pass()
            
        return node

# --- Directory Copier ---
def copy_project_to_temp(src_dir, dest_dir):
    src_path = Path(src_dir).resolve()
    dest_path = Path(dest_dir).resolve()
    
    ignore_patterns = {
        '.git', '__pycache__', '.pytest_cache', '.venv', 'venv', 'env',
        '.gemini', '.idea', '.vscode', '.gitattributes', '.gitignore', 'strength_report.json'
    }
    
    for root, dirs, files in os.walk(src_path):
        dirs[:] = [d for d in dirs if d not in ignore_patterns]
        
        rel_path = Path(root).relative_to(src_path)
        dest_root = dest_path / rel_path
        dest_root.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            if file in ignore_patterns or file.endswith('.pyc') or file.endswith('.pyo'):
                continue
            src_file = Path(root) / file
            dest_file = dest_root / file
            try:
                shutil.copy2(src_file, dest_file)
            except Exception:
                pass

# --- Pytest Subprocess Runner ---
def run_pytest_xml(xml_path, cwd, test_files=None, timeout=None):
    cmd = [sys.executable, "-m", "pytest", f"--junitxml={xml_path}", "--tb=no", "-s"]
    if test_files:
        cmd.extend(test_files)
        
    env = os.environ.copy()
    env["PYTHONPATH"] = str(cwd) + os.pathsep + env.get("PYTHONPATH", "")
    
    start_time = time.time()
    stdout, stderr = "", ""
    try:
        res = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
        exit_code = res.returncode
        stdout = res.stdout
        stderr = res.stderr
    except subprocess.TimeoutExpired:
        exit_code = -1
    end_time = time.time()
    
    return exit_code, end_time - start_time, stdout, stderr

def parse_junit(xml_path):
    import xml.etree.ElementTree as ET
    if not os.path.exists(xml_path):
        return {}
    try:
        tree = ET.parse(xml_path)
    except Exception:
        return {}
    root = tree.getroot()
    results = {}
    for testcase in root.findall(".//testcase"):
        classname = testcase.get("classname", "")
        name = testcase.get("name", "")
        file = testcase.get("file", "")
        
        status = "passed"
        if testcase.find("failure") is not None:
            status = "failed"
        elif testcase.find("error") is not None:
            status = "error"
        elif testcase.find("skipped") is not None:
            status = "skipped"
            
        test_id = f"{file}::{classname}::{name}"
        results[test_id] = status
    return results

# --- Unified Diff Helper ---
def get_diff(original_code, mutated_code, filename):
    diff = difflib.unified_diff(
        original_code.splitlines(),
        mutated_code.splitlines(),
        fromfile=f"original/{filename}",
        tofile=f"mutated/{filename}",
        lineterm=""
    )
    return "\n".join(diff)

# --- CLI Command: verify ---
def run_verify(mutant_id, test_file):
    parts = mutant_id.split('|', 1)
    if len(parts) != 2:
        print(f"Error: Invalid mutant ID format: {mutant_id}", file=sys.stderr)
        sys.exit(1)
    rel_file_path = parts[0]
    
    if not os.path.exists(rel_file_path):
        print(f"Error: File not found: {rel_file_path}", file=sys.stderr)
        sys.exit(1)
        
    with open(rel_file_path, "r", encoding="utf-8") as f:
        source = f.read()
        
    file_ast = ast.parse(source)
    
    changed_lines = set(range(1, len(source.splitlines()) + 1))
    sites = collect_mutation_sites(rel_file_path, file_ast, changed_lines)
    target_site = next((site for site in sites if site.node_id == mutant_id), None)
    if not target_site:
        print(f"Error: Mutant {mutant_id} not found in collected sites.", file=sys.stderr)
        sys.exit(1)
        
    mutated_tree = copy.deepcopy(file_ast)
    transformer = MutationTransformer(target_site.target, target_site.op_type, target_site.info)
    mutated_tree = transformer.visit(mutated_tree)
    ast.fix_missing_locations(mutated_tree)
    mutated_code = ast.unparse(mutated_tree)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        copy_project_to_temp(".", temp_dir)
        
        dest_mutated_file = os.path.join(temp_dir, rel_file_path)
        os.makedirs(os.path.dirname(dest_mutated_file), exist_ok=True)
        with open(dest_mutated_file, "w", encoding="utf-8") as f:
            f.write(mutated_code)
            
        rel_test = test_file
        if os.path.isabs(test_file):
            rel_test = os.path.relpath(test_file, os.getcwd())
            
        cmd = [sys.executable, "-m", "pytest", rel_test, "--tb=no"]
        env = os.environ.copy()
        env["PYTHONPATH"] = str(temp_dir) + os.pathsep + env.get("PYTHONPATH", "")
        
        res = subprocess.run(cmd, cwd=temp_dir, env=env, capture_output=True, text=True)
        
        if res.returncode != 0:
            print("VERIFICATION SUCCESS: Mutant was killed.")
            sys.exit(0)
        else:
            print("VERIFICATION FAILURE: Mutant survived.")
            sys.exit(1)

# --- CLI Command: run ---
def run_mutation_tests(base_ref=None, path_filter=None):
    # Find changed files and lines
    print("Step 1: Scope assessment...")
    try:
        if base_ref is None:
            base_ref = find_base_ref()
            if base_ref:
                print(f"Using default branch merge-base: {base_ref}")
            else:
                print("No default branch merge-base found. Falling back to unstaged changes.")
        else:
            print(f"Using explicitly specified base: {base_ref}")
            
        # Get changed files
        git_args = ["diff", "--name-only"]
        if base_ref:
            git_args.append(base_ref)
        changed_files_out = run_git(git_args)
    except Exception as e:
        print(f"Error checking git status: {e}", file=sys.stderr)
        sys.exit(1)
        
    changed_files = []
    if changed_files_out:
        changed_files = [f.strip() for f in changed_files_out.splitlines() if f.strip()]
        
    # Filter files
    selected_files = []
    for f in changed_files:
        if not f.endswith(".py"):
            continue
        if not os.path.exists(f):
            continue
        basename = os.path.basename(f)
        if basename.startswith("test_") or basename.endswith("_test.py"):
            continue
        if path_filter:
            norm_pf = os.path.normpath(path_filter)
            norm_f = os.path.normpath(f)
            if not (norm_f == norm_pf or norm_f.startswith(norm_pf + os.sep)):
                continue
        selected_files.append(f)
        
    if not selected_files:
        print("No Python files in the diff to analyze.")
        sys.exit(0)
        
    print(f"Found {len(selected_files)} changed Python files.")
    
    # Step 2: Baseline run
    print("\nStep 2: Running baseline checks (twice)...")
    with tempfile.TemporaryDirectory() as temp_baseline_dir:
        # We write baseline XMLs to this temp folder
        xml1 = os.path.join(temp_baseline_dir, "baseline1.xml")
        xml2 = os.path.join(temp_baseline_dir, "baseline2.xml")
        
        print("Running first baseline run...")
        code1, t1, out1, err1 = run_pytest_xml(xml1, os.getcwd())
        results1 = parse_junit(xml1)
        if code1 != 0:
            print("Aborting: Suite already failing or could not run. Nothing is measurable.", file=sys.stderr)
            print(out1, file=sys.stderr)
            print(err1, file=sys.stderr)
            sys.exit(1)
        if not results1:
            print("Aborting: No tests found in the test suite.", file=sys.stderr)
            sys.exit(1)
            
        failed_tests = [tid for tid, stat in results1.items() if stat in ("failed", "error")]
        if failed_tests:
            print("Aborting: Suite already failing. Nothing is measurable.", file=sys.stderr)
            print("Failing tests:", file=sys.stderr)
            for t in failed_tests:
                print(f"  - {t}", file=sys.stderr)
            sys.exit(1)
            
        print("Running second baseline run...")
        code2, t2, out2, err2 = run_pytest_xml(xml2, os.getcwd())
        results2 = parse_junit(xml2)
        if code2 != 0:
            print("Aborting: Suite failed or could not run on the second baseline check.", file=sys.stderr)
            print(out2, file=sys.stderr)
            print(err2, file=sys.stderr)
            sys.exit(1)
        
        # Compare pass/fail sets
        flaky = []
        all_tids = set(results1.keys()).union(results2.keys())
        for tid in all_tids:
            if results1.get(tid) != results2.get(tid):
                flaky.append(tid)
                
        if flaky:
            print("Aborting: Flaky tests detected!", file=sys.stderr)
            for t in flaky:
                print(f"  - {t} (Run 1: {results1.get(t)}, Run 2: {results2.get(t)})", file=sys.stderr)
            sys.exit(1)
            
        baseline_time = t1
        print(f"Baseline checks completed. {len(results1)} tests pass consistently.")
        print(f"Baseline wall-clock time: {baseline_time:.2f}s")
        
        if baseline_time > 60.0:
            print(f"\nWARNING: Baseline test run took {baseline_time:.2f}s (exceeding 60 seconds).")
            print("Proceeding with mutation testing may take a long time.\n")
            
    # Step 3: Collect mutants
    print("\nStep 3: Collecting mutation sites...")
    all_mutants = []
    
    for f in selected_files:
        try:
            with open(f, "r", encoding="utf-8") as file_handle:
                source = file_handle.read()
            file_ast = ast.parse(source)
        except Exception as e:
            print(f"Aborting: SyntaxError/ReadError in {f}: {e}", file=sys.stderr)
            sys.exit(1)
            
        # Parse changed lines
        lines_changed = get_changed_lines(f, base_ref)
        if not lines_changed:
            continue
            
        sites = collect_mutation_sites(f, file_ast, lines_changed)
        
        # Group by function
        func_sites = {}
        for s in sites:
            func_sites.setdefault(s.function_key, []).append(s)
            
        # Select max 6 mutants per function deterministically
        for func_name, sites_list in func_sites.items():
            selected = select_mutants_for_function(sites_list)
            all_mutants.extend(selected)
            
    if not all_mutants:
        print("No mutation sites found in changed functions.")
        sys.exit(0)
        
    changed_function_count = len({mutant.function_key for mutant in all_mutants})
    print(f"Generated {len(all_mutants)} mutants across {changed_function_count} changed functions.")
    
    # Step 4: Execute mutants in temp directory
    print("\nStep 4: Executing mutants...")
    killed_count = 0
    survived_count = 0
    survived_mutants = []
    killed_mutants = []
    
    # Copy project once to temp directory to reuse for speed
    with tempfile.TemporaryDirectory() as temp_dir:
        print("Copying project to temporary directory...")
        copy_project_to_temp(".", temp_dir)
        print("Copying completed. Starting run...")
        
        for idx, mutant in enumerate(all_mutants):
            rel_file_path = mutant.node_id.split('|')[0]
            
            # Read file original code
            with open(rel_file_path, "r", encoding="utf-8") as fh:
                original_code = fh.read()
                
            file_ast = ast.parse(original_code)
            
            # Generate mutant code
            mutated_tree = copy.deepcopy(file_ast)
            transformer = MutationTransformer(mutant.target, mutant.op_type, mutant.info)
            mutated_tree = transformer.visit(mutated_tree)
            ast.fix_missing_locations(mutated_tree)
            mutated_code = ast.unparse(mutated_tree)
                    
            print(f"[{idx+1}/{len(all_mutants)}] {mutant.func_name} at {rel_file_path}:{mutant.line_no} ({mutant.op_type}) -> ", end="", flush=True)
            
            # Overwrite file in temp directory
            dest_file = os.path.join(temp_dir, rel_file_path)
            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            with open(dest_file, "w", encoding="utf-8") as fh:
                fh.write(mutated_code)
                
            # Run tests in temp dir
            xml_report = os.path.join(temp_dir, f"mutant_report.xml")
            if os.path.exists(xml_report):
                try:
                    os.remove(xml_report)
                except Exception:
                    pass
                    
            timeout = max(2 * baseline_time, 5.0)
            exit_code, elapsed, out, err = run_pytest_xml(xml_report, temp_dir, timeout=timeout)
            
            # Restore file in temp dir to original
            with open(dest_file, "w", encoding="utf-8") as fh:
                fh.write(original_code)
                
            if exit_code == 0:
                print(f"SURVIVED ({elapsed:.2f}s)")
                print(f"--- STDOUT --- \n{out}\n--- STDERR --- \n{err}\n--------------")
                survived_count += 1
                survived_mutants.append({
                    "id": mutant.node_id,
                    "file": rel_file_path,
                    "line": mutant.line_no,
                    "function": mutant.func_name,
                    "operator": mutant.op_type,
                    "diff": get_diff(original_code, mutated_code, rel_file_path),
                    "status": "SURVIVED",
                    "reason": "The full test suite passed."
                })
            else:
                reason = "Tests failed (exit code non-zero)."
                if exit_code == -1:
                    reason = "Timeout expired (hang detected)."
                print(f"KILLED ({elapsed:.2f}s - {reason})")
                killed_count += 1
                killed_mutants.append({
                    "id": mutant.node_id,
                    "file": rel_file_path,
                    "line": mutant.line_no,
                    "function": mutant.func_name,
                    "operator": mutant.op_type,
                    "status": "KILLED",
                    "reason": reason
                })
                
    # Save report
    report = {
        "total_tests": len(results1),
        "total_mutants": len(all_mutants),
        "changed_function_count": changed_function_count,
        "killed_count": killed_count,
        "survived_count": survived_count,
        "survived_mutants": survived_mutants,
        "killed_mutants": killed_mutants
    }
    
    with open("strength_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    print("\n" + "="*40)
    print(f"{len(results1)} tests | {len(all_mutants)} mutants across {changed_function_count} changed functions")
    print(f"{killed_count} killed | {survived_count} survived")
    print("="*40)
    print("Full mutation run results written to strength_report.json")

def select_mutants_for_function(candidates):
    candidates.sort(key=lambda c: (c.line_no, c.op_type, c.node_id))
    if len(candidates) <= 6:
        return candidates
    rng = random.Random(42)
    selected = rng.sample(candidates, 6)
    selected.sort(key=lambda c: (c.line_no, c.op_type, c.node_id))
    return selected

# --- Main Entry Point ---
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        if len(sys.argv) < 4:
            print("Usage: python strength.py verify <mutant_id> <test_file>", file=sys.stderr)
            sys.exit(1)
        run_verify(sys.argv[2], sys.argv[3])
    else:
        # Parse command line options
        # Usage: python strength.py [--base <ref>] [path]
        base_ref = None
        path_filter = None
        
        args = sys.argv[1:]
        if "--base" in args:
            idx = args.index("--base")
            if idx + 1 < len(args):
                base_ref = args[idx+1]
                # Remove --base and its arg
                args = args[:idx] + args[idx+2:]
            else:
                print("Error: --base requires a reference value.", file=sys.stderr)
                sys.exit(1)
                
        if args:
            path_filter = args[0]
            
        run_mutation_tests(base_ref, path_filter)
