// Jev Post Scorer for X - service worker.
// All network calls live here: the content script has no host permission and
// would hit CORS. Judgments come from Jev; composition and structural checks
// are plain code.

const API_BASE = 'https://api.typesafe.ai';
const ENDPOINT = '/v1/systemone';
const MODEL = 'jev-latest';
const RATE_IN_PER_M = 0.042;   // https://docs.typesafe.ai/models.md
const TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// The judgment set.
//
// Each dimension maps to something the published ranking code actually rewards
// (home-mixer/params/param.rs) or something the visibility filters punish.
// Ordered criteria arrays are Score levels, low to high.
// ---------------------------------------------------------------------------
const QUESTIONS = {
  forwardability: {
    type: 'score',
    instructions:
      'The single highest-weighted positive action in X\'s ranking code is share_via_copy_link (weight 20.0): ' +
      'someone copying the post\'s link to paste into a Slack, a DM or a document. That only happens when the ' +
      'post makes complete sense stripped of the author\'s profile, the thread it sits in, and the surrounding ' +
      'feed. Judge `post_text` on exactly that: how self-contained and reference-grade is it?',
    criteria: [
      'Meaningless without external context - it replies to, subtweets or continues something the reader cannot see.',
      'Understandable but disposable; nothing a reader would save or forward to anyone.',
      'Self-contained and useful; a reader might forward it to one specific person who cares about the topic.',
      'Fully self-contained and reference-grade; the kind of post people paste into a group chat or bookmark to cite later.'
    ]
  },
  hook_strength: {
    type: 'score',
    instructions:
      'Judge only the FIRST line or sentence of `post_text`. A strong opening states a concrete claim, a number, ' +
      'or a specific tension, and teaches the reader something immediately. A weak opening is a curiosity gap ' +
      'that withholds the point ("a thread on why most people get this wrong"), a throat-clearing preamble, or a ' +
      'vague abstraction.',
    criteria: [
      'Pure curiosity gap or throat-clearing; withholds the point and promises value later.',
      'Generic or abstract opening; states a topic rather than a claim.',
      'A clear specific claim or observation the reader can immediately grasp.',
      'A concrete claim, number or sharp tension that delivers real information in the first line by itself.'
    ]
  },
  discussion_pull: {
    type: 'score',
    instructions:
      'reply (weight 5.0, rising to 20.0 between mutual follows) and quote (weight 5.0) are the actions that carry ' +
      'a post into new feeds. Both require the reader to want to say something back in their own words. Judge how ' +
      'strongly `post_text` invites a genuine reply or a quote-post with the reader\'s own take. A real open ' +
      'question or a claim sharp enough to argue with both qualify; a demand for engagement does not.',
    criteria: [
      'Closed and inert; there is nothing a reader could meaningfully add or dispute.',
      'Mildly interesting but gives the reader no specific opening to respond to.',
      'Contains a real question or a position a reader would plausibly want to answer or push back on.',
      'Stakes out a sharp, specific, arguable position - readers would quote it to agree loudly or disagree loudly.'
    ]
  },
  specificity: {
    type: 'score',
    instructions:
      'Judge how concrete `post_text` is. Concrete means numbers, names, dates, mechanisms, worked examples and ' +
      'first-hand detail. Abstract means adjectives, generalities, motivational framing and claims that could ' +
      'have been written by someone who has not done the thing.',
    criteria: [
      'Entirely abstract; adjectives and generalities with no verifiable detail whatsoever.',
      'Mostly general, with at most one concrete touch.',
      'Several concrete details - specific numbers, names or mechanisms carry the point.',
      'Densely specific throughout; every claim is anchored to a number, a name, a mechanism or a real example.'
    ]
  },
  ai_slop: {
    type: 'score',
    instructions:
      'X\'s content-understanding pipeline computes an explicit `slop_score` for posts. Judge how strongly ' +
      '`post_text` reads as generic machine-generated filler. Tells include: heavy em-dash rhythm, tricolon lists ' +
      'of three adjectives, the "it\'s not X, it\'s Y" construction, LinkedIn-style inspirational cadence, ' +
      'hollow profundity, and an even corporate register with no personal voice. Higher levels mean MORE slop.',
    criteria: [
      'Distinctly human voice; idiosyncratic phrasing, specific and unpolished in a way no template produces.',
      'Clean ordinary writing with no particular AI tells.',
      'Noticeably formulaic; several stock constructions or an unnaturally even inspirational cadence.',
      'Textbook AI slop; stacked em-dashes, tricolons, "not X but Y" antithesis and empty profundity.'
    ]
  },
  engagement_bait: {
    type: 'noul',
    instructions:
      'Does `post_text` explicitly ask readers to perform an engagement action, in the way X\'s ' +
      'SpamEngagementBaiting and SpamEngagementFarming policies describe? Examples of a hit: "like if you agree", ' +
      '"reply YES for the link", "RT to enter", "follow me for more", "comment \'guide\' and I\'ll DM it". ' +
      'A sincere question the author actually wants answered is NOT engagement bait.',
    criteria: {
      true: 'The post explicitly instructs readers to like, repost, reply, follow or comment a keyword in order to get something or to signal agreement.',
      false: 'No such instruction; any question present is a genuine one the author would actually want answered.'
    }
  },
  attack_target: {
    type: 'noul',
    instructions:
      'X\'s HateOrAbuseInsultsWithTarget policy drops a post from out-of-network recommendations when it insults ' +
      'a specific person or group, as opposed to forcefully arguing against a position. Strong disagreement with ' +
      'an idea is explicitly fine and is rewarded. Does `post_text` attack a person or a group of people?',
    criteria: {
      true: 'Directs insult, contempt or demeaning characterisation at a named person or at a group of people.',
      false: 'Attacks only ideas, claims, products, institutions or behaviours - or attacks nothing at all.'
    }
  }
};

