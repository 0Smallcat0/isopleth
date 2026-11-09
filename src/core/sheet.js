// sheet.js - Compose the printed A4 sheet as a display list (engine tasks T31-T33).
//
// The display list is a flat array of primitives in millimetres (SVG orientation,
// y down). svg.js and pdf.js serialise the same list, so the downloaded SVG, the PDF
// and the on-screen sheet are the same drawing.
//
//   {t: 'line', x1, y1, x2, y2, w, color?, dash?}
//   {t: 'rect', x, y, width, height, w, color?, fill?}
//   {t: 'circle', cx, cy, r, w, color?, fill?}
//   {t: 'text', x, y, size, runs, anchor: 'start'|'middle'|'end', color?, rot?, spacing?, role?, halo?}
//   halo: a paper-coloured outline under the glyphs, so the key line never cuts a label

import { graduate } from './graduate.js';
import { solveLine } from './reader.js';
import { formatCertificate, formatCertificateMethod } from './certificate.js';
import {
  runsWidth, textRuns, tickLabelRuns, displayName, prettyFormula, formatNumber, SUP_RISE
} from './text.js';

export const SHEET = { width: 210, height: 297 };
export const FRAME = { x: 10, y: 10, width: 190, height: 277 };
export const TITLE_BLOCK = { x: 10, y: 245, width: 190, height: 42 };
export const INK = '#1f1e1c';
export const MUTED = '#6f6a60';
export const VERMILION = '#c43c25';
export const PAPER = '#fcfbf7'; // near-white: prints as white, reads as paper on screen

const TICK_LEN = [4.0, 2.8, 1.9, 1.25];
const TICK_W = [0.25, 0.2, 0.15, 0.13];
const LABEL_SIZE = [2.7, 2.4, 2.2];
const LABEL_GAP = 0.9; // tick end to label
const PAD = [0.45, 0.8, 1.0]; // clearance around label boxes, per level

/**
 * @typedef {object} SheetModel
 * @property {object} chart - from compile()
 * @property {object} layout - from layout()
 * @property {string} formula - as typed
 * @property {Record<string, string>} [units]
 * @property {object} [certificate] - from generateCertificate()
 * @property {{u: number, v: number} | null} [key] - values for the dashed key line
 * @property {string} [title] - e.g. example name
 * @property {string} [date] - ISO date for the title block
 */

/**
 * Build the display list for a sheet.
 * @param {SheetModel} m
 * @returns {{items: object[], labels: {box: number[], scale: number, value: number}[]}}
 */
