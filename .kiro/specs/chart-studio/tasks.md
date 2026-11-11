# Chart Studio Tasks

## Overview

This task list breaks down the Chart Studio single-page app (SPA) into small, testable steps. Each task is estimated at ≤ ~1 hour. Tasks are ordered so that dependencies are met (e.g., state module before app.js, event handlers before print/export).

---

## T1: Project Structure and HTML Scaffold
**Requirements:** Infrastructure, R1–R14  
**Effort:** 30 min

- Create `index.html` at workspace root
- Add meta tags: viewport, charset, og: tags for social preview
- Create basic DOM structure:
  - `<header class="masthead">`
  - `<main class="studio-container">` with `<aside class="panel">` and `<section class="sheet-area">`
  - Dialog elements for examples and how-it-works
  - SVG containers for sheet and straightedge overlay
- Reference `styles.css` and modules: `src/ui/app.js`
- Verify page loads without errors

---

## T2: Global Styles (styles.css)
**Requirements:** R11 (design), R1–R2 (layout)  
**Effort:** 45 min

- Define CSS custom properties (variables) for colors:
  - `--color-bg: #f4f1ea`
  - `--color-desk: #e8e6e1`
  - `--color-ink: #1f1e1c`
  - `--color-accent: #c43c25`
- Define font-family stacks for UI and monospace
- Set `font-variant-numeric: tabular-nums` for numeric values
- Define global resets: `* { box-sizing: border-box }`, margin/padding on body
- Masthead styles: hairline border-bottom, flex layout, small caps on wordmark
- Panel styles (340 px width, fixed/absolute depending on viewport)
- Sheet container styles: desk tone background, margin, centered
- Form styles: no border-radius, monospace inputs, clear labels
- Button styles: hairline border, no shadow, visible focus ring
- Responsive grid layout (desktop vs narrow, R1.1–R1.2)
- Print styles (hide UI, show sheet only, true scale)
- Visible focus rings on all interactive elements (outline: 2px solid --color-accent)

---

## T3: DOM-Free State Helpers (src/ui/state.js)
**Status:** done  
**Requirements:** R10, P1 (URL hash round-trip)  
**Effort:** 60 min

Implement testable functions (no DOM, run in Node):

```javascript
/**
 * Encode state to URL hash (JSON + encodeURIComponent).
 * @param {object} state - {formula, ranges, layout, deltaMm}
 * @returns {string} Encoded hash fragment
 */
export function encodeStateToHash(state);

/**
 * Decode hash back to state.
 * @param {string} hash - URL fragment (with or without #)
 * @returns {object | null} Parsed state, or null if invalid
 */
export function decodeStateFromHash(hash);

/**
 * Initialize default state.
 * @returns {object}
 */
export function getDefaultState();

/**
 * Validate ranges: min < max, positive for log forms, etc.
 * @param {Record<string, {min, max, unit}>} ranges
 * @returns {{valid: boolean, error?: string}}
 */
export function validateRanges(ranges);

/**
 * Normalize ranges from compact format [min, max, unit] to {min, max, unit}.
 * @param {Record<string, [number, number, string]>} compact
 * @returns {Record<string, {min, max, unit}>}
 */
export function normalizeRanges(compact);

/**
 * Format readout line (e.g., "I = 2.40 A   R = 120 Ω   →   V = 288 V").
 * @param {object} state
 * @returns {string}
 */
export function formatReadout(state);

/**
 * Compute verification delta (reader output vs direct formula evaluation).
 * @param {object} state
 * @returns {number}
 */
export function computeVerificationDelta(state);
```

- Implement hash encoding: JSON.stringify + encodeURIComponent
- Implement hash decoding: decodeURIComponent + JSON.parse with error handling
- All functions are pure (no side effects, no DOM access)
- Export all functions

---

## T4: Property Tests for State Helpers (test/state.property.test.js)
**Status:** done  
**Requirements:** P1, R15.1  
**Effort:** 30 min

Create `test/state.property.test.js` using fast-check:

