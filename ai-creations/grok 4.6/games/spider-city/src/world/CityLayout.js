/* world/CityLayout.js
   Pure data. No THREE objects, no meshes — just the plan of the city.

   Generating the layout separately from the geometry means the minimap, the
   mission system, traffic routing, NPC sidewalk graphs and the streaming system
   all read from the same authoritative description, and the whole city is
   reproducible from a single integer seed.

   Districts are art-directed (hand-placed regions, hand-tuned height curves)
   and only the fine grain — lot subdivision, setbacks, styles — is procedural. */

import { makeRng, clamp, lerp, fbm2, smoothstep } from '../core/MathUtils.js';
import { WORLD } from '../core/Settings.js';

export const DISTRICT = {
  DOWNTOWN: 'downtown',
  FINANCIAL: 'financial',
  MIDTOWN: 'midtown',
  RESIDENTIAL: 'residential',
  INDUSTRIAL: 'industrial',
  PARK: 'park',
  WATERFRONT: 'waterfront',
  WATER: 'water',
};

const DISTRICT_STYLE = {
  downtown:    ['glassTower', 'glassBlue', 'officeStone', 'concreteMod', 'artDeco'],
  financial:   ['glassTower', 'glassBlue', 'artDeco', 'officeStone'],
  midtown:     ['officeStone', 'concreteMod', 'artDeco', 'brickRed', 'glassBlue'],
  residential: ['brickWalkup', 'brickRed', 'brickWalkup', 'officeStone'],
  industrial:  ['industrial', 'warehouse', 'concreteMod'],
  waterfront:  ['warehouse', 'industrial', 'brickRed', 'concreteMod'],
  park:        ['brickWalkup'],
};

/* Height profile per district: [min, max] floors, and how strongly the
   distance-to-centre falloff applies. This is what draws the skyline. */
const HEIGHT_PROFILE = {
  downtown:    { min: 14, max: 62, falloff: 0.55, towerChance: 0.42 },
  financial:   { min: 12, max: 54, falloff: 0.6,  towerChance: 0.36 },
  midtown:     { min: 7,  max: 26, falloff: 0.5,  towerChance: 0.12 },
  residential: { min: 3,  max: 9,  falloff: 0.25, towerChance: 0.03 },
  industrial:  { min: 2,  max: 6,  falloff: 0.1,  towerChance: 0.02 },
  waterfront:  { min: 2,  max: 8,  falloff: 0.15, towerChance: 0.04 },
  park:        { min: 0,  max: 0,  falloff: 0,    towerChance: 0 },
};

export const FLOOR_HEIGHT = 3.9;

export class CityLayout {
  constructor(size = 15, seed = WORLD.seed) {
    this.size = size;
    this.seed = seed;
    this.rng = makeRng(seed);
    this.cell = WORLD.cell;
    this.blockSize = WORLD.blockSize;
    this.roadWidth = WORLD.roadWidth;
    this.half = (size - 1) / 2;
    this.extent = size * this.cell * 0.5;

    this.blocks = [];        // {i,j,cx,cz,district}
    this.buildings = [];     // {x,z,w,d,style,variant,segments[],height,district,id}
    this.landmarks = [];
    this.pois = [];          // map + mission anchors
    this.intersections = [];
    this.roadsX = [];        // world Z of each east-west road centre
    this.roadsZ = [];        // world X of each north-south road centre
    this.crossings = [];

    this.generate();
  }

  /* ------------------------------------------------------------- helpers */
  blockCenter(i, j) {
    return { x: (i - this.half) * this.cell, z: (j - this.half) * this.cell };
  }
  /** Normalised distance from city centre, 0 at core, 1 at the rim. */
  coreDist(i, j) {
    const dx = (i - this.half) / this.half, dz = (j - this.half) / this.half;
    return Math.min(1, Math.hypot(dx, dz) / 1.05);
  }

