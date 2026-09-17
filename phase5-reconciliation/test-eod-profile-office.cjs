const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../recovered-frontend');
const runtime = process.env.NDASH_PARSER_ROOT || root;
const parser = require(path.join(runtime, 'node_modules/@babel/parser'));
const source = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/index.jsx'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/contexts/AuthContext.jsx'), 'utf8');
function find(n, predicate) {
  if (!n || typeof n !== 'object') return;
  if (predicate(n)) return n;
  for (const v of Object.values(n)) { const got = find(v, predicate); if (got) return got; }
}
const authTree = parser.parse(auth, { sourceType: 'module', plugins: ['jsx'] });
const projection = find(authTree, n => n.type === 'VariableDeclarator' && n.id.name === 'PROFILE_GATE_FIELDS').init.value.split(',').map(s => s.trim());
const pageTree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const fetchOffices = find(pageTree, n => n.type === 'VariableDeclarator' && n.id.name === 'fetchOffices').init;
for (const office of ['qa-office-a', 'qa-office-b']) test(`EOD selects the authenticated assigned office ${office} when directory has multiple offices`, async () => {
  const profile = { id: 'qa-manager', role: 'office_manager', office_id: office, status: 'Active', is_active: true, is_approved: true };
  const userProfile = Object.fromEntries(projection.map(k => [k, profile[k]]));
  let form = { officeId: '' };
  const query = { select: () => query, eq: () => query, order: async () => ({ data: [{ id: 'qa-office-a' }, { id: 'qa-office-b' }], error: null }) };
  const context = { userProfile, supabase: { from: () => query }, setLoadingOffices() {}, setForm: fn => { form = fn(form); }, console };
  await vm.runInNewContext('(' + source.slice(fetchOffices.start, fetchOffices.end) + ')()', context);
  assert.equal(form.officeId, office);
});
test('Profile projection retains all account access gate fields', () => {
  for (const field of ['id', 'role', 'status', 'is_active', 'is_approved', 'must_change_password']) assert.ok(projection.includes(field));
});
