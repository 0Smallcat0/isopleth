# Chart Studio Design

## Overview

Chart Studio is a single-page application designed with a minimal, engineering-focused aesthetic. The sheet is the hero; the interface is restrained and focuses on clarity and precision. Desktop-first responsive design supports narrow viewports (1024 px and below) by stacking the panel and sheet vertically.

---

## Component Architecture

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Masthead (Isopleth + subtitle | Examples Help Print)        │
├─────────────────────────────────────────────────────────────┤
│ Desktop (≥1024 px):      │  Mobile (<1024 px):               │
│                          │                                    │
│ Panel (340px) | Sheet    │  Panel (full width)               │
│               |          │  Sheet (full width, stacked)      │
│               |          │  Readout + verification           │
│               |          │                                    │
└─────────────────────────────────────────────────────────────┘

Examples sidebar (right, or overlay modal)
How it works panel (modal, triggered by link)
Straightedge overlay (on sheet, interactive)
Readout strip (below sheet on mobile, side-by-side on desktop)
```

---

## State Model

All UI state is held in a single state object, updated synchronously:

```javascript
const state = {
  // Input form
  formula: "V = I * R",
  ranges: {
    I: {min: 0.01, max: 10, unit: "A"},
    R: {min: 1, max: 1000, unit: "Ω"}
  },
  layout: "parallel", // "parallel" | "z"
  deltaMm: 0.5,
  
  // Compiled chart and geometry
  chart: {/*ChartDefinition or {error: string}*/},
  layout: {/*Layout or null*/},
  certificate: {/*Certificate or null*/},
  
  // Straightedge interaction
  straightedge: {
    p1: {scale: 0, value: 2.0}, // Position on scale 0 (u)
    p2: {scale: 1, value: 5.0}, // Position on scale 1 (v)
    p3: {scale: 2, value: 10.0} // Solved: position on scale 2 (w)
  },
  lastMovedHandle: 2, // Index of the handle moved most recently
  
  // Display state
  showExamples: false,
  showHowItWorks: false,
  compileError: null, // {error: string, pos: number} or null
  
  // Viewport
  viewportWidth: 1024,
  viewportHeight: 768,
  
  // URL hash (serialized form of formula, ranges, layout, delta)
  urlHash: "..."
};
```

---

## Render Function

A pure render function updates the DOM based on state:

```javascript
function render(state, domElements) {
  // 1. Update panel fields
  updateFormulaField(state.formula);
  updateRangeFields(state.ranges);
  updateLayoutRadio(state.layout);
  updateToleranceField(state.deltaMm);
  updateCertificateSentence(state.certificate);
  
  // 2. Render sheet SVG
  if (state.chart && !state.chart.error && state.layout) {
    const svgString = renderSVG(state.layout, state.chart, state.certificate, state.straightedge);
    updateSheetElement(svgString);
  } else if (state.compileError) {
    updateSheetElement(renderErrorMessage(state.compileError));
  }
  
  // 3. Update straightedge overlay positions
  updateStraightedgeOverlay(state);
  
  // 4. Update readout strip
  updateReadoutStrip(state);
  
  // 5. Toggle panel visibility on mobile
  updateLayoutMode(state.viewportWidth);
}
```

---

## Event Flow

### Formula Input → Compile

```
User types formula
       ↓
250 ms debounce timer resets
       ↓
On debounce fire: Parse + Compile
       ↓
If error: displayError(state.compileError)
If success: state.chart = compiledChart
       ↓
Regenerate certificate
       ↓
render(state)
```

### Straightedge Drag

```
User presses pointer on handle
       ↓
Capture event on document (pointer-events: none except handles)
       ↓
On pointermove:
  - constrain to scale (project onto scale line)
  - update state.straightedge.p{handle} = constrained position
  - mark state.lastMovedHandle = moved handle index
       ↓
On pointerup:
  - solve for third handle using reader.readThirdScale(...)
  - update state.straightedge.p{third} = solved value
  - compute readout values
  - update verification delta
       ↓
render(state) at screen refresh rate
```

### Range or Tolerance Change

```
User edits min/max/unit/deltaMm field
       ↓
No debounce (immediate)
       ↓
