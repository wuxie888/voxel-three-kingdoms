// Horses off the leash (sim). A rider thrown from the saddle (crowd.js unhorse) leaves his horse: it bolts away from
// the fight, eases to a trot and stands, saddled, until it is taken (hero/mount.js) or a minute has passed (at most
// HORSE.max loose at once). The hero's own horse (`own`) never wanders off: called, it gallops in from behind the camera
// and he swings up as it reaches him; left standing, it waits where he got down. Deterministic.
import { ARENA_RADIUS } from '../world/field.js';
import { FAR_Z } from '../crowd/crowd.js';
import { SOLIDS, pushOut } from '../world/setpieces.js';
import { FIELD_COATS } from './model.js';

export const HORSE = { max: 8, bolt: 150, life: 3600, turn: 0.04, call: 14, callFrom: 30 };

export function createHorses(game) {
  const list = [];
  let seq = 0;
  const H = { list };
  H.reset = () => { list.length = 0; };
  /** A horse runs loose at (x, z), heading yaw at v m/s (a rider's unless `coat` / `own` say otherwise). */
  H.free = (x, z, yaw, v, { coat = null, own = false } = {}) => {
    if (list.length >= HORSE.max) { const k = list.findIndex((m) => !m.own); list.splice(k < 0 ? 0 : k, 1); }
    seq++;
    list.push({ id: seq, x, z, yaw, v: own && v < 1 ? 0 : Math.max(v, 6), t: own && v < 1 ? HORSE.bolt : 0, coat: coat || FIELD_COATS[seq % FIELD_COATS.length], own, call: false });
  };
  H.remove = (m) => { const k = list.indexOf(m); if (k >= 0) list.splice(k, 1); };
  /** His own horse comes: the one he left standing, or a fresh one out of the haze behind the camera. */
  H.call = (h, camYaw, coat) => {
    let m = list.find((q) => q.own);
    if (!m) {
      const a = camYaw + Math.PI, r = Math.min(HORSE.callFrom, ARENA_RADIUS + 6 - Math.hypot(h.x, h.z) * 0.2);
      H.free(h.x + Math.sin(a) * r, h.z + Math.cos(a) * r, camYaw, HORSE.call, { coat, own: true });
      m = list[list.length - 1];
    }
    m.call = true; m.t = 0;
  };
  H.step = () => {
    const h = game.hero;
    for (let k = list.length - 1; k >= 0; k--) {
      const m = list[k];
      m.t++;
      if (m.call) {                                             // galloping to him; up he goes when it reaches him and he is free
        const dx = h.x - m.x, dz = h.z - m.z, d = Math.hypot(dx, dz);
        let da = Math.atan2(dx, dz) - m.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        m.yaw += Math.max(-0.08, Math.min(0.08, da));
        m.v = d > 7 ? Math.min(HORSE.call, m.v + 0.4) : Math.max(1.5, d * 1.6);
        if (d < 1.8) {
          m.v = 0;
          if (h.riding) m.call = false;                          // he found another horse
          else if (game.mount?.arrive(m)) continue;
        }
      } else if (!m.own && m.t > HORSE.life) { list.splice(k, 1); continue; }
      else if (m.t < HORSE.bolt) {                              // bolting: away from the fight, slowing
        let da = Math.atan2(m.x - h.x, m.z - h.z) - m.yaw;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        m.yaw += Math.max(-HORSE.turn, Math.min(HORSE.turn, da));
        m.v = Math.max(2.2, m.v - 0.05);
      } else m.v = Math.max(0, m.v - 0.08);
      m.x += Math.sin(m.yaw) * m.v / 60; m.z += Math.cos(m.yaw) * m.v / 60;
      const r = Math.hypot(m.x, m.z), lim = ARENA_RADIUS + 8;
      if (r > lim) { m.x *= lim / r; m.z *= lim / r; if (!m.call) m.yaw += Math.PI * 0.5; }
      if (m.z > FAR_Z - 3) { m.z = FAR_Z - 3; if (!m.call) m.yaw = Math.PI; }
      if (SOLIDS.length) { const o = pushOut(m.x, m.z, 1.0); if (o) { m.x = o[0]; m.z = o[1]; } }
    }
  };
  return H;
}
