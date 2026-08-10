# Nango PR Reviewer

> A CodeRabbit-style GitHub pull request reviewer powered by Nango and OpenAI.

Nango PR Reviewer reads a GitHub pull request, analyzes the changed code, optionally loads related Notion documentation through Nango, and posts a detailed review directly inside the GitHub conversation. After the review is posted, it can send a short notification to Slack.

There is no dashboard. The complete developer experience happens in GitHub.

## Why This Exists

Most code review bots can see the code diff, but they do not always know the product or architecture context behind the change. This project demonstrates how Nango can provide a secure integration layer for GitHub, Notion, and Slack while OpenAI focuses on code-review reasoning.

The project showcases:

- Nango OAuth connections and token lifecycle management.
- GitHub pull request and issue-comment webhooks.
- GitHub diff, comments, and changed-file retrieval through the Nango proxy.
- Optional Notion architecture and specification context.
- AI-generated review summaries and actionable findings.
- Deterministic security checks for high-signal vulnerabilities.
- Slack review notifications through the Nango Slack connection.

## Review Flow

<img width="1310" height="628" alt="Image" src="https://github.com/user-attachments/assets/24bbea36-fc3b-4083-aecf-642a988325c0" />
Nango stores provider credentials and refreshes tokens. The application only uses Nango API keys and connection IDs.

## Example GitHub Result

The bot posts a conversation comment similar to:

```text
Tip

@developer: Here are some suggestions for improvements:

1. Credential is hardcoded in source [security, app.py, line 12]
2. Arbitrary code execution from user input [security, app.py, line 28]
3. Broad exception handling hides failures [reliability, app.py, line 35]

Review summary:
The pull request introduces a security risk and needs changes before merging.
```

<img width="993" height="896" alt="Image" src="https://github.com/user-attachments/assets/8e1a05ac-1f39-4b57-91c5-128f960af37f" />

## Review Coverage

The OpenAI review checks the changed code across these categories:

- Security: secrets, authentication, authorization, injection, eval/exec, unsafe deserialization, path traversal, SSRF, shell commands, XSS, insecure TLS, and sensitive logs.
- Correctness: missing input, malformed payloads, boundary conditions, indexing, state transitions, race conditions, duplicate events, idempotency, and backwards compatibility.
- Reliability: timeouts, retries, rate limits, resource cleanup, transactions, partial failures, and exception handling.
- Performance: unbounded work, N+1 requests, blocking operations, repeated work, and missing pagination.
- API and operations: validation, response status handling, breaking changes, configuration, observability, and safe defaults.
- Testing and maintainability: missing tests, untested failure paths, dead code, confusing abstractions, and stale documentation.

Deterministic checks supplement the model and catch high-signal patterns such as:

- Hardcoded credentials.
- `eval()` and `exec()`.
- Shell injection risks.
- Unsafe pickle or YAML deserialization.
- Disabled TLS verification.
- XSS sinks such as `innerHTML`.
- Unvalidated external input.
- Broad exception handling.

## Requirements

- Node.js 18 or newer.
- A Nango account and environment.
- A GitHub repository accessible by the Nango GitHub connection.
- An OpenAI API key or another OpenAI-compatible LLM endpoint.
- A public webhook URL. Use ngrok locally or deploy the server.

## 1. Create The Nango API Key

Open the Nango dashboard and select the environment you will use, such as `dev`.

Go to:

```text
Environment settings -> API Keys
```

<img width="1280" height="720" alt="Image" src="https://github.com/user-attachments/assets/09601b1c-bb25-4dd8-93c5-92e64ccaaba7" />

Create or copy an API key. This is used as `NANGO_SECRET_KEY`.

Never add the real key to GitHub, README screenshots, or chat messages.

## 2. Configure GitHub In Nango

1. Open **Integrations** in Nango.
2. Create or open **GitHub (User OAuth)** for a personal test.
3. Copy the exact **Integration ID**. The standard integration in this project is `github`.
4. Open **Connections**.
5. Choose **Add Test Connection**.
6. Authorize the GitHub account that can access the repository.
7. Copy the generated GitHub **Connection ID**.

For a production product with many users or organizations, use a GitHub App integration instead of one personal OAuth connection.

## 3. Configure Notion In Nango (Optional)

1. Create the normal **Notion** integration in Nango.
2. Do not select Notion MCP or SCIM for this project.
3. Create a test connection under **Connections**.
4. Authorize the Notion workspace.
5. Share the architecture or specification page with the connected Notion integration.
6. Copy the Notion Integration ID and Connection ID.

Notion is only used when the PR description contains a Notion page URL or page ID. If Notion is not configured, the GitHub-only review still works.

## 4. Configure Slack In Nango (Optional)

1. Create the normal **Slack** integration in Nango.
2. Authorize a test Slack connection.
3. Copy the Slack Integration ID and Connection ID.
4. Open the destination Slack channel.
5. Copy its channel ID. It usually begins with `C` for a public channel or `G` for a private channel.
6. Ensure the connected Slack app or user can post in that channel.

