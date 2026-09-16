import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import { useAuth } from '../../../../contexts/AuthContext';
import MobileUrgentRequestModal from './MobileUrgentRequestModal';

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700', border: 'border-red-200' },
};

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  acknowledged: { label: 'Acknowledged', color: 'bg-yellow-100 text-yellow-700' },
  in_process: { label: 'In Process', color: 'bg-indigo-100 text-indigo-700' },
  partially_fulfilled: { label: 'Partial', color: 'bg-orange-100 text-orange-700' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-100 text-emerald-700' },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-700' },
};

// ── Urgent Master Item Search ─────────────────────────────────────────────────
// Searches Back Staff / Clinical items only (department_category === 'Back Staff').
// On selection: auto-fills department, subsection, item, unit, on-hand into form.
// On custom: fills custom_item_name field.
// Does NOT create catalog records. Does NOT touch Front Desk items.
const UrgentMasterItemSearch = ({ supplyItems, onSelectItem, onSelectCustom, hasExistingItem }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [replaceWarning, setReplaceWarning] = useState('');
  const [pendingItem, setPendingItem] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter to Back Staff only — Front Desk items are excluded here
  const backStaffItems = supplyItems?.filter(i => i?.department_category === 'Back Staff') || [];

  useEffect(() => {
    const q = query?.trim()?.toLowerCase();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    const matched = backStaffItems?.filter(item => {
      const name = item?.name?.toLowerCase() || '';
      const brand = item?.brand?.toLowerCase() || '';
      const sku = item?.sku?.toLowerCase() || '';
      const deptName = item?.supply_departments?.name?.toLowerCase() || '';
      const subName = item?.supply_subsections?.name?.toLowerCase() || '';
      return (
        name?.includes(q) ||
        brand?.includes(q) ||
        sku?.includes(q) ||
        deptName?.includes(q) ||
        subName?.includes(q)
      );
    })?.slice(0, 12);
    setResults(matched);
    setOpen(true);
  }, [query, supplyItems]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef?.current && !dropdownRef?.current?.contains(e?.target) &&
        inputRef?.current && !inputRef?.current?.contains(e?.target)
      ) {
        setOpen(false);
      }
    };
    document?.addEventListener('mousedown', handler);
    return () => document?.removeEventListener('mousedown', handler);
  }, []);

  const applyItem = (item) => {
    const deptId = item?.department_id || '';
    const subId = item?.subsection_id || '';
    const onHand = item?.current_qty_on_hand ?? item?.qty_on_hand ?? null;
    const unit = item?.unit_type || item?.unit || 'Each';
    onSelectItem({ department_id: deptId, subsection_id: subId, item_id: item?.id, custom_item_name: '', current_qty_on_hand: onHand, unit_type: unit });
    setQuery('');
    setOpen(false);
    setReplaceWarning('');
    setPendingItem(null);
  };

  const handleSelect = (item) => {
    if (hasExistingItem) {
      // Ask for confirmation before replacing
      setPendingItem(item);
      setReplaceWarning(`Replace current item with "${item?.name}"?`);
      setOpen(false);
      setQuery('');
      return;
    }
    applyItem(item);
  };

  const handleCustom = () => {
    const text = query?.trim();
    if (!text) return;
    onSelectCustom(text);
    setQuery('');
    setOpen(false);
    setReplaceWarning('');
    setPendingItem(null);
  };

  const getDeptName = (item) => item?.supply_departments?.name?.split('/')?.[0]?.trim() || '—';
  const getSubName = (item) => item?.supply_subsections?.name || '—';

  return (
    <div className="mb-5 p-4 bg-red-50/60 border border-red-200 rounded-2xl">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon name="Search" size={14} className="text-red-600 flex-shrink-0" />
        <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Search Clinical Supply Item</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        <Icon name="Info" size={12} className="inline mr-1 text-blue-500" />
        Search by item name. Department, subsection, item, unit, and on-hand quantity will fill automatically when the item exists in the Clinical Supply catalog. Use <span className="font-semibold">custom item</span> when it does not exist.
      </p>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-xl bg-background focus-within:ring-2 focus-within:ring-red-400/30">
          <Icon name="Search" size={15} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e?.target?.value); setReplaceWarning(''); setPendingItem(null); }}
            onFocus={() => { if (results?.length > 0 || query?.trim()) setOpen(true); }}
            placeholder="Search clinical supply item…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => { setQuery(''); setOpen(false); }} className="p-0.5 hover:bg-muted rounded">
              <Icon name="X" size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-72 overflow-y-auto"
          >
            {results?.length > 0 && results?.map(item => (
              <button
                key={item?.id}
                type="button"
                onMouseDown={e => { e?.preventDefault(); handleSelect(item); }}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/60 flex items-start gap-3 border-b border-border/40 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getDeptName(item)} › {getSubName(item)}
                    {item?.brand ? <span className="ml-2 text-muted-foreground/70">· {item?.brand}</span> : null}
                    {item?.sku ? <span className="ml-2 text-muted-foreground/70">· SKU: {item?.sku}</span> : null}
                  </p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 flex-shrink-0">🦷 Clinical</span>
              </button>
            ))}

            {/* Custom item option */}
            {query?.trim() && (
              <button
                type="button"
                onMouseDown={e => { e?.preventDefault(); handleCustom(); }}
                className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center gap-3 border-t border-border/40"
              >
                <Icon name="PlusCircle" size={15} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    Request custom urgent item: <span className="font-bold">"{query?.trim()}"</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">Not in catalog — will be submitted as a custom urgent request</p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Custom</span>
              </button>
            )}

            {results?.length === 0 && query?.trim() && (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                No clinical items found — use "Request custom urgent item" below.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Replace confirmation */}
      {replaceWarning && pendingItem && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <Icon name="AlertTriangle" size={13} className="text-amber-600 flex-shrink-0" />
          <span className="flex-1">{replaceWarning}</span>
          <button
            onClick={() => applyItem(pendingItem)}
            className="px-2 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
          >Replace</button>
          <button
            onClick={() => { setReplaceWarning(''); setPendingItem(null); }}
            className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-semibold hover:bg-muted/80"
          >Keep</button>
        </div>
      )}
    </div>
  );
};

