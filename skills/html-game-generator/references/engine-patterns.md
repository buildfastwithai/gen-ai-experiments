# Engine Patterns

Reference implementations for the systems most single-file games need. Copy, adapt the names, tune the constants. Everything here is dependency-free vanilla JS.

Contents:
1. [Boot skeleton](#1-boot-skeleton)
2. [Fixed-timestep game loop](#2-fixed-timestep-game-loop)
3. [Canvas setup and DPR](#3-canvas-setup-and-dpr)
4. [Math, easing and seeded RNG](#4-math-easing-and-seeded-rng)
5. [Input](#5-input)
6. [Object pooling](#6-object-pooling)
7. [Collision](#7-collision)
8. [Spatial hash](#8-spatial-hash)
9. [Rigid body physics](#9-rigid-body-physics)
10. [Verlet integration](#10-verlet-integration)
11. [Platformer controller](#11-platformer-controller)
12. [Tilemaps](#12-tilemaps)
13. [Camera](#13-camera)
14. [A* pathfinding](#14-a-pathfinding)
15. [Flow fields](#15-flow-fields)
16. [Steering and avoidance](#16-steering-and-avoidance)
17. [State machines](#17-state-machines)
18. [Particles](#18-particles)
19. [Tweens and juice](#19-tweens-and-juice)
20. [Event bus](#20-event-bus)
21. [Save system](#21-save-system)
22. [Procedural generation](#22-procedural-generation)
23. [Performance guards](#23-performance-guards)

---

## 1. Boot skeleton

The shape every generated file follows.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Game Name</title>
<style>
  :root{ --bg:#0d1220; --fg:#e8eef7; --accent:#5eead4; }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--fg);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
  #wrap{position:relative;width:100vw;height:100dvh;overflow:hidden}
  canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
  .screen{position:absolute;inset:0;display:grid;place-items:center;
    background:rgba(8,12,22,.86);backdrop-filter:blur(6px);
    opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s}
  .screen.on{opacity:1;visibility:visible}
  #hud{position:absolute;inset:0;pointer-events:none;
    padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))}
</style>
</head>
<body>
<div id="wrap">
  <canvas id="bg"></canvas>     <!-- static/slow layer -->
  <canvas id="game"></canvas>   <!-- fast layer -->
  <div id="hud"></div>
  <div class="screen on" id="menu">…</div>
  <div class="screen" id="pause">…</div>
  <div class="screen" id="over">…</div>
</div>
<script>
'use strict';
(function(){
  /* ── CONFIG ───────────────────────── */
  /* ── UTILS ────────────────────────── */
  /* ── AUDIO ────────────────────────── */
  /* ── INPUT ────────────────────────── */
  /* ── ART ──────────────────────────── */
  /* ── ENTITIES ─────────────────────── */
  /* ── SYSTEMS ──────────────────────── */
  /* ── WORLD ────────────────────────── */
  /* ── UI ───────────────────────────── */
  /* ── GAME ─────────────────────────── */
  boot();
})();
</script>
</body>
</html>
```

## 2. Fixed-timestep game loop

Simulation runs at a fixed rate so behaviour is identical on any refresh rate; rendering interpolates between the last two states.

```js
const STEP = 1 / 60;          // seconds per simulation tick
const MAX_FRAME = 0.25;       // clamp: never catch up more than 15 ticks

let last = performance.now(), acc = 0, running = true;

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);

  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;   // tab was backgrounded — don't spiral

  if (hitStop > 0) { hitStop -= dt; render(1); return; }  // freeze frames

  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render(acc / STEP);                    // alpha for interpolation
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { running = false; }
  else { running = true; last = performance.now(); acc = 0; requestAnimationFrame(frame); }
});
```

Update order that avoids most one-frame-late bugs:

```js
function update(dt) {
  Input.beginFrame();
  ai(dt); physics(dt); collide(); resolve();
  particles.update(dt); camera.update(dt); ui.update(dt);
  Input.endFrame();          // clears "pressed this frame" flags
}
```

Interpolated rendering: store `prevX/prevY` at the start of each entity's update, then draw at `prevX + (x - prevX) * alpha`. Skip this only if the game is grid-locked.

## 3. Canvas setup and DPR

```js
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d', { alpha: false });   // alpha:false is faster for opaque layers
let W = 0, H = 0, DPR = 1;

function resize() {
  const r = cvs.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;        // layout not settled yet
  DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 3);
  W = r.width; H = r.height;
  cvs.width  = Math.round(W * DPR);
  cvs.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);             // draw in CSS pixels
  ctx.imageSmoothingEnabled = !PIXEL_ART;
  onResize();                                          // reflow camera, UI, layout
}

let rt = null;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 100); });
addEventListener('orientationchange', () => setTimeout(resize, 300));
resize();
```

For pixel-art games, render to a small offscreen canvas at native resolution and upscale with `imageSmoothingEnabled = false`.

## 4. Math, easing and seeded RNG

```js
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp  = (a,b,t) => a + (b-a) * t;
const inv   = (a,b,v) => (v-a) / (b-a);
const dist2 = (ax,ay,bx,by) => { const dx=bx-ax, dy=by-ay; return dx*dx + dy*dy; };
const angle = (ax,ay,bx,by) => Math.atan2(by-ay, bx-ax);
const TAU   = Math.PI * 2;

// shortest angular difference — prevents units spinning the long way round
const angDiff = (a,b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;

// frame-rate independent smoothing (better than a raw lerp with fixed t)
const damp = (a,b,lambda,dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

const easeOutCubic = t => 1 - Math.pow(1-t, 3);
const easeInCubic  = t => t*t*t;
const easeInOutQuad= t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
const easeOutBack  = t => 1 + 2.70158*Math.pow(t-1,3) + 1.70158*Math.pow(t-1,2);
const easeOutElastic = t => t===0?0:t===1?1:Math.pow(2,-10*t)*Math.sin((t*10-0.75)*(TAU/3))+1;

// seeded RNG — reproducible runs, shareable seeds
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng   = mulberry32(Date.now() & 0xffffffff);
const rand  = (a,b) => a + rng() * (b-a);
const randI = (a,b) => Math.floor(rand(a, b+1));
const pick  = arr => arr[Math.floor(rng() * arr.length)];

function weighted(entries) {          // [[value, weight], …]
  let total = 0; for (const e of entries) total += e[1];
  let r = rng() * total;
  for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
  return entries[entries.length-1][0];
}

function shuffle(a) {                 // Fisher-Yates, in place
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
```

## 5. Input

Events write state; update reads it. Never run gameplay logic inside a listener.

```js
const Input = {
  keys: Object.create(null),      // held
  pressed: Object.create(null),   // pressed this frame
  mx: 0, my: 0, mdown: false, mpressed: false, wheel: 0,
  touches: new Map(),
  axisX: 0, axisY: 0,             // normalised -1..1, unified kb + stick

  init(el) {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.code;
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => {           // alt-tab must not leave keys stuck
      for (const k in this.keys) this.keys[k] = false;
      this.mdown = false; this.touches.clear();
    });

    el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); this.mx = e.clientX-r.left; this.my = e.clientY-r.top; });
    el.addEventListener('mousedown', e => { this.mdown = true; this.mpressed = true; e.preventDefault(); });
    addEventListener('mouseup', () => { this.mdown = false; });
    el.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, {passive:false});

    const touch = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.touches.clear();
      for (const t of e.touches) this.touches.set(t.identifier, {x:t.clientX-r.left, y:t.clientY-r.top});
      const first = this.touches.values().next().value;
      if (first) { this.mx = first.x; this.my = first.y; }
      if (e.type === 'touchstart') { this.mdown = true; this.mpressed = true; }
      if (e.type === 'touchend' && this.touches.size === 0) this.mdown = false;
    };
    for (const t of ['touchstart','touchmove','touchend','touchcancel'])
      el.addEventListener(t, touch, {passive:false});
  },

  beginFrame() {
    let x = 0, y = 0;
    if (this.keys.KeyA || this.keys.ArrowLeft)  x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.keys.KeyW || this.keys.ArrowUp)    y -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown)  y += 1;
    if (stick.active) { x = stick.x; y = stick.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }        // no diagonal speed bonus
    this.axisX = x; this.axisY = y;
  },

  endFrame() {
    for (const k in this.pressed) this.pressed[k] = false;
    this.mpressed = false; this.wheel = 0;
  }
};
```

Virtual joystick — anchor on touch-down anywhere in the left half, so the player never has to find it.

```js
const stick = { active:false, id:null, ox:0, oy:0, x:0, y:0, R:56 };
function stickStart(t) { stick.active = true; stick.id = t.identifier; stick.ox = t.x; stick.oy = t.y; }
function stickMove(t)  {
  let dx = t.x - stick.ox, dy = t.y - stick.oy;
  const d = Math.hypot(dx, dy);
  if (d > stick.R) { dx = dx/d*stick.R; dy = dy/d*stick.R; }
  stick.x = dx / stick.R; stick.y = dy / stick.R;
}
function stickEnd() { stick.active = false; stick.x = stick.y = 0; }
```

## 6. Object pooling

Mandatory for particles, bullets, damage numbers and enemies. Allocation during play causes GC stutter.

```js
class Pool {
  constructor(factory, reset, size = 256) {
    this.items = new Array(size);
    this.reset = reset;
    for (let i = 0; i < size; i++) { this.items[i] = factory(); this.items[i].alive = false; }
    this.factory = factory;
  }
  spawn(...args) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.alive) { it.alive = true; this.reset(it, ...args); return it; }
    }
    const it = this.factory();                 // grow rather than fail
    it.alive = true; this.reset(it, ...args);
    this.items.push(it);
    return it;
  }
  forEachAlive(fn) { for (let i=0;i<this.items.length;i++) if (this.items[i].alive) fn(this.items[i], i); }
  get count() { let n=0; for (const it of this.items) if (it.alive) n++; return n; }
}
```

Track a `cursor` index and start the search there if pools get large — it turns the scan into near-O(1) in practice.

## 7. Collision

```js
const aabb = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

const circle = (a,b) => {
  const dx = b.x-a.x, dy = b.y-a.y, r = a.r+b.r;
  return dx*dx + dy*dy < r*r;             // squared — never call sqrt in a broad test
};

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx+rw), ny = clamp(cy, ry, ry+rh);
  return dist2(cx, cy, nx, ny) < cr*cr;
}

// Minimum translation vector — push A out of B along the shallowest axis
function resolveAABB(a, b) {
  const ox = Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y);
  if (ox < oy) { a.x += (a.x < b.x ? -ox : ox); a.vx = 0; }
  else         { a.y += (a.y < b.y ? -oy : oy); a.vy = 0; }
}

// Swept AABB — use when speed can exceed the collider size, or fast objects tunnel through walls
function sweptAABB(box, vx, vy, block) {
  let xEntry, yEntry, xExit, yExit;
  if (vx > 0) { xEntry = block.x - (box.x+box.w); xExit = (block.x+block.w) - box.x; }
  else        { xEntry = (block.x+block.w) - box.x; xExit = block.x - (box.x+box.w); }
  if (vy > 0) { yEntry = block.y - (box.y+box.h); yExit = (block.y+block.h) - box.y; }
  else        { yEntry = (block.y+block.h) - box.y; yExit = block.y - (box.y+box.h); }

  const txEntry = vx === 0 ? -Infinity : xEntry/vx, txExit = vx === 0 ? Infinity : xExit/vx;
  const tyEntry = vy === 0 ? -Infinity : yEntry/vy, tyExit = vy === 0 ? Infinity : yExit/vy;

  const entry = Math.max(txEntry, tyEntry), exit = Math.min(txExit, tyExit);
  if (entry > exit || (txEntry < 0 && tyEntry < 0) || txEntry > 1 || tyEntry > 1)
    return { t: 1, nx: 0, ny: 0 };
  const nx = txEntry > tyEntry ? (xEntry < 0 ? 1 : -1) : 0;
  const ny = txEntry > tyEntry ? 0 : (yEntry < 0 ? 1 : -1);
  return { t: entry, nx, ny };
}
```

## 8. Spatial hash

Turns O(n²) neighbour queries into near-linear. Add it as soon as more than ~150 entities interact.

```js
class SpatialHash {
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); }
  _key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  clear() { this.map.clear(); }
  insert(e) {
    const c = this.cell;
    const x0 = Math.floor(e.x/c), y0 = Math.floor(e.y/c);
    const x1 = Math.floor((e.x+(e.w||e.r*2||0))/c), y1 = Math.floor((e.y+(e.h||e.r*2||0))/c);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = this._key(cx, cy);
      let b = this.map.get(k);
      if (!b) { b = []; this.map.set(k, b); }
      b.push(e);
    }
  }
  query(x, y, w, h, out) {
    out.length = 0;
    const c = this.cell, seen = new Set();
    for (let cy = Math.floor(y/c); cy <= Math.floor((y+h)/c); cy++)
      for (let cx = Math.floor(x/c); cx <= Math.floor((x+w)/c); cx++) {
        const b = this.map.get(this._key(cx, cy));
        if (!b) continue;
        for (const e of b) if (!seen.has(e)) { seen.add(e); out.push(e); }
      }
    return out;
  }
}
const hash = new SpatialHash(64), scratch = [];   // reuse `scratch`, never allocate per query
```

Rebuild once per tick: `hash.clear(); for (const e of entities) hash.insert(e);`. Cell size ≈ 2× the average entity diameter.

## 9. Rigid body physics

Impulse-based solver, adequate for slingshot/destruction games. Iterate the solver 6–10 times per step for stable stacks.

```js
class Body {
  constructor(o) {
    Object.assign(this, { x:0, y:0, vx:0, vy:0, w:0, h:0, r:0, angle:0, av:0,
      mass:1, restitution:0.2, friction:0.4, isStatic:false, shape:'box', sleeping:false, ...o });
    this.invMass = this.isStatic ? 0 : 1/this.mass;
    this.inertia = this.isStatic ? 0 : this.mass * (this.w*this.w + this.h*this.h) / 12;
    this.invInertia = this.inertia ? 1/this.inertia : 0;
  }
}

