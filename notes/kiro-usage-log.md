# Kiro usage log

Every Kiro session used to build Isopleth, in order. Kiro CLI 3.0.0 was driven headless from the repo root:

```
kiro-cli chat --v3 --no-interactive --trust-all-tools --trust-workspace --model <model> [--mode spec] [--agent nomographer]
```

The prompt was sent on stdin. Credits come from the `usage_summary` records Kiro writes to `~/.kiro/sessions/**/messages.jsonl`; where a session was interrupted and wrote no summary, the figure comes from the account meter (`/usage`) read before and after. Times are Taiwan time (UTC+8); runs 01–09 on 2026-11-04, later runs dated in the table. Plan: Kiro Free, 50 credits per month; from 11-11 also the Kiroween bonus of 4,000 credits (runs 13–17 drew from it).

"Files" lists what the session created or changed. Anything changed by hand afterwards is listed under *Hand edits* at the bottom, so the split between Kiro's work and mine stays visible.

| # | Time | Model (multiplier) | Mode / agent | What was asked | Files | Credits |
|---|------|--------------------|--------------|----------------|-------|---------|
| 01 | 12:52–12:54 | claude-haiku-4.5 (0.4x) | vibe | Write steering: product, tech, structure, nomography math, testing | `.kiro/steering/product.md`, `tech.md`, `structure.md`, `nomography-math.md`, `testing.md` | 0.55 |
| 02 | 12:55–12:56 | claude-haiku-4.5 | vibe | Review list from me: real YAML front matter; fix middle-scale modulus and offsets, Z-chart diagonal formula, 41×41 certificate grid, numerical tolerance for reader property | same five steering files | 0.81 |
| 03 | 12:57–13:10 | claude-sonnet-4.5 (1.3x) | spec | Spec `nomogram-engine`: EARS requirements, design with module interfaces and correctness properties, ordered tasks | `.kiro/specs/nomogram-engine/requirements.md`, `design.md`, `tasks.md` | 4.35 |
| 04 | 13:10–13:24 | minimax-m2.5 (0.25x) | vibe | Custom agent `nomographer`, hook scripts, four hooks, self-test of the scripts | `.kiro/agents/nomographer.md`, `.kiro/hooks/*.json` (4), `scripts/kiro-test-gate.mjs`, `scripts/kiro-guard-paths.mjs` | ≈5.0 (meter) |
| 04b | 13:27–13:36 | claude-haiku-4.5 | vibe | Fix the two hook scripts from my review; add `test/hooks.test.js`; delete scratch files | `scripts/kiro-guard-paths.mjs`, `scripts/kiro-test-gate.mjs`, `test/hooks.test.js` | 2.16 |
| 03b | 13:39–13:50 | claude-haiku-4.5 | spec | Review list from me for the engine spec (10 items: per-scale moduli, false `y1+y2=y3` claim, collinearity and certificate-soundness properties, reader tolerance, ≥200 runs, hairlines, calibration bar position, negative exponents, normalising `sqrt(H*W/3600)`, example ranges) | `.kiro/specs/nomogram-engine/*.md`, `.kiro/steering/testing.md` | 3.40 |
| 05 | 14:03–14:28 | qwen3-coder-next (0.05x) | agent `nomographer` | Engine tasks T1–T6: scaffold, expression tokenizer/parser/evaluator/printer, unit and property tests | `package.json`, `package-lock.json`, `src/core/expr.js`, `test/expr.test.js`, `test/expr.property.test.js` | ≈9.25 (meter) |
| 06 | 14:20–14:30 | claude-haiku-4.5 | spec | Spec `chart-studio`: the browser UI on top of the engine | `.kiro/specs/chart-studio/requirements.md`, `design.md`, `tasks.md` | 3.63 |
| 07 | 14:33–14:50 | claude-haiku-4.5 | agent `nomographer` | Convert tasks.md to a checklist; engine tasks T7–T17: compiler (sum, product, outer function, Z-chart) and scales (ticks, label thinning) with unit and property tests | `.kiro/specs/nomogram-engine/tasks.md`, `src/core/compile.js`, `src/core/scales.js`, `test/compile.test.js`, `test/compile.property.test.js`, `test/scales.test.js`, `test/scales.property.test.js` | 4.37 |
| 08 | 14:54–15:02 | claude-haiku-4.5 | agent `nomographer` | Part A: fix the three compiler bugs from my review with regression tests and an all-examples property; fix the flaky property. Parts B/C (layout, reader) were in the same prompt but not done | `src/core/compile.js`, `test/compile.test.js`, `test/compile.property.test.js`, `test/scales.property.test.js`, `.kiro/specs/nomogram-engine/tasks.md` | 3.47 |
| 09 | 15:06–15:17 | claude-haiku-4.5 | agent `nomographer` | Engine tasks T18–T22: `layout.js` (parallel and Z-chart geometry, ticks) with collinearity, round-trip and bounds properties; output-range bug in the compiler | `src/core/layout.js`, `test/layout.test.js`, `test/layout.property.test.js`, `src/core/compile.js`, `test/compile.test.js`, `.kiro/specs/nomogram-engine/tasks.md` | 1.83 |
| 10 | 11-07 10:30–10:41 | claude-haiku-4.5 | agent `nomographer` | Engine tasks T23–T26: `reader.js` (point on scale, value at point with clamping, line through two scales intersected with the third, any pair of scales, Z-chart diagonal) with unit tests and forward/backward reader properties on five charts | `src/core/reader.js`, `test/reader.test.js`, `test/reader.property.test.js`, `.kiro/specs/nomogram-engine/tasks.md` | 3.75 |
| 11 | 11-07 10:44–10:48 | claude-haiku-4.5 | agent `nomographer` | Chart-studio tasks T3–T4: DOM-free studio state (`encodeStateToHash`, `decodeStateFromHash` with validation, `nextSolved` for the least-recently-moved handle, `fileName`) and its property tests | `src/ui/state.js`, `test/state.property.test.js`, `.kiro/specs/chart-studio/tasks.md` | 1.56 |
| 12 | 11-09 10:29–10:41 | claude-haiku-4.5 | agent `nomographer` | Compiler gap: `BMI = weight / height^2` was rejected because `analyzePowerFactor` dropped nested powers `(height^2)^-1`; make it recursive, accept unary-minus exponents, add the BMI example and four regression tests | `src/core/compile.js`, `src/core/examples.js`, `test/compile.test.js` | 3.41 |
| 13 | 11-11 10:13–10:18 | claude-sonnet-5.5 (1.3x) | agent `nomographer` | Engine tasks T38–T41: `make_nomogram` MCP server (stdio JSON-RPC, `initialize`, `tools/list`, `tools/call`, outFile jail, self-check line) and `test/mcp.test.js` (15 tests, one subprocess) | `mcp/server.mjs`, `test/mcp.test.js`, `.kiro/specs/nomogram-engine/tasks.md` | 5.85 (meter) |
| 14 | 11-11 10:19–10:23 | claude-sonnet-5.5 | agent `nomographer` | Chart-studio T11, T12, T15 as automated checks: WCAG contrast from the CSS variables, labels, live regions, handle keyboard support, focus rings, responsive and print CSS, no inline styles, no CDN; mobile/tablet/desktop section for `scripts/shoot.py` | `test/studio-a11y.test.js`, `styles.css` (`--muted`, `--accent` darkened to pass 4.5:1 on the desk tone), `scripts/shoot.py`, `.kiro/specs/chart-studio/tasks.md` | 6.67 (meter) |
| 15 | 11-11 10:25–10:27 | claude-sonnet-5.5 | agent `nomographer` | Two mobile defects my browser check found at 390 px (masthead wrapped to three lines; sheet only 226 px wide because it was sized by height): below 600 px hide the subtitle, no-wrap nav; below 1024 px size the sheet by width. Three tests and two `shoot.py` checks | `styles.css`, `src/ui/app.js` (`fitSheet`), `test/studio-a11y.test.js`, `scripts/shoot.py` | 2.62 (meter) |
| 16 | 11-11 10:27–10:31 | claude-sonnet-5.5 | agent `nomographer` | Chart-studio T14 and T16 without a DOM library: studio chain (formula → chart → sheet → SVG/PDF) for all 7 examples, hash round trip, 25 seeded straightedge placements per example (collinearity determinant and reading vs formula), MCP certificate equals `formatCertificate`; timing budgets and source checks for the 250 ms debounce and for drags not rebuilding the sheet | `test/studio.integration.test.js`, `test/studio.perf.test.js`, `.kiro/specs/chart-studio/tasks.md` | 4.48 (meter) |
| 17 | 11-11 10:32–10:39 | claude-sonnet-5.5 | agent `nomographer` | Chart-studio T13 and T17, engine T43 (MCP part): README (keyboard, browser support, URL hash, mobile, MCP server, performance, checks, layout tree, test count), JSDoc test, QA checklist with an evidence map that separates asserted from recorded checks | `README.md`, `mcp/server.mjs` (two JSDoc lines), `test/docs.test.js`, `test/QA-CHECKLIST.md`, both `tasks.md` | 13.03 (meter) |

