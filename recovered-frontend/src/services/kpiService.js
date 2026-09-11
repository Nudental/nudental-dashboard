import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';
import { getLocationIdByOfficeId } from '../constants/offices';
import { fetchTreatmentPlanCompletion } from './eodTreatmentService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const safeDivide = (n, d) => {
  const num = parseFloat(n);
  const den = parseFloat(d);
  if (!isFinite(num) || !isFinite(den) || den === 0 || isNaN(num) || isNaN(den)) return null;
  return num / den;
};

export const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

/**
 * parseApiField — null-safe field parser.
 * Returns null when the value is missing/null/undefined.
 * Returns the numeric value when the API returned a real number (including 0).
 * Use this instead of safeNum() for Dentrix API fields where missing ≠ zero.
 */
export const parseApiField = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : null;
};

// V719B FIX: fmtCurrency null guard — null/undefined returns '—' not '$0'
export const fmtCurrency = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(safeNum(v));
};

export const fmtPct = (v) => {
  if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return '—';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

export const fmtNum = (v) =>
  new Intl.NumberFormat('en-US')?.format(safeNum(v));

// ─── V729B: Retry/Backoff Helper ─────────────────────────────────────────────
/**
 * fetchWithRetry — wraps an async fetch fn with 1-2 retries and exponential backoff.
 * Rules:
 * - Max 2 retries (3 total attempts)
 * - Short delay: 600ms → 1200ms
 * - Does NOT retry Supabase RLS/permission errors (PGRST codes)
 * - Does NOT retry 403/401 HTTP errors (auth failures)
 * - Returns { value, failureType } where failureType is one of:
 *   'success' | 'endpoint_failed' | 'endpoint_unavailable' | 'rls_denied'
 */
export const fetchWithRetry = async (fn, label = 'fetch', maxRetries = 2) => {
  const isNonRetryableError = (err) => {
    const msg = err?.message || '';
    // Supabase RLS / permission errors — do not retry
    if (msg?.includes('PGRST') || msg?.includes('RLS') || msg?.includes('permission denied')) return true;
    // HTTP 401/403 — auth failures — do not retry
    if (msg?.includes('401') || msg?.includes('403')) return true;
    return false;
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { value, failureType: 'success' };
    } catch (err) {
      lastErr = err;
      if (isNonRetryableError(err)) {
        console.warn(`[${label}] Non-retryable error (attempt ${attempt + 1}):`, err?.message);
        return { value: null, failureType: 'rls_denied', error: err };
      }
      if (attempt < maxRetries) {
        const delay = 600 * Math.pow(2, attempt); // 600ms, 1200ms
        console.warn(`[${label}] Attempt ${attempt + 1} failed — retrying in ${delay}ms:`, err?.message);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  console.warn(`[${label}] All ${maxRetries + 1} attempts failed:`, lastErr?.message);
  return { value: null, failureType: 'endpoint_failed', error: lastErr };
};

/**
 * V729B: Classify an API result into a failure type for UI distinction.
 * - 'success'            — endpoint returned a non-null value
 * - 'endpoint_failed'— endpoint threw / network error * -'endpoint_null'      — endpoint returned null (no data for period)
 * - 'endpoint_true_zero' — endpoint returned a confirmed numeric 0
 * - 'endpoint_unavailable' — endpoint not configured / not called
 */
export const classifyApiResult = (value, failureType) => {
  if (failureType && failureType !== 'success') return failureType;
  if (value === null || value === undefined) return 'endpoint_null';
  if (typeof value === 'number' && value === 0) return 'endpoint_true_zero';
  return 'success';
};

// Build date range from preset
export const buildKpiDateRange = (preset, customStartDate, customEndDate) => {
  const now = new Date();
  const year = now?.getFullYear();
  const month = now?.getMonth() + 1;

  // Custom date range support
  if (preset === 'custom' && customStartDate && customEndDate) {
    const [sy, sm] = customStartDate?.split('-')?.map(Number);
    const [ey, em] = customEndDate?.split('-')?.map(Number);
    if (sy && sm && ey && em && customStartDate <= customEndDate) {
      return { startYear: sy, startMonth: sm, endYear: ey, endMonth: em };
    }
    // Invalid custom range — fall through to default
  }

  switch (preset) {
    case 'this_month':
      return { startYear: year, startMonth: month, endYear: year, endMonth: month };
    case 'last_month': {
      const d = new Date(year, month - 2, 1);
      return { startYear: d?.getFullYear(), startMonth: d?.getMonth() + 1, endYear: d?.getFullYear(), endMonth: d?.getMonth() + 1 };
    }
    case 'this_quarter': {
      const q = Math.ceil(month / 3);
      const startM = (q - 1) * 3 + 1;
      const endM = q * 3;
      return { startYear: year, startMonth: startM, endYear: year, endMonth: endM };
    }
    case 'ytd':
      return { startYear: year, startMonth: 1, endYear: year, endMonth: month };
    default:
      return { startYear: year, startMonth: month, endYear: year, endMonth: month };
  }
};

// Filter records by date range
const filterByRange = (records, startYear, startMonth, endYear, endMonth) => {
  return (records || [])?.filter((r) => {
    const rVal = parseInt(r?.report_year) * 100 + parseInt(r?.report_month);
    const startVal = startYear * 100 + startMonth;
    const endVal = endYear * 100 + endMonth;
    return rVal >= startVal && rVal <= endVal;
  });
};

// Get last N months as [{year, month}]
export const getLastNMonths = (n) => {
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result?.push({ year: d?.getFullYear(), month: d?.getMonth() + 1 });
  }
  return result;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (year, month) => `${MONTH_NAMES?.[month - 1]} ${String(year)?.slice(2)}`;

// ─── Fetch Offices ────────────────────────────────────────────────────────────

export const fetchKpiOffices = async () => {
  const { data, error } = await supabase
    ?.from('offices')
    ?.select('id, name')
    ?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ─── Fetch Appointments Summary ───────────────────────────────────────────────

export const fetchAppointmentsSummary = async ({ startDate, endDate, locationId = null }) => {
  try {
    const API_BASE = 'https://api.nudashboard.com/v2';
    const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || 'nudashboard_prod_key';
    let url = `${API_BASE}/appointments/summary?startDate=${startDate}&endDate=${endDate}`;
    if (locationId) url += `&locationId=${locationId}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error(`appointments/summary error: ${res.status}`);
    return await res?.json();
  } catch (err) {
    console.warn('[fetchAppointmentsSummary] error:', err);
    return null;
  }
};

// ─── Fetch KPI Summary (aggregated for period + offices) ─────────────────────

export const fetchKpiSummary = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  // Build ISO date strings for the middleware API
  const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0)?.getDate();
  const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

  // locationId: resolve Dentrix locationId from Supabase office UUID
  // NEVER pass raw Supabase UUID as locationId — middleware rejects it
  const locationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;
  const singleOfficeUUID = officeIds?.length === 1 ? officeIds?.[0] : null;
  const isAllOffices = officeIds?.length !== 1;

  // V729B: Track per-endpoint failure types for UI error state
  const endpointFailures = {};

  try {
    // V729B: Use fetchWithRetry for core KPI calls — 1-2 retries with backoff
    // Promise.allSettled so one failed endpoint does not zero out all cards.
    const [productionResult, collectionsResult, patientsResult, adjustmentsResult, apptResult, tarResult] = await Promise.allSettled([
      fetchWithRetry(() => ascendApi?.getProduction(startDate, endDate, locationId), 'production'),
      fetchWithRetry(() => ascendApi?.getCollections(startDate, endDate, locationId), 'collections'),
      fetchWithRetry(() => ascendApi?.getPatients(startDate, endDate, locationId), 'patients'),
      // Fetch adjustment summary — gracefully handle if endpoint not yet live
      fetchWithRetry(() => ascendApi?.getAdjustmentsSummary(startDate, endDate, locationId), 'adjustments'),
      // Fetch appointments summary for brokenAppointments field
      fetchWithRetry(() => ascendApi?.getAppointmentsSummary(startDate, endDate, locationId), 'appointments'),
      // V719B: Fetch Treatment Plan Completion from Dentrix/FastAPI
      fetchTreatmentPlanCompletion({
        ...(isAllOffices ? { allOffices: true } : { officeId: singleOfficeUUID }),
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        completionWindowDays: 90,
      }),
    ]);

    // V729B: Extract values and track failure types
    // fetchWithRetry returns { value, failureType } — unwrap here
    const unwrap = (result, key) => {
      if (result?.status !== 'fulfilled') {
        endpointFailures[key] = 'endpoint_failed';
        return null;
      }
      const { value, failureType } = result?.value || {};
      if (failureType && failureType !== 'success') {
        endpointFailures[key] = failureType;
        return null;
      }
      return value ?? null;
    };

    const productionData = unwrap(productionResult, 'production');
    const collectionsData = unwrap(collectionsResult, 'collections');
    const patientsData = unwrap(patientsResult, 'patients');
    const adjustmentsData = unwrap(adjustmentsResult, 'adjustments');
    const apptData = unwrap(apptResult, 'appointments');
    // TAR is not wrapped in fetchWithRetry — handle directly
    const tarRaw = tarResult?.status === 'fulfilled' ? tarResult?.value : null;
    if (tarResult?.status !== 'fulfilled') endpointFailures['tar'] = 'endpoint_failed';

    // Use parseApiField so missing/null API fields stay null (not 0).
    const grossProduction = parseApiField(productionData?.grossProduction);
    const rawNetProduction = parseApiField(productionData?.netProduction) ?? parseApiField(productionData?.net_production);
    if (rawNetProduction === null && productionData !== null) {
      console.warn('[fetchKpiSummary] netProduction missing from /v2/production/summary — showing N/A, not grossProduction fallback');
    }
    const netProduction = rawNetProduction;
    const collections = parseApiField(collectionsData?.totalCollections);

    const newPatients = parseApiField(patientsData?.newPatients);
    const activePatients = parseApiField(patientsData?.activePatients) ?? parseApiField(patientsData?.uniquePatients);
    const uniquePatients = parseApiField(patientsData?.uniquePatients) ?? parseApiField(patientsData?.activePatients);

    // V728D FIX: Add field aliases
    const brokenAppointments = parseApiField(apptData?.brokenAppointments ?? apptData?.broken_appointments ?? apptData?.totalBroken);
    const apptBroken = parseApiField(apptData?.broken);
    const apptNoShow = parseApiField(apptData?.noShow ?? apptData?.no_show);
    const apptCancelled = parseApiField(apptData?.cancelled);
    const apptCancelledByOffice = parseApiField(apptData?.cancelledByOffice);
    const apptCompleted = parseApiField(apptData?.completed);
    const apptTotalScheduled = parseApiField(apptData?.totalScheduled);

    const collectionPct = collectionsData?.collectionRate != null
      ? parseApiField(collectionsData?.collectionRate)
      : (netProduction != null && netProduction > 0 && collections != null
          ? (Math.abs(collections) / Math.abs(netProduction)) * 100
          : null);

    const adjustmentsEndpointAvailable = adjustmentsData !== null;

    const totalProductionAdjustments = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.totalProductionAdjustments ?? adjustmentsData?.totalAdjustments ?? adjustmentsData?.totalNetAdjustments)
      : null;

    const writeOffs = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.writeOffs ?? productionData?.writeOffs)
      : null;
    const writeOffsCount = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.writeOffsCount)
      : null;

    const chargeAdjustments = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.chargeAdjustments ?? productionData?.chargeAdjustments)
      : null;
    const chargeAdjustmentsCount = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.chargeAdjustmentsCount)
      : null;

    const creditAdjustments = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.creditAdjustments)
      : null;
    const insuranceAdjustments = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.insuranceAdjustments)
      : null;
    const discounts = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.discounts)
      : null;
    const voidedCount = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.voidedCount)
      : null;
    const totalNetAdjustments = adjustmentsEndpointAvailable
      ? parseApiField(adjustmentsData?.totalNetAdjustments)
      : null;

    const tarEndpointAvailable = tarRaw !== null;
    const tarRawValueRate = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.completion_rate_by_value ?? tarRaw?.completion_rate_by_value)
      : null;
    const tarRawCountRate = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.completion_rate_by_count ?? tarRaw?.completion_rate_by_count)
      : null;
    const tarPct = tarRawValueRate !== null ? tarRawValueRate * 100 : null;
    const tarByCount = tarRawCountRate !== null ? tarRawCountRate * 100 : null;
    const tarPlannedCount = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.planned_count ?? tarRaw?.planned_count)
      : null;
    const tarCompletedCount = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.completed_count ?? tarRaw?.completed_count)
      : null;
    const tarPlannedValue = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.planned_value ?? tarRaw?.planned_value)
      : null;
    const tarCompletedValue = tarEndpointAvailable
      ? parseApiField(tarRaw?.summary?.completed_value ?? tarRaw?.completed_value)
      : null;
    const tarIsMature = tarEndpointAvailable
      ? (tarRaw?.maturity?.is_mature ?? tarRaw?.is_mature ?? null)
      : null;
    const tarWarnings = tarEndpointAvailable
      ? (tarRaw?.warnings ?? [])
      : [];
    const tarByOffice = tarEndpointAvailable
      ? (tarRaw?.by_office ?? [])
      : [];
    const tarCompletionWindowDays = tarEndpointAvailable
      ? (tarRaw?.completionWindowDays ?? tarRaw?.completion_window_days ?? 90)
      : 90;

    const avgProdPerVisit = (
      typeof netProduction === 'number' &&
      isFinite(netProduction) &&
      apptCompleted !== null &&
      apptCompleted > 0
    )
      ? safeDivide(netProduction, apptCompleted)
      : null;

    // V729B: Determine which core endpoints failed for banner display
    const coreEndpointsFailed = Object.keys(endpointFailures)?.filter(k => ['production', 'collections', 'patients', 'appointments', 'tar']?.includes(k) && endpointFailures?.[k] === 'endpoint_failed');

    return {
      production: netProduction,
      grossProduction,
      netProduction,
      collections,
      collectionPct,
      newPatients,
      activePatients,
      uniquePatients,
      brokenAppointments,
      apptBroken,
      apptNoShow,
      apptCancelled,
      apptCancelledByOffice,
      apptCompleted,
      apptTotalScheduled,
      brokenAppts: brokenAppointments,
      tarPct,
      tarData: {
        endpointAvailable: tarEndpointAvailable,
        completionRateByValue: tarPct,
        completionRateByCount: tarByCount,
        plannedCount: tarPlannedCount,
        completedCount: tarCompletedCount,
        plannedValue: tarPlannedValue,
        completedValue: tarCompletedValue,
        isMature: tarIsMature,
        warnings: tarWarnings,
        byOffice: tarByOffice,
        completionWindowDays: tarCompletionWindowDays,
      },
      avgProdPerVisit,
      adjustments: {
        totalProductionAdjustments,
        total: totalProductionAdjustments,
        writeOffs,
        writeOffsCount,
        chargeAdjustments,
        chargeAdjustmentsCount,
        creditAdjustments,
        insuranceAdjustments,
        discounts,
        voidedCount,
        totalNetAdjustments,
        endpointAvailable: adjustmentsEndpointAvailable,
        grossToNetDiff: (grossProduction != null && netProduction != null) ? grossProduction - netProduction : null,
      },
      // V729B: Expose per-endpoint failure types for banner/retry logic
      endpointFailures,
      coreEndpointsFailed,
      hasApiFailure: coreEndpointsFailed?.length > 0,
    };
  } catch (err) {
    console.error('[fetchKpiSummary] Middleware API error:', err);
    return {
      production: null,
      grossProduction: null,
      netProduction: null,
      collections: null,
      collectionPct: null,
      newPatients: null,
      activePatients: null,
      uniquePatients: null,
      brokenAppointments: null,
      apptBroken: null,
      apptNoShow: null,
      apptCancelled: null,
      apptCancelledByOffice: null,
      apptCompleted: null,
      apptTotalScheduled: null,
      brokenAppts: null,
      tarPct: null,
      tarData: {
        endpointAvailable: false,
        completionRateByCount: null,
        completionRateByValue: null,
        plannedCount: null,
        completedCount: null,
        plannedValue: null,
        completedValue: null,
        isMature: null,
        warnings: [],
        byOffice: [],
        completionWindowDays: 90,
      },
      avgProdPerVisit: null,
      adjustments: {
        totalProductionAdjustments: null,
        total: null,
        writeOffs: null,
        writeOffsCount: null,
        chargeAdjustments: null,
        chargeAdjustmentsCount: null,
        creditAdjustments: null,
        insuranceAdjustments: null,
        discounts: null,
        voidedCount: null,
        totalNetAdjustments: null,
        endpointAvailable: false,
        grossToNetDiff: 0,
      },
      // V729B: All core endpoints failed
      endpointFailures: { production: 'endpoint_failed', collections: 'endpoint_failed', patients: 'endpoint_failed', appointments: 'endpoint_failed', tar: 'endpoint_failed' },
      coreEndpointsFailed: ['production', 'collections', 'patients', 'appointments', 'tar'],
      hasApiFailure: true,
    };
  }
};

// ─── Fetch Sparkline Data (last 6 months, grouped by month) ──────────────────
// V312 — PATCH 2: Rewired from monthly_executive_analytics to Dentrix FastAPI endpoints.

export const fetchSparklineData = async ({ officeIds = [] }) => {
  const months = getLastNMonths(6);

  const locationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;

  const monthResults = await Promise.allSettled(
    months?.map(async (m) => {
      const startDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-01`;
      const lastDay = new Date(m?.year, m?.month, 0)?.getDate();
      const endDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

      const [prodResult, collResult, patientsResult] = await Promise.allSettled([
        ascendApi?.getProduction(startDate, endDate, locationId),
        ascendApi?.getCollections(startDate, endDate, locationId),
        ascendApi?.getPatients(startDate, endDate, locationId),
      ]);

      const prodData = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
      const collData = collResult?.status === 'fulfilled' ? collResult?.value : null;
      const patientsData = patientsResult?.status === 'fulfilled' ? patientsResult?.value : null;

      const netProd = parseApiField(prodData?.netProduction) ?? parseApiField(prodData?.net_production);
      const totalColl = parseApiField(collData?.totalCollections);
      const newPats = parseApiField(patientsData?.newPatients);
      const activePats = parseApiField(patientsData?.activePatients) ?? parseApiField(patientsData?.uniquePatients);

      const collectionPct = (netProd !== null && netProd > 0 && totalColl !== null)
        ? (Math.abs(totalColl) / Math.abs(netProd)) * 100
        : null;

      return {
        label: monthLabel(m?.year, m?.month),
        year: m?.year,
        month: m?.month,
        production: netProd,
        collections: totalColl,
        newPatients: newPats,
        activePatients: activePats,
        collectionPct,
        tarPct: null,
        avgProdPerVisit: null,
        brokenAppts: null,
      };
    })
  );

  return monthResults?.map((r, i) => {
    if (r?.status === 'fulfilled') return r?.value;
    let m = months?.[i];
    return {
      label: monthLabel(m?.year, m?.month),
      year: m?.year,
      month: m?.month,
      production: null,
      collections: null,
      newPatients: null,
      activePatients: null,
      collectionPct: null,
      tarPct: null,
      avgProdPerVisit: null,
      brokenAppts: null,
    };
  });
};

// ─── Fetch Goal vs Actual Table (per office) ──────────────────────────────────

export const fetchGoalVsActual = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0)?.getDate();
  const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

  const monthYears = [];
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 1;
    const mEnd = y === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) {
      monthYears?.push(`${y}-${String(m)?.padStart(2, '0')}`);
    }
  }

  // ── V729B: Auth/session gating for office_goals ───────────────────────────
  // office_goals RLS requires auth.uid() to be non-null.
  // Explicitly verify session and refresh if needed before querying.
  let sessionReady = false;
  let sessionWarning = null;
  try {
    const { data: sessionData, error: sessionError } = await supabase?.auth?.getSession();
    if (sessionError) {
      console.warn('[fetchGoalVsActual] Session error:', sessionError?.message);
    }
    if (sessionData?.session?.access_token) {
      sessionReady = true;
    } else {
      // Attempt to refresh session once
      console.warn('[fetchGoalVsActual] No active session — attempting refreshSession');
      const { data: refreshData, error: refreshError } = await supabase?.auth?.refreshSession();
      if (refreshData?.session?.access_token) {
        sessionReady = true;
        console.log('[fetchGoalVsActual] Session refreshed successfully');
      } else {
        console.warn('[fetchGoalVsActual] Session refresh failed:', refreshError?.message);
        sessionWarning = 'Goal data could not load because the session was not ready. Please refresh or sign in again.';
      }
    }
  } catch (sessionErr) {
    console.warn('[fetchGoalVsActual] Session check threw:', sessionErr?.message);
    sessionWarning = 'Goal data could not load because the session was not ready. Please refresh or sign in again.';
  }

  // ── Goals: Supabase office_goals only ────────────────────────────────────
  let goalsData = null;
  let goalsError = null;
  let goalsFailureType = 'success';

  if (!sessionReady) {
    goalsFailureType = 'session_not_ready';
    console.warn('[fetchGoalVsActual] Skipping office_goals query — session not ready');
  } else {
    const result = await supabase
      ?.from('office_goals')
      ?.select('office_id, month_year, production_goal, collections_goal, new_patients_goal, monthly_target')
      ?.in('month_year', monthYears);
    goalsData = result?.data;
    goalsError = result?.error;

    if (goalsError) {
      console.warn('[fetchGoalVsActual] office_goals query error:', goalsError?.message, '— code:', goalsError?.code);
      // Distinguish RLS denial from other errors
      if (goalsError?.code?.startsWith('PGRST') || goalsError?.message?.includes('permission')) {
        goalsFailureType = 'rls_denied';
      } else {
        goalsFailureType = 'endpoint_failed';
      }
    } else if (!goalsData || goalsData?.length === 0) {
      goalsFailureType = 'endpoint_null';
    }
  }

  // Build goals map: officeUUID -> aggregated goals
  const goalsByOfficeUUID = {};
  (goalsData || [])?.forEach((g) => {
    const uid = g?.office_id;
    if (!goalsByOfficeUUID?.[uid]) {
      goalsByOfficeUUID[uid] = { production: 0, collections: null, collectionsHasValue: false, newPatients: 0, count: 0 };
    }
    goalsByOfficeUUID[uid].production += safeNum(g?.production_goal ?? g?.monthly_target ?? 0);
    if (g?.collections_goal !== null && g?.collections_goal !== undefined) {
      goalsByOfficeUUID[uid].collections = (goalsByOfficeUUID?.[uid]?.collections ?? 0) + safeNum(g?.collections_goal);
      goalsByOfficeUUID[uid].collectionsHasValue = true;
    }
    goalsByOfficeUUID[uid].newPatients += safeNum(g?.new_patients_goal ?? 0);
    goalsByOfficeUUID[uid].count += 1;
  });

  // ── Actuals: Dentrix FastAPI per office ───────────────────────────────────
  const OFFICE_UUID_TO_LOCATION = {
    '220372a5-afae-49c9-8a0c-f4c0717ff352': '14000000000433', // Eatontown
    'b0abcc46-55e8-4529-a28f-eedf41c1d72e': '14000000000432', // Staten Island
    '54626997-57c2-4934-8743-1dabb4d176f4': '14000000000435', // Brick
    '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': '14000000000434', // Barnegat
  };
  const OFFICE_UUID_TO_NAME_GVA = {
    '220372a5-afae-49c9-8a0c-f4c0717ff352': 'Eatontown',
    'b0abcc46-55e8-4529-a28f-eedf41c1d72e': 'Staten Island',
    '54626997-57c2-4934-8743-1dabb4d176f4': 'Brick',
    '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': 'Barnegat',
  };

  const targetUUIDs = officeIds?.length > 0
    ? officeIds?.filter((uid) => OFFICE_UUID_TO_LOCATION?.[uid])
    : Object.keys(OFFICE_UUID_TO_LOCATION);

  const isAllOffices = officeIds?.length !== 1;

  const [officeActuals, tarResult] = await Promise.all([
    Promise.allSettled(
      targetUUIDs?.map(async (uid) => {
        const locId = OFFICE_UUID_TO_LOCATION?.[uid];
        const officeName = OFFICE_UUID_TO_NAME_GVA?.[uid] || uid;
        try {
          // V729B: Use fetchWithRetry for per-office actual calls
          const [prodResult, collResult, patientsResult] = await Promise.allSettled([
            fetchWithRetry(() => ascendApi?.getProduction(startDate, endDate, locId), `gva-production-${officeName}`),
            fetchWithRetry(() => ascendApi?.getCollections(startDate, endDate, locId), `gva-collections-${officeName}`),
            fetchWithRetry(() => ascendApi?.getPatients(startDate, endDate, locId), `gva-patients-${officeName}`),
          ]);

          const prodData = prodResult?.status === 'fulfilled' ? prodResult?.value?.value : null;
          const collData = collResult?.status === 'fulfilled' ? collResult?.value?.value : null;
          const patientsData = patientsResult?.status === 'fulfilled' ? patientsResult?.value?.value : null;

          const netProduction = parseApiField(prodData?.netProduction) ?? parseApiField(prodData?.net_production);
          const totalCollections = parseApiField(collData?.totalCollections);
          const newPatients = parseApiField(patientsData?.newPatients);

          // V729B: Track per-office actual failure types
          const actualFailures = {};
          if (prodResult?.status !== 'fulfilled' || prodResult?.value?.failureType === 'endpoint_failed') actualFailures.production = 'endpoint_failed';
          if (collResult?.status !== 'fulfilled' || collResult?.value?.failureType === 'endpoint_failed') actualFailures.collections = 'endpoint_failed';
          if (patientsResult?.status !== 'fulfilled' || patientsResult?.value?.failureType === 'endpoint_failed') actualFailures.patients = 'endpoint_failed';

          return { uid, officeName, netProduction, totalCollections, newPatients, actualFailures };
        } catch (err) {
          console.warn(`[fetchGoalVsActual] Dentrix fetch failed for ${officeName}:`, err);
          return { uid, officeName, netProduction: null, totalCollections: null, newPatients: null, actualFailures: { production: 'endpoint_failed', collections: 'endpoint_failed', patients: 'endpoint_failed' } };
        }
      })
    ),
    fetchTreatmentPlanCompletion({
      ...(isAllOffices ? { allOffices: true } : { officeId: targetUUIDs?.[0] }),
      plannedStartDate: startDate,
      plannedEndDate: endDate,
      completionWindowDays: 90,
    })?.catch((err) => {
      console.warn('[fetchGoalVsActual] TAR endpoint error:', err);
      return null;
    }),
  ]);

  const tarRaw = tarResult;
  const tarByOfficeMap = {};

  const DENTRIX_LOC_TO_UUID_GVA = Object.fromEntries(
    Object.entries(OFFICE_UUID_TO_LOCATION)?.map(([uuid, locId]) => [locId, uuid])
  );

  if (tarRaw?.by_office?.length > 0) {
    tarRaw?.by_office?.forEach((entry) => {
      const rawRate = parseApiField(entry?.completion_rate_by_value ?? entry?.completionRateByValue);
      const scaledRate = rawRate !== null ? rawRate * 100 : null;

      const entryId = entry?.office_id || entry?.officeId;
      if (entryId && OFFICE_UUID_TO_NAME_GVA?.[entryId]) {
        tarByOfficeMap[entryId] = scaledRate;
        return;
      }

      const entryDentrixLocId = entry?.dentrix_location_id || entry?.locationId || entry?.location_id;
      if (entryDentrixLocId && DENTRIX_LOC_TO_UUID_GVA?.[entryDentrixLocId]) {
        const matchedUUID = DENTRIX_LOC_TO_UUID_GVA?.[entryDentrixLocId];
        tarByOfficeMap[matchedUUID] = scaledRate;
        return;
      }

      const entryName = entry?.office_name || entry?.officeName || entry?.name;
      if (entryName) {
        const matchedUUID = Object.entries(OFFICE_UUID_TO_NAME_GVA)?.find(([, name]) => name?.toLowerCase() === entryName?.toLowerCase())?.[0];
        if (matchedUUID) {
          tarByOfficeMap[matchedUUID] = scaledRate;
        }
      }
    });
  }

  const tarSummaryRawRate = tarRaw
    ? parseApiField(tarRaw?.summary?.completion_rate_by_value ?? tarRaw?.completion_rate_by_value)
    : null;
  const tarSummaryRate = tarSummaryRawRate !== null ? tarSummaryRawRate * 100 : null;

  const rows = officeActuals?.map((r) => {
    if (r?.status !== 'fulfilled') return null;
    const { uid, officeName, netProduction, totalCollections, newPatients, actualFailures } = r?.value;

    const goals = goalsByOfficeUUID?.[uid] || null;

    // V728D FIX: Use null-safe accumulation — explicit 0 goals are preserved as 0, not dropped
    const productionGoal = goals !== null ? (goals?.production ?? 0) : null;
    const collectionsGoal = goals !== null && goals?.collectionsHasValue ? goals?.collections : null;
    const newPatientsGoal = goals !== null ? (goals?.newPatients ?? 0) : null;

    // Collection rate goal: collectionsGoal / productionGoal × 100
    const collectionRateGoal = (collectionsGoal !== null && productionGoal !== null && productionGoal > 0)
      ? (collectionsGoal / productionGoal) * 100
      : null;

    // Collection rate actual
    const collectionRateActual = (totalCollections !== null && netProduction !== null && netProduction > 0)
      ? (Math.abs(totalCollections) / Math.abs(netProduction)) * 100
      : null;

    // TAR: use by-office map if available, else summary rate for single-office
    const tarPct = tarByOfficeMap?.[uid] !== undefined
      ? tarByOfficeMap?.[uid]
      : (!isAllOffices ? tarSummaryRate : null);

    // V729B: Goals unavailable state — distinguish session/RLS failure from missing data
    const goalsUnavailable = goalsFailureType !== 'success' && goalsFailureType !== 'endpoint_null';
    const goalsSessionWarning = sessionWarning;

    return {
      officeId: uid,
      officeName,
      production: netProduction,
      productionGoal,
      collections: totalCollections,
      collectionsGoal,
      newPatients,
      newPatientsGoal,
      collectionRateGoal,
      collectionRateActual,
      collectionPct: collectionRateActual,
      productionPct: productionGoal > 0 && netProduction !== null ? (netProduction / productionGoal) * 100 : null,
      collectionsPct: collectionsGoal > 0 && totalCollections !== null ? (totalCollections / collectionsGoal) * 100 : null,
      newPatientsPct: newPatientsGoal > 0 && newPatients !== null ? (newPatients / newPatientsGoal) * 100 : null,
      tarPct,
      // V729B: Expose failure context for UI
      goalsFailureType,
      goalsUnavailable,
      goalsSessionWarning,
      actualFailures: actualFailures || {},
    };
  })?.filter(Boolean);

  // V729B: Attach session warning to result for UI display
  return Object.assign(rows, { _goalsFailureType: goalsFailureType, _sessionWarning: sessionWarning });
};

