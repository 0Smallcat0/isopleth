#!/usr/bin/env node
/**
 * Kiro test gate script
 * - report mode (default): prints summary, exit 0 if pass, exit 1 if fail
 * - gate mode (Stop hook): blocks after 2 failures per session, else exits 0
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function getSessionId() {
  try {
    const input = readFileSync(0, 'utf-8');
    if (input.trim()) {
      const parsed = JSON.parse(input);
      return parsed?.session_id || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function hasTests() {
  const testDir = join(repoRoot, 'test');
  if (!existsSync(testDir)) return false;
  const files = readdirSync(testDir);
  return files.some(f => f.endsWith('.js') || f.endsWith('.mjs'));
}

function runTests() {
  const result = spawnSync('node', ['--test'], {
    cwd: repoRoot,
    shell: false,
    timeout: 120 * 1000,
    encoding: 'utf-8'
  });
  return result;
}

function parseTestOutput(output) {
  const allOutput = output || '';
  const lines = allOutput.split('\n');
  
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;
  const failedTests = [];
  
  // Parse summary lines matching /^(?:ℹ|#)\s*(tests|pass|fail)\s+(\d+)/m
  for (const line of lines) {
    const match = line.match(/^(?:ℹ|#)\s*(tests|pass|fail)\s+(\d+)/);
    if (match) {
      const [, key, value] = match;
      const num = parseInt(value, 10);
      if (key === 'tests') testCount = num;
      if (key === 'pass') passCount = num;
      if (key === 'fail') failCount = num;
    }
  }
  
  // Collect failing test names from lines starting with "not ok" or "✖"
  for (const line of lines) {
    if ((line.trim().startsWith('not ok') || line.trim().startsWith('✖')) && failedTests.length < 10) {
      failedTests.push(line.trim());
    }
  }
  
  return { passCount, failCount, failedTests, rawOutput: allOutput };
}

function getGateCountPath(sessionId) {
  return join(os.tmpdir(), `isopleth-gate-${sessionId}.json`);
}

function loadGateCount(sessionId) {
  const path = getGateCountPath(sessionId);
  if (!existsSync(path)) return 0;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')).count || 0;
  } catch {
    return 0;
  }
}

function saveGateCount(sessionId, count) {
  const path = getGateCountPath(sessionId);
  writeFileSync(path, JSON.stringify({ count }), 'utf-8');
}

function main() {
  const args = process.argv;
  const mode = args[2] === 'gate' ? 'gate' : 'report';
  
  if (!hasTests()) {
    console.log('no tests yet');
    process.exit(0);
    return;
  }
  
  const testResult = runTests();
  const output = (testResult.stdout || '') + '\n' + (testResult.stderr || '');
  const parsed = parseTestOutput(output);
  const isGreen = testResult.status === 0;
  const summary = [
    `Tests: ${parsed.passCount} passed, ${parsed.failCount} failed`,
    ...parsed.failedTests,
  ].slice(0, 30).join('\n');

  if (mode === 'report') {
    if (isGreen) {
      console.log(`Tests: ${parsed.passCount} passed, 0 failed`);
      process.exit(0);
    } else {
      // Print summary to stdout and stderr
      console.log(summary);
      console.error(summary);
      process.exit(1);
    }
    return;
  }
  
  // Gate mode: unchanged contract (block JSON at most 2 times per session_id)
  if (!isGreen) {
    const sessionId = getSessionId() || 'default';
    const count = loadGateCount(sessionId);
    
    if (count < 2) {
      // Block and increment count
      saveGateCount(sessionId, count + 1);
      const blockMsg = JSON.stringify({
        decision: 'block',
        reason: `npm test is failing: ${summary.replace(/\n/g, '; ')}. Fix the failing tests before finishing.`
      });
      console.log(blockMsg);
      process.exit(0);
    }
  }
  
  // Green or already blocked 2x
  process.exit(0);
}

main();