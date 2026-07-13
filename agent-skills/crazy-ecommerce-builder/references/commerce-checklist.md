# Commerce checklist

Use this checklist to preserve shopping clarity inside an experimental interface.

## Information architecture

- First viewport: brand, product category, differentiator, hero product, and primary action.
- Product browse: image, product name, price, key variant/material/detail, and add action.
- Proof: process, materials, origin, warranty, sizing, usage, or another truthful confidence builder.
- Cart: item identity, quantity or repeated items, removal, total, close action, and checkout state.
- Footer: shop navigation, contact route, policies or placeholders only when real, and brand closure.

Add categories, filters, search, product detail routes, variant selectors, inventory, or accounts only when the catalog or brief justifies them.

## Interaction requirements

- Use native links for navigation and buttons for actions.
- Give icon-only controls accessible labels.
- Make add-to-cart feedback visible without stealing focus.
- Keep the cart keyboard reachable and closable.
- Avoid hover-only essential information.
- Ensure touch targets remain usable on mobile.
- Respect `prefers-reduced-motion`.
- Do not let marquees, parallax, custom cursors, or transitions block reading or buying.

## Responsive composition

Do more than stack desktop sections:

- recrop generated hero imagery for the mobile focal point;
- reduce or recompose overlapping type rather than shrinking it to illegibility;
- preserve one signature layout break;
- move nonessential editorial facts below the buying path;
- keep price, product details, add action, cart total, and checkout visible;
- test long names, larger cart counts, and narrow widths through resilient CSS.

## Integration honesty

- Payment not connected: use a disabled or explanatory demo checkout and disclose it.
- Newsletter not connected: show a local success state only if copy makes clear it is a prototype, or omit submission.
- Inventory unavailable: avoid “only N left” and live-stock language.
- Reviews unavailable: never fabricate ratings, names, or testimonials.
- Shipping unknown: do not invent thresholds, delivery times, or destinations.

## Validation handoff

Before publishing:

- run the production build;
- confirm all generated image paths resolve;
- confirm metadata, favicon, title, description, and social card match the new brand;
- remove starter copy and unused placeholder assets when safe;
- verify product names and prices match the brief;
- state which integrations are demos.

In the final response, lead with the live URL or primary local deliverable, then summarize the concept and the connected versus demo commerce behavior.
