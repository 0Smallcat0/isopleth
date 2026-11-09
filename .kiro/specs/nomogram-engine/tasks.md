# Nomogram Engine Tasks

## Overview

This task list breaks down the nomogram engine implementation into small, ordered chunks. Each task is estimated at ≤ ~1 hour of work. Property tests follow immediately after the module they verify. The final task wires up the test runner.

## Task Status

- [x] T1: Project scaffold and dependencies
- [x] T2: Expression tokenizer (expr.js part 1)
- [x] T3: Expression parser (expr.js part 2)
- [x] T4: Expression evaluator and printer (expr.js part 3)
- [x] T5: Unit tests for expr.js
- [x] T6: Property tests for expr.js
- [x] T7: Compiler — sum form recognition (compile.js part 1)
- [x] T8: Compiler — product form recognition (compile.js part 2)
- [x] T9: Compiler — outer function normalization (compile.js part 3)
- [x] T10: Compiler — outer function form (compile.js part 4)
- [x] T11: Compiler — Z-chart form (compile.js part 5)
- [x] T12: Unit tests for compile.js
- [x] T13: Property tests for compile.js
- [x] T14: Scale functions and tick generation (scales.js part 1)
- [x] T15: Label thinning (scales.js part 2)
- [x] T16: Unit tests for scales.js
- [x] T17: Property tests for scales.js
- [x] T18: Parallel layout geometry (layout.js part 1)
- [x] T19: Z-chart layout geometry (layout.js part 2)
- [x] T20: Layout dispatcher and helpers (layout.js part 3)
- [x] T21: Unit tests for layout.js
- [x] T22: Property tests for layout.js
- [x] T23: Reader for parallel scales (reader.js part 1)
- [x] T24: Reader helpers and Z-chart support (reader.js part 2)
- [x] T25: Unit tests for reader.js
- [x] T26: Property tests for reader.js

---

## T1: Project scaffold and dependencies
**Requirements:** Infrastructure  
**Effort:** 15 min

- Create `package.json` with `"type": "module"` for ES modules
- Add fast-check as devDependency: `npm install --save-dev fast-check`
- Configure `"test"` script: `"test": "node --test test/**/*.test.js"`
- Create directory structure: `src/core/`, `src/ui/`, `mcp/`, `test/`
- Create `.gitignore` (exclude `node_modules/`)
- Verify `npm test` runs (no tests yet, should report 0 tests)

---

## T2: Expression tokenizer (expr.js part 1)
**Requirements:** R1.1  
**Effort:** 30 min

