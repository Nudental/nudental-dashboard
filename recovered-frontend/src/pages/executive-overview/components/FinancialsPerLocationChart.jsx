import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { OFFICE_LIST, getLocationIdByOfficeId } from '../../../constants/offices';

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const fmtPct = (v) => (v != null && isFinite(v) ? `${parseFloat(v)?.toFixed(1)}%` : '—');

// P0-3 FIX: Series now shows Gross Production, Net Production, Total Actual Collections, Collection %
// Source: FastAPI/SQLite (Dentrix Ascend) — NOT Supabase monthly_executive_analytics
const SERIES = [
  { key: 'gross_production', label: 'Gross Production', color: '#66BB6A' },
  { key: 'net_production', label: 'Net Production', color: '#4DB6AC' },
  { key: 'total_collections', label: 'Total Collections', color: '#64B5F6' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-3 text-xs max-w-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload?.map((entry) => (
        <div key={entry?.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry?.color }} />
            <span className="text-muted-foreground">{entry?.name}</span>
          </div>
          <span className="font-semibold text-foreground">{fmt(entry?.value)}</span>
        </div>
      ))}
      {/* Show Collection % in tooltip */}
      {payload?.[0]?.payload?.collection_pct != null && (
        <div className="flex items-center justify-between gap-4 py-0.5 border-t border-border mt-1 pt-1">
          <span className="text-muted-foreground">Collection %</span>
          <span className="font-semibold text-foreground">{fmtPct(payload?.[0]?.payload?.collection_pct)}</span>
        </div>
      )}
    </div>
  );
};

