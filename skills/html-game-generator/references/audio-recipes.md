# Web Audio Recipes

Every sound in a generated game is synthesised at runtime. No files, no base64, no libraries. This is the full cookbook.

Contents:
1. [Audio engine skeleton](#1-audio-engine-skeleton)
2. [The unlock problem](#2-the-unlock-problem)
3. [Envelopes](#3-envelopes)
4. [Core voices](#4-core-voices)
5. [SFX library](#5-sfx-library)
6. [Noise and impacts](#6-noise-and-impacts)
7. [Voice limiting](#7-voice-limiting)
8. [Music sequencer](#8-music-sequencer)
9. [Adaptive music](#9-adaptive-music)
10. [Mixing and ducking](#10-mixing-and-ducking)
11. [Genre sound palettes](#11-genre-sound-palettes)

---

## 1. Audio engine skeleton

```js
const Audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null,
  vol: { master: 0.5, sfx: 0.8, music: 0.5 },
  voices: 0, MAX_VOICES: 12,
  ready: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                                    // ancient browser — game still runs, silently
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol.master;
    this.master.connect(this.ctx.destination);

    // Soft limiter so a big explosion doesn't clip into distortion.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 20;
    comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(this.master);

    this.sfxBus = this.ctx.createGain();   this.sfxBus.gain.value   = this.vol.sfx;   this.sfxBus.connect(comp);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.vol.music; this.musicBus.connect(comp);

    this.ready = true;
  },

  get t() { return this.ctx.currentTime; },

  setVol(which, v) {
    this.vol[which] = v;
    if (!this.ready) return;
    const bus = which === 'master' ? this.master : which === 'sfx' ? this.sfxBus : this.musicBus;
    bus.gain.setTargetAtTime(v, this.t, 0.02);
    Save.save(saveData);
  }
};
```

## 2. The unlock problem

Browsers create the context in a `suspended` state and only allow audio after a user gesture. A game that ignores this is silent forever, and it's the most common audio bug in generated games.

```js
function unlockAudio() {
  Audio.init();
  if (Audio.ctx && Audio.ctx.state === 'suspended') Audio.ctx.resume();
}
for (const evt of ['pointerdown', 'keydown', 'touchstart'])
  addEventListener(evt, unlockAudio, { once: false });   // not `once` — iOS can re-suspend

// Also resume when returning to the tab.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Audio.ctx?.state === 'suspended') Audio.ctx.resume();
});
```

Never call `Audio.init()` at load time. Create it on the first gesture — usually the "Play" button, which is a gesture anyway.

## 3. Envelopes

A bare `osc.start()` / `osc.stop()` produces an audible click at both ends. Everything gets an envelope.

```js
// ADSR on a gain node. Note: exponential ramps cannot reach 0 — use 0.0001.
function env(gain, t, { a = 0.005, d = 0.06, s = 0.0, r = 0.08, peak = 1, sustainTime = 0 }) {
  const g = gain.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + a);
  g.exponentialRampToValueAtTime(Math.max(s * peak, 0.0001), t + a + d);
  const end = t + a + d + sustainTime;
  g.setValueAtTime(Math.max(s * peak, 0.0001), end);
  g.exponentialRampToValueAtTime(0.0001, end + r);
  return end + r;                     // when to stop the source
}

// Percussive shorthand: instant attack, exponential decay. Covers most SFX.
function pluck(gain, t, peak, decay) {
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return t + decay;
}
```

## 4. Core voices

```js
// One-shot tone. `type` = sine | square | sawtooth | triangle.
function tone({ freq = 440, type = 'square', dur = 0.12, vol = 0.3, t = 0,
                slide = 0, filter = 0, q = 1, detune = 0, bus = null }) {
  if (!Audio.ready) return;
  const ctx = Audio.ctx, start = t || Audio.t;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), start + dur);
  if (detune) osc.detune.value = detune;

  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(filter, start);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, filter * 0.35), start + dur);
    f.Q.value = q;
    osc.connect(f); node = f;
  }
  node.connect(g);
  g.connect(bus || Audio.sfxBus);
  pluck(g, start, vol, dur);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  osc.onended = () => { g.disconnect(); Audio.voices--; };
  Audio.voices++;
}

// FM voice — bells, pickups, coins, magic. Modulator frequency ratio defines the timbre.
function fm({ carrier = 440, ratio = 2.0, index = 300, dur = 0.35, vol = 0.25, t = 0 }) {
  if (!Audio.ready) return;
  const ctx = Audio.ctx, start = t || Audio.t;
  const car = ctx.createOscillator(), mod = ctx.createOscillator();
  const modGain = ctx.createGain(), g = ctx.createGain();
  car.frequency.value = carrier;
  mod.frequency.value = carrier * ratio;
  modGain.gain.setValueAtTime(index, start);
  modGain.gain.exponentialRampToValueAtTime(1, start + dur);   // index decay = "pluck" character
  mod.connect(modGain); modGain.connect(car.frequency);
  car.connect(g); g.connect(Audio.sfxBus);
  pluck(g, start, vol, dur);
  car.start(start); mod.start(start);
  car.stop(start + dur + 0.02); mod.stop(start + dur + 0.02);
}

// Cached noise buffer — generating it per sound is wasteful.
let _noiseBuf = null;
function noiseBuffer(seconds = 2) {
  if (_noiseBuf) return _noiseBuf;
  const ctx = Audio.ctx, len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (_noiseBuf = buf);
}

function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, sweep = 0, q = 1, t = 0 }) {
  if (!Audio.ready) return;
  const ctx = Audio.ctx, start = t || Audio.t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, start);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), start + dur);
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(Audio.sfxBus);
  pluck(g, start, vol, dur);
  src.start(start); src.stop(start + dur + 0.02);
}
```

## 5. SFX library

Ready-to-use sounds. Vary pitch on anything that repeats — `1 + (Math.random()-0.5)*0.1` — so rapid fire doesn't become a drone.

```js
const v = () => 1 + (Math.random() - 0.5) * 0.1;   // ±5% pitch variance

const sfx = {
  // UI
  click:   () => tone({freq: 620*v(), type:'square',   dur:0.045, vol:0.16}),
  hover:   () => tone({freq: 880*v(), type:'sine',     dur:0.03,  vol:0.07}),
  confirm: () => { tone({freq:523, type:'triangle', dur:0.09, vol:0.2});
                   tone({freq:784, type:'triangle', dur:0.14, vol:0.2, t:Audio.t+0.07}); },
  deny:    () => tone({freq: 160, type:'sawtooth', dur:0.18, vol:0.22, slide:-60, filter:900}),

  // Movement
  jump:    () => tone({freq: 300*v(), type:'square',   dur:0.13, vol:0.2, slide: 340, filter:2200}),
  land:    () => noise({dur:0.09, vol:0.18, freq:900, sweep:-700}),
  step:    () => noise({dur:0.05, vol:0.07, freq:1400*v(), sweep:-800, q:2}),
  dash:    () => noise({dur:0.22, vol:0.22, type:'bandpass', freq:1800, sweep:-1400, q:3}),

  // Combat
  shoot:   () => { tone({freq:900*v(), type:'square', dur:0.07, vol:0.18, slide:-620, filter:3000});
                   noise({dur:0.05, vol:0.1, freq:3000, sweep:-2000}); },
  laser:   () => tone({freq:1400*v(), type:'sawtooth', dur:0.18, vol:0.16, slide:-1100, filter:4000, q:6}),
  hit(dmg = 10) {
    const heavy = dmg > 20;
    tone({freq:(heavy?110:190)*v(), type:'square', dur:heavy?0.14:0.08,
          vol:heavy?0.3:0.2, slide:-70, filter:1200});
    noise({dur:heavy?0.16:0.08, vol:heavy?0.25:0.14, freq:2200, sweep:-1800});
  },
  explode: () => { noise({dur:0.55, vol:0.42, freq:1400, sweep:-1250, q:0.7});
                   tone({freq:78, type:'sine', dur:0.42, vol:0.35, slide:-52}); },
  death:   () => { tone({freq:340, type:'sawtooth', dur:0.42, vol:0.26, slide:-290, filter:1600});
                   noise({dur:0.32, vol:0.18, freq:900, sweep:-700}); },
  parry:   () => { tone({freq:2200, type:'square', dur:0.05, vol:0.22});
                   noise({dur:0.12, vol:0.2, type:'bandpass', freq:4200, q:8}); },

  // Rewards
  coin:    () => { fm({carrier:988, ratio:3, index:220, dur:0.16, vol:0.2});
                   fm({carrier:1319, ratio:3, index:200, dur:0.24, vol:0.16, t:Audio.t+0.06}); },
  pickup:  () => fm({carrier:660*v(), ratio:2.5, index:280, dur:0.2, vol:0.18}),
  levelUp: () => [523,659,784,1047].forEach((f,i) =>
                   tone({freq:f, type:'triangle', dur:0.24, vol:0.24, t:Audio.t + i*0.085})),
  win:     () => [523,659,784,1047,1319].forEach((f,i) =>
                   fm({carrier:f, ratio:2, index:180, dur:0.5, vol:0.22, t:Audio.t + i*0.12})),
  lose:    () => [440,392,349,262].forEach((f,i) =>
                   tone({freq:f, type:'sawtooth', dur:0.42, vol:0.24, filter:1100, t:Audio.t + i*0.19})),

  // Building / strategy
  place:   () => { tone({freq:220, type:'square', dur:0.07, vol:0.2});
                   noise({dur:0.1, vol:0.14, freq:800, sweep:-500}); },
  build:   () => noise({dur:0.35, vol:0.16, freq:1200, sweep:-900, q:1.5}),
  upgrade: () => { tone({freq:440, type:'triangle', dur:0.12, vol:0.22, slide:220});
                   fm({carrier:880, ratio:2, index:200, dur:0.3, vol:0.18, t:Audio.t+0.1}); },
  alert:   () => { tone({freq:740, type:'square', dur:0.1, vol:0.2});
                   tone({freq:740, type:'square', dur:0.1, vol:0.2, t:Audio.t+0.16}); },

  // Ambience / nature
  splash:  () => noise({dur:0.3, vol:0.2, type:'bandpass', freq:1600, sweep:-1100, q:1.2}),
  wind:    () => noise({dur:2.5, vol:0.06, type:'bandpass', freq:520, sweep:180, q:0.6}),
  thunder: () => { noise({dur:1.6, vol:0.38, freq:420, sweep:-330, q:0.5});
                   tone({freq:48, type:'sine', dur:1.3, vol:0.3, slide:-22}); },
};
```

## 6. Noise and impacts

Impact quality comes from layering three elements: a **transient** (very short noise burst), a **body** (a pitched sine dropping fast), and a **tail** (filtered noise decaying).

```js
function impact(size = 1) {                    // size 0.5 = tap, 2 = building collapse
  const t = Audio.t;
  noise({dur: 0.03*size,  vol: 0.3,        freq: 6000, sweep: -4000, t});           // transient
  tone ({freq: 120/size,  type:'sine',     dur: 0.28*size, vol: 0.34, slide: -70/size, t});  // body
  noise({dur: 0.45*size,  vol: 0.18,       freq: 900,  sweep: -750, q: 0.8, t: t+0.02});     // tail
}

// Material-specific destruction — matters a lot in physics games.
const materialSfx = {
  wood:  () => { noise({dur:0.16, vol:0.24, type:'bandpass', freq:2200, sweep:-1400, q:2.5});
                 tone({freq:220, type:'triangle', dur:0.12, vol:0.16, slide:-90}); },
  stone: () => { noise({dur:0.32, vol:0.3, freq:1100, sweep:-880, q:1});
                 tone({freq:88, type:'sine', dur:0.26, vol:0.28, slide:-40}); },
  glass: () => { for (let i=0;i<7;i++)
                   tone({freq: rand(2200,5200), type:'sine', dur: rand(0.05,0.16),
                         vol:0.1, t: Audio.t + i*0.018}); },
  metal: () => { fm({carrier:520, ratio:1.41, index:900, dur:0.7, vol:0.22});   // inharmonic ratio = metallic
                 noise({dur:0.12, vol:0.16, type:'bandpass', freq:3800, q:6}); }
};
```

The `1.41` modulator ratio is what makes metal sound like metal — non-integer ratios produce inharmonic partials.

## 7. Voice limiting

Twenty simultaneous explosions will clip and eat CPU. Cap and drop.

```js
function canPlay(priority = 1) {
  if (!Audio.ready) return false;
  if (Audio.voices < Audio.MAX_VOICES) return true;
  return priority >= 2;                    // high-priority sounds still get through
}

// Rate-limit sounds that can fire many times per frame (bullet impacts, footsteps).
const lastPlayed = Object.create(null);
function throttled(name, fn, minGap = 0.04) {
  const t = Audio.t;
  if (lastPlayed[name] && t - lastPlayed[name] < minGap) return;
  lastPlayed[name] = t;
  fn();
}
// throttled('hit', () => sfx.hit(dmg));
```

## 8. Music sequencer

Schedule ahead using `ctx.currentTime`. Never drive music with `setInterval` — it drifts audibly within seconds.

```js
const Music = {
  playing: false, bpm: 120, step: 0, nextTime: 0,
  lookahead: 0.1,          // schedule this far ahead, in seconds
  timer: null,

  scales: {
    minor:      [0,2,3,5,7,8,10],
    major:      [0,2,4,5,7,9,11],
    pentatonic: [0,3,5,7,10],
    dorian:     [0,2,3,5,7,9,10],
    phrygian:   [0,1,3,5,7,8,10]     // tense — good for horror/survival
  },

  note: (root, scale, degree) => {
    const s = Music.scales[scale];
    const oct = Math.floor(degree / s.length);
    return root * Math.pow(2, (s[((degree % s.length) + s.length) % s.length] + oct*12) / 12);
  },

  start(opts = {}) {
    if (!Audio.ready || this.playing) return;
    Object.assign(this, { bpm: 110, root: 220, scale: 'minor', intensity: 0 }, opts);
    this.playing = true;
    this.step = 0;
    this.nextTime = Audio.t + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);   // the *scheduler* may use setInterval; the notes must not
  },

  stop() { this.playing = false; clearInterval(this.timer); },

  schedule() {
    if (!this.playing) return;
    const stepDur = 60 / this.bpm / 4;                     // 16th notes
    while (this.nextTime < Audio.t + this.lookahead) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  },

  playStep(s, t, dur) {
    const bar = (s / 16) | 0;

    // Bass — root on the downbeat, fifth halfway
    if (s % 8 === 0) {
      const deg = [0, 0, 4, 3][bar % 4];
      tone({freq: this.note(this.root/2, this.scale, deg), type:'sawtooth',
            dur: dur*6, vol: 0.16, filter: 420, t, bus: Audio.musicBus});
    }

    // Arpeggio — rises with intensity
    if (s % 2 === 0 && this.intensity > 0.2) {
      const pattern = [0,2,4,2,7,4,2,0];
      const deg = pattern[(s/2) % 8] + (bar % 2 ? 0 : 2);
      tone({freq: this.note(this.root, this.scale, deg), type:'triangle',
            dur: dur*1.6, vol: 0.07 + this.intensity*0.05, t, bus: Audio.musicBus});
    }

    // Percussion layer — only when things get dangerous
    if (this.intensity > 0.5) {
      if (s % 8 === 0) noise({dur:0.06, vol:0.12, freq:180, sweep:-90, t});          // kick
      if (s % 8 === 4) noise({dur:0.07, vol:0.09, type:'highpass', freq:5200, t});   // hat
    }
    if (this.intensity > 0.8 && s % 16 === 12)
      noise({dur:0.14, vol:0.14, type:'bandpass', freq:1900, q:1.2, t});             // snare
  }
};
```

## 9. Adaptive music

Tie intensity to game state so the soundtrack tracks tension without needing multiple compositions.

```js
function updateMusic(dt) {
  const danger = clamp(nearbyEnemies / 12, 0, 1);
  const health = 1 - player.hp / player.maxHp;
  const target = clamp(danger * 0.7 + health * 0.3, 0, 1);
  Music.intensity = damp(Music.intensity, target, 1.2, dt);
  Music.bpm = lerp(100, 148, Music.intensity);
}
```

Transitions: fade the music bus down over 0.4s, change key or pattern, fade back up. Abrupt musical cuts are jarring in a way abrupt SFX are not.

## 10. Mixing and ducking

Rough levels that work: SFX peak around 0.3, music around 0.12, master 0.5. Music should sit clearly under the action.

```js
// Duck the music briefly when something big happens so the impact reads.
function duck(amount = 0.4, hold = 0.15, release = 0.5) {
  if (!Audio.ready) return;
  const g = Audio.musicBus.gain, t = Audio.t, base = Audio.vol.music;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(base * (1-amount), t + 0.04);
  g.setValueAtTime(base * (1-amount), t + 0.04 + hold);
  g.linearRampToValueAtTime(base, t + 0.04 + hold + release);
}
```

A low-pass on the whole master while paused is a cheap, professional touch:

```js
function setPausedFilter(on) {
  pauseFilter.frequency.setTargetAtTime(on ? 600 : 20000, Audio.t, 0.08);
}
```

## 11. Genre sound palettes

Choosing a coherent palette matters more than any individual sound.

| Genre | Waveforms | Character |
|---|---|---|
| **Arcade / retro** | square, pulse, triangle | Short, bright, high-pitched. Fast arpeggios. Heavy pitch slides. |
| **Platformer** | square + triangle | Bouncy. Rising slides on jump, falling on land. Major/pentatonic music. |
| **Shooter / action** | sawtooth + noise | Aggressive, filtered. Layered impacts. Driving minor-key percussion. |
| **Horror / survival** | sine drones, filtered noise | Sparse, low, slow. Phrygian scale. Long reverb-ish tails, sudden stings. |
| **Puzzle** | sine, FM bells | Clean, gentle, consonant. Ascending on success, soft thud on failure. |
| **Strategy / builder** | triangle, soft noise | Muted, unobtrusive, functional. Repeats hundreds of times — keep them quiet. |
| **Racing** | sawtooth engine drone | Continuous oscillator with frequency mapped to speed; filtered noise for tyres. |
| **Cozy / farming** | sine, triangle, FM marimba | Warm, soft-attack, pentatonic. No harsh transients anywhere. |
| **Idle / incremental** | FM bells, soft clicks | Very short and quiet — they fire constantly. Escalating pitch for milestones. |

Engine sound for racing games, since it's the one continuous voice:

```js
const engine = (() => {
  let osc, g, f;
  return {
    start() {
      osc = Audio.ctx.createOscillator(); osc.type = 'sawtooth';
      f = Audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
      g = Audio.ctx.createGain(); g.gain.value = 0.0001;
      osc.connect(f); f.connect(g); g.connect(Audio.sfxBus);
      osc.start();
      g.gain.setTargetAtTime(0.1, Audio.t, 0.2);
    },
    update(rpm01) {                          // 0..1
      if (!osc) return;
      osc.frequency.setTargetAtTime(60 + rpm01 * 260, Audio.t, 0.05);
      f.frequency.setTargetAtTime(300 + rpm01 * 2600, Audio.t, 0.05);
      g.gain.setTargetAtTime(0.05 + rpm01 * 0.09, Audio.t, 0.1);
    },
    stop() { if (!osc) return; g.gain.setTargetAtTime(0.0001, Audio.t, 0.1);
             osc.stop(Audio.t + 0.4); osc = null; }
  };
})();
```
