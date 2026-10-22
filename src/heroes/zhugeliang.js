// 諸葛亮 Zhuge Liang (after the DW9 design): a tall white pleated scholar's hat with a gold band and jewel, long black
// hair to the shoulders, a calm, sharp face with a thin moustache and a pointed goatee. White robe over a black
// under-robe, green-and-gold trim on the collar and gold studs on the shoulders, wide sleeves lined in green, a purple
// sash with a gold-fringed panel, a green cloud-scroll apron, grey trousers gathered at the ankle, grey boots, and a
// long white overcoat tail with a taiji and gold cloud embroidery. Weapon: the feather fan — gold-mounted handle,
// white and green feathers; while he attacks it conjures a translucent wind blade along the line the rig's polearm
// takes, so the shared moveset, hit shapes and trails line up with what is drawn.
import * as THREE from 'three';
import { vox, B, P, md, mirX } from '../hero/model.js';
import { hash01 } from '../core/rng.js';
import * as MOVESET from './zhugeliang.moves.js';
import { FV, hand, symH } from './parts.js';

const HV = 0.0135;
const C = {
  W: 0xd8d4ca, Wd: 0xaea99e, Wl: 0xece8e0,                                  // white robe (kept under the bloom knee)
  K: 0x1c1c22, Kl: 0x34343c,
  G: 0x3a7a4a, Gd: 0x245034, Gl: 0x56a068,                                  // green trim
  A: 0xb89648, Ad: 0x7a6230, Al: 0xdcc070,                                  // gold
  purple: 0x4a3a7a, purpleD: 0x30264e,
  grey: 0x9a9a9c, greyD: 0x707074, boot: 0x6e6e72, bootD: 0x4c4c50, sole: 0x2a2a2c,
  skin: 0xecc6a4, skinD: 0xc89a7c, skinH: 0xf8d8bc, lip: 0xb87c6a, eye: 0x120c10, iris: 0x2a2030, scl: 0xe0d8d0,
  hair: 0x141216, hairH: 0x2e2a32,
  wood: 0x2a1c16, featherW: 0xe6e4de, featherG: 0x4a8a5a, featherGd: 0x2c5a3a,
  wind: 0x9fe8ff, windH: 0xffffff, windD: 0x3fa8e0,
};
const robe = (x, y, z) => (md(x * 2 + y, 13) === 0 ? C.Wd : md(x + z * 3, 17) === 0 ? C.Wl : C.W);

// ---------------------------------------------------------------- body parts (fine voxels, centred on the joints)
function torso() {
  const P_ = {};
  // hips: purple sash, the gold-fringed front panel, robe below
  P_.hips = [
    B([-11, -10, -8], [11, 6, 8], C.K),
    B([-13, -12, -10], [13, -2, 10], robe),
    B([-14, -2, -11], [14, 5, 11], (x, y) => (y === -2 || y === 4 ? C.purpleD : C.purple)),
    B([-10, 0, 11], [-5, 4, 13], C.purple),                           // sash knot
    B([-5, -8, 11], [5, -1, 12], (x, y) => (y === -8 ? (md(x, 2) ? C.Al : null) : y === -7 ? C.A : C.K)),   // fringed panel
  ];
  P_.spine = [
    B([-9, -6, -7], [9, 16, 7], C.K),
    B([-11, -4, -9], [11, 16, 9], robe),
    B([-3, -4, 9], [3, 16, 10], C.K),                                 // black under-robe in the front opening
  ];
  // chest: slim — white robe with a V opening showing the black under-robe, green-and-gold collar trim, gold studs
  const vHalf = (y) => 2 + (y + 4) * 0.25;
  P_.chest = [
    B([-12, -4, -9], [12, 18, 9], C.K),
    B([-13, -4, -10], [13, 20, 10], robe),
    B([-13, -4, 10], [13, 21, 11], (x, y) => {
      const d = Math.abs(x + 0.5) - vHalf(y);
      return d < 0 ? C.K : d < 1.5 ? C.G : d < 2.2 ? C.A : null;
    }),
    B([-8, 16, -8], [8, 23, 8], C.K), P([-8, 22, -8], [8, 23, 8], C.G),   // high black collar, green rim
    ...[-11, -8, 7, 10].map((x) => B([x, 18, -3], [x + 2, 21, 3], C.Al)),   // gold studs along the shoulder line
    B([-6, 16, -6], [6, 26, 6], -1),
  ];
  P_.neck = [B([-4, -2, -4], [4, 6, 4], C.skinD), P([-4, 2, 3], [4, 6, 4], C.skin)];
  return P_;
}

