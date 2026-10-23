// Boot + fixed 60 Hz loop. Sim modules (hero, combat, crowd, musou, camera control yaw) advance only in step();
// render-side modules read sim state in render() and never write it.
import * as THREE from 'three';
import { rng, vrng } from './core/rng.js';
import { emit } from './core/events.js';
import { createInput } from './core/input.js';
import { createPost } from './post/post.js';
import { createWorld } from './world/world.js';
import { createHero, createHeroView, updateAnim, HP0 } from './hero/hero.js';
import { MOVES } from './hero/moves.js';
import { createCrowd } from './crowd/crowd.js';
import { createCrowdView } from './crowd/view.js';
import { createCombat } from './combat/combat.js';
import { createMusou } from './musou/musou.js';
import { createMusouView } from './musou/view.js';
import { createCamSim, createCameraRig } from './camera/camera.js';
import { createVfx } from './vfx/vfx.js';
import { createSignatureFx } from './vfx/signature.js';
import { createChargeFx } from './vfx/charge.js';
import { createHud, paintPortrait } from './ui/hud.js';
import { HERO, HEROES } from './heroes/index.js';
import { STAGE, STAGES } from './stages/index.js';
import { createBoss } from './boss/boss.js';
import { createBossView } from './boss/view.js';
import { createAudio } from './audio/audio.js';
import { createSupplies } from './supplies/supplies.js';
import { createSuppliesView } from './supplies/view.js';
import { on } from './core/events.js';
import { createCampaign } from './stages/campaign.js';
import { createProps } from './stages/props.js';
import { createStructures } from './stages/structures.js';
import { createBases } from './stages/bases.js';
import { createBasesView } from './stages/basesView.js';
import { createWeather } from './world/weather.js';
import { createTouch } from './ui/touch.js';
import { createArmory, itemCard } from './ui/armory.js';
import { gearOf, addXP, heroP, storyWon } from './progress/profile.js';
import { createStoryMenu, createCutscene } from './ui/story.js';
import { chapterById, nextChapter } from './stages/story.js';
import { DIFFS, QUALITY, settings, saveSettings, bestOf, keepBest, rankOf } from './core/settings.js';

