const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../recovered-frontend');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    const match = find(value, predicate);
    if (match) return match;
  }
  return null;
}

function loadWindowHelper() {
  const source = fs.readFileSync(path.join(root, 'src/utils/calendarDateHelpers.js'), 'utf8');
  return vm.runInNewContext(source.replace(/^export /gm, '') + '\ngetDentrixCollectionWindow;');
}

function auditHarness(start, end) {
  const source = fs.readFileSync(path.join(root, 'src/pages/payroll-audit/index.jsx'), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const callback = find(ast, n => n.type === 'VariableDeclarator' && n.id.name === 'loadDentrixData').init.arguments[0];
  const run = { id: 'QA-PHASE5-RUN', pay_period_start: start, pay_period_end: end };
  const requests = [], rows = [];
  const load = vm.runInNewContext('(' + source.slice(callback.start, callback.end) + ')', {
    selectedRun: run, selectedOffice: 'QA-OFFICE-ONE', selectedProviderType: 'all',
    getDentrixCollectionWindow: loadWindowHelper(),
    setLoading() {}, setError() {}, setDentrixRows(value) { rows.push(value); },
    async fetchPayrollData(args) { requests.push(args); return { doctors: [], hygienists: [] }; },
  });
  return { run, requests, rows, load };
}

function customPayrollHarness(start, end) {
  const source = fs.readFileSync(path.join(root, 'src/pages/payroll/index.jsx'), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const callback = find(ast, n => n.type === 'VariableDeclarator' && n.id.name === 'loadPayroll').init.arguments[0];
  const requests = [], state = {};
  const range = { startDate: start, endDate: end };
  const env = {
    isSuperAdmin: true, useCustomRange: true, selectedRun: null,
    activeDateRange: range, payrollRequestId: { current: 0 },
    selectedOffice: 'QA-OFFICE-ONE', selectedProvider: '', selectedProviderType: 'all',
    getDentrixCollectionWindow: loadWindowHelper(), getMappingStats: async () => ({}),
    console: { warn() {} },
    async fetchPayrollData(args) { requests.push(args); return { doctors: [], hygienists: [] }; },
  };
  for (const key of ['Doctors', 'Hygienists', 'Placeholders', 'ResolvedPlaceholders', 'Summary', 'Loading', 'Error', 'DataSource', 'DataSourceWarning', 'AppliedDentrixWindow', 'MappingStats']) {
    env['set' + key] = value => { state[key] = value; };
  }
  const load = vm.runInNewContext('(' + source.slice(callback.start, callback.end) + ')', env);
  return { requests, state, range, load };
}

function queryPrelude(source, functionName, apiName) {
  const ast = parser.parse(source, { sourceType: 'module' });
  const fn = find(ast, n => n.type === 'FunctionDeclaration' && n.id.name === functionName);
  const boundary = fn.body.body.find(n => n.type === 'TryStatement');
  const call = find(boundary, n => n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property.name === 'getProductionByProvider') ||
    find(boundary, n => n.type === 'OptionalCallExpression' && n.callee.property?.name === 'getProductionByProvider');
  assert.ok(call, 'The actual service query must be present');
  // Execute only the actual date prelude and intercepted query; no service/network/storage access.
  const intercepted = { getProductionByProvider: (...args) => Array.from(args) };
  return vm.runInNewContext('(' + source.slice(fn.start, boundary.start) + 'return ' + source.slice(call.start, call.end) + ';})', { [apiName]: intercepted });
}

const sourceService = fs.readFileSync(path.join(root, 'src/services/payrollService.js'), 'utf8');
const sourceQuery = queryPrelude(sourceService, 'fetchPayrollData', 'ascendApi');
let productionQuery;
if (process.env.NDASH_PRODUCTION_ENTRY) {
  const artifact = fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY);
  assert.equal(crypto.createHash('sha256').update(artifact).digest('hex'), '0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');
  productionQuery = queryPrelude(artifact.toString('utf8'), 'Sve', 'Ue');
}

// The preserved production service subtracts one calendar day before its Ascend query.
// These assertions cover the source boundary where the recovered service expects final dates.
for (const [name, start, end, expectedStart, expectedEnd] of [
  ['August 21 payday example', '2026-08-03', '2026-08-16', '2026-08-02', '2026-08-15'],
  ['month boundary', '2026-09-01', '2026-09-14', '2026-08-31', '2026-09-13'],
  ['year boundary', '2027-01-01', '2027-01-14', '2026-12-31', '2027-01-13'],
  ['leap day', '2024-03-01', '2024-03-14', '2024-02-29', '2024-03-13'],
]) {
  test('Payroll Audit retains production Ascend window: ' + name, async () => {
    const h = auditHarness(start, end);
    await h.load();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].startDate, expectedStart);
    assert.equal(h.requests[0].endDate, expectedEnd);
    assert.equal(h.requests[0].locationId, 'QA-OFFICE-ONE');
    assert.equal(h.requests[0].payrollRun, h.run);
    assert.equal(h.run.pay_period_start, start);
    assert.equal(h.run.pay_period_end, end);
    const actualQuery = await sourceQuery(h.requests[0]);
    assert.deepEqual(Array.from(actualQuery), [expectedStart, expectedEnd, 'QA-OFFICE-ONE']);
    if (productionQuery) {
      const deployedQuery = await productionQuery({ startDate: start, endDate: end, locationId: 'QA-OFFICE-ONE' });
      assert.deepEqual(Array.from(actualQuery), Array.from(deployedQuery));
    }
  });
  test('Custom Payroll retains the current production query: ' + name, async () => {
    const h = customPayrollHarness(start, end);
    await h.load();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].startDate, expectedStart);
    assert.equal(h.requests[0].endDate, expectedEnd);
    assert.equal(h.requests[0].payrollRun, null);
    assert.equal(h.range.startDate, start);
    assert.equal(h.range.endDate, end);
    const query = await sourceQuery(h.requests[0]);
    assert.deepEqual(Array.from(query), [expectedStart, expectedEnd, 'QA-OFFICE-ONE']);
    if (productionQuery) {
      assert.deepEqual(Array.from(query), Array.from(await productionQuery({ startDate: start, endDate: end, locationId: 'QA-OFFICE-ONE' })));
    }
  });
}

test('exact deployed artifact was supplied for service parity comparison', { skip: !productionQuery && 'Set NDASH_PRODUCTION_ENTRY to the preserved production artifact' }, () => {
  assert.equal(typeof productionQuery, 'function');
});
