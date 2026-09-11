import React from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const TimeRangePicker = ({
  selectedRange,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  customRangeError,
}) => {
  const timeRanges = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter (Q1 2026)' },
    { value: 'last_quarter', label: 'Last Quarter (Q4 2025)' },
    { value: 'this_year', label: 'This Year (2026)' },
    { value: 'last_year', label: 'Last Year (2025)' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const isCustom = selectedRange === 'custom';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Icon name="Calendar" size={20} color="var(--color-primary)" />
        <Select
          options={timeRanges}
          value={selectedRange}
          onChange={onRangeChange}
          placeholder="Select Time Range"
          className="min-w-[180px]"
        />
      </div>
      {isCustom && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pl-8">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Start Date
            </label>
            <input
              type="date"
              value={customStart || ''}
              onChange={(e) => onCustomStartChange?.(e?.target?.value)}
              max={customEnd || undefined}
              className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">—</span>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              End Date
            </label>
            <input
              type="date"
              value={customEnd || ''}
              onChange={(e) => onCustomEndChange?.(e?.target?.value)}
              min={customStart || undefined}
              className="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {customStart && customEnd && !customRangeError && (
            <span className="text-xs text-muted-foreground">
              {customStart} → {customEnd}
            </span>
          )}
          {customRangeError && (
            <span className="text-xs text-destructive font-medium flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />
              {customRangeError}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeRangePicker;