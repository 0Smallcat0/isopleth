"""Record the Isopleth demo video: drive the real studio in Chrome, one screenshot per frame,
cards built from real repo text, voice-over timed from the generated speech files.
Run: python -X utf8 produce.py   (serve the repo root first: python -m http.server 4719)"""
import json, pathlib, subprocess, html, textwrap
from playwright.sync_api import sync_playwright

W, H, FPS = 1920, 1080, 30
BASE = "http://127.0.0.1:4719/"
ROOT = pathlib.Path(__file__).parent
FR = ROOT / "frames"; FR.mkdir(exist_ok=True)
for f in FR.glob("*.jpg"): f.unlink()
SCRIPT = json.load(open(ROOT / "vo" / "script.json", encoding="utf-8"))


def dur(k):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ROOT / "vo" / f"{k}.mp3")], capture_output=True, text=True)
    return float(r.stdout.strip())


D = {k: dur(k) for k in SCRIPT}
LEAD, TAIL = 0.5, 0.9
BUDGET = {k: round((LEAD + D[k] + TAIL) * FPS) for k in D}

INIT_JS = """
() => {
  const css = document.createElement('style');
  css.textContent = `
  #cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:100000;pointer-events:none;display:none;
       background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><path d='M3 2 L3 21 L8 16.5 L11.5 24 L14.5 22.7 L11 15.2 L18 15 Z' fill='black' stroke='white' stroke-width='1.6' stroke-linejoin='round'/></svg>") no-repeat}
  #cap{position:fixed;right:34px;top:92px;width:400px;z-index:99990;pointer-events:none;display:none;background:#1f1e1c;color:#f5f1e6;
       font:26px/1.35 'Segoe UI',Arial,sans-serif;padding:18px 22px;border-left:6px solid #b73823}
  #hb{position:fixed;z-index:99989;pointer-events:none;display:none;border:4px solid #b73823;border-radius:3px}
  #lt{position:fixed;left:84px;top:250px;width:690px;z-index:99980;pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;color:#1f1e1c}
  #lt .k{font-size:24px;letter-spacing:.28em;text-transform:uppercase;color:#b73823;margin-bottom:18px}
  #lt .b{font-size:60px;line-height:1.12;font-weight:600;letter-spacing:-.01em}
  #lt .s{font-size:30px;line-height:1.35;color:#4a4740;margin-top:22px}
  .card{position:fixed;inset:0;z-index:99970;background:#f5f1e6;color:#1f1e1c;font-family:'Segoe UI',Arial,sans-serif;padding:64px 92px;box-sizing:border-box;overflow:hidden}
  .card .k{font-size:24px;letter-spacing:.28em;text-transform:uppercase;color:#b73823}
  .card h1{font-size:68px;font-weight:600;margin:12px 0 0;letter-spacing:-.01em}
  .card .sub{font-size:34px;color:#4a4740;margin-top:14px;line-height:1.35}
  .card .cols{display:flex;gap:48px;margin-top:40px;align-items:flex-start}
  .card pre{background:#1f1e1c;color:#f5f1e6;font:29px/1.42 Consolas,'Courier New',monospace;padding:28px 34px;margin:0;border-radius:2px;white-space:pre}
  .card pre .h{color:#ff9a7e}
  .card .lab{font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:#6b675c;margin:0 0 12px}
  .card .foot{position:absolute;left:92px;right:92px;bottom:56px;font-size:34px;line-height:1.4;color:#1f1e1c;border-top:2px solid #1f1e1c;padding-top:18px}
  .card .foot b{color:#b73823;font-weight:600}
  .r{visibility:hidden}
  `;
  document.head.appendChild(css);
  for (const id of ['cur','cap','hb','lt']) {
    const e = document.createElement('div'); e.id = id; document.body.appendChild(e);
  }
}
"""


