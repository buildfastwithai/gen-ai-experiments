/* missions/WorldEvents.js
   The ambient crime director.

   Every so often, somewhere just outside the player's view but inside earshot,
   something goes wrong. The director picks an event weighted by district (muggings
   in residential, robberies downtown, ambushes on rooftops), stages it, gives the
   player a soft prompt, and cleans up whether or not they intervene — so the city
   always feels like it has a life you are dipping in and out of. */

import * as THREE from 'three';
import { makeRng, clamp01 } from '../core/MathUtils.js';
import { glowMaterial } from '../world/CityMaterials.js';

const EVENT_TYPES = [
  { id: 'robbery',   label: 'Armed Robbery',    threat: 1.4, districts: ['downtown', 'financial', 'midtown'], reward: 260 },
  { id: 'mugging',   label: 'Civilian in Danger', threat: 0.8, districts: ['residential', 'midtown', 'park'], reward: 180 },
  { id: 'ambush',    label: 'Ambush',           threat: 2.0, districts: ['industrial', 'waterfront', 'downtown'], reward: 340, roof: true },
  { id: 'pursuit',   label: 'Police Pursuit',   threat: 1.2, districts: ['downtown', 'midtown', 'industrial'], reward: 240, vehicle: true },
  { id: 'streetfight', label: 'Street Fight',   threat: 1.0, districts: ['residential', 'industrial', 'waterfront'], reward: 200 },
  { id: 'emergency', label: 'Building Emergency', threat: 1.6, districts: ['downtown', 'residential', 'midtown'], reward: 300 },
  { id: 'accident',  label: 'Vehicle Accident', threat: 0.6, districts: ['midtown', 'financial', 'industrial'], reward: 150 },
];

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(5150);
    this.current = null;
    this.cooldown = 42;
    this.beacon = null;
    this.history = [];
    this.makeBeacon();
  }

  makeBeacon() {
    // A column of light so an active incident reads from three blocks away.
    const g = new THREE.CylinderGeometry(2.4, 3.6, 90, 12, 1, true);
    g.translate(0, 45, 0);
    const m = new THREE.MeshBasicMaterial({
      color: 0x66e6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true,
    });
    this.beacon = new THREE.Mesh(g, m);
    this.beacon.visible = false;
    this.beacon.renderOrder = 5;
    this.game.scene.add(this.beacon);
  }

  /* ------------------------------------------------------------ spawn */
  trigger(forceType = null) {
    if (this.current) return;
    const p = this.game.player.position;
    const district = this.game.world.districtAtWorld(p.x, p.z);

    const pool = EVENT_TYPES.filter((e) => !forceType || e.id === forceType);
    const weighted = pool.map((e) => ({ e, w: e.districts.includes(district) ? 3 : 1 }));
    const total = weighted.reduce((a, x) => a + x.w, 0);
    let r = this.rng() * total, def = weighted[0].e;
    for (const x of weighted) { r -= x.w; if (r <= 0) { def = x.e; break; } }

    // Place it 90–190 m away so the player has a reason to travel.
    const a = this.rng() * Math.PI * 2;
    const dist = 90 + this.rng() * 100;
    let pos;
    if (def.roof) {
      const roof = this.game.world.nearestRoof(p.x + Math.cos(a) * dist, p.z + Math.sin(a) * dist, 30);
      pos = roof ? new THREE.Vector3(roof.x, roof.y + 0.4, roof.z) : null;
    } else {
      const spot = this.game.world.findStreetSpot(p.x + Math.cos(a) * dist, p.z + Math.sin(a) * dist, 45);
      pos = new THREE.Vector3(spot.x, spot.y, spot.z);
    }
    if (!pos) return;

    const enc = this.game.enemies.spawnEncounter(pos, def.threat, {
      onRoof: !!def.roof, label: def.label,
    });

    this.current = {
      def, position: pos, encounter: enc, label: def.label,
      time: 0, limit: 150, engaged: false, id: 'evt' + Date.now(),
    };

    this.beacon.position.copy(pos);
    this.beacon.visible = true;
    this.beacon.material.color.setHex(0x66e6ff);

    this.game.hud.toast(def.label.toUpperCase(), 'Reported nearby — check your map', '');
    this.game.audio.play('dispatch', p);
    this.game.audio.siren(pos);
    this.game.npcs.alarm(pos, 45, 0.75);
    if (def.vehicle) this.game.traffic.panic(pos, 70);
    if (def.id === 'emergency' || def.id === 'accident') {
      this.game.fx.explosion(pos, 0.7);
      this.smokeAt = pos.clone();
    }
  }

  /* ------------------------------------------------------------ update */
  update(dt) {
    const p = this.game.player;

    if (!this.current) {
      // No ambient events while the story is mid-beat.
      const busy = this.game.missions.stage !== 'idle' && this.game.missions.stage !== 'done';
      this.cooldown -= busy ? dt * 0.25 : dt;
      if (this.cooldown <= 0) { this.trigger(); this.cooldown = 55 + this.rng() * 70; }
      this.beacon.visible = false;
      return;
    }

    const c = this.current;
    c.time += dt;
    const dist = p.position.distanceTo(c.position);
    const alive = c.encounter.members.filter((m) => m.alive).length;

    if (!c.engaged && dist < 45) {
      c.engaged = true;
      this.game.audio.setMusic('combat');
      this.game.hud.toast(c.label.toUpperCase(), 'Handle it', 'good');
    }

    if (c.engaged) {
      this.game.missions.setObjective('CRIME IN PROGRESS', c.label,
        `Hostiles remaining: <b>${alive}</b>`, 1 - alive / Math.max(1, c.encounter.members.length));
    }

    // beacon pulse
    const pulse = 0.10 + Math.sin(this.game.clock.elapsed * 3.2) * 0.05;
    this.beacon.material.opacity = pulse * clamp01(dist / 40);
    this.beacon.visible = dist > 12;

    if (this.smokeAt && this.rng() < dt * 12) this.game.fx.steam(this.smokeAt);

    if (alive === 0) { this.resolve(true); return; }
    if (c.time > c.limit && dist > 160) { this.resolve(false); }
  }

  resolve(success) {
    const c = this.current;
    if (!c) return;
    if (success) {
      this.game.player.addXp(c.def.reward);
      this.game.player.heal(8);
      this.game.missions.stats.crimesStopped++;
      this.game.hud.toast('CRIME STOPPED', c.label + ' · +' + c.def.reward + ' XP', 'gold');
      this.game.npcs.attention(c.position, 40);
      this.game.audio.play('success', c.position);
    } else {
      this.game.hud.toast('INCIDENT LOST', c.label + ' — they got away', '');
      for (const e of c.encounter.members) if (e.alive) this.game.enemies.release(e);
    }
    this.beacon.visible = false;
    this.smokeAt = null;
    this.current = null;
    this.game.audio.setMusic(this.game.missions.stage === 'idle' || this.game.missions.stage === 'done'
      ? 'explore' : 'mission');
    this.game.missions.restoreObjective();
    this.cooldown = 55 + this.rng() * 70;
  }
}
