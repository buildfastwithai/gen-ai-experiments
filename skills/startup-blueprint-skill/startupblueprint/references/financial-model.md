# Financial Model Guide

## Workbook structure

Create these sheets in order:

1. `Dashboard` — plan status, verdict, headline KPIs, warnings, and charts
2. `Inputs` — editable operating assumptions and their provenance
3. `Pricing` — tiers, monthly-equivalent prices, paid mix, and weighted ARPU
4. `Scenarios` — conservative, base, and optimistic driver multipliers
5. `12-Month Forecast` — formula-driven monthly customer, revenue, cost, profit, and cash model
6. `Unit Economics` — contribution, gross margin, CAC, payback, simplified LTV, and break-even
7. `Sources & Assumptions` — public sources, assumptions, limitations, and definitions
8. `Checks` — input completeness, mix, scenario, roll-forward, and formula checks

## Model mechanics

For each month and scenario:

- `free conversions = opening free users × conversion rate`
- `ending free users = max(0, opening free + new free − conversions)`
- `paid churn = opening paid customers × churn rate`
- `ending paid customers = max(0, opening paid + conversions + direct new paid − churn)`
- `average paid customers = (opening paid + ending paid) / 2`
- `subscription revenue = average paid customers × effective ARPU`
- `one-time revenue = (conversions + direct new paid) × setup revenue per new paid customer`
- `paid variable cost = average paid customers × variable cost per paid customer`
- `free variable cost = average free users × variable cost per free user`
- `operating profit = total revenue − variable costs − fixed costs − acquisition spend`
- `ending cash = opening cash + operating profit`

Use explicit input cells for all base values and scenario multipliers. Never paste calculated scenario outputs.

## Unit economics

- `monthly contribution per paid customer = ARPU − variable paid cost`
- `gross/contribution margin = contribution / ARPU`
- `blended CAC = monthly acquisition spend / new paid customers`, when new paid is positive
- `CAC payback = CAC / monthly contribution`, when contribution is positive
- `simplified LTV = monthly contribution / monthly churn`, only when churn is positive
- `break-even paid customers = fixed costs / monthly contribution`, when contribution is positive

Label LTV as simplified. It is not a valuation and excludes discounting, expansion, taxes, and cohort variation.

## Status logic

- `EVIDENCE_BACKED` — all critical inputs are user-supplied or public evidence
- `PROVISIONAL` — all critical inputs have values, but at least one is an assumption
- `INSUFFICIENT_DATA` — at least one critical input is unknown or null

Do not present unit-economic outputs as actionable when status is `INSUFFICIENT_DATA`.

## Verdict logic

- `UNSUSTAINABLE` — paid contribution is zero or negative
- `FRAGILE` — contribution is positive, but base economics show weak margin, long payback, or loss through month 12
- `HEALTHY` — contribution is positive and base-case month 12 plus full-year results are positive under supplied assumptions
- `INSUFFICIENT_DATA` — critical inputs are missing

The verdict evaluates the supplied or labeled assumptions, not guaranteed business performance.

## Formatting

- Blue font: editable hardcoded inputs
- Black font: formulas on the same sheet
- Green font: formulas linking to other sheets
- Yellow fill: assumptions or unknowns requiring attention
- Dark navy section headers with white text
- Green for passing status, amber for provisional, red for failure or unsustainable status
- Explicit number formats for currency, percentages, and counts
- No merged cells in calculation areas
- No chart may cover source tables or controls

Add comments to material input cells when a source or basis is available. Show a compact color legend.