// ─── Fetch 6-Month Trend Data Per Office ─────────────────────────────────────
// V312 — PATCH 4: Rewired from monthly_executive_analytics to Dentrix FastAPI endpoints.
// Each month × each office is fetched from /v2/production/summary and /v2/collections/summary.
// netProduction only — no grossProduction fallback.
// Missing months show null (chart gap), not fake $0.

export const fetchTrendDataPerOffice = async ({ officeIds = [] }) => {
  const months = getLastNMonths(6);

  const OFFICE_UUID_TO_LOCATION_TREND = {
    '220372a5-afae-49c9-8a0c-f4c0717ff352': '14000000000433', // Eatontown
    'b0abcc46-55e8-4529-a28f-eedf41c1d72e': '14000000000432', // Staten Island
    '54626997-57c2-4934-8743-1dabb4d176f4': '14000000000435', // Brick
    '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': '14000000000434', // Barnegat
  };
  const OFFICE_UUID_TO_NAME_TREND = {
    '220372a5-afae-49c9-8a0c-f4c0717ff352': 'Eatontown',
    'b0abcc46-55e8-4529-a28f-eedf41c1d72e': 'Staten Island',
    '54626997-57c2-4934-8743-1dabb4d176f4': 'Brick',
    '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': 'Barnegat',
  };

  const targetUUIDs = officeIds?.length > 0
    ? officeIds?.filter((uid) => OFFICE_UUID_TO_LOCATION_TREND?.[uid])
    : Object.keys(OFFICE_UUID_TO_LOCATION_TREND);

  // Use office names as chart keys (no raw UUIDs in chart data)
  const officeNames = targetUUIDs?.map((uid) => OFFICE_UUID_TO_NAME_TREND?.[uid] || uid);

  // V731B: Fetch per-month TAR data for all 6 months in parallel (all-offices mode).
  // Uses allOffices=true so no locationId needed — one call per month.
  // Yabezy confirmed 6 calls ~2.5s total — acceptable without caching.
  const tarMonthFetches = await Promise.allSettled(
    months?.map(async (m) => {
      const startDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-01`;
      const lastDay = new Date(m?.year, m?.month, 0)?.getDate();
      const endDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
      try {
        const result = await fetchTreatmentPlanCompletion({
          allOffices: true,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
          completionWindowDays: 90,
        });
        return { year: m?.year, month: m?.month, result };
      } catch (err) {
        console.warn(`[fetchTrendDataPerOffice] TAR fetch failed for ${m?.year}-${m?.month}:`, err?.message);
        return { year: m?.year, month: m?.month, result: null };
      }
    })
  );

  // Build TAR lookup: "year-month" → { rate, isMature, warnings }
  const tarMonthMap = {};
  tarMonthFetches?.forEach((r) => {
    if (r?.status !== 'fulfilled') return;
    const { year, month, result } = r?.value;
    const key = `${year}-${month}`;
    if (!result) {
      tarMonthMap[key] = { rate: null, isMature: null, warnings: [] };
      return;
    }
    const rawRate = parseApiField(result?.summary?.completion_rate_by_value ?? result?.completion_rate_by_value);
    const scaledRate = rawRate !== null ? rawRate * 100 : null;
    const isMature = result?.maturity?.is_mature ?? result?.is_mature ?? null;
    const warnings = result?.warnings ?? [];
    tarMonthMap[key] = { rate: scaledRate, isMature, warnings };
  });

  // Fetch all months × all offices in parallel
  const allFetches = await Promise.allSettled(
    targetUUIDs?.flatMap((uid) =>
      months?.map(async (m) => {
        const locId = OFFICE_UUID_TO_LOCATION_TREND?.[uid];
        const officeName = OFFICE_UUID_TO_NAME_TREND?.[uid] || uid;
        const startDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-01`;
        const lastDay = new Date(m?.year, m?.month, 0)?.getDate();
        const endDate = `${m?.year}-${String(m?.month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

        try {
          const [prodResult, collResult, patientsResult] = await Promise.allSettled([
            ascendApi?.getProduction(startDate, endDate, locId),
            ascendApi?.getCollections(startDate, endDate, locId),
            ascendApi?.getPatients(startDate, endDate, locId),
          ]);

          const prodData = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
          const collData = collResult?.status === 'fulfilled' ? collResult?.value : null;
          const patientsData = patientsResult?.status === 'fulfilled' ? patientsResult?.value : null;

          // V312: netProduction only — no grossProduction fallback
          const netProduction = parseApiField(prodData?.netProduction) ?? parseApiField(prodData?.net_production);
          const totalCollections = parseApiField(collData?.totalCollections);
          const newPatients = parseApiField(patientsData?.newPatients);

          return { officeName, year: m?.year, month: m?.month, netProduction, totalCollections, newPatients };
        } catch (err) {
          console.warn(`[fetchTrendDataPerOffice] Failed for ${officeName} ${m?.year}-${m?.month}:`, err);
          return { officeName, year: m?.year, month: m?.month, netProduction: null, totalCollections: null, newPatients: null };
        }
      })
    )
  );

  // Build lookup: officeName → month key → data
  const dataMap = {};
  allFetches?.forEach((r) => {
    if (r?.status !== 'fulfilled') return;
    const { officeName, year, month, netProduction, totalCollections, newPatients } = r?.value;
    const key = `${year}-${month}`;
    if (!dataMap?.[officeName]) dataMap[officeName] = {};
    dataMap[officeName][key] = { netProduction, totalCollections, newPatients };
  });

  // Build chart data: array of { label, [officeName]_production, [officeName]_collections, ..., _tar, _tarIsMature, _tarWarnings }
  const chartData = months?.map((m) => {
    const row = { label: monthLabel(m?.year, m?.month) };
    const key = `${m?.year}-${m?.month}`;
    officeNames?.forEach((name) => {
      const d = dataMap?.[name]?.[key];
      // null = Dentrix unavailable for this month → chart gap (not 0)
      row[`${name}_production`] = d?.netProduction ?? null;
      row[`${name}_collections`] = d?.totalCollections !== null && d?.totalCollections !== undefined
        ? Math.abs(d?.totalCollections) : null;
      row[`${name}_newPatients`] = d?.newPatients ?? null;
      // V731B: TAR — all-offices rate (same value for all office lines in this month)
      const tarEntry = tarMonthMap?.[key];
      row[`${name}_tar`] = tarEntry?.rate ?? null;
    });
    // V731B: Attach TAR maturity metadata per month row for tooltip rendering
    const tarEntry = tarMonthMap?.[key];
    row._tarIsMature = tarEntry?.isMature ?? null;
    row._tarWarnings = tarEntry?.warnings ?? [];
    return row;
  });

  return { chartData, officeNames };
};

// ─── Fetch Hygiene KPI Metrics ────────────────────────────────────────────────

// ─── OFFICE_LIST for multi-office provider API calls ─────────────────────────
// Maps Supabase UUID → Dentrix locationId for per-office provider API calls
const PROVIDER_OFFICE_LOCATION_MAP = {
  '220372a5-afae-49c9-8a0c-f4c0717ff352': '14000000000433', // Eatontown
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': '14000000000432', // Staten Island
  '54626997-57c2-4934-8743-1dabb4d176f4': '14000000000435', // Brick
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': '14000000000434', // Barnegat
};

// Office UUID → display name (no raw UUIDs in UI)
const PROVIDER_OFFICE_NAME_MAP = {
  '220372a5-afae-49c9-8a0c-f4c0717ff352': 'Eatontown',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': 'Staten Island',
  '54626997-57c2-4934-8743-1dabb4d176f4': 'Brick',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': 'Barnegat',
};

// Dentrix locationId → display name
const DENTRIX_LOCATION_NAME_MAP = {
  '14000000000433': 'Eatontown',
  '14000000000432': 'Staten Island',
  '14000000000435': 'Brick',
  '14000000000434': 'Barnegat',
};

/**
 * Normalize a single provider row from the Dentrix provider-performance API.
 * Handles the confirmed live response shape: wrapper object with providers[].
 * Primary production = row.netProduction (NOT grossProduction/production).
 * Primary collections = row.collections.
 *
 * NO SILENT ZERO RULE: Missing/null/undefined Dentrix fields become null, not 0.
 * Only use 0 when the API explicitly returns numeric 0 or "0".
 */
const normalizeProviderRow = (row, fallbackOfficeName) => {
  if (!row) return null;

  // Provider identity
  const providerId = row?.providerId || row?.provider_id || null;
  const providerName = row?.providerName || row?.name || 'Unknown Provider';

  // V728D FIX: Provider type — normalize to lowercase, handle all known variants
  // Backend confirmed values: 'doctor', 'hygienist', 'unattributed'
  // Also handle capitalized variants: 'Doctor', 'Hygienist', 'DOCTOR', 'HYGIENIST'
  // Also handle legacy variants: 'hyg', 'doc', 'dentist', 'hygiene'
  const rawType = (row?.providerType || row?.provider_type || row?.type || '')?.toLowerCase()?.trim();
  let providerType = 'unattributed';
  if (rawType === 'doctor' || rawType === 'doc' || rawType === 'dentist' || rawType === 'dr') {
    providerType = 'doctor';
  } else if (rawType === 'hygienist' || rawType === 'hyg' || rawType === 'hygiene' || rawType === 'rh' || rawType === 'rdh') {
    providerType = 'hygienist';
  }

  // Office resolution — prefer officeName/office, then resolve from locationId/officeId
  const dentrixLocationId = row?.locationId || row?.officeId || null;
  let officeName =
    row?.officeName ||
    row?.office ||
    (dentrixLocationId ? DENTRIX_LOCATION_NAME_MAP?.[dentrixLocationId] : null) ||
    fallbackOfficeName ||
    '—';

  // NO SILENT ZERO: use null when field is missing/null/undefined.
  // Only assign 0 when the API explicitly returned numeric 0.
  const parseApiField = (v) => {
    if (v === null || v === undefined) return null;
    const n = parseFloat(v);
    return isFinite(n) && !isNaN(n) ? n : null;
  };

  // Production — MUST use netProduction. Do NOT use grossProduction/production as net.
  const netProduction = parseApiField(row?.netProduction);
  const grossProduction = parseApiField(row?.grossProduction ?? row?.production);
  const adjustments = parseApiField(row?.adjustments);

  // Collections — use row.collections for provider-level total collections
  const collections = parseApiField(row?.collections);
  const patientCollections = parseApiField(row?.patientCollections);

  // PATCH B — Chair-hour fields from /v2/reports/provider-performance
  // These are new fields added in the V227 backend update.
  // scheduledChairHours = SUM(appointments.duration)/60 WHERE status IN ('COMPLETED','CHAIR')
  // productionPerHour = netProduction ÷ scheduledChairHours (null for unattributed rows)
  // chairHourSource = "scheduled_appointment_duration" (confirmed — no 8-hour assumption)
  const scheduledChairHours = parseApiField(row?.scheduledChairHours);
  const completedAppointmentCount = parseApiField(row?.completedAppointmentCount);
  const chairAppointmentCount = parseApiField(row?.chairAppointmentCount);
  const productionPerHour = parseApiField(row?.productionPerHour);
  const chairHourSource = row?.chairHourSource || null;

  return {
    providerId,
    providerName,
    providerType,
    officeName,
    locationId: dentrixLocationId,
    netProduction,
    grossProduction,
    adjustments,
    collections,
    patientCollections,
    // PATCH B — chair-hour fields passed through from provider-performance
    scheduledChairHours,
    completedAppointmentCount,
    chairAppointmentCount,
    productionPerHour,
    chairHourSource,
    // Non-production fields not available in Dentrix provider-performance payload
    // These remain null — do not invent values from daily_entries without clear label
    newPatients: null,
    txPresented: null,
    txAccepted: null,
    noShows: null,
    patients: null,
  };
};

/**
 * Fetch and normalize Dentrix provider-performance rows for the given date range
 * and office filter.
 *
 * Office filter behavior:
 * - One office selected: call once with that office's Dentrix locationId
 * - Multiple offices selected: call once per locationId, merge rows
 * - No office selected (all offices): call once per known locationId and merge
 *   (avoids all-office aggregate which may lose per-office row detail)
 *
 * Returns { rows: NormalizedProviderRow[], dataSource: 'dentrix' | 'daily_entries_fallback' }
 */
const fetchDentrixProviderRows = async ({ startDate, endDate, officeIds = [] }) => {
  try {
    // Determine which locationIds to query
    let locationEntries = []; // [{ locationId, officeName }]

    if (officeIds?.length === 1) {
      const locId = PROVIDER_OFFICE_LOCATION_MAP?.[officeIds?.[0]];
      const name = PROVIDER_OFFICE_NAME_MAP?.[officeIds?.[0]] || '—';
      if (locId) locationEntries = [{ locationId: locId, officeName: name }];
    } else if (officeIds?.length > 1) {
      locationEntries = officeIds?.map((uid) => ({
          locationId: PROVIDER_OFFICE_LOCATION_MAP?.[uid],
          officeName: PROVIDER_OFFICE_NAME_MAP?.[uid] || '—',
        }))?.filter((e) => e?.locationId);
    } else {
      // All offices — call per locationId to preserve office-level row detail
      locationEntries = Object.entries(PROVIDER_OFFICE_LOCATION_MAP)?.map(([uid, locId]) => ({
        locationId: locId,
        officeName: PROVIDER_OFFICE_NAME_MAP?.[uid] || '—',
      }));
    }

    if (locationEntries?.length === 0) return { rows: [], dataSource: 'dentrix' };

    // Fetch all offices in parallel
    const results = await Promise.all(
      locationEntries?.map(async ({ locationId, officeName }) => {
        try {
          const response = await ascendApi?.getProviderPerformance(startDate, endDate, locationId);

          // Handle confirmed live shape: wrapper object with providers[]
          let providerRows = [];
          // PATCH A — also extract providerTypeMetrics from response.summary if present
          let providerTypeMetrics = null;
          if (response && typeof response === 'object' && !Array.isArray(response)) {
            if (Array.isArray(response?.providers)) {
              providerRows = response?.providers;
            }
            // Extract providerTypeMetrics from summary block
            if (response?.summary?.providerTypeMetrics && typeof response?.summary?.providerTypeMetrics === 'object') {
              providerTypeMetrics = response?.summary?.providerTypeMetrics;
            }
          } else if (Array.isArray(response)) {
            // Defensive: support flat array if API shape changes
            providerRows = response;
          }

          return {
            rows: providerRows?.map((row) => normalizeProviderRow(row, officeName)),
            providerTypeMetrics,
          };
        } catch (err) {
          console.warn(`[fetchDentrixProviderRows] Failed for locationId ${locationId}:`, err);
          return { rows: [], providerTypeMetrics: null };
        }
      })
    );

    const allRows = results?.flatMap((r) => r?.rows || [])?.filter(Boolean);

    // Merge providerTypeMetrics: for all-office or multi-office, use the first non-null result.
    // providerTypeMetrics is a summary block — do not sum/average across offices here;
    // the backend returns an aggregate when locationId is omitted.
    const mergedProviderTypeMetrics = results?.find((r) => r?.providerTypeMetrics != null)?.providerTypeMetrics || null;

    return { rows: allRows, dataSource: 'dentrix', providerTypeMetrics: mergedProviderTypeMetrics };
  } catch (err) {
    console.warn('[fetchDentrixProviderRows] Provider API unavailable:', err);
    return { rows: [], dataSource: 'dentrix_error', providerTypeMetrics: null };
  }
};

export const fetchHygieneKpis = async ({ startDate, endDate, officeIds = [] }) => {
  // ── PRIMARY: Dentrix provider-performance API ──────────────────────────────
  const { rows: dentrixRows, dataSource, providerTypeMetrics } = await fetchDentrixProviderRows({ startDate, endDate, officeIds });

  const hygieneRows = dentrixRows?.filter((r) => r?.providerType === 'hygienist');

  // PATCH A — Extract hygienist providerTypeMetrics fields
  // Source: response.summary.providerTypeMetrics.hygienist from /v2/reports/provider-performance
  // If missing (backend not yet deployed), all fields are null — show N/A, do not crash.
  const ptmHygiene = providerTypeMetrics?.hygienist || null;
  const hygieneCompletedAppointments = ptmHygiene?.completedAppointments != null ? parseApiField(ptmHygiene?.completedAppointments) : null;
  const hygieneTotalAppointmentMinutes = ptmHygiene?.totalAppointmentMinutes != null ? parseApiField(ptmHygiene?.totalAppointmentMinutes) : null;
  const hygieneAvgAppointmentMinutes = ptmHygiene?.avgAppointmentMinutes != null ? parseApiField(ptmHygiene?.avgAppointmentMinutes) : null;
  const hygieneNetProduction = ptmHygiene?.netProduction != null ? parseApiField(ptmHygiene?.netProduction) : null;
  const hygieneProductionPerAppointment = ptmHygiene?.productionPerAppointment != null ? parseApiField(ptmHygiene?.productionPerAppointment) : null;
  // V246 — Active Provider-Day fields from backend (do NOT calculate on frontend)
  // Source: response.summary.providerTypeMetrics.hygienist from /v2/reports/provider-performance
  // activeProviderDays = COUNT DISTINCT(provider_id + appointment_date) where status IN ('COMPLETED','CHAIR')
  // avgProductionPerActiveProviderDay = hygienist netProduction ÷ activeProviderDays (backend-calculated)
  // If missing → null → show N/A. Do NOT fallback to calendar-days × provider-count.
  const hygieneActiveProviderDays = ptmHygiene?.activeProviderDays != null ? parseApiField(ptmHygiene?.activeProviderDays) : null;
  const hygieneAvgProductionPerActiveProviderDay = ptmHygiene?.avgProductionPerActiveProviderDay != null ? parseApiField(ptmHygiene?.avgProductionPerActiveProviderDay) : null;

  // Use Dentrix as primary if we got hygienist rows
  if (hygieneRows?.length > 0) {
    // Sum only confirmed numeric values — null stays null (no silent zero)
    const totalProduction = hygieneRows?.reduce((s, r) => {
      return r?.netProduction !== null ? s + r?.netProduction : s;
    }, 0);
    const uniqueProviders = new Set(hygieneRows.map((r) => r.providerId || r.providerName))?.size || 1;

    // Date range days for avg/day calculation
    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const avgProdPerDay = uniqueDays > 0 ? totalProduction / uniqueDays : null;
    const avgProdPerProviderPerDay = (uniqueDays > 0 && uniqueProviders > 0)
      ? totalProduction / (uniqueDays * uniqueProviders) : null;

    // PATCH B — Avg Production Per Hour
    // Correct rollup: totalNetProduction ÷ totalScheduledChairHours
    // DO NOT average individual productionPerHour values.
    // DO NOT use avgProdPerDay / 8 (8-hour assumption removed).
    // totalScheduledChairHours = sum of rows where scheduledChairHours is confirmed numeric.
    const totalScheduledChairHours = hygieneRows?.reduce((s, r) => {
      return r?.scheduledChairHours !== null ? s + r?.scheduledChairHours : s;
    }, 0);
    // Only compute rollup when totalScheduledChairHours > 0
    const avgProdPerHour = (totalScheduledChairHours > 0)
      ? safeDivide(totalProduction, totalScheduledChairHours)
      : null;

    // Non-production fields not available in Dentrix provider-performance payload
    // Display N/A — do not invent from daily_entries without clear label
    return {
      rows: hygieneRows,
      totalProduction,
      totalPatients: null,       // N/A — not in Dentrix provider-performance payload
      uniqueDays,
      uniqueProviders,
      avgProdPerDay,
      avgProdPerProviderPerDay,
      // V246 — backend active-provider-day fields (null if not yet in payload → N/A)
      activeProviderDays: hygieneActiveProviderDays,
      avgProductionPerActiveProviderDay: hygieneAvgProductionPerActiveProviderDay,
      // PATCH B: avgProdPerHour from scheduledChairHours — no 8-hour assumption
      avgProdPerHour,
      totalScheduledChairHours: totalScheduledChairHours > 0 ? totalScheduledChairHours : null,
      prodPerPatientVisit: null, // N/A — patient count not in payload
      patientVisitsPerDay: null, // N/A
      caseAcceptanceRate: null,  // N/A — tx fields not in payload
      txPlansPerDay: null,       // N/A
      totalTxPresented: null,    // N/A
      totalTxAccepted: null,     // N/A
      // PATCH A — providerTypeMetrics hygienist fields (null if backend not deployed)
      hygieneCompletedAppointments,
      hygieneTotalAppointmentMinutes,
      hygieneAvgAppointmentMinutes,
      hygieneNetProduction,
      hygieneProductionPerAppointment,
      dataSource: 'dentrix_provider_api',
    };
  }

  // ── NO FALLBACK TO daily_entries FOR PRODUCTION ───────────────────────────
  // If Dentrix provider API returns no hygienist rows or errors, return N/A.
  // daily_entries.production must NOT be used as production fallback.
  const isDentrixError = dataSource === 'dentrix_error';
  console.warn('[fetchHygieneKpis] Dentrix returned no hygienist rows — production metrics hidden (no manual fallback)');

  return {
    rows: [],
    totalProduction: null,         // N/A — Dentrix unavailable
    totalPatients: null,
    uniqueDays: null,
    uniqueProviders: null,
    avgProdPerDay: null,           // N/A
    avgProdPerProviderPerDay: null, // N/A
    // V246 — backend active-provider-day fields (null when Dentrix unavailable)
    activeProviderDays: hygieneActiveProviderDays,
    avgProductionPerActiveProviderDay: hygieneAvgProductionPerActiveProviderDay,
    avgProdPerHour: null,          // N/A — no 8-hour fallback
    totalScheduledChairHours: null,
    prodPerPatientVisit: null,     // N/A
    patientVisitsPerDay: null,     // N/A
    caseAcceptanceRate: null,      // N/A
    txPlansPerDay: null,           // N/A
    totalTxPresented: null,        // N/A
    totalTxAccepted: null,         // N/A
    // PATCH A — providerTypeMetrics hygienist fields (null when Dentrix unavailable)
    hygieneCompletedAppointments: hygieneCompletedAppointments,
    hygieneTotalAppointmentMinutes: hygieneTotalAppointmentMinutes,
    hygieneAvgAppointmentMinutes: hygieneAvgAppointmentMinutes,
    hygieneNetProduction: hygieneNetProduction,
    hygieneProductionPerAppointment: hygieneProductionPerAppointment,
    dataSource: isDentrixError ? 'dentrix_unavailable' : 'no_dentrix_provider_data',
  };
};

// ─── Fetch Doctor KPI Metrics ─────────────────────────────────────────────────

export const fetchDoctorKpis = async ({ startDate, endDate, officeIds = [] }) => {
  // ── PRIMARY: Dentrix provider-performance API ──────────────────────────────
  const { rows: dentrixRows, dataSource, providerTypeMetrics } = await fetchDentrixProviderRows({ startDate, endDate, officeIds });

  const doctorRows = dentrixRows?.filter((r) => r?.providerType === 'doctor');

  // PATCH A — Extract doctor providerTypeMetrics fields
  // Source: response.summary.providerTypeMetrics.doctor from /v2/reports/provider-performance
  // If missing (backend not yet deployed in Rocket preview), all fields are null — show N/A, do not crash.
  const ptmDoctor = providerTypeMetrics?.doctor || null;
  const doctorCompletedAppointments = ptmDoctor?.completedAppointments != null ? parseApiField(ptmDoctor?.completedAppointments) : null;
  const doctorTotalAppointmentMinutes = ptmDoctor?.totalAppointmentMinutes != null ? parseApiField(ptmDoctor?.totalAppointmentMinutes) : null;
  const doctorAvgAppointmentMinutes = ptmDoctor?.avgAppointmentMinutes != null ? parseApiField(ptmDoctor?.avgAppointmentMinutes) : null;
  const doctorNetProduction = ptmDoctor?.netProduction != null ? parseApiField(ptmDoctor?.netProduction) : null;
  const doctorProductionPerAppointment = ptmDoctor?.productionPerAppointment != null ? parseApiField(ptmDoctor?.productionPerAppointment) : null;
  // V246 — Active Provider-Day fields from backend (do NOT calculate on frontend)
  // Source: response.summary.providerTypeMetrics.doctor from /v2/reports/provider-performance
  // activeProviderDays = COUNT DISTINCT(provider_id + appointment_date) where status IN ('COMPLETED','CHAIR')
  // avgProductionPerActiveProviderDay = doctor netProduction ÷ activeProviderDays (backend-calculated)
  // If missing → null → show N/A. Do NOT fallback to calendar-days × provider-count.
  const doctorActiveProviderDays = ptmDoctor?.activeProviderDays != null ? parseApiField(ptmDoctor?.activeProviderDays) : null;
  const doctorAvgProductionPerActiveProviderDay = ptmDoctor?.avgProductionPerActiveProviderDay != null ? parseApiField(ptmDoctor?.avgProductionPerActiveProviderDay) : null;

  // Use Dentrix as primary if we got doctor rows
  if (doctorRows?.length > 0) {
    // Sum only confirmed numeric values — null stays null (no silent zero)
    const totalProduction = doctorRows?.reduce((s, r) => {
      return r?.netProduction !== null ? s + r?.netProduction : s;
    }, 0);
    const uniqueProviders = new Set(doctorRows.map((r) => r.providerId || r.providerName))?.size || 1;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const uniqueDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const avgProdPerDay = uniqueDays > 0 ? totalProduction / uniqueDays : null;
    const avgProdPerProviderPerDay = (uniqueDays > 0 && uniqueProviders > 0)
      ? totalProduction / (uniqueDays * uniqueProviders) : null;

    // PATCH B — Avg Production Per Hour
    // Correct rollup: totalNetProduction ÷ totalScheduledChairHours
    // DO NOT average individual productionPerHour values.
    // DO NOT use avgProdPerDay / 8 (8-hour assumption removed).
    const totalScheduledChairHours = doctorRows?.reduce((s, r) => {
      return r?.scheduledChairHours !== null ? s + r?.scheduledChairHours : s;
    }, 0);
    const avgProdPerHour = (totalScheduledChairHours > 0)
      ? safeDivide(totalProduction, totalScheduledChairHours)
      : null;

    // Non-production fields not available in Dentrix provider-performance payload
    return {
      rows: doctorRows,
      totalProduction,
      totalPatients: null,           // N/A — not in Dentrix provider-performance payload
      uniqueDays,
      uniqueProviders,
      avgProdPerDay,
      avgProdPerProviderPerDay,
      // V246 — backend active-provider-day fields (null if not yet in payload → N/A)
      activeProviderDays: doctorActiveProviderDays,
      avgProductionPerActiveProviderDay: doctorAvgProductionPerActiveProviderDay,
      // PATCH B: avgProdPerHour from scheduledChairHours — no 8-hour assumption
      avgProdPerHour,
      totalScheduledChairHours: totalScheduledChairHours > 0 ? totalScheduledChairHours : null,
      prodPerPatientVisit: null,     // N/A
      patientVisitsPerDay: null,     // N/A
      caseAcceptanceRate: null,      // N/A — tx fields not in payload
      caseAcceptanceSameDay: null,   // N/A
      txPlansPerDay: null,           // N/A
      totalTxPresented: null,        // N/A
      totalTxAccepted: null,         // N/A
      totalNoShows: null,            // N/A
      newPtsWithTxPlans: null,       // N/A
      // PATCH A — providerTypeMetrics doctor fields (null if backend not deployed)
      doctorCompletedAppointments,
      doctorTotalAppointmentMinutes,
      doctorAvgAppointmentMinutes,
      doctorNetProduction,
      doctorProductionPerAppointment,
      dataSource: 'dentrix_provider_api',
    };
  }

  // ── NO FALLBACK TO daily_entries FOR PRODUCTION ───────────────────────────
  // If Dentrix provider API returns no doctor rows or errors, return N/A.
  // daily_entries.production must NOT be used as production fallback.
  const isDentrixError = dataSource === 'dentrix_error';
  console.warn('[fetchDoctorKpis] Dentrix returned no doctor rows — production metrics hidden (no manual fallback)');

  return {
    rows: [],
    totalProduction: null,           // N/A — Dentrix unavailable
    totalPatients: null,
    uniqueDays: null,
    uniqueProviders: null,
    avgProdPerDay: null,             // N/A
    avgProdPerProviderPerDay: null,  // N/A
    // V246 — backend active-provider-day fields (null when Dentrix unavailable)
    activeProviderDays: doctorActiveProviderDays,
    avgProductionPerActiveProviderDay: doctorAvgProductionPerActiveProviderDay,
    avgProdPerHour: null,            // N/A — no 8-hour fallback
    totalScheduledChairHours: null,
    prodPerPatientVisit: null,       // N/A
    patientVisitsPerDay: null,       // N/A
    caseAcceptanceRate: null,        // N/A
    caseAcceptanceSameDay: null,     // N/A
    txPlansPerDay: null,             // N/A
    totalTxPresented: null,          // N/A
    totalTxAccepted: null,           // N/A
    totalNoShows: null,              // N/A
    newPtsWithTxPlans: null,         // N/A
    // PATCH A — providerTypeMetrics doctor fields (null when Dentrix unavailable)
    doctorCompletedAppointments: doctorCompletedAppointments,
    doctorTotalAppointmentMinutes: doctorTotalAppointmentMinutes,
    doctorAvgAppointmentMinutes: doctorAvgAppointmentMinutes,
    doctorNetProduction: doctorNetProduction,
    doctorProductionPerAppointment: doctorProductionPerAppointment,
    dataSource: isDentrixError ? 'dentrix_unavailable' : 'no_dentrix_provider_data',
  };
};

// ─── Fetch Providers Heatmap Data ─────────────────────────────────────────────

export const fetchProvidersHeatmap = async ({ startDate, endDate, officeIds = [] }) => {
  // ── PRIMARY: Dentrix provider-performance API ──────────────────────────────
  const { rows: dentrixRows, dataSource, providerTypeMetrics } = await fetchDentrixProviderRows({ startDate, endDate, officeIds });

  if (dentrixRows?.length > 0) {
    // Build result rows from Dentrix normalized rows
    // providerType: doctor | hygienist | unattributed (do NOT merge unattributed)
    const result = dentrixRows?.map((r) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

      // Only calculate derived metrics when numerator is confirmed non-null
      const avgProdPerDay = (r?.netProduction !== null && days > 0) ? r?.netProduction / days : null;

      // PATCH B/C — avgProdPerHour: use row.productionPerHour from provider-performance directly.
      // DO NOT calculate from avgProdPerDay / 8 (8-hour assumption removed).
      // null for unattributed rows (productionPerHour is null when scheduledChairHours is null/0).
      const avgProdPerHour = r?.productionPerHour !== null ? r?.productionPerHour : null;

      // collection % only when both numerator and denominator are confirmed numeric and netProduction > 0
      const collectionPct = (r?.collections !== null && r?.netProduction !== null && r?.netProduction > 0)
        ? (r?.collections / r?.netProduction) * 100 : null;

      return {
        providerId: r?.providerId,
        providerName: r?.providerName,
        providerType: r?.providerType, // doctor | hygienist | unattributed — from Dentrix
        officeName: r?.officeName,     // resolved name, never raw UUID
        production: r?.netProduction,  // PRIMARY: Dentrix netProduction (may be null if API returned null)
        grossProduction: r?.grossProduction, // UCR reference only
        collections: r?.collections,   // Dentrix provider-level collections (null if not returned)
        patientCollections: r?.patientCollections,
        collectionPct,                 // null unless both confirmed numeric
        patients: null,               // N/A — not in payload
        txPresented: null,            // N/A
        txAccepted: null,             // N/A
        noShows: null,                // N/A
        days,
        caseAcceptanceRate: null,     // N/A
        avgProdPerDay,                // null if netProduction is null
        prodPerPatient: null,         // N/A — patient count not in payload
        // PATCH B/C: avgProdPerHour from row.productionPerHour — no 8-hour assumption
        avgProdPerHour,
        // PATCH B/C: chair-hour fields passed through for ProvidersTab display
        scheduledChairHours: r?.scheduledChairHours ?? null,
        completedAppointmentCount: r?.completedAppointmentCount ?? null,
        chairAppointmentCount: r?.chairAppointmentCount ?? null,
        chairHourSource: r?.chairHourSource ?? null,
        // Doctor-specific (N/A from Dentrix provider-performance)
        caseAcceptanceSameDay: null,
        newPtsWithTxPlans: null,
        existingPtsWithTxPlans: null,
        // Hygiene-specific (N/A from Dentrix provider-performance)
        perioPct: null,
        reappointmentPct: null,
        fluoridePct: null,
        dataSource: 'dentrix_provider_api',
      };
    });

    // Unattributed summary for UI warning
    const unattributedRows = result?.filter((r) => r?.providerType === 'unattributed');
    const unattributedCount = unattributedRows?.length;
    const unattributedNetProduction = unattributedRows?.reduce((s, r) => s + (r?.production ?? 0), 0);

    return {
      rows: result,
      unattributedCount,
      unattributedNetProduction,
      dataSource: 'dentrix_provider_api',
    };
  }

  // ── NO FALLBACK TO daily_entries FOR PRODUCTION ───────────────────────────
  // If Dentrix provider API returns no rows or errors, return empty with clear dataSource.
  // daily_entries.production must NOT be used as provider production fallback.
  const isDentrixError = dataSource === 'dentrix_error';
  console.warn('[fetchProvidersHeatmap] Dentrix returned no provider rows — production metrics hidden (no manual fallback)');

  return {
    rows: [],
    unattributedCount: 0,
    unattributedNetProduction: 0,
    dataSource: isDentrixError ? 'dentrix_unavailable' : 'no_dentrix_provider_data',
  };
};

// ─── Build date string from preset ───────────────────────────────────────────

export const buildDateRangeStrings = (preset, customStartDate, customEndDate) => {
  const now = new Date();
  const year = now?.getFullYear();
  const month = now?.getMonth() + 1;

  const pad = (n) => String(n)?.padStart(2, '0');

  const getLastDay = (y, m) => new Date(y, m, 0)?.getDate();

  // Custom date range support
  if (preset === 'custom' && customStartDate && customEndDate && customStartDate <= customEndDate) {
    return { startDate: customStartDate, endDate: customEndDate };
  }

  switch (preset) {
    case 'this_month': {
      const start = `${year}-${pad(month)}-01`;
      const end = `${year}-${pad(month)}-${pad(getLastDay(year, month))}`;
      return { startDate: start, endDate: end };
    }
    case 'last_month': {
      const d = new Date(year, month - 2, 1);
      let y = d?.getFullYear();
      let m = d?.getMonth() + 1;
      const lastDay = new Date(y, m, 0)?.getDate();
      return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${lastDay}` };
    }
    case 'this_quarter': {
      const q = Math.ceil(month / 3);
      const startM = (q - 1) * 3 + 1;
      const endM = q * 3;
      const lastDay = new Date(year, endM, 0)?.getDate();
      return { startDate: `${year}-${pad(startM)}-01`, endDate: `${year}-${pad(endM)}-${lastDay}` };
    }
    case 'ytd':
      return { startDate: `${year}-01-01`, endDate: `${year}-${pad(month)}-${pad(getLastDay(year, month))}` };
    default: {
      const start = `${year}-${pad(month)}-01`;
      const end = `${year}-${pad(month)}-${pad(getLastDay(year, month))}`;
      return { startDate: start, endDate: end };
    }
  }
};

