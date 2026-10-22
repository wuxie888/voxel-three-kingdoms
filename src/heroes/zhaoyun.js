// 趙雲 Zhao Yun (after the DW9 design): young, clean-cut face under messy dark bangs, a silver headband with a blue gem
// and trailing ties, a long ponytail; teal robe under engraved silver armour — scrolled breastplate, a pair of big
// swept pauldrons, tassets, diamond knee guards and greaves; a torn teal robe tail behind. Weapon: the silver spear
// with the gold dragon collar and a blue tassel.
import { vox, B, P, md, mirX, lamellar } from '../hero/model.js';
import { hash01 } from '../core/rng.js';
import { shade } from '../core/voxel.js';
import { FV, glove, bracer, bootFoot, symH } from './parts.js';

const HV = 0.0135;
const C = {
  T: 0x2a6a68, Td: 0x1a4644, Tl: 0x3c8a86,                                  // teal robe
  S: 0x6e747e, Sd: 0x3a3f46, Sl: 0xa4aab4,                                  // engraved silver
  L: 0x4a3226, Ld: 0x2e1f18, U: 0x26282e, pants: 0x5a6068, pantsD: 0x40444c,
  skin: 0xf0c6a4, skinD: 0xd09a7c, skinH: 0xfad8bc, lip: 0xc4806c, eye: 0x160f12, iris: 0x4a2e22, scl: 0xe8e0d8,
  hair: 0x221a18, hairH: 0x3e302a,
  gem: 0x3a6ad8, gemL: 0x8ab4ff,
  shaft: 0x2a2c34, shaftH: 0x3c3e48, band: 0x8a909c, gold: 0xd4a84c,
  blue: 0x3a5ad0, blueH: 0x8aa8ff, blueD: 0x22348a,
};
const teal = (x, y, z) => (md(x * 2 + y + z, 16) === 0 && hash01(x, y, z) < 0.5 ? C.Tl : md(x + z * 3, 11) === 0 ? C.Td : C.T);
// silver with a symmetric engraved cloud-scroll: thin dark grooves mirrored about the centre line, soft highlights
const silver = (x, y, z) => (md(x * 5 + y * 3 + z * 7, 23) === 0 ? C.Sl : C.S);   // plain plate, a few glints; structure comes from the parts

// ---------------------------------------------------------------- body parts (fine voxels, centred on the joints)
function torso() {
  const P_ = {};
  P_.hips = [
    B([-12, -10, -8], [12, 6, 8], C.U),
    B([-14, -12, -10], [14, -2, 10], teal),
    B([-15, -2, -11], [15, 6, 11], (x, y) => (y === -2 || y === 5 ? C.Ld : C.L)),
    B([-4, -2, 11], [4, 6, 13], C.S), B([-3, -1, 13], [3, 5, 14], C.Sl), P([-1, 1, 13], [1, 3, 14], C.gem),   // buckle
  ];
  P_.spine = [
    B([-10, -6, -8], [10, 16, 8], C.U),
    B([-12, -4, -10], [12, 16, 10], teal),
    ...lamellar([-10, -2, 10], [10, 14, 12], { base: C.S, rowH: 3, pw: 6, lipX: false, lipZ: false }),   // belly plates
  ];
  // chest: teal robe, a sculpted silver breastplate (two pectoral plates, centre ridge, scroll engraving, blue gem),
  // silver back plate, high teal collar
  P_.chest = [
    B([-13, -4, -10], [13, 18, 10], C.U),
    B([-14, -4, -11], [14, 8, 11], teal), B([-16, 8, -12], [16, 20, 12], teal),
    B([-13, 0, 12], [13, 19, 13], silver),
    // two pectoral plates with bright rims and a dark groove inside the rim, a raised centre ridge
    ...[[-12, -1], [1, 12]].flatMap(([a, b]) => [
      B([a, 6, 13], [b, 18, 15], silver),
      P([a, 17, 14], [b, 18, 15], C.Sl), P([a, 6, 14], [b, 7, 15], C.Sl),
      P([a + 1, 16, 14], [b - 1, 17, 15], C.Sd), P([a + 1, 7, 14], [b - 1, 8, 15], C.Sd),
    ]),
    B([-1, 2, 13], [1, 18, 16], C.Sl),
    // teal cloud-scroll inlay on each pectoral (mirrored) and the blue gem at the centre
    ...[1, -1].flatMap((sx) => [[3, 11], [4, 12], [5, 13], [6, 13], [7, 12], [7, 11], [6, 10], [5, 10], [8, 10], [9, 11]].map(([x, y]) =>
      P(sx > 0 ? [x, y, 14] : [-x - 1, y, 14], sx > 0 ? [x + 1, y + 1, 15] : [-x, y + 1, 15], C.Tl))),
    B([-2, 10, 16], [2, 14, 17], C.Sl), P([-1, 11, 16], [1, 13, 17], C.gem),
    P([-13, 0, 12], [13, 1, 13], C.Sd),
    B([-12, 2, -14], [12, 18, -12], silver),
    B([-8, 16, -8], [8, 23, 8], teal), P([-8, 22, -8], [8, 23, 8], C.S),   // high collar with a silver rim
    B([-6, 16, -6], [6, 26, 6], -1),
  ];
  P_.neck = [B([-4, -2, -4], [4, 6, 4], C.skinD), P([-4, 2, 3], [4, 6, 4], C.skin)];
  return P_;
}

