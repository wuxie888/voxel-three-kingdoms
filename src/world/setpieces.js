// Stage set pieces (render-only), chosen by STAGE.set:
//   'river'  赤壁 — a broad river between the arena and the far bank's fortress: rippling dark water with firelight
//                   glinting on it, a muddy bank, a line of chained warships (連環船), several ablaze, and the jetties
//                   where the fire ships wait (STAGE.props fireboats).
//   'pass'   虎牢關 — towering rock walls on both flanks that close in on the gate: a pass funnelling to Hulao.
//   'stream' 長坂坡 — a shallow stream behind the field with 長坂橋 across it (where the stage script's ally waits), and
//                   the dry well where Liu Shan hides (STAGE.props well).
// blocked(x, z) tells the dressing where not to stand troops and banners.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { boxesGeometry, shade } from '../core/voxel.js';
import { noise2 } from './terrain.js';
import { STAGE } from '../stages/index.js';

export const SET = STAGE.set || null;
export const RIVER = { z0: 49, z1: 95 };   // the near bank just past the arena rim (46 m), in the default view
export const STREAM = { z0: -54, z1: -48, x: 0, deckY: 0.42 };   // 長坂坡: behind the start, past the rim; bridge at x
const WELL = STAGE.props?.find((p) => p.kind === 'well')?.at;
const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/** Rock wall edge |x| on side s (+1 / −1) at depth z: wide open over the arena, closing on the gate past z 40. */
function edge(s, z) {
  const far = s > 0 ? 12 : 34, u = Math.min(1, Math.max(0, (z - 40) / 60));
  return 50 + (far - 50) * u * u * (3 - 2 * u);
}
export function blocked(x, z) {
  if (SET === 'river') return z > RIVER.z0 - 3 && z < RIVER.z1 + 1;
  if (SET === 'pass') return Math.abs(x) > edge(Math.sign(x) || 1, z) - 3;
  if (SET === 'stream') {
    if (WELL && Math.hypot(x - WELL[0], z - WELL[1]) < 5) return true;
    return (z > STREAM.z0 - 3 && z < STREAM.z1 + 3) || (Math.abs(x - STREAM.x) < 10 && z < -42);   // the stream, the road over the bridge
  }
  return false;
}

// ---------------------------------------------------------------- 赤壁: river and fleet
function waterMesh(z0 = RIVER.z0, z1 = RIVER.z1, color = 0x14243a) {
  const W = 700, D = z1 - z0;
  const geo = new THREE.PlaneGeometry(W, D, 280, 32).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.3 });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
        float wa = sin(wp0.x * 0.35 + uTime * 1.1) * 0.5 + sin(wp0.z * 0.6 - uTime * 0.8 + wp0.x * 0.12) * 0.5;
        float dx = cos(wp0.x * 0.35 + uTime * 1.1) * 0.175 + cos(wp0.z * 0.6 - uTime * 0.8 + wp0.x * 0.12) * 0.03;
        float dz = cos(wp0.z * 0.6 - uTime * 0.8 + wp0.x * 0.12) * 0.15;
        vec3 objectNormal = normalize(vec3(-dx * 0.25, 1.0, -dz * 0.25));`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, position.y + wa * 0.12, position.z);\nvWPos = wp0;');
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // firelight glinting on the ripples: sparse bright ridges, warm
      float gl = pow(max(0.0, sin(vWPos.x * 1.3 + uTime * 1.7) * sin(vWPos.z * 2.1 - uTime * 1.2 + sin(vWPos.x * 0.2))), 8.0);
      totalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * gl * 0.9 + vec3(0.03, 0.07, 0.13);`);
  };
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 0.16, (z0 + z1) / 2);
  m.receiveShadow = true;
  return { mesh: m, uTime };
}

/** A war junk broadside to the arena: stepped hull, raised bow and stern castles, a two-storey deck house, mast, yard
 *  and a battened sail (charred when burning). Returns fire spots on its deck. */
