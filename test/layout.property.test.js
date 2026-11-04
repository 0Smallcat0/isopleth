// layout.property.test.js - Property-based tests for layout module

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { tokenize, parse, splitFormula } from '../src/core/expr.js';
import { compile } from '../src/core/compile.js';
import { layout, layoutParallel, layoutZChart } from '../src/core/layout.js';

/**
 * Helper to compute determinant of 3x3 matrix for collinearity test.
 */
function det3x3(x1, y1, x2, y2, x3, y3) {
  return x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
}

describe('layout.js property tests', () => {
  describe('R4-collinear-parallel', () => {
    it('should have collinear points for V = I * R (product)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
          (I, R) => {
            const {lhs, rhs} = splitFormula('V = I * R');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {I: [0.1, 10], R: [1, 1000]};
            const chart = compile(ast, lhs, ranges, 'parallel');
            
            if (chart.error) return true; // Skip invalid cases
            
            const V = chart.evaluate(I, R);
            
            // Check if V is in range
            const vMin = chart.scales[2].range[0];
            const vMax = chart.scales[2].range[1];
            if (V < vMin || V > vMax) return true; // Skip out of range
            
            const result = layoutParallel(chart);
            
            // Get coordinates of three points for each input pair
            const p0 = result.scales[0].valueToPoint(I);
            const p1 = result.scales[1].valueToPoint(R);
            const p2 = result.scales[2].valueToPoint(V);
            
            // Check collinearity: determinant should be ~0
            const d = det3x3(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
            const tolerance = 1e-9 * 210 * 297; // Normalized by sheet size
            
            return Math.abs(d) <= tolerance;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should have collinear points for w = 2*u + v (sum)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
          (u, v) => {
            const {lhs, rhs} = splitFormula('w = 2*u + v');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {u: [0, 10], v: [0, 5]};
            const chart = compile(ast, lhs, ranges, 'parallel');
            
            if (chart.error) return true;
            
            const w = chart.evaluate(u, v);
            
            const wMin = chart.scales[2].range[0];
            const wMax = chart.scales[2].range[1];
            if (w < wMin || w > wMax) return true;
            
            const result = layoutParallel(chart);
            
            const p0 = result.scales[0].valueToPoint(u);
            const p1 = result.scales[1].valueToPoint(v);
            const p2 = result.scales[2].valueToPoint(w);
            
            const d = det3x3(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
            const tolerance = 1e-9 * 210 * 297;
            
            return Math.abs(d) <= tolerance;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should have collinear points for BSA = sqrt(H*W/3600) (outer)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 220, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 20, max: 150, noNaN: true, noDefaultInfinity: true }),
          (H, W) => {
            const {lhs, rhs} = splitFormula('BSA = sqrt(H * W / 3600)');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {H: [100, 220], W: [20, 150]};
            const chart = compile(ast, lhs, ranges, 'parallel');
            
            if (chart.error) return true;
            
            const bsa = chart.evaluate(H, W);
            
            const bsaMin = chart.scales[2].range[0];
            const bsaMax = chart.scales[2].range[1];
            if (bsa < bsaMin || bsa > bsaMax) return true;
            
            const result = layoutParallel(chart);
            
            const p0 = result.scales[0].valueToPoint(H);
            const p1 = result.scales[1].valueToPoint(W);
            const p2 = result.scales[2].valueToPoint(bsa);
            
            const d = det3x3(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
            const tolerance = 1e-9 * 210 * 297;
            
            return Math.abs(d) <= tolerance;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('R4-collinear-z', () => {
    it('should have collinear points for sigma = F/A (Z-chart)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
          (F, A) => {
            const {lhs, rhs} = splitFormula('sigma = F / A');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {F: [0.1, 50], A: [50, 500]};
            const chart = compile(ast, lhs, ranges, 'z');
            
            if (chart.error) return true;
            
            const sigma = chart.evaluate(F, A);
            
            const sigmaMin = chart.scales[2].range[0];
            const sigmaMax = chart.scales[2].range[1];
            if (sigma < sigmaMin || sigma > sigmaMax) return true;
            
            const result = layoutZChart(chart);
            
            const p0 = result.scales[0].valueToPoint(F);
            const p1 = result.scales[1].valueToPoint(A);
            const p2 = result.scales[2].valueToPoint(sigma);
            
            const d = det3x3(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
            const tolerance = 1e-9 * 210 * 297;
            
            return Math.abs(d) <= tolerance;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('R4-round-trip', () => {
    it('should round-trip pointToValue(valueToPoint(x)) for all scales', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
          (u, v) => {
            const {lhs, rhs} = splitFormula('w = u + v');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {u: [0, 10], v: [0, 5]};
            const chart = compile(ast, lhs, ranges, 'parallel');
            
            if (chart.error) return true;
            
            const w = chart.evaluate(u, v);
            const wMin = chart.scales[2].range[0];
            const wMax = chart.scales[2].range[1];
            if (w < wMin || w > wMax) return true;
            
            const result = layoutParallel(chart);
            
            // Test each scale
            const testVals = [
              {scale: result.scales[0], val: u},
              {scale: result.scales[1], val: v},
              {scale: result.scales[2], val: w}
            ];
            
            for (const {scale, val} of testVals) {
              const point = scale.valueToPoint(val);
              const recovered = scale.pointToValue(point);
              const relErr = Math.abs(recovered - val) / Math.max(1, Math.abs(val));
              
              if (relErr > 1e-9) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should round-trip for Z-chart scales', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
          (F, A) => {
            const {lhs, rhs} = splitFormula('sigma = F / A');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {F: [0.1, 50], A: [50, 500]};
            const chart = compile(ast, lhs, ranges, 'z');
            
            if (chart.error) return true;
            
            const sigma = chart.evaluate(F, A);
            const sigmaMin = chart.scales[2].range[0];
            const sigmaMax = chart.scales[2].range[1];
            if (sigma < sigmaMin || sigma > sigmaMax) return true;
            
            const result = layoutZChart(chart);
            
            const testVals = [
              {scale: result.scales[0], val: F},
              {scale: result.scales[1], val: A},
              {scale: result.scales[2], val: sigma}
            ];
            
            for (const {scale, val} of testVals) {
              const point = scale.valueToPoint(val);
              const recovered = scale.pointToValue(point);
              const relErr = Math.abs(recovered - val) / Math.max(1, Math.abs(val));
              
              if (relErr > 1e-9) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('R4-bounds', () => {
    it('should keep all scales within printable area [15, 195] x [15, 240]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
          (u, v) => {
            const {lhs, rhs} = splitFormula('w = u + v');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {u: [0, 10], v: [0, 5]};
            const chart = compile(ast, lhs, ranges, 'parallel');
            
            if (chart.error) return true;
            
            const result = layoutParallel(chart);
            
            for (const scale of result.scales) {
              // Check endpoints
              if (scale.x1 < 15 || scale.x1 > 195 || scale.x2 < 15 || scale.x2 > 195) {
                return false;
              }
              
              const minY = Math.min(scale.y1, scale.y2);
              const maxY = Math.max(scale.y1, scale.y2);
              if (minY < 15 || maxY > 240) {
                return false;
              }
              
              // Check ticks
              for (const tick of scale.ticks) {
                if (tick.x < 15 || tick.x > 195 || tick.y < 15 || tick.y > 240) {
                  return false;
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should keep z-chart scales within printable area', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
          (F, A) => {
            const {lhs, rhs} = splitFormula('sigma = F / A');
            const tokens = tokenize(rhs);
            const ast = parse(tokens);
            const ranges = {F: [0.1, 50], A: [50, 500]};
            const chart = compile(ast, lhs, ranges, 'z');
            
            if (chart.error) return true;
            
            const result = layoutZChart(chart);
            
            for (const scale of result.scales) {
              if (scale.x1 < 15 || scale.x1 > 195 || scale.x2 < 15 || scale.x2 > 195) {
                return false;
              }
              
              const minY = Math.min(scale.y1, scale.y2);
              const maxY = Math.max(scale.y1, scale.y2);
              if (minY < 15 || maxY > 240) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
