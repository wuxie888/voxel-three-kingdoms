// Equipment (data + generation): weapons belong to one officer (his weapon type), accessories (寶物) fit anyone.
// Five rarities (★1 白 … ★5 金): a weapon carries an attack bonus and 0-3 attributes (屬性), an accessory 1-3 stat lines.
// Attributes work like the DW elements — most trigger on charge attacks:
//   炎 fire     charge hits burst into flame: + value × the hit's damage, and the target smoulders
//   冰 ice      charge hits freeze the target for value s
//   雷 thunder  charge hits arc to up to 3 enemies nearby for value × the damage
//   斬 cut      any hit: value chance to strike for ×3
//   吸 leech    any hit: heal value × the damage dealt (≤ 12 HP a second)
//   無 musou    + value Musou gain
// Accessory stats: hp (+HP), def (− damage taken), mus (+ Musou gain), heal (+ food), spd (+ run speed), atk (+ attack).
// Generation is a pure function of a seed, so a drop can be re-rolled identically.
import { hash01 } from '../core/rng.js';

export const RARITY = [null,
  { n: 1, zh: '凡', en: 'COMMON', col: '#d8d2c6' },
  { n: 2, zh: '良', en: 'FINE', col: '#7fd86a' },
  { n: 3, zh: '精', en: 'RARE', col: '#5aa8ff' },
  { n: 4, zh: '神', en: 'EPIC', col: '#c27aff' },
  { n: 5, zh: '傳說', en: 'LEGENDARY', col: '#ffc44a' },
];
export const ATTRS = {
  fire: { zh: '炎', en: 'Fire', col: '#ff6a3a', range: [0.25, 0.7], fmt: (v) => `蓄力 +${Math.round(v * 100)}% 火傷` },
  ice: { zh: '冰', en: 'Ice', col: '#8fd8ff', range: [0.8, 2.0], fmt: (v) => `蓄力 凍結 ${v.toFixed(1)}秒` },
  thunder: { zh: '雷', en: 'Thunder', col: '#ffe14a', range: [0.35, 0.8], fmt: (v) => `蓄力 連鎖雷 ${Math.round(v * 100)}%` },
  cut: { zh: '斬', en: 'Cut', col: '#ff4a5a', range: [0.04, 0.12], fmt: (v) => `${Math.round(v * 100)}% 機率 三倍傷害` },
  leech: { zh: '吸', en: 'Leech', col: '#7aff9a', range: [0.02, 0.06], fmt: (v) => `吸收 ${Math.round(v * 100)}% 傷害為體力` },
  musou: { zh: '無', en: 'Musou', col: '#ffd65a', range: [0.12, 0.4], fmt: (v) => `無雙 +${Math.round(v * 100)}%` },
};
export const STATS = {
  hp: { zh: '體力', range: [30, 140], fmt: (v) => `體力 +${Math.round(v)}` },
  def: { zh: '防禦', range: [0.04, 0.16], fmt: (v) => `受傷 −${Math.round(v * 100)}%` },
  mus: { zh: '無雙', range: [0.08, 0.3], fmt: (v) => `無雙 +${Math.round(v * 100)}%` },
  heal: { zh: '補給', range: [0.15, 0.5], fmt: (v) => `補給回復 +${Math.round(v * 100)}%` },
  spd: { zh: '疾風', range: [0.04, 0.12], fmt: (v) => `移動 +${Math.round(v * 100)}%` },
  atk: { zh: '攻擊', range: [0.04, 0.14], fmt: (v) => `攻擊 +${Math.round(v * 100)}%` },
};
// weapon bonus by rarity (attack ×) and attribute count; the legendary carries the officer's own named weapon
const WATK = [0, [0.04, 0.1], [0.1, 0.18], [0.18, 0.28], [0.28, 0.4], [0.42, 0.55]];
const WATTRS = [0, 0, 1, 1, 2, 3];
const KIND = {   // weapon type per officer: the noun for generated names and the legendary's own name
  zhaoyun: ['槍', '龍膽亮銀槍'], guanyu: ['偃月刀', '青龍偃月刀'], zhangfei: ['蛇矛', '丈八蛇矛'], zhugeliang: ['羽扇', '白羽扇'], lubu: ['畫戟', '方天畫戟'],
};
const WPRE = [null, ['鐵', '銅', '樸'], ['精鋼', '利刃', '鍛'], ['名匠', '寒光', '破軍'], ['神兵', '驚雷', '赤焰'], null];
const ACC = [['玉佩', 'JADE'], ['護符', 'CHARM'], ['兵書', 'TREATISE'], ['錦囊', 'SACHET'], ['虎牙', 'TIGER FANG'], ['鳳羽', 'PHOENIX PLUME'], ['銅鏡', 'MIRROR'], ['令牌', 'TOKEN']];
const APRE = [null, '舊', '良', '精製', '神品', '傳世'];

const pickFrom = (arr, u) => arr[Math.min(arr.length - 1, Math.floor(u * arr.length))];
const lerp = ([a, b], u) => a + (b - a) * u;
/** Rarity roll: base weights shifted up by `luck` (0 normal, 1 boss / hard, 2 boss on hard). */
export function rollRarity(u, luck = 0) {
  const w = [0, 50, 30, 14, 5, 1].map((v, i) => (i ? v * Math.pow(1 + luck * 0.9, i - 1) : 0));
  let t = u * w.reduce((a, b) => a + b, 0);
  for (let r = 1; r <= 5; r++) { if (t < w[r]) return r; t -= w[r]; }
  return 5;
}

/** A weapon for `hero` (or an accessory when hero is null) of rarity r, from seed s. */
export function makeItem(s, r, hero) {
  const u = (k) => hash01(s, k, 97);
  if (hero) {
    const [noun, legend] = KIND[hero] || ['兵', '神兵'];
    const name = r === 5 ? legend : `${pickFrom(WPRE[r], u(1))}${noun}`;
    const attrs = [], keys = Object.keys(ATTRS);
    for (let k = 0; attrs.length < WATTRS[r] && k < 12; k++) {
      const a = pickFrom(keys, u(10 + k));
      if (!attrs.some((x) => x[0] === a)) attrs.push([a, +lerp(ATTRS[a].range, u(30 + k) * (0.5 + r * 0.1)).toFixed(3)]);
    }
    return { kind: 'weapon', hero, r, name, atk: +lerp(WATK[r], u(2)).toFixed(3), attrs };
  }
  const [noun, en] = pickFrom(ACC, u(1)), stats = [], keys = Object.keys(STATS), n = r >= 5 ? 3 : r >= 3 ? 2 : 1;
  for (let k = 0; stats.length < n && k < 12; k++) {
    const st = pickFrom(keys, u(10 + k));
    if (!stats.some((x) => x[0] === st)) stats.push([st, +lerp(STATS[st].range, Math.min(1, u(30 + k) * 0.6 + r * 0.1)).toFixed(3)]);
  }
  return { kind: 'acc', r, name: `${APRE[r]}${noun}`, en, stats };
}
