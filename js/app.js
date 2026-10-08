(function () {
'use strict';

/* ---------- configuration ---------- */

const DATA_FILE = './_data/Core16_Density.csv';
const GEO_FILE = './_data/geochemistry_model_data.csv';
const SALINE = 42;             // cm; saline transition zone (from the profile figure)
const CORE_END = 165;          // cm; the CSV runs a little deeper than the physical core
const PURE_ICE = 917;          // kg/m³ reference density of bubble-free ice
const CM = 0.1;                // world units per cm
const GAP = 0.25;              // gap between sections (world units)
const RADIUS = 0.6;

// Researcher notes appear in a highlighted box on each tab when filled in.
const SEGMENTS = [
  { id: 'A1', top: 0,   bottom: 20,  video: 'Core A1 3D view with void analysis.mp4', notes: '' },
  { id: 'A2', top: 20,  bottom: 40,  video: 'Core A2 3D view with void analysis.mp4', notes: '' },
  { id: 'B1', top: 40,  bottom: 60,  video: 'Core B1 3D view with void analysis.mp4', notes: '' },
  { id: 'B2', top: 60,  bottom: 80,  video: 'Core B2 3D view with void analysis v2.mp4', notes: '' },
  { id: 'C1', top: 80,  bottom: 100, video: 'Core C1 3D view with void analysis.mp4', notes: '' },
  { id: 'C2', top: 100, bottom: 120, video: 'Core C2 3D view with void analysis v2.mp4', notes: '' },
  { id: 'D',  top: 120, bottom: 140, video: 'Core D 3D view with void analysis.mp4', notes: '' },
  { id: 'E',  top: 140, bottom: 165, video: 'Core E 3D view with void analysis.mp4', notes: '' },
];

// References cited in the Geochem tab. Fill `full` with the complete citation; until then the author-year form is shown.
const REFERENCES = [
  { cite: 'Arnone et al., 2023', full: '' },
  { cite: 'Ewert and Deming, 2013', full: 'Ewert, M. and Deming, J. W. (2013). Sea Ice Microorganisms: Environmental Constraints and Extracellular Responses. Biology.' },
  { cite: 'Jensen et al., 2021', full: '' },
  { cite: 'Jensen and Colombo, 2024', full: '' },
  { cite: 'Martinez-Ruiz et al., 2020', full: '' },
];

const METRICS = {
  porosity: { key: 'por',   lo: 'porLo', hi: 'porHi', unit: '%',     label: 'Porosity', digits: 2,
              stops: ['#16264f', '#2a6fd6', '#3fd1c5', '#ffd36b'] },
  density:  { key: 'den',   lo: 'denLo', hi: 'denHi', unit: 'kg/m³', label: 'Density',  digits: 0,
              stops: ['#ff5f8f', '#7b6cff', '#bfe6ff', '#ffffff'] },
  gi1:      { key: 'gi1', label: 'GI-1', unit: '0–1', stops: ['#f3eef8', '#7fb8c4', '#1f7a6f'] },
  gi2:      { key: 'gi2', label: 'GI-2', unit: '0–1', stops: ['#d73027', '#fee08b', '#1a9850'] },
  hab:      { key: 'hab', label: 'Habitat potential', unit: '0–1', stops: ['#0d0887', '#9c179e', '#ed7953', '#f0f921'] },
  brine:    { key: 'brine', lo: 'brLo',  hi: 'brHi',  unit: '%',     label: 'Brine',    digits: 2,
              stops: ['#10224a', '#2a6fd6', '#ff8a3d'] },
};
const JET = ['#3f6bff', '#22b8ff', '#2bd49a', '#e6e23a', '#ff8a1f', '#e0291b'];

/* ---------- helpers ---------- */

const $ = (s, r = document) => r.querySelector(s);
const fmt = (v, d = 1) => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function ramp(stops, t) {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2), f = t - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return a.map((v, k) => v + (b[k] - v) * f);
}
const css = c => `rgb(${c.map(Math.round).join(',')})`;

function rng(seed) {                       // mulberry32: deterministic, so the core looks the same every visit
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseCSV(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], parseFloat(v)])));
}

/* ---------- data ---------- */

let rows = [], geo = [], dom = {}, segs = [];

