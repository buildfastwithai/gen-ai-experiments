/* combat/Combat.js
   Fast, readable superhero melee.

   Rules that make it feel good rather than just work:
     • Attacks steer the player toward the nearest valid target (target lock-on
       assist) so you never whiff because of a 5° aim error.
     • Every third hit is a launcher; hitting an airborne enemy juggles them and
       pulls you up with them, which is how air combos start without a button.
     • Dodging inside an enemy's wind-up is a PERFECT dodge: brief time dilation,
       a free counter window, and a focus refund.
     • Combo count decays on a timer, not on a miss — aggression is rewarded.
*/

import * as THREE from 'three';
import { TUNING } from '../core/Settings.js';
import { clamp, clamp01, lerp, damp } from '../core/MathUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Combat {
  constructor(game) {
    this.game = game;
    this.player = null;           // set after player construction
    this.combo = 0;
    this.comboTimer = 0;
    this.chain = 0;
    this.attackCooldown = 0;
    this.pendingHit = null;
    this.dodgeCooldown = 0;
    this.timeDilation = 1;
    this.dilationTimer = 0;
    this.lastTarget = null;
    this.webCooldown = { pull: 0, trap: 0, shot: 0 };
    this.finisherTarget = null;
  }

  bind(player) { this.player = player; }

  /* ---------------------------------------------------------- update */
  update(dt) {
    const p = this.player;
    const input = this.game.input;
    if (!p || p.state === 'ko') return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    for (const k in this.webCooldown) this.webCooldown[k] = Math.max(0, this.webCooldown[k] - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.endCombo();
    }

    if (this.dilationTimer > 0) {
      this.dilationTimer -= dt;
      this.timeDilation = damp(this.timeDilation, 1, 3, dt);
      if (this.dilationTimer <= 0) this.timeDilation = 1;
    }

    // lock-on target follows whatever is in front of us during a fight
    const camDir = this.game.camera.camera.getWorldDirection(_camDir);
    const target = this.game.enemies.pickTarget(p, camDir, 30);
    this.lastTarget = target;
    p.lockOn = (this.combo > 0 && target && p.state === 'ground') ? target : null;
    this.game.camera.lockTarget = null;   // soft lock only; hard lock is opt-in

    // deferred hit resolution (the frame the animation connects)
    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) { this.resolveHit(this.pendingHit); this.pendingHit = null; }
    }

    /* -------- inputs -------- */
    if (input.consume('attack')) this.attack();
    if (input.consume('dodge')) this.dodge();
    if (input.consume('webpull')) this.webPull();
    if (input.consume('webtrap')) this.webTrap();
  }

  /* ---------------------------------------------------------- attacks */
  attack() {
    const p = this.player;
    if (this.attackCooldown > 0) return;
    if (p.state === 'swing' || p.state === 'zip') { this.airDive(); return; }

    const target = this.findMeleeTarget();
    this.chain = (this.chain + 1) % 4;
    const airborne = !p.body.grounded;

    // close the gap: dash a short distance toward the target
    if (target) {
      _v.copy(target.position).sub(p.position);
      const d = _v.length();
      _v.divideScalar(d || 1);
      if (d > 1.8) {
        const dash = clamp(d - 1.5, 0, 7);
        p.velocity.addScaledVector(_v, dash * 5.5);
        if (airborne || target.launched) p.velocity.y = (target.position.y + 0.6 - p.position.y) * 3.4;
      }
      p.facing.copy(_v).setY(0).normalize();
    }

    const launcher = this.chain === 3;
    const finisher = target && (target.state === 'stunned' || target.state === 'webbed');

    let anim = 'punch', dur = 0.34, dmgMul = 1;
    if (airborne) { anim = 'airkick'; dur = 0.42; dmgMul = 1.25; }
    else if (launcher) { anim = 'uppercut'; dur = 0.46; dmgMul = 1.5; }
    else if (this.chain === 2) { anim = 'kick'; dur = 0.4; dmgMul = 1.2; }
    if (finisher) { anim = 'kick'; dur = 0.52; dmgMul = 2.6; }

    p.animator.play(anim, dur, this.chain % 2 ? 1 : -1, 1);
    this.attackCooldown = dur * 0.62;
    this.game.audio.play('swipe', p.position);

    this.pendingHit = {
      t: dur * 0.32, target, launcher: launcher || airborne, finisher,
      damage: TUNING.punchDamage * dmgMul * (1 + this.combo * 0.035),
      dir: _v.clone(),
    };
  }

  resolveHit(h) {
    const p = this.player;
    const list = this.enemiesInArc(p, TUNING.punchRange + (h.finisher ? 1.2 : 0), 0.55);
    if (!list.length) return;

    for (const e of list) {
      _dir.copy(e.position).sub(p.position).setY(0).normalize();
      e.takeHit(h.damage, _dir, {
        launch: h.launcher, knockback: h.finisher ? 14 : h.launcher ? 6 : 4.5,
        poise: h.finisher ? 5 : h.launcher ? 2.5 : 1, breaker: h.finisher,
      });
      this.addCombo();
      if (h.launcher && !p.body.grounded) p.velocity.y = Math.max(p.velocity.y, 7);
      else if (h.launcher) p.velocity.y = Math.max(p.velocity.y, 8.5);
    }

    const first = list[0];
    _hitPoint.copy(first.position).addScaledVector(UP, 1.15);
    this.game.fx.impact(_hitPoint, _dir, h.finisher ? 2 : 1.2);
    this.game.camera.shake(h.finisher ? 0.6 : 0.28, 0.25);
    this.game.audio.play(h.finisher ? 'heavyHit' : 'hit', _hitPoint);
    this.game.hitStop(h.finisher ? 0.09 : 0.045);

    // Environmental attack: if the target is against a wall, slam them into it.
    if (h.finisher && this.game.world.grid.nearestSurface(
      first.position.x, first.position.y + 1, first.position.z, 2.2, this.game.world.hit2)) {
      first.takeHit(h.damage * 0.7, _dir, { knockback: 2, poise: 3 });
      this.game.fx.burst(_hitPoint, 16, { speed: 6, size: 0.7, life: 0.5, color: [0.7, 0.68, 0.62] });
      this.game.hud.toast('WALL SLAM', '+bonus damage', 'good');
    }
  }

  airDive() {
    const p = this.player;
    const target = this.findMeleeTarget(40);
    if (!target) return;
    p.releaseSwing(false);
    _v.copy(target.position).sub(p.position).normalize();
    p.velocity.copy(_v).multiplyScalar(52);
    p.setState('dive');
    p.animator.play('airkick', 0.6, 1, 1.3);
    this.diveTarget = target;
    this.game.audio.play('divekick', p.position);
    this.game.hud.toast('SWING KICK', 'Incoming', '');
  }

  /* ---------------------------------------------------------- defence */
  dodge() {
    const p = this.player;
    if (this.dodgeCooldown > 0 || p.state === 'ko') return;
    this.dodgeCooldown = 0.42;
    p.dodgeTimer = TUNING.dodgeWindow;
    p.perfectDodge = TUNING.dodgeWindow;
    p.invuln = Math.max(p.invuln, 0.22);

    const dir = p.inputMag > 0.1 ? _v.copy(p.moveDir) : _v.copy(p.facing).multiplyScalar(-1);
    p.velocity.addScaledVector(dir, TUNING.dodgeImpulse);
    if (p.body.grounded) p.velocity.y = Math.max(p.velocity.y, 3.5);
    p.animator.play('dodge', 0.42, dir.dot(_right.crossVectors(p.facing, UP)) > 0 ? 1 : -1);
    this.game.audio.play('dodge', p.position);
  }

  onPerfectDodge(source) {
    this.player.perfectDodge = 0;
    this.player.invuln = Math.max(this.player.invuln, 0.6);
    this.player.focus = Math.min(TUNING.maxFocus, this.player.focus + 22);
    this.dilationTimer = 0.65;
    this.timeDilation = 0.28;
    this.game.camera.shake(0.25, 0.2);
    this.game.hud.toast('PERFECT DODGE', 'Counter window open', 'good');
    this.game.postfx?.pulseFocus(1);
    this.game.audio.play('perfect', this.player.position);
    this.addCombo(2);
    if (source) this.counterTarget = source;
  }

  /* ------------------------------------------------------ web abilities */
  webPull() {
    const p = this.player;
    if (this.webCooldown.pull > 0 || p.focus < 12) return;
    const target = this.findMeleeTarget(24, 0.35);
    p.animator.play('webshoot', 0.32, 1);
    this.game.audio.play('webshoot', p.position);
    this.webCooldown.pull = 0.55;
    p.focus -= 12;

    if (target) {
      // light enemies come to you; heavy ones pull YOU to them
      const heavy = target.def.bulk > 1.2;
      _dir.copy(p.position).sub(target.position).setY(0).normalize();
      p.handPosition(_hand, 1);
      this.game.fx.webSplat(_hitPoint.copy(target.position).addScaledVector(UP, 1.1), _dir);
      if (heavy) {
        p.velocity.addScaledVector(_dir, -34);
        p.velocity.y = Math.max(p.velocity.y, 5);
        this.game.hud.toast('WEB YANK', 'Closing on ' + target.def.label, '');
      } else {
        target.body.velocity.copy(_dir).multiplyScalar(20);
        target.body.velocity.y = 6.5;
        target.takeHit(8, _dir.clone().multiplyScalar(-1), { poise: 2, knockback: 0 });
        this.addCombo();
        this.game.hud.toast('WEB PULL', target.def.label + ' yanked', 'good');
      }
      this.game.camera.shake(0.2, 0.2);
    } else {
      // no enemy — pull a piece of the city instead (or yourself to it)
      if (this.game.world.raycast(p.chestPosition(_hand), p.aimDir, 40, p.hit)) {
        this.game.fx.webSplat(p.hit.point, p.hit.normal);
        _dir.copy(p.hit.point).sub(p.position).normalize();
        p.velocity.addScaledVector(_dir, 22);
        p.setState('air');
      }
    }
  }

  webTrap() {
    const p = this.player;
    if (this.webCooldown.trap > 0 || p.focus < 20) return;
    const target = this.findMeleeTarget(26, 0.3);
    p.animator.play('webshoot', 0.34, -1);
    this.game.audio.play('webshoot', p.position);
    this.webCooldown.trap = 1.1;
    p.focus -= 20;
    if (!target) return;
    target.web(4.5);
    this.game.fx.webSplat(_hitPoint.copy(target.position).addScaledVector(UP, 1.0),
      _dir.copy(p.position).sub(target.position).normalize());
    this.addCombo();
    this.game.hud.toast('WEBBED', target.def.label + ' immobilised', 'good');

    // Webbing an enemy against a wall pins them there — a real crowd-control tool.
    if (this.game.world.grid.nearestSurface(
      target.position.x, target.position.y + 1, target.position.z, 2.5, this.game.world.hit2)) {
      target.webTimer += 3;
      target.body.velocity.set(0, 0, 0);
      this.game.hud.toast('PINNED', 'Stuck to the wall', 'good');
    }
  }

  /* ------------------------------------------------------------ combo */
  addCombo(n = 1) {
    this.combo += n;
    this.comboTimer = TUNING.comboWindow;
    this.player.addXp(6 * n + Math.floor(this.combo * 0.5));
    this.game.hud.setCombo(this.combo, this.comboTimer / TUNING.comboWindow);
    if (this.combo === 10) this.game.hud.toast('COMBO x10', 'Focus restored', 'gold');
    if (this.combo % 10 === 0) this.player.focus = Math.min(TUNING.maxFocus, this.player.focus + 15);
  }
  endCombo() {
    if (this.combo >= 5) this.player.addXp(this.combo * 8);
    this.combo = 0;
    this.game.hud.setCombo(0, 0);
  }

  /* ------------------------------------------------------------ search */
  findMeleeTarget(range = TUNING.punchRange + 5.5, minDot = 0.15) {
    const p = this.player;
    const camDir = this.game.camera.camera.getWorldDirection(_camDir);
    let best = null, bestScore = -Infinity;
    for (const e of this.game.enemies.active) {
      if (!e.alive) continue;
      _v.copy(e.position).sub(p.position);
      const d = _v.length();
      if (d > range) continue;
      _v.divideScalar(d || 1);
      const dot = _v.dot(camDir);
      if (dot < minDot) continue;
      const score = dot * 12 - d * 0.6 + (e.state === 'stunned' ? 4 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  enemiesInArc(p, range, minDot) {
    const out = [];
    for (const e of this.game.enemies.active) {
      if (!e.alive) continue;
      _v.copy(e.position).sub(p.position);
      const dy = Math.abs(_v.y);
      _v.y = 0;
      const d = _v.length();
      if (d > range || dy > 3.2) continue;
      _v.divideScalar(d || 1);
      if (_v.dot(_fwd.copy(p.facing).setY(0).normalize()) < minDot) continue;
      out.push(e);
    }
    return out;
  }
}

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _hand = new THREE.Vector3();
