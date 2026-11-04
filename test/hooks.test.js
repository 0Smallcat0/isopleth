import { test, describe } from 'node:test';
import { strictEqual } from 'node:assert';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const guardPath = join(repoRoot, 'scripts', 'kiro-guard-paths.mjs');

describe('kiro-guard-paths', () => {
  test('blocks rules/x.txt', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({ tool_input: { path: 'rules/x.txt' } })
    });
    strictEqual(result.status, 2, `Expected exit 2, got ${result.status}`);
  });

  test('blocks LICENSE', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({ tool_input: { path: 'LICENSE' } })
    });
    strictEqual(result.status, 2, `Expected exit 2, got ${result.status}`);
  });

  test('blocks absolute path to notes/brief.md', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({ tool_input: { path: join(repoRoot, 'notes', 'brief.md') } })
    });
    strictEqual(result.status, 2, `Expected exit 2, got ${result.status}`);
  });

  test('blocks RULES\\a.md (Windows path)', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({ tool_input: { path: 'RULES\\a.md' } })
    });
    strictEqual(result.status, 2, `Expected exit 2, got ${result.status}`);
  });

  test('allows src/core/expr.js', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({ tool_input: { path: 'src/core/expr.js' } })
    });
    strictEqual(result.status, 0, `Expected exit 0, got ${result.status}`);
  });

  test('allows src/core/expr.js with multi-line content (content is not a path)', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify({
        tool_input: {
          path: 'src/core/expr.js',
          content: '// header\nsee rules/ for details'
        }
      })
    });
    strictEqual(result.status, 0, `Expected exit 0, got ${result.status}`);
  });

  test('allows empty input', () => {
    const result = spawnSync(process.execPath, [guardPath], {
      input: ''
    });
    strictEqual(result.status, 0, `Expected exit 0, got ${result.status}`);
  });
});
