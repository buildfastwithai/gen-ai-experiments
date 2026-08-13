/* enemies/Enemy.js
   Six archetypes over one rig and one finite state machine.

   States: idle · patrol · detect · chase · attack · defend · stunned ·
           knockdown · webbed · search · return

   Readability is the design goal: every enemy telegraphs (a wind-up pose plus a
   coloured tell on the HUD indicator), commits, then has a recovery window. That
   loop is what makes a counter-and-dodge combat system feel fair. */

import * as THREE from 'three';
import { buildCharacter, makeGoonMaterials } from '../player/CharacterRig.js';
import { Animator } from '../player/Animator.js';
import { CharacterBody } from '../physics/CharacterBody.js';
import { clamp, clamp01, lerp, damp, dampQuaternionToBasis, makeRng } from '../core/MathUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

export const ARCHETYPES = {
  grunt: {
    label: 'Enforcer', health: 46, speed: 6.2, damage: 7, range: 2.5, windup: 0.55,
    cooldown: 1.3, detect: 34, bulk: 1.0, height: 0.98, xp: 60, poise: 1,
    palette: { body: 0x2b3550, trim: 0x8c9099, skin: 0x8d6a52 },
  },
  fast: {
    label: 'Runner', health: 32, speed: 9.4, damage: 5, range: 2.2, windup: 0.32,
    cooldown: 0.85, detect: 40, bulk: 0.9, height: 0.95, xp: 70, poise: 0.6,
    palette: { body: 0x3f2b52, trim: 0xc45cff, skin: 0x9a7359 },
  },
  heavy: {
    label: 'Bruiser', health: 130, speed: 4.4, damage: 16, range: 3.0, windup: 0.95,
    cooldown: 2.0, detect: 30, bulk: 1.45, height: 1.14, xp: 160, poise: 3.2,
    palette: { body: 0x40342a, trim: 0xd08a3a, skin: 0x8a6449 },
  },
  ranged: {
    label: 'Marksman', health: 38, speed: 5.0, damage: 9, range: 34, windup: 0.85,
    cooldown: 2.3, detect: 46, bulk: 0.95, height: 0.97, xp: 95, poise: 0.7,
    palette: { body: 0x1f3f3a, trim: 0x46e0a8, skin: 0x8d6a52 },
  },
  shield: {
    label: 'Bulwark', health: 96, speed: 4.8, damage: 11, range: 2.7, windup: 0.7,
    cooldown: 1.7, detect: 30, bulk: 1.22, height: 1.05, xp: 140, poise: 4.5,
    palette: { body: 0x2a2f38, trim: 0x6fa8d8, skin: 0x7f5f48 }, hasShield: true,
  },
  miniboss: {
    label: 'RAMPART', health: 420, speed: 5.6, damage: 22, range: 3.6, windup: 0.8,
    cooldown: 1.5, detect: 60, bulk: 1.7, height: 1.28, xp: 900, poise: 8,
    palette: { body: 0x3a1418, trim: 0xff5a3c, skin: 0x6d4c3a }, boss: true,
  },
};

let _uid = 0;

