// compile.js - Form recognition and chart definition generation

import { evaluate, print } from './expr.js';

/**
 * @typedef {object} ChartDefinition
 * @property {string} form - 'sum' | 'product' | 'outer' | 'z-chart'
 * @property {{name: string, fn: (x: number) => number, range: [number, number], scaleKind: 'linear' | 'log'}[]} scales - Three scale definitions
 * @property {(u: number, v: number) => number} evaluate - Direct evaluator f(u, v) -> w
 * @property {string} formula - Original formula for display
 */

/**
 * Recognize a formula and produce a chart definition.
 * @param {object} ast - The right-hand side AST
 * @param {string} outputVar - The left-hand side variable name
 * @param {Record<string, [number, number]>} ranges - Variable ranges {var: [min, max]}
 * @param {'parallel' | 'z'} layout - Chart layout style
 * @returns {ChartDefinition | {error: string}}
 */
export function compile(ast, outputVar, ranges, layout) {
  const originalFormula = print(ast);  // Keep original formula for display
  
  // First, normalize outer functions of PRODUCTS only: convert sqrt(product) or ^p(product) to product form
  let normalizedAst = ast;
  let isNormalized = false;
  
  const isOuterSqrt = ast.kind === 'call' && ast.fn === 'sqrt' && ast.args.length === 1;
  const isOuterPower = ast.kind === 'binop' && ast.op === '^' && ast.right.kind === 'number';
  
  if (isOuterSqrt) {
    // Check if the inner expression is a product (not a sum)
    if (isMultiplicative(ast.args[0])) {
      const normalized = distributeExponent(ast.args[0], 0.5);
      if (normalized !== ast.args[0]) {
        normalizedAst = normalized;
        isNormalized = true;
      }
    }
  } else if (isOuterPower) {
    // Check if the inner expression is a product (not a sum)
    if (isMultiplicative(ast.left)) {
      const normalized = distributeExponent(ast.left, ast.right.value);
      if (normalized !== ast.left) {
        normalizedAst = normalized;
        isNormalized = true;
      }
    }
  }

  // Try to match forms in order: sum, product, outer, Z-chart
  let result;

  result = trySum(normalizedAst, outputVar, ranges);
  if (result && !result.error) {
    if (isNormalized) result.form = 'outer';
    result.formula = originalFormula;  // Use original formula for display
    return result;
  }

  // If layout is 'z', try Z-chart first before product
  if (layout === 'z') {
    result = tryZChart(normalizedAst, outputVar, ranges);
    if (result && !result.error) {
      result.formula = originalFormula;
      return result;
    }
  }

  result = tryProduct(normalizedAst, outputVar, ranges);
  if (result && !result.error) {
    if (isNormalized) result.form = 'outer';
    result.formula = originalFormula;
    return result;
  }

  result = tryOuterFunction(ast, outputVar, ranges);
  if (result && !result.error) {
    result.formula = originalFormula;
    return result;
  }

  return {
    error: 'Unsupported formula form. Supported: sum (w = c + A(u) + B(v)), product (w = k·A(u)·B(v)), outer function (sqrt, exp, ln, log10, ^p), Z-chart (w = k·u/v).'
  };
}

/**
 * Check if an AST represents a purely multiplicative expression (no additive operators at top level).
 */
function isMultiplicative(ast) {
  if (!ast) return false;
  if (ast.kind === 'binop' && (ast.op === '+' || ast.op === '-')) {
    return false;
  }
  if (ast.kind === 'binop' && (ast.op === '*' || ast.op === '/')) {
    return isMultiplicative(ast.left) && isMultiplicative(ast.right);
  }
  return true;
}

/**
 * Get list of variables in an AST (at any nesting level).
 */
function getVariables(ast) {
  const vars = [];
  const seen = new Set();

  function walk(node) {
    if (!node) return;
    if (node.kind === 'identifier' && !seen.has(node.name) && !['pi', 'e'].includes(node.name)) {
      seen.add(node.name);
      vars.push(node.name);
    } else if (node.kind === 'binop') {
      walk(node.left);
      walk(node.right);
    } else if (node.kind === 'unary') {
      walk(node.arg);
    } else if (node.kind === 'call') {
      for (const arg of node.args) walk(arg);
    }
  }

  walk(ast);
  return vars;
}

