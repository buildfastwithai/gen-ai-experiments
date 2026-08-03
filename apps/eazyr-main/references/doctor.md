# doctor script conventions

The doctor script answers one question: *is this machine ready?* It changes nothing. It
installs nothing. Any script that mutates the system is a setup script, not a doctor —
keep them separate so the doctor is safe to run at any time, including in CI.

## What earns a check

Add a check when failing it produces an error that does not name the real cause.

| Worth checking | Because the failure looks like |
| --- | --- |
| Runtime version too low | A syntax error deep in a dependency |
| Package manager mismatch | A resolved-but-broken dependency tree |
| Missing env var | `undefined is not a function`, or a 500 at request time |
| Occupied port | `EADDRINUSE`, blamed on the app |
| Database unreachable | A connection timeout after a 30-second hang |
| Missing native toolchain | A 200-line compiler dump from a transitive dep |

Skip checks for things that fail obviously. `git: command not found` needs no help.

## Severity

- **required** — setup cannot proceed. Fails the run, exit code 1.
- **optional** — degrades an experience (no Docker → no integration tests). Warns, exit 0.

Never fail the run for something the reader can work around. A doctor that cries wolf
gets deleted.

## Anatomy of a check

Four fields, always:

1. **label** — what is being checked, in the reader's words: `Node.js >= 20`
2. **test** — a command whose exit code is the answer. Silence stdout and stderr.
3. **fix** — a pasteable command or a one-line instruction. This is the whole value of
   the script; a check without a fix hint is just a nicer error message.
4. **severity** — `required` or `optional`

## Version comparison

Compare numerically, not lexically — `"9" > "10"` is true as a string and wrong. Both
templates ship a `version_at_least` helper; use it rather than `grep`-ing a version
string, which breaks on prereleases like `20.1.0-rc.1`.

## Output

Three states, aligned so a passing run is a scannable column:

```
✔  Node.js >= 20              v22.11.0
✔  pnpm installed             10.4.1
✖  DATABASE_URL set           not set
   → cp .env.example .env, then fill in DATABASE_URL
!  Docker running             optional — integration tests will be skipped

1 required check failed.
```

End with a count, not a wall of text. Exit 1 if any required check failed, else 0 — so
`./scripts/doctor.sh && pnpm dev` works, and CI can gate on it.

## Both platforms

Ship `doctor.sh` and `doctor.ps1` together and keep the check lists identical. A Windows
reader who finds only a `.sh` concludes the project doesn't support their machine.

Keep `doctor.sh` POSIX (`#!/usr/bin/env sh`-compatible) if you can — macOS ships bash 3.2,
so avoid `declare -A`, `mapfile`, and `${var,,}`. The template already does.

## Wiring it in

- Reference it as step 0 of the quickstart
- Add a `doctor` script/target to `package.json` or the `Makefile`
- Optionally run it in CI so the checks can't silently rot
- `chmod +x scripts/doctor.sh` and commit the executable bit
