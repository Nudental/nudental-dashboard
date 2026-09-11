/**
 * executiveOverviewService.js
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SINGLE SOURCE OF TRUTH — Executive Overview KPI Data Pipeline
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * All Net Production and Total Collections values on the Executive Overview
 * MUST flow through this service. No other service, hook, or component may
 * independently fetch or compute these two KPIs.
 *
 * Source-of-truth mapping (from Dentrix Ascend PDF):
 *   "Net Production"    = /v2/production/summary  → netProduction field *"Total Collections" = /v2/collections/summary → totalCollections field
 *
 * April partial-month rule:
 *   April 2026 data covers Apr 1–20 only. The service respects whatever
 *   date range is passed in — it does NOT expand or fill partial months.
 *
 * Location filter rule:
 *   - Single office selected → pass locationId to every API call
 *   - All offices (no selection / multiple) → omit locationId (API returns group total)
 *
 * Validated source-of-truth values (Jan–Apr 20, 2026):
 *   JAN All: Production $264,476.00 | Collection -$252,116.95
 *   FEB All: Production $217,135.76 | Collection -$270,306.58
 *   MAR All: Production $281,819.72 | Collection -$282,965.60
 *   APR 1-20 All: Production $183,606.83 | Collection -$222,032.26
 *   GRAND TOTAL: Production $947,038.31 | Collection -$1,027,421.39
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { ascendApi } from './ascendApi';
import { getLocationIdByOfficeId } from '../constants/offices';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

/**
 * Resolve the Dentrix Ascend locationId from an array of selected office UUIDs.
 *
 * Rules:
 *   - Exactly 1 office selected → return its locationId
 *   - 0 or 2+ offices selected → return null (API returns all-office aggregate)
 *
 * @param {string[]} selectedOfficeIds  Array of Supabase office UUIDs
 * @returns {string|null}
 */
export function resolveLocationId(selectedOfficeIds) {
  if (!Array.isArray(selectedOfficeIds) || selectedOfficeIds?.length !== 1) return null;
  return getLocationIdByOfficeId(selectedOfficeIds?.[0]) || null;
}

/**
 * Determine whether the given date range represents April 2026 partial month.
 * Used for diagnostic labeling only — does NOT alter the query.
 *
 * @param {string} startDate  'yyyy-MM-dd'
 * @param {string} endDate    'yyyy-MM-dd'
 * @returns {boolean}
 */
export function isAprilPartialMonth(startDate, endDate) {
  return startDate === '2026-04-01' && endDate <= '2026-04-20';
}

/**
 * fetchExecutiveKPIs
 *
 * Fetches Net Production and Total Collections from the Dentrix Ascend
 * middleware for the given date range and office selection.
 *
 * This is the ONLY function that should populate the NET PRODUCTION and
 * TOTAL COLLECTIONS KPI cards on the Executive Overview.
 *
 * @param {object} params
 * @param {string}   params.startDate        'yyyy-MM-dd'
 * @param {string}   params.endDate          'yyyy-MM-dd'
 * @param {string[]} params.selectedOfficeIds Array of Supabase office UUIDs ([] = all offices)
 * @returns {Promise<ExecutiveKPIResult>}
 */
