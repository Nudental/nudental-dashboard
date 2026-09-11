/**
 * useExecutiveOverview.js
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * CENTRALIZED EXECUTIVE OVERVIEW DATA HOOK — SINGLE SOURCE OF TRUTH
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DATA SOURCE RULES (CRITICAL):
 *   - netProduction, grossProduction, totalCollections, collectionRate,
 *     newPatients, totalAdjustments → DENTRIX ASCEND API ONLY
 *   - groupTotals, officeBreakdown → Supabase daily_entries (EOD manual entries)
 *   - expenseKPIs → Supabase expense layer
 *
 * The Supabase daily_entries data is for EOD workflow tracking ONLY.
 * It MUST NOT be used to populate live financial KPI cards.
 *
 * Filter contract:
 *   - officeIds: string[]  — Supabase office UUIDs. [] = All Offices.
 *   - datePreset: string   — 'last_month' | 'this_month' | 'quarter' | 'ytd' | 'year' | 'week' | 'today'
 *   - lineOfBusiness: string[] — LOB filter (passed through to API)
 *
 * Cache invalidation:
 *   - Any change to officeIds, datePreset, or lineOfBusiness triggers a full refetch.
 *   - The cacheKey includes all three dimensions — no stale all-office data reuse.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchExecutiveKPIs, buildExecutiveDateRange, resolveLocationId } from '../services/executiveOverviewService';
import { fetchMultiOfficeKPIs } from '../services/dailyEntryBulkImportService';
import { fetchExpenseKPIs } from '../services/expenseReportService';
import { ascendApi } from '../services/ascendApi';

/**
 * Stable JSON key for cache invalidation.
 * Includes ALL filter dimensions so no stale data is ever reused.
 */
function buildCacheKey(officeIds, datePreset, lineOfBusiness) {
  const sortedOffices = [...(officeIds || [])]?.sort()?.join(',');
  const sortedLOB = [...(lineOfBusiness || [])]?.sort()?.join(',');
  return `${datePreset}|offices:${sortedOffices}|lob:${sortedLOB}`;
}

/**
 * useExecutiveOverview
 *
 * @param {object} params
 * @param {string[]} params.officeIds        Selected office UUIDs ([] = All Offices)
 * @param {string}   params.datePreset       Date range preset string
 * @param {string[]} params.lineOfBusiness   Line of business filter
 * @param {boolean}  params.enabled          Set false to skip fetching (e.g. while offices loading)
 * @param {number}   params.refreshKey       Increment to force a refetch
 *
 * @returns {{
 *   data: ExecutiveOverviewPayload | null,
 *   loading: boolean,
 *   error: string | null,
 *   dateRange: { start: string, end: string, label: string, isPartialMonth: boolean } | null,
 *   refetch: () => void,
 * }}
 */
