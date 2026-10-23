// War horse (render): voxel parts — body, tack (saddle, saddle cloth, breastplate), neck + head, mane, four two-piece
// legs, tail — and a procedural gait (walk → canter → gallop by speed: leg swing with phase offsets, knee fold, body
// rock and bob, the neck nodding against it, the tail streaming back). Coat parts are built near white and tinted per
// horse (instance colour: bay, chestnut, black, grey, white, red); mane and tail take the hair tint, the tack the
// army's colour. Shared by the cavalry, loose horses and the hero's mount (crowd/view.js).
import { sculpt } from '../core/voxel.js';

const V = 0.05;
const b = (a, bb, c, paint) => ({ a, b: bb, c, paint });
const COAT = 0xf2eee8, SHADE = 0xd6d0c8, BELLY = 0xe6e0d8, HOOF = 0x3a2c22, EYE = 0x161010, MUZZLE = 0xb8aca0;
const LEATHER = 0x4a2e1c, CLOTH = 0xf4f0ea, TRIM = 0xf0d890, BRONZE = 0xc8a050, IRON = 0x3a3836;

/** Body frame: the barrel's centre is BODY.y above the ground (hooves on it at rest); the rider's pelvis sits SEAT
 *  above the barrel's centre. Joints in body space. */
export const HORSE_DIM = {
  bodyY: 1.07, seat: 0.43,
  neck: [0, 0.14, 0.62], tail: [0, 0.18, -0.8],
  legs: [[0.15, -0.12, 0.52], [-0.15, -0.12, 0.52], [0.15, -0.12, -0.55], [-0.15, -0.12, -0.55]],   // LF RF LH RH
  upper: 0.42,
};

/** Coats [coat, hair] (linear-ish RGB multipliers on the near-white parts). */
export const COATS = {
  bay: [[0.5, 0.31, 0.19], [0.1, 0.08, 0.07]],
  chestnut: [[0.62, 0.34, 0.17], [0.42, 0.2, 0.1]],
  black: [[0.17, 0.15, 0.14], [0.08, 0.07, 0.07]],
  grey: [[0.6, 0.58, 0.56], [0.32, 0.31, 0.3]],
  white: [[0.96, 0.94, 0.9], [0.9, 0.88, 0.84]],
  red: [[0.7, 0.2, 0.11], [0.22, 0.07, 0.05]],
};
export const FIELD_COATS = ['bay', 'chestnut', 'black', 'bay', 'grey', 'chestnut'];

/** A tapering tube from p0 to p1 (in the y-z plane, x the half-width): a point is inside when its distance to the
 *  segment (y-z) is under r and |x| under w, both eased from the p0 end to the p1 end. */
function tube(p0, p1, r0, r1, w0, w1, col) {
  const dy = p1[1] - p0[1], dz = p1[2] - p0[2], L2 = dy * dy + dz * dz;
  return (x, y, z) => {
    const t = Math.max(0, Math.min(1, ((y - p0[1]) * dy + (z - p0[2]) * dz) / L2));
    const ey = y - (p0[1] + dy * t), ez = z - (p0[2] + dz * t), r = r0 + (r1 - r0) * t, w = w0 + (w1 - w0) * t;
    const q = (ey * ey + ez * ez) / (r * r) + (x * x) / (w * w);
    return q <= 1 ? (typeof col === 'function' ? col(x, y, z, t) : col) : null;
  };
}

