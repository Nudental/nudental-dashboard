import React from 'react';
import Icon from '../../../components/AppIcon';

export default function OfficeSummaryCards({ offices, batches, urgentRequests, onOfficeClick, activeOffice }) {
  const getOfficeSummary = (officeId) => {
    const officeBatches = batches?.filter(b => b?.office_id === officeId);
    const officeUrgent = urgentRequests?.filter(u => u?.office_id === officeId);

    const pendingMonthly = officeBatches?.filter(b =>
      b?.request_type === 'monthly' && ['submitted', 'under_review']?.includes(b?.batch_status)
    )?.length;

    const pendingUrgent = officeUrgent?.filter(u =>
      ['submitted', 'acknowledged', 'in_process']?.includes(u?.urgent_status)
    )?.length;

    const allDates = [
      ...officeBatches?.map(b => b?.created_at),
      ...officeUrgent?.map(u => u?.created_at),
    ]?.filter(Boolean)?.sort()?.reverse();

    const lastRequestDate = allDates?.[0] ? new Date(allDates[0])?.toLocaleDateString() : '—';

    const fulfilledDates = officeBatches?.filter(b => b?.batch_status === 'fulfilled')?.map(b => b?.updated_at)?.filter(Boolean)?.sort()?.reverse();

    let daysSinceFulfilled = '—';
    if (fulfilledDates?.[0]) {
      const diff = Math.floor((Date.now() - new Date(fulfilledDates[0])?.getTime()) / (1000 * 60 * 60 * 24));
      daysSinceFulfilled = `${diff}d ago`;
    }

    return { pendingMonthly, pendingUrgent, lastRequestDate, daysSinceFulfilled };
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {offices?.map(office => {
        const summary = getOfficeSummary(office?.id);
        const isActive = activeOffice === office?.id;
        return (
          <button
            key={office?.id}
            onClick={() => onOfficeClick(office?.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              isActive
                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' :'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon name="Building2" size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">{office?.label}</span>
              </div>
              {isActive && <Icon name="CheckCircle" size={14} className="text-blue-500" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Monthly</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  summary?.pendingMonthly > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{summary?.pendingMonthly}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Urgent</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  summary?.pendingUrgent > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>{summary?.pendingUrgent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Last Request</span>
                <span className="text-xs text-gray-600">{summary?.lastRequestDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Last Fulfilled</span>
                <span className="text-xs text-gray-600">{summary?.daysSinceFulfilled}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