Other credit use: 0.09 before this project started; about 0.03 when a headless `/usage` command was sent to the model by mistake.

**Meter at 15:18 on 11-04: 38.96 of 50 credits used, 11.04 left.** Runs 10 and 11 (11-07) used 5.31 more by their usage summaries, so about 5.7 were left before run 12. Run 12 used 3.41: **about 2.3 credits left until the monthly reset on 12-01.**

## Hooks observed firing

Counted from `ContextualHookInvoked` events in all session logs for this repo (recounted 2026-11-17, covering runs 01–17):

| Hook | Fired | Sessions |
|------|-------|----------|
| `guard-protected-files` (PreToolUse, write) | 227 | all sessions from 03b on |
| `property-tests-on-save` (PostFileSave) | 101 | all sessions that edited `src/core/`, `test/` or `mcp/` |
| `green-before-stop` (Stop) | 14 | runs 03b–09 and later; blocked once, in run 06 at 14:23, while run 05's half-written expression tests were red (the gate's per-session counter recorded one block) |
| `test-after-task` (PostTaskExec) | 0 | tasks were run from prompts, not from spec-mode task execution |

## Notes per session

- **02** – Run 01 wrote the front matter as bold text instead of YAML and had three math errors (middle-scale modulus, offsets, Z-chart diagonal parameter). I listed them; Kiro fixed them in run 02. I re-derived each formula afterwards.
- **04** – The cheap model wrote all files in the first two minutes, then spent twelve minutes failing to pipe JSON into the guard script from the Windows shell (exit code 2 was reported to it as a tool failure). I stopped the session. Lesson kept for later runs: give exact, shell-free test commands (`spawnSync` with `input`) and a stronger model for debugging.
- **04b** – Kiro found the real bug itself: on Windows `path.join(root, "D:\\…")` does not reset to the absolute path.
- **03b** – Sonnet's first spec used a single modulus for all three parallel scales, which is only right when both outer scales are equally scaled. Kiro rewrote the layout section, added tasks for the collinearity and certificate-soundness properties, and renumbered the plan to T1–T43. It chose 0.1 instead of 0 as the lower range of two examples; I left that.
- **05** – First attempt stopped at start-up: the agent file used plain strings for `permissions.rules`, which Kiro 3.0 rejects (it wants `{capability, match, effect}` objects; my prompt for run 04 had specified the wrong format). After the fix the session finished T1–T6 with 41 tests green but hit my 25-minute wrapper timeout while still polishing, so it wrote no usage summary; the figure is the meter difference. Its long debugging loop (an `exp(exp(x))` overflow in a generated expression) plus the agent loading all spec documents into every turn made this the most expensive run per task; the agent now loads steering only and reads specs on demand.
- **05 and 06** overlapped in time (the UI spec only touched `.kiro/specs/chart-studio/`).
- **07** – Marked T7–T17 done with 100 of 101 tests green; the one red property (log-scale monotonicity) is flaky on adjacent doubles. Running the five example formulas through the compiler afterwards showed three real bugs the tests had missed (outer `sqrt` not applied in `evaluate`, `sqrt(H*W/3600)` not normalised, ratio never reaching the Z-chart branch). They went back to Kiro as regression tests in run 08. The session also left three `test-output*.txt` files and a conversion script in the repo, which I removed.
- **08** – Fixed all three compiler bugs (111 tests green), then ticked T18–T26 in the task list although `layout.js` and `reader.js` were never written. I unticked them. Lesson: give one part per session and check the files, not the summary.
- **09** – Wrote `layout.js` and 19 tests in eleven minutes, the cheapest batch per task. My own check with 2,000 random readings per example: collinearity |det| ≤ 5e-11 mm² on all five examples, but reading a value back off the hypotenuse chart's `c` scale was wrong by a factor of up to 13 (the inverse assumed the scale function is the identity); Kiro's round-trip property had not included that example. Fixed by hand, see below.
- **10** – Worked through the Z-chart reader with four debug scripts in the repo root and deleted them itself before finishing; 144 tests green at the end. The prompt fixed the exact signatures and tolerance, which kept the run to eleven minutes.
- **12** – Kiro's shell crashed (PowerShell exit 3221225794) in the middle of the run, so it could not run the suite at the end and reported the fix unverified. Run afterwards by hand: all compiler tests green, but the BMI chart's output scale was laid out far off the sheet — a layout bug the compiler change exposed (see hand edits). It also chose its own BMI ranges (20–140 kg, 1.2–2.0 m) instead of the ones in the prompt.
- **11** – The chart-studio task list had no checkboxes, so, as the prompt allowed, it added `**Status:** done` under T3 and T4. 181 tests green.

