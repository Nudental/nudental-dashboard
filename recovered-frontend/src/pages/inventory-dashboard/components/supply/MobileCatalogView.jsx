import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import { offlineQueueService } from '../../../../services/offlineQueueService';


// ─── Inline NumericKeypad (slides below item row) ─────────────────────────────
const InlineNumericKeypad = ({ itemName, currentQty, onDone, onCancel }) => {
  const [display, setDisplay] = useState(currentQty?.toString() || '0');

  const handleKey = (key) => {
    setDisplay(prev => {
      if (key === 'backspace') {
        const next = prev?.slice(0, -1);
        return next === '' ? '0' : next;
      }
      if (prev === '0') return key;
      return prev + key;
    });
  };

  const keys = ['7','8','9','4','5','6','1','2','3',null,'0','backspace'];

  return (
    <div className="bg-muted/40 border border-border rounded-2xl p-4 mx-2 mb-2 animate-in slide-in-from-top-2 duration-200">
      <p className="text-xs font-semibold text-muted-foreground mb-1 truncate">{itemName}</p>
      <p className="text-xs text-muted-foreground mb-3">Set Stock Level</p>
      <div className="text-center text-3xl font-bold text-foreground mb-3 py-3 bg-background rounded-xl border border-border">
        {display}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {keys?.map((key, i) =>
          key !== null ? (
            <button
              key={i}
              type="button"
              onClick={() => handleKey(key)}
              className={`flex items-center justify-center rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                key === 'backspace' ?'bg-red-100 text-red-700 hover:bg-red-200' :'bg-background border border-border text-foreground hover:bg-muted'
              }`}
              style={{ minHeight: '52px' }}
            >
              {key === 'backspace' ? <Icon name="Delete" size={20} /> : key}
            </button>
          ) : <div key={i} />
        )}
      </div>
      <button
        type="button"
        onClick={() => onDone(parseInt(display) || 0)}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold mb-2 active:scale-95 transition-all"
        style={{ minHeight: '48px' }}
      >
        Done — Save Stock Level
      </button>
      <button type="button" onClick={onCancel} className="w-full text-sm text-muted-foreground py-1">
        Cancel
      </button>
    </div>
  );
};

