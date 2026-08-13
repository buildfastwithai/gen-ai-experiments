/* world/CityMaterials.js
   The shader plumbing that makes one draw call look like a thousand buildings.

   Every facade is a single InstancedMesh of unit boxes. Two custom instanced
   attributes do the heavy lifting:
     aUvXform (vec4) — per-building UV scale + offset, so a 12-storey walk-up and
                       a 60-storey tower share a texture yet both show correctly
                       sized windows, and no two buildings show the same lit-window
                       pattern.
     aSeed    (float) — per-building randomness: window colour temperature,
                        how many lights are on tonight, grime bias.

   Shared uniforms (uNight / uWet / uTime) are owned here and driven by the
   day-night and weather systems, so one assignment relights the whole city. */

import * as THREE from 'three';
import { makeFacade, makeAsphalt, makeSidewalk, makeRoofTexture, makeGrass, makeWaterNormal }
  from './TextureFactory.js';

export const cityUniforms = {
  uNight: { value: 0.0 },   // 0 = noon, 1 = full dark (windows on)
  uWet:   { value: 0.0 },   // 0 = dry, 1 = soaked
  uTime:  { value: 0.0 },
  uFogColor: { value: new THREE.Color(0x8fa6bd) },
};

const INSTANCED_DECL = /* glsl */`
  attribute vec4 aUvXform;
  attribute float aSeed;
  varying float vSeed;
`;

const INSTANCED_UV = /* glsl */`
  vSeed = aSeed;
  #ifdef USE_MAP
    vMapUv = vMapUv * aUvXform.xy + aUvXform.zw;
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv = vNormalMapUv * aUvXform.xy + aUvXform.zw;
  #endif
  #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv = vRoughnessMapUv * aUvXform.xy + aUvXform.zw;
  #endif
  #ifdef USE_EMISSIVEMAP
    vEmissiveMapUv = vEmissiveMapUv * aUvXform.xy + aUvXform.zw;
  #endif
`;

/** Attach the instanced-UV machinery to any MeshStandardMaterial. */
function makeInstancedFacadeShader(mat, key) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight;
    shader.uniforms.uWet = cityUniforms.uWet;

    shader.vertexShader = INSTANCED_DECL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n' + INSTANCED_UV
    );

    shader.fragmentShader = 'varying float vSeed;\nuniform float uNight;\nuniform float uWet;\n'
      + shader.fragmentShader;

    // Windows light up at night, warm or cool depending on the building's seed,
    // and a portion of buildings stay noticeably darker than their neighbours.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */`
      #ifdef USE_EMISSIVEMAP
        vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
        float occupancy = 0.45 + 0.55 * fract( vSeed * 91.7 );
        vec3 warm = mix( vec3(1.0, 0.80, 0.52), vec3(0.72, 0.86, 1.0), fract( vSeed * 37.3 ) );
        totalEmissiveRadiance *= emissiveColor.rgb * warm * uNight * occupancy;
      #endif`
    );

    // Rain darkens and polishes vertical surfaces slightly (never mirror-like).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */`
      #include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.72, uWet );`
    );
  };
  mat.customProgramCacheKey = () => 'arachnid-facade-' + key;
  return mat;
}

/** Apply per-instance UV transform + seed buffers to an InstancedMesh geometry. */
export function attachInstanceAttributes(geometry, count) {
  const uv = new Float32Array(count * 4);
  const seed = new Float32Array(count);
  geometry.setAttribute('aUvXform', new THREE.InstancedBufferAttribute(uv, 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  return { uv, seed };
}

/* ---------------------------------------------------------------- facades */

const facadeMatCache = new Map();

export function facadeMaterial(style, variant = 0, opts = {}) {
  const key = `${style}:${variant}`;
  if (facadeMatCache.has(key)) return facadeMatCache.get(key);
  const tex = makeFacade(style, variant + 1);
  const glassy = style.startsWith('glass');
  const mat = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    roughnessMap: tex.roughnessMap,
    emissiveMap: tex.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
    roughness: 1.0,
    metalness: glassy ? 0.42 : 0.04,
    envMapIntensity: glassy ? 1.15 : 0.55,
    normalScale: new THREE.Vector2(glassy ? 0.5 : 1.0, glassy ? 0.5 : 1.0),
    ...opts,
  });
  mat.userData.bays = tex.bays;
  mat.userData.floors = tex.floors;
  makeInstancedFacadeShader(mat, key);
  facadeMatCache.set(key, mat);
  return mat;
}

