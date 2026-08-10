# Research Playbook

## Purpose

Collect enough current evidence to choose a defensible business model without pretending that public information proves demand or economics.

## Evidence order

1. User-supplied operating numbers and transaction evidence
2. Official product, pricing, documentation, terms, and help pages
3. Official company announcements or public repositories
4. Direct customer pain, switching, purchase, or workaround signals
5. High-quality secondary analysis when primary evidence is unavailable

Record a URL and checked date for every public source. Use direct pages instead of search-result snippets.

## Product pass

Capture:

- the product and its promised outcome
- stage and current offer
- primary user and economic buyer
- delivery type and value frequency
- current free, trial, paid, one-time, or lifetime structure
- obvious usage, hosting, support, data, inference, storage, payment, or service costs

Do not infer private metrics from traffic, reviews, GitHub stars, downloads, followers, or social engagement.

## Market pass

Choose comparable products based on a similar buyer, problem, delivery model, or substitute behavior. For each comparable capture:

- official pricing URL
- target segment
- pricing model and value metric
- visible tiers and monthly-equivalent prices
- free plan or trial
- usage, seat, commitment, or annual-billing conditions
- checked date

Normalize only comparable units. Keep regional price, tax, annual prepayment, contact-sales, and missing data explicit.

Also define the initial market bottom-up:

- eligible accounts × annual revenue per account = TAM
- serviceable accounts × annual revenue per account = SAM
- realistically acquired accounts within 24 months × annual revenue per account = 24-month SOM

Keep every input sourced, user-supplied, assumed, or unknown. Do not use a broad
industry forecast as if every dollar were addressable by this product.

## Customer, positioning, and channel pass

- Name one narrow initial customer segment, the user, the economic buyer, the
  buying trigger, qualification signals, anti-ICP, and where those buyers already
  gather.
- Compare direct competitors, indirect substitutes, and the option to do nothing.
- Write one positioning statement and one claim that can be tested with buyer
  behavior.
- Choose a first channel because the buyer is demonstrably reachable there, not
  because the channel is fashionable.
- Record funnel assumptions as assumptions and include stop conditions that can
  force a channel or offer change.

## Monetization comparison

Evaluate at least four candidates against:

- value alignment
- buyer and procurement fit
- cost coverage
- revenue quality
- simplicity and predictability
- market evidence
- reversibility of the first test

Always decide explicitly on:

- free plan versus trial
- monthly versus annual
- per-seat, usage, credits, flat access, or hybrid value metric
- one-time or lifetime viability
- limits and upgrade triggers

## Financial evidence classes

Use these exact statuses:

- `user` — supplied directly by the user or their authorized data
- `public` — supported by a direct public source
- `assumption` — visible working hypothesis used to make the model testable
- `unknown` — missing and not safely estimated

Use confidence `low`, `medium`, or `high`. A plausible assumption is still an assumption.

Critical operating inputs are monthly paid churn, variable cost per paid customer, fixed monthly costs, acquisition spend, and at least one new-paid-customer path. Missing critical inputs force `INSUFFICIENT_DATA`; assumptions make the model `PROVISIONAL`.

## Business-plan synthesis

The final recommendation must connect:

`customer pain → buyer → value proposition → acquisition channel → offer → price → unit economics → 90-day validation`

If one link is weak, record it as a risk or experiment. Do not write generic startup advice disconnected from the product.

## Readiness score

Score problem evidence, ICP specificity, reachable market, positioning,
business model and pricing, go-to-market, unit economics, and execution
readiness from 0 to 5. Pair every raw score with `strong`, `partial`,
`assumption-heavy`, or `unsupported` evidence. Let `prepare_plan.py` apply the
weights and evidence caps. Treat the result as plan readiness, never as a
probability of startup success.

## Contradiction checks

Before finalizing, ask:

- Does the recommended pricing unit track customer value and cost?
- Does the free plan expose the company to uncapped costs?
- Does the forecast assume acquisition without a named channel or experiment?
- Does a high-growth scenario change only outputs rather than drivers?
- Does lifetime pricing promise perpetual service against recurring costs?
- Does the plan call a price proven without actual purchase evidence?
- Do roadmap decision rules specify what evidence changes the plan?
