# Nomogram Engine Design

## Overview

The nomogram engine transforms a formula string and variable ranges into a geometrically correct, printable alignment chart with a stated accuracy guarantee. The design is modular, testable, and DOM-free so all core modules run unchanged in both browser and Node environments (for tests and the MCP server).

---

## Architecture

```
Formula string + ranges
    ↓
[expr.js: tokenize → parse → AST]
    ↓
[compile.js: recognize form → chart definition]
    ↓
[scales.js: generate ticks + labels]
    ↓
[layout.js: geometry in mm]
    ↓
┌───────────────────┬─────────────────────┐
↓                   ↓                     ↓
[reader.js]    [certificate.js]     [svg.js]
straightedge   accuracy report      printable sheet
reading        (grid sampling)      (title block, calibration)
    ↓                   ↓                     ↓
Verification     Max error ±1.1×     True-scale SVG
```

**Key invariant:** All geometry is in millimetres. The SVG viewBox is `0 0 210 297` so 1 user unit = 1 mm. The y-axis points down (standard SVG coordinates).

---

## Module Interfaces

### expr.js

**Exports:**
```javascript
/**
 * Tokenize a formula string.
 * @param {string} source - The input formula
 * @returns {{type: string, value: string | number, pos: number}[]} Token array
 */
export function tokenize(source);

/**
 * Parse tokens into an AST.
 * @param {{type: string, value: string | number, pos: number}[]} tokens
 * @returns {{kind: string, ...fields} | {error: string, pos: number}} AST or error
 */
export function parse(tokens);

/**
 * Evaluate an AST node with given variable bindings.
 * @param {object} node - The AST node
 * @param {Record<string, number>} bindings - Variable values
 * @returns {number | {error: string}} Result or error (division by zero, domain error)
 */
export function evaluate(node, bindings);

/**
 * Print an AST node back to infix notation.
 * @param {object} node - The AST node
 * @returns {string} Infix string
 */
export function print(node);

/**
 * Split a formula "output = expr" into {lhs, rhs}.
 * @param {string} source - The formula string
 * @returns {{lhs: string, rhs: string} | {error: string, pos: number}}
 */
export function splitFormula(source);
```

**AST node kinds:**
- `{kind: 'number', value: number}`
- `{kind: 'identifier', name: string}`
- `{kind: 'binop', op: string, left: node, right: node}`
- `{kind: 'unary', op: string, arg: node}`
- `{kind: 'call', fn: string, args: node[]}`

**Error handling:** All parse and evaluate errors carry `{error: string, pos?: number}`. Never throw exceptions for user input errors.

---

### compile.js

**Exports:**
```javascript
/**
 * Recognize a formula and produce a chart definition.
 * @param {object} ast - The right-hand side AST
 * @param {string} outputVar - The left-hand side variable name
 * @param {Record<string, [number, number]>} ranges - Variable ranges {var: [min, max]}
 * @param {'parallel' | 'z'} layout - Chart layout style
 * @returns {ChartDefinition | {error: string}}
 */
export function compile(ast, outputVar, ranges, layout);

/**
 * @typedef {object} ChartDefinition
 * @property {string} form - 'sum' | 'product' | 'outer' | 'z-chart'
 * @property {{name: string, fn: (x: number) => number, range: [number, number], scaleKind: 'linear' | 'log'}[]} scales - Three scale definitions
 * @property {(u: number, v: number) => number} evaluate - Direct evaluator f(u, v) -> w
 * @property {string} formula - Original formula for display
 */
```

**Form recognition logic:**

1. **Sum form:** `w = c + a*A(u) + b*B(v)`
   - Scales: f1(u) = a·A(u), f2(v) = b·B(v), f3(w) = w - c
   - All linear scales
   - Alignment condition: f1(u) + f2(v) = f3(w) ⟹ three points satisfy collinearity constraint |det| ≤ 1e-9 · (layout_width · usable_height)

