import React from 'react';
import MetricKpiCard from './MetricKpiCard';
import { fmtCurrency, fmtPct } from '../../../services/kpiService';

const SectionHeader = ({ title, color }) => (
  <div className="mb-4">
    <div className="flex items-center gap-3">
      <div className={`w-1 h-6 rounded-full ${color}`} />
      <h3 className="text-base font-bold text-foreground">{title}</h3>
    </div>
    <div className={`mt-1 h-0.5 w-full ${color} opacity-20 rounded`} />
  </div>
);

const MetricRow = ({ cards, loading }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
    {cards?.map((card) => (
      <MetricKpiCard
        key={card?.label}
        value={card?.value}
        label={card?.label}
        tooltip={card?.tooltip}
        loading={loading}
      />
    ))}
  </div>
);

/**
 * Format a retention/reappointment percentage from the retention endpoint.
 * Rules:
 * - If denominator (base) is zero, null, or undefined → return 'N/A'
 * - If pct is null/undefined → return 'N/A'
 * - Percentage fields are already 0–100 scale — do NOT multiply by 100.
 */
const fmtRetentionPct = (pct, base) => {
  if (base == null || base === 0) return 'N/A';
  if (pct == null) return 'N/A';
  return fmtPct(pct);
};

/**
 * Build numerator/denominator subtitle for retention cards.
 * Returns null if denominator is zero/null (no fake denominator).
 */
const retentionSubtitle = (numerator, denominator) => {
  if (denominator == null || denominator === 0) return null;
  if (numerator == null) return null;
  return `${numerator} / ${denominator}`;
};

/**
 * Format a procedure count — returns the count as a string, or 'N/A' if null/undefined.
 */
const fmtCount = (v) => {
  if (v == null) return 'N/A';
  const n = parseInt(v, 10);
  return isNaN(n) ? 'N/A' : n?.toLocaleString('en-US');
};

/**
 * Format a procedure percentage from the procedure-metrics endpoint.
 * pct is expected as a decimal (e.g. 0.123 = 12.3%) or a percentage value (e.g. 12.3).
 * Backend confirmed: fluoridePct and perioPct are returned as decimal fractions (0–1).
 */
const fmtProcedurePct = (pct) => {
  if (pct == null) return 'N/A';
  const n = parseFloat(pct);
  if (!isFinite(n) || isNaN(n)) return 'N/A';
  // If value is between 0 and 1, treat as decimal fraction; otherwise treat as percentage
  const displayVal = n <= 1 ? n * 100 : n;
  return `${displayVal?.toFixed(1)}%`;
};

// V731B: CDT bucket mapping pending tooltip — kept as fallback only (should not appear post-V731D)
const CDT_MAPPING_PENDING_TOOLTIP = 'CDT bucket mapping pending — backend map refresh required.';
const CDT_MAPPING_PENDING_VALUE = '—';

// V731D: Source label for CDT bucket cards — backend fix complete (sqlite_cdt_direct)
const CDT_DIRECT_SOURCE = 'Source: Dentrix/FastAPI /v2/hygiene/procedure-metrics — sqlite_cdt_direct';

