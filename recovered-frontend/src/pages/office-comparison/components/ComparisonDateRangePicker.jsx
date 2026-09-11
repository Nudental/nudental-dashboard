import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const PRESETS = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'ytd', label: 'Year to Date' },
  { id: 'custom', label: 'Custom Range' },
];

const ComparisonDateRangePicker = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePreset = (id) => {
    if (id === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange({ preset: id, startDate: null, endDate: null });
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({ preset: 'custom', startDate: customStart, endDate: customEnd });
      setShowCustom(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
        {PRESETS?.map(preset => (
          <button
            key={preset?.id}
            onClick={() => handlePreset(preset?.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
              value?.preset === preset?.id
                ? 'bg-card text-foreground shadow-elevation-1'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {preset?.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Icon name="Calendar" size={14} color="var(--color-muted-foreground)" />
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e?.target?.value)}
            className="text-sm bg-transparent border-none outline-none text-foreground"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e?.target?.value)}
            className="text-sm bg-transparent border-none outline-none text-foreground"
          />
          <button
            onClick={handleCustomApply}
            className="ml-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-smooth"
          >
            Apply
          </button>
          <button
            onClick={() => setShowCustom(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ComparisonDateRangePicker;
