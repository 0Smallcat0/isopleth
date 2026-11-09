# Isopleth

**Formula → paper calculator.** Isopleth compiles a formula into a nomogram: an A4 alignment chart you print at true scale and use with a ruler. Lay the straightedge across two known values and read the answer where it crosses the third scale. No battery, no screen, no network at the point of use.

Nomograms were invented by Maurice d'Ocagne in 1884 and filled engineering handbooks, flight manuals and clinical references until pocket calculators replaced them. Isopleth brings them back with one thing the originals never had: every chart is checked against its formula by property-based tests, and carries a stated accuracy for a stated straightedge error.

Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Resurrection category).

## Try it

Open the studio (no install, no build, no network calls): serve the repo root with any static server, e.g. `python -m http.server 4719`, and open `http://127.0.0.1:4719/`.

1. Type a formula (`V = I * R`, `BMI = weight / height^2`, `c = sqrt(a^2 + b^2)`) and set each variable's range and unit. The sheet redraws as you type; a parse error points at the character.
2. Drag any two of the vermilion straightedge handles; the one you touched least recently is solved. Arrow keys move a focused handle 1 mm (Shift: 0.1 mm). Under the sheet, the reading is compared with the formula on every move (`straightedge vs formula: relative Δ`).
3. Read the **accuracy certificate**: "with the straightedge within ±0.5 mm of each mark, V reads within ±3 % of the formula", measured on the chart's own geometry. Change the ruler error and it is re-measured.
4. **Download SVG** (A4 in millimetres), **Download PDF** (one page, true scale) or **Print**. Check the 100 mm bar on the printout before use.
5. The URL carries the whole chart, so a link reproduces it.

Built-in examples: Ohm's law, body mass index, body surface area (Mosteller), right-triangle hypotenuse, Reynolds number in water, axial stress as a Z-chart, and a weighted sum.

## Why this is a resurrection

**What died.** The nomogram, or alignment chart: a calculator printed on paper. Maurice d'Ocagne systematised it in 1884, and for most of the twentieth century it was how working people evaluated formulas they used every day: in engineering handbooks, ballistics and navigation tables, flight manuals, and clinical references such as body-surface-area and dosing charts. Pocket calculators in the 1970s, and then software, ended it. Nobody designs them anymore.

**Why it died.** Not because the finished chart was bad. A nomogram is fast, needs no power and shows the whole range of answers at once. It died because *making* one was expensive: a specialist had to transform the formula into a determinant form by hand, compute every scale, draft and letter the sheet, and then trust that it was accurate, because there was no practical way to prove it.

**What Isopleth changes.** It removes exactly the part that killed the craft:

| Then | Isopleth |
| --- | --- |
| A nomographer spent days on one chart | Type a formula; the compiler recognises the separable form (sum, product, outer function, Z-chart) and lays out the sheet in milliseconds |
| Accuracy was a matter of the draftsman's care | Every sheet carries a certificate: the worst reading error for a stated straightedge error, measured on 1,681 points of the printed geometry |
| Correctness checked by spot readings | Property-based tests: for hundreds of random inputs per chart, the three points lie on one line and the reading equals the formula |
| Hand-lettered sheet, one copy | A4 drafting sheet with title block and calibration bar, as SVG or PDF, reproducible from a URL |

The output is deliberately the original technology, not a modern imitation of it: a sheet of paper you use with a ruler. That is what makes it useful for tomorrow's problems: a printed calculator works in a blackout, in a field station, a classroom without devices or a ward where screens are not wanted, cannot be hacked, and makes visible what a calculator hides: how sensitive the answer is to each input, from the spacing of the marks.

## What the tests prove

```
npm install
npm test
```

188 tests (Node's built-in runner plus [fast-check](https://fast-check.dev)), including:

- **Collinearity.** For 200 random input pairs per example, the three points of the solution lie on one straight line: |det| ≤ 1e-9 of the sheet area. This is the property that makes a nomogram work.
- **Round trip.** Reading a printed position back gives the value that was plotted.
- **Compiler equals formula.** The compiled chart evaluates exactly like the formula you typed (V = I·R, c = √(a² + b²), body surface area √(H·W/3600), σ = F/A as both log chart and Z-chart, w = 2u + v).
- **Bounds.** Every scale and tick stays inside the drawing area, clear of the title block, including decreasing scales from negative exponents (`BMI = weight / height^2`).
- **Reader.** Dragging the straightedge across any two scales and reading the third agrees with the formula; in the browser check the studio shows the difference live (about 1e-12 relative).

## How it is built

The `.kiro/` folder is the build record:

- `steering/` – product, tech and structure rules, plus `nomography-math.md` (the layout derivations) and `testing.md`, loaded only for core and test files.
- `specs/nomogram-engine/` – EARS requirements, design with correctness properties, 43 tasks.
- `specs/chart-studio/` – the browser UI spec.
- `agents/nomographer.md` – the custom agent that implemented the engine tasks.
- `hooks/` – run the property suite on every save, refuse to stop while it is red, and block writes to the contest rules and licence.

Every Kiro session, its model, credits and the hand edits made afterwards are listed in [`notes/kiro-usage-log.md`](notes/kiro-usage-log.md).

## Layout

```
src/core/   pure, DOM-free engine (millimetres, SVG coordinates)
test/       unit and property tests
scripts/    hook scripts (test gate, protected-path guard), headless browser check (shoot.py)
src/ui/     browser studio (state, straightedge, export)
.kiro/      steering, specs, agent, hooks
notes/      brief, Kiro usage log, write-up and video drafts
```

## Licence

MIT, see [LICENSE](LICENSE).