function step(bodies, dt, gravity = 1400) {
  for (const b of bodies) {
    if (b.isStatic || b.sleeping) continue;
    b.vy += gravity * dt;
    b.vx *= 0.999; b.vy *= 0.999; b.av *= 0.98;   // damping keeps things from jittering forever
    b.x += b.vx*dt; b.y += b.vy*dt; b.angle += b.av*dt;
  }

  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < bodies.length; i++)
      for (let j = i+1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if (a.isStatic && b.isStatic) continue;
        const m = collide(a, b);
        if (m) resolveImpulse(a, b, m);
      }
  }

  // sleeping: bodies that stop moving stop costing CPU and stop micro-jittering
  for (const b of bodies) {
    if (b.isStatic) continue;
    const e = b.vx*b.vx + b.vy*b.vy + b.av*b.av;
    b.sleepTimer = e < 4 ? (b.sleepTimer||0) + dt : 0;
    b.sleeping = b.sleepTimer > 0.6;
  }
}

function resolveImpulse(a, b, m) {
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx*m.nx + rvy*m.ny;
  if (vn > 0) return;                              // already separating
  const e = Math.min(a.restitution, b.restitution);
  const inv = a.invMass + b.invMass;
  if (inv === 0) return;
  const jn = -(1+e) * vn / inv;
  a.vx -= jn*m.nx*a.invMass; a.vy -= jn*m.ny*a.invMass;
  b.vx += jn*m.nx*b.invMass; b.vy += jn*m.ny*b.invMass;

  // friction along the tangent
  const tx = -m.ny, ty = m.nx;
  const vt = rvx*tx + rvy*ty;
  const mu = Math.sqrt(a.friction * b.friction);
  const jt = clamp(-vt/inv, -jn*mu, jn*mu);
  a.vx -= jt*tx*a.invMass; a.vy -= jt*ty*a.invMass;
  b.vx += jt*tx*b.invMass; b.vy += jt*ty*b.invMass;

  // positional correction — without this, stacks slowly sink into each other
  const slop = 0.02, percent = 0.4;
  const corr = Math.max(m.depth - slop, 0) / inv * percent;
  a.x -= corr*m.nx*a.invMass; a.y -= corr*m.ny*a.invMass;
  b.x += corr*m.nx*b.invMass; b.y += corr*m.ny*b.invMass;

  a.sleeping = b.sleeping = false;
}
```

## 10. Verlet integration

Simpler and very stable for ropes, cloth, soft bodies and chunky destruction. Position implies velocity, so nothing can explode.

```js
class Point {
  constructor(x, y, pinned = false) { this.x=x; this.y=y; this.px=x; this.py=y; this.pinned=pinned; }
}

