import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const HuddleFilters = ({ filters, offices, isSuperAdmin, isAdmin, onChange }) => {
  const handleChange = (key, value) => {
    onChange?.({ ...filters, [key]: value });
  };

  const handleOfficeToggle = (officeId) => {
    const current = filters?.officeIds || [];
    const updated = current?.includes(officeId)
      ? current?.filter(id => id !== officeId)
      : [...current, officeId];
    handleChange('officeIds', updated);
  };

  const clearAll = () => {
    onChange?.({ startDate: '', endDate: '', status: '', officeIds: [] });
  };

  const hasFilters = filters?.startDate || filters?.endDate || filters?.status || filters?.officeIds?.length;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="SlidersHorizontal" size={16} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        </div>
        {hasFilters && (
          <Button size="xs" variant="ghost" onClick={clearAll} iconName="X" iconSize={12}>
            Clear All
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
          <input
            type="date"
            value={filters?.startDate || ''}
            onChange={(e) => handleChange('startDate', e?.target?.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
          <input
            type="date"
            value={filters?.endDate || ''}
            onChange={(e) => handleChange('endDate', e?.target?.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={filters?.status || ''}
            onChange={(e) => handleChange('status', e?.target?.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="unlocked">Unlocked</option>
          </select>
        </div>
      </div>
      {/* Show office filter for all admin/regional roles with multiple offices */}
      {(isSuperAdmin || isAdmin) && offices?.length > 1 && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-2">Offices</label>
          <div className="flex flex-wrap gap-2">
            {offices?.map((o) => {
              const selected = filters?.officeIds?.includes(o?.id);
              return (
                <button
                  key={o?.id}
                  onClick={() => handleOfficeToggle(o?.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {o?.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HuddleFilters;
