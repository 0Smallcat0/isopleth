import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, evaluate, print, splitFormula } from '../src/core/expr.js';

// T5: Unit tests for expr.js
// Requirements: R1.1–R1.7

// Test tokenize
test('tokenize - basic operators', () => {
  const tokens = tokenize('a + b');
  assert.strictEqual(tokens.length, 4); // a, +, b, EOF
  assert.strictEqual(tokens[0].type, 'IDENTIFIER');
  assert.strictEqual(tokens[0].value, 'a');
  assert.strictEqual(tokens[1].type, 'OPERATOR');
  assert.strictEqual(tokens[1].value, '+');
  assert.strictEqual(tokens[2].type, 'IDENTIFIER');
  assert.strictEqual(tokens[2].value, 'b');
  assert.strictEqual(tokens[3].type, 'EOF');
});

test('tokenize - numbers and scientific notation', () => {
  const tokens = tokenize('1.5e-3 + 2.5e10');
  assert.strictEqual(tokens.length, 4); // 1.5e-3, +, 2.5e10, EOF
  assert.strictEqual(tokens[0].type, 'NUMBER');
  assert.strictEqual(tokens[0].value, 1.5e-3);
  assert.strictEqual(tokens[2].type, 'NUMBER');
  assert.strictEqual(tokens[2].value, 2.5e10);
});

test('tokenize - identifiers', () => {
  const tokens = tokenize('alpha beta1 gamma_max');
  assert.strictEqual(tokens[0].value, 'alpha');
  assert.strictEqual(tokens[1].value, 'beta1');
  assert.strictEqual(tokens[2].value, 'gamma_max');
});

test('tokenize - parentheses and comma', () => {
  const tokens = tokenize('fn(a, b)');
  assert.strictEqual(tokens[0].type, 'IDENTIFIER');
  assert.strictEqual(tokens[1].type, 'LPAREN');
  assert.strictEqual(tokens[2].type, 'IDENTIFIER');
  assert.strictEqual(tokens[3].type, 'COMMA');
  assert.strictEqual(tokens[4].type, 'IDENTIFIER');
  assert.strictEqual(tokens[5].type, 'RPAREN');
});

test('tokenize - Greek letters', () => {
  const tokens = tokenize('α + β');
  assert.strictEqual(tokens[0].value, 'α');
  assert.strictEqual(tokens[2].value, 'β');
});

// Test parse
test('parse - simple identifier', () => {
  const tokens = tokenize('x');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'identifier');
  assert.strictEqual(ast.name, 'x');
});

test('parse - simple number', () => {
  const tokens = tokenize('3.14');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'number');
  assert.strictEqual(ast.value, 3.14);
});

test('parse - binary operation', () => {
  const tokens = tokenize('a + b * c');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'binop');
  assert.strictEqual(ast.op, '+');
  assert.strictEqual(ast.left.kind, 'identifier');
  assert.strictEqual(ast.left.name, 'a');
  assert.strictEqual(ast.right.kind, 'binop');
  assert.strictEqual(ast.right.op, '*');
});

test('parse - unary minus', () => {
  const tokens = tokenize('-x');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'unary');
  assert.strictEqual(ast.op, '-');
  assert.strictEqual(ast.arg.kind, 'identifier');
});

test('parse - function call', () => {
  const tokens = tokenize('sqrt(a)');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'call');
  assert.strictEqual(ast.fn, 'sqrt');
  assert.strictEqual(ast.args.length, 1);
});

test('parse - nested function call', () => {
  const tokens = tokenize('sqrt(a + b)');
  const ast = parse(tokens);
  assert.strictEqual(ast.kind, 'call');
  assert.strictEqual(ast.fn, 'sqrt');
  assert.strictEqual(ast.args[0].kind, 'binop');
});

test('parse - power operator (right-associative)', () => {
  const tokens = tokenize('a ^ b ^ c');
  const ast = parse(tokens);
  // Should be a ^ (b ^ c)
  assert.strictEqual(ast.op, '^');
  assert.strictEqual(ast.right.kind, 'binop');
  assert.strictEqual(ast.right.op, '^');
});

test('parse - parentheses grouping', () => {
  const tokens = tokenize('(a + b) * c');
  const ast = parse(tokens);
  assert.strictEqual(ast.op, '*');
  assert.strictEqual(ast.left.kind, 'binop');
  assert.strictEqual(ast.left.op, '+');
});

test('parse - error on mismatched parens', () => {
  const tokens = tokenize('(a + b');
  const ast = parse(tokens);
  assert(ast.error);
});

test('tokenize - error on unknown token', () => {
  const fn = () => tokenize('a @ b');
  assert.throws(fn, /Unexpected character '@'/);
});

// Test splitFormula
test('splitFormula - valid formula', () => {
  const result = splitFormula('V = I * R');
  assert.strictEqual(result.lhs, 'V');
  assert.strictEqual(result.rhs, 'I * R');
});

test('splitFormula - error on no equals', () => {
  const result = splitFormula('a + b');
  assert(result.error);
});

test('splitFormula - error on multiple equals', () => {
  const result = splitFormula('a = b = c');
  assert(result.error);
  assert.strictEqual(result.pos, 6); // Position of second '='
});

// Test evaluate
test('evaluate - arithmetic', () => {
  const ast = parse(tokenize('2 + 3 * 4'));
  const result = evaluate(ast, {});
  assert.strictEqual(result, 14);
});

test('evaluate - exponentiation', () => {
  const ast = parse(tokenize('2 ^ 3'));
  const result = evaluate(ast, {});
  assert.strictEqual(result, 8);
});

test('evaluate - unary minus', () => {
  const ast = parse(tokenize('-(2 + 3)'));
  const result = evaluate(ast, {});
  assert.strictEqual(result, -5);
});

test('evaluate - pi and e constants', () => {
  const ast = parse(tokenize('pi + e'));
  const result = evaluate(ast, {});
  assert.ok(Math.abs(result - (Math.PI + Math.E)) < 1e-10);
});

test('evaluate - function sqrt', () => {
  const ast = parse(tokenize('sqrt(4)'));
  const result = evaluate(ast, {});
  assert.strictEqual(result, 2);
});

test('evaluate - domain error sqrt negative', () => {
  const ast = parse(tokenize('sqrt(-1)'));
  const result = evaluate(ast, {});
  assert(result.error);
});

test('evaluate - division by zero', () => {
  const ast = parse(tokenize('1 / 0'));
  const result = evaluate(ast, {});
  assert(result.error);
});

test('evaluate - unknown variable', () => {
  const ast = parse(tokenize('x'));
  const result = evaluate(ast, {});
  assert(result.error);
});

// Test print
test('print - simple expression', () => {
  const ast = parse(tokenize('a + b * c'));
  const result = print(ast);
  assert.strictEqual(result, 'a + b * c');
});

test('print - with parentheses', () => {
  const ast = parse(tokenize('(a + b) * c'));
  const result = print(ast);
  assert.strictEqual(result, '(a + b) * c');
});

test('print - function call', () => {
  const ast = parse(tokenize('sqrt(a + b)'));
  const result = print(ast);
  assert.strictEqual(result, 'sqrt(a + b)');
});

test('print - power operator', () => {
  const ast = parse(tokenize('a ^ b ^ c'));
  const result = print(ast);
  assert.strictEqual(result, 'a ^ b ^ c');
});
