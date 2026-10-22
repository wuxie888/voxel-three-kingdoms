// Hero glue. Sim side: owns the hero's state and runs combo/locomotion/physics each fixed step, plus animation
// bookkeeping (which clip, normalised time, blend-from) so the rendered pose is a pure function of sim state.
// Render side: createHeroView builds rig + voxel model + secondary chains and poses them from the sim state.
import * as THREE from 'three';
import { ATTACK_CLIPS, MOVE_FEET as SPEAR_FEET } from './anims/attacks.js';
import { makeAuthor } from './anims/author.js';
import { LOCO_CLIPS, runPose, rollPose, applyRoll, createDodgeGhosts } from './anims/locomotion.js';
import { createRig, sampleClip, blendStep, turnPose, POSE_SIZE, DIM, HERO_SCALE, CH, P } from './rig.js';
const CH_GRIPL = CH.gripL;
import { createHeroModel } from './model.js';
import { createSecondary } from './secondary.js';
import { MOVES, moveClip } from './moves.js';
import { bufferInput, stepCombo } from './combo.js';
import { stepLocomotion, stepPhysics, setState, LOCO } from './locomotion.js';
import { ARENA_RADIUS, WALL_Z } from '../world/world.js';
import { emit } from '../core/events.js';
import { HERO } from '../heroes/index.js';
import { fanOverlay } from './anims/fan.js';

/** Clip registry sampled by the hero. Other parts (musou) register their clips here. */
// a hero with his own moveset brings his own attack clips, authored on his own move table (heroes/*.moves.js)
const OWN = HERO.moveset ? HERO.moveset.clips(makeAuthor(MOVES, HERO.moveset.entry || {}), MOVES) : null;
// his own clips may also replace the locomotion poses (idle, air, airFall, land, hurt): later keys win
export const CLIPS = { ...LOCO_CLIPS, ...(OWN || ATTACK_CLIPS) };
const LOCO_IDS = new Set(Object.keys(LOCO_CLIPS));
// weapon carry while running / rolling (moveset.carry.run / .roll: weapon + arm channels over the shared procedural poses)
const W0 = CH.spear, W1 = CH.spin;
const mkCarry = (ms) => ms?.carry && Object.fromEntries(Object.entries(ms.carry).map(([k, spec]) => [k, P(spec)]));
const CARRY = mkCarry(HERO.moveset);
export function carryFor(def) { return mkCarry(def.moveset); }
const MOVE_FEET = OWN ? {} : SPEAR_FEET;

