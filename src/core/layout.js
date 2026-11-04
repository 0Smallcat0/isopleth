// layout.js - Geometry calculations in millimetres for nomogram layout

import { generateTicks, thinLabels, scaleValue, unscaleValue } from './scales.js';

/**
 * @typedef {object} LayoutResult
 * @property {'parallel' | 'z'} kind
 * @property {{width: number, height: number}} sheetSize
 * @property {{variable: string, x1: number, y1: number, x2: number, y2: number, valueToPoint: (value: number) => {x: number, y: number}, pointToValue: (point: {x: number, y: number}) => number, ticks: {value: number, x: number, y: number, label: string, isMajor: boolean}[]}[]} scales
 */

// Sheet dimensions in mm
const SHEET_WIDTH = 210;
const SHEET_HEIGHT = 297;
const USABLE_HEIGHT = 212; // H = 212 mm
const BASELINE = 235; // yb = 235
const TOP_Y = BASELINE - USABLE_HEIGHT; // yt = 23

const LEFT_X = 30;
const RIGHT_X = 180;
const DISTANCE = RIGHT_X - LEFT_X; // D = 150 mm

/**
 * Main layout function: picks Z-chart for form 'z-chart', parallel otherwise.
 * @param {object} chart - Chart definition from compile()
 * @returns {LayoutResult}
 */
export function layout(chart) {
  if (chart.form === 'z-chart') {
    return layoutZChart(chart);
  }
  return layoutParallel(chart);
}

/**
 * Layout parallel scales: three vertical scales at x=LEFT_X, x=MID, x=RIGHT_X.
 * @param {object} chart - Chart definition
 * @returns {LayoutResult}
 */
export function layoutParallel(chart) {
  const scales = chart.scales;

  // m1 = H / (s0.max - s0.min), m2 = H / (s1.max - s1.min)
  const m1 = USABLE_HEIGHT / (scales[0].max - scales[0].min);
  const m2 = USABLE_HEIGHT / (scales[1].max - scales[1].min);

  // x_m = 30 + 150 * m1 / (m1 + m2)
  const x_m = LEFT_X + DISTANCE * m1 / (m1 + m2);

  // m3 = m1 * m2 / (m1 + m2)
  const m3 = (m1 * m2) / (m1 + m2);

  // Build layout scales with valueToPoint and pointToValue
  const layoutScales = [];

  // Scale 0 at x = LEFT_X
  layoutScales.push(
    buildParallelScale(
      scales[0],
      LEFT_X,
      m1,
      BASELINE,
      scales[0].min,
      scales[0]
    )
  );

  // Scale 1 at x = RIGHT_X
  layoutScales.push(
    buildParallelScale(
      scales[1],
      RIGHT_X,
      m2,
      BASELINE,
      scales[1].min,
      scales[1]
    )
  );

  // Scale 2 at x = x_m (middle scale)
  // For output scale: y2 = yb - m3 * (fn2(w) - (min0_fn + min1_fn))
  // But fn2(w) = w - c for sum form, so we adjust the offset
  const scale2 = buildParallelScale(
    scales[2],
    x_m,
    m3,
    BASELINE,
    scales[0].min + scales[1].min,
    scales[2]
  );
  layoutScales.push(scale2);

  return {
    kind: 'parallel',
    sheetSize: { width: SHEET_WIDTH, height: SHEET_HEIGHT },
    scales: layoutScales
  };
}

/**
 * Build a parallel scale layout.
 * @private
 */