const params = new URLSearchParams(location.search);
const CH = chapterById(params.get('story'));                      // story mode: this chapter (stages/story.js)
// graphics quality: chosen in the menu, or auto (last level the governor settled on; phones start at medium)
const autoStart = () => settings.autoQ || (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high');
let qLevel = QUALITY[params.get('q')] ? params.get('q') : settings.quality === 'auto' ? autoStart() : settings.quality;
const ENEMIES = Math.max(0, Math.min(2000, params.get('enemies') ? Number(params.get('enemies')) | 0 : QUALITY[qLevel].enemies));

const canvas = document.getElementById('c');
let vw = innerWidth, vh = innerHeight;

const post = createPost({ canvas, width: vw, height: vh });
const scene = new THREE.Scene();
const world = createWorld(scene);
const applyQuality = (id) => { qLevel = id; const q = QUALITY[id]; post.setQuality(q); world.setShadow(q.shadow); };
applyQuality(qLevel);

// ---- sim
const game = { frame: 0, hitstop: 0, freeze: 0, diff: DIFFS[settings.diff] };
game.cam = createCamSim();
game.hero = createHero(game);
game.crowd = createCrowd(game, ENEMIES);
game.combat = createCombat(game);
game.musou = createMusou(game);
// stage boss (虎牢關): Lü Bu — or Guan Yu when the player is Lü Bu
const bossCfg = STAGE.boss && (STAGE.boss.id === HERO.id ? STAGE.boss.alt : STAGE.boss);
game.boss = bossCfg ? createBoss(game, HEROES.find((h) => h.id === bossCfg.id)) : null;
game.campaign = createCampaign(game);   // the battle's goals (STAGE.script): officers, spots to take, the boss → 勝利
game.bases = createBases(game);         // the camps of the field (STAGE.map.bases): garrisons, captains, reinforcements
const input = createInput();
const touch = createTouch(input, game, { onPause: () => setPaused(true) });   // phones / tablets: stick + buttons
game.supplies = createSupplies(game);         // jars / crates on the field, food, wine, 虎符, 玄甲 (supplies/supplies.js)
if (params.has('debug') || params.has('rec')) Object.assign(window, { game, scene });   // debug: inspect sim state from the console

// ---- render side
const heroView = createHeroView(scene, game.hero);
const crowdView = createCrowdView(scene, game);
const camRig = createCameraRig(game, vw, vh);
const vfx = createVfx(scene, game, world);
const sigFx = createSignatureFx(scene, game, vfx, camRig.camera);   // per-hero projectiles, beams, roar (render-only)
const chargeFx = HERO.anim === 'fan' ? null : createChargeFx(scene, game, camRig.camera, heroView);   // charge-hold glow at the blade
const bossView = game.boss ? createBossView(scene, game, vfx, { bossIntro: bossCfg.intro }) : null;
const musouView = createMusouView(scene, game, camRig.camera);   // musou part: grade, dragon, cut-in (render-only)
const props = createProps(scene, game, vfx, camRig.camera);                      // goal beacons, the bundle by the well, fire ships, the ally
const suppliesView = createSuppliesView(scene, game, vfx);
const structures = createStructures(scene, game, vfx);            // altars / dams to break, the flood
const basesView = createBasesView(scene, game, vfx);              // the camps and their standards
const weather = createWeather(scene, camRig.camera);              // rain (STAGE.weather)
// hud part: camera passed so officer name/HP tags can be projected over their heads (read-only)
const hud = createHud(document.getElementById('hud'), game, { camera: camRig.camera });
createAudio(game);

// debug: ?preview=<move id | musou clip id> freezes the hero in that move at window.previewT (0..1) — pose sheets
const PREVIEW = params.get('preview');
if (PREVIEW) window.previewT = 0;
function previewStep() {
  const h = game.hero, m = MOVES[PREVIEW];
  Object.assign(h, { x: 0, y: 0, z: 0, yaw: 0, grounded: true });
  if (m) Object.assign(h, { state: 'attack', move: PREVIEW, moveT: Math.round(window.previewT * m.frames), moveSeq: 1 });
  else if (PREVIEW === 'idle') Object.assign(h, { state: 'idle', move: null, stateT: Math.round(window.previewT * 149) });
  else Object.assign(h, { state: 'musou', move: null, musouClip: PREVIEW, musouT: window.previewT });
  updateAnim(h); h.anim.blendF = h.anim.blendN;
  game.frame++;
}
function step() {
  if (PREVIEW) { previewStep(); return; }
  if (window.__onStep) window.__onStep(game.frame);          // recordings (?rec): scripted input keyed by sim frame
  const inp = input.sample();
  game.cam.step(game, inp);
  game.hero.step(inp);
  game.combat.step();
  game.crowd.step();
  game.supplies.step();
  if (game.boss) game.boss.step();
  game.campaign.step();
  game.bases.step();
  game.musou.step();
  game.frame++;
  vfx.afterStep();
}

let lastRenderFrame = 0;
function render() {
  const dt = Math.min(10, Math.max(0, (game.frame - lastRenderFrame) / 60));
  lastRenderFrame = game.frame;
  heroView.update(Math.min(dt, 0.1));
  crowdView.update(dt);
  vfx.update(dt);
  sigFx.update(dt);
  suppliesView.update();
  structures.update(dt);
  basesView.update(dt);
  weather.update(dt);
  if (chargeFx) chargeFx.update(dt);
  if (bossView) bossView.update(dt);
  props.update(dt);
  camRig.update(dt);
  world.update(dt, camRig.focus);
  musouView.update(dt);
  post.flash(Math.max(vfx.flash, weather.flash));
  post.render(scene, camRig.camera, game.frame / 60, camRig.focus, world.sunDir);   // post-fx: DoF focus + haze sun
  hud.update();
  touch.update();
}

// ---- result card: 戰死 when the hero falls (restart / back to hero select), 勝利 when the battle's last goal falls
// (stages/campaign.js), with the rank against the stage's par and the best result kept per battle × hero
const clock = (sec) => { const s = Math.round(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const result = (() => {
  const el = document.createElement('div');
  el.id = 'result'; el.hidden = true;
  el.innerHTML = '<div class="head"><div class="big"></div><div class="rank"><b></b><small>評價 RANK</small></div></div><div class="en"></div><div class="stats"></div><div class="best"></div><div class="xpgain"></div><div class="loot"></div><div class="btns"><button data-a="next">下一章<small>NEXT CHAPTER</small></button><button data-a="retry">再戰<small>RETRY · Enter</small></button><button data-a="menu">選將<small>HEROES · Esc</small></button><button data-a="go">繼續<small>CONTINUE</small></button></div>';
  document.body.appendChild(el);
  const big = el.querySelector('.big'), rankEl = el.querySelector('.rank'), rankB = el.querySelector('.rank b');
  const en = el.querySelector('.en'), stats = el.querySelector('.stats'), best = el.querySelector('.best'), cont = el.querySelector('[data-a="go"]');
  const xpEl = el.querySelector('.xpgain'), lootEl = el.querySelector('.loot'), nextB = el.querySelector('[data-a="next"]'), menuB = el.querySelector('[data-a="menu"]');
  let maxCombo = 0, open = false, t0 = 0, loot = [], paid = false;
  on('hit', () => { maxCombo = Math.max(maxCombo, game.hero.combo); });
  on('scenario', () => { maxCombo = 0; loot = []; paid = false; });
  on('loot', (e) => loot.push(e.item));
  const RANK_XP = { S: 700, A: 480, B: 320, C: 200 };
  const show = (win, delay, clear = null) => setTimeout(() => {
    if (open || (!win && game.hero.state !== 'dead')) return;
    big.textContent = win ? '勝利' : '戰死'; en.textContent = win ? `VICTORY · ${STAGE.en}` : 'FALLEN IN BATTLE';
    el.classList.toggle('win', win); cont.hidden = !win || !!CH;
    nextB.hidden = !(CH && win);
    if (CH) {
      nextB.innerHTML = nextChapter(CH) ? '下一章<small>NEXT CHAPTER · Enter</small>' : '終章<small>EPILOGUE · Enter</small>'; menuB.innerHTML = '劇情<small>STORY · Esc</small>';
      el.querySelector('[data-a="retry"]').innerHTML = win ? '再戰<small>RETRY</small>' : '再戰<small>RETRY · Enter</small>';
    }
    const time = clear ? clear.time : (game.frame - t0) / 60;
    stats.innerHTML = `<span>擊破 <b>${game.hero.kos}</b></span><span>最大連擊 <b>${maxCombo}</b></span><span>時間 <b>${clock(time)}</b></span><span>難度 <b>${game.diff.zh}</b></span>`;
    rankEl.hidden = !clear; best.textContent = '';
    if (clear && STAGE.par) {
      const rank = rankOf({ ...clear, hpMax: game.hero.hpMax }, STAGE.par);
      rankB.textContent = rank; rankEl.dataset.r = rank;
      const isNew = keepBest(STAGE.id, HERO.id, { rank, time: Math.round(time), kos: clear.kos, combo: maxCombo, diff: game.diff.id });
      if (CH) storyWon(CH.id, rank);
      const b = bestOf(STAGE.id, HERO.id);
      best.innerHTML = isNew ? '<em>新紀錄</em> NEW RECORD' : `最佳紀錄 BEST · <b>${b.rank}</b> · ${clock(b.time)} · ${DIFFS[b.diff]?.zh || ''}`;
      paintBest();
    }
    // experience: KOs, officers, the rank (a fall still earns half) — once per battle
    if (!paid) {
      paid = true;
      const h = game.hero, rk = rankEl.dataset.r;
      const xp = (h.kos + h.officerKOs * 15 + (clear ? RANK_XP[rk] || 200 : 0)) * (win ? 1 : 0.5) * (game.diff.id === 'hard' ? 1.3 : game.diff.id === 'easy' ? 0.8 : 1);
      const r = addXP(HERO.id, xp);
      xpEl.innerHTML = `經驗 <b>+${r.gained}</b>` + (r.lv > r.lv0 ? ` · <em>等級提升 Lv ${r.lv0} → ${r.lv}</em>` : ` · Lv ${r.lv}`);
      paintLv();
    }
    lootEl.innerHTML = loot.length ? `<small>獲得裝備 LOOT</small><div>${loot.map((it) => itemCard(it)).join('')}</div>` : '';
    el.hidden = false; open = true; hudEl.hidden = true; document.body.classList.add('result');
  }, delay);
  on('hero:death', () => show(false, 1800));
  on('boss:defeat', () => { if (!STAGE.script) show(true, 3200); });
  on('stage:clear', (e) => show(true, 1600, e));
  const act = (a) => {
    if (!open) return;
    if (a === 'next') {                                      // story: the scene after the battle, then the next chapter
      r.hide(); setPaused(true); menu.hidden = true;
      cine.play(CH, 'post', () => { const nx = nextChapter(CH); if (nx) playChapter(nx); else { setPaused(true); storyMenu.open(); } });
    } else if (a === 'retry') start();
    else if (a === 'menu') { start(); setPaused(true); if (CH) storyMenu.open(); }
    else { r.hide(); }
  };
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); act(b.dataset.a); } });
  const r = {
    get open() { return open; }, act,
    hide() { el.hidden = true; open = false; if (!paused) hudEl.hidden = false; t0 = game.frame; document.body.classList.remove('result'); },
  };
  return r;
})();