function limbs(P_) {
  for (const [s, sx] of [['R', -1], ['L', 1]]) {
    P_['upperArm' + s] = [B([-5, -24, -5], [5, 2, 5], robe)];
    // wide sleeve: flares toward the wrist, green lining and a gold edge at the opening; black-embroidered cuff
    P_['foreArm' + s] = [
      B([-5, -18, -5], [5, 2, 5], robe),
      B([-7, -22, -7], [7, -10, 7], robe),
      B([-8, -24, -8], [8, -20, 8], C.G), P([-8, -24, -8], [8, -23, 8], C.A),
      B([-4, -24, -4], [4, -18, 4], C.K),
    ];
    P_['hand' + s] = hand(sx, C.skin, C.skinD);
    // loose grey trousers
    P_['thigh' + s] = [
      B([-8, -36, -8], [8, 2, 8], (x, y, z) => (md(y + (x & 1), 8) === 0 ? C.greyD : C.grey)),
      B([-9, -32, -9], [9, -18, 9], (x, y) => (md(y + x, 6) === 0 ? C.greyD : C.grey)),
    ];
    // trousers gathered at the ankle over tall grey boots
    P_['shin' + s] = [
      B([-5, -34, -5], [5, 0, 5], C.boot),
      B([-8, -14, -8], [8, 2, 8], (x, y) => (md(y + x, 5) === 0 ? C.greyD : C.grey)),
      B([-7, -15, -7], [7, -13, 7], C.greyD),
    ];
    P_['foot' + s] = [
      B([-6, -6, -4], [6, 2, 12], C.boot),
      B([-5, -6, 12], [5, -1, 16], C.boot), B([-3, -6, 16], [3, -3, 18], C.A),   // gold toe cap
      P([-6, -6, -4], [6, -5, 18], C.sole), P([-6, 1, -4], [6, 2, 12], C.bootD),
    ];
  }
  return P_;
}

