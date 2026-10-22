// Stage props (render-only) for the battle's goals (stages/campaign.js): a beacon over every spot the current goal asks
// the hero to take (a column of light, a ground ring that fills while he holds it), Liu Shan's bundle by the dry well
// (長坂坡), the fire ships at their jetties that blaze up and drift into the chained fleet as they are lit (赤壁), and the
// allied officer the script stations on 長坂橋 — a puppet of his own hero definition — with his roar.
// Reads the campaign, never writes it.
import * as THREE from 'three';
import { on } from '../core/events.js';
import { STAGE } from './index.js';
import { HERO, HEROES } from '../heroes/index.js';
import { createPuppet } from '../hero/puppet.js';
import { boxesGeometry, shade } from '../core/voxel.js';
import { hash01 } from '../core/rng.js';
import { RIVER, STREAM } from '../world/setpieces.js';

const GOLD = new THREE.Color(1.0, 0.72, 0.28), ROAR = [2.0, 1.2, 0.5];
const prop = (kind) => STAGE.props?.find((p) => p.kind === kind);
const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/** Light column: open cylinder, bright at the foot and fading upward, with slow bands climbing it. */
function columnMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: GOLD.clone() }, uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uA; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 2.2), band = 0.65 + 0.35 * sin(vUv.y * 40.0 - uTime * 5.0);
        float edge = 0.55 + 0.45 * pow(abs(sin(vUv.x * 3.14159 * 2.0)), 0.5);
        gl_FragColor = vec4(uColor * 0.9, fade * band * edge * 0.3 * uA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}
/** Ground ring with the capture fill: a band at the spot's radius, the arc taken so far drawn solid and bright. */
function ringMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProg: { value: 0 }, uColor: { value: GOLD.clone() }, uA: { value: 1 } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uProg, uA; uniform vec3 uColor; varying vec2 vP;
      void main() {
        float r = length(vP), a = fract(atan(vP.x, vP.y) / 6.28318 + 1.0);
        float rim = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(0.97, 1.0, r));
        float dash = step(0.5, fract(a * 24.0 - uTime * 0.6));
        float fillBand = smoothstep(0.7, 0.74, r) * (1.0 - smoothstep(0.84, 0.86, r)) * step(a, uProg);
        float glow = (1.0 - smoothstep(0.0, 0.9, r)) * 0.12 * (0.6 + 0.4 * sin(uTime * 4.0));
        float v = rim * (0.45 + 0.55 * dash) + fillBand * 1.4 + glow;
        gl_FragColor = vec4(uColor * 1.8, v * uA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
}

