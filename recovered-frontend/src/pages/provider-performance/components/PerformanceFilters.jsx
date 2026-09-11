import React from 'react';


const PerformanceFilters = ({
  dateRange, onDateRangeChange,
  officeFilter, onOfficeChange,
  providerTypeFilter, onProviderTypeChange,
  serviceCategoryFilter, onServiceCategoryChange,
  offices, serviceCategories, isOfficeManager
}) => {
  const PRESETS = [
    { label: '30d', days: 30 },
    { label: '60d', days: 60 },
    { label: '90d', days: 90 },
    { label: 'YTD', days: null },
  ];

  const applyPreset = (days) => {
    const end = new Date();
    let start;
    if (days === null) {
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      start = new Date(end);
      start?.setDate(start?.getDate() - days);
    }
    onDateRangeChange({
      start: start?.toISOString()?.slice(0, 10),
      end: end?.toISOString()?.slice(0, 10),
    });
  };

  const toggleOffice = (id) => {
    if (id === 'all') { onOfficeChange(['all']); return; }
    const cur = officeFilter?.filter(x => x !== 'all');
    if (cur?.includes(id)) {
      const next = cur?.filter(x => x !== id);
      onOfficeChange(next?.length ? next : ['all']);
    } else {
      onOfficeChange([...cur, id]);
    }
  };

  const toggleProviderType = (type) => {
    if (type === 'all') { onProviderTypeChange(['all']); return; }
    const cur = providerTypeFilter?.filter(x => x !== 'all');
    if (cur?.includes(type)) {
      const next = cur?.filter(x => x !== type);
      onProviderTypeChange(next?.length ? next : ['all']);
    } else {
      onProviderTypeChange([...cur, type]);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex flex-wrap gap-4">
        {/* Date Range */}
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Date Range</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/40 rounded-md p-0.5">
              {PRESETS?.map(p => (
                <button
                  key={p?.label}
                  onClick={() => applyPreset(p?.days)}
                  className="px-2.5 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  {p?.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={dateRange?.start}
              onChange={(e) => onDateRangeChange(prev => ({ ...prev, start: e?.target?.value }))}
              className="px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange?.end}
              onChange={(e) => onDateRangeChange(prev => ({ ...prev, end: e?.target?.value }))}
              className="px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Office Filter */}
        {!isOfficeManager && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Office</label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => toggleOffice('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  officeFilter?.includes('all') ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All
              </button>
              {offices?.map(o => (
                <button
                  key={o?.id}
                  onClick={() => toggleOffice(o?.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    officeFilter?.includes(o?.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {o?.name?.split(' ')?.slice(-1)?.[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Provider Type */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Provider Type</label>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'doctor', label: 'Doctors' },
              { id: 'hygienist', label: 'Hygienists' },
              { id: 'house', label: 'House' },
              { id: 'unattributed', label: 'Unattributed' },
            ]?.map(t => (
              <button
                key={t?.id}
                onClick={() => toggleProviderType(t?.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  providerTypeFilter?.includes(t?.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Service Category */}
        <div className="min-w-[160px]">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Service Category · Unavailable</label>
          <select
            disabled
            title="Provider category breakdown is unavailable from the current data source."
            value={serviceCategoryFilter}
            onChange={(e) => onServiceCategoryChange(e?.target?.value)}
            className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            {serviceCategories?.map(c => (
              <option key={c?.id} value={c?.id}>{c?.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default PerformanceFilters;