export function createHero(game) {
  const h = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
    hp: 400, hpMax: 400, musou: 0, musouMax: 100,
    state: 'idle', stateT: 0, move: null, moveT: 0, moveSeq: 0,
    grounded: true, airAttack: false, iframes: 0, speed: 0, runT: 0, runPhase: 0,
    combo: 0, comboT: 0, kos: 0, atk: 1, taken: 0, buffAtk: 0, buffDef: 0, hurtF: -99,   // buffs: frames left (supplies/supplies.js)
    buf: null, bufT: 0, dodgeBuf: 0, jumpBuf: 0, musouBuf: 0, dodgeX: 0, dodgeZ: 1,
    musouClip: null, musouT: 0,
    airN: 0, moveAir: false,                                  // combo-system: air-string count, vault
    dodgeSeq: 0,
    anim: { id: 'idle', t: 0, k: 0, seq: -1, pid: null, pt: 0, pk: 0, blendF: 1, blendN: 1, from: new Float32Array(POSE_SIZE), yaw: 0,
      lean: 0,     // lean: run bank (locomotion)
      fx: 0, fz: 0, px: 0, pz: 0,     // spear-anim: root at the transition / last step (feet stay planted through a blend)
      mf: null, mt: 0,                // spear-anim: move whose baked feet apply (MOVE_FEET) and its move time, as shown
      om: null, ot: 0 },              // weapon overlay (fan heroes): move id and move frame, as shown
  };

  h.reset = ({ x = 0, z = 0, yaw = 0 } = {}) => {
    Object.assign(h, { x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw, hp: h.hpMax, musou: 0, state: 'idle', stateT: 0, move: null,
      moveT: 0, moveSeq: 0, grounded: true, airAttack: false, iframes: 0, speed: 0, runT: 0, runPhase: 0, combo: 0, comboT: 0,
      kos: 0, atk: 1, taken: 0, buffAtk: 0, buffDef: 0, hurtF: -99, buf: null, bufT: 0, dodgeBuf: 0, jumpBuf: 0, musouBuf: 0, musouClip: null, musouT: 0,
      airN: 0, moveAir: false, dodgeSeq: 0 });
    Object.assign(h.anim, { id: 'idle', t: 0, k: 0, seq: -1, pid: null, pt: 0, pk: 0, blendF: 1, blendN: 1, yaw, lean: 0, fx: x, fz: z, px: x, pz: z, mf: null, mt: 0, om: null, ot: 0 });
  };

  /** Heal (food, supplies/supplies.js). */
  h.heal = (v) => { if (h.state !== 'dead') { h.hp = Math.min(h.hpMax, h.hp + v); emit('hero:heal', { v, hp: h.hp, x: h.x, z: h.z }); } };

  /** Called by combat when an enemy strike connects. Only moves with `armor` (charges, finishers, Lü Bu's string) keep
   *  going through a blow; any other move is knocked out of his hands — the ring is a threat, not scenery. */
  h.hurt = (dmg, fromX, fromZ, officer) => {
    if (h.iframes > 0 || h.state === 'musou' || h.state === 'dodge') return false;
    if (h.state === 'dead') return false;
    // a blow taken through armour still buys 0.4 s: a multi-tick strike (the boss's sweep) lands once, not four times
    if (game.frame - h.hurtF < 24) return false;
    h.hurtF = game.frame;
    dmg = Math.round(dmg * (game.diff?.dmg ?? 1) * (h.buffDef > 0 ? 0.5 : 1));   // difficulty (core/settings.js), 玄甲 halves it
    h.taken += Math.min(dmg, h.hp);
    h.hp = Math.max(0, h.hp - dmg);
    h.musou = Math.min(h.musouMax, h.musou + dmg * 0.15);
    const armored = h.hp > 0 && !!h.move && !!MOVES[h.move].armor;
    emit('hero:hurt', { dmg, hp: h.hp, x: h.x, y: h.y + 1.2, z: h.z, armored });
    if (h.hp <= 0) {                                         // 戰死: falls, the sim keeps running, main.js shows the result
      h.move = null; setState(h, 'dead'); h.vx = h.vz = 0; h.combo = 0;
      emit('hero:death', { x: h.x, z: h.z, kos: h.kos, frame: game.frame });
      return true;
    }
    if (armored) return true;
    const dx = h.x - fromX, dz = h.z - fromZ, l = Math.hypot(dx, dz) || 1;
    h.move = null; setState(h, 'hurt');
    h.vx = dx / l * 3.5; h.vz = dz / l * 3.5;
    h.iframes = 40;
    h.combo = 0; h.comboT = 0;
    return true;
  };

  h.step = (inp) => {
    bufferInput(h, inp);
    if (inp.pressed.musou) h.musouBuf = 8;
    if (game.hitstop > 0) { game.hitstop--; return; }        // frozen by hitstop; presses stay buffered
    h.stateT++;
    if (h.state === 'dead') { stepPhysics(h); updateAnim(h); return; }
    if (h.iframes > 0) h.iframes--;
    if (h.comboT > 0 && --h.comboT === 0) h.combo = 0;
    if (h.musouBuf > 0) h.musouBuf--;
    if (h.state === 'musou') game.musou.stepHero(inp);
    // musou part r3: one full gauge segment is enough (game.musou.ready; one Musou spends one of the 3 segments)
    else if (h.musouBuf && game.musou.ready() && h.grounded && h.state !== 'hurt') { h.musouBuf = 0; game.musou.start(inp); }
    else if (!stepCombo(h, inp, game)) stepLocomotion(h, inp, game.cam.yaw);
    if (stepPhysics(h) && h.state === 'jump') setState(h, 'land');
    // arena bounds (castle wall in +Z)
    const r = Math.hypot(h.x, h.z);
    if (r > ARENA_RADIUS) { h.x *= ARENA_RADIUS / r; h.z *= ARENA_RADIUS / r; }
    if (h.z > WALL_Z - 3) h.z = WALL_Z - 3;
    updateAnim(h);
  };
  return h;
}

