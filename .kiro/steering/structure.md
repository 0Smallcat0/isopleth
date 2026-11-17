---
inclusion: always
---

# Isopleth Project Structure

## Directory Layout

```
isopleth/
├── index.html              # Entry page (GitHub Pages root)
├── styles.css              # Global styles
├── README.md               # Project overview
├── package.json            # Dependencies: fast-check (dev)
├── LICENSE                 # OSI license (MIT)
├── .gitignore
├── .kiro/
│   └── steering/           # Steering files (always included)
│       ├── product.md
│       ├── tech.md
│       ├── structure.md
│       ├── nomography-math.md
│       └── testing.md
│   └── settings/
│       └── mcp.json        # MCP server registration
├── src/
│   ├── core/
│   │   ├── expr.js         # Tokenizer, parser, evaluator, printer
│   │   ├── compile.js      # Form recognition → chart definition
│   │   ├── scales.js       # Scale functions, tick generation
│   │   ├── layout.js       # Geometry in mm
│   │   ├── reader.js       # Straightedge: line → value on third scale
│   │   ├── certificate.js  # Accuracy certificate generator
│   │   ├── svg.js          # SVG serialisation, title block, calibration bar
│   │   └── examples.js     # Built-in example formulas
│   └── ui/
│       ├── app.js          # Wiring (form input, output, straightedge)
│       ├── straightedge.js # Pointer/keyboard dragging interaction
│       └── print.js        # Print and export functions
├── mcp/
│   └── server.mjs          # MCP stdio server (make_nomogram tool)
├── test/
│   ├── expr.test.js
│   ├── expr.property.test.js
│   ├── compile.test.js
│   ├── compile.property.test.js
│   ├── scales.test.js
│   ├── scales.property.test.js
│   ├── layout.test.js
│   ├── layout.property.test.js
│   ├── reader.test.js
│   ├── reader.property.test.js
│   ├── certificate.test.js
│   ├── certificate.property.test.js
│   ├── svg.test.js
│   ├── svg.property.test.js
│   └── integration.test.js # End-to-end tests
└── notes/
    ├── brief.md            # Hackathon brief
    └── kiro-usage-log.md   # Honest record of Kiro usage
```

## Naming Conventions

- **Functions:** camelCase
- **Files (core modules):** expr.js, compile.js, scales.js, layout.js, reader.js, certificate.js, svg.js (no hyphens)
- **Files (UI, tests, other):** kebab-case (e.g., straightedge.js, print.js, app.js)
- **Exports:** Named exports only; no default exports
- **JSDoc:** Type annotations on all exported functions

## Core Modules

### expr.js
Tokenizer, parser, evaluator, printer for mathematical expressions.
- Parse infix notation (e.g., `sqrt(a^2 + b^2)`)
- Evaluate safely with given bindings
- Print back to infix for display

### compile.js
Form recognition and chart definition generation.
- Identify separable forms (sum, product, outer function, Z-chart)
- Return chart definition with scale functions, moduli, offsets
- Return clear error if form is not supported

### scales.js
Scale functions and tick generation.
- Apply scale function (linear, logarithmic, outer function)
- Generate ticks and labels for a given range and precision
- Handle monotonicity and out-of-range detection

### layout.js
Geometry calculations in millimetres.
- Compute positions of three scales (parallel or Z-chart)
- Compute moduli and offsets to fill the printable area
- Return coordinates of tick marks and labels

### reader.js
Interactive straightedge; read the value on the third scale.
- Solve the collinearity constraint det([[x1,y1,1],[x2,y2,1],[x3,y3,1]]) = 0
- Use bracketed root finding with explicit tolerance
- Report out-of-range instead of extrapolating

### certificate.js
Accuracy certificate generator.
- Perturb known points by ±delta mm (all sign combinations)
- Grid sample input pairs uniformly over the ranges
- Read the third value on each perturbation; report max error
- Multiply by 1.1 safety factor; report grid size

### svg.js
SVG serialisation and title block.
- Render scales, ticks, labels, grid lines, straightedge guides
- Add 100 mm calibration bar
- Add drafting title block (formula, ranges, accuracy, sheet size)
- Output SVG with width/height in mm and viewBox in mm

## UI Modules

### app.js
Main entry point; wiring.
- Form input (formula, u range, v range, w range)
- Parse and compile
- Render chart SVG
- Wire up straightedge interaction
- Export / print controls

### straightedge.js
Interactive straightedge.
- Listen to pointer events (mouse, touch)
- Allow drag on two scale handles
- Compute line through the two points
- Call reader to find the third value
- Highlight active value and guide lines

### print.js
Print and export functions.
- Generate SVG at true scale (mm)
- Trigger browser print dialog
- Generate download link (SVG file)
- Generate print-to-PDF flow

## MCP Server

### server.mjs
Exposes `make_nomogram` tool via stdio JSON-RPC.
- Input: formula, u_range, v_range, w_range, options (delta_mm, sheet_size)
- Output: SVG string, accuracy certificate, verification summary
- Uses core modules unchanged (expr, compile, layout, reader, certificate, svg)
