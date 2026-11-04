# Nomogram Engine Requirements

## Overview

The nomogram engine is the DOM-free computational core of Isopleth. It compiles a formula string and variable ranges into a verified, printable three-scale alignment chart (nomogram) with a stated accuracy certificate.

## Scope

The engine comprises eight core modules (expr, compile, scales, layout, reader, certificate, svg, examples) plus an MCP server that exposes the complete pipeline as a tool for agent use.

---

## R1: Expression Language (expr.js)

**R1.1** WHEN a user provides a formula string, THE SYSTEM SHALL parse it into an abstract syntax tree supporting:
- **R1.1.1** Numeric literals including scientific notation (e.g., `1e-3`, `2.5`, `0.001`)
- **R1.1.2** Identifiers consisting of letters, digits, underscores, and Greek letters (e.g., `alpha`, `x1`, `sigma_max`)
- **R1.1.3** Binary operators: `+`, `-`, `*`, `/`, `^` (exponentiation)
- **R1.1.4** Unary minus (e.g., `-x`)
- **R1.1.5** Parentheses for grouping
- **R1.1.6** Functions: `sqrt`, `ln`, `log10`, `exp`, `abs`, `sin`, `cos`, `tan`
- **R1.1.7** Constants: `pi`, `e`

**R1.2** WHEN a formula contains exactly one `=` symbol, THE SYSTEM SHALL separate a single output variable on the left from the expression on the right.

**R1.3** WHEN a parse error occurs, THE SYSTEM SHALL return a typed error carrying the character position of the error.

**R1.4** WHEN given an AST and variable bindings, THE SYSTEM SHALL evaluate the expression to a numeric result.

**R1.5** WHEN given an AST, THE SYSTEM SHALL print it back to infix notation for display.

**R1.6** THE SYSTEM SHALL detect division by zero and return an error rather than Infinity or NaN.

**R1.7** THE SYSTEM SHALL detect domain errors (e.g., sqrt of negative, ln of non-positive) and return an error rather than NaN.

---

## R2: Compiler (compile.js)

**R2.1** WHEN a formula contains exactly two input variables, THE SYSTEM SHALL recognize one of the following separable forms:

**R2.1.1** Sum form: `w = c + a*A(u) + b*B(v)` where A and B are univariate scale functions and c, a, b are constants.

**R2.1.2** Product form: `w = k * A(u)^p * B(v)^q` where A, B are univariate scale functions with positive ranges, k is a constant, and p, q are non-zero real exponents (including negative, e.g., V/I becomes I^-1 in log form).

**R2.1.3** Outer function form: `w = F(inner)` where F is one of {sqrt, ^p, exp, ln, log10} and inner is a sum or product form.

**R2.1.4** Z-chart form: `w = k*u/v` (linear ratio) when the user selects the Z layout option.

**R2.2** WHEN a formula is recognized, THE SYSTEM SHALL return a chart definition containing:
- **R2.2.1** Three scale functions f1(u), f2(v), f3(w)
- **R2.2.2** Input variable ranges (u_min, u_max), (v_min, v_max)
- **R2.2.3** Computed output range (w_min, w_max) derived from the input ranges
- **R2.2.4** Scale kind for each scale (linear or logarithmic)
- **R2.2.5** A direct evaluator function f(u, v) -> w
- **R2.2.6** Variable names and optional units

**R2.3** WHEN a formula does not match any supported form, THE SYSTEM SHALL return a typed error listing the supported forms.

**R2.4** WHEN a formula has fewer or more than two input variables, THE SYSTEM SHALL return a typed error.

**R2.5** WHEN a product form involves negative values in the range, THE SYSTEM SHALL return a typed error stating that logarithmic scales require positive ranges.

---

## R3: Scales and Ticks (scales.js)

**R3.1** WHEN computing tick marks for a linear scale, THE SYSTEM SHALL generate "nice" major and minor ticks using 1-2-5 step sequences.

**R3.2** WHEN computing tick marks for a logarithmic scale, THE SYSTEM SHALL generate major ticks at decade boundaries and minor ticks at 1, 2, 3, 4, 5, 6, 7, 8, 9 within each decade.

