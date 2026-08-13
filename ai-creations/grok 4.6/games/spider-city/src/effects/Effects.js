/* effects/Effects.js
   One pooled GPU particle system for the whole game plus a decal pool.

   All particles live in a single THREE.Points buffer with per-particle size,
   colour and alpha, so dust, sparks, debris, steam, splashes and web splats
   cost exactly one draw call. Emission never allocates: dead particles are
   recycled from a free list. */

import * as THREE from 'three';
import { makeSoftDot } from '../world/TextureFactory.js';
import { clamp01, lerp } from '../core/MathUtils.js';

const MAX = 2600;

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha; vColor = aColor;
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * ( 320.0 / max( -mv.z, 0.5 ) );
  }`;

const FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D( uMap, gl_PointCoord );
    if ( t.a * vAlpha < 0.004 ) discard;
    gl_FragColor = vec4( vColor * t.rgb, t.a * vAlpha );
  }`;

export class Effects {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;

    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.color = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.free = [];
    for (let i = MAX - 1; i >= 0; i--) { this.free.push(i); this.pos[i * 3 + 1] = -9999; }

    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: makeSoftDot() } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);

    /* web splat decals */
    this.decals = [];
    this.decalPool = [];
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    const decalTex = makeSoftDot('rgba(240,246,255,1)', 'rgba(240,246,255,0)');
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
        map: decalTex, transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false,
      }));
      m.visible = false; m.renderOrder = 4;
      scene.add(m);
      this.decalPool.push(m);
    }
  }

  /* --------------------------------------------------------- emission */
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, gravity = -9, drag = 1.4) {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life;
    this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b;
    this.alpha[i] = 1; this.grav[i] = gravity; this.drag[i] = drag;
    return i;
  }

  burst(pos, count, opts = {}) {
    const {
      speed = 4, spread = 1, size = 0.6, life = 0.8, color = [1, 1, 1],
      gravity = -9, drag = 1.4, up = 0.5, dir = null,
    } = opts;
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random();
      let vx = Math.cos(a) * spread * e, vz = Math.sin(a) * spread * e;
      let vy = up * (0.3 + Math.random());
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const s = speed * (0.5 + Math.random());
      this.emit(
        pos.x + vx * 0.15, pos.y + Math.random() * 0.3, pos.z + vz * 0.15,
        vx * s, vy * s, vz * s,
        size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.6),
        color[0], color[1], color[2], gravity, drag);
    }
  }

  /* ------------------------------------------------------- game hooks */
  landingDust(pos, power) {
    const n = Math.round(6 + power * 26);
    this.burst(pos, n, {
      speed: 2.5 + power * 7, spread: 1.4, size: 0.9 + power * 1.4,
      life: 0.7 + power * 0.7, color: [0.62, 0.60, 0.56], gravity: -2.2, drag: 2.6, up: 0.35,
    });
    if (power > 0.55) {
      this.burst(pos, 10, { speed: 6 + power * 9, spread: 1, size: 0.28, life: 0.5,
        color: [1, 0.85, 0.55], gravity: -16, drag: 0.8, up: 0.9 });
    }
  }

  groundBurst(pos) {
    this.burst(pos, 18, { speed: 6, spread: 1.5, size: 0.8, life: 0.6,
      color: [0.7, 0.7, 0.68], gravity: -3, drag: 2.4, up: 0.5 });
  }

  impact(pos, dir, power = 1, tint = [1, 0.86, 0.55]) {
    this.burst(pos, Math.round(8 + power * 14), {
      speed: 7 * power, spread: 1.0, size: 0.34, life: 0.34,
      color: tint, gravity: -14, drag: 1.0, up: 0.6, dir,
    });
    this.burst(pos, 5, { speed: 2.4, spread: 1.2, size: 1.1, life: 0.38,
      color: [1, 1, 1], gravity: 0, drag: 4, up: 0.2 });
  }

  webSplat(pos, normal) {
    const m = this.decalPool.pop();
    if (!m) return;
    m.visible = true;
    m.position.copy(pos).addScaledVector(normal, 0.06);
    m.lookAt(_v.copy(pos).add(normal));
    const s = 0.9 + Math.random() * 0.7;
    m.scale.set(s, s, s);
    m.material.opacity = 0.85;
    m.userData.life = 9 + Math.random() * 6;
    this.decals.push(m);
  }

  steam(pos) {
    this.emit(pos.x, pos.y, pos.z,
      (Math.random() - 0.5) * 0.5, 1.4 + Math.random(), (Math.random() - 0.5) * 0.5,
      1.8 + Math.random(), 2.4, 0.5, 0.52, 0.55, 0.6, 0.4);
  }

  sparks(pos, count = 14) {
    this.burst(pos, count, { speed: 9, spread: 1, size: 0.2, life: 0.45,
      color: [1, 0.78, 0.35], gravity: -22, drag: 0.6, up: 0.8 });
  }

  explosion(pos, scale = 1) {
    this.burst(pos, Math.round(40 * scale), { speed: 13 * scale, spread: 1, size: 1.5 * scale,
      life: 0.8, color: [1, 0.6, 0.22], gravity: -3, drag: 1.6, up: 0.7 });
    this.burst(pos, Math.round(22 * scale), { speed: 5 * scale, spread: 1, size: 2.6 * scale,
      life: 1.6, color: [0.25, 0.24, 0.23], gravity: 1.2, drag: 2.4, up: 0.9 });
    this.game.camera.shake(0.75 * scale, 0.5);
  }

  speedLines(speed) {
    this.game.postfx?.pulseSpeed(clamp01(speed / 55));
  }

  /* ---------------------------------------------------------- update */
  update(dt) {
    const pos = this.pos, vel = this.vel;
    for (let i = 0; i < MAX; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const nl = l - dt;
      if (nl <= 0) {
        this.life[i] = 0; this.alpha[i] = 0; pos[i * 3 + 1] = -9999;
        this.free.push(i);
        continue;
      }
      this.life[i] = nl;
      const b = i * 3;
      vel[b + 1] += this.grav[i] * dt;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      vel[b] *= d; vel[b + 1] *= d; vel[b + 2] *= d;
      pos[b] += vel[b] * dt; pos[b + 1] += vel[b + 1] * dt; pos[b + 2] += vel[b + 2] * dt;
      const k = nl / this.maxLife[i];
      this.alpha[i] = k < 0.25 ? k / 0.25 : 1;
      this.size[i] *= 1 + dt * 0.35;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;

    for (let i = this.decals.length - 1; i >= 0; i--) {
      const m = this.decals[i];
      m.userData.life -= dt;
      if (m.userData.life < 1.5) m.material.opacity = Math.max(0, m.userData.life / 1.5) * 0.85;
      if (m.userData.life <= 0) {
        m.visible = false;
        this.decals.splice(i, 1);
        this.decalPool.push(m);
      }
    }
  }
}

const _v = new THREE.Vector3();
