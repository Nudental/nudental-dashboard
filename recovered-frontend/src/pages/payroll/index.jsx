import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { fetchPayrollData, fetchPayrollOffices, fetchPayrollProviders, getPayrollScheduleForYear, getScheduleYears, getCurrentPayrollRun, formatPayrollRunLabel, formatDateShort, formatDateRange, PAYROLL_TYPE_LABELS, PAYROLL_TYPE_COLORS, exportPayrollCSV, buildMonthlyTierDataSeparate, splitPayPeriodByMonth } from '../../services/payrollService';
import { getMappingStats, FAILURE_REASON_LABELS, markAsNonProvider, enrichPayrollRows, classifyEnrichedRows } from '../../services/providerMappingService';
import MappingReviewTool from './components/MappingReviewTool';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import SendCollectionReportModal from './components/SendCollectionReportModal';
import { getDentrixCollectionWindow } from '../../utils/calendarDateHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtCurrencyShort = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(parseFloat(v) || 0);

const YEARS = getScheduleYears();
const currentYear = new Date()?.getFullYear();

// ─── Payroll Type Badge ───────────────────────────────────────────────────────
function PayrollTypeBadge({ type }) {
  const label = PAYROLL_TYPE_LABELS?.[type] || type;
  const color = PAYROLL_TYPE_COLORS?.[type] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

// ─── Pay Period + Payday Info Banner ─────────────────────────────────────────
function PayrollRunBanner({ run, isCustom, customStart, customEnd }) {
  if (isCustom) {
    return (
      <div className="flex flex-wrap items-center gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <Icon name="AlertTriangle" size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-amber-800 dark:text-amber-300">Custom Date Range Mode</span>
        </div>
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Icon name="Calendar" size={13} />
          <span>Date Range: <strong>{formatDateShort(customStart)} – {formatDateShort(customEnd)}</strong></span>
        </div>
        <span className="text-xs text-amber-600 dark:text-amber-500">
          Ad hoc analysis only — not tied to a payroll schedule run
        </span>
      </div>
    );
  }
  if (!run) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl px-4 py-3 text-sm">
      <PayrollTypeBadge type={run?.payroll_type} />
      <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300">
        <Icon name="Calendar" size={13} />
        <span>Pay Period: <strong>{formatDateRange(run?.pay_period_start, run?.pay_period_end)}</strong></span>
      </div>
      <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300">
        <Icon name="Banknote" size={13} />
        <span>Payday: <strong>{formatDateShort(run?.payday)}</strong></span>
      </div>
      {run?.notes && (
        <div className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
          <Icon name="Info" size={12} />
          <span>{run?.notes}</span>
        </div>
      )}
    </div>
  );
}

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function PayrollKPICard({ label, value, sub, icon, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon name={icon} size={16} className="text-white" />
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── Mapping Status Badge ─────────────────────────────────────────────────────
function MappingBadge({ status }) {
  if (!status || status === 'mapped') return null;
  const cfg = {
    needs_review: { label: 'Needs Mapping', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: 'AlertTriangle' },
    unknown_type: { label: 'Unknown Type', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: 'HelpCircle' },
    unknown_office: { label: 'Unknown Office', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: 'MapPin' },
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: 'Clock' },
  }?.[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: 'Info' };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {cfg?.label}
    </span>
  );
}

// ─── Monthly Tier Status Badge ────────────────────────────────────────────────
function TierStatusBadge({ status }) {
  if (!status) return null;
  const cfg = {
    Final: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'CheckCircle' },
    Provisional: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: 'Clock' },
    'True-Up Due': { color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: 'ArrowUpCircle' },
    'No Dentrix Data': { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: 'AlertTriangle' },
  }?.[status] || { color: 'bg-gray-100 text-gray-600', icon: 'Info' };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {status}
    </span>
  );
}

