// Chapter 2: where the rain goes. A water budget for one patch of ground through one storm,
// by the SCS (NRCS) curve-number method (runoff() and SURFACES in flood.js; USDA TR-55, 1986):
//   rain = caught at the start + soaked in + runoff.
// The method gives the runoff. What does not run off is split here into two parts:
//   caught on leaves and in puddles (interception and depression storage), up to a small capacity
//     for each surface: forest 6 mm, farmland 4 mm, bare soil 3 mm, paving 1.5 mm. These are round,
//     typical values (design manuals give about 1.5 to 3 mm for paving and 2.5 to 10 mm for
//     vegetated ground). This water evaporates afterwards;
//   soaked into the soil: the rest.
// Evaporation while the rain is actually falling is small and is not counted separately.
// The method is applied to the running total as the storm goes on, which is its standard use.
// 1 mm of water on 1 hectare is 10 m³ = 10,000 litres.
import { THREE, M, box, swarm, clamp } from '../kit.js';
import { runoff, cnFor, SURFACES, makeRain, tree, block, cloud, waterMat, board, panelBg, title, axes, dot, layout, BW, BH, BPX, reelView, fine, fmtN, rng, COL } from '../flood.js';

const KINDS = ['forest', 'farm', 'bare', 'city'];
const STORM = 9, HOLD = 3.5;                 // seconds of animation: rain, then a pause
const PW = 5, BD = 3, TOP = 2.2, SOILH = 1.5;
const CATCH_MM = { forest: 6, farm: 4, bare: 3, city: 1.5 };
const split = (P, cn, surface) => { const b = runoff(P, cn), caught = Math.min(P - b.Q, CATCH_MM[surface]); return { ...b, caught, soak: Math.max(0, P - b.Q - caught) }; };
const WETNAME = { dry: 'dry', normal: 'damp', soaked: 'already soaked' };