Recompile chart
       ↓
Regenerate certificate
       ↓
Reset straightedge handles to default position (e.g., midpoint of ranges)
       ↓
render(state)
```

### URL Hash Update

```
User edits formula, ranges, layout, or tolerance
       ↓
After render: encode state → URL hash
       ↓
window.location.hash = encodedState (or history.replaceState)
       ↓
On page load: decode hash → initialize state
       ↓
render(state)
```

---

## Coordinate Transforms

### Screen to Sheet Millimetres

When the user drags a handle, we need to project screen coordinates (px) onto the sheet geometry (mm).

**Inverse transform:**

```javascript
function screenToSheet(screenPoint) {
  // Get SVG element on page
  const svgElement = document.querySelector('svg.sheet');
  
  // Get SVG's screen bounding rectangle
  const svgRect = svgElement.getBoundingClientRect();
  
  // Translate screen coords to SVG client coords
  const clientX = screenPoint.x - svgRect.left;
  const clientY = screenPoint.y - svgRect.top;
  
  // Get the SVG's CTM (current transformation matrix)
  const screenCTM = svgElement.getScreenCTM();
  
  // Invert to go from screen to SVG user space
  const inverseCtm = screenCTM.inverse();
  
  // Create SVG point and apply inverse transform
  const svgPoint = svgElement.createSVGPoint();
  svgPoint.x = clientX;
  svgPoint.y = clientY;
  const userPoint = svgPoint.matrixTransform(inverseCtm);
  
  return {x: userPoint.x, y: userPoint.y}; // (mm)
}
```

### Sheet Point to Scale Value

Once we have a point in sheet mm, project it onto the scale line and invert to get the value.

```javascript
function pointToScaleValue(layout, scaleIndex, sheetPointMm) {
  // Get scale geometry
  const scale = layout.scales[scaleIndex];
  const scaleLine = scale.extent; // {x1, y1, x2, y2}
  
  // Project point onto line segment
  const projectedT = projectPointOntoLine(sheetPointMm, scaleLine);
  
  // Clamp to [0, 1] (no extrapolation)
  const clampedT = Math.max(0, Math.min(1, projectedT));
  
  // Invert to get value
  const value = valueAtPoint(layout, scaleIndex, clampedT);
  
  return value;
}
```

### Handle Position Validation

Dragging a handle must:
1. Never leave the scale extent
2. Snap to scale geometry (1D constraint for vertical scales, 2D line for diagonal)
3. Update other handles via the reader

```javascript
function constrainHandleToScale(layout, scaleIndex, screenPoint) {
  // Convert to sheet mm
  const sheetMm = screenToSheet(screenPoint);
  
  // Get scale extent
  const scale = layout.scales[scaleIndex];
  const {x1, y1, x2, y2} = scale.extent;
  
  // Project onto scale line
  const t = projectPointOntoLine(sheetMm, {x1, y1, x2, y2});
  
  // Clamp to [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));
  
  // Convert back to value
  const value = valueAtPoint(layout, scaleIndex, clampedT);
  
  return value;
}
```

---

## Print CSS

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }
  
  .masthead,
  .panel,
  .readout-strip,
  .examples-sidebar,
  .how-it-works-panel {
    display: none;
  }
  
  .sheet-container {
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 0;
    overflow: visible;
  }
  
  svg.sheet {
    width: 210mm;
    height: 297mm;
  }
  
  /* Optional: include straightedge in print (checkbox in UI) */
  svg.straightedge {
    display: var(--include-straightedge-in-print, none);
  }
}
```

---

## URL Hash Format

State is encoded into the URL hash for sharing and bookmarking.

**Format (JSON-based, URL-encoded):**

```
#{"formula":"V=I*R","ranges":{"I":[0.01,10,"A"],"R":[1,1000,"Ω"]},"layout":"parallel","deltaMm":0.5}
```

Or, more readable (with base64 encoding):

```
#eyJmb3JtdWxhIjoiVj1JKlIiLCJyYW5nZXMiOnsiSSI6WzAuMDEsMTAsIkEiXSwiUiI6WzEsMTAwMCwiΩ"]}
```

**Parsing:**

