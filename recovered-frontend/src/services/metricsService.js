/**
 * metricsService.js
 * ══════════════════════════════════════════════════════════════════════════════
 * CANONICAL METRIC LAYER — SINGLE SOURCE OF TRUTH
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * All shared business metrics are calculated ONCE here and reused everywhere.
 *
 * Source-of-truth decisions:
 * ─────────────────────────────────────────────────────────────────────────────
 * | Metric                  | Source                        | Reason           |
 * |-------------------------|-------------------------------|------------------|
 * | Gross Production        | Ascend API /production/summary| Live clinical     |
 * | Net Production          | Ascend API (netProduction)    | Live clinical     |
 * | Collections             | Ascend API /collections/summary| Live financial   |
 * | Write-Offs              | Ascend API /adjustments/summary| Separate bucket  |
 * | Charge Adjustments      | Ascend API /adjustments/summary| Separate bucket  |
 * | New Patients            | Ascend API /patients/summary  | Live clinical     |
 * | Broken Appts / TAR      | monthly_executive_analytics   | Manual entry only |
 * | Sparkline (6-mo trend)  | monthly_executive_analytics   | Historical store  |
 * | Goals                   | office_goals (Supabase)       | Manual entry      |
 * | Hygiene/Doctor KPIs     | daily_entries (Supabase)      | Manual entry      |
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NEVER compute the same metric differently in two places.
 * Import from here, not from individual page files.
 */

import { ascendApi } from './ascendApi';
import { supabase } from '../lib/supabase';
import { getLocationIdByOfficeId, OFFICE_LIST } from '../constants/offices';


// ─── Safe Math Helpers ────────────────────────────────────────────────────────

export const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

export const safeDivide = (n, d) => {
  const num = parseFloat(n);
  const den = parseFloat(d);
  if (!isFinite(num) || !isFinite(den) || den === 0 || isNaN(num) || isNaN(den)) return null;
  return num / den;
};

export const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(safeNum(v));

