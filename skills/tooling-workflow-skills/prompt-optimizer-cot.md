---
name: prompt-optimizer-cot
description: Rewrite vague or raw tasks into robust Chain-of-Thought style prompts that improve reasoning quality and reliability. Use this whenever prompts are ambiguous, under-specified, or produce weak outputs.
---

# Prompt Optimizer CoT

Rewrite raw tasks into high-clarity prompts with robust reasoning scaffolds and verification steps.

## Use When
- A prompt is vague, underspecified, or ambiguous.
- A user asks for better reasoning quality.
- A user wants fewer mistakes on complex tasks.

## Inputs To Collect
- Core goal and desired output format.
- Hard constraints and unacceptable outcomes.
- Available context and known assumptions.
- Time/quality preference: fast vs rigorous.

## Workflow
1. Preserve original intent and success target.
2. Add missing constraints and context placeholders.
3. Add staged reasoning and validation instructions.
4. Add explicit output contract.
5. Provide one concise variant for speed.

## Output Template
Use this exact template:

## Original Task
[raw task]

## Optimized Prompt
[rewritten prompt]

## Why It Improves Reliability
- Clarity:
- Constraint coverage:
- Verification strength:

## Optional Variants
- Fast mode prompt:
- High-rigor mode prompt:

## Quality Bar
- Do not change core user intent.
- Require explicit output structure.
- Include edge-case and self-check guidance.


## Advanced Guidelines & Deep Dive
### Chain-of-Thought (CoT) Architecture
- **Think Before You Speak**: Instruct the model to open a `<thinking>` block to reason about the constraints, context gaps, and edge cases before outputting final answers.
- **Step-by-Step Breakdown**: Break monolithic tasks into 3-5 explicit sequential steps (e.g., "Step 1: Extract concepts. Step 2: Validate against constraints. Step 3: Format.").
- **Constraint Enforcement**: Add a final "Verification Step" where the model must explicitly state if it met each constraint.

### Anti-Patterns to Avoid
- **Over-Constraining**: Adding so many format rules the model loses the ability to reason creatively.
- **Ambiguous Definitions**: Using words like "high quality" or "professional." Define them (e.g., "Use academic tone, avoiding first-person pronouns").
- **Hidden Assumptions**: Failing to explicitly tell the model what knowledge cutoff or persona it should adopt.

### Example Prompt Scaffold
```markdown
<context> [Background info] </context>
<rules> [Hard constraints] </rules>
<format> [Output template] </format>
<task> Let's think step by step in a <thinking> tag before providing the final <output>. </task>
```
