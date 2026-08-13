/* weather/DayNight.js
   Sun, sky, stars, moon, fog, exposure, and the single `nightFactor` that the
   whole city reads to switch its windows on.

   The sky uses Preetham scattering (three's Sky object) driven by a real solar
   elevation, and the environment map is re-baked from it a few times a minute —
   which is why glass towers actually reflect the sunset instead of a static cube.
   The shadow camera is retargeted around the player every frame so a single
   high-resolution cascade covers the play area at full density. */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { cityUniforms } from '../world/CityMaterials.js';
import { clamp, damp, lerp } from '../core/MathUtils.js';

const DAY_COLORS = {
  //                     fog          ambient      sun
  dawn:    { fog: 0xc99a72, amb: 0x4a4256, sun: 0xffb066, sunI: 2.2, ambI: 0.55, exp: 1.05 },
  day:     { fog: 0x9fb8d0, amb: 0x6a7d96, sun: 0xfff3e0, sunI: 2.8, ambI: 0.80, exp: 1.0 },
  sunset:  { fog: 0xd98a54, amb: 0x53455a, sun: 0xff8a3d, sunI: 2.6, ambI: 0.6, exp: 1.08 },
  night:   { fog: 0x0d1524, amb: 0x1a2740, sun: 0x9fb6ff, sunI: 0.28, ambI: 0.42, exp: 1.28 },
};

