---
name: research-synthesizer
description: Synthesize multiple search results into a structured, cited Markdown report. Use this whenever a user asks for web research, comparison, evidence-backed summaries, literature overviews, or source-grounded recommendations.
---

# Research Synthesizer

Create source-grounded research reports with clear citations and confidence notes.

## Use When
- A user requests a researched brief with references.
- A user wants comparisons across multiple sources.
- A user asks for recommendations backed by evidence.

## Inputs To Collect
- Research topic and target audience.
- Depth level: quick brief, standard, deep dive.
- Geographic or time constraints.
- Citation style preferences (if any).

## Workflow
1. Define scope and success criteria.
2. Gather diverse, relevant, and credible sources.
3. Extract claims, quantitative facts, and dates.
4. Reconcile agreement and disagreement across sources.
5. Draft a concise report with inline citations.
6. Add confidence levels and unresolved questions.

## Output Template
Use this exact template:

# [Topic]
## Executive Summary
- 3 to 6 evidence-backed conclusions.

## Key Findings
### [Theme]
- Finding:
- Why it matters:
- Evidence:
- Source: [Title](URL)

## Conflicting Evidence
- Point of conflict:
- Possible explanation:
- Source: [Title](URL)

## Recommendations
1. [Action]
2. [Action]

## Sources
- [Title](URL) - Publisher, date accessed

## Confidence and Gaps
- Confidence: High | Medium | Low
- Remaining unknowns:

## Quality Bar
- Never present uncited factual claims.
- Prefer primary and authoritative sources.
- Distinguish fact, inference, and opinion.


## Advanced Guidelines & Deep Dive
### Triangulation Strategy
- **Cross-Verification**: Never rely on a single source for a pivotal claim. Require at least two independent domains (e.g., academic, reputable journalistic, or official documentation).
- **Bias Detection**: Identify and explicitly call out potential biases in the sources (e.g., "Vendor X's whitepaper claims Y, but third-party reviewer Z disputes this").
- **Temporal Relevance**: Track publication dates religiously. Distinguish between historical context and current state (e.g., tech specs from 2022 vs 2024).

### Anti-Patterns to Avoid
- **The "Data Dump"**: Simply pasting paragraphs of quotes. Synthesis requires analyzing and connecting the dots.
- **Weasel Words**: Avoid "Some people say" or "It is believed." Use exact citations (e.g., "Gartner (2023) reports 40%...").
- **Hallucinated Citations**: Never invent a URL or paper title. If you cannot find the source, state the limitation.

### Explicit Output Constraints
- All claims MUST have an inline reference tying to the source list.
- Non-factual narrative should be strictly separated from data-backed claims.