// ─── Fetch Hygiene Retention Metrics ─────────────────────────────────────────
// Source: GET /v2/hygiene/retention-metrics
// V729B: All Locations mode — when officeIds is empty (all offices), omit locationId
// and call the all-office hygiene endpoint. Backend supports this.
export const fetchHygieneRetentionMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;

  // V729B: Multi-office (2+ specific offices selected) — backend does not support multi-ID in one call.
  // Do not average percentages. Return pending state.
  // NOTE: All Locations (officeIds=[]) is handled by omitting locationId — backend aggregates.
  if (officeIds?.length > 1) {
    return {
      data: null,
      endpointAvailable: null,
      multiOfficeAggregationPending: true,
      requiresSingleOffice: true,
      error: null,
    };
  }

  try {
    const result = await ascendApi?.getHygieneRetentionMetrics(startDate, endDate, locationId);
    return {
      data: result || null,
      endpointAvailable: true,
      multiOfficeAggregationPending: false,
      requiresSingleOffice: false,
      error: null,
    };
  } catch (err) {
    console.warn('[fetchHygieneRetentionMetrics] Endpoint unavailable:', err?.message);
    return {
      data: null,
      endpointAvailable: false,
      multiOfficeAggregationPending: false,
      requiresSingleOffice: false,
      error: err?.message || 'Endpoint unavailable',
    };
  }
};

