/* main.js — boot the game behind a loading screen, then hand over on click. */

import { Game } from './core/Game.js';

const TIPS = [
  'Hold <b>RMB</b> to swing, or tap <b>X</b> for keyboard toggle. Release at the bottom of the arc for maximum speed.',
  'The web attaches exactly under the reticle. Aim higher on a facade, then hold <b>W</b> through the arc to climb.',
  'Use <b>W / S</b> to reel in or out. Aim your movement along the arc to pump without breaking momentum.',
  'Hold <b>C</b> in the air to dive. It is the fastest way across the city and it sets up swing kicks.',
  'Jump into a wall while moving toward it to run up it. Hold <b>Shift</b> on contact to crawl instead.',
  '<b>Shift</b> during an enemy wind-up is a perfect dodge: time slows and you get the counter.',
  'Every third strike launches. Keep hitting an airborne enemy and they never touch the ground.',
  '<b>F</b> zips you to whatever you are looking at. <b>R</b> mid-swing slingshots you along the web.',
  '<b>TAB</b> opens the map. Click a white marker to fast travel.',
  'Web an enemy against a wall and they stay pinned there.',
];

const boot = document.getElementById('boot');
const fill = document.getElementById('boot-fill');
const status = document.getElementById('boot-status');
const tipEl = document.getElementById('boot-tip');
const playBtn = document.getElementById('boot-play');

let tipIndex = Math.floor(Math.random() * TIPS.length);
const showTip = () => {
  tipEl.style.opacity = 0;
  setTimeout(() => {
    tipEl.innerHTML = TIPS[tipIndex++ % TIPS.length];
    tipEl.style.transition = 'opacity .5s';
    tipEl.style.opacity = 1;
  }, 260);
};
showTip();
const tipTimer = setInterval(showTip, 5200);

const canvas = document.getElementById('viewport');
const game = new Game(canvas);
window.game = game;               // handy for poking at systems from the console

(async () => {
  try {
    await game.boot((p, label) => {
      fill.style.width = `${Math.round(p * 100)}%`;
      if (label) status.textContent = label + '…';
    });
    status.textContent = 'Ready';
    playBtn.disabled = false;
    playBtn.focus();
  } catch (err) {
    console.error(err);
    status.innerHTML = `<span style="color:#e8283c">FAILED: ${err.message}</span>`;
    tipEl.innerHTML = 'If this is a module or CORS error, make sure you are serving the folder over http '
      + '(<code>npx serve</code>) rather than opening index.html from disk.';
  }
})();

function launch() {
  if (playBtn.disabled) return;
  clearInterval(tipTimer);
  boot.style.transition = 'opacity .8s ease';
  boot.style.opacity = '0';
  setTimeout(() => boot.classList.add('hidden'), 820);
  game.start();
}

playBtn.addEventListener('click', launch);
addEventListener('keydown', (e) => {
  if ((e.code === 'Enter' || e.code === 'Space') && !playBtn.disabled && !game.started) {
    e.preventDefault();
    launch();
  }
});

// Keep audio alive across tab switches without letting the world fast-forward.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  game.last = performance.now();
  game.audio?.resume();
});
