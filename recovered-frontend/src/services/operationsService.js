import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';
import { LOCATION_ID_MAP } from '../constants/offices';
import { fetchAgingReceivablesLive } from './rcmService';

// ─── Helpers ────────────────────────────────────────────────────────────────

export const safeDivide = (n, d) => {
  const num = parseFloat(n);
  const den = parseFloat(d);
  if (!isFinite(num) || !isFinite(den) || den === 0) return null;
  return num / den;
};

export const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

export const fmtPct = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

export const fmtNum = (v) =>
  new Intl.NumberFormat('en-US')?.format(v || 0);

// Build date range from preset string
export const buildDateRange = (preset) => {
  const now = new Date();
  const year = now?.getFullYear();
  const month = now?.getMonth() + 1;

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
    case 'this_year':
      return { startYear: year, startMonth: 1, endYear: year, endMonth: 12 };
    default:
      return { startYear: year, startMonth: month, endYear: year, endMonth: month };
  }
};

// ─── Detect Last Available Period ────────────────────────────────────────────

// Returns { year, month, label } of the most recent month with data in monthly_executive_analytics
export const fetchLastAvailablePeriod = async () => {
  const { data, error } = await supabase
    ?.from('monthly_executive_analytics')
    ?.select('report_year, report_month')
    ?.order('report_year', { ascending: false })
    ?.order('report_month', { ascending: false })
    ?.limit(1);

  if (error || !data || data?.length === 0) return null;

  const row = data?.[0];
  return {
    year: parseInt(row?.report_year),
    month: parseInt(row?.report_month),
    label: monthLabel(parseInt(row?.report_year), parseInt(row?.report_month)),
  };
};

// Filter records by date range
export const filterByDateRange = (records, startYear, startMonth, endYear, endMonth) => {
  return (records || [])?.filter((r) => {
    const rVal = parseInt(r?.report_year) * 100 + parseInt(r?.report_month);
    const startVal = startYear * 100 + startMonth;
    const endVal = endYear * 100 + endMonth;
    return rVal >= startVal && rVal <= endVal;
  });
};

// Get last N months as [{year, month}] — returns last N COMPLETED months only.
// Excludes the current partial month. When today is May 2026, returns Apr 2026 as the most recent.
export const getLastNMonths = (n) => {
  const now = new Date();
  const result = [];
  // Start from last completed month (month - 1), go back n months total
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result?.push({ year: d?.getFullYear(), month: d?.getMonth() + 1 });
  }
  return result;
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthLabel = (year, month) => `${MONTH_NAMES?.[month - 1]} ${year}`;

// ─── Fetch Offices ───────────────────────────────────────────────────────────

export const fetchOffices = async () => {
  const { data, error } = await supabase?.from('offices')?.select('id, name')?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ─── TAB 1: Offices Heatmap ──────────────────────────────────────────────────

// Null-preserving numeric parser for Dentrix API fields.
// null/undefined/missing → null. Real 0 → 0. Valid number → float.
const safeNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
};

const ALL_KNOWN_OFFICE_IDS = Object.keys(LOCATION_ID_MAP);

export const fetchOfficesHeatmap = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0)?.getDate();
  const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

  const targetOfficeIds = officeIds?.length > 0 ? officeIds : ALL_KNOWN_OFFICE_IDS;

  const results = await Promise.allSettled(
    targetOfficeIds?.map(async (officeId) => {
      const locationId = LOCATION_ID_MAP?.[officeId];
      if (!locationId) {
        return {
          office_id: officeId,
          grossProduction: null,
          netProduction: null,
          adjustments: null,
          totalCollections: null,
          newPatients: null,
          activePatients: null,
          uniquePatients: null,
          brokenAppointments: null,
          _apiError: true,
        };
      }

      const [prodResult, collResult, patientsResult] = await Promise.allSettled([
        ascendApi?.getProduction(startDate, endDate, locationId),
        ascendApi?.getCollections(startDate, endDate, locationId),
        ascendApi?.getPatients(startDate, endDate, locationId),
      ]);

      const prodData = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
      const collData = collResult?.status === 'fulfilled' ? collResult?.value : null;
      const patientsData = patientsResult?.status === 'fulfilled' ? patientsResult?.value : null;

      let grossProduction = prodData !== null ? safeNum(prodData?.grossProduction) : null;
      let netProduction = prodData !== null ? safeNum(prodData?.netProduction) : null;
      const adjustments = prodData !== null
        ? (safeNum(prodData?.adjustments) ?? safeNum(prodData?.totalProductionAdjustments) ?? safeNum(prodData?.writeOffs) ?? null)
        : null;
      let totalCollections = collData !== null ? safeNum(collData?.totalCollections) : null;
      let newPatients = patientsData !== null ? safeNum(patientsData?.newPatients) : null;
      let activePatients = patientsData !== null
        ? (safeNum(patientsData?.activePatients) ?? safeNum(patientsData?.uniquePatients) ?? null)
        : null;
      const uniquePatients = patientsData !== null
        ? (safeNum(patientsData?.uniquePatients) ?? safeNum(patientsData?.activePatients) ?? null)
        : null;

      return {
        office_id: officeId,
        grossProduction,
        netProduction,
        adjustments,
        totalCollections,
        newPatients,
        activePatients,
        uniquePatients,
        brokenAppointments: null, // Not fetched in this stage; show N/A
        _apiError: prodResult?.status === 'rejected' && collResult?.status === 'rejected' && patientsResult?.status === 'rejected',
        _partialError: (prodResult?.status === 'rejected' || collResult?.status === 'rejected' || patientsResult?.status === 'rejected')
          && !(prodResult?.status === 'rejected' && collResult?.status === 'rejected' && patientsResult?.status === 'rejected'),
      };
    })
  );

  return results?.filter((r) => r?.status === 'fulfilled')?.map((r) => r?.value);
};

