/**
 * FinancialDatePicker.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact custom date picker for Financial Analytics filter bars.
 * Opens directly to the currently selected month/year — no scrolling required.
 * Matches the UX of the Expense Report MobileDatePicker but sized for sidebars.
 *
 * Props:
 *   value       — ISO string YYYY-MM-DD (API format)
 *   onChange    — called with ISO string YYYY-MM-DD
 *   label       — optional label string
 *   min         — ISO string YYYY-MM-DD (optional, disables earlier days)
 *   max         — ISO string YYYY-MM-DD (optional, disables later days)
 *   error       — boolean or string (shows red border)
 *   placeholder — string (default 'MM/DD/YYYY')
 *   className   — extra wrapper class
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../../components/AppIcon';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL  = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

// Parse ISO date string safely — avoids timezone shift
const parseISO = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso?.split('-');
  if (parts?.length !== 3) return null;
  const y = parseInt(parts?.[0], 10);
  const m = parseInt(parts?.[1], 10) - 1;
  const d = parseInt(parts?.[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m, day: d };
};

// Format ISO → MM/DD/YYYY for display
const formatDisplay = (iso) => {
  const p = parseISO(iso);
  if (!p) return '';
  return `${String(p?.month + 1)?.padStart(2, '0')}/${String(p?.day)?.padStart(2, '0')}/${p?.year}`;
};

// Build ISO string from parts
const toISO = (year, month, day) =>
  `${year}-${String(month + 1)?.padStart(2, '0')}-${String(day)?.padStart(2, '0')}`;

const FinancialDatePicker = ({
  value,
  onChange,
  label,
  min,
  max,
  error,
  placeholder = 'MM/DD/YYYY',
  className = '',
}) => {
  const today = new Date();
  const getInitial = () => {
    const p = parseISO(value);
    if (p) return p;
    return { year: today?.getFullYear(), month: today?.getMonth(), day: today?.getDate() };
  };

  const [open, setOpen] = useState(false);
  const [year, setYear]   = useState(() => getInitial()?.year);
  const [month, setMonth] = useState(() => getInitial()?.month);
  const [day, setDay]     = useState(() => getInitial()?.day);
  const containerRef = useRef(null);

  // When value prop changes externally, sync picker state so it opens to correct month
  useEffect(() => {
    const p = parseISO(value);
    if (p) {
      setYear(p?.year);
      setMonth(p?.month);
      setDay(p?.day);
    } else {
      const t = new Date();
      setYear(t?.getFullYear());
      setMonth(t?.getMonth());
      setDay(t?.getDate());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef?.current && !containerRef?.current?.contains(e?.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const daysInMonth = new Date(year, month + 1, 0)?.getDate();
  const safeDay = Math.min(day, daysInMonth);

  const isDayDisabled = useCallback((d) => {
    const iso = toISO(year, month, d);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }, [year, month, min, max]);

  const handleDaySelect = useCallback((d) => {
    if (isDayDisabled(d)) return;
    const iso = toISO(year, month, d);
    setDay(d);
    onChange?.(iso);
    setOpen(false);
  }, [year, month, isDayDisabled, onChange]);

  const handleMonthSelect = (m) => {
    setMonth(m);
    // Don't auto-close — user still needs to pick a day
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const displayValue = value ? formatDisplay(value) : '';
  const selectedParsed = parseISO(value);
  const isSelectedInView = selectedParsed?.year === year && selectedParsed?.month === month;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-9 w-full flex items-center justify-between rounded-lg border ${
          error ? 'border-red-400' : 'border-border'
        } bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/40 transition-colors`}
      >
        <span className={displayValue ? 'text-foreground text-sm' : 'text-muted-foreground text-xs'}>
          {displayValue || placeholder}
        </span>
        <Icon name="Calendar" size={14} className="text-muted-foreground flex-shrink-0 ml-2" />
      </button>
      {/* Dropdown calendar — opens to selected month immediately */}
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-[700] p-3 w-[264px]">

          {/* Month + Year navigation header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <Icon name="ChevronLeft" size={14} />
            </button>
            <span className="text-sm font-semibold text-foreground select-none">
              {MONTHS_FULL?.[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <Icon name="ChevronRight" size={14} />
            </button>
          </div>

          {/* Year quick-nav */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setYear(y => y - 1)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-colors"
            >
              {year - 1}
            </button>
            <span className="text-sm font-bold text-foreground w-12 text-center">{year}</span>
            <button
              type="button"
              onClick={() => setYear(y => y + 1)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-colors"
            >
              {year + 1}
            </button>
          </div>

          {/* Month grid — highlights currently selected month */}
          <div className="grid grid-cols-4 gap-1 mb-2">
            {MONTHS_SHORT?.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => handleMonthSelect(i)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  month === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-primary/10 text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1)?.map((d) => {
              const disabled = isDayDisabled(d);
              const isSelected = isSelectedInView && d === selectedParsed?.day;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDaySelect(d)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : disabled
                      ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                      : 'hover:bg-primary/10 text-foreground'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {displayValue || 'No date selected'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDatePicker;
