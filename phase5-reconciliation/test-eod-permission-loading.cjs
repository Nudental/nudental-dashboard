const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../recovered-frontend');
const runtime = process.env.NDASH_PARSER_ROOT || root;
const esbuild = require(path.join(runtime, 'node_modules/esbuild'));
const source = fs.readFileSync(path.join(root, 'src/pages/daily-entry-form/index.jsx'), 'utf8');

function harness() {
  let loading = true, allowed = false, calls = [], effects = [];
  const hook = (name, value) => { calls.push(name); return value; };
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: value => hook('state', [typeof value === 'function' ? value() : value, () => {}]),
    useRef: value => hook('ref', { current: value }),
    useEffect: fn => { hook('effect'); effects.push(fn); },
    useCallback: fn => hook('callback', fn),
  };
  const imports = {
    react: { ...React, default: React },
    'react-router-dom': { useNavigate: () => hook('navigate', () => {}) },
    '../../hooks/useHomeNavigation': { default: () => hook('home', () => {}) },
    '../../contexts/AuthContext': { useAuth: () => hook('auth', { userProfile: { role: 'office_manager', office_id: 'qa-a' }, user: { id: 'qa-user' } }) },
    '../../contexts/OfficeContext': { useOffice: () => hook('office', { selectedOfficeId: 'qa-a', offices: [], canSwitchOffice: false }) },
    '../../hooks/useRbacGuard': { useRbacGuard: () => hook('rbac', { loading, canAccess: () => allowed }), AccessDenied: 'qa-denied' },
    '../../lib/supabase': { supabase: {} },
  };
  const context = { module: { exports: {} }, require: id => ({ __esModule: true, ...(imports[id] || { default: id }) }), console, setTimeout, clearTimeout, setInterval, clearInterval, window: { innerWidth: 1280 } };
  vm.runInNewContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs', target: 'es2020' }).code, context);
  return {
    render(nextLoading, nextAllowed) {
      loading = nextLoading; allowed = nextAllowed; calls = []; effects = [];
      const result = context.module.exports.default();
      return { result, calls: [...calls], effects: [...effects] };
    },
  };
}

test('Permission loading, denial and allowance keep the page hook sequence stable', () => {
  const h = harness(), loading = h.render(true, false), denied = h.render(false, false), allowed = h.render(false, true);
  assert.equal(loading.result, null);
  assert.equal(denied.result.type, 'qa-denied');
  assert.deepEqual(allowed.calls, loading.calls);
  assert.deepEqual(denied.calls, loading.calls);
  assert.equal(typeof allowed.result.type, 'function', 'Only an allowed user mounts the form');
});

test('Loading and denied renders cannot start form draft or office effects', () => {
  const h = harness();
  assert.equal(h.render(true, false).effects.length, 0);
  assert.equal(h.render(false, false).effects.length, 0);
});
