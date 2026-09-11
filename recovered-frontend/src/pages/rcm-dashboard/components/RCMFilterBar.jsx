import React from 'react';
import Icon from '../../../components/AppIcon';

export default function RCMFilterBar({
  offices, statusOptions,
  filterOffice, filterType, filterStatus, filterMonth, searchQuery,
  onOfficeChange, onTypeChange, onStatusChange, onMonthChange, onSearchChange,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Office */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Office</label>
          <select
            value={filterOffice}
            onChange={e => onOfficeChange(e?.target?.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Offices</option>
            {offices?.map(o => (
              <option key={o?.id} value={o?.id}>{o?.label}</option>
            ))}
          </select>
        </div>

        {/* Request Type */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {['', 'monthly', 'urgent']?.map(t => (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterType === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === '' ? 'All' : t?.charAt(0)?.toUpperCase() + t?.slice(1)}
            </button>
          ))}
        </div>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={e => onStatusChange(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions?.map(s => (
            <option key={s?.value} value={s?.value}>{s?.label}</option>
          ))}
        </select>

        {/* Month */}
        <input
          type="month"
          value={filterMonth}
          onChange={e => onMonthChange(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item or office..."
              value={searchQuery}
              onChange={e => onSearchChange(e?.target?.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(filterOffice || filterType || filterStatus || searchQuery) && (
            <button
              onClick={() => { onOfficeChange(''); onTypeChange(''); onStatusChange(''); onSearchChange(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Icon name="X" size={12} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
