/**
 * gustoDataHealthService.js — READ-ONLY Gusto Data Health
 *
 * Provides import freshness, record counts, and data-validation alerts
 * for the Expense Report's Gusto Data Health section.
 *
 * RULES:
 *   - Never triggers a Gusto import
 *   - Never modifies imported Gusto records
 *   - Never exposes credentials, tokens, or employee PII
 *   - All queries are non-blocking (errors return Unknown status, not crashes)
 *
 * TIMESTAMP SOURCE PRIORITY:
 *   Priority 1: gusto_import_logs.completed_at WHERE status = 'completed' or 'success'
 *               — written by gustoImportHelpers.completeImportLog()
 *               — status values: 'processing', 'completed', 'success', 'partial', 'failed', 'cancelled'
 *   Priority 2: Latest partial or failed attempt shown separately
 *   Priority 4: MIN of MAX(imported_at) per required table
 *               — uses the OLDEST per-table maximum (weakest-link freshness)
 *               — used only when gusto_import_logs is empty
 *
 * FRESHNESS THRESHOLDS (daily import cadence):
 *   GREEN  (current)  — last fully successful import ≤ 24 hours ago
 *   YELLOW (stale)    — last fully successful import > 24 h and ≤ 48 h ago
 *   RED    (critical) — last fully successful import > 48 h ago
 *   AMBER  (partial)  — latest import log has status = partial (regardless of age)
 *   RED    (failed)   — latest import attempt failed after last successful import
 *   GRAY   (unknown)  — no authoritative successful-import timestamp available
 *
 * STATUS SEMANTICS:
 *   SUCCESS  — status IN ('completed', 'success') — all required endpoints finished
 *   PARTIAL  — status = 'partial' — some endpoints completed, some failed/incomplete
 *   FAILED   — status IN ('failed', 'cancelled') — import failed or was cancelled
 *   IN_PROGRESS — status = 'processing' — import started but not completed
 *   UNKNOWN  — no authoritative log or recognized status
 */

import { supabase } from '../lib/supabase';

// ── FRESHNESS THRESHOLDS ──────────────────────────────────────────────────────
const STALE_HOURS = 24;
const CRITICAL_HOURS = 48;

// Status values written by gustoImportHelpers.completeImportLog()
// FULLY SUCCESSFUL — all required endpoints completed without failures
const SUCCESS_STATUSES = ['completed', 'success'];

// PARTIAL — some endpoints completed, some failed or incomplete
// MUST NOT be treated as fully successful for freshness calculations
const PARTIAL_STATUSES = ['partial'];

// FAILED — import failed entirely or was cancelled
const FAILED_STATUSES = ['failed', 'cancelled'];

// IN PROGRESS — import started but not yet completed
const IN_PROGRESS_STATUSES = ['processing'];

/**
 * Compute freshness status from a last-successful-import timestamp.
 * partial status is NEVER treated as fully successful.
 *
 * @param {string|null} lastSuccessfulAt — ISO timestamp of last FULLY successful import
 * @param {boolean} latestAttemptFailed  — true if the most recent import attempt failed
 * @param {boolean} latestAttemptPartial — true if the most recent import attempt was partial
 * @param {boolean} isEstimated          — true when using imported_at fallback (not authoritative log)
 * @returns {{ status: string, label: string, color: string, estimated: boolean }}
 */
