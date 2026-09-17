import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { resolveLocationId, buildExecutiveDateRange } from '../../../services/executiveOverviewService';

// ── CRITICAL: Use the env-var API key, never a hardcoded fallback ─────────────
// RevenueSummarySection previously used a hardcoded '[environment-supplied API key]' string
// which bypassed the real VITE_ASCEND_API_KEY and ignored location filters entirely.
// All API calls now go through ascendApi which uses the correct key + locationId.

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const fmtNum = (v) => new Intl.NumberFormat('en-US')?.format(v || 0);

const COMPARISON_OPTIONS = [
  { value: 'previous_year', label: 'Previous Year' },
  { value: 'previous_month', label: 'Previous Month' },
];

const METRIC_DEFS = {
  gross_production: 'Total billed production before any adjustments or write-offs.',
  net_production: 'Gross production minus adjustments and write-offs (Dentrix ledger production).',
  total_adjustments: 'Net adjustments applied to production (write-offs, discounts, etc.).',
  total_collections: 'Total payments collected from patients and insurance.',
  new_patients: 'Number of new patients seen during the period.',
};

// Sparkline tooltip
const SparkTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded px-2 py-1 text-xs text-foreground shadow-sm">
      {payload?.[0]?.value != null ? fmt(payload?.[0]?.value) : '—'}
    </div>
  );
};

const SparkTooltipCount = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded px-2 py-1 text-xs text-foreground shadow-sm">
      {payload?.[0]?.value != null ? fmtNum(payload?.[0]?.value) : '—'}
    </div>
  );
};

