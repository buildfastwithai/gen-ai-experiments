/* world/CityBuilder.js
   Layout data -> GPU.

   Buildings are drawn as instanced *wall planes*, not boxes: four outward-facing
   quads plus a roof cap per segment. That halves the triangles of a box, kills
   every invisible interior face, and — crucially — lets each wall carry its own
   UV transform, so a 40 m wide facade and a 9 m wide facade both show windows at
   the same real-world scale instead of stretching one texture over both.

   Everything is bucketed into streaming SECTORS (3x3 city blocks). Each sector
   owns its own instanced meshes, which gives us free frustum culling, per-sector
   shadow toggling and distance LOD for the price of a few extra draw calls. */

import * as THREE from 'three';
import { DISTRICT, FLOOR_HEIGHT } from './CityLayout.js';
import {
  facadeMaterial, roofMaterial, sidewalkMaterial, roadMaterial, grassMaterial,
  waterMaterial, attachInstanceAttributes, glowMaterial, paintedMetal,
} from './CityMaterials.js';
import { makeNeonSign, makeBillboard } from './TextureFactory.js';
import { makeRng, clamp } from '../core/MathUtils.js';
import { WORLD } from '../core/Settings.js';

const BAY_W = 3.45;                 // metres per window bay
const SECTOR_BLOCKS = 3;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Build a matrix for a wall quad facing `nx,nz`, centred at (x,y,z). */
function wallMatrix(x, y, z, w, h, nx, nz) {
  _q.setFromAxisAngle(_up, Math.atan2(nx, nz));
  _p.set(x, y, z); _s.set(w, h, 1);
  return _m.compose(_p, _q, _s);
}

export class CityBuilder {
  constructor(scene, layout, grid, preset) {
    this.scene = scene;
    this.layout = layout;
    this.grid = grid;
    this.preset = preset;
    this.rng = makeRng(layout.seed ^ 0x5eed);
    this.root = new THREE.Group();
    this.root.name = 'City';
    scene.add(this.root);

    this.sectors = [];
    this.sectorMap = new Map();
    this.neonLights = [];      // {x,y,z,color} consumed by the night lighting system
    this.streetLamps = [];
    this.trafficLights = [];
    this.roofAccess = [];      // safe landing spots for missions & fast travel
  }

  /* -------------------------------------------------------------- sectors */
  sectorFor(i, j) {
    const si = Math.floor(i / SECTOR_BLOCKS), sj = Math.floor(j / SECTOR_BLOCKS);
    const key = si + ':' + sj;
    let s = this.sectorMap.get(key);
    if (!s) {
      const c = this.layout.cell * SECTOR_BLOCKS;
      const cx = (si * SECTOR_BLOCKS + (SECTOR_BLOCKS - 1) / 2 - this.layout.half) * this.layout.cell;
      const cz = (sj * SECTOR_BLOCKS + (SECTOR_BLOCKS - 1) / 2 - this.layout.half) * this.layout.cell;
      s = {
        key, si, sj, cx, cz, radius: c * 0.85,
        group: new THREE.Group(), props: new THREE.Group(), detail: new THREE.Group(),
        walls: new Map(), roofs: [], parapets: [], maxHeight: 0,
        lod: -1,
      };
      s.group.add(s.props); s.group.add(s.detail);
      this.root.add(s.group);
      this.sectors.push(s);
      this.sectorMap.set(key, s);
    }
    return s;
  }

  /* ---------------------------------------------------------------- build */
  /**
   * Phases are returned rather than run, so the loader can await a frame
   * between each one and the progress bar actually animates instead of
   * freezing for two seconds and then jumping to done.
   */
  phases() {
    return [
      { label: 'Pouring streets',        weight: 6,  run: () => this.buildGround() },
      { label: 'Laying sidewalks',       weight: 6,  run: () => this.buildSidewalks() },
      { label: 'Painting road markings', weight: 5,  run: () => this.buildRoadMarkings() },
      { label: 'Raising the skyline',    weight: 34, run: () => this.buildBuildings() },
      { label: 'Dressing rooftops',      weight: 18, run: () => this.buildRoofProps() },
      { label: 'Hanging signage',        weight: 10, run: () => this.buildSignage() },
      { label: 'Planting parks',         weight: 7,  run: () => this.buildParks() },
      { label: 'Opening the waterfront', weight: 6,  run: () => this.buildWaterfront() },
      { label: 'Street furniture',       weight: 8,  run: () => this.finalise() },
    ];
  }

  build(onProgress = () => {}) {
    const list = this.phases();
    const total = list.reduce((a, p) => a + p.weight, 0);
    let acc = 0;
    for (const ph of list) { onProgress(acc / total, ph.label); ph.run(); acc += ph.weight; }
    onProgress(1, 'City complete');
    return this;
  }

  /* --------------------------------------------------------------- ground */
  buildGround() {
    const L = this.layout;
    const span = L.size * L.cell + L.cell * 2;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(span, span, 1, 1), roadMaterial());
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    road.name = 'asphalt';
    // Repeat the asphalt so one tile is ~9 m — any bigger and it reads as fog.
    const mat = road.material;
    const rep = span / 9;
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (mat[k]) mat[k].repeat.set(rep, rep);
    this.root.add(road);
    this.ground = road;

