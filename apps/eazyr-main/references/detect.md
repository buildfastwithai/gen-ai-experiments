# Stack detection

Read these files in order. Stop reading a section once you have the toolchain version,
the install command, and the run command.

## Universal first pass

| File | What it tells you |
| --- | --- |
| `.github/workflows/*.yml`, `.gitlab-ci.yml` | The setup that provably works — pinned versions, install and test commands, service containers |
| `Makefile`, `Justfile`, `Taskfile.yml` | The commands maintainers actually type |
| `docker-compose.yml` | Required services, ports, env vars, default credentials |
| `Dockerfile` | Base image version, build steps, exposed port, entrypoint |
| `.tool-versions`, `.mise.toml` | Exact runtime versions for every tool |
| `.devcontainer/devcontainer.json` | A fully-specified environment; often the whole answer |
| `.env.example`, `.env.sample` | Existing (possibly stale) variable list |

CI is the highest-signal source in the repo. If `README` and CI disagree, trust CI.

## Per ecosystem

### Node / TypeScript
- `package.json` → `scripts` (the real command list), `engines.node`, `packageManager`
- Lockfile picks the package manager: `package-lock.json` → npm, `yarn.lock` → yarn,
  `pnpm-lock.yaml` → pnpm, `bun.lockb` → bun. Using the wrong one corrupts the tree.
- `.nvmrc` → Node version
- Monorepo markers: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `workspaces` field

### Python
- `pyproject.toml` → `requires-python`, dependencies, and the tool: `[tool.poetry]`,
  `[tool.uv]`, `[tool.hatch]`, or plain PEP 621
- `requirements*.txt`, `Pipfile`, `environment.yml` → older or conda-based flows
- `manage.py` → Django (expect migrations + a database before first run)
- `alembic/`, `migrations/` → a migration step belongs in the quickstart

### Go
- `go.mod` → module path and Go version; `go mod download`, `go run ./cmd/...`
- `cmd/` subdirectories are the entry points

### Rust
- `Cargo.toml` → `[[bin]]` targets, `rust-version`; `rust-toolchain.toml` pins the channel

### JVM
- `pom.xml` (Maven) or `build.gradle[.kts]` (Gradle) → Java version, main class
- `gradlew` / `mvnw` wrappers mean the reader does *not* need Gradle/Maven installed

### Ruby / PHP / .NET
- `Gemfile` + `.ruby-version`; `bin/setup` if present is the intended entry point
- `composer.json` → scripts and PHP constraint
- `*.csproj` / `global.json` → target framework and SDK version

## Finding environment variables

Search the source rather than trusting an existing `.env.example`:

- Node: `process.env.`, `import.meta.env.`
- Python: `os.environ`, `os.getenv`, `Settings(` (pydantic-settings), `django.conf.settings`
- Go: `os.Getenv`, `envconfig`
- Ruby: `ENV[`
- Java: `@Value("${`, `System.getenv`
- Any: `.env`-loading calls — `dotenv`, `load_dotenv`, `godotenv`

Classify each hit:
- **Required** — no default in code; the app crashes or misbehaves without it
- **Optional** — has a code default; document the default, don't require it
- **Secret** — API keys, tokens, passwords; empty value plus a comment naming the source

## Finding ports and services

- Compose `ports:` and `services:` — the authoritative list
- `listen(`, `PORT`, `--port`, framework config (`server.port`, `ASGI` runner args)
- Databases, caches, queues, and object stores each need a running instance *and* usually
  a connection string in the env

## Finding the verify step

The quickstart needs a way for the reader to prove it worked. Look for, in order:
a health endpoint (`/health`, `/healthz`, `/api/status`), the dev-server URL printed on
boot, a CLI `--version` or `--help`, or the fastest test command in CI.
