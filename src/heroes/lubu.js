// 呂布 Lü Bu (after the DW9 design): a wild black mane under a gold tiara, two very long red pheasant feathers (spring
// chains), a hard handsome face. Sculpted gold muscle cuirass (pectorals, segmented abs) with a dark-red high collar,
// black sleeves embroidered in gold, black pauldrons with gold rims sweeping up, gold bracers; a gold belt with a beast
// medallion, big flaring gold-scale tassets, a long black front apron with a gold trident motif, black trousers with
// purple knee bands, gold greaves; a long red cape. Weapon: the Sky Piercer — a long spear point, one great crescent
// blade with spurs and a small hook opposite, a red gem where they meet, red tassel.
import { vox, B, P, md, mirX, lamellar } from '../hero/model.js';
import { hash01 } from '../core/rng.js';
import { shade } from '../core/voxel.js';
import * as MOVESET from './lubu.moves.js';
import { FV, glove, bracer, symH } from './parts.js';

const HV = 0.0135;
const C = {
  A: 0x7c6030, Ad: 0x44341a, Al: 0xa88a4a,                                  // dark gold
  K: 0x1e1c22, Kd: 0x121116, Kl: 0x34303a, Kg: 0x7a5e2c,                    // black cloth, gold thread
  R: 0x8a1e18, Rd: 0x5a120e, Rl: 0xa8322a, purple: 0x5a2a7a,
  skin: 0xe2b28e, skinD: 0xba8668, skinH: 0xf0c8a6, lip: 0xa86a58, eye: 0x100a0c, iris: 0x3a1a14, scl: 0xe0d6cc,
  hair: 0x121014, hairH: 0x2c2632,
  feather: 0xb02a22, featherL: 0xd04a38, featherD: 0x5a120e,
  shaft: 0x1e1a1e, shaftH: 0x2e282e, steel: 0xc4ccd6, edge: 0xf0f4f8, steelD: 0x7c8490, gem: 0xd01818, gemL: 0xff6a5a,
  tas: 0xc82a1e, tasH: 0xf05a3a, tasD: 0x8a1812,
};
const cloth = (x, y, z) => (md(x * 3 + y * 2 + z, 17) === 0 && hash01(x, y, z) < 0.7 ? C.Kg : md(x + z * 3, 11) === 0 ? C.Kd : C.K);

// ---------------------------------------------------------------- body parts (fine voxels, centred on the joints)
function torso() {
  const P_ = {};
  P_.hips = [
    B([-12, -10, -8], [12, 6, 8], C.K),
    B([-14, -12, -10], [14, -2, 10], cloth),
    B([-15, -2, -11], [15, 6, 11], (x, y) => (y === -2 || y === 5 ? C.Ad : md(x, 6) === 0 ? C.Al : C.A)),   // gold belt
    // beast medallion: round gold face, red eyes, fangs
    B([-5, -3, 11], [5, 7, 13], (x, y) => (Math.hypot(x + 0.5, y - 2) < 4.6 ? C.Al : null)),
    B([-3, -1, 13], [3, 5, 14], C.A), P([-3, 3, 13], [-1, 4, 14], C.gem), P([1, 3, 13], [3, 4, 14], C.gem),
    P([-2, 0, 13], [2, 1, 14], C.Ad), B([-2, -2, 13], [-1, 0, 14], C.steel), B([1, -2, 13], [2, 0, 14], C.steel),
  ];
  // waist: segmented gold abdominal plates, black sides
  P_.spine = [
    B([-10, -6, -8], [10, 16, 8], C.K),
    B([-11, -4, -9], [11, 16, 9], cloth),
    ...[[-3, 1], [2, 6], [7, 11], [12, 15]].flatMap(([y0, y1]) => [
      B([-9, y0, 9], [-1, y1, 11], C.A), B([1, y0, 9], [9, y1, 11], C.A),
      P([-9, y1 - 1, 10], [-1, y1, 11], C.Al), P([1, y1 - 1, 10], [9, y1, 11], C.Al),
    ]),
    B([-1, -4, 9], [1, 16, 10], C.Ad),
  ];
  // chest: gold muscle cuirass — two pectoral masses with highlights on top and a deep groove between, collarbone
  // ridge, gold back plate; black sleeves' shoulder caps; dark-red high collar with a gold rim
  const pec = (x, y, z) => (z >= 14 && y > 13 ? C.Al : y < 9 ? C.Ad : Math.abs(x + 0.5) > 10 ? C.Ad : C.A);   // lit top, shaded underside and flanks
  P_.chest = [
    B([-14, -4, -11], [14, 19, 11], cloth),
    B([-13, -4, 11], [13, 18, 12], C.A),
    B([-12, 6, 12], [-1, 18, 15], pec), B([1, 6, 12], [12, 18, 15], pec),
    B([-11, 9, 15], [-2, 17, 16], pec), B([2, 9, 15], [11, 17, 16], pec),
    P([-12, 6, 14], [-1, 7, 15], C.Ad), P([1, 6, 14], [12, 7, 15], C.Ad),
    B([-1, 0, 11], [1, 19, 13], C.Ad),
    B([-12, 18, 10], [12, 20, 13], C.Al),                              // collarbone ridge
    B([-13, -2, -13], [13, 18, -11], C.A), P([-13, 17, -13], [13, 18, -11], C.Al),
    B([-8, 16, -8], [8, 24, 8], C.R), P([-8, 23, -8], [8, 24, 8], C.A), P([-8, 16, 7], [8, 24, 8], C.Rd),
    B([-6, 16, -6], [6, 26, 6], -1),
  ];
  P_.neck = [B([-4, -2, -4], [4, 6, 4], C.skinD), P([-4, 2, 3], [4, 6, 4], C.skin)];
  return P_;
}

