import React from 'react';
import { fmtCurrency, fmtDate } from '../../../../lib/gusto/gustoFormatters';

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
export function GustoSkeleton({ rows = 4, cols = 3 }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: rows * cols })?.map((_, i) => (
        <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function GustoEmptyState({ message = 'No data imported yet.', showImport = false, onImport }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <span className="text-3xl">📭</span>
      </div>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {showImport && onImport && (
        <button
          onClick={onImport}
          className="px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] transition-colors"
        >
          Import Data
        </button>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function GustoKPICard({ label, value, sub, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="h-7 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-500"
        style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
        {label}
      </span>
      <div className="text-2xl font-bold text-[#00B5CC]" style={{ fontFamily: 'Roboto, sans-serif' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── KPI Cards Grid ───────────────────────────────────────────────────────────
export default function GustoKPICards({ kpis, loading }) {
  const periodLabel = kpis?.periodLabel || 'Selected Period';
  const cards = [
    {
      label: 'Active Employees',
      value: loading ? '—' : (kpis?.activeEmployees ?? 0)?.toLocaleString(),
      sub: 'Non-terminated',
    },
    {
      label: `Net Pay ${periodLabel}`,
      value: loading ? '—' : fmtCurrency(kpis?.totalNetPayYTD),
      sub: 'Gusto total_net_pay; excludes payroll taxes, benefits, and contractors',
    },
    {
      label: `Total Taxes ${periodLabel}`,
      value: loading ? '—' : fmtCurrency(kpis?.totalTaxesYTD),
      sub: `Payable tax, ${periodLabel}`,
    },
    {
      label: `Total Gross Cost ${periodLabel}`,
      value: loading ? '—' : fmtCurrency(kpis?.totalGrossCostYTD),
      sub: 'Net pay + taxes + deductions — Gusto bank debit',
    },
    {
      label: `Payroll Runs ${periodLabel}`,
      value: loading ? '—' : (kpis?.payrollRunsYTD ?? 0)?.toLocaleString(),
      sub: periodLabel,
    },
    {
      label: `Paid Contractors ${periodLabel}`,
      value: loading ? '—' : (Number.isFinite(kpis?.contractorSpendYTD) ? fmtCurrency(kpis.contractorSpendYTD) : 'Unavailable'),
      sub: periodLabel,
    },
    {
      label: 'Benefits Cost / Month',
      value: loading ? '—' : fmtCurrency(kpis?.benefitsCostMonth),
      sub: 'Estimated from active enrollments',
    },
    {
      label: 'Next Payroll',
      value: loading ? '—' : (kpis?.nextPayrollDate ? fmtDate(kpis?.nextPayrollDate) : 'None scheduled'),
      sub: 'Nearest future check date',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards?.map((card, i) => (
        <GustoKPICard key={i} {...card} loading={loading} />
      ))}
    </div>
  );
}
