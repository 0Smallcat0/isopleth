# Kiro usage log

Every Kiro session used to build Isopleth, in order. Kiro CLI 3.0.0 was driven headless from the repo root:

```
kiro-cli chat --v3 --no-interactive --trust-all-tools --trust-workspace --model <model> [--mode spec] [--agent nomographer]
```

The prompt was sent on stdin. Credits come from the `usage_summary` records Kiro writes to `~/.kiro/sessions/**/messages.jsonl`; where a session was interrupted and wrote no summary, the figure comes from the account meter (`/usage`) read before and after. Times are Taiwan time (UTC+8), 2026-11-04. Plan: Kiro Free, 50 credits per month.

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

Other credit use: 0.09 before this project started; about 0.03 when a headless `/usage` command was sent to the model by mistake.

**Meter at 15:18: 38.96 of 50 credits used, 11.04 left.** Kiro work stopped there to keep a 10-credit reserve.

## Hooks observed firing

Counted from `ContextualHookInvoked` events in the session logs (runs 04–09):

| Hook | Fired | Sessions |
|------|-------|----------|
| `guard-protected-files` (PreToolUse, write) | 91 | 04, 04b, 05, 07, 08, 09 |
| `property-tests-on-save` (PostFileSave) | 43 | 04b, 05, 07, 08, 09 |
| `green-before-stop` (Stop) | 4 | 04b, 07, 08, 09 |
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

## Hand edits (not Kiro)

- `.gitignore` – rewritten by me (`.omx/`, `work/`, `node_modules/`; `.kiro/` is tracked). The tracker attributed it to run 03 because I edited it while that session ran.
- `.kiro/agents/nomographer.md` – front matter only: `permissions.rules` rewritten to the object form Kiro 3.0 expects; `spec` and `@mcp` added to `tools`; spec documents removed from `resources` to cut per-turn context. The prompt body is Kiro's.
- `scripts/kiro-test-gate.mjs` – after run 04b: report mode prints a short summary (counts and failing test names) instead of the whole test output; gate mode exits 0 with the block JSON and puts the summary in `reason`, as the Stop-hook contract asks.
- `.kiro/specs/nomogram-engine/tasks.md` – after run 08: T18–T26 set back to `[ ]` (not implemented). Run 09 then ticked T18–T22 itself.
- `src/core/layout.js` – after run 09, `pointToValue` on parallel scales: always invert the scale function numerically (it was returning f(value) for non-log scales, wrong for `a^2`, `c^2`), and take the bisection direction from the function so decreasing scales (negative exponents) invert correctly. Checked with 2,000 random readings each on `c = sqrt(a^2+b^2)`, `I = V / R`, `V = I * R`: round-trip error ≤ 4e-11 relative; suite 130/130 green.
