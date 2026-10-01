// Shared parts for FloodClear: the hydrology (runoff by the SCS curve-number method, a unit
// hydrograph, Manning's equation for a river and its floodplain, Gumbel flood statistics, the odds
// of a rare flood, and the push of moving water on people and cars) plus small scene helpers
// (boards, rain, houses, trees, a valley cross-section). Sources are given beside each formula.
// +x right, +y up, +z towards you.
import { THREE, M, box, canvasTexture, clamp, swarm } from './kit.js';

// ---------------------------------------------------------------- constants
export const G = 9.81;            // m/s²
export const RHO = 1000;          // kg/m³, fresh water (muddy flood water is a little denser)
export const M3S_PER_MMH_KM2 = 1 / 3.6;   // 1 mm an hour falling on 1 km² is 0.278 m³ a second

// ---------------------------------------------------------------- where the rain goes
// The SCS (now NRCS) curve-number method, USDA National Engineering Handbook Part 630, ch. 10,
// and Technical Release 55 (1986). For a storm of depth P (mm):
//   S  = 25,400 ÷ CN − 254      the most the ground can hold back, mm
//   Ia = 0.2 S                  caught on leaves, in puddles and in the first wetting, before any runoff
//   Q  = (P − Ia)² ÷ (P − Ia + S)   runoff, mm, once P > Ia
// CN runs from about 30 (deep, open, thirsty soil) to 100 (a sheet of glass).
// Curve numbers below are TR-55 Table 2-2 values for hydrologic soil group B (a middling loam):
//   woods in good condition 55; row crops, straight rows, good condition 78; fallow bare soil 86;
//   paved streets, roofs and parking 98; a town centre that is 85 % hard surface 92.
export const SURFACES = {
  forest: { name: 'Forest', cn: 55, col: 0x2f7d47 },
  farm: { name: 'Farmland', cn: 78, col: 0x9aa84a },
  bare: { name: 'Bare soil', cn: 86, col: 0x9a7448 },
  city: { name: 'Paved city', cn: 98, col: 0x6d727c },
  town: { name: 'Town centre', cn: 92, col: 0x7a7f88 },
};
// How wet the ground already is (antecedent moisture). Conversions from Chow, Maidment and Mays,
// Applied Hydrology (1988), eqs 5.5.6 and 5.5.7: dry CN(I) = 4.2 CN ÷ (10 − 0.058 CN),
// soaked CN(III) = 23 CN ÷ (10 + 0.13 CN).
export function cnFor(cn, wet) {
  if (wet === 'dry') return (4.2 * cn) / (10 - 0.058 * cn);
  if (wet === 'soaked') return (23 * cn) / (10 + 0.13 * cn);
  return cn;
}
export function runoff(P, cn) {
  const S = 25400 / cn - 254, Ia = 0.2 * S;
  const Q = P > Ia ? ((P - Ia) * (P - Ia)) / (P - Ia + S) : 0;
  const caught = Math.min(P, Ia);
  return { S, Ia, Q, caught, soak: Math.max(0, P - caught - Q), share: P > 0 ? Q / P : 0 };
}

