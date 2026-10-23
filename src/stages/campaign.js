// Stage script (sim): every battle is a short chain of goals (STAGE.script) that ends in 勝利 — beat the named officers,
// reach or hold a spot, defeat the boss. Deterministic and stepped with the fixed loop: it brings the named officers on
// (with an escort column) and summons the boss when their goal starts, and keeps the score for the result card. The
// HUD goal box, the beacons and the ally on the bridge only read it.
// cp.focus {x, z, until}: a point the camera turns toward for a moment (the ally's roar on the bridge).
// cp.tgt [{x, z, r, hp, hpMax}]: the structures of a destroy goal · cp.flood {f}: the flood started on frame f.
// Emits: goal:start {i, goal} · goal:progress {i, n, of, x, z} · goal:done {i, goal} · say {who, zh, en}
//        buff {atk} · ally:roar {x, z, yaw} · stage:clear {frame, time, kos, taken}
// Goal kinds (STAGE.script entries; goal: [zh, en] is the HUD text):
//   officer  slots [k…] of STAGE.enemy.officers join ≈ 20 m ahead (or at `at` [[x, z]…]) with an escort column;
//            names: [[zh, en]…] puts new men in those slots; hp: × officer hp; commander: the last slot is the enemy
//            commander (總大將). Done when all are KO'd.
//   reach    points [[x, z]…], r: radius, hold: frames inside to take each one (0: arriving is enough), label.
//   boss     the stage boss rides out (STAGE.boss); done when he falls.
//   kos      n: KOs since the goal began.
//   destroy  points [[x, z]…], hp, r (m), label: structures he breaks with his blows (altars, dams; combat.strike →
//            hitTargets); done when all of them fall. flood: true — when it is done the river breaks loose: a wall of
//            water sweeps the field from the far bank (cp.flood), throwing every soldier it reaches.
// Optional: lines {start, done}: [[who, zh, en] | [who, {heroId: [zh, en], '*': [zh, en]}]…] (who: 'hero', 'ally',
// 'off:<k>' or a hero id; a hero-keyed line without a match and no '*' is skipped); buff {atk} when done;
// ally {id, alt, at, yaw}: an allied officer waiting at the goal's spot (alt stands in when the hero is `id`), who
// roars into the crowd when the hero gets there.
import { STAGE } from './index.js';
import { HERO } from '../heroes/index.js';
import { emit } from '../core/events.js';
import { ARENA_RADIUS, WALL_Z } from '../world/world.js';

const START = 210, GAP = 120, CLEAR = 170, ROAR = 34;    // frames: first goal after the intro, between goals, last goal → 勝利
// the flood: starts `delay` frames after the dams fall, its front runs from z0 (the far bank) to z1 in `frames`
export const FLOOD = { delay: 70, frames: 170, z0: 52, z1: -60 };
// debug: ?goal=N starts at goal N (1-based); ?boss jumps to the boss goal
const Q = new URLSearchParams(location.search);
const SKIP = Number(Q.get('goal')) || (Q.has('boss') ? (STAGE.script || []).findIndex((g) => g.kind === 'boss') + 1 : 0);

/** A goal's (or a line's) text for this hero: [zh, en], or {heroId: [zh, en], '*': [zh, en]}. */
export const forHero = (spec) => (Array.isArray(spec) ? spec : spec && (spec[HERO.id] || spec['*']));

