# UI Quality Rubric

Use this rubric to audit an existing interface and choose the smallest set of changes that produces a meaningful improvement. Score only when comparison helps; the observations matter more than the number.

## Priority test

For each problem, ask:

1. Does it prevent the user from understanding what matters?
2. Does it slow or confuse the primary task?
3. Does it recur across the interface?
4. Does it break at common widths or interaction states?
5. Does it make the product feel untrustworthy or unfinished?

Prioritize issues with multiple yes answers.

## 1. Product clarity

Check whether a new user can understand the page's purpose, current state, and next action within a few seconds.

- Make the primary action visually and verbally specific.
- Keep secondary actions available without letting them compete.
- Use headings that describe content rather than generic labels.
- Expose system status, selected state, progress, and consequences.
- Remove sections that repeat the same claim without adding evidence.

Strong result: the composition explains the product before decoration does.

## 2. Information hierarchy

Check reading order, grouping, contrast, and visual weight.

- Give each region a clear role.
- Group related information through proximity before adding containers.
- Limit the number of simultaneous emphasis levels.
- Keep headings, labels, values, and metadata visually distinct.
- Align controls with the content they affect.

Strong result: users can scan the page and predict where to look next.

## 3. Layout and density

Check whether the layout supports the task rather than mirroring a generic template.

- Set a content width appropriate to the material: narrower for reading, wider for dense tools.
- Use a consistent grid and intentional alignment lines.
- Balance whitespace with information value.
- Avoid nested containers when spacing alone can express grouping.
- Let mobile layouts recompose instead of merely shrinking.

Strong result: the page feels composed at both sparse and dense moments.

## 4. Typography

Check roles, legibility, rhythm, and tone.

- Use a compact, intentional type scale.
- Set comfortable line lengths and line heights for reading.
- Use weight and size before color to establish hierarchy.
- Avoid very light weights and low-contrast text for essential content.
- Use specialized display type sparingly; keep interface text highly readable.
- Apply numeric alignment or tabular figures when data comparison benefits.

Strong result: the interface would still have hierarchy if color and effects disappeared.

## 5. Color and surfaces

Check semantic purpose and contrast.

- Build from a controlled neutral range and a purposeful accent.
- Reserve saturated color for actions, status, selection, or brand moments.
- Distinguish adjacent surfaces only as much as necessary.
- Keep borders and shadows consistent in role and strength.
- Verify text, controls, and focus indicators against their real backgrounds.

Strong result: color guides attention without becoming the product's only personality.

## 6. Components and states

Check consistency without forcing every element into the same shape.

- Normalize repeated buttons, fields, navigation items, tables, and cards.
- Distinguish hierarchy through variants, not arbitrary styling.
- Include hover, focus-visible, active, selected, disabled, loading, empty, error, and success states where relevant.
- Keep icon size, stroke weight, alignment, and label spacing consistent.
- Make destructive actions visually and procedurally distinct.

Strong result: components feel related, and every interactive element communicates its state.

## 7. Responsiveness

Check actual content at widths around each transition.

- Prevent horizontal overflow and accidental clipping.
- Preserve action priority when controls wrap or collapse.
- Reorder content only when the reading sequence remains logical.
- Use scroll regions intentionally for tables, timelines, and dense tools.
- Maintain usable target sizes and spacing on touch devices.

Strong result: each viewport feels designed, not tolerated.

## 8. Accessibility and trust

Check practical usability before claiming compliance.

- Use semantic landmarks, headings, labels, and button/link elements.
- Preserve a visible keyboard focus state.
- Avoid conveying state through color alone.
- Provide meaningful alternative text where imagery carries information.
- Respect reduced-motion preferences.
- Keep error messages specific and associated with the affected control.
- Avoid misleading urgency, hidden consequences, or ambiguous actions.

Strong result: the interface remains understandable with keyboard navigation, zoom, and non-ideal conditions.

## 9. Motion and feedback

Check whether motion explains change.

- Animate state transitions, spatial relationships, and direct manipulation.
- Keep routine interface transitions brief and interruptible.
- Prefer transform and opacity when appropriate.
- Avoid staggered entrance animations for frequently visited utility screens.
- Provide immediate feedback for user actions.

Strong result: motion makes the interface easier to follow and is otherwise quiet.

## 10. Craft and distinctiveness

Check whether details support a coherent product character.

- Repeat one or two signature ideas with restraint.
- Use optical alignment where mathematical alignment looks wrong.
- Refine copy, truncation, empty states, and awkward data combinations.
- Remove effects that do not reinforce the visual thesis.
- Maintain consistency across nearby screens, not only the hero view.

Strong result: the interface feels deliberate without feeling decorated for its own sake.