2. **Product form:** `w = k * A(u)^p * B(v)^q`
   - Scales: f1(u) = p·log(A(u)), f2(v) = q·log(B(v)), f3(w) = log(w) - log(k)
   - All logarithmic scales
   - Alignment condition: f1 + f2 = f3 ⟹ log(w/k) = p·log(A(u)) + q·log(B(v))
   - Requires positive ranges
   - Exponents p, q may be any non-zero real number (including negative for ratios such as V/I)

3. **Outer function:** `w = F(inner)` where inner is sum or product
   - When formula is g(expr) where expr is a product of powers and g is a power or sqrt, normalize to product-of-powers form first (e.g., `sqrt(H*W/3600)` → `3600^-0.5 * H^0.5 * W^0.5`)
   - Apply F^{-1} to output scale: f3(w) = F^{-1}(w)
   - Example: `w = sqrt(a^2 + b^2)` → inner is sum, outer is sqrt, so f3(w) = w^2

4. **Z-chart:** `w = k·u/v` (linear ratio)
   - Two vertical scales (u on left, v on right), diagonal w scale
   - Geometric constraint: point on diagonal scale is collinear with (u, v) points

**Error messages:** When unsupported, list "Supported forms: sum (w = c + A(u) + B(v)), product (w = k·A(u)·B(v)), outer function (sqrt, exp, ln, log10, ^p of sum/product), Z-chart (w = k·u/v)."

---

### scales.js

**Exports:**
```javascript
/**
 * Generate tick marks and labels for a scale.
 * @param {number} min - Scale minimum
 * @param {number} max - Scale maximum
 * @param {'linear' | 'log'} kind - Scale type
 * @param {number} lengthMm - Physical scale length in mm
 * @returns {{major: {value: number, label: string}[], minor: {value: number}[]}}
 */
export function generateTicks(min, max, kind, lengthMm);

/**
 * Apply a scale function to a value.
 * @param {number} value - Input value
 * @param {number} min - Scale min
 * @param {number} max - Scale max
 * @param {'linear' | 'log'} kind - Scale type
 * @returns {number} Normalized position in [0, 1]
 */
export function scaleValue(value, min, max, kind);

/**
 * Inverse of scaleValue.
 * @param {number} t - Normalized position in [0, 1]
 * @param {number} min - Scale min
 * @param {number} max - Scale max
 * @param {'linear' | 'log'} kind - Scale type
 * @returns {number} Value
 */
export function unscaleValue(t, min, max, kind);

/**
 * Thin out labels to respect minimum spacing.
 * @param {{value: number, label: string, posMm: number}[]} labels - Candidate labels
 * @param {number} minSpacingMm - Minimum gap (default 3 mm)
 * @returns {{value: number, label: string, posMm: number}[]} Filtered labels
 */
export function thinLabels(labels, minSpacingMm);
```

**Tick generation rules:**
- **Linear:** Use 1-2-5 steps. Candidate steps: 10^k, 2·10^k, 5·10^k for integer k. Choose the step that gives 5–15 major ticks.
- **Logarithmic:** Major ticks at 10^k for each decade crossing [min, max]. Minor ticks at 2·10^k, 3·10^k, ..., 9·10^k within each decade. If the range spans < 2 decades, include all minors; otherwise omit minors for clarity.
- **Monotonicity:** Tick positions must be strictly increasing (or decreasing if scale is inverted).
- **Label collision:** After placing labels at their geometric positions, filter out intermediate labels until all pairs are ≥ 3 mm apart. Always keep the first and last label if possible.

---

### layout.js

**Exports:**
```javascript
/**
 * Compute geometry for a parallel-scale nomogram.
 * @param {ChartDefinition} chart
 * @returns {Layout}
 */
export function layoutParallel(chart);

/**
 * Compute geometry for a Z-chart nomogram.
 * @param {ChartDefinition} chart
 * @returns {Layout}
 */
export function layoutZChart(chart);

/**
 * @typedef {object} Layout
 * @property {{valueToPoint: (v: number) => {x: number, y: number}, ticks: Tick[], extent: {x1, y1, x2, y2}, variable: string}[]} scales - Three scale geometries
 * @property {{width: number, height: number}} sheetSize - Always {width: 210, height: 297}
 * @property {{top: number, right: number, bottom: number, left: number}} margins - Always 15 mm, but bottom margin + title block = 57 mm total
 */

/**
 * @typedef {object} Tick
 * @property {number} value
 * @property {number} x - Position in mm
 * @property {number} y - Position in mm
 * @property {string} label - Empty string for minor ticks
 * @property {boolean} isMajor
 */
```

