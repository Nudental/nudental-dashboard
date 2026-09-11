import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { LOCATION_ID_MAP } from '../../../constants/offices';

// ─── V585: PatientFlowCard ────────────────────────────────────────────────────
// Source: Dentrix/FastAPI /v2/patients/summary + /v2/appointments/summary
// Removed: supabase.from('daily_entries') — manual/EOD source eliminated
// Missing/unavailable values → '—' or 'N/A'. Real backend 0 shows as 0.
// Export remains disabled pending backend patient_flow report_type support.

// Null-safe display helpers
const displayNum = (v) => {
  if (v === null || v === undefined) return '—';
  return Number(v)?.toLocaleString();
};

const displayPct = (v) => {
  if (v === null || v === undefined) return '—';
  return `${Number(v)?.toFixed(1)}%`;
};

// Null-safe sum: if ALL values null → null; otherwise sum non-null only
const nullSafeSum = (values) => {
  const valid = values?.filter((v) => v !== null && v !== undefined);
  if (!valid || valid?.length === 0) return null;
  return valid?.reduce((a, b) => a + b, 0);
};

// Extract field with multiple possible names
const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj?.[k] !== null && obj?.[k] !== undefined) return Number(obj?.[k]);
  }
  return null;
};

// Resolve locationIds for the given office filter
const resolveLocationEntries = (officeFilter) => {
  const isAll = !officeFilter || officeFilter?.includes('all') || officeFilter?.length === 0;
  if (isAll) return [{ officeId: null, locationId: null }];
  return officeFilter?.map((id) => ({ officeId: id, locationId: LOCATION_ID_MAP?.[id] || null }));
};

// Build monthly bucket labels for trend chart
const buildMonthBuckets = (startDate, endDate) => {
  const buckets = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const y = cur?.getFullYear();
    const m = cur?.getMonth() + 1;
    const bucketStart = `${y}-${String(m)?.padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0)?.getDate();
    const bucketEnd = `${y}-${String(m)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
    buckets?.push({
      label: `${cur?.toLocaleString('default', { month: 'short' })} ${y}`,
      start: bucketStart,
      end: bucketEnd,
    });
    cur = new Date(y, m, 1);
  }
  return buckets;
};