// Fetch prior period data for YoY comparison
export const fetchOfficesHeatmapPrior = async ({ startYear, startMonth, endYear, endMonth, officeIds = [], mode = 'last_year' }) => {
  let pStartYear, pStartMonth, pEndYear, pEndMonth;
  if (mode === 'last_year') {
    pStartYear = startYear - 1;
    pStartMonth = startMonth;
    pEndYear = endYear - 1;
    pEndMonth = endMonth;
  } else {
    // last month — shift back by 1 month
    const startDate = new Date(startYear, startMonth - 2, 1);
    const endDate = new Date(endYear, endMonth - 2, 1);
    pStartYear = startDate?.getFullYear();
    pStartMonth = startDate?.getMonth() + 1;
    pEndYear = endDate?.getFullYear();
    pEndMonth = endDate?.getMonth() + 1;
  }
  return fetchOfficesHeatmap({ startYear: pStartYear, startMonth: pStartMonth, endYear: pEndYear, endMonth: pEndMonth, officeIds });
};

// ─── TAB 2: Production Details ───────────────────────────────────────────────

// Stage 4B-4: Rewired from MEA to Dentrix /v2/reports/provider-performance.
// Doctor production  = sum of netProduction for providerType === 'doctor'
//                      OR providerTypeMetrics.doctor.netProduction if present.
// Hygiene production = sum of netProduction for providerType === 'hygienist'
//                      OR providerTypeMetrics.hygienist.netProduction if present.
// Chair hours        = scheduledChairHours from provider-performance if present, else null.
// No MEA fields used. No 8-hour assumption. No guessed provider types.
// Missing values → null → UI shows N/A.

export const fetchProductionDetails = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0)?.getDate();
  const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

  const targetOfficeIds = officeIds?.length > 0 ? officeIds : ALL_KNOWN_OFFICE_IDS;

  const results = await Promise.allSettled(
    targetOfficeIds?.map(async (officeId) => {
      const locationId = LOCATION_ID_MAP?.[officeId];
      if (!locationId) {
        return {
          office_id: officeId,
          report_year: startYear,
          report_month: startMonth,
          doctor_prod: null,
          hygiene_prod: null,
          production_total: null,
          office_net_production: null,
          unattributed_prod: null,
          scheduledChairHours: null,
          productionPerHour: null,
          _apiError: true,
        };
      }

      // Fetch provider-performance AND office-level net production in parallel
      let providerPerfData = null;
      let officeNetProduction = null;
      try {
        const [ppResult, prodResult] = await Promise.allSettled([
          ascendApi?.getProviderPerformance(startDate, endDate, locationId),
          ascendApi?.getProduction(startDate, endDate, locationId),
        ]);
        if (ppResult?.status === 'fulfilled') providerPerfData = ppResult?.value;
        if (prodResult?.status === 'fulfilled' && prodResult?.value) {
          officeNetProduction = safeNum(prodResult?.value?.netProduction);
        }
      } catch (e) {
        console.warn(`Stage 4B-4: fetch failed for office ${officeId}:`, e);
      }

      // ── Extract doctor/hygiene production ──────────────────────────────
      let doctorProd = null;
      let hygieneProd = null;
      let totalScheduledChairHours = null;
      let totalProductionPerHour = null;

      if (providerPerfData) {
        const summary = providerPerfData?.summary;
        const rows = Array.isArray(providerPerfData?.rows) ? providerPerfData?.rows
          : Array.isArray(providerPerfData?.providers) ? providerPerfData?.providers
          : Array.isArray(providerPerfData?.data) ? providerPerfData?.data
          : null;

        // Strategy 1: providerTypeMetrics (preferred — pre-aggregated by backend)
        const ptm = summary?.providerTypeMetrics;
        if (ptm) {
          const docMetrics = ptm?.doctor ?? ptm?.Doctor ?? null;
          const hygMetrics = ptm?.hygienist ?? ptm?.Hygienist ?? ptm?.hygiene ?? ptm?.Hygiene ?? null;

          if (docMetrics) {
            doctorProd = safeNum(docMetrics?.netProduction);
          }
          if (hygMetrics) {
            hygieneProd = safeNum(hygMetrics?.netProduction);
          }
        }

        // Strategy 2: sum rows by providerType if providerTypeMetrics not available
        if ((doctorProd === null || hygieneProd === null) && rows) {
          let docSum = null;
          let hygSum = null;

          rows?.forEach((row) => {
            const pt = row?.providerType ?? row?.provider_type ?? null;
            if (!pt) return;

            const net = safeNum(row?.netProduction ?? row?.net_production);
            if (net === null) return;

            const ptLower = String(pt)?.toLowerCase();
            if (ptLower === 'doctor' || ptLower === 'dentist') {
              docSum = (docSum ?? 0) + net;
            } else if (ptLower === 'hygienist' || ptLower === 'hygiene') {
              hygSum = (hygSum ?? 0) + net;
            }
          });

          if (doctorProd === null && docSum !== null) doctorProd = docSum;
          if (hygieneProd === null && hygSum !== null) hygieneProd = hygSum;

          // scheduledChairHours — sum from rows if present
          let chairHoursSum = null;
          rows?.forEach((row) => {
            const ch = safeNum(row?.scheduledChairHours ?? row?.scheduled_chair_hours);
            if (ch !== null) {
              chairHoursSum = (chairHoursSum ?? 0) + ch;
            }
          });
          totalScheduledChairHours = chairHoursSum;
        }

        // scheduledChairHours from summary if available
        if (totalScheduledChairHours === null && summary) {
          totalScheduledChairHours = safeNum(summary?.scheduledChairHours ?? summary?.scheduled_chair_hours) ?? null;
        }

        // productionPerHour from summary if available
        if (summary) {
          totalProductionPerHour = safeNum(summary?.productionPerHour ?? summary?.production_per_hour) ?? null;
        }
      }

      // Total production = doctor + hygiene only if both available
      let totalProduction = null;
      if (doctorProd !== null && hygieneProd !== null) {
        totalProduction = doctorProd + hygieneProd;
      } else if (doctorProd !== null) {
        totalProduction = doctorProd;
      } else if (hygieneProd !== null) {
        totalProduction = hygieneProd;
      }

      // Unattributed / Office-Level production:
      // officeNetProduction (from /v2/production/summary) minus provider-attributed (doctor + hygiene)
      // Only compute if office net production is available.
      // If provider totals are null (no provider-performance data), unattributed = null (unknown).
      let unattributedProd = null;
      if (officeNetProduction !== null && totalProduction !== null) {
        const diff = officeNetProduction - totalProduction;
        // Only show as unattributed if positive (rounding tolerance: > -1)
        unattributedProd = diff > -1 ? Math.max(0, diff) : null;
      } else if (officeNetProduction !== null && doctorProd === null && hygieneProd === null) {
        // Provider-performance returned nothing — entire office production is unattributed
        unattributedProd = officeNetProduction;
      }

      return {
        office_id: officeId,
        report_year: startYear,
        report_month: startMonth,
        doctor_prod: doctorProd,
        hygiene_prod: hygieneProd,
        production_total: totalProduction,
        office_net_production: officeNetProduction,
        unattributed_prod: unattributedProd,
        scheduledChairHours: totalScheduledChairHours,
        productionPerHour: totalProductionPerHour,
        _apiError: providerPerfData === null,
      };
    })
  );

  return results
    ?.filter((r) => r?.status === 'fulfilled')
    ?.map((r) => r?.value);
};