- Implement `tokenize(source)` function
- Recognize token types: NUMBER, IDENTIFIER, OPERATOR (+, -, *, /, ^), LPAREN, RPAREN, COMMA, EOF
- Handle scientific notation (e.g., `1e-3`, `2.5e10`)
- Recognize Greek letter identifiers (alpha, beta, gamma, delta, epsilon, sigma, pi, etc.)
- Return array of `{type, value, pos}` tokens
- Handle whitespace (skip, don't tokenize)
- Export `tokenize` function

---

## T3: Expression parser (expr.js part 2)
**Requirements:** R1.1, R1.2, R1.3  
**Effort:** 45 min

- Implement `parse(tokens)` function using recursive descent
- Operator precedence: `^` (right-associative) > `*`, `/` (left) > `+`, `-` (left)
- Unary minus handling (e.g., `-x`, `-(a + b)`)
- Function calls: `fn(arg1, arg2, ...)` for sqrt, ln, log10, exp, abs, sin, cos, tan
- Constants: recognize `pi`, `e` as special identifiers
- AST node kinds: number, identifier, binop, unary, call
- Return `{error, pos}` on parse errors (unexpected token, mismatched parens)
- Implement `splitFormula(source)` to separate `lhs = rhs`
- Export `parse`, `splitFormula` functions

---

## T4: Expression evaluator and printer (expr.js part 3)
**Requirements:** R1.4, R1.5, R1.6, R1.7  
**Effort:** 30 min

- Implement `evaluate(node, bindings)` function
- Handle all AST node kinds
- Implement constants: `pi = Math.PI`, `e = Math.E`
- Implement functions: sqrt, ln (Math.log), log10 (Math.log10), exp, abs, sin, cos, tan
- Detect domain errors: sqrt of negative, ln/log10 of non-positive
- Detect division by zero
- Return `{error, context}` for domain/division errors
- Implement `print(node)` to convert AST back to infix string
- Add parentheses when needed for precedence
- Export `evaluate`, `print` functions

---

## T5: Unit tests for expr.js
**Requirements:** R1.1–R1.7  
**Effort:** 30 min

Create `test/expr.test.js`:
- Test tokenize: basic operators, numbers, scientific notation, identifiers
- Test parse: simple expressions, operator precedence, unary minus, function calls
- Test splitFormula: valid `lhs = rhs`, error on multiple `=`, error on no `=`
- Test evaluate: arithmetic, functions, constants, domain errors, division by zero
- Test print: round-trip examples (may differ in whitespace/parens but equivalent)
- Use node:test `describe`, `it`, `assert` API
- Run with `npm test`

---

## T6: Property tests for expr.js
**Requirements:** P3, P7  
**Effort:** 45 min

Create `test/expr.property.test.js`:
- **Property P3 (round-trip):** Generate random expressions (numbers, identifiers, binops), parse, print, parse again, evaluate both with same bindings → results must match within epsilon
- **Property P7 (parse-print equivalence):** Generate AST, print, parse, compare ASTs structurally (or evaluate at random points)
- Use fast-check: `fc.oneof`, `fc.double`, `fc.constantFrom`, `fc.tuple`
- Define custom arbitraries: `arbitraryBinop`, `arbitraryCall`, `arbitraryExpr` (recursive)
- Assert with `fc.assert`, `fc.property` with numRuns >= 200
- Run 200+ samples per property

---

## T7: Compiler — sum form recognition (compile.js part 1)
**Requirements:** R2.1.1, R2.2, R2.3, R2.4  
**Effort:** 45 min

- Implement `compile(ast, outputVar, ranges, layout)` function
- Detect sum form: `w = c + a*A(u) + b*B(v)`
- Algorithm: traverse AST, identify additive structure, extract coefficients and scale functions
- Handle cases: `w = u + v`, `w = 5 + 2*u + 3*v`, `w = u + v + 10`
- Build chart definition:
  - scales[0]: {name: u, fn: (x) => a*A(x), range: ranges[u], scaleKind: 'linear'}
  - scales[1]: {name: v, fn: (x) => b*B(x), range: ranges[v], scaleKind: 'linear'}
  - scales[2]: {name: w, fn: (x) => x - c, range: [computed], scaleKind: 'linear'}
- Compute output range: evaluate fn(u_min, v_min), fn(u_max, v_max), etc., take [min, max]
- Validate: exactly two input variables
- Return `{error}` if not sum form yet (other forms not implemented)
- Export `compile` function

---

## T8: Compiler — product form recognition (compile.js part 2)
**Requirements:** R2.1.2, R2.5  
**Effort:** 45 min

- Detect product form: `w = k * A(u)^p * B(v)^q`
- Algorithm: traverse AST, identify multiplicative structure, extract constant k, factors with exponents
- Handle cases: `w = u * v`, `w = 3 * u^2 * v`, `w = u * v / 5` (rewrite as `w = 0.2 * u * v`), `w = u / v` (rewrite as `w = u * v^-1`)
- Check ranges: all factors must have positive ranges (for logarithmic scales)
- Return `{error}` if any range includes ≤ 0 values
- Note: exponents p, q may be any non-zero real number (including negative for ratios like V/I)
- Build chart definition:
  - scales use logarithmic scale functions: fn: (x) => p*Math.log10(A(x))
  - scaleKind: 'log'
- Compute output range from log-space min/max
- Extend `compile` to try sum, then product

---

## T9: Compiler — outer function normalization (compile.js part 3)
**Requirements:** R2.1.3 (normalization)  
**Effort:** 30 min

- When formula is `g(expr)` where g is a power or sqrt and expr is a product of powers, normalize to product-of-powers form
- Example: `sqrt(H*W/3600)` → `3600^-0.5 * H^0.5 * W^0.5`
- Algorithm: if outer function is sqrt or ^p, and inner is a product, distribute the exponent into the product factors
- Apply normalization before form detection
- Helps align with product form requirements
- Export helper function (internal use)

---

## T10: Compiler — outer function form (compile.js part 4)
**Requirements:** R2.1.3  
**Effort:** 30 min

- Detect outer function: `w = F(inner)` where F ∈ {sqrt, ^p, exp, ln, log10}
- Algorithm: check if AST root is a function call or exponentiation, recursively compile inner expression
- After normalization (T9), outer functions applied to product are converted to product form
- Apply inverse function to output scale: e.g., if `w = sqrt(inner)`, then f3(w) = w^2
- Outer functions:
  - sqrt: inverse is ^2
  - ^p: inverse is ^(1/p)
  - exp: inverse is ln
  - ln: inverse is exp
  - log10: inverse is 10^x
- Validate: inner must be sum or product form
- Build chart definition: modify output scale function
- Extend `compile` to try normalization, sum, product, then outer(sum), outer(product)

---

## T11: Compiler — Z-chart form (compile.js part 5)
**Requirements:** R2.1.4, R2.3  
**Effort:** 30 min

- Detect Z-chart: `w = k*u/v` when `layout === 'z'`
- Algorithm: identify division, check for two input variables
- Build chart definition:
  - scales[0]: u (linear, vertical left)
  - scales[1]: v (linear, vertical right)
  - scales[2]: w (linear, diagonal)
- Set form: 'z-chart'
- If layout is 'parallel' but formula is ratio, return error suggesting Z-chart layout
- Extend `compile` to handle all four forms
- Add final fallback: if no form matches, return `{error: "Unsupported formula form. Supported: sum, product, outer function, Z-chart."}`

---

## T12: Unit tests for compile.js
**Requirements:** R2.1–R2.5  
**Effort:** 30 min

Create `test/compile.test.js`:
- Test sum form: `w = u + v`, `w = 2*u + 3*v + 5`
- Test product form: `V = I * R`, `w = u^2 * v`
- Test outer function: `c = sqrt(a^2 + b^2)`, `BSA = sqrt(h * w / 3600)`
- Test Z-chart: `sigma = F / A` (with layout='z')
- Test errors: wrong number of variables, negative ranges in product, unsupported form
- Test output range computation: verify min/max are correct
- Assert chart definition structure (scales array, evaluate function, form string)

---

## T13: Property tests for compile.js
**Requirements:** P10, P11, P12  
**Effort:** 45 min

Create `test/compile.property.test.js`:
- **Property P10 (determinism):** Compile same AST twice, assert deep equality (functions tested by evaluation)
- **Property P11 (evaluator consistency):** For random (u, v) in ranges, chart.evaluate(u, v) ≈ evaluate(ast, {u, v})
- **Property P12 (compiled formula equivalence):** After compiling, chart.evaluate should match original formula for all inputs in range
- Generate arbitrary formulas in supported forms (helper arbitraries)
- Use fc.double with min/max constraints for ranges
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples per property

---

## T14: Scale functions and tick generation (scales.js part 1)
**Requirements:** R3.1, R3.2, R3.3, R3.6, R3.7  
**Effort:** 45 min

- Implement `scaleValue(value, min, max, kind)`: map value → [0, 1]
  - Linear: `(value - min) / (max - min)`
  - Log: `(Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))`
- Implement `unscaleValue(t, min, max, kind)`: inverse of scaleValue
- Implement `generateTicks(min, max, kind, lengthMm)`:
  - Linear: compute nice step (1-2-5 rule), generate major ticks, minor ticks at step/5
  - Log: major ticks at 10^k boundaries, minor ticks at 2·10^k, ..., 9·10^k
- Return `{major: [{value, label}], minor: [{value}]}`
- Format labels: use scientific notation for |value| < 0.01 or > 10000, else fixed-point
- Ensure ticks are strictly monotone in value
- Export `scaleValue`, `unscaleValue`, `generateTicks`

---

## T15: Label thinning (scales.js part 2)
**Requirements:** R3.4, R3.5  
**Effort:** 30 min

- Implement `thinLabels(labels, minSpacingMm)` function
- Input: array of `{value, label, posMm}`
- Algorithm: greedy pass — always keep first label, then keep next label only if distance from last kept label ≥ minSpacingMm
- Always attempt to keep the last label (endpoint) if space permits
- Return filtered array
- Add helper `formatTickLabel(value)` for consistent number formatting (scientific vs fixed-point, precision)
- Export `thinLabels`, `formatTickLabel`

---

## T16: Unit tests for scales.js
**Requirements:** R3.1–R3.7  
**Effort:** 30 min

Create `test/scales.test.js`:
- Test scaleValue: linear and log, edge cases (min, max, midpoint)
- Test unscaleValue: inverse of scaleValue
- Test generateTicks: linear range 0..10, log range 1..1000
- Assert major ticks at expected values (e.g., 0, 2, 4, 6, 8, 10 for linear; 1, 10, 100, 1000 for log)
- Assert minor ticks are present
- Test thinLabels: construct labels with positions, assert filtered list respects spacing
- Test formatTickLabel: very small, very large, normal numbers

---

## T17: Property tests for scales.js
**Requirements:** P2, P4  
**Effort:** 30 min

Create `test/scales.property.test.js`:
- **Property P2 (monotonicity):** For random v1 < v2 in range, scaleValue(v1) < scaleValue(v2)
- Generate ranges with fc.tuple(fc.double({min}), fc.double({min: min+1}))
- Test both linear and log scales
- **Property P4 (tick spacing):** For random scale ranges and lengthMm, generate ticks, compute positions, apply thinLabels, assert all consecutive labeled ticks ≥ 3 mm apart
- Use fc.record to generate scale parameters
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples

---

## T18: Parallel layout geometry (layout.js part 1)
**Requirements:** R4.1–R4.4, R4.5, R4.7, R4.8, R4.9  
**Effort:** 60 min

- Define constants: SHEET_WIDTH = 210, SHEET_HEIGHT = 297, MARGIN = 15, TITLE_BLOCK_HEIGHT = 42
- Compute drawing area: left = MARGIN, right = SHEET_WIDTH - MARGIN, top = MARGIN, bottom = SHEET_HEIGHT - MARGIN - TITLE_BLOCK_HEIGHT
- Implement `layoutParallel(chart)`:
  - Position three vertical scales at x1 = 0, x_m = D*m1/(m1+m2), x2 = D using independent moduli m1, m2
  - Compute y extent: yTop = top + small padding, yBottom = bottom - small padding
  - For each scale, return `valueToPoint(value)` function with proper offsets: y = b + m_i · (f_i(value) - f_i_min)
  - Compute m3 = m1·m2/(m1+m2) from collinearity constraint
  - Generate ticks using scales.js, convert to mm positions
  - Apply thinLabels with minSpacingMm = 3
  - Return Layout object with scales array
- Export `layoutParallel`

---

## T19: Z-chart layout geometry (layout.js part 2)
**Requirements:** R4.6, R4.7, R4.8, R4.9  
**Effort:** 45 min

- Implement `layoutZChart(chart)`:
  - Position scale 0 (u) at left: x = 35 mm, vertical from yTop to yBottom
  - Position scale 1 (v) at right: x = 175 mm, vertical from yTop to yBottom
  - Position scale 2 (w) as diagonal: parameterized by t ∈ [0, 1], line from (xLeft, yBottom) to (xRight, yTop)
  - valueToPoint for diagonal: compute t = scaleValue(w), then point = lerp between endpoints
  - Generate ticks for all three scales
  - Return Layout object
- Handle edge case: if w range causes diagonal to be too steep or flat, adjust geometry
- Export `layoutZChart`

---

## T20: Layout dispatcher and helpers (layout.js part 3)
**Requirements:** R4.1–R4.9  
**Effort:** 15 min

- Implement `layout(chart, layoutType)` dispatcher: call layoutParallel or layoutZChart
- Add helper `boundsCheck(layout)`: ensure all scale positions and tick positions lie within [MARGIN, SHEET_WIDTH - MARGIN] × [MARGIN, SHEET_HEIGHT - MARGIN - TITLE_BLOCK_HEIGHT]
- Return warnings if any elements exceed bounds (for debugging)
- Export `layout`, `layoutParallel`, `layoutZChart`, `boundsCheck`

---

## T21: Unit tests for layout.js
**Requirements:** R4.1–R4.9  
**Effort:** 30 min

Create `test/layout.test.js`:
- Test layoutParallel: simple sum form, check x-coordinates, y-coordinates for known values
- Test layoutZChart: simple ratio form, check diagonal parameterization
- Test boundsCheck: construct layout with out-of-bounds elements, assert warnings
- Test modulus calculation: ensure scales fill available area without overflow
- Assert sheet size constants are correct (210 × 297)
- Assert margins and title block reservation

---

## T22: Property tests for layout.js
**Requirements:** P5, P6, P11  
**Effort:** 30 min

Create `test/layout.property.test.js`:
- **Property P1 (collinearity — parallel):** FOR all valid input ranges, three points P1(u), P2(v), P3(w) satisfy |det[[x1,y1,1],[x_m,y3,1],[x2,y2,1]]| ≤ 1e-9 · (layout_width · usable_height)
- **Property P2 (collinearity — Z-chart):** FOR all valid input ranges in Z-chart, three points are collinear within numerical tolerance
- **Property P5 (bounds):** For random chart definitions, generate layout, check all tick positions lie within allowed area
- **Property P6 (no title-block overlap):** Assert all scale geometry y-coordinates < SHEET_HEIGHT - MARGIN - TITLE_BLOCK_HEIGHT
- Generate arbitrary chart definitions (sum, product forms)
- Use boundsCheck helper
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples

---

## T23: Reader for parallel scales (reader.js part 1)
**Requirements:** R5.1, R5.2, R5.3, R5.4, R5.5  
**Effort:** 60 min

- Implement `readThirdScale(layout, chart, input1, input2, outputScale)`:
  - input1 = {scale: 0, value: u}, input2 = {scale: 1, value: v}, outputScale = 2
  - Compute P1 = layout.scales[0].valueToPoint(u), P2 = layout.scales[1].valueToPoint(v)
  - Define line L(s) = P1 + s*(P2 - P1)
  - For vertical third scale: find s such that L(s).x = x3, compute y3 = L(s).y
  - Invert y3 → value using layout.scales[2].pointToValue (implement this helper)
  - Use bracketed bisection on the scale parameter with tolerance 1e-10 of range
  - Check if value ∈ [scale3.min, scale3.max]; if not, return {error: 'out-of-range'}
- Handle degenerate cases: P1 ≈ P2 (no line), parallel line (no intersection)
- Export `readThirdScale`

---

## T24: Reader helpers and Z-chart support (reader.js part 2)
**Requirements:** R5.6, R5.7, R5.8  
**Effort:** 45 min

- Implement `pointOnScale(layout, scaleIndex, value)`: wrapper for layout.scales[i].valueToPoint(value)
- Implement `valueAtPoint(layout, chart, scaleIndex, point)`: inverse, find value such that valueToPoint(value) ≈ point
- For diagonal Z-chart scale: solve for t such that diagonal_line(t) ≈ point, then unscale t → value
- Implement Z-chart reading: given two known scales, find straightedge line, intersect with diagonal, solve for w
- Use Brent's method or bisection for root finding (tolerance 1e-10)
- Export `pointOnScale`, `valueAtPoint`

---

## T25: Unit tests for reader.js
**Requirements:** R5.1–R5.8  
**Effort:** 30 min

Create `test/reader.test.js`:
- Test readThirdScale: construct simple chart (V = I * R), set I=2, R=5, read V → expect 10
- Test out-of-range: set I, R such that V exceeds output range → expect {error: 'out-of-range'}
- Test pointOnScale and valueAtPoint: round-trip value → point → value
- Test degenerate cases: P1 = P2 → error
- Test Z-chart reading: simple ratio w = u/v

---

## T26: Property tests for reader.js
**Requirements:** P1, P5, P9, P12  
**Effort:** 45 min

Create `test/reader.property.test.js`:
- **Property P5 (reader correctness and numerical tolerance):** For random (u, v) in ranges, w_true = chart.evaluate(u, v); w_read = readThirdScale(...); assert relative error ≤ 1e-6 (or absolute error ≤ 1e-9 · scale_span when near zero)
- **Property P9 (convergence):** Instrument readThirdScale to count iterations, assert count ≤ 100
- Generate arbitrary valid charts
- Use fc.record for (u, v) pairs within ranges
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples

---

## T27: Accuracy certificate generation (certificate.js part 1)
**Requirements:** R6.1, R6.2, R6.3, R6.4, R6.5, R6.6  
**Effort:** 60 min

- Implement `generateCertificate(layout, chart, deltaMm = 0.5)`:
  - Define grid: 41 steps in u, 41 steps in v → linspace(u_min, u_max, 41), linspace(v_min, v_max, 41)
  - Nested loop: for each (u_i, v_j):
    - w_true = chart.evaluate(u_i, v_j)
    - If w_true out of output range, skip
    - P1 = pointOnScale(layout, 0, u_i), P2 = pointOnScale(layout, 1, v_j), P3 = pointOnScale(layout, 2, w_true)
    - Perturbations: (P1.y ± delta, P2.y ± delta) → 4 combinations
    - For each perturbed (P1', P2'), call readThirdScale → w_perturbed
    - If out-of-range, skip
    - Compute error: |w_perturbed - w_true| (linear) or |log(w_perturbed) - log(w_true)| → relative %
    - Track max_error
  - Apply safety factor: certified_error = 1.1 × max_error
  - Count valid samples and perturbations
- Return Certificate object: {maxError, errorType, units, gridSize, perturbations}
- Export `generateCertificate`

---

## T28: Certificate formatting (certificate.js part 2)
**Requirements:** R6.7, R6.8, R6.9  
**Effort:** 15 min

- Implement `formatCertificate(certificate)` → human-readable sentence
- Linear: "Straightedge placement within ±[delta] mm yields results accurate to within [maxError] [units]."
- Logarithmic: "Straightedge placement within ±[delta] mm yields results accurate to within [maxError]% of true value."
- Include verification summary: "Verified on [gridSize] sample points with [perturbations] perturbation tests."
- Export `formatCertificate`

---

## T29: Unit tests for certificate.js
**Requirements:** R6.1–R6.9  
**Effort:** 30 min

Create `test/certificate.test.js`:
- Test certificate generation: simple chart (V = I * R), deltaMm = 0.5, check maxError > 0
- Test zero-delta: deltaMm = 0 → maxError ≈ 0 (within numerical tolerance)
- Test grid sampling: assert gridSize = 1681, perturbations = up to 6724 (some may be out-of-range)
- Test error type: linear output → absolute, log output → relative %
- Test formatCertificate: check sentence structure

---

## T30: Property tests for certificate.js
**Requirements:** P8, P12  
**Effort:** 30 min

Create `test/certificate.property.test.js`:
- **Property P8 (zero-delta):** For arbitrary charts, if deltaMm = 0, then maxError ≈ 0
- Generate arbitrary sum/product forms
- Run certificate generation with delta = 0
- Assert maxError < 1e-12 (numerical epsilon)
- **Property P12 (certificate soundness):** For random perturbations of input points by ±delta_mm, the reading error never exceeds the certificate bound (including the 1.1 safety factor)
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples (certificate generation is slow, may need to adjust)

---

## T31: SVG rendering — structure and scales (svg.js part 1)
**Requirements:** R7.1, R7.2, R7.5, R7.6, R7.7, R7.10  
**Effort:** 60 min

- Implement `renderSVG(layout, chart, certificate, straightedge = null)`:
  - Open SVG tag: `<svg width="210mm" height="297mm" viewBox="0 0 210 297" xmlns="...">`
  - Add `<style>` block: system fonts, tabular-nums, palette (#f4f1ea, #1f1e1c, #c43c25)
  - Background rect: `<rect fill="#f4f1ea" width="210" height="297" />`
  - For each scale in layout.scales:
    - Draw scale line: `<line class="scale-line" ... stroke="#1f1e1c" stroke-width="0.25" />` (0.25 mm)
    - Draw ticks: major `stroke-width="0.2"` (0.2 mm), minor `stroke-width="0.15"` (0.15 mm)
    - Draw labels: `<text class="tick-label" ... >{label}</text>`
    - Position labels offset from scale line (3 mm to the side)
    - Draw variable name near scale
  - Return SVG string
- Ensure all coordinates use layout geometry (mm)
- Export `renderSVG`

---

## T32: SVG rendering — calibration bar and title block (svg.js part 2)
**Requirements:** R7.3, R7.4  
**Effort:** 45 min

- Add calibration bar to renderSVG:
  - Position: inside title block at bottom (e.g., translate(55, 262))
  - Horizontal line 100 mm long
  - End markers (short vertical lines at 0 and 100 mm)
  - Label "100 mm" centered below
- Add title block (bottom 42 mm reserved area):
  - Outer rect at (MARGIN, SHEET_HEIGHT - MARGIN - TITLE_BLOCK_HEIGHT), size (SHEET_WIDTH - 2*MARGIN, TITLE_BLOCK_HEIGHT)
  - Inside, text elements for:
    - Title (derived from formula, e.g., "Nomogram: V = I × R")
    - Formula (infix string from chart.formula)
    - Ranges (format: "I: 0.01..10 A; R: 1..1000 Ω")
    - Certificate sentence
    - Date (current date)
    - "Isopleth" mark (bottom-right)
  - Use small font sizes (8–10 pt) to fit
- Check label overflow: if text would exceed bounds, truncate or abbreviate

---

## T33: SVG rendering — straightedge line (svg.js part 3)
**Requirements:** R7.9  
**Effort:** 15 min

- If `straightedge` parameter is provided: `{p1: {scale, value}, p2: {scale, value}}`
- Compute P1 = pointOnScale(layout, p1.scale, p1.value), P2 = pointOnScale(layout, p2.scale, p2.value)
- Extend line to third scale or sheet edges
- Draw line: `<line class="straightedge" ... stroke="#c43c25" stroke-width="1" />`
- Draw small circles at P1 and P2 (handle markers)
- Highlight the third value (read using reader.js) in vermilion

---

## T34: Unit tests for svg.js
**Requirements:** R7.1–R7.10  
**Effort:** 30 min

Create `test/svg.test.js`:
- Test renderSVG: generate SVG for simple chart, check it's non-empty string
- Test viewBox: parse SVG, extract viewBox attribute, assert "0 0 210 297"
- Test width/height attributes: assert "210mm", "297mm"
- Test palette: check for color codes #f4f1ea, #1f1e1c, #c43c25 in output
- Test calibration bar: assert presence of "100 mm" text and line of length 100 inside title block
- Test title block: assert formula text is present
- Test straightedge line: pass straightedge parameter, check for vermilion line
- Test line weights: verify stroke-width values for scale (0.25), major ticks (0.2), minor ticks (0.15)

---

## T35: Property tests for svg.js
**Requirements:** P7  
**Effort:** 30 min

Create `test/svg.property.test.js`:
- **Property P7 (well-formed XML):** For arbitrary charts, generate SVG, parse with XML parser, assert no errors
- Use Node.js DOMParser or xml2js library (add as devDep if needed, or use native browser DOMParser in tests with jsdom)
- Alternative: regex check for balanced tags (simpler, less robust)
- **Property (viewBox match):** Extract viewBox, assert "0 0 210 297"
- Assert with fc.assert, fc.property with numRuns >= 200
- Run 200+ samples (SVG generation is slow, may need to adjust)

---

## T36: Built-in examples (examples.js)
**Requirements:** R8.1, R8.2, R8.3  
**Effort:** 30 min

- Implement `getExamples()` function returning array of Example objects
- Define 5 examples:
  1. Ohm's law: `{name: "Ohm's Law", formula: "V = I * R", ranges: {I: [0.01, 10], R: [1, 1000]}, layout: 'parallel', description: "..."}`
  2. BSA (Mosteller): `{formula: "BSA = sqrt(height * weight / 3600)", ranges: {height: [100, 210], weight: [10, 150]}, ...}`
  3. Right triangle: `{formula: "c = sqrt(a^2 + b^2)", ranges: {a: [0.1, 10], b: [0.1, 10]}, ...}`
  4. Reynolds: `{formula: "Re = v * D / 1.5e-5", ranges: {v: [0.1, 10], D: [0.01, 0.5]}, ...}`
  5. Axial stress: `{formula: "sigma = 1000 * F / A", ranges: {F: [0.1, 50], A: [50, 500]}, layout: 'z', ...}`
- Validate each example compiles successfully (internal check)
- Adjust ranges to avoid domain errors (e.g., avoid 0 or negative values for log/sqrt)
- Export `getExamples`

---

## T37: Integration test (test/integration.test.js)
**Requirements:** All  
**Effort:** 30 min

Create `test/integration.test.js`:
- For each example in examples.js:
  - Parse formula
  - Compile chart
  - Generate layout
  - Generate certificate
  - Render SVG
  - Assert SVG is non-empty
  - Assert certificate.maxError is a positive number
  - Assert SVG contains formula text
- Test straightedge reading: for example "V = I * R", set I=1, R=10, read V → expect ≈10
- Test error handling: unsupported formula → returns {error}
- Run full pipeline for each example

---

## T38: MCP server — protocol scaffold (mcp/server.mjs part 1)
**Requirements:** R9.1, R9.2, R9.3  
**Effort:** 45 min

- Create `mcp/server.mjs` as ES module
- Implement stdio JSON-RPC 2.0 reader/writer:
  - Read from stdin line-by-line
  - Parse JSON-RPC request
  - Dispatch to handler (initialize, tools/list, tools/call)
  - Write JSON-RPC response to stdout
- Implement `initialize` handler: return protocol version "2024-11-05", capabilities {tools: {}}
- Implement `tools/list` handler: return list with one tool "make_nomogram"
- Define input schema for make_nomogram (formula, ranges, layout, deltaMm, outFile)
- Test manually: echo request JSON, pipe to server, check response

---

## T39: MCP server — make_nomogram tool (mcp/server.mjs part 2)
**Requirements:** R9.4, R9.5, R9.6, R9.7, R9.8  
**Effort:** 60 min

- Implement `tools/call` handler for "make_nomogram"
- Import core modules: expr.js, compile.js, scales.js, layout.js, reader.js, certificate.js, svg.js
- Pipeline:
  1. splitFormula, tokenize, parse
  2. compile(ast, outputVar, ranges, layout)
  3. layout(chart, layout)
  4. generateCertificate(layout, chart, deltaMm)
  5. renderSVG(layout, chart, certificate)
- If any step returns {error}, return JSON-RPC error response
- Format output text: certificate sentence + verification summary (grid size, perturbation count, max error) + "--- SVG ---\n" + SVG string
- If outFile provided, write SVG to path (use fs.writeFileSync, resolve relative to workspace root)
- Return success response with content array: `[{type: "text", text: "..."}]`

---

## T40: MCP server registration (mcp/server.mjs part 3)
**Requirements:** R9.9  
**Effort:** 15 min

- Create or update `.kiro/settings/mcp.json`:
  ```json
  {
    "mcpServers": {
      "isopleth-nomogram": {
        "command": "node",
        "args": ["mcp/server.mjs"],
        "disabled": false
      }
    }
  }
  ```
- Document in README: how to test the MCP server manually
- Test: echo JSON-RPC request to stdin, run `node mcp/server.mjs`, check stdout

---

## T41: MCP server test (test/mcp.test.js)
**Requirements:** R9.1–R9.9  
**Effort:** 30 min

Create `test/mcp.test.js`:
- Mock stdin/stdout or use child_process.spawn to run server as subprocess
- Send initialize request, assert response protocol version
- Send tools/list request, assert make_nomogram is listed
- Send tools/call request with example formula (V = I * R), assert response contains SVG
- Send tools/call with invalid formula, assert error response
- Test outFile: provide path, check file is written
- Clean up test files after

---

## T42: Final test suite wiring
**Requirements:** All property tests  
**Effort:** 15 min

- Verify `npm test` runs all test files in `test/` directory
- Ensure test script includes both `.test.js` and `.property.test.js` files
- Add test summary script: count total tests, properties, examples
- Update package.json if needed (node --test supports glob patterns)
- Run full suite: `npm test` → should report all tests passing
- Document expected test count in README

---

## T43: Documentation and README
**Requirements:** Project completeness  
**Effort:** 30 min

- Update README.md with:
  - Project overview (nomogram engine, MCP server)
  - Installation: `npm install`, `npm test`
  - Module documentation: brief description of each core module
  - MCP server usage: how to register and call make_nomogram
  - Examples: list the 5 built-in examples
  - Testing: explain unit tests + property tests with fast-check
  - License (MIT, already in LICENSE file)
- Add inline JSDoc comments to all exported functions (if not already done in earlier tasks)
- Verify all modules have correct export statements

---

## Summary

- **Total tasks:** 43
- **Estimated total effort:** ~26 hours (includes test writing, which is substantial)
- **Dependency order:** Tasks are ordered such that dependencies are met (e.g., expr.js before compile.js, scales.js before layout.js, reader.js needs layout.js, certificate.js needs reader.js)
- **Property tests:** 8 property test tasks (T6, T13, T17, T22, T26, T30, T35, and integration)
- **No optional tasks:** All tasks are required for a complete, tested implementation

---

## Notes for Implementation

- **Task grouping:** Tasks can be grouped into sessions: T1-T6 (expr), T7-T13 (compile), T14-T17 (scales), T18-T22 (layout), T23-T26 (reader), T27-T30 (certificate), T31-T35 (svg), T36-T37 (examples + integration), T38-T41 (MCP), T42-T43 (final polish)
- **Parallel work:** Some tasks can be done in parallel if desired (e.g., svg.js while certificate.js is being finished), but the linear order is safe
- **Test-first option:** If preferred, tests can be written before implementation (TDD), but the tasks are ordered implementation-first for clarity
- **Fast-check learning curve:** T6 (first property test) may take longer if unfamiliar with fast-check; subsequent property tests will be faster
