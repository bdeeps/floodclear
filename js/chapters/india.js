// Chapter 6: floods in India, and staying safe.
// The map is a rough hand-drawn outline with a few rivers (flood.js). It shows no borders.
// Event figures (all hedged in the text; sources are listed in history.json):
//   Assam: 31.05 lakh hectares, 39.58 % of the state, is flood-prone (Rashtriya Barh Ayog, quoted
//     by the Assam Water Resources Department);
//   Kosi, 18 August 2008: breach at Kusaha, Nepal; about 3 million people affected in Bihar
//     (3.3 million in the World Bank/GFDRR needs assessment); 434 to about 500 deaths reported;
//   Mumbai, 26 July 2005: 944 mm in 24 h at Santacruz (IMD); about 1,094 deaths across Maharashtra;
//   Uttarakhand, 16–17 June 2013: more than 5,700 people presumed dead (state government);
//   Chennai, 1–2 December 2015: about 490 mm in 24 h at Tambaram; 421 deaths recorded in Tamil Nadu
//     over the season;
//   Kerala, August 2018: 758.6 mm from 1 to 19 August against a normal 287.6 mm (CWC study);
//     433 deaths from 22 May to 29 August (post-disaster needs assessment), later counts higher;
//   Sikkim, 3–4 October 2023: 14.7 million m³ of moraine into South Lhonak lake, about 50 million m³
//     of water released, 55 dead and 70 missing in Sattar and others (Science, 2025).
// The street model works out the hazard of moving water with personHazard() and carHazard() in
// flood.js. Check against public advice: NDMA says six inches (15 cm) of moving water can make you
// fall; the US National Weather Service says 12 inches (30 cm) of rushing water can carry away most
// cars and 2 feet (60 cm) can carry away SUVs and trucks.
// Scale here: 1 unit = 1 metre.
import { THREE, M, box, swarm, arrow, clamp, approach } from '../kit.js';
import { personHazard, carHazard, CARS, G, person, car, block, waterMat, board, panelBg, wrap, layout, BW, BH, BPX, reelView, fine, fmtN, rng, INDIA, RIVERS, COL } from '../flood.js';

export const EVENTS = {
  assam: { name: 'Brahmaputra, Assam', when: 'Most monsoons', kind: 'River flood', at: [92.6, 26.4], text: 'The Brahmaputra is wide, braided and heavy with silt. About 40 % of Assam is flood-prone. The great earthquake of 1950 raised the river bed, and floods and bank erosion have been worse since.' },
  kosi: { name: 'Kosi, Bihar', when: '18 August 2008', kind: 'Embankment breach', at: [86.93, 26.52], text: 'The Kosi broke its eastern embankment at Kusaha in Nepal and poured down an old course across north Bihar, far from its walled channel. About 3 million people were affected. About 500 deaths were reported.' },
  mumbai: { name: 'Mumbai', when: '26 July 2005', kind: 'Urban flood', at: [72.88, 19.08], text: 'Santacruz recorded 944 mm of rain in 24 hours (IMD). Drains built for about 25 mm an hour could not cope, and high tide blocked the outfalls. About 1,000 people died across Maharashtra.' },
  uttarakhand: { name: 'Kedarnath, Uttarakhand', when: '16–17 June 2013', kind: 'Flash flood and lake outburst', at: [79.07, 30.73], text: 'Very heavy early-monsoon rain fell on melting snow. Then the small Chorabari lake above Kedarnath burst its moraine. More than 5,700 people were presumed dead, many of them pilgrims.' },
  chennai: { name: 'Chennai', when: '1–2 December 2015', kind: 'Urban flood', at: [80.27, 13.08], text: 'About 490 mm fell in a day at Tambaram, after weeks of rain. Lakes and marshland that once stored water had been built over, and a full reservoir had to release water. More than 400 deaths were recorded in Tamil Nadu that season.' },
  kerala: { name: 'Kerala', when: 'August 2018', kind: 'River floods and landslides', at: [76.6, 10.1], text: 'From 1 to 19 August Kerala had 758.6 mm of rain against a normal 287.6 mm (CWC). Reservoirs were already full, and gates were opened at 35 dams. 433 deaths were officially counted by the end of August.' },
  sikkim: { name: 'South Lhonak lake, Sikkim', when: '3–4 October 2023', kind: 'Glacial lake outburst flood', at: [88.2, 27.91], text: 'About 14.7 million m³ of frozen moraine slid into the lake. Some 50 million m³ of water went down the Teesta and destroyed the Teesta III dam at Chungthang. One study counts 55 dead and 70 missing; other counts are higher.' },
};
const ORDER = ['assam', 'kosi', 'mumbai', 'uttarakhand', 'chennai', 'kerala', 'sikkim'];
const WORD = ['Low hazard', 'Unsafe for children', 'Unsafe for adults', 'Unsafe for everyone'];

