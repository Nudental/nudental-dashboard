import React, { useState, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';


const OFFICES = ['All Offices', 'Brick', 'Barnegat', 'Staten Island', 'Eatontown'];
const SOURCE_TYPES = ['All Sources', 'manual', 'gusto', 'amex_api', 'amex_statement_import', 'banking', 'recurring', 'utility_import', 'insurance_import', 'other'];
const SOURCE_LABELS = {
  manual: 'Manual Entry', gusto: 'Gusto Payroll', amex_api: 'AmEx API',
  amex_statement_import: 'AmEx Statement', banking: 'WF Main Money-Out',
  recurring: 'Recurring',
  utility_import: 'Utility Import', insurance_import: 'Insurance Import', other: 'Other',
};
const PAYMENT_SOURCES = ['All', 'amex', 'gusto', 'manual', 'recurring', 'other'];
const STATUSES = ['All', 'posted', 'draft'];

const PRESET_RANGES = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'Q1', value: 'q1' },
  { label: 'Q2', value: 'q2' },
  { label: 'Q3', value: 'q3' },
  { label: 'Q4', value: 'q4' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Last Year', value: 'last_year' },
  { label: 'Custom', value: 'custom' },
];

export function getExpenseDateError(filters) {
  if (filters?.datePreset !== 'custom') return '';
  const { customStart, customEnd } = filters;
  if (!customStart || !customEnd) return 'Choose both a start and an end date.';
  const isValidDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(customStart) || !isValidDate(customEnd)) return 'Choose valid start and end dates.';
  if (customStart > customEnd) return 'The end date must be on or after the start date.';
  return '';
}

const ExpenseReportFilters = ({
  filters,
  onFilterChange,
  offices = [],
  categories = [],
  departments = [],
  onApply,
  onReset,
}) => {
  const [expanded, setExpanded] = useState(true);
  const dateError = getExpenseDateError(filters);

  const handleChange = useCallback((key, value) => {
    onFilterChange(prev => ({ ...prev, [key]: value }));
  }, [onFilterChange]);

  const officeOptions = offices?.length > 0 ? offices : OFFICES;

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <Icon name="SlidersHorizontal" size={15} className="text-primary" />
          Filters
        </span>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground" />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {/* Date Preset */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Period</label>
            <select
              value={filters?.datePreset || 'this_year'}
              onChange={e => handleChange('datePreset', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PRESET_RANGES?.map(p => (
                <option key={p?.value} value={p?.value}>{p?.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {filters?.datePreset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                <input
                  type="date"
                  value={filters?.customStart || ''}
                  onChange={e => handleChange('customStart', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                <input
                  type="date"
                  value={filters?.customEnd || ''}
                  onChange={e => handleChange('customEnd', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Office */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Office</label>
            <select
              value={filters?.office || 'All Offices'}
              onChange={e => handleChange('office', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {officeOptions?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
            <select
              value={filters?.department || 'All'}
              onChange={e => handleChange('department', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Departments</option>
              {departments?.map(d => <option key={d?.id || d?.name} value={d?.name}>{d?.name}</option>)}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={filters?.category || 'All'}
              onChange={e => handleChange('category', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Categories</option>
              {categories?.filter(c => !c?.parent_category_id)?.map(c => (
                <option key={c?.id} value={c?.name}>{c?.name}</option>
              ))}
            </select>
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
            <select
              value={filters?.sourceType || 'All Sources'}
              onChange={e => handleChange('sourceType', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SOURCE_TYPES?.map(s => (
                <option key={s} value={s}>{SOURCE_LABELS?.[s] || s}</option>
              ))}
            </select>
          </div>

          {/* Payment Source */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Source</label>
            <select
              value={filters?.paymentSource || 'All'}
              onChange={e => handleChange('paymentSource', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PAYMENT_SOURCES?.map(p => <option key={p} value={p}>{p === 'All' ? 'All Payment Sources' : p?.charAt(0)?.toUpperCase() + p?.slice(1)}</option>)}
            </select>
          </div>

          {/* Cardholder */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cardholder</label>
            <input
              type="text"
              placeholder="Search cardholder..."
              value={filters?.cardholderName || ''}
              onChange={e => handleChange('cardholderName', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor / Merchant</label>
            <input
              type="text"
              placeholder="Search merchant..."
              value={filters?.merchantName || ''}
              onChange={e => handleChange('merchantName', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={filters?.status || 'All'}
              onChange={e => handleChange('status', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUSES?.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s?.charAt(0)?.toUpperCase() + s?.slice(1)}</option>)}
            </select>
          </div>

          {dateError && <p role="alert" className="text-xs text-destructive">{dateError}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onApply}
              disabled={!!dateError}
              className="flex-1 bg-primary text-primary-foreground text-xs font-medium py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
            <button
              onClick={onReset}
              className="flex-1 bg-muted text-muted-foreground text-xs font-medium py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseReportFilters;
