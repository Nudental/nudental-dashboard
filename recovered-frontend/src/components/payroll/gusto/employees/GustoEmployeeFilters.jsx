import React from 'react';

export default function GustoEmployeeFilters({ filters, onChange, workStates }) {
  return (
    <div className="flex flex-wrap gap-3 items-end bg-white border border-gray-200 rounded-xl p-4">
      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search</label>
        <input
          type="text"
          placeholder="Name or email…"
          value={filters?.search || ''}
          onChange={e => onChange({ ...filters, search: e?.target?.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        />
      </div>
      {/* Status */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
        <select
          value={filters?.status || 'all'}
          onChange={e => onChange({ ...filters, status: e?.target?.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>
      {/* Work State */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Work State</label>
        <select
          value={filters?.workState || 'all'}
          onChange={e => onChange({ ...filters, workState: e?.target?.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All</option>
          {(workStates || ['NJ', 'NY'])?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {/* Employment Type */}
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
        <select
          value={filters?.employmentType || 'all'}
          onChange={e => onChange({ ...filters, employmentType: e?.target?.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
        </select>
      </div>
      {/* Benefits */}
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Benefits</label>
        <select
          value={filters?.benefitsEnrolled || 'all'}
          onChange={e => onChange({ ...filters, benefitsEnrolled: e?.target?.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All</option>
          <option value="enrolled">Enrolled</option>
          <option value="not_enrolled">Not Enrolled</option>
          <option value="not_eligible">Not Eligible</option>
        </select>
      </div>
    </div>
  );
}