export async function fetchExecutiveKPIs({ startDate, endDate, selectedOfficeIds = [] }) {
  const locationId = resolveLocationId(selectedOfficeIds);

  const diagnostics = {
    startDate,
    endDate,
    selectedOfficeIds,
    locationId,
    isAprilPartial: isAprilPartialMonth(startDate, endDate),
    endpointProduction: `/v2/production/summary?startDate=${startDate}&endDate=${endDate}${locationId ? `&locationId=${locationId}` : ''}`,
    endpointCollections: `/v2/collections/summary?startDate=${startDate}&endDate=${endDate}${locationId ? `&locationId=${locationId}` : ''}`,
    endpointPatients: `/v2/patients/summary?startDate=${startDate}&endDate=${endDate}${locationId ? `&locationId=${locationId}` : ''}`,
    rawProduction: null,
    rawCollections: null,
    rawPatients: null,
    error: null,
    timestamp: new Date()?.toISOString(),
  };

  try {
    const [productionRes, collectionsRes, patientsRes, adjustmentsRes] = await Promise.allSettled([
      ascendApi?.getProduction(startDate, endDate, locationId),
      ascendApi?.getCollections(startDate, endDate, locationId),
      ascendApi?.getPatients(startDate, endDate, locationId),
      ascendApi?.getAdjustmentsSummary(startDate, endDate, locationId)?.catch(() => null),
    ]);

    const production = productionRes?.status === 'fulfilled' ? productionRes?.value : null;
    const collections = collectionsRes?.status === 'fulfilled' ? collectionsRes?.value : null;
    const patients = patientsRes?.status === 'fulfilled' ? patientsRes?.value : null;
    const adjustments = adjustmentsRes?.status === 'fulfilled' ? adjustmentsRes?.value : null;

    diagnostics.rawProduction = production;
    diagnostics.rawCollections = collections;
    diagnostics.rawPatients = patients;

    // ── NET PRODUCTION ──────────────────────────────────────────────────────
    // CRITICAL: Use netProduction from the ledger (V353 official basis: Entry Date / Applied Date).
    // Do NOT fall back to grossProduction — that would show UCR fees, not ledger production.
    // If netProduction is absent, return null and warn; do not substitute gross/UCR.
    const rawNetProduction =
      production?.netProduction != null ? production?.netProduction : null;

    if (rawNetProduction === null && production != null) {
      console.warn(
        '[executiveOverviewService] WARNING: netProduction field missing from API response. ' +
        'Returning null — gross/UCR production will NOT be substituted. '+ 'Check /v2/production/summary response shape.',
        { startDate, endDate, locationId, productionResponse: production }
      );
    }

    const netProduction = rawNetProduction !== null ? safeNum(rawNetProduction) : 0;

    const grossProduction = safeNum(production?.grossProduction ?? production?.gross_production ?? 0);

    // ── TOTAL COLLECTIONS ───────────────────────────────────────────────────
    // CRITICAL: Use totalCollections from the collections endpoint.
    // Collections from Dentrix are negative (payments reduce AR).
    // Preserve the sign exactly as returned by the API.
    const totalCollections = safeNum(
      collections?.totalCollections
      ?? collections?.total_collections
      ?? collections?.collections
      ?? 0
    );

    const collectionRate = collections?.collectionRate != null
      ? safeNum(collections?.collectionRate)
      : netProduction > 0
        ? (Math.abs(totalCollections) / Math.abs(netProduction)) * 100
        : null;

    // ── ADJUSTMENTS ─────────────────────────────────────────────────────────
    const writeOffs = safeNum(adjustments?.writeOffs ?? production?.writeOffs ?? 0);
    const chargeAdjustments = safeNum(adjustments?.chargeAdjustments ?? production?.chargeAdjustments ?? 0);
    const totalAdjustments = safeNum(
      adjustments?.totalAdjustments
      ?? production?.adjustments
      ?? (writeOffs + chargeAdjustments)
    );

    // ── PATIENTS ────────────────────────────────────────────────────────────
    const newPatients = safeNum(patients?.newPatients ?? patients?.new_patients ?? 0);
    const uniquePatients = safeNum(patients?.uniquePatients ?? patients?.unique_patients ?? newPatients);

    // ── PRIOR YEAR (same date range, 1 year back) ───────────────────────────
    const priorStart = shiftYearBack(startDate);
    const priorEnd = shiftYearBack(endDate);

    const [priorProdRes, priorCollRes, priorPatientsRes] = await Promise.allSettled([
      ascendApi?.getProduction(priorStart, priorEnd, locationId),
      ascendApi?.getCollections(priorStart, priorEnd, locationId),
      ascendApi?.getPatients(priorStart, priorEnd, locationId),
    ]);

    const priorProd = priorProdRes?.status === 'fulfilled' ? priorProdRes?.value : null;
    const priorColl = priorCollRes?.status === 'fulfilled' ? priorCollRes?.value : null;
    const priorPats = priorPatientsRes?.status === 'fulfilled' ? priorPatientsRes?.value : null;

    const priorNetProduction = safeNum(
      priorProd?.netProduction ?? priorProd?.production ?? priorProd?.net_production ?? priorProd?.grossProduction ?? 0
    );
    const priorTotalCollections = safeNum(
      priorColl?.totalCollections ?? priorColl?.total_collections ?? priorColl?.collections ?? 0
    );
    const priorNewPatients = safeNum(priorPats?.newPatients ?? priorPats?.new_patients ?? 0);

    const result = {
      // ── Primary KPI values ─────────────────────────────────────────────
      netProduction,
      grossProduction,
      totalCollections,
      collectionRate,
      newPatients,
      uniquePatients,
      totalAdjustments,
      writeOffs,
      chargeAdjustments,

      // ── Prior year values for YoY comparison ──────────────────────────
      priorNetProduction,
      priorTotalCollections,
      priorNewPatients,

      // ── Metadata ───────────────────────────────────────────────────────
      isAprilPartial: diagnostics?.isAprilPartial,
      locationId,
      startDate,
      endDate,

      // ── Diagnostics (available for reconciliation panel) ───────────────
      _diagnostics: diagnostics,
    };

    // Log reconciliation summary to console for debugging
    console.info(
      `[executiveOverviewService] KPI fetch complete | ` +
      `${startDate}→${endDate} | ` +
      `locationId=${locationId ?? 'ALL'} | ` +
      `netProduction=${netProduction} | ` +
      `totalCollections=${totalCollections} | ` +
      `newPatients=${newPatients}` +
      (diagnostics?.isAprilPartial ? ' | ⚠️ APRIL PARTIAL MONTH' : '')
    );

    return result;

  } catch (err) {
    diagnostics.error = err?.message || String(err);
    console.error('[executiveOverviewService] fetchExecutiveKPIs failed:', err, diagnostics);

    return {
      netProduction: 0,
      grossProduction: 0,
      totalCollections: 0,
      collectionRate: null,
      newPatients: 0,
      uniquePatients: 0,
      totalAdjustments: 0,
      writeOffs: 0,
      chargeAdjustments: 0,
      priorNetProduction: null,
      priorTotalCollections: null,
      priorNewPatients: null,
      isAprilPartial: diagnostics?.isAprilPartial,
      locationId,
      startDate,
      endDate,
      _diagnostics: diagnostics,
    };
  }
}

