# StartupBlueprint

A Codex skill that turns a startup URL, repository, or product idea into an evidence-backed business plan, pricing strategy, editable financial model, and 90-day execution roadmap.

It combines market, ICP, positioning, business-model, go-to-market, pricing, and unit-economics analysis in one workflow. Missing data stays visible as an assumption or unknown instead of being presented as fact.

## What it does

- Understands a startup from a URL, repository, pricing page, or description
- Defines the initial ICP, buying trigger, anti-ICP, positioning, and distribution wedge
- Researches current competitors and official pricing pages
- Builds bottom-up TAM, SAM, and 24-month SOM when credible inputs exist
- Compares monthly, annual, usage, one-time, lifetime, freemium, and hybrid pricing
- Recommends concrete plans, prices, limits, and upgrade triggers
- Rejects unsafe uncapped lifetime pricing when ongoing costs continue
- Calculates a deterministic plan-readiness score with evidence caps
- Creates conservative, base, and optimistic 12-month scenarios
- Produces an editable Excel model with formulas, checks, and charts
- Creates a 90-day roadmap with metrics and decision gates

## Installation

```bash
npx --yes startupblueprint@latest
```

Restart Codex after installation.

## Usage

Give it a startup URL:

```text
Use $startupblueprint for https://example.com. Build the complete business plan, pricing recommendation, financial model, and 90-day roadmap.
```

Or describe an idea:

```text
Use $startupblueprint in pre-revenue mode. The product is an AI research assistant for solo founders. Decide who should pay, what plans to offer, whether lifetime pricing is safe, and what to validate in the next 90 days.
```

## Output

```text
outputs/startupblueprint-report.html
outputs/startupblueprint-financial-model.xlsx
outputs/startupblueprint-90-day-roadmap.csv
```

The HTML report opens in a browser and contains the strategy, pricing, evidence, scenarios, risks, and roadmap. The Excel workbook contains editable inputs, pricing, three scenarios, a formula-driven 12-month forecast, unit economics, sources, and model checks. The CSV is the operating roadmap.

## Evidence rules

The skill does not invent demand, market size, customer counts, revenue, competitor prices, CAC, churn, conversion, or profitability. Every important number must be user-supplied, publicly sourced, visibly assumed, or marked unknown.

The readiness score measures the current plan and evidence, not the probability that the startup will succeed.

## Safety

The skill does not change live pricing, billing, checkout, subscriptions, ads, or campaigns automatically.

## Manual installation

```bash
git clone https://github.com/Avi112005/startupblueprint.git
mkdir -p ~/.codex/skills
cp -R startupblueprint/startupblueprint ~/.codex/skills/startupblueprint
```

Restart Codex after installation.
