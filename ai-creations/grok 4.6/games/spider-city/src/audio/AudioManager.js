/* audio/AudioManager.js
   Every sound in this game is synthesised at runtime by the Web Audio API.

   No files means no loading, no licensing and no 40 MB of samples — and because
   the sounds are generated, they can be parameterised: the wind is literally a
   filtered noise band whose centre frequency and gain track your airspeed, the
   swing whoosh doppler-shifts with velocity, and the music is four oscillator
   voices whose chord and filter follow the game state.

   Structure:  sources -> [dry | 3D pan] -> bus (sfx / music / ambient) ->
               master gain -> compressor -> destination
*/

import * as THREE from 'three';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = {
  explore: [[57, 64, 69, 76], [55, 62, 67, 74], [53, 60, 65, 72], [55, 59, 62, 71]],
  tension: [[45, 52, 56, 63], [44, 51, 55, 62], [45, 52, 57, 64], [43, 50, 55, 62]],
  combat:  [[40, 47, 52, 59], [43, 50, 55, 62], [38, 45, 50, 57], [41, 48, 53, 60]],
  chase:   [[45, 57, 64, 69], [47, 59, 66, 71], [48, 60, 67, 72], [43, 55, 62, 67]],
  boss:    [[36, 43, 48, 55], [37, 44, 49, 56], [36, 43, 47, 54], [34, 41, 46, 53]],
  mission: [[50, 57, 62, 69], [48, 55, 60, 67], [52, 59, 64, 71], [47, 54, 59, 66]],
};

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ready = false;
    this.ctx = null;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.listenerFwd = { x: 0, y: 0, z: 1 };
    this.track = 'explore';
    this.chordIndex = 0;
    this.nextChordAt = 0;
    this.swingIntensity = 0;
    this.rain = 0;
    this.storm = false;
    this.altitude = 0;
    this.muted = false;
    this._voices = [];
    this._lastPlay = new Map();
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.masterVolume;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;
    this.master.connect(this.comp).connect(ctx.destination);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.85; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.settings.musicVolume * 0.5; this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.7; this.ambBus.connect(this.master);

    // a touch of space on the SFX bus
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.makeImpulse(1.6, 2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.16;
    this.sfxBus.connect(this.convolver).connect(this.wet).connect(this.master);

    this.noiseBuf = this.makeNoise(2);
    this.buildAmbience();
    this.buildMusic();
    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMasterVolume(v) { if (this.master) this.master.gain.value = v; }

  /* ------------------------------------------------------------ buffers */
  makeNoise(seconds) {
    const ctx = this.ctx;
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return b;
  }

  /* ---------------------------------------------------------- ambience */
  buildAmbience() {
    const ctx = this.ctx;

    /* wind — bandpassed noise, driven by airspeed */
    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = this.noiseBuf; this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 420; this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);
    this.windSrc.start();

    /* rain — wide noise, low-passed */
    this.rainSrc = ctx.createBufferSource();
    this.rainSrc.buffer = this.noiseBuf; this.rainSrc.loop = true;
    this.rainHP = ctx.createBiquadFilter(); this.rainHP.type = 'highpass'; this.rainHP.frequency.value = 700;
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 5200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(this.rainHP).connect(this.rainLP).connect(this.rainGain).connect(this.ambBus);
    this.rainSrc.start();

    /* city bed — low rumble */
    this.citySrc = ctx.createBufferSource();
    this.citySrc.buffer = this.noiseBuf; this.citySrc.loop = true;
    this.cityLP = ctx.createBiquadFilter(); this.cityLP.type = 'lowpass'; this.cityLP.frequency.value = 260;
    this.cityGain = ctx.createGain(); this.cityGain.gain.value = 0.10;
    this.citySrc.connect(this.cityLP).connect(this.cityGain).connect(this.ambBus);
    this.citySrc.start();
  }

  /* ------------------------------------------------------------- music */
  buildMusic() {
    const ctx = this.ctx;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1400;
    this.musicFilter.Q.value = 0.6;
    this.musicFilter.connect(this.musicBus);

    this.musicVoices = [];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : i === 3 ? 'triangle' : 'sine';
      const g = ctx.createGain();
      g.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = (i - 1.5) * 0.45; o.connect(g).connect(pan).connect(this.musicFilter); }
      else o.connect(g).connect(this.musicFilter);
      o.start();
      this.musicVoices.push({ o, g });
    }
    // a slow pulse voice for combat urgency
    this.pulseGain = ctx.createGain(); this.pulseGain.gain.value = 0;
    this.pulseGain.connect(this.musicBus);
    this.nextPulse = 0;
  }

  setMusic(track) {
    if (!CHORDS[track]) track = 'explore';
    if (this.track === track) return;
    this.track = track;
    this.chordIndex = 0;
    this.nextChordAt = 0;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const bright = { explore: 1500, tension: 900, combat: 2600, chase: 3000, boss: 700, mission: 1300 }[track];
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(bright, t, 1.2);
  }

  updateMusic(dt) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const beat = { explore: 6.5, tension: 4.5, combat: 2.4, chase: 2.0, boss: 3.0, mission: 5.0 }[this.track];
    const vol = { explore: 0.10, tension: 0.13, combat: 0.16, chase: 0.17, boss: 0.19, mission: 0.12 }[this.track];

    if (t >= this.nextChordAt) {
      this.nextChordAt = t + beat;
      const chord = CHORDS[this.track][this.chordIndex % 4];
      this.chordIndex++;
      this.musicVoices.forEach((v, i) => {
        const f = NOTE(chord[i] - (i === 0 ? 12 : 0));
        v.o.frequency.setTargetAtTime(f, t, 0.25);
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(vol * (i === 0 ? 0.5 : 1) * this.settings.musicVolume, t, 0.6);
        v.g.gain.setTargetAtTime(vol * 0.35 * this.settings.musicVolume, t + beat * 0.55, 0.9);
      });
    }

    // percussive pulse during action tracks
    if ((this.track === 'combat' || this.track === 'chase' || this.track === 'boss') && t >= this.nextPulse) {
      this.nextPulse = t + beat / 4;
      this.blip(58, 0.09, 'sine', 0.14 * this.settings.musicVolume, this.musicBus, 24);
    }
  }

  /* ------------------------------------------------------------- voices */
  noise(dur, type, freq, gain, q = 1, sweepTo = null, dest = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest || this.sfxBus);
    s.start(t); s.stop(t + dur + 0.05);
  }

  blip(freq, dur, type, gain, dest = null, endFreq = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* -------------------------------------------------------- 3D placement */
  spatial(pos) {
    // Cheap distance attenuation + stereo pan relative to the camera.
    if (!pos || !this.ready) return { gain: 1, pan: 0 };
    const dx = pos.x - this.listenerPos.x, dy = pos.y - this.listenerPos.y, dz = pos.z - this.listenerPos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gain = 1 / (1 + d * d / 220);
    const rx = this.listenerFwd.z, rz = -this.listenerFwd.x;   // right vector
    const pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    return { gain, pan };
  }

  route(pos) {
    if (!this.ready) return this.sfxBus;
    const { gain, pan } = this.spatial(pos);
    if (gain < 0.008) return null;
    const g = this.ctx.createGain(); g.gain.value = gain;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan * 0.8;
      g.connect(p).connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  /* --------------------------------------------------------------- SFX */
  play(name, pos) {
    if (!this.ready || this.muted) return;
    // throttle: never stack the same sound twice in a frame
    const now = this.ctx.currentTime;
    const last = this._lastPlay.get(name) || 0;
    if (now - last < 0.035) return;
    this._lastPlay.set(name, now);

    const dest = this.route(pos);
    if (!dest) return;
    const N = (d, ty, f, g, q, sw) => this.noise(d, ty, f, g, q, sw, dest);
    const B = (f, d, ty, g, e) => this.blip(f, d, ty, g, dest, e);

    switch (name) {
      case 'jump':       N(0.22, 'bandpass', 700, 0.20, 1.2, 240); break;
      case 'land':       B(120, 0.16, 'sine', 0.30, 48); N(0.16, 'lowpass', 900, 0.18, 1); break;
      case 'landHard':   B(78, 0.34, 'sine', 0.5, 32); N(0.34, 'lowpass', 1400, 0.34, 1, 200); break;
      case 'webshoot':   N(0.13, 'highpass', 2600, 0.20, 2); B(1900, 0.07, 'square', 0.07, 900); break;
      case 'webRelease': N(0.22, 'bandpass', 1200, 0.15, 1.4, 400); break;
      case 'swingWhoosh':N(0.5, 'bandpass', 480, 0.14, 0.9, 220); break;
      case 'zip':        B(320, 0.34, 'sawtooth', 0.14, 1500); N(0.3, 'bandpass', 900, 0.12, 1.6, 2400); break;
      case 'slingshot':  B(180, 0.5, 'sawtooth', 0.2, 1700); N(0.4, 'bandpass', 600, 0.2, 1, 2600); break;
      case 'wallhit':    N(0.15, 'lowpass', 700, 0.22, 1); break;
      case 'swipe':      N(0.16, 'bandpass', 1500, 0.13, 1.1, 500); break;
      case 'hit':        N(0.11, 'lowpass', 2200, 0.34, 0.8); B(150, 0.1, 'sine', 0.26, 60); break;
      case 'heavyHit':   N(0.24, 'lowpass', 1500, 0.45, 0.7, 260); B(92, 0.26, 'sine', 0.42, 40); break;
      case 'divekick':   N(0.5, 'bandpass', 300, 0.24, 0.8, 900); break;
      case 'ko':         B(180, 0.5, 'triangle', 0.3, 55); N(0.4, 'lowpass', 900, 0.24, 1); break;
      case 'hurt':       B(230, 0.2, 'square', 0.14, 110); N(0.2, 'bandpass', 500, 0.2, 1); break;
      case 'dodge':      N(0.16, 'bandpass', 1800, 0.12, 1.6, 700); break;
      case 'perfect':    B(880, 0.5, 'sine', 0.2); B(1320, 0.42, 'sine', 0.12); B(1760, 0.3, 'sine', 0.07); break;
      case 'webhit':     N(0.18, 'lowpass', 1700, 0.24, 0.9, 420); break;
      case 'shot':       B(720, 0.12, 'square', 0.13, 180); N(0.1, 'highpass', 1800, 0.1, 1); break;
      case 'alert':      B(660, 0.1, 'square', 0.11); setTimeout(() => this.blip(520, 0.12, 'square', 0.11, dest), 110); break;
      case 'horn':       B(320, 0.45, 'square', 0.1); B(404, 0.45, 'square', 0.07); break;
      case 'pickup':     B(NOTE(76), 0.1, 'sine', 0.18); setTimeout(() => this.blip(NOTE(83), 0.22, 'sine', 0.16, dest), 90); break;
      case 'checkpoint': B(NOTE(72), 0.09, 'triangle', 0.16); setTimeout(() => this.blip(NOTE(79), 0.2, 'triangle', 0.14, dest), 80); break;
      case 'success':    [69, 76, 81].forEach((n, i) => setTimeout(() => this.blip(NOTE(n), 0.3, 'sine', 0.15, dest), i * 110)); break;
      case 'levelup':    [72, 76, 79, 84].forEach((n, i) => setTimeout(() => this.blip(NOTE(n), 0.35, 'triangle', 0.15, dest), i * 90)); break;
      case 'dispatch':   N(0.09, 'bandpass', 1800, 0.12, 4); setTimeout(() => this.noise(0.06, 'bandpass', 2400, 0.09, 4, null, dest), 130); break;
      case 'explode':    N(0.8, 'lowpass', 900, 0.5, 0.7, 90); B(70, 0.7, 'sine', 0.4, 28); break;
      default:           N(0.12, 'bandpass', 1000, 0.1, 1);
    }
  }

  siren(pos) {
    if (!this.ready) return;
    const dest = this.route(pos);
    if (!dest) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.blip(i % 2 ? 740 : 560, 0.34, 'sine', 0.09, dest), i * 360);
    }
  }

  thunder(delay = 1.5) {
    if (!this.ready) return;
    setTimeout(() => {
      this.noise(2.6, 'lowpass', 180, 0.55, 0.6, 60, this.ambBus);
      this.blip(44, 2.2, 'sine', 0.28, this.ambBus, 22);
    }, delay * 1000);
  }

  /* --------------------------------------------------------- continuous */
  setSwingIntensity(v) { this.swingIntensity = v; }
  setWeather(rain, storm) { this.rain = rain; this.storm = storm; }

  update(dt, game) {
    if (!this.ready) return;
    const cam = game.camera.camera;
    this.listenerPos.x = cam.position.x; this.listenerPos.y = cam.position.y; this.listenerPos.z = cam.position.z;
    const fwd = cam.getWorldDirection(_fwd);
    this.listenerFwd.x = fwd.x; this.listenerFwd.z = fwd.z;

    const p = game.player;
    const speed = p.speed;
    const alt = Math.max(0, p.position.y);

    // wind rises with airspeed and altitude; centre frequency climbs with it too
    const windTarget = Math.min(0.42, speed / 130 + alt / 2600);
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(windTarget, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(320 + speed * 14, t, 0.3);
    this.windFilter.Q.setTargetAtTime(0.6 + this.swingIntensity * 1.6, t, 0.3);

    this.rainGain.gain.setTargetAtTime(this.rain * 0.22, t, 0.6);
    this.rainLP.frequency.setTargetAtTime(3200 + this.rain * 3600, t, 0.6);

    // city bed fades out with altitude — high above the streets it goes quiet
    this.cityGain.gain.setTargetAtTime(0.11 * Math.exp(-alt / 160), t, 0.5);

    this.updateMusic(dt);
  }
}

const _fwd = new THREE.Vector3();
