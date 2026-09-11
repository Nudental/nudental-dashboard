/**
 * expenseService.js — CANONICAL EXPENSE LAYER
 *
 * Single source of truth for all expense data across the dashboard.
 * Merges:
 *   - Source A: manual daily_entries expenses (expense_source = 'manual')
 *   - Source B: Gusto payroll-derived expenses (expense_source = 'gusto_payroll')
 *
 * CRITICAL RULES:
 * - Never reads from the Payroll UI table directly
 * - Never hardcodes totals
 * - Prevents double-counting via stable source IDs in gusto_expense_facts
 * - All pages must use this service — never compute expenses separately
 */

import { supabase } from '../lib/supabase';
import { normalizeOfficeName } from '../utils/officeNormalizer';

// ── Gusto payroll expense categories (readable labels) ───────────────────────
export const GUSTO_EXPENSE_CATEGORIES = ['Payroll', 'Benefit Paid', 'Contractors Paid', 'Payroll Taxes'];

// ── Category group classification ────────────────────────────────────────────
export const EXPENSE_GROUPS = {
  PAYROLL_GUSTO: 'Payroll / Gusto',
  BACK_STAFF:    'Back Staff Orders / Expenses',
};

/**
 * Classify an expense category into its display group.
 * Gusto-sourced categories always go into 'Payroll / Gusto'.
 * Manual entries use the existing cost_drivers classification.
 */
export function classifyExpenseGroup(category, expenseSource, driverCategoryMap = {}) {
  if (expenseSource === 'gusto_payroll') return EXPENSE_GROUPS?.PAYROLL_GUSTO;
  const driverCat = driverCategoryMap?.[category];
  if (driverCat === 'Payroll / Gusto' || driverCat === 'Payroll/Gusto') return EXPENSE_GROUPS?.PAYROLL_GUSTO;
  const PAYROLL_GUSTO_NAMES = [
    'Gusto Payroll', 'Gusto Payroll Tax', 'Gusto Payroll Reimbursements',
    'Gusto Payroll Individuals', 'Gusto Invoice', 'Payroll Total',
  ];
  if (PAYROLL_GUSTO_NAMES?.includes(category)) return EXPENSE_GROUPS?.PAYROLL_GUSTO;
  return EXPENSE_GROUPS?.BACK_STAFF;
}

/**
 * Build a date range object from a dateFilter preset string.
 */
export function getExpenseDateRange(dateFilter) {
  const now = new Date();
  const year = now?.getFullYear();
  switch (dateFilter) {
    case 'this_month': {
      const start = new Date(year, now.getMonth(), 1);
      const end   = new Date(year, now.getMonth() + 1, 0);
      return { start: start?.toISOString()?.slice(0, 10), end: end?.toISOString()?.slice(0, 10) };
    }
    case 'last_month': {
      const start = new Date(year, now.getMonth() - 1, 1);
      const end   = new Date(year, now.getMonth(), 0);
      return { start: start?.toISOString()?.slice(0, 10), end: end?.toISOString()?.slice(0, 10) };
    }
    case 'this_week': {
      const d = new Date(now);
      const day = d?.getDay();
      const diff = d?.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d.setDate(diff));
      return { start: start?.toISOString()?.slice(0, 10), end: now?.toISOString()?.slice(0, 10) };
    }
    case 'this_quarter': {
      const q = Math.floor(now?.getMonth() / 3);
      const start = new Date(year, q * 3, 1);
      return { start: start?.toISOString()?.slice(0, 10), end: now?.toISOString()?.slice(0, 10) };
    }
    case 'this_year':
      return { start: `${year}-01-01`, end: now?.toISOString()?.slice(0, 10) };
    case 'last_year':
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
    case 'q1_2026': return { start: '2026-01-01', end: '2026-03-31' };
    case 'q2_2026': return { start: '2026-04-01', end: '2026-06-30' };
    case 'q3_2026': return { start: '2026-07-01', end: '2026-09-30' };
    case 'q4_2026': return { start: '2026-10-01', end: '2026-12-31' };
    case 'fy_2025': return { start: '2025-01-01', end: '2025-12-31' };
    case 'ytd_2026':
    default:
      return { start: '2026-01-01', end: `${year}-12-31` };
  }
}