- **Property P1 (hash round-trip):** FOR arbitrary states (formula, ranges, layout, deltaMm), encode to hash and decode → must equal original (or be equivalent after normalization)
  - Generate: `fc.record({formula: fc.string(), ranges: arbitraryRanges(), layout: fc.oneof(...), deltaMm: fc.double(...)})`
  - Assert: `decodeStateFromHash(encodeStateToHash(state)) ≈ state`
- Test with 200+ samples
- Run with `npm test`

---

## T5: Main App Module (src/ui/app.js)
**Requirements:** R3–R7, R10  
**Effort:** 120 min

Implement the main app wiring:

**Structure:**

```javascript
// State
let state = getDefaultState();

// DOM elements cache
const domElements = {
  formulaField: document.querySelector('#formula-field'),
  sheetContainer: document.querySelector('#sheet-container'),
  straightedgeOverlay: document.querySelector('#straightedge-overlay'),
  readoutStrip: document.querySelector('#readout-strip'),
  verificationLine: document.querySelector('#verification'),
  errorMessage: document.querySelector('#compile-error'),
  rangeFields: {}, // Populated dynamically
  layoutRadio: document.querySelectorAll('[name="layout"]'),
  deltaField: document.querySelector('#delta-mm'),
  certificateSentence: document.querySelector('#certificate-sentence'),
  examplesDialog: document.querySelector('#examples-dialog'),
  howItWorksDialog: document.querySelector('#how-it-works-dialog')
};

// Event listeners
setupEventListeners();

// Initialize on page load
function init() {
  // Restore state from URL hash, or use default
  const hashState = decodeStateFromHash(window.location.hash);
  if (hashState) {
    state = {...state, ...hashState};
  }
  
  render();
}

// Debounce timer for formula input
let debounceTimer;
function onFormulaChange(value) {
  clearTimeout(debounceTimer);
  state.formula = value;
  
  debounceTimer = setTimeout(() => {
    recompile();
    updateURLHash();
    render();
  }, 250);
}

function onRangeChange(varName, field, value) {
  // field: "min" | "max" | "unit"
  if (!state.ranges[varName]) {
    state.ranges[varName] = {min: 0, max: 1, unit: ""};
  }
  state.ranges[varName][field] = field === "unit" ? value : parseFloat(value);
  
  // Validate
  const validation = validateRanges(state.ranges);
  if (!validation.valid) {
    state.compileError = {error: validation.error};
  } else {
    state.compileError = null;
    recompile();
  }
  
  updateURLHash();
  render();
}

function onLayoutChange(layout) {
  state.layout = layout;
  recompile();
  updateURLHash();
  render();
}

function onDeltaChange(delta) {
  state.deltaMm = parseFloat(delta);
  
  // Regenerate certificate
  if (state.chart && !state.chart.error && state.layout) {
    state.certificate = generateCertificate(state.layout, state.chart, state.deltaMm);
  }
  
  updateURLHash();
  render();
}

function recompile() {
  // Parse formula
  const parts = splitFormula(state.formula);
  if (parts.error) {
    state.compileError = parts.error;
    state.chart = null;
    state.layout = null;
    return;
  }
  
  // Compile
  const tokens = tokenize(parts.rhs);
  const ast = parse(tokens);
  if (ast.error) {
    state.compileError = ast.error;
    state.chart = null;
    state.layout = null;
    return;
  }
  
  // Check ranges are valid
  const rangeValidation = validateRanges(state.ranges);
  if (!rangeValidation.valid) {
    state.compileError = {error: rangeValidation.error};
    state.chart = null;
    state.layout = null;
    return;
  }
  
  state.chart = compile(ast, parts.lhs, state.ranges, state.layout);
  if (state.chart.error) {
    state.compileError = state.chart.error;
    state.chart = null;
    state.layout = null;
    return;
  }
  
  state.compileError = null;
  
  // Compute layout
  state.layout = (state.layout === "z") ? layoutZChart(state.chart) : layoutParallel(state.chart);
  
  // Generate certificate
  state.certificate = generateCertificate(state.layout, state.chart, state.deltaMm);
  
  // Initialize straightedge at default position (midpoints)
  const midU = (state.ranges.u?.min + state.ranges.u?.max) / 2 || 1;
  const midV = (state.ranges.v?.min + state.ranges.v?.max) / 2 || 1;
  state.straightedge = {
    p1: {scale: 0, value: midU},
    p2: {scale: 1, value: midV},
    p3: {scale: 2, value: state.chart.evaluate(midU, midV)}
  };
  state.lastMovedHandle = 1; // Next drag will solve for p2
}

function render() {
  // Update form fields
  domElements.formulaField.value = state.formula;
  
  // Update range fields (create if needed)
  updateRangeFieldsInDOM();
  
  // Update layout radio
  domElements.layoutRadio.forEach(radio => {
    radio.checked = radio.value === state.layout;
  });
  
  // Update delta field
  domElements.deltaField.value = state.deltaMm;
  
  // Update certificate sentence
  if (state.certificate) {
    domElements.certificateSentence.textContent = formatCertificateSentence(state.certificate);
  }
  
  // Render sheet SVG or error
  if (state.chart && !state.chart.error && state.layout) {
    const svgString = renderSVG(state.layout, state.chart, state.certificate, null);
    domElements.sheetContainer.innerHTML = svgString;
  } else if (state.compileError) {
    domElements.sheetContainer.innerHTML = `<div class="error-display">${escapeHtml(state.compileError.error)}</div>`;
  } else {
    domElements.sheetContainer.innerHTML = '';
  }
  
  // Update straightedge overlay
  renderStraightedgeOverlay();
  
  // Update readout
  domElements.readoutStrip.textContent = formatReadout(state);
  
  // Update verification
  const delta = computeVerificationDelta(state);
  domElements.verificationLine.textContent = `straightedge vs formula: Δ = ${delta.toExponential(2)}`;
}

function updateURLHash() {
  const hash = encodeStateToHash(state);
  window.history.replaceState(null, '', '#' + hash);
}

function setupEventListeners() {
  // Formula input with debounce
  domElements.formulaField.addEventListener('input', (e) => onFormulaChange(e.target.value));
  
  // Layout radio
  domElements.layoutRadio.forEach(radio => {
    radio.addEventListener('change', (e) => onLayoutChange(e.target.value));
  });
  
  // Delta field
  domElements.deltaField.addEventListener('change', (e) => onDeltaChange(e.target.value));
  
  // Buttons
  document.querySelector('[onclick*="downloadSVG"]').addEventListener('click', downloadSVG);
  document.querySelector('[onclick*="printSheet"]').addEventListener('click', printSheet);
  
  // Examples and How it works
  document.querySelector('a[href="#examples"]').addEventListener('click', openExamplesDialog);
  document.querySelector('a[href="#how-it-works"]').addEventListener('click', openHowItWorksDialog);
  
  // Window resize
  window.addEventListener('resize', () => {
    state.viewportWidth = window.innerWidth;
    state.viewportHeight = window.innerHeight;
    render();
  });
  
  // Hash change (browser back/forward)
  window.addEventListener('hashchange', () => {
    const hashState = decodeStateFromHash(window.location.hash);
    if (hashState) {
      state = {...state, ...hashState};
      render();
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
```