// ---------------------------------------------------------------- the river's pulse
// Lag between the middle of the rain and the peak of the flow, NRCS lag equation
// (NEH Part 630, ch. 15, eq. 15-4a): lag (h) = L^0.8 (S + 1)^0.7 ÷ (1,900 √Y), with L the longest
// flow path in feet, S = 1,000 ÷ CN − 10 in inches and Y the average land slope in per cent.
// It is meant for small catchments (up to about 8 km²), which is the size used here.
export function lagHours(cn, lengthM, slopePct) {
  const L = lengthM * 3.2808, S = 1000 / cn - 10;
  return (Math.pow(L, 0.8) * Math.pow(S + 1, 0.7)) / (1900 * Math.sqrt(slopePct));
}
// A storm hydrograph. Rain falls evenly for `hours`. Each small step of runoff (curve-number method
// on the running total) is turned into flow with a unit hydrograph shaped like the NRCS
// dimensionless one: q ∝ (t/Tp)^3.7 exp(3.7 (1 − t/Tp)), a gamma curve with peak-rate factor 484
// (NEH Part 630, ch. 16). An optional store (wetland, pond or reservoir) is a linear reservoir:
// outflow = storage ÷ K.
export const CATCH = { area: 8, length: 5000, slope: 2, base: 0.4 };   // km², m, %, m³/s
export function hydrograph({ rain, hours, cn, lagMul = 1, storeK = 0, dt = 0.1, T = 30 }) {
  const n = Math.round(T / dt), lag = lagHours(cn, CATCH.length, CATCH.slope) * lagMul;
  const Tp = dt / 2 + lag, m = 3.7;
  const uh = []; let sum = 0;
  for (let i = 0; i * dt < Tp * 6 && i < n; i++) { const x = ((i + 0.5) * dt) / Tp, v = Math.pow(x, m) * Math.exp(m * (1 - x)); uh.push(v); sum += v; }
  const q = new Float32Array(n), rainRate = new Float32Array(n), ro = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t1 = (i + 1) * dt;
    if (i * dt >= hours) break;
    const P = (rain * Math.min(t1, hours)) / hours, Q = runoff(P, cn).Q, dQ = Q - prev; prev = Q;
    rainRate[i] = rain / hours; ro[i] = dQ / dt;
    // dQ mm over the catchment = dQ × area × 1,000 m³, spread over the unit hydrograph.
    const vol = dQ * CATCH.area * 1000;
    for (let k = 0; k < uh.length && i + k < n; k++) q[i + k] += ((vol * uh[k]) / sum) / (dt * 3600);
  }
  if (storeK > 0) { let o = 0; const a = 1 - Math.exp(-dt / storeK); for (let i = 0; i < n; i++) { o += (q[i] - o) * a; q[i] = o; } }
  let peak = 0, iPeak = 0;
  for (let i = 0; i < n; i++) { q[i] += CATCH.base; if (q[i] > peak) { peak = q[i]; iPeak = i; } }
  return { q, rainRate, ro, dt, n, T, lag, peak, tPeak: (iPeak + 0.5) * dt, runoff: prev, at: (t) => q[clamp(Math.floor(t / dt), 0, n - 1)] };
}