function limbs(P_) {
  for (const [s, sx] of [['R', -1], ['L', 1]]) {
    P_['upperArm' + s] = [B([-5, -24, -5], [5, 2, 5], teal), B([-6, -24, -6], [6, -20, 6], C.Td)];
    P_['foreArm' + s] = bracer(C.T, [C.S, C.Sd, C.Sl]);
    P_['hand' + s] = glove(sx, C.L, C.Ld);
    // grey trousers under silver tassets that flare over the front and outside of the thigh
    P_['thigh' + s] = [
      B([-7, -36, -7], [7, 2, 7], (x, y) => (md(y, 6) === 0 ? C.pantsD : C.pants)),
      ...lamellar([-6, -16, -9], [10, 4, 9], { base: C.S, rowH: 4, pw: 6, trim: C.T }).map((b) => mirX(b, sx)),
    ];
    // greave with an arrow motif, diamond knee guard
    P_['shin' + s] = [
      B([-5, -34, -5], [5, 0, 5], C.pantsD),
      B([-6, -32, 0], [6, -5, 7], (x, y) => (Math.abs(x + 0.5) < 1 + (-5 - y) * 0.12 && y > -22 && y < -8 ? C.T : silver(x, y, 7))),
      B([-6, -34, -6], [6, -31, 6], C.S),
      B([-6, -5, 3], [6, 7, 9], (x, y) => (Math.abs(x + 0.5) + Math.abs(y - 1) < 7 ? (Math.abs(x + 0.5) + Math.abs(y - 1) > 5 ? C.Sl : silver(x, y, 9)) : null)),
    ];
    P_['foot' + s] = bootFoot(C.Sd, shade(C.Sd, 0.7), C.Ld, { trim: C.S });
  }
  return P_;
}

/** Big swept silver pauldron: three engraved tiers flaring out and down, teal lining, an upturned wing at the top. */
function pauldronBoxes(sx) {
  const b = [
    B([-6, 4, -10], [6, 8, 10], silver),
    B([-2, 0, -12], [9, 5, 12], silver), P([-2, 0, -12], [9, 1, 12], C.Sd),
    B([1, -6, -12], [12, 0, 12], silver), P([1, -6, -12], [12, -5, 12], C.T), P([11, -6, -12], [12, 0, 12], C.Sl),
    B([5, 6, -9], [9, 10, 9], C.S), B([8, 9, -8], [11, 13, 8], C.Sl), B([10, 12, -6], [12, 14, 6], C.S),   // swept wing
  ];
  return b.map((bx) => mirX(bx, sx));
}

