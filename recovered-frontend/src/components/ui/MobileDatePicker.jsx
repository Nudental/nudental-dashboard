import React, { useState } from 'react';
import Icon from '../AppIcon';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MobileDatePicker = ({ value, onChange, error, min, max }) => {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [year, setYear] = useState(parsed?.getFullYear());
  const [month, setMonth] = useState(parsed?.getMonth());
  const [day, setDay] = useState(parsed?.getDate());

  const daysInMonth = new Date(year, month + 1, 0)?.getDate();

  const handleConfirm = () => {
    const d = Math.min(day, daysInMonth);
    const dateStr = `${year}-${String(month + 1)?.padStart(2, '0')}-${String(d)?.padStart(2, '0')}`;
    onChange?.(dateStr);
    setOpen(false);
  };

  const displayValue = value
    ? new Date(value + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date…';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          error ? 'border-red-400' : 'border-border'
        }`}
        style={{ minHeight: '52px' }}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{displayValue}</span>
        <Icon name="Calendar" size={20} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-[600] p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-foreground">Select Date</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted">
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Month selector */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Month</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS?.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonth(i)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    month === i ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Day selector */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Day</p>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1)?.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    day === d ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Year selector */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Year</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setYear(y => y - 1)} className="p-2 rounded-lg bg-muted hover:bg-muted/80" style={{ minWidth: 44, minHeight: 44 }}>
                <Icon name="ChevronLeft" size={18} />
              </button>
              <span className="flex-1 text-center text-lg font-bold text-foreground">{year}</span>
              <button type="button" onClick={() => setYear(y => y + 1)} className="p-2 rounded-lg bg-muted hover:bg-muted/80" style={{ minWidth: 44, minHeight: 44 }}>
                <Icon name="ChevronRight" size={18} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-semibold"
          >
            Confirm — {MONTHS?.[month]} {Math.min(day, daysInMonth)}, {year}
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileDatePicker;
