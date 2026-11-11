// mcp.test.js - R9: MCP server protocol, make_nomogram tool, outFile handling.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { handleRequest } from '../mcp/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP_REL = 'test/.tmp-mcp';
const TMP_DIR = path.join(ROOT, TMP_REL);

after(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const call = (args, id = 1) => handleRequest({
  jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'make_nomogram', arguments: args }
});

const OHM = { formula: 'V = I * R', ranges: { I: [0.1, 10], R: [10, 1000] } };
const BMI = { formula: 'BMI = weight / height^2', ranges: { weight: [30, 150], height: [1.4, 2.1] } };

test('R9.3.1-initialize', () => {
  const res = handleRequest({ jsonrpc: '2.0', id: 7, method: 'initialize', params: {} });
  assert.equal(res.jsonrpc, '2.0');
  assert.equal(res.id, 7);
  assert.equal(res.result.protocolVersion, '2024-11-05');
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.deepEqual(res.result.serverInfo, { name: 'isopleth-nomogram', version: '1.0.0' });
});

test('R9.3-initialized-notification-has-no-reply', () => {
  assert.equal(handleRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined);
});

test('R9.3-unknown-method', () => {
  const res = handleRequest({ jsonrpc: '2.0', id: 3, method: 'no/such' });
  assert.equal(res.id, 3);
  assert.equal(res.error.code, -32601);
});

test('R9.3.2-tools-list', () => {
  const res = handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(res.result.tools.length, 1);
  const tool = res.result.tools[0];
  assert.equal(tool.name, 'make_nomogram');
  assert.deepEqual(tool.inputSchema.required, ['formula', 'ranges']);
  assert.deepEqual(Object.keys(tool.inputSchema.properties).sort(), ['deltaMm', 'formula', 'layout', 'outFile', 'ranges']);
  assert.deepEqual(tool.inputSchema.properties.layout.enum, ['parallel', 'z']);
});

for (const [name, args] of [['V = I * R', OHM], ['BMI = weight / height^2', BMI]]) {
  test(`R9.5-make_nomogram ${name}`, () => {
    const res = call(args);
    assert.equal(res.error, undefined);
    const [item] = res.result.content;
    assert.equal(item.type, 'text');
    const text = item.text;
    assert.match(text, /With the straightedge within ±0\.5 mm of each mark, .* reads within ±/);
    assert.match(text, /Measured on [\d,]+ grid points, [\d,]+ straightedge placements/);
    assert.match(text, /Maximum reading error found: /);
    assert.match(text, /Self-check: formula vs chart reading at [1-5] of 5 evenly spaced input pairs, largest relative difference /);
    const at = text.indexOf('--- SVG ---\n');
    assert.ok(at > 0, 'separator line present');
    const svg = text.slice(at + '--- SVG ---\n'.length);
    assert.match(svg, /^(<\?xml[^>]*\?>\s*)?<svg[^>]*width="210mm"/);
    assert.match(svg, /viewBox="0 0 210 297"/);
    assert.ok(svg.trimEnd().endsWith('</svg>'));
  });
}

test('R9.8-self-check-is-tiny', () => {
  const text = call(OHM).result.content[0].text;
  const m = /largest relative difference ([0-9.e+-]+)\./.exec(text);
  assert.ok(m, 'difference reported');
  assert.ok(Number(m[1]) <= 1e-6, `difference ${m[1]}`);
});

test('R9.5-deltaMm-changes-certificate', () => {
  const text = call({ ...OHM, deltaMm: 1 }).result.content[0].text;
  assert.match(text, /within ±1 mm of each mark/);
});

test('R9.7-invalid-formula-is-an-error', () => {
  const res = call({ formula: 'V = I *', ranges: { I: [1, 10] } });
  assert.equal(res.result, undefined);
  assert.equal(res.error.code, -32602);
  assert.ok(res.error.message.length > 0);
});

test('R9.7-too-many-variables-is-an-error', () => {
  const res = call({ formula: 'W = a + b + c', ranges: { a: [1, 2], b: [1, 2], c: [1, 2] } });
  assert.equal(res.error.code, -32602);
  assert.match(res.error.message, /exactly two input variables/);
});

test('R9.7-missing-range-and-bad-arguments', () => {
  assert.equal(call({ formula: 'V = I * R', ranges: { I: [1, 10] } }).error.code, -32602);
  assert.equal(call({ ranges: {} }).error.code, -32602);
  assert.equal(call({ ...OHM, layout: 'spiral' }).error.code, -32602);
  assert.equal(call({ ...OHM, deltaMm: -1 }).error.code, -32602);
  const unknown = handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'nope', arguments: {} } });
  assert.equal(unknown.error.code, -32602);
});

test('R9.6-outFile-absolute-path-refused', () => {
  const abs = path.join(TMP_DIR, 'abs.svg');
  const res = call({ ...OHM, outFile: abs });
  assert.equal(res.error.code, -32602);
  assert.match(res.error.message, /relative/);
  assert.equal(fs.existsSync(abs), false);
});

test('R9.6-outFile-escaping-root-refused', () => {
  const res = call({ ...OHM, outFile: '../x.svg' });
  assert.equal(res.error.code, -32602);
  assert.equal(fs.existsSync(path.resolve(ROOT, '..', 'x.svg')), false);
  assert.equal(call({ ...OHM, outFile: `${TMP_REL}/../../../y.svg` }).error.code, -32602);
});

test('R9.6-outFile-writes-svg-in-workspace', () => {
  const rel = `${TMP_REL}/ohm.svg`;
  const res = call({ ...OHM, outFile: rel });
  assert.equal(res.error, undefined);
  const text = res.result.content[0].text;
  const written = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.ok(text.endsWith(written));
  assert.match(written, /^(<\?xml[^>]*\?>\s*)?<svg/);
});

test('R9.1-stdio-subprocess', async () => {
  const child = spawn('node', ['mcp/server.mjs'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] });
  try {
    const lines = await new Promise((resolve, reject) => {
      const got = [];
      let buf = '';
      const timer = setTimeout(() => reject(new Error('timed out waiting for server replies')), 10000);
      child.on('error', reject);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          got.push(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
        if (got.length >= 3) {
          clearTimeout(timer);
          resolve(got);
        }
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      child.stdin.write('{not json\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
    });
    const [a, b, c] = lines.map((l) => JSON.parse(l));
    assert.equal(a.id, 1);
    assert.equal(a.result.protocolVersion, '2024-11-05');
    assert.equal(b.id, null);
    assert.equal(b.error.code, -32700);
    assert.equal(c.id, 2);
    assert.equal(c.result.tools[0].name, 'make_nomogram');
  } finally {
    child.kill();
  }
});