function limbs(P_) {
  for (const [s, sx] of [['R', -1], ['L', 1]]) {
    P_['upperArm' + s] = [B([-5, -24, -5], [5, 2, 5], cloth), B([-6, -24, -6], [6, -21, 6], C.Kd), P([-6, -21, -6], [6, -20, 6], C.purple)];
    P_['foreArm' + s] = bracer(C.K, [C.A, C.Ad, C.Al]);
    P_['hand' + s] = glove(sx, C.K, C.Kl);
    // black trousers with gold thread; great gold-scale tasset flaring out over the outside and front of the thigh
    const scaleG = (x, y) => (md(y, 3) === 0 ? C.Ad : md(x + (Math.floor(y / 3) & 1) * 2, 4) === 0 ? C.Ad : C.A);
    P_['thigh' + s] = [
      B([-8, -36, -8], [8, 2, 8], cloth),
      B([-9, -32, -9], [9, -22, 9], cloth),
      ...[
        B([6, -18, -10], [10, 4, 10], scaleG), B([9, -20, -11], [12, -6, 11], scaleG),   // flaring outward toward the hem
        P([6, -18, -10], [12, -17, 11], C.K), P([11, -20, -11], [12, -6, 11], C.K),
        B([-6, -12, 8], [7, 4, 11], scaleG), P([-6, -12, 8], [7, -11, 11], C.K),
      ].map((b) => mirX(b, sx)),
    ];
    // purple knee band, gold greave with a black centre stripe, pointed gold-black boots
    P_['shin' + s] = [
      B([-6, -34, -6], [6, 0, 6], C.K),
      B([-7, -2, -7], [7, 2, 7], C.purple),
      B([-7, -32, -2], [7, -4, 8], (x, y) => (Math.abs(x + 0.5) < 1.5 ? C.K : y === -5 || Math.abs(x + 0.5) > 6 ? C.Al : C.A)),
      B([-7, -34, -7], [7, -31, 7], C.Ad),
    ];
    P_['foot' + s] = [
      B([-6, -6, -4], [6, 2, 12], C.K),
      B([-5, -6, 12], [5, 0, 16], C.A), B([-3, -6, 16], [3, -2, 19], C.Al),
      P([-6, 1, -4], [6, 2, 12], C.A), P([-6, -6, -4], [6, -5, 19], C.Kd),
    ];
  }
  return P_;
}

