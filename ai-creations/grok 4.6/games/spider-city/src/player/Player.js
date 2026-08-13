/* player/Player.js
   The hero: state machine, traversal physics and the glue to animation.

   States: ground | air | dive | swing | zip | wallrun | wallcrawl | perch | ko

   The swing is the centre of gravity of this whole project. It is a real
   pendulum — gravity integrates the velocity, a hard distance constraint on the
   rope removes the radial component, and the player injects energy by reeling in
   on the way down (exactly how a swing is pumped). Nothing is animated along a
   path; if you attach high and release at the bottom of the arc you go fast
   because the maths says so.
*/

import * as THREE from 'three';
import { TUNING } from '../core/Settings.js';
import { CharacterBody } from '../physics/CharacterBody.js';
import { makeHitResult } from '../physics/SpatialGrid.js';
import { buildCharacter, makeSuitMaterials } from './CharacterRig.js';
import { Animator } from './Animator.js';
import { WebLine } from '../swinging/WebLine.js';
import {
  clamp, clamp01, lerp, damp, dampAngle, smoothstep, kmh, dampQuaternionToBasis,
} from '../core/MathUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.input = game.input;

    this.object = new THREE.Group();
    this.object.name = 'Player';
    game.scene.add(this.object);

    this.rig = buildCharacter(makeSuitMaterials(), { height: 1.0 });
    this.object.add(this.rig.root);
    this.animator = new Animator(this.rig);

    // A restrained character-only fill keeps the suit readable against bright
    // sky and dark facades without flattening the rest of the city lighting.
    this.heroFill = new THREE.PointLight(0xe5efff, 0.45, 8, 2);
    this.heroFill.position.set(-1.4, 3.0, 2.2);
    this.heroFill.layers.set(1);
    this.object.add(this.heroFill);
    this.rig.root.traverse((o) => { if (o.isMesh) o.layers.enable(1); });
    game.camera3.layers.enable(1);

    this.body = new CharacterBody(game.world.grid, 0.40, 1.78);
    this.body.position.set(0, 0, 0);

    this.state = 'air';
    this.prevState = 'air';
    this.stateTime = 0;

    /* traversal */
    this.anchor = new THREE.Vector3();
    this.hasAnchor = false;
    this.ropeLength = 0;
    this.webSide = 1;
    this.swingPhase = 0;
    this.bankAngle = 0;
    this.swingTension = 0;
    this.swingAttachCooldown = 0;
    this.zipTarget = new THREE.Vector3();
    this.wallNormal = new THREE.Vector3();
    this.wallTime = 0;
    this.coyote = 0;
    this.jumpCharge = 0;
    this.airTime = 0;
    this.lastGroundY = 0;
    this.perchAllowed = false;

    /* stats */
    this.health = TUNING.maxHealth;
    this.focus = TUNING.maxFocus;
    this.xp = 0;
    this.level = 1;
    this.invuln = 0;
    this.dodgeTimer = 0;
    this.perfectDodge = 0;

    /* visuals */
    this.webA = new WebLine();
    this.webB = new WebLine();
    game.scene.add(this.webA.mesh, this.webB.mesh);
    this.dualWeb = false;

    this.orient = new THREE.Quaternion();
    this.facing = new THREE.Vector3(0, 0, 1);
    this.moveDir = new THREE.Vector3();
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.aimOrigin = new THREE.Vector3();
    this.hit = makeHitResult();
    this._anchorLocal = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.turnRate = 0;
    this.lockOn = null;

    this.telemetry = { speed: 0, altitude: 0 };
  }

  get position() { return this.body.position; }
  get velocity() { return this.body.velocity; }
  get speed() { return this.body.velocity.length(); }

  /** Where a web is fired from (roughly the shooting hand). */
  handPosition(out, side = this.webSide) {
    const j = side > 0 ? this.rig.joints.handR : this.rig.joints.handL;
    if (j) { j.getWorldPosition(out); return out; }
    return out.copy(this.position).addScaledVector(UP, 1.3);
  }
  chestPosition(out) { return out.copy(this.position).addScaledVector(UP, 1.32); }

  setState(s) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTime = 0;
    this.game.onPlayerState?.(s, this.prevState);
  }

  /* ==================================================================== */
  update(dt, camera) {
    this.stateTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.perfectDodge = Math.max(0, this.perfectDodge - dt);
    this.swingAttachCooldown = Math.max(0, this.swingAttachCooldown - dt);
    this.focus = Math.min(TUNING.maxFocus, this.focus + TUNING.focusRegen * dt);

    // camera-relative movement basis
    camera.getWorldDirection(_camFwd);
    this.aimDir.copy(_camFwd).normalize();
    this.aimOrigin.copy(camera.position);
    _camFlat.set(_camFwd.x, 0, _camFwd.z);
    if (_camFlat.lengthSq() < 1e-6) _camFlat.set(0, 0, 1);
    _camFlat.normalize();
    _camRight.crossVectors(_camFlat, UP).normalize();

    // Scripted shots take the controls: the hero holds their pose and the
    // camera does the acting. Everything else keeps simulating underneath.
    this.controlsLocked = !!this.game.cinematicMode;

    const ax = this.controlsLocked ? { x: 0, y: 0, len: 0 } : this.input.moveAxis();
    this.moveDir.set(0, 0, 0)
      .addScaledVector(_camFlat, ax.y)
      .addScaledVector(_camRight, ax.x);
    if (this.moveDir.lengthSq() > 1e-6) this.moveDir.normalize();
    this.inputMag = ax.len;

    switch (this.state) {
      case 'ground': this.updateGround(dt); break;
      case 'air': this.updateAir(dt); break;
      case 'dive': this.updateDive(dt); break;
      case 'swing': this.updateSwing(dt); break;
      case 'zip': this.updateZip(dt); break;
      case 'wallrun': this.updateWallRun(dt); break;
      case 'wallcrawl': this.updateWallCrawl(dt); break;
      case 'perch': this.updatePerch(dt); break;
      case 'ko': this.updateKO(dt); break;
    }

    this.body.integrate(dt);
    if (this.state === 'swing') this.solveSwingConstraint(dt);
    this.postPhysics(dt, camera);
    this.updateVisuals(dt, camera);
  }

  /* --------------------------------------------------------- ground */
  updateGround(dt) {
    const t = TUNING;
    const v = this.velocity;
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const crouching = this.input.down('KeyC');
    const target = sprint ? t.sprintSpeed : (this.inputMag > 0.75 ? t.runSpeed : t.walkSpeed * (this.inputMag / 0.75 || 1));
    const want = _want.copy(this.moveDir).multiplyScalar(target * this.inputMag);

    const accel = this.inputMag > 0.05 ? t.groundAccel : t.groundFriction;
    v.x = damp(v.x, want.x, accel * 0.35, dt);
    v.z = damp(v.z, want.z, accel * 0.35, dt);
    v.y -= t.gravity * dt * 0.4;

    // charge a super jump by holding crouch
    this.jumpCharge = crouching ? Math.min(t.jumpChargeTime, this.jumpCharge + dt) : 0;
    this.crouchAmount = damp(this.crouchAmount || 0, crouching ? 1 : 0, 12, dt);

    if (this.input.consume('jump')) {
      const charged = this.jumpCharge / t.jumpChargeTime;
      v.y = lerp(t.jumpImpulse, t.superJumpImpulse, charged);
      if (charged > 0.15) { v.x *= 1.25; v.z *= 1.25; this.game.fx.groundBurst(this.position); }
      this.jumpCharge = 0;
      this.setState('air');
      this.coyote = 0;
      this.game.audio.play('jump', this.position);
    }

    if (!this.body.grounded) {
      this.coyote += dt;
      if (this.coyote > 0.12) { this.setState('air'); this.airTime = 0; }
    } else { this.coyote = 0; this.lastGroundY = this.position.y; }

    this.tryWebActions(dt);
    this.tryPerch();
  }

  /* ------------------------------------------------------------ air */
  updateAir(dt) {
    const t = TUNING;
    const v = this.velocity;
    this.airTime += dt;

    v.y -= t.gravity * dt;
    const drag = 1 - t.airDrag * dt;
    v.x *= drag; v.z *= drag;
    v.y = Math.max(v.y, -t.terminalVelocity);

    // air control
    if (this.inputMag > 0.05) {
      v.x += this.moveDir.x * t.airControl * dt * this.inputMag;
      v.z += this.moveDir.z * t.airControl * dt * this.inputMag;
    }

    // dive
    if ((this.input.down('KeyC') || this.input.down('ControlLeft')) && v.y < 2) this.setState('dive');

    // wall interactions
    if (this.body.onWall) {
      const into = this.moveDir.dot(this.body.wallNormal) < -0.25;
      if (into && this.velocity.y > -22) {
        this.wallNormal.copy(this.body.wallNormal);
        this.wallTime = 0;
        this.setState(this.input.down('ShiftLeft') ? 'wallcrawl' : 'wallrun');
        this.game.audio.play('wallhit', this.position);
      }
    }

    if (this.input.consume('jump')) {
      if (this.body.onWall) {
        this.velocity.addScaledVector(this.body.wallNormal, TUNING.wallJumpImpulse);
        this.velocity.y = Math.max(this.velocity.y, TUNING.jumpImpulse * 0.9);
        this.animator.play('dodge', 0.4, 1);
        this.game.audio.play('jump', this.position);
      }
    }

    if (this.body.grounded) this.land();
    this.tryWebActions(dt);
  }

  updateDive(dt) {
    const t = TUNING;
    const v = this.velocity;
    v.y -= t.gravity * 1.35 * dt;
    const drag = 1 - t.diveDrag * dt;
    v.x *= drag; v.z *= drag;
    // steer the dive hard — this is the fastest way to travel and it should feel like it
    v.x += this.moveDir.x * 16 * dt * this.inputMag;
    v.z += this.moveDir.z * 16 * dt * this.inputMag;
    v.y = Math.max(v.y, -t.terminalVelocity * 1.25);

    if (!this.input.down('KeyC') && !this.input.down('ControlLeft')) this.setState('air');
    if (this.body.grounded) this.land();
    this.tryWebActions(dt);
  }

  land() {
    const impact = this.body.consumeImpact();
    const fall = Math.max(0, this.lastGroundY - this.position.y);
    const power = clamp01(impact / 34);
    this.setState('ground');
    this.animator.play('land', lerp(0.35, 0.85, power), 1, 0.35 + power);
    this.game.camera.shake(power * 0.9, 0.35);
    this.game.fx.landingDust(this.position, power);
    this.game.audio.play(power > 0.5 ? 'landHard' : 'land', this.position);
    if (impact > 46) this.damage((impact - 46) * 1.3, null, true);
    this.airTime = 0;
    this.detachWeb();
  }

  /* ---------------------------------------------------------- swing */
  tryWebActions(dt) {
    if (this.controlsLocked) { if (this.state === 'swing') this.releaseSwing(false); return; }
    const inp = this.input;

    // Hold RMB to swing. X is a keyboard toggle for trackpads, accessibility
    // and browser play-testing where pointer lock is unavailable.
    const swingHeld = inp.mouse.right || inp.webToggle;
    if (swingHeld) {
      if (this.state !== 'swing' && this.state !== 'zip' && this.swingAttachCooldown <= 0) this.tryAttach();
    } else if (this.state === 'swing') {
      this.releaseSwing(true);
    }

    if (inp.consume('zip')) this.tryZip();
    if (inp.consume('slingshot')) this.trySlingshot();
    if (inp.consume('perch')) this.tryPerch(true);
  }

  tryAttach() {
    const from = this.chestPosition(this._tmp);
    // Alternate hands so consecutive swings don't look mechanical.
    this.webSide = -this.webSide || 1;
    if (this.world.findAttachPoint(this.aimOrigin, this.aimDir, TUNING.webMaxRange, this.hit)) {
      this.anchor.copy(this.hit.point);
      this.hasAnchor = true;
      const d = this.anchor.distanceTo(from);
      // Start just inside the measured distance to establish tension. The
      // solver applies that correction over several frames, avoiding the old
      // multi-metre first-frame teleport.
      this.ropeLength = clamp(d, TUNING.swingMinRope, TUNING.webMaxRange);
      this.swingTension = 0;

      // A web fired from rest needs a readable launch, not a dead vertical hang.
      _travel.set(this.aimDir.x, 0, this.aimDir.z);
      if (_travel.lengthSq() < 1e-6) _travel.copy(this.facing).setY(0);
      _travel.normalize();
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizontalSpeed < TUNING.swingLaunchSpeed) {
        this.velocity.addScaledVector(_travel, TUNING.swingLaunchSpeed - horizontalSpeed);
      }
      const streetLaunch = this.position.y < 4.5;
      this.velocity.y = Math.max(this.velocity.y, streetLaunch ? 23.5 : 2.2);
      this.setState('swing');
      this.webA.fire();
      this.animator.play('webshoot', 0.3, this.webSide);
      this.game.audio.play('webshoot', this.position);
      this.game.audio.play('swingWhoosh', this.position);
      this.game.hud.pingReticle('web');
      return true;
    }
    this.swingAttachCooldown = 0.12;
    this.game.hud.pingReticle('miss');
    return false;
  }

  updateSwing(dt) {
    const t = TUNING;
    const v = this.velocity;
    const p = this.position;

    // rope anchor is measured from the chest, not the feet
    _shoulder.copy(p).addScaledVector(UP, 1.32);
    _rel.copy(_shoulder).sub(this.anchor);
    const dist = _rel.length();
    if (dist < 0.001) { this.releaseSwing(false); return; }
    _n.copy(_rel).divideScalar(dist);           // unit: anchor -> player

    /* forces */
    const launchGravity = this.stateTime < 0.45 ? 0.72 : 1;
    v.y -= t.gravity * launchGravity * dt;

    // Tangential steering preserves the pendulum. Input can shape the arc, but
    // never injects energy radially into the rope.
    _tangent.copy(v).addScaledVector(_n, -v.dot(_n));
    const tangentLen = _tangent.length();
    if (this.inputMag > 0.05) {
      _steer.copy(this.moveDir).addScaledVector(_n, -this.moveDir.dot(_n));
      if (_steer.lengthSq() > 1e-6) {
        _steer.normalize();
        v.addScaledVector(_steer, t.swingSteerForce * dt * this.inputMag);
      }
    }

    // W pumps along the live direction of travel. That accelerates the descent,
    // carries speed through the bottom, and continues driving the upward half
    // of the arc—the same input produces one continuous, readable motion.
    const descending = v.y < 0;
    if (tangentLen > 0.5) {
      _tangent.divideScalar(tangentLen);
      const pumping = this.input.down('KeyW');
      const directionalIntent = clamp(this.moveDir.dot(_tangent), 0, 1) * this.inputMag;
      const intent = Math.max(pumping ? 1 : 0, directionalIntent);
      const pump = t.swingPumpForce * intent * (descending ? 1 : 1.12);
      v.addScaledVector(_tangent, pump * dt);
    }

    // Reeling is deliberate. Automatic winching shortened every swing to the
    // minimum rope length and made traversal feel like a grappling hook.
    const reelIn = this.input.down('KeyW');
    const reelOut = this.input.down('KeyS');
    let targetLen = this.ropeLength;
    if (reelOut) targetLen += t.swingReelSpeed * dt;
    else if (reelIn) targetLen -= t.swingReelSpeed * dt;
    this.ropeLength = clamp(targetLen, t.swingMinRope, t.webMaxRange * 1.05);

    // A small spring term eases into tension before the post-integration hard
    // constraint. This removes one-frame rope lag without making the web rubbery.
    const ropeError = Math.max(0, dist - this.ropeLength);
    const radialOut = Math.max(0, v.dot(_n));
    if (ropeError > 0 || radialOut > 0) {
      v.addScaledVector(_n, -(ropeError * t.ropeSpring * dt + radialOut * 0.82));
    }
    this.swingTension = damp(this.swingTension,
      clamp01(ropeError * 0.16 + radialOut * 0.04), 10, dt);

    // Low drag preserves momentum across a clean sequence of releases.
    const drag = 1 - 0.018 * dt;
    v.multiplyScalar(drag);
    const speed = v.length();
    if (speed > t.swingMaxSpeed) v.multiplyScalar(t.swingMaxSpeed / speed);

    // swing phase drives the animation pump and the camera bank
    _flatVel.set(v.x, 0, v.z);
    this.swingPhase = Math.atan2(v.y, _flatVel.length() + 0.001) + Math.PI * 0.5;
    const lateral = _flatVel.lengthSq() > 1 ? _cross.crossVectors(_flatVel.normalize(), _n).y : 0;
    this.bankAngle = damp(this.bankAngle, clamp(-lateral * 0.85, -0.6, 0.6), 6, dt);

    // Break impossible lines; ground contact is handled after integration.
    if (dist > t.webMaxRange * 1.35) { this.releaseSwing(false); return; }

    this.game.audio.setSwingIntensity(clamp01(this.speed / 40));
    if (this.input.consume('jump')) {
      this.input.webToggle = false;
      this.releaseSwing(true, 1.18);
    }
    this.tryWebActions(dt);
  }

  solveSwingConstraint(dt) {
    if (!this.hasAnchor) return;
    const p = this.position;
    _shoulder.copy(p).addScaledVector(UP, 1.32);
    _rel.copy(_shoulder).sub(this.anchor);
    const dist = _rel.length();
    if (dist < 1e-5 || dist <= this.ropeLength) return;

    _n.copy(_rel).divideScalar(dist);
    const correction = dist - this.ropeLength;
    // Because attachment begins at the measured distance, per-frame error is
    // tiny. Removing all of it here gives a stable, non-stretchy pendulum and
    // avoids the visible catch-up pulses of the old capped correction.
    p.addScaledVector(_n, -correction);
    const radial = this.velocity.dot(_n);
    if (radial > 0) this.velocity.addScaledVector(_n, -radial * TUNING.ropeStiffness);

    // The positional projection can move the capsule toward a facade; resolve
    // once more so the hero never clips through the anchor building.
    this.body.resolve();
  }

  releaseSwing(boost, extra = 1) {
    if (this.state !== 'swing') { this.detachWeb(); return; }
    const v = this.velocity;
    if (boost) {
      const bottom = clamp01((-_n.y - 0.25) / 0.75);
      const releaseGain = 1 + (TUNING.swingReleaseBoost - 1) * extra * (0.65 + bottom * 0.55);
      v.multiplyScalar(releaseGain);
      // a small upward kick if the player is looking up: the classic launch
      const up = clamp01(this.aimDir.y * 1.6);
      const risingCarry = clamp01(v.y / 20);
      v.y += (up * 12 + risingCarry * 4.5) * extra;
      this.game.fx.speedLines(this.speed);
    }
    this.detachWeb();
    this.setState('air');
    this.game.audio.play('webRelease', this.position);
  }

  detachWeb() {
    this.hasAnchor = false;
    this.swingTension = 0;
    this.swingAttachCooldown = 0.08;
    this.webA.hide(); this.webB.hide();
    this.game.audio.setSwingIntensity(0);
  }

  trySlingshot() {
    if (this.state !== 'swing' || this.focus < 18) return;
    this.focus -= 18;
    _rel.copy(this.anchor).sub(this.chestPosition(this._tmp)).normalize();
    this.velocity.addScaledVector(_rel, TUNING.slingshotForce);
    this.velocity.y += 8;
    this.ropeLength = Math.max(TUNING.swingMinRope, this.ropeLength * 0.55);
    this.game.camera.shake(0.5, 0.3);
    this.game.fx.speedLines(60);
    this.game.audio.play('slingshot', this.position);
    this.game.hud.toast('SLINGSHOT', 'Momentum transferred', 'good');
  }

  tryZip() {
    if (this.focus < 10) return;
    const from = this.chestPosition(this._tmp);
    if (!this.world.raycast(from, this.aimDir, TUNING.webMaxRange, this.hit)) return;
    this.focus -= 10;
    this.zipTarget.copy(this.hit.point);
    this.zipNormal = this.hit.normal.clone();
    this.anchor.copy(this.hit.point);
    this.hasAnchor = true;
    this.webA.fire();
    this.setState('zip');
    this.animator.play('webshoot', 0.25, this.webSide);
    this.game.audio.play('zip', this.position);
  }

  updateZip(dt) {
    const to = _tmpV.copy(this.zipTarget).sub(this.chestPosition(this._tmp));
    const d = to.length();
    if (d < 2.6 || this.stateTime > 2.6) {
      this.detachWeb();
      // arriving at a wall sticks you to it; arriving at a roof lands you
      if (this.zipNormal && Math.abs(this.zipNormal.y) < 0.5) {
        this.wallNormal.copy(this.zipNormal); this.wallTime = 0;
        this.setState('wallcrawl');
      } else {
        this.velocity.multiplyScalar(0.25);
        this.setState('air');
      }
      return;
    }
    to.divideScalar(d);
    const speed = lerp(TUNING.zipSpeed * 0.55, TUNING.zipSpeed, smoothstep(this.stateTime * 3));
    this.velocity.copy(to).multiplyScalar(speed);
    this.body.grounded = false;
  }

  /* ------------------------------------------------------ wall moves */
  updateWallRun(dt) {
    const t = TUNING;
    this.wallTime += dt;
    const v = this.velocity;

    // keep contact
    _probe.copy(this.wallNormal).multiplyScalar(-1);
    if (!this.body.probeWall(_probe, 1.4, this.hit)) { this.setState('air'); return; }
    this.wallNormal.copy(this.hit.normal);

    // Up the wall while there's input and stamina; slide down as it runs out.
    const stamina = clamp01(1 - this.wallTime / t.wallStickTime);
    const forward = clamp01(this.inputMag * (this.moveDir.dot(_probe) * 0.5 + 0.5));
    v.y = lerp(-3.5, t.wallRunSpeed, stamina * (0.35 + forward * 0.65));

    // lateral movement along the wall
    _wallRight.crossVectors(this.wallNormal, UP).normalize();
    const lateral = this.moveDir.dot(_wallRight);
    v.x = _wallRight.x * lateral * t.wallRunSpeed * 0.55;
    v.z = _wallRight.z * lateral * t.wallRunSpeed * 0.55;
    // hold on to the wall
    v.addScaledVector(this.wallNormal, -6);

    if (this.input.consume('jump')) {
      v.addScaledVector(this.wallNormal, t.wallJumpImpulse * 1.15);
      v.y = Math.max(v.y, t.jumpImpulse * 1.05);
      this.setState('air');
      this.animator.play('dodge', 0.35, 1);
      this.game.audio.play('jump', this.position);
      return;
    }
    if (this.input.down('ShiftLeft')) { this.setState('wallcrawl'); return; }
    if (this.wallTime > t.wallStickTime + 1.5) { this.setState('air'); return; }
    if (this.body.grounded && v.y <= 0) { this.setState('ground'); return; }

    // reaching a ledge — mantle over it
    _ledge.copy(this.position).addScaledVector(UP, 2.4).addScaledVector(this.wallNormal, -0.9);
    if (!this.world.grid.nearestSurface(_ledge.x, _ledge.y, _ledge.z, 0.5, this.hit)) {
      if (this.wallTime > 0.25 && v.y > 2) {
        v.addScaledVector(this.wallNormal, -4);
        v.y = Math.max(v.y, 9);
      }
    }
    this.tryWebActions(dt);
  }

  updateWallCrawl(dt) {
    const t = TUNING;
    const v = this.velocity;
    _probe.copy(this.wallNormal).multiplyScalar(-1);
    if (!this.body.probeWall(_probe, 1.5, this.hit)) {
      // lost the wall — check for a ceiling above
      if (!this.world.grid.nearestSurface(this.position.x, this.position.y + 2.2, this.position.z, 1.2, this.hit)) {
        this.setState('air'); return;
      }
    }
    this.wallNormal.copy(this.hit.normal);

    // build a movement basis on the wall plane
    _wallRight.crossVectors(this.wallNormal, UP);
    if (_wallRight.lengthSq() < 1e-5) _wallRight.set(1, 0, 0);
    _wallRight.normalize();
    _wallUp.crossVectors(_wallRight, this.wallNormal).normalize();

    const ax = this.input.moveAxis();
    _wallMove.set(0, 0, 0)
      .addScaledVector(_wallUp, ax.y)
      .addScaledVector(_wallRight, ax.x);
    if (_wallMove.lengthSq() > 1e-6) _wallMove.normalize();

    const spd = (this.input.down('ShiftLeft') ? t.wallCrawlSpeed * 1.9 : t.wallCrawlSpeed) * ax.len;
    v.copy(_wallMove).multiplyScalar(spd).addScaledVector(this.wallNormal, -5.5);

    if (this.input.consume('jump')) {
      v.copy(this.wallNormal).multiplyScalar(t.wallJumpImpulse);
      v.y = Math.max(v.y, t.jumpImpulse);
      this.setState('air');
      return;
    }
    if (this.input.mouse.right) { this.setState('air'); return; }
    if (this.body.grounded && this.wallNormal.y < 0.5 && v.y <= 0.1) { this.setState('ground'); return; }
    this.crawlSpeed = spd;
    this.tryWebActions(dt);
  }

  /* ---------------------------------------------------------- perch */
  tryPerch(force = false) {
    if (this.state !== 'ground' && !force) return;
    if (!this.body.grounded) return;
    if (!force) return;
    this.setState('perch');
    this.velocity.set(0, 0, 0);
  }
  updatePerch(dt) {
    this.velocity.x = damp(this.velocity.x, 0, 14, dt);
    this.velocity.z = damp(this.velocity.z, 0, 14, dt);
    this.velocity.y -= TUNING.gravity * dt * 0.4;
    if (this.inputMag > 0.2 || this.input.consume('jump') || this.input.consume('perch')) {
      this.setState('ground');
    }
    if (!this.body.grounded) this.setState('air');
    this.tryWebActions(dt);
  }

  /* ------------------------------------------------------------- KO */
  updateKO(dt) {
    this.velocity.x = damp(this.velocity.x, 0, 3, dt);
    this.velocity.z = damp(this.velocity.z, 0, 3, dt);
    this.velocity.y -= TUNING.gravity * dt;
    if (this.stateTime > 2.6) {
      this.health = TUNING.maxHealth * 0.55;
      this.invuln = 2.5;
      this.setState('air');
      this.game.hud.toast('BACK UP', 'You took a beating — keep moving', 'good');
    }
  }

  /* ------------------------------------------------------- post physics */
  postPhysics(dt, camera) {
    if (this.state === 'swing' && this.body.grounded && this.stateTime > 0.18 && this.velocity.y <= 0.2) {
      this.releaseSwing(false);
      this.land();
    }
    if (this.body.grounded && (this.state === 'air' || this.state === 'dive')) this.land();
    if (this.state === 'ground' && !this.body.grounded && this.coyote > 0.15) this.setState('air');

    // keep the player inside the world
    const lim = this.world.extent + 220;
    const p = this.position;
    if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) {
      this.velocity.x -= Math.sign(p.x) * 40 * dt;
      this.velocity.z -= Math.sign(p.z) * 40 * dt;
    }
    if (p.y < -30) { p.set(0, 90, 0); this.velocity.set(0, 0, 0); this.setState('air'); }

    this.telemetry.speed = kmh(this.speed);
    this.telemetry.altitude = Math.round(p.y);
  }

  /* --------------------------------------------------------- visuals */
  updateVisuals(dt, camera) {
    const p = this.position;
    this.object.position.copy(p);

    /* orientation */
    let fwd = _fwd, up = _upv.set(0, 1, 0);
    switch (this.state) {
      case 'wallcrawl':
        up.copy(this.wallNormal);
        fwd.copy(_wallMove.lengthSq() > 0.01 ? _wallMove : _wallUp);
        break;
      case 'wallrun':
        up.set(0, 1, 0);
        fwd.copy(this.wallNormal).multiplyScalar(-1);
        break;
      case 'swing':
      case 'dive':
      case 'zip': {
        _flatVel.set(this.velocity.x, 0, this.velocity.z);
        fwd.copy(_flatVel.lengthSq() > 1 ? _flatVel.normalize() : this.aimDir).setY(0).normalize();
        break;
      }
      case 'air': {
        _flatVel.set(this.velocity.x, 0, this.velocity.z);
        fwd.copy(_flatVel.lengthSq() > 4 ? _flatVel.normalize() : this.facing);
        break;
      }
      default: {
        if (this.lockOn) fwd.copy(this.lockOn.position).sub(p).setY(0).normalize();
        else if (this.inputMag > 0.05) fwd.copy(this.moveDir);
        else fwd.copy(this.facing);
      }
    }
    if (fwd.lengthSq() < 1e-6) fwd.copy(this.facing);
    fwd.normalize();

    const prevYaw = Math.atan2(this.facing.x, this.facing.z);
    this.facing.copy(fwd);
    const newYaw = Math.atan2(fwd.x, fwd.z);
    this.turnRate = damp(this.turnRate, (newYaw - prevYaw) / Math.max(dt, 1e-4) * 0.06, 8, dt);

    const turnSpeed = this.state === 'ground' ? 13 : this.state === 'wallcrawl' ? 10 : 7;
    dampQuaternionToBasis(this.object.quaternion, fwd, up, turnSpeed, dt);

    /* animation state */
    this.object.updateMatrixWorld(true);
    this.animator.setCharacterMatrix(this.object.matrixWorld);

    if (this.hasAnchor) {
      this._anchorLocal.copy(this.anchor).sub(p);
      _invQ.copy(this.object.quaternion).invert();
      this._anchorLocal.applyQuaternion(_invQ);
    }
    _aimLocal.copy(this.aimDir).applyQuaternion(_invQ.copy(this.object.quaternion).invert());

    const flatSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animator.update(dt, {
      mode: this.state,
      speed: this.state === 'wallcrawl' ? (this.crawlSpeed || 0) : flatSpeed,
      velY: this.velocity.y,
      grounded: this.body.grounded,
      crouch: this.crouchAmount || 0,
      swingPhase: this.swingPhase,
      webSide: this.webSide,
      bankAngle: this.bankAngle,
      anchorLocal: this.hasAnchor ? this._anchorLocal : null,
      aimLocal: _aimLocal,
      turnRate: this.turnRate,
      lookPitch: this.game.camera.pitch,
      lookYawDelta: 0,
      expressionBase: this.state === 'swing' || this.state === 'dive' ? 0.25 : 0,
      focusBase: this.state === 'swing' ? 0.4 : 0.1,
      swingTension: this.swingTension,
    });

    /* web lines */
    if (this.hasAnchor && (this.state === 'swing' || this.state === 'zip')) {
      this.handPosition(_handPos, this.webSide);
      const dist = _handPos.distanceTo(this.anchor);
      const slack = this.state === 'swing'
        ? clamp01(1 - dist / Math.max(this.ropeLength, 1)) * 1.6
        : 0.06;
      this.webA.update(_handPos, this.anchor, camera.position, slack, dt);
    } else this.webA.mesh.visible = false;
  }

  /* ---------------------------------------------------------- combat */
  damage(amount, source, selfInflicted = false) {
    if (this.invuln > 0 || this.state === 'ko') return false;
    if (this.perfectDodge > 0 && !selfInflicted) {
      this.game.combat.onPerfectDodge(source);
      return false;
    }
    this.health -= amount;
    this.invuln = 0.45;
    this.animator.play('flinch', 0.45, Math.random() < 0.5 ? 1 : -1);
    this.game.camera.shake(clamp01(amount / 25) * 0.8, 0.3);
    this.game.hud.damageFlash(clamp01(amount / 30));
    this.game.audio.play('hurt', this.position);
    if (this.health <= 0) {
      this.health = 0;
      this.setState('ko');
      this.detachWeb();
      this.game.hud.toast('DOWN', 'Regrouping…', '');
    }
    return true;
  }

  heal(a) { this.health = Math.min(TUNING.maxHealth, this.health + a); }
  addXp(a) {
    this.xp += a;
    const need = this.level * 500;
    if (this.xp >= need) {
      this.xp -= need; this.level++;
      this.game.hud.toast('LEVEL ' + this.level, 'Reflexes sharpened', 'gold');
      this.game.audio.play('levelup', this.position);
    }
  }

  teleport(x, y, z) {
    this.body.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.detachWeb();
    this.setState('air');
  }
}

/* scratch */
const _camFwd = new THREE.Vector3();
const _camFlat = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _want = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _n = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _travel = new THREE.Vector3();
const _flatVel = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _wallRight = new THREE.Vector3();
const _wallUp = new THREE.Vector3();
const _wallMove = new THREE.Vector3();
const _ledge = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _upv = new THREE.Vector3();
const _invQ = new THREE.Quaternion();
const _aimLocal = new THREE.Vector3();
const _handPos = new THREE.Vector3();
const _tmpV = new THREE.Vector3();