const PatientFlowCard = ({ officeFilter, reportStart, reportEnd }) => {
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedNote, setCompletedNote] = useState(null);

  const load = useCallback(async () => {
    if (!reportStart || !reportEnd) return;
    setLoading(true);
    setMetrics(null);
    setChartData([]);
    setCompletedNote(null);

    try {
      const entries = resolveLocationEntries(officeFilter);

      // ── Fetch patient + appointment summaries for full date range ──────────
      const [patientResults, apptResults] = await Promise.all([
        Promise.allSettled(
          entries?.map(({ locationId }) =>
            ascendApi?.getPatients(reportStart, reportEnd, locationId)
          )
        ),
        Promise.allSettled(
          entries?.map(({ locationId }) =>
            ascendApi?.getAppointmentsSummary(reportStart, reportEnd, locationId)
          )
        ),
      ]);

      // Aggregate patient metrics across successful offices
      const newPatientsArr = patientResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value, 'newPatients', 'new_patients') : null
      );
      const activePatientsArr = patientResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'activePatients', 'uniquePatients', 'active_patients', 'unique_patients')
          : null
      );

      // Aggregate appointment metrics across successful offices
      const totalScheduledArr = apptResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'totalScheduled', 'total_scheduled', 'scheduled')
          : null
      );
      const completedArr = apptResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'completed', 'completedAppointments', 'completed_appointments')
          : null
      );
      const cancelledArr = apptResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'cancelled', 'cancelledAppointments', 'cancelled_appointments')
          : null
      );
      const brokenArr = apptResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'broken', 'brokenAppointments', 'broken_appointments')
          : null
      );
      const noShowArr = apptResults?.map((r) =>
        r?.status === 'fulfilled' ? pick(r?.value,'noShow', 'noShows', 'no_shows')
          : null
      );

      const newPatients = nullSafeSum(newPatientsArr);
      const activePatients = nullSafeSum(activePatientsArr);
      const totalScheduled = nullSafeSum(totalScheduledArr);
      const completed = nullSafeSum(completedArr);
      const cancelled = nullSafeSum(cancelledArr);
      const broken = nullSafeSum(brokenArr);
      const noShows = nullSafeSum(noShowArr);

      // Derived: Show Rate = completed ÷ totalScheduled
      let showRate = null;
      if (completed !== null && totalScheduled !== null && totalScheduled > 0) {
        showRate = (completed / totalScheduled) * 100;
      }

      // Derived: Missed Appointment Rate = (cancelled + broken + noShows) ÷ totalScheduled
      let missedRate = null;
      const missedCount = nullSafeSum([cancelled, broken, noShows]);
      if (missedCount !== null && totalScheduled !== null && totalScheduled > 0) {
        missedRate = (missedCount / totalScheduled) * 100;
      }

      // Note if completed not returned
      const allCompletedNull = completedArr?.every((v) => v === null);
      if (allCompletedNull) {
        setCompletedNote('Completed appointments not returned by source.');
      }

      setMetrics({
        newPatients,
        activePatients,
        totalScheduled,
        completed,
        cancelled,
        broken,
        noShows,
        showRate,
        missedRate,
      });

      // ── Trend chart: monthly buckets ──────────────────────────────────────
      const buckets = buildMonthBuckets(reportStart, reportEnd);
      // Only build trend if more than 1 bucket (otherwise single-period, no trend)
      if (buckets?.length > 1) {
        const trendResults = await Promise.allSettled(
          buckets?.map(async (bucket) => {
            const [pRes, aRes] = await Promise.all([
              Promise.allSettled(
                entries?.map(({ locationId }) =>
                  ascendApi?.getPatients(bucket?.start, bucket?.end, locationId)
                )
              ),
              Promise.allSettled(
                entries?.map(({ locationId }) =>
                  ascendApi?.getAppointmentsSummary(bucket?.start, bucket?.end, locationId)
                )
              ),
            ]);
            const np = nullSafeSum(
              pRes?.map((r) =>
                r?.status === 'fulfilled' ? pick(r?.value, 'newPatients', 'new_patients') : null
              )
            );
            const ns = nullSafeSum(
              aRes?.map((r) =>
                r?.status === 'fulfilled' ? pick(r?.value, 'noShow', 'noShows', 'no_shows') : null
              )
            );
            const ts = nullSafeSum(
              aRes?.map((r) =>
                r?.status === 'fulfilled' ? pick(r?.value,'totalScheduled', 'total_scheduled', 'scheduled')
                  : null
              )
            );
            return { label: bucket?.label, newPatients: np, noShows: ns, totalScheduled: ts };
          })
        );

        const trendData = trendResults?.map((r, i) =>
            r?.status === 'fulfilled'
              ? r?.value
              : { label: buckets?.[i]?.label, newPatients: null, noShows: null, totalScheduled: null }
          )?.filter((d) => d?.newPatients !== null || d?.noShows !== null);

        setChartData(trendData);
      }
    } catch (err) {
      console.warn('[PatientFlowCard] load error:', err?.message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [officeFilter, reportStart, reportEnd]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-4" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const Header = () => (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
        <Icon name="Users" size={16} color="#2563eb" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Patient Flow</h3>
        <p className="text-xs text-muted-foreground">Dentrix/FastAPI patient &amp; appointment summaries</p>
      </div>
    </div>
  );

  // ── No data state ──────────────────────────────────────────────────────────
  if (!metrics) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <Header />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Icon name="Users" size={20} className="text-muted-foreground" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">No data available</h4>
          <p className="text-xs text-muted-foreground max-w-xs">
            Patient and appointment data could not be retrieved from Dentrix/FastAPI for the selected period.
          </p>
        </div>
        {/* Source banner */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 bg-muted/40 border border-border/60 rounded-md">
          <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Source: Dentrix/FastAPI patient and appointment summaries. New/active patient counts come from{' '}
            <code className="text-xs">/v2/patients/summary</code>; appointment metrics come from{' '}
            <code className="text-xs">/v2/appointments/summary</code>. Manual/EOD{' '}
            <code className="text-xs">daily_entries</code> is not used.
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-2 italic">
          Exports available for authorized users from the Reports export panel.
        </p>
      </div>
    );
  }

  const showRateColor =
    metrics?.showRate === null
      ? 'text-muted-foreground'
      : metrics?.showRate >= 80
      ? 'text-success'
      : metrics?.showRate >= 60
      ? 'text-warning' :'text-destructive';

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <Header />
      {/* ── Patient Metrics ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Patients</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2.5 bg-success/10 rounded-lg">
            <p className="text-xl font-bold text-success">{displayNum(metrics?.newPatients)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">New Patients</p>
          </div>
          <div className="text-center p-2.5 bg-blue-50 rounded-lg">
            <p className="text-xl font-bold text-blue-600">{displayNum(metrics?.activePatients)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active Patients</p>
          </div>
        </div>
      </div>
      {/* ── Appointment Metrics ─────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Appointments</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-muted/40 rounded-lg">
            <p className="text-lg font-bold text-foreground">{displayNum(metrics?.totalScheduled)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Scheduled</p>
          </div>
          <div className="text-center p-2 bg-muted/40 rounded-lg">
            <p className="text-lg font-bold text-foreground">{displayNum(metrics?.completed)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
          </div>
          <div className="text-center p-2 bg-destructive/10 rounded-lg">
            <p className="text-lg font-bold text-destructive">{displayNum(metrics?.noShows)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">No-Shows</p>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <p className="text-lg font-bold text-orange-600">{displayNum(metrics?.cancelled)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cancelled</p>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <p className="text-lg font-bold text-yellow-600">{displayNum(metrics?.broken)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Broken</p>
          </div>
          <div className="text-center p-2 bg-muted/40 rounded-lg">
            <p className={`text-lg font-bold ${showRateColor}`}>{displayPct(metrics?.showRate)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Show Rate</p>
          </div>
        </div>
      </div>
      {/* ── Derived Rates ───────────────────────────────────────────────── */}
      {metrics?.missedRate !== null && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg mb-3">
          <span className="text-xs text-muted-foreground">Missed Appointment Rate</span>
          <span className="text-sm font-semibold text-destructive">{displayPct(metrics?.missedRate)}</span>
        </div>
      )}
      {/* Completed note if not returned */}
      {completedNote && (
        <p className="text-xs text-muted-foreground italic mb-3">{completedNote}</p>
      )}
      {/* ── Trend Chart ─────────────────────────────────────────────────── */}
      {chartData?.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Monthly Trend</p>
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barSize={12}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e5e7eb' }}
                  formatter={(value, name) => {
                    if (value === null || value === undefined) return ['—', name];
                    const labels = {
                      newPatients: 'New Patients',
                      noShows: 'No-Shows',
                      totalScheduled: 'Total Scheduled',
                    };
                    return [Number(value)?.toLocaleString(), labels?.[name] || name];
                  }}
                />
                <Bar dataKey="newPatients" fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="noShows" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-1 mb-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" />New Patients
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-destructive inline-block" />No-Shows
            </span>
          </div>
        </>
      )}
      {/* ── Source Banner ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2 bg-muted/40 border border-border/60 rounded-md mt-2">
        <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Source: Dentrix/FastAPI patient and appointment summaries. New/active patient counts come from{' '}
          <code className="text-xs">/v2/patients/summary</code>; appointment metrics come from{' '}
          <code className="text-xs">/v2/appointments/summary</code>. Manual/EOD{' '}
          <code className="text-xs">daily_entries</code> is not used.
        </p>
      </div>
      {/* ── Export note ─────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground mt-2 italic">
        Exports available for authorized users from the Reports export panel.
      </p>
    </div>
  );
};

export default PatientFlowCard;
