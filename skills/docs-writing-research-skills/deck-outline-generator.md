---
name: deck-outline-generator
description: Generate high-impact slide outlines and image prompts for Streamlit plus fal-client workflows. Use this whenever a user asks for pitch decks, presentation structure, slide storytelling, or prompts for AI-generated visuals.
---

# Deck Outline Generator

Generate persuasive slide outlines and per-slide image prompts tailored for Streamlit + fal-client workflows.

## Use When
- A user asks for pitch, product, strategy, or investor decks.
- A user needs slide-level image prompts for generation.
- A user wants narrative flow plus speaker guidance.

## Inputs To Collect
- Audience type, deck objective, and duration.
- Desired tone: formal, bold, technical, or storytelling.
- Available proof points: metrics, case studies, quotes.
- Brand or visual constraints.

## Workflow
1. Choose a narrative arc that fits the objective.
2. Define one core message per slide.
3. Attach proof and supporting data to each slide.
4. Draft visual direction and AI image prompt.
5. Add short speaker notes and transitions.

## Output Template
Use this exact template:

# Deck Outline: [Title]
## Audience and Goal
- Audience:
- Goal:
- Duration:

## Slide Plan
### Slide [N]: [Title]
- Objective:
- Key points (max 4):
- Proof or metric:
- Visual direction:
- Image prompt (fal-client ready):
- Speaker note:

## Production Notes
- Streamlit section mapping:
- Suggested generation settings:
- Narrative risks and mitigations:

## Quality Bar
- Avoid generic filler slides.
- Every slide must have a clear job.
- Visual prompts must match slide intent.


## Advanced Guidelines & Deep Dive
### Narrative Pacing
- **The 3-Minute Rule**: Assume the audience has 3 minutes of attention. The first 3 slides MUST deliver the core value proposition.
- **Cognitive Load Limit**: Restrict text to 20 words per slide. If there is more, move it to speaker notes.
- **Visual-Text Symmetry**: The image prompt and the slide text must reinforce the exact same concept, not compete for attention.

### Image Prompt Engineering (fal-client specific)
- **Style Keywords**: Enforce consistent styles across prompts (e.g., "minimalist vector art, 2D flat design, corporate blue palette, clean white background").
- **Avoid Text in Images**: Explicitly instruct the image generator NOT to include text, typography, or UI mockups that will look garbled.
- **Aspect Ratio**: Always specify the aspect ratio (e.g., `--ar 16:9` or explicitly request wide landscape compositions).

### Anti-Patterns to Avoid
- **"Wall of Text" Slides**: Putting 5+ bullets.
- **Generic Image Prompts**: "A picture of business people shaking hands." Detail the lighting, style, and metaphor instead.
