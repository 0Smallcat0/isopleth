import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression: typing a min above the old max (or a max below the old min) used to be dropped
// silently while the field kept showing the typed value, so the chart and the table disagreed.
// The handler must validate the pair of fields in the row, not one field against stored state.
test('R3-range-fields-validated-as-a-pair-from-the-row', () => {
  const src = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  const start = src.indexOf("$('vars').addEventListener('input'");
  assert.ok(start > 0, 'vars input handler exists');
  const handler = src.slice(start, src.indexOf("for (const radio of document.querySelectorAll('input[name=\"layout\"]')", start));
  assert.match(handler, /closest\('tr'\)/, 'reads the row');
  assert.match(handler, /read\('min'\)/);
  assert.match(handler, /read\('max'\)/);
  assert.doesNotMatch(handler, /state\.ranges\[v\] \?\? \[1, 10\]/, 'does not compare against the stored range');
});
