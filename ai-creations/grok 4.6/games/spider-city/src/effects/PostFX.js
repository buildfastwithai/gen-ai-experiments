/* effects/PostFX.js
   The look.

   Chain: Render -> Bloom -> Cinematic -> Output(tonemap+sRGB) -> SMAA

   The Cinematic pass is one fragment shader doing the work a stack of separate
   passes usually does, which keeps the bandwidth cost to a single full-screen
   read: radial motion blur that scales with speed, a bokeh-ish defocus toward
   frame edges for cinematics, chromatic aberration, filmic grading (lift/gamma/
   gain + saturation), lens rain, a lightning flash, a combat "focus" desaturation
   ring, and a subtle vignette. All of it is uniform-driven so gameplay can
   modulate any of it per frame. */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { clamp01, damp, lerp } from '../core/MathUtils.js';

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uSpeed: { value: 0 },        // radial motion blur
    uDof: { value: 0 },          // cinematic defocus
    uCA: { value: 0.85 },        // chromatic aberration
    uGrain: { value: 0.5 },
    uVignette: { value: 0.34 },
    uFlash: { value: 0 },
    uRain: { value: 0 },
    uFocus: { value: 0 },        // perfect-dodge / focus ring
    uSat: { value: 1.06 },
    uContrast: { value: 1.05 },
    uLift: { value: new THREE.Vector3(0.006, 0.008, 0.016) },
    uGain: { value: new THREE.Vector3(1.02, 1.0, 0.985) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uSpeed, uDof, uCA, uGrain, uVignette, uFlash, uRain, uFocus;
    uniform float uSat, uContrast;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;

    float hash( vec2 p ){ return fract( sin( dot( p, vec2(127.1, 311.7) ) ) * 43758.5453 ); }

    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r = length( c ) * 1.42;

      // --- lens rain: refract the frame through a few crawling droplets
      if ( uRain > 0.01 ) {
        vec2 g = uv * vec2( 7.0, 5.0 );
        g.y += uTime * 0.35;
        vec2 id = floor( g );
        vec2 f = fract( g ) - 0.5;
        float h = hash( id );
        if ( h > 1.0 - uRain * 0.34 ) {
          float d = length( f * vec2( 1.0, 1.5 ) );
          float drop = smoothstep( 0.34, 0.0, d );
          uv += f * drop * 0.028 * uRain;
        }
      }

      // --- radial motion blur + defocus in one tap loop
      float blur = uSpeed * 0.026 * r * r + uDof * 0.014 * smoothstep( 0.15, 1.0, r );
      vec3 col = vec3( 0.0 );
      if ( blur > 0.0006 ) {
        float w = 0.0;
        for ( int i = 0; i < 8; i++ ) {
          float t = float( i ) / 7.0;
          vec2 o = c * blur * ( t - 0.35 );
          float wi = 1.0 - t * 0.55;
          col += texture2D( tDiffuse, uv - o ).rgb * wi;
          w += wi;
        }
        col /= w;
      } else {
        col = texture2D( tDiffuse, uv ).rgb;
      }

      // --- chromatic aberration, stronger at the edges and with speed
      float ca = uCA * ( 0.0016 + uSpeed * 0.0035 ) * r;
      if ( ca > 0.00002 ) {
        col.r = texture2D( tDiffuse, uv + c * ca ).r;
        col.b = texture2D( tDiffuse, uv - c * ca ).b;
      }

      // --- grade: lift / gain, contrast about mid grey, saturation
      col = col * uGain + uLift;
      col = ( col - 0.5 ) * uContrast + 0.5;
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( vec3( l ), col, uSat );

      // --- focus ring: desaturate + warm the periphery during counters
      if ( uFocus > 0.001 ) {
        float ring = smoothstep( 0.25, 0.95, r );
        vec3 grey = vec3( dot( col, vec3(0.299,0.587,0.114) ) );
        col = mix( col, mix( col, grey, 0.75 ) * vec3( 1.15, 0.86, 0.86 ), ring * uFocus );
      }

      // --- lightning
      col += uFlash * vec3( 0.72, 0.79, 0.95 );

      // --- vignette
      col *= mix( 1.0, smoothstep( 1.35, 0.28, r ), uVignette );

      // --- grain, animated, slightly stronger in the shadows
      float n = hash( gl_FragCoord.xy + fract( uTime ) * 431.0 ) - 0.5;
      col += n * uGrain * 0.035 * ( 1.25 - clamp( l, 0.0, 1.0 ) );

      gl_FragColor = vec4( max( col, 0.0 ), 1.0 );
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, settings) {
    this.renderer = renderer;
    this.settings = settings;
    const preset = settings.preset;
    const size = renderer.getSize(new THREE.Vector2());

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y), preset.bloomStrength, 0.52, 0.88);
    this.bloom.enabled = preset.bloom;
    this.composer.addPass(this.bloom);

    this.cine = new ShaderPass(CinematicShader);
    this.cine.uniforms.uRes.value.set(size.x, size.y);
    this.cine.enabled = preset.cinematicFX;
    this.composer.addPass(this.cine);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    if (preset.smaa) {
      this.smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
      this.composer.addPass(this.smaa);
    }

    this.speed = 0;
    this.speedPulse = 0;
    this.dof = 0;
    this.focus = 0;
    this.flash = 0;
    this.rain = 0;
    this.applySettings();
  }

  applySettings() {
    const s = this.settings;
    const u = this.cine.uniforms;
    u.uGrain.value = s.filmGrain ? 0.55 : 0;
    u.uCA.value = s.chromaticAberration ? 0.9 : 0;
    this.motionBlur = s.motionBlur;
    this.dofEnabled = s.depthOfField;
    this.bloom.enabled = s.preset.bloom;
    this.bloom.strength = s.preset.bloomStrength;
    this.cine.enabled = s.preset.cinematicFX;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.cine.uniforms.uRes.value.set(w, h);
    this.bloom.setSize(w, h);
  }

  pulseSpeed(v) { this.speedPulse = Math.max(this.speedPulse, v); }
  pulseFocus(v) { this.focus = Math.max(this.focus, v); }
  setFlash(v) { this.flash = v; }
  setRain(v) { this.rain = v; }
  setCinematicDof(v) { this.dofTarget = v; }

  update(dt, player, camera) {
    const u = this.cine.uniforms;
    u.uTime.value += dt;

    const rawSpeed = player ? clamp01((player.speed - 14) / 46) : 0;
    const want = this.motionBlur ? Math.max(rawSpeed, this.speedPulse) : 0;
    this.speed = damp(this.speed, want, 5, dt);
    this.speedPulse = Math.max(0, this.speedPulse - dt * 1.6);
    u.uSpeed.value = this.speed;

    const dofWant = this.dofEnabled ? (this.dofTarget || 0) : 0;
    this.dof = damp(this.dof, dofWant, 3, dt);
    u.uDof.value = this.dof;

    this.focus = Math.max(0, this.focus - dt * 1.9);
    u.uFocus.value = this.focus;
    u.uFlash.value = this.flash;
    u.uRain.value = this.rain;

    // grade drifts with the time of day: cooler and crushed at night
    if (this.dayNight) {
      const n = this.dayNight.nightFactor;
      u.uSat.value = damp(u.uSat.value, lerp(1.08, 0.94, n), 2, dt);
      u.uContrast.value = damp(u.uContrast.value, lerp(1.05, 1.12, n), 2, dt);
      u.uLift.value.set(0.004 + n * 0.004, 0.006 + n * 0.005, 0.012 + n * 0.014);
      u.uVignette.value = damp(u.uVignette.value, 0.34 + n * 0.12, 2, dt);
    }
  }

  render(dt) { this.composer.render(dt); }
}
