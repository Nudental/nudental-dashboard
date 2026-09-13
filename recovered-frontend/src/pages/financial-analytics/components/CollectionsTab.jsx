/**
 * CollectionsTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Financial Analytics subtab: Collections
 * Shows insurance collections, patient collections, total collections,
 * and payment source breakdown from verified /v2/financial/filter-options.
 *
 * Filter bar shares state with the parent Financial Analytics page —
 * no separate independent filter state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';
import { fetchCollectionMetrics, fetchNormalizedMetricsByOffice, safeNum } from '../../../services/dentrixNormalizedService';
import { buildDateRange } from '../../../services/metricsService';
import { ascendApi } from '../../../services/ascendApi';
import { OFFICE_MAP, getLocationIdByOfficeId } from '../../../constants/offices';
import { parse, isValid, isAfter, format } from 'date-fns';
import FinancialDatePicker from './FinancialDatePicker';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(safeNum(v));
const fmtFull = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(safeNum(v));

const MetricRow = ({ label, value, valueClass = 'text-foreground', sub = null }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
  </div>
);

const KpiCard = ({ label, value, valueClass = 'text-foreground', icon, iconBg, sub }) => (
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

// ── Payment method label resolver ─────────────────────────────────────────────
const METHOD_KEY_LABEL_MAP = {
  credit_card: 'Credit Card Payments',
  creditcard: 'Credit Card Payments',
  check: 'Check Payments',
  cash: 'Cash Payments',
  insurance_check: 'Insurance Check Payments',
  insurancecheck: 'Insurance Check Payments',
  insurance_credit_card: 'Insurance Credit Card Payments',
  insurancecreditcard: 'Insurance Credit Card Payments',
  insurance_electronic: 'Insurance Electronic Payments',
  insuranceelectronic: 'Insurance Electronic Payments',
  patient_financing: 'Patient Financing Payments',
  patientfinancing: 'Patient Financing Payments',
  electronic_transfer: 'Electronic Transfer Payments',
  electronictransfer: 'Electronic Transfer Payments',
  unclassified: 'Unclassified Payments',
};

const resolveMethodLabel = (pm) => {
  if (pm?.methodLabel && typeof pm?.methodLabel === 'string') return pm?.methodLabel;
  if (pm?.label && typeof pm?.label === 'string') return pm?.label;
  if (pm?.name && typeof pm?.name === 'string') return pm?.name;
  const key = (pm?.methodKey || pm?.key || pm?.paymentMethod || '')?.toLowerCase()?.replace(/[\s-]/g, '_');
  return METHOD_KEY_LABEL_MAP?.[key] || pm?.methodKey || pm?.key || 'Unknown';
};

const resolveMethodKey = (pm, i) => pm?.methodKey || pm?.key || pm?.paymentMethod || `pm-${i}`;

const isDisabled = (pm) => {
  const key = (pm?.methodKey || pm?.key || '')?.toLowerCase()?.replace(/[\s-]/g, '_');
  return key === 'electronic_transfer' || key === 'electronictransfer' || pm?.disabled === true;
};

const CollectionsTab = ({
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
  const [filterOptions, setFilterOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('mtd');
  const [dateError, setDateError] = useState('');

  // ── Local staged state for the filter bar ────────────────────────────────
  // Initialize from appliedDateRange so the date picker opens to the applied month.
  // Fall back to stagedDateRange / startDate if applied is not yet set.
  const [localOffice, setLocalOffice] = useState(
    (appliedOffices || selectedOffices || officeIds)?.includes('all') ? 'all' : ((appliedOffices || selectedOffices || officeIds)?.join(',') || 'all')
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
      setLocalOffice(appliedOffices?.includes('all') ? 'all' : (appliedOffices?.join(',') || 'all'));
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

  // Resolve locationId for filter-options API — derived from applied officeIds prop
  const locationId = useMemo(() => {
    if (officeIds?.includes('all')) return null;
    const ids = [...new Set(officeIds || [])];
    return ids.length ? ids.map(id => getLocationIdByOfficeId(id) || id).join(',') : null;
  }, [officeIds?.join(',')]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setOfficeData([]);
      setFilterOptions(null);
      try {
        const today = new Date()?.toISOString()?.split('T')?.[0];
        const [metrics, byOffice, opts] = await Promise.allSettled([
          fetchCollectionMetrics({ startDate: resolvedStartDate, endDate: resolvedEndDate, officeIds, dailyDate: today }),
          fetchNormalizedMetricsByOffice({ startDate: resolvedStartDate, endDate: resolvedEndDate, officeIds }),
          ascendApi?.getFinancialFilterOptions(resolvedStartDate, resolvedEndDate, locationId),
        ]);
        if (!active) return;
        if (metrics?.status === 'rejected') throw metrics.reason;
        if (opts?.status === 'rejected') throw opts.reason;
        setData(metrics?.value);
        if (byOffice?.status === 'fulfilled') setOfficeData(byOffice?.value);
        if (opts?.status === 'fulfilled') setFilterOptions(opts?.value);
      } catch (err) {
        if (active) setError(err?.message || 'Financial metrics unavailable. Please retry.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [resolvedStartDate, resolvedEndDate, officeIds?.join(','), refreshKey]);

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
  // Use onApplyFiltersWithValues to commit new values atomically — avoids the
  // async state race where onApplyFilters reads stale parent state.
  const handleLocalApply = () => {
    if (dateError) return;
    const newOffices = localOffice === 'all' ? ['all'] : localOffice.split(',');
    const newStart = localStart;
    const newEnd = localEnd;

    if (onApplyFiltersWithValues) {
      onApplyFiltersWithValues({ offices: newOffices, start: newStart, end: newEnd });
    } else {
      // Fallback: sync staged state then call apply
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

  // ── Active filter label — always derived from APPLIED state ──────────────
  const activeOfficeLabel = getOfficeLabel(appliedOffices?.length ? appliedOffices : officeIds);
  const activeStartLabel = appliedDateRange?.start || resolvedStartDate || '—';
  const activeEndLabel = appliedDateRange?.end || resolvedEndDate || '—';

  const officeChartData = useMemo(() => {
    const isFiltered = appliedOffices?.length > 0 && !appliedOffices?.includes('all');
    const filteredOfficeData = isFiltered
      ? officeData?.filter(o => {
          const name = o?.officeName?.toLowerCase() || '';
          return appliedOffices?.some(id => {
            const officeName = OFFICE_MAP?.[id]?.name?.toLowerCase() || '';
            return name === officeName || name?.includes(officeName) || officeName?.includes(name);
          });
        })
      : officeData;
    return filteredOfficeData?.map(o => ({
      office: o?.officeName,
      insurance: safeNum(o?.metrics?.insurance_collections_mtd),
      patient: safeNum(o?.metrics?.patient_collections_mtd),
      total: safeNum(o?.metrics?.total_collections_mtd),
    }));
  }, [officeData, appliedOffices]);

  // Payment methods from filter-options (verified backend data)
  const rawPaymentMethods = filterOptions?.paymentMethods ?? [];

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
        Failed to load collections: {error}
      </div>
    );
  }

  const insColl = viewMode === 'daily' ? safeNum(data?.insurance_collections_daily) : safeNum(data?.insurance_collections_mtd);
  const patColl = viewMode === 'daily' ? safeNum(data?.patient_collections_daily) : safeNum(data?.patient_collections_mtd);
  const totalColl = viewMode === 'daily' ? safeNum(data?.total_collections_daily) : safeNum(data?.total_collections_mtd);

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
              {officeIds?.length > 1 && !officeIds.includes('all') && (
                <option value={officeIds.join(',')}>{getOfficeLabel(officeIds)}</option>
              )}
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
          <div className="flex items-end gap-2">
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
          label={viewMode === 'daily' ? "Today's Insurance Collections" : "Selected Range Insurance Collections"}
          value={fmtFull(insColl)}
          icon="Shield"
          iconBg="bg-blue-500"
          sub="Insurance payments received"
        />
        <KpiCard
          label={viewMode === 'daily' ? "Today's Patient Collections" : "Selected Range Patient Collections"}
          value={fmtFull(patColl)}
          icon="User"
          iconBg="bg-purple-500"
          sub="Patient payments received"
        />
        <KpiCard
          label={viewMode === 'daily' ? "Today's Total Collections" : "Total Selected Range Collections"}
          value={fmtFull(totalColl)}
          valueClass="text-emerald-600"
          icon="DollarSign"
          iconBg="bg-emerald-500"
          sub="Insurance + Patient"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="DollarSign" size={14} className="text-emerald-500" />
            Collections — {viewMode === 'daily' ? "Today (UTC)" : "Selected Range"}
          </h3>
          <div>
            <MetricRow
              label={viewMode === 'daily' ? "Today's Insurance Collections" : "Selected Range Insurance Collections"}
              value={fmtFull(insColl)}
              sub="Insurance checks + EFTs"
            />
            <MetricRow
              label={viewMode === 'daily' ? "Today's Patient Collections" : "Selected Range Patient Collections"}
              value={fmtFull(patColl)}
              sub="Patient payments at POS + statements"
            />
            <MetricRow
              label={viewMode === 'daily' ? "Today's Total Collections" : "Total Selected Range Collections"}
              value={fmtFull(totalColl)}
              valueClass="text-emerald-600 font-bold"
              sub="Insurance + Patient combined"
            />
          </div>
        </div>

        {/* Payment Source Breakdown — verified paymentMethods from filter-options */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Icon name="CreditCard" size={14} className="text-blue-500" />
            Payment Source Breakdown
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              <Icon name="CheckCircle" size={11} className="text-emerald-500" />
              Verified
            </span>
          </h3>
          <p className="text-xs text-muted-foreground italic mb-3">Source: /v2/financial/filter-options · paymentMethods</p>

          {viewMode === 'daily' ? (
            <div>
              <MetricRow label="Insurance Checks Posted Today" value={fmtFull(safeNum(data?.checks_posted_daily))} sub="Paper checks" />
              <MetricRow label="EFTs Posted Today" value={fmtFull(safeNum(data?.efts_posted_daily))} sub="Electronic funds transfers" />
              <MetricRow label="Insurance Collections Total Today" value={fmtFull(safeNum(data?.insurance_collections_daily))} valueClass="text-blue-600 font-bold" />
              <MetricRow label="Patient Collections Total Today" value={fmtFull(safeNum(data?.patient_collections_daily))} valueClass="text-purple-600 font-bold" />
            </div>
          ) : rawPaymentMethods?.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">
              Payment method breakdown is unavailable from verified Dentrix filter-options data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Payment Method</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Count</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rawPaymentMethods?.map((pm, i) => {
                    const methodKey = resolveMethodKey(pm, i);
                    const label = resolveMethodLabel(pm);
                    const disabled = isDisabled(pm);

                    // Use typeof===number guard (same pattern as HierarchicalFilter)
                    const count = typeof pm?.count === 'number' ? pm?.count
                      : typeof pm?.transactionCount === 'number' ? pm?.transactionCount
                      : typeof pm?.lineCount === 'number' ? pm?.lineCount
                      : null;
                    const amount = typeof pm?.amount === 'number' ? pm?.amount
                      : typeof pm?.totalAmount === 'number' ? pm?.totalAmount
                      : typeof pm?.total === 'number' ? pm?.total
                      : null;
                    const depositCount = typeof pm?.depositCount === 'number' ? pm?.depositCount : null;

                    const cardTypes = Array.isArray(pm?.cardTypes) ? pm?.cardTypes : [];

                    return (
                      <React.Fragment key={methodKey}>
                        <tr className={`border-b border-border/50 ${disabled ? 'opacity-40' : 'hover:bg-muted/30'}`}>
                          <td className="py-2 px-2 font-medium text-foreground">
                            {label}
                            {disabled && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">(disabled)</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-foreground">
                            {count !== null ? count?.toLocaleString() : '—'}
                            {depositCount !== null && (
                              <span className="block text-xs text-muted-foreground">{depositCount} deposits</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-foreground">
                            {amount !== null ? fmtFull(amount) : '—'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {disabled ? (
                              <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">Disabled</span>
                            ) : (
                              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Active</span>
                            )}
                          </td>
                        </tr>
                        {/* Nested card types for Credit Card */}
                        {cardTypes?.map((ct, ci) => {
                          const ctLabel = ct?.cardLabel || ct?.label || ct?.name || `Card ${ci + 1}`;
                          const ctCount = typeof ct?.count === 'number' ? ct?.count : null;
                          const ctAmount = typeof ct?.amount === 'number' ? ct?.amount : null;
                          return (
                            <tr key={`${methodKey}-ct-${ci}`} className="border-b border-border/30 bg-muted/10">
                              <td className="py-1.5 px-2 pl-6 text-xs text-muted-foreground">↳ {ctLabel}</td>
                              <td className="py-1.5 px-2 text-right text-xs tabular-nums text-muted-foreground">
                                {ctCount !== null ? ctCount?.toLocaleString() : '—'}
                              </td>
                              <td className="py-1.5 px-2 text-right text-xs tabular-nums text-muted-foreground">
                                {ctAmount !== null ? fmtFull(ctAmount) : '—'}
                              </td>
                              <td />
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Office Collections Chart */}
      {officeChartData?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Building2" size={14} className="text-primary" />
            Collections by Office (Selected Range)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={officeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="office" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload?.length) {
                    return (
                      <div className="bg-card border border-border rounded p-2 text-xs">
                        <p className="font-medium mb-1">{label}</p>
                        {payload?.map((entry, i) => (
                          <p key={i} style={{ color: entry?.color }}>{entry?.name}: {fmtFull(entry?.value)}</p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="insurance" name="Insurance" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="patient" name="Patient" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data?._diagnostics && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon name="Info" size={12} />
          Source: {typeof data?._diagnostics?.endpoint === 'string' ? data?._diagnostics?.endpoint : '—'} | LocationId: {data?._diagnostics?.locationId ?? 'ALL'} | Fetched: {data?._diagnostics?.fetchedAt ? new Date(data._diagnostics.fetchedAt)?.toLocaleTimeString() : '—'}
        </div>
      )}
    </div>
  );
};

export default CollectionsTab;
