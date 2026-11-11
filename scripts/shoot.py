"""Drive the studio in headless Chrome: screenshots plus checks a screenshot cannot show.

Usage: python scripts/shoot.py http://127.0.0.1:8765/ notes/shots
Serve the repo root first (python -m http.server 8765). Needs Python Playwright and
an installed Chrome. Prints one JSON line of check results; exits 1 if a check fails.
"""

import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "notes/shots")
OUT.mkdir(parents=True, exist_ok=True)
DL = pathlib.Path("work/downloads")
DL.mkdir(parents=True, exist_ok=True)

# Rendered-font overlap check: every pair of tick labels, by their real bounding boxes.
OVERLAP_JS = """
() => {
  const svg = document.querySelector('#sheet svg');
  if (!svg) return {labels: 0, overlaps: ['no sheet']};
  const boxes = [...svg.querySelectorAll('text.s-label, text.s-heading, text.s-block, text.s-caption, text.s-mark')]
    .map(t => ({t: t.textContent, b: t.getBBox(), cls: t.getAttribute('class')}));
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, c = boxes[j].b;
    const ix = Math.min(a.x + a.width, c.x + c.width) - Math.max(a.x, c.x);
    const iy = Math.min(a.y + a.height, c.y + c.height) - Math.max(a.y, c.y);
    // getBBox includes ascender/descender space; count only real ink overlap.
    if (ix > 0.15 && iy > 0.6) hits.push(boxes[i].t + ' / ' + boxes[j].t);
  }
  return {labels: boxes.length, overlaps: hits};
}
"""


def handle_center(page, i):
    return page.evaluate(
        """(i) => { const r = document.querySelectorAll('#overlay .se-handle .ring')[i].getBoundingClientRect();
                    return {x: r.x + r.width / 2, y: r.y + r.height / 2}; }""",
        i,
    )


def drag(page, i, dy, dx=0):
    c = handle_center(page, i)
    page.mouse.move(c["x"], c["y"])
    page.mouse.down()
    steps = 12
    for k in range(1, steps + 1):
        page.mouse.move(c["x"] + dx * k / steps, c["y"] + dy * k / steps)
    page.mouse.up()


# Boxes for the responsive checks (CSS pixels, viewport coordinates).
LAYOUT_JS = """
() => {
  const box = (s) => { const b = document.querySelector(s).getBoundingClientRect();
    return {left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width}; };
  return {panel: box('.panel'), frame: box('#sheet-frame'),
          scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth};
}
"""

EPS = 0.5  # sub-pixel tolerance for layout comparisons


def open_studio(browser, errors, width, height, **opts):
    ctx = browser.new_context(viewport={"width": width, "height": height}, **opts)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_selector("#sheet svg")
    page.wait_for_timeout(300)
    return ctx, page


