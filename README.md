# Isopleth

**Formula → paper calculator.** Isopleth compiles a formula into a nomogram: an A4 alignment chart you print at true scale and use with a ruler. Lay the straightedge across two known values and read the answer where it crosses the third scale. No battery, no screen, no network at the point of use.

Nomograms were invented by Maurice d'Ocagne in 1884 and filled engineering handbooks, flight manuals and clinical references until pocket calculators replaced them. Isopleth brings them back with one thing the originals never had: every chart is checked against its formula by property-based tests, and carries a stated accuracy for a stated straightedge error.

Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Resurrection category).

## Status (2026-11-04)

| Part | State |
|------|-------|
| Expression parser (`src/core/expr.js`) | done, tested |
| Formula compiler: sum, product (log), outer function, Z-chart (`src/core/compile.js`) | done, tested |
| Scales and ticks (`src/core/scales.js`) | done, tested |
| Sheet geometry: parallel scales and Z-chart (`src/core/layout.js`) | done, tested |
| Reader (solve any scale from the other two), accuracy certificate, SVG sheet, examples | specified, not built |
| MCP server `make_nomogram` | specified, not built |
| Browser studio with draggable straightedge, print / SVG export | specified (`.kiro/specs/chart-studio/`), not built |

## What the tests prove

```
npm install
npm test
```

130 tests (Node's built-in runner plus [fast-check](https://fast-check.dev)), including:

- **Collinearity.** For 200 random input pairs per example, the three points of the solution lie on one straight line: |det| ≤ 1e-9 of the sheet area. This is the property that makes a nomogram work.
- **Round trip.** Reading a printed position back gives the value that was plotted.
- **Compiler equals formula.** The compiled chart evaluates exactly like the formula you typed (V = I·R, c = √(a² + b²), body surface area √(H·W/3600), σ = F/A as both log chart and Z-chart, w = 2u + v).
- **Bounds.** Every scale and tick stays inside the drawing area, clear of the title block.

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
scripts/    hook scripts (test gate, protected-path guard)
.kiro/      steering, specs, agent, hooks
notes/      brief, Kiro usage log, write-up and video drafts
```

## Licence

MIT, see [LICENSE](LICENSE).
