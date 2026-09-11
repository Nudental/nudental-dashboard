/**
 * TreatmentPlanCompletionSection.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reports — Treatment Plan Completion
 *
 * Reuses the EXACT same service/endpoint already used by
 * Workflow → EOD → Treatment Plan Completion tab:
 *   fetchTreatmentPlanCompletion() → GET /v2/eod/treatment-plan-completion
 *
 * Reports date filter → plannedStartDate / plannedEndDate
 * Reports office filter → officeId (single) or allOffices=true
 * Completion window: fixed at 90 days (same EOD default, Phase 1)
 *
 * Hard rules:
 *   - No daily_entries
 *   - No MEA
 *   - null/undefined → — (never fake $0)
 *   - Real backend 0 → $0
 *   - No PHI
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchTreatmentPlanCompletion } from '../../../services/eodTreatmentService';
import { formatEodCurrency, safeDisplayNum } from '../../../services/eodReportService';

const NA = '—';
const COMPLETION_WINDOW_DAYS = 90;

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPct(value, fallback = NA) {
  if (value === null || value === undefined) return fallback;
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct?.toFixed(1)}%`;
}

function fmtDays(value, fallback = NA) {
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  return `${Math.round(n)} days`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
const ScoreCard = ({ label, value, accent = null, highlight = false }) => (
  <div
    className={`bg-card border rounded-xl p-4 flex flex-col gap-1 ${
      accent ? `border-l-4 ${accent}` : 'border-border'
    }`}
  >
    <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
    <p className={`text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
      {value ?? NA}
    </p>
  </div>
);

const SectionTable = ({ title, headers, rows, renderRow, emptyMsg = 'No data available.' }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    {!rows?.length ? (
      <p className="text-xs text-muted-foreground px-4 py-4">{emptyMsg}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              {headers?.map(h => (
                <th
                  key={h}
                  className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const Td = ({ children, bold = false }) => (
  <td className={`py-2.5 px-3 text-sm ${bold ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
    {children ?? NA}
  </td>
);

// ── Main Component ────────────────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {string}   props.plannedStartDate  YYYY-MM-DD — from Reports date filter
 * @param {string}   props.plannedEndDate    YYYY-MM-DD — from Reports date filter
 * @param {string[]} props.officeFilter      Reports office filter array (['all'] or [uuid])
 */
