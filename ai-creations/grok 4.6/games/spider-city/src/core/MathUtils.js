/* core/MathUtils.js — deterministic noise, easing, framerate-independent damping. */
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };

/** Frame-rate independent exponential approach. `speed` ~ how fast, in 1/seconds. */
export const damp = (a, b, speed, dt) => lerp(a, b, 1 - Math.exp(-speed * dt));

export function dampVec3(out, target, speed, dt) {
  const k = 1 - Math.exp(-speed * dt);
  out.x += (target.x - out.x) * k;
  out.y += (target.y - out.y) * k;
  out.z += (target.z - out.z) * k;
  return out;
}

/** Critically-damped spring — the good camera/aim smoothing. */
export function springDamp(current, target, velocity, smoothTime, dt, maxSpeed = Infinity) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const temp = (velocity.v + omega * change) * dt;
  velocity.v = (velocity.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export const shortestAngle = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const dampAngle = (a, b, speed, dt) => a + shortestAngle(a, b) * (1 - Math.exp(-speed * dt));

/* ---------------------------------------------------------------- random */
/** Mulberry32 — small, fast, seedable. The whole city is reproducible from one seed. */
export function makeRng(seed = 1337) {
  let a = seed >>> 0;
  const fn = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + (hi - lo) * fn();
  fn.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * fn()) ;
  fn.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(fn() * arr.length))];
  fn.chance = (p) => fn() < p;
  fn.sign = () => (fn() < 0.5 ? -1 : 1);
  return fn;
}

export function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Cheap value noise, good enough for terrain-ish variation and texture dirt. */
export function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2(x, y, octaves = 4, gain = 0.5, lac = 2.0) {
  let amp = 0.5, f = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    f += amp * valueNoise2(x, y);
    norm += amp; amp *= gain; x *= lac; y *= lac;
  }
  return f / norm;
}

/* ---------------------------------------------------------------- geometry */
export function randomPointOnDisc(rng, radius) {
  const a = rng() * TAU, r = Math.sqrt(rng()) * radius;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/** Closest point on an axis-aligned box to p (all in world space). */
export function closestPointOnAABB(p, min, max, out) {
  out.set(clamp(p.x, min.x, max.x), clamp(p.y, min.y, max.y), clamp(p.z, min.z, max.z));
  return out;
}

/** Slab-method ray/AABB. Returns hit distance or -1. */
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max) {
  const inv = (d) => (Math.abs(d) < 1e-8 ? 1e8 * Math.sign(d || 1) : 1 / d);
  const ix = inv(dx), iy = inv(dy), iz = inv(dz);
  let t1 = (min.x - ox) * ix, t2 = (max.x - ox) * ix;
  let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
  t1 = (min.y - oy) * iy; t2 = (max.y - oy) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (min.z - oz) * iz; t2 = (max.z - oz) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  if (tmax < Math.max(tmin, 0)) return -1;
  return tmin >= 0 ? tmin : tmax;
}

const _tmpQ = new THREE.Quaternion();
/** Rotate `obj` so its +Y aligns to `up` and +Z faces `fwd`, damped. */
export function dampQuaternionToBasis(quat, fwd, up, speed, dt) {
  const z = fwd.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  _tmpQ.setFromRotationMatrix(m);
  quat.slerp(_tmpQ, 1 - Math.exp(-speed * dt));
  return quat;
}

export const kmh = (unitsPerSec) => Math.round(unitsPerSec * 3.6);