/** Black pauldron with gold rims, three tiers sweeping up and out to a pointed wing. */
function pauldronBoxes(sx) {
  const rim = (y0) => (x, y, z) => (y === y0 || Math.abs(z) >= 9 ? C.Al : C.K);
  const b = [
    B([-6, 4, -10], [6, 8, 10], rim(4)),
    B([-2, 0, -11], [9, 4, 11], rim(0)),
    B([2, -5, -11], [12, 0, 11], rim(-5)), P([11, -5, -11], [12, 0, 11], C.Al),
    B([6, 6, -8], [10, 10, 8], C.K), B([9, 9, -7], [12, 13, 7], C.Al), B([11, 12, -4], [13, 16, 4], C.A),   // swept wing
  ];
  return b.map((bx) => mirX(bx, sx));
}

// ---------------------------------------------------------------- head (head voxels, chin y 0)
function head() {
  const hair = (x, y, z) => (md(x * 3 + z + y, 5) === 0 ? C.hairH : C.hair);
  const bang = { '-6': 11, '-5': 12, '-4': 10, '-3': 12, '-2': 11, '-1': 12, 0: 10, 1: 12, 2: 11, 3: 12, 4: 10, 5: 12, 6: 11 };
  return [
    B([-6, 2, -6], [7, 13, 6], C.skin),
    B([-5, 0, -5], [6, 2, 5], C.skin), B([-3, -1, -2], [4, 0, 4], C.skin),
    B([-7, 6, -1], [8, 10, 2], C.skinD),
    // face: hard eyes under brows angled down toward the nose, straight nose, set mouth, strong cheekbones
    ...symH(2, 6, 6, 7, 5, 6, C.skinD),
    ...symH(2, 6, 7, 9, 5, 6, C.scl), ...symH(3, 5, 7, 9, 5, 6, C.iris), ...symH(3, 4, 7, 9, 5, 6, C.eye), ...symH(6, 7, 8, 9, 5, 6, C.eye),
    ...symH(1, 7, 9, 10, 5, 6, C.eye),
    ...symH(1, 5, 9, 11, 6, 8, C.hair, false), ...symH(4, 8, 10, 12, 6, 8, C.hair, false), ...symH(1, 2, 11, 12, 5, 6, C.skinD),   // brows pressed down, furrow
    ...symH(4, 6, 5, 7, 5, 6, C.skinH), ...symH(5, 7, 2, 5, 5, 6, C.skinD),
    B([0, 5, 6], [1, 9, 7], C.skin), B([-1, 4, 6], [2, 5, 7], C.skin), P([-1, 4, 6], [0, 5, 7], C.skinD), P([1, 4, 6], [2, 5, 7], C.skinD),
    P([-2, 2, 5], [3, 3, 6], C.lip), P([-1, 1, 5], [2, 2, 6], C.skinD),
    // wild mane: cap, spiky bangs above the brows, thick sides flaring out, the back (long hair is a chain)
    B([-7, 10, -8], [8, 17, 7], hair), B([-6, 17, -6], [7, 19, 4], hair),
    B([-6, 8, 6], [7, 14, 7], (x, y) => (y >= bang[x] ? hair(x, y, 6) : null)),
    B([-9, 3, -6], [-6, 14, 4], hair), B([7, 3, -6], [10, 14, 4], hair), B([-10, 5, -4], [-9, 12, 1], hair), B([10, 5, -4], [11, 12, 1], hair),
    B([-7, 1, -9], [8, 14, -5], hair),
    B([-3, 17, 3], [0, 20, 7], hair), B([2, 17, 2], [5, 20, 6], hair), B([-6, 18, -3], [-3, 21, 2], hair), B([4, 18, -4], [7, 21, 1], hair),
    // gold tiara: band over the brow, a winged crest at the front carrying the feathers, a red jewel
    B([-8, 12, -8], [9, 13, 8], C.A),
    B([-3, 12, 7], [4, 16, 9], C.A), B([-6, 14, 7], [-3, 17, 8], C.Al), B([4, 14, 7], [7, 17, 8], C.Al),
    B([-1, 13, 9], [2, 15, 10], C.gem), B([-1, 16, 7], [2, 19, 8], C.Al),
  ];
}

