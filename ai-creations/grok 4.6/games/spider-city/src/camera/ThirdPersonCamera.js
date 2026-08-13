/* camera/ThirdPersonCamera.js
   Over-the-shoulder action camera.

   Everything that makes a third-person camera feel expensive is here and
   nowhere else: spring-damped position (not lerp), a look-target that leads the
   player's velocity, speed-driven FOV, roll that banks into swings, trauma-based
   shake with noise rather than a sine, occlusion pull-in with a hysteresis so it
   doesn't chatter around corners, and a cinematic mode that takes full control
   for scripted moments. */

import * as THREE from 'three';
import { TUNING } from '../core/Settings.js';
import { clamp, clamp01, lerp, damp, dampVec3, smootherstep, shortestAngle } from '../core/MathUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

export class ThirdPersonCamera {
  constructor(camera, world, settings) {
    this.camera = camera;
    this.world = world;
    this.settings = settings;

    this.yaw = 0;
    this.pitch = -0.12;
    this.distance = TUNING.cameraDistance;
    this.targetDistance = TUNING.cameraDistance;
    this.shoulder = TUNING.cameraShoulder;

    this.position = new THREE.Vector3(0, 8, 10);
    this.lookAt = new THREE.Vector3();
    this.lookSmoothed = new THREE.Vector3();
    this.velocityLead = new THREE.Vector3();

    this.trauma = 0;
    this.shakeSeed = Math.random() * 100;
    this.roll = 0;
    this.fov = settings.fov;
    this.baseFov = settings.fov;

    this.cinematic = null;
    this.hit = { hit: false, point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, index: -1 };

    this.lockTarget = null;
    this._occl = 0;
  }

  shake(amount, decayTime = 0.4) {
    this.trauma = clamp01(this.trauma + amount);
    this._decay = decayTime;
  }

  /* ------------------------------------------------------------ input */
  handleMouse(input) {
    if (this.cinematic) return;
    this.yaw -= input.mouse.dx;
    // The camera boom points from the player to the camera, so moving the
    // pointer down must raise the boom (and make the view look down).
    this.pitch += input.mouse.dy;
    this.pitch = clamp(this.pitch, -1.32, 1.18);
    if (input.mouse.wheel) {
      this.targetDistance = clamp(this.targetDistance + input.mouse.wheel * 0.6, 3.2, 11);
    }
  }

  /* ----------------------------------------------------------- update */
  update(dt, player) {
    if (this.cinematic) { this.updateCinematic(dt); return; }

    const state = player.state;
    const speed = player.speed;

    // During traversal the camera gently settles behind momentum. Manual look
    // still wins immediately, but a released mouse no longer leaves the swing
    // travelling sideways across the frame.
    if (state === 'swing' && speed > 8 && !this.lockTarget) {
      const wantTravelYaw = Math.atan2(-player.velocity.x, -player.velocity.z);
      this.yaw += shortestAngle(this.yaw, wantTravelYaw) * (1 - Math.exp(-0.85 * dt));
    }

    /* --- look target: chest height, led by velocity so fast movement reads --- */
    _target.copy(player.position).addScaledVector(UP, TUNING.cameraHeight);
    const lead = state === 'swing' || state === 'dive' || state === 'zip' ? 0.16 : 0.06;
    dampVec3(this.velocityLead, _lead.copy(player.velocity).multiplyScalar(lead), 4, dt);
    _target.add(this.velocityLead);
    dampVec3(this.lookSmoothed, _target, state === 'ground' ? 16 : 9, dt);

    /* --- lock-on --- */
    if (this.lockTarget && this.lockTarget.alive) {
      _toTarget.copy(this.lockTarget.position).sub(player.position);
      const wantYaw = Math.atan2(_toTarget.x, _toTarget.z) + Math.PI;
      this.yaw += shortestAngle(this.yaw, wantYaw) * (1 - Math.exp(-6 * dt));
      const wantPitch = clamp(-Math.atan2(_toTarget.y - 1.2, Math.hypot(_toTarget.x, _toTarget.z)) - 0.12, -0.9, 0.5);
      this.pitch += (wantPitch - this.pitch) * (1 - Math.exp(-4 * dt));
    }

    /* --- automatic framing per state --- */
    let wantDist = this.targetDistance;
    let wantHeight = 0;
    let wantRoll = 0;
    let wantFovAdd = 0;

    switch (state) {
      case 'swing':
        wantDist = this.targetDistance + 2.1 + clamp01(speed / 45) * 1.9;
        wantRoll = -player.bankAngle * 0.55;
        wantFovAdd = clamp01(speed / 52) * 18;
        wantHeight = 0.5;
        break;
      case 'dive':
        wantDist = this.targetDistance + 1.6;
        wantFovAdd = clamp01(speed / 55) * 28;
        wantHeight = 0.2;
        break;
      case 'zip':
        wantDist = this.targetDistance + 1.2;
        wantFovAdd = 16;
        break;
      case 'wallrun':
      case 'wallcrawl':
        wantDist = this.targetDistance + 0.9;
        wantHeight = 0.7;
        break;
      case 'perch':
        wantDist = this.targetDistance + 2.4;
        wantHeight = 0.4;
        break;
      case 'ko':
        wantDist = this.targetDistance + 3.0;
        break;
      default:
        wantFovAdd = clamp01((speed - 9) / 12) * 7;
    }

    this.distance = damp(this.distance, wantDist, 4.5, dt);
    this.roll = damp(this.roll, wantRoll, 5, dt);
    this.fov = damp(this.fov, this.baseFov + wantFovAdd, 4.0, dt);

    /* --- desired position --- */
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    _dir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).normalize();
    _right.crossVectors(_dir, UP).normalize();

