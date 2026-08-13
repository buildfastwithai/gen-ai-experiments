/* core/Settings.js — quality presets + tunable gameplay constants.
   One place to dial the whole game. Presets are applied at boot and can be
   changed live from the pause menu (some require a world rebuild — flagged). */

export const QUALITY_PRESETS = {
  low: {
    name: 'LOW',
    pixelRatio: 0.75, shadows: false, shadowMapSize: 1024, shadowDistance: 120,
    bloom: false, bloomStrength: 0.5, cinematicFX: false, smaa: false,
    citySize: 11, npcBudget: 60, trafficBudget: 45, propDensity: 0.5,
    drawDistance: 900, rainParticles: 2500, envRefresh: 30, anisotropy: 2,
    windowLights: true, reflections: false,
  },
  medium: {
    name: 'MEDIUM',
    pixelRatio: 1.0, shadows: true, shadowMapSize: 2048, shadowDistance: 190,
    bloom: false, bloomStrength: 0.62, cinematicFX: true, smaa: false,
    citySize: 13, npcBudget: 130, trafficBudget: 90, propDensity: 0.78,
    drawDistance: 1400, rainParticles: 6000, envRefresh: 20, anisotropy: 4,
    windowLights: true, reflections: true,
  },
  high: {
    name: 'HIGH',
    pixelRatio: 1.0, shadows: true, shadowMapSize: 3072, shadowDistance: 250,
    bloom: false, bloomStrength: 0.7, cinematicFX: true, smaa: true,
    citySize: 15, npcBudget: 220, trafficBudget: 140, propDensity: 1.0,
    drawDistance: 2000, rainParticles: 11000, envRefresh: 14, anisotropy: 8,
    windowLights: true, reflections: true,
  },
  ultra: {
    name: 'ULTRA',
    pixelRatio: 1.15, shadows: true, shadowMapSize: 4096, shadowDistance: 320,
    bloom: false, bloomStrength: 0.75, cinematicFX: true, smaa: true,
    citySize: 17, npcBudget: 320, trafficBudget: 200, propDensity: 1.25,
    drawDistance: 2600, rainParticles: 16000, envRefresh: 10, anisotropy: 16,
    windowLights: true, reflections: true,
  },
};

/** Gameplay feel. These numbers ARE the game — tune here, not in the systems. */
export const TUNING = {
  gravity: 26.0,             // m/s² — punchy, not earth-real
  terminalVelocity: 92,

  walkSpeed: 4.2,
  runSpeed: 11.5,
  sprintSpeed: 17.0,
  groundAccel: 34,
  groundFriction: 12,
  airControl: 9.5,
  airDrag: 0.14,
  diveDrag: 0.045,

  jumpImpulse: 12.5,
  superJumpImpulse: 21.0,
  jumpChargeTime: 0.55,

  webMaxRange: 145,
  webMinRange: 14,
  webAttachAngle: 0.72,       // cos-ish cone in front of camera
  swingPumpForce: 27,
  swingSteerForce: 13,
  swingReelSpeed: 12,
  swingReleaseBoost: 1.10,
  swingMinRope: 14,
  swingMaxSpeed: 86,
  swingLaunchSpeed: 15,
  ropeSpring: 30,
  ropeStiffness: 1.0,
  slingshotForce: 46,
  zipSpeed: 78,

  wallRunSpeed: 15.5,
  wallStickTime: 6.0,
  wallCrawlSpeed: 6.2,
  wallJumpImpulse: 15,

  punchRange: 3.4,
  punchDamage: 12,
  comboWindow: 1.15,
  dodgeWindow: 0.28,
  dodgeImpulse: 15,

  maxHealth: 100,
  maxFocus: 100,
  focusRegen: 3.4,

  cameraDistance: 6.4,
  cameraHeight: 1.75,
  cameraShoulder: 0.9,
  cameraFovBase: 62,
  cameraFovMax: 92,
};

export const WORLD = {
  blockSize: 92,
  roadWidth: 24,
  sidewalkWidth: 5.0,
  get cell() { return this.blockSize + this.roadWidth; },
  waterLevel: -1.2,
  seed: 20260813,
};

const STORE_KEY = 'arachnid.settings.v3';

export class Settings {
  constructor() {
    this.quality = 'high';
    this.fov = TUNING.cameraFovBase;
    this.mouseSensitivity = 1.0;
    this.invertY = false;
    this.motionBlur = true;
    this.depthOfField = true;
    this.filmGrain = false;
    this.chromaticAberration = false;
    this.showFps = true;
    this.masterVolume = 0.7;
    this.musicVolume = 0.5;
    this.load();
  }
  get preset() { return QUALITY_PRESETS[this.quality] || QUALITY_PRESETS.high; }

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch (e) { /* private mode / disabled storage — defaults are fine */ }
  }
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this)); } catch (e) {}
  }

  /** Pick a starting preset from a quick GPU sniff so first-run feels right. */
  autoDetect(renderer) {
    if (localStorage.getItem(STORE_KEY)) return;   // respect the user's choice
    let tier = 'high';
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const name = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '') + '';
      const n = name.toLowerCase();
      const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
      if (mobile) tier = 'low';
      else if (/(rtx|radeon rx (6|7|9)|apple m[2-9]|arc a7)/.test(n)) tier = 'ultra';
      else if (/(gtx|apple m1|radeon rx 5|iris xe)/.test(n)) tier = 'high';
      else if (/(intel|uhd|hd graphics|swiftshader|llvmpipe)/.test(n)) tier = 'low';
      if ((navigator.hardwareConcurrency || 4) <= 4 && tier !== 'low') tier = 'medium';
    } catch (e) { /* keep default */ }
    this.quality = tier;
  }
}
