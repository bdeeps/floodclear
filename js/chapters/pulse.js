// Chapter 3: the river's pulse. A storm hydrograph for a small catchment (8 km², longest flow path
// 5 km, average slope 2 %), computed live by hydrograph() in flood.js:
//   runoff from the SCS curve-number method (TR-55, soil group B: woods 55, row crops 78,
//     bare fallow 86, town centre with 85 % hard surface 92);
//   lag from the NRCS lag equation (NEH Part 630, ch. 15), which shortens as the curve number rises;
//   shape from the NRCS dimensionless unit hydrograph (NEH Part 630, ch. 16).
// Two switches use round figures and are assumptions, not measurements:
//   a straightened, lined channel cuts the lag by 40 % (shorter path, and Manning's roughness
//     falls from about 0.035 to about 0.022, so water travels roughly 1.6 times faster);
//   wetlands, ponds and a small reservoir upstream act as a linear store with K = 4 hours.
// The stream channel is 6 m wide and 1.5 m deep on a slope of 1 in 500; Manning's equation gives a
// bankfull flow of 11.5 m³/s, and the depth on the 60 m floodplains once it spills.
import { THREE, clamp } from '../kit.js';
import { hydrograph, cnFor, SURFACES, CATCH, stageFor, bankfull, makeSection, makeRain, house, tree, board, panelBg, title, axes, dot, layout, BW, BH, BPX, reelView, fine, inReel, rng, COL } from '../flood.js';

const SEC = { bw: 6, bd: 1.5, slope: 0.002, n: 0.035, nfp: 0.06, fpL: 60, fpR: 60 };
const BF = bankfull(SEC);
const LAND = { forest: 'forest', farm: 'farm', bare: 'bare', town: 'town' };
const LNAME = { forest: 'Forest', farm: 'Farmland', bare: 'Cleared, bare slopes', town: 'Town' };
const SPAN = 24, PLAY = 12, HOLD = 2.5;
export const model = (s) => hydrograph({ rain: s.rain, hours: s.hours, cn: cnFor(SURFACES[LAND[s.land]].cn, s.wet), lagMul: s.straight ? 0.6 : 1, storeK: s.store ? 4 : 0 });
const baseline = (s) => hydrograph({ rain: s.rain, hours: s.hours, cn: cnFor(SURFACES.farm.cn, s.wet) });

