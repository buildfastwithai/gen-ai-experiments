---
name: eazyr
description: Make an unfamiliar or undocumented repo easy to run. Use when someone cannot get a project running, when onboarding a new developer, or when asked to write a QUICKSTART, a setup/prerequisite check ("doctor") script, or a documented .env.example. Also use when setup instructions are missing, stale, or spread across a wiki, a chat thread, and someone's head — or to audit whether a repo is onboardable at all.
---

# eazyr

Turn "clone it and good luck" into a five-minute path from clone to a running app.

You produce an **onboarding kit** that lives in the repo:

| Artifact | Purpose |
| --- | --- |
| `QUICKSTART.md` | The shortest correct path from clone to "it works" |
| `scripts/doctor.sh` + `scripts/doctor.ps1` | Runnable checks that fail loudly *before* setup wastes an hour |
| `.env.example` | Every variable the app reads, documented, with safe defaults |

## The one rule

**Never write a step you have not verified against the repo.** Invented steps are worse
than absent ones — they cost the reader the time it takes to discover they're fake.

This ships with a scanner so you don't have to rely on memory. `eazyr scan --json`
returns detected facts with the file each one came from. Prefer it over reading twenty
files by hand, and cite its provenance rather than guessing.

If a fact is missing, write `> **TODO:**` and say what you'd need. Never fill the hole
with something plausible.

## Workflow

### 1. Scan

```bash
npx eazyr scan --json
```

Returns: `ecosystems` (stack, package manager, version ranges, real commands from the
manifest), `env.vars` (each with `required`, `secret`, and `sources: ["file:line"]`),
`compose` and `services`, `ports`, `verify` (health endpoint or test command), `steps`
(the ordered setup path), and `gaps` (what's missing).

Read the human summary first if you just want orientation:

```bash
npx eazyr scan
```

**The scanner is a strong first pass, not an oracle.** It is regex-based, skips
`node_modules`, and caps at 4000 files. Verify anything surprising by opening the file it
cites. If `ecosystems` is empty or `truncated` is true, fall back to reading the repo
yourself — `references/detect.md` is the manual lookup table.

### 2. Generate the first draft

```bash
npx eazyr init          # add --force to overwrite, --dry-run to preview
```

Writes all four files from the scan. Existing files are skipped unless `--force`, so this
is safe to run in a repo that already has some docs.

This is a **draft, not a deliverable.** It knows the facts; it does not know your project.

### 3. Edit it into something true

This is the part only you can do. Work through the generated files and:

- **Resolve every `TODO`.** The generator emits one wherever it couldn't determine a fact.
- **Read the sources.** For each `sources: ["src/config.ts:14"]`, open that line and write
  what the variable actually *does*. "Stripe API key" beats a repeated variable name.
- **Name where secrets come from.** `STRIPE_SECRET_KEY` → "Create a test-mode key at
  dashboard.stripe.com/apikeys". The generator cannot know this; a reader is stuck without it.
- **Check CI.** `.github/workflows/` is the setup that provably works. If it does something
  the quickstart doesn't, the quickstart is wrong.
- **Fix the ordering** if the project has a real constraint the scanner missed — a seed
  step that must precede first boot, a service that needs a warm-up.
- **Cut what isn't on the critical path.** Under 120 lines. Everything else is README material.

`references/quickstart.md` has the section-by-section spec, `references/doctor.md` the
check conventions, `references/detect.md` the manual detection table.

### 4. Verify

```bash
npx eazyr doctor        # runs the derived checks against this machine, writes nothing
bash scripts/doctor.sh  # and confirm the committed script agrees
```

Then run the install and start commands if you can. Best effort, in this order:

1. `doctor` passes, and fails informatively when you unset a required variable.
2. The install step completes.
3. The app starts and the verify step returns what the quickstart claims.

Report honestly: what you ran, what passed, what you could not check. If you couldn't run
the app, say so plainly rather than implying the path is proven.

## When the scanner comes up empty

Unrecognised stack, or a repo too unusual to detect? Fall back to the manual workflow —
the artifacts are still the goal:

1. Read CI, then the task runner, then the container files. CI has to pass, so it doesn't lie.
2. Reconstruct: prerequisites → clone → install → configure → services → run → verify.
3. Copy `assets/doctor.sh` and `assets/doctor.ps1` into `scripts/`, and edit only the
   `CHECKS` block — the runner is complete.
4. Write `QUICKSTART.md` from `assets/QUICKSTART.template.md`.

## Scope

Write the kit and the scripts that support it. Don't refactor the project, change its
dependencies, or rewrite the main README — `QUICKSTART.md` links from the README, it
doesn't replace it. Never copy a real value out of an existing `.env`; use a placeholder
and say you did.

## Files

- `references/detect.md` — manual stack detection, per ecosystem
- `references/quickstart.md` — QUICKSTART.md section spec
- `references/doctor.md` — check catalog and script conventions
- `assets/QUICKSTART.template.md`, `assets/doctor.sh`, `assets/doctor.ps1`,
  `assets/env.example.template` — the templates `init` fills in