function prepare(raw, geoRaw) {
  rows = raw.filter(r => r.depth_cm < CORE_END).map(r => ({
    d: r.depth_cm,
    por: r.dl_porosity_percent, porLo: r.void_lower, porHi: r.void_upper,
    den: r.dl_density_kg_m3, denLo: r.dl_density_lower_kg_m3, denHi: r.dl_density_upper_kg_m3,
    brine: r.dl_brine_percent, brLo: r.brine_lower, brHi: r.brine_upper,
  }));
  dom = {
    porosity: [0, Math.max(...rows.map(r => r.porHi))],
    density: [Math.floor(Math.min(...rows.map(r => r.denLo)) / 10) * 10, 920],
    brine: [0, Math.max(0.5, ...rows.map(r => r.brHi))],
    gi1: [0, 1], gi2: [0, 1], hab: [0, 1],
  };
  const ok = v => Number.isFinite(v) ? v : null;
  geo = geoRaw.map((g, i) => {
    const top = g.depth, bottom = i < geoRaw.length - 1 ? geoRaw[i + 1].depth : CORE_END;
    return { top, bottom, mid: (top + bottom) / 2, gi1: ok(g.Microbial_Index), gi2: ok(g.Enrichment_Index), hab: ok(g.Activity_Index),
      baCa: ok(g.Ba_Ca_norm), mnFe: ok(g.Mn_Fe_norm), cuZn: ok(g.Cu_Zn_norm) };
  });
  rows.forEach(r => { r.gi1 = interp('gi1', r.d); r.gi2 = interp('gi2', r.d); r.hab = interp('hab', r.d) ?? 0; });
  let y = 0;
  segs = SEGMENTS.map(s => {
    const own = rows.filter(r => r.d >= s.top && r.d < s.bottom);
    const seg = { ...s, rows: own, h: (s.bottom - s.top) * CM, yTop: -y, stats: stats(own) };
    y += seg.h + GAP;
    return seg;
  });
  segs.totalH = y - GAP;
}

// linear interpolation between sample midpoints (clamped at the ends); null before the first computed sample
function interp(k, d) {
  const pts = geo.filter(g => g[k] != null);
  if (!pts.length || d < pts[0].top) return null;
  if (d <= pts[0].mid) return pts[0][k];
  for (let i = 1; i < pts.length; i++) if (d <= pts[i].mid) { const a = pts[i - 1], b = pts[i]; return a[k] + (b[k] - a[k]) * (d - a.mid) / (b.mid - a.mid); }
  return pts.at(-1)[k];
}

function stats(rs) {
  const mean = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  const ext = (k, f) => rs.reduce((b, r) => f(r[k], b[k]) ? r : b, rs[0]);
  return {
    por: mean('por'), den: mean('den'), brine: mean('brine'),
    porMax: ext('por', (a, b) => a > b), denMin: ext('den', (a, b) => a < b),
    brineMax: ext('brine', (a, b) => a > b),
  };
}

function pearson(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}

const depthToY = d => {
  const s = segs.find(s => d >= s.top && d <= s.bottom) || segs.at(-1);
  return s.yTop - (d - s.top) * CM;
};

/* ---------- 3D scene ---------- */

const canvas = $('#scene');
let renderer, scene, camera, coreGroup, marker, raycaster, sprites = [];
let mode = 'ct', active = 'overview';
const isWide = () => ['overview', 'geo', 'methods'].includes(active);
const view = { ty: 0, dist: 30, tyGoal: 0, distGoal: 30, rot: 0, auto: true };