export const fmtPct = (v) => {
  if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return '—';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

export const fmtNum = (v) =>
  new Intl.NumberFormat('en-US')?.format(safeNum(v));

// ─── Date Range Builder ───────────────────────────────────────────────────────

/**
 * buildDateRange(preset | { start, end })
 *
 * CANONICAL date range resolver. All tabs must use this function.
 * Returns { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', label: string }
 *
 * Supported presets:
 *   'today' | 'this_week' | 'this_month' | 'last_month' | *'this_quarter'| 'last_quarter' | 'ytd' | 'last_year' | *'last_30' | 'last_60' | 'last_90' | 'last_12_months'
 *
 * Custom range: pass { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
export const buildDateRange = (presetOrCustom) => {
  const now = new Date();
  const pad = (n) => String(n)?.padStart(2, '0');
  const fmt = (d) => `${d?.getFullYear()}-${pad(d?.getMonth() + 1)}-${pad(d?.getDate())}`;
  const lastDay = (y, m) => new Date(y, m, 0)?.getDate();

  // Custom range passthrough
  if (presetOrCustom && typeof presetOrCustom === 'object' && presetOrCustom?.start) {
    return {
      startDate: presetOrCustom?.start,
      endDate: presetOrCustom?.end || fmt(now),
      label: `${presetOrCustom?.start} – ${presetOrCustom?.end || fmt(now)}`,
      preset: 'custom',
    };
  }

  const preset = presetOrCustom || 'this_month';
  const y = now?.getFullYear();
  const m = now?.getMonth() + 1;

  switch (preset) {
    case 'today': {
      const d = fmt(now);
      return { startDate: d, endDate: d, label: 'Today', preset };
    }
    case 'this_week': {
      const dow = now?.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon?.setDate(now?.getDate() + diff);
      return { startDate: fmt(mon), endDate: fmt(now), label: 'This Week', preset };
    }
    case 'this_month':
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: 'This Month',
        preset,
      };
    case 'last_month': {
      const d = new Date(y, m - 2, 1);
      const ly = d?.getFullYear();
      const lm = d?.getMonth() + 1;
      return {
        startDate: `${ly}-${pad(lm)}-01`,
        endDate: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}`,
        label: 'Last Month',
        preset,
      };
    }
    case 'this_quarter': {
      let q = Math.ceil(m / 3);
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      return {
        startDate: `${y}-${pad(sm)}-01`,
        endDate: `${y}-${pad(em)}-${pad(lastDay(y, em))}`,
        label: `Q${q} ${y}`,
        preset,
      };
    }
    case 'last_quarter': {
      let q = Math.ceil(m / 3);
      const pq = q === 1 ? 4 : q - 1;
      const py = q === 1 ? y - 1 : y;
      const sm = (pq - 1) * 3 + 1;
      const em = pq * 3;
      return {
        startDate: `${py}-${pad(sm)}-01`,
        endDate: `${py}-${pad(em)}-${pad(lastDay(py, em))}`,
        label: `Q${pq} ${py}`,
        preset,
      };
    }
    case 'ytd':
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: `YTD ${y}`,
        preset,
      };
    case 'last_year': {
      const py = y - 1;
      return {
        startDate: `${py}-01-01`,
        endDate: `${py}-12-31`,
        label: `${py}`,
        preset,
      };
    }
    case 'last_30': {
      const d = new Date(now);
      d?.setDate(d?.getDate() - 30);
      return { startDate: fmt(d), endDate: fmt(now), label: 'Last 30 Days', preset };
    }
    case 'last_60': {
      const d = new Date(now);
      d?.setDate(d?.getDate() - 60);
      return { startDate: fmt(d), endDate: fmt(now), label: 'Last 60 Days', preset };
    }
    case 'last_90': {
      const d = new Date(now);
      d?.setDate(d?.getDate() - 90);
      return { startDate: fmt(d), endDate: fmt(now), label: 'Last 90 Days', preset };
    }
    case 'last_12_months': {
      const d = new Date(y, m - 13, 1);
      return {
        startDate: fmt(d),
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: 'Last 12 Months',
        preset,
      };
    }
    // Legacy aliases used in executive-overview
    case 'month':
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: 'This Month',
        preset: 'this_month',
      };
    case 'quarter': {
      let q = Math.ceil(m / 3);
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      return {
        startDate: `${y}-${pad(sm)}-01`,
        endDate: `${y}-${pad(em)}-${pad(lastDay(y, em))}`,
        label: `Q${q} ${y}`,
        preset: 'this_quarter',
      };
    }
    case 'year':
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: `YTD ${y}`,
        preset: 'ytd',
      };
    case 'week': {
      const dow = now?.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(now);
      mon?.setDate(now?.getDate() + diff);
      return { startDate: fmt(mon), endDate: fmt(now), label: 'This Week', preset: 'this_week' };
    }
    default:
      return {
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
        label: 'This Month',
        preset: 'this_month',
      };
  }
};

// ─── Location ID Resolution ───────────────────────────────────────────────────

/**
 * Resolve locationId(s) for Ascend API calls.
 *
 * - Single office selected → return its locationId
 * - Multiple or no offices → return null (Ascend API returns all-office data)
 *
 * @param {string[]} officeIds - array of Supabase office UUIDs
 * @returns {string|null}
 */
export const resolveLocationId = (officeIds = []) => {
  if (!Array.isArray(officeIds) || officeIds?.length !== 1) return null;
  return getLocationIdByOfficeId(officeIds?.[0]) || null;
};

/**
 * Fan-out: fetch data for each office individually and merge.
 * Used when the API does not support multi-location in a single call.
 *
 * @param {string[]} officeIds
 * @param {Function} fetchFn - async (locationId: string, officeId: string) => data
 * @param {Function} mergeFn - (results: Array<{officeId, data}>) => merged
 * @returns {Promise<any>}
 */
export const fanOutFetch = async (officeIds, fetchFn, mergeFn) => {
  if (!officeIds?.length) {
    // All offices — pass null locationId
    const data = await fetchFn(null, null);
    return mergeFn([{ officeId: null, data }]);
  }

  const results = await Promise.allSettled(
    officeIds?.map(async (officeId) => {
      const locationId = getLocationIdByOfficeId(officeId);
      if (!locationId) return { officeId, data: null, error: `No locationId for ${officeId}` };
      try {
        const data = await fetchFn(locationId, officeId);
        return { officeId, data };
      } catch (err) {
        return { officeId, data: null, error: err?.message };
      }
    })
  );

  const settled = results?.map((r) => (r?.status === 'fulfilled' ? r?.value : { officeId: null, data: null, error: r?.reason?.message }));
  return mergeFn(settled);
};

// ─── In-Memory Metrics Cache ──────────────────────────────────────────────────
// Prevents duplicate API calls when multiple tabs render simultaneously.
// Cache TTL: 2 minutes. Invalidated on filter change.

const _metricsCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

const _cacheKey = (startDate, endDate, officeIds) =>
  `${startDate}|${endDate}|${(officeIds || [])?.sort()?.join(',')}`;

// ─── Canonical KPI Fetch ──────────────────────────────────────────────────────

/**
 * fetchCanonicalKPIs({ startDate, endDate, officeIds })
 *
 * THE canonical KPI fetch. All tabs that display production, collections,
 * new patients, or adjustments MUST use this function.
 *
 * Returns a normalized KPI object with full adjustment breakdown.
 * Logs diagnostics for Super Admin audit.
 *
 * @param {{ startDate: string, endDate: string, officeIds?: string[] }} params
 * @returns {Promise<CanonicalKPIs>}
 */
export const fetchCanonicalKPIs = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = resolveLocationId(officeIds);
  const diagnostics = {
    source: 'Ascend API',
    endpoints: [],
    errors: [],
    officeIds,
    locationId,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
  };

  let productionData = null;
  let collectionsData = null;
  let patientsData = null;
  let adjustmentsData = null;

  try {
    const [prodRes, collRes, patRes, adjRes] = await Promise.allSettled([
      ascendApi?.getProduction(startDate, endDate, locationId),
      ascendApi?.getCollections(startDate, endDate, locationId),
      ascendApi?.getPatients(startDate, endDate, locationId),
      ascendApi?.getAdjustmentsSummary(startDate, endDate, locationId),
    ]);

    if (prodRes?.status === 'fulfilled') {
      productionData = prodRes?.value;
      diagnostics?.endpoints?.push({ key: 'production', status: 'ok', records: 1 });
    } else {
      diagnostics?.errors?.push({ key: 'production', error: prodRes?.reason?.message });
    }

    if (collRes?.status === 'fulfilled') {
      collectionsData = collRes?.value;
      diagnostics?.endpoints?.push({ key: 'collections', status: 'ok', records: 1 });
    } else {
      diagnostics?.errors?.push({ key: 'collections', error: collRes?.reason?.message });
    }

    if (patRes?.status === 'fulfilled') {
      patientsData = patRes?.value;
      diagnostics?.endpoints?.push({ key: 'patients', status: 'ok', records: 1 });
    } else {
      diagnostics?.errors?.push({ key: 'patients', error: patRes?.reason?.message });
    }

    if (adjRes?.status === 'fulfilled') {
      adjustmentsData = adjRes?.value;
      diagnostics?.endpoints?.push({ key: 'adjustments', status: 'ok', records: 1 });
    } else {
      // Non-critical — adjustments endpoint may not be live
      diagnostics?.errors?.push({ key: 'adjustments', error: adjRes?.reason?.message, severity: 'warning' });
    }
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
  }

  // ── Normalize values ──────────────────────────────────────────────────────

  const grossProduction = safeNum(productionData?.grossProduction ?? 0);
  const netProduction = safeNum(productionData?.netProduction ?? productionData?.grossProduction ?? 0);
  const collections = safeNum(collectionsData?.totalCollections ?? 0);
  const newPatients = safeNum(patientsData?.newPatients ?? 0);
  const uniquePatients = safeNum(patientsData?.uniquePatients ?? patientsData?.newPatients ?? 0);

  // Collection rate: prefer API value, fallback to computed
  const collectionRate = collectionsData?.collectionRate != null
    ? safeNum(collectionsData?.collectionRate)
    : (netProduction > 0 ? (collections / netProduction) * 100 : null);

  // ── Adjustment breakdown ──────────────────────────────────────────────────
  // Source-of-truth: /v2/adjustments/summary
  // Fallback: production summary fields (less granular)
  // NEVER merge adjustment types — keep them separate
  const writeOffs = safeNum(
    adjustmentsData?.writeOffs ?? productionData?.writeOffs ?? 0
  );
  const chargeAdjustments = safeNum(
    adjustmentsData?.chargeAdjustments ?? productionData?.chargeAdjustments ?? 0
  );
  const creditAdjustments = safeNum(adjustmentsData?.creditAdjustments ?? 0);
  const insuranceAdjustments = safeNum(adjustmentsData?.insuranceAdjustments ?? 0);
  const discounts = safeNum(adjustmentsData?.discounts ?? 0);
  const reversals = safeNum(adjustmentsData?.reversals ?? 0);
  const totalAdjustments = safeNum(
    adjustmentsData?.totalAdjustments
    ?? productionData?.adjustments
    ?? (writeOffs + chargeAdjustments + creditAdjustments + insuranceAdjustments + discounts + reversals)
  );
  const adjustmentCount = safeNum(adjustmentsData?.adjustmentCount ?? 0);
  const voidedCount = safeNum(adjustmentsData?.voidedCount ?? 0);

  // Gross → Net reconciliation
  const grossToNetDiff = grossProduction - netProduction;
  const reconciliationWarning =
    Math.abs(Math.abs(writeOffs) - grossToNetDiff) > 1
      ? `Write-offs (${writeOffs}) don't fully reconcile gross-net diff (${grossToNetDiff})`
      : null;

  // ── Supplemental from Supabase (manual-entry only metrics) ───────────────
  let brokenAppts = 0;
  let txDiagnosed = 0;
  let txAccepted = 0;

  try {
    // Parse year/month from ISO date strings for MEA query
    const startYear = parseInt(startDate?.slice(0, 4));
    const startMonth = parseInt(startDate?.slice(5, 7));
    const endYear = parseInt(endDate?.slice(0, 4));
    const endMonth = parseInt(endDate?.slice(5, 7));

    let q = supabase?.from('monthly_executive_analytics')?.select('broken_appointments, tx_diagnosed_value, tx_accepted_value, report_year, report_month, office_id')?.gte('report_year', startYear)?.lte('report_year', endYear);

    // MEA may store office_id as UUID or office name — filter by UUID when possible
    if (officeIds?.length > 0) {
      q = q?.in('office_id', officeIds);
    }

    const { data: meaData } = await q;

    // Filter to exact month range
    (meaData || [])?.forEach((r) => {
      const rVal = parseInt(r?.report_year) * 100 + parseInt(r?.report_month);
      const startVal = startYear * 100 + startMonth;
      const endVal = endYear * 100 + endMonth;
      if (rVal >= startVal && rVal <= endVal) {
        brokenAppts += safeNum(r?.broken_appointments);
        txDiagnosed += safeNum(r?.tx_diagnosed_value);
        txAccepted += safeNum(r?.tx_accepted_value);
      }
    });
  } catch (_) {
    // Non-critical
  }

  const tarPct = txDiagnosed > 0 ? (txAccepted / txDiagnosed) * 100 : null;
  const avgProdPerVisit = safeDivide(netProduction, uniquePatients || newPatients);

  const result = {
    // ── Production ──────────────────────────────────────────────────────────
    grossProduction,
    netProduction,
    production: netProduction, // canonical alias used across tabs

    // ── Collections ─────────────────────────────────────────────────────────
    collections,
    collectionRate,

    // ── Patients ────────────────────────────────────────────────────────────
    newPatients,
    uniquePatients,
    activePatients: uniquePatients,

    // ── Adjustments (NEVER merged — always separate) ─────────────────────
    adjustments: {
      total: totalAdjustments,
      writeOffs,
      chargeAdjustments,
      creditAdjustments,
      insuranceAdjustments,
      discounts,
      reversals,
      adjustmentCount,
      voidedCount,
      netWriteOff: writeOffs <= 0 ? writeOffs : -Math.abs(writeOffs),
      grossToNetDiff,
      reconciliationWarning,
    },

    // ── Manual-entry supplemental ────────────────────────────────────────
    brokenAppts,
    txDiagnosed,
    txAccepted,
    tarPct,
    avgProdPerVisit,

    // ── Diagnostics (Super Admin only) ───────────────────────────────────
    _diagnostics: diagnostics,
  };

  // Cache in module-level store for cross-tab access
  _metricsCache?.set(_cacheKey(startDate, endDate, officeIds), {
    data: result,
    cachedAt: Date.now(),
  });

  return result;
};