/** His level and loadout (progress/profile.js) onto the sim hero: health, run speed; combat reads hero.gear. */
function applyGear(keepHp = false) {
  const h = game.hero, G = gearOf(HERO.id), k = h.hpMax ? h.hp / h.hpMax : 1;
  h.gear = G; h.hpMax = HP0 + G.hp; h.spdK = 1 + G.spd;
  if (keepHp) h.hp = Math.min(h.hpMax, Math.round(h.hpMax * k));
}
function start() {
  rng.seed(1); vrng.seed(7936);
  result.hide();
  applyGear();
  game.hero.reset();
  game.crowd.reset(); game.combat.reset(); game.musou.reset(); game.cam.reset(game.hero.yaw);
  if (game.boss) game.boss.reset(), game.boss.st = 'off';
  game.campaign.reset();                         // before the army: with a script, the named officers wait for their goal
  game.bases.reset();                            // camps back to their holders; spawnArmy garrisons the enemy's
  heroView.reset();
  game.crowd.spawnArmy(Math.min(ENEMIES, game.crowd.grunts), game.hero.x, game.hero.z);
  if (params.has('musou')) game.hero.musou = game.hero.musouMax;   // debug: start with a full gauge
  emit('scenario', { name: 'arena' });
}

addEventListener('resize', () => {
  vw = innerWidth; vh = innerHeight;
  post.setSize(vw, vh);
  camRig.resize(vw, vh);
  render();
});

