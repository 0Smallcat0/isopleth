// sheet.test.js - Graduations, certificate, sheet, SVG and PDF output (engine T27-T37)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { getExamples } from '../src/core/examples.js';
import { buildChart, parseFormula } from '../src/core/pipeline.js';
import { graduate, niceStep } from '../src/core/graduate.js';
import { generateCertificate, formatCertificate, crossScale, sampleRange, SAFETY } from '../src/core/certificate.js';
import { buildSheet, overlaps, FRAME, TITLE_BLOCK } from '../src/core/sheet.js';
import { renderSVG, toSVG } from '../src/core/svg.js';
import { renderPDF } from '../src/core/pdf.js';
import { runsWidth, textRuns, tickLabelRuns, prettyFormula, formatNumber } from '../src/core/text.js';

const examples = getExamples();
const builtAll = examples.map((e) => ({ e, r: buildChart(e) }));
const model = ({ e, r }) => ({
  chart: r.chart, layout: r.layout, formula: e.formula, units: e.units,
  certificate: r.certificate, key: e.key, title: e.name, date: '2026-11-07'
});
const textOf = (t) => t.runs.map((r) => r.text).join('');

describe('examples (T36)', () => {
  it('every example compiles to its intended layout', () => {
    for (const { e, r } of builtAll) {
      assert.ok(!r.error, `${e.id}: ${r.error}`);
      assert.equal(r.layout.kind, e.layout === 'z' ? 'z' : 'parallel', e.id);
    }
  });
  it('every key line lands on the chart', () => {
    for (const { e, r } of builtAll) {
      const w = r.chart.evaluate(e.key.u, e.key.v);
      const [lo, hi] = r.chart.scales[2].range;
      assert.ok(w >= lo && w <= hi, `${e.id}: key answer ${w} outside ${lo}..${hi}`);
    }
  });
});

describe('pipeline', () => {
  it('reports parse errors, wrong variable counts and bad ranges', () => {
    assert.ok(buildChart({ formula: 'V = I *', ranges: {} }).error);
    assert.ok(buildChart({ formula: 'w = u', ranges: { u: [1, 2] } }).error);
    assert.ok(buildChart({ formula: 'w = u * v', ranges: { u: [2, 1], v: [1, 2] } }).error);
    assert.deepEqual(parseFormula('c = sqrt(a^2 + b^2)').inputs, ['a', 'b']);
  });
});

describe('graduate', () => {
  it('niceStep returns 1-2-5 steps', () => {
    assert.equal(niceStep(0.3), 0.2);
    assert.equal(niceStep(4), 5);
    assert.equal(niceStep(80), 100);
  });
  it('ticks are inside the range, sorted, and at least 1 mm apart', () => {
    for (const { e, r } of builtAll) {
      r.layout.scales.forEach((s, i) => {
        const g = graduate(s, r.chart.scales[i]);
        const [lo, hi] = r.chart.scales[i].range;
        assert.ok(g.length >= 10, `${e.id} scale ${i}: only ${g.length} ticks`);
        for (let k = 0; k < g.length; k++) {
          assert.ok(g[k].value >= lo - 1e-9 * (hi - lo) && g[k].value <= hi + 1e-9 * (hi - lo));
          if (k > 0) {
            assert.ok(g[k].value > g[k - 1].value);
            const d = Math.hypot(g[k].x - g[k - 1].x, g[k].y - g[k - 1].y);
            assert.ok(d >= 0.99, `${e.id} scale ${i}: ticks ${g[k - 1].value} and ${g[k].value} are ${d.toFixed(2)} mm apart`);
          }
        }
      });
    }
  });
  it("a log scale over two decades gets its 2..9 marks (Ohm's law, I)", () => {
    const { r } = builtAll.find((b) => b.e.id === 'ohms-law');
    const values = graduate(r.layout.scales[0], r.chart.scales[0]).map((g) => g.value);
    for (const v of [0.2, 0.5, 2, 3, 5, 9]) assert.ok(values.includes(v), `missing ${v}`);
  });
});

