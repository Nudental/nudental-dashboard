import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { loadInsuranceReviewRequest } from '../../../services/insuranceReviewLinks';

const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const buttonClass = 'rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function InsuranceRequestActions({ request, canManage, canComplete, onChanged }) {
  const [chart, setChart] = useState(request.ascend_chart_number || '');
  const [reason, setReason] = useState('');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setChart(request.ascend_chart_number || ''); }, [request.id, request.ascend_chart_number]);
  const closed = ['completed', 'emailed_to_office', 'uploaded_to_chart', 'cancelled'].includes(request.status);
  const locked = request.status === 'cancelled' || !!request.dentrix_document_id ||
    ['sending', 'confirming', 'success', 'uploaded'].includes(request.dentrix_document_upload_status) ||
    ['uploaded', 'manual_uploaded'].includes(request.chart_upload_status);
  const act = async (action, answer) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: actionError } = await supabase.rpc('insurance_request_action', {
        target: request.id, action_name: action, answer: answer || null,
      });
      if (actionError) throw actionError;
      const updated = await loadInsuranceReviewRequest(supabase, request.id);
      onChanged(updated);
      setMessage(action === 'needs_info' ? 'Office alerts queued. Keep this request open while the office follows up.' :
        action === 'resume' ? 'Response saved. Patricia can continue verification.' :
          updated.dentrix_document_upload_status === 'pending' ? 'Chart details saved. Filing is queued; wait for the Ascend receipt.' : 'Chart number saved.');
    } catch (e) { setError(e.message || 'Could not update the request. Refresh and try again.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Chart matching and insurance follow-up" className="space-y-3 rounded-xl border border-gray-300 dark:border-gray-700 p-4">
    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Chart matching and insurance follow-up</h4>
    <p className="text-xs text-gray-500 dark:text-gray-400">Office manager / patient coordinator: copy the chart number from the correct Ascend patient. Patricia can also enter it.</p>
    <label className="block text-sm text-gray-900 dark:text-gray-100" htmlFor="insurance-chart-number">Ascend chart number (optional)</label>
    <input id="insurance-chart-number" value={chart} onChange={e => setChart(e.target.value)} maxLength={40}
      readOnly={!canManage || locked} className={inputClass} aria-describedby="insurance-chart-hint" />
    <p id="insurance-chart-hint" className="text-xs text-gray-500 dark:text-gray-400">Leave blank if unknown. Name, date of birth, and office must still match. Active and New patient charts are accepted.</p>
    {canManage && !locked && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || chart.trim().toUpperCase() === (request.ascend_chart_number || '')}
        className={buttonClass} onClick={() => act('chart_number', chart)}>Save chart number</button>
      {request.dentrix_document_upload_status === 'review' && <button type="button" disabled={busy}
        className={buttonClass} onClick={() => act('retry_filing', null)}>Retry chart match</button>}
    </div>}
    {request.needs_info_reason && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">{request.status === 'needs_info' ? 'Needs Info — office action required' : 'Insurance follow-up'}</p>
      <p className="whitespace-pre-wrap">{request.needs_info_reason}</p>
      {request.needs_info_response && <p className="mt-2 whitespace-pre-wrap"><strong>Office response:</strong> {request.needs_info_response}</p>}
    </div>}
    {request.status === 'needs_info' && canManage && <div className="space-y-2">
      <label htmlFor="insurance-office-response" className="text-sm text-gray-900 dark:text-gray-100">Office response / corrected insurance information</label>
      <textarea id="insurance-office-response" className={inputClass} rows={3} maxLength={2000} value={response} onChange={e => setResponse(e.target.value)} />
      <button type="button" className={buttonClass} disabled={busy || response.trim().length < 3} onClick={() => act('resume', response)}>Return to verification</button>
    </div>}
    {canComplete && !closed && request.status !== 'needs_info' && <div className="space-y-2 border-t border-gray-200 pt-3">
      <label htmlFor="insurance-info-issue" className="text-sm text-gray-900 dark:text-gray-100">Patricia: what insurance information needs correction?</label>
      <textarea id="insurance-info-issue" className={inputClass} rows={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: the insurer cannot locate the member. Ask the office to confirm the insurance card and subscriber details." />
      <button type="button" className={buttonClass} disabled={busy || reason.trim().length < 3} onClick={() => act('needs_info', reason)}>Mark Needs Info and notify office</button>
      <p className="text-xs text-gray-500 dark:text-gray-400">Patricia and this office’s managers/front staff receive an email. The office also receives dashboard alerts. Keep the request open; do not cancel it for missing insurance information.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </section>;
}
