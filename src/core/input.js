// Input → actions from keyboard, mouse, gamepad and touch (ui/touch.js drives the `touch` hooks).
// The sim calls sample() exactly once per fixed step; "pressed" edges are latched so a tap
// between two steps is never lost.
export const ACTIONS = ['attack', 'charge', 'jump', 'dodge', 'musou', 'horse'];

const KEYMAP = {
  KeyJ: 'attack', KeyK: 'charge', Space: 'jump', KeyL: 'dodge',
  ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyI: 'musou', KeyU: 'horse',
};
const MOVEKEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
// Gamepad (standard mapping): A/× jump, X/□ attack, Y/△ charge, B/○ musou, R1 dodge, L1 horse.
const PADMAP = { 0: 'jump', 2: 'attack', 3: 'charge', 1: 'musou', 5: 'dodge', 7: 'dodge', 4: 'horse' };

export function createInput() {
  const dev = { held: {}, latch: {}, keys: new Set(), orbitPx: 0, pad: {}, tx: 0, ty: 0 };
  const out = { mx: 0, my: 0, orbit: 0, pressed: {}, held: {} };

  addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    dev.keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a && !e.repeat) { dev.held[a] = true; dev.latch[a] = true; }
  });
  addEventListener('keyup', (e) => {
    dev.keys.delete(e.code);
    const a = KEYMAP[e.code];
    if (a) dev.held[a] = false;
  });
  addEventListener('blur', () => { dev.keys.clear(); for (const a of ACTIONS) dev.held[a] = false; });
  let drag = false, lastX = 0;
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || (e.target.closest && e.target.closest('button,a,input'))) return;   // touch: ui/touch.js
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) { dev.held[a] = true; dev.latch[a] = true; }
    drag = true; lastX = e.clientX;
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    const a = e.button === 0 ? 'attack' : e.button === 2 ? 'charge' : null;
    if (a) dev.held[a] = false;
    drag = false;
  });
  addEventListener('pointermove', (e) => {
    if (drag && e.pointerType !== 'touch') { dev.orbitPx += e.clientX - lastX; lastX = e.clientX; }
  });

  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) return null;
    for (const [btn, a] of Object.entries(PADMAP)) {
      const down = !!(p.buttons[btn] && p.buttons[btn].pressed);
      if (down && !dev.pad[btn]) dev.latch[a] = true;
      dev.pad[btn] = down;
    }
    return p;
  }

  function sample() {
    let mx = 0, my = 0, orbit = 0;
    const pad = pollPad();
    for (const k of dev.keys) { const m = MOVEKEYS[k]; if (m) { mx += m[0]; my += m[1]; } }
    mx += dev.tx; my += dev.ty;                                 // touch stick
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      mx += dz(pad.axes[0] || 0); my -= dz(pad.axes[1] || 0);
      orbit += dz(pad.axes[2] || 0) * 0.05;
    }
    if (dev.keys.has('KeyQ')) orbit += 0.04;
    if (dev.keys.has('KeyE')) orbit -= 0.04;
    orbit -= dev.orbitPx * 0.006; dev.orbitPx = 0;
    for (const a of ACTIONS) {
      out.pressed[a] = !!dev.latch[a];
      out.held[a] = !!dev.held[a];
      dev.latch[a] = false;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    out.mx = mx; out.my = my; out.orbit = orbit;
    return out;
  }

  /** Touch hooks (ui/touch.js): stick in [-1, 1]² (up = +y), a button down / up, a camera swipe in px. */
  const touch = {
    stick(x, y) { dev.tx = x; dev.ty = y; },
    button(a, down) { if (down && !dev.held[a]) dev.latch[a] = true; dev.held[a] = down; },
    orbit(px) { dev.orbitPx += px; },
  };
  return { sample, touch };
}
