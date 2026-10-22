// Boss (sim): a lone peerless general for stages with `boss` (虎牢關: 呂布; when the player is Lü Bu himself, 關羽).
// Deterministic, stepped with the fixed loop and frozen by hitstop. The hero's strikes, projectiles and Musou reach him
// through combat.strike (bossHit); he never gets launched — heavy damage breaks his poise into a stagger instead.
//   enter   walks out of the gate once the fight is on (after BOSS.arrive frames or BOSS.arriveKOs KOs)
//   chase   runs to striking range, strafes a little when close
//   attack  one of three telegraphed moves (red warning disc under the strike area):
//             sweep  360° sweeps around him · thrust  a lunge along a line at the hero · leap  jump onto the hero, quake
//   stagger poise broken: reels ≈ 1 s, free hits · dead  falls; emits boss:defeat
// Emits boss:enter, boss:warn {kind, x, z, yaw, r, len, dur}, boss:strike {kind, x, z}, boss:hit, boss:stagger, boss:defeat.
import { rng } from '../core/rng.js';
import { emit } from '../core/events.js';
import { ARENA_RADIUS, GATE_X } from '../world/world.js';

export const BOSS = {
  hp: 2800, poise: 320, staggerF: 84, arrive: 60 * 22, arriveKOs: 45,   // a 1.5-2.5 min duel; a broken guard opens 1.4 s
  walk: 3.2, run: 6.4, turn: 5, range: 3.4,
  // [windup, active, recover] frames, damage, reach
  sweep: { f: [34, 28, 30], dmg: 26, r: 3.9, every: 9 },
  thrust: { f: [28, 12, 34], dmg: 32, len: 7.5, w: 2.2, lunge: 5.5 },
  leap: { f: [22, 36, 40], dmg: 40, r: 4.4 },
  poiseHit: 9, steady: 150, projK: 0.6,                    // poise: + per hit (fast strings stagger too); no stagger for 2.5 s after one; thrown blades ×0.6
  rage: 0.4,                                               // below this hp share: shorter wind-ups, shorter pauses
};

if (new URLSearchParams(location.search).has('boss')) BOSS.arrive = 60;   // debug: the boss rides out after 1 s (stages without a script)

