# test-strength Codex Skill

A diff-scoped mutation testing tool that validates whether a test suite actually asserts and verifies the behavior of changed code, rather than just running it.

## The Problem It Solves
Code coverage only tracks whether a line of code was executed during a test run. It doesn't guarantee that the test asserted anything about its outputs or side effects. For example, tests that assert `assert result is not None` will pass even if the calculations inside are broken.

`test-strength` solves this by introducing deliberate, small breakages (mutants) into the lines changed in your git diff and verifying if the test suite catches them.

## Algorithm
1.  **Scope**: Detects changed files using `git diff --name-only <base>`. Parses files using Python's `ast` module and selects functions overlapping the changed line ranges.
2.  **Baseline Check**: Runs the test suite twice on the unchanged code.
    *   If different test sets pass/fail between runs, it aborts (flaky tests).
    *   If the suite is already failing, it aborts.
    *   Warns the user if the baseline run takes longer than 60 seconds.
3.  **Mutate**: Generates up to 6 mutants per function deterministically (using a fixed seed). Mutants are applied to AST copies and run in a separate temp directory to avoid touching the user's files.
4.  **Execute**: For each mutant, runs the full test suite. This includes indirect, fixture-based, and integration coverage. It enforces a timeout of 2x baseline time.
    *   Non-zero exit or Timeout -> **KILLED** (bug caught).
    *   Zero exit -> **SURVIVED** (bug went unnoticed).
5.  **Filter**: For each survivor, Codex determines whether the mutation is equivalent (changes no observable behavior). Equivalent mutants are discarded.
6.  **Repair**: For real survivors, the model designs a test that kills the mutant, verifies it against the original and mutated code, and suggests it to the user.

### Mutation Operators
*   **boundary**: `<` <-> `<=`, `>` <-> `>=`
*   **negation**: `if X` -> `if not X` (and vice-versa)
*   **return value**: `return expr` -> `return None / 0 / "" / []` (type-matched)
*   **arithmetic**: `+` <-> `-`, `*` <-> `/`
*   **boolean**: `and` <-> `or`
*   **deletion**: removes one assignment or expression call (replaced with `pass`)

## Installation and Requirements
*   Python 3.9+
*   `pytest`

No external dependencies outside the Python standard library and pytest are required.

## Usage

### Run Mutation Testing
To run mutation testing on unstaged changes (default):
```bash
python scripts/strength.py
```

To run against a specific git base reference (e.g. `main` or a commit hash):
```bash
python scripts/strength.py --base main
```

To filter results to a specific directory or file:
```bash
python scripts/strength.py fixtures/weak/
```

### Verify a Test Case Against a Mutant
To verify whether a proposed test case successfully kills a specific mutant:
```bash
python scripts/strength.py verify "<mutant_id>" <test_file_path>
```
If the test in `<test_file_path>` fails on the mutant, the command exits with code `0` (Success). Otherwise, it exits with `1` (Failure).

## Fixtures & Verification
This repository contains two identical sets of modules with contrasting test suites:
*   `fixtures/weak/`: Contains tests that are deliberately weak (missing boundaries, using `assertNotNull` checks, skipping side-effect assertions). Running the tool here will report multiple survivors.
*   `fixtures/strong/`: Contains properly written, robust assertions. Running the tool here will report zero survivors.
