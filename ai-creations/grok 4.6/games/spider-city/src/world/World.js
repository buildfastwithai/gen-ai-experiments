/* world/World.js
   Owns the city: layout, geometry, collision grid, streaming LOD and the
   queries every other system asks ("what's under me", "where can I attach a web",
   "give me a rooftop near here"). Nothing else touches CityBuilder directly. */

import * as THREE from 'three';
import { CityLayout, DISTRICT, districtLabel } from './CityLayout.js';
import { CityBuilder } from './CityBuilder.js';
import { SpatialGrid, makeHitResult } from '../physics/SpatialGrid.js';
import { cityUniforms } from './CityMaterials.js';
import { makeRng } from '../core/MathUtils.js';

export class World {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.preset = settings.preset;
    this.grid = new SpatialGrid(90000);
    this.hit = makeHitResult();
    this.hit2 = makeHitResult();
    this.rng = makeRng(4242);
    this.time = 0;
  }

  async build(onProgress = () => {}) {
    onProgress(0, 'Planning districts');
    await nextFrame();
    this.layout = new CityLayout(this.preset.citySize);
    this.extent = this.layout.extent;

    this.builder = new CityBuilder(this.scene, this.layout, this.grid, this.preset);
    const phases = this.builder.phases();
    const total = phases.reduce((a, p) => a + p.weight, 0);
    let acc = 0;
    for (const ph of phases) {
      onProgress(acc / total, ph.label);
      await nextFrame();          // let the loading bar breathe between phases
      ph.run();
      acc += ph.weight;
    }
    onProgress(1, 'City complete');
    return this;
  }

  /* ---------------------------------------------------------- queries */

  /** Ground/roof height beneath a point. */
  heightAt(x, z, fromY = 1e5) { return this.grid.groundHeight(x, z, fromY); }

  raycast(origin, dir, maxDist, result = this.hit) {
    return this.grid.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist, result);
  }

  nearestSurface(p, radius, result = this.hit2) {
    return this.grid.nearestSurface(p.x, p.y, p.z, radius, result);
  }

  /**
   * Find the surface under the centre reticle.
   * A single camera ray makes the visible reticle the authoritative target.
   */
  findAttachPoint(origin, aim, maxRange, result = this.hit) {
    if (!this.grid.raycast(origin.x, origin.y, origin.z,
      aim.x, aim.y, aim.z, maxRange, result)) {
      result.hit = false;
      return false;
    }
    result.point.addScaledVector(result.normal, 0.08);
    return result.hit;
  }

  /** Nearest rooftop landing spot to a position (missions, fast travel, AI). */
  nearestRoof(x, z, minHeight = 0) {
    let best = null, bd = Infinity;
    for (const r of this.builder.roofAccess) {
      if (r.y < minHeight) continue;
      const d = (r.x - x) ** 2 + (r.z - z) ** 2;
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  randomRoof(minHeight = 25, maxHeight = 1e9) {
    const list = this.builder.roofAccess.filter((r) => r.y >= minHeight && r.y <= maxHeight);
    return list.length ? list[(this.rng() * list.length) | 0] : null;
  }

  /** Free street position near a point — used to spawn NPCs, enemies, events. */
  findStreetSpot(x, z, radius = 60, tries = 24) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng() * Math.PI * 2, r = radius * Math.sqrt(this.rng());
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) > this.extent || Math.abs(pz) > this.extent) continue;
      if (!this.layout.isRoad(px, pz)) continue;
      if (this.grid.groundHeight(px, pz, 3) > 0.6) continue;
      return { x: px, y: 0.22, z: pz };
    }
    return { x, y: 0.22, z };
  }

  districtAtWorld(x, z) {
    const L = this.layout;
    const i = Math.round(x / L.cell + L.half);
    const j = Math.round(z / L.cell + L.half);
    if (i < 0 || j < 0 || i >= L.size || j >= L.size) return DISTRICT.WATER;
    return L.districtAt(i, j);
  }
  districtNameAtWorld(x, z) { return districtLabel(this.districtAtWorld(x, z)); }

  inBounds(x, z) { return Math.abs(x) < this.extent + 60 && Math.abs(z) < this.extent + 60; }

  /* ---------------------------------------------------------- runtime */
  update(dt, camPos) {
    this.time += dt;
    cityUniforms.uTime.value = this.time;
    this.builder.updateLOD(camPos, this.preset.drawDistance);

    // Beacons blink; billboards flicker very occasionally.
    const blink = (Math.sin(this.time * 2.2) * 0.5 + 0.5) ** 3;
    if (this.builder.billboards) {
      for (const b of this.builder.billboards) {
        const f = this.rng() < 0.0015 ? 0.1 : null;
        if (f !== null) b.material.emissiveIntensity = f;
        else b.material.emissiveIntensity += (cityUniforms.uNight.value * 0.85 + 0.18 - b.material.emissiveIntensity) * Math.min(1, dt * 6);
      }
    }
    if (this.builder.lampGlow) {
      const on = cityUniforms.uNight.value;
      this.builder.lampGlow.material.opacity = on * 0.95;
      this.builder.lampGlow.visible = on > 0.02;
    }
    this._beaconBlink = blink;
  }

  dispose() {
    this.scene.remove(this.builder.root);
    this.builder.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.grid.clear();
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
