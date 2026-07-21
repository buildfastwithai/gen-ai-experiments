# SkillSpector Check (CLI)

A Zero-Setup Node.js CLI wrapper for [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector). This tool allows developers to evaluate AI agent skills (MCP tools, LangChain agents, Claude configurations, etc.) directly via `npx` with zero local configuration.

If you don't have the underlying Python `skillspector` engine installed, this wrapper will automatically download and install it in the background for you!

## Usage (No Setup Required)

You can instantly scan any GitHub repository, local directory, or zip file. Just run:

```bash
# Scan a remote GitHub repository
npx skillspector-check https://github.com/vercel-labs/agent-skills

# Scan a local folder
npx skillspector-check ./my-local-skill
```

### Full AI Semantic Analysis (Recommended)
By default, SkillSpector attempts to use an LLM to read your code and intelligently filter out false-positive security warnings. To use this mode, simply set your API key as an environment variable before running:

**On macOS / Linux (bash/zsh):**
```bash
# Set your provider (openai, anthropic, or nv_inference)
export SKILLSPECTOR_PROVIDER="openai"
export OPENAI_API_KEY="sk-your-key-here"

npx skillspector-check .
```

**On Windows (PowerShell):**
```powershell
# Set your provider (openai, anthropic, or nv_inference)
$env:SKILLSPECTOR_PROVIDER="openai"
$env:OPENAI_API_KEY="sk-your-key-here"

npx skillspector-check .
```

### Fast Static Mode (No LLM)
If you don't have an API key or want to run a lightning-fast scan (e.g. for a CI/CD pipeline), you can use the `--no-llm` flag. This runs strict Regex, AST, and YARA static analysis rules:

```bash
npx skillspector-check . --no-llm
```

### Outputting Large Reports
If the repository is very large, the terminal might cut off the output. You can export the report to a Markdown file to read in your editor:

```bash
npx skillspector-check . --format markdown --output report.md
```

---

## Contributing (Local Development)

If you'd like to contribute to this Node wrapper, follow these steps to run the code locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/skill-check-cli.git
   cd skill-check-cli
   ```

2. **Install dependencies:**
   *(There are no external npm dependencies right now, but you can run `npm install` if any are added)*

3. **Run the local code:**
   Instead of using `npx`, run the local source file directly:
   ```bash
   node src/cli.js <PATH_TO_SCAN>
   ```

4. **Environment Variables:**
   Copy the `.env.example` file to `.env` to keep track of your API keys locally without committing them.

## License
Apache-2.0
