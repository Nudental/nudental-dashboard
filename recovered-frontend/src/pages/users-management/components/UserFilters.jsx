import React from 'react';
import Icon from '../../../components/AppIcon';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'regional_clinical_manager', label: 'Regional Clinical Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'insurance_verifier', label: 'Insurance Verifier' },
  { value: 'marketing', label: 'Marketing' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Pending', label: 'Not Activated' },
  { value: 'Inactive', label: 'Not Activated (Inactive)' },
  { value: 'Deactivated', label: 'Deactivated' },
];

const UserFilters = ({ searchQuery, onSearchChange, roleFilter, onRoleChange, officeFilter, onOfficeChange, statusFilter, onStatusChange, offices, onClearAll }) => {
  const hasActiveFilters = searchQuery || roleFilter || officeFilter || statusFilter;

  const officeOptions = [
    { value: '', label: 'All Offices' },
    ...(offices || [])?.map(o => ({ value: o?.id, label: o?.name })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e?.target?.value)}
          className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <Icon name="X" size={13} />
          </button>
        )}
      </div>

      {/* Role Filter */}
      <select
        value={roleFilter}
        onChange={(e) => onRoleChange(e?.target?.value)}
        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground min-w-[130px]"
      >
        {ROLE_OPTIONS?.map(opt => (
          <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
        ))}
      </select>

      {/* Office Filter */}
      <select
        value={officeFilter}
        onChange={(e) => onOfficeChange(e?.target?.value)}
        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground min-w-[140px]"
      >
        {officeOptions?.map(opt => (
          <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e?.target?.value)}
        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground min-w-[130px]"
      >
        {STATUS_OPTIONS?.map(opt => (
          <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
        ))}
      </select>

      {/* Clear All */}
      {hasActiveFilters && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="FilterX" size={14} />
          Clear
        </button>
      )}
    </div>
  );
};

export default UserFilters;
