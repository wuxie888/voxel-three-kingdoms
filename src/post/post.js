// Renderer + post chain — the concept.png look: backlit golden hour, warm bloom, strong DoF, subtle retro texture.
//   scene  → sceneRT  full res, HDR, 4× MSAA, depth texture (crisp voxel edges)
//   atmos  → atmosRT  full res: aerial perspective (mauve haze away from the sun, peach toward it) + backlit dust
//                     in-scatter; alpha = view distance
//   dof    → dofRT    half res: single-pass gather bokeh; alpha = how much a blurred foreground covers this pixel
//   bloom             UnrealBloom on dofRT, source-hued, HDR threshold: only sun / fire / spear arc bloom
//   final  → screen   sharp/blurred mix per pixel (CoC from full-res depth), bloom, horizontal highlight streaks,
//                     chromatic fringe, split-tone grade (scene-linear), hue-preserving S-curve + per-channel soft
//                     shoulder (fire stays orange/yellow, white armour keeps its shading), bottom darkening,
//                     vignette, grain, 2 px ordered dither + palette quantisation (retro).
// Quality (setQuality): render scale (the canvas upscales pixelated), MSAA samples, and `dof` — off, the dof pass is
// skipped, bloom reads the sharp image and the final pass takes one scene tap (no fringe / streaks: LITE).
// post=0 renders straight to the canvas. Render-only: reads camera/focus, never touches sim state.
import * as THREE from 'three';
import { STAGE } from '../stages/index.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Tunables. Every key k is uniform u<K> in all passes.
// Tuned on overview / crowd-fight / musou captures toward the concept stats (luma mean ≈ 0.36, p5 ≤ 0.08, p95 ≥ 0.78,
// saturation ≈ 0.33, bottom third darker): r2 medians mean 0.34-0.39, p5 0.05-0.06, p95 0.63-0.76, sat 0.32-0.33,
// hero armour never at white (it was 3-7 % of the hero box). The scene itself is low-contrast (scene-luminance p50 ≈ 0.11,
// p95 ≈ 0.22), hence the steep curve.
const P = {
  // tone curve (Lottes): scene luminance tmMidIn → display tmMidOut, tmContrast = mid slope, tmShoulder < 1 = roll-off
  // reaching 1.0 at tmMax; knee = start of the per-channel shoulder; hotDesat = how fast overflow bleaches to white
  exposure: 1.22, tmContrast: 3.3, tmShoulder: 0.97, tmMidIn: 0.11, tmMidOut: 0.1, tmMax: 5, knee: 0.75, hotDesat: 0.25,
  sat: 1.22, lift: 0.006,
  shadowTint: [0.9, 0.93, 1.12], highTint: [1.12, 1.0, 0.74], tintLo: 0.02, tintHi: 0.4,   // split tone: mauve-blue shade, peach-gold light
  hazeCool: [0.1, 0.11, 0.17], hazeWarm: [0.34, 0.2, 0.15], sunGlow: [0.9, 0.6, 0.35], sunGlowGeo: 0.8, inscatter: [0.02, 0.011, 0.005], sunBurst: [0.1, 0.06, 0.025], inscatterDist: 60,
  hazeStart: 9, hazeDensity: 0.006, hazeMax: 0.06, skyHaze: 0.3, skyGain: 0.5, farGain: 0.45,   // light enough that the wall keeps its bricks
  nearBlur: 26, farBlur: 0.6, bandNear: 1.4, bandFar: 5,          // DoF: CoC in half-res px, bands in metres
  bloom: 0.6, bloomRadius: 0.1, bloomThreshold: 1.5, bloomKnee: 0.5, bloomCool: 1.5, hdrClamp: 2.5,
  sharpen: 0.35, streak: 0.05, rowNoise: 0.018, ca: 1.3, grain: 0.03, levels: 40, dither: 0.8, vignette: 0.18, bottom: 0.25,
  // art-direction extras (0 = off): edge = ink outline from view-distance breaks, mono = wash to paper tone (reds kept),
  // paper = paper tint, pixel = screen pixel size for the chunky retro look
  edge: 0, mono: 0, paper: [1, 1, 1], pixel: 1,
};
// Look presets (?look=name): overrides of P. 'dusk' is the default golden-hour concept look.
export const LOOKS = {
  dusk: {},
  ink: {   // 水墨: paper-toned wash, black ink outlines, only red survives
    edge: 0.9, mono: 0.92, paper: [0.96, 0.92, 0.84], sat: 1.0, grain: 0.05, levels: 64, dither: 0.3, streak: 0, ca: 0,
    shadowTint: [1, 1, 1], highTint: [1, 1, 1], vignette: 0.35, bottom: 0.1, bloom: 0.3, exposure: 1.35,
  },
  night: {  // 夜战火攻: moonlit blue shade, fire-orange light
    exposure: 0.95, sat: 1.1, shadowTint: [0.62, 0.78, 1.35], highTint: [1.35, 0.92, 0.55], tintLo: 0.03, tintHi: 0.5,
    hazeCool: [0.03, 0.05, 0.12], hazeWarm: [0.2, 0.08, 0.04], sunGlow: [0.5, 0.2, 0.1], skyGain: 0.22, farGain: 0.3,
    bloom: 1.0, bloomThreshold: 1.1, vignette: 0.3,
  },
  bright: { // 明快卡通: clean daylight, saturated, no film artefacts
    exposure: 1.45, tmContrast: 2.6, sat: 1.45, shadowTint: [0.97, 1.0, 1.08], highTint: [1.04, 1.02, 0.96],
    hazeCool: [0.22, 0.28, 0.36], hazeWarm: [0.32, 0.3, 0.26], sunGlow: [0.5, 0.45, 0.35], skyGain: 0.8,
    grain: 0, rowNoise: 0, ca: 0, streak: 0, dither: 0, levels: 255, vignette: 0.05, bottom: 0.05, nearBlur: 8, farBlur: 0.2,
    edge: 0.35,
  },
  storm: {  // 秋雨: grey rainlight, cool shade, muted colour, heavier vignette
    exposure: 1.3, tmContrast: 3.0, sat: 0.9, shadowTint: [0.86, 0.94, 1.12], highTint: [1.02, 1.0, 0.96], tintLo: 0.02, tintHi: 0.45,
    hazeCool: [0.12, 0.14, 0.18], hazeWarm: [0.16, 0.16, 0.17], sunGlow: [0.25, 0.27, 0.3], sunBurst: [0.02, 0.02, 0.02], skyGain: 0.42, farGain: 0.4,
    bloom: 0.45, vignette: 0.32, bottom: 0.3, grain: 0.04,
  },
  retro: {  // 复古像素: 16-bit chunky pixels, few colour levels
    pixel: 3, levels: 20, dither: 0.35, grain: 0, rowNoise: 0, ca: 0, streak: 0, sat: 1.3, nearBlur: 0, farBlur: 0,
    bloom: 0.25, edge: 0.7, vignette: 0.1,
  },
};
const lookName = new URLSearchParams(location.search).get('look') || STAGE.look;
if (lookName && LOOKS[lookName]) Object.assign(P, LOOKS[lookName]);
if (!new URLSearchParams(location.search).get('look') && STAGE.post) Object.assign(P, STAGE.post);   // per-stage tweaks of its look
const uName = (k) => 'u' + k[0].toUpperCase() + k.slice(1);
const pUniforms = () => Object.fromEntries(Object.entries(P).map(([k, v]) => [uName(k), { value: Array.isArray(v) ? new THREE.Vector3(...v) : v }]));
const syncP = (u) => { for (const k in P) { const x = u[uName(k)]; if (Array.isArray(P[k])) x.value.set(...P[k]); else x.value = P[k]; } };

