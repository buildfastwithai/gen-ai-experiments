# Procedural Visuals and UI

No image files are allowed, so every pixel is drawn in code. This is not a limitation to work around — procedurally generated art with per-instance variation looks more alive than a handful of repeated sprites.

Contents:
1. [Palettes](#1-palettes)
2. [Sprite generation](#2-sprite-generation)
3. [Character construction](#3-character-construction)
4. [Tiles and terrain](#4-tiles-and-terrain)
5. [Backgrounds](#5-backgrounds)
6. [Drawing helpers](#6-drawing-helpers)
7. [Lighting and fog](#7-lighting-and-fog)
8. [Glow and blend modes](#8-glow-and-blend-modes)
9. [Damage numbers and floating text](#9-damage-numbers-and-floating-text)
10. [HUD in DOM](#10-hud-in-dom)
11. [Screens and transitions](#11-screens-and-transitions)
12. [Touch controls](#12-touch-controls)
13. [Genre art direction](#13-genre-art-direction)

---

## 1. Palettes

Commit to one palette and use it everywhere. Six colours plus neutrals is plenty; more looks noisy.

```js
const PALETTES = {
  neon:    { bg:'#0a0e1a', surface:'#141c31', ink:'#e8eef7', dim:'#7c8ba6',
             a:'#5eead4', b:'#a78bfa', c:'#f472b6', warn:'#fbbf24', bad:'#fb7185' },
  cozy:    { bg:'#2d2418', surface:'#3d3020', ink:'#f5ecd7', dim:'#a8977a',
             a:'#8fbc5a', b:'#e8a33d', c:'#d4654f', warn:'#f2c14e', bad:'#b8503f' },
  grim:    { bg:'#0d0d10', surface:'#1a1a20', ink:'#c8ccd4', dim:'#5a6070',
             a:'#7a8a6a', b:'#8a6a5a', c:'#aa4a3a', warn:'#c9a227', bad:'#8b2635' },
  arcade:  { bg:'#12002e', surface:'#240055', ink:'#ffffff', dim:'#9d7fd4',
             a:'#00f0ff', b:'#ff00a0', c:'#ffe600', warn:'#ff9000', bad:'#ff2d55' },
  pastel:  { bg:'#f4f1ea', surface:'#ffffff', ink:'#2c2a26', dim:'#8b8680',
             a:'#7bb8a8', b:'#e5a3b8', c:'#f0c987', warn:'#e8a33d', bad:'#d4654f' }
};

// HSL is far easier to derive variations from than hex.
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const shade = (h, s, l, amt) => hsl(h, s, clamp(l + amt, 0, 100));

// Per-instance jitter so a crowd of enemies doesn't look cloned.
function varyColor(h, s, l, seed) {
  const r = mulberry32(seed);
  return hsl(h + (r()-0.5)*14, s + (r()-0.5)*10, l + (r()-0.5)*12);
}
```

Rules that hold across styles: never pure `#000` or `#fff`; keep saturation lower in backgrounds than in foreground actors; reserve the most saturated colour for the thing the player must look at.

## 2. Sprite generation

Draw once into an offscreen canvas, then `drawImage` per frame. Regenerating shapes every frame is the most common performance mistake in generated games.

```js
function makeSprite(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w * SPRITE_SCALE; c.height = h * SPRITE_SCALE;
  const g = c.getContext('2d');
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  draw(g, w, h);
  return c;
}

// Symmetric pixel-art creatures: generate half, mirror it. Always reads as a "character".
function makeCreature(seed, w = 12, h = 12, palette) {
  const r = mulberry32(seed);
  const half = Math.ceil(w/2);
  const grid = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < half; x++) {
      const edge = x === 0 || y === 0 || y === h-1;
      grid[y][x] = r() < (edge ? 0.25 : 0.62) ? 1 + ((r()*palette.length)|0) : 0;
    }
  }
  return makeSprite(w, h, g => {
    for (let y=0;y<h;y++) for (let x=0;x<half;x++) {
      const v = grid[y][x];
      if (!v) continue;
      g.fillStyle = palette[v-1];
      g.fillRect(x, y, 1, 1);
      g.fillRect(w-1-x, y, 1, 1);     // mirror
    }
  });
}

// Cache generated sprites by key — never regenerate for an entity that already has one.
const spriteCache = new Map();
const getSprite = (key, make) => {
  let s = spriteCache.get(key);
  if (!s) { s = make(); spriteCache.set(key, s); }
  return s;
};
```

## 3. Character construction

For non-pixel styles, build characters from primitives with an animation-driven skeleton. It costs little and animates for free.

```js
function drawHumanoid(ctx, e, t) {
  const { x, y, facing, palette: p } = e;
  const walk = e.moving ? Math.sin(t * 12) : 0;
  const bob  = e.moving ? Math.abs(Math.sin(t * 12)) * 1.5 : Math.sin(t*2) * 0.6;  // idle breathing

  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(facing, 1);
  ctx.scale(e.squashX ?? 1, e.squashY ?? 1);

  // shadow first — grounds the character, costs one ellipse
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 2.5, 0, 0, TAU); ctx.fill();

  ctx.strokeStyle = p.limb; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();                                   // legs
  ctx.moveTo(-2, -6); ctx.lineTo(-2 + walk*3, 0);
  ctx.moveTo( 2, -6); ctx.lineTo( 2 - walk*3, 0);
  ctx.stroke();

  ctx.fillStyle = p.body;                            // torso
  roundRect(ctx, -5, -16, 10, 11, 3); ctx.fill();

  ctx.beginPath();                                   // arms
  ctx.moveTo(-5, -14); ctx.lineTo(-7 - walk*2, -8);
  ctx.moveTo( 5, -14); ctx.lineTo( 7 + walk*2, -8);
  ctx.stroke();

  ctx.fillStyle = p.head;                            // head
  ctx.beginPath(); ctx.arc(0, -21, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = p.ink;                             // eye
  ctx.fillRect(1.5, -22.5, 2, 2);

  if (e.flash > 0) {                                 // hit flash
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = e.flash;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -27, 16, 29);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
```

Squash and stretch, driven from events, is what makes primitive shapes feel animated: `e.squashY = 1.3` on jump, `0.7` on land, then `damp` back to 1.

## 4. Tiles and terrain

```js
// Per-tile variation stops a grid from looking like wallpaper.
function drawGrassTile(g, x, y, s, seed) {
  const r = mulberry32(seed);
  g.fillStyle = hsl(105 + r()*18, 32 + r()*10, 34 + r()*7);
  g.fillRect(x, y, s, s);
  for (let i = 0; i < 5; i++) {                     // blades
    const bx = x + r()*s, by = y + r()*s, bh = 2 + r()*3;
    g.strokeStyle = hsl(100 + r()*20, 40, 44 + r()*10);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (r()-0.5)*2, by - bh); g.stroke();
  }
}

// Auto-tiling: a 4-bit neighbour mask picks the correct edge/corner variant.
function tileMask(map, x, y) {
  return (map.get(x, y-1) ? 1 : 0) | (map.get(x+1, y) ? 2 : 0) |
         (map.get(x, y+1) ? 4 : 0) | (map.get(x-1, y) ? 8 : 0);
}
function drawWallTile(g, x, y, s, mask, p) {
  g.fillStyle = p.surface; g.fillRect(x, y, s, s);
  g.fillStyle = shadeOf(p.surface, +12);
  if (!(mask & 1)) g.fillRect(x, y, s, 3);          // exposed top gets a lit edge
  g.fillStyle = 'rgba(0,0,0,.28)';
  if (!(mask & 4)) g.fillRect(x, y+s-3, s, 3);      // exposed bottom gets shade
}
```

## 5. Backgrounds

Bake once, blit forever. A background regenerated per frame is pure waste.

```js
function makeStarfield(w, h, count, seed) {
  const r = mulberry32(seed);
  return makeSprite(w, h, g => {
    const grad = g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0, '#080a18'); grad.addColorStop(1, '#141033');
    g.fillStyle = grad; g.fillRect(0,0,w,h);
    for (let i=0;i<count;i++) {
      const s = r()*1.6 + 0.4;
      g.globalAlpha = 0.25 + r()*0.75;
      g.fillStyle = r() < 0.85 ? '#fff' : (r() < 0.5 ? '#9fd' : '#fcd');
      g.fillRect(r()*w, r()*h, s, s);
    }
    g.globalAlpha = 1;
  });
}

// Parallax: draw each layer offset by camera position × depth factor, wrapping seamlessly.
function drawParallax(ctx, layer, camX, camY, factor, w, h) {
  const ox = -((camX * factor) % w), oy = -((camY * factor * 0.5) % h);
  for (let x = ox - w; x < W + w; x += w)
    for (let y = oy - h; y < H + h; y += h)
      ctx.drawImage(layer, x, y);
}

// Rolling hills, drawn once per level.
function makeHills(w, h, color, amp, freq, seed) {
  const n = makeNoise(seed);
  return makeSprite(w, h, g => {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h*0.55 + fbm(n, x*freq, 0, 3)*amp);
    g.lineTo(w, h); g.closePath(); g.fill();
  });
}
```

## 6. Drawing helpers

```js
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
}

function polygon(ctx, x, y, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i/sides * TAU;
    const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function star(ctx, x, y, outer, inner, points = 5, rot = -Math.PI/2) {
  ctx.beginPath();
  for (let i = 0; i < points*2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + i/(points*2) * TAU;
    const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// Health bar with a delayed "ghost" — the lag is what communicates how much was just lost.
function healthBar(ctx, x, y, w, h, cur, max, ghost, p) {
  ctx.fillStyle = 'rgba(0,0,0,.45)';   roundRect(ctx, x, y, w, h, h/2); ctx.fill();
  ctx.fillStyle = p.warn;              roundRect(ctx, x, y, w*(ghost/max), h, h/2); ctx.fill();
  const t = cur/max;
  ctx.fillStyle = t > 0.5 ? p.a : t > 0.25 ? p.warn : p.bad;
  roundRect(ctx, x, y, w*t, h, h/2); ctx.fill();
}
// Per frame: ghost = Math.max(cur, ghost - dt * max * 0.5);
```

## 7. Lighting and fog

```js
// Darkness with cut-out lights: fill black, then punch holes with 'destination-out'.
function drawLighting(lightCtx, lights, ambient = 0.82) {
  const g = lightCtx;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgba(4,6,14,${ambient})`;
  g.fillRect(0, 0, W, H);

  g.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    grad.addColorStop(0,   `rgba(0,0,0,${l.intensity})`);
    grad.addColorStop(0.6, `rgba(0,0,0,${l.intensity*0.5})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(l.x-l.r, l.y-l.r, l.r*2, l.r*2);
  }
  g.globalCompositeOperation = 'source-over';
}

// A vision cone for survival/stealth: much cheaper than true raycasting and reads clearly.
function visionCone(ctx, x, y, facing, fov, range) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - fov/2, facing + fov/2);
  ctx.closePath();
  ctx.clip();
  // draw the world here — everything outside the cone stays hidden
  ctx.restore();
}

// Fog of war on a coarse grid — one Uint8 per cell, drawn as translucent rects.
class Fog {
  constructor(w, h, cell) { this.w=w; this.h=h; this.cell=cell; this.seen = new Uint8Array(w*h); }
  reveal(wx, wy, r) {
    const cx = (wx/this.cell)|0, cy = (wy/this.cell)|0, cr = Math.ceil(r/this.cell);
    for (let y=cy-cr;y<=cy+cr;y++) for (let x=cx-cr;x<=cx+cr;x++) {
      if (x<0||y<0||x>=this.w||y>=this.h) continue;
      if ((x-cx)**2 + (y-cy)**2 <= cr*cr) this.seen[y*this.w+x] = 2;   // 2 = visible now
    }
  }
  fade() { for (let i=0;i<this.seen.length;i++) if (this.seen[i]===2) this.seen[i]=1; }  // 1 = explored
}
```

## 8. Glow and blend modes

`shadowBlur` is extremely slow. Pre-render one glow sprite and blit it.

```js
const glowSprite = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.35,'rgba(255,255,255,.35)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0,0,128,128);
  return c;
})();

function glow(ctx, x, y, radius, color, alpha = 0.8) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite, x-radius, y-radius, radius*2, radius*2);
  ctx.restore();
}
```

Useful blend modes: `lighter` for glow, fire, energy and explosions; `multiply` for shadows and tinting; `screen` for smoke and fog; `destination-out` for cut-out masks. Set them inside a `save`/`restore` pair — a leaked composite mode corrupts everything drawn afterward.

## 9. Damage numbers and floating text

```js
class FloatingText {
  constructor(max = 64) {
    this.items = Array.from({length: max}, () => ({alive:false,x:0,y:0,vy:0,text:'',color:'#fff',life:0,maxLife:1,size:14}));
  }
  spawn(x, y, text, color = '#fff', big = false) {
    const it = this.items.find(i => !i.alive) || this.items[0];
    Object.assign(it, {
      alive:true, x: x + rand(-8,8), y, vy: -52, text: String(text), color,
      life: big ? 1.1 : 0.8, maxLife: big ? 1.1 : 0.8, size: big ? 22 : 14
    });
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.alive) continue;
      it.life -= dt;
      if (it.life <= 0) { it.alive = false; continue; }
      it.y += it.vy * dt; it.vy += 90 * dt;      // rise then settle
    }
  }
  draw(ctx) {
    ctx.textAlign = 'center';
    for (const it of this.items) {
      if (!it.alive) continue;
      const t = it.life / it.maxLife;
      const pop = it.life > it.maxLife - 0.1 ? 1.35 : 1;   // punch on appearance
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = `700 ${it.size * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(it.text, it.x, it.y);                 // outline keeps it legible on any background
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, it.x, it.y);
    }
    ctx.globalAlpha = 1;
  }
}
```

## 10. HUD in DOM

Canvas text is expensive and hard to lay out. Put the HUD in DOM over the canvas, and update only on change.

```html
<div id="hud">
  <div class="hud-tl">
    <div class="bar"><span id="hpFill"></span><span id="hpGhost"></span></div>
    <div class="stat"><span id="coins">0</span> coins</div>
  </div>
  <div class="hud-tr"><div id="wave">Wave 1</div><div id="timer">0:00</div></div>
</div>
```

```css
#hud{position:absolute;inset:0;pointer-events:none;font-variant-numeric:tabular-nums}
#hud .hud-tl{position:absolute;top:max(14px,env(safe-area-inset-top));left:14px}
#hud .hud-tr{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;text-align:right}
#hud button,#hud .clickable{pointer-events:auto}
.bar{position:relative;width:180px;height:14px;border-radius:99px;background:rgba(0,0,0,.5);overflow:hidden}
.bar span{position:absolute;inset:0;width:100%;transform-origin:left;border-radius:99px}
#hpGhost{background:#fbbf24;transition:transform .45s ease-out}
#hpFill{background:#5eead4;transition:transform .08s linear;z-index:1}
.stat{font-size:14px;font-weight:600;margin-top:6px;text-shadow:0 2px 6px rgba(0,0,0,.7)}
.pop{animation:pop .25s cubic-bezier(.2,.8,.3,1)}
@keyframes pop{0%{transform:scale(1)}45%{transform:scale(1.28)}100%{transform:scale(1)}}
```

```js
const HUD = {
  _hp: -1, _coins: -1,
  set(hp, maxHp, ghost, coins) {
    if (hp !== this._hp) {
      hpFill.style.transform  = `scaleX(${hp/maxHp})`;
      hpGhost.style.transform = `scaleX(${ghost/maxHp})`;
      this._hp = hp;
    }
    if (coins !== this._coins) {
      coinsEl.textContent = coins | 0;
      coinsEl.classList.remove('pop'); void coinsEl.offsetWidth; coinsEl.classList.add('pop');
      this._coins = coins;
    }
  }
};
```

Counting a number up rather than snapping is a small thing that reads as polish:

```js
function countUp(el, from, to, dur = 0.5) {
  const t0 = performance.now();
  (function tick(now) {
    const k = Math.min(1, (now - t0) / (dur*1000));
    el.textContent = Math.round(lerp(from, to, easeOutCubic(k)));
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}
```

## 11. Screens and transitions

```css
.screen{position:absolute;inset:0;display:grid;place-items:center;padding:24px;
  background:radial-gradient(120% 90% at 50% 0%,rgba(20,28,49,.9),rgba(6,8,16,.96));
  backdrop-filter:blur(8px);opacity:0;visibility:hidden;
  transition:opacity .3s ease,visibility .3s}
.screen.on{opacity:1;visibility:visible}
.panel{max-width:420px;width:100%;text-align:center;
  animation:rise .38s cubic-bezier(.2,.8,.3,1) both}
@keyframes rise{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
.btn{display:block;width:100%;margin:8px 0;padding:14px 20px;min-height:48px;
  border:1px solid rgba(255,255,255,.14);border-radius:12px;
  background:rgba(255,255,255,.06);color:inherit;font:600 16px/1 inherit;cursor:pointer;
  transition:transform .12s ease,background .18s ease,border-color .18s ease}
.btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.26);transform:translateY(-2px)}
.btn:active{transform:translateY(0) scale(.98)}
.btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent)}
.btn.primary{background:var(--accent);color:#04121a;border-color:transparent}
.btn[disabled]{opacity:.45;cursor:not-allowed;transform:none}
```

```js
const Screens = {
  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
  },
  hideAll() { for (const s of document.querySelectorAll('.screen')) s.classList.remove('on'); }
};

// Fade-to-black between major state changes — an instant cut reads as a bug.
function transition(fn, dur = 300) {
  const v = document.getElementById('veil');
  v.style.transition = `opacity ${dur}ms ease`;
  v.style.opacity = 1;
  setTimeout(() => { fn(); v.style.opacity = 0; }, dur);
}
```

## 12. Touch controls

```css
#touch{position:absolute;inset:0;pointer-events:none;display:none}
body.touch #touch{display:block}
#stick{position:absolute;left:0;bottom:0;width:50%;height:55%;pointer-events:auto}
#stickBase,#stickKnob{position:absolute;border-radius:50%;pointer-events:none;
  border:2px solid rgba(255,255,255,.28);opacity:0;transition:opacity .15s}
#stickBase{width:112px;height:112px;background:rgba(255,255,255,.06)}
#stickKnob{width:52px;height:52px;background:rgba(255,255,255,.22)}
#stick.active #stickBase,#stick.active #stickKnob{opacity:1}
.tbtn{position:absolute;right:20px;width:76px;height:76px;border-radius:50%;pointer-events:auto;
  background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.24);
  display:grid;place-items:center;font:700 14px/1 inherit;
  bottom:max(28px,env(safe-area-inset-bottom))}
.tbtn:active{background:rgba(255,255,255,.26);transform:scale(.94)}
.tbtn.secondary{right:112px;bottom:max(96px,calc(env(safe-area-inset-bottom) + 96px));width:64px;height:64px}
```

```js
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
```

Rules that matter: buttons at least 44px (76px is better for a primary action), placed in the lower corners where a thumb reaches, never overlapping information the player needs mid-action. Show the joystick only while touched so it doesn't clutter the screen.

## 13. Genre art direction

| Genre | Shape language | Palette | Camera | Signature effect |
|---|---|---|---|---|
| **Arcade** | Hard geometric, thick outlines | High-contrast neon on near-black | Fixed, full arena | Additive glow, chunky particles |
| **Platformer** | Rounded, bouncy, expressive | Saturated primaries, bright sky | Follow with look-ahead, parallax | Squash-and-stretch, dust puffs |
| **Tower defense** | Clean top-down icons | Muted terrain, saturated towers | Fixed or drag-pan | Range circles, projectile trails |
| **RTS / lane battler** | Small readable silhouettes | Team colours dominate everything | Fixed or slight pan | Selection rings, deploy shockwaves |
| **Physics** | Chunky materials with texture | Natural: wood, stone, sky | Follow shot, pan back | Debris, dust, splinters, slow-mo |
| **RPG** | Detailed characters, tiled world | Warm, layered, many hues | Grid-snapped follow | Damage numbers, ability flashes |
| **Survival / horror** | Sparse, low-contrast, murky | Desaturated, cold, near-monochrome | Tight, limited vision | Darkness, vision cone, grain |
| **Cozy / farming** | Soft rounded, no sharp corners | Warm pastels, seasonal shifts | Gentle follow | Sparkles, growth pops, weather |
| **Puzzle** | Flat, precise, high-clarity | Distinct hues per piece type + shape coding | Fixed | Match flashes, cascade waves |
| **Idle** | Icon-driven, list-heavy | Rich but calm; gold accents | None | Number pops, milestone bursts |
| **Racing** | Angular, motion-oriented | Track/sky contrast, bright vehicles | Chase with speed-based zoom | Speed lines, tyre smoke, drift sparks |
| **City builder** | Isometric-feel blocks | Earthy base, colour-coded zones | Free pan and zoom | Placement ghosts, growth animations |

Two rules that hold in every genre: **the player character must be the highest-contrast thing on screen**, and **anything that can kill the player must be visually distinct from anything that can't** — by shape, not only by colour.
