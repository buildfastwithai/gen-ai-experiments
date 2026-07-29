---
name: test-strength
description: Measure whether Python tests detect behavior changes through diff-scoped mutation testing. Use when Codex needs to audit the strength of a pytest suite, evaluate whether tests cover changed code, investigate surviving mutants, or propose and verify targeted tests for missed behavior.
---

# Test Strength

Run the bundled runner from the repository being assessed. Keep the repository working tree unchanged: the runner copies it to a temporary directory before each mutant run.

## Run the audit

1. Confirm that Python and `pytest` are available. Run from the target repository root.
2. Run the bundled script, using its absolute skill path:

   ```powershell
   python <skill-path>\scripts\strength.py [--base <ref>] [path]
   ```

   Omit both arguments to compare the current worktree with the merge-base of the default branch. Use `--base main` (or a commit) to choose the diff base. Pass an optional file or directory path to limit which changed Python production files are mutated.

3. Read `strength_report.json` in the target repository root. Treat a killed mutant as behavior caught by the suite and a survived mutant as behavior that the suite did not catch. The runner executes the full test suite for every mutant so indirect, fixture-based, and integration coverage are included.

## Analyze survivors

For each item in `survived_mutants`:

1. Inspect its `diff` and decide whether it changes observable behavior for valid inputs.
2. Discard only genuinely equivalent mutants; state why they are equivalent.
3. For every real survivor, add one focused test that passes on the original code and fails for the mutant.
4. Verify that test before suggesting it:

   ```powershell
   pytest <temporary-test-file>
   python <skill-path>\scripts\strength.py verify "<mutant-id>" <temporary-test-file>
   ```

   The first command must pass. The verification command must print `VERIFICATION SUCCESS` and exit with code 0. Remove the temporary verification file afterward unless the user asks to keep it.

## Report results

Use this structure and include only real survivors:

```markdown
<Total Tests> tests | <Total Mutants> mutants across <Changed Functions Count> changed functions
<Killed Count> killed | <Survived Count> survived | <Equivalent Count> equivalent (discarded)

### SURVIVED

#### <File Path>:<Line Number> <Function Name>
`<Original Expression>` -> `<Mutated Expression>`

Reason for survival: <why the current tests miss this behavior>

Suggested test:
```diff
+ <verified test change>
```
```
