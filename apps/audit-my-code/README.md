# AuditMyCode

AuditMyCode is a native Windows security-audit application for source code and public GitHub repositories. It combines fast private local analysis with optional AI Deep Review.

## What It Does

### Local Security Scan

The Local Security Scan runs on-device without an API key. It checks source and configuration files for:

- Hardcoded API keys, tokens, passwords, database URLs, private keys, and webhooks
- XSS risks such as `innerHTML`, `eval`, `document.write`, and unsafe HTML rendering
- SQL injection, command injection, NoSQL injection, path traversal, and unsafe XML parsing
- Weak cryptography such as MD5, SHA-1, DES, ECB mode, hardcoded keys, insecure randomness, and reused IVs
- Authentication issues such as weak JWT verification, missing auth guards, unsafe CORS, missing rate limits, plaintext passwords, and missing input validation

Each report includes a security score, severity counts, affected file and line, evidence, explanation, and recommended fix.

### GitHub Repository Scan

Click **GitHub URL** and enter a public repository URL:

```text
https://github.com/owner/repository
```

AuditMyCode downloads one GitHub source archive, extracts it locally, and scans every eligible source/configuration file. It never clones, installs, or executes repository code.

It supports JavaScript, TypeScript, Python, Go, Java, Ruby, PHP, SQL, HTML, CSS, JSON, YAML, TOML, `.env`, Dockerfiles, and more. Dependency and generated folders such as `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, and virtual environments are ignored.

For safety, full import stops clearly if the archive is larger than 75 MB, eligible files exceed 5,000, or extracted source exceeds 50 MB. It never silently scans only part of a repository.

### File and Folder Import

You can import individual files, multiple files, an entire folder, or drag and drop a project into the workspace. Files are editable and findings are grouped by file.

### AI Deep Review with BYOK

AI Deep Review is optional and uses a key supplied by the user. Supported providers:

- OpenAI — GPT-4o mini
- Anthropic — Claude Haiku
- Gemini — Gemini Flash

The AI review looks for contextual issues that local checks may miss, such as data-flow problems, authorization gaps, business-logic risks, insecure trust boundaries, and cross-file interactions. Results include severity, file, line, evidence, explanation, and remediation.

API keys stay in memory for the session and are not saved to disk. Source is sent to a provider only when the user explicitly starts AI Deep Review. Local scans never upload source code.

## Native Windows App

The app is packaged with Electron and opens in its own native desktop window. Users do not need Node.js, npm, or a browser to run the executable.

The current executable is included at:

```text
desktop-release-github/AuditMyCode.exe
```

## Development

Requirements: Node.js 22+, npm, and Windows for `.exe` packaging.

```powershell
npm install
npm run dev
```

Run the Electron development app:

```powershell
npm run electron:dev
```

Build the native portable executable:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npx electron-builder --win portable
```

The output is written to `desktop-release-github/AuditMyCode.exe`.

## GitHub Actions

`.github/workflows/build-windows.yml` builds the Windows executable on manual dispatch or version tags such as `v1.0.0`, then uploads it as the `AuditMyCode-Windows` artifact.

## Security Notes

- Imported code is treated as text and never executed.
- Local analysis runs entirely on-device.
- AI review is opt-in and provider-specific.
- Findings are heuristic and should be verified by a qualified security engineer.
