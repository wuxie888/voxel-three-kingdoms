// Supplies (sim): breakable jars and supply crates stand around the field and spill an item when a blow lands on them;
// officers and every 80th soldier drop one too. The hero takes an item by walking over it:
//   肉包 heals 80 · 大肉包 heals 220 · 酒 fills a Musou segment · 虎符 doubles his attack and 玄甲 halves the damage he
//   takes, each for 25 s (h.buffAtk / h.buffDef: frames left; combat.atkK and hero.hurt read them) · 寶箱 holds a piece
//   of equipment (progress/profile.js openChest: into the armoury at once). Officers drop a chest now and then, the
//   commander and the boss always (a better one).
// Food waits until he is hurt, wine until his gauge has room. Deterministic: placement and loot come from hashes of
// the stage and the jar / KO index, never from the sim RNG stream. Items vanish after 30 s.
// Emits: jar:break {x, z, crate, item} · pickup {x, z, kind, v} · loot {item} (the view, HUD, audio, result card listen).
import { on, emit } from '../core/events.js';
import { HERO } from '../heroes/index.js';
import { openChest } from '../progress/profile.js';
import { hash01 } from '../core/rng.js';
import { STAGE } from '../stages/index.js';
import { ARENA_RADIUS } from '../world/world.js';
import { blocked } from '../world/setpieces.js';

export const ITEMS = {
  bun: { zh: '肉包', en: 'MEAT BUN', heal: 80 },
  feast: { zh: '大肉包', en: 'BUN PLATTER', heal: 220 },
  wine: { zh: '酒', fx: '無雙 +1', en: 'WINE · MUSOU +1', musou: 34 },
  tiger: { zh: '虎符', fx: '攻擊力兩倍', en: 'TIGER TALLY · ATTACK ×2 · 25 s', buff: 'buffAtk' },
  armor: { zh: '玄甲', fx: '防禦力兩倍', en: 'DARK ARMOUR · DEFENCE ×2 · 25 s', buff: 'buffDef' },
  chest: { zh: '寶箱', fx: '裝備', en: 'TREASURE · EQUIPMENT', chest: true },
};
export const BUFF = 60 * 25;
const JARS = 16, LIFE = 60 * 30, R = 1.25, MAX = 18, EVERY = 80;
// jar loot: the rest of the roll is an empty jar
const LOOT = [['bun', 0.32], ['wine', 0.2], ['tiger', 0.12], ['armor', 0.12], ['feast', 0.07], ['chest', 0.06]];
const seed = [...STAGE.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 9973;

function roll(u, table) {
  for (const [k, p] of table) { if (u < p) return k; u -= p; }
  return null;
}

export function createSupplies(game) {
  // jar spots: golden-angle spiral over the field (clear of the start, the goal spots and the set pieces)
  const keep = (STAGE.script || []).flatMap((g) => g.points || []).concat((STAGE.props || []).flatMap((p) => (Array.isArray(p.at[0]) ? p.at : [p.at])));
  const spots = [];
  for (let k = 0; spots.length < JARS && k < 200; k++) {
    const a = k * 2.39996 + hash01(k, seed, 3) * 0.6, r = 11 + (ARENA_RADIUS - 15) * Math.sqrt(hash01(k, seed, 5));
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (blocked(x, z) || keep.some(([px, pz]) => Math.hypot(px - x, pz - z) < 5)) continue;
    spots.push({ x, z, crate: hash01(k, seed, 7) < 0.35, item: roll(hash01(k, seed, 9), LOOT), alive: true });
  }
  const s = { jars: spots, items: [] };                      // items: { x, z, kind, t }
  let gruntKOs = 0, koN = 0;

  const drop = (kind, x, z, extra) => { if (!kind) return; s.items.push({ x, z, kind, t: 0, ...extra }); if (s.items.length > MAX) s.items.shift(); };
  const luck = () => (game.diff?.id === 'hard' ? 0.6 : 0);
  on('ko', (e) => {
    if (e.officer) {
      // an officer leaves food more often than not, now and then wine or a tally, and a chest now and then; the stage
      // commander a platter and a good chest
      const boss = game.campaign?.goal?.commander && game.campaign.ofs.at(-1) === e.i, k = koN++;
      drop(boss ? 'feast' : roll(hash01(e.i, k, 13), [['bun', 0.5], ['wine', 0.15], ['tiger', 0.08], ['armor', 0.08]]), e.x, e.z);
      if (boss) drop('chest', e.x + 1.4, e.z, { luck: 1 + luck(), floor: 3 });
      else if (hash01(e.i, k, 19) < 0.3) drop('chest', e.x + 1.2, e.z + 0.4, { luck: luck() });
    } else if (++gruntKOs % EVERY === 0) drop('bun', e.x, e.z);
  });
  on('boss:defeat', (e) => { drop('feast', e.x, e.z); drop('chest', e.x + 1.4, e.z, { luck: 1.5 + luck(), floor: 3 }); });
  on('scenario', () => { s.items.length = 0; gruntKOs = 0; koN = 0; for (const j of s.jars) j.alive = true; });

  /** combat.strike: a hit window covers jar j when inside(x, z) — the jar breaks and spills its item. */
  s.strike = (inside) => {
    for (const j of s.jars) {
      if (!j.alive || !inside(j.x, j.z)) continue;
      j.alive = false;
      drop(j.item, j.x, j.z);
      emit('jar:break', { x: j.x, z: j.z, crate: j.crate, item: j.item });
    }
  };

  s.step = () => {
    const h = game.hero;
    if (h.buffAtk > 0) h.buffAtk--;
    if (h.buffDef > 0) h.buffDef--;
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i], I = ITEMS[it.kind];
      if (++it.t > LIFE) { s.items.splice(i, 1); continue; }
      if (h.state === 'dead' || h.y > 1 || Math.hypot(h.x - it.x, h.z - it.z) > R) continue;
      if (I.heal && h.hp >= h.hpMax) continue;                  // food keeps until he is hurt
      if (I.musou && h.musou >= h.musouMax) continue;           // wine until the gauge has room
      let v = 0;
      if (I.chest) {                                          // equipment straight into the armoury (outside the sim state)
        const item = openChest(HERO.id, Math.floor(hash01(game.frame, Math.round(it.x * 64), Math.round(it.z * 64)) * 1e9), it.luck || 0, it.floor || 1);
        emit('loot', { item, x: it.x, z: it.z });
      } else if (I.heal) { const heal = I.heal * (1 + (h.gear?.heal || 0)); v = Math.min(heal, h.hpMax - h.hp); h.heal(heal); }
      else if (I.musou) { v = I.musou; h.musou = Math.min(h.musouMax, h.musou + I.musou); }
      else { h[I.buff] = BUFF; v = BUFF; }
      s.items.splice(i, 1);
      emit('pickup', { x: it.x, z: it.z, kind: it.kind, v });
    }
  };
  return s;
}
