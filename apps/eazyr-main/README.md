# eazyr

**Make any repo easy to run.** A zero-dependency CLI that reads a project and tells you —
or writes down — exactly what it takes to get it running. Ships with a
[Claude Code](https://claude.com/claude-code) skill that drives it.

```bash
npx eazyr            # what does this repo need?
npx eazyr doctor     # is my machine ready?
npx eazyr init       # write the onboarding kit
```

## The problem

Every repo has an oral tradition: the env var nobody documented, the service that must be
up first, the package manager you'll silently corrupt the tree by not using. It costs each
new person an afternoon, and the person who knows has stopped noticing.

`eazyr` reads that out of the code and writes it down.

## What it does

**`npx eazyr`** — scan and report. No files written.

```
orders-api — 5 files scanned

  Node.js               node >=20.11  via pnpm · package.json
  Services              postgres, redis  · docker-compose.yml
  Ports                 3000, 5432, 6379
  Env vars              5 (2 required)

Setup path
  Clone the repository    git clone …
  Install dependencies    pnpm install
                          from pnpm-lock.yaml
  Configure environment   cp .env.example .env
                          from generated
  Start services          docker compose up -d
                          from docker-compose.yml
  Prepare the database    pnpm db:migrate
                          from package.json
  Run it                  pnpm dev
                          from package.json
  Verify                  curl http://localhost:3000/health
                          from src/server.ts

Gaps
  • No QUICKSTART.md — setup steps are undocumented or buried in the README.
  • No prerequisite check — newcomers discover a missing tool halfway through setup.
  • 5 environment variable(s) read by the code, but no .env.example exists.
```

Every line cites the file it came from. Nothing is inferred from convention alone.

**`npx eazyr doctor`** — check *this machine* against what the project needs. Zero config:
the checks are derived from the scan, so it works in a repo that has never seen `eazyr`.

```
✔  Node.js >= 20.11.0     v22.11.0
✖  pnpm installed         not installed
   → corepack enable && corepack prepare pnpm@latest --activate
     pnpm-lock.yaml is committed — another package manager will build a broken tree
✔  .env exists            .env
✖  STRIPE_SECRET_KEY set  no .env
   → Set STRIPE_SECRET_KEY in .env (read at src/server.ts:6)
✔  Docker running         running

2 required check(s) failed. Fix the items above, then run this again.
```

Exit code is `1` when a required check fails, so it composes: `npx eazyr doctor && pnpm dev`.

**`npx eazyr init`** — write the kit:

| File | Contents |
| --- | --- |
| `QUICKSTART.md` | Success criteria first, then the ordered setup path, common tasks, troubleshooting keyed on real error strings |
| `scripts/doctor.sh` | The same checks as `eazyr doctor`, committed so they run without npx |
| `scripts/doctor.ps1` | The identical check list for Windows |
| `.env.example` | Every variable, grouped, each annotated with the `file:line` that reads it |

Existing files are skipped unless you pass `--force`. Use `--dry-run` to preview.

## How it decides

The detection is deliberately evidence-based:

- **Package manager from the lockfile**, not from what's popular. `pnpm-lock.yaml` present
  means `pnpm install` — and the quickstart says why using another one breaks things.
- **Required vs. optional env vars** from whether the code has a fallback.
  `process.env.PORT || 3000` is optional; `process.env.DATABASE_URL` is required. Both get
  documented; only the second becomes a blocking check.
- **Secrets by name shape** (`KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `DSN`) — those get an
  empty value in `.env.example` and a prompt for you to name the source.
- **Local defaults from compose.** A `postgres:16` service on 5432 becomes a real working
  `DATABASE_URL`, not a placeholder.
- **Verify step from a health endpoint** if one exists, else the test command. Something
  the reader can actually observe.
- **Drift detection.** Variables read in source but absent from `.env.example`, and
  variables declared there but no longer used anywhere.

Where it can't determine something, the output says `TODO` instead of guessing.

## The Claude Code skill

The CLI extracts facts; the skill supplies judgment. `eazyr init` can tell you
`STRIPE_SECRET_KEY` is required and read at `src/server.ts:6` — it cannot tell you to get
a test-mode key from the Stripe dashboard. That gap is what the skill fills.

```bash
npx eazyr skill install             # → ~/.claude/skills/eazyr
npx eazyr skill install --project   # → ./.claude/skills/eazyr, ships with the repo
```

Restart Claude Code, then check `/skills`. It loads on its own when a request matches:

```
I can't get this project running — figure out the setup and document it
New dev starts Monday. Make this repo onboardable.
Our .env.example is out of date — rebuild it from the code
Write a QUICKSTART for this repo
```

Claude scans, generates the draft, then does the part a scanner can't: resolves the TODOs,
reads the cited source lines to describe what each variable *does*, cross-checks the steps
against CI, and runs `doctor` to confirm the result is true. The skill's governing rule is
that no step ships unverified — so anything it couldn't confirm is marked, not invented.

## Commands

```
npx eazyr [command] [options]

  scan              Report what the project needs to run          (default)
  doctor            Check this machine against those needs
  init              Write QUICKSTART.md, scripts/doctor.*, .env.example
  skill install     Install the Claude Code skill
  help              Show usage

  --json            Machine-readable output (scan, doctor, init)
  --force           Overwrite existing files
  --dry-run         Show what init would write, without writing
  --project         Install the skill into ./.claude/skills instead of ~/
  --cwd <path>      Operate on another directory
```

`--json` is the integration surface — CI gates, pre-commit hooks, or your own agent:

```bash
npx eazyr scan --json | jq '.gaps'
npx eazyr doctor --json                 # exit 1 when a required check fails
```

## Supported stacks

Node/TypeScript (npm, pnpm, yarn, bun), Python (pip, poetry, uv, hatch, pipenv, Django),
Go, Rust, JVM (Gradle and Maven, wrapper-aware), Ruby (Bundler, Rails). Plus Docker
Compose, Makefile/Justfile/Taskfile, and GitHub Actions across all of them.

Env var extraction covers JS/TS, Python, Go, Ruby, Java, and PHP idioms. An unrecognised
stack degrades honestly: the gap is reported, and nothing is fabricated to fill it.

## Install

Nothing to install — `npx eazyr` is the intended use, and it has zero dependencies so it
starts instantly. To keep it around:

```bash
npm install -g eazyr
```

Requires Node 18+. The generated scripts need only `bash` or PowerShell 5.1+.

## Development

```bash
git clone https://github.com/kh-bikash/eazyr.git
cd eazyr
npm test        # 21 tests, no dependencies
```

Tests build throwaway repos on disk and run the real scanner against them, because what's
worth testing is whether it reads real files correctly.

Adding a stack: write a `detectX(root)` in [src/scan.mjs](src/scan.mjs) returning the
ecosystem shape, add it to `ECOSYSTEMS`, and add its binary to `RUNTIME_BINS` in
[src/checks.mjs](src/checks.mjs). Both generators pick it up automatically.

## Layout

```
eazyr/
├── bin/eazyr.mjs         # CLI
├── src/
│   ├── scan.mjs          # detection engine — stacks, env vars, services, ports
│   ├── checks.mjs        # derives prerequisite checks, and runs them
│   ├── generate.mjs      # renders the kit
│   ├── install.mjs       # skill installation
│   └── walk.mjs          # bounded source-tree walking
├── SKILL.md              # the Claude Code skill
├── references/           # loaded on demand by the skill
├── assets/               # templates that init fills in
└── test/run.mjs
```

## License

MIT — see [LICENSE](LICENSE).