---

## T6: Straightedge Interaction (src/ui/straightedge.js)
**Requirements:** R5, P2–P4  
**Effort:** 90 min

Implement pointer and keyboard interaction for dragging handles:

```javascript
/**
 * Initialize straightedge event handlers.
 * @param {object} state - State object (mutated)
 * @param {object} domElements - Cached DOM elements
 * @param {function} onUpdate - Callback when straightedge changes
 */
export function initStraightedgeInteraction(state, domElements, onUpdate);

/**
 * Screen coordinates to sheet mm (SVG user space).
 * @param {SVGElement} svgElement
 * @param {{x, y}} screenPoint - In screen pixels
 * @returns {{x, y}} In mm
 */
export function screenToSheet(svgElement, screenPoint);

/**
 * Project a point onto a line segment and return normalized position [0, 1].
 * @param {{x, y}} point
 * @param {{x1, y1, x2, y2}} line
 * @returns {number}
 */
export function projectPointOntoLine(point, line);

/**
 * Render straightedge overlay (handles + line).
 * @param {object} state
 * @param {SVGElement} overlayElement
 */
export function renderStraightedgeOverlay(state, overlayElement);
```

**Event flow:**

- `pointerdown` on handle: capture phase, store active handle index
- `pointermove` on document: constrain to scale, update state, call onUpdate
- `pointerup` on document: solve for third handle, call onUpdate
- Keyboard `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` on focused handle: move 1 mm or 0.1 mm (Shift+)

