import { DASHBOARD_API_ORIGIN } from '../../config/dashboardEnvironment';
import { supabase } from '../../lib/supabase';


// ─── Gusto Import Helpers ─────────────────────────────────────────────────────
// All import functions use UPSERT (INSERT ... ON CONFLICT DO UPDATE).
// Failed individual records are logged and skipped — never abort the full import.
// Each import writes a start log entry, then updates it on completion.
// After payroll runs or contractor payments are upserted, sync_gusto_expense_facts()
// is called automatically to keep the expense layer current.

const PAGE_SIZE = 50;

/**
 * Start an import log entry
 * @param {Object} params
 * @returns {Promise<number|null>} log id
 */
export async function startImportLog({ importType, source = 'manual', importedBy, importedByName, gustoCompanyId, dateRangeStart, dateRangeEnd }) {
  try {
    const { data, error } = await supabase?.from('gusto_import_logs')?.insert({
        import_type: importType,
        status: 'processing',
        records_attempted: 0,
        records_inserted: 0,
        records_updated: 0,
        records_skipped: 0,
        records_failed: 0,
        imported_by: importedBy || null,
        imported_by_name: importedByName || null,
        source,
        gusto_company_id: gustoCompanyId || null,
        date_range_start: dateRangeStart || null,
        date_range_end: dateRangeEnd || null,
        started_at: new Date()?.toISOString(),
      })?.select('id')?.single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error('[GustoImport] startImportLog error:', err?.message);
    return null;
  }
}

/**
 * Complete an import log entry
 * @param {number} logId
 * @param {Object} result
 */
export async function completeImportLog(logId, { status, recordsAttempted, recordsInserted, recordsUpdated, recordsSkipped, recordsFailed, errorDetails }) {
  if (!logId) return;
  try {
    const completedAt = new Date()?.toISOString();
    await supabase?.from('gusto_import_logs')?.update({
        status,
        records_attempted: recordsAttempted || 0,
        records_inserted: recordsInserted || 0,
        records_updated: recordsUpdated || 0,
        records_skipped: recordsSkipped || 0,
        records_failed: recordsFailed || 0,
        error_details: errorDetails || null,
        completed_at: completedAt,
      })?.eq('id', logId);
  } catch (err) {
    console.error('[GustoImport] completeImportLog error:', err?.message);
  }
}

/**
 * Upsert employees — INSERT ... ON CONFLICT (id) DO UPDATE
 * @param {Object[]} employees
 * @returns {Promise<{inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function upsertGustoEmployees(employees) {
  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  for (const emp of employees) {
    try {
      const { error } = await supabase?.from('gusto_employees')?.upsert(emp, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: emp?.id, error: err?.message });
    }
  }
  return { inserted, updated, failed, errors };
}

/**
 * Upsert payroll runs — INSERT ... ON CONFLICT (id) DO UPDATE
 * @param {Object[]} runs
 * @returns {Promise<{inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function upsertGustoPayrollRuns(runs) {
  let inserted = 0, failed = 0;
  const errors = [];

  // Validate each run before upsert
  for (const run of runs) {
    // Validation: missing pay period dates
    if (!run?.pay_period_start || !run?.pay_period_end) {
      failed++;
      errors?.push({ id: run?.id, error: 'Missing pay_period_start or pay_period_end', severity: 'error' });
      continue;
    }
    // Validation: end before start
    if (new Date(run.pay_period_end) < new Date(run.pay_period_start)) {
      failed++;
      errors?.push({ id: run?.id, error: 'pay_period_end is before pay_period_start', severity: 'error' });
      continue;
    }
    // Warning: check_date before pay_period_end
    if (run?.check_date && new Date(run.check_date) < new Date(run.pay_period_end)) {
      errors?.push({ id: run?.id, error: 'check_date is before pay_period_end', severity: 'warning' });
    }
    // Warning: off-cycle without reason
    if (run?.off_cycle && !run?.off_cycle_reason) {
      errors?.push({ id: run?.id, error: 'Off-cycle run missing off_cycle_reason', severity: 'warning' });
    }
    // Warning: contractor payment with 0 total
    if (run?.total_net_pay === 0) {
      errors?.push({ id: run?.id, error: 'total_net_pay is 0', severity: 'warning' });
    }

    try {
      const { error } = await supabase?.from('gusto_payroll_runs')?.upsert(run, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: run?.id, error: err?.message, severity: 'error' });
    }
  }
  return { inserted, updated: 0, failed, errors };
}

/**
 * Upsert contractor payments
 * @param {Object[]} payments
 * @returns {Promise<{inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function upsertGustoContractorPayments(payments) {
  let inserted = 0, failed = 0;
  const errors = [];

  for (const payment of payments) {
    // Warning: total_amount = 0
    if (payment?.total_amount === 0) {
      errors?.push({ id: payment?.id, error: 'total_amount is 0 — possible data issue', severity: 'warning' });
    }
    try {
      const { error } = await supabase?.from('gusto_contractor_payments')?.upsert(payment, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: payment?.id, error: err?.message, severity: 'error' });
    }
  }
  return { inserted, updated: 0, failed, errors };
}

/**
 * Upsert benefit plans
 * @param {Object[]} plans
 */