def responsive_checks(browser, errors):
    """T11: 390 px phone (touch), 1023 px (stacked), 1024 px (side by side)."""
    out = {}

    # Phone: portrait, touch. Panel above sheet, nothing wider than the viewport, handles draggable.
    ctx, page = open_studio(browser, errors, 390, 844, is_mobile=True, has_touch=True)
    m = page.evaluate(LAYOUT_JS)
    masthead_h = page.evaluate("document.querySelector('.masthead').getBoundingClientRect().height")
    page.screenshot(path=str(OUT / "mobile-390.png"), full_page=True)
    page.evaluate("document.getElementById('sheet-frame').scrollIntoView({block: 'start'})")
    page.wait_for_timeout(200)
    before = page.inner_text("#readout")
    c = handle_center(page, 1)
    on_screen = 0 <= c["x"] <= 390 and 0 <= c["y"] <= 844
    drag(page, 1, -60)
    page.wait_for_timeout(100)
    after = page.inner_text("#readout")
    out["mobile_390"] = {
        "no_horizontal_scroll": m["scrollWidth"] <= m["innerWidth"],
        "sheet_uses_width": m["frame"]["width"] >= 0.85 * m["innerWidth"],
        "masthead_one_row": masthead_h <= 60,
        "panel_above_sheet": m["panel"]["bottom"] <= m["frame"]["top"] + EPS,
        "sheet_fits_viewport_width": m["frame"]["width"] <= m["innerWidth"] + EPS,
        "handle_on_screen": on_screen,
        "drag_changes_readout": before != after,
        "readout_before": before,
        "readout_after": after,
        "sheet_width_px": m["frame"]["width"],
        "masthead_height_px": masthead_h,
    }
    ctx.close()

    # 1023 px: still stacked.
    ctx, page = open_studio(browser, errors, 1023, 768)
    m = page.evaluate(LAYOUT_JS)
    page.screenshot(path=str(OUT / "tablet-1023.png"), full_page=True)
    out["tablet_1023"] = {
        "no_horizontal_scroll": m["scrollWidth"] <= m["innerWidth"],
        "stacked": m["panel"]["bottom"] <= m["frame"]["top"] + EPS,
    }
    ctx.close()

    # 1024 px: panel left, sheet right.
    ctx, page = open_studio(browser, errors, 1024, 768)
    m = page.evaluate(LAYOUT_JS)
    page.screenshot(path=str(OUT / "desktop-1024.png"), full_page=True)
    out["desktop_1024"] = {
        "no_horizontal_scroll": m["scrollWidth"] <= m["innerWidth"],
        "side_by_side": m["frame"]["left"] >= m["panel"]["right"] - EPS,
    }
    ctx.close()

    out["ok"] = all(v for section in out.values() for k, v in section.items() if isinstance(v, bool))
    return out


