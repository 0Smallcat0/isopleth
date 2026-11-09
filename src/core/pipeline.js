// pipeline.js - Formula text + ranges -> chart, layout and certificate in one call.
// Used by the studio, the tests and (later) the MCP server.

import { tokenize, parse, splitFormula } from './expr.js';
import { compile } from './compile.js';
import { layout as layoutChart } from './layout.js';
import { generateCertificate } from './certificate.js';

const RESERVED = new Set(['pi', 'e', 'sqrt', 'exp', 'ln', 'log10', 'log', 'sin', 'cos', 'tan', 'abs']);

/**
 * Split and parse a formula; report errors with a character position when known.
 * @param {string} source
 * @returns {{lhs: string, ast: object, inputs: string[]} | {error: string, pos?: number}}
 */
export function parseFormula(source) {
  let parts;
  try {
    parts = splitFormula(source);
  } catch (e) {
    return { error: e.message ?? String(e) };
  }
  if (!parts || parts.error) return { error: parts?.error ?? 'Write the formula as  name = expression' };
  // Positions from the tokenizer and parser are relative to the right-hand side.
  const eq = source.indexOf('=');
  const rhsAt = source.indexOf(parts.rhs, eq + 1);
  const offset = rhsAt >= 0 ? rhsAt : eq + 1;
  let tokens;
  try {
    tokens = tokenize(parts.rhs);
  } catch (e) {
    const msg = e.message ?? String(e);
    const at = /at position (\d+)/.exec(msg);
    return { error: msg.replace(/ at position \d+/, ''), pos: at ? offset + Number(at[1]) : undefined };
  }
  if (tokens && tokens.error) return { error: tokens.error, pos: tokens.pos != null ? offset + tokens.pos : undefined };
  let ast;
  try {
    ast = parse(tokens);
  } catch (e) {
    return { error: e.message ?? String(e), pos: e.pos != null ? offset + e.pos : undefined };
  }
  if (!ast || ast.error) return { error: ast?.error ?? 'Could not parse the formula', pos: ast?.pos != null ? offset + ast.pos : undefined };
  const inputs = [];
  const walk = (node) => {
    if (!node) return;
    if (node.kind === 'identifier' && !RESERVED.has(node.name) && !inputs.includes(node.name)) inputs.push(node.name);
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
    if (node.arg) walk(node.arg);
    if (node.args) node.args.forEach(walk);
  };
  walk(ast);
  return { lhs: parts.lhs, ast, inputs };
}

/**
 * Build everything the sheet needs.
 * @param {{formula: string, ranges: Record<string, [number, number]>, layout?: 'parallel' | 'z', deltaMm?: number}} spec
 * @returns {{chart: object, layout: object, certificate: object, inputs: string[], output: string} | {error: string, pos?: number}}
 */
export function buildChart(spec) {
  const parsed = parseFormula(spec.formula);
  if (parsed.error) return parsed;
  if (parsed.inputs.length !== 2) {
    return { error: `A three-scale chart needs exactly two input variables; this formula has ${parsed.inputs.length}.` };
  }
  for (const v of parsed.inputs) {
    const r = spec.ranges[v];
    if (!r || !Number.isFinite(r[0]) || !Number.isFinite(r[1])) return { error: `Give a range for ${v}.` };
    if (!(r[1] > r[0])) return { error: `The range of ${v} must have min < max.` };
  }
  const ranges = Object.fromEntries(parsed.inputs.map((v) => [v, [spec.ranges[v][0], spec.ranges[v][1]]]));
  const chart = compile(parsed.ast, parsed.lhs, ranges, spec.layout ?? 'parallel');
  if (!chart || chart.error) return { error: chart?.error ?? 'Unsupported formula' };
  // Scales come back in the compiler's order; inputs follow it.
  const order = chart.scales.slice(0, 2).map((s) => s.variable ?? s.name);
  const lay = layoutChart(chart);
  const bad = chart.scales.find((s) => !Number.isFinite(s.range[0]) || !Number.isFinite(s.range[1]));
  if (bad) return { error: `The range of ${bad.variable} is not finite; check the input ranges.` };
  const certificate = generateCertificate(lay, chart, spec.deltaMm ?? 0.5);
  return { chart, layout: lay, certificate, inputs: order, output: parsed.lhs };
}