// Manning's equation (Robert Manning, 1889): flow = area × R^(2/3) × √slope ÷ n, where R is the
// area divided by the wetted edge and n is the roughness (about 0.035 for a natural channel,
// 0.06 for a floodplain of crops and scrub; Chow, Open-Channel Hydraulics, 1959).
// The river is a box-shaped channel with a flat floodplain on each side. Once over its banks the
// channel and each floodplain carry water side by side (the divided-channel method).
//   c = { bw, bd, slope, n, nfp, fpL, fpR, wallL, wallR }   widths and depths in metres
export function sectionFlow(y, c) {
  if (y <= 0) return 0;
  const sq = Math.sqrt(c.slope), A = c.bw * y, P = c.bw + 2 * Math.min(y, c.bd);
  let Q = (A * Math.pow(A / P, 2 / 3) * sq) / c.n;
  if (y > c.bd) {
    const h = y - c.bd;
    for (const [w, wall] of [[c.fpL, c.wallL], [c.fpR, c.wallR]]) {
      if (w <= 0) continue;
      const a = w * h, p = w + (wall ? h : 0);
      Q += (a * Math.pow(a / p, 2 / 3) * sq) / c.nfp;
    }
  }
  return Q;
}
export function stageFor(Q, c) {         // depth above the bed that carries flow Q
  let lo = 0, hi = 40;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (sectionFlow(mid, c) < Q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export const bankfull = (c) => sectionFlow(c.bd, c);

// ---------------------------------------------------------------- odds
// Chance of at least one flood of return period T in N years: 1 − (1 − 1/T)^N.
export const chance = (T, N) => 1 - Math.pow(1 - 1 / T, N);
// Gumbel (1941) distribution of each year's biggest flood: the T-year flood is
// u − α ln(−ln(1 − 1/T)), with α = σ √6 ÷ π and u = mean − 0.5772 α.
export function gumbelQ(T, mean, sd) {
  const a = (sd * Math.sqrt(6)) / Math.PI, u = mean - 0.5772 * a;
  return u - a * Math.log(-Math.log(1 - 1 / T));
}

// ---------------------------------------------------------------- moving water, people and cars
// People: flood-safety guidance grades the hazard by depth × speed. Australian Rainfall and Runoff
// (2019), Book 6, ch. 7, after Cox, Shand and Blacka (2010): above about 0.4 m²/s is unsafe for
// children, above 0.6 m²/s for most adults, above 0.8 m²/s (the limit quoted in the guidance) for
// everyone. Depth and speed alone also count: above 0.5 m deep for children, 1.2 m for adults, and
// faster than 3 m/s for anyone.
// The push on the legs is ordinary drag, ½ ρ Cd A v², with Cd about 1.2 and legs about 0.3 m wide.
export function personHazard(d, v) {
  const dv = d * v, push = 0.5 * RHO * 1.2 * (0.3 * Math.min(d, 1.7)) * v * v;
  const level = dv > 0.8 || d > 1.2 || (v > 3 && d > 0.1) ? 3 : dv > 0.6 ? 2 : dv > 0.4 || d > 0.5 ? 1 : 0;
  return { dv, push, level };
}
// Cars: water under the floor lifts the car (Archimedes, see BuoyancyClear), so the tyres press
// less and grip less, while the flow pushes on the side. A car slides when the push beats the grip,
// and floats when the lift equals its weight. This is the simple balance used by Shu and others
// (2011) and Xia and others (2014); real cars leak and tilt, so treat the figures as rough.
// Small hatchback: 1,000 kg, floor 3.7 m × 1.6 m × 0.85, 0.17 m ground clearance.
// SUV: 1,900 kg, floor 4.6 m × 1.85 m × 0.85, 0.21 m clearance. Wet-road friction 0.3.
export const CARS = {
  small: { name: 'Small car', kg: 1000, len: 3.7, floor: 3.7 * 1.6 * 0.85, clear: 0.17 },
  suv: { name: 'SUV', kg: 1900, len: 4.6, floor: 4.6 * 1.85 * 0.85, clear: 0.21 },
};
export function carHazard(d, v, car) {
  const W = car.kg * G, lift = Math.min(W, RHO * G * car.floor * Math.max(0, d - car.clear));
  const area = car.len * (0.3 * Math.min(d, car.clear) + Math.max(0, d - car.clear));
  const push = 0.5 * RHO * 1.1 * area * v * v, grip = 0.3 * (W - lift);
  return { lift: lift / W, push, grip, state: lift >= W * 0.999 ? 2 : push > grip ? 1 : 0, floatAt: car.clear + car.kg / (RHO * car.floor) };
}

// ---------------------------------------------------------------- formatting and boards
export const fmtN = (v, d = 0) => v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
export const inReel = () => document.body.classList.contains('gb-reel');
export const COL = { water: '#4aa8ff', rain: '#9fd0ff', soil: '#c79a5a', leaf: '#5ce1a9', warm: '#ffb547', hot: '#ff7a59', bad: '#ff5a8a', ok: '#5ce1a9', e: '#8ef0ff', gold: '#ffe27a', soft: 'rgba(255,255,255,.6)', text: '#e8eef8' };
export const HEX = { water: 0x2f86d8, flood: 0x8a7a5a, rain: 0x9fd0ff, grass: 0x5f9a4c, field: 0x9aa84a, soil: 0x7a5a3a, rock: 0x8a8f98, town: 0xe9d8b8, roof: 0x8a4a32, bank: 0x8b6a3f };

export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h); }
export function board(root, w, h, pxW, pxH, draw, pos) {
  const tex = canvasTexture(pxW, pxH, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(...pos); root.add(m);
  return Object.assign(tex, { mesh: m });
}
export function title(g, text, sub = '') {
  g.fillStyle = COL.text; g.font = 'bold 31px sans-serif'; g.fillText(text, 24, 44);
  if (sub) { g.font = '21px sans-serif'; g.fillStyle = COL.soft; g.fillText(sub, 24, 76); }
}
export function axes(g, w, h, { x0 = 96, x1 = w - 30, y0 = h - 74, y1 = 104, xMax, yMax, xMin = 0, yMin = 0, xTicks, yTicks, xFmt = String, yFmt = String, xLabel = '', yLabel = '' }) {
  const X = (x) => x0 + ((x - xMin) / (xMax - xMin)) * (x1 - x0);
  const Y = (y) => y0 - ((y - yMin) / (yMax - yMin)) * (y0 - y1);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.fillStyle = COL.soft; g.font = '21px sans-serif';
  for (const t of xTicks) { g.beginPath(); g.moveTo(X(t), y1); g.lineTo(X(t), y0); g.stroke(); const s = xFmt(t); g.fillText(s, X(t) - g.measureText(s).width / 2, y0 + 28); }
  for (const t of yTicks) { g.beginPath(); g.moveTo(x0, Y(t)); g.lineTo(x1, Y(t)); g.stroke(); const s = yFmt(t); g.fillText(s, x0 - 10 - g.measureText(s).width, Y(t) + 7); }
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '20px sans-serif';
  if (xLabel) g.fillText(xLabel, x1 - g.measureText(xLabel).width, y0 + 58);
  if (yLabel) g.fillText(yLabel, x0 + 8, y1 - 12);
  return { X, Y, x0, x1, y0, y1 };
}
export function dot(g, x, y, col, r = 9) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
// Wrap text on a canvas. Returns the y of the line after the last one.
export function wrap(g, text, x, y, maxW, lh) {
  let line = '';
  for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t; }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}
