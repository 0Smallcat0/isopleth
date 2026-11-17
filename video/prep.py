"""Collect the real artefacts the video shows: a downloaded PDF page, npm test summary, MCP reply."""
import json, subprocess, pathlib
from playwright.sync_api import sync_playwright
A = pathlib.Path("assets"); A.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, accept_downloads=True)
    pg = ctx.new_page()
    pg.goto("http://127.0.0.1:4719/", wait_until="networkidle")
    pg.click('#example-list button[data-id="axial-stress"]')
    pg.wait_for_timeout(600)
    print("layout", pg.evaluate("document.querySelector('input[name=layout]:checked').value"))
    with pg.expect_download() as d:
        pg.click("#dl-pdf")
    d.value.save_as(str(A / "axial-stress.pdf"))
    print(d.value.suggested_filename)
    b.close()
subprocess.run(["pdftoppm", "-r", "110", "-png", "-singlefile", str(A / "axial-stress.pdf"), str(A / "axial-stress")], check=True)
req = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "make_nomogram", "arguments": {"formula": "BSA = sqrt(height * weight / 3600)", "ranges": {"height": [100, 200], "weight": [20, 150]}}}}
out = subprocess.run(["node", "../mcp/server.mjs"], input=json.dumps(req) + "\n", capture_output=True, text=True, encoding="utf-8", cwd=".").stdout
txt = json.loads(out.splitlines()[0])["result"]["content"][0]["text"].split("--- SVG ---")[0].strip()
(A / "mcp-reply.txt").write_text(txt, encoding="utf-8")
(A / "mcp-request.txt").write_text(json.dumps(req["params"]["arguments"]), encoding="utf-8")
t = subprocess.run("npm test", shell=True, capture_output=True, text=True, encoding="utf-8", cwd="..").stdout
tail = [l for l in t.splitlines() if l.startswith("ℹ")]
(A / "npm-test.txt").write_text("\n".join(tail), encoding="utf-8")
print(txt); print("\n".join(tail))
