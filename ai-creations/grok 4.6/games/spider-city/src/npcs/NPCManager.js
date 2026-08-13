/* npcs/NPCManager.js
   Hundreds of civilians for three draw calls.

   Each pedestrian is three instances — torso (with head and arms merged in) and
   two legs — whose matrices are written from a walk phase driven by real ground
   speed. That's enough articulation to read as walking from a rooftop and cheap
   enough to run a crowd on a laptop.

   Behaviour is a tiny utility AI: wander the sidewalk ring of a block, cross at
   corners, idle outside shops, look at the player when they land nearby, and
   scatter from danger. NPCs outside the simulation radius are recycled rather
   than ticked. */

import * as THREE from 'three';
import { mergeGeos } from '../world/CityBuilder.js';
import { DISTRICT } from '../world/CityLayout.js';
import { WORLD } from '../core/Settings.js';
import { makeRng, clamp, clamp01, damp, lerp } from '../core/MathUtils.js';

const STATE = { WALK: 0, IDLE: 1, CROSS: 2, GAWK: 3, FLEE: 4, PHONE: 5, CHAT: 6 };

const SHIRT = [0x2c3d5c, 0x6b3f3a, 0x2f4a3c, 0x54506b, 0x7a6a4d, 0x3a3f46, 0x8a4a52, 0x25506b, 0x6d6d70];
const PANTS = [0x22242a, 0x2e3138, 0x3b3227, 0x1d2733, 0x40424a];
const SKIN = [0xc9a184, 0x8d6a52, 0x6b4b38, 0xe0bb9a, 0x4f382a, 0xa87b5c];

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.rng = makeRng(90210);
    this.budget = game.settings.preset.npcBudget;
    this.simRadius = 180;
    this.list = [];

    const torsoGeo = (() => {
      const body = new THREE.CylinderGeometry(0.19, 0.15, 0.62, 8, 1);
      body.scale(1.0, 1, 0.62); body.translate(0, 1.14, 0);
      const head = new THREE.SphereGeometry(0.115, 8, 6); head.translate(0, 1.58, 0);
      const neck = new THREE.CylinderGeometry(0.05, 0.06, 0.08, 6); neck.translate(0, 1.47, 0);
      const armL = new THREE.CylinderGeometry(0.055, 0.045, 0.56, 6); armL.translate(0.22, 1.12, 0);
      const armR = new THREE.CylinderGeometry(0.055, 0.045, 0.56, 6); armR.translate(-0.22, 1.12, 0);
      return mergeGeos([body, neck, head, armL, armR]);
    })();
    const legGeo = (() => {
      const g = new THREE.CylinderGeometry(0.075, 0.06, 0.8, 6);
      g.translate(0, -0.4, 0);
      const shoe = new THREE.BoxGeometry(0.11, 0.07, 0.22); shoe.translate(0, -0.82, 0.04);
      return mergeGeos([g, shoe]);
    })();

    const mkMat = () => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, envMapIntensity: 0.7 });
    this.torso = new THREE.InstancedMesh(torsoGeo, mkMat(), this.budget);
    this.legL = new THREE.InstancedMesh(legGeo, mkMat(), this.budget);
    this.legR = new THREE.InstancedMesh(legGeo.clone(), mkMat(), this.budget);
    for (const m of [this.torso, this.legL, this.legR]) {
      m.castShadow = true; m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.budget * 3), 3);
      m.count = 0;
      game.scene.add(m);
    }

    for (let i = 0; i < this.budget; i++) this.list.push(this.makeNpc(i));
  }

  makeNpc(i) {
    const r = this.rng;
    return {
      i, active: false,
      pos: new THREE.Vector3(), target: new THREE.Vector3(),
      vel: new THREE.Vector3(), facing: r() * Math.PI * 2,
      speed: 1.1 + r() * 0.85, phase: r() * Math.PI * 2,
      state: STATE.WALK, timer: 0, scale: 0.92 + r() * 0.18,
      shirt: new THREE.Color(SHIRT[(r() * SHIRT.length) | 0]),
      pants: new THREE.Color(PANTS[(r() * PANTS.length) | 0]),
      skin: new THREE.Color(SKIN[(r() * SKIN.length) | 0]),
      fear: 0, partner: -1,
    };
  }

  /* ---------------------------------------------------------- spawning */
  spawnAround(center) {
    for (const n of this.list) if (!n.active) this.place(n, center);
  }

  place(n, center) {
    const L = this.world.layout;
    const r = this.rng;
    // pick a sidewalk ring on a nearby non-water block
    for (let tries = 0; tries < 8; tries++) {
      const a = r() * Math.PI * 2, rad = 30 + r() * (this.simRadius - 40);
      const x = center.x + Math.cos(a) * rad, z = center.z + Math.sin(a) * rad;
      const i = Math.round(x / L.cell + L.half), j = Math.round(z / L.cell + L.half);
      if (i < 0 || j < 0 || i >= L.size || j >= L.size) continue;
      const d = L.districtAt(i, j);
      if (d === DISTRICT.WATER) continue;
      const b = L.blockCenter(i, j);
      const ring = L.blockSize * 0.5 + WORLD.sidewalkWidth * 0.5;
      const side = (r() * 4) | 0;
      const t = (r() - 0.5) * L.blockSize;
      let px, pz;
      if (side === 0) { px = b.x + t; pz = b.z + ring; }
      else if (side === 1) { px = b.x + t; pz = b.z - ring; }
      else if (side === 2) { px = b.x + ring; pz = b.z + t; }
      else { px = b.x - ring; pz = b.z + t; }
      n.pos.set(px, 0.24, pz);
      n.block = { i, j, cx: b.x, cz: b.z, ring };
      n.active = true;
      n.state = r() < 0.14 ? STATE.IDLE : r() < 0.24 ? STATE.PHONE : STATE.WALK;
      n.timer = 1 + r() * 6;
      this.pickTarget(n);
      return true;
    }
    return false;
  }

  pickTarget(n) {
    const r = this.rng, b = n.block;
    if (!b) { n.target.copy(n.pos); return; }
    const ring = b.ring;
    const side = (r() * 4) | 0;
    const t = (r() - 0.5) * (ring * 1.8);
    if (side === 0) n.target.set(b.cx + t, 0.24, b.cz + ring);
    else if (side === 1) n.target.set(b.cx + t, 0.24, b.cz - ring);
    else if (side === 2) n.target.set(b.cx + ring, 0.24, b.cz + t);
    else n.target.set(b.cx - ring, 0.24, b.cz + t);
  }

  /** Scare everyone within radius — explosions, landings, combat. */
  alarm(pos, radius, intensity = 1) {
    for (const n of this.list) {
      if (!n.active) continue;
      const d = n.pos.distanceTo(pos);
      if (d > radius) continue;
      n.fear = Math.max(n.fear, intensity * (1 - d / radius));
      n.state = n.fear > 0.45 ? STATE.FLEE : STATE.GAWK;
      n.timer = 2 + this.rng() * 3;
      n.fleeFrom = n.fleeFrom || new THREE.Vector3();
      n.fleeFrom.copy(pos);
    }
  }

  /** Everyone nearby turns to look. Used when the player lands on the street. */
  attention(pos, radius) {
    for (const n of this.list) {
      if (!n.active || n.state === STATE.FLEE) continue;
      if (n.pos.distanceTo(pos) > radius) continue;
      n.state = STATE.GAWK;
      n.lookAt = n.lookAt || new THREE.Vector3();
      n.lookAt.copy(pos);
      n.timer = 1.6 + this.rng() * 2.5;
    }
  }

  /* ------------------------------------------------------------ update */
  update(dt, player) {
    const center = player.position;
    let count = 0;
    const daylight = 1 - this.game.dayNight.nightFactor;

    for (const n of this.list) {
      if (!n.active) { this.place(n, center); continue; }
      const dx = n.pos.x - center.x, dz = n.pos.z - center.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > this.simRadius * this.simRadius * 1.6) { n.active = false; continue; }

      n.timer -= dt;
      n.fear = Math.max(0, n.fear - dt * 0.35);

      switch (n.state) {
        case STATE.WALK: {
          _d.copy(n.target).sub(n.pos); _d.y = 0;
          const d = _d.length();
          if (d < 1.2 || n.timer <= 0) {
            this.pickTarget(n);
            n.timer = 4 + this.rng() * 8;
            if (this.rng() < 0.18) { n.state = STATE.IDLE; n.timer = 2 + this.rng() * 5; }
            else if (this.rng() < 0.1) { n.state = STATE.PHONE; n.timer = 3 + this.rng() * 6; }
          } else {
            _d.divideScalar(d);
            n.vel.x = damp(n.vel.x, _d.x * n.speed, 6, dt);
            n.vel.z = damp(n.vel.z, _d.z * n.speed, 6, dt);
          }
          break;
        }
        case STATE.IDLE:
        case STATE.PHONE:
        case STATE.CHAT:
          n.vel.x = damp(n.vel.x, 0, 8, dt);
          n.vel.z = damp(n.vel.z, 0, 8, dt);
          if (n.timer <= 0) { n.state = STATE.WALK; this.pickTarget(n); n.timer = 5 + this.rng() * 8; }
          break;
        case STATE.GAWK:
          n.vel.x = damp(n.vel.x, 0, 9, dt);
          n.vel.z = damp(n.vel.z, 0, 9, dt);
          if (n.lookAt) {
            const a = Math.atan2(n.lookAt.x - n.pos.x, n.lookAt.z - n.pos.z);
            n.facing = angleDamp(n.facing, a, 7, dt);
          }
          if (n.timer <= 0) { n.state = STATE.WALK; this.pickTarget(n); }
          break;
        case STATE.FLEE: {
          _d.copy(n.pos).sub(n.fleeFrom || center); _d.y = 0;
          if (_d.lengthSq() < 1e-4) _d.set(1, 0, 0);
          _d.normalize();
          n.vel.x = damp(n.vel.x, _d.x * n.speed * 3.1, 9, dt);
          n.vel.z = damp(n.vel.z, _d.z * n.speed * 3.1, 9, dt);
          if (n.timer <= 0 && n.fear < 0.2) { n.state = STATE.WALK; this.pickTarget(n); }
          break;
        }
      }

      n.pos.x += n.vel.x * dt;
      n.pos.z += n.vel.z * dt;
      const ground = this.world.grid.groundHeight(n.pos.x, n.pos.z, 1.2);
      n.pos.y = damp(n.pos.y, Math.min(ground, 0.6), 12, dt);

      const spd = Math.hypot(n.vel.x, n.vel.z);
      if (spd > 0.1) {
        n.phase += spd * 3.4 * dt;
        const want = Math.atan2(n.vel.x, n.vel.z);
        n.facing = angleDamp(n.facing, want, 8, dt);
      }

      /* write instances */
      if (count >= this.budget) continue;
      const bob = Math.abs(Math.sin(n.phase)) * 0.045 * clamp01(spd);
      const lean = n.state === STATE.FLEE ? 0.22 : n.state === STATE.PHONE ? 0.13 : 0.03;
      _q.setFromEuler(_e.set(lean, n.facing, 0));
      _p.set(n.pos.x, n.pos.y + bob + 0.02, n.pos.z);
      _s.setScalar(n.scale);
      this.torso.setMatrixAt(count, _m.compose(_p, _q, _s));
      this.torso.setColorAt(count, n.shirt);

      const swing = Math.sin(n.phase) * clamp01(spd * 0.85) * 0.55;
      for (const [mesh, sgn] of [[this.legL, 1], [this.legR, -1]]) {
        _q.setFromEuler(_e.set(swing * sgn, n.facing, 0));
        _p.set(
          n.pos.x + Math.cos(n.facing) * 0.085 * sgn,
          n.pos.y + 0.86 * n.scale + bob,
          n.pos.z - Math.sin(n.facing) * 0.085 * sgn);
        mesh.setMatrixAt(count, _m.compose(_p, _q, _s));
        mesh.setColorAt(count, n.pants);
      }
      count++;
    }

    for (const m of [this.torso, this.legL, this.legR]) {
      m.count = count;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.visibleCount = count;
  }
}

function angleDamp(a, b, speed, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-speed * dt));
}

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