/* ------------------------------------------------------------ ground sets */

let _road = null, _sidewalk = null, _roof = null, _grass = null, _water = null;

export function roadMaterial() {
  if (_road) return _road;
  const t = makeAsphalt();
  t.map.repeat.set(1, 1); t.normalMap.repeat.set(1, 1); t.roughnessMap.repeat.set(1, 1);
  _road = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    roughness: 1.0, metalness: 0.02, envMapIntensity: 0.7,
    normalScale: new THREE.Vector2(1.0, 1.0),
  });
  _road.onBeforeCompile = (s) => {
    s.uniforms.uWet = cityUniforms.uWet;
    s.uniforms.uTime = cityUniforms.uTime;
    s.fragmentShader = 'uniform float uWet;\nuniform float uTime;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */`
      #include <roughnessmap_fragment>
      // Puddles: low-frequency blobs of near-mirror roughness, plus a general sheen.
      float p = sin( vMapUv.x * 2.1 + 1.3 ) * sin( vMapUv.y * 1.7 - 0.6 );
      float puddle = smoothstep( 0.18, 0.75, p ) * uWet;
      roughnessFactor = mix( roughnessFactor, 0.055, clamp( uWet * 0.55 + puddle * 0.9, 0.0, 1.0 ) );`
    );
    s.fragmentShader = s.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */`
      #include <map_fragment>
      diffuseColor.rgb *= mix( 1.0, 0.46, uWet );`
    );
    s.fragmentShader = s.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      /* glsl */`
      #include <metalnessmap_fragment>
      metalnessFactor = mix( metalnessFactor, 0.35, uWet );`
    );
  };
  _road.customProgramCacheKey = () => 'arachnid-road';
  return _road;
}

export function sidewalkMaterial() {
  if (_sidewalk) return _sidewalk;
  const t = makeSidewalk();
  _sidewalk = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    roughness: 1.0, metalness: 0.0, envMapIntensity: 0.6,
  });
  _sidewalk.onBeforeCompile = (s) => {
    s.uniforms.uWet = cityUniforms.uWet;
    s.fragmentShader = 'uniform float uWet;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, uWet);');
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.62, uWet);');
  };
  _sidewalk.customProgramCacheKey = () => 'arachnid-sidewalk';
  return _sidewalk;
}

export function roofMaterial() {
  if (_roof) return _roof;
  const t = makeRoofTexture();
  _roof = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughness: 0.94, metalness: 0.03,
    envMapIntensity: 0.5,
  });
  _roof.onBeforeCompile = (s) => {
    s.uniforms.uWet = cityUniforms.uWet;
    s.fragmentShader = 'uniform float uWet;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, uWet*0.85);');
  };
  _roof.customProgramCacheKey = () => 'arachnid-roof';
  return _roof;
}

export function grassMaterial() {
  if (_grass) return _grass;
  const t = makeGrass();
  _grass = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.55,
  });
  return _grass;
}

export function waterMaterial() {
  if (_water) return _water;
  const n = makeWaterNormal();
  n.repeat.set(28, 28);
  _water = new THREE.MeshStandardMaterial({
    color: 0x0b1a26, roughness: 0.06, metalness: 0.55,
    normalMap: n, normalScale: new THREE.Vector2(0.85, 0.85),
    envMapIntensity: 1.5, transparent: true, opacity: 0.94,
  });
  _water.onBeforeCompile = (s) => {
    s.uniforms.uTime = cityUniforms.uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <uv_vertex>',
      `#include <uv_vertex>
       #ifdef USE_NORMALMAP
         vNormalMapUv += vec2( uTime * 0.006, uTime * 0.0031 );
       #endif`);
  };
  _water.customProgramCacheKey = () => 'arachnid-water';
  return _water;
}

/* ------------------------------------------------------------- utilities */

/** Cheap unlit emissive used for neon, headlights, window strips, web tracers. */
export function glowMaterial(color, opacity = 1, blending = THREE.AdditiveBlending) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending, depthWrite: false, toneMapped: false,
  });
}

export function paintedMetal(color, rough = 0.42, metal = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 1.0 });
}

/** Push the current environment map onto every standard material in a scene graph. */
export function applyEnvironment(root, envMap) {
  root.traverse((o) => {
    const m = o.material;
    if (!m) return;
    const list = Array.isArray(m) ? m : [m];
    for (const mm of list) if (mm.isMeshStandardMaterial) { mm.envMap = envMap; mm.needsUpdate = true; }
  });
}