// ---------------------------------------------------------------- head (head voxels, chin y 0)
function head() {
  const hair = (x, y, z) => (md(x * 3 + z + y, 5) === 0 ? C.hairH : C.hair);
  // tall pleated hat: vertical pleats (shaded every 3rd column), widening slightly to the top, a gold band with a
  // jewel at the front
  const hat = (x, y, z) => { const k = Math.round(Math.atan2(z, x + 0.5) * 7); return md(k, 4) === 0 ? C.A : md(k, 2) === 0 ? C.Wd : y > 24 ? C.Wl : C.W; };
  return [
    B([-6, 2, -6], [7, 13, 6], C.skin),
    B([-5, 0, -5], [6, 2, 5], C.skin), B([-3, -1, -2], [4, 0, 4], C.skin),
    B([-7, 6, -1], [8, 10, 2], C.skinD),
    // face: narrow, level eyes (a calm, knowing look), long straight brows, fine nose, thin moustache, pointed goatee
    ...symH(2, 6, 6, 7, 5, 6, C.skinD),
    ...symH(2, 6, 7, 9, 5, 6, C.scl), ...symH(3, 5, 7, 9, 5, 6, C.iris), ...symH(3, 4, 7, 9, 5, 6, C.eye), ...symH(6, 7, 8, 9, 5, 6, C.eye),
    ...symH(1, 7, 9, 10, 5, 6, C.eye),
    ...symH(1, 7, 11, 12, 5, 7, C.hair, false),
    ...symH(4, 6, 5, 7, 5, 6, C.skinH),
    B([0, 5, 6], [1, 9, 7], C.skin), B([-1, 4, 6], [2, 5, 7], C.skin), P([-1, 4, 6], [0, 5, 7], C.skinD), P([1, 4, 6], [2, 5, 7], C.skinD),
    P([-1, 2, 5], [2, 3, 6], C.lip),
    P([-3, 3, 5], [4, 4, 6], C.hair), P([-4, 2, 5], [-3, 3, 6], C.hair), P([4, 2, 5], [5, 3, 6], C.hair),   // moustache
    B([-1, -5, 3], [2, 1, 6], C.hair), B([0, -8, 3], [1, -5, 5], C.hairH),   // goatee
    // hair: parted at the centre, swept back under the hat, long at the sides and back (the rest is a chain)
    B([-7, 9, -7], [8, 15, 4], hair), B([-7, 12, 4], [8, 15, 6], hair),
    B([-6, 13, 6], [7, 15, 7], (x, y) => (Math.abs(x) < 1 && y < 14 ? null : hair(x, y, 6))),   // hairline, centre part
    B([-8, 1, -4], [-6, 12, 4], hair), B([7, 1, -4], [9, 12, 4], hair),
    B([-7, 0, -8], [8, 13, -4], hair),
    // hat
    B([-6, 14, -6], [7, 27, 6], hat), B([-7, 22, -7], [8, 28, 7], hat), P([-7, 27, -7], [8, 28, 7], C.Wl),
    B([-7, 14, -7], [8, 17, 7], (x, y) => (y === 15 ? C.Al : C.A)),
    B([-2, 14, 7], [3, 18, 8], C.A), B([-1, 15, 8], [2, 17, 9], C.G), B([0, 15, 9], [1, 17, 10], C.Gl),
  ];
}

// ---------------------------------------------------------------- feather fan + wind blade (weapon joint: +Z)
function weaponGeo() {
  // fan in the shaft's YZ plane: dark handle with gold mounts, a gold boss, then a fan of green feathers under long
  // white feathers, each with a dark quill
  const fv = 0.012, fan = [];
  fan.push(B([-1, -1, -10], [1, 1, 10], C.wood), B([-2, -2, 8], [2, 2, 12], C.A), B([-2, -2, -12], [2, 2, -9], C.A), B([-2, -2, 0], [2, 2, 1], C.A));
  fan.push(B([-2, -5, 11], [2, 5, 15], (x, y) => (md(y, 2) ? C.Al : C.A)));
  for (let z = 14; z < 50; z++) {
    const u = (z - 14) / 36, w = Math.round(4 + 13 * Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.6) * (u > 0.82 ? 1 - (u - 0.82) * 3 : 1));
    fan.push(B([-1, -w, z], [1, w, z + 1], (_, y) => {
      const k = Math.floor((y + 40) / 3);                              // feather index
      if (z >= 44 && md(y + 40, 3) === 0) return null;                  // separated tips
      if (md(y + 40, 3) === 1 && u > 0.1) return u < 0.45 ? C.featherGd : C.Wd;   // quills
      if (u < 0.45) return md(k, 2) ? C.featherG : C.featherGd;
      return md(k, 2) ? C.featherW : C.Wl;
    }));
  }
  const fanGeo = vox(fan, fv, { jitter: 0.04, ao: 0.2 });
  const bv = 0.016, wb = [];
  const z0 = Math.round(0.62 / bv), z1 = Math.round(2.02 / bv);
  for (let z = z0; z < z1; z++) {
    const u = (z - z0) / (z1 - z0), cy = Math.round(4 * Math.sin(u * Math.PI));
    const w = Math.max(1, Math.round(1 + 5 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - u * 0.5)));
    wb.push(B([0, cy - w, z], [1, cy + w, z + 1], (_, y) => (Math.abs(y - cy + 0.5) < 1 ? C.windH : Math.abs(y - cy + 0.5) >= w - 1 ? C.windD : C.wind)));
  }
  const windMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const wind = vox(wb, bv, { off: [-0.5, 0, 0], jitter: 0, ao: 0 });
  return [{ geo: fanGeo, mat: 'body' }, { geo: wind, mat: windMat }];
}

