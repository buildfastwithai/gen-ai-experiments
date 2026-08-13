/* swinging/WebLine.js
   A web strand drawn as a camera-facing ribbon.

   GPU line width is 1px almost everywhere, which looks like a hairline bug at
   speed. Instead each strand is a strip of quads whose width is expanded along
   the screen-space perpendicular, so the web keeps a believable thickness at any
   distance and any angle. The strand carries a catenary sag that tightens as
   tension rises, plus a travelling wobble when it's just been fired — that
   little whip is most of the "it's a physical rope" read. */

import * as THREE from 'three';
import { lerp, clamp01 } from '../core/MathUtils.js';

const SEGMENTS = 22;

export class WebLine {
  constructor(color = 0xf2f6ff, width = 0.055) {
    this.segments = SEGMENTS;
    const n = SEGMENTS + 1;
    this.positions = new Float32Array(n * 2 * 3);
    this.uvs = new Float32Array(n * 2 * 2);
    const idx = new Uint16Array(SEGMENTS * 6);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.set([a, b, c, b, d, c], i * 6);
    }
    for (let i = 0; i < n; i++) {
      const t = i / SEGMENTS;
      this.uvs[i * 4] = t; this.uvs[i * 4 + 1] = 0;
      this.uvs[i * 4 + 2] = t; this.uvs[i * 4 + 3] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.94, side: THREE.DoubleSide,
      depthWrite: false, toneMapped: false, fog: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;

    this.width = width;
    this.fireT = 0;          // 0..1 extension while the strand shoots out
    this.wobble = 0;
    this._pts = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3());
  }

  /**
   * @param {Vector3} from  hand position
   * @param {Vector3} to    anchor
   * @param {Vector3} camPos
   * @param {number}  slack 0 = taut, 1 = lots of sag
   * @param {number}  dt
   */
  update(from, to, camPos, slack, dt) {
    this.mesh.visible = true;
    this.fireT = Math.min(1, this.fireT + dt * 9);
    this.wobble = Math.max(0, this.wobble - dt * 2.6);

    const reach = this.fireT;
    _dir.copy(to).sub(from);
    const len = _dir.length();
    const sag = lerp(0.008, 0.075, clamp01(slack)) * len;

    // perpendicular used for the sag direction (mostly down, slightly lateral)
    _side.set(0, -1, 0);

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = (i / SEGMENTS) * reach;
      const p = this._pts[i];
      p.copy(from).addScaledVector(_dir, t);
      const s = Math.sin(t * Math.PI);
      p.addScaledVector(_side, sag * s);
      if (this.wobble > 0.001) {
        const w = Math.sin(t * 14 - this.fireT * 22) * this.wobble * 0.35 * s;
        p.x += w * 0.4; p.y += w; p.z += w * 0.4;
      }
    }

    // build the ribbon
    const pos = this.positions;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = this._pts[i];
      const prev = this._pts[Math.max(0, i - 1)];
      const next = this._pts[Math.min(SEGMENTS, i + 1)];
      _tan.copy(next).sub(prev);
      if (_tan.lengthSq() < 1e-8) _tan.copy(_dir);
      _view.copy(camPos).sub(p);
      _perp.crossVectors(_tan, _view);
      if (_perp.lengthSq() < 1e-10) _perp.set(1, 0, 0);
      // Widen slightly with distance so the strand never sub-pixels out.
      const dist = _view.length();
      const w = this.width * (1 + dist * 0.012);
      _perp.normalize().multiplyScalar(w);
      const o = i * 6;
      pos[o] = p.x - _perp.x; pos[o + 1] = p.y - _perp.y; pos[o + 2] = p.z - _perp.z;
      pos[o + 3] = p.x + _perp.x; pos[o + 4] = p.y + _perp.y; pos[o + 5] = p.z + _perp.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }

  fire() { this.fireT = 0; this.wobble = 1; }
  hide() { this.mesh.visible = false; this.fireT = 0; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _view = new THREE.Vector3();
const _perp = new THREE.Vector3();
