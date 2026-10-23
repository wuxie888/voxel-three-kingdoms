// Touch controls (phones, tablets): a floating stick wherever the left thumb lands on the left half, action buttons on
// the right (攻 attack, 蓄 charge, 跳 jump, 閃 dodge, 無雙 musou — lit when the gauge is ready), a camera swipe on the
// free right side and a pause button. Feeds core/input.js through its touch hooks. Shown from the start on coarse-
// pointer devices and on the first touch anywhere; a key press or a mouse click hides it again. body.touch switches
// the HUD and menu to the touch layout (index.html).
const BUTTONS = [
  ['attack', '攻', 'ATK'], ['charge', '蓄', 'CHG'], ['jump', '跳', 'JUMP'], ['dodge', '閃', 'DODGE'], ['musou', '無雙', 'MUSOU'],
  ['horse', '馬', 'HORSE'],
];

export function createTouch(input, game, { onPause }) {
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `<div class="stick"><i></i></div>
    ${BUTTONS.map(([a, zh, en]) => `<button class="tb tb-${a}" data-a="${a}"><b>${zh}</b><small>${en}</small></button>`).join('')}
    <button class="tp" aria-label="pause">❚❚</button>`;
  document.body.appendChild(root);
  const stick = root.querySelector('.stick'), knob = stick.firstElementChild, musouBtn = root.querySelector('.tb-musou');
  const R = () => innerHeight * 0.11;                            // stick throw (px): full speed at 11 % of the screen height

  let on = false, pend = 0;
  const enable = (v) => { if (v === on) return; on = v; document.body.classList.toggle('touch', v); };
  if (matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')) enable(true);
  // a later switch waits for the tap's click to land: the touch layout moves the menu, and a button that moved out
  // from under the finger would turn the tap into a miss. Mouse = real pointer events of type mouse (phones also
  // fire emulated mousedowns after every tap, which must not switch the touch layout off).
  const later = (v) => { clearTimeout(pend); pend = setTimeout(() => enable(v), 400); };
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' ? !on : e.pointerType === 'mouse' && on) later(!on); }, true);
  addEventListener('keydown', () => { if (on) later(false); });

  // ---- buttons: each holds its own pointer (press = latch + hold, so the charge button can be held)
  for (const b of root.querySelectorAll('.tb')) {
    const a = b.dataset.a;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('down'); input.touch.button(a, true); });
    const up = (e) => { e.stopPropagation(); b.classList.remove('down'); input.touch.button(a, false); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  root.querySelector('.tp').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPause(); });

  // ---- stick (left half) and camera swipe (right half): touches that start on the game, not on a button
  let sid = null, sx = 0, sy = 0, cid = null, cx = 0;
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !on || e.target.closest('button,a,#menu,#result,.h-map')) return;
    if (e.clientX < innerWidth * 0.48 && sid === null) {
      sid = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.transform = `translate(${sx}px, ${sy}px)`; stick.classList.add('on'); knob.style.transform = '';
    } else if (cid === null) { cid = e.pointerId; cx = e.clientX; }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId === sid) {
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const r = R(), l = Math.hypot(dx, dy);
      if (l > r) { dx *= r / l; dy *= r / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.min(1, l / r) < 0.18 ? 0 : 1;               // dead zone, then full direction (a light push still runs)
      input.touch.stick(k * dx / r, -k * dy / r);
    } else if (e.pointerId === cid) { input.touch.orbit((e.clientX - cx) * 1.6); cx = e.clientX; }
  });
  const end = (e) => {
    if (e.pointerId === sid) { sid = null; stick.classList.remove('on'); input.touch.stick(0, 0); }
    if (e.pointerId === cid) cid = null;
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  addEventListener('blur', () => { sid = cid = null; stick.classList.remove('on'); input.touch.stick(0, 0); });

  return {
    update() {
      if (!on) return;
      musouBtn.classList.toggle('ready', game.musou.ready() && game.hero.state !== 'musou');
    },
  };
}