**Meter on 11-11 (`kiro-cli chat --no-interactive "/usage"`):** free plan 47.71 of 50 used (unchanged by runs 13–17); Kiroween bonus 0.06 of 4,000 before run 13, 32.71 after run 17. Runs 13–17 used 32.65 (5.85 + 6.67 + 2.62 + 4.48 + 13.03). **Project total: 80.36 credits in 19 sessions** (47.71 free-plan credits through run 12, including 0.09 before the project and about 0.03 for the mistaken `/usage`, plus 32.65 bonus credits).

- **13** – Kiro's write to `.kiro/settings/mcp.json` was denied by the agent's permission rules; it stopped and asked rather than going round them through the shell. I wrote the file by hand (below). Review by me: a fresh stdio session on a Z-chart (`sigma = F / A`) gave the certificate, 1,681 grid points, 6,694 placements and a self-check difference of 3.8e-13; a bad formula returned error -32602 with the character position.
- **14** – Two colour variables failed WCAG AA on the desk tone (`--muted` 4.16, `--accent` 4.04); Kiro darkened both and warned that the UI vermilion (`#b73823`) now differs slightly from the printed one (`#c43c25` in `sheet.js`). I left it: the printed sheet is unchanged.
- **15** – Looking at `mobile-390.png` from the new responsive check showed the masthead and the 226 px sheet problems; the check itself had passed. Fixed in this run and the screenshot re-read: masthead one row (52 px), sheet 366 px wide.
- **16** – Kiro measured, not assumed: `app.js` has no `requestAnimationFrame`, so the T16 line about it is recorded as not true; drags only move existing overlay elements. Build times 14–28 ms per chart, sheet 2–28 ms, PDF 2–5 ms. My own check, separate from the tests: 2,000 random readings per example, |det| ≤ 9.1e-12 mm², reading vs formula ≤ 7.5e-11 relative.
- **17** – Kiro's checklist marks each browser key as asserted or recorded and says "not automated - check by hand" where nothing covers an item (dialog, print dialog, Tab order, Shift+arrow press); I did not run those by hand.

