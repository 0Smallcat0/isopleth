# Demo video: final storyboard and voice-over (2026-11-17)

Final file: `video/isopleth-demo.mp4`, 158.2 s (limit: under 3 minutes), 1920x1080, 30 fps, English voice-over (edge-tts en-US-AndrewMultilingualNeural), no music, no third-party footage or trademarks. Made by `video/produce.py` (Playwright drives the real studio in Chrome, one screenshot per frame), `video/prep.py` (real PDF, MCP reply, test summary) and `video/assemble.py` (ffmpeg, loudnorm -14 LUFS).

| Start | On screen | Voice-over |
| --- | --- | --- |
|    0.0 s | Studio, panel hidden; straightedge dragged on Ohm's law; left text | Before pocket calculators, engineers solved formulas with a ruler. Lay it across two known values on a printed chart, and read the answer where it crosses the third scale. This is a nomogram. Maurice d'Ocagne systematised it in 1884, and it filled handbooks for a century. Then it died, because making one by hand took days, and nobody could prove it was accurate. |
|   26.4 s | Type BSA formula and ranges in the live studio | Isopleth brings it back. Type a formula and the ranges. The compiler recognises its form, and lays out a three-scale chart in milliseconds. |
|   38.1 s | Drag two handles, then the answer handle; readout strip boxed | Drag any two handles on the straightedge, and the third is solved. Move the answer, and it solves backwards. Under the sheet, the reading is compared with the formula on every move. |
|   52.2 s | Accuracy block boxed; ruler error 0.5 -> 1 -> 2 mm re-measures | Every chart carries an accuracy certificate. If your ruler is off by half a millimetre, the answer is off by at most this much. Change the ruler error, and it is measured again, on the chart's own geometry. |
|   67.7 s | Axial-stress Z-chart; real PDF download shown as a card with the 100 mm bar | Ratios get a Z-chart. Download the sheet as an SVG, or a one-page A4 PDF at true scale, with a hundred millimetre bar to check your printer. Once printed, it needs no power, no screen and no network. |
|   84.5 s | .kiro tree and steering excerpt (real files) | Kiro wrote the engine core, the MCP server and the studio's checks; I hand-wrote the certificate, the sheet and the studio. The work is in the repo. Steering files keep the nomography maths in one place, and load only when Kiro touches the core, the tests or the MCP server. |
|   98.5 s | EARS requirement and collinearity property (real text) | A spec, with requirements, design and tasks, turned every rule into a property. The most important one: for random inputs, the three points of every solution lie on one straight line. |
|  113.4 s | Hooks with recounted fire counts; nomographer agent file | Hooks run the property suite on every save, and refuse to let a task finish while it is red. A custom agent, the nomographer, implemented the engine batches, one task at a time. |
|  126.3 s | make_nomogram request/reply (real server output) and npm test summary | An MCP server lets any Kiro session ask for a verified nomogram, and get back the certificate with the sheet. Every batch was reviewed against the formulas; three bugs the tests had missed became regression tests. |
|  141.6 s | Wordmark, repo and Pages URLs | A dead tool, resurrected with proof. Isopleth. Open source on GitHub, and live on GitHub Pages. |

Notes
- The studio footage is the real app (not a mock); the Kiro cards quote real repo files and real server output. Kiro itself (CLI, headless) is not filmed; the cards show what it produced.
- Re-render: serve the repo root (`python -m http.server 4719`), then `python -X utf8 video/produce.py` and `python -X utf8 video/assemble.py`.
