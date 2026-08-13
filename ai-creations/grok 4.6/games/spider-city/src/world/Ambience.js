/* world/Ambience.js
   The cheap details that do a disproportionate amount of work:
   birds wheeling between towers, steam venting from the street, litter tumbling
   along the pavement, flags snapping on rooftops, and a police helicopter that
   circles whatever the loudest thing in the city currently is.

   All of it is instanced or pooled and none of it collides with anything. */

import * as THREE from 'three';
import { mergeGeos } from './CityBuilder.js';
import { paintedMetal, glowMaterial } from './CityMaterials.js';
import { makeRng, clamp01, lerp } from '../core/MathUtils.js';

export class Ambience {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(6060);
    this.t = 0;

    /* ---------------- birds ---------------- */
    const N_BIRDS = 90;
    const birdGeo = (() => {
      const w1 = new THREE.PlaneGeometry(0.9, 0.16); w1.translate(0.45, 0, 0);
      const w2 = new THREE.PlaneGeometry(0.9, 0.16); w2.translate(-0.45, 0, 0);
      const body = new THREE.BoxGeometry(0.12, 0.1, 0.42);
      return mergeGeos([w1, w2, body]);
    })();
    this.birds = new THREE.InstancedMesh(birdGeo,
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, side: THREE.DoubleSide }), N_BIRDS);
    this.birds.frustumCulled = false;
    this.birds.count = 0;
    game.scene.add(this.birds);
    this.birdData = [];
    for (let i = 0; i < N_BIRDS; i++) {
      this.birdData.push({
        flock: (i / 15) | 0, phase: this.rng() * 100,
        r: 8 + this.rng() * 22, speed: 0.35 + this.rng() * 0.5,
        yOff: this.rng() * 8, wing: this.rng() * 6.28,
      });
    }
    this.flocks = [];
    for (let f = 0; f < 6; f++) {
      this.flocks.push({ x: 0, y: 0, z: 0, target: new THREE.Vector3(), t: 0 });
    }

    /* ---------------- steam vents ---------------- */
    this.vents = [];
    const L = game.world.layout;
    for (const b of L.blocks) {
      if (b.district === 'water' || b.district === 'park') continue;
      if (this.rng() < 0.35) {
        this.vents.push(new THREE.Vector3(
          b.cx + (this.rng() - 0.5) * 60, 0.25, b.cz + (this.rng() - 0.5) * 60));
      }
    }
    this.ventTimer = 0;

    /* ---------------- litter ---------------- */
    const N_LITTER = 60;
    const litGeo = new THREE.PlaneGeometry(0.3, 0.22);
    this.litter = new THREE.InstancedMesh(litGeo,
      new THREE.MeshStandardMaterial({ color: 0xcfc9ba, roughness: 0.95, side: THREE.DoubleSide }), N_LITTER);
    this.litter.frustumCulled = false; this.litter.count = 0;
    game.scene.add(this.litter);
    this.litterData = [];
    for (let i = 0; i < N_LITTER; i++) {
      this.litterData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: this.rng() * 6.28, life: 0 });
    }

    /* ---------------- rooftop flags ---------------- */
    const flags = [];
    for (const b of game.world.layout.buildings) {
      if (b.height < 70 || this.rng() > 0.12) continue;
      flags.push({ x: b.x, y: b.height, z: b.z });
      if (flags.length > 40) break;
    }
    if (flags.length) {
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 7, 5); poleGeo.translate(0, 3.5, 0);
      this.flagPoles = new THREE.InstancedMesh(poleGeo, paintedMetal(0xa8adb5, 0.4, 0.85), flags.length);
      const clothGeo = new THREE.PlaneGeometry(2.2, 1.35, 8, 1); clothGeo.translate(1.1, 6.1, 0);
      this.flagCloth = new THREE.InstancedMesh(clothGeo,
        new THREE.MeshStandardMaterial({ color: 0xb03a3a, roughness: 0.85, side: THREE.DoubleSide }), flags.length);
      flags.forEach((f, n) => {
        _p.set(f.x + 3, f.y, f.z + 3); _q.identity(); _s.setScalar(1);
        this.flagPoles.setMatrixAt(n, _m.compose(_p, _q, _s));
        this.flagCloth.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      this.flagPoles.instanceMatrix.needsUpdate = true;
      this.flagCloth.instanceMatrix.needsUpdate = true;
      this.flagPoles.castShadow = true;
      this.flagData = flags;
      this.flagBase = clothGeo.attributes.position.array.slice();
      game.scene.add(this.flagPoles, this.flagCloth);
    }

    /* ---------------- police helicopter ---------------- */
    const heliGeo = (() => {
      const body = new THREE.CapsuleGeometry(0.9, 2.4, 4, 10); body.rotateZ(Math.PI / 2);
      const tail = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 6); tail.rotateZ(Math.PI / 2); tail.translate(-2.8, 0.2, 0);
      const fin = new THREE.BoxGeometry(0.2, 1.1, 0.7); fin.translate(-4.3, 0.6, 0);
      const skid = new THREE.BoxGeometry(3.2, 0.1, 0.1);
      const s1 = skid.clone(); s1.translate(0, -1.2, 0.8);
      const s2 = skid.clone(); s2.translate(0, -1.2, -0.8);
      skid.dispose();
      return mergeGeos([body, tail, fin, s1, s2]);
    })();
    this.heli = new THREE.Mesh(heliGeo, paintedMetal(0x1c2430, 0.45, 0.6));
    this.heli.castShadow = true;
    const rotorGeo = new THREE.BoxGeometry(9.5, 0.06, 0.34);
    this.rotor = new THREE.Mesh(rotorGeo, new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.6 }));
    this.rotor.position.y = 1.15;
    this.heli.add(this.rotor);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(5.5, 60, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff3d6, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
    beam.position.y = -30; beam.rotation.x = Math.PI;
    this.heliBeam = beam;
    this.heli.add(beam);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glowMaterial(0xff3344));
    lamp.position.set(0, -1.1, 0);
    this.heli.add(lamp);
    this.heliLamp = lamp;
    this.heli.visible = false;
    game.scene.add(this.heli);
    this.heliAngle = 0;
    this.heliCenter = new THREE.Vector3();
    this.heliTimer = 30;
  }

  /* ------------------------------------------------------------ update */
  update(dt, player, camera) {
    this.t += dt;
    const night = this.game.dayNight.nightFactor;
    const rain = this.game.weather.rainAmount;

    /* ---- birds: boids-lite, one steering target per flock ---- */
    const birdsActive = rain < 0.3 && night < 0.6;
    if (birdsActive) {
      let n = 0;
      this.flocks.forEach((f, i) => {
        f.t -= dt;
        if (f.t <= 0) {
          f.t = 14 + Math.random() * 20;
          const roof = this.game.world.randomRoof(35);
          if (roof) f.target.set(roof.x, roof.y + 25 + Math.random() * 45, roof.z);
          else f.target.set(player.position.x, 90, player.position.z);
        }
        f.x = lerp(f.x || player.position.x, f.target.x, 1 - Math.exp(-0.35 * dt));
        f.y = lerp(f.y || 80, f.target.y, 1 - Math.exp(-0.35 * dt));
        f.z = lerp(f.z || player.position.z, f.target.z, 1 - Math.exp(-0.35 * dt));
      });
      for (const b of this.birdData) {
        const f = this.flocks[b.flock];
        const a = this.t * b.speed + b.phase;
        const x = f.x + Math.cos(a) * b.r;
        const z = f.z + Math.sin(a * 1.13) * b.r;
        const y = f.y + b.yOff + Math.sin(a * 0.7) * 3;
        if (Math.abs(x - player.position.x) > 420 || Math.abs(z - player.position.z) > 420) continue;
        _p.set(x, y, z);
        const flap = Math.sin(this.t * 12 + b.wing);
        _e.set(flap * 0.5, -a - Math.PI / 2, 0);
        _q.setFromEuler(_e);
        _s.set(1, 1, 1);
        this.birds.setMatrixAt(n++, _m.compose(_p, _q, _s));
        if (n >= this.birdData.length) break;
      }
      this.birds.count = n;
      this.birds.instanceMatrix.needsUpdate = true;
      this.birds.visible = n > 0;
    } else this.birds.visible = false;

    /* ---- steam vents near the player ---- */
    this.ventTimer -= dt;
    if (this.ventTimer <= 0) {
      this.ventTimer = 0.12;
      for (const v of this.vents) {
        if (v.distanceToSquared(player.position) > 90 * 90) continue;
        if (Math.random() < 0.35) this.game.fx.steam(v);
      }
    }

    /* ---- litter tumbling on the street ---- */
    let ln = 0;
    for (const l of this.litterData) {
      l.life -= dt;
      if (l.life <= 0) {
        if (Math.random() < 0.25 && player.position.y < 60) {
          const s = this.game.world.findStreetSpot(player.position.x, player.position.z, 55);
          l.p.set(s.x, 0.4, s.z);
          l.v.set((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
          l.life = 6 + Math.random() * 6;
        } else continue;
      }
      const wind = this.game.weather.windDir;
      l.v.x += (wind.x * 2.2 - l.v.x) * dt;
      l.v.z += (wind.y * 2.2 - l.v.z) * dt;
      l.p.addScaledVector(l.v, dt);
      l.p.y = 0.35 + Math.abs(Math.sin(this.t * 4 + l.spin)) * 0.5;
      l.spin += dt * 5;
      _p.copy(l.p);
      _e.set(l.spin, l.spin * 0.7, l.spin * 1.3);
      _q.setFromEuler(_e); _s.setScalar(1);
      this.litter.setMatrixAt(ln++, _m.compose(_p, _q, _s));
    }
    this.litter.count = ln;
    this.litter.instanceMatrix.needsUpdate = true;

    /* ---- flags ripple ---- */
    if (this.flagCloth) {
      const pos = this.flagCloth.geometry.attributes.position;
      const base = this.flagBase;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const k = clamp01((bx - 0.1) / 2.2);
        pos.array[i * 3 + 2] = Math.sin(this.t * 6 - bx * 3.2 + by) * 0.34 * k;
        pos.array[i * 3 + 1] = by + Math.sin(this.t * 4.6 - bx * 2.1) * 0.09 * k;
      }
      pos.needsUpdate = true;
    }

    /* ---- helicopter ---- */
    this.heliTimer -= dt;
    const evt = this.game.events.current;
    const wantHeli = !!evt || this.game.missions.stage === 'combat' || this.game.missions.stage === 'boss';
    if (wantHeli && !this.heli.visible) {
      this.heli.visible = true;
      this.heliCenter.copy(evt ? evt.position : player.position);
      this.heliAngle = Math.random() * 6.28;
    } else if (!wantHeli && this.heli.visible && this.heliTimer <= 0) {
      this.heli.visible = false;
      this.heliTimer = 25;
    }
    if (this.heli.visible) {
      const c = evt ? evt.position : player.position;
      this.heliCenter.lerp(c, 1 - Math.exp(-0.4 * dt));
      this.heliAngle += dt * 0.28;
      const r = 78, h = 92;
      this.heli.position.set(
        this.heliCenter.x + Math.cos(this.heliAngle) * r,
        this.heliCenter.y + h,
        this.heliCenter.z + Math.sin(this.heliAngle) * r);
      this.heli.rotation.y = -this.heliAngle + Math.PI / 2;
      this.heli.rotation.z = 0.18;
      this.rotor.rotation.y += dt * 42;
      this.heliBeam.visible = night > 0.25;
      this.heliBeam.material.opacity = 0.05 + night * 0.09;
      this.heliLamp.visible = (Math.sin(this.t * 4) > 0);
    }
  }
}

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
