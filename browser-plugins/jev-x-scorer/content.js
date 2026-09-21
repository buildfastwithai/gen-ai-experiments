// Jev Post Scorer for X - content script (v1.1).
//
// v1.0 bug, confirmed by inspecting the live DOM:
//   div[data-testid^="tweetTextarea_"] matches THREE nested nodes -
//     tweetTextarea_0_label            (wrapper, innerText = "What's happening?")
//     tweetTextarea_0RichTextInputContainer  (wrapper)
//     tweetTextarea_0                  (the real contenteditable)
//   document.querySelector() returns the outermost, so the observer path bound
//   to a wrapper whose innerText already contains 17 characters of placeholder,
//   while the input/focusin path bound to the real editor. Which one won was a
//   race - hence "sometimes".
//
// Fixes: require [contenteditable="true"], re-resolve the node every tick
// instead of holding a stale reference, and never trust a cached element.
//
// v1.2: pasted text was not scored. Measured on the live page, `input` DOES fire on
// paste - the cause was the same stale-element race: DraftJS replaces nodes inside the
// editor on a bulk insert, the body observer saw activeComposer detach, hid the card and
// cleared state on that same tick, and with no further keystrokes nothing re-triggered.
// Scoring is now driven by content rather than events: a MutationObserver on the editor's
// own subtree (characterData included) means the score follows the text however it arrives
// - paste, drag-drop, emoji picker, undo/redo or a restored draft.
//
// v1.3: v1.1/v1.2 froze the tab. The body MutationObserver called tick(), tick()
// called render(), render() wrote innerHTML into the card, the card is inside
// document.body, so the observer re-fired - an unbounded microtask loop that never
// yielded to the browser. Three guards now: render() is a no-op unless the rendered
// state actually changed, ticks coalesce to one pass per animation frame, and the
// body observer skips mutations originating inside the card.