describe('certificate (T27-T30)', () => {
  it('crossScale finds a crossing and rejects one off the segment', () => {
    const seg = { x1: 4, y1: 0, x2: 4, y2: 10 };
    assert.deepEqual(crossScale({ x: 0, y: 5 }, { x: 10, y: 5 }, seg), { x: 4, y: 5 });
    assert.equal(crossScale({ x: 0, y: 12 }, { x: 10, y: 12 }, seg), null);
    assert.equal(crossScale({ x: 4, y: 1 }, { x: 4, y: 3 }, seg), null);
  });
  it('samples log ranges geometrically', () => {
    const s = sampleRange({ range: [1, 100], scaleKind: 'log' }, 3);
    assert.ok(Math.abs(s[1] - 10) < 1e-12);
  });
  it('uses the 41 x 41 grid with 4 placements per point', () => {
    for (const { e, r } of builtAll) {
      assert.ok(r.certificate.gridSize <= 1681 && r.certificate.gridSize > 1000, e.id);
      assert.ok(r.certificate.perturbations <= 4 * r.certificate.gridSize, e.id);
      assert.ok(r.certificate.perturbations > 3.9 * r.certificate.gridSize, e.id);
    }
  });
  it('R6-zero-delta: a perfect straightedge reads the formula', () => {
    for (const { e, r } of builtAll) {
      const c = generateCertificate(r.layout, r.chart, 0);
      const span = r.chart.scales[2].range[1] - r.chart.scales[2].range[0];
      const tol = c.errorType === 'relative' ? 1e-6 : 1e-6 * span;
      assert.ok(c.maxError <= tol, `${e.id}: ${c.maxError}`);
    }
  });
  it('the error grows in proportion to the tolerance', () => {
    const { r } = builtAll[0];
    const a = generateCertificate(r.layout, r.chart, 0.5).maxError;
    const b = generateCertificate(r.layout, r.chart, 1.0).maxError;
    assert.ok(b > a * 1.8 && b < a * 2.2, `${a} -> ${b}`);
  });
  it('R6-certificate-soundness: random readings off the grid stay inside the bound', () => {
    for (const { e, r } of builtAll) {
      const [s0, s1, s2] = r.layout.scales;
      const c = r.certificate;
      const unit = (s) => {
        const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        return { x: (s.x2 - s.x1) / l, y: (s.y2 - s.y1) / l };
      };
      const e0 = unit(s0);
      const e1 = unit(s1);
      const [wlo, whi] = r.chart.scales[2].range;
      const pick = (s, f) => {
        const [lo, hi] = s.range;
        return s.scaleKind === 'log' && lo > 0 ? lo * (hi / lo) ** f : lo + f * (hi - lo);
      };
      fc.assert(fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }), fc.double({ min: -1, max: 1, noNaN: true }),
        (fu, fv, da, db) => {
          const u = pick(r.chart.scales[0], fu);
          const v = pick(r.chart.scales[1], fv);
          const w = r.chart.evaluate(u, v);
          if (!(w >= wlo && w <= whi)) return true;
          const p = s0.valueToPoint(u);
          const q = s1.valueToPoint(v);
          const d = c.deltaMm;
          const hit = crossScale(
            { x: p.x + da * d * e0.x, y: p.y + da * d * e0.y },
            { x: q.x + db * d * e1.x, y: q.y + db * d * e1.y }, s2);
          if (!hit) return true;
          const wr = s2.pointToValue(hit);
          const err = c.errorType === 'relative' ? (Math.abs(wr - w) / Math.abs(w)) * 100 : Math.abs(wr - w);
          return err <= c.maxError;
        }
      ), { numRuns: 300 });
      assert.ok(Math.abs(c.maxError - c.rawMaxError * SAFETY) < 1e-12, e.id);
    }
  });
  it('states the bound in one sentence, in % for log answers and in units for linear ones', () => {
    const z = builtAll.find((b) => b.e.id === 'axial-stress');
    assert.match(formatCertificate(z.r.certificate, 'MPa'), /^With the straightedge within ±0\.5 mm of each mark, σ reads within ±[\d.]+ MPa/);
    const o = builtAll.find((b) => b.e.id === 'ohms-law');
    assert.match(formatCertificate(o.r.certificate, 'V'), /V reads within ±[\d.]+ %/);
  });
});

describe('text', () => {
  it('pretty-prints formulas', () => {
    assert.equal(prettyFormula('c = sqrt(a^2 + b^2)'), 'c = √(a² + b²)');
    assert.equal(prettyFormula('sigma = 1000 * F / A'), 'σ = 1000·F/A');
  });
  it('formats numbers without binary noise', () => {
    assert.equal(formatNumber(0.1 + 0.2), '0.3');
    assert.equal(formatNumber(12345.678), '12 350');
    assert.equal(formatNumber(2e-6), '2e-6');
  });
  it('tick labels use powers of ten from 1e5 up', () => {
    assert.deepEqual(tickLabelRuns(1e6).map((r) => r.text), ['10', '6']);
    assert.equal(tickLabelRuns(1e6)[1].sup, true);
    assert.deepEqual(tickLabelRuns(5e5).map((r) => r.text), ['5×', '10', '5']);
    assert.deepEqual(tickLabelRuns(2000).map((r) => r.text), ['2000']);
  });
  it('measures Helvetica widths', () => {
    assert.ok(Math.abs(runsWidth(textRuns('10'), 10) - 11.12) < 1e-9);
  });
});

