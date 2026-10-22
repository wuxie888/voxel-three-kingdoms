// Supplies view (render-only): voxel jars and supply crates on the field (shattered when they break), the items they
// spill — 肉包, a platter of buns, a wine jar, the golden tiger tally, a piece of dark armour — bobbing and turning over a
// coloured glow ring (blinking in their last 3 s), and the pickup bursts. Reads game.supplies, never writes it.
import * as THREE from 'three';
import { on } from '../core/events.js';
import { boxesGeometry } from '../core/voxel.js';

const GLOW = { bun: 0xffd070, feast: 0xffb040, wine: 0x9ad8ff, tiger: 0xff6a3a, armor: 0x8ab0ff };
const BURST = { bun: [2.0, 1.6, 0.8], feast: [2.2, 1.6, 0.6], wine: [0.9, 1.8, 2.4], tiger: [2.4, 0.9, 0.4], armor: [1.0, 1.4, 2.4] };
const LIFE = 60 * 30;

const bun = (x, y, z, k = 1) => [
  { s: [0.5 * k, 0.2 * k, 0.5 * k], p: [x, y + 0.1 * k, z], c: 0xf2ece0 }, { s: [0.42 * k, 0.12 * k, 0.42 * k], p: [x, y + 0.26 * k, z], c: 0xf6f1e6 },
  { s: [0.26 * k, 0.08 * k, 0.26 * k], p: [x, y + 0.36 * k, z], c: 0xfaf6ee }, { s: [0.08 * k, 0.04 * k, 0.08 * k], p: [x, y + 0.41 * k, z], c: 0xd0321f },
];
const GEO = {
  bun: () => boxesGeometry([...bun(0, 0.03, 0), { s: [0.66, 0.04, 0.66], p: [0, 0, 0], c: 0x8a5a2a }]),
  feast: () => boxesGeometry([{ s: [1.0, 0.06, 1.0], p: [0, 0, 0], c: 0x6e4424 }, { s: [1.1, 0.04, 1.1], p: [0, 0.05, 0], c: 0xc8b48a },
    ...bun(-0.22, 0.07, -0.14, 0.85), ...bun(0.24, 0.07, -0.1, 0.85), ...bun(0, 0.07, 0.24, 0.85), ...bun(0.02, 0.4, 0.0, 0.7)]),
  wine: () => boxesGeometry([{ s: [0.42, 0.12, 0.42], p: [0, 0.06, 0], c: 0x4a2c1a }, { s: [0.56, 0.34, 0.56], p: [0, 0.29, 0], c: 0x5a3820 },
    { s: [0.42, 0.1, 0.42], p: [0, 0.51, 0], c: 0x4a2c1a }, { s: [0.26, 0.1, 0.26], p: [0, 0.6, 0], c: 0x3a2214 },
    { s: [0.34, 0.12, 0.34], p: [0, 0.69, 0], c: 0xb02a1a }, { s: [0.08, 0.14, 0.08], p: [0.12, 0.62, 0.12], c: 0xb02a1a },
    { s: [0.22, 0.24, 0.02], p: [0, 0.3, 0.29], c: 0xe8c86a }]),
  tiger: () => boxesGeometry([{ s: [0.62, 0.24, 0.2], p: [0, 0.24, 0], c: 0xe0b040 }, { s: [0.22, 0.24, 0.2], p: [0.36, 0.36, 0], c: 0xe8bc48 },
    { s: [0.1, 0.1, 0.22], p: [0.44, 0.48, 0], c: 0xd0a030 }, { s: [0.12, 0.16, 0.2], p: [-0.22, 0.08, 0], c: 0xc89a30 },
    { s: [0.12, 0.16, 0.2], p: [0.2, 0.08, 0], c: 0xc89a30 }, { s: [0.24, 0.06, 0.06], p: [-0.4, 0.34, 0], r: [0, 0, 0.6], c: 0xd0a030 },
    ...[-0.18, -0.02, 0.14].map((x) => ({ s: [0.05, 0.26, 0.22], p: [x, 0.25, 0], c: 0x3a2410 })), { s: [0.64, 0.02, 0.22], p: [0, 0.24, 0], c: 0x8a6418 }]),
  armor: () => boxesGeometry([{ s: [0.56, 0.5, 0.22], p: [0, 0.4, 0], c: 0x2a2c34 }, { s: [0.6, 0.06, 0.24], p: [0, 0.66, 0], c: 0xc8a040 },
    ...[0.22, 0.34, 0.46, 0.58].map((y) => ({ s: [0.58, 0.03, 0.24], p: [0, y, 0], c: 0x4a4e5a })), { s: [0.22, 0.2, 0.26], p: [-0.38, 0.6, 0], c: 0x32343e },
    { s: [0.22, 0.2, 0.26], p: [0.38, 0.6, 0], c: 0x32343e }, { s: [0.14, 0.14, 0.04], p: [0, 0.42, 0.12], c: 0xc8a040 }]),
};
function jarGeometry() {
  return boxesGeometry([{ s: [0.5, 0.14, 0.5], p: [0, 0.07, 0], c: 0x6a4228 }, { s: [0.74, 0.46, 0.74], p: [0, 0.37, 0], c: 0x8a5a34 },
    { s: [0.76, 0.06, 0.76], p: [0, 0.42, 0], c: 0x6a4228 }, { s: [0.56, 0.14, 0.56], p: [0, 0.67, 0], c: 0x7e5230 },
    { s: [0.36, 0.12, 0.36], p: [0, 0.8, 0], c: 0x6a4228 }, { s: [0.44, 0.06, 0.44], p: [0, 0.88, 0], c: 0x8a5a34 },
    { s: [0.4, 0.1, 0.4], p: [0, 0.95, 0], c: 0xa82a1a }, { s: [0.18, 0.2, 0.02], p: [0, 0.4, 0.38], c: 0xd8b860 }]);
}
function crateGeometry() {
  const b = [{ s: [0.9, 0.66, 0.9], p: [0, 0.33, 0], c: 0x7a5434 }];
  for (const y of [0.12, 0.33, 0.54]) b.push({ s: [0.94, 0.08, 0.94], p: [0, y, 0], c: 0x5e3e26 });
  for (const [x, z] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) b.push({ s: [0.1, 0.7, 0.1], p: [x, 0.35, z], c: 0x4a3020 });
  b.push({ s: [0.92, 0.04, 0.12], p: [0, 0.67, 0], c: 0xc8b07a }, { s: [0.3, 0.3, 0.02], p: [0, 0.36, 0.46], c: 0xb8321e }, { s: [0.12, 0.12, 0.03], p: [0, 0.36, 0.47], c: 0xf0e0b0 });
  return boxesGeometry(b);
}

