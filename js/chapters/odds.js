// Chapter 5: odds and defences.
// Odds: a "T-year flood" has a 1 in T chance of being reached or passed in any one year. Over N
// years the chance of at least one is 1 − (1 − 1/T)^N. For T = 100 and N = 30 that is 26 %.
// The row of years is a fresh random draw each time (one independent roll per year).
// Size: each year's biggest flood on the model river follows a Gumbel distribution (Gumbel, 1941)
// with mean 260 m³/s and standard deviation 110 m³/s. These are made-up but sensible figures for a
// river whose channel fills at 228 m³/s: bankfull then comes about every 1.8 years, in line with
// the common finding that channels fill every one to two years (USGS; Leopold, Wolman and Miller, 1964).
// Level: Manning's equation for a channel 40 m wide and 4 m deep, slope 1 in 2,000, with a
// floodplain 300 m wide on each side (sectionFlow() in flood.js).
//   Embankments 15 m from each bank confine the flood, so it rises higher: that is computed.
//   Their crest is 2.5 m above the floodplain: enough for the 50-year flood here, not the 100-year.
//   Set back 150 m ("room for the river"), the same crest holds even the 500-year flood.
// Two defences use assumed round figures, stated in the readout:
//   a reservoir upstream holds back flow above 250 m³/s, up to 150 m³/s, until it is full;
//   wetlands and "sponge" measures trim the peak by 12 %.
import { THREE, clamp, approach } from '../kit.js';
import { chance, gumbelQ, stageFor, bankfull, makeSection, house, block, tree, board, panelBg, title, axes, dot, layout, BW, BH, BPX, reelView, fine, fmtN, rng, COL } from '../flood.js';

const BASE = { bw: 40, bd: 4, slope: 0.0005, n: 0.035, nfp: 0.06 };
const OPEN = { ...BASE, fpL: 300, fpR: 300 }, NEAR = { ...BASE, fpL: 15, fpR: 15, wallL: 1, wallR: 1 }, FAR = { ...BASE, fpL: 150, fpR: 150, wallL: 1, wallR: 1 };
const CREST = 2.5, MEAN = 260, SD = 110, BF = bankfull(OPEN);
const DEF = { none: 'No defences', bund: 'Embankments', room: 'Room for the river', store: 'Reservoir upstream', sponge: 'Wetlands and sponge city' };
export function outcome(T, def) {
  const Q0 = gumbelQ(T, MEAN, SD);
  const Q = def === 'store' ? Q0 - clamp(Q0 - 250, 0, 150) : def === 'sponge' ? Q0 * 0.88 : Q0;
  const open = stageFor(Q, OPEN) - BASE.bd;
  if (def === 'bund' || def === 'room') {
    const lvl = stageFor(Q, def === 'bund' ? NEAR : FAR) - BASE.bd, over = lvl > CREST;
    return { Q0, Q, lvl, over, town: over ? Math.max(0, open) : 0, walled: true };
  }
  return { Q0, Q, lvl: open, over: false, town: Math.max(0, open), walled: false };
}
const pct = (p) => (p >= 0.995 ? 'more than 99 %' : p < 0.1 ? (p * 100).toFixed(1) + ' %' : Math.round(p * 100) + ' %');