/**
 * Fetch all expense facts for a given date range and optional office filter.
 * Returns both manual and Gusto-derived expenses merged.
 *
 * @param {object} options
 * @param {string} options.startDate  - 'YYYY-MM-DD'
 * @param {string} options.endDate    - 'YYYY-MM-DD'
 * @param {string[]} [options.officeIds] - array of office UUIDs; omit or ['all'] for all
 * @returns {Promise<Array>} normalized expense rows
 */
export async function fetchExpenseFacts({ startDate, endDate, officeIds = [] } = {}) {
  const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');

  // ── Source A: Manual daily_entries ───────────────────────────────────────
  let manualQuery = supabase?.from('daily_entries')?.select('id, entry_date, expense_category, expense_amount, office_id, notes')?.not('expense_amount', 'is', null)?.gt('expense_amount', 0)?.gte('entry_date', startDate)?.lte('entry_date', endDate);

  if (activeOffices?.length > 0) {
    manualQuery = manualQuery?.in('office_id', activeOffices);
  }

  // ── Source B: Gusto expense facts ────────────────────────────────────────
  let gustoQuery = supabase?.from('gusto_expense_facts')?.select('id, expense_date, expense_category, expense_subcategory, expense_amount, expense_source, office_id, office_name, gusto_employee_name, gusto_run_id, pay_period_start, pay_period_end, source_table, source_id, office_mapping_status')?.gte('expense_date', startDate)?.lte('expense_date', endDate);

  if (activeOffices?.length > 0) {
    gustoQuery = gustoQuery?.in('office_id', activeOffices);
  }

  const [manualResult, gustoResult] = await Promise.allSettled([manualQuery, gustoQuery]);

  const manualRows = (manualResult?.status === 'fulfilled' ? manualResult?.value?.data : null) || [];
  const gustoRows  = (gustoResult?.status === 'fulfilled'  ? gustoResult?.value?.data  : null) || [];

  // Normalize manual rows
  const normalizedManual = manualRows?.map(r => ({
    id:                   r?.id,
    expense_date:         r?.entry_date,
    expense_category:     r?.expense_category || 'Uncategorized',
    expense_subcategory:  null,
    expense_amount:       parseFloat(r?.expense_amount) || 0,
    expense_source:       'manual',
    office_id:            r?.office_id,
    office_name:          null,
    gusto_employee_name:  null,
    gusto_run_id:         null,
    pay_period_start:     null,
    pay_period_end:       null,
    source_table:         'daily_entries',
    source_id:            r?.id,
    office_mapping_status: 'resolved',
    notes:                r?.notes,
  }));

  // Normalize Gusto rows
  const normalizedGusto = gustoRows?.map(r => ({
    id:                   r?.id,
    expense_date:         r?.expense_date,
    expense_category:     r?.expense_category,
    expense_subcategory:  r?.expense_subcategory,
    expense_amount:       parseFloat(r?.expense_amount) || 0,
    expense_source:       'gusto_payroll',
    office_id:            r?.office_id,
    office_name:          normalizeOfficeName(r?.office_name) || r?.office_name,
    gusto_employee_name:  r?.gusto_employee_name,
    gusto_run_id:         r?.gusto_run_id,
    pay_period_start:     r?.pay_period_start,
    pay_period_end:       r?.pay_period_end,
    source_table:         r?.source_table,
    source_id:            r?.source_id,
    office_mapping_status: r?.office_mapping_status,
    notes:                null,
  }));

  return [...normalizedManual, ...normalizedGusto];
}

/**
 * Fetch expense totals grouped by category for a date range.
 * Returns both manual and Gusto categories merged.
 *
 * @returns {Promise<{categories: Array, totalExpenses: number, payrollTotal: number, manualTotal: number}>}
 */
export async function fetchExpenseTotals({ startDate, endDate, officeIds = [] } = {}) {
  const rows = await fetchExpenseFacts({ startDate, endDate, officeIds });

  // Fetch cost_drivers for manual category classification
  const { data: drivers } = await supabase?.from('cost_drivers')?.select('name, category')?.eq('is_active', true);

  const driverMap = {};
  (drivers || [])?.forEach(d => { driverMap[d.name] = d?.category; });

  const categoryTotals = {};
  let totalExpenses = 0;
  let payrollTotal  = 0;
  let manualTotal   = 0;

  rows?.forEach(row => {
    const amt = row?.expense_amount || 0;
    const cat = row?.expense_category;
    const group = classifyExpenseGroup(cat, row?.expense_source, driverMap);

    if (!categoryTotals?.[cat]) {
      categoryTotals[cat] = {
        name:          cat,
        value:         0,
        group,
        expense_source: row?.expense_source,
        is_gusto:      row?.expense_source === 'gusto_payroll',
      };
    }
    categoryTotals[cat].value += amt;
    totalExpenses += amt;

    if (row?.expense_source === 'gusto_payroll') payrollTotal += amt;
    else manualTotal += amt;
  });

  const categories = Object.values(categoryTotals)?.sort((a, b) => b?.value - a?.value)?.map(c => ({ ...c, percent: totalExpenses > 0 ? c?.value / totalExpenses : 0 }));

  return { categories, totalExpenses, payrollTotal, manualTotal };
}

