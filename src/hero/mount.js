// Riding (sim). U (gamepad L1, touch 馬) mounts a loose horse standing within reach (a rider's, horse/horses.js) or
// calls his own war horse: it gallops in from behind the camera and he swings up into the saddle as it reaches him (if
// he is free; it waits beside him otherwise). U again hops down — the horse stays where he left it.
// In the saddle: momentum steering (15 m/s at a full gallop, wide turns at speed), foot soldiers trampled out of the way
// at a gallop, swings from the saddle — □ runs his N1–N4 in a loop, △ a sweeping finisher (his N6 / N5): the standing
// clips with the legs in the stirrups (hero.js), their own hit windows, no lunge, the horse running on under them.
// Arrows and grunt blows only cost health; an officer's or the boss's blow, or a rider running him down, throws him
// from the saddle. The Musou starts on foot (he drops down). States: 'mount' (swinging up), 'ride', 'attack' (a swing
// while riding). Deterministic.
import { MOVES } from './moves.js';
import { stickDir, setState } from './locomotion.js';
import { emit } from '../core/events.js';
import { strideHz } from '../horse/model.js';
import { HERO } from '../heroes/index.js';

export const MOUNT = {
  speed: 15, accel: 9, decel: 11, turnHi: 2.1, turnLo: 4.2,   // m/s, m/s², turn rate (rad/s) at a gallop / at a stand
  reach: 3.2, mountF: 16, call: 30,                          // a loose horse to take within reach (m); the swing up (sf); called from (m)
  trample: { v: 6.5, every: 10, hit: { shape: 'arc', range: 1.8, ang: 120, dmg: 6, kb: 'push', force: 5, hitstop: 0 } },
  chain: ['n1', 'n2', 'n3', 'n4'],
};
/** His own horse: coat (horse/model.js COATS) and the colour of its tack. */
export const STEED = {
  zhaoyun: ['white', 0x2a5a8a], guanyu: ['red', 0x2e6e46], zhangfei: ['black', 0x2e6e46], zhugeliang: ['grey', 0x2e6e46], lubu: ['red', 0x9a2018],
}[HERO.id] || ['bay', 0x2e6e46];

// △ from the saddle: his finisher (N6, else N5) without its footwork — no lunge, leap, hang or plunge
const FIN = MOVES.n6 || MOVES.n5;
if (FIN && !MOVES.mc) {
  MOVES.mc = { ...FIN, clip: FIN.clip || (MOVES.n6 ? 'n6' : 'n5'), lunge: [], leap: undefined, hang: undefined, plunge: undefined,
    landFrame: undefined, air: false, next: null, charge: null, armor: true };
}

