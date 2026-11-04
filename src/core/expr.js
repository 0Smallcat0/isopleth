// expr.js - Tokenizer, parser, evaluator, printer for mathematical expressions

/**
 * Token types
 * @typedef {'NUMBER'|'IDENTIFIER'|'OPERATOR'|'LPAREN'|'RPAREN'|'COMMA'|'EOF'} TokenType
 */

/**
 * Token structure
 * @typedef {{type: TokenType, value: string|number, pos: number}} Token
 */

// Tokenizer regex patterns
const NUMBER_PATTERN = /^(\d+(\.\d+)?(e[+-]?\d+)?)/i;
const IDENTIFIER_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]*|\u03B1|\u03B2|\u03B3|\u03B4|\u03B5|\u03B6|\u03B7|\u03B8|\u03B9|\u03BA|\u03BB|\u03BC|\u03BD|\u03BE|\u03BF|\u03C0|\u03C1|\u03C3|\u03C4|\u03C5|\u03C6|\u03C7|\u03C8|\u03C9|\u0391|\u0392|\u0393|\u0394|\u0395|\u0396|\u0397|\u0398|\u0399|\u039A|\u039B|\u039C|\u039D|\u039E|\u039F|\u03A0|\u03A1|\u03A3|\u03A4|\u03A5|\u03A6|\u03A7|\u03A8|\u03A9)/;
const OPERATORS = ['+', '-', '*', '/', '^'];

/**
 * Tokenize a formula string.
 * @param {string} source - The input formula
 * @returns {Token[]} Token array
 */
export function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const length = source.length;

  while (pos < length) {
    // Skip whitespace
    if (/\s/.test(source[pos])) {
      pos++;
      continue;
    }

    // Try to match a number (including scientific notation)
    const numMatch = source.slice(pos).match(NUMBER_PATTERN);
    if (numMatch) {
      tokens.push({
        type: 'NUMBER',
        value: parseFloat(numMatch[0]),
        pos
      });
      pos += numMatch[0].length;
      continue;
    }

    // Try to match an identifier (including Greek letters)
    const idMatch = source.slice(pos).match(IDENTIFIER_PATTERN);
    if (idMatch) {
      tokens.push({
        type: 'IDENTIFIER',
        value: idMatch[0],
        pos
      });
      pos += idMatch[0].length;
      continue;
    }

    // Try to match an operator
    const char = source[pos];
    if (OPERATORS.includes(char)) {
      tokens.push({
        type: 'OPERATOR',
        value: char,
        pos
      });
      pos++;
      continue;
    }

    // Try to match parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos });
      pos++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos });
      pos++;
      continue;
    }

    // Try to match comma
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos });
      pos++;
      continue;
    }

    // Unknown character - throw error at this position
    throw new Error(`Unexpected character '${char}' at position ${pos}`);
  }

  // Add EOF token
  tokens.push({ type: 'EOF', value: '', pos });

  return tokens;
}

/**
 * Parse tokens into an AST.
 * @param {Token[]} tokens
 * @returns {object|{error: string, pos: number}} AST or error
 */
