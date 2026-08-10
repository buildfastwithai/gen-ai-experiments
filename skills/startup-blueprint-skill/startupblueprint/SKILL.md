---
name: startupblueprint
description: Turn a startup, SaaS, app, developer tool, website, repository, or product idea into an evidence-backed business plan, monetization strategy, pricing architecture, editable 12-month financial model, and 90-day execution roadmap. Use when Codex needs to analyze how a startup can become a sustainable business; decide free versus paid, monthly, annual, usage-based, one-time, or lifetime pricing; design tiers and upgrade triggers; estimate unit economics and break-even under explicit assumptions; compare scenarios; or produce a native Markdown business plan, formula-driven Excel workbook, and CSV roadmap from a URL or description.
---

# StartupBlueprint

Turn a startup URL, repository, or description into a decision-ready plan for how the product can acquire customers, charge, cover its costs, and reach a testable first version of sustainability.

Read [references/research-playbook.md](references/research-playbook.md) before researching. Read [references/analysis-schema.md](references/analysis-schema.md) before creating the analysis JSON. Read [references/financial-model.md](references/financial-model.md) before generating the workbook.

Resolve `SKILL_DIR` as the directory containing this `SKILL.md`. Run bundled scripts from `SKILL_DIR`. Write deliverables into the user's current workspace, normally under `outputs/`.

## Workflow

### 1. Understand the startup

- Inspect the supplied URL, repository, landing page, pricing page, README, screenshots, or description.
- Identify the product, stage, geography, currency, primary user, economic buyer, painful job, promised outcome, delivery model, current free or paid offer, and founder's immediate objective.
- Distinguish verified product facts, public market evidence, user-supplied numbers, working assumptions, and unknowns.
- Ask one concise question only when the answer changes the economic model materially and cannot be represented safely as an editable assumption. Otherwise continue and label assumptions.
- Never inspect private analytics, billing, customer, or financial data unless the user explicitly supplies or authorizes it.

### 2. Research the market and business model

- Use current public evidence. Prefer official product, pricing, documentation, terms, and company pages.
- Research the current prices and packaging of at least three relevant competitors or substitutes in `standard` mode; aim for five to eight when the category supports it.
- Identify the most plausible customer segment, economic buyer, distribution channels, value metric, revenue streams, cost drivers, and defensible advantage.
- Treat competitor pricing as an anchor, not proof of willingness to pay.
- Link every material competitor price and market claim to a direct source with a checked date.
- Define a narrow initial ICP, buying trigger, qualification signals, anti-ICP, positioning, and the cheapest reachable distribution wedge.
- Build TAM, SAM, and a realistic 24-month SOM bottom-up only when eligible account counts and annual revenue per account are sourced or visibly labeled assumptions. Otherwise keep the values unknown and show the missing formula inputs.

### 3. Design monetization and pricing

- Compare at least four plausible monetization models. Always evaluate a recurring model and explicitly decide whether one-time or lifetime access is safe.
- Choose one primary model and one credible alternative to validate.
- Propose concrete tiers with target segment, monthly-equivalent price hypothesis, limits, included value, upgrade trigger, and expected paid-customer mix.
- Make free versus trial, annual discount, usage overage, and lifetime decisions explicit.
- Reject uncapped lifetime access when meaningful hosting, API, inference, data, support, or storage costs continue.
- Present prices as hypotheses until supported by transaction or customer evidence.

### 4. Build the financial inputs

- Capture opening free and paid users, monthly acquisition, free-to-paid conversion, direct paid acquisition, churn, variable costs, fixed costs, acquisition spend, setup revenue, and starting cash.
- Store every input as `{value, status, confidence, basis, source_url}` using the schema. Use `status: user`, `public`, `assumption`, or `unknown`.
- Never invent a hidden number. For a missing input, either use `null` with `unknown` or create a visible, conservative assumption and explain its basis.
- Create conservative, base, and optimistic scenarios by changing explicit drivers rather than pasting desired outputs.