export default {
  id: 'india',
  short: 'India and safety',
  title: 'Floods in India, and staying safe',
  subtitle: 'Most of India’s rain falls in four months. Warnings and a few simple rules save lives.',
  view: { pos: [0, 5.9, 13.4], target: [0, 4.75, 0] },
  learn: `<p>India gets about three-quarters of its yearly rain in the four months of the <b>south-west monsoon</b>, June to September. That is what fills its rivers and fields. It is also why floods come every year. The National Disaster Management Authority (NDMA) counts more than <b>40 million hectares</b>, about an eighth of the country, as flood-prone.</p>
    <p>Every kind of flood from chapter 4 has struck here. Choose one below to see it on the map. These were real disasters, and the numbers are of people. Counts differ between sources, so treat each as the best available estimate.</p>
    <p><b>Brahmaputra, Assam</b>: most monsoons. About 40 % of the state is flood-prone.<br>
    <b>Kosi, Bihar</b>, 18 August 2008: the river broke its embankment at Kusaha and took an old course. About 3 million people were affected.<br>
    <b>Mumbai</b>, 26 July 2005: 944 mm of rain in 24 hours overwhelmed the drains.<br>
    <b>Uttarakhand</b>, June 2013: very heavy early rain on melting snow, and a lake outburst above Kedarnath. More than 5,700 people were presumed dead.<br>
    <b>Chennai</b>, December 2015: about 490 mm in a day on a city that had built over its lakes and marshes.<br>
    <b>Kerala</b>, August 2018: two and a half times the normal rain on full reservoirs.<br>
    <b>Sikkim</b>, October 2023: South Lhonak glacial lake burst and destroyed a large dam on the Teesta.</p>
    <p><b>Who warns you.</b> The <b>India Meteorological Department (IMD)</b> forecasts rain and issues colour-coded warnings: yellow (be aware), orange (be prepared) and red (take action). The <b>Central Water Commission (CWC)</b> has forecast river levels since 1958, when it began with one station on the Yamuna at Delhi. It now forecasts at about 340 stations and flags a river as above normal, severe or extreme.</p>
    <p><b>What to do</b> (from NDMA's guidance):</p>
    <p><b>Before.</b> Know your nearest high ground and the way to it. Keep a kit: drinking water, dry food, medicines, a torch, a charged phone, and papers in a waterproof bag.<br>
    <b>When a flood is coming.</b> Move to <b>higher ground</b> at once. Do not wait to see the water. Switch off <b>electricity and gas</b> at the mains.<br>
    <b>Never walk or drive through moving water.</b> NDMA warns that just <b>15 cm</b> of moving water can make you fall. About 30 cm can carry off a small car, and 60 cm can carry off most vehicles (US National Weather Service). You also cannot see open manholes or washed-out road under muddy water.<br>
    <b>Afterwards.</b> Stay away from fallen power lines. Drink only <b>boiled or chlorinated</b> water: flood water carries sewage. Watch for <b>snakes</b>, which shelter in dry places, including houses. Go back only when the authorities say it is safe.</p>
    <p>In an emergency call <b>112</b>. NDMA's helpline is <b>1078</b>.</p>
    <p>Related boxes: CycloneClear (storm surge), StormClear (how rain forms), TsunamiClear, LandslideClear, EarthquakeClear, BuoyancyClear (why a car floats), and the two built alongside this one, VolcanoClear and DroughtClear.</p>
    <p class="tip"><b>Try it:</b> set the water to 0.15 m deep and raise the speed. Then make it 0.4 m deep and watch the car.</p>`,
  terms: [
    { t: 'Monsoon', d: 'A seasonal wind that brings a rainy season. India’s south-west monsoon runs from June to September.' },
    { t: 'IMD', d: 'India Meteorological Department: forecasts weather and issues rainfall warnings.' },
    { t: 'CWC', d: 'Central Water Commission: measures India’s rivers and forecasts flood levels.' },
    { t: 'NDMA', d: 'National Disaster Management Authority, set up under the Disaster Management Act of 2005.' },
    { t: 'Danger level', d: 'A marked river level at a station. At or above it, CWC calls the flood severe.' },
    { t: 'Depth × speed', d: 'Depth of water multiplied by its speed: a simple measure of how dangerous it is to stand in.' },
  ],
  defaults: { depth: 0.15, speed: 2, car: 'small', ev: 'mumbai' },
  controls: [
    { key: 'depth', type: 'range', label: 'Depth of water on the road', min: 0, max: 1.2, step: 0.05, fmt: (v) => `${Math.round(v * 100)} cm` },
    { key: 'speed', type: 'range', label: 'Speed of the water', min: 0, max: 4, step: 0.1, fmt: (v) => `${v.toFixed(1)} m/s · ${(v * 3.6).toFixed(0)} km/h` },
    { key: 'car', type: 'seg', label: 'Vehicle', options: [{ v: 'small', label: 'Small car, 1,000 kg' }, { v: 'suv', label: 'SUV, 1,900 kg' }] },
    { key: 'pick', type: 'buttons', label: 'Floods on the map', items: ORDER.map((k) => ({ label: EVENTS[k].name.split(',')[0], act: (s) => { s.ev = k; } })) },
  ],
  quiz: [
    { q: 'You are driving and the road ahead is under moving water of unknown depth. What should you do?', options: ['Drive through fast', 'Drive through slowly', 'Turn round and find another way', 'Follow the car in front'], answer: 2, why: 'About 30 cm of moving water can float and carry off a small car, and you cannot see whether the road is still there. Turn round.' },
    { q: 'How deep must moving water be to knock a person over?', options: ['At least 2 m', 'About 1 m', 'As little as 15 cm if it is fast', 'It cannot'], answer: 2, why: 'The push of water grows with the square of its speed. NDMA warns that six inches of moving water can make you fall.' },
    { q: 'After a flood, why should you drink only boiled or chlorinated water?', options: ['Flood water is too cold', 'Flood water is mixed with sewage and can spread disease', 'Tap water runs out of minerals', 'It tastes better'], answer: 1, why: 'Floods overflow drains and toilets into wells and pipes. Cholera, typhoid and other diseases often follow unless water is treated.' },
  ],
  reel: [
    { ms: 6000, caption: 'Just 15 cm of fast water can knock you down, and 30 cm can carry off a car. Never walk or drive into it.', set: { depth: 0.05, speed: 2.6, car: 'small', ev: 'mumbai' }, anim: { depth: [0.05, 0.6] }, view: reelView(3.6, 1.15, 0, 1.3), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---- the street
    const road = box(11.2, 0.3, 5, M.matte(0x4d525c)); road.position.y = -0.15; root.add(road);
    const kerb = box(11.2, 0.18, 0.5, M.matte(0x9a9fa8)); kerb.position.set(0, 0.09, -2.25); root.add(kerb);
    const r = rng(8);
    [-4.4, -2.1, 0.3, 2.6, 4.6].forEach((x, i) => { const b = block(1.8, 2 + r() * 1.1, 1.4, i % 2 ? 0xd9dde4 : 0xc8ccd6); b.position.set(x, 0.18, -3.3); b.scale.setScalar(1); root.add(b); });
    for (let i = 0; i < 6; i++) { const d = box(1, 0.012, 0.12, M.glow(0xe8e2c0)); d.position.set(-5 + i * 2, 0.008, 0.3); d.castShadow = false; root.add(d); }
    const water = new THREE.Mesh(new THREE.BoxGeometry(11.2, 1, 5), waterMat(0x7d8f9a, 0.72)); water.renderOrder = 2; root.add(water);
    const ND = 90, dots = swarm(ND, new THREE.BoxGeometry(0.28, 0.02, 0.05), M.glow(0xd8ecff, { transparent: true, opacity: 0.8 })); dots.castShadow = false; root.add(dots);
    const dp = Array.from({ length: ND }, () => [(r() - 0.5) * 11, (r() - 0.5) * 4.6, 0.7 + r() * 0.6]);
    const man = person(1, 0xd8a23a); man.position.set(-2.6, 0, 1.2); root.add(man);
    const kid = person(0.68, 0x5fb0e8); kid.position.set(-3.5, 0, 1.5); root.add(kid);
    const cars = { small: car(CARS.small, 0xd94f4f), suv: car(CARS.suv, 0x3d6fd9) };
    Object.values(cars).forEach((c) => { c.position.set(1.6, 0, -0.4); root.add(c); });
    const push = arrow(0xff7a59, 1, 0.3, 0.05); push.rotation.z = -Math.PI / 2; root.add(push);
    const lMan = stage.label('', [-2.9, 2.25, 1.2], root), lCar = stage.label('', [2.2, 2.3, -0.4], root);
    const minor = [stage.label('Water flows this way →', [-4.6, 0.5, 2.6], root)];

    // ---- map of India with the chosen flood
    let ev = 'mumbai', pulse = 0;
    const brd = board(root, BW, BH, ...BPX, (g, w, h) => {
      panelBg(g, w, h);
      const mw = 540, P = (lo, la) => [18 + ((lo - 67) / 31) * (mw - 20), 22 + ((37 - la) / 31) * (h - 60)];
      const path = (pts) => { g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
      path(INDIA); g.closePath(); g.fillStyle = '#2f5a45'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke();
      g.lineCap = g.lineJoin = 'round';
      for (const [nm, pts] of Object.entries(RIVERS)) { path(pts); g.strokeStyle = COL.water; g.lineWidth = nm === 'Ganga' || nm === 'Brahmaputra' ? 4 : 2.5; g.stroke(); }
      g.fillStyle = COL.rain; g.font = '17px sans-serif';
      [['Ganga', 80.2, 24.4], ['Brahmaputra', 90.6, 30.4], ['Kosi', 84.4, 27.6]].forEach(([t, lo, la]) => { const [x, y] = P(lo, la); g.fillText(t, x, y); });
      ORDER.forEach((k) => { const [x, y] = P(...EVENTS[k].at), on = k === ev; g.beginPath(); g.arc(x, y, on ? 11 : 6, 0, Math.PI * 2); g.fillStyle = on ? COL.gold : 'rgba(255,255,255,.75)'; g.fill(); if (on) { g.strokeStyle = COL.gold; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 18 + pulse * 10, 0, Math.PI * 2); g.globalAlpha = 1 - pulse; g.stroke(); g.globalAlpha = 1; } });
      g.fillStyle = COL.soft; g.font = '16px sans-serif'; g.fillText('A rough sketch map. It shows no borders.', 18, h - 14);
      const E = EVENTS[ev], x0 = mw + 16, mwid = w - x0 - 22;
      g.fillStyle = COL.gold; g.font = 'bold 19px sans-serif'; let y = wrap(g, E.kind.toUpperCase(), x0, 46, mwid, 24);
      g.fillStyle = COL.text; g.font = 'bold 32px sans-serif'; y = wrap(g, E.name, x0, y + 22, mwid, 38);
      g.fillStyle = COL.e; g.font = '24px sans-serif'; g.fillText(E.when, x0, y - 2); y += 40;
      g.fillStyle = COL.text; g.font = '21px sans-serif'; wrap(g, E.text, x0, y, mwid, 28);
    }, [0, 0, 0]);

    let slide = 0, bob = 0, tick = 0, shown = '';
    const st = { p: personHazard(0.15, 2), c: carHazard(0.15, 2, CARS.small) };
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        layout(stage, brd, { minor, modelTop: 3.6, bs: 1.15, base: 1.3 });
        pulse = (pulse + dt * 0.8) % 1; tick += dt;
        if (s.ev !== shown || tick > 0.12) { shown = ev = s.ev; tick = 0; brd.redraw(); }
        const d = s.depth, v = s.speed, C = CARS[s.car], p = personHazard(d, v), c = carHazard(d, v, C);
        st.p = p; st.c = c;
        water.visible = d > 0.005; water.scale.y = Math.max(0.005, d); water.position.y = d / 2;
        for (let i = 0; i < ND; i++) { const q = dp[i]; q[0] += dt * v * q[2]; if (q[0] > 5.5) q[0] = -5.5; dots.place(i, [q[0], d + 0.012, q[1]], null, d > 0.005 && v > 0.05 ? 1 : 0.0001); }
        dots.done();
        // people lean as the hazard grows; the arrow is the push on an adult's legs
        man.rotation.z = approach(man.rotation.z, -[0, 0.06, 0.3, 0.7][p.level], 4, dt);
        kid.rotation.z = approach(kid.rotation.z, -[0, 0.45, 0.8, 1.1][p.level], 4, dt);
        push.set(clamp(p.push / 400, 0, 2.2)); push.position.set(-2.4, Math.max(0.12, Math.min(d, 1) * 0.5), 1.55);
        // the car: lifts as it floats, drifts when it slides
        Object.entries(cars).forEach(([k, m]) => { m.visible = k === s.car; });
        const m = cars[s.car];
        bob += dt;
        if (c.state > 0) slide += dt * v * (c.state === 2 ? 0.6 : 0.25); else slide = approach(slide, 0, 3, dt);
        if (slide > 2.2) slide = 0;
        m.position.x = 1.6 + slide;
        m.position.y = approach(m.position.y, c.state === 2 ? Math.max(0, d - c.floatAt) + Math.sin(bob * 2.4) * 0.03 : 0, 4, dt);
        m.rotation.z = c.state === 2 ? Math.sin(bob * 1.7) * 0.04 : 0; m.rotation.y = c.state > 0 ? Math.sin(bob * 0.9) * 0.12 : 0;
        lMan.element.innerHTML = `${WORD[p.level]}`; lMan.element.classList.toggle('hot', p.level > 0);
        lCar.element.innerHTML = c.state === 2 ? '<b>Floating</b>' : c.state === 1 ? '<b>Sliding</b>' : `Water carries ${Math.round(c.lift * 100)} % of its weight`;
        lCar.element.classList.toggle('hot', c.state > 0); lCar.position.x = m.position.x;
      },
      dispose() { stage.setShift(0, 0); },
      readout: (s) => {
        const p = st.p, c = st.c, C = CARS[s.car];
        return `<div class="big">${s.depth < 0.01 ? 'Dry road' : WORD[p.level]}</div>
          <div class="row"><span>Depth × speed</span><b>${p.dv.toFixed(2)} m²/s</b></div>
          <div class="row"><span>Child</span><b class="${p.level >= 1 ? 'no' : 'ok'}">${p.level >= 1 ? 'can be swept away' : 'low hazard'}</b></div>
          <div class="row"><span>Adult</span><b class="${p.level >= 2 ? 'no' : 'ok'}">${p.level >= 2 ? 'can be swept away' : p.level === 1 ? 'hard to stand' : 'low hazard'}</b></div>
          <div class="row"><span>Push on legs</span><b>${fmtN(p.push)} N · ${fmtN(p.push / G)} kgf</b></div>
          <div class="row"><span>Car’s weight on water</span><b>${Math.round(c.lift * 100)} %</b></div>
          <div class="row"><span>${C.name}</span><b class="${c.state ? 'no' : 'ok'}">${['tyres still grip', 'slides away', 'floats away'][c.state]}</b></div>
          ${fine(`<small>It floats at about ${Math.round(c.floatAt * 100)} cm. A rough model.</small>`)}`;
      },
    };
  },
};
