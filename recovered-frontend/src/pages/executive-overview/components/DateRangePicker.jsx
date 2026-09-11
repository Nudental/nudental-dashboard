import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const DateRangePicker = ({ selectedRange, onRangeChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const ranges = [
    { value: 'today', label: 'Today', icon: 'Calendar' },
    { value: 'week', label: 'This Week', icon: 'CalendarDays' },
    { value: 'month', label: 'This Month', icon: 'CalendarRange' },
    { value: 'last_month', label: 'Last Month', icon: 'CalendarMinus' },
    { value: 'quarter', label: 'This Quarter', icon: 'CalendarClock' },
    { value: 'year', label: 'This Year', icon: 'CalendarCheck' },
  ];

  const handleRangeSelect = (range) => {
    onRangeChange(range);
    setIsOpen(false);
  };

  const currentRange = ranges?.find(r => r?.value === selectedRange);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-smooth focus-ring"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon name={currentRange?.icon || 'Calendar'} size={16} />
        <span className="hidden sm:inline">{currentRange?.label || 'Select Range'}</span>
        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground" />
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[190]" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-elevation-3 z-[200]">
            <div className="p-2">
              {ranges?.map((range) => (
                <button
                  key={range?.value}
                  onClick={() => handleRangeSelect(range?.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-smooth ${
                    selectedRange === range?.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-popover-foreground hover:bg-muted'
                  }`}
                >
                  <Icon name={range?.icon} size={16} />
                  <span>{range?.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;