/**
 * Normalize outer functions: convert sqrt(product) or ^p(product) to product form.
 * E.g., sqrt(H*W/3600) => 3600^-0.5 * H^0.5 * W^0.5
 */
function distributeExponent(ast, exp) {
  if (ast.kind === 'binop' && ast.op === '*') {
    return {
      kind: 'binop',
      op: '*',
      left: distributeExponent(ast.left, exp),
      right: distributeExponent(ast.right, exp)
    };
  } else if (ast.kind === 'binop' && ast.op === '/') {
    return {
      kind: 'binop',
      op: '*',
      left: distributeExponent(ast.left, exp),
      right: {
        kind: 'binop',
        op: '^',
        left: ast.right,
        right: {kind: 'number', value: -exp}
      }
    };
  } else if (ast.kind === 'binop' && ast.op === '^') {
    // (x^p)^q = x^(p*q)
    return {
      kind: 'binop',
      op: '^',
      left: ast.left,
      right: {kind: 'number', value: ast.right.value * exp}
    };
  } else {
    // Apply exponent to this single term
    return {
      kind: 'binop',
      op: '^',
      left: ast,
      right: {kind: 'number', value: exp}
    };
  }
}

/**
 * Try to match sum form: w = c + a*A(u) + b*B(v)
 */
function trySum(ast, outputVar, ranges) {
  const vars = Object.keys(ranges);

  // Collect additive terms
  const terms = collectAdditiveTerms(ast);
  if (!terms) return null;

  // Identify constant terms and variable-containing terms
  let constant = 0;
  const varTerms = {}; // {varname: {ast, coeff}}
  
  for (const term of terms) {
    const termVars = getVariables(term);
    
    if (termVars.length === 0) {
      // Constant term
      const val = evaluate(term, {});
      if (typeof val === 'number' && !isNaN(val)) {
        constant += val;
      } else {
        return null;
      }
    } else if (termVars.length === 1) {
      const v = termVars[0];
      if (!(v in ranges)) return null; // Unknown variable
      if (v in varTerms) return null; // Duplicate variable
      varTerms[v] = term;
    } else {
      return null; // Multiple variables in one term
    }
  }

  // Must have exactly two different variables
  const inputVars = Object.keys(varTerms);
  if (inputVars.length !== 2) return null;

  const [u, v] = inputVars;

  // Build scale functions and compute ranges
  const scales = [];

  // Evaluate scale functions at range extremes
  const f1_min = evaluateAtBounds(varTerms[u], u, ranges[u][0], ranges);
  const f1_max = evaluateAtBounds(varTerms[u], u, ranges[u][1], ranges);
  const f2_min = evaluateAtBounds(varTerms[v], v, ranges[v][0], ranges);
  const f2_max = evaluateAtBounds(varTerms[v], v, ranges[v][1], ranges);

  // Scale 1: f1(u) - store the actual AST so fn can evaluate it properly
  scales.push({
    name: u,
    variable: u,
    fn: (x) => evaluateAtBounds(varTerms[u], u, x, ranges),
    range: [ranges[u][0], ranges[u][1]],
    scaleKind: 'linear',
    min: Math.min(f1_min, f1_max),
    max: Math.max(f1_min, f1_max),
    _ast: varTerms[u]  // Store for inspection in tests
  });

  // Scale 2: f2(v)
  scales.push({
    name: v,
    variable: v,
    fn: (x) => evaluateAtBounds(varTerms[v], v, x, ranges),
    range: [ranges[v][0], ranges[v][1]],
    scaleKind: 'linear',
    min: Math.min(f2_min, f2_max),
    max: Math.max(f2_min, f2_max),
    _ast: varTerms[v]  // Store for inspection in tests
  });

  // Compute output range
  const w_vals = [
    f1_min + f2_min + constant,
    f1_min + f2_max + constant,
    f1_max + f2_min + constant,
    f1_max + f2_max + constant
  ];
  const w_min = Math.min(...w_vals);
  const w_max = Math.max(...w_vals);

  // Scale 3: f3(w) = w - c
  scales.push({
    name: outputVar,
    variable: outputVar,
    fn: (w) => w - constant,
    range: [w_min, w_max],
    scaleKind: 'linear',
    min: w_min - constant,
    max: w_max - constant
  });

  return {
    form: 'sum',
    scales,
    evaluate: (u_val, v_val) => {
      const f1 = evaluateAtBounds(varTerms[u], u, u_val, ranges);
      const f2 = evaluateAtBounds(varTerms[v], v, v_val, ranges);
      return f1 + f2 + constant;
    }
  };
}