const pointVS = `
attribute float size; attribute vec3 col; varying vec3 vCol;
uniform float uScale;
void main(){ vCol = col; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const pointFS = `
varying vec3 vCol; uniform float uOpacity;
void main(){ float r = length(gl_PointCoord - .5) * 2.0; if (r > 1.0) discard;
  float a = smoothstep(1.0, .55, r); gl_FragColor = vec4(vCol, a * uOpacity); }`;

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xbcd6ff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fb8ff, 0.7); rim.position.set(-4, 1, -3); scene.add(rim);

  coreGroup = new THREE.Group(); scene.add(coreGroup);
  segs.forEach((s, i) => {
    const cy = s.yTop - s.h / 2;
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, roughness: 0.25, metalness: 0, depthWrite: false });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, s.h, 64), shellMat);
    shell.position.y = cy; shell.userData.seg = s; coreGroup.add(shell);

    const ringMat = new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.5 });
    [s.yTop, s.yTop - s.h].forEach(y => {
      const pts = Array.from({ length: 65 }, (_, k) => new THREE.Vector3(Math.cos(k / 64 * 6.2832) * RADIUS, y, Math.sin(k / 64 * 6.2832) * RADIUS));
      coreGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    });

    const pts = makePoints(s, 1000 + i);
    coreGroup.add(pts);
    s.mesh = shell; s.points = pts;
    s.fade = 1; s.fadeGoal = 1;

    const label = makeLabel(s);
    label.position.set(-RADIUS - 0.9, cy, 0);
    scene.add(label); sprites.push(label); s.label = label;
  });

  marker = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + 0.03, 0.012, 8, 80), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  marker.rotation.x = Math.PI / 2; marker.visible = false; coreGroup.add(marker);

  raycaster = new THREE.Raycaster();
  applyMode();
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);
  bindPointer();
  requestAnimationFrame(tick);
}

function makePoints(s, seed) {
  const rand = rng(seed), pos = [], col = [], size = [];
  s.rows.forEach(r => {
    const n = Math.round(r.por * 28);
    for (let k = 0; k < n; k++) {
      const a = rand() * 6.2832, rr = Math.sqrt(rand()) * RADIUS * 0.93;
      pos.push(Math.cos(a) * rr, depthToY(r.d - 0.5 + rand()), Math.sin(a) * rr);
      const t = Math.pow(rand(), 6);                    // most pores are small, a few are large
      col.push(...ramp(JET, t).map(v => v / 255));
      size.push(3 + t * 18);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('col', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: pointVS, fragmentShader: pointFS, transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 }, uOpacity: { value: 0.85 } },
  });
  const p = new THREE.Points(g, m); p.renderOrder = 2; return p;
}

function makeLabel(s) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#e8f1ff'; x.font = '600 64px Inter, sans-serif'; x.textAlign = 'right'; x.fillText(s.id, 250, 62);
  x.fillStyle = '#8da4c4'; x.font = '400 30px Inter, sans-serif'; x.fillText(`${s.top}–${s.bottom} cm`, 250, 104);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sp.scale.set(1.3, 0.65, 1); sp.renderOrder = 10; return sp;
}

function heatTexture(s, metric) {
  const m = METRICS[metric], [a, b] = dom[metric], c = document.createElement('canvas');
  c.width = 2; c.height = s.rows.length;
  const x = c.getContext('2d');
  s.rows.forEach((r, i) => {
    const t = (r[m.key] - a) / (b - a);
    x.fillStyle = r[m.key] == null ? '#16233d' : css(ramp(m.stops, t)); x.fillRect(0, i, 2, 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  return tex;
}

function applyMode() {
  segs.forEach(s => {
    const mat = s.mesh.material;
    if (mode === 'ct') { mat.map = null; mat.color.set(0xcfe8ff); s.shellBase = 0.16; s.pointBase = 0.85; }
    else { mat.map = (s.tex ||= {})[mode] ||= heatTexture(s, mode); mat.color.set(0xffffff); s.shellBase = 0.96; s.pointBase = 0.0; }
    mat.needsUpdate = true;
  });
  document.querySelectorAll('.mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  drawLegend();
}

function drawLegend() {
  const el = $('#legend');
  if (mode === 'ct') {
    el.innerHTML = `<b>Void volume (illustrative)</b><div class="bar" style="background:linear-gradient(90deg,${JET.join(',')})"></div><div class="ends"><span>small volume</span><span>large volume</span></div>`;
  } else {
    const m = METRICS[mode], [a, b] = dom[mode];
    el.innerHTML = `<b>${m.label} (${m.unit})</b><div class="bar" style="background:linear-gradient(90deg,${m.stops.join(',')})"></div><div class="ends"><span>${fmt(a, 0)}</span><span>${fmt(b, 0)}</span></div>`;
  }
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const scale = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  segs.forEach(s => s.points.material.uniforms.uScale.value = scale * 0.012);
  setView();
}

function setView() {
  const a = isWide() ? null : segs.find(s => s.id === active);
  const aspect = camera.aspect;
  if (!a) { view.tyGoal = -segs.totalH / 2; const h = canvas.clientHeight, room = h / Math.max(h - 260, h * 0.5);   // keep the core clear of the title/legend above and the mode bar below
    view.distGoal = segs.totalH / 2 / Math.tan(THREE.MathUtils.degToRad(17.5)) * 1.05 * room; }
  else {
    view.tyGoal = a.yTop - a.h / 2;
    const needH = a.h * 1.9, needW = (RADIUS * 2 + 1.2) / aspect;
    view.distGoal = Math.max(needH, needW) / 2 / Math.tan(THREE.MathUtils.degToRad(17.5));
  }
}

function tick() {
  view.ty += (view.tyGoal - view.ty) * 0.08;
  view.dist += (view.distGoal - view.dist) * 0.08;
  if (view.auto && isWide()) view.rot += 0.0025;
  coreGroup.rotation.y = view.rot;
  camera.position.set(0, view.ty + view.dist * 0.03, view.dist);
  camera.lookAt(0, view.ty, 0);
  segs.forEach(s => {
    const goal = isWide() || s.id === active ? 1 : 0.28;
    s.fade += (goal - s.fade) * 0.1;
    const hov = hovered === s ? 1.5 : 1;
    s.mesh.material.opacity = Math.min(1, s.shellBase * (mode === 'ct' ? hov : 1)) * (mode === 'ct' ? 1 : (0.35 + 0.65 * s.fade));
    s.points.material.uniforms.uOpacity.value = s.pointBase * s.fade;
    s.label.material.opacity = isWide() ? 0.35 + 0.65 * s.fade : 0;
  });
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* pointer: drag to rotate, click to select, hover to inspect */
let hovered = null;
function bindPointer() {
  let down = null;
  const ndc = e => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const pick = e => { raycaster.setFromCamera(ndc(e), camera); return raycaster.intersectObjects(segs.map(s => s.mesh))[0]; };

  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); view.auto = false; });
  canvas.addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 3 || Math.abs(e.clientY - down.y) > 3) down.moved = true;
      view.rot += dx * 0.01; down.x = e.clientX; down.y = e.clientY;
    }
    const hit = pick(e), tip = $('#tip');
    hovered = hit ? hit.object.userData.seg : null;
    if (hit) {
      const local = coreGroup.worldToLocal(hit.point.clone());
      const seg = hit.object.userData.seg, d = clamp(seg.top + (seg.yTop - local.y) / CM, seg.top, seg.bottom - 0.01);
      const r = nearestRow(d);
      showMarker(d);
      const box = canvas.getBoundingClientRect();
      tip.hidden = false; tip.style.left = e.clientX - box.left + 'px'; tip.style.top = e.clientY - box.top + 'px';
      tip.innerHTML = `<b>${seg.id}</b> · ${fmt(d, 0)} cm<br>Porosity ${fmt(r.por, 2)} % · ${fmt(r.den, 0)} kg/m³`;
    } else { tip.hidden = true; if (!chartHover) showMarker(null); }
  });
  canvas.addEventListener('pointerup', e => {
    canvas.classList.remove('drag');
    if (down && !down.moved) { const hit = pick(e); if (hit) select(hit.object.userData.seg.id); }
    down = null;
  });
  canvas.addEventListener('pointerleave', () => { $('#tip').hidden = true; hovered = null; if (!chartHover) showMarker(null); });
}

function showMarker(d) {
  if (d == null) { marker.visible = false; return; }
  marker.visible = true; marker.position.y = depthToY(d);
}
const nearestRow = d => rows[clamp(Math.floor(d), 0, rows.length - 1)];

/* ---------- panel: tabs ---------- */

let chartHover = false;

function buildTabs() {
  const nav = $('#tabs');
  const items = [{ id: 'overview', t: 'Overview', s: '0–165 cm' }, ...segs.map(s => ({ id: s.id, t: s.id, s: `${s.top}–${s.bottom}` })), { id: 'geo', t: 'Geochem', s: 'indices' }, { id: 'methods', t: 'Methods', s: 'CT & AI' }];
  nav.innerHTML = items.map(i => `<button class="tab" role="tab" id="tab-${i.id}" data-id="${i.id}" aria-selected="false">${i.t}<small>${i.s}</small></button>`).join('');
  nav.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) select(b.dataset.id); });
  addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const ids = items.map(i => i.id), i = ids.indexOf(active) + (e.key === 'ArrowRight' ? 1 : -1);
    if (i >= 0 && i < ids.length) select(ids[i]);
  });
}

function select(id) {
  active = id;
  history.replaceState(null, '', id === 'overview' ? location.pathname : '#' + id);
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.id === id));
  $('#tab-' + id)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (id === 'geo' && !['gi1', 'gi2', 'hab'].includes(mode)) { mode = 'hab'; applyMode(); }
  $('#tabBody').innerHTML = id === 'overview' ? overviewHTML() : id === 'geo' ? geoHTML() : id === 'methods' ? methodsHTML() : segmentHTML(segs.find(s => s.id === id));
  $('#tabBody').scrollTop = 0;
  $('#tabBody').setAttribute('aria-labelledby', 'tab-' + id);
  document.querySelectorAll('.seg-table tr[data-id]').forEach(tr => tr.onclick = () => select(tr.dataset.id));
  document.querySelectorAll('.chart').forEach(bindChart);
  view.auto = isWide() && view.auto;
  setView();
}

const descriptor = p => p < 0.5 ? 'compact, close to solid ice' : p < 2 ? 'moderately porous' : p < 4 ? 'porous' : 'highly porous';

function stat(label, value, unit, sub = '') {
  return `<div class="stat"><span>${label}</span><b>${value}<small>${unit}</small></b>${sub ? `<i>${sub}</i>` : ''}</div>`;
}

function overviewHTML() {
  const all = stats(rows), r = pearson(rows.map(x => x.por), rows.map(x => x.den));
  const byPor = [...segs].sort((a, b) => b.stats.por - a.stats.por);
  const maxPor = Math.max(...segs.map(s => s.stats.por));
  return `
    <div><h2>The whole core, <em>section by section</em></h2>
    <p class="lede" style="margin-top:10px">Eight CT-scanned sections stacked from the ice surface (0 cm) to ${CORE_END} cm. Pick a tab or click a section in the 3D view to see how porosity, density and brine change with depth.</p></div>
    <div class="stats">
      ${stat('Mean porosity', fmt(all.por, 2), '%', `peak ${fmt(all.porMax.por, 1)} % at ${fmt(all.porMax.d, 0)} cm`)}
      ${stat('Mean density', fmt(all.den, 0), 'kg/m³', `lowest ${fmt(all.denMin.den, 0)} at ${fmt(all.denMin.d, 0)} cm`)}
    </div>
    <ul class="facts">
      <li>Porosity and density move in opposite directions (r = ${fmt(r, 2)}), so void-rich ice is lighter. The two are almost perfectly anti-correlated, which suggests density is derived from porosity rather than measured independently.</li>
      <li>Most porous section: <b>${byPor[0].id}</b> (${fmt(byPor[0].stats.por, 1)} %). Most compact: <b>${byPor.at(-1).id}</b> (${fmt(byPor.at(-1).stats.por, 2)} %).</li>
      <li>Voids in the 3D view are drawn procedurally from the measured porosity profile for illustration; they are not the CT segmentation itself.</li>
    </ul>
    <div class="charts"><h3>Profile with depth</h3>${chartHTML(0, CORE_END, 560)}<div class="chart-readout">Hover the chart to inspect a depth.</div></div>
    <div><h3>Sections compared</h3>
    <table class="seg-table"><tr><th>Section</th><th>Porosity</th><th>Density</th></tr>
      ${segs.map(s => `<tr data-id="${s.id}"><td><b>${s.id}</b> <span style="color:var(--muted)">${s.top}–${s.bottom}</span></td>
        <td><span class="bar" style="width:${s.stats.por / maxPor * 60}px"></span>${fmt(s.stats.por, 2)} %</td><td>${fmt(s.stats.den, 0)}</td></tr>`).join('')}
    </table></div>`;
}

function segmentHTML(s) {
  const st = s.stats, all = stats(rows);
  const rank = [...segs].sort((a, b) => b.stats.por - a.stats.por).findIndex(x => x.id === s.id) + 1;
  const dDen = PURE_ICE - st.den;
  const brineRows = s.rows.filter(r => r.brine > 0.05);
  const facts = [
    `Mean porosity is ${fmt(st.por, 2)} %, ${st.por > all.por ? 'above' : 'below'} the core average of ${fmt(all.por, 2)} % — rank ${rank} of ${segs.length} for void content.`,
    `Porosity peaks at ${fmt(st.porMax.por, 1)} % near ${fmt(st.porMax.d, 0)} cm.`,
    `Mean density is ${fmt(st.den, 0)} kg/m³, ${dDen > 1 ? `${fmt(dDen, 0)} below` : 'essentially at'} the ${PURE_ICE} kg/m³ bubble-free ice reference; the lowest value is ${fmt(st.denMin.den, 0)} at ${fmt(st.denMin.d, 0)} cm.`,
    brineRows.length ? `Brine is detected between ${fmt(brineRows[0].d, 0)} and ${fmt(brineRows.at(-1).d, 0)} cm (up to ${fmt(st.brineMax.brine, 2)} %).` : 'No brine signal is detected in this section.',
  ];
  return `
    <div><h2>${s.id} <em>${s.top}–${s.bottom} cm</em></h2>
    <p class="lede" style="margin-top:10px">This section is ${descriptor(st.por)}.</p>
    <span class="badge">${s.bottom - s.top} cm of core</span></div>
    <div class="stats">
      ${stat('Mean porosity', fmt(st.por, 2), '%', `max ${fmt(st.porMax.por, 1)} %`)}
      ${stat('Mean density', fmt(st.den, 0), 'kg/m³', `min ${fmt(st.denMin.den, 0)}`)}
    </div>
    <ul class="facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul>
    ${s.notes ? `<p class="notes">${s.notes}</p>` : ''}
    <div class="charts"><h3>Profile with depth</h3>${chartHTML(s.top, s.bottom, 320)}<div class="chart-readout">Hover the chart to inspect a depth.</div></div>
    ${geoSectionHTML(s)}
    <div><h3>CT scan</h3><video controls muted loop playsinline preload="metadata" src="./_videos/${encodeURI(s.video)}" onerror="this.parentElement.remove()"></video></div>`;
}

/* ---------- charts (depth runs downward, like the core) ---------- */

function chartHTML(top, bottom, H) {
  const rs = rows.filter(r => r.d >= top && r.d < bottom);
  const panels = [['porosity', 'Porosity %'], ['density', 'Density kg/m³']];
  if (rs.some(r => r.brine > 0.05)) panels.push(['brine', 'Brine %']);
  const W = 430, L = 34, T = 22, B = 6, gap = 22, n = panels.length, pw = (W - L - gap * (n - 1)) / n, ih = H - T - B;
  const y = d => T + (d - top) / (bottom - top) * ih;
  const step = bottom - top > 60 ? 20 : 5;
  let svg = `<svg class="chart" data-kind="phys" viewBox="0 0 ${W} ${H}" data-top="${top}" data-bottom="${bottom}" data-n="${n}" data-l="${L}" data-pw="${pw}" data-gap="${gap}" data-t="${T}" data-ih="${ih}" role="img" aria-label="Porosity and density profile, ${top} to ${bottom} cm">`;
  for (let d = top; d <= bottom; d += step) svg += `<text x="${L - 6}" y="${y(d) + 3}" text-anchor="end">${d}</text><line x1="${L}" x2="${W}" y1="${y(d)}" y2="${y(d)}" stroke="rgba(160,200,255,.09)"/>`;
  svg += `<text x="${L - 6}" y="12" text-anchor="end">cm</text>`;
  panels.forEach(([k, title], i) => {
    const m = METRICS[k], [a, b] = dom[k], x0 = L + i * (pw + gap), x = v => x0 + clamp((v - a) / (b - a), 0, 1) * pw;
    const colour = ramp(m.stops, k === 'density' ? .55 : .75), c = css(colour);
    const mid = rs.map(r => `${x(r[m.key]).toFixed(1)},${y(r.d + 0.5).toFixed(1)}`);
    const band = rs.map(r => `${x(r[m.hi]).toFixed(1)},${y(r.d + 0.5).toFixed(1)}`).concat(rs.slice().reverse().map(r => `${x(r[m.lo]).toFixed(1)},${y(r.d + 0.5).toFixed(1)}`));
    svg += `<text x="${x0}" y="12">${title}</text><rect x="${x0}" y="${T}" width="${pw}" height="${ih}" fill="rgba(111,211,255,.03)" stroke="rgba(160,200,255,.14)"/>`;
    svg += `<polygon points="${band.join(' ')}" fill="${c}" opacity=".18"/><polyline points="${mid.join(' ')}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    if (k === 'density') svg += `<line x1="${x(PURE_ICE)}" x2="${x(PURE_ICE)}" y1="${T}" y2="${T + ih}" stroke="#bfe6ff" stroke-dasharray="3 3" opacity=".6"/>`;
  });
  if (SALINE > top && SALINE < bottom) svg += `<line x1="${L}" x2="${W}" y1="${y(SALINE)}" y2="${y(SALINE)}" stroke="#ffb067" stroke-dasharray="1 3" opacity=".8"/><text x="${W}" y="${y(SALINE) - 3}" text-anchor="end" fill="#ffb067" style="fill:#ffb067">saline transition ~${SALINE} cm</text>`;
  segs.filter(s => s.top > top && s.top < bottom).forEach(s => svg += `<line x1="${L}" x2="${W}" y1="${y(s.top)}" y2="${y(s.top)}" stroke="var(--accent)" stroke-dasharray="2 4" opacity=".5"/>`);
  svg += `<rect class="hit" x="${L}" y="${T}" width="${W - L}" height="${ih}" fill="transparent"/></svg>`;
  return svg;
}

