/* ui/HUD.js
   DOM heads-up display + the rotating minimap.

   The HUD is HTML because HTML is the right tool for crisp text at any DPI, and
   because it costs zero draw calls. Everything is written through cached element
   references and only when the underlying value actually changes, so a full HUD
   update is a handful of property writes per frame. */

import * as THREE from 'three';
import { clamp, clamp01, lerp } from '../core/MathUtils.js';
import { DISTRICT } from '../world/CityLayout.js';

const DISTRICT_TINT = {
  downtown: '#2b3a52', financial: '#2f3f4f', midtown: '#333a44',
  residential: '#3d3630', industrial: '#33322c', park: '#1e3320',
  waterfront: '#2a3336', water: '#0d1a24',
};

export class HUD {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      root: $('hud'),
      objTag: $('obj-tag'), objTitle: $('obj-title'), objDesc: $('obj-desc'), objFill: $('obj-fill'),
      health: $('health-fill'), focus: $('focus-fill'), xp: $('xp-fill'), level: $('level'),
      combo: $('combo'), comboCount: $('combo-count'), comboTimer: $('combo-timer').firstElementChild,
      reticle: $('reticle'), toasts: $('toasts'), markers: $('markers'),
      clock: $('clock'), weather: $('weather-chip'), compass: $('compass').firstElementChild,
      telemetry: $('telemetry'), telSpeed: $('tel-speed'), telAlt: $('tel-alt'),
      minimap: $('minimap'), damage: $('dmg-flash'), fps: $('fps'),
      subtitle: $('subtitle'), cineBars: $('cine-bars'), titleCard: $('title-card'),
    };
    this.ctx = this.el.minimap.getContext('2d');
    this.mmScale = 0.13;             // world units -> minimap pixels
    this.markerPool = [];
    this.activeMarkers = new Map();
    this._cache = {};
    this._toastQueue = [];
    this.visible = true;

    this._v = new THREE.Vector3();
    this._proj = new THREE.Vector3();
  }

  show(v) { this.el.root.classList.toggle('hidden', !v); this.visible = v; }

  /* ------------------------------------------------------------ writes */
  setObjective(tag, title, desc, progress = -1) {
    if (this._cache.objTitle !== title) { this.el.objTitle.textContent = title; this._cache.objTitle = title; }
    if (this._cache.objTag !== tag) { this.el.objTag.textContent = tag; this._cache.objTag = tag; }
    if (this._cache.objDesc !== desc) { this.el.objDesc.innerHTML = desc; this._cache.objDesc = desc; }
    this.el.objFill.style.width = progress < 0 ? '0%' : `${clamp01(progress) * 100}%`;
  }

  setCombo(count, frac) {
    this.el.combo.classList.toggle('on', count > 0);
    if (count > 0) {
      this.el.comboCount.textContent = count;
      this.el.comboTimer.style.transform = `scaleX(${clamp01(frac)})`;
    }
  }

  damageFlash(amount) {
    this.el.damage.style.opacity = clamp01(amount);
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => { this.el.damage.style.opacity = 0; }, 90);
  }

  pingReticle(kind) {
    const r = this.el.reticle;
    r.classList.remove('web', 'lock');
    if (kind === 'web') r.classList.add('web');
    else if (kind === 'lock') r.classList.add('lock');
    clearTimeout(this._retT);
    this._retT = setTimeout(() => r.classList.remove('web', 'lock'), 240);
  }

  enemyAlert() { this.pingReticle('lock'); }

  setWeather(state) { this.el.weather.textContent = String(state).toUpperCase(); }

  toast(title, sub = '', kind = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.innerHTML = sub ? `<small>${title}</small>${sub}` : `<b>${title}</b>`;
    this.el.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 2600);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  subtitle(text) {
    this.el.subtitle.innerHTML = text || '';
    this.el.subtitle.classList.toggle('on', !!text);
  }

  cinematicBars(on) { this.el.cineBars.classList.toggle('on', on); }

  titleCard(title, sub, duration = 3.2) {
    const t = this.el.titleCard;
    t.querySelector('h2').textContent = title;
    t.querySelector('p').textContent = sub;
    t.classList.add('on');
    clearTimeout(this._tcT);
    this._tcT = setTimeout(() => t.classList.remove('on'), duration * 1000);
  }

  /* ----------------------------------------------------------- markers */
  /**
   * @param {Array} list [{id, position:Vector3, kind:'main'|'side'|'collect'|'enemy', label}]
   */
  updateMarkers(list, camera, playerPos) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let el = this.activeMarkers.get(m.id);
      if (!el) {
        el = this.markerPool.pop() || document.createElement('div');
        el.innerHTML = `<div class="glyph"><b>${m.glyph || '!'}</b></div><div class="dist"></div>`;
        this.el.markers.appendChild(el);
        this.activeMarkers.set(m.id, el);
      }
      el.className = 'marker ' + (m.kind || 'main');

      this._proj.copy(m.position).project(camera);
      const dist = playerPos.distanceTo(m.position);
      const behind = this._proj.z > 1;
      let x = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
      let y = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
      if (behind) { x = window.innerWidth - x; y = window.innerHeight - 40; }
      // clamp to a safe frame so off-screen objectives still guide you
      const pad = 60;
      x = clamp(x, pad, window.innerWidth - pad);
      y = clamp(y, pad, window.innerHeight - pad);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.opacity = dist < 8 ? 0.25 : 1;
      el.lastChild.textContent = dist > 999 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm';
    }
    for (const [id, el] of this.activeMarkers) {
      if (seen.has(id)) continue;
      el.remove();
      this.markerPool.push(el);
      this.activeMarkers.delete(id);
    }
  }

  /* ---------------------------------------------------------- minimap */
  drawMinimap(player, camera) {
    const c = this.ctx, W = this.el.minimap.width, H = this.el.minimap.height;
    const L = this.game.world.layout;
    const s = this.mmScale * 2;      // canvas is 2x for crispness
    const px = player.position.x, pz = player.position.z;
    const heading = Math.atan2(
      camera.getWorldDirection(this._v).x, this._v.z);

    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#070a10'; c.fillRect(0, 0, W, H);

    c.translate(W / 2, H / 2);
    c.rotate(-heading);
    c.scale(s, s);
    c.translate(-px, -pz);

    // blocks
    const range = (W / 2) / s + L.cell;
    const bs = L.blockSize + 10;
    for (const b of L.blocks) {
      if (Math.abs(b.cx - px) > range || Math.abs(b.cz - pz) > range) continue;
      c.fillStyle = DISTRICT_TINT[b.district] || '#2b2f36';
      c.fillRect(b.cx - bs / 2, b.cz - bs / 2, bs, bs);
    }
    // buildings above a threshold get a lighter footprint so the skyline reads
    c.fillStyle = 'rgba(150,168,190,0.30)';
    for (const b of L.buildings) {
      if (b.height < 45) continue;
      if (Math.abs(b.x - px) > range || Math.abs(b.z - pz) > range) continue;
      c.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
    }

    // POIs
    const drawDot = (x, z, col, r = 3.6) => {
      c.fillStyle = col;
      c.beginPath(); c.arc(x, z, r / s * 2, 0, Math.PI * 2); c.fill();
    };
    for (const p of this.game.missions.mapPoints()) {
      if (Math.abs(p.x - px) > range || Math.abs(p.z - pz) > range) continue;
      drawDot(p.x, p.z, p.color, p.big ? 6 : 4);
    }
    for (const e of this.game.enemies.active) {
      if (!e.alive) continue;
      if (Math.abs(e.position.x - px) > range || Math.abs(e.position.z - pz) > range) continue;
      drawDot(e.position.x, e.position.z, '#ff7a45', 3.4);
    }
    c.restore();

    // player arrow
    c.save();
    c.translate(W / 2, H / 2);
    c.fillStyle = '#e8283c';
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(6.5, 8); c.lineTo(0, 4.5); c.lineTo(-6.5, 8);
    c.closePath(); c.fill();
    c.restore();

    // altitude ring: how high the player is, drawn as an arc
    const alt = clamp01(player.position.y / 260);
    c.strokeStyle = 'rgba(102,230,255,0.75)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(W / 2, H / 2, W / 2 - 6, -Math.PI / 2, -Math.PI / 2 + alt * Math.PI * 2);
    c.stroke();
  }

  /* ----------------------------------------------------------- update */
  update(dt, game) {
    const p = game.player;
    const e = this.el;

    const hp = clamp01(p.health / 100);
    e.health.style.transform = `scaleX(${hp})`;
    e.focus.style.transform = `scaleX(${clamp01(p.focus / 100)})`;
    const need = p.level * 500;
    e.xp.style.width = `${clamp01(p.xp / need) * 100}%`;
    if (this._cache.level !== p.level) {
      e.level.innerHTML = 'LV <b>' + p.level + '</b>';
      this._cache.level = p.level;
    }

    const spd = p.telemetry.speed;
    e.telemetry.classList.toggle('on', spd > 25 || p.position.y > 30);
    if (this._cache.spd !== spd) { e.telSpeed.textContent = spd; this._cache.spd = spd; }
    const alt = p.telemetry.altitude;
    if (this._cache.alt !== alt) { e.telAlt.textContent = alt; this._cache.alt = alt; }

    const clock = game.dayNight.clockString;
    if (this._cache.clock !== clock) { e.clock.textContent = clock; this._cache.clock = clock; }

    const heading = Math.atan2(game.camera.camera.getWorldDirection(this._v).x, this._v.z);
    const dirs = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
    const idx = Math.round(((heading + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    if (this._cache.compass !== dirs[idx]) { e.compass.textContent = dirs[idx]; this._cache.compass = dirs[idx]; }

    this.drawMinimap(p, game.camera.camera);

    // ability affordances
    const abil = document.querySelectorAll('.ability');
    const ready = [
      true,
      game.combat.webCooldown.pull <= 0 && p.focus >= 12,
      game.combat.webCooldown.trap <= 0 && p.focus >= 20,
      p.focus >= 10,
      true,
    ];
    abil.forEach((a, i) => a.classList.toggle('ready', !!ready[i]));

    if (game.settings.showFps) {
      e.fps.textContent = game.statsLine;
      e.fps.style.display = '';
    } else e.fps.style.display = 'none';
  }
}
