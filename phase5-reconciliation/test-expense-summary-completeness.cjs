const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../recovered-frontend');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));
const source = fs.readFileSync(path.join(root, 'src/services/expenseReportService.js'), 'utf8');
const tree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const artifactFile = process.env.NDASH_EXPENSE_SUMMARY_ARTIFACT;
const artifact = artifactFile && fs.readFileSync(artifactFile, 'utf8');
const artifactMeta = artifactFile && JSON.parse(fs.readFileSync(path.join(path.dirname(artifactFile), 'candidate.private.json'), 'utf8'));
const artifactTree = artifact && parser.parse(artifact, { sourceType: 'module' });
if (artifact) assert.equal(require('node:crypto').createHash('sha256').update(artifact).digest('hex'), artifactMeta.candidateSha256);
function getFunction(name) {
  if (artifact && name === 'fetchExpenseSummary') {
    const node = artifactTree.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === artifactMeta.bindings.summary);
    assert.ok(node); return '(' + artifact.slice(node.start, node.end) + ')';
  }
  const item = tree.program.body.map(n => n.declaration || n).find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert.ok(item, name);
  return '(' + source.slice(item.start, item.end) + ')';
}
function harness(rows, { api = true, apiTotal = rows.reduce((s, r) => s + Number(r.amount), 0), cap = 1000, failFrom = Infinity } = {}) {
  const calls = [];
  let counted = false;
  const query = {
    select(fields, options) { calls.push(['select', fields, options]); counted = options?.count === 'exact'; return this; },
    async range(from, to) {
      calls.push(['range', from, to]);
      if (from >= failFrom) return { error: { message: 'synthetic denied page' } };
      return { data: rows.slice(from, Math.min(to + 1, from + cap)), count: counted ? rows.length : null };
    }
  };
  for (const method of ['in', 'eq', 'neq', 'gte', 'lte', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  const context = vm.createContext({
    URLSearchParams, console: { log() {}, warn() {} }, window: {}, _lastSummaryExtras: null,
    MIDDLEWARE_API_BASE: 'https://qa.invalid/v2', _middlewareHeaders: () => ({}),
    fetch: async () => ({ ok: api, status: api ? 200 : 503, json: async () => ({ totals: { amex: apiTotal } }) }),
    supabase: { from: table => { assert.equal(table, 'expenses'); return query; } }
  });
  if (artifact) Object.assign(context, {
    [artifactMeta.bindings.supabase]: context.supabase,
    [artifactMeta.bindings.api]: context.MIDDLEWARE_API_BASE,
    [artifactMeta.bindings.headers]: context._middlewareHeaders,
    [artifactMeta.bindings.extras]: null,
  });
  context.readCompleteExpenseQuery = vm.runInContext(getFunction('readCompleteExpenseQuery'), context);
  const summary = vm.runInContext(getFunction('fetchExpenseSummary'), context);
  return { calls, run: options => summary({ startDate: '2026-01-01', endDate: '2026-09-14', ...options }) };
}
const many = () => Array.from({ length: 1203 }, (_, i) => ({ id: 'QA-' + i, amount: i < 1200 ? 10 : -50 }));
test('AmEx reconciliation compares the complete net amount beyond the server row cap', async () => {
  const h = harness(many()); const result = await h.run();
  assert.equal(result.amex, 11850); assert.equal(result._source, 'api');
  assert.equal(h.calls.filter(c => c[0] === 'range').length, 3);
});
test('API-unavailable fallback includes all rows and refunds instead of first-page gross spend', async () => {
  assert.equal((await harness(many(), { api: false }).run()).amex, 11850);
});
test('partial later-page failure cannot override a successful API total', async () => {
  const result = await harness(many(), { failFrom: 500 }).run();
  assert.equal(result.amex, 11850); assert.equal(result._source, 'api_only');
});
test('both unavailable sources report unavailable instead of a successful partial total', async () => {
  const result = await harness(many(), { api: false, failFrom: 500 }).run();
  assert.equal(result.amex, null); assert.equal(result.error, 'both_sources_failed');
});
test('a period consisting only of credits retains its negative net', async () => {
  assert.equal((await harness([{ id: 'QA-credit', amount: -24 }], { api: false }).run()).amex, -24);
});
test('valid empty periods remain zero', async () => {
  assert.equal((await harness([], { api: false }).run()).amex, 0);
});
test('the complete fallback preserves exact period, posted-only, source and office filters', async () => {
  const h = harness([{ id: 'QA-one', amount: 2 }]); await h.run({ officeIds: ['QA-office-A', 'QA-office-B'] });
  const calls = JSON.parse(JSON.stringify(h.calls));
  for (const expected of [['eq', 'expense_status', 'posted'], ['neq', 'source_tab', 'Banking'], ['gte', 'expense_date', '2026-01-01'], ['lte', 'expense_date', '2026-09-14'], ['in', 'office_id', ['QA-office-A', 'QA-office-B']]]) assert.ok(calls.some(c => JSON.stringify(c) === JSON.stringify(expected)));
});
