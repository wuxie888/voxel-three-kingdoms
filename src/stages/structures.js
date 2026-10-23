// Breakable structures of a destroy goal (render-only): the altars of the Way of Great Peace (黃巾之亂) with their
// sorcerous brazier fires, and the cross-dams on the Han (樊城). Each shudders when struck and collapses to rubble when
// its target falls (campaign target:hit / target:break). And the flood (水淹七軍): a foaming wall of water that rides
// cp.flood's front across the field and leaves the plain under shallow water.
import * as THREE from 'three';
import { on } from '../core/events.js';
import { STAGE } from './index.js';
import { boxesGeometry, shade } from '../core/voxel.js';
import { makeRng } from '../core/rng.js';
import { FLOOD } from './campaign.js';
import { LEVEE } from '../world/setpieces.js';

const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true });
const prop = (kind) => STAGE.props?.find((p) => p.kind === kind);

function altar(r) {
  const b = [];
  b.push({ s: [4.8, 0.7, 4.8], p: [0, 0.35, 0], c: 0x8a8070 }, { s: [3.8, 0.5, 3.8], p: [0, 0.95, 0], c: 0x9a9080 }, { s: [2.6, 0.3, 2.6], p: [0, 1.35, 0], c: 0xb0a690 });
  for (const s of [-1, 1]) b.push({ s: [1.2, 0.35, 0.8], p: [0, 0.18, s * 2.75], c: 0x7a7060 });   // steps
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
    b.push({ s: [0.26, 3.6, 0.26], p: [x, 2.5, z], c: 0x6a2418 }, { s: [0.36, 0.2, 0.36], p: [x, 4.35, z], c: 0xd0a030 });
    b.push({ s: [0.05, 1.7, 0.72], p: [x + Math.sign(x) * 0.18, 3.3, z], c: 0xe8c040 }, { s: [0.05, 0.3, 0.72], p: [x + Math.sign(x) * 0.18, 2.3, z], c: 0xb88a18 });
  }
  b.push({ s: [1.0, 0.6, 1.0], p: [0, 1.85, 0], c: 0x6a5228 }, { s: [1.15, 0.12, 1.15], p: [0, 2.18, 0], c: 0x8a6a30 });   // the bronze cauldron
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [0, 0.45]]) b.push({ s: [0.12, 0.45, 0.12], p: [x, 1.45, z], c: 0x4a3a20 });
  for (let k = 0; k < 10; k++) {                                             // talismans pinned round the platform
    const a = k / 10 * Math.PI * 2;
    b.push({ s: [0.22, 0.5, 0.03], p: [Math.sin(a) * 2.42, 0.62, Math.cos(a) * 2.42], r: [0, a, 0], c: shade(0xf0d060, r.range(0.85, 1.05)) });
  }
  return boxesGeometry(b);
}
function rubble(r, w, h, n, cols) {
  const b = [];
  for (let k = 0; k < n; k++) {
    const s = r.range(0.4, 1.1);
    b.push({ s: [s, s * r.range(0.4, 0.9), s * r.range(0.6, 1.2)], p: [r.range(-w, w), s * 0.3 + r.range(0, h), r.range(-w, w)], r: [r.range(-0.5, 0.5), r.range(0, 3), r.range(-0.5, 0.5)], c: shade(cols[k % cols.length], r.range(0.75, 1.05)) });
  }
  return boxesGeometry(b);
}
/** A cross-dam: an earthen bank faced with timber cribbing, stone-capped piers and a sluice gate, from the levee into
 *  the field (its face, the side the hero breaks, at local z = 0, the levee at z = +len). */
