# Contributing to gen-ai-experiments

Thanks for contributing! This repo is organized by **what a thing is**, not by which
model it uses. Before adding anything, find the right home for it below.

## Repository layout

```
skills/       Installable agent skills (each contains a SKILL.md)
agents/       Systems that autonomously choose their own tools or actions
workflows/    Predefined, multi-step AI automation pipelines
mcp/          MCP servers, clients, integrations, and examples
apps/         Runnable, user-facing AI applications
cookbooks/    Educational notebooks, model/tool experiments, evaluations, workshops
archive/      Old, broken, duplicated, incomplete, or unmaintained content
```

## Where does my contribution go?

| If it is...                                                        | Put it in...                     |
| ------------------------------------------------------------------ | -------------------------------- |
| An installable skill with a `SKILL.md`                             | `skills/<skill-name>/`           |
| An autonomous agent that decides its own actions                   | `agents/<agent-name>/`           |
| A fixed, multi-step automation pipeline                            | `workflows/<workflow-name>/`     |
| An MCP server / client / integration                               | `mcp/servers|clients|integrations/` |
| A runnable, user-facing application                                | `apps/<app-name>/`               |
| A teaching notebook, model demo, eval, or workshop                 | `cookbooks/<category>/`          |
| Old, broken, superseded, or incomplete work                        | `archive/legacy/`                |

`cookbooks/` subcategories: `models/`, `tools/`, `agents/`, `mcp/`, `rag/`,
`multimodal/`, `fine-tuning/`, `evaluations/`, `workshops/`.

## Folder conventions

**Skills** (`skills/<name>/`): `SKILL.md` (required), plus optional `scripts/`,
`references/`, and `assets/`.

**Agents** (`agents/<name>/`) and **Apps** (`apps/<name>/`): `README.md`, `src/`,
`examples/` (agents), `assets/` (apps), `requirements.txt`, and `.env.example`.

**Workflows** (`workflows/<name>/`): `README.md`, `workflow.yaml`, `src/`,
`prompts/`, `examples/`, `requirements.txt`, and `.env.example`.

## Guidelines

1. **Use a clear folder name.** Prefer lowercase-with-hyphens (e.g. `chat-with-pdf`).
2. **Add a README.** Every project folder should explain what it does and how to run it.
3. **Never commit secrets.** Provide a `.env.example` with placeholder values instead.
4. **Pin dependencies.** Include a `requirements.txt` (or `package.json`) that runs from a clean environment.
5. **Notebooks** belong in `cookbooks/`; keep them runnable top-to-bottom and clear any large output cells before committing.
6. **Archiving.** Don't delete outdated work outright — move it under `archive/legacy/` so history and context are preserved.

## Pull requests

- Keep PRs focused on a single addition or change.
- Fill out the PR template.
- Make sure the folder lands in the correct top-level category above.
