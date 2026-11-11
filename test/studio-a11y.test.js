// studio-a11y.test.js - Chart Studio T11 (responsive CSS), T12 (accessibility) and
// T15 (code review checklist), as automated checks on index.html, styles.css and src/ui/app.js.
// No DOM library: the files are read as text and parsed with small helpers below.
// The browser half of T11 (real viewports, touch drag) is scripts/shoot.py.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const css = read('styles.css');
const appJs = read('src/ui/app.js');

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel, ext));
    else if (name.endsWith(ext)) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------- CSS parsing

/** Flat list of {selector, decls, media}; at-rules with blocks are entered, @page is kept as a rule. */
function parseRules(text, media = '') {
  const src = media === '' && text === css ? text.replace(/\/\*[\s\S]*?\*\//g, '') : text;
  const rules = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    const head = src.slice(i, open).trim();
    const body = src.slice(open + 1, j - 1);
    if (head.startsWith('@media')) rules.push(...parseRules(body, head.slice(6).replace(/\s+/g, ' ').trim()));
    else rules.push({ selector: head, decls: parseDecls(body), media });
    i = j;
  }
  return rules;
}

function parseDecls(body) {
  const decls = {};
  for (const part of body.split(';')) {
    const k = part.indexOf(':');
    if (k < 0) continue;
    decls[part.slice(0, k).trim().toLowerCase()] = part.slice(k + 1).replace(/!important/i, '').trim();
  }
  return decls;
}

const rules = parseRules(css);
const selectorsOf = (r) => r.selector.split(',').map((s) => s.trim());
const rulesFor = (selector, media = '') =>
  rules.filter((r) => r.media === media && selectorsOf(r).includes(selector));

