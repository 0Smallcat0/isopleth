// layout.test.js - Unit tests for layout module

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, splitFormula } from '../src/core/expr.js';
import { compile } from '../src/core/compile.js';
import { layout, layoutParallel, layoutZChart } from '../src/core/layout.js';

describe('layout.js unit tests', () => {
  describe('Parallel layout - sum form', () => {
    it('should layout w = u + v', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');

      assert(!chart.error);
      const result = layoutParallel(chart);

      assert.equal(result.kind, 'parallel');
      assert.equal(result.sheetSize.width, 210);
      assert.equal(result.sheetSize.height, 297);
      assert.equal(result.scales.length, 3);

      // Check that scales have required fields
      for (const scale of result.scales) {
        assert(typeof scale.variable === 'string');
        assert(typeof scale.x1 === 'number');
        assert(typeof scale.y1 === 'number');
        assert(typeof scale.x2 === 'number');
        assert(typeof scale.y2 === 'number');
        assert(typeof scale.valueToPoint === 'function');
        assert(typeof scale.pointToValue === 'function');
        assert(Array.isArray(scale.ticks));
      }
    });

    it('should compute endpoints on left and right scales at x=30 and x=180', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');
      const result = layoutParallel(chart);

      // Scale 0 should be at x=30
      assert.equal(result.scales[0].x1, 30);
      assert.equal(result.scales[0].x2, 30);

      // Scale 1 should be at x=180
      assert.equal(result.scales[1].x1, 180);
      assert.equal(result.scales[1].x2, 180);
    });

    it('should have valueToPoint and pointToValue round-trip', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');
      const result = layoutParallel(chart);

      // Test round-trip on each scale
      for (const scale of result.scales) {
        const testValues = [scale.x1, (scale.x1 + scale.x2) / 2, scale.x2];
        // Actually we should test with value coordinates, not x
        // Let's test with the value at min, mid, max of the range
        const scaleInfo = chart.scales[result.scales.indexOf(scale)];
        const testVals = [
          scaleInfo.range[0],
          (scaleInfo.range[0] + scaleInfo.range[1]) / 2,
          scaleInfo.range[1]
        ];

        for (const val of testVals) {
          const point = scale.valueToPoint(val);
          const recovered = scale.pointToValue(point);
          assert(
            Math.abs(recovered - val) < 1e-6 * Math.max(1, Math.abs(val)),
            `Round-trip failed: ${val} -> {x: ${point.x}, y: ${point.y}} -> ${recovered}`
          );
        }
      }
    });

    it('should position ticks within the scale bounds', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');
      const result = layoutParallel(chart);

      for (const scale of result.scales) {
        for (const tick of scale.ticks) {
          // y should be between scale endpoints
          const minY = Math.min(scale.y1, scale.y2);
          const maxY = Math.max(scale.y1, scale.y2);
          assert(
            tick.y >= minY - 0.01 && tick.y <= maxY + 0.01,
            `Tick y=${tick.y} outside scale [${minY}, ${maxY}]`
          );
        }
      }
    });
  });

  describe('Parallel layout - product form', () => {
    it('should layout V = I * R with log scales', () => {
      const {lhs, rhs} = splitFormula('V = I * R');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {I: [0.1, 10], R: [1, 1000]};
      const chart = compile(ast, lhs, ranges, 'parallel');

      assert(!chart.error);
      const result = layoutParallel(chart);

      assert.equal(result.kind, 'parallel');
      assert.equal(result.scales.length, 3);

      // All scales should have log scaleKind
      for (let i = 0; i < 3; i++) {
        assert.equal(chart.scales[i].scaleKind, 'log');
      }
    });
  });

  describe('Z-chart layout', () => {
    it('should layout sigma = F / A as z-chart', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const chart = compile(ast, lhs, ranges, 'z');

      assert(!chart.error);
      const result = layoutZChart(chart);

      assert.equal(result.kind, 'z');
      assert.equal(result.scales.length, 3);

      // Scale 0 at x=30, scale 1 at x=180, scale 2 on diagonal
      assert.equal(result.scales[0].x1, 30);
      assert.equal(result.scales[0].x2, 30);
      assert.equal(result.scales[1].x1, 180);
      assert.equal(result.scales[1].x2, 180);
    });

    it('should have diagonal scale between corners', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const chart = compile(ast, lhs, ranges, 'z');
      const result = layoutZChart(chart);

      const diag = result.scales[2];
      // Diagonal endpoints should be at the corners or on the diagonal
      const p1Dist = Math.sqrt((diag.x1 - 30) ** 2 + (diag.y1 - 235) ** 2);
      const p2Dist = Math.sqrt((diag.x2 - 30) ** 2 + (diag.y2 - 235) ** 2);
      // Points should be close to the corners (30,235) and (180,23) area
      assert(p1Dist < 100 || p2Dist < 100, 'Diagonal should connect to scale endpoints');
    });
  });

  describe('Bounds checking', () => {
    it('should fit all scales within printable area', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');
      const result = layoutParallel(chart);

      // Printable area: 15-195 in x, 15-240 in y (with 15mm margins)
      for (const scale of result.scales) {
        assert(scale.x1 >= 15 && scale.x1 <= 195, `x1=${scale.x1} outside bounds`);
        assert(scale.x2 >= 15 && scale.x2 <= 195, `x2=${scale.x2} outside bounds`);
        
        const minY = Math.min(scale.y1, scale.y2);
        const maxY = Math.max(scale.y1, scale.y2);
        assert(minY >= 15, `minY=${minY} outside bounds`);
        assert(maxY <= 240, `maxY=${maxY} outside bounds`);

        for (const tick of scale.ticks) {
          assert(tick.x >= 15 && tick.x <= 195, `tick x=${tick.x} outside bounds`);
          assert(tick.y >= 15 && tick.y <= 240, `tick y=${tick.y} outside bounds`);
        }
      }
    });

    it('should fit all scales in z-chart within printable area', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const chart = compile(ast, lhs, ranges, 'z');
      const result = layoutZChart(chart);

      for (const scale of result.scales) {
        assert(scale.x1 >= 15 && scale.x1 <= 195, `x1=${scale.x1} outside bounds`);
        assert(scale.x2 >= 15 && scale.x2 <= 195, `x2=${scale.x2} outside bounds`);
        
        const minY = Math.min(scale.y1, scale.y2);
        const maxY = Math.max(scale.y1, scale.y2);
        assert(minY >= 15, `minY=${minY} outside bounds`);
        assert(maxY <= 240, `maxY=${maxY} outside bounds`);
      }
    });
  });

  describe('layout() dispatcher', () => {
    it('should call layoutParallel for sum form', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const chart = compile(ast, lhs, ranges, 'parallel');
      const result = layout(chart);

      assert.equal(result.kind, 'parallel');
    });

    it('should call layoutZChart for z-chart form', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const chart = compile(ast, lhs, ranges, 'z');
      const result = layout(chart);

      assert.equal(result.kind, 'z');
    });
  });
});
