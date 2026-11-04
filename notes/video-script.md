# Demo video outline (target 2:45, hard limit 3:00)

Audience: Kiroween judges scoring Potential Impact, Technological Implementation (how Kiro was used), Design, Innovation and Presentation, 20 % each, in the Resurrection category. One idea per shot; the sheet is always the hero.

Shots 2–5 need the chart studio, which is specified but not built yet; the outline is the plan for when it is.

| Time | Shot | Voice-over (draft) | On screen |
|------|------|--------------------|-----------|
| 0:00–0:15 | Close-up of a printed A4 nomogram on a desk; a steel ruler is laid across three scales | "Before calculators, engineers solved formulas with a ruler. Lay it across three scales, read the answer where it crosses the third. This is a nomogram, invented by Maurice d'Ocagne in 1884, and it is dead." | Paper, ruler, no UI |
| 0:15–0:35 | Cut to the app: type `V = I * R` | "Isopleth brings it back. Type a formula, and it compiles a nomogram you can print at true scale." | Formula field, sheet redraws |
| 0:35–1:05 | Drag the vermilion straightedge handles; then drag the result handle so the solved variable switches | "Drag any two handles; the third is solved. Move the answer and it solves backwards. Underneath, the app checks the geometric reading against the formula on every frame." | Readout strip with `Δ` line |
| 1:05–1:25 | Point at the certificate sentence; switch tolerance 0.5 → 1.0 mm | "Every chart carries a certificate: if your ruler is off by half a millimetre, your answer is off by at most this much. It is computed, not promised." | Certificate sentence changes |
| 1:25–1:45 | Load the Z-chart example `σ = F / A`, then Print → PDF preview at 100 % | "Ratios get a Z-chart. Print it at true scale; the 100 mm bar lets you check your printer. The printed chart needs no power." | Print preview, calibration bar |
| 1:45–2:25 | Kiro IDE/CLI: steering files, spec (requirements → design → tasks), a hook firing on save, the nomographer agent, MCP `make_nomogram` call | "Kiro built it from a spec. Each EARS requirement became a fast-check property; hooks run the property suite on every save and refuse to finish a task while it is red. A custom agent and an MCP server let any Kiro session generate a verified nomogram." | `.kiro/` tree, test output, MCP call |
| 2:25–2:45 | Back to paper; ruler crosses the scales | "A dead tool, resurrected with proof. Isopleth." | Wordmark, repo URL |

Notes for production
- Record the app at 1920×1080, browser zoom 100 %, system font; no cursor trails or zoom effects.
- Voice: calm, unhurried; no "let's dive in". English.
- Show real test output (counts of properties and runs), not a mock.
