// scales.js - Scale functions and tick generation

/**
 * Generate tick marks and labels for a scale.
 * @param {number} min - Scale minimum
 * @param {number} max - Scale maximum
 * @param {'linear' | 'log'} kind - Scale type
 * @param {number} lengthMm - Physical scale length in mm
 * @returns {{major: {value: number, label: string}[], minor: {value: number}[]}}
 */
export function generateTicks(min, max, kind, lengthMm) {
  if (kind === 'linear') {
    return generateLinearTicks(min, max, lengthMm);
  } else if (kind === 'log') {
    return generateLogTicks(min, max, lengthMm);
  }
  return {major: [], minor: []};
}

/**
 * Apply a scale function to a value.
 * @param {number} value - Input value
 * @param {number} min - Scale min
 * @param {number} max - Scale max
 * @param {'linear' | 'log'} kind - Scale type
 * @returns {number} Normalized position in [0, 1]
 */
export function scaleValue(value, min, max, kind) {
  if (kind === 'linear') {
    return (value - min) / (max - min);
  } else if (kind === 'log') {
    return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  }
  return 0;
}

/**
 * Inverse of scaleValue.
 * @param {number} t - Normalized position in [0, 1]
 * @param {number} min - Scale min
 * @param {number} max - Scale max
 * @param {'linear' | 'log'} kind - Scale type
 * @returns {number} Value
 */
export function unscaleValue(t, min, max, kind) {
  if (kind === 'linear') {
    return min + t * (max - min);
  } else if (kind === 'log') {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    return Math.pow(10, logMin + t * (logMax - logMin));
  }
  return 0;
}

/**
 * Format a tick label with appropriate precision and notation.
 * @param {number} value
 * @returns {string}
 */
export function formatTickLabel(value) {
  const absVal = Math.abs(value);

  // Use scientific notation for very small or very large numbers
  if ((absVal < 0.01 && absVal > 0) || absVal >= 10000) {
    return value.toExponential(2);
  }

  // Use fixed-point for normal range
  if (absVal === 0 || (absVal >= 0.01 && absVal < 10000)) {
    // Determine decimal places
    if (absVal === 0) return '0';
    if (absVal < 1) {
      return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    } else if (absVal < 100) {
      return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    } else {
      return Math.round(value).toString();
    }
  }

  return String(value);
}

/**
 * Generate linear ticks using 1-2-5 rule.
 */
function generateLinearTicks(min, max, lengthMm) {
  const range = max - min;
  if (range === 0) return {major: [], minor: []};

  // Find appropriate step size using 1-2-5 rule
  // We want roughly 5-15 major ticks
  const roughStep = range / 10;
  const exponent = Math.floor(Math.log10(roughStep));
  const mantissa = roughStep / Math.pow(10, exponent);

  let step;
  if (mantissa < 1.5) {
    step = Math.pow(10, exponent);
  } else if (mantissa < 3.5) {
    step = 2 * Math.pow(10, exponent);
  } else if (mantissa < 7) {
    step = 5 * Math.pow(10, exponent);
  } else {
    step = 10 * Math.pow(10, exponent);
  }

  const major = [];
  let tickValue = Math.ceil(min / step) * step;

  while (tickValue <= max + step * 0.0001) {
    if (tickValue >= min - step * 0.0001) {
      const label = formatTickLabel(tickValue);
      major.push({value: tickValue, label});
    }
    tickValue += step;
  }

  // Minor ticks: subdivide each step into 5 parts
  const minor = [];
  const minorStep = step / 5;
  let minorValue = Math.ceil(min / minorStep) * minorStep;

  while (minorValue <= max + minorStep * 0.0001) {
    if (minorValue >= min - minorStep * 0.0001) {
      // Check if not a major tick
      const isMajor = major.some(m => Math.abs(m.value - minorValue) < minorStep * 0.0001);
      if (!isMajor) {
        minor.push({value: minorValue});
      }
    }
    minorValue += minorStep;
  }

  return {major, minor};
}

/**
 * Generate logarithmic ticks.
 */
function generateLogTicks(min, max, lengthMm) {
  if (min <= 0 || max <= 0) {
    return {major: [], minor: []};
  }

  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const decadeSpan = Math.ceil(logMax) - Math.floor(logMin);

  const major = [];
  const minor = [];

  // Major ticks: 10^k for each relevant k
  for (let k = Math.floor(logMin); k <= Math.ceil(logMax); k++) {
    const tickValue = Math.pow(10, k);
    if (tickValue >= min * (1 - 1e-10) && tickValue <= max * (1 + 1e-10)) {
      const label = formatTickLabel(tickValue);
      major.push({value: tickValue, label});
    }
  }

  // Minor ticks: 2·10^k, 3·10^k, ..., 9·10^k for each decade
  // Only include minors if the range spans < 2 decades
  if (decadeSpan < 2) {
    for (let k = Math.floor(logMin); k <= Math.ceil(logMax); k++) {
      for (let m = 2; m <= 9; m++) {
        const tickValue = m * Math.pow(10, k);
        if (tickValue >= min * (1 - 1e-10) && tickValue <= max * (1 + 1e-10)) {
          minor.push({value: tickValue});
        }
      }
    }
  }

  return {major, minor};
}

/**
 * Thin out labels to respect minimum spacing.
 * @param {{value: number, label: string, posMm: number}[]} labels - Candidate labels
 * @param {number} minSpacingMm - Minimum gap (default 3 mm)
 * @returns {{value: number, label: string, posMm: number}[]} Filtered labels
 */
export function thinLabels(labels, minSpacingMm = 3) {
  if (labels.length === 0) return [];

  const result = [];
  let lastPos = -Infinity;

  // Always try to keep first and last
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const isFirst = i === 0;
    const isLast = i === labels.length - 1;

    if (isFirst) {
      result.push(label);
      lastPos = label.posMm;
    } else if (isLast) {
      // Check if there's space for the last label
      if (label.posMm - lastPos >= minSpacingMm - 0.0001) {
        result.push(label);
      }
    } else {
      // Middle labels: keep if there's space
      if (label.posMm - lastPos >= minSpacingMm - 0.0001) {
        result.push(label);
        lastPos = label.posMm;
      }
    }
  }

  return result;
}
