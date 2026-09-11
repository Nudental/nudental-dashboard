import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const PRESETS = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Q1 2026', value: 'q1_2026' },
  { label: 'Q2 2026', value: 'q2_2026' },
  { label: 'Q3 2026', value: 'q3_2026' },
  { label: 'Q4 2026', value: 'q4_2026' },
  { label: 'YTD 2026', value: 'ytd_2026' },
  { label: 'Full Year 2025', value: 'fy_2025' },
  { label: 'Custom Range', value: 'custom' },
];

const ReportsDateFilter = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = PRESETS?.find(p => p?.value === value) || PRESETS?.[6];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-muted/50 transition-smooth min-w-[160px]"
      >
        <Icon name="Calendar" size={15} className="text-muted-foreground" />
        <span className="flex-1 text-left">{selected?.label}</span>
        <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-elevation-3 z-50 py-1">
          {PRESETS?.map(preset => (
            <button
              key={preset?.value}
              onClick={() => { onChange(preset?.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-smooth hover:bg-muted/50 ${
                value === preset?.value ? 'text-primary font-medium bg-primary/5' : 'text-foreground'
              }`}
            >
              {preset?.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsDateFilter;
