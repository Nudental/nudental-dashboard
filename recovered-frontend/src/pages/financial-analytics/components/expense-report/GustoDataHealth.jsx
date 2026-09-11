/**
 * GustoDataHealth.jsx — Read-only Gusto Data Health section for the Expense Report
 *
 * Displays:
 *   - Freshness badge (Current / Stale / Critical / Partial / Failed / Unknown)
 *   - Last fully successful import timestamp (labeled as such)
 *   - Last partial/failed attempt shown separately
 *   - Per-table endpoint-level timestamps for all 4 required Gusto tables
 *   - Employee count, active health enrollments, valid payroll runs
 *   - Data-validation alerts (non-blocking)
 *   - Expandable technical details
 *
 * RULES:
 *   - Read-only — never triggers a Gusto import
 *   - Non-blocking — errors show Unknown status, never crash the Expense Report
 *   - partial status is NEVER shown as Current or fully successful
 *   - Fallback timestamps are always labeled Estimated
 *   - Does not expose credentials, tokens, or employee PII
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import { fetchGustoDataHealth } from '../../../../services/gustoDataHealthService';

// ── Freshness badge config ────────────────────────────────────────────────────
const FRESHNESS_CONFIG = {
  current:  { label: 'Current',            bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: 'CheckCircle' },
  stale:    { label: 'Stale',              bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   icon: 'Clock' },
  critical: { label: 'Critical',           bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     icon: 'AlertTriangle' },
  partial:  { label: 'Partial',            bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   icon: 'AlertCircle' },
  failed:   { label: 'Import Failed',      bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     icon: 'XCircle' },
  unknown:  { label: 'Unknown',            bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400',   icon: 'HelpCircle' },
};

function FreshnessBadge({ status, estimated }) {
  const cfg = FRESHNESS_CONFIG?.[status] || FRESHNESS_CONFIG?.unknown;
  // For estimated statuses, show the label from computeFreshnessStatus (already prefixed "Estimated X")
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
      {cfg?.label}
      {estimated && status !== 'unknown' && (
        <span className="opacity-70 font-normal">(est.)</span>
      )}
    </span>
  );
}

// ── Alert severity config ─────────────────────────────────────────────────────
const ALERT_CONFIG = {
  error:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'AlertTriangle', iconColor: 'text-red-500' },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'AlertCircle',   iconColor: 'text-amber-500' },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: 'Info',          iconColor: 'text-blue-500' },
};

function AlertBanner({ alert }) {
  const cfg = ALERT_CONFIG?.[alert?.severity] || ALERT_CONFIG?.warning;
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg?.bg} ${cfg?.border}`}>
      <Icon name={cfg?.icon} size={14} className={`flex-shrink-0 mt-0.5 ${cfg?.iconColor}`} />
      <div>
        <p className={`text-xs font-semibold ${cfg?.text}`}>{alert?.title}</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${cfg?.text} opacity-90`}>{alert?.message}</p>
      </div>
    </div>
  );
}

// ── Metric row ────────────────────────────────────────────────────────────────
function MetricRow({ label, value, sourceNote, loading }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span className="text-xs font-semibold text-slate-900 tabular-nums">
        {loading ? (
          <span className="inline-block w-8 h-3 bg-slate-200 rounded animate-pulse" />
        ) : value !== null && value !== undefined ? (
          value
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </span>
    </div>
  );
}

// ── Endpoint timestamp row ────────────────────────────────────────────────────
function EndpointRow({ label, entry, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="inline-block w-24 h-3 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs text-slate-400">—</span>
      </div>
    );
  }

  let displayValue;
  let valueClass = 'text-xs font-medium text-slate-700';

  if (entry?.status === 'missing') {
    displayValue = <span className="text-xs font-medium text-red-600">Missing Data</span>;
  } else if (entry?.status === 'unknown') {
    displayValue = <span className="text-xs font-medium text-amber-600">Unknown</span>;
  } else if (entry?.timestamp) {
    const formatted = new Date(entry.timestamp)?.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    displayValue = <span className={valueClass}>{formatted} <span className="text-slate-400 font-normal">(est.)</span></span>;
  } else {
    displayValue = <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex items-start justify-between py-1.5 border-b border-slate-100 last:border-0 gap-2">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      {displayValue}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const GustoDataHealth = ({
  startDate,
  endDate,
  appliedFilters = {},
  healthBenefitsExpense = null,
  payrollExpense = null,
  payrollReimbursements = null,
  gustoRunsUsed = false,
}) => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const gustoExcluded = appliedFilters?.sourceType
    ? appliedFilters?.sourceType !== 'All Sources' && !appliedFilters?.sourceType?.toLowerCase()?.includes('gusto')
    : false;

  const officeFiltered = appliedFilters?.office && appliedFilters?.office !== 'All Offices';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGustoDataHealth({ startDate, endDate, gustoExcluded });
      setHealth(data);
    } catch (err) {
      console.warn('[GustoDataHealth] fetch error (non-fatal):', err?.message);
      setHealth({
        suppressed: false,
        freshnessStatus: { status: 'unknown', label: 'Unknown', color: 'gray', estimated: false },
        lastSuccessfulImportAt: null,
        lastSuccessfulImportFormatted: null,
        lastPartialImportAt: null,
        lastPartialImportFormatted: null,
        latestAttemptFailed: false,
        latestAttemptPartial: false,
        latestAttemptStatus: null,
        importJobId: null,
        importSource: null,
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
        queryError: 'Gusto data-health status could not be verified. Payroll and benefits figures may still reflect the most recently imported data.',
        isOrgWide: true,
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, gustoExcluded]);

  useEffect(() => { load(); }, [load]);

  if (gustoExcluded) return null;

  const freshnessStatus = health?.freshnessStatus?.status || 'unknown';
  const isEstimated = health?.freshnessStatus?.estimated || health?.metadataUnavailable;
  const isPartial = freshnessStatus === 'partial';

  // ── Cross-validation alerts (computed from KPI values + health data) ──────
  const crossAlerts = [];

  if (gustoRunsUsed && healthBenefitsExpense !== null && payrollExpense !== null && payrollReimbursements !== null) {
    if ((health?.activeHealthEnrollments ?? 0) > 0 && healthBenefitsExpense === 0) {
      crossAlerts?.push({
        id: 'GUSTO_HEALTH_BENEFIT_VALIDATION_FAILED',
        severity: 'error',
        title: 'Health Benefit Data Validation Failed',
        message: 'Active health enrollments were found, but the calculated employer health benefit expense is $0. Review contribution fields and import completeness.',
      });
    }

    if ((health?.validPayrollRunsInPeriod ?? 0) > 0 && payrollExpense === 0) {
      crossAlerts?.push({
        id: 'GUSTO_PAYROLL_FUNDING_VALIDATION_FAILED',
        severity: 'error',
        title: 'Payroll Data Validation Failed',
        message: 'Valid payroll runs were found, but Gusto Payroll Funding is $0.',
      });
    }

    if (payrollReimbursements > 0 && payrollExpense > 0 && payrollReimbursements > payrollExpense) {
      crossAlerts?.push({
        id: 'GUSTO_REIMBURSEMENTS_EXCEED_FUNDING',
        severity: 'error',
        title: 'Payroll Reimbursement Inconsistency',
        message: 'Payroll reimbursement data appears inconsistent because reimbursements exceed total Gusto payroll funding.',
      });
    }
  }

  const allAlerts = [...(health?.alerts || []), ...crossAlerts];

  // ── Endpoint timestamps for the 4 required tables ─────────────────────────
  const endpointTimestamps = health?.endpointTimestamps || {};
  const hasEndpointTimestamps = Object.keys(endpointTimestamps)?.length > 0;

  // ── Collapsed summary strip timestamp label ───────────────────────────────
  const collapsedTimestampLabel = () => {
    if (!health?.lastSuccessfulImportAt) return null;
    if (isEstimated) {
      return (
        <span>
          Estimated latest Gusto data update:{' '}
          <span className="font-medium text-foreground">{health?.lastSuccessfulImportFormatted}</span>
        </span>
      );
    }
    if (isPartial) {
      return (
        <span>
          Last fully successful import:{' '}
          <span className="font-medium text-foreground">{health?.lastSuccessfulImportFormatted}</span>
        </span>
      );
    }
    return (
      <span>
        Last successful import:{' '}
        <span className="font-medium text-foreground">{health?.lastSuccessfulImportFormatted}</span>
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Icon name="Activity" size={13} className="text-emerald-600" />
          </div>
          <span className="text-sm font-semibold text-foreground">Gusto Data Health</span>
          {!loading && (
            <FreshnessBadge
              status={freshnessStatus}
              estimated={isEstimated && freshnessStatus !== 'unknown'}
            />
          )}
          {loading && (
            <span className="inline-block w-16 h-5 bg-slate-200 rounded-full animate-pulse" />
          )}
          {allAlerts?.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
              <Icon name="AlertTriangle" size={10} />
              {allAlerts?.length} alert{allAlerts?.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground flex-shrink-0" />
      </button>

      {/* ── Collapsed summary strip ── */}
      {!expanded && !loading && health && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border/40 pt-2">
          {health?.lastSuccessfulImportAt ? (
            collapsedTimestampLabel()
          ) : (
            <span className="text-slate-500">
              {isEstimated
                ? 'Estimated latest Gusto data update: unavailable' :'Last import timestamp unavailable'}
            </span>
          )}
          {health?.activeEmployees !== null && (
            <span>Employees: <span className="font-medium text-foreground">{health?.activeEmployees?.toLocaleString()}</span></span>
          )}
          {health?.activeHealthEnrollments !== null && (
            <span>Health enrollments: <span className="font-medium text-foreground">{health?.activeHealthEnrollments?.toLocaleString()}</span></span>
          )}
          {health?.validPayrollRunsInPeriod !== null && (
            <span>Payroll runs: <span className="font-medium text-foreground">{health?.validPayrollRunsInPeriod?.toLocaleString()}</span></span>
          )}
        </div>
      )}

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">

          {/* Query error banner */}
          {health?.queryError && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Icon name="AlertCircle" size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">{health?.queryError}</p>
            </div>
          )}

          {/* Org-wide note when office filter is active */}
          {officeFiltered && (
            <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <Icon name="Info" size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Gusto import health and payroll-run records are organization-wide because office-level allocation is not available in the imported payroll-run data.
              </p>
            </div>
          )}

          {/* Validation alerts */}
          {allAlerts?.length > 0 && (
            <div className="space-y-2">
              {allAlerts?.map((alert) => (
                <AlertBanner key={alert?.id} alert={alert} />
              ))}
            </div>
          )}

          {/* Metadata unavailable — neutral informational notice (not a red alert) */}
          {health?.metadataUnavailable && health?.lastSuccessfulImportAt && (
            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <Icon name="Info" size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Gusto records are available, but this import path did not create a verified import log. The timestamps below are estimated from imported record metadata. The overall freshness timestamp uses the <strong>oldest</strong> per-table maximum <em>imported_at</em> across all required Gusto tables (weakest-link freshness).
              </p>
            </div>
          )}
          {health?.metadataUnavailable && !health?.lastSuccessfulImportAt && (
            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <Icon name="Info" size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Gusto records are available and have passed record-count validation, but the current import process does not record a verifiable last-successful timestamp. No import log records were found in <em>gusto_import_logs</em> and no <em>imported_at</em> values were available as a fallback.
              </p>
            </div>
          )}

          {/* Partial import notice */}
          {isPartial && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Icon name="AlertCircle" size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Partial Import</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Latest Gusto import completed partially. Some Gusto datasets may not be current. Dashboard values use the latest available imported records. Current dashboard data may contain a mixture of import times.
                </p>
              </div>
            </div>
          )}

          {/* Import freshness */}
          <div className="bg-muted/20 rounded-lg p-3 space-y-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Import Status</p>

            {/* Last fully successful import — only labeled as such when authoritative */}
            <MetricRow
              label={
                isEstimated
                  ? 'Estimated latest Gusto data update' :'Last successful import'
              }
              value={
                health?.lastSuccessfulImportFormatted
                  ? isEstimated
                    ? health?.lastSuccessfulImportFormatted
                    : health?.lastSuccessfulImportFormatted
                  : null
              }
              loading={loading}
            />

            {/* Freshness status — labeled Estimated when using fallback */}
            <MetricRow
              label="Freshness status"
              value={
                loading ? null :
                health?.freshnessStatus?.label
                  ? health?.freshnessStatus?.label
                  : 'Unknown'
              }
              loading={loading}
            />

            {/* Last partial attempt — shown separately from last successful */}
            {(health?.lastPartialImportAt || health?.lastPartialImportFormatted) && (
              <MetricRow
                label="Latest partial attempt"
                value={health?.lastPartialImportFormatted || null}
                loading={loading}
              />
            )}

            {/* Latest attempt status */}
            <MetricRow
              label="Latest import attempt"
              value={health?.latestAttemptStatus
                ? `${health?.latestAttemptStatus}${health?.latestAttemptAt ? ` — ${new Date(health.latestAttemptAt)?.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : ''}`
                : null}
              loading={loading}
            />

            {/* Source note */}
            {isEstimated && (
              <div className="pt-1.5">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="font-medium">Source:</span>{' '}
                  {health?.importSource
                    ? `Latest imported_at across required Gusto tables (oldest per-table maximum — ${health?.importSource})`
                    : 'Latest imported_at across required Gusto tables (oldest per-table maximum)'}
                </p>
              </div>
            )}
          </div>

          {/* Per-table endpoint-level timestamps (fallback path) */}
          {hasEndpointTimestamps && (
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Endpoint-Level Timestamps
                <span className="ml-1 font-normal normal-case text-slate-400">(estimated from imported_at)</span>
              </p>
              <EndpointRow
                label="Employees last detected import"
                entry={endpointTimestamps?.['gusto_employees']}
                loading={loading}
              />
              <EndpointRow
                label="Benefit enrollments last detected import"
                entry={endpointTimestamps?.['gusto_employee_benefit_enrollments']}
                loading={loading}
              />
              <EndpointRow
                label="Benefit plans last detected import"
                entry={endpointTimestamps?.['gusto_benefit_plans']}
                loading={loading}
              />
              <EndpointRow
                label="Payroll runs last detected import"
                entry={endpointTimestamps?.['gusto_payroll_runs']}
                loading={loading}
              />
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                Overall freshness uses the <strong>oldest</strong> of these timestamps (weakest-link). If payroll runs are current but benefits are stale, the overall status reflects the stale source.
              </p>
            </div>
          )}

          {/* Record counts */}
          <div className="bg-muted/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Records
              {officeFiltered && <span className="ml-1 font-normal normal-case">(organization-wide)</span>}
            </p>
            <MetricRow
              label="Active employees"
              value={health?.activeEmployees !== null ? health?.activeEmployees?.toLocaleString() : null}
              loading={loading}
            />
            <MetricRow
              label="Total imported employees"
              value={health?.totalEmployees !== null ? health?.totalEmployees?.toLocaleString() : null}
              loading={loading}
            />
            <MetricRow
              label="Active health enrollments"
              value={health?.activeHealthEnrollments !== null ? health?.activeHealthEnrollments?.toLocaleString() : null}
              loading={loading}
            />
            <MetricRow
              label="Total active benefit enrollments"
              value={health?.totalBenefitEnrollments !== null ? health?.totalBenefitEnrollments?.toLocaleString() : null}
              loading={loading}
            />
            <MetricRow
              label="Valid payroll runs (selected period)"
              value={health?.validPayrollRunsInPeriod !== null ? health?.validPayrollRunsInPeriod?.toLocaleString() : null}
              loading={loading}
            />
            <MetricRow
              label="Total payroll runs (selected period)"
              value={health?.totalPayrollRunsInPeriod !== null ? health?.totalPayrollRunsInPeriod?.toLocaleString() : null}
              loading={loading}
            />
          </div>

          {/* Expandable technical details */}
          <TechnicalDetails health={health} loading={loading} isEstimated={isEstimated} />

          {/* Source labels */}
          <div className="pt-1">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold">Sources:</span>{' '}
              {isEstimated
                ? <>
                    <em>Estimated latest data update</em> — imported_at fallback (oldest per-table MAX across required Gusto tables; gusto_import_logs is empty){' · '}
                  </>
                : <>
                    Last successful import: <em>gusto_import_logs (completed_at, status = completed/success)</em>{' · '}
                  </>
              }
              Employees: <em>gusto_employees</em> ·{' '}
              Health enrollments: <em>gusto_employee_benefit_enrollments joined to gusto_benefit_plans</em> ·{' '}
              Payroll runs: <em>gusto_payroll_runs (processed=true, check_date in selected period)</em>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Technical details sub-panel ───────────────────────────────────────────────
function TechnicalDetails({ health, loading, isEstimated }) {
  const [open, setOpen] = useState(false);

  if (!health) return null;

  const timestampSourceLabel = health?.timestampSource === 'import_log' ?'gusto_import_logs (completed_at, status = completed/success — partial excluded)'
    : health?.timestampSource === 'imported_at_fallback'
    ? `imported_at fallback — oldest per-table MAX across required Gusto tables (${health?.importSource || 'gusto_employees / gusto_payroll_runs / gusto_employee_benefit_enrollments / gusto_benefit_plans'})`
    : 'No authoritative source found';

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        <span className="text-xs font-medium text-muted-foreground">Technical Details</span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={12} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1 bg-muted/5">
          {[
            ['Import job ID', health?.importJobId !== null ? String(health?.importJobId) : null],
            ['Import source / endpoint', health?.importSource],
            ['Timestamp source', timestampSourceLabel],
            ['Timestamp type', isEstimated ? 'Estimated (imported_at fallback — not verified import log)' : 'Authoritative (gusto_import_logs)'],
            ['Raw UTC timestamp', health?.lastSuccessfulImportAt || null],
            ['Display timezone', 'America/New_York (EDT/EST auto-resolved)'],
            ['Last partial attempt (UTC)', health?.lastPartialImportAt || null],
            ['Last failed attempt', health?.lastFailedImportAt ? new Date(health.lastFailedImportAt)?.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : null],
            ['Error summary', health?.errorSummary],
            ['Partial status treated as success', 'No — partial is classified separately'],
            ['Fallback freshness method', 'MIN of per-table MAX(imported_at) — oldest required-source timestamp'],
          ]?.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-2 py-1 border-b border-border/30 last:border-0">
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}</span>
              <span className="text-[10px] text-foreground text-right break-all">
                {loading ? (
                  <span className="inline-block w-12 h-2.5 bg-slate-200 rounded animate-pulse" />
                ) : value || <span className="text-muted-foreground">—</span>}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground pt-1 leading-relaxed">
            Technical details are for diagnostic use only. Credentials, tokens, and employee personal data are never displayed here.
          </p>
        </div>
      )}
    </div>
  );
}

export default GustoDataHealth;
