// studio.integration.test.js - T14: everything the studio calls, end to end, without a DOM.
//
// Chain per example (as in src/ui/app.js): buildChart -> buildSheet(sheetModel) -> toSVG / toPDF,
// the URL-hash state round trip, and straightedge readings through the reader.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getExamples } from '../src/core/examples.js';
import { buildChart } from '../src/core/pipeline.js';
import { buildSheet } from '../src/core/sheet.js';
import { toSVG } from '../src/core/svg.js';
import { toPDF } from '../src/core/pdf.js';
import { solveLine, valueAtPoint, pointOnScale } from '../src/core/reader.js';
import { formatCertificate } from '../src/core/certificate.js';
import { encodeStateToHash, decodeStateFromHash } from '../src/ui/state.js';
import { handleRequest } from '../mcp/server.mjs';

const DATE = '2025-01-01';
const SHEET_AREA = 210 * 297;
const PLACEMENTS = 25;

/** State exactly as app.js fromExample() creates it. */
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

/** Sheet model exactly as app.js sheetModel() creates it, with a fixed date. */
function sheetModel(state, built, examples) {
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
    date: DATE
  };
}

/** Small seeded generator (mulberry32), so a failure reproduces. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const count = (s, re) => (s.match(re) ?? []).length;

const examples = getExamples();

for (const [index, ex] of examples.entries()) {
  test(`R15.1-studio-chain ${ex.id}`, () => {
    const state = fromExample(ex);

    const built = buildChart(state);
    assert.equal(built.error, undefined, `buildChart failed: ${built.error}`);

    const model = sheetModel(state, built, examples);
    const svg = toSVG(buildSheet(model).items);
    assert.ok(svg.includes('<svg'), 'has an svg element');
    assert.match(svg, /^(<\?xml[^>]*\?>\s*)?<svg\b/, 'starts with <svg');
    assert.ok(svg.endsWith('</svg>'), 'ends with </svg>');
    assert.ok(svg.includes('viewBox="0 0 210 297"'), 'viewBox is the A4 sheet in mm');
    assert.match(svg, /width="210mm" height="297mm"/);
    assert.equal(count(svg, /<g[\s>]/g), count(svg, /<\/g>/g), 'balanced <g> tags');
    assert.ok(count(svg, /<g[\s>]/g) >= 1);
    assert.equal(count(svg, /<svg\b/g), 1);
    assert.equal(count(svg, /<\/svg>/g), 1);

    const pdf = toPDF(buildSheet(model).items, { title: model.title });
    assert.ok(pdf.startsWith('%PDF-'), 'PDF header');
    assert.ok(pdf.trimEnd().endsWith('%%EOF'), 'PDF trailer');
    assert.equal(count(pdf, /\/Type \/Page /g), 1, 'exactly one page object');
  });

  test(`R15.2-state-roundtrip ${ex.id}`, () => {
    const state = fromExample(ex);
    const hash = encodeStateToHash(state);
    const decoded = decodeStateFromHash('#' + hash);
    assert.ok(decoded, 'hash decodes');
    assert.deepEqual(decoded, state);
    assert.deepEqual(decodeStateFromHash(hash), state, 'works without the leading #');

    const a = buildChart(state);
    const b = buildChart(decoded);
    assert.equal(a.error, undefined);
    assert.equal(b.error, undefined);
    const svgA = toSVG(buildSheet(sheetModel(state, a, examples)).items);
    const svgB = toSVG(buildSheet(sheetModel(decoded, b, examples)).items);
    assert.equal(svgB, svgA, 'rebuilt chart is identical');
  });

  test(`R15.3-straightedge-placements ${ex.id}`, () => {
    const state = fromExample(ex);
    const { chart, layout, error } = buildChart(state);
    assert.equal(error, undefined);
    const rand = seeded(1000 + index);
    const [su, sv, sw] = chart.scales;
    const span = Math.abs(sw.range[1] - sw.range[0]);

    for (let k = 0; k < PLACEMENTS; k++) {
      const u = su.range[0] + rand() * (su.range[1] - su.range[0]);
      const v = sv.range[0] + rand() * (sv.range[1] - sv.range[0]);
      const label = `${ex.id} placement ${k}: u=${u}, v=${v}`;

      const r = solveLine(layout, chart, { scale: 0, value: u }, { scale: 1, value: v });
      assert.equal(r.error, undefined, `${label}: ${r.error}`);
      assert.equal(r.scale, 2);

      // Collinearity: |det| of the three scale points, against the sheet area.
      const p1 = pointOnScale(layout, 0, u);
      const p2 = pointOnScale(layout, 1, v);
      const p3 = pointOnScale(layout, 2, r.value);
      const det = p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y);
      assert.ok(Math.abs(det) <= 1e-9 * SHEET_AREA, `${label}: |det| = ${Math.abs(det)}`);

      // Reading equals the formula: relative 1e-6, absolute 1e-9 x span near zero.
      const f = chart.evaluate(u, v);
      const tol = Math.max(1e-6 * Math.abs(f), 1e-9 * span);
      assert.ok(Math.abs(r.value - f) <= tol, `${label}: read ${r.value}, formula ${f}`);

      // A handle dragged onto its own mark gives the same value back.
      const back = valueAtPoint(layout, chart, 0, p1);
      assert.equal(back.error, undefined, `${label}: ${back.error}`);
      assert.ok(Math.abs(back.value - u) <= 1e-6 * Math.max(Math.abs(u), 1e-9 * Math.abs(su.range[1] - su.range[0])),
        `${label}: valueAtPoint gave ${back.value}`);
    }
  });
}

test('R9.5-mcp-certificate-sentence-matches-formatCertificate (Ohm\'s law)', () => {
  const ohm = examples.find((e) => e.id === 'ohms-law');
  const built = buildChart({ formula: ohm.formula, ranges: ohm.ranges, layout: 'parallel', deltaMm: 0.5 });
  assert.equal(built.error, undefined);
  const expected = formatCertificate(built.certificate, '');

  const res = handleRequest({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'make_nomogram', arguments: { formula: ohm.formula, ranges: ohm.ranges } }
  });
  assert.equal(res.error, undefined);
  const firstLine = res.result.content[0].text.split('\n')[0];
  assert.equal(firstLine, expected);
});

test('R3.4-malformed-hash-decodes-to-null', () => {
  for (const bad of ['', '#', '#%E0%A4%A', '#not-json', '#' + encodeURIComponent('{"f":1}'),
    '#' + encodeURIComponent('{"f":"a = b","r":{"b":[5,1]}}'), '#' + encodeURIComponent('[]'),
    '#' + encodeURIComponent('{"f":"a = b","r":{"b":[1,2]},"l":"spiral"}')]) {
    assert.equal(decodeStateFromHash(bad), null, `hash ${JSON.stringify(bad)}`);
  }
});

test('R3.5-three-inputs-is-an-error', () => {
  const r = buildChart({ formula: 'W = a + b + c', ranges: { a: [1, 2], b: [1, 2], c: [1, 2] } });
  assert.equal(typeof r.error, 'string');
  assert.match(r.error, /exactly two input variables/);
  assert.equal(r.chart, undefined);
});

test('R3.6-range-min-not-below-max-is-an-error', () => {
  for (const I of [[10, 1], [5, 5]]) {
    const r = buildChart({ formula: 'V = I * R', ranges: { I, R: [1, 1000] } });
    assert.equal(typeof r.error, 'string', `range ${I}`);
    assert.match(r.error, /min < max/);
    assert.equal(r.chart, undefined);
  }
});
