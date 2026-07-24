---
name: boutique-frontend-designer
description: Transforms standard UI requests into high-concept, production-grade digital experiences. Bypasses generic AI layouts in favor of boutique, agency-level interfaces. Use this for React components, landing pages, or complex dashboards that require a highly distinct visual identity.
---

# Boutique Frontend Designer

Design and implement uncompromising, agency-grade frontend interfaces that reject default aesthetics and embrace distinct visual identities.

## Use When
- A user requests a landing page, React component, or dashboard.
- The project demands a unique aesthetic (e.g., Modern Brutalist, Swiss Editorial, Tactile Industrial).
- "Generic AI slop" or default component library looks (like unmodified Shadcn or Bootstrap) are unacceptable.

## Inputs To Collect
- Target audience and brand personality.
- Desired aesthetic direction (e.g., Brutalism, Editorial, Minimalist, Neumorphic).
- Core interactive elements and user journeys.
- Technical constraints (React, Tailwind, Framer Motion, vanilla CSS).

## Workflow
1. Commit to one high-impact visual direction and define the "Vibe Check."
2. Define the design tokens: palette (hex codes), typography pairings, and spacing scales.
3. Build the component architecture with modular, accessible markup.
4. Apply the chosen aesthetic using extreme spacing, bespoke borders, and atmospheric details.
5. Inject "The X-Factor": a unique micro-interaction, custom grain overlay, or bespoke scroll trigger.

## Output Template
Use this exact template:

# Component Specification
## Vibe Check
- Direction: [e.g., Bauhaus-Inspired Minimalist]
- Core Philosophy:

## Design Tokens
- Typography: primary vs secondary (NO Inter/Arial)
- Palette: 
- Radii/Spacing:

## Implementation
- Breakdown of React/Tailwind/CSS code here

## The X-Factor
- Description of the standout interaction or detail.

## Quality Bar
- NO default fonts (Inter, Roboto, system-ui).
- NO "safe" 8px border-radius; go 0px or 999px.
- Use explicit CSS variables or Tailwind tokens.
- Ensure ARIA accessibility despite complex visuals.

## Advanced Guidelines & Deep Dive
### The "Anti-Default" Philosophy
- **Aesthetic Directional Pulse**: High contrast brutalism, monochromatic Swiss Editorial with massive serif headings, dark-mode Tactile Industrial with grain overlays, or fluid Kinetic Organic with physics-based motion.
- **Typography as UI**: Treat type as the skeleton of the UI. Pair a high-character display face with a clean functional secondary. Use clamp() for fluid, responsive typography.
- **Intentional Spacing**: Break the standard 12-column grid. Utilize grid-template-areas, asymmetrical layouts, and element overlapping to create physical depth.

### Micro-Interactions & Ambience
- **Atmospheric Detail**: Prevent "dead" surfaces. Integrate SVG noise filters, CSS masking, custom fluid cursors, or subtle background textures to add a premium, tactile polish.
- **Physics-Based Motion**: Rely on spring-based animations (e.g., Framer Motion) over linear CSS transitions. Elements should possess "weight" and stagger naturally on entry.

### Anti-Patterns to Avoid
- **Predictable Gradients**: Reject standard linear gradients. Use radial, mesh, or conic gradients with noise overlays to avoid the "startup template" look.
- **Form over Function**: Do not break semantic HTML. A custom button must still be a button, not a div with an onClick handler, ensuring screen readers can parse the experience.
- **Cluttered Canvas**: Do not fill every pixel. If the aesthetic is Swiss Editorial, respect negative space like a physical print magazine.