def main():
    results = {}
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, accept_downloads=True)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_selector("#sheet svg")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "01-studio-ohms-law.png"))
        results["ohms_overlap"] = page.evaluate(OVERLAP_JS)
        results["ohms_readout"] = page.inner_text("#readout")

        # Drag R up: V is solved. Then drag V: R becomes the solved scale.
        drag(page, 1, -120)
        page.wait_for_timeout(100)
        results["after_drag_R"] = page.inner_text("#readout")
        results["after_drag_R_verify"] = page.inner_text("#verify")
        drag(page, 2, 90)
        page.wait_for_timeout(100)
        results["after_drag_V"] = page.inner_text("#readout")
        results["solved_after_drag_V"] = page.evaluate("window.isopleth.straightedge.solved")
        se = page.evaluate("window.isopleth.straightedge")
        b = page.evaluate("[window.isopleth.built.chart.evaluate(...window.isopleth.straightedge.values.slice(0,2)), window.isopleth.straightedge.values[2]]")
        results["formula_vs_reading"] = b
        page.screenshot(path=str(OUT / "02-drag-solves-backwards.png"))

        # Keyboard: focus the I handle, arrow up 5 mm.
        page.focus("#overlay .se-handle >> nth=0")
        before = page.evaluate("window.isopleth.straightedge.values[0]")
        for _ in range(5):
            page.keyboard.press("ArrowUp")
        after = page.evaluate("window.isopleth.straightedge.values[0]")
        results["keyboard_moves_I"] = [before, after]

        # Downloads
        with page.expect_download() as d:
            page.click("#dl-svg")
        f = d.value
        f.save_as(str(DL / f.suggested_filename))
        results["svg_download"] = f.suggested_filename
        with page.expect_download() as d:
            page.click("#dl-pdf")
        f = d.value
        f.save_as(str(DL / f.suggested_filename))
        results["pdf_download"] = f.suggested_filename
        results["pdf_head"] = (DL / f.suggested_filename).read_bytes()[:8].decode("ascii", "replace")

        # Z-chart example
        page.click("#example-list button[data-id='axial-stress']")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "03-z-chart-axial-stress.png"))
        results["z_overlap"] = page.evaluate(OVERLAP_JS)
        results["z_readout"] = page.inner_text("#readout")

        # Every example: overlap check on the rendered sheet.
        per = {}
        for ex in page.eval_on_selector_all("#example-list button", "bs => bs.map(b => b.dataset.id)"):
            page.click(f"#example-list button[data-id='{ex}']")
            page.wait_for_timeout(150)
            per[ex] = page.evaluate(OVERLAP_JS)
        results["all_examples_overlap"] = {k: len(v["overlaps"]) for k, v in per.items()}
        results["overlap_detail"] = {k: v["overlaps"][:5] for k, v in per.items() if v["overlaps"]}
        page.click("#example-list button[data-id='hypotenuse']")
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "04-hypotenuse.png"))
        page.click("#example-list button[data-id='body-surface-area']")
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "05-body-surface-area.png"))
        page.click("#example-list button[data-id='bmi']")
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "05b-bmi.png"))
        results["bmi_readout"] = page.inner_text("#readout")
        results["bmi_certificate"] = page.inner_text("#certificate")
        # Every scale must lie on the sheet (negative exponents once pushed one off it).
        results["bmi_scales_on_sheet"] = page.evaluate(
            "window.isopleth.built.layout.scales.every(s => [s.x1, s.x2].every(x => x >= 0 && x <= 210))")

        # A formula typed by hand, with ranges edited in the table.
        page.fill("#formula", "P = U^2 / R")
        page.wait_for_timeout(400)
        page.fill("input[data-var='U'][data-field='min']", "1")
        page.fill("input[data-var='U'][data-field='max']", "250")
        page.fill("input[data-var='R'][data-field='min']", "1")
        page.fill("input[data-var='R'][data-field='max']", "1000")
        page.fill("input[data-var='U'][data-field='unit']", "V")
        page.fill("input[data-var='R'][data-field='unit']", "Ω")
        page.fill("input[data-var='P'][data-field='unit']", "W")
        page.wait_for_timeout(300)
        page.mouse.move(5, 5)  # no hover highlight left on the last example clicked
        page.screenshot(path=str(OUT / "06-typed-formula.png"))
        results["typed_overlap"] = page.evaluate(OVERLAP_JS)
        results["typed_scales_on_sheet"] = page.evaluate(
            "window.isopleth.built.layout.scales.every(s => [s.x1, s.x2].every(x => x >= 0 && x <= 210))")
        results["typed_certificate"] = page.inner_text("#certificate")
        url_with_hash = page.url

        # Hash round trip: open the URL in a fresh page.
        p2 = ctx.new_page()
        p2.goto(url_with_hash)
        p2.wait_for_selector("#sheet svg")
        results["hash_restores_formula"] = p2.input_value("#formula")
        p2.close()

        # Error with a caret.
        page.fill("#formula", "V = I * (R + ")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "07-parse-error.png"))
        results["error_text"] = page.inner_text("#formula-error")
        page.fill("#formula", "y = sin(x * z)")
        page.wait_for_timeout(400)
        results["unsupported_text"] = page.inner_text("#formula-error")

        # How it works
        page.click("#example-list button[data-id='ohms-law']")
        page.click("#nav-how")
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "08-how-it-works.png"))
        page.keyboard.press("Escape")

        # Print preview and true scale: the printed PDF page must be A4.
        page.emulate_media(media="print")
        page.screenshot(path=str(OUT / "09-print-media.png"), full_page=True)
        page.pdf(path=str(DL / "print.pdf"), prefer_css_page_size=True)
        page.emulate_media(media="screen")
        results["print_pdf_bytes"] = (DL / "print.pdf").stat().st_size

        # Narrow window
        page.set_viewport_size({"width": 900, "height": 1100})
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "10-narrow-900px.png"), full_page=True)

        # Responsive layout and touch (T11)
        results["responsive"] = responsive_checks(browser, errors)

        browser.close()
    results["console_errors"] = errors
    sys.stdout.buffer.write((json.dumps(results, ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
    bad = (errors or any(v for v in results["all_examples_overlap"].values())
           or not results["bmi_scales_on_sheet"] or not results["typed_scales_on_sheet"]
           or not results["responsive"]["ok"])
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
