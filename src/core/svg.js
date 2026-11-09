// svg.js - Serialise a sheet display list to SVG in millimetres (engine tasks T31-T35).

import { buildSheet, SHEET, INK, PAPER } from './sheet.js';
import { SUP_SCALE, SUP_RISE } from './text.js';

const FONT = "'Helvetica Neue', Helvetica, Arial, 'Hiragino Sans', 'Yu Gothic', sans-serif";

/**
 * Render a complete sheet.
 * @param {import('./sheet.js').SheetModel} model
 * @returns {string} standalone SVG document, 210 x 297 mm
 */
export function renderSVG(model) {
  return toSVG(buildSheet(model).items);
}

/**
 * Serialise display-list items.
 * @param {object[]} items
 * @param {{standalone?: boolean}} [opts]
 * @returns {string}
 */
export function toSVG(items, opts = {}) {
  const standalone = opts.standalone !== false;
  const body = items.map(item).join('\n');
  const head = standalone ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
  return `${head}<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.width}mm" height="${SHEET.height}mm" viewBox="0 0 ${SHEET.width} ${SHEET.height}" class="sheet" font-family="${FONT}" fill="none" stroke-linecap="butt">
<g stroke="${INK}">
${body}
</g>
</svg>`;
}

function n(v) {
  return Number(v.toFixed(3));
}

function item(it) {
  const color = it.color ?? INK;
  switch (it.t) {
    case 'line': {
      const dash = it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : '';
      const stroke = it.color ? ` stroke="${it.color}"` : '';
      return `<line x1="${n(it.x1)}" y1="${n(it.y1)}" x2="${n(it.x2)}" y2="${n(it.y2)}" stroke-width="${it.w}"${stroke}${dash}/>`;
    }
    case 'rect': {
      const paint = it.fill ? ` fill="${it.fill}" stroke="none"` : ` stroke-width="${it.w}"`;
      const role = it.role ? ` class="s-${it.role}"` : '';
      return `<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.width)}" height="${n(it.height)}"${paint}${role}/>`;
    }
    case 'circle': {
      const fill = it.fill ? ` fill="${it.fill}"` : '';
      return `<circle cx="${n(it.cx)}" cy="${n(it.cy)}" r="${it.r}" stroke-width="${it.w}"${fill}/>`;
    }
    case 'text': {
      const anchor = it.anchor && it.anchor !== 'start' ? ` text-anchor="${it.anchor}"` : '';
      const rot = it.rot ? ` transform="rotate(${n(it.rot)} ${n(it.x)} ${n(it.y)})"` : '';
      const sp = it.spacing ? ` letter-spacing="${it.spacing}"` : '';
      const role = it.role ? ` class="s-${it.role}"` : '';
      const halo = it.halo ? ` stroke="${PAPER}" stroke-width="0.7" stroke-linejoin="round" paint-order="stroke"` : ' stroke="none"';
      let inner = '';
      let raised = false;
      for (const r of it.runs) {
        const style = r.font === 'italic' ? ' font-style="italic"' : '';
        if (r.sup && !raised) {
          inner += `<tspan dy="${n(-it.size * SUP_RISE)}" font-size="${n(it.size * SUP_SCALE)}"${style}>${esc(r.text)}</tspan>`;
          raised = true;
        } else if (r.sup) {
          inner += `<tspan font-size="${n(it.size * SUP_SCALE)}"${style}>${esc(r.text)}</tspan>`;
        } else if (raised) {
          inner += `<tspan dy="${n(it.size * SUP_RISE)}"${style}>${esc(r.text)}</tspan>`;
          raised = false;
        } else {
          inner += style ? `<tspan${style}>${esc(r.text)}</tspan>` : esc(r.text);
        }
      }
      return `<text x="${n(it.x)}" y="${n(it.y)}" font-size="${n(it.size)}" fill="${color}"${halo} xml:space="preserve"${anchor}${rot}${sp}${role}>${inner}</text>`;
    }
    default:
      return '';
  }
}

/**
 * Escape text for XML.
 * @param {string} s
 * @returns {string}
 */
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
