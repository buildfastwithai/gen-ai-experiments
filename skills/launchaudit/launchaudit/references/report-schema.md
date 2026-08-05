# Report Schema

Create one JSON source and generate the standalone report with `scripts/generate_report.mjs`.

## Command

```bash
node scripts/generate_report.mjs outputs/acme-launchaudit.json outputs/acme-launchaudit.html
```

The generator has no external dependencies and requires Node.js 18 or newer.

## Root object

```json
{
  "meta": {},
  "startup": {},
  "verdict": {},
  "dimensions": [],
  "journey": [],
  "blockers": [],
  "improvements": [],
  "rewrites": [],
  "plan": [],
  "validation": {},
  "sources": []
}
```

## Fields

### `meta`

Required:

- `title`
- `tested_url`
- `mode`: `quick`, `standard`, `deep`, `technical`, or `before-after`
- `language`
- `generated_at`: ISO date

Optional:

- `repository`
- `compared_url`

### `startup`

- `name`
- `appears_to_be`
- `audience`
- `problem`
- `promise`
- `mechanism`
- `primary_action`
- `alternative`
- `evidence_notes`: array of evidence-labeled statements

### `verdict`

- `label`: `Ready to launch`, `Launch after critical fixes`, or `Not ready yet`
- `score`: integer from 0 to 100
- `coverage`: integer from 0 to 100
- `summary`
- `strongest_asset`
- `biggest_risk`
- `retest_condition`

The generator independently recalculates score and coverage from `dimensions` and fails when supplied values disagree.

### `dimensions`

Create all eight objects in the framework order:

```json
{
  "key": "positioning",
  "name": "Positioning clarity",
  "weight": 15,
  "score": 4,
  "status": "Strong",
  "finding": "The product and audience are visible above the fold.",
  "evidence": "Hero headline and supporting sentence.",
  "recommendation": "Name the triggering situation more specifically."
}
```

Allowed keys and weights:

- `positioning`: 15
- `audience`: 10
- `conversion`: 15
- `proof`: 15
- `trust`: 10
- `experience`: 10
- `technical`: 15
- `operations`: 10

`score` must be an integer from 0 to 5 or `null`.

### `journey`

Create six objects:

```json
{
  "stage": "Arrival",
  "state": "pass",
  "observation": "The hero names the product and outcome.",
  "consequence": "Relevant visitors can orient quickly.",
  "fix": "Preserve the current hierarchy."
}
```

Allowed states: `pass`, `friction`, `blocker`, `unknown`.

### `blockers`

Use an empty array when no critical blocker exists. Otherwise:

```json
{
  "title": "Primary CTA leads to a missing page",
  "evidence": "The Start free link returns a 404.",
  "consequence": "No visitor can begin the advertised trial.",
  "fix": "Restore the route or replace the CTA destination before launch.",
  "retest": "Open the CTA from desktop and mobile and reach the signup screen."
}
```

### `improvements`

```json
{
  "rank": 1,
  "severity": "High",
  "title": "Show the actual product in the first screen",
  "evidence": "The first interface image appears after three marketing sections.",
  "consequence": "Visitors must trust an abstract promise.",
  "change": "Move a labeled product view below the primary CTA.",
  "effort": "Small",
  "confidence": "High",
  "validation": "Run a five-second comprehension test."
}
```

### `rewrites`

Use for exact copy or component corrections:

```json
{
  "location": "Hero headline",
  "before": "Build faster with AI",
  "after": "Review every coding agent from one local workspace",
  "reason": "Names the mechanism and differentiates the product."
}
```

### `plan`

Create day or phase objects:

```json
{
  "when": "Day 1",
  "focus": "Clarify and unblock",
  "actions": ["Replace the hero copy", "Repair the primary CTA"],
  "done_when": "A new visitor can explain the product and reach the next step."
}
```

### `validation`

- `strengths`: array
- `unknowns`: array
- `retest`: array
- `experiment`: object with `hypothesis`, `change`, `measure`, and `success_signal`
- `limitations`: array
- `legal_note`: string

### `sources`

Use only consulted sources:

```json
{
  "label": "Acme homepage",
  "url": "https://example.com/",
  "note": "Hero, product proof, and primary CTA inspected on 2026-07-27."
}
```

## Output rules

- Keep the full reasoning in JSON.
- Use plain text values; the generator escapes untrusted content.
- Do not include screenshots as remote tracking URLs. Use local or stable user-supplied assets only when necessary.
- Keep evidence specific enough that the founder can reproduce the finding.
- Preserve unknowns instead of filling gaps with assumptions.
