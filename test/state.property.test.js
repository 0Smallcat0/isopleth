// test/state.property.test.js - Property-based tests for state helpers

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  encodeStateToHash,
  decodeStateFromHash,
  nextSolved,
  fileName
} from '../src/ui/state.js';

// Custom arbitrary for valid states
function arbitraryState() {
  return fc.record({
    formula: fc.string({ maxLength: 200 }),
    ranges: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.tuple(
        fc.double({ min: -1000, max: 1000, noNaN: true, noInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noInfinity: true })
      ).filter(([min, max]) => {
        // Ensure min < max and not -0
        if (Object.is(min, -0)) return false;
        if (Object.is(max, -0)) return false;
        return min < max;
      })
    ),
    units: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ maxLength: 50 })
    ),
    layout: fc.oneof(fc.constant('parallel'), fc.constant('z')),
    deltaMm: fc.double({ min: 0.1, max: 5, noNaN: true, noInfinity: true }),
    exampleId: fc.oneof(
      fc.constant(null),
      fc.stringMatching(/^[a-z0-9-]{1,30}$/)
    )
  });
}

test('P1 - hash round-trip: encode and decode produces equivalent state', () => {
  fc.assert(
    fc.property(arbitraryState(), (state) => {
      const hash = encodeStateToHash(state);
      const decoded = decodeStateFromHash(hash);
      
      assert.ok(decoded !== null, 'decoded should not be null');
      assert.deepEqual(decoded.formula, state.formula, 'formula should match');
      assert.deepEqual(decoded.ranges, state.ranges, 'ranges should match');
      assert.deepEqual(decoded.units, state.units, 'units should match');
      assert.equal(decoded.layout, state.layout, 'layout should match');
      assert.equal(decoded.deltaMm, state.deltaMm, 'deltaMm should match');
      assert.equal(decoded.exampleId, state.exampleId, 'exampleId should match');
    }),
    { numRuns: 200 }
  );
});

test('P1 - hash round-trip with leading #: decode accepts leading hash', () => {
  fc.assert(
    fc.property(arbitraryState(), (state) => {
      const hash = encodeStateToHash(state);
      const hashWithLeadingHash = '#' + hash;
      const decoded = decodeStateFromHash(hashWithLeadingHash);
      
      assert.ok(decoded !== null, 'decoded should not be null with leading #');
      assert.deepEqual(decoded, decodeStateFromHash(hash), 'should be same with or without #');
    }),
    { numRuns: 200 }
  );
});

test('P1 - hash-rejects: decode returns null for arbitrary invalid inputs', () => {
  fc.assert(
    fc.property(fc.string(), (invalidHash) => {
      const result = decodeStateFromHash(invalidHash);
      // Should not throw; may return null
      assert.ok(result === null || typeof result === 'object', 'should return null or valid object');
    }),
    { numRuns: 100 }
  );
});

test('P1 - hash-rejects: decode returns null for min >= max', () => {
  fc.assert(
    fc.property(
      fc.double({ noNaN: true, noInfinity: true }),
      (value) => {
        const hash = encodeURIComponent(JSON.stringify({
          f: 'test',
          r: { x: [value, value] }
        }));
        const result = decodeStateFromHash(hash);
        assert.equal(result, null, 'should reject equal min/max');
      }
    ),
    { numRuns: 100 }
  );
});

test('P1 - hash-rejects: decode returns null for deltaMm outside [0.1, 5]', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.double({ max: 0.09, noNaN: true, noInfinity: true }),
        fc.double({ min: 5.01, noNaN: true, noInfinity: true })
      ),
      (invalidDelta) => {
        const hash = encodeURIComponent(JSON.stringify({
          f: 'test',
          r: { x: [0, 1] },
          d: invalidDelta
        }));
        const result = decodeStateFromHash(hash);
        assert.equal(result, null, 'should reject deltaMm outside [0.1, 5]');
      }
    ),
    { numRuns: 100 }
  );
});

test('nextSolved: result order is a permutation of [0, 1, 2]', () => {
  fc.assert(
    fc.property(
      fc.constant([0, 1, 2]),
      fc.integer({ min: 0, max: 2 }),
      (order, moved) => {
        const { order: newOrder } = nextSolved(order, moved);
        const sorted = [...newOrder].sort();
        assert.deepEqual(sorted, [0, 1, 2], 'result should be a permutation');
      }
    ),
    { numRuns: 50 }
  );
});

test('nextSolved: moved index comes first', () => {
  fc.assert(
    fc.property(
      fc.constant([0, 1, 2]),
      fc.integer({ min: 0, max: 2 }),
      (order, moved) => {
        const { order: newOrder } = nextSolved(order, moved);
        assert.equal(newOrder[0], moved, 'moved should be first');
      }
    ),
    { numRuns: 50 }
  );
});

test('nextSolved: solved !== moved', () => {
  fc.assert(
    fc.property(
      fc.constant([0, 1, 2]),
      fc.integer({ min: 0, max: 2 }),
      (order, moved) => {
        const { solved } = nextSolved(order, moved);
        assert.notEqual(solved, moved, 'solved should not equal moved');
      }
    ),
    { numRuns: 50 }
  );
});

test('nextSolved: input array unchanged', () => {
  fc.assert(
    fc.property(
      fc.constant([0, 1, 2]),
      fc.integer({ min: 0, max: 2 }),
      (order, moved) => {
        const original = [...order];
        nextSolved(order, moved);
        assert.deepEqual(order, original, 'input order should not be mutated');
      }
    ),
    { numRuns: 50 }
  );
});

test('fileName: output matches pattern for various formulas', () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 200 }),
      fc.oneof(fc.constant(null), fc.stringMatching(/^[a-z0-9-]{1,30}$/)),
      (formula, exampleId) => {
        const state = { formula, exampleId };
        const result = fileName(state, 'svg');
        
        // Should match /^isopleth-[a-z0-9-]{1,40}\.(svg|pdf)$/
        const pattern = /^isopleth-[a-z0-9-]{1,40}\.(svg|pdf)$/;
        assert.match(result, pattern, `fileName should match pattern: ${result}`);
      }
    ),
    { numRuns: 200 }
  );
});

test('fileName: uses exampleId if provided', () => {
  const state = { formula: 'some formula', exampleId: 'ohms-law' };
  const result = fileName(state, 'svg');
  assert.equal(result, 'isopleth-ohms-law.svg', 'should use exampleId in filename');
});

test('fileName: falls back to formula slug', () => {
  const state = { formula: 'V = I * R', exampleId: null };
  const result = fileName(state, 'svg');
  assert.ok(result.startsWith('isopleth-'), 'should have prefix');
  assert.ok(result.endsWith('.svg'), 'should have extension');
  assert.match(result, /^isopleth-[a-z0-9-]+\.svg$/, 'should be valid');
});

test('fileName: defaults to "chart" for empty formula', () => {
  const state = { formula: '!!!', exampleId: null };
  const result = fileName(state, 'pdf');
  assert.equal(result, 'isopleth-chart.pdf', 'should default to "chart" for empty slug');
});
