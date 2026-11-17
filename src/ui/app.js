// app.js - Studio wiring: form -> engine -> sheet, straightedge, export.

import { buildChart, parseFormula } from '../core/pipeline.js';
import { buildSheet, VERMILION } from '../core/sheet.js';
import { toSVG } from '../core/svg.js';
import { toPDF } from '../core/pdf.js';
import { solveLine, valueAtPoint } from '../core/reader.js';
import { formatCertificate, formatCertificateMethod } from '../core/certificate.js';
import { getExamples } from '../core/examples.js';
import { displayName, formatNumber } from '../core/text.js';
import { encodeStateToHash, decodeStateFromHash, nextSolved, fileName } from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const examples = getExamples();

/** Studio state: what the user typed. */
let state = fromExample(examples[0]);
/** Derived: compiled chart or error. */
let built = null;
/** Straightedge: values per scale, most-recent-first order, solved scale. */
let se = null;
let formulaTimer = 0;

function fromExample(e) {
  return {
    formula: e.formula,
    ranges: structuredClone(e.ranges),
    units: structuredClone(e.units),
    layout: e.layout,
    deltaMm: 0.5,
    exampleId: e.id
  };
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------- compile

function rebuild({ keepStraightedge = false } = {}) {
  const parsed = parseFormula(state.formula);
  if (!parsed.error) {
    for (const v of parsed.inputs) if (!state.ranges[v]) state.ranges[v] = [1, 10];
    for (const v of [...parsed.inputs, parsed.lhs]) if (state.units[v] == null) state.units[v] = '';
  }
  const result = parsed.error ? parsed : buildChart(state);
  if (result.error) {
    built = { error: result.error, pos: result.pos, parsed };
    se = null;
  } else {
    built = result;
    const ex = examples.find((e) => e.id === state.exampleId);
    if (!keepStraightedge || !se) se = initialStraightedge(ex);
    else resolve();
  }
  render();
  history.replaceState(null, '', '#' + encodeStateToHash(state));
}

function zAvailable() {
  const r = buildChart({ ...state, layout: 'z' });
  return !r.error && r.chart.form === 'z-chart';
}

// ---------------------------------------------------------------- straightedge

function initialStraightedge(ex) {
  const { chart } = built;
  const mid = (s) => (s.scaleKind === 'log' && s.range[0] > 0
    ? Math.sqrt(s.range[0] * s.range[1])
    : (s.range[0] + s.range[1]) / 2);
  let u = mid(chart.scales[0]);
  let v = mid(chart.scales[1]);
  if (ex && ex.formula === state.formula) {
    const inR = (x, s) => x >= s.range[0] && x <= s.range[1];
    if (inR(ex.key.u, chart.scales[0]) && inR(ex.key.v, chart.scales[1])) { u = ex.key.u; v = ex.key.v; }
  }
  const s = { values: [u, v, NaN], order: [1, 0, 2], solved: 2, out: false };
  se = s;
  resolve();
  return s;
}

/** Solve the scale moved least recently from the other two. */
function resolve() {
  const k = [0, 1, 2].filter((i) => i !== se.solved);
  const r = solveLine(built.layout, built.chart, { scale: k[0], value: se.values[k[0]] }, { scale: k[1], value: se.values[k[1]] });
  if (r.error) {
    se.out = true;
  } else {
    se.out = false;
    se.values[se.solved] = r.value;
  }
}

function moveHandle(i, value) {
  se.values[i] = value;
  if (se.order[0] !== i) {
    const n = nextSolved(se.order, i);
    se.order = n.order;
    se.solved = n.solved;
  }
  resolve();
  updateStraightedge();
  renderReadout();
}

function pointerToSheet(evt) {
  const svg = $('overlay');
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function startDrag(i, evt) {
  evt.preventDefault();
  evt.currentTarget.focus({ preventScroll: true });
  const move = (e) => {
    const r = valueAtPoint(built.layout, built.chart, i, pointerToSheet(e));
    if (!r.error) moveHandle(i, r.value);
  };
  move(evt);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function keyMove(i, evt) {
  const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[evt.key];
  if (!step) return;
  evt.preventDefault();
  const s = built.layout.scales[i];
  const p = s.valueToPoint(se.values[i]);
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  // Arrow up moves towards the top of the sheet, whichever way the scale runs.
  const dy = (s.y2 - s.y1) / len;
  const sign = dy <= 0 ? 1 : -1;
  const mm = (evt.shiftKey ? 0.1 : 1) * step * sign;
  const q = { x: p.x + ((s.x2 - s.x1) / len) * -mm, y: p.y + dy * -mm };
  const r = valueAtPoint(built.layout, built.chart, i, q);
  if (!r.error) moveHandle(i, r.value);
}

// ---------------------------------------------------------------- render

function render() {
  renderForm();
  renderSheet();
  renderStraightedge();
  renderReadout();
  renderCertificate();
}

function renderForm() {
  const f = $('formula');
  if (document.activeElement !== f && f.value !== state.formula) f.value = state.formula;
  const err = $('formula-error');
  if (built.error) {
    const caret = built.pos != null && built.pos >= 0 && built.pos <= state.formula.length
      ? `${state.formula}\n${' '.repeat(built.pos)}^\n` : '';
    err.textContent = caret + built.error;
  } else {
    err.textContent = '';
  }

  const parsed = built.parsed ?? parseFormula(state.formula);
  const tbody = $('vars').tBodies[0];
  const inputs = built.error ? (parsed.inputs ?? []) : built.inputs;
  const output = built.error ? parsed.lhs : built.output;
  const rows = [...inputs.map((v) => ({ v, input: true })), ...(output ? [{ v: output, input: false }] : [])];
  const sig = rows.map((r) => r.v + r.input).join('|');
  if (tbody.dataset.sig !== sig) {
    tbody.dataset.sig = sig;
    tbody.replaceChildren(...rows.map(({ v, input }) => varRow(v, input)));
  }
  if (!built.error) {
    const out = built.chart.scales[2];
    const tr = tbody.querySelector('tr.output');
    if (tr) {
      tr.querySelector('.cmin').textContent = formatNumber(out.range[0], 3);
      tr.querySelector('.cmax').textContent = formatNumber(out.range[1], 3);
    }
  }
  for (const input of tbody.querySelectorAll('input[data-field="min"], input[data-field="max"]')) {
    const r = state.ranges[input.dataset.var];
    input.setAttribute('aria-invalid', String(!r || !(r[1] > r[0])));
  }

  const zOk = !built.error ? built.chart.form === 'z-chart' || zAvailable() : false;
  for (const radio of document.querySelectorAll('input[name="layout"]')) {
    radio.checked = radio.value === state.layout;
    if (radio.value === 'z') {
      radio.disabled = !zOk && state.layout !== 'z';
      radio.parentElement.classList.toggle('disabled', radio.disabled);
      radio.parentElement.title = radio.disabled ? 'Z-charts need a ratio, w = k·u/v' : '';
    }
  }
  $('delta').value = state.deltaMm;
  for (const b of document.querySelectorAll('#example-list button')) {
    b.setAttribute('aria-current', String(b.dataset.id === state.exampleId));
  }
}

function varRow(v, input) {
  const tr = document.createElement('tr');
  if (!input) tr.className = 'output';
  const name = document.createElement('td');
  name.className = 'name';
  name.textContent = displayName(v);
  name.title = input ? v : `${v} (answer)`;
  tr.append(name);
  if (input) {
    for (const field of ['min', 'max']) {
      const td = document.createElement('td');
      const el = document.createElement('input');
      el.type = 'text';
      el.inputMode = 'decimal';
      el.dataset.var = v;
      el.dataset.field = field;
      el.setAttribute('aria-label', `${v} ${field}`);
      el.value = String(state.ranges[v]?.[field === 'min' ? 0 : 1] ?? '');
      td.append(el);
      tr.append(td);
    }
  } else {
    for (const cls of ['cmin', 'cmax']) {
      const td = document.createElement('td');
      td.className = `computed ${cls}`;
      tr.append(td);
    }
  }
  const td = document.createElement('td');
  const el = document.createElement('input');
  el.type = 'text';
  el.dataset.var = v;
  el.dataset.field = 'unit';
  el.setAttribute('aria-label', `${v} unit`);
  el.value = state.units[v] ?? '';
  td.append(el);
  tr.append(td);
  return tr;
}

function sheetModel() {
  const ex = examples.find((e) => e.id === state.exampleId);
  const sameAsExample = ex && ex.formula === state.formula;
  return {
    chart: built.chart,
    layout: built.layout,
    formula: state.formula,
    units: state.units,
    certificate: built.certificate,
    key: sameAsExample ? ex.key : null,
    title: sameAsExample ? ex.name : 'Alignment chart',
    date: today()
  };
}

function renderSheet() {
  const holder = $('sheet');
  if (built.error) {
    holder.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = built.error;
    holder.append(p);
    return;
  }
  holder.innerHTML = toSVG(buildSheet(sheetModel()).items, { standalone: false });
}

let seDom = null;

/** Build the overlay elements once per chart; drags only move them (keeps focus and capture). */
function renderStraightedge() {
  const svg = $('overlay');
  if (built.error || !se) {
    svg.replaceChildren();
    seDom = null;
    return;
  }
  const { layout, chart } = built;
  if (!seDom || seDom.layout !== layout) {
    svg.replaceChildren();
    const line = el('line', { class: 'se-line' });
    svg.append(line);
    const handles = layout.scales.map((s, i) => {
      const g = el('g', {
        class: 'se-handle', tabindex: 0, role: 'slider',
        'aria-valuemin': chart.scales[i].range[0], 'aria-valuemax': chart.scales[i].range[1]
      });
      const hit = el('circle', { r: 4.5, class: 'hit' });
      const ring = el('circle', { r: 1.6, class: 'ring' });
      g.append(hit, ring);
      g.addEventListener('pointerdown', (e) => startDrag(i, e));
      g.addEventListener('keydown', (e) => keyMove(i, e));
      svg.append(g);
      return { g, hit, ring };
    });
    const tag = el('text', { class: 'se-tag' });
    svg.append(tag);
    seDom = { layout, line, handles, tag };
  }
  updateStraightedge();
}

function updateStraightedge() {
  const { layout, chart } = built;
  const pts = layout.scales.map((s, i) => s.valueToPoint(se.values[i]));
  const known = [0, 1, 2].filter((i) => i !== se.solved);
  const a = pts[known[0]];
  const b = pts[known[1]];
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  // The ruler runs 14 mm past the outermost scales.
  const xs = layout.scales.flatMap((s) => [s.x1, s.x2]);
  const minX = Math.min(...xs) - 14;
  const maxX = Math.max(...xs) + 14;
  const tAt = (x) => (Math.abs(ux) < 1e-9 ? 0 : (x - a.x) / ux);
  const t0 = Math.min(tAt(minX), tAt(maxX), -14);
  const t1 = Math.max(tAt(minX), tAt(maxX), d + 14);
  setAttrs(seDom.line, {
    x1: a.x + ux * t0, y1: a.y + uy * t0, x2: a.x + ux * t1, y2: a.y + uy * t1,
    class: 'se-line' + (se.out ? ' off' : '')
  });

  layout.scales.forEach((s, i) => {
    const solved = i === se.solved;
    const h = seDom.handles[i];
    const p = solved && se.out ? nearestEnd(s, a, b) : pts[i];
    const name = chart.scales[i].variable;
    setAttrs(h.g, {
      class: 'se-handle' + (solved ? ' solved' : '') + (solved && se.out ? ' out' : ''),
      'aria-label': `${name}${solved ? ' (solved)' : ''}`,
      'aria-valuenow': se.values[i],
      'aria-valuetext': `${name} = ${formatNumber(se.values[i], 4)}`
    });
    setAttrs(h.hit, { cx: p.x, cy: p.y });
    setAttrs(h.ring, { cx: p.x, cy: p.y });
  });

  // Value tag beside the solved handle, on the side away from its tick labels.
  const tag = seDom.tag;
  if (se.out) {
    tag.textContent = '';
    return;
  }
  const s = layout.scales[se.solved];
  const p = pts[se.solved];
  const vertical = Math.abs(s.x2 - s.x1) < 1e-9;
  const leftMost = vertical && Math.abs(s.x1 - Math.min(...xs)) < 1e-6;
  const dx = leftMost ? 3.2 : -3.2;
  setAttrs(tag, { x: p.x + dx, y: p.y - 2.4, 'text-anchor': dx < 0 ? 'end' : 'start' });
  tag.textContent = formatNumber(se.values[se.solved], 4);
}

function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
}

/** Where the ruler would cross scale s, clamped to the scale's printed ends. */
function nearestEnd(s, a, b) {
  const d1x = b.x - a.x;
  const d1y = b.y - a.y;
  const d2x = s.x2 - s.x1;
  const d2y = s.y2 - s.y1;
  const det = d1x * d2y - d1y * d2x;
  let t = 0;
  if (Math.abs(det) > 1e-12) t = (d1y * (s.x1 - a.x) - d1x * (s.y1 - a.y)) / det;
  t = Math.min(1, Math.max(0, t));
  return { x: s.x1 + t * d2x, y: s.y1 + t * d2y };
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function renderReadout() {
  const out = $('readout');
  const verify = $('verify');
  out.replaceChildren();
  if (built.error || !se) {
    verify.textContent = '';
    return;
  }
  const { chart } = built;
  const part = (i) => {
    const v = chart.scales[i].variable;
    const unit = state.units[v] ? ' ' + state.units[v] : '';
    const val = i === se.solved && se.out ? 'off scale' : formatNumber(se.values[i], 4);
    return `${displayName(v)} = ${val}${unit}`;
  };
  const known = [0, 1, 2].filter((i) => i !== se.solved);
  out.append(document.createTextNode(`${part(known[0])}    ${part(known[1])}`));
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '    →    ';
  const solved = document.createElement('span');
  solved.className = 'solved';
  solved.textContent = part(se.solved);
  out.append(arrow, solved);

  if (se.out) {
    verify.textContent = `the straightedge leaves the ${chart.scales[se.solved].variable} scale; move a handle back`;
  } else {
    const [u, v, w] = se.values;
    const f = chart.evaluate(u, v);
    const delta = Math.abs(w - f) / Math.max(Math.abs(f), 1e-300);
    verify.textContent = `straightedge vs formula: relative Δ = ${delta === 0 ? '0' : delta.toExponential(1)}`;
  }
}

function renderCertificate() {
  if (built.error) {
    $('certificate').textContent = '—';
    $('certificate-method').textContent = '';
    return;
  }
  const c = built.certificate;
  $('certificate').textContent = formatCertificate(c, state.units[built.output] ?? '');
  $('certificate-method').textContent = formatCertificateMethod(c);
}

// Below 1024 px the panel stacks above the sheet (see the matching @media in styles.css).
const NARROW_QUERY = '(max-width: 1023px)';

function fitSheet() {
  const desk = document.querySelector('.desk');
  const frame = $('sheet-frame');
  if (window.matchMedia(NARROW_QUERY).matches) {
    // Narrow viewport: size by width so the sheet stays legible; the page scrolls vertically.
    const pad = getComputedStyle(desk);
    const sideGap = (parseFloat(pad.paddingLeft) || 0) + (parseFloat(pad.paddingRight) || 0);
    const setByWidth = () => {
      const w = Math.floor(desk.clientWidth - sideGap);
      frame.style.width = `${w}px`;
      frame.style.height = `${Math.floor((w * 297) / 210)}px`;
    };
    setByWidth();
    // A vertical scrollbar can appear once the tall sheet is set; re-measure so nothing overflows sideways.
    setByWidth();
    return;
  }
  const readout = document.querySelector('.readout');
  const availH = desk.clientHeight - 20 - 12 - readout.offsetHeight - 8;
  const availW = desk.clientWidth - 40;
  let h = Math.max(320, availH);
  let w = (h * 210) / 297;
  if (w > availW) { w = availW; h = (w * 297) / 210; }
  frame.style.width = `${Math.floor(w)}px`;
  frame.style.height = `${Math.floor(h)}px`;
}

// ---------------------------------------------------------------- export

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSVG() {
  if (built.error) return;
  download(fileName(state, 'svg'), toSVG(buildSheet(sheetModel()).items), 'image/svg+xml');
}

function downloadPDF() {
  if (built.error) return;
  const pdf = toPDF(buildSheet(sheetModel()).items, { title: sheetModel().title });
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  download(fileName(state, 'pdf'), bytes, 'application/pdf');
}

// ---------------------------------------------------------------- events

function setup() {
  const fromHash = decodeStateFromHash(location.hash);
  if (fromHash) state = { ...state, ...fromHash };

  const list = $('example-list');
  for (const e of examples) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = e.id;
    b.innerHTML = '<span class="ex-name"></span><span class="ex-formula"></span>';
    b.querySelector('.ex-name').textContent = e.name;
    b.querySelector('.ex-formula').textContent = e.formula;
    b.addEventListener('click', () => {
      state = fromExample(e);
      $('formula').value = state.formula;
      $('vars').tBodies[0].dataset.sig = '';
      rebuild();
    });
    li.append(b);
    list.append(li);
  }

  $('formula').addEventListener('input', (e) => {
    state.formula = e.target.value;
    const ex = examples.find((x) => x.id === state.exampleId);
    if (!ex || ex.formula !== state.formula) state.exampleId = null;
    clearTimeout(formulaTimer);
    formulaTimer = setTimeout(() => rebuild(), 250);
  });

  $('vars').addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    const v = t.dataset.var;
    if (t.dataset.field === 'unit') {
      state.units[v] = t.value;
      rebuild({ keepStraightedge: true });
      return;
    }
    // Validate the pair as it stands in the row, not one field against the stored range:
    // typing a min above the old max must not be dropped silently while the field shows it.
    const row = t.closest('tr');
    const read = (field) => {
      const el = row.querySelector(`input[data-field="${field}"]`);
      return el.value.trim() === '' ? NaN : Number(el.value.trim());
    };
    const next = [read('min'), read('max')];
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || !(next[1] > next[0])) {
      t.setAttribute('aria-invalid', 'true');
      return;
    }
    for (const el of row.querySelectorAll('input[data-field="min"], input[data-field="max"]')) {
      el.removeAttribute('aria-invalid');
    }
    state.ranges[v] = next;
    rebuild();
  });

  for (const radio of document.querySelectorAll('input[name="layout"]')) {
    radio.addEventListener('change', (e) => {
      state.layout = e.target.value;
      rebuild();
    });
  }

  $('delta').addEventListener('input', (e) => {
    const d = Number(e.target.value);
    if (!(d >= 0.1 && d <= 5)) return;
    state.deltaMm = d;
    rebuild({ keepStraightedge: true });
  });

  $('dl-svg').addEventListener('click', downloadSVG);
  $('dl-pdf').addEventListener('click', downloadPDF);
  $('print').addEventListener('click', () => window.print());
  $('nav-print').addEventListener('click', () => window.print());
  $('nav-how').addEventListener('click', (e) => { e.preventDefault(); $('how-dialog').showModal(); });
  $('how-dialog').addEventListener('click', (e) => { if (e.target === $('how-dialog')) $('how-dialog').close(); });
  $('nav-examples').addEventListener('click', (e) => {
    e.preventDefault();
    $('examples').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('resize', fitSheet);
  $('formula').value = state.formula;
  rebuild();
  fitSheet();
}

// Exposed for the headless checks in scripts/shoot.py.
window.isopleth = {
  get state() { return state; },
  get straightedge() { return se; },
  get built() { return built; },
  moveHandle: (i, v) => moveHandle(i, v),
  sheetModel: () => sheetModel(),
  accent: VERMILION
};

setup();
