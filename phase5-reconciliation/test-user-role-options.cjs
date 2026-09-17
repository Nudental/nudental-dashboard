const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'phase5-reconciliation/fixtures/schema-contract.sql'), 'utf8');
const supported = [...schema.match(/CREATE TYPE public\."user_role" AS ENUM \(([^;]+)\);/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const components = path.join(root, 'recovered-frontend/src/pages/users-management/components');
for (const file of ['InviteUserModal.jsx', 'EditUserModal.jsx', 'BulkActionsBar.jsx', 'UserFilters.jsx']) {
  test(`${file} exposes only roles the recovered database can persist`, () => {
    const source = fs.readFileSync(path.join(components, file), 'utf8');
    const options = vm.runInNewContext(source.match(/const (?:ROLE_OPTIONS|ROLES) = (\[[\s\S]*?\]);/)[1]);
    const values = Array.from(options, option => option.value).filter(Boolean);
    assert.equal(new Set(values).size, values.length, 'No duplicate role choices');
    assert.deepEqual(values.filter(value => !supported.includes(value)), [], 'Unsupported choices must not reach the database');
    const expected = file === 'BulkActionsBar.jsx' ? supported.filter(r => !['insurance_verifier','marketing'].includes(r)) : supported;
    assert.deepEqual([...values].sort(), [...expected].sort(), 'Retain every previously available supported role');
  });
}
