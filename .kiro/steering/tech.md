---
inclusion: always
---

# Isopleth Technical Stack

## Architecture

**Static site, no build step, no backend.** Deploys to GitHub Pages as-is. Works offline after first load.

### Frontend
- **Vanilla JavaScript ES modules** (ES2022), HTML, CSS, SVG
- No frameworks, no runtime CDN dependencies
- DOM-free core modules (parser, compiler, layout, reader, certificate, svg) so they run in Node tests and MCP server unchanged

### Testing
- **Test runner:** node:test (built-in, no external runner)
- **Property-based testing:** fast-check (devDependency)
- **Command:** `npm test` runs all unit tests and properties

### MCP Server
- Node script using stdio JSON-RPC (no SDK dependency)
- Exposes `make_nomogram` tool that returns SVG + accuracy certificate + verification summary
- Registered in `.kiro/settings/mcp.json`

### Tooling
- Node >= 20 (for tooling only; runtime is browser ES2022)

## Geometry and Units

- **Layout geometry:** all measurements in millimetres
- **SVG output:** width/height in mm, viewBox in mm so 1 user unit = 1 mm
- **Printing:** true-scale export; 100 mm calibration bar on every sheet; drafting title block

## Numerics

- Double precision throughout
- Root finding: bracketed bisection/Brent with explicit tolerance
- **Error handling:** never silently clamp out-of-range values; return a typed error instead

## Offline-First
- No web fonts (system fonts only)
- No runtime CDN dependencies
- Assets load from same origin
- Interactive straightedge works entirely in JavaScript (no external geometry library)
