/* weather/Weather.js
   Clear · cloudy · rain · storm, with real consequences.

   Rain is a single GPU-side particle box that follows the camera and wraps
   internally, so 16 000 streaks cost one draw call and never need respawning on
   the CPU. Wetness is a global uniform: the road shader grows puddles and drops
   its roughness, facades gain sheen, headlight pools bloom, and the fog thickens.
   Storms add sky-wide lightning that actually relights the scene for two frames. */

import * as THREE from 'three';
import { cityUniforms } from '../world/CityMaterials.js';
import { clamp, clamp01, lerp, damp, makeRng } from '../core/MathUtils.js';

const RAIN_VERT = /* glsl */`
  uniform float uTime;
  uniform vec3 uOrigin;
  uniform float uBox;
  uniform float uSpeed;
  uniform vec3 uWind;
  attribute float aSeed;
  attribute float aLen;
  varying float vFade;
  void main() {
    vec3 p = position;
    // fall + wind, wrapped inside the box so particles never need recycling
    p.y -= uTime * uSpeed * ( 0.75 + aSeed * 0.5 );
    p.xz += uWind.xz * uTime * ( 0.6 + aSeed * 0.8 );
    p = mod( p - uOrigin + uBox * 0.5, uBox ) - uBox * 0.5 + uOrigin;
    vec4 mv = modelViewMatrix * vec4( p, 1.0 );
    // stretch the streak along the fall direction in view space
    mv.y += aLen * 0.5;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix( 1.4, 3.6, aSeed ) * ( 200.0 / max( -mv.z, 1.0 ) );
    vFade = 1.0 - smoothstep( uBox * 0.25, uBox * 0.5, length( p - uOrigin ) );
  }`;

const RAIN_FRAG = /* glsl */`
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // vertical streak, not a dot
    float a = smoothstep( 0.5, 0.0, abs( c.x ) * 3.2 ) * smoothstep( 0.55, 0.0, abs( c.y ) );
    gl_FragColor = vec4( vec3( 0.72, 0.80, 0.92 ), a * uOpacity * vFade );
  }`;

export const WEATHER = ['clear', 'cloudy', 'rain', 'storm'];

export class Weather {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.rng = makeRng(31337);

    this.state = 'clear';
    this.next = 'clear';
    this.timer = 70;
    this.overcast = 0;
    this.rainAmount = 0;
    this.wetness = 0;
    this.windDir = new THREE.Vector2(0.6, 0.3);
    this.lightningTimer = 4;
    this.flash = 0;