// ---- start / pause menu (index.html #menu): the sim waits while it is open
const menu = document.getElementById('menu'), go = document.getElementById('go'), hudEl = document.getElementById('hud');
// hero select: one card per officer; picking another reloads with ?hero=<id> (the model is built at boot)
// … and one per battle (?stage=<id>; the sky is compiled at boot too)
const pick = (key, id, cur) => { if (id === cur) return; const q = new URLSearchParams(location.search); q.set(key, id); location.search = q; };
const pickHero = (id) => pick('hero', id, HERO.id), pickStage = (id) => pick('stage', id, STAGE.id);
document.getElementById('tagline').textContent = HERO.tagline;
const card = (row, on, html, fn) => {
  const b = document.createElement('button');
  b.className = on ? 'on' : '';
  b.innerHTML = html;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  document.getElementById(row).appendChild(b);
  return b;
};
const heroCards = HEROES.map((h) => { const b = card('heroes', h === HERO, `<canvas width="20" height="20"></canvas><span><b>${h.zh}</b><small>${h.weapon}</small><small>${h.role}</small></span><i class="lvb"></i>`, () => pickHero(h.id)); paintPortrait(b.firstChild, h); return b; });
/** Each officer's level on his card (progress/profile.js). */
function paintLv() { HEROES.forEach((h, k) => { heroCards[k].querySelector('.lvb').textContent = `Lv ${heroP(h.id).lv}`; }); }
paintLv();
const armory = createArmory({ onChange: () => applyGear(true) });
const cine = createCutscene();
/** Story: go to a chapter — its stage with its officer (the page reloads: stages and models are built at boot). */
function playChapter(ch) {
  const q = new URLSearchParams({ stage: ch.stage, hero: ch.hero, story: ch.id });
  for (const k of ['q', 'touch', 'look']) if (params.has(k)) q.set(k, params.get(k));   // keep the viewer's own choices, drop debug ones
  location.search = q;
}
const storyMenu = createStoryMenu({ onPlay: playChapter });
document.getElementById('storyBtn').addEventListener('click', (e) => { e.stopPropagation(); storyMenu.open(); });
document.getElementById('arm').addEventListener('click', (e) => { e.stopPropagation(); armory.open(); });
const stageCards = STAGES.map((s) => card('stages', s === STAGE, `<span><b>${s.zh}</b><small>${s.time} · ${s.enemy.army}</small></span><i class="rk"></i>`, () => pickStage(s.id)));
/** Best rank of the chosen hero on each battle card. */
function paintBest() {
  STAGES.forEach((s, k) => {
    const b = bestOf(s.id, HERO.id), rk = stageCards[k].querySelector('.rk');
    rk.textContent = b ? b.rank : ''; rk.dataset.r = b ? b.rank : ''; rk.title = b ? `最佳 ${b.rank} · ${clock(b.time)}` : '';
  });
}
paintBest();
// graphics: applies at once (soldier count on the next load); 自動 shows the level it is running at
const gfxRow = document.getElementById('gfx');
const gfxBtns = ['auto', ...Object.keys(QUALITY)].map((id) => {
  const b = document.createElement('button');
  b.dataset.q = id;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    saveSettings({ quality: id });
    applyQuality(id === 'auto' ? autoStart() : id);
    paintGfx();
  });
  gfxRow.appendChild(b);
  return b;
});
function paintGfx() {
  for (const b of gfxBtns) {
    const id = b.dataset.q;
    b.innerHTML = id === 'auto' ? `自動<small>AUTO · ${QUALITY[qLevel].zh}</small>` : `${QUALITY[id].zh}<small>${QUALITY[id].en}</small>`;
    b.classList.toggle('on', id === settings.quality);
  }
}
paintGfx();
// difficulty: applies at once (the battle restarts)
const diffRow = document.getElementById('diff');
for (const d of Object.values(DIFFS)) {
  const b = document.createElement('button');
  b.innerHTML = `${d.zh}<small>${d.en}</small>`; b.className = d.id === settings.diff ? 'on' : '';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (d.id === game.diff.id) return;
    saveSettings({ diff: d.id }); game.diff = d;
    for (const x of diffRow.children) x.classList.toggle('on', x === b);
    start();
  });
  diffRow.appendChild(b);
}
let paused;
const setPaused = (v) => { paused = v; menu.hidden = !v; hudEl.hidden = v; document.body.classList.toggle('paused', v); input.sample(); };   // sample(): drop keys pressed on the menu
go.addEventListener('click', () => {
  setPaused(false);
  if (document.body.classList.contains('touch')) {          // phones: fill the screen, hold landscape where allowed
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
});
addEventListener('keydown', (e) => {
  if (result.open) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') result.act(CH && document.querySelector('#result [data-a="next"]').hidden === false ? 'next' : 'retry');
    else if (e.code === 'Escape') result.act('menu');
    return;
  }
  if (cine.on) return;                                       // the cutscene has the keys
  if (e.code === 'Escape') setPaused(!paused);
  else if (paused && (e.code === 'Enter' || e.code === 'NumpadEnter')) setPaused(false);
  else if (paused && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    const i = HEROES.indexOf(HERO) + (e.code === 'ArrowLeft' ? -1 : 1);
    pickHero(HEROES[(i + HEROES.length) % HEROES.length].id);
  } else if (paused && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
    const i = STAGES.indexOf(STAGE) + (e.code === 'ArrowUp' ? -1 : 1);
    pickStage(STAGES[(i + STAGES.length) % STAGES.length].id);
  }
});
addEventListener('blur', () => setPaused(true));