function buildParallelScale(scaleInfo, x, modulus, baseline, offsetBase, refScale) {
  // y = baseline - modulus * (fn(value) - offsetBase)
  const valueToPoint = (value) => {
    const fnVal = scaleInfo.fn(value);
    const y = baseline - modulus * (fnVal - offsetBase);
    return { x, y };
  };

  // Invert: fn(value) = (baseline - y) / modulus + offsetBase
  // For linear scales: inverse of fn is trivial (identity)
  // For log scales: fn(x) = k*log10(x), so x = 10^(fn(x)/k)
  const pointToValue = (point) => {
    const fnVal = (baseline - point.y) / modulus + offsetBase;
    
    // fn is not always the identity (e.g. a^2 on a hypotenuse chart), so invert it
    // numerically on the value range for every scale kind.
    return invertLogScale(fnVal, scaleInfo, modulus, offsetBase);
  };

  // Compute scale endpoints
  const p1 = valueToPoint(scaleInfo.range[0]);
  const p2 = valueToPoint(scaleInfo.range[1]);

  // Generate ticks
  const ticksData = generateTicks(
    scaleInfo.range[0],
    scaleInfo.range[1],
    scaleInfo.scaleKind,
    USABLE_HEIGHT
  );

  const allTicks = [...ticksData.major, ...ticksData.minor];
  
  // Position ticks using valueToPoint
  const positionedTicks = allTicks.map((tick) => {
    const point = valueToPoint(tick.value);
    return {
      value: tick.value,
      x: point.x,
      y: point.y,
      label: tick.label || '',
      isMajor: ticksData.major.some(m => Math.abs(m.value - tick.value) < 1e-9)
    };
  });

  // Thin labels to ensure ≥3 mm spacing
  const labeledTicks = positionedTicks.filter(t => t.isMajor);
  const thinnedTicks = thinLabels(
    labeledTicks.map(t => ({ ...t, posMm: Math.abs(t.y - baseline) })),
    3
  );
  const thinnedSet = new Set(thinnedTicks.map(t => t.value));

  // Reconstruct ticks with thin labels
  const finalTicks = positionedTicks.map(tick => ({
    ...tick,
    label: thinnedSet.has(tick.value) ? tick.label : ''
  }));

  return {
    variable: scaleInfo.variable,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    valueToPoint,
    pointToValue,
    ticks: finalTicks
  };
}

/**
 * Invert log scale using bisection.
 * @private
 */
function invertLogScale(targetFn, scaleInfo, modulus, offsetBase) {
  // fn(x) = k * log10(x) for log scales
  // scaleInfo.fn is k * log10(x) where k is the exponent from compile.js
  // We need to find x such that scaleInfo.fn(x) = targetFn
  
  const min = scaleInfo.range[0];
  const max = scaleInfo.range[1];
  
  // Bisection
  let lo = min;
  let hi = max;
  const tol = 1e-12;
  // Direction from the function itself: negative exponents give decreasing scales.
  const increasing = scaleInfo.fn(max) >= scaleInfo.fn(min);

  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const midFn = scaleInfo.fn(mid);

    if (Math.abs(midFn - targetFn) < tol) {
      return mid;
    }

    if ((midFn < targetFn) === increasing) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  
  return (lo + hi) / 2;
}

/**
 * Layout Z-chart: two vertical scales with a diagonal.
 * @param {object} chart - Chart definition
 * @returns {LayoutResult}
 */
export function layoutZChart(chart) {
  const scales = chart.scales;

  // m1 = H / s0.max, m2 = H / s1.max
  const m1 = USABLE_HEIGHT / scales[0].max;
  const m2 = USABLE_HEIGHT / scales[1].max;

  const layoutScales = [];

  // Scale 0 at x = LEFT_X, going up from baseline
  const scale0 = buildZChartScale(
    scales[0],
    LEFT_X,
    m1,
    BASELINE,
    'left'
  );
  layoutScales.push(scale0);

  // Scale 1 at x = RIGHT_X, going down from top
  const scale1 = buildZChartScale(
    scales[1],
    RIGHT_X,
    m2,
    TOP_Y,
    'right'
  );
  layoutScales.push(scale1);

  // Scale 2 on the diagonal from (LEFT_X, BASELINE) to (RIGHT_X, TOP_Y)
  const scale2 = buildDiagonalScale(
    scales[2],
    m1,
    m2,
    LEFT_X,
    BASELINE,
    RIGHT_X,
    TOP_Y,
    DISTANCE,
    USABLE_HEIGHT
  );
  layoutScales.push(scale2);

  return {
    kind: 'z',
    sheetSize: { width: SHEET_WIDTH, height: SHEET_HEIGHT },
    scales: layoutScales
  };
}

/**
 * Build a Z-chart vertical scale (left or right).
 * @private
 */