const HygieneSection = ({ data, loading, retentionMetrics, procedureMetrics }) => {
  const d = data || {};
  const dataSource = d?.dataSource || 'unknown';
  const isDentrixUnavailable = dataSource === 'dentrix_unavailable' || dataSource === 'no_dentrix_provider_data';

  // Only display production metrics when Dentrix data is confirmed available
  // null values display as '—' via fmtCurrency/fmtPct
  const avgProdPerDay = d?.avgProdPerDay != null ? fmtCurrency(d?.avgProdPerDay) : '—';
  // V246 — Avg Production per Active Provider Day
  const avgProductionPerActiveProviderDay = d?.avgProductionPerActiveProviderDay;
  const activeProviderDays = d?.activeProviderDays;
  const avgProdPerActiveProviderDayDisplay = avgProductionPerActiveProviderDay != null
    ? fmtCurrency(avgProductionPerActiveProviderDay)
    : 'N/A';
  const avgProdPerActiveProviderDayTooltip = activeProviderDays != null
    ? `Provider-type net production ÷ active provider-days. Active provider-day = provider had at least one completed/chair appointment that day. Active provider-days: ${activeProviderDays}. Source: providerTypeMetrics.hygienist.avgProductionPerActiveProviderDay from /v2/reports/provider-performance.`
    : 'Provider-type net production ÷ active provider-days. Active provider-day = provider had at least one completed/chair appointment that day. Source: providerTypeMetrics.hygienist.avgProductionPerActiveProviderDay from /v2/reports/provider-performance. Shows N/A when backend field is missing.';
  const caseAcceptanceRate = d?.caseAcceptanceRate != null ? fmtPct(d?.caseAcceptanceRate) : '—';
  const txPlansPerDay = d?.txPlansPerDay != null ? d?.txPlansPerDay?.toFixed(1) : '—';
  const avgProdPerHour = d?.avgProdPerHour != null ? fmtCurrency(d?.avgProdPerHour) : '—';

  // PATCH A — providerTypeMetrics.hygienist fields
  const hygieneProductionPerAppointment = d?.hygieneProductionPerAppointment;
  const hygieneAvgAppointmentMinutes = d?.hygieneAvgAppointmentMinutes;

  // Production per Patient Visit — wired to providerTypeMetrics.hygienist.productionPerAppointment
  const prodPerPatientVisit = hygieneProductionPerAppointment != null
    ? fmtCurrency(hygieneProductionPerAppointment)
    : '—';
  const prodPerPatientVisitTooltip = hygieneProductionPerAppointment != null
    ? 'Hygiene net production ÷ completed hygiene appointments. Source: providerTypeMetrics.hygienist.productionPerAppointment from /v2/reports/provider-performance.'
    : 'Hygiene net production ÷ completed hygiene appointments. Source: providerTypeMetrics.hygienist.productionPerAppointment. N/A when providerTypeMetrics not in payload.';

  // ── Procedure metrics from /v2/hygiene/procedure-metrics ──────────────────
  // V731B: Backend response is a flat object, not { data: {...} }.
  // fetchHygieneProcedureMetrics wraps it as { data: result } so procedureMetrics.data
  // is the flat response object. Read confirmed reliable fields only.
  const pm = procedureMetrics?.data || null;
  const procedureEndpointAvailable = procedureMetrics?.endpointAvailable;
  const procedureMultiOfficePending = procedureMetrics?.multiOfficePending === true;

  // V731B: Confirmed reliable fields from flat response root:
  // clinicalDays, hygieneCompletedAppointments, hygieneVisitsPerDay,
  // hygieneProduction, hygieneProductionPerAppointment

  // Patient Visits per Day — confirmed reliable: hygieneVisitsPerDay
  const hygieneVisitsPerDayValue = pm?.hygieneVisitsPerDay;
  const patientVisitsPerDayDisplay = hygieneVisitsPerDayValue != null
    ? parseFloat(hygieneVisitsPerDayValue)?.toFixed(2)
    : 'N/A';
  const patientVisitsPerDaySubtitle =
    pm?.hygieneCompletedAppointments != null && pm?.clinicalDays != null && pm?.clinicalDays > 0
      ? `${pm?.hygieneCompletedAppointments} appts / ${pm?.clinicalDays} days`
      : null;
  const patientVisitsPerDayTooltip = patientVisitsPerDaySubtitle
    ? `Hygiene completed appointments ÷ clinical days. ${patientVisitsPerDaySubtitle}. Source: /v2/hygiene/procedure-metrics (hygieneVisitsPerDay).`
    : 'Hygiene completed appointments ÷ clinical days. Source: /v2/hygiene/procedure-metrics (hygieneVisitsPerDay). Shows N/A when endpoint unavailable or clinicalDays is 0/null.';

  // Hygiene Production — confirmed reliable: hygieneProduction
  const hygieneProductionValue = pm?.hygieneProduction != null ? fmtCurrency(pm?.hygieneProduction) : 'N/A';
  const hygieneProductionTooltip = `Hygienist net production for the period. Source: /v2/hygiene/procedure-metrics (hygieneProduction).`;

  // Hygiene Production per Appointment — confirmed reliable: hygieneProductionPerAppointment
  const hygieneProductionPerApptValue = pm?.hygieneProductionPerAppointment != null
    ? fmtCurrency(pm?.hygieneProductionPerAppointment)
    : 'N/A';
  const hygieneProductionPerApptTooltip = pm?.hygieneProduction != null && pm?.hygieneCompletedAppointments != null
    ? `Hygienist net production ÷ completed hygiene appointments. Production: ${fmtCurrency(pm?.hygieneProduction)}, Appointments: ${pm?.hygieneCompletedAppointments}. Source: /v2/hygiene/procedure-metrics (hygieneProductionPerAppointment).`
    : 'Hygienist net production ÷ completed hygiene appointments. Source: /v2/hygiene/procedure-metrics (hygieneProductionPerAppointment).';

  // ── V731D: CDT bucket fields — now wired from live backend (sqlite_cdt_direct) ──────────────
  // Backend fix (V731C) resolved patient_procedure_map stale join via direct join.
  // source: sqlite_cdt_direct, mappingCoverage: 100.0
  // Rules:
  //   - True backend 0 → display 0 (do not hide real zeros)
  //   - null/undefined → display '—' (unavailable)
  //   - Do NOT show stale "mapping pending" now that backend source is fixed

  // Helper: format a CDT count — true 0 shows as "0", null shows as '—'
  const fmtCdtCount = (v) => {
    if (v == null) return '—';
    const n = parseInt(v, 10);
    return isNaN(n) ? '—' : n?.toLocaleString('en-US');
  };

  // Helper: format a CDT per-day rate — true 0 shows as "0.00", null shows as '—'
  const fmtCdtPerDay = (v) => {
    if (v == null) return '—';
    const n = parseFloat(v);
    return isNaN(n) ? '—' : n?.toFixed(2);
  };

  // Perio % — live from perioPct (decimal 0–1 or percentage 0–100, handled by fmtProcedurePct)
  const perioPctValue = pm?.perioPct != null ? fmtProcedurePct(pm?.perioPct) : '—';
  const perioPctTooltip = `Perio procedures as % of total hygiene procedures. perioPct: ${pm?.perioPct ?? 'null'}, perioCount: ${pm?.perioCount ?? 'null'}, hygieneBaseCount: ${pm?.hygieneBaseCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Avg FMX per Day — live from fmxPerDay
  const avgFmxPerDay = pm?.fmxPerDay != null ? fmtCdtPerDay(pm?.fmxPerDay) : '—';
  const avgFmxTooltip = `Full mouth X-ray procedures ÷ clinical days. fmxPerDay: ${pm?.fmxPerDay ?? 'null'}, fmxCount: ${pm?.fmxCount ?? 'null'}, clinicalDays: ${pm?.clinicalDays ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Avg SRP per Day — live from srpPerDay
  const avgSrpPerDay = pm?.srpPerDay != null ? fmtCdtPerDay(pm?.srpPerDay) : '—';
  const avgSrpTooltip = `Scaling & root planing procedures ÷ clinical days. srpPerDay: ${pm?.srpPerDay ?? 'null'}, srpCount: ${pm?.srpCount ?? 'null'}, clinicalDays: ${pm?.clinicalDays ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Sealants Count — live from sealantCount
  const sealantsCount = pm?.sealantCount != null ? fmtCdtCount(pm?.sealantCount) : '—';
  const sealantsTooltip = `Total sealant procedures in period. sealantCount: ${pm?.sealantCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Whitening Count — live from whiteningCount (D9975/D9976 family)
  const whiteningCount = pm?.whiteningCount != null ? fmtCdtCount(pm?.whiteningCount) : '—';
  const whiteningTooltip = `Total whitening procedures in period. whiteningCount: ${pm?.whiteningCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Antimicrobial Count — live from antimicrobialCount (D4381 family)
  const antimicrobialCount = pm?.antimicrobialCount != null ? fmtCdtCount(pm?.antimicrobialCount) : '—';
  const antimicrobialTooltip = `Total antimicrobial placement procedures (D4381 family) in period. antimicrobialCount: ${pm?.antimicrobialCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Hygiene Production per Procedure — live from hygieneProductionPerProcedure
  const hygieneProductionPerProc = pm?.hygieneProductionPerProcedure != null
    ? fmtCurrency(pm?.hygieneProductionPerProcedure)
    : '—';
  const hygieneProductionPerProcTooltip = `Hygiene production ÷ total hygiene procedure count. hygieneProductionPerProcedure: ${pm?.hygieneProductionPerProcedure ?? 'null'}, hygieneProcedureCount: ${pm?.hygieneProcedureCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // Fluoride % — live from fluoridePct (decimal 0–1 or percentage 0–100, handled by fmtProcedurePct)
  const fluoridePctValue = pm?.fluoridePct != null ? fmtProcedurePct(pm?.fluoridePct) : '—';
  const fluoridePctTooltip = `Fluoride procedures as % of hygiene base count. fluoridePct: ${pm?.fluoridePct ?? 'null'}, fluorideCount: ${pm?.fluorideCount ?? 'null'}, hygieneBaseCount: ${pm?.hygieneBaseCount ?? 'null'}. ${CDT_DIRECT_SOURCE}.`;

  // ── Retention metrics from /v2/hygiene/retention-metrics ──────────────────
  // V731B: Backend response is a flat object, not { data: {...} }.
  // fetchHygieneRetentionMetrics wraps it as { data: result } so retentionMetrics.data
  // is the flat response object. Read fields directly from rm (the flat root).
  // Percentage fields are already 0–100 scale — do NOT multiply by 100.
  const rm = retentionMetrics?.data || null;
  const retentionEndpointAvailable = retentionMetrics?.endpointAvailable;
  const multiOfficePending = retentionMetrics?.multiOfficeAggregationPending === true;

  // Hygiene Reappointment %
  // V731B: hygieneReappointmentPct is 0–100 scale — do not multiply. Use hygieneCompletedVisits as denominator guard.
  const hygieneReappointmentPct = fmtRetentionPct(rm?.hygieneReappointmentPct, rm?.hygieneCompletedVisits);
  const hygieneReappointmentSubtitle = retentionSubtitle(null, rm?.hygieneCompletedVisits);

  // Perio Reappointment %
  // V731B: If perioCompletedVisits = 0 and perioReappointmentPct = null → show — with tooltip "No perio hygiene visits in selected period"
  const perioHasNoVisits = (rm?.perioCompletedVisits === 0 || rm?.perioCompletedVisits === null) && rm?.perioReappointmentPct == null;
  const perioReappointmentPct = perioHasNoVisits
    ? '—'
    : fmtRetentionPct(rm?.perioReappointmentPct, rm?.perioCompletedVisits);
  const perioReappointmentTooltip = perioHasNoVisits
    ? 'No perio hygiene visits in selected period.'
    : `Perio patients rebooked ÷ completed perio visits. Source: /v2/hygiene/retention-metrics.${rm?.perioCompletedVisits != null ? ` (visits: ${rm?.perioCompletedVisits})` : ''}`;

  // Adult Hygiene Retention 6mo
  const adultRetention6moPct = fmtRetentionPct(rm?.adultHygieneRetention6moPct, rm?.adultHygieneRetention6moBase);
  const adultRetention6moSubtitle = retentionSubtitle(rm?.adultHygieneRetention6moReturned, rm?.adultHygieneRetention6moBase);

  // Adult Hygiene Retention 12mo
  const adultRetention12moPct = fmtRetentionPct(rm?.adultHygieneRetention12moPct, rm?.adultHygieneRetention12moBase);
  const adultRetention12moSubtitle = retentionSubtitle(rm?.adultHygieneRetention12moReturned, rm?.adultHygieneRetention12moBase);

  // Child Hygiene Retention 6mo
  const childRetention6moPct = fmtRetentionPct(rm?.childHygieneRetention6moPct, rm?.childHygieneRetention6moBase);
  const childRetention6moSubtitle = retentionSubtitle(rm?.childHygieneRetention6moReturned, rm?.childHygieneRetention6moBase);

  // Child Hygiene Retention 12mo
  const childRetention12moPct = fmtRetentionPct(rm?.childHygieneRetention12moPct, rm?.childHygieneRetention12moBase);
  const childRetention12moSubtitle = retentionSubtitle(rm?.childHygieneRetention12moReturned, rm?.childHygieneRetention12moBase);

  // Build tooltip suffix for retention cards
  const retentionTooltipSuffix = multiOfficePending
    ? ' Multi-office aggregation pending — N/A shown.'
    : retentionEndpointAvailable === false
    ? 'Endpoint unavailable — N/A shown.' : '';

  const row1 = [
    {
      label: 'Perio %',
      value: perioPctValue,
      tooltip: perioPctTooltip,
    },
    { label: 'Avg Production per Day', value: avgProdPerDay, tooltip: 'Total hygiene net production divided by number of days. Source: Dentrix Ascend.' },
    {
      label: 'Avg Production per Active Provider Day',
      value: avgProdPerActiveProviderDayDisplay,
      tooltip: avgProdPerActiveProviderDayTooltip,
    },
    { label: 'Production per Patient Visit', value: prodPerPatientVisit, tooltip: prodPerPatientVisitTooltip },
    {
      label: 'Avg FMX per Day',
      value: avgFmxPerDay,
      tooltip: avgFmxTooltip,
    },
  ];

  const row2 = [
    {
      label: 'Avg SRP per Day',
      value: avgSrpPerDay,
      tooltip: avgSrpTooltip,
    },
    {
      label: 'Patient Visits per Day',
      value: patientVisitsPerDayDisplay,
      tooltip: patientVisitsPerDayTooltip,
    },
    {
      label: 'Hygiene Reappointment %',
      value: hygieneReappointmentPct,
      tooltip: `Hygiene patients rebooked ÷ completed hygiene visits. Source: /v2/hygiene/retention-metrics.${hygieneReappointmentSubtitle ? ` (${hygieneReappointmentSubtitle})` : ''}${retentionTooltipSuffix}`,
    },
    {
      label: 'Perio Reappointment %',
      value: perioReappointmentPct,
      tooltip: perioReappointmentTooltip,
    },
    {
      label: 'Adult Hygiene Retention (12 mo)',
      value: adultRetention12moPct,
      tooltip: `Adult hygiene patients returned within 12 months ÷ base. Source: /v2/hygiene/retention-metrics.${adultRetention12moSubtitle ? ` (${adultRetention12moSubtitle})` : ''}${retentionTooltipSuffix}`,
    },
  ];

  const row3 = [
    {
      label: 'Adult Hygiene Retention (6 mo)',
      value: adultRetention6moPct,
      tooltip: `Adult hygiene patients returned within 6 months ÷ base. Source: /v2/hygiene/retention-metrics.${adultRetention6moSubtitle ? ` (${adultRetention6moSubtitle})` : ''}${retentionTooltipSuffix}`,
    },
    {
      label: 'Child Hygiene Retention (12 mo)',
      value: childRetention12moPct,
      tooltip: `Child hygiene patients returned within 12 months ÷ base. Source: /v2/hygiene/retention-metrics.${childRetention12moSubtitle ? ` (${childRetention12moSubtitle})` : ''}${retentionTooltipSuffix}`,
    },
    {
      label: 'Child Hygiene Retention (6 mo)',
      value: childRetention6moPct,
      tooltip: `Child hygiene patients returned within 6 months ÷ base. Source: /v2/hygiene/retention-metrics.${childRetention6moSubtitle ? ` (${childRetention6moSubtitle})` : ''}${retentionTooltipSuffix}`,
    },
    {
      label: 'Sealants Count',
      value: sealantsCount,
      tooltip: sealantsTooltip,
    },
    {
      label: 'Whitening Procedures Count',
      value: whiteningCount,
      tooltip: whiteningTooltip,
    },
  ];

  const row4 = [
    {
      label: 'Antimicrobial Placement Count',
      value: antimicrobialCount,
      tooltip: antimicrobialTooltip,
    },
    {
      label: 'Hygiene Production per Procedure',
      value: hygieneProductionPerProc,
      tooltip: hygieneProductionPerProcTooltip,
    },
    { label: '% Hygiene Visits with TX Plan', value: '—', tooltip: 'Not available from Dentrix provider-performance. Requires TX plan data source.' },
    { label: 'TX Plans Presented per Day', value: txPlansPerDay !== '—' ? txPlansPerDay : '—', tooltip: 'Not available from Dentrix provider-performance. Requires TX plan data source.' },
    { label: 'Avg Hygiene Production per Hour', value: avgProdPerHour, tooltip: 'Net Production ÷ Scheduled Chair Hours. Source: Dentrix Ascend provider-performance (scheduled_appointment_duration). Shows — when chair hours unavailable.' },
  ];

  const row5 = [
    { label: 'Case Acceptance Rate', value: caseAcceptanceRate !== '—' ? caseAcceptanceRate : '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    {
      label: 'Fluoride Percentage',
      value: fluoridePctValue,
      tooltip: fluoridePctTooltip,
    },
    {
      label: 'Hygiene Production',
      value: hygieneProductionValue,
      tooltip: hygieneProductionTooltip,
    },
    {
      label: 'Avg Production per Hygiene Appointment',
      value: hygieneProductionPerApptValue,
      tooltip: hygieneProductionPerApptTooltip,
    },
  ];

  return (
    <div className="mb-8">
      <SectionHeader title="Hygiene" color="bg-teal-500" />
      {isDentrixUnavailable && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          Provider performance API was temporarily unavailable. Hygiene production metrics could not load. Please click Update to retry.
        </div>
      )}
      {/* V729B: Multi-office (2+ specific offices selected) — backend does not support multi-ID hygiene in one call */}
      {retentionMetrics?.requiresSingleOffice && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
          Hygiene metrics require selecting a single office. Select one office to view retention and procedure metrics.
        </div>
      )}
      {!retentionMetrics?.requiresSingleOffice && retentionEndpointAvailable === false && !multiOfficePending && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          Hygiene retention endpoint unavailable. Reappointment and retention cards show N/A. Source: /v2/hygiene/retention-metrics
        </div>
      )}
      {multiOfficePending && !retentionMetrics?.requiresSingleOffice && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
          Multi-office retention aggregation pending. Reappointment and retention cards show N/A for multi-office selections.
        </div>
      )}
      {procedureMetrics?.requiresSingleOffice && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
          Hygiene procedure metrics require selecting a single office. Select one office to view procedure KPIs.
        </div>
      )}
      {!procedureMetrics?.requiresSingleOffice && procedureEndpointAvailable === false && !procedureMultiOfficePending && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          Hygiene procedure metrics endpoint unavailable. Procedure KPI cards show N/A. Source: /v2/hygiene/procedure-metrics
        </div>
      )}
      {procedureMultiOfficePending && !procedureMetrics?.requiresSingleOffice && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
          Multi-office procedure metrics aggregation pending. Procedure KPI cards show N/A for multi-office selections.
        </div>
      )}
      <MetricRow cards={row1} loading={loading} />
      <MetricRow cards={row2} loading={loading} />
      <MetricRow cards={row3} loading={loading} />
      <MetricRow cards={row4} loading={loading} />
      <MetricRow cards={row5} loading={loading} />
    </div>
  );
};

export default HygieneSection;
