const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = path.resolve(__dirname, '../recovered-frontend');
const parserRoot = process.env.NDASH_PARSER_ROOT || sourceRoot;
const parser = require(path.join(parserRoot, 'node_modules/@babel/parser'));
const parse = text => parser.parse(text, { sourceType: 'module', plugins: ['jsx'] });
const source = fs.readFileSync(path.join(sourceRoot, 'src/pages/executive-overview/index.jsx'), 'utf8');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function callProps(component, context) {
  const results = [];
  walk(parse(source), node => {
    if (node.type !== 'JSXOpeningElement' || node.name.name !== component) return;
    const result = {};
    for (const attr of node.attributes) {
      if (attr.type !== 'JSXAttribute' || attr.value?.type !== 'JSXExpressionContainer') continue;
      // Evaluate only relevant actual date/location call-site expressions.
      if (!/^(propOfficeIds|propMonth|propYear|selectedOfficeIds|selectedMonth|selectedYear|monthYearProp|monthYear)$/.test(attr.name.name)) continue;
      result[attr.name.name] = vm.runInNewContext(source.slice(attr.value.expression.start, attr.value.expression.end), context);
    }
    results.push(result);
  });
  return results;
}
function receive(component, props) {
  const text = fs.readFileSync(path.join(sourceRoot, `src/pages/executive-overview/components/${component}.jsx`), 'utf8');
  let parameter;
  walk(parse(text), node => {
    if (node.type === 'VariableDeclarator' && node.id.name === component) parameter = node.init.params[0];
  });
  assert.ok(parameter, `${component} signature present`);
  const values = component === 'MonthlyGrowthTab' ? '[propOfficeIds,propMonth,propYear]' : 'monthYearProp';
  return vm.runInNewContext(`(${text.slice(parameter.start, parameter.end)}) => ${values}`)(props);
}
test('August and one location reach Monthly Growth together', () => {
  const props = callProps('MonthlyGrowthTab', {effectiveOfficeIds:['qa-barnegat'], startObj:new Date(2026,7,1)})[0];
  assert.equal(JSON.stringify(receive('MonthlyGrowthTab',props)), JSON.stringify([['qa-barnegat'],8,2026]));
});
test('all selected offices and a prior year survive the tab boundary', () => {
  const props = callProps('MonthlyGrowthTab', {effectiveOfficeIds:['qa-one','qa-two'], startObj:new Date(2025,11,1)})[0];
  assert.equal(JSON.stringify(receive('MonthlyGrowthTab',props)), JSON.stringify([['qa-one','qa-two'],12,2025]));
});
test('both single-office and all-office forecast paths receive the completed month', () => {
  const calls = callProps('MonthEndForecastWidget',{goalMonthYear:'2026-08'});
  assert.equal(calls.length,2);
  for (const props of calls) assert.equal(receive('MonthEndForecastWidget',props),'2026-08');
});
test('forecast paths preserve a selected prior year instead of defaulting to today', () => {
  for (const props of callProps('MonthEndForecastWidget',{goalMonthYear:'2025-12'})) assert.equal(receive('MonthEndForecastWidget',props),'2025-12');
});