/**
 * Fetch expense totals grouped by month for a given year and optional offices.
 * Used by P&L tables and monthly trend charts.
 *
 * @returns {Promise<Array<{month: number, payroll: number, benefits: number, contractors: number, payrollTaxes: number, manual: number, total: number}>>}
 */
export async function fetchMonthlyExpenseTotals({ year, officeIds = [] } = {}) {
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;
  const rows = await fetchExpenseFacts({ startDate, endDate, officeIds });

  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { month: m, payroll: 0, benefits: 0, contractors: 0, payrollTaxes: 0, manual: 0, total: 0 };
  }

  rows?.forEach(row => {
    let m = new Date(row.expense_date + 'T00:00:00')?.getMonth() + 1;
    if (!byMonth?.[m]) return;
    const amt = row?.expense_amount || 0;
    byMonth[m].total += amt;

    if (row?.expense_source === 'gusto_payroll') {
      if (row?.expense_category === 'Payroll')           byMonth[m].payroll      += amt;
      else if (row?.expense_category === 'Benefit Paid') byMonth[m].benefits     += amt;
      else if (row?.expense_category === 'Contractors Paid') byMonth[m].contractors += amt;
      else if (row?.expense_category === 'Payroll Taxes') byMonth[m].payrollTaxes += amt;
    } else {
      byMonth[m].manual += amt;
    }
  });

  return Object.values(byMonth);
}

/**
 * Fetch expense breakdown for office performance KPI cards.
 * Returns total expenses including Gusto payroll for the given office and date range.
 */
export async function fetchOfficeExpenseTotal({ officeId, startDate, endDate } = {}) {
  if (!officeId) return 0;
  const rows = await fetchExpenseFacts({ startDate, endDate, officeIds: [officeId] });
  return rows?.reduce((sum, r) => sum + (r?.expense_amount || 0), 0);
}

/**
 * Fetch Gusto payroll expense summary for reconciliation.
 * Returns totals from gusto_expense_facts and from gusto_payroll_runs for comparison.
 */
export async function fetchGustoExpenseReconciliation({ startDate, endDate, officeId = null } = {}) {
  try {
    const { data, error } = await supabase?.rpc('reconcile_gusto_expenses', {
      p_start_date: startDate,
      p_end_date:   endDate,
      p_office_id:  officeId || null,
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[expenseService] Reconciliation error:', err?.message);
    return null;
  }
}

/**
 * Trigger a re-sync of Gusto expense facts from source tables.
 * Should be called after a Gusto import completes.
 * Super admin only (enforced at DB level via RLS).
 */
export async function syncGustoExpenseFacts() {
  try {
    const { data, error } = await supabase?.rpc('sync_gusto_expense_facts');
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[expenseService] Sync error:', err?.message);
    return null;
  }
}

/**
 * Fetch unresolved office mapping warnings from gusto_expense_facts.
 * Used by admin reconciliation panel.
 */
export async function fetchUnresolvedOfficeWarnings() {
  const { data, error } = await supabase?.from('gusto_expense_facts')?.select('id, expense_category, expense_amount, expense_date, gusto_employee_name, source_table, source_id, office_mapping_status')?.eq('office_mapping_status', 'unassigned')?.order('expense_date', { ascending: false })?.limit(100);

  if (error) {
    console.warn('[expenseService] fetchUnresolvedOfficeWarnings error:', error?.message);
    return [];
  }
  return data || [];
}

export default {
  fetchExpenseFacts,
  fetchExpenseTotals,
  fetchMonthlyExpenseTotals,
  fetchOfficeExpenseTotal,
  fetchGustoExpenseReconciliation,
  syncGustoExpenseFacts,
  fetchUnresolvedOfficeWarnings,
  getExpenseDateRange,
  classifyExpenseGroup,
  GUSTO_EXPENSE_CATEGORIES,
  EXPENSE_GROUPS,
};