**Coordinate system:** SVG standard: origin at top-left, +x right, +y down. All units in mm.

**Sheet layout:**
- A4 portrait: 210 × 297 mm
- Margins: 15 mm on all sides
- Title block: bottom 42 mm (so effective bottom margin is 15 + 42 = 57 mm)
- Drawing area: width = 210 - 30 = 180 mm, height = 297 - 15 - 57 = 225 mm

**Parallel layout:**
- Three vertical scales at x-coordinates: x1 = 0, x_m, x2 = D (where D is the layout width)
- Left scale (x1 = 0): y₁ = b + m₁·(f₁(u) − f₁_min)
- Right scale (x2 = D): y₂ = b + m₂·(f₂(v) − f₂_min)
- Middle scale (x_m = D·m₁/(m₁ + m₂)): y₃ = b + m₃·(f₃(w) − f₃_min), where f₃_min = f₁_min + f₂_min for sum form
- Moduli: m₁ and m₂ are chosen independently so each outer scale fills the usable height; m₃ = m₁·m₂/(m₁ + m₂) (determined by collinearity)
- Collinearity: For any (u, v), the three points satisfy |det[[x1,y1,1],[x_m,y3,1],[x2,y2,1]]| ≤ 1e-9 × (layout width × usable height)

**Z-chart layout:**
- Scale 1 (u): vertical on left at x1
- Scale 2 (v): vertical on right at x3
- Scale 3 (w): diagonal connecting bottom-left to top-right (or another orientation depending on ratio direction)
- The diagonal scale parameter t ∈ [0, 1] maps to points along the diagonal line
- Geometric constraint: for any valid (u, v, w), the three points are collinear

**Moduli calculation:**
For parallel scales with sum form f1(u) + f2(v) = f3(w), or product form with logarithmic scales f1(u) + f2(v) = f3(w):
- Choose m1 and m2 independently so each outer scale fills the usable height: m1 · (f1max - f1min) ≈ available_height and m2 · (f2max - f2min) ≈ available_height
- Compute x_m = D · m1 / (m1 + m2)
- Compute m3 = m1 · m2 / (m1 + m2) (determined by collinearity constraint)
- Offsets computed using bottom-aligned origin b: y1 = b + m1·(f1(u) - f1min), y2 = b + m2·(f2(v) - f2min), y3 = b + m3·(f3(w) - f3min)

---

### reader.js

**Exports:**
```javascript
/**
 * Given values on two scales, find the value on the third.
 * @param {Layout} layout
 * @param {ChartDefinition} chart
 * @param {{scale: number, value: number}} input1 - e.g., {scale: 0, value: 5.2}
 * @param {{scale: number, value: number}} input2
 * @param {number} outputScale - The scale index to solve for (0, 1, or 2)
 * @returns {{value: number} | {error: 'out-of-range'}}
 */
export function readThirdScale(layout, chart, input1, input2, outputScale);

/**
 * Compute the point on a given scale for a given value.
 * @param {Layout} layout
 * @param {number} scaleIndex - 0, 1, or 2
 * @param {number} value
 * @returns {{x: number, y: number}}
 */
export function pointOnScale(layout, scaleIndex, value);

/**
 * Inverse: find the value at a given point on a scale.
 * @param {Layout} layout
 * @param {ChartDefinition} chart
 * @param {number} scaleIndex
 * @param {{x: number, y: number}} point
 * @returns {number}
 */
export function valueAtPoint(layout, chart, scaleIndex, point);
```