function geoChartHTML(top, bottom, H) {
  const W = 430, L = 34, T = 22, B = 6, gap = 22, n = 3, pw = (W - L - gap * (n - 1)) / n, ih = H - T - B;
  const y = d => T + (d - top) / (bottom - top) * ih;
  const step = bottom - top > 60 ? 20 : 5, inside = geo.filter(g => g.bottom > top && g.top < bottom);
  let svg = `<svg class="chart" data-kind="geo" viewBox="0 0 ${W} ${H}" data-top="${top}" data-bottom="${bottom}" data-l="${L}" data-t="${T}" data-ih="${ih}" role="img" aria-label="Geochemical indices, ${top} to ${bottom} cm">`;
  for (let d = top; d <= bottom; d += step) svg += `<text x="${L - 6}" y="${y(d) + 3}" text-anchor="end">${d}</text><line x1="${L}" x2="${W}" y1="${y(d)}" y2="${y(d)}" stroke="rgba(160,200,255,.09)"/>`;
  svg += `<text x="${L - 6}" y="12" text-anchor="end">cm</text>`;
  [['gi1', 'GI-1'], ['gi2', 'GI-2'], ['hab', 'Habitat potential']].forEach(([k, title], i) => {
    const m = METRICS[k], x0 = L + i * (pw + gap);
    svg += `<text x="${x0}" y="12">${title}</text><rect x="${x0}" y="${T}" width="${pw}" height="${ih}" fill="rgba(111,211,255,.03)" stroke="rgba(160,200,255,.14)"/>`;
    inside.forEach(g => {
      if (k === 'hab') {
        const y1 = y(Math.max(g.top, top)), y2 = y(Math.min(g.bottom, bottom));
        svg += `<rect x="${x0}" y="${y1}" width="${pw}" height="${y2 - y1}" fill="${css(ramp(m.stops, g.hab ?? 0))}"/>`;
      } else if (g.mid >= top && g.mid < bottom && g[k] != null) {
        svg += `<circle cx="${x0 + g[k] * pw}" cy="${y(g.mid)}" r="5" fill="${css(ramp(m.stops, g[k]))}" stroke="#fff" stroke-opacity=".7"/>`;
      }
    });
    if (k !== 'hab') svg += `<text x="${x0}" y="${T + ih + 12}">0</text><text x="${x0 + pw}" y="${T + ih + 12}" text-anchor="end">1</text>`;
  });
  if (SALINE > top && SALINE < bottom) svg += `<line x1="${L}" x2="${W}" y1="${y(SALINE)}" y2="${y(SALINE)}" stroke="#ffb067" stroke-dasharray="1 3"/><text x="${W}" y="${y(SALINE) - 3}" text-anchor="end" style="fill:#ffb067">saline transition ~${SALINE} cm</text>`;
  return svg + `<rect class="hit" x="${L}" y="${T}" width="${W - L}" height="${ih}" fill="transparent"/></svg>`;
}

