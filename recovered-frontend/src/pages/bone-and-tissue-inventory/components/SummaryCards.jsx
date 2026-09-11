import React from 'react';
import Icon from '../../../components/AppIcon';

const SummaryCards = ({ summary, loading, lowStockCount }) => {
  const cards = [
    {
      label: 'In Stock',
      value: summary?.inStock ?? 0,
      icon: 'Package',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Used',
      value: summary?.used ?? 0,
      icon: 'CheckCircle',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Expired',
      value: summary?.expired ?? 0,
      icon: 'AlertTriangle',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
    {
      label: 'Wasted',
      value: summary?.wasted ?? 0,
      icon: 'Trash2',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
    },
  ];

  const byLocation = summary?.byLocation || {};
  const locationEntries = Object.entries(byLocation);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
      {cards?.map(card => (
        <div
          key={card?.label}
          className={`rounded-xl border ${card?.border} ${card?.bg} p-4 flex flex-col gap-2`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{card?.label}</span>
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

      {/* Low Stock Items Card */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Low Stock</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
            <Icon name="PackageX" size={16} className="text-red-600" />
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-12 bg-muted animate-pulse rounded" />
        ) : (
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-red-600">{lowStockCount ?? 0}</span>
            {(lowStockCount ?? 0) > 0 && (
              <span className="text-xs text-red-500 mb-1 font-medium">≤ 2 units</span>
            )}
          </div>
        )}
      </div>

      {/* Items by Location */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="Building2" size={14} className="text-violet-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Location</span>
        </div>
        {loading ? (
          <div className="space-y-1">
            <div className="h-3 w-full bg-muted animate-pulse rounded" />
            <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
          </div>
        ) : locationEntries?.length === 0 ? (
          <span className="text-xs text-muted-foreground">No data</span>
        ) : (
          <div className="space-y-1">
            {locationEntries?.map(([loc, count]) => (
              <div key={loc} className="flex items-center justify-between">
                <span className="text-xs text-foreground truncate max-w-[80px]" title={loc}>
                  {loc?.replace('Nu Dental of ', '')}
                </span>
                <span className="text-xs font-bold text-violet-700">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCards;
