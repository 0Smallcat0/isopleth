// server.mjs - MCP stdio server exposing the make_nomogram tool.
// JSON-RPC 2.0, one JSON message per line, no dependencies.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildChart } from '../src/core/pipeline.js';
import { buildSheet } from '../src/core/sheet.js';
import { toSVG } from '../src/core/svg.js';
import { solveLine } from '../src/core/reader.js';
import { formatCertificate, formatCertificateMethod } from '../src/core/certificate.js';
import { formatNumber } from '../src/core/text.js';

/** MCP protocol version this server answers `initialize` with. */
export const PROTOCOL_VERSION = '2024-11-05';
/** Server name and version reported in the `initialize` result (name matches .kiro/settings/mcp.json). */
export const SERVER_INFO = { name: 'isopleth-nomogram', version: '1.0.0' };

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/** MCP tool descriptor for make_nomogram (R9.4). */
export const MAKE_NOMOGRAM_TOOL = {
  name: 'make_nomogram',
  description:
    'Compile a formula with two input variables into a printable A4 alignment chart (nomogram). '
    + 'Returns the accuracy certificate, how it was verified, and the SVG sheet at true scale in millimetres.',
  inputSchema: {
    type: 'object',
    properties: {
      formula: { type: 'string', description: 'Equation to compile, e.g. "V = I * R".' },
      ranges: {
        type: 'object',
        description: 'Map from each input variable name to a [min, max] array.',
        additionalProperties: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }
      },
      layout: { type: 'string', enum: ['parallel', 'z'], default: 'parallel', description: 'Chart layout style.' },
      deltaMm: { type: 'number', default: 0.5, description: 'Straightedge placement error in millimetres.' },
      outFile: { type: 'string', description: 'Workspace-relative path to write the SVG to.' }
    },
    required: ['formula', 'ranges']
  }
};

class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function errorResponse(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/**
 * Resolve an outFile argument against the workspace root; refuse anything that leaves it.
 * @param {string} outFile
 * @returns {string} absolute path inside the workspace root
 */
function resolveOutFile(outFile) {
  if (typeof outFile !== 'string' || outFile.trim() === '') {
    throw new RpcError(INVALID_PARAMS, 'outFile must be a non-empty string.');
  }
  if (path.isAbsolute(outFile) || path.win32.isAbsolute(outFile) || path.posix.isAbsolute(outFile)) {
    throw new RpcError(INVALID_PARAMS, 'outFile must be a path relative to the workspace root, not an absolute path.');
  }
  if (outFile.split(/[\\/]+/).includes('..')) {
    throw new RpcError(INVALID_PARAMS, 'outFile must stay inside the workspace root (no ".." segments).');
  }
  const full = path.resolve(WORKSPACE_ROOT, outFile);
  const rel = path.relative(WORKSPACE_ROOT, full);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new RpcError(INVALID_PARAMS, 'outFile must name a file inside the workspace root.');
  }
  return full;
}

function checkArguments(args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    throw new RpcError(INVALID_PARAMS, 'arguments must be an object with formula and ranges.');
  }
  if (typeof args.formula !== 'string' || args.formula.trim() === '') {
    throw new RpcError(INVALID_PARAMS, 'formula is required and must be a non-empty string.');
  }
  if (args.ranges === null || typeof args.ranges !== 'object' || Array.isArray(args.ranges)) {
    throw new RpcError(INVALID_PARAMS, 'ranges is required and must be an object mapping variable names to [min, max].');
  }
  for (const [name, r] of Object.entries(args.ranges)) {
    if (!Array.isArray(r) || r.length !== 2 || !r.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      throw new RpcError(INVALID_PARAMS, `The range of ${name} must be an array of two finite numbers [min, max].`);
    }
  }
  if (args.layout !== undefined && args.layout !== 'parallel' && args.layout !== 'z') {
    throw new RpcError(INVALID_PARAMS, 'layout must be "parallel" or "z".');
  }
  if (args.deltaMm !== undefined && !(typeof args.deltaMm === 'number' && Number.isFinite(args.deltaMm) && args.deltaMm > 0)) {
    throw new RpcError(INVALID_PARAMS, 'deltaMm must be a positive number of millimetres.');
  }
}

/**
 * Compare the formula with the chart reading at 5 evenly spaced pairs of input values.
 * @param {object} built - from buildChart()
 * @returns {string}
 */