export class DayNight {
  constructor(scene, renderer, settings) {
    this.scene = scene;
    this.renderer = renderer;
    this.settings = settings;
    this.preset = settings.preset;

    this.daylightHour = 13.25;
    this.timeOfDay = this.daylightHour;
    this.nightFactor = 0;
    this.sunElevation = 0;

    /* ---- sky ---- */
    this.sky = new Sky();
    this.sky.scale.setScalar(60000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.2;
    u.rayleigh.value = 2.1;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);
    this.sunDir = new THREE.Vector3();

    /* ---- lights ---- */
    this.sun = new THREE.DirectionalLight(0xffffff, 3.2);
    this.sun.castShadow = this.preset.shadows;
    const S = this.preset.shadowDistance;
    const cam = this.sun.shadow.camera;
    cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S;
    cam.near = 1; cam.far = S * 4.2;
    this.sun.shadow.mapSize.set(this.preset.shadowMapSize, this.preset.shadowMapSize);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.blurSamples = 8;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9fc0ff, 0x413a33, 0.8);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x404a5c, 0.35);
    scene.add(this.ambient);

    /* ---- stars ---- */
    this.stars = makeStars(2600, 8200);
    this.stars.visible = false;
    scene.add(this.stars);

    /* ---- moon ---- */
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(180, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xdfe6f5, fog: false, toneMapped: false,
        transparent: true, depthWrite: false,
      }));
    this.moon.visible = false;
    scene.add(this.moon);

    /* ---- fog ---- */
    this.fog = new THREE.FogExp2(0x9fb8d0, 0.0016);
    scene.fog = this.fog;
    this.fogColor = new THREE.Color(0x9fb8d0);

    /* ---- environment ---- */
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envScene = new THREE.Scene();
    this.envTarget = null;
    this.envTimer = 999;

  }

  setTime(h) {
    this.daylightHour = clamp(h, 10.5, 15.5);
    this.timeOfDay = this.daylightHour;
    this.envTimer = 999;
  }

  get clockString() {
    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /* ------------------------------------------------------------ update */
  update(dt, playerPos, weather) {
    this.timeOfDay = this.daylightHour;

    // solar position: elevation peaks at noon, azimuth sweeps west
    const t = (this.timeOfDay - 6) / 12;                 // 0 at 06:00, 1 at 18:00
    const elevation = Math.sin(t * Math.PI) * 68 - 4;    // degrees
    const azimuth = 190 + (this.timeOfDay / 24) * 300;
    this.sunElevation = elevation;

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);

    /* ---- blend the palette ---- */
    const night = 0;
    this.nightFactor = 0;
    const golden = 0;
    const key = DAY_COLORS.day;

    _c1.setHex(key.fog);
    _c2.setHex(key.sun);
    _c3.setHex(key.amb);

    // weather pushes everything grey and dim
    const overcast = weather ? clamp(weather.overcast, 0, 0.72) : 0;
    const rain = weather ? weather.rainAmount : 0;
    _c1.lerp(_cGrey, overcast * 0.42);
    const sunI = Math.max(1.75, key.sunI * (1 - overcast * 0.42) * (1 - rain * 0.12));
    const ambI = key.ambI * (1 + overcast * 0.22);

    this.sun.color.lerp(_c2, 1 - Math.exp(-3 * dt));
    this.sun.intensity = damp(this.sun.intensity, sunI, 3, dt);
    this.hemi.intensity = damp(this.hemi.intensity, ambI, 3, dt);
    this.hemi.color.lerp(_c1, 1 - Math.exp(-3 * dt));
    this.hemi.groundColor.setHex(0x51483d);
    this.ambient.intensity = damp(this.ambient.intensity, 0.28 + overcast * 0.12, 3, dt);
    this.ambient.color.lerp(_c3, 1 - Math.exp(-3 * dt));

    this.fogColor.lerp(_c1, 1 - Math.exp(-2.5 * dt));
    this.fog.color.copy(this.fogColor);
    this.fog.density = damp(this.fog.density,
      0.00078 + overcast * 0.00072 + rain * 0.00105, 2, dt);
    cityUniforms.uFogColor.value.copy(this.fogColor);

    // sky scattering shifts with weather
    const u = this.sky.material.uniforms;
    u.turbidity.value = damp(u.turbidity.value, 3.4 + overcast * 9, 2, dt);
    u.rayleigh.value = damp(u.rayleigh.value, lerp(2.4, 0.6, overcast), 2, dt);
    u.mieCoefficient.value = damp(u.mieCoefficient.value, 0.005 + golden * 0.012, 2, dt);

    this.renderer.toneMappingExposure = damp(this.renderer.toneMappingExposure,
      1.01 - overcast * 0.03, 2.5, dt);

    /* ---- city window lights ---- */
    cityUniforms.uNight.value = damp(cityUniforms.uNight.value, 0, 3.5, dt);

    /* ---- sun placement + shadow framing ---- */
    const D = this.preset.shadowDistance;
    this.sun.position.copy(playerPos).addScaledVector(this.sunDir, D * 2.0);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();
    this.sun.visible = true;
    if (this.sun.castShadow !== this.preset.shadows) {
      this.sun.castShadow = this.preset.shadows;
    }

    /* ---- stars + moon ---- */
    this.stars.visible = false;
    this.moon.visible = false;

    /* ---- environment re-bake ---- */
    this.envTimer += dt;
    if (this.envTimer > this.preset.envRefresh) {
      this.envTimer = 0;
      this.bakeEnvironment();
    }
  }

  bakeEnvironment() {
    const parent = this.sky.parent;
    this.envScene.add(this.sky);
    const rt = this.pmrem.fromScene(this.envScene, 0.04);
    if (parent) parent.add(this.sky); else this.scene.add(this.sky);
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = rt;
    this.scene.environment = rt.texture;
  }

  dispose() {
    this.pmrem.dispose();
    this.envTarget?.dispose();
  }
}

function makeStars(count, radius) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // upper hemisphere only, denser near the horizon like a real sky looks
    const u = Math.random(), v = Math.random() * 0.92 + 0.04;
    const th = u * Math.PI * 2, ph = Math.acos(1 - v);
    const r = radius;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * 0.85 + 200;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    const m = Math.random();
    size[i] = 6 + m * m * 26;
    const warm = 0.75 + Math.random() * 0.25;
    col[i * 3] = warm; col[i * 3 + 1] = warm * (0.9 + Math.random() * 0.1); col[i * 3 + 2] = 1.0;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: `
      attribute float aSize; attribute vec3 aColor; varying vec3 vC;
      void main(){ vC = aColor;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 0.06; }`,
    fragmentShader: `
      uniform float uOpacity; varying vec3 vC;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vC, a * uOpacity);
      }`,
    // depthTest stays ON: stars sit inside the far plane, so buildings must occlude them.
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, fog: false,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.renderOrder = -1;
  Object.defineProperty(p.material, 'opacity', {
    get() { return this.uniforms.uOpacity.value; },
    set(v) { this.uniforms.uOpacity.value = v; },
  });
  return p;
}

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _c3 = new THREE.Color();
const _cGrey = new THREE.Color(0x8d949c);
