import React, { useEffect, useRef, useState } from 'react';
import DoctorReportModal from './DoctorReportModal';
import { readLedgerReport, visibleLedgerDoctors, ledgerSelectionMatches } from '../../../services/compensationLedgerService';

const cash = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const button = 'rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
const cell = 'px-3 py-4 text-left align-middle border-b border-gray-200 dark:border-gray-700';
const fmtDate = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function DoctorLedgerCompensation({ period, window, revision, periodsLoading, officeId, additionalProviders = [] }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [preview, setPreview] = useState(null);
  const [expanded, setExpanded] = useState(null);
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
      if (format === 'ledger-html' || format === 'ledger-audit-html') {
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
  const openReport = (doctor, allowSend) => setPreview({ doctor, allowSend });
  return <section aria-label="Doctor Ledger compensation" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b dark:border-gray-700"><h3 className="text-base font-bold">Doctors</h3><div className="flex items-center gap-3"><span className="text-sm text-gray-500">{doctors.length} providers</span>{ready && <><button className={button} disabled={actionBusy} onClick={() => report('ledger-csv')}>Export CSV</button><button className={button} disabled={actionBusy} onClick={() => report('ledger-pdf')}>Download PDF</button></>}</div></div>
    {busy && <p role="status" className="p-5">Reading complete Ascend collection history and monthly controls for payday {period.payday}… This can take several minutes. Estimates remain unavailable until the full read passes validation.</p>}
    {error && <p role="alert" className="m-4 rounded bg-rose-50 text-rose-800 p-3">{error}</p>}
    {error && !busy && period && !periodsLoading && <button className={`${button} m-4`} disabled={actionBusy} onClick={() => setRetry(value => value + 1)}>Retry doctor calculation</button>}
    {ready && <>
      {result.exceptions?.length > 0 && <details className="px-5 py-3 text-sm border-b dark:border-gray-700" aria-label="Compensation review exceptions"><summary className="cursor-pointer text-amber-700 dark:text-amber-300 font-semibold">{result.exceptions.length} items need review{result.complete_doctor_scope === false ? ' · Provider coverage incomplete' : ''}</summary><div className="pt-3 space-y-2">{result.exceptions.map((e,i) => <p key={`${e.provider_id}:${i}`}><strong>{e.provider_name}</strong> · {e.reason}. {e.action}.</p>)}</div></details>}
      {officeId && <p className="px-5 py-2 text-xs text-gray-500">Showing doctors assigned to {result.office_names[officeId]}. Totals include all their qualifying offices.</p>}
      {doctors.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-700"><tr>
        {['Provider', 'Office', 'Provider type', 'Pay period', 'Pay-period collections', 'Monthly tier basis', 'Comp %', 'Calculation type', 'Est. compensation', 'Status', 'Source', 'Actions'].map(t => <th className={`${cell} text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold`} key={t}>{t}</th>)}
      </tr></thead><tbody>{doctors.map(r => {
        const review = r.negative_review_required || r.monthly_exceptions.length > 0;
        return <React.Fragment key={r.provider_id}><tr>
          <td className={`${cell} font-semibold`}>{r.provider_name}</td>
          <td className={`${cell} text-gray-500 dark:text-gray-400`}>{r.office_ids.map(o => result.office_names[o]).join(', ')}</td>
          <td className={cell}><span className="px-2 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">Doctor</span></td>
          <td className={`${cell} text-gray-500 dark:text-gray-400`}>{fmtDate(result.gusto.pay_period_start)} – {fmtDate(result.gusto.pay_period_end)}</td>
          <td className={`${cell} text-right font-semibold whitespace-nowrap`}>{cash(r.eligible_period_cents)}</td>
          <td className={`${cell} text-right`}>{r.months.map(m => <div key={m.month} title={m.basis_label}>{r.months.length > 1 && <span className="text-xs text-gray-500">{m.month}: </span>}{cash(m.monthly_basis_cents)}</div>)}</td>
          <td className={cell}>{r.months.map(m => <div key={m.month} className="mb-1"><span className="rounded-full px-3 py-1 bg-[#00B5CC] text-white font-bold whitespace-nowrap" title={`${m.month} · ${m.basis_label}`}>{m.applied_percent}%</span></div>)}</td>
          <td className={`${cell} text-teal-600 dark:text-teal-400 font-medium`}>{r.override ? 'Manual rate override' : 'Monthly tiers'}</td>
          <td className={`${cell} text-right font-bold whitespace-nowrap ${r.estimate_cents < 0 ? 'text-amber-600' : 'text-emerald-500'}`}>{cash(r.estimate_cents)}</td>
          <td className={cell}><span className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${review ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{review ? 'Needs review' : 'Estimated'}</span></td>
          <td className={`${cell} text-gray-500 dark:text-gray-400`}>Dentrix Ascend collections</td>
          <td className={cell}><div className="flex items-center gap-2"><button className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-2 text-xs font-bold disabled:opacity-50" disabled={actionBusy} onClick={() => openReport(r, false)}>👁 Preview</button><button className="rounded-lg border border-emerald-300 bg-emerald-50 text-teal-800 px-3 py-2 text-xs font-bold disabled:opacity-50" disabled={actionBusy} onClick={() => openReport(r, true)}>📋 Report / Send</button><button aria-label={`${expanded === r.provider_id ? 'Hide' : 'Show'} ${r.provider_name} calculation details`} aria-expanded={expanded === r.provider_id} className="p-2 text-gray-500" onClick={() => setExpanded(expanded === r.provider_id ? null : r.provider_id)}>{expanded === r.provider_id ? '⌃' : '⌄'}</button></div></td>
        </tr>{expanded === r.provider_id && <tr><td colSpan={12} className="p-5 bg-gray-50 dark:bg-gray-900 text-sm space-y-3">
          <label className="block">Rate selection <select aria-label={`${r.provider_name} rate selection`} value={overrides[r.provider_id] ?? ''} onChange={e => changeRate(r.provider_id, e.target.value)} disabled={actionBusy} className="border rounded p-1 dark:bg-gray-700"><option value="">Automatic monthly tiers</option>{[32,33,34,35].map(p => <option value={p} key={p}>Manual override {p}%</option>)}</select></label>
          {r.months.map(m => <p key={m.month}>{m.month} · {m.basis_label} · {cash(m.period_collection_cents)} × {m.applied_percent}% = {cash(m.estimate_cents)}</p>)}
          {review && <p>Review office exceptions or negative collections in the calculation audit. No automatic deduction is applied.</p>}
          <button className={button} disabled={actionBusy} onClick={() => report('ledger-audit-html', r.provider_id)}>View calculation audit</button>
        </td></tr>}</React.Fragment>;
      })}</tbody><tfoot className="bg-gray-50 dark:bg-gray-700 font-bold"><tr><td colSpan={4} className={cell}>{result.complete_doctor_scope === false ? 'Configured providers · subtotal' : 'Total'}</td><td className={`${cell} text-right`}>{cash(doctors.reduce((s,r) => s + r.eligible_period_cents, 0))}</td><td colSpan={3} className={cell}></td><td className={`${cell} text-right text-emerald-500`}>{cash(doctors.reduce((s,r) => s + r.estimate_cents, 0))}</td><td colSpan={3} className={cell}></td></tr></tfoot></table></div> : <p className="p-5">No verified doctor estimate is available for this scope. This is not a zero-compensation result.</p>}
    </>}
    {period && !periodsLoading && <details className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400"><summary className="cursor-pointer">Calculation details & history</summary><div className="pt-3 space-y-3">
      <p>Monthly tiers combine approved offices. Calendar months are calculated separately. Estimates do not change paid payroll.</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={actionBusy} onClick={() => inspect('ledger-policy')}>Approved office rules</button><button className={button} disabled={actionBusy || busy} onClick={() => inspect('ledger-history')}>Saved calculations</button>{ready && <button className={button} disabled={actionBusy} onClick={() => report('ledger-audit-html')}>Full calculation audit</button>}</div>
      {policyView && <div aria-label="Approved compensation office rules"><p>Version {policyView.version.slice(0,12)} · Approved by {policyView.document.approved_by}</p>{policyView.document.doctors.map(p => <details key={p.id}><summary>{p.name}</summary>{p.office_rules.map(r => <p key={r.effective_start}>{r.effective_start} – {r.effective_end || 'Until superseded'}: {r.offices.map(o => policyView.document.office_names[o]).join(', ')}</p>)}</details>)}</div>}
      {history && <div aria-label="Saved calculation history">{history.calculations.map(h => <p key={h.snapshot_id}>{h.created_at} · {h.status === 'NEEDS_REVIEW' ? 'Needs review' : 'Ready for HR review'} <button className={button} disabled={actionBusy || busy} onClick={() => loadSaved(h.snapshot_id)}>View saved calculation</button></p>)}{history.calculations.length === 0 && <p>No saved calculation for this period yet.</p>}{history.older_results_available && <p>Showing the latest 20 results; older snapshots remain preserved.</p>}</div>}
      {ready && <><p className="break-all">Policy {result.policy?.version} · Saved calculation {result.job_id}</p><p>Source retrieved: {result.source_snapshot.retrieved_at}. Automated checks do not replace an independent HR report comparison.</p>{unverified.length > 0 && <details><summary>Other source identities requiring review ({unverified.length})</summary>{unverified.map((p,i) => <p key={p.providerId || i}>{p.name} · source {p.providerId || 'unresolved'}</p>)}</details>}{result.unmapped_report_identities?.map(r => <p key={r.provider_id}>{r.status} · Source {r.provider_id} · signed collection {cash(r.signed_cents)}</p>)}</>}
    </div></details>}
    {typeof preview === 'string' && ready && <div className="fixed inset-0 z-[9100] bg-black/50 p-4 flex flex-col" role="dialog" aria-modal="true" aria-label="Doctor calculation audit"><div className="bg-white p-2 flex justify-end"><button className={button} onClick={() => setPreview(null)}>Close report</button></div><iframe title="Doctor calculation audit" sandbox="" srcDoc={preview} className="bg-white flex-1 w-full" /></div>}
    {preview?.doctor && ready && <DoctorReportModal key={`${key}:${result.job_id}:${preview.doctor.provider_id}`} doctor={preview.doctor} period={result.gusto} options={{ period, window, snapshot: result.job_id, overrides, providerId: preview.doctor.provider_id }} allowSend={preview.allowSend} onClose={() => setPreview(null)} />}
  </section>;
}
