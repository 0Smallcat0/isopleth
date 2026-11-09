// pdf.js - Serialise a sheet display list to a one-page vector PDF (A4, true scale).
//
// No dependencies: base-14 fonts (Helvetica, Helvetica-Oblique, Symbol) need no
// embedding, and every byte written is ASCII, so string length equals byte offset.

import { buildSheet, SHEET, PAPER } from './sheet.js';
import { runsWidth, WINANSI_EXTRA, SYMBOL_CHARS, SUP_SCALE, SUP_RISE } from './text.js';

const K = 72 / 25.4; // pt per mm
const PAGE_W = SHEET.width * K;
const PAGE_H = SHEET.height * K;

/**
 * Render a complete sheet as PDF.
 * @param {import('./sheet.js').SheetModel} model
 * @param {{title?: string}} [meta]
 * @returns {string} PDF file content (ASCII)
 */
export function renderPDF(model, meta = {}) {
  return toPDF(buildSheet(model).items, meta);
}

/**
 * @param {object[]} items
 * @param {{title?: string}} [meta]
 * @returns {string}
 */
export function toPDF(items, meta = {}) {
  const content = items.map(op).filter(Boolean).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>',
    `<< /Title ${pdfString(asciiOnly(meta.title ?? 'Isopleth nomogram'))} /Producer (Isopleth) /Creator (Isopleth) >>`
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

function f(v) {
  return Number(v.toFixed(3)).toString();
}

const X = (x) => f(x * K);
const Y = (y) => f((SHEET.height - y) * K);

function rgb(hex, fill) {
  const h = (hex ?? '#1f1e1c').replace('#', '');
  const c = [0, 2, 4].map((i) => f(parseInt(h.slice(i, i + 2), 16) / 255));
  return `${c.join(' ')} ${fill ? 'rg' : 'RG'}`;
}

function op(it) {
  switch (it.t) {
    case 'line': {
      const dash = it.dash ? `[${it.dash.map((d) => f(d * K)).join(' ')}] 0 d ` : '';
      const undash = it.dash ? ' [] 0 d' : '';
      return `${rgb(it.color)} ${f(it.w * K)} w ${dash}${X(it.x1)} ${Y(it.y1)} m ${X(it.x2)} ${Y(it.y2)} l S${undash}`;
    }
    case 'rect':
      if (it.fill) return `${rgb(it.fill, true)} ${X(it.x)} ${Y(it.y + it.height)} ${f(it.width * K)} ${f(it.height * K)} re f`;
      return `${rgb(it.color)} ${f(it.w * K)} w ${X(it.x)} ${Y(it.y + it.height)} ${f(it.width * K)} ${f(it.height * K)} re S`;
    case 'circle': {
      const c = 0.5523 * it.r;
      const { cx, cy, r } = it;
      const path = [
        `${X(cx + r)} ${Y(cy)} m`,
        `${X(cx + r)} ${Y(cy - c)} ${X(cx + c)} ${Y(cy - r)} ${X(cx)} ${Y(cy - r)} c`,
        `${X(cx - c)} ${Y(cy - r)} ${X(cx - r)} ${Y(cy - c)} ${X(cx - r)} ${Y(cy)} c`,
        `${X(cx - r)} ${Y(cy + c)} ${X(cx - c)} ${Y(cy + r)} ${X(cx)} ${Y(cy + r)} c`,
        `${X(cx + c)} ${Y(cy + r)} ${X(cx + r)} ${Y(cy + c)} ${X(cx + r)} ${Y(cy)} c`
      ].join(' ');
      const paint = it.fill ? `${rgb(it.fill, true)} b` : 'S';
      return `${rgb(it.color)} ${f(it.w * K)} w ${path} ${paint}`;
    }
    case 'text':
      // Halo: stroke the glyphs in paper colour first (render mode 1), then fill.
      return it.halo
        ? `${rgb(PAPER)} ${f(0.7 * K)} w 1 J 1 j ${textOp(it, 1)} 0 J 0 j
${textOp(it, 0)}`
        : textOp(it, 0);
    default:
      return '';
  }
}

function textOp(it, mode) {
  const width = runsWidth(it.runs, it.size, it.spacing ?? 0);
  const shift = it.anchor === 'end' ? -width : it.anchor === 'middle' ? -width / 2 : 0;
  const th = (-(it.rot ?? 0) * Math.PI) / 180; // PDF angles are counter-clockwise
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  // Start point: anchor shifted along the text direction (in sheet mm, y down).
  const sx = it.x + shift * Math.cos((it.rot ?? 0) * Math.PI / 180);
  const sy = it.y + shift * Math.sin((it.rot ?? 0) * Math.PI / 180);
  const parts = [`BT ${rgb(it.color, true)} ${f(cos)} ${f(sin)} ${f(-sin)} ${f(cos)} ${X(sx)} ${Y(sy)} Tm`];
  if (mode) parts.push(`${mode} Tr`);
  if (it.spacing) parts.push(`${f(it.spacing * K)} Tc`);
  for (const run of it.runs) {
    const size = (run.sup ? it.size * SUP_SCALE : it.size) * K;
    const rise = run.sup ? it.size * SUP_RISE * K : 0;
    for (const seg of splitByFont(run)) {
      parts.push(`/${seg.font} ${f(size)} Tf ${f(rise)} Ts ${pdfString(seg.bytes)} Tj`);
    }
  }
  parts.push('0 Ts 0 Tc 0 Tr ET');
  return parts.join(' ');
}

/** Split a run into segments that one PDF font can draw, as byte strings. */
function splitByFont(run) {
  const segs = [];
  const base = run.font === 'italic' ? 'F2' : 'F1';
  for (const ch of run.text) {
    let font = base;
    let byte;
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) byte = c;
    else if (WINANSI_EXTRA[ch]) byte = WINANSI_EXTRA[ch][0];
    else if (SYMBOL_CHARS[ch]) { font = 'F3'; byte = SYMBOL_CHARS[ch][0]; }
    else byte = 63; // '?'
    const last = segs[segs.length - 1];
    if (last && last.font === font) last.bytes.push(byte);
    else segs.push({ font, bytes: [byte] });
  }
  return segs;
}

function asciiOnly(s) {
  return [...s].map((ch) => {
    const c = ch.codePointAt(0);
    return c >= 32 && c <= 126 ? c : 63;
  });
}

/** PDF literal string from byte values, escaped to pure ASCII. */
function pdfString(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
    else s += String.fromCharCode(b);
  }
  return s + ')';
}
