// text.js - Text runs, font metrics and number formatting shared by SVG and PDF output.
//
// A "run" is {text, font, sup?}. font is 'sans' (Helvetica / Arial), 'italic'
// (Helvetica-Oblique) or 'symbol' (the PDF Symbol font, used for Greek letters and
// a few signs WinAnsi cannot encode). SVG draws every run in the sans family; the
// split only matters for PDF, where base-14 fonts need no embedding.

import { tokenize } from './expr.js';

// Helvetica advance widths (AFM, 1/1000 em) for ASCII 32..126.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

// Characters outside ASCII that WinAnsi (Helvetica) can encode: char -> [byte, width].
export const WINANSI_EXTRA = {
  '·': [0xb7, 278], '×': [0xd7, 584], '²': [0xb2, 333], '³': [0xb3, 333],
  'µ': [0xb5, 556], '°': [0xb0, 400], '–': [0x96, 556], '—': [0x97, 1000],
  '±': [0xb1, 584], ' ': [0x20, 278], ' ': [0xa0, 278], 'é': [0xe9, 556],
  '’': [0x92, 222]
};

// Characters drawn from the Symbol font: char -> [byte, width].
export const SYMBOL_CHARS = {
  'α': [0x61, 631], 'β': [0x62, 549], 'γ': [0x67, 411], 'δ': [0x64, 494],
  'ε': [0x65, 439], 'θ': [0x71, 521], 'λ': [0x6c, 549], 'μ': [0x6d, 576],
  'ν': [0x6e, 521], 'π': [0x70, 549], 'ρ': [0x72, 549], 'σ': [0x73, 603],
  'τ': [0x74, 439], 'φ': [0x66, 521], 'ω': [0x77, 686], 'Ω': [0x57, 768],
  'Δ': [0x44, 612], '√': [0xd6, 549], '→': [0xae, 987], '≤': [0xa3, 549],
  '−': [0x2d, 549], 'η': [0x68, 603]
};

export const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ',
  omega: 'ω', Omega: 'Ω', Delta: 'Δ'
};

/**
 * Width of one character in 1/1000 em.
 * @param {string} ch
 * @returns {number}
 */
export function charWidth(ch) {
  const c = ch.codePointAt(0);
  if (c >= 32 && c <= 126) return HELV[c - 32];
  if (WINANSI_EXTRA[ch]) return WINANSI_EXTRA[ch][1];
  if (SYMBOL_CHARS[ch]) return SYMBOL_CHARS[ch][1];
  return 556;
}

/**
 * Width of a list of runs at a font size (mm), honouring superscripts.
 * @param {{text: string, sup?: boolean}[]} runs
 * @param {number} size - font size in mm
 * @param {number} [letterSpacing=0] - extra mm after each character
 * @returns {number} mm
 */
export function runsWidth(runs, size, letterSpacing = 0) {
  let w = 0;
  for (const r of runs) {
    const s = r.sup ? size * SUP_SCALE : size;
    for (const ch of r.text) w += (charWidth(ch) / 1000) * s + letterSpacing;
  }
  return w;
}

export const SUP_SCALE = 0.7;
export const SUP_RISE = 0.38; // fraction of the font size

/**
 * Split plain text into runs by the PDF font each character needs.
 * @param {string} text
 * @param {'sans' | 'italic'} [font='sans']
 * @returns {{text: string, font: string}[]}
 */
export function textRuns(text, font = 'sans') {
  const runs = [];
  for (const ch of text) {
    const f = SYMBOL_CHARS[ch] && !WINANSI_EXTRA[ch] ? 'symbol' : font;
    const last = runs[runs.length - 1];
    if (last && last.font === f && !last.sup) last.text += ch;
    else runs.push({ text: ch, font: f });
  }
  return runs;
}

/**
 * Display name for a variable: Greek names become letters.
 * @param {string} name
 * @returns {string}
 */
export function displayName(name) {
  return GREEK[name] ?? name;
}

/**
 * Pretty-print a formula for the title block: · for *, √ for sqrt, ² for ^2, Greek letters.
 * Falls back to the source text if it does not tokenise.
 * @param {string} source
 * @returns {string}
 */
export function prettyFormula(source) {
  const eq = source.indexOf('=');
  if (eq < 0) return source;
  const lhs = displayName(source.slice(0, eq).trim());
  let tokens;
  try {
    tokens = tokenize(source.slice(eq + 1));
  } catch {
    return source;
  }
  if (!Array.isArray(tokens)) return source;
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const v = String(t.value ?? '');
    const kind = String(t.type).toUpperCase();
    if (kind === 'EOF') break;
    if (kind === 'IDENTIFIER') {
      out += v === 'sqrt' ? '√' : displayName(v);
    } else if (kind === 'NUMBER') {
      out += formatNumber(Number(v));
    } else if (v === '*') {
      out += '·';
    } else if (v === '^') {
      const next = tokens[i + 1];
      if (next && String(next.value) === '2') { out += '²'; i++; }
      else if (next && String(next.value) === '3') { out += '³'; i++; }
      else out += '^';
    } else if (v === '+' || v === '-') {
      out += v === '-' ? ' − ' : ' + ';
    } else if (v === '/') {
      out += '/';
    } else {
      out += v;
    }
  }
  return `${lhs} = ${out.trim()}`;
}

/**
 * Number for prose and readouts: up to `sig` significant digits, no binary noise,
 * powers of ten for very large or small magnitudes.
 * @param {number} v
 * @param {number} [sig=4]
 * @returns {string}
 */
export function formatNumber(v, sig = 4) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) {
    const e = Math.floor(Math.log10(a));
    const m = Number((v / 10 ** e).toPrecision(sig));
    return `${m}e${e}`;
  }
  const s = Number(v.toPrecision(sig));
  if (a >= 1000) return groupThousands(String(s));
  return String(s);
}

function groupThousands(s) {
  const [int, frac] = s.split('.');
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : digits;
  return (neg ? '−' : '') + grouped + (frac ? '.' + frac : '');
}

/**
 * Runs for a tick label. Values from 1e5 up (or below 1e-3) use powers of ten
 * with a superscript exponent, the way handbook charts print them.
 * @param {number} v
 * @returns {{text: string, font: string, sup?: boolean}[]}
 */
export function tickLabelRuns(v) {
  if (v === 0) return [{ text: '0', font: 'sans' }];
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const e = Math.round(Math.log10(a) * 1e9) / 1e9;
    const ei = Math.floor(e);
    const m = Number((v / 10 ** ei).toPrecision(6));
    const exp = ei < 0 ? '−' + String(-ei) : String(ei);
    const runs = [];
    if (m !== 1) runs.push({ text: `${m}×`, font: 'sans' });
    runs.push({ text: '10', font: 'sans' });
    runs.push(...textRuns(exp).map((r) => ({ ...r, sup: true })));
    return runs;
  }
  return textRuns(formatNumber(v, 6));
}