// ---------------------------------------------------------------- animation bookkeeping (sim, deterministic)
function animDesc(h) {
  switch (h.state) {
    // combo-system seam: moves.js `anim` retimes the clip (holds, snaps, clip cuts); a cut counts as a new anim seq → blend
    case 'attack': { const c = moveClip(MOVES[h.move], h.moveT); return [c[0], c[1], 0, h.moveSeq * 16 + c[2]]; }
    case 'musou': return [h.musouClip, h.musouT, 0, -2];
    case 'run': return ['run', h.runPhase, Math.min(1, h.speed / LOCO.runSpeed), -1];
    case 'dodge': return ['dodge', h.stateT / LOCO.dodgeFrames, 0, -100 - h.dodgeSeq];   // new seq per dodge → re-blend on a double dodge
    // locomotion-dodge r2: after an air string (airN > 0) the fall uses the DW8 spread-arm descent
    case 'jump': return [h.airN ? 'airFall' : 'air', Math.min(1, Math.max(0, 0.5 - h.vy / (2 * LOCO.jumpV))), 0, -1];
    case 'land': return ['land', h.stateT / LOCO.landFrames, 0, -1];
    case 'hurt': return ['hurt', h.stateT / LOCO.hurtFrames, 0, -1];
    case 'dead': return ['hurt', Math.min(0.25, h.stateT / 40), 0, -3];
    default: return ['idle', (h.stateT % 150) / 150, 0, -1];
  }
}
// spear-anim: a transition blends from the pose that was actually shown last frame (a.from — includes any blend still
// running, so chained moves never pop), re-expressed in the new facing: a yaw snap at move start (soft-lock / stick
// steering) becomes a short turn through the spin channel instead of a one-frame body rotation.
const _F = new Float32Array(POSE_SIZE);
export function updateAnim(h) {
  const a = h.anim;
  const [id, t, k, seq] = animDesc(h);
  if (id !== a.id || seq !== a.seq) {
    heroPose(h, _F); a.from.set(_F); turnPose(a.from, a.yaw - h.yaw);   // spear-anim: feet keep their ground spots
    a.fx = a.px; a.fz = a.pz;
    a.pid = a.id; a.pt = a.t; a.pk = a.k;
    a.blendN = (OWN || ATTACK_CLIPS)[id] && !LOCO_IDS.has(id) ? 5 : id === 'dodge' ? 3 : id === 'run' ? 6 : 8;
    a.blendF = 1; a.id = id; a.seq = seq;          // spear-anim: the first frame of a move already moves off the old pose
  } else if (a.blendF < a.blendN) a.blendF++;
  a.t = t; a.k = k; a.yaw = h.yaw; a.px = h.x; a.pz = h.z;
  a.mf = h.state === 'attack' && MOVE_FEET[h.move] ? h.move : null; a.mt = h.moveT;
  a.om = h.state === 'attack' ? h.move : null; a.ot = h.moveT;
}

// ---------------------------------------------------------------- pose (pure)
export function sampleAnim(id, t, k, out, lean = 0, carry = CARRY) {
  if (id === 'run') { runPose(t, k, out, lean); if (carry?.run) for (let j = W0; j < W1; j++) out[j] = carry.run[j]; return out; }
  if (id === 'dodge') { rollPose(t, out); if (carry?.roll) for (let j = W0; j < W1; j++) out[j] = carry.roll[j]; return out; }   // procedural dive roll
  return sampleClip(CLIPS[id] || CLIPS.idle, t, out);
}
/** Current pose of the hero (pure function of sim state). */
export function heroPose(h, out) {
  const a = h.anim;
  sampleAnim(a.id, a.t, a.k, out, a.lean);
  // spear-anim: a move that borrows another move's clip (moves.js `anim`) gets feet baked for its own root motion
  if (a.mf) MOVE_FEET[a.mf](a.mt / MOVES[a.mf].frames, out);
  // one-handed fan upper body (anims/fan.js) — outside his own attack / musou clips, which author the fan themselves
  if (HERO.anim === 'fan' && !(OWN && (a.om || OWN[a.id] || /^mu_/.test(a.id)))) fanOverlay(a, out);
  if (a.blendF < a.blendN) {
    const u = a.blendF / a.blendN;
    // spear-anim: feet step from where they stood (root travel since the transition undone in the hero frame; a teleport → 0)
    let dx = h.x - a.fx, dz = h.z - a.fz;
    if (dx * dx + dz * dz > 9) dx = dz = 0;
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    blendStep(a.from, out, u * u * (3 - 2 * u), out, dx * c - dz * s, dx * s + dz * c);
  }
  return out;
}