const root = Object.assign({}, ...rules.filter((r) => r.selector === ':root').map((r) => r.decls));
const color = (name) => {
  const v = root[`--${name}`];
  assert.match(v ?? '', /^#[0-9a-f]{6}$/i, `--${name} must be a 6-digit hex in :root, got ${v}`);
  return v;
};

// ---------------------------------------------------------------- WCAG contrast

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Text colour pairs as styles.css uses them. `sel` must exist and declare `prop: var(--fg)`;
 * the background is the surface the element sits on (checked against `surfaces`) unless
 * the same rule sets it (`ownBg`). Inherited ink has no `sel` declaration to check.
 * Disabled controls (.layout label.disabled) are exempt from WCAG 1.4.3 and not listed.
 */
const PAIRS = [
  { sel: 'body', fg: 'ink', bg: 'paper' },
  { sel: '.subtitle', fg: 'muted', bg: 'paper' },
  { sel: '.caption', fg: 'muted', bg: 'paper' },
  { sel: '.vars th', fg: 'muted', bg: 'paper' },
  { sel: '.vars .computed', fg: 'muted', bg: 'paper' },
  { sel: '.method', fg: 'muted', bg: 'paper' },
  { sel: '.examples .ex-formula', fg: 'muted', bg: 'paper' },
  { sel: '.error', fg: 'accent', bg: 'paper' },
  { sel: '.vars tr.output td.name', fg: 'accent', bg: 'paper' },
  { sel: '.vars input[aria-invalid="true"]', fg: 'accent', bg: 'paper' },
  { sel: '.examples button:hover .ex-name', fg: 'accent', bg: 'paper' },
  { sel: '#formula', fg: 'paper', bg: 'ink', ownBg: true },
  { sel: '.actions button:hover', fg: 'paper', bg: 'ink', ownBg: true },
  { sel: 'dialog', fg: 'ink', bg: 'paper', ownBg: false, bgProp: 'background' },
  { sel: '.reading', fg: 'ink', bg: 'desk', inherited: true },
  { sel: '.reading .arrow', fg: 'muted', bg: 'desk' },
  { sel: '.reading .solved', fg: 'accent', bg: 'desk' },
  { sel: '.verify', fg: 'muted', bg: 'desk' },
  { sel: '.sheet-holder .empty', fg: 'muted', bg: 'sheet' },
  { sel: '.se-tag', fg: 'accent', bg: 'sheet', prop: 'fill' }
];

/** Surface selector -> the custom property its background must use. */
const SURFACES = [
  { sel: 'body', bg: 'paper' },
  { sel: '.desk', bg: 'desk' },
  { sel: '.sheet-frame', bg: 'sheet' }
];

test('R11.4-contrast-surfaces-declared', () => {
  for (const { sel, bg } of SURFACES) {
    const hit = rulesFor(sel).find((r) => (r.decls.background ?? '') === `var(--${bg})`);
    assert.ok(hit, `${sel} must declare background: var(--${bg})`);
  }
});

test('R11.4-contrast-wcag-aa-normal-text', () => {
  const rows = [];
  const missing = [];
  for (const p of PAIRS) {
    const prop = p.prop ?? 'color';
    if (!p.inherited) {
      const hit = rulesFor(p.sel).find((r) => r.decls[prop] === `var(--${p.fg})`);
      if (!hit) missing.push(`${p.sel} does not declare ${prop}: var(--${p.fg})`);
      else if (p.ownBg && hit.decls.background !== `var(--${p.bg})`) {
        missing.push(`${p.sel} does not declare background: var(--${p.bg})`);
      }
    }
    const ratio = contrast(color(p.fg), color(p.bg));
    rows.push({ ...p, ratio });
  }
  assert.deepEqual(missing, [], `contrast table is out of date with styles.css:\n${missing.join('\n')}`);
  const table = rows
    .map((r) => `${r.ratio >= 4.5 ? 'ok  ' : 'FAIL'} ${r.ratio.toFixed(2).padStart(5)}:1  ${r.sel}  (--${r.fg} ${color(r.fg)} on --${r.bg} ${color(r.bg)})`)
    .join('\n');
  const failing = rows.filter((r) => r.ratio < 4.5);
  assert.equal(failing.length, 0, `text pairs below 4.5:1:\n${table}`);
});

// ---------------------------------------------------------------- labels

test('R11.5-index-controls-have-accessible-names', () => {
  const controls = [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/g)];
  assert.ok(controls.length >= 4, 'expected the formula, layout radios and delta controls');
  const bad = [];
  for (const m of controls) {
    const attrs = m[2];
    if (/\stype="hidden"/.test(attrs)) continue;
    const id = /\sid="([^"]+)"/.exec(attrs)?.[1];
    const named = /\saria-label="[^"]+"/.test(attrs) || /\saria-labelledby="[^"]+"/.test(attrs);
    const forLabel = id && new RegExp(`<label\\b[^>]*\\sfor="${id}"`).test(html);
    // A control nested in <label>...</label> is labelled implicitly (HTML, WCAG H44).
    const wrapped = html.lastIndexOf('<label', m.index) > html.lastIndexOf('</label>', m.index);
    if (!named && !forLabel && !wrapped) bad.push(m[0]);
  }
  assert.deepEqual(bad, [], 'controls without label for / aria-label / aria-labelledby');
});

