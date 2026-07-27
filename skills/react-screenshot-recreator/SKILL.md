---
name: react-screenshot-recreator
description: Recreate a UI screenshot, mockup, or design image as production-quality React + TypeScript + Tailwind code with near-pixel-perfect visual fidelity. Use this skill whenever the user shares an image of an interface and wants it built, cloned, converted, or "made real" — including phrasings like "build this", "recreate this design", "code this Figma export", "clone this landing page", "turn this mockup into React", "make a component that looks like this", or when they paste a screenshot of a website/dashboard/card/pricing table/navbar with little explanation. Also use it when the user asks for HTML/CSS from an image, or wants an existing component restyled to match a reference image. Trigger even if they never say the words "React" or "Tailwind" — this is the default path for image-to-UI work.
---

# React Component Screenshot Recreator

Turn a screenshot of an interface into React code that a designer would look at, next to the original, and struggle to tell apart.

The failure mode this skill exists to prevent is **the plausible approximation**: code that captures the gist — a card, a heading, a button — while getting every spacing value, weight, radius, and shadow slightly wrong. The result feels like a sketch of the design rather than the design. Slightly wrong everywhere reads as unmistakably wrong.

Two habits prevent it. First, *measure before you write* — read values off the image instead of reaching for defaults. Second, *reason about intent* — real interfaces are built on a spacing scale, a type ramp, and a small palette, so when one value is ambiguous, infer it from the system the rest of the design reveals.

## Workflow

1. **Audit the screenshot** — a written pass over layout, type, color, effects, and state. Details you don't name, you won't build.
2. **Derive the design system** — spacing unit, type ramp, palette, radius scale, shadow scale.
3. **Plan the component tree** — decide what's reusable before writing any JSX.
4. **Write the code** — TypeScript, Tailwind, semantic HTML, lucide-react icons.
5. **Verify against the image** — walk the audit list and check each item landed.

Steps 1 and 5 are what separate a recreation from an approximation. Don't skip them, and don't collapse the audit into a single glance — writing the observations down is what makes them actionable.

---

## Step 1 — Audit the screenshot

Look at the image carefully and write out what you see, **before** any code. If multiple screenshots were provided (different breakpoints, states, or scroll positions), audit each and note what changes between them — that's free information about responsive and interactive behavior.

Zoom mentally into each region. State values as numbers, not adjectives: "24px gap", not "generous spacing". A number can be translated to Tailwind; an adjective can't.

Cover:

**Layout** — overall structure (flex row/column, grid with N columns, absolute overlay), container max-width, outer padding, gaps between siblings, internal padding of each box, alignment (start/center/baseline/stretch), and anything that breaks the flow (a badge pinned to a corner, an avatar overlapping a card edge, a sticky header).

**Typography** — for every distinct text style: size, weight, line height, letter spacing (tight tracking on large headings is extremely common and its absence is very visible), color, case, and truncation. Note the hierarchy: which is the display size, which is body, which is the small muted label.

