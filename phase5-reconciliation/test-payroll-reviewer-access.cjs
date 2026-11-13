const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const frontend = path.join(__dirname, '../recovered-frontend');
const dependency = name => require(path.join(frontend, 'node_modules', name));
const React = dependency('react');
const { renderToStaticMarkup } = dependency('react-dom/server');
const { transformSync } = dependency('esbuild');
const payroll = path.join(frontend, 'src/pages/payroll');
const stub = () => null;

function component(file, imports) {
  const source = fs.readFileSync(path.join(payroll, file), 'utf8');
  const compiled = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports,
    require: key => key === 'react' ? React : (imports[key] ?? stub),
  });
  return mod.exports.default;
}

function render(role, grants) {
  const page = component('index.jsx', {
    '../../services/payrollService': { getScheduleYears: () => [2026], PAYROLL_TYPE_LABELS: {}, PAYROLL_TYPE_COLORS: {} },
    '../../hooks/useRealtimeSubscription': { useRealtimeSubscription: stub },
    '../../services/providerMappingService': { FAILURE_REASON_LABELS: {} },
  });
  const root = component('PayrollRoot.jsx', {
    './index': page,
    '../../contexts/AuthContext': { useAuth: () => ({ userProfile: { role } }) },
    '../../hooks/useRolePermissions': () => ({ hasPermission: key => grants.includes(key), loading: false }),
    './components/ProviderCompensationNew': () => React.createElement('div', null, 'Provider compensation report'),
  });
  return renderToStaticMarkup(React.createElement(root));
}

for (const role of ['regional_manager', 'staff']) {
  test(role + ' with the Dentrix review grant can open the payroll landing tab', () => {
    const html = render(role, ['finance.payroll.dentrix_ascend.view', 'finance.payroll.provider_compensation.view']);
    assert.match(html, /Doctor Payroll/);
    assert.match(html, /Hygienist Payroll/);
    assert.match(html, /Payroll review/);
    assert.doesNotMatch(html, /Access Restricted|Access Denied|>Provider Mapping</);
  });
}
test('an account without payroll access cannot render either payroll table', () => {
  const html = render('regional_manager', []);
  assert.match(html, /Access Denied/);
  assert.doesNotMatch(html, /Doctor Payroll|Hygienist Payroll/);
});
test('a compensation-only grant does not open Dentrix payroll', () => {
  const html = render('staff', ['finance.payroll.provider_compensation.view']);
  assert.match(html, /Provider compensation report/);
  assert.doesNotMatch(html, /Doctor Payroll/);
});
test('the super administrator retains provider mapping', () => {
  assert.match(render('super_admin', []), />Provider Mapping</);
});