/**
 * fetchCanonicalKPIsCached
 * Same as fetchCanonicalKPIs but returns cached result within TTL.
 * Use this in components that re-render frequently.
 */
export const fetchCanonicalKPIsCached = async ({ startDate, endDate, officeIds = [] }) => {
  const key = _cacheKey(startDate, endDate, officeIds);
  const cached = _metricsCache?.get(key);
  if (cached && Date.now() - cached?.cachedAt < CACHE_TTL_MS) {
    return { ...cached?.data, _fromCache: true };
  }
  return fetchCanonicalKPIs({ startDate, endDate, officeIds });
};

/**
 * invalidateMetricsCache
 * Call this after any data mutation (import, manual entry, sync).
 */
export const invalidateMetricsCache = () => {
  _metricsCache?.clear();
};

// ─── Per-Office KPI Fan-Out ───────────────────────────────────────────────────

/**
 * fetchKPIsPerOffice({ startDate, endDate, officeIds })
 *
 * Fetches KPIs for each office individually and returns an array of
 * { officeId, officeName, officeColor, ...kpis } objects.
 *
 * Used by charts that need per-office breakdowns.
 */
export const fetchKPIsPerOffice = async ({ startDate, endDate, officeIds = [] }) => {
  const targetOffices = officeIds?.length > 0
    ? OFFICE_LIST?.filter((o) => officeIds?.includes(o?.id))
    : OFFICE_LIST;

  const results = await Promise.allSettled(
    targetOffices?.map(async (office) => {
      const locationId = getLocationIdByOfficeId(office?.id);
      if (!locationId) {
        return {
          officeId: office?.id,
          officeName: office?.name,
          officeColor: office?.color,
          grossProduction: 0,
          netProduction: 0,
          production: 0,
          collections: 0,
          collectionRate: null,
          newPatients: 0,
          adjustments: { total: 0, writeOffs: 0, chargeAdjustments: 0 },
          _error: `No locationId for office ${office?.name}`,
        };
      }

      try {
        const [prodData, collData, patData] = await Promise.allSettled([
          ascendApi?.getProduction(startDate, endDate, locationId),
          ascendApi?.getCollections(startDate, endDate, locationId),
          ascendApi?.getPatients(startDate, endDate, locationId),
        ]);

        const prod = prodData?.status === 'fulfilled' ? prodData?.value : null;
        const coll = collData?.status === 'fulfilled' ? collData?.value : null;
        const pat = patData?.status === 'fulfilled' ? patData?.value : null;

        const grossProduction = safeNum(prod?.grossProduction ?? 0);
        const netProduction = safeNum(prod?.netProduction ?? prod?.grossProduction ?? 0);
        const collections = safeNum(coll?.totalCollections ?? 0);
        const newPatients = safeNum(pat?.newPatients ?? 0);
        const collectionRate = coll?.collectionRate != null
          ? safeNum(coll?.collectionRate)
          : (netProduction > 0 ? (collections / netProduction) * 100 : null);

        return {
          officeId: office?.id,
          officeName: office?.name,
          officeColor: office?.color,
          grossProduction,
          netProduction,
          production: netProduction,
          collections,
          collectionRate,
          newPatients,
          adjustments: {
            total: safeNum(prod?.adjustments ?? 0),
            writeOffs: safeNum(prod?.writeOffs ?? 0),
            chargeAdjustments: safeNum(prod?.chargeAdjustments ?? 0),
          },
        };
      } catch (err) {
        return {
          officeId: office?.id,
          officeName: office?.name,
          officeColor: office?.color,
          grossProduction: 0,
          netProduction: 0,
          production: 0,
          collections: 0,
          collectionRate: null,
          newPatients: 0,
          adjustments: { total: 0, writeOffs: 0, chargeAdjustments: 0 },
          _error: err?.message,
        };
      }
    })
  );

  return results?.map((r) => (r?.status === 'fulfilled' ? r?.value : { _error: r?.reason?.message }));
};