describe('sheet and SVG (T31-T35)', () => {
  it('R7-no-overlap: tick labels never overlap each other or leave the drawing area', () => {
    for (const b of builtAll) {
      const { labels } = buildSheet(model(b));
      assert.ok(labels.length >= 15, `${b.e.id}: only ${labels.length} labels`);
      for (let i = 0; i < labels.length; i++) {
        const L = labels[i].box;
        assert.ok(L[0] >= FRAME.x && L[2] <= FRAME.x + FRAME.width && L[1] >= FRAME.y && L[3] <= TITLE_BLOCK.y,
          `${b.e.id}: label ${labels[i].value} outside the drawing area`);
        for (let j = i + 1; j < labels.length; j++) {
          assert.ok(!overlaps(L, labels[j].box), `${b.e.id}: labels ${labels[i].value} and ${labels[j].value} overlap`);
        }
      }
    }
  });
  it('every scale carries at least three labels', () => {
    for (const b of builtAll) {
      const { labels } = buildSheet(model(b));
      for (let i = 0; i < 3; i++) assert.ok(labels.filter((l) => l.scale === i).length >= 3, `${b.e.id} scale ${i}`);
    }
  });
  it('title-block text fits its cells', () => {
    for (const b of builtAll) {
      const { items } = buildSheet(model(b));
      for (const t of items.filter((x) => x.t === 'text' && x.role === 'block')) {
        const w = runsWidth(t.runs, t.size);
        assert.ok(t.x + w <= FRAME.x + FRAME.width - 1, `${b.e.id}: "${textOf(t)}" runs past the frame`);
        if (t.x < 136 && t.y < TITLE_BLOCK.y + 28) assert.ok(t.x + w <= 136, `${b.e.id}: "${textOf(t)}" crosses the title-block divider`);
      }
    }
  });
  it('SVG is A4 in millimetres with a 100 mm calibration bar', () => {
    const svg = renderSVG(model(builtAll[0]));
    assert.match(svg, /width="210mm" height="297mm" viewBox="0 0 210 297"/);
    assert.match(svg, /<line x1="15" y1="279.5" x2="115" y2="279.5" stroke-width="0.3"\/>/);
    assert.match(svg, />100 mm</);
    assert.match(svg, /V = I·R/);
  });
  it('R7-well-formed: tags balance and text is escaped, for random charts and units', () => {
    const forms = ['w = a + b', 'w = a * b', 'w = sqrt(a * b)', 'w = a^2 + b'];
    fc.assert(fc.property(
      fc.constantFrom(...forms),
      fc.double({ min: 0.5, max: 5, noNaN: true }), fc.double({ min: 6, max: 500, noNaN: true }),
      fc.string({ maxLength: 6 }),
      (formula, lo, hi, unit) => {
        const r = buildChart({ formula, ranges: { a: [lo, hi], b: [lo, hi] } });
        if (r.error) return true;
        const svg = renderSVG({ chart: r.chart, layout: r.layout, formula, units: { a: unit, b: '<&>', w: '"' }, certificate: r.certificate });
        const opens = (svg.match(/<(line|rect|circle|text|tspan|g|svg)\b/g) || []).length;
        const closes = (svg.match(/\/>|<\/(text|tspan|g|svg)>/g) || []).length;
        return opens === closes && !/<(?![a-z/?])/.test(svg) && !svg.includes('NaN') && !svg.includes('Infinity');
      }
    ), { numRuns: 200 });
  });
  it('toSVG can omit the XML declaration for inline use', () => {
    assert.ok(!toSVG([], { standalone: false }).startsWith('<?xml'));
  });
});

describe('PDF', () => {
  it('is a one-page A4 PDF in pure ASCII whose xref offsets point at its objects', () => {
    for (const b of builtAll) {
      const pdf = renderPDF(model(b), { title: b.e.name });
      assert.ok(pdf.startsWith('%PDF-1.4'));
      assert.ok([...pdf].every((c) => c.charCodeAt(0) < 128), `${b.e.id}: not ASCII`);
      assert.match(pdf, /\/MediaBox \[0 0 595\.276 841\.89\]/);
      const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
      assert.ok(pdf.slice(xref).startsWith('xref'));
      const offsets = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
      assert.equal(offsets.length, 8);
      offsets.forEach((o, i) => assert.ok(pdf.slice(o).startsWith(`${i + 1} 0 obj`), `${b.e.id}: object ${i + 1}`));
      const len = Number(pdf.match(/\/Length (\d+) >>\nstream\n/)[1]);
      const start = pdf.indexOf('stream\n') + 7;
      assert.equal(pdf.slice(start + len, start + len + 10), '\nendstream');
    }
  });
});