  districtAt(i, j) {
    const N = this.size;
    // Eastern two columns are the river / harbour.
    if (i >= N - 2) return DISTRICT.WATER;
    if (i === N - 3) return DISTRICT.WATERFRONT;

    // Central park: a 2x3 rectangle north-west of centre.
    const pi = Math.floor(N * 0.24), pj = Math.floor(N * 0.20);
    if (i >= pi && i <= pi + 1 && j >= pj && j <= pj + 2) return DISTRICT.PARK;

    const d = this.coreDist(i, j);
    const nx = i / (N - 1), nz = j / (N - 1);

    if (d < 0.30) return DISTRICT.DOWNTOWN;
    if (d < 0.50 && nx > 0.45 && nz < 0.5) return DISTRICT.FINANCIAL;
    if (nz > 0.70 && nx > 0.52) return DISTRICT.INDUSTRIAL;
    if (nz > 0.62 || nx < 0.28) return DISTRICT.RESIDENTIAL;
    return DISTRICT.MIDTOWN;
  }

  /* ---------------------------------------------------------- generation */
  generate() {
    const N = this.size, rng = this.rng;

    for (let i = 0; i < N; i++) {
      this.roadsZ.push((i - this.half) * this.cell - this.cell * 0.5);
      this.roadsX.push((i - this.half) * this.cell - this.cell * 0.5);
    }
    this.roadsZ.push((N - 1 - this.half) * this.cell + this.cell * 0.5);
    this.roadsX.push((N - 1 - this.half) * this.cell + this.cell * 0.5);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const { x, z } = this.blockCenter(i, j);
        const district = this.districtAt(i, j);
        const block = { i, j, cx: x, cz: z, district, lots: [] };
        this.blocks.push(block);
        if (district === DISTRICT.WATER) continue;
        if (district === DISTRICT.PARK) { this.makeParkBlock(block); continue; }
        this.subdivideBlock(block);
      }
    }

    for (const rx of this.roadsZ) for (const rz of this.roadsX) this.intersections.push({ x: rx, z: rz });

    this.placeLandmarks();
    this.placePOIs();
  }

  /** Split a block into lots and raise a building on each. */
  subdivideBlock(block) {
    const rng = this.rng;
    const B = this.blockSize;
    const prof = HEIGHT_PROFILE[block.district];
    const styles = DISTRICT_STYLE[block.district];
    const d = this.coreDist(block.i, block.j);

    // How many lots — dense districts get fewer, larger footprints.
    let cols, rows;
    switch (block.district) {
      case DISTRICT.DOWNTOWN:
      case DISTRICT.FINANCIAL:
        cols = rng.chance(0.55) ? 1 : 2; rows = cols === 1 ? (rng.chance(0.6) ? 1 : 2) : rng.int(1, 2); break;
      case DISTRICT.MIDTOWN:
        cols = rng.int(2, 3); rows = rng.int(2, 3); break;
      case DISTRICT.RESIDENTIAL:
        cols = rng.int(3, 4); rows = rng.int(3, 4); break;
      default:
        cols = rng.int(1, 2); rows = rng.int(1, 2);
    }

    const gap = 1.4;
    const lotW = (B - gap * (cols - 1)) / cols;
    const lotD = (B - gap * (rows - 1)) / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // A few lots stay empty: plazas, lots under construction, parking.
        const emptyChance = block.district === DISTRICT.RESIDENTIAL ? 0.06 : 0.10;
        const x = block.cx - B / 2 + lotW / 2 + c * (lotW + gap);
        const z = block.cz - B / 2 + lotD / 2 + r * (lotD + gap);
        if (rng.chance(emptyChance)) {
          block.lots.push({ x, z, w: lotW, d: lotD, empty: true,
            kind: rng.chance(0.45) ? 'construction' : 'plaza' });
          continue;
        }
        const inset = rng.range(1.5, 4.0);
        const w = Math.max(9, lotW - inset), dd = Math.max(9, lotD - inset);
        const b = this.makeBuilding(x, z, w, dd, block, prof, styles, d);
        block.lots.push({ x, z, w: lotW, d: lotD, building: b });
      }
    }
  }

  makeBuilding(x, z, w, d, block, prof, styles, coreDist) {
    const rng = this.rng;
    // Height: profile range, pulled down away from the core, roughened by fbm
    // so neighbouring towers don't step in an obvious pattern.
    const noise = fbm2(x * 0.0055 + 11.3, z * 0.0055 - 4.7, 4);
    const fall = 1 - prof.falloff * smoothstep(coreDist);
    let floors = Math.round(lerp(prof.min, prof.max, Math.pow(noise, 1.35)) * fall);
    if (rng.chance(prof.towerChance)) floors = Math.round(floors * rng.range(1.3, 1.85));
    floors = clamp(floors, 2, 78);

    const style = rng.pick(styles);
    const variant = rng.int(0, 2);
    const height = floors * FLOOR_HEIGHT;

    // Setbacks — the thing that separates a skyline from a bar chart.
    const segments = [];
    let sy = 0, sw = w, sd = d, remaining = height;
    const nSeg = height > 120 ? rng.int(2, 3) : height > 55 ? rng.int(1, 2) : 1;
    for (let s = 0; s < nSeg; s++) {
      const last = s === nSeg - 1;
      const h = last ? remaining : remaining * rng.range(0.42, 0.68);
      segments.push({ y: sy, h, w: sw, d: sd });
      sy += h; remaining -= h;
      const shrink = rng.range(0.72, 0.9);
      sw = Math.max(6, sw * shrink); sd = Math.max(6, sd * shrink);
    }

    const b = {
      id: this.buildings.length,
      x, z, w, d, height, floors, style, variant, segments,
      district: block.district,
      i: block.i, j: block.j,
      // roof furniture flags — filled here so the prop system is a pure consumer
      roof: {
        tanks: rng.chance(block.district === DISTRICT.RESIDENTIAL ? 0.75 : 0.4) ? rng.int(1, 2) : 0,
        hvac: rng.int(1, 5),
        antenna: rng.chance(height > 90 ? 0.8 : 0.28),
        dish: rng.chance(0.35) ? rng.int(1, 3) : 0,
        heliport: height > 165 && rng.chance(0.35),
        beacon: height > 110,
        stair: rng.chance(0.8),
        ac: rng.int(0, 3),
      },
      fireEscape: block.district === DISTRICT.RESIDENTIAL && rng.chance(0.65),
      billboard: (block.district === DISTRICT.DOWNTOWN || block.district === DISTRICT.MIDTOWN)
        && height > 40 && rng.chance(0.22),
      neon: (block.district !== DISTRICT.INDUSTRIAL) && rng.chance(0.42),
      crane: false,
    };
    this.buildings.push(b);
    return b;
  }

  makeParkBlock(block) {
    const rng = this.rng;
    block.park = {
      trees: [], benches: [], paths: [],
    };
    const B = this.blockSize * 0.5;
    const count = 26;
    for (let n = 0; n < count; n++) {
      block.park.trees.push({
        x: block.cx + rng.range(-B, B),
        z: block.cz + rng.range(-B, B),
        s: rng.range(0.75, 1.5),
        r: rng.range(0, Math.PI * 2),
      });
    }
    for (let n = 0; n < 6; n++) {
      block.park.benches.push({
        x: block.cx + rng.range(-B, B), z: block.cz + rng.range(-B, B), r: rng.range(0, Math.PI * 2),
      });
    }
  }

  /* --------------------------------------------------------- landmarks */
  placeLandmarks() {
    // Hand-place the few structures the player will navigate by.
    const tallest = [...this.buildings].sort((a, b) => b.height - a.height).slice(0, 6);
    const names = ['ARACHNID SPIRE', 'MERIDIAN TOWER', 'KRONOS PLAZA', 'THE OBELISK', 'HELIX CENTER', 'ATLAS ONE'];
    tallest.forEach((b, k) => {
      b.landmark = names[k];
      b.roof.beacon = true;
      b.roof.antenna = true;
      this.landmarks.push({ name: names[k], x: b.x, z: b.z, y: b.height, building: b });
    });

    // Construction sites get cranes.
    let cranes = 0;
    for (const blk of this.blocks) {
      for (const lot of blk.lots) {
        if (lot.empty && lot.kind === 'construction' && cranes < 7) {
          lot.crane = true; cranes++;
          this.pois.push({ type: 'landmark', name: 'Construction Site', x: lot.x, z: lot.z, y: 0 });
        }
      }
    }
  }

  placePOIs() {
    const rng = this.rng;
    const roofs = this.buildings.filter((b) => b.height > 30);

    // Fast-travel: one per district, on a landmark roof or a tall roof.
    const seen = new Set();
    for (const b of [...this.buildings].sort((a, b2) => b2.height - a.height)) {
      if (seen.has(b.district) || b.district === DISTRICT.PARK) continue;
      seen.add(b.district);
      this.pois.push({
        type: 'fasttravel', name: districtLabel(b.district), x: b.x, y: b.height + 1.2, z: b.z,
      });
    }

    // Collectibles: hidden backpacks on random mid-height roofs and in alleys.
    for (let n = 0; n < 24; n++) {
      const b = rng.pick(roofs);
      if (!b) break;
      this.pois.push({
        type: 'collectible', name: 'Field Cache', id: 'cache' + n,
        x: b.x + rng.range(-b.w * 0.3, b.w * 0.3),
        y: b.height + 0.6,
        z: b.z + rng.range(-b.d * 0.3, b.d * 0.3),
      });
    }

    // Rooftop time-trial start points.
    for (let n = 0; n < 5; n++) {
      const b = rng.pick(roofs);
      if (!b) break;
      this.pois.push({ type: 'timetrial', name: 'Skyline Run ' + (n + 1), id: 'tt' + n, x: b.x, y: b.height + 0.4, z: b.z });
    }

    // Street-level crime hotspots (used by the world-event director).
    for (const blk of this.blocks) {
      if (blk.district === DISTRICT.WATER || blk.district === DISTRICT.PARK) continue;
      if (rng.chance(0.14)) {
        this.pois.push({ type: 'crimespot', x: blk.cx + rng.range(-30, 30), y: 0, z: blk.cz + rng.range(-30, 30) });
      }
    }
  }

  /* ------------------------------------------------------------ queries */
  get waterEdgeX() { return (this.size - 2.5 - this.half) * this.cell; }

  /** Roads are the negative space between blocks. */
  isRoad(x, z) {
    const half = this.blockSize * 0.5;
    const off = this.cell * 0.5;
    const fx = Math.abs(((x + this.extent + off) % this.cell) - off);
    const fz = Math.abs(((z + this.extent + off) % this.cell) - off);
    return fx > half || fz > half;
  }

  /** Nearest road-lane centre line to a point — used to spawn traffic and NPCs. */
  nearestRoad(x, z) {
    let bestX = this.roadsZ[0], bd = Infinity;
    for (const r of this.roadsZ) { const d = Math.abs(r - x); if (d < bd) { bd = d; bestX = r; } }
    let bestZ = this.roadsX[0], bd2 = Infinity;
    for (const r of this.roadsX) { const d = Math.abs(r - z); if (d < bd2) { bd2 = d; bestZ = r; } }
    return { x: bestX, z: bestZ, dx: bd, dz: bd2 };
  }

  buildingsNear(x, z, radius) {
    const out = [];
    for (const b of this.buildings) {
      if (Math.abs(b.x - x) < radius && Math.abs(b.z - z) < radius) out.push(b);
    }
    return out;
  }

  /** Highest roof in a radius — cinematic camera + mission staging use this. */
  tallestNear(x, z, radius) {
    let best = null;
    for (const b of this.buildings) {
      if (Math.hypot(b.x - x, b.z - z) > radius) continue;
      if (!best || b.height > best.height) best = b;
    }
    return best;
  }
}

export function districtLabel(d) {
  return {
    downtown: 'Downtown Core', financial: 'Financial District', midtown: 'Midtown',
    residential: 'Rowan Heights', industrial: 'Ironworks', park: 'Verdant Park',
    waterfront: 'East Docks', water: 'Harbour',
  }[d] || d;
}