// Boards are 900 × 600 px canvases on planes BW wide.
export const BW = 5.7, BH = 3.8, BPX = [900, 600];
const TAN = 2 * Math.tan((21 * Math.PI) / 180);        // the stage camera's field of view is 42°
// Move the camera so that a box w wide and h high, centred on target, fills the stage whatever its
// shape. The kit backs the camera off by k on narrow stages, so that is divided out here.
export function frame(stage, { w, h, target, pitch = 0.09 }) {
  if (inReel() || stage.moved) return;
  const a = stage.camera.aspect, k = Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, a)));
  const d = (Math.max(h / TAN, w / (TAN * a)) * 1.03) / k, len = Math.hypot(pitch, 1);
  const pos = [target[0], target[1] + (pitch / len) * d, target[2] + d / len], hm = stage.home;
  if (!hm || Math.abs(hm.pos[1] - pos[1]) + Math.abs(hm.pos[2] - pos[2]) + Math.abs(hm.target[1] - target[1]) > 0.05) stage.setView(pos, target, 0.6);
}
// One layout for the chapters with a chart: the readout sits at the upper left, so the board goes
// to the right, just above the model, and the model runs along the bottom. On phones the board and
// minor labels are hidden and the model is framed alone, lower down. In the video the board is
// centred above the model. modelTop is the height of the model; bs scales the board; overlap lets
// the board dip into empty space above the right-hand side of the model.
// The hub's bar covers the bottom edge of the stage, so a margin is left below the model.
const reelScale = (bs) => Math.min(1.16 * bs, 7.2 / BW);
export function layout(stage, brd, { minor = [], w = 11.6, modelTop = 4.6, bs = 1, overlap = 0, base = 0, bz = -1.6 } = {}) {
  const narrow = stage.host.clientWidth < 560, reel = inReel();
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const sy = reel ? 0 : narrow ? -0.2 : 0;
  if (!stage.shift || stage.shift[0] !== 0 || stage.shift[1] !== sy) stage.setShift(0, sy);
  // In a tall video frame there is room above the model, so the board is made nearly full width.
  const sc = reel ? (stage.camera.aspect < 0.8 ? 10.4 / BW : reelScale(bs)) : bs, y0 = modelTop + 0.35 - overlap;
  brd.mesh.visible = !narrow || reel; brd.mesh.scale.setScalar(sc);
  brd.mesh.position.set(reel ? 0 : w / 2 - 0.2 - (BW * sc) / 2, y0 + (BH * sc) / 2, bz);
  if (reel) return narrow;
  const h = (narrow ? modelTop + 1.6 : y0 + BH * sc + 1.25) + base, V = Math.max(h, w / stage.camera.aspect) * 1.03;
  frame(stage, { w, h, target: [0, narrow ? modelTop / 2 - 0.3 - base / 2 : V / 2 - 0.9 - base, 0] });
  return narrow;
}
// The view for video scenes in those chapters. It has to fit a wide, a square and a tall frame.
export function reelView(modelTop, bs = 1, overlap = 0, base = 0) {
  const top = modelTop + 0.35 - overlap + BH * reelScale(bs), h = top + 0.7 + base, d = Math.max(10.8, (h / TAN) * 1.03);
  return { pos: [0, h / 2 - 0.25 - base + d * 0.09, d], target: [0, h / 2 - 0.25 - base, 0] };
}
// For chapters without a chart: nudge the picture right and down to clear the readout.
export function fitNarrow(stage, minor = [], drop = 0.2, right = 0.09) {
  const narrow = stage.host.clientWidth < 560;
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const x = narrow || inReel() ? 0 : right, y = inReel() ? 0 : narrow ? -drop : -0.07;
  if (!stage.shift || stage.shift[0] !== x || stage.shift[1] !== y) stage.setShift(x, y);
  return narrow;
}
// The readout's small print is left out on phones, where the readout would cover the model.
export const fine = (html) => (window.innerWidth < 560 ? '' : html);
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- scene helpers
export const waterMat = (color = HEX.water, opacity = 0.78) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.18, metalness: 0, depthWrite: false });