function verletStep(points, dt, gravity = 1400, drag = 0.995) {
  for (const p of points) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * drag, vy = (p.y - p.py) * drag;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + gravity * dt * dt;
  }
}

function solveConstraints(sticks, iterations = 6) {
  for (let k = 0; k < iterations; k++)
    for (const s of sticks) {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = (s.len - d) / d * 0.5;
      const ox = dx*diff, oy = dy*diff;
      if (!s.a.pinned) { s.a.x -= ox; s.a.y -= oy; }
      if (!s.b.pinned) { s.b.x += ox; s.b.y += oy; }
    }
}
```

## 11. Platformer controller

The details here are the entire genre. Skipping coyote time and jump buffering is why generated platformers feel bad.

```js
const P = {
  accel: 2400, maxSpeed: 300, friction: 2000, airFriction: 400,
  gravity: 2200, jumpVel: -620, maxFall: 900,
  coyote: 0.10,          // still jumpable this long after leaving a ledge
  buffer: 0.12,          // jump pressed this long before landing still fires
  cutMultiplier: 0.45,   // releasing jump early shortens the arc
  apexBoost: 0.55        // reduced gravity near apex — makes jumps feel floaty and controlled
};

function updatePlayer(p, dt, input, tiles) {
  const dir = input.axisX;
  if (dir !== 0) {
    p.vx += dir * P.accel * dt;
    p.vx = clamp(p.vx, -P.maxSpeed, P.maxSpeed);
    p.facing = Math.sign(dir);
  } else {
    const f = (p.grounded ? P.friction : P.airFriction) * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx)*f;
  }

  p.coyoteT = p.grounded ? P.coyote : Math.max(0, p.coyoteT - dt);
  if (input.pressed.Space || input.pressed.KeyW) p.bufferT = P.buffer;
  else p.bufferT = Math.max(0, p.bufferT - dt);

  if (p.bufferT > 0 && p.coyoteT > 0) {
    p.vy = P.jumpVel; p.coyoteT = 0; p.bufferT = 0; p.jumping = true;
    p.squash = 1.35; sfx.jump(); particles.burst(p.x+p.w/2, p.y+p.h, 6, '#cfe');
  }
  if (p.jumping && p.vy < 0 && !(input.keys.Space || input.keys.KeyW)) {
    p.vy *= P.cutMultiplier; p.jumping = false;      // variable height
  }

  const g = Math.abs(p.vy) < 90 ? P.gravity * P.apexBoost : P.gravity;
  p.vy = Math.min(p.vy + g*dt, P.maxFall);

  const wasAir = !p.grounded;
  moveAndCollide(p, tiles, dt);
  if (wasAir && p.grounded) { p.squash = 0.7; sfx.land(); particles.burst(p.x+p.w/2, p.y+p.h, 10, '#cfe'); }
  p.squash = damp(p.squash, 1, 14, dt);
}

