// Boss view (render-only): the boss drawn with a hero rig + voxel model + spring chains (his own hero definition) at
// 1.2× the hero's size, posed from the shared clips (boss.anim), red hit flash; telegraph decals on the ground for his
// strikes; strike effects; the boss HP bar, his entrance and defeat banners (DOM, styles inline).
import * as THREE from 'three';
import { on } from '../core/events.js';
import { HERO_SCALE } from '../hero/rig.js';
import { createPuppet } from '../hero/puppet.js';
import { fadeOccluder } from '../camera/occlusion.js';

const SCALE = HERO_SCALE * 1.2;

export function createBossView(scene, game, vfx, stage) {
  const b = game.boss, fx = vfx.fx;
  // his own model, chains and clips (built on his own move table, not the player's)
  const puppet = createPuppet(scene, b.def, SCALE), { rig, model, show } = puppet;
  // standing between the lens and the hero he gets the crowd's see-through window (camera/occlusion.js), so the big
  // boss never hides the player
  for (const m of new Set(Object.values(model.meshes).map((x) => x.material))) fadeOccluder(m);
  show(false);

  // ---- telegraph decals: red discs / lanes that fill up until the strike
  const decals = [];
  const decalMat = () => new THREE.MeshBasicMaterial({ color: 0xff2a12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const ringGeo = new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2), discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(), edge = new THREE.Mesh(ringGeo, decalMat()), fill = new THREE.Mesh(discGeo, decalMat()), lane = new THREE.Mesh(laneGeo, decalMat());
    g.add(edge, fill, lane); g.visible = false; g.renderOrder = 4; scene.add(g);
    decals.push({ g, edge, fill, lane, t: 1, dur: 1, kind: '' });
  }
  let decalNext = 0;
  on('boss:warn', (e) => {
    const d = decals[decalNext]; decalNext = (decalNext + 1) % decals.length;
    Object.assign(d, { t: 0, dur: e.dur, kind: e.kind });
    d.g.visible = true; d.g.position.set(e.x, 0.07, e.z); d.g.rotation.set(0, e.yaw, 0);
    const lane = e.kind === 'thrust';
    d.edge.visible = d.fill.visible = !lane; d.lane.visible = lane;
    if (lane) d.lane.scale.set(e.w, 1, e.len); else { d.edge.scale.setScalar(e.r); d.fill.scale.setScalar(e.r); }
  });
  on('boss:strike', (e) => {
    const x = b.x, z = b.z;
    if (e.kind === 'leap') {
      fx.ring(x, z, 5.2, 0.5, [2.2, 0.6, 0.3]); fx.dustRing(x, z, 30, 0.6, 9, 0.7, 0.6); fx.rocks(x, z, 18, 3, 0.14, 0.34, [5, 9], 4);
      fx.dustColumn(x, z, 12, 0.6, 2.4, 3, [0.8, 1.1], 0.55); fx.flash(0.16);
    } else if (e.kind === 'sweep') { fx.ring(x, z, 4.2, 0.35, [2.0, 0.5, 0.3]); fx.dustRing(x, z, 14, 0.5, 6, 0.55, 0.5); }
    else fx.dustPuff(x + Math.sin(e.yaw) * 1.5, z + Math.cos(e.yaw) * 1.5, 4, 2.4, 0.4);
  });
  on('boss:hit', (e) => { if (e.heavy) fx.star(e.x, e.y, e.z, 1.2, 0.12, [2.4, 1.2, 0.6]); });
  on('boss:stagger', (e) => { fx.star(e.x, 2.2, e.z, 2.0, 0.3, [2.4, 2.0, 0.8]); fx.ring(e.x, e.z, 3, 0.4, [2.2, 1.8, 0.8]); fx.flash(0.1); });

  // ---- DOM: HP bar and banners
  const css = document.createElement('style');
  css.textContent = `
    .boss-bar { position: fixed; left: 41vw; top: 3vh; width: 38vw;   /* between the target bar and the minimap, clear of the dialogue */ pointer-events: none; z-index: 3; opacity: 0;
      transition: opacity .6s; font-family: "Xingkai SC", "STXingkai", "HudBrush", serif; color: #f7ecd8; text-shadow: 0 .2vh .4vh #000; }
    .boss-bar .nm { font-size: 4.2vh; letter-spacing: .6vh; display: flex; align-items: center; gap: 1.2vh; }
    .boss-bar .nm i { font: 700 1.9vh/1 "Kaiti SC", "STKaiti", serif; font-style: normal; background: #b3261e; padding: .5vh .6vh; border-radius: .4vh; writing-mode: vertical-rl; }
    .boss-bar .nm small { font: 600 1.6vh/1 "Avenir Next", sans-serif; letter-spacing: .5em; opacity: .8; }
    .boss-bar .bar { position: relative; height: 1.5vh; margin-top: .6vh; background: rgba(10,6,6,.8); box-shadow: 0 0 0 .15vh #6a4a1c, 0 .3vh .8vh rgba(0,0,0,.6); }
    .boss-bar .bar i, .boss-bar .bar em { position: absolute; inset: 0; transform-origin: 0 50%; }
    .boss-bar .bar em { background: #f0d890; }
    .boss-bar .bar i { background: linear-gradient(#ff9a7a, #d0301c 45%, #6e140c); }
    .boss-banner { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; z-index: 4;
      opacity: 0; font-family: "Xingkai SC", "STXingkai", "HudBrush", serif; color: #fff4e0;
      background: linear-gradient(transparent 32%, rgba(20,6,4,.72) 42%, rgba(20,6,4,.72) 62%, transparent 72%); }
    .boss-banner .big { font-size: 15vh; letter-spacing: 2vh; text-shadow: .5vh .6vh 0 rgba(0,0,0,.6), 0 0 4vh rgba(200,40,20,.8); }
    .boss-banner .sub { margin-top: 1vh; font: 600 2.2vh/1 "Avenir Next", sans-serif; letter-spacing: .6em; opacity: .85; text-shadow: 0 .2vh .4vh #000; }`;
  document.head.appendChild(css);
  const bar = document.createElement('div');
  bar.className = 'boss-bar';
  bar.innerHTML = `<div class="nm">${b.def.zh}<i>${b.def.seal}</i><small>${b.def.en}</small></div><div class="bar"><em></em><i></i></div>`;
  const banner = document.createElement('div');
  banner.className = 'boss-banner';
  banner.innerHTML = '<div class="big"></div><div class="sub"></div>';
  document.body.append(bar, banner);
  const barI = bar.querySelector('.bar i'), barE = bar.querySelector('.bar em');
  const [bBig, bSub] = banner.children;
  let bannerF = -999, bannerDur = 0, lag = 1;
  const say = (big, sub, dur = 170) => { bBig.textContent = big; bSub.textContent = sub; bannerF = game.frame; bannerDur = dur; };
  on('boss:enter', () => say(stage.bossIntro?.[0] || `${b.def.zh} 來襲`, stage.bossIntro?.[1] || `${b.def.en} APPROACHES`));
  on('boss:defeat', () => say(`${b.def.zh} 敗走`, `${b.def.en} IS DEFEATED`, 220));
  on('scenario', () => { bannerF = -999; lag = 1; show(false); bar.style.opacity = 0; });

  return {
    update(dt) {
      const on = b.st !== 'off' && !(b.st === 'dead' && b.stT > 150);
      show(on);
      bar.style.opacity = b.st !== 'off' && !(b.st === 'dead' && b.stT > 120) ? 1 : 0;
      const k = b.hp / b.hpMax;
      lag = Math.max(k, lag - dt * 0.35);
      barI.style.transform = `scaleX(${k.toFixed(4)})`; barE.style.transform = `scaleX(${lag.toFixed(4)})`;
      const bu = (game.frame - bannerF) / bannerDur;
      banner.style.opacity = bu < 0 || bu > 1 ? 0 : String(Math.min(1, bu * 6, (1 - bu) * 4));
      if (bu >= 0 && bu <= 1) bBig.style.transform = `scale(${(1.25 - 0.25 * Math.min(1, bu * 5)).toFixed(3)})`;
      for (const d of decals) {
        if (!d.g.visible) continue;
        d.t += dt / d.dur;
        if (d.t >= 1) { d.g.visible = false; continue; }
        const pulse = 0.55 + 0.45 * Math.sin(d.t * 30);
        d.edge.material.opacity = 0.9 * pulse; d.fill.material.opacity = 0.12 + 0.3 * d.t; d.lane.material.opacity = 0.18 + 0.35 * d.t * pulse;
        d.fill.scale.setScalar(d.edge.scale.x * Math.min(1, d.t * 1.05));
      }
      if (!on) return;
      // pose: the boss's clip, cross-faded on every change of move
      puppet.update(dt, b.anim, b.x, b.y, b.z, b.yaw);
      if (b.st === 'dead') { rig.root.rotation.x = -Math.min(1.45, b.stT / 30); rig.root.updateMatrixWorld(true); }
      const f = b.flash > 0 ? b.flash / 6 : 0;
      model.material.emissive.setRGB(0.9 * f, 0.15 * f, 0.08 * f);
    },
  };
}
