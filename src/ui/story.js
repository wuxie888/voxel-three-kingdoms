// Story mode UI: the chapter list (蜀漢演義 — locked until the chapter before is won, the best rank on each) and the
// cutscene player — a chapter title card, then the lines one by one (typed out; a tap finishes the line, the next tap
// moves on; 跳過 skips the scene) over a slow flyover of the battlefield (the main loop renders it through
// window.__view while the sim waits). Speakers: the narrator, a hero (his pixel portrait) or anyone else (a seal).
import { HEROES } from '../heroes/index.js';
import { STAGES } from '../stages/index.js';
import { STORY } from '../stages/story.js';
import { storyRank } from '../progress/profile.js';
import { paintPortrait } from './hud.js';

const unlocked = (k) => k === 0 || !!storyRank(STORY.chapters[k - 1].id);

export function createStoryMenu({ onPlay }) {
  const el = document.createElement('div');
  el.id = 'story'; el.hidden = true;
  el.innerHTML = `<div class="st-box"><div class="st-head"><b>${STORY.title}</b><small>${STORY.en} · 劇情模式</small><button class="st-x" aria-label="close">✕</button></div><div class="st-list"></div></div>`;
  document.body.appendChild(el);
  const list = el.querySelector('.st-list');
  function paint() {
    list.innerHTML = STORY.chapters.map((c, k) => {
      const st = STAGES.find((s) => s.id === c.stage), rk = storyRank(c.id), open = unlocked(k);
      return `<button class="chap${open ? '' : ' locked'}" data-k="${k}"><small>${c.n} · ${c.year}</small><b>${c.title}</b><span>${c.en}</span>
        <div class="who"><canvas width="20" height="20"></canvas><em>${st.zh}<br>${HEROES.find((h) => h.id === c.hero).zh}</em></div>
        <p>${open ? c.blurb : '通關上一章後解鎖'}</p>${rk ? `<i class="rk" data-r="${rk}">${rk}</i>` : ''}${open ? '' : '<i class="lock">鎖</i>'}</button>`;
    }).join('');
    list.querySelectorAll('.chap').forEach((b, k) => paintPortrait(b.querySelector('canvas'), HEROES.find((h) => h.id === STORY.chapters[k].hero)));
  }
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('.st-x') || e.target === el) { el.hidden = true; return; }
    const b = e.target.closest('.chap');
    if (b && !b.classList.contains('locked')) onPlay(STORY.chapters[+b.dataset.k]);
  });
  addEventListener('keydown', (e) => { if (!el.hidden && e.code === 'Escape') { el.hidden = true; e.stopImmediatePropagation(); } }, true);
  return { open() { paint(); el.hidden = false; } };
}

/** Play `lines` with the chapter's title card; calls onDone() at the end or on skip. tick(dt) drives the flyover. */
export function createCutscene() {
  const el = document.createElement('div');
  el.id = 'cine'; el.hidden = true;
  el.innerHTML = `<div class="ci-title"><small></small><b></b><span></span></div><div class="ci-narr"><p></p><small></small></div>
    <div class="ci-line"><canvas width="20" height="20"></canvas><i class="seal"></i><div><b></b><p></p><small></small></div></div>
    <button class="ci-skip">跳過 SKIP ▶▶</button><div class="ci-next">▼</div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const title = $('.ci-title'), narr = $('.ci-narr'), line = $('.ci-line'), cv = $('.ci-line canvas'), seal = $('.ci-line .seal');
  let lines = [], k = -1, shown = 0, full = '', done = null, view = null, t = 0, typing = 0;

  function show(i) {
    k = i;
    if (k >= lines.length) { finish(); return; }
    const [who, zh, en] = lines[k], hero = HEROES.find((h) => h.id === who);
    full = zh; shown = 0; typing = 1;
    const isNarr = who === 'narr';
    narr.hidden = !isNarr; line.hidden = isNarr;
    if (isNarr) { narr.querySelector('p').textContent = ''; narr.querySelector('small').textContent = en; }
    else {
      line.classList.toggle('noface', !hero);
      if (hero) { cv.getContext('2d').clearRect(0, 0, 20, 20); paintPortrait(cv, hero); } else seal.textContent = who[0];
      line.querySelector('b').innerHTML = hero ? `${hero.zh} <span>${hero.en}</span>` : who;
      line.querySelector('p').textContent = ''; line.querySelector('small').textContent = en;
    }
    el.classList.remove('typed');
  }
  function finish() {
    el.hidden = true; window.__view = null;
    const d = done; done = null; d?.();
  }
  function advance() {
    if (el.hidden) return;
    if (typing) { shown = full.length; typing = 0; return; }   // first tap finishes the line
    show(k + 1);
  }
  el.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('.ci-skip')) finish(); else advance(); });
  addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (['Enter', 'Space', 'KeyJ', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); advance(); }
    else if (e.code === 'Escape') { e.stopImmediatePropagation(); finish(); }
  }, true);

  return {
    get on() { return !el.hidden; },
    play(ch, which, onDone) {
      lines = ch[which] || []; done = onDone; view = ch.view; t = 0;
      $('.ci-title small').textContent = `${ch.n} · ${ch.year}`; $('.ci-title b').textContent = ch.title; $('.ci-title span').textContent = ch.en;
      title.classList.toggle('post', which === 'post');
      el.hidden = false; show(0);
    },
    /** Each rendered frame while the scene plays: type the line, fly the camera. */
    tick(dt) {
      if (el.hidden) return;
      t += dt;
      if (typing) {
        shown = Math.min(full.length, shown + dt * 26);
        const txt = full.slice(0, Math.floor(shown));
        (narr.hidden ? line.querySelector('p') : narr.querySelector('p')).textContent = txt;
        if (shown >= full.length) { typing = 0; el.classList.add('typed'); }
      }
      if (view) {                                  // a slow orbit of the field about the scene's target
        const [x, y, z, tx, ty, tz] = view, a = t * 0.05, dx = x - tx, dz = z - tz;
        window.__view = [tx + dx * Math.cos(a) - dz * Math.sin(a), y + Math.sin(t * 0.3) * 0.6, tz + dx * Math.sin(a) + dz * Math.cos(a), tx, ty, tz, 50];
      }
    },
  };
}
