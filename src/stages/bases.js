// Bases (據點, sim): the camps of a bigger battlefield (STAGE.map.bases [{id, at: [x, z], side, name}]). An enemy camp
// holds a garrison block; the director never sends a garrison off — it stands its camp and charges when the hero comes
// near. Taking a camp is a fight in two parts (DW8): its guard (gauge, BASE.gauge) drops with every soldier KO'd in or
// round it, and when it is empty the 據點兵長 comes out (a captain with BASE.captainHp, base:captain); KO him and the
// camp falls (base:taken) — its banners turn, it sends no more columns, and the enemy's reinforcements thin out with
// every camp lost (pressure). The reinforcement columns come out of the nearest enemy camp within BASE.feed m (crowd
// waves), or out of the haze when none is near; a camp under attack also feeds its own defence. Deterministic.
import { STAGE } from './index.js';
import { emit, on } from '../core/events.js';

export const BASE = { captainHp: 380, garrison: 16, gauge: 20, feed: 60, size: 9, reach: 15 };

export function createBases(game) {
  const list = (STAGE.map?.bases || []).map((b, k) => ({
    k, id: b.id, x: b.at[0], z: b.at[1], side0: b.side || 'foe', side: b.side || 'foe', name: b.name || '據點', captain: -1, gauge: BASE.gauge,
  }));
  // each camp opens toward the middle of the field: its gate
  for (const b of list) { const d = Math.hypot(b.x, b.z) || 1; b.gx = b.x - b.x / d * BASE.size; b.gz = b.z - b.z / d * BASE.size; }
  const B = { list };
  B.byId = (id) => list.find((b) => b.id === id);
  B.reset = () => { for (const b of list) { b.side = b.side0; b.captain = -1; b.gauge = BASE.gauge; } };
  /** crowd.spawnArmy: every enemy camp gets its garrison block before the field army is laid out. */
  B.garrison = () => { for (const b of list) if (b.side === 'foe') game.crowd.spawnGarrison(b.k, b.x, b.z, BASE.garrison); };
  // a soldier KO'd in or round a camp wears its guard down
  on('ko', (e) => {
    if (e.officer) return;
    for (const b of list) if (b.side === 'foe' && b.captain < 0 && b.gauge > 0 && Math.hypot(e.x - b.x, e.z - b.z) < BASE.reach) b.gauge--;
  });
  B.step = () => {
    const c = game.crowd, h = game.hero;
    for (const b of list) {
      if (b.side !== 'foe') continue;
      if (b.captain < 0 && b.gauge <= 0) {                     // the guard is broken: the camp's captain comes out
        b.captain = c.spawnCaptain(b.x, b.z, BASE.captainHp * (game.diff?.hp ?? 1));
        if (b.captain >= 0) emit('base:captain', { k: b.k, id: b.id, x: b.x, z: b.z, name: b.name });
        continue;
      }
      if (b.captain < 0 || !c.kod[b.captain]) continue;
      b.side = 'ally'; b.captain = -1;
      emit('base:taken', { k: b.k, id: b.id, x: b.x, z: b.z, name: b.name, left: list.filter((q) => q.side === 'foe').length });
    }
  };
  /** The camp under the hero's feet (within BASE.reach m), or null. */
  B.near = (h) => list.find((b) => Math.hypot(b.x - h.x, b.z - h.z) < BASE.reach) || null;
  /** Where a reinforcement column comes from: the gate of the nearest enemy camp within BASE.feed m, else null. */
  B.source = (h) => {
    const at = B.near(h);
    if (at && at.side === 'foe') return [at.x, at.z];          // a camp under attack sends its men from inside
    let best = null, bd = BASE.feed;
    for (const b of list) {
      if (b.side !== 'foe') continue;
      const d = Math.hypot(b.x - h.x, b.z - h.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best && [best.gx, best.gz];
  };
  /** Reinforcement rate: 1 with every camp held, down to 0.4 when all have fallen. */
  B.pressure = () => (list.length ? 1 - 0.6 * list.filter((b) => b.side !== 'foe').length / list.length : 1);
  return B;
}