    // A dark under-plane so gaps at the horizon never show the skybox through the street.
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 3, span * 3),
      new THREE.MeshBasicMaterial({ color: 0x0a0d12 }));
    under.rotation.x = -Math.PI / 2; under.position.y = -3;
    this.root.add(under);
  }

  buildSidewalks() {
    const L = this.layout;
    const blocks = L.blocks.filter((b) => b.district !== DISTRICT.WATER);
    const size = L.blockSize + WORLD.sidewalkWidth * 2;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, sidewalkMaterial(), blocks.length);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    const curbGeo = new THREE.BoxGeometry(1, 1, 1);
    const curb = new THREE.InstancedMesh(curbGeo, paintedMetal(0x5c5b57, 0.95, 0.0), blocks.length);
    curb.receiveShadow = true;

    const H = 0.22;
    blocks.forEach((b, n) => {
      _p.set(b.cx, H * 0.5, b.cz); _q.identity(); _s.set(size, H, size);
      mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      _p.set(b.cx, H * 0.5 - 0.02, b.cz); _s.set(size + 0.5, H * 0.92, size + 0.5);
      curb.setMatrixAt(n, _m.compose(_p, _q, _s));
      this.grid.add(b.cx - size / 2, 0, b.cz - size / 2, b.cx + size / 2, H, b.cz + size / 2, 2, null);
    });
    mesh.instanceMatrix.needsUpdate = true;
    curb.instanceMatrix.needsUpdate = true;
    // Repeat sidewalk texture per 4 m
    const sm = mesh.material;
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (sm[k]) sm[k].repeat.set(size / 4, size / 4);
    this.root.add(curb); this.root.add(mesh);
  }

  buildRoadMarkings() {
    const L = this.layout;
    const white = new THREE.MeshStandardMaterial({
      color: 0xdcd9cf, roughness: 0.72, metalness: 0.0, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const yellow = new THREE.MeshStandardMaterial({
      color: 0xd6ad3a, roughness: 0.75, metalness: 0.0, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const dashes = [];
    const cross = [];
    const half = L.blockSize * 0.5 + WORLD.sidewalkWidth;

    for (const rx of L.roadsZ) {
      for (let z = -L.extent; z < L.extent; z += 11) {
        // skip inside intersections
        let inX = false;
        for (const rz of L.roadsX) if (Math.abs(z - rz) < half * 0.35 + 8) { inX = true; break; }
        if (inX) continue;
        dashes.push([rx, z, 0.42, 5.2, 0]);
      }
    }
    for (const rz of L.roadsX) {
      for (let x = -L.extent; x < L.extent; x += 11) {
        let inX = false;
        for (const rx of L.roadsZ) if (Math.abs(x - rx) < half * 0.35 + 8) { inX = true; break; }
        if (inX) continue;
        dashes.push([x, rz, 5.2, 0.42, 0]);
      }
    }
    // Crosswalk ladders on every intersection approach
    for (const it of L.intersections) {
      for (let k = -4; k <= 4; k++) {
        if (!k) continue;
        cross.push([it.x + k * 1.5, it.z + half * 0.62, 0.9, 4.4]);
        cross.push([it.x + k * 1.5, it.z - half * 0.62, 0.9, 4.4]);
        cross.push([it.x + half * 0.62, it.z + k * 1.5, 4.4, 0.9]);
        cross.push([it.x - half * 0.62, it.z + k * 1.5, 4.4, 0.9]);
      }
    }

    const mk = (list, mat) => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      const im = new THREE.InstancedMesh(g, mat, list.length);
      im.receiveShadow = true;
      list.forEach((d, n) => {
        _p.set(d[0], 0.015, d[1]); _q.identity(); _s.set(d[2], 1, d[3]);
        im.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.root.add(im);
      return im;
    };
    if (dashes.length) mk(dashes, yellow);
    if (cross.length) mk(cross, white);
  }

  /* ------------------------------------------------------------ buildings */
  buildBuildings() {
    const L = this.layout;
    // Bucket wall instances per sector per style so each bucket is one draw call.
    const buckets = new Map();   // sectorKey|style|variant -> array of wall descriptors
    const roofBuckets = new Map();
    const parapetBuckets = new Map();

    for (const b of L.buildings) {
      const sector = this.sectorFor(b.i, b.j);
      sector.maxHeight = Math.max(sector.maxHeight, b.height);
      const bkey = `${sector.key}|${b.style}|${b.variant}`;
      let arr = buckets.get(bkey);
      if (!arr) { arr = { sector, style: b.style, variant: b.variant, list: [] }; buckets.set(bkey, arr); }

      const uvSeed = this.rng();
      b.segments.forEach((seg, si) => {
        const y0 = seg.y, h = seg.h, w = seg.w, d = seg.d;
        const nFloors = Math.max(1, Math.round(h / FLOOR_HEIGHT));
        const nBaysW = Math.max(1, Math.round(w / BAY_W));
        const nBaysD = Math.max(1, Math.round(d / BAY_W));
        const cy = y0 + h * 0.5;

        arr.list.push({ x: b.x, y: cy, z: b.z + d / 2, w, h, nx: 0, nz: 1, bays: nBaysW, floors: nFloors, seed: uvSeed });
        arr.list.push({ x: b.x, y: cy, z: b.z - d / 2, w, h, nx: 0, nz: -1, bays: nBaysW, floors: nFloors, seed: uvSeed });
        arr.list.push({ x: b.x + w / 2, y: cy, z: b.z, w: d, h, nx: 1, nz: 0, bays: nBaysD, floors: nFloors, seed: uvSeed });
        arr.list.push({ x: b.x - w / 2, y: cy, z: b.z, w: d, h, nx: -1, nz: 0, bays: nBaysD, floors: nFloors, seed: uvSeed });

        // roof cap
        let rb = roofBuckets.get(sector.key);
        if (!rb) { rb = []; roofBuckets.set(sector.key, rb); }
        rb.push({ x: b.x, y: y0 + h, z: b.z, w, d });

        // parapet on the top segment only
        if (si === b.segments.length - 1) {
          let pb = parapetBuckets.get(sector.key);
          if (!pb) { pb = []; parapetBuckets.set(sector.key, pb); }
          const ph = 1.15, t = 0.55;
          const top = y0 + h + ph * 0.5;
          pb.push([b.x, top, b.z + d / 2, w + t, ph, t]);
          pb.push([b.x, top, b.z - d / 2, w + t, ph, t]);
          pb.push([b.x + w / 2, top, b.z, t, ph, d + t]);
          pb.push([b.x - w / 2, top, b.z, t, ph, d + t]);
          this.roofAccess.push({ x: b.x, y: y0 + h, z: b.z, w, d, building: b });
        }

        // collision + web attachment volume
        this.grid.add(b.x - w / 2, y0, b.z - d / 2, b.x + w / 2, y0 + h, b.z + d / 2, 0, b);
      });
    }

    // --- wall meshes
    const wallGeoProto = new THREE.PlaneGeometry(1, 1);
    for (const bucket of buckets.values()) {
      const list = bucket.list;
      const geo = wallGeoProto.clone();
      const mat = facadeMaterial(bucket.style, bucket.variant);
      const bays = mat.userData.bays, floors = mat.userData.floors;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const { uv, seed } = attachInstanceAttributes(geo, list.length);
      mesh.castShadow = true; mesh.receiveShadow = true;
      list.forEach((wdesc, n) => {
        mesh.setMatrixAt(n, wallMatrix(wdesc.x, wdesc.y, wdesc.z, wdesc.w, wdesc.h, wdesc.nx, wdesc.nz));
        const rx = wdesc.bays / bays, ry = wdesc.floors / floors;
        // Offsets stay on bay/floor boundaries so windows never get sliced.
        const ox = Math.floor(wdesc.seed * 977 + n * 7) % bays / bays;
        const oy = Math.floor(wdesc.seed * 613 + n * 3) % floors / floors;
        uv[n * 4] = rx; uv[n * 4 + 1] = ry; uv[n * 4 + 2] = ox; uv[n * 4 + 3] = oy;
        seed[n] = wdesc.seed * 100 + (n % 17) * 0.031;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      bucket.sector.group.add(mesh);
      bucket.sector.walls.set(bucket.style, mesh);
    }

    // --- roof caps
    const roofGeo = new THREE.PlaneGeometry(1, 1); roofGeo.rotateX(-Math.PI / 2);
    for (const [skey, list] of roofBuckets) {
      const sector = this.sectorMap.get(skey);
      const mat = roofMaterial();
      const mesh = new THREE.InstancedMesh(roofGeo.clone(), mat, list.length);
      mesh.receiveShadow = true; mesh.castShadow = false;
      list.forEach((r, n) => {
        _p.set(r.x, r.y + 0.02, r.z); _q.identity(); _s.set(r.w, 1, r.d);
        mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      sector.group.add(mesh);
      sector.roofs.push(mesh);
    }
    const rm = roofMaterial();
    for (const k of ['map', 'normalMap']) if (rm[k]) rm[k].repeat.set(6, 6);

    // --- parapets
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const parapetMat = paintedMetal(0x6e6c66, 0.9, 0.02);
    for (const [skey, list] of parapetBuckets) {
      const sector = this.sectorMap.get(skey);
      const mesh = new THREE.InstancedMesh(boxGeo, parapetMat, list.length);
      mesh.castShadow = true; mesh.receiveShadow = true;
      list.forEach((p, n) => {
        _p.set(p[0], p[1], p[2]); _q.identity(); _s.set(p[3], p[4], p[5]);
        mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      sector.group.add(mesh);
      sector.parapets.push(mesh);
    }
  }

  /* ---------------------------------------------------------- roof props */
  buildRoofProps() {
    const density = this.preset.propDensity;
    const rng = this.rng;
    const perSector = new Map();
    const push = (sec, kind, entry) => {
      let m = perSector.get(sec.key);
      if (!m) { m = {}; perSector.set(sec.key, m); }
      (m[kind] = m[kind] || []).push(entry);
    };

    for (const b of this.layout.buildings) {
      const sec = this.sectorFor(b.i, b.j);
      const top = b.height;
      const seg = b.segments[b.segments.length - 1];
      const hw = seg.w * 0.5 - 2.4, hd = seg.d * 0.5 - 2.4;
      if (hw < 1.5 || hd < 1.5) continue;
      const spot = () => ({ x: b.x + rng.range(-hw, hw), z: b.z + rng.range(-hd, hd) });

      for (let n = 0; n < Math.round(b.roof.tanks * density); n++) {
        const s = spot(); push(sec, 'tank', { ...s, y: top, s: rng.range(0.85, 1.4), r: rng() * 6.28 });
      }
      for (let n = 0; n < Math.round(b.roof.hvac * density); n++) {
        const s = spot();
        push(sec, 'hvac', { ...s, y: top, w: rng.range(1.6, 4.2), h: rng.range(0.9, 2.1), d: rng.range(1.6, 3.4), r: rng() * 6.28 });
      }
      for (let n = 0; n < Math.round(b.roof.ac * density); n++) {
        const s = spot(); push(sec, 'vent', { ...s, y: top, s: rng.range(0.7, 1.5), r: rng() * 6.28 });
      }
      for (let n = 0; n < Math.round(b.roof.dish * density); n++) {
        const s = spot(); push(sec, 'dish', { ...s, y: top, s: rng.range(0.8, 1.6), r: rng() * 6.28 });
      }
      if (b.roof.stair) {
        const s = spot(); push(sec, 'stair', { ...s, y: top, r: (rng.int(0, 3)) * Math.PI / 2 });
      }
      if (b.roof.antenna) push(sec, 'antenna', { x: b.x, z: b.z, y: top, h: rng.range(6, 22) });
      if (b.roof.beacon) {
        push(sec, 'beacon', { x: b.x, z: b.z, y: top + (b.roof.antenna ? 14 : 1.6) });
        this.neonLights.push({ x: b.x, y: top + 2, z: b.z, color: 0xff3344, kind: 'beacon' });
      }
      if (b.roof.heliport) push(sec, 'heli', { x: b.x, z: b.z, y: top + 0.06 });
      if (b.fireEscape) {
        const side = rng.int(0, 3);
        push(sec, 'escape', { x: b.x, z: b.z, y: 0, w: seg.w, d: seg.d, h: Math.min(b.height, 38), side });
      }
    }

    /* geometry prototypes ------------------------------------------------ */
    const tankGeo = (() => {
      const g = [];
      const body = new THREE.CylinderGeometry(1.55, 1.75, 3.2, 12, 1);
      body.translate(0, 4.4, 0);
      const cone = new THREE.ConeGeometry(1.9, 1.15, 12);
      cone.translate(0, 6.6, 0);
      const legs = [];
      for (let k = 0; k < 4; k++) {
        const l = new THREE.BoxGeometry(0.22, 2.9, 0.22);
        const a = k * Math.PI / 2 + Math.PI / 4;
        l.translate(Math.cos(a) * 1.35, 1.45, Math.sin(a) * 1.35);
        legs.push(l);
      }
      return mergeGeos([body, cone, ...legs]);
    })();
    const ventGeo = (() => {
      const c = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 8); c.translate(0, 0.65, 0);
      const cap = new THREE.CylinderGeometry(0.62, 0.42, 0.3, 8); cap.translate(0, 1.42, 0);
      return mergeGeos([c, cap]);
    })();
    const dishGeo = (() => {
      const pole = new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6); pole.translate(0, 0.75, 0);
      const d = new THREE.SphereGeometry(1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
      d.rotateX(-Math.PI * 0.62); d.translate(0, 1.75, 0);
      return mergeGeos([pole, d]);
    })();
    const stairGeo = (() => {
      const b = new THREE.BoxGeometry(3.2, 2.7, 3.0); b.translate(0, 1.35, 0);
      const r = new THREE.BoxGeometry(3.5, 0.18, 3.3); r.translate(0, 2.78, 0);
      const dr = new THREE.BoxGeometry(1.1, 1.9, 0.12); dr.translate(0, 0.95, 1.53);
      return mergeGeos([b, r, dr]);
    })();
    const antennaGeo = (() => {
      const g = new THREE.CylinderGeometry(0.09, 0.16, 1, 6); g.translate(0, 0.5, 0);
      return g;
    })();
    const hvacGeo = (() => {
      const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0);
      const f = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10); f.translate(0.2, 1.02, 0);
      return mergeGeos([b, f]);
    })();

    const metalA = paintedMetal(0x8d8a83, 0.55, 0.85);
    const metalB = paintedMetal(0x5f5c56, 0.62, 0.8);
    const woodTank = paintedMetal(0x6a4f3a, 0.85, 0.05);
    const heliMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9 });

    const defs = {
      tank:    { geo: tankGeo, mat: woodTank, shadow: true, collide: [3.6, 7.2, 3.6, 0] },
      hvac:    { geo: hvacGeo, mat: metalA, shadow: true, collide: null },
      vent:    { geo: ventGeo, mat: metalB, shadow: true, collide: null },
      dish:    { geo: dishGeo, mat: metalA, shadow: true, collide: null },
      stair:   { geo: stairGeo, mat: paintedMetal(0x7a736a, 0.9, 0.02), shadow: true, collide: [3.4, 2.9, 3.2, 0] },
      antenna: { geo: antennaGeo, mat: metalB, shadow: true, collide: null },
    };

    for (const [skey, kinds] of perSector) {
      const sector = this.sectorMap.get(skey);
      for (const kind in kinds) {
        const list = kinds[kind];
        const def = defs[kind];
        if (def) {
          const mesh = new THREE.InstancedMesh(def.geo, def.mat, list.length);
          mesh.castShadow = def.shadow; mesh.receiveShadow = true;
          list.forEach((e, n) => {
            _p.set(e.x, e.y, e.z);
            _q.setFromAxisAngle(_up, e.r || 0);
            if (kind === 'hvac') _s.set(e.w, e.h, e.d);
            else if (kind === 'antenna') _s.set(1, e.h, 1);
            else _s.setScalar(e.s || 1);
            mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
            if (def.collide) {
              const [cw, ch, cd] = def.collide;
              const sc = e.s || 1;
              this.grid.add(e.x - cw * sc / 2, e.y, e.z - cd * sc / 2,
                            e.x + cw * sc / 2, e.y + ch * sc, e.z + cd * sc / 2, 1, null);
            }
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
          sector.detail.add(mesh);
        } else if (kind === 'beacon') {
          const g = new THREE.SphereGeometry(0.42, 8, 6);
          const mesh = new THREE.InstancedMesh(g, glowMaterial(0xff2e40, 1), list.length);
          list.forEach((e, n) => {
            _p.set(e.x, e.y, e.z); _q.identity(); _s.setScalar(1);
            mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
          });
          mesh.instanceMatrix.needsUpdate = true;
          mesh.userData.blink = true;
          sector.props.add(mesh);
        } else if (kind === 'heli') {
          const g = new THREE.CircleGeometry(7.5, 24); g.rotateX(-Math.PI / 2);
          const mesh = new THREE.InstancedMesh(g, heliMat, list.length);
          list.forEach((e, n) => {
            _p.set(e.x, e.y, e.z); _q.identity(); _s.setScalar(1);
            mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
          });
          mesh.instanceMatrix.needsUpdate = true;
          sector.props.add(mesh);
        } else if (kind === 'escape') {
          this.buildFireEscapes(sector, list);
        }
      }
    }
  }

  buildFireEscapes(sector, list) {
    const platGeo = new THREE.BoxGeometry(3.2, 0.12, 1.5);
    const railGeo = new THREE.BoxGeometry(3.2, 0.9, 0.08);
    const ladGeo = new THREE.BoxGeometry(0.7, 3.0, 0.08);
    const mat = paintedMetal(0x2e2a26, 0.72, 0.85);
    const plats = [], rails = [], lads = [];
    for (const e of list) {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]][e.side];
      const nx = dirs[0], nz = dirs[1];
      const px = e.x + nx * (nx ? e.w / 2 : 0);
      const pz = e.z + nz * (nz ? e.d / 2 : 0);
      const rot = Math.atan2(nx, nz);
      for (let y = 5.2; y < e.h; y += 3.9) {
        plats.push([px + nx * 0.75, y, pz + nz * 0.75, rot]);
        rails.push([px + nx * 1.45, y + 0.5, pz + nz * 1.45, rot]);
        lads.push([px + nx * 1.0, y - 1.5, pz + nz * 1.0, rot]);
      }
    }
    const mk = (geo, arr) => {
      if (!arr.length) return;
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      im.castShadow = true;
      arr.forEach((a, n) => {
        _p.set(a[0], a[1], a[2]); _q.setFromAxisAngle(_up, a[3]); _s.setScalar(1);
        im.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      sector.detail.add(im);
    };
    mk(platGeo, plats); mk(railGeo, rails); mk(ladGeo, lads);
  }

  /* ------------------------------------------------------------- signage */
  buildSignage() {
    const rng = this.rng;
    const NEON_VARIANTS = 14, BILL_VARIANTS = 8;
    const neonTex = [], billTex = [];
    for (let i = 0; i < NEON_VARIANTS; i++) neonTex.push(makeNeonSign(i + 1));
    for (let i = 0; i < BILL_VARIANTS; i++) billTex.push(makeBillboard(i + 1));

    const neonBuckets = Array.from({ length: NEON_VARIANTS }, () => []);
    const billBuckets = Array.from({ length: BILL_VARIANTS }, () => []);

    for (const b of this.layout.buildings) {
      if (b.neon) {
        const v = rng.int(0, NEON_VARIANTS - 1);
        const side = rng.int(0, 3);
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]][side];
        const seg = b.segments[0];
        const w = dirs[0] ? seg.d : seg.w;
        const ox = dirs[0] * (seg.w / 2 + 0.35), oz = dirs[1] * (seg.d / 2 + 0.35);
        neonBuckets[v].push({
          x: b.x + ox, y: rng.range(5.5, Math.min(16, b.height - 2)), z: b.z + oz,
          rot: Math.atan2(dirs[0], dirs[1]), w: Math.min(w * 0.65, 7.5), h: 2.4,
        });
        this.neonLights.push({ x: b.x + ox * 1.4, y: 8, z: b.z + oz * 1.4,
          color: new THREE.Color(neonTex[v].color).getHex(), kind: 'neon' });
      }
      if (b.billboard) {
        const v = rng.int(0, BILL_VARIANTS - 1);
        const side = rng.int(0, 3);
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]][side];
        const seg = b.segments[b.segments.length - 1];
        const w = Math.min(dirs[0] ? seg.d : seg.w, 26) * 0.85;
        billBuckets[v].push({
          x: b.x + dirs[0] * (seg.w / 2 + 0.5),
          y: b.height - rng.range(4, 12),
          z: b.z + dirs[1] * (seg.d / 2 + 0.5),
          rot: Math.atan2(dirs[0], dirs[1]), w, h: w * 0.56,
        });
      }
    }

    const quad = new THREE.PlaneGeometry(1, 1);
    neonBuckets.forEach((list, v) => {
      if (!list.length) return;
      const mat = new THREE.MeshBasicMaterial({
        map: neonTex[v].texture, transparent: true, toneMapped: false,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const im = new THREE.InstancedMesh(quad, mat, list.length);
      im.frustumCulled = true;
      list.forEach((e, n) => {
        _p.set(e.x, e.y, e.z); _q.setFromAxisAngle(_up, e.rot); _s.set(e.w, e.h, 1);
        im.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.userData.neon = true;
      im.renderOrder = 3;
      this.root.add(im);
    });

    billBuckets.forEach((list, v) => {
      if (!list.length) return;
      const mat = new THREE.MeshStandardMaterial({
        map: billTex[v], emissive: 0xffffff, emissiveMap: billTex[v],
        emissiveIntensity: 0.35, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide,
      });
      const im = new THREE.InstancedMesh(quad, mat, list.length);
      im.castShadow = true;
      list.forEach((e, n) => {
        _p.set(e.x, e.y, e.z); _q.setFromAxisAngle(_up, e.rot); _s.set(e.w, e.h, 1);
        im.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.userData.billboard = true;
      this.root.add(im);
      this.billboards = this.billboards || [];
      this.billboards.push(im);
    });
  }

  /* --------------------------------------------------------------- parks */
  buildParks() {
    const parks = this.layout.blocks.filter((b) => b.district === DISTRICT.PARK);
    if (!parks.length) return;
    const size = this.layout.blockSize + WORLD.sidewalkWidth * 2;
    const gmat = grassMaterial();
    for (const k of ['map', 'normalMap']) if (gmat[k]) gmat[k].repeat.set(size / 6, size / 6);
    const gGeo = new THREE.PlaneGeometry(1, 1); gGeo.rotateX(-Math.PI / 2);
    const grass = new THREE.InstancedMesh(gGeo, gmat, parks.length);
    grass.receiveShadow = true;
    parks.forEach((b, n) => {
      _p.set(b.cx, 0.25, b.cz); _q.identity(); _s.set(size, 1, size);
      grass.setMatrixAt(n, _m.compose(_p, _q, _s));
    });
    grass.instanceMatrix.needsUpdate = true;
    this.root.add(grass);

    // Trees: trunk + two canopy blobs, instanced, plus street trees along sidewalks.
    const trunk = new THREE.CylinderGeometry(0.24, 0.34, 3.4, 6); trunk.translate(0, 1.7, 0);
    const c1 = new THREE.IcosahedronGeometry(1.9, 1); c1.translate(0, 4.3, 0);
    const c2 = new THREE.IcosahedronGeometry(1.35, 1); c2.translate(0.8, 5.4, -0.4);
    const treeTrunk = trunk;
    const canopy = mergeGeos([c1, c2]);
    const trunkMat = paintedMetal(0x4a3a2c, 0.95, 0.0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f4a1e, roughness: 0.92, flatShading: true });

    const trees = [];
    for (const b of parks) for (const t of b.park.trees) trees.push(t);
    // street trees
    const rng = this.rng;
    for (const b of this.layout.blocks) {
      if (b.district === DISTRICT.WATER || b.district === DISTRICT.PARK) continue;
      if (b.district === DISTRICT.INDUSTRIAL) continue;
      const h = this.layout.blockSize * 0.5 + 2.2;
      for (let k = -2; k <= 2; k++) {
        if (rng.chance(0.45)) trees.push({ x: b.cx + k * 18, z: b.cz + h, s: rng.range(0.7, 1.05), r: rng() * 6.3 });
        if (rng.chance(0.45)) trees.push({ x: b.cx + k * 18, z: b.cz - h, s: rng.range(0.7, 1.05), r: rng() * 6.3 });
        if (rng.chance(0.45)) trees.push({ x: b.cx + h, z: b.cz + k * 18, s: rng.range(0.7, 1.05), r: rng() * 6.3 });
        if (rng.chance(0.45)) trees.push({ x: b.cx - h, z: b.cz + k * 18, s: rng.range(0.7, 1.05), r: rng() * 6.3 });
      }
    }

    const mkTree = (geo, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, trees.length);
      im.castShadow = true; im.receiveShadow = true;
      trees.forEach((t, n) => {
        _p.set(t.x, 0.22, t.z); _q.setFromAxisAngle(_up, t.r || 0); _s.setScalar(t.s || 1);
        im.setMatrixAt(n, _m.compose(_p, _q, _s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.root.add(im);
      return im;
    };
    mkTree(treeTrunk, trunkMat);
    this.canopyMesh = mkTree(canopy, leafMat);
  }

  /* ---------------------------------------------------------- waterfront */
  buildWaterfront() {
    const L = this.layout;
    const edge = L.waterEdgeX;
    const span = L.size * L.cell * 3;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(span, span, 1, 1), waterMaterial());
    water.rotation.x = -Math.PI / 2;
    water.position.set(edge + span * 0.5 - 40, WORLD.waterLevel, 0);
    water.renderOrder = 1;
    this.root.add(water);
    this.water = water;

    // Quay wall + a suspension bridge running east off the docks.
    const quay = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, span * 0.35),
      paintedMetal(0x565049, 0.95, 0.0));
    quay.position.set(edge - 3, -1.6, 0);
    quay.castShadow = true; quay.receiveShadow = true;
    this.root.add(quay);
    this.grid.add(edge - 6, -4, -span * 0.175, edge, 0.4, span * 0.175, 1, null);

    const deckLen = 340, deckW = 26;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckLen, 1.4, deckW), roadMaterial());
    deck.position.set(edge + deckLen / 2, 14, 0);
    deck.castShadow = true; deck.receiveShadow = true;
    this.root.add(deck);
    this.grid.add(edge, 12.6, -deckW / 2, edge + deckLen, 14.7, deckW / 2, 1, null);

    const towerMat = paintedMetal(0x7d3630, 0.72, 0.35);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.9 });
    for (const tx of [edge + deckLen * 0.28, edge + deckLen * 0.72]) {
      for (const tz of [-deckW / 2, deckW / 2]) {
        const tw = new THREE.Mesh(new THREE.BoxGeometry(4, 62, 4), towerMat);
        tw.position.set(tx, 14 + 31, tz); tw.castShadow = true;
        this.root.add(tw);
        this.grid.add(tx - 2, 14, tz - 2, tx + 2, 76, tz + 2, 1, null);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, deckW + 4), towerMat);
      cross.position.set(tx, 68, 0); cross.castShadow = true;
      this.root.add(cross);
    }
    // Catenary main cables + vertical hangers
    for (const tz of [-deckW / 2, deckW / 2]) {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const x = edge + t * deckLen;
        const s = Math.abs(t - 0.5) * 2;
        const y = 14 + 8 + (1 - s * s) * 0 + 46 * (0.35 + 0.65 * s * s);
        pts.push(new THREE.Vector3(x, y, tz));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.32, 6, false), cableMat);
      tube.castShadow = true;
      this.root.add(tube);
      for (let t = 0.06; t < 0.95; t += 0.05) {
        const p = curve.getPoint(t);
        const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, p.y - 14.8, 4), cableMat);
        hang.position.set(p.x, (p.y + 14.8) / 2, tz);
        this.root.add(hang);
      }
    }
    this.bridge = { x: edge + deckLen / 2, y: 14, z: 0, length: deckLen };
  }

  /* ------------------------------------------------------------ finalise */
  finalise() {
    // Street furniture: lamps, traffic lights, hydrants, subway entrances, bins.
    const L = this.layout, rng = this.rng;
    const lampPos = [], lightPos = [], hydrants = [], bins = [], subways = [], shelters = [];
    const half = L.blockSize * 0.5 + WORLD.sidewalkWidth - 1.2;

    for (const b of L.blocks) {
      if (b.district === DISTRICT.WATER) continue;
      for (let k = -1; k <= 1; k++) {
        lampPos.push([b.cx + k * 30, b.cz + half, Math.PI]);
        lampPos.push([b.cx + k * 30, b.cz - half, 0]);
        lampPos.push([b.cx + half, b.cz + k * 30, -Math.PI / 2]);
        lampPos.push([b.cx - half, b.cz + k * 30, Math.PI / 2]);
      }
      if (rng.chance(0.5)) hydrants.push([b.cx + rng.range(-half, half), b.cz + (rng.chance(0.5) ? half : -half)]);
      if (rng.chance(0.7)) bins.push([b.cx + rng.range(-half, half), b.cz + (rng.chance(0.5) ? half : -half)]);
      if (rng.chance(0.16) && b.district !== DISTRICT.INDUSTRIAL) {
        subways.push([b.cx + rng.range(-20, 20), b.cz + (rng.chance(0.5) ? half : -half), rng.int(0, 3) * Math.PI / 2]);
      }
      if (rng.chance(0.3)) shelters.push([b.cx + rng.range(-24, 24), b.cz + (rng.chance(0.5) ? half + 1 : -half - 1), rng.chance(0.5) ? 0 : Math.PI]);
    }
    for (const it of L.intersections) {
      lightPos.push([it.x + 9, it.z + 9, Math.PI * 0.75]);
      lightPos.push([it.x - 9, it.z - 9, -Math.PI * 0.25]);
    }

    /* lamp: post + arm + head */
    const lampGeo = (() => {
      const post = new THREE.CylinderGeometry(0.13, 0.19, 8.2, 7); post.translate(0, 4.1, 0);
      const arm = new THREE.BoxGeometry(0.14, 0.14, 2.0); arm.translate(0, 8.05, 1.0);
      const head = new THREE.BoxGeometry(0.5, 0.26, 1.15); head.translate(0, 7.9, 1.95);
      return mergeGeos([post, arm, head]);
    })();
    const lampMat = paintedMetal(0x30322f, 0.6, 0.75);
    const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lampPos.length);
    lampMesh.castShadow = true;
    const bulbGeo = new THREE.PlaneGeometry(0.85, 1.5); bulbGeo.rotateX(-Math.PI / 2);
    const bulbMesh = new THREE.InstancedMesh(bulbGeo, glowMaterial(0xffd9a0, 0.95), lampPos.length);
    lampPos.forEach((l, n) => {
      _q.setFromAxisAngle(_up, l[2]); _s.setScalar(1);
      _p.set(l[0], 0.22, l[1]);
      lampMesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      const fx = Math.sin(l[2]) * 1.95, fz = Math.cos(l[2]) * 1.95;
      _p.set(l[0] + fx, 7.72, l[1] + fz);
      bulbMesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      this.streetLamps.push({ x: l[0] + fx, y: 7.7, z: l[1] + fz });
    });
    lampMesh.instanceMatrix.needsUpdate = true;
    bulbMesh.instanceMatrix.needsUpdate = true;
    bulbMesh.userData.nightOnly = true;
    lampMesh.frustumCulled = false; bulbMesh.frustumCulled = false;
    this.root.add(lampMesh); this.root.add(bulbMesh);
    this.lampGlow = bulbMesh;

    /* traffic lights */
    const tlGeo = (() => {
      const post = new THREE.CylinderGeometry(0.12, 0.16, 5.6, 6); post.translate(0, 2.8, 0);
      const arm = new THREE.BoxGeometry(0.12, 0.12, 2.6); arm.translate(0, 5.5, 1.3);
      const box = new THREE.BoxGeometry(0.45, 1.25, 0.42); box.translate(0, 5.0, 2.5);
      return mergeGeos([post, arm, box]);
    })();
    const tlMesh = new THREE.InstancedMesh(tlGeo, paintedMetal(0x25282a, 0.6, 0.6), lightPos.length);
    tlMesh.castShadow = true;
    const lensGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const lensR = new THREE.InstancedMesh(lensGeo, glowMaterial(0xff2b2b), lightPos.length);
    const lensG = new THREE.InstancedMesh(lensGeo, glowMaterial(0x35ff7a), lightPos.length);
    lightPos.forEach((l, n) => {
      _q.setFromAxisAngle(_up, l[2]); _s.setScalar(1); _p.set(l[0], 0.22, l[1]);
      tlMesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      const fx = Math.sin(l[2]) * 2.5, fz = Math.cos(l[2]) * 2.5;
      _p.set(l[0] + fx, 5.62, l[1] + fz); lensR.setMatrixAt(n, _m.compose(_p, _q, _s));
      _p.set(l[0] + fx, 5.0 - 0.42, l[1] + fz); lensG.setMatrixAt(n, _m.compose(_p, _q, _s));
      this.trafficLights.push({ x: l[0], z: l[1], phase: (Math.abs(Math.round(l[0] / L.cell)) % 2) });
    });
    [tlMesh, lensR, lensG].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; this.root.add(m); });
    this.tlRed = lensR; this.tlGreen = lensG;

    /* small props */
    const hydGeo = (() => {
      const b = new THREE.CylinderGeometry(0.19, 0.23, 0.82, 8); b.translate(0, 0.41, 0);
      const c = new THREE.SphereGeometry(0.2, 8, 6); c.translate(0, 0.86, 0);
      const a1 = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6); a1.rotateZ(Math.PI / 2); a1.translate(0, 0.55, 0);
      return mergeGeos([b, c, a1]);
    })();
    this.instanceList(hydGeo, paintedMetal(0xb0392f, 0.6, 0.25), hydrants, 0.22, true);

    const binGeo = (() => {
      const b = new THREE.CylinderGeometry(0.42, 0.36, 1.0, 10); b.translate(0, 0.5, 0);
      const bag = new THREE.IcosahedronGeometry(0.42, 0); bag.scale(1.2, 0.8, 1); bag.translate(0.9, 0.35, 0.2);
      return mergeGeos([b, bag]);
    })();
    this.instanceList(binGeo, paintedMetal(0x35383a, 0.85, 0.2), bins, 0.22, true);

    const shelterGeo = (() => {
      const roof = new THREE.BoxGeometry(4.2, 0.14, 1.7); roof.translate(0, 2.5, 0);
      const back = new THREE.BoxGeometry(4.2, 2.2, 0.08); back.translate(0, 1.4, -0.8);
      const p1 = new THREE.BoxGeometry(0.12, 2.5, 0.12); p1.translate(-2.0, 1.25, 0.8);
      const p2 = new THREE.BoxGeometry(0.12, 2.5, 0.12); p2.translate(2.0, 1.25, 0.8);
      const bench = new THREE.BoxGeometry(3.6, 0.1, 0.5); bench.translate(0, 0.55, -0.5);
      return mergeGeos([roof, back, p1, p2, bench]);
    })();
    this.instanceList(shelterGeo, paintedMetal(0x3a4045, 0.5, 0.7), shelters, 0.22, true, true);

    const subGeo = (() => {
      const rail = new THREE.BoxGeometry(3.6, 1.0, 0.1); rail.translate(0, 0.5, -1.3);
      const r2 = new THREE.BoxGeometry(0.1, 1.0, 2.6); r2.translate(-1.75, 0.5, 0);
      const r3 = new THREE.BoxGeometry(0.1, 1.0, 2.6); r3.translate(1.75, 0.5, 0);
      const hole = new THREE.BoxGeometry(3.4, 0.1, 2.4); hole.translate(0, 0.02, 0);
      return mergeGeos([rail, r2, r3, hole]);
    })();
    this.instanceList(subGeo, paintedMetal(0x1d2124, 0.7, 0.5), subways, 0.24, true, true);

    // Sector bounding info for LOD
    for (const s of this.sectors) {
      s.radius = this.layout.cell * SECTOR_BLOCKS * 0.8 + s.maxHeight * 0.35;
    }
  }

  instanceList(geo, mat, list, y = 0.22, shadow = false, useRot = false) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.castShadow = shadow; im.receiveShadow = true;
    list.forEach((e, n) => {
      _p.set(e[0], y, e[1]);
      _q.setFromAxisAngle(_up, useRot ? (e[2] || 0) : 0);
      _s.setScalar(1);
      im.setMatrixAt(n, _m.compose(_p, _q, _s));
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    this.root.add(im);
    return im;
  }

  /* ------------------------------------------------------------ runtime */
  /** Distance LOD + culling. Called every frame with the camera position. */
  updateLOD(camPos, drawDistance) {
    for (const s of this.sectors) {
      const d = Math.hypot(s.cx - camPos.x, s.cz - camPos.z) - s.radius;
      let lod = 0;
      if (d > drawDistance) lod = 3;
      else if (d > 620) lod = 2;
      else if (d > 260) lod = 1;
      if (lod === s.lod) continue;
      s.lod = lod;
      s.group.visible = lod < 3;
      s.detail.visible = lod === 0;
      s.props.visible = lod <= 1;
      s.group.traverse((o) => {
        if (o.isInstancedMesh) o.castShadow = lod === 0 && o.userData.noShadow !== true;
      });
    }
  }
}

/* -------------------------------------------------------------- geometry */
/** Minimal merge — avoids pulling in BufferGeometryUtils for a handful of props. */
export function mergeGeos(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const u = g.attributes.uv ? g.attributes.uv.array : null;
    const c = g.attributes.position.count;
    pos.set(p, vo * 3); nor.set(n, vo * 3);
    if (u) uv.set(u, vo * 2);
    if (g.index) {
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      io += gi.length;
    } else {
      for (let i = 0; i < c; i++) idx[io + i] = i + vo;
      io += c;
    }
    vo += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