// Individual KPI card
const RevenueKpiCard = ({ title, value, sparkData, sparkKey, change, changePct, comparison, isNegative, isCurrency, infoText, onExpand }) => {
  const [showInfo, setShowInfo] = useState(false);

  const isPositive = changePct > 0;
  const isNeg = changePct < 0;
  const arrowIcon = isPositive ? 'TrendingUp' : isNeg ? 'TrendingDown' : 'Minus';
  const changeColor = isNegative
    ? (isNeg ? 'text-green-600' : isPositive ? 'text-red-600' : 'text-muted-foreground')
    : (isPositive ? 'text-green-600' : isNeg ? 'text-red-600' : 'text-muted-foreground');

  const displayValue = value === null || value === undefined
    ? '—'
    : isCurrency
      ? (isNegative && value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value))
      : fmtNum(value);

  const displayChange = isCurrency
    ? (Math.abs(change) > 0 ? fmt(Math.abs(change)) : '$0')
    : fmtNum(Math.abs(change));

  const compLabel = comparison === 'previous_year' ? 'vs prev year' : 'vs prev month';

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 relative hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="Info" size={13} />
            </button>
            {showInfo && (
              <div className="absolute right-0 top-6 w-52 bg-popover border border-border rounded-lg p-2 text-xs text-foreground shadow-elevation-3 z-50">
                {infoText}
              </div>
            )}
          </div>
          <button
            onClick={onExpand}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="Maximize2" size={13} />
          </button>
        </div>
      </div>
      {/* Value */}
      <p className={`text-2xl font-bold leading-tight ${isNegative && value < 0 ? 'text-red-600' : 'text-foreground'}`}>
        {displayValue}
      </p>
      {/* Sparkline */}
      {sparkData?.length > 1 && (
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey={sparkKey}
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip content={isCurrency ? (props) => <SparkTooltip active={props?.active} payload={props?.payload} /> : (props) => <SparkTooltipCount active={props?.active} payload={props?.payload} />} label="" show={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Change indicator */}
      {changePct !== null && changePct !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${changeColor}`}>
          <Icon name={arrowIcon} size={13} />
          <span>
            {isPositive ? '+' : ''}{changePct?.toFixed(1)}% ({isPositive ? '+' : isNeg ? '-' : ''}{displayChange}) {compLabel}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n) => String(n)?.padStart(2, '0');

/**
 * Fetch production, collections, and patients for a date range + locationId.
 * Uses ascendApi (correct API key + locationId propagation).
 */
const fetchPeriodData = async (start, end, locationId = null) => {
  const [prodRes, collRes, patientsRes] = await Promise.allSettled([
    ascendApi?.getProduction(start, end, locationId),
    ascendApi?.getCollections(start, end, locationId),
    ascendApi?.getPatients(start, end, locationId),
  ]);

  const prod = prodRes?.status === 'fulfilled' ? prodRes?.value : null;
  const coll = collRes?.status === 'fulfilled' ? collRes?.value : null;
  const patients = patientsRes?.status === 'fulfilled' ? patientsRes?.value : null;

  const grossProd = parseFloat(prod?.grossProduction ?? prod?.gross_production) || 0;
  const adjustments = parseFloat(prod?.adjustments) || 0;
  // CRITICAL: Use only true net-production fields — do NOT fall back to grossProduction, UCR,
  // grossProd + adjustments, or production_total. Those are not net production.
  // If the API returns none of these true net fields, netProd is null (renders as N/A / sparkline gap).
  const rawNet = prod?.netProduction ?? null;
  const netProd = rawNet !== null && rawNet !== undefined ? parseFloat(rawNet) : null;
  const collections = parseFloat(coll?.totalCollections ?? coll?.total_collections ?? coll?.collections) || 0;
  const newPts = parseFloat(patients?.newPatients ?? patients?.new_patients) || 0;

  return { grossProd, netProd, adjustments, collections, newPts };
};

const buildPrevRange = (current, comparison) => {
  if (comparison === 'previous_year') {
    const shiftYear = (d) => {
      const [y, rest] = d?.split(/-(.+)/);
      return `${parseInt(y) - 1}-${rest}`;
    };
    return { start: shiftYear(current?.start), end: shiftYear(current?.end) };
  }
  if (comparison === 'previous_month') {
    const startDate = new Date(current?.start);
    const prevStart = new Date(startDate?.getFullYear(), startDate?.getMonth() - 1, 1);
    const prevEnd = new Date(startDate?.getFullYear(), startDate?.getMonth(), 0);
    return {
      start: `${prevStart?.getFullYear()}-${pad(prevStart?.getMonth() + 1)}-01`,
      end: `${prevEnd?.getFullYear()}-${pad(prevEnd?.getMonth() + 1)}-${pad(prevEnd?.getDate())}`,
    };
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RevenueSummarySection = ({ filters = {} }) => {
  const [comparison, setComparison] = useState('previous_year');
  const [compOpen, setCompOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { datePreset = 'last_month', selectedOfficeIds = [] } = filters;

  // Resolve locationId from selected offices — propagates to ALL API calls
  const locationId = resolveLocationId(selectedOfficeIds);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build date range from preset using the canonical builder
      const rangeInfo = buildExecutiveDateRange(datePreset);
      const range = { start: rangeInfo?.startDate, end: rangeInfo?.endDate };
      const prevRange = buildPrevRange(range, comparison);

      // Fetch current period — pass locationId for correct office scoping
      const current = await fetchPeriodData(range?.start, range?.end, locationId);

      // Fetch comparison period
      let prev = { grossProd: 0, netProd: 0, adjustments: 0, collections: 0, newPts: 0 };
      if (prevRange) {
        prev = await fetchPeriodData(prevRange?.start, prevRange?.end, locationId);
      }

      // Build sparkline: last 7 months, one call per month
      const sparkMonths = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now?.getFullYear(), now?.getMonth() - i, 1);
        const sy = d?.getFullYear();
        const sm = d?.getMonth() + 1;
        const lastDay = new Date(sy, sm, 0)?.getDate();
        sparkMonths?.push({
          label: `${sy}-${pad(sm)}`,
          start: `${sy}-${pad(sm)}-01`,
          end: `${sy}-${pad(sm)}-${pad(lastDay)}`,
        });
      }

      const sparkResults = await Promise.allSettled(
        sparkMonths?.map(({ start, end }) => fetchPeriodData(start, end, locationId))
      );

      const sparkData = sparkMonths?.map(({ label }, idx) => {
        const d = sparkResults?.[idx]?.status === 'fulfilled' ? sparkResults?.[idx]?.value : { grossProd: 0, netProd: 0, adjustments: 0, collections: 0, newPts: 0 };
        return {
          month: label,
          gross_production: d?.grossProd,
          net_production: d?.netProd,
          total_adjustments: d?.adjustments,
          total_collections: d?.collections,
          new_patients: d?.newPts,
        };
      });

      const pct = (curr, prev) => prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;

      setData({
        grossProd: current?.grossProd,
        netProd: current?.netProd,
        adjustments: current?.adjustments,
        collections: current?.collections,
        newPts: current?.newPts,
        prevGross: prev?.grossProd,
        prevNetProd: prev?.netProd,
        prevAdj: prev?.adjustments,
        prevCollections: prev?.collections,
        prevNewPts: prev?.newPts,
        pctGross: pct(current?.grossProd, prev?.grossProd),
        pctNet: pct(current?.netProd, prev?.netProd),
        pctAdj: pct(current?.adjustments, prev?.adjustments),
        pctCollections: pct(current?.collections, prev?.collections),
        pctNewPts: pct(current?.newPts, prev?.newPts),
        sparkData,
        isPartialMonth: rangeInfo?.isPartialMonth,
        periodLabel: rangeInfo?.label,
      });
    } catch (err) {
      console.warn('RevenueSummarySection fetch error:', err?.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [datePreset, comparison, locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const compLabel = COMPARISON_OPTIONS?.find(o => o?.value === comparison)?.label || 'Previous Year';

  const cards = data ? [
    {
      title: 'Gross Production',
      value: data?.grossProd,
      sparkKey: 'gross_production',
      change: data?.grossProd - data?.prevGross,
      changePct: data?.pctGross,
      isCurrency: true,
      isNegative: false,
      infoText: METRIC_DEFS?.gross_production,
    },
    {
      title: 'Net Production',
      value: data?.netProd,
      sparkKey: 'net_production',
      change: data?.netProd - data?.prevNetProd,
      changePct: data?.pctNet,
      isCurrency: true,
      isNegative: false,
      infoText: METRIC_DEFS?.net_production,
    },
    {
      title: 'Total Adjustments',
      value: data?.adjustments,
      sparkKey: 'total_adjustments',
      change: data?.adjustments - data?.prevAdj,
      changePct: data?.pctAdj,
      isCurrency: true,
      isNegative: true,
      infoText: METRIC_DEFS?.total_adjustments,
    },
    {
      title: 'Total Collections',
      value: data?.collections,
      sparkKey: 'total_collections',
      change: data?.collections - data?.prevCollections,
      changePct: data?.pctCollections,
      isCurrency: true,
      isNegative: false,
      infoText: METRIC_DEFS?.total_collections,
    },
    {
      title: 'Total New Patients',
      value: data?.newPts,
      sparkKey: 'new_patients',
      change: data?.newPts - data?.prevNewPts,
      changePct: data?.pctNewPts,
      isCurrency: false,
      isNegative: false,
      infoText: METRIC_DEFS?.new_patients,
    },
  ] : [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="DollarSign" size={16} color="var(--color-primary)" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Revenue</h2>
            {data?.periodLabel && (
              <p className="text-[10px] text-muted-foreground">{data?.periodLabel}{data?.isPartialMonth ? ' · partial period' : ''}</p>
            )}
          </div>
        </div>

        {/* Comparison Toggle */}
        <div className="relative">
          <button
            onClick={() => setCompOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-muted/40 text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="GitCompare" size={13} className="text-muted-foreground" />
            {compLabel}
            <Icon name="ChevronDown" size={12} className="text-muted-foreground" />
          </button>
          {compOpen && (
            <>
              <div className="fixed inset-0 z-[180]" onClick={() => setCompOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-lg shadow-elevation-3 z-[190] py-1">
                {COMPARISON_OPTIONS?.map(o => (
                  <button
                    key={o?.value}
                    onClick={() => { setComparison(o?.value); setCompOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors ${
                      comparison === o?.value ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'
                    }`}
                  >
                    {comparison === o?.value && <Icon name="Check" size={11} className="text-primary" />}
                    {comparison !== o?.value && <span className="w-[11px]" />}
                    {o?.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 })?.map((_, i) => (
            <div key={i} className="bg-muted/40 border border-border rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-muted rounded w-3/4 mb-3" />
              <div className="h-7 bg-muted rounded w-1/2 mb-2" />
              <div className="h-10 bg-muted/60 rounded mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border border-border rounded-lg">
          <Icon name="Info" size={14} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No revenue data available for this period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards?.map((card) => (
            <RevenueKpiCard
              key={card?.title}
              {...card}
              sparkData={data?.sparkData}
              comparison={comparison}
              onExpand={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RevenueSummarySection;