// ---------------------------------------------------------------- spring-chain segments (local -Y along the chain)
/** Long white overcoat tail: green-and-gold edges, a taiji on the second segment, gold cloud scrolls lower down. */
function coatSeg(i, n) {
  const w = Math.round(13 + i * 1.6), last = i === n - 1;
  return vox([
    B([-w, -14, 0], [w, 0, 1], (x, y) => {
      if (x <= -w + 1 || x >= w - 2) return x === -w || x === w - 1 ? C.A : C.G;
      if (last && y <= -12) return y === -14 ? C.A : C.G;
      if (i === 1) {                                                   // taiji
        const dx = x + 0.5, dy = y + 7, r = Math.hypot(dx, dy);
        if (r < 5.5) {
          if (r > 4.6) return C.K;
          const top = Math.hypot(dx, dy - 2.3) < 2.3, bot = Math.hypot(dx, dy + 2.3) < 2.3;
          const dark = top ? false : bot ? true : dx > 0;
          if (Math.hypot(dx, dy - 2.3) < 0.8) return C.K;
          if (Math.hypot(dx, dy + 2.3) < 0.8) return C.Wl;
          return dark ? C.K : C.Wl;
        }
      }
      if (i >= 3 && Math.abs(Math.sin(x * 0.5 + y * 0.35 + i) * 5 - (y + 7)) < 0.8 && x > 2) return C.A;   // cloud scroll
      return robe(x, y + i * 14, 1);
    }),
    B([-w + 1, -14, -1], [w - 1, 0, 0], C.G),
  ], FV, { off: [0, 0, -0.5], jitter: 0.03, ao: 0.18 });
}
function apronSeg(i, n) {
  // green apron with a gold cloud-scroll band and a black hem
  const last = i === n - 1;
  return vox([B([-8, -12, 0], [8, 0, 1], (x, y) => {
    if (last && y <= -10) return C.K;
    if (x <= -7 || x >= 6) return C.A;
    if (i === 0 && Math.abs(Math.sin((x + 0.5) * 0.7) * 2 - (y + 6)) < 0.7) return C.Al;
    return i === 0 ? C.G : C.Gd;
  }), B([-7, -12, -1], [7, 0, 0], C.K)], FV, { off: [0, 0, -0.5], jitter: 0.04, ao: 0.2 });
}
function hairSeg(i, n) {
  const w = Math.max(3, Math.round(7 - (i * 2) / (n - 1))), tip = i === n - 1;
  return vox([B([-w, -6, -1], [w, 0, 1], (x, y, z) => {
    if (tip && md(x, 2) === 0 && y < -2) return null;
    return md(x * 2 + i, 5) === 0 ? C.hairH : C.hair;
  })], FV, { off: [0, 0, -0.5], jitter: 0.05, ao: 0.25 });
}

// ---------------------------------------------------------------- fighting style
// His own moveset (zhugeliang.moves.js); STYLE keeps the look: wind-blade and beam colours, the ice-white dragon.
const STYLE = {
  trail: { white: [0.86, 0.95, 0.98], blue: [0.3, 0.8, 0.95], hot: [1.45, 1.6, 1.65] },   // weapon trail (vfx.js)
  weight: 0.8,                                                 // impact: camera kick scale (camera.js)
  fx: { proj: [0.5, 1.6, 2.2], core: [1.6, 2.2, 2.5], beam: [0.6, 1.6, 2.6] },
  dragon: { body: [0.35, 0.5, 0.55], scale: [0.6, 0.85, 0.9], belly: [0.9, 1.0, 1.0], fin: [0.9, 1.3, 1.3], whisker: [1.0, 1.3, 1.4] },
  rays: [0.8, 1.2, 1.3],
};