class Rec:
    starts = {}

    def __init__(s, pg):
        s.pg = pg; s.entries = []; s.n = 0; s.used = 0; s.budget = 0
        s.cx, s.cy = 960.0, 540.0

    # ---- frames
    def snap(s, hold=1):
        p = FR / f"{s.n:06d}.jpg"; s.n += 1
        s.pg.screenshot(path=str(p), type="jpeg", quality=92)
        s.entries.append((str(p).replace("\\", "/"), hold)); s.used += hold

    def hold(s, frames):
        if frames > 0: s.snap(frames)

    def hold_s(s, sec): s.hold(round(sec * FPS))

    def until(s, sec):
        s.hold(round(sec * FPS) - s.used)

    def anim(s, frames, fn):
        for i in range(frames):
            fn((i + 1) / frames); s.snap(1)

    def begin(s, key):
        s.key = key; s.used = 0; s.budget = BUDGET[key]
        s.starts[key] = sum(h for _, h in s.entries) / FPS + LEAD

    def end(s):
        if s.used > s.budget: print(f"!! {s.key} over budget by {s.used - s.budget} frames ({(s.used - s.budget) / FPS:.2f}s)")
        s.hold(s.budget - s.used)
        print(f"scene {s.key}: {s.used}/{s.budget} frames", flush=True)

    # ---- cursor
    def cursor(s, x, y, on=True):
        s.cx, s.cy = x, y
        s.pg.evaluate("([x,y,on])=>{const c=document.getElementById('cur');c.style.display=on?'block':'none';c.style.transform=`translate(${x}px,${y}px)`}", [x, y, on])

    def move(s, x, y, sec, mouse=True):
        n = max(2, round(sec * FPS)); x0, y0 = s.cx, s.cy
        for i in range(n):
            t = (i + 1) / n; e = t * t * (3 - 2 * t)
            xx, yy = x0 + (x - x0) * e, y0 + (y - y0) * e
            s.cursor(xx, yy)
            if mouse: s.pg.mouse.move(xx, yy)
            s.snap(1)

    def click(s, x, y, sec=0.5):
        s.move(x, y, sec); s.pg.mouse.click(x, y); s.snap(2)

    # ---- overlays
    def caption(s, text):
        s.pg.evaluate("(t)=>{const c=document.getElementById('cap');c.style.display=t?'block':'none';c.textContent=t||''}", text)

    def box(s, x, y, w, h):
        s.pg.evaluate("([x,y,w,h])=>{const b=document.getElementById('hb');if(x===null){b.style.display='none';return}b.style.display='block';b.style.left=x+'px';b.style.top=y+'px';b.style.width=w+'px';b.style.height=h+'px'}", [x, y, w, h])

    def left(s, k, big, sub=""):
        s.pg.evaluate("([k,b,sub])=>{document.getElementById('lt').innerHTML=(k?`<div class=k>${k}</div>`:'')+`<div class=b>${b}</div>`+(sub?`<div class=s>${sub}</div>`:'')}", [k, big, sub])

    def card(s, inner, fade=8):
        s.pg.evaluate("""(h)=>{const d=document.createElement('div');d.className='card';d.innerHTML=h;d.style.opacity='0';document.body.appendChild(d);window.__newcard=d}""", inner)
        s.anim(fade, lambda t: s.pg.evaluate("(t)=>{window.__newcard.style.opacity=String(t)}", t))
        s.pg.evaluate("()=>{const all=[...document.querySelectorAll('.card')];all.slice(0,-1).forEach(e=>e.remove())}")

    def reveal(s, sel):
        s.pg.evaluate("(sel)=>{document.querySelectorAll(sel).forEach(e=>e.style.visibility='visible')}", sel)

    # ---- input
    def type_text(s, text, hold=2):
        for ch in text:
            s.pg.keyboard.type(ch); s.snap(hold)

    def handles(s):
        return s.pg.evaluate("""()=>[...document.querySelectorAll('#overlay .se-handle .ring')].map(r=>{const b=r.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})""")

    def drag(s, i, dx, dy, sec, lead=0.5):
        x, y = s.handles()[i]
        s.move(x, y, lead)
        s.pg.mouse.down()
        n = max(2, round(sec * FPS))
        for k in range(n):
            t = (k + 1) / n; e = t * t * (3 - 2 * t)
            xx, yy = x + dx * e, y + dy * e
            s.cursor(xx, yy); s.pg.mouse.move(xx, yy); s.snap(1)
        s.pg.mouse.up(); s.snap(1)


def e(t): return html.escape(t)