### 5. Validate and score the plan

Write `outputs/startupblueprint-analysis.json`, then run:

```bash
python3 "$SKILL_DIR/scripts/prepare_plan.py" \
  outputs/startupblueprint-analysis.json \
  outputs/startupblueprint-prepared.json
```

The script validates evidence, ICP, market sizing, positioning, go-to-market, pricing mix, financial inputs, scenario coverage, and roadmap coverage; computes a deterministic readiness score and 12-month preview; assigns `EVIDENCE_BACKED`, `PROVISIONAL`, or `INSUFFICIENT_DATA`; and returns `HEALTHY`, `FRAGILE`, `UNSUSTAINABLE`, or `INSUFFICIENT_DATA`. Do not manually override its score, status, or verdict.

### 6. Generate the HTML business report and roadmap

Run:

```bash
python3 "$SKILL_DIR/scripts/generate_startupblueprint_report.py" \
  outputs/startupblueprint-prepared.json \
  outputs/startupblueprint-report.html \
  --csv outputs/startupblueprint-90-day-roadmap.csv
```

The HTML file is the visual business report. The CSV is the operating roadmap, with an objective, action, deliverable, metric, and decision rule for every 90-day phase.

### 7. Generate the editable financial model

- Use the Codex spreadsheet runtime and `@oai/artifact-tool`; do not substitute another workbook library.
- Load the bundled workspace dependencies, create a `node_modules` symlink in a writable working directory pointing to the provided Node packages, and use the provided Node executable.
- Run:

```bash
node "$SKILL_DIR/scripts/generate_financial_model.mjs" \
  outputs/startupblueprint-prepared.json \
  outputs/startupblueprint-financial-model.xlsx \
  --preview-dir outputs/startupblueprint-financial-model-preview
```

- Verify every sheet visually, inspect representative formulas, scan formula errors, and keep the generated previews only as QA support.
- Treat blue-font cells as editable inputs, black as formulas, green as links to another sheet, and yellow fill as an assumption or missing input requiring attention.

### 8. Deliver the result

Return clickable absolute links to:

- `startupblueprint-report.html` — visual strategy report with business model, pricing decision, risks, evidence, scenarios, and roadmap.
- `startupblueprint-financial-model.xlsx` — editable inputs, pricing, unit economics, scenarios, 12-month forecast, dashboard charts, sources, and checks.
- `startupblueprint-90-day-roadmap.csv` — execution sequence and evidence gates for days 1–90.

Summarize the recommended business model, base price hypothesis, readiness score, first go-to-market channel, financial verdict, break-even estimate, and largest unverified assumption. If the result is `INSUFFICIENT_DATA`, say which exact inputs must be measured before using the forecast.

## Modes

- `quick` — Use available evidence, up to three comparables, provisional assumptions, and a compact plan.
- `standard` — Use three to eight comparables, four monetization models, all three scenarios, and the complete deliverables. Use by default.
- `deep` — Add broader competitors, channel evidence, contradiction checks, and more granular costs.
- `pre-revenue` — Focus on monetizing a free product with no historical revenue or conversion data.
- `audit` — Evaluate an existing business model, pricing structure, and economics before proposing changes.

## Safety and quality bar

- Never claim guaranteed demand, conversion, profitability, product-market fit, funding, or growth.
- Never hide invented CAC, churn, conversion, costs, margin, or customer volume inside the model.
- Never label competitor pricing as willingness-to-pay evidence.
- Never invent market size, eligible accounts, customer pain, willingness to pay, testimonials, partnerships, or competitor capabilities.
- Never recommend uncapped lifetime access against ongoing variable or support costs.
- Never change live prices, billing, checkout, product limits, customer subscriptions, ads, or outbound campaigns automatically.
- Keep taxes, payment fees, refunds, contracts, migrations, and regional pricing visible as limitations when relevant.
- Prefer a reversible 90-day test plan over false precision.
