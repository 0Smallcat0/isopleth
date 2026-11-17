# How Kiro built Isopleth (draft for the Devpost write-up)

Isopleth turns a formula into a printable nomogram, the paper calculator engineers used before pocket calculators. The hard part is accuracy: a nomogram is only useful if a straightedge laid on the printed sheet gives the right answer. So the project was set up so that Kiro could not call a task done until the geometry had been checked against the formula.

## Steering: the math lives in one place

Five steering files in `.kiro/steering/`. `product.md`, `tech.md` and `structure.md` are always included. `nomography-math.md` loads only when Kiro touches `src/core/`, `test/` or `mcp/`. It holds the derivations: per-scale moduli for parallel charts (m3 = m1·m2/(m1+m2), middle scale at D·m1/(m1+m2)), the Z-chart diagonal parameter t = m1·f3/(m1·f3 + m2), and the collinearity determinant every layout must satisfy. `testing.md` is scoped to `test/` and fixes how properties are written: fast-check, at least 200 runs, each property named after its requirement.

Kiro's first steering draft had three formula errors. I listed them, Kiro corrected them, and from then on specs and tasks pointed back to that file instead of re-deriving the math.

## Specs: requirements became properties

`.kiro/specs/nomogram-engine/` was generated in spec mode: EARS requirements (R1–R9), a design with module interfaces and correctness properties, and 43 ordered tasks. A second review pass fixed the design where it disagreed with the steering math (a single shared modulus, a false `y1 + y2 = y3` claim) and added the two properties that matter most:

- **Collinearity:** for random inputs, the three points of every solution lie on one line (determinant ≤ 1e-9 of the sheet area).
- **Certificate soundness:** perturb each straightedge end by up to δ mm; the reading error never exceeds the bound printed on the chart.

`.kiro/specs/chart-studio/` specifies the browser studio on top of the engine: the A4 sheet as the hero, a vermilion straightedge with three handles where the least recently moved one is solved, keyboard control, a live "straightedge vs formula" difference, URL-hash sharing and true-scale printing, with DOM-free helpers kept testable in Node.

## Hooks: the suite runs itself

| Hook | Trigger | What it does | Fired so far |
|------|---------|--------------|--------------|
| `property-tests-on-save` | file saved in `src/core/`, `test/`, `mcp/` | runs the whole suite, prints pass/fail and the failing test names | 101 |
| `green-before-stop` | the agent tries to finish | if the suite is red, blocks the stop and hands the failure summary back (at most twice per session) | 14 (blocked once) |
| `guard-protected-files` | before any write | refuses writes to the contest rules, the licence and the brief | 227 |
| `test-after-task` | a spec task finishes | same summary after each spec-mode task | 0 |

The hook scripts have their own tests (`test/hooks.test.js`), written by Kiro in a fix-up session after review found that the first guard ignored a bare `LICENSE` path and the first test gate never saw a failure.

## A custom agent

`.kiro/agents/nomographer.md` implemented every engine batch: steering loaded as resources, shell limited to `node`, `npm`, `git status` and `git diff`, and a short prompt — one task at a time, a fast-check property for every universal requirement, mark a task done only after `npm test` is green.

## What review caught

Kiro wrote the code; I reviewed every batch against the formulas, not just the green test count. Three things the tests had missed came back to Kiro as regression tests: the outer square root not applied in the compiled evaluator, `sqrt(H·W/3600)` not normalised into a product of powers, and ratios never reaching the Z-chart branch. One batch ticked tasks whose files it never wrote; those were unticked. All of it is in `notes/kiro-usage-log.md`, with every session's model, time and credits and each hand edit.

## Result so far

Engine (parser, compiler, scales, layout, reader, certificate, sheet, SVG/PDF), browser studio and the `make_nomogram` MCP server: 262 tests green, including collinearity on 200 random readings per example chart. Independent check on 2,000 random readings per example (separate script, not part of the suite): |det| ≤ 9.1e-12 mm², reading vs formula ≤ 7.5e-11 relative. Headless Chrome check of the studio (`scripts/shoot.py`, 2026-11-11): seven examples with no label overlaps, straightedge vs formula Δ ≈ 1.7e-12 relative after dragging, SVG and one-page A4 PDF downloads, URL restores the chart, no console errors, and a responsive section (390 px phone with touch drag, 1023 px stacked, 1024 px side by side).

The second Kiro wave on 11-11 (runs 13–17, claude-sonnet-5.5, 32.65 Kiroween bonus credits) built the MCP server that the `nomographer` agent can call (`.kiro/settings/mcp.json`), turned chart-studio tasks T11–T17 into automated checks (WCAG contrast computed from the CSS variables, labels, live regions, keyboard support, integration chain for all seven examples, timing budgets, JSDoc and README checks) and fixed what the checks and my browser look found: two colours below AA contrast, a masthead that wrapped on a phone and a sheet that rendered at 226 px on a 390 px screen.

Kiro usage in total: 19 sessions, 80.36 credits (47.71 from the free plan, 32.65 from the Kiroween bonus), models Haiku 4.5, Sonnet 4.5, Sonnet 5.5, MiniMax M2.5 and Qwen3 Coder Next; every session is in `notes/kiro-usage-log.md`. Hand edits outside Kiro: the `.kiro/settings/mcp.json` file (Kiro's write was denied by its own permission rule), earlier fixes to the layout inverse and the negative-exponent scale extent, the hook scripts' report format, and the browser check scripts.
