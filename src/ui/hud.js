// DOM HUD in the DW8 layout with the concept's calligraphy: pixel portrait badge + long teal HP bar + 3-segment
// musou gauge (bottom band), KO count with slam pops and 50-KO milestone seal (bottom right / centre, kept off the hero),
// chain counter that rolls up hit by hit with DW8 ghost digits (left), officer target bar (top left) and stacked floating
// officer name/HP/▼▼ tags, square battlefield minimap with morale bar (top right), queued system banners and dialogue,
// a title/controls intro card, and an idle auto-fade.
// Render-only: reads sim state, never writes it. Animations are timed in sim frames.
// Styles live in index.html (#hud ...). Sizes are rem, and 1rem = 1/72 of the viewport height (10 px at 720p).
import { Vector3 } from 'three';
import { on } from '../core/events.js';
import { HERO, HEROES } from '../heroes/index.js';
import { STAGE } from '../stages/index.js';
import { forHero } from '../stages/campaign.js';
import { ITEMS, BUFF } from '../supplies/supplies.js';
import { RARITY } from '../progress/loot.js';
import { ST, KIND } from '../crowd/crowd.js';
import { t as tr } from '../core/lang.js';
import { ARENA_RADIUS, WALL_Z, GATE_X } from '../world/world.js';

const OFFICERS = STAGE.enemy.officers;                         // four tags; the names come from game.crowd.names (a script may rename a slot)
const OPEN = STAGE.lines[HERO.id] || HERO.lines.open;
/** Paint a hero's 20×20 pixel portrait into a canvas. */
export function paintPortrait(cv, hero = HERO) {
  const g = cv.getContext('2d');
  hero.face.forEach((row, y) => [...row].forEach((ch, x) => { if (hero.pal[ch]) { g.fillStyle = hero.pal[ch]; g.fillRect(x, y, 1, 1); } }));
}