def code(txt, hl=()):
    out = []
    for line in txt.split("\n"):
        l = e(line)
        for h in hl:
            if h in line: l = f'<span class="h">{l}</span>'; break
        out.append(l)
    return "\n".join(out)


def tree_card():
    tree = """.kiro/
  steering/
    product.md           inclusion: always
    tech.md              inclusion: always
    structure.md         inclusion: always
    nomography-math.md   fileMatch: src/core, test, mcp
    testing.md           fileMatch: test
  specs/
    nomogram-engine/     requirements, design, 43 tasks
    chart-studio/        requirements, design, tasks
  hooks/                 4 hooks
  agents/nomographer.md
  settings/mcp.json"""
    math = """---
inclusion: fileMatch
fileMatchPattern: ["src/core/**/*.js",
  "test/**/*.js", "mcp/**/*"]
---
# Nomography Mathematics

Left scale (x=0):  y = m1 * f1(u)
Right scale (x=L): y = H - m2 * f2(v)
Diagonal parameter:
  t = m1*f3(w) / (m1*f3(w) + m2)"""
    return f"""<div class=k>Kiro &middot; steering</div><h1>The maths lives in one place</h1>
<div class=sub>Kiro's first draft had three formula errors. They were listed, corrected once, and every spec pointed back to this file.</div>
<div class=cols><div><div class=lab>.kiro/ in the repo</div><pre>{code(tree, ('nomography-math',))}</pre></div>
<div class=r id=m1><div class=lab>steering/nomography-math.md</div><pre>{code(math)}</pre></div></div>"""


def spec_card():
    req = """R5.2  THE SYSTEM SHALL find the third value
      by solving the collinearity constraint: the
      straightedge line through the two known
      points intersects the third scale."""
    prop = """P1  Collinearity of solution points
    FOR all valid input ranges and scale
    functions in parallel layout, the points
    P1(u), P2(v), P3(w) satisfy
    |det[[x1,y1,1],[xm,y3,1],[x2,y2,1]]|
        <= 1e-9 x (width x usable height)
    Generator: fc.record({u, v})"""
    return f"""<div class=k>Kiro &middot; spec mode</div><h1>Requirements became properties</h1>
<div class=sub>EARS requirements, a design with correctness properties, 43 ordered tasks. Each property is a fast-check test.</div>
<div class=cols><div><div class=lab>requirements.md</div><pre>{code(req)}</pre></div>
<div class=r id=p1><div class=lab>design.md, tested in test/layout.property.test.js</div><pre>{code(prop)}</pre></div></div>
<div class="foot r" id=f1><b>Collinearity:</b> for 200 random input pairs per example chart, the three points lie on one straight line.</div>"""


def hooks_card():
    hooks = """Property Tests on Save   PostFileSave   101 runs
  node scripts/kiro-test-gate.mjs report
Green Before Stop        Stop            14 runs
  blocks the stop while the suite is red
Guard Protected Files    PreToolUse      227 runs
  refuses writes to rules, licence, brief"""
    agent = """name: nomographer
tools: read, write, shell, spec, @mcp
resources: file://.kiro/steering/**/*.md
shell: node *, npm *, git status*, git diff*

Work one spec task at a time.
Mark it [x] only after its tests pass;
never mark a task done without running
`npm test`."""
    return f"""<div class=k>Kiro &middot; hooks and a custom agent</div><h1>The suite runs itself</h1>
<div class=sub>Fire counts recounted from the Kiro session logs of this repo.</div>
<div class=cols><div><div class=lab>.kiro/hooks/</div><pre>{code(hooks)}</pre></div>
<div class=r id=a1><div class=lab>.kiro/agents/nomographer.md</div><pre>{code(agent)}</pre></div></div>"""


