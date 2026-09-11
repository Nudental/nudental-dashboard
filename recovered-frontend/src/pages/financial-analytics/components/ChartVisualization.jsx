import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { ascendApi } from '../../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../../constants/offices';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (v) =>
  typeof v === 'number' && isFinite(v)
    ? v?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : '—';

const fmtPct = (v) =>
  typeof v === 'number' && isFinite(v) ? `${v?.toFixed(1)}%` : '—';

const fmtDiff = (v) => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}`;
};

const fmtPctDiff = (v) => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v?.toFixed(1)} pts`;
};

const fmtPctChange = (current, previous) => {
  if (typeof previous !== 'number' || !isFinite(previous) || previous === 0) return 'N/A';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!isFinite(pct)) return 'N/A';
  return `${pct >= 0 ? '+' : ''}${pct?.toFixed(1)}%`;
};

// Compute previous equal-length period: [prevStart, prevEnd] immediately before selectedStart
const getPreviousPeriod = (startIso, endIso) => {
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  const diffMs = end - start;
  const diffDays = Math.round(diffMs / 86400000); // inclusive span in days
  const prevEnd = new Date(start);
  prevEnd?.setDate(prevEnd?.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart?.setDate(prevStart?.getDate() - diffDays);
  const toIso = (d) => d?.toISOString()?.slice(0, 10);
  return { prevStart: toIso(prevStart), prevEnd: toIso(prevEnd) };
};

// Days elapsed in a date range (inclusive)
const daysInRange = (startIso, endIso) => {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  return Math.round((e - s) / 86400000) + 1;
};

// Total calendar days in the month of a given ISO date
const daysInMonth = (isoDate) => {
  const d = new Date(isoDate + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)?.getDate();
};

// Check if start and end are within the same calendar month
const isSameMonth = (startIso, endIso) => {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  return s?.getFullYear() === e?.getFullYear() && s?.getMonth() === e?.getMonth();
};

const formatIsoDisplay = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso?.split('-');
  return `${m}/${d}/${y}`;
};

