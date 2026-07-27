# Pixel → Tailwind Mapping

Lookup tables for converting measured values into utility classes, plus the arbitrary-value syntax for everything that doesn't land on a token.

Contents:
1. [Spacing](#spacing)
2. [Font size and line height](#font-size-and-line-height)
3. [Font weight](#font-weight)
4. [Letter spacing](#letter-spacing)
5. [Border radius](#border-radius)
6. [Shadows](#shadows)
7. [Widths and containers](#widths-and-containers)
8. [Grays](#grays)
9. [Opacity and alpha](#opacity-and-alpha)
10. [Arbitrary value syntax](#arbitrary-value-syntax)
11. [Breakpoints](#breakpoints)
12. [Transitions](#transitions)

---

## Spacing

Applies to `p-`, `m-`, `gap-`, `space-x/y-`, `top/right/bottom/left-`, `w-`, `h-`, `inset-`.

| px | class | px | class |
|----|-------|----|-------|
| 0 | `0` | 40 | `10` |
| 1 | `px` | 44 | `11` |
| 2 | `0.5` | 48 | `12` |
| 4 | `1` | 56 | `14` |
| 6 | `1.5` | 64 | `16` |
| 8 | `2` | 80 | `20` |
| 10 | `2.5` | 96 | `24` |
| 12 | `3` | 112 | `28` |
| 14 | `3.5` | 128 | `32` |
| 16 | `4` | 144 | `36` |
| 20 | `5` | 160 | `40` |
| 24 | `6` | 176 | `44` |
| 28 | `7` | 192 | `48` |
| 32 | `8` | 224 | `56` |
| 36 | `9` | 256 | `64` |

Quick rule: **class number = px ÷ 4**.

Off-scale values: `p-[13px]`, `gap-[18px]`, `mt-[3.25rem]`. Prefer rem for anything type-related, px for hairlines and fixed chrome.

## Font size and line height

| px | class | default leading |
|----|-------|-----------------|
| 12 | `text-xs` | 16px |
| 14 | `text-sm` | 20px |
| 16 | `text-base` | 24px |
| 18 | `text-lg` | 28px |
| 20 | `text-xl` | 28px |
| 24 | `text-2xl` | 32px |
| 30 | `text-3xl` | 36px |
| 36 | `text-4xl` | 40px |
| 48 | `text-5xl` | 1 |
| 60 | `text-6xl` | 1 |
| 72 | `text-7xl` | 1 |
| 96 | `text-8xl` | 1 |
| 128 | `text-9xl` | 1 |

Line height overrides:

| class | value |
|-------|-------|
| `leading-none` | 1 |
| `leading-tight` | 1.25 |
| `leading-snug` | 1.375 |
| `leading-normal` | 1.5 |
| `leading-relaxed` | 1.625 |
| `leading-loose` | 2 |

Combined arbitrary form: `text-[15px]/[22px]` sets size and line height together.

Typical pairings: display headings `leading-tight` or `leading-[1.1]`; body copy `leading-relaxed`; button labels `leading-none`; dense UI labels `leading-snug`.

## Font weight

| value | class | typical use |
|-------|-------|-------------|
| 400 | `font-normal` | body |
| 500 | `font-medium` | labels, nav links, buttons |
| 600 | `font-semibold` | card titles, section headings, badges |
| 700 | `font-bold` | display headings |
| 800 | `font-extrabold` | marketing display |

If a heading looks bold but not heavy, it's usually 600, not 700.

## Letter spacing

| class | value | use |
|-------|-------|-----|
| `tracking-tighter` | -0.05em | very large display type |
| `tracking-tight` | -0.025em | headings ≥ 24px — the default for modern UI |
| `tracking-normal` | 0 | body |
| `tracking-wide` | 0.025em | small caps labels |
| `tracking-wider` | 0.05em | eyebrow text |
| `tracking-widest` | 0.1em | uppercase micro-labels |

Rule of thumb: as type gets bigger, tracking gets tighter; as it gets smaller and uppercase, tracking gets wider.

## Border radius

| px | class |
|----|-------|
| 2 | `rounded-sm` |
| 4 | `rounded` |
| 6 | `rounded-md` |
| 8 | `rounded-lg` |
| 12 | `rounded-xl` |
| 16 | `rounded-2xl` |
| 24 | `rounded-3xl` |
| 9999 | `rounded-full` |

Off-scale: `rounded-[10px]`, `rounded-[20px]`. Nested elements: inner radius ≈ outer radius − padding.

## Shadows

Tailwind defaults:

| class | approximate value |
|-------|-------------------|
| `shadow-sm` | 0 1px 2px rgb(0 0 0 / 0.05) |
| `shadow` | 0 1px 3px / 0 1px 2px |
| `shadow-md` | 0 4px 6px / 0 2px 4px |
| `shadow-lg` | 0 10px 15px / 0 4px 6px |
| `shadow-xl` | 0 20px 25px / 0 8px 10px |
| `shadow-2xl` | 0 25px 50px -12px rgb(0 0 0 / 0.25) |

Custom layered shadow (closer to what real design systems ship):

```
shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-4px_rgba(16,24,40,0.10)]
```

Colored / glow:

```
shadow-lg shadow-indigo-500/30
shadow-[0_0_40px_rgba(99,102,241,0.35)]
```

Inner highlight on dark surfaces:

```
shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
```

Note: underscores replace spaces inside arbitrary values, and commas separate layers.

## Widths and containers

| class | px |
|-------|-----|
| `max-w-xs` | 320 |
| `max-w-sm` | 384 |
| `max-w-md` | 448 |
| `max-w-lg` | 512 |
| `max-w-xl` | 576 |
| `max-w-2xl` | 672 |
| `max-w-3xl` | 768 |
| `max-w-4xl` | 896 |
| `max-w-5xl` | 1024 |
| `max-w-6xl` | 1152 |
| `max-w-7xl` | 1280 |

Standard page container:

```html
<div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
```

Paragraph measure: `max-w-prose` (≈65ch) or `max-w-[60ch]`.

## Grays

Pick the family that matches the design's temperature — this choice is more visible than people expect:

- `slate` — cool, blue-tinted. Default for most modern SaaS.
- `gray` — neutral with a slight cool cast.
- `zinc` — truly neutral. Good for dark themes.
- `neutral` — pure grayscale.
- `stone` — warm. Editorial, organic brands.

Typical light-theme assignments: page `bg-slate-50`, surface `bg-white`, border `border-slate-200`, primary text `text-slate-900`, secondary `text-slate-600`, muted `text-slate-400`.

Typical dark-theme: page `bg-slate-950`, surface `bg-slate-900`, border `border-white/10`, primary `text-white`, secondary `text-slate-300`, muted `text-slate-400`.

## Opacity and alpha

Prefer color alpha over element opacity — `bg-black/40` affects only the background, `opacity-40` fades the text too.

Alpha syntax works on any color utility: `bg-white/5`, `border-white/10`, `text-slate-900/70`, `ring-indigo-500/30`, `from-black/80`.

## Arbitrary value syntax

```
bg-[#0B0F19]                    exact hex
text-[#64748B]
p-[13px]  mt-[3.25rem]          off-scale spacing
w-[calc(100%-2rem)]             calc — no spaces around operators, or use underscores
grid-cols-[280px_1fr]           explicit tracks
bg-[linear-gradient(135deg,#6366F1_0%,#A855F7_100%)]
bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.25),transparent)]
backdrop-blur-[6px]
[mask-image:linear-gradient(to_bottom,black,transparent)]   arbitrary property
animate-[float_6s_ease-in-out_infinite]
```

Rules: spaces become underscores; a literal underscore needs `\_`; the whole value must contain no unescaped spaces.

## Breakpoints

| prefix | min-width |
|--------|-----------|
| (none) | 0 |
| `sm:` | 640 |
| `md:` | 768 |
| `lg:` | 1024 |
| `xl:` | 1280 |
| `2xl:` | 1536 |

Mobile-first: unprefixed classes are the mobile state; prefixed classes apply upward.

## Transitions

```
transition-colors duration-200
transition-all duration-300 ease-out
hover:-translate-y-1 hover:shadow-xl transition-all duration-300
active:scale-[0.98]
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
```

Durations: 150ms for color/background, 200–300ms for transform and shadow, 300–500ms for entrance animations. Anything over 500ms on an interaction feels sluggish.