// ---------------------------------------------------------------- Sky Piercer 方天畫戟 (weapon joint: shaft +Z)
function weaponGeo() {
  const sv = 0.02;
  const shaft = vox([
    B([-1, -1, -36], [1, 1, 76], (x, y, z) => (((z >> 1) & 1) ? C.shaftH : C.shaft)),
    ...[-33, -12, 16].map((z) => B([-2, -2, z], [2, 2, z + 1], C.A)),
    ...Array.from({ length: 16 }, (_, i) => B([-2, -2, 52 + i], [2, 2, 53 + i], i % 3 === 2 ? C.Ad : C.A)),   // gold wrap under the head
    B([-2, -2, -38], [2, 2, -35], C.A), B([-1, -1, -42], [1, 1, -38], C.Al),
  ], sv, { jitter: 0.04, ao: 0.3 });
  const cv = 0.012;
  const collar = vox([
    B([-3, -3, 118], [3, 3, 124], C.A),
    B([-4, -4, 124], [4, 4, 136], (x, y, z) => ((z + y) % 3 === 0 ? C.Ad : C.A)),
  ], cv, { jitter: 0.05, ao: 0.35 });
  // spear point on the axis, the great crescent on +y (horns forward and back, spurs on its outer edge), a small hook
  // on −y, a red gem in a gold boss where they meet — all flat in X
  const bv = 0.011, boxes = [];
  const z0 = Math.round(1.62 / bv), z1 = Math.round(2.14 / bv);
  for (let z = z0; z < z1; z++) {
    const u = (z - z0) / (z1 - z0);
    const w = Math.max(1, Math.round(4 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.08)), 0.7) * (1 - u * 0.4)));
    boxes.push(B([-1, -w, z], [1, w, z + 1], (_, y) => (Math.abs(y + 0.5) < 1 ? C.steelD : Math.abs(y + 0.5) >= w - 1 ? C.edge : C.steel)));
  }
  const cz = Math.round(1.7 / bv), R = 15, r0 = 10, c = 3 + R;
  for (let dz = -R + 1; dz < R; dz++) {
    const lo = Math.round(c - Math.sqrt(R * R - dz * dz)), hi = Math.round(c - Math.sqrt(Math.max(0, r0 * r0 - dz * dz)));
    if (hi <= lo) continue;
    const spur = md(dz + 20, 7) === 0 && Math.abs(dz) < 11 ? 2 : 0;
    boxes.push(B([-1, lo - spur, cz + dz], [1, hi, cz + dz + 1], (_, y) => (y >= hi - 1 && Math.abs(dz) < r0 ? C.edge : y < lo ? C.steelD : C.steel)));
  }
  for (let dz = -3; dz <= 5; dz++) { const d = Math.round(3 + (dz + 3) * 0.7); boxes.push(B([-1, -3 - d, cz + dz], [1, -3, cz + dz + 1], C.steel)); }   // hook
  boxes.push(B([-2, -4, cz - 3], [2, 4, cz + 4], C.A), B([-3, -2, cz - 1], [3, 2, cz + 2], C.gem), B([-3, -1, cz], [3, 0, cz + 1], C.gemL));
  const blade = vox(boxes, bv, { jitter: 0.03, ao: 0.2 });
  return [{ geo: shaft, mat: 'body' }, { geo: collar, mat: 'metal' }, { geo: blade, mat: 'blade' }];
}