function methodsHTML() {
  const steps = [
    ['Data acquisition', 'The core was divided into segments and scanned with a North Star Imaging X5000 industrial CT system at the Jet Propulsion Laboratory (JPL) at 56 µm voxel resolution. Sections were held in a custom cryogenic holder surrounded by dry ice at −15 °C or below, preserving the in situ microstructure and limiting melting and artificial brine drainage.'],
    ['3D reconstruction', 'Image stacks were imported into Dragonfly, reconstructed, registered and vertically aligned into one continuous volume. A cylindrical region of interest isolated the core interior and excluded the holder, peripheral voxels and edge artifacts.'],
    ['Segmentation', 'A supervised 3D U-Net trained on manually annotated images classified every voxel as ice, void or brine. Intensity thresholding was used as a complementary check on the phase classification.'],
    ['Processing and quantification', 'Segmented objects were filtered to remove noise and artifacts, then described by volume, centroid, sphericity, grayscale intensity, extent, anisotropy and orientation. Morphological criteria picked out vertically elongated, interconnected structures, interpreted as pore network and potential brine pathways.'],
    ['Phase abundance profiles', 'Segmented images were exported as false-colour PNGs and classified by colour in MATLAB to give the relative abundance of ice, voids and brine per section. The results were exported to CSV and assembled into the vertical profiles shown here.'],
  ];
  return `
    <div><h2>How the data <em>were made</em></h2>
    <p class="lede" style="margin-top:10px">From CT scan to depth profile: the steps behind the porosity, brine and density curves.</p></div>
    <ol class="steps">${steps.map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
    <div><h3>Where this appears in the data</h3>
    <ul class="facts">
      <li><b>Porosity</b> and <b>brine</b> are the void and brine fractions from the phase classification, per 1 cm slice, with lower/upper bounds.</li>
      <li><b>Pore network</b> is the share of the volume belonging to the elongated, interconnected structures.</li>
      <li><b>Density</b> is reported with its own bounds. Its near-perfect inverse relation to porosity suggests it is derived from the phase fractions.</li>
      <li>The coloured dots in the 3D “CT voids” mode are illustrative. They are drawn from the porosity profile and are not the segmented objects. The section videos show the real void analysis, coloured by void volume.</li>
    </ul></div>`;
}

