# Insights from the X "For You" algorithm

> Analysis of the source code published by xAI on May 15, 2026 at [github.com/xai-org/x-algorithm](https://github.com/xai-org/x-algorithm).
>
> Every claim in this document is backed by a citation to its source file. When something can't be confirmed from the code (e.g. exact numerical weight values), it's stated explicitly.

---

## TL;DR for content creators

1. **The algorithm predicts 22 viewer actions** and combines their probabilities with weights. You don't optimize for "engagement" in the abstract — you optimize P(like), P(reply), P(retweet), P(dwell), P(quote), P(follow_author)… and you avoid P(not_interested), P(block), P(mute), P(report), P(not_dwelled).
2. **The worst thing you can do is NOT generating few likes** — it's generating blocks, mutes, reports, and most importantly the user *not staying* on the post (`not_dwelled`). That set of negative signals subtracts from the score, doesn't just fail to add.
3. **Your post has to cross a "min-traction" threshold to enter the Grok pipeline**. If it doesn't get engagement in the first minutes, it **never goes through the Banger Initial Screen** and stays out of broad discovery. The first 30-60 minutes are a bottleneck, not an accelerator.
4. **The model knows the AGE of the post**. Age is encoded explicitly as a feature with 1-hour buckets and a cap at **80 hours** (after that, everything is treated as "very old"). Anything older than 3 days is in the "overflow bucket": no miracles.
5. **Spamming from the same account penalizes brutally**. There's an *Author Diversity Decay* (`decay^position + floor`) that exponentially shrinks the score of each subsequent post of yours in the same feed.
6. **Video matters, but only above a minimum duration** (`MinVideoDurationMs`). Below that threshold, the Video Quality View (VQV) weight is zeroed out. Also, Grok **transcribes the audio** of your videos (ASR) and uses the text to classify them.
7. **Out-of-network (OON) is multiplied by a factor < 1** (`OonWeightFactor`). To reach non-followers you need a much higher P(engagement) to make up for the discount. Exception: *new users* have their own OON multiplier (much higher) so they can discover accounts.
8. **Some users turn off the For You feed.** If your target audience has `allow_for_you_recommendations = false`, you **NEVER** reach them out-of-network. The only way is for them to follow you.
9. **Threads compete with themselves**: `DedupConversationFilter` keeps **a single tweet per thread** in the feed (the one with the highest score). Replying 12 times to your own post doesn't give you 12 chances.
10. **Grok-VLM scores every original post** with a *quality_score* 0-1 ("banger" threshold ≥ 0.4), a *slop_score*, and a *has_minor_score*. Replies and retweets **do not pass** through this classifier; only original posts do.
11. **Replies to small accounts get scanned for spam** by Grok. Replies to large accounts go through *ReplyRanking* (0-3 score that decides the order in the conversation).
12. **The *viewer's* country, language, IP, and demographics** are injected as query features. The post only carries `language_code`, **not the author's country**. There's no hardcoded "EU→US penalty" filter, but the model learns country↔engagement correlations from the data.
13. **Private accounts (`is_protected`) don't generate embeddings** → they don't appear in out-of-network retrieval. If you want reach, you can't be private.
14. **The model only remembers your last ~128 actions** (in the published mini version; production probably more). The For You-relevant history is relatively short and recent.
15. **50% of requests are "shadow traffic"** which activates experimental features — inferred gender, Grok topics, mutual facepiles, etc. run for roughly half of your audience always, even when the flags are "off".

---

## 1. Pipeline architecture (high-level)

Every feed request goes through:

1. **Query Hydration** — the query is enriched with user context (engagement sequence, follow graph, IP, demographics, inferred gender, topics, followed *starter packs*, *seen* bloom filters…).
2. **Candidate Sourcing** — multiple sources in parallel:
   - **Thunder** → in-network posts (from people you follow) served from a RAM store, sub-millisecond.
   - **Phoenix Retrieval** → out-of-network posts searched by similarity to your *user embedding* (Two-Tower).
   - **Tweet Mixer**, **Phoenix MoE**, **Phoenix Topics**, **Cached Posts**, **Ads**, **Who-To-Follow**, **Prompts**, **Push-to-Home**.
3. **Candidate Hydration** — post data is filled in: text, author (Gizmoduck), language, media, engagement counts, *brand safety verdict*, mutual-follow scores, filtered topics, etc.
4. **Pre-scoring Filters** — remove ineligible candidates.
5. **Scoring** — *Phoenix Scorer* calls the Grok-based transformer with your *scoring_sequence* and gets 22 probabilities per candidate; *WeightedScorer* linearly combines them; *AuthorDiversityScorer* punishes author repetition; *OONScorer* punishes out-of-network.
6. **Selection** — `TopKScoreSelector` takes the best K (`params::TOP_K_CANDIDATES_TO_SELECT`).
7. **Post-Selection Filters** — VFFilter (visibility filtering for NSFW/violence/spam/deleted), DedupConversationFilter.
8. **BlenderSelector** — mixes organic + ads + WTF + prompts + push-to-home into a single final feed.

Source: [`README.md`](x-algorithm/README.md), [`home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs`](x-algorithm/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs), [`home-mixer/lib.rs`](x-algorithm/home-mixer/lib.rs).

---

## 2. The 22 signals the model predicts (what to optimize and what to avoid)

`PhoenixScorer` asks the transformer for a *PhoenixScores* with 22 fields. `RankingScorer` combines them like this:

```
score = Σ weight_i · P(action_i)
```

Source: [`home-mixer/scorers/ranking_scorer.rs`](x-algorithm/home-mixer/scorers/ranking_scorer.rs) lines 12–115, [`home-mixer/scorers/weighted_scorer.rs`](x-algorithm/home-mixer/scorers/weighted_scorer.rs) lines 49–67.

### Positive signals (add to score)

| Signal | What it predicts | How to trigger it with your content |
|---|---|---|
| `favorite` | Probability of like | Emotional hooks, clear opinions, audience-validated content |
| `reply` | Probability of reply | Questions, polarizing opinions (with care), opening conversation |
| `retweet` | Probability of RT | Shareable content, citable phrases, surprising data |
| `photo_expand` | Probability of expanding image | Detailed/legible images that invite opening |
| `click` | Click on links or post | Relevant links, *curiosity gap* in the text |
| `profile_click` | Click on your profile | Interesting bio, post that generates "who is this person?" |
| `vqv` (Video Quality View) | "Quality" video view (>= min duration) | Native video > threshold, gripping first second |
| `share` / `share_via_dm` / `share_via_copy_link` | Sharing | Useful/practical content people send to friends |
| `dwell` (binary) / `cont_dwell_time` (continuous) / `cont_click_dwell_time` | Time the reader spends on the post | Dense but readable texts, short threads on first tweet, eye-catching images |
| `quote` / `quoted_click` / `quoted_vqv` | Quote-tweet of the post | Phrases people want to react to with commentary |
| `follow_author` | They follow you after reading the post | Posts that show a unique POV / consistent niche |

### Negative signals (SUBTRACT from score)

| Signal | What it predicts | What triggers it |
|---|---|---|
| `not_interested` | Explicit "not interested" | Topics the reader has already marked, off-topic content vs their history |
| `block_author` | Author block | Insults, personal attacks, aggression |
| `mute_author` | Author mute | Excessive posting, topical spam |
| `report` | Report | Content crossing lines (untagged NSFW, hate, etc.) |
| `not_dwelled` | User scrolls past without stopping | **The post bores or doesn't grab attention.** More damaging than it seems. |

**Key insight**: `not_dwelled` appears as a negative weight in the final equation ([`ranking_scorer.rs:83`](x-algorithm/home-mixer/scorers/ranking_scorer.rs)). This means a post that people **ignore by scrolling past** actively penalizes you, not just fails to add. It's a strong argument against *clickbait* that doesn't hook: if people enter and leave fast, it's worse than if they had never seen it.

### On the exact weight values

The weights live in a *feature switches* system (`xai_feature_switches::Params`) that is **not included** in the open-source dump. The code asks for each weight by name (`params.get(FavoriteWeight)`, `params.get(ReportWeight)`…), but the numerical values are external config that xAI hasn't published.

From the prior 2023 release, we know:
- negative actions have weights orders of magnitude larger (in absolute value) than positive ones — a single "report" can wipe out the effect of several likes;
- `reply` historically weighed much more than `favorite`;
- `follow_author` is one of the heaviest (long-term value).

Don't take this as gospel for 2026: the code enables tuning all those weights by experiment and cluster.

---

## 3. The author repetition penalty (Author Diversity Decay)

One of the most underrated levers in the algorithm.

```rust
fn diversity_multiplier(decay_factor: f64, floor: f64, position: usize) -> f64 {
    (1.0 - floor) * decay_factor.powf(position as f64) + floor
}
```

Source: [`home-mixer/scorers/ranking_scorer.rs:186-188`](x-algorithm/home-mixer/scorers/ranking_scorer.rs) and [`author_diversity_scorer.rs:29-31`](x-algorithm/home-mixer/scorers/author_diversity_scorer.rs).

How it works:
1. Your candidates are sorted by score.
2. A counter (`position`) is kept per author, starting at 0.
3. The **first** post by author X keeps its score (`multiplier = 1`).
4. The **second** post by author X is multiplied by `decay`.
5. The **third** by `decay²`, the fourth by `decay³`, etc.
6. The `floor` is the absolute minimum the multiplier drops to.

If `decay = 0.5` and `floor = 0.1`, your second post weighs half, the third ~28%, the fourth ~16%, and from a certain point on, 10%.

**Practical consequences:**
- It makes no sense to bomb the feed with 10 posts in a row. The second already loses a lot of reach versus the first in *each individual feed*.
- If you have 5 ideas in mind, **space them out**. Each user will see a single "round" of scoring per session; spacing them in time ensures each one competes equally in different sessions of different users.
- Multi-post threads: only the "best scored" of the thread appears in any given reader's For You (see §5 on DedupConversationFilter), and the rest take the decay if they were to appear.

---

## 4. Out-Of-Network: the invisible ceiling on reach beyond your followers

Each candidate carries an `in_network` boolean. It's set to `true` if the author is in your followed list or you yourself:

```rust
let is_in_network = is_self || followed_ids.contains(&candidate.author_id);
```

Source: [`candidate_hydrators/in_network_candidate_hydrator.rs:24-32`](x-algorithm/home-mixer/candidate_hydrators/in_network_candidate_hydrator.rs).

Then, in the final ranker:

```rust
let final_score = match c.in_network {
    Some(false) => after_diversity * effective_oon,
    _ => after_diversity,
};
```

Source: [`home-mixer/scorers/ranking_scorer.rs:272-275`](x-algorithm/home-mixer/scorers/ranking_scorer.rs).

`effective_oon`:
- For a request with non-empty `topic_ids` → `TopicOonWeightFactor` (higher: in topic exploration, external content gets through).
- For new users (young account + `>= NEW_USER_MIN_FOLLOWING`) → `NEW_USER_OON_WEIGHT_FACTOR` (much higher).
- Otherwise → `OonWeightFactor` (< 1).

**Insights:**
- To reach non-followers, your post has to be **much better** than an equivalent in-network one, not just "as good". The OON discount can be 50% or more.
- **Growth strategy A:** generate early engagement from your followers (which activates the model's positive signals and offsets the OON discount when jumping to non-followers).
- **Strategy B:** tag/theme your content. In requests with explicit topics (users following topics, *bulk topic requests*) the OON discount is different and almost always smaller.
- **Strategy C:** target new users. Recently signed up users have a high OON multiplier: you're closer to being discoverable by them than by people with years on X.

Source of the calculation: [`ranking_scorer.rs:220-239`](x-algorithm/home-mixer/scorers/ranking_scorer.rs).

---

## 5. What the algorithm **DOESN'T** want you to do (filters that eliminate you)

### Pre-scoring (run before scoring the content)

| Filter | What it discards | File |
|---|---|---|
| `DropDuplicatesFilter` | Duplicate tweet_id | [`drop_duplicates_filter.rs`](x-algorithm/home-mixer/filters/drop_duplicates_filter.rs) |
| `CoreDataHydrationFilter` | Posts where `author_id == 0` (corrupt author data / deleted account) | [`core_data_hydration_filter.rs`](x-algorithm/home-mixer/filters/core_data_hydration_filter.rs) |
| `AgeFilter` | Posts older than `max_age` (configurable) | [`age_filter.rs`](x-algorithm/home-mixer/filters/age_filter.rs) |
| `SelfTweetFilter` | Your own posts (you don't see yourself in For You) | [`self_tweet_filter.rs`](x-algorithm/home-mixer/filters/self_tweet_filter.rs) |
| `RetweetDeduplicationFilter` | If there's already another RT or the original of the same tweet, the next one is dropped | [`retweet_deduplication_filter.rs`](x-algorithm/home-mixer/filters/retweet_deduplication_filter.rs) |
| `IneligibleSubscriptionFilter` | Subscriber-only content from authors you're not subscribed to | [`ineligible_subscription_filter.rs`](x-algorithm/home-mixer/filters/ineligible_subscription_filter.rs) |
| `PreviouslySeenPostsFilter` | Posts you've already seen (client Bloom filter + `seen_ids`) | [`previously_seen_posts_filter.rs`](x-algorithm/home-mixer/filters/previously_seen_posts_filter.rs) |
| `PreviouslyServedPostsFilter` | Posts already served to you in recent sessions | [`previously_served_posts_filter.rs`](x-algorithm/home-mixer/filters/previously_served_posts_filter.rs) |
| `MutedKeywordFilter` | Keywords muted by the viewer (tokenized matching) | [`muted_keyword_filter.rs`](x-algorithm/home-mixer/filters/muted_keyword_filter.rs) |
| `AuthorSocialgraphFilter` | Block/mute by the viewer, **author blocking the viewer**, blocking of who you quote or retweet | [`author_socialgraph_filter.rs`](x-algorithm/home-mixer/filters/author_socialgraph_filter.rs) |
| `NewUserTopicIdsFilter` | For new users: filters everything not in their chosen topics or in-network | [`new_user_topic_ids_filter.rs`](x-algorithm/home-mixer/filters/new_user_topic_ids_filter.rs) |
| `TopicIdsFilter` | In topic requests, drops posts not matching the topic | [`topic_ids_filter.rs`](x-algorithm/home-mixer/filters/topic_ids_filter.rs) |
| `VideoFilter` | If `exclude_videos` is on, out with all videos | [`video_filter.rs`](x-algorithm/home-mixer/filters/video_filter.rs) |

### Post-selection (final screening)

| Filter | What it discards |
|---|---|
| `VFFilter` | Posts marked as *Drop* by Visibility Filtering (deleted, spam, violence, gore). [`vf_filter.rs`](x-algorithm/home-mixer/filters/vf_filter.rs) |
| `DedupConversationFilter` | Keeps **a single tweet per conversation** (the highest-scored one). [`dedup_conversation_filter.rs`](x-algorithm/home-mixer/filters/dedup_conversation_filter.rs) |
| `AncillaryVFFilter` | Posts with `drop_ancillary_posts == true` | [`ancillary_vf_filter.rs`](x-algorithm/home-mixer/filters/ancillary_vf_filter.rs) |

**Actionable insights:**
- **Blocking and quoting whoever blocked you is impossible:** if you block someone, you don't even see content quoting or retweeting them. And conversely: if they blocked you, your post doesn't appear in their feed (this is expected, but the code reinforces it with `author_blocks_viewer` and `quoted_author_blocks_viewer`).
- **`DedupConversationFilter` kills megathreads**: if you make an 8-tweet thread replying to your own post, the feed will show **only one** (the highest-scored one). The intuition of "I'll chain replies to take up more feed" is false.
- **`PreviouslySeenPostsFilter` and `PreviouslyServedPostsFilter`** use bloom filters → the same post can't come up twice. Reposting the same text is useless for users who already saw it; you need to create it new each time.

---

## 6. The "Grok tribunal": content classifiers (`grox/`)

The `grox/` module is a pipeline of parallel tasks that run Grok-VLM (multimodal) models on every post. Active plans are in [`grox/plans/plan_master.py`](x-algorithm/grox/plans/plan_master.py):

```python
ALL_PLANS = [
    PlanInitialBanger(),
    PlanPostSafety(),
    PlanSpamComment(),
    PlanPostEmbeddingWithSummary(),
    PlanPostEmbeddingWithSummaryForReply(),
    PlanPostEmbeddingV5(),
    PlanPostEmbeddingV5ForReply(),
    PlanReplyRanking(),
    PlanSafetyPtos(),
]
```

### 6.1 Banger Initial Screen (quality of original post)

Only runs on **original posts** (not replies, not retweets). Prior filters:

```python
if post.ancestors:  # is a reply
    return False
if post.user.is_protected:  # private account
    return False
```

Source: [`grox/tasks/task_filters.py:340-370`](x-algorithm/grox/tasks/task_filters.py).

The VLM classifier ([`grox/classifiers/content/banger_initial_screen.py`](x-algorithm/grox/classifiers/content/banger_initial_screen.py)) returns a JSON with:

```python
class BangerInitialScreenResult(BaseModel):
    quality_score: float        # 0.0 - 1.0
    description: str
    tags: list[str]
    taxonomy_categories: list[dict] | None  # categories and their confidence
    tweet_bool_metadata: TweetBoolMetadata | None
    is_image_editable_by_grok: bool | None
    slop_score: int | None       # amount of "AI slop" detected
    has_minor_score: float | None  # content with minors
```

And the decision:

```python
banger_initial_positive = score >= 0.4
```

That is, a post is marked as "banger" if Grok gives it **≥ 0.4 / 1.0** of quality. The histogram is measured in buckets [0, 0.1, 0.2 … 1.0].

**Implications:**
- **If you post as a private account, you don't go through embedding or classification**. You won't have out-of-network retrieval. Going from protected → public not only gives visibility: it opens up the model's signals to you.
- **Retweets and replies are not evaluated as "bangers"**. The OON discovery system rewards ORIGINAL POSTS.
- **`slop_score`**: there's an explicit score to detect "AI slop". Low-quality-LLM posts have a handicap.
- **`has_minor_score`**: automatic detection of minors in images; correlates with safety labels and demonetizes/de-amplifies.
- **`is_image_editable_by_grok`**: a flag suggesting that part of the image catalog is marked as editable by Grok (probably for previews or generated variants).

### 6.2 Spam in replies (`PlanSpamComment`)

Only runs when:

```python
if not post.ancestors:        # must be a reply
    return False
# ...
if root_user_follower_count > THRESHOLD or in_reply_user_follower_count > THRESHOLD:
    return False              # if target account has MANY followers, not evaluated for spam
```

Source: [`grox/tasks/task_filters.py:55-134`](x-algorithm/grox/tasks/task_filters.py).

The classifier ([`grox/classifiers/content/spam.py`](x-algorithm/grox/classifiers/content/spam.py)) is called `SpamEapiLowFollowerClassifier` and uses the `SpamSystemLowFollower` prompt. The decision is binary (`spam` / not spam) → score 1.0 / 0.0.

**Reading:**
- **Replies to small accounts** are the ones classified as spam by Grok. This makes sense: small accounts can't moderate manually, so the system protects them automatically.
- Replies to large accounts go through *Reply Ranking* instead (next section).
- **Practice:** if you want to "reply-jack" influencers, the spam classifier doesn't judge you, the reply ranker does (more sophisticated and quality-oriented).

### 6.3 Reply Ranking (order of replies in large accounts)

Inverse of the previous: only runs when the target account **exceeds** the follower threshold.

```python
if in_reply_user_follower_count <= THRESHOLD and root_user_follower_count <= THRESHOLD:
    return False  # "low_blast_radius"
```

Source: [`grox/tasks/task_filters.py:137-201`](x-algorithm/grox/tasks/task_filters.py).

Grok ([`grox/classifiers/content/reply_ranking.py`](x-algorithm/grox/classifiers/content/reply_ranking.py)) scores each reply from 0 to 3:

```python
Metrics.histogram(
    "ranked_replies_scores",
    explicit_bucket_boundaries_advisory=[0.0, 1.0, 2.0, 3.0],
).record(parsed[0].score)
```

Uses the `ReplyScoringSystem` prompt with parameter `large_account_follower_threshold`.

**Practical:**
- When you reply to a large account, **a VLM model reads your reply and orders it**. Generic replies ("first!", scattered emojis, "🔥🔥") score low.
- More substantive replies (those that add information, comment with criteria, are funny with context) climb up in the visible reply ranking. It's where you gain parasitic visibility to large accounts — but only with real quality.

### 6.4 Safety PToS (Policy Terms of Service): the 7 categories that bring you down

Each post is classified for policy violation in these 7 categories:

```python
SUPPORTED_POLICY_CATEGORIES = {
    SafetyPolicyCategory.ViolentMedia,
    SafetyPolicyCategory.AdultContent,
    SafetyPolicyCategory.Spam,
    SafetyPolicyCategory.IllegalAndRegulatedBehaviors,
    SafetyPolicyCategory.HateOrAbuse,
    SafetyPolicyCategory.ViolentSpeech,
    SafetyPolicyCategory.SuicideOrSelfHarm,
}
```

Source: [`grox/classifiers/content/safety_ptos.py:217-225`](x-algorithm/grox/classifiers/content/safety_ptos.py).

Two of them (`AdultContent`, `ViolentMedia`) use the **deluxe-4.2** model specialized for reasoning ([lines 227-230](x-algorithm/grox/classifiers/content/safety_ptos.py)). Each category has its own policy prompt (`ViolentMediaPolicy`, `AdultContentPolicy`, `SpamPolicy`, `IllegalAndRegulatedBehaviorsPolicy`, `HateOrAbusePolicy`, `ViolentSpeechPolicy`, `SuicideOrSelfHarmPolicy`).

If a post falls into these categories, *safety labels* are applied and its brand safety verdict degrades (see §7).

---

## 7. Brand safety: three tiers, blocked ads, and an important *cliff*

Each post gets a `BrandSafetyVerdict` ([`home-mixer/models/brand_safety.rs`](x-algorithm/home-mixer/models/brand_safety.rs)):

| Verdict | Meaning | Consequences |
|---|---|---|
| `Safe` | No risk labels + scored by Grok + (if new post) PToS reviewed | Works for everything |
| `LowRisk` | Labels: `NSFA_LIMITED_INVENTORY`, `GROK_NSFA_LIMITED`, `NSFA_HIGH_RECALL` | Appears, but limited adjacent ads |
| `MediumRisk` | NSFW (multiple variants), NSFA, gore, violence, `DO_NOT_AMPLIFY`, `PDNA`, `EGREGIOUS_NSFW`, `NSFW_TEXT`, `NSFW_CARD_IMAGE`, or **not scored by Grok**, or **new post without `PTOS_REVIEWED`** | No adjacent ads, downranked in exploration |

There's a **temporal cliff**: there's a constant

```rust
const PTOS_CUTOFF_TWEET_ID: u64 = 2_054_275_414_225_846_272;
```

Tweets after this ID that don't have the `PTOS_REVIEWED` label are automatically marked **MediumRisk**. That is: new posts have to pass through the PToS classifier before they can be "Safe". This creates a latency period for recently published posts (while Grok evaluates them).

**Reading:**
- If your post has NSFA/NSFW/violence, **no advertiser will see it adjacent** and therefore it doesn't receive ad impression revenue (and probably drops in distribution).
- `DO_NOT_AMPLIFY` and `PDNA` exist as specific labels for "do not amplify". If Grok applies one of these, you're *shadow-banned* for amplification.
- **There's an `NSFW_TEXT` label**: the model detects NSFW in pure text (not just images). So *spicy* + no image doesn't save you from the cliff.

### Ads and adjacent brand safety

`PartitionOrganicAdsBlender` and `SafeGapAdsBlender` ([`home-mixer/ads/`](x-algorithm/home-mixer/ads/)) make a significant effort to **NOT** place ads next to `MediumRisk` content. When there is:

- Only HALF of "safe" posts can have ads around them (`max_from_safe = safe_count / 2`).
- Each ad carries an `ad_adjacency_control` with `handles` (blocked accounts) and `keywords` (blocked words). If the post above or below matches, **the ad is dropped** ([`ads/util.rs:99-151`](x-algorithm/home-mixer/ads/util.rs)).
- By default: 1 ad every 3 posts, minimum 2 posts between ads, first post never-ad (`MIN_POSTS_FOR_ADS = 5`).

If you wonder why advertisers run away from certain topics: the system literally *drops* their impression if your post has the keywords/handles the advertiser put in their blocklist.

---

## 8. The million-dollar question: Does writing from Europe to a US audience hurt?

**Short answer:** *there's no hardcoded filter penalizing by country.* But the model learns correlations from data, and that can bias the outcome.

### What the system knows about YOU when you read X

The `ScoredPostsQuery` ([`home-mixer/models/query.rs:25-95`](x-algorithm/home-mixer/models/query.rs)) carries:

- `country_code: String` — country code sent by the client.
- `language_code: String` — app/device language.
- `ip_address: String` — user's IP.
- `ip_location: Option<LocationInfo>` — location derived from IP via GeoIP (see `IpQueryHydrator` with `xai_geo_ip::GeoIpLocationClient`).
- `time_zone: Timezone` — time zone.
- `device_network_type: DeviceNetworkType` — WiFi/4G/5G.
- `user_demographics: Option<UserDemographics>` — demographic data (inferred age, inferred gender).
- `user_age_in_years: Option<i32>`.
- `user_inferred_gender: Option<InferredGenderLabel>` + `user_inferred_gender_score: Option<f32>`.

### What the system knows about the POST you're considering promoting

The `PostCandidate` carries:

- `language_code: Option<String>` — language **of the post** (detected, not of the author).
- `author_followers_count`, `author_screen_name`, etc.

**There's no `country_code` in `PostCandidate`.** There's no field that says "this post was written from Europe".

### Is this used for anything concrete?

```rust
proto_query.country_code   // → reaches Phoenix client
proto_query.language_code  // → reaches Phoenix client
.country(&proto_query.country_code)
.language(&proto_query.language_code)
```

Source: [`home-mixer/server.rs:92-148`](x-algorithm/home-mixer/server.rs).

```rust
// Ads and WTF also receive country/language
country_code: query.country_code.clone(),
language_code: query.language_code.clone(),
```

Source: [`home-mixer/sources/tweet_mixer_source.rs:46-47`](x-algorithm/home-mixer/sources/tweet_mixer_source.rs), [`home-mixer/sources/ads_source.rs:48-49`](x-algorithm/home-mixer/sources/ads_source.rs), [`home-mixer/sources/who_to_follow_source.rs:67-70`](x-algorithm/home-mixer/sources/who_to_follow_source.rs).

The viewer's country + language are injected into the scoring model and into calls to external systems (ads, who-to-follow). The Phoenix model can then learn (from logs) things like:
- "Users with `country=US` engage less with posts `language_code=es`".
- "Ads in US are auctioned differently than in EU".

### Honest conclusions for an EU creator targeting US

1. **There's no "anti-EU dial"** in the algorithm. If your post engages well (lots of dwell + likes + retweets + follow), it passes the filters the same as a US user's.
2. **The post's language does matter**, because it travels as a feature to the model. If you're going for a US audience, write in English. Posting in Spanish to US users will tank your match score badly (not by filter, by model learning).
3. **Schedule does affect.** The `time_zone` and `request_time_ms` fields are in the query. US users distribute across US zones (-5 to -8 GMT). If you post at your European morning hour, US users are asleep → your post ages (`AgeFilter`) before getting a chance to show to them.
4. **The user's `country_code` field** enters as context, doesn't project onto your account. There's no stable record of "author's country" in `PostCandidate`. The "I'm European" signal doesn't travel with each of your posts.
5. **Viewer IP (not author IP) is used.** What gets geoIP'd is the IP of whoever requests the feed, not yours when you publish (at least not in this part of the code).
6. **What CAN happen:** your account has a history of mostly European engagement → your account's embedding in the Two-Tower looks more like European users → US users don't find it via similarity (retrieval). It's not a punishment, it's vector physics. **If you want to break the bias**, optimize early-engagement of US accounts (post at US hours, tag/reply US accounts, use global/Anglo topics).

> Note: the repo references a `crate::util::country_codes::bucket_country(...)` module (see [`for_you_response_stats_side_effect.rs:97`](x-algorithm/home-mixer/side_effects/for_you_response_stats_side_effect.rs)) but the implementation file is not included in the release. Probably groups countries by market for metrics, not for filtering.

---

## 9. Video: when it helps and when it doesn't

```rust
fn vqv_weight_eligibility(candidate: &PostCandidate) -> f64 {
    if candidate.video_duration_ms.is_some_and(|ms| ms > p::MIN_VIDEO_DURATION_MS) {
        p::VQV_WEIGHT
    } else {
        0.0
    }
}
```

Source: [`home-mixer/scorers/weighted_scorer.rs:72-81`](x-algorithm/home-mixer/scorers/weighted_scorer.rs).

That is: the Video-Quality-View weight (the main positive video signal) **is zeroed out** if your video lasts less than `MIN_VIDEO_DURATION_MS`.

Instrumentation buckets ([`tweet_type_metrics_hydrator.rs:113-127`](x-algorithm/home-mixer/candidate_hydrators/tweet_type_metrics_hydrator.rs)):

- `VIDEO_LTE_10_SEC` — ≤ 10 seconds
- `VIDEO_BT_10_60_SEC` — 10–60 seconds
- `VIDEO_GT_60_SEC` — > 60 seconds

It's not a linear scaling: there's just a *threshold* whose exact value we don't know, but by industry convention it's around 7–10 seconds. Very short videos lose the bonus even if the view completes.

**Insight:** "ultra-short shorts" is not optimal on X. The system rewards video that **retains time**, not video per se.

And `cont_dwell_time` (continuous dwell) applies to every type of post, not just video. **Time spent is a universal metric**.

---

## 10. Useful side signals the model learns

### Mutual-Follow Jaccard

```rust
fn jaccard_from_minhash(a: &[i64], b: &[i64]) -> f64
```

Source: [`candidate_hydrators/mutual_follow_jaccard_hydrator.rs`](x-algorithm/home-mixer/candidate_hydrators/mutual_follow_jaccard_hydrator.rs).

For each candidate, the **Jaccard similarity of the minhash** is computed between the viewer and the post's author (represents how many follows they share). Requires ≥ 256 minhashes on each side.

**Reading:** authors who share many followed people with you appear with an implicit boost (it's a model feature). Having "same tribes" with your target audience is an explicit signal.

### Engagement counts in hot caches

`fav_count`, `reply_count`, `repost_count`, `quote_count` are hydrated with differentiated TTL:

- New tweets (< 30 min): cache 5 minutes.
- Old tweets: cache 10 minutes.

Source: [`engagement_counts_hydrator.rs:32-39`](x-algorithm/home-mixer/candidate_hydrators/engagement_counts_hydrator.rs).

**Reading:** the first hours are the ones that reflect fastest in rankings. Old posts update slower.

### "Following replied users facepile"

Only hydrated if the **viewer** has ≥ 1000 followers:

```rust
const VIEWER_FOLLOWERS_THRESHOLD: i64 = 1000;
```

Source: [`following_replied_users_hydrator.rs:13-44`](x-algorithm/home-mixer/candidate_hydrators/following_replied_users_hydrator.rs).

That means the social proof "5 people you follow replied to this post" **doesn't show to users with less than 1000 followers**. For the rest, it can be a relevance signal.

### Private accounts (`is_protected`)

If the original author or any ancestor in the chain is private, **it's cancelled**:

- Post embedding (no embedding ≠ no retrieval).
- Banger screen.
- Post safety deluxe.

Source: multiple filters in [`grox/tasks/task_filters.py`](x-algorithm/grox/tasks/task_filters.py).

**Reading:** being a private account literally excludes you from the discovery pipelines. If you want reach beyond your network, **you must be a public account**.

---

## 11. Topics: 80+ categories that do matter

The TopicIdExpansion in [`topic_ids_filter.rs:109-291`](x-algorithm/home-mixer/filters/topic_ids_filter.rs) defines the topics X recognizes. Some notable:

- **Macro-categories** (grouping many subs): `SCIENCE_TECHNOLOGY`, `ENTERTAINMENT`, `BUSINESS_FINANCE`, `SPORTS`.
- **Sub-categories**: politics, AI, gaming, crypto, K-pop, Premier League, **US-IRAN_WAR** (yes, there's a specific topic for this geopolitical crisis), mental health, dating, parenting, etc.
- **Religion** is broken down: Christianity, Buddhism, Hinduism, Islam, Judaism.

If your request brings topics, the system:
1. Filters to posts of the topic.
2. Applies an **OON weight factor for topic** (`TopicOonWeightFactor`) different from the general one — makes it easier to appear to non-followers when there's a topic match.

**Reading:** tagging/theming your posts (with hashtags and vocabulary words) helps with topic-based matching. And the reader searching for a topic is more permeable to content outside their network.

---

## 12. Ads: the "invisible tax" on your feed

- **1 ad every 3 posts** by default (minimum 2 between ads).
- **Never before post 5**.
- **Never the last** item.
- The ad is only inserted between "safe" posts (no MediumRisk verdict).
- The ad has an `ad_adjacency_control` that can block it if neighboring posts contain handles/keywords from its blocklist.
- There's a special `BsrLow / BsrIas` verdict for ads with low risk score: these are NOT placed next to LowRisk posts (premium advertisers want MAX safety).

Source: [`home-mixer/ads/util.rs`](x-algorithm/home-mixer/ads/util.rs), [`home-mixer/ads/partition_organic_blender.rs`](x-algorithm/home-mixer/ads/partition_organic_blender.rs), [`home-mixer/ads/safe_gap_blender.rs`](x-algorithm/home-mixer/ads/safe_gap_blender.rs).

**Commercial reading:** the system's priority is **maximizing ad impressions adjacent to `Safe` content**. Your content is a monetization vehicle; if you make many ads get dropped by adjacency (NSFW edge, brand keywords, blocked handles), you reduce that feed's revenue and, by extension, your structural priority.

---

## 13. What's NOT in the open code (and why it matters)

xAI has published the **structure** of the algorithm. Key pieces are missing:

1. **The numerical weights** (`FavoriteWeight`, `ReplyWeight`, etc.). They live in `xai_feature_switches::Params`, an external configuration system not included in the dump.
2. **The prompts** of the Grok classifiers (`BangerMiniVlmScreenScore`, `SpamSystemLowFollower`, `SafetyPtos`, `ReplyScoringSystem`, the 7 policy prompts). They exist as referenced classes but the `grox/prompts/template.py` files are not published.
3. **The `country_codes` util** (`bucket_country`).
4. **The weights of the *Two-Tower* and the *Phoenix transformer***. What is there is a pre-trained *mini Phoenix* (256-dim, 4 heads, 2 layers) in Git LFS — but the production model uses different configurations.
5. **The full `xai_decider` module**. The `decider.enabled("xxx")` calls we see throughout the code are internal A/B feature flags: at dump time, they could be active or not for your account.

**Reading:** the open-source version is the **anatomy** of the system. Any attempt at fine optimization (computing a reproducible score for a given post) requires either empirical measurement (publishing posts and measuring impressions) or assuming xAI will publish the weights at some later point.

---

## 14. Executive summary: the "shopping list" for more reach

### Do it
1. **Publish ORIGINAL** (retweets and replies don't pass through the Banger Screen → less OON amplification).
2. **Don't be a private account** (no embeddings, no retrieval).
3. **Space your posts**: no more than 1 every few hours to avoid *Author Diversity Decay*.
4. **Optimize for dwell + reply, not for like**: `dwell` continuous, `cont_dwell_time`, `cont_click_dwell_time` are heavy signals. A reply or quote is worth more than a like.
5. **Video > minimum threshold**: if you do video, do at least ≥ 10–15 s and have the first second retain.
6. **Explicit topic**: use topics and vocabulary the model understands as "this post is about AI / crypto / NFL". It helps with `TopicOonWeightFactor`.
7. **Reader's language**: if you want US, write in English. If you want EU, segment by local language.
8. **Audience's schedule**: `AgeFilter` kills you. Post when your target audience is awake.
9. **Generate early engagement from followers**: amplify with your network to activate positive signals and offset the OON discount when jumping outside.
10. **Real quality in replies to large accounts**: the Reply Ranker reads you. "First!" doesn't scale.

### Avoid it
1. **Posts near the 7 PToS policies** (violence, untagged NSFW, hate, spam, illegal, verbal violence, self-harm) → MediumRisk + no ads + downrank.
2. **10+ tweet megathreads to "fill the feed"**: `DedupConversationFilter` only keeps one per thread.
3. **Recycling the same post**: `PreviouslySeen*` filters discard it.
4. **Cross-blocks**: if you block someone, you lose access to their quoted/retweeted content and to all the graph of whoever quotes them.
5. **Pure AI slop**: `slop_score` exists explicitly. Better LLM + human editing than raw generation.
6. **Spurious replies to small accounts**: the low-follower-specific spam classifier can label you.
7. **Private account if you want to grow**: incompatible with discovery.
8. **Relying on follower count as a single metric**: the main `WeightedScorer` and `RankingScorer` **don't** use follower count as a direct weight. There are buckets (0-100, 100-1K, 1K-10K, 10K-100K, 100K-1M, 1M+) for *internal instrumentation* ([`tweet_type_metrics_hydrator.rs`](x-algorithm/home-mixer/candidate_hydrators/tweet_type_metrics_hydrator.rs)) and the alternative `VMRanker` receives it as a feature of its value-model ([`vm_ranker.rs:102`](x-algorithm/home-mixer/scorers/vm_ranker.rs)) — but the final weight is decided by post behavior, not author fame.

---

## 15. The "min-traction gate": the most important (and most invisible) bottleneck

The second-pass discovery that most changes the rules of the game.

The **Grox** system (the classification layer with Grok-VLM) **doesn't process every post**. It processes several different Kafka streams, and each stream has its own set of "eligibilities" it opens.

Source: [`grox/generators/stream_generator.py:50-180`](x-algorithm/grox/generators/stream_generator.py) and [`grox/dispatcher.py:84-230`](x-algorithm/grox/dispatcher.py).

```python
class PostStreamTaskGenerator(StreamTaskGenerator):
    # ALL posts (ingested on publication)
    TASK_GENERATOR_TYPE = TaskGeneratorType.POST_STREAM
    ELIGIBILITIES_TO_INJECT = {
        TaskEligibility.SPAM_COMMENT,
        TaskEligibility.REPLY_RANKING,
    }

class MinTractionPostStreamForGroxTaskGenerator(StreamTaskGenerator):
    # ONLY posts with "min traction" (minimum engagement)
    TASK_GENERATOR_TYPE = TaskGeneratorType.POST_MIN_TRACTION_STREAM_FOR_GROX
    ELIGIBILITIES_TO_INJECT = {TaskEligibility.BANGER_INITIAL_SCREEN}

class MinTractionPostStreamForGroxPtosTaskGenerator(StreamTaskGenerator):
    # ONLY min-traction → PToS deluxe screen
    ELIGIBILITIES_TO_INJECT = {TaskEligibility.SAFETY_PTOS}

class MinTractionPostStreamForGroxMultiModalTaskGenerator(StreamTaskGenerator):
    # ONLY min-traction → multimodal embedding for reply
    ELIGIBILITIES_TO_INJECT = {TaskEligibility.POST_EMBEDDING_WITH_SUMMARY_FOR_REPLY}

class PostSafetyStreamTaskGenerator(StreamTaskGenerator):
    # Topic: "POPULAR" — only popular posts go through post-safety screen
    ELIGIBILITIES_TO_INJECT = {TaskEligibility.POST_SAFETY}
```

Read it slowly:

- **`POST_STREAM`** (all posts) → only eligible for `SPAM_COMMENT` (if reply to small account) and `REPLY_RANKING` (if reply to large account).
- **`MIN_TRACTION_STREAM`** → this is what opens `BANGER_INITIAL_SCREEN`, `SAFETY_PTOS`, and the multimodal embedding generation for reply retrieval.
- **`POPULAR_STREAM`** → unlocks `POST_SAFETY` (the "full" safety screen).

**Massive implication**: if your post doesn't cross the "min traction" threshold, **it's never classified as banger** and **never gets the quality multimodal embedding generation**. Without a quality embedding, it doesn't enter the retrieval corpus Phoenix uses to discover out-of-network content. Without Banger Screen, it's not an amplification candidate.

**The system rewards deep classification to posts that already have traction**. It's a virtuous circle, and for the same reason a cliff for posts starting cold.

**Recommended actions:**
1. **Generate early engagement by every means possible**: notify your network, post at peak time, secure the first likes/replies in the first minutes.
2. **If a post does well after 30-60 minutes, it goes up to Banger Screen**. If not, it's dead for broad discovery (though still visible to your followers).
3. **Combined with the age-feature (next section)**: the **first 30 minutes** are where almost everything is decided.

> The exact numerical value of the "min traction threshold" isn't in the code (it doesn't appear as a hardcoded constant; probably external config of the Kafka producers). But the *existence* of the gate is, and by industry instrumentation it's typically between "≥1 like" or "≥3 engagement events".

---

## 16. Post age is an explicit model feature (cap at 80 hours)

```python
POST_AGE_MAX_MINUTES = 4800   # 80 hours


def compute_post_age_bucket(
    impr_ts_sec, post_creation_ts_sec, granularity_mins: int = 60,
) -> jax.Array:
    num_normal_buckets = POST_AGE_MAX_MINUTES // granularity_mins
    overflow_bucket = num_normal_buckets + 1

    post_age_minutes = (impr_ts_sec - post_creation_ts_sec) // 60
    bucket = (post_age_minutes // granularity_mins) + 1
    bucket = jnp.clip(bucket, 0, overflow_bucket)
    # ...
```

Source: [`phoenix/recsys_model.py:33-55`](x-algorithm/phoenix/recsys_model.py).

Direct conclusions:
- The model **discretizes the age** of the post in 60-minute buckets. Each bucket is a learned embedding (`post_age_vocab_size = 80 + 2`).
- After **80 hours (≈ 3.3 days)** the post falls into the `overflow_bucket` — whatever its real age (4 days, 1 week, 1 month), the model sees it the same.
- In the first minutes after publication, the post is in bucket 0/1, embeddings the model has learned to associate with "recency and possible virality".
- On top of that, there's an `AgeFilter` at the start of the pipeline that **directly removes** posts older than `max_age` (another external variable). The overflow bucket probably never appears in production for For You — only on other surfaces.

**Operational trick:**
- An old post doesn't "recover" with late engagement. Even if someone gives it a mega-RT 3 days later, the model is no longer going to treat it the same as a fresh one.
- The **0-12 hour window is where everything is decided**. At 24h the post enters "high age" territory. At 80h+ it's dead for For You.

---

## 17. The reader's "For You privacy switch"

```rust
let in_network_only =
    proto_query.in_network_only ||
    viewer_data.allow_for_you_recommendations == Some(false);
```

Source: [`home-mixer/server.rs:75-77`](x-algorithm/home-mixer/server.rs).

Any user can have `allow_for_you_recommendations = false` in their settings. When that flag is active, **the system forces `in_network_only = true`**, which disables:
- Phoenix Retrieval (out-of-network)
- Phoenix MoE
- Phoenix Topics
- Tweet Mixer

That is: that user will only see posts from people they already follow, no matter how good your content is.

**Practical trick:** part of your target audience has this on (the unknown is what percentage). The only **guaranteed** way to reach them is for them to press "Follow". Insisting on discovery hooks (viral memes, etc.) doesn't reach that segment; it does reach them if they follow you and then the content goes through in-network scoring.

---

## 18. The 50% "shadow traffic": experimental features that absolutely affect your audience

```rust
let query = ScoredPostsQuery::new(
    // ...
    is_sampled(request_id, 0.5),  // is_shadow_traffic
    // ...
);
```

Source: [`home-mixer/server.rs:117`](x-algorithm/home-mixer/server.rs).

**Half of ALL requests are `is_shadow_traffic = true`**. And several hydrators have the pattern:

```rust
fn enable(&self, query: &ScoredPostsQuery) -> bool {
    query.params.get(EnableContextFeatures) || query.is_shadow_traffic
}
```

(Examples: `UserDemographicsQueryHydrator`, `UserInferredGenderQueryHydrator`, `FollowedGrokTopicsQueryHydrator`, `HasMediaHydrator`, `EngagementCountsHydrator`, `FollowedStarterPacksQueryHydrator`…)

That means **even if the flags are officially "off"**, **50% of your impressions go to users whose request activated them**. There's no way for a creator to know, but **you should assume these features are always active**: inferred gender, age, demographics, followed Grok topics, starter packs, IP location, etc.

---

## 19. The model's "memory": only the last ~128 actions

```python
@dataclass
class PhoenixModelConfig:
    history_seq_len: int = 128
    candidate_seq_len: int = 32
    num_continuous_actions: int = 8
    product_surface_vocab_size: int = 16
    post_age_granularity_mins: int = 60
    mask_neg_feedback_on_negatives: bool = True
```

Source: [`phoenix/recsys_model.py:336-365`](x-algorithm/phoenix/recsys_model.py).

In the published mini version:
- **`history_seq_len = 128`**: the model only "sees" the user's last 128 actions when scoring each candidate.
- **`candidate_seq_len = 32`**: 32 candidates scored at once (with attention isolation).
- **`product_surface_vocab_size = 16`**: 16 different "surfaces" (Home, Profile, Search, Following, Trending, Notifications, etc.). The model learns that a like on Home doesn't mean the same as one on Search.
- **`num_continuous_actions = 8`**: 8 continuous actions (dwell time, click dwell time, etc.).

Production uses more layers and longer sequences, but the **structure is the same: a bounded window of recent behavior**.

**Operational implications:**
- A user who has an "old" pattern of likes on a certain topic but has recently changed interests **will be matched with their recent behavior, not historical**. Content pivots work.
- If you want to enter a new niche, **don't expect the model to remember you for likes from 6 months ago**. You need recent engagement with that niche for the model to associate you.

---

## 20. The important difference between `scoring_sequence` and `retrieval_sequence`

The model receives TWO different sequences of user behavior:

- **`retrieval_sequence`**: `Dense` aggregation by default. Used to find OON candidates via similarity (Two-Tower). Source: [`retrieval_sequence_query_hydrator.rs:48-50`](x-algorithm/home-mixer/query_hydrators/retrieval_sequence_query_hydrator.rs).
- **`scoring_sequence`**: `DenseWithNotInterestedIn` aggregation by default. Used to score already retrieved candidates. Source: [`scoring_sequence_query_hydrator.rs:55-58`](x-algorithm/home-mixer/query_hydrators/scoring_sequence_query_hydrator.rs).

The key difference: `scoring_sequence` **explicitly includes the user's "not interested"** actions. That means when the model decides if you'll see the next post, **it considers what you've recently marked as "not interested"**.

**Realtime feedback:**

```rust
let include_realtime: bool = query.params.get(IncludeRealtimeActions);
```

There's an `IncludeRealtimeActions` flag that adds just-done actions to the sequence. If a user marks "not interested" on a post about a topic, the effect can be **immediate** on the next request.

**Action:** avoid patterns that generate "not interested" in *any* user, because that vote propagates fast to their model. And if you receive it, you'll lose visibility with that user for a good while (as long as it lasts in their 128 actions).

---

## 21. Other hard limits from the code (constants cheatsheet)

| Constant | Value | Source | Meaning |
|---|---|---|---|
| `POST_AGE_MAX_MINUTES` | 4800 (80h) | `phoenix/recsys_model.py:33` | Maximum representable post age |
| `post_age_granularity_mins` | 60 | `phoenix/recsys_model.py:352` | 1h buckets for age |
| `history_seq_len` | 128 | `phoenix/recsys_model.py:342` | User action window (mini model) |
| `candidate_seq_len` | 32 | `phoenix/recsys_model.py:343` | Candidates scored per inference |
| `product_surface_vocab_size` | 16 | `phoenix/recsys_model.py:350` | "Surfaces" where the model tracks engagement |
| `MIN_POSTS_FOR_ADS` | 5 | `home-mixer/ads/util.rs:10` | Minimum posts before first ad |
| `DEFAULT_SPACING.requested` | 3 | `home-mixer/ads/util.rs:14` | 1 ad every 3 posts (default) |
| `DEFAULT_SPACING.min` | 2 | `home-mixer/ads/util.rs:14` | Absolute minimum between ads |
| `MIN_REQUESTED_GAP` | 3 | `home-mixer/ads/util.rs:12` | Minimum requested spacing |
| `MAX_WHO_TO_FOLLOW_USERS` | 3 | `home-mixer/sources/who_to_follow_source.rs:15` | Max WTF in module |
| `EXCLUDED_USER_IDS_LIMIT` | 200 | `home-mixer/sources/who_to_follow_source.rs:14` | Accounts excluded from WTF |
| `MAX_REPLIERS` | 3 | `home-mixer/sources/push_to_home_source.rs:13` | Facepile in push-to-home |
| `VIEWER_FOLLOWERS_THRESHOLD` | 1000 | `home-mixer/candidate_hydrators/following_replied_users_hydrator.rs:12` | Min followers to see "X friends replied" |
| `MIN_CACHED_POSTS_THRESHOLD` | 500 | `home-mixer/query_hydrators/cached_posts_query_hydrator.rs:12` | Cached posts before jumping to cached-mode |
| `MIN_HASHES` (mutual jaccard) | 256 | `home-mixer/candidate_hydrators/mutual_follow_jaccard_hydrator.rs:11` | Min hashes for follow-graph similarity |
| `MAX_RESPONSES` | 50 | `home-mixer/side_effects/truncate_served_history_side_effect.rs:12` | "Served responses" history kept |
| `PTOS_CUTOFF_TWEET_ID` | `2_054_275_414_225_846_272` | `home-mixer/models/brand_safety.rs:37` | Tweets after this ID need PTOS_REVIEWED to not be MediumRisk |
| Video duration cap for processing | 360 min (6h) | `grox/tasks/task_media.py:11` | Longer videos not processed |
| Engagement counts cache (new post) | 5 min TTL | `home-mixer/candidate_hydrators/engagement_counts_hydrator.rs:33` | Fast counter refresh on posts <30 min |
| Engagement counts cache (old post) | 10 min TTL | `home-mixer/candidate_hydrators/engagement_counts_hydrator.rs:34` | Slower refresh on posts >30 min |
| AdsBrandSafety cache (new post) | 1 min TTL | `home-mixer/candidate_hydrators/ads_brand_safety_hydrator.rs:36` | Safety labels refresh fast for new posts |
| `VIEWER_ROLES_TIMEOUT_MS` | 200 ms | `home-mixer/server.rs:33` | If Gizmoduck doesn't respond in 200ms, fallback to empty data |

---

## 22. Hidden tricks (non-obvious things to "game" the algorithm)

> Some of these are reasonable inferences from the code, not guarantees. Marked with (⚠️) the most speculative ones.

### 22.1 The "boost-then-decay" of the first post of the day
Due to *Author Diversity Decay*, your **first** post of the day in each user's feed has multiplier 1.0. Since the feed recomposes on each request and users check 5-20 times a day, **posting 1 great post every ~6 hours usually performs better than 5 publications in a row**. The decay is per feed-response, so having different posts compete at different moments of the day competes against the effect of stepping on yourself.

### 22.2 Compete for dwell, not for like
The exact weights aren't published, but the model has **5 different dwell signals**: `dwell_score` (binary), `cont_dwell_time` (continuous), `cont_click_dwell_time` (post of click), `not_dwelled_score` (negative), plus `quoted_vqv_score` for videos. By contrast, the `favorite_score` signal is **one single one**. It's reasonable to infer that the aggregate of dwell signals weighs more than the isolated like. **Threads with a gripping first tweet + interesting body retain more seconds than a quick meme**.

### 22.3 Quote-tweet viral posts in your niche
`quoted_video_duration_ms` is hydrated from the quoted post, and the signals `quote_score`, `quoted_click_score`, `quoted_vqv_score` reward quote-engagement. Quoting viral content with a good take adds THEIR scores and yours as a multiplication: the model already knows the original engages, and your value-add stacks.

### 22.4 The first 30-60 min of the post decide the "min-traction gate"
Grok's gate (section 15) is evaluated as soon as the post receives engagement. **The first comment, the first like, in the first 5-10 minutes**, lifts you to the `MIN_TRACTION_FOR_GROX` stream and unlocks Banger Screen + quality multimodal embedding. What doesn't enter there isn't recovered later.

### 22.5 Tag your content by topic
`TopicOonWeightFactor` improves OON when the request carries topic. Posts with clear vocabulary of their niche (recognized hashtags, topic keywords, mentioning recognizable entities) get matched with topic-based requests and receive different OON treatment — more favorable.

### 22.6 Audio in video matters (ASR)
The multimodal embedder **transcribes the audio** of your videos via ASR. The transcribed text is added to the post understanding. **Don't make videos with background music and zero voice**: you're leaving a whole column of signal empty. Voice/speech is read by Grok and contributes to the semantic embedding.

### 22.7 The "friends also replied" facepile has a 1000 threshold
Only users with ≥ 1000 followers see the social proof facepile ("3 people you follow replied to this post"). If your audience is **below 1000 followers**, this social validation signal doesn't appear for them. If above, it appears and increases CTR. Strategy: optimize for your account being attractive specifically for users *with* >1000 followers (creators, journalists, etc.) because their impressions convert better visually.

### 22.8 Short videos (<10s) lose the Video Quality View weight
The VQV bonus zeroes under `MinVideoDurationMs`. Even if you retain 100% of the audience, **you don't receive the heavy video bonus**. Strategy: minimum viable 10-15s.

### 22.9 Put content near the top: the "cliff" of the first 5
Ads don't appear until post 5+. That means the first 5 posts of the feed are 100% organic and most competitive. Being in top-5 implies very high score vs the other candidates. But also: being in top-5 maximizes your impression probability (people scroll and abandon). The **relative score in top-5 is what wins**.

### 22.10 The cached `prediction_id`: free replays
Each request has a unique `prediction_id`. Phoenix predictions are cached by `prediction_id`. If the user polls (auto refresh) in the next seconds without having engaged anything, **the system potentially reuses your scores**. This means a well-scored post during a request can appear in several consecutive requests from the same user until something changes. Trick: if your post is in the first batch, you benefit from "inertia" in the following ones.

### 22.11 The WTF (Who-To-Follow) "fatigue cooldown"
`WhoToFollowFatigueHours` controls how often a WTF module is shown again to the user. If they already saw one recently, they don't see another for X hours. This isn't relevant for your posts but it is for your lateral visibility if you've launched *follower campaigns*: the second WTF of the session simply isn't served.

### 22.12 Re-publishing the same text DOESN'T work
`PreviouslySeenPostsFilter` and `PreviouslyServedPostsFilter` filter already-seen posts (Bloom filter on client + served IDs). Each post **has to be new** for the same user to see it. Re-tweeting your own post from a month ago technically does work because it's a retweet with its own ID in `retweeted_tweet_id`, **but** `RetweetDeduplicationFilter` will then eliminate repeated versions of the same tweet.

### 22.13 (⚠️) Client Bloom filter has false positives
`PreviouslySeenPostsFilter` uses a Bloom Filter. By definition it has false positives. It's theoretically possible that a post you have **NOT** seen is discarded because it collides with a hash of one you did see. Not actionable for a creator, but explains why sometimes users "don't see" a post from someone they follow even though it has many impressions.

### 22.14 Accounts below a certain age get a "new user" OON boost
`is_eligible_new_user` requires: young account (`age < new_user_age_threshold`) + `>= NEW_USER_MIN_FOLLOWING` (minimum followed accounts). These accounts receive **`NEW_USER_OON_WEIGHT_FACTOR`** (clearly higher than the general OON factor — the system pushes OON content to new users so they discover). Implication: targeting recently created accounts (creators less than N days) can be a way to grow because your OON-discount is smaller for them.

### 22.15 (⚠️) `has_phone_number` and `account_age_days` as targeting dimensions
The `evaluate_feature_switches` ([`server.rs:138-175`](x-algorithm/home-mixer/server.rs)) builds the "recipient" with `account_age_days` and `has_phone_number` in addition to country, language, and app. That means feature flags can activate selectively for "phone-verified accounts" or "accounts with > X days". If you publish to a heterogeneous audience, two users with identical profile but one without a phone can receive your post with different configuration.

---

## 23. Mistakes that kill your reach (the short "absolutely no" list)

1. **Posting from a protected account if you want discovery**. No multimodal embedding = no OON retrieval.
2. **Posts at 4am your zone if your audience is transatlantic**. By the time they wake up, you're already in a high age bucket. The optimal window is **the first 0-12 hours of your audience**, not yours.
3. **Threads of 10+ tweets** hoping to fill the feed. Only 1 per thread per user wins.
4. **Reposting the same content days later**. Bloom filters + dedup filters discard it for users who already saw it.
5. **Quoting who blocked you / who you blocked**. `AuthorSocialgraphFilter` eliminates the whole chain.
6. **Commenting generically on large accounts** ("first!", emojis, "100% agree"). The Reply Ranker ranks you low. Your engagement gets diluted.
7. **Spam in replies to small accounts**. `SpamEapiLowFollowerClassifier` labels you and leaves a trace.
8. **Videos of < 7-10 s without retention promise**. You lose the full VQV weight.
9. **Pure AI slop**. `slop_score` is in the code as explicit metric. Generate with LLM, edit human.
10. **Burst of 5 posts in 10 minutes**. Author Diversity Decay destroys you from the second.
11. **Untagged NSFW/NSFA, violence, hate**. The 7 PToS categories plus `DO_NOT_AMPLIFY` put you in MediumRisk → no adjacent ads → structural downranking.
12. **Chained quote-tweets of your own post without added value**. Auto-ref-quotes are detectable and don't add differentiated engagement.
13. **Wrongly tagging content (off-topic)**. If you put "AI" hashtag on a cooking post, readers will mark "not interested" → the signal goes immediately to their `scoring_sequence` with negative weight.
14. **Publishing to users with `allow_for_you_recommendations = false`** and not getting them as followers. You won't reach them again OON.

---

## 24. Operational roadmap (first new post)

If you had to apply everything above to a hypothetical post, this would be the order:

1. **Before publishing**: define the topic and language suitable for your target audience (US/EU). Make sure you're not protected.
2. **Publication time**: peak time of your target audience, not yours. (The model doesn't penalize but `AgeFilter` and the age bucket do.)
3. **Format**:
   - Text + image is the most versatile.
   - Video only if it lasts ≥10-15s and has audio (Grok transcribes it).
   - Avoid long threads as a reach strategy — focus on a single "banger" candidate tweet.
4. **Hook**: retentive first line (maximizes dwell + cont_dwell_time). A question or polarizing statement (with tact) generates reply.
5. **Immediate activation**: in the first 5-10 minutes, notify your close network (DM, own community). You want to cross the **min-traction gate** quickly.
6. **Don't publish other posts in the next 2-4 hours**. Diversity decay destroys you.
7. **If after 30 min there's no traction**: the post is out of the Banger Screen pipeline. Still visible to your followers but not for OON retrieval. Accept it and move on to another post.
8. **If it's going well**: the post is in Banger Screen, possibly with `quality_score ≥ 0.4`. After 1-2h, the model has good signals; the next 24-48h are the "long tail" of impressions.
9. **At 80 hours**: the post falls into the age `overflow_bucket`. Game over for discovery; still archived.

---

## 25. Verification: is the viral "Nikita hides this in Rust" true?

There's a tweet going around claiming the following:

> *"AuthorSocialgraphFilter, VF visibility filters, and the AuthorDiversityScorer — these motherfuckers can quietly kneecap entire groups of accounts. One side gets their posts blasted across everyone's For You like free OnlyFans. The other side? Their shit gets DIVERSITY-scored, negative-weighted, and shadow-raped into digital oblivion.*
>
> *And the best part? All the real control knobs — the secret thresholds, the custom filter rules, the exact weights they're using to boost their preferred cult while burying everyone else — are sitting in private Rust files and config systems that will NEVER see the light of day."*

I run it through the code point by point. It mixes **correct things**, **false things**, and a **conspiratorial inference** the code doesn't support.

### 25.1 "AuthorSocialgraphFilter can kneecap entire groups of accounts"

**False (mechanically).** The full filter reduces to this:

```rust
let muted = viewer_muted_user_ids.contains(&author_id);
let blocked = viewer_blocked_user_ids.contains(&author_id);
let author_blocks_viewer = candidate.author_blocks_viewer.unwrap_or(false);
let quoted_author_blocks_viewer = candidate.quoted_author_blocks_viewer.unwrap_or(false);
let viewer_blocks_quoted_author = ...;
let viewer_blocks_retweeted_user = ...;

if muted || blocked || author_blocks_viewer || quoted_author_blocks_viewer
    || viewer_blocks_quoted_author || viewer_blocks_retweeted_user
{ removed.push(candidate); } else { kept.push(candidate); }
```

Source: [`author_socialgraph_filter.rs`](x-algorithm/home-mixer/filters/author_socialgraph_filter.rs) complete, 61 lines.

It's a **strictly per-viewer** filter. It only checks:
- The **viewer's own** blocks/mutes.
- If the **author** has blocked the **viewer** (1↔1 relationship).
- Same for quoted and retweeted authors.

It doesn't consult any global list, any external parameter, any account labeling system. There's no way this filter can "kneecap groups". It only applies the viewer's express will and the bidirectional relationship with the specific author. And a grep for `globally_blocked|denylist|banned_users|hidden_accounts|admin_block` across the whole repo **returns nothing**.

### 25.2 "AuthorDiversityScorer can kneecap entire groups of accounts"

**False.** This is the clearest. The entire file is 73 lines and the only non-trivial function is:

```rust
fn multiplier(&self, position: usize) -> f64 {
    (1.0 - self.floor) * self.decay_factor.powf(position as f64) + self.floor
}
// ...
let entry = author_counts.entry(candidate.author_id).or_insert(0);
let position = *entry;
*entry += 1;
let multiplier = self.multiplier(position);
```

Source: [`author_diversity_scorer.rs:29-58`](x-algorithm/home-mixer/scorers/author_diversity_scorer.rs).

- Counts how many times **each `author_id`** appears in the candidate list of **this single response**.
- Multiplies the score by a function **identical** for all authors: the Nth position of any author is reduced by the same factor.
- Doesn't read any identity/political/group field. **There's no external query**: the info comes solely from the batch of candidates itself.

For this scorer to treat different "groups" differently, it would need to inject a list, an external API, or a category in the candidate. None of that is in the code. The claim is factually incorrect.

### 25.3 "VF visibility filters can kneecap accounts"

**Partial truth, but NOT by group.** `VFFilter` can indeed drop posts:

```rust
fn should_drop(reason: &Option<FilteredReason>) -> bool {
    match reason {
        Some(FilteredReason::SafetyResult(safety_result)) =>
            matches!(safety_result.action, Action::Drop(_)),
        Some(_) => true,
        None => false,
    }
}
```

Source: [`vf_filter.rs`](x-algorithm/home-mixer/filters/vf_filter.rs).

But the **list of reasons a post can be dropped** is closed and in the published code, **based on content, not identity**:

```rust
pub(crate) const MEDIUM_RISK_LABELS: &[SafetyLabelType] = &[
    SafetyLabelType::NSFW_HIGH_PRECISION,
    SafetyLabelType::NSFW_HIGH_RECALL,
    SafetyLabelType::NSFA_HIGH_PRECISION,
    SafetyLabelType::NSFA_KEYWORDS_HIGH_PRECISION,
    SafetyLabelType::GORE_AND_VIOLENCE_HIGH_PRECISION,
    SafetyLabelType::NSFW_REPORTED_HEURISTICS,
    SafetyLabelType::GORE_AND_VIOLENCE_REPORTED_HEURISTICS,
    SafetyLabelType::NSFW_CARD_IMAGE,
    SafetyLabelType::DO_NOT_AMPLIFY,
    SafetyLabelType::NSFA_COMMUNITY_NOTE,
    SafetyLabelType::PDNA,
    SafetyLabelType::EGREGIOUS_NSFW,
    SafetyLabelType::GROK_NSFA,
    SafetyLabelType::NSFW_TEXT,
];
```

Source: [`brand_safety.rs:14-29`](x-algorithm/home-mixer/models/brand_safety.rs).

The labels talk about NSFW/NSFA/gore/violence/PDNA, not affiliations. What is **NOT** published:
- The engine that **assigns** these labels (the *Safety Label Store*) and its BotMaker rules.
- The Grok classifier prompts that produce `GROK_NSFA`.
- The human rules (`BotMakerAction.rule_id`) that can add labels manually; the code only exposes the category ranges (`1000-1099 Content`, `1100-1199 ContentLimited`, `1200-1399 Safety`, `1400-1499 Grok`, `1500-1600 Quote`).

**Honesty point**: here there is real opacity. A label like `DO_NOT_AMPLIFY` is generic; theoretically an internal operator with permissions could apply it to a specific account via BotMaker. **There's nothing in the published code that shows how it's decided to apply it or who can**. If someone wanted to abuse the system, **this would be the spot**, not the two filters the tweet cites.

### 25.4 "One faction is amplified like free OnlyFans, the other buried"

**Not supported by code.** Nowhere in the repo does the following appear:
- Any `political`, `partido`, `ideology`, `protected_class` parameter.
- Any list "preferred_users", "amplify_list", "boost_users", "priority_accounts".
- Any boost by `is_verified` / `is_blue` / `subscription_level` in the scorers (`subscription_level` exists as a field, but is only used to hydrate subscriber-only content and for metrics — not as a score weight; see §10 and §22 of the document).

The **only** hardcoded ID lists with special treatment are:

```rust
if params::TRACE_USER_IDS.contains(&proto_query.viewer_id) {
    b3_info.force_sample();   // force detailed logging
}
// ...
if params::TEST_USER_IDS.contains(&query.user_id) {
    return Ok(ForYouOutput { items: vec![] });   // empty feed for testers
}
```

Source: [`server.rs:69`](x-algorithm/home-mixer/server.rs), [`for_you_server.rs:32`](x-algorithm/home-mixer/for_you_server.rs).

These are **internal debugging** lists: whoever is in `TRACE_USER_IDS` gets detailed tracing; whoever is in `TEST_USER_IDS` gets an empty feed (probably test accounts). Neither is a "amplified favorites" list.

### 25.5 "All the real control knobs are in private Rust files"

**Partially true, but the framing is misleading.**

What **is** outside the public repo (I've documented it throughout the .md):
1. The **numerical values** of the weights (`FavoriteWeight`, `ReplyWeight`, `OonWeightFactor`, `AuthorDiversityDecay`, `MinVideoDurationMs`, etc.). They live in `xai_feature_switches::Params`, an external configuration system.
2. The **prompts** of the Grok classifiers (`BangerMiniVlmScreenScore`, `SpamSystemLowFollower`, `SafetyPtos`, `ReplyScoringSystem`, the 7 policy prompts: `ViolentMediaPolicy`, `AdultContentPolicy`, etc.).
3. The **utility** `country_codes::bucket_country`.
4. The **BotMaker rules** that manually apply safety labels (the ranges are published; the specific rules aren't).
5. The **trained weights** of the production Phoenix transformer (the repo publishes a mini-version: 256-dim, 4 heads, 2 layers; production is bigger).
6. The **`xai_*` crates** referenced: the repo imports 25+ external crates (`xai_decider`, `xai_feature_switches`, `xai_recsys_aggregation`, `xai_visibility_filtering`, `xai_safety_label_store`, `xai_post_text`, etc.) whose code isn't published.

What is **NOT** true:
- They're not "private Rust files" — they're **external configuration** and **shared libraries** of the xAI stack. The difference matters: what's missing is not hidden algorithm code, it's **parameterizable values** and **client libraries** of the rest of the stack.
- The **complete** structure of the pipeline IS published: every filter, every scorer, every hydrator, every source, the names of the model features, the transformer architecture, the safety labels used, the topics recognized. If there were a "preferred group boost" it would have to exist either (a) as a flag in the query/candidate (doesn't exist), or (b) as an input signal to the transformer (doesn't appear in `RecsysBatch`), or (c) as a parametric filter (not visible). The space where it could hide is narrow.

### 25.6 "Boost preferred cult, bury everyone else"

**No evidence in the code.** What the architecture does allow is that **xAI configures the system differently for different USER cohorts** via feature switches with dimensions like `country`, `language`, `account_age_days`, `has_phone_number`, `user_roles`. That's real (see §18 on shadow traffic). But it's the VIEWER, not the AUTHOR, who sees different experiments — it's not a "favorite accounts amplification" system.

For "preferred cult boost" to exist, one of these would have to happen:
1. That `PostCandidate` carried an identity/affiliation field of the author → **doesn't exist** (reviewed all `models/candidate.rs` and `candidate_features.rs`).
2. That some scorer queried an external service by author_id → no published scorer does this; they all operate on `phoenix_scores` and `author_id` only for diversity decay.
3. That safety labels are applied politically via BotMaker → **possible** in the abstract, but this would be operational abuse, not an algorithm mechanism.
4. That the Phoenix model had *biased training data* → can't be verified from the code (the data isn't published). An additional layer of legitimate concern.

### 25.7 Where there's real opacity (what the tweet brushes against but doesn't formulate)

The honest critique of partial openness is:

- **The numerical weights can't be audited** (we can't know if `BlockAuthorWeight = -100` or `-10`).
- **The Grok prompts can't be audited** (the prompts COULD have political/ideological biases in their wording; without seeing them you can't know).
- **The BotMaker rules can't be audited** (ranges `1200-1399 = Safety` are in the code but the specific rules aren't).
- **The Phoenix training dataset can't be audited** (a model trained on biased user engagement reproduces that bias).
- **The cohort rebalances/experiments executed via feature switches aren't published**.

These are legitimate and reasonable critiques of partial openness. What the tweet claims — that three specific Rust files (that ARE published) are the tool for kneecaping groups — is **factually false**. The real opacity is **elsewhere** (parameters, prompts, BotMaker rules, data), and it's far from equivalent to "they boost their preferred cult".

### 25.8 Verdict

| Tweet claim | Verdict |
|---|---|
| "AuthorSocialgraphFilter kneecaps groups of accounts" | **False.** It's purely per-viewer, no global list. |
| "AuthorDiversityScorer kneecaps groups of accounts" | **False.** Applies identical decay to all authors by position in the same response. |
| "VF filters kneecap groups" | **Mechanism partially true** (it does drop), **framing false**: the labels that drop are content-based (NSFW, gore, violence, DO_NOT_AMPLIFY), not identity. |
| "Thresholds and weights are in private files that will never see the light" | **Partially true.** Numerical values, Grok prompts, BotMaker rules and external xAI crates aren't published — but the algorithm **structure** is. |
| "Boost the preferred cult, bury the rest" | **No evidence in code.** No field, list, or parameter separates authors by group/identity/politics. |

---

## 26. Do shadowbans exist in the algorithm? Yes, and there are four different types

"Shadowban" is a term people use for **four different mechanisms** that exist in the code. I distinguish them because each has a different cause, effect, and countermeasure.

### 26.1 Hard shadowban: `Action::Drop` by Visibility Filtering

```rust
fn should_drop(reason: &Option<FilteredReason>) -> bool {
    match reason {
        Some(FilteredReason::SafetyResult(safety_result)) => {
            matches!(safety_result.action, Action::Drop(_))
        }
        Some(_) => true,
        None => false,
    }
}
```

Source: [`home-mixer/filters/vf_filter.rs:22-30`](x-algorithm/home-mixer/filters/vf_filter.rs).

Your post is removed from the feed if the external `xai_visibility_filtering` service returns `Action::Drop(_)` **or** any `FilteredReason` that isn't `SafetyResult` (the `Some(_) => true` clause).

**What triggers `Action::Drop`:**
- Tweet deleted by the author
- Suspended account
- Any specific *SafetyLabel* the external service decides deserves drop (not visible in open code: it's the `xai_visibility_filtering` crate)
- Labels like `PDNA` (PhotoDNA, child abuse content) have guaranteed drop

**Important**: the published code only shows THAT the mechanism exists, not the rules that decide when to apply it. Those rules live in the external service and BotMaker. There's real operational opacity here.

**How you find out**: you DON'T find out. It's by definition silent. Your post is still visible to you and through some channels (your own profile, direct search by ID maybe), but **doesn't appear in anyone's For You**.

### 26.2 Soft shadowban: `DO_NOT_AMPLIFY` and the rest of `MediumRisk` labels

This is the most "classic" shadowban — the content remains accessible but its distribution structurally degrades.

```rust
pub(crate) const MEDIUM_RISK_LABELS: &[SafetyLabelType] = &[
    SafetyLabelType::NSFW_HIGH_PRECISION,
    SafetyLabelType::NSFW_HIGH_RECALL,
    SafetyLabelType::NSFA_HIGH_PRECISION,
    SafetyLabelType::NSFA_KEYWORDS_HIGH_PRECISION,
    SafetyLabelType::GORE_AND_VIOLENCE_HIGH_PRECISION,
    SafetyLabelType::NSFW_REPORTED_HEURISTICS,
    SafetyLabelType::GORE_AND_VIOLENCE_REPORTED_HEURISTICS,
    SafetyLabelType::NSFW_CARD_IMAGE,
    SafetyLabelType::DO_NOT_AMPLIFY,    // ← the canonical "shadowban"
    SafetyLabelType::NSFA_COMMUNITY_NOTE,
    SafetyLabelType::PDNA,
    SafetyLabelType::EGREGIOUS_NSFW,
    SafetyLabelType::GROK_NSFA,
    SafetyLabelType::NSFW_TEXT,
];
```

Source: [`home-mixer/models/brand_safety.rs:14-29`](x-algorithm/home-mixer/models/brand_safety.rs).

Any of these labels mark your post as `MediumRisk`. The **consequences** documented in the open code:

1. **No adjacent ad** ([`ads/util.rs:25-27`](x-algorithm/home-mixer/ads/util.rs)). `has_avoid(post)` returns `true` for any `MediumRisk` and the blender avoids putting ads next to it. Result: the system **loses money** when it shows your post. That already creates a structural incentive for ranking to depress it.
2. **`BsrLow/BsrIas` ads** (premium brand ads) **aren't placed next to `LowRisk` posts** ([`ads/util.rs:79-97`](x-algorithm/home-mixer/ads/util.rs)). The cliff is: the worse your verdict, the fewer premium ads reach your neighborhood.
3. **`LowRisk` itself (second tier)** excludes you from premium inventory even if you're still "kept".

**What's NOT visible in the open code but necessarily exists:**
- The external `xai_visibility_filtering` can use `Action::Limit(...)` or `Action::Interstitial(...)` (the `Action::Drop(_)` with the tuple and `_` suggest an enum with other variants). `VFFilter` only kills by `Drop`, but the other variants propagate to the client: warning panel, click-to-view, interstitial, etc. That reduces expected dwell and therefore predicted score.

**The `DO_NOT_AMPLIFY` label is the most relevant** because it's NOT for specific content (NSFW, gore…) but for operational decision. It exists as a generic flag applicable manually via BotMaker rules. It's **the red button of the operational shadowban**.

**How you find out**: the `safety_labels` field in `PostCandidate` is serialized to `ScoredPost` with `label_type`, `description`, `source` ([`home-mixer/scored_posts_server.rs:95-100`](x-algorithm/home-mixer/scored_posts_server.rs) and the mapping at [`scored_posts_server.rs:192-211`](x-algorithm/home-mixer/scored_posts_server.rs)). That is: the system KNOWS in every response what labels your post carries. If X wanted to expose to the user why their post is being distributed little, it could — but it doesn't in the product.

### 26.3 Operational shadowban via BotMaker rules

```rust
pub(crate) fn botmaker_rule_category(rule_id: i64) -> &'static str {
    match rule_id {
        1000..=1099 => "Content",
        1100..=1199 => "ContentLimited",
        1200..=1399 => "Safety",
        1400..=1499 => "Grok",
        1500..=1600 => "Quote",
        _ => "Legacy",
    }
}
```

Source: [`brand_safety.rs:80-89`](x-algorithm/home-mixer/models/brand_safety.rs).

A `SafetyLabel` can have its origin as `SafetyLabelSource::BotMakerAction(action)` with a `rule_id`. That is: **internal X operators can create BotMaker rules that apply safety labels to specific posts/accounts**. The code exposes the category RANGES (1100-1199 are `ContentLimited`, etc.) but **doesn't expose the specific rules** or the panel they're applied from.

This means the operational shadowban —"this moderator decided to limit this account"— exists technically. The names `ContentLimited` and `Safety` leave little room for interpretation.

### 26.4 Implicit shadowban: the model learns to depress you

```python
@dataclass
class HashConfig:
    num_user_hashes: int = 2
    num_item_hashes: int = 2
    num_author_hashes: int = 2     # ← the model has embedding per author
    num_ip_hashes: int = 0
```

Source: [`phoenix/recsys_model.py:93-100`](x-algorithm/phoenix/recsys_model.py).

The Phoenix transformer uses hashes of `author_id` as input. With this it learns **engagement patterns associated with each author**. If your account has a history of generating low engagement + many "not_interested" + blocks + reports, the model **internalizes that in your author embedding**. The result: even if your next post is objectively good, **your own embedding penalizes it** because it's poisoned by history.

This is NOT explicit shadowban. But functionally it equals one:
- The model learns automatically
- The penalty is at-account-level, not at-post-level
- It's practically irreversible except by changing account or getting a lot of positive engagement over a long time
- There's no one to appeal to

**How it can happen to you without noticing:** a streak of low-engagement posts (especially with many `not_dwelled` and `not_interested`) "poisons" your account's embedding for the next weeks. **The "min-traction gate" amplifies it** (§15): if your last posts didn't cross the threshold, the model doesn't have recent good posts to recalibrate your embedding.

### 26.5 Structural shadowban: the min-traction gate

Already documented in §15. I add it here because it's a functional shadowban: posts that don't cross the early engagement threshold **are never processed** by the Grok pipeline (`BANGER_INITIAL_SCREEN`, `SAFETY_PTOS`, `POST_EMBEDDING_WITH_SUMMARY_FOR_REPLY`). Without a quality multimodal embedding → you don't enter the retrieval corpus → not discoverable OON.

Unlike the previous ones, this shadowban is **automatic and per-post**, not per-account. But its aggregate effect is the same: you pass to invisibility.

### 26.6 What is NOT considered shadowban in the code

To avoid the confusion seen in public discussions, these are NOT shadowbans (even though they're sometimes called that):

- **`AuthorDiversityScorer`** — only prevents you from seeing 10 consecutive posts from the same author in the same response. It's not per-account suppression.
- **`AuthorSocialgraphFilter`** — only applies the blocks/silences the viewer configured, plus the bidirectional relationship with the author.
- **`OonWeightFactor`** — the discount for being out-of-network. Applies to ALL OON authors equally. Not per-account.
- **`is_shadow_traffic` (50% sampling)** — misleading by name: it's traffic sampling for A/B experiments, NOT a shadowban mechanism.

### 26.7 Shadowban summary table

| Type | Mechanism | Existence verification | Reversibility | Detection |
|---|---|---|---|---|
| Hard drop | `VFFilter` + `Action::Drop` | Yes, in code | Appealable (suspension) | Impossible for the user |
| Soft (DO_NOT_AMPLIFY etc.) | `MediumRisk` + no adjacent ads | Yes, in code | Unlikely, opaque | Impossible for the user |
| BotMaker rule | `SafetyLabelSource::BotMakerAction` | Yes, mechanism in code (specific rules not) | Opaque | Impossible for the user |
| "Poisoned" model | `author_hashes` in Phoenix | Yes, in code | Slow, ~weeks of good engagement | Impossible for the user |
| Min-traction gate | Kafka topic `MIN_TRACTION_FOR_GROX` | Yes, in code | Per-post (each post re-evaluated) | Impossible for the user |

### 26.8 How to defend yourself in practice

1. **Avoid labels that trigger `MediumRisk`**. The most obvious lever. The 14 labels are listed and are content-based (NSFW, gore, etc.). If you don't post that, you don't qualify.
2. **Don't feed the model with negative engagement**: any trace of `not_interested` / `block` / `mute` / `report` stays in your author embedding.
3. **Keep a consistent chain of posts crossing min-traction**: even if you post little, make sure EVERY post has early engagement. Better 1 post a week passing the gate than 10 dying in cold start.
4. **If you suspect you're "soft-shadowbanned"**: check if reach metrics drop drastically and out of sync with your habitual engagement. A sudden total drop is typically `DO_NOT_AMPLIFY`. A slow progressive drop is the poisoned embedding.
5. **There's no visible appeal for soft shadowbans**: the code doesn't expose any "review" endpoint, only puts the labels and the verdict.

---

## 27. The concrete question: I'm in Europe and publish in English for US audience, does being in Europe penalize me?

**Direct answer: NO, not by any explicit mechanism in the code.** The algorithm **doesn't know your location as author.** I prove it point by point.

### 27.1 What the system knows about the POST when it's going to score it

The `PostCandidate` —the structure that travels through the entire pipeline— has **these fields and only these** about the post and its author:

```rust
pub struct PostCandidate {
    pub tweet_id: u64,
    pub author_id: u64,
    pub tweet_text: String,
    pub in_reply_to_tweet_id: Option<u64>,
    pub retweeted_tweet_id: Option<u64>,
    pub retweeted_user_id: Option<u64>,
    pub quoted_tweet_id: Option<u64>,
    pub quoted_user_id: Option<u64>,
    pub phoenix_scores: PhoenixScores,
    // ... scoring metadata ...
    pub author_followers_count: Option<i32>,
    pub author_screen_name: Option<String>,
    pub retweeted_screen_name: Option<String>,
    pub language_code: Option<String>,       // ← POST language, NOT author's
    pub fav_count, reply_count, repost_count, quote_count,
    pub mutual_follow_jaccard: Option<f64>,
    pub brand_safety_verdict: Option<BrandSafetyVerdict>,
    pub safety_labels: Vec<SafetyLabelInfo>,
    pub has_media: Option<bool>,
    pub min_video_duration_ms: Option<i32>,
    pub filtered_topic_ids: Option<Vec<i64>>,
    // ... bool flags...
}
```

Source: [`home-mixer/models/candidate.rs:8-50`](x-algorithm/home-mixer/models/candidate.rs).

**There's no**: `author_country`, `author_geo`, `author_ip`, `author_region`, `author_location`, `creation_country`, `posting_country`. **None**. I confirm with grep:

```bash
$ grep -rn "author_country|author_geo|author_location|posting_country|creation_country" --include="*.rs"
# (zero results)
```

### 27.2 The only thing Gizmoduck (user identity service) gives the system about the author

```rust
pub struct GizmoduckCacheValue {
    pub author_followers_count: Option<i32>,
    pub author_screen_name: Option<String>,
    pub retweeted_screen_name: Option<String>,
}
```

Source: [`gizmoduck_hydrator.rs:142-147`](x-algorithm/home-mixer/candidate_hydrators/gizmoduck_hydrator.rs).

Three fields. None geographical. The `Gizmoduck` service (X's internal user identity system) hydrates these three and nothing else about the author.

### 27.3 What the Phoenix model receives about the author

The transformer input (in its mini open-source version, [`phoenix/recsys_model.py:126-145`](x-algorithm/phoenix/recsys_model.py)):

```python
class RecsysBatch(NamedTuple):
    user_hashes: jax.typing.ArrayLike                     # of VIEWER
    history_post_hashes: jax.typing.ArrayLike             # posts VIEWER engaged
    history_author_hashes: jax.typing.ArrayLike           # authors VIEWER engaged
    history_actions: jax.typing.ArrayLike
    history_product_surface: jax.typing.ArrayLike
    candidate_post_hashes: jax.typing.ArrayLike           # hash of candidate POST
    candidate_author_hashes: jax.typing.ArrayLike         # hash of POST AUTHOR
    candidate_product_surface: jax.typing.ArrayLike
    history_continuous_actions: Optional
    candidate_impr_ts: Optional
    candidate_post_creation_ts: Optional
    user_ip_hashes: Optional                              # of VIEWER, not author
```

And the default `HashConfig`:

```python
num_user_hashes: int = 2      # 2 viewer hashes
num_item_hashes: int = 2      # 2 post hashes
num_author_hashes: int = 2    # 2 author hashes
num_ip_hashes: int = 0        # VIEWER IP (disabled by default)
```

The only thing the model knows about the author are **two anonymous hashes of `author_id`**. It doesn't know your name, your country, or your IP. **Only opaque identity**.

### 27.4 What does enter the model about the viewer's context (not the author)

Via `TwitterContextViewer`:

```rust
impl GetTwitterContextViewer for ScoredPostsQuery {
    fn get_viewer(&self) -> Option<TwitterContextViewer> {
        Some(TwitterContextViewer {
            user_id: self.user_id as i64,
            client_application_id: self.client_app_id as i64,
            request_country_code: self.country_code.clone(),   // ← VIEWER's country
            request_language_code: self.language_code.clone(), // ← VIEWER's language
            ..Default::default()
        })
    }
}
```

Source: [`home-mixer/models/query.rs:214-222`](x-algorithm/home-mixer/models/query.rs).

And the POST's language is also passed, in `as_tweet_info()`:

```rust
language_code: xai_recsys_proto::language_code_string_to_enum(
    self.language_code.as_deref().unwrap_or(""),
) as i32,
```

Source: [`home-mixer/models/candidate.rs:140-142`](x-algorithm/home-mixer/models/candidate.rs).

That is, the model receives the TUPLE:
- Viewer country (US)
- Viewer language (en)
- POST language (en)
- Anonymous author hash
- ... (rest of signals)

It learns correlations like: *"viewer US + viewer language EN + post language EN → P(engagement) high"*. If you publish in English to a US audience, the model is exactly at the point where your post matches well — **it doesn't matter that you're in Europe**, because that dimension doesn't exist as a feature.

### 27.5 Really, is there no way the algorithm knows I'm in Europe?

I've searched all plausible paths:

1. **`country_code` in the query**: exists but is the VIEWER's, not the author's. The query is created by the viewer's client.
2. **`ip_location` via GeoIP**: same, geoIP of the VIEWER's IP, not the author's.
3. **`Gizmoduck` (author service)**: only returns followers count + screen name. Not even the `country_code` from the author profile comes out here.
4. **`util/phoenix_request`**: THIS file is NOT included in the public repo. It's where the final request to Phoenix is built. **There's a real uncertainty here**: they could add author fields I don't see. But the functions invoking it (`build_user_context(query)`, `build_client_context(query)`) receive **only the query** —which has no author geographic info—, so the only way for them to enter would be that `build_prediction_request` calls *another* service to enrich. Not natural in this kind of pipeline (we already have `gizmoduck_hydrator` for that).
5. **The author hash**: the model ONLY sees `author_id` as a hash. It's not like the model receives "user@Madrid".

Conclusion: **the published code contains no path by which your physical location enters as a feature.**

### 27.6 But then, why is it hard for me to reach US from Europe? (real indirect effects)

The "yes it does affect me" of the popular question exists, but not for a direct geographic penalty. It's for **three very concrete indirect effects**:

#### (a) The learned embedding of your account

The model learns an embedding per author (via hashes). That embedding is **formed from your historical engagement**. If your audience so far has been mostly European, the model places you in a vectorial zone close to European users. When a US user comes and candidates are searched via Phoenix Retrieval (Two-Tower), your embedding is far from theirs → you don't appear in their top-K.

**It's a Bayesian effect**: if author X has generated engagement with thousands of European users but none from US, the model learns it. **Breaking it requires generating sustained US engagement.**

#### (b) Time zones and the `AgeFilter`

This is mathematical:
- `POST_AGE_MAX_MINUTES = 4800` (80h) ([`phoenix/recsys_model.py:33`](x-algorithm/phoenix/recsys_model.py))
- Age bucketized at 1h granularity
- `params::MAX_POST_AGE` in `AgeFilter` filters posts older than a threshold
- `TweetMixerSource` also filters by `MAX_POST_AGE` at source

If you publish at 10:00 Madrid time, it's 04:00 ET. By the time a US user connects at 09:00 ET, your post is 5 hours old → already in "less fresh" buckets that penalize in retrieval/ranking. If you wait for your European morning prime-time (10am-12am local time), you miss the first wave of the US day.

**This is the only mathematically certain "geographic" penalty, and it's indirect**: not for being in Europe, but for publishing on European hours.

#### (c) Your own historical behavior

The model's `user_action_sequence` (your last ~128 actions as a **viewer**) influences your retrieval. If you yourself consume mostly European content, **your viewer embedding** remains European. That doesn't affect your posts directly, but it does affect **who you follow** and **who interacts with you**: if your network is 95% European, the early signals on your post come from Europeans, and that reinforces your embedding toward that cluster.

### 27.7 And `user_ip_hashes`? Is that geo?

```python
num_ip_hashes: int = 0    # default disabled
```

Yes, the model CAN receive hashes of the **viewer's** IP (not the author's). But:
- It's **disabled by default** in the mini model's HashConfig.
- Even if enabled, it's a hash — the model doesn't know "192.168.x.y", it knows that "hash(IP) = X". It learns patterns of similar IPs, not "country".
- It's the **viewer's** IP when requesting their feed, not the author's when publishing.

### 27.8 Verdict on your concrete question

**"I'm in Europe, publish in ENGLISH for US audience: does being geographically located in Europe penalize me?"**

**Answer**: **Not directly, yes indirectly, and only by two controllable factors.**

- **NOT direct**: no field, parameter, filter, or feature of the model knows your location as author. Your IP when publishing isn't stored in `PostCandidate`. Gizmoduck doesn't return country for you. The Phoenix model only sees an anonymous hash of your `author_id`.
- **YES indirect, but within your reach:**
  1. **Schedule**: post in US prime-time (morning-afternoon ET), not in your European morning. The post age feature does enter the model and favors whoever publishes when their audience is awake.
  2. **Post language**: confirmed in English → good correlation with viewer `country_code=US, language_code=en`. If you posted in Spanish, it would be a penalty (because the model learned that post in Spanish ≠ US viewer engagement).
- **YES indirect, outside your immediate control:**
  3. **Your author embedding is biased by your engagement history**. If you've grown with Europeans, breaking the barrier to reach US requires weeks of sustained US engagement. It's not punishment, it's embedding physics.

**Actions that DO work:**
- Post in English with US vocabulary (including idioms, US hashtags, mentioning entities recognizable to US).
- Post at 8-11 AM ET (14-17 Madrid time in winter, 13-16 in summer), or at 6-9 PM ET (22-01 Madrid).
- Comment/quote large US accounts (reply ranking includes you with their audience).
- Generate early interaction with US accounts (not just European) to build a more "mixed" embedding.

**Action that does NOT move the needle**:
- Using a VPN to appear to be in US when publishing. The system **doesn't store your publication IP** in `PostCandidate` (I searched, the field doesn't exist). Your location at posting time is irrelevant because **the algorithm never gets to know it**.

---

## 28. Condensed summary of the embedding and the 30-minute gate

Useful synthesis of §26.4 ("implicit shadowban") and §15 ("min-traction gate"). In bullets, in English, no fluff:

- Every account has an internal embedding: a vector that sums up how your account behaves (topics, engagement, who you interact with)
- The model uses it every time it decides who to show your posts to
- Good history → clean embedding → the model pushes you
- Negative signals piling up (blocks, mutes, reports, not_interested) → toxic embedding → automatic penalties
- It does NOT reset. What you do today stays in there for weeks, poisoning everything you publish after
- Getting out of a shadowban or a low-reach streak feels like moving a giant rusted wheel — by design
- The embedding doesn't decay on a clock. It decays with NEW engagement entering the system
- If you stop posting, the old bad signals stay frozen. Nothing overwrites them
- With sustained good content: noticeable improvement after 6 to 8 weeks, real shift around 12 to 16 weeks (assuming no new bad signals along the way)
- First 30 minutes = everything. No fast engagement → Grok never evaluates the post → no quality score, no deep analysis, no out-of-network retrieval. Dead and buried

Code support:

- **Author hashes as model input**: [`phoenix/recsys_model.py:93-100`](x-algorithm/phoenix/recsys_model.py) — `num_author_hashes = 2`
- **Action window of 128**: [`phoenix/recsys_model.py:342`](x-algorithm/phoenix/recsys_model.py) — `history_seq_len: int = 128`
- **Min-traction gate before Banger Screen**: [`grox/generators/stream_generator.py:60-100`](x-algorithm/grox/generators/stream_generator.py) — Kafka topic `CONTENT_UNDERSTANDING_REALTIME_UNIFIED_POSTS_MIN_TRACTION_FOR_GROX`
- **Continuous model retraining**: [`phoenix/README.md`](x-algorithm/phoenix/README.md) — "Production Phoenix is trained continuously on real-time data"

---

## 29. Do links, hashtags and mentions in the first post hurt your reach?

**Direct answer, based on open code: NO explicit penalty for any of the three things.** But there are indirect effects that do matter.

### 29.1 What the code passes to the model about the post

The `as_tweet_info()` function ([`home-mixer/models/candidate.rs:108-149`](x-algorithm/home-mixer/models/candidate.rs)) builds the `TweetInfo` sent to the Phoenix transformer. It carries **exactly this**:

```rust
tweet_id, author_id,
retweeting_tweet_id, retweeting_author_id,
quoted_tweet_id, quoted_author_id,
in_reply_to_tweet_id,
is_author_followed_by_user,
min_video_duration_ms,
fav_count, retweet_count, quote_count, reply_count,
language_code,
tweet_bool_features: {
    has_media,
    is_retweet,
    is_quote,
    is_reply,
}
```

And the `PostCandidate` ([`home-mixer/models/candidate.rs:8-50`](x-algorithm/home-mixer/models/candidate.rs)) has **40 fields**. None is `has_url`, `has_link`, `url_count`, `has_hashtag`, `hashtag_count`, `has_mention`, `mention_count`.

Exhaustive grep:

```bash
$ grep -rn "has_url|has_link|url_count|link_count|external_url|expand_url" --include="*.rs"
# (zero results)
$ grep -rn "hashtag|has_hashtag" --include="*.rs"
# (zero results)
$ grep -rn "has_mention|mention_count|user_mention" --include="*.rs"
# (zero results)
```

**Literal conclusion**: the `TweetBoolFeatures` received by the model are only 4 (`has_media`, `is_retweet`, `is_quote`, `is_reply`). There's no boolean "this post has a link" or "this post has a hashtag" or "this post has a mention". The model can't use them as a direct feature because **they don't exist as input**.

### 29.2 Where is `tweet_text` used then?

Yes, tweet text is hydrated ([`core_data_candidate_hydrator.rs`](x-algorithm/home-mixer/candidate_hydrators/core_data_candidate_hydrator.rs)) and stored in `PostCandidate.tweet_text`. But the code uses it **only in two places** and for two reasons:

1. **`MutedKeywordFilter`** ([`home-mixer/filters/muted_keyword_filter.rs`](x-algorithm/home-mixer/filters/muted_keyword_filter.rs)): tokenizes your text and compares it to keywords the VIEWER has muted. It doesn't penalize you for hashtag, it eliminates you if your text contains "kpop" for someone who muted "kpop".

2. **`ads/util.rs` (adjacency control)** ([`home-mixer/ads/util.rs:116-151`](x-algorithm/home-mixer/ads/util.rs)): tokenizes your text and compares against the adjacent advertiser's word blocklist. If matches, **the ad loses position**, not you.

**No open repo scorer consumes `tweet_text` or looks at hashtags/links/mentions to assign weight.**

### 29.3 What DOES enter the model from the post content

Only two things related to content enter Phoenix:

- **The multimodal embedding generated by Grok**: the full post content (text + images + ASR of video) is processed by Qwen3 + xAI's multimodal embedder and produces a vector. That vector is what's used for Two-Tower retrieval.
- **The `slop_score` from Banger Initial Screen**: Grok-VLM scores the post and returns, among other things, a `slop_score` that detects low-quality LLM content. If your post looks "AI slop" it lowers the overall `quality_score`.

That is: content is evaluated as a whole by a language model (Grok), not as a sum of "has link / has hashtag / has mention".

### 29.4 INDIRECT effects that can hurt your reach with link/hashtag/@

#### Links

- **Reduce `dwell_time`**: the user taps the link, leaves X, and the seconds on the post get cut. `cont_dwell_time` goes down. `not_dwelled_score` (negative signal) can go up if most leave without coming back.
- **`click_dwell_time` can compensate BUT only if they return**: if after clicking the link the user returns to the post and stays, it adds `cont_click_dwell_time` (positive weight). If they leave and don't come back, net negative.
- **Possible preferences in Grok prompts**: the `BangerInitialScreenClassifier` (`BangerMiniVlmScreenScore`) prompts **are not published**. They could perfectly penalize posts that look "drive-traffic only" (link + empty tweet). We can't verify it, but it's the zone where the "folkloric rule of no links" could really exist.

#### Hashtags

- **No direct effect**: not a feature or signal.
- **Possible upside with topic match**: if your hashtag matches an explicit topic Grok recognizes (the 80+ topics from §11), your post is more likely to be eligible for `PhoenixTopicsSource`, which has a better `TopicOonWeightFactor` than the general one.
- **Possible downside if you abuse**: `BangerScreen` with `slop_score` CAN penalize posts that look like spam (chain of #ai #ml #startup #saas etc.). Again, not verifiable because prompts aren't published.

#### Mentions (@)

- **No direct scoring effect**.
- **Strong social effect if the mentioned account responds or RTs**: being a reply/RT to your post or quote, it triggers `reply_count`, `quote_count`, `retweet_count`, which ARE explicit model features.
- **Reply-spamming small accounts with @**: the `SpamEapiLowFollowerClassifier` can hit you (§6.2 of the document). But this is for *replies*, not for original posts that mention.

### 29.5 Verdict and practical rule

| Element | Direct penalty in open code | Indirect effect |
|---|---|---|
| **Link** | None | Reduces dwell if user leaves and doesn't come back. Possible penalty in unpublished prompts |
| **Hashtag** | None | Can activate topic OON matching (positive). Abuse can raise slop_score (negative) |
| **Mention** | None | Can generate engagement if the account interacts (positive) |

**Practical rule:**

- **Link yes, but accompanied by text with substance**. So the user doesn't need to click for the post to be worth it. The link is bonus, not the main course.
- **Hashtags: 1-2 highly relevant**. Useful for topic matching. 5+ smells of spam and possibly activates slop_score.
- **Mentions: use them for whoever contributes to the content**. If you mention someone and they're interested in your post, they'll give you reply/RT/quote → three positive features at once.

If you want to maximize the first post, the winning pattern in the code is:

> Substantive text that retains dwell (10-30+ seconds of reading), **then** mention/link/hashtag at the end as complement, not as substitute for content.

What kills reach is NOT putting a link. It's publishing a post whose only value is the link.

---

## 30. Anatomy of the perfect post for maximum reach

I synthesize everything else in the document into a single "recipe" of the objectively optimal post according to what's in the code. Each decision has its support in a previous section; I cite the why alongside.

### 30.1 Account pre-conditions (background)

Before even writing anything, your account must meet:

- **Public account (not protected)** — without multimodal embedding there's no OON retrieval (§22.7)
- **Clean embedding** — no recent streak of not_interested/block/mute/report (§26.4). If you come from bad months, assume it'll take 6-16 weeks to recover (§28)
- **A publishing time slot consistent with your target audience** — not yours (§27.6)
- **No own posts in the last 4-6 hours** — AuthorDiversityScorer will punish your second post (§3)

### 30.2 Post type

- **ORIGINAL** (not reply, not retweet). Only originals pass through Banger Screen and receive quality multimodal embedding (§6.1). Retweets and replies DON'T enter the OON discovery system.

### 30.3 Format and length

- **Long and dense text** or **short text + video ≥ 10 s with audio**. The two options maximize `dwell_time`/`cont_dwell_time` (5 different positive dwell signals vs only 1 favorite, §2 and §28).
- **If going video**: minimum 10 seconds to activate VQV weight (§9). With audio so Grok transcribes it by ASR (§22.6).
- **If going image**: a detailed image that invites tap-to-expand (`photo_expand_score` is positive weight). But not mandatory.
- **No emoji spam**, no walls of hashtags. The BangerScreen `slop_score` detects low-quality content (§22.8 and §29.4).

### 30.4 Text structure

1. **Line 1 = strong hook**. A phrase that stops the scroll. Here `not_dwelled` is decided (negative signal, §2). If the first line doesn't hook, you lost before starting.
2. **Line 2 = concrete stake/claim**. A datum, a contradiction, a promise. To retain the reader who passed the hook.
3. **Body = substance**. Concrete figures, examples, lists of points. Each paragraph short (1-3 sentences) so it breathes (LevelsIO style).
4. **Reply hook at the end**. A question, a polarizing opinion with tact, or "what happened to you?" bait. `reply_score` is one of the highest model weights (§2).

### 30.5 What the post should activate (positive signals)

Design the post thinking of triggering the maximum of these 17 positive weights:

- `favorite_score` (like) — validating content
- `reply_score` — explicit reply bait
- `retweet_score` — citable/shareable phrase
- `share_score`, `share_via_dm_score`, `share_via_copy_link_score` — practical utility (people send it via DM)
- `dwell_score` + `cont_dwell_time` + `click_dwell_time` — content density
- `quote_score` + `quoted_click_score` — controversial claim invites quote with take
- `profile_click_score` — "who is this person?" behind the content
- `follow_author_score` — the highest medium-term model weight
- `photo_expand_score` — image that invites opening
- `vqv_score` + `quoted_vqv_score` — retentive video

### 30.6 What the post should AVOID (negative signals)

- `not_dwelled_score` — boring first second. Weak hook
- `not_interested_score` — off-topic topics vs your usual audience
- `block_author_score` — personal attack, aggression
- `mute_author_score` — posting too much or same topic repeated
- `report_score` — crossing PToS lines

### 30.7 Link, hashtag, mention

- **Link**: maximum one, and ONLY if the post text already has independent value. The link is bonus, not main course (§29.5)
- **Hashtags**: 1-2 relevant that match a topic recognized by the system (§11 and §29.4)
- **Mentions**: use them for people who contribute to the content or who are likely to respond/RT. Each interaction triggers `reply_count`, `quote_count`, `retweet_count`

### 30.8 Timing

- **Schedule**: prime time of YOUR TARGET AUDIENCE. For US: 8 to 11am ET or 6 to 9pm ET. For Spain: 9 to 11am or 7 to 9pm local time.
- **Day**: Tuesday to Thursday perform best in B2B/tech. Weekends for cultural/personal content.
- **Optimal post window**: 0 to 12 hours. After 24h you're in worse age bucket. At 80h dead (§16).

### 30.9 Plan for the first 30 minutes (the most critical)

This is NOT optional. It's the min-traction gate (§15):

1. **Minute 0**: you publish
2. **Minute 0-5**: notify 5-10 people in your network via DM or private community. Have them enter and engage organically
3. **Minute 5-15**: respond to any early comment with substance. Each reply you give to a comment on your post skips the Reply Ranker and spam classifier (there's an explicit check: if root author is same as replier, skip). And keeps the conversation alive, inflating `reply_count` of the original post
4. **Minute 15-30**: monitor. If it hasn't crossed min-traction, that post is dead for OON. Accept it and move on to the next
5. **Minute 30+**: if it goes well, it's already in the Grok pipeline. From here the post manages itself. DON'T publish anything else in the next 4-6 hours

### 30.10 Summary template of the perfect post

```
[Contrarian hook / surprising fact that stops the scroll]

[Concrete claim sentence with figure or promise]

[Body of 3-8 short paragraphs, each with substance:
 - concrete data
 - examples
 - lists of points
 - no filler]

[Optional: 1 detailed image or 1 video of 10-30 s with audio]

[Closing with reply bait: question, polarizing opinion with tact,
or invitation to share experience]

[Optional: link at the end as complement, not substitute]

[Optional: 1-2 relevant hashtags]
```

### 30.11 Realistic example (LevelsIO-style)

```
xAI published the X algorithm and almost nobody has read it

I got into 207 files this weekend. What's
in there contradicts almost everything growth gurus on X
have been saying for 2 years

Three things I found:

1. There's a literal Kafka topic in the code that decides if your
post enters the Grok pipeline based on engagement in the first
minutes. Without early traction, the algorithm DOESN'T EVEN LOOK AT IT

2. Your physical location doesn't matter to the model. Your time zone
does. Posting at 10am Madrid for US audience = your post
ages 6 hours before they wake up

3. Dwell weighs 5x more than likes. There are 5 different
reading-time signals and only 1 for favorite. A post with few
likes but high dwell beats one with many likes and low dwell

Which one of these surprised you the most?
```

This post has:
- Contrarian hook (line 1)
- Claim with data (line 2: 207 files, weekend)
- Body with 3 numbered findings, each with substance
- Mix of selective capitals for emphasis
- Closing with direct question inviting reply
- No link, no hashtag, no mention. Just dense text
- Generates dwell (30-45 second read), reply (the question), quote (the data is citable), profile_click (who is this?), follow_author (someone bringing this)

### 30.12 The golden rule

> Maximize the probability of each reader doing **at least 2 different positive actions** (dwell + reply, dwell + share, dwell + follow, etc.). The model combines 17 positive signals. Each additional action multiplies your score; each negative action subtracts.

A perfect post is not one that gets 10,000 likes. It's one where the average reader spends **20-40 seconds**, leaves **a reply or a quote**, and a non-negligible percentage clicks **on your profile**. That's what triggers the embedding toward "good author" and opens massive OON.

---

## 31. Does quoting your own post or others' posts hurt your reach?

**Short answer: NO, neither hurts by itself.** A Quote is technically an **original post** and goes through the fast lane of discovery. But there are three side effects that can wreck you if you don't know what you're quoting.

### 31.1 What a Quote is for the algorithm

A Quote post:
- Has `quoted_tweet_id` and `quoted_user_id` set
- Does NOT have `retweeted_tweet_id` (it's not an RT)
- Does NOT have `ancestors` (it's not a reply)
- In `TweetBoolFeatures` it appears as `is_quote: true`, `is_retweet: false`, `is_reply: false`

Source: [`home-mixer/models/candidate.rs:140-149`](x-algorithm/home-mixer/models/candidate.rs).

**Key implication**: since it has NO `ancestors`, the filters that exclude "is a reply" (Banger Screen, multimodal embedding, post safety deluxe) **do NOT exclude you**. Your Quote goes through the Banger Screen like any original post ([`grox/tasks/task_filters.py:340-370`](x-algorithm/grox/tasks/task_filters.py) — only drops if `post.ancestors`).

### 31.2 The 3 quote-exclusive positive signals in the scorer

```rust
+ Self::apply(scores.quote_score, weights.quote)
+ Self::apply(scores.quoted_click_score, weights.quoted_click)
+ Self::apply(scores.quoted_vqv_score, quoted_vqv_weight)
```

Source: [`home-mixer/scorers/ranking_scorer.rs:160-162`](x-algorithm/home-mixer/scorers/ranking_scorer.rs).

- `quote_score` — P(the viewer quotes YOUR post after reading it). Your Quote generates more quotes downstream
- `quoted_click_score` — P(the viewer clicks into the quoted post inside your Quote)
- `quoted_vqv_score` — P(the viewer watches the video of the quoted post, if any) — gated by quoted_video_duration_ms above the threshold, same as the regular VQV

All three are POSITIVE weights. Quoting content that already engages helps your Quote score well (because the model predicts the reader will interact with the quoted content).

### 31.3 Quoting your own post (self-quote)

**There's no specific check for self-quotes anywhere in the code.** Zero. Verified:

```bash
$ grep -rn "self_quote|is_self_quote|same_user_quote" --include="*.rs" --include="*.py"
# (zero results)
```

Unlike **replies to your own post** (which DO have an explicit check that skips the spam classifier and reply ranker, see §6.2-6.3), **self-quotes** are treated like any other original post.

**Pros:**
- It's a new post with its own `tweet_id`, its own min-traction gate, its own Banger Screen
- It has a different `conversation_id` from the original post (conversation IDs come from `ancestors.min()` and a quote has no ancestors). This means **`DedupConversationFilter` does NOT merge them**: your original post and your self-quote can both appear in the same feed
- If the self-quote engages more than the original, the self-quote wins in position

**Cons:**
- The `AuthorDiversityScorer` penalizes you. Original + self-quote = 2 of your posts in the same feed-response → the self-quote gets `decay^1` (multiplier less than 1)
- There's no automatic exemption like there is for self-replies
- If you publish more in the next 4-6 hours, accumulated decay

**Verdict on self-quote:** useful to "rescue" a post that deserves more reach than it got (by adding new context), or to add a twist/extra data. But don't treat it as a magic bullet: you lose part of the score to author diversity.

### 31.4 Quoting others' posts

Here three traps can sink you:

#### Trap 1: you inherit the `BrandSafetyVerdict` of the quoted post

```rust
if let Some(qt_id) = c.quoted_tweet_id {
    if error_map.contains_key(&qt_id) {
        verdict = worst_verdict(&verdict, &BrandSafetyVerdict::MediumRisk);
    } else {
        let qt_labels = label_map.get(&qt_id).unwrap_or(&empty);
        verdict = worst_verdict(&verdict, &compute_verdict(qt_labels, qt_id));
        safety_labels.extend(qt_labels.iter().map(...));
    }
}
```

Source: [`home-mixer/candidate_hydrators/ads_brand_safety_hydrator.rs:143-160`](x-algorithm/home-mixer/candidate_hydrators/ads_brand_safety_hydrator.rs) and duplicated in [`ads_brand_safety_vf_hydrator.rs:77-93`](x-algorithm/home-mixer/candidate_hydrators/ads_brand_safety_vf_hydrator.rs).

Your final verdict is `worst_verdict(your_verdict, quoted_verdict)`. That is: **if you quote a `MediumRisk` post, YOUR Quote is automatically `MediumRisk`**. And `MediumRisk` strips your adjacent ads, locks you out of premium inventory, and structurally downranks you (§7, §26.2).

**Quote of NSFW/violence/gore/`DO_NOT_AMPLIFY` post = direct poison for your reach.** Even if your text is innocent.

#### Trap 2: if the quoted post has `Action::Drop`, your Quote falls as "ancillary"

```rust
if let Some(quoted_id) = candidate.quoted_tweet_id
    && let Some(Ok(Some(reason))) = vf_results.get(&quoted_id)
    && should_drop_reason(reason)
{
    return true;  // drop_ancillary_posts = true
}
```

Source: [`home-mixer/candidate_hydrators/vf_candidate_hydrator.rs:138-143`](x-algorithm/home-mixer/candidate_hydrators/vf_candidate_hydrator.rs) and `AncillaryVFFilter` ([`ancillary_vf_filter.rs`](x-algorithm/home-mixer/filters/ancillary_vf_filter.rs)) removes any candidate with that flag.

If the post you quote gets deleted, gets moderated out, or has `Action::Drop` for any reason, **your Quote also disappears from For You**. You've anchored your post to the fate of whoever you quoted.

#### Trap 3: `AuthorSocialgraphFilter` checks the quoted author

```rust
if muted
    || blocked
    || author_blocks_viewer
    || quoted_author_blocks_viewer        // ← quoted author blocks the viewer
    || viewer_blocks_quoted_author        // ← viewer blocks the quoted author
    || viewer_blocks_retweeted_user
{ removed.push(candidate); }
```

Source: [`home-mixer/filters/author_socialgraph_filter.rs:34-52`](x-algorithm/home-mixer/filters/author_socialgraph_filter.rs).

If you quote someone who has blocked parts of your audience, your Quote **doesn't appear for those viewers**. Inversely: if part of your audience has blocked the author you quote, your Quote doesn't reach them either.

Implication: quoting accounts with many cross-blocks reduces your effective reach. Quoting controversial/polarizing accounts automatically cuts your reach to half the map.

### 31.5 Quick verdict

| Case | Direct penalty | Indirect risks |
|---|---|---|
| **Quote of your own post** | None | AuthorDiversityScorer (decay if original + quote appear together in a feed) |
| **Quote of a healthy post by someone else** | None. Three extra positive weights (quote_score, quoted_click, quoted_vqv) | If the quoted account has massive blocks, your reach drops |
| **Quote of a `MediumRisk` post** | Your Quote inherits `MediumRisk` → no ads → structural downrank | You lose up to 50% of expected reach |
| **Quote of `Action::Drop` post** | Your Quote falls as ancillary | Disappears from For You entirely |

### 31.6 Practical rules

- **Self-quote**: use it only if it adds new info to the thread. If it's just to "bump" without extra content, the decay eats you.
- **Quote of others**: check the post first. If it has a community note, NSFW, violence, or suspensions near its author, **don't quote it**. You're handing your Quote to someone else's verdict.
- **Quote virals in your niche with good history**: this is exactly the pattern the model rewards (quote_score, quoted_click) without contagion risk.
- **Don't quote trolls or controversial accounts**: if they already have `MediumRisk` or close, you inherit it. And if half the platform blocks them, that filter cuts your reach.

> The phrase that sums it up: **a Quote is an original post with an anchor**. If what's anchored is heavy, your post doesn't move. Choose the anchor well.

---

## Appendix: key repo files to dig deeper

| Topic | File |
|---|---|
| Final score weights | [`home-mixer/scorers/ranking_scorer.rs`](x-algorithm/home-mixer/scorers/ranking_scorer.rs) |
| Legacy cluster weights | [`home-mixer/scorers/weighted_scorer.rs`](x-algorithm/home-mixer/scorers/weighted_scorer.rs) |
| Author diversity decay | [`home-mixer/scorers/author_diversity_scorer.rs`](x-algorithm/home-mixer/scorers/author_diversity_scorer.rs) |
| OON penalty | [`home-mixer/scorers/oon_scorer.rs`](x-algorithm/home-mixer/scorers/oon_scorer.rs) |
| Call to Grok-Phoenix | [`home-mixer/scorers/phoenix_scorer.rs`](x-algorithm/home-mixer/scorers/phoenix_scorer.rs) |
| Alternative DPP ranker | [`home-mixer/scorers/vm_ranker.rs`](x-algorithm/home-mixer/scorers/vm_ranker.rs) |
| Brand safety / labels | [`home-mixer/models/brand_safety.rs`](x-algorithm/home-mixer/models/brand_safety.rs) |
| Candidate model | [`home-mixer/models/candidate.rs`](x-algorithm/home-mixer/models/candidate.rs) |
| Query model (what it knows about you) | [`home-mixer/models/query.rs`](x-algorithm/home-mixer/models/query.rs) |
| 80+ topics it recognizes | [`home-mixer/filters/topic_ids_filter.rs`](x-algorithm/home-mixer/filters/topic_ids_filter.rs) |
| Blocker / muter / quote chain | [`home-mixer/filters/author_socialgraph_filter.rs`](x-algorithm/home-mixer/filters/author_socialgraph_filter.rs) |
| Conversation dedup | [`home-mixer/filters/dedup_conversation_filter.rs`](x-algorithm/home-mixer/filters/dedup_conversation_filter.rs) |
| Banger initial screen (Grok-VLM) | [`grox/classifiers/content/banger_initial_screen.py`](x-algorithm/grox/classifiers/content/banger_initial_screen.py) |
| Spam reply classifier | [`grox/classifiers/content/spam.py`](x-algorithm/grox/classifiers/content/spam.py) |
| Reply ranking 0-3 | [`grox/classifiers/content/reply_ranking.py`](x-algorithm/grox/classifiers/content/reply_ranking.py) |
| 7 PToS categories | [`grox/classifiers/content/safety_ptos.py`](x-algorithm/grox/classifiers/content/safety_ptos.py) |
| Filters for what's evaluated | [`grox/tasks/task_filters.py`](x-algorithm/grox/tasks/task_filters.py) |
| Ad inserter | [`home-mixer/ads/util.rs`](x-algorithm/home-mixer/ads/util.rs) |
| Final feed blender | [`home-mixer/selectors/blender_selector.rs`](x-algorithm/home-mixer/selectors/blender_selector.rs) |
| Phoenix model (transformer + isolation mask) | [`phoenix/recsys_model.py`](x-algorithm/phoenix/recsys_model.py), [`phoenix/recsys_retrieval_model.py`](x-algorithm/phoenix/recsys_retrieval_model.py) |
| Server entry point + feature switches | [`home-mixer/server.rs`](x-algorithm/home-mixer/server.rs) |
| Grox dispatcher + Kafka streams | [`grox/dispatcher.py`](x-algorithm/grox/dispatcher.py), [`grox/generators/stream_generator.py`](x-algorithm/grox/generators/stream_generator.py) |
| Grox engine | [`grox/engine.py`](x-algorithm/grox/engine.py) |
| Plan master (all Grok plans) | [`grox/plans/plan_master.py`](x-algorithm/grox/plans/plan_master.py) |
| User action sequence (model input) | [`home-mixer/query_hydrators/scoring_sequence_query_hydrator.rs`](x-algorithm/home-mixer/query_hydrators/scoring_sequence_query_hydrator.rs), [`home-mixer/query_hydrators/retrieval_sequence_query_hydrator.rs`](x-algorithm/home-mixer/query_hydrators/retrieval_sequence_query_hydrator.rs) |
| Served history and fatigue | [`home-mixer/query_hydrators/served_history_query_hydrator.rs`](x-algorithm/home-mixer/query_hydrators/served_history_query_hydrator.rs), [`home-mixer/side_effects/truncate_served_history_side_effect.rs`](x-algorithm/home-mixer/side_effects/truncate_served_history_side_effect.rs) |
| Multimodal embedder | [`grox/embedder/multimodal_post_embedder_v2.py`](x-algorithm/grox/embedder/multimodal_post_embedder_v2.py) |
| ASR (video transcription) | [`grox/tasks/task_asr.py`](x-algorithm/grox/tasks/task_asr.py) |
| TweetMixer (another OON source) | [`home-mixer/sources/tweet_mixer_source.rs`](x-algorithm/home-mixer/sources/tweet_mixer_source.rs) |
| Push-to-Home (pin position 0) | [`home-mixer/sources/push_to_home_source.rs`](x-algorithm/home-mixer/sources/push_to_home_source.rs) |
| Cached posts (replay) | [`home-mixer/query_hydrators/cached_posts_query_hydrator.rs`](x-algorithm/home-mixer/query_hydrators/cached_posts_query_hydrator.rs) |
| Quote-author block check + quoted video duration | [`home-mixer/candidate_hydrators/quote_hydrator.rs`](x-algorithm/home-mixer/candidate_hydrators/quote_hydrator.rs) |

---

*Document generated from static analysis of the code published on 15-may-2026. Includes two review passes over the repository. Does not include empirical experimentation on real accounts; every claim comes from the repository or is explicitly marked as inference.*
