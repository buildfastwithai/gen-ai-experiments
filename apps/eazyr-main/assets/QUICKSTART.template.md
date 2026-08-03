# Quickstart

Get <PROJECT> running locally in about <N> minutes.

## What success looks like

<!-- Show this first so the reader can recognize "done" — and skip steps they've done. -->

```
$ curl localhost:3000/health
{"status":"ok","version":"1.4.2"}
```

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | >= 20 | `node -v` |
| pnpm | >= 9 | `pnpm -v` |
| Docker | any recent | `docker info` |

Or check everything at once:

```bash
./scripts/doctor.sh
```

```powershell
.\scripts\doctor.ps1
```

## Setup

**1. Clone and install**

```bash
git clone <REPO_URL>
cd <PROJECT>
pnpm install
```

**2. Configure**

```bash
cp .env.example .env
```

<!-- Name only the variables that must be edited before first run. Everything else
     ships with a working local default. -->

Edit `.env` and set:

- `DATABASE_URL` — the local default works as-is if you use the Docker services below
- `API_KEY` — get one from <WHERE>

**3. Start services**

```bash
docker compose up -d
```

<!-- Include this only if first run needs it. Delete otherwise. -->

**4. Prepare the database**

```bash
pnpm db:migrate
pnpm db:seed
```

## Run

```bash
pnpm dev
```

Then confirm:

```bash
curl localhost:3000/health
```

## Common tasks

| Task | Command |
| --- | --- |
| Run tests | `pnpm test` |
| Lint and format | `pnpm lint` |
| Create a migration | `pnpm db:migrate:new <name>` |
| Reset local data | `docker compose down -v && docker compose up -d` |
| Production build | `pnpm build` |

## Troubleshooting

<!-- Key each entry on the literal error text — that is what people search for.
     Use the failures you actually hit while verifying this guide. -->

**`EADDRINUSE: address already in use :::3000`**
Another process holds the port.

```bash
lsof -ti:3000 | xargs kill
```

```powershell
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

**`ECONNREFUSED 127.0.0.1:5432`**
Postgres isn't up yet. Run `docker compose up -d`, then `docker compose ps` — the
`db` service must read `healthy`, which takes a few seconds after start.

**`Error: Cannot find module ...` right after install**
The dependency tree was built by a different package manager. Reset it:

```bash
rm -rf node_modules && pnpm install
```

## Next steps

- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Open issues](<ISSUES_URL>)
