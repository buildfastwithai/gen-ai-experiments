---
name: tailwind-component-factory
description: Generate accessible, responsive, headless-friendly UI components using Tailwind CSS and semantic HTML. Use this whenever users request reusable components, ARIA-compliant interactions, or framework-agnostic UI primitives.
---

# Tailwind Component Factory

Generate accessible, responsive, and headless-friendly Tailwind components.

## Use When
- A user asks for reusable Tailwind UI components.
- Accessibility and keyboard interactions are required.
- A user wants unopinionated, composable component primitives.

## Inputs To Collect
- Component purpose and API surface.
- State model and interaction expectations.
- Styling constraints and breakpoints.
- Framework context (React/Vue/plain HTML).

## Workflow
1. Define component API and state model.
2. Write semantic markup before styling.
3. Add ARIA and keyboard interaction support.
4. Apply mobile-first Tailwind classes.
5. Add examples and extension notes.

## Output Template
Use this exact template:

# Component Spec
- Name:
- Purpose:
- Props:
- States:

# Implementation
- Markup
- Tailwind classes
- Behavior notes

# Usage Example
- Integration snippet

## Quality Bar
- Must be keyboard navigable.
- Focus states must be visible.
- Avoid coupling to app-specific state unless requested.


## Advanced Guidelines & Deep Dive
### Architectural Resilience
- **Class Merging (clsx/tailwind-merge)**: Explicitly guide users to use `twMerge` or `clsx` to prevent Tailwind class conflicts when passing `className` props to components (e.g., `twMerge("p-4", props.className)`).
- **Dark Mode Strategy**: Consistently apply the `dark:` variant for backgrounds, text, and borders (e.g., `bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`).
- **Semantic HTML**: Refuse to use `<div>` for everything. Use `<button>` for actions, `<a>` for links, `<article>` for cards, `<nav>` for menus.

### Accessible Interactions (a11y)
- **Focus Rings**: Never remove outline without providing a fallback. Recommend `focus-visible:ring-2 focus-visible:ring-offset-2` to support keyboard navigation safely.
- **SR-Only text**: Utilize `sr-only` for visual icons that lack text labels (e.g., a close `X` button).

### Anti-Patterns to Avoid
- **Hardcoded Magical Numbers**: Avoid arbitrary values like `w-[311px]`. Stick to the design system scale `w-72` to ensure consistent spacing.
- **Unresponsive Defaults**: Designing only for desktop. Build mobile-first (`flex-col md:flex-row`).