export function buildHorseGeometries() {
  const g = {};
  // barrel: deep through the girth, rounding up into the chest and the rump; lighter belly, darker flanks
  const barrel = (x, y, z) => {
    const ex = Math.abs(x) / 0.25, ey = (y + 0.01) / (z > 0.2 ? 0.31 : 0.28), ez = Math.abs(z) / 0.8;
    if (ex * ex + ey * ey > 1.05) return null;
    if (ez > 0.88 && ex * ex + ey * ey > 0.65) return null;                    // round the ends
    return y < -0.17 ? BELLY : Math.abs(x) > 0.2 ? SHADE : COAT;
  };
  g.body = sculpt([
    b([-0.26, -0.3, -0.8], [0.26, 0.3, 0.8], barrel),
    b([-0.23, -0.12, -0.84], [0.23, 0.3, -0.48], (x, y, z) => ((x / 0.23) ** 2 + ((y - 0.06) / 0.26) ** 2 + ((z + 0.62) / 0.24) ** 2 > 1 ? null : COAT)),   // rump
    b([-0.2, -0.05, 0.5], [0.2, 0.36, 0.86], (x, y, z) => ((x / 0.2) ** 2 + ((y - 0.12) / 0.26) ** 2 + ((z - 0.66) / 0.2) ** 2 > 1 ? null : COAT)),   // chest
  ], V, 0.08);
  g.tack = sculpt([
    b([-0.29, -0.02, -0.34], [0.29, 0.29, 0.26], (x, y, z) => (Math.abs(x) < 0.26 ? null : y < 0.02 || Math.abs(z + 0.04) > 0.27 ? TRIM : CLOTH)),   // saddle cloth
    b([-0.2, 0.27, -0.26], [0.2, 0.36, 0.2], LEATHER),                          // saddle
    b([-0.18, 0.34, 0.12], [0.18, 0.46, 0.22], LEATHER), b([-0.18, 0.34, -0.28], [0.18, 0.44, -0.18], LEATHER),   // pommel, cantle
    b([-0.19, 0.36, 0.14], [0.19, 0.4, 0.18], BRONZE),
    b([-0.3, -0.24, -0.04], [-0.26, 0.0, 0.0], LEATHER), b([0.26, -0.24, -0.04], [0.3, 0.0, 0.0], LEATHER),   // stirrup leathers
    b([-0.33, -0.3, -0.07], [-0.25, -0.24, 0.05], IRON), b([0.25, -0.3, -0.07], [0.33, -0.24, 0.05], IRON),   // stirrups
    b([-0.21, 0.1, 0.78], [0.21, 0.14, 0.84], LEATHER),                         // breast strap
    b([-0.04, 0.06, 0.82], [0.04, 0.16, 0.86], BRONZE),
  ], V, 0.06);
  // neck: deep and narrow, rising forward from the withers at ≈ 45°; the head off its top, the face sloping down
  // to a narrow muzzle; ears, eyes, nostrils, a bridle
  const N0 = [0, 0.0, -0.06], N1 = [0, 0.42, 0.32], H0 = [0, 0.5, 0.34], H1 = [0, 0.27, 0.74];
  g.head = sculpt([
    b([-0.11, -0.2, -0.3], [0.11, 0.56, 0.5], tube(N0, N1, 0.2, 0.11, 0.1, 0.075, COAT)),
    b([-0.11, 0.18, 0.2], [0.11, 0.66, 0.86], tube(H0, H1, 0.12, 0.075, 0.1, 0.065, (x, y, z, t) => (t > 0.82 ? MUZZLE : COAT))),
    b([-0.1, 0.3, 0.26], [0.1, 0.52, 0.5], (x, y, z) => ((x / 0.1) ** 2 + ((y - 0.4) / 0.11) ** 2 + ((z - 0.38) / 0.12) ** 2 > 1 ? null : COAT)),   // jowl
    b([-0.09, 0.56, 0.28], [-0.04, 0.68, 0.34], COAT), b([0.04, 0.56, 0.28], [0.09, 0.68, 0.34], COAT),   // ears
    b([-0.11, 0.46, 0.43], [-0.06, 0.5, 0.48], EYE, true), b([0.06, 0.46, 0.43], [0.11, 0.5, 0.48], EYE, true),   // eyes
    b([-0.07, 0.24, 0.7], [-0.03, 0.29, 0.78], EYE, true), b([0.03, 0.24, 0.7], [0.07, 0.29, 0.78], EYE, true),   // nostrils
    b([-0.12, 0.28, 0.6], [0.12, 0.42, 0.63], LEATHER, true), b([-0.12, 0.36, 0.4], [0.12, 0.56, 0.43], LEATHER, true),   // bridle
  ], 0.04, 0.08);
  // mane: a crest along the top of the neck, and the forelock
  const crest = (x, y, z) => {
    const dy = N1[1] - N0[1], dz = N1[2] - N0[2], L = Math.hypot(dy, dz), t = ((y - N0[1]) * dy + (z - N0[2]) * dz) / (L * L);
    if (t < 0.05 || t > 1.02 || Math.abs(x) > 0.035) return null;
    const ny = dz / L, nz = -dy / L;                                            // up-and-back from the neck's line
    const d = (y - N0[1] - dy * t) * ny + (z - N0[2] - dz * t) * nz, r = 0.2 + (0.11 - 0.2) * t;
    return d > r - 0.03 && d < r + 0.06 ? COAT : null;
  };
  g.mane = sculpt([b([-0.04, -0.1, -0.4], [0.04, 0.66, 0.4], crest), b([-0.035, 0.54, 0.36], [0.035, 0.6, 0.46], COAT)], 0.04, 0.12);
  // legs: upper (forearm / gaskin) from the joint down HORSE_DIM.upper, lower (cannon, fetlock, hoof) from the knee
  g.upper = sculpt([b([-0.07, -0.44, -0.085], [0.07, 0.06, 0.09], (x, y, z) => {
    const w = y > -0.12 ? 0.07 : 0.055 + 0.015 * (y + 0.44) / 0.32;
    return Math.abs(x) > w || Math.abs(z) > w + 0.01 ? null : y > -0.1 ? COAT : SHADE;
  })], 0.04, 0.08);
  g.lower = sculpt([
    b([-0.04, -0.44, -0.04], [0.04, 0.02, 0.045], SHADE),
    b([-0.05, -0.48, -0.05], [0.05, -0.4, 0.06], SHADE),                        // fetlock
    b([-0.055, -0.55, -0.06], [0.055, -0.47, 0.07], HOOF),
  ], 0.04, 0.08);
  g.tail = sculpt([
    b([-0.05, -0.1, -0.12], [0.05, 0.06, 0.02], COAT), b([-0.07, -0.45, -0.17], [0.07, -0.06, -0.03], COAT),
    b([-0.055, -0.72, -0.15], [0.055, -0.42, -0.03], COAT),
  ], 0.04, 0.12);
  return g;
}