// Axes are resolved separately — doing both at once snags the player on tile seams.
function moveAndCollide(e, tiles, dt) {
  e.x += e.vx * dt;
  for (const t of tilesNear(tiles, e)) if (aabb(e, t)) {
    e.x = e.vx > 0 ? t.x - e.w : t.x + t.w; e.vx = 0;
  }
  e.y += e.vy * dt;
  e.grounded = false;
  for (const t of tilesNear(tiles, e)) if (aabb(e, t)) {
    if (e.vy > 0) { e.y = t.y - e.h; e.grounded = true; }
    else          { e.y = t.y + t.h; }
    e.vy = 0;
  }
}
```

## 12. Tilemaps

```js
class TileMap {
  constructor(w, h, size = 32) {
    this.w = w; this.h = h; this.size = size;
    this.data = new Uint8Array(w * h);
    this.cache = null; this.dirty = true;
  }
  get(x, y) { return (x<0||y<0||x>=this.w||y>=this.h) ? 1 : this.data[y*this.w + x]; }
  set(x, y, v) { if (x>=0&&y>=0&&x<this.w&&y<this.h) { this.data[y*this.w+x] = v; this.dirty = true; } }
  atWorld(wx, wy) { return this.get(Math.floor(wx/this.size), Math.floor(wy/this.size)); }

