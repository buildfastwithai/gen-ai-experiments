# Conversion, SEO, Performance, and Testing Reference

The three scripts in `scripts/` automate most of these checks — run them rather than auditing by hand. This file is the rationale and the manual checklist for what the scripts can't see.

## Conversion Checklist (manual items)

The automated audit (`conversion_checklist.py`) covers structure. Manually verify:

- Headline communicates value to a stranger in ~5 seconds (read it cold)
- CTA visible without scrolling at 375px wide AND 1440px wide
- Every feature line has a corresponding benefit ("so what?" test)
- Objections addressed before the final CTA
- No external links that compete with the CTA
- Testimonials are real, named, and specific — never invented
- Logos used with permission

## SEO Checklist

- Title tag: primary keyword + brand, 50-60 characters
- Meta description: benefit + CTA, 150-160 characters
- One H1, includes primary keyword
- OG image: 1200x630 with product name and value proposition
- Canonical URL set
- Alt text on all images
- FAQPage schema if FAQ section exists (template includes the stub — keep it in sync with visible FAQ content)

## Core Web Vitals Targets

| Metric | Good | How the Template Achieves It |
|--------|------|------------------------------|
| LCP (Largest Contentful Paint) | < 2.5s | System fonts, no render-blocking JS, `fetchpriority="high"` hero image, WebP/AVIF |
| CLS (Cumulative Layout Shift) | < 0.1 | Explicit width/height on every image |
| INP (Interaction to Next Paint) | < 200ms | No JS frameworks; the page is static HTML |
| TTFB (Time to First Byte) | < 600ms | Host as a static file on a CDN |
| Total page weight | < 1MB | Single-file page; images are the only external weight |

Note: INP replaced FID as a Core Web Vital in March 2024. Ignore any tooling still reporting FID.

Speed matters because load time correlates strongly with bounce and conversion — industry studies commonly cite several percent conversion loss per extra second of load. Treat exact figures as directional, not gospel; measure your own funnel.

## A/B Testing Framework

What to test, highest impact first:

1. **Headline** — commonly the single highest-impact element; test 2-3 variants
2. **CTA copy and prominence**
3. **Hero visual** — screenshot vs. illustration vs. video
4. **Social proof placement** — above fold vs. below benefits
5. **Form length** — fewer fields vs. more qualified leads
6. **Price display** — annual vs. monthly default, anchoring

Rules:

- One variable at a time
- Minimum 14 days or ~1,000 visitors per variant before judging
- Require statistical significance (95% confidence) — never call a test early
- Document every test:

```markdown
## A/B Test: [Name]
- Page: [URL]
- Hypothesis: [If we change X, then Y improves because Z]
- Control / Variant: [descriptions]
- Primary metric: [Conversion rate]
- Duration: [Start - End] | Traffic per variant: [N]
- Result: [Winner + lift + confidence]
- Learning: [What we apply going forward]
```

## Benchmarks (directional, 2025 data)

- Median landing page conversion across industries: ~6.6%
- Top performers: >10%
- Varies hugely by category: SaaS trials 10-25%, e-commerce 2-3%, lead gen forms 5-15%
- Always compare against the user's own historical baseline first, industry medians second

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| High bounce from paid traffic | Headline doesn't match the ad | Exact message match between ad copy and H1 |
| CTA below fold on mobile | Hero too tall | Test at 375px; trim hero or move CTA up |
| Good traffic, zero conversions | Tracking broken | Verify pixel fires on thank-you page with a real conversion |
| Slow load (>3s mobile) | Unoptimized images, heavy JS | Run `page_speed_estimator.py`; convert to WebP, defer JS |
| Form submits but no leads in CRM | Integration broken | Test end-to-end; check webhook/API |
| Visitors confused by CTAs | Competing conversion paths | One goal; all CTAs drive the same action |
| Low conversion despite good copy | Missing proof or risk reversal | Run `conversion_checklist.py`; add testimonials + "no credit card" near CTAs |
