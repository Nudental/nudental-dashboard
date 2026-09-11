const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = process.env.NDASH_SOURCE_ROOT || path.join(__dirname, '..', 'recovered-frontend');
const parserRoot = process.env.NDASH_PARSER_ROOT || root;
const parser = require(path.join(parserRoot, 'node_modules/@babel/parser'));
const sourcePath = path.join(root, 'src/pages/executive-overview/index.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const matches = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.name === 'yoyLabel') matches.push(node.init);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.equal(matches.length, 1, 'Exactly one production comparison formatter must be tested');
const fn = matches[0];
const format = vm.runInNewContext('(' + source.slice(fn.start, fn.end) + ')', {});

test('increase from negative prior period displays positive trend', () => {
  assert.equal(format(280649.43, -222364.52), '+226.2% vs prior year');
});
test('positive prior increase retains its direction', () => {
  assert.equal(format(125, 100), '+25.0% vs prior year');
});
test('positive prior decrease retains its direction', () => {
  assert.equal(format(75, 100), '-25.0% vs prior year');
});
test('zero or unavailable prior value has no percentage comparison', () => {
  assert.equal(format(100, 0), null);
  assert.equal(format(100, null), null);
});
test('unchanged value displays zero percent', () => {
  assert.equal(format(100, 100), '+0.0% vs prior year');
});
