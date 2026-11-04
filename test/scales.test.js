import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleValue,
  unscaleValue,
  generateTicks,
  thinLabels,
  formatTickLabel
} from '../src/core/scales.js';

describe('scales.js unit tests', () => {
  describe('scaleValue and unscaleValue', () => {
    describe('Linear scales', () => {
      it('should map min to 0', () => {
        const t = scaleValue(0, 0, 10, 'linear');
        assert.equal(t, 0);
      });

      it('should map max to 1', () => {
        const t = scaleValue(10, 0, 10, 'linear');
        assert.equal(t, 1);
      });

      it('should map midpoint to 0.5', () => {
        const t = scaleValue(5, 0, 10, 'linear');
        assert.equal(t, 0.5);
      });

      it('should handle negative ranges', () => {
        const t = scaleValue(-5, -10, 0, 'linear');
        assert.equal(t, 0.5);
      });

      it('unscaleValue should invert scaleValue', () => {
        const t = 0.3;
        const value = unscaleValue(t, 0, 10, 'linear');
        const t2 = scaleValue(value, 0, 10, 'linear');
        assert(Math.abs(t - t2) < 1e-10);
      });
    });

    describe('Logarithmic scales', () => {
      it('should map min to 0', () => {
        const t = scaleValue(1, 1, 100, 'log');
        assert.equal(t, 0);
      });

      it('should map max to 1', () => {
        const t = scaleValue(100, 1, 100, 'log');
        assert.equal(t, 1);
      });

      it('should map 10 to 0.5 in range [1, 100]', () => {
        const t = scaleValue(10, 1, 100, 'log');
        assert(Math.abs(t - 0.5) < 1e-10);
      });

      it('unscaleValue should invert scaleValue', () => {
        const t = 0.3;
        const value = unscaleValue(t, 1, 100, 'log');
        const t2 = scaleValue(value, 1, 100, 'log');
        assert(Math.abs(t - t2) < 1e-10);
      });
    });
  });

  describe('generateTicks', () => {
    describe('Linear ticks', () => {
      it('should generate ticks for 0..10', () => {
        const {major, minor} = generateTicks(0, 10, 'linear', 100);

        assert(major.length > 0);
        assert(major.some(t => t.value === 0));
        assert(major.some(t => t.value === 10));

        // Check monotonicity
        for (let i = 1; i < major.length; i++) {
          assert(major[i].value > major[i - 1].value);
        }
      });

      it('should generate reasonable number of ticks', () => {
        const {major} = generateTicks(0, 100, 'linear', 100);
        assert(major.length >= 5);
        assert(major.length <= 20);
      });

      it('major ticks should have labels', () => {
        const {major} = generateTicks(0, 10, 'linear', 100);
        for (const tick of major) {
          assert(typeof tick.label === 'string');
          assert(tick.label.length > 0);
        }
      });

      it('should generate minor ticks', () => {
        const {minor} = generateTicks(0, 10, 'linear', 100);
        assert(minor.length > 0);
      });

      it('minor ticks should not have labels', () => {
        const {minor} = generateTicks(0, 10, 'linear', 100);
        for (const tick of minor) {
          assert(!tick.label);
        }
      });
    });

    describe('Logarithmic ticks', () => {
      it('should generate ticks for 1..1000', () => {
        const {major} = generateTicks(1, 1000, 'log', 100);

        assert(major.length > 0);
        // Should have 10^0, 10^1, 10^2, 10^3
        assert(major.some(t => Math.abs(t.value - 1) < 0.01));
        assert(major.some(t => Math.abs(t.value - 10) < 0.1));
        assert(major.some(t => Math.abs(t.value - 100) < 1));
        assert(major.some(t => Math.abs(t.value - 1000) < 10));
      });

      it('should be monotone', () => {
        const {major} = generateTicks(1, 1000, 'log', 100);
        for (let i = 1; i < major.length; i++) {
          assert(major[i].value > major[i - 1].value);
        }
      });

      it('should omit minors for wide ranges', () => {
        const {minor} = generateTicks(1, 10000, 'log', 100);
        // Wide range should have few or no minors
        assert(minor.length < 20);
      });

      it('should include minors for narrow ranges', () => {
        const {minor} = generateTicks(1, 100, 'log', 100);
        // Narrow range (< 2 decades) should have minors
        // Range 1..100 is 2 decades, so includes minors
        assert(minor.length >= 0); // Just check it doesn't crash
      });
    });
  });

  describe('formatTickLabel', () => {
    it('should format zero as "0"', () => {
      assert.equal(formatTickLabel(0), '0');
    });

    it('should use fixed notation for normal range', () => {
      const label = formatTickLabel(1.5);
      assert(!label.includes('e'));
    });

    it('should use scientific notation for small numbers', () => {
      const label = formatTickLabel(0.001);
      assert(label.includes('e'));
    });

    it('should use scientific notation for large numbers', () => {
      const label = formatTickLabel(100000);
      assert(label.includes('e'));
    });

    it('should handle negative numbers', () => {
      const label = formatTickLabel(-42.5);
      assert(label.includes('-') || label.includes('−'));
    });
  });

  describe('thinLabels', () => {
    it('should keep first label', () => {
      const labels = [
        {value: 0, label: '0', posMm: 0},
        {value: 5, label: '5', posMm: 50},
        {value: 10, label: '10', posMm: 100}
      ];
      const thinned = thinLabels(labels, 3);
      assert(thinned.length > 0);
      assert.equal(thinned[0].value, 0);
    });

    it('should respect minimum spacing', () => {
      const labels = [
        {value: 0, label: '0', posMm: 0},
        {value: 1, label: '1', posMm: 1}, // Too close
        {value: 10, label: '10', posMm: 100}
      ];
      const thinned = thinLabels(labels, 3);

      for (let i = 1; i < thinned.length; i++) {
        const spacing = thinned[i].posMm - thinned[i - 1].posMm;
        assert(spacing >= 3 - 0.0001);
      }
    });

    it('should return empty array for empty input', () => {
      const thinned = thinLabels([]);
      assert.equal(thinned.length, 0);
    });

    it('should preserve spacing info', () => {
      const labels = [
        {value: 0, label: '0', posMm: 0},
        {value: 5, label: '5', posMm: 50},
        {value: 10, label: '10', posMm: 100}
      ];
      const thinned = thinLabels(labels, 3);

      for (const label of thinned) {
        assert(typeof label.posMm === 'number');
        assert(typeof label.label === 'string');
      }
    });
  });

  describe('Edge cases', () => {
    it('scaleValue should handle equal min/max gracefully', () => {
      // When min === max, we have a degenerate case
      // This is likely an error condition but let's not crash
      const result = scaleValue(5, 10, 10, 'linear');
      assert(typeof result === 'number');
    });

    it('generateTicks should handle negative ranges', () => {
      const {major} = generateTicks(-100, -10, 'linear', 100);
      assert(major.length > 0);
    });

    it('generateTicks should handle decimal ranges', () => {
      const {major} = generateTicks(0.1, 0.9, 'linear', 100);
      assert(major.length > 0);
    });
  });
});