**Algorithm (parallel scales):**
1. Compute positions P1 = pointOnScale(input1), P2 = pointOnScale(input2)
2. The straightedge line L passes through P1 and P2: parametric form L(s) = P1 + s·(P2 - P1)
3. The third scale is at x = x3 (for vertical scales). Find s such that L(s).x = x3, then y3 = L(s).y
4. Invert y3 → value using the scale function and range
5. Check if value ∈ [scale3.min, scale3.max]; if not, return {error: 'out-of-range'}

**Algorithm (Z-chart):**
1. Two vertical scales, one diagonal scale
2. Compute P1, P2 on their scales
3. The line through P1 and P2 is L(s) = P1 + s·(P2 - P1)
4. The diagonal scale is parameterized as D(t) for t ∈ [0, 1]
5. Solve for s, t such that L(s) = D(t) (two equations, two unknowns)
6. Use bracketed bisection on t: at each candidate t, compute D(t), find intersection with line L, check if collinear
7. Convergence tolerance: |f(t)| < 1e-10 · range_length

**Degenerate cases:**
- If P1 ≈ P2, return error (no unique line)
- If line is parallel to third scale, return error (no intersection)

---

### certificate.js

**Exports:**
```javascript
/**
 * Generate an accuracy certificate for a nomogram.
 * @param {Layout} layout
 * @param {ChartDefinition} chart
 * @param {number} deltaMm - Straightedge placement error (default 0.5)
 * @returns {Certificate}
 */
export function generateCertificate(layout, chart, deltaMm);

/**
 * @typedef {object} Certificate
 * @property {number} maxError - Maximum error (absolute or relative %)
 * @property {string} errorType - 'absolute' | 'relative'
 * @property {string} units - Output variable units
 * @property {number} gridSize - Number of sample points (e.g., 1681)
 * @property {number} perturbations - Total perturbation tests (gridSize × 4)
 * @property {string} sentence - Human-readable certificate for title block
 */
```

**Algorithm:**
1. Define a uniform grid: 41 steps in u, 41 steps in v → 1,681 (u, v) pairs
2. For each pair (u_i, v_j):
   - Compute w_true = chart.evaluate(u_i, v_j)
   - Compute geometric positions: P1 = pointOnScale(u_i), P2 = pointOnScale(v_j), P3 = pointOnScale(w_true)
   - Apply 4 perturbations: (P1 + δ1, P2 + δ2) for δ1, δ2 ∈ {-delta, +delta} along each scale direction
   - For each perturbed (P1', P2'), use readThirdScale to find w_perturbed
   - If w_perturbed is out-of-range, skip that perturbation
   - Compute error:
     - Linear output: error = |w_perturbed - w_true|
     - Log output: error = |log(w_perturbed) - log(w_true)| → convert to relative % = 100·|w_perturbed/w_true - 1|
   - Track max_error across all perturbations
3. Apply safety factor: certified_error = 1.1 × max_error
4. Format sentence: "Straightedge placement within ±0.5 mm yields results accurate to within [certified_error] [units or %]."

**Edge cases:**
- If any sample point produces w_true outside the output range, skip it (invalid)
- If > 10% of samples are invalid, return a warning in the certificate

---

### svg.js

**Exports:**
```javascript
/**
 * Render a nomogram as an SVG string.
 * @param {Layout} layout
 * @param {ChartDefinition} chart
 * @param {Certificate} certificate
 * @param {{p1: {scale: number, value: number}, p2: {scale: number, value: number}} | null} straightedge - Optional line to draw
 * @returns {string} SVG markup
 */
export function renderSVG(layout, chart, certificate, straightedge);
```

