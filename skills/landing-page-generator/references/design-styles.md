# Design Style Reference

The template (`assets/template.html`) ships with all four themes built in as CSS custom properties. Switch by setting `data-theme` on `<body>`. All themes meet WCAG AA contrast (4.5:1 body text).

## Choosing a Style

| Style | `data-theme` | Visual Tone | Best For |
|-------|-------------|-------------|----------|
| Dark SaaS | `dark-saas` | Dark navy backgrounds, violet accent, radial hero glow | Developer tools, technical products, modern SaaS |
| Clean Minimal | `clean-minimal` | White backgrounds, blue accent, subtle borders | Professional services, healthcare, education |
| Bold Startup | `bold-startup` | Warm cream background, rose accent, heavy type, large radii | Consumer products, startups, creative tools |
| Enterprise | `enterprise` | Cool gray background, deep navy accent, small radii, conservative | B2B enterprise, finance, government |

If the user has brand colors, override `--accent` and `--accent-hover` with them, but verify the button text contrast stays ≥ 4.5:1 (use a contrast checker; if it fails, darken the brand color for the button and keep the original as a secondary accent).

## Theme Tokens

Each theme defines: `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--accent-hover`, `--accent-text`, `--hero-gradient`, `--radius`, `--heading-weight`, `--heading-spacing`.

Personality comes from more than color:

- **Dark SaaS**: gradient glow behind hero, 12px radius, tight letter-spacing (-0.02em)
- **Clean Minimal**: no gradients, 8px radius, restrained weight (650)
- **Bold Startup**: 16px radius, 800-weight headings, -0.03em spacing, warm duotone gradient
- **Enterprise**: 6px radius, 600-weight headings, zero letter-spacing, no gradients

## Visual Hierarchy Rules

1. Headline is the largest text element on the page (template: `clamp(2.1rem, 5.5vw, 3.4rem)`)
2. CTA button is the most visually prominent element — solid accent fill; secondary CTAs get outline style (`.btn-secondary`)
3. Supporting text uses `--muted`, noticeably smaller than headings
4. White space separates sections (72px desktop / 48px mobile padding — already in the template)
5. Recommended pricing tier gets `featured` class: accent border + "Most popular" badge
6. One visual accent per section maximum — competing highlights cancel each other out

## Typography

The template uses the system font stack for zero font-loading cost (fastest LCP). If the brand requires a webfont:

- Load at most 2 weights (400 + 700)
- Use `font-display: swap` and preload the WOFF2 file
- Self-host rather than Google Fonts CDN where possible (avoids extra connection)

## Imagery

- Hero visual: real product screenshot beats illustration for SaaS; illustration beats stock photos everywhere
- Format: WebP or AVIF, explicit `width`/`height` attributes (prevents CLS)
- Hero image gets `fetchpriority="high"`; everything below the fold gets `loading="lazy"` — the template already does this
- Icons: inline emoji or inline SVG; avoid icon-font libraries (render-blocking)
