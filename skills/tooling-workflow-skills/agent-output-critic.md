---
name: agent-output-critic
description: Critically review another agent's output for hallucinations, security issues, logical flaws, and formatting problems. Use this whenever quality assurance, safety review, or pre-delivery validation is needed.
---

# Agent Output Critic

Perform strict QA review on another agent's output before delivery.

## Use When
- A user asks for a review or second opinion.
- Output may contain factual or security risks.
- Requirements are strict and format-sensitive.

## Inputs To Collect
- Original prompt and non-negotiable requirements.
- Candidate output artifact.
- Any style, compliance, or policy constraints.

## Workflow
1. Extract explicit and implicit requirements.
2. Validate factual claims and logical consistency.
3. Check for security/privacy hazards.
4. Check formatting and output contract adherence.
5. Produce prioritized findings and corrective actions.

## Output Template
Use this exact template:

# Review Verdict: PASS | FAIL

## Critical Findings
- [Issue]

## Moderate Findings
- [Issue]

## Minor Findings
- [Issue]

## Requirement Coverage
- Requirement -> Met/Not met -> Evidence

## Fix Plan
1. [Action]
2. [Action]

## Quality Bar
- Prioritize correctness and safety over style polish.
- Include evidence for every negative finding.


## Advanced Guidelines & Deep Dive
### Multi-Axis Evaluation
- **Factual Integrity (Hallucination Detection)**: Cross-reference quantitative claims, API signatures, and historical events. If an API method is mentioned, verify it exists.
- **Security & Policy**: Flag SQL injection vectors, XSS risks, hardcoded credentials, or insecure defaults (e.g., `0.0.0.0` bindings).
- **Tone & Persona**: Ensure the output does not contain sycophancy ("I apologize, I am just an AI") and matches the requested professional standard.

### Actionable Feedback Loop
- **The "Don't Just Complain" Rule**: Every finding MUST be accompanied by a specific, copy-pasteable resolution.
- **Severity Triage**: Distinguish between a CRITICAL failure (code won't compile, breaks security) and a MINOR failure (inconsistent markdown spacing).

### Anti-Patterns to Avoid
- **Nitpicking**: Failing a 1000-line code block because of one missing comment, unless the prompt strictly demanded it.
- **Vague Critiques**: "The tone is off." -> Instead use, "The tone uses too much jargon; replace 'synergistic paradigm' with 'collaboration'."