export function createBoss(game, def) {
  const b = { def, x: 0, z: 0, y: 0, vy: 0, yaw: 0, hp: BOSS.hp, hpMax: BOSS.hp, poise: BOSS.poise, steady: 0, st: 'off', stT: 0,
    atk: null, ax: 0, az: 0, pause: 0, lastHit: -1, flash: 0, seq: 0, anim: { id: 'idle', t: 0 } };
  const h = game.hero;

  b.reset = () => Object.assign(b, { st: 'off', stT: 0, hp: BOSS.hp * (game.diff?.hp ?? 1), hpMax: BOSS.hp * (game.diff?.hp ?? 1), poise: BOSS.poise, steady: 0, atk: null, y: 0, vy: 0, pause: 0, lastHit: -1, flash: 0,
    x: GATE_X * 0.5, z: ARENA_RADIUS + 10, yaw: Math.PI });           // rides in from the gate side, just out of the arena
  b.alive = () => b.st !== 'off' && b.st !== 'dead';
  /** Ride out now (stage scripts call this when his goal starts; without one he comes on his own, below). */
  b.summon = () => { b.reset(); set('enter'); emit('boss:enter', { name: def.zh, en: def.en, x: b.x, z: b.z }); };
  b.rage = () => b.hp / b.hpMax < BOSS.rage;

  const set = (st) => { b.st = st; b.stT = 0; };
  const toHero = () => Math.atan2(h.x - b.x, h.z - b.z);
  const dist = () => Math.hypot(h.x - b.x, h.z - b.z);
  const turnTo = (yaw, k) => { let d = yaw - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, k / 60); };
  const move = (spd, yaw) => { b.x += Math.sin(yaw) * spd / 60; b.z += Math.cos(yaw) * spd / 60; };

  /** Called by combat.strike when a hero hit window covers him. */
  b.hurt = (hit, ox, oz, moveId) => {
    const musou = moveId === 'musou';
    b.hp = Math.max(0, b.hp - hit.dmg * game.combat.atkK(h) * (hit.fromProj ? BOSS.projK : 1));
    b.flash = 6;
    h.combo++; h.comboT = 90;
    if (h.state !== 'musou') h.musou = Math.min(h.musouMax, h.musou + 0.3);
    emit('hit', { i: -1, x: b.x, y: b.y + 1.6, z: b.z, dx: 0, dz: 0, dmg: hit.dmg, kb: 'flinch', move: moveId, combo: h.combo, killed: false, officer: false, heavy: !!hit.heavy });
    emit('boss:hit', { x: b.x, y: b.y + 1.6, z: b.z, dmg: hit.dmg, heavy: !!hit.heavy });
    if (b.hp <= 0) { set('dead'); b.atk = null; h.kos++; emit('boss:defeat', { x: b.x, z: b.z, name: def.zh }); return; }
    if (b.st === 'stagger' || b.st === 'enter' || b.steady > 0) return;
    b.poise -= (hit.dmg * (hit.heavy ? 1.6 : 1) + BOSS.poiseHit) * (musou ? 0.5 : 1);
    if (b.poise <= 0) { b.poise = BOSS.poise; b.atk = null; b.y = 0; b.vy = 0; set('stagger'); emit('boss:stagger', { x: b.x, z: b.z }); }
  };

  function startAttack() {
    const d = dist(), r = rng.next();
    const kind = d > 6 ? (r < 0.55 ? 'leap' : 'thrust') : r < 0.5 ? 'sweep' : r < 0.8 ? 'thrust' : 'leap';
    const A = BOSS[kind], k = b.rage() ? 0.72 : 1;
    b.atk = { kind, w: Math.round(A.f[0] * k), a: A.f[1], r: A.f[2], hit: -1 };
    b.yaw = toHero(); b.ax = h.x; b.az = h.z; b.seq++;
    set('attack');
    const dur = b.atk.w / 60;
    if (kind === 'sweep') emit('boss:warn', { kind, x: b.x, z: b.z, yaw: b.yaw, r: A.r, dur });
    else if (kind === 'thrust') emit('boss:warn', { kind, x: b.x, z: b.z, yaw: b.yaw, len: A.len + A.lunge * 0.5, w: A.w, dur });
    else emit('boss:warn', { kind, x: b.ax, z: b.az, yaw: b.yaw, r: A.r, dur: (b.atk.w + b.atk.a) / 60 });
  }
  function strikeHero(kind) {
    const A = BOSS[kind], dx = h.x - b.x, dz = h.z - b.z;
    let inside;
    if (kind === 'thrust') {
      const s = Math.sin(b.yaw), c = Math.cos(b.yaw), lz = dx * s + dz * c, lx = dx * c - dz * s;
      inside = lz > -0.5 && lz < 2.5 && Math.abs(lx) < A.w / 2 + 0.4;          // the blade tip just ahead as he lunges
    } else inside = Math.hypot(dx, dz) < A.r + 0.4;
    if (inside && h.y < 1.6) h.hurt(A.dmg, b.x, b.z, true);
    emit('boss:strike', { kind, x: b.x, z: b.z, yaw: b.yaw });
  }

  b.step = () => {
    if (b.flash > 0) b.flash--;
    if (b.st === 'off') {
      if (!game.campaign?.active && (game.frame > BOSS.arrive || h.kos >= BOSS.arriveKOs)) b.summon();
      return;
    }
    if (game.hitstop > 0) return;
    b.stT++;
    if (b.steady > 0) b.steady--;
    const t = b.stT;
    switch (b.st) {
      case 'enter':                                        // march out of the gate toward the arena
        turnTo(toHero(), BOSS.turn); move(BOSS.run, b.yaw);
        if (Math.hypot(b.x, b.z) < ARENA_RADIUS - 8 || t > 60 * 8) set('chase');
        break;
      case 'chase': {
        const d = dist();
        turnTo(toHero(), BOSS.turn * 1.5);
        if (b.pause > 0) { b.pause--; move(BOSS.walk * 0.4, b.yaw + Math.PI / 2 * (b.seq & 1 ? 1 : -1)); break; }
        if (d > BOSS.range) move(d > 8 ? BOSS.run : BOSS.walk * 1.4, b.yaw);
        if (d < BOSS.range + 0.6 || (d > 8 && t > 50 && rng.next() < 0.02)) startAttack();
        break;
      }
      case 'attack': {
        const A = b.atk, S = BOSS[A.kind];
        if (A.kind === 'leap') {
          if (t === A.w) { b.vy = 11; }                    // jump: arc onto the marked spot over the active frames
          if (t > A.w && t <= A.w + A.a) {
            const u = 1 / Math.max(1, A.w + A.a - t + 1);
            b.x += (b.ax - b.x) * u; b.z += (b.az - b.z) * u;
            b.vy -= 22 / 60; b.y = Math.max(0, b.y + b.vy / 60);
            if (t === A.w + A.a) { b.y = 0; b.vy = 0; strikeHero('leap'); }
          }
        } else if (A.kind === 'thrust') {
          if (t > A.w && t <= A.w + A.a) {
            move(S.lunge / A.a * 60, b.yaw);
            if ((t - A.w) % 4 === 1) strikeHero('thrust');
          }
        } else if (t > A.w && t <= A.w + A.a && (t - A.w - 1) % S.every === 0) strikeHero('sweep');
        if (t >= A.w + A.a + A.r) { b.atk = null; b.pause = b.rage() ? 30 : 60 + Math.round(rng.next() * 40); set('chase'); }   // room to strike back
        break;
      }
      case 'stagger':
        if (t >= BOSS.staggerF) { set('chase'); b.steady = BOSS.steady; }   // back on his feet: no stagger for a while
        break;
      default: break;
    }
    // stay in the arena, keep a body's width from the hero
    const r = Math.hypot(b.x, b.z);
    if (b.st !== 'enter' && r > ARENA_RADIUS) { b.x *= ARENA_RADIUS / r; b.z *= ARENA_RADIUS / r; }
    const dx = b.x - h.x, dz = b.z - h.z, d = Math.hypot(dx, dz);
    if (d < 1.2 && d > 1e-3 && b.y < 0.5) { b.x = h.x + dx / d * 1.2; b.z = h.z + dz / d * 1.2; }
    // animation bookkeeping (render reads it): which clip, normalised time
    const an = b.anim;
    if (b.st === 'attack') {
      const A = b.atk, u = Math.min(1, b.stT / (A.w + A.a + A.r));
      // his own moves: sweep = the tornado / whirlwind (c4), thrust = the piercing thrust (c3), leap = the plunge (c5)
      an.id = A.kind === 'sweep' ? 'c4' : A.kind === 'thrust' ? 'c3' : 'c5';
      an.t = A.kind === 'thrust' ? 0.14 + u * 0.6 : A.kind === 'leap' ? 0.1 + u * 0.6 : 0.1 + u * 0.8;
    } else if (b.st === 'stagger') { an.id = 'hurt'; an.t = Math.min(1, b.stT / BOSS.staggerF); }
    else if (b.st === 'dead') { an.id = 'hurt'; an.t = Math.min(1, b.stT / 40); }
    else if (b.st === 'enter' || (b.st === 'chase' && dist() > BOSS.range && b.pause <= 0)) {
      const was = an.id === 'run'; an.id = 'run'; an.t = (was ? an.t : 0) + 0.03;
    }
    else { an.id = 'idle'; an.t = (b.stT % 150) / 150; }
    an.seq = b.st === 'attack' ? b.seq : b.st;
  };
  return b;
}