function ship(b, r, x, z, yaw, s, burning) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const at = (lx, ly, lz) => [x + lx * c + lz * sn, ly, z - lx * sn + lz * c];
  const put = (w, h, d, lx, ly, lz, col) => b.push({ s: [w * s, h * s, d * s], p: at(lx * s, ly * s, lz * s), r: [0, yaw, 0], c: col });
  const wood = burning ? 0x5a3a24 : 0x6e4a2e, woodD = burning ? 0x3a2416 : 0x4a3220, red = burning ? 0x7a2a1a : 0x9a3020;
  put(18, 1.2, 4.2, 0, 0.4, 0, woodD);                               // keel band at the waterline
  put(20, 1.4, 5.2, 0, 1.5, 0, wood);                                // hull
  put(21, 0.4, 5.6, 0, 2.3, 0, red);                                 // gunwale
  put(4, 2.2, 5.2, 8.6, 3.2, 0, wood); put(3, 1.6, 5.4, -9.2, 3, 0, wood);   // stern and bow castles
  put(7, 2.4, 4.2, 1.5, 3.6, 0, wood); put(8, 0.4, 5.2, 1.5, 4.9, 0, 0x2a2426);   // deck house + roof
  put(5, 1.8, 3.4, 1.5, 6, 0, wood); put(6, 0.4, 4.2, 1.5, 7.1, 0, 0x2a2426);
  put(0.5, 15, 0.5, -3, 9.5, 0, woodD);                              // mast
  put(0.3, 0.3, 7.5, -3, 15.5, 0, woodD);                            // yard
  const sail = burning ? [0x2a1a14, 0x3a2418] : [0xc4b08a, 0xa8966e];
  for (let k = 0; k < 6; k++) {                                       // battened sail panels (burnt ones have holes)
    if (burning && r.chance(0.35)) continue;
    put(0.15, 1.35, 6.5 - k * 0.25, -3.1, 14.6 - k * 1.45, 0, sail[k & 1]);
  }
  for (let k = -4; k <= 4; k++) put(0.15, 0.9, 0.15, k * 2, 2.9, 2.5, woodD);   // rail posts
  const fires = [];
  if (burning) for (const lx of [-6, 1.5, 7]) if (r.chance(0.8)) fires.push([...at(lx * s, 2.6 * s, r.range(-1, 1) * s)].map((v, i) => (i === 1 ? 2.6 * s : v)).concat(r.range(1.2, 1.7), false));   // no smoke column: it would hide the fleet
  return fires;
}

function buildRiver(scene) {
  const r = makeRng(303), b = [], fires = [];
  // muddy bank along the arena side: dark stones and reeds
  for (let x = -300; x < 300; x += 1.6) {
    const w = r.range(1, 2.4);
    b.push({ s: [w, r.range(0.25, 0.6), r.range(1.2, 2.6)], p: [x, 0.12, RIVER.z0 + r.range(-0.8, 0.6)], r: [0, r.range(-0.3, 0.3), 0], c: shade(0x3a3028, r.range(0.7, 1.1)) });
    if (r.chance(0.5)) b.push({ s: [0.08, r.range(0.8, 1.6), 0.08], p: [x + r.range(-0.6, 0.6), 0.6, RIVER.z0 - r.range(0, 1.5)], r: [r.range(-0.2, 0.2), 0, r.range(-0.2, 0.2)], c: 0x4a4a2a });
  }
  // the chained fleet: two staggered lines, iron chains between neighbours; most of the near line burns
  const hulls = [];
  for (let i = 0; i < 9; i++) {
    const x = -130 + i * 30 + r.range(-3, 3), z = i & 1 ? 80 : 62, yaw = r.range(-0.08, 0.08), s = r.range(0.95, 1.1);   // broadside (hull along x)
    fires.push(...ship(b, r, x, z, yaw, s, r.chance(z < 75 ? 0.75 : 0.5)));
    hulls.push([x, z]);
  }
  for (let i = 0; i + 1 < hulls.length; i++) {                         // 連環: chains ship to ship
    const [x0, z0] = hulls[i], [x1, z1] = hulls[i + 1], n = 14;
    for (let k = 1; k < n; k++) {
      const u = k / n, sag = Math.sin(u * Math.PI) * 0.9;
      b.push({ s: [0.5, 0.25, 0.25], p: [x0 + (x1 - x0) * u, 2.2 - sag, z0 + (z1 - z0) * u], r: [0, Math.atan2(z1 - z0, x1 - x0) + (k & 1) * 1.57, 0], c: 0x2a2a2e });
    }
  }
  // jetties for the fire ships (STAGE.props fireboats): planks from the bank out to where each boat is moored
  for (const [x] of STAGE.props?.find((p) => p.kind === 'fireboats')?.at || []) {
    for (let z = RIVER.z0 - 4; z < RIVER.z0 + 3.5; z += 0.55) b.push({ s: [2.4, 0.14, 0.48], p: [x, 0.36, z], r: [0, r.range(-0.03, 0.03), 0], c: shade(0x6a4a30, r.range(0.75, 1.05)) });
    for (const sx of [-1.1, 1.1]) for (let z = RIVER.z0 - 3; z < RIVER.z0 + 4; z += 2.2) b.push({ s: [0.24, 1.4, 0.24], p: [x + sx, 0.4, z], c: 0x3e2a1c });
  }
  const m = new THREE.Mesh(boxesGeometry(b), lit());
  m.castShadow = true; m.receiveShadow = true;
  const water = waterMesh();
  scene.add(m, water.mesh);
  // the burning ships light the water and the bank (a few point lights, flickering)
  const lights = fires.filter((_, i) => i % 2 === 0).slice(0, 6).map(([x, y, z]) => {
    const l = new THREE.PointLight(0xff7a2a, 260, 46, 1.6); l.position.set(x, y + 4, z); scene.add(l); return l;
  });
  return { fires, update(t) { water.uTime.value = t; lights.forEach((l, i) => { l.intensity = 230 + Math.sin(t * (9 + i * 1.7) + i) * 40 + Math.sin(t * 5.3 + i) * 30; }); } };
}