**Constraints:**

- Handle never leaves scale extent (clamp to [0, 1] of scale parameter)
- When handle is moved, solve for the third value using reader.readThirdScale(...)
- Track lastMovedHandle to determine which variable to solve for next

---

## T7: Unit Tests for Straightedge (test/straightedge.test.js)
**Requirements:** R5.3, R15  
**Effort:** 30 min

Create `test/straightedge.test.js`:

- Test `projectPointOntoLine`: given point and line, compute projection
- Test `screenToSheet`: mock SVG element with getScreenCTM, verify coordinate transform
- Test handle constraint: given new position, ensure it stays within scale extent
- Test straightedge drag sequence: move handle, solve for third, verify reader output ≈ expected
- Test keyboard navigation: Tab focus, arrow key movement

---

## T8: Print and Export Functions (src/ui/print.js)
**Requirements:** R9  
**Effort:** 45 min

Implement export and print functions:

```javascript
/**
 * Download SVG as a file.
 * @param {string} svgString
 * @param {string} fileName - Base name (e.g., "ohms-law")
 */
export function downloadSVG(svgString, fileName);

/**
 * Trigger browser print dialog.
 * The page CSS already handles hiding UI and scaling sheet to 100%.
 */
export function printSheet();

/**
 * Generate filename from formula.
 * @param {string} formula
 * @returns {string}
 */
export function generateFileName(formula);
```

- `downloadSVG`: create Blob, URL.createObjectURL, <a> click to trigger download
- `printSheet`: call `window.print()`
- `generateFileName`: replace spaces/operators with hyphens, sanitize, ensure .svg extension

---

## T9: Examples Panel (src/ui/examples.js)
**Requirements:** R7  
**Effort:** 30 min

Implement examples list and loading:

```javascript
/**
 * Render examples list in dialog.
 * @param {object} domElement - Dialog container
 * @param {function} onLoadExample - Callback when example is clicked
 */
export function renderExamplesList(domElement, onLoadExample);

/**
 * Open examples dialog.
 */
export function openExamplesDialog();

/**
 * Load an example into state.
 * @param {object} example - Example object from examples.js
 * @returns {object} New state
 */
export function loadExample(example);
```

- Fetch examples from src/core/examples.js
- Render list with name, formula, description
- Click handler: load example formula and ranges into state, recompile, render

---

## T10: "How it Works" Panel
**Requirements:** R8  
**Effort:** 20 min

Create dialog content (HTML in index.html, show/hide with JavaScript):

- Static HTML with five paragraphs (R8.1.1–R8.1.5)
- Dialog triggered by "How it works" link in masthead
- Close button or click-outside to dismiss

---

## T11: Responsive Layout Mobile Test
**Status:** done (browser part in scripts/shoot.py)  
**Requirements:** R1, R13  
**Effort:** 30 min

Verify responsive behavior:

- Test desktop (1024 px): side-by-side panel and sheet
- Test mobile (< 1024 px): panel and sheet stack vertically
- Test sheet scaling: fits viewport height, maintains aspect ratio
- Test touches: handles draggable on mobile with touch events (pointer events handle both)
- Manual testing with browser developer tools

---

## T12: Accessibility Audit
**Status:** done  
**Requirements:** R11.4–R11.8  
**Effort:** 30 min

Verify accessibility:

- Use axe DevTools or Lighthouse to check for WCAG AA compliance
- Verify all interactive elements are keyboard-focusable (Tab)
- Verify focus rings are visible (2–3 px contrasting color)
- Verify form labels are associated with inputs (for= or aria-label)
- Verify aria-live regions on readout and error messages
- Test with screen reader (NVDA, JAWS, or VoiceOver)

---