export default {
  id: 'pulse',
  short: 'The river’s pulse',
  title: 'The river’s pulse',
  subtitle: 'After rain, a river rises to a peak and falls. The shape of that pulse decides who floods.',
  view: { pos: [0, 5.9, 13.4], target: [0, 4.75, 0] },
  learn: `<p>Stand on a bridge after a storm and measure the river every hour. Plot the flow against time and you get a <b>hydrograph</b>: a hump that climbs to a <b>peak</b> and then tails away. It is the river's pulse.</p>
    <p>The peak comes <b>after</b> the rain, not during it. Water needs time to trickle down slopes and along streams. The gap between the middle of the rain and the peak is the <b>lag</b>.</p>
    <p>The <b>area under the curve</b> is the total runoff. The same volume can pass as a low, wide hump or as a tall, sharp spike. Only the spike floods you. The river spills when the flow passes <b>bankfull</b>, the most the channel can carry.</p>
    <p><b>What sharpens the peak:</b></p>
    <p><b>Paving.</b> Roofs and roads soak up nothing and are smooth, so more water arrives, and it arrives sooner.<br><b>Clearing forest.</b> Bare slopes shed rain that trees and leaf litter used to hold.<br><b>Straightening and lining channels.</b> Water races down a smooth, straight drain. That clears it from here quickly and delivers it downstream all at once.<br><b>Soaked ground.</b> As chapter 2 showed.</p>
    <p><b>What flattens it:</b> forests, <b>wetlands</b>, ponds and tanks, and <b>reservoirs</b>. They hold water back and let it out slowly, so the same volume passes as a lower, longer hump.</p>
    <p>The model is a small catchment of 8 km², with a stream 6 m wide. Big rivers behave the same way, but their lag is days, not hours.</p>
    <p class="tip"><b>Try it:</b> keep the storm the same and switch the land from farmland to town. Then straighten the channel. Then go back and add wetlands. Watch the height and the time of the peak.</p>`,
  terms: [
    { t: 'Hydrograph', d: 'A graph of a river’s flow against time.' },
    { t: 'Discharge', d: 'The volume of water passing a point each second, in cubic metres per second (m³/s). Also called flow.' },
    { t: 'Peak flow', d: 'The highest flow reached after a storm.' },
    { t: 'Lag', d: 'The delay between the middle of the rain and the peak of the river.' },
    { t: 'Bankfull', d: 'The flow that just fills the channel. Above it the river spills onto the floodplain.' },
    { t: 'Wetland', d: 'Land that is soaked or under shallow water for much of the year: a marsh, swamp, jheel or beel. It stores flood water.' },
    { t: 'Baseflow', d: 'The steady flow that seeps into a river from groundwater between storms.' },
  ],
  defaults: { rain: 60, hours: 3, land: 'farm', wet: 'normal', straight: false, store: false, run: 0 },
  controls: [
    { key: 'rain', type: 'range', label: 'Rain in the storm', min: 20, max: 150, step: 5, fmt: (v, s) => `${v} mm in ${s.hours} h` },
    { key: 'hours', type: 'range', label: 'How long it rains', min: 1, max: 8, step: 1, fmt: (v, s) => `${v} h · ${Math.round(s.rain / v)} mm an hour` },
    { key: 'land', type: 'seg', label: 'Land in the catchment', options: [{ v: 'forest', label: 'Forest' }, { v: 'farm', label: 'Farmland' }, { v: 'bare', label: 'Cleared' }, { v: 'town', label: 'Town' }] },
    { key: 'wet', type: 'seg', label: 'Soil before the storm', options: [{ v: 'dry', label: 'Dry' }, { v: 'normal', label: 'Damp' }, { v: 'soaked', label: 'Soaked' }] },
    { key: 'straight', type: 'toggle', label: 'Straightened, lined channels', hint: 'Water travels faster, so the lag is cut by 40 %.' },
    { key: 'store', type: 'toggle', label: 'Wetlands, ponds and a reservoir upstream', hint: 'They fill as the flow rises and drain over several hours.' },
  ],
  quiz: [
    { q: 'When does a river usually reach its peak?', options: ['Before the rain starts', 'At the exact moment the rain is heaviest', 'Some time after the heaviest rain', 'A year later'], answer: 2, why: 'Runoff needs time to travel down slopes and streams, so the peak lags behind the rain: hours for a small stream, days for a great river.' },
    { q: 'A catchment is paved over. For the same storm, the flood peak becomes…', options: ['Lower and later', 'Higher and earlier', 'Unchanged', 'Zero'], answer: 1, why: 'Less rain soaks in, so there is more runoff, and smooth hard surfaces deliver it faster. More water in less time means a higher, earlier peak.' },
    { q: 'How do wetlands and reservoirs reduce flooding downstream?', options: ['They destroy water', 'They store water and release it slowly, lowering the peak', 'They make rain lighter', 'They speed the river up'], answer: 1, why: 'The same volume still passes, but spread over a longer time. The peak is lower, and it may stay inside the banks.' },
  ],
  reel: [
    { ms: 5500, caption: 'After a storm the river rises to a peak, hours later, and then falls. That curve is its hydrograph.', set: { rain: 60, hours: 3, land: 'farm', wet: 'normal', straight: false, store: false, run: 0 }, view: reelView(3.6, 1.15), spin: 0 },
    { ms: 6000, caption: 'Pave the catchment and straighten the channels, and the same rain gives a higher, earlier peak.', set: { rain: 60, hours: 3, land: 'town', wet: 'normal', straight: true, store: false, run: 1 }, view: reelView(3.6, 1.15), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const sec = makeSection(root, { ...SEC, sx: 0.08, sy: 0.4, D: 3, y0: 1.05 });
    const r = rng(9);
    [[14, 0.6], [24, -0.5], [33, 0.7], [42, -0.3], [51, 0.5], [20, -1.1], [38, 1.1]].forEach(([m, z], i) => { const h = house(0.42, i % 2 ? 0xe9d8b8 : 0xd8c4a0); h.position.set(sec.X(3 + m), sec.Y(0), z); root.add(h); });
    [[-12, 0.8], [-22, -0.6], [-31, 0.4], [-44, -0.9], [-55, 0.9], [-38, 1.1], [-17, -1.1]].forEach(([m, z]) => { const t = tree(1.3 + r() * 0.6); t.position.set(sec.X(m - 3), sec.Y(0), z); root.add(t); });
    const rain = makeRain(root, 320, { x0: -5.6, x1: 5.6, y0: 1.2, y1: 3.7, z0: -1.5, z1: 1.5 }, { slant: 0.06 });
    const lFlow = stage.label('', [0, sec.Y(0) + 1.25, 1.5], root, 'hot');
    const minor = [stage.label('Floodplain', [sec.X(-40), sec.Y(0) + 0.9, 1.5], root), stage.label('Bankfull: top of the banks', [sec.X(5), sec.Y(0) - 0.32, 1.52], root), stage.label('Heights drawn 5× larger than widths', [sec.X(42), sec.Y(0) - 0.75, 1.52], root)];

    let cur = null;
    const brd = board(root, BW, BH, ...BPX, (g, w, h) => {
      panelBg(g, w, h);
      if (!cur) return;
      const { H, B, t, s } = cur;
      title(g, 'River flow after the storm', `Gold: ${LNAME[s.land].toLowerCase()}${s.straight ? ', straightened' : ''}${s.store ? ', with wetlands' : ''}. Grey: plain farmland.`);
      const top = Math.max(20, Math.ceil((Math.max(H.peak, B.peak) * 1.18) / 10) * 10), step = top <= 40 ? 10 : top <= 100 ? 20 : 50;
      const yT = []; for (let v = 0; v <= top; v += step) yT.push(v);
      const ax = axes(g, w, h, { xMax: SPAN, yMax: top, xTicks: [0, 4, 8, 12, 16, 20, 24], yTicks: yT, xFmt: (v) => v + ' h', yLabel: 'flow, m³/s', xLabel: 'hours since the rain began', y1: 132 });
      const rr = s.rain / s.hours; g.fillStyle = 'rgba(159,208,255,.55)'; g.fillRect(ax.X(0), ax.y1, ax.X(s.hours) - ax.X(0), Math.min(64, 14 + rr * 0.8));
      g.fillStyle = COL.rain; g.font = '20px sans-serif'; g.fillText(`rain: ${Math.round(rr)} mm an hour for ${s.hours} h`, ax.X(s.hours) + 12, ax.y1 + 24);
      const trace = (hy) => { for (let i = 0; i * hy.dt <= SPAN; i++) { const x = ax.X(i * hy.dt), y = ax.Y(Math.min(top, hy.q[i])); i ? g.lineTo(x, y) : g.moveTo(x, y); } };
      g.beginPath(); trace(B); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.stroke();
      g.save(); g.beginPath(); g.rect(ax.x0, ax.y1, ax.x1 - ax.x0, ax.Y(BF) - ax.y1); g.clip(); g.beginPath(); g.moveTo(ax.X(0), ax.Y(0)); for (let i = 0; i * H.dt <= SPAN; i++) g.lineTo(ax.X(i * H.dt), ax.Y(Math.min(top, H.q[i]))); g.lineTo(ax.X(SPAN), ax.Y(0)); g.closePath(); g.fillStyle = 'rgba(255,90,138,.38)'; g.fill(); g.restore();
      g.beginPath(); trace(H); g.strokeStyle = COL.gold; g.lineWidth = 5; g.stroke();
      g.setLineDash([10, 8]); g.strokeStyle = COL.bad; g.lineWidth = 2; g.beginPath(); g.moveTo(ax.x0, ax.Y(BF)); g.lineTo(ax.x1, ax.Y(BF)); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.bad; g.font = '19px sans-serif'; const bt = `bankfull ${BF.toFixed(1)} m³/s`; g.fillText(bt, ax.x1 - g.measureText(bt).width - 6, ax.Y(BF) - 8);
      if (H.peak > CATCH.base + 0.3) { g.fillStyle = COL.gold; g.font = 'bold 23px sans-serif'; const tx = `peak ${H.peak.toFixed(0)} m³/s at ${H.tPeak.toFixed(1)} h`; g.fillText(tx, clamp(ax.X(H.tPeak) + 16, ax.x0, ax.x1 - g.measureText(tx).width), Math.max(ax.y1 + 70, ax.Y(Math.min(top, H.peak)) - 10)); }
      dot(g, ax.X(Math.min(t, SPAN)), ax.Y(Math.min(top, H.at(t))), '#fff', 9);
    }, [0, 0, 0]);

    let key = '', H = null, B = null, t = 0, clock = 0, tick = 0;
    const st = { q: CATCH.base, t: 0 };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        layout(stage, brd, { minor, modelTop: 3.6, bs: 1.15 });
        const k2 = `${s.rain}|${s.hours}|${s.land}|${s.wet}|${s.straight}|${s.store}|${s.run}`;
        if (k2 !== key) { const first = !key; key = k2; H = model(s); B = baseline(s); if (first || inReel() || clock > PLAY * 0.6) clock = 0; }
        const play = inReel() ? 4.4 : PLAY;
        clock += dt; if (clock > play + HOLD) clock = 0;
        t = clamp(clock / play, 0, 1) * SPAN;
        const q = H.at(t), y = stageFor(q, SEC);
        st.q = q; st.t = t;
        sec.setWater(y);
        const raining = t < s.hours;
        rain.update(dt, raining ? clamp(s.rain / s.hours / 40, 0.2, 1) : 0);
        tick += dt; if (tick > 0.1 || !cur) { tick = 0; cur = { H, B, t, s: { ...s } }; brd.redraw(); }
        lFlow.element.innerHTML = `Hour ${t.toFixed(0)}: <b>${q.toFixed(1)} m³/s</b>${y > SEC.bd ? `, ${(y - SEC.bd).toFixed(2)} m over the banks` : ''}`;
      },
      dispose() { stage.setShift(0, 0); },
      readout: (s) => {
        if (!H) return '';
        let over = 0; for (let i = 0; i < H.n; i++) if (H.q[i] > BF) over += H.dt;
        const depth = stageFor(H.peak, SEC) - SEC.bd, ratio = H.peak / Math.max(0.01, B.peak), dT = H.tPeak - B.tPeak, flat = H.peak < CATCH.base + 0.3;
        return `<div class="big">${flat ? 'Hardly a ripple' : H.peak > BF ? 'The river spills' : 'It stays in its banks'}</div>
          <div class="row"><span>Runoff</span><b>${H.runoff.toFixed(0)} of ${s.rain} mm</b></div>
          <div class="row"><span>Peak flow</span><b>${H.peak.toFixed(1)} m³/s</b></div>
          <div class="row"><span>Peak at</span><b>${flat ? 'no peak' : 'hour ' + H.tPeak.toFixed(1)}</b></div>
          <div class="row"><span>Lag</span><b>${H.lag.toFixed(1)} h</b></div>
          <div class="row"><span>Bankfull</span><b>${BF.toFixed(1)} m³/s</b></div>
          <div class="row"><span>Over the banks</span><b class="${over > 0 ? 'no' : 'ok'}">${over > 0 ? `${over.toFixed(1)} h, ${depth.toFixed(2)} m deep` : 'not at all'}</b></div>
          ${flat || B.peak < CATCH.base + 0.3 || (s.land === 'farm' && !s.straight && !s.store) ? '' : `<div class="row"><span>Against farmland</span><b>${ratio.toFixed(1)}× peak, ${Math.abs(dT) < 0.05 ? 'same time' : `${Math.abs(dT).toFixed(1)} h ${dT < 0 ? 'earlier' : 'later'}`}</b></div>`}
          ${fine('<small>A catchment of 8 km². NRCS methods.</small>')}`;
      },
    };
  },
};
