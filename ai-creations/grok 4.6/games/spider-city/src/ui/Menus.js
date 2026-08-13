/* ui/Menus.js
   Pause shell: fullscreen interactive map, mission log, abilities, settings.
   The map is drawn from the same CityLayout the world was built from, so it is
   always exactly the city you are standing in — and clicking a discovered
   fast-travel point actually moves you there. */

import { QUALITY_PRESETS } from '../core/Settings.js';
import { DISTRICT, districtLabel } from '../world/CityLayout.js';
import { clamp } from '../core/MathUtils.js';

const TINT = {
  downtown: '#39485f', financial: '#3b4b5c', midtown: '#3a414b',
  residential: '#4a4038', industrial: '#3d3b33', park: '#27401f',
  waterfront: '#32403f', water: '#0e2130',
};

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('pause');
    this.tabs = [...document.querySelectorAll('#menu-tabs .tab')];
    this.bodies = {
      map: document.getElementById('tab-map'),
      missions: document.getElementById('tab-missions'),
      abilities: document.getElementById('tab-abilities'),
      settings: document.getElementById('tab-settings'),
    };
    this.bigmap = document.getElementById('bigmap');
    this.mapCtx = this.bigmap.getContext('2d');
    this.open = false;
    this.current = 'map';

    this.tabs.forEach((t) => t.addEventListener('click', () => {
      const name = t.dataset.tab;
      if (name === 'resume') { this.close(); return; }
      this.select(name);
    }));

    this.bigmap.addEventListener('click', (ev) => this.onMapClick(ev));
    document.getElementById('map-legend').innerHTML = `
      <div><s style="background:#e8283c"></s>MAIN MISSION</div>
      <div><s style="background:#66e6ff"></s>SIDE ACTIVITY</div>
      <div><s style="background:#ffc65c"></s>COLLECTIBLE</div>
      <div><s style="background:#ffffff"></s>FAST TRAVEL</div>
      <div style="opacity:.6;margin-top:8px">CLICK A FAST TRAVEL POINT</div>`;
  }

  toggle() { this.open ? this.close() : this.show(); }

  show() {
    this.open = true;
    this.root.classList.remove('hidden');
    this.game.input.exitLock();
    this.select(this.current);
  }
  close() {
    this.open = false;
    this.root.classList.add('hidden');
    this.game.input.requestLock();
  }

  select(name) {
    this.current = name;
    this.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    for (const k in this.bodies) this.bodies[k].classList.toggle('hidden', k !== name);
    if (name === 'map') this.drawMap();
    if (name === 'missions') this.drawMissions();
    if (name === 'abilities') this.drawAbilities();
    if (name === 'settings') this.drawSettings();
  }

  /* --------------------------------------------------------------- map */
  mapTransform() {
    const L = this.game.world.layout;
    const size = this.bigmap.width;
    const span = L.size * L.cell + L.cell;
    const k = size / span;
    return { k, ox: size / 2, oz: size / 2, span };
  }

  drawMap() {
    const c = this.mapCtx, W = this.bigmap.width, H = this.bigmap.height;
    const L = this.game.world.layout;
    const { k, ox, oz } = this.mapTransform();
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#070a10'; c.fillRect(0, 0, W, H);

    c.save();
    c.translate(ox, oz); c.scale(k, k);

    // water first
    c.fillStyle = TINT.water;
    c.fillRect(L.waterEdgeX, -L.extent - L.cell, L.extent * 2, L.extent * 2 + L.cell * 2);

    const bs = L.blockSize + 8;
    for (const b of L.blocks) {
      if (b.district === DISTRICT.WATER) continue;
      c.fillStyle = TINT[b.district] || '#333';
      c.fillRect(b.cx - bs / 2, b.cz - bs / 2, bs, bs);
    }
    // tall buildings as a light overlay: instant read of where downtown is
    c.fillStyle = 'rgba(190,206,226,0.22)';
    for (const b of L.buildings) {
      if (b.height < 60) continue;
      c.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
    }
    // roads
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 10;
    for (const x of L.roadsZ) { c.beginPath(); c.moveTo(x, -L.extent - 60); c.lineTo(x, L.extent + 60); c.stroke(); }
    for (const z of L.roadsX) { c.beginPath(); c.moveTo(-L.extent - 60, z); c.lineTo(L.extent + 60, z); c.stroke(); }

    // district labels
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '600 22px Rajdhani, sans-serif';
    c.textAlign = 'center';
    const seen = new Set();
    for (const b of L.blocks) {
      if (seen.has(b.district) || b.district === DISTRICT.WATER) continue;
      seen.add(b.district);
      c.fillText(districtLabel(b.district).toUpperCase(), b.cx, b.cz);
    }
    c.restore();

    // markers
    this.mapMarkers = [];
    for (const p of this.game.missions.mapPoints(true)) {
      const x = ox + p.x * k, y = oz + p.z * k;
      c.fillStyle = p.color;
      c.beginPath(); c.arc(x, y, p.big ? 8 : 5, 0, Math.PI * 2); c.fill();
      if (p.big) {
        c.strokeStyle = p.color; c.lineWidth = 1.5; c.globalAlpha = 0.5;
        c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      }
      if (p.label) {
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.font = '500 13px Rajdhani, sans-serif';
        c.textAlign = 'left';
        c.fillText(p.label, x + 11, y + 4);
      }
      this.mapMarkers.push({ ...p, sx: x, sy: y });
    }

    // player
    const px = ox + this.game.player.position.x * k;
    const py = oz + this.game.player.position.z * k;
    c.fillStyle = '#e8283c';
    c.beginPath(); c.arc(px, py, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(232,40,60,0.6)'; c.lineWidth = 2;
    c.beginPath(); c.arc(px, py, 13, 0, Math.PI * 2); c.stroke();
  }

  onMapClick(ev) {
    if (!this.mapMarkers) return;
    const r = this.bigmap.getBoundingClientRect();
    const sx = (ev.clientX - r.left) * (this.bigmap.width / r.width);
    const sy = (ev.clientY - r.top) * (this.bigmap.height / r.height);
    let best = null, bd = 26;
    for (const m of this.mapMarkers) {
      const d = Math.hypot(m.sx - sx, m.sy - sy);
      if (d < bd && m.type === 'fasttravel') { bd = d; best = m; }
    }
    if (!best) return;
    this.game.fastTravel(best);
    this.close();
  }

  /* ---------------------------------------------------------- missions */
  drawMissions() {
    const list = this.game.missions.log();
    this.bodies.missions.innerHTML = `<div id="mission-list">${
      list.map((m) => `
        <div class="mission-card ${m.done ? 'done' : ''}">
          <div class="type">${m.type}</div>
          <h4>${m.title}</h4>
          <p>${m.desc}</p>
        </div>`).join('')
    }</div>`;
  }

  /* --------------------------------------------------------- abilities */
  drawAbilities() {
    const p = this.game.player;
    const rows = [
      ['Web Swing', 'The strand attaches under the reticle. Aim high, hold <b>RMB</b> or tap <b>X</b>, pump and reel with <b>W</b>, reel out with <b>S</b>.', 'CORE'],
      ['Slingshot', '<b>R</b> mid-swing. Spends focus to fire you along the web line.', 'FOCUS 18'],
      ['Web Zip', '<b>F</b>. Instantly pull yourself to any surface you are looking at.', 'FOCUS 10'],
      ['Web Pull', '<b>E</b>. Yanks light enemies to you; heavy enemies pull you to them.', 'FOCUS 12'],
      ['Web Trap', '<b>Q</b>. Cocoons a target. Against a wall they stay pinned.', 'FOCUS 20'],
      ['Wall Run', 'Jump into a wall while moving toward it. Hold <b>Shift</b> on contact to crawl instead.', 'CORE'],
      ['Perfect Dodge', '<b>Shift</b> during an enemy wind-up. Time dilates and focus is refunded.', 'CORE'],
      ['Launcher', 'Every third strike launches. Keep hitting airborne enemies to juggle.', 'CORE'],
      ['Dive', 'Hold <b>C</b> in the air. Fastest travel in the game, and it sets up swing kicks.', 'CORE'],
    ];
    this.bodies.abilities.innerHTML = `<div>${rows.map((r) => `
      <div class="row">
        <div><div class="lbl">${r[0]}</div><div class="sub">${r[2]}</div></div>
        <div class="sub" style="max-width:60%;text-align:right">${r[1]}</div>
      </div>`).join('')}
      <div class="row"><div class="lbl">Level</div><div class="val">${p.level} &nbsp; ${p.xp} XP</div></div>
      </div>`;
  }

  /* ---------------------------------------------------------- settings */
  drawSettings() {
    const s = this.game.settings;
    const qualityKeys = Object.keys(QUALITY_PRESETS);
    const row = (label, sub, control) =>
      `<div class="row"><div><div class="lbl">${label}</div><div class="sub">${sub}</div></div><div>${control}</div></div>`;

    this.bodies.settings.innerHTML = `
      ${row('Quality preset', 'Changing this rebuilds the city', qualityKeys.map((k) =>
        `<button data-q="${k}" style="${k === s.quality ? 'background:#e8283c;border-color:#e8283c' : ''}">${QUALITY_PRESETS[k].name}</button>`).join(' '))}
      ${row('Field of view', 'Base FOV; speed adds more automatically',
        `<button data-fov="-5">-</button> <span class="val" id="fovv">${Math.round(s.fov)}</span> <button data-fov="5">+</button>`)}
      ${row('Mouse sensitivity', '',
        `<button data-sens="-0.1">-</button> <span class="val" id="sensv">${s.mouseSensitivity.toFixed(1)}</span> <button data-sens="0.1">+</button>`)}
      ${row('Invert Y', '', `<button data-t="invertY">${s.invertY ? 'ON' : 'OFF'}</button>`)}
      ${row('Motion blur', 'Radial, speed driven', `<button data-t="motionBlur">${s.motionBlur ? 'ON' : 'OFF'}</button>`)}
      ${row('Cinematic depth of field', 'Used during scripted shots', `<button data-t="depthOfField">${s.depthOfField ? 'ON' : 'OFF'}</button>`)}
      ${row('Film grain', '', `<button data-t="filmGrain">${s.filmGrain ? 'ON' : 'OFF'}</button>`)}
      ${row('Chromatic aberration', '', `<button data-t="chromaticAberration">${s.chromaticAberration ? 'ON' : 'OFF'}</button>`)}
      ${row('Performance readout', '', `<button data-t="showFps">${s.showFps ? 'ON' : 'OFF'}</button>`)}
      ${row('Lighting', 'Locked for clear traversal visibility', `<span class="val">DAYLIGHT</span>`)}
      ${row('Weather', 'Force a condition',
        `<button data-w="clear">CLEAR</button> <button data-w="cloudy">CLOUD</button> <button data-w="rain">RAIN</button> <button data-w="storm">STORM</button>`)}
      ${row('Master volume', '',
        `<button data-vol="-0.1">-</button> <span class="val" id="volv">${Math.round(s.masterVolume * 100)}%</span> <button data-vol="0.1">+</button>`)}
      ${row('Restart mission', 'Replay the main story beat', `<button data-act="restart">RESTART</button>`)}
    `;

    this.bodies.settings.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => this.onSetting(b));
    });
  }

  onSetting(b) {
    const s = this.game.settings;
    const d = b.dataset;
    if (d.q) { this.game.setQuality(d.q); }
    else if (d.fov) { s.fov = clamp(s.fov + (+d.fov), 50, 110); this.game.camera.setFov(s.fov); }
    else if (d.sens) { s.mouseSensitivity = clamp(s.mouseSensitivity + (+d.sens), 0.2, 3); }
    else if (d.t) { s[d.t] = !s[d.t]; this.game.postfx.applySettings(); }
    else if (d.w) { this.game.weather.set(d.w, true); }
    else if (d.vol) { s.masterVolume = clamp(s.masterVolume + (+d.vol), 0, 1); this.game.audio.setMasterVolume(s.masterVolume); }
    else if (d.act === 'restart') { this.game.missions.restartMain(); this.close(); return; }
    s.save();
    this.drawSettings();
  }
}
