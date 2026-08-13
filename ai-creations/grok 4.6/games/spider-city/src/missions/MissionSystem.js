/* missions/MissionSystem.js
   A small, complete mission framework plus the scripted main story beat.

   Missions are plain state machines with an `enter/update/exit` per stage, an
   objective string for the HUD, and a marker list. Adding a mission is adding an
   object to MISSIONS — no engine changes required, which is the whole point of
   keeping this file free of any rendering code.

   MAIN: "SIGNAL FROM BELOW"
     explore -> emergency downtown -> approach -> cinematic -> combat ->
     rooftop chase -> mini-boss -> villain escapes -> complete
*/

import * as THREE from 'three';
import { clamp01, lerp } from '../core/MathUtils.js';

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.active = null;
    this.stage = 'idle';
    this.stageTime = 0;
    this.markers = [];
    this.completed = new Set();
    this.collected = new Set();
    this.sideActive = null;
    this.mainStarted = false;
    this.mainDone = false;
    this.villain = null;
    this.chaseIndex = 0;
    this.chaseWaypoints = [];
    this.objective = { tag: 'CITY PATROL', title: 'Learn the city', desc: 'Hold <b>RMB</b> or tap <b>X</b> to swing. <b>TAB</b> for the map.', progress: -1 };
    this.timer = 0;
    this.introTimer = 26;
    this.timeTrial = null;
    this.stats = { crimesStopped: 0, cachesFound: 0, trialsBeaten: 0 };
  }

  /* ------------------------------------------------------------ helpers */
  say(text, seconds = 3.4) {
    this.game.hud.subtitle(text);
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => this.game.hud.subtitle(''), seconds * 1000);
  }

  setObjective(tag, title, desc, progress = -1) {
    this.objective = { tag, title, desc, progress };
    this.game.hud.setObjective(tag, title, desc, progress);
  }

  /* -------------------------------------------------------------- main */
  startMain() {
    if (this.mainStarted) return;
    this.mainStarted = true;

    // Stage the incident on a plaza in the downtown core, near a tall roof.
    const L = this.world.layout;
    const centreBlock = L.blocks.find((b) => b.district === 'downtown' && Math.hypot(b.cx, b.cz) > 60)
      || L.blocks[Math.floor(L.blocks.length / 2)];
    this.incident = new THREE.Vector3(centreBlock.cx, 0.3, centreBlock.cz);
    const spot = this.world.findStreetSpot(this.incident.x, this.incident.z, 40);
    this.incident.set(spot.x, 0.3, spot.z);

    this.stage = 'alert';
    this.stageTime = 0;
    this.setObjective('MAIN MISSION', 'Signal From Below',
      'A district-wide blackout just hit downtown. <b>Get there.</b>', -1);
    this.game.hud.toast('EMERGENCY', 'Downtown grid is down', '');
    this.game.audio.setMusic('mission');
    this.say('<b>DISPATCH:</b> All units — downtown grid just dropped. Something is jamming the whole block.', 5);
  }

  restartMain() {
    this.mainStarted = false; this.mainDone = false;
    this.stage = 'idle';
    if (this.villain) { this.game.enemies.release(this.villain); this.villain = null; }
    this.game.enemies.clearAll();
    this.introTimer = 4;
    this.setObjective('CITY PATROL', 'Awaiting signal', 'Keep moving.', -1);
  }

  updateMain(dt) {
    const p = this.game.player;
    this.stageTime += dt;

    switch (this.stage) {
      case 'alert': {
        const d = p.position.distanceTo(this.incident);
        this.setObjective('MAIN MISSION', 'Signal From Below',
          'Reach the blackout site downtown.', clamp01(1 - d / 900));
        if (d < 70) this.enterApproach();
        break;
      }

      case 'approach': {
        // cinematic: orbit the plaza, push in on the arriving hostiles
        if (this.stageTime > this.cineLength) this.enterCombat();
        break;
      }

      case 'combat': {
        const left = this.encounter ? this.encounter.members.filter((m) => m.alive).length : 0;
        this.setObjective('MAIN MISSION', 'Clear the plaza',
          `Hostiles remaining: <b>${left}</b>`, 1 - left / Math.max(1, this.encounter.members.length));
        if (left === 0) this.enterChase();
        break;
      }

      case 'chase': {
        const v = this.villain;
        if (!v) { this.enterBoss(); break; }
        const wp = this.chaseWaypoints[this.chaseIndex];
        v.scripted = true;
        v.scriptTarget = wp;
        v.scriptSpeed = 26;
        const dToWp = v.position.distanceTo(wp);
        if (dToWp < 6) {
          this.chaseIndex++;
          if (this.chaseIndex >= this.chaseWaypoints.length) { this.enterBoss(); break; }
        }
        const gap = p.position.distanceTo(v.position);
        this.setObjective('MAIN MISSION', 'Rooftop pursuit',
          `Do not lose him — <b>${Math.round(gap)}m</b>`,
          clamp01(this.chaseIndex / this.chaseWaypoints.length));
        // if the player falls too far behind, the villain waits (mercy rubber-band)
        v.scriptSpeed = gap > 90 ? 9 : gap < 25 ? 30 : 24;
        if (this.stageTime > 4 && gap < 14 && this.chaseIndex > 1) this.enterBoss();
        break;
      }

      case 'boss': {
        const v = this.villain;
        if (!v || !v.alive) { this.enterEscape(); break; }
        const adds = this.game.enemies.active.filter((e) => e.alive && e !== v).length;
        this.setObjective('MAIN MISSION', 'Take down RAMPART',
          `Integrity <b>${Math.round(100 * v.health / v.maxHealth)}%</b>` + (adds ? ` · ${adds} escorts` : ''),
          1 - v.health / v.maxHealth);
        break;
      }

      case 'escape': {
        if (this.stageTime > this.cineLength) this.completeMain();
        break;
      }
    }
  }

  enterApproach() {
    this.stage = 'approach'; this.stageTime = 0;
    const cam = this.game.camera;
    const p = this.game.player;
    const roof = this.world.nearestRoof(this.incident.x, this.incident.z, 60)
      || { x: this.incident.x, y: 90, z: this.incident.z };

    const c = this.incident.clone().setY(2);
    const shots = [
      { // wide establishing push-in from above
        from: new THREE.Vector3(roof.x + 40, roof.y + 30, roof.z + 40),
        to: new THREE.Vector3(this.incident.x + 22, 16, this.incident.z + 22),
        look: c.clone(), lookTo: c.clone(), dur: 3.2, fov: 40,
      },
      { // low orbit around the plaza
        from: new THREE.Vector3(this.incident.x + 18, 3.2, this.incident.z - 14),
        to: new THREE.Vector3(this.incident.x - 16, 4.0, this.incident.z - 18),
        look: c.clone(), lookTo: c.clone(), dur: 2.6, fov: 52,
      },
      { // hero framing: back to the player as the enemies arrive
        from: new THREE.Vector3(p.position.x - 5, p.position.y + 3.4, p.position.z - 5),
        to: new THREE.Vector3(p.position.x - 3.4, p.position.y + 2.4, p.position.z - 3.4),
        look: p.position.clone().setY(p.position.y + 1.5), lookTo: c.clone(), dur: 2.4, fov: 58,
      },
    ];
    this.cineLength = shots.reduce((a, s) => a + s.dur, 0);
    this.game.startCinematic(shots, 0.55);
    this.say('<b>RAMPART:</b> You are early, insect. That is the only thing you have ever been good at.', 5.5);
    this.game.hud.titleCard('SIGNAL FROM BELOW', 'MAIN MISSION', 4);
    this.game.audio.setMusic('tension');
    this.setObjective('MAIN MISSION', 'Signal From Below', 'Something is waiting for you.', -1);
  }

  enterCombat() {
    this.stage = 'combat'; this.stageTime = 0;
    this.game.endCinematic();
    this.encounter = this.game.enemies.spawnEncounter(this.incident, 2.4, { label: 'Rampart Crew' });
    this.game.npcs.alarm(this.incident, 90, 1);
    this.game.traffic.panic(this.incident, 80);
    this.game.audio.setMusic('combat');
    this.game.hud.toast('HOSTILES', 'Rampart crew engaged', '');
  }

  enterChase() {
    this.stage = 'chase'; this.stageTime = 0;
    this.chaseIndex = 0;
    this.game.audio.setMusic('chase');

    // Build a rooftop route heading away from the incident.
    const dirA = Math.random() * Math.PI * 2;
    this.chaseWaypoints = [];
    let cx = this.incident.x, cz = this.incident.z;
    for (let i = 0; i < 6; i++) {
      const a = dirA + (Math.random() - 0.5) * 0.9;
      cx += Math.cos(a) * 150; cz += Math.sin(a) * 150;
      const roof = this.world.nearestRoof(cx, cz, 35);
      if (!roof) break;
      cx = roof.x; cz = roof.z;
      this.chaseWaypoints.push(new THREE.Vector3(roof.x, roof.y + 1.2, roof.z));
    }
    if (!this.chaseWaypoints.length) { this.enterBoss(); return; }

    const start = this.world.nearestRoof(this.incident.x, this.incident.z, 40)
      || { x: this.incident.x, y: 60, z: this.incident.z };
    this.villain = this.game.enemies.spawn('miniboss', start.x, start.y + 1, start.z);
    this.villain.scripted = true;
    this.villain.scriptTarget = this.chaseWaypoints[0];

    this.say('<b>RAMPART:</b> Catch up, then. Let us see what you have left.', 4);
    this.game.hud.toast('PURSUIT', 'Rampart is running the rooftops', '');
  }

  enterBoss() {
    this.stage = 'boss'; this.stageTime = 0;
    const v = this.villain;
    if (!v) { this.enterEscape(); return; }
    v.scripted = false;
    v.body.skipCollision = false;
    v.setState('chase');
    this.game.audio.setMusic('boss');
    // two escorts land alongside him
    const c = v.position.clone();
    this.game.enemies.spawnEncounter(c, 1, { onRoof: true, roster: ['shield', 'ranged'], label: 'Escort' });
    this.game.hud.titleCard('RAMPART', 'MINI-BOSS', 3.4);
    this.say('<b>RAMPART:</b> Enough running. Let us do this properly.', 4);
  }

  enterEscape() {
    this.stage = 'escape'; this.stageTime = 0;
    const p = this.game.player;
    const v = this.villain;
    const c = (v ? v.position : p.position).clone();
    this.game.fx.explosion(c, 1.4);
    this.game.npcs.alarm(c, 60, 0.6);
    if (v) { v.object.visible = false; }
    const shots = this.game.camera.orbitShot(
      p.position.clone().setY(p.position.y + 1.4), 7.5, 2.4, 4.4, 0.6);
    shots.push({
      from: p.position.clone().add(new THREE.Vector3(0, 4, 8)),
      to: p.position.clone().add(new THREE.Vector3(0, 26, 34)),
      look: p.position.clone().setY(p.position.y + 1.2),
      lookTo: p.position.clone().setY(p.position.y + 60),
      dur: 4.0, fov: 46,
    });
    this.cineLength = shots.reduce((a, s) => a + s.dur, 0);
    this.game.startCinematic(shots, 0.7);
    this.say('<b>RAMPART:</b> Smoke and mirrors, insect. We will finish this.', 4.5);
  }

  completeMain() {
    this.game.endCinematic();
    this.stage = 'done';
    this.mainDone = true;
    this.completed.add('main');
    if (this.villain) { this.game.enemies.release(this.villain); this.villain = null; }
    this.game.player.addXp(1500);
    this.game.hud.titleCard('MISSION COMPLETE', 'SIGNAL FROM BELOW', 4);
    this.game.hud.toast('+1500 XP', 'Rampart escaped — for now', 'gold');
    this.game.audio.setMusic('explore');
    this.setObjective('CITY PATROL', 'Free roam',
      'Side activities are marked on the map. <b>TAB</b> to open it.', -1);
  }

  /* --------------------------------------------------- side activities */
  startTimeTrial(poi) {
    if (this.timeTrial) return;
    const pts = [];
    let cx = poi.x, cz = poi.z;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      cx += Math.cos(a) * 170; cz += Math.sin(a) * 170;
      const roof = this.world.nearestRoof(cx, cz, 25);
      if (!roof) break;
      cx = roof.x; cz = roof.z;
      pts.push(new THREE.Vector3(roof.x, roof.y + 2, roof.z));
    }
    if (pts.length < 3) return;
    this.timeTrial = { id: poi.id, pts, index: 0, time: 8 + pts.length * 7.5, total: 0 };
    this.game.hud.toast('SKYLINE RUN', 'Hit every marker before the clock runs out', 'good');
    this.game.audio.setMusic('chase');
  }

  updateTimeTrial(dt) {
    const t = this.timeTrial;
    if (!t) return;
    t.time -= dt; t.total += dt;
    const target = t.pts[t.index];
    const d = this.game.player.position.distanceTo(target);
    this.setObjective('TIME TRIAL', 'Skyline Run',
      `Marker <b>${t.index + 1}/${t.pts.length}</b> · <b>${t.time.toFixed(1)}s</b>`,
      t.index / t.pts.length);
    if (d < 11) {
      t.index++;
      this.game.fx.burst(target, 24, { speed: 7, size: 0.5, life: 0.7, color: [0.4, 0.9, 1], up: 1 });
      this.game.audio.play('checkpoint', target);
      if (t.index >= t.pts.length) {
        this.completed.add(t.id);
        this.stats.trialsBeaten++;
        this.game.player.addXp(400);
        this.game.hud.toast('SKYLINE RUN CLEARED', t.total.toFixed(1) + 's · +400 XP', 'gold');
        this.timeTrial = null;
        this.game.audio.setMusic('explore');
        this.restoreObjective();
        return;
      }
    }
    if (t.time <= 0) {
      this.game.hud.toast('TIME UP', 'Skyline run failed', '');
      this.timeTrial = null;
      this.game.audio.setMusic('explore');
      this.restoreObjective();
    }
  }

  restoreObjective() {
    if (this.stage !== 'idle' && this.stage !== 'done') return;
    if (this.mainDone) {
      this.setObjective('CITY PATROL', 'Free roam',
        'Side activities are marked on the map. <b>TAB</b> to open it.', -1);
    } else {
      this.setObjective('CITY PATROL', 'Learn the city',
        'Hold <b>RMB</b> or tap <b>X</b> to swing. <b>TAB</b> for the map.', -1);
    }
  }

  collect(poi) {
    if (this.collected.has(poi.id)) return;
    this.collected.add(poi.id);
    this.stats.cachesFound++;
    this.game.player.addXp(150);
    this.game.player.heal(15);
    this.game.fx.burst(new THREE.Vector3(poi.x, poi.y + 1, poi.z), 30, {
      speed: 6, size: 0.5, life: 0.9, color: [1, 0.78, 0.35], up: 1.2,
    });
    this.game.audio.play('pickup', new THREE.Vector3(poi.x, poi.y, poi.z));
    this.game.hud.toast('FIELD CACHE ' + this.stats.cachesFound + '/24', '+150 XP · patched up', 'gold');
  }

  /* ------------------------------------------------------------ update */
  update(dt) {
    const p = this.game.player;

    if (!this.mainStarted && this.stage === 'idle') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.startMain();
    }
    if (this.mainStarted && !this.mainDone) this.updateMain(dt);
    if (this.timeTrial) this.updateTimeTrial(dt);

    /* proximity triggers */
    for (const poi of this.world.layout.pois) {
      const d2 = (poi.x - p.position.x) ** 2 + (poi.z - p.position.z) ** 2
        + ((poi.y || 0) - p.position.y) ** 2;
      if (poi.type === 'collectible' && d2 < 16 && !this.collected.has(poi.id)) this.collect(poi);
      if (poi.type === 'timetrial' && d2 < 36 && !this.completed.has(poi.id) && !this.timeTrial) {
        this.startTimeTrial(poi);
      }
    }

    this.buildMarkers();
    this.game.hud.setObjective(this.objective.tag, this.objective.title, this.objective.desc, this.objective.progress);
  }

  buildMarkers() {
    const m = this.markers;
    m.length = 0;
    const p = this.game.player.position;

    if (this.stage === 'alert') m.push({ id: 'main', position: this.incident, kind: 'main', glyph: '!' });
    if (this.stage === 'combat' && this.encounter) {
      for (const e of this.encounter.members) {
        if (e.alive) m.push({ id: 'e' + e.id, position: e.position, kind: 'enemy', glyph: '✖' });
      }
    }
    if ((this.stage === 'chase' || this.stage === 'boss') && this.villain && this.villain.alive) {
      m.push({ id: 'villain', position: this.villain.position, kind: 'main', glyph: 'R' });
    }
    if (this.timeTrial) {
      const t = this.timeTrial;
      m.push({ id: 'tt', position: t.pts[t.index], kind: 'side', glyph: '◆' });
    }
    if (this.game.events.current) {
      m.push({ id: 'evt', position: this.game.events.current.position, kind: 'side', glyph: '!' });
    }
    // nearby collectibles only, so the screen never fills with icons
    for (const poi of this.world.layout.pois) {
      if (poi.type !== 'collectible' || this.collected.has(poi.id)) continue;
      const d = Math.hypot(poi.x - p.x, poi.z - p.z);
      if (d > 130) continue;
      m.push({ id: poi.id, position: _v.set(poi.x, poi.y, poi.z).clone(), kind: 'collect', glyph: '◇' });
    }
  }

  /* -------------------------------------------------------- map + log */
  mapPoints(withLabels = false) {
    const out = [];
    if (this.stage !== 'idle' && this.stage !== 'done' && this.incident) {
      const t = (this.stage === 'chase' || this.stage === 'boss') && this.villain
        ? this.villain.position : this.incident;
      out.push({ x: t.x, z: t.z, color: '#e8283c', big: true, label: withLabels ? 'Signal From Below' : '' });
    }
    for (const poi of this.world.layout.pois) {
      if (poi.type === 'collectible') {
        if (this.collected.has(poi.id)) continue;
        out.push({ x: poi.x, z: poi.z, color: '#ffc65c', big: false });
      } else if (poi.type === 'timetrial') {
        if (this.completed.has(poi.id)) continue;
        out.push({ x: poi.x, z: poi.z, color: '#66e6ff', big: true, label: withLabels ? poi.name : '', type: 'timetrial' });
      } else if (poi.type === 'fasttravel') {
        out.push({ x: poi.x, y: poi.y, z: poi.z, color: '#ffffff', big: true,
          label: withLabels ? poi.name : '', type: 'fasttravel' });
      }
    }
    if (this.game.events.current) {
      const e = this.game.events.current;
      out.push({ x: e.position.x, z: e.position.z, color: '#66e6ff', big: true, label: withLabels ? e.label : '' });
    }
    return out;
  }

  log() {
    const out = [{
      type: 'MAIN MISSION', title: 'Signal From Below',
      desc: this.mainDone
        ? 'Rampart escaped through the rooftops after the plaza fight. Whatever knocked out the grid is still out there.'
        : 'A blackout downtown, a crew that was waiting for you, and a name you have not heard before.',
      done: this.mainDone,
    }];
    out.push({
      type: 'COLLECTIBLES', title: 'Field Caches',
      desc: `Supply drops stashed on rooftops across the city. Found <b>${this.stats.cachesFound}/24</b>.`,
      done: this.stats.cachesFound >= 24,
    });
    out.push({
      type: 'CHALLENGE', title: 'Skyline Runs',
      desc: `Rooftop time trials. Cleared <b>${this.stats.trialsBeaten}/5</b>.`,
      done: this.stats.trialsBeaten >= 5,
    });
    out.push({
      type: 'PATROL', title: 'Street Crime',
      desc: `Random incidents across the city. Stopped <b>${this.stats.crimesStopped}</b> so far.`,
      done: false,
    });
    return out;
  }
}

const _v = new THREE.Vector3();