const quadVS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// circle of confusion (half-res px) from view distance: sharp band around the focus plane (hero + the ring around him),
// strong near-field blur, soft far field
const COC = /* glsl */`
  uniform float uFocus, uNearBlur, uNearScale, uFarBlur, uFarScale, uBandN, uBandF;
  float coc(float d) {
    float fn = max(uFocus - uBandN, 0.4), ff = uFocus + uBandF;
    return max(clamp((fn / d - 1.0) * uNearBlur * uNearScale, 0.0, 12.0), clamp((1.0 - ff / d) * uFarBlur * uFarScale, 0.0, 12.0));
  }`;

const AtmosShader = /* glsl */`
  uniform sampler2D tColor, tDepth; uniform mat4 uProjInv, uCamWorld; uniform vec3 uSunDir, uCamPos;
  uniform vec3 uHazeCool, uHazeWarm, uSunGlow, uInscatter, uSunBurst; uniform float uSunGlowGeo, uSkyGain, uFarGain, uHazeStart, uHazeDensity, uHazeMax, uSkyHaze, uHdrClamp, uInscatterDist;
  varying vec2 vUv;
  void main() {
    float z = texture2D(tDepth, vUv).x;
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v.xyz /= v.w;
    vec3 dir = normalize(mat3(uCamWorld) * v.xyz);
    bool sky = z >= 0.99999;
    float dist = sky ? 5000.0 : length(v.xyz);
    // graduated exposure: fully fogged distance and sky sit a stop lower, so close-ups against the horizon read as a
    // sunset gradient instead of a white-out
    vec3 c = texture2D(tColor, vUv).rgb * (sky ? uSkyGain : mix(1.0, uFarGain, smoothstep(60.0, 250.0, dist)));
    float mu = dot(dir, uSunDir);
    vec3 hz = mix(uHazeCool, uHazeWarm, smoothstep(-0.4, 0.95, mu)) + uSunGlow * pow(max(mu, 0.0), 10.0) * (sky ? 1.0 : uSunGlowGeo);  // backlit walls stay silhouettes
    float wy = uCamPos.y + dir.y * min(dist, 400.0);                      // height of the hit point: dust hugs the ground
    float a = (1.0 - exp(-max(dist - uHazeStart, 0.0) * uHazeDensity)) * mix(0.6, 1.0, exp(-max(wy, 0.0) / 14.0));
    if (sky) a = uSkyHaze * (1.0 - smoothstep(0.0, 0.4, dir.y));
    c = mix(c, hz, a * uHazeMax * (1.0 - smoothstep(0.9, 2.0, max(c.r, max(c.g, c.b)))));   // fires stay fire through the haze
    // backlit dust: sunlight scattered forward by the air between the camera and the hit point (lifts the sun side
    // of the frame; additive and growing with distance, so near silhouettes stay readable)
    // (broad lift, plus a tight golden burst around the sun that only builds up over long distances: the concept's
    // glowing sky behind the castle, while the backlit wall itself stays a legible silhouette)
    float dd = min(dist, 400.0);
    c += uInscatter * pow(max(mu, 0.0), 4.0) * (1.0 - exp(-dd / uInscatterDist)) + uSunBurst * pow(max(mu, 0.0), 16.0) * (1.0 - exp(-dd / (3.0 * uInscatterDist)));
    // tame stacked additive fire before bloom; hue-preserving (scale, not per-channel clip) so flames stay orange
    float cm = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * min(1.0, uHdrClamp / max(cm, 1e-4)), dist);
  }`;