export class Enemy {
  constructor(game, type = 'grunt') {
    this.game = game;
    this.id = ++_uid;
    this.type = type;
    this.def = ARCHETYPES[type] || ARCHETYPES.grunt;
    this.rng = makeRng(1000 + this.id * 37);

    const mats = makeGoonMaterials(this.def.palette);
    this.rig = buildCharacter(mats, { bulk: this.def.bulk, height: this.def.height });
    this.object = new THREE.Group();
    this.object.add(this.rig.root);
    this.animator = new Animator(this.rig);

    this.body = new CharacterBody(game.world.grid, 0.42 * this.def.bulk, 1.78 * this.def.height);

    if (this.def.hasShield) {
      const g = new THREE.BoxGeometry(0.1, 1.15, 0.85);
      this.shield = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: this.def.palette.trim, roughness: 0.35, metalness: 0.75,
      }));
      this.shield.castShadow = true;
      this.rig.joints.foreL.add(this.shield);
      this.shield.position.set(0.12, -0.2, 0.16);
      this.shieldHealth = 60;
    }

    // webbed cocoon overlay
    this.cocoon = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5 * this.def.bulk, 1.1 * this.def.height, 4, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf0f4ff, roughness: 0.9, transparent: true, opacity: 0.86,
      }));
    this.cocoon.position.y = 0.95 * this.def.height;
    this.cocoon.visible = false;
    this.object.add(this.cocoon);

    this.reset(type);
  }

  reset(type = this.type) {
    this.type = type;
    this.def = ARCHETYPES[type] || this.def;
    this.health = this.def.health;
    this.maxHealth = this.def.health;
    this.alive = true;
    this.state = 'idle';
    this.stateTime = 0;
    this.attackTimer = 0;
    this.stunTimer = 0;
    this.webTimer = 0;
    this.poise = this.def.poise;
    this.facing = new THREE.Vector3(0, 0, 1);
    this.homePos = new THREE.Vector3();
    this.patrolTarget = new THREE.Vector3();
    this.lastSeen = new THREE.Vector3();
    this.launched = false;
    this.hitFlash = 0;
    this.telegraph = 0;
    this.object.visible = true;
    this.cocoon.visible = false;
    if (this.shield) { this.shield.visible = true; this.shieldHealth = 60; }
  }

  get position() { return this.body.position; }

  spawn(x, y, z) {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.homePos.set(x, y, z);
    this.pickPatrolPoint();
    this.setState('patrol');
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s; this.stateTime = 0;
  }

  pickPatrolPoint() {
    const a = this.rng() * Math.PI * 2, r = 6 + this.rng() * 16;
    this.patrolTarget.set(
      this.homePos.x + Math.cos(a) * r, this.homePos.y, this.homePos.z + Math.sin(a) * r);
  }

  /* ------------------------------------------------------------ update */
  update(dt, player) {
    if (!this.alive) { this.updateDead(dt); return; }
    this.stateTime += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.telegraph = Math.max(0, this.telegraph - dt);

    _toPlayer.copy(player.position).sub(this.position);
    const dist = _toPlayer.length();
    const flat = Math.hypot(_toPlayer.x, _toPlayer.z);

    // Mission-scripted movement: the FSM stands down and a waypoint drives us.
    // Used for the rooftop chase, where the villain has to outrun physics.
    if (this.scripted && this.scriptTarget) {
      this.body.skipCollision = true;
      _dir.copy(this.scriptTarget).sub(this.position);
      const d = _dir.length();
      if (d > 0.5) {
        _dir.divideScalar(d);
        const sp = this.scriptSpeed || 20;
        this.body.velocity.lerp(_scriptVel.copy(_dir).multiplyScalar(sp), 1 - Math.exp(-4 * dt));
        this.faceTowards(this.scriptTarget, dt, 6);
      } else this.body.velocity.multiplyScalar(0.85);
      this.body.integrate(dt);
      this.object.position.copy(this.position);
      this.moveSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
      this.updateVisual(dt, player);
      return;
    }
    this.body.skipCollision = false;

    switch (this.state) {
      case 'idle': this.stIdle(dt, dist); break;
      case 'patrol': this.stPatrol(dt, dist); break;
      case 'detect': this.stDetect(dt, dist, player); break;
      case 'chase': this.stChase(dt, dist, flat, player); break;
      case 'attack': this.stAttack(dt, dist, player); break;
      case 'defend': this.stDefend(dt, dist); break;
      case 'stunned': this.stStunned(dt); break;
      case 'knockdown': this.stKnockdown(dt); break;
      case 'webbed': this.stWebbed(dt); break;
      case 'search': this.stSearch(dt, dist, player); break;
      case 'return': this.stReturn(dt, dist); break;
    }

    // gravity + integrate
    this.body.velocity.y -= 26 * dt;
    this.body.integrate(dt);
    this.object.position.copy(this.position);

    this.updateVisual(dt, player);
  }

  updateDead(dt) {
    this.deadTime = (this.deadTime || 0) + dt;
    this.body.velocity.y -= 26 * dt;
    this.body.integrate(dt);
    this.object.position.copy(this.position);
    this.animator.update(dt, { mode: 'ko', speed: 0 });
    if (this.deadTime > 6) this.object.visible = false;
  }

  /* --------------------------------------------------------- FSM states */
  canSee(dist, player) {
    if (dist > this.def.detect) return false;
    if (player.state === 'swing' && dist > this.def.detect * 0.6) return false;
    return true;
  }

  stIdle(dt, dist) {
    this.move(null, 0, dt);
    if (this.stateTime > 2.5) this.setState('patrol');
    if (dist < this.def.detect) this.setState('detect');
  }

  stPatrol(dt, dist) {
    this.move(this.patrolTarget, this.def.speed * 0.35, dt);
    if (this.position.distanceTo(this.patrolTarget) < 2 || this.stateTime > 8) {
      this.pickPatrolPoint();
      if (this.rng() < 0.4) this.setState('idle');
    }
    if (dist < this.def.detect) this.setState('detect');
  }

  stDetect(dt, dist, player) {
    this.move(null, 0, dt);
    this.faceTowards(player.position, dt, 9);
    if (this.stateTime === dt) {
      this.animator.play('taunt', 0.6, 1);
      this.game.audio.play('alert', this.position);
      this.game.hud.enemyAlert();
    }
    if (this.stateTime > 0.55) {
      this.lastSeen.copy(player.position);
      this.setState('chase');
    }
  }

  stChase(dt, dist, flat, player) {
    const want = this.def.range * (this.type === 'ranged' ? 0.75 : 0.85);
    if (this.type === 'ranged') {
      // keep distance and strafe
      const ideal = this.def.range * 0.6;
      _strafe.copy(_toPlayer).setY(0).normalize();
      if (flat < ideal * 0.7) _strafe.multiplyScalar(-1);
      else if (flat < ideal * 1.2) {
        _strafe.set(-_strafe.z, 0, _strafe.x).multiplyScalar(this.rng() < 0.5 ? 1 : -1);
      }
      _dest.copy(this.position).addScaledVector(_strafe, 6);
      this.move(_dest, this.def.speed, dt);
    } else {
      this.move(player.position, this.def.speed, dt);
    }
    this.faceTowards(player.position, dt, 7);

    if (flat < want + 0.4 && Math.abs(_toPlayer.y) < 3.2 && this.attackTimer <= 0) {
      this.setState('attack');
    }
    if (this.def.hasShield && dist < 7 && this.rng() < dt * 0.6) this.setState('defend');
    if (!this.canSee(dist, player)) {
      if (this.stateTime > 3) { this.lastSeen.copy(player.position); this.setState('search'); }
    }
  }

  stAttack(dt, dist, player) {
    this.move(null, 0, dt);
    this.faceTowards(player.position, dt, 5);
    const w = this.def.windup;
    if (this.stateTime <= dt) {
      this.telegraph = w;
      this.animator.play(this.type === 'heavy' || this.type === 'miniboss' ? 'uppercut' : 'punch',
        w + 0.35, this.rng() < 0.5 ? 1 : -1, 1);
      this.game.audio.play('swipe', this.position);
    }
    if (this.stateTime > w && !this._struck) {
      this._struck = true;
      if (this.type === 'ranged') this.fireProjectile(player);
      else if (dist < this.def.range + 1.2) {
        const hit = player.damage(this.def.damage, this);
        if (hit) this.game.fx.impact(player.position, _toPlayer.clone().normalize(), 1, [1, 0.4, 0.35]);
      }
    }
    if (this.stateTime > w + 0.45) {
      this._struck = false;
      this.attackTimer = this.def.cooldown * (0.8 + this.rng() * 0.5);
      this.setState('chase');
    }
  }

  stDefend(dt, dist) {
    this.move(null, 0, dt);
    if (this.stateTime > 1.4) this.setState('chase');
  }

  stStunned(dt) {
    this.stunTimer -= dt;
    this.body.velocity.x = damp(this.body.velocity.x, 0, 6, dt);
    this.body.velocity.z = damp(this.body.velocity.z, 0, 6, dt);
    if (this.stunTimer <= 0) { this.poise = this.def.poise; this.setState('chase'); }
  }

  stKnockdown(dt) {
    this.stunTimer -= dt;
    if (this.stunTimer <= 0 && this.body.grounded) {
      this.poise = this.def.poise;
      this.setState('chase');
      this.launched = false;
    }
  }

  stWebbed(dt) {
    this.webTimer -= dt;
    this.body.velocity.x *= 0.85; this.body.velocity.z *= 0.85;
    this.cocoon.visible = true;
    if (this.webTimer <= 0) { this.cocoon.visible = false; this.setState('chase'); }
  }

  stSearch(dt, dist, player) {
    this.move(this.lastSeen, this.def.speed * 0.6, dt);
    if (this.canSee(dist, player)) this.setState('chase');
    if (this.stateTime > 6) this.setState('return');
  }

  stReturn(dt, dist) {
    this.move(this.homePos, this.def.speed * 0.5, dt);
    if (this.position.distanceTo(this.homePos) < 3) this.setState('patrol');
    if (dist < this.def.detect * 0.8) this.setState('chase');
  }

  /* ------------------------------------------------------------ motion */
  move(target, speed, dt) {
    const v = this.body.velocity;
    if (!target || speed <= 0) {
      v.x = damp(v.x, 0, 10, dt); v.z = damp(v.z, 0, 10, dt);
      this.moveSpeed = Math.hypot(v.x, v.z);
      return;
    }
    _dir.copy(target).sub(this.position); _dir.y = 0;
    const d = _dir.length();
    if (d < 0.4) { v.x = damp(v.x, 0, 10, dt); v.z = damp(v.z, 0, 10, dt); this.moveSpeed = 0; return; }
    _dir.divideScalar(d);
    // crude avoidance: if a wall is dead ahead, slide along it
    if (this.body.onWall && this.body.wallNormal.dot(_dir) < -0.3) {
      _dir.set(-this.body.wallNormal.z, 0, this.body.wallNormal.x);
    }
    v.x = damp(v.x, _dir.x * speed, 8, dt);
    v.z = damp(v.z, _dir.z * speed, 8, dt);
    this.moveSpeed = Math.hypot(v.x, v.z);
    this.faceTowards(target, dt, 8);
  }

  faceTowards(p, dt, rate) {
    _dir.copy(p).sub(this.position); _dir.y = 0;
    if (_dir.lengthSq() < 1e-4) return;
    _dir.normalize();
    this.facing.lerp(_dir, 1 - Math.exp(-rate * dt)).normalize();
  }

  fireProjectile(player) {
    this.game.enemies.spawnProjectile(
      _muzzle.copy(this.position).addScaledVector(UP, 1.3),
      _dir.copy(player.position).addScaledVector(UP, 1.0).sub(_muzzle).normalize(),
      this.def.damage, this);
    this.game.audio.play('shot', this.position);
  }

  /* ------------------------------------------------------------ damage */
  takeHit(damage, dirVec, opts = {}) {
    if (!this.alive) return false;
    if (this.state === 'defend' && !opts.breaker) damage *= 0.25;
    if (this.shield && this.shield.visible && !opts.breaker) {
      _dir.copy(this.facing);
      if (dirVec && dirVec.dot(_dir) < -0.2) {
        this.shieldHealth -= damage;
        this.game.fx.sparks(_muzzle.copy(this.position).addScaledVector(UP, 1.2), 10);
        if (this.shieldHealth <= 0) {
          this.shield.visible = false;
          this.game.hud.toast('SHIELD BROKEN', ARCHETYPES[this.type].label + ' exposed', 'good');
        }
        return true;
      }
    }

    this.health -= damage;
    this.hitFlash = 1;
    this.poise -= opts.poise || 1;
    this.animator.play('flinch', 0.35, Math.random() < 0.5 ? 1 : -1);
    this.game.fx.impact(
      _muzzle.copy(this.position).addScaledVector(UP, 1.15),
      dirVec || _dir.set(0, 1, 0), 1);

    if (dirVec) this.body.velocity.addScaledVector(dirVec, (opts.knockback || 4) / Math.max(0.5, this.def.bulk));
    if (opts.launch) {
      this.body.velocity.y = 11 / Math.max(0.6, this.def.bulk * 0.8);
      this.launched = true;
      this.stunTimer = 1.4;
      this.setState('knockdown');
    } else if (this.poise <= 0) {
      this.poise = this.def.poise;
      this.stunTimer = 1.1;
      this.setState('stunned');
    }

    if (this.health <= 0) this.die(dirVec);
    return true;
  }

  web(duration = 4) {
    if (!this.alive) return;
    this.webTimer = duration;
    this.setState('webbed');
    this.cocoon.visible = true;
    this.game.audio.play('webhit', this.position);
  }

  die(dirVec) {
    this.alive = false;
    this.deadTime = 0;
    this.setState('ko');
    if (dirVec) this.body.velocity.addScaledVector(dirVec, 6);
    this.body.velocity.y += 3;
    this.cocoon.visible = false;
    this.game.player.addXp(this.def.xp);
    this.game.hud.toast('+' + this.def.xp + ' XP', this.def.label + ' down', 'good');
    this.game.audio.play('ko', this.position);
    this.game.onEnemyDefeated?.(this);
  }

  /* ----------------------------------------------------------- visuals */
  updateVisual(dt, player) {
    dampQuaternionToBasis(this.object.quaternion, this.facing, UP, 10, dt);
    this.object.updateMatrixWorld(true);
    this.animator.setCharacterMatrix(this.object.matrixWorld);

    const mode = this.state === 'knockdown' || this.state === 'stunned' ? 'ground' : 'ground';
    this.animator.update(dt, {
      mode: this.launched && !this.body.grounded ? 'air' : mode,
      speed: this.moveSpeed || 0,
      velY: this.body.velocity.y,
      crouch: this.state === 'defend' ? 0.55 : 0,
      turnRate: 0, lookPitch: 0,
    });

    // hit flash on the body material
    if (this.hitFlash > 0) {
      const m = this.rig.materials.red;
      m.emissive.setRGB(this.hitFlash * 0.9, this.hitFlash * 0.25, this.hitFlash * 0.2);
    } else if (this.rig.materials.red.emissive.r > 0.001) {
      this.rig.materials.red.emissive.setScalar(0);
    }
  }

  dispose() {
    this.object.removeFromParent();
  }
}

const _toPlayer = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dest = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _scriptVel = new THREE.Vector3();
