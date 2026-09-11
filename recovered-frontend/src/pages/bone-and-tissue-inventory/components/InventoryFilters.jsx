import React from 'react';
import Icon from '../../../components/AppIcon';

const STATUSES = ['', 'In Stock', 'Used', 'Wasted', 'Returned'];
const TYPES = ['', 'Bone', 'Tissue', 'Membrane', 'PRF', 'Other'];

const InventoryFilters = ({ filters, setFilters, offices, providers, staff }) => {
  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patient, product, ID…"
            value={filters?.search || ''}
            onChange={e => update('search', e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Location */}
        <select
          value={filters?.officeId || ''}
          onChange={e => update('officeId', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Locations</option>
          {offices?.map(o => (
            <option key={o?.id} value={o?.id}>{o?.name}</option>
          ))}
        </select>

        {/* Provider */}
        <select
          value={filters?.providerId || ''}
          onChange={e => update('providerId', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Providers</option>
          {providers?.map(p => (
            <option key={p?.id} value={p?.id}>{p?.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters?.status || ''}
          onChange={e => update('status', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {STATUSES?.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>

        {/* Type */}
        <select
          value={filters?.boneType || ''}
          onChange={e => update('boneType', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {TYPES?.map(t => (
            <option key={t} value={t}>{t || 'All Types'}</option>
          ))}
        </select>

        {/* Staff */}
        <select
          value={filters?.staffAssistantId || ''}
          onChange={e => update('staffAssistantId', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Staff</option>
          {staff?.map(s => (
            <option key={s?.id} value={s?.id}>{s?.full_name}</option>
          ))}
        </select>

        {/* Date From */}
        <input
          type="date"
          value={filters?.dateFrom || ''}
          onChange={e => update('dateFrom', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Date from"
        />

        {/* Date To */}
        <input
          type="date"
          value={filters?.dateTo || ''}
          onChange={e => update('dateTo', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Date to"
        />
      </div>

      {/* Low Stock Filter Toggle */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => update('lowStockOnly', !filters?.lowStockOnly)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            filters?.lowStockOnly
              ? 'bg-red-600 text-white border-red-600' :'border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
          }`}
        >
          <Icon name="PackageX" size={12} />
          Low Stock Only
        </button>
      </div>

      {/* Active filter chips */}
      {Object.values(filters)?.some(v => v) && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {Object.entries(filters)?.map(([k, v]) =>
            v && k !== 'lowStockOnly' ? (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20"
              >
                {v}
                <button onClick={() => update(k, '')} className="hover:text-destructive">
                  <Icon name="X" size={10} />
                </button>
              </span>
            ) : null
          )}
          {filters?.lowStockOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full border border-red-200">
              Low Stock Only
              <button onClick={() => update('lowStockOnly', false)} className="hover:text-destructive">
                <Icon name="X" size={10} />
              </button>
            </span>
          )}
          <button
            onClick={() => setFilters({})}
            className="text-xs text-muted-foreground hover:text-destructive underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryFilters;