test('R11.5-dynamic-range-inputs-have-aria-label', () => {
  const marks = [...appJs.matchAll(/createElement\(\s*'(input|textarea|select)'\s*\)/g)];
  assert.ok(marks.length >= 2, 'app.js builds the min/max and unit inputs');
  const bad = [];
  for (const m of marks) {
    const rest = appJs.slice(m.index + m[0].length);
    const next = rest.search(/createElement\(/);
    const segment = next < 0 ? rest : rest.slice(0, next);
    if (!/setAttribute\(\s*'aria-label'/.test(segment)) bad.push(appJs.slice(0, m.index).split('\n').length);
  }
  assert.deepEqual(bad, [], 'app.js line numbers where a created input gets no setAttribute(\'aria-label\')');
});

// ---------------------------------------------------------------- live regions

test('R11.6-live-region-formula-error-assertive', () => {
  const tag = /<[a-z]+\b[^>]*\sid="formula-error"[^>]*>/.exec(html)?.[0];
  assert.ok(tag, '#formula-error exists');
  assert.match(tag, /\saria-live="assertive"/);
  assert.match(/<textarea\b[^>]*\sid="formula"[^>]*>/.exec(html)?.[0] ?? '', /aria-describedby="formula-error"/);
});

test('R11.6-live-region-readout-polite', () => {
  const m = /<([a-z]+)\b[^>]*\sclass="readout"[^>]*>/.exec(html);
  assert.ok(m, '.readout container exists');
  assert.match(m[0], /\saria-live="polite"/);
  const inner = html.slice(m.index, html.indexOf(`</${m[1]}>`, m.index));
  assert.match(inner, /id="readout"/, '#readout sits inside the polite region');
});

// ---------------------------------------------------------------- straightedge handles

test('R11.4-handles-focusable-role-label', () => {
  const create = /el\('g',\s*\{([^}]*)\}\)/.exec(appJs);
  assert.ok(create, 'handles are created with el(\'g\', {...})');
  assert.match(create[1], /tabindex:\s*0/, 'handle is focusable');
  assert.match(create[1], /role:\s*'slider'/, 'handle has a role');
  const from = appJs.indexOf('setAttrs(h.g');
  const to = appJs.indexOf('setAttrs(h.hit', from);
  assert.ok(from > 0 && to > from, 'handle attributes are updated in updateStraightedge');
  assert.match(appJs.slice(from, to), /'aria-label'/, 'handle has an aria-label');
  assert.match(appJs.slice(from, to), /'aria-valuenow'/, 'slider exposes its value');
});

test('R11.4-handles-arrow-keys-with-shift-fine-step', () => {
  assert.match(appJs, /addEventListener\(\s*'keydown'[^\n]*keyMove\(/);
  const from = appJs.indexOf('function keyMove');
  assert.ok(from >= 0, 'keyMove exists');
  const end = appJs.indexOf('\n}\n', from);
  assert.ok(end > from, 'keyMove body ends at a top-level closing brace');
  const body = appJs.slice(from, end);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    assert.ok(body.includes(key), `keyMove handles ${key}`);
  }
  assert.match(body, /shiftKey\s*\?\s*0\.1\s*:\s*1/, 'Shift gives 0.1 mm steps, otherwise 1 mm');
});

// ---------------------------------------------------------------- focus styles

test('R11.8-focus-visible-rule-2px-outline', () => {
  const hit = rules.find((r) => r.media === '' && selectorsOf(r).includes(':focus-visible'));
  assert.ok(hit, 'global :focus-visible rule');
  assert.match(hit.decls.outline ?? '', /^2px solid\b/);
});

test('R11.8-outline-none-always-replaced', () => {
  const removes = (r) => Object.entries(r.decls).some(([k, v]) => k.startsWith('outline') && /^(none|0|0px)$/.test(v));
  const offenders = [];
  const replaced = [];
  for (const r of rules.filter(removes)) {
    if (!r.selector.includes(':focus')) {
      // Only the print-media sheet frame (not interactive) may drop its outline without a focus style.
      if (r.selector !== '.sheet-frame') offenders.push(`${r.selector}: removes outline on a non-focus rule`);
      continue;
    }
    const base = r.selector.replace(/:focus(-visible|-within)?/g, '');
    const sameRule = Object.keys(r.decls).some((k) => /^(border|box-shadow|background|text-decoration)/.test(k));
    const sibling = rules.some((o) => o !== r && o.selector.includes(`${base}:focus-visible`) && Object.keys(o.decls).length > 0);
    if (!sameRule && !sibling) offenders.push(`${r.selector}: outline removed, no replacement focus style`);
    else replaced.push(r.selector);
  }
  assert.deepEqual(offenders, []);
  assert.ok(replaced.includes('.se-handle:focus'), 'handle focus style is checked');
  assert.ok(replaced.includes('.vars input:focus'), 'range input focus style is checked');
});

// ---------------------------------------------------------------- document landmarks

test('R11.5-document-language-viewport-landmarks', () => {
  assert.match(html, /<html\b[^>]*\slang="[a-zA-Z-]+"/, '<html lang>');
  assert.match(html, /<meta\s+name="viewport"\s+content="[^"]*width=device-width/, 'viewport meta');
  assert.match(html, /<nav\b[^>]*\saria-label="[^"]+"/, 'nav has aria-label');
  const dialog = /<dialog\b[^>]*\saria-labelledby="([^"]+)"/.exec(html);
  assert.ok(dialog, 'dialog has aria-labelledby');
  assert.match(html, new RegExp(`\\sid="${dialog[1]}"`), `aria-labelledby target #${dialog[1]} exists`);
});

