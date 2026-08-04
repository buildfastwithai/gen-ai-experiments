---
name: premium-ui-revamp
description: Audit and revamp existing web interfaces into polished, professional, product-specific experiences while preserving behavior and working within the current frontend stack. Use for requests to improve a vibe-coded, generic, template-like, inconsistent, dated, amateur, or visibly AI-generated UI; redesign an existing page, app, dashboard, landing page, or component; establish stronger art direction, hierarchy, typography, spacing, color, responsiveness, accessibility, interaction states, or visual coherence; or perform a premium UI polish pass on HTML, CSS, JavaScript, React, Vue, Svelte, Next.js, and similar frontend codebases.
---

# Premium UI Revamp

Turn an existing interface into a credible, intentional product. Preserve what works, derive the design from the product's context, implement the improvements in the existing stack, and verify the rendered result rather than stopping at recommendations.

## Operating principles

- Treat "premium" as clarity, restraint, coherence, craft, and fit for purpose—not a fixed visual style.
- Derive the direction from the product, audience, content, brand cues, and usage context. Avoid imposing the same dark gradient, glassmorphism, rounded-card aesthetic on every project.
- Preserve functionality, routes, data flow, copy, and existing design-system conventions unless the user requests broader changes.
- Prefer a few high-impact structural decisions over many decorative effects.
- Make the interface feel authored. Establish one clear visual idea and carry it through typography, composition, color, imagery, and interaction.
- Work in the current framework and styling system. Add dependencies only when the benefit is clear and the project does not already solve the need.
- Use real content and realistic states. Do not hide weak structure behind placeholder copy, oversized empty areas, or ornamental graphics.

## Workflow

### 1. Establish the actual surface

Inspect the repository before editing. Identify:

- the app framework, entry point, target route, and component tree;
- global styles, tokens, themes, component libraries, icons, fonts, and brand assets;
- existing responsive behavior and important interaction states;
- build, lint, test, and preview commands;
- nearby screens whose conventions should remain consistent.

Run the interface when possible. Capture or inspect a baseline at representative desktop and mobile sizes. If the user requested analysis only, stop after the audit and recommendations; otherwise continue through implementation and verification.

Do not replace the stack, rewrite unrelated components, invent a new brand, or change product behavior merely to make the redesign easier.

### 2. Write a compact design brief

Before changing styles, state the direction in a few lines:

- **Product and user:** what this interface helps whom accomplish.
- **Desired character:** choose two or three useful attributes such as precise, calm, editorial, technical, warm, understated, or energetic.
- **Visual thesis:** identify the single compositional or aesthetic idea that will make the product recognizable.
- **Hierarchy:** name the primary action, primary information, and supporting content.
- **Constraints:** record existing brand, accessibility, content, and framework requirements.

Infer these from the code and product context when the user has not supplied them. Ask only when a missing choice would materially change the result.

### 3. Audit before decorating

Read [references/quality-rubric.md](references/quality-rubric.md) when evaluating the current interface or prioritizing changes.

Classify findings into three tiers:

1. **Structural:** broken hierarchy, confused information architecture, poor content order, unsuitable density, weak responsive composition.
2. **Systemic:** inconsistent type, spacing, color, radii, shadows, component variants, or states.
3. **Polish:** optical alignment, icon treatment, borders, microcopy, transitions, and small finishing details.

Fix them in that order. Decoration cannot rescue unclear structure.

### 4. Choose an intentional direction

Read [references/premium-patterns.md](references/premium-patterns.md) when the UI feels generic, template-driven, or visibly AI-generated.

Select a direction that fits the product rather than combining every fashionable treatment. Decide explicitly:

- content width and grid behavior;
- information density and vertical rhythm;
- type roles, scale, weight, and line length;
- neutral palette, accent usage, and contrast hierarchy;
- border, radius, elevation, and surface rules;
- image or illustration treatment when assets exist;
- one restrained signature motif, if the product benefits from one;
- motion purpose, duration, and reduced-motion behavior.

Reuse existing brand assets and strong components. Remove decorative choices that lack a product rationale.

### 5. Implement from foundations outward

Apply changes in this sequence:

1. Correct semantic structure and content order.
2. Establish tokens or shared variables for type, spacing, color, radii, elevation, and motion.
3. Repair the page grid, containers, major regions, and responsive breakpoints.
4. Refine typography and controls.
5. Normalize repeated components and interaction states.
6. Add only the imagery, detail, and motion that support the visual thesis.

Prefer fluid sizing, resilient grids, and content-driven breakpoints over fixed mockup coordinates. Use semantic HTML and preserve keyboard behavior. Include hover, focus-visible, active, selected, disabled, loading, empty, error, and success states where the product surface requires them.

Keep abstractions proportional to the codebase. Reuse repeated values and patterns, but do not create a large design-system layer for a one-page polish pass.

### 6. Remove generic UI tells

Actively check for:

- oversized gradient headlines with vague marketing copy;
- glowing blobs, decorative grid backgrounds, and glass panels without product relevance;
- excessive pills, rounded rectangles, nested cards, and shadows on every surface;
- a large centered hero followed by interchangeable feature cards;
- arbitrary purple or blue accents, uniform icon circles, and gradient-filled primary buttons;
- weak typography hidden behind effects;
- excessive whitespace that lowers information value rather than improving focus;
- tiny gray text, low-contrast borders, and placeholder-style metadata;
- motion applied everywhere instead of at meaningful state changes;
- inconsistent spacing or dozens of one-off values.

Do not remove a treatment solely because it appears on this list. Keep it when it expresses the brand or serves the interaction; make it deliberate and consistent.

### 7. Verify the rendered result

Use the best available browser or screenshot workflow. Validate at minimum:

- a representative desktop width;
- a narrow mobile width;
- any breakpoint where the layout changes materially;
- long content, empty content, and error/loading states when available;
- keyboard focus, labels, hit targets, readable contrast, and reduced motion;
- overflow, clipping, unexpected wrapping, and layout shift.

Run the relevant build, typecheck, lint, and targeted tests. Do not claim accessibility compliance unless it was actually measured; report what was checked.

Compare the final render with the baseline. Iterate when hierarchy, density, alignment, contrast, or responsiveness still feels unresolved. A successful revamp should be visibly better at a glance and more coherent under close inspection.

## Completion standard

Deliver a working implementation, not only a mood board or list of CSS suggestions, unless the user requested analysis only. Summarize:

- the design direction and why it fits the product;
- the most important structural and visual changes;
- verification performed and any remaining constraints.

Avoid presenting every minor CSS adjustment. Lead with the product-level improvement.
