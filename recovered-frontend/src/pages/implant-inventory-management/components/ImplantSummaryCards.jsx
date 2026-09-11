import React from 'react';
import Icon from '../../../components/AppIcon';

const ImplantSummaryCards = ({ summary, loading }) => {
  const cards = [
    { label: 'Total In Stock', value: summary?.totalInStock ?? 0, icon: 'Package', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Used This Month', value: summary?.usedThisMonth ?? 0, icon: 'CheckCircle', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Low Stock', value: summary?.lowStock ?? 0, icon: 'PackageX', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', alert: (summary?.lowStock ?? 0) > 0 },
    { label: 'Expired', value: summary?.expired ?? 0, icon: 'AlertTriangle', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', alert: (summary?.expired ?? 0) > 0 },
    { label: 'Expiring Soon', value: summary?.expiringSoon ?? 0, icon: 'Clock', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', alert: (summary?.expiringSoon ?? 0) > 0 },
  ];

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards?.map(card => (
          <div key={card?.label} className={`rounded-xl border ${card?.border} ${card?.bg} p-4 flex flex-col gap-2 ${card?.alert ? 'ring-1 ring-red-300' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{card?.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card?.bg}`}>
                <Icon name={card?.icon} size={16} className={card?.color} />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-muted animate-pulse rounded" />
            ) : (
              <span className={`text-3xl font-bold ${card?.color}`}>{card?.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BreakdownCard title="By Company" icon="Building2" data={summary?.byCompany} loading={loading} color="violet" />
        <BreakdownCard title="By Platform Size" icon="Layers" data={summary?.byPlatformSize} loading={loading} color="cyan" />
        <BreakdownCard title="By Location" icon="MapPin" data={summary?.byLocation} loading={loading} color="indigo" />
      </div>
    </div>
  );
};

const BreakdownCard = ({ title, icon, data, loading, color }) => {
  const entries = Object.entries(data || {})?.slice(0, 5);
  const colorMap = {
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', val: 'text-violet-700' },
    cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   icon: 'text-cyan-600',   val: 'text-cyan-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', val: 'text-indigo-700' },
  };
  const c = colorMap?.[color] || colorMap?.violet;
  return (
    <div className={`rounded-xl border ${c?.border} ${c?.bg} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} size={14} className={c?.icon} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      {loading ? (
        <div className="space-y-1">{[1,2,3]?.map(i => <div key={i} className="h-3 bg-muted animate-pulse rounded" />)}</div>
      ) : entries?.length === 0 ? (
        <span className="text-xs text-muted-foreground">No data</span>
      ) : (
        <div className="space-y-1">
          {entries?.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-xs text-foreground truncate max-w-[140px]" title={k}>{k?.replace('Nu Dental of ', '')}</span>
              <span className={`text-xs font-bold ${c?.val}`}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImplantSummaryCards;
