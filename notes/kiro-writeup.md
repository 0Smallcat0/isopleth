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
| `property-tests-on-save` | file saved in `src/core/`, `test/`, `mcp/` | runs the whole suite, prints pass/fail and the failing test names | 43 |
| `green-before-stop` | the agent tries to finish | if the suite is red, blocks the stop and hands the failure summary back (at most twice per session) | 4 |
| `guard-protected-files` | before any write | refuses writes to the contest rules, the licence and the brief | 91 |
| `test-after-task` | a spec task finishes | same summary after each spec-mode task | 0 |

The hook scripts have their own tests (`test/hooks.test.js`), written by Kiro in a fix-up session after review found that the first guard ignored a bare `LICENSE` path and the first test gate never saw a failure.

## A custom agent

`.kiro/agents/nomographer.md` implemented every engine batch: steering loaded as resources, shell limited to `node`, `npm`, `git status` and `git diff`, and a short prompt — one task at a time, a fast-check property for every universal requirement, mark a task done only after `npm test` is green.

## What review caught

Kiro wrote the code; I reviewed every batch against the formulas, not just the green test count. Three things the tests had missed came back to Kiro as regression tests: the outer square root not applied in the compiled evaluator, `sqrt(H·W/3600)` not normalised into a product of powers, and ratios never reaching the Z-chart branch. One batch ticked tasks whose files it never wrote; those were unticked. All of it is in `notes/kiro-usage-log.md`, with every session's model, time and credits and each hand edit.

## Result so far

Parser, compiler, scales and sheet geometry: 130 tests green, including collinearity on 200 random readings per example chart. Independent check on 2,000 random readings per example: |det| ≤ 5e-11 mm².

## Still to build before submission

Reader, accuracy certificate, SVG sheet and examples (engine tasks T23–T37), the `make_nomogram` MCP server (T38–T41), and the chart studio UI (`chart-studio` T1–T17). After that: GitHub Pages deployment, screenshots and the demo video. This section is removed from the final write-up.