const TreatmentPlanCompletionSection = ({ plannedStartDate, plannedEndDate, officeFilter }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Derive allOffices / single officeId from Reports office filter
  const isAllOffices = !officeFilter || officeFilter?.includes('all') || officeFilter?.length === 0;
  const singleOfficeId = !isAllOffices && officeFilter?.length === 1 ? officeFilter?.[0] : null;

  const doFetch = useCallback(async () => {
    if (!plannedStartDate || !plannedEndDate) return;
    if (!isAllOffices && !singleOfficeId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchTreatmentPlanCompletion({
        officeId: isAllOffices ? undefined : singleOfficeId,
        allOffices: isAllOffices,
        plannedStartDate,
        plannedEndDate,
        completionWindowDays: COMPLETION_WINDOW_DAYS,
        includeOpen: true,
        includeSameDay: false,
      });
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load Treatment Plan Completion data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [plannedStartDate, plannedEndDate, isAllOffices, singleOfficeId, fetchKey]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  const handleRetry = () => setFetchKey(k => k + 1);

  const summary = data?.summary;
  const byOffice = data?.by_office || [];
  const byPlanningProvider = data?.by_planning_provider || [];
  const warnings = data?.warnings || [];
  const maturity = data?.maturity;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="ClipboardCheck" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Treatment Plan Completion</h3>
            <p className="text-xs text-muted-foreground">
              Planned treatment completed within selected completion window
            </p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh"
        >
          <Icon name={loading ? 'Loader' : 'RefreshCw'} size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {/* Source Banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-lg">
        <Icon name="Database" size={13} color="#2563EB" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>Source:</strong> Dentrix/FastAPI treatment-planned procedures. Completion rate measures formally
          treatment-planned procedures completed within the selected completion window. Direct/walk-in completed
          procedures are excluded.{' '}
          <span className="font-medium">Completion window: {COMPLETION_WINDOW_DAYS} days.</span>
        </p>
      </div>
      {/* Cohort maturity notice — single soft informational notice, replaces two amber warning boxes */}
      {(maturity?.is_mature === false || warnings?.length > 0) && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <Icon name="Info" size={13} className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              Cohort still maturing: the 90-day completion window has not fully elapsed yet. Completion rates may
              increase as more planned treatment has time to complete.
            </p>
            {maturity?.window_through && (
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Window through: {maturity?.window_through}
              </p>
            )}
          </div>
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Icon name="Loader" size={24} className="animate-spin" color="var(--color-primary)" />
          <p className="text-sm text-muted-foreground">Loading treatment plan completion data…</p>
        </div>
      )}
      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="AlertCircle" size={18} color="var(--color-destructive)" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Failed to load</p>
            <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Icon name="RefreshCw" size={13} />
            Retry
          </button>
        </div>
      )}
      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Primary Rate Cards */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Completion Rates
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard
                label="Completion Rate by Value"
                value={fmtPct(summary?.completion_rate_by_value)}
                accent="border-l-primary"
                highlight
              />
              <ScoreCard
                label="Completion Rate by Count"
                value={fmtPct(summary?.completion_rate_by_count)}
                accent="border-l-blue-500"
              />
            </div>
          </div>

          {/* Supporting Value Cards */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Value Breakdown
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ScoreCard
                label="Planned Value"
                value={formatEodCurrency(summary?.planned_value)}
                accent="border-l-slate-400"
              />
              <ScoreCard
                label="Completed Value"
                value={formatEodCurrency(summary?.completed_value)}
                accent="border-l-green-500"
              />
              <ScoreCard
                label="Open Value"
                value={formatEodCurrency(summary?.open_value)}
              />
              <ScoreCard
                label="Unscheduled Value"
                value={formatEodCurrency(summary?.unscheduled_value)}
              />
              <ScoreCard
                label="Scheduled Not Completed"
                value={formatEodCurrency(summary?.scheduled_not_completed_value)}
              />
            </div>
          </div>

          {/* Days to Completion */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Days to Completion
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1"
                title="Aggregate avg days not returned by source."
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Avg Days to Completion</p>
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-muted-foreground text-[9px] font-bold cursor-default flex-shrink-0"
                    title="Aggregate avg days not returned by source. Per-office values are shown in the By Office table below."
                  >
                    i
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {fmtDays(summary?.avg_days_to_completion)}
                </p>
                {summary?.avg_days_to_completion === null || summary?.avg_days_to_completion === undefined ? (
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Aggregate avg days not returned by source.
                  </p>
                ) : null}
              </div>
              <ScoreCard
                label="Median Days to Completion"
                value={fmtDays(summary?.median_days_to_completion)}
              />
            </div>
          </div>

          {/* By Office Breakdown */}
          {byOffice?.length > 0 && (
            <SectionTable
              title="By Office"
              headers={[
                'Office',
                'Planned Value',
                'Completed Value',
                'Rate (Value)',
                'Rate (Count)',
                'Open Value',
                'Unscheduled',
                'Sched. Not Completed',
                'Avg Days',
                'Median Days',
              ]}
              rows={byOffice}
              renderRow={row => (
                <>
                  <Td bold>{row?.office_name ?? NA}</Td>
                  <Td>{formatEodCurrency(row?.planned_value)}</Td>
                  <Td>{formatEodCurrency(row?.completed_value)}</Td>
                  <Td bold>{fmtPct(row?.completion_rate_by_value)}</Td>
                  <Td>{fmtPct(row?.completion_rate_by_count)}</Td>
                  <Td>{formatEodCurrency(row?.open_value)}</Td>
                  <Td>{formatEodCurrency(row?.unscheduled_value)}</Td>
                  <Td>{formatEodCurrency(row?.scheduled_not_completed_value)}</Td>
                  <Td>{fmtDays(row?.avg_days_to_completion)}</Td>
                  <Td>{fmtDays(row?.median_days_to_completion)}</Td>
                </>
              )}
              emptyMsg="No office data available."
            />
          )}

          {/* By Planning Provider Breakdown */}
          {byPlanningProvider?.length > 0 && (
            <SectionTable
              title="By Planning Provider"
              headers={[
                'Provider',
                'Planned Value',
                'Completed Value',
                'Rate (Value)',
                'Rate (Count)',
                'Open Value',
                'Avg Days',
              ]}
              rows={byPlanningProvider}
              renderRow={row => (
                <>
                  <Td bold>{row?.provider_name ?? row?.provider ?? NA}</Td>
                  <Td>{formatEodCurrency(row?.planned_value)}</Td>
                  <Td>{formatEodCurrency(row?.completed_value)}</Td>
                  <Td bold>{fmtPct(row?.completion_rate_by_value)}</Td>
                  <Td>{fmtPct(row?.completion_rate_by_count)}</Td>
                  <Td>{formatEodCurrency(row?.open_value)}</Td>
                  <Td>{fmtDays(row?.avg_days_to_completion)}</Td>
                </>
              )}
              emptyMsg="No provider data available."
            />
          )}

          {/* Limitations note */}
          <div className="flex items-start gap-2 px-3 py-2 bg-muted/30 border border-border/60 rounded-lg">
            <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Completion analytics covers formally treatment-planned procedures only. Cross-office completion is not
              tracked. Nightly sync delay may be up to 24 hours.
            </p>
          </div>
        </>
      )}
      {/* Empty state — no data yet (before first load or no params) */}
      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icon name="ClipboardCheck" size={24} color="var(--color-muted-foreground)" className="mb-2" />
          <p className="text-sm text-muted-foreground">
            Select a date range and office filter, then the data will load automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default TreatmentPlanCompletionSection;
