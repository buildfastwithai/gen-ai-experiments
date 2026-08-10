# Analysis Schema

Create `startupblueprint-analysis.json` with the following top-level fields.

## Required shape

```json
{
  "schema_version": 1,
  "generated_at": "YYYY-MM-DD",
  "mode": "standard",
  "product": {},
  "facts": [],
  "sources": [],
  "competitors": [],
  "strategy": {},
  "business_model": {},
  "monetization_candidates": [],
  "pricing": {},
  "financial_inputs": {},
  "scenarios": [],
  "risks": [],
  "roadmap": [],
  "limitations": []
}
```

## Strategy

Require `problem_evidence`, `icp`, `market`, `positioning`, `go_to_market`,
`milestones`, and `readiness_scores`.

`problem_evidence` is a non-empty list of concise evidence-backed or explicitly
labeled inferred observations.

`icp` requires `primary_segment`, `user`, `buyer`, `company_profile`,
`buying_trigger`, plus non-empty arrays for `qualification_signals`, `anti_icp`,
and `where_to_find`.

`market` requires `definition`, `trends`, `risks`, and these four evidence-tagged
numeric inputs:

- `eligible_accounts`
- `serviceable_accounts`
- `realistic_accounts_24m`
- `annual_revenue_per_account`

Use the same `{value, status, confidence, basis, source_url}` structure as a
financial input. Values may be `null` with `status: unknown`. The preparation
script computes TAM, SAM, and a 24-month SOM only when the required inputs exist.
Never substitute social followers, page views, or a broad industry total for an
eligible-account count without labeling the proxy and its limitation.

`positioning` requires `category`, `alternatives`, `differentiators`,
`statement`, and `claim_to_test`. Arrays must be non-empty.

`go_to_market` requires `primary_channel`, `secondary_channel`, `motion`,
`message`, `initial_offer`, plus non-empty arrays for `funnel_assumptions` and
`stop_conditions`.

Each milestone requires `period`, `outcome`, `metric`, and `decision_gate`.

Use exactly these readiness dimensions and weights:

| Dimension | Weight |
|---|---:|
| `problem_evidence` | 15 |
| `icp_specificity` | 10 |
| `reachable_market` | 10 |
| `positioning` | 15 |
| `business_model_pricing` | 15 |
| `go_to_market` | 15 |
| `unit_economics` | 10 |
| `execution_readiness` | 10 |

Each score uses:

```json
{
  "dimension": "problem_evidence",
  "raw_score": 3,
  "evidence_strength": "partial",
  "rationale": "The problem is visible publicly but no paid demand is supplied.",
  "evidence_urls": ["https://example.com/source"]
}
```

Use an integer raw score from `0` to `5` and evidence strength `strong`,
`partial`, `assumption-heavy`, or `unsupported`. The preparation script applies
the weights, evidence multipliers, and evidence caps; do not calculate or
manually override the final readiness score.

## Product

Require:

`name`, `url`, `summary`, `stage`, `geography`, `currency`, `primary_user`, `economic_buyer`, `problem`, `core_outcome`, `delivery_type`, `value_frequency`, `current_business_model`, `current_pricing`.

Allow `url` to be an empty string only for a concept without a live page.

## Facts and sources

Each fact:

```json
{
  "claim": "The product currently has a free plan",
  "source_url": "https://example.com/pricing",
  "checked_at": "YYYY-MM-DD"
}
```

Each source:

```json
{
  "title": "Official pricing page",
  "url": "https://example.com/pricing",
  "kind": "product",
  "checked_at": "YYYY-MM-DD",
  "note": "Shows the current free and paid offer."
}
```

Use source kinds `product`, `market`, `cost`, `demand`, `channel`, or `other`.

## Business model

Require text arrays for:

`customer_segments`, `value_propositions`, `channels`, `customer_relationships`, `revenue_streams`, `key_activities`, `key_resources`, `key_partners`, `cost_structure`, `advantages`.