// ---------------------------------------------------------------- T11 responsive CSS

test('R1.2-narrow-screens-single-column-panel-above-sheet', () => {
  const base = rulesFor('.studio').find((r) => r.decls['grid-template-columns']);
  assert.ok(base, 'base .studio grid');
  assert.equal(base.decls['grid-template-columns'].split(/\s+/).length, 2, 'side by side at >= 1024 px');

  const narrow = rules.filter((r) => r.media === '(max-width: 1023px)');
  assert.ok(narrow.length > 0, '@media (max-width: 1023px) exists');
  const studio = narrow.find((r) => selectorsOf(r).includes('.studio'));
  assert.ok(studio, '.studio is restyled in the narrow media rule');
  assert.equal(studio.decls['grid-template-columns'], '1fr', 'one column');
  for (const r of narrow) {
    for (const k of Object.keys(r.decls)) {
      assert.ok(!/^(order|grid-area|grid-row|grid-column)$/.test(k), `${r.selector} must not reorder (${k})`);
    }
    assert.ok(!/reverse/.test(Object.values(r.decls).join(' ')), `${r.selector} must not reverse direction`);
  }
  const panel = html.indexOf('class="panel"');
  const desk = html.indexOf('class="desk"');
  assert.ok(panel > 0 && desk > panel, 'source order puts the panel before the sheet');
});

test('R9.2-print-sheet-210x297mm-panel-hidden', () => {
  const print = rules.filter((r) => r.media === 'print');
  const hides = print.find((r) => selectorsOf(r).includes('.panel') && r.decls.display === 'none');
  assert.ok(hides, 'print hides .panel');
  const frame = print.find((r) => selectorsOf(r).includes('.sheet-frame') && r.decls.width && r.decls.height);
  assert.ok(frame, 'print sets .sheet-frame size');
  assert.equal(frame.decls.width, '210mm');
  assert.equal(frame.decls.height, '297mm');
  const svg = print.find((r) => selectorsOf(r).includes('.sheet-holder svg'));
  assert.deepEqual([svg?.decls.width, svg?.decls.height], ['210mm', '297mm']);
  const page = print.find((r) => r.selector === '@page');
  assert.match(page?.decls.size ?? '', /A4/i);
  assert.equal(page?.decls.margin, '0');
});

// ---------------------------------------------------------------- T15 checklist

