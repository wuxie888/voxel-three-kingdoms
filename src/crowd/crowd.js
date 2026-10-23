// Wei army (sim). Struct-of-arrays for every soldier.
//  · Squads: the army stands in rectangular blocks led by a 魏 standard-bearer and a captain. A director keeps
//    ~CROWD.engaged soldiers on the hero: only free soldiers standing in the ring count (+ a third of every block en
//    route), so a sweep releases the next block at once. It sends the nearest block marching in formation (it wheels
//    to face him), halts it for a beat, then it charges and folds into the ring.
//  · Ring: engaged soldiers hold an inner ring (1-1.5 H, 14-18 of them in 16 angular slots, 360° incl. the camera
//    side), a second row (2-3 H, 20-30, clear of the lens) or an outer crowd on the far side of the hero as the camera
//    sees it. Every 0.1 s a ring manager refills each row's whole deficit at once (an empty inner slot takes the
//    soldier nearest to it), so the ring re-closes within ~1-2 s of a sweep. CROWD.tokens soldiers step in to
//    attack (tokens favour soldiers the camera can see, off the line the hero swings along). Up to
//    CROWD.maxStrikers of them wind up at once; starts are jittered (CROWD.strikeGap, officers at half the gap), each
//    telegraphed by a 0.67 s wind-up, and every start makes the 3-5 guards nearest the striker raise their weapons,
//    shout and surge half a step in with him (c.raiseF). Posture over pressure: once a blow lands, the next
//    2.5-4 s of strikes are feints (c.feint: full wind-up, the blow stops short of him), so the ring keeps
//    threatening while only about one blow in 4-6 s connects. A flinch still cancels a wind-up.
//  · Reinforcements: while the ring is under strength and no block waits nearer, a column of 8-15 (with its bearer)
//    spawns 16-26 m out in front of the camera and runs in; `crowd:wave` announces it. Waves only run once a scenario
//    spawned an army or a ring.
//  · Arms (兵種): squads come as plain foot (spear, sword + buckler), a shield wall (大盾兵 in the front rank: a light
//    blow from the front clanks off; charge attacks, finishers and the Musou break it — combat.js) or a line of bows
//    (弓兵: they break ranks at bow range, keep 10-15 m off the hero, fall back when he closes in, and loose a few
//    arrows at a time — each a 0.8 s draw with a glint — that he can roll through or cut out of the air with a swing).
//    Horsemen (騎兵) ride free in troops: gallop passes through the hero that run him down if he stands in the way,
//    wheel round, come again; light blows glance off a rider, a heavy one, a charge attack or the Musou unhorses him
//    (he fights on foot, the horse runs loose — horse/horses.js). Troops raid from the haze every so often
//    (STAGE.enemy.cavalry).
// Reaction states (HURT..GETUP) are driven by src/combat; this module owns the rest.
import { rng } from '../core/rng.js';
import { emit } from '../core/events.js';
import { WALL_Z as WALL } from '../world/world.js';
import { ARENA_RADIUS, K } from '../world/field.js';
import { SET, RIVER, LEVEE, SOLIDS, pushOut } from '../world/setpieces.js';
import { STAGE } from '../stages/index.js';
import { HERO } from '../heroes/index.js';
// officer slot k's name [zh, en]: the stage's four by default (the hero never fights himself: enemy.swap), a stage
// script may give a slot a new man when it brings him on (spawnOfficer name)
const NAMES = () => STAGE.enemy.officers.map((o, i) => (i === 3 && STAGE.enemy.swap?.[HERO.id]) || o);
// far limit of the field: the castle wall, or the near bank where a river crosses the field (赤壁)
const WALL_Z = SET === 'river' ? RIVER.z0 + 2 : SET === 'flood' ? LEVEE.z0 + 0.5 : WALL;
export const FAR_Z = WALL_Z;

export const ST = { OFF: 0, IDLE: 1, ADVANCE: 2, GUARD: 3, ATTACK: 4, HURT: 5, KNOCK: 6, AIR: 7, DOWN: 8, GETUP: 9, DEAD: 10 };
export const isReacting = (s) => s >= ST.HURT && s <= ST.GETUP;
export const isAlive = (s) => s !== ST.OFF && s !== ST.DEAD;
/** Visual/role kind (type stays 0 grunt / 1 officer for combat). */
export const KIND = { SPEAR: 0, SWORD: 1, CAPTAIN: 2, BEARER: 3, OFFICER: 4, ARCHER: 5, SHIELD: 6, RIDER: 7 };
const SQ_HOLD = 1, SQ_MARCH = 2, SQ_HALT = 3, SQ_CHARGE = 4;
/** Squad make-up: plain foot, a shield wall in the front rank, a line of bows. */
export const MIX = { FOOT: 0, SHIELD: 1, ARCHER: 2 };
/** Soldiers outside the melee ring: standard-bearers, bows, horsemen (no ring seat, no strike token, no war cry). */
const offRing = (k) => k === KIND.BEARER || k === KIND.ARCHER || k === KIND.RIDER;

export const CROWD = {
  officers: 4,
  walk: 2.4, run: 4.8, march: 3.0, charge: 5.0, turn: 7,
  radius: 0.48, heroR: 0.8,
  bands: [[1.9, 2.8], [3.4, 5.6], [6.5, 10]], share: [0.4, 0.85], bandMin: [14, 20], bandMax: [18, 30],   // inner ring, second row, outer
  aggro: 9, officerAggro: 16,
  tokens: 3, attackRange: 1.7, maxStrikers: 2,               // ≤ 3 committed step in, ≤ 2 of them winding up at once
  strikeGap: [[40, 90], [30, 80]],                            // next start after 40-90 sf (hero calm) / 30-80 (he attacks)
  grace: [90, 150], rally: [3, 5], rallyTime: 44,              // feints for 1.5-2.5 s after a blow lands (× difficulty); guards raising
  windup: 40, strike: 40, recover: 24, cooldown: [110, 260], officerCd: [40, 90],  // strike lands 0.67 s after wind-up starts
  dmg: 11, officerDmg: 28, hp: 30, captainHp: 80, officerHp: 520,
  deadTime: 210, fieldR: ARENA_RADIUS + 16,
  engaged: 84, transit: 72,                                   // director target: soldiers on the hero; cap on blocks en route
  halt: 15, haltFrames: 36, fold: 7.5,                        // squad: halt at 15 m, then charge, fold at 7.5 m
  wave: [8, 15], waveEvery: [45, 110], waveDist: [16, 26],   // columns every 0.75 s below half strength, else 1.8 s
  mix: { shield: 0.25, archer: 0.12 },                        // share of squads that are a shield wall / a line of bows
  // 弓兵: range kept (m), back off inside `flee`, a 0.8 s draw, own cooldown, the volley clock (next draw anywhere),
  // at most `max` drawing at once; arrows fly at `speed` m/s (horizontal) with gravity g and lead a running hero by half
  archer: { hp: 26, aggro: 18, range: [10, 15], flee: 5.5, draw: 48, cd: [150, 270], gap: [34, 72], max: 2, fold: 20,
    speed: 24, g: 14, lead: 0.5, spread: 0.7, dmg: 5, stick: 150, pool: 48 },
  shield: { hp: 48, cone: 1.0, breakN: 3, open: 120 },        // 大盾兵: front cone (rad), the block that breaks it, open (sf)
  // 騎兵: passes through the hero `past` m beyond him, the hit when one runs him down, the pause before the next can;
  // troops of `size` raid every `every` sf (STAGE.enemy.cavalry overrides), at most `cap` riding at once
  rider: { hp: 110, aggro: 34, speed: 10.5, turn: 2.4, past: 14, reach: 1.5, dmg: 14, cd: 70, r: 0.85,
    troops: 1, every: 3000, size: [3, 4], cap: 10 },
};
const DT = 1 / 60;
const CELL = 1.2, GRID = 128, HALF = GRID * CELL / 2;
const MAXSQ = 64;

