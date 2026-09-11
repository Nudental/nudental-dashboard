import React, { useState, useRef, useEffect } from 'react';
import Icon from './AppIcon';
import { useYearComparison } from '../contexts/YearComparisonContext';

/**
 * YearPicker — a dropdown that lets users select 1–3 years for comparison.
 * Integrates with YearComparisonContext.
 */
const YearPicker = () => {
  const {
    availableYears,
    yearsLoading,
    selectedYears,
    isComparisonMode,
    isYearFilterActive,
    toggleYear,
    resetYears,
    getYearColor,
  } = useYearComparison();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getLabel = () => {
    if (yearsLoading) return 'Loading years…';
    if (!isYearFilterActive) return 'Compare Years';
    if (selectedYears?.length === 1) return `Year: ${selectedYears?.[0]}`;
    return `${selectedYears?.length} Years Selected`;
  };

  const buttonClass = `flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm border rounded-lg transition-colors whitespace-nowrap ${
    isYearFilterActive
      ? 'border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/15' :'border-border bg-card text-foreground hover:bg-muted'
  }`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className={buttonClass}>
        <Icon name="CalendarRange" size={15} className={isYearFilterActive ? 'text-primary' : 'text-muted-foreground'} />
        <span className="font-medium">{getLabel()}</span>
        {isYearFilterActive && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
            {selectedYears?.length}
          </span>
        )}
        <Icon name="ChevronDown" size={13} className={isYearFilterActive ? 'text-primary' : 'text-muted-foreground'} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-elevation-3 z-[190] w-64">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div>
                <p className="text-xs font-semibold text-foreground">Compare Years</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Select up to 3 years</p>
              </div>
              {isYearFilterActive && (
                <button
                  onClick={() => { resetYears(); setOpen(false); }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                >
                  <Icon name="X" size={10} />
                  Reset
                </button>
              )}
            </div>

            {/* Comparison mode badge */}
            {isComparisonMode && (
              <div className="mx-3 mt-2 flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
                <Icon name="GitCompare" size={12} className="text-primary flex-shrink-0" />
                <p className="text-[10px] font-medium text-primary">
                  Year-over-year comparison active
                </p>
              </div>
            )}

            {/* Year list */}
            <div className="py-2 max-h-64 overflow-y-auto">
              {yearsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Icon name="Loader2" size={16} className="text-muted-foreground animate-spin" />
                </div>
              ) : availableYears?.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-3 text-center">No year data available</p>
              ) : (
                availableYears?.map(year => {
                  const isSelected = selectedYears?.includes(year);
                  const isDisabled = !isSelected && selectedYears?.length >= 3;
                  const color = isSelected ? getYearColor(year) : null;

                  return (
                    <button
                      key={year}
                      onClick={() => !isDisabled && toggleYear(year)}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                        isDisabled
                          ? 'opacity-40 cursor-not-allowed' :'hover:bg-muted cursor-pointer'
                      } ${isSelected ? 'bg-muted/50' : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors`}
                          style={isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
                        >
                          {isSelected && <Icon name="Check" size={10} color="white" />}
                        </span>
                        <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                          {year}
                        </span>
                      </div>
                      {isSelected && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          Y{selectedYears?.indexOf(year) + 1}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-border bg-muted/20 rounded-b-xl">
              <p className="text-[10px] text-muted-foreground text-center">
                {isYearFilterActive
                  ? `${selectedYears?.length}/3 years selected · Click Reset to return to default`
                  : 'Select years to enable comparison mode'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default YearPicker;