// ── ComparativePanel ─────────────────────────────────────────────────────────
const ComparativePanel = ({ appliedDateRange, appliedOffices }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [previousData, setPreviousData] = useState(null);
  const [prevPeriod, setPrevPeriod] = useState(null);

  useEffect(() => {
    if (!appliedDateRange?.start || !appliedDateRange?.end) return;

    const fetchBoth = async () => {
      setLoading(true);
      setError(null);
      try {
        const locationId =
          appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
            ? getLocationIdByOfficeId(appliedOffices?.[0])
            : null;

        const { prevStart, prevEnd } = getPreviousPeriod(
          appliedDateRange?.start,
          appliedDateRange?.end
        );
        setPrevPeriod({ prevStart, prevEnd });

        const [curProd, curColl, prevProd, prevColl] = await Promise.all([
          ascendApi?.getProduction(appliedDateRange?.start, appliedDateRange?.end, locationId)?.catch(() => null),
          ascendApi?.getCollections(appliedDateRange?.start, appliedDateRange?.end, locationId)?.catch(() => null),
          ascendApi?.getProduction(prevStart, prevEnd, locationId)?.catch(() => null),
          ascendApi?.getCollections(prevStart, prevEnd, locationId)?.catch(() => null),
        ]);

        const buildRow = (prod, coll) => {
          const grossProduction = prod?.grossProduction ?? 0;
          const adjustments = prod?.adjustments ?? prod?.writeOffs ?? 0;
          const netProduction = prod?.netProduction ?? 0;
          const patientCollections = coll?.patientCollections ?? coll?.patient_collections ?? 0;
          const insuranceCollections = coll?.insuranceCollections ?? coll?.insurance_collections ?? 0;
          const totalCollections = coll?.totalCollections ?? coll?.total_collections ?? Math.abs(patientCollections) + Math.abs(insuranceCollections);
          const collectionRate = netProduction !== 0 ? (Math.abs(totalCollections) / Math.abs(netProduction)) * 100 : 0;
          return { grossProduction, adjustments, netProduction, patientCollections, insuranceCollections, totalCollections, collectionRate };
        };

        setCurrentData(buildRow(curProd, curColl));
        setPreviousData(buildRow(prevProd, prevColl));
      } catch (err) {
        setError(err?.message || 'Failed to load comparison data.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoth();
  }, [appliedDateRange?.start, appliedDateRange?.end, appliedOffices?.join?.(',')]);

  const metrics = [
    { key: 'grossProduction', label: 'Gross Production', format: fmt$ },
    { key: 'adjustments', label: 'Production Adjustments', format: (v) => `(${fmt$(Math.abs(v))})` },
    { key: 'netProduction', label: 'Net Production', format: fmt$ },
    { key: 'patientCollections', label: 'Patient Collections', format: fmt$ },
    { key: 'insuranceCollections', label: 'Insurance Collections', format: fmt$ },
    { key: 'totalCollections', label: 'Total Collections', format: fmt$ },
    { key: 'collectionRate', label: 'Collection Rate', format: fmtPct, diffFormat: fmtPctDiff },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-7 w-7 text-primary mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-muted-foreground">Loading comparison data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <Icon name="AlertCircle" size={14} className="inline mr-1" />
        {error}
      </div>
    );
  }

  if (!currentData || !previousData) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground italic text-center">
        Apply Filters to load comparative data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
        <span><span className="font-semibold text-foreground">Selected Period:</span> {formatIsoDisplay(appliedDateRange?.start)} – {formatIsoDisplay(appliedDateRange?.end)}</span>
        <span className="hidden sm:inline">·</span>
        <span><span className="font-semibold text-foreground">Previous Period:</span> {formatIsoDisplay(prevPeriod?.prevStart)} – {formatIsoDisplay(prevPeriod?.prevEnd)}</span>
        <span className="hidden sm:inline">·</span>
        <span className="italic text-emerald-700">Source: Dentrix FastAPI/SQLite</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-foreground">Metric</th>
              <th className="text-right py-2 px-3 font-semibold text-foreground">Selected Period</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Previous Period</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Difference</th>
              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">% Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.map((m, i) => {
              const cur = currentData?.[m?.key];
              const prev = previousData?.[m?.key];
              const diff = typeof cur === 'number' && typeof prev === 'number' ? cur - prev : null;
              const pctChange = fmtPctChange(cur, prev);
              const isPositive = diff !== null && diff >= 0;
              const isAdjustments = m?.key === 'adjustments';
              // For adjustments, negative diff (less adjustments) is actually good
              const diffColor = isAdjustments
                ? (diff !== null && diff <= 0 ? 'text-emerald-600' : 'text-red-500')
                : (diff !== null && diff >= 0 ? 'text-emerald-600' : 'text-red-500');
              return (
                <tr key={m?.key} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <td className="py-2.5 px-3 font-medium text-foreground">{m?.label}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-foreground">{m?.format(cur)}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{m?.format(prev)}</td>
                  <td className={`py-2.5 px-3 text-right font-medium ${diffColor}`}>
                    {diff !== null ? (m?.diffFormat ? m?.diffFormat(diff) : fmtDiff(diff)) : '—'}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-medium ${pctChange === 'N/A' ? 'text-muted-foreground' : diffColor}`}>
                    {pctChange}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground italic px-1">
        % Change = (Current − Previous) / |Previous| × 100. "N/A" shown when previous value is zero.
      </p>
    </div>
  );
};

// ── ForecastingPanel ─────────────────────────────────────────────────────────
const ForecastingPanel = ({ appliedDateRange, appliedOffices }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!appliedDateRange?.start || !appliedDateRange?.end) return;

    const fetchCurrent = async () => {
      setLoading(true);
      setError(null);
      try {
        const locationId =
          appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
            ? getLocationIdByOfficeId(appliedOffices?.[0])
            : null;

        const [prod, coll] = await Promise.all([
          ascendApi?.getProduction(appliedDateRange?.start, appliedDateRange?.end, locationId)?.catch(() => null),
          ascendApi?.getCollections(appliedDateRange?.start, appliedDateRange?.end, locationId)?.catch(() => null),
        ]);

        const netProduction = prod?.netProduction ?? 0;
        const totalCollections = coll?.totalCollections ?? coll?.total_collections ?? 0;
        const elapsed = daysInRange(appliedDateRange?.start, appliedDateRange?.end);
        const monthDays = daysInMonth(appliedDateRange?.start);
        const collectionRate = netProduction !== 0 ? (Math.abs(totalCollections) / Math.abs(netProduction)) * 100 : 0;

        const projectedNetProduction = elapsed > 0 ? (netProduction / elapsed) * monthDays : 0;
        const projectedCollections = elapsed > 0 ? (Math.abs(totalCollections) / elapsed) * monthDays : 0;
        const projectedCollectionRate = projectedNetProduction !== 0 ? (projectedCollections / Math.abs(projectedNetProduction)) * 100 : 0;

        setData({
          netProduction,
          totalCollections: Math.abs(totalCollections),
          collectionRate,
          projectedNetProduction,
          projectedCollections,
          projectedCollectionRate,
          elapsed,
          monthDays,
        });
      } catch (err) {
        setError(err?.message || 'Failed to load forecasting data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrent();
  }, [appliedDateRange?.start, appliedDateRange?.end, appliedOffices?.join?.(',')]);

  const multiMonth = appliedDateRange?.start && appliedDateRange?.end && !isSameMonth(appliedDateRange?.start, appliedDateRange?.end);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-7 w-7 text-primary mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-muted-foreground">Loading forecast data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <Icon name="AlertCircle" size={14} className="inline mr-1" />
        {error}
      </div>
    );
  }

  if (multiMonth) {
    return (
      <div className="px-4 py-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 text-center">
        <Icon name="AlertTriangle" size={16} className="inline mr-2" />
        Forecasting works best for a single-month date range. Select one month or month-to-date period.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground italic text-center">
        Apply Filters to load forecast data.
      </div>
    );
  }

  const rows = [
    { label: 'Current Net Production', value: fmt$(data?.netProduction), sub: `${data?.elapsed} days elapsed`, highlight: false },
    { label: 'Forecast Month-End Net Production', value: fmt$(data?.projectedNetProduction), sub: `${data?.elapsed} / ${data?.monthDays} days × daily rate`, highlight: true },
    { label: 'Current Collections', value: fmt$(data?.totalCollections), sub: `${data?.elapsed} days elapsed`, highlight: false },
    { label: 'Forecast Month-End Collections', value: fmt$(data?.projectedCollections), sub: `${data?.elapsed} / ${data?.monthDays} days × daily rate`, highlight: true },
    { label: 'Current Collection Rate', value: fmtPct(data?.collectionRate), sub: 'Collections / Net Production', highlight: false },
    { label: 'Forecast Collection Rate', value: fmtPct(data?.projectedCollectionRate), sub: 'Projected Collections / Projected Net Production', highlight: true },
    { label: 'Days Elapsed', value: `${data?.elapsed}`, sub: `of ${data?.monthDays} calendar days in month`, highlight: false },
    { label: 'Days in Month', value: `${data?.monthDays}`, sub: formatIsoDisplay(appliedDateRange?.start)?.slice(0, 5) + ' calendar month', highlight: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
        <span><span className="font-semibold text-foreground">Period:</span> {formatIsoDisplay(appliedDateRange?.start)} – {formatIsoDisplay(appliedDateRange?.end)}</span>
        <span className="hidden sm:inline">·</span>
        <span><span className="font-semibold text-foreground">Elapsed:</span> {data?.elapsed} of {data?.monthDays} days</span>
        <span className="hidden sm:inline">·</span>
        <span className="italic text-emerald-700">Source: Dentrix FastAPI/SQLite</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows?.map((row, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 border ${row?.highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'}`}
          >
            <p className="text-xs text-muted-foreground mb-1">{row?.label}</p>
            <p className={`text-xl font-bold ${row?.highlight ? 'text-primary' : 'text-foreground'}`}>{row?.value}</p>
            <p className="text-xs text-muted-foreground mt-1 italic">{row?.sub}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground italic px-1">
        Formula: Forecast = (Current Value / Days Elapsed) × Calendar Days in Month. Based on verified Dentrix FastAPI/SQLite data only.
      </p>
    </div>
  );
};

// ── ChartVisualization ────────────────────────────────────────────────────────
const ChartVisualization = ({ data, mode, goalData = null, appliedDateRange, appliedOffices }) => {
  const [chartType, setChartType] = useState('line');

  const trendData = data?.trendData || [];
  const scatterData = [];

  // goalData: { dailyTarget, paceTarget, daysInMonth, currentDay, target }
  const dailyTarget = goalData?.dailyTarget || 0;
  const goalTarget = typeof goalData?.target === 'number' && isFinite(goalData?.target) ? goalData?.target : null;

  const chartTypes = [
    { value: 'line', label: 'Line Chart', icon: 'TrendingUp' },
    { value: 'bar', label: 'Bar Chart', icon: 'BarChart3' },
    { value: 'scatter', label: 'Scatter Plot', icon: 'GitBranch' }
  ];

  const renderTrendChart = () => {
    if (!trendData?.length) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="BarChart3" size={28} className="text-muted-foreground" />
          </div>
          <h4 className="text-base font-semibold text-foreground mb-2">No data yet</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            Start by submitting an EOD Report to see your financial analytics here.
          </p>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} tickFormatter={(v) => `${(v / 1000)?.toFixed(0)}K`} />
            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={(v) => `${v?.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="expenses" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="profit" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 4 }} />
            {dailyTarget > 0 && (
              <ReferenceLine y={dailyTarget} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Daily Target: $${Math.round(dailyTarget / 1000)}K`, position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} tickFormatter={(v) => `${(v / 1000)?.toFixed(0)}K`} />
            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={(v) => `${v?.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-warning)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="profit" fill="var(--color-success)" radius={[8, 8, 0, 0]} />
            {dailyTarget > 0 && (
              <ReferenceLine y={dailyTarget} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Daily Target: $${Math.round(dailyTarget / 1000)}K`, position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis type="number" dataKey="marketing" name="Marketing Spend" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} tickFormatter={(v) => `${(v / 1000)?.toFixed(0)}K`} />
            <YAxis type="number" dataKey="revenue" name="Revenue" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} tickFormatter={(v) => `${(v / 1000)?.toFixed(0)}K`} />
            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={(v) => `${v?.toLocaleString()}`} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Marketing vs Revenue" data={scatterData} fill="var(--color-primary)" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
  };

  // ── Summary card computations (trend mode only) ───────────────────────────
  const validTrendPoints = trendData?.filter(
    (d) => d != null && typeof (d?.revenue ?? d?.netProduction ?? d?.value) === 'number' && isFinite(d?.revenue ?? d?.netProduction ?? d?.value)
  );

  const getTrendValue = (d) =>
    typeof d?.revenue === 'number' && isFinite(d?.revenue) ? d?.revenue
    : typeof d?.netProduction === 'number' && isFinite(d?.netProduction) ? d?.netProduction
    : typeof d?.value === 'number' && isFinite(d?.value) ? d?.value
    : null;

  const formatCurrency = (v) =>
    typeof v === 'number' && isFinite(v)
      ? v?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      : '—';

  const formatMonth = (d) => {
    if (!d) return '';
    const raw = d?.month || d?.label || d?.period || '';
    if (!raw) return '';
    const isoMatch = raw?.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      const dt = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, 1);
      return dt?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return raw;
  };

  let peakPoint = null;
  let peakValue = null;
  if (validTrendPoints?.length > 0) {
    peakPoint = validTrendPoints?.reduce((best, d) => {
      const v = getTrendValue(d);
      const bestV = getTrendValue(best);
      return v > bestV ? d : best;
    }, validTrendPoints?.[0]);
    peakValue = getTrendValue(peakPoint);
  }

  let avgMonthly = null;
  if (validTrendPoints?.length > 0) {
    const sum = validTrendPoints?.reduce((acc, d) => acc + (getTrendValue(d) || 0), 0);
    avgMonthly = sum / validTrendPoints?.length;
  }

  let growthRate = null;
  let growthLabel = 'Trailing Growth';
  let growthSubtext = '';
  let growthDisplay = null;
  if (validTrendPoints?.length >= 2) {
    const firstVal = getTrendValue(validTrendPoints?.[0]);
    const lastVal = getTrendValue(validTrendPoints?.[validTrendPoints?.length - 1]);
    const firstMonth = formatMonth(validTrendPoints?.[0]);
    const lastMonth = formatMonth(validTrendPoints?.[validTrendPoints?.length - 1]);
    growthSubtext = `${firstMonth} → ${lastMonth}`;
    if (firstVal !== null && firstVal !== 0) {
      growthRate = ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
      growthDisplay = `${growthRate >= 0 ? '+' : ''}${growthRate?.toFixed(1)}%`;
    } else if (firstVal === 0) {
      growthDisplay = 'N/A (first value is zero)';
    }
  } else if (validTrendPoints?.length === 1) {
    growthDisplay = 'Not enough trend data';
    growthSubtext = 'Need at least 2 verified trend points.';
  } else {
    growthDisplay = 'Not enough trend data';
    growthSubtext = 'No verified trend points available.';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const modeLabel = mode === 'trend' ? 'Revenue Trend Analysis'
    : mode === 'comparison' ? 'Comparative Analysis'
    : mode === 'forecast'? 'Forecasting' :'Revenue Trend Analysis';

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 shadow-elevation-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Icon name="LineChart" size={20} color="var(--color-primary)" />
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground">{modeLabel}</h2>
            {mode === 'trend' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Trailing 12-Month Trend Ending {appliedDateRange?.end || new Date()?.toISOString()?.slice(0, 10)} · Source: Dentrix FastAPI/SQLite
              </p>
            )}
            {mode === 'comparison' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparative Analysis: Selected Period vs Previous Equal-Length Period · Source: Dentrix FastAPI/SQLite
              </p>
            )}
            {mode === 'forecast' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Month-End Projection from Current Period Data · Source: Dentrix FastAPI/SQLite
              </p>
            )}
          </div>
        </div>

        {/* Chart type switcher — only shown for trend mode */}
        {mode === 'trend' && (
          <div className="flex items-center gap-2">
            {chartTypes?.map((type) => (
              <Button
                key={type?.value}
                variant={chartType === type?.value ? 'default' : 'outline'}
                size="sm"
                iconName={type?.icon}
                onClick={() => setChartType(type?.value)}
                className="flex-1 md:flex-none"
              >
                <span className="hidden md:inline">{type?.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Target Line Legend (only in trend mode when goal is set) */}
      {mode === 'trend' && dailyTarget > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-warning/5 border border-warning/20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#f59e0b' }}></div>
            <span className="text-xs text-muted-foreground">
              Daily Target: <strong>${Math.round(dailyTarget)?.toLocaleString()}</strong> / day
            </span>
          </div>
          {goalTarget !== null && (
            <div className="flex items-center gap-2">
              <Icon name="Target" size={14} color="#f59e0b" />
              <span className="text-xs text-muted-foreground">
                Monthly Goal: <strong>${goalTarget?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Trend Analysis — chart + summary cards */}
      {mode === 'trend' && (
        <>
          <div className="w-full h-64 md:h-96 lg:h-[500px]" aria-label="trend analysis chart">
            {renderTrendChart()}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="TrendingUp" size={16} color="var(--color-success)" />
                <span className="text-sm font-medium text-muted-foreground">Peak Performance</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {peakValue !== null ? formatCurrency(peakValue) : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {peakPoint
                  ? `${formatMonth(peakPoint) || 'Top month'} · Highest verified month in selected trend period.`
                  : 'No verified trend data available.'}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Activity" size={16} color="var(--color-primary)" />
                <span className="text-sm font-medium text-muted-foreground">Average Monthly</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {avgMonthly !== null ? formatCurrency(avgMonthly) : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {avgMonthly !== null
                  ? `Average across ${validTrendPoints?.length} displayed verified month${validTrendPoints?.length !== 1 ? 's' : ''}.`
                  : 'No verified trend data available.'}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Target" size={16} color="var(--color-accent)" />
                <span className="text-sm font-medium text-muted-foreground">{growthLabel}</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {growthDisplay || '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {growthSubtext || 'First visible month → latest visible month.'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Comparative Analysis panel */}
      {mode === 'comparison' && (
        <ComparativePanel
          appliedDateRange={appliedDateRange}
          appliedOffices={appliedOffices}
        />
      )}

      {/* Forecasting panel */}
      {mode === 'forecast' && (
        <ForecastingPanel
          appliedDateRange={appliedDateRange}
          appliedOffices={appliedOffices}
        />
      )}
    </div>
  );
};

export default ChartVisualization;