export function createSuppliesView(scene, game, vfx) {
  const S = game.supplies, fx = vfx.fx;
  const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
  const inst = (geo, n, mat = lit()) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = true; scene.add(m); return m; };
  const jarM = inst(jarGeometry(), S.jars.length), crateM = inst(crateGeometry(), S.jars.length);
  const items = {}, glows = {};
  for (const k of Object.keys(GEO)) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true, emissive: GLOW[k], emissiveIntensity: 0.18 });
    items[k] = inst(GEO[k](), 18, mat);
    const gm = new THREE.MeshBasicMaterial({ color: GLOW[k], transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    glows[k] = inst(new THREE.RingGeometry(0.55, 0.85, 24).rotateX(-Math.PI / 2), 18, gm);
    glows[k].castShadow = false;
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // jars stand still: matrices only change when one breaks (or the battle restarts)
  const paintJars = () => {
    S.jars.forEach((j, i) => {
      const yaw = (i * 1.7) % 6.28;
      const mx = m.compose(p.set(j.x, 0, j.z), q.setFromAxisAngle(up, yaw), s.setScalar(j.crate ? 1.15 : 1.1));
      jarM.setMatrixAt(i, j.alive && !j.crate ? mx : ZERO);
      crateM.setMatrixAt(i, j.alive && j.crate ? mx : ZERO);
    });
    jarM.instanceMatrix.needsUpdate = true; crateM.instanceMatrix.needsUpdate = true;
  };
  paintJars();
  on('jar:break', (e) => {
    paintJars();
    fx.rocks(e.x, e.z, 12, 0.5, 0.08, 0.2, [3, 6.5], 2.6);
    fx.dustPuff(e.x, e.z, 5, 1.8, 0.5, 0.15, 0.5);
    if (e.item) fx.star(e.x, 0.8, e.z, 1.1, 0.25, BURST[e.item]);
  });
  on('scenario', paintJars);
  on('pickup', (e) => {
    const c = BURST[e.kind];
    fx.ring(e.x, e.z, 1.8, 0.4, c); fx.star(e.x, 1.0, e.z, 1.5, 0.3, c); fx.embers(e.x, 0.4, e.z, 18, 0.7, c);
  });

  return {
    update() {
      const t = game.frame / 60, n = {};
      for (const k in items) n[k] = 0;
      for (const it of S.items) {
        const k = it.kind, i = n[k]++;
        if (i >= 18) continue;
        const blink = it.t > LIFE - 180 && (it.t >> 3) & 1 ? 0 : 1;
        items[k].setMatrixAt(i, m.compose(p.set(it.x, 0.22 + 0.08 * Math.sin(t * 3 + i), it.z), q.setFromAxisAngle(up, t * 1.5 + i), s.setScalar((k === 'feast' ? 0.9 : 1.1) * blink)));
        glows[k].setMatrixAt(i, m.compose(p.set(it.x, 0.05, it.z), q.identity(), s.setScalar((1 + 0.1 * Math.sin(t * 5 + i)) * blink)));
      }
      for (const k in items) {
        for (let i = n[k]; i < 18; i++) { items[k].setMatrixAt(i, ZERO); glows[k].setMatrixAt(i, ZERO); }
        items[k].instanceMatrix.needsUpdate = true; glows[k].instanceMatrix.needsUpdate = true;
      }
    },
  };
}
