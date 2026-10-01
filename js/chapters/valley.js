// Chapter 1: a river and its valley. A model catchment of 40 km²: hills, streams, a river, a
// floodplain with fields and a town, and an optional embankment.
//   Water balance: rain falling on the catchment = rain rate × area (1 mm/h on 1 km² = 0.278 m³/s).
//   A share of it runs off; the rest is caught, soaks in or evaporates. The shares used here
//   (15 %, 35 %, 65 % for dry, wet and soaked ground) are round, typical values for a rural
//   catchment (runoff coefficients in Chow, Maidment and Mays, Applied Hydrology, 1988, table 15.1.1,
//   run from about 0.1 to 0.6); chapter 2 works the share out properly.
//   If the rain kept up, the river would settle at runoff share × rain × area. The model moves the
//   river towards that flow with a delay, because water takes time to travel.
//   River level from Manning's equation (flood.js): channel 20 m wide and 2.5 m deep, slope 1 in
//   1,000, floodplain 250 m wide on each side. With the embankment, the town side is cut to 20 m.
// Runoff dots really do roll downhill: each one follows the steepest slope of the terrain grid.
import { THREE, M, tube, swarm, clamp, approach, smooth } from '../kit.js';
import { stageFor, bankfull, M3S_PER_MMH_KM2, makeRain, house, block, cloud, waterMat, fitNarrow, fine, fmtN, rng, inReel, HEX } from '../flood.js';

const AREA = 40, BASE = 8, CREST = 1.5;                       // km², m³/s, m above the floodplain
const SEC = { bw: 20, bd: 2.5, slope: 0.001, n: 0.035, nfp: 0.06 };
const OPEN = { ...SEC, fpL: 250, fpR: 250 }, BUND = { ...SEC, fpL: 250, fpR: 20, wallR: 1 };
const SHARE = { dry: 0.15, wet: 0.35, soaked: 0.65 };
export const steady = (rain, ground) => BASE + SHARE[ground] * rain * AREA * M3S_PER_MMH_KM2;
const lvlOf = (Q, emb) => stageFor(Q, emb ? BUND : OPEN) - SEC.bd;                   // m above the floodplain
const toScene = (m) => (m < 0 ? m * 0.12 : m * 0.25);

// ---- terrain
const W = 16, DP = 12, NX = 128, NZ = 96, SLOPE = 0.05;
const xr = (z) => 0.9 * Math.sin(z * 0.55 + 0.4);
const fw = (z) => 0.35 + 2.4 * smooth((z + 5.2) / 4.5);
const TRIBS = [
  [[-7.6, -5.2], [-5.4, -3.6], [-3.2, -2.6], [xr(-1.7) - 0.1, -1.7]],
  [[7.4, -5.6], [5, -4.4], [2.8, -3.7], [xr(-3) + 0.1, -3]],
  [[0.9, -6], [0.3, -4.9], [xr(-3.7), -3.7]],
  [[-7.8, 0.2], [-5.6, 0.9], [-3.6, 1.6], [xr(2.3) - 0.1, 2.3]],
  [[7.8, -2.2], [6, -2.9], [4.2, -3.2], [2.8, -3.7]],
];
function distTo(x, z, line) {
  let best = 1e9;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}