def mcp_card():
    a = json.loads((ROOT / "assets/mcp-request.txt").read_text(encoding="utf-8"))
    req = "tools/call make_nomogram\nformula: " + a["formula"] + "\nranges:  height " + str(a["ranges"]["height"]) + ", weight " + str(a["ranges"]["weight"])
    rep = (ROOT / "assets/mcp-reply.txt").read_text(encoding="utf-8")
    rep = "\n".join("\n".join(textwrap.wrap(l, 50, subsequent_indent="  ")) for l in rep.split("\n"))
    nt = (ROOT / "assets/npm-test.txt").read_text(encoding="utf-8").split("\n")
    nt = "\n".join(l for l in nt if l.split()[1] in ("tests", "pass", "fail"))
    return f"""<div class=k>Kiro &middot; MCP</div><h1>Any Kiro session can ask for a verified chart</h1>
<div class=cols><div><div class=lab>request</div><pre>{code(req)}</pre><div class=lab style="margin-top:28px">npm test</div><pre>{code(nt)}</pre></div>
<div class=r id=reply><div class=lab>reply from the make_nomogram server</div><pre>{code(rep)}</pre></div></div>
<div class="foot r" id=f2>Every batch was reviewed against the formulas, not just the green count. Three bugs the tests had missed became regression tests. <b>19 Kiro sessions, all logged.</b></div>"""


def pdf_card():
    img = BASE + "video/assets/axial-stress.png"
    return f"""<div style="display:flex;gap:70px;align-items:center;height:100%"><div style="position:relative;height:100%"><img src="{img}" style="height:100%;display:block;box-shadow:0 0 0 2px #1f1e1c">
<div class=r id=bar style="position:absolute;left:6.5%;top:91.6%;width:49.5%;height:3.6%;border:4px solid #b73823"></div></div>
<div><div class=k>Download PDF</div><h1>One A4 page, true scale</h1>
<div class=sub>Check the 100 mm bar on your printer before use.</div>
<div class="sub r" id=np style="margin-top:44px;color:#1f1e1c;font-size:40px;line-height:1.3">No power.<br>No screen.<br>No network.</div></div></div>"""


