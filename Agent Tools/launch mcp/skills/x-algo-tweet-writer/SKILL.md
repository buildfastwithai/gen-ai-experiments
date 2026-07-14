---
name: x-algo-tweet-writer
description: "Use this skill whenever the user asks to write, draft, or create a tweet, X post, thread, quote-tweet, or reply on X (formerly Twitter). Also trigger when the user shares a topic, news item, link, or rough idea and wants it shaped into an X post. Covers all formats: single tweets, short threads, quote-tweets, reply-jacks, and posts with image/video. Every tweet produced should be engineered to perform well under the X 'For You' algorithm based on the leaked xAI source code (May 2026): optimize for dwell + reply + follow_author, cross the 30-minute min-traction gate, avoid AI slop and negative signals (not_dwelled, not_interested, block, mute, report), and apply the right format for the goal (reach vs. engagement vs. follower growth). Use this even if the user just says 'tweet this' or 'post about X' — assume they want algorithm-optimized output. Do NOT use for LinkedIn posts (use linkedin-post-writer), blogs (use organic-traffic-generator), or Unrot daily news items (use unrot-news-writer)."
---

# X Algorithm Tweet Writer

## Purpose

Write tweets that are engineered for the X "For You" algorithm — not "tweets that sound good" but tweets that actually win against the 22 signals the model predicts. Every craft decision (hook, length, format, timing, link/hashtag/quote choice) maps to a documented mechanism in the xAI source code dump from May 2026.

The full source-code analysis is in `references/x-algo-insights.md` — read it when you need a mechanism's exact citation, when the user asks "why," or when you hit a case this SKILL.md doesn't cover.

---

## The mental model in one paragraph

The algorithm scores each tweet as a weighted sum of 22 probabilities. **17 are positive** (favorite, reply, retweet, dwell, cont_dwell_time, click_dwell_time, photo_expand, click, profile_click, vqv, share, share_via_dm, share_via_copy_link, quote, quoted_click, quoted_vqv, follow_author). **5 are negative and subtract** (not_dwelled, not_interested, block_author, mute_author, report). Negative signals weigh orders of magnitude more than positive ones. Above that scoring layer, three gates decide whether your post enters broad discovery at all: (1) the **min-traction gate** in the first ~30 minutes — without early engagement the post never enters Grok's Banger Initial Screen and never gets a quality multimodal embedding, so it's invisible out-of-network; (2) the **80-hour age cap** — after ~3 days the model treats the post as "very old" and stops surfacing it; (3) the **Author Diversity Decay** — your 2nd, 3rd, 4th post in the same feed gets exponentially demoted. Everything else is a corollary.

---

## Workflow (follow in order)

### Step 1: Clarify the goal

Before writing, identify which of these the user wants. Don't ask if it's obvious from context, but make sure you've classified it internally:

| Goal | Optimize for | Format implications |
|---|---|---|
| **Reach / virality** | quote_score, retweet_score, follow_author, dwell | Original post, contrarian hook, citable phrasing, post at audience peak time |
| **Engagement / conversation** | reply_score, cont_dwell_time | Question or polarizing claim at end, substantive body, reply hook |
| **Follower growth** | follow_author_score, profile_click_score | Strong POV, unique angle, "who is this person?" energy |
| **Reply-jacking a large account** | Reply Ranker 0-3 score | Substantive reply, adds info or wit, not generic |
| **Quote-tweeting a viral** | quote_score, quoted_click, quoted_vqv | Real take added, quoted post must be "Safe" (not MediumRisk) |
| **Thread** | dwell across multiple tweets | Single banger first tweet — only one tweet per thread survives DedupConversationFilter |

If the user gave a raw topic with no goal hint, default to **reach + engagement** (the most common ask).

### Step 2: Choose the post type

There are five primary types. Pick exactly one — don't blend.