Also require `recommended_model`, `why_now`, `distribution_wedge`, and `north_star_metric`.

## Monetization candidates

Include at least four candidates:

```json
{
  "name": "Freemium plus subscription",
  "model_type": "freemium",
  "rationale": "...",
  "strengths": ["..."],
  "risks": ["..."],
  "evidence_urls": ["https://..."],
  "verdict": "PRIMARY"
}
```

Use verdict `PRIMARY`, `ALTERNATIVE`, `TEST`, or `REJECT`. Exactly one candidate must be `PRIMARY`.

## Pricing

Require:

`recommended_model`, `alternative_model`, `currency`, `value_metric`, `free_plan_decision`, `free_plan_rationale`, `trial`, `annual_discount_percent`, `lifetime_verdict`, `lifetime_rationale`, `pricing_confidence`, `pricing_evidence`, and `tiers`.

Use lifetime verdict `VIABLE`, `LIMITED_TEST`, `NOT_RECOMMENDED`, or `INSUFFICIENT_EVIDENCE`.

Each tier:

```json
{
  "name": "Pro",
  "tier_type": "paid",
  "target_segment": "Solo founders",
  "monthly_price": 19,
  "annual_monthly_equivalent": 15.2,
  "expected_paid_mix": 0.75,
  "included": ["Core workflow"],
  "limits": "Five active projects",
  "upgrade_trigger": "More projects or collaboration"
}
```

Use `tier_type` `free`, `paid`, `usage`, or `contact`. Free tiers must have price and paid mix `0`. Paid-tier mix must total `1.0` within 0.01. Price values are hypotheses unless transaction evidence is supplied.

## Financial inputs

Require these keys:

- `opening_free_users`
- `opening_paid_customers`
- `monthly_new_free_users`
- `free_to_paid_conversion_rate`
- `monthly_new_paid_customers_direct`
- `monthly_paid_churn_rate`
- `monthly_arpu_override`
- `variable_cost_per_paid_customer`
- `variable_cost_per_free_user`
- `fixed_monthly_costs`
- `monthly_acquisition_spend`
- `one_time_revenue_per_new_paid`
- `starting_cash`

Each value uses:

```json
{
  "value": 0.05,
  "status": "assumption",
  "confidence": "low",
  "basis": "Conservative placeholder until cohort data exists.",
  "source_url": ""
}
```

Use status `user`, `public`, `assumption`, or `unknown`; confidence `low`, `medium`, or `high`. Use numeric values, percentage decimals from `0` to `1`, or `null` for unknown. Use `0` intentionally only when zero is the real supplied or assumed value.

`monthly_arpu_override` equal to `0` means the workbook uses weighted tier ARPU. A positive value overrides tier mix.

## Scenarios

Require exactly `conservative`, `base`, and `optimistic`, each with:

```json
{
  "name": "base",
  "new_free_users_multiplier": 1.0,
  "conversion_multiplier": 1.0,
  "new_paid_multiplier": 1.0,
  "churn_multiplier": 1.0,
  "arpu_multiplier": 1.0,
  "variable_cost_multiplier": 1.0,
  "fixed_cost_multiplier": 1.0,
  "acquisition_spend_multiplier": 1.0
}
```

The base scenario must use `1.0` for all multipliers.

## Risks

Each risk requires `risk`, `likelihood`, `impact`, `mitigation`, and `validation`. Use likelihood and impact `low`, `medium`, or `high`.

## Roadmap

Include at least nine tasks spanning all three phases: days 1–30, 31–60, and 61–90.

Each task requires:

`start_day`, `end_day`, `phase`, `objective`, `hypothesis`, `action`, `deliverable`, `metric`, `decision_rule`, `owner`.

Keep all day values between 1 and 90 and ensure `start_day <= end_day`.

## Limitations

List missing private metrics, uncertainties, excluded costs, taxes, payment fees, regional differences, or evidence gaps. Do not leave the list empty.
