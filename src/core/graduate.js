// graduate.js - Drafting graduations for a laid-out scale.
//
// scales.js picks ticks from the value range alone, which leaves a log scale with
// only its decades (an Ohm's-law chart gets three ticks on I). This module works on
// the laid-out geometry instead: it subdivides each interval as finely as the
// printed spacing allows, so quadratic, logarithmic and Z-chart diagonal scales all
// get dense graduations where there is room and sparse ones where there is not.

const MIN_GAP_MM = 1.1; // smallest printed distance between two adjacent ticks
const MAX_LEVEL = 3; // 0 = long tick, 3 = shortest
const LOG_MIN_RATIO = 30;

/**
 * @typedef {object} Graduation
 * @property {number} value
 * @property {number} x
 * @property {number} y
 * @property {number} level - 0 (longest, labelled first) to 3
 */

/**
 * Graduate one laid-out scale.
 * @param {{valueToPoint: (v: number) => {x: number, y: number}}} layoutScale
 * @param {{range: [number, number], scaleKind: 'linear' | 'log'}} chartScale
 * @returns {Graduation[]} sorted by value, all inside the range
 */
export function graduate(layoutScale, chartScale) {
  const [lo, hi] = chartScale.range;
  if (!(hi > lo)) return [];
  const pos = (v) => layoutScale.valueToPoint(v);
  const gap = (a, b) => {
    const p = pos(a);
    const q = pos(b);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };

  /** @type {Map<string, Graduation>} */
  const out = new Map();
  const emit = (value, level) => {
    const v = clean(value);
    if (v < lo - 1e-12 * Math.abs(hi - lo) || v > hi + 1e-12 * Math.abs(hi - lo)) return;
    const key = v.toPrecision(12);
    const prev = out.get(key);
    if (prev && prev.level <= level) return;
    const p = pos(v);
    out.set(key, { value: v, x: p.x, y: p.y, level });
  };

  // Recursively split [a, b] (whose nice step is `step`) while the print allows.
  const subdivide = (a, b, step, level) => {
    if (level >= MAX_LEVEL) return;
    for (const n of divisors(step)) {
      const sub = step / n;
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        const s = a + i * sub;
        const e = a + (i + 1) * sub;
        if (e <= lo || s >= hi) continue; // outside the drawn range, no constraint
        if (gap(s, e) < MIN_GAP_MM) ok = false;
      }
      if (!ok) continue;
      for (let i = 1; i < n; i++) {
        const lvl = n === 10 && i !== 5 ? level + 2 : level + 1;
        emit(a + i * sub, Math.min(lvl, MAX_LEVEL));
      }
      const childLevel = n === 10 ? level + 2 : level + 1;
      for (let i = 0; i < n; i++) {
        const s = a + i * sub;
        const e = a + (i + 1) * sub;
        if (e <= lo || s >= hi) continue;
        subdivide(s, e, sub, childLevel);
      }
      return;
    }
  };

  // Log scales spanning less than LOG_MIN_RATIO are graduated by value steps (on
  // their log positions): a 100-210 cm scale wants 100, 120, 140..., not decades.
  if (chartScale.scaleKind === 'log' && lo > 0 && hi / lo >= LOG_MIN_RATIO) {
    const k0 = Math.floor(Math.log10(lo) + 1e-12);
    const k1 = Math.ceil(Math.log10(hi) - 1e-12);
    for (let k = k0; k <= k1; k++) emit(10 ** k, 0);
    for (let k = k0; k < k1; k++) {
      const d = 10 ** k;
      // Mantissa marks inside the decade: all of 1..10 if they fit, else 1-2-5.
      const full = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sparse = [1, 2, 5, 10];
      const fits = (marks) => marks.every((m, i) => {
        if (i === 0) return true;
        const s = marks[i - 1] * d;
        const e = m * d;
        if (e <= lo || s >= hi) return true;
        return gap(s, e) >= MIN_GAP_MM * 1.2;
      });
      const marks = fits(full) ? full : fits(sparse) ? sparse : null;
      if (!marks) continue;
      for (let i = 1; i < marks.length - 1; i++) {
        const m = marks[i];
        emit(m * d, m === 5 || marks === sparse ? 1 : 2);
      }
      if (marks === full) {
        for (let m = 1; m < 10; m++) subdivide(m * d, (m + 1) * d, d, 2);
      } else {
        subdivide(d, 2 * d, d, 1);
        subdivide(2 * d, 5 * d, 3 * d, MAX_LEVEL); // no nice split of 3, keep as is
        subdivide(5 * d, 10 * d, 5 * d, 1);
      }
    }
  } else {
    // Linear values (the position may still be non-linear, e.g. a^2 or a Z diagonal).
    const step = niceStep((hi - lo) / 5);
    const start = Math.floor(lo / step + 1e-9) * step;
    let last = null;
    for (let a = start; a < hi + step * 1e-9; a += step) {
      const v = clean(a);
      // Long ticks closer than the minimum gap (a compressed end) are skipped.
      if (v >= lo - 1e-9 * step && (last === null || gap(last, v) >= MIN_GAP_MM)) {
        emit(v, 0);
        last = v;
      }
      subdivide(v, clean(a + step), step, 0);
    }
  }

  return [...out.values()].sort((p, q) => p.value - q.value);
}

/**
 * Candidate split counts for a nice step, finest first.
 * @param {number} step
 * @returns {number[]}
 */
function divisors(step) {
  const m = mantissa(step);
  if (Math.abs(m - 1) < 1e-6) return [10, 5, 2];
  if (Math.abs(m - 2) < 1e-6) return [10, 2];
  if (Math.abs(m - 5) < 1e-6) return [10, 5];
  return [];
}

function mantissa(x) {
  const e = Math.floor(Math.log10(Math.abs(x)) + 1e-9);
  return Math.abs(x) / 10 ** e;
}

/**
 * Nearest 1-2-5 step to a rough step.
 * @param {number} rough
 * @returns {number}
 */
export function niceStep(rough) {
  const e = Math.floor(Math.log10(rough));
  const m = rough / 10 ** e;
  const nm = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nm * 10 ** e;
}

/** Remove binary noise (0.30000000000000004 -> 0.3). */
function clean(v) {
  if (v === 0) return 0;
  return Number(v.toPrecision(12));
}
