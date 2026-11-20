import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const labels = {
  pending: 'Waiting for plan entry', reconciling: 'Checking existing insurance before retry',
  claimed: 'Plan entry in progress', saving: 'Saving and checking the plan',
  needs_review: 'Needs review', succeeded: 'Saved and verified in Ascend',
};
const issues = {
  SOURCE_PATIENT_NAME_CONFLICT: 'The request and completed form have different patient names.',
  SOURCE_CHANGED: 'The source information changed. Review the correction before retrying.',
  COVERAGE_TABLE_SAVE_FAILED: 'Ascend did not save some coverage settings. Review the remaining items in the log.',
  ALTERNATE_EXCEPTION_PATH_FAILED: 'The alternative coverage save also failed. The remaining entries are still pending.',
  EXISTING_POLICY_CONFLICT: 'Existing insurance conflicts with this request. Confirm which policy to use.',
  GROUP_CONFLICT: 'Confirm the correct existing group plan.',
  CARRIER_ALIAS_UNCONFIRMED: 'Confirm the carrier match before continuing.',
  CONSENT_RECORD_UNCONFIRMED: 'A required authorization record needs confirmation.',
  DOCUMENT_REVIEW_UNAVAILABLE: 'A supporting record could not be reviewed. Check the latest log for an update.',
  SESSION_REQUIRED: 'The automation needs its Ascend sign-in restored.',
};
const fieldClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

export default function InsurancePlanEntryStatus({ requestId, canManage, onChanged }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: readError } = await supabase.rpc('insurance_plan_entry_status', { target: requestId });
    if (readError) throw readError;
    setEntry(data);
  }, [requestId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setEntry(null); setError(''); setNote('');
    supabase.rpc('insurance_plan_entry_status', { target: requestId }).then(({ data, error: readError }) => {
      if (!active) return;
      if (readError) setError('Could not load plan-entry status. Refresh to try again.');
      else setEntry(data);
      setLoading(false);
    }).catch(() => { if (active) { setError('Could not load plan-entry status.'); setLoading(false); } });
    return () => { active = false; };
  }, [requestId]);
  useEffect(() => {
    if (!entry || ['needs_review', 'succeeded'].includes(entry.state)) return undefined;
    const timer = setInterval(() => { load().catch(() => {}); }, 30000);
    return () => clearInterval(timer);
  }, [entry?.state, load]);
  const retry = async () => {
    setBusy(true); setError('');
    try {
      const { error: retryError } = await supabase.rpc('insurance_request_plan_retry', {
        target: requestId, observed_updated_at: entry.updated_at, resolution_note: note.trim(),
      });
      if (retryError) throw retryError;
      setNote(''); await load(); onChanged?.();
    } catch (e) { setError(e.message || 'Could not request a retry. Refresh and check the current status.'); }
    finally { setBusy(false); }
  };
  if (!loading && !entry && !error) return null;
  const descriptions = [...new Set((entry?.reason_codes || []).map(code => issues[code]).filter(Boolean))];
  return <section aria-label="Insurance plan in Ascend" className="space-y-3 rounded-xl border border-gray-300 dark:border-gray-700 p-4">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100">Insurance plan in Ascend</h4>
      <button type="button" className="text-sm text-primary" disabled={busy || loading}
        onClick={() => { setError(''); load().catch(() => setError('Could not refresh plan-entry status.')); }}>Refresh status</button>
    </div>
    <p role="status" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{loading ? 'Loading plan-entry status…' : labels[entry?.state] || 'Status unavailable'}</p>
    <p className="text-xs text-gray-600 dark:text-gray-300">This tracks the actual insurance plan. The PDF filing status is separate. Review the discrepancy log for differences and restrictions recorded in notes.</p>
    {entry?.state === 'needs_review' && <>
      {descriptions.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">{descriptions.map(description => <li key={description}>{description}</li>)}</ul> :
        <p className="text-sm text-amber-800 dark:text-amber-200">Read the latest discrepancy log for the issue that needs attention.</p>}
      <p className="text-sm text-gray-700 dark:text-gray-300">Patricia and the requesting office’s manager / patient coordinator: review the issue, confirm the correction, and record what changed below. Keep this request and any existing insurance policy.</p>
      {canManage && <div className="space-y-2">
        <label htmlFor="insurance-plan-retry-note" className="block text-sm text-gray-900 dark:text-gray-100">Correction or resolution for this retry</label>
        <textarea id="insurance-plan-retry-note" value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={2000} className={fieldClass} />
        <button type="button" disabled={busy || note.trim().length < 10} onClick={retry}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Requesting retry…' : 'Retry plan entry'}</button>
        <p className="text-xs text-gray-600 dark:text-gray-300">A retry checks the correct patient and all existing policies before saving. Previously saved information and the completed form are preserved. Repeated clicks do not create another job.</p>
      </div>}
    </>}
    {entry?.state === 'reconciling' && <p className="text-sm text-gray-700 dark:text-gray-300">The retry is queued for an existing-policy check. Please wait for a saved result or a new review issue.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
