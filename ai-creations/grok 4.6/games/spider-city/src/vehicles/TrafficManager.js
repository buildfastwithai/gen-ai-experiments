/* vehicles/TrafficManager.js
   Lane-following city traffic.

   Roads are axis-aligned, so the whole network reduces to a list of 1-D lanes:
   a car is (lane, distance-along-lane, speed). That makes car-following, queueing
   at red lights and intersection blocking trivial and lets a few hundred vehicles
   run for almost nothing. Bodies, wheels, headlight cards and tail lights are
   four instanced meshes total. */

import * as THREE from 'three';
import { mergeGeos } from '../world/CityBuilder.js';
import { glowMaterial } from '../world/CityMaterials.js';
import { makeLightPool } from '../world/TextureFactory.js';
import { makeRng, clamp, clamp01, damp, lerp } from '../core/MathUtils.js';

const CAR_COLORS = [
  0x1b1d21, 0xb8bcc2, 0x8d1f2a, 0x1f3f6b, 0x2e4a34, 0xd8d3c6,
  0x5a5f66, 0x7a2f1c, 0x25282c, 0xc9a227, 0x3d3a52, 0xe8e6e1,
];
const TAXI = 0xf0b429;

export class TrafficManager {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.L = game.world.layout;
    this.rng = makeRng(777);
    this.budget = game.settings.preset.trafficBudget;
    this.simRadius = 300;

    this.lanes = this.buildLanes();
    this.cars = [];

    /* ---- geometry ---- */
    const sedan = () => {
      const lower = new THREE.BoxGeometry(1.86, 0.62, 4.35); lower.translate(0, 0.62, 0);
      const cabin = new THREE.BoxGeometry(1.68, 0.56, 2.20); cabin.translate(0, 1.18, -0.16);
      const hood = new THREE.BoxGeometry(1.78, 0.22, 1.25); hood.translate(0, 0.98, 1.55);
      const boot = new THREE.BoxGeometry(1.78, 0.2, 1.0); boot.translate(0, 0.98, -1.68);
      return mergeGeos([lower, cabin, hood, boot]);
    };
    const van = () => {
      const box = new THREE.BoxGeometry(2.1, 1.72, 5.4); box.translate(0, 1.0, -0.4);
      const nose = new THREE.BoxGeometry(2.05, 1.0, 1.5); nose.translate(0, 0.68, 2.6);
      return mergeGeos([box, nose]);
    };
    const bodyGeo = sedan();
    this.vanGeo = van();

