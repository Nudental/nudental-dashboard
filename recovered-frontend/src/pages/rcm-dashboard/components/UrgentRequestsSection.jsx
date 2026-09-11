import React, { useState } from 'react';

import { supplyRequestService } from '../../../services/supplyRequestService';
import { sendSupplyStatusEmail } from '../../../services/rcmEmailService';
import Icon from '../../../components/AppIcon';

const OFFICE_SHORT = (id) => id?.replace('Nu Dental of ', '') || id;

const getResponseHours = (createdAt) => {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt)?.getTime()) / (1000 * 60 * 60));
};

export default function UrgentRequestsSection({ urgentRequests, loading, onRefresh }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const activeUrgent = urgentRequests?.filter(u =>
    ['submitted', 'acknowledged', 'in_process']?.includes(u?.urgent_status)
  );

  if (!loading && activeUrgent?.length === 0) return null;

  const handleAction = async (id, action) => {
    setActionLoading(id + action);
    try {
      await supplyRequestService?.updateUrgentRequestStatus(id, action);
      // Send status-change email (fire-and-forget)
      sendSupplyStatusEmail('urgent', id, action);
      await onRefresh();
    } catch (err) {
      console.error('Urgent action error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status) => {
    const map = {
      submitted: 'bg-red-100 text-red-700',
      acknowledged: 'bg-yellow-100 text-yellow-700',
      in_process: 'bg-blue-100 text-blue-700',
      fulfilled: 'bg-green-100 text-green-700',
      denied: 'bg-gray-100 text-gray-600',
    };
    return map?.[status] || 'bg-gray-100 text-gray-600';
  };

  const priorityBadge = (priority) => {
    const map = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-gray-400 text-white',
    };
    return map?.[priority] || 'bg-gray-400 text-white';
  };

  return (
    <div className="mb-6 border-2 border-red-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3 bg-red-50 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🚨</span>
          <span className="font-semibold text-red-800" style={{fontFamily:'DM Sans, sans-serif'}}>
            Urgent Requests Requiring Action
          </span>
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {activeUrgent?.length}
          </span>
        </div>
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={18} className="text-red-600" />
      </button>
      {!collapsed && (
        <div className="bg-white divide-y divide-red-50">
          {loading ? (
            <div className="p-6 text-center text-gray-400">
              <Icon name="Loader" size={20} className="animate-spin mx-auto mb-2" />
              Loading urgent requests...
            </div>
          ) : (
            activeUrgent?.map(req => {
              const hours = getResponseHours(req?.created_at);
              const isOverdue = hours > 4;
              const neededBy = req?.needed_by_date ? new Date(req?.needed_by_date) : null;
              const isPastDue = neededBy && neededBy <= new Date();
              const isExpanded = expandedId === req?.id;

              return (
                <div
                  key={req?.id}
                  className={`transition-all ${
                    isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-orange-300'
                  }`}
                >
                  {/* Row */}
                  <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req?.id)}
                      className="flex items-center gap-1 text-gray-400 hover:text-gray-600"
                    >
                      <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} />
                    </button>

                    <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {OFFICE_SHORT(req?.office_id)}
                    </span>

                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${priorityBadge(req?.priority)}`}>
                      {req?.priority?.toUpperCase()}
                    </span>

                    <span className="text-sm font-medium text-gray-800 flex-1">
                      {req?.item_name || req?.supply_items?.name || 'Urgent Request'}
                    </span>

                    <span className="text-xs text-gray-500">
                      by {req?.requested_by_profile?.full_name || '—'}
                    </span>

                    {neededBy && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        isPastDue ? 'bg-red-100 text-red-700' : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        Needed: {neededBy?.toLocaleDateString()}{isPastDue ? ' ⚠️' : ''}
                      </span>
                    )}

                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isOverdue ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {hours}h
                    </span>

                    <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(req?.urgent_status)}`}>
                      {req?.urgent_status?.replace('_', ' ')}
                    </span>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1">
                      {req?.urgent_status === 'submitted' && (
                        <button
                          onClick={() => handleAction(req?.id, 'acknowledged')}
                          disabled={actionLoading === req?.id + 'acknowledged'}
                          className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {['submitted', 'acknowledged']?.includes(req?.urgent_status) && (
                        <button
                          onClick={() => handleAction(req?.id, 'in_process')}
                          disabled={actionLoading === req?.id + 'in_process'}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          In Process
                        </button>
                      )}
                      {['acknowledged', 'in_process']?.includes(req?.urgent_status) && (
                        <button
                          onClick={() => handleAction(req?.id, 'fulfilled')}
                          disabled={actionLoading === req?.id + 'fulfilled'}
                          className="px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          Fulfill
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(req?.id, 'denied')}
                        disabled={actionLoading === req?.id + 'denied'}
                        className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-red-50 border-t border-red-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Patient Care Impact</div>
                          <div className="text-sm text-gray-800">{req?.patient_care_impact || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Department</div>
                          <div className="text-sm text-gray-800">{req?.supply_departments?.name || req?.department_name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Requested Qty</div>
                          <div className="text-sm font-semibold text-gray-800">{req?.requested_qty || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Submitted</div>
                          <div className="text-sm text-gray-800">{req?.created_at ? new Date(req?.created_at)?.toLocaleString() : '—'}</div>
                        </div>
                      </div>
                      {req?.reason_notes && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-1">Reason / Notes</div>
                          <div className="text-sm text-gray-700 bg-white rounded p-2 border border-red-100">{req?.reason_notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