function geoStats(top, bottom) {
  const gs = geo.filter(g => g.gi1 != null && g.mid >= top && g.mid < bottom);
  if (!gs.length) return null;
  const mean = k => gs.reduce((a, g) => a + g[k], 0) / gs.length, best = k => gs.reduce((b, g) => g[k] > b[k] ? g : b);
  return { n: gs.length, gi1: mean('gi1'), gi2: mean('gi2'), hab: mean('hab'), bestHab: best('hab'), bestGi1: best('gi1'), bestGi2: best('gi2') };
}

function geoSectionHTML(s) {
  const g = geoStats(s.top, s.bottom);
  if (!g) return `<div><h3>Geochemistry</h3><p class="lede">No geochemical indices are computed for this section: they start below the saline transition zone (~${SALINE} cm).</p></div>`;
  return `<div class="charts"><h3>Geochemistry · ${g.n} samples</h3>
    <ul class="facts"><li>Mean GI-1 ${fmt(g.gi1, 2)} and GI-2 ${fmt(g.gi2, 2)}; mean habitat potential ${fmt(g.hab, 2)}.</li>
    <li>Habitat potential peaks at ${fmt(g.bestHab.hab, 2)} in the ${g.bestHab.top}–${g.bestHab.bottom} cm sample.</li></ul>
    ${geoChartHTML(s.top, s.bottom, 320)}<div class="chart-readout">Hover the chart to inspect a sample.</div></div>`;
}

