const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '../recovered-frontend');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));
const filtersSource = fs.readFileSync(path.join(root, 'src/pages/financial-analytics/components/expense-report/ExpenseReportFilters.jsx'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'src/pages/financial-analytics/ExpenseReport.jsx'), 'utf8');
function find(source, predicate) {
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] }); let result;
  function walk(n) { if (!n || typeof n !== 'object') return; if (predicate(n)) result = n; for (const v of Object.values(n)) if (v && typeof v === 'object') Array.isArray(v) ? v.forEach(walk) : walk(v); }
  walk(ast); return result;
}
const validatorNode = find(filtersSource, n => n.type === 'FunctionDeclaration' && n.id?.name === 'getExpenseDateError');
const validate = vm.runInNewContext('(' + filtersSource.slice(validatorNode.start, validatorNode.end) + ')');
const callbackNode = find(pageSource, n => n.type === 'VariableDeclarator' && n.id?.name === 'handleApplyFilters').init.arguments[0];
const custom = (customStart, customEnd) => ({ datePreset: 'custom', customStart, customEnd });
test('presets do not depend on unused custom fields', () => { assert.equal(validate({datePreset:'this_year',customStart:'bad'}), ''); });
test('both custom dates are required', () => { for (const f of [custom('',''),custom('2026-08-01',''),custom('','2026-08-31')]) assert.match(validate(f), /both/); });
test('reversed dates are rejected', () => { assert.match(validate(custom('2026-08-31','2026-08-01')), /on or after/); });
test('same-day and ordered date ranges are accepted', () => { assert.equal(validate(custom('2026-08-01','2026-08-01')), ''); assert.equal(validate(custom('2025-12-31','2026-01-01')), ''); });
test('calendar dates are validated without rolling impossible dates forward', () => { assert.match(validate(custom('2026-02-29','2026-03-01')), /valid/); assert.equal(validate(custom('2024-02-29','2024-03-01')), ''); for(const value of ['2026-02-30','2026-13-01','8/1/2026','bad',5]) assert.match(validate(custom(value,'2026-12-31')), /valid/); });
test('invalid application retains previous applied filters and refresh counter', () => {
  for(const f of [custom('',''),custom('2026-08-31','2026-08-01')]) {
    const calls = [], ctx = { filters:f,getExpenseDateError:validate,setAppliedFilters:v=>calls.push(v),setRefreshKey:v=>calls.push(v) };
    vm.runInNewContext('(' + pageSource.slice(callbackNode.start, callbackNode.end) + ')',ctx)(); assert.equal(calls.length,0);
  }
});
test('valid application commits a copy and requests refresh', () => {
  const f=custom('2026-08-01','2026-08-31'),calls=[],ctx={filters:f,getExpenseDateError:validate,setAppliedFilters:v=>calls.push(v),setRefreshKey:v=>calls.push(v(4))};
  vm.runInNewContext('(' + pageSource.slice(callbackNode.start, callbackNode.end) + ')',ctx)();
  assert.equal(JSON.stringify(calls[0]),JSON.stringify(f)); assert.notEqual(calls[0],f); assert.equal(calls[1],5);
});
test('Apply is disabled when the visible validation message exists', () => {
  const button=find(filtersSource,n=>n.type==='JSXOpeningElement'&&n.name?.name==='button'&&n.attributes.some(a=>a.name?.name==='onClick'&&a.value?.expression?.name==='onApply'));
  const expression=button.attributes.find(a=>a.name?.name==='disabled').value.expression;
  assert.equal(vm.runInNewContext(filtersSource.slice(expression.start,expression.end),{dateError:'Choose both dates'}),true);
  assert.equal(vm.runInNewContext(filtersSource.slice(expression.start,expression.end),{dateError:''}),false);
  assert.match(filtersSource, /dateError && <p role="alert"/);
});