## 5. Create The Environment File

Copy the safe template:

```powershell
Copy-Item .env.example .env
```

Fill `.env` with your actual values:

```env
# Nango GitHub
NANGO_SECRET_KEY=your_nango_api_key
NANGO_GITHUB_CONFIG_KEY=github
NANGO_GITHUB_CONNECTION_ID=your_github_connection_id

# OpenAI
OPENAI_API_KEY=your_openai_api_key
LLM_MODEL=gpt-4o-mini

# GitHub webhook and comment publishing
GITHUB_WEBHOOK_SECRET=use_the_same_value_in_github
POST_REVIEW_COMMENT=true

# Optional Notion
NANGO_NOTION_CONFIG_KEY=notion
NANGO_NOTION_CONNECTION_ID=your_notion_connection_id

# Optional Slack
NANGO_SLACK_CONFIG_KEY=slack
NANGO_SLACK_CONNECTION_ID=your_slack_connection_id
SLACK_CHANNEL_ID=C0123456789
POST_SLACK_NOTIFICATION=true
```

If an optional provider is not configured, leave its variables empty or remove them.

## 6. Run Locally

Open PowerShell in the `Nango-PR-Reviewer` folder:

```powershell
npm run check
npm start
```

The server starts at:

```text
http://localhost:3000
```

Check the configuration:

```text
http://localhost:3000/api/health
```

Expected response after configuration:

```json
{"ok":true,"nangoConfigured":true,"llmConfigured":true}
```

## 7. Expose The Local Server

In a second PowerShell window:

```powershell
npx ngrok http 3000
```

Keep both `npm start` and ngrok running. Copy the HTTPS ngrok URL.

## 8. Configure The GitHub Webhook

In the repository:

```text
Settings -> Webhooks -> Add webhook
```

Use:

```text
Payload URL: https://your-ngrok-url.ngrok-free.app/webhooks/github
Content type: application/json
Secret: the same value as GITHUB_WEBHOOK_SECRET
```

Select these events:

- Pull requests
- Issue comments

Enable **Active** and save the webhook.

The URL must end with `/webhooks/github`. Do not use only the ngrok root URL.

## 9. Test The Bot

Create or update a pull request. The bot automatically reviews:

- Opened pull requests.
- Reopened pull requests.
- Pull requests updated with a new commit.

For a manual review, add this GitHub comment:

```text
/context review
```

The bot posts the result in the PR conversation.

If Slack is enabled, the bot posts a short result after GitHub publishing succeeds.

## Notion Context In A PR

Add a Notion page URL or ID to the PR description when the change depends on architecture or product documentation:

```text
Design document:
https://www.notion.so/workspace/billing-architecture-0123456789abcdef0123456789abcdef
```

The server fetches the page and child blocks through Nango, including headings, paragraphs, lists, code blocks, and to-do items. The text is sent to OpenAI with the GitHub diff.

## API Endpoints

### `POST /webhooks/github`

Receives GitHub pull request and issue-comment events. Signature verification is enabled when `GITHUB_WEBHOOK_SECRET` is set.

### `POST /api/review`

Runs a review directly. Pass `publish: true` to publish the result to GitHub.

### `GET /api/health`

Reports whether Nango and OpenAI environment variables are present.

### `GET /api/review-brief/latest`

Returns the most recent in-memory review for local debugging. Persistent review storage is not included.

## Deployment

Deploy this folder to Render, Railway, Fly.io, AWS, or another Node.js host.

Use:

```text
Build command: npm install
Start command: npm start
```

Add the `.env` values in the host environment settings. Do not upload `.env`.

After deployment, change the GitHub webhook URL to:

```text
https://your-deployed-domain.com/webhooks/github
```

## Troubleshooting

### `POST / 405 Method Not Allowed`

The webhook URL is missing `/webhooks/github`.

### `unknown_provider_config`

The `NANGO_*_CONFIG_KEY` value does not exactly match the Integration ID in the same Nango environment as the API key.

### `invalid_headers` or missing `provider-config-key`

Restart the server after updating the code and verify the Nango Integration ID and Connection ID.

### No GitHub comment

Check `POST_REVIEW_COMMENT=true`, `OPENAI_API_KEY`, the GitHub connection, server logs, and GitHub webhook **Recent Deliveries**.

### No Notion context

Confirm the page is shared with the connected Notion integration, the PR contains a page URL or ID, and the Notion variables are configured.

### No Slack notification

Confirm `POST_SLACK_NOTIFICATION=true`, the Slack channel ID is correct, and the connected Slack app can post in that channel.

## Security Checklist

- Never commit `.env`.
- Never include Nango, OpenAI, GitHub, Slack, or Notion secrets in screenshots.
- Revoke any credential that was exposed.
- Use a strong GitHub webhook secret.
- Use separate Nango connections for separate environments or organizations.
- Treat AI findings as review assistance and verify them before merging.

## Local Status

This repository is a local prototype and has not been committed or pushed. The `docs/images` folder is intentionally prepared for redacted screenshots before sharing the project.