// ─── Fetch Hygiene Procedure Metrics ─────────────────────────────────────────
// Source: GET /v2/hygiene/procedure-metrics
// V729B: All Locations mode — when officeIds is empty (all offices), omit locationId
// and call the all-office hygiene endpoint. Backend supports this.
export const fetchHygieneProcedureMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;

  // V729B: Multi-office (2+ specific offices selected) — cannot aggregate procedure counts safely.
  // NOTE: All Locations (officeIds=[]) is handled by omitting locationId — backend aggregates.
  if (officeIds?.length > 1) {
    return {
      data: null,
      endpointAvailable: null,
      multiOfficePending: true,
      requiresSingleOffice: true,
      error: null,
    };
  }

  try {
    const result = await ascendApi?.getHygieneProcedureMetrics(startDate, endDate, locationId);
    return {
      data: result || null,
      endpointAvailable: true,
      multiOfficePending: false,
      requiresSingleOffice: false,
      error: null,
    };
  } catch (err) {
    console.warn('[fetchHygieneProcedureMetrics] Endpoint unavailable:', err?.message);
    return {
      data: null,
      endpointAvailable: false,
      multiOfficePending: false,
      requiresSingleOffice: false,
      error: err?.message || 'Endpoint unavailable',
    };
  }
};

// ─── Fetch Specialty KPIs (CDT Category Breakdown) ───────────────────────────
// Source: GET /v2/production/by-cdt-category
// No providerId filter — this is the office/period CDT breakdown, not per-provider.
// No manual/EOD fallback. No guessed values. No hardcoded categories.
// Single office → pass Dentrix locationId; all offices → omit locationId.
// Multi-office (2+ specific): call once per office and aggregate by serviceCategory,
//   summing grossProduction, adjustments, netProduction, procedureCount, adaCodeCount.
//   Recalculate percentageOfTotalNetProduction from summed values.
//   Do NOT average percentages.
// If endpoint unavailable → return { data: null, endpointAvailable: false }.
export const fetchSpecialtyKpis = async ({ startDate, endDate, officeIds = [], selectedServiceCategory = null }) => {
  // All offices (0 selected) → omit locationId
  if (officeIds?.length === 0) {
    try {
      const result = await ascendApi?.getProductionByCdtCategory(startDate, endDate, null, {
        serviceCategory: selectedServiceCategory && selectedServiceCategory !== 'all' ? selectedServiceCategory : undefined,
      });
      return {
        data: result || null,
        endpointAvailable: true,
        multiOfficePending: false,
        error: null,
      };
    } catch (err) {
      console.warn('[fetchSpecialtyKpis] Endpoint unavailable (all offices):', err?.message);
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
    }
  }

  // Single office → pass Dentrix locationId
  if (officeIds?.length === 1) {
    const locationId = getLocationIdByOfficeId(officeIds?.[0]);
    try {
      const result = await ascendApi?.getProductionByCdtCategory(startDate, endDate, locationId, {
        serviceCategory: selectedServiceCategory && selectedServiceCategory !== 'all' ? selectedServiceCategory : undefined,
      });
      return {
        data: result || null,
        endpointAvailable: true,
        multiOfficePending: false,
        error: null,
      };
    } catch (err) {
      console.warn('[fetchSpecialtyKpis] Endpoint unavailable (single office):', err?.message);
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
    }
  }

  // Multiple selected offices → call once per office and aggregate
  try {
    const perOfficeResults = await Promise.allSettled(
      officeIds?.map((officeId) => {
        const locationId = getLocationIdByOfficeId(officeId);
        return ascendApi?.getProductionByCdtCategory(startDate, endDate, locationId, {
          serviceCategory: selectedServiceCategory && selectedServiceCategory !== 'all' ? selectedServiceCategory : undefined,
        });
      })
    );

    // Collect successful results
    const successfulResults = perOfficeResults?.filter((r) => r?.status === 'fulfilled' && r?.value?.categories)?.map((r) => r?.value);

    if (successfulResults?.length === 0) {
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: 'All office calls failed' };
    }

    // Aggregate by serviceCategory — sum numerators, do NOT average percentages
    const categoryMap = {};
    let summedTotalNetProduction = 0;
    let summedTotalGrossProduction = 0;
    let summedTotalAdjustments = 0;

    successfulResults?.forEach((res) => {
      summedTotalNetProduction += parseFloat(res?.totalNetProduction ?? 0);
      summedTotalGrossProduction += parseFloat(res?.totalGrossProduction ?? 0);
      summedTotalAdjustments += parseFloat(res?.totalAdjustments ?? 0);

      (res?.categories || [])?.forEach((cat) => {
        const key = cat?.serviceCategory || 'Unknown / Unmapped';
        if (!categoryMap?.[key]) {
          categoryMap[key] = {
            serviceCategory: key,
            adaCodeCount: 0,
            procedureCount: 0,
            grossProduction: 0,
            adjustments: 0,
            netProduction: 0,
          };
        }
        categoryMap[key].adaCodeCount += parseFloat(cat?.adaCodeCount ?? 0);
        categoryMap[key].procedureCount += parseFloat(cat?.procedureCount ?? 0);
        categoryMap[key].grossProduction += parseFloat(cat?.grossProduction ?? 0);
        categoryMap[key].adjustments += parseFloat(cat?.adjustments ?? 0);
        categoryMap[key].netProduction += parseFloat(cat?.netProduction ?? 0);
      });
    });

    // Recalculate percentages from summed values — do NOT average
    const aggregatedCategories = Object.values(categoryMap)?.map((cat) => ({
      ...cat,
      percentageOfTotalNetProduction:
        summedTotalNetProduction > 0
          ? (cat?.netProduction / summedTotalNetProduction) * 100
          : 0,
    }));

    return {
      data: {
        categories: aggregatedCategories,
        totalNetProduction: summedTotalNetProduction,
        totalGrossProduction: summedTotalGrossProduction,
        totalAdjustments: summedTotalAdjustments,
        startDate,
        endDate,
        source: 'multi_office_aggregated',
      },
      endpointAvailable: true,
      multiOfficePending: false,
      error: null,
    };
  } catch (err) {
    console.warn('[fetchSpecialtyKpis] Multi-office aggregation failed:', err?.message);
    return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
  }
};