export function createCampaign(game) {
  const SCRIPT = STAGE.script || [];
  const cp = {
    active: false, i: -1, goal: null, t: 0, wait: 0, n: 0, of: 0, caps: [], ofs: [], ally: null, focus: null, tgt: [], flood: null,
    clearF: -1, cleared: false, t0: 0, kos0: 0,
  };
  const say = (lines) => {
    for (const [who, ...rest] of lines || []) {
      const l = rest.length === 1 ? forHero(rest[0]) : rest;
      if (l) emit('say', { who, zh: l[0], en: l[1] });
    }
  };

  cp.reset = () => {
    Object.assign(cp, { active: SCRIPT.length > 0, i: -1, goal: null, t: 0, wait: START, n: 0, of: 0, caps: [], ofs: [], ally: null, focus: null, tgt: [], flood: null,
      clearF: -1, cleared: false, t0: game.frame, kos0: 0 });
    if (SKIP > 1) { cp.i = Math.min(SKIP, SCRIPT.length) - 2; cp.wait = 30; }
  };

  function begin(i) {
    const g = cp.goal = SCRIPT[i], h = game.hero, c = game.crowd;
    cp.i = i; cp.t = 0; cp.n = 0; cp.kos0 = h.kos; cp.caps = []; cp.ofs = [];
    if (g.kind === 'officer') {
      g.slots.forEach((k, j) => {
        let x, z;
        if (g.at) [x, z] = g.at[j];
        else {
          const a = game.cam.yaw + (j - (g.slots.length - 1) / 2) * 0.55, d = g.dist || 21;   // in view, ahead of the camera
          x = h.x + Math.sin(a) * d; z = h.z + Math.cos(a) * d;
        }
        const r = Math.hypot(x, z), lim = ARENA_RADIUS - 5;
        if (r > lim) { x *= lim / r; z *= lim / r; }
        const boss = g.commander && j === g.slots.length - 1;
        cp.ofs.push(c.spawnOfficer(k, x, Math.min(z, WALL_Z - 6), { hpK: (g.hp || 1) * (boss ? 1.4 : 1), escort: g.escort ?? 12, name: g.names?.[j] }));
      });
      cp.of = g.slots.length;
    } else if (g.kind === 'reach') { cp.caps = g.points.map(() => 0); cp.of = g.points.length; }
    else if (g.kind === 'destroy') {
      const hp = (g.hp || 800) * (game.diff?.hp ?? 1);
      cp.tgt = g.points.map(([x, z]) => ({ x, z, r: g.r || 1.6, hp, hpMax: hp, key: -1 }));
      cp.of = g.points.length;
    }
    else if (g.kind === 'boss') { cp.of = 1; game.boss?.summon(); }
    else if (g.kind === 'kos') cp.of = g.n;
    for (const k of g.extra || []) {                            // officers riding with the goal (not needed to finish it)
      const a = game.cam.yaw + 0.5, x = h.x + Math.sin(a) * 18, z = h.z + Math.cos(a) * 18, r = Math.hypot(x, z), lim = ARENA_RADIUS - 5;
      c.spawnOfficer(k, r > lim ? x * lim / r : x, Math.min(r > lim ? z * lim / r : z, WALL_Z - 6), { hpK: g.hp || 1, escort: 10 });
    }
    if (g.ally) {
      const alt = g.ally.id === HERO.id;                        // the hero is the officer who holds the bridge: he roars
      cp.ally = { id: alt ? g.ally.alt : g.ally.id, alt, x: g.ally.at[0], z: g.ally.at[1], yaw: g.ally.yaw || 0, anim: { id: 'idle', t: 0, seq: 'idle' }, roarT: -1 };
    }
    emit('goal:start', { i, goal: g });
    say(g.lines?.start);
  }

  function finish() {
    const g = cp.goal;
    emit('goal:done', { i: cp.i, goal: g });
    say(g.lines?.done);
    if (g.buff?.atk) { game.hero.atk = g.buff.atk; emit('buff', { atk: g.buff.atk }); }
    if (cp.ally && g.kind === 'reach') { cp.ally.roarT = 0; cp.focus = { x: cp.ally.x, z: cp.ally.z, until: game.frame + 160 }; }   // the view turns to him
    if (g.flood) { cp.flood = { f: game.frame + FLOOD.delay }; emit('flood', { f: cp.flood.f }); }
    cp.goal = null;
    if (cp.i + 1 < SCRIPT.length) cp.wait = GAP;
    else cp.clearF = game.frame + CLEAR;
  }

  function progress() {
    const g = cp.goal, h = game.hero, c = game.crowd;
    if (g.kind === 'officer') return cp.ofs.reduce((n, i) => n + (c.kod[i] ? 1 : 0), 0);
    if (g.kind === 'boss') return game.boss && game.boss.st === 'dead' ? 1 : 0;
    if (g.kind === 'kos') return Math.min(g.n, h.kos - cp.kos0);
    if (g.kind === 'destroy') return cp.tgt.reduce((n, t) => n + (t.hp <= 0 ? 1 : 0), 0);
    // reach: each spot fills while he stands in it (drains at half speed when he leaves)
    let n = 0;
    g.points.forEach(([x, z], j) => {
      if (cp.caps[j] >= 1) { n++; return; }
      const inside = Math.hypot(h.x - x, h.z - z) < (g.r || 3) && h.state !== 'dead';
      cp.caps[j] = inside ? (g.hold ? cp.caps[j] + 1 / g.hold : 1) : Math.max(0, cp.caps[j] - 0.5 / (g.hold || 1));
      if (cp.caps[j] >= 1) { cp.caps[j] = 1; n++; emit('goal:progress', { i: cp.i, n, of: cp.of, x, z, j }); }
    });
    return n;
  }

  /** combat.strike: a hero hit window (key; rehit for multi-tick windows) of `dmg` covers target j when inside(x, z, r). */
  cp.hitTargets = (inside, dmg, key, rehit) => {
    if (cp.goal?.kind !== 'destroy') return;
    cp.tgt.forEach((t, j) => {
      if (t.hp <= 0 || (!rehit && t.key === key) || !inside(t.x, t.z, t.r)) return;
      t.key = key; t.hp = Math.max(0, t.hp - dmg);
      emit('target:hit', { j, x: t.x, z: t.z, k: t.hp / t.hpMax });
      if (t.hp <= 0) {
        emit('target:break', { j, x: t.x, z: t.z, label: cp.goal.label });
        emit('goal:progress', { i: cp.i, n: cp.tgt.filter((q) => q.hp <= 0).length, of: cp.of, x: t.x, z: t.z, j });
      }
    });
  };

  // the flood (水淹七軍): a wall of water rolls from the far bank across the field in FLOOD.frames, throwing every soldier
  // it passes (one strike key: each man once), officers knocked flat but left standing; the water then stays ankle-deep
  function stepFlood() {
    const F = cp.flood;
    if (!F || game.frame < F.f) return;
    const u = (game.frame - F.f) / FLOOD.frames;
    if (u > 1) return;
    const front = FLOOD.z0 + (FLOOD.z1 - FLOOD.z0) * u;
    F.front = front;
    game.combat.strike({ shape: 'line', len: 140, width: 5, dmg: 999, kb: 'blow', force: 10, lift: 5, heavy: true, yMax: 9 }, -70, front, Math.PI / 2, 8e7, false, 'flood');
  }

  function stepAlly() {
    const a = cp.ally;
    if (!a) return;
    const an = a.anim;
    if (a.roarT >= 0) {
      a.roarT++;
      an.id = 'roar'; an.seq = 'roar'; an.t = Math.min(1, a.roarT / 80);
      if (a.roarT === ROAR) {
        // 當陽一喝: the roar blows the pursuit off the bridge head (counts for the hero — the ally fights beside him)
        const h = game.hero, x = a.alt ? h.x : a.x, z = a.alt ? h.z : a.z;
        game.combat.strike({ shape: 'circle', range: 13, dmg: 60, kb: 'blow', force: 11, lift: 6, heavy: true, yMax: 9 }, x, z, a.yaw, 9e7, false, 'ally');
        emit('ally:roar', { x, z, yaw: a.yaw });
      }
      if (a.roarT > 90) { a.roarT = -2; }
    } else { an.id = 'idle'; an.seq = 'idle'; an.t = (game.frame % 150) / 150; }
  }

  cp.step = () => {
    stepAlly();
    stepFlood();
    if (cp.focus && game.frame > cp.focus.until) cp.focus = null;
    if (!cp.active) return;
    if (cp.clearF >= 0) {
      if (game.frame >= cp.clearF && game.hero.state !== 'dead') {
        cp.cleared = true; cp.active = false;                  // won: the field goes back to free play (officers return with the waves)
        const h = game.hero;
        emit('stage:clear', { frame: game.frame, time: (game.frame - cp.t0) / 60, kos: h.kos, taken: h.taken });
      }
      return;
    }
    if (game.hero.state === 'dead') return;
    if (!cp.goal) {
      if (--cp.wait <= 0) begin(cp.i + 1);
      return;
    }
    cp.t++;
    const n = progress();
    if (n !== cp.n && cp.goal.kind !== 'reach') emit('goal:progress', { i: cp.i, n, of: cp.of });
    cp.n = n;
    if (n >= cp.of) finish();
  };
  return cp;
}
