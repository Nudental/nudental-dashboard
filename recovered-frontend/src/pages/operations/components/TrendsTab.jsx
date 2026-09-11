import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmtCurrency, fmtNum, getLastNMonths, monthLabel } from '../../../services/operationsService';
import { resolveOfficeName, OFFICE_MAP } from '../../../constants/offices';
import { ascendApi } from '../../../services/ascendApi';

const FALLBACK_COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const getOfficeChartColor = (nameOrId, idx) => {
  if (OFFICE_MAP?.[nameOrId]) return OFFICE_MAP?.[nameOrId]?.color;
  const entry = Object.values(OFFICE_MAP)?.find(o => o?.name === nameOrId);
  if (entry) return entry?.color;
  return FALLBACK_COLORS?.[idx % FALLBACK_COLORS?.length];
};

// Stage 3B: null-preserving helper — returns null for missing/undefined, preserves real 0
const safeNum = (v) => (v !== null && v !== undefined && isFinite(Number(v)) ? Number(v) : null);

// Stage 3B: format a value for tooltip — null → 'N/A', real number → formatted
const fmtOrNA = (v, formatter) => (v === null || v === undefined ? 'N/A' : formatter(v));

const TrendChart = ({ title, data, officeNames, formatter, yFormatter, subtitle = undefined }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {data?.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
    ) : (
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(400, data?.length * 60) }}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={yFormatter} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-white border border-border rounded p-2 text-xs">
                      <p className="font-semibold mb-1">{label}</p>
                      {payload?.map((entry) => (
                        <p key={entry?.name} style={{ color: entry?.color }}>
                          {resolveOfficeName(entry?.name)}: {fmtOrNA(entry?.value, formatter || ((v) => v))}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend formatter={(value) => resolveOfficeName(value)} />
              {officeNames?.map((nameOrId, i) => (
                <Line
                  key={nameOrId}
                  type="monotone"
                  dataKey={nameOrId}
                  name={resolveOfficeName(nameOrId)}
                  stroke={getOfficeChartColor(nameOrId, i)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </div>
);

const TrendsTab = ({ dateRange, officeIds, offices }) => {
  const [trendPoints, setTrendPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  // Fetch 12-month trend from Ascend API — re-runs whenever dateRange or officeIds change
  const load = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    try {
      const months = getLastNMonths(12);
      // locationId: use first selected office if exactly one, otherwise null (all offices)
      const locationId = officeIds?.length === 1 ? officeIds?.[0] : null;

      const results = await Promise.allSettled(
        months?.map(({ year, month }) => {
          const startDate = `${year}-${String(month)?.padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0)?.getDate();
          const endDate = `${year}-${String(month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
          return Promise.all([
            ascendApi?.getProduction(startDate, endDate, locationId)?.catch(() => null),
            ascendApi?.getCollections(startDate, endDate, locationId)?.catch(() => null),
            ascendApi?.getPatients(startDate, endDate, locationId)?.catch(() => null),
            ascendApi?.getAppointmentsSummary(startDate, endDate, locationId)?.catch(() => null),
          ])?.then(([prod, coll, patients, appts]) => {
            // Stage 3B: null-preserving — API failure (null response) or missing field → null.
            // Real backend 0 is preserved as 0. Only undefined/null/missing → null.
            // Do NOT use ?? 0 or || 0 on Dentrix API fields.
            const adjVal = prod !== null
              ? (safeNum(prod?.adjustments) !== null
                  ? Math.abs(safeNum(prod?.adjustments))
                  : safeNum(prod?.writeOffs) !== null
                    ? Math.abs(safeNum(prod?.writeOffs))
                    : null)
              : null;

            const brokenVal = appts !== null
              ? (safeNum(appts?.brokenAppointments) !== null
                  ? safeNum(appts?.brokenAppointments)
                  : safeNum(appts?.broken))
              : null;

            return {
              month: monthLabel(year, month),
              // UCR / Gross Production — full billed fee before reductions
              ucr_production: prod !== null ? safeNum(prod?.grossProduction) : null,
              // Net Production — after adjustments
              net_production: prod !== null ? safeNum(prod?.netProduction) : null,
              // Production Adjustments — reductions (stored as negative, display as positive for chart)
              production_adjustments: adjVal,
              // Collections — actual money collected
              collections: coll !== null ? safeNum(coll?.totalCollections) : null,
              new_patients: patients !== null ? safeNum(patients?.newPatients) : null,
              broken_appointments: brokenVal,
            };
          });
        })
      );

      const points = results
        ?.filter((r) => r?.status === 'fulfilled')
        ?.map((r) => r?.value);
      setTrendPoints(points);
    } catch (e) {
      console.error('TrendsTab error:', e);
      setApiError(true);
      setTrendPoints([]);
    } finally {
      setLoading(false);
    }
  }, [officeIds?.join(','), dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4]?.map((i) => <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Dentrix API unavailable — trend data cannot be displayed. Values are not estimated or substituted.
      </div>
    );
  }

  // All trend data is a flat array — single "All Offices" line since API aggregates across all locations
  const officeKey = 'All Offices';

  // Production chart: show UCR and Net as separate lines
  const productionData = trendPoints?.map((p) => ({
    month: p?.month,
    'UCR / Gross Fee': p?.ucr_production,
    'Net Production': p?.net_production,
  }));

  // Adjustments chart
  const adjustmentsData = trendPoints?.map((p) => ({
    month: p?.month,
    [officeKey]: p?.production_adjustments,
  }));

  const collectionsData = trendPoints?.map((p) => ({ month: p?.month, [officeKey]: p?.collections }));
  const newPatientsData = trendPoints?.map((p) => ({ month: p?.month, [officeKey]: p?.new_patients }));
  const brokenApptData = trendPoints?.map((p) => ({ month: p?.month, [officeKey]: p?.broken_appointments }));

  return (
    <div className="space-y-6">
      {/* Production: UCR vs Net — two separate lines */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Production Trend (12 Months)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            UCR / Gross Fee = full billed amount · Net Production = after adjustments · Missing months show as chart gaps (N/A)
          </p>
        </div>
        {productionData?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(400, productionData?.length * 60) }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={productionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => v !== null ? `$${(v / 1000)?.toFixed(0)}k` : ''} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null;
                      return (
                        <div className="bg-white border border-border rounded p-2 text-xs">
                          <p className="font-semibold mb-1">{label}</p>
                          {payload?.map((entry) => (
                            <p key={entry?.name} style={{ color: entry?.color }}>
                              {entry?.name}: {fmtOrNA(entry?.value, fmtCurrency)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="UCR / Gross Fee"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Net Production"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Production Adjustments (12 Months)"
          subtitle="PPO write-offs, contractual reductions, discounts · Missing months show as chart gaps (N/A)"
          data={adjustmentsData}
          officeNames={[officeKey]}
          formatter={(v) => fmtCurrency(v)}
          yFormatter={(v) => v !== null ? `$${(v / 1000)?.toFixed(0)}k` : ''}
        />
        <TrendChart
          title="Collections Trend (12 Months)"
          subtitle="Actual money collected — separate from production · Missing months show as chart gaps (N/A)"
          data={collectionsData}
          officeNames={[officeKey]}
          formatter={(v) => fmtCurrency(v)}
          yFormatter={(v) => v !== null ? `$${(v / 1000)?.toFixed(0)}k` : ''}
        />
        <TrendChart
          title="New Patients Trend (12 Months)"
          data={newPatientsData}
          officeNames={[officeKey]}
          formatter={(v) => fmtNum(v)}
          yFormatter={(v) => v !== null ? String(v) : ''}
        />
        <TrendChart
          title="Broken Appointments (12 Months)"
          data={brokenApptData}
          officeNames={[officeKey]}
          formatter={(v) => fmtNum(v)}
          yFormatter={(v) => v !== null ? String(v) : ''}
        />
      </div>
    </div>
  );
};

export default TrendsTab;
