# Isopleth

**Formula → paper calculator.** Isopleth compiles a formula into a nomogram: an A4 alignment chart you print at true scale and use with a ruler. Lay the straightedge across two known values and read the answer where it crosses the third scale. No battery, no screen, no network at the point of use.

Nomograms were invented by Maurice d'Ocagne in 1884 and filled engineering handbooks, flight manuals and clinical references until pocket calculators replaced them. Isopleth brings them back with one thing the originals never had: every chart is checked against its formula by property-based tests, and carries a stated accuracy for a stated straightedge error.

Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Resurrection category).

## Try it

Open the studio (no install, no build, no network calls): serve the repo root with any static server, e.g. `python -m http.server 4719`, and open `http://127.0.0.1:4719/`.

1. Type a formula (`V = I * R`, `BMI = weight / height^2`, `c = sqrt(a^2 + b^2)`) and set each variable's range and unit. The sheet redraws as you type; a parse error points at the character.
2. Drag any two of the vermilion straightedge handles; the one you touched least recently is solved. Under the sheet, the reading is compared with the formula on every move (`straightedge vs formula: relative Δ`).
3. Read the **accuracy certificate**: "with the straightedge within ±0.5 mm of each mark, V reads within ±3 % of the formula", measured on the chart's own geometry. Change the ruler error and it is re-measured.
4. **Download SVG** (A4 in millimetres), **Download PDF** (one page, true scale) or **Print**. Check the 100 mm bar on the printout before use.
5. The URL carries the whole chart, so a link reproduces it (see below).

Built-in examples: Ohm's law, body mass index, body surface area (Mosteller), right-triangle hypotenuse, Reynolds number in water, axial stress as a Z-chart, and a weighted sum.

**Keyboard.** Tab moves through the formula, the range fields, the layout choice, the ruler error, the buttons and the examples, then to the three straightedge handles (each is a slider named after its variable). On a focused handle the arrow keys move it 1 mm along its scale; Shift + arrow moves it 0.1 mm. Up and Left move towards the top of the sheet, Down and Right towards the bottom, whichever way the scale runs. The reading under the sheet is announced as it changes.

**Browser support.** Plain ES2022 modules, HTML, CSS and SVG: current Chrome, Edge, Firefox and Safari. There is no build step and no network request, and everything loads from the same origin, so the studio works offline once the page has loaded.

**Sharing by URL.** The address bar is updated as you edit (it replaces the current history entry, so Back is not filled with keystrokes). The URL hash holds the formula, each variable's range and unit, the layout, the ruler error and the example id, and nothing else. Open the link, or reload, and the same chart is rebuilt. A hash that is malformed, has a range with min ≥ max, or a ruler error outside 0.1 to 5 mm is ignored and the studio starts from Ohm's law.

**Phones and narrow windows.** Below 1024 px wide the settings panel stacks above the sheet, and the sheet is sized by the window's width (height follows the A4 ratio) so it stays legible; scroll down to it. From 1024 px the panel sits to the left and the sheet is sized to fit the height. Handles take touch as well as mouse.

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

