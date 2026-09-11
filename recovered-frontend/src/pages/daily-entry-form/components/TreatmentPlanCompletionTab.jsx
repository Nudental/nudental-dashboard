import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchTreatmentPlanCompletion } from '../../../services/eodTreatmentService';
import { OFFICE_LIST, getOfficeNameById } from '../../../constants/offices';
import { useOffice } from '../../../contexts/OfficeContext';
import {
  safeDisplayNum,
  formatEodCurrency,
  formatEodCount,
} from '../../../services/eodReportService';

const NA = '—';

function fmtPct(value, fallback = NA) {
  if (value === null || value === undefined) return fallback;
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  // Accept both 0-1 fraction and 0-100 percentage
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct?.toFixed(1)}%`;
}

function fmtDays(value, fallback = NA) {
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  return `${Math.round(n)} days`;
}

const ScoreCard = ({ label, value, sub = null, accent = null }) => (
  <div className={`bg-card border rounded-xl p-4 flex flex-col gap-1 ${accent ? `border-l-4 ${accent}` : 'border-border'}`}>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-lg font-bold text-foreground">{value ?? NA}</p>
    {sub && <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>}
  </div>
);

const InfoNote = ({ children, variant = 'blue' }) => {
  const styles = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    gray: 'bg-muted/40 border-border text-muted-foreground',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
  };
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 border rounded-lg text-xs leading-relaxed ${styles?.[variant]}`}>
      <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <Icon name="Loader" size={28} className="animate-spin" color="var(--color-primary)" />
    <p className="text-sm text-muted-foreground">Loading treatment plan completion data…</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
      <Icon name="AlertCircle" size={22} color="var(--color-destructive)" />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold text-foreground mb-1">Failed to load</p>
      <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      <Icon name="RefreshCw" size={14} />Retry
    </button>
  </div>
);

