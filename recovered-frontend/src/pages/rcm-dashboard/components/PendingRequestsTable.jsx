import React, { useState, useCallback } from 'react';

import Icon from '../../../components/AppIcon';
import RequestDetailPanel from './RequestDetailPanel';

const OFFICE_SHORT = (id) => id?.replace('Nu Dental of ', '') || id;

const getResponseHours = (createdAt) => {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt)?.getTime()) / (1000 * 60 * 60));
};

const StatusBadge = ({ status }) => {
  const map = {
    draft: 'bg-gray-100 text-gray-600',
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    partially_fulfilled: 'bg-orange-100 text-orange-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    denied: 'bg-gray-200 text-gray-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map?.[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

const TypePill = ({ type }) => (
  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
    type === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
  }`}>
    {type === 'urgent' ? '🔴 Urgent' : '📋 Monthly'}
  </span>
);

const SORT_FIELDS = ['office_id', 'created_at', 'priority', 'batch_status', 'response_time'];

export default function PendingRequestsTable({ batches, loading, selectedIds, onSelectionChange, onRefresh, tabLabel }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sorted = [...batches]?.sort((a, b) => {
    let av, bv;
    if (sortField === 'response_time') {
      av = getResponseHours(a?.created_at);
      bv = getResponseHours(b?.created_at);
    } else {
      av = a?.[sortField] || '';
      bv = b?.[sortField] || '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const allIds = sorted?.map(b => b?.id);
  const allSelected = allIds?.length > 0 && allIds?.every(id => selectedIds?.has(id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      allIds?.forEach(id => next?.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      allIds?.forEach(id => next?.add(id));
      onSelectionChange(next);
    }
  };

  const toggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next?.has(id)) next?.delete(id);
    else next?.add(id);
    onSelectionChange(next);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <Icon name="ChevronsUpDown" size={12} className="text-gray-300" />;
    return <Icon name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} className="text-blue-500" />;
  };

  const SortTh = ({ field, label }) => (
    <th
      className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">{label}<SortIcon field={field} /></div>
    </th>
  );

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-b-xl p-12 text-center">
        <Icon name="Loader" size={24} className="animate-spin mx-auto mb-3 text-blue-500" />
        <p className="text-gray-500">Loading requests...</p>
      </div>
    );
  }

  if (sorted?.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-b-xl p-12 text-center">
        <Icon name="CheckCircle" size={32} className="mx-auto mb-3 text-green-400" />
        <p className="text-gray-500 font-medium">No {tabLabel || 'pending'} requests found</p>
        <p className="text-gray-400 text-sm mt-1">All requests have been processed or no requests match your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700" style={{fontFamily:'DM Sans, sans-serif'}}>
          {tabLabel ? `${tabLabel} Requests` : 'Pending Requests'}
          <span className="ml-2 text-xs font-normal text-gray-400">({sorted?.length})</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <SortTh field="office_id" label="Office" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month/Date</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted By</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
              <SortTh field="batch_status" label="Status" />
              <SortTh field="response_time" label="Response Time" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              <th className="px-3 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted?.map(batch => {
              const hours = getResponseHours(batch?.created_at);
              const isUrgent = batch?.request_type === 'urgent';
              const isOverdue = isUrgent ? hours > 24 : hours > 72;
              const isSubmitted = batch?.batch_status === 'submitted';
              const isExpanded = expandedId === batch?.id;

              return (
                <React.Fragment key={batch?.id}>
                  <tr
                    className={`transition-colors ${
                      isUrgent && isSubmitted
                        ? 'bg-red-50 hover:bg-red-100'
                        : isOverdue
                        ? 'bg-orange-50 hover:bg-orange-100' :'hover:bg-gray-50'
                    } ${
                      isOverdue && isUrgent ? 'border-l-4 border-l-red-500' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(batch?.id)}
                        onChange={() => toggleRow(batch?.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {OFFICE_SHORT(batch?.office_id)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <TypePill type={batch?.request_type} />
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {batch?.request_month || batch?.created_at?.slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {batch?.requested_by_profile?.full_name || '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 text-center">
                      {Array.isArray(batch?.request_items) ? batch.request_items.length : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={batch?.batch_status} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : hours > 12
                          ? 'bg-yellow-100 text-yellow-700' :'bg-gray-100 text-gray-600'
                      }`}>
                        {hours}h
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : batch?.id)}
                          className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : batch?.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} />
                      </button>
                    </td>
                  </tr>
                  {/* Inline Expanded Detail Panel */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <RequestDetailPanel
                          batch={batch}
                          onClose={() => setExpandedId(null)}
                          onRefresh={onRefresh}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