// ---------------------------------------------------------------- head (head voxels, chin y 0)
function head() {
  const hair = (x, y, z) => (md(x * 3 + z + y, 5) === 0 ? C.hairH : C.hair);
  // messy bangs: uneven lengths per column, one lock falling over the left eye
  const bang = { '-6': 10, '-5': 12, '-4': 11, '-3': 12, '-2': 11, '-1': 12, 0: 10, 1: 12, 2: 11, 3: 12, 4: 11, 5: 12, 6: 10 };   // above the brows; spikes between
  return [
    B([-6, 2, -6], [7, 13, 6], C.skin),
    B([-5, 0, -5], [6, 2, 5], C.skin), B([-3, -1, -2], [4, 0, 4], C.skin),   // slim V jaw
    B([-7, 6, -1], [8, 10, 2], C.skinD),
    // face: clear eyes (two-voxel iris), brows slightly raised at the outer ends, straight nose, a closed mouth
    ...symH(2, 6, 6, 7, 5, 6, C.skinD),                                // lower lid
    ...symH(2, 6, 7, 9, 5, 6, C.scl), ...symH(3, 5, 7, 9, 5, 6, C.iris), ...symH(3, 4, 8, 9, 5, 6, C.eye), ...symH(6, 7, 8, 9, 5, 6, C.eye),
    ...symH(1, 7, 9, 10, 5, 6, C.eye),                                 // upper lid / lashes
    ...symH(1, 5, 10, 11, 5, 7, C.hair, false), ...symH(4, 7, 11, 12, 5, 7, C.hair, false),
    ...symH(4, 6, 5, 7, 5, 6, C.skinH),
    B([0, 5, 6], [1, 9, 7], C.skin), B([-1, 4, 6], [2, 5, 7], C.skin), P([-1, 4, 6], [0, 5, 7], C.skinD), P([1, 4, 6], [2, 5, 7], C.skinD),
    P([-1, 2, 5], [2, 3, 6], C.lip), P([0, 1, 5], [1, 2, 6], C.skinD),
    // hair: cap, back, long side locks, spiky bangs
    B([-7, 10, -7], [8, 16, 7], hair), B([-6, 16, -6], [7, 17, 5], hair),
    B([-7, 2, -7], [8, 13, -3], hair),
    B([-8, 2, -3], [-6, 12, 4], hair), B([7, 2, -3], [9, 12, 4], hair),
    B([-6, 8, 6], [7, 14, 7], (x, y) => (y >= bang[x] ? hair(x, y, 6) : null)),
    B([-4, 13, 5], [5, 17, 8], hair), B([-2, 16, 3], [1, 18, 7], hair), B([2, 16, -2], [5, 18, 3], hair), B([-5, 16, -4], [-2, 18, 1], hair),
    B([-7, 4, 5], [-6, 10, 7], hair), B([7, 4, 5], [8, 10, 7], hair),   // front locks framing the face
    // silver headband with the blue gem plate at the brow
    B([-8, 12, -8], [9, 13, 8], C.S),
    B([-2, 11, 7], [3, 14, 8], C.Sl), P([-1, 12, 7], [2, 13, 8], C.gem), B([0, 12, 8], [1, 13, 9], C.gemL),
  ];
}

// ---------------------------------------------------------------- spear (weapon joint: shaft +Z, origin = rear grip)
function spearGeo() {
  // shaft + butt at 0.02: banded dark iron, butt spike (z −0.72 … 1.5)
  const sv = 0.02;
  const shaft = vox([
    B([-1, -1, -36], [1, 1, 75], (x, y, z) => (((z + 36) % 15) === 0 ? C.band : ((z >> 1) & 1) ? C.shaftH : C.shaft)),
    ...Array.from({ length: 7 }, (_, i) => B([-2, -2, -33 + i * 15], [2, 2, -32 + i * 15], C.band)),
    B([-2, -2, -38], [2, 2, -35], C.S),
    B([-1, -1, -41], [1, 1, -38], C.S),
  ], sv, { jitter: 0.04, ao: 0.3 });
  // gold dragon-head collar at 0.012 (z 1.44 … 1.62): ring, head, jaws, swept-back horns, teal eyes, whiskers
  const cv = 0.012;
  const collar = vox([
    B([-3, -3, 120], [3, 3, 123], C.gold),
    B([-4, -3, 123], [4, 4, 130], (x, y, z) => ((z + y) % 3 === 0 ? shade(C.gold, 0.8) : C.gold)),
    B([-3, 1, 130], [3, 4, 135], C.gold),                            // upper jaw
    B([-3, -3, 130], [3, -1, 133], shade(C.gold, 0.85)),             // lower jaw
    B([-3, 4, 121], [-1, 6, 126], C.gold), B([1, 4, 121], [3, 6, 126], C.gold),
    B([-3, 5, 117], [-1, 7, 121], shade(C.gold, 0.9)), B([1, 5, 117], [3, 7, 121], shade(C.gold, 0.9)),
    B([-5, 1, 127], [-4, 3, 129], C.Tl), B([4, 1, 127], [5, 3, 129], C.Tl),
    B([-6, 0, 131], [-3, 1, 132], C.gold), B([3, 0, 131], [6, 1, 132], C.gold),
    // bushy blue tassel root ring under the collar
    B([-4, -4, 116], [4, 4, 120], (x, y, z) => (hash01(x, y, z) < 0.25 ? null : hash01(y, z, x) < 0.3 ? C.blueH : C.blue)),
  ], cv, { jitter: 0.05, ao: 0.35 });
  return [shaft, collar];
}

