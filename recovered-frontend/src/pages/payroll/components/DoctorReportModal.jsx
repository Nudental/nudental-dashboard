import React, { useEffect, useRef, useState } from 'react';
import { readLedgerReport } from '../../../services/compensationLedgerService';
import { doctorReportFilename, sendDoctorReport } from '../../../services/doctorReportDelivery';

const button = 'rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold disabled:opacity-50';

export default function DoctorReportModal({ doctor, period, options, allowSend, onClose }) {
  const [html, setHtml] = useState('');
  const [contact, setContact] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await readLedgerReport({ ...options, format: 'ledger-html' }, { signal: controller.signal });
        if (response.status !== 200) throw new Error('This report is not ready. Reopen it when the calculation finishes.');
        const content = await response.text();
        if (alive.current) setHtml(content);
        if (allowSend) {
          const response = await readLedgerReport({ ...options, format: 'ledger-recipient' }, { signal: controller.signal });
          const found = await response.json();
          if (response.status !== 200 || found.provider_id !== doctor.provider_id || found.snapshot_id !== options.snapshot) throw new Error('The provider contact could not be verified.');
          if (alive.current) setContact(found);
        }
      } catch (e) { if (!controller.signal.aborted && alive.current) setError(e.message); }
    };
    load();
    return () => { alive.current = false; controller.abort(); };
  }, []);
  const download = async format => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const response = await readLedgerReport({ ...options, format });
      if (response.status !== 200) throw new Error('The report is not ready.');
      const blob = await response.blob();
      if (!alive.current) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = doctorReportFilename(doctor, period.payday, format === 'ledger-pdf' ? 'pdf' : 'csv');
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const send = async () => {
    if (locked.current || attempted || !reviewed || !contact?.found || !html) return;
    locked.current = true; setBusy(true); setAttempted(true); setError('');
    try {
      const sent = await sendDoctorReport({ options, doctor, recipient: contact.email, period, confirmed: reviewed });
      if (alive.current) setReceipt(sent);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const needsReview = doctor.negative_review_required || doctor.monthly_exceptions.length > 0;
  return <div className="fixed inset-0 z-[9100] bg-black/60 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`${doctor.provider_name} compensation report`}>
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
      <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between gap-3"><div><h3 className="font-bold">{doctor.provider_name} · Compensation report</h3><p className="text-sm text-gray-500">Payday {period.payday} · All qualifying offices</p></div><button className={button} disabled={busy} onClick={onClose}>Close report</button></div>
      <div className="p-3 border-b dark:border-gray-700 flex flex-wrap gap-2"><button className={button} disabled={busy || !html} onClick={() => download('ledger-pdf')}>Download PDF</button><button className={button} disabled={busy || !html} onClick={() => download('ledger-csv')}>Export CSV</button>{allowSend && !receipt && <button className={`${button} bg-emerald-50 text-emerald-800`} disabled={busy || !html || !contact?.found || attempted} onClick={() => setConfirming(true)}>Send email</button>}{allowSend && !contact && !error && <span className="text-sm self-center">Checking saved provider email…</span>}{contact && !contact.found && <span className="text-sm self-center">No saved provider email. Add it in provider settings to enable sending.</span>}</div>
      {error && <p role="alert" className="m-3 p-3 rounded bg-rose-50 text-rose-800">{error}</p>}
      {receipt ? <div role="status" className="m-3 p-3 rounded bg-emerald-50 text-emerald-800">Report sent to {contact.email}.<p className="text-xs">Delivery reference: {receipt.messageId}</p>{!receipt.historySaved && <p>Sent-history logging was unavailable. The email was sent; do not resend.</p>}</div> : confirming && <div className="m-3 p-3 rounded border space-y-2"><p>Send this PDF to <strong>{contact.email}</strong> for {doctor.provider_name}?</p>{needsReview && <p className="text-amber-700">This estimate includes items requiring review, shown in the report.</p>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={busy || attempted} />I reviewed the recipient, estimate, and any review items in this report.</label><button className={`${button} bg-emerald-600 text-white`} disabled={busy || !reviewed || attempted} onClick={send}>{busy ? 'Sending…' : 'Confirm & send'}</button></div>}
      {html ? <iframe title={`${doctor.provider_name} report preview`} sandbox="" srcDoc={html} className="w-full flex-1 min-h-0 bg-white" /> : <p role="status" className="p-4">{error ? 'Report unavailable.' : 'Preparing provider report…'}</p>}
    </div>
  </div>;
}