**Structure:**
```xml
<svg width="210mm" height="297mm" viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg">
  <style>
    /* System fonts, tabular numerals, palette colors */
  </style>
  <rect fill="#f4f1ea" width="210" height="297" /> <!-- Background -->
  
  <!-- Each scale -->
  <g class="scale" data-scale="0">
    <line class="scale-line" ... stroke="#1f1e1c" stroke-width="0.5" />
    <g class="ticks">
      <line class="tick major" ... />
      <text class="tick-label" ...>value</text>
    </g>
    <text class="scale-label" ...>variable name [units]</text>
  </g>
  
  <!-- Straightedge line (if provided) -->
  <line class="straightedge" ... stroke="#c43c25" stroke-width="1" />
  
  <!-- Calibration bar (inside title block, bottom of sheet) -->
  <g class="calibration" transform="translate(55, 262)">
    <line x1="0" y1="0" x2="100" y2="0" stroke="#1f1e1c" stroke-width="0.5" />
    <line x1="0" y1="-2" x2="0" y2="2" ... />
    <line x1="100" y1="-2" x2="100" y2="2" ... />
    <text x="50" y="8" text-anchor="middle">100 mm</text>
  </g>
  
  <!-- Title block (bottom 42 mm reserved area) -->
  <g class="title-block" transform="translate(15, 255)">
    <rect width="180" height="42" fill="none" stroke="#1f1e1c" stroke-width="0.5" />
    <text class="title" x="5" y="10">Formula Title</text>
    <text class="formula" x="5" y="18">w = f(u, v)</text>
    <text class="ranges" x="5" y="26">u: min..max [units]; v: ...</text>
    <text class="certificate" x="5" y="34">Accuracy: ...</text>
    <text class="date" x="170" y="10" text-anchor="end">2026-11-04</text>
    <text class="mark" x="170" y="38" text-anchor="end">Isopleth</text>
  </g>
</svg>
```

**Font stack:** `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-variant-numeric: tabular-nums;`

**Label positioning:**
- For vertical scales: labels offset 3 mm to the right (or left, depending on which side)
- Ensure all text bounding boxes fit within [0, 210] × [0, 297]
- Truncate or abbreviate if necessary (e.g., scientific notation for very large/small numbers)

**Hairline rules:** Use stroke-width="0.25" for scale lines (0.25 mm), "0.2" for major ticks (0.2 mm), and "0.15" for minor ticks (0.15 mm) when printed at true scale.

---

### examples.js

**Exports:**
```javascript
/**
 * @typedef {object} Example
 * @property {string} name
 * @property {string} formula
 * @property {Record<string, [number, number]>} ranges
 * @property {'parallel' | 'z'} layout
 * @property {string} description
 */

/**
 * Get all built-in examples.
 * @returns {Example[]}
 */
export function getExamples();
```

**Example list:**
1. **Ohm's Law**
   - Formula: `V = I * R`
   - Ranges: `{I: [0.01, 10], R: [1, 1000]}` (units: A, Ω)
   - Layout: parallel (product form, log scales)
   - Description: "Voltage from current and resistance"

2. **Body Surface Area (Mosteller)**
   - Formula: `BSA = sqrt(height * weight / 3600)`
   - Ranges: `{height: [100, 210], weight: [10, 150]}` (units: cm, kg; BSA in m²)
   - Layout: parallel (product with outer sqrt)
   - Description: "BSA for dosing calculations"

3. **Right-Triangle Hypotenuse**
   - Formula: `c = sqrt(a^2 + b^2)`
   - Ranges: `{a: [0.1, 10], b: [0.1, 10]}`
   - Layout: parallel (sum with outer sqrt)
   - Description: "Pythagorean theorem"

4. **Reynolds Number**
   - Formula: `Re = v * D / 1.5e-5`
   - Ranges: `{v: [0.1, 10], D: [0.01, 0.5]}` (units: m/s, m; kinematic viscosity of air ≈ 1.5e-5 m²/s at 20°C)
   - Layout: parallel (product, log scales)
   - Description: "Flow regime in air"

5. **Axial Stress (Z-chart)**
   - Formula: `sigma = 1000 * F / A`
   - Ranges: `{F: [0.1, 50], A: [50, 500]}` (units: kN, mm²; sigma in MPa; 1000 factor converts kN/mm² to MPa)
   - Layout: z
   - Description: "Stress from force and area"

---

## MCP Server Design

**File:** `mcp/server.mjs`

**Protocol:** JSON-RPC 2.0 over stdio, MCP version `2024-11-05`.

**Methods:**

