---
inclusion: fileMatch
fileMatchPattern: ["src/core/**/*.js", "test/**/*.js", "mcp/**/*"]
---

# Nomography Mathematics

Use these proven mathematical foundations for all layout, reader, and certificate computations.

## Collinearity Constraint

Three points are collinear iff the determinant is zero:

```
det [[x1, y1, 1],
     [x2, y2, 1],
     [x3, y3, 1]] = 0
```

This expands to:
```
x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2) = 0
```

Use this to solve for an unknown coordinate when two points and their scale functions are known.

## Parallel Scales for Sum Form: w = c + A(u) + B(v)

**Three vertical (parallel) scales:**
- Left scale (x=0): y₁ = offset₁ + m₁ · A(u)
- Middle scale (x=x_m): y₃ = offset₃ + m₃ · (w − c) = offset₃ + m₃ · (A(u) + B(v))
- Right scale (x=D): y₂ = offset₂ + m₂ · B(v)

**Collinearity constraint:**
For three points to be collinear when x₁=0, x₂=D, x₃=x_m:
```
x_m = D · m₁ / (m₁ + m₂)
```

**Moduli and offsets:**
1. Choose m₁ and m₂ so each outer scale fills the usable height (with top and bottom margins).
2. Compute x_m from the constraint above.
3. The middle modulus is determined by collinearity: m₃ = m₁·m₂/(m₁+m₂).
4. Compute offset₁, offset₂, offset₃ using bottom-aligned offsets: y₁ = b + m₁·(f₁(u) − f₁min), y₂ = b + m₂·(f₂(v) − f₂min), y₃ = b + m₃·(f₃(w) − f₁min − f₂min), where b is the bottom margin position and f₁min, f₂min are the minimum values on each scale.

## Parallel Scales for Product Form: w = k · A(u) · B(v)

**Apply logarithm to each factor; treat as a sum:**

Let f₁(u) = log₁₀(A(u)), f₂(v) = log₁₀(B(v)), f₃(w) = log₁₀(w/k).

Then: f₃(w) = f₁(u) + f₂(v)

**Use the parallel-scale construction with the logarithmic functions.**

Scales are drawn linearly in mm but with logarithmic tick labels.

## Outer Functions

**If the outer form is w = F(inner) where inner is a sum or product:**

1. Recognize the inner form (sum or product).
2. Compute the chart using the inner form with moduli m₁, m₂, m₃.
3. For each output label on the middle scale at position y₃, compute the value w = F⁻¹(inner_value), where F⁻¹ is the inverse of F.

**Supported outer functions:**
- sqrt(x): inverse is x²
- x^p (any rational power): inverse is x^(1/p)
- exp(x): inverse is ln(x)
- ln(x): inverse is exp(x)
- log₁₀(x): inverse is 10^x

## Z-Chart for Linear Ratios: w = k·u/v

**Two scales (left and right) with a diagonal line and a parameter scale.**

For w = k·u/v, define:
- f₁(u) = u (left scale factor)
- f₂(v) = v (right scale factor)
- f₃(w) = w/k (diagonal parameter factor)

The collinearity constraint for f₁(u) = f₂(v)·f₃(w) yields:
- **Left scale (x=0):** y = m₁·f₁(u) = m₁·u
- **Right scale (x=L):** y = H − m₂·f₂(v) = H − m₂·v (runs downward from the top)
- **Diagonal:** from (0, 0) to (L, H)
- **Parameter scale on the diagonal:** point at parameter t along the diagonal (0 ≤ t ≤ 1) is at position (t·L, t·H) and represents w where t = m₁·f₃(w) / (m₁·f₃(w) + m₂)

All scales are linear. All factors f₁, f₂, f₃ must be non-negative on their ranges.

## Reader: Line Through Two Known Points

**Input:** Two known points on their respective scales (u_known, v_known); the ranges and scale functions for all three scales.

**Algorithm:**
1. Compute the coordinates of the two known points using their scale functions.
2. Solve the collinearity constraint for the third coordinate using bracketed root finding (bisection or Brent's method).
3. Invert the scale function to find the output value.
4. Check that the output is within range; report out-of-range instead of extrapolating.

**Tolerance:** Use an explicit absolute tolerance (e.g., 1e-6 mm or tighter for numerical stability).

## Accuracy Certificate

**Input:** Input ranges (u_range, v_range), scale functions, layout (moduli, offsets, scale positions), and a stated straightedge placement error (delta_mm, default ±0.5 mm).

**Algorithm:**
1. **Grid sampling:** Uniformly sample input pairs (u, v) over the ranges (e.g., at least 41×41 grid for a dense sample).
2. **Perturbation:** For each sampled pair, compute the true output w = f(u, v).
3. **Perturb known points:** Move each known point along its scale by ±delta_mm (all sign combinations: 4 pairs).
4. **Read with perturbations:** Use the reader to find the output value for each perturbed pair.
5. **Compute errors:** For each original pair, collect all reading errors across perturbations.
6. **Report:** 
   - **For linear output scales:** maximum absolute error in the output variable's units (not mm), multiplied by 1.1 safety factor
   - **For logarithmic output scales:** maximum relative error as a percentage (%), multiplied by 1.1 safety factor
7. **Report grid size:** e.g., "Tested on a 41×41 grid" (specify the actual grid dimensions used).

## Properties to Verify in Tests

1. **Collinearity:** The three points computed by the layout satisfy the collinearity constraint.
2. **Reader numerical tolerance:** For a random input pair (u, v), the reader output equals f(u, v) within numerical tolerance (relative error ≤ 1e-6, or absolute error ≤ 1e-9 × scale span near zero).
3. **Tick monotonicity:** Tick values are strictly monotone along each scale (no reversals or overlaps).
4. **Printable area:** All scales, ticks, and labels fit within the printable area (accounting for margins).
5. **SVG size:** The SVG viewBox dimensions match the stated sheet size in mm.
6. **Certificate bound:** For random perturbations of input pairs by ±delta_mm, the reading errors never exceed the certificate bound (within the 1.1 safety factor).
7. **Parser round-trip:** For a formula, print it back and parse again; the AST must be structurally identical.
