// Camps (render-only): each base of game.bases as a field camp — a ring of spiked barricades open toward the middle of
// the field, two tents, a brazier and a tall command standard in its holder's colours (the enemy's character; the
// ally's once the camp falls, with a burst of light). Reads game.bases, never writes it.
import * as THREE from 'three';
import { on } from '../core/events.js';
import { STAGE } from './index.js';
import { boxesGeometry, shade } from '../core/voxel.js';
import { makeRng } from '../core/rng.js';
import { BASE } from './bases.js';
import { t as tr } from '../core/lang.js';

const lit = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

function flagTex(ch, bg, fg, rim) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 96, 160);
  g.fillStyle = rim; g.fillRect(0, 0, 96, 8); g.fillRect(0, 0, 6, 160); g.fillRect(90, 0, 6, 160);
  g.fillStyle = fg; g.font = 'bold 64px "Xingkai SC","STXingkai","Kaiti SC","STKaiti","KaiTi",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tr(ch), 48, 74);
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(20, 160); g.lineTo(48, 128); g.lineTo(76, 160); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

/** A camp in its own frame: the gate toward local −z. */
function campGeometry(r) {
  const b = [], S = BASE.size;
  // barricades round the square, a 7 m gap for the gate
  for (let side = 0; side < 4; side++) for (let k = -2; k <= 2; k++) {
    if (side === 0 && Math.abs(k) <= 1) continue;
    const t = k * (S * 0.4), [x, z, yaw] = [[t, -S, 0], [S, t, Math.PI / 2], [t, S, 0], [-S, t, Math.PI / 2]][side];
    b.push({ s: [3.4, 0.3, 0.3], p: [x, 0.55, z], r: [0, yaw, 0], c: 0x4a3222 });
    for (let j = 0; j < 4; j++) {
      const o = (j - 1.5) * 0.85, cx = x + Math.cos(yaw) * o, cz = z - Math.sin(yaw) * o;
      for (const s of [1, -1]) b.push({ s: [0.14, 2.0, 0.14], p: [cx, 0.75, cz], r: [0.7 * s, yaw, 0], c: shade(0x5e4330, r.range(0.8, 1.1)) });
    }
  }
  for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S]]) {        // corner posts with lanterns
    b.push({ s: [0.3, 3.2, 0.3], p: [x, 1.6, z], c: 0x3a2618 }, { s: [0.5, 0.6, 0.5], p: [x, 3.1, z], c: 0xb8401e });
  }
  for (const [x, z, w, d, col] of [[-4.2, 3.2, 4.4, 5, 0x8a3025], [4, 2.6, 4, 4.6, 0xb09a7c]]) {   // tents
    for (let k = 0; k < 4; k++) b.push({ s: [w * (1 - k * 0.22), 0.6, d], p: [x, 0.3 + k * 0.6, z], c: shade(col, 1 - k * 0.05) });
    b.push({ s: [0.16, 3.2, 0.16], p: [x, 1.6, z], c: 0x3a2618 });
  }
  b.push({ s: [1.2, 0.5, 1.2], p: [0, 0.25, -1.5], c: 0x5a4a38 }, { s: [0.9, 0.3, 0.9], p: [0, 0.65, -1.5], c: 0x2a1a10 });   // brazier
  b.push({ s: [0.26, 9, 0.26], p: [1.6, 4.5, 0.4], c: 0x3b2a1e }, { s: [2.6, 0.18, 0.18], p: [2.8, 8.6, 0.4], c: 0x3b2a1e });   // command standard
  return boxesGeometry(b);
}

export function createBasesView(scene, game, vfx) {
  const B = game.bases, fx = vfx.fx, r = makeRng(919);
  if (!B.list.length) return { update() {} };
  const foeTex = flagTex(STAGE.enemy.ch, '#7d2a1f', '#1a0d0a', '#4a1712'), allyTex = flagTex(STAGE.ally.ch, '#2f5aa8', '#f2e6c8', '#c8a04a');
  const mk = (t) => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.9 });
  const foeMat = mk(foeTex), allyMat = mk(allyTex), mat = lit();
  const camps = B.list.map((b) => {
    const g = new THREE.Group(), yaw = Math.atan2(-b.x, -b.z) + Math.PI;   // the gate (local −z) toward the middle
    g.position.set(b.x, 0, b.z); g.rotation.y = yaw;
    const m = new THREE.Mesh(campGeometry(r), mat); m.castShadow = m.receiveShadow = true; g.add(m);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.8, 3, 5), b.side === 'foe' ? foeMat : allyMat);
    flag.position.set(2.85, 6.6, 0.4); g.add(flag);
    scene.add(g);
    return { b, flag, ph: r.range(0, 6.28) };
  });
  const paint = () => { for (const c of camps) c.flag.material = c.b.side === 'foe' ? foeMat : allyMat; };
  on('base:taken', (e) => {
    paint();
    fx.columns(e.x, e.z, 1, 0, 12, 1.4, 0.8, [0.9, 1.4, 2.4], 0); fx.ring(e.x, e.z, 10, 0.6, [0.9, 1.4, 2.4]);
    fx.star(e.x, 6, e.z, 3, 0.5, [1.4, 1.8, 2.6]); fx.flash(0.08);
  });
  on('scenario', paint);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const c of camps) c.flag.rotation.y = Math.sin(t * 1.3 + c.ph) * 0.12;   // the standard stirs in the wind
    },
  };
}
