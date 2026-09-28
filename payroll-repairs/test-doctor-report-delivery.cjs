const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '../recovered-frontend');
const code = fs.readFileSync(path.join(root, 'src/services/doctorReportDelivery.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const { sendDoctorReport } = vm.runInNewContext(code + ';({sendDoctorReport})', { Uint8Array, Date });
function fixture(extra = {}) {
  const calls = [], logs = [];
  const args = { options: { providerId: 'qa-doctor', snapshot: 'qa-saved', overrides: { 'qa-doctor': 35 } }, doctor: { provider_id: 'qa-doctor', provider_name: 'QA <Doctor>', months: [{ month: '2026-09', applied_percent: 35, estimate_cents: 3500 }], eligible_period_cents: 10000, estimate_cents: 3500, calculation_id: 'qa-calc' }, recipient: 'qa@example.invalid', period: { payday: '2026-10-02', pay_period_start: '2026-09-14', pay_period_end: '2026-09-27' }, confirmed: true };
  const contact = { found: true, email: args.recipient, provider_id: 'qa-doctor', snapshot_id: 'qa-saved', ...extra.contact };
  const deps = { read: async opts => {
    calls.push(opts);
    return opts.format === 'ledger-recipient' ? { status: 200, json: async () => contact } : { status: extra.pdfStatus || 200, headers: { get: () => extra.type || 'application/pdf' }, arrayBuffer: async () => Uint8Array.from(Buffer.from(extra.pdf || '%PDF-synthetic-office-report')).buffer };
  }, encode: s => Buffer.from(s, 'binary').toString('base64'), client: {
    functions: { invoke: async (name, payload) => { calls.push({ name, payload }); return extra.delivery || { data: { success: true, message_id: 'qa-receipt' } }; } },
    auth: { getUser: async () => ({ data: { user: { id: 'qa-human' } } }) },
    from: () => ({ insert: async record => { logs.push(record); return { error: extra.logError }; } }),
  } };
  return { args, deps, calls, logs };
}
test('confirmed send uses only provider-scoped saved PDF with exact overrides and dates', async () => {
  const f = fixture(); const r = await sendDoctorReport(f.args, f.deps);
  assert.equal(r.messageId, 'qa-receipt'); assert.equal(r.historySaved, true);
  assert.equal(f.calls[1].snapshot, 'qa-saved'); assert.equal(f.calls[1].providerId, 'qa-doctor'); assert.equal(f.calls[1].overrides['qa-doctor'], 35);
  const payload = f.calls[2]; assert.equal(payload.name, 'send-payroll-report');
  assert.equal(Buffer.from(payload.payload.body.pdf_base64, 'base64').toString(), '%PDF-synthetic-office-report');
  assert.equal(payload.payload.body.pay_period_start, '2026-09-14'); assert.match(payload.payload.body.body_html, /QA &lt;Doctor&gt;/);
  assert.equal(f.logs[0].compensation_amount, 35); assert.equal(JSON.parse(f.logs[0].notes).snapshot, 'qa-saved');
});
test('sending cannot run without explicit report confirmation', async () => { const f = fixture();f.args.confirmed = false;await assert.rejects(sendDoctorReport(f.args, f.deps), /confirm/);assert.equal(f.calls.length, 0); });
test('changed email or wrong snapshot/provider stops before PDF and delivery', async () => {
  for (const contact of [{ email: 'changed@example.invalid' }, { provider_id: 'other' }, { snapshot_id: 'old' }, { found: false }]) {
    const f = fixture({ contact });await assert.rejects(sendDoctorReport(f.args, f.deps), /changed or is unavailable/);assert.equal(f.calls.length, 1);
  }
});
test('PDF failure never falls back to a different calculation', async () => {
  for (const bad of [{ pdfStatus: 202 }, { type: 'text/html' }, { pdf: '<html>wrong content</html>' }]) {
    const f = fixture(bad);await assert.rejects(sendDoctorReport(f.args, f.deps), /PDF/);assert.equal(f.calls.length, 2);
  }
});
test('unconfirmed delivery is not reported as sent', async () => { const f = fixture({ delivery: { data: { success: true } } });await assert.rejects(sendDoctorReport(f.args, f.deps), /not confirmed/);assert.equal(f.logs.length, 0); });
test('log failure preserves send success and receipt without retry', async () => { const f = fixture({ logError: new Error('fixture') });const r = await sendDoctorReport(f.args, f.deps);assert.equal(r.messageId, 'qa-receipt');assert.equal(r.historySaved, false);assert.equal(f.calls.filter(x => x.name).length, 1); });
test('mixed-month history records monthly rates, never changes the PDF calculation', async () => { const f = fixture();f.args.doctor.months.push({ month: '2026-10', applied_percent: 32, estimate_cents: 3200 });const r = await sendDoctorReport(f.args, f.deps);assert.equal(r.historySaved, true);assert.equal(JSON.parse(f.logs[0].notes).months[1].percent, 32);assert.match(JSON.parse(f.logs[0].notes).percentage, /history only/); });
const parser = require(path.join(root, 'node_modules/@babel/parser'));
test('table and report dialog compile with row actions and background calculation controls', () => {
  for (const file of ['DoctorLedgerCompensation.jsx', 'DoctorReportModal.jsx']) parser.parse(fs.readFileSync(path.join(root, 'src/pages/payroll/components', file), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
});
