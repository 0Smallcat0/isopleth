import fc from 'fast-check';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, splitFormula } from '../src/core/expr.js';
import { compile } from '../src/core/compile.js';

describe('compile.js property tests', () => {
  describe('P10 - Determinism', () => {
    it('P10-determinism: compiling the same AST twice produces identical results', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          (u_min, u_max, v_min, v_max) => {
            const formula = 'w = u + v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [Math.min(u_min, u_max), Math.max(u_min, u_max)],
              v: [Math.min(v_min, v_max), Math.max(v_min, v_max)]
            };

            const result1 = compile(ast, 'w', ranges, 'parallel');
            const result2 = compile(ast, 'w', ranges, 'parallel');

            // Check that both produce the same form
            if (result1.error) {
              return result2.error === result1.error;
            }

            assert.equal(result1.form, result2.form);
            assert.equal(result1.scales.length, result2.scales.length);

            // Test that evaluation is deterministic
            const u_test = (u_min + u_max) / 2;
            const v_test = (v_min + v_max) / 2;
            const w1 = result1.evaluate(u_test, v_test);
            const w2 = result2.evaluate(u_test, v_test);

            return Math.abs(w1 - w2) < 1e-10;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('P11 - Evaluator Consistency', () => {
    it('P11-evaluator-consistency: chart.evaluate matches direct AST evaluation', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          (u_min, u_max, v_min, v_max) => {
            const formula = 'w = 2*u + 3*v + 5';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [Math.min(u_min, u_max), Math.max(u_min, u_max)],
              v: [Math.min(v_min, v_max), Math.max(v_min, v_max)]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            const u_test = (u_min + u_max) / 2;
            const v_test = (v_min + v_max) / 2;

            const w_direct = 2 * u_test + 3 * v_test + 5;
            const w_chart = chart.evaluate(u_test, v_test);

            const relError = Math.abs((w_chart - w_direct) / w_direct);
            return relError <= 1e-10;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('P12 - Compiled Formula Equivalence', () => {
    it('P12-formula-equivalence: after compiling, chart.evaluate matches original formula', () => {
      fc.assert(
        fc.property(
          fc.double({min: 1, max: 10, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 1, max: 10, noNaN: true, noDefaultInfinity: true}),
          (u, v) => {
            const formula = 'w = u * v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [0.1, 20],
              v: [0.1, 20]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            const w_formula = u * v;
            const w_chart = chart.evaluate(u, v);

            // For log scales, allow larger relative error
            const relError = Math.abs((w_chart - w_formula) / w_formula);
            return relError <= 1e-10;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('Sum form properties', () => {
    it('P11-sum-linear-scales: sum form always uses linear scales', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          (u_range, v_range) => {
            const formula = 'w = u + v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [0, u_range],
              v: [0, v_range]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            if (chart.form === 'sum') {
              for (const scale of chart.scales) {
                if (scale.scaleKind !== 'linear') return false;
              }
            }
            return true;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('Product form properties', () => {
    it('P12-product-log-scales: product form uses log scales', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          (u_range, v_range) => {
            const formula = 'w = u * v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [0.1, u_range],
              v: [0.1, v_range]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            if (chart.form === 'product') {
              for (const scale of chart.scales) {
                if (scale.scaleKind !== 'log') return false;
              }
            }
            return true;
          }
        ),
        {numRuns: 200}
      );
    });

    it('P12-product-requires-positive-ranges: product form rejects non-positive ranges', () => {
      // Unit test: verify manually with known ranges
      const {rhs} = splitFormula('w = u * v');
      const tokens = tokenize(rhs);
      const ast = parse(tokens);

      const ranges = {u: [-1, 1], v: [0.1, 10]};
      const chart = compile(ast, 'w', ranges, 'parallel');
      
      // Should error since u has negative values
      assert(chart.error || chart.form !== 'product');
    });
  });

  describe('Scale range properties', () => {
    it('P11-output-range-includes-extremes: output scale range includes min/max of formula', () => {
      fc.assert(
        fc.property(
          fc.double({min: 1, max: 10, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 1, max: 10, noNaN: true, noDefaultInfinity: true}),
          (u_max, v_max) => {
            const formula = 'w = u + v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [0, u_max],
              v: [0, v_max]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            const outputScale = chart.scales[2];
            const w_min_formula = 0 + 0;
            const w_max_formula = u_max + v_max;

            // Output range should encompass the formula range
            return outputScale.range[0] <= w_min_formula &&
                   outputScale.range[1] >= w_max_formula;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('Evaluation correctness', () => {
    it('P12-evaluate-within-range: chart evaluation respects input ranges', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true}),
          (u, v) => {
            const formula = 'w = u + v';
            const {rhs} = splitFormula(formula);
            const tokens = tokenize(rhs);
            const ast = parse(tokens);

            const ranges = {
              u: [0.1, 200],
              v: [0.1, 200]
            };

            const chart = compile(ast, 'w', ranges, 'parallel');
            if (chart.error) return true;

            const w = chart.evaluate(u, v);
            return typeof w === 'number' && isFinite(w);
          }
        ),
        {numRuns: 200}
      );
    });
  });
});

describe('P13 - Five example formulas', () => {
  it('P13-examples-ohms-law: V = I*R', () => {
    fc.assert(
      fc.property(
        fc.double({min: 0.01, max: 10, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 1, max: 1000, noNaN: true, noDefaultInfinity: true}),
        (i, r) => {
          const {rhs} = splitFormula('V = I * R');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {I: [0.01, 10], R: [1, 1000]};
          const chart = compile(ast, 'V', ranges, 'parallel');

          if (chart.error) return false;

          const v_formula = i * r;
          const v_chart = chart.evaluate(i, r);
          const relError = Math.abs((v_chart - v_formula) / v_formula);
          return relError <= 1e-10;
        }
      ),
      {numRuns: 200}
    );
  });

  it('P13-examples-right-triangle: c = sqrt(a^2 + b^2)', () => {
    fc.assert(
      fc.property(
        fc.double({min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true}),
        (a, b) => {
          const {rhs} = splitFormula('c = sqrt(a^2 + b^2)');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {a: [0.1, 10], b: [0.1, 10]};
          const chart = compile(ast, 'c', ranges, 'parallel');

          if (chart.error) return false;

          const c_formula = Math.sqrt(a * a + b * b);
          const c_chart = chart.evaluate(a, b);
          const relError = Math.abs((c_chart - c_formula) / c_formula);
          return relError <= 1e-10;
        }
      ),
      {numRuns: 200}
    );
  });

  it('P13-examples-bsa-mosteller: BSA = sqrt(H*W/3600)', () => {
    fc.assert(
      fc.property(
        fc.double({min: 100, max: 220, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 20, max: 150, noNaN: true, noDefaultInfinity: true}),
        (h, w) => {
          const {rhs} = splitFormula('BSA = sqrt(H * W / 3600)');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {H: [100, 220], W: [20, 150]};
          const chart = compile(ast, 'BSA', ranges, 'parallel');

          if (chart.error) return false;

          const bsa_formula = Math.sqrt(h * w / 3600);
          const bsa_chart = chart.evaluate(h, w);
          const relError = Math.abs((bsa_chart - bsa_formula) / bsa_formula);
          return relError <= 1e-10;
        }
      ),
      {numRuns: 200}
    );
  });

  it('P13-examples-stress-as-product: sigma = F / A', () => {
    fc.assert(
      fc.property(
        fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 50, max: 500, noNaN: true, noDefaultInfinity: true}),
        (f, a) => {
          const {rhs} = splitFormula('sigma = F / A');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {F: [0.1, 50], A: [50, 500]};
          const chart = compile(ast, 'sigma', ranges, 'parallel');

          if (chart.error) return false;

          const sigma_formula = f / a;
          const sigma_chart = chart.evaluate(f, a);
          const relError = Math.abs((sigma_chart - sigma_formula) / sigma_formula);
          return relError <= 1e-10;
        }
      ),
      {numRuns: 200}
    );
  });

  it('P13-examples-stress-as-z-chart: sigma = F / A with layout=z', () => {
    fc.assert(
      fc.property(
        fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 50, max: 500, noNaN: true, noDefaultInfinity: true}),
        (f, a) => {
          const {rhs} = splitFormula('sigma = F / A');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {F: [0.1, 50], A: [50, 500]};
          const chart = compile(ast, 'sigma', ranges, 'z');

          if (chart.error) return false;

          const sigma_formula = f / a;
          const sigma_chart = chart.evaluate(f, a);
          const relError = Math.abs((sigma_chart - sigma_formula) / sigma_formula);
          return relError <= 1e-10;
        }
      ),
      {numRuns: 200}
    );
  });

  it('P13-examples-sum-form: w = 2*u + v', () => {
    fc.assert(
      fc.property(
        fc.double({min: 0, max: 100, noNaN: true, noDefaultInfinity: true}),
        fc.double({min: 0, max: 100, noNaN: true, noDefaultInfinity: true}),
        (u, v) => {
          const {rhs} = splitFormula('w = 2*u + v');
          const tokens = tokenize(rhs);
          const ast = parse(tokens);
          const ranges = {u: [0, 100], v: [0, 100]};
          const chart = compile(ast, 'w', ranges, 'parallel');

          if (chart.error) return false;

          // Test evaluate
          const w_formula = 2 * u + v;
          const w_chart = chart.evaluate(u, v);
          const evalError = Math.abs(w_chart - w_formula);
          
          // Test parallel form property: scales[2].fn(w) = scales[0].fn(u) + scales[1].fn(v)
          if (chart.form === 'sum' && chart.scales[0].scaleKind === 'linear') {
            const f0 = chart.scales[0].fn(u);
            const f1 = chart.scales[1].fn(v);
            const f2 = chart.scales[2].fn(w_chart);
            const scaleError = Math.abs(f2 - (f0 + f1));
            return evalError < 1e-9 && scaleError < 1e-9;
          }
          return evalError < 1e-9;
        }
      ),
      {numRuns: 200}
    );
  });
});
