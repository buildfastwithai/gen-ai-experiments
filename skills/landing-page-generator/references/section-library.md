# Page Section Library

Canonical section order (matches `assets/template.html`):

| Order | Section | Purpose |
|-------|---------|---------|
| 1 | Hero | Communicate value in 5 seconds |
| 2 | Social proof bar | Build instant credibility |
| 3 | Problem | Show you understand their pain |
| 4 | Solution / Benefits | Present your answer |
| 5 | How it works | Reduce perceived complexity |
| 6 | Testimonials | Proof from real customers |
| 7 | Pricing (optional) | Help them decide |
| 8 | FAQ | Handle objections |
| 9 | Final CTA | Repeat the ask with risk reversal |

Sections are removable, not reorderable — a short lead-magnet page might be just Hero → Proof bar → Benefits → Final CTA. Keep the order for whatever remains: credibility before claims, claims before objection-handling, objection-handling before the final ask.

## Hero

Components: headline, subheadline, primary CTA, optional secondary CTA, supporting visual, trust signal.

| Variant | Layout | Best For |
|---------|--------|----------|
| Centered (template default) | Text centered, CTA below, visual below | Simple offers, clear value props |
| Split | Text left, visual right | Product with strong screenshot |
| Video background | Text overlay on ambient video | Brand-heavy awareness pages |
| Minimal | Headline + CTA only | High-intent traffic, direct offers |
| Social proof hero | Testimonial as the headline | Strong customer story to lead with |

## Problem

- 2-3 pain points in the reader's language, each specific and recognizable
- Quantify the cost where possible ("This costs teams an average of $X per month")

## Solution / Benefits

- 3-5 benefits (not features); each follows [What it does] → [Why that matters] → [Specific outcome]
- Visual support per benefit: icon, screenshot, or illustration

## How It Works

- 3 steps ideal, 4 maximum — complexity kills conversion
- Each step starts with an action verb and stands alone
- Optional final step states the outcome ("See results within [timeframe]")

## Social Proof

Types ranked by conversion impact:

| Type | Impact | Example |
|------|--------|---------|
| Named testimonial with metrics | Highest | "Reduced churn by 23% in 90 days" — Sarah Chen, VP Marketing |
| Customer logos | High | Row of recognizable brand logos |
| Aggregate metrics | High | "2,847 teams, 40+ countries, 4.8/5 rating" |
| Star ratings / review scores | Medium | "4.8 out of 5 on G2 (500+ reviews)" |
| Case study link | Medium | "See how [Company] achieved [result]" |
| Generic testimonial | Low | "Great product!" — John D. |

Only use real testimonials and logos the user provides or approves. Never fabricate names, companies, or metrics — put `{{PLACEHOLDER}}` markers if none are supplied and tell the user what's needed.

## Pricing

- 2-4 tiers (3 optimal); highlight the recommended tier visually
- Enterprise tier with "Contact us" for custom needs
- Annual/monthly toggle if offering both
- Trust signals near pricing: guarantee, cancel anytime

## FAQ

- 5-8 questions answering real buying objections, answers 1-3 sentences
- Include FAQPage schema markup (stub is in the template)
- Standard objections: pricing mechanics, cancellation, setup time, trial, data security, integrations, differentiation from the obvious competitor

## Final CTA

- Headline restating core value + 1 supporting sentence
- Same CTA text as hero
- Risk reversal statement (guarantee, no CC, cancel anytime)
- Optional: customer count or testimonial snippet

## Forms (if capturing leads)

- Minimum fields to qualify the lead — every extra field costs conversion
- Label above field, error messages inline, correct mobile keyboard types (`type="email"`, `type="tel"`)
- Link the privacy policy next to the submit button