/**
 * Collect additive terms from an AST.
 * Returns array of term ASTs, or null if not additive structure.
 */
function collectAdditiveTerms(ast) {
  if (ast.kind === 'binop' && ast.op === '+') {
    const left = collectAdditiveTerms(ast.left);
    const right = collectAdditiveTerms(ast.right);
    if (!left || !right) return null;
    return [...left, ...right];
  }

  if (ast.kind === 'binop' && ast.op === '-') {
    const left = collectAdditiveTerms(ast.left);
    if (!left) return null;
    const right = collectAdditiveTerms(ast.right);
    if (!right) return null;
    // Negate right side
    const negated = right.map(term => ({
      kind: 'unary',
      op: '-',
      arg: term
    }));
    return [...left, ...negated];
  }

  return [ast];
}

/**
 * Evaluate an AST for a given variable binding.
 */
function evaluateAtBounds(ast, variable, value, ranges) {
  const bindings = {[variable]: value};
  // Provide default values for other variables (shouldn't be used)
  for (const v in ranges) {
    if (!(v in bindings)) {
      bindings[v] = ranges[v][0];
    }
  }
  const result = evaluate(ast, bindings);
  if (typeof result === 'number') return result;
  return 0;
}

/**
 * Try to match product form: w = k * A(u)^p * B(v)^q
 */
function tryProduct(ast, outputVar, ranges) {
  const vars = Object.keys(ranges);

  // Collect multiplicative factors
  const factors = collectMultiplicativeFactors(ast);
  if (!factors) return null;

  let k = 1;
  const exponents = {}; // {u: p, v: q}

  for (const factor of factors) {
    const {coeff, variable, exp} = analyzePowerFactor(factor);

    if (variable === null) {
      // Constant factor
      const val = evaluate(factor, {});
      if (typeof val === 'number' && isFinite(val)) {
        k *= val;
      } else {
        return null;
      }
    } else {
      if (!(variable in ranges)) return null;
      if (variable in exponents) return null; // Duplicate
      exponents[variable] = exp;
    }
  }

  // Must have exactly two different variables
  const inputVars = Object.keys(exponents);
  if (inputVars.length !== 2) return null;

  const [u, v] = inputVars;

  // Check that ranges are all positive
  if (ranges[u][0] <= 0 || ranges[u][1] <= 0 || ranges[v][0] <= 0 || ranges[v][1] <= 0) {
    return null;
  }

  const p = exponents[u];
  const q = exponents[v];

  // Build chart definition with log scales
  const scales = [];

  scales.push({
    name: u,
    variable: u,
    fn: (x) => p * Math.log10(x),
    range: [ranges[u][0], ranges[u][1]],
    scaleKind: 'log',
    min: p * Math.log10(ranges[u][0]),
    max: p * Math.log10(ranges[u][1])
  });

  scales.push({
    name: v,
    variable: v,
    fn: (x) => q * Math.log10(x),
    range: [ranges[v][0], ranges[v][1]],
    scaleKind: 'log',
    min: q * Math.log10(ranges[v][0]),
    max: q * Math.log10(ranges[v][1])
  });

  // Compute output range
  const w_vals = [
    k * Math.pow(ranges[u][0], p) * Math.pow(ranges[v][0], q),
    k * Math.pow(ranges[u][0], p) * Math.pow(ranges[v][1], q),
    k * Math.pow(ranges[u][1], p) * Math.pow(ranges[v][0], q),
    k * Math.pow(ranges[u][1], p) * Math.pow(ranges[v][1], q)
  ];
  const w_min = Math.min(...w_vals);
  const w_max = Math.max(...w_vals);

  scales.push({
    name: outputVar,
    variable: outputVar,
    fn: (w) => Math.log10(w / k),
    range: [w_min, w_max],
    scaleKind: 'log',
    min: Math.log10(w_min / k),
    max: Math.log10(w_max / k)
  });

  return {
    form: 'product',
    scales,
    evaluate: (u_val, v_val) => k * Math.pow(u_val, p) * Math.pow(v_val, q)
  };
}