export function createCrowd(game, grunts = 300) {
  const N = grunts + CROWD.officers;
  const F = (n = N) => new Float64Array(n), I = (n = N) => new Int32Array(n);
  const c = {
    N, grunts,
    x: F(), z: F(), y: F(), vx: F(), vz: F(), vy: F(), yaw: F(), hp: F(), hpMax: F(),
    st: I(), stT: I(), type: I(), kind: I(), token: I(), cd: I(), hs: I(), flash: I(),
    rx: F(), rxV: F(), spinV: F(), pref: F(), band: I(), aggro: F(), phase: F(), hurtDur: I(), bounce: I(),
    lastHit: I(), strafe: F(), kod: I(), tokT: I(), ang: F(), seated: I(),
    squad: I(), slotX: F(), slotZ: F(), form: I(),
    sq: { x: F(MAXSQ), z: F(MAXSQ), face: F(MAXSQ), st: I(MAXSQ), t: I(MAXSQ), base: I(MAXSQ), mix: I(MAXSQ), n: 0 },   // base: k + 1 for a camp's garrison
    raiseF: I(), feint: I(), wind: I(),                         // raiseF: rallying until (render + ring surge); feint strike; winding up
    armorF: I(),                                                // officers: armoured (no stagger) until this frame (combat breakout)
    frozen: I(),                                                // frames left frozen solid (冰 weapons, combat.js): no AI, no reaction
    openF: I(),                                                 // 大盾兵: shield knocked aside until this frame (combat.js)
    wx: F(), wz: F(),                                           // 騎兵: the far end of the pass he is riding
    waveT: 0, tokensUsed: 0, strikeF: 0, gap: 0, graceF: 0, heroHp: 0, wavesOn: false, engaged: 0,
    arrowF: 0, raidF: 0,                                        // next draw allowed anywhere on the field / next cavalry raid
    arrows: [],                                                 // { x, y, z, vx, vy, vz, t, life, stuck } in flight or stuck in the ground
    names: NAMES(),
  };
  const CAV = { ...CROWD.rider, ...(STAGE.enemy.cavalry || {}) }, MIXW = { ...CROWD.mix, ...(STAGE.enemy.mix || {}) };
  const MV = new Float64Array(2);                               // archer / rider steering out
  const head = new Int32Array(GRID * GRID), next = new Int32Array(N);
  const scripted = () => !!game.campaign?.active;
  const px = new Float64Array(N), pz = new Float64Array(N), sqAlive = new Int32Array(MAXSQ);
  let holdNear = false;

  function place(i, x, z, engaged, kind) {
    const off = i >= grunts;
    if (off) kind = KIND.OFFICER;
    c.x[i] = x; c.z[i] = Math.min(z, WALL_Z - 2.5); c.y[i] = 0; c.vx[i] = c.vz[i] = c.vy[i] = 0;
    c.yaw[i] = Math.atan2(game.hero.x - x, game.hero.z - z);
    c.type[i] = off ? 1 : 0; c.kind[i] = kind;
    c.hpMax[i] = c.hp[i] = off ? CROWD.officerHp * (game.diff?.hp ?? 1) : kind === KIND.CAPTAIN ? CROWD.captainHp
      : kind === KIND.ARCHER ? CROWD.archer.hp : kind === KIND.SHIELD ? CROWD.shield.hp : kind === KIND.RIDER ? CAV.hp : CROWD.hp;
    c.st[i] = engaged ? ST.ADVANCE : ST.IDLE; c.stT[i] = rng.int(0, 60);
    c.token[i] = 0; c.cd[i] = rng.int(0, 120); c.hs[i] = 0; c.flash[i] = 0; c.raiseF[i] = 0; c.feint[i] = 0; c.wind[i] = 0; c.armorF[i] = 0; c.frozen[i] = 0; c.openF[i] = 0;
    c.rx[i] = c.rxV[i] = c.spinV[i] = 0; c.bounce[i] = 0; c.lastHit[i] = -1; c.kod[i] = 0;
    const r = rng.next();
    if (kind === KIND.BEARER) { c.band[i] = 2; c.pref[i] = rng.range(7, 11); }
    else if (kind === KIND.ARCHER) { c.band[i] = 2; c.pref[i] = rng.range(CROWD.archer.range[0], CROWD.archer.range[1]); c.seated[i] = 0; }
    else if (kind === KIND.RIDER) { c.band[i] = 2; c.pref[i] = 0; c.seated[i] = 0; c.wx[i] = x; c.wz[i] = z; }
    else setBand(i, off ? 0 : r < CROWD.share[0] ? 0 : r < CROWD.share[1] ? 1 : 2);
    c.aggro[i] = off ? CROWD.officerAggro : kind === KIND.ARCHER ? CROWD.archer.aggro : kind === KIND.RIDER ? CAV.aggro : CROWD.aggro;
    c.phase[i] = rng.range(0, 6.28);
    c.strafe[i] = rng.chance(0.5) ? 1 : -1;
    c.squad[i] = -1; c.form[i] = 0;
  }
  function setBand(i, k) { c.band[i] = k; c.pref[i] = rng.range(CROWD.bands[k][0], CROWD.bands[k][1]); c.seated[i] = 0; }
  const gruntKind = () => { const r = rng.next(); return r < 0.05 ? KIND.CAPTAIN : r < 0.42 ? KIND.SWORD : KIND.SPEAR; };

  c.reset = () => {
    c.names = NAMES();
    c.st.fill(ST.OFF); c.token.fill(0); c.tokensUsed = 0; c.strikeF = 0; c.gap = 0; c.graceF = 0; c.heroHp = game.hero.hp; c.waveT = 0; c.sq.n = 0; c.wavesOn = false;
    c.arrows.length = 0; c.arrowF = 0; c.raidF = game.frame + 3600;   // the first cavalry raid a minute in
  };

  function freeSlots(officer) {
    const out = [];
    const [a, b] = officer ? [grunts, N] : [0, grunts];
    for (let i = a; i < b; i++) if (c.st[i] === ST.OFF) out.push(i);
    return out;
  }

  /** New squad at (sx, sz) facing `face`; members fill a block `cols` wide, 1.15 m apart; bearer ahead, captain on
   *  the front-left (`plain`: neither, every man of the mix). `mix` (MIX): plain foot, a shield wall in the front rank,
   *  a line of bows. Returns the squad id (or -1 when the table is full). */
  function makeSquad(slots, sx, sz, face, cols, st, mix = MIX.FOOT, plain = false) {
    let q = -1;
    for (let k = 0; k < c.sq.n; k++) if (!c.sq.st[k]) { q = k; break; }
    if (q < 0) { if (c.sq.n >= MAXSQ) return -1; q = c.sq.n++; }
    c.sq.x[q] = sx; c.sq.z[q] = sz; c.sq.face[q] = face; c.sq.st[q] = st; c.sq.t[q] = 0; c.sq.base[q] = 0; c.sq.mix[q] = mix;
    const sn = Math.sin(face), cs = Math.cos(face), k0 = plain ? 0 : 1;
    const rows = Math.ceil((slots.length - k0) / cols);
    slots.forEach((i, k) => {
      let lx, lz, kind;
      if (k < k0) { lx = 0; lz = 1.5; kind = KIND.BEARER; }
      else {
        const m = k - k0, r = Math.floor(m / cols), q2 = m % cols;
        lx = (q2 - (cols - 1) / 2) * 1.15 + rng.range(-0.12, 0.12); lz = -r * 1.15 + rng.range(-0.12, 0.12) + (rows - 1) * 0.3;
        kind = m === 0 && !plain ? KIND.CAPTAIN : mix === MIX.ARCHER ? KIND.ARCHER : mix === MIX.SHIELD && r === 0 ? KIND.SHIELD : gruntKind();
        if (kind === KIND.CAPTAIN && (m !== 0 || plain)) kind = KIND.SPEAR;
      }
      place(i, sx + lx * cs + lz * sn, sz - lx * sn + lz * cs, false, kind);
      c.squad[i] = q; c.slotX[i] = lx; c.slotZ[i] = lz; c.form[i] = 1;
      c.yaw[i] = face;
      if (st !== SQ_HOLD) c.st[i] = ST.ADVANCE;
    });
    return q;
  }

  /** Squads spread over the field around (cx, cz): the default army layout. One big block waits in front of the
   *  camera (toward the castle), most other squads stand on that side too, a few flank and close the rear. */
  c.spawnArmy = (count = grunts, cx = 0, cz = 0, near = 7) => {
    c.wavesOn = true;
    const g0 = freeSlots(false).length;
    game.bases?.garrison();                                    // the camps' garrisons first (stages/bases.js)
    const cav = Math.min(CAV.troops * CAV.size[1], Math.floor(count / 20));   // slots kept for the cavalry troops
    const slots = freeSlots(false).slice(0, Math.max(0, count - (g0 - freeSlots(false).length) - cav));
    const fwd = game.cam.yaw;
    let k = 0, n = 0;
    while (k < slots.length) {
      const big = n === 0 && slots.length >= 120;
      const size = Math.min(slots.length - k, big ? rng.int(50, 60) : rng.int(18, 30));
      const a = big ? fwd + rng.range(-0.25, 0.25) : n % 3 === 2 ? fwd + Math.PI + rng.range(-1.4, 1.4) : fwd + rng.range(-1.8, 1.8);
      const d = big ? rng.range(24, 28) : rng.range(near + 4, 34 * Math.sqrt(K));       // a bigger field spreads the blocks wider
      let sx = cx + Math.sin(a) * d, sz = cz + Math.cos(a) * d;
      sz = Math.min(sz, WALL_Z - 6);
      const face = Math.atan2(cx - sx, cz - sz);
      makeSquad(slots.slice(k, k + size), sx, sz, face, big ? 10 : Math.max(4, Math.round(Math.sqrt(size * 1.6))), SQ_HOLD, big ? MIX.SHIELD : pickMix());
      k += size; n++;
    }
    // cavalry troops waiting further out (they ride when he comes within their aggro)
    for (let t = 0; t < CAV.troops; t++) {
      const a = fwd + rng.range(-2.2, 2.2), d = rng.range(32, 46) * Math.sqrt(K);
      let sx = cx + Math.sin(a) * d, sz = cz + Math.cos(a) * d;
      const r = Math.hypot(sx, sz), lim = CROWD.fieldR - 22;
      if (r > lim) { sx *= lim / r; sz *= lim / r; }
      c.spawnRiders(rng.int(CAV.size[0], CAV.size[1]), sx, Math.min(sz, WALL_Z - 8), false);
    }
    if (scripted()) return;                                     // a stage script brings the named officers on itself
    for (const i of freeSlots(true)) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(12, 30);
      place(i, cx + Math.cos(a) * d, cz + Math.sin(a) * d, false);
    }
  };

  /** Camp k's garrison: a shield wall of n standing at (x, z), facing the middle of the field, with a few bows behind
   *  it; the director leaves them be (they come out when the hero walks into the camp). */
  c.spawnGarrison = (k, x, z, n) => {
    const slots = freeSlots(false).slice(0, n);
    if (slots.length < 3) return;
    const face = Math.atan2(-x, -z), na = slots.length >= 12 ? 4 : 0;
    const q = makeSquad(slots.slice(0, slots.length - na), x, z, face, 4, SQ_HOLD, MIX.SHIELD);
    if (q >= 0) c.sq.base[q] = k + 1;
    if (na) {
      const q2 = makeSquad(slots.slice(-na), x - Math.sin(face) * 4.5, z - Math.cos(face) * 4.5, face, na, SQ_HOLD, MIX.ARCHER, true);
      if (q2 >= 0) c.sq.base[q2] = k + 1;
    }
  };
  /** A troop of n horsemen at (x, z): free riders who wait for the hero to come within their aggro (`engaged`: they
   *  ride at once — a raid). Returns how many came. */
  c.spawnRiders = (n, x, z, engaged) => {
    let riding = 0;
    for (let i = 0; i < grunts; i++) if (c.kind[i] === KIND.RIDER && isAlive(c.st[i])) riding++;
    const slots = freeSlots(false).slice(0, Math.max(0, Math.min(n, CAV.cap - riding)));
    slots.forEach((i, k) => place(i, x + (k % 2 ? 1.8 : -1.8) * Math.ceil(k / 2), z - k * 1.2, engaged, KIND.RIDER));
    if (engaged && slots.length) emit('crowd:cavalry', { count: slots.length, x, z });
    return slots.length;
  };
  /** A rider thrown from the saddle fights on foot (sword and buckler); his horse runs loose (horse/horses.js). */
  c.unhorse = (i) => {
    const v = Math.hypot(c.vx[i], c.vz[i]);
    c.kind[i] = KIND.SWORD; c.aggro[i] = CROWD.aggro; setBand(i, 1);
    game.horses?.free(c.x[i], c.z[i], c.yaw[i], v);
    emit('rider:fall', { i, x: c.x[i], z: c.z[i], v });
  };
  function pickMix() { const r = rng.next(); return r < MIXW.archer ? MIX.ARCHER : r < MIXW.archer + MIXW.shield ? MIX.SHIELD : MIX.FOOT; }
  /** A camp's 據點兵長 steps out at (x, z) with hp (a captain who makes for the hero). Returns his index (-1: no room). */
  c.spawnCaptain = (x, z, hp) => {
    const i = freeSlots(false)[0];
    if (i == null) return -1;
    place(i, x, z, true, KIND.CAPTAIN);
    c.hpMax[i] = c.hp[i] = hp; setBand(i, 0);
    return i;
  };

  /** Named officer k (c.names[k]; `name` [zh, en] puts a new man in the slot) joins the fight at (x, z) and makes for
   *  the hero, hp × hpK; up to `escort` free soldiers run in behind him as a column (stage scripts, stages/campaign.js). */
  c.spawnOfficer = (k, x, z, { hpK = 1, escort = 0, name = null } = {}) => {
    const i = grunts + k;
    if (name) c.names[k] = name;
    z = Math.min(z, WALL_Z - 4);
    place(i, x, z, true);
    c.hpMax[i] = c.hp[i] = c.hpMax[i] * hpK;
    const col = freeSlots(false).slice(0, escort);
    if (col.length >= 4) {
      const face = Math.atan2(game.hero.x - x, game.hero.z - z);
      makeSquad(col, x - Math.sin(face) * 3, z - Math.cos(face) * 3, face, 3, SQ_CHARGE);
    }
    return i;
  };

  /** Ring of engaged soldiers around the hero (crowd-fight / musou scenarios, debug.spawnRing). */
  c.spawnRing = (count, radius) => {
    c.wavesOn = true;
    const slots = freeSlots(false).slice(0, count);
    const hx = game.hero.x, hz = game.hero.z;
    slots.forEach((i, k) => {
      const ring = Math.floor(k / 24), a = (k % 24) / 24 * Math.PI * 2 + ring * 0.13;
      const d = radius + ring * 1.1 + rng.range(-0.2, 0.2);
      place(i, hx + Math.cos(a) * d, hz + Math.sin(a) * d, true, k % 23 === 11 ? KIND.BEARER : gruntKind());
    });
  };

  c.clear = () => { c.st.fill(ST.OFF); c.token.fill(0); c.tokensUsed = 0; c.sq.n = 0; };

  /** Nearest alive enemy within maxR whose bearing is within `cone` radians of `yaw` (or any if cone >= π). */
  c.nearest = (x, z, maxR, yaw = 0, cone = Math.PI) => {
    let best = -1, bd = maxR * maxR;
    for (let i = 0; i < N; i++) {
      const s = c.st[i];
      if (s === ST.OFF || s === ST.DEAD) continue;
      const dx = c.x[i] - x, dz = c.z[i] - z, d2 = dx * dx + dz * dz;
      if (d2 >= bd) continue;
      if (cone < Math.PI) {
        let da = Math.atan2(dx, dz) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > cone) continue;
      }
      bd = d2; best = i;
    }
    return best;
  };

  c.counts = () => {
    let alive = 0, active = 0;
    for (let i = 0; i < N; i++) {
      const s = c.st[i];
      if (s === ST.OFF || s === ST.DEAD) continue;
      alive++;
      if (s !== ST.IDLE) active++;
    }
    return { alive, active };
  };

  function releaseToken(i) { if (c.token[i]) { c.token[i] = 0; c.tokensUsed--; } }
  c.releaseToken = releaseToken;

  function setSt(i, s) { c.st[i] = s; c.stT[i] = 0; }

  c.step = () => {
    const h = game.hero, frozen = game.freeze > 0;
    if (game.freeze > 0) game.freeze--;
    if (!frozen) squads(h);
    // a blow landed: the next strikes are feints for a while (the ring threatens, the hero keeps fighting)
    if (h.hp < c.heroHp) c.graceF = game.frame + Math.round(rng.int(CROWD.grace[0], CROWD.grace[1]) * (game.diff?.grace ?? 1));
    c.heroHp = h.hp;
    let strikers = 0;
    drawing = 0;
    for (let i = 0; i < N; i++) if (c.st[i] === ST.ATTACK) { if (c.kind[i] === KIND.ARCHER) drawing++; else if (c.stT[i] < CROWD.strike) strikers++; }
    const busy = h.state === 'attack';
    // ---- AI
    for (let i = 0; i < N; i++) {
      const s = c.st[i];
      if (s === ST.OFF) continue;
      if (c.flash[i] > 0) c.flash[i]--;
      if (c.hs[i] > 0) { c.hs[i]--; continue; }
      if (c.frozen[i] > 0) { c.frozen[i]--; if (c.wind[i]) c.wind[i] = 0; continue; }   // iced: no step, no swing
      if (frozen) continue;
      c.stT[i]++;
      if (s === ST.DEAD) {
        if (c.stT[i] > CROWD.deadTime) { c.st[i] = ST.OFF; releaseToken(i); }
        continue;
      }
      if (isReacting(s)) {
        if (c.wind[i] && c.kind[i] !== KIND.ARCHER) c.strikeF = Math.min(c.strikeF, game.frame - c.gap + 20);   // swing knocked out of him: next one soon
        c.wind[i] = 0;
        releaseToken(i); c.form[i] = 0; continue;
      }
      if (c.cd[i] > 0) c.cd[i]--;
      const dx = h.x - c.x[i], dz = h.z - c.z[i], d = Math.hypot(dx, dz) || 1e-6;
      const face = Math.atan2(dx, dz);
      let vx = 0, vz = 0;
      if (c.form[i]) {
        // in formation: hold / march to the squad slot, facing the squad's heading
        const q = c.squad[i], f = c.sq.face[q], sn = Math.sin(f), cs = Math.cos(f);
        const tx = c.sq.x[q] + c.slotX[i] * cs + c.slotZ[i] * sn, tz = c.sq.z[q] - c.slotX[i] * sn + c.slotZ[i] * cs;
        const ex = tx - c.x[i], ez = tz - c.z[i], e = Math.hypot(ex, ez);
        const cap = c.sq.st[q] === SQ_CHARGE ? CROWD.charge * 1.15 : CROWD.run;
        if (e > 0.06) { const sp = Math.min(cap, e * 4); vx = ex / e * sp; vz = ez / e * sp; }
        turn(i, f, 3);
        if (s === ST.IDLE && c.sq.st[q] > SQ_HOLD) setSt(i, ST.ADVANCE);  // the block got its orders
        else if (s === ST.IDLE && d < c.aggro[i]) c.sq.st[q] = SQ_CHARGE;   // hero walked into the block: it charges
      } else if (s === ST.IDLE) {
        if (d < c.aggro[i]) setSt(i, ST.ADVANCE);
        turn(i, face, 1.5);
      } else if (c.kind[i] === KIND.ARCHER) {
        archer(i, s, h, d, dx, dz); vx = MV[0]; vz = MV[1];
      } else if (c.kind[i] === KIND.RIDER) {
        rider(i, s, h, d, dx, dz); vx = MV[0]; vz = MV[1];
      } else if (s === ST.ATTACK) {
        const t = c.stT[i];
        turn(i, face, t < CROWD.windup - 8 ? CROWD.turn : 0);
        if (t === CROWD.strike) {
          c.wind[i] = 0;
          if (!c.feint[i]) game.combat.enemyStrike(i);
          else emit('enemy:attack', { i, x: c.x[i], y: 1.1, z: c.z[i], officer: c.type[i] === 1, feint: 1 });   // a swing at the air
        }
        // creep into reach (a feint stops a pace short: the blow cuts the air in front of him)
        const reach = c.feint[i] ? 2.45 : CROWD.attackRange - 0.2;
        if (t < CROWD.windup - 6 && d > reach) { vx = dx / d * CROWD.walk; vz = dz / d * CROWD.walk; }
        else if (c.feint[i] && t < CROWD.windup + 8 && d < reach - 0.3) { vx = -dx / d * 1.2; vz = -dz / d * 1.2; }
        if (t >= CROWD.windup + CROWD.recover) {
          const cd = c.type[i] ? CROWD.officerCd : CROWD.cooldown;
          setSt(i, ST.GUARD); releaseToken(i); c.cd[i] = rng.int(cd[0], cd[1]);
        }
      } else if (c.kind[i] === KIND.BEARER) {
        // standard-bearers keep to the far side of the fight as the camera sees it: banners over the crowd, never
        // between the camera and the hero; each keeps his own bearing (golden-ratio spread over ±1.3 rad) so several
        // banners stand apart over the crowd instead of bunching
        const a = game.cam.yaw + c.strafe[i] * (0.25 + 1.05 * ((i * 0.618034) % 1) + 0.12 * Math.sin(game.frame * 0.004 + i));
        const ex = h.x + Math.sin(a) * c.pref[i] - c.x[i], ez = h.z + Math.cos(a) * c.pref[i] - c.z[i], e = Math.hypot(ex, ez);
        if (e > 0.6) {
          const sp = e > 5 ? CROWD.run : CROWD.walk;
          vx = ex / e * sp; vz = ez / e * sp;
          if (s !== ST.ADVANCE) setSt(i, ST.ADVANCE);
        } else if (s !== ST.GUARD) setSt(i, ST.GUARD);
        turn(i, face, CROWD.turn);
      } else {
        // ADVANCE / GUARD: hold a ring at the preferred distance (with a slow in/out shuffle); token holders close in
        const shuffle = Math.sin(game.frame * 0.021 + c.phase[i] * 3) * 0.4;
        // rallying guards surge half a step in on the striker's beat
        const want = c.token[i] ? CROWD.attackRange * 0.85 : c.pref[i] + shuffle - (game.frame < c.raiseF[i] ? 0.55 : 0);
        let tx = dx, tz = dz, e = d - want;                        // default: straight at the hero
        // a bearing to hold: the inner ring its slot from rings() (360°, camera side included); the outer crowd its
        // own spot on the far side of the hero as the camera sees it (in view, behind the fight)
        let tA = NaN;
        if (!c.token[i]) {
          if (!c.band[i] && c.seated[i] && d < want + 3) tA = c.ang[i];
          else if (c.band[i] === 2 && d < want + 6) tA = game.cam.yaw + c.strafe[i] * (0.15 + 1.35 * ((i * 0.618034) % 1));
        }
        if (tA === tA) {
          // walk round the hero (≤ 0.45 rad per look-ahead) instead of through the fight
          const ra = Math.atan2(-dx, -dz);
          let da = tA - ra; da = Math.atan2(Math.sin(da), Math.cos(da));
          const ta = ra + Math.max(-0.45, Math.min(0.45, da));
          tx = h.x + Math.sin(ta) * want - c.x[i]; tz = h.z + Math.cos(ta) * want - c.z[i]; e = Math.hypot(tx, tz);
        }
        let faceTo = face;
        if (e > 0.35) {
          const sp = e > 1.2 ? CROWD.run : CROWD.walk * (c.type[i] ? 0.9 : 1);   // run to close the ring, walk the last metre
          const tl = Math.hypot(tx, tz) || 1e-6;
          vx = tx / tl * sp; vz = tz / tl * sp;
          if (sp === CROWD.run) faceTo = Math.atan2(vx, vz);        // running round the ring: look where he runs
          if (s !== ST.ADVANCE) setSt(i, ST.ADVANCE);
        } else {
          const fx = Math.sin(game.cam.yaw), fz = Math.cos(game.cam.yaw);
          if (d < want - 0.45) { vx = -dx / d * 1.3; vz = -dz / d * 1.3; }
          else if (c.band[i] && (-dx * fx - dz * fz) / d < (c.band[i] === 2 ? -0.1 : -0.75)) {
            // the outer crowd drifts round to the far side of the hero (in view); the second row only clears the
            // sector right in front of the lens; the inner ring stays 360°
            let tx = dz / d, tz = -dx / d;
            if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
            vx = tx * 1.5; vz = tz * 1.5;
          } else if (((c.stT[i] + i * 7) % 240) < 70) {           // occasional sidestep around the hero
            vx = -dz / d * 0.9 * c.strafe[i]; vz = dx / d * 0.9 * c.strafe[i];
          }
          if (s !== ST.GUARD) setSt(i, ST.GUARD);
        }
        // token holder within a step of reach swings when the strike clock allows (officers at half the gap); the
        // wind-up closes the last metre
        // while the boss is on the field the ring keeps to one striker at a time: the duel is with him
        if (c.token[i] && d <= CROWD.attackRange + 0.9 && c.cd[i] === 0 && !h.y && strikers < (game.boss?.alive() ? 1 : CROWD.maxStrikers) &&
            h.state !== 'hurt' && game.frame - c.strikeF >= (c.type[i] ? c.gap >> 1 : c.gap)) {
          setSt(i, ST.ATTACK); c.wind[i] = 1; c.feint[i] = game.frame < c.graceF ? 1 : 0; strikers++;
          const g = CROWD.strikeGap[busy ? 1 : 0], gk = game.diff?.gap ?? 1;
          c.strikeF = game.frame; c.gap = Math.round(rng.int(g[0], g[1]) * gk);
          rally(i);
        }
        turn(i, faceTo, CROWD.turn);
      }
      c.vx[i] = vx; c.vz[i] = vz;
      c.x[i] += vx * DT; c.z[i] += vz * DT;
      c.phase[i] += Math.hypot(vx, vz) * DT * 3.2;
      if (c.kind[i] === KIND.RIDER) keepIn(i);                  // riders skip the crowd push (separate), so the field holds them here
    }
    if (!frozen) {
      // a token that doesn't turn into a strike within 3 s goes back to the pool
      for (let i = 0; i < N; i++) if (c.token[i] && c.st[i] !== ST.ATTACK && ++c.tokT[i] > 180) { releaseToken(i); c.cd[i] = 60; }
      if (game.frame % 6 === 0) rings(h);
      grantTokens(h);
      separate(h);
      waves(h);
      raids(h);
      arrows(h);
    }
  };

  // ---- 弓兵: keep bow range, fall back when he closes in, work round into the camera's view, loose on the volley clock
  let drawing = 0;
  function archer(i, s, h, d, dx, dz) {
    const A = CROWD.archer, face = Math.atan2(dx, dz);
    MV[0] = MV[1] = 0;
    if (s === ST.ATTACK) {                                      // drawing: planted, tracking him; the arrow goes at A.draw
      turn(i, face, CROWD.turn);
      if (c.stT[i] === A.draw) { c.wind[i] = 0; loose(i, h, d); }
      if (c.stT[i] >= A.draw + 14) { setSt(i, ST.GUARD); c.cd[i] = rng.int(A.cd[0], A.cd[1]); }
      return;
    }
    const fx = Math.sin(game.cam.yaw), fz = Math.cos(game.cam.yaw), px = -dx / d, pz = -dz / d;
    const vis = px * fx + pz * fz;                              // 1 = beyond the hero, straight up the view
    let tx = 0, tz = 0, sp = 0;
    if (d < A.flee) { tx = px; tz = pz; sp = CROWD.run * 0.85; }                  // he is on us: fall back
    else if (d > c.pref[i] + 2.5) { tx = -px; tz = -pz; sp = CROWD.run; }         // close to bow range
    else if (d < c.pref[i] - 2.5) { tx = px; tz = pz; sp = CROWD.walk; }
    if (vis < -0.2) {                                           // behind the lens: work round to where he can see us
      let ux = fx - vis * px, uz = fz - vis * pz, ul = Math.hypot(ux, uz);
      if (ul < 0.2) { ux = pz * c.strafe[i]; uz = -px * c.strafe[i]; ul = 1; }
      tx += ux / ul; tz += uz / ul; sp = Math.max(sp, CROWD.walk * 1.3);
    }
    const tl = Math.hypot(tx, tz);
    if (sp > 0 && tl > 1e-3) {
      MV[0] = tx / tl * sp; MV[1] = tz / tl * sp;
      if (s !== ST.ADVANCE) setSt(i, ST.ADVANCE);
      turn(i, sp > CROWD.walk + 0.5 ? Math.atan2(MV[0], MV[1]) : face, CROWD.turn);
    } else {
      if (s !== ST.GUARD) setSt(i, ST.GUARD);
      turn(i, face, CROWD.turn);
    }
    // the volley clock: a draw starts anywhere on the field every 0.4-1 s (× difficulty), a few at a time, only from
    // bows he can see (one at a time while the boss duels him)
    const max = game.boss?.alive() ? 1 : A.max;
    if (c.cd[i] === 0 && d > A.flee && d < A.range[1] + 7 && vis > -0.3 && drawing < max && game.frame >= c.arrowF && h.state !== 'dead') {
      setSt(i, ST.ATTACK); c.wind[i] = 1; drawing++;
      c.arrowF = game.frame + Math.round(rng.int(A.gap[0], A.gap[1]) * (game.diff?.gap ?? 1));
    }
  }
  /** The arrow leaves the bow: aimed where he will be (half the lead), with a little scatter. */
  function loose(i, h, d) {
    const A = CROWD.archer, y0 = 1.45;
    const sx = c.x[i] + Math.sin(c.yaw[i]) * 0.45, sz = c.z[i] + Math.cos(c.yaw[i]) * 0.45, T0 = d / A.speed;
    const tx = h.x + h.vx * T0 * A.lead + rng.range(-A.spread, A.spread), tz = h.z + h.vz * T0 * A.lead + rng.range(-A.spread, A.spread);
    const ex = tx - sx, ez = tz - sz, T = Math.max(0.2, Math.hypot(ex, ez) / A.speed), ty = h.y + 1.05;
    if (c.arrows.length >= A.pool) c.arrows.shift();
    c.arrows.push({ x: sx, y: y0, z: sz, vx: ex / T, vy: (ty - y0 + 0.5 * A.g * T * T) / T, vz: ez / T, t: 0, life: Math.ceil(T * 60) + 50, stuck: 0 });
    emit('arrow:loose', { i, x: sx, y: y0, z: sz });
  }
  /** Arrows in flight: one that reaches him stings (no stagger; a roll or the Musou lets it through), one he swings into
   *  from the front is cut out of the air; the rest stick in the ground a while. */
  function arrows(h) {
    const A = CROWD.archer, L = c.arrows, hs = Math.sin(h.yaw), hc = Math.cos(h.yaw);
    for (let k = L.length - 1; k >= 0; k--) {
      const a = L[k];
      a.t++;
      if (a.stuck) { if (a.t > A.stick) L.splice(k, 1); continue; }
      a.vy -= A.g * DT; a.x += a.vx * DT; a.y += a.vy * DT; a.z += a.vz * DT;
      const ex = a.x - h.x, ez = a.z - h.z;
      if (ex * ex + ez * ez < 0.2 && a.y > h.y + 0.1 && a.y < h.y + 1.9 && h.state !== 'dead') {
        const v = Math.hypot(a.vx, a.vz) || 1;
        if (h.state === 'attack' && -(hs * a.vx + hc * a.vz) / v > 0.35) {        // cut down mid-swing
          emit('arrow:deflect', { x: a.x, y: a.y, z: a.z });
          L.splice(k, 1); continue;
        }
        if (h.hurt(A.dmg, a.x - a.vx * 0.2, a.z - a.vz * 0.2, false, 'arrow')) { emit('arrow:hit', { x: a.x, y: a.y, z: a.z }); L.splice(k, 1); continue; }
      }
      if (a.y <= 0.04) { a.y = 0.04; a.stuck = 1; a.t = 0; emit('arrow:ground', { x: a.x, z: a.z }); continue; }
      if (a.t > a.life) L.splice(k, 1);
    }
  }

  // ---- 騎兵: gallop passes through the hero, `past` m beyond him, then wheel round for the next
  function rider(i, s, h, d, dx, dz) {
    let ex = c.wx[i] - c.x[i], ez = c.wz[i] - c.z[i], e = Math.hypot(ex, ez);
    if (s !== ST.ADVANCE || e < 3 || c.stT[i] > 420) {          // line up the next pass
      const a = Math.atan2(dx, dz) + rng.range(-0.25, 0.25);
      let tx = h.x + Math.sin(a) * CAV.past, tz = h.z + Math.cos(a) * CAV.past;
      const r = Math.hypot(tx, tz), lim = CROWD.fieldR - 22;
      if (r > lim) { tx *= lim / r; tz *= lim / r; }
      c.wx[i] = tx; c.wz[i] = Math.min(tz, WALL_Z - 6);
      setSt(i, ST.ADVANCE);
      ex = c.wx[i] - c.x[i]; ez = c.wz[i] - c.z[i]; e = Math.hypot(ex, ez) || 1e-6;
    }
    const want = Math.atan2(ex, ez);
    let da = want - c.yaw[i]; da = Math.atan2(Math.sin(da), Math.cos(da));
    turn(i, want, CAV.turn);
    const sp = CAV.speed * (1 - 0.5 * Math.min(1, Math.abs(da) / 1.6));   // rein in through the wheel
    MV[0] = Math.sin(c.yaw[i]) * sp; MV[1] = Math.cos(c.yaw[i]) * sp;
    // running him down: in reach, in front of the horse, on his feet
    if (d < CAV.reach && c.cd[i] === 0 && h.y < 1 && (dx * Math.sin(c.yaw[i]) + dz * Math.cos(c.yaw[i])) / d > 0.3) {
      c.cd[i] = CAV.cd; game.combat.trample(i);
    }
  }
  function keepIn(i) {
    const r = Math.hypot(c.x[i], c.z[i]), lim = CROWD.fieldR - 6;
    if (r > lim) { c.x[i] *= lim / r; c.z[i] *= lim / r; }
    if (c.z[i] > WALL_Z - 3) c.z[i] = WALL_Z - 3;
    if (SOLIDS.length) { const o = pushOut(c.x[i], c.z[i], 1.0); if (o) { c.x[i] = o[0]; c.z[i] = o[1]; } }
  }
  /** Cavalry raids: a troop rides in from a camp gate near him, or out of the haze in front of the camera. */
  function raids(h) {
    if (!CAV.every || !c.wavesOn || game.frame < c.raidF || h.state === 'dead') return;
    c.raidF = game.frame + Math.round(CAV.every * rng.range(0.8, 1.25));
    if (game.boss?.alive()) return;
    const a = game.cam.yaw + rng.range(-0.8, 0.8), d = rng.range(34, 42);
    let sx = h.x + Math.sin(a) * d, sz = h.z + Math.cos(a) * d;
    const gate = game.bases?.source(h);
    if (gate) { sx = gate[0]; sz = gate[1]; }
    const r = Math.hypot(sx, sz), lim = CROWD.fieldR - 20;
    if (r > lim) { sx *= lim / r; sz *= lim / r; }
    c.spawnRiders(rng.int(CAV.size[0], CAV.size[1]), sx, Math.min(sz, WALL_Z - 8), true);
  }

  /** A strike starts: the guards nearest the striker raise their weapons and shout with him (DW9: 4-5 of ~30 raise
   *  together), and surge half a step in. The view reads raiseF for the war-cry pose. */
  const rallyI = new Int32Array(8), rallyD = new Float64Array(8);
  function rally(s) {
    const k = rng.int(CROWD.rally[0], CROWD.rally[1]);
    let n = 0;
    for (let j = 0; j < N; j++) {
      if (j === s || c.st[j] !== ST.GUARD || c.token[j] || c.form[j] || offRing(c.kind[j])) continue;
      const d2 = (c.x[j] - c.x[s]) ** 2 + (c.z[j] - c.z[s]) ** 2;
      if (d2 > 30 || (n === k && d2 >= rallyD[n - 1])) continue;
      let m = n < k ? n++ : n - 1;                             // insertion into the k nearest
      while (m > 0 && rallyD[m - 1] > d2) { rallyD[m] = rallyD[m - 1]; rallyI[m] = rallyI[m - 1]; m--; }
      rallyD[m] = d2; rallyI[m] = j;
    }
    for (let m = 0; m < n; m++) c.raiseF[rallyI[m]] = game.frame + CROWD.rallyTime - m * 3;
  }

  function turn(i, target, rate) {
    let d = target - c.yaw[i]; d = Math.atan2(Math.sin(d), Math.cos(d));
    const m = rate * DT;
    c.yaw[i] += Math.max(-m, Math.min(m, d));
  }

  /** Squad table: director + formation movement (march → halt → charge → fold into the ring). */
  function squads(h) {
    const S = c.sq;
    // members alive per squad (a squad whose members all died or broke off is freed)
    for (let q = 0; q < S.n; q++) S.t[q]++;
    const alive = sqAlive.fill(0);
    // engaged = free soldiers standing in the ring (reacting / downed bodies don't count, so a sweep frees the next
    // block at once) + a third of every block already on its way
    let engaged = 0, transit = 0;
    for (let i = 0; i < N; i++) {
      const s = c.st[i];
      if (s === ST.OFF || s === ST.DEAD) continue;
      if (c.form[i]) alive[c.squad[i]]++;
      else if ((s === ST.ADVANCE || s === ST.GUARD || s === ST.ATTACK) && c.kind[i] !== KIND.ARCHER && c.kind[i] !== KIND.RIDER) engaged++;
    }
    for (let q = 0; q < S.n; q++) if (S.st[q] > SQ_HOLD) transit += alive[q];
    engaged += transit * 0.35;
    let holdBest = -1, holdD = Infinity;
    for (let q = 0; q < S.n; q++) {
      if (!S.st[q]) continue;
      if (!alive[q]) { S.st[q] = 0; continue; }
      const dx = h.x - S.x[q], dz = h.z - S.z[q], d = Math.hypot(dx, dz) || 1e-6;
      if (S.st[q] === SQ_HOLD) { if (d < holdD && !S.base[q]) { holdD = d; holdBest = q; } continue; }   // garrisons hold their camp
      // wheel toward the hero (limited turn rate → the block visibly pivots)
      let da = Math.atan2(dx, dz) - S.face[q]; da = Math.atan2(Math.sin(da), Math.cos(da));
      S.face[q] += Math.max(-1.1 * DT, Math.min(1.1 * DT, da));
      let sp = 0;
      if (S.st[q] === SQ_MARCH) { sp = CROWD.march; if (d < CROWD.halt) { S.st[q] = SQ_HALT; S.t[q] = 0; } }
      else if (S.st[q] === SQ_HALT) { if (S.t[q] > CROWD.haltFrames) S.st[q] = SQ_CHARGE; }
      else sp = CROWD.charge;
      if (Math.abs(da) > 0.9) sp *= 0.4;                                   // wheel first, then advance
      S.x[q] += Math.sin(S.face[q]) * sp * DT; S.z[q] += Math.cos(S.face[q]) * sp * DT;
      // fold: members break into the ring (a line of bows breaks ranks at bow range and spreads out to shoot)
      if (S.mix[q] === MIX.ARCHER ? d < CROWD.archer.fold : S.st[q] === SQ_CHARGE && d < CROWD.fold) {
        S.st[q] = 0;
        for (let i = 0; i < N; i++) if (c.form[i] && c.squad[i] === q) { c.form[i] = 0; if (c.st[i] === ST.IDLE) setSt(i, ST.ADVANCE); }
      }
    }
    // director: keep ~CROWD.engaged soldiers on the hero
    if (game.frame % 20 === 0 && holdBest >= 0 && engaged < CROWD.engaged && transit < CROWD.transit && holdD < 55) {
      S.st[holdBest] = holdD < CROWD.halt + 5 ? SQ_CHARGE : SQ_MARCH; S.t[holdBest] = 0;
    }
    c.engaged = engaged; holdNear = holdBest >= 0 && holdD < CROWD.waveDist[1];   // nearer than a column would spawn
  }

  /** Ring manager: when the inner ring or the second row thins out, the nearest soldier from further out steps up. */
  // inner-ring slots: SEC sectors around the hero; seat() gives a soldier slot `best`, by default the emptiest one
  // nearest to where he stands
  const SEC = 16, secN = new Int32Array(SEC);
  const secOf = (a) => Math.min(SEC - 1, Math.floor((a + Math.PI) / (2 * Math.PI) * SEC));
  const secAng = (s) => (s + 0.5) / SEC * 2 * Math.PI - Math.PI;
  function seat(i, h, best = -1) {
    if (best < 0) {
      const s0 = secOf(Math.atan2(c.x[i] - h.x, c.z[i] - h.z));
      best = s0;
      for (let k = 1; k <= SEC / 2; k++) {
        const a = (s0 + k) % SEC, b = (s0 - k + SEC) % SEC;
        if (secN[a] < secN[best]) best = a;
        if (secN[b] < secN[best]) best = b;
      }
    }
    secN[best]++; c.seated[i] = 1;
    c.ang[i] = secAng(best) + rng.range(-0.12, 0.12);
  }

  function rings(h) {
    const ok = (i) => { const s = c.st[i]; return (s === ST.ADVANCE || s === ST.GUARD || s === ST.ATTACK) && !c.form[i]; };
    // seat the inner ring: new members take the emptiest slots; up to 4 soldiers from a doubled-up slot move to an
    // empty one per tick (a gap left by a sweep fills from both sides)
    secN.fill(0);
    for (let i = 0; i < N; i++) if (!c.band[i] && c.seated[i] && ok(i)) secN[secOf(Math.atan2(Math.sin(c.ang[i]), Math.cos(c.ang[i])))]++;
    for (let i = 0; i < N; i++) if (!c.band[i] && !c.seated[i] && ok(i)) seat(i, h);
    for (let i = 0, moves = 0; i < N && moves < 4 && secN.includes(0); i++) {
      if (c.band[i] || !c.seated[i] || !ok(i) || c.token[i]) continue;
      const s0 = secOf(Math.atan2(Math.sin(c.ang[i]), Math.cos(c.ang[i])));
      if (secN[s0] < 2) continue;
      secN[s0]--; seat(i, h); moves++;
    }
    for (let k = 0; k < 2; k++) {
      let n = 0;
      for (let i = 0; i < N; i++) if (c.band[i] === k && ok(i)) n++;
      // the whole deficit steps up at once, so a sweep's gap closes in one beat: the second row takes the nearest
      // soldiers from further out; each empty inner slot takes the soldier nearest to it (the flanks close the
      // camera side)
      for (let need = CROWD.bandMin[k] - n; need > 0; need--) {
        let slot = -1, px = h.x, pz = h.z;
        if (!k) {
          slot = 0;
          for (let q = 1; q < SEC; q++) if (secN[q] < secN[slot]) slot = q;
          const a = secAng(slot), r = (CROWD.bands[0][0] + CROWD.bands[0][1]) / 2;
          px += Math.sin(a) * r; pz += Math.cos(a) * r;
        }
        let best = -1, bd = Infinity;
        for (let i = 0; i < N; i++) {
          if (c.band[i] <= k || offRing(c.kind[i]) || !ok(i)) continue;
          const d2 = (c.x[i] - px) ** 2 + (c.z[i] - pz) ** 2;
          if (d2 < bd) { bd = d2; best = i; }
        }
        if (best < 0) break;
        setBand(best, k);
        if (!k) seat(best, h, slot);
        n++;
      }
      // an over-full row sheds its farthest soldiers to the next one (a ring, not a pile)
      for (; n > CROWD.bandMax[k]; n--) {
        let far = -1, fd = -1;
        for (let i = 0; i < N; i++) {
          if (c.band[i] !== k || c.token[i] || !ok(i)) continue;
          const d2 = (c.x[i] - h.x) ** 2 + (c.z[i] - h.z) ** 2;
          if (d2 > fd) { fd = d2; far = i; }
        }
        if (far < 0) break;
        setBand(far, k + 1);
      }
    }
  }

  function grantTokens(h) {
    if (game.frame % 6 !== 0 || c.tokensUsed >= CROWD.tokens) return;
    // favour soldiers in the inner ring that the camera sees (beyond the hero, within the view cone); while he attacks,
    // soldiers off his flanks and back (a swing in front of him gets swept away before it lands)
    const cy = game.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const hx = Math.sin(h.yaw), hz = Math.cos(h.yaw), busy = h.state === 'attack';
    let best = -1, bs = Infinity;
    const start = rng.int(0, N - 1);                             // rotate the scan start so tokens spread around
    for (let k = 0; k < N; k++) {
      const i = (start + k) % N;
      const s = c.st[i];
      if ((s !== ST.GUARD && s !== ST.ADVANCE) || c.token[i] || c.cd[i] > 0 || c.form[i] || offRing(c.kind[i])) continue;
      const dx = c.x[i] - h.x, dz = c.z[i] - h.z, d = Math.hypot(dx, dz);
      if (d > 4.5) continue;
      const vis = (dx * fx + dz * fz) / (d || 1);             // 1 = straight beyond the hero (hidden behind his body)
      const score = d + (1 - vis) * 1.2 + (vis > 0.92 ? 1.2 : 0) + (busy && (dx * hx + dz * hz) / (d || 1) > -0.2 ? 3 : 0);
      if (score < bs) { bs = score; best = i; }
    }
    if (best >= 0) { c.token[best] = 1; c.tokensUsed++; c.tokT[best] = 0; }
  }

  function separate(h) {
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const s = c.st[i];
      if (s === ST.OFF || s === ST.DEAD || s === ST.DOWN || c.y[i] > 0.6 || c.kind[i] === KIND.RIDER) continue;   // riders gallop through the foot
      const gx = Math.floor((c.x[i] + HALF) / CELL), gz = Math.floor((c.z[i] + HALF) / CELL);
      if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) continue;
      const cell = gx + gz * GRID;
      next[i] = head[cell]; head[cell] = i;
    }
    const R2 = CROWD.radius * 2, hr = CROWD.heroR + CROWD.radius;
    for (let i = 0; i < N; i++) {
      px[i] = 0; pz[i] = 0;
      const s = c.st[i];
      if (s === ST.OFF || s === ST.DEAD || s === ST.DOWN || c.y[i] > 0.6 || c.kind[i] === KIND.RIDER) continue;
      const gx = Math.floor((c.x[i] + HALF) / CELL), gz = Math.floor((c.z[i] + HALF) / CELL);
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const x = gx + ox, z = gz + oz;
        if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
        for (let j = head[x + z * GRID]; j >= 0; j = next[j]) {
          if (j === i) continue;
          const dx = c.x[i] - c.x[j], dz = c.z[i] - c.z[j], d2 = dx * dx + dz * dz;
          if (d2 >= R2 * R2) continue;
          // priority: attack-token holders, then the inner ring, push through; outer rows give way
          const pi = c.token[i] ? -1 : c.band[i], pj = c.token[j] ? -1 : c.band[j];
          const d = Math.sqrt(d2) || 1e-4, push = (R2 - d) * (pi > pj ? 0.9 : pi < pj ? 0.1 : 0.5);
          px[i] += d2 > 1e-8 ? dx / d * push : (i < j ? push : -push); pz[i] += d2 > 1e-8 ? dz / d * push : 0;
        }
      }
      const dx = c.x[i] - h.x, dz = c.z[i] - h.z, d = Math.hypot(dx, dz);
      if (d < hr && !h.y) { const k = (hr - d) / (d || 1e-4); px[i] += dx * k; pz[i] += dz * k; }
    }
    const lim = CROWD.fieldR;
    for (let i = 0; i < N; i++) {
      if (!px[i] && !pz[i]) continue;
      c.x[i] += Math.max(-0.2, Math.min(0.2, px[i] * 0.6));
      c.z[i] += Math.max(-0.2, Math.min(0.2, pz[i] * 0.6));
      const r = Math.hypot(c.x[i], c.z[i]);
      if (r > lim) { c.x[i] *= lim / r; c.z[i] *= lim / r; }
      if (c.z[i] > WALL_Z - 2) c.z[i] = WALL_Z - 2;
    }
    if (SOLIDS.length) for (let i = 0; i < N; i++) {             // nobody stands inside an altar or a dam
      if (c.st[i] === ST.OFF || c.y[i] > 2) continue;
      const o = pushOut(c.x[i], c.z[i], CROWD.radius);
      if (o) { c.x[i] = o[0]; c.z[i] = o[1]; }
    }
  }

  /** Reinforcement column in front of the camera when the field runs dry. */
  function waves(h) {
    // columns keep coming while the ring is under strength, faster when it is below half — and less often as the
    // enemy loses its camps (stages/bases.js pressure)
    if (!c.wavesOn || ++c.waveT < CROWD.waveEvery[c.engaged < CROWD.engaged / 2 ? 0 : 1] / (game.bases?.pressure() ?? 1)) return;
    if (c.engaged >= CROWD.engaged || holdNear) return;                  // a block waits closer: the director uses it
    const off = freeSlots(false);
    if (off.length < CROWD.wave[0]) return;
    c.waveT = 0;
    const n = Math.min(off.length, rng.int(CROWD.wave[0], CROWD.wave[1]));
    const a = game.cam.yaw + rng.range(-1.1, 1.1), d = rng.range(CROWD.waveDist[0], CROWD.waveDist[1]);
    let sx = h.x + Math.sin(a) * d, sz = h.z + Math.cos(a) * d;
    const gate = game.bases?.source(h);                         // out of the nearest enemy camp when one is near
    if (gate) { sx = gate[0] + rng.range(-1.5, 1.5); sz = gate[1] + rng.range(-1.5, 1.5); }
    const r = Math.hypot(sx, sz);
    if (r > CROWD.fieldR - 4) { sx *= (CROWD.fieldR - 4) / r; sz *= (CROWD.fieldR - 4) / r; }
    sz = Math.min(sz, WALL_Z - 4);
    makeSquad(off.slice(0, n), sx, sz, Math.atan2(h.x - sx, h.z - sz), 3, SQ_CHARGE, pickMix());   // a column that runs straight in
    // KO'd officers come back with the waves (unless a stage script is bringing them on)
    if (!scripted()) for (const i of freeSlots(true)) { place(i, sx + rng.range(-2, 2), sz + rng.range(-2, 2), true); break; }
    emit('crowd:wave', { count: n, x: sx, z: sz });
  }

  return c;
}