function buildZChartScale(scaleInfo, x, modulus, baseline, side) {
  const isRight = side === 'right';

  const valueToPoint = (value) => {
    const fnVal = scaleInfo.fn(value);
    const y = isRight ? (TOP_Y + modulus * fnVal) : (baseline - modulus * fnVal);
    return { x, y };
  };

  const pointToValue = (point) => {
    const fnVal = isRight
      ? (point.y - TOP_Y) / modulus
      : (baseline - point.y) / modulus;
    
    // Invert based on scaleKind
    if (scaleInfo.scaleKind === 'linear') {
      return fnVal;
    } else {
      return invertLogScale(fnVal, scaleInfo, modulus, 0);
    }
  };

  const p1 = valueToPoint(scaleInfo.range[0]);
  const p2 = valueToPoint(scaleInfo.range[1]);

  const ticksData = generateTicks(
    scaleInfo.range[0],
    scaleInfo.range[1],
    scaleInfo.scaleKind,
    USABLE_HEIGHT
  );

  const allTicks = [...ticksData.major, ...ticksData.minor];
  const positionedTicks = allTicks.map((tick) => {
    const point = valueToPoint(tick.value);
    return {
      value: tick.value,
      x: point.x,
      y: point.y,
      label: tick.label || '',
      isMajor: ticksData.major.some(m => Math.abs(m.value - tick.value) < 1e-9)
    };
  });

  const labeledTicks = positionedTicks.filter(t => t.isMajor);
  const thinnedTicks = thinLabels(
    labeledTicks.map(t => ({
      ...t,
      posMm: Math.abs(isRight ? (t.y - TOP_Y) : (t.y - BASELINE))
    })),
    3
  );
  const thinnedSet = new Set(thinnedTicks.map(t => t.value));

  const finalTicks = positionedTicks.map(tick => ({
    ...tick,
    label: thinnedSet.has(tick.value) ? tick.label : ''
  }));

  return {
    variable: scaleInfo.variable,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    valueToPoint,
    pointToValue,
    ticks: finalTicks
  };
}

/**
 * Build the diagonal scale for Z-chart.
 * @private
 */
function buildDiagonalScale(scaleInfo, m1, m2, x1, y1, x2, y2, L, H) {
  const valueToPoint = (value) => {
    const f = scaleInfo.fn(value);
    const t = (m1 * f) / (m1 * f + m2);
    const x = x1 + t * L;
    const y = y1 - t * H;
    return { x, y };
  };

  const pointToValue = (point) => {
    // Solve for t: x = x1 + t*L, y = y1 - t*H
    // t = (x - x1) / L or (y1 - y) / H
    const t = (point.x - x1) / L;
    
    // Invert: f = m2*t / (m1*(1-t))
    const f = (m2 * t) / (m1 * (1 - t));
    
    // Invert scale function to get value
    if (scaleInfo.scaleKind === 'linear') {
      return f;
    } else {
      return invertLogScale(f, scaleInfo, m2, 0);
    }
  };

  const p1 = valueToPoint(scaleInfo.range[0]);
  const p2 = valueToPoint(scaleInfo.range[1]);

  const ticksData = generateTicks(
    scaleInfo.range[0],
    scaleInfo.range[1],
    scaleInfo.scaleKind,
    Math.sqrt(L * L + H * H) // Length along diagonal
  );

  const allTicks = [...ticksData.major, ...ticksData.minor];
  const positionedTicks = allTicks.map((tick) => {
    const point = valueToPoint(tick.value);
    return {
      value: tick.value,
      x: point.x,
      y: point.y,
      label: tick.label || '',
      isMajor: ticksData.major.some(m => Math.abs(m.value - tick.value) < 1e-9)
    };
  });

  const labeledTicks = positionedTicks.filter(t => t.isMajor);
  const thinnedTicks = thinLabels(
    labeledTicks.map(t => ({
      ...t,
      posMm: Math.sqrt((t.x - x1) ** 2 + (t.y - y1) ** 2)
    })),
    3
  );
  const thinnedSet = new Set(thinnedTicks.map(t => t.value));

  const finalTicks = positionedTicks.map(tick => ({
    ...tick,
    label: thinnedSet.has(tick.value) ? tick.label : ''
  }));

  return {
    variable: scaleInfo.variable,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    valueToPoint,
    pointToValue,
    ticks: finalTicks
  };
}
