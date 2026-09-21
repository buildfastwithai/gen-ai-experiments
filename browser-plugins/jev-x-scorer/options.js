const $ = (id) => document.getElementById(id);
const status = $('status');

function say(msg, cls) {
  status.textContent = msg;
  status.className = cls || '';
  if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 4000);
}

async function refreshStats() {
  const { sessionCost = 0, sessionCalls = 0 } = await chrome.storage.local.get(['sessionCost', 'sessionCalls']);
  $('stat').textContent = sessionCalls
    ? `${sessionCalls} scores so far - $${sessionCost.toFixed(4)} total.`
    : 'No drafts scored yet.';
}

(async () => {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) $('key').value = apiKey;
  refreshStats();
})();

$('save').addEventListener('click', async () => {
  const apiKey = $('key').value.trim();
  if (!apiKey) { say('Enter a key first.', 'bad'); return; }
  await chrome.storage.local.set({ apiKey });
  say('Saved.', 'ok');
});

$('reveal').addEventListener('click', () => {
  const f = $('key');
  const showing = f.type === 'text';
  f.type = showing ? 'password' : 'text';
  $('reveal').textContent = showing ? 'Show' : 'Hide';
});

$('test').addEventListener('click', async () => {
  const apiKey = $('key').value.trim();
  if (!apiKey) { say('Enter a key first.', 'bad'); return; }
  await chrome.storage.local.set({ apiKey });
  say('Testing...');
  chrome.runtime.sendMessage(
    { type: 'JEVX_SCORE', text: 'Shipped a small tool today that scores my drafts before I post them. It caught two duds already.' },
    (res) => {
      if (chrome.runtime.lastError) { say('Extension error - try reloading it.', 'bad'); return; }
      if (res?.ok) { say(`Working. Test draft scored ${res.score}%.`, 'ok'); refreshStats(); }
      else { say(res?.error || 'Test failed.', 'bad'); }
    }
  );
});

$('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ sessionCost: 0, sessionCalls: 0 });
  refreshStats();
  say('Counter reset.', 'ok');
});
