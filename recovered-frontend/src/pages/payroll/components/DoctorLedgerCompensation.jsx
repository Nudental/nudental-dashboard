import React, { useEffect, useRef, useState } from 'react';
import { readLedgerReport, visibleLedgerDoctors, ledgerSelectionMatches } from '../../../services/compensationLedgerService';

const cash = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const button = 'rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
const cell = 'px-3 py-3 text-left align-top border-b';

export default function DoctorLedgerCompensation({ period, window, revision, periodsLoading, officeId, additionalProviders = [] }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [preview, setPreview] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [policyView, setPolicyView] = useState(null);
  const [history, setHistory] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const key = `${period?.id}:${window?.dentrixStart}:${window?.dentrixEnd}:${revision}:${periodsLoading}:${retry}`;
  const [resultKey, setResultKey] = useState(null);
  const ready = resultKey === key && ledgerSelectionMatches(result, period, window) && !periodsLoading;

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    let timer;
    setResult(null); setResultKey(null); setError(null); setPreview(null); setOverrides({}); setActionBusy(false); setPolicyView(null); setHistory(null);
    if (!period || periodsLoading) { setBusy(false); return () => controller.abort(); }
    setBusy(true);
    // A polling count cannot bound a stalled session, fetch or response body.
    // Settle the UI independently, then ignore any response arriving after abort.
    const deadline = setTimeout(() => {
      if (current !== generation.current || controller.signal.aborted) return;
      setError('The Ascend collection read did not finish within six minutes. No complete estimate is available. Retry the selected period.');
      setBusy(false);
      controller.abort();
    }, 360000);
    const requestId = crypto.randomUUID();
    const load = async () => {
      let snapshot;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        const response = await readLedgerReport({ period, window, requestId, snapshot }, { signal: controller.signal });
        const data = await response.json();
        if (current !== generation.current || controller.signal.aborted) return;
        if (response.status !== 202) {
          if (!ledgerSelectionMatches(data, period, window) || !Array.isArray(data.doctors) || !data.source_snapshot?.complete) throw new Error('The returned calculation does not cover the selected payroll period. Refresh to retry.');
          setResult(data); setResultKey(key); setBusy(false); return;
        }
        snapshot = data.job_id;
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
          timer = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, 2000);
          controller.signal.addEventListener('abort', abort, { once: true });
        });
      }
      throw new Error('The source read is taking longer than expected. Refresh the selected period; no old result has been shown.');
    };
    load().catch(e => { if (current === generation.current && !controller.signal.aborted) { setError(e.message); setBusy(false); } })
      .finally(() => clearTimeout(deadline));
    return () => { generation.current += 1; controller.abort(); clearTimeout(timer); clearTimeout(deadline); };
  }, [key]);

  const changeRate = async (id, value) => {
    const current = generation.current;
    const next = { ...overrides };
    if (value === '') delete next[id]; else next[id] = Number(value);
    setActionBusy(true); setError(null); setPreview(null);
    try {
      const response = await readLedgerReport({ period, window, snapshot: result.job_id, overrides: next });
      const data = await response.json();
      if (current !== generation.current) return;
      if (response.status !== 200 || !ledgerSelectionMatches(data, period, window)) throw new Error('The selected calculation is no longer available. Refresh to retry.');
      setResult(data); setOverrides(next);
    } catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setActionBusy(false); }
  };

  const report = async (format, providerId) => {
    const current = generation.current;
    setActionBusy(true); setError(null);
    try {
      const response = await readLedgerReport({ period, window, snapshot: result.job_id, overrides, providerId, format });
      if (response.status !== 200) throw new Error('The report snapshot is not ready.');
      if (format === 'ledger-html') {
        const html = await response.text();
        if (current === generation.current) setPreview(html);
      } else {
        const blob = await response.blob();
        if (current !== generation.current) return;
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `doctor-compensation-${period.payday}.${format === 'ledger-pdf' ? 'pdf' : 'csv'}`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setActionBusy(false); }
  };

  const inspect = async format => {
    const current = generation.current; setActionBusy(true); setError(null);
    try {
      const response = await readLedgerReport({ period, window, format }); const data = await response.json();
      if (current !== generation.current) return;
      if (format === 'ledger-policy') setPolicyView(data); else setHistory(data);
    } catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setActionBusy(false); }
  };
  const loadSaved = async snapshot => {
    const current = generation.current; setActionBusy(true); setError(null);
    try {
      const response = await readLedgerReport({ period, window, snapshot }); const data = await response.json();
      if (current !== generation.current) return;
      if (response.status !== 200 || !ledgerSelectionMatches(data, period, window) || !data.source_snapshot?.complete) throw new Error('Saved calculation does not cover the selected period. No current result was replaced.');
      setResult(data); setResultKey(key); setPreview(null); setOverrides({});
    } catch (e) { if (current === generation.current) setError(e.message); }
    finally { if (current === generation.current) setActionBusy(false); }
  };

  const verifiedIds = new Set((ready ? result.doctors : []).flatMap(r => r.source_provider_ids));
  const unverified = ready ? additionalProviders.filter(p => !verifiedIds.has(String(p.providerId))) : [];
  const doctors = ready ? visibleLedgerDoctors(result, officeId) : [];
  return <section aria-label="Doctor Ledger compensation" className="rounded-xl border bg-white dark:bg-gray-800 p-5 space-y-4">
    <h3 className="text-lg font-bold">Doctors · Ascend Ledger collections</h3>
    <p className="text-sm text-gray-600 dark:text-gray-300">Monthly tiers use combined qualifying offices and the approved rules effective on each Applied Date. Separate calendar months are calculated separately. These are estimates; no paid payroll is changed.</p>
    {period && !periodsLoading && <div className="flex flex-wrap gap-2"><button className={button} disabled={actionBusy} onClick={() => inspect('ledger-policy')}>Approved office rules</button><button className={button} disabled={actionBusy || busy} onClick={() => inspect('ledger-history')}>Saved calculations</button></div>}
    {policyView && <div className="rounded border p-3 text-sm" aria-label="Approved compensation office rules"><p>Version {policyView.version.slice(0,12)} · Approved by {policyView.document.approved_by} · {policyView.document.approval_reference}</p>{policyView.document.doctors.map(p => <details key={p.id}><summary>{p.name}</summary>{p.office_rules.map(r => <p key={r.effective_start}>{r.effective_start} – {r.effective_end || 'Until superseded'}: {r.offices.map(o => policyView.document.office_names[o]).join(', ')} · {r.approval_reference}</p>)}</details>)}<p>These compensation rules do not change anyone’s login or office access.</p></div>}
    {history && <div className="rounded border p-3 text-sm" aria-label="Saved calculation history"><p>Saved results are immutable. Refresh creates a new source read; it does not replace these results.</p>{history.calculations.map(h => <p key={h.snapshot_id}>{h.created_at} · Policy {h.policy_version?.slice(0,12)} · {h.status === 'NEEDS_REVIEW' ? 'Needs review' : 'Ready for HR review'} <button className={button} disabled={actionBusy || busy} onClick={() => loadSaved(h.snapshot_id)}>View saved calculation</button></p>)}{history.calculations.length === 0 && <p>No saved calculation for this period yet.</p>}{history.older_results_available && <p>Showing the latest 20 results; older snapshots remain preserved.</p>}</div>}
    {busy && <p role="status">Reading complete Ascend collection history and monthly controls for payday {period.payday}… This can take several minutes. Estimates remain unavailable until the full read passes validation.</p>}
    {error && <p role="alert" className="rounded bg-rose-50 text-rose-800 p-3">{error}</p>}
    {error && !busy && period && !periodsLoading && <button className={button} disabled={actionBusy} onClick={() => setRetry(value => value + 1)}>Retry doctor calculation</button>}
    {ready && <>
      <p role="status" className="rounded bg-slate-50 text-slate-900 p-3">{result.status === 'NEEDS_REVIEW' ? 'Needs review — see the named exceptions below.' : 'Ready for HR review — automated checks passed.'} No payroll approval, payment or email has been performed.</p>
      {result.exceptions?.length > 0 && <div aria-label="Compensation review exceptions" className="rounded border border-amber-300 p-3 text-sm">{result.exceptions.map((e,i) => <p key={`${e.provider_id}:${i}`}><strong>{e.provider_name}</strong> · {e.period.join(' – ')} · {e.reason}. Required action: {e.action}.</p>)}</div>}
      {doctors.length > 0 ? <p className="text-sm">{result.complete_doctor_scope === false ? 'Configured-doctor subtotal — incomplete payroll scope' : 'Eligible doctor collections'}: <strong>{cash(doctors.reduce((s, r) => s + r.eligible_period_cents, 0))}</strong> · Estimated compensation{result.complete_doctor_scope === false ? ' subtotal' : ''}: <strong>{cash(doctors.reduce((s, r) => s + r.estimate_cents, 0))}</strong></p> : <p>No verified doctor estimate is available for this scope. This is not a zero-compensation result.</p>}
      {result.policy && <p className="text-xs">Policy version {result.policy.version.slice(0,12)} · Saved calculation {result.job_id} · Automated validation; not a new independent HR-report comparison.</p>}
      {officeId && <p className="text-sm">Showing doctors assigned to {result.office_names[officeId]}. Amounts and tiers retain all their qualifying offices; office subtotals appear in Details.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={actionBusy} onClick={() => report('ledger-csv')}>Export doctor CSV · all qualifying offices</button>
        <button className={button} disabled={actionBusy} onClick={() => report('ledger-html')}>Detailed doctor report</button>
        <button className={button} disabled={actionBusy} onClick={() => report('ledger-pdf')}>Download doctor PDF</button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>
        {['Doctor / offices', 'Calendar month / basis', 'Period collections', 'Monthly collections', 'Rate', 'Estimate', 'Details'].map(t => <th className={cell} key={t}>{t}</th>)}
      </tr></thead><tbody>{doctors.map(r => <React.Fragment key={r.provider_id}>{r.months.map((m, index) => <tr key={`${r.provider_id}:${m.month}`}>
        <td className={cell}>{index === 0 && <><strong>{r.provider_name}</strong><p>{r.office_ids.map(o => result.office_names[o]).join(', ')}</p><label className="block mt-2">Rate selection <select aria-label={`${r.provider_name} rate selection`} value={overrides[r.provider_id] ?? ''} onChange={e => changeRate(r.provider_id, e.target.value)} disabled={actionBusy} className="border rounded p-1 dark:bg-gray-700"><option value="">Automatic monthly tiers</option>{[32,33,34,35].map(p => <option value={p} key={p}>Manual override {p}%</option>)}</select></label></>}</td>
        <td className={cell}>{m.month}<p>{m.basis_label}</p></td><td className={cell}>{cash(m.period_collection_cents)}</td><td className={cell}>{cash(m.monthly_basis_cents)}</td>
        <td className={cell}>{m.applied_percent}%{r.override && <p>Manual override; automatic {m.automatic_percent}%</p>}</td><td className={cell}>{cash(m.estimate_cents)}</td>
        <td className={cell}>{index === 0 && <button className={button} disabled={actionBusy} onClick={() => report('ledger-html', r.provider_id)}>Details</button>}</td>
      </tr>)}<tr><td colSpan={7} className="p-3 bg-gray-50 dark:bg-gray-900 text-xs">
        Raw signed HR Total Collection: {cash(r.raw_hr_collection_cents)} · Eligible period: {cash(r.eligible_period_cents)} · Estimate: {cash(r.estimate_cents)}
        {r.monthly_exceptions.length > 0 && <details><summary>{r.monthly_exceptions.length} monthly office exceptions retained for review</summary>{r.monthly_exceptions.map((e,i) => <p key={i}>{e.applied_date} · {result.office_names[e.office_id]} · {cash(e.signed_cents)} · {e.reason}</p>)}</details>}
        {r.negative_review_required && <p>Negative amount requires HR review; no automatic deduction.</p>}
        <details><summary>Calculation and month-end review</summary><p className="break-all">Calculation: {r.calculation_id}</p><p>Month-end adjustment awaits verified compensation already paid for the same earning month and separate HR approval. No adjustment is included.</p></details>
      </td></tr></React.Fragment>)}</tbody></table></div>
      {unverified.length > 0 && <details><summary>Other source identities requiring verified doctor/office evidence ({unverified.length})</summary>{unverified.map((p,i) => <p key={p.providerId || i}>{p.name} · source {p.providerId || 'unresolved'} · no verified doctor compensation shown; not silently assigned a tier.</p>)}</details>}
      <p className="text-xs text-gray-500">Source retrieved: {result.source_snapshot.retrieved_at}. Applied Date cutoffs are shown per month. The API does not supply the HR report refresh time; a new refresh is not automatically independently certified.</p>
      {result.unmapped_report_identities?.map(r => <p role="alert" key={r.provider_id}>{r.status} · Source {r.provider_id} · signed collection {cash(r.signed_cents)}</p>)}
    </>}
    {preview && ready && <div className="fixed inset-0 z-[70] bg-black/50 p-4 flex flex-col" role="dialog" aria-modal="true" aria-label="Doctor compensation detailed report"><div className="bg-white p-2 flex justify-end"><button className={button} onClick={() => setPreview(null)}>Close report</button></div><iframe title="Doctor compensation detailed report" sandbox="" srcDoc={preview} className="bg-white flex-1 w-full" /></div>}
  </section>;
}