/**
 * Collect multiplicative factors from an AST.
 */
function collectMultiplicativeFactors(ast) {
  if (ast.kind === 'binop' && ast.op === '*') {
    const left = collectMultiplicativeFactors(ast.left);
    const right = collectMultiplicativeFactors(ast.right);
    if (!left || !right) return null;
    return [...left, ...right];
  }

  if (ast.kind === 'binop' && ast.op === '/') {
    const left = collectMultiplicativeFactors(ast.left);
    if (!left) return null;
    const right = collectMultiplicativeFactors(ast.right);
    if (!right) return null;
    // Invert right side: a/b = a * b^-1
    const inverted = right.map(f => ({
      kind: 'binop',
      op: '^',
      left: f,
      right: {kind: 'number', value: -1}
    }));
    return [...left, ...inverted];
  }

  return [ast];
}

/**
 * Analyze a power factor: extract exponent and variable.
 * Returns {coeff, variable, exp} where variable is null for constants.
 */
function analyzePowerFactor(ast) {
  // Case: identifier (exponent 1)
  if (ast.kind === 'identifier') {
    return {coeff: 1, variable: ast.name, exp: 1};
  }

  // Case: identifier ^ exponent
  if (ast.kind === 'binop' && ast.op === '^') {
    if (ast.left.kind === 'identifier' && ast.right.kind === 'number') {
      return {coeff: 1, variable: ast.left.name, exp: ast.right.value};
    }
  }

  // Case: constant
  if (ast.kind === 'number') {
    return {coeff: ast.value, variable: null, exp: 1};
  }

  // Case: constant^exponent
  if (ast.kind === 'binop' && ast.op === '^') {
    if (ast.left.kind === 'number' && ast.right.kind === 'number') {
      return {coeff: Math.pow(ast.left.value, ast.right.value), variable: null, exp: 1};
    }
  }

  return {coeff: 1, variable: null, exp: 1};
}

/**
 * Try to match outer function form: w = F(inner)
 */
function tryOuterFunction(ast, outputVar, ranges) {
  // Check if ast is a function call or exponentiation that represents an outer function
  let outerFn = null;
  let innerAst = null;
  let fnParam = null;

  if (ast.kind === 'call') {
    if (['sqrt', 'exp', 'ln', 'log10'].includes(ast.fn) && ast.args.length === 1) {
      outerFn = ast.fn;
      innerAst = ast.args[0];
    }
  } else if (ast.kind === 'binop' && ast.op === '^' && ast.right.kind === 'number') {
    outerFn = '^';
    innerAst = ast.left;
    fnParam = ast.right.value;
  }

  if (!outerFn || !innerAst) return null;

  // Recursively compile the inner expression
  const innerChart = compile(innerAst, outputVar, ranges, 'parallel');
  if (innerChart.error) return null;

  // Build outer chart by copying scales and modifying the output scale
  const scales = [];
  
  for (let i = 0; i < 2; i++) {
    // Copy input scales as-is
    scales.push({
      name: innerChart.scales[i].name,
      variable: innerChart.scales[i].variable,
      fn: innerChart.scales[i].fn,
      range: [...innerChart.scales[i].range],
      scaleKind: innerChart.scales[i].scaleKind,
      min: innerChart.scales[i].min,
      max: innerChart.scales[i].max
    });
  }

  // Modify output scale
  const outputScale = innerChart.scales[2];
  const oldFn = outputScale.fn;
  const oldRange = outputScale.range;
  const oldMin = outputScale.min;
  const oldMax = outputScale.max;

  // The old range is the inner result range (e.g., for sqrt(H*W/3600), it's [sqrt(2000/3600), sqrt(33000/3600)])
  // The new range should be what comes OUT of the outer function
  // newMin = F(oldMin), newMax = F(oldMax)
  const newMin = applyFunction(oldMin, outerFn, fnParam);
  const newMax = applyFunction(oldMax, outerFn, fnParam);

  // Apply inverse to output scale function: f_out(w) should transform w back through F^-1
  const newFn = (w) => {
    const innerVal = applyInverse(w, outerFn, fnParam);
    return oldFn(innerVal);
  };

  scales.push({
    name: outputScale.name,
    variable: outputScale.variable,
    fn: newFn,
    range: [Math.min(newMin, newMax), Math.max(newMin, newMax)],
    scaleKind: outputScale.scaleKind,
    min: Math.min(newMin, newMax),
    max: Math.max(newMin, newMax)
  });

  // New evaluate function applies outer function to inner result
  const innerEvaluate = innerChart.evaluate;
  const newEvaluate = (u_val, v_val) => {
    const innerResult = innerEvaluate(u_val, v_val);
    return applyFunction(innerResult, outerFn, fnParam);
  };

  return {
    form: 'outer',
    scales,
    evaluate: newEvaluate
  };
}

