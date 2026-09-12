import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ascendApi } from '../../../services/ascendApi';
import Icon from '../../../components/AppIcon';
import { LOCATION_ID_MAP, OFFICE_MAP } from '../../../constants/offices';
import { format, startOfMonth, subMonths, endOfMonth, startOfQuarter, subQuarters } from 'date-fns';

const fmtCurrency = (v) =>
  v != null && !isNaN(v)
    ? `$${Number(v)?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

const fmtPct = (v) =>
  v != null && !isNaN(v) && isFinite(v) ? `${Number(v)?.toFixed(1)}%` : '—';

const PROD_COLOR = '#3b82f6';
const COLL_COLOR = '#10b981';
const ADJ_COLOR  = '#f59e0b';

/**
 * Translate Reports dateFilter preset → { start, end } ISO date strings.
 * Handles all presets used by ReportsDateFilter.
 */
function getDateRange(df) {
  const now = new Date();
  const year = now?.getFullYear();

  if (df === 'this_month') {
    return {
      start: format(startOfMonth(now), 'yyyy-MM-dd'),
      end: format(now, 'yyyy-MM-dd'),
    };
  }
  if (df === 'last_month') {
    const lm = subMonths(now, 1);
    return {
      start: format(startOfMonth(lm), 'yyyy-MM-dd'),
      end: format(endOfMonth(lm), 'yyyy-MM-dd'),
    };
  }
  if (df === 'this_quarter') {
    return {
      start: format(startOfQuarter(now), 'yyyy-MM-dd'),
      end: format(now, 'yyyy-MM-dd'),
    };
  }
  if (df === 'last_quarter') {
    const lq = subQuarters(now, 1);
    return {
      start: format(startOfQuarter(lq), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd'),
    };
  }
  // q1_YYYY … q4_YYYY
  const qMatch = df?.match(/^q([1-4])_(\d{4})$/);
  if (qMatch) {
    const q = Number(qMatch?.[1]);
    const yr = Number(qMatch?.[2]);
    const startMonth = (q - 1) * 3;
    return {
      start: format(new Date(yr, startMonth, 1), 'yyyy-MM-dd'),
      end: format(new Date(yr, startMonth + 3, 0), 'yyyy-MM-dd'),
    };
  }
  // ytd_YYYY
  const ytdMatch = df?.match(/^ytd_(\d{4})$/);
  if (ytdMatch) {
    const yr = Number(ytdMatch?.[1]);
    const end = yr === year ? format(now, 'yyyy-MM-dd') : `${yr}-12-31`;
    return { start: `${yr}-01-01`, end };
  }
  // fy_YYYY
  const fyMatch = df?.match(/^fy_(\d{4})$/);
  if (fyMatch) {
    const yr = Number(fyMatch?.[1]);
    return { start: `${yr}-01-01`, end: `${yr}-12-31` };
  }
  // ytd (generic) or default
  return { start: `${year}-01-01`, end: format(now, 'yyyy-MM-dd') };
}

const readReportProviderScope = async (api, start, end, selected, locationId, locations, offices) => {
  const ids = [...new Set((selected || []).filter(id => id && id !== 'all'))];
  if (!ids.length || selected?.includes('all')) return api.getProviderPerformance(start, end, locationId || null);
  if (ids.some(id => !locations[id])) throw new Error('Provider data is unavailable for a selected office.');
  if (ids.length === 1) return api.getProviderPerformance(start, end, locations[ids[0]]);
  const results = await Promise.all(ids.map(id => api.getProviderPerformance(start, end, locations[id])));
  const fields = {
    grossProduction: ['gross_production'], netProduction: ['net_production'],
    adjustments: ['production_adjustments'], patientCollections: ['patient_collections'],
    insuranceCollections: ['insurance_collections'], collections: ['total_collections'],
  };
  const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const merged = new Map();
  results.forEach((result, index) => {
    const rows = Array.isArray(result) ? result : result?.providers ?? result?.data;
    if (!Array.isArray(rows)) throw new Error('Provider data is unavailable for a selected office.');
    rows.forEach(row => {
      const id = row?.providerId ?? row?.provider_id ?? row?.id;
      if (!id) throw new Error('A provider identifier is missing from selected office data.');
      const values = Object.fromEntries(Object.entries(fields).map(([field, aliases]) => [field, number(row[field] ?? row[aliases[0]])]));
      const existing = merged.get(id);
      if (existing) {
        for (const field of Object.keys(fields)) existing[field] = existing[field] == null || values[field] == null ? null : existing[field] + values[field];
      } else merged.set(id, { ...row, ...values, scopeNames: new Set() });
      const combined = merged.get(id);
      if (values.netProduction || values.collections) combined.scopeNames.add(offices[ids[index]]?.name || 'Selected office');
    });
  });
  return { providers: [...merged.values()].map(({ scopeNames, ...row }) => ({ ...row,
    officeName: [...scopeNames].join(', '),
    collectionRate: row.netProduction > 0 && row.collections != null ? row.collections / row.netProduction * 100 : null,
  })) };
};

const RevenueByProviderChart = ({ dateFilter = 'ytd_2026', officeFilter = ['all'], locationId = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [drillProvider, setDrillProvider] = useState(null);
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'

  const fetchProviderPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProviders([]);
    setDrillProvider(null);
    try {
      const { start, end } = getDateRange(dateFilter);

      const data = await readReportProviderScope(ascendApi, start, end, officeFilter, locationId, LOCATION_ID_MAP, OFFICE_MAP);

      // Normalize response — endpoint may return array or { data: [...], providers: [...] }
      let rawProviders = [];
      if (Array.isArray(data)) {
        rawProviders = data;
      } else if (Array.isArray(data?.providers)) {
        rawProviders = data?.providers;
      } else if (Array.isArray(data?.data)) {
        rawProviders = data?.data;
      }

      // Map fields from /v2/reports/provider-performance response
      const mapped = rawProviders?.map((p) => ({
          providerName:         p?.providerName       ?? p?.provider_name       ?? p?.name ?? 'Unknown',
          grossProduction:      parseFloat(p?.grossProduction      ?? p?.gross_production      ?? 0) || 0,
          netProduction:        parseFloat(p?.netProduction        ?? p?.net_production        ?? 0) || 0,
          adjustments:          parseFloat(p?.adjustments          ?? p?.production_adjustments ?? 0) || 0,
          patientCollections:   parseFloat(p?.patientCollections   ?? p?.patient_collections   ?? 0) || 0,
          insuranceCollections: parseFloat(p?.insuranceCollections ?? p?.insurance_collections ?? 0) || 0,
          collections:          parseFloat(p?.collections          ?? p?.total_collections     ?? 0) || 0,
          collectionRate:       parseFloat(p?.collectionRate       ?? p?.collection_rate       ?? null),
          officeName:           p?.officeName         ?? p?.office_name         ?? null,
          providerType:         p?.providerType       ?? p?.provider_type       ?? null,
          specialtyGroup:       p?.specialtyGroup     ?? p?.specialty_group     ?? null,
        }))?.filter((p) => p?.netProduction > 0 || p?.collections > 0)?.sort((a, b) => b?.netProduction - a?.netProduction);

      setProviders(mapped);
    } catch (err) {
      console.warn('[RevenueByProviderChart] provider-performance fetch error:', err?.message);
      setError(err?.message || 'Failed to load provider performance data');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, locationId, officeFilter?.join(',')]);

  useEffect(() => {
    fetchProviderPerformance();
  }, [fetchProviderPerformance]);

  const chartData = providers?.slice(0, 15)?.map((p) => ({
    name: p?.providerName?.length > 18 ? p?.providerName?.slice(0, 18) + '…' : p?.providerName,
    fullName: p?.providerName,
    netProduction: p?.netProduction,
    collections: p?.collections,
    adjustments: Math.abs(p?.adjustments),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload?.[0]?.payload;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-elevation-2 text-xs space-y-1 min-w-[180px]">
        <p className="font-semibold text-foreground text-sm">{d?.fullName || label}</p>
        <p className="text-blue-600">Net Production: {fmtCurrency(d?.netProduction)}</p>
        <p className="text-emerald-600">Collections: {fmtCurrency(d?.collections)}</p>
        {d?.adjustments > 0 && <p className="text-amber-600">Adjustments: {fmtCurrency(d?.adjustments)}</p>}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="BarChart2" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Provider Production &amp; Collections</h3>
            <p className="text-xs text-muted-foreground">Source: Dentrix/FastAPI <code className="text-[10px] bg-muted px-1 rounded">/v2/reports/provider-performance</code></p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'chart' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Table
          </button>
        </div>
      </div>
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Icon name="Loader2" size={20} className="animate-spin" />
            <span className="text-sm">Loading provider performance…</span>
          </div>
        </div>
      )}
      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center gap-2">
            <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
          <button onClick={fetchProviderPerformance} className="text-xs text-primary hover:underline">
            Retry
          </button>
        </div>
      )}
      {/* Empty state */}
      {!loading && !error && providers?.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon name="BarChart2" size={32} />
          <p className="text-sm mt-2">No provider performance data for this period</p>
        </div>
      )}
      {/* Chart view */}
      {!loading && !error && providers?.length > 0 && viewMode === 'chart' && (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => value === 'netProduction' ? 'Net Production' : 'Collections'}
              />
              <Bar dataKey="netProduction" name="netProduction" fill={PROD_COLOR} radius={[3, 3, 0, 0]} />
              <Bar dataKey="collections"   name="collections"   fill={COLL_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-muted-foreground mt-1">
            Showing top {Math.min(providers?.length, 15)} providers by net production. Click "Table" for full detail.
          </p>
        </>
      )}
      {/* Table view */}
      {!loading && !error && providers?.length > 0 && viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Provider</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Office</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Gross Prod.</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Adjustments</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Net Prod.</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Collections</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Coll. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {providers?.map((p, i) => {
                // Compute collection rate: collections ÷ net production
                const computedRate = (p?.netProduction > 0 && p?.collections != null)
                  ? (p?.collections / p?.netProduction) * 100
                  : null;
                // Prefer backend collectionRate if available and valid
                const displayRate = (p?.collectionRate != null && !isNaN(p?.collectionRate))
                  ? p?.collectionRate
                  : computedRate;
                return (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{p?.providerName}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{p?.providerType || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p?.officeName || '—'}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtCurrency(p?.grossProduction)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{p?.adjustments !== 0 ? fmtCurrency(Math.abs(p?.adjustments)) : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{fmtCurrency(p?.netProduction)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{fmtCurrency(p?.collections)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtPct(displayRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RevenueByProviderChart;