// ---- auto quality: while playing, frames slower than 25 ms on average (under 40 fps) over two 3 s windows in a row
// step the graphics down one level; the level reached is remembered for the next visit
let gT = 0, gN = 0, gSlow = 0;
function govern(dt) {
  if (settings.quality !== 'auto' || paused || document.hidden || params.has('rec') || params.get('q')) { gT = gN = 0; return; }
  gT += dt; gN++;
  if (gT < 3) return;
  const avg = gT / gN; gT = gN = 0;
  gSlow = avg > 0.025 ? gSlow + 1 : 0;
  if (gSlow >= 2 && qLevel !== 'low') {
    gSlow = 0;
    const next = qLevel === 'high' ? 'medium' : 'low';
    applyQuality(next); saveSettings({ autoQ: next }); paintGfx();
  }
}

// ---- loop
let acc = 0, last = performance.now();
const frame = (now) => {
  requestAnimationFrame(frame);
  // clamp at 0 too: the first rAF timestamp can precede the performance.now() taken at module init
  const raw = Math.max(0, (now - last) / 1000);
  acc += Math.min(0.1, raw);
  last = now;
  govern(Math.min(0.25, raw));
  if (paused) {
    acc = 0; input.sample();
    if (cine.on) { cine.tick(Math.min(0.1, raw)); render(); }   // story scene: the field flies by while the sim waits
    return;
  }
  let n = 0;
  while (acc >= 1 / 60 && n < 4) { step(); acc -= 1 / 60; n++; }
  if (n === 4) acc = 0;
  render();
};

start();
setPaused(!PREVIEW);
if (PREVIEW) document.getElementById('hud').hidden = true;
if (CH && !PREVIEW) {                                              // story chapter: its opening scene, then straight into battle
  menu.hidden = true;
  cine.play(CH, 'pre', () => setPaused(false));
}
render();
post.warm(scene, camRig.camera);
const boot = document.getElementById('boot');                     // the boot screen (index.html) fades out
if (boot) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
requestAnimationFrame(frame);
