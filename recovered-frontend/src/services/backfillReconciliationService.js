/**
 * backfillReconciliationService.js
 * ══════════════════════════════════════════════════════════════════════════════
 * BACKFILL RECONCILIATION SERVICE — April 2022 → Present
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Reads from:
 *   - public.office_production_summary_monthly  (48-month backfill table)
 *   - public.benchmark_eassist_daily_reports_2026 (eAssist daily workbook rows)
 *   - public.v_48month_production_collections   (aggregate view)
 *
 * Validates Jan–Apr 2026 rows against the Nu Dash comp data Analysis Ledger
 * Report Builder PDF (office_collection_production_summary_jan_apr_2026).
 *
 * Data quality tiers:
 *   'eassist_pdf_validated'  → matched against PDF source-of-truth ✓ *'eassist_daily_report'→ imported from eAssist daily workbook *'estimated_backfill'     → derived from run-rate / seasonal model ⚠
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../lib/supabase';

// ─── PDF Source-of-Truth (Jan–Apr 2026) ───────────────────────────────────────
// Exact values from Nu Dash comp data Analysis Ledger Report Builder PDF.
// Collections stored as negative (as in source report).

export const PDF_SOURCE_OF_TRUTH = {
  // Monthly totals — all offices
  '2026-01': { production: 264476.00, collections: -252116.95 },
  '2026-02': { production: 217135.76, collections: -270306.58 },
  '2026-03': { production: 281819.72, collections: -282965.60 },
  '2026-04': { production: 144606.83, collections: -222032.26 }, // partial through Apr 22

  // Per-office — January 2026
  '2026-01-Barnegat':     { production: 114038.51, collections: -122432.19 },
  '2026-01-Brick':        { production: 63682.69,  collections: -58902.43  },
  '2026-01-Eatontown':    { production: 75899.60,  collections: -62422.66  },
  '2026-01-Staten Island':{ production: 10855.20,  collections: -8359.67   },

  // Per-office — February 2026
  '2026-02-Barnegat':     { production: 71324.71,  collections: -118906.59 },
  '2026-02-Brick':        { production: 77507.98,  collections: -72304.56  },
  '2026-02-Eatontown':    { production: 62148.07,  collections: -74273.53  },
  '2026-02-Staten Island':{ production: 6155.00,   collections: -4821.90   },

  // Per-office — March 2026
  '2026-03-Barnegat':     { production: 114745.18, collections: -112694.38 },
  '2026-03-Brick':        { production: 76047.23,  collections: -71562.61  },
  '2026-03-Eatontown':    { production: 76631.80,  collections: -86919.36  },
  '2026-03-Staten Island':{ production: 14395.51,  collections: -11789.25  },

  // Per-office — April 2026 (partial)
  '2026-04-Barnegat':     { production: 74801.71,  collections: -65630.97  },
  '2026-04-Brick':        { production: 44378.23,  collections: -79432.75  },
  '2026-04-Eatontown':    { production: 52015.77,  collections: -59018.22  },
  '2026-04-Staten Island':{ production: 12411.12,  collections: -17950.32  },
};

const TOLERANCE = 1.00; // $1 tolerance for floating-point comparison

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

/**
 * Returns 'pass' | 'fail' | null for a value vs PDF source-of-truth.
 */
const checkAgainstSoT = (actual, expected) => {
  if (expected == null || actual == null) return null;
  return Math.abs(safeNum(actual) - safeNum(expected)) <= TOLERANCE ? 'pass' : 'fail';
};

/**
 * Build the PDF source-of-truth key for a given period_month + office.
 * period_month is a date string like '2026-01-01'.
 */
const buildSoTKey = (periodMonth, officeName) => {
  if (!periodMonth) return null;
  const ym = periodMonth?.slice(0, 7); // 'YYYY-MM'
  if (officeName) return `${ym}-${officeName}`;
  return ym;
};

// ─── Core Fetch Functions ─────────────────────────────────────────────────────

/**
 * fetchMonthlySummary
 *
 * Returns all rows from office_production_summary_monthly for the given
 * date range and optional office filter.
 *
 * @param {{ startMonth?: string, endMonth?: string, officeCanonical?: string }} params
 * @returns {Promise<Array>}
 */
