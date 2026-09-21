# Jev Post Scorer for X

A Chrome extension that scores your X draft in real time. Jev makes the judgments;
plain code does the arithmetic and the rule checks.

## Install

1. Unzip this folder somewhere permanent (moving it later breaks the install).
2. Chrome -> `chrome://extensions`
3. Turn on **Developer mode** (top right).
4. **Load unpacked** -> select this folder.
5. Click the extension icon, paste your TypeSafe API key, hit **Save**, then **Test key**.
6. Open x.com and start typing a post.

## How the score is built

Jev is asked seven independent judgments over the draft, in one request:

| Judgment | Type | Maps to |
|---|---|---|
| `forwardability` | score | `share_via_copy_link`, weight **20.0** - the top positive weight in `param.rs` |
| `discussion_pull` | score | `reply` (5.0, 20.0 for mutuals) + `quote` (5.0) |
| `hook_strength` | score | whether line 1 earns the impression |
| `specificity` | score | concreteness; drives forwarding |
| `ai_slop` | score | the `slop_score` field in the Banger Screen output |
| `engagement_bait` | noul | `SpamEngagementBaiting` / `SpamEngagementFarming` |
| `attack_target` | noul | `HateOrAbuseInsultsWithTarget` -> OON drop |

The five score dimensions combine as a weighted sum (forwardability 0.32, reply pull 0.20,
hook 0.18, specificity 0.15, not-slop 0.15). The two noul judgments are **gates**, not
weights: a policy hit caps the score outright rather than being averaged away by good writing.

Structural checks stay in code, never in the model: hashtag count, @mention count and
link-shortener domains are counted with a regex.

**Bands:** 85+ ship it - 70-84 solid - 50-69 needs work - under 50 rewrite.
85+ is deliberately hard; a genuinely good post typically lands low 80s.

## What it deliberately does not do

- **No length scoring.** There is no length feature anywhere in the ranking code. Posts are
  scored on substance, not character count.
- **No invented thresholds.** The min-traction value, the Banger Screen prompt and the Reply
  Ranker prompt are excluded from xAI's public release. Nothing here pretends to know them.

## Cost and rate

Roughly **$0.00007 per scored draft** (~1,600 input tokens at $0.042/M). Scoring fires 750ms
after you stop typing, only past 20 characters, and identical text is served from cache. Heavy
drafting runs a few cents a month. The options page tracks a running total.

## Privacy

The API key lives in `chrome.storage.local` on this machine - not synced, and never exposed to
the x.com page. Draft text goes from the extension's service worker to `api.typesafe.ai` and
nowhere else. Nothing is logged or persisted beyond the cost counter.

## Changelog

**1.3.0** - fixes a tab freeze introduced in 1.1, and a stalled-scoring bug.
*Freeze:* the body MutationObserver called `tick()`, `tick()` called `render()`, `render()`
wrote `innerHTML` into the card, and the card lives in `document.body` - so the observer
re-fired immediately. MutationObserver callbacks are microtasks, so the loop never yielded
to the browser. Three guards now: `render()` is a no-op unless the rendered state actually
changed, ticks coalesce to one pass per animation frame, and the body observer ignores
mutations originating inside the card.
*Stalled scoring:* the debounce timer was cleared on every tick, so on a page mutating faster
than 750ms - which X does constantly - the deadline was pushed back forever and the request
never fired. The timer now only restarts when the draft text itself changes.
Verified by loading both builds into a real Chromium against a page reproducing X's composer
nesting and SPA churn: the pre-fix build froze (0 frames rendered, typing could not complete),
the fixed build stayed responsive at 231 frames and rendered a score.


**1.2.0** - the card now tracks the draft's *content*, not keystrokes. A MutationObserver on
the editor subtree (with `characterData`) means paste, drag-drop, emoji-picker inserts,
undo/redo and restored drafts all score, not just typing.

**1.1.0** - fixes the card intermittently not appearing.
`div[data-testid^="tweetTextarea_"]` matched three nested nodes on the live page
(`tweetTextarea_0_label`, `...RichTextInputContainer`, and the real `tweetTextarea_0`).
`querySelector` returned the outermost, whose `innerText` is the placeholder
"What's happening?" - 17 characters before you type anything. The event path bound to the
real editor while the observer path bound to the wrapper, and whichever won was a race.
Now requires `[contenteditable="true"]`, re-resolves the node every tick rather than caching
it, reads text only from the editor, drops the minimum to 10 characters, and shows a
"keep typing" state as soon as the box is focused.

## If the overlay stops appearing

X ships DOM changes often. The composer is found via `COMPOSER_SEL` at the top of
`content.js`. Set `DEBUG = true` on the line above it to trace binding decisions in the
console, then reload the extension.
