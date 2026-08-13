/* physics/CharacterBody.js
   Swept capsule vs. the city's AABB soup.

   Deliberately not a rigid-body engine: superhero traversal wants a controller
   that is forgiving upward, sticky sideways and never tunnels at 90 m/s. The
   solver substeps by distance, resolves each contact along its face normal and
   reports the contacts the movement systems care about (ground / wall / ceiling). */

import * as THREE from 'three';
import { clamp } from '../core/MathUtils.js';

const MAX_SUBSTEP = 1.2;   // world units per collision substep
const STEP_HEIGHT = 0.55;  // curbs and low ledges are stepped over, not blocked

export class CharacterBody {
  constructor(grid, radius = 0.42, height = 1.8) {
    this.grid = grid;
    this.radius = radius;
    this.height = height;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.groundY = 0;
    this.onWall = false;
    this.wallNormal = new THREE.Vector3();
    this.ceiling = false;
    this.lastImpactSpeed = 0;
    this.skipCollision = false;
    this._contacts = [];
  }

  /** Two spheres approximate the capsule: hips and shoulders. */
  _spheres(out, p) {
    out[0].set(p.x, p.y + this.radius, p.z);
    out[1].set(p.x, p.y + this.height - this.radius, p.z);
    return out;
  }

  integrate(dt) {
    if (this.skipCollision) {
      this.position.addScaledVector(this.velocity, dt);
      this.grounded = false; this.onWall = false;
      return;
    }
    const dist = this.velocity.length() * dt;
    const steps = clamp(Math.ceil(dist / MAX_SUBSTEP), 1, 12);
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.position.addScaledVector(this.velocity, h);
      this.resolve();
    }
  }

  resolve() {
    const g = this.grid;
    this.grounded = false; this.onWall = false; this.ceiling = false;
    this.wallNormal.set(0, 0, 0);

    const p = this.position;
    const list = g.query(p.x, p.z, this.radius + 2.2);
    const s = _spheres; this._spheres(s, p);
    let wallAccum = _wallAccum.set(0, 0, 0);
    let wallCount = 0;

    for (let n = 0; n < list.length; n++) {
      const i = list[n], b = i * 3;
      const minX = g.min[b], minY = g.min[b + 1], minZ = g.min[b + 2];
      const maxX = g.max[b], maxY = g.max[b + 1], maxZ = g.max[b + 2];
      if (p.y > maxY + this.height + 0.5 || p.y + this.height < minY - 0.5) continue;

      for (let k = 0; k < 2; k++) {
        const sp = s[k];
        const cx = clamp(sp.x, minX, maxX);
        const cy = clamp(sp.y, minY, maxY);
        const cz = clamp(sp.z, minZ, maxZ);
        let dx = sp.x - cx, dy = sp.y - cy, dz = sp.z - cz;
        let d2 = dx * dx + dy * dy + dz * dz;
        const r = this.radius;

        if (d2 > r * r) continue;

        let nx, ny, nz, pen;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d;
        } else {
          // centre inside the box — eject through the nearest face
          const ex1 = sp.x - minX, ex2 = maxX - sp.x;
          const ez1 = sp.z - minZ, ez2 = maxZ - sp.z;
          const ey2 = maxY - sp.y;
          const m = Math.min(ex1, ex2, ez1, ez2, ey2);
          nx = ny = nz = 0;
          if (m === ex1) nx = -1; else if (m === ex2) nx = 1;
          else if (m === ez1) nz = -1; else if (m === ez2) nz = 1;
          else ny = 1;
          pen = m + r;
        }

        // Face snapping: axis-aligned worlds look wrong with rounded corner normals.
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay > 0.72 && ay >= ax && ay >= az) { nx = 0; nz = 0; ny = Math.sign(ny) || 1; }

        // Step-up: curbs, kerbs, low ledges and stair lips should be walked over,
        // not walked into. Without this the city's 22 cm sidewalks act like walls.
        if (ay <= 0.72 && k === 0 && this.velocity.y <= 0.6) {
          const rise = maxY - p.y;
          if (rise > 0 && rise <= STEP_HEIGHT) {
            p.y = maxY + 0.001;
            s[0].set(p.x, p.y + r, p.z); s[1].set(p.x, p.y + this.height - r, p.z);
            this.grounded = true; this.groundY = maxY;
            if (this.velocity.y < 0) this.velocity.y = 0;
            continue;
          }
        }

        p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
        s[0].set(p.x, p.y + r, p.z); s[1].set(p.x, p.y + this.height - r, p.z);

        const vn = this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz;
        if (vn < 0) {
          this.lastImpactSpeed = Math.max(this.lastImpactSpeed, -vn);
          this.velocity.x -= vn * nx; this.velocity.y -= vn * ny; this.velocity.z -= vn * nz;
        }

        if (ny > 0.6) { this.grounded = true; this.groundY = maxY; }
        else if (ny < -0.6) { this.ceiling = true; }
        else { this.onWall = true; wallAccum.x += nx; wallAccum.z += nz; wallCount++; }
      }
    }

    // Street plane
    if (p.y < 0) {
      const vn = this.velocity.y;
      if (vn < 0) { this.lastImpactSpeed = Math.max(this.lastImpactSpeed, -vn); this.velocity.y = 0; }
      p.y = 0; this.grounded = true; this.groundY = 0;
    }

    if (wallCount > 0) {
      wallAccum.normalize();
      this.wallNormal.copy(wallAccum);
    }
  }

  /** Probe for a wall in a direction without moving. Used for wall-run entry. */
  probeWall(dir, distance, result) {
    return this.grid.raycast(
      this.position.x, this.position.y + this.height * 0.55, this.position.z,
      dir.x, dir.y, dir.z, distance, result);
  }

  consumeImpact() { const v = this.lastImpactSpeed; this.lastImpactSpeed = 0; return v; }
}

const _spheres = [new THREE.Vector3(), new THREE.Vector3()];
const _wallAccum = new THREE.Vector3();
