// certificate.js - Accuracy certificate (engine tasks T27-T28)
//
// The certificate answers one question for the printed sheet: if the straightedge is
// laid within ±delta mm of each input mark, how far can the reading on the answer
// scale be from the formula? It is measured on the chart's own geometry, not estimated.

import { formatNumber, displayName } from './text.js';

export const GRID_STEPS = 41;
export const SAFETY = 1.1;

/**
 * @typedef {object} Certificate
 * @property {number} deltaMm - straightedge placement tolerance
 * @property {'relative' | 'absolute'} errorType - relative (%) for log answer scales
 * @property {number} maxError - worst error found, times SAFETY; % or answer units
 * @property {number} rawMaxError - worst error found, before SAFETY
 * @property {number} p95Error - 95th percentile over grid points (worst placement each), times SAFETY
 * @property {{u: number, v: number, w: number} | null} worstAt - where it happened
 * @property {number} gridSize - grid points with an in-range answer
 * @property {number} perturbations - straightedge placements evaluated
 * @property {string} variable - the answer variable
 */

/**
 * Sample positions across a scale range: geometric for log scales, linear otherwise.
 * @param {{range: [number, number], scaleKind: string}} s
 * @param {number} n
 * @returns {number[]}
 */
export function sampleRange(s, n = GRID_STEPS) {
  const [lo, hi] = s.range;
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    out.push(s.scaleKind === 'log' && lo > 0 ? lo * (hi / lo) ** f : lo + f * (hi - lo));
  }
  return out;
}

/**
 * Where the line through p and q crosses a scale segment.
 * @returns {{x: number, y: number} | null} null when parallel or off the segment
 */
export function crossScale(p, q, scale) {
  const d1x = q.x - p.x;
  const d1y = q.y - p.y;
  const d2x = scale.x2 - scale.x1;
  const d2y = scale.y2 - scale.y1;
  const det = d1x * d2y - d1y * d2x;
  if (Math.abs(det) < 1e-12) return null;
  const ox = scale.x1 - p.x;
  const oy = scale.y1 - p.y;
  const t = (d1y * ox - d1x * oy) / det;
  if (t < -1e-9 || t > 1 + 1e-9) return null;
  const tc = Math.min(1, Math.max(0, t));
  return { x: scale.x1 + tc * d2x, y: scale.y1 + tc * d2y };
}

function unit(scale) {
  const dx = scale.x2 - scale.x1;
  const dy = scale.y2 - scale.y1;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
}

/**
 * Generate the certificate for a chart on its layout.
 * Grid: GRID_STEPS x GRID_STEPS input pairs; at each pair whose answer is on the chart,
 * both input marks are moved ±deltaMm along their scales (4 placements) and the
 * reading on the answer scale is compared with the formula.
 * @param {object} layout - from layout()
 * @param {object} chart - from compile()
 * @param {number} [deltaMm=0.5]
 * @returns {Certificate}
 */
export function generateCertificate(layout, chart, deltaMm = 0.5) {
  const [s0, s1, s2] = layout.scales;
  const out = chart.scales[2];
  const [wlo, whi] = out.range;
  // Relative error (%) for log answer scales, absolute (answer units) for linear ones.
  const relative = out.scaleKind === 'log' && wlo > 0;
  const e0 = unit(s0);
  const e1 = unit(s1);
  let worst = 0;
  let worstAt = null;
  let gridSize = 0;
  let perturbations = 0;
  const pointErrors = [];
  const us = sampleRange(chart.scales[0]);
  const vs = sampleRange(chart.scales[1]);
  const span = whi - wlo;
  for (const u of us) {
    for (const v of vs) {
      const w = chart.evaluate(u, v);
      if (!Number.isFinite(w) || w < wlo - 1e-9 * span || w > whi + 1e-9 * span) continue;
      gridSize++;
      const p = s0.valueToPoint(u);
      const q = s1.valueToPoint(v);
      let here = 0;
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          const pp = { x: p.x + a * deltaMm * e0.x, y: p.y + a * deltaMm * e0.y };
          const qq = { x: q.x + b * deltaMm * e1.x, y: q.y + b * deltaMm * e1.y };
          const hit = crossScale(pp, qq, s2);
          if (!hit) continue;
          const wr = s2.pointToValue(hit);
          perturbations++;
          const err = relative ? (Math.abs(wr - w) / Math.abs(w)) * 100 : Math.abs(wr - w);
          if (err > here) here = err;
          if (err > worst) {
            worst = err;
            worstAt = { u, v, w };
          }
        }
      }
      pointErrors.push(here);
    }
  }
  pointErrors.sort((a, b) => a - b);
  const p95 = pointErrors.length ? pointErrors[Math.min(pointErrors.length - 1, Math.ceil(0.95 * pointErrors.length) - 1)] : 0;
  return {
    deltaMm,
    errorType: relative ? 'relative' : 'absolute',
    maxError: worst * SAFETY,
    rawMaxError: worst,
    p95Error: p95 * SAFETY,
    worstAt,
    gridSize,
    perturbations,
    variable: out.variable ?? out.name
  };
}

/**
 * One-sentence statement for the panel and the title block.
 * @param {Certificate} c
 * @param {string} [unitText=''] - unit of the answer, for absolute errors
 * @returns {string}
 */
export function formatCertificate(c, unitText = '') {
  const name = displayName(c.variable);
  const fmt = (x) => (c.errorType === 'relative'
    ? `${formatNumber(x, 2)} %`
    : `${formatNumber(x, 2)}${unitText ? ' ' + unitText : ''}`);
  const head = `With the straightedge within ±${formatNumber(c.deltaMm, 2)} mm of each mark, ${name} reads within ±${fmt(c.maxError)} of the formula`;
  // When the worst case sits in a cramped corner, say how the rest of the sheet does.
  if (c.p95Error > 0 && c.maxError > 2 * c.p95Error) return `${head} (±${fmt(c.p95Error)} on 95 % of the sheet).`;
  return `${head}.`;
}

/**
 * The method line that goes with the sentence.
 * @param {Certificate} c
 * @returns {string}
 */
export function formatCertificateMethod(c) {
  return `Measured on ${c.gridSize.toLocaleString('en-US')} grid points, ${c.perturbations.toLocaleString('en-US')} straightedge placements, ×${SAFETY} margin.`;
}