// Gather DoF (after Gustafsson's single-pass bokeh): golden-angle spiral stretched to a square, so blurred voxels read
// as soft blocks as in the concept. Every tap spreads by its own CoC; taps behind the centre are clamped to the centre's
// CoC so a sharp hero never smears onto the blurred background.
const DofShader = /* glsl */`
  uniform sampler2D tAtmos; uniform vec2 uTexel;
  varying vec2 vUv;
  ${COC}
  #define RAD_SCALE 0.85
  void main() {
    vec4 c0 = texture2D(tAtmos, vUv);
    float cSize = coc(c0.a);
    vec3 col = c0.rgb; float tot = 1.0, fg = 0.0, radius = RAD_SCALE;
    for (float ang = 0.0; radius < 12.0; ang += 2.39996323) {
      vec2 dv = vec2(cos(ang), sin(ang)); dv /= max(abs(dv.x), abs(dv.y));   // square bokeh: soft voxel blocks
      vec4 s = texture2D(tAtmos, vUv + dv * uTexel * radius);
      float sSize = coc(s.a);
      if (s.a > c0.a) sSize = clamp(sSize, 0.0, cSize * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, sSize);
      col += mix(col / tot, s.rgb, m); tot += 1.0;
      fg += s.a < c0.a - 0.5 ? m : 0.0;                                    // blurred foreground spilling over us
      radius += RAD_SCALE / radius;
    }
    gl_FragColor = vec4(col / tot, clamp(fg / tot * 4.0, 0.0, 1.0));
  }`;