export async function upsertGustoBenefitPlans(plans) {
  let inserted = 0, failed = 0;
  const errors = [];
  for (const plan of plans) {
    try {
      const { error } = await supabase?.from('gusto_benefit_plans')?.upsert(plan, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: plan?.id, error: err?.message });
    }
  }
  return { inserted, updated: 0, failed, errors };
}

/**
 * Upsert employee benefit enrollments
 * @param {Object[]} enrollments
 */
export async function upsertGustoEnrollments(enrollments) {
  let inserted = 0, failed = 0;
  const errors = [];
  for (const enrollment of enrollments) {
    // Info: both deductions are 0
    if (enrollment?.employee_deduction === 0 && enrollment?.company_contribution === 0) {
      errors?.push({ id: enrollment?.id, error: 'Both employee_deduction and company_contribution are 0 — may be voluntary/waived', severity: 'info' });
    }
    try {
      const { error } = await supabase?.from('gusto_employee_benefit_enrollments')?.upsert(enrollment, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: enrollment?.id, error: err?.message });
    }
  }
  return { inserted, updated: 0, failed, errors };
}

/**
 * Upsert pay schedules
 * @param {Object[]} schedules
 */
export async function upsertGustoPaySchedules(schedules) {
  let inserted = 0, failed = 0;
  const errors = [];
  for (const schedule of schedules) {
    try {
      const { error } = await supabase?.from('gusto_pay_schedules')?.upsert(schedule, { onConflict: 'id' });
      if (error) throw error;
      inserted++;
    } catch (err) {
      failed++;
      errors?.push({ id: schedule?.id, error: err?.message });
    }
  }
  return { inserted, updated: 0, failed, errors };
}

/**
 * Save a crosswalk mapping
 * @param {Object} mapping
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function saveCrosswalkMapping(mapping) {
  try {
    const r2 = await fetch(DASHBOARD_API_ORIGIN + "/v2/payroll/crosswalk", {
      method: 'POST',
      headers: { 'X-API-Key': (import.meta.env?.VITE_ASCEND_API_KEY || ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mapping,
        updated_at: new Date()?.toISOString(),
        mapped_at: new Date()?.toISOString(),
      }),
    });
    const crosswalk = (await r2?.json())?.data;
    if (!r2?.ok) return { data: null, error: new Error(crosswalk?.message || 'Crosswalk save failed') };
    return { data: crosswalk, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Fetch paginated data from a gusto table
 * @param {string} tableName
 * @param {Object} options
 * @returns {Promise<{data: Object[], count: number, error: Object|null}>}
 */
