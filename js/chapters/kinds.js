// Chapter 4: kinds of flood. Six small cut-away scenes, each played on a loop. The scenes are
// drawings of the mechanism, not simulations; the figures quoted beside them are sourced:
//   onset and warning times are typical ranges, not promises. WMO counts a flood as a "flash flood"
//     when it follows the causing rain within about six hours;
//   IMD calls rain of 100 mm or more in an hour over roughly 20 to 30 km² a cloudburst;
//   Mumbai: 944 mm in 24 hours at Santacruz on 26 July 2005 (IMD). Its old drains were built for
//     about 25 mm an hour; the BRIMSTOWAD plan raised the target to 50 mm an hour;
//   Machchhu-II dam, 11 August 1979: the flood reached Morbi, 5 km downstream, in about 20 minutes;
//   South Lhonak lake, Sikkim, 3 October 2023: about 14.7 million m³ of moraine fell into the lake
//     and about 50 million m³ of water left it (Sattar and others, Science, 2025);
//   Kosi: breach at Kusaha, Nepal, 18 August 2008.
// The urban scene does one small sum: rain above the drain's capacity, for two hours, gathering
// from five times the street's own area into the low street (an assumed, illustrative figure).
import { THREE, M, box, swarm, clamp, smooth, lerp } from '../kit.js';
import { makeSection, makeRain, house, block, tree, cloud, waterMat, board, panelBg, title, layout, BW, BH, BPX, reelView, fine, inReel, rng, HEX, COL } from '../flood.js';

const D = 3, LOOP = 9, HOLD = 2.5;
export const KINDS = {
  river: { name: 'River flood', short: 'River', cause: 'Days of rain over a big catchment. The river rises slowly and spreads wide.', rise: 'days', warn: 'a day or more', h: [12, 240], eg: 'Assam, most years' },
  flash: { name: 'Flash flood and cloudburst', short: 'Flash', cause: 'Very heavy rain on steep ground. A wall of water and rocks comes down a gully.', rise: 'minutes to hours', warn: 'minutes to 2 hours', h: [0.2, 6], eg: 'Himalayan valleys' },
  urban: { name: 'Urban flood', short: 'Urban', cause: 'Rain falls faster than the drains can carry it, and paving lets none soak in.', rise: 'an hour or so', warn: 'a few hours', h: [0.3, 6], eg: 'Mumbai, 2005' },
  coast: { name: 'Coastal flood', short: 'Coastal', cause: 'A cyclone pushes the sea onto the land as a storm surge, often with a high tide.', rise: 'hours', warn: '2 to 5 days', h: [2, 24], eg: 'Odisha, 1999' },
  glof: { name: 'Glacial lake outburst', short: 'GLOF', cause: 'A lake of meltwater behind a ridge of loose glacier rubble breaks out.', rise: 'minutes to hours', warn: 'minutes to hours', h: [0.2, 8], eg: 'Sikkim, 2023' },
  breach: { name: 'Dam or bund breach', short: 'Breach', cause: 'A dam or embankment gives way and releases stored water all at once.', rise: 'minutes to hours', warn: 'minutes to hours', h: [0.15, 12], eg: 'Kosi, 2008' },
};
const ORDER = ['river', 'flash', 'urban', 'coast', 'glof', 'breach'];
const DRAIN = 50, urbanRain = (p) => Math.round(20 + 100 * p), urbanDepth = (p) => Math.max(0, ((urbanRain(p) - DRAIN) * 2 * 5) / 1000);

const poly = (pts, col) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false }); g.translate(0, 0, -D / 2); const m = new THREE.Mesh(g, M.matte(col)); m.receiveShadow = true; m.castShadow = true; return m; };
const wbox = (grp, mat = waterMat(), depth = D * 0.996) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, depth), mat); m.renderOrder = 2; grp.add(m); m.span = (x0, x1, y0, y1) => { m.visible = x1 > x0 + 1e-3 && y1 > y0 + 1e-3; if (m.visible) { m.scale.set(x1 - x0, y1 - y0, 1); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, m.position.z); } }; return m; };
// A tongue of water running down a slope from point a towards b.
const tongue = (grp, a, b, w = 1.3) => { const g = new THREE.BoxGeometry(1, 1, w); g.translate(0.5, 0.5, 0); const m = new THREE.Mesh(g, waterMat(0x5f86a6, 0.92)); m.renderOrder = 2; m.position.set(a[0], a[1], 0); m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); m.len = Math.hypot(b[0] - a[0], b[1] - a[1]); m.set = (k, th) => { m.visible = k > 0.01; m.scale.set(Math.max(0.01, m.len * k), th, 1); }; grp.add(m); return m; };
const homes = (grp, list, s = 0.42) => list.map(([x, y, z], i) => { const h = house(s, i % 2 ? 0xe9d8b8 : 0xd8c4a0); h.position.set(x, y, z); grp.add(h); return h; });

