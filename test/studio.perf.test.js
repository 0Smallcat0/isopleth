// studio.perf.test.js - T16: build times per example, and the studio's debounce and drag mechanism.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { getExamples } from '../src/core/examples.js';
import { buildChart } from '../src/core/pipeline.js';
import { buildSheet } from '../src/core/sheet.js';
import { toSVG } from '../src/core/svg.js';
import { toPDF } from '../src/core/pdf.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_MS = { chart: 1500, sheetSvg: 500, pdf: 500 };

for (const ex of getExamples()) {
  test(`R13-timing ${ex.id}`, () => {
    const state = {
      formula: ex.formula,
      ranges: structuredClone(ex.ranges),
      units: structuredClone(ex.units),
      layout: ex.layout,
      deltaMm: 0.5
    };

    let t = performance.now();
    const built = buildChart(state);
    const chartMs = performance.now() - t;
    assert.equal(built.error, undefined, built.error);

    const model = {
      chart: built.chart,
      layout: built.layout,
      formula: state.formula,
      units: state.units,
      certificate: built.certificate,
      key: ex.key,
      title: ex.name,
      date: '2025-01-01'
    };

    t = performance.now();
    const sheet = buildSheet(model);
    const svg = toSVG(sheet.items);
    const sheetSvgMs = performance.now() - t;
    assert.ok(svg.length > 0);

    t = performance.now();
    const pdf = toPDF(sheet.items, { title: ex.name });
    const pdfMs = performance.now() - t;
    assert.ok(pdf.length > 0);

    console.log(`[perf] ${ex.id}: buildChart ${chartMs.toFixed(1)} ms, buildSheet+toSVG ${sheetSvgMs.toFixed(1)} ms, toPDF ${pdfMs.toFixed(1)} ms`);

    assert.ok(chartMs < BUDGET_MS.chart, `buildChart ${chartMs.toFixed(1)} ms >= ${BUDGET_MS.chart} ms`);
    assert.ok(sheetSvgMs < BUDGET_MS.sheetSvg, `buildSheet+toSVG ${sheetSvgMs.toFixed(1)} ms >= ${BUDGET_MS.sheetSvg} ms`);
    assert.ok(pdfMs < BUDGET_MS.pdf, `toPDF ${pdfMs.toFixed(1)} ms >= ${BUDGET_MS.pdf} ms`);
  });
}

const appSource = fs.readFileSync(path.join(ROOT, 'src/ui/app.js'), 'utf8');

/** Source text of a top-level `function name(...) { ... }` in app.js (ends at the first line that is just `}`). */
function functionBody(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} exists in app.js`);
  const end = appSource.slice(start).search(/\r?\n\}\r?\n/);
  assert.ok(end > 0, `function ${name} ends`);
  return appSource.slice(start, start + end + 2);
}

test('R3.1-formula-input-is-debounced-250ms', () => {
  assert.match(appSource, /clearTimeout\(formulaTimer\)/);
  assert.match(appSource, /formulaTimer\s*=\s*setTimeout\(\s*\(\)\s*=>\s*rebuild\(\)\s*,\s*250\s*\)/);
  // The formula handler must not rebuild directly.
  const from = appSource.indexOf("$('formula').addEventListener('input'");
  const to = appSource.indexOf("$('vars').addEventListener", from);
  assert.ok(from >= 0 && to > from, 'formula input handler found');
  const handler = appSource.slice(from, to).replace(/setTimeout\(\(\) => rebuild\(\), 250\)/, '');
  assert.equal(handler.includes('rebuild('), false, 'no rebuild() call outside the timer');
});

test('R13-straightedge-drag-moves-existing-elements-without-rebuilding-the-sheet', () => {
  // The mechanism in app.js: no requestAnimationFrame. A drag calls moveHandle(), which solves the
  // line, then moves the overlay elements built once per layout and rewrites the readout text.
  const usesRaf = /requestAnimationFrame/.test(appSource);

  const move = functionBody('moveHandle');
  assert.match(move, /updateStraightedge\(\)/);
  assert.match(move, /renderReadout\(\)/);
  for (const forbidden of ['rebuild(', 'render(', 'renderSheet(', 'buildSheet(', 'buildChart(', 'toSVG(', 'innerHTML']) {
    assert.equal(move.includes(forbidden), false, `moveHandle must not call ${forbidden}`);
  }

  const update = functionBody('updateStraightedge');
  for (const forbidden of ['replaceChildren', 'createElementNS', 'innerHTML', 'buildSheet(', 'toSVG(']) {
    assert.equal(update.includes(forbidden), false, `updateStraightedge must not use ${forbidden}`);
  }
  assert.match(update, /setAttrs\(/);

  // Overlay elements are created only when the layout object changes.
  const create = functionBody('renderStraightedge');
  assert.match(create, /if \(!seDom \|\| seDom\.layout !== layout\)/);

  // The pointermove handler only reads the pointer and calls moveHandle.
  const drag = functionBody('startDrag');
  assert.match(drag, /valueAtPoint\(/);
  assert.match(drag, /moveHandle\(i, r\.value\)/);

  console.log(`[perf] drag mechanism: requestAnimationFrame ${usesRaf ? 'used' : 'not used'}; moves existing overlay elements, no sheet rebuild`);
});