// ─── TAB 3: Performance Trends ───────────────────────────────────────────────

// V313 DEPRECATED — fetchPerformanceTrends() is no longer called by PerformanceTab.
// PerformanceTab now fetches trend actuals directly from Dentrix FastAPI per month:
//   /v2/production/summary → netProduction, grossProduction, adjustments
//   /v2/collections/summary → totalCollections
// This function previously queried monthly_executive_analytics for production_total,
// collections_total, adjustments_net, tx_diagnosed_value, tx_accepted_value.
// Those are NOT trusted sources for PerformanceTab actuals.
// This stub is kept only to prevent import errors if referenced elsewhere.
// DO NOT re-wire PerformanceTab to call this function.
export const fetchPerformanceTrends = async ({ officeIds = [] }) => {
  // V313: DEPRECATED — returns empty array. PerformanceTab uses Dentrix FastAPI directly.
  // monthly_executive_analytics is NOT used for PerformanceTab trend actuals.
  console.warn('fetchPerformanceTrends: DEPRECATED — PerformanceTab no longer calls this function. Returning []. Use Dentrix FastAPI per-month calls instead.');
  return [];
};

// ─── TAB 4: Providers ────────────────────────────────────────────────────────
// Stage 2A: fetchProvidersData no longer used by ProvidersTab.
// ProvidersTab now calls ascendApi.getProviderPerformance directly.
// This function is kept as a stub to avoid import errors in case other
// consumers reference it, but it returns an empty array.

export const fetchProvidersData = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  // Stage 2A: daily_entries.production removed as provider production source.
  // ProvidersTab wires directly to Dentrix /v2/reports/provider-performance.
  // This stub returns [] to prevent crashes if called from other locations.
  return [];
};

// ─── TAB 5: Trends ───────────────────────────────────────────────────────────

export const fetchTrendsData = async ({ officeIds = [] }) => {
  const months = getLastNMonths(12);
  const minYear = months?.[0]?.year;

  let query = supabase?.from('monthly_executive_analytics')?.select(`
      office_id,
      report_month,
      report_year,
      production_total,
      collections_total,
      new_patients,
      broken_appointments
    `)?.gte('report_year', minYear)?.order('report_year', { ascending: true })?.order('report_month', { ascending: true });

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const minVal = months?.[0]?.year * 100 + months?.[0]?.month;
  return (data || [])?.filter((r) => parseInt(r?.report_year) * 100 + parseInt(r?.report_month) >= minVal);
};

// ─── TAB 6: Cancellations ────────────────────────────────────────────────────
// Stage 2A: fetchCancellationsData no longer used by CancellationsTab.
// CancellationsTab now calls ascendApi.getAppointmentsSummary directly.
// This stub is kept to avoid import errors.

export const fetchCancellationsData = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  // Stage 2A: daily_entries.no_shows removed as appointment/no-show source.
  // CancellationsTab wires directly to Dentrix /v2/appointments/summary.
  // This stub returns [] to prevent crashes if called from other locations.
  return [];
};

// ─── TAB 7: AR Aging ─────────────────────────────────────────────────────────