function bladeGeo() {
  // long leaf blade, flat in Y: widest a third of the way up, darker fuller down the middle, bright edges
  const bv = 0.011, z0 = Math.round(1.6 / bv), z1 = Math.round(2.0 / bv), len = z1 - z0;
  const boxes = [];
  for (let z = z0; z < z1; z++) {
    const u = (z - z0) / len;
    const w = Math.max(1, Math.round(7 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.1)), 0.75) * (1 - u * 0.3)));
    boxes.push(B([-w, -1, z], [w, 1, z + 1], (x) => (Math.abs(x + 0.5) < 1 ? 0x8f9aa8 : Math.abs(x + 0.5) >= w - 1 ? 0xf6fbff : 0xd8e2ec)));
  }
  return vox(boxes, bv, { jitter: 0.03, ao: 0.2 });
}

function weaponGeo() {
  const [shaft, collar] = spearGeo();
  return [{ geo: shaft, mat: 'body' }, { geo: collar, mat: 'metal' }, { geo: bladeGeo(), mat: 'blade' }];
}

// ---------------------------------------------------------------- spring-chain segments (local -Y along the chain)
function hairSeg(i, n) {
  const w = Math.max(2, Math.round(5 - (i * 3) / (n - 1))), tip = i === n - 1;
  return vox([B([-w, tip ? -8 : -6, -w], [w, 0, w], (x, y, z) => {
    const edge = x === -w || x === w - 1 || z === -w || z === w - 1;
    if (edge && hash01(x + i * 11, y + 50, z) < 0.3) return null;
    if (tip && y < -4 && hash01(x, z, i) < 0.5 + (-4 - y) * 0.12) return null;
    return md(x * 2 + z + 40, 5) === 0 ? C.hairH : C.hair;
  })], FV, { jitter: 0.06, ao: 0.3 });
}
function tieSeg(i, n) {
  const tip = i === n - 1;
  return vox([B([-2, -8, 0], [2, 0, 1], (x, y) => (tip && y <= -7 && (x === -1 || x === 0) ? null : x === -2 ? C.Sd : C.S))],
    0.011, { off: [0, 0, -0.5], jitter: 0.03, ao: 0.15 });
}
/** Torn teal robe tail: embroidered face, darker lining, ragged hem that tears deeper toward the end. */
function tailSeg(i, n) {
  const w = Math.round(12 + i * 1.5), last = i === n - 1;
  return vox([
    B([-w, -12, 0], [w, 0, 1], (x, y) => {
      if (i >= n - 2 && y < -12 + (last ? 8 : 3) * hash01(x, i, 5)) return null;
      return x <= -w + 1 || x >= w - 2 ? C.S : teal(x, y + i * 12, 2);
    }),
    B([-w + 1, -12, -1], [w - 1, 0, 0], (x, y) => (i >= n - 2 && y < -12 + (last ? 8 : 3) * hash01(x, i, 5) ? null : C.Td)),
  ], FV, { off: [0, 0, -0.5], jitter: 0.04, ao: 0.18 });
}
function apronSeg(i, n) {
  const last = i === n - 1;
  return vox([B([-9, -12, 0], [9, 0, 1], (x, y) => (last && y <= -10 ? C.S : x <= -8 || x >= 7 ? C.S : teal(x, y + i * 12, 4))),
    B([-8, -12, -1], [8, 0, 0], C.Td)], FV, { off: [0, 0, -0.5], jitter: 0.04, ao: 0.2 });
}
function tasselSeg(i, n) {
  // silk strands: every (x,z) column is one strand with its own shade; the last segment frays to uneven lengths
  const w = i === 0 ? 3 : 2, last = i === n - 1;
  return vox([B([-w, -7, -w], [w, 0, w], (x, y, z) => {
    const h = hash01(x + 9, z + 9, 7);
    if (last && -y > 3 + h * 5) return null;
    if ((x === -w || x === w - 1) && (z === -w || z === w - 1) && i > 0) return null;
    return last && -y > 3 + h * 3 ? C.blueD : h < 0.3 ? C.blueH : h > 0.8 ? C.blueD : C.blue;
  })], 0.014, { jitter: 0.06, ao: 0.25 });
}