    _desired.copy(this.lookSmoothed)
      .addScaledVector(_dir, this.distance)
      .addScaledVector(_right, -this.shoulder)
      .addScaledVector(UP, wantHeight);

    /* --- occlusion: pull in along the boom --- */
    _boom.copy(_desired).sub(this.lookSmoothed);
    const boomLen = _boom.length();
    _boom.divideScalar(boomLen || 1);
    let allowed = boomLen;
    if (this.world.grid.raycast(
      this.lookSmoothed.x, this.lookSmoothed.y, this.lookSmoothed.z,
      _boom.x, _boom.y, _boom.z, boomLen + 0.6, this.hit)) {
      allowed = Math.max(1.1, this.hit.distance - 0.45);
    }
    // hysteresis: snap in immediately, ease back out
    this._occl = allowed < this._occl || this._occl === 0
      ? allowed
      : damp(this._occl, allowed, 3.2, dt);
    _desired.copy(this.lookSmoothed).addScaledVector(_boom, this._occl);

    const follow = state === 'ground' ? 13 : state === 'swing' ? 7.5 : 9;
    dampVec3(this.position, _desired, follow, dt);

    /* --- shake --- */
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt / (this._decay || 0.4));
      const s = this.trauma * this.trauma;
      const t = performance.now() * 0.001 + this.shakeSeed;
      _shake.set(
        (noise1(t * 31.1) - 0.5) * 2 * s * 0.85,
        (noise1(t * 27.7 + 12.3) - 0.5) * 2 * s * 0.85,
        (noise1(t * 23.3 + 41.9) - 0.5) * 2 * s * 0.55);
      this.camera.position.copy(this.position).add(_shake);
      this.roll += (noise1(t * 19.1 + 7.7) - 0.5) * s * 0.14;
    } else {
      this.camera.position.copy(this.position);
    }

    /* --- orientation --- */
    _lookPoint.copy(this.lookSmoothed).addScaledVector(UP, 0.15);
    this.camera.up.set(Math.sin(this.roll), Math.cos(this.roll), 0)
      .applyAxisAngle(UP, this.yaw).normalize();
    this.camera.lookAt(_lookPoint);

    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /* -------------------------------------------------------- cinematic */
  /**
   * @param {Array} shots [{from:Vec3, to:Vec3, look:Vec3, lookTo:Vec3, dur, fov, ease}]
   * @param {Function} onDone
   */
  playCinematic(shots, onDone) {
    this.cinematic = { shots, index: 0, t: 0, onDone };
  }
  stopCinematic() {
    if (this.cinematic?.onDone) this.cinematic.onDone();
    this.cinematic = null;
  }

  updateCinematic(dt) {
    const c = this.cinematic;
    const shot = c.shots[c.index];
    if (!shot) { this.stopCinematic(); return; }
    c.t += dt;
    const k = clamp01(c.t / shot.dur);
    const e = shot.ease === 'linear' ? k : smootherstep(k);

    _desired.lerpVectors(shot.from, shot.to || shot.from, e);
    this.camera.position.copy(_desired);
    _lookPoint.lerpVectors(shot.look, shot.lookTo || shot.look, e);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(_lookPoint);
    this.position.copy(_desired);
    this.lookSmoothed.copy(_lookPoint);

    const f = shot.fov || this.baseFov;
    if (Math.abs(this.camera.fov - f) > 0.01) { this.camera.fov = damp(this.camera.fov, f, 4, dt); this.camera.updateProjectionMatrix(); }

    if (k >= 1) {
      c.index++; c.t = 0;
      if (c.index >= c.shots.length) {
        // hand back to gameplay pointing where the cinematic ended
        _dir.copy(this.camera.position).sub(_lookPoint);
        this.yaw = Math.atan2(_dir.x, _dir.z);
        this.pitch = clamp(Math.asin(clamp(_dir.y / (_dir.length() || 1), -1, 1)), -1.2, 1.1);
        this.stopCinematic();
      }
    }
  }

  /** Orbit shot around a point — the money shot for mission intros. */
  orbitShot(center, radius, height, duration, turns = 1) {
    const shots = [];
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2 * turns;
      const a1 = ((i + 1) / steps) * Math.PI * 2 * turns;
      shots.push({
        from: new THREE.Vector3(center.x + Math.cos(a0) * radius, center.y + height, center.z + Math.sin(a0) * radius),
        to: new THREE.Vector3(center.x + Math.cos(a1) * radius, center.y + height, center.z + Math.sin(a1) * radius),
        look: center.clone(), lookTo: center.clone(),
        dur: duration / steps, fov: 44, ease: 'linear',
      });
    }
    return shots;
  }

  setFov(v) { this.baseFov = v; }
}

/* Cheap deterministic 1-D value noise — smoother than sin() for shake. */
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = fract(Math.sin(i * 127.1) * 43758.5453);
  const b = fract(Math.sin((i + 1) * 127.1) * 43758.5453);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
const fract = (v) => v - Math.floor(v);

const _target = new THREE.Vector3();
const _lead = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _boom = new THREE.Vector3();
const _shake = new THREE.Vector3();
const _lookPoint = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