export function parse(tokens) {
  let index = 0;

  function peek(offset = 0) {
    return tokens[index + offset];
  }

  function consume() {
    return tokens[index++];
  }

  // Grammar (recursive descent):
  // expression → assignment
  // assignment → identifier '=' addition
  // addition → multiplication ( ('+' | '-') multiplication )*
  // multiplication → exponent ( ('*' | '/') exponent )*
  // exponent → unary ( '^' exponent )?
  // unary → '-' unary | primary
  // primary → NUMBER | IDENTIFIER | functionCall | '(' expression ')'

  function parseAssignment() {
    // Check if first token is an identifier followed by '='
    if (peek().type === 'IDENTIFIER' && peek(1).type === 'OPERATOR' && peek(1).value === '=') {
      const id = consume();
      consume(); // consume '='
      const expr = parseAddition();
      if (expr.error) return expr;
      return expr;
    }

    // Otherwise, just parse an expression
    return parseAddition();
  }

  function parseAddition() {
    let left = parseMultiplication();
    if (left.error) return left;

    while (peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseMultiplication();
      if (right.error) return right;
      left = {
        kind: 'binop',
        op,
        left,
        right
      };
    }

    return left;
  }

  function parseMultiplication() {
    let left = parseExponent();
    if (left.error) return left;

    while (peek().type === 'OPERATOR' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseExponent();
      if (right.error) return right;
      left = {
        kind: 'binop',
        op,
        left,
        right
      };
    }

    return left;
  }

  function parseExponent() {
    let left = parseUnary();
    if (left.error) return left;

    while (peek().type === 'OPERATOR' && peek().value === '^') {
      consume(); // consume '^'
      const right = parseExponent(); // right-associative: recurse
      if (right.error) return right;
      left = {
        kind: 'binop',
        op: '^',
        left,
        right
      };
    }

    return left;
  }

  function parseUnary() {
    if (peek().type === 'OPERATOR' && peek().value === '-') {
      consume(); // consume '-'
      const arg = parseUnary();
      if (arg.error) return arg;
      return {
        kind: 'unary',
        op: '-',
        arg
      };
    }

    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();

    if (token.type === 'NUMBER') {
      consume();
      return {
        kind: 'number',
        value: token.value
      };
    }

    if (token.type === 'IDENTIFIER') {
      consume();

      // Check if it's a function call
      if (peek().type === 'LPAREN') {
        return parseFunctionCall(token.value);
      }

      return {
        kind: 'identifier',
        name: token.value
      };
    }

    if (token.type === 'LPAREN') {
      consume(); // consume '('
      const expr = parseAddition();
      if (expr.error) return expr;

      if (peek().type !== 'RPAREN') {
        return { error: "Expected ')'", pos: peek().pos };
      }
      consume(); // consume ')'

      return expr;
    }

    if (token.type === 'EOF') {
      return { error: "Unexpected end of input", pos };
    }

    return { error: `Unexpected token '${token.value}'`, pos: token.pos };
  }

  function parseFunctionCall(name) {
    consume(); // consume '('
    const args = [];

    if (peek().type !== 'RPAREN') {
      const firstArg = parseAddition();
      if (firstArg.error) return firstArg;
      args.push(firstArg);

      while (peek().type === 'COMMA') {
        consume(); // consume ','
        const arg = parseAddition();
        if (arg.error) return arg;
        args.push(arg);
      }
    }

    if (peek().type !== 'RPAREN') {
      return { error: "Expected ')' or ','", pos: peek().pos };
    }
    consume(); // consume ')'

    return {
      kind: 'call',
      fn: name,
      args
    };
  }

  const result = parseAssignment();

  // Check if there are remaining tokens after parsing
  if (!result.error && peek().type !== 'EOF') {
    return { error: `Unexpected token '${peek().value}' after expression`, pos: peek().pos };
  }

  return result;
}

/**
 * Evaluate an AST node with given variable bindings.
 * @param {object} node - The AST node
 * @param {Record<string, number>} bindings - Variable values
 * @returns {number|{error: string}} Result or error (division by zero, domain error)
 */
export function evaluate(node, bindings) {
  switch (node.kind) {
    case 'number':
      return node.value;

    case 'identifier':
      if (node.name === 'pi') return Math.PI;
      if (node.name === 'e') return Math.E;
      if (!(node.name in bindings)) {
        return { error: `Unknown variable '${node.name}'` };
      }
      return bindings[node.name];

    case 'binop': {
      const left = evaluate(node.left, bindings);
      if (left.error) return left;

      const right = evaluate(node.right, bindings);
      if (right.error) return right;

      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            return { error: 'Division by zero' };
          }
          return left / right;
        case '^':
          return Math.pow(left, right);
        default:
          return { error: `Unknown operator '${node.op}'` };
      }
    }

    case 'unary': {
      const arg = evaluate(node.arg, bindings);
      if (arg.error) return arg;

      if (node.op === '-') {
        return -arg;
      }

      return { error: `Unknown unary operator '${node.op}'` };
    }

    case 'call': {
      const args = [];
      for (const arg of node.args) {
        const result = evaluate(arg, bindings);
        if (result.error) return result;
        args.push(result);
      }

      return evaluateFunction(node.fn, args);
    }

    default:
      return { error: `Unknown AST node kind '${node.kind}'` };
  }
}

