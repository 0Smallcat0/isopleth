# Chart Studio Requirements

## Overview

Chart Studio is the browser-based single-page application (SPA) for Isopleth. It provides a live interactive interface to compose formulas, preview nomograms at true scale, and export or print at high fidelity. The studio runs entirely client-side on GitHub Pages, requires no backend, and works offline after first load.

---

## Scope

Chart Studio comprises:
- `index.html`: single-page entry point
- `styles.css`: global design system (palette, typography, layout)
- `src/ui/app.js`: main wiring and state management
- `src/ui/straightedge.js`: pointer/keyboard interaction and dragging
- `src/ui/state.js`: DOM-free state helpers (testable in Node)
- `src/ui/print.js`: print and SVG export functions

Chart Studio uses the nomogram engine (src/core/*) without modification.

---

## R1: Layout and Breakpoints

**R1.1** WHEN the viewport width is ≥ 1024 px, THE SYSTEM SHALL use a side-by-side layout:
- **R1.1.1** Left panel: approximately 340 px wide
- **R1.1.2** Main area: remaining width, hosting the sheet

**R1.2** WHEN the viewport width is < 1024 px, THE SYSTEM SHALL stack the panel above the sheet and allow vertical scrolling.

**R1.3** THE SYSTEM SHALL preserve sheet proportions (A4 portrait: 210 × 297 mm) at all scales.

**R1.4** THE SYSTEM SHALL scale the sheet to fit within the viewport height with a small desk tone margin (e.g., 8 px background outside the sheet).

**R1.5** WHEN the sheet is scaled, the straightedge overlay and all interactive handles SHALL scale proportionally.

---

## R2: Masthead

**R2.1** THE SYSTEM SHALL render a masthead bar with a single hairline horizontal rule at the top (0.5 px border-bottom).

**R2.2** THE SYSTEM SHALL left-align:
- **R2.2.1** Wordmark "Isopleth" in small caps
- **R2.2.2** Subtitle line: "Formula → paper calculator" (smaller text, slightly lighter color)

**R2.3** THE SYSTEM SHALL right-align three text links:
- **R2.3.1** "Examples"
- **R2.3.2** "How it works"
- **R2.3.3** "Print"

**R2.4** THE SYSTEM SHALL NOT include hero images, marketing copy, icons, or Halloween decoration.

---

## R3: Left Panel — Form Input

**R3.1** WHEN the user enters a formula, THE SYSTEM SHALL apply a 250 ms debounce before attempting to parse and compile.

**R3.2** THE SYSTEM SHALL render a "Formula" field with:
- **R3.2.1** Monospace font (ui-monospace, Menlo, Monaco, or equivalent)
- **R3.2.2** Dark background (#1f1e1c) with light text (#f4f1ea) for contrast
- **R3.2.3** Sufficient height to view formulas up to three lines
- **R3.2.4** Copy-paste support for sharing

**R3.3** IF a compile error occurs, THE SYSTEM SHALL:
- **R3.3.1** Display an error message in small text below the formula field in vermilion (#c43c25)
- **R3.3.2** Show a caret (^) under the error position in the formula
- **R3.3.3** Clear the error and recompile when the formula is edited

**R3.4** FOR each input variable detected by the compiler, THE SYSTEM SHALL render a row containing:
- **R3.4.1** Variable name (read-only, monospace)
- **R3.4.2** "min" field (number input, left-aligned)
- **R3.4.3** "max" field (number input, left-aligned)
- **R3.4.4** "unit" field (text input, optional)

**R3.5** WHEN a user modifies a range field (min, max, unit), THE SYSTEM SHALL immediately update the preview without debounce.

**R3.6** THE SYSTEM SHALL render a "Layout" radio group with options:
- **R3.6.1** "Parallel" (always enabled)
- **R3.6.2** "Z-chart" (enabled only if the compiler indicates the formula is a ratio form)

**R3.7** THE SYSTEM SHALL render a "Straightedge tolerance (±mm)" number field with:
- **R3.7.1** Default value: 0.5
- **R3.7.2** Minimum: 0.1, maximum: 5.0, step: 0.1

**R3.8** WHEN the tolerance is modified, THE SYSTEM SHALL regenerate the certificate and rerender.

**R3.9** THE SYSTEM SHALL display the accuracy certificate as a single sentence below the tolerance field, updated whenever the chart changes.

**R3.10** THE SYSTEM SHALL render two action buttons at the bottom of the panel:
- **R3.10.1** "Download SVG" (triggers export as file)
- **R3.10.2** "Print / PDF" (triggers browser print dialog)

---

## R4: Main Area — Sheet Preview

**R4.1** WHEN a valid chart definition exists, THE SYSTEM SHALL render the SVG output from svg.js in the main area.

**R4.2** THE SYSTEM SHALL render the sheet on a slightly darker background (desk tone, e.g., #e8e6e1 or similar) to provide visual separation.

**R4.3** THE SYSTEM SHALL position the sheet with:
- **R4.3.1** Small margin around it (≥ 8 px) on the desktop tone background
- **R4.3.2** True aspect ratio maintained (210:297)
- **R4.3.3** Scaled to fit the viewport height on desktop, respecting aspect ratio

**R4.4** WHEN the sheet is scaled for screen viewing, THE SYSTEM SHALL NOT alter any measurements in millimetres (scale is visual only).

**R4.5** WHEN no valid chart exists (e.g., unsupported formula, out-of-range input), THE SYSTEM SHALL display the compiled error message in the sheet area or remain blank.

---

## R5: Straightedge Overlay

**R5.1** WHEN a valid chart is rendered, THE SYSTEM SHALL display an interactive straightedge overlay consisting of:
- **R5.1.1** A vermilion (#c43c25) line connecting three round handles (one per scale)
- **R5.1.2** Three draggable circular handles, each on its respective scale

**R5.2** WHEN a user drags a handle, THE SYSTEM SHALL:
- **R5.2.1** Constrain movement to the scale line (projected to 1D if not already vertical)
- **R5.2.2** Prevent the handle from leaving the scale range
- **R5.2.3** Identify which handle was moved most recently

**R5.3** WHEN a handle is moved and released, THE SYSTEM SHALL:
- **R5.3.1** Compute which of the three scales represents the "solved for" variable (the one moved least recently)
- **R5.3.2** Call reader.readThirdScale(...) to compute the third value
- **R5.3.3** Update the handle positions to reflect the solution

**R5.4** WHEN a solve-for value falls outside its scale range, THE SYSTEM SHALL:
- **R5.4.1** Leave that handle at the edge of its range
- **R5.4.2** Display an in-line "out-of-range" indicator or dim the handle

**R5.5** THE SYSTEM SHALL update a live readout showing the three solved values (see R6.1–R6.3).

**R5.6** THE SYSTEM SHALL make handles keyboard-focusable (Tab order).

**R5.7** WHEN a handle has focus, THE SYSTEM SHALL support:
- **R5.7.1** Arrow keys: move 1 mm along the scale
- **R5.7.2** Shift + arrow keys: move 0.1 mm

**R5.8** WHEN keyboard input moves a handle, THE SYSTEM SHALL treat it the same as a drag: update the third handle and readout.

---

## R6: Readout Strip

**R6.1** BELOW the sheet, THE SYSTEM SHALL display a readout strip showing the current straightedge solution in the format: `I = 2.40 A   R = 120 Ω   →   V = 288 V`

**R6.2** THE SYSTEM SHALL:
- **R6.2.1** Right-align column 1 (first two variables)
- **R6.2.2** Use tabular numerals (monospace numbers) for all numeric values
- **R6.2.3** Color the computed (third) value in vermilion (#c43c25)
- **R6.2.4** Include unit strings extracted from the panel input fields

**R6.3** IMMEDIATELY below the readout, THE SYSTEM SHALL display a quiet verification line: `straightedge vs formula: Δ = 2e-13` showing the difference between the geometric reading and direct evaluation at the current straightedge position.

---

## R7: Examples Sidebar (or Panel)

**R7.1** THE SYSTEM SHALL provide access to the example list (from src/core/examples.js) via:
- **R7.1.1** A collapsible "Examples" section in the left panel, OR
- **R7.1.2** A separate examples list on the right side, OR
- **R7.1.3** Triggered by the "Examples" link in the masthead

**R7.2** FOR each example, THE SYSTEM SHALL display:
- **R7.2.1** Example name
- **R7.2.2** Formula string
- **R7.2.3** Optional brief description (one line)

**R7.3** WHEN a user clicks an example, THE SYSTEM SHALL:
- **R7.3.1** Load the formula into the formula field
- **R7.3.2** Load the ranges into the min/max fields
- **R7.3.3** Select the appropriate layout (parallel or z)
- **R7.3.4** Trigger recompilation and re-render

---

## R8: "How it works" Panel

**R8.1** WHEN the user clicks "How it works" in the masthead, THE SYSTEM SHALL display a modal, overlay panel, or details/summary element containing five short paragraphs:

**R8.1.1** What is a nomogram? (1–2 sentences): A nomogram is a graphical calculator where three scales align along a straightedge to solve a formula without computation.

**R8.1.2** Historical context (1 sentence): The technique was invented by Philbert d'Ocagne in 1884 and was standard in engineering until digital calculators became ubiquitous.

**R8.1.3** How to read (2 sentences): Place a straightedge connecting two known values on their scales. The straightedge crosses the third scale at the answer. No power required.

**R8.1.4** Accuracy statement (1–2 sentences): Every printed chart includes an accuracy certificate showing the worst-case reading error from straightedge placement uncertainty. The certificate is verified computationally.

**R8.1.5** Offline guarantee (1 sentence): The printed chart works anywhere with a straightedge and no internet or device.

**R8.2** THE SYSTEM SHALL close the panel when the user clicks "close" or clicks outside the panel.

---

## R9: Print and Export

**R9.1** WHEN the user clicks "Download SVG", THE SYSTEM SHALL:
- **R9.1.1** Create a Blob from the SVG string
- **R9.1.2** Generate a filename from the formula or a user-provided title (e.g., `nomogram_V-I-R.svg` or `ohms-law.svg`)
- **R9.1.3** Trigger a download with the generated filename

**R9.2** WHEN the user clicks "Print / PDF", THE SYSTEM SHALL:
- **R9.2.1** Trigger the browser print dialog (Ctrl/Cmd+P or equivalent)
- **R9.2.2** Set print CSS to render the sheet at 100% (true scale, 1 mm on screen = 1 mm on paper)

**R9.3** THE SYSTEM SHALL provide a print CSS rule:
- **R9.3.1** `@page { size: A4 portrait; margin: 0; }`
- **R9.3.2** Sheet element: `width: 210mm; height: 297mm; margin: 0; padding: 0;`
- **R9.3.3** Hide the panel and overlay elements during print

**R9.4** THE SYSTEM SHALL optionally allow the user to choose whether to include the interactive straightedge line in the printed output (default: off).

**R9.5** THE SYSTEM SHALL ensure all printed output is grayscale-friendly (no color-only information).

---

## R10: URL State (Hash Serialization)

**R10.1** WHEN the user modifies the formula or ranges, THE SYSTEM SHALL encode the current state into the URL hash (fragment identifier).

**R10.2** THE SYSTEM SHALL include in the hash:
- **R10.2.1** Formula string
- **R10.2.2** For each variable: min, max, unit
- **R10.2.3** Layout ('parallel' or 'z')
- **R10.2.4** Straightedge tolerance (deltaMm)

**R10.3** WHEN the page loads with a hash, THE SYSTEM SHALL:
- **R10.3.1** Parse the hash
- **R10.3.2** Restore the formula, ranges, layout, and tolerance
- **R10.3.3** Recompile and render

**R10.4** THE SYSTEM SHALL use a URL-safe encoding (e.g., base64 or JSON-based with URL encoding) for the hash format.

**R10.5** THE SYSTEM SHALL allow users to share a URL containing the hash to replicate a chart.

---

## R11: Design and Accessibility

**R11.1** THE SYSTEM SHALL use the design palette from product steering:
- **R11.1.1** Background: off-white #f4f1ea
- **R11.1.2** Text, rules, scales: sumi ink #1f1e1c
- **R11.1.3** Accent (straightedge, active value): vermilion #c43c25

**R11.2** THE SYSTEM SHALL use only system fonts (no web font downloads):
- **R11.2.1** UI text (labels, buttons): system font stack (e.g., -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
- **R11.2.2** Numbers and formulas: ui-monospace (or Menlo, Monaco, etc.)
- **R11.2.3** All numeric values: tabular numerals (font-variant-numeric: tabular-nums)

**R11.3** THE SYSTEM SHALL use hairline rules (1 px or 0.5 px borders) with no gradients, drop shadows, rounded corners, or emoji.

**R11.4** THE SYSTEM SHALL meet WCAG AA contrast requirements:
- **R11.4.1** Sumi ink (#1f1e1c) on off-white (#f4f1ea): ≥ 4.5:1
- **R11.4.2** Vermilion (#c43c25) on off-white (#f4f1ea): ≥ 3:1
- **R11.4.3** Form inputs: dark text on light, or light text on dark, contrast ≥ 4.5:1

**R11.5** THE SYSTEM SHALL render visible focus rings on all interactive elements:
- **R11.5.1** Handles, buttons, links: visible outline (2–3 px, contrasting color)
- **R11.5.2** Focus ring must not be confused with active/hover state

**R11.6** THE SYSTEM SHALL provide aria-live regions for dynamically updated content:
- **R11.6.1** Readout strip (R6.1–R6.3) marked as aria-live="polite"
- **R11.6.2** Error messages (R3.3) marked as aria-live="assertive"

**R11.7** THE SYSTEM SHALL support keyboard navigation:
- **R11.7.1** Tab through panel fields and buttons
- **R11.7.2** Tab through straightedge handles (R5.6–R5.7)
- **R11.7.3** No keyboard traps

**R11.8** THE SYSTEM SHALL label all form inputs with associated `<label>` elements or aria-label.

---

## R12: Error Handling

**R12.1** WHEN a compile error occurs, THE SYSTEM SHALL display it in the sheet area or near the formula field (not hide silently).

**R12.2** WHEN a formula is unsupported, THE SYSTEM SHALL show the supported forms in the error message (from compile.js).

**R12.3** WHEN range input is invalid (e.g., min ≥ max, negative range for log form), THE SYSTEM SHALL:
- **R12.3.1** Display an error tooltip or inline message
- **R12.3.2** Prevent compilation until corrected

**R12.4** WHEN the straightedge cannot find a solution (out-of-range or geometric error), THE SYSTEM SHALL display the error in or near the readout.

**R12.5** THE SYSTEM SHALL never display uncaught JavaScript errors to the user; log them to console for debugging only.

---

## R13: Performance

**R13.1** THE SYSTEM SHALL apply a 250 ms debounce to formula input (R3.1) to avoid excessive recompilation.

**R13.2** THE SYSTEM SHALL render the SVG once per chart change and reuse the DOM element on pan/zoom.

**R13.3** WHEN dragging the straightedge, THE SYSTEM SHALL update the readout at screen refresh rate (60 FPS) without lag.

**R13.4** THE SYSTEM SHALL not block user interaction while compiling or generating certificates.

---

## R14: Offline and Deployment

**R14.1** THE SYSTEM SHALL NOT require any runtime CDN dependencies or web fonts.

**R14.2** THE SYSTEM SHALL load all assets (JavaScript, CSS, SVG icons if any) from the same origin.

**R14.3** THE SYSTEM SHALL be deployable to GitHub Pages as-is with no build step.

**R14.4** AFTER the first load, THE SYSTEM SHALL work offline (all assets cached by service worker or browser cache headers).

---

## R15: Testing

**R15.1** THE SYSTEM SHALL include property-based tests for DOM-free helpers in src/ui/state.js.

**R15.2** THE SYSTEM SHALL include a manual QA checklist covering:
- **R15.2.1** Formula input and error display
- **R15.2.2** Range modification and recompilation
- **R15.2.3** Straightedge dragging and keyboard interaction
- **R15.2.4** Print and export
- **R15.2.5** URL hash round-trip
- **R15.2.6** Examples loading
- **R15.2.7** "How it works" panel
- **R15.2.8** Mobile responsiveness (< 1024 px)

---

## Universal Properties

**P1** WHEN the URL hash is set and the page reloads, THE SYSTEM SHALL restore all state (formula, ranges, layout, tolerance) identically.

**P2** WHEN the straightedge position is solved for the third handle, THE SYSTEM SHALL verify that reader.readThirdScale(...) output ≈ direct formula evaluation within numerical tolerance.

**P3** WHEN a handle is constrained to the scale range, ITS POSITION SHALL never leave the scale extent.

**P4** WHEN the sheet is scaled for viewport height, ALL interactive elements (handles, touch targets) SHALL scale proportionally; hit testing SHALL remain accurate.
