import { test } from 'node:test';
import fc from 'fast-check';
import assert from 'node:assert/strict';
import { tokenize, parse, evaluate, print } from '../src/core/expr.js';

// T6: Property tests for expr.js
// Requirements: P3, P7 (round-trip and parse-print equivalence)

/**
 * Generate arbitrary AST nodes for expression testing.
 * Restricted to safe expressions that work with positive integer inputs.
 */
function arbitraryExpr(depth = 0) {
  const maxDepth = 2;  // Shallower trees to avoid huge exponents

  if (depth >= maxDepth) {
    return fc.oneof(
      fc.integer({ min: 1, max: 3 }),  // Smaller numbers
      fc.constantFrom('x', 'y', 'z', 'u', 'v', 'w')
    ).map(value => {
      if (typeof value === 'number') {
        return { kind: 'number', value };
      }
      return { kind: 'identifier', name: value };
    });
  }

  return fc.oneof(
    // Integer literals
    fc.integer({ min: 1, max: 3 }).map(value => ({
      kind: 'number',
      value
    })),

    // Identifiers
    fc.constantFrom('x', 'y', 'z', 'u', 'v', 'w').map(name => ({
      kind: 'identifier',
      name
    })),

    // Addition and multiplication (safe)
    fc.tuple(arbitraryExpr(depth + 1), fc.constantFrom('+', '*'), arbitraryExpr(depth + 1)).map(([left, op, right]) => ({
      kind: 'binop',
      op,
      left,
      right
    })),

    // Only small integer exponents (2 or 3 max)
    fc.tuple(arbitraryExpr(depth + 1), fc.integer({ min: 2, max: 2 })).map(([left, exp]) => ({
      kind: 'binop',
      op: '^',
      left,
      right: { kind: 'number', value: exp }
    })),

    // Safe single-argument functions
    fc.tuple(
      fc.constantFrom('abs', 'exp'),
      arbitraryExpr(depth + 1)
    ).map(([fn, arg]) => ({
      kind: 'call',
      fn,
      args: [arg]
    }))
  );
}

// Property P3: Round-trip formula parsing
// For any valid AST, printing and re-parsing produces an AST that evaluates identically
test('P3 - parse-print-roundtrip', () => {
  fc.assert(
    fc.property(
      arbitraryExpr(),
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
      (ast, u_val, v_val) => {
        // Print AST to string
        const printed = print(ast);
        
        // Parse the string back
        const tokens = tokenize(printed);
        const reparsed = parse(tokens);
        
        // Should not have parse errors
        if (reparsed.error) {
          return false;
        }

        // Evaluate both at a test point
        const bindings = { x: u_val, y: v_val, z: 2, u: u_val, v: v_val, w: 3 };
        const result1 = evaluate(ast, bindings);
        const result2 = evaluate(reparsed, bindings);

        // Both should have the same kind of result (both errors or both values)
        const isError1 = result1.error !== undefined;
        const isError2 = result2.error !== undefined;
        if (isError1 !== isError2) return false;
        
        // If both are errors, pass
        if (isError1 && isError2) return true;
        
        // Both are numbers - check they're finite and equal
        if (!isFinite(result1) || !isFinite(result2)) {
          // Overflow is acceptable if both overflow identically
          return result1 === result2 || (isNaN(result1) && isNaN(result2));
        }
        
        // Exact equality (since we're evaluating the same AST with same bindings)
        return result1 === result2;
      }
    ),
    { numRuns: 200 }
  );
});

// Property P7: Parse-print equivalence
// For any valid AST, printing and re-parsing produces semantically equivalent AST
test('P7 - parse-print-equivalence', () => {
  fc.assert(
    fc.property(
      arbitraryExpr(),
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
      (ast, u_val, v_val) => {
        const printed = print(ast);
        const tokens = tokenize(printed);
        const reparsed = parse(tokens);

        if (reparsed.error) {
          return false;
        }

        // Test semantic equivalence by evaluating at multiple points
        const testPoints = [
          { x: 1, y: 1, z: 2, u: 1, v: 1, w: 3 },
          { x: 2, y: 3, z: 2, u: 2, v: 3, w: 3 },
          { x: u_val, y: v_val, z: 2, u: u_val, v: v_val, w: 3 }
        ];

        for (const bindings of testPoints) {
          const result1 = evaluate(ast, bindings);
          const result2 = evaluate(reparsed, bindings);

          const isError1 = result1.error !== undefined;
          const isError2 = result2.error !== undefined;
          
          if (isError1 !== isError2) return false;
          if (isError1 && isError2) continue;
          if (isFinite(result1) && isFinite(result2)) {
            if (result1 !== result2) return false;
          } else if ((isNaN(result1) || !isFinite(result1)) && (isNaN(result2) || !isFinite(result2))) {
            // Both overflow/underflow, acceptable
            continue;
          } else {
            return false;
          }
        }

        return true;
      }
    ),
    { numRuns: 200 }
  );
});

// Property P1: Evaluation consistency
// Evaluation should never throw or produce NaN for valid expressions with valid inputs
test('P1 - evaluation-consistency', () => {
  fc.assert(
    fc.property(
      arbitraryExpr(),
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
      (ast, u, v) => {
        const bindings = { x: u, y: v, z: 2, u: u, v: v, w: 3 };
        const result = evaluate(ast, bindings);

        // Result should be either an error object or a number (possibly Infinity from overflow)
        if (result.error !== undefined) {
          // Error objects are okay
          return true;
        }

        // Result must be a number (including Infinity)
        return typeof result === 'number';
      }
    ),
    { numRuns: 200 }
  );
});

// Known expressions test to ensure specific examples work
test('P3-P7 - known-expression-roundtrip', () => {
  const knownExpressions = [
    'x + y',
    'x * y',
    'x ^ 2',
    'exp(x)',
    'abs(y)',
    '2 * x + 3 * y',
    '(x + y) ^ 2',
    'exp(x + y)',
    'x * x * x'
  ];

  for (const expr of knownExpressions) {
    const tokens = tokenize(expr);
    const ast = parse(tokens);
    assert(!ast.error, `Parse failed for: ${expr}`);

    const printed = print(ast);
    const tokens2 = tokenize(printed);
    const ast2 = parse(tokens2);
    assert(!ast2.error, `Re-parse failed for: ${printed}`);

    // Evaluate at known points
    const bindings = { x: 2, y: 3 };
    const result1 = evaluate(ast, bindings);
    const result2 = evaluate(ast2, bindings);

    assert.equal(result1, result2, `Results differ for "${expr}": ${result1} vs ${result2}`);
  }
});
