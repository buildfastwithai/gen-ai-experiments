/* physics/SpatialGrid.js
   Uniform XZ hash grid over every solid box in the city.

   The whole game — collision, wall detection, web attachment, camera occlusion,
   NPC avoidance, traffic — asks this one structure. Boxes live in flat typed
   arrays so a query touches a couple of cache lines instead of chasing objects.
   Nothing here allocates during gameplay. */

import * as THREE from 'three';
import { clamp, rayAABB } from '../core/MathUtils.js';

const CELL = 60;

export class SpatialGrid {
  constructor(capacity = 20000) {
    this.min = new Float32Array(capacity * 3);
    this.max = new Float32Array(capacity * 3);
    this.meta = new Int32Array(capacity);     // 0 building, 1 prop, 2 ground, 3 dynamic
    this.owner = new Array(capacity).fill(null);
    this.count = 0;
    this.cells = new Map();
    this._scratch = [];
    this._seen = new Int32Array(capacity);
    this._stamp = 1;
  }

  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  add(minX, minY, minZ, maxX, maxY, maxZ, meta = 0, owner = null) {
    const i = this.count++;
    if (i * 3 + 2 >= this.min.length) return -1;   // capacity guard
    this.min[i * 3] = minX; this.min[i * 3 + 1] = minY; this.min[i * 3 + 2] = minZ;
    this.max[i * 3] = maxX; this.max[i * 3 + 1] = maxY; this.max[i * 3 + 2] = maxZ;
    this.meta[i] = meta;
    this.owner[i] = owner;
    const cx0 = Math.floor(minX / CELL), cx1 = Math.floor(maxX / CELL);
    const cz0 = Math.floor(minZ / CELL), cz1 = Math.floor(maxZ / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = this.key(cx, cz);
        let arr = this.cells.get(k);
        if (!arr) { arr = []; this.cells.set(k, arr); }
        arr.push(i);
      }
    }
    return i;
  }

  addBox3(box, meta = 0, owner = null) {
    return this.add(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z, meta, owner);
  }

  boxAt(i, target) {
    target.min.set(this.min[i * 3], this.min[i * 3 + 1], this.min[i * 3 + 2]);
    target.max.set(this.max[i * 3], this.max[i * 3 + 1], this.max[i * 3 + 2]);
    return target;
  }

  /** Indices whose cells overlap the XZ disc (y ignored). Reuses one array. */
  query(x, z, radius, out) {
    out = out || this._scratch;
    out.length = 0;
    const stamp = ++this._stamp;
    const cx0 = Math.floor((x - radius) / CELL), cx1 = Math.floor((x + radius) / CELL);
    const cz0 = Math.floor((z - radius) / CELL), cz1 = Math.floor((z + radius) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const arr = this.cells.get(this.key(cx, cz));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const i = arr[n];
          if (this._seen[i] === stamp) continue;
          this._seen[i] = stamp;
          out.push(i);
        }
      }
    }
    return out;
  }

  /** True if the AABB i overlaps a sphere. */
  sphereHits(i, px, py, pz, r) {
    const b = i * 3;
    const dx = px - clamp(px, this.min[b], this.max[b]);
    const dy = py - clamp(py, this.min[b + 1], this.max[b + 1]);
    const dz = pz - clamp(pz, this.min[b + 2], this.max[b + 2]);
    return dx * dx + dy * dy + dz * dz <= r * r;
  }

  /** Height of the tallest surface directly under (x,z) below `fromY`. */
  groundHeight(x, z, fromY = 1e5) {
    const list = this.query(x, z, 0.6);
    let best = 0;   // street level
    for (let n = 0; n < list.length; n++) {
      const i = list[n], b = i * 3;
      if (x < this.min[b] || x > this.max[b] || z < this.min[b + 2] || z > this.max[b + 2]) continue;
      const top = this.max[b + 1];
      if (top <= fromY + 0.35 && top > best) best = top;
    }
    return best;
  }

  /**
   * Nearest surface point + outward normal within `radius` of p.
   * This is how wall-crawl, wall-run and web-attachment all find geometry.
   */
  nearestSurface(px, py, pz, radius, result) {
    const list = this.query(px, pz, radius);
    let bestD = radius * radius, found = false;
    for (let n = 0; n < list.length; n++) {
      const i = list[n], b = i * 3;
      const cx = clamp(px, this.min[b], this.max[b]);
      const cy = clamp(py, this.min[b + 1], this.max[b + 1]);
      const cz = clamp(pz, this.min[b + 2], this.max[b + 2]);
      const dx = px - cx, dy = py - cy, dz = pz - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= bestD) continue;
      bestD = d2; found = true;
      result.point.set(cx, cy, cz);
      result.index = i;
      // Normal = the axis we're least penetrated on.
      if (d2 > 1e-6) {
        result.normal.set(dx, dy, dz).normalize();
        // Snap to the dominant face so wall running doesn't drift on corners.
        const ax = Math.abs(result.normal.x), ay = Math.abs(result.normal.y), az = Math.abs(result.normal.z);
        if (ax > ay && ax > az) result.normal.set(Math.sign(result.normal.x), 0, 0);
        else if (az > ay) result.normal.set(0, 0, Math.sign(result.normal.z));
        else result.normal.set(0, Math.sign(result.normal.y) || 1, 0);
      } else {
        // inside the box — push out along the shallowest axis
        const dxp = px - this.min[b], dxn = this.max[b] - px;
        const dzp = pz - this.min[b + 2], dzn = this.max[b + 2] - pz;
        const dyn = this.max[b + 1] - py;
        const m = Math.min(dxp, dxn, dzp, dzn, dyn);
        if (m === dxp) result.normal.set(-1, 0, 0);
        else if (m === dxn) result.normal.set(1, 0, 0);
        else if (m === dzp) result.normal.set(0, 0, -1);
        else if (m === dzn) result.normal.set(0, 0, 1);
        else result.normal.set(0, 1, 0);
      }
      result.distance = Math.sqrt(d2);
    }
    result.hit = found;
    return found;
  }

  /**
   * Ray march against the grid. Cheap DDA over cells, exact slab test per box.
   * Returns true and fills `result` with point/normal/distance/index.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, result, skipMeta = -1) {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    let bestT = maxDist, hit = false, bestI = -1;

    const step = CELL * 0.75;
    const stamp = ++this._stamp;
    for (let t = 0; t <= maxDist + step; t += step) {
      const sx = ox + dx * t, sz = oz + dz * t;
      const cx0 = Math.floor((sx - CELL) / CELL), cx1 = Math.floor((sx + CELL) / CELL);
      const cz0 = Math.floor((sz - CELL) / CELL), cz1 = Math.floor((sz + CELL) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const arr = this.cells.get(this.key(cx, cz));
          if (!arr) continue;
          for (let n = 0; n < arr.length; n++) {
            const i = arr[n];
            if (this._seen[i] === stamp) continue;
            this._seen[i] = stamp;
            if (this.meta[i] === skipMeta) continue;
            const b = i * 3;
            _min.set(this.min[b], this.min[b + 1], this.min[b + 2]);
            _max.set(this.max[b], this.max[b + 1], this.max[b + 2]);
            const th = rayAABB(ox, oy, oz, dx, dy, dz, _min, _max);
            if (th >= 0 && th < bestT) { bestT = th; bestI = i; hit = true; }
          }
        }
      }
      if (hit && bestT < t) break;   // nothing further out can beat this
    }

    if (!hit) { result.hit = false; return false; }
    const b = bestI * 3;
    result.hit = true;
    result.distance = bestT;
    result.index = bestI;
    result.point.set(ox + dx * bestT, oy + dy * bestT, oz + dz * bestT);
    // face normal from which slab we landed on
    const eps = 0.05;
    const p = result.point;
    if (Math.abs(p.x - this.min[b]) < eps) result.normal.set(-1, 0, 0);
    else if (Math.abs(p.x - this.max[b]) < eps) result.normal.set(1, 0, 0);
    else if (Math.abs(p.z - this.min[b + 2]) < eps) result.normal.set(0, 0, -1);
    else if (Math.abs(p.z - this.max[b + 2]) < eps) result.normal.set(0, 0, 1);
    else if (Math.abs(p.y - this.max[b + 1]) < eps) result.normal.set(0, 1, 0);
    else result.normal.set(0, -1, 0);
    return true;
  }

  clear() {
    this.count = 0; this.cells.clear(); this.owner.length = 0; this._stamp = 1;
  }
}

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();

export function makeHitResult() {
  return { hit: false, point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, index: -1 };
}
