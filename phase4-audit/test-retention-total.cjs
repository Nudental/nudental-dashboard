const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../recovered-frontend');
const source = fs.readFileSync(path.join(root, 'src/pages/compliance-retention/index.jsx'), 'utf8');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));
const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
let callback, card;
function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'VariableDeclarator' && n.id?.name === 'fetchTotalCount') callback = n.init;
  if (n.type === 'ObjectExpression' && n.properties.some(p => p.key?.name === 'label' && p.value?.value === 'Total Audit Records')) card = n;
  for (const v of Object.values(n)) if (v && typeof v === 'object') Array.isArray(v) ? v.forEach(walk) : walk(v);
}
walk(ast);
function harness() {
  let resolve, reject;
  const pending = new Promise((a, b) => { resolve = a; reject = b; });
  const calls = [], updates = [], ctx = {
    cancelled: false,
    totalRecords: 99,
    loadingTotal: false,
    setLoadingTotal(v) { ctx.loadingTotal = v; updates.push(['loading', v]); },
    setTotalRecords(v) { ctx.totalRecords = v; updates.push(['count', v]); },
    supabase: { from(table) { calls.push(['from', table]); return { select(fields, options) { calls.push(['select', fields, options]); return pending; } }; } },
  };
  vm.createContext(ctx);
  const run = vm.runInContext('(' + source.slice(callback.start, callback.end) + ')', ctx);
  const display = () => vm.runInContext('(' + source.slice(card.start, card.end) + ')', ctx);
  return { ctx, calls, updates, run, display, resolve, reject };
}
test('all-resource exact HEAD count includes resources absent from cards', async () => {
  const h = harness(), p = h.run();
  h.resolve({ count: 2261, error: null }); await p;
  assert.equal(h.ctx.totalRecords, 2261);
  assert.equal(JSON.stringify(h.calls), JSON.stringify([['from', 'audit_logs'], ['select', 'id', { count: 'exact', head: true }]]));
  assert.equal(h.display().value, '2,261');
});
test('valid zero count is displayed as zero', async () => {
  const h = harness(), p = h.run(); h.resolve({ count: 0 }); await p;
  assert.equal(h.display().value, '0');
});
test('request clears stale count and shows loading', async () => {
  const h = harness(), p = h.run();
  assert.equal(h.ctx.totalRecords, null); assert.equal(h.display().value, '…');
  h.resolve({ count: 1 }); await p;
});
test('query failure shows unavailable instead of zero or stale total', async () => {
  const h = harness(), p = h.run(); h.resolve({ count: 99, error: { message: 'synthetic denied query' } }); await p;
  assert.equal(h.display().value, '—'); assert.equal(h.display().helper, 'Audit record count unavailable');
});
test('missing or malformed counts are unavailable', async () => {
  for (const count of [null, undefined, -1, 2.5, '2261', NaN, Infinity]) {
    const h = harness(), p = h.run(); h.resolve({ count }); await p;
    assert.equal(h.ctx.totalRecords, null); assert.equal(h.ctx.loadingTotal, false);
  }
});
test('transport failure ends loading with an unavailable total', async () => {
  const h = harness(), p = h.run(); h.reject(new Error('synthetic network failure')); await p;
  assert.equal(h.display().value, '—'); assert.equal(h.ctx.loadingTotal, false);
});
test('unmounted request does not update state', async () => {
  const h = harness(), p = h.run(), before = h.updates.length;
  h.ctx.cancelled = true; h.resolve({ count: 2261 }); await p;
  assert.equal(h.updates.length, before);
});