  // Pre-render the whole map once, then blit the visible slice each frame.
  bake(drawTile) {
    const c = document.createElement('canvas');
    c.width = this.w*this.size; c.height = this.h*this.size;
    const g = c.getContext('2d');
    for (let y=0;y<this.h;y++) for (let x=0;x<this.w;x++) {
      const t = this.data[y*this.w+x];
      if (t) drawTile(g, x*this.size, y*this.size, this.size, t, x, y);
    }
    this.cache = c; this.dirty = false;
  }
  draw(ctx, cam) {
    if (this.dirty) this.bake(drawTile);
    ctx.drawImage(this.cache, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
  }
}
```

For very large maps, bake in chunks (e.g. 16×16 tiles) and only keep visible chunks cached. Auto-tiling: compute a 4-bit neighbour mask (N/E/S/W solid) and index a variant table — it makes a blocky map look authored.

## 13. Camera

```js
class Camera {
  constructor(w, h) { Object.assign(this, {x:0,y:0,w,h,zoom:1,tx:0,ty:0,trauma:0,shakeX:0,shakeY:0}); }

  follow(t, dt, world) {
    this.tx = t.x + t.w/2 + (t.vx||0) * 0.22 - this.w/(2*this.zoom);   // lead the movement
    this.ty = t.y + t.h/2 - this.h/(2*this.zoom);
    this.x = damp(this.x, this.tx, 8, dt);
    this.y = damp(this.y, this.ty, 8, dt);
    if (world) {
      this.x = clamp(this.x, 0, Math.max(0, world.w - this.w/this.zoom));
      this.y = clamp(this.y, 0, Math.max(0, world.h - this.h/this.zoom));
    }
    // trauma² so light hits are subtle and heavy hits are dramatic
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * (REDUCED_MOTION ? 0 : 1);
    this.shakeX = (rng()*2-1) * 22 * s;
    this.shakeY = (rng()*2-1) * 22 * s;
  }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  apply(ctx) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x + this.shakeX), -Math.round(this.y + this.shakeY));
  }
  reset(ctx) { ctx.restore(); }

  visible(e, pad = 64) {
    return e.x + (e.w||0) > this.x - pad && e.x < this.x + this.w/this.zoom + pad &&
           e.y + (e.h||0) > this.y - pad && e.y < this.y + this.h/this.zoom + pad;
  }
  toWorld(sx, sy) { return { x: sx/this.zoom + this.x, y: sy/this.zoom + this.y }; }
}
```

Parallax: draw layer *n* at `-cam.x * factor` where factor is 0.2 for distant, 0.6 for mid, 1.0 for the play layer.

## 14. A* pathfinding

Good for a handful of agents on a grid. Cache paths and only recompute when the goal moves more than a tile.

```js
function astar(grid, sx, sy, gx, gy) {
  const W = grid.w, H = grid.h, N = W*H;
  const idx = (x,y) => y*W + x;
  const open = [idx(sx,sy)];
  const came = new Int32Array(N).fill(-1);
  const g = new Float32Array(N).fill(Infinity);
  const f = new Float32Array(N).fill(Infinity);
  const closed = new Uint8Array(N);
  g[idx(sx,sy)] = 0;
  f[idx(sx,sy)] = Math.abs(gx-sx) + Math.abs(gy-sy);

  const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[best]]) best = i;
    const cur = open.splice(best, 1)[0];
    const cx = cur % W, cy = (cur / W) | 0;
    if (cx === gx && cy === gy) {
      const path = [];
      for (let n = cur; n !== -1; n = came[n]) path.push({x: n%W, y: (n/W)|0});
      return path.reverse();
    }
    closed[cur] = 1;

    for (const [dx,dy] of NB) {
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = idx(nx,ny);
      if (closed[ni] || grid.solid(nx,ny)) continue;
      // no cutting diagonal corners through walls
      if (dx && dy && (grid.solid(cx+dx,cy) || grid.solid(cx,cy+dy))) continue;
      const step = (dx && dy) ? 1.414 : 1;
      const tentative = g[cur] + step * (grid.cost ? grid.cost(nx,ny) : 1);
      if (tentative < g[ni]) {
        came[ni] = cur; g[ni] = tentative;
        f[ni] = tentative + Math.abs(gx-nx) + Math.abs(gy-ny);
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return null;
}
```

Then smooth the path: walk it and drop waypoints that have clear line-of-sight from the previous kept one. Raw A* output looks robotic.

## 15. Flow fields

When many units share one destination (tower defense creeps, RTS attack-moves), compute one field instead of N paths.

```js
function flowField(grid, gx, gy) {
  const W = grid.w, H = grid.h;
  const cost = new Float32Array(W*H).fill(Infinity);
  const dirX = new Float32Array(W*H), dirY = new Float32Array(W*H);
  const q = [gy*W + gx];
  cost[gy*W + gx] = 0;

  for (let head = 0; head < q.length; head++) {       // BFS queue, no shift()
    const c = q[head], cx = c%W, cy = (c/W)|0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if (grid.solid(nx,ny) || cost[ni] !== Infinity) continue;
      cost[ni] = cost[c] + 1;
      q.push(ni);
    }
  }
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {       // gradient descent → direction
    const i = y*W+x;
    if (cost[i] === Infinity) continue;
    let bx=0, by=0, bc=cost[i];
    for (let oy=-1;oy<=1;oy++) for (let ox=-1;ox<=1;ox++) {
      const nx=x+ox, ny=y+oy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const c2 = cost[ny*W+nx];
      if (c2 < bc) { bc = c2; bx = ox; by = oy; }
    }
    const m = Math.hypot(bx,by) || 1;
    dirX[i] = bx/m; dirY[i] = by/m;
  }
  return { dirX, dirY, cost, W, H };
}
```

Recompute only when the map changes (a tower is placed, a wall is built), not per frame.

## 16. Steering and avoidance

```js
function seek(e, tx, ty, maxSpeed, maxForce) {
  const dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy) || 1;
  const dvx = dx/d*maxSpeed - e.vx, dvy = dy/d*maxSpeed - e.vy;
  const m = Math.hypot(dvx,dvy) || 1, s = Math.min(m, maxForce)/m;
  e.ax += dvx*s; e.ay += dvy*s;
}

