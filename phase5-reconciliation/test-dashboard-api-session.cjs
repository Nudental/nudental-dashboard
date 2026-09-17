const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const origin = 'https://nudashboard-qa-api.nuholdingllc.com';
const source = fs.readFileSync(path.join(__dirname, '../recovered-frontend/src/lib/dashboardFetch.js'), 'utf8');
function setup() {
  const state = { token: 'synthetic-session-a', calls: [], sessionReads: 0 };
  const context = {
    Request, Headers, URL, DASHBOARD_API_ORIGIN: origin,
    supabase: { auth: { getSession: async () => {
      state.sessionReads++;
      return { data: { session: state.token ? { access_token: state.token } : null }, error: state.error };
    }}},
    fetch: async (...args) => { state.calls.push(args); return { status: 200 }; },
  };
  state.request = vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async', 'async') + '\ndashboardFetch;', context);
  return state;
}
test('API calls include current user identity and preserve method/body/application key', async () => {
  const s = setup(), body = JSON.stringify({ label: 'QA / Draft' });
  await s.request(origin + '/v2/goals', { method: 'POST', body, headers: { 'X-API-Key': 'synthetic-key' } });
  const options = s.calls[0][1];
  assert.equal(options.headers.get('Authorization'), 'Bearer synthetic-session-a');
  assert.equal(options.headers.get('X-API-Key'), 'synthetic-key');
  assert.equal(options.method, 'POST'); assert.equal(options.body, body);
  assert.equal(options.redirect, 'error');
});
test('Sign-out and session changes cannot reuse a cached user token', async () => {
  const s = setup();
  await s.request(origin + '/v2/offices');
  s.token = 'synthetic-session-b';
  await s.request(origin + '/v2/offices');
  assert.equal(s.calls[1][1].headers.get('Authorization'), 'Bearer synthetic-session-b');
  s.token = null;
  await assert.rejects(s.request(origin + '/v2/goals', { method: 'POST' }), /Sign in/);
  assert.equal(s.calls.length, 2);
});
test('A failed session lookup cannot send a business request', async () => {
  const s = setup(); s.error = new Error('Synthetic session failure');
  await assert.rejects(s.request(origin + '/v2/offices'), /Sign in/);
  assert.equal(s.calls.length, 0);
});
test('Non-API requests never receive the user token', async () => {
  const s = setup(), options = { method: 'POST', body: 'synthetic' };
  await s.request('https://example.test/fixture', options);
  assert.equal(s.calls[0][1], options);
  assert.equal(s.sessionReads, 0);
});
test('Read-only health remains available without a user session', async () => {
  const s = setup(); s.token = null;
  await s.request(origin + '/health');
  assert.equal(s.sessionReads, 0);
  await assert.rejects(s.request(origin + '/health', { method: 'POST' }), /Sign in/);
});
test('Request input keeps its headers and caller token is replaced by current session', async () => {
  const s = setup(), request = new Request(origin + '/v2/offices', {
    headers: { Authorization: 'Bearer stale', 'X-API-Key': 'synthetic-key' }
  });
  await s.request(request);
  assert.equal(s.calls[0][1].headers.get('Authorization'), 'Bearer synthetic-session-a');
  assert.equal(s.calls[0][1].headers.get('X-API-Key'), 'synthetic-key');
});
