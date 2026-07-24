---
name: glass-ui-system
description: Build modern glassmorphism interfaces with layered translucency, frosted surfaces, depth hierarchy, and subtle lighting. Use this when users want premium, atmospheric UI that feels soft but precise.
---

# Glass UI System

Design and implement frosted, depth-rich interfaces that feel refined, calm, and spatially coherent.

## Use When
- A user requests glassmorphism or frosted panel aesthetics.
- The product needs a premium, futuristic-but-clean look.
- Visual depth and layering matter more than flat minimalism.

## Inputs To Collect
- Brand tone (luxury, fintech, wellness, productivity).
- Background context (image, gradient field, abstract scene).
- Density preference (airy vs compact).
- Accessibility requirements for contrast and legibility.

## Workflow
1. Define depth tiers (background, mid surfaces, foreground cards).
2. Establish translucency tokens and blur intensity scales.
3. Build layout with layered containers and consistent edge highlights.
4. Apply restrained motion for parallax, reveal, and focus shifts.
5. Validate readability under multiple background states.

## Output Template
Use this exact template:

# Style Spec
## Direction
- Theme:
- Surface Strategy:
- Light Behavior:

## Design Tokens
- Background palette:
- Glass surface tokens:
- Border/highlight tokens:
- Blur/opacity scales:

## Implementation
- Section architecture
- CSS/Tailwind recipe
- Motion/accessibility notes

## Signature Moves
- Distinctive glass details that sell depth without clutter.

## Quality Bar
- Maintain clear text contrast on translucent layers.
- Use consistent blur hierarchy across components.
- Avoid visual mud by limiting overlapping glass panes.
- Preserve keyboard and focus visibility.

## Advanced Guidelines & Deep Dive
### Surface Engineering
- **Layer Discipline**: Define 3-4 depth layers max and keep them consistent.
- **Edge Lighting**: Use subtle inner/outer highlights to imply thickness.
- **Chromatic Restraint**: Favor neutral glass with one accent hue to avoid candy-like overload.

### Motion Language
- **Soft Spatial Drift**: Apply low-amplitude movement tied to cursor or scroll for depth.
- **Focus Elevation**: Active elements should gain slight opacity and brightness to pop from stack.

### Anti-Patterns to Avoid
- **Blur Everything**: Excessive blur harms readability and performance.
- **Low Contrast Text**: Frosted backgrounds can wash out copy if tokens are not tuned.
- **Unbounded Glow**: Heavy glows make UI look noisy and cheap.
