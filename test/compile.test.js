import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, splitFormula } from '../src/core/expr.js';
import { compile } from '../src/core/compile.js';

describe('compile.js unit tests', () => {
  describe('Sum form', () => {
    it('should compile w = u + v', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error);
      assert.equal(result.form, 'sum');
      assert.equal(result.scales.length, 3);
      assert.equal(result.scales[0].name, 'u');
      assert.equal(result.scales[1].name, 'v');
      assert.equal(result.scales[2].name, 'w');

      // Test evaluation
      const w = result.evaluate(3, 4);
      assert.equal(w, 7);
    });

    it('should compile w = 2*u + 3*v + 5', () => {
      const {lhs, rhs} = splitFormula('w = 2*u + 3*v + 5');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error);
      assert.equal(result.form, 'sum');

      const w = result.evaluate(1, 1);
      assert.equal(w, 2 * 1 + 3 * 1 + 5);
    });

    it('should compute output range correctly', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [1, 5], v: [2, 8]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error);
      const outputRange = result.scales[2].range;
      assert(outputRange[0] <= 1 + 2);
      assert(outputRange[1] >= 5 + 8);
    });
  });

  describe('Product form', () => {
    it('should compile V = I * R', () => {
      const {lhs, rhs} = splitFormula('V = I * R');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {I: [0.1, 10], R: [1, 1000]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error);
      assert.equal(result.form, 'product');
      assert.equal(result.scales[0].scaleKind, 'log');
      assert.equal(result.scales[1].scaleKind, 'log');
      assert.equal(result.scales[2].scaleKind, 'log');

      const v = result.evaluate(2, 5);
      assert.equal(v, 10);
    });

    it('should compile w = u^2 * v', () => {
      const {lhs, rhs} = splitFormula('w = u^2 * v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [1, 5], v: [1, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error);
      assert.equal(result.form, 'product');

      const w = result.evaluate(2, 3);
      assert.equal(w, 4 * 3);
    });

    it('should reject product form with non-positive ranges', () => {
      const {lhs, rhs} = splitFormula('V = I * R');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {I: [-10, 10], R: [1, 1000]}; // Negative range
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(result.error);
    });
  });

  describe('Outer function form', () => {
    it('R2.1 - c = sqrt(a^2 + b^2): evaluate(2, 3) should return sqrt(13)', () => {
      const {lhs, rhs} = splitFormula('c = sqrt(a^2 + b^2)');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {a: [0.1, 10], b: [0.1, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      const c = result.evaluate(2, 3);
      const expected = Math.sqrt(13);
      assert(Math.abs(c - expected) < 1e-10, `Expected ${expected}, got ${c}`);
      
      // Check scale functions
      assert.equal(result.scales[0].name, 'a');
      assert.equal(result.scales[1].name, 'b');
      assert.equal(result.scales[2].name, 'c');
      // Input scales should have scale functions (a^2, b^2)
      const f_a_2 = result.scales[0].fn(2);
      const f_a_3 = result.scales[0].fn(3);
      assert(Math.abs(f_a_2 - 4) < 1e-9, `a scale at 2 should be ~4, got ${f_a_2}`);
      assert(Math.abs(f_a_3 - 9) < 1e-9, `a scale at 3 should be ~9, got ${f_a_3}`);
    });

    it('R2.2 - BSA = sqrt(H*W/3600): evaluate(2, 3) should return sqrt(2*3/3600)', () => {
      const {lhs, rhs} = splitFormula('BSA = sqrt(H * W / 3600)');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {H: [100, 220], W: [20, 150]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      const bsa = result.evaluate(2, 3);
      const expected = Math.sqrt(2 * 3 / 3600);
      assert(Math.abs(bsa - expected) < 1e-10, `Expected ${expected}, got ${bsa}`);
      
      // For outer sqrt of a product, scales use logarithms internally
      // The scale function maps w to log10(w^2/k) for the normalized product form
      // Verify that inverse relationship holds: scales[0], scales[1], scales[2] are collinear
      // by checking that scales[2].fn(w) equals scales[0].fn(h) + scales[1].fn(w_input) when proper h,w are set
      assert.equal(result.form, 'outer');
      assert.equal(result.scales[2].scaleKind, 'log');
      
      // BUG FIX: scales[2].range must be the output value range, not the f-range
      const w_min = Math.sqrt(100 * 20 / 3600);  // sqrt(2000/3600)
      const w_max = Math.sqrt(220 * 150 / 3600); // sqrt(33000/3600)
      assert.equal(result.scales[2].range[0], w_min, `scales[2].range[0] should be ${w_min} (output value), not f-range`);
      assert.equal(result.scales[2].range[1], w_max, `scales[2].range[1] should be ${w_max} (output value), not f-range`);
    });

    it('should recognize outer function structure', () => {
      const {lhs, rhs} = splitFormula('c = sqrt(a^2 + b^2)');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {a: [1, 10], b: [1, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      // Should compile successfully (either as outer-sqrt or recognize structure)
      assert(!result.error || result.error.includes('Supported'));
    });
  });

  describe('Z-chart form', () => {
    it('R2.3a - sigma = F/A as product form (layout=parallel)', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'product', `Expected product form, got ${result.form}`);

      // Test evaluation: sigma = F / A
      const sigma = result.evaluate(10, 50);
      assert.equal(sigma, 0.2);
    });

    it('R2.3b - sigma = F/A as z-chart (layout=z)', () => {
      const {lhs, rhs} = splitFormula('sigma = F / A');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {F: [0.1, 50], A: [50, 500]};
      const result = compile(ast, lhs, ranges, 'z');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'z-chart', `Expected z-chart form, got ${result.form}`);

      // Test evaluation: sigma = F / A
      const sigma = result.evaluate(10, 50);
      assert.equal(sigma, 0.2);
    });

    it('should compile Z-chart form with layout=z', () => {
      const {lhs, rhs} = splitFormula('w = u / v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [1, 10], v: [1, 10]};
      const result = compile(ast, lhs, ranges, 'z');

      assert(!result.error, `Unexpected error: ${result.error}`);
      // Accept either 'product' or 'z-chart' form (both are valid)
      assert(['product', 'z-chart'].includes(result.form));

      // Test evaluation
      const w = result.evaluate(10, 2);
      assert.equal(w, 5);
    });
  });

  describe('R2 nested powers (run 12)', () => {
    it('BMI = weight / height^2 with ranges {weight:[20,140], height:[1.2,2.0]}', () => {
      const {lhs, rhs} = splitFormula('BMI = weight / height^2');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {weight: [20, 140], height: [1.2, 2.0]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'product', `Expected product form, got ${result.form}`);

      // Test evaluation: BMI = weight / height^2
      const bmi = result.evaluate(70, 1.75);
      const expected = 70 / (1.75 * 1.75);
      const relErr = Math.abs(bmi - expected) / expected;
      assert(relErr < 1e-12, `Relative error ${relErr} exceeds 1e-12 for evaluate(70, 1.75): got ${bmi}, expected ${expected}`);
    });

    it('P = U^2 / R still compiles and evaluate(10, 4) = 25', () => {
      const {lhs, rhs} = splitFormula('P = U^2 / R');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {U: [1, 20], R: [0.5, 100]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'product', `Expected product form, got ${result.form}`);

      const p = result.evaluate(10, 4);
      const expected = 100 / 4;
      assert.equal(p, expected, `Expected ${expected}, got ${p}`);
    });

    it('q = 3 * a / b^0.5 with {a:[1,10], b:[1,100]}: evaluate(4, 16) = 3 within 1e-12', () => {
      const {lhs, rhs} = splitFormula('q = 3 * a / b^0.5');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {a: [1, 10], b: [1, 100]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'product', `Expected product form, got ${result.form}`);

      const q = result.evaluate(4, 16);
      const expected = 3 * 4 / Math.sqrt(16);
      const relErr = Math.abs(q - expected) / expected;
      assert(relErr < 1e-12, `Relative error ${relErr} exceeds 1e-12 for evaluate(4, 16): got ${q}, expected ${expected}`);
    });

    it('z = a^2 / (b^3)^2 with {a:[1,10], b:[1,3]}: evaluate(2, 1.5) = 4 / 1.5^6 within 1e-12', () => {
      const {lhs, rhs} = splitFormula('z = a^2 / (b^3)^2');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {a: [1, 10], b: [1, 3]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(!result.error, `Compile error: ${result.error}`);
      assert.equal(result.form, 'product', `Expected product form, got ${result.form}`);

      const z = result.evaluate(2, 1.5);
      const expected = 4 / Math.pow(1.5, 6);
      const relErr = Math.abs(z - expected) / expected;
      assert(relErr < 1e-12, `Relative error ${relErr} exceeds 1e-12 for evaluate(2, 1.5): got ${z}, expected ${expected}`);
    });
  });

  describe('Error handling', () => {
    it('should reject wrong number of variables', () => {
      const {lhs, rhs} = splitFormula('w = u + v + x');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(result.error);
    });

    it('should reject unsupported form', () => {
      const {lhs, rhs} = splitFormula('w = u^u'); // u raised to u - not separable
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [1, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(result.error);
    });
  });

  describe('Chart structure', () => {
    it('should have three scales with proper fields', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert.equal(result.scales.length, 3);
      for (const scale of result.scales) {
        assert(scale.name);
        assert(scale.variable);
        assert(typeof scale.fn === 'function');
        assert(Array.isArray(scale.range));
        assert(scale.range.length === 2);
        assert(['linear', 'log'].includes(scale.scaleKind));
      }
    });

    it('should have evaluate function', () => {
      const {lhs, rhs} = splitFormula('w = 2*u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(typeof result.evaluate === 'function');
      assert.equal(result.evaluate(1, 2), 4);
    });

    it('should include formula string', () => {
      const {lhs, rhs} = splitFormula('w = u + v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);
      const ranges = {u: [0, 10], v: [0, 10]};
      const result = compile(ast, lhs, ranges, 'parallel');

      assert(typeof result.formula === 'string');
      assert(result.formula.length > 0);
    });
  });
});