/** Gait at ground speed v (m/s) and stride phase ph (rad): writes { bob, pitch, neck, tail, swish, leg: [up, low] × 4 }.
 *  Walk below ≈ 3 m/s (four-beat), gallop above ≈ 7 (transverse: hinds, then fores), blended between. */
const WALK = [0.25, 0.75, 0, 0.5], GALLOP = [0.5, 0.6, 0, 0.1];   // LF RF LH RH, fraction of the stride
export function gait(ph, v, out) {
  const w = Math.min(1, v / 1.2), k = Math.max(0, Math.min(1, (v - 3) / 4)), TAU = Math.PI * 2;
  const amp = (0.22 + 0.38 * k) * w;
  out.leg = out.leg || [[0, 0], [0, 0], [0, 0], [0, 0]];
  for (let L = 0; L < 4; L++) {
    const off = WALK[L] + (GALLOP[L] - WALK[L]) * k, a = ph + off * TAU, fore = L < 2;
    const swing = Math.sin(a), lift = Math.max(0, Math.cos(a));                 // lift: the leg coming forward
    out.leg[L][0] = -amp * swing;
    out.leg[L][1] = (fore ? 1 : -1) * (0.15 + 0.85 * k) * w * lift * 1.1;      // forelegs fold back, hind legs forward
  }
  out.bob = (0.015 + 0.05 * k) * w * Math.abs(Math.sin(ph));
  out.pitch = 0.07 * k * Math.sin(ph + 0.6);
  out.neck = -0.1 * k * Math.sin(ph + 0.6) + 0.06 * (1 - w) + 0.12 * k;           // the head reaches forward at a gallop
  out.tail = 0.25 + 0.7 * k;                                                    // lifts and streams back at speed
  out.swish = 0.18 * Math.sin(ph * 0.5) * (1 - 0.6 * k);
  return out;
}
/** Stride frequency (Hz) at ground speed v: ≈ 1 at a walk, 2.3 at a full gallop. */
export const strideHz = (v) => 0.8 + 0.14 * v;
