const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../recovered-frontend');
const runtime = process.env.NDASH_PARSER_ROOT || root;
const parser = require(path.join(runtime, 'node_modules/@babel/parser'));
const source = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/index.jsx'), 'utf8');
const tree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) { const found = find(value, predicate); if (found) return found; }
}
const save = find(tree, n => n.type === 'VariableDeclarator' && n.id.name === 'performAutoSave');
const restore = find(tree, n => n.type === 'CallExpression' && n.callee.name === 'useEffect' && source.slice(n.start, n.end).includes("localStorage.getItem('daily_entry_draft')"));
function runDraft(initial) {
  const storage = new Map(initial ? [['daily_entry_draft', JSON.stringify(initial)]] : []);
  const ctx = {
    form: { notes: 'QA TEMP notes', entryDate: '2026-09-15' }, attestation: { exceptions: true },
    isLocked: false, lastSavedRef: { current: null }, useCallback: fn => fn,
    setSaveStatus() {}, setTimeout: fn => fn(), getTodayStr: () => '2026-09-15',
    localStorage: { setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k) },
  };
  ctx.setForm = updater => { ctx.form = typeof updater === 'function' ? updater(ctx.form) : updater; };
  ctx.setAttestation = updater => { ctx.attestation = typeof updater === 'function' ? updater(ctx.attestation) : updater; };
  return {
    ctx, storage,
    save: () => vm.runInNewContext('(' + source.slice(save.init.start, save.init.end) + ')()', ctx),
    restore: () => vm.runInNewContext('(' + source.slice(restore.arguments[0].start, restore.arguments[0].end) + ')()', ctx),
  };
}
test('Saved EOD notes and checked attestation survive a fresh form readback', () => {
  const h = runDraft(); h.save();
  h.ctx.form = {}; h.ctx.attestation = {}; h.restore();
  assert.equal(h.ctx.form.notes, 'QA TEMP notes');
  assert.equal(h.ctx.attestation.exceptions, true);
});
test('Changing only attestation updates a previously saved draft', () => {
  const h = runDraft(); h.save(); h.ctx.lastSavedRef.current = h.storage.get('daily_entry_draft');
  h.ctx.attestation = { exceptions: false, closeout: true }; h.save();
  const saved = JSON.parse(h.storage.get('daily_entry_draft'));
  assert.equal(saved.attestation.closeout, true); assert.equal(saved.attestation.exceptions, false);
});
test('Existing notes-only drafts remain readable with no attestation checked', () => {
  const h = runDraft({ notes: 'QA TEMP legacy notes', entryDate: '2026-09-14' });
  h.ctx.attestation = {}; h.restore();
  assert.equal(h.ctx.form.notes, 'QA TEMP legacy notes');
  assert.equal(h.ctx.form.entryDate, '2026-09-14');
  assert.equal(Object.keys(h.ctx.attestation).length, 0);
});