// Positive dimensions and their share of the base score. Rough mirror of the
// published weight table: copy-link share (20.0) dominates, reply and quote
// (5.0 each) come next.
const WEIGHTS = {
  forwardability: 0.32,
  discussion_pull: 0.20,
  hook_strength: 0.18,
  specificity: 0.15,
  ai_slop: 0.15   // inverted below: less slop scores higher
};

// ---------------------------------------------------------------------------
// Structural checks - known rules stay in code, not in the model.
// ---------------------------------------------------------------------------
const SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorturl.at', 'is.gd', 'rb.gy', 'linktr.ee', 'lnkd.in'
];

function structuralFlags(text) {
  const flags = [];
  const hashtags = (text.match(/(^|\s)#[A-Za-z0-9_]+/g) || []).length;
  const mentions = (text.match(/(^|\s)@[A-Za-z0-9_]{1,15}/g) || []).length;
  const lower = text.toLowerCase();

  if (hashtags > 1) {
    flags.push({ id: 'hashtags', severity: 'warn', penalty: 8,
      text: hashtags + ' hashtags - SpamHashTagAbuse. Keep to 0 or 1.' });
  }
  if (mentions > 2) {
    flags.push({ id: 'mentions', severity: 'warn', penalty: 5,
      text: mentions + ' @mentions - SpamMentionAbuse risk if they do not follow you.' });
  }
  for (const d of SHORTENERS) {
    if (lower.includes(d)) {
      flags.push({ id: 'shortener', severity: 'block', cap: 40,
        text: 'Link shortener (' + d + ') - a LOW_QUALITY verdict in the redirect chain triggers SPAM_HIGH_RECALL. Link the destination directly.' });
      break;
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Composition. Weighted sum for compensating preferences; hard caps for
// policy hits, which do not trade off against good writing.
// ---------------------------------------------------------------------------
function compose(answers, text) {
  const norm = (id) => {
    const a = answers[id];
    if (!a || typeof a.score !== 'number') return 0.5;
    const levels = Object.keys(a.legend || a.probabilities || { 0: 1 }).length;
    return levels > 1 ? a.score / (levels - 1) : 0.5;
  };

  const dims = {
    forwardability: norm('forwardability'),
    discussion_pull: norm('discussion_pull'),
    hook_strength: norm('hook_strength'),
    specificity: norm('specificity'),
    ai_slop: 1 - norm('ai_slop')        // inverted: high slop -> low contribution
  };

  let base = 0;
  for (const k of Object.keys(WEIGHTS)) base += WEIGHTS[k] * dims[k];
  let score = Math.round(base * 100);

  const flags = structuralFlags(text);

  const bait = answers.engagement_bait?.noul ?? 0;
  if (bait > 0.5) {
    flags.push({ id: 'bait', severity: 'block', cap: 35,
      text: 'Reads as an engagement-bait CTA - SpamEngagementBaiting. Ask something you actually want answered.' });
  }
  const attack = answers.attack_target?.noul ?? 0;
  if (attack > 0.5) {
    flags.push({ id: 'attack', severity: 'block', cap: 30,
      text: 'Aimed at a person or group - HateOrAbuseInsultsWithTarget drops you from out-of-network. Attack the claim instead.' });
  }
  if (dims.ai_slop < 0.34) {
    flags.push({ id: 'slop', severity: 'warn', penalty: 0,
      text: 'Reads as AI slop - rewrite in your own voice.' });
  }

  for (const f of flags) {
    if (f.penalty) score -= f.penalty;
    if (f.cap != null) score = Math.min(score, f.cap);
  }
  score = Math.max(0, Math.min(100, score));

  let verdict, band;
  if (score >= 85)      { verdict = 'ship it';     band = 'great'; }
  else if (score >= 70) { verdict = 'solid';       band = 'good'; }
  else if (score >= 50) { verdict = 'needs work';  band = 'mid'; }
  else                  { verdict = 'rewrite';     band = 'bad'; }

  // Weakest positive dimensions, for the fix hint.
  const weakest = Object.keys(WEIGHTS)
    .map((k) => ({ k, v: dims[k] }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 2)
    .filter((d) => d.v < 0.67)
    .map((d) => d.k);

  return { score, verdict, band, dims, flags, weakest };
}

// ---------------------------------------------------------------------------
// Jev call
// ---------------------------------------------------------------------------
async function scoreDraft(text, apiKey) {
  const body = {
    model: MODEL,
    state: {
      post_text: text,
      platform: 'X (formerly Twitter)',
      character_count: text.length
    },
    questions: QUESTIONS
  };

  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(API_BASE + ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { ok: false, error: 'Jev timed out.' };
    return { ok: false, error: 'Could not reach Jev. Check your connection.' };
  }
  clearTimeout(timer);
  const latencyMs = Math.round(performance.now() - t0);

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Jev rejected the API key. Check it in the extension options.' };
  }
  if (res.status === 429) {
    return { ok: false, error: 'Rate limited by Jev. Pausing briefly.', retryAfterMs: 20000 };
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 160);
    return { ok: false, error: 'Jev returned ' + res.status + '. ' + detail };
  }

  const out = await res.json();
  const answers = out.answers || {};
  const usage = out.usage || { input_tokens: 0, output_tokens: 0 };
  const costUsd = (usage.input_tokens / 1e6) * RATE_IN_PER_M;

  const composed = compose(answers, text);
  return { ok: true, ...composed, latencyMs, costUsd, model: out.model || MODEL };
}

// ---------------------------------------------------------------------------
// Messaging + session cost accounting
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'JEVX_SCORE') return false;

  (async () => {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      sendResponse({ ok: false, error: 'No API key set. Click the extension icon to add it.', needsKey: true });
      return;
    }
    const result = await scoreDraft(msg.text, apiKey);

    if (result.ok) {
      const st = await chrome.storage.local.get({ sessionCost: 0, sessionCalls: 0 });
      const sessionCost = st.sessionCost + result.costUsd;
      const sessionCalls = st.sessionCalls + 1;
      await chrome.storage.local.set({ sessionCost, sessionCalls });
      result.sessionCost = sessionCost;
      result.sessionCalls = sessionCalls;
    }
    sendResponse(result);
  })();

  return true; // keep the channel open for the async reply
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
