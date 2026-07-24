---
name: demo-site-builder
description: Build a single-file, self-contained HTML demo/landing website that showcases a GitHub repository's functionality. Use this skill whenever asked to generate a demo site, landing page, showcase page, project website, or interactive demo for a repo. Produces one portable demo.html with no build step and no external dependencies beyond optional CDN assets.
metadata:
  mcpmarket-version: 1.0.0
---
# Demo Site Builder

Turn a repository analysis into ONE self-contained `demo.html` that a reader can open in any browser and immediately understand what the project does and why it matters. The page both *explains* and, where feasible, *demonstrates* the functionality.

## Non-negotiables

- **Single file.** Everything — HTML, CSS, JS — lives in one `demo.html`. No build step, no `node_modules`, no local asset files.
- **Works offline by double-click.** It must render fully when opened directly from disk (`file://`). Only optional enhancements (a web font, a syntax-highlight CDN, an icon set) may load from a CDN, and the page must still look correct if those fail.
- **Grounded in the analysis.** Every feature, number, code sample, and claim comes from the `analyze_repo` output (description, README, languages, topics, stars, commits). Never invent capabilities, benchmarks, or quotes. If the README shows a real usage snippet, reuse it verbatim.
- **No secrets, no live network calls to the user's services.** A demo may simulate behavior in-browser, but must not require API keys or hit private endpoints.

## Page structure (in order)

1. **Hero** — project name, a one-line tagline distilled from the description, 2-4 badges (language, license, stars, latest version if any), and two buttons: "View on GitHub" (links to the repo URL) and a "See it in action" anchor to the demo section.
2. **Problem → Solution** — 1-2 short paragraphs: the problem the repo solves and how it solves it. Pulled from the README intro.
3. **Key features** — a responsive grid of 3-6 cards, each with an icon/emoji, a title, and one sentence. Only features evidenced by the analysis.
4. **Live demo or walkthrough** — the centerpiece:
   - If the repo is a browser-runnable JS/TS library or produces visual/text output that can be reproduced client-side, embed a genuinely interactive widget (inputs → live result) implemented in inline JS.
   - If it is a CLI, backend, or non-browser tool, build a realistic **simulated terminal / API playground**: the user clicks example commands and sees representative output (clearly labelled "sample output"), driven by canned data taken from the README. Do not fake success of things you cannot actually run.
   - Always label simulated output honestly.
5. **Usage / code example** — the real install + minimal usage from the README, in a styled, copy-to-clipboard code block.
6. **Tech stack** — languages (with the analyzed percentages) and notable topics as pills.
7. **Footer** — repo link, license, "Generated launch demo" note, contributor credit.

## Styling guidance

- Modern, clean, developer-facing. Default to a dark theme (e.g. `#0d1117` bg, `#e6edf3` text, an accent like `#8b7cf8` or `#58a6ff`) with a light-mode toggle if cheap to add.
- System font stack (`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) or a single CDN font with a safe fallback.
- All CSS in one `<style>` block. Use CSS variables for colors so the theme is easy to tweak. Generous whitespace, `max-width` container (~1000-1100px), responsive down to mobile with a single media query.
- Subtle polish only: a hero gradient, soft card shadows/borders, smooth `scroll-behavior`, hover states. No heavy animation libraries.
- Accessible: semantic tags (`<header> <main> <section> <footer>`), sufficient contrast, `alt`/`aria-label` where needed, keyboard-focusable interactive elements.

## JavaScript guidance

- Vanilla JS in one inline `<script>` at the end of `<body>`. No frameworks unless the repo itself is a framework you're demoing.
- Keep interactivity self-contained and deterministic. Guard every CDN-dependent feature so the page degrades gracefully.
- Copy-to-clipboard on code blocks is a nice, cheap touch.

## Output contract

- Emit the complete `demo.html` as the deliverable (write it to the output directory). It must be valid, self-contained HTML5 starting with `<!DOCTYPE html>`.
- Do not include placeholder lorem ipsum — if the analysis lacks something (e.g. no code sample), omit that piece rather than fabricating it.

## Reference

- `references/template.html` — a ready starter skeleton (hero, features grid, demo playground, code block, tech pills, footer, dark theme, copy button). Adapt it to the repo; strip sections you can't fill honestly.

## Quick checklist before delivering

1. Opens correctly from `file://` with no console errors.
2. Every claim traces back to the analysis — nothing invented.
3. Simulated output is clearly labelled as such.
4. Responsive at mobile width; contrast is readable.
5. Repo URL is linked in the hero and footer.
6. It's one file, no external build, CDN assets are optional and gracefully degrade.