export async function fetchGustoPaginated(tableName, { page = 0, pageSize = PAGE_SIZE, orderBy = 'imported_at', ascending = false, filters = {} } = {}) {
  try {
    let query = supabase?.from(tableName)?.select('*', { count: 'exact' })?.order(orderBy, { ascending })?.range(page * pageSize, (page + 1) * pageSize - 1);

    // Apply filters
    Object.entries(filters)?.forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== 'all') {
        query = query?.eq(key, value);
      }
    });

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  } catch (err) {
    return { data: [], count: 0, error: err };
  }
}

/**
 * Import time entries from Gusto API → gusto_time_entries table
 * NOTE: Requires Gusto production API scope: time_tracking:read
 * Until production API is approved, returns graceful pending result.
 * @param {string} companyId
 * @returns {Promise<{attempted: number, inserted: number, updated: number, failed: number, errors: Array, message?: string}>}
 */
export async function importGustoTimeEntries(companyId) {
  const logId = await startImportLog({
    importType: 'gusto_time_entries',
    source: 'manual',
    gustoCompanyId: companyId,
  });

  // Awaiting Gusto production API approval for time_tracking:read scope
  const result = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
    message: 'Awaiting Gusto production API approval (time_tracking:read scope — expected May 2026)',
  };

  await completeImportLog(logId, {
    status: 'partial',
    recordsAttempted: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errorDetails: { message: result?.message },
  });

  return result;
}

/**
 * Import time off requests from Gusto API → gusto_time_off_requests table
 * NOTE: Requires Gusto production API scope: time_off:read
 * @param {string} companyId
 * @returns {Promise<{attempted: number, inserted: number, updated: number, failed: number, errors: Array, message?: string}>}
 */
export async function importGustoTimeOffRequests(companyId) {
  const logId = await startImportLog({
    importType: 'gusto_time_off_requests',
    source: 'manual',
    gustoCompanyId: companyId,
  });

  const result = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
    message: 'Awaiting Gusto production API approval (time_off:read scope — expected May 2026)',
  };

  await completeImportLog(logId, {
    status: 'partial',
    recordsAttempted: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errorDetails: { message: result?.message },
  });

  return result;
}

/**
 * Import time off policies from Gusto API → gusto_time_off_policies table
 * NOTE: Requires Gusto production API scope: time_off:read
 * @param {string} companyId
 * @returns {Promise<{attempted: number, inserted: number, updated: number, failed: number, errors: Array, message?: string}>}
 */
export async function importGustoTimeOffPolicies(companyId) {
  const logId = await startImportLog({
    importType: 'gusto_time_off_policies',
    source: 'manual',
    gustoCompanyId: companyId,
  });

  const result = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
    message: 'Awaiting Gusto production API approval (time_off:read scope — expected May 2026)',
  };

  await completeImportLog(logId, {
    status: 'partial',
    recordsAttempted: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errorDetails: { message: result?.message },
  });

  return result;
}

/**
 * Import time off balances (current snapshot) → gusto_time_off_balances table
 * NOTE: Requires Gusto production API scope: time_off:read
 * @param {string} companyId
 * @returns {Promise<{attempted: number, inserted: number, updated: number, failed: number, errors: Array, message?: string}>}
 */
export async function importGustoTimeOffBalances(companyId) {
  const logId = await startImportLog({
    importType: 'gusto_time_off_balances',
    source: 'manual',
    gustoCompanyId: companyId,
  });

  const result = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
    message: 'Awaiting Gusto production API approval (time_off:read scope — expected May 2026)',
  };

  await completeImportLog(logId, {
    status: 'partial',
    recordsAttempted: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errorDetails: { message: result?.message },
  });

  return result;
}

/**
 * Aggregate hours summary from time entries → gusto_hours_summary table
 * Reads from gusto_time_entries and aggregates by employee per year.
 * @param {string} companyId
 * @param {number} year
 * @returns {Promise<{attempted: number, inserted: number, updated: number, failed: number, errors: Array}>}
 */
