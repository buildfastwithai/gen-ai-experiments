---
name: launchaudit
description: Audit a startup, SaaS, app, developer tool, landing page, or product before launch from a live URL, localhost page, repository, screenshots, or supplied copy. Use when Codex needs to determine what a startup appears to do, test whether its public experience is launch-ready, inspect positioning, calls to action, product proof, trust, UX, accessibility, responsive behavior, broken paths, technical surface, or launch operations, produce a Ready to launch / Launch after critical fixes / Not ready yet verdict, prioritize exact improvements, or create a polished standalone HTML launch-readiness report.
---

# LaunchAudit

Audit the startup as a first-time visitor and launch reviewer. Infer the product before asking questions, inspect the public experience, distinguish evidence from inference, and deliver exact fixes in a standalone report.

## Language

- Match the user's language in conversation.
- Write the report in the user's language unless they request another language.
- Preserve product names, URLs, interface labels, and source quotations when accuracy requires it.

## Read the references

- Read [references/evaluation-framework.md](references/evaluation-framework.md) before every audit.
- Read [references/report-schema.md](references/report-schema.md) before creating the JSON source or HTML report.

## Select the mode

- `standard` — Inspect the primary public journey and create the full report. Use by default.
- `quick` — Inspect the main page, primary CTA, and most important trust path. Return the verdict and top five fixes.
- `deep` — Inspect relevant product, pricing, documentation, trust, install, and conversion paths on desktop and mobile.
- `technical` — Emphasize broken paths, metadata, responsive behavior, accessibility signals, console errors, and visible performance risks.
- `before-after` — Compare two versions with the same criteria and clearly attribute improvements or regressions.

Do not imply that a public-page audit can verify private analytics, billing, production monitoring, legal compliance, or authenticated product behavior.

## Workflow

### 1. Inspect before asking

- Open the supplied URL or artifact and determine what the startup appears to do, who it serves, the promised outcome, the mechanism, the primary action, and the likely launch stage.
- Prefer the integrated browser for live sites and localhost apps. Inspect visible page state before interacting.
- Follow relevant public navigation and CTA destinations. Do not submit forms, create accounts, begin trials, install software, make purchases, or transmit user data unless the user explicitly authorizes that action.
- Use screenshots when visual hierarchy, responsive behavior, clipping, overlap, or interaction state matters.
- Inspect a supplied repository only when it is in scope. Treat repository findings as product evidence, not proof that production uses the same version.
- Ask only about missing information that would materially change the verdict. The default request should work with only a URL.

### 2. Reconstruct the startup

State:

- what the product appears to be
- primary audience
- urgent problem or trigger
- promised outcome
- mechanism
- primary CTA
- current alternative

Label each important statement as **Observed**, **Inferred**, or **Unknown**. If the startup cannot be explained accurately after the first screen and one supporting section, treat that as a launch finding rather than asking the founder to explain it.

### 3. Trace the public journey

Follow the smallest realistic path from first visit to the primary conversion:

1. Arrival
2. Comprehension
3. Evidence
4. Risk reduction
5. Action
6. Confirmation or next-step expectation

Record the exact page, element, or interaction that supports each finding. Do not manufacture analytics or user behavior.

### 4. Evaluate readiness

Use the weighted system in `references/evaluation-framework.md`.

- Score only what the inspected evidence supports.
- Mark inaccessible or private criteria as unknown.
- Report both the normalized readiness score and evidence coverage.
- Identify critical blockers before calculating the verdict.
- Never award “Ready to launch” when a primary conversion path is broken, the product cannot be understood, or evidence coverage is too low.

### 5. Prescribe fixes

For every material issue include:

- diagnosis
- observed evidence
- user or business consequence
- severity
- effort
- confidence
- exact recommended change
- validation method

Provide replacement copy for copy problems. Describe the target component and desired behavior for UI problems. Keep fixes within the inspected evidence; do not prescribe a complete rebrand or rebuild when a focused correction is enough.

Rank:

1. Launch blockers
2. High-impact fixes
3. Quick wins
4. Later improvements

### 6. Build the seven-day plan

Turn the recommendations into a realistic sequence:

- Day 1: clarify and unblock
- Days 2–3: repair the primary journey
- Days 4–5: add proof and trust
- Day 6: verify responsive and technical surfaces
- Day 7: retest and launch

Adapt the plan when the product needs less or more work. Do not pretend that legal, security, or infrastructure risks can always be fixed in seven days.

### 7. Create the report

- Serialize the full analysis to `outputs/<startup-slug>-launchaudit.json`.
- Generate `outputs/<startup-slug>-launchaudit.html` with:

```bash
node scripts/generate_report.mjs <input.json> <output.html>
```

- Validate the JSON and generated report.
- Inspect the report for missing sections, escaped text, score consistency, and readable colors.
- Return clickable absolute links to both files.
- Keep the JSON beside the HTML so a later audit can compare versions without starting over.

## Verdict rules

- **Ready to launch** — score at least 80, evidence coverage at least 70%, no critical blocker, and the primary path works.
- **Launch after critical fixes** — score 55–79, or score 80+ with a material blocker that can be corrected without changing the core product.
- **Not ready yet** — score below 55, the startup remains unclear, the primary path is broken, or the experience lacks enough product reality to support a responsible launch.

Use the more cautious verdict when score and blocker evidence disagree. Explain the override.

## Quality bar

- Make the report useful without founder narration.
- Separate product quality from presentation quality.
- Prefer concrete evidence over taste.
- Do not invent customers, traction, analytics, performance measurements, security controls, legal compliance, or production behavior.
- Do not penalize a startup for lacking enterprise features when its audience does not need them.
- Treat accessibility, privacy, security, and legal observations as preliminary unless a qualified audit establishes them.
- Include strengths worth preserving, not only problems.
- End with the next retest and the smallest measurable launch experiment.

## Default output

Deliver:

1. Reconstructed startup
2. Launch verdict, readiness score, and evidence coverage
3. Weighted diagnostic scorecard
4. Primary journey map
5. Critical blockers
6. Prioritized improvements with exact fixes
7. Copy or interface corrections where useful
8. Seven-day action plan
9. Retest checklist and launch experiment
10. Standalone HTML report and editable JSON source
