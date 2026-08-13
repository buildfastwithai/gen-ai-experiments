/* player/CharacterRig.js
   A jointed humanoid built entirely from code.

   No GLB, no skinning: the body is a hierarchy of Object3D joints with tapered
   limb meshes parented to them. That buys us (a) zero download, (b) exact
   control for IK and procedural motion, and (c) one rig shared by the hero and
   every enemy archetype at different proportions and materials.

   The suit is the point of pride here: a woven hex normal map, a diamond web
   lattice in the albedo, matte-vs-satin panel breakup, brushed metal accents,
   and eye lenses with their own reflective/emissive material that the animator
   squints for expression. */

import * as THREE from 'three';
import { makeSuitTextures } from '../world/TextureFactory.js';
import { mergeGeos } from '../world/CityBuilder.js';
import { makeRng, clamp, lerp } from '../core/MathUtils.js';

/* ------------------------------------------------------------- textures */

let _webMap = null;
function webLatticeTexture(base = '#b8202f', line = 'rgba(20,8,12,0.85)') {
  const key = base + line;
  if (_webMap && _webMap.key === key) return _webMap.tex;
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, s, s);
  // subtle panel breakup
  const rng = makeRng(17);
  for (let i = 0; i < 40; i++) {
    c.globalAlpha = 0.05 + rng() * 0.07;
    c.fillStyle = rng() < 0.5 ? '#000' : '#fff';
    c.fillRect(rng() * s, rng() * s, 10 + rng() * 60, 8 + rng() * 40);
  }
  c.globalAlpha = 1;
  // diamond lattice — tiles seamlessly and reads as webbing at any distance
  c.strokeStyle = line; c.lineWidth = 1.7; c.lineCap = 'round';
  const step = 32;
  for (let k = -s; k <= s * 2; k += step) {
    c.beginPath();
    for (let x = 0; x <= s; x += 8) {
      const y = k + x + Math.sin((x / s) * Math.PI * 2) * 3;
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    c.beginPath();
    for (let x = 0; x <= s; x += 8) {
      const y = k - x + Math.sin((x / s) * Math.PI * 2) * 3;
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(2.4, 2.4);
  t.anisotropy = 8;
  _webMap = { key, tex: t };
  return t;
}

function emblemTexture(color = '#0a0d16') {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, s, s);
  c.fillStyle = color;
  const cx = s / 2, cy = s / 2;
  // body
  c.beginPath();
  c.ellipse(cx, cy - 6, 13, 26, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx, cy + 30, 9, 15, 0, 0, Math.PI * 2); c.fill();
  // legs
  c.strokeStyle = color; c.lineCap = 'round';
  const legs = [
    [-1, -0.5, 78, -46], [1, -0.5, 78, -46],
    [-1, 0.1, 96, -6], [1, 0.1, 96, -6],
    [-1, 0.55, 88, 34], [1, 0.55, 88, 34],
    [-1, 0.95, 62, 66], [1, 0.95, 62, 66],
  ];
  for (const [sgn, t, len, dy] of legs) {
    c.lineWidth = 7 - Math.abs(t) * 2;
    c.beginPath();
    c.moveTo(cx + sgn * 8, cy - 10 + t * 20);
    c.quadraticCurveTo(cx + sgn * (len * 0.55), cy - 34 + t * 24, cx + sgn * len, cy + dy);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------- materials */

export function makeSuitMaterials(opts = {}) {
  const tex = makeSuitTextures();
  const red = opts.red || '#b6202f';
  const blue = opts.blue || 0x0f1730;

  const redMat = new THREE.MeshStandardMaterial({
    map: webLatticeTexture(red),
    normalMap: tex.normalMap, roughnessMap: tex.roughnessMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.62, metalness: 0.06, envMapIntensity: 0.9,
  });
  redMat.map.repeat.set(2.6, 2.6);

  const blueMat = new THREE.MeshStandardMaterial({
    color: blue, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.52, metalness: 0.12, envMapIntensity: 1.0,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: opts.accent || 0xcfd6e0, roughness: 0.24, metalness: 0.95, envMapIntensity: 1.4,
  });

  const lens = new THREE.MeshStandardMaterial({
    color: 0xeef4ff, emissive: 0x6d94d8, emissiveIntensity: 0.35,
    roughness: 0.06, metalness: 0.85, envMapIntensity: 1.8,
  });

  const rim = new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.35, metalness: 0.4 });

  const emblem = new THREE.MeshStandardMaterial({
    map: emblemTexture(opts.emblemColor || '#080b14'),
    transparent: true, roughness: 0.5, metalness: 0.25, depthWrite: false,
  });

  return { red: redMat, blue: blueMat, accent, lens, rim, emblem };
}

/** Flat-colour materials for enemies — same rig, different dress. */
export function makeGoonMaterials(palette) {
  const tex = makeSuitTextures();
  const body = new THREE.MeshStandardMaterial({
    color: palette.body, roughness: 0.75, metalness: 0.08,
    normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.8,
  });
  const trim = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.45, metalness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin || 0x8d6a52, roughness: 0.8 });
  return { red: body, blue: trim, accent: trim, lens: skin, rim: trim, emblem: null };
}