export function createMount(game) {
  const H = () => game.hero;
  const M = {};
  /** U pressed on foot: take the loose horse within reach, else call his own. */
  M.horse = () => {
    const h = H(), list = game.horses.list;
    if (!free(h)) return false;
    let best = null, bd = MOUNT.reach * MOUNT.reach;
    for (const m of list) {
      const d2 = (m.x - h.x) ** 2 + (m.z - h.z) ** 2;
      if (d2 < bd) { bd = d2; best = m; }
    }
    if (best) { take(h, best); return true; }
    game.horses.call(h, game.cam.yaw, STEED[0]);
    emit('horse:call', { x: h.x, z: h.z });
    return true;
  };
  /** A called horse reached him: up he goes if he is free (else it waits beside him). */
  M.arrive = (m) => { const h = H(); if (!free(h) || h.riding) return false; take(h, m); return true; };
  const free = (h) => h.grounded && !h.riding && (h.state === 'idle' || h.state === 'run' || h.state === 'land');
  function take(h, m) {
    game.horses.remove(m);
    h.riding = true; h.steed = m.coat; h.steedOwn = !!m.own;
    h.yaw = m.yaw; h.vx = h.vz = 0; h.speed = Math.min(m.v, 4); h.move = null; h.buf = null;
    setState(h, 'mount');
    emit('horse:mount', { x: h.x, z: h.z, own: h.steedOwn });
  }
  /** Off the horse: 'hop' (U), 'musou' (he drops down and starts it), 'thrown' (a heavy blow; the horse bolts). */
  M.dismount = (h, how) => {
    if (!h.riding) return;
    const v = how === 'thrown' ? Math.max(6, h.speed) : 0;
    game.horses.free(h.x, h.z, h.yaw, v, { coat: h.steed, own: h.steedOwn });
    h.riding = false; h.move = null; h.buf = null;
    if (how === 'hop') {                                     // down on the left of the horse
      h.x += Math.cos(h.yaw) * 0.9; h.z -= Math.sin(h.yaw) * 0.9;
      h.vx = h.vz = 0; h.speed = 0; setState(h, 'land');
    }
    emit('horse:dismount', { x: h.x, z: h.z, how });
  };

  /** One sim frame in the saddle (hero.js calls it instead of the combo / locomotion steps). */
  M.step = (h, inp) => {
    const cam = game.cam.yaw;
    h.dodgeBuf = 0; h.jumpBuf = 0;
    if (h.buf && ++h.bufT > 24) h.buf = null;
    if (h.state === 'mount') {                               // swinging up: the horse eases off
      run(h, inp, cam, 0.4);
      if (h.stateT >= MOUNT.mountF) setState(h, 'ride');
      return;
    }
    if (inp.pressed.horse && h.state !== 'attack') { M.dismount(h, 'hop'); return; }
    run(h, inp, cam, 1);
    // trample: at a gallop, the foot soldiers in front are knocked flat (no hitstop; each one once per pass)
    const T = MOUNT.trample;
    if (h.speed > T.v && game.frame % T.every === 0) game.combat.strike(T.hit, h.x, h.z, h.yaw, 3e7 + ((game.frame / T.every) | 0) % 1e6, false, 'trample');
    if (h.state === 'attack') {
      const m = MOVES[h.move];
      h.moveT++;
      const ready = h.moveT >= (m.cancel ?? m.frames);
      if (h.buf === 'attack' && ready && h.move !== 'mc') swing(h, MOUNT.chain[(MOUNT.chain.indexOf(h.move) + 1) % MOUNT.chain.length]);
      else if (h.buf === 'charge' && ready && h.move !== 'mc' && MOVES.mc) swing(h, 'mc');
      else if (h.moveT >= m.frames) { h.move = null; setState(h, 'ride'); }
    } else {
      if (h.buf === 'attack') swing(h, MOUNT.chain[0]);
      else if (h.buf === 'charge' && MOVES.mc) swing(h, 'mc');
      else setState(h, 'ride');
    }
  };
  function swing(h, id) {
    h.move = id; h.moveT = 0; h.moveSeq++; h.moveF0 = game.frame; h.moveAir = false; h.buf = null;
    setState(h, 'attack');
    emit('attack:start', { move: id, x: h.x, y: h.y, z: h.z, yaw: h.yaw, charge: id === 'mc', tell: MOVES[id].tell, mounted: true });
  }
  /** The horse under him: turn toward the stick (tighter when slow), gallop up to speed, ease to a stand. */
  function run(h, inp, cam, k) {
    const [dx, dz, mag] = stickDir(inp, cam);
    const top = MOUNT.speed * (h.spdK || 1);
    let sp = h.speed, target = 0;
    if (mag) {
      const want = Math.atan2(dx, dz), rate = MOUNT.turnLo + (MOUNT.turnHi - MOUNT.turnLo) * Math.min(1, sp / top);
      let d = want - h.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      h.yaw += Math.max(-rate / 60, Math.min(rate / 60, d));
      target = top * mag * k * (1 - 0.35 * Math.min(1, Math.abs(d) / 2));
    }
    sp += Math.max(-MOUNT.decel / 60, Math.min(MOUNT.accel / 60, target - sp));
    h.speed = Math.max(0, sp);
    h.vx = Math.sin(h.yaw) * h.speed; h.vz = Math.cos(h.yaw) * h.speed;
    h.horsePh = ((h.horsePh || 0) + strideHz(h.speed) * 2 * Math.PI / 60) % (Math.PI * 64);
    h.sprint = Math.min(1, h.speed / top);                   // the camera widens with the gallop (camera.js sprintFov)
  }
  return M;
}
