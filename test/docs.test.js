// docs.test.js - every exported function/constant in the UI and the MCP server is documented,
// and the README mentions the things a reader needs to find (chart-studio T17, nomogram-engine T43).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const uiFiles = fs.readdirSync(path.join(root, 'src', 'ui'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `src/ui/${f}`);
const files = [...uiFiles, 'mcp/server.mjs'];

const EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const)\s+([A-Za-z_$][\w$]*)/;

/**
 * Find exported functions/constants whose previous line is not the end of a JSDoc block.
 * @param {string} text - source text
 * @param {string} label - file name used in messages
 * @returns {{seen: number, missing: string[]}}
 */
function scan(text, label) {
  const lines = text.split(/\r?\n/);
  const missing = [];
  let seen = 0;
  lines.forEach((line, i) => {
    const m = EXPORT.exec(line);
    if (!m) return;
    seen++;
    if (i === 0 || !lines[i - 1].trim().endsWith('*/')) {
      missing.push(`${label}:${i + 1} ${m[1]}`);
      return;
    }
    let j = i - 1;
    while (j >= 0 && !lines[j].includes('/*')) j--;
    if (j < 0 || !lines[j].trim().startsWith('/**')) missing.push(`${label}:${i + 1} ${m[1]}`);
  });
  return { seen, missing };
}

test('T17-jsdoc-precedes-every-export-in-ui-and-mcp', () => {
  assert.ok(uiFiles.includes('src/ui/state.js'), 'src/ui/state.js is scanned');
  let total = 0;
  const missing = [];
  for (const rel of files) {
    const r = scan(read(rel), rel);
    total += r.seen;
    missing.push(...r.missing);
  }
  assert.ok(total >= 5, `expected the exports of state.js and server.mjs, found ${total}`);
  assert.deepEqual(missing, [], 'exports without a directly preceding /** block');
});

test('T17-jsdoc-scan-flags-bare-and-plain-comment-exports', () => {
  const src = [
    '/** ok */',
    '/**',
    ' * Documented.',
    ' */',
    'export function good() {}',
    '',
    'export const bare = 1;',
    '/* plain comment */',
    'export function plain() {}',
    '// line comment',
    'export const lined = 2;'
  ].join('\n');
  const r = scan(src, 'x.js');
  assert.equal(r.seen, 4);
  assert.deepEqual(r.missing.map((s) => s.split(' ')[1]), ['bare', 'plain', 'lined']);
});

test('T17-readme-mentions-make_nomogram-mcp.json-Shift-URL-shoot.py', () => {
  const readme = read('README.md');
  for (const needle of ['make_nomogram', 'mcp.json', 'Shift', 'URL', 'shoot.py']) {
    assert.ok(readme.includes(needle), `README.md mentions ${needle}`);
  }
});