const BUILD = {
  river(grp, stage) {
    const sec = makeSection(grp, { bw: 40, bd: 4, fpL: 250, fpR: 250, sx: 0.0185, sy: 0.14, D, y0: 1.5 });
    homes(grp, [[1.4, sec.Y(0), 0.5], [2.2, sec.Y(0), -0.6], [3, sec.Y(0), 0.7], [3.8, sec.Y(0), -0.3]]);
    [-1.3, -2.4, -3.3, -4.2].forEach((x, i) => { const t = tree(1.2); t.position.set(x, sec.Y(0), i % 2 ? 0.7 : -0.6); grp.add(t); });
    const rain = makeRain(grp, 160, { x0: -5.5, x1: 5.5, y0: 1.6, y1: 5.6, z0: -1.5, z1: 1.5 }, { slant: 0.05 });
    stage.label('Slow and wide: the water creeps up over days', [0, sec.Y(0) + 1.5, 1.5], grp);
    return (u, dt, p) => { sec.setWater(lerp(2.4, 4 + 2.6 * p, smooth(u / 0.8))); rain.update(dt, 0.6); };
  },
  flash(grp, stage) {
    const A = [-4.2, 5], B = [1.8, 1.6];
    grp.add(poly([[-5.5, 0.3], [-5.5, 5.2], A, B, [5.5, 1.4], [5.5, 0.3]], 0x6f6a5c));
    homes(grp, [[2.7, 1.55, 0.6], [3.5, 1.5, -0.5], [4.4, 1.46, 0.5]]);
    [[-2.8, 0.9], [-1.2, -1], [0.4, 1]].forEach(([x, z]) => { const t = tree(1.1); t.position.set(x, 5 + ((x + 4.2) * (1.6 - 5)) / 6, z); grp.add(t); });
    const tg = tongue(grp, A, B), flat = wbox(grp, waterMat(0x5f86a6, 0.92));
    const rocks = swarm(12, new THREE.DodecahedronGeometry(0.13), M.matte(0x4f4a42)); grp.add(rocks);
    const cl = cloud(3, 0x4f586a); cl.position.set(-3.9, 6.5, 0); grp.add(cl);
    const rain = makeRain(grp, 260, { x0: -5.4, x1: -1, y0: 3, y1: 6.2, z0: -1.4, z1: 1.4 }, { slant: 0.03, speed: 11 });
    stage.label('Cloudburst: 100 mm or more in an hour', [-3.4, 7.3, 0], grp);
    stage.label('Steep ground: the water arrives in minutes', [0.2, 4.4, 1.5], grp);
    return (u, dt, p) => {
      const k = smooth((u - 0.18) / 0.32), sp = smooth((u - 0.48) / 0.3);
      tg.set(k, 0.1 + 0.2 * p); flat.span(B[0] - 0.1, B[0] + 3.8 * sp, 1.38, 1.5 + (0.12 + 0.3 * p) * sp);
      for (let i = 0; i < 12; i++) { const f = clamp(k - i * 0.035 + 0.03 * Math.sin(u * 40 + i), 0, 1) * (1 - sp * 0.0); rocks.place(i, [lerp(A[0], B[0], f) + sp * (i % 4) * 0.5, lerp(A[1], B[1], f) + 0.16 + 0.1 * p, ((i % 5) - 2) * 0.24], [u * 9 + i, i, 0], k > 0.02 ? 1 : 0.0001); }
      rocks.done(); rain.update(dt, u < 0.7 ? 1 : 0.3);
    };
  },
  urban(grp, stage) {
    grp.add(poly([[-5.5, 0.3], [-5.5, 2.2], [-1.7, 2.2], [-1.7, 2], [1.7, 2], [1.7, 2.2], [5.5, 2.2], [5.5, 0.3]], 0x5a5e68));
    [[-4.6, 1.6], [-3.4, 2.4], [-2.4, 1.3], [2.5, 2.1], [3.6, 1.4], [4.7, 2.6]].forEach(([x, h], i) => { const b = block(0.85, h, 1.6, i % 2 ? 0xd9dde4 : 0xc8ccd6); b.position.set(x, 2.2, -0.4); grp.add(b); });
    const carB = box(0.8, 0.26, 0.4, M.plastic(0xd94f4f)); carB.position.set(0.5, 2.2, 0.6); grp.add(carB);
    const pipe = box(1.1, 0.8, D * 1.002, M.matte(0x1b1e25)); pipe.position.set(0, 1.25, 0); grp.add(pipe);
    const drainW = wbox(grp, waterMat(0x3f8fe0, 0.95), D * 1.004), street = wbox(grp, waterMat(0x6f8fa8, 0.85));
    const rain = makeRain(grp, 300, { x0: -5.5, x1: 5.5, y0: 2.1, y1: 6.2, z0: -1.5, z1: 1.5 }, { slant: 0.04, speed: 11 });
    const cl = cloud(5, 0x4f586a); cl.position.set(-2.9, 6.5, 0); cl.scale.set(1, 0.55, 1); grp.add(cl);
    const lD = stage.label('', [0, 0.95, 1.55], grp), lS = stage.label('', [0, 3.3, 1.5], grp, 'hot');
    stage.label('Paving: nothing soaks in', [3.4, 5.4, 1], grp);
    return (u, dt, p) => {
      const mm = urbanRain(p), fill = clamp(smooth(u / 0.3) * (mm / DRAIN), 0, 1), d = urbanDepth(p) * smooth((u - 0.3) / 0.55);
      drainW.span(-0.5, 0.5, 0.9, 0.9 + 0.7 * fill);
      const top = 2 + d * 1.1; street.span(top > 2.2 ? -5.5 : -1.7, top > 2.2 ? 5.5 : 1.7, 2, top);
      carB.position.y = 2.2 + Math.max(0, d * 1.1 - 0.25) * 0.8; carB.rotation.z = d > 0.3 ? Math.sin(u * 20) * 0.05 : 0;
      rain.update(dt, clamp(mm / 120, 0.2, 1));
      lD.element.innerHTML = `Drain: built for ${DRAIN} mm an hour${fill >= 1 ? ', <b>full</b>' : ''}`;
      lS.element.innerHTML = `Rain: <b>${mm} mm an hour</b>${d > 0.01 ? ` · street ${d.toFixed(2)} m deep` : ''}`;
    };
  },
  coast(grp, stage) {
    grp.add(poly([[-5.5, 0.3], [-5.5, 1], [-0.5, 1.9], [1, 2.25], [5.5, 2.5], [5.5, 0.3]], 0x9a8660));
    homes(grp, [[1.6, 2.28, 0.5], [2.5, 2.33, -0.6], [3.4, 2.38, 0.6], [4.4, 2.44, -0.3]]);
    const sea = wbox(grp, waterMat(0x2a7fd0, 0.78));
    const arrows = [-4.6, -2.9, -1.2].map((x) => { const g = new THREE.Group(), sh = box(1, 0.06, 0.06, M.glow(0xffe27a)), tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 12), M.glow(0xffe27a)); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.62; sh.castShadow = false; g.add(sh, tip); g.position.set(x, 3.9, 0.3); grp.add(g); return g; });
    const palms = [0.3, 2, 3.9].map((x, i) => { const t = tree(1.2, 0x3f8f4f); t.position.set(x, 2.1 + x * 0.07, i % 2 ? -1 : 1); grp.add(t); return t; });
    stage.label('Onshore wind piles the sea against the coast', [-3, 4.6, 0.3], grp);
    stage.label('Normal sea level', [-4.4, 2.2, 1.55], grp);
    const msl = box(5, 0.02, 0.02, M.glow(0xffffff, { transparent: true, opacity: 0.6 })); msl.position.set(-3, 2, D / 2 + 0.01); msl.castShadow = false; grp.add(msl);
    return (u, dt, p) => {
      const k = smooth(u / 0.75), lvl = 2 + (0.25 + 0.75 * p) * k;
      sea.span(-5.5, 5.5, 0.9, lvl + 0.03 * Math.sin(u * 30));
      arrows.forEach((a, i) => { a.scale.x = 0.5 + k * (0.6 + 0.6 * p); a.position.x = [-4.6, -2.9, -1.2][i] + ((u * 6 + i) % 1) * 0.5; });
      palms.forEach((t, i) => { t.rotation.z = -(0.1 + 0.5 * k * p) - Math.sin(u * 60 + i) * 0.04; });
    };
  },
  glof(grp, stage) {
    const A = [-1.3, 4.75], B = [2.2, 1.7];
    grp.add(poly([[-5.5, 0.3], [-5.5, 6], [-4.5, 5.5], [-4.2, 4.5], [-2.6, 4.5], A, B, [5.5, 1.5], [5.5, 0.3]], 0x6a6860));
    const ice = poly([[-5.5, 6], [-5.5, 6.9], [-4.5, 6.2], [-3.95, 5.25], [-4.2, 4.9], [-4.5, 5.5]], 0xdfeaf2); grp.add(ice);
    const mor = poly([[-0.75, 0], [-0.25, 0.75], [0.35, 0.7], [0.75, 0.1]], 0x8a7a5c); mor.position.set(-2, 4.52, 0); grp.add(mor);
    const lake = wbox(grp, waterMat(0x3fb0c8, 0.85)); lake.position.z = -0.02;
    const tg = tongue(grp, A, B), flat = wbox(grp, waterMat(0x5f86a6, 0.92));
    const chunk = box(0.5, 0.4, 1, M.matte(0x9aa0a8)); grp.add(chunk);
    homes(grp, [[3, 1.65, 0.6], [3.9, 1.6, -0.5], [4.7, 1.56, 0.4]]);
    stage.label('Glacier', [-5, 7.3, 0], grp);
    stage.label('Lake of meltwater', [-3.4, 5.75, 1.5], grp);
    stage.label('Moraine: a dam of loose rubble', [-1.2, 6.1, 1.5], grp, 'hot');
    return (u, dt, p) => {
      const fall = smooth((u - 0.06) / 0.12), br = smooth((u - 0.2) / 0.2), k = smooth((u - 0.26) / 0.3), sp = smooth((u - 0.55) / 0.3);
      chunk.position.set(lerp(-4.35, -3.9, fall), lerp(5.7, 4.75, fall), 0); chunk.rotation.z = fall * 1.2; chunk.visible = u > 0.03;
      mor.scale.y = 1 - br * (0.45 + 0.3 * p);
      const wave = Math.sin(clamp((u - 0.16) / 0.1, 0, 1) * Math.PI) * 0.18;
      lake.span(-4.4, -1.6, 4.4, 5.12 + wave - br * (0.25 + 0.3 * p) * smooth((u - 0.3) / 0.5));
      tg.set(k, 0.12 + 0.2 * p); flat.span(B[0] - 0.1, B[0] + 3.4 * sp, 1.45, 1.6 + (0.12 + 0.3 * p) * sp);
    };
  },
  breach(grp, stage) {
    grp.add(poly([[-5.5, 0.3], [-5.5, 1.6], [-2.9, 1.6], [-2.5, 2.6], [-2.2, 2.6], [-1.9, 1.95], [0.2, 1.95], [0.5, 1.6], [5.5, 1.6], [5.5, 0.3]], 0x7d6a4c));
    const bundShape = [[0.1, 0], [0.45, 1], [0.75, 1], [1.15, 0]];
    const mk = (z0, z1) => { const sh = new THREE.Shape(bundShape.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); const m = new THREE.Mesh(g, M.matte(HEX.bank)); m.castShadow = true; m.position.y = 1.6; grp.add(m); return m; };
    mk(-D / 2, -0.1); const gap = mk(-0.1, D / 2);
    const river = wbox(grp, waterMat(0x4f7da6, 0.88)), plain = wbox(grp, waterMat(0x7d8f9a, 0.85));
    homes(grp, [[2.2, 1.6, 0.6], [3.1, 1.6, -0.5], [4, 1.6, 0.5], [4.8, 1.6, -0.6]]);
    [-3.6, -4.6].forEach((x, i) => { const t = tree(1.2); t.position.set(x, 1.6, i ? 0.6 : -0.5); grp.add(t); });
    stage.label('Silt has raised the river bed above the land', [-0.9, 3.6, 1.5], grp);
    stage.label('Embankment', [0.6, 3.05, 1.5], grp, 'hot');
    return (u, dt, p) => {
      const br = smooth((u - 0.25) / 0.12), sp = smooth((u - 0.3) / 0.45);
      gap.scale.y = 1 - 0.85 * br;
      river.span(-2.35, 0.6 + 0.4 * br, 1.9, 2.5 - 0.3 * sp);
      plain.span(0.6, 0.6 + 4.9 * sp, 1.6, 1.62 + (0.2 + 0.4 * p) * sp);
    };
  },
};