## T13: Manual QA Checklist Task
**Requirements:** R15.2  
**Effort:** 60 min

Create `test/QA-CHECKLIST.md` and perform manual tests:

- Formula input: type valid formula, verify compiles; type invalid formula, verify error with caret
- Range modification: edit min/max/unit, verify certificate regenerates
- Straightedge dragging: drag handle on sheet, verify third handle updates, readout updates
- Keyboard navigation: Tab through panel, Tab to handles, arrow keys move 1 mm, Shift+arrow 0.1 mm
- Print dialog: "Print / PDF" button triggers print dialog, sheet is at true scale (210 × 297 mm)
- SVG export: "Download SVG" saves file with correct name
- URL hash: modify formula/ranges, copy URL, open in new tab, verify state restored
- Examples: click "Examples", load example, verify formula and ranges populated
- "How it works": click link, verify panel displays, close works
- Mobile responsiveness: reduce viewport to < 1024 px, verify panel stacks above sheet
- Examples list loading (all 5 examples from nomogram-engine spec)
- Error states: invalid formula, out-of-range, negative range for log
- Examples list: each example loads and compiles successfully

Document results in QA-CHECKLIST.md.

---

## T14: Integration Test (test/chart-studio.integration.test.js)
**Requirements:** All (end-to-end)  
**Effort:** 45 min

Create `test/chart-studio.integration.test.js` using JSDOM or Puppeteer (if headless browser available):

- Load index.html in simulated DOM
- Set formula, ranges, layout, delta
- Verify SVG is rendered
- Simulate pointer drag on handle
- Verify straightedge updates and readout changes
- Verify URL hash is updated
- Simulate hash change (back button)
- Verify state restores
- Test download and print functions (may be limited in Node, use mocks)
- Run all five examples, verify charts compile and render

---

## T15: Code Review Checklist
**Status:** done  
**Requirements:** All  
**Effort:** 30 min

Review completeness:

- All DOM elements have aria-label or associated label
- All form inputs have visible labels
- All buttons have visible text (no icon-only buttons)
- No inline styles (all CSS in styles.css)
- No hardcoded colors (use CSS custom properties)
- All interactive elements have visible focus rings
- All event listeners are cleaned up or delegated
- Module exports are named (no default exports)
- No console.error or console.log left in production code
- Verify index.html, styles.css, app.js, straightedge.js, print.js, state.js exist and link correctly
- Verify no build step required (vanilla ES modules in browser)
- Verify offline capability: all assets from same origin, no CDN

---

## T16: Performance Optimization
**Requirements:** R13  
**Effort:** 30 min

Optimize if needed:

- Verify debounce timer on formula input (250 ms, R3.1)
- Verify SVG rendering doesn't block on straightedge drag
- Verify readout updates at screen refresh rate (requestAnimationFrame)
- Measure initial load time and compile time for typical formula
- Profile with DevTools Performance tab
- Document any bottlenecks in README

---

## T17: Documentation
**Requirements:** Project completeness  
**Effort:** 30 min

- Update README.md with:
  - Chart Studio feature description
  - How to use (enter formula, drag straightedge, export)
  - Keyboard shortcuts (arrow keys on handles, Tab to navigate)
  - Browser support (ES2022, all modern browsers)
  - URL hash sharing
  - Offline capability
- Add JSDoc comments to all exported functions in src/ui/*.js
- Explain src/ui/state.js: testable DOM-free helpers

---

## Summary

- **Total tasks:** 17
- **Estimated effort:** ~11 hours (includes manual testing and QA)
- **Tasks with tests:** T4 (property tests), T7 (unit tests), T13 (manual QA), T14 (integration)
- **No optional tasks:** All are required for a complete Chart Studio MVP

---

## Dependency Order

1. T1 (HTML scaffold)
2. T2 (styles.css)
3. T3 (state helpers)
4. T4 (state property tests)
5. T5 (app.js wiring)
6. T6 (straightedge interaction)
7. T7 (straightedge unit tests)
8. T8 (print/export)
9. T9 (examples)
10. T10 (how-it-works)
11. T11–T17 (testing, integration, docs, optimization)

