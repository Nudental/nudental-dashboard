import { dashboardFetch as fetch } from '../../../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../../../config/dashboardEnvironment';
/**
 * VerifiedArTrendChart.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * V348 — Verified A/R Trend Chart
 *
 * Source: GET /v2/ar/trend (ar_snapshots table populated from HS1 Dentrix Ascend
 * Aging Balances Report via /v1/agingbalances/report, page-summed through
 * Nu Dashboard middleware).
 *
 * Behavior:
 *  - 0 points: show backend message or default "not accumulated yet" message
 *  - 1 point:  show single snapshot summary card + accumulation note
 *  - 2+ points: render line chart (Total A/R + 90+ as primary series)
 *
 * NOT used here:
 *  - /v2/rcm/ar-aging
 *  - /v2/rcm/claims
 *  - /v2/rcm/patient-statements
 *  - claim-derived legacy data
 *  - hardcoded sample points
 *  - /v2/ar/patients (no PHI)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,  } from 'recharts';
import Icon from '../../../components/AppIcon';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = DASHBOARD_API_ORIGIN + "/v2";
const API_KEY  = import.meta.env?.VITE_ASCEND_API_KEY || '';

/** Known Dentrix locationId → office name */
const DENTRIX_LOCATION_ID_TO_NAME = {
  '14000000000432': 'Staten Island',
  '14000000000433': 'Eatontown',
  '14000000000434': 'Barnegat',
  '14000000000435': 'Brick',
};

/** Supabase office UUID → Dentrix locationId */
const OFFICE_UUID_TO_DENTRIX_ID = {
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': '14000000000432',
  '220372a5-afae-49c9-8a0c-f4c0717ff352': '14000000000433',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': '14000000000434',
  '54626997-57c2-4934-8743-1dabb4d176f4': '14000000000435',
};

/** All optional series that can be toggled */
const OPTIONAL_SERIES = [
  { key: 'net_balance',        label: 'Net Balance',        color: '#6366f1' },
  { key: 'insurance_portion',  label: 'Insurance Portion',  color: '#0ea5e9' },
  { key: 'guarantor_portion',  label: 'Guarantor Portion',  color: '#f59e0b' },
  { key: 'current_0_30',       label: '0–30',               color: '#22c55e' },
  { key: 'aged_31_60',         label: '31–60',              color: '#84cc16' },
  { key: 'aged_61_90',         label: '61–90',              color: '#fb923c' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmt = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })?.format(v);
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d + (d?.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(dt?.getTime())) return '—';
  return dt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtAxisDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + (d?.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(dt?.getTime())) return d;
  return dt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Resolve Supabase office UUID → Dentrix locationId (or null for All Offices) */
const resolveDentrixLocationId = (officeId) => {
  if (!officeId) return null;
  return OFFICE_UUID_TO_DENTRIX_ID?.[officeId] || null;
};

// ─── API fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch /v2/ar/trend
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @param {string|null} locationId  Dentrix locationId (omit for All Offices)
 */