### initialize
Request:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "kiro", "version": "1.0"}
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {}},
    "serverInfo": {"name": "isopleth-nomogram", "version": "1.0.0"}
  }
}
```

### tools/list
Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [{
      "name": "make_nomogram",
      "description": "Compile a formula into a printable nomogram with accuracy certificate",
      "inputSchema": {
        "type": "object",
        "properties": {
          "formula": {"type": "string", "description": "Equation with one '=' (e.g., 'V = I * R')"},
          "ranges": {"type": "object", "description": "Variable ranges {var: [min, max]}"},
          "layout": {"type": "string", "enum": ["parallel", "z"], "default": "parallel"},
          "deltaMm": {"type": "number", "default": 0.5, "description": "Straightedge error (mm)"},
          "outFile": {"type": "string", "description": "Optional: write SVG to this path"}
        },
        "required": ["formula", "ranges"]
      }
    }]
  }
}
```

### tools/call
Request:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "make_nomogram",
    "arguments": {
      "formula": "V = I * R",
      "ranges": {"I": [0.01, 10], "R": [1, 1000]},
      "layout": "parallel",
      "deltaMm": 0.5
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "Nomogram: V = I * R\n\nAccuracy Certificate:\nStraightedge placement within ±0.5 mm yields results accurate to within 2.3% of true value.\n\nVerification:\n- Grid sampling: 1,681 points (41 × 41)\n- Perturbation tests: 6,724\n- Maximum reading error: 2.1% (with 1.1× safety factor: 2.3%)\n\n--- SVG ---\n<svg width=\"210mm\" height=\"297mm\" ...>...</svg>"
    }],
    "isError": false
  }
}
```

Error response:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Unsupported formula form. Supported: sum, product, outer function, Z-chart."
  }
}
```

**Implementation notes:**
- Import core modules: `expr.js`, `compile.js`, `scales.js`, `layout.js`, `reader.js`, `certificate.js`, `svg.js`
- All modules use `.js` extensions (ES modules)
- Use `node --input-type=module` or `.mjs` extension for Node compatibility
- Read from stdin line-by-line, parse JSON-RPC, dispatch to handlers
- Write JSON-RPC responses to stdout
- Stderr for internal logging only (not part of MCP protocol)

---

## Correctness Properties

These properties validate the requirements and are implemented as property-based tests using fast-check.

### P1: Collinearity of Solution Points (Parallel Layout)
**Validates:** R4.5, P11  
**Property:** FOR all valid input ranges and scale functions in parallel layout, the computed points P1(u), P2(v), P3(w) satisfy the collinearity determinant |det[[x1,y1,1],[x_m,y3,1],[x2,y2,1]]| ≤ 1e-9 × (layout width × usable height).  
**Generator:** `fc.record({u: fc.double({min: u_min, max: u_max}), v: fc.double({min: v_min, max: v_max})})`  
**Check:** Compute three points, compute determinant, assert absolute value ≤ tolerance.

### P2: Collinearity of Solution Points (Z-Chart Layout)
**Validates:** R4.6, P11  
**Property:** FOR all valid input ranges in Z-chart layout, the computed points P1(u), P2(v), P3(w) are collinear within numerical tolerance.  
**Generator:** Similar to P1, but for Z-chart geometry  
**Check:** Determinant test for Z-chart coordinate system.

### P3: Round-trip formula parsing
**Validates:** R1.5, R1.1  
**Property:** FOR all valid expressions, parse(tokenize(source)) then print(ast) produces a mathematically equivalent expression.  
**Generator:** `fc.oneof(fc.double(), fc.constantFrom('x', 'y', 'z'), arbitraryBinop(), arbitraryCall())`  
**Check:** Evaluate both the original and round-tripped AST with random bindings; results must match within floating-point epsilon.

### P4: Scale monotonicity
**Validates:** R3.3, P2  
**Property:** FOR all scale functions and value pairs v1 < v2 in range, scaleValue(v1) < scaleValue(v2).  
**Generator:** `fc.tuple(fc.double({min: 1, max: 100}), fc.double({min: 101, max: 1000}))` for linear; similar for log (positive values only)  
**Check:** Apply scaleValue to both, assert position1 < position2.