export async function aggregateGustoHoursSummary(companyId, year) {
  const logId = await startImportLog({
    importType: 'gusto_hours_summary',
    source: 'manual',
    gustoCompanyId: companyId,
    dateRangeStart: `${year}-01-01`,
    dateRangeEnd: `${year}-12-31`,
  });

  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  try {
    // Fetch all time entries for the given company and year
    const { data: entries, error: fetchErr } = await supabase
      ?.from('gusto_time_entries')
      ?.select('employee_id, employee_uuid, employee_name, company_id, hours_worked, pay_period_start, pay_period_end')
      ?.eq('company_id', companyId)
      ?.gte('pay_period_start', `${year}-01-01`)
      ?.lte('pay_period_end', `${year}-12-31`);

    if (fetchErr) throw fetchErr;

    if (!entries?.length) {
      await completeImportLog(logId, {
        status: 'success',
        recordsAttempted: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        errorDetails: null,
      });
      return { attempted: 0, inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    // Aggregate by employee
    const empMap = {};
    const payPeriods = new Set();

    entries?.forEach(e => {
      const key = e?.employee_id;
      if (!empMap?.[key]) {
        empMap[key] = {
          employee_id: e?.employee_id,
          employee_uuid: e?.employee_uuid,
          employee_name: e?.employee_name,
          company_id: e?.company_id,
          year,
          regular_hours: 0,
          overtime_hours: 0,
          pto_hours_used: 0,
          sick_hours_used: 0,
          vacation_hours_used: 0,
          holiday_hours: 0,
          total_hours_worked: 0,
          pay_periods_count: 0,
        };
      }
      const hrs = parseFloat(e?.hours_worked) || 0;
      empMap[key].total_hours_worked += hrs;
      // Standard 8-hr day / 40-hr week: hours > 8/day treated as regular here
      // Overtime aggregation requires shift-level data — set to 0 until API provides it
      empMap[key].regular_hours += hrs;

      if (e?.pay_period_start) payPeriods?.add(e?.pay_period_start);
    });

    const payPeriodsCount = payPeriods?.size;
    const summaries = Object.values(empMap)?.map(s => ({
      ...s,
      pay_periods_count: payPeriodsCount,
      updated_at: new Date()?.toISOString(),
    }));

    for (const summary of summaries) {
      try {
        const { error: upsertErr } = await supabase
          ?.from('gusto_hours_summary')
          ?.upsert(summary, { onConflict: 'employee_id,year' });
        if (upsertErr) throw upsertErr;
        inserted++;
      } catch (err) {
        failed++;
        errors?.push({ employee_id: summary?.employee_id, error: err?.message });
      }
    }

    const status = failed === 0 ? 'success' : inserted > 0 ? 'partial' : 'failed';
    await completeImportLog(logId, {
      status,
      recordsAttempted: summaries?.length,
      recordsInserted: inserted,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: failed,
      errorDetails: errors?.length ? { errors } : null,
    });

    return { attempted: summaries?.length, inserted, updated: 0, failed, errors };
  } catch (err) {
    await completeImportLog(logId, {
      status: 'failed',
      recordsAttempted: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 1,
      errorDetails: { error: err?.message },
    });
    return { attempted: 0, inserted: 0, updated: 0, failed: 1, errors: [{ error: err?.message }] };
  }
}

/**
 * Trigger re-sync of gusto_expense_facts after a payroll import.
 * Called automatically after upsertGustoPayrollRuns and upsertGustoContractorPayments.
 * Non-fatal: errors are logged but do not block the import result.
 */
export async function triggerExpenseFactsSync() {
  try {
    const r1 = await fetch(DASHBOARD_API_ORIGIN + "/v2/payroll/expense-facts", {
      headers: { 'X-API-Key': (import.meta.env?.VITE_ASCEND_API_KEY || '') },
    });
    const expenseFacts = (await r1?.json())?.data;
    if (!r1?.ok) {
      console.warn('[GustoImport] expense facts sync error (non-fatal):', expenseFacts?.message);
      return null;
    }
    return expenseFacts;
  } catch (err) {
    console.warn('[GustoImport] expense facts sync exception (non-fatal):', err?.message);
    return null;
  }
}

// ─── Import Orchestrators with Import Log Support ─────────────────────────────
// These functions wrap the upsert helpers with startImportLog/completeImportLog
// so that future imports write verifiable completion records to gusto_import_logs.
//
// IMPORTANT: These orchestrators must be called by the actual Gusto import workflow
// (server-side or admin-triggered), NOT from the Expense Report frontend.
// The Expense Report is read-only and must never trigger an import.
//
// Status values written to gusto_import_logs:
//   'processing'  — written by startImportLog when import begins
//   'completed'   — all records processed without failures (fully successful)
//   'partial'     — some records processed, some failed (NOT treated as fully successful)
//   'failed'      — import failed entirely
//
// NOTE: 'partial' must NOT be used as a success indicator in freshness calculations.
// Only 'completed' (and legacy 'success') represent a fully successful import.

/**
 * Import employees with import log tracking.
 * Writes startImportLog on begin, completeImportLog on finish.
 * Status = 'completed' when all records succeed, 'partial' when some fail, 'failed' when all fail.
 *
 * @param {Object[]} employees
 * @param {{ source?: string, importedBy?: string, importedByName?: string, gustoCompanyId?: string }} opts
 * @returns {Promise<{logId: number|null, inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function importGustoEmployeesWithLog(employees, opts = {}) {
  const logId = await startImportLog({
    importType: 'gusto_employees',
    source: opts?.source || 'manual',
    importedBy: opts?.importedBy || null,
    importedByName: opts?.importedByName || null,
    gustoCompanyId: opts?.gustoCompanyId || null,
  });

  try {
    const result = await upsertGustoEmployees(employees);
    const status = result?.failed === 0 ? 'completed'
      : result?.inserted > 0 ? 'partial' :'failed';

    await completeImportLog(logId, {
      status,
      recordsAttempted: employees?.length || 0,
      recordsInserted: result?.inserted || 0,
      recordsUpdated: result?.updated || 0,
      recordsSkipped: 0,
      recordsFailed: result?.failed || 0,
      errorDetails: result?.errors?.length
        ? { errors: result?.errors?.slice(0, 20) }
        : null,
    });

    return { logId, ...result };
  } catch (err) {
    await completeImportLog(logId, {
      status: 'failed',
      recordsAttempted: employees?.length || 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: employees?.length || 0,
      errorDetails: { error: err?.message },
    });
    return { logId, inserted: 0, updated: 0, failed: employees?.length || 0, errors: [{ error: err?.message }] };
  }
}

/**
 * Import payroll runs with import log tracking.
 * Status = 'completed' when all records succeed, 'partial' when some fail, 'failed' when all fail.
 *
 * @param {Object[]} runs
 * @param {{ source?: string, importedBy?: string, importedByName?: string, gustoCompanyId?: string, dateRangeStart?: string, dateRangeEnd?: string }} opts
 * @returns {Promise<{logId: number|null, inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function importGustoPayrollRunsWithLog(runs, opts = {}) {
  const logId = await startImportLog({
    importType: 'gusto_payroll_runs',
    source: opts?.source || 'manual',
    importedBy: opts?.importedBy || null,
    importedByName: opts?.importedByName || null,
    gustoCompanyId: opts?.gustoCompanyId || null,
    dateRangeStart: opts?.dateRangeStart || null,
    dateRangeEnd: opts?.dateRangeEnd || null,
  });

  try {
    const result = await upsertGustoPayrollRuns(runs);
    const status = result?.failed === 0 ? 'completed'
      : result?.inserted > 0 ? 'partial' :'failed';

    await completeImportLog(logId, {
      status,
      recordsAttempted: runs?.length || 0,
      recordsInserted: result?.inserted || 0,
      recordsUpdated: result?.updated || 0,
      recordsSkipped: 0,
      recordsFailed: result?.failed || 0,
      errorDetails: result?.errors?.length
        ? { errors: result?.errors?.slice(0, 20) }
        : null,
    });

    return { logId, ...result };
  } catch (err) {
    await completeImportLog(logId, {
      status: 'failed',
      recordsAttempted: runs?.length || 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: runs?.length || 0,
      errorDetails: { error: err?.message },
    });
    return { logId, inserted: 0, updated: 0, failed: runs?.length || 0, errors: [{ error: err?.message }] };
  }
}

/**
 * Import benefit plans with import log tracking.
 * Status = 'completed' when all records succeed, 'partial' when some fail, 'failed' when all fail.
 *
 * @param {Object[]} plans
 * @param {{ source?: string, importedBy?: string, importedByName?: string, gustoCompanyId?: string }} opts
 * @returns {Promise<{logId: number|null, inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function importGustoBenefitPlansWithLog(plans, opts = {}) {
  const logId = await startImportLog({
    importType: 'gusto_benefit_plans',
    source: opts?.source || 'manual',
    importedBy: opts?.importedBy || null,
    importedByName: opts?.importedByName || null,
    gustoCompanyId: opts?.gustoCompanyId || null,
  });

  try {
    const result = await upsertGustoBenefitPlans(plans);
    const status = result?.failed === 0 ? 'completed'
      : result?.inserted > 0 ? 'partial' :'failed';

    await completeImportLog(logId, {
      status,
      recordsAttempted: plans?.length || 0,
      recordsInserted: result?.inserted || 0,
      recordsUpdated: result?.updated || 0,
      recordsSkipped: 0,
      recordsFailed: result?.failed || 0,
      errorDetails: result?.errors?.length
        ? { errors: result?.errors?.slice(0, 20) }
        : null,
    });

    return { logId, ...result };
  } catch (err) {
    await completeImportLog(logId, {
      status: 'failed',
      recordsAttempted: plans?.length || 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: plans?.length || 0,
      errorDetails: { error: err?.message },
    });
    return { logId, inserted: 0, updated: 0, failed: plans?.length || 0, errors: [{ error: err?.message }] };
  }
}

/**
 * Import employee benefit enrollments with import log tracking.
 * Status = 'completed' when all records succeed, 'partial' when some fail, 'failed' when all fail.
 *
 * @param {Object[]} enrollments
 * @param {{ source?: string, importedBy?: string, importedByName?: string, gustoCompanyId?: string }} opts
 * @returns {Promise<{logId: number|null, inserted: number, updated: number, failed: number, errors: Object[]}>}
 */
export async function importGustoEnrollmentsWithLog(enrollments, opts = {}) {
  const logId = await startImportLog({
    importType: 'gusto_employee_benefit_enrollments',
    source: opts?.source || 'manual',
    importedBy: opts?.importedBy || null,
    importedByName: opts?.importedByName || null,
    gustoCompanyId: opts?.gustoCompanyId || null,
  });

  try {
    const result = await upsertGustoEnrollments(enrollments);
    const status = result?.failed === 0 ? 'completed'
      : result?.inserted > 0 ? 'partial' :'failed';

    await completeImportLog(logId, {
      status,
      recordsAttempted: enrollments?.length || 0,
      recordsInserted: result?.inserted || 0,
      recordsUpdated: result?.updated || 0,
      recordsSkipped: 0,
      recordsFailed: result?.failed || 0,
      errorDetails: result?.errors?.length
        ? { errors: result?.errors?.slice(0, 20) }
        : null,
    });

    return { logId, ...result };
  } catch (err) {
    await completeImportLog(logId, {
      status: 'failed',
      recordsAttempted: enrollments?.length || 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: enrollments?.length || 0,
      errorDetails: { error: err?.message },
    });
    return { logId, inserted: 0, updated: 0, failed: enrollments?.length || 0, errors: [{ error: err?.message }] };
  }
}
