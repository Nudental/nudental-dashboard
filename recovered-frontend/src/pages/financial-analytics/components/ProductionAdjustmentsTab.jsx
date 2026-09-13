/**
 * ProductionAdjustmentsTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Financial Analytics subtab: Production & Adjustments
 * Shows gross production, adjustments breakdown, and net production
 * in eAssist-compatible format using the normalized Dentrix service.
 *
 * Filter bar shares state with the parent Financial Analytics page —
 * no separate independent filter state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';
import { fetchProductionMetrics, fetchNormalizedMetricsByOffice, safeNum } from '../../../services/dentrixNormalizedService';
import { buildDateRange } from '../../../services/metricsService';
import { OFFICE_MAP } from '../../../constants/offices';
import { parse, isValid, isAfter, format } from 'date-fns';
import FinancialDatePicker from './FinancialDatePicker';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(safeNum(v));
const fmtFull = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(safeNum(v));

const MetricRow = ({ label, value, valueClass = 'text-foreground', sub }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
  </div>
);

const KpiCard = ({ label, value, valueClass, icon, iconBg, sub }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon name={icon} size={16} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold mt-0.5 tabular-nums ${valueClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

// ── Office options derived from OFFICE_MAP ────────────────────────────────────
const OFFICE_OPTIONS = [
  { value: 'all', label: 'All Offices' },
  ...Object.entries(OFFICE_MAP)?.map(([id, meta]) => ({ value: id, label: meta?.name })),
];

const getOfficeLabel = (officeIds) => {
  if (!officeIds || officeIds?.length === 0 || officeIds?.includes('all')) return 'All Offices';
  if (officeIds?.length === 1) {
    return OFFICE_MAP?.[officeIds?.[0]]?.name || officeIds?.[0];
  }
  return officeIds?.map(id => OFFICE_MAP?.[id]?.name || id)?.join(', ');
};

const ProductionAdjustmentsTab = ({
  datePreset = 'this_month',
  officeIds = [],
  refreshKey = 0,
  startDate,
  endDate,
  // Shared filter state from parent — used for the filter bar
  selectedOffices,
  setSelectedOffices,
  stagedDateRange,
  setStagedDateRange,
  onApplyFilters,
  onResetFilters,
  appliedOffices,
  appliedDateRange,
  onApplyFiltersWithValues,
}) => {
  const [data, setData] = useState(null);
  const [officeData, setOfficeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('mtd'); // 'daily' | 'mtd'
  const [dateError, setDateError] = useState('');

  // ── Local staged state for the filter bar ────────────────────────────────
  // Initialize from appliedDateRange so the date picker opens to the applied month.
  // Fall back to stagedDateRange / startDate if applied is not yet set.
  const [localOffice, setLocalOffice] = useState(
    appliedOffices?.includes('all') ? 'all' : (appliedOffices?.[0] || selectedOffices?.includes('all') ? 'all' : (selectedOffices?.[0] || 'all'))
  );
  const [localStart, setLocalStart] = useState(
    appliedDateRange?.start || stagedDateRange?.start || startDate || ''
  );
  const [localEnd, setLocalEnd] = useState(
    appliedDateRange?.end || stagedDateRange?.end || endDate || ''
  );

  // ── Sync local state to appliedDateRange when it changes ─────────────────
  // This ensures the date picker always opens to the applied/committed month.
  useEffect(() => {
    if (appliedOffices) {
      setLocalOffice(appliedOffices?.includes('all') ? 'all' : (appliedOffices?.[0] || 'all'));
    }
  }, [appliedOffices?.join?.(',')]);

  useEffect(() => {
    if (appliedDateRange?.start) setLocalStart(appliedDateRange?.start);
    if (appliedDateRange?.end) setLocalEnd(appliedDateRange?.end);
    setDateError('');
  }, [appliedDateRange?.start, appliedDateRange?.end]);

  const fallbackDateRange = useMemo(() => buildDateRange(datePreset), [datePreset]);

  // Use explicit startDate/endDate from applied filters when provided; otherwise fall back to datePreset
  const resolvedStartDate = startDate || fallbackDateRange?.startDate;
  const resolvedEndDate = endDate || fallbackDateRange?.endDate;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setOfficeData([]);
      try {
        const today = new Date()?.toISOString()?.split('T')?.[0];
        const [metrics, byOffice] = await Promise.allSettled([
          fetchProductionMetrics({
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            officeIds,
            dailyDate: today,
          }),
          fetchNormalizedMetricsByOffice({ startDate: resolvedStartDate, endDate: resolvedEndDate, officeIds }),
        ]);
        if (!active) return;
        if (metrics?.status === 'rejected') throw metrics.reason;
        setData(metrics?.value);
        if (byOffice?.status === 'fulfilled') setOfficeData(byOffice?.value);
      } catch (err) {
        if (active) setError(err?.message || 'Financial metrics unavailable. Please retry.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [resolvedStartDate, resolvedEndDate, officeIds?.join(','), refreshKey]);

  const chartData = useMemo(() => {
    return officeData?.map(o => ({
      office: o?.officeName,
      grossProduction: safeNum(o?.metrics?.gross_production_mtd),
      adjustments: Math.abs(safeNum(o?.metrics?.production_adjustments_mtd)),
      netProduction: safeNum(o?.metrics?.net_production_mtd),
    }));
  }, [officeData]);

  // ── Date validation ───────────────────────────────────────────────────────
  const validateDates = (start, end) => {
    if (!start || !end) return '';
    const s = parse(start, 'yyyy-MM-dd', new Date());
    const e = parse(end, 'yyyy-MM-dd', new Date());
    if (isValid(s) && isValid(e) && isAfter(s, e)) {
      return 'End Date cannot be before Start Date.';
    }
    return '';
  };

  const handleStartChange = (val) => {
    setLocalStart(val);
    setDateError(validateDates(val, localEnd));
  };

  const handleEndChange = (val) => {
    setLocalEnd(val);
    setDateError(validateDates(localStart, val));
  };

  // ── Filter bar handlers ───────────────────────────────────────────────────
  const handleLocalApply = () => {
    if (dateError) return;
    const newOffices = localOffice === 'all' ? ['all'] : [localOffice];
    const newStart = localStart;
    const newEnd = localEnd;

    if (onApplyFiltersWithValues) {
      onApplyFiltersWithValues({ offices: newOffices, start: newStart, end: newEnd });
    } else {
      if (setSelectedOffices) setSelectedOffices(newOffices);
      if (setStagedDateRange) setStagedDateRange({ start: newStart, end: newEnd });
      if (onApplyFilters) onApplyFilters();
    }
  };

  const handleLocalReset = () => {
    const defaultStart = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
    const defaultEnd = format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd');
    setLocalOffice('all');
    setLocalStart(defaultStart);
    setLocalEnd(defaultEnd);
    setDateError('');
    if (onResetFilters) {
      onResetFilters();
    }
  };

  // ── Active filter label values ────────────────────────────────────────────
  const activeOfficeLabel = getOfficeLabel(appliedOffices || officeIds);
  const activeStartLabel = appliedDateRange?.start || resolvedStartDate || '—';
  const activeEndLabel = appliedDateRange?.end || resolvedEndDate || '—';

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3]?.map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-3" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <Icon name="AlertTriangle" size={14} className="inline mr-2" />
        Failed to load production metrics: {error}
      </div>
    );
  }

  const grossMtd = safeNum(data?.gross_production_mtd);
  const adjMtd = safeNum(data?.production_adjustments_mtd);
  const netMtd = safeNum(data?.net_production_mtd);
  const grossDaily = safeNum(data?.gross_production_daily);
  const adjDaily = safeNum(data?.production_adjustments_daily);
  const netDaily = safeNum(data?.net_production_daily);
  const writeOffs = safeNum(data?.write_offs_mtd);
  const chargeAdj = safeNum(data?.charge_adjustments_mtd);

  return (
    <div className="space-y-6">
      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Office selector */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Office</label>
            <select
              value={localOffice}
              onChange={e => setLocalOffice(e?.target?.value)}
              className="h-9 rounded-lg border border-border bg-background text-sm text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {OFFICE_OPTIONS?.map(opt => (
                <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
              ))}
            </select>
          </div>

          {/* Start Date — FinancialDatePicker opens directly to applied month */}
          <FinancialDatePicker
            label="Start Date"
            value={localStart}
            onChange={handleStartChange}
            max={localEnd || ''}
            error={!!dateError}
            className="min-w-[140px]"
          />

          {/* End Date — FinancialDatePicker opens directly to applied month */}
          <FinancialDatePicker
            label="End Date"
            value={localEnd}
            onChange={handleEndChange}
            min={localStart || ''}
            max=""
            error={!!dateError}
            className="min-w-[140px]"
          />

          {/* Action buttons */}
          <div className="flex items-end gap-2 pb-0">
            <button
              onClick={handleLocalApply}
              disabled={!!dateError}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="Filter" size={13} />
              Apply Filters
            </button>
            <button
              onClick={handleLocalReset}
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center gap-1.5"
            >
              <Icon name="RotateCcw" size={13} />
              Reset
            </button>
          </div>
        </div>

        {/* Inline date validation warning */}
        {dateError && (
          <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            <Icon name="AlertCircle" size={12} />
            {dateError}
          </div>
        )}
      </div>

      {/* ── Active Filter Label ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <Icon name="Info" size={13} className="text-blue-500 flex-shrink-0" />
        <span>
          <span className="font-semibold">Office:</span> {activeOfficeLabel}
          <span className="mx-2 text-blue-400">|</span>
          <span className="font-semibold">Date Range:</span> {activeStartLabel} – {activeEndLabel}
          <span className="mx-2 text-blue-400">|</span>
          <span className="font-semibold">Source:</span> Dentrix FastAPI/SQLite
        </span>
      </div>
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {[{ id: 'mtd', label: "Selected Range" }, { id: 'daily', label: "Today (UTC)" }]?.map(v => (
            <button
              key={v?.id}
              onClick={() => setViewMode(v?.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === v?.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v?.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{viewMode === 'daily' ? 'Current day (UTC)' : `${resolvedStartDate} – ${resolvedEndDate}`}</span>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label={viewMode === 'daily' ? "Today's Production" : "Selected Range Production"}
          value={fmt(viewMode === 'daily' ? grossDaily : grossMtd)}
          valueClass="text-foreground"
          icon="TrendingUp"
          iconBg="bg-blue-500"
          sub="Gross (before adjustments)"
        />
        <KpiCard
          label={viewMode === 'daily' ? "Today's Adjustments" : "Selected Range Adjustments"}
          value={fmtFull(viewMode === 'daily' ? adjDaily : adjMtd)}
          valueClass={adjMtd < 0 ? 'text-red-600' : 'text-foreground'}
          icon="Minus"
          iconBg="bg-red-500"
          sub="Write-offs, contractual adj"
        />
        <KpiCard
          label={viewMode === 'daily' ? "Today's Net Production" : "Net Selected Range Production"}
          value={fmt(viewMode === 'daily' ? netDaily : netMtd)}
          valueClass="text-emerald-600"
          icon="CheckCircle"
          iconBg="bg-emerald-500"
          sub="After all adjustments"
        />
      </div>
      {/* Detailed breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="BarChart2" size={14} className="text-primary" />
            Production Summary — {viewMode === 'daily' ? "Today (UTC)" : "Selected Range"}
          </h3>
          <div>
            <MetricRow
              label={viewMode === 'daily' ? "Today's Production" : "Selected Range Production"}
              value={fmtFull(viewMode === 'daily' ? grossDaily : grossMtd)}
              sub="Gross production (UCR fees)"
            />
            <MetricRow
              label={viewMode === 'daily' ? "Today's Production Adjustment" : "Selected Range Production Adjustment"}
              value={fmtFull(viewMode === 'daily' ? adjDaily : adjMtd)}
              valueClass={adjMtd < 0 ? 'text-red-600' : 'text-foreground'}
              sub="Write-offs + contractual adjustments"
            />
            <MetricRow
              label={viewMode === 'daily' ? "Today's Net Production" : "Net Selected Range Production"}
              value={fmtFull(viewMode === 'daily' ? netDaily : netMtd)}
              valueClass="text-emerald-600 font-bold"
              sub="Gross + Adjustments"
            />
          </div>
        </div>

        {/* Adjustment Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Layers" size={14} className="text-amber-500" />
            Adjustment Breakdown (Selected Range)
          </h3>
          <div>
            <MetricRow label="Write-Offs" value={fmtFull(writeOffs)} valueClass={writeOffs < 0 ? 'text-red-600' : 'text-foreground'} sub="PPO write-offs, contractual" />
            <MetricRow label="Charge Adjustments" value={fmtFull(chargeAdj)} valueClass={chargeAdj < 0 ? 'text-red-600' : 'text-foreground'} sub="Manual charge adjustments" />
            <MetricRow label="Total Adjustments" value={fmtFull(adjMtd)} valueClass="text-red-600 font-bold" sub="All adjustment types combined" />
            <MetricRow
              label="Adjustment Rate"
              value={grossMtd > 0 ? `${((Math.abs(adjMtd) / grossMtd) * 100)?.toFixed(1)}%` : '—'}
              sub="Adjustments / Gross Production"
            />
          </div>
        </div>
      </div>
      {/* Office Comparison Chart */}
      {chartData?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Building2" size={14} className="text-primary" />
            Production by Office (Selected Range)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="office" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload) return null;
                return (
                  <div className="bg-card border border-border rounded-lg p-2 text-xs">
                    <p className="font-semibold mb-1">{label}</p>
                    {payload?.map((entry, i) => (
                      <p key={i} style={{ color: entry?.color }}>{entry?.name}: {fmtFull(entry?.value)}</p>
                    ))}
                  </div>
                );
              }} show={true} />
              <Legend />
              <Bar dataKey="grossProduction" name="Gross Production" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="adjustments" name="Adjustments" fill="#EF4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="netProduction" name="Net Production" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Diagnostics footer */}
      {data?._diagnostics && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon name="Info" size={12} />
          <span>
            {typeof data?._diagnostics === 'string'
              ? data?._diagnostics
              : `Source: ${data?._diagnostics?.endpoint ?? '—'} | Fetched: ${data?._diagnostics?.fetchedAt ?? '—'}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProductionAdjustmentsTab;