### P5: Reader correctness and numerical tolerance
**Validates:** R5.1, R5.2, P1, P12  
**Property:** FOR all valid (u, v) in ranges, readThirdScale(u, v) produces w such that chart.evaluate(u, v) ≈ w within numerical tolerance (relative error ≤ 1e-6).  
**Generator:** `fc.record({u: fc.double({min: u_min, max: u_max}), v: fc.double({min: v_min, max: v_max})})`  
**Check:** w_true = evaluate(u, v); w_read = readThirdScale(..., u, v); assert |w_read - w_true| / w_true < 1e-6 (or absolute error ≤ 1e-9 · scale_span near zero).

### P6: Tick spacing
**Validates:** R3.4, R3.5, P5  
**Property:** FOR all generated tick lists, consecutive labeled ticks are separated by ≥ 3 mm.  
**Generator:** Arbitrary scale ranges and lengths  
**Check:** Filter ticks with non-empty labels; compute pairwise distances; assert all ≥ 3 mm.

### P7: Layout bounds
**Validates:** R4.9, P6  
**Property:** FOR all layouts, all scale lines, tick positions, and label bounding boxes lie within [15, 195] × [15, 240] (accounting for margins and title block).  
**Generator:** Arbitrary chart definitions  
**Check:** Compute bounding box of all rendered elements; assert within bounds.

### P8: Certificate zero-delta property
**Validates:** R6.1, P8  
**Property:** IF deltaMm = 0, THEN maxError = 0.  
**Generator:** Arbitrary chart definitions  
**Check:** Run certificate generation with delta = 0; assert maxError ≈ 0 (within numerical tolerance 1e-12).

### P9: SVG well-formedness
**Validates:** R7.1, P7  
**Property:** FOR all generated SVGs, the output is well-formed XML and viewBox matches physical dimensions.  
**Generator:** Arbitrary chart definitions  
**Check:** Parse with an XML parser (DOMParser in Node or a library); assert no parse errors; extract viewBox attribute; assert "0 0 210 297".

### P10: Compiler determinism
**Validates:** R2.2, P3  
**Property:** FOR all recognized formulas, compiling twice produces identical chart definitions.  
**Generator:** Arbitrary formula strings in supported forms  
**Check:** compile(ast1) → chart1, compile(ast1) → chart2; assert deep equality (functions compared by evaluating on test points).

### P11: Evaluator consistency
**Validates:** R1.4, P10  
**Property:** FOR all compiled charts, chart.evaluate(u, v) equals evaluate(original_ast, {u, v}).  
**Generator:** Arbitrary valid formulas and random (u, v) in ranges  
**Check:** w1 = chart.evaluate(u, v); w2 = evaluate(ast, {u, v}); assert |w1 - w2| < 1e-10.

### P12: Reader convergence
**Validates:** R5.3, P9  
**Property:** FOR all valid inputs, readThirdScale converges within 100 iterations (tolerance 1e-10).  
**Generator:** Arbitrary (u, v) in ranges  
**Check:** Instrument readThirdScale to count iterations; assert count ≤ 100.

---

## Error Handling

All user-facing errors are typed objects:
```javascript
{error: string, pos?: number, context?: object}
```

**Categories:**
1. **Parse errors:** `{error: "Unexpected token '+' at position 12", pos: 12}`
2. **Compile errors:** `{error: "Unsupported form. Supported: ...", context: {ast}}`
3. **Domain errors:** `{error: "sqrt of negative value", context: {value: -5}}`
4. **Out-of-range errors:** `{error: "out-of-range", context: {value: 123, range: [0, 100]}}`
5. **Geometric errors:** `{error: "No intersection (parallel lines)"}`

**Never:**
- Throw exceptions for user input errors
- Return `null`, `undefined`, `NaN`, or `Infinity` as success values
- Silently clamp or extrapolate

---

## Data Flow Example

**Input:**
```javascript
{
  formula: "V = I * R",
  ranges: {I: [0.01, 10], R: [1, 1000]},
  layout: "parallel",
  deltaMm: 0.5
}
```

