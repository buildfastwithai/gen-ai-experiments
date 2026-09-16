# OnboardFlow

**A single board for every new hire's onboarding.**

New-hire setup work is scattered across Jira, Linear, GitHub, Zendesk, and more. OnboardFlow pulls all of it into one readiness board through **Merge's unified Ticketing API**, so you can instantly see each person's onboarding progress and what is still blocking them.

Built for onboarding leads, engineering managers, and people-ops teams.

---

## The Problem

When someone joins a team, their setup is spread across many tools:

- GitHub access lives in a GitHub issue
- Slack invite lives in a Jira ticket
- VPN + 2FA lives in a Linear issue
- Welcome session lives in Zendesk

No one can answer the simple question: **"Is this new hire ready?"**

## What OnboardFlow Does

```text
Jira ─┐
Linear ─┼── Merge Ticketing ──> OnboardFlow
GitHub ─┤                        (one readiness board)
Zendesk ─┘
```

- Pulls onboarding tickets from every connected tracker
- Shows overall progress, open items, and overdue tasks
- Groups readiness **per new hire** (completion %)
- Flags **unassigned** and **due-soon** tickets that are stalling
- Writes status changes back to the source tracker through Merge

## Features

| Feature | Description |
| --- | --- |
| Unified board | All onboarding tickets from every tracker in one view |
| New-hire readiness | Per-assignee completion % with progress bars |
| Triage panel | Unassigned and due-soon tickets that need a person |
| Due-date badges | Highlights `Unassigned`, `Due in Nd`, `Overdue` |
| Status updates | Change status and it writes back through Merge |
| Priority sorting | URGENT / HIGH / NORMAL / LOW |
| Dark mode | Theme toggle |
| Health + sync status | Check Merge configuration and sync state |

---

## Why Merge

Instead of writing and maintaining an integration for every ticketing tool, OnboardFlow writes **one** integration against Merge's Ticketing Common Model.

- One API covers Jira, Linear, GitHub Issues, Zendesk, Asana, and more.
- Adding a new tracker is a configuration change, not new code.
- Per-customer authentication is handled by Merge Link.
- Provider schema changes are absorbed by Merge.
- One security review across all tools.

Merge endpoints used:

```text
GET   /tickets          List onboarding tickets
GET   /users            Map assignee IDs to names
GET   /collections      Boards / projects
GET   /sync-status      Merge sync health
PATCH /tickets/{id}     Update ticket status
```

---

## Requirements

- Node.js 18 or newer (no npm dependencies required)
- A Merge account with the **Ticketing** category enabled
- A linked Ticketing account (Jira, Linear, GitHub Issues, etc.)
- A Merge **API key** and the linked account's **Account Token**

---

## Setup

### 1. Create a Merge project

1. Sign up at [merge.dev](https://merge.dev).
2. Create a project and enable the **Ticketing** category.
3. Add a Ticketing integration (Linear, Jira, GitHub Issues).
4. Link an account. For a demo, use a **Test/sandbox** account so you do not need real provider credentials.

### 2. Enable the Ticket scope

Merge blocks the Tickets endpoint unless the **Ticket** Common Model scope is enabled.

Go to:

```text
Merge Dashboard → Scopes → Ticketing
```

Enable the **Ticket** object (and optionally **Collection** and **Tag**).

If `/tickets` returns `403 ... The Ticket endpoint is inaccessible`, this scope is the cause.

### 3. Get your credentials

| Value | Where to find it |
| --- | --- |
| `MERGE_API_KEY` | Merge → **API Keys** → Production or Test access key |
| `MERGE_ACCOUNT_TOKEN` | Merge → **Linked Accounts** → click your account → token at the bottom of the page |

The API key and the linked account must belong to the **same environment** (Production key with a Production account, Test key with a Test account).

### 4. Configure the API base URL

Merge uses regional hosts. Check the **API tester** in your Merge dashboard for your host:

```text
https://api.merge.dev/api/ticketing/v1       (US)
https://api-eu.merge.dev/api/ticketing/v1    (EU)
https://api-ap.merge.dev/api/ticketing/v1    (APAC)
```

### 5. Create `.env`

```powershell
Copy-Item .env.example .env
```

```env
MERGE_API_KEY=your_merge_api_key
MERGE_ACCOUNT_TOKEN=your_account_token
MERGE_API_BASE=https://api-ap.merge.dev/api/ticketing/v1

PORT=3000
ONBOARDING_TAG=onboarding
ONBOARDING_DAYS=14
STATUS_OPTIONS=OPEN,IN_PROGRESS,CLOSED
```

Never commit `.env`.

### 6. Run

```powershell
npm run check
npm start
```

Open:

```text
http://localhost:3000
```

Click **Sync onboarding board**.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MERGE_API_KEY` | — | Merge access key (required) |
| `MERGE_ACCOUNT_TOKEN` | — | Linked account token (required) |
| `MERGE_API_BASE` | `https://api.merge.dev/api/ticketing/v1` | Regional Merge host |
| `PORT` | `3000` | Local server port |
| `ONBOARDING_TAG` | `onboarding` | Only show tickets with this tag. Leave empty to show all tickets. |
| `ONBOARDING_DAYS` | `14` | Tickets older than this are counted as overdue |
| `STATUS_OPTIONS` | `OPEN,IN_PROGRESS,CLOSED` | Status buttons shown in the ticket modal |

> Set `ONBOARDING_TAG=` (empty) to show **all** tickets — useful for a first demo before tagging anything.

---

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check whether Merge is configured |
| `GET` | `/api/dashboard` | Latest board snapshot |
| `GET` | `/api/sync-status` | Merge sync health per model |
| `POST` | `/api/scan` | Fetch tickets from Merge and rebuild the board |
| `POST` | `/api/tickets/update` | Update a ticket status through Merge |
| `POST` | `/api/resync` | Force a Merge re-sync (Professional/Enterprise only) |

---

## Project Structure

```text
src/env.js               Zero-dependency .env loader
src/merge-ticketing.js   Merge Ticketing API client
src/server.js            Board server + readiness logic
public/index.html        Dashboard markup
public/styles.css        Dashboard styling
public/app.js            Dashboard behavior
data/                    (none) all data comes live from Merge
```

---

## Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `401 Invalid Production Key` | Key from a different environment or region | Use the key matching the account and the regional `MERGE_API_BASE` |
| `403 The Ticket endpoint is inaccessible` | Ticket scope disabled | Enable the **Ticket** scope in Merge → Scopes → Ticketing |
| `400 Input must be a single Ticket object` | Wrong PATCH body | The client already wraps updates as `{ "model": { ... } }` |
| `400 State On Hold does not exist` | Linear has no "On Hold" workflow state | Use `STATUS_OPTIONS=OPEN,IN_PROGRESS,CLOSED` |
| New ticket not showing | Merge syncs on a schedule on the free plan | Wait for the next sync shown in `/api/sync-status`, then refresh |
| `403 ... only available for Professional and Enterprise` | Force-resync is a paid feature | Refresh instead of forcing a sync |

---

## Notes

- Merge syncs from the provider on a schedule. On the free Launch plan, new tickets appear after the next sync.
- Status values are Merge-normalized enums: `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `CLOSED`. Some trackers do not support every value.
- Use Merge sandbox data for demos and never commit real customer data.
- This project has **zero runtime dependencies** — it uses the built-in Node `fetch` and `http` modules.

---