function dam(r, len) {
  const b = [], W = 6.4, H = 2.5;
  b.push({ s: [W, H, len], p: [0, H / 2, len / 2], c: 0x9a8262 }, { s: [W + 0.2, 0.3, len], p: [0, H + 0.12, len / 2], c: 0x6e8040 });
  for (let x = -W / 2 + 0.3; x < W / 2; x += 0.62) b.push({ s: [0.5, H + 0.2, 0.16], p: [x, (H + 0.2) / 2, -0.08], c: shade(0x8a6440, r.range(0.8, 1.15)) });   // timber face
  for (const y of [0.5, 1.4, 2.2]) b.push({ s: [W + 0.4, 0.2, 0.22], p: [0, y, -0.2], c: 0x5a3e26 });
  for (const sx of [-1, 1]) b.push({ s: [1.0, H + 0.8, 1.0], p: [sx * (W / 2 + 0.3), (H + 0.8) / 2, 0.4], c: 0xb8b2a4 }, { s: [1.2, 0.3, 1.2], p: [sx * (W / 2 + 0.3), H + 0.95, 0.4], c: 0xc8c2b4 });
  b.push({ s: [1.6, 1.8, 0.3], p: [0, 0.9, -0.3], c: 0x6a4a2c }, { s: [1.9, 0.25, 0.4], p: [0, 2.0, -0.3], c: 0x4a3220 });   // sluice gate
  for (const sx of [-0.45, 0.45]) b.push({ s: [0.4, 1.0, 0.1], p: [sx, 0.7, -0.5], c: 0x7aa0b8 });   // water seeping through the gate
  for (let k = 0; k < 6; k++) b.push({ s: [0.14, 1.0, 0.14], p: [r.range(-W / 2, W / 2), H + 0.5, r.range(1, len - 1)], r: [r.range(-0.2, 0.2), 0, r.range(-0.2, 0.2)], c: 0x3e2a1c });
  return boxesGeometry(b);
}

/** Flood water: a sheet over the plain shown on the river side of the front (foam along it); a wall of water rides it. */
function floodMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFront: { value: 999 } },
    vertexShader: `varying vec3 vW; uniform float uTime;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); w.y += sin(w.x * 0.4 + uTime * 2.0) * 0.05 + sin(w.z * 0.7 - uTime * 2.6) * 0.04;
        vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime, uFront;
      void main() {
        float d = vW.z - uFront; if (d < 0.0) discard;
        float foam = exp(-d * 0.35) + 0.25 * pow(max(0.0, sin(vW.x * 1.3 + uTime * 3.0) * sin(vW.z * 1.7 - uTime * 2.2)), 6.0);
        vec3 c = mix(vec3(0.035, 0.055, 0.07), vec3(0.42, 0.47, 0.5), clamp(foam, 0.0, 1.0));   // dark river water, grey foam
        gl_FragColor = vec4(c, 0.78);
      }`,
    transparent: true, depthWrite: false,
  });
}

