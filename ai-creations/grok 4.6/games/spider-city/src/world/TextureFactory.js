/* world/TextureFactory.js
   Every texture in the game is generated on the CPU at boot — no downloads,
   no CORS, no loading screens past the first two seconds. Each surface gets a
   real PBR set: albedo, a Sobel-derived normal map, a roughness map and (for
   facades) an emissive window mask that the day/night system drives.

   Textures are cached by key so 15 000 buildings share ~10 megabytes. */

import * as THREE from 'three';
import { makeRng, lerp } from '../core/MathUtils.js';

const cache = new Map();

function canvas(size, h) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h || size;
  return c;
}

function toTexture(cv, { srgb = false, aniso = 8, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* --------------------------------------------------------------- utilities */

/** Seamless splatter grime — draws every blob 9 times so it wraps at the edges. */
function wrapSplat(ctx, w, h, rng, count, rMin, rMax, color, alpha) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h, r = lerp(rMin, rMax, rng() ** 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      ctx.save();
      ctx.translate(x + ox * w, y + oy * h);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Vertical weathering streaks below ledges — the single biggest "not-a-demo" cue. */
function grimeStreaks(ctx, w, h, rng, count, alpha = 0.1) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y0 = rng() * h;
    const len = lerp(h * 0.05, h * 0.45, rng());
    const wid = lerp(1.2, 6, rng());
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, `rgba(20,18,16,${alpha * 1.6})`);
    g.addColorStop(1, 'rgba(20,18,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, wid, len);
    ctx.fillRect(x - w, y0, wid, len);
  }
}

/** Sobel a luminance canvas into a tangent-space normal map. */
function normalFromHeight(src, strength = 2.0) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const sd = sctx.getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const L = (x, y) => {
    x = (x + w) % w; y = (y + h) % h;
    const i = (y * w + x) * 4;
    return (sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = L(x - 1, y - 1), t = L(x, y - 1), tr = L(x + 1, y - 1);
      const l = L(x - 1, y), r = L(x + 1, y);
      const bl = L(x - 1, y + 1), b = L(x, y + 1), br = L(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* ================================================================ FACADES */

/**
 * Facade styles. `unit` is how many window bays fit in one texture tile —
 * the city generator scales UVs so one bay is always ~3.4 world units wide
 * and ~3.9 tall, which is what keeps buildings reading at a believable scale.
 */
export const FACADE_STYLES = {
  glassTower:   { bays: 4, floors: 4, glass: 0.92 },
  glassBlue:    { bays: 4, floors: 4, glass: 0.95 },
  officeStone:  { bays: 4, floors: 4, glass: 0.42 },
  brickWalkup:  { bays: 3, floors: 3, glass: 0.30 },
  brickRed:     { bays: 3, floors: 3, glass: 0.30 },
  concreteMod:  { bays: 4, floors: 4, glass: 0.50 },
  artDeco:      { bays: 3, floors: 4, glass: 0.38 },
  industrial:   { bays: 3, floors: 2, glass: 0.34 },
  warehouse:    { bays: 2, floors: 2, glass: 0.22 },
};

const PALETTES = {
  glassTower:  { base: ['#2b3440', '#333d4a', '#26303c'], win: ['#0d1620', '#111d29'], frame: '#4a5563', glassy: true },
  glassBlue:   { base: ['#1e2c3c', '#23344a'], win: ['#0a1622', '#0d1e2e'], frame: '#3d5570', glassy: true },
  officeStone: { base: ['#6d6a63', '#7b776e', '#615e58'], win: ['#12181e', '#161d24'], frame: '#8d887e' },
  brickWalkup: { base: ['#6b4b3c', '#5d4235', '#7a5645'], win: ['#131a20', '#1a2028'], frame: '#c9c1b4', brick: true },
  brickRed:    { base: ['#8a4130', '#7a3a2b', '#964b38'], win: ['#151b21', '#1c232b'], frame: '#ded6c8', brick: true },
  concreteMod: { base: ['#8b8b88', '#7c7c79', '#9a9a96'], win: ['#101519', '#151b21'], frame: '#a8a8a3' },
  artDeco:     { base: ['#a99a80', '#b8a98d', '#978a73'], win: ['#141a1f', '#1a2126'], frame: '#d8cbae', deco: true },
  industrial:  { base: ['#55524d', '#615d57', '#4a4743'], win: ['#1a2026', '#222a31'], frame: '#6f6a63', metal: true },
  warehouse:   { base: ['#5f5a52', '#6b665c'], win: ['#1c2228', '#242b32'], frame: '#7a746a', metal: true },
};

function drawBrick(ctx, x, y, w, h, rng, colors) {
  const bh = 5, bw = 13;
  for (let by = 0; by < h; by += bh) {
    const off = ((by / bh) | 0) % 2 ? bw / 2 : 0;
    for (let bx = -bw; bx < w + bw; bx += bw) {
      ctx.fillStyle = colors[(rng() * colors.length) | 0];
      ctx.globalAlpha = 0.55 + rng() * 0.45;
      ctx.fillRect(x + bx + off + 0.6, y + by + 0.6, bw - 1.2, bh - 1.2);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Build one facade tile set.
 * @returns {{map, normalMap, roughnessMap, emissiveMap, bays, floors}}
 */
export function makeFacade(style, seed = 1, size = 512) {
  const key = `facade:${style}:${seed}:${size}`;
  if (cache.has(key)) return cache.get(key);

  const cfg = FACADE_STYLES[style] || FACADE_STYLES.officeStone;
  const pal = PALETTES[style] || PALETTES.officeStone;
  const rng = makeRng(seed * 7919 + style.length * 131);

  const bays = cfg.bays, floors = cfg.floors;
  const cw = size / bays, ch = size / floors;

  /* -------- albedo -------- */
  const alb = canvas(size);
  const a = alb.getContext('2d');
  a.fillStyle = pal.base[0];
  a.fillRect(0, 0, size, size);

  // wall material
  if (pal.brick) {
    drawBrick(a, 0, 0, size, size, rng, pal.base);
  } else {
    for (let i = 0; i < 260; i++) {
      a.fillStyle = pal.base[(rng() * pal.base.length) | 0];
      a.globalAlpha = 0.05 + rng() * 0.12;
      const w = 20 + rng() * 90, h = 12 + rng() * 60;
      a.fillRect(rng() * size, rng() * size, w, h);
    }
    a.globalAlpha = 1;
  }

  // floor slab / spandrel bands
  for (let f = 0; f < floors; f++) {
    const y = f * ch;
    a.fillStyle = pal.frame;
    a.globalAlpha = pal.glassy ? 0.5 : 0.75;
    a.fillRect(0, y + ch - 5, size, 5);
    a.globalAlpha = 0.18;
    a.fillStyle = '#000';
    a.fillRect(0, y + ch - 1.5, size, 1.5);
    a.globalAlpha = 1;
  }

  // windows
  const winInsetX = cw * (pal.glassy ? 0.06 : 0.19);
  const winInsetY = ch * (pal.glassy ? 0.10 : 0.20);
  const winW = cw - winInsetX * 2, winH = ch - winInsetY * 2 - 4;
  const winRects = [];
  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const x = b * cw + winInsetX, y = f * ch + winInsetY;
      winRects.push([x, y, winW, winH]);
      // reveal / mullion
      a.fillStyle = pal.frame;
      a.fillRect(x - 2, y - 2, winW + 4, winH + 4);
      // glass with a raking sky gradient so it never reads flat
      const g = a.createLinearGradient(x, y, x + winW * 0.4, y + winH);
      const w0 = pal.win[0], w1 = pal.win[1] || pal.win[0];
      g.addColorStop(0, w1);
      g.addColorStop(0.45, w0);
      g.addColorStop(1, pal.glassy ? '#1b2836' : w0);
      a.fillStyle = g;
      a.fillRect(x, y, winW, winH);
      // interior clutter hint — a blind, a desk edge, a ceiling strip
      if (rng() < 0.55) {
        a.fillStyle = 'rgba(200,200,190,0.10)';
        a.fillRect(x, y, winW, winH * (0.12 + rng() * 0.3));
      }
      if (!pal.glassy && rng() < 0.35) {
        a.fillStyle = 'rgba(230,225,210,0.13)';
        a.fillRect(x + winW * 0.1, y + winH * 0.55, winW * 0.8, winH * 0.1);
      }
      // sill
      if (!pal.glassy) {
        a.fillStyle = pal.frame;
        a.globalAlpha = 0.9; a.fillRect(x - 3, y + winH + 1, winW + 6, 3); a.globalAlpha = 1;
      }
      // mullion cross
      a.fillStyle = 'rgba(0,0,0,0.35)';
      a.fillRect(x + winW * 0.5 - 0.8, y, 1.6, winH);
      if (winH > 40) a.fillRect(x, y + winH * 0.5 - 0.8, winW, 1.6);
    }
  }

  if (pal.deco) {
    a.fillStyle = 'rgba(255,240,205,0.14)';
    for (let b = 0; b <= bays; b++) a.fillRect(b * cw - 2, 0, 4, size);
  }
  if (pal.metal) {
    a.globalAlpha = 0.14; a.fillStyle = '#000';
    for (let x = 0; x < size; x += 8) a.fillRect(x, 0, 2, size);
    a.globalAlpha = 1;
  }

  // weathering
  grimeStreaks(a, size, size, rng, 26, 0.09);
  wrapSplat(a, size, size, rng, 22, 12, 70, '30,28,24', 0.07);
  // base darkening (ambient occlusion in the crevices)
  const ao = a.createLinearGradient(0, size, 0, size * 0.75);
  ao.addColorStop(0, 'rgba(0,0,0,0.30)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
  a.fillStyle = ao; a.fillRect(0, size * 0.75, size, size * 0.25);

  /* -------- height -> normal -------- */
  const hgt = canvas(size);
  const hc = hgt.getContext('2d');
  hc.fillStyle = '#8a8a8a'; hc.fillRect(0, 0, size, size);
  if (pal.brick) {
    hc.fillStyle = '#666';
    for (let by = 0; by < size; by += 5) hc.fillRect(0, by, size, 1.2);
    for (let by = 0; by < size; by += 5) {
      const off = ((by / 5) | 0) % 2 ? 6.5 : 0;
      for (let bx = 0; bx < size; bx += 13) hc.fillRect(bx + off, by, 1.2, 5);
    }
  }
  for (const [x, y, w, h] of winRects) {
    hc.fillStyle = '#d8d8d8'; hc.fillRect(x - 3, y - 3, w + 6, h + 6);  // frame proud
    hc.fillStyle = '#4a4a4a'; hc.fillRect(x, y, w, h);                   // glass recessed
    if (!pal.glassy) { hc.fillStyle = '#e8e8e8'; hc.fillRect(x - 4, y + h + 1, w + 8, 3.5); }
  }
  for (let f = 0; f < floors; f++) {
    hc.fillStyle = '#dcdcdc'; hc.fillRect(0, f * ch + ch - 6, size, 6);
  }
  if (pal.metal) { hc.fillStyle = '#9c9c9c'; for (let x = 0; x < size; x += 8) hc.fillRect(x, 0, 3, size); }

  /* -------- roughness -------- */
  const rgh = canvas(size);
  const rc = rgh.getContext('2d');
  const wallR = pal.glassy ? 0.55 : pal.brick ? 0.92 : 0.78;
  rc.fillStyle = `rgb(${(wallR * 255) | 0},${(wallR * 255) | 0},${(wallR * 255) | 0})`;
  rc.fillRect(0, 0, size, size);
  const glassR = pal.glassy ? 0.07 : 0.16;
  for (const [x, y, w, h] of winRects) {
    rc.fillStyle = `rgb(${(glassR * 255) | 0},${(glassR * 255) | 0},${(glassR * 255) | 0})`;
    rc.fillRect(x, y, w, h);
  }
  wrapSplat(rc, size, size, rng, 30, 20, 90, '255,255,255', 0.16); // dirt = rougher

  /* -------- emissive window mask (night) -------- */
  const emi = canvas(size);
  const ec = emi.getContext('2d');
  ec.fillStyle = '#000'; ec.fillRect(0, 0, size, size);
  const warm = ['#ffd9a0', '#ffe9c4', '#fff3dd', '#cfe4ff', '#a8d8ff', '#ffcf86'];
  for (const [x, y, w, h] of winRects) {
    if (rng() > 0.52) continue;                       // most windows are dark
    const c = warm[(rng() * warm.length) | 0];
    const bright = 0.35 + rng() * 0.65;
    ec.globalAlpha = bright;
    ec.fillStyle = c;
    ec.fillRect(x, y, w, h);
    // occluders inside the room so lit windows aren't flat rectangles
    ec.globalAlpha = bright * 0.55; ec.fillStyle = '#000';
    if (rng() < 0.5) ec.fillRect(x, y, w, h * (0.15 + rng() * 0.35));
    if (rng() < 0.4) ec.fillRect(x + w * (rng() * 0.6), y + h * 0.4, w * 0.25, h * 0.6);
    ec.globalAlpha = 1;
  }
  ec.globalAlpha = 1;

  const aniso = 8;
  const set = {
    map: toTexture(alb, { srgb: true, aniso }),
    normalMap: toTexture(normalFromHeight(hgt, 1.9), { aniso }),
    roughnessMap: toTexture(rgh, { aniso }),
    emissiveMap: toTexture(emi, { srgb: true, aniso }),
    bays, floors,
  };
  cache.set(key, set);
  return set;
}

/* ============================================================ GROUND SETS */

export function makeAsphalt(seed = 3) {
  const key = 'asphalt' + seed;
  if (cache.has(key)) return cache.get(key);
  const size = 512, rng = makeRng(seed);
  const alb = canvas(size), a = alb.getContext('2d');
  a.fillStyle = '#26272a'; a.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const v = 26 + rng() * 44;
    a.fillStyle = `rgba(${v},${v},${v + 2},${0.25 + rng() * 0.5})`;
    a.fillRect(rng() * size, rng() * size, 1 + rng() * 2.6, 1 + rng() * 2.6);
  }
  wrapSplat(a, size, size, rng, 26, 30, 130, '18,18,20', 0.22);
  wrapSplat(a, size, size, rng, 14, 20, 60, '120,118,112', 0.06);
  // tar seams + cracks
  a.strokeStyle = 'rgba(14,14,16,0.75)'; a.lineWidth = 2.2;
  for (let i = 0; i < 9; i++) {
    a.beginPath();
    let x = rng() * size, y = rng() * size;
    a.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (rng() - 0.5) * 90; y += (rng() - 0.5) * 90; a.lineTo(x, y); }
    a.stroke();
  }
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 4200; i++) {
    const v = 110 + rng() * 70;
    h.fillStyle = `rgba(${v},${v},${v},0.5)`;
    h.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 3);
  }
  const rgh = canvas(size), r = rgh.getContext('2d');
  r.fillStyle = '#c8c8c8'; r.fillRect(0, 0, size, size);
  wrapSplat(r, size, size, rng, 30, 30, 140, '90,90,90', 0.5);   // polished tyre tracks
  const set = {
    map: toTexture(alb, { srgb: true }),
    normalMap: toTexture(normalFromHeight(hgt, 0.9)),
    roughnessMap: toTexture(rgh),
  };
  cache.set(key, set); return set;
}

export function makeSidewalk(seed = 5) {
  const key = 'sidewalk' + seed;
  if (cache.has(key)) return cache.get(key);
  const size = 512, rng = makeRng(seed);
  const alb = canvas(size), a = alb.getContext('2d');
  a.fillStyle = '#8e8d88'; a.fillRect(0, 0, size, size);
  const tile = size / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 128 + rng() * 30;
    a.fillStyle = `rgb(${v | 0},${(v - 2) | 0},${(v - 8) | 0})`;
    a.fillRect(x * tile + 1.6, y * tile + 1.6, tile - 3.2, tile - 3.2);
  }
  for (let i = 0; i < 2600; i++) {
    const v = 90 + rng() * 90;
    a.fillStyle = `rgba(${v},${v},${v - 6},${0.12 + rng() * 0.25})`;
    a.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  wrapSplat(a, size, size, rng, 30, 14, 60, '60,56,50', 0.14);  // gum + stains
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#3c3c3c'; h.fillRect(0, 0, size, size);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    { h.fillStyle = '#c8c8c8'; h.fillRect(x * tile + 2, y * tile + 2, tile - 4, tile - 4); }
  const rgh = canvas(size), r = rgh.getContext('2d');
  r.fillStyle = '#d2d2d2'; r.fillRect(0, 0, size, size);
  wrapSplat(r, size, size, rng, 24, 20, 80, '120,120,120', 0.4);
  const set = {
    map: toTexture(alb, { srgb: true }),
    normalMap: toTexture(normalFromHeight(hgt, 1.1)),
    roughnessMap: toTexture(rgh),
  };
  cache.set(key, set); return set;
}

export function makeRoofTexture(seed = 9) {
  const key = 'roof' + seed;
  if (cache.has(key)) return cache.get(key);
  const size = 512, rng = makeRng(seed);
  const alb = canvas(size), a = alb.getContext('2d');
  a.fillStyle = '#3a3936'; a.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const v = 40 + rng() * 60;
    a.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.3 + rng() * 0.5})`;
    a.beginPath(); a.arc(rng() * size, rng() * size, 1 + rng() * 2.4, 0, 7); a.fill();
  }
  // tar paper seams
  a.strokeStyle = 'rgba(24,23,22,0.8)'; a.lineWidth = 3;
  for (let y = 0; y < size; y += 64) { a.beginPath(); a.moveTo(0, y); a.lineTo(size, y); a.stroke(); }
  wrapSplat(a, size, size, rng, 18, 30, 120, '96,94,88', 0.08);
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#7a7a7a'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const v = 100 + rng() * 90; h.fillStyle = `rgba(${v},${v},${v},0.5)`;
    h.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 3);
  }
  const set = {
    map: toTexture(alb, { srgb: true }),
    normalMap: toTexture(normalFromHeight(hgt, 1.0)),
    roughnessMap: null,
  };
  cache.set(key, set); return set;
}

export function makeGrass(seed = 11) {
  const key = 'grass' + seed;
  if (cache.has(key)) return cache.get(key);
  const size = 512, rng = makeRng(seed);
  const alb = canvas(size), a = alb.getContext('2d');
  a.fillStyle = '#33461f'; a.fillRect(0, 0, size, size);
  for (let i = 0; i < 14000; i++) {
    const g = 50 + rng() * 70;
    a.strokeStyle = `rgba(${(g * 0.55) | 0},${g},${(g * 0.35) | 0},${0.35 + rng() * 0.5})`;
    a.lineWidth = 1;
    const x = rng() * size, y = rng() * size;
    a.beginPath(); a.moveTo(x, y); a.lineTo(x + (rng() - 0.5) * 4, y - 3 - rng() * 5); a.stroke();
  }
  wrapSplat(a, size, size, rng, 20, 30, 110, '90,80,40', 0.10);
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const v = 90 + rng() * 90; h.fillStyle = `rgba(${v},${v},${v},0.4)`;
    h.fillRect(rng() * size, rng() * size, 2, 2 + rng() * 4);
  }
  const set = { map: toTexture(alb, { srgb: true }), normalMap: toTexture(normalFromHeight(hgt, 1.4)) };
  cache.set(key, set); return set;
}

/* ============================================================== SIGNAGE */

const SIGN_WORDS = [
  'NOODLE BAR', 'DINER', 'PHARMACY', '24H', 'HOTEL', 'JAZZ', 'LAUNDRY', 'TAXI',
  'GRAND', 'CAFÉ', 'BODEGA', 'SUSHI', 'BAR', 'DELI', 'CINEMA', 'ARCADE',
  'RAMEN', 'PIZZA', 'BOOKS', 'BANK', 'THEATRE', 'CLUB', 'MOTEL', 'BURGERS',
];
const SIGN_COLORS = ['#ff2d55', '#00e5ff', '#ff9500', '#b46bff', '#39ff88', '#ffe14d', '#ff5ea8'];

export function makeNeonSign(seed) {
  const rng = makeRng(seed * 977 + 13);
  const w = 512, h = 256;
  const cv = canvas(w, h), c = cv.getContext('2d');
  c.fillStyle = '#08090c'; c.fillRect(0, 0, w, h);
  const col = SIGN_COLORS[(rng() * SIGN_COLORS.length) | 0];
  const word = SIGN_WORDS[(rng() * SIGN_WORDS.length) | 0];
  c.strokeStyle = col; c.lineWidth = 4; c.globalAlpha = 0.5;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.globalAlpha = 1;
  c.font = `700 ${word.length > 8 ? 62 : 86}px "Rajdhani", "Segoe UI", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = col; c.shadowBlur = 42;
  c.fillStyle = '#fff';
  c.fillText(word, w / 2, h / 2);
  c.shadowBlur = 20; c.fillStyle = col; c.globalAlpha = 0.75;
  c.fillText(word, w / 2, h / 2);
  c.shadowBlur = 0; c.globalAlpha = 1;
  const t = toTexture(cv, { srgb: true, repeat: 1 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { texture: t, color: col, word };
}

export function makeBillboard(seed) {
  const rng = makeRng(seed * 6151 + 7);
  const w = 512, h = 288;
  const cv = canvas(w, h), c = cv.getContext('2d');
  const hue = rng() * 360;
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue},70%,${18 + rng() * 22}%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360},80%,${30 + rng() * 30}%)`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // abstract graphic shapes — reads as advertising at distance, never as lorem text
  for (let i = 0; i < 7; i++) {
    c.globalAlpha = 0.12 + rng() * 0.3;
    c.fillStyle = `hsl(${(hue + rng() * 180) | 0},90%,${55 + rng() * 35}%)`;
    if (rng() < 0.5) { c.beginPath(); c.arc(rng() * w, rng() * h, 30 + rng() * 110, 0, 7); c.fill(); }
    else c.fillRect(rng() * w, rng() * h, 40 + rng() * 220, 20 + rng() * 90);
  }
  c.globalAlpha = 1;
  const words = ['VERTEX', 'OSCORP-X', 'NOVA', 'ARC LABS', 'KRONOS', 'HELIX', 'MERIDIAN', 'ATLAS 9'];
  c.font = '800 74px "Rajdhani","Segoe UI",sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 18;
  c.fillText(words[(rng() * words.length) | 0], w / 2, h / 2);
  c.shadowBlur = 0;
  c.font = '500 26px "Rajdhani","Segoe UI",sans-serif';
  c.globalAlpha = 0.8;
  c.fillText('— THE FUTURE, DELIVERED —', w / 2, h / 2 + 62);
  const t = toTexture(cv, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ============================================================ MISC MAPS */

export function makeWaterNormal() {
  if (cache.has('waterN')) return cache.get('waterN');
  const size = 512, rng = makeRng(4242);
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const y = rng() * size, amp = 3 + rng() * 9, len = 30 + rng() * 90;
    h.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.1})`;
    h.lineWidth = 2 + rng() * 8;
    h.beginPath();
    for (let x = -20; x <= size + 20; x += 8) h.lineTo(x, y + Math.sin(x / len) * amp);
    h.stroke();
  }
  const t = toTexture(normalFromHeight(hgt, 0.55), { repeat: 1 });
  cache.set('waterN', t); return t;
}

