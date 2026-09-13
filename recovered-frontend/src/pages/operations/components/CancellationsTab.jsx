import React, { useState, useEffect, useCallback } from 'react';
import {  } from 'recharts';
import { fmtPct, fmtNum, monthLabel } from '../../../services/operationsService';
import { ascendApi } from '../../../services/ascendApi';
import { resolveOfficeName, OFFICE_MAP, LOCATION_ID_MAP } from '../../../constants/offices';

// ─── Stage 2A: CancellationsTab ──────────────────────────────────────────────
// Source: Dentrix /v2/appointments/summary (trusted fields only)
// Removed: daily_entries.no_shows as appointment/no-show data
// Missing fields → N/A (not 0)

const FALLBACK_COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const getOfficeChartColor = (nameOrId, idx) => {
  if (OFFICE_MAP?.[nameOrId]) return OFFICE_MAP?.[nameOrId]?.color;
  const entry = Object.values(OFFICE_MAP)?.find((o) => o?.name === nameOrId);
  if (entry) return entry?.color;
  return FALLBACK_COLORS?.[idx % FALLBACK_COLORS?.length];
};

const getRateColor = (rate) => {
  if (rate === null || rate === undefined) return '';
  if (rate < 5) return 'text-green-700 bg-green-100';
  if (rate <= 10) return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
};

// Safe display helpers — null/undefined → 'N/A', confirmed 0 → '0'
const displayNum = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtNum(v);
};
const displayRate = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtPct(v);
};