export function computeFreshnessStatus(
  lastSuccessfulAt,
  latestAttemptFailed = false,
  latestAttemptPartial = false,
  isEstimated = false
) {
  // Partial: latest import completed only some required endpoints
  // Show Partial regardless of age — do not show Current for partial imports
  if (latestAttemptPartial) {
    return { status: 'partial', label: 'Partial', color: 'amber', estimated: isEstimated };
  }

  // Failed: latest attempt failed after last successful import
  if (latestAttemptFailed) {
    return { status: 'failed', label: 'Import Failed', color: 'red', estimated: isEstimated };
  }

  if (!lastSuccessfulAt) {
    return { status: 'unknown', label: 'Unknown', color: 'gray', estimated: isEstimated };
  }

  const ageMs = Date.now() - new Date(lastSuccessfulAt)?.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= STALE_HOURS) {
    return {
      status: 'current',
      label: isEstimated ? 'Estimated Current' : 'Current',
      color: 'green',
      estimated: isEstimated,
    };
  }
  if (ageHours <= CRITICAL_HOURS) {
    return {
      status: 'stale',
      label: isEstimated ? 'Estimated Stale' : 'Stale',
      color: 'yellow',
      estimated: isEstimated,
    };
  }
  return {
    status: 'critical',
    label: isEstimated ? 'Estimated Critical' : 'Critical',
    color: 'red',
    estimated: isEstimated,
  };
}

/**
 * Format a timestamp with America/New_York timezone for display.
 * Example: "July 10, 2026 at 8:42 AM EDT"
 * EDT/EST is resolved automatically by the browser's Intl API.
 */