/**
 * Apply an outer function to a value.
 */
function applyFunction(value, fnName, param) {
  if (fnName === 'sqrt') return Math.sqrt(value);
  if (fnName === '^') return Math.pow(value, param);
  if (fnName === 'ln') return Math.log(value);
  if (fnName === 'exp') return Math.exp(value);
  if (fnName === 'log10') return Math.log10(value);
  return value;
}

function applyInverse(value, fnName, param) {
  if (fnName === 'sqrt' || fnName === '^') {
    const p = fnName === 'sqrt' ? 2 : (1 / param);
    return Math.pow(value, p);
  }
  if (fnName === 'ln') return Math.exp(value);
  if (fnName === 'exp') return Math.log(value);
  if (fnName === 'log10') return Math.pow(10, value);
  return value;
}

/**
 * Try to match Z-chart form: w = k*u/v
 * For Z-chart, scale functions are f1(u) = u, f2(v) = v, f3(w) = w/k (all linear)
 */
function tryZChart(ast, outputVar, ranges) {
  // Z-chart must be a division: w = A(u) / B(v) where A and B are linear in their variables
  const factors = collectMultiplicativeFactors(ast);
  if (!factors) return null;

  let numeratorFactors = [];
  let denominatorFactors = [];
  let k = 1;
  
  for (const factor of factors) {
    // Check if this factor is in the numerator or denominator
    // by examining the original AST structure
    // For now, use a simpler approach: collect factors and track divisions
  }

  // Simpler approach: try to extract u/v structure directly
  if (ast.kind === 'binop' && ast.op === '/') {
    const numerator = ast.left;
    const denominator = ast.right;

    // Try to extract two single variables: u and v
    const numeratorVars = getVariables(numerator);
    const denominatorVars = getVariables(denominator);

    if (numeratorVars.length === 1 && denominatorVars.length === 1) {
      const u = numeratorVars[0];
      const v = denominatorVars[0];

      if (u in ranges && v in ranges && u !== v && ranges[u][0] > 0 && ranges[v][0] > 0) {
        // Valid Z-chart: w = numerator / denominator
        // Extract constant k
        const k_num = evaluate(numerator, {[u]: 1}) || 1;
        const k_denom = evaluate(denominator, {[v]: 1}) || 1;
        const k = k_num / k_denom;

        const scales = [];

        // Scale 0: u (linear)
        scales.push({
          name: u,
          variable: u,
          fn: (x) => x,
          range: [ranges[u][0], ranges[u][1]],
          scaleKind: 'linear',
          min: ranges[u][0],
          max: ranges[u][1]
        });

        // Scale 1: v (linear)
        scales.push({
          name: v,
          variable: v,
          fn: (x) => x,
          range: [ranges[v][0], ranges[v][1]],
          scaleKind: 'linear',
          min: ranges[v][0],
          max: ranges[v][1]
        });

        // Compute output range
        const w_vals = [
          k * ranges[u][0] / ranges[v][0],
          k * ranges[u][0] / ranges[v][1],
          k * ranges[u][1] / ranges[v][0],
          k * ranges[u][1] / ranges[v][1]
        ];
        const w_min = Math.min(...w_vals);
        const w_max = Math.max(...w_vals);

        // Scale 2: w (linear diagonal)
        scales.push({
          name: outputVar,
          variable: outputVar,
          fn: (w) => w / k,
          range: [w_min, w_max],
          scaleKind: 'linear',
          min: w_min / k,
          max: w_max / k
        });

        return {
          form: 'z-chart',
          scales,
          evaluate: (u_val, v_val) => k * u_val / v_val
        };
      }
    }
  }

  return null;
}