**Step 1: Parse (expr.js)**
```javascript
tokens = tokenize("V = I * R");
{lhs: "V", rhs: "I * R"}
ast = parse(tokenize("I * R"));
// {kind: 'binop', op: '*', left: {kind: 'identifier', name: 'I'}, right: {kind: 'identifier', name: 'R'}}
```

**Step 2: Compile (compile.js)**
Recognize product form: `V = I * R` → `log(V) = log(I) + log(R)`.
```javascript
chart = {
  form: 'product',
  scales: [
    {name: 'I', fn: (x) => Math.log10(x), range: [0.01, 10], scaleKind: 'log'},
    {name: 'R', fn: (x) => Math.log10(x), range: [1, 1000], scaleKind: 'log'},
    {name: 'V', fn: (x) => Math.log10(x), range: [0.01, 10000], scaleKind: 'log'}
  ],
  evaluate: (I, R) => I * R,
  formula: "V = I * R"
}
```

**Step 3: Ticks (scales.js)**
For I: decades at 0.01, 0.1, 1, 10 → 4 major ticks.  
For R: decades at 1, 10, 100, 1000 → 4 major ticks.  
Minors: 2, 3, ..., 9 within each decade (if space permits).

**Step 4: Layout (layout.js)**
Parallel layout: three vertical scales at x = 35, 105, 175 mm; y from 20 to 235 mm.  
Modulus: available height = 215 mm; log(10/0.01) = 3 decades → 215/3 ≈ 71.7 mm per decade.

**Step 5: Certificate (certificate.js)**
Grid: 41 × 41 = 1,681 (I, R) pairs.  
For each: compute V_true = I·R, perturb I and R by ±0.5 mm along their scales, read V_perturbed, compute relative error.  
Max error ≈ 2.1%, with safety factor → 2.3%.

**Step 6: SVG (svg.js)**
Render three scales, ticks, labels, calibration bar (100 mm horizontal at top), title block (formula, ranges, "±0.5 mm → 2.3%", date).

**Output:**
- Text: certificate sentence + verification summary (1,681 points, 6,724 tests, 2.3% max error)
- SVG: 210 × 297 mm printable sheet

---

## Testing Strategy

### Unit tests (node:test)
- `expr.test.js`: tokenize, parse, evaluate, print for known formulas
- `compile.test.js`: recognize each supported form, reject unsupported forms
- `scales.test.js`: tick generation for linear/log, label thinning
- `layout.test.js`: parallel and Z-chart geometry, bounds checking
- `reader.test.js`: read third scale for known (u, v) pairs
- `certificate.test.js`: zero-delta property, grid sampling logic
- `svg.test.js`: well-formed XML, viewBox correctness, palette colors

### Property tests (fast-check)
- `expr.property.test.js`: P1 (round-trip)
- `compile.property.test.js`: P8 (determinism), P9 (evaluator consistency)
- `scales.property.test.js`: P2 (monotonicity), P4 (tick spacing)
- `layout.property.test.js`: P5 (bounds)
- `reader.property.test.js`: P3 (correctness), P10 (convergence)
- `certificate.property.test.js`: P6 (zero-delta)
- `svg.property.test.js`: P7 (well-formedness)

### Integration test
- `integration.test.js`: Full pipeline for each example in examples.js; verify SVG output is non-empty and certificate is present.

### MCP server test
- Manual: call `make_nomogram` via MCP client, verify response format and SVG validity.
- Automated: mock stdin/stdout, send JSON-RPC requests, assert responses match schema.

---

## Design Principles

1. **DOM-free core:** All modules work in Node and browser. No `document`, `window`, or browser APIs in core.
2. **Millimetre geometry:** All spatial calculations use mm. SVG viewBox is 1:1 with physical dimensions.
3. **Explicit errors:** Return typed error objects, never throw for user input.
4. **Property-driven testing:** Universal statements in requirements become fast-check properties.
5. **Honest accuracy:** Certificate reports real measured error, not a marketing claim.
6. **Offline-first:** No network requests, no CDN dependencies, no web fonts.
7. **Single-pass layout:** Compute geometry once; no iterative layout solvers (for v1).
