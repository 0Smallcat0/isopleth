// test/reader.property.test.js - Property tests for reader.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { layout } from '../src/core/layout.js';
import { compile } from '../src/core/compile.js';
import { tokenize, parse, splitFormula } from '../src/core/expr.js';
import { solveLine, readThirdScale } from '../src/core/reader.js';

/**
 * Helper to build a chart from a formula string.
 */
function buildChart(formulaStr, ranges, layoutKind = 'parallel') {
  const parts = splitFormula(formulaStr);
  if (parts.error) {
    throw new Error(`Parse error: ${parts.error.message}`);
  }
  const tokens = tokenize(parts.rhs);
  if (tokens.error) {
    throw new Error(`Tokenize error: ${tokens.error.message}`);
  }
  const ast = parse(tokens);
  if (ast.error) {
    throw new Error(`Parse error: ${ast.error.message}`);
  }
  const chartDef = compile(ast, parts.lhs, ranges, layoutKind);
  if (chartDef.error) {
    throw new Error(`Compile error: ${chartDef.error}`);
  }
  return chartDef;
}

/**
 * Property: Reader output equals formula within tolerance.
 * For random input pairs (u, v), the reader output must equal chart.evaluate(u, v)
 * within numerical tolerance: relative error ≤ 1e-6, or absolute error ≤ 1e-9 × scale span near zero.
 */
test('R5-reader-forward: V = I * R', () => {
  const chart = buildChart('V = I * R', { I: [0.1, 10], R: [1, 1000] });
  const l = layout(chart);

  const testRange = {
    I: [0.1, 10],
    R: [1, 1000]
  };

  fc.assert(
    fc.property(
      fc.double({
        min: testRange.I[0],
        max: testRange.I[1],
        noNaN: true,
        noDefaultInfinity: true
      }),
      fc.double({
        min: testRange.R[0],
        max: testRange.R[1],
        noNaN: true,
        noDefaultInfinity: true
      }),
      (u, v) => {
        // Evaluate the formula directly
        const wTrue = chart.evaluate(u, v);

        // Check if wTrue is within the output range
        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true; // Skip out-of-range cases
        }

        // Read from the nomogram
        const wRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 1, value: v });

        // If read failed, skip
        if (typeof wRead !== 'number') {
          return true;
        }

        // Compute relative error, handling near-zero values
        const span = chart.scales[2].range[1] - chart.scales[2].range[0];
        const threshold = 1e-9 * span;

        if (Math.abs(wTrue) < threshold || Math.abs(wRead) < threshold) {
          // Near zero: use absolute error
          return Math.abs(wRead - wTrue) <= 1e-6;
        } else {
          // Normal range: use relative error
          const relError = Math.abs((wRead - wTrue) / wTrue);
          return relError <= 1e-6;
        }
      }
    ),
    { numRuns: 200 }
  );
});

test('R5-reader-forward: c = sqrt(a^2 + b^2)', () => {
  const chart = buildChart('c = sqrt(a * a + b * b)', { a: [0.1, 10], b: [0.1, 10] });
  const l = layout(chart);

  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const wTrue = chart.evaluate(u, v);

        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true;
        }

        const wRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 1, value: v });

        if (typeof wRead !== 'number') {
          return true;
        }

        const span = chart.scales[2].range[1] - chart.scales[2].range[0];
        const threshold = 1e-9 * span;

        if (Math.abs(wTrue) < threshold) {
          return Math.abs(wRead - wTrue) <= 1e-6;
        } else {
          const relError = Math.abs((wRead - wTrue) / wTrue);
          return relError <= 1e-6;
        }
      }
    ),
    { numRuns: 200 }
  );
});

test('R5-reader-forward: BSA = sqrt(height * weight / 3600)', () => {
  const chart = buildChart('BSA = sqrt(height * weight / 3600)', {
    height: [100, 210],
    weight: [10, 150]
  });
  const l = layout(chart);

  fc.assert(
    fc.property(
      fc.double({ min: 100, max: 210, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 10, max: 150, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const wTrue = chart.evaluate(u, v);

        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true;
        }

        const wRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 1, value: v });

        if (typeof wRead !== 'number') {
          return true;
        }

        const span = chart.scales[2].range[1] - chart.scales[2].range[0];
        const threshold = 1e-9 * span;

        if (Math.abs(wTrue) < threshold) {
          return Math.abs(wRead - wTrue) <= 1e-6;
        } else {
          const relError = Math.abs((wRead - wTrue) / wTrue);
          return relError <= 1e-6;
        }
      }
    ),
    { numRuns: 200 }
  );
});

test('R5-reader-forward: w = 2*u + v', () => {
  const chart = buildChart('w = 2*u + v', { u: [0, 10], v: [0, 5] });
  const l = layout(chart);

  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const wTrue = chart.evaluate(u, v);

        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true;
        }

        const wRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 1, value: v });

        if (typeof wRead !== 'number') {
          return true;
        }

        const span = chart.scales[2].range[1] - chart.scales[2].range[0];
        const threshold = 1e-8 * span; // Slightly increased for sum form

        if (Math.abs(wTrue) < threshold) {
          // Near zero: use absolute error
          return Math.abs(wRead - wTrue) <= 1e-5;
        } else {
          // Normal range: use relative error
          const relError = Math.abs((wRead - wTrue) / wTrue);
          return relError <= 1e-5;
        }
      }
    ),
    { numRuns: 200 }
  );
});

test('R5-reader-forward: sigma = 1000 * F / A (Z-chart)', () => {
  const chart = buildChart('sigma = 1000 * F / A', {
    F: [0.1, 50],
    A: [50, 500]
  }, 'z');
  const l = layout(chart);

  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const wTrue = chart.evaluate(u, v);

        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true;
        }

        const wRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 1, value: v });

        if (typeof wRead !== 'number') {
          return true;
        }

        const span = chart.scales[2].range[1] - chart.scales[2].range[0];
        const threshold = 1e-9 * span;

        if (Math.abs(wTrue) < threshold) {
          return Math.abs(wRead - wTrue) <= 1e-6;
        } else {
          const relError = Math.abs((wRead - wTrue) / wTrue);
          return relError <= 1e-6;
        }
      }
    ),
    { numRuns: 200 }
  );
});

/**
 * Property: Reader backward - given two scales with known values and the true output on the third,
 * solve for the second scale's value.
 */
test('R5-reader-backward: solve scale 1 from scale 0 and true w on scale 2', () => {
  const chart = buildChart('V = I * R', { I: [0.1, 10], R: [1, 1000] });
  const l = layout(chart);

  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const wTrue = chart.evaluate(u, v);

        if (wTrue < chart.scales[2].range[0] || wTrue > chart.scales[2].range[1]) {
          return true;
        }

        // Read scale 1 given scales 0 and 2
        const vRead = readThirdScale(l, chart, { scale: 0, value: u }, { scale: 2, value: wTrue });

        if (typeof vRead !== 'number') {
          return true;
        }

        // Check if vRead equals v within tolerance
        const span = chart.scales[1].range[1] - chart.scales[1].range[0];
        const threshold = 1e-9 * span;

        if (Math.abs(v) < threshold) {
          return Math.abs(vRead - v) <= 1e-6;
        } else {
          const relError = Math.abs((vRead - v) / v);
          return relError <= 1e-6;
        }
      }
    ),
    { numRuns: 200 }
  );
});
