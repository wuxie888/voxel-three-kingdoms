// Armory (武庫): the chosen officer's level, stats and loadout — one weapon, two accessories — over everything he can
// wear from the armoury (his own weapons, any accessory), best first. Pick a slot, then a piece to wear it; 卸下 takes it
// off. Changes apply at once (onChange: main.js re-reads the gear) and are kept in the profile (progress/profile.js).
import { HERO } from '../heroes/index.js';
import { paintPortrait } from './hud.js';
import { profile, heroP, equip, itemOf, gearOf, LV } from '../progress/profile.js';
import { RARITY, ATTRS, STATS } from '../progress/loot.js';
import { HP0 } from '../hero/hero.js';

const stars = (r) => '★'.repeat(r);
/** One line per bonus of an item (weapon: attack + attributes; accessory: its stats). */
export function itemLines(it) {
  if (it.kind === 'weapon') return [`攻擊 +${Math.round(it.atk * 100)}%`, ...it.attrs.map(([a, v]) => `<i style="color:${ATTRS[a].col}">${ATTRS[a].zh}</i> ${ATTRS[a].fmt(v)}`)];
  return it.stats.map(([k, v]) => STATS[k].fmt(v));
}
export function itemCard(it, extra = '') {
  const R = RARITY[it.r];
  return `<div class="card" style="--rc:${R.col}"><b>${it.name}</b><span>${stars(it.r)} ${R.zh}</span>${itemLines(it).map((l) => `<em>${l}</em>`).join('')}${extra}</div>`;
}

export function createArmory({ onChange }) {
  const el = document.createElement('div');
  el.id = 'armory'; el.hidden = true;
  el.innerHTML = `<div class="ar-box">
    <div class="ar-head"><canvas width="20" height="20"></canvas><div class="ar-who"><b>${HERO.zh}</b><span class="lv"></span>
      <div class="xp"><i></i></div><small class="xpn"></small></div><div class="ar-stats"></div><button class="ar-x" aria-label="close">✕</button></div>
    <div class="ar-slots"></div>
    <div class="ar-tip"></div>
    <div class="ar-list"></div></div>`;
  document.body.appendChild(el);
  paintPortrait(el.querySelector('canvas'), HERO);
  const $ = (s) => el.querySelector(s);
  let slot = 'weapon';

  function paint() {
    const h = heroP(HERO.id), G = gearOf(HERO.id);
    $('.lv').textContent = `Lv ${h.lv}`;
    const need = LV.next(h.lv);
    $('.xp i').style.transform = `scaleX(${h.lv >= LV.max ? 1 : (h.xp / need).toFixed(3)})`;
    $('.xpn').textContent = h.lv >= LV.max ? 'MAX' : `經驗 ${h.xp} / ${need}`;
    const pct = (v) => `${Math.round(v * 100)}%`;
    $('.ar-stats').innerHTML = [`體力 <b>${HP0 + G.hp}</b>`, `攻擊 <b>+${pct(G.atk)}</b>`, `受傷 <b>−${pct(G.def)}</b>`,
      `無雙 <b>+${pct(G.mus + G.musou)}</b>`, `補給 <b>+${pct(G.heal)}</b>`, `移動 <b>+${pct(G.spd)}</b>`].map((x) => `<span>${x}</span>`).join('');
    // slots
    const slots = [['weapon', '武器', h.weapon], [0, '寶物 一', h.acc[0]], [1, '寶物 二', h.acc[1]]];
    $('.ar-slots').innerHTML = slots.map(([k, zh, id]) => {
      const it = itemOf(id);
      return `<div class="slot${k === slot ? ' on' : ''}" data-slot="${k}"><small>${zh}</small>${it ? itemCard(it, '<button class="off">卸下</button>') : '<div class="card empty">— 空 —</div>'}</div>`;
    }).join('');
    $('.ar-tip').textContent = slot === 'weapon' ? `${HERO.zh}的武器 · 點選裝備` : '寶物 · 任何武將皆可裝備 · 點選裝備';
    // armoury: what fits the chosen slot, best first
    const worn = new Set([h.weapon, ...h.acc]);
    const fits = Object.values(profile.items).filter((it) => (slot === 'weapon' ? it.kind === 'weapon' && it.hero === HERO.id : it.kind === 'acc'))
      .sort((a, b) => b.r - a.r || b.id - a.id);
    $('.ar-list').innerHTML = fits.length ? fits.map((it) => `<div class="pick${worn.has(it.id) ? ' worn' : ''}" data-id="${it.id}">${itemCard(it, worn.has(it.id) ? '<small class="tag">裝備中</small>' : '')}</div>`).join('')
      : '<p class="none">尚無可用裝備 · 擊破敵將、打開寶箱獲得</p>';
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target;
    if (t.closest('.ar-x') || t === el) { el.hidden = true; return; }
    const sl = t.closest('.slot');
    if (t.closest('.off') && sl) { equip(HERO.id, sl.dataset.slot === 'weapon' ? 'weapon' : +sl.dataset.slot, null); onChange(); paint(); return; }
    if (sl) { slot = sl.dataset.slot === 'weapon' ? 'weapon' : +sl.dataset.slot; paint(); return; }
    const pk = t.closest('.pick');
    if (pk) { equip(HERO.id, slot, +pk.dataset.id); onChange(); paint(); }
  });
  addEventListener('keydown', (e) => { if (!el.hidden && e.code === 'Escape') { el.hidden = true; e.stopImmediatePropagation(); } }, true);
  return {
    open() { slot = 'weapon'; paint(); el.hidden = false; },
    get open_() { return !el.hidden; },
  };
}