const UrgentRequestTab = ({ isAdmin, isRCM, prefillItem }) => {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('list');
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [supplyItems, setSupplyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [mobilePrefill, setMobilePrefill] = useState(null);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [highlightedId, setHighlightedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const rowRefs = useRef({});

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Form state
  const [form, setForm] = useState({
    office_id: '', department_id: '', subsection_id: '', item_id: '',
    custom_item_name: '', current_qty_on_hand: 0, requested_qty: 1,
    unit_type: 'Each', priority: 'urgent', reason: '',
    patient_care_impact: '', needed_by_date: '', notes: '',
  });

  // Track whether an item has been selected (for replace-confirmation logic)
  const hasExistingItem = !!(form?.item_id || form?.custom_item_name);

  const OFFICES = supplyRequestService?.getOffices();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, count, depts, subs, items] = await Promise.all([
        supplyRequestService?.fetchUrgentRequests({ officeId: officeFilter || undefined }),
        supplyRequestService?.countUnacknowledgedUrgent(),
        supplyRequestService?.fetchDepartments(),
        supplyRequestService?.fetchSubsections(),
        supplyRequestService?.fetchItems(),
      ]);
      setRequests(reqs);
      setUnacknowledgedCount(count);
      setDepartments(depts);
      setSubsections(subs);
      setSupplyItems(items);
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [officeFilter]);

  useEffect(() => { load(); }, [load]);

  // Deep-link: auto-highlight and expand matching request
  useEffect(() => {
    const requestId = searchParams?.get('requestId');
    if (!requestId || loading || requests?.length === 0) return;
    const match = requests?.find(r => r?.id === requestId);
    if (match) {
      setHighlightedId(requestId);
      setExpandedId(requestId);
      setTimeout(() => {
        const el = rowRefs?.current?.[requestId];
        if (el) el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      setTimeout(() => setHighlightedId(null), 4000);
    }
  }, [searchParams, loading, requests?.length]);

  // Pre-fill from inventory item
  useEffect(() => {
    if (prefillItem) {
      if (isMobile) {
        setMobilePrefill(prefillItem);
        setShowMobileModal(true);
      } else {
        setForm(prev => ({
          ...prev,
          office_id: prefillItem?.office_id || '',
          item_id: prefillItem?.item_id || '',
          custom_item_name: prefillItem?.item_name || '',
          current_qty_on_hand: prefillItem?.quantity_on_hand || 0,
          department_id: prefillItem?.department_id || '',
          subsection_id: prefillItem?.subsection_id || '',
          unit_type: prefillItem?.unit_type || 'Each',
          priority: prefillItem?.inv_status === 'out_of_stock' ? 'critical' : 'urgent',
        }));
        setView('form');
      }
    }
  }, [prefillItem, isMobile]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Master search handlers
  const handleMasterSelectItem = ({ department_id, subsection_id, item_id, custom_item_name, current_qty_on_hand, unit_type }) => {
    setForm(prev => ({
      ...prev,
      department_id: department_id || '',
      subsection_id: subsection_id || '',
      item_id: item_id || '',
      custom_item_name: custom_item_name || '',
      current_qty_on_hand: current_qty_on_hand !== null && current_qty_on_hand !== undefined ? current_qty_on_hand : 0,
      unit_type: unit_type || 'Each',
    }));
    setError('');
  };

  const handleMasterSelectCustom = (text) => {
    setForm(prev => ({
      ...prev,
      item_id: '',
      department_id: '',
      subsection_id: '',
      custom_item_name: text,
      current_qty_on_hand: 0,
      unit_type: 'Each',
    }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!form?.office_id) { setError('Please select an office'); return; }
    if (!form?.custom_item_name && !form?.item_id) { setError('Please specify an item'); return; }
    if (!form?.reason) { setError('Please provide a reason'); return; }
    setSaving(true);
    try {
      await supplyRequestService?.createUrgentRequest(form);
      setSuccess('Urgent request submitted! Regional Clinical Manager has been notified.');
      setTimeout(() => setSuccess(''), 5000);
      setView('list');
      load();
      setForm({ office_id: '', department_id: '', subsection_id: '', item_id: '', custom_item_name: '', current_qty_on_hand: 0, requested_qty: 1, unit_type: 'Each', priority: 'urgent', reason: '', patient_care_impact: '', needed_by_date: '', notes: '' });
    } catch (e) { setError(e?.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await supplyRequestService?.updateUrgentRequestStatus(id, status);
      setSuccess(`Status updated to ${status}`);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e) { setError(e?.message || 'Failed to update'); }
  };

  const getSubsectionsForDept = (deptId) => subsections?.filter(s => s?.department_id === deptId);
  const getItemsForSubsection = (subId) => supplyItems?.filter(i => i?.subsection_id === subId);

  const getResponseTime = (createdAt) => {
    const hours = Math.round((Date.now() - new Date(createdAt)?.getTime()) / 3600000);
    if (hours < 1) return '< 1 hr';
    if (hours < 24) return `${hours} hrs`;
    return `${Math.round(hours / 24)} days`;
  };

  if (view === 'form') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="p-2 hover:bg-muted rounded-xl"><Icon name="ArrowLeft" size={16} /></button>
        <h3 className="text-base font-bold text-foreground">New Urgent Request</h3>
        <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">URGENT</span>
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}<button onClick={() => setError('')} className="ml-2"><Icon name="X" size={12} /></button></div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}

      {/* ── Master Item Search ── */}
      <UrgentMasterItemSearch
        supplyItems={supplyItems}
        onSelectItem={handleMasterSelectItem}
        onSelectCustom={handleMasterSelectCustom}
        hasExistingItem={hasExistingItem}
      />

      {/* Selected item summary badge */}
      {(form?.item_id || form?.custom_item_name) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
          <Icon name="CheckCircle" size={13} className="text-green-600 flex-shrink-0" />
          {form?.item_id ? (
            <span>
              <span className="font-semibold">{supplyItems?.find(i => i?.id === form?.item_id)?.name || 'Item selected'}</span>
              {form?.unit_type ? <span className="ml-2 text-green-600">· {form?.unit_type}</span> : null}
              {form?.current_qty_on_hand !== null && form?.current_qty_on_hand !== undefined
                ? <span className="ml-2 text-green-600">· On Hand: {form?.current_qty_on_hand}</span>
                : <span className="ml-2 text-green-600">· On Hand: N/A</span>}
            </span>
          ) : (
            <span>
              <span className="font-semibold">{form?.custom_item_name}</span>
              <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">Custom</span>
            </span>
          )}
          <button
            onClick={() => setForm(prev => ({ ...prev, item_id: '', custom_item_name: '', department_id: '', subsection_id: '', current_qty_on_hand: 0, unit_type: 'Each' }))}
            className="ml-auto text-green-500 hover:text-green-700"
          ><Icon name="X" size={12} /></button>
        </div>
      )}

      <div className="bg-card border border-red-200 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Practice Location *</label>
            <select value={form?.office_id} onChange={e => setField('office_id', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select Office</option>
              {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Requested By</label>
            <input type="text" value={userProfile?.full_name || ''} readOnly
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-muted/30 text-muted-foreground" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Priority *</label>
            <select value={form?.priority} onChange={e => setField('priority', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
            <select value={form?.department_id} onChange={e => setField('department_id', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
              <option value="">Select Department</option>
              {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name?.split('/')?.[0]?.trim()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Subsection</label>
            <select value={form?.subsection_id} onChange={e => setField('subsection_id', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
              <option value="">Select Subsection</option>
              {getSubsectionsForDept(form?.department_id)?.map(s => <option key={s?.id} value={s?.id}>{s?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Item</label>
            <select value={form?.item_id} onChange={e => setField('item_id', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
              <option value="">Select Item</option>
              {getItemsForSubsection(form?.subsection_id)?.map(i => <option key={i?.id} value={i?.id}>{i?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Custom Item Name
              {form?.custom_item_name && !form?.item_id && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">Custom</span>
              )}
            </label>
            <input type="text" value={form?.custom_item_name} onChange={e => setField('custom_item_name', e?.target?.value)}
              placeholder="Or enter custom item name..."
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Current Qty On Hand</label>
            <input type="number" min="0" value={form?.current_qty_on_hand ?? 0} onChange={e => setField('current_qty_on_hand', parseInt(e?.target?.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Requested Qty *</label>
            <input type="number" min="1" value={form?.requested_qty} onChange={e => setField('requested_qty', parseInt(e?.target?.value) || 1)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Unit Type</label>
            <input type="text" value={form?.unit_type} onChange={e => setField('unit_type', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Needed By Date</label>
            <input type="date" value={form?.needed_by_date} onChange={e => setField('needed_by_date', e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Reason for Urgent Need *</label>
          <textarea value={form?.reason} onChange={e => setField('reason', e?.target?.value)} rows={3}
            placeholder="Explain why this is urgent..."
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Patient Care Impact</label>
          <textarea value={form?.patient_care_impact} onChange={e => setField('patient_care_impact', e?.target?.value)} rows={2}
            placeholder="How does this affect patient care?"
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Additional Notes</label>
          <textarea value={form?.notes} onChange={e => setField('notes', e?.target?.value)} rows={2}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none resize-none" />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setView('list')} className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
          <Icon name="AlertTriangle" size={14} />{saving ? 'Submitting...' : 'Submit Urgent Request'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select value={officeFilter} onChange={e => setOfficeFilter(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
            <option value="">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o?.split(' ')?.pop()}</option>)}
          </select>
          {unacknowledgedCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold animate-pulse">
              <Icon name="AlertTriangle" size={12} />{unacknowledgedCount} Unacknowledged
            </span>
          )}
        </div>
        <button onClick={() => setView('form')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
          <Icon name="AlertTriangle" size={15} />New Urgent Request
        </button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : requests?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="CheckCircle" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No urgent requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Priority', 'Office', 'Item', 'Qty', 'Needed By', 'Reason', 'Status', 'Response Time', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests?.sort((a, b) => (b?.priority === 'critical' ? 1 : 0) - (a?.priority === 'critical' ? 1 : 0))?.map(r => {
                    const pCfg = PRIORITY_CONFIG?.[r?.priority] || PRIORITY_CONFIG?.urgent;
                    const sCfg = STATUS_CONFIG?.[r?.urgent_status] || STATUS_CONFIG?.submitted;
                    return (
                      <tr
                        key={r?.id}
                        ref={el => { rowRefs.current[r?.id] = el; }}
                        className={`border-b border-border/50 transition-colors ${
                          highlightedId === r?.id
                            ? 'ring-2 ring-blue-400 ring-inset bg-blue-50'
                            : r?.priority === 'critical' ? 'bg-red-50' : r?.priority === 'urgent' ? 'bg-orange-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pCfg?.color}`}>{pCfg?.label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs">{r?.office_id?.split(' ')?.pop()}</td>
                        <td className="py-2.5 px-3 font-medium max-w-[140px] truncate">{r?.custom_item_name || r?.supply_items?.name || '—'}</td>
                        <td className="py-2.5 px-3">{r?.requested_qty} {r?.unit_type}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{r?.needed_by_date || '—'}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[160px] truncate">{r?.reason}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sCfg?.color}`}>{sCfg?.label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{getResponseTime(r?.created_at)}</td>
                        <td className="py-2.5 px-3">
                          {(isAdmin || isRCM) && r?.urgent_status === 'submitted' && (
                            <button onClick={() => handleStatusUpdate(r?.id, 'acknowledged')}
                              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold hover:bg-yellow-200 whitespace-nowrap">
                              Acknowledge
                            </button>
                          )}
                          {(isAdmin || isRCM) && r?.urgent_status === 'acknowledged' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleStatusUpdate(r?.id, 'in_process')}
                                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-200">Process</button>
                              <button onClick={() => handleStatusUpdate(r?.id, 'denied')}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200">Deny</button>
                            </div>
                          )}
                          {(isAdmin || isRCM) && r?.urgent_status === 'in_process' && (
                            <button onClick={() => handleStatusUpdate(r?.id, 'fulfilled')}
                              className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200">Fulfill</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showMobileModal && (
        <MobileUrgentRequestModal
          prefillItem={mobilePrefill}
          onClose={() => { setShowMobileModal(false); setMobilePrefill(null); }}
          onSubmitted={(result) => {
            setShowMobileModal(false);
            setMobilePrefill(null);
            if (result?.offline) {
              setSuccess('Urgent request queued — will sync when back online');
            } else {
              setSuccess('Urgent request submitted! Regional Clinical Manager has been notified.');
              load();
            }
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}
    </div>
  );
};

export default UrgentRequestTab;