// ---------------------------------------------------------------- view
export function createHeroView(scene, hero) {
  const rig = createRig();
  scene.add(rig.root);
  const model = createHeroModel(rig, HERO);
  const secondary = createSecondary(scene, rig, model.material, HERO);
  const ghosts = createDodgeGhosts(scene, model);   // dodge afterimages + i-frame flash (locomotion-dodge)
  const pose = new Float32Array(POSE_SIZE);
  const pos = new THREE.Vector3();
  // edge lead (style.edgeLead, heavy blades): the shared clips are spear clips, so a glaive or halberd would often cut
  // with the flat or the back. Each frame the weapon is rolled about its shaft so the edge (local +Y) turns toward the
  // blade's motion; the roll eases in, holds through pauses and relaxes back in stance. Render-only — hit shapes and
  // trails do not depend on the roll.
  const lead = HERO.style?.edgeLead, grip = HERO.style?.grip;
  const tipP = new THREE.Vector3(), tipN = new THREE.Vector3(), vel = new THREE.Vector3(), wq = new THREE.Quaternion();
  let roll = 0, hasTip = false;
  function edgeLead(dt) {
    const w = rig.joints.weapon;
    w.rotation.z += roll; w.updateMatrixWorld(true);
    w.localToWorld(tipN.set(0, 0, DIM.spearTip));
    if (hasTip && dt > 0) {
      vel.subVectors(tipN, tipP).applyQuaternion(w.getWorldQuaternion(wq).invert());   // tip motion in weapon space
      const sp = Math.hypot(vel.x, vel.y) / dt, swinging = hero.state === 'attack' || hero.state === 'musou';
      if (swinging && sp > 2.5) {
        let d = Math.atan2(-vel.x, vel.y);                              // extra roll that turns +Y onto the motion
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const k = Math.min(1, dt * 18 * Math.min(1, sp / 8));
        w.rotation.z += d * k; roll += d * k;
      } else if (!swinging) { const k = Math.min(1, dt * 4); w.rotation.z -= roll * k; roll -= roll * k; }
      roll = Math.atan2(Math.sin(roll), Math.cos(roll));
      w.updateMatrixWorld(true);
      w.localToWorld(tipN.set(0, 0, DIM.spearTip));
    }
    tipP.copy(tipN); hasTip = true;
  }
  return {
    rig, model, pose, secondary,
    update(dt) {
      heroPose(hero, pose);
      if (grip) pose[CH_GRIPL] = Math.max(pose[CH_GRIPL], grip);   // heavy blades: hands wide apart on the shaft
      rig.root.scale.set(1, 1, 1);               // locomotion-dodge r3: applyRoll's squash & stretch is per frame; IK needs scale 1
      rig.apply(pose, pos.set(hero.x, hero.y, hero.z), hero.yaw);
      rig.root.scale.setScalar(HERO_SCALE); rig.root.updateMatrixWorld(true);   // after IK: grow the posed body about the ground point
      applyRoll(rig, hero.anim);                 // dive roll: whole-body pitch about the tucked ball (locomotion-dodge)
      if (hero.state === 'dead') {               // topple backwards over ≈ 0.6 s
        const u = Math.min(1, hero.stateT / 36);
        rig.root.rotation.x = -1.45 * u * u; rig.root.position.y += 0.12 * Math.sin(u * Math.PI); rig.root.updateMatrixWorld(true);
      }
      if (lead) edgeLead(dt);
      if (HERO.update) HERO.update(model, hero, dt);   // per-hero render hook (e.g. Zhuge Liang's wind blade)
      ghosts.update(hero, rig, dt);
      secondary.update(dt);
    },
    reset() { secondary.reset(); roll = 0; hasTip = false; },
    /** World position of the middle of the blade as rendered. */
    bladeCentre(out) { return rig.joints.weapon.localToWorld(out.set(0, 0, (DIM.spearHead + DIM.spearTip) / 2)); },
    /** World position of the spear tip as rendered. */
    spearTip(out) { return rig.joints.weapon.localToWorld(out.set(0, 0, DIM.spearTip)); },
  };
}