## Hand edits (not Kiro)

- `.gitignore` – rewritten by me (`.omx/`, `work/`, `node_modules/`; `.kiro/` is tracked). The tracker attributed it to run 03 because I edited it while that session ran.
- `.kiro/agents/nomographer.md` – front matter only: `permissions.rules` rewritten to the object form Kiro 3.0 expects; `spec` and `@mcp` added to `tools`; spec documents removed from `resources` to cut per-turn context. The prompt body is Kiro's.
- `scripts/kiro-test-gate.mjs` – after run 04b: report mode prints a short summary (counts and failing test names) instead of the whole test output; gate mode exits 0 with the block JSON and puts the summary in `reason`, as the Stop-hook contract asks.
- `.kiro/specs/nomogram-engine/tasks.md` – after run 08: T18–T26 set back to `[ ]` (not implemented). Run 09 then ticked T18–T22 itself.
- `src/core/layout.js` – after run 09, `pointToValue` on parallel scales: always invert the scale function numerically (it was returning f(value) for non-log scales, wrong for `a^2`, `c^2`), and take the bisection direction from the function so decreasing scales (negative exponents) invert correctly. Checked with 2,000 random readings each on `c = sqrt(a^2+b^2)`, `I = V / R`, `V = I * R`: round-trip error ≤ 4e-11 relative; suite 130/130 green.

