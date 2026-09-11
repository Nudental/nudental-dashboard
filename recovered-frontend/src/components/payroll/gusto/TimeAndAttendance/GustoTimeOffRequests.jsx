import React, { useState, useMemo } from 'react';
import { useGustoTimeOffRequests } from '../../../../hooks/gusto/useGustoTimeOffRequests';
import { fmtDate } from '../../../../lib/gusto/gustoFormatters';

const STATUS_BADGE = {
  approved: 'bg-[#DCFCE7] text-[#166534]',
  pending: 'bg-[#FEF9C3] text-[#854D0E]',
  denied: 'bg-[#FEE2E2] text-[#991B1B]',
  cancelled: 'bg-gray-100 text-gray-600',
};

const TYPE_BADGE = {
  Vacation: 'bg-blue-100 text-blue-700',
  Sick: 'bg-red-100 text-red-700',
  PTO: 'bg-teal-100 text-teal-700',
  Unpaid: 'bg-gray-100 text-gray-600',
  Holiday: 'bg-purple-100 text-purple-700',
};

export default function GustoTimeOffRequests({ isSuperAdmin }) {
  const currentYear = new Date()?.getFullYear();
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: allData, loading, error } = useGustoTimeOffRequests({ year: yearFilter });
  const data = useMemo(() => allData.filter(request =>
    (employeeFilter === 'all' || request.employee_name === employeeFilter) &&
    (typeFilter === 'all' || request.time_off_type === typeFilter) &&
    (statusFilter === 'all' || request.status === statusFilter)
  ), [allData, employeeFilter, typeFilter, statusFilter]);

  const employees = useMemo(() => {
    const names = [...new Set(allData?.map(r => r?.employee_name)?.filter(Boolean))];
    return names?.sort();
  }, [allData]);

  const summaryStats = useMemo(() => ({
    total: data?.length,
    approved: data?.filter(r => r?.status === 'approved')?.length,
    pending: data?.filter(r => r?.status === 'pending')?.length,
    denied: data?.filter(r => r?.status === 'denied')?.length,
    totalDays: data?.reduce((sum, r) => sum + (parseFloat(r?.days_requested) || 0), 0),
  }), [data]);

  const years = [2026, 2025, 2024, 2023, 2022, 2021];

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1,2,3]?.map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={yearFilter}
          onChange={e => setYearFilter(Number(e?.target?.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          {years?.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={employeeFilter}
          onChange={e => setEmployeeFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Employees</option>
          {employees?.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Types</option>
          {['Vacation','Sick','PTO','Unpaid','Holiday','Other']?.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Statuses</option>
          {['pending','approved','denied','cancelled']?.map(s => <option key={s} value={s}>{s?.charAt(0)?.toUpperCase() + s?.slice(1)}</option>)}
        </select>
      </div>
      {/* Summary bar */}
      {data?.length > 0 && (
        <div className="flex flex-wrap gap-4 bg-[#F8F9FA] rounded-xl border border-gray-200 px-4 py-3 text-sm">
          <span className="text-gray-600">Total Requests: <strong>{summaryStats?.total}</strong></span>
          <span className="text-green-700">Approved: <strong>{summaryStats?.approved}</strong></span>
          <span className="text-yellow-700">Pending: <strong>{summaryStats?.pending}</strong></span>
          <span className="text-red-700">Denied: <strong>{summaryStats?.denied}</strong></span>
          <span className="text-gray-600">Total Days: <strong>{summaryStats?.totalDays?.toFixed(1)}</strong></span>
        </div>
      )}
      {/* Table */}
      {!data?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-gray-500 text-sm">No time off requests found for the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-gray-200">
                {['Employee','Type','Status','Requested On','Start Date','End Date','Days','Hours','Reason','Approved By','Approved On']?.map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map(req => (
                <tr key={req?.id} className="hover:bg-[#F0FAFB] transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{req?.employee_name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE?.[req?.time_off_type] || 'bg-gray-100 text-gray-600'}`}>
                      {req?.time_off_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE?.[req?.status] || 'bg-gray-100 text-gray-600'}`}>
                      {req?.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDate(req?.request_date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDate(req?.start_date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDate(req?.end_date)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{req?.days_requested != null ? parseFloat(req?.days_requested)?.toFixed(1) : '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{req?.hours_requested != null ? `${parseFloat(req?.hours_requested)?.toFixed(1)} hrs` : '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500 max-w-[160px]">
                    <span className="truncate block" title={req?.reason}>{req?.reason || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{req?.approver_name || '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDate(req?.approved_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
