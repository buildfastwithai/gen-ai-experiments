/* player/Animator.js
   Procedural animation. No clips, no keyframes — every pose is a function of
   the character's actual physical state, which is exactly why the feet never
   slide: the stride phase is integrated from ground speed, so the legs cycle at
   the rate the body is really travelling.

   Structure:
     • a BASE pose chosen by locomotion mode (idle/walk/run/air/dive/swing/
       wall-run/wall-crawl/perch)
     • ADDITIVE one-shot actions (punch, kick, web-shoot, dodge, land, flinch)
       layered on top with their own weight curves
     • per-joint critically-ish damped slerp toward the blended target, which
       gives free crossfades and stops anything ever snapping.
*/

import * as THREE from 'three';
import { clamp, clamp01, lerp, smoothstep, damp } from '../core/MathUtils.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/* Per-joint responsiveness. Hands and arms snap; the spine is lazy. */
const JOINT_SPEED = {
  hips: 12, spine: 10, chest: 11, neck: 13, head: 14,
  shoulderL: 13, armL: 17, foreL: 19, handL: 22,
  shoulderR: 13, armR: 17, foreR: 19, handR: 22,
  thighL: 15, shinL: 17, footL: 18,
  thighR: 15, shinR: 17, footR: 18,
};

export class Animator {
  constructor(rig) {
    this.rig = rig;
    this.j = rig.joints;
    this.t = 0;
    this.stridePhase = 0;
    this.target = {};
    this.quatTarget = {};
    for (const k in this.j) this.target[k] = [0, 0, 0];

    this.actions = [];          // {name, t, dur, weight, side}
    this.rootOffset = new THREE.Vector3();
    this.rootLean = new THREE.Euler();
    this.expression = 0;
    this.focus = 0;
    this._bob = 0;
  }

  play(name, dur = 0.45, side = 1, power = 1) {
    // Re-triggering the same action restarts it rather than stacking.
    const ex = this.actions.find((a) => a.name === name);
    if (ex) { ex.t = 0; ex.dur = dur; ex.side = side; ex.power = power; return ex; }
    const a = { name, t: 0, dur, side, power };
    this.actions.push(a);
    return a;
  }
  isPlaying(name) { return this.actions.some((a) => a.name === name); }
  stop(name) { this.actions = this.actions.filter((a) => a.name !== name); }

  set(joint, x, y, z) { const t = this.target[joint]; if (t) { t[0] = x; t[1] = y; t[2] = z; } }
  add(joint, x, y, z, w = 1) {
    const t = this.target[joint];
    if (t) { t[0] += x * w; t[1] += y * w; t[2] += z * w; }
  }
  clear() { for (const k in this.target) { const t = this.target[k]; t[0] = t[1] = t[2] = 0; } this.quatTarget = {}; }

  /**
   * @param {object} s state from the player controller:
   *   mode, speed, maxSpeed, grounded, velY, aimLocal, swingDir, wallNormalLocal,
   *   crouch, lookPitch, lookYaw, damageFlinch
   */
  update(dt, s) {
    this.t += dt;
    this.clear();

    const speed = s.speed || 0;
    const run = clamp01(speed / 11.5);
    // Stride frequency scales with the square root of speed — the same curve
    // real gait uses, and the reason walk->run reads as a transition not a warp.
    const strideRate = speed > 0.2 ? clamp(1.35 * Math.sqrt(Math.max(speed, 0.4)) , 1.2, 9.5) : 0;
    if (s.mode === 'ground') this.stridePhase += strideRate * dt * Math.PI;
    else if (s.mode === 'wallrun') this.stridePhase += 9 * dt * Math.PI;
    else if (s.mode === 'wallcrawl') this.stridePhase += (0.5 + speed * 0.9) * dt * Math.PI;

    switch (s.mode) {
      case 'ground': this.poseGround(s, run); break;
      case 'air': this.poseAir(s); break;
      case 'dive': this.poseDive(s); break;
      case 'swing': this.poseSwing(s); break;
      case 'zip': this.poseZip(s); break;
      case 'wallrun': this.poseWallRun(s); break;
      case 'wallcrawl': this.poseWallCrawl(s); break;
      case 'perch': this.posePerch(s); break;
      case 'ko': this.poseKO(s); break;
      default: this.poseGround(s, run);
    }

    // additive one-shots
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const a = this.actions[i];
      a.t += dt;
      const k = a.t / a.dur;
      if (k >= 1) { this.actions.splice(i, 1); continue; }
      this.applyAction(a, k, s);
    }