export function house(w = 0.5, col = HEX.town, roof = HEX.roof) {
  const g = new THREE.Group(), b = box(w, w * 0.8, w * 1.1, M.matte(col));
  const rf = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, w * 0.55, 4), M.matte(roof));
  b.position.y = w * 0.4; rf.position.y = w * 1.07; rf.rotation.y = Math.PI / 4; rf.scale.z = 1.15; rf.castShadow = true;
  g.add(b, rf);
  return g;
}
export function block(w, h, d, col = 0xcfd3da) {             // a flat-roofed town building with window bands
  const g = new THREE.Group(), b = box(w, h, d, M.matte(col)); b.position.y = h / 2; g.add(b);
  const n = Math.max(1, Math.floor(h / 0.28));
  for (let i = 0; i < n; i++) { const s = box(w * 1.01, 0.05, d * 1.01, M.matte(0x3a4a66)); s.position.y = 0.2 + i * 0.28; s.castShadow = false; g.add(s); }
  return g;
}
export function tree(s = 1, color = 0x2f7d47) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.4 * s, 6), M.matte(0x6a4a2e));
  const cr = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.55 * s, 7), M.matte(color));
  tr.position.y = 0.2 * s; cr.position.y = 0.62 * s; cr.castShadow = true;
  g.add(tr, cr);
  return g;
}
export function person(s = 1, shirt = 0xd8a23a) {
  const g = new THREE.Group(), skin = M.matte(0xb98562);
  const legs = box(0.26 * s, 0.8 * s, 0.16 * s, M.matte(0x33415c)); legs.position.y = 0.4 * s;
  const body = box(0.34 * s, 0.6 * s, 0.2 * s, M.matte(shirt)); body.position.y = 1.1 * s;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 14, 10), skin); head.position.y = 1.56 * s; head.castShadow = true;
  g.add(legs, body, head);
  return g;
}
export function car(c, col = 0xd94f4f) {                      // c from CARS; drawn at true size in metres
  const g = new THREE.Group(), w = c.floor / 0.85 / c.len, h = c === CARS.suv ? 0.75 : 0.6;
  const body = box(c.len, h, w, M.plastic(col)); body.position.y = c.clear + h / 2;
  const cab = box(c.len * 0.55, h * 0.8, w * 0.9, M.plastic(0x1c2330)); cab.position.set(-c.len * 0.05, c.clear + h + h * 0.4, 0);
  g.add(body, cab);
  const r = c.clear + 0.14;
  for (const [x, z] of [[-0.32, -0.5], [0.32, -0.5], [-0.32, 0.5], [0.32, 0.5]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 16), M.matte(0x14161a));
    wh.rotation.x = Math.PI / 2; wh.position.set(x * c.len, r, z * w); wh.castShadow = true; g.add(wh);
  }
  return g;
}

