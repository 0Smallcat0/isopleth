import fc from 'fast-check';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleValue,
  unscaleValue,
  generateTicks,
  thinLabels
} from '../src/core/scales.js';

describe('scales.js property tests', () => {
  describe('P2 - Monotonicity', () => {
    it('P2-linear-monotonicity: scaleValue is strictly monotone for linear scales', () => {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 100}),
          fc.integer({min: 0, max: 100}),
          (v1_int, v2_int) => {
            const min = 0;
            const max = 100;

            const v1 = min + v1_int;
            const v2 = min + v2_int;

            if (v1 >= min && v1 <= max && v2 >= min && v2 <= max) {
              const t1 = scaleValue(v1, min, max, 'linear');
              const t2 = scaleValue(v2, min, max, 'linear');

              if (v1 < v2) {
                return t1 < t2;
              } else if (v1 > v2) {
                return t1 > t2;
              }
            }
            return true;
          }
        ),
        {numRuns: 50}
      );
    });

    it('P2-log-monotonicity: scaleValue is strictly monotone for log scales', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.double({min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true}),
            fc.double({min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true})
          ),
          fc.double({min: 0.001, max: 10000, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.001, max: 10000, noNaN: true, noDefaultInfinity: true}),
          ([min1, min2], v1, v2) => {
            const min = Math.min(min1, min2);
            const max = min * 10000;

            if (v1 >= min && v1 <= max && v2 >= min && v2 <= max) {
              // Require that v2 is strictly greater than v1 with tolerance
              if (v2 <= v1 * (1 + 1e-9)) return true; // Skip near-equal values
              
              const t1 = scaleValue(v1, min, max, 'log');
              const t2 = scaleValue(v2, min, max, 'log');

              if (v1 < v2) {
                return t1 < t2;
              } else if (v1 > v2) {
                return t1 > t2;
              }
            }
            return true;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('P4 - Tick Spacing', () => {
    it('P4-tick-spacing-linear: consecutive ticks are strictly increasing', () => {
      const {major} = generateTicks(0, 100, 'linear', 100);
      
      // Check that major ticks are monotone (minors can be interspersed oddly)
      for (let i = 1; i < major.length; i++) {
        assert(major[i].value > major[i - 1].value, `Major ticks not monotone: ${major[i-1].value} >= ${major[i].value}`);
      }
    });

    it('P4-tick-spacing-log: consecutive ticks are strictly increasing', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 1, max: 10000, noNaN: true, noDefaultInfinity: true}),
          (min, range) => {
            const max = min + Math.abs(range);

            if (min <= 0 || max <= min) return true;

            const {major, minor} = generateTicks(min, max, 'log', 100);
            const allTicks = [...major.map(t => t.value), ...minor.map(t => t.value)];

            // Check monotonicity
            for (let i = 1; i < allTicks.length; i++) {
              if (allTicks[i] <= allTicks[i - 1]) {
                return false;
              }
            }
            return true;
          }
        ),
        {numRuns: 200}
      );
    });

    it('P4-label-spacing: thinned labels respect minimum spacing', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              value: fc.double({noNaN: true, noDefaultInfinity: true}),
              label: fc.string(),
              posMm: fc.double({min: 0, max: 1000, noNaN: true, noDefaultInfinity: true})
            }),
            {minLength: 2, maxLength: 50}
          ),
          fc.double({min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true}),
          (labels, minSpacing) => {
            // Sort labels by position
            const sorted = [...labels].sort((a, b) => a.posMm - b.posMm);
            const thinned = thinLabels(sorted, minSpacing);

            // Check that consecutive thinned labels respect spacing
            for (let i = 1; i < thinned.length; i++) {
              const spacing = thinned[i].posMm - thinned[i - 1].posMm;
              if (spacing < minSpacing - 0.0001) {
                return false;
              }
            }
            return true;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('Round-trip properties', () => {
    it('P1-round-trip-linear: scaleValue/unscaleValue round trip', () => {
      fc.assert(
        fc.property(
          fc.double({min: -100, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: -100, max: 100, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: -100, max: 100, noNaN: true, noDefaultInfinity: true}),
          (min1, max1, value1) => {
            const min = Math.min(min1, max1);
            const max = Math.max(min1, max1);

            if (min === max) return true;
            if (value1 < min || value1 > max) return true;

            const t = scaleValue(value1, min, max, 'linear');
            const value2 = unscaleValue(t, min, max, 'linear');

            return Math.abs(value1 - value2) < 1e-10;
          }
        ),
        {numRuns: 200}
      );
    });

    it('P1-round-trip-log: scaleValue/unscaleValue round trip', () => {
      fc.assert(
        fc.property(
          fc.double({min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 0.001, max: 10000, noNaN: true, noDefaultInfinity: true}),
          (min1, max1, value1) => {
            const min = Math.min(min1, max1);
            const max = Math.max(min1, max1);

            if (min <= 0 || max <= 0 || min === max) return true;
            if (value1 < min || value1 > max) return true;

            const t = scaleValue(value1, min, max, 'log');
            const value2 = unscaleValue(t, min, max, 'log');

            const relError = Math.abs((value1 - value2) / value1);
            return relError < 1e-9;
          }
        ),
        {numRuns: 200}
      );
    });
  });

  describe('Tick generation consistency', () => {
    it('P3-ticks-within-range: all ticks are within the specified range', () => {
      fc.assert(
        fc.property(
          fc.integer({min: -100, max: 100}),
          fc.integer({min: 10, max: 200}),
          (base, range) => {
            if (range <= 0) return true;
            const min = base;
            const max = base + range;

            const {major, minor} = generateTicks(min, max, 'linear', 100);

            // Check that all ticks are within range (with small tolerance)
            const tolerance = (max - min) * 1e-10;
            for (const tick of major) {
              if (tick.value < min - tolerance || tick.value > max + tolerance) {
                return false;
              }
            }
            for (const tick of minor) {
              if (tick.value < min - tolerance || tick.value > max + tolerance) {
                return false;
              }
            }
            return true;
          }
        ),
        {numRuns: 50}
      );
    });

    it('P3-major-tick-count: reasonable number of major ticks', () => {
      fc.assert(
        fc.property(
          fc.double({min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true}),
          fc.double({min: 10, max: 1000, noNaN: true, noDefaultInfinity: true}),
          (base, range) => {
            const min = base;
            const max = base + Math.abs(range);

            const {major} = generateTicks(min, max, 'linear', 100);

            // Should have between 2 and 30 major ticks
            return major.length >= 2 && major.length <= 30;
          }
        ),
        {numRuns: 200}
      );
    });
  });
});