const KPICard = ({ label, value, sub }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

const CancellationsTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    setApiError(null);
    try {
      const { startYear, startMonth, endYear, endMonth } = dateRange;
      const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
      const lastDay = new Date(endYear, endMonth, 0)?.getDate();
      const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

      // Determine locationId(s) to fetch
      const officeEntries =
        officeIds?.length > 0
          ? officeIds?.map((id) => ({ officeId: id, locationId: LOCATION_ID_MAP?.[id] || null }))
          : [{ officeId: null, locationId: null }]; // all offices

      const results = await Promise.allSettled(
        officeEntries?.map(({ locationId }) =>
          ascendApi?.getAppointmentsSummary(startDate, endDate, locationId)
        )
      );

      const rows = [];
      results?.forEach((res, idx) => {
        if (res?.status !== 'fulfilled') return;
        const payload = res?.value;
        const officeId = officeEntries?.[idx]?.officeId;

        // Trusted fields from /v2/appointments/summary
        // Field names may vary — check both camelCase and snake_case variants
        const noShow =
          payload?.noShow != null ? parseInt(payload?.noShow) :
          payload?.noShows != null ? parseInt(payload?.noShows) :
          payload?.no_shows != null ? parseInt(payload?.no_shows) :
          null;

        const broken =
          payload?.broken != null ? parseInt(payload?.broken) :
          payload?.brokenAppointments != null ? parseInt(payload?.brokenAppointments) :
          payload?.broken_appointments != null ? parseInt(payload?.broken_appointments) :
          null;

        const cancelled =
          payload?.cancelled != null ? parseInt(payload?.cancelled) :
          payload?.cancelledAppointments != null ? parseInt(payload?.cancelledAppointments) :
          null;

        const totalScheduled =
          payload?.totalScheduled != null ? parseInt(payload?.totalScheduled) :
          payload?.total_scheduled != null ? parseInt(payload?.total_scheduled) :
          null;

        // total cancellations = noShow + broken (+ cancelled if available)
        const totalCancellations =
          noShow != null || broken != null
            ? (noShow || 0) + (broken || 0) + (cancelled || 0)
            : null;

        // Cancellation rate = totalCancellations / totalScheduled
        const cancellationRate =
          totalCancellations != null && totalScheduled != null && totalScheduled > 0
            ? (totalCancellations / totalScheduled) * 100
            : null;

        rows?.push({
          office_id: officeId,
          // Use dateRange month/year for display (summary covers the full range)
          report_month: endMonth,
          report_year: endYear,
          no_shows: noShow,
          broken_appointments: broken,
          cancelled: cancelled,
          total_cancellations: totalCancellations,
          total_scheduled: totalScheduled,
          cancellation_rate: cancellationRate,
        });
      });

      setData(rows);
    } catch (e) {
      console.error('CancellationsTab error:', e);
      setApiError('Appointment data unavailable. Dentrix connection required.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);

  // KPI totals — null-safe (missing → null, not 0)
  const sumField = (field) => {
    const vals = data?.map((r) => r?.[field])?.filter((v) => v != null);
    return vals?.length > 0 ? vals?.reduce((a, b) => a + b, 0) : null;
  };

  const totalNoShows = sumField('no_shows');
  const totalBroken = sumField('broken_appointments');
  const totalCancellations = sumField('total_cancellations');
  const totalScheduled = sumField('total_scheduled');
  const overallRate =
    totalCancellations != null && totalScheduled != null && totalScheduled > 0
      ? (totalCancellations / totalScheduled) * 100
      : null;

  const officeNames = [...new Set(data.map((r) => officeMap[r.office_id] || resolveOfficeName(r.office_id)))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4]?.map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Icon name="AlertTriangle" size={24} className="text-yellow-500 mx-auto mb-2" />
        <div className="text-sm font-semibold text-yellow-800 mb-1">Dentrix Appointment Mapping Required</div>
        <div className="text-xs text-yellow-700">{apiError}</div>
        <div className="text-xs text-muted-foreground mt-2">
          Source: /v2/appointments/summary — daily_entries.no_shows removed (Stage 2A)
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Source: Dentrix /v2/appointments/summary — trusted fields only (noShow, broken, cancelled, totalScheduled). daily_entries.no_shows removed (Stage 2A). Missing fields show N/A.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total No-Shows" value={displayNum(totalNoShows)} sub="Source: Dentrix" />
        <KPICard label="Broken Appointments" value={displayNum(totalBroken)} sub="Source: Dentrix" />
        <KPICard label="Combined Cancellations" value={displayNum(totalCancellations)} sub="" />
        <KPICard
          label="Cancellation Rate"
          value={displayRate(overallRate)}
          sub={totalScheduled != null ? `vs ${fmtNum(totalScheduled)} scheduled` : 'vs scheduled appts'}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Cancellations by Office</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {['Office', 'Period', 'No-Shows', 'Broken Appts', 'Cancelled', 'Total', 'Scheduled', 'Rate %']?.map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No appointment data for selected period
                  </td>
                </tr>
              ) : (
                data?.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {r?.office_id ? (officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id)) : 'All Offices'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {dateRange?.startYear === r?.report_year && dateRange?.startMonth === r?.report_month
                        ? monthLabel(r?.report_year, r?.report_month)
                        : `${monthLabel(dateRange?.startYear, dateRange?.startMonth)} – ${monthLabel(r?.report_year, r?.report_month)}`}
                    </td>
                    <td className="px-3 py-2">{displayNum(r?.no_shows)}</td>
                    <td className="px-3 py-2">{displayNum(r?.broken_appointments)}</td>
                    <td className="px-3 py-2">{displayNum(r?.cancelled)}</td>
                    <td className="px-3 py-2 font-semibold">{displayNum(r?.total_cancellations)}</td>
                    <td className="px-3 py-2">{displayNum(r?.total_scheduled)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRateColor(r?.cancellation_rate)}`}>
                        {displayRate(r?.cancellation_rate)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Inline Icon fallback (uses AppIcon if available, otherwise SVG)
const Icon = ({ name, size = 16, className = '' }) => {
  try {
    const AppIcon = require('../../../components/AppIcon')?.default;
    return <AppIcon name={name} size={size} className={className} />;
  } catch {
    return <span className={className} style={{ display: 'inline-block', width: size, height: size }} />;
  }
};

export default CancellationsTab;