```javascript
function parseHash(hash) {
  if (!hash) return null;
  
  try {
    // Remove leading '#'
    const encoded = hash.substring(1);
    
    // Decode from URL-safe base64 or JSON + encodeURIComponent
    const json = JSON.parse(decodeURIComponent(encoded));
    
    return {
      formula: json.formula,
      ranges: json.ranges, // {var: [min, max, unit], ...}
      layout: json.layout || "parallel",
      deltaMm: json.deltaMm || 0.5
    };
  } catch (e) {
    console.error("Invalid hash:", e);
    return null;
  }
}

function encodeHash(state) {
  const obj = {
    formula: state.formula,
    ranges: Object.entries(state.ranges).reduce((acc, [name, {min, max, unit}]) => {
      acc[name] = [min, max, unit];
      return acc;
    }, {}),
    layout: state.layout,
    deltaMm: state.deltaMm
  };
  
  return encodeURIComponent(JSON.stringify(obj));
}
```

---

## Accessibility

### Focus Management

- All interactive elements (form inputs, buttons, handles) are focusable via Tab
- No keyboard traps
- Visible focus ring on all focusable elements (2px outline, contrasting color)
- Straightedge handles are in tab order and keyboard-navigable (arrow keys)

### ARIA Regions

- `aria-live="polite"` on readout strip (updates when straightedge moves)
- `aria-live="assertive"` on error messages (announces errors immediately)
- `aria-label` on buttons and icon elements
- `<label for="...">` on all form inputs

### Semantic HTML

```html
<header class="masthead">
  <h1>Isopleth</h1>
  <nav>
    <a href="#examples">Examples</a>
    <a href="#how-it-works">How it works</a>
    <button onclick="printSheet()">Print</button>
  </nav>
</header>

<main class="studio-container">
  <aside class="panel">
    <form>
      <fieldset>
        <legend>Formula</legend>
        <textarea id="formula-field" aria-label="Formula input"></textarea>
        <div id="compile-error" aria-live="assertive"></div>
      </fieldset>
      
      <fieldset>
        <legend>Variables</legend>
        <!-- Range inputs -->
      </fieldset>
      
      <fieldset>
        <legend>Layout</legend>
        <label><input type="radio" name="layout" value="parallel"> Parallel</label>
        <label><input type="radio" name="layout" value="z"> Z-chart</label>
      </fieldset>
      
      <label for="delta-mm">Straightedge tolerance (±mm)</label>
      <input id="delta-mm" type="number" min="0.1" max="5" step="0.1" value="0.5">
      
      <div id="certificate-sentence"></div>
      
      <button type="button" onclick="downloadSVG()">Download SVG</button>
      <button type="button" onclick="printSheet()">Print / PDF</button>
    </form>
  </aside>
  
  <section class="sheet-area">
    <div id="sheet-container" class="sheet-container">
      <svg id="sheet" class="sheet"></svg>
      <svg id="straightedge-overlay" class="straightedge-overlay"></svg>
    </div>
    
    <div id="readout-strip" class="readout-strip" aria-live="polite" aria-label="Straightedge reading"></div>
    
    <div id="verification" class="verification"></div>
  </section>
</main>

<dialog id="examples-dialog">
  <h2>Examples</h2>
  <div id="examples-list"></div>
  <button onclick="closeDialog('examples-dialog')">Close</button>
</dialog>

<dialog id="how-it-works-dialog">
  <h2>How it works</h2>
  <section id="how-it-works-content"></section>
  <button onclick="closeDialog('how-it-works-dialog')">Close</button>
</dialog>
```

---

## Typography and Spacing

### Font Stack

