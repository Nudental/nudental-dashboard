import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchOfficesHeatmap, monthLabel, fmtCurrency, fmtNum, getLastNMonths } from '../../../services/operationsService';
import { supabase } from '../../../lib/supabase';

import { resolveOfficeName, OFFICE_MAP, LOCATION_ID_MAP } from '../../../constants/offices';
import { ascendApi } from '../../../services/ascendApi';

const FALLBACK_COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// All known office UUIDs — used when no office filter is selected
const ALL_KNOWN_OFFICE_IDS = Object.keys(LOCATION_ID_MAP);

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

// Stage 4B-2: null-safe sum across an array of nullable numbers.
// If ALL values are null (all offices failed), returns null.
// If at least one office succeeded, sums only the non-null values.
// Real backend 0 is preserved and contributes 0 to the sum.
const nullSafeSum = (values) => {
  const valid = values?.filter(v => v !== null && v !== undefined);
  if (!valid || valid?.length === 0) return null;
  return valid?.reduce((a, b) => a + b, 0);
};

const buildChartData = (records, officeMap, metricFn) => {
  const byMonth = {};
  records?.forEach((r) => {
    const key = `${r?.report_year}-${String(r?.report_month)?.padStart(2, '0')}`;
    if (!byMonth?.[key]) byMonth[key] = { month: monthLabel(r?.report_year, r?.report_month) };
    const name = officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id);
    const val = metricFn(r);
    // Stage 3B: preserve null — do not convert null to 0
    if (val !== null && val !== undefined) {
      byMonth[key][name] = parseFloat(val?.toFixed(2));
    } else {
      byMonth[key][name] = null;
    }
  });
  return Object.values(byMonth);
};

const TrendChart = ({ title, data, officeNames, formatter }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
    {data?.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground text-sm">No data available</div>
    ) : (
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(400, data?.length * 60) }}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatter} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(v, name) => [fmtOrNA(v, formatter || ((x) => x)), resolveOfficeName(name)]}
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

// Goal vs Actual Progress Card
const GoalCard = ({ title, actual, goal, actualLabel, goalLabel, color = '#10b981' }) => {
  const pct = goal > 0 && actual !== null ? Math.min((actual / goal) * 100, 100) : 0;
  const overPct = goal > 0 && actual !== null ? (actual / goal) * 100 : 0;
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-sm font-semibold text-foreground mb-3">{title}</div>
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {actualLabel}
        </span>
        <span className="text-xs text-muted-foreground">Goal: {goalLabel}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {overPct > 0 ? `${overPct?.toFixed(1)}% to goal` : 'No goal set'}
      </div>
    </div>
  );
};

const PerformanceTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [goalsData, setGoalsData] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stage 4B-2: Dentrix goal-card actuals — null until fetched
  const [dentrixNetProduction, setDentrixNetProduction] = useState(null);
  const [dentrixCollections, setDentrixCollections] = useState(null);
  const [dentrixNewPatients, setDentrixNewPatients] = useState(null);
  const [dentrixActivePatients, setDentrixActivePatients] = useState(null);
  // Track whether any office had a partial failure (for UI note)
  const [partialDataOffices, setPartialDataOffices] = useState([]);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const load = useCallback(async () => {
    setLoading(true);
    // Reset Dentrix actuals on each load
    setDentrixNetProduction(null);
    setDentrixCollections(null);
    setDentrixNewPatients(null);
    setDentrixActivePatients(null);
    setPartialDataOffices([]);

    try {
      // ── Date range ──────────────────────────────────────────────────────────
      const startDate = dateRange
        ? `${dateRange?.startYear}-${String(dateRange?.startMonth)?.padStart(2, '0')}-01`
        : null;
      // Use true last day of month — do not hardcode 31
      const endDate = dateRange
        ? `${dateRange?.endYear}-${String(dateRange?.endMonth)?.padStart(2, '0')}-${String(new Date(dateRange.endYear, dateRange.endMonth, 0)?.getDate())?.padStart(2, '0')}`
        : null;

      // ── Office list for Dentrix per-office fetches ───────────────────────────
      // If offices are selected, use those; otherwise use all four known offices.
      const targetOfficeIds = officeIds?.length > 0 ? officeIds : ALL_KNOWN_OFFICE_IDS;

      // ── Stage 4B-2: Per-office Dentrix goal-card actuals ─────────────────────
      // Fetch production, collections, and patients per office using Promise.allSettled.
      // Failed offices contribute null — do NOT convert to 0.
      // Real backend 0 is preserved.
      if (startDate && endDate) {
        const officeActualResults = await Promise.allSettled(
          targetOfficeIds?.map(async (officeId) => {
            const locationId = LOCATION_ID_MAP?.[officeId] ?? null;
            if (!locationId) return { officeId, netProduction: null, totalCollections: null, newPatients: null, activePatients: null };

            const [prodResult, collResult, patientsResult] = await Promise.allSettled([
              ascendApi?.getProduction(startDate, endDate, locationId)?.catch(() => null),
              ascendApi?.getCollections(startDate, endDate, locationId)?.catch(() => null),
              ascendApi?.getPatients(startDate, endDate, locationId)?.catch(() => null),
            ]);

            // null-preserving: API failure → null. Missing field → null. Real 0 → 0.
            const prodData = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
            const collData = collResult?.status === 'fulfilled' ? collResult?.value : null;
            const patientsData = patientsResult?.status === 'fulfilled' ? patientsResult?.value : null;

            return {
              officeId,
              netProduction: prodData !== null ? safeNum(prodData?.netProduction) : null,
              totalCollections: collData !== null ? safeNum(collData?.totalCollections) : null,
              newPatients: patientsData !== null ? safeNum(patientsData?.newPatients) : null,
              // activePatients preferred; uniquePatients as confirmed alias only if activePatients missing
              activePatients: patientsData !== null
                ? (safeNum(patientsData?.activePatients) ?? safeNum(patientsData?.uniquePatients) ?? null)
                : null,
            };
          })
        );

        // Collect per-office results — track failed offices for partial-data note
        const successfulActuals = [];
        const failedOfficeIds = [];
        officeActualResults?.forEach((result, idx) => {
          if (result?.status === 'fulfilled' && result?.value) {
            successfulActuals?.push(result?.value);
          } else {
            failedOfficeIds?.push(targetOfficeIds?.[idx]);
          }
        });

        if (failedOfficeIds?.length > 0) {
          setPartialDataOffices(failedOfficeIds);
        }

        // nullSafeSum: if all offices failed → null (N/A). If at least one succeeded → sum of non-null values.
        // Do NOT use || 0 or ?? 0 — real backend 0 contributes 0 to the sum.
        setDentrixNetProduction(nullSafeSum(successfulActuals?.map(o => o?.netProduction)));
        setDentrixCollections(nullSafeSum(successfulActuals?.map(o => o?.totalCollections)));
        setDentrixNewPatients(nullSafeSum(successfulActuals?.map(o => o?.newPatients)));
        setDentrixActivePatients(nullSafeSum(successfulActuals?.map(o => o?.activePatients)));
      }

      // ── 12-month trend (Dentrix, already wired in Stage 3B) ─────────────────
      // locationId for trend: single office if exactly one selected, otherwise null (all-offices)
      const locationId = officeIds?.length === 1 ? officeIds?.[0] : null;
      const months = getLastNMonths(12);
      const trendResults = await Promise.allSettled(
        months?.map(({ year, month }) => {
          const mStart = `${year}-${String(month)?.padStart(2, '0')}-01`;
          const mEnd = `${year}-${String(month)?.padStart(2, '0')}-${String(new Date(year, month, 0)?.getDate())?.padStart(2, '0')}`;
          return Promise.all([
            ascendApi?.getProduction(mStart, mEnd, locationId)?.catch(() => null),
            ascendApi?.getCollections(mStart, mEnd, locationId)?.catch(() => null),
          ])?.then(([prod, coll]) => {
            // Stage 3B: null-preserving — API failure → null. Real 0 preserved.
            const netProd = prod !== null ? safeNum(prod?.netProduction) : null;
            const grossProd = prod !== null ? safeNum(prod?.grossProduction) : null;
            const collTotal = coll !== null ? safeNum(coll?.totalCollections) : null;
            // V313: adjustments from Dentrix /v2/production/summary only — same field as Offices tab
            const adjVal = prod !== null ? safeNum(prod?.adjustments) : null;

            return {
              report_year: year,
              report_month: month,
              office_id: locationId || 'all',
              production_total: netProd,
              gross_production: grossProd,
              collections_total: collTotal,
              adjustments_net: adjVal,
              // V313: tx_diagnosed_value / tx_accepted_value intentionally null — Case Acceptance
              // source not wired. Do NOT use MEA tx_diagnosed_value / tx_accepted_value.
              tx_diagnosed_value: null,
              tx_accepted_value: null,
            };
          });
        })
      );
      const trendRecords = trendResults
        ?.filter((r) => r?.status === 'fulfilled')
        ?.map((r) => r?.value);

      // ── Heatmap (still used for Scheduled vs Open table only) ───────────────
      const heatmap = dateRange ? await fetchOfficesHeatmap({ ...dateRange, officeIds }) : [];

      setData(trendRecords || []);
      setHeatmapData(heatmap || []);

      // ── Goals from office_goals (unchanged) ─────────────────────────────────
      if (dateRange) {
        // V274 fix: scope goals query to selected month/year only — not all historical rows.
        // Without month_year filter, the query sums ALL goal rows for those offices,
        // producing inflated totals (e.g., $9M instead of ~$185k).
        const goalMonthYear = `${dateRange?.endYear}-${String(dateRange?.endMonth)?.padStart(2, '0')}`;
        let gQuery = supabase?.from('office_goals')?.select('office_id, production_goal, collections_goal, new_patients_goal, monthly_target')
          ?.eq('month_year', goalMonthYear);
        if (officeIds?.length > 0) gQuery = gQuery?.in('office_id', officeIds);
        const { data: gData } = await gQuery;
        setGoalsData(gData || []);
      }

      // ── Providers for filter ─────────────────────────────────────────────────
      let pQuery = supabase?.from('providers')?.select('id, name, provider_type')?.eq('is_active', true);
      if (officeIds?.length > 0) pQuery = pQuery?.in('office_id', officeIds);
      const { data: pData } = await pQuery;
      setProviders(pData || []);
    } catch (e) {
      console.error('PerformanceTab error:', e);
    } finally {
      setLoading(false);
    }
  }, [officeIds?.join(','), dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth]);

  useEffect(() => { load(); }, [load]);

  const officeNames = [...new Set(data?.map((r) => officeMap?.[r?.office_id] || r?.office_id))];

  // Stage 3B: collection rate — null if net production or collections is null/missing.
  const collectionRateData = buildChartData(data, officeMap, (r) => {
    const prod = safeNum(r?.production_total);
    const coll = safeNum(r?.collections_total);
    if (prod === null || coll === null) return null;
    if (prod === 0) return null;
    return (coll / prod) * 100;
  });

  // V313: Case Acceptance — source not wired. Do NOT compute from MEA tx_diagnosed_value /
  // tx_accepted_value. tx_diagnosed_value and tx_accepted_value are always null in trendRecords
  // (set intentionally above). caseAcceptanceData is no longer used for a chart.

  // V313: Adjustment % — formula consistent with Operations Offices tab:
  // abs(adjustments) ÷ grossProduction (not netProduction).
  // Both fields come from Dentrix /v2/production/summary only.
  // If either field is missing or grossProduction is 0, show null/gap.
  const adjPctData = buildChartData(data, officeMap, (r) => {
    const grossProd = safeNum(r?.gross_production);
    const adj = safeNum(r?.adjustments_net);
    if (grossProd === null || adj === null) return null;
    if (grossProd === 0) return null;
    return (Math.abs(adj) / grossProd) * 100;
  });

  // ── Goal targets from office_goals (unchanged from Stage 4B-1 / locked goal logic) ──
  const totalProdGoal = goalsData?.reduce(
    (a, g) => a + parseFloat(g?.production_goal ?? g?.monthly_target ?? 0),
    0
  );

  // Skip null collection goals; if ALL are null, keep total as null (not 0)
  const validCollGoals = goalsData?.filter(g => g?.collections_goal !== null && g?.collections_goal !== undefined) ?? [];
  const totalCollGoal = validCollGoals?.length > 0
    ? validCollGoals?.reduce((a, g) => a + parseFloat(g?.collections_goal || 0), 0)
    : null;

  const totalNpGoal = goalsData?.reduce((a, g) => a + (parseInt(g?.new_patients_goal) || 0), 0);

  // ── Stage 4B-2: Goal-card actuals — Dentrix API values ──────────────────────
  // dentrixNetProduction: Dentrix netProduction summed across offices (null if all failed)
  // dentrixCollections: Dentrix totalCollections summed across offices (null if all failed)
  // dentrixNewPatients: Dentrix newPatients summed across offices (null if all failed)
  // dentrixActivePatients: Dentrix activePatients summed across offices (null if all failed)
  // All null values display as N/A. Real backend 0 displays as $0/0.

  // Office activity uses actual Dentrix net production, not scheduled production.
  // No MEA production_total/collections_total/new_patients used here.
  // open_appt_hours: no confirmed Dentrix chair-hours endpoint — shows N/A.
  const schedBreakdown = heatmapData?.map((r) => {
    const netProd = (r?.netProduction !== undefined && r?.netProduction !== null) ? r?.netProduction : null;
    const collActual = (r?.totalCollections !== undefined && r?.totalCollections !== null) ? r?.totalCollections : null;
    const newPt = (r?.newPatients !== undefined && r?.newPatients !== null) ? r?.newPatients : null;
    return {
      location: officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id),
      scheduled_production: netProd,
      collections_actual: collActual,
      open_appt_hours: null, // No confirmed Dentrix chair-hours endpoint — mapping required
      new_pt_actual: newPt,
    };
  });

  const toggleProvider = (id) => {
    setSelectedProviders((prev) => prev?.includes(id) ? prev?.filter((x) => x !== id) : [...prev, id]);
  };

  const providerLabel = selectedProviders?.length === 0
    ? `PROVIDERS 0 selected`
    : `${selectedProviders?.length} selected`;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4]?.map((i) => <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="text-xs text-muted-foreground text-right">
        Source: Dentrix Ascend API for actuals · office_goals for targets · Case Acceptance source not wired
      </div>
      {/* Partial data warning — shown if one or more offices had API failures */}
      {partialDataOffices?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs text-yellow-800">
          ⚠ Partial data: {partialDataOffices?.length} office(s) could not be fetched from Dentrix. Actuals reflect available offices only.
        </div>
      )}
      {/* Goal vs Actual Cards — Stage 4B-2: all actuals from Dentrix API */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GoalCard
          title="Production"
          actual={dentrixNetProduction}
          goal={totalProdGoal}
          actualLabel={dentrixNetProduction !== null ? fmtCurrency(dentrixNetProduction) : 'N/A'}
          goalLabel={fmtCurrency(totalProdGoal)}
          color="#0d9488"
        />
        <GoalCard
          title="Collections"
          actual={dentrixCollections}
          goal={totalCollGoal}
          actualLabel={dentrixCollections !== null ? fmtCurrency(dentrixCollections) : 'N/A'}
          goalLabel={totalCollGoal !== null ? fmtCurrency(totalCollGoal) : 'N/A'}
          color="#4f46e5"
        />
        <GoalCard
          title="New Patients"
          actual={dentrixNewPatients}
          goal={totalNpGoal}
          actualLabel={dentrixNewPatients !== null ? fmtNum(dentrixNewPatients) : 'N/A'}
          goalLabel={fmtNum(totalNpGoal)}
          color="#f59e0b"
        />
        <GoalCard
          title="Active Patients"
          actual={dentrixActivePatients}
          goal={0}
          actualLabel={dentrixActivePatients !== null ? fmtNum(dentrixActivePatients) : 'N/A'}
          goalLabel="—"
          color="#8b5cf6"
        />
      </div>
      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Collection Rate Trend (12 Months)"
          data={collectionRateData}
          officeNames={officeNames}
          formatter={(v) => `${v?.toFixed(1)}%`}
        />
        <TrendChart
          title="Adjustment % Trend (12 Months)"
          data={adjPctData}
          officeNames={officeNames}
          formatter={(v) => `${v?.toFixed(1)}%`}
        />
      </div>
      {/* V313: Case Acceptance trend — source not wired.
          MEA tx_diagnosed_value / tx_accepted_value is not a trusted source.
          Displaying a clear placeholder until a verified TxCase/case-acceptance endpoint is wired. */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-base font-semibold text-foreground mb-2">Case Acceptance Trend (12 Months)</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Source Not Wired
          </span>
          <p className="text-sm text-muted-foreground mt-1">
            Trusted TxCase / case-acceptance source not connected.
          </p>
          <p className="text-xs text-muted-foreground">
            MEA <code className="font-mono">tx_diagnosed_value</code> / <code className="font-mono">tx_accepted_value</code> is not a verified source and will not be used.
          </p>
        </div>
      </div>
      {/* Actual office production and activity */}
      {schedBreakdown?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-base font-semibold text-foreground mb-4">Office Production &amp; Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-2 pr-4">Location</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-4">Net Production</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-4">Collections</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-4">Open Appt Hrs</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2">New Pts</th>
                </tr>
              </thead>
              <tbody>
                {schedBreakdown?.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-foreground text-xs">{r?.location}</td>
                    <td className="py-2 pr-4 text-right text-xs">{r?.scheduled_production !== null && isFinite(r?.scheduled_production) ? fmtCurrency(r?.scheduled_production) : 'N/A'}</td>
                    <td className="py-2 pr-4 text-right text-xs">{r?.collections_actual !== null && isFinite(r?.collections_actual) ? fmtCurrency(r?.collections_actual) : 'N/A'}</td>
                    <td className="py-2 pr-4 text-right text-xs">{r?.open_appt_hours !== null ? `${r?.open_appt_hours?.toFixed(1)}h` : 'N/A'}</td>
                    <td className="py-2 text-right text-xs">{r?.new_pt_actual !== null && isFinite(r?.new_pt_actual) ? fmtNum(r?.new_pt_actual) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTab;
