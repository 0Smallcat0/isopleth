// src/ui/state.js - DOM-free state helpers for Chart Studio

/**
 * Encode state to URL hash (JSON + encodeURIComponent).
 * @param {object} state - {formula, ranges, units, layout, deltaMm, exampleId}
 * @returns {string} Encoded hash fragment (without leading '#')
 */
export function encodeStateToHash(state) {
  const compact = {
    f: state.formula,
    r: state.ranges,
    u: state.units || {},
    l: state.layout || 'parallel',
    d: state.deltaMm !== undefined ? state.deltaMm : 0.5,
    x: state.exampleId ? state.exampleId : null
  };
  return encodeURIComponent(JSON.stringify(compact));
}

/**
 * Decode hash back to state.
 * @param {string} hash - URL fragment (with or without leading '#')
 * @returns {object | null} Parsed state, or null if invalid
 */
export function decodeStateFromHash(hash) {
  if (!hash) return null;
  
  // Strip leading '#' if present
  let hashStr = hash;
  if (hashStr.startsWith('#')) {
    hashStr = hashStr.slice(1);
  }
  
  try {
    const decoded = decodeURIComponent(hashStr);
    const compact = JSON.parse(decoded);
    
    // Validate structure
    if (typeof compact.f !== 'string' || compact.f.length > 500) {
      return null;
    }
    
    // Validate ranges
    if (typeof compact.r !== 'object' || compact.r === null) {
      return null;
    }
    for (const [key, range] of Object.entries(compact.r)) {
      if (!Array.isArray(range) || range.length !== 2) {
        return null;
      }
      const [min, max] = range;
      if (typeof min !== 'number' || typeof max !== 'number') {
        return null;
      }
      if (!isFinite(min) || !isFinite(max)) {
        return null;
      }
      if (min >= max) {
        return null;
      }
    }
    
    // Validate units (optional, defaults to empty object)
    let units = {};
    if (compact.u !== undefined) {
      if (typeof compact.u !== 'object' || compact.u === null) {
        return null;
      }
      for (const [key, unit] of Object.entries(compact.u)) {
        if (typeof unit !== 'string') {
          return null;
        }
      }
      units = compact.u;
    }
    
    // Validate layout (optional, defaults to 'parallel')
    let layout = 'parallel';
    if (compact.l !== undefined) {
      if (compact.l !== 'parallel' && compact.l !== 'z') {
        return null;
      }
      layout = compact.l;
    }
    
    // Validate deltaMm (optional, defaults to 0.5)
    let deltaMm = 0.5;
    if (compact.d !== undefined) {
      if (typeof compact.d !== 'number') {
        return null;
      }
      if (!isFinite(compact.d)) {
        return null;
      }
      if (compact.d < 0.1 || compact.d > 5) {
        return null;
      }
      deltaMm = compact.d;
    }
    
    // Validate exampleId (optional, defaults to null)
    let exampleId = null;
    if (compact.x !== undefined) {
      if (compact.x !== null && typeof compact.x !== 'string') {
        return null;
      }
      exampleId = compact.x;
    }
    
    return {
      formula: compact.f,
      ranges: compact.r,
      units,
      layout,
      deltaMm,
      exampleId
    };
  } catch (e) {
    return null;
  }
}

/**
 * Compute the next order of scales when one is moved.
 * @param {number[]} order - Current order [0, 1, 2]
 * @param {number} moved - Index that was just moved (0, 1, or 2)
 * @returns {{order: number[], solved: number}} New order and the solved index
 */
export function nextSolved(order, moved) {
  // moved comes first; the other two keep their relative order
  const newOrder = [moved, ...order.filter(i => i !== moved)];
  const solved = newOrder[newOrder.length - 1];
  return { order: newOrder, solved };
}

/**
 * Generate filename from state.
 * @param {object} state - {formula, exampleId, ...}
 * @param {string} ext - File extension (e.g., 'svg', 'pdf')
 * @returns {string} Filename (e.g., 'isopleth-ohms-law.svg')
 */
export function fileName(state, ext) {
  let slug;
  
  if (state.exampleId) {
    slug = state.exampleId;
  } else {
    // Convert formula to slug: lowercase, replace non-[a-z0-9] with '-'
    slug = state.formula
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''); // trim leading/trailing '-'
    
    // Limit to 40 characters
    if (slug.length > 40) {
      slug = slug.slice(0, 40).replace(/-+$/, ''); // also trim trailing '-' after slice
    }
    
    // Default to 'chart' if empty
    if (!slug) {
      slug = 'chart';
    }
  }
  
  return `isopleth-${slug}.${ext}`;
}
