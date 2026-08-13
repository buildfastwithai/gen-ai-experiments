/* core/Game.js
   The orchestrator. Owns the renderer, builds every system in dependency order,
   and runs the frame.

   Frame order matters and is deliberate:
     input -> combat -> player -> camera -> world/LOD -> AI/crowds -> weather ->
     effects -> post -> render
   Camera runs immediately after the player so the HUD, audio listener and
   attach-point aiming all use the same frame's transform. */

import * as THREE from 'three';
import { Settings, TUNING } from './Settings.js';
import { Input } from './Input.js';
import { World } from '../world/World.js';
import { Ambience } from '../world/Ambience.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { Combat } from '../combat/Combat.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { NPCManager } from '../npcs/NPCManager.js';
import { TrafficManager } from '../vehicles/TrafficManager.js';
import { DayNight } from '../weather/DayNight.js';
import { Weather } from '../weather/Weather.js';
import { Effects } from '../effects/Effects.js';
import { PostFX } from '../effects/PostFX.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { MissionSystem } from '../missions/MissionSystem.js';
import { WorldEvents } from '../missions/WorldEvents.js';
import { AudioManager } from '../audio/AudioManager.js';
import { clamp, clamp01, damp } from './MathUtils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = new Settings();
    this.clock = { elapsed: 0, dt: 0, frame: 0 };
    this.paused = false;
    this.hitStopTimer = 0;
    this.cinematicMode = false;
    this.statsLine = '';
    this._fpsAccum = 0; this._fpsFrames = 0; this._fps = 60;
  }

  /* =============================================================== boot */
  async boot(onProgress = () => {}) {
    const step = (p, label) => { onProgress(p, label); return frameBreak(); };

    await step(0.02, 'Creating renderer');
    this.initRenderer();
    this.settings.autoDetect(this.renderer);
    this.applyPixelRatio();

    this.scene = new THREE.Scene();
    this.camera3 = new THREE.PerspectiveCamera(
      this.settings.fov, innerWidth / innerHeight, 0.22, 12000);
    this.camera3.position.set(0, 60, 60);

    await step(0.06, 'Generating textures');
    this.world = new World(this.scene, this.settings);

    await step(0.10, 'Laying out the city');
    let last = 0;
    await this.world.build((p, label) => {
      const q = 0.10 + p * 0.55;
      if (q - last > 0.02) { last = q; onProgress(q, label); }
    });

    await step(0.68, 'Raising the sun');
    this.dayNight = new DayNight(this.scene, this.renderer, this.settings);
    // scene.environment lights every standard material in one assignment
    this.dayNight.bakeEnvironment();

    await step(0.73, 'Suiting up');
    this.input = new Input(this.canvas, this.settings);
    this.camera = new ThirdPersonCamera(this.camera3, this.world, this.settings);
    this.fx = new Effects(this.scene, this);
    this.audio = new AudioManager(this.settings);
    this.combat = new Combat(this);
    this.enemies = new EnemyManager(this);
    this.player = new Player(this);
    this.combat.bind(this.player);

    await step(0.80, 'Filling the streets');
    this.npcs = new NPCManager(this);
    this.traffic = new TrafficManager(this);

    await step(0.86, 'Rolling in weather');
    this.weather = new Weather(this);

    await step(0.90, 'Grading the image');
    this.postfx = new PostFX(this.renderer, this.scene, this.camera3, this.settings);
    this.postfx.dayNight = this.dayNight;

    await step(0.94, 'Briefing dispatch');
    this.hud = new HUD(this);
    this.menus = new Menus(this);
    this.missions = new MissionSystem(this);
    this.events = new WorldEvents(this);
    this.ambience = new Ambience(this);

    await step(0.98, 'Final checks');
    this.placePlayerStart();
    this.bindEvents();
    onProgress(1, 'Ready');
    return this;
  }

  initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: false, powerPreference: 'high-performance',
      stencil: false, alpha: false,
    });
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.info.autoReset = false;
    this.renderer = renderer;
  }

  applyPixelRatio() {
    const p = this.settings.preset.pixelRatio;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * p);
  }

  placePlayerStart() {
    // Open on a clear avenue near the landmark. Landmark rooftops deliberately
    // carry antennas and HVAC props, which made the old opening camera begin
    // inside geometry before the player had control.
    const L = this.world.layout;
    const landmark = L.landmarks[0];
    const lx = landmark?.x || 0, lz = landmark?.z || 0;
    const crossing = L.intersections.reduce((best, q) => {
      const d = (q.x - lx) ** 2 + (q.z - lz) ** 2;
      return !best || d < best.d ? { ...q, d } : best;
    }, null);
    const x = crossing?.x || 0, y = 0.22, z = crossing?.z || 0;
    this.player.body.position.set(x, y, z);
    this.player.body.grounded = true;
    this.player.body.groundY = y;
    this.player.setState('ground');
    // Face along a road axis toward the city centre, leaving buildings on the
    // sides for a natural first swing instead of aiming into a facade corner.
    if (Math.abs(x) > Math.abs(z)) _startOut.set(Math.sign(x) || 1, 0, 0);
    else _startOut.set(0, 0, Math.sign(z) || 1);
    this.player.facing.copy(_startOut).multiplyScalar(-1);
    // Start with the reticle on a high facade beside the avenue so the first
    // swing immediately demonstrates exact point targeting and a tall arc.
    this.camera.yaw = Math.atan2(_startOut.x, _startOut.z) + 0.20;
    this.camera.pitch = -0.24;
    this.camera.lookSmoothed.set(x, y + TUNING.cameraHeight, z);
    this.camera.position.copy(this.player.position).addScaledVector(_startOut, 8).addScaledVector(_worldUp, 4.2);
    this.camera3.position.copy(this.camera.position);
    this.camera3.lookAt(this.camera.lookSmoothed);
  }

  introShot() {
    const p = this.player.position.clone();
    const look = p.clone().setY(p.y + 1.3);
    const cameraSide = new THREE.Vector3(Math.sin(this.camera.yaw), 0, Math.cos(this.camera.yaw));
    const from = p.clone().addScaledVector(cameraSide, 11).add(new THREE.Vector3(0, 7.5, 0));
    const to = p.clone().addScaledVector(cameraSide, 7.5).add(new THREE.Vector3(0, 4.6, 0));
    const shots = [
      { from, to, look, lookTo: look, dur: 4.6, fov: 48 },
    ];
    this.startCinematic(shots, 0.6, () => {
      this.hud.titleCard('ARACHNID', 'VERTICAL CITY', 4);
      this.missions.say('The city is quiet for about another twenty seconds.', 4);
    });
  }

  bindEvents() {
    addEventListener('resize', () => this.onResize());
    this.input.onLockChange = (locked) => {
      if (!locked && !this.menus.open && this.started) this.menus.show();
    };
    addEventListener('keydown', (e) => {
      if (!this.started) return;
      // Escape leaves pointer lock (which opens the menu); pressing it again closes.
      if (e.code === 'Escape' && !this.input.locked) this.menus.toggle();
      if (e.code === 'Tab') { e.preventDefault(); this.menus.open ? this.menus.close() : (this.menus.current = 'map', this.menus.show()); }
      if (e.code === 'KeyH') this.hud.show(this.hud.el.root.classList.contains('hidden'));
      if (e.code === 'F2') this.settings.showFps = !this.settings.showFps;
      if (e.code === 'KeyM' && e.shiftKey) this.audio.muted = !this.audio.muted;
    });
  }

  onResize() {
    const w = innerWidth, h = innerHeight;
    this.camera3.aspect = w / h;
    this.camera3.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.postfx.setSize(w, h);
  }

  /* ============================================================== start */
  start() {
    this.started = true;
    this.hud.show(true);
    this.audio.init();
    this.audio.resume();
    this.audio.setMusic('explore');
    this.hud.titleCard('ARACHNID', 'VERTICAL CITY', 4);
    this.missions.say('The city is quiet for about another twenty seconds.', 4);
    this.input.requestLock();
    this.last = performance.now();
    this.loop();
  }

  /* =============================================================== loop */
  loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, 0.05);                    // never simulate more than 50 ms

    this._fpsAccum += dt; this._fpsFrames++;
    if (this._fpsAccum > 0.5) {
      this._fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0; this._fpsFrames = 0;
      this.updateStatsLine();
    }

    const paused = this.menus.open;
    if (paused) { this.renderFrame(dt); return; }

    // hit-stop and time dilation
    let scale = 1;
    if (this.hitStopTimer > 0) { this.hitStopTimer -= dt; scale = 0.04; }
    scale *= this.combat.timeDilation;
    const sdt = dt * scale;

    this.clock.dt = sdt;
    this.clock.elapsed += sdt;
    this.clock.frame++;

    this.update(sdt, dt);
    this.renderFrame(dt);
    this.input.endFrame(dt);
  };

  update(dt, realDt) {
    const input = this.input;
    input.pollGamepad(realDt);

    if (!this.cinematicMode) {
      this.camera.handleMouse(input);
      this.combat.update(dt);
    }
    this.player.update(dt, this.camera3);
    this.camera.update(dt, this.player);

    this.world.update(dt, this.camera3.position);
    this.enemies.update(dt, this.player);
    this.npcs.update(dt, this.player);
    this.traffic.update(dt, this.player);

    this.dayNight.update(realDt, this.player.position, this.weather);
    this.weather.update(realDt, this.camera3, this.player);
    this.ambience.update(dt, this.player, this.camera3);

    this.missions.update(dt);
    this.events.update(dt);

    this.fx.update(dt);
    this.postfx.update(dt, this.player, this.camera3);
    this.audio.update(dt, this);

    this.hud.update(dt, this);
    this.hud.updateMarkers(this.missions.markers, this.camera3, this.player.position);
  }

  renderFrame(dt) {
    this.renderer.info.reset();
    this.postfx.render(dt);
  }

  updateStatsLine() {
    const info = this.renderer.info;
    this.statsLine =
      `${this._fps.toFixed(0)} FPS   ${this.settings.preset.name}\n` +
      `draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k\n` +
      `npc ${this.npcs.visibleCount || 0}  cars ${this.traffic.activeCount || 0}  ` +
      `foes ${this.enemies.aliveCount}\n` +
      `${this.world.districtNameAtWorld(this.player.position.x, this.player.position.z)}`;
  }

  /* ========================================================== utilities */
  hitStop(seconds) { this.hitStopTimer = Math.max(this.hitStopTimer, seconds); }

  startCinematic(shots, dof = 0.5, onDone = null) {
    this.cinematicMode = true;
    this.hud.cinematicBars(true);
    this.postfx.setCinematicDof(dof);
    this.camera.playCinematic(shots, () => {
      this.cinematicMode = false;
      this.hud.cinematicBars(false);
      this.postfx.setCinematicDof(0);
      if (onDone) onDone();
    });
  }
  endCinematic() {
    if (this.camera.cinematic) this.camera.stopCinematic();
    this.cinematicMode = false;
    this.hud.cinematicBars(false);
    this.postfx.setCinematicDof(0);
  }

  fastTravel(point) {
    const y = (point.y || 0) + 2;
    this.player.teleport(point.x, y + 6, point.z);
    this.camera.position.set(point.x + 10, y + 8, point.z + 10);
    this.hud.toast('FAST TRAVEL', point.label || 'Arrived', 'good');
    this.fx.burst(new THREE.Vector3(point.x, y, point.z), 26,
      { speed: 8, size: 0.6, life: 0.8, color: [0.9, 0.95, 1], up: 1 });
    this.audio.play('zip', this.player.position);
  }

  setQuality(q) {
    if (this.settings.quality === q) return;
    this.settings.quality = q;
    this.settings.save();
    this.applyPixelRatio();
    // Live-apply what we can; the city rebuild is offered rather than forced,
    // because dropping the player mid-swing to regenerate geometry is worse
    // than a slightly denser city than the preset asks for.
    const p = this.settings.preset;
    this.dayNight.sun.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    this.dayNight.sun.shadow.map?.dispose();
    this.dayNight.sun.shadow.map = null;
    this.dayNight.sun.castShadow = p.shadows;
    this.dayNight.preset = p;
    this.world.preset = p;
    this.postfx.applySettings();
    this.hud.toast('QUALITY: ' + p.name, 'Reload the page for full effect', '');
  }

  /* -------------------------------------------------------- callbacks */
  onPlayerState(state, prev) {
    if (state === 'ground' && (prev === 'air' || prev === 'dive')) {
      if (this.player.position.y < 3) {
        this.npcs.attention(this.player.position, 26);
        if (this.player.body.lastImpactSpeed > 24) this.npcs.alarm(this.player.position, 22, 0.5);
      }
    }
    if (state === 'swing') this.hud.pingReticle('web');
  }

  onEnemyDefeated(enemy) {
    this.npcs.alarm(enemy.position, 24, 0.4);
    if (this.enemies.aliveCount === 0 && this.missions.stage !== 'combat') {
      this.audio.setMusic(this.missions.mainDone ? 'explore' : 'mission');
    }
  }

  onEncounterCleared(enc) {
    this.hud.toast('AREA CLEAR', enc.label + ' neutralised', 'good');
  }
}

/** Yield to the browser so the loading bar actually paints between build steps. */
function frameBreak() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

const _startOut = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
