import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import { useAuth } from '../../../../contexts/AuthContext';

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal', color: 'text-gray-600' },
  { value: 'important', label: 'Important', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
];

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  partially_fulfilled: 'bg-orange-100 text-orange-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const DEPT_CATEGORY_BADGE = {
  'Front Desk': 'bg-blue-100 text-blue-700',
  'Back Staff': 'bg-green-100 text-green-700',
};

const emptyItem = () => ({
  department_id: '', subsection_id: '', item_id: '', custom_item_name: '',
  current_qty_on_hand: 0, requested_qty: 1, unit_type: 'Each',
  priority: 'normal', reason_notes: '', preferred_vendor: '',
});

// ── Master Item Search Component ──────────────────────────────────────────────
const MasterItemSearch = ({ supplyItems, departments, subsections, lineItems, onSelectItem, onSelectCustom }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Build search results from Back Staff items only (already filtered by caller)
  useEffect(() => {
    const q = query?.trim()?.toLowerCase();
    if (!q || q?.length < 1) {
      setResults([]);
      setOpen(false);
      setDuplicateWarning('');
      return;
    }

    const matched = supplyItems?.filter(item => {
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

  // Close dropdown on outside click
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

  const handleSelect = (item) => {
    // Check for duplicate
    const alreadyIn = lineItems?.some(li => li?.item_id && li?.item_id === item?.id);
    if (alreadyIn) {
      setDuplicateWarning(`"${item?.name}" is already in the request.`);
      setOpen(false);
      setQuery('');
      return;
    }
    setDuplicateWarning('');
    setQuery('');
    setOpen(false);

    // Resolve department and subsection ids
    const deptId = item?.department_id || '';
    const subId = item?.subsection_id || '';

    // Try to get on_hand from item (may not exist on catalog row — show 0 if missing)
    const onHand = item?.current_qty_on_hand ?? item?.qty_on_hand ?? 0;
    const unit = item?.unit_type || item?.unit || 'Each';

    onSelectItem({
      department_id: deptId,
      subsection_id: subId,
      item_id: item?.id,
      custom_item_name: '',
      current_qty_on_hand: onHand,
      requested_qty: 1,
      unit_type: unit,
      priority: 'normal',
      reason_notes: '',
      preferred_vendor: '',
    });
  };

  const handleCustom = () => {
    const text = query?.trim();
    if (!text) return;
    setDuplicateWarning('');
    setQuery('');
    setOpen(false);
    onSelectCustom(text);
  };

  const getDeptName = (item) => {
    return item?.supply_departments?.name?.split('/')?.[0]?.trim() || '—';
  };

  const getSubName = (item) => {
    return item?.supply_subsections?.name || '—';
  };

  return (
    <div className="mb-4">
      {/* Helper text */}
      <p className="text-xs text-muted-foreground mb-2">
        <Icon name="Info" size={12} className="inline mr-1 text-blue-500" />
        Search by item name. The department and subsection will fill automatically when the item exists in the Clinical Supply catalog. Use <span className="font-semibold">custom item</span> when it does not exist.
      </p>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-background focus-within:ring-2 focus-within:ring-primary/30">
          <Icon name="Search" size={15} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e?.target?.value); setDuplicateWarning(''); }}
            onFocus={() => { if (results?.length > 0 || query?.trim()) setOpen(true); }}
            placeholder="Search clinical supply item…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => { setQuery(''); setOpen(false); setDuplicateWarning(''); }} className="p-0.5 hover:bg-muted rounded">
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

            {/* Custom item option — always shown when there's a query */}
            {query?.trim() && (
              <button
                type="button"
                onMouseDown={e => { e?.preventDefault(); handleCustom(); }}
                className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center gap-3 border-t border-border/40"
              >
                <Icon name="PlusCircle" size={15} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    Request custom item: <span className="font-bold">"{query?.trim()}"</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">Not in catalog — will be added as a custom request</p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Custom</span>
              </button>
            )}

            {results?.length === 0 && !query?.trim() && (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">Type to search clinical supply items…</div>
            )}
          </div>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <Icon name="AlertTriangle" size={13} className="text-amber-600 flex-shrink-0" />
          {duplicateWarning}
          <button onClick={() => setDuplicateWarning('')} className="ml-auto text-amber-500 hover:text-amber-700">
            <Icon name="X" size={11} />
          </button>
        </div>
      )}
    </div>
  );
};

