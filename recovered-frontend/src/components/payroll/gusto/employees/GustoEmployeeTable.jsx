import React from 'react';
import { fmtDate } from '../../../../lib/gusto/gustoFormatters';

function StatusBadge({ children, className }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export default function GustoEmployeeTable({ data, count, loading, page, pageSize, onPageChange, onRowClick }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex gap-4">
          {[1,2,3,4,5,6]?.map(i => <div key={i} className="h-3 bg-gray-200 rounded animate-pulse flex-1" />)}
        </div>
        {[1,2,3,4,5]?.map(i => (
          <div key={i} className="px-4 py-3 flex gap-4 border-t border-gray-100">
            {[1,2,3,4,5,6]?.map(j => <div key={j} className="h-3 bg-gray-100 rounded animate-pulse flex-1" />)}
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
        <p className="text-sm text-gray-400">No employees found.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(count / pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-gray-500">
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count} employees
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Name','Email','Status','Hire Date','Term. Date','Type','Pay Freq.','Method','State','Benefits']?.map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.map((emp, i) => (
              <tr
                key={emp?.id || i}
                onClick={() => onRowClick?.(emp)}
                className="cursor-pointer hover:bg-[#F0FAFB] transition-colors"
                style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8F9FA' }}
              >
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                  {emp?.first_name} {emp?.last_name}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp?.email || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge className={emp?.status === 'active' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}>
                    {emp?.status === 'active' ? 'Active' : 'Terminated'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(emp?.hire_date)}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp?.termination_date ? fmtDate(emp?.termination_date) : '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap capitalize">{emp?.employment_type?.replace('_', ' ') || '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp?.pay_frequency || '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp?.payment_method || '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp?.work_state || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {emp?.benefits_enrolled ? (
                    <StatusBadge className="bg-[#DCFCE7] text-[#166534]">Enrolled</StatusBadge>
                  ) : emp?.benefits_eligible === false ? (
                    <StatusBadge className="bg-gray-100 text-gray-500">Not Eligible</StatusBadge>
                  ) : (
                    <StatusBadge className="bg-gray-100 text-gray-500">Not Enrolled</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
