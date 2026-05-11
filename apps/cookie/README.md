# 🍪 Cookie

> **Crumbles bugs. Occasionally reality too.**

A cross-platform, terminal-first autonomous AI coding assistant that plugs into any LLM provider and runs natively on Windows, Linux, and macOS.

Cookie is the kind of assistant that feels like a brilliant hacker friend at 3AM — slightly sleep-deprived, devastatingly competent, with the dry humor of a systems wizard who's seen too many stack traces.

---

## ✨ Features

- **🔌 Multi-LLM Support** — OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama, LM Studio, any OpenAI-compatible endpoint
- **🖥️ True Cross-Platform** — Windows (PowerShell/CMD/WSL), Linux, macOS as first-class citizens
- **🛡️ Safety System** — Blocks destructive commands, requires confirmation for risky ops, scans for secret exposure
- **🧠 Memory** — Session memory + persistent SQLite storage across conversations
- **🔧 Tool System** — Shell execution, file ops, git, code search — all with safety checks
- **📋 Planning Engine** — Multi-step task decomposition with progress tracking
- **🎭 Personality** — Context-aware humor that enhances, never interrupts
- **🧩 Plugin SDK** — Extend Cookie with custom tools and integrations
- **⚡ Streaming** — Real-time token streaming from any provider
- **🎨 Beautiful TUI** — Ink-powered terminal UI with colors, spinners, and status indicators

---

## 🚀 Quick Start

### 1. Install

```bash
cd cookie
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run

```bash
# Interactive chat mode (with fancy UI)
npm run dev

# Or with plain text mode
npm run dev -- chat --no-ui

# Single prompt
npm run dev -- run "explain this error: ENOENT: no such file"

# Check config
npm run dev -- config

# List providers
npm run dev -- providers
```

---

## 🔧 Configuration

Cookie reads configuration from (in priority order):
1. Command-line flags
2. Environment variables (`.env`)
3. Config file (`~/.cookie/config.json`)
4. Defaults

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `GROQ_API_KEY` | Groq API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `OLLAMA_BASE_URL` | Ollama endpoint | `http://localhost:11434` |
| `LMSTUDIO_BASE_URL` | LM Studio endpoint | `http://localhost:1234` |
| `COOKIE_DEFAULT_PROVIDER` | Default LLM provider | `openai` |
| `COOKIE_DEFAULT_MODEL` | Default model | `gpt-4o` |
| `COOKIE_SAFETY_MODE` | Safety: strict/normal/yolo | `normal` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│              Terminal UI (Ink)           │
├─────────────────────────────────────────┤
│           Core Agent Runtime            │
│  ┌──────────┐  ┌───────────┐            │
│  │ Planning  │  │Personality│            │
│  └──────────┘  └───────────┘            │
├──────────┬──────────┬───────────────────┤
│ Provider │  Tools   │  Safety  │ Memory │
│ Registry │ Registry │  Engine  │ System │
├──────────┴──────────┴──────────┴────────┤
│            Plugin System                │
└─────────────────────────────────────────┘
```

### Modules

| Module | Purpose |
|--------|---------|
| `core/agent.ts` | Core agent loop with autonomous tool calling |
| `core/config.ts` | Configuration management with Zod validation |
| `core/events.ts` | Typed event bus for inter-module communication |
| `providers/` | LLM provider adapters (OpenAI, Anthropic, etc.) |
| `tools/` | Built-in tools (shell, files, git, search) |
| `safety/` | Dangerous command detection and permission system |
| `memory/` | Session + persistent SQLite memory |
| `personality/` | Context-aware humor and system prompt |
| `planner/` | Task decomposition and progress tracking |
| `plugins/` | Plugin SDK and loader |
| `platform/` | OS detection, shell adaptation, path normalization |
| `ui/` | Ink-based terminal UI components |

---

## 🧩 Plugin Development

Create a plugin by implementing the `CookiePlugin` interface:

```typescript
import { definePlugin } from 'cookie-ai';
import type { Tool, ToolResult } from 'cookie-ai';

class MyTool implements Tool {
  name = 'my_tool';
  description = 'Does something awesome';
  riskLevel = 'safe' as const;
  parameters = {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input value' },
    },
    required: ['input'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    return { success: true, output: `Processed: ${args.input}` };
  }
}

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My awesome Cookie plugin',
  tools: [new MyTool()],
});
```

Place plugins in `~/.cookie/plugins/<plugin-name>/index.js` and they'll be loaded automatically.

---

## 💬 Chat Commands

| Command | Description |
|---------|-------------|
| `/exit`, `/quit` | Exit Cookie |
| `/clear` | Clear chat history |
| `/provider <name>` | Switch LLM provider |
| `/model <name>` | Switch model |
| `/mode <mode>` | Switch mode (chat/autonomous/plan) |
| `/help` | Show help |

---

## 🛡️ Safety

Cookie's safety system operates in three modes:

- **`strict`** — Confirms ALL non-safe operations
- **`normal`** — Confirms high-risk and critical operations
- **`yolo`** — No confirmations (use at your own peril)

### Blocked by default:
- `rm -rf`, `del /f /s /q` (recursive deletion)
- `sudo`, `runas` (privilege escalation)
- Registry modifications
- `git push --force` (use `--force-with-lease`)
- Piping remote scripts to shell
- System shutdown/reboot

---

## 🎭 Personality Examples

Cookie's humor is context-aware and never interrupts critical work:

```
🍪 Installing 1,284 packages to render a slightly rounder button.
🍪 This error message appears to have been written by an emotionally unavailable compiler.
🍪 Thinking aggressively.
🍪 Bug neutralized. It died confused.
🍪 Windows has once again expressed its creativity.
```

But during destructive operations:
```
⚠️ This operation could be destructive. Proceeding with caution.
🛑 Force push blocked by safety system. Use --force-with-lease instead.
```

---

## 📄 License

MIT
