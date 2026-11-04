# Kiroween 2026 brief — Isopleth (rewritten 2026-11-04)

Source rules: `rules/overview-2026-10-31.txt`, `rules/rules-2026-10-31.txt` (read in full 2026-11-04). Deadline: 2026-12-04 14:00 PT = **2026-12-05 06:00 Taiwan**.

## Entry
- **Category:** Resurrection — "Bring your favorite dead technology back to life. Reimagine obsolete tech with today's innovations or solving tomorrow's problems."
- **Bonus:** Best Student Project: Resurrection ($1,500 + 1-year Kiro Pro Max). Needs LinkedIn, student email, year/degree, school (NCKU, Mechanical Engineering); proof of enrollment on request. Best Demo is automatic.
- **Dead technology:** the nomogram (alignment chart). Invented by Maurice d'Ocagne (1884); printed in engineering handbooks, aviation and navigation manuals, and clinical references (body-surface-area and dosing charts) until pocket calculators replaced them in the 1970s. A nomogram is a paper analog computer: lay a straightedge across two known values and read the answer where it crosses the third scale.

## Product
**Isopleth** (the name for the line drawn across a nomogram): a zero-install browser app that compiles a formula into an accurate, printable nomogram.

1. Type a formula and ranges (e.g. `BSA = sqrt(height * weight / 3600)`, `V = I * R`, `c = sqrt(a^2 + b^2)`).
2. The compiler recognises a separable form and lays out a three-scale alignment chart (parallel scales for sums/products, Z-chart for linear ratios).
3. An interactive straightedge: drag any two scale handles, read the third. The same reader is used by the tests.
4. Every chart carries an **accuracy certificate**: the worst reading error caused by a stated straightedge placement error (default ±0.5 mm), measured on the printed geometry.
5. Print/export at true scale (SVG in millimetres, browser print to PDF) with a 100 mm calibration bar and a drafting title block.

Hook: an AI-built tool that produces calculators which need no electricity, no device and no AI at the point of use — field work, classrooms, printed checklists, clinics without reliable power.

## Competitive position
- Last year's 234 Resurrection entries: 0 nomogram projects (competitor scan already done).
- Existing tools: PyNomo (Python, GPL, inactive), Nomograms.jl (Julia, pre-release 2026-10-25), d3 parallel coordinates (not nomograms). None is a zero-install formula → chart compiler with an interactive straightedge and a stated, tested accuracy.
- Differentiators to show: formula compiler, interactive straightedge, true-scale print, **verified accuracy** (property-based tests: for random inputs within the ranges, the straightedge reading equals the formula within the stated tolerance), and an MCP tool so an agent can make verified nomograms.

## Judging map (each 20%)
| Criterion | What we show |
| --- | --- |
| Potential impact | Real audiences that still print reference charts (clinics, field engineers, teachers); offline paper output; accuracy stated per chart. |
| Technological implementation | Steering, Kiro-generated spec (EARS), Kiro executing tasks, hooks running property tests, a custom `nomographer` agent, a project MCP server used by Kiro itself. |
| Design | Restrained drafting aesthetic (Japanese minimal): paper, sumi ink, one vermilion accent, title block, true-scale sheet. No Halloween kitsch, no generic landing page. |
| Innovation | Formula → nomogram compiler + accuracy certificate + MCP tool; 1884 geometry checked by 2026 property tests. |
| Presentation | < 3 min video: problem → compile → straightedge → print → certificate → Kiro workflow. |

## Scope (polished, not wide)
Chart types: parallel-scale sum, parallel-scale product (logarithmic), Z-chart (linear ratio). Examples: Ohm's law, body surface area (Mosteller), right-triangle hypotenuse, Reynolds-style ratio. Out of scope for this round: curved-scale and four-variable (chained) charts.

## Constraints
- New project built during the Submission Period (repo has no code before 2026-11-04). Disclose any pre-existing code (none planned).
- Must genuinely use Kiro; insufficient use = disqualification. Keep `notes/kiro-usage-log.md` honest; never invent usage.
- Public GitHub repo with OSI licence (MIT, `LICENSE`), root `.kiro/` committed and not ignored, working URL (GitHub Pages), public YouTube video < 3 min, English write-up of Kiro use. No third-party trademarks or copyrighted music in the video.
- This round does not publish, push, or submit.
