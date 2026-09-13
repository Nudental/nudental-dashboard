import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { fetchFinancialReportForOffices } from '../../../services/dentrixNormalizedService';
import { LOCATION_ID_MAP } from '../../../constants/offices';

/* ─── Formatters ──────────────────────────────────────────────────────────── */
const fmtCurrency = (val) => {
  if (typeof val !== 'number' || !isFinite(val)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })?.format(val);
};

const fmtPercent = (val) => {
  if (typeof val !== 'number' || !isFinite(val)) return null;
  return `${(val * 100)?.toFixed(1)}%`;
};

/** Format negative adjustments as ($162,443) in red-friendly string */
const fmtAdjustment = (val) => {
  if (typeof val !== 'number' || !isFinite(val)) return null;
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })?.format(abs);
  return val < 0 ? `(${formatted})` : formatted;
};

/** Count calendar days inclusive */
const calendarDays = (start, end) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
};

/** Count weekdays (Mon–Fri) inclusive */
const weekdayCount = (start, end) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur?.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur?.setDate(cur?.getDate() + 1);
  }
  return Math.max(1, count);
};

/** Format a date string yyyy-MM-dd → MM/DD/YYYY for display */
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d?.split('-');
  return `${m}/${day}/${y}`;
};

const UNAVAILABLE_MSG = 'Not available from verified daily Dentrix data yet.';
const UNAVAILABLE_TREND = 'Not available from verified trend data yet.';

/* ─── MetricCard ──────────────────────────────────────────────────────────── */
const MetricCard = ({
  icon,
  label,
  value,
  sub,
  color = 'primary',
  negative = false,
  unavailable = false,
  unavailableMsg = UNAVAILABLE_MSG,
}) => (
  <div
    className={`flex items-start gap-3 p-3 rounded-lg border ${
      unavailable
        ? 'bg-muted/10 border-border/30 opacity-75' :'bg-muted/30 border-border/50'
    }`}
  >
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ backgroundColor: `var(--color-${color})20` }}
    >
      <Icon name={icon} size={15} color={`var(--color-${color})`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground leading-tight mb-0.5">{label}</p>
      {unavailable ? (
        <p className="text-xs text-amber-600 italic leading-snug">{unavailableMsg}</p>
      ) : (
        <>
          <p
            className={`text-sm font-semibold leading-snug ${
              negative ? 'text-red-600' : 'text-foreground'
            }`}
          >
            {value ?? '—'}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
          )}
        </>
      )}
    </div>
  </div>
);

/* ─── Divider label ───────────────────────────────────────────────────────── */
const SectionLabel = ({ children }) => (
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1 pb-0.5 border-t border-border/30 mt-1">
    {children}
  </p>
);

/* ─── InsightCard ─────────────────────────────────────────────────────────── */
const InsightCard = ({
  icon,
  title,
  value,
  label,
  interpretation,
  color = 'primary',
  unavailable = false,
  unavailableMsg,
  children,
}) => (
  <div
    className={`flex items-start gap-3 p-3 rounded-lg border ${
      unavailable
        ? 'bg-muted/10 border-border/30 opacity-75' :'bg-muted/30 border-border/50'
    }`}
  >
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ backgroundColor: `var(--color-${color})20` }}
    >
      <Icon name={icon} size={15} color={`var(--color-${color})`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground leading-tight mb-0.5">{title}</p>
      {unavailable ? (
        <p className="text-xs text-amber-600 italic leading-snug">{unavailableMsg}</p>
      ) : (
        <>
          {value && (
            <p className="text-sm font-semibold text-foreground leading-snug">{value}</p>
          )}
          {children}
          {label && (
            <p
              className="text-xs font-medium mt-0.5 leading-snug"
              style={{ color: `var(--color-${color})` }}
            >
              {label}
            </p>
          )}
          {interpretation && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{interpretation}</p>
          )}
        </>
      )}
    </div>
  </div>
);

/* ─── Insight helpers ─────────────────────────────────────────────────────── */

/** A — Collections Above Net Production */
const getCollectionsAboveNetInsight = (totalCollections, netProduction, collectionRate) => {
  if (totalCollections === null || netProduction === null || collectionRate === null) return null;
  const pct = collectionRate * 100;
  const fmtPct = `${pct?.toFixed(1)}%`;
  if (pct > 100) {
    return {
      value: fmtPct,
      label: 'Collections Above Net Production',
      interpretation: 'Total Collections ÷ Net Production',
      color: 'success',
    };
  }
  if (pct >= 80) {
    return {
      value: fmtPct,
      label: 'Healthy Collection Pace',
      interpretation: 'Total Collections ÷ Net Production',
      color: 'primary',
    };
  }
  return {
    value: fmtPct,
    label: 'Below Target Collection Pace',
    interpretation: 'Total Collections ÷ Net Production',
    color: 'warning',
  };
};

