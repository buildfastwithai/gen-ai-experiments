<p align="center">
  <a href="https://www.buildfastwithai.com/">
    <img src="../assets/Banner2.png" width="900px" alt="BuildFastWithAI: Master Generative AI">
  </a>
</p>

<h1 align="center">🧩 Agent Skills</h1>

<p align="center">
  <strong>Installable, model-agnostic skills for AI agents — reusable <code>SKILL.md</code> capabilities you can drop into Claude Code, Cowork, or Codex.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Format-SKILL.md-000000?style=for-the-badge" alt="SKILL.md">
  <img src="https://img.shields.io/badge/Anthropic_Claude-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/Cowork-6E56CF?style=for-the-badge" alt="Cowork">
  <img src="https://img.shields.io/badge/Codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex">
</p>

---

## 🤔 What is an Agent Skill?

A **skill** is a self-contained folder that teaches an agent a repeatable workflow. At minimum it contains a `SKILL.md` with YAML front matter (`name` + `description`) followed by step-by-step instructions. Larger skills add supporting files:

```
<skill-name>/
├── SKILL.md        # name, description, and the workflow the agent follows
├── scripts/        # helper scripts the skill can run
├── references/     # docs, schemas, and examples the skill reads
└── assets/         # images, templates, and static resources
```

The `description` is the trigger — an agent reads it and decides when the skill applies. Smaller, single-file skills are grouped into **packs** (e.g. `frontend-skills/`, `tooling-workflow-skills/`) where each `.md` is one skill.

---

## 📦 Skill Catalog

### 🎨 Build & Ship

Full skills with their own `SKILL.md` and supporting assets.

| Skill | What it does |
|-------|--------------|
| **[Landing Page Generator](landing-page-generator/SKILL.md)** | High-converting landing pages as production-ready HTML — built-in design themes, copy frameworks (PAS, AIDA, BAB), CTA strategy, SEO meta, and automated conversion/speed audits. Also reviews and improves existing pages. |
| **[Talking Avatar](talking-avatar/SKILL.md)** | Realtime voice-chat apps with a lip-synced character avatar on OpenAI Realtime (Vite/Next.js). From a photo or description: identity-consistent portrait, mouth sprites, audio-driven lip sync, BYOK, and deploy. |
| **[Crazy Ecommerce Builder](crazy-ecommerce-builder/SKILL.md)** | Turns a short brand brief into an art-directed storefront — a creative thesis, original ImageGen product photography, responsive implementation, cart interactions, and optional publishing. |

### 🖥️ Frontend Skills — [`frontend-skills/`](frontend-skills/)

Reusable UI-building and design-direction skills.

| Skill | What it does |
|-------|--------------|
| **[Frontend Core](frontend-skills/core/frontend.md)** | Baseline conventions for building clean, accessible frontends. |
| **[Tailwind Component Factory](frontend-skills/core/tailwind-component-factory.md)** | Generate consistent, reusable Tailwind components. |
| **[Glass UI System](frontend-skills/styles/glass-ui-system.md)** | Frosted-glass, translucent depth design system. |
| **[Neo-Brutalism Web](frontend-skills/styles/neo-brutalism-web.md)** | High-contrast, raw, brutalist web aesthetic. |
| **[Minimal Luxury UI](frontend-skills/styles/minimal-luxury-ui.md)** | Restrained, premium, whitespace-driven design. |
| **[Bold SaaS Marketing UI](frontend-skills/styles/bold-saas-marketing-ui.md)** | Conversion-focused, bold SaaS marketing layouts. |
| **[Editorial Web Layout](frontend-skills/styles/editorial-web-layout.md)** | Magazine-style editorial typography and grids. |
| **[Retro-Futurist Web](frontend-skills/styles/retro-futurist-web.md)** | Retro-futuristic, synthwave-inspired styling. |

### 🛠️ Backend Skills — [`backend-skills/`](backend-skills/)

APIs, authentication, and data modeling.