export function createHud(root, game, { camera = null } = {}) {
  game.hudTagR = 44.7;   // render-only seam: crowd view skips its 3D officer ▼ where the floating tags below take over
  root.innerHTML = `
    <div class="h-intro"><div class="zh">${HERO.zh}</div><i class="seal">${HERO.seal}</i><div class="en">${HERO.en}</div>
      <div class="sub">${HERO.sub}</div>
      <div class="keys"><kbd>WASD</kbd> 移動 move · <kbd>J</kbd> 攻擊 attack · <kbd>K</kbd> 蓄力 charge<br>
        <kbd>Space</kbd> 跳躍 jump · <kbd>L</kbd> 閃避 dodge · <kbd>I</kbd> 無雙 musou · <kbd>U</kbd> 騎馬 horse · <kbd>Q</kbd><kbd>E</kbd> 視角 · <kbd>H</kbd> 說明</div></div>
    <div class="h-target"><i class="seal">將</i><b></b><span></span><div class="bar"><em></em><i></i></div><strong>擊破</strong></div>
    <div class="h-map"><div class="morale"><i></i><span>${STAGE.ally.label}</span><span>${STAGE.enemy.ch}</span></div><canvas width="400" height="400"></canvas><i class="seal">${STAGE.seal}</i><small class="mhint">M · 全圖</small></div>
    <div class="h-offs">${OFFICERS.map(([zh, en]) => `<div class="off"><i class="ld"></i><div class="mk">▼▼</div><div class="bd"><b>${zh}</b><span>${en}</span><div class="bar"><em></em><i></i></div></div></div>`).join('')}</div>
    <div class="h-chain"><div class="num"><b class="dig" data-t="0"><span>0</span></b><u></u><u></u><u></u></div><small><em>連擊</em>CHAIN</small></div>
    <div class="h-mile"><b class="dig" data-t="50"><span>50</span></b><i class="seal">擊破</i></div>
    <div class="h-band"><p></p><small></small></div>
    <div class="h-dlg"><canvas width="20" height="20"></canvas><i class="seal"></i><div><b><em>${HERO.zh}</em> <span>${HERO.en}</span></b><p></p><small></small></div></div>
    <div class="h-goal"><i class="seal">目標</i><div><b></b><small></small><div class="cap"><i></i></div></div><span class="pg"></span></div>
    <div class="h-ways">${[0, 1, 2].map(() => '<div class="way"><i></i><b></b><span></span></div>').join('')}</div>
    <div class="h-caps">${[0, 1, 2].map(() => '<div class="cap"><b>據點兵長</b><div class="bar"><i></i></div></div>').join('')}</div>
    <div class="h-copy">${HERO.copy}</div>
    <div class="h-player"><div class="badge"><canvas width="20" height="20"></canvas></div><div class="name">${HERO.zh}<small class="lv"></small></div>
      <div class="bar hp"><em></em><i></i></div>
      <div class="mu"><div><i></i></div><div><i></i></div><div><i></i></div><span>無雙</span></div></div>
    <div class="h-buffs"><div class="bf atk"><b>虎符</b><span>攻×2</span><i></i></div><div class="bf def"><b>玄甲</b><span>防×2</span><i></i></div></div>
    <div class="h-toast"><b></b><small></small></div>
    <div class="h-ko"><div class="num"><b class="dig" data-t="0"><span>0</span></b><u></u></div><small><em>擊破</em>K.O. COUNT</small></div>`;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const intro = $('.h-intro'), player = $('.h-player'), hpI = $('.hp i'), hpE = $('.hp em'), muSeg = $$('.mu i'), mu = $('.mu');
  const ko = $('.h-ko'), koB = $('.h-ko b'), koG = $('.h-ko u'), chain = $('.h-chain'), chainB = $('.h-chain b');
  const chainG = $$('.h-chain u').map((el) => ({ el, f: -99 }));          // ghost pool: one per tick, 3 alive in a roll
  const mile = $('.h-mile'), mileB = $('.h-mile b'), mileS = $('.h-mile .seal');
  const band = $('.h-band'), bandP = $('.h-band p'), bandS = $('.h-band small');
  const dlg = $('.h-dlg'), dlgP = $('.h-dlg p'), dlgS = $('.h-dlg small'), copy = $('.h-copy');
  const dlgCv = $('.h-dlg canvas'), dlgSeal = $('.h-dlg .seal'), dlgName = $('.h-dlg b em'), dlgEn = $('.h-dlg b span');
  const buffs = [['buffAtk', $('.bf.atk')], ['buffDef', $('.bf.def')]].map(([k, el]) => ({ k, el, bar: el.querySelector('i') }));
  const toast = $('.h-toast'), toastB = $('.h-toast b'), toastS = $('.h-toast small'), lvEl = $('.name .lv');
  const goalEl = $('.h-goal'), goalB = $('.h-goal b'), goalS = $('.h-goal small'), goalPg = $('.h-goal .pg'), goalCap = $('.h-goal .cap'), goalCapI = $('.h-goal .cap i');
  const ways = $$('.h-ways .way').map((el) => ({ el, i: el.querySelector('i'), b: el.querySelector('b'), sp: el.querySelector('span') }));
  const capTags = $$('.h-caps .cap').map((el) => ({ el, bar: el.querySelector('.bar i') }));
  const target = $('.h-target'), targetB = $('.h-target b'), targetS = $('.h-target span'), targetI = $('.h-target .bar i'), targetE = $('.h-target .bar em');
  const offs = $$('.off').map((el) => ({ el, bd: el.querySelector('.bd'), mk: el.querySelector('.mk'), ld: el.querySelector('.ld'),
    bar: el.querySelector('.bar i'), lagEl: el.querySelector('.bar em'), lag: 1, nb: el.querySelector('.bd b'), ns: el.querySelector('.bd span') }));
  const moraleI = $('.morale i'), mapEl = $('.h-map');
  const mapCv = $('.h-map canvas'), map = mapCv.getContext('2d');
  // M (or a tap on the map): the whole battlefield, centred on the field, instead of the patch round the hero
  let bigMap = false;
  const toggleMap = () => { bigMap = !bigMap; mapEl.classList.toggle('big', bigMap); };
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) toggleMap(); });
  mapEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMap(); });
  $$('canvas[width="20"]').forEach((cv) => paintPortrait(cv));
  // dialogue speakers: the hero, an ally officer, the boss (pixel portraits) or a named enemy officer (red seal)
  const cp = game.campaign;
  const speaker = (who) => {
    if (who === 'ally' && cp?.ally) who = cp.ally.id;
    if (who === 'boss' && game.boss) return { def: game.boss.def, side: 'foe' };
    if (who.startsWith('off:')) { const [zh, en] = game.crowd.names[+who.slice(4)]; return { zh, en, side: 'foe' }; }
    const def = who === 'hero' ? HERO : HEROES.find((x) => x.id === who) || HERO;
    return { def, side: def === HERO ? 'hero' : 'ally' };
  };
  let dlgWho = 'hero';
  const showSpeaker = (who) => {
    if (who === dlgWho) return;
    dlgWho = who;
    const sp = speaker(who);
    dlg.dataset.side = sp.side;
    if (sp.def) {
      const g = dlgCv.getContext('2d'); g.clearRect(0, 0, 20, 20); paintPortrait(dlgCv, sp.def);
      text(dlgName, sp.def.zh); text(dlgEn, sp.def.en);
    } else { text(dlgName, sp.zh); text(dlgEn, sp.en); text(dlgSeal, sp.zh[0]); }
    dlg.classList.toggle('foe-seal', !sp.def);
  };

  // ---- event-driven state (frames are sim frames)
  const S = {};
  const reset = () => Object.assign(S, {
    lastCombo: 0, shownChain: 0, chainF: -99, chainQ: [], ghostN: 0, shownKo: 0, koF: -99, mile: 0, mileF: -99, mileTop: 33, mileDim: 1,
    lagHp: 1, lastF: 0, hurtF: -99, actF: 0, band: null, bandQ: [], dlg: null, waveF: -999, tgt: -1, tgtF: -999, tgtKoF: -999,
    musouF: -999, musouEnd: -999, waves: [], introCut: 0, dlgQ: [], goalI: -2, goalF: -999, toastF: -999,
  });
  reset();
  // heavy numerals: the rim layer (::before) reads data-t, the gradient face is the inner span
  const num = (el, v) => { v = String(v); if (el.dataset.t !== v) { el.dataset.t = v; el.firstChild.textContent = v; } };
  const resetText = () => { num(koB, 0); koG.textContent = '0'; };
  let showKeys = null;
  // system banners queue (one at a time, held back while the Musou plays); dialogue (top left) and the banner band
  // (y 64-70 %) sit apart, so neither cancels the other. Dialogue holds 5 s like DW8.
  const banner = (html, en, dur = 150) => { if (S.bandQ.length < 3) S.bandQ.push({ html, en, dur }); };
  const say = (zh, en, dur = 300, who = 'hero') => { S.dlg = { zh, en, f: game.frame, dur, who }; };
  on('scenario', (e) => { reset(); resetText(); if (e.name === 'crowd' || e.name === 'arena') { S.dlg = { zh: OPEN[0], en: OPEN[1], f: 185, dur: 300, who: 'hero' }; banner(STAGE.intro[0], STAGE.intro[1], 170); } });
  // stage script (stages/campaign.js): goal banners, the speakers' lines (queued, 4 s each), the clear banner
  const goalText = (g) => forHero(g.goal) || ['', ''];
  on('say', (e) => { if (S.dlgQ.length < 4) S.dlgQ.push({ zh: e.zh, en: e.en, dur: 250, who: e.who }); });
  on('goal:start', (e) => { const [zh, en] = goalText(e.goal); banner(`<b class="gl">目標</b>${zh}`, `Objective — ${en}`, 170); S.goalF = game.frame; });
  on('goal:progress', (e) => {
    const k = cp?.goal?.kind;
    if ((k === 'reach' || k === 'destroy') && cp.of > 1) banner(`${cp.goal.label}${k === 'destroy' ? ' 破壞' : ''} <em>${e.n} / ${e.of}</em>`, `${e.n} of ${e.of}`, 110);
  });
  on('flood', () => banner('<em>水淹七軍</em>', 'The Han breaks its banks — the seven armies are swept away', 200));
  on('base:captain', (e) => banner(`<em>據點兵長</em> 出現`, `The camp's captain comes out`, 110));
  on('base:taken', (e) => banner(`敵軍據點 <em>制壓</em>${e.left ? ` · 殘 ${e.left}` : ''}`, e.left ? `Enemy camp taken — ${e.left} left` : 'Every enemy camp taken', 130));
  on('goal:done', (e) => { if (e.goal.kind !== 'officer') banner(`${goalText(e.goal)[0]} <em>達成</em>`, 'Objective complete', 140); });
  on('buff', () => banner('奪得 <em>青釭劍</em> · 攻擊力上昇', 'The Qinggang sword — attack up', 160));
  // supplies: what he just took, over his feet (food shows the HP it gave back)
  on('loot', (e) => {                                           // a chest: the piece, in its rarity's colour
    const it = e.item, R = RARITY[it.r];
    text(toastB, `獲得 ${'★'.repeat(it.r)} ${it.name}`); text(toastS, `${R.en} · ${it.kind === 'weapon' ? 'WEAPON' : 'ACCESSORY'} → 武庫`);
    toast.dataset.k = 'loot'; toast.style.setProperty('--rc', R.col); S.toastF = game.frame;
  });
  on('pickup', (e) => {
    if (e.kind === 'chest') return;                             // the loot toast tells it
    const I = ITEMS[e.kind];
    text(toastB, I.heal ? `${I.zh} +${Math.round(e.v)}` : `${I.zh} · ${I.fx}`);
    text(toastS, I.en); toast.dataset.k = e.kind; S.toastF = game.frame;
  });
  on('stage:clear', () => { if (STAGE.clear) banner(`<em>${STAGE.clear[0]}</em>`, STAGE.clear[1], 200); });
  on('crowd:cavalry', (e) => {
    if (game.frame - (S.cavF ?? -1e9) > 1200) { S.cavF = game.frame; banner(`${STAGE.enemy.army}<em>騎兵</em> 來襲`, `${STAGE.enemy.en} cavalry incoming!`, 120); }
    S.waves.push({ x: e.x, z: e.z, f: game.frame });
  });
  on('block', (e) => {                                          // the first shield wall of a battle: how to break it
    if (e.shield && !S.shieldTip) { S.shieldTip = 1; banner('<em>大盾兵</em> 正面堅固 · 蓄力攻擊破防', 'Shield troops turn blows from the front — break them with a charge attack, or strike from behind', 170); }
  });
  on('rider:fall', () => {                                       // the first loose horse of a battle: it can be ridden
    if (!S.horseTip) { S.horseTip = 1; banner('敵騎 落馬 · 近空馬按 <em>U</em> 騎乘', 'A loose horse — get close and press U to ride it', 150); }
  });
  on('scenario', () => { S.shieldTip = 0; S.horseTip = 0; S.cavF = -1e9; });
  on('crowd:wave', (e) => {
    if (game.frame - S.waveF > 600) { S.waveF = game.frame; banner(`<em>${STAGE.enemy.army}</em>援軍 抵達`, `${STAGE.enemy.en} reinforcements have arrived!`, 130); }
    S.waves.push({ x: e.x, z: e.z, f: game.frame });
  });
  on('hit', (e) => { S.actF = game.frame; if (e.officer) { S.tgt = e.i; S.tgtF = game.frame; } });
  on('attack:start', () => { S.actF = game.frame; });
  on('ko', (e) => {
    if (!e.officer) return;
    const [zh, en] = game.crowd.names[(e.i - game.crowd.grunts) % OFFICERS.length];
    banner(`敵將 <em>${zh}</em> 擊破！`, `Enemy officer ${en.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())} defeated!`, 150);
    S.tgt = e.i; S.tgtKoF = game.frame;
  });
  on('musou:start', () => { S.musouF = S.actF = game.frame; S.band = null; S.dlg = null; });
  on('musou:end', () => { S.musouEnd = game.frame; say(...HERO.lines.musou); S.dlg.f += 20; });
  on('hero:hurt', () => { S.hurtF = S.actF = game.frame; });
  addEventListener('keydown', (e) => { if (e.code === 'KeyH') showKeys = !(showKeys ?? true); });

  const set = (el, prop, v) => { if (el.style[prop] !== v) el.style[prop] = v; };
  const text = (el, v) => { v = tr(String(v)); if (el.textContent !== v) el.textContent = v; };   // in the shown script: no rewrite every frame
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const mileOf = (n) => (n < 50 ? (n >= 25 ? 25 : 0) : Math.floor(n / 50) * 50);   // last KO milestone reached
  const v3 = new Vector3();

  return {
    update() {
      const h = game.hero, f = game.frame, c = game.crowd;
      const W = root.clientWidth, H = root.clientHeight;
      const df = Math.max(0, f - S.lastF); S.lastF = f;
      const inMusou = h.state === 'musou';

      // intro card (title + controls): first 3.5 s of a scenario; H toggles the controls back
      // (an officer tag that would land on the card fades it out instead of being shoved aside: S.introCut, set below)
      const introA = showKeys === false || S.musouF >= 0 ? 0 : clamp01((180 - f) / 30) * (1 - S.introCut);
      set(intro, 'opacity', (showKeys ? 1 : introA).toFixed(2));

      // idle auto-fade (quieter than DW8 at rest): 4 s after the last attack/hit/hurt, the player band, minimap and KO
      // count ease to 55 % over 40 f; the next action snaps them back. A full musou gauge keeps the band lit.
      const calm = 1 - 0.45 * clamp01((f - S.actF - 240) / 40) * (game.musou.ready() ? 0 : 1);
      set(player, 'opacity', calm.toFixed(2)); set(mapEl, 'opacity', calm.toFixed(2));

      // HP (teal, white lag bar) + 3-segment musou gauge
      const hp = h.hp / h.hpMax;
      S.lagHp = f - S.hurtF < 20 ? S.lagHp : Math.max(hp, S.lagHp - 0.008 * df);
      if (S.lagHp < hp) S.lagHp = hp;
      set(hpI, 'transform', `scaleX(${hp.toFixed(4)})`);
      set(hpE, 'transform', `scaleX(${S.lagHp.toFixed(4)})`);
      player.classList.toggle('low', hp < 0.3);
      player.classList.toggle('hurt', f - S.hurtF < 12);
      const m3 = h.musou / h.musouMax * 3;
      muSeg.forEach((el, k) => set(el, 'transform', `scaleX(${(Math.floor(clamp01(m3 - k) * 32) / 32).toFixed(4)})`));  // pixel-stepped fill
      const full = game.musou.ready() && !inMusou;                   // musou part r3: ready at one full segment (one Musou spends one)
      mu.classList.toggle('full', full);
      if (full) {                                                    // ready: glow pulse + glint sweeping the 3 segments
        mu.style.setProperty('--p', (0.5 + 0.5 * Math.sin(f * 0.12)).toFixed(2));
        const sw = (f % 90) / 50 * 3.6 - 0.3;
        muSeg.forEach((el, k) => el.style.setProperty('--s', `${((sw - k) * 100).toFixed(1)}%`));
      }
      mu.classList.toggle('active', inMusou);

      // chain counter (left). Combat resolves a whole swing's hits on one sim frame, so the shown number rolls up to
      // h.combo in DW8-style ticks instead of jumping: one tick every 2 f, the first on the hit frame, front-loaded steps
      // (+4 +3 +3 +2 +2 +2 for a 16-hit sweep). Each hit batch is queued as [frame, combo] and shown within 10 f (6 ticks),
      // so a long Musou stream never falls behind. Every tick spawns a ghost of the new last digit (pool of 3, so a roll
      // leaves a trail): 1.45× up-right with a smear, merging into the number in 6 f.
      if (h.combo < S.shownChain) { S.shownChain = 0; S.chainF = -99; S.chainQ.length = 0; }   // chain broke: roll from 0
      if (h.combo !== S.lastCombo) { if (h.combo > S.lastCombo) S.chainQ.push([f, h.combo]); S.lastCombo = h.combo; }
      if (h.combo > S.shownChain && f - S.chainF >= 2) {
        const prev = S.shownChain;
        let step = Math.floor((h.combo - prev) * 0.3);
        for (const [F, C] of S.chainQ) step = Math.max(step, Math.ceil((C - prev) / Math.max(1, ((F + 10 - f) >> 1) + 1)));
        S.shownChain = Math.min(h.combo, prev + Math.max(1, step));
        while (S.chainQ.length && S.chainQ[0][1] <= S.shownChain) S.chainQ.shift();
        S.chainF = f; num(chainB, S.shownChain);
        const g = chainG[S.ghostN++ % chainG.length];
        text(g.el, S.shownChain % 10); g.f = f;                                      // DW8 ghosts the last digit
      }
      const ct = f - S.chainF;
      set(chain, 'opacity', h.combo > 1 ? Math.min(1, h.comboT / 24).toFixed(2) : '0');
      set(chainB, 'transform', `scale(${(1 + 0.14 * clamp01(1 - ct / 4)).toFixed(3)})`);
      chainG.forEach((g, k) => {                // holds up-right, then slides in; a superseded ghost dims to a smear
        const a = (f - g.f) / 6, e = a < 1 ? 1 - a * a : 0, newest = k === (S.ghostN - 1) % chainG.length;
        set(g.el, 'opacity', (0.95 * e * (newest ? 1 : 0.35)).toFixed(2));
        set(g.el, 'transform', `translate(${(e * 0.52).toFixed(3)}em, ${(-e * 0.3).toFixed(3)}em) scale(${(1 + 0.45 * e).toFixed(3)})`);
      });

      // KO count (bottom right) counts up in DW8-style batches: every slam (>= 4 f apart) adds the KOs since the last
      // one (a big Musou batch as +10/+15 slams, caught up within ~8 f), lands at ~3× and settles in 7 f, then a ghost
      // rings out. The milestone fires on the true count, on the KO frame, and only the highest one crossed (a mass KO
      // from 18 to 54 shows "50", not "25" then "50"): every 50 like DW8, plus an early first one at 25 outside Musou.
      if (h.kos < S.shownKo) S.shownKo = h.kos;
      if (h.kos > S.shownKo && f - S.koF >= 4) {
        const gap = h.kos - S.shownKo;
        S.shownKo += gap <= 10 ? gap : Math.max(10, Math.ceil(gap / 10) * 5);
        S.koF = f; num(koB, S.shownKo); text(koG, S.shownKo);
      }
      const m = mileOf(h.kos);
      if (m < S.mile) S.mile = m;
      if (m > S.mile && inMusou && m === 25) S.mile = m;                // a Musou always runs past 50: only "50" pops
      if (m > S.mile) {
        S.mile = m; S.mileF = f; num(mileB, m);
        S.shownKo = h.kos; S.koF = f; num(koB, h.kos); text(koG, h.kos);  // the corner count slams to the true total with it
        // keep the popup off Zhao Yun: its digits span x 42-61 %, y (top + 4) … (top + 19) %. If his screen box would sit
        // under them, lift it clear of his head; if there is no room above (close Musou shots), fade it to 40 %.
        S.mileTop = 33; S.mileDim = 1;
        if (camera) {
          v3.set(h.x, h.y + 2.05, h.z).project(camera); const hx = (v3.x + 1) / 2, hy = (1 - v3.y) / 2, front = v3.z < 1;
          v3.set(h.x, h.y, h.z).project(camera); const fy = (1 - v3.y) / 2, hw = Math.max(0.03, (fy - hy) * 0.35 * H / W);
          if (front && hx - hw < 0.62 && hx + hw > 0.41 && hy < 0.53 && fy > 0.36) {
            S.mileTop = Math.max(8, Math.round((hy - 0.21) * 100));
            if (hy - 0.21 < 0.08) S.mileDim = 0.4;
          }
        }
        set(mile, 'top', `${S.mileTop}%`);
      }
      const kt = f - S.koF, slam = clamp01(1 - kt / 7);
      set(koB, 'transform', `scale(${(1 + 1.9 * slam * slam).toFixed(3)})`);
      set(koB, 'opacity', (kt < 3 ? 0.45 + kt * 0.2 : 1).toFixed(2));
      const ring = kt >= 5 && kt < 20 ? (kt - 5) / 15 : 1;
      set(koG, 'opacity', ((1 - ring) * 0.55).toFixed(2));
      set(koG, 'transform', `scale(${(1 + ring * 0.9).toFixed(3)})`);
      set(ko, 'opacity', S.shownKo === 0 ? '0' : Math.min(calm, f - S.koF > 300 ? 0.7 : 1).toFixed(2));   // hidden until the first KO

      // KO milestone (centre), DW8 timing (~0.3 s): slams in solid at 1.7× → 1 over 3 f with a white-hot flash, holds to
      // f 11, then slides left and fades out by f 18. The red 擊破 seal stamps down at f 2.
      const mt = f - S.mileF;
      if (mt < 19) {
        const k = clamp01(1 - mt / 3), fl = clamp01(1 - mt / 5);
        set(mile, 'opacity', ((mt < 11 ? 1 : 1 - (mt - 11) / 7) * S.mileDim).toFixed(2));
        set(mile, 'transform', `translate(${(mt < 11 ? 0 : -(mt - 11) * 0.36).toFixed(2)}rem, 0) scale(${(1 + 0.7 * k * k).toFixed(3)})`);
        set(mile, 'filter', fl > 0 ? `brightness(${(1 + 0.9 * fl).toFixed(2)})` : 'none');
        const st = mt - 2;
        set(mileS, 'opacity', st < 0 ? '0' : '1');
        set(mileS, 'transform', `rotate(-6deg) scale(${(1 + 0.5 * clamp01(1 - st / 2)).toFixed(3)})`);
      } else set(mile, 'opacity', '0');

      // system banner (full-width band, y 64-70 %) and dialogue (portrait + 2 lines, top left: keeps the centre clear)
      if ((!S.band || f - S.band.f >= S.band.dur) && S.bandQ.length && !inMusou) S.band = { ...S.bandQ.shift(), f };
      const b = S.band, bt = b ? f - b.f : 1e9;
      if (b && bt < b.dur) {
        if (bandP.innerHTML !== b.html) { bandP.innerHTML = b.html; text(bandS, b.en); }
        set(band, 'opacity', Math.min(1, bt / 6, (b.dur - bt) / 18).toFixed(2));
        set(band, 'transform', `scaleY(${Math.min(1, 0.3 + bt / 6).toFixed(3)})`);
      } else set(band, 'opacity', '0');
      if (S.dlgQ.length && !inMusou && (!S.dlg || f - S.dlg.f >= S.dlg.dur || f < S.dlg.f)) S.dlg = { ...S.dlgQ.shift(), f };
      const d = S.dlg, dt = d ? f - d.f : -1, dlgA = d && dt >= 0 && dt < d.dur ? Math.min(1, dt / 8, (d.dur - dt) / 16) : 0;
      if (dlgA > 0) {
        showSpeaker(d.who || 'hero');
        text(dlgP, d.zh); text(dlgS, d.en);
        set(dlg, 'opacity', dlgA.toFixed(2));
        set(dlg, 'transform', `translateX(${(-Math.max(0, 1 - dt / 8) * 2).toFixed(2)}rem)`);
      } else set(dlg, 'opacity', '0');

      // musou: vertical calligraphy copy on the right (concept) while the musou runs
      const mf = f - S.musouF, me = f - S.musouEnd;
      const copyA = inMusou || me < 30 ? Math.min(clamp01((mf - 8) / 14), me >= 0 && me < 30 ? 1 - me / 30 : 1) : 0;
      set(copy, 'opacity', copyA.toFixed(2));

      text(lvEl, h.gear ? `Lv ${h.gear.lv}` : '');
      // buffs (虎符 / 玄甲): a chip each above the HP bar with its time draining; blinks in the last 3 s
      for (const b of buffs) {
        const left = h[b.k];
        set(b.el, 'opacity', left > 0 ? (left < 180 && (f >> 3) & 1 ? '0.35' : '1') : '0');
        if (left > 0) set(b.bar, 'transform', `scaleX(${(left / BUFF).toFixed(3)})`);
      }
      const tt = f - S.toastF;
      set(toast, 'opacity', tt < 100 ? Math.min(1, tt / 5, (100 - tt) / 20).toFixed(2) : '0');
      if (tt < 100) set(toast, 'transform', `translateY(${(-Math.min(tt, 30) * 0.06).toFixed(2)}rem)`);

      // goal box (under the minimap): the objective, its count (n / of) or the fill of the spot being taken; the last
      // goal stays ticked off until the next one starts; 勝利 once the battle is won
      if (cp && (cp.active || cp.cleared)) {
        const g = cp.goal || (cp.i >= 0 ? STAGE.script[cp.i] : null), done = !cp.goal;
        const key = cp.cleared ? 'clear' : `${cp.i}:${done}`;
        if (S.goalI !== key) {
          S.goalI = key;
          const [zh, en] = cp.cleared ? ['勝利', 'VICTORY'] : g ? goalText(g) : ['', ''];
          text(goalB, zh); text(goalS, en);
          goalEl.classList.toggle('done', done || cp.cleared);
          goalEl.classList.remove('pop'); void goalEl.offsetWidth; goalEl.classList.add('pop');   // restart the pop-in
        }
        const multi = g && !done && cp.of > 1;
        text(goalPg, multi ? `${cp.n}/${cp.of}` : '');
        const cap = g && !done && g.kind === 'reach' && g.hold ? Math.max(0, ...cp.caps.filter((v) => v < 1)) : 0;
        set(goalCap, 'opacity', cap > 0 ? '1' : '0');
        set(goalCapI, 'transform', `scaleX(${cap.toFixed(3)})`);
        set(goalEl, 'opacity', (g || cp.cleared ? Math.min(1, calm + 0.35) : 0).toFixed(2));
      } else set(goalEl, 'opacity', '0');

      // waypoints: each spot to take / goal officer / the boss gets a marker over it on screen (spots only: officers
      // have their tags) or an arrow at the screen edge pointing to it, with its name and distance
      const wt = [];
      if (cp?.goal && camera && !inMusou) {
        const g = cp.goal;
        if (g.kind === 'reach') g.points.forEach(([x, z], j) => { if (cp.caps[j] < 1) wt.push({ x, y: 3.4, z, label: g.label, spot: true }); });
        else if (g.kind === 'destroy') cp.tgt.forEach((t) => { if (t.hp > 0) wt.push({ x: t.x, y: 4.6, z: t.z, label: `${g.label} ${Math.ceil(t.hp / t.hpMax * 100)}%`, spot: true }); });
        else if (g.kind === 'base') for (const id of g.ids) {
          const b = game.bases.byId(id);
          if (b?.side === 'foe') wt.push({ x: b.x, y: 9.5, z: b.z, label: b.captain >= 0 ? `${b.name} · 兵長` : `${b.name} · 守備 ${b.gauge}`, spot: Math.hypot(b.x - h.x, b.z - h.z) > 12 });
        }
        else if (g.kind === 'officer') cp.ofs.forEach((i) => { if (!c.kod[i] && c.st[i] !== ST.OFF) wt.push({ x: c.x[i], y: 2.6, z: c.z[i], label: c.names[i - c.grunts][0] }); });
        else if (g.kind === 'boss' && game.boss?.alive()) wt.push({ x: game.boss.x, y: 3.2, z: game.boss.z, label: game.boss.def.zh });
      }
      ways.forEach((w, k) => {
        const t = wt[k];
        if (!t) { set(w.el, 'opacity', '0'); return; }
        v3.set(t.x, t.y, t.z).applyMatrix4(camera.matrixWorldInverse);
        const behind = v3.z > -0.5;
        v3.applyMatrix4(camera.projectionMatrix);
        const nx = behind ? -v3.x : v3.x;
        let ny = behind ? -v3.y : v3.y;
        const on = !behind && Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82;
        const dist = Math.hypot(t.x - h.x, t.z - h.z);
        if (on && !t.spot && dist < game.hudTagR) { set(w.el, 'opacity', '0'); return; }   // the officer's own tag shows him
        let px2 = (nx + 1) / 2 * W, py2 = (1 - ny) / 2 * H, rot = 0;
        if (!on) {                                           // off screen: on an ellipse round the hero, pointing the way
          if (behind && Math.abs(ny) < 0.25) ny = -0.6;         // straight behind: below him, not along the horizon
          rot = Math.atan2(nx * W, ny * H);
          px2 = W * (0.5 + 0.38 * Math.sin(rot)); py2 = H * (0.5 - 0.27 * Math.cos(rot));   // clear of the corners, goal box and HP band
        }
        w.el.classList.toggle('edge', !on);
        set(w.el, 'transform', `translate(${px2.toFixed(1)}px, ${py2.toFixed(1)}px)`);
        set(w.i, 'transform', on ? 'none' : `rotate(${rot.toFixed(3)}rad)`);
        text(w.b, t.label); text(w.sp, `${Math.round(dist)}m`);
        set(w.el, 'opacity', (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(f * 0.1))).toFixed(2));
      });

      // camp captains (據點兵長) within 30 m: a small tag with his health over the crest
      let ck = 0;
      if (camera && !inMusou) for (const b of game.bases.list) {
        if (ck >= capTags.length || b.side !== 'foe' || b.captain < 0) continue;
        const i = b.captain;
        if (c.st[i] === ST.OFF || c.st[i] === ST.DEAD || Math.hypot(c.x[i] - h.x, c.z[i] - h.z) > 30) continue;
        v3.set(c.x[i], c.y[i] + 2.3, c.z[i]).project(camera);
        if (v3.z >= 1 || Math.abs(v3.x) > 0.95 || Math.abs(v3.y) > 0.9) continue;
        const tg = capTags[ck++];
        set(tg.el, 'opacity', '1');
        set(tg.el, 'transform', `translate(${((v3.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v3.y) / 2 * H).toFixed(1)}px)`);
        set(tg.bar, 'transform', `scaleX(${clamp01(c.hp[i] / c.hpMax[i]).toFixed(3)})`);
      }
      for (; ck < capTags.length; ck++) set(capTags[ck].el, 'opacity', '0');

      // officer target bar (top left): last officer hit (10 s) or the nearest officer within 9 m
      let tg = S.tgt >= 0 && c.st[S.tgt] !== ST.OFF && (f - S.tgtF < 600 || f - S.tgtKoF < 70) ? S.tgt : -1;
      if (tg < 0) {
        let bd = 81;
        for (let i = c.grunts; i < c.N; i++) {
          if (c.st[i] === ST.OFF || c.st[i] === ST.DEAD) continue;
          const d2 = (c.x[i] - h.x) ** 2 + (c.z[i] - h.z) ** 2;
          if (d2 < bd) { bd = d2; tg = i; }
        }
      }
      const tKo = tg >= 0 && f - S.tgtKoF < 70 && tg === S.tgt;
      set(target, 'opacity', tg >= 0 && introA < 0.5 ? (tKo ? clamp01((70 - (f - S.tgtKoF)) / 20) : 1).toFixed(2) : '0');
      if (tg >= 0) {
        const [zh, en] = c.names[(tg - c.grunts) % OFFICERS.length];
        text(targetB, zh); text(targetS, en);
        const th = clamp01(c.hp[tg] / c.hpMax[tg]);
        set(targetI, 'transform', `scaleX(${th.toFixed(4)})`);
        set(targetE, 'transform', `scaleX(${Math.max(th, 1 - clamp01((f - S.tgtF) / 40) * (1 - th)).toFixed(4)})`);
        target.classList.toggle('ko', tKo);
      }

      // floating officer tags (DW8): ▼▼ right on the officer's head top, name + red HP bar stacked above it. Every
      // on-screen officer within 45 m gets one, scaled by camera distance (k 0.7-1, so CJK stays ≥ 17 px and Latin ≥ 9 px
      // at 720p) and faded out over the last 5 m. Only the tag body is ever moved — clear of the screen top, the target
      // bar, the intro card, the dialogue and the minimap (it slides left of the map instead of vanishing) — and when it
      // has to leave the ▼▼, a thin leader ties it back to the officer. Overlapping bodies stack: the lowest (nearest)
      // keeps its spot, the next lifts above it, or slides beside it when there is no room above.
      const rem = H / 72, tags = [];
      let clash = false;
      const mapL = W * 0.976 - 22.5 * rem, mapB = 26 * rem;
      const zones = [];                                                   // [right edge, bottom] of top-left HUD blocks
      if (tg >= 0 && introA < 0.5) zones.push([2.6 * rem + W * 0.36 + 2 * rem, 8.5 * rem]);
      if (dlgA > 0) zones.push([dlg.offsetLeft + dlg.offsetWidth - 4 * rem, dlg.offsetTop + dlg.offsetHeight + rem]);   // minus the fade tail
      const place = (o) => {                                              // keep a body inside the free screen area
        o.bx = Math.max(o.tw / 2 + rem, Math.min(W - o.tw / 2 - rem, o.bx));
        if (o.bx + o.tw / 2 > mapL && o.by - o.th < mapB) o.bx = mapL - o.tw / 2 - 0.5 * rem;
        let top = 1.5 * rem;
        for (const [r, bt] of zones) {                                  // below the block, unless that would drop the
          if (o.bx - o.tw / 2 >= r) continue;                             // body onto the officer: then beside it
          if (bt + o.th > o.ay - o.mkH + rem) o.bx = r + o.tw / 2 + 0.5 * rem; else top = Math.max(top, bt);
        }
        o.by = Math.min(H * 0.8, Math.max(o.by, top + o.th));
        return top;
      };
      offs.forEach((o, j) => {
        const i = c.grunts + j;
        o.show = false;
        text(o.nb, c.names[j][0]); text(o.ns, c.names[j][1]);
        if (!camera || i >= c.N || c.st[i] === ST.OFF || c.st[i] === ST.DEAD) return;
        const dist = Math.hypot(c.x[i] - h.x, c.z[i] - h.z);
        if (dist >= game.hudTagR) return;                               // faded out (alpha < 0.05)
        // ▼▼ on the helmet crest (2.3 m standing); a reacting officer bends or falls, so the anchor eases down with him
        const st = c.st[i], hy = st === ST.HURT || st === ST.KNOCK ? 1.7 : st === ST.AIR ? 1.3 : st === ST.DOWN || st === ST.GETUP ? 1.1 : 2.3;
        o.hy = o.hy == null || df > 30 ? hy : o.hy + (hy - o.hy) * (1 - 0.7 ** df);
        v3.set(c.x[i], c.y[i] + o.hy, c.z[i]);
        const k = Math.max(0.7, Math.min(1, 14 / v3.distanceTo(camera.position)));
        v3.project(camera);
        const sx = (v3.x + 1) / 2, sy = (1 - v3.y) / 2;
        if (v3.z >= 1 || sx < 0.02 || sx > 0.98 || sy < -0.3 || sy > 0.9) return;
        Object.assign(o, { show: true, k, ax: sx * W, ay: sy * H, mkH: 1.6 * rem * k, tw: 22 * rem * k, th: 5.5 * rem * k, a: clamp01((45 - dist) / 5) * (mt < 19 ? 0.25 : 1) });   // step back under the KO milestone
        o.bx = o.ax; o.by = o.ay - o.mkH;
        if (o.ax - o.tw / 2 < 50 * rem && o.by - o.th < 21 * rem) clash = true;   // natural spot on the intro card
        place(o); tags.push(o);
        const hpF = clamp01(c.hp[i] / c.hpMax[i]);
        o.lag = hpF > o.lag ? hpF : Math.max(hpF, o.lag - 0.006 * df);  // white damage chunk drains after the hit
        set(o.bar, 'transform', `scaleX(${hpF.toFixed(4)})`);
        set(o.lagEl, 'transform', `scaleX(${o.lag.toFixed(4)})`);
      });
      if (f - S.tgtF < 600 || f - S.tgtKoF < 70) clash = true;           // an officer fight: the target bar needs the corner
      S.introCut = clamp01(S.introCut + (clash ? 0.15 : -0.05) * df);
      tags.sort((a, b) => b.ay - a.ay);
      for (let k = 1; k < tags.length; k++) {
        for (let q = 0, n = 0; q < k && n < 12; q++) {
          const o = tags[k], p = tags[q];
          if (Math.abs(o.bx - p.bx) < (o.tw + p.tw) / 2 && o.by - o.th < p.by && p.by - p.th < o.by) {
            const lifted = p.by - p.th - 0.3 * rem;
            if (lifted - o.th >= place({ ...o, by: lifted })) o.by = lifted;
            else o.bx = p.bx + (o.bx < p.bx ? -1 : 1) * ((o.tw + p.tw) / 2 + 0.5 * rem);
            place(o);
            q = -1; n++;                                                  // moved: re-check against every placed tag
          }
        }
      }
      for (const o of offs) {
        set(o.el, 'opacity', o.show ? o.a.toFixed(2) : '0');
        if (!o.show) continue;
        set(o.el, 'transform', `translate(${o.ax.toFixed(1)}px, ${o.ay.toFixed(1)}px)`);
        set(o.bd, 'transform', `translate(${(o.bx - o.ax).toFixed(1)}px, ${(o.by - o.ay).toFixed(1)}px) scale(${o.k.toFixed(3)})`);
        const hidden = (o.ax > W * 0.976 - 20.5 * rem && o.ay < mapB) || o.ay < 0;   // ▼▼ under the minimap / above the screen
        set(o.mk, 'opacity', hidden ? '0' : '1');
        set(o.mk, 'transform', `translateX(-50%) scale(${o.k.toFixed(3)})`);
        const vx = o.bx - o.ax, vy = o.by - (o.ay - o.mkH), L = Math.hypot(vx, vy);
        set(o.ld, 'opacity', L > rem && !hidden ? '1' : '0');
        if (L > rem) set(o.ld, 'transform', `translate(0, ${(-o.mkH).toFixed(1)}px) rotate(${Math.atan2(vx, -vy).toFixed(3)}rad) scaleY(${L.toFixed(1)})`);
      }

      // morale (蜀 blue vs 魏 red) from KOs against the enemies still standing
      let alive = 0;
      for (let i = 0; i < c.N; i++) if (c.st[i] !== ST.OFF && c.st[i] !== ST.DEAD) alive++;
      set(moraleI, 'transform', `scaleX(${(0.3 + 0.65 * h.kos / (h.kos + alive + 1)).toFixed(4)})`);

      // minimap: 30 m around the hero, wall/gate up (camera yaw 0 looks at the wall, so map right = -X), 10 m grid,
      // units, view cone, reinforcement pings; officers off the map are pinned to its edge
      const R = bigMap ? ARENA_RADIUS + 14 : Math.round(30 * Math.sqrt(ARENA_RADIUS / 46)), s = 100 / R;   // a bigger field, a wider map
      const cx = bigMap ? 0 : h.x, cz = bigMap ? 0 : h.z, X = (x) => 100 - (x - cx) * s, Y = (z) => 100 - (z - cz) * s;
      const hx = X(h.x), hy = Y(h.z);
      map.setTransform(2, 0, 0, 2, 0, 0);                            // drawn in a 200 × 200 frame at twice the pixels
      map.clearRect(0, 0, 200, 200);
      map.fillStyle = 'rgba(18,12,9,0.66)'; map.fillRect(0, 0, 200, 200);
      map.fillStyle = 'rgba(214,184,130,0.08)';
      map.beginPath(); map.arc(X(0), Y(0), ARENA_RADIUS * s, 0, 7); map.fill();
      map.strokeStyle = 'rgba(214,184,130,0.12)'; map.lineWidth = 1; map.beginPath();
      for (let g = Math.ceil((h.x - R) / 10) * 10; g <= h.x + R; g += 10) { map.moveTo(X(g) + 0.5, 0); map.lineTo(X(g) + 0.5, 200); }
      for (let g = Math.ceil((h.z - R) / 10) * 10; g <= h.z + R; g += 10) { map.moveTo(0, Y(g) + 0.5); map.lineTo(200, Y(g) + 0.5); }
      map.stroke();
      map.strokeStyle = 'rgba(214,184,130,0.45)'; map.lineWidth = 1.5;
      map.beginPath(); map.arc(X(0), Y(0), ARENA_RADIUS * s, 0, 7); map.stroke();
      const wy = Y(WALL_Z);
      if (wy > 0) {
        map.fillStyle = 'rgba(236,214,172,0.8)'; map.fillRect(0, wy - 7 * s, 200, 7 * s);          // castle wall (7 m deep)
        map.fillStyle = 'rgba(18,12,9,0.8)'; map.fillRect(X(GATE_X + 4.5), wy - 7 * s, 9 * s, 7 * s);      // gate passage
        map.fillStyle = '#d0a040'; map.fillRect(X(GATE_X + 4.5), wy - 2, 9 * s, 2);
      } else {                                                        // castle gate beyond the map: pin it to the top edge
        const gx = Math.max(16, Math.min(184, X(GATE_X)));
        map.fillStyle = '#d0a040';
        map.beginPath(); map.moveTo(gx, 3); map.lineTo(gx - 5, 10); map.lineTo(gx + 5, 10); map.fill();
        map.font = '700 15px "Xingkai SC", "Kaiti SC", "HudBrush", serif'; map.textAlign = 'center'; map.fillStyle = 'rgba(236,214,172,0.9)';
        map.fillText(tr('城門'), gx, 26);
      }
      S.waves = S.waves.filter((w) => f - w.f < 120);
      for (const w of S.waves) {
        const t = (f - w.f) / 120;
        map.strokeStyle = `rgba(255,80,55,${(1 - t).toFixed(2)})`; map.lineWidth = 2;
        map.beginPath(); map.arc(X(w.x), Y(w.z), 5 + t * 22, 0, 7); map.stroke();
      }
      const cy = game.cam.yaw;
      const cone = map.createRadialGradient(hx, hy, 0, hx, hy, 70);
      cone.addColorStop(0, 'rgba(200,240,255,0.3)'); cone.addColorStop(1, 'rgba(200,240,255,0)');
      map.fillStyle = cone;
      map.beginPath(); map.moveTo(hx, hy); map.arc(hx, hy, 70, -Math.PI / 2 - cy - 0.5, -Math.PI / 2 - cy + 0.5); map.fill();
      map.fillStyle = '#e0412c';
      for (let i = 0; i < c.grunts; i++) {
        const st = c.st[i];
        if (st === ST.OFF || st === ST.DEAD) continue;
        const x = X(c.x[i]), y = Y(c.z[i]);
        if (x > -2 && x < 202 && y > -2 && y < 202) {
          if (c.kind[i] === KIND.RIDER) { map.fillStyle = '#ff9a3a'; map.fillRect(x - 2.5, y - 2.5, 5, 5); map.fillStyle = '#e0412c'; }   // horsemen
          else map.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
      for (let i = c.grunts; i < c.N; i++) {
        if (c.st[i] === ST.OFF || c.st[i] === ST.DEAD) continue;
        const x = Math.max(5, Math.min(195, X(c.x[i]))), y = Math.max(5, Math.min(195, Y(c.z[i])));
        map.fillStyle = '#1a0d08'; map.fillRect(x - 5, y - 5, 10, 10);
        map.fillStyle = i === tg ? '#ffe08a' : '#ff5a3a'; map.fillRect(x - 3.5, y - 3.5, 7, 7);
      }
      if (cp?.goal) {
        const pulse = 0.5 + 0.5 * Math.sin(f * 0.12), pin = (v) => Math.max(7, Math.min(193, v));
        if (cp.goal.kind === 'reach' || cp.goal.kind === 'destroy') cp.goal.points.forEach(([x, z], j) => {
          if (cp.goal.kind === 'reach' ? cp.caps[j] >= 1 : cp.tgt[j].hp <= 0) return;
          const px2 = pin(X(x)), py2 = pin(Y(z));
          map.strokeStyle = `rgba(255,214,90,${(0.3 + 0.5 * pulse).toFixed(2)})`; map.lineWidth = 2;
          map.beginPath(); map.arc(px2, py2, 8 + pulse * 6, 0, 7); map.stroke();
          map.fillStyle = '#1a0d08'; map.beginPath(); map.moveTo(px2, py2 - 8); map.lineTo(px2 + 7, py2); map.lineTo(px2, py2 + 8); map.lineTo(px2 - 7, py2); map.fill();
          map.fillStyle = '#ffd65a'; map.beginPath(); map.moveTo(px2, py2 - 5.5); map.lineTo(px2 + 4.5, py2); map.lineTo(px2, py2 + 5.5); map.lineTo(px2 - 4.5, py2); map.fill();
        });
        else if (cp.goal.kind === 'officer') for (const i of cp.ofs) {
          if (c.kod[i] || c.st[i] === ST.OFF) continue;
          map.strokeStyle = `rgba(255,214,90,${(0.4 + 0.5 * pulse).toFixed(2)})`; map.lineWidth = 2;
          map.beginPath(); map.arc(pin(X(c.x[i])), pin(Y(c.z[i])), 9 + pulse * 4, 0, 7); map.stroke();
        }
      }
      // camps: a square in the holder's colour (goal camps ringed above)
      for (const b of game.bases.list) {
        const bx = X(b.x), by = Y(b.z);
        if (bx < -8 || bx > 208 || by < -8 || by > 208) continue;
        const foe = b.side === 'foe', goal = cp?.goal?.kind === 'base' && cp.goal.ids.includes(b.id) && foe;
        map.fillStyle = '#140c08'; map.fillRect(bx - 7, by - 7, 14, 14);
        map.fillStyle = foe ? '#c8402a' : '#4a7ed8'; map.fillRect(bx - 5, by - 5, 10, 10);
        map.fillStyle = '#140c08'; map.fillRect(bx - 1.5, by - 5, 3, 3);                 // the gate notch
        if (goal) { map.strokeStyle = `rgba(255,214,90,${(0.45 + 0.4 * Math.sin(f * 0.12)).toFixed(2)})`; map.lineWidth = 2; map.strokeRect(bx - 10, by - 10, 20, 20); }
      }
      if (cp?.ally) {
        const ax = Math.max(5, Math.min(195, X(cp.ally.x))), ay2 = Math.max(5, Math.min(195, Y(cp.ally.z)));
        map.fillStyle = '#081a2e'; map.fillRect(ax - 5, ay2 - 5, 10, 10); map.fillStyle = '#7ab8ff'; map.fillRect(ax - 3.5, ay2 - 3.5, 7, 7);
      }
      const ay = h.yaw;                                              // hero arrow
      const px = (a, r) => hx - Math.sin(a) * r, py = (a, r) => hy - Math.cos(a) * r;
      map.fillStyle = 'rgba(8,30,38,0.85)';
      map.beginPath(); map.arc(hx, hy, 8, 0, 7); map.fill();
      map.fillStyle = '#9ff4ff';
      map.beginPath(); map.moveTo(px(ay, 9), py(ay, 9)); map.lineTo(px(ay + 2.5, 7), py(ay + 2.5, 7)); map.lineTo(px(ay - 2.5, 7), py(ay - 2.5, 7)); map.fill();
    },
  };
}