// ─── Monthly Collection Tier Review Section ───────────────────────────────────
function MonthlyCollectionTierReview({ doctors, hygienists, activeDateRange, selectedRun, scheduleForYear, selectedOffice }) {
  const [open, setOpen] = useState(false);
  const [tierLoading, setTierLoading] = useState(false);
  const [tierData, setTierData] = useState(null);
  const [tierError, setTierError] = useState(null);
  const [activeTab, setActiveTab] = useState('doctor-monthly');
  const [sendReportRow, setSendReportRow] = useState(null);

  const loadTierData = useCallback(async () => {
    if (!open) return;
    setTierLoading(true);
    setTierError(null);
    try {
      const entriesToProcess = selectedRun
        ? [selectedRun]
        : (scheduleForYear?.filter(p => p?.is_regular) || []);

      // ── CORRECT RULE ──────────────────────────────────────────────────────
      // Monthly Collections = provider's total Dentrix/FastAPI collections for
      // the FULL calendar month (or MTD for the current/open month).
      //
      // Pay Period Breakdown = provider's Dentrix/FastAPI collections for the
      // exact pay-period segment date range.
      //
      // These are TWO SEPARATE FETCHES. The single-month fast path that reused
      // already-loaded pay-period rows as monthly collections has been REMOVED
      // because pay-period rows represent only the selected pay period, NOT the
      // full calendar month.
      //
      // Example: May 1 payroll, pay period Apr 13–Apr 26:
      //   - Doctor Monthly Tier Table → fetch Apr 1–Apr 28 (MTD, open month)
      //   - Pay Period Breakdown      → fetch Apr 13–Apr 26 (exact segment)
      //   These are different numbers and must not be confused.
      //
      // Source: Dentrix/FastAPI only. No Gusto. No Supabase daily_entries. No proration.

      // Diagnostic log
      const segments = entriesToProcess?.flatMap(e =>
        splitPayPeriodByMonth(e?.pay_period_start, e?.pay_period_end)?.map(s => ({ ...s, payday: e?.payday }))
      );
      console.log('[MonthlyTierReview] Selected pay period(s):', entriesToProcess?.map(e => `${e?.pay_period_start} – ${e?.pay_period_end} (payday: ${e?.payday})`));
      console.log('[MonthlyTierReview] Segment date ranges to fetch (pay-period breakdown):', segments?.map(s => `${s?.segmentStart} – ${s?.segmentEnd} (${s?.calendarMonth})`));
      const uniqueMonths = [...new Set(segments.map(s => s.calendarMonth))];
      console.log('[MonthlyTierReview] Calendar months to fetch (monthly tier):', uniqueMonths);

      // Always use the separate-fetch path: monthly collections and segment
      // collections are fetched independently from Dentrix/FastAPI.
      const result = await buildMonthlyTierDataSeparate(
        entriesToProcess,
        selectedOffice || null,
        enrichPayrollRows,
        classifyEnrichedRows
      );
      setTierData(result);
    } catch (err) {
      setTierError(err?.message || 'Failed to load monthly tier data.');
    } finally {
      setTierLoading(false);
    }
  }, [open, selectedRun, scheduleForYear, selectedOffice]);

  useEffect(() => {
    loadTierData();
  }, [loadTierData]);

  const tabs = [
    { key: 'doctor-monthly', label: 'Doctor Monthly Tiers', icon: 'Stethoscope' },
    { key: 'pay-period', label: 'Pay Period Breakdown', icon: 'CalendarDays' },
    { key: 'hygienist', label: 'Hygienist Pay Periods', icon: 'Heart' },
    { key: 'unmapped', label: 'Unmapped / Excluded', icon: 'AlertTriangle' },
  ];

  const hasTrueUp = tierData?.doctorMonthlyTotals?.some(d => d?.trueUpAmount !== null && Math.abs(d?.trueUpAmount) > 0.01);
  const segmentWarnings = tierData?.segmentWarnings || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Icon name="TrendingUp" size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Monthly Collection Tier Review</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Doctor monthly tier rates · Exact Dentrix/FastAPI segment fetches · No proration
            </p>
          </div>
          {hasTrueUp && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              <Icon name="ArrowUpCircle" size={10} />
              True-Up Due
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={e => { e?.stopPropagation(); loadTierData(); }}
              disabled={tierLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Icon name={tierLoading ? 'Loader2' : 'RefreshCw'} size={12} className={tierLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
          <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-gray-400" />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Source note */}
          <div className="flex items-start gap-2 px-5 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-400">
            <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Source:</strong> Dentrix/FastAPI only — <code className="font-mono">ascendApi.getProductionByProvider(segmentStart, segmentEnd)</code> per exact segment.
              Cross-month pay periods are split by calendar month and fetched separately. No proportional proration is used.
              Gusto, Supabase daily_entries, and manual EOD data are never used here.
            </span>
          </div>

          {/* Segment warnings */}
          {segmentWarnings?.length > 0 && (
            <div className="px-5 py-3 space-y-1.5 border-b border-amber-100 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/10">
              {segmentWarnings?.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Icon name="AlertTriangle" size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{w?.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {tierError && (
            <div className="px-5 py-3 flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border-b border-rose-100 dark:border-rose-800/30">
              <Icon name="AlertCircle" size={14} />
              {tierError}
            </div>
          )}

          {/* Loading */}
          {tierLoading && (
            <div className="px-5 py-8 flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <Icon name="Loader2" size={18} className="animate-spin text-violet-500" />
              Fetching Dentrix/FastAPI segment data…
            </div>
          )}

          {!tierLoading && !tierError && tierData && (
            <>
              {/* Tab Nav */}
              <div className="flex items-center gap-1 px-5 pt-4 pb-0 overflow-x-auto">
                {tabs?.map(tab => (
                  <button
                    key={tab?.key}
                    onClick={() => setActiveTab(tab?.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === tab?.key
                        ? 'border-violet-500 text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon name={tab?.icon} size={12} />
                    {tab?.label}
                    {tab?.key === 'unmapped' && (tierData?.unmappedRows?.length || 0) > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                        {tierData?.unmappedRows?.length}
                      </span>
                    )}
                    {tab?.key === 'doctor-monthly' && hasTrueUp && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-violet-500 text-white">!</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* ── A. Doctor Monthly Tier Table ── */}
                {activeTab === 'doctor-monthly' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Stethoscope" size={14} className="text-blue-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Doctor Monthly Tier Table</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Flat rate per provider-month · No marginal calculation</span>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                      <span>≤ $50,000 → <strong className="text-blue-600 dark:text-blue-400">32%</strong></span>
                      <span>$50,001–$65,000 → <strong className="text-blue-600 dark:text-blue-400">33%</strong></span>
                      <span>$65,001–$80,000 → <strong className="text-blue-600 dark:text-blue-400">34%</strong></span>
                      <span>≥ $80,001 → <strong className="text-blue-600 dark:text-blue-400">35%</strong></span>
                    </div>
                    {!tierData?.doctorMonthlyTotals?.length ? (
                      <EmptyState label="No doctor monthly tier data for selected pay period(s). Dentrix/FastAPI returned no eligible doctor rows." />
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                              {['Provider', 'Office', 'Month', 'Monthly Collections', 'Tier Rate', 'Monthly Tier Compensation', 'Status', 'Paid/Est. To Date', 'True-Up Amount', 'Next Payroll True-Up Date', 'Mapping']?.map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {tierData?.doctorMonthlyTotals?.map((row, i) => {
                              const trueUpAbs = row?.trueUpAmount !== null ? Math.abs(row?.trueUpAmount) : null;
                              const trueUpPositive = row?.trueUpAmount !== null && row?.trueUpAmount > 0.01;
                              const trueUpNegative = row?.trueUpAmount !== null && row?.trueUpAmount < -0.01;
                              return (
                                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${trueUpPositive ? 'bg-violet-50/40 dark:bg-violet-900/10' : ''}`}>
                                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row?.providerName}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.officeName}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs">{row?.calendarMonth}</td>
                                  <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(row?.monthlyCollections)}</td>
                                  <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{((row?.tierRate || 0) * 100)?.toFixed(0)}%</td>
                                  <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{fmtCurrency(row?.monthlyCompensation)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap"><TierStatusBadge status={row?.status} /></td>
                                  <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtCurrency(row?.paidToDateEstimate)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {row?.trueUpAmount === null ? (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">Provisional</span>
                                    ) : trueUpAbs < 0.01 ? (
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400">No adjustment</span>
                                    ) : (
                                      <span className={`font-mono font-semibold text-sm ${trueUpPositive ? 'text-violet-700 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {trueUpPositive ? '+' : '-'}{fmtCurrency(trueUpAbs)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {row?.nextPayrollTrueUpDate ? formatDateShort(row?.nextPayrollTrueUpDate) : '—'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap"><MappingBadge status={row?.mappingStatus} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── B. Pay Period Breakdown Table ── */}
                {activeTab === 'pay-period' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="CalendarDays" size={14} className="text-indigo-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pay Period Breakdown</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Exact Dentrix/FastAPI segment collections per provider per calendar month</span>
                    </div>
                    {!tierData?.payPeriodBreakdown?.length ? (
                      <EmptyState label="No pay period breakdown data. Dentrix/FastAPI returned no eligible doctor rows for the selected period." />
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                              {['Payroll Date', 'Pay Period', 'Provider', 'Month Segment', 'Segment Date Range', 'Segment Collections', 'Applied Tier Rate', 'Segment Compensation', 'Status', 'Mapping', 'Report']?.map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {tierData?.payPeriodBreakdown?.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.payday ? formatDateShort(row?.payday) : '—'}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row?.payPeriodLabel}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row?.providerName}</td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.calendarMonth}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                                  {formatDateShort(row?.segmentStart)} – {formatDateShort(row?.segmentEnd)}
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(row?.segmentCollections)}</td>
                                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{((row?.appliedMonthlyTierRate || 0) * 100)?.toFixed(0)}%</td>
                                <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{fmtCurrency(row?.segmentCompensation)}</td>
                                <td className="px-4 py-3 whitespace-nowrap"><TierStatusBadge status={row?.status} /></td>
                                <td className="px-4 py-3 whitespace-nowrap"><MappingBadge status={row?.mappingStatus} /></td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <button
                                    onClick={() => setSendReportRow(row)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B5CC]/10 hover:bg-[#00B5CC]/20 text-[#00B5CC] text-xs font-semibold transition-colors border border-[#00B5CC]/20 hover:border-[#00B5CC]/40"
                                    title="Send detailed collection report to provider"
                                  >
                                    <Icon name="Send" size={11} />
                                    Send Report
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {/* Send Collection Report Modal */}
                {sendReportRow && (
                  <SendCollectionReportModal
                    row={sendReportRow}
                    onClose={() => setSendReportRow(null)}
                  />
                )}

                {/* ── C. Hygienist Pay Period Table ── */}
                {activeTab === 'hygienist' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Heart" size={14} className="text-emerald-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Hygienist Pay Period Table</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">40% and 45% estimates per pay period — no monthly tier</span>
                    </div>
                    {!tierData?.hygienistBreakdown?.length ? (
                      <EmptyState label="No hygienist data for selected pay period(s). Dentrix/FastAPI returned no eligible hygienist rows." />
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                              {['Payroll Date', 'Pay Period', 'Hygienist', 'Office', 'Pay Period Collections', '40% Estimate', '45% Estimate', 'Mapping']?.map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {tierData?.hygienistBreakdown?.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.payday ? formatDateShort(row?.payday) : '—'}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row?.payPeriodLabel}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row?.providerName}</td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.officeName}</td>
                                <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(row?.payPeriodCollections)}</td>
                                <td className="px-4 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtCurrency(row?.pct40)}</td>
                                <td className="px-4 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtCurrency(row?.pct45)}</td>
                                <td className="px-4 py-3 whitespace-nowrap"><MappingBadge status={row?.mappingStatus} /></td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                              <td className="px-4 py-3 text-gray-900 dark:text-white" colSpan={4}>Totals</td>
                              <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(tierData?.hygienistBreakdown?.reduce((s, r) => s + (r?.payPeriodCollections || 0), 0))}</td>
                              <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(tierData?.hygienistBreakdown?.reduce((s, r) => s + (r?.pct40 || 0), 0))}</td>
                              <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(tierData?.hygienistBreakdown?.reduce((s, r) => s + (r?.pct45 || 0), 0))}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── D. Unmapped / Excluded Review Table ── */}
                {activeTab === 'unmapped' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="AlertTriangle" size={14} className="text-amber-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Unmapped / Excluded Review</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Visible for review — excluded from all payroll-eligible compensation totals</span>
                    </div>
                    {!tierData?.unmappedRows?.length ? (
                      <EmptyState label="No unmapped or excluded rows for the selected period. All provider rows are classified." />
                    ) : (
                      <>
                        <div className="mb-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800/30">
                          <Icon name="Info" size={12} />
                          These rows are excluded from payroll calculations until mapped. Use Provider Mapping to resolve them.
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                {['Provider Raw Name', 'Office', 'Date Range', 'Collections', 'Reason Excluded']?.map(h => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {tierData?.unmappedRows?.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-amber-50/30 dark:bg-amber-900/5">
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="font-medium text-gray-700 dark:text-gray-300 font-mono text-xs">{row?.providerRawName}</div>
                                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                      <Icon name="MinusCircle" size={9} />
                                      Excluded from payroll calculations until mapped
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.officeName}</td>
                                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{row?.dateRange}</td>
                                  <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtCurrency(row?.collections)}</td>
                                  <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">{row?.reasonExcluded}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {!tierLoading && !tierError && !tierData && (
            <div className="px-5 py-8">
              <EmptyState label="No tier data loaded. Select a payroll run and click Refresh." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Doctor Payroll Table ─────────────────────────────────────────────────────
function DoctorTable({ rows, loading, payPeriodLabel, paydayLabel }) {
  if (loading) return <TableSkeleton cols={9} />;
  if (!rows?.length) return <EmptyState label="No doctor payroll data for selected period." />;

  // Only rows with classification === 'doctor' are payroll-eligible
  const eligibleRows = rows?.filter(r => r?.classification === 'doctor');
  const excludedCount = rows?.length - eligibleRows?.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Provider Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Office</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Mapping</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Pay Period
              {payPeriodLabel && <div className="text-gray-400 font-normal normal-case">{payPeriodLabel}</div>}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Payday
              {paydayLabel && <div className="text-gray-400 font-normal normal-case">{paydayLabel}</div>}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Gross Production</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Adjusted Production</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Total Collections</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">32%</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">33%</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">34%</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">35%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows?.map((row, i) => {
            const isExcluded = row?.classification !== 'doctor';
            return (
              <tr
                key={row?.providerId || i}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  isExcluded
                    ? 'bg-gray-50/80 dark:bg-gray-800/30 opacity-75'
                    : row?.mappingStatus && row?.mappingStatus !== 'mapped' ?'bg-amber-50/40 dark:bg-amber-900/10' :''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium text-gray-900 dark:text-white">{row?.providerName}</div>
                  {row?.rawName && row?.rawName !== row?.providerName && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">raw: {row?.rawName}</div>
                  )}
                  {isExcluded && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      <Icon name="MinusCircle" size={9} />
                      Excluded from payroll totals until mapped
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  <div>{row?.officeName}</div>
                  {row?.rawOffice && row?.rawOffice !== row?.officeName && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">raw: {row?.rawOffice}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <MappingBadge status={row?.mappingStatus} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                  {formatDateRange(row?.payPeriodStart, row?.payPeriodEnd)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                  {row?.payday ? formatDateShort(row?.payday) : '—'}
                </td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.grossProduction)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.adjustedProduction)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.totalCollections)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-blue-700 dark:text-blue-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct32)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-blue-700 dark:text-blue-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct33)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-blue-700 dark:text-blue-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct34)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-blue-700 dark:text-blue-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct35)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
            <td className="px-4 py-3 text-gray-900 dark:text-white" colSpan={5}>
              <div className="flex flex-col gap-0.5">
                <span>Payroll-Eligible Totals</span>
                {excludedCount > 0 && (
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    Unmapped / office-level collections excluded from payroll estimate.
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.grossProduction, 0))}</td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.adjustedProduction, 0))}</td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.totalCollections, 0))}</td>
            <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct32 || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct33 || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct34 || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct35 || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Hygienist Payroll Table ──────────────────────────────────────────────────
function HygienistTable({ rows, loading, payPeriodLabel, paydayLabel }) {
  if (loading) return <TableSkeleton cols={7} />;
  if (!rows?.length) return <EmptyState label="No hygienist payroll data for selected period." />;

  // Only rows with classification === 'hygienist' are payroll-eligible
  const eligibleRows = rows?.filter(r => r?.classification === 'hygienist');
  const excludedCount = rows?.length - eligibleRows?.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Provider Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Office</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Mapping</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Pay Period
              {payPeriodLabel && <div className="text-gray-400 font-normal normal-case">{payPeriodLabel}</div>}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Payday
              {paydayLabel && <div className="text-gray-400 font-normal normal-case">{paydayLabel}</div>}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Gross Production</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Adjusted Production</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Total Collections</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-500 whitespace-nowrap">40%</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-500 whitespace-nowrap">45%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows?.map((row, i) => {
            const isExcluded = row?.classification !== 'hygienist';
            return (
              <tr
                key={row?.providerId || i}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  isExcluded
                    ? 'bg-gray-50/80 dark:bg-gray-800/30 opacity-75'
                    : row?.mappingStatus && row?.mappingStatus !== 'mapped' ?'bg-amber-50/40 dark:bg-amber-900/10' :''
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium text-gray-900 dark:text-white">{row?.providerName}</div>
                  {row?.rawName && row?.rawName !== row?.providerName && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">raw: {row?.rawName}</div>
                  )}
                  {isExcluded && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      <Icon name="MinusCircle" size={9} />
                      Excluded from payroll totals until mapped
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  <div>{row?.officeName}</div>
                  {row?.rawOffice && row?.rawOffice !== row?.officeName && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">raw: {row?.rawOffice}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <MappingBadge status={row?.mappingStatus} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                  {formatDateRange(row?.payPeriodStart, row?.payPeriodEnd)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                  {row?.payday ? formatDateShort(row?.payday) : '—'}
                </td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.grossProduction)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.adjustedProduction)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>{fmtCurrency(row?.totalCollections)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct40)}</td>
                <td className={`px-4 py-3 font-mono whitespace-nowrap ${isExcluded ? 'text-gray-400 dark:text-gray-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{isExcluded ? '—' : fmtCurrency(row?.pct45)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
            <td className="px-4 py-3 text-gray-900 dark:text-white" colSpan={5}>
              <div className="flex flex-col gap-0.5">
                <span>Payroll-Eligible Totals</span>
                {excludedCount > 0 && (
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    Unmapped / office-level collections excluded from payroll estimate.
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.grossProduction, 0))}</td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.adjustedProduction, 0))}</td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(eligibleRows?.reduce((s, r) => s + r?.totalCollections, 0))}</td>
            <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct40 || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(eligibleRows?.reduce((s, r) => s + (r?.pct45 || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Skeleton + Empty State ───────────────────────────────────────────────────
function TableSkeleton({ cols }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex gap-4">
        {Array.from({ length: cols })?.map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1" />
        ))}
      </div>
      {[1, 2, 3, 4]?.map(i => (
        <div key={i} className="px-4 py-3 flex gap-4 border-t border-gray-100 dark:border-gray-700">
          {Array.from({ length: cols })?.map((_, j) => (
            <div key={j} className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center">
      <Icon name="FileX" size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ─── Access Denied ────────────────────────────────────────────────────────────
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <Icon name="ShieldX" size={32} className="text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The Payroll module is restricted to <strong>Super Administrator</strong> accounts only.
          Your current role does not have permission to access this page.
        </p>
        <button
          onClick={() => navigate('/executive-overview')}
          className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Main Payroll Page ────────────────────────────────────────────────────────
export default function PayrollPage() {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [scheduleForYear, setScheduleForYear] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [offices, setOffices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedProviderType, setSelectedProviderType] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  const [doctors, setDoctors] = useState([]);
  const [hygienists, setHygienists] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [resolvedPlaceholders, setResolvedPlaceholders] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [dataSourceWarning, setDataSourceWarning] = useState(null);
  const [activeSection, setActiveSection] = useState('both');

  // ── Mapping review state ───────────────────────────────────────────────────
  const [showMappingTool, setShowMappingTool] = useState(false);
  const [mappingStats, setMappingStats] = useState(null);
  const [markingNonProvider, setMarkingNonProvider] = useState(null);
  const [showResolvedDiagnostics, setShowResolvedDiagnostics] = useState(false);
  const payrollRequestId = React.useRef(0);

  // ── Build schedule for selected year ──────────────────────────────────────
  useEffect(() => {
    const schedule = getPayrollScheduleForYear(selectedYear);
    setScheduleForYear(schedule);

    if (selectedYear === currentYear) {
      const current = getCurrentPayrollRun();
      const found = schedule?.find(s => s?.id === current?.id);
      setSelectedRunId(found?.id || schedule?.[schedule?.length - 1]?.id || null);
    } else {
      const lastRegular = [...schedule]?.reverse()?.find(s => s?.is_regular) || schedule?.[schedule?.length - 1];
      setSelectedRunId(lastRegular?.id || null);
    }
    setUseCustomRange(false);
  }, [selectedYear]);

  // ── Load Offices + Providers ───────────────────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchPayrollOffices()?.then(setOffices);
    getMappingStats()?.then(setMappingStats)?.catch(() => {});
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchPayrollProviders(selectedOffice || null)?.then(setProviders);
  }, [isSuperAdmin, selectedOffice]);

  // ── Derived selected run ───────────────────────────────────────────────────
  const selectedRun = useMemo(() => {
    if (useCustomRange) return null;
    return scheduleForYear?.find(s => s?.id === selectedRunId) || null;
  }, [useCustomRange, scheduleForYear, selectedRunId]);

  // ── Filtered schedule for dropdown ────────────────────────────────────────
  const filteredSchedule = useMemo(() => {
    if (selectedTypeFilter === 'all') return scheduleForYear;
    return scheduleForYear?.filter(s => s?.payroll_type === selectedTypeFilter);
  }, [scheduleForYear, selectedTypeFilter]);

  // ── Active date range ──────────────────────────────────────────────────────
  const activeDateRange = useMemo(() => {
    if (useCustomRange && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    if (selectedRun) {
      return { startDate: selectedRun?.pay_period_start, endDate: selectedRun?.pay_period_end };
    }
    return null;
  }, [useCustomRange, customStart, customEnd, selectedRun]);

  // ── Fetch Payroll Data ─────────────────────────────────────────────────────
  const loadPayroll = useCallback(async () => {
    const requestId = ++payrollRequestId.current;
    setDoctors([]);
    setHygienists([]);
    setPlaceholders([]);
    setResolvedPlaceholders([]);
    setSummary({});
    setDataSource(null);
    setDataSourceWarning(null);
    if (!isSuperAdmin || !activeDateRange?.startDate || !activeDateRange?.endDate) {
      setLoading(false);
      setError(isSuperAdmin ? 'Choose a payroll run or enter both custom dates.' : null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ── V734: Apply Dentrix −1 calendar day offset to the actual fetch ──────
      // For a real payroll run (not custom range), derive the Dentrix collection
      // window using the timezone-safe helper. The raw Gusto pay-period dates
      // (activeDateRange) are preserved unchanged for display and audit.
      //
      // Canonical example:
      //   Gusto Aug 17–Aug 30, 2026  →  Dentrix fetch Aug 16–Aug 29, 2026
      //
      // Reconciliation preserves the deployed service's one-day offset for
      // custom ranges too. Display/input dates remain unchanged.
      let dentrixFetchStart = activeDateRange?.startDate;
      let dentrixFetchEnd   = activeDateRange?.endDate;

      if (!useCustomRange && selectedRun?.pay_period_start && selectedRun?.pay_period_end) {
        try {
          const win = getDentrixCollectionWindow(
            selectedRun?.pay_period_start,
            selectedRun?.pay_period_end
          );
          dentrixFetchStart = win?.dentrixStart;
          dentrixFetchEnd   = win?.dentrixEnd;
        } catch (offsetErr) {
          // Malformed pay period dates — fall back to raw Gusto dates and log
          console.warn('[Payroll] getDentrixCollectionWindow failed, using raw Gusto dates:', offsetErr?.message);
        }
      } else if (useCustomRange) {
        const win = getDentrixCollectionWindow(dentrixFetchStart, dentrixFetchEnd);
        dentrixFetchStart = win.dentrixStart;
        dentrixFetchEnd = win.dentrixEnd;
      }

      const result = await fetchPayrollData({
        startDate: dentrixFetchStart,
        endDate:   dentrixFetchEnd,
        locationId: selectedOffice || null,
        providerId: selectedProvider || null,
        providerType: selectedProviderType !== 'all' ? selectedProviderType : null,
        payrollRun: selectedRun,
      });
      if (requestId !== payrollRequestId.current) return;
      setDoctors(result?.doctors || []);
      setHygienists(result?.hygienists || []);
      setPlaceholders(result?.placeholders || []);
      setResolvedPlaceholders(result?.resolvedPlaceholders || []);
      setSummary(result?.summary || {});
      if (result?.error) setError(result?.error);
      setDataSource(result?.dataSource || null);
      setDataSourceWarning(result?.dataSourceWarning || null);
      // Refresh mapping stats after load
      getMappingStats()?.then(setMappingStats)?.catch(() => {});
    } catch (err) {
      if (requestId === payrollRequestId.current) setError(err?.message);
    } finally {
      if (requestId === payrollRequestId.current) setLoading(false);
    }
  }, [isSuperAdmin, activeDateRange, selectedOffice, selectedProvider, selectedProviderType, selectedRun, useCustomRange]);

  useEffect(() => {
    loadPayroll();
    return () => { payrollRequestId.current += 1; };
  }, [loadPayroll]);

  // ── Real-time: auto-refresh when upstream payroll data changes ────────────
  useRealtimeSubscription(
    [
      { table: 'daily_entries' },
      { table: 'providers' },
    ],
    () => {
      console.log('[Dentrix Payroll] Real-time change detected — refreshing payroll data');
      loadPayroll();
    },
    isSuperAdmin // only subscribe when the user can actually see this data
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const currentRunIndex = useMemo(() => {
    if (!selectedRunId) return -1;
    return scheduleForYear?.findIndex(s => s?.id === selectedRunId);
  }, [scheduleForYear, selectedRunId]);

  const goToPrevRun = () => {
    if (currentRunIndex > 0) {
      setSelectedRunId(scheduleForYear?.[currentRunIndex - 1]?.id);
      setUseCustomRange(false);
    } else {
      const prevYear = selectedYear - 1;
      const prevSchedule = getPayrollScheduleForYear(prevYear);
      if (prevSchedule?.length > 0) {
        setSelectedYear(prevYear);
        setSelectedRunId(prevSchedule?.[prevSchedule?.length - 1]?.id);
        setUseCustomRange(false);
      }
    }
  };

  const goToNextRun = () => {
    if (currentRunIndex < scheduleForYear?.length - 1) {
      setSelectedRunId(scheduleForYear?.[currentRunIndex + 1]?.id);
      setUseCustomRange(false);
    } else {
      const nextYear = selectedYear + 1;
      const nextSchedule = getPayrollScheduleForYear(nextYear);
      if (nextSchedule?.length > 0) {
        setSelectedYear(nextYear);
        setSelectedRunId(nextSchedule?.[0]?.id);
        setUseCustomRange(false);
      }
    }
  };

  const handleExportCSV = () => {
    exportPayrollCSV(doctors, hygienists, selectedRun, useCustomRange ? `${customStart}_${customEnd}` : null);
  };

  // ── RBAC Gate ──────────────────────────────────────────────────────────────
  if (!isSuperAdmin) return <AccessDenied />;

  // ── Derived display labels ─────────────────────────────────────────────────
  const payPeriodLabel = selectedRun
    ? formatDateRange(selectedRun?.pay_period_start, selectedRun?.pay_period_end)
    : (useCustomRange && customStart && customEnd ? `${formatDateShort(customStart)} – ${formatDateShort(customEnd)}` : '');

  const paydayLabel = selectedRun ? formatDateShort(selectedRun?.payday) : '';

  const unmappedCount = summary?.unmappedCount || 0;
  const diagnostics = summary?.diagnostics || null;

  // ── Real unresolved count for badge: use real_unresolved from mappingStats if available
  // This ensures the button badge also never counts placeholder rows
  const badgeCount = unmappedCount > 0
    ? unmappedCount
    : (mappingStats?.real_unresolved || 0);

  // ── Handler: Mark a placeholder row as non-provider permanently ────────────
  const handleMarkAsNonProvider = async (rawName) => {
    if (!rawName) return;
    setMarkingNonProvider(rawName);
    try {
      await markAsNonProvider(rawName, 'Marked as non-provider placeholder by Super Admin');
      // Immediately move the row from active placeholders to resolved (no reload needed for instant UI)
      setPlaceholders(prev => prev?.filter(p => (p?.rawName || p?.providerName) !== rawName));
      setResolvedPlaceholders(prev => {
        const moved = placeholders?.find(p => (p?.rawName || p?.providerName) === rawName);
        if (moved) return [...prev, { ...moved, alreadyResolved: true }];
        return prev;
      });
      // Refresh from server to confirm persistence
      await loadPayroll();
      getMappingStats()?.then(setMappingStats)?.catch(() => {});
    } catch (err) {
      console.error('[Payroll] markAsNonProvider error:', err?.message);
    } finally {
      setMarkingNonProvider(null);
    }
  };

  // ── Handler: Resolve all active placeholders at once ──────────────────────
  const handleResolveAllPlaceholders = async () => {
    const activeRawNames = placeholders?.map(p => p?.rawName || p?.providerName)?.filter(Boolean);
    if (!activeRawNames?.length) return;
    for (const rawName of activeRawNames) {
      setMarkingNonProvider(rawName);
      try {
        await markAsNonProvider(rawName, 'Bulk resolved as non-provider by Super Admin');
      } catch (err) {
        console.error('[Payroll] bulk markAsNonProvider error:', err?.message);
      }
    }
    setMarkingNonProvider(null);
    await loadPayroll();
    getMappingStats()?.then(setMappingStats)?.catch(() => {});
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Finance' }, { label: 'Payroll' }]} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Icon name="Banknote" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payroll</h1>
              <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-widest">
                Super Administrator Only
              </p>
            </div>
          </div>
        </div>
        {/* Mapping Review Button */}
        <button
          onClick={() => setShowMappingTool(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            badgeCount > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30' :'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Icon name="GitMerge" size={16} />
          Provider Mapping
          {badgeCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
              {badgeCount}
            </span>
          )}
        </button>
      </div>
      {/* Unmapped Providers Alert — only shows for REAL unresolved providers, never for placeholders */}
      {unmappedCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm">
          <Icon name="AlertTriangle" size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {unmappedCount} provider{unmappedCount !== 1 ? 's' : ''} need{unmappedCount === 1 ? 's' : ''} mapping review.
            </span>
            <span className="text-amber-700 dark:text-amber-400 ml-1">
              These rows are shown with their raw names. Use Provider Mapping to resolve them.
            </span>
          </div>
          <button
            onClick={() => setShowMappingTool(true)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Review Now
          </button>
        </div>
      )}
      {/* Active Placeholder Rows Banner — only shown when there are UNRESOLVED placeholders */}
      {placeholders?.length > 0 && (
        <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-3 text-sm">
          <Icon name="Ghost" size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-purple-800 dark:text-purple-300">
              {placeholders?.length} placeholder row{placeholders?.length !== 1 ? 's' : ''} detected and excluded from payroll totals.
            </span>
            <span className="text-purple-700 dark:text-purple-400 ml-1">
              These import labels are not valid provider identities. Mark them as non-provider to permanently silence this notice.
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {placeholders?.map((p, i) => {
                const rawLabel = p?.rawName || p?.providerName;
                const isMarking = markingNonProvider === rawLabel;
                return (
                  <div key={i} className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg px-2 py-1">
                    <span className="text-purple-700 dark:text-purple-400 text-xs font-mono">
                      {rawLabel}
                      {p?.rawOffice || p?.officeName ? ` · ${p?.rawOffice || p?.officeName}` : ''}
                    </span>
                    <button
                      onClick={() => handleMarkAsNonProvider(rawLabel)}
                      disabled={isMarking}
                      title="Permanently mark as non-provider — will never trigger this banner again"
                      className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition-colors"
                    >
                      {isMarking ? (
                        <Icon name="Loader2" size={10} className="animate-spin" />
                      ) : (
                        <Icon name="ShieldOff" size={10} />
                      )}
                      {isMarking ? 'Saving…' : 'Mark Non-Provider'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {placeholders?.length > 1 && (
            <button
              onClick={handleResolveAllPlaceholders}
              disabled={!!markingNonProvider}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Resolve All
            </button>
          )}
          {placeholders?.length === 1 && (
            <button
              onClick={() => handleMarkAsNonProvider(placeholders?.[0]?.rawName || placeholders?.[0]?.providerName)}
              disabled={!!markingNonProvider}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {markingNonProvider ? 'Saving…' : 'Resolve'}
            </button>
          )}
        </div>
      )}
      {/* Resolved Placeholders — collapsed diagnostics section, no active banner */}
      {resolvedPlaceholders?.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm">
          <button
            onClick={() => setShowResolvedDiagnostics(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Icon name="History" size={13} />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Import Diagnostics — {resolvedPlaceholders?.length} resolved non-provider placeholder{resolvedPlaceholders?.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Icon name={showResolvedDiagnostics ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-gray-400" />
          </button>
          {showResolvedDiagnostics && (
            <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-2">
                These labels were marked as non-provider and are permanently excluded from payroll totals and mapping review.
              </p>
              <div className="flex flex-wrap gap-2">
                {resolvedPlaceholders?.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1">
                    <Icon name="CheckCircle" size={11} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-mono">
                      {p?.rawName || p?.providerName}
                      {p?.rawOffice || p?.officeName ? ` · ${p?.rawOffice || p?.officeName}` : ''}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">resolved</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Import Diagnostics */}
      {diagnostics && diagnostics?.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="BarChart2" size={14} className="text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Import Diagnostics</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-gray-500">Total rows: <strong className="text-gray-800 dark:text-gray-200">{diagnostics?.total}</strong></span>
            <span className="text-emerald-600 dark:text-emerald-400">Auto-mapped: <strong>{diagnostics?.autoMapped}</strong></span>
            <span className="text-blue-600 dark:text-blue-400">Manually mapped: <strong>{diagnostics?.manuallyMapped}</strong></span>
            <span className="text-amber-600 dark:text-amber-400">Unresolved: <strong>{diagnostics?.unresolved}</strong></span>
            <span className="text-purple-600 dark:text-purple-400">Placeholders: <strong>{diagnostics?.placeholders}</strong></span>
            <span className="text-gray-400 dark:text-gray-500">Ignored: <strong>{diagnostics?.ignored}</strong></span>
            <span className="text-gray-600 dark:text-gray-300">Included in totals: <strong>{diagnostics?.includedInTotals}</strong></span>
            <span className="text-rose-600 dark:text-rose-400">Excluded from totals: <strong>{diagnostics?.excludedFromTotals}</strong></span>
          </div>
          {diagnostics?.failureReasons && Object.keys(diagnostics?.failureReasons)?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(diagnostics?.failureReasons)?.map(([reason, count]) => (
                <span key={reason} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded text-xs">
                  <Icon name="AlertCircle" size={10} />
                  {FAILURE_REASON_LABELS?.[reason] || reason}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Year */}
          <div className="flex flex-col gap-1 min-w-[90px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Year</label>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e?.target?.value)); setUseCustomRange(false); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {YEARS?.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Payroll Type Filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payroll Type</label>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular</option>
              <option value="tax_reconciliation">Tax Reconciliation</option>
              <option value="special_correction">Special Correction</option>
              <option value="provider_specific">Provider-Specific</option>
            </select>
          </div>

          {/* Payroll Run Selector with Prev/Next */}
          <div className="flex flex-col gap-1 flex-1 min-w-[320px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Payroll Run (Payday | Type | Pay Period)
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevRun}
                disabled={useCustomRange}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-40"
                title="Previous payroll run"
              >
                <Icon name="ChevronLeft" size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
              <select
                value={useCustomRange ? '__custom__' : (selectedRunId || '')}
                onChange={e => {
                  const v = e?.target?.value;
                  if (v === '__custom__') {
                    setUseCustomRange(true);
                  } else {
                    setSelectedRunId(v);
                    setUseCustomRange(false);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {filteredSchedule?.map(run => (
                  <option key={run?.id} value={run?.id}>
                    {formatPayrollRunLabel(run)}
                  </option>
                ))}
                <option value="__custom__">Custom Date Range…</option>
              </select>
              <button
                onClick={goToNextRun}
                disabled={useCustomRange}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-40"
                title="Next payroll run"
              >
                <Icon name="ChevronRight" size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          {useCustomRange && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e?.target?.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e?.target?.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </>
          )}

          {/* Office Filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</label>
            <select
              value={selectedOffice}
              onChange={e => { setSelectedOffice(e?.target?.value); setSelectedProvider(''); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Offices</option>
              {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
            </select>
          </div>

          {/* Provider Filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</label>
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Providers</option>
              {providers?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
            </select>
          </div>

          {/* Provider Type Filter */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider Type</label>
            <select
              value={selectedProviderType}
              onChange={e => setSelectedProviderType(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Types</option>
              <option value="doctor">Doctors</option>
              <option value="hygienist">Hygienists</option>
            </select>
          </div>

          {/* Refresh + Export */}
          <div className="flex gap-2 ml-auto items-end">
            <button
              onClick={loadPayroll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || (!doctors?.length && !hygienists?.length)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Icon name="Download" size={15} />
              Export CSV
            </button>
          </div>
        </div>
      </div>
      {/* Pay Period + Payday Banner */}
      <PayrollRunBanner
        run={selectedRun}
        isCustom={useCustomRange}
        customStart={customStart}
        customEnd={customEnd}
      />
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Icon name="AlertTriangle" size={16} />
          <span>{error}</span>
        </div>
      )}
      {/* Dentrix Source Warning Banner — shown when FastAPI returned no data */}
      {!error && dataSource && dataSource !== 'dentrix_fastapi' && dataSourceWarning && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Icon name="AlertTriangle" size={16} />
          <span>{dataSourceWarning}</span>
        </div>
      )}
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" style={{ display: activeDateRange?.startDate && activeDateRange?.endDate && !loading && !error ? undefined : 'none' }}>
        <PayrollKPICard
          label="Gross Production"
          value={fmtCurrencyShort(summary?.totalGrossProduction)}
          sub={payPeriodLabel ? `Period: ${payPeriodLabel}` : 'All providers, selected period'}
          icon="TrendingUp"
          color="bg-blue-500"
        />
        <PayrollKPICard
          label="Adjusted Production"
          value={fmtCurrencyShort(summary?.totalAdjustedProduction)}
          sub="After production adjustments"
          icon="BarChart2"
          color="bg-indigo-500"
        />
        <PayrollKPICard
          label="Total Collections"
          value={fmtCurrencyShort(summary?.totalCollections)}
          sub={paydayLabel ? `Payday: ${paydayLabel}` : 'Actual money collected'}
          icon="DollarSign"
          color="bg-emerald-500"
        />
        <PayrollKPICard
          label="Doctor Payroll Est."
          value={fmtCurrencyShort(summary?.totalDoctorPayrollEstimate)}
          sub="Based on 33% of selected pay-period doctor collections"
          icon="Stethoscope"
          color="bg-violet-500"
        />
        <PayrollKPICard
          label="Hygiene Payroll Est."
          value={fmtCurrencyShort(summary?.totalHygienistPayrollEstimate)}
          sub="Based on 40% of selected pay-period hygiene collections"
          icon="Heart"
          color="bg-pink-500"
        />
      </div>
      {/* Section Toggle */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 w-fit shadow-sm">
        {[
          { key: 'both', label: 'All Providers' },
          { key: 'doctors', label: `Doctors (${doctors?.length})` },
          { key: 'hygienists', label: `Hygienists (${hygienists?.length})` },
        ]?.map(tab => (
          <button
            key={tab?.key}
            onClick={() => setActiveSection(tab?.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSection === tab?.key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab?.label}
          </button>
        ))}
      </div>
      {/* Doctor Table */}
      {(activeSection === 'both' || activeSection === 'doctors') && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Icon name="Stethoscope" size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Doctor Payroll</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
              Compensation columns: 32% / 33% / 34% / 35% of selected pay-period Total Collections
            </span>
          </div>
          <DoctorTable
            rows={doctors}
            loading={loading}
            payPeriodLabel={payPeriodLabel}
            paydayLabel={paydayLabel}
          />
        </section>
      )}
      {/* Hygienist Table */}
      {(activeSection === 'both' || activeSection === 'hygienists') && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Icon name="Heart" size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Hygienist Payroll</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
              Compensation columns: 40% / 45% of Total Collections
            </span>
          </div>
          <HygienistTable
            rows={hygienists}
            loading={loading}
            payPeriodLabel={payPeriodLabel}
            paydayLabel={paydayLabel}
          />
        </section>
      )}
      {/* Monthly Collection Tier Review */}
      <MonthlyCollectionTierReview
        doctors={doctors}
        hygienists={hygienists}
        activeDateRange={activeDateRange}
        selectedRun={selectedRun}
        scheduleForYear={scheduleForYear}
        selectedOffice={selectedOffice}
      />
      {/* Data Source Note */}
      <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
        <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
        <div>
          <strong className="text-gray-600 dark:text-gray-300">Data Source:</strong>{' '}
          Provider identity (Name, Office, Type) is resolved through the Staff Management mapping layer.
          Dentrix Ascend data is filtered by <strong>pay period dates</strong> (not payday). Rows with <span className="text-amber-600 dark:text-amber-400 font-semibold">Needs Mapping</span> badges
          use raw imported names — use <strong>Provider Mapping</strong> to resolve them.
          Raw imported values are preserved for audit traceability.
        </div>
      </div>
      {/* Mapping Review Tool Modal */}
      {showMappingTool && (
        <MappingReviewTool onClose={() => { setShowMappingTool(false); loadPayroll(); }} />
      )}
    </div>
  );
}