    // head look — always alive, even mid-combat
    const lookW = s.mode === 'swing' || s.mode === 'dive' ? 0.35 : 1;
    this.add('head', clamp(-(s.lookPitch || 0) * 0.55, -0.5, 0.5) * lookW,
                     clamp((s.lookYawDelta || 0) * 0.6, -0.7, 0.7) * lookW, 0);
    this.add('neck', clamp(-(s.lookPitch || 0) * 0.25, -0.3, 0.3) * lookW, 0, 0);

    this.commit(dt);
    this.rig.setExpression(this.expression, this.focus);
    this.expression = damp(this.expression, s.expressionBase || 0, 6, dt);
    this.focus = damp(this.focus, s.focusBase || 0, 5, dt);
  }

  /* ------------------------------------------------------------- poses */

  poseGround(s, run) {
    const p = this.stridePhase;
    const moving = (s.speed || 0) > 0.35;
    const amp = lerp(0.28, 0.95, run);
    const crouch = s.crouch || 0;

    if (!moving) {
      // idle: weight shift, breath, hands loose
      const b = Math.sin(this.t * 1.5), b2 = Math.sin(this.t * 0.72);
      this.set('spine', 0.03 + b * 0.022, b2 * 0.05, 0);
      this.set('chest', -0.02 + b * 0.03, 0, 0);
      this.set('hips', 0.02, b2 * 0.04, b2 * 0.03);
      this.set('armL', 0.06 + b * 0.03, 0, 0.16);
      this.set('armR', 0.06 + b * 0.03, 0, -0.16);
      this.set('foreL', -0.35, 0, 0.03);
      this.set('foreR', -0.35, 0, -0.03);
      this.set('thighL', -0.04, 0, 0.03);
      this.set('thighR', -0.04, 0, -0.03);
      this.set('shinL', 0.07, 0, 0); this.set('shinR', 0.07, 0, 0);
      this._bob = damp(this._bob, 0, 8, 0.016);
    } else {
      const sinL = Math.sin(p), sinR = Math.sin(p + Math.PI);
      const kneeL = Math.max(0, -Math.sin(p - 0.7)), kneeR = Math.max(0, -Math.sin(p + Math.PI - 0.7));
      this.set('thighL', sinL * amp * 0.85, 0, 0.03);
      this.set('thighR', sinR * amp * 0.85, 0, -0.03);
      this.set('shinL', kneeL * amp * 1.5 + 0.06, 0, 0);
      this.set('shinR', kneeR * amp * 1.5 + 0.06, 0, 0);
      this.set('footL', -sinL * amp * 0.35 + 0.1, 0, 0);
      this.set('footR', -sinR * amp * 0.35 + 0.1, 0, 0);
      // counter-rotating shoulders and hips: the thing that makes a run read as a run
      this.set('armL', sinR * amp * 0.85, 0, 0.14 + run * 0.06);
      this.set('armR', sinL * amp * 0.85, 0, -0.14 - run * 0.06);
      this.set('foreL', -0.42 - run * 0.55 - Math.max(0, sinR) * 0.35, 0, 0);
      this.set('foreR', -0.42 - run * 0.55 - Math.max(0, sinL) * 0.35, 0, 0);
      this.set('hips', 0.02 + run * 0.06, -sinL * 0.10, Math.cos(p) * 0.05);
      this.set('spine', 0.06 + run * 0.36, sinL * 0.10, 0);
      this.set('chest', run * 0.12, sinL * 0.13, 0);
      this.set('neck', -run * 0.30, 0, 0);
      this._bob = Math.abs(Math.sin(p)) * 0.035 * (0.4 + run);
    }

    if (crouch > 0.01) {
      const c = crouch;
      this.add('thighL', -1.05, 0, 0.16, c); this.add('thighR', -1.05, 0, -0.16, c);
      this.add('shinL', 1.7, 0, 0, c); this.add('shinR', 1.7, 0, 0, c);
      this.add('spine', 0.42, 0, 0, c);
      this.add('armL', -0.3, 0, 0.2, c); this.add('armR', -0.3, 0, -0.2, c);
      this._bob -= 0.42 * c;
    }

    this.rootOffset.set(0, this._bob, 0);
    this.rootLean.set(lerp(0, 0.10, run), 0, clamp(-(s.turnRate || 0) * 0.35, -0.3, 0.3));
  }

  poseAir(s) {
    const rising = (s.velY || 0) > 1.5;
    const t = this.t;
    if (rising) {
      // tuck and reach
      this.set('thighL', -1.15, 0, 0.14); this.set('thighR', -0.5, 0, -0.1);
      this.set('shinL', 1.55, 0, 0); this.set('shinR', 0.85, 0, 0);
      this.set('armL', -2.35, 0, 0.45); this.set('armR', -1.5, 0, -0.6);
      this.set('foreL', -0.55, 0, 0); this.set('foreR', -0.9, 0, 0);
      this.set('spine', -0.16, 0.1, 0);
      this.rootLean.set(-0.18, 0, 0.05);
    } else {
      // falling: wide, controlled, slight flutter
      const f = Math.sin(t * 6) * 0.05;
      this.set('armL', -1.35 + f, 0.25, 1.15);
      this.set('armR', -1.35 - f, -0.25, -1.15);
      this.set('foreL', -0.45, 0, -0.25); this.set('foreR', -0.45, 0, 0.25);
      this.set('thighL', 0.28 + f, 0, 0.22); this.set('thighR', -0.42 - f, 0, -0.24);
      this.set('shinL', 0.55, 0, 0); this.set('shinR', 0.95, 0, 0);
      this.set('spine', -0.22, 0, 0); this.set('chest', -0.12, 0, 0);
      this.set('neck', 0.2, 0, 0);
      this.rootLean.set(-0.30 + Math.sin(t * 1.7) * 0.05, 0, Math.sin(t * 1.3) * 0.07);
      this.expression = 0.22;
    }
    this.rootOffset.set(0, 0, 0);
  }

  poseDive(s) {
    // superman dive: streamlined, arms swept back, legs together and pointed
    this.set('armL', -2.9, 0.3, 0.28); this.set('armR', -2.9, -0.3, -0.28);
    this.set('foreL', -0.25, 0, 0); this.set('foreR', -0.25, 0, 0);
    this.set('thighL', 0.16, 0, 0.05); this.set('thighR', 0.16, 0, -0.05);
    this.set('shinL', 0.12, 0, 0); this.set('shinR', 0.12, 0, 0);
    this.set('footL', 0.55, 0, 0); this.set('footR', 0.55, 0, 0);
    this.set('spine', -0.1, 0, 0); this.set('neck', 0.55, 0, 0);
    this.rootLean.set(-1.32, 0, Math.sin(this.t * 2.1) * 0.06);
    this.rootOffset.set(0, 0.05, 0);
    this.expression = 0.5; this.focus = 0.4;
  }

  poseSwing(s) {
    // A clean one-hand hang with a readable C-curve through the torso. Keep the
    // silhouette broad enough to read at speed without twisting joints past
    // their believable range.
    const swing = s.swingPhase || 0;
    const pump = Math.sin(swing);
    const speed = clamp01((s.speed || 0) / 52);
    const tension = s.swingTension || 0;
    const side = s.webSide === -1 ? -1 : 1;        // 1 = right hand
    const A = side > 0 ? 'armR' : 'armL';
    const F = side > 0 ? 'foreR' : 'foreL';
    const A2 = side > 0 ? 'armL' : 'armR';
    const F2 = side > 0 ? 'foreL' : 'foreR';

    // aim the shooting arm at the anchor
    if (s.anchorLocal) {
      _v.copy(s.anchorLocal).normalize();
      this.aim(A, _v, side > 0 ? -0.045 : 0.045);
      this.set(F, -0.08 - tension * 0.08, 0, 0);
    } else {
      this.set(A, -2.55, 0, side * 0.22);
      this.set(F, -0.16, 0, 0);
    }
    this.set(A2, -0.95 + pump * 0.28, 0, side * (0.62 + speed * 0.18));
    this.set(F2, -0.72 - pump * 0.18, 0, -side * 0.08);

    const legSwing = pump * 0.36;
    this.set('thighL', 0.18 + legSwing, 0, 0.12);
    this.set('thighR', 0.05 - legSwing, 0, -0.12);
    this.set('shinL', 0.68 - legSwing * 0.42, 0, 0);
    this.set('shinR', 0.92 + legSwing * 0.42, 0, 0);
    this.set('footL', 0.22, 0, 0); this.set('footR', 0.22, 0, 0);
    this.set('hips', -0.04 + pump * 0.08, -side * 0.05, 0);
    this.set('spine', -0.18 + pump * 0.12, side * 0.10, 0);
    this.set('chest', -0.10, side * 0.07, 0);
    this.set('neck', 0.26, 0, 0);
    this.rootLean.set(-0.26 + pump * 0.12 - speed * 0.08, 0,
      clamp((s.bankAngle || 0), -0.52, 0.52));
    this.rootOffset.set(0, 0, 0);
    this.expression = 0.28; this.focus = 0.55;
  }

  poseZip(s) {
    const side = s.webSide === -1 ? -1 : 1;
    const A = side > 0 ? 'armR' : 'armL';
    const A2 = side > 0 ? 'armL' : 'armR';
    if (s.anchorLocal) { _v.copy(s.anchorLocal).normalize(); this.aim(A, _v, 0); }
    else this.set(A, -3.0, 0, 0);
    this.set(A2, -2.4, 0, side * 0.5);
    this.set('thighL', 0.5, 0, 0.12); this.set('thighR', 0.5, 0, -0.12);
    this.set('shinL', 0.9, 0, 0); this.set('shinR', 0.9, 0, 0);
    this.set('spine', -0.28, 0, 0);
    this.rootLean.set(-0.5, 0, 0);
    this.expression = 0.45; this.focus = 0.8;
  }

  poseWallRun(s) {
    const p = this.stridePhase;
    const sL = Math.sin(p), sR = Math.sin(p + Math.PI);
    // vertical climb: opposing limbs reach and drive
    this.set('armL', -2.5 + sR * 0.8, 0.15, 0.45);
    this.set('armR', -2.5 + sL * 0.8, -0.15, -0.45);
    this.set('foreL', -0.55 - Math.max(0, sR) * 0.5, 0, 0);
    this.set('foreR', -0.55 - Math.max(0, sL) * 0.5, 0, 0);
    this.set('thighL', -0.95 + sL * 0.7, 0, 0.2);
    this.set('thighR', -0.95 + sR * 0.7, 0, -0.2);
    this.set('shinL', 1.15 - sL * 0.5, 0, 0);
    this.set('shinR', 1.15 - sR * 0.5, 0, 0);
    this.set('spine', 0.12, 0, 0);
    this.set('neck', -0.55, 0, 0);
    this.rootLean.set(0, 0, 0);
    this.rootOffset.set(0, 0, 0);
    this.expression = 0.3;
  }

  poseWallCrawl(s) {
    const p = this.stridePhase;
    const sL = Math.sin(p), sR = Math.sin(p + Math.PI);
    // splayed spider crawl — elbows and knees out
    this.set('armL', -1.75 + sL * 0.45, 0.55, 1.0);
    this.set('armR', -1.75 + sR * 0.45, -0.55, -1.0);
    this.set('foreL', -1.15, 0, -0.3); this.set('foreR', -1.15, 0, 0.3);
    this.set('thighL', -1.15 + sR * 0.4, 0, 0.75);
    this.set('thighR', -1.15 + sL * 0.4, 0, -0.75);
    this.set('shinL', 1.5, 0, 0); this.set('shinR', 1.5, 0, 0);
    this.set('spine', 0.18, 0, 0);
    this.set('chest', 0.1, 0, 0);
    this.set('neck', -0.75, 0, 0);
    this.rootOffset.set(0, -0.18, 0);
    this.rootLean.set(0, 0, 0);
  }

  posePerch(s) {
    const b = Math.sin(this.t * 1.2) * 0.02;
    this.set('thighL', -1.85, 0, 0.35); this.set('thighR', -1.6, 0, -0.3);
    this.set('shinL', 2.0, 0, 0); this.set('shinR', 1.5, 0, 0);
    this.set('footL', 0.3, 0, 0); this.set('footR', 0.15, 0, 0);
    this.set('armL', -0.55, 0.2, 0.5); this.set('armR', -0.15, 0, -0.35);
    this.set('foreL', -0.9, 0, 0); this.set('foreR', -0.4, 0, 0);
    this.set('spine', 0.55 + b, 0.08, 0);
    this.set('chest', -0.12, 0, 0);
    this.set('neck', -0.42, 0, 0);
    this.rootOffset.set(0, -0.42, 0);
    this.rootLean.set(0.14, 0, 0);
    this.focus = 0.25;
  }

  poseKO(s) {
    this.set('spine', 0.5, 0, 0.3);
    this.set('armL', -0.4, 0, 1.2); this.set('armR', -0.4, 0, -1.2);
    this.set('thighL', -0.6, 0, 0.4); this.set('thighR', -0.3, 0, -0.4);
    this.set('shinL', 0.9, 0, 0); this.set('shinR', 1.2, 0, 0);
    this.set('neck', 0.4, 0, 0.3);
    this.rootLean.set(-1.4, 0, 0.2);
    this.rootOffset.set(0, -0.75, 0);
  }

  /* ----------------------------------------------------------- actions */

  applyAction(a, k, s) {
    // bell curve: fast out, slower recovery
    const strike = k < 0.35 ? smoothstep(k / 0.35) : 1 - smoothstep((k - 0.35) / 0.65);
    const w = strike * (a.power || 1);
    const side = a.side >= 0 ? 1 : -1;
    const A = side > 0 ? 'armR' : 'armL';
    const F = side > 0 ? 'foreR' : 'foreL';
    const A2 = side > 0 ? 'armL' : 'armR';
    const T = side > 0 ? 'thighR' : 'thighL';
    const S = side > 0 ? 'shinR' : 'shinL';

    switch (a.name) {
      case 'punch': {
        const ext = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
        this.add(A, -1.45 * ext, side * -0.25 * ext, side * 0.15 * ext, 1);
        this.add(F, 1.2 * (1 - ext) - 0.2, 0, 0, 1);
        this.add('chest', 0, -side * 0.55 * ext, 0);
        this.add('hips', 0, -side * 0.30 * ext, 0);
        this.add(A2, 0.55 * ext, 0, side * 0.35 * ext);
        this.expression = Math.max(this.expression, 0.65 * ext);
        break;
      }
      case 'uppercut': {
        const ext = k < 0.28 ? k / 0.28 : 1 - (k - 0.28) / 0.72;
        this.add(A, -2.5 * ext, 0, side * 0.35 * ext);
        this.add(F, -0.9 * ext, 0, 0);
        this.add('spine', -0.35 * ext, 0, 0);
        this.expression = Math.max(this.expression, 0.8 * ext);
        break;
      }
      case 'kick': {
        const ext = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
        this.add(T, 1.75 * ext, 0, -side * 0.2 * ext);
        this.add(S, -1.25 * ext + 0.5 * (1 - ext), 0, 0);
        this.add('spine', -0.35 * ext, side * 0.25 * ext, 0);
        this.add(A2, -0.9 * ext, 0, -side * 0.6 * ext);
        this.rootLean.x -= 0.25 * ext;
        this.expression = Math.max(this.expression, 0.6 * ext);
        break;
      }
      case 'airkick': {
        const ext = Math.sin(k * Math.PI);
        this.add(T, 1.9 * ext, 0, 0); this.add(S, -1.4 * ext, 0, 0);
        this.add('spine', -0.5 * ext, 0, 0);
        this.rootLean.x -= 0.55 * ext;
        break;
      }
      case 'webshoot': {
        const ext = k < 0.22 ? k / 0.22 : 1 - (k - 0.22) / 0.78;
        const dir = s && s.aimLocal ? _v.copy(s.aimLocal).normalize() : null;
        if (dir) this.aimAdd(A, dir, ext);
        else this.add(A, -1.35 * ext, 0, side * 0.2 * ext);
        this.add(F, -0.15 * ext, 0, side * 0.55 * ext);   // the classic two-finger flick
        this.add('chest', 0, -side * 0.22 * ext, 0);
        this.focus = Math.max(this.focus, 0.9 * ext);
        break;
      }
      case 'land': {
        const c = 1 - k;
        const soft = c * c * (a.power || 1);
        this.add('thighL', -1.35 * soft, 0, 0.22 * soft);
        this.add('thighR', -1.35 * soft, 0, -0.22 * soft);
        this.add('shinL', 2.1 * soft, 0, 0); this.add('shinR', 2.1 * soft, 0, 0);
        this.add('spine', 0.75 * soft, 0, 0);
        this.add('armL', -0.5 * soft, 0.3 * soft, 0.9 * soft);
        this.add('armR', 0.25 * soft, 0, -0.5 * soft);
        this.add('foreR', -1.1 * soft, 0, 0);
        this.rootOffset.y -= 0.55 * soft;
        this.expression = Math.max(this.expression, soft * 0.7);
        break;
      }
      case 'dodge': {
        const ext = Math.sin(k * Math.PI);
        this.rootLean.z += side * 0.9 * ext;
        this.rootLean.x -= 0.3 * ext;
        this.add('spine', -0.35 * ext, side * 0.4 * ext, 0);
        this.add('armL', -0.6 * ext, 0, -0.8 * ext);
        this.add('armR', -0.6 * ext, 0, 0.8 * ext);
        this.add('thighL', -0.5 * ext, 0, 0); this.add('thighR', -0.5 * ext, 0, 0);
        this.expression = Math.max(this.expression, ext);
        break;
      }
      case 'flinch': {
        const ext = 1 - k;
        this.add('spine', 0.4 * ext, side * 0.25 * ext, 0);
        this.add('chest', 0.25 * ext, 0, 0);
        this.add('armL', 0.4 * ext, 0, -0.4 * ext);
        this.add('armR', 0.4 * ext, 0, 0.4 * ext);
        this.rootLean.x += 0.28 * ext;
        this.expression = Math.max(this.expression, ext);
        break;
      }
      case 'throw': {
        const ext = Math.sin(k * Math.PI);
        this.add(A, -2.2 * ext, 0, side * 0.5 * ext);
        this.add('chest', 0, -side * 0.7 * ext, 0);
        this.add('hips', 0, -side * 0.4 * ext, 0);
        break;
      }
      case 'taunt': {
        const ext = Math.sin(k * Math.PI);
        this.add(A, -1.9 * ext, 0, side * 0.9 * ext);
        this.add(F, -0.9 * ext, 0, 0);
        this.add('neck', -0.25 * ext, 0, 0);
        break;
      }
    }
  }

  /* ------------------------------------------------------------- aiming */

  /** Point a limb's -Y axis along `dirLocal` (character space). */
  aim(joint, dirLocal, roll = 0) {
    const jt = this.j[joint];
    if (!jt) return;
    // convert character-space direction into the joint's parent space
    jt.parent.updateWorldMatrix(true, false);
    _m1.copy(jt.parent.matrixWorld).invert();
    _v2.copy(dirLocal).transformDirection(_mChar);
    _v2.transformDirection(_m1).normalize();
    _q.setFromUnitVectors(DOWN, _v2);
    if (roll) { _q2.setFromAxisAngle(_v2, roll); _q.premultiply(_q2); }
    this.quatTarget[joint] = _q.clone();
  }
  aimAdd(joint, dirLocal, weight) {
    this.aim(joint, dirLocal, 0);
    const q = this.quatTarget[joint];
    if (q && weight < 1) {
      _e.set(this.target[joint][0], this.target[joint][1], this.target[joint][2]);
      _q2.setFromEuler(_e);
      q.copy(_q2.slerp(q, clamp01(weight)));
    }
  }

  /* -------------------------------------------------------------- commit */

  commit(dt) {
    const rig = this.rig;
    for (const name in this.j) {
      const jt = this.j[name];
      const speed = JOINT_SPEED[name] || 12;
      const k = 1 - Math.exp(-speed * dt);
      const qt = this.quatTarget[name];
      if (qt) { jt.quaternion.slerp(qt, k); continue; }
      const t = this.target[name];
      _e.set(t[0], t[1], t[2], 'XYZ');
      _q.setFromEuler(_e);
      jt.quaternion.slerp(_q, k);
    }
    // body offset + lean applied on a wrapper the controller owns
    rig.root.position.y = damp(rig.root.position.y, this.rootOffset.y, 14, dt);
    rig.root.rotation.x = damp(rig.root.rotation.x, this.rootLean.x, 11, dt);
    rig.root.rotation.z = damp(rig.root.rotation.z, this.rootLean.z, 11, dt);
  }

  /** The controller hands us the character's world matrix each frame for aiming. */
  setCharacterMatrix(m) { _mChar.copy(m); }
}

const _m1 = new THREE.Matrix4();
const _mChar = new THREE.Matrix4();
const _v2 = new THREE.Vector3();
const _q2 = new THREE.Quaternion();