export function buildSheet(m) {
  const items = [];
  const obstacles = [];
  const placedLabels = [];
  const units = m.units ?? {};
  const scales = m.layout.scales;
  const isZ = m.layout.kind === 'z';

  items.push({ t: 'rect', x: 0, y: 0, width: SHEET.width, height: SHEET.height, w: 0, fill: PAPER, role: 'paper' });
  items.push({ t: 'rect', x: FRAME.x, y: FRAME.y, width: FRAME.width, height: FRAME.height, w: 0.35 });

  // Side of each scale where ticks and labels go (unit normal).
  const sides = scales.map((s, i) => labelSide(s, i, isZ, scales));

  // Scale lines and graduations.
  const grads = scales.map((s, i) => graduate(s, m.chart.scales[i]));
  scales.forEach((s, i) => {
    items.push({ t: 'line', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, w: 0.3, role: 'scale' });
    const n = sides[i];
    for (const g of grads[i]) {
      const len = TICK_LEN[g.level];
      items.push({ t: 'line', x1: g.x, y1: g.y, x2: g.x + n.x * len, y2: g.y + n.y * len, w: TICK_W[g.level], role: 'tick' });
    }
    // A vertical scale line is an obstacle for labels of other scales.
    if (Math.abs(s.x2 - s.x1) < 1e-9) obstacles.push(pad(bboxOfSegment(s), 0.3));
  });

  // Headings: variable name and unit.
  scales.forEach((s, i) => {
    const v = m.chart.scales[i].variable ?? m.chart.scales[i].name;
    const name = displayName(v);
    const unitText = units[v] ? `[${units[v]}]` : '';
    if (isZ && i === 2) {
      const d = dir(s);
      const ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
      const n = sides[i];
      const t = 0.56;
      const cx = s.x1 + (s.x2 - s.x1) * t - n.x * 5.5;
      const cy = s.y1 + (s.y2 - s.y1) * t - n.y * 5.5;
      const runs = [...textRuns(name, 'italic'), ...textRuns(unitText ? '  ' + unitText : '')];
      items.push({ t: 'text', x: cx, y: cy, size: 4.2, runs, anchor: 'middle', rot: ang, role: 'heading' });
    } else {
      const top = Math.min(s.y1, s.y2);
      const x = s.x1;
      const nameRuns = textRuns(name, 'italic');
      items.push({ t: 'text', x, y: top - 7, size: 4.6, runs: nameRuns, anchor: 'middle', role: 'heading' });
      obstacles.push(pad(textBox(x, top - 7, 4.6, nameRuns, 'middle'), 0.5));
      if (unitText) {
        const ur = textRuns(unitText);
        items.push({ t: 'text', x, y: top - 3, size: 2.5, runs: ur, anchor: 'middle', color: MUTED, role: 'heading' });
        obstacles.push(pad(textBox(x, top - 3, 2.5, ur, 'middle'), 0.4));
      }
    }
  });

  // Tick labels, coarse levels first. Level 0 is placed label by label; finer levels
  // are placed per interval between coarser ticks, all or none, so a stretch of scale
  // is never labelled unevenly.
  const labelItems = [];
  const fitsFrame = (b) => b[0] >= FRAME.x + 1 && b[2] <= FRAME.x + FRAME.width - 1 && b[1] >= FRAME.y + 1 && b[3] <= TITLE_BLOCK.y - 1;
  for (let level = 0; level <= 2; level++) {
    scales.forEach((s, i) => {
      const n = sides[i];
      const anchor = Math.abs(n.x) < 0.2 ? 'middle' : n.x < 0 ? 'end' : 'start';
      const make = (g) => {
        const size = LABEL_SIZE[level];
        const runs = tickLabelRuns(g.value);
        const off = TICK_LEN[0] + LABEL_GAP;
        const x = g.x + n.x * off;
        let y = g.y + n.y * off + size * 0.36;
        if (Math.abs(n.y) > 0.2) y += n.y * size * 0.5; // diagonal: clear the tick ends
        const box = textBox(x, y, size, runs, anchor);
        return { g, x, y, size, runs, box, padded: pad(box, PAD[level]) };
      };
      const groups = [];
      let cur = [];
      for (const g of grads[i]) {
        if (g.level < level) { if (cur.length) groups.push(cur); cur = []; }
        else if (g.level === level) cur.push(g);
      }
      if (cur.length) groups.push(cur);
      for (const group of groups) {
        const cands = group.map(make);
        const free = (c, others) => fitsFrame(c.box) && !obstacles.some((o) => overlaps(o, c.padded)) && !others.some((o) => o !== c && overlaps(o.padded, c.padded));
        let accepted;
        if (level === 0) {
          accepted = [];
          for (const c of cands) if (free(c, accepted)) { accepted.push(c); obstacles.push(c.padded); }
        } else {
          accepted = cands.every((c) => free(c, cands)) ? cands : [];
          for (const c of accepted) obstacles.push(c.padded);
        }
        for (const c of accepted) {
          placedLabels.push({ box: c.box, scale: i, value: c.g.value });
          labelItems.push({ t: 'text', x: c.x, y: c.y, size: c.size, runs: c.runs, anchor, role: 'label', halo: true });
        }
      }
    });
  }

  // Dashed key line through a worked example.
  let keyText = '';
  if (m.key) {
    const r = solveLine(m.layout, m.chart, { scale: 0, value: m.key.u }, { scale: 1, value: m.key.v });
    if (!r.error) {
      const p = scales[0].valueToPoint(m.key.u);
      const q = scales[1].valueToPoint(m.key.v);
      const ends = [p, q, r.point].sort((a, b) => a.x - b.x || a.y - b.y);
      items.push({ t: 'line', x1: ends[0].x, y1: ends[0].y, x2: ends[2].x, y2: ends[2].y, w: 0.2, dash: [1.4, 0.9], role: 'key' });
      for (const pt of [p, q, r.point]) items.push({ t: 'circle', cx: pt.x, cy: pt.y, r: 0.8, w: 0.2, role: 'key' });
      const vs = m.chart.scales.map((c) => c.variable ?? c.name);
      const part = (i, val) => `${displayName(vs[i])} = ${formatNumber(val, 3)}${units[vs[i]] ? ' ' + units[vs[i]] : ''}`;
      keyText = `Key (dashed): ${part(0, m.key.u)}, ${part(1, m.key.v)} → ${part(2, r.value)}`;
    }
  }

  items.push(...labelItems);
  titleBlock(items, m, keyText);
  return { items, labels: placedLabels };
}