// ---------------------------------------------------------------- 虎牢關: rock walls of the pass
function buildPass(scene) {
  const b = [], S = 4;
  const strata = [0x4e3e30, 0x5e4a38, 0x423428, 0x68523e, 0x4a3a2c];   // dark enough to hold their layers in the bright noon look
  for (const s of [1, -1]) {
    for (let z = -180; z < 106; z += S) {
      const e = edge(s, z);
      for (let k = 0; k < 11; k++) {
        const x = s * (e + k * S + S / 2), n = noise2(x * 0.05, z * 0.05, 11), n2 = noise2(x * 0.2, z * 0.2, 12);
        const h = Math.min(58, 7 + k * 4.4 + n * 14 + n2 * 4) * (z > 96 ? 0.85 : 1);
        // rock in horizontal strata (stacked slabs, each a little in or out), a mossy cap on top
        let y = 0, i = 0;
        while (y < h - 0.5) {
          const th = Math.min(h - y, 3 + ((i * 7 + k * 3 + Math.round(z)) % 3)), inset = ((i + k) % 3) * 0.25;
          b.push({ s: [S - inset, th, S - inset * 0.5], p: [x, y + th / 2, z + S / 2], c: shade(strata[(i + Math.round(n * 5)) % strata.length], 0.85 + n2 * 0.3) });
          y += th; i++;
        }
        b.push({ s: [S + 0.2, 0.6, S + 0.2], p: [x, h + 0.3, z + S / 2], c: shade(0x4a5a2c, 0.85 + n2 * 0.3) });
        if (k === 0 && n2 > 0.55) b.push({ s: [1.4, 1, 1.6], p: [x - s * 1.8, 0.5, z + S / 2 + 0.6], c: shade(0x7a6c5c, 0.9) });   // fallen rocks at the foot
      }
    }
  }
  const m = new THREE.Mesh(boxesGeometry(b), lit());
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return { fires: [], update() {} };
}

