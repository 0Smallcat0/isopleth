---
inclusion: fileMatch
fileMatchPattern: ["test/**/*.js"]
---

# Isopleth Testing Philosophy

Every universal requirement becomes a property-based test using fast-check. Name tests after requirement IDs. Run with `npm test`.

## Testing Strategy

**Property-based testing** (fast-check) verifies that behavior holds across a wide range of inputs, not just hand-coded cases.
- **Minimum runs:** numRuns >= 200 per property (always use 200+ samples; increase on failure)
- **Shrinking:** fast-check automatically shrinks failing cases to minimal reproduction
- **Seeding:** Print the seed on failure so failures are reproducible

**Unit tests** (node:test) verify specific functions and edge cases.

**Integration tests** verify end-to-end flows: parse → compile → layout → reader → certificate.

## Universal Properties (Always Keep)

### 1. Collinearity of Solution Points
**Requirement:** The three points (x₁, y₁), (x₂, y₂), (x₃, y₃) computed by layout must satisfy the determinant constraint.

```
det [[x1, y1, 1],
     [x2, y2, 1],
     [x3, y3, 1]] = 0
```

**Property:** For any valid input ranges and scale functions, the computed points are collinear (within numerical tolerance 1e-9).

**Test name:** `layout-collinearity` (or similar)

### 2. Reader Equals Formula Within Numerical Tolerance
**Requirement:** Reading a value from the nomogram (using the straightedge reader) must equal the formula within numerical tolerance, independent of the certificate bound.

**Property:** For random input pairs (u, v) uniformly sampled over their ranges, the reader output equals the formula f(u, v) within numerical tolerance: relative error ≤ 1e-6, or absolute error ≤ 1e-9 × scale span when the value is near zero.

**Test name:** `reader-formula-equivalence`

### 3. Ticks Strictly Monotone
**Requirement:** Tick values on each scale must be strictly increasing (no reversals, no overlaps, no repeated values).

**Property:** For each scale, the tick values are strictly monotone: tick[i] < tick[i+1] for all i.

**Test name:** `scales-ticks-monotone`

### 4. Everything Inside Printable Area
**Requirement:** All scales, tick marks, labels, and guides must fit within the printable area (A4 with standard margins).

**Property:** For any valid layout, the bounding box of all rendered elements fits within the margins (e.g., 10 mm from each edge on 210×297 mm).

**Test name:** `layout-within-printable-area`

### 5. SVG Physical Size Equals Sheet Size
**Requirement:** The SVG output width/height (in mm) and viewBox must match the intended sheet dimensions (e.g., 210×297 for A4).

**Property:** The SVG element has width/height attributes and viewBox that specify the sheet in mm; 1 user unit = 1 mm.

**Test name:** `svg-size-matches-sheet`

### 6. Certificate Bound Holds for Random Perturbations
**Requirement:** The accuracy certificate must guarantee that perturbations of input points by up to ±delta_mm do not produce reading errors larger than the stated bound.

**Property:** For random input pairs and random perturbations (up to ±delta_mm on each known point), the reading error never exceeds the certificate bound (including the 1.1 safety factor).

**Test name:** `certificate-bound-holds-under-perturbations`

### 7. Parser Print / Parse Round Trip
**Requirement:** Parsing a formula and printing it back must produce an equivalent AST; re-parsing must yield the same structure.

**Property:** For randomly generated expressions (using fast-check's AST generator), print(parse(print(parse(expr)))) == print(parse(expr)).

**Test name:** `expr-parse-print-roundtrip`

## Test Structure

```
test/
├── expr.test.js              # Unit tests for tokenizer, parser, evaluator
├── expr.property.test.js     # Properties: parse-print round trip, evaluation
├── compile.test.js           # Unit tests for form recognition
├── compile.property.test.js  # Properties: form recognition consistency
├── scales.test.js            # Unit tests for scale functions and ticks
├── scales.property.test.js   # Properties: monotonicity, label generation
├── layout.test.js            # Unit tests for moduli, offsets, positions
├── layout.property.test.js   # Properties: collinearity, margins
├── reader.test.js            # Unit tests for root finding
├── reader.property.test.js   # Properties: reader equals formula
├── certificate.test.js       # Unit tests for certificate generation
├── certificate.property.test.js # Properties: bound holds under perturbations
├── svg.test.js               # Unit tests for SVG serialisation
├── svg.property.test.js      # Properties: size, structure, calibration bar
└── integration.test.js       # End-to-end: parse → compile → layout → reader → certificate
```

## Naming Convention for Tests

- **Unit test file:** `<module>.test.js`
- **Property test file:** `<module>.property.test.js`
- **Test case name:** Requirement ID + descriptive suffix (e.g., `R3.2-collinearity`, `R5.1-reader-formula-equivalence`)

## Running Tests

```bash
npm test                                            # Runs all tests and properties
node --test --test-name-pattern="property"         # Property tests only
node --test --test-name-pattern="collinearity"     # Specific test
```

## Fast-Check Usage

Every property must:
1. Use `fc.assert()` to run the property with numRuns >= 200
2. Print the seed on failure (fast-check does this automatically)
3. Use appropriate generators for domain (e.g., `fc.double()` for real numbers with proper bounds, `fc.integer()` for counts)
4. Shrink to minimal failing case (fast-check does this automatically)

Example:
```javascript
import fc from 'fast-check';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('R2.1 - reader equals formula', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      (u, v) => {
        const readerValue = reader(u, v, chart);
        const formulaValue = formula(u, v);
        return Math.abs(readerValue - formulaValue) <= tolerance;
      }
    ),
    { numRuns: 200 }
  );
});
```