export function formatImportTimestamp(iso) {
  if (!iso) return null;
  try {
    return new Date(iso)?.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Fetch the per-table MAX(imported_at) for each required Gusto source table.
 *
 * Required tables for the Expense Report:
 *   1. gusto_employees
 *   2. gusto_employee_benefit_enrollments
 *   3. gusto_benefit_plans
 *   4. gusto_payroll_runs
 *
 * CRITICAL: Overall fallback freshness = MIN of the per-table MAX(imported_at).
 * Reason: If payroll runs were updated today but benefits were last updated
 * several days ago, the entire Gusto integration must NOT show Current.
 * The weakest-link (oldest) required-source timestamp governs overall freshness.
 *
 * If a required table has records but no imported_at → mark that source Unknown.
 * If a required table has no records → mark that source as Missing Data.
 *
 * @returns {Promise<{
 *   endpointTimestamps: Object,
 *   overallFallbackTimestamp: string|null,
 *   overallFallbackSource: string|null,
 *   missingTables: string[],
 *   unknownTables: string[],
 *   error: string|null
 * }>}
 */
async function fetchPerTableFallbackTimestamps() {
  const REQUIRED_TABLES = [
    { key: 'gusto_employees',                    label: 'Employees' },
    { key: 'gusto_employee_benefit_enrollments', label: 'Benefit enrollments' },
    { key: 'gusto_benefit_plans',                label: 'Benefit plans' },
    { key: 'gusto_payroll_runs',                 label: 'Payroll runs' },
  ];

  try {
    const queries = REQUIRED_TABLES?.map(({ key }) =>
      supabase
        ?.from(key)
        ?.select('imported_at')
        ?.order('imported_at', { ascending: false })
        ?.limit(1)
        ?.single()
    );

    const results = await Promise.allSettled(queries);

    const endpointTimestamps = {};
    const missingTables = [];
    const unknownTables = [];

    REQUIRED_TABLES?.forEach(({ key, label }, idx) => {
      const r = results?.[idx];
      if (r?.status === 'fulfilled') {
        const { data, error } = r?.value;
        if (error?.code === 'PGRST116') {
          // No rows in table
          missingTables?.push(label);
          endpointTimestamps[key] = { label, timestamp: null, status: 'missing' };
        } else if (error) {
          unknownTables?.push(label);
          endpointTimestamps[key] = { label, timestamp: null, status: 'unknown', error: error?.message?.substring(0, 100) };
        } else if (data?.imported_at) {
          endpointTimestamps[key] = { label, timestamp: data?.imported_at, status: 'ok' };
        } else {
          // Table has records but no imported_at
          unknownTables?.push(label);
          endpointTimestamps[key] = { label, timestamp: null, status: 'unknown' };
        }
      } else {
        unknownTables?.push(label);
        endpointTimestamps[key] = { label, timestamp: null, status: 'unknown', error: r?.reason?.message?.substring(0, 100) };
      }
    });

    // Overall fallback = MIN of the per-table MAX(imported_at) for tables that have data
    // (oldest required-source timestamp governs overall freshness)
    const validTimestamps = Object.values(endpointTimestamps)?.filter(e => e?.status === 'ok' && e?.timestamp)?.map(e => ({ ts: e?.timestamp, key: Object.keys(endpointTimestamps)?.find(k => endpointTimestamps?.[k] === e) }));

    if (!validTimestamps?.length) {
      return { endpointTimestamps, overallFallbackTimestamp: null, overallFallbackSource: null, missingTables, unknownTables, error: null };
    }

    // Sort ascending — oldest first — use the oldest (minimum) timestamp
    validTimestamps?.sort((a, b) => new Date(a.ts)?.getTime() - new Date(b.ts)?.getTime());
    const oldest = validTimestamps?.[0];

    return {
      endpointTimestamps,
      overallFallbackTimestamp: oldest?.ts,
      overallFallbackSource: oldest?.key,
      missingTables,
      unknownTables,
      error: null,
    };
  } catch (err) {
    console.warn('[gustoDataHealthService] Per-table fallback timestamp query failed (non-fatal):', err?.message);
    return {
      endpointTimestamps: {},
      overallFallbackTimestamp: null,
      overallFallbackSource: null,
      missingTables: [],
      unknownTables: [],
      error: err?.message,
    };
  }
}

/**
 * fetchGustoDataHealth — main entry point.
 *
 * Returns all data needed for the Gusto Data Health section:
 *   - Import metadata (last fully successful, last partial, last failed, latest attempt)
 *   - Record counts (employees, active health enrollments, valid payroll runs)
 *   - Per-table endpoint-level timestamps for all 4 required Gusto tables
 *   - Freshness status (partial is NEVER treated as fully successful)
 *   - Data-validation alert flags
 *   - timestampSource: 'import_log' | 'imported_at_fallback' | null
 *   - metadataUnavailable: true when no import log exists and fallback was used
 *
 * @param {{ startDate: string, endDate: string, gustoExcluded?: boolean }} params
 * @returns {Promise<GustoDataHealthResult>}
 */
export async function fetchGustoDataHealth({ startDate, endDate, gustoExcluded = false }) {
  // If Gusto is excluded by the source filter, return a suppressed result
  if (gustoExcluded) {
    return {
      suppressed: true,
      freshnessStatus: null,
      lastSuccessfulImportAt: null,
      lastSuccessfulImportFormatted: null,
      lastPartialImportAt: null,
      lastPartialImportFormatted: null,
      lastFailedImportAt: null,
      latestAttemptStatus: null,
      latestAttemptAt: null,
      latestAttemptFailed: false,
      latestAttemptPartial: false,
      importJobId: null,
      importSource: null,
      timestampSource: null,
      metadataUnavailable: false,
      errorSummary: null,
      totalEmployees: null,
      activeEmployees: null,
      activeHealthEnrollments: null,
      totalBenefitEnrollments: null,
      validPayrollRunsInPeriod: null,
      totalPayrollRunsInPeriod: null,
      endpointTimestamps: {},
      missingTables: [],
      unknownTables: [],
      alerts: [],
      queryError: null,
      isOrgWide: true,
    };
  }

  const result = {
    suppressed: false,
    freshnessStatus: { status: 'unknown', label: 'Unknown', color: 'gray', estimated: false },
    lastSuccessfulImportAt: null,
    lastSuccessfulImportFormatted: null,
    lastPartialImportAt: null,
    lastPartialImportFormatted: null,
    lastFailedImportAt: null,
    latestAttemptStatus: null,
    latestAttemptAt: null,
    latestAttemptFailed: false,
    latestAttemptPartial: false,
    importJobId: null,
    importSource: null,
    // timestampSource: 'import_log' | 'imported_at_fallback' | null
    timestampSource: null,
    // metadataUnavailable: true when gusto_import_logs is empty and fallback was used
    metadataUnavailable: false,
    errorSummary: null,
    totalEmployees: null,
    activeEmployees: null,
    activeHealthEnrollments: null,
    totalBenefitEnrollments: null,
    validPayrollRunsInPeriod: null,
    totalPayrollRunsInPeriod: null,
    // Per-table endpoint-level timestamps for all 4 required Gusto tables
    endpointTimestamps: {},
    missingTables: [],
    unknownTables: [],
    alerts: [],
    queryError: null,
    isOrgWide: true,
  };

  try {
    // ── STEP 1: Import metadata from gusto_import_logs (Priority 1) ───────
    //
    // Actual status values written by gustoImportHelpers:
    //   'processing'  — written by startImportLog (import in progress)
    //   'completed'   — written by completeImportLog (all records processed)
    //   'success'     — alias for completed (fully successful)
    //   'partial'     — some records processed, some failed — NOT fully successful
    //   'failed'      — import failed entirely
    //   'cancelled'   — import was cancelled
    //
    // SUCCESS filter: ['completed', 'success'] ONLY
    // PARTIAL is NOT included in success — it gets its own status classification
    // FAILED filter: ['failed', 'cancelled']
    const { data: importLogs, error: importLogsError } = await supabase
      ?.from('gusto_import_logs')
      ?.select('id, import_type, status, completed_at, started_at, source, error_details, records_inserted, records_updated, records_failed')
      ?.order('started_at', { ascending: false })
      ?.limit(20);

    if (importLogsError) {
      // Log the sanitized error — do not expose raw DB errors to the UI
      const safeMsg = importLogsError?.message
        ?.replace(/Bearer\s+\S+/gi, '[token]')
        ?.replace(/key[=:]\s*\S+/gi, '[key]')
        ?.substring(0, 200);
      console.warn('[gustoDataHealthService] gusto_import_logs query failed (non-fatal):', safeMsg);
      result.queryError = `Import log metadata query failed: ${safeMsg}`;
    } else if (importLogs?.length > 0) {
      // ── Priority 1 path: gusto_import_logs has records ──────────────────
      result.timestampSource = 'import_log';

      // Latest attempt (most recent row regardless of status)
      const latestAttempt = importLogs?.[0];
      result.latestAttemptStatus = latestAttempt?.status;
      result.latestAttemptAt = latestAttempt?.started_at;
      result.importJobId = latestAttempt?.id;
      result.importSource = latestAttempt?.source || null;

      // Last FULLY successful import — status must be 'completed' or 'success'
      // 'partial' is explicitly excluded — it is NOT a fully successful import
      const lastSuccess = importLogs?.find(
        (l) => SUCCESS_STATUSES?.includes(l?.status)
      );
      if (lastSuccess) {
        result.lastSuccessfulImportAt = lastSuccess?.completed_at || lastSuccess?.started_at;
        result.lastSuccessfulImportFormatted = formatImportTimestamp(result?.lastSuccessfulImportAt);
      }

      // Last partial import — shown separately from last successful
      const lastPartial = importLogs?.find(
        (l) => PARTIAL_STATUSES?.includes(l?.status)
      );
      if (lastPartial) {
        result.lastPartialImportAt = lastPartial?.completed_at || lastPartial?.started_at;
        result.lastPartialImportFormatted = formatImportTimestamp(result?.lastPartialImportAt);
      }

      // Last failed import
      const lastFailed = importLogs?.find(
        (l) => FAILED_STATUSES?.includes(l?.status)
      );
      if (lastFailed) {
        result.lastFailedImportAt = lastFailed?.started_at;
        const errDetails = lastFailed?.error_details;
        if (errDetails) {
          const errStr = typeof errDetails === 'string'
            ? errDetails
            : JSON.stringify(errDetails);
          result.errorSummary = errStr
            ?.replace(/Bearer\s+\S+/gi, '[token]')
            ?.replace(/key[=:]\s*\S+/gi, '[key]')
            ?.substring(0, 200);
        }
      }

      // Determine if latest attempt was partial (after any fully successful import)
      // partial is NEVER treated as successful — show Partial status regardless of age
      if (lastPartial) {
        const partialAt = new Date(lastPartial?.started_at)?.getTime();
        const successAt = lastSuccess ? new Date(result.lastSuccessfulImportAt)?.getTime() : 0;
        // Show partial if the partial attempt is the most recent completed attempt
        if (partialAt >= successAt) {
          result.latestAttemptPartial = true;
        }
      }

      // Determine if latest attempt failed AFTER last successful import
      if (lastFailed && !result?.latestAttemptPartial) {
        const failedAt = new Date(lastFailed?.started_at)?.getTime();
        const successAt = lastSuccess ? new Date(result.lastSuccessfulImportAt)?.getTime() : 0;
        if (failedAt > successAt) {
          result.latestAttemptFailed = true;
        } else if (!lastSuccess) {
          result.latestAttemptFailed = true;
        }
      }
    } else {
      // ── Priority 4 fallback: gusto_import_logs is empty ─────────────────
      // The Gusto data was imported via a path that did not call
      // gustoImportHelpers.startImportLog/completeImportLog.
      //
      // Use per-table MAX(imported_at) as a best-effort timestamp.
      // CRITICAL: Use the OLDEST per-table maximum (weakest-link freshness).
      // Do NOT use MAX across all tables — that would show Current even when
      // some required tables have stale data.
      result.metadataUnavailable = true;

      const fallback = await fetchPerTableFallbackTimestamps();
      result.endpointTimestamps = fallback?.endpointTimestamps || {};
      result.missingTables = fallback?.missingTables || [];
      result.unknownTables = fallback?.unknownTables || [];

      if (fallback?.overallFallbackTimestamp) {
        // This is the OLDEST per-table MAX — the weakest-link timestamp
        result.lastSuccessfulImportAt = fallback?.overallFallbackTimestamp;
        result.lastSuccessfulImportFormatted = formatImportTimestamp(fallback?.overallFallbackTimestamp);
        result.timestampSource = 'imported_at_fallback';
        result.importSource = fallback?.overallFallbackSource;
      }
      // If fallback also returns null, lastSuccessfulImportAt stays null → Unknown status
    }

    // Compute freshness status
    // For fallback timestamps: use isEstimated=true so labels show "Estimated Current" etc.
    // partial is NEVER treated as fully successful
    result.freshnessStatus = computeFreshnessStatus(
      result?.lastSuccessfulImportAt,
      result?.latestAttemptFailed,
      result?.latestAttemptPartial,
      result?.metadataUnavailable // isEstimated = true when using fallback
    );

    // ── STEP 2: Employee counts from gusto_employees ──────────────────────
    const [totalEmpResult, activeEmpResult] = await Promise.allSettled([
      supabase?.from('gusto_employees')?.select('id', { count: 'exact', head: true }),
      supabase?.from('gusto_employees')?.select('id', { count: 'exact', head: true })
        ?.eq('status', 'active'),
    ]);

    if (totalEmpResult?.status === 'fulfilled' && !totalEmpResult?.value?.error) {
      result.totalEmployees = totalEmpResult?.value?.count ?? null;
    } else {
      const errMsg = totalEmpResult?.value?.error?.message || totalEmpResult?.reason?.message;
      console.warn('[gustoDataHealthService] Total employee count failed (non-fatal):', errMsg);
    }

    if (activeEmpResult?.status === 'fulfilled' && !activeEmpResult?.value?.error) {
      result.activeEmployees = activeEmpResult?.value?.count ?? null;
    } else {
      const errMsg = activeEmpResult?.value?.error?.message || activeEmpResult?.reason?.message;
      console.warn('[gustoDataHealthService] Active employee count failed (non-fatal):', errMsg);
    }

    // ── STEP 3: Benefit enrollment counts ────────────────────────────────
    const { data: enrollments, error: enrollError } = await supabase
      ?.from('gusto_employee_benefit_enrollments')
      ?.select('id, active, gusto_benefit_plans(benefit_category)')
      ?.eq('active', true);

    if (enrollError) {
      const safeMsg = enrollError?.message?.substring(0, 200);
      console.warn('[gustoDataHealthService] Enrollment count query failed (non-fatal):', safeMsg);
    } else {
      result.totalBenefitEnrollments = enrollments?.length ?? 0;
      result.activeHealthEnrollments = enrollments?.filter((e) => {
        const cat = (e?.gusto_benefit_plans?.benefit_category || '')?.toLowerCase();
        return (
          cat?.includes('health') ||
          cat?.includes('medical') ||
          cat?.includes('dental') ||
          cat?.includes('vision') ||
          cat === ''
        );
      })?.length ?? 0;
    }

    // ── STEP 4: Valid payroll run count for selected period ───────────────
    let payrollQuery = supabase
      ?.from('gusto_payroll_runs')
      ?.select('id, check_date, processed, reversed, needs_reprocessing, processing, total_debit_amount')
      ?.eq('processed', true);

    if (startDate) payrollQuery = payrollQuery?.gte('check_date', startDate);
    if (endDate) payrollQuery = payrollQuery?.lte('check_date', endDate);

    const { data: payrollRuns, error: payrollError } = await payrollQuery;

    if (payrollError) {
      const safeMsg = payrollError?.message?.substring(0, 200);
      console.warn('[gustoDataHealthService] Payroll run count query failed (non-fatal):', safeMsg);
    } else {
      result.totalPayrollRunsInPeriod = payrollRuns?.length ?? 0;
      result.validPayrollRunsInPeriod = payrollRuns?.filter((r) => {
        const reversed = r?.reversed;
        const needsReprocessing = r?.needs_reprocessing;
        const processing = r?.processing;
        return (
          (reversed === false || reversed === null || reversed === undefined) &&
          (needsReprocessing === false || needsReprocessing === null || needsReprocessing === undefined) &&
          (processing === false || processing === null || processing === undefined)
        );
      })?.length ?? 0;
    }

    // ── STEP 5: Build validation alerts ──────────────────────────────────
    result.alerts = [];

    // Alert E: Latest attempt failed after last successful import
    if (result?.latestAttemptFailed && result?.lastSuccessfulImportAt) {
      result?.alerts?.push({
        id: 'GUSTO_IMPORT_FAILED',
        severity: 'error',
        title: 'Latest Import Attempt Failed',
        message: `The latest Gusto import attempt failed. Dashboard values reflect the last fully successful import from ${result?.lastSuccessfulImportFormatted || result?.lastSuccessfulImportAt}.`,
      });
    }

    // Alert for partial import — show which endpoints may be incomplete
    if (result?.latestAttemptPartial) {
      result?.alerts?.push({
        id: 'GUSTO_IMPORT_PARTIAL',
        severity: 'warning',
        title: 'Latest Gusto Import Completed Partially',
        message: 'Latest Gusto import completed partially. Some Gusto datasets may not be current. Dashboard values use the latest available imported records.',
      });
    }

    // Alert for missing required tables (fallback path)
    if (result?.missingTables?.length > 0) {
      result?.alerts?.push({
        id: 'GUSTO_MISSING_REQUIRED_TABLE',
        severity: 'warning',
        title: 'Missing Required Gusto Data',
        message: `The following required Gusto tables have no records: ${result?.missingTables?.join(', ')}. Some Expense Report calculations may be incomplete.`,
      });
    }

    // Note: Alerts A, B, C (zero health benefits, zero payroll funding,
    // reimbursements > funding) require the Expense Report KPI values and
    // are computed in the component after KPIs are loaded, not here.

    return result;
  } catch (err) {
    const safeMsg = err?.message
      ?.replace(/Bearer\s+\S+/gi, '[token]')
      ?.replace(/key[=:]\s*\S+/gi, '[key]')
      ?.substring(0, 200);
    console.error('[gustoDataHealthService] Unexpected error (non-fatal):', safeMsg);
    return {
      ...result,
      freshnessStatus: { status: 'unknown', label: 'Unknown', color: 'gray', estimated: false },
      queryError: 'Gusto data-health status could not be verified. Payroll and benefits figures may still reflect the most recently imported data.',
    };
  }
}
