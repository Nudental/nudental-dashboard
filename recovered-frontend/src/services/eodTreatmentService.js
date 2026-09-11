/**
 * eodTreatmentService.js
 * ══════════════════════════════════════════════════════════════════════════════
 * EOD Treatment Analytics — Frontend Service
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Calls:
 *   GET /v2/eod/unscheduled-treatment
 *   GET /v2/eod/treatment-plan-completion
 *
 * These are Dentrix/FastAPI-sourced read-only analytics endpoints.
 * Do NOT use Supabase for these. Do NOT write to Supabase.
 *
 * Null/zero rules:
 *   - null / undefined / NaN → caller renders as N/A or —
 *   - actual 0 → caller renders as $0.00 or 0
 *   - Do NOT use `value || 0` for display
 */

const API_BASE = 'https://api.nudashboard.com/v2';
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

const buildHeaders = () => ({
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
});

/**
 * Build a query string from a params object, omitting null/undefined values.
 */
function buildQuery(params) {
  const qs = Object.entries(params)?.filter(([, v]) => v !== null && v !== undefined && v !== '')?.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)?.join('&');
  return qs ? `?${qs}` : '';
}

/**
 * Fetch the Unscheduled Treatment queue.
 *
 * @param {object} params
 * @param {string} params.officeId         Supabase office UUID
 * @param {string} params.date             YYYY-MM-DD as-of date
 * @param {number} [params.lookbackDays]   Default 90
 * @param {boolean} [params.includeScheduled]   Default false
 * @param {boolean} [params.includeReferredOut] Default false
 * @param {string} [params.providerId]
 * @param {number} [params.minValue]
 * @param {string} [params.search]
 * @param {number} [params.page]
 * @param {number} [params.pageSize]       Default 50
 * @returns {Promise<object>} Full endpoint response
 */
export async function fetchUnscheduledTreatment(params = {}) {
  const {
    officeId,
    date,
    lookbackDays = 90,
    includeScheduled = false,
    includeReferredOut = false,
    providerId,
    minValue,
    search,
    page = 1,
    pageSize = 50,
  } = params;

  if (!officeId) throw new Error('officeId is required');
  if (!date) throw new Error('date is required');

  const query = buildQuery({
    officeId,
    date,
    lookbackDays,
    includeScheduled,
    includeReferredOut,
    ...(providerId ? { providerId } : {}),
    ...(minValue !== undefined && minValue !== null ? { minValue } : {}),
    ...(search ? { search } : {}),
    page,
    pageSize,
  });

  const url = `${API_BASE}/eod/unscheduled-treatment${query}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res?.ok) {
    let errMsg = `Unscheduled Treatment could not be loaded. (HTTP ${res?.status})`;
    try {
      const body = await res?.json();
      if (body?.detail || body?.message || body?.error) {
        errMsg = body?.detail || body?.message || body?.error || errMsg;
      }
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return await res?.json();
}

/**
 * Fetch Treatment Plan Completion analytics.
 *
 * @param {object} params
 * @param {string} [params.officeId]           Supabase office UUID (omit for all-offices)
 * @param {boolean} [params.allOffices]        Pass true for all-office view
 * @param {string} params.plannedStartDate     YYYY-MM-DD
 * @param {string} params.plannedEndDate       YYYY-MM-DD
 * @param {number} [params.completionWindowDays] Default 90
 * @param {boolean} [params.includeOpen]       Default true
 * @param {boolean} [params.includeSameDay]    Default false
 * @param {string} [params.providerId]
 * @param {string} [params.providerRole]
 * @param {string} [params.category]
 * @param {number} [params.minValue]
 * @returns {Promise<object>} Full endpoint response
 */
export async function fetchTreatmentPlanCompletion(params = {}) {
  const {
    officeId,
    allOffices = false,
    plannedStartDate,
    plannedEndDate,
    completionWindowDays = 90,
    includeOpen = true,
    includeSameDay = false,
    providerId,
    providerRole,
    category,
    minValue,
  } = params;

  if (!plannedStartDate) throw new Error('plannedStartDate is required');
  if (!plannedEndDate) throw new Error('plannedEndDate is required');

  const query = buildQuery({
    ...(allOffices ? { allOffices: true } : officeId ? { officeId } : {}),
    plannedStartDate,
    plannedEndDate,
    completionWindowDays,
    includeOpen,
    includeSameDay,
    ...(providerId ? { providerId } : {}),
    ...(providerRole ? { providerRole } : {}),
    ...(category ? { category } : {}),
    ...(minValue !== undefined && minValue !== null ? { minValue } : {}),
  });

  const url = `${API_BASE}/eod/treatment-plan-completion${query}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res?.ok) {
    let errMsg = `Treatment Plan Completion could not be loaded. (HTTP ${res?.status})`;
    try {
      const body = await res?.json();
      if (body?.detail || body?.message || body?.error) {
        errMsg = body?.detail || body?.message || body?.error || errMsg;
      }
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return await res?.json();
}