- **Original text post** — the workhorse. Goes through Banger Screen, gets multimodal embedding, eligible for OON retrieval. Use for ~70% of cases.
- **Original with image** — same as above plus `photo_expand_score` (positive weight). Detailed/legible image that invites a tap. Don't use a generic stock photo.
- **Original with video** — must be ≥ 10–15 seconds with audio (Grok transcribes via ASR). Under that threshold the VQV weight zeroes out. Use for product demos, walkthroughs, hot takes.
- **Quote-tweet** — counts as an original post for the algorithm. Activates 3 extra positive weights (quote_score, quoted_click, quoted_vqv). But inherits the quoted post's BrandSafetyVerdict — never quote NSFW/violent/MediumRisk content or accounts with mass blocks.
- **Reply (to a large account)** — goes through the Reply Ranker (0–3 score). Only worth doing with substance. Skip for reach goals — replies don't enter the OON pipeline.

**Threads** are a special case: write a single banger tweet first. If the user insists on a thread, design tweet 1 as if it must stand alone (because for most viewers, it will — DedupConversationFilter keeps only the highest-scored tweet per conversation in any feed).

### Step 3: Draft using the post structure

The structure that maximizes signal stacking:

```
[Line 1: HOOK — contrarian fact, surprising number, or claim that
 stops the scroll. Decides not_dwelled vs dwell on the spot.]

[Line 2: STAKE — concrete claim with a number, a stake, or a promise.
 Retains the reader who passed the hook.]

[Body: 3–8 short paragraphs (1–3 sentences each), packed with substance.
 Concrete data, examples, or numbered points. No filler. Each paragraph
 should breathe — short line breaks, not walls of text.]

[Optional: 1 image OR 1 video ≥10s with audio. Not both.]

[Closing: REPLY BAIT — a direct question, a polarizing-but-tactful
 take, or "what's your experience?" invitation. Triggers reply_score.]

[Optional, only if it adds value: 1–2 relevant hashtags that match
 a topic the system recognizes (see Topics section in references).
 OR 1 link at the very end — never as a substitute for content.]
```

**Length guidance:** Long-form (1500–4000 characters) generally wins on dwell when the content has substance. Short punchy posts (under 280 chars) work for high-virality memes/hot takes when the line itself is the whole payoff. Don't write medium-length flat posts — they lose on both axes.

### Step 4: Audit against the 5 negative signals before publishing

Walk through each before delivering. If any fires, rewrite.

| Signal | Failure pattern | Fix |
|---|---|---|
| `not_dwelled` | Weak opening line, clickbait without payoff, ambiguous first 5 words | Rewrite line 1 with a concrete claim, surprising number, or contrarian take |
| `not_interested` | Off-topic vs the author's usual niche, wrong topic tagging | Match the author's known niche; if pivoting, do it gradually |
| `block_author` | Personal attacks, slurs, aggression | Remove all of it. Polarizing ≠ aggressive |
| `mute_author` | Same topic spammed repeatedly, posting too often | Space posts (Author Diversity Decay), vary angles |
| `report` | Untagged NSFW, hate speech, illegal content, self-harm content | Don't. The 7 PToS categories will lock you to MediumRisk |

### Step 5: Apply the launch playbook (deliver this with the tweet)

When delivering the tweet, **always include the launch plan**. The tweet body alone is only half the work — the first 30 minutes decide whether it ever enters broad discovery.

```
LAUNCH PLAN
-----------
- Optimal time: [prime time of TARGET AUDIENCE, not author's local time]
  · For US audience: 8–11am ET or 6–9pm ET
  · For India audience: 9–11am or 7–10pm IST
  · For EU audience: 9–11am or 6–9pm CET
- Minute 0: publish
- Minute 0–5: notify 5–10 people in close network (DM or private community).
  Ask them to engage organically — like, reply, quote. NOT pre-written
  text. Authentic replies count more.
- Minute 5–15: reply with substance to every comment. Replies from
  the post author skip the spam classifier and inflate reply_count.
- Minute 15–30: monitor. If not crossing min-traction by minute 30,
  the post is dead for OON discovery. Accept and move on.
- Next 4–6 hours: DO NOT publish anything else. Author Diversity Decay
  will demote any second post in the same feed.
- 0–12 hour window: most discovery happens here. By 24h you're in a
  worse age bucket. By 80h the post is dead.
```

