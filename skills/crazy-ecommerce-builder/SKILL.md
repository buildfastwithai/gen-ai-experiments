---
name: crazy-ecommerce-builder
description: Build or transform ecommerce websites from loose company, product, or brand briefs into unconventional, brand-specific shopping experiences with original ImageGen product imagery. Use when a user asks for a crazy, wild, experimental, unconventional, anti-template, art-directed, or highly memorable online store; wants Codex to invent an ecommerce visual direction from business details; or wants a working storefront that combines creative concepting, generated product photography, responsive implementation, cart interactions, validation, and optional publishing.
---

# Crazy Ecommerce Builder

Turn a short company brief into a coherent creative thesis, a custom image world, and a working ecommerce experience. Make the result surprising because it expresses the product truth—not because it uses random effects.

## Required companion skills

Use the available `sites-building` skill for implementation and validation, `imagegen` for original raster assets, and `sites-hosting` for publishing unless the user asks to keep the site local. Read each selected skill before taking its actions. If one is unavailable, follow the closest local workflow and state the limitation briefly.

## Inputs

Extract or infer:

- company or product name;
- what is sold and why it is meaningfully different;
- customer and price position;
- catalog size or representative products;
- brand personality, taboos, and desired level of visual risk;
- existing assets, copy, site, stack, and publishing preference.

Do not demand a complete brief. Ask at most two short questions only when a missing answer would materially change the business or creative direction. Otherwise make labeled assumptions and proceed. Treat supplied product facts, prices, claims, and materials as source of truth; never invent regulated, medical, sustainability, performance, or certification claims.

## Workflow

### 1. Inspect and protect the workspace

Determine whether this is a new site or an existing project. Preserve the existing package manager, architecture, working features, user changes, and hosting configuration. Inspect the current product surface before editing. Do not replace a functioning project solely to use a preferred framework.

### 2. Write the creative thesis

Before designing, condense the brief into:

1. **Product tension** — the surprising contradiction or transformation inside the product.
2. **Customer feeling** — the emotion the first viewport should create.
3. **Visual world** — one specific art-direction system with palette, type behavior, composition, photography, motion, and texture.
4. **Commerce spine** — the shortest path from intrigue to product understanding to purchase.
5. **Signature device** — one memorable motif tied to the product, such as a seam, split, orbit, tear, specimen label, thermal map, or impossible scale shift.

Read [creative-system.md](references/creative-system.md) when choosing the direction. Do not start implementation until the thesis is internally coherent.

If the user explicitly asks to choose among directions, or the applicable Sites workflow requires a picker, create three genuinely distinct concepts and follow that workflow. Otherwise choose the strongest direction and build without pausing.

### 3. Plan a small image system

Read [image-system.md](references/image-system.md). Generate a deliberate family of assets rather than unrelated pretty images. Default to:

- one landscape hero image with usable copy space;
- two to four consistent product-card images;
- one process or editorial image only when it adds information;
- exactly one finished social card after the site's palette, headline, and motifs are stable.

Use built-in ImageGen mode by default. Keep every project-used final asset inside the workspace. Inspect generated results for product accuracy, text errors, unwanted objects, inconsistent materials, malformed geometry, and mismatched lighting. Retry only with a targeted correction.

### 4. Build the commerce experience

Read [commerce-checklist.md](references/commerce-checklist.md). Build the first viewport around the product, not generic navigation or a dashboard shell. Include concrete brand copy and realistic product data.

Make the site feel unconventional through hierarchy, composition, cropping, typography, color relationships, copy voice, and one or two purposeful interactions. Preserve legibility, product comprehension, obvious calls to action, keyboard access, touch usability, responsive behavior, and reduced-motion support.

At minimum, implement:

- a distinctive hero with a clear product proposition;
- browseable products with names, prices, useful details, and add-to-cart controls;
- visible cart state and a usable cart surface;
- a credible brand/process/proof section;
- mobile behavior and accessible labels;
- honest handling of checkout, inventory, newsletter, and other integrations.

If payment, inventory, email, or fulfillment services are not connected, implement a polished demo state and say so in the handoff. Never imply that money, subscriptions, or orders are being processed when they are not.

### 5. Validate proportionally

Run the production build after implementation. Fix actual failures and rebuild. Check that generated assets resolve, key product content is present, interactions compile, and the old starter identity is gone. Follow the Sites preview rules; do not add browser QA unless requested or required.

### 6. Publish and hand off

Publish through `sites-hosting` after a successful build unless the user requested local-only work. Lead with the live URL. Briefly summarize the concept, working commerce interactions, generated-image set, and any intentionally unconnected production service such as checkout.

## Quality bar

- The design could not be swapped onto an unrelated company without losing meaning.
- The product is understandable within the first viewport despite the experimentation.
- Every generated image depicts the same product logic and art direction.
- Mobile is composed, not merely stacked.
- Motion supports the concept and respects reduced-motion preferences.
- Copy has a recognizable voice without obscuring essential buying information.
- The user receives a working site, not only a moodboard or static mockup.

## Avoid

- generic luxury beige, default SaaS gradients, gratuitous glassmorphism, and template-card grids;
- random distortion, cursor gimmicks, or animation that blocks shopping;
- fake reviews, fake scarcity counters, fake certifications, or unsupported claims;
- generating text-heavy images when HTML text should remain selectable and responsive;
- using generated imagery as a substitute for missing product truth;
- leaving project assets only in ImageGen's default output directory;
- finishing without build validation or hiding incomplete integrations.