    const count = game.settings.preset.rainParticles;
    this.box = 90;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const len = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.box;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.box;
      seed[i] = Math.random();
      len[i] = 0.4 + Math.random() * 1.4;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.rainMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3() },
        uBox: { value: this.box }, uSpeed: { value: 34 },
        uWind: { value: new THREE.Vector3(2, 0, 1) }, uOpacity: { value: 0 },
      },
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG,
      transparent: true, depthWrite: false, fog: false,
    });
    this.rain = new THREE.Points(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 7;
    this.rain.visible = false;
    this.scene.add(this.rain);

    /* cloud layer: a big translucent plane high above the city */
    const cg = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    cg.rotateX(Math.PI / 2);
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0x8f96a0, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    });
    this.clouds = new THREE.Mesh(cg, this.cloudMat);
    this.clouds.position.y = 620;
    this.clouds.renderOrder = -2;
    this.scene.add(this.clouds);

    /* lightning relights the scene for a couple of frames */
    this.bolt = new THREE.DirectionalLight(0xdfe9ff, 0);
    this.bolt.position.set(400, 900, -300);
    this.scene.add(this.bolt);

    this.splashTimer = 0;
  }

  set(state, immediate = false) {
    this.next = state;
    this.timer = 60 + this.rng() * 90;
    if (immediate) this.state = state;
    this.game.hud?.setWeather(state);
  }

  cycle() {
    const r = this.rng();
    let n;
    if (this.state === 'clear') n = r < 0.55 ? 'cloudy' : 'clear';
    else if (this.state === 'cloudy') n = r < 0.4 ? 'rain' : r < 0.75 ? 'clear' : 'cloudy';
    else if (this.state === 'rain') n = r < 0.25 ? 'storm' : r < 0.7 ? 'cloudy' : 'rain';
    else n = r < 0.6 ? 'rain' : 'cloudy';
    this.set(n);
  }

  /* ------------------------------------------------------------ update */
  update(dt, camera, player) {
    this.timer -= dt;
    if (this.timer <= 0) this.cycle();
    this.state = this.next;

    const targetOvercast = { clear: 0.04, cloudy: 0.55, rain: 0.82, storm: 1.0 }[this.state];
    const targetRain = { clear: 0, cloudy: 0, rain: 0.72, storm: 1.0 }[this.state];

    this.overcast = damp(this.overcast, targetOvercast, 0.35, dt);
    this.rainAmount = damp(this.rainAmount, targetRain, 0.4, dt);
    // roads stay wet for a while after the rain stops — the detail people notice
    const dryRate = this.rainAmount > 0.05 ? 0.9 : 0.055;
    this.wetness = damp(this.wetness, clamp01(this.rainAmount * 1.15), dryRate, dt);
    cityUniforms.uWet.value = this.wetness;

    /* clouds */
    this.cloudMat.opacity = this.overcast * 0.55;
    this.clouds.visible = this.overcast > 0.02;
    this.clouds.position.x = camera.position.x + Math.sin(this.game.clock.elapsed * 0.01) * 60;
    this.clouds.position.z = camera.position.z;
    this.cloudMat.color.setHSL(0.6, 0.06, lerp(0.42, 0.14, this.game.dayNight.nightFactor));

    /* rain */
    this.rain.visible = this.rainAmount > 0.02;
    if (this.rain.visible) {
      const u = this.rainMat.uniforms;
      u.uTime.value = this.game.clock.elapsed;
      u.uOpacity.value = this.rainAmount * 0.65;
      u.uSpeed.value = lerp(26, 44, this.rainAmount);
      u.uWind.value.set(this.windDir.x * 9 * this.rainAmount, 0, this.windDir.y * 9 * this.rainAmount);
      u.uOrigin.value.copy(camera.position);
      this.rain.position.set(0, 0, 0);

      // splashes on whatever surface is under the player
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.splashTimer = 0.03 / Math.max(0.15, this.rainAmount);
        const r = 14;
        const x = player.position.x + (this.rng() - 0.5) * r * 2;
        const z = player.position.z + (this.rng() - 0.5) * r * 2;
        const y = this.game.world.grid.groundHeight(x, z, player.position.y + 3);
        this.game.fx.burst(_v.set(x, y + 0.05, z), 1, {
          speed: 1.4, spread: 1, size: 0.22, life: 0.28,
          color: [0.6, 0.68, 0.8], gravity: -6, drag: 1.5, up: 1.2,
        });
      }
    }

    /* lightning */
    if (this.state === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 3 + this.rng() * 9;
        this.strike();
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4.5);
      // double-tap flicker reads as a real bolt
      const f = this.flash > 0.72 ? 1 : this.flash > 0.55 ? 0.25 : this.flash;
      this.bolt.intensity = f * 9;
      this.game.postfx?.setFlash(f * 0.55);
    } else if (this.bolt.intensity !== 0) {
      this.bolt.intensity = 0;
      this.game.postfx?.setFlash(0);
    }

    this.game.postfx?.setRain(this.rainAmount);
    this.game.audio?.setWeather(this.rainAmount, this.state === 'storm');
  }

  strike() {
    this.flash = 1;
    const a = this.rng() * Math.PI * 2;
    this.bolt.position.set(
      this.game.camera.position.x + Math.cos(a) * 700, 1100,
      this.game.camera.position.z + Math.sin(a) * 700);
    this.game.audio?.thunder(1.2 + this.rng() * 2.5);
    this.game.hud?.toast('LIGHTNING', 'Storm overhead', '');
  }

  get label() { return this.state.toUpperCase(); }
}

const _v = new THREE.Vector3();