function arrive(e, tx, ty, maxSpeed, slowRadius) {
  const dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy) || 1;
  const speed = d < slowRadius ? maxSpeed * (d/slowRadius) : maxSpeed;
  e.ax += dx/d*speed - e.vx; e.ay += dy/d*speed - e.vy;
}

// Separation stops units from stacking into one pixel — the single most visible AI improvement.
function separate(e, neighbours, radius, strength) {
  let sx = 0, sy = 0, n = 0;
  for (const o of neighbours) {
    if (o === e) continue;
    const dx = e.x-o.x, dy = e.y-o.y, d2 = dx*dx+dy*dy;
    if (d2 > 0 && d2 < radius*radius) { const d = Math.sqrt(d2); sx += dx/d; sy += dy/d; n++; }
  }
  if (n) { e.ax += sx/n*strength; e.ay += sy/n*strength; }
}

// Lead the target so ranged units don't always miss moving targets.
function predictAim(sx, sy, tx, ty, tvx, tvy, projSpeed) {
  const dx = tx-sx, dy = ty-sy;
  const a = tvx*tvx + tvy*tvy - projSpeed*projSpeed;
  const b = 2*(dx*tvx + dy*tvy);
  const c = dx*dx + dy*dy;
  const disc = b*b - 4*a*c;
  if (disc < 0 || a === 0) return { x: tx, y: ty };
  const t = Math.max(0, (-b - Math.sqrt(disc)) / (2*a));
  return { x: tx + tvx*t, y: ty + tvy*t };
}
```

## 17. State machines

```js
class FSM {
  constructor(owner, states, initial) {
    this.owner = owner; this.states = states; this.t = 0;
    this.set(initial);
  }
  set(name) {
    if (this.current === name) return;
    this.states[this.current]?.exit?.(this.owner);
    this.current = name; this.t = 0;
    this.states[name]?.enter?.(this.owner);
  }
  update(dt) { this.t += dt; this.states[this.current]?.update?.(this.owner, dt, this); }
}

const enemyStates = {
  idle:   { update(e, dt, fsm) { e.vx = e.vy = 0; if (e.canSee(player)) fsm.set('chase'); } },
  chase:  { enter(e){ e.repath = 0; sfx.alert(); },
            update(e, dt, fsm) {
              e.repath -= dt;
              if (e.repath <= 0) { e.path = astar(grid, ...); e.repath = 0.4; }
              followPath(e, dt);
              if (e.distTo(player) < e.attackRange) fsm.set('windup');
              else if (!e.canSee(player) && fsm.t > 3) fsm.set('search');
            } },
  windup: { enter(e){ e.flash = 1; sfx.windup(); },            // telegraph: the player can react
            update(e, dt, fsm) { e.vx = e.vy = 0; if (fsm.t > 0.45) fsm.set('attack'); } },
  attack: { enter(e){ e.strike(); camera.shake(0.25); },
            update(e, dt, fsm) { if (fsm.t > 0.3) fsm.set('recover'); } },
  recover:{ update(e, dt, fsm) { if (fsm.t > 0.5) fsm.set('chase'); } },
  search: { update(e, dt, fsm) { wander(e, dt); if (e.canSee(player)) fsm.set('chase');
                                  else if (fsm.t > 5) fsm.set('idle'); } }
};
```

The `windup` and `recover` states are not decoration — they are what make combat readable and beatable.

## 18. Particles

```js
class Particles {
  constructor(max = 600) {
    this.max = max;
    this.p = new Array(max);
    for (let i=0;i<max;i++) this.p[i] = {alive:false,x:0,y:0,vx:0,vy:0,life:0,maxLife:1,
      size:2,color:'#fff',gravity:0,drag:0.98,spin:0,angle:0,shape:0};
    this.cursor = 0;
  }
  _next() {                                 // ring allocation: oldest gets recycled under pressure
    for (let i=0;i<this.max;i++) {
      const p = this.p[this.cursor];
      this.cursor = (this.cursor+1) % this.max;
      if (!p.alive) return p;
    }
    const p = this.p[this.cursor]; this.cursor = (this.cursor+1)%this.max; return p;
  }
  emit(o) { const p = this._next(); Object.assign(p, {alive:true, life:o.maxLife||0.6}, o); return p; }