// ---------------------------------------------------------------- HUD portrait (20×20 pixels)
const FACE = [
  '......WWWWWWW.......',
  '.....WwWWwWWwW......',
  '.....WwWWwWWwW......',
  '.....WwWWwWWwW......',
  '.....AAAAGAAAA......',
  '....HHHHHHHHHHH.....',
  '...HHSSSSSSSSSHH....',
  '...HSKKKSSSKKKSH....',
  '...HSSSSSSSSSSSH....',
  '...HSSEISSSIESSH....',
  '...HSShSSsSShSSH....',
  '...HSSSSSsSSSSSH....',
  '...HHSHHHHHHHSHH....',
  '...HH.sSSMSSs.HH....',
  '...HH..sSHSs..HH....',
  '...HH...sHs...HH....',
  '..WWGGKK.H.KKGGWW...',
  '.WWWWGGKKKKKGGWWWW..',
  'WWWWWWGAKKKAGWWWWWW.',
  'WWWWWWWGAKAGWWWWWWWW',
];
const PAL = { W: '#d8d4ca', w: '#aea99e', A: '#b89648', G: '#3a7a4a', H: '#141216', S: '#ecc6a4', s: '#c89a7c', h: '#f8d8bc',
  K: '#1c1c22', E: '#120c10', I: '#2a2030', M: '#b87c6a' };

let glow = 0;
export default {
  id: 'zhugeliang', zh: '諸葛亮', en: 'ZHUGE LIANG', seal: '臥龍', weapon: '白羽扇', role: '羽扇 · 遠程',
  sub: '臥龍 · 運籌帷幄 · 決勝千里', copy: '羽扇一揮<br>萬軍灰飛', tagline: '羽扇綸巾，運籌帷幄之中',
  cut: { sub: '臥龍 諸葛孔明', seal: '臥龍' },
  lines: {
    open: ['魏軍雖眾，不過烏合之眾！', 'Wei\'s host is vast — and nothing but a rabble.'],
    musou: ['東風已至，破敵正在此時！', 'The east wind has come. Now we break them!'],
  },
  face: FACE, pal: PAL,
  style: STYLE,
  power: 0.85,                // × damage of his whole moveset (hero balance: his fan strikes from range)
  voice: { pitch: 0.98, fk: 1.02, growl: -0.12, gain: 0.85 },   // calm, clear
  moveset: MOVESET,
  anim: 'fan',                                              // one-handed fan upper body (hero/anims/fan.js)
  build: () => ({ parts: limbs(torso()), head: head(), hv: HV, bv: FV, pauldrons: null, weapon: weaponGeo() }),
  /** Render hook: the wind blade shows while he attacks (fast in, slow out), flickering a little. */
  update(model, h, dt) {
    const on = h.state === 'attack' || h.state === 'musou' ? 1 : 0;
    glow += (on - glow) * Math.min(1, dt * (on ? 20 : 5));
    const m = model.meshes.weapon1;
    m.visible = glow > 0.02;
    m.material.opacity = glow * (0.75 + 0.25 * Math.sin(performance.now() * 0.03));
  },
  chains() {
    const out = [];
    out.push({ joint: 'chest', anchor: [0, 0.2, -0.14], rest: [0, -1, 0.1], n: 8, len: 0.18, stiff: 0.16, drag: 0.22, wind: 1.2, cone: 80, sway: 0.22,
      seg: coatSeg, hit: ['chest', 'hips', 'thighL', 'thighR', 'kneeL', 'kneeR'] });
    out.push({ joint: 'hips', anchor: [0, -0.12, 0.17], rest: [0, -1, 0.1], n: 3, len: 0.13, stiff: 0.13, drag: 0.18, wind: 0.5, face: [0, 0, 1], cone: 70, sway: 0.1,
      seg: apronSeg, hit: [['thighL', 0.04], ['thighR', 0.04], ['kneeL', 0.04], ['kneeR', 0.04]] });
    out.push({ joint: 'head', anchor: [0, 8 * HV, -8 * HV], rest: [0, -1, -0.2], n: 5, len: 0.07, stiff: 0.12, drag: 0.15, wind: 1.2, cone: 70, sway: 0.25,
      seg: hairSeg, hit: ['head', ['chest', 0.04]] });
    return out;
  },
};