export const fetchMonthlySummary = async ({
  startMonth = '2022-04-01',
  endMonth   = null,
  officeCanonical = null,
} = {}) => {
  try {
    let query = supabase?.from('office_production_summary_monthly')?.select('*')?.gte('period_month', startMonth)?.order('period_month', { ascending: false })?.order('office_canonical', { ascending: true });

    if (endMonth) {
      query = query?.lte('period_month', endMonth);
    }
    if (officeCanonical) {
      query = query?.eq('office_canonical', officeCanonical);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[backfillReconciliationService] fetchMonthlySummary error:', err?.message);
    return [];
  }
};

/**
 * fetchAggregateView
 *
 * Returns rows from v_48month_production_collections (cross-office monthly totals).
 *
 * @param {{ startMonth?: string, endMonth?: string }} params
 * @returns {Promise<Array>}
 */
export const fetchAggregateView = async ({
  startMonth = '2022-04-01',
  endMonth   = null,
} = {}) => {
  try {
    let query = supabase?.from('v_48month_production_collections')?.select('*')?.gte('period_month', startMonth)?.order('period_month', { ascending: false });

    if (endMonth) {
      query = query?.lte('period_month', endMonth);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[backfillReconciliationService] fetchAggregateView error:', err?.message);
    return [];
  }
};

/**
 * fetchEassistDailyRows
 *
 * Returns rows from benchmark_eassist_daily_reports_2026 for the given
 * date range and optional office filter.
 *
 * @param {{ startDate?: string, endDate?: string, officeCanonical?: string }} params
 * @returns {Promise<Array>}
 */
export const fetchEassistDailyRows = async ({
  startDate = '2026-02-01',
  endDate   = null,
  officeCanonical = null,
} = {}) => {
  try {
    let query = supabase?.from('benchmark_eassist_daily_reports_2026')?.select('*')?.gte('report_date', startDate)?.order('report_date', { ascending: false })?.order('office_canonical', { ascending: true });

    if (endDate) {
      query = query?.lte('report_date', endDate);
    }
    if (officeCanonical) {
      query = query?.eq('office_canonical', officeCanonical);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[backfillReconciliationService] fetchEassistDailyRows error:', err?.message);
    return [];
  }
};

// ─── Reconciliation Logic ─────────────────────────────────────────────────────

/**
 * validateMonthlyRowsAgainstPDF
 *
 * Takes an array of monthly summary rows and annotates each with:
 *   - sotKey: the PDF source-of-truth key used
 *   - sotProduction: expected production from PDF
 *   - sotCollections: expected collections from PDF
 *   - productionCheck: 'pass' | 'fail' | null *   - collectionsCheck:'pass' | 'fail' | null
 *   - isValidated: boolean
 *
 * @param {Array} rows
 * @returns {Array}
 */
export const validateMonthlyRowsAgainstPDF = (rows = []) => {
  return rows?.map((row) => {
    const sotKey = buildSoTKey(row?.period_month, row?.office_canonical);
    const sot = sotKey ? PDF_SOURCE_OF_TRUTH?.[sotKey] : null;

    const productionCheck  = sot ? checkAgainstSoT(row?.net_production,   sot?.production)   : null;
    const collectionsCheck = sot ? checkAgainstSoT(row?.total_collections, sot?.collections)  : null;

    return {
      ...row,
      sotKey,
      sotProduction:    sot?.production   ?? null,
      sotCollections:   sot?.collections  ?? null,
      productionCheck,
      collectionsCheck,
      isValidated: sot != null,
      overallCheck: sot
        ? (productionCheck === 'pass' && collectionsCheck === 'pass' ? 'pass' : 'fail')
        : null,
    };
  });
};

/**
 * getReconciliationStatus
 *
 * Returns a high-level reconciliation status object for the full 48-month dataset.
 *
 * @param {{ startMonth?: string }} params
 * @returns {Promise<ReconciliationStatus>}
 */
export const getReconciliationStatus = async ({ startMonth = '2022-04-01' } = {}) => {
  try {
    const [summaryRows, aggregateRows] = await Promise.all([
      fetchMonthlySummary({ startMonth }),
      fetchAggregateView({ startMonth }),
    ]);

    const annotated = validateMonthlyRowsAgainstPDF(summaryRows);

    const totalRows       = annotated?.length;
    const validatedRows   = annotated?.filter(r => r?.source === 'eassist_pdf_validated')?.length;
    const importedRows    = annotated?.filter(r => r?.source === 'eassist_daily_report')?.length;
    const estimatedRows   = annotated?.filter(r => r?.source === 'estimated_backfill')?.length;

    const pdfChecked      = annotated?.filter(r => r?.isValidated);
    const pdfPassed       = pdfChecked?.filter(r => r?.overallCheck === 'pass')?.length;
    const pdfFailed       = pdfChecked?.filter(r => r?.overallCheck === 'fail')?.length;

    // Coverage: unique (period_month, office_canonical) pairs expected = 48 months × 4 offices = 192
    const expectedRows    = 192;
    const coveragePct     = totalRows > 0 ? Math.round((totalRows / expectedRows) * 100) : 0;

    // Grand totals from aggregate view
    const grandTotals = aggregateRows?.reduce((acc, row) => ({
      totalProduction:  acc?.totalProduction  + safeNum(row?.total_net_production),
      totalCollections: acc?.totalCollections + safeNum(row?.total_collections_abs),
    }), { totalProduction: 0, totalCollections: 0 });

    return {
      totalRows,
      expectedRows,
      coveragePct,
      validatedRows,
      importedRows,
      estimatedRows,
      pdfCheckedCount: pdfChecked?.length,
      pdfPassedCount:  pdfPassed,
      pdfFailedCount:  pdfFailed,
      allPdfPassed:    pdfFailed === 0 && pdfChecked?.length > 0,
      grandTotals,
      annotatedRows: annotated,
      aggregateRows,
      fetchedAt: new Date()?.toISOString(),
    };
  } catch (err) {
    console.error('[backfillReconciliationService] getReconciliationStatus error:', err?.message);
    return {
      totalRows: 0,
      expectedRows: 192,
      coveragePct: 0,
      validatedRows: 0,
      importedRows: 0,
      estimatedRows: 0,
      pdfCheckedCount: 0,
      pdfPassedCount: 0,
      pdfFailedCount: 0,
      allPdfPassed: false,
      grandTotals: { totalProduction: 0, totalCollections: 0 },
      annotatedRows: [],
      aggregateRows: [],
      fetchedAt: new Date()?.toISOString(),
      error: err?.message,
    };
  }
};

/**
 * upsertMonthlyRow
 *
 * Upserts a single monthly summary row (for admin reconciliation imports).
 *
 * @param {object} row
 * @returns {Promise<{ data, error }>}
 */
export const upsertMonthlyRow = async (row) => {
  try {
    const { data, error } = await supabase?.from('office_production_summary_monthly')?.upsert(row, { onConflict: 'period_month,office_canonical' })?.select()?.single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[backfillReconciliationService] upsertMonthlyRow error:', err?.message);
    return { data: null, error: err };
  }
};

/**
 * markRowReconciled
 *
 * Marks a monthly row as reconciled with a timestamp and notes.
 *
 * @param {{ periodMonth: string, officeCanonical: string, notes?: string }} params
 * @returns {Promise<{ data, error }>}
 */
export const markRowReconciled = async ({ periodMonth, officeCanonical, notes = '' }) => {
  try {
    const { data, error } = await supabase?.from('office_production_summary_monthly')?.update({
        reconciled_at: new Date()?.toISOString(),
        reconciliation_notes: notes,
        source: 'eassist_daily_report',
      })?.eq('period_month', periodMonth)?.eq('office_canonical', officeCanonical)?.select()?.single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[backfillReconciliationService] markRowReconciled error:', err?.message);
    return { data: null, error: err };
  }
};

/**
 * getMonthlyRowByPeriodOffice
 *
 * Fetches a single monthly row by period_month + office_canonical.
 *
 * @param {{ periodMonth: string, officeCanonical: string }} params
 * @returns {Promise<object|null>}
 */
export const getMonthlyRowByPeriodOffice = async ({ periodMonth, officeCanonical }) => {
  try {
    const { data, error } = await supabase?.from('office_production_summary_monthly')?.select('*')?.eq('period_month', periodMonth)?.eq('office_canonical', officeCanonical)?.maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[backfillReconciliationService] getMonthlyRowByPeriodOffice error:', err?.message);
    return null;
  }
};