261 tests (Node's built-in runner plus [fast-check](https://fast-check.dev)), including:

- **Collinearity.** For 200 random input pairs per example, the three points of the solution lie on one straight line: |det| ≤ 1e-9 of the sheet area. This is the property that makes a nomogram work.
- **Round trip.** Reading a printed position back gives the value that was plotted.
- **Compiler equals formula.** The compiled chart evaluates exactly like the formula you typed (V = I·R, c = √(a² + b²), body surface area √(H·W/3600), σ = F/A as both log chart and Z-chart, w = 2u + v).
- **Bounds.** Every scale and tick stays inside the drawing area, clear of the title block, including decreasing scales from negative exponents (`BMI = weight / height^2`).
- **Reader.** Dragging the straightedge across any two scales and reading the third agrees with the formula; in the browser check the studio shows the difference live (about 1e-12 relative).

## Checks

Three automated layers, from cheapest to most realistic:

1. **Unit and property tests** (`npm test`): the engine modules in `src/core/`, the DOM-free studio helpers in `src/ui/state.js` and the MCP server. Properties use fast-check with at least 200 runs.
2. **Studio checks**, also run by `npm test`, with no browser: `test/studio-a11y.test.js` (contrast, labels, live regions, focus styles, print and responsive CSS, offline rules), `test/studio.integration.test.js` (every example through the same chain the studio calls: build, SVG, PDF, hash round trip, straightedge placements) and `test/studio.perf.test.js` (timings and the drag mechanism).
3. **Headless Chrome** (`scripts/shoot.py`, Python Playwright and an installed Chrome; not part of `npm test`). It drives the real page: drags, keys, downloads, hash restore, error text, label overlap on every example, print media, and the 390, 1023 and 1024 px layouts. Serve the repo root, then run `python scripts/shoot.py http://127.0.0.1:4719/ work/shots`. It prints one JSON object and exits 1 if there is a console error, a label overlap, a scale off the sheet or a failed responsive check; other keys in the JSON are recorded for you to read, not asserted.

What no script covers is listed in [`test/QA-CHECKLIST.md`](test/QA-CHECKLIST.md), to be checked by hand in a browser.

## MCP server (`make_nomogram`)

`mcp/server.mjs` is a Model Context Protocol server over stdio: JSON-RPC 2.0, one JSON message per line, no dependencies. It runs the same engine modules as the studio and exposes one tool, `make_nomogram`, so an agent can ask for a chart and get back the sheet and the numbers that vouch for it.

**Registering it in Kiro.** `.kiro/settings/mcp.json` already does this; the server name is `isopleth-nomogram`:

```json
{
  "mcpServers": {
    "isopleth-nomogram": { "command": "node", "args": ["mcp/server.mjs"], "disabled": false }
  }
}
```

Kiro starts `node mcp/server.mjs` from the workspace root, lists the tool, and calls it when asked for a chart.

**Arguments.**

| Argument | Type | Meaning |
| --- | --- | --- |
| `formula` | string, required | Equation with two inputs, e.g. `"V = I * R"` |
| `ranges` | object, required | Each input variable → `[min, max]`, finite numbers |
| `layout` | `"parallel"` or `"z"` | Default `"parallel"` |
| `deltaMm` | number > 0 | Straightedge error in mm, default 0.5 |
| `outFile` | string | Workspace-relative path to write the SVG to |

**Example request** (one line):

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"make_nomogram","arguments":{"formula":"V = I * R","ranges":{"I":[0.1,10],"R":[1,1000]},"outFile":"work/ohms-law.svg"}}}
```

**Trying it by hand.** The server reads one JSON-RPC message per line on stdin and writes one reply per line on stdout. From the repo root, in PowerShell or any POSIX shell:

```
node mcp/server.mjs
```

then paste a line such as `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` and press Enter; or pipe a single request in, e.g. `echo '<request line>' | node mcp/server.mjs` (in PowerShell, put the request in single quotes). Press Ctrl+C or close stdin to stop. Send `initialize` first if your client does; the server also answers `tools/list` and `tools/call` without it.

**What comes back.** The reply's `result.content[0].text` is plain text, one item per line:

1. the certificate sentence (for Ohm's law: "With the straightedge within ±0.5 mm of each mark, V reads within ±3 % of the formula.");
2. the method line: how many grid points and straightedge placements it was measured on, and the ×1.1 margin;
3. the maximum reading error found, with its type (relative or absolute);
4. a self-check line: formula against chart reading at 5 evenly spaced input pairs, with the largest relative difference;
5. `SVG written to <path>.` if `outFile` was given;
6. a `--- SVG ---` line followed by the whole A4 sheet as SVG, in millimetres.

**`outFile` rule.** The path must be relative to the workspace root, must not be absolute and must not contain `..`. Anything else is refused with an error and nothing is written. Missing folders are created.

**Errors.** A formula that does not parse, has other than two inputs, needs a range with min ≥ max, or is not one of the supported forms comes back as a JSON-RPC error with the compiler's message (and the character position for parse errors). Nothing is clamped or guessed.

## Performance

`test/studio.perf.test.js` times the three steps behind every redraw for each example. These are single cold runs (one call each, including JIT warm-up) on the author's machine, in Node, from `node --test test/studio.perf.test.js`:

| Example | `buildChart` (compile, layout, certificate) | `buildSheet` + `toSVG` | `toPDF` |
| --- | --- | --- | --- |
| ohms-law | 20.6 ms | 23.9 ms | 3.2 ms |
| bmi | 16.0 ms | 5.7 ms | 3.9 ms |
| body-surface-area | 14.6 ms | 2.6 ms | 2.2 ms |
| hypotenuse | 16.7 ms | 3.3 ms | 1.6 ms |
| reynolds | 19.5 ms | 2.2 ms | 2.0 ms |
| axial-stress | 12.8 ms | 2.9 ms | 1.8 ms |
| weighted-sum | 13.5 ms | 3.5 ms | 1.9 ms |

Formula typing is debounced by 250 ms. Dragging a handle does not redraw the sheet: it solves the line, moves the existing overlay elements and rewrites the readout text. There is no `requestAnimationFrame` loop. The test reads `src/ui/app.js` and checks that the drag path (`moveHandle`, `updateStraightedge`) never rebuilds the sheet; it is a source check, not a timed drag. Browser-side timing was not measured.

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
index.html, styles.css    the studio page (no build step)
src/core/                 pure, DOM-free engine (millimetres, SVG coordinates)
  expr.js                   tokenizer, parser, evaluator, printer
  compile.js                form recognition: sum, product, outer function, Z-chart
  pipeline.js               formula + ranges -> chart, layout, certificate (buildChart)
  scales.js, graduate.js    scale functions, tick generation
  layout.js                 scale geometry on the A4 sheet
  reader.js                 straightedge: two known values -> the third
  certificate.js            accuracy certificate
  sheet.js, svg.js, pdf.js  drawing items, SVG and PDF output
  text.js                   formula pretty-printing, number formatting, text widths
  examples.js               the seven built-in examples
src/ui/                   browser studio
  app.js                    wiring: form, sheet, straightedge, export (no exports)
  state.js                  DOM-free helpers: URL hash encode/decode, solved-scale
                            order, file names; unit- and property-tested in Node
mcp/server.mjs            MCP stdio server (make_nomogram)
test/                     unit, property and studio tests, plus QA-CHECKLIST.md
scripts/                  hook scripts (test gate, protected-path guard), shoot.py
.kiro/                    agents/, hooks/, settings/mcp.json, specs/, steering/
notes/                    brief, Kiro usage log, write-up and video drafts
rules/, work/             contest rules and scratch output; both git-ignored
```

## Licence

MIT, see [LICENSE](LICENSE).
