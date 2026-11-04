---
inclusion: always
---

# Isopleth Product Vision

## What is Isopleth?

Isopleth compiles a formula into a paper calculator: a printable nomogram (alignment chart) that works with a straightedge and no electricity. Nomograms were standard in engineering, aviation, medicine and clinics from 1884 until calculators replaced them in the 1970s.

## Core Flow

1. **Input:** User types a formula + variable ranges (e.g., `BSA = sqrt(height * weight / 3600)`)
2. **Recognition:** Compiler identifies a separable form (sum, product, outer function, Z-chart)
3. **Layout:** Three-scale alignment chart drawn on an A4 sheet in millimetres
4. **Interaction:** Interactive straightedge — drag two scale handles, read the third value
5. **Export:** Print or export at true scale (SVG in mm with 100 mm calibration bar and title block)
6. **Certificate:** Every chart carries an accuracy certificate: worst-case reading error from ±0.5 mm straightedge placement (configurable), verified by property tests

## Users

- Field engineers and technicians (surveying, utilities, aviation)
- Teachers and students (physics, math, engineering)
- Clinic staff (printing reference charts, dosing scales)
- Makers and DIY engineers

The printed chart works offline, without any device or internet.

## Supported Forms (v1)

### Sum Form: w = c + A(u) + B(v)
Parallel scales (left, middle, right) with linear or outer function applied.

### Product Form: w = k · A(u) · B(v)
Logarithmic parallel scales (log of each factor).

### Outer Functions
Apply sqrt, x^p, exp, ln, log10 to a sum or product form.

### Z-Chart (Linear Ratio)
w = k·u/v or w = k·u·v with linear scales arranged on two sides and a diagonal.

**Not Supported:** Curved scales, four-variable chained charts, or forms that cannot be written in these shapes. The compiler returns a clear message listing the supported forms.

## Example Gallery

- **Ohm's law:** V = I · R (product, logarithmic parallel scales)
- **Body surface area (Mosteller):** BSA = √(height · weight / 3600) (product with outer sqrt)
- **Right triangle:** c = √(a² + b²) (outer sqrt of a sum)
- **Reynolds-style ratio:** Re = v·D/ν (Z-chart, ν fixed as a slider)

## Design Language

**Aesthetic:** Restrained engineering-drafting style, leaning Japanese minimal. The printed nomogram is the hero.

**Palette:**
- Off-white paper: #f4f1ea
- Sumi ink (text, rules, scales): #1f1e1c
- Vermilion accent (straightedge/isopleth line, active value highlight): #c43c25

**Elements:**
- Hairline rules, generous whitespace
- Tabular numerals (monospaced numbers, constant width)
- System fonts only (no web-font downloads)
- No gradients, drop shadows, emoji, Halloween decoration, or generic AI landing-page hero layouts

**Title block:** Drafting-style box with formula, ranges, accuracy statement, sheet size, and calibration bar.

## Honesty

- Never claim medical-device or certified-instrument status
- Charts are decision aids; state their own accuracy on every print
- Accuracy certificate shows worst-case reading error under stated straightedge placement tolerance
- Out-of-range inputs return explicit errors, not silent clamping

## Non-Goals (v1)

- Curved scales
- Four-variable chained charts
- Accounts, backend, analytics
- Generic "AI-powered" branding or marketing