function raw(x, z) {
  const ad = Math.abs(x - xr(z)), head = smooth((-z - 3.6) / 1.4), f = fw(z);
  const t = smooth((ad - f) / 4);
  let h = 2.7 * t * (1 + 0.22 * Math.sin(z * 0.9 + x * 0.7) + 0.12 * Math.sin(z * 2.3 - x * 1.7));
  h = Math.max(h, 2.2 * smooth((-z - 4.2) / 2.2) * (1 + 0.2 * Math.sin(x * 1.1)));
  h += 0.05 * Math.min(1, ad / f);                                   // the floodplain drains gently to the river
  h -= 0.35 * (1 - smooth((ad - 0.14) / 0.26)) * (1 - head);         // the river channel
  let dmin = 1e9; for (const tr of TRIBS) dmin = Math.min(dmin, distTo(x, z, tr));
  h -= Math.min(h * 0.6, 0.55) * Math.exp(-Math.pow(dmin / 0.42, 2)) + 0.07 * Math.exp(-Math.pow(dmin / 0.1, 2));
  return h - z * SLOPE;
}
const H = new Float32Array((NX + 1) * (NZ + 1));
let built = false;
function buildGrid() { if (built) return; built = true; for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) H[j * (NX + 1) + i] = raw((i / NX - 0.5) * W, (j / NZ - 0.5) * DP); }
function hAt(x, z) {
  const fx = clamp((x / W + 0.5) * NX, 0, NX - 0.001), fz = clamp((z / DP + 0.5) * NZ, 0, NZ - 0.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * (NX + 1) + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + NX + 1] * (1 - u) + H[k + NX + 2] * u) * v;
}
const embX = (z) => (z >= -2 ? xr(z) + 0.75 : z >= -2.8 ? xr(z) + 0.75 + ((-2 - z) / 0.8) * 1.7 : 9);