const fetchArTrend = async (startDate, endDate, locationId) => {
  let url = `${API_BASE}/ar/trend?startDate=${startDate}&endDate=${endDate}`;
  if (locationId) url += `&locationId=${locationId}`;

  const res = await fetch(url, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!res?.ok) {
    throw new Error(`/v2/ar/trend responded with ${res.status}`);
  }

  return res?.json();
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2.5 text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-1.5">{fmtAxisDate(label)}</p>
      {payload?.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry?.color }} />
            {entry?.name}
          </span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {entry?.value !== null && entry?.value !== undefined ? fmtAmt(entry?.value) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Single Snapshot Card ─────────────────────────────────────────────────────

const SingleSnapshotCard = ({ point }) => {
  const fields = [
    { label: 'Total A/R',          value: point?.total_ar,           color: 'text-slate-700' },
    { label: 'Net Balance',        value: point?.net_balance,        color: 'text-blue-700'  },
    { label: 'Insurance Portion',  value: point?.insurance_portion,  color: 'text-indigo-700'},
    { label: 'Guarantor Portion',  value: point?.guarantor_portion,  color: 'text-sky-700'   },
    { label: 'Est. Write-Off',     value: point?.estimated_writeoff, color: 'text-rose-700'  },
    { label: 'Unapplied Credits',  value: point?.unapplied_credits,  color: 'text-purple-700'},
    { label: '0–30 Days',          value: point?.current_0_30,       color: 'text-green-700' },
    { label: '31–60 Days',         value: point?.aged_31_60,         color: 'text-amber-700' },
    { label: '61–90 Days',         value: point?.aged_61_90,         color: 'text-orange-700'},
    { label: '90+ Days',           value: point?.aged_over_90,       color: 'text-red-700'   },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Icon name="Info" size={15} className="flex-shrink-0 text-blue-600" />
        <span>
          Verified A/R snapshot as of <strong>{fmtDate(point?.snapshot_date)}</strong>.
          More daily points will appear as snapshots accumulate.
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {fields?.map((f, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">{f?.label}</p>
            <p className={`text-sm font-bold mt-1 tabular-nums ${f?.color}`}>
              {f?.value !== null && f?.value !== undefined ? fmtAmt(f?.value) : '—'}
            </p>
          </div>
        ))}
        {point?.patient_count !== null && point?.patient_count !== undefined && (
          <div className="bg-card rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">Patient Count</p>
            <p className="text-sm font-bold mt-1 text-teal-700 tabular-nums">
              {point?.patient_count?.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * VerifiedArTrendChart
 *
 * Props:
 *  dateRange   { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 *  officeId    Supabase office UUID ('' = All Offices)
 *  refreshKey  number — increment to force re-fetch
 */
const VerifiedArTrendChart = ({ dateRange, officeId, refreshKey }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Optional series toggle state
  const [enabledSeries, setEnabledSeries] = useState({});

  const locationId = useMemo(() => resolveDentrixLocationId(officeId), [officeId]);

  const load = useCallback(async () => {
    if (!dateRange?.start || !dateRange?.end) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArTrend(dateRange?.start, dateRange?.end, locationId);
      setData(result);
    } catch (e) {
      setError(e?.message || 'Verified A/R trend unavailable');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, locationId, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const points = useMemo(() => data?.points || [], [data]);

  const toggleSeries = (key) => {
    setEnabledSeries(prev => ({ ...prev, [key]: !prev?.[key] }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Verified A/R Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.locationName
              ? `${data?.locationName} · `
              : officeId && DENTRIX_LOCATION_ID_TO_NAME?.[locationId]
                ? `${DENTRIX_LOCATION_ID_TO_NAME?.[locationId]} · `
                : 'All Offices · '}
            {dateRange?.start} — {dateRange?.end}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Icon name="RefreshCw" size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Source label */}
      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
        <Icon name="ShieldCheck" size={13} className="flex-shrink-0 mt-0.5 text-blue-600" />
        <span>
          <strong>Source:</strong> Verified A/R snapshot history from Dentrix Ascend Aging Balances Report
          via HS1 /v1/agingbalances/report, page-summed through Nu Dashboard middleware.
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-52 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            <p className="text-xs">Loading verified A/R trend…</p>
          </div>
        </div>
      )}

      {/* Error — do NOT fall back to legacy data */}
      {!loading && error && (
        <div className="h-52 flex flex-col items-center justify-center gap-3 text-center">
          <Icon name="AlertTriangle" size={28} className="text-amber-500" />
          <p className="text-sm font-medium text-amber-700">Verified A/R trend unavailable</p>
          <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:bg-muted"
          >
            Retry
          </button>
        </div>
      )}

      {/* 0 points */}
      {!loading && !error && points?.length === 0 && (
        <div className="h-52 flex flex-col items-center justify-center gap-3 text-center">
          <Icon name="Clock" size={28} className="text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {data?.message || 'Verified A/R snapshot history has not accumulated yet.'}
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Snapshots are created daily from the Dentrix Ascend Aging Balances Report.
            The first snapshot was recorded on 2026-05-04. Additional points will appear
            as daily snapshots accumulate.
          </p>
        </div>
      )}

      {/* 1 point */}
      {!loading && !error && points?.length === 1 && (
        <SingleSnapshotCard point={points?.[0]} />
      )}

      {/* 2+ points — real trend chart */}
      {!loading && !error && points?.length >= 2 && (
        <div className="space-y-3">
          {/* Optional series toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Toggle series:</span>
            {OPTIONAL_SERIES?.map(s => (
              <button
                key={s?.key}
                onClick={() => toggleSeries(s?.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  enabledSeries?.[s?.key]
                    ? 'border-transparent text-white' :'bg-card border-border text-muted-foreground hover:border-primary/40'
                }`}
                style={enabledSeries?.[s?.key] ? { backgroundColor: s?.color, borderColor: s?.color } : {}}
              >
                {s?.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="snapshot_date"
                tickFormatter={fmtAxisDate}
                tick={{ fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => `$${(v / 1000)?.toFixed(0)}k`}
                width={60}
              />
              <RechartsTooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {/* Primary series — always shown */}
              <Line
                type="monotone"
                dataKey="total_ar"
                name="Total A/R"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#6366f1' }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="aged_over_90"
                name="90+ Days"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ef4444' }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />

              {/* Optional series — shown when toggled */}
              {OPTIONAL_SERIES?.map(s =>
                enabledSeries?.[s?.key] ? (
                  <Line
                    key={s?.key}
                    type="monotone"
                    dataKey={s?.key}
                    name={s?.label}
                    stroke={s?.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2.5, fill: s?.color }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* Point count note */}
          <p className="text-xs text-muted-foreground text-right">
            {points?.length} snapshot{points?.length !== 1 ? 's' : ''} in range
            {data?.granularity ? ` · ${data?.granularity}` : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default VerifiedArTrendChart;