// Rain: thin streaks falling inside a box. set(k) shows a share k (0 to 1) of them.
export function makeRain(root, n, b, { color = HEX.rain, len = 0.32, slant = 0.12, speed = 9 } = {}) {
  const sw = swarm(n, new THREE.BoxGeometry(0.018, len, 0.018), M.glow(color, { transparent: true, opacity: 0.75 }));
  sw.castShadow = false; sw.frustumCulled = false; root.add(sw);
  const r = rng(n + 3), p = [];
  for (let i = 0; i < n; i++) p.push([b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), b.z0 + r() * (b.z1 - b.z0), 0.8 + r() * 0.4]);
  return {
    mesh: sw,
    update(dt, k, floor = null) {
      const show = Math.round(clamp(k, 0, 1) * n);
      for (let i = 0; i < n; i++) {
        const q = p[i];
        q[1] -= dt * speed * q[3]; q[0] += dt * speed * slant * q[3];
        const y0 = floor ? floor(q[0], q[2]) : b.y0;
        if (q[1] < y0 || q[0] > b.x1) { q[1] = b.y1 - r() * 0.4; q[0] = b.x0 + r() * (b.x1 - b.x0); q[2] = b.z0 + r() * (b.z1 - b.z0); }
        sw.place(i, q, [0, 0, -slant], i < show ? 1 : 0.0001);
      }
      sw.done();
    },
  };
}
// A flat grey rain cloud made of a few squashed spheres.
export function cloud(w = 4, col = 0x6f7a8c) {
  const g = new THREE.Group(), r = rng(Math.round(w * 10)), mat = new THREE.MeshStandardMaterial({ color: col, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + r() * 0.35, 14, 10), mat); s.position.set((i / 8 - 0.5) * w, (r() - 0.5) * 0.25, (r() - 0.5) * 0.9); s.scale.set(1.5, 0.75, 1.3); g.add(s); }
  return g;
}

// A river valley cut across: a box channel, a flat floodplain each side, valley sides at the edges.
// Lengths are in metres; sx and sy turn them into scene units (the height is stretched, and the
// chapters say so). Y(0) is the floodplain, Y(−bd) the river bed.
export function makeSection(root, { bw, bd, fpL, fpR, sx, sy, D = 3, y0 = 1.2, soil = 0x7d6a4c, grassL = HEX.field, grassR = HEX.grass }) {
  const X = (m) => m * sx, Y = (m) => y0 + m * sy;
  const g = new THREE.Group(); root.add(g);
  const xl = -bw / 2 - fpL, xr = bw / 2 + fpR, rise = bd * 3.2, run = (rise * sy * 0.9) / sx;   // valley sides
  const pts = [[xl - run, -bd * 3 - 99], [xl - run, rise], [xl, 0], [-bw / 2, 0], [-bw / 2, -bd], [bw / 2, -bd], [bw / 2, 0], [xr, 0], [xr + run, rise], [xr + run, -bd * 3 - 99]];
  const sh = new THREE.Shape(pts.map(([x, m]) => new THREE.Vector2(X(x), Math.max(0.02, Y(m)))));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false }); geo.translate(0, 0, -D / 2);
  const ground = new THREE.Mesh(geo, M.matte(soil)); ground.receiveShadow = true; g.add(ground);
  // Thin coloured skins: fields on the left, grass on the right.
  const skin = (x0, x1, col) => { const s = box(X(x1 - x0), 0.02, D, M.matte(col)); s.position.set(X((x0 + x1) / 2), Y(0) + 0.011, 0); s.castShadow = false; g.add(s); return s; };
  skin(xl, -bw / 2, grassL); skin(bw / 2, xr, grassR);
  const wm = waterMat();
  const mk = (mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, D * 0.998), mat); m.renderOrder = 2; g.add(m); return m; };
  const sm = waterMat(0x6f93b8, 0.8), river = mk(wm), over = mk(wm), sides = [mk(sm), mk(sm)];
  const span = (m, x0, x1, m0, m1) => { m.visible = x1 > x0 && m1 > m0 + 1e-4; if (!m.visible) return; m.scale.set(X(x1 - x0), (m1 - m0) * sy, 1); m.position.set(X((x0 + x1) / 2), Y((m0 + m1) / 2), 0); };
  return {
    group: g, X, Y, xl, xr, D,
    // depth above the bed; the water over the banks spreads from x0 to x1 (metres from the centre).
    setWater(y, x0 = xl, x1 = xr) { span(river, -bw / 2, bw / 2, -bd, Math.min(y - bd, 0)); span(over, x0, x1, 0, y - bd); },
    // standing water over part of the floodplain (behind a breached embankment).
    setSide(x0, x1, depth, i = 0) { span(sides[i], x0, x1, 0, depth); },
    // an earth embankment: crest at height h (m) above the floodplain, centred at x (m).
    bund(x, h, col = HEX.bank) {
      const wTop = 0.1, wBase = wTop + h * sy * 1.6;
      const s = new THREE.Shape([[-wBase / 2, 0], [-wTop / 2, h * sy], [wTop / 2, h * sy], [wBase / 2, 0]].map(([a, b]) => new THREE.Vector2(a, b)));
      const e = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false }); e.translate(0, 0, -D / 2);
      const m = new THREE.Mesh(e, M.matte(col)); m.castShadow = true; m.position.set(X(x), Y(0), 0); g.add(m);
      return m;
    },
  };
}

