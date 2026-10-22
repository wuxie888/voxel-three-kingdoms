// Player profile, kept in localStorage (wrapped like core/settings.js: the game runs on a fresh profile without it):
// per officer a level (1-50, XP from battles) and a loadout (one weapon, two accessories), and the armoury — every
// piece of equipment won. Read at boot and when the hero is (re)started; the armory panel and the result card write it.
import { makeItem, rollRarity, ATTRS, STATS } from './loot.js';
import { hash01 } from '../core/rng.js';

const KEY = 'vtk:profile', CAP = 150;
export const LV = { max: 50, next: (lv) => 120 + lv * 60 };   // XP to go from lv to lv + 1 (Lv 50 ≈ 80k XP, ≈ 45 battles)
/** Level growth: HP, attack and damage reduction at level lv. */
export const lvStats = (lv) => ({ hp: 8 * (lv - 1), atk: 0.008 * (lv - 1), def: 0.004 * (lv - 1) });

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
let P = read();
if (!P || P.v !== 1) P = { v: 1, heroes: {}, items: {}, next: 1 };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* storage unavailable */ } };
export const profile = P;

/** An officer's record; the first time, he gets a plain ★1 weapon so the armoury is never empty. */
export function heroP(id) {
  if (!P.heroes[id]) {
    P.heroes[id] = { xp: 0, lv: 1, weapon: null, acc: [null, null] };
    P.heroes[id].weapon = addItem(makeItem(Math.floor(hash01(id.length, id.charCodeAt(0), 5) * 1e6), 1, id));
    save();
  }
  return P.heroes[id];
}

export function addItem(item) {
  const id = P.next++;
  P.items[id] = { ...item, id, t: Date.now() };
  const ids = Object.keys(P.items);
  if (ids.length > CAP) {                                      // full: the oldest unequipped common goes first
    const used = new Set(Object.values(P.heroes).flatMap((h) => [h.weapon, ...h.acc]));
    const drop = ids.map(Number).filter((k) => !used.has(k)).sort((a, b) => P.items[a].r - P.items[b].r || a - b)[0];
    if (drop != null) delete P.items[drop];
  }
  save();
  return id;
}

/** Roll a chest for `hero`: his weapon 65 % of the time, else an accessory; luck shifts the rarity (loot.rollRarity). */
export function openChest(hero, seed, luck = 0, floor = 1) {
  const r = Math.max(floor, rollRarity(hash01(seed, 1, 41), luck));
  const item = makeItem(seed, r, hash01(seed, 2, 43) < 0.65 ? hero : null);
  return P.items[addItem(item)];
}

/** Equip item id in slot ('weapon' | 0 | 1) of officer hid; null empties the slot. */
export function equip(hid, slot, id) {
  const h = heroP(hid);
  if (slot === 'weapon') h.weapon = id;
  else {
    if (id != null) h.acc = h.acc.map((x) => (x === id ? null : x));   // one accessory can't fill both slots
    h.acc[slot] = id;
  }
  save();
}

/** XP for officer hid; returns { lv0, lv, xp, gained }. */
export function addXP(hid, xp) {
  const h = heroP(hid), lv0 = h.lv;
  h.xp += Math.round(xp);
  while (h.lv < LV.max && h.xp >= LV.next(h.lv)) { h.xp -= LV.next(h.lv); h.lv++; }
  if (h.lv >= LV.max) h.xp = 0;
  save();
  return { lv0, lv: h.lv, xp: h.xp, gained: Math.round(xp) };
}

export const itemOf = (id) => (id != null ? P.items[id] || null : null);

/** Everything his level and loadout add up to (hero.js / combat.js / supplies.js read it at the start of a battle). */
export function gearOf(hid) {
  const h = heroP(hid), L = lvStats(h.lv);
  const g = { lv: h.lv, hp: L.hp, atk: L.atk, def: L.def, mus: 0, heal: 0, spd: 0 };
  for (const k of Object.keys(ATTRS)) g[k] = 0;
  const w = itemOf(h.weapon);
  if (w) { g.atk += w.atk; for (const [a, v] of w.attrs) g[a] += v; }
  for (const id of h.acc) { const a = itemOf(id); if (a) for (const [k, v] of a.stats) g[k] += v; }
  g.def = Math.min(0.6, g.def);
  return g;
}
export { ATTRS, STATS };
