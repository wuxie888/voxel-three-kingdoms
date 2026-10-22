// Per-hero signature effects (render-only): flying projectiles (combat.projs — wind blades, crescent waves), straight
// light beams for `beam` windows and the shock rings of a `roar` window (styles.js). Colours come from the hero's
// style.fx. Reads sim state, never writes it.
import * as THREE from 'three';
import { on } from '../core/events.js';
import { MOVES } from '../hero/moves.js';
import { HERO } from '../heroes/index.js';

const FX = { proj: [0.6, 1.6, 2.2], core: [1.6, 2.1, 2.4], beam: [0.6, 1.5, 2.4], roar: [2.0, 1.2, 0.5], ...(HERO.style?.fx || {}) };

/** Crescent standing across the flight direction (in the local XY plane, the horns sweeping back toward −Z), unit
 *  radius, so the gameplay camera behind the hero sees its full arc; vertex colours bright at the leading edge. */
function crescentGeo(n = 24) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (u - 0.5) * 2.4, w = Math.sin(u * Math.PI);          // thickest at the centre
    const ox = Math.sin(a), oy = Math.cos(a) - 0.55, oz = -(1 - Math.cos(a)) * 0.9;
    const k = 1 - 0.3 * w;
    pos.push(ox, oy, oz, ox * k, oy * k - 0.12 * w, oz - 0.1 * w);
    col.push(w, w, w, 0.2 * w, 0.2 * w, 0.2 * w);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function createSignatureFx(scene, game, vfx, camera) {
  const fx = vfx.fx;
  const geo = crescentGeo();
  const N = 48, pool = [];
  for (let i = 0; i < N; i++) {
    const mk = (c) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(...c), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const outer = mk(FX.proj.map((v) => v * 1.3)), inner = mk(FX.core.map((v) => v * 1.5));
    inner.scale.set(0.8, 0.8, 0.8); inner.position.set(0, 0.05, 0.05);
    const g = new THREE.Group(); g.add(outer, inner); g.visible = false; g.renderOrder = 5;
    scene.add(g); pool.push(g);
  }
  const rgb = (c, k = 1) => [c[0] * k, c[1] * k, c[2] * k];

  // beam shafts: a glowing box along the hit line (outer tint + white-hot core) that flares in and thins out
  const beamGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const beams = Array.from({ length: 12 }, () => {
    const mk = (c) => new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const g = new THREE.Group(), o = mk(FX.beam), c = mk(FX.core.map((v) => v * 1.4));
    c.scale.set(0.35, 0.35, 1);
    g.add(o, c); g.visible = false; g.renderOrder = 5; scene.add(g);
    return { g, t: 1, dur: 0.4, w: 1, len: 8 };
  });
  let beamNext = 0;
  const shaft = (x, y, z, yaw, len, w) => {
    const b = beams[beamNext]; beamNext = (beamNext + 1) % beams.length;
    Object.assign(b, { t: 0, w, len }); b.g.position.set(x, y, z); b.g.rotation.set(0, yaw, 0); b.g.visible = true;
  };

  // beam windows: a straight shaft of light along the hit line, a flare at the fan, a ring where it starts
  on('attack:swing', (e) => {
    const hit = MOVES[e.move]?.hits[e.win];
    if (!hit) return;
    const h = game.hero, fxx = Math.sin(e.yaw), fzz = Math.cos(e.yaw);
    if (hit.beam) {
      const len = hit.len || 8, x = h.x + fxx * 0.6, z = h.z + fzz * 0.6, y = h.y + 1.15;
      shaft(x, y, z, e.yaw, len, (hit.width || 1.6) * 0.5);
      for (let k = 1; k <= 5; k++) fx.embers(x + fxx * len * k / 5, y - 0.5, z + fzz * len * k / 5, 3, 0.5, rgb(FX.beam));
      fx.star(x, y, z, 1.4, 0.2, rgb(FX.core, 1.2));
      fx.ring(x + fxx * len * 0.5, z + fzz * len * 0.5, len * 0.35, 0.3, rgb(FX.beam, 0.8));
      fx.flash(0.08);
    }
    if (hit.rain) {                                        // pillars of light striking round the target area
      const R = hit.range || 5, n = hit.rain;
      for (let i = 0; i < n; i++) {
        const a = e.yaw + (i / n - 0.5) * 2.2, d = R * (0.35 + 0.6 * ((i * 0.618) % 1));
        const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
        fx.columns(x, z, 1, 0, 9, 1.2, 0.45, rgb(FX.beam), 0);
        fx.ring(x, z, 1.4, 0.35, rgb(FX.beam)); fx.star(x, 0.4, z, 1.2, 0.2, rgb(FX.core));
      }
      fx.dustRing(h.x, h.z, 20, 0.6, R * 1.4, 0.6, 0.5); fx.flash(0.12);
    }
    if (hit.roar) {                                        // 當陽一喝: rolling shock rings, a dust wall pushed outward
      const R = hit.range || 7;
      fx.ring(h.x, h.z, R * 0.55, 0.35, rgb(FX.roar));
      fx.ring(h.x, h.z, R * 0.85, 0.5, rgb(FX.roar, 0.8));
      fx.ring(h.x, h.z, R * 1.15, 0.65, rgb(FX.roar, 0.6));
      fx.dustRing(h.x, h.z, 34, 0.6, R * 2.2, 0.75, 0.6);
      fx.dustColumn(h.x, h.z, 12, 0.5, 2, 2.6, [0.8, 1.1], 0.45);
      fx.rayBurst(h.x, 1.6, h.z, 14, R * 0.8, rgb(FX.roar, 0.9), [-0.05, 0.25], 0.4, 0.5);
      fx.star(h.x, h.y + 1.7, h.z, 2.2, 0.3, rgb(FX.roar, 1.1));
      fx.flash(0.16);
    }
  });
  // scripted musou effects (musou.js runScript / finFx)
  on('musou:fx', (e) => {
    const { x, z, r } = e, c = FX.proj, k = FX.core;
    if (e.kind === 'roar') {
      fx.ring(x, z, r * 0.5, 0.35, rgb(FX.roar)); fx.ring(x, z, r * 0.8, 0.5, rgb(FX.roar, 0.8)); fx.ring(x, z, r * 1.1, 0.7, rgb(FX.roar, 0.6));
      fx.dustRing(x, z, 40, 0.6, r * 2, 0.8, 0.6); fx.rayBurst(x, 1.6, z, 16, r * 0.7, rgb(FX.roar, 0.9), [-0.05, 0.25], 0.45, 0.5);
      fx.star(x, 1.8, z, 2.6, 0.35, rgb(FX.roar, 1.1)); fx.flash(0.18);
    } else if (e.kind === 'slam') {
      fx.ring(x, z, r, 0.5, rgb(c)); fx.ring(x, z, r * 0.6, 0.35, rgb(k));
      fx.dustRing(x, z, 34, 0.6, r * 1.8, 0.75, 0.6); fx.dustColumn(x, z, 14, 0.6, 2.4, 3.2, [0.8, 1.2], 0.55);
      fx.rocks(x, z, 20, 3, 0.14, 0.36, [5, 10], 4); fx.star(x, 0.6, z, 2.2, 0.25, rgb(k)); fx.flash(0.16);
    } else if (e.kind === 'rocks') {
      fx.rocks(x, z, 26, 3.4, 0.18, 0.44, [5.5, 11], 3.4); fx.dustColumn(x, z, 22, 1.2, 3.6, 4.6, [0.9, 1.3], 0.62);
      fx.dustRing(x, z, 26, 0.8, r * 1.6, 0.7, 0.6); fx.flash(0.14);
    } else if (e.kind === 'beams') {                        // radial light beams from the hero
      const n = Math.round(r);
      for (let i = 0; i < n; i++) { const a = e.yaw + (i / n) * 6.283; shaft(x, 1.2, z, a, 10, 0.55); }
      fx.star(x, 1.3, z, 1.6, 0.25, rgb(k, 0.8)); fx.ring(x, z, 6, 0.5, rgb(FX.beam));
    } else if (e.kind === 'rain') {                         // a column of light striking the ground
      fx.columns(x, z, 1, 0, 9, 1.4, 0.4, rgb(FX.beam), 0);
      fx.ring(x, z, r, 0.35, rgb(FX.beam)); fx.dustRing(x, z, 10, 0.4, r * 1.6, 0.5, 0.5); fx.star(x, 0.4, z, 1.4, 0.2, rgb(k));
    } else if (e.kind === 'aura') {
      fx.ring(x, z, r, 0.6, rgb(c, 0.9)); fx.embers(x, 0.6, z, 30, 1.6, rgb(c)); fx.star(x, 1.4, z, 2, 0.4, rgb(k, 0.8));
    }
  });
  // an officer's guard: a white-hot clash on the block, a burst and a ring when the third block breaks it
  on('block', (e) => { fx.star(e.x, e.y, e.z, 0.9, 0.12, [2.4, 2.3, 2.0]); fx.embers(e.x, e.y, e.z, 6, 0.4, [2.2, 1.8, 1.2]); });
  on('officer:break', (e) => { fx.ring(e.x, e.z, 3.2, 0.4, [2.4, 0.5, 0.25]); fx.star(e.x, e.y, e.z, 1.8, 0.3, [2.4, 0.6, 0.3]); fx.dustRing(e.x, e.z, 12, 0.5, 4, 0.45, 0.5); });
  on('guard:break', (e) => { fx.star(e.x, e.y, e.z, 2.0, 0.25, [2.4, 2.0, 1.0]); fx.ring(e.x, e.z, 2.6, 0.35, [2.2, 1.8, 0.8]); fx.flash(0.06); });
  on('proj:launch', (e) => fx.star(e.x + Math.sin(e.yaw) * 0.8, e.y, e.z + Math.cos(e.yaw) * 0.8, 0.9, 0.14, rgb(FX.core)));

  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const b of beams) {
        if (!b.g.visible) continue;
        b.t += dt / b.dur;
        if (b.t >= 1) { b.g.visible = false; continue; }
        const k = b.t < 0.12 ? b.t / 0.12 : 1 - (b.t - 0.12) / 0.88;          // flare in, thin out
        b.g.scale.set(b.w * (0.4 + 0.6 * k), b.w * (0.4 + 0.6 * k), b.len * Math.min(1, b.t * 6));
        for (const m of b.g.children) m.material.opacity = k;
      }
      const ps = game.combat.projs || [];
      const cam = camera.position;
      for (let i = 0; i < N; i++) {
        const g = pool[i], p = ps[i];
        if (!p) { g.visible = false; continue; }
        const big = p.kind === 'crescent', life = p.age / p.life;
        const ringV = p.kind === 'ring';                             // 360° volleys: smaller and fainter, so the hero stays visible
        const s = p.r * (big ? 1.5 : ringV ? 0.9 : 1.3) * Math.min(1, 0.55 + p.age * 0.12);
        g.visible = true;
        g.position.set(p.x, p.y, p.z);
        // wind blades roll diagonally (alternating per blade, a slight flutter); crescent waves stand upright
        g.rotation.set(0, p.yaw, big ? 0 : (p.key & 1 ? 0.7 : -0.7) + Math.sin(t * 11 + i) * 0.08);
        g.scale.setScalar(s);
        // fade out near the end of the flight, and near the lens (a ring volley also sends blades at the camera)
        const dc = Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
        const toward = (Math.sin(p.yaw) * (cam.x - p.x) + Math.cos(p.yaw) * (cam.z - p.z)) / (Math.hypot(cam.x - p.x, cam.z - p.z) || 1);
        const a = (life > 0.75 ? (1 - life) / 0.25 : 1) * Math.min(1, Math.max(0, (dc - 3) / 4)) * (toward > 0.35 ? 0.12 : 1) * (ringV ? 0.55 : 1);
        g.children[0].material.opacity = a; g.children[1].material.opacity = a;
        if (!ringV && i % 2 === (game.frame & 1)) fx.embers(p.x, p.y - 0.4, p.z, 1, p.r * 0.5, rgb(FX.proj, 0.9));
      }
    },
  };
}
