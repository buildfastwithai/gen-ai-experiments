# Launch MCP 🚀

A Claude plugin that analyzes a GitHub repository and generates a complete launch kit — each deliverable saved as its own file: repo analysis, release notes, changelog, blog post, X / Reddit / Hacker News / LinkedIn posts, an interactive HTML demo site, and an SVG share card.

Zero dependencies — a single self-contained MCP server. Just needs Node.js 18+.

## Install

**Claude Code:**

```shell
/plugin marketplace add buildfastwithai/launch-mcp
/plugin install launch-mcp@buildfastwithai-plugins
```

**Cowork (Claude desktop app):** Settings → Plugins → add marketplace → paste this repo's GitHub URL → install **launch-mcp**.

## Tools

| Tool | Purpose |
|------|---------|
| `analyze_repo` | Whole-repo analysis: stats, languages, topics, contributors, recent commits, tags, README. Source material for every prompt. |
| `generate_share_card` | 1200×630 announcement image as **SVG**, returned inline (save as `share-card.svg`) |

## Prompts

Each prompt writes one file:

| Prompt | Output file |
|--------|-------------|
| `analysis` | `analysis.md` |
| `release-notes` | `release-notes.md` |
| `changelog` | `changelog.md` |
| `blog-post` | `blog.md` |
| `x` | `x.md` |
| `reddit` | `reddit.md` |
| `hackernews` | `hackernews.md` |
| `linkedin` | `linkedin.md` |
| `demo-site` | `demo.html` |
| `full-launch-kit` | all of the above + `share-card.svg` |

All prompts take a `repo` (owner/repo or URL) and optional `output_dir`. Every prompt runs `analyze_repo` first, then writes its file.

## Bundled writing skills

The plugin ships four expert playbooks in `skills/`, and the server injects them into the matching prompts automatically — no separate install:

- **x-algo-tweet-writer** — applied by the `x` prompt (and `full-launch-kit`) so tweets are engineered for the X "For You" algorithm.
- **writing-linkedin-posts** — applied by the `linkedin` prompt (and `full-launch-kit`) for authentic, Top-Voice-style posts.
- **demo-site-builder** — applied by the `demo-site` prompt (and `full-launch-kit`) to build a single-file, self-contained HTML demo website.
- **ui-ux-pro-max** — applied together with `demo-site-builder` so the demo site follows professional UI/UX rules (accessibility, contrast, typography, spacing, interaction states, responsive layout). Design-intelligence guidance only; the upstream Python/CSV search backend is not bundled. Source: github.com/nextlevelbuilder/ui-ux-pro-max-skill.

When installed as a plugin, these also register as normal skills, so they trigger whenever you ask for an X post, a LinkedIn post, or a demo site.

## Usage

- "Analyze the repo vercel/next.js"
- "Generate the full launch kit for buildfastwithai/gen-ai-experiments"
- "Build a demo website for owner/repo"
- "Write the X and LinkedIn posts for owner/repo"

## Configuration

Optional `GITHUB_TOKEN` environment variable: raises API rate limits (5,000 req/h vs 60) and enables private repos.

## License

MIT