export function useExecutiveOverview({
  officeIds = [],
  datePreset = 'last_month',
  lineOfBusiness = [],
  enabled = true,
  refreshKey = 0,
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  // Track the last cache key that was successfully fetched.
  // If the key changes, we must refetch — never reuse stale data.
  const lastCacheKeyRef = useRef(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async (forceOfficeIds, forceDatePreset, forceLineOfBusiness) => {
    const resolvedOfficeIds = forceOfficeIds ?? officeIds;
    const resolvedDatePreset = forceDatePreset ?? datePreset;
    const resolvedLOB = forceLineOfBusiness ?? lineOfBusiness;

    const cacheKey = buildCacheKey(resolvedOfficeIds, resolvedDatePreset, resolvedLOB);

    // Abort any in-flight request
    if (abortRef?.current) {
      abortRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    abortRef.current = token;

    setLoading(true);
    setError(null);

    // Build date range
    const dr = buildExecutiveDateRange(resolvedDatePreset);
    if (!token?.cancelled) {
      setDateRange(dr);
    }

    console.info(
      `[useExecutiveOverview] FETCH START | cacheKey="${cacheKey}" | ` +
      `offices=[${resolvedOfficeIds?.join(', ') || 'ALL'}] | ` +
      `datePreset=${resolvedDatePreset} | ` +
      `range=${dr?.startDate}→${dr?.endDate}`
    );

    try {
      // ── Fetch all three data sources in parallel ──────────────────────────
      const [execKPIsResult, kpiDataResult, expenseKPIsResult, ascendExpensesResult] = await Promise.allSettled([
        // 1. Dentrix Ascend KPIs (Net Production + Total Collections) — PRIMARY SOURCE
        fetchExecutiveKPIs({
          startDate: dr?.startDate,
          endDate: dr?.endDate,
          selectedOfficeIds: resolvedOfficeIds,
        }),
        // 2. Daily entries KPIs (Supabase — EOD workflow tracking ONLY, NOT for live KPI cards)
        fetchMultiOfficeKPIs(resolvedOfficeIds, { start: dr?.startDate, end: dr?.endDate }),
        // 3. Expense KPIs (Supabase expense layer)
        fetchExpenseKPIs({
          startDate: dr?.startDate,
          endDate: dr?.endDate,
          officeIds: resolvedOfficeIds,
        }),
        // 4. Ascend /v2/expenses/summary — WF Main Money-Out cash-basis totals (PRIMARY for Operating Expenses cards)
        ascendApi?.getExpensesSummary(
          dr?.startDate,
          dr?.endDate,
          resolveLocationId(resolvedOfficeIds)
        )?.catch((err) => {
          console.warn('[useExecutiveOverview] /v2/expenses/summary fetch failed:', err?.message);
          return null;
        }),
      ]);

      if (token?.cancelled) return;

      const execKPIs = execKPIsResult?.status === 'fulfilled' ? execKPIsResult?.value : null;
      const kpiData = kpiDataResult?.status === 'fulfilled'
        ? kpiDataResult?.value
        : { groupTotals: { production: 0, collection: 0, new_patients: 0, expenses: 0, collectionRate: 0 }, officeBreakdown: [], totalEntries: 0 };
      const expenseKPIs = expenseKPIsResult?.status === 'fulfilled' ? expenseKPIsResult?.value : null;
      const ascendExpensesRaw = ascendExpensesResult?.status === 'fulfilled' ? ascendExpensesResult?.value : null;

      // ── Normalize /v2/expenses/summary response ───────────────────────────
      // totals.total_expenses is the WF Main Money-Out source of truth.
      // totals.payroll is Gusto detail — review only, NOT added to total.
      // ratios.payroll_pct_of_collections comes directly from backend.
      const ascendExpenses = ascendExpensesRaw
        ? {
            totalExpenses:          parseFloat(ascendExpensesRaw?.totals?.total_expenses ?? ascendExpensesRaw?.totals?.wf_banking ?? 0),
            payroll:                parseFloat(ascendExpensesRaw?.totals?.payroll ?? 0),
            payrollTaxes:           parseFloat(ascendExpensesRaw?.totals?.payroll_taxes ?? 0),
            benefits:               parseFloat(ascendExpensesRaw?.totals?.benefits ?? 0),
            amex:                   parseFloat(ascendExpensesRaw?.totals?.amex ?? 0),
            payrollPctOfCollections: ascendExpensesRaw?.ratios?.payroll_pct_of_collections != null
              ? parseFloat(ascendExpensesRaw?.ratios?.payroll_pct_of_collections)
              : null,
            expensePctOfCollections: ascendExpensesRaw?.ratios?.expense_pct_of_collections != null
              ? parseFloat(ascendExpensesRaw?.ratios?.expense_pct_of_collections)
              : null,
            expensePctOfProduction:  ascendExpensesRaw?.ratios?.expense_pct_of_production != null
              ? parseFloat(ascendExpensesRaw?.ratios?.expense_pct_of_production)
              : null,
            _raw: ascendExpensesRaw,
          }
        : null;

      console.info(
        `[useExecutiveOverview] /v2/expenses/summary | ` +
        `totalExpenses=${ascendExpenses?.totalExpenses ?? 'N/A'} | ` +
        `payroll=${ascendExpenses?.payroll ?? 'N/A'} | ` +
        `benefits=${ascendExpenses?.benefits ?? 'N/A'} | ` +
        `payrollPctOfCollections=${ascendExpenses?.payrollPctOfCollections ?? 'N/A'}`
      );

      // Track source errors for UI display
      const sourceErrors = {};
      if (execKPIsResult?.status === 'rejected') {
        sourceErrors.dentrix = execKPIsResult?.reason?.message || 'Dentrix API unavailable';
        console.warn('[useExecutiveOverview] Dentrix KPIs fetch failed:', execKPIsResult?.reason?.message);
      }
      if (kpiDataResult?.status === 'rejected') {
        sourceErrors.dailyEntries = kpiDataResult?.reason?.message || 'Daily entries unavailable';
      }

      // ── CRITICAL: Dentrix values are the PRIMARY source for all financial KPIs ──
      // Supabase daily_entries (kpiData.groupTotals) is for EOD workflow tracking ONLY.
      // NEVER use groupTotals.production or groupTotals.collection
      // as the displayed production/collection KPI values.

      // ── Collection percentage calculation ──────────────────────────────────
      // CRITICAL: Collection % = Total Collections / Net Production (NOT gross)
      // If API provides collectionRate, use it. Otherwise derive from net production.
      let collectionRate = execKPIs?.collectionRate ?? null;
      if (collectionRate === null && execKPIs?.netProduction && execKPIs?.netProduction !== 0) {
        const absCollections = Math.abs(execKPIs?.totalCollections ?? 0);
        const netProd = Math.abs(execKPIs?.netProduction ?? 0);
        collectionRate = netProd > 0 ? (absCollections / netProd) * 100 : null;
      }

      // ── Build unified normalized payload ──────────────────────────────────
      const payload = {
        // ── Dentrix Ascend KPIs — PRIMARY SOURCE FOR ALL FINANCIAL METRICS ──
        // These values come exclusively from Dentrix Ascend → SQLite → FastAPI
        netProduction: execKPIs?.netProduction ?? 0,
        grossProduction: execKPIs?.grossProduction ?? 0,
        totalCollections: execKPIs?.totalCollections ?? 0,
        // Collection % uses NET production as denominator (eAssist definition)
        collectionRate,
        newPatients: execKPIs?.newPatients ?? 0,
        uniquePatients: execKPIs?.uniquePatients ?? 0,
        totalAdjustments: execKPIs?.totalAdjustments ?? 0,
        writeOffs: execKPIs?.writeOffs ?? 0,
        chargeAdjustments: execKPIs?.chargeAdjustments ?? 0,

        // ── Prior year (YoY comparison) ─────────────────────────────────────
        priorNetProduction: execKPIs?.priorNetProduction ?? null,
        priorTotalCollections: execKPIs?.priorTotalCollections ?? null,
        priorNewPatients: execKPIs?.priorNewPatients ?? null,

        // ── Daily entries KPIs (Supabase) — EOD WORKFLOW ONLY ──────────────
        // These are for EOD approval workflow tracking, NOT for live financial KPIs.
        // Do NOT use groupTotals.production or groupTotals.collection for KPI cards.
        groupTotals: kpiData?.groupTotals ?? {},
        officeBreakdown: kpiData?.officeBreakdown ?? [],
        totalEntries: kpiData?.totalEntries ?? 0,

        // ── Expense KPIs ────────────────────────────────────────────────────
        expenseKPIs: expenseKPIs ?? null,

        // ── Ascend /v2/expenses/summary — WF Main Money-Out cash-basis totals ──
        // totalExpenses  → totals.total_expenses (WF Main Money-Out, includes payroll funding)
        // payroll        → totals.payroll (Gusto detail — review only)
        // benefits       → totals.benefits (payroll benefits detail — review only)
        // payrollPctOfCollections → ratios.payroll_pct_of_collections (backend-computed)
        ascendExpenses: ascendExpenses ?? null,

        // ── Data source status ───────────────────────────────────────────────
        // Indicates whether Dentrix API responded successfully
        dentrixApiAvailable: execKPIsResult?.status === 'fulfilled',
        dentrixApiError: sourceErrors?.dentrix || null,
        sourceErrors,

        // ── Metadata ────────────────────────────────────────────────────────
        isAprilPartial: execKPIs?.isAprilPartial ?? false,
        locationId: execKPIs?.locationId ?? null,
        startDate: dr?.startDate,
        endDate: dr?.endDate,
        datePreset: resolvedDatePreset,
        officeIds: resolvedOfficeIds,
        lineOfBusiness: resolvedLOB,
        cacheKey,

        // ── Diagnostics ─────────────────────────────────────────────────────
        _diagnostics: execKPIs?._diagnostics ?? null,
        _fetchedAt: new Date()?.toISOString(),
      };

      lastCacheKeyRef.current = cacheKey;

      console.info(
        `[useExecutiveOverview] FETCH COMPLETE | cacheKey="${cacheKey}" | ` +
        `netProduction=${payload?.netProduction} | ` +
        `totalCollections=${payload?.totalCollections} | ` +
        `collectionRate=${collectionRate?.toFixed(1) ?? 'null'}% | ` +
        `newPatients=${payload?.newPatients} | ` +
        `dentrixAvailable=${payload?.dentrixApiAvailable} | ` +
        `offices=[${resolvedOfficeIds?.join(', ') || 'ALL'}]`
      );

      setData(payload);
      setError(null);
    } catch (err) {
      if (token?.cancelled) return;
      const msg = err?.message || String(err);
      console.error('[useExecutiveOverview] Fetch failed:', msg, { cacheKey });
      setError(msg);
      setData(null);
    } finally {
      if (!token?.cancelled) {
        setLoading(false);
      }
    }
  }, [officeIds, datePreset, lineOfBusiness]);

  // ── Effect: refetch whenever filters change ───────────────────────────────
  // The dependency array includes ALL filter dimensions.
  // Changing any one of them triggers a fresh fetch with the new values.
  // The cacheKey check inside fetch() ensures we never reuse stale data.
  const officeIdsKey = [...(officeIds || [])]?.sort()?.join(',');
  const lobKey = [...(lineOfBusiness || [])]?.sort()?.join(',');

  useEffect(() => {
    if (!enabled) return;
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeIdsKey, datePreset, lobKey, refreshKey, enabled]);

  const refetch = useCallback(() => {
    if (enabled) fetch();
  }, [fetch, enabled]);

  return { data, loading, error, dateRange, refetch };
}

export default useExecutiveOverview;