const MonthlyRequestTab = ({ isAdmin, isRCM }) => {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [supplyItems, setSupplyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});

  // Reviewer notes state for approve/reject/under-review actions
  const [reviewerNote, setReviewerNote] = useState('');
  const [reviewerNoteError, setReviewerNoteError] = useState('');

  // Form state
  const [formOffice, setFormOffice] = useState('');
  const [formMonth, setFormMonth] = useState(new Date()?.toISOString()?.slice(0, 7));
  const [formDeptCategory, setFormDeptCategory] = useState('Back Staff'); // 'Front Desk' | 'Back Staff'
  const [lineItems, setLineItems] = useState([emptyItem()]);
  const [editBatchId, setEditBatchId] = useState(null);
  const [existingBatchWarning, setExistingBatchWarning] = useState(null); // { id, status, category }
  const autoSaveRef = useRef(null);

  const OFFICES = supplyRequestService?.getOffices();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supplyRequestService?.fetchRequestBatches({
        requestType: 'monthly',
        officeId: officeFilter || undefined,
        departmentCategory: 'Back Staff',
      });
      setBatches(data);
    } catch (e) { setError(e?.message || 'Failed to load requests'); }
    finally { setLoading(false); }
  }, [officeFilter]);

  const loadMasterData = useCallback(async () => {
    try {
      const [depts, subs, items] = await Promise.all([
        supplyRequestService?.fetchDepartments(),
        supplyRequestService?.fetchSubsections(),
        supplyRequestService?.fetchItems(),
      ]);
      setDepartments(depts);
      setSubsections(subs);
      setSupplyItems(items);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  // Deep-link: auto-open detail for requestId param
  useEffect(() => {
    const requestId = searchParams?.get('requestId');
    if (!requestId || loading || batches?.length === 0) return;
    const match = batches?.find(b => b?.id === requestId);
    if (match) {
      setHighlightedId(requestId);
      openDetail(match);
      setTimeout(() => {
        const el = rowRefs?.current?.[requestId];
        if (el) el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      setTimeout(() => setHighlightedId(null), 4000);
    }
  }, [searchParams, loading, batches?.length]);

  // Auto-save draft every 30s
  useEffect(() => {
    if (view !== 'form') return;
    autoSaveRef.current = setInterval(() => {
      if (formOffice && formDeptCategory && lineItems?.some(i => i?.requested_qty > 0)) {
        handleSaveDraft(true);
      }
    }, 30000);
    return () => clearInterval(autoSaveRef?.current);
  }, [view, formOffice, formDeptCategory, lineItems, editBatchId, formMonth]);

  // Check for existing batch when office/month/category changes
  useEffect(() => {
    if (!formOffice || !formMonth || !formDeptCategory || editBatchId) {
      setExistingBatchWarning(null);
      return;
    }
    supplyRequestService?.checkExistingBatchForDept(formOffice, formMonth, formDeptCategory)
      ?.then(existing => {
        if (existing) setExistingBatchWarning(existing);
        else setExistingBatchWarning(null);
      })
      ?.catch(() => setExistingBatchWarning(null));
  }, [formOffice, formMonth, formDeptCategory, editBatchId]);

  // Filter supply items by selected department category (Back Staff only for Clinical Supply)
  const filteredSupplyItems = formDeptCategory
    ? supplyItems?.filter(i => i?.department_category === formDeptCategory)
    : supplyItems;

  // Back Staff items enriched with dept/sub names for master search
  const backStaffItemsForSearch = supplyItems?.filter(i => i?.department_category === 'Back Staff');

  const handleSaveDraft = async (silent = false) => {
    if (!formOffice) { if (!silent) setError('Please select an office'); return; }
    if (!formDeptCategory) { if (!silent) setError('Please select a department category (Front Desk or Back Staff)'); return; }
    setSaving(true);
    try {
      const batch = {
        id: editBatchId || undefined,
        office_id: formOffice,
        request_type: 'monthly',
        request_month: `${formMonth}-01`,
        batch_status: 'draft',
        department_category: formDeptCategory,
      };
      const validItems = lineItems?.filter(i => i?.requested_qty > 0 && (i?.item_id || i?.custom_item_name));
      const saved = await supplyRequestService?.saveDraftBatch(batch, validItems);
      setEditBatchId(saved?.id);
      if (!silent) { setSuccess('Draft saved'); setTimeout(() => setSuccess(''), 3000); }
    } catch (e) { if (!silent) setError(e?.message || 'Failed to save draft'); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!formOffice) { setError('Please select an office'); return; }
    if (!formDeptCategory) { setError('Please select a department category (Front Desk or Back Staff)'); return; }
    const validItems = lineItems?.filter(i => i?.requested_qty > 0 && (i?.item_id || i?.custom_item_name));
    if (validItems?.length === 0) { setError('Add at least one item'); return; }
    setSaving(true);
    try {
      const batch = {
        id: editBatchId || undefined,
        office_id: formOffice,
        request_type: 'monthly',
        request_month: `${formMonth}-01`,
        batch_status: 'draft',
        department_category: formDeptCategory,
      };
      const saved = await supplyRequestService?.saveDraftBatch(batch, validItems);
      await supplyRequestService?.submitBatch(saved?.id);
      setSuccess('Request submitted successfully!');
      setTimeout(() => setSuccess(''), 4000);
      setView('list');
      loadBatches();
      resetForm();
    } catch (e) { setError(e?.message || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setFormOffice('');
    setFormMonth(new Date()?.toISOString()?.slice(0, 7));
    setFormDeptCategory('Back Staff');
    setLineItems([emptyItem()]);
    setEditBatchId(null);
    setExistingBatchWarning(null);
  };

  const openEdit = async (batch) => {
    setEditBatchId(batch?.id);
    setFormOffice(batch?.office_id);
    setFormMonth(batch?.request_month?.slice(0, 7) || new Date()?.toISOString()?.slice(0, 7));
    setFormDeptCategory(batch?.department_category || '');
    try {
      const items = await supplyRequestService?.fetchRequestItems(batch?.id);
      setLineItems(items?.length > 0 ? items?.map(i => ({
        department_id: i?.department_id || '',
        subsection_id: i?.subsection_id || '',
        item_id: i?.item_id || '',
        custom_item_name: i?.custom_item_name || '',
        current_qty_on_hand: i?.current_qty_on_hand || 0,
        requested_qty: i?.requested_qty || 1,
        unit_type: i?.unit_type || 'Each',
        priority: i?.priority || 'normal',
        reason_notes: i?.reason_notes || '',
        preferred_vendor: i?.preferred_vendor || '',
      })) : [emptyItem()]);
    } catch (e) { setLineItems([emptyItem()]); }
    setView('form');
  };

  const openDetail = async (batch) => {
    setSelectedBatch(batch);
    try {
      const items = await supplyRequestService?.fetchRequestItems(batch?.id);
      setBatchItems(items);
    } catch (e) { setBatchItems([]); }
    setView('detail');
  };

  const updateLine = (idx, key, val) => {
    setLineItems(prev => prev?.map((item, i) => i === idx ? { ...item, [key]: val } : item));
  };

  const addLine = () => setLineItems(prev => [...prev, emptyItem()]);
  const removeLine = (idx) => setLineItems(prev => prev?.filter((_, i) => i !== idx));

  const getSubsectionsForDept = (deptId) => subsections?.filter(s => s?.department_id === deptId);
  const getItemsForSubsection = (subId) => filteredSupplyItems?.filter(i => i?.subsection_id === subId);

  // Master search handlers
  const handleMasterSearchSelect = (newLineItem) => {
    // Find the first empty row (no item_id and no custom_item_name) to fill, else append
    const emptyIdx = lineItems?.findIndex(li => !li?.item_id && !li?.custom_item_name);
    if (emptyIdx !== -1) {
      setLineItems(prev => prev?.map((li, i) => i === emptyIdx ? { ...li, ...newLineItem } : li));
    } else {
      setLineItems(prev => [...prev, newLineItem]);
    }
  };

  const handleMasterSearchCustom = (text) => {
    const customItem = {
      ...emptyItem(),
      custom_item_name: text,
      item_id: '',
    };
    const emptyIdx = lineItems?.findIndex(li => !li?.item_id && !li?.custom_item_name);
    if (emptyIdx !== -1) {
      setLineItems(prev => prev?.map((li, i) => i === emptyIdx ? { ...li, ...customItem } : li));
    } else {
      setLineItems(prev => [...prev, customItem]);
    }
  };

  const handleRCMAction = async (batchId, status, notes = '') => {
    try {
      await supplyRequestService?.updateBatchStatus(batchId, status, notes);
      setSuccess(`Request ${status?.replace('_', ' ')}`);
      setTimeout(() => setSuccess(''), 3000);
      setReviewerNote('');
      setReviewerNoteError('');
      setView('list');
      loadBatches();
    } catch (e) { setError(e?.message || 'Failed to update status'); }
  };

  if (view === 'form') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); resetForm(); }} className="p-2 hover:bg-muted rounded-xl">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <h3 className="text-base font-bold text-foreground">{editBatchId ? 'Edit Clinical Supply Request' : 'New Clinical Supply Request'}</h3>
        {saving && <span className="text-xs text-muted-foreground animate-pulse">Auto-saving...</span>}
      </div>

      {/* Department Category — Back Staff only in Clinical Supply context */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-3">REQUEST TYPE</p>
        <div className="flex items-center gap-3 h-14 px-4 rounded-xl border-2 bg-green-600 border-green-600 text-white shadow-md w-fit">
          <span className="text-lg">🦷</span>
          <span className="font-bold text-sm">Back Staff / Clinical Request</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This tab is for <span className="font-semibold text-green-600">Back Staff / Clinical</span> supply requests only.
          {' '}({filteredSupplyItems?.length} items available)
        </p>
      </div>

      {/* Existing batch warning */}
      {existingBatchWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              A {formDeptCategory} request for this month already exists.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Would you like to continue editing it?</p>
          </div>
          <button
            onClick={() => {
              const existing = batches?.find(b => b?.id === existingBatchWarning?.id);
              if (existing) openEdit(existing);
              else { setEditBatchId(existingBatchWarning?.id); setExistingBatchWarning(null); }
            }}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 whitespace-nowrap"
          >
            Edit Existing
          </button>
        </div>
      )}

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}<button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700"><Icon name="X" size={12} /></button></div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}

      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Practice Location *</label>
            <select value={formOffice} onChange={e => setFormOffice(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select Office</option>
              {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Request Month *</label>
            <input type="month" value={formMonth} onChange={e => setFormMonth(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Requested By</label>
            <input type="text" value={userProfile?.full_name || ''} readOnly
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-muted/30 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Supply Items</h4>
          <button onClick={addLine} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20">
            <Icon name="Plus" size={13} />Add Item
          </button>
        </div>

        {/* ── Master Item Search ── */}
        <div className="px-4 pt-4 pb-2 border-b border-border/60 bg-muted/10">
          <MasterItemSearch
            supplyItems={backStaffItemsForSearch}
            departments={departments}
            subsections={subsections}
            lineItems={lineItems}
            onSelectItem={handleMasterSearchSelect}
            onSelectCustom={handleMasterSearchCustom}
          />
        </div>

        {!formDeptCategory && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border-b border-amber-100">
            <Icon name="Info" size={14} className="text-amber-600" />
            <p className="text-xs text-amber-700">Please select a department category above to filter available items.</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['Department', 'Subsection', 'Item', 'Custom Item', 'On Hand', 'Req. Qty', 'Unit', 'Priority', 'Notes', '']?.map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems?.map((item, idx) => (
                <tr key={idx} className={`border-b border-border/50 ${item?.custom_item_name && !item?.item_id ? 'bg-amber-50/40' : ''}`}>
                  <td className="py-2 px-2">
                    <select value={item?.department_id} onChange={e => updateLine(idx, 'department_id', e?.target?.value)}
                      className="w-36 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none">
                      <option value="">Dept.</option>
                      {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name?.split('/')?.[0]?.trim()}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select value={item?.subsection_id} onChange={e => updateLine(idx, 'subsection_id', e?.target?.value)}
                      className="w-36 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none">
                      <option value="">Subsection</option>
                      {getSubsectionsForDept(item?.department_id)?.map(s => <option key={s?.id} value={s?.id}>{s?.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select value={item?.item_id} onChange={e => updateLine(idx, 'item_id', e?.target?.value)}
                      className="w-40 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none">
                      <option value="">Select Item</option>
                      {getItemsForSubsection(item?.subsection_id)?.map(i => <option key={i?.id} value={i?.id}>{i?.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex flex-col gap-0.5">
                      <input type="text" placeholder="Custom item..." value={item?.custom_item_name}
                        onChange={e => updateLine(idx, 'custom_item_name', e?.target?.value)}
                        className="w-32 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none" />
                      {item?.custom_item_name && !item?.item_id && (
                        <span className="text-xs text-amber-600 font-semibold px-1">Custom</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min="0" value={item?.current_qty_on_hand}
                      onChange={e => updateLine(idx, 'current_qty_on_hand', parseInt(e?.target?.value) || 0)}
                      className="w-16 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min="1" value={item?.requested_qty}
                      onChange={e => updateLine(idx, 'requested_qty', parseInt(e?.target?.value) || 1)}
                      className="w-16 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="text" value={item?.unit_type}
                      onChange={e => updateLine(idx, 'unit_type', e?.target?.value)}
                      className="w-16 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none" />
                  </td>
                  <td className="py-2 px-2">
                    <select value={item?.priority} onChange={e => updateLine(idx, 'priority', e?.target?.value)}
                      className="w-24 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none">
                      {PRIORITY_OPTIONS?.map(p => <option key={p?.value} value={p?.value}>{p?.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input type="text" placeholder="Notes..." value={item?.reason_notes}
                      onChange={e => updateLine(idx, 'reason_notes', e?.target?.value)}
                      className="w-32 px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:outline-none" />
                  </td>
                  <td className="py-2 px-2">
                    {lineItems?.length > 1 && (
                      <button onClick={() => removeLine(idx)} className="p-1 hover:bg-red-50 rounded-lg">
                        <Icon name="Trash2" size={13} className="text-red-500" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => handleSaveDraft(false)} disabled={saving}
          className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted disabled:opacity-50">
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
          Submit for Review
        </button>
      </div>
    </div>
  );

  if (view === 'detail' && selectedBatch) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('list'); setReviewerNote(''); setReviewerNoteError(''); }} className="p-2 hover:bg-muted rounded-xl"><Icon name="ArrowLeft" size={16} /></button>
        <h3 className="text-base font-bold text-foreground">Request Detail</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE?.[selectedBatch?.batch_status]}`}>
          {selectedBatch?.batch_status?.replace('_', ' ')?.toUpperCase()}
        </span>
        {selectedBatch?.department_category && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${DEPT_CATEGORY_BADGE?.[selectedBatch?.department_category] || 'bg-gray-100 text-gray-700'}`}>
            {selectedBatch?.department_category === 'Front Desk' ? '🖥' : '🦷'} {selectedBatch?.department_category}
          </span>
        )}
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}<button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700"><Icon name="X" size={12} /></button></div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}

      {/* Batch header info */}
      <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-muted-foreground">Office</p><p className="font-medium">{selectedBatch?.office_id || '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Month</p><p className="font-medium">{selectedBatch?.request_month?.slice(0, 7) || '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Requested By</p><p className="font-medium">{selectedBatch?.requested_by_profile?.full_name || '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{selectedBatch?.submitted_at ? new Date(selectedBatch.submitted_at)?.toLocaleDateString() : '—'}</p></div>
      </div>

      {/* Review status panel — always shown, shows N/A when not yet reviewed */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Review Status</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-block mt-0.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE?.[selectedBatch?.batch_status] || 'bg-gray-100 text-gray-700'}`}>
              {selectedBatch?.batch_status?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reviewed By</p>
            <p className="font-medium mt-0.5">{selectedBatch?.reviewer_profile?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="font-medium mt-0.5">{selectedBatch?.updated_at ? new Date(selectedBatch.updated_at)?.toLocaleString() : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reviewer Notes</p>
            <p className="font-medium mt-0.5 break-words">{selectedBatch?.reviewer_notes || '—'}</p>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border"><h4 className="text-sm font-semibold">Items ({batchItems?.length})</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['Item', 'Department', 'On Hand', 'Requested', 'Approved', 'Fulfilled', 'Priority', 'Status']?.map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batchItems?.map(item => (
                <tr key={item?.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-medium">
                    {item?.custom_item_name ? (
                      <span className="flex items-center gap-1.5">
                        {item?.custom_item_name}
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Custom</span>
                      </span>
                    ) : (item?.supply_items?.name || '—')}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{item?.supply_departments?.name?.split('/')?.[0]?.trim() || '—'}</td>
                  <td className="py-2.5 px-3">{item?.current_qty_on_hand ?? '—'}</td>
                  <td className="py-2.5 px-3 font-semibold">{item?.requested_qty ?? '—'}</td>
                  <td className="py-2.5 px-3">{item?.approved_qty ?? '—'}</td>
                  <td className="py-2.5 px-3">{item?.fulfilled_qty ?? 0}</td>
                  <td className="py-2.5 px-3"><span className="text-xs capitalize">{item?.priority || '—'}</span></td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE?.[item?.item_status] || 'bg-gray-100 text-gray-700'}`}>
                      {item?.item_status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manager review actions — only shown when actionable */}
      {(isAdmin || isRCM) && ['submitted', 'under_review']?.includes(selectedBatch?.batch_status) && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Manager Review</h4>

          {/* Reviewer notes / reason textarea */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Manager Notes / Reason
              <span className="ml-1 text-red-500">*</span>
              <span className="ml-1 font-normal text-muted-foreground">(required for Reject; optional for Approve / Under Review)</span>
            </label>
            <textarea
              value={reviewerNote}
              onChange={e => { setReviewerNote(e?.target?.value); if (reviewerNoteError) setReviewerNoteError(''); }}
              placeholder="Enter notes, reason for rejection, or any relevant context..."
              rows={3}
              className={`w-full px-3 py-2 border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${
                reviewerNoteError ? 'border-red-400 focus:ring-red-300' : 'border-border'
              }`}
            />
            {reviewerNoteError && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <Icon name="AlertCircle" size={12} />
                {reviewerNoteError}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleRCMAction(selectedBatch?.id, 'approved', reviewerNote?.trim())}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleRCMAction(selectedBatch?.id, 'under_review', reviewerNote?.trim())}
              className="px-4 py-2 bg-yellow-500 text-white rounded-xl text-sm font-semibold hover:bg-yellow-600 transition-colors"
            >
              Mark Under Review
            </button>
            <button
              onClick={() => {
                const note = reviewerNote?.trim();
                if (!note) {
                  setReviewerNoteError('A reason is required before rejecting a request.');
                  return;
                }
                handleRCMAction(selectedBatch?.id, 'rejected', note);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // List view
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
        </div>
        <button onClick={() => { resetForm(); setView('form'); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90">
          <Icon name="Plus" size={15} />New Clinical Supply Request
        </button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : batches?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="ClipboardList" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No monthly requests yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Office', 'Month', 'Department', 'Requested By', 'Submitted', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches?.map(b => (
                  <tr
                    key={b?.id}
                    ref={el => { rowRefs.current[b?.id] = el; }}
                    className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${
                      highlightedId === b?.id ? 'ring-2 ring-blue-400 ring-inset bg-blue-50' : ''
                    }`}
                    onClick={() => openDetail(b)}
                  >
                    <td className="py-3 px-4 font-medium">{b?.office_id?.split(' ')?.pop()}</td>
                    <td className="py-3 px-4 text-muted-foreground">{b?.request_month?.slice(0, 7)}</td>
                    <td className="py-3 px-4">
                      {b?.department_category ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${DEPT_CATEGORY_BADGE?.[b?.department_category] || 'bg-gray-100 text-gray-700'}`}>
                          {b?.department_category === 'Front Desk' ? '🖥' : '🦷'} {b?.department_category}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{b?.requested_by_profile?.full_name || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{b?.submitted_at ? new Date(b.submitted_at)?.toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE?.[b?.batch_status]}`}>
                        {b?.batch_status?.replace(/_/g, ' ')?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e?.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {b?.batch_status === 'draft' && (
                          <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-muted rounded-lg" title="Edit">
                            <Icon name="Edit" size={13} className="text-muted-foreground" />
                          </button>
                        )}
                        <button onClick={() => openDetail(b)} className="p-1.5 hover:bg-muted rounded-lg" title="View">
                          <Icon name="Eye" size={13} className="text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyRequestTab;
