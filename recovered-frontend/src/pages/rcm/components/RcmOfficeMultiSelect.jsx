/**
 * RcmOfficeMultiSelect.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * V457 — RCM true multi-office selector
 *
 * State model:
 *   selectedOfficeIds: []          → All Offices
 *   selectedOfficeIds: [id]        → single office
 *   selectedOfficeIds: [id1, id2]  → subset (2 offices)
 *   selectedOfficeIds: [id1..id4]  → normalized to [] (All Offices)
 *
 * Behavior:
 *   - Selecting all 4 individual offices normalizes to [] (All Offices)
 *   - Cannot deselect the last office — prevented silently
 *   - "All Offices" toggle selects/deselects all
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';

// ─── Office definitions (must match constants/offices.js) ────────────────────
export const RCM_OFFICES = [
  { id: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', name: 'Barnegat',      color: '#EF4444' },
  { id: '54626997-57c2-4934-8743-1dabb4d176f4', name: 'Brick',         color: '#F59E0B' },
  { id: '220372a5-afae-49c9-8a0c-f4c0717ff352', name: 'Eatontown',     color: '#00B5CC' },
  { id: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', name: 'Staten Island', color: '#6ECEB2' },
];

const ALL_OFFICE_IDS = RCM_OFFICES?.map(o => o?.id);

/**
 * Normalize selectedOfficeIds:
 *   - if all 4 are selected → return [] (All Offices)
 *   - otherwise return the array as-is
 */
export const normalizeOfficeIds = (ids) => {
  if (!ids || ids?.length === 0) return [];
  if (ids?.length >= ALL_OFFICE_IDS?.length) return [];
  return [...ids];
};

/**
 * Derive display label from selectedOfficeIds.
 */
export const getOfficeSelectionLabel = (selectedOfficeIds) => {
  if (!selectedOfficeIds || selectedOfficeIds?.length === 0) return 'All Offices';
  if (selectedOfficeIds?.length === 1) {
    const office = RCM_OFFICES?.find(o => o?.id === selectedOfficeIds?.[0]);
    return office?.name || 'Office';
  }
  if (selectedOfficeIds?.length === 2) return '2 Offices Selected';
  if (selectedOfficeIds?.length === 3) return '3 Offices Selected';
  return 'All Offices';
};

/**
 * Returns true when selectedOfficeIds represents All Offices.
 */
export const isAllOfficesSelected = (selectedOfficeIds) =>
  !selectedOfficeIds || selectedOfficeIds?.length === 0;

// ─── Pill component ───────────────────────────────────────────────────────────
const OfficePill = ({ office, onRemove }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap"
    style={{ backgroundColor: office?.color }}
  >
    {office?.name}
    <button
      type="button"
      onClick={(e) => { e?.stopPropagation(); onRemove(office?.id); }}
      className="ml-0.5 hover:opacity-75 transition-opacity leading-none"
      aria-label={`Remove ${office?.name}`}
    >
      <Icon name="X" size={10} />
    </button>
  </span>
);

// ─── Main component ───────────────────────────────────────────────────────────
const RcmOfficeMultiSelect = ({ selectedOfficeIds = [], onChange, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef?.current && !containerRef?.current?.contains(e?.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAllOffices = isAllOfficesSelected(selectedOfficeIds);
  const label = getOfficeSelectionLabel(selectedOfficeIds);

  // Toggle a single office
  const toggleOffice = useCallback((officeId) => {
    if (isAllOffices) {
      // Currently All Offices → select only this one office
      onChange(normalizeOfficeIds([officeId]));
      return;
    }
    const current = [...selectedOfficeIds];
    const idx = current?.indexOf(officeId);
    if (idx === -1) {
      // Add
      const next = normalizeOfficeIds([...current, officeId]);
      onChange(next);
    } else {
      // Remove — prevent zero selection
      if (current?.length === 1) return; // can't deselect last
      const next = normalizeOfficeIds(current?.filter(id => id !== officeId));
      onChange(next);
    }
  }, [selectedOfficeIds, isAllOffices, onChange]);

  // Toggle All Offices
  const toggleAllOffices = useCallback(() => {
    if (isAllOffices) {
      // Already All Offices — no-op (can't deselect all)
      return;
    }
    // Switch to All Offices
    onChange([]);
  }, [isAllOffices, onChange]);

  // Remove a pill (same as toggleOffice but called from pill X)
  const removePill = useCallback((officeId) => {
    if (selectedOfficeIds?.length === 1) return; // prevent zero
    const next = normalizeOfficeIds(selectedOfficeIds?.filter(id => id !== officeId));
    onChange(next);
  }, [selectedOfficeIds, onChange]);

  const selectedOffices = RCM_OFFICES?.filter(o => selectedOfficeIds?.includes(o?.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 min-w-[160px] max-w-[320px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon name="Building2" size={14} className="text-muted-foreground flex-shrink-0" />

        {/* Label / pills */}
        <span className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
          {isAllOffices ? (
            <span className="text-foreground truncate">All Offices</span>
          ) : selectedOffices?.length === 1 ? (
            <span className="text-foreground truncate">{selectedOffices?.[0]?.name}</span>
          ) : (
            <>
              {selectedOffices?.map(o => (
                <OfficePill key={o?.id} office={o} onRemove={removePill} />
              ))}
            </>
          )}
        </span>

        <Icon
          name={open ? 'ChevronUp' : 'ChevronDown'}
          size={14}
          className="text-muted-foreground flex-shrink-0 ml-auto"
        />
      </button>
      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px]">
          {/* All Offices row */}
          <button
            type="button"
            onClick={toggleAllOffices}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors ${isAllOffices ? 'font-semibold text-primary' : 'text-foreground'}`}
          >
            <span
              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isAllOffices
                  ? 'bg-primary border-primary' :'border-border bg-card'
              }`}
            >
              {isAllOffices && <Icon name="Check" size={10} className="text-primary-foreground" />}
            </span>
            <span>All Offices</span>
            {isAllOffices && (
              <span className="ml-auto text-xs text-muted-foreground">4 offices</span>
            )}
          </button>

          <div className="border-t border-border my-1" />

          {/* Individual offices */}
          {RCM_OFFICES?.map(office => {
            const checked = isAllOffices
              ? false // when All Offices, individual checkboxes are unchecked
              : selectedOfficeIds?.includes(office?.id);

            return (
              <button
                key={office?.id}
                type="button"
                onClick={() => toggleOffice(office?.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors text-foreground"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked
                      ? 'border-transparent' :'border-border bg-card'
                  }`}
                  style={checked ? { backgroundColor: office?.color, borderColor: office?.color } : {}}
                >
                  {checked && <Icon name="Check" size={10} className="text-white" />}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: office?.color }}
                />
                <span>{office?.name}</span>
              </button>
            );
          })}

          {/* Footer hint for subset */}
          {!isAllOffices && selectedOfficeIds?.length > 0 && selectedOfficeIds?.length < 4 && (
            <div className="border-t border-border mt-1 px-4 py-2">
              <p className="text-xs text-muted-foreground">
                {selectedOfficeIds?.length === 1
                  ? '1 office selected'
                  : `${selectedOfficeIds?.length} offices selected`}
                {' · '}
                <button
                  type="button"
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="text-primary hover:underline"
                >
                  Reset to All
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RcmOfficeMultiSelect;
