# Visual Audit Checklist

The full pass over a screenshot. Work top to bottom; write observations as numbers.

Contents:
1. [Canvas and frame](#1-canvas-and-frame)
2. [Layout structure](#2-layout-structure)
3. [Spacing](#3-spacing)
4. [Typography](#4-typography)
5. [Color](#5-color)
6. [Borders and radius](#6-borders-and-radius)
7. [Shadow and depth](#7-shadow-and-depth)
8. [Images and media](#8-images-and-media)
9. [Icons](#9-icons)
10. [State evidence](#10-state-evidence)
11. [Motion evidence](#11-motion-evidence)
12. [Responsive inference](#12-responsive-inference)
13. [Commonly missed details](#13-commonly-missed-details)

---

## 1. Canvas and frame

- Apparent viewport width — is this a desktop shot (~1440), tablet (~768), or mobile (~390)? It sets the scale for every other measurement.
- Is the content full-bleed or inside a centered container? Estimate the container max-width (1024/1152/1280 are the usual suspects).
- Page background vs. section backgrounds. Alternating section backgrounds are easy to miss when the difference is 2%.
- Is anything sticky or fixed (header, sidebar, floating CTA)?
- Device chrome, browser chrome, or a mockup frame in the shot — exclude it from the build unless the user asked for it.

## 2. Layout structure

For each region, name the mechanism:

- **Flex row** — count children, note `justify-*` and `align-*`, note which child grows.
- **Flex column** — note the gap and cross-axis alignment.
- **Grid** — count columns and rows, note whether columns are equal (`grid-cols-3`) or asymmetric (`grid-cols-[280px_1fr]`), note the gap.
- **Absolute/relative** — anything that overlaps, pins to a corner, or sits outside its parent's flow: badges, close buttons, avatars overlapping a card top, decorative blobs behind a hero.
- **Stacking** — overlapping elements imply z-index; note the order.

Watch for: a nav that's `justify-between` with three groups; a card grid where the featured card is taller or scaled up; a hero that's a 2-column grid on desktop.

## 3. Spacing

Measure in this order — outer to inner:

- Section vertical padding (top and bottom, often unequal).
- Container horizontal padding.
- Gap between major sections.
- Gap between siblings in each flex/grid container.
- Padding inside each card, button, input, badge.
- Space between a heading and its paragraph, and between paragraph and CTA — these are usually different and both usually smaller than you'd guess.
- Icon-to-text gap inside buttons and list items (typically 6–8px).

Then find the base unit: divide your measurements by 4 and by 8, and see which produces clean integers. Snap everything to it.

## 4. Typography

Build a table of every distinct text style:

| Where | Size | Weight | Line height | Tracking | Color | Notes |
|-------|------|--------|-------------|----------|-------|-------|

Specifics to catch:

- **Display headings** are usually 36–72px with weight 600–800 and *negative* tracking (`tracking-tight` / `tracking-tighter`). Missing tracking is one of the most visible fidelity failures.
- **Body** is 14–18px, weight 400, line height 1.5–1.75 (`leading-relaxed` is very common in marketing copy).
- **Eyebrow / overline** labels: 11–13px, weight 500–600, uppercase, *positive* tracking (`tracking-wide` / `tracking-widest`), muted or accent-colored.
- **Buttons**: 14–16px, weight 500–600, `leading-none` typical.
- **Muted text** is the same size as body at a lower-contrast color, not a smaller size — check which.
- Font family: geometric sans (Inter/Geist/Poppins) is the default assumption; note if it's clearly a serif, mono, or a distinctive display face.
- Numeric text in tables and stats often uses `tabular-nums`.

## 5. Color

Sample mentally at each layer and record hex or the nearest Tailwind token:

- Page background.
- Surface background (cards) — often 2–5% off the page background. On dark themes this may be *lighter*; on light themes cards are usually pure white on a tinted gray page.
- Elevated surface (dropdowns, modals, tooltips).
- Text: primary, secondary, muted, disabled, inverted.
- Border: default and subtle (subtle borders are frequently `white/10` or `black/5` rather than a solid gray).
- Accent/brand, plus its hover shade (usually one step darker) and its tinted background (usually the 50/100 step, or the accent at 10% alpha).
- Semantic: success, warning, error, info.

Gradients — record direction (`to-r`, `to-br`, `135deg`), stop colors, stop positions, and whether any stop is transparent. Radial gradients behind heroes are common and read as "glow" rather than as a gradient.

Overlays — a scrim over an image is usually `black/40`–`black/60`, or a `to-t from-black/80 to-transparent` gradient for text legibility at the bottom.

## 6. Borders and radius

- Border width: 1px is the default; 2px reads as deliberate emphasis.
- Border color and opacity — hairlines are very often semi-transparent.
- Partial borders: `border-b` on a header, `border-l` on a quote, `divide-y` between list rows.
- Radius per element type. Common families:
  - Sharp/subtle: 4–6px
  - Standard cards/inputs: 8–12px
  - Soft/modern: 16–24px
  - Pills: `rounded-full`
- Nested radius: an image inside a padded card has a smaller radius than the card (roughly card radius minus padding). Matching them exactly looks wrong.
- Rings vs. borders: a `ring` sits outside and doesn't affect layout; selected/focused states often use one.

## 7. Shadow and depth

Record y-offset, blur, spread, and color/opacity. Quality design systems layer two shadows — a tight one for the contact edge and a wide soft one for ambient depth:

```
shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-4px_rgba(16,24,40,0.10)]
```

Also look for:

- Colored shadows under accent buttons (`shadow-lg shadow-indigo-500/30`) — very common in modern marketing UI.
- Inner top highlight on dark elevated surfaces (`inset 0 1px 0 rgba(255,255,255,0.08)`).
- Glow: a large blurred shadow in the accent color with no offset.
- Whether "elevation" is achieved by shadow, by border, or by background contrast — dark themes often use border + background rather than shadow.

## 8. Images and media

- Rendered width × height, and therefore aspect ratio.
- `object-cover` vs. `object-contain` — is the subject cropped by the frame?
- Focal point if cropped (`object-top` for portraits, `object-center` default).
- Radius, border, shadow, overlay.
- Avatars: size (24/32/40/48), radius (almost always full), ring/border color, and whether they're in an overlapping stack (negative margin, e.g. `-space-x-2`, plus a ring in the surface color to create the cut-out edge).
- Background images: `bg-cover`, position, whether there's a scrim.

## 9. Icons

- Size — 16px next to body text, 20px in buttons, 24px standalone. Icon size is usually consistent within a region.
- Stroke weight — lucide defaults to 2; thinner-looking icons want `strokeWidth={1.5}`.
- Color relative to adjacent text — icons are often one step more muted.
- Identify by shape: chevrons (direction matters), arrows, check/check-circle, x, plus, search, menu, user, settings/gear, bell, star, heart, calendar, clock, mail, external-link, sparkles, zap, shield, trending-up.
- Icons inside colored circles/squares — note the container size, radius, and background tint separately from the icon.

## 10. State evidence

The screenshot is one moment, and it usually shows more than one state at once:

- Which nav item / tab / step is active, and how is that shown (weight, color, underline, background pill, indicator bar)?
- Is one card visually promoted (border, scale, shadow, badge, different background)?
- Any element mid-hover — brighter, lifted, with a visible cursor nearby?
- Disabled elements — reduced opacity, muted color.
- Form fields: empty vs. filled vs. focused vs. error. Note placeholder color separately from value color.
- Checkboxes, toggles, radios: which are on, and what the on/off treatments are.

Every state you can see gives you the rule for the states you can't.

## 11. Motion evidence

Static images imply motion through:

- Content that reads as an entrance sequence (stacked cards with a clear order) → staggered fade-up.
- Floating decorative shapes → slow float/pulse.
- Multi-stop gradients on large backgrounds → often animated in the original.
- Cards with pronounced shadows → hover lift.
- Carousels/marquees with items cut off at the edge → horizontal scroll animation.
- Progress bars, spinners, skeleton blocks → their own animations.
- Buttons with strong affordance → color/scale transition on hover, slight scale-down on active.

## 12. Responsive inference

From one breakpoint, derive the rest:

| Desktop | Tablet | Mobile |
|---|---|---|
| `grid-cols-3` | `grid-cols-2` | `grid-cols-1` |
| 2-col hero (text + image) | stacked, image below | stacked, image below |
| horizontal nav links | horizontal or condensed | menu button |
| `text-6xl` display | `text-5xl` | `text-4xl` |
| `py-24` sections | `py-16` | `py-12` |
| `px-8` container | `px-6` | `px-4` |
| sidebar visible | collapsed/icon-only | drawer |
| table | table with fewer columns | stacked cards |

Write mobile-first: base classes are mobile, `md:`/`lg:` restore the screenshot.

## 13. Commonly missed details

Check these explicitly before finishing — they're the ones that survive a casual look and then read as "off":

- Negative letter-spacing on large headings.
- The second, wider shadow layer.
- Semi-transparent hairline borders (`border-white/10`, `border-black/5`).
- Subtle background difference between page and card.
- Uneven padding (more bottom than top, or more horizontal than vertical).
- Optical alignment: icons often need a 1px nudge to look centered next to text.
- `max-w-*` on paragraphs — body copy in heroes is almost always constrained to ~60ch, not full width.
- Buttons in a row are usually the same height but different widths; height comes from padding + line-height, not a fixed value.
- The gap between an icon and its label inside a button (6–8px, not the container gap).
- Muted text is a color change, not an opacity change, in most design systems.
- Badge text is small *and* semibold — one without the other looks wrong.
- Focus rings exist even when the screenshot doesn't show them.