/** B — High Adjustment Ratio */
const getAdjustmentPressureInsight = (adjustmentRatio) => {
  if (adjustmentRatio === null) return null;
  const pct = adjustmentRatio * 100;
  const fmtPct = `${pct?.toFixed(1)}%`;
  if (pct >= 60) {
    return {
      value: fmtPct,
      label: 'High Adjustment Ratio',
      interpretation: '|Production Adjustments| ÷ Gross Production',
      color: 'warning',
    };
  }
  if (pct >= 30) {
    return {
      value: fmtPct,
      label: 'Moderate Adjustment Ratio',
      interpretation: '|Production Adjustments| ÷ Gross Production',
      color: 'primary',
    };
  }
  return {
    value: fmtPct,
    label: 'Low Adjustment Ratio',
    interpretation: '|Production Adjustments| ÷ Gross Production',
    color: 'success',
  };
};

/** C — Patient vs Insurance Collection Mix */
const getCollectionMixInsight = (patientCollections, insuranceCollections) => {
  if (patientCollections === null || insuranceCollections === null) return null;
  const total = patientCollections + insuranceCollections;
  if (total === 0) return null;
  const patPct = ((patientCollections / total) * 100)?.toFixed(1);
  const insPct = ((insuranceCollections / total) * 100)?.toFixed(1);
  const dominant = patientCollections >= insuranceCollections ? 'Patient' : 'Insurance';
  return {
    patPct,
    insPct,
    label: `${dominant}-Led Collections`,
    interpretation: `${dominant} collections make up the larger share of total collections this period.`,
    color: 'success',
  };
};

/** D — Net Production After Adjustments */
const getNetProductionInsight = (netProduction) => {
  if (netProduction === null) return null;
  return {
    value: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })?.format(netProduction),
    label: 'Net Production After Adjustments',
    interpretation: 'Gross Production minus adjustments/write-offs',
    color: 'primary',
  };
};

/** E — Collections Over Net Production */
const getCollectionsOverNetInsight = (totalCollections, netProduction) => {
  if (totalCollections === null || netProduction === null) return null;
  const diff = totalCollections - netProduction;
  const fmtDiff = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })?.format(Math.abs(diff));
  if (diff > 0) {
    return {
      value: `+${fmtDiff}`,
      label: 'Collections Over Net Production',
      interpretation: 'Collections exceeded net production in this period',
      color: 'success',
    };
  }
  if (diff < 0) {
    return {
      value: `-${fmtDiff}`,
      label: 'Collections Under Net Production',
      interpretation: 'Collections fell short of net production in this period',
      color: 'warning',
    };
  }
  return {
    value: '$0',
    label: 'Collections Equal to Net Production',
    interpretation: 'Collections exactly matched net production',
    color: 'primary',
  };
};

/* ─── Main Component ──────────────────────────────────────────────────────── */

/**
 * StatisticalSummary — 10-card Financial Analytics Statistical Summary
 *
 * Uses only verified Dentrix FastAPI/SQLite data.
 * All deps are primitive strings to prevent useEffect re-fetch loops.
 *
 * Props:
 *   selectedOffices  — array of office IDs or ['all']
 *   dateRange        — { start: 'yyyy-MM-dd', end: 'yyyy-MM-dd' }
 *   fetchVersion     — integer bumped by parent on Apply Filters (triggers re-fetch)
 */
