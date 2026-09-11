import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchProductionDetails, fmtCurrency, fmtNum, monthLabel } from '../../../services/operationsService';
import { resolveOfficeName } from '../../../constants/offices';

// Stage 4B-4: ProductionDetailsTab now uses Dentrix /v2/reports/provider-performance
// for doctor/hygiene production and chair-hour metrics.
// No MEA fields used. No 8-hour assumption.
// Missing values → N/A (not $0).

const ProductionDetailsTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    setApiError(false);
    try {
      const records = await fetchProductionDetails({ ...dateRange, officeIds });
      setData(records || []);
      // If all records have _apiError, surface a warning
      if ((records || [])?.length > 0 && records?.every((r) => r?._apiError)) {
        setApiError(true);
      }
    } catch (e) {
      console.error('ProductionDetailsTab error:', e);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);

  // ── Chart data: group by office, hygiene vs doctor production ──────────────
  // Uses Dentrix provider-performance fields: hygiene_prod, doctor_prod
  const chartData = [];
  const monthKeys = {};
  data?.forEach((r) => {
    const key = `${r?.report_year}-${String(r?.report_month)?.padStart(2, '0')}`;
    if (!monthKeys?.[key]) {
      monthKeys[key] = { month: monthLabel(r?.report_year, r?.report_month) };
      chartData?.push(monthKeys?.[key]);
    }
    const officeName = officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id);

    // Dentrix provider-performance fields — null if unavailable
    // Only add to chart if value is non-null (don't chart N/A as 0)
    if (r?.hygiene_prod !== null && r?.hygiene_prod !== undefined) {
      monthKeys[key][`${officeName}_hygiene`] = (monthKeys?.[key]?.[`${officeName}_hygiene`] ?? 0) + r?.hygiene_prod;
    }
    if (r?.doctor_prod !== null && r?.doctor_prod !== undefined) {
      monthKeys[key][`${officeName}_doctor`] = (monthKeys?.[key]?.[`${officeName}_doctor`] ?? 0) + r?.doctor_prod;
    }
  });

  // ── Table rows ─────────────────────────────────────────────────────────────
  const tableRows = data?.map((r) => {
    const doctorProd = r?.doctor_prod ?? null;
    const hygieneProd = r?.hygiene_prod ?? null;
    const totalProd = r?.production_total ?? null;
    const officeNetProd = r?.office_net_production ?? null;
    const unattributedProd = r?.unattributed_prod ?? null;

    // scheduledChairHours from Dentrix provider-performance — null if not returned
    const scheduledChairHours = r?.scheduledChairHours ?? null;
    const productionPerHour = r?.productionPerHour ?? null;

    return {
      office: officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id),
      month: monthLabel(r?.report_year, r?.report_month),
      doctor_prod: doctorProd,
      hygiene_prod: hygieneProd,
      total_production: totalProd,
      office_net_production: officeNetProd,
      unattributed_prod: unattributedProd,
      scheduledChairHours,
      productionPerHour,
      _apiError: r?._apiError ?? false,
    };
  });

  const uniqueOffices = [...new Set(data?.map((r) => officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id)))];
  const TEAL_SHADES = ['#0d9488', '#0891b2', '#0e7490', '#155e75', '#164e63'];
  const INDIGO_SHADES = ['#4f46e5', '#6366f1', '#818cf8', '#3730a3', '#312e81'];

  const ProductionCustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload?.length) return null;
    return (
      <div className="bg-white border border-border rounded shadow p-2 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload?.map((entry, i) => (
          <p key={i} style={{ color: entry?.color }}>{entry?.name}: {fmtCurrency(entry?.value)}</p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (data?.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No production data for selected period
        {apiError && (
          <div className="mt-2 text-xs text-amber-600">
            Dentrix provider-performance API unavailable for selected offices.
          </div>
        )}
      </div>
    );
  }

  // Check if any office had API errors
  const hasPartialError = data?.some((r) => r?._apiError);
  // Check if chart has any data to show (at least one non-null hygiene or doctor value)
  const hasChartData = chartData?.some((row) =>
    Object.keys(row)?.some((k) => k !== 'month' && row?.[k] !== null && row?.[k] !== undefined)
  );

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground italic">
          Source: Dentrix Ascend API · /v2/reports/provider-performance · doctor &amp; hygiene production
        </span>
      </div>
      {/* Partial data warning */}
      {hasPartialError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="flex-shrink-0">⚠️</span>
          Some offices returned no provider-performance data. Affected values show N/A.
        </div>
      )}
      {/* Bar Chart — Hygiene vs Doctor Production */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-base font-semibold text-foreground mb-1">Hygiene vs Doctor Production by Office</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Source: Dentrix provider-performance · net production by provider type
        </p>
        {hasChartData ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(400, chartData?.length * 80) }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ProductionCustomTooltip label="" show={false} />} />
                  <Legend />
                  {uniqueOffices?.map((office, i) => (
                    <React.Fragment key={office}>
                      <Bar dataKey={`${office}_hygiene`} name={`${office} Hygiene`} fill={TEAL_SHADES?.[i % TEAL_SHADES?.length]} />
                      <Bar dataKey={`${office}_doctor`} name={`${office} Doctor`} fill={INDIGO_SHADES?.[i % INDIGO_SHADES?.length]} />
                    </React.Fragment>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Provider-performance data not yet available for selected period.
            <br />
            Doctor/hygiene split requires Dentrix providerType or providerTypeMetrics in API response.
          </div>
        )}
      </div>
      {/* Table — Provider Production & Chair Hours */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Provider Production &amp; Chair Hours</h3>
          <span className="text-xs text-muted-foreground italic">
            Chair hours: Dentrix scheduledChairHours only · N/A if not returned
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {[
                  'Office',
                  'Period',
                  'Doctor Production',
                  'Hygiene Production',
                  'Provider-Attributed Total',
                  'Unattributed / Office-Level',
                  'Office Net Production',
                  'Sched. Chair Hrs',
                  'Prod / Chair Hr',
                ]?.map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows?.map((r, i) => (
                <tr key={i} className={`border-t border-border hover:bg-muted/30 ${r?._apiError ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r?.office}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r?.month}</td>

                  {/* Doctor Production */}
                  <td className="px-3 py-2">
                    {r?.doctor_prod !== null
                      ? <span className="text-indigo-700 font-medium">{fmtCurrency(r?.doctor_prod)}</span>
                      : <span className="text-muted-foreground text-xs">N/A</span>}
                  </td>

                  {/* Hygiene Production */}
                  <td className="px-3 py-2">
                    {r?.hygiene_prod !== null
                      ? <span className="text-teal-700 font-medium">{fmtCurrency(r?.hygiene_prod)}</span>
                      : <span className="text-muted-foreground text-xs">N/A</span>}
                  </td>

                  {/* Provider-Attributed Total (doctor + hygiene) */}
                  <td className="px-3 py-2 font-semibold">
                    {r?.total_production !== null
                      ? fmtCurrency(r?.total_production)
                      : <span className="text-muted-foreground text-xs">N/A</span>}
                  </td>

                  {/* Unattributed / Office-Level production */}
                  {/* = Office Net Production minus provider-attributed total */}
                  {/* Not linked to any provider in Dentrix provider-performance response */}
                  <td className="px-3 py-2">
                    {r?.unattributed_prod !== null
                      ? (
                        <span
                          className={`font-medium ${r?.unattributed_prod > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}
                          title="Production not linked to a provider in Dentrix/provider-performance response"
                        >
                          {r?.unattributed_prod > 0 ? fmtCurrency(r?.unattributed_prod) : '$0'}
                        </span>
                      )
                      : <span className="text-muted-foreground text-xs">N/A</span>}
                  </td>

                  {/* Office Net Production (from /v2/production/summary) */}
                  <td className="px-3 py-2 font-semibold text-foreground">
                    {r?.office_net_production !== null
                      ? fmtCurrency(r?.office_net_production)
                      : <span className="text-muted-foreground text-xs">N/A</span>}
                  </td>

                  {/* Scheduled Chair Hours */}
                  <td className="px-3 py-2">
                    {r?.scheduledChairHours !== null
                      ? fmtNum(r?.scheduledChairHours)
                      : <span className="text-muted-foreground text-xs" title="Dentrix chair-hour mapping required">N/A</span>}
                  </td>

                  {/* Production per Chair Hour */}
                  <td className="px-3 py-2">
                    {r?.productionPerHour !== null
                      ? fmtCurrency(r?.productionPerHour)
                      : <span className="text-muted-foreground text-xs" title="Dentrix chair-hour mapping required">N/A</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            ⓘ <strong>Unattributed / Office-Level</strong> = production not linked to a provider in Dentrix/provider-performance response (provider_id null, provider name blank, or procedure rows not mapped to a provider type).
            Office Net Production = provider-attributed total + unattributed. Chair utilization requires{' '}
            <code className="text-xs bg-muted px-1 rounded">scheduledChairHours</code> from Dentrix provider-performance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductionDetailsTab;