// ---------------------------------------------------------------- spring-chain segments (local -Y along the chain)
function featherSeg(i, n) {
  // long red pheasant feather: quill line, barbs fraying at the edges, darker toward the tip
  const w = i < 2 ? 2 : i < n - 3 ? 4 : i < n - 1 ? 3 : 2, tip = i === n - 1;
  return vox([B([-w, tip ? -10 : -8, 0], [w, 0, 1], (x, y) => {
    if (tip && y < -4 && Math.abs(x + 0.5) > (y + 11) * 0.4) return null;
    if (Math.abs(x + 0.5) >= w - 0.5 && hash01(x, y, i) < 0.45) return null;   // barbs fraying at the edges
    if (x === -1) return C.Rd;                                         // quill
    return i > n - 2 ? C.featherD : x === 0 || x === -2 ? C.featherL : C.feather;
  })], FV, { off: [0, 0, -0.5], jitter: 0.05, ao: 0.15 });
}
function hairSeg(i, n) {
  const w = Math.max(3, Math.round(7 - (i * 3) / (n - 1))), tip = i === n - 1;
  return vox([B([-w, -6, -2], [w, 0, 2], (x, y, z) => {
    if (i >= n - 2 && md(x, 2) === 0 && y < -2) return null;
    if (tip && hash01(x, y, z) < 0.4) return null;
    return md(x * 2 + i + z, 5) === 0 ? C.hairH : C.hair;
  })], FV, { off: [0, 0, -0.5], jitter: 0.05, ao: 0.25 });
}
function capeSeg(i, n) {
  const w = Math.round(14 + i * 1.8), last = i === n - 1;
  return vox([
    B([-w, -14, 0], [w, 0, 1], (x, y) => (last && y < -12 + 3 * hash01(x, i, 3) ? null : last && y < -9 ? C.A : x <= -w + 1 || x >= w - 2 ? C.Rd : md(x + 40, 7) === 0 ? C.Rd : C.R)),
    B([-w + 1, -14, -1], [w - 1, 0, 0], (x, y) => (last && y < -12 + 3 * hash01(x, i, 3) ? null : C.Rd)),
  ], FV, { off: [0, 0, -0.5], jitter: 0.04, ao: 0.18 });
}
function apronSeg(i, n) {
  // long black apron with a gold trident motif and gold edges
  const last = i === n - 1;
  return vox([B([-7, -12, 0], [7, 0, 1], (x, y) => {
    if (x <= -6 || x >= 5 || (last && y <= -10)) return C.A;
    const X = Math.abs(x + 0.5), Y = y + i * 12;
    if (i < 3 && (X < 1 || (X > 2.5 && X < 3.5 && Y > -18) || (Y === -18 && X < 4))) return C.Kg;
    return C.K;
  }), B([-6, -12, -1], [6, 0, 0], C.Kd)], FV, { off: [0, 0, -0.5], jitter: 0.04, ao: 0.2 });
}
function tasselSeg(i, n) {
  const w = i === 0 ? 3 : 2, last = i === n - 1;
  return vox([B([-w, -7, -w], [w, 0, w], (x, y, z) => {
    const h = hash01(x + 9, z + 9, 7);
    if (last && -y > 3 + h * 5) return null;
    if ((x === -w || x === w - 1) && (z === -w || z === w - 1) && i > 0) return null;
    return last && -y > 3 + h * 3 ? C.tasD : h < 0.3 ? C.tasH : h > 0.8 ? C.tasD : C.tas;
  })], 0.014, { jitter: 0.06, ao: 0.25 });
}

// ---------------------------------------------------------------- fighting style
// His own moveset (lubu.moves.js); STYLE keeps the look: crimson crescents, the red dragon, the edge lead and grip of
// the halberd, the charge-hold glow.
const STYLE = {
  trail: { white: [0.98, 0.72, 0.68], blue: [0.9, 0.08, 0.06], hot: [1.6, 1.15, 1.05] },   // weapon trail (vfx.js)
  weight: 1.2,                                                 // impact: camera kick scale (camera.js)
  edgeLead: true, grip: 0.55, charge: [2.2, 0.5, 0.3],
  fx: { proj: [2.2, 0.35, 0.25], core: [2.4, 1.2, 0.8], beam: [2.2, 0.5, 0.3] },
  dragon: { body: [0.55, 0.03, 0.04], scale: [0.85, 0.08, 0.08], belly: [1.0, 0.5, 0.4], fin: [1.5, 0.35, 0.25], whisker: [1.5, 0.5, 0.4] },
  rays: [1.3, 0.4, 0.3],
};