export default {
  id: 'odds',
  short: 'Odds and defences',
  title: 'Odds and defences',
  subtitle: 'A "100-year flood" is not a flood that comes once a century.',
  view: { pos: [0, 5.9, 13.4], target: [0, 4.75, 0] },
  learn: `<p>Engineers size floods by how rare they are. A <b>100-year flood</b> is one so large that it has a <b>1 in 100 chance (1 %) of happening in any one year</b>. It is a statement about odds, not a timetable. Two can come in back-to-back years. The river does not remember.</p>
    <p>Small yearly odds add up. Over <b>30 years</b>, the chance of meeting at least one 100-year flood is 1 − 0.99³⁰, about <b>26 %</b>: roughly one in four. The model works this out live and rolls the dice for each year.</p>
    <p><b>Embankments</b> are the oldest defence. They keep ordinary floods off the land. But they have a trap with three parts. Squeezed between walls, the flood <b>rises higher</b> than it would on an open plain. On silty rivers the bed builds up year by year, until the river runs above the land beside it. And because the land behind looks safe, more people settle there. When a flood finally tops or breaks the wall, the water arrives <b>suddenly</b> and cannot easily drain back.</p>
    <p><b>Reservoirs</b> catch the peak and release it later. They work only while they have empty space, and a full one must pass the flood on.</p>
    <p><b>Room for the river.</b> Set the embankments well back, or leave the floodplain open, so the flood can spread out shallow. The Netherlands rebuilt parts of its rivers this way.</p>
    <p><b>Wetlands and sponge cities.</b> Marshes, ponds, tanks, parks and soft ground hold rain where it falls. The East Kolkata Wetlands do this for Kolkata. These help most with the smaller, more frequent floods.</p>
    <p><b>Forecasting and warning</b> does not stop the water, but it is what saves the most lives. That is the next chapter.</p>
    <p class="tip"><b>Try it:</b> pick embankments and raise the flood from a 20-year to a 50-year to a 100-year size. Then switch to "Room for the river" and compare the river level.</p>`,
  terms: [
    { t: 'Return period', d: 'The average gap between floods of a given size or larger. A 100-year flood has a 1 % chance each year.' },
    { t: 'Annual chance', d: 'The probability that a flood of a given size is reached in any one year: 1 divided by the return period.' },
    { t: 'Embankment', d: 'An earth wall along a river. Also called a bund, levee or dyke.' },
    { t: 'Overtopping', d: 'Water flowing over the crest of a dam or embankment. Earth walls usually wash away once it starts.' },
    { t: 'Reservoir', d: 'A lake behind a dam. Kept partly empty, it can hold back a flood peak.' },
    { t: 'Room for the river', d: 'Giving the river more width, by setting embankments back or opening old channels, so floods run lower.' },
    { t: 'Sponge city', d: 'A city built to soak up rain with parks, ponds, wetlands and surfaces that let water through.' },
  ],
  defaults: { T: 100, N: 30, def: 'bund', roll: 1 },
  controls: [
    { key: 'T', type: 'log', label: 'Size of flood', min: 2, max: 500, fmt: (v) => `1-in-${Math.round(v)}-year · ${fmtN(gumbelQ(Math.round(v), MEAN, SD))} m³/s` },
    { key: 'N', type: 'range', label: 'Years you live beside the river', min: 1, max: 100, step: 1, fmt: (v) => `${v} years` },
    { key: 'def', type: 'seg', label: 'Defence', options: [{ v: 'none', label: 'None' }, { v: 'bund', label: 'Embankments' }, { v: 'room', label: 'Room for river' }, { v: 'store', label: 'Reservoir' }, { v: 'sponge', label: 'Wetlands' }], fmt: (v) => DEF[v] },
    { key: 'go', type: 'buttons', label: 'Dice', items: [{ label: 'Roll the years again', act: (s) => { s.roll = (s.roll || 0) + 1; } }, { label: '100-year flood, 30 years', act: (s) => Object.assign(s, { T: 100, N: 30 }) }] },
  ],
  quiz: [
    { q: 'What does a "100-year flood" mean?', options: ['It comes exactly every 100 years', 'It has a 1 % chance of happening in any one year', 'It lasts 100 years', 'It happened 100 years ago'], answer: 1, why: 'It is a statement of odds. Such a flood can come two years running, or not for two centuries.' },
    { q: 'You live for 30 years beside a river. What is the chance of at least one 100-year flood?', options: ['Exactly 1 %', 'About 26 %', 'About 3 %', '100 %'], answer: 1, why: 'The chance of escaping each year is 0.99. Over 30 years that is 0.99³⁰ = 0.74, so the chance of at least one flood is 26 %.' },
    { q: 'Why can an embankment make a rare flood worse?', options: ['It attracts rain', 'It confines the river so it rises higher, and fails suddenly when overtopped', 'It slows the river to a stop', 'It cannot'], answer: 1, why: 'A walled river runs higher than an open one. When the wall is finally beaten, deep water reaches people who believed they were protected.' },
  ],
  reel: [
    { ms: 6000, caption: 'A 100-year flood has a 1% chance every year. Over 30 years, that adds up to about 26%.', set: { T: 100, N: 1, def: 'bund', roll: 3 }, anim: { N: [1, 30] }, view: reelView(3.5, 1.15), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const sec = makeSection(root, { bw: 40, bd: 4, fpL: 300, fpR: 300, sx: 0.0165, sy: 0.16, D: 3, y0: 1.35 });
    const r = rng(4);
    for (let i = 0; i < 9; i++) { const m = 195 + (i % 5) * 24 + r() * 6, z = -1 + Math.floor(i / 5) * 1.3 + r() * 0.5; const b = i % 3 === 0 ? block(0.3, 0.5 + r() * 0.3, 0.3) : house(0.3, i % 2 ? 0xe9d8b8 : 0xd8c4a0); b.position.set(sec.X(m), sec.Y(0), z); root.add(b); }
    [-60, -110, -180, -240, -290, 80, 120].forEach((m, i) => { const t = tree(1 + r() * 0.4); t.position.set(sec.X(m), sec.Y(0), i % 2 ? 0.8 : -0.7); root.add(t); });
    const near = [sec.bund(-35, CREST), sec.bund(35, CREST)], far = [sec.bund(-170, CREST), sec.bund(170, CREST)];
    // a small reservoir and a wetland marker, shown for those defences
    const lRes = stage.label('Reservoir upstream holds back part of the peak', [sec.X(-120), sec.Y(0) + 1.9, 0], root);
    const lWet = stage.label('Wetlands and soft ground hold rain where it falls', [sec.X(-120), sec.Y(0) + 1.9, 0], root);
    const lRiver = stage.label('', [0, sec.Y(0) + 1.25, 1.5], root, 'hot');
    const lTown = stage.label('Town', [sec.X(245), sec.Y(0) + 1.05, 0.4], root);
    const minor = [lRes, lWet, stage.label('Heights drawn about 10× larger than widths', [sec.X(-190), sec.Y(0) - 0.5, 1.52], root)];

    let cur = null, years = [];
    const brd = board(root, BW, BH, ...BPX, (g, w, h) => {
      panelBg(g, w, h);
      if (!cur) return;
      const { T, N } = cur, p = chance(T, N);
      title(g, `At least one 1-in-${T}-year flood`, `1 − (1 − 1/${T})^${N} = ${pct(p)} in ${N} year${N > 1 ? 's' : ''}`);
      const ax = axes(g, w, h, { xMax: 100, yMax: 100, xTicks: [0, 25, 50, 75, 100], yTicks: [0, 50, 100], yFmt: (v) => v + ' %', xFmt: (v) => v + ' yr', y1: 108, y0: 318 });
      g.strokeStyle = COL.gold; g.lineWidth = 5; g.beginPath(); for (let n = 0; n <= 100; n++) { const y = ax.Y(chance(T, n) * 100); n ? g.lineTo(ax.X(n), y) : g.moveTo(ax.X(n), y); } g.stroke();
      dot(g, ax.X(N), ax.Y(p * 100), COL.gold);
      g.fillStyle = COL.text; g.font = 'bold 26px sans-serif'; g.fillText(pct(p), clamp(ax.X(N) + 16, ax.x0, ax.x1 - 150), clamp(ax.Y(p * 100) + 34, ax.y1 + 28, ax.y0 - 10));
      const gx = 24, gy = 408, cols = 25, cell = 30, hits = years.slice(0, N).filter(Boolean).length;
      g.fillStyle = COL.soft; g.font = '21px sans-serif'; g.fillText(`One possible ${N} years, with a dice roll for each:`, gx, gy - 16);
      for (let i = 0; i < N; i++) { const x = gx + (i % cols) * (cell + 4), y = gy + Math.floor(i / cols) * (cell + 4); g.fillStyle = years[i] ? COL.bad : 'rgba(142,240,255,.28)'; g.fillRect(x, y, cell, cell); }
      g.fillStyle = hits ? COL.bad : COL.ok; g.font = 'bold 24px sans-serif'; g.fillText(hits ? `${hits} flood year${hits > 1 ? 's' : ''} this time` : 'No flood this time', gx, h - 22);
      g.fillStyle = COL.soft; g.font = '20px sans-serif'; g.fillText('Same odds, different luck.', w - 270, h - 22);
    }, [0, 0, 0]);

    let key = '', rollKey = -1, lvlNow = 0, townNow = 0;
    const st = { o: outcome(100, 'bund') };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        layout(stage, brd, { minor, modelTop: 3.5, bs: 1.15 });
        const T = Math.round(s.T), N = Math.round(s.N);
        if (s.roll !== rollKey || years.T !== T) { rollKey = s.roll; years = Array.from({ length: 100 }, () => Math.random() < 1 / T); years.T = T; key = ''; }
        const k2 = `${T}|${N}`;
        if (k2 !== key) { key = k2; cur = { T, N }; brd.redraw(); }
        const o = outcome(T, s.def); st.o = o;
        lvlNow = approach(lvlNow, o.lvl, 3, dt); townNow = approach(townNow, o.town, o.over ? 1.2 : 3, dt);
        near.forEach((b) => { b.visible = s.def === 'bund'; }); far.forEach((b) => { b.visible = s.def === 'room'; });
        const e = s.def === 'bund' ? 35 : 170;
        if (o.walled) { sec.setWater(lvlNow + BASE.bd, -e, e); sec.setSide(e, sec.xr, o.over ? townNow : 0, 0); sec.setSide(sec.xl, -e, o.over ? townNow : 0, 1); }
        else { sec.setWater(lvlNow + BASE.bd); sec.setSide(0, 0, 0, 0); sec.setSide(0, 0, 0, 1); }
        lRes.visible = lRes.visible && s.def === 'store'; lWet.visible = lWet.visible && s.def === 'sponge';
        lRiver.element.innerHTML = o.lvl > 0 ? `River: <b>${o.lvl.toFixed(1)} m</b> above the floodplain${o.over ? ' · <b>embankment overtopped</b>' : ''}` : `River: ${(-o.lvl).toFixed(1)} m below its banks`;
        lTown.element.innerHTML = o.town > 0.02 ? `Town: <b>${o.town.toFixed(1)} m of water</b>` : 'Town: dry';
        lTown.element.classList.toggle('hot', o.town > 0.02);
      },
      dispose() { stage.setShift(0, 0); },
      readout: (s) => {
        const T = Math.round(s.T), N = Math.round(s.N), o = st.o;
        const cut = o.Q0 - o.Q;
        return `<div class="big">1-in-${T}-year flood</div>
          <div class="row"><span>Chance each year</span><b>${pct(1 / T)}</b></div>
          <div class="row"><span>In ${N} years</span><b>${pct(chance(T, N))}</b></div>
          <div class="row"><span>Peak flow</span><b>${fmtN(o.Q0)}${cut > 1 ? ` → ${fmtN(o.Q)}` : ''} m³/s</b></div>
          <div class="row"><span>Bankfull</span><b>${fmtN(BF)} m³/s</b></div>
          <div class="row"><span>River level</span><b>${o.lvl > 0 ? o.lvl.toFixed(1) + ' m over the plain' : 'within its banks'}</b></div>
          ${o.walled ? `<div class="row"><span>Crest, ${CREST} m</span><b class="${o.over ? 'no' : 'ok'}">${o.over ? 'overtopped' : 'holding'}</b></div>` : ''}
          <div class="row"><span>Town</span><b class="${o.town > 0.02 ? 'no' : 'ok'}">${o.town > 0.02 ? `${o.town.toFixed(1)} m deep${o.over ? ', suddenly' : ''}` : 'dry'}</b></div>
          ${fine(`<small>${s.def === 'store' ? 'Assumed: holds back up to 150 m³/s.' : s.def === 'sponge' ? 'Assumed: trims the peak by 12 %.' : 'A model river (Gumbel, Manning).'}</small>`)}`;
      },
    };
  },
};