export default {
  id: 'kinds',
  short: 'Kinds of flood',
  title: 'Six kinds of flood',
  subtitle: 'Some floods take days to arrive. Some take minutes. The warning time is the difference.',
  view: { pos: [0, 5.9, 13.4], target: [0, 4.75, 0] },
  learn: `<p>Every flood is water arriving faster than it can leave. What differs is <b>where the water comes from</b> and <b>how fast</b>. Speed matters most, because it sets how much <b>warning</b> people get.</p>
    <p><b>River floods</b> follow days of rain over a large catchment. A big river rises slowly and spreads wide over its floodplain. The Brahmaputra floods parts of Assam most years. There is usually time to move, but the water can stay for weeks.</p>
    <p><b>Flash floods</b> come within hours, often minutes, of very heavy rain on steep ground. The India Meteorological Department (IMD) calls rain of <b>100 mm or more in an hour</b> over a small area a <b>cloudburst</b>. The water carries mud and boulders, and arrives as a surge.</p>
    <p><b>Urban floods</b> happen when rain beats the drains. Chapter 3 showed why: paving turns almost all the rain into fast runoff. On 26 July 2005 Mumbai's Santacruz weather station measured <b>944 mm in 24 hours</b>. Much of the city's old drain network was built for about 25 mm an hour.</p>
    <p><b>Coastal floods</b> come from the sea. A cyclone's wind piles water against the shore as a <b>storm surge</b>. That story is told in <a href="https://glassbox.how/cycloneclear/" target="_blank" rel="noopener">CycloneClear</a>. (A tsunami is different again: see TsunamiClear.)</p>
    <p><b>Glacial lake outburst floods (GLOFs).</b> As glaciers shrink, meltwater collects behind a <b>moraine</b>, a ridge of loose rubble the glacier left behind. If ice or rock falls into the lake, or the ridge weakens, the lake can empty in minutes. This happened at South Lhonak lake in Sikkim in October 2023.</p>
    <p><b>Breaches.</b> A dam or embankment that fails releases its stored water at once. People living behind it often believed they were safe.</p>
    <p class="tip"><b>Try it:</b> play each kind in turn and compare the "time to arrive" bars. Then pick the urban flood and raise the strength until the drain is beaten.</p>`,
  terms: [
    { t: 'Flash flood', d: 'A flood that follows its cause within a few hours, usually on steep or paved ground.' },
    { t: 'Cloudburst', d: 'Extremely heavy rain over a small area: 100 mm or more in an hour, by IMD’s definition.' },
    { t: 'Storm surge', d: 'The sea rising above the normal tide because of a storm’s wind and low pressure.' },
    { t: 'Moraine', d: 'A ridge of loose rock and soil left by a glacier. It can dam a lake, but it is weak.' },
    { t: 'GLOF', d: 'Glacial lake outburst flood: the sudden emptying of a lake held back by ice or moraine.' },
    { t: 'Breach', d: 'A break in a dam or embankment that lets the water through.' },
    { t: 'Warning time', d: 'The time between a warning reaching people and the flood reaching them.' },
  ],
  defaults: { kind: 'river', power: 0.7, run: 0 },
  controls: [
    { key: 'kind', type: 'seg', label: 'Kind of flood', options: ORDER.map((k) => ({ v: k, label: KINDS[k].short })), fmt: (v) => KINDS[v].name },
    { key: 'power', type: 'range', label: 'Strength', min: 0.2, max: 1, step: 0.05, fmt: (v, s) => (s.kind === 'urban' ? `${urbanRain(v)} mm of rain an hour` : v < 0.45 ? 'Moderate' : v < 0.8 ? 'Severe' : 'Extreme') },
    { key: 'go', type: 'buttons', label: 'Animation', items: [{ label: 'Play it again', act: (s) => { s.run = (s.run || 0) + 1; } }] },
  ],
  quiz: [
    { q: 'Which kind of flood usually gives the least warning?', options: ['A flood on a big lowland river', 'A flash flood on steep ground', 'A coastal flood from a tracked cyclone', 'They all give days'], answer: 1, why: 'On steep ground the water reaches people within minutes to a few hours of the rain. A big river takes days to rise, and a cyclone is tracked for days.' },
    { q: 'Why do cities flood even in rain that farmland would absorb?', options: ['Cities get more rain', 'Paving lets almost nothing soak in, and drains have a fixed capacity', 'Buildings attract water', 'City rain is heavier water'], answer: 1, why: 'Nearly all the rain becomes runoff at once. When it arrives faster than the drains can carry it, the surplus stays on the streets.' },
    { q: 'What holds back the water of a glacial lake before a GLOF?', options: ['A concrete wall', 'A moraine: a ridge of loose rubble left by the glacier, or the ice itself', 'Tree roots', 'Nothing'], answer: 1, why: 'Moraine is loose rock and soil, not engineered. A wave from falling ice or rock can overtop and erode it in minutes.' },
  ],
  reel: [
    { ms: 5500, caption: 'A flash flood on steep ground can arrive within minutes. A big river takes days to rise.', set: { kind: 'flash', power: 0.9, run: 0 }, view: reelView(5.8, 1, 1.3), spin: 0 },
    { ms: 5500, caption: 'A glacial lake held by loose rubble can break out and empty in minutes, as in Sikkim in 2023.', set: { kind: 'glof', power: 0.9, run: 0 }, view: reelView(5.8, 1, 1.3), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const scenes = {}, minorAll = [];
    const world = new THREE.Group(); world.scale.setScalar(0.8); root.add(world);
    for (const k of ORDER) { const g = new THREE.Group(); world.add(g); scenes[k] = { g, tick: BUILD[k](g, stage) }; g.visible = false; }
    let cur = 'river';
    const brd = board(root, BW, BH, ...BPX, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'From the trigger to the flood', `Typical times. ${KINDS[cur].name}: warning of ${KINDS[cur].warn}.`);
      const x0 = 150, x1 = w - 34, lo = Math.log10(0.1), hi = Math.log10(480), X = (hr) => x0 + ((Math.log10(hr) - lo) / (hi - lo)) * (x1 - x0);
      g.font = '20px sans-serif';
      [[0.1667, '10 min'], [1, '1 hour'], [6, '6 hours'], [24, '1 day'], [168, '1 week']].forEach(([hr, t]) => { g.strokeStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(X(hr), 104); g.lineTo(X(hr), h - 56); g.stroke(); g.fillStyle = COL.soft; g.fillText(t, X(hr) - g.measureText(t).width / 2, h - 24); });
      ORDER.forEach((k, i) => { const y = 118 + i * 70, on = k === cur, K = KINDS[k]; g.fillStyle = on ? COL.gold : COL.soft; g.font = (on ? 'bold ' : '') + '24px sans-serif'; g.fillText(K.short, 24, y + 30); g.fillStyle = on ? COL.gold : 'rgba(142,240,255,.45)'; const a = X(K.h[0]), b = X(K.h[1]); g.beginPath(); g.roundRect(a, y, b - a, 40, 20); g.fill(); });
    }, [0, 0, 0]);

    let key = '', clock = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        layout(stage, brd, { modelTop: 5.8, overlap: 1.3 });
        const k2 = `${s.kind}|${s.run}`;
        if (k2 !== key) { key = k2; clock = 0; cur = s.kind; brd.redraw(); for (const k of ORDER) scenes[k].g.visible = k === s.kind; }
        const loop = inReel() ? 4.6 : LOOP;
        clock += dt; if (clock > loop + HOLD) clock = 0;
        scenes[s.kind].tick(clamp(clock / loop, 0, 1), dt, s.power);
      },
      dispose() { stage.setShift(0, 0); },
      readout: (s) => {
        const K = KINDS[s.kind];
        return `<div class="big">${K.name}</div>
          <div style="max-width:262px;margin:2px 0 6px">${K.cause}</div>
          <div class="row"><span>Rises in</span><b>${K.rise}</b></div>
          <div class="row"><span>Warning</span><b>${K.warn}</b></div>
          <div class="row"><span>Example</span><b>${K.eg}</b></div>
          ${s.kind === 'urban' ? `<div class="row"><span>Rain / drain</span><b class="${urbanRain(s.power) > DRAIN ? 'no' : 'ok'}">${urbanRain(s.power)} / ${DRAIN} mm an hour</b></div>` : ''}
          ${fine('<small>Typical ranges, not promises.</small>')}`;
      },
    };
  },
};