function geoHTML() {
  const valid = geo.filter(g => g.gi1 != null), top3 = [...valid].sort((a, b) => b.hab - a.hab).slice(0, 3);
  const pores = valid.map(g => { const rs = rows.filter(r => r.d >= g.top && r.d < g.bottom); return rs.reduce((a, r) => a + r.por, 0) / rs.length; });
  const r = pearson(valid.map(g => g.hab), pores);
  return `
    <div><h2>Geochemistry <em>and habitat potential</em></h2>
    <p class="lede" style="margin-top:10px">Two exploratory indices built from 5 cm ICP samples, and a habitat-potential score that combines them. The core is coloured by habitat potential while this tab is open; use the buttons under the core to switch between GI-1, GI-2 and habitat potential.</p></div>
    <div><h3>GI-1 · particles, redox and ligands</h3>
    <p class="lede">The arithmetic mean of the Ba/Ca, Mn/Fe and Cu/Zn ratios (each scaled 0–1 here). It combines three different signals: particle-associated organic microenvironments and barite formation (Ba/Ca), redox-sensitive metal cycling (Mn/Fe), and ligand-mediated trace-metal availability and biological demand (Cu/Zn) (Ewert and Deming, 2013; Martinez-Ruiz et al., 2020; Jensen et al., 2021; Arnone et al., 2023).</p></div>
    <div><h3>GI-2 · metal enrichment</h3>
    <p class="lede">The arithmetic mean of the salinity-normalised concentrations of Fe, Mn, Cu and Zn. It flags intervals of enhanced particle reactivity and trace-metal enrichment. Fe and Mn respond to redox changes; Cu and Zn are shaped by organic complexation and biological uptake (Arnone et al., 2023; Jensen and Colombo, 2024). High values depart from conservative seawater mixing, consistent with active biogeochemical modification within the ice or near the halocline.</p></div>
    <div><h3>Integrated habitat potential (IHP)</h3>
    <p class="lede">S/Ca and Ca/K thresholds act as on/off filters that keep only marine, high-salinity conditions; the filtered domain is then combined with GI-1 and GI-2. In the data file the raw score is the mean of GI-1 and GI-2, multiplied by the S/Ca and Ca/K terms, then rescaled so the peak equals 1. <b>IHP is an independent exploratory measure of potential habitat suitability, not direct evidence of biological activity.</b></p></div>
    <ul class="facts">
      <li>Indices are only computed below the saline transition zone (~${SALINE} cm); above it the core shows no signal.</li>
      <li>The colour bands in the 3D view are interpolated between 5 cm samples.</li>
    </ul>
    <div class="stats">
      ${stat('Highest habitat potential', fmt(top3[0].hab, 2), '', `${top3[0].top}–${top3[0].bottom} cm`)}
      ${stat('Next highest', `${fmt(top3[1].hab, 2)} · ${fmt(top3[2].hab, 2)}`, '', `${top3[1].top}–${top3[1].bottom} and ${top3[2].top}–${top3[2].bottom} cm`)}
    </div>
    <p class="lede">Across the ${valid.length} computed samples, habitat potential and porosity have a correlation of r = ${fmt(r, 2)}. This is a descriptive association between two profiles, not evidence of cause.</p>
    <div class="charts"><h3>Indices with depth</h3>${geoChartHTML(0, CORE_END, 560)}<div class="chart-readout">Hover the chart to inspect a sample.</div></div>
    <div><h3>Jump to a section</h3><table class="seg-table"><tr><th>Section</th><th>Mean habitat</th><th>Peak</th></tr>
      ${segs.map(s => { const g = geoStats(s.top, s.bottom); return `<tr data-id="${s.id}"><td><b>${s.id}</b> <span style="color:var(--muted)">${s.top}–${s.bottom}</span></td><td>${g ? fmt(g.hab, 2) : '—'}</td><td>${g ? fmt(g.bestHab.hab, 2) : '—'}</td></tr>`; }).join('')}
    </table></div>
    <div><h3>References</h3><ul class="refs">${REFERENCES.map(r => `<li>${r.full || r.cite}</li>`).join('')}</ul></div>`;
}

