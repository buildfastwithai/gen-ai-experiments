# CI Flaky Observatory

**CI Flaky Observatory** is a lightweight Windows desktop app that studies your GitHub Actions history and shows where your CI pipeline is unreliable or slow.

It helps answer:

- Which jobs fail repeatedly?
- Which jobs are flaky instead of consistently broken?
- Which jobs take the longest to finish?
- Which branches have the most failures?
- How reliable is the repository’s CI overall?

This app analyzes GitHub Actions workflow and job history. It does **not** scan source code, use regex, or send your repository to an AI service.

## Quick Start

### 1. Open the app

Download or open this file from the repository:

```text
release/CI-Flaky-Observatory.exe
```

You do not need Node.js, Rust, or a browser to use the executable.

### 2. Create a GitHub access token

The app needs permission to read the Actions history of your repository. It cannot read your password and it cannot change your code or workflows.

Open GitHub’s token page:

<https://github.com/settings/personal-access-tokens>

Then follow these steps:

1. Open the **Fine-grained tokens** tab.
2. Click **Generate new token**.
3. Enter a name, for example:
   ```text
   CI Flaky Observatory
   ```
4. Choose an expiration date.
5. Under **Resource owner**, choose your GitHub account.
6. Under **Repository access**, choose **Only select repositories**.
7. Select the repository you want to analyze.
8. Scroll to **Repository permissions**.
9. Set these permissions:
   ```text
   Actions    → Read-only
   Metadata   → Read-only
   ```
10. Click **Generate token**.
11. Copy the token immediately. GitHub shows it only once.

Never commit the token, put it in a README, or share it in screenshots or chat.

### 3. Connect the repository in the app

Open CI Flaky Observatory and enter the full repository URL, for example:

```text
https://github.com/Avi112005/demo-workflow
```

Paste the GitHub token into the token field, choose a time period such as **Last 30 days**, and click **Observe pipeline**.

The repository must have GitHub Actions workflow runs. If it is new or empty, run a workflow first from:

Repository → Actions → Choose a workflow → Run workflow
```

## Demo Repository

You can test the app with:

```text
https://github.com/Avi112005/demo-workflow
```

Its workflow contains demo jobs that create different CI patterns:

- Stable unit tests
- Stable lint checks
- A deliberately flaky integration job
- A deliberately slow regression job
- A periodic failure job

To create useful history:

1. Open the repository’s **Actions** tab.
2. Select **CI Observatory Demo**.
3. Click **Run workflow**.
4. Choose the `mixed` scenario and run it several times.
5. Also run the `flaky`, `slow`, `failure`, and `stable` scenarios.
6. Return to CI Flaky Observatory and analyze the repository.

## Understanding the Dashboard

### CI Reliability

The percentage of workflow runs that completed successfully during the selected period.

### Failed Runs

The total number of workflow runs that ended with a failure.

### Flaky Signals

Jobs that sometimes pass and sometimes fail. These are usually caused by timing issues, unreliable external services, shared test data, or race conditions.

### Slowest Jobs

Jobs with the highest average execution time. These are good candidates for caching, parallelization, or test-scope improvements.

### Branch Failure Frequency

Compares failures across branches so you can see whether problems are concentrated on `main`, feature branches, or release branches.

## Privacy and Token Safety

- Your GitHub token is kept in memory only for the current app session.
- The token is not saved to disk.
- The token is not sent to any service other than GitHub’s API.
- The app uses read-only GitHub API requests.
- The app does not modify repositories, workflows, commits, or issues.
- The report is generated locally on your computer.

## Run from Source

Requirements:

- Node.js 22 or newer
- Rust stable
- Microsoft Visual Studio C++ Build Tools on Windows

Install frontend dependencies:

```powershell
npm install
```

Run the development app:

```powershell
npm run tauri dev
```

Build the Windows installer and executable:

```powershell
npm run tauri build
```

Build output is generated under:

```text
src-tauri/target/release/bundle/
```

## Common Errors

### “Repository not found”

Check that the URL is correct and that your token has access to that repository.

### “Token rejected”

Create a new fine-grained token and confirm that **Actions** is set to **Read-only**.

### “No workflow runs found”

Open the repository’s Actions tab and run a workflow first. The app can only analyze history that already exists.

### “Rate limit reached”

Wait a few minutes and try again. The app uses GitHub’s API and respects GitHub’s rate limits.

## GitHub Actions Build

The workflow at `.github/workflows/build-windows.yml` builds the Tauri Windows app on GitHub’s Windows runner and uploads the installer as an artifact.
