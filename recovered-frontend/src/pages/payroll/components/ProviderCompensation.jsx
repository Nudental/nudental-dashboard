import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { buildMonthlyTierDataSeparate, splitPayPeriodByMonth, isMonthClosed, getPayrollScheduleForYear, getScheduleYears, getCurrentPayrollRun, formatDateShort, formatDateRange,  } from '../../../services/payrollService';
import { enrichPayrollRows, classifyEnrichedRows } from '../../../services/providerMappingService';
import { OFFICE_LIST, OFFICE_MAP } from '../../../constants/offices';
import ProviderPayPeriodReport from './ProviderPayPeriodReport';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtCurrencyShort = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(parseFloat(v) || 0);

const YEARS = getScheduleYears();
const currentYear = new Date()?.getFullYear();

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return null;
  const cfg = {
    Estimated: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: 'Clock' },
    Finalized: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'CheckCircle' },
    'Needs True-Up': { color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: 'ArrowUpCircle' },
    'Overpayment Review': { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: 'AlertTriangle' },
    'No Data': { color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', icon: 'FileX' },
  }?.[status] || { color: 'bg-gray-100 text-gray-500', icon: 'Info' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {status}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon, color, accent }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border ${accent || 'border-gray-200 dark:border-gray-700'} p-4 flex flex-col gap-1.5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon name={icon} size={14} className="text-white" />
        </span>
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  );
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────
function TableSkeleton({ cols = 8 }) {
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

// ─── Provider Detail Drawer ───────────────────────────────────────────────────
function ProviderDetailDrawer({ provider, payPeriodBreakdown, hygienistBreakdown, onClose, providerType }) {
  if (!provider) return null;

  const isDoctor = providerType === 'doctor';
  const pid = provider?.providerId;

  // Filter breakdown rows for this provider
  const doctorRows = (payPeriodBreakdown || [])?.filter(r => r?.providerId === pid);
  const hygRows = (hygienistBreakdown || [])?.filter(r => r?.providerId === pid);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDoctor ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <Icon name={isDoctor ? 'Stethoscope' : 'Heart'} size={16} className={isDoctor ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{provider?.providerName}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{provider?.officeName} · {isDoctor ? 'Doctor' : 'Hygienist'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Icon name="X" size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Doctor detail */}
          {isDoctor && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">Monthly Collections</div>
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-300">{fmtCurrency(provider?.monthlyCollections)}</div>
                  <div className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">{provider?.calendarMonth} · {provider?.status}</div>
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/10 rounded-xl p-3 border border-violet-100 dark:border-violet-800/30">
                  <div className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wider mb-1">Tier Rate</div>
                  <div className="text-lg font-bold text-violet-800 dark:text-violet-300">{((provider?.tierRate || 0) * 100)?.toFixed(0)}%</div>
                  <div className="text-xs text-violet-500 dark:text-violet-500 mt-0.5">Based on monthly total</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-1">Monthly Compensation</div>
                  <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{fmtCurrency(provider?.monthlyCompensation)}</div>
                  <div className="text-xs text-emerald-500 dark:text-emerald-500 mt-0.5">Final monthly amount</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Paid / Est. To Date</div>
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{fmtCurrency(provider?.paidToDateEstimate)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sum of segment compensation</div>
                </div>
                {provider?.trueUpAmount !== null && (
                  <div className={`rounded-xl p-3 border ${provider?.trueUpAmount > 0.01 ? 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800/30' : provider?.trueUpAmount < -0.01 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/30' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">True-Up Adjustment</div>
                    <div className={`text-lg font-bold ${provider?.trueUpAmount > 0.01 ? 'text-violet-700 dark:text-violet-400' : provider?.trueUpAmount < -0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {provider?.trueUpAmount > 0.01 ? '+' : ''}{fmtCurrency(provider?.trueUpAmount)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {provider?.trueUpAmount > 0.01 ? 'Additional compensation due' : provider?.trueUpAmount < -0.01 ? 'Overpayment / review needed' : 'No adjustment needed'}
                    </div>
                  </div>
                )}
                {provider?.nextPayrollTrueUpDate && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Next True-Up Payroll</div>
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatDateShort(provider?.nextPayrollTrueUpDate)}</div>
                  </div>
                )}
              </div>

              {/* Pay period breakdown for this doctor */}
              {doctorRows?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <Icon name="CalendarDays" size={14} className="text-indigo-500" />
                    Pay Period Segments
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          {['Payday', 'Segment Range', 'Month', 'Segment Collections', 'Tier Rate', 'Segment Compensation', 'Status']?.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {doctorRows?.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{row?.payday ? formatDateShort(row?.payday) : '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-500 dark:text-gray-400">{formatDateShort(row?.segmentStart)} – {formatDateShort(row?.segmentEnd)}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-600 dark:text-gray-300">{row?.calendarMonth}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-800 dark:text-gray-200">{fmtCurrency(row?.segmentCollections)}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-blue-700 dark:text-blue-400">{((row?.appliedMonthlyTierRate || 0) * 100)?.toFixed(0)}%</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-blue-700 dark:text-blue-400">{fmtCurrency(row?.segmentCompensation)}</td>
                            <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={row?.status === 'Final' ? 'Finalized' : 'Estimated'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                <strong>Source:</strong> Dentrix/FastAPI — <code className="font-mono">ascendApi.getProductionByProvider()</code> per exact segment and calendar month. No proration. No Gusto. No Supabase daily_entries.
              </div>
            </>
          )}

          {/* Hygienist detail */}
          {!isDoctor && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-1">Pay Period Collections</div>
                  <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{fmtCurrency(provider?.payPeriodCollections)}</div>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/10 rounded-xl p-3 border border-teal-100 dark:border-teal-800/30">
                  <div className="text-xs text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider mb-1">Compensation at 40%</div>
                  <div className="text-lg font-bold text-teal-800 dark:text-teal-300">{fmtCurrency(provider?.pct40)}</div>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-xl p-3 border border-cyan-100 dark:border-cyan-800/30">
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-wider mb-1">Compensation at 45%</div>
                  <div className="text-lg font-bold text-cyan-800 dark:text-cyan-300">{fmtCurrency(provider?.pct45)}</div>
                </div>
              </div>

              {hygRows?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <Icon name="CalendarDays" size={14} className="text-emerald-500" />
                    Pay Period History
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          {['Payday', 'Pay Period', 'Collections', '40%', '45%']?.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {hygRows?.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{row?.payday ? formatDateShort(row?.payday) : '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">{row?.payPeriodLabel}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-800 dark:text-gray-200">{fmtCurrency(row?.payPeriodCollections)}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-emerald-700 dark:text-emerald-400">{fmtCurrency(row?.pct40)}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-emerald-700 dark:text-emerald-400">{fmtCurrency(row?.pct45)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Doctor Compensation Table ────────────────────────────────────────────────
const OFFICE_COLORS = {
  'Eatontown': 'bg-blue-500',
  'Brick': 'bg-violet-500',
  'Barnegat': 'bg-emerald-500',
  'Staten Island': 'bg-amber-500',
};

function DoctorCompensationTable({ rows, payPeriodBreakdown, onRowClick }) {
  if (!rows?.length) return <EmptyState label="No doctor compensation data for selected filters. Dentrix/FastAPI returned no eligible doctor rows." />;

  // Group rows by office
  const officeGroups = rows?.reduce((acc, row) => {
    const office = row?.officeName || 'Unknown Office';
    if (!acc?.[office]) acc[office] = [];
    acc?.[office]?.push(row);
    return acc;
  }, {});

  const officeNames = Object.keys(officeGroups)?.sort();

  const COLS = ['Provider', 'Pay Period', 'Calendar Month', 'Pay-Period Collection', 'Monthly Collection', 'Tier %', 'Est. Pay-Period Comp.', 'Prior Paid This Month', 'Final Monthly Comp.', 'True-Up Adjustment', 'Status'];

  return (
    <div className="space-y-6">
      {officeNames?.map(office => {
        const officeRows = officeGroups?.[office];
        const dotColor = OFFICE_COLORS?.[office] || 'bg-gray-400';
        const officeTotal = officeRows?.reduce((s, r) => s + (r?.monthlyCompensation || 0), 0);
        const officeCollections = officeRows?.reduce((s, r) => s + (r?.monthlyCollections || 0), 0);

        return (
          <div key={office} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Office header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${dotColor}`} />
                <span className="text-sm font-bold text-gray-900 dark:text-white">{office}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {officeRows?.length} {officeRows?.length === 1 ? 'doctor' : 'doctors'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Collections: <strong className="text-gray-800 dark:text-gray-200">{fmtCurrency(officeCollections)}</strong></span>
                <span>Compensation: <strong className="text-blue-700 dark:text-blue-400">{fmtCurrency(officeTotal)}</strong></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                    {COLS?.map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {officeRows?.map((row, i) => {
                    const trueUpPositive = row?.trueUpAmount !== null && row?.trueUpAmount > 0.01;
                    const trueUpAbs = row?.trueUpAmount !== null ? Math.abs(row?.trueUpAmount) : null;

                    const segRows = (payPeriodBreakdown || [])?.filter(s => s?.providerId === row?.providerId && s?.calendarMonth === row?.calendarMonth && s?.officeName === row?.officeName);
                    const payPeriodColl = segRows?.reduce((s, r) => s + (r?.segmentCollections || 0), 0);
                    const segComp = segRows?.reduce((s, r) => s + (r?.segmentCompensation || 0), 0);

                    return (
                      <tr
                        key={i}
                        onClick={() => onRowClick && onRowClick(row, 'doctor')}
                        className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors cursor-pointer ${trueUpPositive ? 'bg-violet-50/30 dark:bg-violet-900/5' : ''}`}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{row?.providerName}</span>
                            {/* Barnegat-only override badge — shown ONLY when backend returns officeFilterApplied */}
                            {row?.officeFilterApplied && (
                              <span
                                title={`Collections for this provider are restricted to ${row?.officeFilterLabel || 'a specific location'} by payroll override. Basis: ${row?.officeFilterBasis || 'procedure location'}.`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 cursor-help"
                              >
                                <Icon name="MapPin" size={9} />
                                {row?.officeFilterLabel || 'Location override'}
                              </span>
                            )}
                            <Icon name="ChevronRight" size={12} className="text-gray-400" />
                          </div>
                          {row?.officeFilterApplied && row?.officeFilterBasis && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-normal">
                              Basis: {row?.officeFilterBasis}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{segRows?.[0]?.payPeriodLabel || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.calendarMonth}</td>
                        <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(payPeriodColl)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmtCurrency(row?.monthlyCollections)}</td>
                        <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{((row?.tierRate || 0) * 100)?.toFixed(0)}%</td>
                        <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400 whitespace-nowrap">{fmtCurrency(segComp)}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtCurrency(row?.paidToDateEstimate)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">{fmtCurrency(row?.monthlyCompensation)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row?.trueUpAmount === null ? (
                            <span className="text-xs text-gray-400 italic">Provisional</span>
                          ) : trueUpAbs < 0.01 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">No adjustment</span>
                          ) : (
                            <span className={`font-mono font-semibold text-sm ${trueUpPositive ? 'text-violet-700 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {trueUpPositive ? '+' : '-'}{fmtCurrency(trueUpAbs)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={row?.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                {officeRows?.length > 1 && (
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                      <td className="px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider" colSpan={4}>Office Subtotal</td>
                      <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-white">{fmtCurrency(officeCollections)}</td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 font-mono text-blue-700 dark:text-blue-400">{fmtCurrency(officeTotal)}</td>
                      <td className="px-4 py-2.5" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Hygienist Compensation Table ─────────────────────────────────────────────
function HygienistCompensationTable({ rows, onRowClick }) {
  if (!rows?.length) return <EmptyState label="No hygienist compensation data for selected filters. Dentrix/FastAPI returned no eligible hygienist rows." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {['Hygienist Name', 'Office', 'Pay Period', 'Pay-Period Collection', 'Compensation at 40%', 'Compensation at 45%', 'Status']?.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows?.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick && onRowClick(row, 'hygienist')}
              className="hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  {row?.providerName}
                  <Icon name="ChevronRight" size={12} className="text-gray-400" />
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.officeName}</td>
              <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row?.payPeriodLabel}</td>
              <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(row?.payPeriodCollections)}</td>
              <td className="px-4 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtCurrency(row?.pct40)}</td>
              <td className="px-4 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap">{fmtCurrency(row?.pct45)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={isMonthClosed(row?.calendarMonth) ? 'Finalized' : 'Estimated'} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
            <td className="px-4 py-3 text-gray-900 dark:text-white" colSpan={3}>Totals</td>
            <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{fmtCurrency(rows?.reduce((s, r) => s + (r?.payPeriodCollections || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(rows?.reduce((s, r) => s + (r?.pct40 || 0), 0))}</td>
            <td className="px-4 py-3 font-mono text-teal-700 dark:text-teal-400">{fmtCurrency(rows?.reduce((s, r) => s + (r?.pct45 || 0), 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main Provider Compensation Component ─────────────────────────────────────
export default function ProviderCompensation() {
  // ── Filters ────────────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [scheduleForYear, setScheduleForYear] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [selectedProviderType, setSelectedProviderType] = useState('all'); // all | doctor | hygienist
  const [selectedProviderName, setSelectedProviderName] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // ── Data ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tierData, setTierData] = useState(null);
  const [activeTab, setActiveTab] = useState('doctors'); // doctors | hygienists | payperiod

  // ── Detail Drawer ──────────────────────────────────────────────────────────
  const [drawerProvider, setDrawerProvider] = useState(null);
  const [drawerType, setDrawerType] = useState(null);

  // ── Build schedule ─────────────────────────────────────────────────────────
  useEffect(() => {
    const schedule = getPayrollScheduleForYear(selectedYear);
    setScheduleForYear(schedule);
    if (selectedYear === currentYear) {
      const current = getCurrentPayrollRun();
      const found = schedule?.find(s => s?.id === current?.id);
      setSelectedRunId(found?.id || schedule?.[schedule?.length - 1]?.id || null);
    } else {
      const last = [...schedule]?.reverse()?.find(s => s?.is_regular) || schedule?.[schedule?.length - 1];
      setSelectedRunId(last?.id || null);
    }
  }, [selectedYear]);

  const selectedRun = useMemo(() => scheduleForYear?.find(s => s?.id === selectedRunId) || null, [scheduleForYear, selectedRunId]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!selectedRun) return;
    setLoading(true);
    setError(null);
    try {
      // Resolve locationId from selectedOffice (Supabase UUID → Dentrix locationId)
      let locationId = null;
      if (selectedOffice) {
        const { LOCATION_ID_MAP } = await import('../../../constants/offices');
        locationId = LOCATION_ID_MAP?.[selectedOffice] || null;
      }

      const result = await buildMonthlyTierDataSeparate(
        [selectedRun],
        locationId,
        enrichPayrollRows,
        classifyEnrichedRows
      );
      setTierData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load provider compensation data.');
    } finally {
      setLoading(false);
    }
  }, [selectedRun, selectedOffice]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived: resolve office name from UUID ─────────────────────────────────
  const resolveOfficeName = (id) => {
    if (!id) return 'Unknown Office';
    return OFFICE_MAP?.[id]?.name || id;
  };

  // ── Filtered doctor rows ───────────────────────────────────────────────────
  const doctorRows = useMemo(() => {
    if (!tierData?.doctorMonthlyTotals) return [];
    let rows = tierData?.doctorMonthlyTotals;

    if (selectedOffice) {
      const officeName = resolveOfficeName(selectedOffice);
      rows = rows?.filter(r => r?.officeName === officeName);
    }
    if (selectedProviderName) {
      rows = rows?.filter(r => r?.providerName?.toLowerCase()?.includes(selectedProviderName?.toLowerCase()));
    }
    if (selectedStatus !== 'all') {
      rows = rows?.filter(r => r?.status === selectedStatus);
    }
    return rows;
  }, [tierData, selectedOffice, selectedProviderName, selectedStatus]);

  // ── Filtered hygienist rows ────────────────────────────────────────────────
  const hygienistRows = useMemo(() => {
    if (!tierData?.hygienistBreakdown) return [];
    let rows = tierData?.hygienistBreakdown;

    if (selectedOffice) {
      const officeName = resolveOfficeName(selectedOffice);
      rows = rows?.filter(r => r?.officeName === officeName);
    }
    if (selectedProviderName) {
      rows = rows?.filter(r => r?.providerName?.toLowerCase()?.includes(selectedProviderName?.toLowerCase()));
    }
    return rows;
  }, [tierData, selectedOffice, selectedProviderName]);

  // ── Summary calculations ───────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalDoctorCollections = doctorRows?.reduce((s, r) => s + (r?.monthlyCollections || 0), 0);
    const totalDoctorCompensation = doctorRows?.reduce((s, r) => s + (r?.monthlyCompensation || 0), 0);
    const avgDoctorPct = doctorRows?.length > 0
      ? doctorRows?.reduce((s, r) => s + (r?.tierRate || 0), 0) / doctorRows?.length
      : 0;
    const totalHygCollections = hygienistRows?.reduce((s, r) => s + (r?.payPeriodCollections || 0), 0);
    const totalHyg40 = hygienistRows?.reduce((s, r) => s + (r?.pct40 || 0), 0);
    const totalHyg45 = hygienistRows?.reduce((s, r) => s + (r?.pct45 || 0), 0);
    const trueUpRows = doctorRows?.filter(r => r?.trueUpAmount !== null && r?.trueUpAmount > 0.01);
    const overpayRows = doctorRows?.filter(r => r?.trueUpAmount !== null && r?.trueUpAmount < -0.01);
    const totalTrueUp = trueUpRows?.reduce((s, r) => s + r?.trueUpAmount, 0);
    const totalOverpay = overpayRows?.reduce((s, r) => s + Math.abs(r?.trueUpAmount), 0);
    return { totalDoctorCollections, totalDoctorCompensation, avgDoctorPct, totalHygCollections, totalHyg40, totalHyg45, totalTrueUp, totalOverpay };
  }, [doctorRows, hygienistRows]);

  // ── Status options ─────────────────────────────────────────────────────────
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Estimated', label: 'Estimated' },
    { value: 'Finalized', label: 'Finalized' },
    { value: 'Needs True-Up', label: 'Needs True-Up' },
    { value: 'Overpayment Review', label: 'Overpayment Review' },
  ];

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'doctors', label: 'Doctor Compensation', icon: 'Stethoscope', count: doctorRows?.length },
    { key: 'hygienists', label: 'Hygienist Compensation', icon: 'Heart', count: hygienistRows?.length },
    { key: 'payperiod', label: 'Pay Period Report', icon: 'FileText', count: null },
  ];

  const segmentWarnings = tierData?.segmentWarnings || [];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#00B5CC] flex items-center justify-center">
          <Icon name="Calculator" size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Provider Compensation</h1>
          <p className="text-xs text-[#00B5CC] font-semibold uppercase tracking-widest">Dentrix Ascend Collections · Doctor Monthly Tiers · Hygienist Pay-Period</p>
        </div>
      </div>
      {/* Source note */}
      <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl px-4 py-3">
        <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong>Source:</strong> Dentrix/FastAPI only — <code className="font-mono">ascendApi.getProductionByProvider()</code>.
          Doctor compensation uses full calendar-month collections (not pay-period only). Monthly and pay-period collections are fetched separately.
          No proration. No Gusto. No Supabase daily_entries.
        </span>
      </div>
      {/* Tier reference */}
      <div className="flex flex-wrap gap-3 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
        <span className="font-semibold text-gray-600 dark:text-gray-300 mr-1">Doctor Monthly Tiers:</span>
        <span className="text-gray-500 dark:text-gray-400">≤ $50,000 → <strong className="text-blue-600 dark:text-blue-400">32%</strong></span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500 dark:text-gray-400">$50,001–$65,000 → <strong className="text-blue-600 dark:text-blue-400">33%</strong></span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500 dark:text-gray-400">$65,001–$80,000 → <strong className="text-blue-600 dark:text-blue-400">34%</strong></span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500 dark:text-gray-400">≥ $80,001 → <strong className="text-blue-600 dark:text-blue-400">35%</strong></span>
        <span className="text-gray-400 ml-2">·</span>
        <span className="font-semibold text-gray-600 dark:text-gray-300 ml-1">Hygienist:</span>
        <span className="text-gray-500 dark:text-gray-400"><strong className="text-emerald-600 dark:text-emerald-400">40%</strong> or <strong className="text-teal-600 dark:text-teal-400">45%</strong> of pay-period collections</span>
      </div>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Year */}
          <div className="flex flex-col gap-1 min-w-[90px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e?.target?.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            >
              {YEARS?.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Pay Period */}
          <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pay Period</label>
            <select
              value={selectedRunId || ''}
              onChange={e => setSelectedRunId(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            >
              {scheduleForYear?.filter(s => s?.is_regular)?.map(run => (
                <option key={run?.id} value={run?.id}>
                  {formatDateShort(run?.payday)} | {formatDateRange(run?.pay_period_start, run?.pay_period_end)}
                </option>
              ))}
            </select>
          </div>

          {/* Office */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</label>
            <select
              value={selectedOffice}
              onChange={e => setSelectedOffice(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            >
              <option value="">All Offices</option>
              {OFFICE_LIST?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
            </select>
          </div>

          {/* Provider Type */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider Type</label>
            <select
              value={selectedProviderType}
              onChange={e => { setSelectedProviderType(e?.target?.value); setActiveTab(e?.target?.value === 'hygienist' ? 'hygienists' : 'doctors'); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            >
              <option value="all">All / Doctors / Hygienists</option>
              <option value="doctor">Doctors Only</option>
              <option value="hygienist">Hygienists Only</option>
            </select>
          </div>

          {/* Provider Name Search */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider Name</label>
            <input
              type="text"
              placeholder="Search provider…"
              value={selectedProviderName}
              onChange={e => setSelectedProviderName(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            >
              {statusOptions?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
            </select>
          </div>

          {/* Refresh */}
          <div className="flex gap-2 ml-auto items-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Selected pay period banner */}
        {selectedRun && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#00B5CC] bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800/30 rounded-lg px-3 py-2">
            <Icon name="Calendar" size={12} />
            <span>Pay Period: <strong>{formatDateRange(selectedRun?.pay_period_start, selectedRun?.pay_period_end)}</strong></span>
            <span>·</span>
            <span>Payday: <strong>{formatDateShort(selectedRun?.payday)}</strong></span>
            <span>·</span>
            <span>
              Monthly collections fetched: <strong>
                {(() => {
                  const segs = splitPayPeriodByMonth(selectedRun?.pay_period_start, selectedRun?.pay_period_end);
                  const months = [...new Set(segs.map(s => s.calendarMonth))];
                  return months?.map(m => {
                    const [yr, mo] = m?.split('-')?.map(Number);
                    const lastDay = new Date(yr, mo, 0);
                    const today = new Date();
                    const end = today < lastDay ? today?.toISOString()?.slice(0, 10) : lastDay?.toISOString()?.slice(0, 10);
                    return `${m?.slice(0, 7)} (${m}-01 – ${end})`;
                  })?.join(', ');
                })()}
              </strong>
            </span>
          </div>
        )}
      </div>
      {/* Segment warnings */}
      {segmentWarnings?.length > 0 && (
        <div className="space-y-1.5">
          {segmentWarnings?.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-2">
              <Icon name="AlertTriangle" size={12} className="mt-0.5 flex-shrink-0" />
              <span>{w?.message}</span>
            </div>
          ))}
        </div>
      )}
      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-xl px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <Icon name="AlertCircle" size={16} />
          {error}
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-500 dark:text-gray-400">
          <Icon name="Loader2" size={20} className="animate-spin text-[#00B5CC]" />
          Fetching Dentrix/FastAPI provider compensation data…
        </div>
      )}
      {!loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Doctor Collections"
              value={fmtCurrencyShort(summary?.totalDoctorCollections)}
              sub="Full calendar-month collections"
              icon="Stethoscope"
              color="bg-blue-500"
            />
            <SummaryCard
              label="Total Doctor Compensation"
              value={fmtCurrencyShort(summary?.totalDoctorCompensation)}
              sub="Based on monthly tier rate"
              icon="DollarSign"
              color="bg-violet-500"
            />
            <SummaryCard
              label="Avg Doctor Comp %"
              value={`${(summary?.avgDoctorPct * 100)?.toFixed(1)}%`}
              sub="Average tier rate applied"
              icon="Percent"
              color="bg-indigo-500"
            />
            <SummaryCard
              label="Total Hygienist Collections"
              value={fmtCurrencyShort(summary?.totalHygCollections)}
              sub="Pay-period collections"
              icon="Heart"
              color="bg-emerald-500"
            />
            <SummaryCard
              label="Hygienist Comp at 40%"
              value={fmtCurrencyShort(summary?.totalHyg40)}
              sub="40% of pay-period collections"
              icon="Calculator"
              color="bg-teal-500"
            />
            <SummaryCard
              label="Hygienist Comp at 45%"
              value={fmtCurrencyShort(summary?.totalHyg45)}
              sub="45% of pay-period collections"
              icon="Calculator"
              color="bg-cyan-500"
            />
            <SummaryCard
              label="Total True-Up Due"
              value={fmtCurrencyShort(summary?.totalTrueUp)}
              sub="Additional compensation owed"
              icon="ArrowUpCircle"
              color="bg-violet-600"
              accent={summary?.totalTrueUp > 0 ? 'border-violet-200 dark:border-violet-700' : 'border-gray-200 dark:border-gray-700'}
            />
            <SummaryCard
              label="Overpayment / Review"
              value={fmtCurrencyShort(summary?.totalOverpay)}
              sub="Prior payments exceed final comp"
              icon="AlertTriangle"
              color="bg-rose-500"
              accent={summary?.totalOverpay > 0 ? 'border-rose-200 dark:border-rose-700' : 'border-gray-200 dark:border-gray-700'}
            />
          </div>

          {/* Tab Nav */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 w-fit shadow-sm">
            {tabs?.filter(t => t?.key === 'payperiod' || selectedProviderType === 'all' || (selectedProviderType === 'doctor' && t?.key === 'doctors') || (selectedProviderType === 'hygienist' && t?.key === 'hygienists'))?.map(tab => (
              <button
                key={tab?.key}
                onClick={() => setActiveTab(tab?.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab?.key
                    ? 'bg-[#00B5CC] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon name={tab?.icon} size={14} />
                {tab?.label}
                {tab?.count != null && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === tab?.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {tab?.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Doctor Compensation Table */}
          {(activeTab === 'doctors' && (selectedProviderType === 'all' || selectedProviderType === 'doctor')) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Icon name="Stethoscope" size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Doctor Compensation</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">Monthly tier rate applied to full calendar-month collections · Click row for details</span>
              </div>
              <DoctorCompensationTable
                rows={doctorRows}
                payPeriodBreakdown={tierData?.payPeriodBreakdown || []}
                onRowClick={(row, type) => { setDrawerProvider(row); setDrawerType(type); }}
              />
            </section>
          )}

          {/* Hygienist Compensation Table */}
          {(activeTab === 'hygienists' && (selectedProviderType === 'all' || selectedProviderType === 'hygienist')) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Icon name="Heart" size={14} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Hygienist Compensation</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">40% and 45% of pay-period collections shown side by side · Click row for details</span>
              </div>
              <HygienistCompensationTable
                rows={hygienistRows}
                onRowClick={(row, type) => { setDrawerProvider(row); setDrawerType(type); }}
              />
            </section>
          )}

          {/* Pay Period Report Panel */}
          {activeTab === 'payperiod' && (
            <section>
              <ProviderPayPeriodReport
                doctorRows={doctorRows}
                hygienistRows={hygienistRows}
                tierData={tierData}
                selectedRun={selectedRun}
                selectedOffice={selectedOffice}
              />
            </section>
          )}

          {/* Unmapped / Excluded */}
          {tierData?.unmappedRows?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Icon name="AlertTriangle" size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Unmapped / Excluded Rows</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white ml-1">{tierData?.unmappedRows?.length}</span>
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800/30">
                <Icon name="Info" size={12} />
                These rows are excluded from all compensation calculations until mapped. Use Provider Mapping in the Dentrix Ascend tab to resolve them.
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
                      <tr key={i} className="bg-amber-50/30 dark:bg-amber-900/5">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-700 dark:text-gray-300 font-mono text-xs">{row?.providerRawName}</div>
                          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            <Icon name="MinusCircle" size={9} />
                            Excluded from compensation calculations until mapped
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
            </section>
          )}

          {/* Data source footer */}
          <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
            <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-gray-600 dark:text-gray-300">Data Source:</strong>{' '}
              Dentrix/FastAPI only. Monthly provider collections are fetched for the full calendar month (or MTD for open months) — separate from pay-period segment collections.
              Doctor tier rate is applied to the full monthly collection, not pay-period-only collections.
              No Gusto data. No Supabase daily_entries. No proration.
            </div>
          </div>
        </>
      )}
      {/* Provider Detail Drawer */}
      {drawerProvider && (
        <ProviderDetailDrawer
          provider={drawerProvider}
          payPeriodBreakdown={tierData?.payPeriodBreakdown || []}
          hygienistBreakdown={tierData?.hygienistBreakdown || []}
          onClose={() => { setDrawerProvider(null); setDrawerType(null); }}
          providerType={drawerType}
        />
      )}
    </div>
  );
}