  burst(x, y, n, color, opts = {}) {
    n = Math.round(n * QUALITY);            // QUALITY drops on slow devices
    for (let i=0;i<n;i++) {
      const a = rng()*TAU, s = rand(opts.minSpeed??40, opts.maxSpeed??220);
      this.emit({x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, color,
        size:rand(1.5,4), maxLife:rand(0.3,0.8), life:rand(0.3,0.8),
        gravity:opts.gravity??300, drag:opts.drag??0.94, spin:rand(-8,8), angle:rng()*TAU});
    }
  }
  trail(x, y, color) { this.emit({x,y,vx:rand(-12,12),vy:rand(-12,12),color,size:rand(1,3),
    maxLife:0.35,life:0.35,gravity:0,drag:0.9}); }

  update(dt) {
    for (let i=0;i<this.max;i++) {
      const p = this.p[i]; if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.gravity*dt; p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx*dt; p.y += p.vy*dt; p.angle += p.spin*dt;
    }
  }
  draw(ctx) {
    for (let i=0;i<this.max;i++) {
      const p = this.p[i]; if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      const s = p.size * t;
      ctx.fillRect(p.x-s/2, p.y-s/2, s, s);     // rects are far cheaper than arcs
    }
    ctx.globalAlpha = 1;
  }
}
```

For glow, pre-render one radial-gradient sprite to an offscreen canvas and `drawImage` it with `globalCompositeOperation = 'lighter'`. Never use `shadowBlur` per particle.

## 19. Tweens and juice

```js
class Tweens {
  constructor() { this.list = []; }
  to(obj, props, dur, ease = easeOutCubic, onDone) {
    const from = {}; for (const k in props) from[k] = obj[k];
    this.list.push({obj, from, props, dur, t:0, ease, onDone});
  }
  update(dt) {
    for (let i = this.list.length-1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = tw.ease(Math.min(1, tw.t/tw.dur));
      for (const key in tw.props) tw.obj[key] = lerp(tw.from[key], tw.props[key], k);
      if (tw.t >= tw.dur) { tw.onDone?.(); this.list.splice(i,1); }
    }
  }
}

// Hit-stop: freeze the sim briefly on impact. The single cheapest way to add weight.
let hitStop = 0;
const freeze = s => { hitStop = Math.max(hitStop, s); };

function onHit(target, dmg, from) {
  target.hp -= dmg;
  target.flash = 1;                                   // white-out for ~0.1s
  target.squash = 1.3;
  const a = angle(from.x, from.y, target.x, target.y);
  target.vx += Math.cos(a) * dmg * 6;                 // knockback scales with damage
  target.vy += Math.sin(a) * dmg * 6;
  particles.burst(target.x, target.y, 8 + dmg, '#ff6b6b');
  damageNumbers.spawn(target.x, target.y, dmg, dmg > 20);
  camera.shake(clamp(dmg/60, 0.06, 0.4));
  freeze(clamp(dmg/300, 0.02, 0.09));
  sfx.hit(dmg);
}
```

Draw a flash by compositing: `ctx.globalCompositeOperation = 'lighter'` with a white fill at `alpha = flash`, then reset. Decay `flash` with `damp(flash, 0, 16, dt)`.

## 20. Event bus

```js
const Bus = {
  map: new Map(),
  on(evt, fn)  { (this.map.get(evt) ?? this.map.set(evt, []).get(evt)).push(fn); return fn; },
  off(evt, fn) { const a = this.map.get(evt); if (a) a.splice(a.indexOf(fn) >>> 0, 1); },
  emit(evt, data) { const a = this.map.get(evt); if (a) for (let i=0;i<a.length;i++) a[i](data); }
};

Bus.on('enemyDied', e => { score.add(e.value); particles.burst(e.x,e.y,20,e.color); sfx.death(); });
Bus.on('enemyDied', e => { if (rng() < e.dropChance) loot.spawn(e.x, e.y); });
Bus.on('enemyDied', e => quests.progress('kill', e.type));
```

Use it for cross-system notifications, not for per-frame data flow.

## 21. Save system

```js
const Save = {
  KEY: 'gamename.save',
  VERSION: 3,

  defaults: () => ({ version: 3, highScore: 0, coins: 0, unlocks: [], settings: { master:.5, sfx:.8, music:.5, reducedMotion:false } }),

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      let d = JSON.parse(raw);
      d = this.migrate(d);
      return Object.assign(this.defaults(), d);      // fills any key added since the save was written
    } catch (e) {
      console.warn('save load failed, using defaults', e);
      return this.defaults();
    }
  },

  migrate(d) {
    if (!d.version || d.version < 2) { d.unlocks = d.unlocked ?? []; delete d.unlocked; d.version = 2; }
    if (d.version < 3) { d.settings = Object.assign({master:.5,sfx:.8,music:.5}, d.settings); d.version = 3; }
    return d;
  },

  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }        // private mode / quota — must not crash the game
  },

  wipe() { try { localStorage.removeItem(this.KEY); } catch(e){} }
};