// ─── Cross-Tab Reconciliation Check ──────────────────────────────────────────

/**
 * reconcileMetrics(a, b)
 *
 * Compare two KPI objects (e.g. from different tabs) and return mismatches.
 * Used by the Super Admin diagnostics panel.
 *
 * @param {{ label: string, kpis: object }} a
 * @param {{ label: string, kpis: object }} b
 * @param {number} [tolerancePct=0.01] - % tolerance for floating point differences
 * @returns {{ mismatches: Array, isReconciled: boolean }}
 */
export const reconcileMetrics = (a, b, tolerancePct = 0.01) => {
  const fields = ['grossProduction', 'netProduction', 'collections', 'newPatients', 'collectionRate'];
  const mismatches = [];

  fields?.forEach((field) => {
    const va = safeNum(a?.kpis?.[field]);
    const vb = safeNum(b?.kpis?.[field]);
    if (va === 0 && vb === 0) return;
    const diff = Math.abs(va - vb);
    const base = Math.max(Math.abs(va), Math.abs(vb), 1);
    const pct = diff / base;
    if (pct > tolerancePct) {
      mismatches?.push({
        field,
        [a?.label]: va,
        [b?.label]: vb,
        diffAbs: diff,
        diffPct: (pct * 100)?.toFixed(2) + '%',
      });
    }
  });

  return { mismatches, isReconciled: mismatches?.length === 0 };
};