test('T15-no-inline-style-attributes', () => {
  assert.doesNotMatch(html, /\sstyle\s*=\s*["']/);
});

test('T15-no-console-log-or-error', () => {
  const hits = [...walk('src/ui', '.js'), ...walk('src/core', '.js')]
    .filter((f) => /\bconsole\.(log|error)\b/.test(read(f)));
  assert.deepEqual(hits, []);
});

test('T15-offline-no-external-urls', () => {
  const ALLOWED = new Set(['http://www.w3.org/2000/svg']);
  const files = ['index.html', 'styles.css', ...walk('src', '.js')];
  const hits = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/https?:\/\/[^\s"'`)<>]*/g)) {
      if (!ALLOWED.has(m[0])) hits.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('T15-ui-exports-are-named', () => {
  const files = walk('src/ui', '.js');
  assert.ok(files.length >= 2);
  for (const f of files) assert.doesNotMatch(read(f), /^\s*export\s+default\b/m, `${f} has a default export`);
  assert.match(read('src/ui/state.js'), /^export\s+(function|const)\s/m);
});

test('T15-buttons-have-visible-text', () => {
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(buttons.length >= 5);
  const bad = buttons
    .filter((m) => /<(svg|img)\b/.test(m[2]) || m[2].replace(/<[^>]*>/g, '').trim() === '')
    .map((m) => m[0]);
  assert.deepEqual(bad, [], 'buttons with no visible text');
  // Example buttons are built in app.js; their two spans must be filled with text.
  assert.match(appJs, /querySelector\('\.ex-name'\)\.textContent\s*=\s*e\.name/);
  assert.match(appJs, /querySelector\('\.ex-formula'\)\.textContent\s*=\s*e\.formula/);
});

// ---------------------------------------------------------------- T11 phone layout

test('T11-masthead-one-row-below-600px', () => {
  const media = '(max-width: 599px)';
  const subtitle = rulesFor('.subtitle', media);
  assert.ok(subtitle.length > 0, `.subtitle rule inside @media ${media}`);
  assert.equal(subtitle.at(-1).decls.display, 'none', 'subtitle hidden below 600px');
  const navLinks = rules.filter(
    (r) => r.media === media && selectorsOf(r).some((s) => s.startsWith('.masthead nav')) && r.decls['white-space'],
  );
  assert.ok(navLinks.length > 0, 'nav link rule with white-space inside the phone @media');
  for (const r of navLinks) assert.equal(r.decls['white-space'], 'nowrap');
  assert.ok(selectorsOf(navLinks[0]).includes('.masthead nav a'), 'nav anchors ("How it works") stay on one line');
  const gap = rules.find((r) => r.media === media && r.selector === '.masthead nav')?.decls.gap;
  assert.ok(gap && parseFloat(gap) < 24, `nav gap smaller than the default 24px, got ${gap}`);
});

test('T11-narrow-desk-padding-12px', () => {
  const desk = rulesFor('.desk', '(max-width: 1023px)');
  assert.ok(desk.length > 0, '.desk rule in the narrow @media');
  assert.equal(desk.at(-1).decls.padding, '12px');
});

test('T11-sheet-sized-by-width-below-1024px', () => {
  const fn = /function fitSheet\(\) \{[\s\S]*?\n\}\n/.exec(appJs)?.[0];
  assert.ok(fn, 'fitSheet() exists in app.js');
  // The query matches the stacked-layout breakpoint in styles.css.
  assert.match(appJs, /const NARROW_QUERY = '\(max-width: 1023px\)'/);
  assert.ok(rules.some((r) => r.media === '(max-width: 1023px)' && r.selector === '.studio'), 'CSS stacks at the same breakpoint');
  const branch = /if \(window\.matchMedia\(NARROW_QUERY\)\.matches\) \{([\s\S]*?)return;\s*\}/.exec(fn)?.[1];
  assert.ok(branch, 'fitSheet has an early-return branch for narrow viewports');
  assert.match(branch, /desk\.clientWidth/, 'width comes from the desk width');
  assert.match(branch, /paddingLeft/, 'desk padding is subtracted');
  assert.match(branch, /\* 297\) \/ 210/, 'height keeps the A4 ratio 210:297');
  assert.doesNotMatch(branch, /clientHeight|innerHeight/, 'narrow branch ignores viewport height');
  // Desktop path (after the branch) is still height-driven.
  assert.match(fn.slice(fn.indexOf('return;')), /desk\.clientHeight/);
});