// Idle games: offline progress from a timestamp, capped so leaving for a month isn't infinite.
function offlineGain(save, now = Date.now()) {
  const elapsed = Math.min((now - (save.lastSeen || now)) / 1000, 8 * 3600);
  save.lastSeen = now;
  return elapsed * ratePerSecond(save);
}
```

Autosave on meaningful events (level end, purchase, death) and on `visibilitychange`, never every frame.

## 22. Procedural generation

```js
// Value noise — enough for terrain, clouds, texture variation. No library needed.
function makeNoise(seed) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  for (let i=0;i<256;i++) perm[i] = i;
  for (let i=255;i>0;i--) { const j = Math.floor(r()*(i+1)); [perm[i],perm[j]]=[perm[j],perm[i]]; }
  for (let i=0;i<256;i++) perm[256+i] = perm[i];
  const fade = t => t*t*t*(t*(t*6-15)+10);
  const grad = (h,x,y) => ((h&1)?-x:x) + ((h&2)?-y:y);
  return function(x, y) {
    const X = Math.floor(x)&255, Y = Math.floor(y)&255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = perm[X]+Y, B = perm[X+1]+Y;
    return lerp(lerp(grad(perm[A],x,y),   grad(perm[B],x-1,y),   u),
                lerp(grad(perm[A+1],x,y-1), grad(perm[B+1],x-1,y-1), u), v);
  };
}
function fbm(noise, x, y, octaves = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i=0;i<octaves;i++) { sum += a * noise(x*f, y*f); norm += a; a *= gain; f *= lac; }
  return sum / norm;
}

// Cellular automata caves — 4-5 smoothing passes gives organic connected caverns.
function caves(w, h, fill = 0.45, passes = 5) {
  let g = new Uint8Array(w*h);
  for (let i=0;i<g.length;i++) g[i] = rng() < fill ? 1 : 0;
  for (let p=0;p<passes;p++) {
    const n = new Uint8Array(g);
    for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
      let c = 0;
      for (let oy=-1;oy<=1;oy++) for (let ox=-1;ox<=1;ox++) if (ox||oy) c += g[(y+oy)*w+x+ox];
      n[y*w+x] = c > 4 ? 1 : c < 4 ? 0 : g[y*w+x];
    }
    g = n;
  }
  return g;    // then flood-fill and keep only the largest region so nothing is unreachable
}

// Rooms and corridors — for dungeons where readability matters more than organic shape.
function dungeon(w, h, tries = 60) {
  const grid = new Uint8Array(w*h).fill(1), rooms = [];
  for (let i=0;i<tries;i++) {
    const rw = randI(5,11), rh = randI(4,9);
    const rx = randI(1, w-rw-2), ry = randI(1, h-rh-2);
    const r = {x:rx,y:ry,w:rw,h:rh,cx:(rx+rw/2)|0,cy:(ry+rh/2)|0};
    if (rooms.some(o => rx < o.x+o.w+2 && rx+rw+2 > o.x && ry < o.y+o.h+2 && ry+rh+2 > o.y)) continue;
    for (let y=ry;y<ry+rh;y++) for (let x=rx;x<rx+rw;x++) grid[y*w+x] = 0;
    if (rooms.length) {                       // L-corridor to the previous room
      const p = rooms[rooms.length-1];
      for (let x=Math.min(p.cx,r.cx); x<=Math.max(p.cx,r.cx); x++) grid[p.cy*w+x] = 0;
      for (let y=Math.min(p.cy,r.cy); y<=Math.max(p.cy,r.cy); y++) grid[y*w+r.cx] = 0;
    }
    rooms.push(r);
  }
  return { grid, rooms };
}
```

Always verify generated levels: flood-fill from the spawn and confirm the exit and all required pickups are reachable. Regenerate if not. An unwinnable procedural level is worse than a hand-made one.

## 23. Performance guards

```js
// Adaptive quality — measure, then reduce, rather than dropping frames.
let frameAvg = 16.7, QUALITY = 1;
function measure(dt) {
  frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
  if (frameAvg > 22 && QUALITY > 0.35) QUALITY -= 0.02;
  else if (frameAvg < 15 && QUALITY < 1) QUALITY += 0.005;
}

// Round positions when drawing — sub-pixel blitting is slower and blurrier.
const px = v => (v + 0.5) | 0;

// Reusable scratch objects so hot paths never allocate.
const _v = {x:0, y:0};
function toLocal(e, cam) { _v.x = e.x - cam.x; _v.y = e.y - cam.y; return _v; }
```

Checklist when a game stutters, in the order worth checking:

1. Allocation in the loop (array literals, `.filter`, template strings) → GC sawtooth in the profiler.
2. O(n²) collision → add the spatial hash.
3. `shadowBlur`, `filter`, or gradients created per frame → pre-render to a sprite.
4. Re-baking a tilemap or background every frame → cache and invalidate on change.
5. DOM writes per frame → update on change only.
6. Unbounded particle or entity growth → enforce the cap.
7. A second rAF loop or a stray `setInterval` → consolidate.
