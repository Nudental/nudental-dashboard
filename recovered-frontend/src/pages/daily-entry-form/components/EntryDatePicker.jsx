import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const EntryDatePicker = ({ value, onChange, disabled }) => {
  const [showCalendar, setShowCalendar] = useState(false);

  const formatDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDateChange = (e) => {
    onChange(e?.target?.value);
    setShowCalendar(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-foreground mb-2">
        <span className="flex items-center gap-2">
          <Icon name="Calendar" size={16} color="var(--color-primary)" />
          Entry Date
        </span>
      </label>
      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={handleDateChange}
          disabled={disabled}
          max={new Date()?.toISOString()?.split('T')?.[0]}
          className="w-full px-4 py-3 pr-10 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon name="CalendarDays" size={16} color="var(--color-muted-foreground)" />
        </div>
      </div>
      {value && (
        <p className="mt-1 text-xs text-muted-foreground">{formatDisplay(value)}</p>
      )}
    </div>
  );
};

export default EntryDatePicker;