// ---------------------------------------------------------------- 長坂坡: the stream, 長坂橋 and the dry well
function buildStream(scene) {
  const r = makeRng(404), b = [], X = STREAM.x, Y = STREAM.deckY;
  // banks: mud, stones and reeds along both sides
  for (const [zb, dir] of [[STREAM.z1, 1], [STREAM.z0, -1]]) for (let x = -170; x < 170; x += 1.4) {
    if (Math.abs(x - X) < 2.9) continue;
    b.push({ s: [r.range(1, 2.2), r.range(0.2, 0.45), r.range(0.8, 1.7)], p: [x, 0.1, zb + dir * r.range(-0.2, 0.5)], r: [0, r.range(-0.3, 0.3), 0], c: shade(0x4a3a2c, r.range(0.7, 1.05)) });
    if (r.chance(0.5)) b.push({ s: [0.08, r.range(0.7, 1.5), 0.08], p: [x + r.range(-0.5, 0.5), 0.55, zb - dir * r.range(0.1, 1.3)], r: [r.range(-0.2, 0.2), 0, r.range(-0.2, 0.2)], c: shade(0x6a6a34, r.range(0.8, 1.1)) });
  }
  // the bridge: plank deck on log trestles, stepped ramps down to both banks, posts and a double rail
  const W = 4.4, zN = STREAM.z1 + 1.2, zS = STREAM.z0 - 1.2;
  for (let z = zS; z < zN; z += 0.5) b.push({ s: [W, 0.14, 0.47], p: [X, Y, z + 0.25], r: [0, r.range(-0.02, 0.02), 0], c: shade(0x7a5434, r.range(0.75, 1.1)) });
  for (const [z0, d] of [[zN, 1], [zS, -1]]) for (let k = 0; k < 3; k++) {
    b.push({ s: [W, 0.14, 0.75], p: [X, Y * (2 - k) / 3, z0 + d * (0.4 + k * 0.75)], c: shade(0x6e4a2e, r.range(0.75, 1.05)) });
  }
  for (let z = zS + 0.6; z < zN; z += 2.1) {
    for (const sx of [-1, 1]) {
      b.push({ s: [0.34, Y + 0.9, 0.34], p: [X + sx * 1.6, (Y - 0.9) / 2, z], c: 0x3e2a1c });                 // trestle legs in the water
      b.push({ s: [0.26, 1.1, 0.26], p: [X + sx * (W / 2 - 0.12), Y + 0.55, z], c: 0x4a3220 });            // rail posts
    }
    b.push({ s: [3.6, 0.2, 0.2], p: [X, -0.1, z], r: [0, 0, 0.35], c: 0x3a2618 });                         // cross brace
  }
  for (const sx of [-1, 1]) for (const y of [Y + 0.55, Y + 1.0]) b.push({ s: [0.14, 0.14, zN - zS + 1.6], p: [X + sx * (W / 2 - 0.12), y, (zN + zS) / 2], c: shade(0x5a3d26, y > 1 ? 1 : 0.85) });
  // the dry well in the burnt-out village: stone ring, windlass frame, a fallen bucket, broken cart and planks
  if (WELL) {
    const [wx, wz] = WELL;
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2;
      b.push({ s: [0.48, 0.82, 0.34], p: [wx + Math.sin(a) * 0.95, 0.41, wz + Math.cos(a) * 0.95], r: [0, a, 0], c: shade(0x8a8078, r.range(0.75, 1.05)) });
    }
    b.push({ s: [1.5, 0.05, 1.5], p: [wx, 0.62, wz], c: 0x120c0a });                                      // dark shaft
    for (const sx of [-1, 1]) b.push({ s: [0.18, 2.1, 0.18], p: [wx + sx * 1.15, 1.05, wz], c: 0x4a3220 });
    b.push({ s: [2.6, 0.16, 0.16], p: [wx, 2.05, wz], c: 0x3e2a1c }, { s: [1.2, 0.26, 0.26], p: [wx, 1.75, wz], c: 0x5a4030 });
    b.push({ s: [0.04, 0.9, 0.04], p: [wx + 0.1, 1.25, wz], c: 0x8a7a5a }, { s: [0.34, 0.3, 0.34], p: [wx + 1.6, 0.15, wz + 0.8], r: [1.2, 0.4, 0], c: 0x5a4030 });
    for (let k = 0; k < 5; k++) b.push({ s: [r.range(1.2, 2.4), 0.12, 0.3], p: [wx - 2 + r.range(-1.5, 1.5), 0.08, wz + 2 + r.range(-1, 1)], r: [0, r.range(0, 3), 0], c: shade(0x3a2618, r.range(0.6, 1)) });
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.push({ s: [0.12, 0.12, 0.6], p: [wx + 3 + Math.cos(a) * 0.35, 0.7 + Math.sin(a) * 0.35, wz - 2.2], r: [0, 0, a], c: 0x4a3220 }); }   // cart wheel
    b.push({ s: [1.8, 0.5, 1.1], p: [wx + 3.8, 0.35, wz - 2.6], r: [0, 0.4, 0.25], c: 0x4e3826 });
  }
  const m = new THREE.Mesh(boxesGeometry(b), lit());
  m.castShadow = true; m.receiveShadow = true;
  const water = waterMesh(STREAM.z0, STREAM.z1, 0x2a3c4a);
  water.mesh.position.y = 0.08;
  scene.add(m, water.mesh);
  return { fires: [], update(t) { water.uTime.value = t; } };
}

export function buildSetpiece(scene) {
  if (SET === 'river') return buildRiver(scene);
  if (SET === 'pass') return buildPass(scene);
  if (SET === 'stream') return buildStream(scene);
  return { fires: [], update() {} };
}
