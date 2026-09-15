const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../recovered-frontend');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) { const match = find(value, predicate); if (match) return match; }
}
for (const name of ['UnscheduledTreatmentTab', 'TreatmentPlanCompletionTab']) {
  const source = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/components', name + '.jsx'), 'utf8');
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const component = find(tree, n => n.type === 'VariableDeclarator' && n.id.name === name).init;
  const context = find(component, n => n.type === 'VariableDeclarator' && n.init?.callee?.name === 'useOffice');
  const label = find(component, n => n.type === 'VariableDeclarator' && n.id.name === 'officeName').init;
  const picker = find(component, n => ['CallExpression','OptionalCallExpression'].includes(n.type)
    && n.callee?.property?.name === 'map' && ['OFFICE_LIST','offices'].includes(n.callee?.object?.name));
  assert.ok(context && label && picker, 'Office UI expressions must be present');
  function renderDirectory(offices, localOfficeId) {
    return vm.runInNewContext('const ' + source.slice(context.start, context.end) + '; ({name: ('
      + source.slice(label.start, label.end) + '), options: ('
      + source.slice(picker.callee.object.start, picker.callee.object.end) + ')})', {
        useOffice: () => ({ offices, canSwitchOffice: true, selectedOfficeId: localOfficeId }), localOfficeId,
        getOfficeNameById: () => 'Unknown Office',
        OFFICE_LIST: [{ id: 'legacy-office-a', name: 'Legacy A' }, { id: 'legacy-office-b', name: 'Legacy B' }],
      });
  }
  test(name + ' displays a newly configured office from the accessible directory', () => {
    assert.equal(renderDirectory([{ id: 'qa-office-c', name: 'QA / Newly configured office' }], 'qa-office-c').name, 'QA / Newly configured office');
  });
  test(name + ' displays the current office name after a directory rename', () => {
    assert.equal(renderDirectory([{ id: 'legacy-office-a', name: 'QA / Renamed office' }], 'legacy-office-a').name, 'QA / Renamed office');
  });
  for (const offices of [[], [{ id: 'qa-office-a', name: 'QA / Office A' }], [{ id: 'qa-office-a', name: 'QA / Office A' }, { id: 'qa-office-b', name: 'QA / Office B' }]]) {
    test(`${name} offers exactly the ${offices.length} accessible offices`, () => {
      assert.equal(renderDirectory(offices, offices[0]?.id).options, offices);
    });
  }
}