- **UI (labels, buttons, text):** `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- **Monospace (formulas, numbers):** `ui-monospace, Menlo, Monaco, 'Courier New', monospace`

### Sizes

- Masthead: 16px (wordmark), 12px (subtitle), 14px (links)
- Panel labels: 13px
- Formula field: 14px (monospace)
- Range inputs: 14px
- Buttons: 14px, 8px padding
- Readout: 16px (monospace, tabular-nums)
- Error messages: 12px (vermilion)

### Spacing (px)

- Panel width: 340 px
- Panel padding: 16 px
- Form row gap: 12 px
- Sheet margin (desktop tone): 8 px
- Straightedge handle radius: 6 px
- Readout line-height: 1.5

---

## Color Specification

| Element | Color | Purpose |
|---------|-------|---------|
| Background (page) | #f4f1ea | Off-white, paper tone |
| Background (desk tone around sheet) | #e8e6e1 | Slightly darker, visual separation |
| Text, rules, scales | #1f1e1c | Sumi ink, high contrast |
| Straightedge, active value | #c43c25 | Vermilion accent |
| Panel background | #f4f1ea | Same as page (no distinction) |
| Form inputs (background) | #1f1e1c | Dark field, light text |
| Form inputs (text) | #f4f1ea | Light text |
| Borders (hairline) | #1f1e1c | Thin rules, 0.5 px |
| Focus ring | #c43c25 | Vermilion, 2–3 px outline |
| Error text | #c43c25 | Vermilion, alerts |

---

## DOM-Free Helpers (src/ui/state.js)

Pure functions for state management, testable in Node without DOM:

```javascript
/**
 * Encode state to URL-safe hash.
 * @param {object} state
 * @returns {string}
 */
export function encodeStateToHash(state);

/**
 * Decode state from hash.
 * @param {string} hash
 * @returns {object | null}
 */
export function decodeStateFromHash(hash);

/**
 * Validate and normalize a range object.
 * @param {Record<string, [number, number, string]>} ranges
 * @returns {Record<string, {min, max, unit}> | {error: string}}
 */
export function normalizeRanges(ranges);

/**
 * Compute straightedge values given two inputs and the chart.
 * @param {object} state
 * @param {number} knownScale - Index of known scale (0 or 1)
 * @param {number} knownValue
 * @returns {{p1, p2, p3} | {error: string}}
 */
export function solveStraightedge(state, knownScale, knownValue);

/**
 * Format readout line from straightedge values.
 * @param {object} state
 * @returns {string}
 */
export function formatReadout(state);

/**
 * Compute verification delta (reader output vs formula evaluation).
 * @param {object} state
 * @returns {number}
 */
export function computeVerificationDelta(state);
```

---

## Responsiveness

### Desktop (≥ 1024 px)

- Masthead: sticky or fixed at top, 60 px height
- Panel: fixed left sidebar, 340 px wide
- Sheet area: flex-grow, scaled to fill viewport height
- Readout: below sheet, or in panel
- Examples: sidebar on right or modal
- How it works: modal overlay

### Narrow (< 1024 px)

- Masthead: fixed at top, 60 px height
- Panel: full width, scrollable, followed by sheet
- Sheet area: full width, scaled to viewport
- Readout: below sheet, full width
- Examples: modal overlay
- How it works: modal overlay

### Layout CSS

```css
@media (min-width: 1024px) {
  body {
    display: grid;
    grid-template-columns: 340px 1fr;
    grid-template-rows: 60px 1fr;
  }
  
  .masthead {
    grid-column: 1 / -1;
  }
  
  .panel {
    grid-row: 2;
    grid-column: 1;
    overflow-y: auto;
    border-right: 1px solid #1f1e1c;
  }
  
  .sheet-area {
    grid-row: 2;
    grid-column: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }
}

@media (max-width: 1023px) {
  body {
    display: grid;
    grid-template-rows: 60px auto auto;
  }
  
  .masthead {
    grid-row: 1;
  }
  
  .panel {
    grid-row: 2;
    width: 100%;
    overflow-y: auto;
    max-height: 50vh;
    border-bottom: 1px solid #1f1e1c;
  }
  
  .sheet-area {
    grid-row: 3;
    width: 100%;
    overflow-y: auto;
  }
}
```

---

## Error States

### Formula Compile Error

```
┌─ Formula ─────────────────┐
│ V = I * R / (missing)     │
│                           │
│ Parse error at position 15│
│                  ^         │
└─────────────────────────────┘
```

### Out-of-Range

```
Straightedge reading: V = out-of-range
```

### Invalid Range

```
┌─ Variable R ──────────────┐
│ min: 1000                 │
│ max: 1      ← error       │
│ (min ≥ max)               │
└─────────────────────────────┘
```