**R3.3** THE SYSTEM SHALL ensure tick positions are strictly monotone (increasing or decreasing consistently along the scale direction).

**R3.4** WHEN labeling ticks, THE SYSTEM SHALL enforce a minimum spacing of 3 mm between labeled tick marks.

**R3.5** WHEN tick labels would collide, THE SYSTEM SHALL thin out labels by removing intermediate labels until the minimum spacing is satisfied.

**R3.6** WHEN generating tick labels, THE SYSTEM SHALL format numbers appropriately for their magnitude (scientific notation for very small or large values, fixed-point otherwise).

**R3.7** THE SYSTEM SHALL include the scale endpoints as labeled ticks unless they would violate the spacing constraint with an adjacent label.

---

## R4: Layout (layout.js)

**R4.1** WHEN laying out a nomogram, THE SYSTEM SHALL use A4 portrait dimensions: 210 mm width × 297 mm height.

**R4.2** THE SYSTEM SHALL apply 15 mm margins on all sides of the sheet.

**R4.3** THE SYSTEM SHALL reserve a title block area at the bottom with height 42 mm.

**R4.4** THE SYSTEM SHALL compute geometry using SVG coordinates where the y-axis points down (y increases downward).

**R4.5** WHEN using parallel layout, THE SYSTEM SHALL position three vertical scales at computed x-coordinates within the available width.

**R4.6** WHEN using Z-chart layout, THE SYSTEM SHALL position two vertical scales on opposite sides and compute the diagonal scale geometry.

**R4.7** FOR each scale, THE SYSTEM SHALL return:
- **R4.7.1** A function mapping value -> point coordinates (x, y) in millimetres
- **R4.7.2** A tick list with positions in millimetres and labels
- **R4.7.3** The physical extent of the scale (start and end coordinates)

**R4.8** THE SYSTEM SHALL compute moduli (scale factors) to maximize the use of available drawing area while maintaining geometric correctness.

**R4.9** THE SYSTEM SHALL ensure all scale marks, labels, and lines fit within the margins and do not overlap the title block.

---

## R5: Reader (reader.js)

**R5.1** WHEN given values on any two of the three scales, THE SYSTEM SHALL compute the corresponding value on the third scale.

**R5.2** THE SYSTEM SHALL find the third value by solving the collinearity constraint: the straightedge line through the two known points intersects the third scale.

**R5.3** THE SYSTEM SHALL find the third value by solving the collinearity constraint: the straightedge line through the two known points intersects the third scale with numerical tolerance (relative error ≤ 1e-6, or absolute error ≤ 1e-9 mm when scale span approaches zero).

**R5.4** WHEN the solution lies outside the valid scale range, THE SYSTEM SHALL return a typed error `{error: 'out-of-range'}`.

**R5.5** THE SYSTEM SHALL never extrapolate beyond the defined scale ranges.

**R5.6** THE SYSTEM SHALL export a helper function `pointOnScale(chart, whichScale, value)` that returns coordinates for a given value on a specified scale.

**R5.7** THE SYSTEM SHALL export a helper function `valueAtPoint(chart, whichScale, point)` that returns the value corresponding to a point on a specified scale.

**R5.8** WHEN reading fails due to geometric degeneracy (e.g., parallel lines), THE SYSTEM SHALL return a typed error.

---

## R6: Accuracy Certificate (certificate.js)

**R6.1** WHEN generating an accuracy certificate, THE SYSTEM SHALL accept a straightedge placement error delta in millimetres (default 0.5 mm).

**R6.2** THE SYSTEM SHALL sample a uniform grid of 41 × 41 input pairs (u, v) spanning the input ranges.

**R6.3** FOR each grid point, THE SYSTEM SHALL:
- **R6.3.1** Compute the true output value w_true = f(u, v)
- **R6.3.2** Compute the geometric positions of all three values on their scales
- **R6.3.3** Perturb the positions of the two input scales by ±delta mm in all sign combinations (4 perturbations)
- **R6.3.4** For each perturbation, use the reader to find the perturbed output value w_perturbed
- **R6.3.5** Compute the error: absolute error for linear output scales, relative error for logarithmic output scales

