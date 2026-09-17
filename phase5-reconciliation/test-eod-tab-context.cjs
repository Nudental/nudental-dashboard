const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../recovered-frontend');
const parser = require(path.join(process.env.NDASH_PARSER_ROOT || root, 'node_modules/@babel/parser'));
const parent = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/index.jsx'), 'utf8');
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    const match = find(value, predicate);
    if (match) return match;
  }
}
const tree = parse(parent);
const components = ['DentrixDailyCloseoutTab', 'UnscheduledTreatmentTab', 'TreatmentPlanCompletionTab', 'DailyBulkImportTab'];
function receive(name, context) {
  const element = find(tree, n => n.type === 'JSXOpeningElement' && n.name.name === name);
  assert.ok(element);
  const props = Object.fromEntries(element.attributes.map(attr => [attr.name.name,
    vm.runInNewContext(parent.slice(attr.value.expression.start, attr.value.expression.end), context)]));
  const source = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/components', name + '.jsx'), 'utf8');
  const component = find(parse(source), n => n.type === 'VariableDeclarator' && n.id.name === name).init;
  const parameter = source.slice(component.params[0].start, component.params[0].end);
  const office = name === 'DailyBulkImportTab' ? 'selectedOfficeId' : 'propOfficeId';
  const date = name === 'DailyBulkImportTab' ? 'selectedDate' : 'propDate';
  return vm.runInNewContext(`((${parameter}) => ({ office: ${office}, date: ${date}${name === 'DailyBulkImportTab' ? ', offices: propOffices' : ''} }))(props)`, { props });
}
for (const name of components) {
  for (const officeId of ['qa-office-a', 'qa-office-b']) {
    test(`${name} receives the form office/date through its actual prop contract: ${officeId}`, () => {
      const actual = receive(name, { form: { officeId, entryDate: '2026-08-15' }, selectedOfficeId: 'stale-context-office', offices: [], getTodayStr: () => '2026-09-15' });
      assert.equal(actual.office, officeId);
      assert.equal(actual.date, '2026-08-15');
    });
  }
  test(`${name} receives the assigned office while the form office is initializing`, () => {
    const actual = receive(name, { form: { officeId: '', entryDate: '2026-09-15' }, selectedOfficeId: 'qa-assigned-office', offices: [], getTodayStr: () => '2026-09-15' });
    assert.equal(actual.office, 'qa-assigned-office');
    assert.equal(actual.date, '2026-09-15');
  });
}
test('Legacy Import receives the directory for inherited office-name lookup', () => {
  const offices = [{ id: 'qa-office-a', name: 'QA / Office A' }];
  const actual = receive('DailyBulkImportTab', { form: { officeId: 'qa-office-a', entryDate: '' }, selectedOfficeId: '', offices, getTodayStr: () => '2026-09-15' });
  assert.equal(actual.offices, offices);
  assert.equal(actual.date, '2026-09-15');
});
