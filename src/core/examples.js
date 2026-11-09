// examples.js - Built-in example charts (engine task T36)

/**
 * @typedef {object} Example
 * @property {string} id - Stable identifier, used in file names
 * @property {string} name - Display name
 * @property {string} formula - Formula as typed, `out = expression`
 * @property {Record<string, [number, number]>} ranges - Input ranges
 * @property {Record<string, string>} units - Unit per variable (inputs and output)
 * @property {'parallel' | 'z'} layout - Preferred layout
 * @property {string} description - One line
 * @property {{u: number, v: number}} key - Values for the printed key line
 */

/** @type {Example[]} */
const EXAMPLES = [
  {
    id: 'ohms-law',
    name: "Ohm's law",
    formula: 'V = I * R',
    ranges: { I: [0.1, 10], R: [1, 1000] },
    units: { I: 'A', R: 'Ω', V: 'V' },
    layout: 'parallel',
    description: 'Product form, logarithmic parallel scales.',
    key: { u: 2, v: 50 }
  },
  {
    id: 'body-surface-area',
    name: 'Body surface area (Mosteller)',
    formula: 'BSA = sqrt(height * weight / 3600)',
    ranges: { height: [100, 210], weight: [10, 150] },
    units: { height: 'cm', weight: 'kg', BSA: 'm²' },
    layout: 'parallel',
    description: 'Square root of a product; the clinic chart of the 1980s.',
    key: { u: 170, v: 65 }
  },
  {
    id: 'hypotenuse',
    name: 'Right-triangle hypotenuse',
    formula: 'c = sqrt(a^2 + b^2)',
    ranges: { a: [0, 10], b: [0, 10] },
    units: { a: '', b: '', c: '' },
    layout: 'parallel',
    description: 'Square root of a sum; quadratic scales.',
    key: { u: 3, v: 4 }
  },
  {
    id: 'reynolds',
    name: 'Reynolds number in water',
    formula: 'Re = v * D / 1e-6',
    ranges: { v: [0.01, 10], D: [0.001, 1] },
    units: { v: 'm/s', D: 'm', Re: '' },
    layout: 'parallel',
    description: 'Re = v·D/ν with ν = 1.0e-6 m²/s (water near 20 °C).',
    key: { u: 1, v: 0.05 }
  },
  {
    id: 'axial-stress',
    name: 'Axial stress',
    formula: 'sigma = 1000 * F / A',
    ranges: { F: [5, 50], A: [100, 500] },
    units: { F: 'kN', A: 'mm²', sigma: 'MPa' },
    layout: 'z',
    description: 'Linear ratio as a Z-chart; F in kN, A in mm².',
    key: { u: 20, v: 200 }
  },
  {
    id: 'weighted-sum',
    name: 'Weighted sum',
    formula: 'w = 2*u + v',
    ranges: { u: [0, 10], v: [0, 5] },
    units: { u: '', v: '', w: '' },
    layout: 'parallel',
    description: 'Sum form, linear parallel scales.',
    key: { u: 4, v: 2 }
  }
];

/**
 * Return a fresh copy of the built-in examples.
 * @returns {Example[]}
 */
export function getExamples() {
  return EXAMPLES.map((e) => structuredClone(e));
}

/**
 * Find an example by id.
 * @param {string} id
 * @returns {Example | undefined}
 */
export function getExample(id) {
  const e = EXAMPLES.find((x) => x.id === id);
  return e ? structuredClone(e) : undefined;
}
