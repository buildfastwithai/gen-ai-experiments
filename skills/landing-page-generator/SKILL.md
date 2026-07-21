---
name: landing-page-generator
description: >
  Generate high-converting landing pages as production-ready HTML with built-in
  design themes, copy frameworks (PAS, AIDA, BAB), CTA strategy, SEO meta, and
  automated conversion/speed audits. Use whenever the user wants a landing page,
  campaign page, lead capture page, promo page, launch page, or single-page site
  — or wants an existing landing page reviewed, audited, or improved — even if
  they don't say "landing page" (e.g. "a page for my product", "somewhere to
  send ad traffic", "a signup page for the webinar").
license: MIT
metadata:
  version: 2.0.0
  author: borghei
  category: marketing
  domain: conversion
  updated: 2026-07-16
---
# Landing Page Generator

Build landing pages that convert, as a single self-contained HTML file, then verify them with the bundled audit scripts.

## Bundled Resources

| Resource | What It's For | When to Read/Run |
|----------|---------------|------------------|
| `assets/template.html` | Production-ready page scaffold: 9 sections, 4 themes, SEO meta, schema, CWV optimizations baked in | Copy as the starting point for every new page |
| `references/copy-frameworks.md` | PAS/AIDA/BAB application, hero copy rules, CTA formulas, voice rules | Before writing any copy |
| `references/section-library.md` | Section-by-section patterns, variants, and rules | When adding/removing/adapting sections |
| `references/design-styles.md` | Theme selection, tokens, typography, imagery rules | When choosing a theme or applying brand colors |
| `references/optimization.md` | Manual checklists, CWV targets, A/B testing, troubleshooting, benchmarks | Before delivery; when diagnosing an underperforming page |
| `scripts/*.py` | Automated audits (see Verify step) | After every draft, before delivery |

## Clarify First

Confirm these before generating. Ask only the 2-3 that most change the output; if the user says "just draft it," proceed and list assumptions at the top of the deliverable.

- **Conversion goal & offer** — the single action and what the visitor gets (one page, one goal, one CTA)
- **Target audience & awareness level** — selects the copy framework (see below)
- **Key pain point & key benefit** — drives the hero headline and Problem/Solution sections
- **Traffic source** — ads, email, or organic (sets message match)
- **Brand constraints** — existing colors/logo/screenshots, or free rein

## Workflow

### 1. Choose framework and theme

Copy framework by audience awareness (details in `references/copy-frameworks.md`):

| Audience | Framework |
|----------|-----------|
| Knows the problem | PAS |
| Needs education | AIDA |
| Wants transformation, knows solutions exist | BAB |

Design theme by product type (details in `references/design-styles.md`): `dark-saas` (dev tools, technical SaaS), `clean-minimal` (services, healthcare, education), `bold-startup` (consumer, creative), `enterprise` (B2B enterprise, finance, government).

### 2. Build from the template

Copy `assets/template.html`, set `data-theme` on `<body>`, and replace every `{{PLACEHOLDER}}`. The template's section order is canonical: Hero → Social proof bar → Problem → Solution → How it works → Testimonials → Pricing → FAQ → Final CTA. Remove sections that don't apply (e.g., Pricing on a lead-magnet page) but don't reorder — credibility must precede claims, and objection-handling must precede the final ask.

Non-negotiables the template already enforces — keep them intact when editing:

- One H1; nav is logo + CTA only (every extra link is an exit path)
- Same CTA action repeated ~3 times, friction reducer under each button
- Explicit width/height on images, `loading="lazy"` below the fold, `fetchpriority="high"` on the hero image
- Viewport meta, meta description, OG tags, FAQPage schema

Honesty rule: never invent testimonials, customer names, logos, metrics, or guarantees. If the user hasn't supplied them, leave clearly marked placeholders and list what's needed. Fabricated social proof is a legal and trust liability for the user.

### 3. Verify with the audit scripts

Run all three against the finished HTML (they support `--json` for machine-readable output):

```bash
python scripts/conversion_checklist.py page.html   # 20+ point structure audit
python scripts/cta_analyzer.py page.html           # CTA placement, copy strength, consistency
python scripts/page_speed_estimator.py page.html   # Est. Core Web Vitals (LCP, CLS, INP)
```

Fix anything below grade B and every flagged issue, then re-run. Also do the manual checks in `references/optimization.md` (the scripts can't judge whether the headline actually communicates value — read it cold).

### 4. Deliver

Provide the HTML file plus a short summary: framework and theme chosen (and why), audit scores, assumptions made, and the placeholders the user still needs to fill (images, real testimonials, signup URL, analytics).

If the page will receive real traffic, suggest an A/B test on the headline — commonly the highest-impact element (framework in `references/optimization.md`).

## Auditing an Existing Page

When asked to review/improve an existing landing page rather than build one: run all three scripts on it, read `references/optimization.md` for the manual checks and troubleshooting table, and present findings ordered by conversion impact (message match and above-fold CTA issues first, cosmetics last).

## Scope

**In scope:** page structure, copy application, design themes, conversion optimization, CTA strategy, SEO meta, CWV optimization, A/B test design, auditing existing pages.

**Out of scope:** running the ad campaigns that drive traffic, CMS/website-builder administration, analytics platform setup, backend form processing (the template's form points to a URL the user must wire up).

**Benchmarks caveat:** conversion medians (~6.6% across industries, 2025) vary hugely by category — SaaS trials 10-25%, e-commerce 2-3%. Treat as directional; the user's own baseline is the real benchmark.