// ─── Fetch Service Category Filter Options ────────────────────────────────────
// Source: GET /v2/financial/filter-options
// Returns serviceCategories[] and serviceCategoryMapping dynamically from backend.
// Do NOT hardcode category names.
export const fetchServiceCategoryFilterOptions = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;
  try {
    const result = await ascendApi?.getFinancialFilterOptions(startDate, endDate, locationId);
    return {
      data: result || null,
      endpointAvailable: true,
      error: null,
    };
  } catch (err) {
    console.warn('[fetchServiceCategoryFilterOptions] Endpoint unavailable:', err?.message);
    return { data: null, endpointAvailable: false, error: err?.message };
  }
};

// ─── Fetch Specialty Provider KPIs ───────────────────────────────────────────
// Source: GET /v2/production/by-provider-and-cdt-category
// Do NOT use /v2/production/by-cdt-category with providerId filter.
// Do NOT guess provider specialty from names — use backend specialtyGroup/specialtyLabel only.
// No manual/EOD fallback. No guessed values.
// Single office → pass Dentrix locationId; all offices → omit locationId.
// Multi-office (2+ specific): call once per office and merge providers safely,
//   preserving locationId/officeName per provider row so same provider in multiple offices
//   is NOT merged into one row (location is preserved).
// reconciliationDiff when providerType or specialtyGroup filter is active may be expected
//   (excluded providers create a difference) — do not treat as error unless
//   reconciliationNote explicitly says it is a true error.
export const fetchSpecialtyProviderKpis = async ({
  startDate,
  endDate,
  officeIds = [],
  providerType = null,
  specialtyGroup = null,
}) => {
  const callEndpoint = (locationId) =>
    ascendApi?.getProductionByProviderAndCdtCategory(
      startDate,
      endDate,
      locationId,
      providerType && providerType !== 'all' ? providerType : null,
      specialtyGroup && specialtyGroup !== 'all' ? specialtyGroup : null
    );

  // All offices (0 selected) → omit locationId
  if (officeIds?.length === 0) {
    try {
      const result = await callEndpoint(null);
      return {
        data: result || null,
        endpointAvailable: true,
        multiOfficePending: false,
        error: null,
      };
    } catch (err) {
      console.warn('[fetchSpecialtyProviderKpis] Endpoint unavailable (all offices):', err?.message);
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
    }
  }

  // Single office → pass Dentrix locationId
  if (officeIds?.length === 1) {
    const locationId = getLocationIdByOfficeId(officeIds?.[0]);
    try {
      const result = await callEndpoint(locationId);
      return {
        data: result || null,
        endpointAvailable: true,
        multiOfficePending: false,
        error: null,
      };
    } catch (err) {
      console.warn('[fetchSpecialtyProviderKpis] Endpoint unavailable (single office):', err?.message);
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
    }
  }

  // Multiple selected offices → call once per office and merge providers
  // Preserve locationId/officeName per provider row — do NOT merge same provider across offices
  try {
    const perOfficeResults = await Promise.allSettled(
      officeIds?.map((officeId) => {
        const locationId = getLocationIdByOfficeId(officeId);
        return callEndpoint(locationId);
      })
    );

    const successfulResults = perOfficeResults?.filter((r) => r?.status === 'fulfilled' && r?.value)?.map((r) => r?.value);

    if (successfulResults?.length === 0) {
      return { data: null, endpointAvailable: false, multiOfficePending: false, error: 'All office calls failed' };
    }

    // Merge providers — preserve location context, do NOT merge same provider across offices
    const allProviders = [];
    let summedTotalNetProduction = 0;
    let summedTotalGrossProduction = 0;
    let summedTotalAdjustments = 0;

    successfulResults?.forEach((res) => {
      summedTotalNetProduction += parseFloat(res?.totalNetProduction ?? 0);
      summedTotalGrossProduction += parseFloat(res?.totalGrossProduction ?? 0);
      summedTotalAdjustments += parseFloat(res?.totalAdjustments ?? 0);
      (res?.providers || [])?.forEach((p) => allProviders?.push(p));
    });

    return {
      data: {
        providers: allProviders,
        totalNetProduction: summedTotalNetProduction,
        totalGrossProduction: summedTotalGrossProduction,
        totalAdjustments: summedTotalAdjustments,
        startDate,
        endDate,
        source: 'multi_office_merged',
        reconciliationOk: null, // multi-office merge — reconciliation not applicable
        reconciliationNote: 'Multi-office merge: provider-attributed totals summed across selected offices.',
      },
      endpointAvailable: true,
      multiOfficePending: false,
      error: null,
    };
  } catch (err) {
    console.warn('[fetchSpecialtyProviderKpis] Multi-office merge failed:', err?.message);
    return { data: null, endpointAvailable: false, multiOfficePending: false, error: err?.message };
  }
};