export function createStructures(scene, game, vfx) {
  const cp = game.campaign, fx = vfx.fx, r = makeRng(733);
  const parts = [];                                            // { whole, ruin, x, z, shake }
  const add = (geo, ruinGeo, x, z, yaw = 0) => {
    const mat = lit(), whole = new THREE.Mesh(geo, mat), ruin = new THREE.Mesh(ruinGeo, mat);
    for (const m of [whole, ruin]) { m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; scene.add(m); }
    ruin.visible = false;
    parts.push({ whole, ruin, x, z, shake: 0 });
  };
  for (const [x, z] of prop('altars')?.at || []) add(altar(r), rubble(r, 2.6, 0.5, 26, [0x8a8070, 0x9a9080, 0x6a2418, 0xe8c040]), x, z, Math.atan2(-x, -z));
  for (const [x, z] of prop('dams')?.at || []) add(dam(r, LEVEE.z0 - z + 1), rubble(r, 3.2, 0.8, 30, [0x6e5a42, 0x5a3e26, 0x8a8478]), x, z);
  // the altar fires: sorcerous yellow-green flames above each cauldron, out when it falls
  const fires = (prop('altars')?.at || []).map(([x, z]) => ({ x, z, on: true }));
  const fireMesh = fires.length ? new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }), fires.length * 24) : null;
  if (fireMesh) { fireMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(fires.length * 24 * 3), 3); fireMesh.frustumCulled = false; scene.add(fireMesh); }

  // flood
  const flood = STAGE.script?.some((g) => g.flood);
  const FW = 2 * (FLOOD.z0 - FLOOD.z1) + 120, FD = FLOOD.z0 - FLOOD.z1 + 20;   // the sheet covers the whole field
  const water = flood ? new THREE.Mesh(new THREE.PlaneGeometry(FW, FD, Math.round(FW / 2), Math.round(FD / 2)).rotateX(-Math.PI / 2), floodMaterial()) : null;
  const wall = flood ? new THREE.Mesh(new THREE.BoxGeometry(FW, 2.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x6e7c84, emissive: 0x2a343a, emissiveIntensity: 0.4, transparent: true, opacity: 0.85, roughness: 0.3 })) : null;
  if (water) { water.position.set(0, 0.14, (FLOOD.z0 + FLOOD.z1) / 2); water.visible = false; water.renderOrder = 2; wall.visible = false; scene.add(water, wall); }

  on('target:hit', (e) => {
    const p = parts[e.j];
    if (!p) return;
    p.shake = 1;
    fx.dustPuff(p.x, p.z, 3, 2.2, 0.5, 0.4, 0.45);
  });
  on('target:break', (e) => {
    const p = parts[e.j];
    if (!p) return;
    p.whole.visible = false; p.ruin.visible = true;
    if (fires[e.j]) fires[e.j].on = false;
    fx.rocks(p.x, p.z, 26, 2.6, 0.2, 0.5, [5, 10], 5); fx.dustColumn(p.x, p.z, 18, 1.0, 3.4, 5, [1.0, 1.4], 0.66); fx.flash(0.12);
    if (prop('dams')) { fx.columns(p.x, p.z + 1.2, 5, 1.6, 7, 1.2, 0.9, [0.9, 1.4, 1.8], 0.15); fx.embers(p.x, 1.5, p.z, 40, 2.4, [1.2, 1.6, 2.0]); }
    else { fx.star(p.x, 2.4, p.z, 3.0, 0.4, [2.4, 2.2, 0.6]); fx.embers(p.x, 2.2, p.z, 40, 2.0, [2.2, 2.0, 0.5]); }
  });
  on('scenario', () => {
    for (const p of parts) { p.whole.visible = true; p.ruin.visible = false; p.shake = 0; }
    for (const f of fires) f.on = true;
    if (water) { water.visible = false; wall.visible = false; }
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), c = new THREE.Color();
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const p of parts) {
        if (p.shake <= 0) continue;
        p.shake = Math.max(0, p.shake - dt * 5);
        p.whole.position.x = p.x + Math.sin(t * 90) * 0.06 * p.shake;
      }
      if (fireMesh) {
        let i = 0;
        for (const f of fires) for (let k = 0; k < 24; k++, i++) {
          if (!f.on) { fireMesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
          const u = ((t * (1.1 + (k % 5) * 0.17) + k * 0.137) % 1 + 1) % 1, sz = 0.5 * Math.pow(1 - u, 0.7);
          pv.set(f.x + Math.sin(k * 2.3) * 0.35 * (1 - u), 2.3 + u * 2.4, f.z + Math.cos(k * 1.7) * 0.35 * (1 - u));
          fireMesh.setMatrixAt(i, m4.compose(pv, q.setFromEuler(e3.set(0, t * 1.5 + k, 0)), sv.set(sz, sz * 1.4, sz)));
          fireMesh.setColorAt(i, c.setRGB(1.9 - u * 1.2, 2.3 - u * 1.4, 0.35 + u * 0.2));   // sorcerous yellow-green, kept under the bloom's glare
        }
        fireMesh.instanceMatrix.needsUpdate = true; fireMesh.instanceColor.needsUpdate = true;
      }
      if (water) {
        const F = cp?.flood, front = F && game.frame >= F.f ? (F.front ?? FLOOD.z0) : 999, rolling = F && game.frame >= F.f && game.frame < F.f + FLOOD.frames;
        water.visible = !!F && game.frame >= F.f;
        water.material.uniforms.uFront.value = rolling ? front : F && game.frame >= F.f ? -999 : 999;
        water.material.uniforms.uTime.value = t;
        wall.visible = !!rolling;
        if (rolling) {
          wall.position.set(0, 1.0 + Math.sin(t * 7) * 0.1, front - 0.6);
          if ((game.frame & 1) === 0) {                         // spray along the crest in front of the hero
            const hx = game.hero.x;
            for (let k = 0; k < 3; k++) fx.embers(hx + (k - 1) * 9 + Math.sin(t * 13 + k) * 3, 2.0, front - 1, 6, 1.6, [1.4, 1.7, 1.9]);
          }
        }
      }
    },
  };
}
