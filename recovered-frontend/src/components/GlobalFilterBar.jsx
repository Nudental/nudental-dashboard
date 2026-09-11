import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './AppIcon';
import YearPicker from './YearPicker';
import { filterPresetsService } from '../services/filterPresetsService';

// ─── Date Range Presets ───────────────────────────────────────────────────────

export const DATE_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'ytd', label: 'YTD' },
  { value: 'custom', label: 'Custom Date Range' },
];

// ─── Custom Date Range Picker ─────────────────────────────────────────────────

const CustomDateRangePicker = ({ customStartDate, customEndDate, onApply, onCancel }) => {
  const [start, setStart] = useState(customStartDate || '');
  const [end, setEnd] = useState(customEndDate || '');
  const [error, setError] = useState('');

  const validate = () => {
    if (!start) { setError('Start date is required.'); return false; }
    if (!end) { setError('End date is required.'); return false; }
    if (start > end) { setError('Start date must be on or before end date.'); return false; }
    setError('');
    return true;
  };

  const handleApply = () => {
    if (!validate()) return;
    onApply(start, end);
  };

  return (
    <div className="p-3 space-y-3 min-w-[260px]">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Date Range</p>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
          <input
            type="date"
            value={start}
            onChange={e => { setStart(e?.target?.value); setError(''); }}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={e => { setEnd(e?.target?.value); setError(''); }}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          />
        </div>
      </div>
      {error && <p className="text-xs text-error font-medium">{error}</p>}
      {start && end && !error && start <= end && (
        <p className="text-xs text-primary font-medium">
          {start} → {end}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-3 py-1.5 text-sm font-semibold text-white rounded-md transition-colors"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

// ─── Date Range Dropdown ──────────────────────────────────────────────────────

const DateRangeDropdown = ({ value, customStartDate, customEndDate, onChange, onCustomApply }) => {
  const [open, setOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref?.current && !ref?.current?.contains(e?.target)) { setOpen(false); setShowCustomPicker(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = DATE_PRESETS?.find(p => p?.value === value) || DATE_PRESETS?.[0];

  // Build display label
  let displayLabel = current?.label;
  if (value === 'custom' && customStartDate && customEndDate) {
    displayLabel = `${customStartDate} → ${customEndDate}`;
  }

  const handlePresetClick = (preset) => {
    if (preset?.value === 'custom') {
      setShowCustomPicker(true);
    } else {
      onChange(preset?.value);
      setOpen(false);
      setShowCustomPicker(false);
    }
  };

  const handleCustomApply = (start, end) => {
    onCustomApply(start, end);
    setOpen(false);
    setShowCustomPicker(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); setShowCustomPicker(false); }}
        className="flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap max-w-[220px]"
      >
        <Icon name="Calendar" size={15} className="text-muted-foreground flex-shrink-0" />
        <span className="font-medium truncate">{displayLabel}</span>
        <Icon name="ChevronDown" size={13} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => { setOpen(false); setShowCustomPicker(false); }} />
          <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-elevation-3 z-[190] py-1 min-w-[200px]">
            {!showCustomPicker ? (
              <>
                {DATE_PRESETS?.map(p => (
                  <button
                    key={p?.value}
                    onClick={() => handlePresetClick(p)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${
                      value === p?.value ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'
                    }`}
                  >
                    {value === p?.value && p?.value !== 'custom' && <Icon name="Check" size={13} className="text-primary flex-shrink-0" />}
                    {(value !== p?.value || p?.value === 'custom') && <span className="w-[13px]" />}
                    {p?.label}
                    {p?.value === 'custom' && <Icon name="ChevronRight" size={13} className="text-muted-foreground ml-auto" />}
                  </button>
                ))}
              </>
            ) : (
              <CustomDateRangePicker
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onApply={handleCustomApply}
                onCancel={() => setShowCustomPicker(false)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Location Multi-Select ────────────────────────────────────────────────────

const LocationDropdown = ({ offices, selectedIds, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(Array.isArray(selectedIds) ? selectedIds : []);
  const ref = useRef(null);

  useEffect(() => { setPending(Array.isArray(selectedIds) ? selectedIds : []); }, [selectedIds]);

  useEffect(() => {
    const handler = (e) => { if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const safeOffices = Array.isArray(offices) ? offices : [];
  const filtered = safeOffices?.filter(o => o?.name?.toLowerCase()?.includes(search?.toLowerCase()));

  const toggleOffice = (id) => {
    setPending(prev => {
      const safe = Array.isArray(prev) ? prev : [];
      return safe?.includes(id) ? safe?.filter(x => x !== id) : [...safe, id];
    });
  };

  const toggleAll = () => {
    if (pending?.length === safeOffices?.length) setPending([]);
    else setPending(safeOffices?.map(o => o?.id));
  };

  const handleApply = () => { onChange(pending); setOpen(false); };
  const handleCancel = () => { setPending(Array.isArray(selectedIds) ? selectedIds : []); setOpen(false); };

  const safePending = Array.isArray(pending) ? pending : [];
  const label = safePending?.length === 0
    ? 'All Locations'
    : safePending?.length === 1
      ? safeOffices?.find(o => o?.id === safePending?.[0])?.name || '1 Location'
      : `${safePending?.length} Locations`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
      >
        <Icon name="Building2" size={15} className="text-muted-foreground flex-shrink-0" />
        <span className="font-medium">{label}</span>
        <Icon name="ChevronDown" size={13} className="text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={handleCancel} />
          <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-elevation-3 z-[190] w-72">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md">
                <Icon name="Search" size={13} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={search}
                  onChange={e => setSearch(e?.target?.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Locations</span>
              <button onClick={toggleAll} className="text-xs text-primary font-medium hover:underline">
                {safePending?.length === safeOffices?.length ? 'Clear' : 'All'}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered?.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">No locations found</p>
              ) : (
                filtered?.map(o => (
                  <button
                    key={o?.id}
                    onClick={() => toggleOffice(o?.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      safePending?.includes(o?.id) ? 'bg-primary border-primary' : 'border-border bg-card'
                    }`}>
                      {safePending?.includes(o?.id) && <Icon name="Check" size={10} color="white" />}
                    </span>
                    <span className="text-foreground">{o?.name}</span>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-3 py-2 border-t border-border bg-muted/20">
              <button onClick={handleCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button
                onClick={handleApply}
                className="px-4 py-1.5 text-sm font-semibold text-white rounded-md transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── View By Dropdown ─────────────────────────────────────────────────────────
// Only Location and Provider Type — Month removed (not wired)

export const VIEW_BY_OPTIONS = [
  { value: 'location', label: 'Location', wired: true },
  { value: 'provider_type', label: 'Provider Type', wired: true },
];

const ViewByDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = VIEW_BY_OPTIONS?.find(o => o?.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
      >
        <Icon name="LayoutGrid" size={15} className="text-muted-foreground flex-shrink-0" />
        <span className="font-medium">VIEW BY{current ? `: ${current?.label}` : ''}</span>
        <Icon name="ChevronDown" size={13} className="text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-elevation-3 z-[190] py-1">
            {VIEW_BY_OPTIONS?.map(o => (
              <button
                key={o?.value}
                onClick={() => { onChange(o?.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  value === o?.value
                    ? 'text-primary font-semibold bg-primary/5 hover:bg-primary/10' :'text-foreground hover:bg-muted'
                }`}
              >
                {value === o?.value && <Icon name="Check" size={13} className="text-primary flex-shrink-0" />}
                {value !== o?.value && <span className="w-[13px]" />}
                <span className="flex-1">{o?.label}</span>
              </button>
            ))}
            <div className="px-3 py-2 border-t border-border mt-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Location</span> and <span className="font-semibold text-foreground">Provider Type</span> are wired to Dentrix data.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Line of Business options (empty — LOB not wired globally) ────────────────
export const LOB_OPTIONS = [];

// ─── Saved Presets Dropdown ───────────────────────────────────────────────────

const SavedPresetsDropdown = ({ currentFilters, onLoadPreset }) => {
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState([]);
  const [savedMsg, setSavedMsg] = useState(false);
  const ref = useRef(null);

  const loadPresets = useCallback(() => {
    try {
      setPresets(filterPresetsService?.getAll() || []);
    } catch (e) {
      console.warn('[SavedPresetsDropdown] getAll error:', e);
      setPresets([]);
    }
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  useEffect(() => {
    const handler = (e) => { if (ref?.current && !ref?.current?.contains(e?.target)) { setOpen(false); setShowSave(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSave = () => {
    if (!presetName?.trim()) return;
    try {
      filterPresetsService?.save(presetName?.trim(), currentFilters);
      loadPresets();
      setPresetName('');
      setShowSave(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      console.warn('[SavedPresetsDropdown] save error:', e);
    }
  };

  const handleDelete = (e, id) => {
    e?.stopPropagation();
    try {
      filterPresetsService?.delete(id);
      loadPresets();
    } catch (e) {
      console.warn('[SavedPresetsDropdown] delete error:', e);
    }
  };

  const handleLoad = (preset) => {
    try {
      if (!preset || !preset?.filters || typeof preset?.filters !== 'object') {
        console.warn('[SavedPresetsDropdown] invalid preset object:', preset);
        setOpen(false);
        return;
      }
      onLoadPreset?.(preset?.filters);
    } catch (e) {
      console.warn('[SavedPresetsDropdown] load error:', e);
    }
    setOpen(false);
  };

  const formatDate = (iso) => {
    try { return new Date(iso)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  const getPresetSummary = (f) => {
    try {
      const parts = [];
      const dateLabel = DATE_PRESETS?.find(p => p?.value === f?.datePreset)?.label;
      if (dateLabel) parts?.push(dateLabel);
      const officeIds = Array.isArray(f?.selectedOfficeIds) ? f?.selectedOfficeIds : [];
      if (officeIds?.length > 0) parts?.push(`${officeIds?.length} office${officeIds?.length > 1 ? 's' : ''}`);
      const lob = Array.isArray(f?.lineOfBusiness) ? f?.lineOfBusiness : [];
      if (lob?.length > 0) parts?.push(lob?.join(', '));
      return parts?.join(' · ') || 'All filters';
    } catch { return 'All filters'; }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => { setShowSave(true); setOpen(true); }}
          title="Save current filters as preset"
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-sm border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          <Icon name="BookmarkPlus" size={15} className="text-muted-foreground flex-shrink-0" />
          <span className="font-medium hidden sm:inline">Save View</span>
        </button>
        <button
          onClick={() => { setShowSave(false); setOpen(v => !v); }}
          title="Load a saved filter preset"
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-sm border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          <Icon name="FolderOpen" size={15} className="text-muted-foreground flex-shrink-0" />
          <span className="font-medium hidden sm:inline">Load View</span>
          {presets?.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary">{presets?.length}</span>
          )}
          <Icon name="ChevronDown" size={13} className="text-muted-foreground" />
        </button>
      </div>
      {savedMsg && (
        <div className="absolute right-0 top-full mt-1 z-[200] px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-xs text-success font-medium flex items-center gap-1.5 whitespace-nowrap shadow-sm">
          <Icon name="CheckCircle" size={13} />
          Preset saved!
        </div>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => { setOpen(false); setShowSave(false); }} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-popover border border-border rounded-xl shadow-elevation-3 z-[190] overflow-hidden">
            {showSave && (
              <div className="p-3 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Save Current Filters</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Preset name (e.g. Q1 Hygiene)"
                    value={presetName}
                    onChange={e => setPresetName(e?.target?.value)}
                    onKeyDown={e => e?.key === 'Enter' && handleSave()}
                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={!presetName?.trim()}
                    className="px-3 py-1.5 text-sm font-semibold text-white rounded-md disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Saves: {getPresetSummary(currentFilters)}</p>
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1.5">
                Saved Presets {presets?.length > 0 && `(${presets?.length})`}
              </p>
              {presets?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Icon name="Bookmark" size={28} className="mb-2 opacity-40" />
                  <p className="text-xs">No saved presets yet.</p>
                  <p className="text-xs">Configure filters and click "Save View".</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {presets?.map(preset => (
                    <div
                      key={preset?.id}
                      onClick={() => handleLoad(preset)}
                      className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer group transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{preset?.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{getPresetSummary(preset?.filters)}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDate(preset?.savedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Load</span>
                        <button
                          onClick={(e) => handleDelete(e, preset?.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete preset"
                        >
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── buildSafeFilters helper ──────────────────────────────────────────────────
// V241: Normalize all filter values before calling onFiltersChange.
// Ensures backward compatibility across all dashboard pages.

const buildSafeFilters = ({
  datePreset,
  selectedOfficeIds,
  lineOfBusiness,
  viewBy,
  customStartDate,
  customEndDate,
}) => {
  // Normalize selectedOfficeIds — always an array
  const safeOfficeIds = Array.isArray(selectedOfficeIds) ? selectedOfficeIds : [];

  // Normalize lineOfBusiness — scalar string → array, always an array
  let safeLOB = [];
  if (Array.isArray(lineOfBusiness)) safeLOB = lineOfBusiness;
  else if (typeof lineOfBusiness === 'string' && lineOfBusiness) safeLOB = [lineOfBusiness];

  // Normalize viewBy — default to 'location'
  const safeViewBy = viewBy || 'location';

  // Normalize datePreset — default to 'last_month'
  const safeDatePreset = datePreset || 'last_month';

  // Custom dates — only include when preset is 'custom'
  const safeCustomStart = safeDatePreset === 'custom' ? (customStartDate || null) : null;
  const safeCustomEnd = safeDatePreset === 'custom' ? (customEndDate || null) : null;

  return {
    datePreset: safeDatePreset,
    selectedOfficeIds: safeOfficeIds,
    lineOfBusiness: safeLOB,
    viewBy: safeViewBy,
    customStartDate: safeCustomStart,
    customEndDate: safeCustomEnd,
  };
};

// ─── GlobalFilterBar ──────────────────────────────────────────────────────────

/**
 * GlobalFilterBar
 * Props:
 *   offices: [{id, name}]
 *   filters: { datePreset, selectedOfficeIds, lineOfBusiness, viewBy, customStartDate?, customEndDate? }
 *   onFiltersChange: (newFilters) => void
 *   disableLineOfBusiness: boolean — when true, renders nothing in the LOB slot
 *     (no badge, no "CDT wiring pending", no "Coming Soon")
 *     Service Category is handled inside the Specialty tab only.
 */
const GlobalFilterBar = ({ offices = [], filters = {}, onFiltersChange, disableLineOfBusiness = false }) => {
  // V241: safe extraction with defaults
  const safeOffices = Array.isArray(offices) ? offices : [];

  const datePreset = filters?.datePreset || 'last_month';
  const selectedOfficeIds = Array.isArray(filters?.selectedOfficeIds) ? filters?.selectedOfficeIds : [];
  // lineOfBusiness: normalize scalar → array
  const rawLOB = filters?.lineOfBusiness;
  const lineOfBusiness = Array.isArray(rawLOB) ? rawLOB : (typeof rawLOB === 'string' && rawLOB ? [rawLOB] : []);
  const viewBy = filters?.viewBy || 'location';
  const customStartDate = filters?.customStartDate || null;
  const customEndDate = filters?.customEndDate || null;

  const [pendingDate, setPendingDate] = useState(datePreset);
  const [pendingOffices, setPendingOffices] = useState(selectedOfficeIds);
  const [pendingLOB, setPendingLOB] = useState(lineOfBusiness);
  const [pendingViewBy, setPendingViewBy] = useState(viewBy);
  const [pendingCustomStart, setPendingCustomStart] = useState(customStartDate);
  const [pendingCustomEnd, setPendingCustomEnd] = useState(customEndDate);
  const [dirty, setDirty] = useState(false);

  // Stable dependency keys for useEffect
  const officesKey = selectedOfficeIds?.join(',');
  const lobKey = lineOfBusiness?.join(',');

  // Sync if parent changes externally (e.g. preset load)
  useEffect(() => {
    setPendingDate(datePreset);
    setPendingOffices(selectedOfficeIds);
    setPendingLOB(lineOfBusiness);
    setPendingViewBy(viewBy);
    setPendingCustomStart(customStartDate);
    setPendingCustomEnd(customEndDate);
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, officesKey, lobKey, viewBy, customStartDate, customEndDate]);

  // ── Immediate propagation helpers ────────────────────────────────────────

  const handleDateChange = useCallback((val) => {
    setPendingDate(val);
    setDirty(false);
    onFiltersChange?.(buildSafeFilters({
      datePreset: val,
      selectedOfficeIds: pendingOffices,
      lineOfBusiness: pendingLOB,
      viewBy: pendingViewBy,
      customStartDate: val === 'custom' ? pendingCustomStart : null,
      customEndDate: val === 'custom' ? pendingCustomEnd : null,
    }));
  }, [pendingOffices, pendingLOB, pendingViewBy, pendingCustomStart, pendingCustomEnd, onFiltersChange]);

  const handleCustomApply = useCallback((start, end) => {
    setPendingDate('custom');
    setPendingCustomStart(start);
    setPendingCustomEnd(end);
    setDirty(false);
    onFiltersChange?.(buildSafeFilters({
      datePreset: 'custom',
      selectedOfficeIds: pendingOffices,
      lineOfBusiness: pendingLOB,
      viewBy: pendingViewBy,
      customStartDate: start,
      customEndDate: end,
    }));
  }, [pendingOffices, pendingLOB, pendingViewBy, onFiltersChange]);

  const handleOfficesChange = useCallback((val) => {
    const safeVal = Array.isArray(val) ? val : [];
    setPendingOffices(safeVal);
    setDirty(false);
    onFiltersChange?.(buildSafeFilters({
      datePreset: pendingDate,
      selectedOfficeIds: safeVal,
      lineOfBusiness: pendingLOB,
      viewBy: pendingViewBy,
      customStartDate: pendingCustomStart,
      customEndDate: pendingCustomEnd,
    }));
  }, [pendingDate, pendingLOB, pendingViewBy, pendingCustomStart, pendingCustomEnd, onFiltersChange]);

  const handleViewByChange = useCallback((val) => {
    setPendingViewBy(val);
    setDirty(false);
    onFiltersChange?.(buildSafeFilters({
      datePreset: pendingDate,
      selectedOfficeIds: pendingOffices,
      lineOfBusiness: pendingLOB,
      viewBy: val,
      customStartDate: pendingCustomStart,
      customEndDate: pendingCustomEnd,
    }));
  }, [pendingDate, pendingOffices, pendingLOB, pendingCustomStart, pendingCustomEnd, onFiltersChange]);

  const handleUpdate = () => {
    onFiltersChange?.(buildSafeFilters({
      datePreset: pendingDate,
      selectedOfficeIds: pendingOffices,
      lineOfBusiness: pendingLOB,
      viewBy: pendingViewBy,
      customStartDate: pendingCustomStart,
      customEndDate: pendingCustomEnd,
    }));
    setDirty(false);
  };

  const currentPendingFilters = buildSafeFilters({
    datePreset: pendingDate,
    selectedOfficeIds: pendingOffices,
    lineOfBusiness: pendingLOB,
    viewBy: pendingViewBy,
    customStartDate: pendingCustomStart,
    customEndDate: pendingCustomEnd,
  });

  // Load a preset — apply immediately, guard against null/invalid
  const handleLoadPreset = useCallback((presetFilters) => {
    try {
      if (!presetFilters || typeof presetFilters !== 'object') {
        console.warn('[GlobalFilterBar] handleLoadPreset: invalid preset filters', presetFilters);
        return;
      }
      const next = buildSafeFilters({
        datePreset: presetFilters?.datePreset || 'last_month',
        selectedOfficeIds: presetFilters?.selectedOfficeIds || [],
        lineOfBusiness: presetFilters?.lineOfBusiness || [],
        viewBy: presetFilters?.viewBy || 'location',
        customStartDate: presetFilters?.customStartDate || null,
        customEndDate: presetFilters?.customEndDate || null,
      });
      setPendingDate(next?.datePreset);
      setPendingOffices(next?.selectedOfficeIds);
      setPendingLOB(next?.lineOfBusiness);
      setPendingViewBy(next?.viewBy);
      setPendingCustomStart(next?.customStartDate);
      setPendingCustomEnd(next?.customEndDate);
      onFiltersChange?.(next);
      setDirty(false);
    } catch (e) {
      console.warn('[GlobalFilterBar] handleLoadPreset error:', e);
    }
  }, [onFiltersChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-xl shadow-sm">
      {/* Date Range — with custom date range picker */}
      <DateRangeDropdown
        value={pendingDate}
        customStartDate={pendingCustomStart}
        customEndDate={pendingCustomEnd}
        onChange={handleDateChange}
        onCustomApply={handleCustomApply}
      />
      {/* Location — immediate apply on "Apply" click inside dropdown */}
      <LocationDropdown
        offices={safeOffices}
        selectedIds={pendingOffices}
        onChange={handleOfficesChange}
      />
      {/* Line of Business slot:
          disableLineOfBusiness={true} → render nothing.
          Service Category is handled inside the Specialty tab only.
          Do NOT show: "CDT wiring pending", "Coming Soon", or any badge here. */}
      {!disableLineOfBusiness && (
        /* LOB_OPTIONS is empty — this branch only renders when explicitly enabled */
        (null)
      )}
      {/* View By — Location and Provider Type only. Month removed. */}
      <ViewByDropdown
        value={pendingViewBy}
        onChange={handleViewByChange}
      />
      {/* Year Comparison Picker */}
      <YearPicker />
      {/* Spacer */}
      <div className="flex-1" />
      {/* Save / Load Presets */}
      <SavedPresetsDropdown
        currentFilters={currentPendingFilters}
        onLoadPreset={handleLoadPreset}
      />
      {/* Update Button — manual refresh fallback */}
      <button
        onClick={handleUpdate}
        className={`flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold rounded-lg transition-colors ${
          dirty
            ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-sm'
            : 'bg-slate-700 text-white hover:bg-slate-600'
        }`}
      >
        <Icon name="RefreshCw" size={14} />
        Update
      </button>
    </div>
  );
};

export default GlobalFilterBar;
