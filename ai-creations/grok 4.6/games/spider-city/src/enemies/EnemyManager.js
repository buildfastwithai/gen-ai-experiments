/* enemies/EnemyManager.js
   Pools, spawns, ticks and cleans up combatants, plus enemy projectiles.
   Enemies far from the player tick at a reduced rate rather than not at all,
   so a fight you swung away from is still roughly where you left it. */

import * as THREE from 'three';
import { Enemy, ARCHETYPES } from './Enemy.js';
import { ObjectPool } from '../core/ObjectPool.js';
import { glowMaterial } from '../world/CityMaterials.js';

const MAX_PROJECTILES = 64;

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.group.name = 'Enemies';
    this.scene.add(this.group);

    this.active = [];
    this.pool = new Map();       // type -> [Enemy]
    this.encounters = [];

    /* projectiles */
    const geo = new THREE.SphereGeometry(0.16, 8, 6);
    const mat = glowMaterial(0x9dffd8, 1);
    this.projMesh = new THREE.InstancedMesh(geo, mat, MAX_PROJECTILES);
    this.projMesh.frustumCulled = false;
    this.projMesh.count = 0;
    this.scene.add(this.projMesh);
    this.projectiles = [];
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, dmg: 0, owner: null });
    }
  }

  /* ------------------------------------------------------------ spawn */
  obtain(type) {
    let list = this.pool.get(type);
    if (!list) { list = []; this.pool.set(type, list); }
    let e = list.pop();
    if (!e) {
      e = new Enemy(this.game, type);
      this.group.add(e.object);
    } else {
      e.reset(type);
      e.object.visible = true;
    }
    this.active.push(e);
    return e;
  }

  release(e) {
    const i = this.active.indexOf(e);
    if (i >= 0) this.active.splice(i, 1);
    e.object.visible = false;
    let list = this.pool.get(e.type);
    if (!list) { list = []; this.pool.set(e.type, list); }
    list.push(e);
  }

  spawn(type, x, y, z) {
    const e = this.obtain(type);
    e.spawn(x, y, z);
    return e;
  }

  /**
   * Drop a squad around a point. Composition scales with `threat`.
   * @returns {object} encounter handle the mission system can watch
   */
  spawnEncounter(center, threat = 1, opts = {}) {
    const roster = [];
    const n = Math.round(3 + threat * 1.8);
    for (let i = 0; i < n; i++) {
      let type = 'grunt';
      const r = Math.random();
      if (threat >= 2 && r < 0.16) type = 'heavy';
      else if (r < 0.3) type = 'fast';
      else if (r < 0.48) type = 'ranged';
      else if (threat >= 2 && r < 0.6) type = 'shield';
      roster.push(type);
    }
    if (opts.miniboss) roster.push('miniboss');
    if (opts.roster) roster.length = 0, roster.push(...opts.roster);

    const list = [];
    roster.forEach((type, i) => {
      const a = (i / roster.length) * Math.PI * 2 + Math.random();
      const r = 4 + Math.random() * 9;
      const spot = this.game.world.findStreetSpot(
        center.x + Math.cos(a) * r, center.z + Math.sin(a) * r, 8);
      const y = opts.onRoof ? center.y : spot.y;
      list.push(this.spawn(type, opts.onRoof ? center.x + Math.cos(a) * r : spot.x, y,
                                 opts.onRoof ? center.z + Math.sin(a) * r : spot.z));
    });
    const enc = { center: center.clone(), members: list, threat, done: false, label: opts.label || 'Hostiles' };
    this.encounters.push(enc);
    return enc;
  }

  clearAll() {
    for (const e of [...this.active]) this.release(e);
    this.encounters.length = 0;
  }

  get aliveCount() { return this.active.reduce((n, e) => n + (e.alive ? 1 : 0), 0); }

  aliveNear(pos, radius) {
    let n = 0;
    for (const e of this.active) if (e.alive && e.position.distanceTo(pos) < radius) n++;
    return n;
  }

  /** Best lock-on candidate: near, alive, and roughly in front of the camera. */
  pickTarget(player, camDir, maxDist = 26) {
    let best = null, bestScore = -Infinity;
    for (const e of this.active) {
      if (!e.alive) continue;
      _v.copy(e.position).sub(player.position);
      const d = _v.length();
      if (d > maxDist) continue;
      _v.divideScalar(d);
      const facing = _v.dot(camDir);
      if (facing < 0.15) continue;
      const score = facing * 24 - d;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /* ------------------------------------------------------- projectiles */
  spawnProjectile(pos, dir, dmg, owner) {
    for (const p of this.projectiles) {
      if (p.live) continue;
      p.live = true;
      p.pos.copy(pos);
      p.vel.copy(dir).multiplyScalar(46);
      p.life = 2.6; p.dmg = dmg; p.owner = owner;
      return p;
    }
    return null;
  }

  updateProjectiles(dt, player) {
    let n = 0;
    for (const p of this.projectiles) {
      if (!p.live) continue;
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.y -= 3.2 * dt;
      if (p.life <= 0 || !this.game.world.inBounds(p.pos.x, p.pos.z)) { p.live = false; continue; }
      // player hit
      _v.copy(player.position).addScaledVector(_up, 1.0).sub(p.pos);
      if (_v.lengthSq() < 0.9) {
        player.damage(p.dmg, p.owner);
        this.game.fx.impact(p.pos, p.vel.clone().normalize(), 1, [0.6, 1, 0.85]);
        p.live = false; continue;
      }
      // world hit
      if (this.game.world.grid.nearestSurface(p.pos.x, p.pos.y, p.pos.z, 0.35, this.game.world.hit2)) {
        this.game.fx.sparks(p.pos, 8);
        p.live = false; continue;
      }
      _m.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      this.projMesh.setMatrixAt(n++, _m);
    }
    this.projMesh.count = n;
    if (n) this.projMesh.instanceMatrix.needsUpdate = true;
  }

  /* ----------------------------------------------------------- update */
  update(dt, player) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      const d = e.position.distanceTo(player.position);
      if (!e.alive && e.deadTime > 8) { this.release(e); continue; }
      if (d > 220) {                          // far: coarse tick
        e._acc = (e._acc || 0) + dt;
        if (e._acc < 0.25) continue;
        e.update(e._acc, player); e._acc = 0;
        continue;
      }
      e.update(dt, player);
    }
    this.updateProjectiles(dt, player);

    for (const enc of this.encounters) {
      if (enc.done) continue;
      if (enc.members.every((m) => !m.alive)) { enc.done = true; this.game.onEncounterCleared?.(enc); }
    }
  }
}

const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
