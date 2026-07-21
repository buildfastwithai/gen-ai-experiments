# 🪦 dep-graveyard

> Automatically scan your project dependencies for **abandoned**, **deprecated**, and **risky** packages — with a beautiful terminal report, AI-powered summary, and Slack notifications.

Supports **Node.js** (`package.json`) and **Python** (`requirements.txt`) projects simultaneously. Works on **local folders** or any **public GitHub URL** — no cloning needed.

---

## ✨ Features

- 🔍 **Scans npm + PyPI** registries for every dependency
- 💀 **Detects dead packages** — not updated in 1-2+ years
- 👤 **Flags single-maintainer packages** — high bus factor risk
- 🚨 **Catches deprecated/yanked packages** — officially abandoned
- 🧠 **AI Summary** — plain English explanation powered by Groq (free)
- 📣 **Slack Notifications** — automatic alerts to your team channel
- ⏰ **GitHub Action** — runs every Monday at 9am automatically, zero manual work
- 🌐 **GitHub URL support** — scan any public repo without cloning it

---

## 🚀 Quick Start (Zero Setup)

Scan any GitHub repository instantly — no installation needed:

```bash
npx dep-graveyard https://github.com/owner/repo
```

Scan your current local project:

```bash
npx dep-graveyard
```

---

## 📊 Risk Levels

| Level | Meaning | What to Do |
|-------|---------|------------|
| 💀 **CRITICAL** | Officially deprecated or yanked from npm/PyPI | Replace immediately |
| 🔴 **HIGH** | Not updated in **2+ years** | Plan to replace soon |
| 🟡 **MEDIUM** | Not updated in 1+ year, or **single maintainer** | Monitor closely |
| ✅ **SAFE** | No issues found | No action needed |

---

## 🧠 AI Summary (Free — Powered by Groq)

Get a plain English 3-sentence summary of your risks. Groq is **completely free** to use.

**Step 1 — Get a free Groq API key:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up → Click **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`)

**Step 2 — Set the key and run:**

On **macOS / Linux:**
```bash
export GROQ_API_KEY="gsk_your-key-here"
npx dep-graveyard https://github.com/owner/repo
```

On **Windows (PowerShell):**
```powershell
$env:GROQ_API_KEY="gsk_your-key-here"
npx dep-graveyard https://github.com/owner/repo
```

---

## 📣 Slack Notifications

Automatically post the full risk report to your Slack channel whenever risky packages are found.

**Step 1 — Create a Slack Incoming Webhook:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create an App** → **From scratch**
2. Name it `dep-graveyard`, select your workspace → **Create App**
3. Click **Incoming Webhooks** in the left sidebar → Toggle **ON**
4. Click **Add New Webhook to Workspace** → Select a channel → **Allow**
5. Copy the Webhook URL (looks like `https://hooks.slack.com/services/...`)

**Step 2 — Set the webhook and run:**

On **macOS / Linux:**
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"
npx dep-graveyard https://github.com/owner/repo
```

On **Windows (PowerShell):**
```powershell
$env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"
npx dep-graveyard https://github.com/owner/repo
```

---

## ⏰ Automatic Weekly Alerts (GitHub Action)

Set it up once and **never think about it again**. Every Monday at 9am UTC, GitHub automatically scans your repo and posts to Slack if risky packages are found.

### Setup Instructions

**Step 1 — Copy the workflow file into your project:**

Create this file in your repository:
`.github/workflows/dep-check.yml`

```yaml
name: 🪦 Dependency Graveyard — Weekly Audit

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am UTC
  workflow_dispatch:      # Allow manual runs from GitHub UI
    inputs:
      target_repo:
        description: 'GitHub repo URL to scan (leave empty to scan this repo)'
        required: false
        default: ''

jobs:
  dependency-audit:
    name: Scan Dependencies for Dead Packages
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run dep-graveyard scan
        continue-on-error: true
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          TARGET="${{ github.event.inputs.target_repo }}"
          if [ -n "$TARGET" ]; then
            npx dep-graveyard@latest "$TARGET"
          else
            npx dep-graveyard@latest .
          fi

      - name: Write job summary
        run: |
          echo "## 🪦 Dependency Graveyard Scan Complete" >> $GITHUB_STEP_SUMMARY
          echo "**Repository:** ${{ github.repository }}" >> $GITHUB_STEP_SUMMARY
          echo "**Triggered by:** ${{ github.event_name }}" >> $GITHUB_STEP_SUMMARY
          echo "**Ran at:** $(date -u)" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Check the logs above for the full dependency report." >> $GITHUB_STEP_SUMMARY
          echo "If you received a Slack notification, risky packages were found." >> $GITHUB_STEP_SUMMARY
```

**Step 2 — Add secrets to your GitHub repo:**
1. Go to your repo on GitHub
2. Click **Settings → Secrets and Variables → Actions**
3. Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `GROQ_API_KEY` | Your Groq key starting with `gsk_...` |
| `SLACK_WEBHOOK_URL` | Your Slack webhook URL |

**Step 3 — Test it immediately:**
1. Go to your repo → **Actions tab**
2. Click **🪦 Dependency Graveyard — Weekly Audit**
3. Click **Run workflow** → optionally type a GitHub URL → Click green **Run workflow** button
4. Watch the scan run live and see the Slack notification appear!

---

## 🛠️ All CLI Options

```bash
# Scan current directory
npx dep-graveyard

# Scan a specific GitHub repo
npx dep-graveyard https://github.com/owner/repo

# Skip AI summary (faster)
npx dep-graveyard --no-llm

# Skip Slack notification (terminal only)
npx dep-graveyard --no-slack

# Both flags together (fastest, terminal only)
npx dep-graveyard https://github.com/owner/repo --no-llm --no-slack
```

---

## 🗂️ Project Structure

```text
dep-graveyard/
├── src/
│   ├── cli.js          ← Main orchestration logic
│   ├── fetcher.js      ← Downloads files from GitHub or reads locally
│   ├── parsers.js      ← Parses package.json and requirements.txt
│   ├── checker.js      ← Checks npm + PyPI APIs, calculates risk scores
│   ├── reporter.js     ← Renders terminal report + formats Slack message
│   └── slack.js        ← Posts report to Slack via webhook
├── bin/
│   └── dep-graveyard.js ← 2-line executable entry point
├── .github/
│   └── workflows/
│       └── dep-check.yml ← GitHub Action for weekly automated scans
├── .env.example        ← Environment variable template
├── .gitignore
└── README.md
```

---

## 🤝 Contributing (Local Development)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/dep-graveyard.git
cd dep-graveyard

# Install dependencies
npm install

# Run locally (scan any GitHub repo)
node src/cli.js https://github.com/expressjs/express --no-slack --no-llm

# Run with full features (set env vars first)
$env:GROQ_API_KEY="gsk_your-key-here"
$env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
node src/cli.js https://github.com/expressjs/express
```

---

## 📄 License

Apache-2.0