function titleBlock(items, m, keyText) {
  const tb = TITLE_BLOCK;
  const units = m.units ?? {};
  const midY = tb.y + 28;
  const splitX = 136;
  items.push({ t: 'line', x1: tb.x, y1: tb.y, x2: tb.x + tb.width, y2: tb.y, w: 0.35 });
  items.push({ t: 'line', x1: tb.x, y1: midY, x2: tb.x + tb.width, y2: midY, w: 0.2 });
  items.push({ t: 'line', x1: splitX, y1: tb.y, x2: splitX, y2: midY, w: 0.2 });

  const L = tb.x + 4;
  const leftW = splitX - L - 3;
  caption(items, L, tb.y + 4.2, 'FORMULA');
  fitText(items, L, tb.y + 11.5, 5.2, textRuns(prettyFormula(m.formula)), leftW);

  const vs = m.chart.scales.map((c) => c.variable ?? c.name);
  const rangeText = m.chart.scales
    .map((c, i) => `${displayName(vs[i])}  ${formatNumber(c.range[0], 3)} – ${formatNumber(c.range[1], 3)}${units[vs[i]] ? ' ' + units[vs[i]] : ''}`)
    .join('   ·   ');
  fitText(items, L, tb.y + 17, 2.4, textRuns(rangeText), leftW);
  if (m.certificate) {
    const unitOut = units[vs[2]] ?? '';
    fitText(items, L, tb.y + 21.6, 2.4, textRuns(formatCertificate(m.certificate, unitOut)), leftW);
    fitText(items, L, tb.y + 25.2, 2.0, textRuns(formatCertificateMethod(m.certificate)), leftW, MUTED);
  }

  const R = splitX + 4;
  const rightW = tb.x + tb.width - R - 3;
  items.push({ t: 'text', x: R, y: tb.y + 5.6, size: 3.4, runs: textRuns('ISOPLETH'), anchor: 'start', spacing: 0.9, role: 'mark' });
  const kind = m.layout.kind === 'z' ? 'Z-chart' : 'parallel scales';
  const form = { sum: 'sum', product: 'product, logarithmic', outer: 'outer function', 'z-chart': 'linear ratio' }[m.chart.form] ?? m.chart.form;
  fitText(items, R, tb.y + 11, 2.2, textRuns(m.title || 'Alignment chart'), rightW);
  fitText(items, R, tb.y + 15, 2.0, textRuns(`${kind}, ${form}`), rightW, MUTED);
  fitText(items, R, tb.y + 19, 2.0, textRuns(`Sheet A4 · print at 100 %${m.date ? ' · ' + m.date : ''}`), rightW, MUTED);
  if (keyText) fitText(items, R, tb.y + 24.4, 2.0, textRuns(keyText), rightW);

  // Calibration bar: 100 mm with centimetre ticks.
  const bx = tb.x + 5;
  const by = midY + 6.5;
  items.push({ t: 'line', x1: bx, y1: by, x2: bx + 100, y2: by, w: 0.3, role: 'calibration' });
  for (let i = 0; i <= 10; i++) {
    const h = i === 0 || i === 10 ? 2.6 : i === 5 ? 1.8 : 1.2;
    items.push({ t: 'line', x1: bx + i * 10, y1: by, x2: bx + i * 10, y2: by - h, w: 0.2, role: 'calibration' });
  }
  items.push({ t: 'text', x: bx, y: by + 3.6, size: 2.0, runs: textRuns('0'), anchor: 'middle', color: MUTED });
  items.push({ t: 'text', x: bx + 100, y: by + 3.6, size: 2.0, runs: textRuns('100 mm'), anchor: 'middle', color: MUTED });
  items.push({ t: 'text', x: bx + 50, y: by + 3.6, size: 2.0, runs: textRuns('measure this bar before use'), anchor: 'middle', color: MUTED });

  const hx = bx + 108;
  const hw = tb.x + tb.width - hx - 3;
  fitText(items, hx, midY + 5.2, 2.2, textRuns('Lay a straightedge across two known values;'), hw);
  fitText(items, hx, midY + 8.6, 2.2, textRuns('read the answer where it crosses the third scale.'), hw);
  fitText(items, hx, midY + 12, 2.0, textRuns('No power, no device.'), hw, MUTED);
}

function caption(items, x, y, text) {
  items.push({ t: 'text', x, y, size: 1.9, runs: textRuns(text), anchor: 'start', spacing: 0.5, color: MUTED, role: 'caption' });
}

/** Push a start-anchored text, shrinking the size until it fits `maxW`. */
function fitText(items, x, y, size, runs, maxW, color) {
  let s = size;
  while (runsWidth(runs, s) > maxW && s > size * 0.6) s *= 0.95;
  items.push({ t: 'text', x, y, size: s, runs, anchor: 'start', color, role: 'block' });
}

/**
 * Approximate ink box of a text item: [x0, y0, x1, y1].
 * @returns {number[]}
 */
export function textBox(x, y, size, runs, anchor, spacing = 0) {
  const w = runsWidth(runs, size, spacing);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const hasSup = runs.some((r) => r.sup);
  const top = y - size * (hasSup ? 0.72 + SUP_RISE * 0.6 : 0.72);
  return [x0, top, x0 + w, y + size * 0.21];
}

function labelSide(s, i, isZ, scales) {
  const d = dir(s);
  if (Math.abs(d.x) < 1e-9) {
    // Vertical: outer scales face outwards, the middle scale faces right.
    const xs = scales.map((q) => (q.x1 + q.x2) / 2);
    const minX = Math.min(...xs);
    return Math.abs(s.x1 - minX) < 1e-9 ? { x: -1, y: 0 } : { x: 1, y: 0 };
  }
  // Diagonal: the normal pointing down (into the empty lower-right triangle).
  const n1 = { x: -d.y, y: d.x };
  return n1.y > 0 ? n1 : { x: -n1.x, y: -n1.y };
}

function dir(s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
}

function bboxOfSegment(s) {
  return [Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2)];
}

function pad(b, p) {
  return [b[0] - p, b[1] - p, b[2] + p, b[3] + p];
}

/** Axis-aligned box overlap. Diagonal-scale bounding boxes are skipped by the caller. */
export function overlaps(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