**R6.4** THE SYSTEM SHALL report the maximum error found across all grid points and all perturbations.

**R6.5** THE SYSTEM SHALL apply a safety factor of 1.1 to the maximum error.

**R6.6** THE SYSTEM SHALL report the grid dimensions used (41 × 41 = 1,681 points, 6,724 perturbation tests).

**R6.7** WHEN the output scale is linear, THE SYSTEM SHALL report maximum absolute error in output units.

**R6.8** WHEN the output scale is logarithmic, THE SYSTEM SHALL report maximum relative error as a percentage.

**R6.9** THE SYSTEM SHALL format the certificate as a human-readable sentence suitable for inclusion in the title block.

---

## R7: SVG Generation (svg.js)

**R7.1** WHEN generating an SVG, THE SYSTEM SHALL set the root element attributes:
- **R7.1.1** `width="210mm"`
- **R7.1.2** `height="297mm"`
- **R7.1.3** `viewBox="0 0 210 297"` (1 user unit = 1 mm)

**R7.2** THE SYSTEM SHALL render for each scale:
- **R7.2.1** A scale line (vertical or diagonal as appropriate)
- **R7.2.2** Major and minor tick marks at their computed positions
- **R7.2.3** Tick labels at positions that respect the minimum spacing
- **R7.2.4** The variable name and units near the scale

**R7.3** THE SYSTEM SHALL include a 100 mm calibration bar with end markers and the label "100 mm".

**R7.4** THE SYSTEM SHALL include a drafting title block in the reserved area containing:
- **R7.4.1** Chart title (derived from the formula)
- **R7.4.2** The formula in infix notation
- **R7.4.3** Variable ranges with units
- **R7.4.4** The accuracy certificate sentence
- **R7.4.5** The current date
- **R7.4.6** The "Isopleth" mark

**R7.5** THE SYSTEM SHALL use the palette defined in product steering:
- **R7.5.1** Background: off-white `#f4f1ea`
- **R7.5.2** Lines, text, scales: sumi ink `#1f1e1c`
- **R7.5.3** Straightedge line and active value highlight: vermilion `#c43c25`

**R7.6** THE SYSTEM SHALL use system fonts only (no web font downloads).

**R7.7** THE SYSTEM SHALL use tabular numerals (monospace numbers) for all numeric labels.

**R7.8** THE SYSTEM SHALL ensure all labels fit within the sheet boundaries and do not overflow.

**R7.9** WHEN rendering an optional straightedge line, THE SYSTEM SHALL draw a line connecting two specified points and extending to the third scale in the vermilion accent color.

**R7.10** THE SYSTEM SHALL render hairline rules for scale lines (0.25 mm stroke), major ticks (0.2 mm), and minor ticks (0.15 mm).

---

## R8: Examples (examples.js)

**R8.1** THE SYSTEM SHALL provide at least five built-in example formulas demonstrating different chart types:

**R8.1.1** Ohm's law: `V = I * R` with ranges I: 0.01..10 A, R: 1..1000 Ω (product form, logarithmic scales)

**R8.1.2** Body surface area (Mosteller): `BSA = sqrt(height * weight / 3600)` with ranges height: 100..210 cm, weight: 10..150 kg (product with outer sqrt)

**R8.1.3** Right-triangle hypotenuse: `c = sqrt(a^2 + b^2)` with ranges a: 0.1..10, b: 0.1..10 (outer sqrt of sum)

**R8.1.4** Reynolds number: `Re = v * D / 1.5e-5` with ranges v: 0.1..10 m/s, D: 0.01..0.5 m (product form, logarithmic scales)

**R8.1.5** Axial stress (Z-chart): `sigma = 1000 * F / A` with ranges F: 0.1..50 kN, A: 50..500 mm², sigma in MPa (Z-chart layout)

**R8.2** FOR each example, THE SYSTEM SHALL validate that the formula, ranges, and expected layout are compatible.

**R8.3** THE SYSTEM SHALL adjust ranges if needed to ensure every example produces a valid nomogram.

---

## R9: MCP Server (mcp/server.mjs)

**R9.1** THE SYSTEM SHALL implement an MCP server using stdio transport and JSON-RPC 2.0 protocol.

