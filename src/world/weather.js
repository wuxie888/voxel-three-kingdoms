// Weather (render-only), chosen by STAGE.weather: 'rain' — slanting streaks falling through a box around the camera
// (recycled when they reach the ground), and now and then a sheet of lightning (a short screen flash).
import * as THREE from 'three';
import { STAGE } from '../stages/index.js';
import { hash01 } from '../core/rng.js';

const N = 1800, BOX = [44, 26, 44], FALL = 19, WIND = [2.6, 0, 1.4];

export function createWeather(scene, camera) {
  if (STAGE.weather !== 'rain') return { update() {}, flash: 0 };
  const geo = new THREE.BoxGeometry(0.018, 0.62, 0.018);
  const mat = new THREE.MeshBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.42, depthWrite: false, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false; mesh.renderOrder = 3;
  scene.add(mesh);
  const P = Array.from({ length: N }, (_, i) => [hash01(i, 1, 3), hash01(i, 2, 3), hash01(i, 3, 3)]);   // phase in the box
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(WIND[2] * 0.05, 0, -WIND[0] * 0.05)), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  let t = 0, next = 6;
  const W = { flash: 0, update(dt) {
    t += dt;
    const c = camera.position;
    for (let i = 0; i < N; i++) {
      const [a, b, d] = P[i];
      // each drop cycles top → ground in BOX[1] / FALL seconds, offset by its phase; x/z wrap around the camera
      const u = ((t * FALL / BOX[1] + b) % 1 + 1) % 1, y = BOX[1] * (1 - u);
      const x = ((a * BOX[0] + WIND[0] * t - c.x) % BOX[0] + BOX[0]) % BOX[0] - BOX[0] / 2 + c.x;
      const z = ((d * BOX[2] + WIND[2] * t - c.z) % BOX[2] + BOX[2]) % BOX[2] - BOX[2] / 2 + c.z;
      mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
    // lightning: every 9-17 s, a double flicker
    W.flash = 0;
    if (t > next) { const k = t - next; W.flash = k < 0.08 ? 0.22 : k > 0.16 && k < 0.22 ? 0.14 : 0; if (k > 0.3) next = t + 9 + hash01(Math.floor(t), 7, 1) * 8; }
  } };
  return W;
}