/** Small flame emitter (instanced additive cubes, the dressing fires' palette) for props that catch fire and move. */
function flameEmitter(scene, n) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false }), n);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const P = Array.from({ length: n }, (_, i) => ({ ph: hash01(i, 3), sp: 1.1 + hash01(i, 5) * 0.9, ox: hash01(i, 7) - 0.5, oz: hash01(i, 11) - 0.5,
    h: 1.6 + hash01(i, 13) * 2.4, sz: 0.4 + hash01(i, 17) * 0.4, rot: hash01(i, 19) * 6.28 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const HOT = new THREE.Color(7, 5.2, 2.4), MID = new THREE.Color(5.5, 2.0, 0.45), END = new THREE.Color(1.4, 0.3, 0.08);
  return {
    /** sources: [{x, y, z, w (half width), d (half depth), s (size, 0 = out)}]; particles are dealt round-robin. */
    update(t, sources) {
      for (let i = 0; i < n; i++) {
        const f = P[i], src = sources[i % sources.length];
        if (!src || src.s <= 0) { mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
        const k = ((t * f.sp + f.ph) % 1 + 1) % 1, s = src.s;
        p.set(src.x + f.ox * src.w * 2 * (1 - k * 0.6), src.y + k * f.h * s, src.z + f.oz * src.d * 2 * (1 - k * 0.6));
        const size = f.sz * s * Math.pow(1 - k, 0.7) * (0.75 + 0.25 * Math.sin(t * 17 + f.rot));
        q.setFromEuler(e.set(0, f.rot + t * 1.5, 0));
        mesh.setMatrixAt(i, m.compose(p, q, sc.set(size, size * 1.35, size)));
        if (k < 0.3) c.copy(HOT).lerp(MID, k / 0.3); else c.copy(MID).lerp(END, (k - 0.3) / 0.7);
        mesh.setColorAt(i, c.multiplyScalar(1 - k * 0.5));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
  };
}

/** A small fire ship: low hull heaped with reed bundles and oil jars, a stubby mast with a 吳 pennant. */
function boatGeometry() {
  const b = [];
  b.push({ s: [2.2, 0.7, 5.4], p: [0, 0.25, 0], c: 0x4e3420 }, { s: [2.5, 0.25, 5.8], p: [0, 0.65, 0], c: 0x6a4a2c });
  b.push({ s: [1.4, 0.5, 0.9], p: [0, 0.55, 2.9], r: [0.5, 0, 0], c: 0x5a3c24 });                   // raised prow
  for (let k = 0; k < 6; k++) b.push({ s: [0.9, 0.6, 1.2], p: [(k % 2 ? 0.5 : -0.5), 1.05 + (k % 3) * 0.12, -1.8 + Math.floor(k / 2) * 1.3], r: [0, 0.2 * (k % 3 - 1), 1.57], c: shade(0xb09a5a, 0.85 + 0.05 * k) });
  for (const [x, z] of [[0, 1.4], [0.6, -2.4], [-0.6, -2.4]]) b.push({ s: [0.45, 0.6, 0.45], p: [x, 1.0, z], c: 0x3a2a24 });
  b.push({ s: [0.16, 3.4, 0.16], p: [0, 2.2, -0.2], c: 0x3e2a1c }, { s: [0.06, 0.8, 1.1], p: [0, 3.5, -0.8], c: 0xa82a1e });
  return boxesGeometry(b);
}

export function createProps(scene, game, vfx, camera) {
  const cp = game.campaign, fx = vfx.fx;
  let t = 0;

  // ---- beacons over the spots of the current reach goal
  const beacons = [0, 1, 2].map(() => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 26, 24, 1, true).translate(0, 13, 0), columnMaterial());
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), ringMaterial());
    const g = new THREE.Group(); g.add(col, ring); g.visible = false; g.renderOrder = 4;
    scene.add(g);
    return { g, col, ring, a: 0 };
  });

  // ---- 長坂坡: Liu Shan in his swaddling by the well, until the hero takes him up
  const well = prop('well')?.at;
  const bundle = well && new THREE.Mesh(boxesGeometry([
    { s: [0.55, 0.3, 0.34], p: [0, 0.17, 0], c: 0xc8402a }, { s: [0.2, 0.22, 0.24], p: [0.3, 0.2, 0], c: 0xe8c89a },
    { s: [0.6, 0.06, 0.38], p: [0, 0.34, 0], c: 0xe0b040 }]), lit());
  if (bundle) { bundle.position.set(well[0] + 1.35, 0, well[1] + 0.2); bundle.rotation.y = 0.6; bundle.castShadow = true; scene.add(bundle); }

  // ---- 赤壁: fire ships at the jetties; lit, they blaze and drift into the fleet, where they burst
  const boatSpots = prop('fireboats')?.at || [];
  const boatGeo = boatSpots.length ? boatGeometry() : null, boatMat = boatGeo ? lit() : null;
  const boats = boatSpots.map(([x]) => {
    const m = new THREE.Mesh(boatGeo, boatMat);
    m.position.set(x, 0.05, RIVER.z0 + 4.6); m.castShadow = true; scene.add(m);
    return { m, x, z0: RIVER.z0 + 4.6, lit: -1, s: 0 };
  });
  const flames = boats.length ? flameEmitter(scene, 150) : null;
  const flameSrc = boats.map(() => ({ x: 0, y: 0, z: 0, w: 0.9, d: 2.4, s: 0 }));

  // ---- the ally on the bridge: built at boot (hidden) so his shaders compile with the rest
  const allyGoal = STAGE.script?.find((g) => g.ally)?.ally;
  const allyDef = allyGoal && HEROES.find((h) => h.id === (allyGoal.id === HERO.id ? allyGoal.alt : allyGoal.id));
  const ally = allyDef ? createPuppet(scene, allyDef) : null;
  ally?.show(false);
  const roarClip = allyDef?.id === 'zhangfei' ? ['c1', 0, 0.36] : null;   // 當陽一喝: the roar opening of his C1
  const anim = { id: 'idle', t: 0, seq: 'idle' };

  on('goal:progress', (e) => {
    if (cp.goal?.kind !== 'reach') return;
    fx.ring(e.x, e.z, 4.2, 0.45, [2.2, 1.6, 0.6]); fx.star(e.x, 1.2, e.z, 2.0, 0.3, [2.4, 1.8, 0.8]);
    const b = boats.find((x) => Math.abs(x.x - e.x) < 1 && x.lit < 0);
    if (b) { b.lit = 0; fx.flash(0.1); fx.embers(b.x, 1, b.z0, 30, 1.6); }
  });
  on('goal:done', (e) => {
    if (bundle && e.goal.kind === 'reach' && e.goal.label === '阿斗') { bundle.visible = false; fx.star(bundle.position.x, 0.8, bundle.position.z, 1.6, 0.4, [2.2, 2.0, 1.2]); }
  });
  on('ally:roar', (e) => {
    const { x, z } = e;
    fx.ring(x, z, 6, 0.35, ROAR); fx.ring(x, z, 10, 0.5, ROAR.map((v) => v * 0.8)); fx.ring(x, z, 14, 0.7, ROAR.map((v) => v * 0.6));
    fx.dustRing(x, z, 40, 0.6, 22, 0.8, 0.6); fx.rayBurst(x, 1.8, z, 16, 9, ROAR.map((v) => v * 0.9), [-0.05, 0.25], 0.45, 0.5);
    fx.star(x, 2.2, z, 3, 0.4, ROAR.map((v) => v * 1.1)); fx.flash(0.2);
  });
  on('scenario', () => {
    if (bundle) bundle.visible = true;
    for (const b of boats) { b.lit = -1; b.m.visible = true; b.m.position.set(b.x, 0.05, b.z0); b.m.rotation.set(0, 0, 0); }
  });

  return {
    update(dt) {
      t += dt;
      // beacons: one per spot still to take in the current goal; the ring fills with the hold
      const g = cp?.goal, pts = g?.kind === 'reach' ? g.points : [];
      beacons.forEach((bc, j) => {
        const want = j < pts.length && cp.caps[j] < 1;
        bc.a = Math.max(0, Math.min(1, bc.a + (want ? dt * 2 : -dt * 3)));
        bc.g.visible = bc.a > 0;
        if (!bc.g.visible) return;
        if (want) { bc.g.position.set(pts[j][0], 0.06, pts[j][1]); bc.g.scale.set(g.r || 3, 1, g.r || 3); }
        bc.col.scale.set(0.16, 1, 0.16);
        // the column guides from afar: it thins out as the camera comes near, and all but goes once he stands in it
        const h = game.hero, inside = Math.hypot(h.x - bc.g.position.x, h.z - bc.g.position.z) < (g?.r || 3);
        const near = Math.min(1, Math.max(0, (camera.position.distanceTo(bc.g.position) - 7) / 14));
        bc.col.material.uniforms.uA.value = bc.a * near * (inside ? 0.15 : 1);
        bc.ring.material.uniforms.uA.value = bc.a;
        for (const m of [bc.col.material, bc.ring.material]) m.uniforms.uTime.value = t;
        bc.ring.material.uniforms.uProg.value = want ? cp.caps[j] : 1;
      });
      // fire ships: bob at the jetty; once lit, burn hotter as they drift out to the fleet, then burst into it
      for (let j = 0; j < boats.length; j++) {
        const b = boats[j], src = flameSrc[j], m = b.m;
        if (b.lit >= 0) {
          b.lit += dt;
          const u = Math.min(1, b.lit / 7), z = b.z0 + (60 - b.z0) * u * u * (3 - 2 * u);
          m.position.set(b.x + Math.sin(b.lit * 0.7) * 0.6, 0.05 + Math.sin(t * 1.3 + j) * 0.06, z);
          Object.assign(src, { x: m.position.x, y: 0.9, z, s: Math.min(1.3, 0.4 + b.lit * 0.5) });
          if (u >= 1 && m.visible) {
            m.visible = false; src.s = 0;
            fx.columns(b.x, 60, 6, 2.5, 9, 1.6, 0.8, [2.4, 0.9, 0.3], 0.1); fx.embers(b.x, 2, 60, 50, 4); fx.flash(0.08);
          }
        } else {
          m.position.y = 0.05 + Math.sin(t * 1.3 + j) * 0.06; m.rotation.z = Math.sin(t * 0.9 + j) * 0.03;
          src.s = 0;
        }
      }
      if (flames) flames.update(t, flameSrc);
      // the ally: idle on the bridge deck, the roar when the hero gets there
      if (ally) {
        const a = cp?.ally;
        ally.show(!!a);
        if (a) {
          const an = a.anim;
          if (an.id === 'roar' && roarClip) { anim.id = roarClip[0]; anim.t = roarClip[1] + (roarClip[2] - roarClip[1]) * an.t; anim.seq = 'roar'; }
          else { anim.id = 'idle'; anim.t = an.t; anim.seq = 'idle'; }
          ally.update(dt, anim, a.x, STREAM.deckY + 0.07, a.z, a.yaw);
        }
      }
    },
  };
}