### 2026-11-07 (after runs 10–11, Kiro credits held back)

Written by hand, not by Kiro, following the engine spec (T27–T37) and the chart-studio spec (T1, T2, T5–T10):

- Engine: `src/core/graduate.js` (tick graduation), `certificate.js` (accuracy certificate on a 41 × 41 grid with straightedge perturbations and a ×1.1 margin), `sheet.js` (A4 drafting sheet, title block, 100 mm calibration bar, label collision avoidance), `svg.js`, `pdf.js` (dependency-free one-page PDF), `text.js`, `pipeline.js` (formula text → chart, layout, certificate), `examples.js`; tests in `test/sheet.test.js`.
- Studio: `index.html`, `styles.css`, `src/ui/app.js` (straightedge overlay with pointer and keyboard dragging, least-recently-moved handle solved through `nextSolved`, live straightedge-vs-formula Δ, URL-hash state, SVG/PDF download, print).
- `scripts/shoot.py`: headless Chrome check of the studio (screenshots, drag, keyboard, downloads, hash restore, error caret, print, label overlap by rendered bounding boxes).
- `src/core/layout.js`: the Z-chart diagonal's `pointToValue` returned the scale function's value instead of inverting it; now always inverts on the range.
- `src/core/expr.js`: "Unexpected end of input" now reports the end token's position, so the studio's caret points at the right place.

### 2026-11-09 (after run 12)

- `src/core/compile.js` – product form: a negative exponent makes the scale function decreasing, but `min`/`max` were taken in range order, so the two outer moduli nearly cancelled and BMI's output scale landed hundreds of millimetres off the sheet. `min`/`max` are now the function's extent. Regression test in `test/layout.test.js` (three formulas with negative exponents: every endpoint on the A4 sheet, every scale spans the usable height).
- `src/core/examples.js` – BMI ranges set to 30–150 kg and 1.4–2.1 m (adult range, as the prompt asked) and description rewritten.
- `scripts/shoot.py` – BMI screenshot and reading check, scales-on-sheet checks for BMI and the typed formula, UTF-8 output on Windows, mouse moved off the example list before the typed-formula screenshot.
- Result: 188/188 tests; browser check: BMI 70 kg, 1.75 m reads 22.86 kg/m² (straightedge vs formula Δ 6.4e-13), certificate ±0.63 %, no label overlaps on any of the seven examples, no console errors, SVG and one-page A4 PDF download.

### 2026-11-11 (after runs 13–17)

- `.kiro/settings/mcp.json` – written by me (registers server `isopleth-nomogram`, command `node`, args `mcp/server.mjs`) because Kiro's write there was denied; T40 ticked in `.kiro/specs/nomogram-engine/tasks.md` with that note.
- `test/QA-CHECKLIST.md` – the "Last run" line, filled from my `shoot.py` run.
- No other hand edits to source. The browser check ran from my shell, not Kiro's (Kiro's shell is limited to `node`, `npm`, `git status`, `git diff`).
- Result: 261/261 tests; `scripts/shoot.py` exit 0, no console errors, no label overlaps on all seven examples, responsive checks true.