// ---------------------------------------------------------------- a rough map of India
// Hand-drawn outline and rivers as [longitude, latitude]. Good enough to place events; it is not
// a survey map and shows no borders.
export const INDIA = [[68.2, 23.6], [70, 21], [72.5, 21], [73, 19], [74, 15], [76, 10], [77.5, 8.1], [78.2, 8.9], [79, 9.3], [79.9, 10.3], [79.9, 11.5], [80.3, 13.1], [80.1, 14], [80.3, 15.5], [81.2, 16.2], [82.3, 16.8], [83.3, 17.7], [84.1, 18.3], [85, 19.3], [85.9, 19.8], [86.7, 20.3], [87, 21.2], [87.5, 21.6], [88.2, 21.7], [89, 21.8], [88.8, 24.5], [89.8, 26], [92, 25.2], [92.3, 23.5], [93.3, 24], [94.6, 25.5], [97, 27.8], [95.5, 29], [92, 27.8], [88.8, 27.3], [88, 26.5], [84, 27.3], [80.2, 28.8], [81, 30.2], [78.8, 31.2], [78.5, 34.5], [75, 34.6], [73.9, 32.5], [74.6, 31], [73, 29.5], [70.3, 27.8], [70, 25.5], [71, 24.5]];
export const RIVERS = {
  Ganga: [[79, 30.9], [78.2, 29.9], [79.5, 27.5], [80.3, 26.5], [81.9, 25.4], [83, 25.3], [85.1, 25.6], [87.2, 25.4], [87.9, 24.8], [89.2, 23.8], [90.3, 23.2], [90.6, 22.4]],
  Brahmaputra: [[82, 30.4], [85.5, 29.3], [88.9, 29.3], [92, 29.3], [94.9, 29.5], [95.3, 28.1], [94.9, 27.5], [93, 26.7], [91.7, 26.2], [90, 26], [89.7, 24.6], [90.3, 23.2]],
  Kosi: [[86.9, 27.8], [87.1, 27], [86.95, 26.5], [86.9, 25.9], [87.2, 25.4]],
  Teesta: [[88.2, 27.9], [88.65, 27.6], [88.45, 26.9], [88.8, 26.3], [89.6, 25.6]],
  Yamuna: [[78.4, 31], [77.2, 28.6], [78, 27.2], [79.5, 26.2], [81.9, 25.4]],
};
