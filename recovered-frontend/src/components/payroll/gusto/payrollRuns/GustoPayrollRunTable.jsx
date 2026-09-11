import React, { useState } from 'react';
import { fmtDate, fmtDateRange, fmtCurrency, getRunStatusBadgeClass, getRunStatusLabel } from '../../../../lib/gusto/gustoFormatters';

function StatusBadge({ children, className }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}

export function GustoPayrollRunModal({ run, onClose }) {
  if (!run) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
          <div>
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              Payroll Run Details
            </h2>
            <p className="text-xs text-gray-500">{fmtDateRange(run?.pay_period_start, run?.pay_period_end)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge className={getRunStatusBadgeClass(run)}>{getRunStatusLabel(run)}</StatusBadge>
            {run?.off_cycle && <StatusBadge className="bg-[#FEF9C3] text-[#854D0E]">Off-Cycle</StatusBadge>}
            {run?.fast_ach && <StatusBadge className="bg-[#DBEAFE] text-[#1E40AF]">Fast ACH</StatusBadge>}
          </div>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Check Date', fmtDate(run?.check_date)],
              ['Debit Date', fmtDate(run?.debit_date)],
              ['Net Pay', fmtCurrency(run?.total_net_pay)],
              ['Taxes', fmtCurrency(run?.total_payable_tax)],
              ['Gross / Debit', fmtCurrency(run?.total_debit_amount)],
              ['Reimbursements', fmtCurrency(run?.total_reimbursement)],
              ['Employees', run?.items_processed ?? '—'],
              ['Run By', run?.run_by_user_name || '—'],
              ['Pay Schedule', run?.pay_schedule_name || '—'],
              ['Off-Cycle Reason', run?.off_cycle_reason || '—'],
            ]?.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-gray-400">{label}</div>
                <div className="font-medium text-gray-800">{value}</div>
              </div>
            ))}
          </div>
          {/* Employee IDs count */}
          {run?.employee_ids?.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-3 text-sm">
              <div className="text-xs text-gray-500 mb-1">Employees in this run</div>
              <div className="font-semibold text-gray-800">{run?.employee_ids?.length} employees</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GustoPayrollRunTable({ data, count, loading, page, pageSize, onPageChange, onRowClick }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex gap-4">
          {[1,2,3,4,5,6,7]?.map(i => <div key={i} className="h-3 bg-gray-200 rounded animate-pulse flex-1" />)}
        </div>
        {[1,2,3,4]?.map(i => (
          <div key={i} className="px-4 py-3 flex gap-4 border-t border-gray-100">
            {[1,2,3,4,5,6,7]?.map(j => <div key={j} className="h-3 bg-gray-100 rounded animate-pulse flex-1" />)}
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
        <p className="text-sm text-gray-400">No payroll runs found.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(count / pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-gray-500">
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count} runs
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Pay Period','Check Date','# Employees','Net Pay','Taxes','Gross / Debit','Type','Status','Run By','Fast ACH']?.map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.map((run, i) => (
              <tr
                key={run?.id || i}
                onClick={() => onRowClick?.(run)}
                className="cursor-pointer hover:bg-[#F0FAFB] transition-colors"
                style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8F9FA' }}
              >
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-xs">
                  {fmtDateRange(run?.pay_period_start, run?.pay_period_end)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                  {fmtDate(run?.check_date)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-center">{run?.items_processed ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800 whitespace-nowrap">{fmtCurrency(run?.total_net_pay)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600 whitespace-nowrap">{fmtCurrency(run?.total_payable_tax)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800 whitespace-nowrap">{fmtCurrency(run?.total_debit_amount)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge className={run?.off_cycle ? 'bg-[#FEF9C3] text-[#854D0E]' : 'bg-gray-100 text-gray-600'}>
                    {run?.off_cycle ? 'Off-Cycle' : 'Regular'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge className={getRunStatusBadgeClass(run)}>{getRunStatusLabel(run)}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{run?.run_by_user_name || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {run?.fast_ach && <StatusBadge className="bg-[#DBEAFE] text-[#1E40AF]">Fast ACH</StatusBadge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