Adapt this plan to context — if the user only asked for the tweet text, give the plan as a short follow-up section. If they're doing an account audit or campaign, expand it.

---

## Format conventions

When delivering tweets to the user:

- Put the tweet text in a fenced code block so it copies cleanly without markdown rendering.
- Below the code block, give a brief rationale (2–4 bullets) explaining the algorithmic choices: which positive signals it targets, which negative ones it avoids, and why the format fits the goal.
- Then the launch plan (collapsed or expanded depending on whether the user asked for it).
- If you produced multiple variants, label them A/B/C with one-line goal descriptions ("A: max reach via contrarian hook", "B: max replies via direct question", "C: max follower-growth via niche POV").

**Example delivery:**

````
```
xAI published the X algorithm and almost nobody has read it.

I spent the weekend in 207 files. Three things in there contradict
what growth gurus have been saying for two years:

1. There's a literal Kafka topic that decides if your post enters
the Grok pipeline based on engagement in the first minutes. Without
early traction, the algorithm doesn't even look at it.

2. Your location doesn't matter to the model. Your time zone does.
Posting at 10am Madrid for a US audience = your post ages 6 hours
before they wake up.

3. Dwell time weighs ~5x more than likes. There are 5 different
reading-time signals and only 1 favorite signal. A post with few
likes but high dwell beats a post with many likes and low dwell.

Which one surprised you the most?
```

**Why this tweet:**
- Hook (line 1) sets up payoff before the reader can scroll → defeats not_dwelled
- 3 concrete claims with numbers (207 files, 6 hours, 5 signals) → drives dwell_time and quote_score (citable)
- Closing question is direct → triggers reply_score
- No link, no hashtags, no mentions → density is the entire value prop

**Launch plan:** [as above]
````

---

## Edge cases and special situations

### "Write a thread on X"
Push back gently: a thread is multiple original tweets, and the algorithm will only show one per viewer (DedupConversationFilter). Offer two options: (a) one long-form single tweet with all the content, or (b) a thread where tweet 1 is designed to stand alone as the banger, and the rest are bonus for the small subset that taps in. Default to (a) unless the user explicitly wants (b).

### "Repost / recycle my old tweet"
Don't suggest reposting the same text — PreviouslySeenPostsFilter and PreviouslyServedPostsFilter discard it for anyone who already saw it. Offer: (a) self-quote with new context added, or (b) rewrite with a fresh angle. Note that self-quote pays the Author Diversity Decay cost if the original is still in the feed.

### "Reply to [big account]'s tweet"
You're in Reply Ranker territory (0–3 score). Generic ("First!", "100% agree", "🔥🔥") gets 0–1 and is buried. Substantive replies that add info, give a different angle, or are funny-with-context climb to 2–3. Write the reply as if it has to stand on its own — because the visible-rank position is the entire payoff.

### "Quote-tweet this viral post"
Before drafting, do a sanity check on the quoted post:
- Is it a healthy account with no obvious controversy? → safe to quote, you get 3 extra positive weights
- Does it look NSFW, violent, or close to PToS lines? → DON'T. Your quote inherits MediumRisk
- Is the author known for mass-blocking? → expect cut reach via AuthorSocialgraphFilter
If the user wants to quote a problematic post, flag the risk and suggest a regular original post that references the topic instead.

### "Post about [niche/controversial topic]"
Two layers to consider:
1. **PToS categories** (the hard floor): violence, untagged NSFW, hate, spam, illegal, violent speech, self-harm. If the topic touches these, the post goes MediumRisk → no adjacent ads → structural downrank. Either pull back or warn the user explicitly.
2. **Polarizing-but-safe** is fine and even rewarded (reply_score loves polarization). The line is: strong opinion ✓, attack on a person/group ✗.