export default {
  id: 'valley',
  short: 'River and valley',
  title: 'A river and its valley',
  subtitle: 'Every drop that lands in a catchment is heading for the same river.',
  view: { pos: [0.5, 9.5, 13.5], target: [0.3, 0.6, 0.2] },
  learn: `<p>A flood is simple to say: <b>water arrives faster than it can leave</b>. To see why, start with the land.</p>
    <p>A <b>catchment</b> (or river basin) is all the land that slopes towards one river. Rain that falls inside its edge, the <b>divide</b>, can only go three ways: it can <b>soak in</b>, it can <b>evaporate</b>, or it can <b>run off</b> downhill.</p>
    <p>Runoff gathers. Trickles join into <b>streams</b>, streams (tributaries) join the <b>river</b>, and the river carries the water of the whole catchment through one channel. The model's catchment is 40 km². Rain of just 10 mm an hour drops over <b>110 tonnes of water every second</b> on it.</p>
    <p>A river channel is only big enough for the flow it sees most years. In the bigger floods, every few years, the water <b>spills over the banks</b> and spreads across the flat land beside it. That flat land is the <b>floodplain</b>. The river built it, one layer of silt at a time, and it is the river's own space. Its soil is rich and level, which is exactly why people farm it and build towns on it.</p>
    <p>An <b>embankment</b> (a bund or levee) is an earth wall that keeps the river off part of its floodplain. It works for ordinary floods. Chapter 5 shows its trap.</p>
    <p>How rain forms is in <a href="https://glassbox.how/stormclear/" target="_blank" rel="noopener">StormClear</a>. This box follows the water after it lands.</p>
    <p class="tip"><b>Try it:</b> set the rain to 30 mm an hour and switch the ground from dry to soaked. Watch the blue runoff dots, then the river. Then add the embankment.</p>`,
  terms: [
    { t: 'Catchment', d: 'All the land that drains to one river. Also called a river basin or watershed.' },
    { t: 'Divide', d: 'The line of high ground round a catchment. Rain on the far side goes to a different river.' },
    { t: 'Runoff', d: 'Rain that flows over the ground instead of soaking in.' },
    { t: 'Tributary', d: 'A stream or river that joins a bigger one.' },
    { t: 'Floodplain', d: 'The flat land beside a river that the river covers when it floods.' },
    { t: 'Bankfull', d: 'The flow that just fills the channel to the top of its banks.' },
    { t: 'Embankment', d: 'A raised earth wall along a river to keep floods off the land behind. Also called a bund, levee or dyke.' },
  ],
  defaults: { rain: 8, ground: 'wet', emb: false },
  controls: [
    { key: 'rain', type: 'range', label: 'Rain over the catchment', min: 0, max: 60, step: 1, fmt: (v) => `${v} mm an hour` },
    { key: 'ground', type: 'seg', label: 'The ground is', options: [{ v: 'dry', label: 'Dry' }, { v: 'wet', label: 'Wet' }, { v: 'soaked', label: 'Soaked' }] },
    { key: 'emb', type: 'toggle', label: 'Embankment along the town', hint: 'An earth wall 1.5 m high, close to the river bank.' },
    { key: 'go', type: 'buttons', label: 'Try', items: [
      { label: 'Steady drizzle', act: (s) => Object.assign(s, { rain: 5, ground: 'wet' }) },
      { label: 'Monsoon downpour', act: (s) => Object.assign(s, { rain: 35, ground: 'soaked' }) },
      { label: 'Stop the rain', act: (s) => { s.rain = 0; } },
    ] },
  ],
  quiz: [
    { q: 'What is a catchment?', options: ['A tank that stores rain', 'All the land that drains to one river', 'The deepest part of a river', 'A kind of dam'], answer: 1, why: 'Every slope inside the divide sends its runoff to the same river, so the river carries the rain of the whole area.' },
    { q: 'Why is the floodplain flat and fertile?', options: ['Farmers levelled it', 'The river built it from silt left by past floods', 'Wind blew soil there', 'It was once a road'], answer: 1, why: 'Each flood spreads out, slows down and drops its silt. Over thousands of years that builds a flat, rich plain: the river’s own space.' },
    { q: 'The same rain falls on dry ground and on soaked ground. Which sends more water to the river?', options: ['Dry ground', 'Soaked ground', 'Both the same', 'Neither sends any'], answer: 1, why: 'Soaked soil has no room left, so most of the rain runs off. That is why the worst floods often come late in a wet spell.' },
  ],
  reel: [
    { ms: 5500, caption: 'A river carries the rain of its whole catchment: every slope and stream that drains to it.', set: { rain: 6, ground: 'wet', emb: false }, view: { pos: [0.5, 9.5, 14], target: [0.3, 0.8, 0.2] }, spin: 0.5 },
    { ms: 6000, caption: 'When rain runs off faster than the channel can carry it, the river takes back its floodplain.', set: { rain: 10, ground: 'soaked', emb: false }, anim: { rain: [10, 55] }, view: { pos: [3, 7, 12.5], target: [0.4, 0.4, 0.8] }, spin: 0.3 },
  ],

  build({ stage }) {
    buildGrid();
    const root = new THREE.Group(); stage.root.add(root);
    stage.floor.visible = false;
    // ---- terrain mesh with painted colours
    const geo = new THREE.PlaneGeometry(W, DP, NX, NZ); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const cFlood = new THREE.Color(0x5a8f45), cBed = new THREE.Color(0xb7a47a), cHill = new THREE.Color(0x356b3c), cTop = new THREE.Color(0x8a826c);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = hAt(x, z), rel = h + z * SLOPE, ad = Math.abs(x - xr(z));
      pos.setY(i, h);
      if (rel < -0.06 && ad < 0.5) c.copy(cBed); else if (rel < 0.14) c.copy(cFlood); else c.copy(cHill).lerp(cTop, smooth((rel - 1.3) / 1.8));
      c.offsetHSL(0, 0, (Math.sin(x * 7.1 + z * 3.3) + Math.sin(x * 2.7 - z * 5.9)) * 0.012);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); land.receiveShadow = true; root.add(land);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, DP), M.matte(0x4c3f2e)); skirt.position.y = -0.95; root.add(skirt);

    // ---- streams
    const sMat = M.glow(0x58b4ff);
    TRIBS.forEach((tr) => { const pts = []; for (let i = 0; i < tr.length - 1; i++) for (let k = 0; k < 8; k++) { const u = k / 8, x = tr[i][0] + (tr[i + 1][0] - tr[i][0]) * u, z = tr[i][1] + (tr[i + 1][1] - tr[i][1]) * u; pts.push([x, hAt(x, z) + 0.03, z]); } const m = tube(pts, 0.035, sMat, false, 80); m.castShadow = false; root.add(m); });

    // ---- trees on the hills
    const r = rng(21), trees = swarm(260, new THREE.ConeGeometry(0.16, 0.5, 6), M.matte(0x2c6b3c)); root.add(trees);
    let n = 0, guard = 0;
    while (n < 260 && guard++ < 6000) { const x = (r() - 0.5) * (W - 0.6), z = (r() - 0.5) * (DP - 0.6), rel = hAt(x, z) + z * SLOPE; if (rel < 0.45 || rel > 2.6) continue; let near = 1e9; for (const tr of TRIBS) near = Math.min(near, distTo(x, z, tr)); if (near < 0.3) continue; trees.place(n++, [x, hAt(x, z) + 0.24, z], null, 0.7 + r() * 0.7); }
    trees.done();

    // ---- fields on the left bank, a town on the right
    const tilt = Math.atan(SLOPE), fcol = [0x9aa84a, 0xc2b04f, 0x7fa04a, 0xb89c4a, 0x86a851];
    for (let j = 0; j < 7; j++) for (let k = 0; k < 2; k++) {
      const z = -0.6 + j * 0.92, x = xr(z) - 0.95 - k * 0.92;
      if (Math.abs(x - xr(z)) > fw(z) - 0.5 || distTo(x, z, TRIBS[3]) < 0.5) continue;
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.02, 0.8), M.matte(fcol[(j * 2 + k) % 5])); f.position.set(x, hAt(x, z) + 0.012, z); f.rotation.x = tilt; f.receiveShadow = true; root.add(f);
    }
    const townPts = [];
    for (let j = 0; j < 6; j++) for (let k = 0; k < 3; k++) {
      const z = 0.3 + j * 0.62 + (r() - 0.5) * 0.15, x = xr(z) + 1.25 + k * 0.52 + (r() - 0.5) * 0.12;
      if (x - xr(z) > fw(z) - 0.25) continue;
      const b = (j + k) % 4 === 0 ? block(0.3, 0.45 + r() * 0.3, 0.3, 0xd9dde4) : house(0.26, r() > 0.5 ? 0xe9d8b8 : 0xd8c4a0);
      b.position.set(x, hAt(x, z), z); b.rotation.y = (r() - 0.5) * 0.5; root.add(b); townPts.push([x, z]);
    }
    // ---- embankment with a wing that ties into high ground
    const ePts = [];
    for (let z = -2.8; z <= 5.95; z += 0.35) { const x = Math.min(embX(z), 7.8); ePts.push([x, hAt(x, z) + CREST * 0.25 - 0.3, z]); }
    const bund = tube(ePts, 0.3, M.matte(HEX.bank), false, 120); root.add(bund);

    // ---- water: ribbons across the valley, one row per step downstream
    const ROWS = 72, z0 = -3.9, z1 = 6;
    const ribbon = (mat) => { const g = new THREE.BufferGeometry(), p = new Float32Array(ROWS * 2 * 3), idx = []; for (let i = 0; i < ROWS - 1; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); const nr = new Float32Array(ROWS * 2 * 3); for (let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.frustumCulled = false; root.add(m); return { m, p, g }; };
    const wm = waterMat(0x2f86d8, 0.82), fm = waterMat(0x4f7da6, 0.86);
    const chan = ribbon(wm), wide = ribbon(fm), town = ribbon(fm);
    const setRibbon = (rb, fx0, fx1, lvl) => { for (let i = 0; i < ROWS; i++) { const z = z0 + ((z1 - z0) * i) / (ROWS - 1), y = -z * SLOPE + lvl, k = i * 6; rb.p[k] = fx0(z); rb.p[k + 1] = y; rb.p[k + 2] = z; rb.p[k + 3] = fx1(z); rb.p[k + 4] = y; rb.p[k + 5] = z; } rb.g.attributes.position.needsUpdate = true; };

    // ---- rain, clouds and runoff
    const rain = makeRain(root, 700, { x0: -8, x1: 8, y0: 0, y1: 7.5, z0: -6, z1: 6 }, { slant: 0.08 });
    const clouds = [[-4, 7.9, -3], [2.5, 8.2, -1], [-1, 7.8, 3], [5, 8, 3.5]].map(([x, y, z], i) => { const cl = cloud(5 + (i % 2), 0x69748a); cl.position.set(x, y, z); root.add(cl); return cl; });
    const ND = 520, dots = swarm(ND, new THREE.SphereGeometry(0.055, 8, 6), M.glow(0x7fd0ff)); dots.castShadow = false; dots.frustumCulled = false; root.add(dots);
    const d = Array.from({ length: ND }, () => ({ x: 0, z: 0, life: 0, soak: false, on: false, river: false, off: 0 }));
    let spawnAcc = 0;

    const minor = [
      stage.label('Hills', [-6.3, hAt(-6.3, -1.5) + 0.7, -1.5], root),
      stage.label('Streams join the river', [-3.4, hAt(-3.4, -2.7) + 0.5, -2.7], root),
      stage.label('Fields', [xr(3.5) - 1.6, hAt(-1.4, 3.5) + 0.35, 3.6], root),
      stage.label('Catchment edge: the divide', [5.6, hAt(6.8, -4.6) + 0.9, -5.2], root),
    ];
    stage.label('Floodplain: the river’s own space', [xr(5) - 0.4, hAt(xr(5) - 1, 5.4) + 0.5, 5.6], root, 'hot');
    const lTown = stage.label('Town', [xr(2) + 1.8, hAt(xr(2) + 1.8, 2) + 0.95, 2], root);
    const lEmb = stage.label('Embankment', [embX(4.6), hAt(embX(4.6), 4.6) + 0.75, 4.6], root);
    minor.push(lEmb);

    let Q = steady(8, 'wet'), townM = -1, trapped = false, time = 0;
    const st = { Q, lvl: 0, town: -1 };
    return {
      update(dt, s) {
        dt = Math.max(0, dt); time += dt;
        fitNarrow(stage, minor, 0.16);
        const share = SHARE[s.ground], Qs = steady(s.rain, s.ground);
        Q = approach(Q, Qs, Qs > Q ? 0.5 : 0.3, dt);
        const lvl = lvlOf(Q, s.emb), L = toScene(lvl);
        // The town side: open floodplain floods with the river. Behind an embankment it stays dry
        // until the crest is passed; then the water is held in and drains only slowly.
        if (!s.emb) { townM = lvl > 0 ? lvl : approach(townM, -0.2, 1.5, dt); trapped = false; }
        else if (lvl > CREST) { trapped = true; townM = approach(Math.max(townM, 0), lvl, 1.2, dt); }
        else townM = trapped ? Math.max(-0.2, townM - dt * 0.05) : -0.2;
        if (townM <= 0) trapped = false;
        st.Q = Q; st.lvl = lvl; st.town = townM;
        bund.visible = s.emb; lEmb.visible = lEmb.visible && s.emb;
        setRibbon(chan, (z) => xr(z) - 0.42, (z) => xr(z) + 0.42, Math.min(L, 0) - 0.005);
        wide.m.visible = lvl > 0.01;
        // The flood spreads sideways until it meets rising ground.
        const edge = (z, dir, lv) => { let x = xr(z); const y = -z * SLOPE + lv; while (Math.abs(x) < 7.9 && hAt(x + dir * 0.15, z) < y) x += dir * 0.15; return x + dir * 0.2; };
        if (wide.m.visible) setRibbon(wide, (z) => edge(z, -1, L), s.emb ? (z) => Math.min(embX(z), edge(z, 1, L)) : (z) => edge(z, 1, L), L);
        town.m.visible = s.emb && townM > 0.01;
        if (town.m.visible) { const tl = toScene(townM); setRibbon(town, (z) => Math.min(embX(z), edge(z, 1, tl)), (z) => edge(z, 1, tl), tl); }
        // rain and clouds
        const k = clamp(s.rain / 60, 0, 1);
        rain.update(dt, Math.pow(k, 0.7), hAt);
        clouds.forEach((cl, i) => { cl.visible = s.rain > 0.5; cl.position.x += dt * 0.12; if (cl.position.x > 8) cl.position.x = -8; cl.scale.setScalar(0.65 + 0.3 * k); });
        // runoff dots
        spawnAcc += dt * s.rain * 5.5;
        for (let i = 0; i < ND; i++) {
          const p = d[i];
          if (!p.on) { if (spawnAcc >= 1) { spawnAcc -= 1; p.on = true; p.river = false; p.x = (Math.random() - 0.5) * (W - 0.4); p.z = (Math.random() - 0.5) * (DP - 0.6); p.soak = Math.random() > share; p.life = p.soak ? 0.9 : 30; p.off = (Math.random() - 0.5) * 0.4; } else { dots.place(i, [0, -5, 0], null, 0.0001); continue; } }
          p.life -= dt;
          if (p.river) { p.z += dt * (1.6 + 1.2 * clamp(Q / 200, 0, 1)); p.x = xr(p.z) + p.off * (lvl > 0 ? 2.2 : 0.7); }
          else if (!p.soak) {
            const e = 0.12, gx = (hAt(p.x + e, p.z) - hAt(p.x - e, p.z)) / (2 * e), gz = (hAt(p.x, p.z + e) - hAt(p.x, p.z - e)) / (2 * e), gm = Math.hypot(gx, gz) || 1e-6, v = clamp(gm * 4, 0.6, 2.6);
            p.x -= (gx / gm) * v * dt; p.z -= (gz / gm) * v * dt;
            if (Math.abs(p.x - xr(p.z)) < 0.2 && p.z > -3.7) p.river = true;
          }
          if (p.life <= 0 || p.z > 5.9 || Math.abs(p.x) > 7.95 || p.z < -5.95) { p.on = false; dots.place(i, [0, -5, 0], null, 0.0001); continue; }
          const y = p.river ? -p.z * SLOPE + Math.max(Math.min(L, 0), L) + 0.03 : hAt(p.x, p.z) + 0.05 - (p.soak ? (0.9 - p.life) * 0.12 : 0);
          dots.place(i, [p.x, y, p.z], null, p.soak ? clamp(p.life / 0.9, 0.05, 1) * 0.8 : 1);
        }
        if (spawnAcc > 40) spawnAcc = 40;
        dots.done();
        lTown.element.innerHTML = townM > 0.05 ? `Town: <b>${townM.toFixed(1)} m under water</b>` : 'Town';
        lTown.element.classList.toggle('hot', townM > 0.05);
      },
      dispose() { stage.floor.visible = true; stage.setShift(0, 0); },
      readout: (s) => {
        const fall = s.rain * AREA * M3S_PER_MMH_KM2, share = SHARE[s.ground], bf = bankfull(OPEN);
        const riv = st.lvl > 0 ? `<b class="no">${st.lvl.toFixed(1)} m over its banks</b>` : `<b class="ok">${(-st.lvl).toFixed(1)} m below its banks</b>`;
        const tw = st.town > 0.05 ? `<b class="no">flooded, ${st.town.toFixed(1)} m deep</b>` : s.emb && st.lvl > 0 ? '<b class="ok">dry behind the embankment</b>' : '<b class="ok">dry</b>';
        return `<div class="big">${st.lvl > 0 ? 'The river is in flood' : s.rain > 0 ? 'Rain is gathering' : 'The river is falling'}</div>
          <div class="row"><span>Rain landing on 40 km²</span><b>${fmtN(fall)} m³ a second</b></div>
          ${fine(`<div class="row"><span>Soaks in or is held</span><b>${Math.round((1 - share) * 100)} %</b></div>`)}
          <div class="row"><span>Runs off</span><b>${Math.round(share * 100)} %</b></div>
          <div class="row"><span>River flow now</span><b>${fmtN(st.Q)} m³/s</b></div>
          <div class="row"><span>Channel is full at</span><b>${fmtN(bf)} m³/s</b></div>
          <div class="row"><span>River</span>${riv}</div>
          <div class="row"><span>Town</span>${tw}</div>
          ${fine('<small>1 m³ of water is 1 tonne. Heights are drawn larger than life.</small>')}`;
      },
    };
  },
};
