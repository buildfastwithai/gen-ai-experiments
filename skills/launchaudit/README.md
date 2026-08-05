# LaunchAudit

A Codex skill that audits a startup from its URL, decides whether it is ready to launch, and creates a prioritized launch-readiness report.

Give Codex a live startup, SaaS, app, developer tool, landing page, localhost URL, repository, screenshot, or copy draft. LaunchAudit reconstructs what the product appears to do, follows the public conversion journey, finds critical blockers, and tells the founder exactly what to improve.

## What it does

- Understands the startup without requiring a founder questionnaire
- Inspects the public experience as a first-time visitor
- Evaluates positioning, audience relevance, conversion, proof, trust, UX, technical surface, and launch operations
- Separates observed evidence from inference and unknowns
- Produces a `Ready to launch`, `Launch after critical fixes`, or `Not ready yet` verdict
- Reports both a readiness score and evidence coverage
- Identifies critical blockers before cosmetic improvements
- Writes exact copy and interface corrections when useful
- Creates a realistic seven-day repair plan
- Generates a polished standalone HTML report and editable JSON source

## Installation

```bash
npx --yes launchaudit@latest
```

This installs the skill into:

```text
~/.codex/skills/launchaudit
```

Restart Codex after installation so it can discover the skill.

## Usage

Audit a live startup:

```text
Use $launchaudit to audit https://example.com before launch.
```

Run a deeper review:

```text
Use $launchaudit in deep mode on https://example.com. Inspect the pricing, documentation, trust, and primary conversion paths on desktop and mobile.
```

Focus on the technical public surface:

```text
Use $launchaudit in technical mode on http://localhost:3000.
```

Compare a redesign:

```text
Use $launchaudit in before-after mode to compare the current site at [URL] with the redesign at [URL].
```

## Report

The default report includes:

1. Reconstructed startup
2. Launch verdict
3. Readiness score and evidence coverage
4. Eight-part diagnostic scorecard
5. Primary visitor journey
6. Critical launch blockers
7. Prioritized fixes with evidence and validation
8. Exact copy or interface rewrites
9. Seven-day repair plan
10. Retest checklist and smallest measurable launch experiment

Codex writes the portable HTML report and its structured JSON source to the workspace `outputs/` directory and returns clickable local links.

The audit does not claim to prove product-market fit, conversion, security, legal compliance, or production reliability. Private behavior remains unknown unless the user explicitly supplies appropriate evidence and access.

A complete report generated from the public Synara launch journey is included in `examples/`.

## Modes

- `standard`: complete public launch audit
- `quick`: primary page, CTA, trust path, verdict, and top fixes
- `deep`: extended product, pricing, documentation, trust, and responsive inspection
- `technical`: public technical surface, metadata, errors, accessibility signals, and responsive behavior
- `before-after`: consistent comparison between two versions

## Manual installation

```bash
git clone https://github.com/Avi112005/launchaudit.git
mkdir -p ~/.codex/skills
cp -R launchaudit/launchaudit ~/.codex/skills/launchaudit
```

Restart Codex after installation.