/** Fabric weave + hex micro-pattern for the suit — subtle, only reads up close. */
export function makeSuitTextures() {
  if (cache.has('suit')) return cache.get('suit');
  const size = 256;
  const hgt = canvas(size), h = hgt.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  const r = 9, dx = r * 1.732, dy = r * 1.5;
  h.strokeStyle = 'rgba(255,255,255,0.6)'; h.lineWidth = 1.3;
  for (let row = -1; row * dy < size + dy; row++) {
    for (let col = -1; col * dx < size + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
      h.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 180 * (60 * i - 30);
        const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
        i ? h.lineTo(px, py) : h.moveTo(px, py);
      }
      h.closePath(); h.stroke();
    }
  }
  const rgh = canvas(size), rc = rgh.getContext('2d');
  rc.fillStyle = '#b4b4b4'; rc.fillRect(0, 0, size, size);
  const rn = makeRng(88);
  wrapSplat(rc, size, size, rn, 24, 10, 40, '150,150,150', 0.3);
  const set = {
    normalMap: toTexture(normalFromHeight(hgt, 0.6), { repeat: 1 }),
    roughnessMap: toTexture(rgh, { repeat: 1 }),
  };
  cache.set('suit', set); return set;
}

/** Radial soft dot — used for rain splashes, sparks, dust, light pools, web tips. */
export function makeSoftDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = 'dot' + inner + outer;
  if (cache.has(key)) return cache.get(key);
  const s = 128, cv = canvas(s), c = cv.getContext('2d');
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  const t = toTexture(cv, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t); return t;
}

/** Elongated streak for headlight cones / light pools on wet asphalt. */
export function makeLightPool() {
  if (cache.has('pool')) return cache.get('pool');
  const s = 256, cv = canvas(s), c = cv.getContext('2d');
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,215,0.95)');
  g.addColorStop(0.3, 'rgba(255,225,180,0.35)');
  g.addColorStop(1, 'rgba(255,210,150,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  const t = toTexture(cv, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('pool', t); return t;
}

export function disposeAll() {
  for (const v of cache.values()) {
    if (v && v.isTexture) v.dispose();
    else if (v) for (const k in v) v[k]?.isTexture && v[k].dispose();
  }
  cache.clear();
}
