# AI Sales Follow-Up Agent

An AI sales assistant that finds cold leads across Gmail and Zoho CRM, explains why conversations stopped, and prepares personalized follow-ups. Built with Composio and OpenAI.

## Flow

<img width="990" height="700" alt="Image" src="https://github.com/user-attachments/assets/f49df9ec-aab5-4e29-9e02-b7dc708a9459" />

The dashboard is available at `http://localhost:3000`.

## What Is Composio?

Composio is the integration and authentication layer used by this agent. It lets the app execute Gmail, Zoho, Google Calendar, and Slack tools without implementing separate OAuth and token-refresh systems for every provider.

### Which Composio Mode?

Use **[Composio Platform](https://dashboard.composio.dev)** for this project. Platform is where you create a project, generate a project API key, create Auth Configs, and manage connected accounts for the Node.js agent.

**[Composio For You](https://dashboard.composio.dev)** is for connecting Composio to existing tools such as Claude, Cursor, ChatGPT, or MCP clients. Do not use its `ck_...` Sessions API key in this project.

Create an account at [composio.dev](https://composio.dev), then switch the dashboard to **Platform** mode.

### Composio Terms

- **Toolkit:** An app provider such as `gmail`, `zoho`, `googlecalendar`, or `slack`.
- **Auth Config:** The authentication blueprint for a toolkit.
- **Connected account:** A user-authorized account for a toolkit.
- **User ID:** The stable user whose connected accounts the agent can use.
- **Project API key:** The server key used for Composio REST API calls.

This project executes tools such as:

```text
GMAIL_FETCH_EMAILS
GMAIL_SEND_EMAIL
ZOHO_LIST_LEADS
ZOHO_UPDATE_LEAD
GOOGLECALENDAR_EVENTS_LIST
SLACK_CHAT_POST_MESSAGE
```

Use a **Platform project API key** in `COMPOSIO_API_KEY`. Do not use the `ck_...` key from Composio **For You / MCP** settings.

## What It Does

1. Fetches recent Gmail messages.
2. Fetches leads from Zoho CRM or contacts from HubSpot.
3. Checks Google Calendar activity.
4. Matches CRM records with email history.
5. Finds leads that need attention.
6. Uses OpenAI to explain the situation and draft a follow-up.
7. Lets the user edit and explicitly send the email.
8. Optionally updates the CRM and notifies Slack during an approved batch run.

The dashboard analysis button is safe by default: it drafts but does not send.

## Setup

### Requirements

- Node.js 18+
- Composio project API key
- OpenAI API key
- Connected Gmail, Zoho/HubSpot, Calendar, and optional Slack accounts in Composio

### Environment

```powershell
Copy-Item .env.example .env
```

Fill in:

```env
COMPOSIO_API_KEY=your_project_api_key
OPENAI_API_KEY=your_openai_api_key
LLM_MODEL=gpt-4o-mini

COMPOSIO_USER_ID=your_stable_user_id
CRM_PROVIDER=zoho
COLD_LEAD_DAYS=14

# Sender identity used in email signatures
SALES_REP_NAME=Your name
SALES_REP_TITLE=Your role
SALES_REP_COMPANY=Your company
SALES_REP_PHONE=Your phone
SALES_REP_EMAIL=you@company.com

# Auth Config IDs from your Composio Platform project
COMPOSIO_GMAIL_AUTH_CONFIG_ID=ac_gmail_id
COMPOSIO_ZOHO_AUTH_CONFIG_ID=ac_zoho_id
COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID=ac_calendar_id
COMPOSIO_SLACK_AUTH_CONFIG_ID=ac_slack_id

# Optional Slack destination
SLACK_CHANNEL_ID=C0123456789
```

Keep `.env` private. Do not commit API keys.

### Connect Accounts

1. Switch Composio to **Platform** mode.
2. Select or create a project.
3. Create a Platform project API key under **API Keys**.
4. Create managed Auth Configs for Gmail, Zoho, Google Calendar, and Slack.
5. Put their IDs in `.env`.
6. Start the server.

Open these URLs one at a time and authorize each account:

```text
http://localhost:3000/api/connect/gmail
http://localhost:3000/api/connect/zoho
http://localhost:3000/api/connect/googlecalendar
http://localhost:3000/api/connect/slack
```

Use the same `COMPOSIO_USER_ID` for every connection.

Composio stores and refreshes provider tokens. Raw Gmail, Zoho, Calendar, and Slack tokens never enter this application.

## Run

```powershell
npm run check
npm start
```

Check configuration:

```text
http://localhost:3000/api/health
```

Open the dashboard:

```text
http://localhost:3000
```

Click **Analyze pipeline** to load real data. Review a lead to edit its draft, then click **Send follow-up** to send one email.

## Optional Batch Actions

The normal dashboard flow does not send automatically. To intentionally send follow-ups, update Zoho, and notify Slack in one batch:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/analyze-leads" -Method Post -ContentType "application/json" -Body '{"daysBack":30,"executeActions":true}'
```

Use this only when you explicitly want side effects.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Configuration status |
| `GET` | `/api/dashboard` | Latest dashboard state |
| `GET` | `/api/leads` | All CRM leads |
| `GET` | `/api/activity` | Latest agent activity |
| `POST` | `/api/analyze-leads` | Analyze the pipeline |
| `POST` | `/api/draft-followup` | Generate one draft |
| `POST` | `/api/send-followup` | Explicitly send one email |
| `POST` | `/api/execute` | Execute a Composio tool |
| `GET` | `/api/tools/search` | Search Composio tools |

## Composio Tools Used

- `GMAIL_FETCH_EMAILS`
- `GMAIL_SEND_EMAIL`
- `ZOHO_LIST_LEADS`
- `ZOHO_UPDATE_LEAD`
- `GOOGLECALENDAR_EVENTS_LIST`
- `SLACK_CHAT_POST_MESSAGE`

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Composio `401` | Use a Platform project API key, not the For You/MCP `ck_` key. |
| No connected account | Connect the app using `/api/connect/<toolkit>` with the same user ID. |
| No leads | Set `CRM_PROVIDER=zoho` and verify the Zoho connection. |
| No Gmail matches | Use lead email addresses that exist in the connected Gmail history. |
| No Slack message | Set `SLACK_CHANNEL_ID` and verify Slack posting permission. |
| Placeholder signature | Fill the `SALES_REP_*` variables and restart the server. |

## Security

- Keep Composio and OpenAI keys server-side.
- Review drafts before sending.
- Use a test Composio user and test CRM leads locally.
- Treat AI output as assistance, not final sales judgment.