/* -------------------------------------------------------------- geometry */

/** Tapered limb: cylinder with rounded ends, origin at the top (the joint). */
function limbGeo(rTop, rBot, len, seg = 10) {
  const cyl = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, true);
  cyl.translate(0, -len / 2, 0);
  const capTop = new THREE.SphereGeometry(rTop, seg, 6);
  const capBot = new THREE.SphereGeometry(rBot, seg, 6); capBot.translate(0, -len, 0);
  return mergeGeos([cyl, capTop, capBot]);
}

function boxRound(w, h, d, r = 0.03) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  return g;
}

/* ------------------------------------------------------------------ rig */

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'armL', 'foreL', 'handL',
  'shoulderR', 'armR', 'foreR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];

/**
 * @param {object} mats  from makeSuitMaterials / makeGoonMaterials
 * @param {object} P     proportion overrides (bulk, height, headScale)
 */
export function buildCharacter(mats, P = {}) {
  const scale = P.height || 1.0;
  const bulk = P.bulk || 1.0;
  const root = new THREE.Group();
  root.name = 'character';
  const j = {};
  const mk = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.name = name;
    parent.add(g);
    j[name] = g;
    g.userData.rest = g.rotation.clone();
    return g;
  };
  const add = (joint, geo, mat, px = 0, py = 0, pz = 0, rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true;
    joint.add(m);
    return m;
  };

  /* ---- skeleton ---- */
  const hips = mk('hips', root, 0, 0.96, 0);
  const spine = mk('spine', hips, 0, 0.13, 0);
  const chest = mk('chest', spine, 0, 0.20, 0);
  const neck = mk('neck', chest, 0, 0.20, 0.01);
  const head = mk('head', neck, 0, 0.10, 0);

  const shoulderL = mk('shoulderL', chest, 0.085, 0.15, 0);
  const armL = mk('armL', shoulderL, 0.095, 0, 0);
  const foreL = mk('foreL', armL, 0, -0.29, 0);
  const handL = mk('handL', foreL, 0, -0.27, 0);

  const shoulderR = mk('shoulderR', chest, -0.085, 0.15, 0);
  const armR = mk('armR', shoulderR, -0.095, 0, 0);
  const foreR = mk('foreR', armR, 0, -0.29, 0);
  const handR = mk('handR', foreR, 0, -0.27, 0);

  const thighL = mk('thighL', hips, 0.088, -0.04, 0);
  const shinL = mk('shinL', thighL, 0, -0.45, 0);
  const footL = mk('footL', shinL, 0, -0.43, 0);

  const thighR = mk('thighR', hips, -0.088, -0.04, 0);
  const shinR = mk('shinR', thighR, 0, -0.45, 0);
  const footR = mk('footR', shinR, 0, -0.43, 0);

  /* ---- flesh ---- */
  // torso: chest tapering to waist, with a subtle deltoid shelf
  const chestGeo = (() => {
    // Broad clavicles taper into a narrow waist. The previous radii were
    // reversed, which made the chest bottom-heavy and visually detached.
    const t = new THREE.CylinderGeometry(0.188 * bulk, 0.140 * bulk, 0.32, 16, 1);
    t.scale(1.14, 1, 0.76); t.translate(0, 0.055, 0);
    const shoulderPad = new THREE.SphereGeometry(0.078 * bulk, 12, 8);
    shoulderPad.scale(1.24, 0.82, 0.92);
    const l = shoulderPad.clone(); l.translate(0.172 * bulk, 0.15, 0);
    const r = shoulderPad.clone(); r.translate(-0.172 * bulk, 0.15, 0);
    shoulderPad.dispose();
    return mergeGeos([t, l, r]);
  })();
  add(chest, chestGeo, mats.red);

  const abGeo = (() => {
    const t = new THREE.CylinderGeometry(0.143 * bulk, 0.130 * bulk, 0.25, 14, 1);
    t.scale(1.08, 1, 0.78);
    return t;
  })();
  add(spine, abGeo, mats.blue, 0, 0.02, 0);

  const hipGeo = (() => {
    const t = new THREE.SphereGeometry(0.145 * bulk, 14, 10);
    t.scale(1.08, 0.70, 0.82);
    return t;
  })();
  add(hips, hipGeo, mats.blue, 0, -0.03, 0);

  // head: skull + jaw + mask seam
  const headGeo = (() => {
    const sk = new THREE.SphereGeometry(0.126, 18, 14);
    sk.scale(0.95, 1.07, 1.0);
    const jaw = new THREE.SphereGeometry(0.099, 14, 10);
    jaw.scale(0.92, 0.8, 1.0); jaw.translate(0, -0.075, 0.014);
    return mergeGeos([sk, jaw]);
  })();
  add(head, headGeo, mats.red, 0, 0.055, 0);
  add(neck, new THREE.CylinderGeometry(0.052, 0.062, 0.1, 10), mats.red, 0, 0.03, 0);

  // eye lenses — big, angular, slightly convex. The face of the character.
  const lensGeo = (() => {
    const g = new THREE.SphereGeometry(0.056, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.scale(1.35, 0.92, 0.62);
    g.rotateX(Math.PI * 0.5);
    return g;
  })();
  const lensL = new THREE.Mesh(lensGeo, mats.lens);
  lensL.position.set(0.055, 0.062, 0.088); lensL.rotation.set(0.12, 0.28, -0.16);
  lensL.castShadow = false;
  head.add(lensL);
  const lensR = new THREE.Mesh(lensGeo, mats.lens);
  lensR.position.set(-0.055, 0.062, 0.088); lensR.rotation.set(0.12, -0.28, 0.16);
  lensR.castShadow = false;
  head.add(lensR);
  // dark rim behind each lens so they read even in flat light
  const rimGeo = lensGeo.clone(); rimGeo.scale(1.16, 1.18, 0.9);
  const rimL = new THREE.Mesh(rimGeo, mats.rim); rimL.position.copy(lensL.position); rimL.rotation.copy(lensL.rotation);
  rimL.position.z -= 0.006; head.add(rimL);
  const rimR = new THREE.Mesh(rimGeo, mats.rim); rimR.position.copy(lensR.position); rimR.rotation.copy(lensR.rotation);
  rimR.position.z -= 0.006; head.add(rimR);

  // arms
  const upperArm = limbGeo(0.071 * bulk, 0.055 * bulk, 0.29, 12);
  const foreArm = limbGeo(0.059 * bulk, 0.045 * bulk, 0.27, 12);
  add(armL, upperArm, mats.red); add(armR, upperArm.clone(), mats.red);
  add(foreL, foreArm, mats.red); add(foreR, foreArm.clone(), mats.red);

  // hands — palm block + thumb, plus the web-shooter cuff
  const handGeo = (() => {
    const palm = boxRound(0.052, 0.10, 0.085); palm.translate(0, -0.05, 0);
    const thumb = new THREE.CylinderGeometry(0.017, 0.014, 0.055, 6);
    thumb.rotateZ(0.7); thumb.translate(0.032, -0.035, 0.022);
    const fingers = new THREE.BoxGeometry(0.048, 0.055, 0.075); fingers.translate(0, -0.115, 0.004);
    return mergeGeos([palm, thumb, fingers]);
  })();
  add(handL, handGeo, mats.red); add(handR, handGeo.clone(), mats.red);
  const cuffGeo = new THREE.CylinderGeometry(0.054, 0.052, 0.05, 10);
  const cuffL = add(handL, cuffGeo, mats.accent, 0, 0.005, 0);
  const cuffR = add(handR, cuffGeo.clone(), mats.accent, 0, 0.005, 0);

  // legs
  const thighGeo = limbGeo(0.096 * bulk, 0.071 * bulk, 0.45, 12);
  const shinGeo = limbGeo(0.072 * bulk, 0.052 * bulk, 0.43, 12);
  add(thighL, thighGeo, mats.blue); add(thighR, thighGeo.clone(), mats.blue);
  add(shinL, shinGeo, mats.blue); add(shinR, shinGeo.clone(), mats.blue);

  const footGeo = (() => {
    const b = boxRound(0.085, 0.062, 0.20); b.translate(0, -0.03, 0.045);
    const toe = new THREE.SphereGeometry(0.045, 10, 8); toe.scale(0.9, 0.6, 1.1); toe.translate(0, -0.035, 0.135);
    const shaft = new THREE.CylinderGeometry(0.058, 0.05, 0.10, 10); shaft.translate(0, 0.03, 0);
    return mergeGeos([b, toe, shaft]);
  })();
  add(footL, footGeo, mats.red); add(footR, footGeo.clone(), mats.red);

  // chest emblem decal
  let emblemMesh = null;
  if (mats.emblem) {
    const g = new THREE.PlaneGeometry(0.30, 0.30);
    emblemMesh = new THREE.Mesh(g, mats.emblem);
    emblemMesh.position.set(0, 0.055, 0.152);
    emblemMesh.renderOrder = 2;
    chest.add(emblemMesh);
    // A second, smaller emblem on the back, as tradition demands.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.30), mats.emblem);
    back.position.set(0, 0.05, -0.15); back.rotation.y = Math.PI;
    chest.add(back);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    root, joints: j, lensL, lensR, cuffL, cuffR, emblem: emblemMesh, materials: mats,
    height: 1.86 * scale,
    /** Squint / widen the lenses — cheap but startlingly expressive. */
    setExpression(amount, focus = 0) {
      const sy = lerp(1, 0.42, clamp(amount, 0, 1));
      const sx = lerp(1, 1.14, clamp(amount, 0, 1));
      lensL.scale.set(sx, sy, 1); lensR.scale.set(sx, sy, 1);
      rimL.scale.set(sx, sy, 1); rimR.scale.set(sx, sy, 1);
      mats.lens.emissiveIntensity = 0.3 + focus * 1.4;
    },
  };
}

/** Reset every joint to its rest rotation. */
export function resetPose(rig) {
  for (const name of JOINTS) {
    const jt = rig.joints[name];
    if (jt) jt.rotation.set(0, 0, 0);
  }
}