// ---------------------------------------------------------------- HUD portrait (20×20 pixels)
const FACE = [
  '......KKKKKKK.......',
  '....KKKKKKKKKKK.....',
  '...KKKkKKKKkKKKK....',
  '...KKKKKKKKKKKKKK...',
  '..KKSSSSSSGSSSSSSKK.',
  '..KKSSSSSGgGSSSSSKK.',
  '..KKKSKKSKSKKSKSKKK.',
  '..KKSKKKSSSSKKKSSKK.',
  '..KKSSSSSSSSSSSSSKK.',
  '..KKSwEISSSSIEwSSKK.',
  '..KKSSSSSSSSSSSSSKK.',
  '..KKSShSSsSSSShSSKK.',
  '...KSSSSSsSSSSSSKK..',
  '...KsSSSSSSSSSSsKK..',
  '....sSSSSMMSSSSs.K..',
  '.....ssSSSSSSss..K..',
  '...TTTTssssssTTTT...',
  '.TTWWWTTTttTTTWWWTT.',
  'TTWWwWWTTttTTWWwWWTT',
  'TWWWWWWWTttTWWWWWWWT',
];
const PAL = { K: '#221a18', k: '#3e302a', S: '#f0c6a4', s: '#d09a7c', h: '#fad8bc', G: '#b4b8c0', g: '#3a6ad8', E: '#160f12', I: '#4a2e22',
  w: '#e8e0d8', M: '#b06a58', T: '#2a6a68', t: '#1a4644', W: '#9aa0aa' };

export default {
  id: 'zhaoyun', zh: '趙雲', en: 'ZHAO YUN', seal: '常山', weapon: '龍膽亮銀槍', role: '槍術 · 迅捷',
  power: 1.4,                 // × damage of his whole moveset (hero balance: single-target DPS ≈ 45-56 across the five)
  style: { armor: 'heavy' },  // the shared spear set as authored; from N3 on his string holds through grunt blows like the others'
  sub: '常山龍膽 · 單騎無雙 · 義貫雲天', copy: '長槍所向<br>百軍皆破', tagline: '一杆長槍，獨闖魏軍三百',
  cut: { sub: '常山 趙子龍', seal: '龍膽' },
  lines: {
    open: ['主公之子在此，趙雲誓死護之！', 'My lord\'s son is in my care. None of you shall pass!'],
    musou: ['吾乃常山趙子龍也！', 'I am Zhao Zilong of Changshan!'],
  },
  face: FACE, pal: PAL,
  build: () => ({ parts: limbs(torso()), head: head(), hv: HV, bv: FV, pauldrons: pauldronBoxes, weapon: weaponGeo() }),
  chains() {
    const out = [];
    out.push({ joint: 'hips', anchor: [0, -0.1, -0.15], rest: [0, -1, -0.14], n: 6, len: 0.13, stiff: 0.14, drag: 0.2, wind: 1.1, cone: 75, sway: 0.2,
      seg: tailSeg, hit: ['hips', ['thighL', 0.02], ['thighR', 0.02], ['kneeL', 0.03], ['kneeR', 0.03]] });
    out.push({ joint: 'hips', anchor: [0, -0.12, 0.17], rest: [0, -1, 0.1], n: 3, len: 0.13, stiff: 0.13, drag: 0.18, wind: 0.5, face: [0, 0, 1], cone: 70, sway: 0.1,
      seg: apronSeg, hit: [['thighL', 0.03], ['thighR', 0.03], ['kneeL', 0.03], ['kneeR', 0.03]] });
    out.push({ joint: 'head', anchor: [0, 15 * HV, -6 * HV], rest: [0, -0.9, -0.45], n: 8, len: 0.07, stiff: 0.09, drag: 0.13, wind: 1.6, cone: 115, sway: 0.4,
      seg: hairSeg, hit: ['head', ['chest', 0.04], ['hips', 0.03]] });
    for (const sx of [-1, 1]) {
      out.push({ joint: 'head', anchor: [sx * 2.5 * HV, 12.5 * HV, -8.5 * HV], rest: [sx * 0.35, -0.5, -1], n: 5, len: 0.09, stiff: 0.03, drag: 0.06, wind: 2.4, cone: 105, sway: 0.6,
        seg: tieSeg, hit: ['head', ['chest', 0.02]] });
    }
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566, ox = Math.cos(a) * 0.016, oy = Math.sin(a) * 0.016;
      out.push({ joint: 'weapon', anchor: [ox, oy, 1.43], rest: [ox * 12, oy * 4 - 1, -0.35], n: 3, len: 0.064, stiff: 0.05 + k * 0.004, drag: 0.12, wind: 0.8, cone: 130, sway: 0.15,
        face: [1, 0, 0], seg: tasselSeg });
    }
    return out;
  },
};