const SectionTable = ({ title, headers, rows, renderRow, emptyMsg = null }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
    {!rows?.length ? (
      <p className="text-xs text-muted-foreground px-4 py-4">{emptyMsg || 'No data available.'}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              {headers?.map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
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
  <td className={`py-2.5 px-3 text-sm ${bold ? 'font-semibold' : ''}`}>{children ?? NA}</td>
);

const TreatmentPlanCompletionTab = ({ selectedOfficeId: propOfficeId, selectedDate: propDate }) => {
  const { canSwitchOffice, selectedOfficeId: ctxOfficeId } = useOffice();

  // Default planned period: Jan 2026 for initial QA
  const [localOfficeId, setLocalOfficeId] = useState(propOfficeId || ctxOfficeId || '');
  const [allOffices, setAllOffices] = useState(false);
  const [plannedStartDate, setPlannedStartDate] = useState('2026-01-01');
  const [plannedEndDate, setPlannedEndDate] = useState('2026-01-31');
  const [completionWindowDays, setCompletionWindowDays] = useState(90);
  const [includeSameDay, setIncludeSameDay] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (propOfficeId && !localOfficeId) setLocalOfficeId(propOfficeId);
  }, [propOfficeId]);

  const doFetch = useCallback(async () => {
    if (!allOffices && !localOfficeId) return;
    if (!plannedStartDate || !plannedEndDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTreatmentPlanCompletion({
        officeId: allOffices ? undefined : localOfficeId,
        allOffices,
        plannedStartDate,
        plannedEndDate,
        completionWindowDays,
        includeOpen: true,
        includeSameDay,
      });
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load treatment plan completion data.');
    } finally {
      setLoading(false);
    }
  }, [localOfficeId, allOffices, plannedStartDate, plannedEndDate, completionWindowDays, includeSameDay, fetchKey]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleRefresh = () => setFetchKey(k => k + 1);

  const summary = data?.summary;
  const maturity = data?.maturity;
  const coverage = data?.coverage;
  const byOffice = data?.by_office || [];
  const byPlanningProvider = data?.by_planning_provider || [];
  const byCompletingProvider = data?.by_completing_provider || [];
  const byCategory = data?.by_category || [];
  const warnings = data?.warnings || [];
  const officeName = getOfficeNameById(localOfficeId) || localOfficeId;

  return (
    <div className="space-y-4">
      {/* Source Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-xl">
        <Icon name="Database" size={15} color="#2563EB" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>Source:</strong> Dentrix/FastAPI patient procedures. Completion rate measures formally treatment-planned procedures only. Direct/walk-in completed procedures are excluded.
        </p>
      </div>
      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Office Picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Office</label>
            {canSwitchOffice ? (
              <select
                value={allOffices ? '__all__' : localOfficeId}
                onChange={e => {
                  if (e?.target?.value === '__all__') {
                    setAllOffices(true);
                    setLocalOfficeId('');
                  } else {
                    setAllOffices(false);
                    setLocalOfficeId(e?.target?.value);
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select office…</option>
                <option value="__all__">All Offices</option>
                {OFFICE_LIST?.map(o => (
                  <option key={o?.id} value={o?.id}>{o?.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm text-foreground">
                <Icon name="Lock" size={13} color="var(--color-muted-foreground)" />
                {officeName || 'Your office'}
              </div>
            )}
          </div>

          {/* Planned Start */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Planned Start Date</label>
            <input
              type="date"
              value={plannedStartDate}
              onChange={e => setPlannedStartDate(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Planned End */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Planned End Date</label>
            <input
              type="date"
              value={plannedEndDate}
              onChange={e => setPlannedEndDate(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Completion Window */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Completion Window</label>
            <select
              value={completionWindowDays}
              onChange={e => setCompletionWindowDays(Number(e?.target?.value))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[30, 60, 90, 180]?.map(d => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <div className="flex items-end">
            <button
              onClick={handleRefresh}
              disabled={loading || (!allOffices && !localOfficeId) || !plannedStartDate || !plannedEndDate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Icon name={loading ? 'Loader' : 'RefreshCw'} size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSameDay}
              onChange={e => setIncludeSameDay(e?.target?.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-xs text-foreground">Include Same-Day Completions</span>
          </label>
        </div>
      </div>
      {/* Maturity Warning */}
      {maturity?.is_mature === false && (
        <InfoNote variant="amber">
          <strong>Maturity Warning:</strong> The selected completion window has not fully elapsed for this planned period. Completion rates may be understated. {maturity?.note || ''}
        </InfoNote>
      )}
      {/* Warnings */}
      {warnings?.length > 0 && (
        <div className="space-y-1.5">
          {warnings?.map((w, i) => (
            <InfoNote key={i} variant="amber">{typeof w === 'string' ? w : w?.message || JSON.stringify(w)}</InfoNote>
          ))}
        </div>
      )}
      {/* Known Limitations */}
      <div className="space-y-1.5">
        <InfoNote variant="gray">No procedure-to-appointment linkage for scheduled-not-completed detection.</InfoNote>
        <InfoNote variant="gray">Cross-office completion is not tracked in this phase.</InfoNote>
        <InfoNote variant="gray">Nightly sync delay may be up to 24 hours.</InfoNote>
        <InfoNote variant="gray">Completion analytics only covers formally treatment-planned procedures, not all completed work.</InfoNote>
      </div>
      {/* Loading / Error */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={handleRefresh} />}
      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Coverage Note */}
          <div className="flex items-start gap-3 px-4 py-3 bg-muted/30 border border-border rounded-xl">
            <Icon name="Info" size={14} color="var(--color-muted-foreground)" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              This scorecard only measures formally treatment-planned procedures. Completion rate of formally treatment-planned procedures only. Direct/walk-in completed procedures are excluded.
            </p>
          </div>

          {/* Coverage Metrics */}
          {coverage && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coverage Metrics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Total Completed Procedures</p>
                  <p className="font-semibold text-foreground">{formatEodCount(coverage?.completed_procedures_total_in_period)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">From Treatment Plan</p>
                  <p className="font-semibold text-foreground">{formatEodCount(coverage?.completed_from_treatment_plan_count)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Direct (No Plan)</p>
                  <p className="font-semibold text-foreground">{formatEodCount(coverage?.direct_completed_without_treatment_plan_count)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Formal Plan Share</p>
                  <p className="font-semibold text-foreground">{fmtPct(coverage?.formal_treatment_plan_completion_share)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <ScoreCard label="Planned Value" value={formatEodCurrency(summary?.planned_value)} accent="border-l-primary" />
            <ScoreCard label="Completed Value" value={formatEodCurrency(summary?.completed_value)} accent="border-l-green-500" />
            <ScoreCard label="Completion Rate (Value)" value={fmtPct(summary?.completion_rate_by_value)} accent="border-l-blue-500" />
            <ScoreCard label="Completion Rate (Count)" value={fmtPct(summary?.completion_rate_by_count)} />
            <ScoreCard label="Open Value" value={formatEodCurrency(summary?.open_value)} />
            <ScoreCard label="Unscheduled Value" value={formatEodCurrency(summary?.unscheduled_value)} />
            <ScoreCard label="Scheduled Not Completed" value={formatEodCurrency(summary?.scheduled_not_completed_value)} />
            <ScoreCard label="Avg Days to Completion" value={fmtDays(summary?.avg_days_to_completion)} />
            <ScoreCard label="Median Days to Completion" value={fmtDays(summary?.median_days_to_completion)} />
          </div>

          {/* By Office Table */}
          {byOffice?.length > 0 && (
            <SectionTable
              title="By Office"
              headers={['Office', 'Planned Value', 'Completed Value', 'Completion % (Value)', 'Completion % (Count)', 'Open Value', 'Unscheduled Value', 'Sched. Not Completed', 'Avg Days', 'Median Days']}
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
            />
          )}

          {/* By Planning Provider Table */}
          {byPlanningProvider?.length > 0 && (
            <SectionTable
              title="By Planning Provider"
              headers={['Provider', 'Planned Value', 'Completed Value', 'Completion % (Value)', 'Completion % (Count)', 'Open Value', 'Avg Days', 'Handoff Count', 'Handoff Value']}
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
                  <Td>{formatEodCount(row?.handoff_count)}</Td>
                  <Td>{formatEodCurrency(row?.handoff_value)}</Td>
                </>
              )}
            />
          )}

          {/* By Completing Provider Table */}
          {byCompletingProvider?.length > 0 && (
            <SectionTable
              title="By Completing Provider"
              headers={['Provider', 'Completed From Own Plans', 'Completed From Others\' Plans', 'Total Completed Value']}
              rows={byCompletingProvider}
              renderRow={row => (
                <>
                  <Td bold>{row?.provider_name ?? row?.provider ?? NA}</Td>
                  <Td>{formatEodCurrency(row?.completed_from_own_plans_value)}</Td>
                  <Td>{formatEodCurrency(row?.completed_from_others_plans_value)}</Td>
                  <Td bold>{formatEodCurrency(row?.total_completed_value)}</Td>
                </>
              )}
            />
          )}

          {/* By Category Table */}
          {byCategory?.length > 0 && (
            <SectionTable
              title="By Category"
              headers={['Category', 'Planned Value', 'Completed Value', 'Completion % (Value)', 'Open Value', 'Avg Days']}
              rows={byCategory}
              renderRow={row => (
                <>
                  <Td bold>{row?.category ?? NA}</Td>
                  <Td>{formatEodCurrency(row?.planned_value)}</Td>
                  <Td>{formatEodCurrency(row?.completed_value)}</Td>
                  <Td bold>{fmtPct(row?.completion_rate_by_value)}</Td>
                  <Td>{formatEodCurrency(row?.open_value)}</Td>
                  <Td>{fmtDays(row?.avg_days_to_completion)}</Td>
                </>
              )}
            />
          )}
        </>
      )}
      {/* Empty state before first load */}
      {!loading && !error && !data && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Icon name="BarChart2" size={28} color="var(--color-muted-foreground)" className="mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select an office and date range, then click Refresh to load completion data.</p>
        </div>
      )}
    </div>
  );
};

export default TreatmentPlanCompletionTab;