// ─── Metric Lineage Registry ──────────────────────────────────────────────────

/**
 * METRIC_LINEAGE
 *
 * Documents every metric's source, transformation, and display locations.
 * Used by the Super Admin diagnostics panel.
 */
export const METRIC_LINEAGE = [
  {
    key: 'grossProduction',
    label: 'Gross Production',
    source: 'Ascend API',
    endpoint: '/v2/production/summary',
    field: 'grossProduction',
    transformation: 'safeNum()',
    displayedIn: ['Executive Overview', 'Office Performance', 'KPIs', 'Reports', 'Provider Performance', 'Payroll', 'Financial Analytics'],
    filterDimensions: ['office', 'date'],
    notes: 'UCR fee total before write-offs and adjustments',
  },
  {
    key: 'netProduction',
    label: 'Net Production',
    source: 'Ascend API',
    endpoint: '/v2/production/summary',
    field: 'netProduction',
    transformation: 'safeNum(), fallback to grossProduction',
    displayedIn: ['Executive Overview', 'KPIs', 'Reports', 'Financial Analytics'],
    filterDimensions: ['office', 'date'],
    notes: 'Gross production minus write-offs and contractual adjustments',
  },
  {
    key: 'collections',
    label: 'Collections',
    source: 'Ascend API',
    endpoint: '/v2/collections/summary',
    field: 'totalCollections',
    transformation: 'safeNum()',
    displayedIn: ['Executive Overview', 'Office Performance', 'KPIs', 'Reports', 'RCM', 'Financial Analytics'],
    filterDimensions: ['office', 'date'],
    notes: 'Total patient + insurance collections',
  },
  {
    key: 'collectionRate',
    label: 'Collection Rate',
    source: 'Ascend API',
    endpoint: '/v2/collections/summary',
    field: 'collectionRate',
    transformation: 'API value preferred; fallback: collections / netProduction * 100',
    displayedIn: ['Executive Overview', 'KPIs', 'Reports', 'RCM Dashboard'],
    filterDimensions: ['office', 'date'],
    notes: 'Prefer API-computed rate; computed fallback uses netProduction as denominator',
  },
  {
    key: 'newPatients',
    label: 'New Patients',
    source: 'Ascend API',
    endpoint: '/v2/patients/summary',
    field: 'newPatients',
    transformation: 'safeNum()',
    displayedIn: ['Executive Overview', 'KPIs', 'Reports', 'RCM Daily Comparison'],
    filterDimensions: ['office', 'date'],
    notes: 'New patient count from Dentrix Ascend',
  },
  {
    key: 'writeOffs',
    label: 'Write-Offs',
    source: 'Ascend API',
    endpoint: '/v2/adjustments/summary',
    field: 'writeOffs',
    transformation: 'safeNum(), fallback to productionData.writeOffs',
    displayedIn: ['KPIs', 'RCM Adjustment', 'Financial Analytics'],
    filterDimensions: ['office', 'date'],
    notes: 'PPO/contractual write-offs. NEVER merged with chargeAdjustments.',
  },
  {
    key: 'chargeAdjustments',
    label: 'Charge Adjustments',
    source: 'Ascend API',
    endpoint: '/v2/adjustments/summary',
    field: 'chargeAdjustments',
    transformation: 'safeNum()',
    displayedIn: ['KPIs', 'RCM Adjustment'],
    filterDimensions: ['office', 'date'],
    notes: 'Fee corrections. Separate from write-offs.',
  },
  {
    key: 'brokenAppts',
    label: 'Broken Appointments',
    source: 'Supabase',
    endpoint: 'monthly_executive_analytics.broken_appointments',
    field: 'broken_appointments',
    transformation: 'safeNum(), sum across offices',
    displayedIn: ['KPIs'],
    filterDimensions: ['office', 'date'],
    notes: 'Manual entry only — not available from Ascend API',
  },
  {
    key: 'tarPct',
    label: 'Treatment Acceptance Rate',
    source: 'Supabase',
    endpoint: 'monthly_executive_analytics.tx_accepted_value / tx_diagnosed_value',
    field: 'tx_accepted_value, tx_diagnosed_value',
    transformation: 'txAccepted / txDiagnosed * 100',
    displayedIn: ['KPIs'],
    filterDimensions: ['office', 'date'],
    notes: 'Manual entry only — not available from Ascend API',
  },
];

export default {
  buildDateRange,
  resolveLocationId,
  fanOutFetch,
  fetchCanonicalKPIs,
  fetchCanonicalKPIsCached,
  invalidateMetricsCache,
  fetchKPIsPerOffice,
  reconcileMetrics,
  METRIC_LINEAGE,
  safeNum,
  safeDivide,
  fmtCurrency,
  fmtPct,
  fmtNum,
};
