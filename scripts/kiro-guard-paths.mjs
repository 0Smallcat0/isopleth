#!/usr/bin/env node
/**
 * Kiro guard paths script
 * Blocks write operations to protected paths (rules/, LICENSE, notes/brief.md)
 */

import { readFileSync } from 'fs';
import { join, dirname, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function isProtected(value, repoRoot) {
  // Candidate paths: every string value inside tool_input (recursively) that has no newline
  // and is shorter than 260 characters
  if (typeof value !== 'string' || value.includes('\n') || value.includes('\r') || value.length >= 260) {
    return false;
  }
  
  // Resolve to absolute path
  const abs = isAbsolute(value) ? value : join(repoRoot, value);
  
  // rel = path.relative(repoRoot, abs) with backslashes turned into "/" and lower-cased
  let rel = relative(repoRoot, abs);
  rel = rel.replace(/\\/g, '/').toLowerCase();
  
  // Protected when:
  // rel === "license" || rel === "notes/brief.md" || rel === "rules" || rel starts with "rules/"
  if (rel === 'license' || rel === 'notes/brief.md' || rel === 'rules' || rel.startsWith('rules/')) {
    return true;
  }
  
  // Paths outside the repo (rel starts with "..") are not protected
  if (rel.startsWith('..')) {
    return false;
  }
  
  return false;
}

function extractCandidates(obj) {
  const candidates = [];
  
  function walk(value) {
    if (value === null || value === undefined) return;
    
    if (typeof value === 'string') {
      // Candidate: has no newline, shorter than 260 chars
      if (!value.includes('\n') && !value.includes('\r') && value.length < 260) {
        candidates.push(value);
      }
      return;
    }
    
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }
  }
  
  // Only recursively walk tool_input
  if (obj && typeof obj === 'object' && obj.tool_input) {
    walk(obj.tool_input);
  }
  
  return candidates;
}

function main() {
  // Read stdin once with readFileSync(0)
  let input = '';
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    // ignore
  }
  
  let hookEvent = {};
  
  if (input.trim()) {
    try {
      hookEvent = JSON.parse(input);
    } catch {
      // ignore parse error
    }
  }
  
  const candidates = extractCandidates(hookEvent);
  
  for (const value of candidates) {
    if (isProtected(value, repoRoot)) {
      console.error(`Blocked: ${value} is protected (contest rules / licence / brief).`);
      process.exit(2);
    }
  }
  
  process.exit(0);
}

main();