    const bodyMat = new THREE.MeshStandardMaterial({
      roughness: 0.28, metalness: 0.72, envMapIntensity: 1.35,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0d1218, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6,
    });

    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, this.budget);
    this.vans = new THREE.InstancedMesh(this.vanGeo, bodyMat.clone(), Math.ceil(this.budget * 0.3));
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    this.wheels = new THREE.InstancedMesh(wheelGeo,
      new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 }), this.budget * 4);

    const lightGeo = new THREE.PlaneGeometry(0.42, 0.24);
    this.headlights = new THREE.InstancedMesh(lightGeo, glowMaterial(0xfff0d0, 1), this.budget * 2);
    this.taillights = new THREE.InstancedMesh(lightGeo.clone(), glowMaterial(0xff2d24, 0.9), this.budget * 2);

    const poolGeo = new THREE.PlaneGeometry(6, 11); poolGeo.rotateX(-Math.PI / 2);
    this.lightPools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({
      map: makeLightPool(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, opacity: 0.5,
    }), this.budget);

    for (const m of [this.bodies, this.vans, this.wheels, this.headlights, this.taillights, this.lightPools]) {
      m.frustumCulled = false; m.count = 0;
      game.scene.add(m);
    }
    this.bodies.castShadow = true; this.bodies.receiveShadow = true;
    this.vans.castShadow = true; this.vans.receiveShadow = true;
    this.bodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.budget * 3), 3);
    this.vans.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.ceil(this.budget * 0.3) * 3), 3);

    for (let i = 0; i < this.budget; i++) this.cars.push(this.makeCar(i));
    this.parked = [];
    this.buildParkedCars();
  }

  /* ------------------------------------------------------------- lanes */
  buildLanes() {
    const L = this.L, lanes = [];
    const off = 5.6;
    const half = L.extent + L.cell * 0.5;
    for (const x of L.roadsZ) {
      lanes.push({ axis: 'z', fixed: x - off, dir: 1, min: -half, max: half });
      lanes.push({ axis: 'z', fixed: x + off, dir: -1, min: -half, max: half });
    }
    for (const z of L.roadsX) {
      lanes.push({ axis: 'x', fixed: z + off, dir: 1, min: -half, max: half });
      lanes.push({ axis: 'x', fixed: z - off, dir: -1, min: -half, max: half });
    }
    return lanes;
  }

  makeCar(i) {
    const r = this.rng;
    const taxi = r() < 0.14;
    return {
      i, active: false, lane: 0, s: 0, speed: 0, target: 12,
      color: new THREE.Color(taxi ? TAXI : CAR_COLORS[(r() * CAR_COLORS.length) | 0]),
      isVan: r() < 0.16, wheelSpin: 0, brake: 0, honkTimer: 0,
      pos: new THREE.Vector3(),
    };
  }

  laneToWorld(lane, s, out) {
    if (lane.axis === 'z') out.set(lane.fixed, 0.05, s);
    else out.set(s, 0.05, lane.fixed);
    return out;
  }

  spawnCar(car, center) {
    const r = this.rng;
    for (let t = 0; t < 10; t++) {
      const lane = this.lanes[(r() * this.lanes.length) | 0];
      // place it just outside the visible ring, ahead of or behind the player
      const along = lane.axis === 'z' ? center.z : center.x;
      const s = along + (r() < 0.5 ? -1 : 1) * (this.simRadius * (0.55 + r() * 0.45));
      if (s < lane.min || s > lane.max) continue;
      const perp = lane.axis === 'z' ? Math.abs(lane.fixed - center.x) : Math.abs(lane.fixed - center.z);
      if (perp > this.simRadius) continue;
      car.lane = this.lanes.indexOf(lane);
      car.s = s;
      car.speed = 8 + r() * 6;
      car.target = 11 + r() * 9;
      car.active = true;
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------ parked cars */
  buildParkedCars() {
    const L = this.L, r = this.rng;
    const list = [];
    for (const b of L.blocks) {
      if (b.district === 'water') continue;
      const ring = L.blockSize * 0.5 + 8.0;
      for (let k = -2; k <= 2; k++) {
        if (r() < 0.42) list.push([b.cx + k * 6.4, b.cz + ring, 0]);
        if (r() < 0.42) list.push([b.cx + k * 6.4, b.cz - ring, Math.PI]);
        if (r() < 0.42) list.push([b.cx + ring, b.cz + k * 6.4, Math.PI / 2]);
        if (r() < 0.42) list.push([b.cx - ring, b.cz + k * 6.4, -Math.PI / 2]);
      }
    }
    const geo = this.bodies.geometry;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.6, envMapIntensity: 1.1 });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.castShadow = true; im.receiveShadow = true;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    const col = new THREE.Color();
    list.forEach((e, n) => {
      _p.set(e[0], 0.05, e[1]);
      _q.setFromEuler(_e.set(0, e[2], 0));
      _s.setScalar(1);
      im.setMatrixAt(n, _m.compose(_p, _q, _s));
      col.setHex(CAR_COLORS[(this.rng() * CAR_COLORS.length) | 0]);
      im.setColorAt(n, col);
      this.world.grid.add(e[0] - 1.2, 0, e[1] - 2.4, e[0] + 1.2, 1.5, e[1] + 2.4, 1, null);
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    this.game.scene.add(im);
    this.parkedMesh = im;
  }

  /* ------------------------------------------------------------ signals */
  lightIsGreen(lane, s) {
    // Intersections alternate phase on a 14 s cycle; NS and EW are opposed.
    const L = this.L;
    const cycle = (this.game.clock.elapsed % 14) / 14;
    const nsGreen = cycle < 0.46;
    const ewGreen = cycle > 0.5 && cycle < 0.96;
    return lane.axis === 'z' ? nsGreen : ewGreen;
  }

  nextIntersectionDistance(lane, s) {
    const L = this.L;
    const list = lane.axis === 'z' ? L.roadsX : L.roadsZ;
    let best = Infinity;
    for (const r of list) {
      const d = (r - s) * lane.dir;
      if (d > 0 && d < best) best = d;
    }
    return best;
  }

  /* ------------------------------------------------------------ update */
  update(dt, player) {
    const center = player.position;
    const night = this.game.dayNight.nightFactor;
    let nBody = 0, nVan = 0, nWheel = 0, nHead = 0, nTail = 0, nPool = 0;

    // sort cars per lane for simple car-following
    this._laneOrder = this._laneOrder || new Map();
    const order = this._laneOrder;
    order.clear();

    for (const c of this.cars) {
      if (!c.active) continue;
      let arr = order.get(c.lane);
      if (!arr) { arr = []; order.set(c.lane, arr); }
      arr.push(c);
    }
    for (const arr of order.values()) arr.sort((a, b) => (a.s - b.s) * this.lanes[a.lane].dir);

    for (const c of this.cars) {
      if (!c.active) { this.spawnCar(c, center); continue; }
      const lane = this.lanes[c.lane];

      /* --- desired speed --- */
      let want = c.target;

      // car ahead
      const arr = order.get(c.lane);
      if (arr) {
        const idx = arr.indexOf(c);
        const ahead = arr[idx + 1];
        if (ahead) {
          const gap = (ahead.s - c.s) * lane.dir;
          if (gap < 16) want = Math.min(want, Math.max(0, (gap - 6.2) * 1.9));
        }
      }

      // traffic signal
      const di = this.nextIntersectionDistance(lane, c.s);
      if (di < 30 && !this.lightIsGreen(lane, c.s)) {
        const stopAt = Math.max(0, di - 15);
        want = Math.min(want, stopAt * 0.85);
      }

      c.brake = damp(c.brake, want < c.speed - 1.5 ? 1 : 0, 8, dt);
      const accel = want > c.speed ? 5.5 : 13;
      c.speed = damp(c.speed, Math.max(0, want), accel * 0.35, dt);
      c.s += c.speed * lane.dir * dt;
      c.wheelSpin += c.speed * dt * 2.6;

      if (c.s < lane.min || c.s > lane.max) { c.active = false; continue; }
      this.laneToWorld(lane, c.s, c.pos);
      const dx = c.pos.x - center.x, dz = c.pos.z - center.z;
      if (dx * dx + dz * dz > this.simRadius * this.simRadius * 1.5) { c.active = false; continue; }

      /* --- instances --- */
      const yaw = lane.axis === 'z'
        ? (lane.dir > 0 ? 0 : Math.PI)
        : (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      _q.setFromEuler(_e.set(c.brake * 0.02, yaw, 0));
      _p.copy(c.pos); _s.setScalar(1);
      _m.compose(_p, _q, _s);

      if (c.isVan && nVan < Math.ceil(this.budget * 0.3)) {
        this.vans.setMatrixAt(nVan, _m);
        this.vans.setColorAt(nVan, c.color);
        nVan++;
      } else if (nBody < this.budget) {
        this.bodies.setMatrixAt(nBody, _m);
        this.bodies.setColorAt(nBody, c.color);
        nBody++;
      }

      // wheels
      const fw = _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
      const rt = _rgt.set(fw.z, 0, -fw.x);
      for (let k = 0; k < 4; k++) {
        if (nWheel >= this.budget * 4) break;
        const fz = k < 2 ? 1.32 : -1.36;
        const sx = (k % 2) ? 0.86 : -0.86;
        _p.set(c.pos.x + fw.x * fz + rt.x * sx, 0.38, c.pos.z + fw.z * fz + rt.z * sx);
        _e.set(c.wheelSpin, yaw, 0); _q.setFromEuler(_e);
        this.wheels.setMatrixAt(nWheel++, _m.compose(_p, _q, _s));
      }

      // lights
      if (night > 0.05) {
        for (let k = 0; k < 2; k++) {
          const sx = k ? 0.62 : -0.62;
          _p.set(c.pos.x + fw.x * 2.18 + rt.x * sx, 0.72, c.pos.z + fw.z * 2.18 + rt.z * sx);
          _e.set(0, yaw, 0); _q.setFromEuler(_e);
          if (nHead < this.budget * 2) this.headlights.setMatrixAt(nHead++, _m.compose(_p, _q, _s));
          _p.set(c.pos.x - fw.x * 2.2 + rt.x * sx, 0.78, c.pos.z - fw.z * 2.2 + rt.z * sx);
          _e.set(0, yaw + Math.PI, 0); _q.setFromEuler(_e);
          if (nTail < this.budget * 2) this.taillights.setMatrixAt(nTail++, _m.compose(_p, _q, _s));
        }
        if (nPool < this.budget) {
          _p.set(c.pos.x + fw.x * 5.5, 0.06, c.pos.z + fw.z * 5.5);
          _e.set(0, yaw, 0); _q.setFromEuler(_e);
          this.lightPools.setMatrixAt(nPool++, _m.compose(_p, _q, _s));
        }
      }
    }

    this.bodies.count = nBody; this.bodies.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    this.vans.count = nVan; this.vans.instanceMatrix.needsUpdate = true;
    if (this.vans.instanceColor) this.vans.instanceColor.needsUpdate = true;
    this.wheels.count = nWheel; this.wheels.instanceMatrix.needsUpdate = true;
    this.headlights.count = nHead; this.headlights.instanceMatrix.needsUpdate = true;
    this.taillights.count = nTail; this.taillights.instanceMatrix.needsUpdate = true;
    this.lightPools.count = nPool; this.lightPools.instanceMatrix.needsUpdate = true;
    this.taillights.material.opacity = 0.55 + night * 0.4;
    this.lightPools.material.opacity = night * 0.55 * (1 - this.game.weather.wetness * 0.3 + this.game.weather.wetness * 0.5);
    this.activeCount = nBody + nVan;
  }

  /** Scatter traffic away from a point — used by world events and explosions. */
  panic(pos, radius) {
    for (const c of this.cars) {
      if (!c.active) continue;
      if (c.pos.distanceTo(pos) > radius) continue;
      c.target = 2 + this.rng() * 3;
      c.honkTimer = 1.5;
    }
    this.game.audio.play('horn', pos);
  }
}

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