const StatisticalSummary = ({ selectedOffices = ['all'], dateRange, fetchVersion = 0, trendData = null }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stable primitive keys — prevents object reference churn
  const officeKey =
    selectedOffices?.includes('all') || !selectedOffices?.length
      ? 'all'
      : [...selectedOffices]?.sort()?.join(',');
  const startDate = dateRange?.start || '';
  const endDate = dateRange?.end || '';

  // requestId guard — discard stale responses
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Resolve locationId — single office only; null = all offices
    const locationId = (() => {
      if (officeKey === 'all') return null;
      const ids = officeKey?.split(',');
      if (ids?.length !== 1) return null;
      return LOCATION_ID_MAP?.[ids?.[0]] || null;
    })();

    // Resolve date range — default to current month if not provided
    let resolvedStart = startDate;
    let resolvedEnd = endDate;
    if (!resolvedStart || !resolvedEnd) {
      const now = new Date();
      const y = now?.getFullYear();
      const m = now?.getMonth();
      resolvedStart = `${y}-${String(m + 1)?.padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0)?.getDate();
      resolvedEnd = `${y}-${String(m + 1)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
    }

    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const fetchStats = async () => {
      try {
        const [prodRes, collRes] = await Promise.allSettled([
          fetchFinancialReportForOffices('getProduction', resolvedStart, resolvedEnd, officeKey.split(',')),
          fetchFinancialReportForOffices('getCollections', resolvedStart, resolvedEnd, officeKey.split(',')),
        ]);

        if (myRequestId !== requestIdRef?.current) return;

        const prod = prodRes?.status === 'fulfilled' ? prodRes?.value : null;
        const coll = collRes?.status === 'fulfilled' ? collRes?.value : null;

        // ── Card 1: Gross Production ──────────────────────────────────────
        const grossProduction =
          prod?.grossProduction ?? prod?.gross_production ?? null;

        // ── Card 2: Production Adjustments (negative) ─────────────────────
        const rawAdj =
          prod?.productionAdjustments ??
          prod?.production_adjustments ??
          prod?.adjustments ??
          prod?.totalAdjustments ??
          null;
        // Ensure stored as negative number
        const productionAdjustments =
          rawAdj !== null ? (rawAdj > 0 ? -rawAdj : rawAdj) : null;

        // ── Card 3: Net Production ────────────────────────────────────────
        const netProduction =
          prod?.netProduction ??
          prod?.net_production ??
          (grossProduction !== null && productionAdjustments !== null
            ? grossProduction + productionAdjustments
            : null);

        // ── Card 4: Patient Collections ───────────────────────────────────
        const patientCollections =
          coll?.patientCollections ??
          coll?.patient_collections ??
          coll?.patientPayments ??
          null;

        // ── Card 5: Insurance Collections ────────────────────────────────
        const insuranceCollections =
          coll?.insuranceCollections ??
          coll?.insurance_collections ??
          coll?.insurancePayments ??
          null;

        // ── Card 6: Total Collections ─────────────────────────────────────
        const totalCollections =
          coll?.totalCollections ??
          coll?.total_collections ??
          coll?.collections ??
          (patientCollections !== null && insuranceCollections !== null
            ? patientCollections + insuranceCollections
            : null);

        // ── Card 7: Collection Rate = Total Collections ÷ Net Production ──
        const collectionRate =
          netProduction && netProduction !== 0 && totalCollections !== null
            ? totalCollections / netProduction
            : null;

        // ── Card 8: Adjustment Ratio = |Adjustments| ÷ Gross Production ──
        const adjustmentRatio =
          grossProduction && grossProduction !== 0 && productionAdjustments !== null
            ? Math.abs(productionAdjustments) / grossProduction
            : null;

        // ── Day counts ────────────────────────────────────────────────────
        const calDays = calendarDays(resolvedStart, resolvedEnd);
        const wkDays = weekdayCount(resolvedStart, resolvedEnd);

        // ── Card 9: Avg Per Calendar Day (Net Production) ─────────────────
        const avgNetPerCalDay =
          netProduction !== null ? netProduction / calDays : null;

        // ── Card 10: Avg Collections Per Calendar Day ─────────────────────
        const avgCollPerCalDay =
          totalCollections !== null ? totalCollections / calDays : null;

        setStats({
          grossProduction,
          productionAdjustments,
          netProduction,
          patientCollections,
          insuranceCollections,
          totalCollections,
          collectionRate,
          adjustmentRatio,
          avgNetPerCalDay,
          avgCollPerCalDay,
          calDays,
          wkDays,
          resolvedStart,
          resolvedEnd,
        });
      } catch (err) {
        if (myRequestId !== requestIdRef?.current) return;
        console.error('[StatisticalSummary] fetch error:', err);
        setError(err?.message || 'Failed to load statistics');
      } finally {
        if (myRequestId === requestIdRef?.current) setLoading(false);
      }
    };

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeKey, startDate, endDate, fetchVersion]);

  // ── Resolve display office label ─────────────────────────────────────────
  const officeLabel =
    officeKey === 'all' ?'All Offices' : officeKey?.split(',')?.length > 1
      ? `${officeKey?.split(',')?.length} Offices`
      : officeKey?.split(',')?.[0];

  const displayStart = stats?.resolvedStart || startDate;
  const displayEnd = stats?.resolvedEnd || endDate;

  return (
    <div className="space-y-3">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="BarChart3" size={20} color="var(--color-primary)" />
          <h2 className="text-lg font-semibold text-foreground">Statistical Summary</h2>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-medium">
          FastAPI/SQLite
        </span>
      </div>
      {/* ── Source / Context Label ───────────────────────────────────────── */}
      <div className="bg-muted/20 border border-border/40 rounded-lg px-3 py-2 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Source:</span> Dentrix FastAPI/SQLite
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Office:</span> {officeLabel}
        </p>
        {(displayStart || displayEnd) && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Date Range:</span>{' '}
            {fmtDate(displayStart)} – {fmtDate(displayEnd)}
          </p>
        )}
        {stats && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Calendar Days:</span> {stats?.calDays} &nbsp;|&nbsp;
            <span className="font-medium text-foreground">Weekdays:</span> {stats?.wkDays}
          </p>
        )}
      </div>
      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs text-muted-foreground">Loading…</span>
        </div>
      )}
      {/* ── Error ────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          Could not load statistics: {error}
        </div>
      )}
      {/* ── No data ──────────────────────────────────────────────────────── */}
      {!loading && !error && !stats && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <Icon name="Database" size={20} color="var(--color-muted-foreground)" />
          <p className="text-xs text-muted-foreground">No data for selected filters.</p>
        </div>
      )}
      {/* ── Cards ────────────────────────────────────────────────────────── */}
      {!loading && !error && stats && (
        <div className="space-y-2">
          {/* Production section */}
          <SectionLabel>Production</SectionLabel>

          {/* Card 1 — Gross Production */}
          <MetricCard
            icon="Activity"
            label="Gross Production"
            value={fmtCurrency(stats?.grossProduction)}
            sub="From /v2/production/summary"
            color="primary"
            unavailable={stats?.grossProduction === null}
          />

          {/* Card 2 — Production Adjustments */}
          <MetricCard
            icon="TrendingDown"
            label="Production Adjustments"
            value={fmtAdjustment(stats?.productionAdjustments)}
            sub="From /v2/production/summary · negative = reductions"
            color="warning"
            negative={stats?.productionAdjustments !== null && stats?.productionAdjustments < 0}
            unavailable={stats?.productionAdjustments === null}
          />

          {/* Card 3 — Net Production */}
          <MetricCard
            icon="TrendingUp"
            label="Net Production"
            value={fmtCurrency(stats?.netProduction)}
            sub="Gross Production + Production Adjustments"
            color="primary"
            unavailable={stats?.netProduction === null}
          />

          {/* Collections section */}
          <SectionLabel>Collections</SectionLabel>

          {/* Card 4 — Patient Collections */}
          <MetricCard
            icon="User"
            label="Patient Collections"
            value={fmtCurrency(stats?.patientCollections)}
            sub="From /v2/collections/summary"
            color="success"
            unavailable={stats?.patientCollections === null}
          />

          {/* Card 5 — Insurance Collections */}
          <MetricCard
            icon="Shield"
            label="Insurance Collections"
            value={fmtCurrency(stats?.insuranceCollections)}
            sub="From /v2/collections/summary"
            color="success"
            unavailable={stats?.insuranceCollections === null}
          />

          {/* Card 6 — Total Collections */}
          <MetricCard
            icon="CreditCard"
            label="Total Collections"
            value={fmtCurrency(stats?.totalCollections)}
            sub="Patient Collections + Insurance Collections"
            color="success"
            unavailable={stats?.totalCollections === null}
          />

          {/* Ratios section */}
          <SectionLabel>Ratios</SectionLabel>

          {/* Card 7 — Collection Rate */}
          <MetricCard
            icon="Percent"
            label="Collection Rate"
            value={fmtPercent(stats?.collectionRate)}
            sub="Total Collections ÷ Net Production"
            color={stats?.collectionRate !== null && stats?.collectionRate > 1 ? 'success' : 'primary'}
            unavailable={stats?.collectionRate === null}
          />

          {/* Card 8 — Adjustment Ratio */}
          <MetricCard
            icon="Scissors"
            label="Adjustment Ratio"
            value={fmtPercent(stats?.adjustmentRatio)}
            sub="|Production Adjustments| ÷ Gross Production"
            color="warning"
            unavailable={stats?.adjustmentRatio === null}
          />

          {/* Averages section */}
          <SectionLabel>Averages ({stats?.calDays} Calendar Days · {stats?.wkDays} Weekdays)</SectionLabel>

          {/* Card 9 — Avg Per Calendar Day (Net Production) */}
          <MetricCard
            icon="Calendar"
            label="Average Per Calendar Day"
            value={fmtCurrency(stats?.avgNetPerCalDay)}
            sub={`Net Production ÷ ${stats?.calDays} calendar day${stats?.calDays !== 1 ? 's' : ''}`}
            color="primary"
            unavailable={stats?.avgNetPerCalDay === null}
          />

          {/* Card 10 — Avg Collections Per Calendar Day */}
          <MetricCard
            icon="CalendarCheck"
            label="Average Collections Per Calendar Day"
            value={fmtCurrency(stats?.avgCollPerCalDay)}
            sub={`Total Collections ÷ ${stats?.calDays} calendar day${stats?.calDays !== 1 ? 's' : ''}`}
            color="success"
            unavailable={stats?.avgCollPerCalDay === null}
          />

          {/* Verified Insights section */}
          <SectionLabel>Verified Insights</SectionLabel>

          {/* A — Collections Above Net Production */}
          {(() => {
            const insight = getCollectionsAboveNetInsight(stats?.totalCollections, stats?.netProduction, stats?.collectionRate);
            if (!insight) return null;
            return (
              <InsightCard
                icon="TrendingUp"
                title="Collections Above Net Production"
                value={insight?.value}
                label={insight?.label}
                interpretation={insight?.interpretation}
                color={insight?.color || 'success'}
                unavailableMsg={UNAVAILABLE_MSG}
              />
            );
          })()}

          {/* B — High Adjustment Ratio */}
          {(() => {
            const insight = getAdjustmentPressureInsight(stats?.adjustmentRatio);
            if (!insight) return null;
            return (
              <InsightCard
                icon="Scissors"
                title="Adjustment Ratio"
                value={insight?.value}
                label={insight?.label}
                interpretation={insight?.interpretation}
                color={insight?.color || 'warning'}
                unavailableMsg={UNAVAILABLE_MSG}
              />
            );
          })()}

          {/* C — Patient vs Insurance Collection Mix */}
          {(() => {
            const insight = getCollectionMixInsight(stats?.patientCollections, stats?.insuranceCollections);
            if (!insight) return null;
            return (
              <InsightCard
                icon="PieChart"
                title="Patient vs Insurance Collection Mix"
                value={null}
                label={insight?.label}
                interpretation={insight?.interpretation}
                color={insight?.color || 'success'}
                unavailableMsg={UNAVAILABLE_MSG}
              >
                <div className="flex gap-3 mt-1">
                  <span className="text-xs font-semibold text-foreground">Patient <span className="text-success">{insight?.patPct}%</span></span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold text-foreground">Insurance <span className="text-primary">{insight?.insPct}%</span></span>
                </div>
              </InsightCard>
            );
          })()}

          {/* D — Net Production After Adjustments */}
          {(() => {
            const insight = getNetProductionInsight(stats?.netProduction);
            if (!insight) return null;
            return (
              <InsightCard
                icon="Activity"
                title="Net Production After Adjustments"
                value={insight?.value}
                label={insight?.label}
                interpretation={insight?.interpretation}
                color={insight?.color || 'primary'}
                unavailableMsg={UNAVAILABLE_MSG}
              />
            );
          })()}

          {/* E — Collections Over Net Production */}
          {(() => {
            const insight = getCollectionsOverNetInsight(stats?.totalCollections, stats?.netProduction);
            if (!insight) return null;
            return (
              <InsightCard
                icon="ArrowUpRight"
                title="Collections Over Net Production"
                value={insight?.value}
                label={insight?.label}
                interpretation={insight?.interpretation}
                color={insight?.color || 'success'}
                unavailableMsg={UNAVAILABLE_MSG}
              />
            );
          })()}

          {/* Source note */}
          <p className="text-xs text-muted-foreground italic pt-1 leading-snug">
            Insights are calculated from verified Dentrix FastAPI/SQLite data.
          </p>

          {/* Muted footer note for future daily/trend insights */}
          <p className="text-xs text-muted-foreground/60 italic leading-snug">
            Daily best-production and trend-direction insights require verified daily/trend endpoints.
          </p>
        </div>
      )}
    </div>
  );
};

export default StatisticalSummary;