// V314: fetchARAgingData now delegates to fetchAgingReceivablesLive()
// (GET /v2/rcm/aging-receivables-live) — the same reconciled Dentrix Aged
// Receivables snapshot used by PayorsTab Section 1.
//
// REMOVED: monthly_executive_analytics ar_current / ar_30_60 / ar_60_90 /
//          ar_90_plus / outstanding_claims_value — these were MEA fields and
//          are NOT acceptable as true AR Aging values.
//
// The dateRange parameters are accepted for API compatibility but
// the /v2/rcm/aging-receivables-live endpoint returns a point-in-time snapshot
// (not a date-filtered range). The snapshot includes snapshotDate / lastSyncedAt
// so the UI can display the as-of date.
//
// Returns the raw snapshot payload from fetchAgingReceivablesLive().
// Throws on network/API failure — ARAgingTab handles the error state.
export const fetchARAgingData = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] } = {}) => {
  // V314: delegate to the already-wired reconciled AR snapshot source.
  // Do NOT fall back to monthly_executive_analytics.
  // Do NOT reconstruct AR from /v2/rcm/claims.
  // Do NOT use daily_entries or manual/EOD data.
  return await fetchAgingReceivablesLive({ officeIds });
};

// ─── TAB 8: Marketing ────────────────────────────────────────────────────────

// DEPRECATED (Stage 5B-B): fetchMarketingData used MEA marketing_spend / new_patients.
// Kept as a no-op stub in case any other caller references it.
// MarketingTab now uses fetchMarketingAdSpendFromAmex + fetchMarketingNewPatients.
export const fetchMarketingData = async () => [];

/**
 * fetchAmexSyncStatus
 * Returns the most recent AmEx/Plaid sync timestamp from:
 *   1. amex_sync_logs (if populated by server-side Plaid sync)
 *   2. Latest updated_at / created_at from expenses table (amex_api or amex_statement_import)
 *   3. Latest posted_date from expenses table
 *
 * Returns { lastSyncAt: Date | null, source: string }
 */
export const fetchAmexSyncStatus = async () => {
  // 1. Try amex_sync_logs first (populated by server-side plaid_sync.py)
  try {
    const { data: logData } = await supabase
      ?.from('amex_sync_logs')
      ?.select('notes, completed_at, status, error_details')
      ?.order('completed_at', { ascending: false })
      ?.limit(1);

    if (logData && logData?.length > 0 && logData?.[0]?.completed_at) {
      const row = logData?.[0];
      return {
        lastSyncAt: new Date(row.completed_at),
        completedAt: new Date(row.completed_at),
        notes: row?.notes || null,
        status: row?.status || null,
        errorDetails: row?.error_details || null,
        source: 'amex_sync_logs',
      };
    }
  } catch (_) { /* fall through */ }

  // 2. Try latest updated_at from expenses table (amex source types)
  try {
    const { data: expData } = await supabase
      ?.from('expenses')
      ?.select('updated_at, created_at')
      ?.in('source_type', ['amex_api', 'amex_statement_import'])
      ?.order('updated_at', { ascending: false })
      ?.limit(1);

    if (expData && expData?.length > 0) {
      const ts = expData?.[0]?.updated_at || expData?.[0]?.created_at;
      if (ts) return { lastSyncAt: new Date(ts), completedAt: new Date(ts), notes: null, status: null, errorDetails: null, source: 'expenses.updated_at' };
    }
  } catch (_) { /* fall through */ }

  return { lastSyncAt: null, completedAt: null, notes: null, status: null, errorDetails: null, source: null };
};

/**
 * fetchMarketingAdSpendFromAmex
 *
 * Calls the backend source-of-truth endpoint:
 *   GET https://api.nudashboard.com/v2/marketing/amex-spend
 *
 * Parameters:
 *   startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 *   locationId (optional, only when single office selected)
 *
 * Returns array of:
 *   { officeId, officeName, year, month, googleSpend, facebookSpend, tntDentalSpend,
 *     creditAdjustment, spend, reviewCount }
 * grouped by office + month.
 *
 * NOTE: Direct expenses-table classification is no longer used for MarketingTab spend.
 *
 * @param {{ startYear, startMonth, endYear, endMonth, officeIds? }} params
 */