**R9.2** THE SYSTEM SHALL declare MCP protocol version `2024-11-05`.

**R9.3** THE SYSTEM SHALL implement the following MCP methods:
- **R9.3.1** `initialize`: server capability negotiation
- **R9.3.2** `tools/list`: return the list of available tools
- **R9.3.3** `tools/call`: execute a named tool with provided arguments

**R9.4** THE SYSTEM SHALL provide one tool named `make_nomogram` with the following input schema:
- **R9.4.1** `formula` (required, string): the equation to compile
- **R9.4.2** `ranges` (required, object): a map from variable names to `[min, max]` arrays
- **R9.4.3** `layout` (optional, enum: 'parallel' | 'z', default 'parallel'): chart layout style
- **R9.4.4** `deltaMm` (optional, number, default 0.5): straightedge placement error in millimetres
- **R9.4.5** `outFile` (optional, string): workspace-relative path to write the SVG file

**R9.5** WHEN `make_nomogram` is called, THE SYSTEM SHALL:
- **R9.5.1** Parse the formula using expr.js
- **R9.5.2** Compile the formula using compile.js
- **R9.5.3** Compute layout using layout.js
- **R9.5.4** Generate the accuracy certificate using certificate.js
- **R9.5.5** Generate the SVG using svg.js
- **R9.5.6** Return text content containing the certificate, verification summary (grid size, number of checks), and the SVG string

**R9.6** WHEN `outFile` is provided, THE SYSTEM SHALL write the SVG to the specified path within the workspace root.

**R9.7** WHEN an error occurs at any stage, THE SYSTEM SHALL return a JSON-RPC error response with an informative message.

**R9.8** THE SYSTEM SHALL include verification metrics in the output:
- **R9.8.1** Number of grid sample points
- **R9.8.2** Number of perturbation tests performed
- **R9.8.3** Maximum reading error found

**R9.9** THE SYSTEM SHALL register the MCP server in `.kiro/settings/mcp.json` with:
- **R9.9.1** Server name: `isopleth-nomogram`
- **R9.9.2** Command: `node`
- **R9.9.3** Arguments: `["mcp/server.mjs"]`
- **R9.9.4** Working directory: workspace root

---

## Universal Properties

**P1** FOR all valid inputs, the reader SHALL produce values that satisfy the original formula within the stated accuracy tolerance.

**P2** FOR all scale functions, IF value1 < value2 THEN the position of value1 SHALL be distinct from the position of value2 (strict monotonicity).

**P3** FOR all formulas in the supported forms, the compiler SHALL either return a valid chart definition or a typed error — never undefined, null, or an exception.

**P4** FOR all AST nodes, round-trip parse-then-print SHALL produce a mathematically equivalent expression (may differ in whitespace or redundant parentheses).

**P5** FOR all tick lists, consecutive labeled ticks SHALL be separated by at least 3 mm.

**P6** FOR all geometric layouts, scale lines and labels SHALL lie within the defined margins and SHALL NOT overlap the title block area.

**P7** FOR all generated SVGs, the XML SHALL be well-formed and the viewBox coordinates SHALL match the physical dimensions (210 × 297 mm).

**P8** FOR all certificate computations, IF the perturbation delta is zero, THEN the maximum error SHALL be zero.

**P9** FOR all reader invocations with valid in-range inputs, IF the geometric solution exists, THE SYSTEM SHALL converge within 100 iterations.

**P10** FOR all compiled charts, evaluating f(u, v) SHALL produce the same result as evaluating the original parsed formula with bindings {u, v}.

**P11** FOR all layouts (parallel and Z-chart), randomly sampled input pairs (u, v) in range SHALL produce three points P1(u), P2(v), P3(w(u,v)) that satisfy |det[[x1,y1,1],[x2,y2,1],[x3,y3,1]]| ≤ 1e-9 × (sheet width × sheet height) (collinearity to numerical tolerance).

**P12** FOR all certificate computations, when the straightedge is perturbed by ±delta_mm in all combinations along the two known scale points, the reading error on the third scale never exceeds the certificate's maxError multiplied by 1.1 safety factor (soundness).