function bindChart(svg) {
  const top = +svg.dataset.top, bottom = +svg.dataset.bottom, T = +svg.dataset.t, ih = +svg.dataset.ih;
  const vb = svg.viewBox.baseVal, hit = $('.hit', svg), readout = svg.parentElement.querySelector('.chart-readout'), geoKind = svg.dataset.kind === 'geo';
  let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', svg.dataset.l); line.setAttribute('x2', vb.width); line.setAttribute('stroke', '#fff'); line.setAttribute('opacity', '.7'); line.style.display = 'none';
  svg.insertBefore(line, hit);
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), vy = (e.clientY - r.top) / r.height * vb.height;
    const d = clamp(top + (vy - T) / ih * (bottom - top), top, bottom - 0.01), row = nearestRow(d);
    line.style.display = ''; line.setAttribute('y1', vy); line.setAttribute('y2', vy);
    chartHover = true; showMarker(d);
    if (geoKind) { const g = geo.find(g => d >= g.top && d < g.bottom);
      readout.innerHTML = g && g.gi1 != null ? `<b>${g.top}–${g.bottom} cm</b> · GI-1 <b>${fmt(g.gi1, 2)}</b> · GI-2 <b>${fmt(g.gi2, 2)}</b> · habitat <b>${fmt(g.hab, 2)}</b>` : `<b>${fmt(d, 0)} cm</b> · no geochemical indices computed here`; return; }
    readout.innerHTML = `<b>${fmt(row.d, 1)} cm</b> · porosity <b>${fmt(row.por, 2)} %</b> · density <b>${fmt(row.den, 0)} kg/m³</b>${row.brine > 0.05 ? ` · brine <b>${fmt(row.brine, 2)} %</b>` : ''}`;
  });
  hit.addEventListener('pointerleave', () => { line.style.display = 'none'; chartHover = false; showMarker(null); });
}

/* ---------- boot ---------- */

document.querySelectorAll('.mode button').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; applyMode(); }));

const load = f => fetch(f).then(r => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.text(); }).then(parseCSV);
Promise.all([load(DATA_FILE), load(GEO_FILE)])
  .then(([phys, g]) => {
    prepare(phys, g);
    buildScene(); buildTabs();
    const hash = location.hash.slice(1);
    select(segs.some(s => s.id === hash) || hash === 'geo' || hash === 'methods' ? hash : 'overview');
    document.fonts?.ready.then(() => segs.forEach(s => { s.label.material.map.dispose(); s.label.material.map = makeLabel(s).material.map; }));
  })
  .catch(err => {
    console.error(err);
    $('#tabBody').innerHTML = `<p class="err">Could not load ${DATA_FILE}. ${location.protocol === 'file:' ? 'Browsers block CSV loading from file:// — serve the folder with <code>python3 -m http.server</code>.' : err.message}</p>`;
  });
})();