const FinancialsPerLocationChart = ({ filters = {} }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleSeries, setVisibleSeries] = useState(SERIES?.map(s => s?.key));

  const { datePreset = 'last_month', selectedOfficeIds = [] } = filters;

  const buildDateRange = useCallback((preset) => {
    const now = new Date();
    const y = now?.getFullYear();
    const m = now?.getMonth() + 1;
    switch (preset) {
      case 'this_month': {
        const start = `${y}-${String(m)?.padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0)?.getDate();
        return { start, end: `${y}-${String(m)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}` };
      }
      case 'last_month': {
        const d = new Date(y, m - 2, 1);
        const ly = d?.getFullYear();
        const lm = d?.getMonth() + 1;
        const lastDay = new Date(ly, lm, 0)?.getDate();
        return { start: `${ly}-${String(lm)?.padStart(2, '0')}-01`, end: `${ly}-${String(lm)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}` };
      }
      case 'this_quarter': {
        const q = Math.ceil(m / 3);
        const qStartM = (q - 1) * 3 + 1;
        const qEndM = q * 3;
        const lastDay = new Date(y, qEndM, 0)?.getDate();
        return { start: `${y}-${String(qStartM)?.padStart(2, '0')}-01`, end: `${y}-${String(qEndM)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}` };
      }
      case 'ytd': {
        const lastDay = new Date(y, m, 0)?.getDate();
        return { start: `${y}-01-01`, end: `${y}-${String(m)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}` };
      }
      default: {
        const d = new Date(y, m - 2, 1);
        const ly = d?.getFullYear();
        const lm = d?.getMonth() + 1;
        const lastDay = new Date(ly, lm, 0)?.getDate();
        return { start: `${ly}-${String(lm)?.padStart(2, '0')}-01`, end: `${ly}-${String(lm)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}` };
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = buildDateRange(datePreset);

      // Determine which offices to show
      let officesToShow = OFFICE_LIST;
      if (selectedOfficeIds?.length > 0) {
        officesToShow = OFFICE_LIST?.filter(o => selectedOfficeIds?.includes(o?.id));
      }

      if (officesToShow?.length === 0) {
        setChartData([]);
        return;
      }

      // P0-3 FIX: Fetch per-office data from FastAPI/SQLite (Dentrix Ascend)
      // Each office gets its own API call using the Dentrix locationId
      const results = await Promise.allSettled(
        officesToShow?.map(async (office) => {
          const locationId = getLocationIdByOfficeId(office?.id);
          if (!locationId) return null;

          const [prodData, collData] = await Promise.allSettled([
            ascendApi?.getProduction(start, end, locationId),
            ascendApi?.getCollections(start, end, locationId),
          ]);

          const prod = prodData?.status === 'fulfilled' ? prodData?.value : null;
          const coll = collData?.status === 'fulfilled' ? collData?.value : null;

          const grossProduction = parseFloat(prod?.grossProduction ?? 0);
          // NET PRODUCTION: use only true net fields — do NOT fall back to grossProduction
          // If netProduction is missing/null, use null so the chart shows a gap, not a fake value
          const rawNet = prod?.netProduction ?? prod?.net_production ?? null;
          const netProduction = rawNet !== null && rawNet !== undefined ? parseFloat(rawNet) : null;
          if (rawNet === null || rawNet === undefined) {
            console.warn('FinancialsPerLocationChart: netProduction missing for office', office?.name, '— showing null/gap, not grossProduction fallback');
          }
          // Payments may be stored as negative credits — use Math.abs() only on collections
          const totalCollections = Math.abs(parseFloat(coll?.totalCollections ?? 0));

          // Collection % = Total Actual Collections ÷ Net Production
          // Only compute when netProduction is a real non-zero number
          const collectionPct = (netProduction !== null && netProduction > 0) ? (totalCollections / netProduction) * 100 : null;

          return {
            office: office?.name,
            gross_production: grossProduction,
            net_production: netProduction,
            total_collections: totalCollections,
            collection_pct: collectionPct,
            _hasData: grossProduction > 0 || (netProduction !== null && netProduction > 0) || totalCollections > 0,
          };
        })
      );

      const data = results
        ?.map((r, i) => r?.status === 'fulfilled' ? r?.value : null)
        ?.filter(Boolean);

      setChartData(data);
    } catch (err) {
      console.warn('FinancialsPerLocationChart fetch error:', err?.message);
      setError('Unable to load Dentrix financial data. Please check API connectivity.');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [datePreset, selectedOfficeIds, buildDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSeries = (key) => {
    setVisibleSeries(prev =>
      prev?.includes(key) ? prev?.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExportCSV = () => {
    if (!chartData?.length) return;
    const headers = ['Office', ...SERIES?.map(s => s?.label), 'Collection %'];
    const rows = chartData?.map(row => [
      row?.office,
      ...SERIES?.map(s => row?.[s?.key] || 0),
      row?.collection_pct != null ? `${row?.collection_pct?.toFixed(1)}%` : '—',
    ]);
    const csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financials_per_location.csv';
    a?.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Icon name="BarChart3" size={16} color="var(--color-primary)" />
          <h2 className="text-sm font-bold text-foreground">Financials Per Location</h2>
          <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">Dentrix Ascend Live</span>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-muted/40 text-foreground hover:bg-muted transition-colors"
        >
          <Icon name="Download" size={13} />
          Export CSV
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Collection % = Total Collections ÷ Net Production</p>

      {/* Legend / Series Toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SERIES?.map(s => (
          <button
            key={s?.key}
            onClick={() => toggleSeries(s?.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
              visibleSeries?.includes(s?.key)
                ? 'border-transparent text-white' : 'border-border text-muted-foreground bg-card opacity-50'
            }`}
            style={visibleSeries?.includes(s?.key) ? { backgroundColor: s?.color } : {}}
          >
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s?.color }} />
            {s?.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="h-40 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <Icon name="AlertTriangle" size={20} color="var(--color-warning)" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Dentrix Ascend data unavailable — not showing fallback data</p>
          </div>
        </div>
      ) : chartData?.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="BarChart2" size={20} />
            <p className="text-sm">No financial data available for this period.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="office"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${v >= 1000000 ? `${(v / 1000000)?.toFixed(1)}M` : v >= 1000 ? `${(v / 1000)?.toFixed(0)}K` : v}`}
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                {SERIES?.filter(s => visibleSeries?.includes(s?.key))?.map(s => (
                  <Bar key={s?.key} dataKey={s?.key} name={s?.label} fill={s?.color} radius={[2, 2, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Collection % summary row */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {chartData?.map(row => (
              <div key={row?.office} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{row?.office}</p>
                <p className="text-sm font-bold text-foreground">{fmtPct(row?.collection_pct)}</p>
                <p className="text-xs text-muted-foreground">Collection %</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialsPerLocationChart;