/**
 * Evaluate a function call.
 * @param {string} fn - Function name
 * @param {number[]} args - Arguments
 * @returns {number|{error: string}} Result or error
 */
function evaluateFunction(fn, args) {
  const functions = {
    sqrt: (x) => {
      if (x < 0) return { error: `sqrt of negative value: ${x}` };
      return Math.sqrt(x);
    },
    ln: (x) => {
      if (x <= 0) return { error: `ln of non-positive value: ${x}` };
      return Math.log(x);
    },
    log10: (x) => {
      if (x <= 0) return { error: `log10 of non-positive value: ${x}` };
      return Math.log10(x);
    },
    exp: (x) => Math.exp(x),
    abs: (x) => Math.abs(x),
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    tan: (x) => Math.tan(x)
  };

  if (!(fn in functions)) {
    return { error: `Unknown function '${fn}'` };
  }

  return functions[fn](...args);
}

/**
 * Print an AST node back to infix notation.
 * @param {object} node - The AST node
 * @returns {string} Infix string
 */
export function print(node) {
  switch (node.kind) {
    case 'number':
      return String(node.value);

    case 'identifier':
      return node.name;

    case 'binop': {
      const left = print(node.left);
      const right = print(node.right);
      const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
      const opPrec = precedence[node.op];

      // Add parentheses to left if it has lower precedence
      const leftNeedsParens = node.left.kind === 'binop' && precedence[node.left.op] < opPrec;
      // Add parentheses to right if it has lower precedence
      // For power operator (right-associative), don't add parens to right if it's also power
      let rightNeedsParens = node.right.kind === 'binop' && precedence[node.right.op] < opPrec;
      if (node.op === '^' && node.right.kind === 'binop' && node.right.op === '^') {
        // a ^ (b ^ c) is fine as a ^ b ^ c
        rightNeedsParens = false;
      }

      const l = leftNeedsParens ? `(${left})` : left;
      const r = rightNeedsParens ? `(${right})` : right;

      return `${l} ${node.op} ${r}`;
    }

    case 'unary': {
      const argPrinted = print(node.arg);
      // Unary minus needs parentheses if the argument is a binop
      const needsParens = node.arg.kind === 'binop';
      return needsParens ? `-(${argPrinted})` : `-${argPrinted}`;
    }

    case 'call': {
      const args = node.args.map(print).join(', ');
      return `${node.fn}(${args})`;
    }

    default:
      return 'unknown';
  }
}

/**
 * Split a formula "output = expr" into {lhs, rhs}.
 * @param {string} source - The formula string
 * @returns {{lhs: string, rhs: string}|{error: string, pos: number}}
 */
export function splitFormula(source) {
  const eqIndex = source.indexOf('=');
  if (eqIndex === -1) {
    return { error: "Formula must contain '='", pos: 0 };
  }

  // Check for multiple '='
  const secondEqIndex = source.indexOf('=', eqIndex + 1);
  if (secondEqIndex !== -1) {
    return { error: "Formula must contain exactly one '='", pos: secondEqIndex };
  }

  const lhs = source.substring(0, eqIndex).trim();
  const rhs = source.substring(eqIndex + 1).trim();

  if (!lhs) {
    return { error: "Left-hand side of '=' is empty", pos: 0 };
  }

  if (!rhs) {
    return { error: "Right-hand side of '=' is empty", pos: eqIndex + 1 };
  }

  return { lhs, rhs };
}