| Skill | What it does |
|-------|--------------|
| **[MCP Server Builder](backend-skills/api-auth-data/mcp-server-builder.md)** | Scaffold production-ready Model Context Protocol servers. |
| **[Next.js Route Handler](backend-skills/api-auth-data/nextjs-route-handler.md)** | Build robust Next.js API route handlers. |
| **[MERN Auth Best Practices](backend-skills/api-auth-data/mern-auth-best-practices.md)** | Secure authentication patterns for MERN stacks. |
| **[Mongoose Schema Architect](backend-skills/api-auth-data/mongoose-schema-architect.md)** | Design clean, scalable Mongoose/MongoDB schemas. |

### 📝 Docs & Research — [`docs-writing-research-skills/`](docs-writing-research-skills/)

Writing, documentation, and evidence-backed research.

| Skill | What it does |
|-------|--------------|
| **[README Architect](docs-writing-research-skills/readme-architect.md)** | Production-quality GitHub READMEs with badges, setup, usage, and contribution guidance. |
| **[Research Synthesizer](docs-writing-research-skills/research-synthesizer.md)** | Synthesize multiple sources into a structured, cited Markdown report with confidence notes. |
| **[Deck Outline Generator](docs-writing-research-skills/deck-outline-generator.md)** | High-impact slide outlines and per-slide image prompts for Streamlit + fal-client workflows. |

### ⚙️ Tooling & Workflow — [`tooling-workflow-skills/`](tooling-workflow-skills/)

Agent reliability, tool use, and developer workflow.

| Skill | What it does |
|-------|--------------|
| **[Tool Use Validator](tooling-workflow-skills/tool-use-validator.md)** | Validate function-calling JSON payloads against a schema before execution. |
| **[Prompt Optimizer (CoT)](tooling-workflow-skills/prompt-optimizer-cot.md)** | Rewrite vague tasks into robust Chain-of-Thought prompts with verification steps. |
| **[Agent Output Critic](tooling-workflow-skills/agent-output-critic.md)** | Strict QA review of another agent's output for hallucinations, security, and logic flaws. |
| **[Git Conventional Commits](tooling-workflow-skills/git-conventional-commits.md)** | Generate Conventional Commit messages and PR descriptions from real diffs. |
| **[Linux Kernel Troubleshooter](tooling-workflow-skills/linux-kernel-troubleshooter.md)** | Diagnose and recover Ubuntu/Lubuntu kernel, boot, and networking failures. |

---

## 🚀 How to Use

Skills are model-agnostic — any agent that understands `SKILL.md` can run them.

- **Claude Code / Cowork:** point the agent at a skill folder, or reference it by name. The agent reads the `SKILL.md` and follows the workflow. Some skills call companion skills (e.g. `imagegen`, `sites-building`) — install those too for the full experience.
- **Codex:** several skills here (Talking Avatar, Crazy Ecommerce Builder) are written for Codex-style agents and coordinate companion skills automatically.
- **Any agent:** open the `SKILL.md`, follow the steps manually, and use the files in `scripts/`, `references/`, and `assets/` as directed.

> 💡 Skills that generate images or deploy sites expect companion skills (`imagegen`, `sites-building`, `sites-hosting`). If one isn't available, the skill falls back to the closest local workflow and notes the limitation.

---

## 🤝 Contributing a Skill

1. Create a folder: `skills/<skill-name>/` (or add a single `.md` to an existing pack).
2. Add a `SKILL.md` with YAML front matter:
   ```yaml
   ---
   name: your-skill-name
   description: One or two sentences on what it does AND when an agent should trigger it.
   ---
   ```
3. Write clear, step-by-step instructions. Keep the scope tight and the trigger specific.
4. Add `scripts/`, `references/`, or `assets/` only if the skill needs them.
5. Open a Pull Request. See the repo [CONTRIBUTING guide](../CONTRIBUTING.md) for details.

---

<div align="center">
  <p>Made with ❤️ by <a href="https://buildfastwithai.com">BuildFastWithAI</a></p>
  <p>⭐ Star the <a href="https://github.com/buildfastwithai/gen-ai-experiments">repo</a> if you find these skills helpful!</p>
</div>
