import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const ExpirationAlerts = ({ summary }) => {
  const [dismissed, setDismissed] = useState({});

  const alerts = [
    {
      key: '30',
      items: summary?.expiring30 || [],
      label: 'Expiring within 30 days',
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: 'AlertCircle',
      iconColor: 'text-red-600',
    },
    {
      key: '60',
      items: summary?.expiring60 || [],
      label: 'Expiring within 60 days',
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      text: 'text-orange-800',
      icon: 'AlertTriangle',
      iconColor: 'text-orange-600',
    },
    {
      key: '90',
      items: summary?.expiring90 || [],
      label: 'Expiring within 90 days',
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      icon: 'Clock',
      iconColor: 'text-yellow-600',
    },
  ];

  const visible = alerts?.filter(a => a?.items?.length > 0 && !dismissed?.[a?.key]);
  if (visible?.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {visible?.map(alert => (
        <div
          key={alert?.key}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${alert?.bg} ${alert?.border}`}
        >
          <Icon name={alert?.icon} size={16} className={`mt-0.5 flex-shrink-0 ${alert?.iconColor}`} />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-semibold ${alert?.text}`}>
              {alert?.items?.length} item{alert?.items?.length !== 1 ? 's' : ''} — {alert?.label}
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {alert?.items?.slice(0, 5)?.map(item => (
                <span
                  key={item?.id}
                  className={`text-xs px-2 py-0.5 rounded-full border ${alert?.border} ${alert?.text} bg-white/60`}
                >
                  {item?.product_name || item?.identification_number}
                </span>
              ))}
              {alert?.items?.length > 5 && (
                <span className={`text-xs ${alert?.text}`}>+{alert?.items?.length - 5} more</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissed(d => ({ ...d, [alert?.key]: true }))}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors ${alert?.text}`}
            aria-label="Dismiss alert"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ExpirationAlerts;
