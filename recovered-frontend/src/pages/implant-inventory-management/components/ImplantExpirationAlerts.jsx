import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const ImplantExpirationAlerts = ({ summary }) => {
  const [dismissed, setDismissed] = useState({});

  const groups = [
    { key: 'exp30', items: summary?.expiring30 || [], label: 'Expiring within 30 days', cls: 'bg-red-50 border-red-200 text-red-800', icon: 'AlertCircle', iconCls: 'text-red-600' },
    { key: 'exp60', items: summary?.expiring60 || [], label: 'Expiring within 60 days', cls: 'bg-orange-50 border-orange-200 text-orange-800', icon: 'AlertTriangle', iconCls: 'text-orange-600' },
    { key: 'exp90', items: summary?.expiring90 || [], label: 'Expiring within 90 days', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: 'Clock', iconCls: 'text-yellow-600' },
  ];

  const visible = groups?.filter(g => g?.items?.length > 0 && !dismissed?.[g?.key]);
  if (visible?.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible?.map(g => (
        <div key={g?.key} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${g?.cls}`}>
          <Icon name={g?.icon} size={16} className={`${g?.iconCls} mt-0.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold">{g?.label}: </span>
            <span className="text-xs">{g?.items?.length} implant{g?.items?.length !== 1 ? 's' : ''}</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {g?.items?.slice(0, 5)?.map((item, i) => (
                <span key={i} className="text-xs bg-white/60 rounded px-1.5 py-0.5 border border-current/20">
                  {item?.identification_number || item?.sku_reference || 'ID N/A'} — {item?.office_name?.replace('Nu Dental of ', '') || '?'}
                </span>
              ))}
              {g?.items?.length > 5 && <span className="text-xs">+{g?.items?.length - 5} more</span>}
            </div>
          </div>
          <button onClick={() => setDismissed(d => ({ ...d, [g?.key]: true }))} className="flex-shrink-0 opacity-60 hover:opacity-100">
            <Icon name="X" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ImplantExpirationAlerts;