// ---------------------------------------------------------------- HUD portrait (20×20 pixels)
const FACE = [
  '.ff..............ff.',
  '..ff....AAAA....ff..',
  '...ff..AArrAA..ff...',
  '....HHAAAAAAAAHH....',
  '...HHHHHHHHHHHHHH...',
  '..HHHHSHHSHHSHHHHH..',
  '..HHKKKSSSSSSKKKHH..',
  '.HHHSSKKSSSSKKSSHHH.',
  '.HHHSwEISSSSIEwSHHH.',
  '.HHHSSSSSSSSSSSSHHH.',
  '.HHHShSSSsSSSShSHHH.',
  '.HHHSSSSSsSSSSSSHHH.',
  '.HHHsSSSSSSSSSSsHHH.',
  '..HHHsSSSMMSSSsHHH..',
  '..HHH.ssSSSSss.HHH..',
  '..HHH..RRRRRR..HHH..',
  '...KKKKRRRRRRKKKK...',
  '.KKAAAAKRRRRKAAAAKK.',
  'KKAAAAAAKAAKAAAAAAKK',
  'KAAaAAAAAAAAAAAaAAAK',
];
const PAL = { f: '#b02a22', A: '#8c6e36', r: '#d01818', H: '#121014', S: '#e2b28e', s: '#ba8668', h: '#f0c8a6', K: '#1e1c22', E: '#100a0c',
  I: '#3a1a14', w: '#e0d6cc', M: '#a86a58', R: '#8a1e18', a: '#c8a458' };

export default {
  id: 'lubu', zh: '呂布', en: 'LÜ BU', seal: '飛將', weapon: '方天畫戟', role: '無雙 · 霸體',
  sub: '人中呂布 · 飛將無雙 · 天下莫敵', copy: '方天所向<br>天下無雙', tagline: '人中呂布，一戟橫掃千軍',
  cut: { sub: '五原 呂奉先', seal: '飛將' },
  lines: {
    open: ['螻蟻之輩，也敢擋我呂奉先？', 'Insects. You think you can stand in Lü Fengxian\'s way?'],
    musou: ['天下無雙，捨我其誰！', 'Peerless under heaven. Who else but me?'],
  },
  face: FACE, pal: PAL,
  style: STYLE,
  power: 0.88,                // × damage of his whole moveset (hero balance: still the strongest, no longer by 80 %)
  voice: { pitch: 0.84, fk: 0.92, growl: 0.2, gain: 1.1 },   // low, imperious
  moveset: MOVESET,
  build: () => ({ parts: limbs(torso()), head: head(), hv: HV, bv: FV, pauldrons: pauldronBoxes, weapon: weaponGeo() }),
  chains() {
    const out = [];
    out.push({ joint: 'chest', anchor: [0, 0.24, -0.17], rest: [0, -1, 0.15], n: 7, len: 0.18, stiff: 0.16, drag: 0.22, wind: 1.2, cone: 80, sway: 0.22,
      seg: capeSeg, hit: ['chest', 'hips', 'thighL', 'thighR', 'kneeL', 'kneeR'] });
    out.push({ joint: 'hips', anchor: [0, -0.1, 0.17], rest: [0, -1, 0.1], n: 5, len: 0.13, stiff: 0.13, drag: 0.18, wind: 0.5, face: [0, 0, 1], cone: 70, sway: 0.1,
      seg: apronSeg, hit: [['thighL', 0.04], ['thighR', 0.04], ['kneeL', 0.04], ['kneeR', 0.04]] });
    out.push({ joint: 'head', anchor: [0, 10 * HV, -8 * HV], rest: [0, -1, -0.3], n: 6, len: 0.07, stiff: 0.1, drag: 0.14, wind: 1.5, cone: 85, sway: 0.35,
      seg: hairSeg, hit: ['head', ['chest', 0.05]] });
    // 雉雞翎: two very long feathers rising from the crest, arcing out and back
    for (const sx of [-1, 1]) {
      out.push({ joint: 'head', anchor: [sx * 2 * HV, 18 * HV, 7.5 * HV], rest: [sx * 0.5, 0.85, -0.85], n: 11, len: 0.105, stiff: 0.16, drag: 0.1, grav: 0.7, wind: 0.9, cone: 55, sway: 0.28,
        face: [0, 0, 1], seg: featherSeg });
    }
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566, ox = Math.cos(a) * 0.016, oy = Math.sin(a) * 0.016;
      out.push({ joint: 'weapon', anchor: [ox, oy, 1.41], rest: [ox * 12, oy * 4 - 1, -0.35], n: 3, len: 0.07, stiff: 0.05 + k * 0.004, drag: 0.12, wind: 0.8, cone: 130, sway: 0.15,
        face: [1, 0, 0], seg: tasselSeg });
    }
    return out;
  },
};