function selfCheck(built) {
  const { chart, layout } = built;
  const [su, sv, sw] = chart.scales;
  const span = Math.abs(sw.range[1] - sw.range[0]);
  const steps = 5;
  let worst = 0;
  let checked = 0;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const u = su.range[0] + t * (su.range[1] - su.range[0]);
    const v = sv.range[0] + t * (sv.range[1] - sv.range[0]);
    const f = chart.evaluate(u, v);
    const r = solveLine(layout, chart, { scale: 0, value: u }, { scale: 1, value: v });
    if (r.error || !Number.isFinite(f)) continue;
    checked++;
    const rel = Math.abs(r.value - f) / Math.max(Math.abs(f), 1e-9 * span, 1e-300);
    if (rel > worst) worst = rel;
  }
  if (checked === 0) return `Self-check: none of ${steps} test pairs gave an answer on the chart.`;
  return `Self-check: formula vs chart reading at ${checked} of ${steps} evenly spaced input pairs, largest relative difference ${worst === 0 ? '0' : worst.toExponential(1)}.`;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Run make_nomogram. Throws RpcError for any failure.
 * @param {object} args
 * @returns {{content: {type: 'text', text: string}[]}}
 */
function makeNomogram(args) {
  checkArguments(args);
  const outPath = args.outFile !== undefined ? resolveOutFile(args.outFile) : null;

  const built = buildChart({
    formula: args.formula,
    ranges: args.ranges,
    layout: args.layout ?? 'parallel',
    deltaMm: args.deltaMm ?? 0.5
  });
  if (built.error) {
    const where = built.pos != null ? ` (at position ${built.pos})` : '';
    throw new RpcError(INVALID_PARAMS, built.error + where, built.pos != null ? { pos: built.pos } : undefined);
  }

  const c = built.certificate;
  const svg = toSVG(buildSheet({
    chart: built.chart,
    layout: built.layout,
    formula: args.formula,
    units: {},
    certificate: c,
    key: null,
    title: 'Alignment chart',
    date: today()
  }).items);

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, svg, 'utf8');
  }

  const maxText = c.errorType === 'relative'
    ? `${formatNumber(c.maxError, 3)} %`
    : formatNumber(c.maxError, 3);
  const lines = [
    formatCertificate(c, ''),
    formatCertificateMethod(c),
    `Maximum reading error found: ${maxText} (${c.errorType}, including the ×1.1 margin).`,
    selfCheck(built)
  ];
  if (outPath) lines.push(`SVG written to ${path.relative(WORKSPACE_ROOT, outPath).split(path.sep).join('/')}.`);
  lines.push('--- SVG ---', svg);
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

/**
 * Handle one parsed JSON-RPC message.
 * @param {any} msg
 * @returns {object | undefined} the response, or undefined for notifications
 */
export function handleRequest(msg) {
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.method !== 'string') {
    return errorResponse(msg && typeof msg === 'object' && 'id' in msg ? msg.id ?? null : null, INVALID_REQUEST, 'Invalid JSON-RPC request.');
  }
  const isNotification = !('id' in msg);
  const id = isNotification ? undefined : msg.id;
  const reply = (result) => (isNotification ? undefined : { jsonrpc: '2.0', id, result });
  const fail = (code, message, data) => (isNotification ? undefined : errorResponse(id, code, message, data));

  try {
    switch (msg.method) {
      case 'initialize':
        return reply({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
      case 'notifications/initialized':
        return undefined;
      case 'tools/list':
        return reply({ tools: [MAKE_NOMOGRAM_TOOL] });
      case 'tools/call': {
        const params = msg.params ?? {};
        if (params.name !== MAKE_NOMOGRAM_TOOL.name) {
          return fail(INVALID_PARAMS, `Unknown tool: ${String(params.name)}. The only tool is make_nomogram.`);
        }
        return reply(makeNomogram(params.arguments));
      }
      default:
        return fail(METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    if (e instanceof RpcError) return fail(e.code, e.message, e.data);
    return fail(INTERNAL_ERROR, `Internal error: ${e?.message ?? String(e)}`);
  }
}

/** Read newline-delimited JSON-RPC from stdin and answer on stdout. */
function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (line.trim() === '') return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify(errorResponse(null, PARSE_ERROR, 'Parse error: invalid JSON.')) + '\n');
      return;
    }
    const res = handleRequest(msg);
    if (res !== undefined) process.stdout.write(JSON.stringify(res) + '\n');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) serve();