**Color** — background layers (page vs. surface vs. elevated surface — they're often 2–4% apart and that difference is the whole look), text colors at each level of emphasis, border colors, accent/brand color, and gradients (direction, stops, and whether the stops are colors or transparent-to-color).

**Depth and effects** — shadows (spread, blur, y-offset, opacity, and whether there are two layered shadows, which is the norm in good design systems), borders (width, color, whether it's a hairline at low opacity), backdrop blur, glow, inner highlights, noise, rings.

**Components** — name each archetype you recognize (navbar, hero, feature card, pricing tier, avatar group, badge, progress bar, tab set, accordion, modal, chart). Naming them tells you which conventions to apply and where the reusable boundaries are.

**Media** — images and icons: dimensions, aspect ratio, crop behavior, corner radius, any overlay or shadow. Identify icons by shape so you can match them to lucide-react.

**Implied behavior** — hover treatments, active/selected states visible in the shot (one tab is underlined, one nav item is brighter, one pricing card is "highlighted"), focus rings, disabled styling, transitions the design clearly wants (a lift on a card, a color shift on a button).

`references/visual-audit.md` has the full checklist with the specific things that are easiest to miss. Read it on the first recreation of a session, or any time the screenshot is dense.

## Step 2 — Derive the design system

Before writing JSX, collapse your measurements into a small system. This is what makes the output both accurate *and* maintainable, and it's how you resolve ambiguity honestly.

- **Spacing unit** — nearly every real design snaps to a 4px or 8px grid. Once you spot it, round your measurements to it. A gap you read as "23px" is 24px.
- **Type ramp** — the sizes you measured almost certainly form a recognizable scale (12/14/16/18/20/24/30/36/48/60). Snap to it.
- **Palette** — map each observed color to the nearest Tailwind token when it's close (within a couple percent of lightness); use an arbitrary value like `bg-[#0B0F19]` when it isn't. Brand colors are usually arbitrary; grays are usually tokens.
- **Radius scale** — typically 2–3 values across a design (e.g. 8px for inputs, 12px for cards, full for pills).
- **Shadow scale** — usually 2–3 elevations.

If a value is genuinely unreadable from the image, choose the one the system predicts. That's inference, not guessing, and it's why this step comes before the code.

## Step 3 — Plan the component tree

Split where the design repeats or where a section is conceptually independent. Three pricing cards means one `PricingCard` with props, not three JSX blocks. A page-level screenshot means `Navbar`, `Hero`, `FeatureGrid`, `Footer` as siblings.

Don't over-split. A `Divider` component that renders one `<div>` adds indirection for nothing. The test: would you reuse it, or does naming it make the parent easier to read? If neither, inline it.

Define a props interface for anything that varies, and colocate the content as a typed data array so the markup stays clean:

```tsx
const tiers: PricingTier[] = [ /* ... */ ];
// ...
{tiers.map((tier) => <PricingCard key={tier.name} {...tier} />)}
```

## Step 4 — Write the code

**Stack:** React function components, TypeScript, Tailwind utility classes. The output should drop into a standard Vite + React + Tailwind project and run with no extra setup beyond `lucide-react`.

**Tailwind first.** Use arbitrary values (`pt-[3.25rem]`, `bg-[#0B0F19]`, `shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]`) rather than dropping into a stylesheet — precision doesn't require abandoning utilities. Reach for a `<style>` block or CSS module only for things utilities genuinely can't express: `@keyframes`, complex multi-layer backgrounds, `::before` decorations, scroll-driven effects.

**Semantic HTML.** `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<button>`, `<a>`, `<ul>/<li>`. A clickable thing is a `<button>` or `<a>`, never a `<div>` with `onClick` — that single choice delivers keyboard access and focus behavior for free.

**Icons.** Prefer `lucide-react`. Match by shape; when the exact icon isn't in the set, pick the closest and note the substitution. Fall back to Heroicons or an inline SVG only for logos and genuinely custom marks. Icons that are purely decorative get `aria-hidden="true"`; icon-only buttons get an `aria-label`.

**Images.** Use a placeholder at the exact dimensions with the same `object-fit`, aspect ratio, radius, and shadow — sizing is structural and a wrong-sized placeholder breaks the layout. For photos, a neutral `bg-slate-200` block or `https://placehold.co/{w}x{h}` both work; leave a comment marking where the real asset goes.

**States and motion.** Add the hover, focus, and active treatments the design implies, with `transition-colors`/`transition-all` and a duration in the 150–300ms range. Include `focus-visible:` rings on every interactive element. Recreate entrance and ambient animations (fade, slide, scale, float, gradient shift) when the composition implies them — a hero that reads as animated should be. Respect `prefers-reduced-motion` for anything continuous.

**Responsive.** Build mobile-first and layer `sm:`/`md:`/`lg:` upward. The screenshot is one breakpoint; infer the others from structure — multi-column grids collapse to one column, horizontal navs become a menu button, display type steps down a size or two, section padding shrinks. Don't invent layouts the design doesn't suggest.

`references/tailwind-mapping.md` converts measured pixel values to Tailwind classes and covers arbitrary-value syntax. `references/effects.md` has tested recipes for glassmorphism, neumorphism, gradient text and borders, glow, animated gradients, and layered shadows — read it when the design has any of those. `references/patterns.md` has structural and accessibility patterns for the common archetypes (navbar, hero, pricing, tabs, accordion, modal, progress, avatar group).

## Step 5 — Verify

Re-read your audit from Step 1 and confirm each observation is present in the code. This catches the things that go missing during writing: the letter-spacing on the heading, the second shadow layer, the 1px border at 8% opacity, the badge on the featured card.

Then check the whole: is the visual weight distributed like the original? Does the eye land in the same place first? Contrast is where fidelity is most often lost — muted text that's too dark, or a surface that's too far from the page background, reads wrong even when every measurement is right.

Finally, sanity-check that it compiles: every import used, no undefined variables, `key` on mapped elements, props typed.

---

## Constraints

Recreate — don't redesign. The instinct to improve what you see is a real one, and here it's the wrong one: the user is asking for *this* interface, and the parts that look like mistakes are usually deliberate. Don't swap the layout for one you'd prefer, don't simplify a dense section, don't substitute your own color palette or type scale, don't drop elements that seem decorative.

If something in the design looks like an actual error, build it faithfully and mention it afterward in one line. That respects both the request and your judgment.

Never stall on incomplete information. A screenshot is always missing something — what's below the fold, what happens on hover, the exact hex under an overlay. Infer from the surrounding design system, keep the choice consistent with everything else, and note the assumption briefly at the end. An incomplete answer is worth less than a complete one with three noted assumptions.

## Deliverable

Return the code — component files, types, and any subcomponents — with a short note listing icon substitutions, placeholder images, and inferred values. Save files when the environment supports it; otherwise return them inline, one code block per file with the filename as the header.

Skip the tutorial. No setup instructions, no explanation of what Tailwind is, no walkthrough of the JSX. The code and a few lines of assumptions are the whole deliverable.