export default {
  id: 'budget',
  short: 'Where rain goes',
  title: 'Where the rain goes',
  subtitle: 'The same storm can vanish into one field and pour off the next.',
  view: { pos: [0, 5.9, 13.4], target: [0, 4.75, 0] },
  learn: `<p>Rain that lands on a patch of ground has to go somewhere. Hydrologists keep a <b>water budget</b>, like a bank statement: <b>rain in = caught + soaked in + runoff</b>.</p>
    <p><b>Caught.</b> The first rain wets leaves, fills hollows and sits in puddles. Most of that goes back to the air later by <b>evaporation</b>. A forest catches a lot. A car park catches almost nothing.</p>
    <p><b>Soaked in.</b> Water sinks into the gaps between soil grains. This is <b>infiltration</b>. Roots, worms and leaf litter keep those gaps open. Bare, hard-packed soil lets less in. Concrete and tar let in almost none.</p>
    <p><b>Runoff.</b> Whatever cannot be caught or soaked in flows away over the surface. This is the part that makes floods.</p>
    <p>Two things decide the split. One is the <b>surface</b>. The other is <b>how wet the soil already is</b>. Soil is like a sponge: once its gaps are full, it is <b>saturated</b>, and even a forest starts to shed water. That is why the tenth day of monsoon rain can flood a valley that the first day did not.</p>
    <p>The model uses the <b>curve number</b> method, worked out by the US Soil Conservation Service in the 1950s and still used by engineers everywhere. Each surface gets a number up to 100. The higher it is, the more runs off.</p>
    <p>Notice the storm itself: early rain is caught and soaked up, and the runoff starts late and then grows. The last hour of a storm does far more harm than the first.</p>
    <p class="tip"><b>Try it:</b> send a 60 mm storm onto dry forest, then onto a paved city. Then go back to the forest and make the soil already soaked.</p>`,
  terms: [
    { t: 'Water budget', d: 'An account of where water goes: rain in equals water caught, soaked in and run off.' },
    { t: 'Infiltration', d: 'Water soaking down into the soil.' },
    { t: 'Evaporation', d: 'Liquid water turning to vapour and going back into the air. Plants add to it through their leaves.' },
    { t: 'Runoff', d: 'Rain that flows away over the surface.' },
    { t: 'Saturated', d: 'Soil whose gaps are full of water, so it cannot take in any more.' },
    { t: 'Curve number', d: 'A score up to 100 for how readily a surface sheds rain. Forest is about 55, paving 98.' },
    { t: 'Impervious', d: 'A surface that water cannot pass through, such as concrete, tar or a roof.' },
  ],
  defaults: { rain: 60, surface: 'forest', wet: 'normal', run: 0 },
  controls: [
    { key: 'rain', type: 'range', label: 'Rain in this storm', min: 10, max: 200, step: 5, fmt: (v) => `${v} mm` },
    { key: 'surface', type: 'seg', label: 'Surface', options: [{ v: 'forest', label: 'Forest' }, { v: 'farm', label: 'Farmland' }, { v: 'bare', label: 'Bare soil' }, { v: 'city', label: 'Paved city' }] },
    { key: 'wet', type: 'seg', label: 'Soil before the storm', options: [{ v: 'dry', label: 'Dry' }, { v: 'normal', label: 'Damp' }, { v: 'soaked', label: 'Already soaked' }] },
    { key: 'go', type: 'buttons', label: 'Storm', items: [{ label: 'Run the storm again', act: (s) => { s.run = (s.run || 0) + 1; } }] },
  ],
  quiz: [
    { q: 'A storm drops 60 mm on a forest and on a paved car park. Where does more water run off?', options: ['The forest', 'The car park', 'Exactly the same', 'Neither'], answer: 1, why: 'Paving is impervious: almost nothing soaks in, so nearly all 60 mm runs off. In a damp forest only a millimetre or two does.' },
    { q: 'Why can the tenth day of heavy rain cause a flood when the first day did not?', options: ['Rain gets heavier each day', 'The soil is saturated, so more of the rain runs off', 'Rivers shrink in the rain', 'Evaporation stops for ever'], answer: 1, why: 'Soil can only hold so much. Once its gaps are full, new rain has nowhere to go but over the surface.' },
    { q: 'In a water budget, rain in equals…', options: ['Runoff only', 'Caught plus soaked in plus runoff', 'Evaporation minus runoff', 'River flow times two'], answer: 1, why: 'Water is not created or destroyed. Every millimetre that falls is caught, soaks in or runs off.' },
  ],
  reel: [
    { ms: 6000, caption: 'A forest soaks up most of a storm. Paving sends nearly all of it straight to the drains.', set: { rain: 80, surface: 'forest', wet: 'normal', run: 0 }, anim: { surface: ['forest', 'city'] }, view: reelView(5), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const patch = new THREE.Group(); patch.rotation.z = -0.07; patch.position.set(-0.6, 0, 0); root.add(patch);
    // ---- soil block with a wetting front
    const soil = box(PW, SOILH, BD, M.matte(0x8a6a44)); soil.position.y = TOP - SOILH / 2; patch.add(soil);
    const rock = box(PW, 0.25, BD, M.matte(0x5a5d66)); rock.position.y = TOP - SOILH - 0.125; patch.add(rock);
    const wetMat = new THREE.MeshStandardMaterial({ color: 0x35506e, roughness: 0.7, transparent: true, opacity: 0.85 });
    const wet = new THREE.Mesh(new THREE.BoxGeometry(PW * 1.004, 1, BD * 1.004), wetMat); patch.add(wet);
    const old = new THREE.Mesh(new THREE.BoxGeometry(PW * 1.002, 1, BD * 1.002), new THREE.MeshStandardMaterial({ color: 0x4a5a66, roughness: 0.8, transparent: true, opacity: 0.6 })); patch.add(old);
    // ---- four surfaces
    const r = rng(5), skins = {};
    const skin = (col, h = 0.05) => { const g = new THREE.Group(), s = box(PW, h, BD, M.matte(col)); s.position.y = TOP + h / 2; g.add(s); patch.add(g); return g; };
    skins.forest = skin(0x3d7a3f);
    for (let i = 0; i < 16; i++) { const t = tree(1.5 + r() * 0.9, i % 3 ? 0x2f7d47 : 0x3f8f4f); t.position.set((r() - 0.5) * (PW - 0.6), TOP + 0.05, (r() - 0.5) * (BD - 0.5)); skins.forest.add(t); }
    skins.farm = skin(0x7d6a40);
    for (let i = 0; i < 9; i++) { const row = box(PW - 0.3, 0.14, 0.14, M.matte(0x86b04a)); row.position.set(0, TOP + 0.12, -BD / 2 + 0.25 + i * 0.31); skins.farm.add(row); }
    skins.bare = skin(0x9a7448);
    for (let i = 0; i < 12; i++) { const c = box(0.5 + r() * 0.6, 0.012, 0.03, M.matte(0x5e4428)); c.position.set((r() - 0.5) * (PW - 1), TOP + 0.056, (r() - 0.5) * (BD - 0.4)); c.rotation.y = r() * 3; c.castShadow = false; skins.bare.add(c); }
    skins.city = skin(0x565b66, 0.12);
    [[-1.6, -0.7, 1.3], [-0.2, -0.8, 0.9], [1.3, -0.7, 1.6]].forEach(([x, z, h], i) => { const b = block(0.9, h, 0.9, i % 2 ? 0xd9dde4 : 0xc8ccd6); b.position.set(x, TOP + 0.12, z); skins.city.add(b); });
    for (let i = 0; i < 6; i++) { const d = box(0.42, 0.012, 0.06, M.glow(0xe8e2c0)); d.position.set(-2 + i * 0.8, TOP + 0.127, 0.75); d.castShadow = false; skins.city.add(d); }
    // ---- runoff sheet, gutter and tank
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(PW, 1, BD), waterMat(0x58a8f0, 0.55)); sheet.renderOrder = 2; patch.add(sheet);
    const tank = new THREE.Group(); tank.position.set(3.25, 0, 0); root.add(tank);
    const glass = box(1.1, 2.2, BD * 0.8, M.clear(0xcfe8ff, 0.14)); glass.position.y = 1.1; glass.castShadow = false; tank.add(glass);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1, BD * 0.78), waterMat(0x2f86d8, 0.85)); tank.add(tw);
    const fall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, BD * 0.6), waterMat(0x58a8f0, 0.7)); root.add(fall);
    const ND = 70, dots = swarm(ND, new THREE.SphereGeometry(0.05, 8, 6), M.glow(0x8fd4ff)); dots.castShadow = false; patch.add(dots);
    const dp = Array.from({ length: ND }, () => [(r() - 0.5) * PW, (r() - 0.5) * (BD - 0.3), 0.6 + r() * 0.8]);
    // ---- evaporation wisps and rain
    const NW = 36, wisps = swarm(NW, new THREE.SphereGeometry(0.045, 6, 5), M.glow(0xffffff, { transparent: true, opacity: 0.5 })); wisps.castShadow = false; patch.add(wisps);
    const wp = Array.from({ length: NW }, () => [(r() - 0.5) * PW, r() * 1.6, (r() - 0.5) * BD, 0.25 + r() * 0.3]);
    const rain = makeRain(root, 420, { x0: -3.6, x1: 2.2, y0: TOP - 0.2, y1: 4.9, z0: -BD / 2, z1: BD / 2 }, { slant: 0.05 });
    const cl = cloud(4.6, 0x626c80); cl.position.set(-1.6, 5.05, 0); cl.scale.set(1, 0.55, 1); root.add(cl);

    const lRun = stage.label('', [3.25, 2.55, 0.9], root, 'hot');
    const lSoak = stage.label('', [-0.8, TOP - 0.9, BD / 2 + 0.1], root);
    const minor = [stage.label('Rain in', [-3.9, 4.2, 0], root), stage.label('Caught on leaves and in puddles', [-1.6, TOP + 1.7, 0.6], root)];

    let cur = null;
    const brd = board(root, BW, BH, ...BPX, (g, w, h) => {
      panelBg(g, w, h);
      if (!cur) return;
      title(g, `Where ${Math.round(cur.P)} mm of rain has gone`, `${SURFACES[cur.surface].name}, soil ${WETNAME[cur.wet]} · curve number ${Math.round(cur.cn)}`);
      const bx = 24, bw = w - 48, by = 96, bh = 42, tot = Math.max(1e-6, cur.P), parts = [['Caught', cur.b.caught, '#cfd8e6'], ['Soaked in', cur.b.soak, COL.soil], ['Runoff', cur.b.Q, COL.water]];
      let x = bx;
      g.font = '22px sans-serif';
      parts.forEach(([nm, v, c], i) => { const wv = (v / tot) * bw; g.fillStyle = c; g.fillRect(x, by, wv, bh); x += wv; const lx = bx + i * 290; g.fillRect(lx, by + 58, 20, 20); g.fillStyle = COL.text; g.fillText(`${nm} ${v.toFixed(v < 10 ? 1 : 0)} mm · ${Math.round((v / tot) * 100)} %`, lx + 28, by + 76); });
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
      const ax = axes(g, w, h, { xMax: 200, yMax: 200, xTicks: [0, 50, 100, 150, 200], yTicks: [0, 50, 100, 150, 200], yLabel: 'runoff, mm', xLabel: 'rain in the storm, mm', y1: 236 });
      KINDS.forEach((k) => { const cn = cnFor(SURFACES[k].cn, cur.wet), on = k === cur.surface; g.strokeStyle = on ? COL.gold : 'rgba(142,240,255,.45)'; g.lineWidth = on ? 5 : 2.5; g.beginPath(); for (let p = 0; p <= 200; p += 5) { const y = ax.Y(runoff(p, cn).Q); p ? g.lineTo(ax.X(p), y) : g.moveTo(ax.X(p), y); } g.stroke(); });
      g.font = '19px sans-serif';
      KINDS.forEach((k, i) => { const on = k === cur.surface; g.fillStyle = on ? COL.gold : COL.soft; g.fillText((on ? '● ' : '○ ') + SURFACES[k].name, ax.x0 + 16, ax.y1 + 62 + i * 25); });
      g.fillStyle = COL.gold; g.font = 'bold 22px sans-serif'; g.fillText(`Of each new mm now, ${Math.round(cur.now * 100)} % runs off`, ax.x0 + 16, ax.y1 + 26);
      dot(g, ax.X(cur.P), ax.Y(cur.b.Q), COL.gold);
    }, [0, 0, 0]);

    let t = 0, key = '', tick = 0;
    const st = { P: 0, b: split(0, 55, 'forest'), cn: 55, now: 0 };
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        layout(stage, brd, { minor, modelTop: 5 });
        const k2 = `${s.rain}|${s.wet}|${s.run}`;
        if (k2 !== key) { key = k2; t = 0; }
        t += dt; if (t > STORM + HOLD) t = 0;
        const raining = t < STORM, f = clamp(t / STORM, 0, 1), P = s.rain * f, cn = cnFor(SURFACES[s.surface].cn, s.wet), b = split(P, cn, s.surface);
        const x = Math.max(0, P - b.Ia), now = P > b.Ia ? (x * (x + 2 * b.S)) / ((x + b.S) * (x + b.S)) : 0;
        Object.assign(st, { P, b, cn, now });
        KINDS.forEach((k) => { skins[k].visible = k === s.surface; });
        // soil: old moisture from below, the new wetting front from above
        const city = s.surface === 'city', oldH = { dry: 0.02, normal: 0.45, soaked: 1.05 }[s.wet] * (SOILH - 0.05);
        old.scale.y = oldH; old.position.y = TOP - SOILH + oldH / 2;
        const room = SOILH - oldH - 0.02, wh = clamp(b.soak / 110, 0, 1) * room + (b.soak > 0.3 ? 0.03 : 0);
        wet.visible = wh > 0.01; wet.scale.y = Math.max(0.01, wh); wet.position.y = TOP - (city ? 0 : 0) - wh / 2;
        // runoff: a sheet of water on the surface, a fall into the tank, the tank level
        const flow = raining ? now * clamp(s.rain / 80, 0.25, 1.6) : 0, sh = (city ? 0.12 : 0.05) + 0.004;
        sheet.visible = flow > 0.01; sheet.scale.y = 0.02 + flow * 0.05; sheet.position.y = TOP + sh + sheet.scale.y / 2;
        const edgeX = patch.position.x + PW / 2 * Math.cos(0.07), edgeY = TOP - PW / 2 * Math.sin(0.07) + 0.05, lvl = clamp(b.Q / 200, 0, 1) * 2.1;
        tw.visible = lvl > 0.005; tw.scale.y = Math.max(0.005, lvl); tw.position.y = 0.03 + lvl / 2;
        fall.visible = flow > 0.01; fall.scale.set(0.5 + flow, Math.max(0.01, edgeY - lvl), 1); fall.position.set(edgeX + 0.38, (edgeY + lvl) / 2, 0);
        const show = Math.round(clamp(flow, 0, 1) * ND);
        for (let i = 0; i < ND; i++) { const p = dp[i]; p[0] += dt * (1.2 + 2.2 * flow) * p[2]; if (p[0] > PW / 2) p[0] = -PW / 2; dots.place(i, [p[0], TOP + sh + 0.05, p[1]], null, i < show ? 1 : 0.0001); }
        dots.done();
        const nw = Math.round(clamp(b.caught / 6, 0, 1) * NW * (raining ? 0.5 : 1));
        for (let i = 0; i < NW; i++) { const p = wp[i]; p[1] += dt * p[3]; if (p[1] > 1.9) p[1] = 0; wisps.place(i, [p[0], TOP + 0.2 + p[1], p[2]], null, i < nw ? 1 - p[1] / 2.2 : 0.0001); }
        wisps.done();
        rain.update(dt, raining ? clamp(s.rain / 110, 0.25, 1) : 0);
        cl.visible = raining;
        tick += dt; if (tick > 0.12 || !cur) { tick = 0; cur = { P, b, cn, now, surface: s.surface, wet: s.wet }; brd.redraw(); }
        lRun.element.innerHTML = `Runoff: <b>${b.Q.toFixed(b.Q < 10 ? 1 : 0)} mm</b>`;
        lSoak.element.innerHTML = city ? 'Sealed: almost nothing soaks in' : `Soaked in: <b>${b.soak.toFixed(0)} mm</b>`;
      },
      dispose() { stage.setShift(0, 0); },
      readout: (s) => {
        const b = st.b, end = runoff(s.rain, st.cn);
        return `<div class="big">${SURFACES[s.surface].name}, ${WETNAME[s.wet]}</div>
          <div class="row"><span>Rain so far</span><b>${st.P.toFixed(0)} of ${s.rain} mm</b></div>
          <div class="row"><span>Caught</span><b>${b.caught.toFixed(1)} mm</b></div>
          <div class="row"><span>Soaked in</span><b>${b.soak.toFixed(1)} mm</b></div>
          <div class="row"><span>Runoff</span><b>${b.Q.toFixed(1)} mm</b></div>
          <div class="row"><span>Whole storm</span><b class="${end.share > 0.5 ? 'no' : 'ok'}">${Math.round(end.share * 100)} % runs off</b></div>
          <div class="row"><span>From 1 hectare</span><b>${fmtN(end.Q * 10000)} litres</b></div>
          ${fine('<small>Curve-number method, USDA TR-55.</small>')}`;
      },
    };
  },
};