export const fetchMarketingAdSpendFromAmex = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0)?.getDate();
  const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

  const params = new URLSearchParams({ startDate, endDate });

  // Pass locationId only when exactly one office is selected
  if (officeIds?.length === 1) {
    params?.set('locationId', officeIds?.[0]);
  }

  const url = `https://api.nudashboard.com/v2/marketing/amex-spend?${params?.toString()}`;

  const response = await fetch(url);
  if (!response?.ok) {
    throw new Error(`Backend marketing endpoint returned ${response.status}: ${response.statusText}`);
  }

  const json = await response?.json();

  // ── Resolve raw rows from all known response shapes ──────────────────────
  // Supports: top-level array, { offices: [...] }, { data: [...] },
  //           { results: [...] }, { rows: [...] }
  // Totals-only objects (no array) are handled separately below.
  let rawRows = [];
  if (Array.isArray(json)) {
    rawRows = json;
  } else if (Array.isArray(json?.offices)) {
    rawRows = json?.offices;
  } else if (Array.isArray(json?.data)) {
    rawRows = json?.data;
  } else if (Array.isArray(json?.results)) {
    rawRows = json?.results;
  } else if (Array.isArray(json?.rows)) {
    rawRows = json?.rows;
  }
  // If json is a non-array object with no array property, it may be a single office row
  // or a totals-only object — handled below.

  // ── UUID → canonical name reverse map (name → UUID) ──────────────────────
  // Used to resolve officeName strings back to known UUIDs when the endpoint
  // does not return UUIDs.
  const NAME_TO_UUID = {
    'Eatontown':    '220372a5-afae-49c9-8a0c-f4c0717ff352',
    'Staten Island':'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
    'Brick':        '54626997-57c2-4934-8743-1dabb4d176f4',
    'Barnegat':     '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
  };

  // ── Aggregate/totals row detection ───────────────────────────────────────
  // Rows that represent grand totals or unknown aggregates must NOT appear
  // as office detail rows. Detect them by name.
  const AGGREGATE_NAMES = new Set([
    'unknown office', 'unknown', 'all offices', 'all', 'total', 'grand total',
    'totals', 'aggregate', '', 'null', 'undefined', 'n/a', 'none',
  ]);

  const _isAggregateRow = (row) => {
    const rawName = (
      row?.officeName ?? row?.office_name ?? row?.name ??
      row?.locationName ?? row?.location_name ?? ''
    );
    if (!rawName) return true;
    const lower = String(rawName)?.trim()?.toLowerCase();
    return AGGREGATE_NAMES?.has(lower);
  };

  // ── Resolve officeId from a row ───────────────────────────────────────────
  // Priority: explicit UUID fields → name-based UUID lookup → null
  const _resolveOfficeId = (row) => {
    // Try explicit UUID fields first
    const explicit = row?.officeId ?? row?.office_id ?? row?.locationId ?? row?.location_id ?? null;
    if (explicit && NAME_TO_UUID?.[explicit] === undefined && explicit?.includes('-')) {
      // Looks like a UUID — use it directly
      return explicit;
    }
    // Try name-based lookup
    const rawName = (
      row?.officeName ?? row?.office_name ?? row?.name ??
      row?.locationName ?? row?.location_name ?? null
    );
    if (rawName) {
      // Try direct canonical name match
      if (NAME_TO_UUID?.[rawName]) return NAME_TO_UUID?.[rawName];
      // Try case-insensitive match
      const lower = String(rawName)?.trim()?.toLowerCase();
      for (const [canonical, uuid] of Object.entries(NAME_TO_UUID)) {
        if (canonical?.toLowerCase() === lower) return uuid;
        if (lower?.includes(canonical?.toLowerCase())) return uuid;
      }
    }
    // Try explicit field if it's a UUID we didn't recognize above
    if (explicit) return explicit;
    return null;
  };

  // ── Resolve canonical office name from a row ──────────────────────────────
  const _resolveOfficeName = (row, resolvedId) => {
    // If we resolved a UUID, use the canonical name from our map
    if (resolvedId && NAME_TO_UUID) {
      for (const [name, uuid] of Object.entries(NAME_TO_UUID)) {
        if (uuid === resolvedId) return name;
      }
    }
    // Fall back to raw name fields
    return (
      row?.officeName ?? row?.office_name ?? row?.name ??
      row?.locationName ?? row?.location_name ?? null
    );
  };

  const results = [];

  rawRows?.forEach((row) => {
    // Skip aggregate/totals rows — they must not appear as office detail rows
    if (_isAggregateRow(row)) {
      console.log('[MarketingTab] Skipping aggregate row:', row?.officeName ?? row?.office_name ?? row?.name);
      return;
    }

    // Resolve office identity
    const officeId = _resolveOfficeId(row);
    const officeName = _resolveOfficeName(row, officeId);

    // If we still can't identify the office, skip it
    if (!officeId && !officeName) {
      console.warn('[MarketingTab] Could not resolve office identity for row:', row);
      return;
    }

    // Resolve period — endpoint may return year/month or derive from startDate
    const rowYear = row?.year ?? row?.report_year ?? startYear;
    const rowMonth = row?.month ?? row?.report_month ?? row?.period ?? startMonth;

    // Spend fields — support camelCase, snake_case, and short forms
    const googleSpend = _parseSpend(
      row?.googleSpend ?? row?.google_spend ?? row?.google ?? row?.Google
    );
    const facebookSpend = _parseSpend(
      row?.facebookSpend ?? row?.facebook_spend ?? row?.facebook ?? row?.Facebook
    );
    const tntDentalSpend = _parseSpend(
      row?.tntDentalSpend ?? row?.tnt_dental_spend ?? row?.tnt_dental ??
      row?.tntDental ?? row?.TNTDental ?? row?.tnt
    );
    const creditAdjustment = _parseSpend(
      row?.creditAdjustment ?? row?.credit_adj ?? row?.credit_adjustment ??
      row?.creditAdj ?? row?.credits
    );

    // Total: use endpoint-provided total if available, otherwise sum components
    let spend = _parseSpend(
      row?.totalMarketingSpend ?? row?.total_marketing_spend ??
      row?.totalSpend ?? row?.total_spend ?? row?.total ?? row?.spend
    );
    if (spend === null) {
      // Calculate from components
      const parts = [googleSpend, facebookSpend, tntDentalSpend];
      const validParts = parts?.filter((v) => v !== null);
      if (validParts?.length > 0) {
        spend = validParts?.reduce((acc, v) => acc + v, 0);
        // Add credit adjustment if present (credits are typically negative)
        if (creditAdjustment !== null) spend += creditAdjustment;
      }
    }

    results?.push({
      officeId,
      officeName,
      year: parseInt(rowYear),
      month: parseInt(rowMonth),
      googleSpend,
      facebookSpend,
      tntDentalSpend,
      creditAdjustment,
      spend,
      reviewCount: 0,
    });
  });

  // Diagnostic log
  console.log(`[MarketingTab] /v2/marketing/amex-spend → ${rawRows?.length} raw rows → ${results?.length} office rows after filtering`);
  if (results?.length > 0) {
    console.log('[MarketingTab] Resolved offices:', results?.map((r) => `${r?.officeName} (${r?.officeId?.slice(0, 8)}...) spend=$${r?.spend}`));
  }

  return results;
};

