import React from 'react';
import Icon from '../../../components/AppIcon';

const CategoryFilters = ({ searchQuery, onSearchChange, officeFilter, onOfficeChange, statusFilter, onStatusChange, offices }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e?.target?.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {/* Office Filter */}
      <select
        value={officeFilter}
        onChange={(e) => onOfficeChange(e?.target?.value)}
        className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
      >
        <option value="all">All Offices</option>
        <option value="global">Global (No Office)</option>
        {offices?.map(o => (
          <option key={o?.id} value={o?.id}>{o?.name}</option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e?.target?.value)}
        className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[130px]"
      >
        <option value="all">All Statuses</option>
        <option value="active">Active Only</option>
        <option value="inactive">Inactive Only</option>
      </select>
    </div>
  );
};

export default CategoryFilters;