const FinalShader = /* glsl */`
  uniform sampler2D tSharp, tDof, tBloom; uniform vec2 uRes; uniform float uTime, uFlash;
  uniform float uExposure, uTmContrast, uTmShoulder, uTmB, uTmC, uKnee, uHotDesat, uSat, uLift, uTintLo, uTintHi, uSharpen, uStreak, uRowNoise, uCa, uGrain, uLevels, uDither, uVignette, uBottom;
  uniform float uEdge, uMono, uPixel;
  uniform vec3 uShadowTint, uHighTint, uPaper;
  varying vec2 vUv;
  ${COC}
  float bayer4(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return (float(m[i]) + 0.5) / 16.0 - 0.5;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // scene colour at uv: full-res sharp where in focus (lightly unsharp-masked: crisp voxel edges), half-res bokeh where
  // the pixel's own depth is out of focus or a blurred foreground covers it; + bloom
  vec3 scene(vec2 uv) {
    vec2 t = 1.0 / uRes;
    vec4 s = texture2D(tSharp, uv);
    vec3 nb = texture2D(tSharp, uv + vec2(t.x, 0.0)).rgb + texture2D(tSharp, uv - vec2(t.x, 0.0)).rgb
            + texture2D(tSharp, uv + vec2(0.0, t.y)).rgb + texture2D(tSharp, uv - vec2(0.0, t.y)).rgb;
    vec3 sharp = max(s.rgb + (s.rgb - nb * 0.25) * uSharpen, 0.0);
  #ifdef LITE
    return sharp + texture2D(tBloom, uv).rgb;                 // low quality: no depth of field
  #else
    vec4 b = texture2D(tDof, uv);
    float k = max(smoothstep(0.3, 1.3, coc(s.a)), b.a);
    return mix(sharp, b.rgb, k) + texture2D(tBloom, uv).rgb;
  #endif
  }
  // ink outline: relative jump in view distance (tSharp alpha) to any 4-neighbour at pixel scale
  float edgeAt(vec2 uv) {
    vec2 t = max(uPixel, 1.0) / uRes;
    float c = texture2D(tSharp, uv).a, e = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = i == 0 ? vec2(t.x, 0.0) : i == 1 ? vec2(-t.x, 0.0) : i == 2 ? vec2(0.0, t.y) : vec2(0.0, -t.y);
      float n = texture2D(tSharp, uv + o).a;
      e = max(e, (n - c) / max(c, 0.5));   // only the near side of a break draws the line
    }
    return smoothstep(0.06, 0.2, e) * (1.0 - smoothstep(25.0, 60.0, c));
  }
  void main() {
    vec2 uv = uPixel > 1.0 ? (floor(vUv * uRes / uPixel) + 0.5) * uPixel / uRes : vUv;
    vec2 d = uv - 0.5;
    // light lateral chromatic fringe toward the edges
  #ifdef LITE
    vec3 c = scene(uv);                                       // low quality: one scene tap, no fringe, no streaks
  #else
    vec2 ca = vec2(uCa * dot(d, d) * 4.0 / uRes.x, 0.0);
    vec3 c = vec3(scene(uv + ca).r, scene(uv).g, scene(uv - ca).b);
    // faint horizontal streaks: highlights smear sideways (tape / anamorphic feel), plus low row-to-row jitter
    vec3 st = vec3(0.0);
    for (int i = 1; i <= 6; i++) {
      float o = (float(i * i) + 1.0) * 2.0 / uRes.x, w = 1.0 / float(i);
      st += (max(texture2D(tDof, uv + vec2(o, 0.0)).rgb - 1.0, 0.0) + max(texture2D(tDof, uv - vec2(o, 0.0)).rgb - 1.0, 0.0)) * w;
    }
    c += st * uStreak * vec3(1.0, 0.86, 0.7);
  #endif
    c *= 1.0 + (hash(vec2(floor(gl_FragCoord.y * 0.5), floor(uTime * 12.0))) - 0.5) * uRowNoise;
    // golden-hour grade in scene-linear (before the curve, so its shoulder also rolls off the tinted highlights):
    // split tone — cool mauve-blue shade, peach-gold light; blue-dominant pixels (spear arc, tassel, teal trim) keep
    // their cool, the arc is the one cool light in the frame — then saturation
    c *= uExposure;
    float L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    float cool = smoothstep(0.0, 0.25, (c.b - c.r) / max(c.b, 1e-4));
    // (emissive-hot light — musou burst, flashes — fades back to neutral so it still burns to white, not cream)
    c *= mix(mix(uShadowTint, mix(uHighTint, vec3(0.97, 1.0, 1.06), cool), smoothstep(uTintLo, uTintHi, L)), vec3(1.0), smoothstep(1.2, 3.0, L));
    L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    c = max(mix(vec3(L), c, uSat), 0.0);
    // film response: a Lottes S-curve on luminance (steep mids = the concept's contrast, long shoulder) scales the
    // colour, so hue survives the top end; then a per-channel soft shoulder takes the overflow, so saturated light walks
    // orange → yellow → white like real fire (not peach-white) and white armour rolls off with its shading
    c *= pow(L, uTmContrast) / (pow(L, uTmContrast * uTmShoulder) * uTmB + uTmC) / L;
    float pk = max(c.r, max(c.g, c.b));
    c = min(c, uKnee) + (1.0 - uKnee) * (1.0 - exp(-max(c - uKnee, 0.0) / (1.0 - uKnee)));
    float pk2 = max(c.r, max(c.g, c.b));
    c = mix(c, vec3(pk2), 1.0 - 1.0 / (uHotDesat * max(pk - pk2, 0.0) + 1.0));   // only the hottest cores bleach
    c = uLift * vec3(1.0, 0.8, 0.75) + min(c, 1.0) * (1.0 - uLift);
    c = sRGBTransferOETF(vec4(max(c, 0.0), 1.0)).rgb;
    // wash: everything but strong reds goes to paper tone by lightness; ink outline on top
    if (uMono > 0.0) {
      float Lp = dot(c, vec3(0.299, 0.587, 0.114));
      float red = smoothstep(0.12, 0.35, c.r - max(c.g, c.b));
      c = mix(c, uPaper * smoothstep(0.03, 0.85, Lp), uMono * (1.0 - red));
    }
    if (uEdge > 0.0) c *= 1.0 - uEdge * edgeAt(uv);
    // lens: soft vignette + darker foreground band (concept: bottom third darker than the top)
    c *= (1.0 - uVignette * smoothstep(0.35, 0.95, length(d * vec2(1.6, 1.0)))) * (1.0 - uBottom * (1.0 - smoothstep(0.0, 0.42, vUv.y)));
    c = mix(c, vec3(1.0, 0.97, 0.9), uFlash);
    // grain on the screen grid (fine); dither + quantise on a 2 px grid (retro)
    c += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 97.0) - 0.5) * uGrain;
    c += bayer4(floor(gl_FragCoord.xy / max(2.0, uPixel))) * uDither / uLevels;
    c = floor(c * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVS, fragmentShader, uniforms: { ...pUniforms(), ...uniforms }, depthTest: false, depthWrite: false, toneMapped: false });
const v3 = (a) => new THREE.Vector3(...a);

export function createPost({ canvas, enabled = true, width, height }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !enabled, powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(enabled ? 1 : Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.info.autoReset = false;

  let sceneRT, atmosRT, dofRT, bloom, atmos, dof, fin;
  if (enabled) {
    sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(4, 4) });
    // nearest: the half-res DoF must not average a hero-plane distance with the background behind it
    atmosRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    dofRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    bloom = new UnrealBloomPass(new THREE.Vector2(320, 180), P.bloom, P.bloomRadius, P.bloomThreshold);
    bloom.blendMaterial.visible = false;          // don't add onto dofRT: the final pass adds the bloom to both branches
    // prefilter: soft knee instead of a hard cut (no popping), and blue-dominant light (the spear arc, the one cool
    // light in a warm frame) passes at a lower threshold so the arc glows like the concept's without blooming the sand
    const hp = bloom.materialHighPassFilter;
    hp.uniforms.uCool = { value: 0 };
    hp.fragmentShader = /* glsl */`
      uniform sampler2D tDiffuse; uniform float luminosityThreshold, smoothWidth, uCool;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float cool = clamp((c.b - c.r) / max(c.b, 1e-3), 0.0, 1.0);
        float v = luminance(c) * (1.0 + uCool * cool);
        gl_FragColor = vec4(min(c, vec3(1.6)) * smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v), 1.0);   // capped: stacked trails glow, never flare over the hero
      }`;
    // bloom keeps its source's hue (orange fire → orange halo, blue arc → blue halo); the wide mips lean only a little
    // warm, the grade already carries the golden hour. The two widest mips are faint: at full weight a large bright mass
    // (the Musou payoff's dragon + light shards) spread into a screen-wide pale-blue veil; light stays a local glow.
    bloom.bloomTintColors = [v3([0.95, 1, 1.08]), v3([1, 0.97, 0.93]), v3([0.45, 0.42, 0.39]), v3([0.12, 0.11, 0.1]), v3([0.03, 0.026, 0.023])];
    const dofU = { uFocus: { value: 7 }, uNearScale: { value: 1 }, uFarScale: { value: 1 }, uBandN: { value: 3 }, uBandF: { value: 5 } };   // shared by dof + final
    atmos = new FullScreenQuad(mat(AtmosShader, {
      tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture },
      uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.2, 0.76).normalize() }, uCamPos: { value: new THREE.Vector3() },
    }));
    dof = new FullScreenQuad(mat(DofShader, { tAtmos: { value: atmosRT.texture }, uTexel: { value: new THREE.Vector2() }, ...dofU }));
    fin = new FullScreenQuad(mat(FinalShader, {
      tSharp: { value: atmosRT.texture }, tDof: { value: dofRT.texture }, tBloom: { value: bloom.renderTargetsHorizontal[0].texture },
      uRes: { value: new THREE.Vector2(1280, 720) }, uTime: { value: 0 }, uFlash: { value: 0 }, uTmB: { value: 1 }, uTmC: { value: 1 }, ...dofU,
    }));
  }

  const Q = { scale: 1, msaa: 4, dof: true };
  let cssW = width, cssH = height;
  function setSize(cw, ch) {
    cssW = cw; cssH = ch;
    renderer.setPixelRatio(enabled ? Q.scale : Math.min(devicePixelRatio, 2));
    renderer.setSize(cw, ch, false);
    if (!enabled) return;
    const w = Math.round(cw * Q.scale), h = Math.round(ch * Q.scale), hw = Math.round(w / 2), hh = Math.round(h / 2);
    sceneRT.setSize(w, h); atmosRT.setSize(w, h); dofRT.setSize(hw, hh);
    bloom.setSize(hw, hh);
    fin.material.uniforms.uRes.value.set(w, h);
    dof.material.uniforms.uTexel.value.set(1 / hw, 1 / hh);
  }
  setSize(width, height);
  /** Quality: {scale, msaa, dof} (any subset); applies at once. */
  function setQuality(q) {
    const msaa = q.msaa ?? Q.msaa, dofOn = q.dof ?? Q.dof;
    if (enabled && msaa !== Q.msaa) { sceneRT.samples = msaa; sceneRT.dispose(); }   // re-created with the new samples on next use
    if (enabled && dofOn !== Q.dof) {
      if (dofOn) delete fin.material.defines.LITE; else fin.material.defines.LITE = '';
      fin.material.needsUpdate = true;
    }
    Object.assign(Q, q);
    setSize(cssW, cssH);
  }

  let flash = 0;
  return {
    renderer, bloom, enabled,
    setSize, setQuality, quality: Q,
    flash(v) { flash = v; },
    /** Boot, behind the title menu: one offscreen frame with every hidden object shown and nothing culled, so each
     *  program (pools, the boss, telegraphs, projectiles) compiles and each buffer/texture uploads now instead of
     *  hitching the first hit, the first projectile or the boss's entrance. Targets sceneRT: the program key depends on
     *  the render target (tone mapping / output colour space). */
    warm(scene, camera) {
      const shown = [], culled = [];
      scene.traverse((o) => {
        if (!o.visible) { o.visible = true; shown.push(o); }
        if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
      });
      renderer.setRenderTarget(enabled ? sceneRT : null);
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      for (const o of shown) o.visible = false;
      for (const o of culled) o.frustumCulled = true;
    },
    /** focus: world point the camera frames (hero) → DoF focus plane; sunDir: world sun direction → haze glow. */
    render(scene, camera, time = 0, focus = null, sunDir = null) {
      renderer.info.reset();
      if (!enabled) { renderer.render(scene, camera); return; }
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);

      const a = atmos.material.uniforms;
      syncP(a);
      a.uProjInv.value.copy(camera.projectionMatrixInverse);
      a.uCamWorld.value.copy(camera.matrixWorld);
      a.uCamPos.value.copy(camera.position);
      if (sunDir) a.uSunDir.value.copy(sunDir);
      renderer.setRenderTarget(atmosRT); atmos.render(renderer);

      if (Q.dof) {
        const f = focus ? camera.position.distanceTo(focus) : 7;
        const u = dof.material.uniforms;
        syncP(u);
        u.uFarScale.value = THREE.MathUtils.clamp(7 / f, 1, 3);   // close-ups: stronger background bokeh
        u.uNearScale.value = THREE.MathUtils.clamp(8 / f, 0.25, 1);   // wide/high shots: no tilt-shift miniature at the bottom
        u.uFocus.value = f; u.uBandN.value = Math.max(P.bandNear, f * 0.22); u.uBandF.value = Math.max(P.bandFar, f * 0.6);
        renderer.setRenderTarget(dofRT); dof.render(renderer);
      }

      bloom.strength = P.bloom; bloom.radius = P.bloomRadius; bloom.threshold = P.bloomThreshold;
      bloom.highPassUniforms.smoothWidth.value = P.bloomKnee; bloom.highPassUniforms.uCool.value = P.bloomCool;
      bloom.render(renderer, null, Q.dof ? dofRT : atmosRT, 1 / 60, false);

      const g = fin.material.uniforms;
      syncP(g);
      g.uTime.value = time; g.uFlash.value = flash;
      // Lottes curve constants: tmMidIn → tmMidOut and tmMax → 1
      const ta = P.tmContrast, ad = ta * P.tmShoulder, mi = P.tmMidIn, mo = P.tmMidOut, hm = P.tmMax, den = (hm ** ad - mi ** ad) * mo;
      g.uTmB.value = (hm ** ta * mo - mi ** ta) / den;
      g.uTmC.value = (hm ** ad * mi ** ta - hm ** ta * mi ** ad * mo) / den;
      renderer.setRenderTarget(null); fin.render(renderer);
    },
  };
}
