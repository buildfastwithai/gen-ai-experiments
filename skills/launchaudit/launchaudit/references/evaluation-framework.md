# Launch Readiness Evaluation Framework

Use this framework for every audit. It creates a comparable diagnostic; it does not predict revenue, conversion rate, retention, or product-market fit.

## Evidence labels

- **Observed** — directly visible in the page, interaction, screenshot, repository, or supplied artifact.
- **Inferred** — a reasonable interpretation of observed evidence.
- **Unknown** — cannot be established without private access, analytics, interviews, production data, or founder confirmation.

Every critical blocker requires observed evidence. Do not convert an inference into a fact by repeating it.

## Eight dimensions

Score each known dimension from 0 to 5. Use `null` when the available evidence cannot support a score.

| Dimension | Weight | What to evaluate |
|---|---:|---|
| Positioning clarity | 15 | Product, audience, problem, outcome, and mechanism are understandable. |
| Audience relevance | 10 | The page connects the offer to a specific situation, urgency, or job. |
| Conversion path | 15 | The primary CTA is visible, appropriate, functional, and leads to an understandable next step. |
| Product proof | 15 | Screens, demos, examples, documentation, outcomes, or other evidence make the product credible. |
| Trust and risk | 10 | Identity, privacy, security, pricing, support, limitations, and switching effort are handled in proportion to the commitment. |
| Experience quality | 10 | Hierarchy, readability, accessibility signals, navigation, responsive behavior, and interaction feedback support the journey. |
| Technical surface | 15 | Public paths, forms, metadata, errors, loading behavior, install/download destinations, and visible integrations behave reliably. |
| Launch operations | 10 | Users can understand availability, onboarding expectations, pricing or access, support, and what happens after conversion. |

## Score calculation

For every known dimension:

```text
weighted points = score / 5 × weight
```

Then calculate:

```text
evidence coverage = sum(known dimension weights)
readiness score = sum(weighted points) / evidence coverage × 100
```

Round both values to whole numbers.

Do not assign a neutral score to unknown dimensions. Show the coverage value beside the score.

## Score anchors

Use these anchors consistently:

- `5` — Clear, specific, credible, and resilient in the inspected journey.
- `4` — Strong with a minor weakness that does not block action.
- `3` — Understandable but materially incomplete or generic.
- `2` — Major uncertainty or friction likely to stop some qualified visitors.
- `1` — Severe weakness; the intended function is barely present.
- `0` — Missing, broken, contradictory, or actively harmful.
- `null` — Not observable within the authorized audit.

## Critical blockers

A finding is critical only when observed evidence shows that it can prevent the primary audience from understanding, trusting, accessing, or completing the main action.

Typical critical blockers:

- The first screen does not establish what the product is.
- The primary CTA is missing, broken, misleading, or has no viable destination.
- Essential pricing or access conditions contradict each other.
- The core product is represented only by unsupported claims.
- The page is unusable at a common viewport.
- A required public install, download, signup, or documentation path fails.
- A material privacy or security claim contradicts visible product behavior.
- The product appears unavailable without explaining status or next steps.

Do not classify cosmetic preferences, optional integrations, or later-stage features as launch blockers.

## Verdict

Apply the numerical thresholds from `SKILL.md`, then check blockers.

When overriding the numerical verdict, state:

- calculated verdict
- override
- observed reason
- exact retest condition

## Journey evaluation

Trace these six stages:

| Stage | Passing question |
|---|---|
| Arrival | Can a relevant visitor orient within five seconds? |
| Comprehension | Can they explain the product and outcome accurately? |
| Evidence | Can they see how it works or why to believe it? |
| Risk reduction | Are cost, trust, privacy, setup, and switching doubts addressed proportionately? |
| Action | Is the next step clear, functional, and appropriate? |
| Expectation | Does the visitor know what will happen after acting? |

For each stage record:

- state: pass, friction, blocker, or unknown
- observed evidence
- consequence
- recommended correction

## Finding severity

- **Critical** — blocks launch or the primary conversion path.
- **High** — materially harms comprehension, trust, or action for the primary audience.
- **Medium** — creates avoidable doubt or friction but leaves the path usable.
- **Low** — refinement with limited immediate launch impact.

## Prioritization

Rate effort and confidence:

- Effort: small, medium, or large.
- Confidence: high, medium, or low.

Rank by:

1. Severity
2. Number of journey stages affected
3. Confidence
4. Lower effort when impact is otherwise comparable

## Retest requirements

Always include:

- five-second comprehension
- primary CTA destination
- desktop and mobile hierarchy
- keyboard and focus basics where observable
- broken-link and public-path retest
- metadata/social-preview check
- trust and privacy consistency
- exact copy or component changed
- one measurable post-launch experiment

## Limits

State which of these remain unknown when not supplied:

- real conversion and activation data
- authenticated onboarding
- billing and cancellation behavior
- production monitoring and incident response
- security posture and data flows
- legal and regulatory compliance
- customer satisfaction and retention
- unit economics and product-market fit
