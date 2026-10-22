// Puppet (render-only): another officer drawn the way the hero is — rig, voxel model and spring chains from his own hero
// definition, posed from his own clips (moveset.clips) over the shared locomotion poses, cross-fading whenever his anim
// changes. Used for the boss (boss/view.js) and for the allies a stage script places (stages/props.js).
import * as THREE from 'three';
import { createRig, sampleClip, blendPose, POSE_SIZE, HERO_SCALE, CH } from './rig.js';
import { createHeroModel } from './model.js';
import { createSecondary } from './secondary.js';
import { carryFor } from './hero.js';
import { makeAuthor } from './anims/author.js';
import { finalizeMoves } from './moves.js';
import { LOCO_CLIPS, runPose } from './anims/locomotion.js';
import { ATTACK_CLIPS } from './anims/attacks.js';

const W0 = CH.spear, W1 = CH.spin;

export function createPuppet(scene, def, scale = HERO_SCALE) {
  const rig = createRig();
  scene.add(rig.root);
  const model = createHeroModel(rig, def);
  const secondary = createSecondary(scene, rig, model.material, def);
  const CARRY = carryFor(def), MS = def.moveset, BM = MS && finalizeMoves(MS.moves());
  // his own moveset over the shared locomotion poses (an officer without one fights with the shared spear set)
  const CLIPS = { ...LOCO_CLIPS, ...(MS ? MS.clips(makeAuthor(BM, MS.entry || {}), BM) : ATTACK_CLIPS) };
  const pose = new Float32Array(POSE_SIZE), prev = new Float32Array(POSE_SIZE), from = new Float32Array(POSE_SIZE);
  const pos = new THREE.Vector3();
  let seq = null, blend = 1, shown = true;
  const show = (v) => {
    if (v === shown) return;
    shown = v; rig.root.visible = v;
    for (const c of secondary.chains) for (const m of c.meshes) m.visible = v;
  };
  return {
    rig, model, secondary, show, clips: CLIPS,
    get shown() { return shown; },
    /** Pose him from anim {id, t, seq} (a new seq cross-fades over ≈ 6 frames) at (x, y, z) facing yaw. */
    update(dt, anim, x, y, z, yaw) {
      if (anim.id === 'run') { runPose(anim.t, 1, pose, 0); if (CARRY?.run) for (let j = W0; j < W1; j++) pose[j] = CARRY.run[j]; }
      else sampleClip(CLIPS[anim.id] || CLIPS.idle, anim.t, pose);
      if (def.style?.grip) pose[CH.gripL] = Math.max(pose[CH.gripL], def.style.grip);   // heavy blades: hands apart
      if (anim.seq !== seq) { from.set(prev); blend = seq === null ? 1 : 0; seq = anim.seq; }
      if (blend < 1) { blend = Math.min(1, blend + dt * 10); blendPose(from, pose, blend * blend * (3 - 2 * blend), pose); }
      prev.set(pose);
      rig.root.scale.set(1, 1, 1);                       // IK runs at scale 1, then the posed body grows about the ground point
      rig.apply(pose, pos.set(x, y, z), yaw);
      rig.root.scale.setScalar(scale); rig.root.updateMatrixWorld(true);
      secondary.update(dt);
    },
  };
}
