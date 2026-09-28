import { dashboardFetch } from '../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';

export function ledgerReportUrl({ period, window, requestId, snapshot, overrides = {}, providerId, format = 'ledger-json' }) {
  const runId = period?.compensation_period_id || period?.gusto_run_id;
  if (!runId) throw new Error('Select a valid compensation calendar period.');
  const url = new URL(`${DASHBOARD_API_ORIGIN}/v2/reports/provider-compensation`);
  Object.entries({ startDate: window.dentrixStart, endDate: window.dentrixEnd, runId,
    userEmail: 'verified-current-account', format, calculationRequest: requestId,
    calculationSnapshot: snapshot, rateOverrides: JSON.stringify(overrides), providerId })
    .forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
  return url.toString();
}

export async function readLedgerReport(options, { signal, read = dashboardFetch } = {}) {
  const response = await read(ledgerReportUrl(options), { signal,
    headers: { 'X-API-Key': import.meta.env?.VITE_ASCEND_API_KEY || '' } });
  if (!response.ok) {
    let error; try { error = await response.json(); } catch { /* Safe generic error below. */ }
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'The complete Ascend collection calculation is unavailable. Refresh to retry.');
  }
  return response;
}

export function visibleLedgerDoctors(result, officeId) {
  return (result?.doctors || []).filter(d => !officeId || d.office_ids.includes(officeId));
}

export function ledgerSelectionMatches(result, period, window) {
  const identity = period?.compensation_period_id || period?.gusto_run_id;
  return Boolean(identity) && (result?.requested_period_id || result?.gusto?.run_id) === identity && result?.applied_window?.[0] === window?.dentrixStart && result?.applied_window?.[1] === window?.dentrixEnd;
}