def end_card():
    return """<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
<div class=k>Kiroween 2026 &middot; Resurrection</div>
<div style="font-size:120px;letter-spacing:.3em;font-weight:500;margin-top:18px">ISOPLETH</div>
<div class=sub style="font-size:40px">A dead tool, resurrected with proof.</div>
<div class="sub r" id=urls style="margin-top:56px;font:34px/1.6 Consolas,monospace;color:#1f1e1c">github.com/0Smallcat0/isopleth<br>0smallcat0.github.io/isopleth</div></div>"""


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda x: errs.append(str(x)))
        R = Rec(pg)

        def fresh():
            pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(500); pg.evaluate(INIT_JS)

        # ---------------- S1: the dead tool
        fresh()
        pg.add_style_tag(content=".panel{visibility:hidden !important}")
        R.begin("s1"); R.cursor(0, 0, False)
        R.left("Before pocket calculators", "Engineers calculated with a ruler."); R.until(1.0)
        R.drag(0, 0, 130, 3.0)
        R.until(5.5)
        R.left("", "Lay it across two values.<br>Read the third.", "Where the ruler crosses the third scale.")
        R.until(6.0); R.drag(1, 0, -110, 3.0)
        R.cursor(0, 0, False); R.until(11.5)
        R.left("Nomogram", "Maurice d'Ocagne,<br>1884", "A paper calculator that filled handbooks for a century.")
        R.until(13.0); R.drag(0, 0, -230, 3.4)
        R.cursor(0, 0, False); R.until(18.5)
        R.left("", "Then it died.", "Making one took days.<br>Nobody could prove it was accurate.")
        R.until(19.5); R.drag(1, 0, 90, 4.0)
        R.cursor(0, 0, False)
        R.end()

        # ---------------- S2: type a formula
        fresh(); R.begin("s2"); R.cursor(960, 540, False)
        R.hold_s(LEAD + 0.5)
        R.caption("Type a formula.")
        R.click(180, 130, 0.6)
        pg.keyboard.press("Control+A"); pg.keyboard.press("Delete"); R.snap(3)
        R.type_text("BSA = sqrt(height * weight / 3600)", hold=2)
        pg.wait_for_timeout(500); R.snap(5)
        R.caption("Set the ranges.")
        rows = pg.query_selector_all("#vars tbody tr")
        bb = rows[0].query_selector_all("input")[0].bounding_box()
        R.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2, 0.5)
        pg.keyboard.press("Control+A")
        R.type_text("100", 2); pg.keyboard.press("Tab"); R.type_text("200", 2); pg.keyboard.press("Tab"); R.type_text("cm", 2)
        pg.keyboard.press("Tab"); R.type_text("20", 2); pg.keyboard.press("Tab"); R.type_text("150", 2); pg.keyboard.press("Tab"); R.type_text("kg", 2)
        pg.keyboard.press("Tab"); pg.wait_for_timeout(500); R.cursor(1000, 700, False); R.snap(4)
        R.caption("A three-scale chart, compiled in milliseconds.")
        R.end()

        # ---------------- S3: drag the straightedge
        R.begin("s3"); R.hold_s(LEAD)
        R.caption("Drag any two handles.")
        R.drag(0, 0, -120, 1.7, lead=0.3)
        R.drag(1, 0, -90, 1.7, lead=0.3)
        R.until(4.6)
        R.caption("Drag the answer: it solves backwards.")
        R.drag(2, 0, 100, 2.6, lead=0.4)
        R.cursor(1700, 800, False)
        R.until(8.2)
        R.caption("The reading is checked against the formula on every move.")
        R.box(700, 1008, 940, 58)
        R.end()
        R.box(None, None, None, None)

        # ---------------- S4: certificate
        R.begin("s4"); R.hold_s(LEAD)
        R.caption("Every chart states its accuracy.")
        R.box(22, 430, 316, 118); R.until(3.6)
        R.caption("Ruler off by 0.5 mm: the answer is within 0.35 %.")
        dx, dy = pg.evaluate("(()=>{const b=document.getElementById('delta').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()")
        R.until(8.0)
        R.click(dx, dy, 0.7)
        pg.keyboard.press("Control+A"); R.type_text("1", 2); pg.wait_for_timeout(500); R.snap(2)
        R.caption("Ruler error 1 mm: measured again.")
        R.until(11.8)
        pg.keyboard.press("Control+A"); R.type_text("2", 2); pg.wait_for_timeout(500); R.snap(2)
        R.caption("Ruler error 2 mm: measured again.")
        R.cursor(1000, 700, False)
        R.end()
        R.box(None, None, None, None)

        # ---------------- S5: Z-chart and print
        R.begin("s5"); R.hold_s(LEAD)
        R.caption("Ratios get a Z-chart.")
        ex = pg.query_selector('#example-list button[data-id="axial-stress"]').bounding_box()
        R.click(ex["x"] + 120, ex["y"] + 20, 0.8); pg.wait_for_timeout(500); R.snap(3)
        R.drag(0, 0, 90, 2.0, lead=0.5)
        R.caption("SVG or one-page PDF.")
        bb = pg.query_selector("#dl-pdf").bounding_box()
        R.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2, 0.8)
        R.caption(""); R.cursor(0, 0, False)
        R.card(pdf_card(), fade=10)
        R.hold_s(2.2); R.reveal("#bar"); R.hold_s(2.0); R.reveal("#np")
        R.end()

        # ---------------- S6..S10: Kiro cards and close
        R.begin("s6"); R.card(tree_card(), fade=10); R.hold_s(4.5); R.reveal("#m1"); R.end()
        R.begin("s7"); R.card(spec_card(), fade=10); R.hold_s(3.5); R.reveal("#p1"); R.hold_s(4.0); R.reveal("#f1"); R.end()
        R.begin("s8"); R.card(hooks_card(), fade=10); R.hold_s(5.6); R.reveal("#a1"); R.end()
        R.begin("s9"); R.card(mcp_card(), fade=10); R.hold_s(2.8); R.reveal("#reply"); R.hold_s(4.4); R.reveal("#f2"); R.end()
        R.begin("s10"); R.card(end_card(), fade=12); R.hold_s(3.0); R.reveal("#urls"); R.end()
        print("console errors:", errs)
        b.close()

    lst = ROOT / "frames" / "list.txt"
    with open(lst, "w", encoding="utf-8") as f:
        for path, hold in R.entries:
            f.write(f"file '{path}'\nduration {hold / FPS:.5f}\n")
        f.write(f"file '{R.entries[-1][0]}'\n")
    total = sum(h for _, h in R.entries) / FPS
    json.dump({"starts": R.starts, "total": total}, open(ROOT / "out" / "timing.json", "w"), indent=1)
    print("total seconds", total)


main()
