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
        label={card?.label}
        value={card?.value}
        tooltip={card?.tooltip}
        loading={loading}
      />
    ))}
  </div>
);

const DoctorSection = ({ data, loading }) => {
  const d = data || {};
  const dataSource = d?.dataSource || 'unknown';

  // V729B: Granular error state classification
  // - 'dentrix_unavailable' / 'dentrix_error': API was called but failed (network/502)
  // - 'no_dentrix_provider_data': API returned rows but no doctor rows
  // - 'no_classification': rows returned but no doctor/hygienist split
  const isApiUnavailable = dataSource === 'dentrix_unavailable' || dataSource === 'dentrix_error';
  const isNoRows = dataSource === 'no_dentrix_provider_data';
  const hasRows = d?.rows?.length > 0;
  const hasDoctorRows = d?.rows?.filter(r => r?.providerType === 'doctor')?.length > 0;
  const hasUnattributedOnly = hasRows && !hasDoctorRows && d?.rows?.some(r => r?.providerType === 'unattributed');
  const isNoClassification = hasRows && !hasDoctorRows && !hasUnattributedOnly;

  const avgProdPerDay = d?.avgProdPerDay != null ? fmtCurrency(d?.avgProdPerDay) : '—';
  const avgProductionPerActiveProviderDay = d?.avgProductionPerActiveProviderDay;
  const activeProviderDays = d?.activeProviderDays;
  const avgProdPerActiveProviderDayDisplay = avgProductionPerActiveProviderDay != null
    ? fmtCurrency(avgProductionPerActiveProviderDay)
    : 'N/A';
  const avgProdPerActiveProviderDayTooltip = activeProviderDays != null
    ? `Doctor net production ÷ active doctor-days. Active provider-day = provider had at least one completed/chair appointment that day. Active provider-days: ${activeProviderDays}. Source: providerTypeMetrics.doctor.avgProductionPerActiveProviderDay from /v2/reports/provider-performance.`
    : 'Doctor net production ÷ active doctor-days. Active provider-day = provider had at least one completed/chair appointment that day. Source: providerTypeMetrics.doctor.avgProductionPerActiveProviderDay from /v2/reports/provider-performance. Shows N/A when backend field is missing.';
  const caseAcceptanceRate = d?.caseAcceptanceRate != null ? fmtPct(d?.caseAcceptanceRate) : '—';
  const caseAcceptanceSameDay = d?.caseAcceptanceSameDay != null ? fmtPct(d?.caseAcceptanceSameDay) : '—';
  const avgProdPerHour = d?.avgProdPerHour != null ? fmtCurrency(d?.avgProdPerHour) : '—';
  const newPtsWithTxPlans = d?.newPtsWithTxPlans != null ? fmtCurrency(d?.newPtsWithTxPlans) : '—';
  const txPlansPerDay = d?.txPlansPerDay != null ? d?.txPlansPerDay?.toFixed(1) : '—';

  const doctorAvgAppointmentMinutes = d?.doctorAvgAppointmentMinutes;
  const doctorProductionPerAppointment = d?.doctorProductionPerAppointment;

  const avgTimePerAppt = doctorAvgAppointmentMinutes != null
    ? `${parseFloat(doctorAvgAppointmentMinutes)?.toFixed(1)} min`
    : '—';
  const avgTimePerApptTooltip = 'Completed doctor appointment duration ÷ completed doctor appointments. Source: providerTypeMetrics.doctor.avgAppointmentMinutes from /v2/reports/provider-performance.';

  const avgProdPerAppt = doctorProductionPerAppointment != null
    ? fmtCurrency(doctorProductionPerAppointment)
    : '—';
  const avgProdPerApptTooltip = 'Doctor net production ÷ completed doctor appointments. Source: providerTypeMetrics.doctor.productionPerAppointment from /v2/reports/provider-performance.';

  const row1 = [
    { label: 'Case Acceptance - Same Day', value: caseAcceptanceSameDay !== '—' ? caseAcceptanceSameDay : '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    { label: 'Case Acceptance - Rolling 90 Days', value: '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    { label: 'Case Acceptance Rate', value: caseAcceptanceRate !== '—' ? caseAcceptanceRate : '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    { label: '$ New Patients Receiving TX Plans', value: newPtsWithTxPlans !== '—' ? newPtsWithTxPlans : '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    { label: '$ Existing Patients Receiving TX Plans', value: '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
  ];

  const row2 = [
    {
      label: 'Avg Time per Doctor Appointment (min)',
      value: avgTimePerAppt,
      tooltip: avgTimePerApptTooltip,
    },
    { label: 'Avg Doctor Production per Hour', value: avgProdPerHour, tooltip: 'Net Production ÷ Scheduled Chair Hours. Source: Dentrix Ascend provider-performance (scheduled_appointment_duration). Shows — when chair hours unavailable.' },
    {
      label: 'Avg Production per Doctor Appointment',
      value: avgProdPerAppt,
      tooltip: avgProdPerApptTooltip,
    },
    { label: 'Same Day Treatment per New Patient', value: '—', tooltip: 'Unavailable — requires future provider-level treatment plan endpoint.' },
    {
      label: 'Avg Production per Active Provider Day',
      value: avgProdPerActiveProviderDayDisplay,
      tooltip: avgProdPerActiveProviderDayTooltip,
    },
  ];

  return (
    <div className="mb-8">
      <SectionHeader title="Doctor" color="bg-purple-500" />

      {/* V729B: Granular error states — do not collapse all cases into one message */}
      {isApiUnavailable && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          Provider performance API was temporarily unavailable. Doctor metrics could not load. Please click Update to retry.
        </div>
      )}
      {isNoRows && !isApiUnavailable && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs">
          No provider rows returned from /v2/reports/provider-performance for the selected period. Production metrics are not shown.
        </div>
      )}
      {isNoClassification && !isApiUnavailable && !isNoRows && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs">
          Provider rows were returned but no doctor/hygienist classification was found. Check that providerType is populated in the provider-performance response.
        </div>
      )}

      <MetricRow cards={row1} loading={loading} />
      <MetricRow cards={row2} loading={loading} />
    </div>
  );
};

export default DoctorSection;