(() => {
  'use strict';

  const DEBUG = false;   // flip to true to trace decisions in the console

  const COMPOSER_SEL = 'div[data-testid^="tweetTextarea_"][contenteditable="true"]';
  const FALLBACK_SEL = 'div[role="textbox"][contenteditable="true"][data-testid]';
  const DEBOUNCE_MS = 750;
  const MIN_CHARS = 10;      // was 20 - short drafts never surfaced the card
  const TICK_MS = 1000;      // safety net against X re-rendering the editor
  const CARD_W = 268;

  let card = null;
  let composer = null;
  let debounceTimer = null;
  let reqSeq = 0;
  let lastScoredText = '';
  let lastResult = null;
  let pausedUntil = 0;
  let pendingText = null;   // draft the in-flight debounce was scheduled for
  let dismissedFor = null;   // text we were dismissed on; clears when draft changes
  let rafPending = false;
  let composerObserver = null;   // watches the editor's own subtree for ANY text change

  const log = (...a) => { if (DEBUG) console.log('[jevx]', ...a); };

  const DIM_LABELS = {
    forwardability: 'Forwardable',
    discussion_pull: 'Reply pull',
    hook_strength: 'Hook',
    specificity: 'Specific',
    ai_slop: 'Not slop'
  };
  const FIX_HINTS = {
    forwardability: 'Make it stand alone - it should read fine pasted into a group chat.',
    discussion_pull: 'End on a real question or a claim sharp enough to argue with.',
    hook_strength: 'Put a concrete claim or number in the first line.',
    specificity: 'Swap adjectives for numbers, names and mechanisms.',
    ai_slop: 'Rewrite in your own voice - drop the stock constructions.'
  };

  // -- composer resolution ---------------------------------------------------
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function resolveComposer() {
    let eds = [...document.querySelectorAll(COMPOSER_SEL)].filter(visible);
    if (!eds.length) eds = [...document.querySelectorAll(FALLBACK_SEL)]
      .filter((el) => /tweetTextarea/i.test(el.getAttribute('data-testid') || ''))
      .filter(visible);
    if (!eds.length) return null;
    const a = document.activeElement;
    return eds.find((el) => el === a || el.contains(a)) || eds[0];
  }

  // Read ONLY the editor node, so the placeholder can never leak in.
  function draftText(el) {
    if (!el) return '';
    if (el.getAttribute('contenteditable') !== 'true') return '';
    return (el.innerText || el.textContent || '').replace(/​/g, '').trim();
  }

  // -- card ------------------------------------------------------------------
  function buildCard() {
    const el = document.createElement('div');
    el.className = 'jevx-card';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = [
      '<div class="jevx-head">',
        '<span class="jevx-brand">JEV</span>',
        '<span class="jevx-verdict"></span>',
        '<button class="jevx-close" title="Hide" aria-label="Hide">&times;</button>',
      '</div>',
      '<div class="jevx-scorerow">',
        '<div class="jevx-score"><span class="jevx-num">--</span><span class="jevx-pct">%</span></div>',
        '<div class="jevx-bar"><div class="jevx-fill"></div></div>',
      '</div>',
      '<div class="jevx-dims"></div>',
      '<div class="jevx-flags"></div>',
      '<div class="jevx-hint"></div>',
      '<div class="jevx-foot"></div>'
    ].join('');
    el.querySelector('.jevx-close').addEventListener('click', (e) => {
      e.stopPropagation();
      dismissedFor = draftText(composer);
      hide();
    });
    el.addEventListener('mousedown', (e) => e.preventDefault());
    document.body.appendChild(el);
    return el;
  }

  const ensureCard = () => {
    if (!card || !document.body.contains(card)) card = buildCard();
    return card;
  };
  const show = () => { ensureCard().classList.add('jevx-visible'); position(); };
  const hide = () => { if (card) card.classList.remove('jevx-visible'); };

  function position() {
    if (!card || !composer) return;
    const r = composer.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const gap = 12;
    let left, top;
    if (window.innerWidth - r.right > CARD_W + gap + 8) { left = r.right + gap; top = r.top; }
    else { left = Math.max(8, r.right - CARD_W); top = r.bottom + gap; }
    top = Math.max(8, Math.min(top, window.innerHeight - card.offsetHeight - 8));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }
  const queuePosition = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; position(); });
  };

  let lastRenderSig = null;

  function render(state, payload) {
    // Writing to the card mutates document.body, which the body observer watches.
    // If that write happens on every tick the observer re-fires forever and the tab
    // locks up (v1.1/v1.2 did exactly that). Only touch the DOM on a real change.
    const sig = state + '|' + (payload ? JSON.stringify([
      payload.score, payload.verdict, payload.band, payload.error,
      (payload.flags || []).map((f) => f.id), payload.latencyMs, payload.sessionCost
    ]) : '');
    if (sig === lastRenderSig) return;
    lastRenderSig = sig;

    const c = ensureCard();
    const q = (s) => c.querySelector(s);
    c.classList.remove('jevx-great', 'jevx-good', 'jevx-mid', 'jevx-bad', 'jevx-err', 'jevx-thinking', 'jevx-idle');

    if (state === 'idle') {
      c.classList.add('jevx-idle');
      q('.jevx-verdict').textContent = 'keep typing';
      q('.jevx-num').textContent = '--';
      q('.jevx-fill').style.width = '0%';
      q('.jevx-dims').innerHTML = '';
      q('.jevx-flags').innerHTML = '';
      q('.jevx-hint').textContent = MIN_CHARS + ' characters and Jev starts scoring.';
      q('.jevx-foot').textContent = '';
      return;
    }
    if (state === 'thinking') { c.classList.add('jevx-thinking'); q('.jevx-verdict').textContent = 'reading...'; return; }
    if (state === 'error') {
      c.classList.add('jevx-err');
      q('.jevx-verdict').textContent = 'error';
      q('.jevx-num').textContent = '--';
      q('.jevx-fill').style.width = '0%';
      q('.jevx-dims').innerHTML = '';
      q('.jevx-flags').innerHTML = '';
      q('.jevx-hint').textContent = payload.error || 'Something went wrong.';
      q('.jevx-foot').textContent = '';
      return;
    }

    const r = payload;
    c.classList.add('jevx-' + r.band);
    q('.jevx-verdict').textContent = r.verdict;
    q('.jevx-num').textContent = r.score;
    q('.jevx-fill').style.width = r.score + '%';
    q('.jevx-dims').innerHTML = Object.keys(DIM_LABELS).map((k) => {
      const v = Math.round((r.dims[k] ?? 0) * 100);
      return '<div class="jevx-dim"><span class="jevx-dimlabel">' + DIM_LABELS[k] +
             '</span><span class="jevx-dimbar"><i style="width:' + v + '%"></i></span></div>';
    }).join('');
    q('.jevx-flags').innerHTML = (r.flags || []).map((f) =>
      '<div class="jevx-flag jevx-' + f.severity + '">' + esc(f.text) + '</div>').join('');
    q('.jevx-hint').textContent = (r.weakest?.length && r.score < 85) ? FIX_HINTS[r.weakest[0]] : '';
    q('.jevx-foot').textContent = r.latencyMs + 'ms' +
      (r.sessionCost != null ? ' | $' + r.sessionCost.toFixed(4) + ' this session' : '');
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // -- scoring ---------------------------------------------------------------
  function requestScore(text) {
    const mySeq = ++reqSeq;
    render('thinking'); show();
    chrome.runtime.sendMessage({ type: 'JEVX_SCORE', text }, (res) => {
      if (mySeq !== reqSeq) return;
      if (chrome.runtime.lastError) { render('error', { error: 'Extension reloaded - refresh the page.' }); show(); return; }
      if (!res)        { render('error', { error: 'No response from the extension.' }); show(); return; }
      if (!res.ok)     { if (res.retryAfterMs) pausedUntil = Date.now() + res.retryAfterMs;
                         render('error', res); show(); return; }
      lastScoredText = text; lastResult = res;
      render('done', res); show();
    });
  }

  // -- the one decision point ------------------------------------------------
  let tickPending = false;
  function tick() {                       // coalesce bursts into one pass per frame
    if (tickPending) return;
    tickPending = true;
    requestAnimationFrame(() => { tickPending = false; doTick(); });
  }

  function doTick() {
    const found = resolveComposer();

    if (!found) {                       // composer gone: posted, cancelled or navigated
      if (composer) log('composer gone');
      composerObserver?.disconnect();
      composerObserver = null;
      composer = null;
      clearTimeout(debounceTimer);
      reqSeq++;
      lastScoredText = ''; lastResult = null; dismissedFor = null;
      hide();
      return;
    }

    if (found !== composer) {
      log('bound to', found.getAttribute('data-testid'));
      composer = found;
      // Watch the editor subtree directly. This is what catches paste, drag-drop,
      // emoji-picker inserts, undo/redo and restored drafts: DraftJS applies all of
      // those through React without ever dispatching a native `input` event, but it
      // cannot change the text without mutating the DOM, and this sees that.
      composerObserver?.disconnect();
      composerObserver = new MutationObserver(tick);
      composerObserver.observe(composer, { characterData: true, childList: true, subtree: true });
    }

    const text = draftText(composer);
    if (dismissedFor !== null && text !== dismissedFor) dismissedFor = null;  // new keystrokes un-dismiss
    if (dismissedFor !== null) { hide(); return; }

    if (!text) { lastScoredText = ''; lastResult = null; hide(); return; }

    if (text.length < MIN_CHARS) {      // visible immediately, so it never feels dead
      clearTimeout(debounceTimer);
      render('idle'); show();
      return;
    }
    if (text === lastScoredText && lastResult) { render('done', lastResult); show(); return; }
    if (Date.now() < pausedUntil) return;

    // Only restart the debounce when the DRAFT changed. Restarting it on every tick
    // means a page that mutates faster than DEBOUNCE_MS (X constantly does) keeps
    // pushing the deadline back and the request never fires.
    if (text !== pendingText) {
      pendingText = text;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => requestScore(text), DEBOUNCE_MS);
    }
  }

  // -- wiring ----------------------------------------------------------------
  document.addEventListener('input', tick, true);
  document.addEventListener('focusin', tick, true);
  document.addEventListener('keyup', tick, true);
  // Content can arrive without a keystroke. These fire before DraftJS has applied
  // the change, so re-check on the next frame as well as immediately.
  for (const evt of ['paste', 'drop', 'cut', 'undo', 'redo']) {
    document.addEventListener(evt, () => { tick(); setTimeout(tick, 0); requestAnimationFrame(tick); }, true);
  }

  // Only interested in X's own DOM here - never in our card's own writes.
  new MutationObserver((records) => {
    for (const m of records) {
      if (card && (m.target === card || card.contains(m.target))) continue;
      tick(); queuePosition();
      return;
    }
  }).observe(document.body, { childList: true, subtree: true });

  setInterval(tick, TICK_MS);   // survives any re-render pattern X invents

  window.addEventListener('scroll', queuePosition, true);
  window.addEventListener('resize', queuePosition);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });

  tick();
  log('ready');
})();