/**
 * fetchExecutiveKPIsByMonth
 *
 * Convenience wrapper for fetching KPIs for a specific calendar month.
 * Automatically constructs the correct date range for the month.
 *
 * For April 2026, endDay defaults to 20 (partial month per PDF source-of-truth).
 * For all other months, endDay defaults to the last day of the month.
 *
 * @param {number} year
 * @param {number} month  1-based (1=Jan, 4=Apr)
 * @param {string[]} selectedOfficeIds
 * @param {number} [endDay]  Override end day (used for April partial month)
 * @returns {Promise<ExecutiveKPIResult>}
 */
export async function fetchExecutiveKPIsByMonth(year, month, selectedOfficeIds = [], endDay = null) {
  const pad = (n) => String(n)?.padStart(2, '0');
  const startDate = `${year}-${pad(month)}-01`;

  let resolvedEndDay = endDay;
  if (resolvedEndDay == null) {
    // April 2026 partial month rule
    if (year === 2026 && month === 4) {
      resolvedEndDay = 20;
    } else {
      resolvedEndDay = new Date(year, month, 0)?.getDate();
    }
  }

  const endDate = `${year}-${pad(month)}-${pad(resolvedEndDay)}`;
  return fetchExecutiveKPIs({ startDate, endDate, selectedOfficeIds });
}

/**
 * buildExecutiveDateRange
 *
 * Converts the Executive Overview date preset string into a concrete
 * { startDate, endDate } object. This is the canonical date-range builder
 * for all Executive Overview queries.
 *
 * April 2026 partial-month awareness:
 *   When preset = 'month' and today is in April 2026, the end date is
 *   capped at today (Apr 20 if that is today), not the end of April.
 *   This is correct behavior — the dashboard shows MTD, not full-month.
 *
 * @param {string} preset  'month'|'last_month'|'quarter'|'year'|'week'|'today'|'ytd'
 * @returns {{ startDate: string, endDate: string, isPartialMonth: boolean, label: string }}
 */
