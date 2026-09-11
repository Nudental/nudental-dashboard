import React from 'react';
import Icon from '../../../components/AppIcon';

export default function RCMSummaryBar({ pendingMonthly, pendingUrgent, officesWithOpen, awaitingAction }) {
  const metrics = [
    {
      label: 'Pending Monthly',
      value: pendingMonthly,
      icon: 'Calendar',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'bg-blue-600 text-white',
      text: 'text-blue-700',
    },
    {
      label: 'Pending Urgent',
      value: pendingUrgent,
      icon: 'AlertTriangle',
      bg: 'bg-red-50',
      border: 'border-red-200',
      badge: 'bg-red-600 text-white',
      text: 'text-red-700',
    },
    {
      label: 'Offices with Open Requests',
      value: officesWithOpen,
      icon: 'Building2',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badge: 'bg-amber-600 text-white',
      text: 'text-amber-700',
    },
    {
      label: 'Awaiting Action',
      value: awaitingAction,
      icon: 'Clock',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      badge: 'bg-purple-600 text-white',
      text: 'text-purple-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {metrics?.map((m) => (
        <div key={m?.label} className={`${m?.bg} border ${m?.border} rounded-xl p-4 flex items-center gap-3`}>
          <div className={`${m?.badge} p-2 rounded-lg`}>
            <Icon name={m?.icon} size={18} />
          </div>
          <div>
            <div className={`text-2xl font-bold ${m?.text}`}>{m?.value}</div>
            <div className="text-xs text-gray-600 leading-tight">{m?.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