/**
 * _parseSpend — internal helper to safely parse a spend value from the endpoint.
 * Returns null for missing/non-finite values. Real 0 returns 0.
 */
const _parseSpend = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
};

/**
 * fetchMarketingNewPatients
 *
 * Fetches new patients per office per month from Dentrix Ascend API.
 * Uses ascendApi.getPatients(startDate, endDate, locationId) → newPatients field.
 *
 * Returns array of { officeId, officeName, year, month, newPatients }
 *
 * @param {{ startYear, startMonth, endYear, endMonth, officeIds? }} params
 */
export const fetchMarketingNewPatients = async ({ startYear, startMonth, endYear, endMonth, officeIds = [] }) => {
  const targetOfficeIds = officeIds?.length > 0
    ? officeIds
    : Object.keys(LOCATION_ID_MAP);

  const results = [];

  // Iterate month by month for each office
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 1;
    const mEnd = y === endYear ? endMonth : 12;

    for (let m = mStart; m <= mEnd; m++) {
      const startDate = `${y}-${String(m)?.padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0)?.getDate();
      const endDate = `${y}-${String(m)?.padStart(2, '0')}-${lastDay}`;

      await Promise.allSettled(
        targetOfficeIds?.map(async (officeId) => {
          const locationId = LOCATION_ID_MAP?.[officeId];
          if (!locationId) return;

          try {
            const patientsData = await ascendApi?.getPatients(startDate, endDate, locationId);
            const np = patientsData?.newPatients;
            // null/undefined → null (N/A). Real 0 → 0.
            let newPatients = (np === null || np === undefined) ? null : parseFloat(np);
            const safeNP = (newPatients !== null && isFinite(newPatients)) ? newPatients : null;

            results?.push({
              officeId,
              officeName: null, // resolved in MarketingTab via resolveOfficeName
              year: y,
              month: m,
              newPatients: safeNP,
            });
          } catch (_) {
            // API error for this office/month → null (N/A), not 0
            results?.push({
              officeId,
              officeName: null,
              year: y,
              month: m,
              newPatients: null,
            });
          }
        })
      );
    }
  }

  return results;
};

// ─── TAB 9: Scorecards ───────────────────────────────────────────────────────

export const fetchScorecardData = async ({ year, month, officeIds = [] }) => {
  // ── 1. Determine which offices to fetch ──────────────────────────────────
  const targetOfficeIds = officeIds?.length > 0 ? officeIds : ALL_KNOWN_OFFICE_IDS;

  // ── 2. Build correct month date range ────────────────────────────────────
  //    Use new Date(year, month, 0).getDate() for true last day — handles
  //    February, leap years, 30-day months correctly.
  const paddedMonth = String(month)?.padStart(2, '0');
  const lastDay = new Date(year, month, 0)?.getDate();
  const startDate = `${year}-${paddedMonth}-01`;
  const endDate = `${year}-${paddedMonth}-${String(lastDay)?.padStart(2, '0')}`;

  // ── 3. Goals data — unchanged, from office_goals ─────────────────────────
  const monthYear = `${year}-${paddedMonth}`;
  let goalsQuery = supabase
    ?.from('office_goals')
    ?.select('office_id, monthly_target, production_goal, collections_goal, new_patients_goal')
    ?.eq('month_year', monthYear);

  if (targetOfficeIds?.length > 0) {
    goalsQuery = goalsQuery?.in('office_id', targetOfficeIds);
  }

  const { data: goalsData, error: goalsErr } = await goalsQuery;
  if (goalsErr) console.warn('Goals fetch error (Stage 4B-1):', goalsErr);

  const goalsMap = {};
  (goalsData || [])?.forEach((g) => {
    goalsMap[g.office_id] = g;
  });

  // ── 4. Fetch Dentrix actuals per office via Promise.allSettled ────────────
  //    Each office gets three independent API calls:
  //      - /v2/production/summary  → netProduction, grossProduction, adjustments
  //      - /v2/collections/summary → totalCollections
  //      - /v2/patients/summary    → newPatients, activePatients
  //
  //    If any individual call fails → null for that office's affected fields.
  //    Other offices remain visible.

  const officeResults = await Promise.allSettled(
    targetOfficeIds?.map(async (officeId) => {
      const locationId = LOCATION_ID_MAP?.[officeId] || null;

      // Stage 4B-4: Fetch four endpoints in parallel per office
      // Added: provider-performance for doctor/hygiene split
      const [prodResult, collResult, patientsResult, provPerfResult] = await Promise.allSettled([
        ascendApi?.getProduction(startDate, endDate, locationId),
        ascendApi?.getCollections(startDate, endDate, locationId),
        ascendApi?.getPatients(startDate, endDate, locationId),
        ascendApi?.getProviderPerformance(startDate, endDate, locationId),
      ]);

      // Production fields — null on failure or missing field
      let netProduction = null;
      let grossProduction = null;
      let productionAdjustments = null;

      if (prodResult?.status === 'fulfilled' && prodResult?.value) {
        const p = prodResult?.value;
        netProduction = safeNum(p?.netProduction);
        grossProduction = safeNum(p?.grossProduction);
        // Prefer explicit adjustments field; fall back to totalProductionAdjustments or writeOffs
        productionAdjustments = safeNum(p?.adjustments) ?? safeNum(p?.totalProductionAdjustments) ?? safeNum(p?.writeOffs) ?? null;
      }

      // Collections fields — null on failure or missing field
      let totalCollections = null;

      if (collResult?.status === 'fulfilled' && collResult?.value) {
        const c = collResult?.value;
        totalCollections = safeNum(c?.totalCollections);
      }

      // Patient fields — null on failure or missing field
      let newPatients = null;
      let activePatients = null;

      if (patientsResult?.status === 'fulfilled' && patientsResult?.value) {
        const pt = patientsResult?.value;
        newPatients = safeNum(pt?.newPatients);
        // Dentrix may return activePatients or uniquePatients — prefer activePatients
        activePatients = safeNum(pt?.activePatients) ?? safeNum(pt?.uniquePatients) ?? null;
      }

      // Stage 4B-4: Doctor/Hygiene split from provider-performance
      // Use providerTypeMetrics (preferred) or sum rows by providerType.
      // Never guess providerType from name. null if not safely available.
      let doctorSplit = null;
      let hygieneSplit = null;

      if (provPerfResult?.status === 'fulfilled' && provPerfResult?.value) {
        const ppData = provPerfResult?.value;
        const ppSummary = ppData?.summary;
        const ppRows = Array.isArray(ppData?.rows) ? ppData?.rows
          : Array.isArray(ppData?.providers) ? ppData?.providers
          : Array.isArray(ppData?.data) ? ppData?.data
          : null;

        // Strategy 1: providerTypeMetrics (pre-aggregated by backend — preferred)
        const ptm = ppSummary?.providerTypeMetrics;
        if (ptm) {
          const docMetrics = ptm?.doctor ?? ptm?.Doctor ?? null;
          const hygMetrics = ptm?.hygienist ?? ptm?.Hygienist ?? ptm?.hygiene ?? ptm?.Hygiene ?? null;
          if (docMetrics) doctorSplit = safeNum(docMetrics?.netProduction);
          if (hygMetrics) hygieneSplit = safeNum(hygMetrics?.netProduction);
        }

        // Strategy 2: sum rows by providerType if providerTypeMetrics not available
        if ((doctorSplit === null || hygieneSplit === null) && ppRows) {
          let docSum = null;
          let hygSum = null;
          ppRows?.forEach((row) => {
            const pt = row?.providerType ?? row?.provider_type ?? null;
            if (!pt) return; // skip rows with no backend-provided providerType
            const net = safeNum(row?.netProduction ?? row?.net_production);
            if (net === null) return;
            const ptLower = String(pt)?.toLowerCase();
            if (ptLower === 'doctor' || ptLower === 'dentist') {
              docSum = (docSum ?? 0) + net;
            } else if (ptLower === 'hygienist' || ptLower === 'hygiene') {
              hygSum = (hygSum ?? 0) + net;
            }
          });
          if (doctorSplit === null && docSum !== null) doctorSplit = docSum;
          if (hygieneSplit === null && hygSum !== null) hygieneSplit = hygSum;
        }
      }

      return {
        office_id: officeId,
        // Dentrix actuals
        netProduction,
        grossProduction,
        productionAdjustments,
        totalCollections,
        newPatients,
        activePatients,
        // Stage 4B-4: doctor/hygiene split from provider-performance
        doctorSplit,
        hygieneSplit,
      };
    })
  );

  // ── 5. Build scorecard rows ───────────────────────────────────────────────

  const getBadge = (actual, goal, threshold = 0.9, warnThreshold = 0.75) => {
    if (actual === null || actual === undefined || !goal) return null;
    const pct = actual / goal;
    if (pct >= threshold) return 'PASS';
    if (pct >= warnThreshold) return 'WARN';
    return 'FAIL';
  };

  const getBenchmarkBadge = (actual, benchmark) => {
    if (actual === null || actual === undefined) return null;
    if (actual >= benchmark) return 'PASS';
    if (actual >= benchmark * 0.85) return 'WARN';
    return 'FAIL';
  };

  const rows = [];

  officeResults?.forEach((result, idx) => {
    const officeId = targetOfficeIds?.[idx];

    // If the entire per-office fetch settled as rejected, all actuals are null
    let dentrixData = {
      office_id: officeId,
      netProduction: null,
      grossProduction: null,
      productionAdjustments: null,
      totalCollections: null,
      newPatients: null,
      activePatients: null,
      doctorSplit: null,
      hygieneSplit: null,
    };

    if (result?.status === 'fulfilled' && result?.value) {
      dentrixData = result?.value;
    } else if (result?.status === 'rejected') {
      console.warn(`Stage 4B-1: Dentrix fetch failed for office ${officeId}:`, result?.reason);
    }

    // ── Goals (unchanged from office_goals) ──────────────────────────────
    const goals = goalsMap?.[officeId] || {};

    // production_goal is primary; monthly_target is backward-compat only
    const rawProdGoal = goals?.production_goal ?? goals?.monthly_target ?? null;
    const prodGoal = rawProdGoal !== null && rawProdGoal !== undefined ? parseFloat(rawProdGoal) : null;

    // Stage 3A rule: preserve null collection goal — do NOT convert null to 0
    const rawCollGoal = goals?.collections_goal;
    const collGoal = rawCollGoal !== null && rawCollGoal !== undefined ? parseFloat(rawCollGoal) : null;

    const rawNpGoal = goals?.new_patients_goal;
    const npGoal = rawNpGoal !== null && rawNpGoal !== undefined ? parseInt(rawNpGoal) : null;

    // ── Dentrix actuals ───────────────────────────────────────────────────
    const netProd = dentrixData?.netProduction;       // null if unavailable
    const ucrFee = dentrixData?.grossProduction;      // null if unavailable
    const prodAdj = dentrixData?.productionAdjustments; // null if unavailable
    const coll = dentrixData?.totalCollections;       // null if unavailable
    const np = dentrixData?.newPatients;              // null if unavailable

    // ── Derived metrics ───────────────────────────────────────────────────

    // Collection Rate = actual collections ÷ net production × 100
    // Never use UCR/gross as denominator.
    // null if either value is null or net production is 0.
    const collRate = (coll !== null && netProd !== null && netProd > 0)
      ? (coll / netProd) * 100
      : null;

    // Production Goal %: net production ÷ production_goal × 100
    // null if goal is null/0 or actual is null
    const prodPct = (netProd !== null && prodGoal !== null && prodGoal > 0)
      ? (netProd / prodGoal) * 100
      : null;

    // Collections Goal %: collections ÷ collections_goal × 100
    // null if goal is null (preserves NULL collection goal → N/A)
    const collPct = (coll !== null && collGoal !== null && collGoal > 0)
      ? (coll / collGoal) * 100
      : null;

    // New Patients Goal %
    const npPct = (np !== null && npGoal !== null && npGoal > 0)
      ? (np / npGoal) * 100
      : null;

    // Adj % of UCR — only if both values available
    const adjPct = (prodAdj !== null && ucrFee !== null && ucrFee > 0)
      ? (Math.abs(prodAdj) / ucrFee) * 100
      : null;

    // Hygiene/Doctor split — Stage 4B-4: from Dentrix provider-performance providerTypeMetrics
    // or summed providerType rows. null if not safely available.
    // FIX V274: Convert raw dollar amounts to percentage of total production.
    // hygieneSplit and doctorSplit are raw dollar values from provider-performance.
    // Display as % of (hygiene + doctor) total — not as raw dollars formatted as %.
    let hygieneSplitPct = null;
    let doctorSplitPct = null;
    const rawHygiene = dentrixData?.hygieneSplit ?? null;
    const rawDoctor = dentrixData?.doctorSplit ?? null;
    if (rawHygiene !== null && rawDoctor !== null) {
      const splitTotal = rawHygiene + rawDoctor;
      if (splitTotal > 0) {
        hygieneSplitPct = (rawHygiene / splitTotal) * 100;
        doctorSplitPct = (rawDoctor / splitTotal) * 100;
      }
    } else if (rawHygiene !== null && rawDoctor === null) {
      // Only hygiene available — cannot compute split without both
      hygieneSplitPct = null;
      doctorSplitPct = null;
    } else if (rawDoctor !== null && rawHygiene === null) {
      hygieneSplitPct = null;
      doctorSplitPct = null;
    }

    // Case acceptance and chair utilization — no trusted Dentrix source yet
    const caseAcceptance = null;
    const utilization = null;

    rows?.push({
      office_id: officeId,
      report_month: month,
      report_year: year,
      // Explicit breakdown fields for scorecard display
      ucr_fee: ucrFee,
      net_production: netProd,
      production_adjustment: prodAdj,
      write_offs: null, // not separately available from /v2/production/summary in this stage
      // Scorecard metric objects
      production: {
        actual: netProd,
        goal: prodGoal,
        pct: prodPct,
        badge: getBadge(netProd, prodGoal),
        ucr: ucrFee,
        adjustment: prodAdj,
      },
      // Stage 3A rule preserved: collGoal null → N/A, not $0
      collections: {
        actual: coll,
        goal: collGoal,
        pct: collPct,
        badge: getBadge(coll, collGoal),
      },
      new_patients: {
        actual: np,
        goal: npGoal,
        pct: npPct,
        badge: getBadge(np, npGoal),
      },
      // Stage 3A rule preserved: collRate uses net production as denominator
      collection_rate: {
        actual: collRate,
        benchmark: 92,
        badge: getBenchmarkBadge(collRate, 92),
      },
      // Blocked metrics — no trusted source yet
      case_acceptance: { actual: caseAcceptance, benchmark: 65, badge: null },
      utilization: { actual: utilization, benchmark: 85, badge: null },
      adj_pct: adjPct,
      // V274 fix: hygiene_split and doctor_split are now percentages (0-100), not raw dollars
      hygiene_split: hygieneSplitPct,
      doctor_split: doctorSplitPct,
    });
  });

  return rows;
};

// ─── CSV Export ──────────────────────────────────────────────────────────────

export const exportToCSV = (rows, filename = 'export.csv') => {
  if (!rows || rows?.length === 0) return;
  const headers = Object.keys(rows?.[0]);
  const csvContent = [
    headers?.join(','),
    ...rows?.map((r) =>
      headers?.map((h) => {
        const val = r?.[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str?.includes(',') ? `"${str}"` : str;
      })?.join(',')
    ),
  ]?.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a?.click();
  URL.revokeObjectURL(url);
};
