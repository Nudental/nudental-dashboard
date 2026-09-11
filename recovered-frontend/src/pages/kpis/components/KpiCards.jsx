import React, { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { fmtCurrency, fmtPct, fmtNum } from '../../../services/kpiService';
import { AlertTriangle, Info } from 'lucide-react';

// Progress bar color based on % to goal
const getProgressColor = (pct) => {
  if (pct === null || pct === undefined) return 'bg-muted-foreground/40';
  if (pct >= 100) return 'bg-success';
  if (pct >= 75) return 'bg-warning';
  return 'bg-error';
};

const getProgressBg = (pct) => {
  if (pct === null || pct === undefined) return '';
  if (pct >= 100) return 'bg-success/10';
  if (pct >= 75) return 'bg-warning/10';
  return 'bg-error/10';
};

const getProgressText = (pct) => {
  if (pct === null || pct === undefined) return 'text-muted-foreground';
  if (pct >= 100) return 'text-success';
  if (pct >= 75) return 'text-warning';
  return 'text-error';
};

const KpiCard = ({ label, value, goalValue, pctToGoal, sparklineData, sparklineKey, formatValue, formatGoal, subLabel, subLabelColor, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const clampedPct = pctToGoal !== null && pctToGoal !== undefined ? Math.min(pctToGoal, 100) : null;
  const displayPct = pctToGoal !== null && pctToGoal !== undefined ? pctToGoal?.toFixed(1) : null;

  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2 ${getProgressBg(pctToGoal)}`}>
      {/* Label row */}
      <div className="flex items-center gap-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate flex-1">{label}</p>
        {tooltip && (
          <div className="relative flex-shrink-0">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip((v) => !v)}
              aria-label={`Info about ${label}`}
            >
              <Info size={13} />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-5 z-50 w-64 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs text-foreground leading-relaxed">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>

      {/* Sub-label (e.g. UCR fee, adjustment breakdown) */}
      {subLabel && (
        <p className={`text-xs font-medium ${subLabelColor || 'text-muted-foreground'}`}>{subLabel}</p>
      )}

      {/* Goal row */}
      {goalValue !== null && goalValue !== undefined && goalValue !== 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Goal: {formatGoal ? formatGoal(goalValue) : goalValue}</span>
          {displayPct !== null && (
            <span className={`text-xs font-bold ${getProgressText(pctToGoal)}`}>
              {displayPct}% of goal
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No goal set</div>
      )}

      {/* Progress bar */}
      {clampedPct !== null && (
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${getProgressColor(pctToGoal)}`}
            style={{ width: `${clampedPct}%` }}
          />
        </div>
      )}

      {/* Sparkline */}
      {sparklineData?.length > 0 && (
        <div className="h-10 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey={sparklineKey}
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const KpiCards = ({ summary, goals, sparklineData, loading, patientsSummary, productionSummary, apptSummary }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 })?.map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card shadow-sm p-4 animate-pulse">
            <div className="h-3 bg-muted rounded w-2/3 mb-3" />
            <div className="h-7 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-full mb-2" />
            <div className="h-1.5 bg-muted rounded w-full mb-2" />
            <div className="h-10 bg-muted/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No data for selected period</p>
      </div>
    );
  }

  // Net Production value — what the practice actually earned after adjustments
  // null means the production endpoint failed — show N/A, not $0
  const netProductionVal = productionSummary?.netProduction ?? summary?.production ?? null;
  // UCR / Gross fee — full billed amount before reductions
  const ucrFeeVal = productionSummary?.grossProduction ?? summary?.grossProduction ?? null;

  // ── Production Adjustments ────────────────────────────────────────────────
  const adjustmentsObj = summary?.adjustments;
  const adjustmentsEndpointAvailable = adjustmentsObj?.endpointAvailable === true;
  const totalProductionAdjustments = adjustmentsObj?.totalProductionAdjustments ?? adjustmentsObj?.total;

  let adjustmentsDisplayValue = 'N/A';
  let adjustmentsSubLabel = 'Dentrix adjustment mapping needed';
  let adjustmentsSubLabelColor = 'text-amber-500';

  if (adjustmentsEndpointAvailable && totalProductionAdjustments !== null && totalProductionAdjustments !== undefined) {
    const isReduction = totalProductionAdjustments < 0;
    adjustmentsDisplayValue = isReduction
      ? `-${fmtCurrency(Math.abs(totalProductionAdjustments))}`
      : fmtCurrency(totalProductionAdjustments);
    const writeOffs = adjustmentsObj?.writeOffs;
    if (writeOffs !== null && writeOffs !== undefined) {
      adjustmentsSubLabel = `Write-offs reduction: ${fmtCurrency(Math.abs(writeOffs))}`;
      adjustmentsSubLabelColor = 'text-error';
    } else {
      adjustmentsSubLabel = isReduction ? 'Net production reduction' : 'Net production adjustment';
      adjustmentsSubLabelColor = isReduction ? 'text-error' : 'text-muted-foreground';
    }
  } else if (adjustmentsEndpointAvailable && totalProductionAdjustments === null) {
    adjustmentsDisplayValue = 'N/A';
    adjustmentsSubLabel = 'Dentrix adjustment mapping needed';
    adjustmentsSubLabelColor = 'text-amber-500';
  }

  // ── New Patients ──────────────────────────────────────────────────────────
  const newPatientsVal = patientsSummary?.newPatients ?? summary?.newPatients ?? null;
  const newPatientsDisplay = newPatientsVal !== null ? fmtNum(newPatientsVal) : 'N/A';
  const newPatientsSubLabel = newPatientsVal === null ? 'Dentrix new patient mapping needed' : null;
  const newPatientsSubLabelColor = 'text-amber-500';

  // ── Active Patients ───────────────────────────────────────────────────────
  const activePatientsVal =
    patientsSummary?.activePatients ??
    patientsSummary?.uniquePatients ??
    summary?.activePatients ??
    summary?.uniquePatients ??
    null;
  const activePatientsDisplay = activePatientsVal !== null ? fmtNum(activePatientsVal) : 'N/A';
  const activePatientsSubLabel = activePatientsVal === null
    ? 'Dentrix active/unique patient mapping needed' : 'Unique patients seen in period';
  const activePatientsSubLabelColor = activePatientsVal === null ? 'text-amber-500' : 'text-muted-foreground';

  // ── Broken Appointments ───────────────────────────────────────────────────
  // V728D FIX: Add field aliases — backend may return brokenAppointments, broken_appointments, or totalBroken
  const dentrixBrokenAppts =
    apptSummary?.brokenAppointments ??
    apptSummary?.broken_appointments ??
    apptSummary?.totalBroken ??
    summary?.brokenAppointments ??
    summary?.broken_appointments ??
    summary?.totalBroken ??
    null;
  const brokenApptsDisplay = dentrixBrokenAppts !== null ? fmtNum(dentrixBrokenAppts) : 'N/A';
  let brokenApptsSubLabel = null;
  let brokenApptsSubLabelColor = 'text-muted-foreground';
  if (dentrixBrokenAppts !== null) {
    const broken = apptSummary?.broken ?? summary?.apptBroken ?? null;
    const noShow = apptSummary?.noShow ?? summary?.apptNoShow ?? null;
    if (broken !== null && noShow !== null) {
      brokenApptsSubLabel = `Dentrix: ${fmtNum(broken)} broken + ${fmtNum(noShow)} no-show`;
    } else {
      brokenApptsSubLabel = 'Dentrix: broken + no-show';
    }
  } else {
    brokenApptsSubLabel = 'Dentrix appointment mapping needed';
    brokenApptsSubLabelColor = 'text-amber-500';
  }

  // ── V719D: Treatment Acceptance Rate ─────────────────────────────────────
  // Source: /v2/eod/treatment-plan-completion (Dentrix/FastAPI)
  // Primary: completion_rate_by_value (Dr. G correction — value-based)
  //   = completed treatment plan production value ÷ planned treatment production value
  // Secondary: completion_rate_by_count (tooltip/detail reference only)
  // Do NOT label planned_value/completed_value as "net" — gross posted procedure amounts
  const tarData = summary?.tarData;
  const tarPct = summary?.tarPct ?? null;
  const tarEndpointAvailable = tarData?.endpointAvailable === true;
  const tarByCount = tarData?.completionRateByCount ?? null;
  const tarPlannedCount = tarData?.plannedCount ?? null;
  const tarCompletedCount = tarData?.completedCount ?? null;
  const tarPlannedValue = tarData?.plannedValue ?? null;
  const tarCompletedValue = tarData?.completedValue ?? null;
  const tarIsMature = tarData?.isMature ?? null;
  const tarWarnings = tarData?.warnings ?? [];
  const tarWindowDays = tarData?.completionWindowDays ?? 90;

  // Show maturity warning if is_mature=false or warnings contain maturity warning
  const showMaturityWarning = tarEndpointAvailable && (
    tarIsMature === false ||
    tarWarnings?.some((w) => typeof w === 'string' ? w?.toLowerCase()?.includes('matur')
      : (w?.message || w?.warning || '')?.toLowerCase()?.includes('matur'))
  );

  // TAR display value — primary is completion_rate_by_value
  const tarDisplayValue = tarPct !== null ? fmtPct(tarPct) : (tarEndpointAvailable ? 'N/A' : 'N/A');

  // TAR tooltip content
  // Primary: completion_rate_by_value
  // Secondary: completion_rate_by_count (reference only)
  // planned_value/completed_value are gross posted procedure amounts — do NOT label as net
  const tarTooltipContent = tarEndpointAvailable ? (
    <div className="space-y-1">
      <div className="font-semibold text-xs mb-1">Treatment Acceptance Rate</div>
      <div>By value (primary): {tarPct !== null ? fmtPct(tarPct) : '—'}</div>
      {tarByCount !== null && <div>By count (reference): {fmtPct(tarByCount)}</div>}
      {tarPlannedValue !== null && tarCompletedValue !== null && (
        <div>
          Completed: {fmtCurrency(tarCompletedValue)} of {fmtCurrency(tarPlannedValue)} planned
        </div>
      )}
      {tarPlannedCount !== null && tarCompletedCount !== null && (
        <div>{tarCompletedCount} of {tarPlannedCount} planned treatments completed (count)</div>
      )}
      <div>Completion window: {tarWindowDays} days</div>
      <div className="text-muted-foreground mt-1 pt-1 border-t border-border text-xs">
        Completed treatment plan production value ÷ planned treatment production value. Values are Dentrix posted procedure amounts from treatment plan/completed procedure records. Count-based completion is shown for reference.
      </div>
      <div className="text-muted-foreground text-xs">
        Source: Dentrix/FastAPI /v2/eod/treatment-plan-completion
      </div>
    </div>
  ) : 'Treatment Acceptance Rate — Source: Dentrix/FastAPI /v2/eod/treatment-plan-completion. Not yet available for selected period.';

  const cards = [
    {
      label: 'Net Production',
      value: netProductionVal != null ? fmtCurrency(netProductionVal) : 'N/A',
      goalValue: goals?.production || 0,
      pctToGoal: goals?.production > 0 && netProductionVal != null ? (netProductionVal / goals?.production) * 100 : null,
      sparklineKey: 'production',
      formatValue: fmtCurrency,
      formatGoal: fmtCurrency,
      subLabel: ucrFeeVal != null && ucrFeeVal > 0 ? `UCR: ${fmtCurrency(ucrFeeVal)}` : null,
      subLabelColor: 'text-primary',
    },
    {
      label: 'Prod. Adjustments',
      value: adjustmentsDisplayValue,
      goalValue: null,
      pctToGoal: null,
      sparklineKey: 'adjustments',
      formatValue: fmtCurrency,
      formatGoal: fmtCurrency,
      subLabel: adjustmentsSubLabel,
      subLabelColor: adjustmentsSubLabelColor,
    },
    {
      label: 'Total Collections',
      value: summary?.collections != null ? fmtCurrency(Math.abs(summary?.collections)) : 'N/A',
      goalValue: goals?.collections || 0,
      pctToGoal: goals?.collections > 0 && summary?.collections != null
        ? (Math.abs(summary?.collections) / goals?.collections) * 100
        : null,
      sparklineKey: 'collections',
      formatValue: fmtCurrency,
      formatGoal: fmtCurrency,
    },
    {
      label: 'Collection %',
      value: fmtPct(summary?.collectionPct),
      goalValue: 92,
      pctToGoal: summary?.collectionPct !== null ? (summary?.collectionPct / 92) * 100 : null,
      sparklineKey: 'collectionPct',
      formatValue: fmtPct,
      formatGoal: (v) => `${v}%`,
      subLabel: 'Collections ÷ Net Production',
      subLabelColor: 'text-muted-foreground',
      tooltip: 'Weighted aggregate: total collections ÷ total net production.',
    },
    {
      label: 'New Patients',
      value: newPatientsDisplay,
      goalValue: goals?.newPatients || 0,
      pctToGoal: goals?.newPatients > 0 && newPatientsVal !== null
        ? (newPatientsVal / goals?.newPatients) * 100
        : null,
      sparklineKey: 'newPatients',
      formatValue: fmtNum,
      formatGoal: fmtNum,
      subLabel: newPatientsSubLabel,
      subLabelColor: newPatientsSubLabelColor,
      tooltip: 'New Patients is deduplicated across all selected locations.',
    },
    {
      label: 'Active Patients',
      value: activePatientsDisplay,
      goalValue: null,
      pctToGoal: null,
      sparklineKey: 'activePatients',
      formatValue: fmtNum,
      formatGoal: fmtNum,
      subLabel: activePatientsSubLabel,
      subLabelColor: activePatientsSubLabelColor,
    },
    {
      label: 'Broken Appointments',
      value: brokenApptsDisplay,
      goalValue: null,
      pctToGoal: null,
      sparklineKey: 'brokenAppts',
      formatValue: fmtNum,
      formatGoal: fmtNum,
      subLabel: brokenApptsSubLabel,
      subLabelColor: brokenApptsSubLabelColor,
    },
    {
      label: 'Treatment Acceptance Rate',
      value: tarDisplayValue,
      goalValue: null,
      pctToGoal: null,
      sparklineKey: 'tarPct',
      formatValue: fmtPct,
      formatGoal: (v) => `${v}%`,
      subLabel: tarEndpointAvailable
        ? 'Dentrix/FastAPI treatment plan completion by production value, 90-day window'
        : 'Source: Dentrix/FastAPI /v2/eod/treatment-plan-completion',
      subLabelColor: tarEndpointAvailable ? 'text-muted-foreground' : 'text-amber-500',
      tooltip: tarTooltipContent,
    },
    {
      label: 'Avg Production Per Visit',
      value: summary?.avgProdPerVisit != null
        ? fmtCurrency(summary?.avgProdPerVisit)
        : 'N/A',
      goalValue: null,
      pctToGoal: null,
      sparklineKey: 'avgProdPerVisit',
      formatValue: fmtCurrency,
      formatGoal: fmtCurrency,
      subLabel: 'Net Production ÷ Completed Visits',
      subLabelColor: 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards?.map((card) => (
          <KpiCard
            key={card?.label}
            label={card?.label}
            value={card?.value}
            goalValue={card?.goalValue}
            pctToGoal={card?.pctToGoal}
            sparklineData={sparklineData}
            sparklineKey={card?.sparklineKey}
            formatValue={card?.formatValue}
            formatGoal={card?.formatGoal}
            subLabel={card?.subLabel}
            subLabelColor={card?.subLabelColor}
            tooltip={card?.tooltip}
          />
        ))}
      </div>

      {/* V719B: Maturity warning for Treatment Acceptance Rate */}
      {showMaturityWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            This period&apos;s acceptance rate may still increase — the {tarWindowDays}-day completion window has not closed yet.
          </div>
        </div>
      )}

      {/* V719B: Partial month trend note */}
      <p className="text-xs text-muted-foreground">
        Current month may be partial and can appear lower until the month is complete.
      </p>
    </div>
  );
};

export default KpiCards;