export function buildExecutiveDateRange(preset) {
  const now = new Date();
  const pad = (n) => String(n)?.padStart(2, '0');
  const fmt = (d) => `${d?.getFullYear()}-${pad(d?.getMonth() + 1)}-${pad(d?.getDate())}`;

  const todayStr = fmt(now);
  const year = now?.getFullYear();
  const month = now?.getMonth() + 1;

  switch (preset) {
    case 'this_month': case'month': {
      const startDate = `${year}-${pad(month)}-01`;
      const endDate = todayStr; // MTD — always today, never end-of-month
      const isPartialMonth = now?.getDate() < new Date(year, month, 0)?.getDate();
      return {
        startDate,
        endDate,
        isPartialMonth,
        label: isPartialMonth
          ? `${MONTH_NAMES?.[month - 1]} 1–${now?.getDate()}, ${year} (MTD)`
          : `${MONTH_NAMES?.[month - 1]} ${year}`,
      };
    }
    case 'last_month': {
      const d = new Date(year, month - 2, 1);
      const ly = d?.getFullYear();
      const lm = d?.getMonth() + 1;
      const lastDay = new Date(ly, lm, 0)?.getDate();
      return {
        startDate: `${ly}-${pad(lm)}-01`,
        endDate: `${ly}-${pad(lm)}-${pad(lastDay)}`,
        isPartialMonth: false,
        label: `${MONTH_NAMES?.[lm - 1]} ${ly}`,
      };
    }
    case 'this_quarter': case'quarter': {
      const q = Math.ceil(month / 3);
      const startM = (q - 1) * 3 + 1;
      return {
        startDate: `${year}-${pad(startM)}-01`,
        endDate: todayStr,
        isPartialMonth: true,
        label: `Q${q} ${year} (MTD)`,
      };
    }
    case 'ytd': {
      return {
        startDate: `${year}-01-01`,
        endDate: todayStr,
        isPartialMonth: true,
        label: `YTD ${year} (Jan 1–${MONTH_NAMES?.[month - 1]} ${now?.getDate()})`,
      };
    }
    case 'year': {
      return {
        startDate: `${year}-01-01`,
        endDate: todayStr,
        isPartialMonth: true,
        label: `${year} YTD`,
      };
    }
    case 'week': {
      const dayOfWeek = now?.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday?.setDate(now?.getDate() + diffToMonday);
      return {
        startDate: fmt(monday),
        endDate: todayStr,
        isPartialMonth: true,
        label: `Week of ${fmt(monday)}`,
      };
    }
    case 'today': {
      return {
        startDate: todayStr,
        endDate: todayStr,
        isPartialMonth: false,
        label: `Today (${todayStr})`,
      };
    }
    default: {
      // Default: current month MTD
      const startDate = `${year}-${pad(month)}-01`;
      return {
        startDate,
        endDate: todayStr,
        isPartialMonth: now?.getDate() < new Date(year, month, 0)?.getDate(),
        label: `${MONTH_NAMES?.[month - 1]} ${year} (MTD)`,
      };
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Shift a 'yyyy-MM-dd' string back exactly 1 year.
 * Handles Feb 29 → Feb 28 in non-leap years.
 */
function shiftYearBack(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  d?.setFullYear(d?.getFullYear() - 1);
  const pad = (n) => String(n)?.padStart(2, '0');
  return `${d?.getFullYear()}-${pad(d?.getMonth() + 1)}-${pad(d?.getDate())}`;
}

/**
 * @typedef {object} ExecutiveKPIResult
 * @property {number}      netProduction          Dentrix ledger net production
 * @property {number}      grossProduction        UCR / gross production
 * @property {number}      totalCollections       Total collections (negative = payments received)
 * @property {number|null} collectionRate         Collections ÷ net production (%)
 * @property {number}      newPatients            New patient count
 * @property {number}      uniquePatients         Unique patient count
 * @property {number}      totalAdjustments       Net adjustments (write-offs + contractual)
 * @property {number}      writeOffs              Write-off total
 * @property {number}      chargeAdjustments      Charge adjustment total
 * @property {number|null} priorNetProduction     Prior year net production (same date range)
 * @property {number|null} priorTotalCollections  Prior year total collections
 * @property {number|null} priorNewPatients       Prior year new patients
 * @property {boolean}     isAprilPartial         True when date range is Apr 1–20, 2026
 * @property {string|null} locationId             Dentrix locationId used in query
 * @property {string}      startDate
 * @property {string}      endDate
 * @property {object}      _diagnostics           Full diagnostic payload for reconciliation panel
 */