// ─── Inline Add Subsection Form ───────────────────────────────────────────────
const InlineAddSubsection = ({ department, existingNames, onSave, onCancel, isOffline, officeId }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef?.current?.focus(); }, []);

  const handleSave = async () => {
    const trimmed = name?.trim();
    if (!trimmed) { setError('Name is required'); return; }
    const dup = existingNames?.some(n => n?.toLowerCase() === trimmed?.toLowerCase());
    if (dup) { setError('A subsection with this name already exists'); return; }
    setSaving(true);
    try {
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_catalog_edit', {
          action: 'add_subsection',
          name: trimmed,
          department_id: department?.id,
          office_id: officeId || null,
        });
        onSave({ id: `temp_${Date.now()}`, name: trimmed, department_id: department?.id, is_custom: true, is_active: true, _pending: true });
      } else {
        const result = await supplyRequestService?.upsertSubsection({
          name: trimmed,
          department_id: department?.id,
          is_active: true,
          is_custom: true,
          office_id: officeId || null,
        });
        onSave(result);
      }
    } catch (e) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-2 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
      <p className="text-xs font-semibold text-blue-700 mb-2">New Subsection in {department?.name}</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={e => { setName(e?.target?.value); setError(''); }}
        placeholder="Subsection name..."
        className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
        style={{ fontSize: '16px' }}
        onKeyDown={e => { if (e?.key === 'Enter') handleSave(); if (e?.key === 'Escape') onCancel(); }}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
        >
          <Icon name="Check" size={14} />{saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold active:scale-95 transition-all">
          <Icon name="X" size={14} />Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Inline Add Item Form ─────────────────────────────────────────────────────
const InlineAddItem = ({ subsection, department, existingNames, onSave, onCancel, isOffline, officeId }) => {
  const [form, setForm] = useState({ name: '', brand: '', unit_type: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef?.current?.focus(); }, []);

  const handleSave = async () => {
    const trimmed = form?.name?.trim();
    if (!trimmed) { setError('Item name is required'); return; }
    const dup = existingNames?.some(n => n?.toLowerCase() === trimmed?.toLowerCase());
    if (dup) { setError('An item with this name already exists in this subsection'); return; }
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        brand: form?.brand?.trim() || null,
        unit_type: form?.unit_type?.trim() || 'Each',
        subsection_id: subsection?.id,
        department_id: department?.id,
        is_custom: true,
        is_active: true,
        office_id: officeId || null,
      };
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_catalog_edit', { action: 'add_item', ...payload });
        onSave({ id: `temp_${Date.now()}`, ...payload, _pending: true });
      } else {
        const result = await supplyRequestService?.upsertItem(payload);
        onSave(result);
      }
    } catch (e) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-2 mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
      <p className="text-xs font-semibold text-emerald-700 mb-2">New Item in {subsection?.name}</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={form?.name}
          onChange={e => { setForm(p => ({ ...p, name: e?.target?.value })); setError(''); }}
          placeholder="Item name *"
          className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ fontSize: '16px' }}
        />
        <input
          type="text"
          value={form?.brand}
          onChange={e => setForm(p => ({ ...p, brand: e?.target?.value }))}
          placeholder="Brand (optional)"
          className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ fontSize: '16px' }}
        />
        <input
          type="text"
          value={form?.unit_type}
          onChange={e => setForm(p => ({ ...p, unit_type: e?.target?.value }))}
          placeholder="Unit type (e.g. Each, Box, Pack)"
          className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ fontSize: '16px' }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
        >
          <Icon name="Check" size={14} />{saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold active:scale-95 transition-all">
          <Icon name="X" size={14} />Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Inline Edit Item Form ────────────────────────────────────────────────────
const InlineEditItem = ({ item, onSave, onCancel }) => {
  const [form, setForm] = useState({ name: item?.name || '', brand: item?.brand || '', unit_type: item?.unit_type || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form?.name?.trim()) { setError('Item name is required'); return; }
    setSaving(true);
    try {
      const result = await supplyRequestService?.upsertItem({ ...item, ...form, name: form?.name?.trim() });
      onSave(result);
    } catch (e) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-2 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
      <p className="text-xs font-semibold text-blue-700 mb-2">Edit Item</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2 mb-3">
        <input type="text" value={form?.name} onChange={e => setForm(p => ({ ...p, name: e?.target?.value }))}
          placeholder="Item name *" className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none" style={{ fontSize: '16px' }} />
        <input type="text" value={form?.brand} onChange={e => setForm(p => ({ ...p, brand: e?.target?.value }))}
          placeholder="Brand" className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none" style={{ fontSize: '16px' }} />
        <input type="text" value={form?.unit_type} onChange={e => setForm(p => ({ ...p, unit_type: e?.target?.value }))}
          placeholder="Unit type" className="w-full px-3 py-2 border border-border rounded-xl text-base bg-background focus:outline-none" style={{ fontSize: '16px' }} />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95">
          <Icon name="Check" size={14} />{saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold active:scale-95">
          <Icon name="X" size={14} />Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Item Row ─────────────────────────────────────────────────────────────────
const ItemRow = ({ item, inventory, isAdmin, onStockSaved, onItemEdited, onDeactivate, isOffline, officeId, searchQuery }) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const invRecord = inventory?.find(inv => inv?.item_id === item?.id);
  const currentQty = invRecord?.quantity_on_hand ?? null;
  const status = invRecord?.inv_status || null;

  const STATUS_COLORS = {
    in_stock: 'bg-emerald-100 text-emerald-700',
    low: 'bg-yellow-100 text-yellow-700',
    critically_low: 'bg-orange-100 text-orange-700',
    out_of_stock: 'bg-red-100 text-red-700',
    discontinued: 'bg-gray-100 text-gray-500',
  };
  const STATUS_LABELS = {
    in_stock: 'In Stock', low: 'Low', critically_low: 'Critical', out_of_stock: 'Out', discontinued: 'Discontinued',
  };

  const handleStockDone = async (qty) => {
    setSaving(true);
    try {
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_catalog_edit', {
          action: 'set_stock',
          item_id: item?.id,
          item_name: item?.name,
          office_id: officeId,
          inventory_id: invRecord?.id || null,
          new_qty: qty,
        });
      } else {
        if (invRecord?.id) {
          await supplyRequestService?.adjustInventory(invRecord?.id, qty, 'Manual stock update from catalog', '');
        } else {
          await supplyRequestService?.upsertInventoryItem({
            item_id: item?.id,
            item_name: item?.name,
            office_id: officeId,
            department_id: item?.department_id,
            subsection_id: item?.subsection_id,
            quantity_on_hand: qty,
            brand: item?.brand || '',
            unit_type: item?.unit_type || 'Each',
          });
        }
      }
      if (navigator.vibrate) navigator.vibrate(200);
      onStockSaved(item?.id, qty);
      setShowKeypad(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const highlightText = (text) => {
    if (!searchQuery || !text) return text;
    const idx = text?.toLowerCase()?.indexOf(searchQuery?.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text?.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded">{text?.slice(idx, idx + searchQuery?.length)}</mark>
        {text?.slice(idx + searchQuery?.length)}
      </>
    );
  };

  return (
    <div className={`border-b border-border/30 last:border-0 ${item?._pending ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ minHeight: '52px' }}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{highlightText(item?.name)}</p>
          {item?.brand && <p className="text-xs text-muted-foreground mt-0.5">{item?.brand}</p>}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item?.unit_type && (
              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{item?.unit_type}</span>
            )}
            {item?.is_custom && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span>
            )}
            {item?._pending && (
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Pending sync</span>
            )}
            {status && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${STATUS_COLORS?.[status] || 'bg-gray-100 text-gray-500'}`}>
                {STATUS_LABELS?.[status] || status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Stock level chip */}
          <button
            onClick={() => { setShowKeypad(p => !p); setShowEdit(false); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
              currentQty === null
                ? 'border-dashed border-muted-foreground text-muted-foreground bg-transparent'
                : currentQty === 0
                ? 'border-red-300 bg-red-50 text-red-700' :'border-emerald-300 bg-emerald-50 text-emerald-700'
            }`}
          >
            <Icon name="Package" size={12} />
            {currentQty === null ? 'Add' : currentQty}
          </button>
          {/* Edit button */}
          {isAdmin && (
            <button
              onClick={() => { setShowEdit(p => !p); setShowKeypad(false); }}
              className="flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground active:scale-95 transition-all"
              style={{ width: '44px', height: '44px' }}
              title="Edit item"
            >
              <Icon name="Pencil" size={15} />
            </button>
          )}
          {/* Deactivate */}
          {isAdmin && (
            <button
              onClick={() => onDeactivate(item)}
              className="flex items-center justify-center rounded-xl bg-muted hover:bg-red-50 text-muted-foreground hover:text-red-600 active:scale-95 transition-all"
              style={{ width: '44px', height: '44px' }}
              title="Deactivate item"
            >
              <Icon name="EyeOff" size={15} />
            </button>
          )}
        </div>
      </div>
      {/* Inline keypad */}
      {showKeypad && (
        <InlineNumericKeypad
          itemName={item?.name}
          currentQty={currentQty ?? 0}
          onDone={handleStockDone}
          onCancel={() => setShowKeypad(false)}
        />
      )}
      {/* Inline edit */}
      {showEdit && (
        <InlineEditItem
          item={item}
          onSave={(updated) => { onItemEdited(updated); setShowEdit(false); }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  );
};

// ─── Subsection Accordion ─────────────────────────────────────────────────────
const SubsectionAccordion = ({ subsection, department, items, inventory, isAdmin, onStockSaved, onItemEdited, onDeactivateItem, onSubsectionUpdated, isOffline, officeId, searchQuery }) => {
  const [expanded, setExpanded] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [localItems, setLocalItems] = useState(items || []);

  useEffect(() => { setLocalItems(items || []); }, [items]);

  const existingItemNames = localItems?.map(i => i?.name);

  const handleItemSaved = (newItem) => {
    setLocalItems(prev => [...prev, newItem]);
    setShowAddItem(false);
    onItemEdited?.(newItem);
  };

  const handleItemEdited = (updated) => {
    setLocalItems(prev => prev?.map(i => i?.id === updated?.id ? updated : i));
    onItemEdited?.(updated);
  };

  const handleDeactivate = async (item) => {
    try {
      await supplyRequestService?.upsertItem({ ...item, is_active: false });
      setLocalItems(prev => prev?.filter(i => i?.id !== item?.id));
    } catch (e) { console.error(e); }
  };

  return (
    <div className={`border-b border-border/40 last:border-0 ${expanded ? 'bg-muted/10' : ''}`}>
      {/* Subsection header */}
      <div
        className="flex items-center gap-3 px-4 cursor-pointer select-none hover:bg-muted/20 active:bg-muted/30 transition-colors"
        style={{ minHeight: '56px' }}
        onClick={() => setExpanded(p => !p)}
      >
        <Icon name="FolderOpen" size={15} className="text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{subsection?.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
            {localItems?.length}
          </span>
          {subsection?.is_custom && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span>
          )}
          {isAdmin && (
            <>
              <button
                onClick={e => { e?.stopPropagation(); onSubsectionUpdated?.('edit', subsection); }}
                className="flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground active:scale-95"
                style={{ width: '44px', height: '44px' }}
                title="Edit subsection"
              >
                <Icon name="Pencil" size={14} />
              </button>
              <button
                onClick={e => { e?.stopPropagation(); onSubsectionUpdated?.('deactivate', subsection); }}
                className="flex items-center justify-center rounded-xl bg-muted hover:bg-red-50 text-muted-foreground hover:text-red-600 active:scale-95"
                style={{ width: '44px', height: '44px' }}
                title="Deactivate subsection"
              >
                <Icon name="EyeOff" size={14} />
              </button>
            </>
          )}
          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
        </div>
      </div>
      {/* Items list */}
      {expanded && (
        <div className="border-t border-border/30">
          {localItems?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No items in this subsection</p>
          ) : (
            localItems?.map(item => (
              <ItemRow
                key={item?.id}
                item={item}
                inventory={inventory}
                isAdmin={isAdmin}
                onStockSaved={onStockSaved}
                onItemEdited={handleItemEdited}
                onDeactivate={handleDeactivate}
                isOffline={isOffline}
                officeId={officeId}
                searchQuery={searchQuery}
              />
            ))
          )}

          {/* Inline add item form */}
          {showAddItem && (
            <InlineAddItem
              subsection={subsection}
              department={department}
              existingNames={existingItemNames}
              onSave={handleItemSaved}
              onCancel={() => setShowAddItem(false)}
              isOffline={isOffline}
              officeId={officeId}
            />
          )}

          {/* Add Custom Item pill button */}
          {isAdmin && !showAddItem && (
            <button
              onClick={() => setShowAddItem(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary border-2 border-dashed border-primary/40 rounded-2xl hover:bg-primary/5 active:scale-95 transition-all mx-0 my-2"
              style={{ minHeight: '48px' }}
            >
              <Icon name="Plus" size={16} />
              Add Custom Item
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Department Accordion ─────────────────────────────────────────────────────
const DepartmentAccordion = ({ dept, subsections, items, inventory, isAdmin, onStockSaved, onItemEdited, isOffline, officeId, searchQuery, isExpanded, onToggle }) => {
  const [showAddSub, setShowAddSub] = useState(false);
  const [localSubs, setLocalSubs] = useState(subsections || []);

  useEffect(() => { setLocalSubs(subsections || []); }, [subsections]);

  const existingSubNames = localSubs?.map(s => s?.name);
  const totalItems = localSubs?.reduce((acc, s) => acc + (items?.filter(i => i?.subsection_id === s?.id)?.length || 0), 0);

  const handleSubSaved = (newSub) => {
    setLocalSubs(prev => [...prev, newSub]);
    setShowAddSub(false);
  };

  const handleSubsectionAction = async (action, sub) => {
    if (action === 'deactivate') {
      try {
        await supplyRequestService?.upsertSubsection({ ...sub, is_active: false });
        setLocalSubs(prev => prev?.filter(s => s?.id !== sub?.id));
      } catch (e) { console.error(e); }
    }
  };

  return (
    <div
      className={`bg-card border rounded-2xl overflow-hidden transition-all ${
        isExpanded ? 'border-blue-400 shadow-md' : 'border-border'
      }`}
    >
      {/* Department header */}
      <div
        className={`flex items-center gap-3 px-4 cursor-pointer select-none hover:bg-muted/20 active:bg-muted/30 transition-colors ${
          isExpanded ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
        }`}
        style={{ minHeight: '64px' }}
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name={dept?.icon || 'Package'} size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-foreground">{dept?.name}</p>
            {dept?.is_custom && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{localSubs?.length}</span> subsections
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{totalItems}</span> items
            </span>
          </div>
        </div>
        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={20} className="text-muted-foreground flex-shrink-0" />
      </div>
      {/* Subsections */}
      {isExpanded && (
        <div className="border-t border-border">
          {localSubs?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No subsections</p>
          ) : (
            localSubs?.map(sub => (
              <SubsectionAccordion
                key={sub?.id}
                subsection={sub}
                department={dept}
                items={items?.filter(i => i?.subsection_id === sub?.id) || []}
                inventory={inventory}
                isAdmin={isAdmin}
                onStockSaved={onStockSaved}
                onItemEdited={onItemEdited}
                onDeactivateItem={() => {}}
                onSubsectionUpdated={handleSubsectionAction}
                isOffline={isOffline}
                officeId={officeId}
                searchQuery={searchQuery}
              />
            ))
          )}

          {/* Inline add subsection form */}
          {showAddSub && (
            <InlineAddSubsection
              department={dept}
              existingNames={existingSubNames}
              onSave={handleSubSaved}
              onCancel={() => setShowAddSub(false)}
              isOffline={isOffline}
              officeId={officeId}
            />
          )}

          {/* Add Custom Subsection pill button */}
          {isAdmin && !showAddSub && (
            <button
              onClick={() => setShowAddSub(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 border-2 border-dashed border-blue-300 rounded-2xl hover:bg-blue-50 active:scale-95 transition-all m-2"
              style={{ minHeight: '48px', width: 'calc(100% - 16px)' }}
            >
              <Icon name="Plus" size={16} />
              Add Custom Subsection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main MobileCatalogView ───────────────────────────────────────────────────
const MobileCatalogView = ({ isAdmin, officeId }) => {
  const [departments, setDepartments] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedDepts, setExpandedDepts] = useState({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isCached, setIsCached] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); load(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = offlineQueueService?.onSyncStatusChange(count => setPendingCount(count));
    offlineQueueService?.getPendingCount()?.then(setPendingCount);
    return unsub;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const wasOffline = !navigator.onLine;
      const [depts, subs, itms, inv] = await Promise.all([
        supplyRequestService?.fetchDepartments(),
        supplyRequestService?.fetchSubsections(),
        supplyRequestService?.fetchItems(),
        officeId ? supplyRequestService?.fetchInventory({ officeId }) : Promise.resolve([]),
      ]);
      setDepartments(depts);
      setSubsections(subs);
      setItems(itms);
      setInventory(inv);
      setIsCached(wasOffline);
    } catch (e) { setError(e?.message || 'Failed to load catalog'); }
    finally { setLoading(false); }
  }, [officeId]);

  useEffect(() => { load(); }, [load]);

  const toggleDept = (id) => setExpandedDepts(prev => ({ ...prev, [id]: !prev?.[id] }));

  // ── Filtering ──
  const q = search?.trim()?.toLowerCase();

  const getFilteredItems = (subId) => {
    const its = items?.filter(i => i?.subsection_id === subId);
    if (!q) return its;
    return its?.filter(i =>
      i?.name?.toLowerCase()?.includes(q) ||
      i?.brand?.toLowerCase()?.includes(q)
    );
  };

  const getFilteredSubs = (deptId) => {
    const subs = subsections?.filter(s => s?.department_id === deptId);
    if (!q) return subs;
    return subs?.filter(s => {
      const subItems = items?.filter(i => i?.subsection_id === s?.id);
      return s?.name?.toLowerCase()?.includes(q) ||
        subItems?.some(i => i?.name?.toLowerCase()?.includes(q) || i?.brand?.toLowerCase()?.includes(q));
    });
  };

  const filteredDepts = q
    ? departments?.filter(d => {
        const subs = getFilteredSubs(d?.id);
        return d?.name?.toLowerCase()?.includes(q) || subs?.length > 0;
      })
    : departments;

  const totalResults = q
    ? filteredDepts?.reduce((acc, d) => acc + getFilteredSubs(d?.id)?.reduce((a, s) => a + getFilteredItems(s?.id)?.length, 0), 0)
    : null;

  const handleStockSaved = (itemId, qty) => {
    setInventory(prev => {
      const existing = prev?.find(inv => inv?.item_id === itemId);
      if (existing) {
        return prev?.map(inv => inv?.item_id === itemId ? { ...inv, quantity_on_hand: qty } : inv);
      }
      return [...prev, { item_id: itemId, quantity_on_hand: qty, office_id: officeId }];
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading catalog...</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-0">
      {/* Offline / cached banner */}
      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border-b border-yellow-200">
          <Icon name="WifiOff" size={14} className="text-yellow-600 flex-shrink-0" />
          <span className="text-xs font-medium text-yellow-700">
            Offline — Viewing cached catalog
            {pendingCount > 0 && ` · ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`}
          </span>
        </div>
      )}
      {isCached && !isOffline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <Icon name="Database" size={13} className="text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-500">Viewing cached catalog</span>
        </div>
      )}
      {/* Sticky search bar */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e?.target?.value)}
            placeholder="Search departments, subsections, items..."
            className="w-full pl-10 pr-10 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ height: '52px', fontSize: '16px' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-lg"
            >
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
        {q && (
          <p className="text-xs text-muted-foreground mt-1.5 px-1">
            {totalResults === 0 ? (
              <span className="text-red-500">No results found for "{search}"</span>
            ) : (
              <span>{totalResults} item{totalResults !== 1 ? 's' : ''} matching "{search}"</span>
            )}
          </p>
        )}
      </div>
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {/* Stats bar */}
      {!q && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{departments?.length}</span> departments
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{items?.length}</span> items
          </span>
          {pendingCount > 0 && (
            <>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                {pendingCount} pending
              </span>
            </>
          )}
        </div>
      )}
      {/* Departments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-8">
        {filteredDepts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="SearchX" size={40} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found for "{search}"</p>
            <button onClick={() => setSearch('')} className="text-sm text-primary font-medium">Clear search</button>
          </div>
        ) : (
          filteredDepts?.map(dept => (
            <DepartmentAccordion
              key={dept?.id}
              dept={dept}
              subsections={getFilteredSubs(dept?.id)}
              items={items}
              inventory={inventory}
              isAdmin={isAdmin}
              onStockSaved={handleStockSaved}
              onItemEdited={() => {}}
              isOffline={isOffline}
              officeId={officeId}
              searchQuery={q}
              isExpanded={!!expandedDepts?.[dept?.id]}
              onToggle={() => toggleDept(dept?.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MobileCatalogView;