### "Write a tweet from my new account"
New users (young account + ≥ NEW_USER_MIN_FOLLOWING) get a much higher OON multiplier — they're discoverable by other new users via NEW_USER_OON_WEIGHT_FACTOR. Lean into that: produce high-quality posts in a clearly tagged niche, since the system pushes OON content to new users so they can discover accounts.

### "My account isn't getting reach lately"
Probable causes, in order: (1) you've been hitting `not_dwelled` / `not_interested` enough that the author-embedding is "poisoned" (~6–16 weeks to recover with clean engagement); (2) recent posts haven't crossed min-traction so the Grok pipeline isn't processing you; (3) you've crossed into LowRisk/MediumRisk via a PToS-adjacent post; (4) you've been posting too frequently and Author Diversity Decay is compounding. Diagnose, then prescribe accordingly — see `references/x-algo-insights.md` section 26 for the full diagnostic tree.

### "Make this go viral"
There's no virality button, but the closest is: **maximize the probability that the average reader does at least 2 different positive actions** (dwell + reply, dwell + quote, dwell + follow, dwell + share). The model combines 17 positive signals; each additional action multiplies your score. Write something that's both interesting enough to retain (dwell) AND has a clear reaction trigger (reply or quote bait).

---

## What to avoid (the absolute-no list)

These will tank reach and the user should know if they're asking for one:

1. **Posting from a protected account** — no embedding, no OON retrieval. Tell the user to switch to public.
2. **Pure AI slop** — `slop_score` is an explicit model metric. Generated text with no editing pattern-matches as slop. Always rewrite human.
3. **Untagged NSFW / violence / hate** — MediumRisk verdict, no adjacent ads, structural downrank.
4. **10+ tweet megathreads as a reach strategy** — only one survives DedupConversationFilter per viewer.
5. **Reposting the same text** — bloom-filter dedup discards it for prior viewers.
6. **Quoting an account that blocked you (or that you blocked)** — AuthorSocialgraphFilter eliminates the whole chain.
7. **Generic replies to large accounts** ("first!", "🔥🔥", "100% agree") — Reply Ranker scores you 0–1 and buries you.
8. **Spam-replying small accounts with mentions** — `SpamEapiLowFollowerClassifier` labels the reply, leaves a trace.
9. **Burst of 5 posts in 10 minutes** — Author Diversity Decay destroys you from post 2 onward.
10. **Videos under ~10 seconds** — VQV weight zeroes out even if retention is 100%.
11. **Link-only posts with no body substance** — likely depresses dwell; possibly hit by unpublished Banger Screen prompts.
12. **Posting at your local peak when the audience is in another timezone** — AgeFilter ages the post out before they're awake.

---

## When to read references/x-algo-insights.md

Read the full reference doc when:
- The user asks why a specific recommendation exists ("why no link?", "why 10 seconds for video?")
- The user wants to game a specific mechanism (e.g., the min-traction gate, OON factor for new users)
- The user is doing an account audit and wants the full diagnostic tree for low reach
- You hit a case this SKILL.md doesn't cover (e.g., questions about ads adjacency, brand safety verdicts, BotMaker shadowbans)
- The user wants exact source citations

The reference doc is the full source-code analysis with line-level citations to the xAI repo. It's the ground truth for any claim about how the algorithm works. When citing it, mention the section number for the user's convenience.

---

## Voice and tone defaults

Unless the user specifies otherwise:
- **Direct, no fluff** — the algorithm rewards substance per second of reading
- **Confident claims with concrete numbers** — citable phrasing drives quote_score
- **Short paragraphs** — 1–3 sentences each, breathing room between
- **Lowercase ok, selective capitals for emphasis** — modern X norm, not LinkedIn formality
- **No emojis unless the user uses them first** — emoji-heavy posts pattern-match as slop
- **Active voice, present tense** — punchier on small screens

If the user has a known voice (e.g., they're a specific creator with samples in prior turns or in the conversation), match that voice while keeping the algorithmic structure underneath. Voice is the wrapper; structure is the skeleton.
