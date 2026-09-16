import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import { frontDeskInventoryService } from '../../../services/frontDeskInventoryService';
import { supplyRequestService } from '../../../services/supplyRequestService';
import FrontDeskUrgentModal from './FrontDeskUrgentModal';
import FrontDeskRequestHistory from './FrontDeskRequestHistory';
import FrontDeskCurrentInventory from './FrontDeskCurrentInventory';
import FrontDeskAmazonOrderHistory from './FrontDeskAmazonOrderHistory';
import useRolePermissions from '../../../hooks/useRolePermissions';
import { dashboardEnvironment } from '../../../config/dashboardEnvironment';

const OFFICES = frontDeskInventoryService?.getOffices();
const CATEGORIES = frontDeskInventoryService?.getCategories();

const STATUS_CONFIG = {
  'In Stock':      { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30', row: '' },
  'Low':           { bg: 'bg-warning/10',  text: 'text-warning',  border: 'border-warning/30',  row: 'bg-warning/5' },
  'Critically Low':{ bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  row: 'bg-orange-50/50' },
  'Out of Stock':  { bg: 'bg-destructive/10',     text: 'text-destructive',     border: 'border-destructive/30',     row: 'bg-destructive/5' },
  'Discontinued':  { bg: 'bg-muted',    text: 'text-muted-foreground',    border: 'border-border',    row: 'opacity-50' },
};

const PRIORITY_CONFIG = {
  'Normal':    { bg: 'bg-muted',   text: 'text-muted-foreground' },
  'Important': { bg: 'bg-primary/10',    text: 'text-primary' },
  'High':      { bg: 'bg-warning/10',   text: 'text-warning' },
  'Urgent':    { bg: 'bg-orange-100',  text: 'text-orange-700' },
  'Critical':  { bg: 'bg-destructive/10',     text: 'text-destructive' },
};

const ORDER_STATUS_CONFIG = {
  'Not Ordered':        { bg: 'bg-muted',    text: 'text-muted-foreground' },
  'Draft':              { bg: 'bg-muted',   text: 'text-muted-foreground' },
  'Submitted':          { bg: 'bg-primary/10',    text: 'text-primary' },
  'Approved':           { bg: 'bg-primary/10',  text: 'text-primary' },
  'Ordered':            { bg: 'bg-accent/10',  text: 'text-accent' },
  'Partially Fulfilled':{ bg: 'bg-warning/10',   text: 'text-warning' },
  'Fulfilled':          { bg: 'bg-success/10', text: 'text-success' },
  'Rejected':           { bg: 'bg-destructive/10',     text: 'text-destructive' },
};

const REQUEST_PRIORITIES = ['Normal', 'Important', 'High', 'Urgent', 'Critical'];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.['In Stock'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CONFIG?.[priority] || PRIORITY_CONFIG?.['Normal'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.bg} ${cfg?.text}`}>
      {priority}
    </span>
  );
};

const OrderStatusBadge = ({ orderStatus }) => {
  const cfg = ORDER_STATUS_CONFIG?.[orderStatus] || ORDER_STATUS_CONFIG?.['Not Ordered'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.bg} ${cfg?.text}`}>
      {orderStatus}
    </span>
  );
};

// ── Inline Qty Editor ────────────────────────────────────────────────────────
const InlineQtyEditor = ({ item, onSave, onCancel, isStaff }) => {
  const [val, setVal] = useState(String(item?.current_qty ?? 0));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef?.current?.focus(); inputRef?.current?.select(); }, []);

  const handleSave = async () => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setSaving(true);
    try {
      await onSave(item?.id, num);
      if (navigator?.vibrate) navigator.vibrate(50);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min="0"
        value={val}
        onChange={e => setVal(e?.target?.value)}
        onKeyDown={e => { if (e?.key === 'Enter') handleSave(); if (e?.key === 'Escape') onCancel(); }}
        className="w-16 px-2 py-1 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
        title="Save"
      >
        {saving ? <div className="w-3 h-3 border border-emerald-700 border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={12} />}
      </button>
      <button
        onClick={onCancel}
        className="p-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        title="Cancel"
      >
        <Icon name="X" size={12} />
      </button>
    </div>
  );
};

// ── Inline Add Row ────────────────────────────────────────────────────────────
const InlineAddRow = ({ category, officeLocation, onSave, onCancel }) => {
  const [itemName, setItemName] = useState('');
  const [minRequired, setMinRequired] = useState('5');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!itemName?.trim()) { setError('Item name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        office_location: officeLocation,
        category,
        item_name: itemName?.trim(),
        current_qty: 0,
        min_required: parseInt(minRequired, 10) || 5,
        notes: notes?.trim() || null,
        status: 'Out of Stock',
        priority: 'Normal',
        order_status: 'Not Ordered',
      });
    } catch (err) {
      setError(err?.message || 'Failed to add item');
      setSaving(false);
    }
  };

  return (
    <tr className="bg-primary/5 border-t border-border">
      <td className="px-3 py-2">
        <input
          autoFocus
          type="text"
          placeholder="Item name *"
          value={itemName}
          onChange={e => setItemName(e?.target?.value)}
          onKeyDown={e => { if (e?.key === 'Enter') handleSave(); if (e?.key === 'Escape') onCancel(); }}
          className="w-full px-2 py-1 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </td>
      <td className="px-3 py-2"><span className="text-xs text-muted-foreground">0</span></td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="1"
          value={minRequired}
          onChange={e => setMinRequired(e?.target?.value)}
          className="w-14 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none"
        />
      </td>
      <td className="px-3 py-2"><StatusBadge status="Out of Stock" /></td>
      <td className="px-3 py-2"><PriorityBadge priority="Normal" /></td>
      <td className="px-3 py-2"><span className="text-xs text-muted-foreground">—</span></td>
      <td className="px-3 py-2"><OrderStatusBadge orderStatus="Not Ordered" /></td>
      <td className="px-3 py-2">
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e?.target?.value)}
          className="w-full px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 bg-success text-success-foreground rounded-lg text-xs font-semibold hover:bg-success/90 transition-colors"
          >
            {saving ? <div className="w-3 h-3 border border-success-foreground border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
            Save
          </button>
          <button onClick={onCancel} className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs hover:bg-muted/80 transition-colors">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
};

// ── Category Accordion ────────────────────────────────────────────────────────────
const CategoryAccordion = ({ category, items, isAdmin, isStaff, officeLocation, onQtySave, onRowSave, onAddRow, onUrgentRequest, canSubmitOrder, onAddToRequest }) => {
  const [open, setOpen] = useState(false);
  const [editingQtyId, setEditingQtyId] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editRowData, setEditRowData] = useState({});
  const [showAddRow, setShowAddRow] = useState(false);
  const [savingRow, setSavingRow] = useState(false);

  const criticalCount = items?.filter(i => i?.status === 'Critically Low' || i?.status === 'Out of Stock')?.length;
  const lowCount = items?.filter(i => i?.status === 'Low')?.length;

  const handleQtySave = async (id, qty) => {
    await onQtySave(id, qty);
    setEditingQtyId(null);
  };

  const handleRowEditSave = async (id) => {
    setSavingRow(true);
    try {
      await onRowSave(id, editRowData);
      setEditingRowId(null);
      setEditRowData({});
    } finally { setSavingRow(false); }
  };

  const startEditRow = (item) => {
    setEditingRowId(item?.id);
    setEditRowData({
      item_name: item?.item_name,
      min_required: item?.min_required,
      priority: item?.priority,
      order_status: item?.order_status,
      notes: item?.notes || '',
      last_supplied_date: item?.last_supplied_date || '',
      requested_by: item?.requested_by || '',
      approved_by: item?.approved_by || '',
    });
  };

  const handleAddRow = async (rowData) => {
    await onAddRow(rowData);
    setShowAddRow(false);
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      {/* Accordion Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={16} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{category}</span>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
            {items?.length} items
          </span>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
              {criticalCount} critical
            </span>
          )}
          {lowCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full border border-yellow-200">
              {lowCount} low
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={e => { e?.stopPropagation(); setOpen(true); setShowAddRow(true); }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors border border-border"
              title="Admin only: add a new catalog item to this category"
            >
              <Icon name="Plus" size={11} />Admin: Add Catalog Item
            </button>
          )}
        </div>
      </button>
      {/* Accordion Body */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Qty</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Req.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Supplied</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items?.map(item => {
                const rowCfg = STATUS_CONFIG?.[item?.status];
                const isEditingQty = editingQtyId === item?.id;
                const isEditingRow = editingRowId === item?.id;
                const isCritical = item?.status === 'Critically Low' || item?.status === 'Out of Stock';

                return (
                  <tr key={item?.id} className={`hover:bg-muted/10 transition-colors ${rowCfg?.row || ''}`}>
                    <td className="px-3 py-2">
                      {isEditingRow ? (
                        <input
                          type="text"
                          value={editRowData?.item_name || ''}
                          onChange={e => setEditRowData(d => ({ ...d, item_name: e?.target?.value }))}
                          className="w-full px-2 py-1 text-sm border border-primary rounded-lg focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium text-foreground">{item?.item_name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditingQty ? (
                        <InlineQtyEditor
                          item={item}
                          onSave={handleQtySave}
                          onCancel={() => setEditingQtyId(null)}
                          isStaff={isStaff}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingQtyId(item?.id)}
                          className="flex items-center gap-1 group"
                          title="Click to edit quantity"
                        >
                          <span className={`font-bold text-base ${item?.current_qty === 0 ? 'text-red-600' : item?.current_qty <= item?.min_required ? 'text-yellow-600' : 'text-foreground'}`}>
                            {item?.current_qty}
                          </span>
                          <Icon name="Pencil" size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditingRow ? (
                        <input
                          type="number"
                          min="1"
                          value={editRowData?.min_required || ''}
                          onChange={e => setEditRowData(d => ({ ...d, min_required: parseInt(e?.target?.value, 10) }))}
                          className="w-14 px-2 py-1 text-sm border border-primary rounded-lg focus:outline-none"
                        />
                      ) : (
                        <span className="text-muted-foreground">{item?.min_required}</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={item?.status} /></td>
                    <td className="px-3 py-2">
                      {isEditingRow ? (
                        <select
                          value={editRowData?.priority || 'Normal'}
                          onChange={e => setEditRowData(d => ({ ...d, priority: e?.target?.value }))}
                          className="text-xs border border-primary rounded-lg px-1 py-1 focus:outline-none"
                        >
                          {['Normal','Important','High','Urgent','Critical']?.map(p => <option key={p}>{p}</option>)}
                        </select>
                      ) : (
                        <PriorityBadge priority={item?.priority} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditingRow ? (
                        <input
                          type="date"
                          value={editRowData?.last_supplied_date || ''}
                          onChange={e => setEditRowData(d => ({ ...d, last_supplied_date: e?.target?.value }))}
                          className="text-xs border border-primary rounded-lg px-1 py-1 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item?.last_supplied_date ? new Date(item?.last_supplied_date + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditingRow ? (
                        <select
                          value={editRowData?.order_status || 'Not Ordered'}
                          onChange={e => setEditRowData(d => ({ ...d, order_status: e?.target?.value }))}
                          className="text-xs border border-primary rounded-lg px-1 py-1 focus:outline-none"
                        >
                          {Object.keys(ORDER_STATUS_CONFIG)?.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <OrderStatusBadge orderStatus={item?.order_status} />
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[140px]">
                      {isEditingRow ? (
                        <input
                          type="text"
                          value={editRowData?.notes || ''}
                          onChange={e => setEditRowData(d => ({ ...d, notes: e?.target?.value }))}
                          className="w-full px-2 py-1 text-xs border border-primary rounded-lg focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block" title={item?.notes || ''}>
                          {item?.notes ? (item?.notes?.length > 30 ? item?.notes?.slice(0, 30) + '…' : item?.notes) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {isEditingRow ? (
                          <>
                            <button
                              onClick={() => handleRowEditSave(item?.id)}
                              disabled={savingRow}
                              className="flex items-center gap-1 px-2 py-1 bg-success text-success-foreground rounded-lg text-xs font-semibold hover:bg-success/90"
                            >
                              {savingRow ? <div className="w-3 h-3 border border-success-foreground border-t-transparent rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingRowId(null); setEditRowData({}); }}
                              className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs hover:bg-muted/80"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {!isStaff && (
                              <button
                                onClick={() => startEditRow(item)}
                                className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Edit row"
                              >
                                <Icon name="Pencil" size={13} />
                              </button>
                            )}
                            {canSubmitOrder && (
                              <button
                                onClick={() => onAddToRequest(item)}
                                className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors"
                                title="Add to request"
                              >
                                <Icon name="ShoppingCart" size={11} />Request
                              </button>
                            )}
                            {isCritical && canSubmitOrder && (
                              <button
                                onClick={() => onUrgentRequest(item)}
                                className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                                title="Submit urgent request"
                              >
                                <Icon name="AlertTriangle" size={11} />Urgent
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {showAddRow && isAdmin && (
                <InlineAddRow
                  category={category}
                  officeLocation={officeLocation}
                  onSave={handleAddRow}
                  onCancel={() => setShowAddRow(false)}
                />
              )}
            </tbody>
          </table>
          {isAdmin && !showAddRow && (
            <div className="px-4 py-2 border-t border-border">
              <button
                onClick={() => setShowAddRow(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                title="Admin only: add a new catalog item"
              >
                <Icon name="Plus" size={13} />Admin: Add Catalog Item to {category}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Quick Request Panel ───────────────────────────────────────────────────────
const QuickRequestPanel = ({
  inventoryItems,
  quickOffice,
  setQuickOffice,
  quickMonth,
  setQuickMonth,
  requesterName,
  requesterEmail,
  canSubmitOrder,
  onCartUpdated,
  cartCount,
}) => {
  const [itemSearch, setItemSearch] = useState('');
  const [matchedItems, setMatchedItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // existing catalog item
  const [qty, setQty] = useState(1);
  const [priority, setPriority] = useState('Normal');
  const [notes, setNotes] = useState('');
  const [addError, setAddError] = useState('');
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Search existing inventory items
  useEffect(() => {
    if (!itemSearch?.trim()) {
      setMatchedItems([]);
      setShowDropdown(false);
      return;
    }
    const term = itemSearch?.toLowerCase();
    // Normalize: remove spaces for fuzzy match (paperclip → paper clip)
    const termNorm = term?.replace(/\s+/g, '');
    const matches = inventoryItems?.filter(i => {
      const name = i?.item_name?.toLowerCase() || '';
      const nameNorm = name?.replace(/\s+/g, '');
      return name?.includes(term) || nameNorm?.includes(termNorm);
    });
    setMatchedItems(matches || []);
    setShowDropdown(true);
  }, [itemSearch, inventoryItems]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef?.current && !dropdownRef?.current?.contains(e?.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectExisting = (item) => {
    setSelectedItem(item);
    setItemSearch(item?.item_name);
    setShowDropdown(false);
  };

  const handleClearItem = () => {
    setSelectedItem(null);
    setItemSearch('');
    setAddError('');
  };

  const handleAddToCart = () => {
    setAddError('');
    const finalName = selectedItem ? selectedItem?.item_name : itemSearch?.trim();
    if (!finalName) {
      setAddError('Please enter or select an item name.');
      return;
    }
    if (!qty || qty < 1) {
      setAddError('Quantity must be at least 1.');
      return;
    }
    const cartItem = {
      _id: Date.now() + Math.random(),
      item_name: finalName,
      category: selectedItem?.category || 'Front Desk',
      qty: parseInt(qty, 10) || 1,
      priority,
      notes: notes?.trim() || '',
      is_custom: !selectedItem,
      catalog_item_id: selectedItem?.id || null,
    };
    onCartUpdated(prev => [...prev, cartItem]);
    // Reset item fields only
    setItemSearch('');
    setSelectedItem(null);
    setQty(1);
    setPriority('Normal');
    setNotes('');
    setAddError('');
  };

  const isCustom = itemSearch?.trim() && matchedItems?.length === 0 && !selectedItem;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon name="ShoppingCart" size={15} color="var(--color-primary)" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">New Front Office Request</h3>
          <p className="text-xs text-muted-foreground">Search an existing item or type what you need — routes to Regional Manager</p>
        </div>
        {cartCount > 0 && (
          <span className="ml-auto px-2.5 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
            {cartCount} in cart
          </span>
        )}
      </div>

      {/* ── Row 1: Office Location + Request Month ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">
            Office Location <span className="text-destructive">*</span>
          </label>
          <select
            value={quickOffice}
            onChange={e => setQuickOffice(e?.target?.value)}
            className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${!quickOffice ? 'border-destructive/50' : 'border-border'}`}
          >
            <option value="">— Select Office —</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {!quickOffice && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />Required before submitting
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">
            Request Month <span className="text-destructive">*</span>
          </label>
          <input
            type="month"
            value={quickMonth}
            onChange={e => setQuickMonth(e?.target?.value)}
            className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${!quickMonth ? 'border-destructive/50' : 'border-border'}`}
          />
          {!quickMonth && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />Required before submitting
            </p>
          )}
        </div>
      </div>

      {/* ── Row 2: Requester Identity (read from auth profile) ── */}
      <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-background border border-border rounded-lg">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Icon name="User" size={12} />Requester (from your profile)
        </p>
        {requesterName || requesterEmail ? (
          <div className="flex items-center gap-3 flex-wrap">
            {requesterName && (
              <span className="text-sm font-semibold text-foreground">{requesterName}</span>
            )}
            {requesterEmail && (
              <span className="text-xs text-muted-foreground">{requesterEmail}</span>
            )}
            <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-semibold rounded-full border border-success/20 flex items-center gap-1">
              <Icon name="CheckCircle" size={10} />Identity confirmed
            </span>
          </div>
        ) : (
          <p className="text-xs text-warning flex items-center gap-1">
            <Icon name="AlertTriangle" size={11} />Requester identity not found in profile — please ensure your profile has a name and email.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          You will be alerted when this request is fulfilled or rejected via your profile email.
        </p>
      </div>

      {/* ── Row 3: Item search + Qty + Priority ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Item search / name */}
        <div className="lg:col-span-2 flex flex-col gap-1" ref={dropdownRef}>
          <label className="text-xs font-semibold text-muted-foreground">Item Name <span className="text-destructive">*</span></label>
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search existing item or type new item name..."
              value={itemSearch}
              onChange={e => { setItemSearch(e?.target?.value); setSelectedItem(null); }}
              onFocus={() => { if (matchedItems?.length > 0) setShowDropdown(true); }}
              className={`w-full pl-8 pr-8 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${selectedItem ? 'border-primary bg-primary/5' : 'border-border'}`}
            />
            {itemSearch && (
              <button onClick={handleClearItem} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <Icon name="X" size={13} />
              </button>
            )}
            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {matchedItems?.length > 0 ? (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30">
                      Existing Front Desk items
                    </div>
                    {matchedItems?.map(item => (
                      <button
                        key={item?.id}
                        onClick={() => handleSelectExisting(item)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 text-left transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-foreground">{item?.item_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{item?.category}</span>
                        </div>
                        <StatusBadge status={item?.status} />
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="px-3 py-3">
                    <p className="text-xs text-muted-foreground mb-2">No existing item matched — you can request it as a new/missing item:</p>
                    <button
                      onClick={() => { setShowDropdown(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-sm font-semibold text-warning hover:bg-warning/20 transition-colors w-full"
                    >
                      <Icon name="Plus" size={14} />
                      Request new/missing item: "{itemSearch}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedItem && (
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <Icon name="CheckCircle" size={11} />Existing item selected — category: {selectedItem?.category}
            </p>
          )}
          {isCustom && (
            <p className="text-xs text-warning font-medium flex items-center gap-1">
              <Icon name="Info" size={11} />New/missing item — will be saved as custom request
            </p>
          )}
        </div>

        {/* Quantity */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Quantity <span className="text-destructive">*</span></label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={e => setQty(e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {REQUEST_PRIORITIES?.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Notes / Reason (optional)</label>
        <input
          type="text"
          placeholder="e.g. Running low, needed for patient check-in..."
          value={notes}
          onChange={e => setNotes(e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {addError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <Icon name="AlertCircle" size={12} />{addError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleAddToCart}
          disabled={!itemSearch?.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="Plus" size={14} />Add to Request
        </button>
        {cartCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {cartCount} item{cartCount !== 1 ? 's' : ''} in cart — scroll down to review &amp; submit
          </span>
        )}
      </div>
    </div>
  );
};

// ── Request Cart ──────────────────────────────────────────────────────────────
const RequestCart = ({
  cart,
  onRemove,
  onEdit,
  onSubmit,
  submitting,
  submitResult,
  quickOffice,
  quickMonth,
  requesterName,
  requesterEmail,
}) => {
  if (cart?.length === 0) return null;

  const missingOffice = !quickOffice;
  const missingMonth = !quickMonth;
  const missingRequester = !requesterName && !requesterEmail;
  const canSubmit = !missingOffice && !missingMonth;

  const monthLabel = quickMonth
    ? new Date(quickMonth + '-01T00:00:00')?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="bg-background border-2 border-primary/30 rounded-xl overflow-hidden">
      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Icon name="ShoppingCart" size={16} color="var(--color-primary)" />
          <span className="text-sm font-bold text-foreground">Request Cart</span>
          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">{cart?.length}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap justify-end">
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Routes to Regional Manager</span>
        </div>
      </div>

      {/* Cart context: office / month / requester */}
      <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <Icon name="MapPin" size={12} className="text-muted-foreground" />
          {quickOffice ? (
            <span className="font-semibold text-foreground">{quickOffice}</span>
          ) : (
            <span className="text-destructive font-semibold flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />Office not selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="Calendar" size={12} className="text-muted-foreground" />
          {monthLabel ? (
            <span className="font-semibold text-foreground">{monthLabel}</span>
          ) : (
            <span className="text-destructive font-semibold flex items-center gap-1">
              <Icon name="AlertCircle" size={11} />Month not selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="User" size={12} className="text-muted-foreground" />
          {requesterName || requesterEmail ? (
            <span className="font-semibold text-foreground">
              {requesterName || '—'}{requesterEmail ? ` · ${requesterEmail}` : ''}
            </span>
          ) : (
            <span className="text-warning font-semibold flex items-center gap-1">
              <Icon name="AlertTriangle" size={11} />Requester identity not in profile
            </span>
          )}
        </div>
      </div>

      {/* Cart items */}
      <div className="divide-y divide-border">
        {cart?.map((item, idx) => (
          <CartItem key={item?._id} item={item} idx={idx} onRemove={onRemove} onEdit={onEdit} />
        ))}
      </div>

      {/* Validation warnings */}
      {(missingOffice || missingMonth) && (
        <div className="px-4 py-2.5 bg-destructive/5 border-t border-destructive/20 text-xs text-destructive flex items-start gap-2">
          <Icon name="AlertCircle" size={13} className="mt-0.5 flex-shrink-0" />
          <span>
            {missingOffice && missingMonth
              ? 'Office Location and Request Month are required before submitting. Please fill them in the form above.'
              : missingOffice
              ? 'Office Location is required. Please select it in the form above.'
              : 'Request Month is required. Please select it in the form above.'}
          </span>
        </div>
      )}

      {/* Submit area */}
      <div className="px-4 py-3 bg-muted/20 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{cart?.length} item{cart?.length !== 1 ? 's' : ''}</span> ready to submit
          {' · '}department: <span className="font-semibold text-foreground">Front Desk</span>
          {' · '}routing: <span className="font-semibold text-foreground">Regional Manager</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          title={!canSubmit ? 'Select Office Location and Request Month before submitting' : undefined}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Submitting…</>
          ) : (
            <><Icon name="Send" size={14} />Submit Request</>
          )}
        </button>
      </div>

      {/* Submit result */}
      {submitResult && (
        <div className={`px-4 py-3 border-t text-sm font-medium flex items-center gap-2 ${submitResult?.success ? 'bg-success/10 border-success/20 text-success' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
          <Icon name={submitResult?.success ? 'CheckCircle' : 'AlertCircle'} size={15} />
          {submitResult?.message}
        </div>
      )}
    </div>
  );
};

const CartItem = ({ item, idx, onRemove, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(item?.qty);
  const [editPriority, setEditPriority] = useState(item?.priority);
  const [editNotes, setEditNotes] = useState(item?.notes || '');

  const handleSaveEdit = () => {
    onEdit(item?._id, { qty: parseInt(editQty, 10) || 1, priority: editPriority, notes: editNotes });
    setEditing(false);
  };

  return (
    <div className="px-4 py-3 hover:bg-muted/10 transition-colors">
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground flex-1">{item?.item_name}</span>
            {item?.is_custom && (
              <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-semibold rounded-full border border-warning/30">Custom</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">Qty</label>
              <input type="number" min="1" value={editQty} onChange={e => setEditQty(e?.target?.value)}
                className="w-16 px-2 py-1 text-sm border border-border rounded-lg focus:outline-none" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">Priority</label>
              <select value={editPriority} onChange={e => setEditPriority(e?.target?.value)}
                className="px-2 py-1 text-sm border border-border rounded-lg focus:outline-none">
                {REQUEST_PRIORITIES?.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-muted-foreground">Notes</label>
              <input type="text" value={editNotes} onChange={e => setEditNotes(e?.target?.value)}
                className="px-2 py-1 text-sm border border-border rounded-lg focus:outline-none w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveEdit} className="flex items-center gap-1 px-3 py-1 bg-success text-success-foreground rounded-lg text-xs font-semibold hover:bg-success/90">
              <Icon name="Check" size={11} />Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 bg-muted text-muted-foreground rounded-lg text-xs hover:bg-muted/80">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{item?.item_name}</span>
              {item?.is_custom && (
                <span className="px-1.5 py-0.5 bg-warning/10 text-warning text-xs font-semibold rounded-full border border-warning/30">Custom</span>
              )}
              <span className="text-xs text-muted-foreground">{item?.category}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Qty: <span className="font-semibold text-foreground">{item?.qty}</span></span>
              <PriorityBadge priority={item?.priority} />
              {item?.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item?.notes}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">
              <Icon name="Pencil" size={13} />
            </button>
            <button onClick={() => onRemove(item?._id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Remove">
              <Icon name="Trash2" size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── FrontDeskRequestReview ────────────────────────────────────────────────────
// Self-contained review/history section for Front Desk requests only.
// Reuses the same approval/rejection/audit patterns as MonthlyRequestTab.
// Filters strictly to department_category = 'Front Desk'.

const FD_STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  partially_fulfilled: 'bg-orange-100 text-orange-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const FD_REVIEW_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'partially_fulfilled', 'fulfilled'];

const FrontDeskRequestReview = ({ isAdmin, isRCM }) => {
  const OFFICES = frontDeskInventoryService?.getOffices();

  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Reviewer notes for approve/reject/under-review
  const [reviewerNote, setReviewerNote] = useState('');
  const [reviewerNoteError, setReviewerNoteError] = useState('');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await supplyRequestService?.fetchRequestBatches({
        requestType: 'monthly',
        departmentCategory: 'Front Desk',
        officeId: filterOffice || undefined,
        status: filterStatus || undefined,
        month: filterMonth || undefined,
      });
      setBatches(data);
    } catch (e) {
      setError(e?.message || 'Failed to load Front Desk requests');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterStatus, filterMonth]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const openDetail = async (batch) => {
    setSelectedBatch(batch);
    setReviewerNote('');
    setReviewerNoteError('');
    try {
      const items = await supplyRequestService?.fetchRequestItems(batch?.id);
      setBatchItems(items);
    } catch (e) {
      setBatchItems([]);
    }
    setView('detail');
  };

  const handleRCMAction = async (batchId, status, notes = '') => {
    try {
      await supplyRequestService?.updateBatchStatus(batchId, status, notes);
      setSuccess(`Request ${status?.replace(/_/g, ' ')}`);
      setTimeout(() => setSuccess(''), 3000);
      setReviewerNote('');
      setReviewerNoteError('');
      setView('list');
      loadBatches();
    } catch (e) {
      setError(e?.message || 'Failed to update status');
    }
  };

  // Client-side search filter (item name / requester)
  const displayedBatches = batches?.filter(b => {
    if (!filterSearch?.trim()) return true;
    const term = filterSearch?.toLowerCase();
    const requester = b?.requested_by_profile?.full_name?.toLowerCase() || '';
    const office = b?.office_id?.toLowerCase() || '';
    return requester?.includes(term) || office?.includes(term);
  });

  // ── Detail view ──────────────────────────────────────────────────────────
  if (view === 'detail' && selectedBatch) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { setView('list'); setReviewerNote(''); setReviewerNoteError(''); }}
          className="p-2 hover:bg-muted rounded-xl"
        >
          <Icon name="ArrowLeft" size={16} />
        </button>
        <h3 className="text-base font-bold text-foreground">Front Desk Request Detail</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${FD_STATUS_BADGE?.[selectedBatch?.batch_status] || 'bg-gray-100 text-gray-700'}`}>
          {selectedBatch?.batch_status?.replace(/_/g, ' ')?.toUpperCase()}
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          🖥 Front Desk
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700"><Icon name="X" size={12} /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>
      )}

      {/* Batch header */}
      <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Office</p>
          <p className="font-medium">{selectedBatch?.office_id || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Request Month</p>
          <p className="font-medium">{selectedBatch?.request_month?.slice(0, 7) || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Requested By</p>
          <p className="font-medium">{selectedBatch?.requested_by_profile?.full_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Submitted</p>
          <p className="font-medium">
            {selectedBatch?.submitted_at ? new Date(selectedBatch.submitted_at)?.toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {/* Review Status panel — always shown */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Regional Manager Review Status
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-block mt-0.5 px-2.5 py-1 rounded-full text-xs font-semibold ${FD_STATUS_BADGE?.[selectedBatch?.batch_status] || 'bg-gray-100 text-gray-700'}`}>
              {selectedBatch?.batch_status?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reviewed By</p>
            <p className="font-medium mt-0.5">{selectedBatch?.reviewer_profile?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="font-medium mt-0.5">
              {selectedBatch?.updated_at ? new Date(selectedBatch.updated_at)?.toLocaleString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reviewer Notes</p>
            <p className="font-medium mt-0.5 break-words">{selectedBatch?.reviewer_notes || '—'}</p>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold">Items ({batchItems?.length})</h4>
        </div>
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
              {batchItems?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">No items found</td>
                </tr>
              ) : batchItems?.map(item => (
                <tr key={item?.id} className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-medium">{item?.custom_item_name || item?.supply_items?.name || '—'}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{item?.supply_departments?.name?.split('/')?.[0]?.trim() || '—'}</td>
                  <td className="py-2.5 px-3">{item?.current_qty_on_hand ?? '—'}</td>
                  <td className="py-2.5 px-3 font-semibold">{item?.requested_qty ?? '—'}</td>
                  <td className="py-2.5 px-3">{item?.approved_qty ?? '—'}</td>
                  <td className="py-2.5 px-3">{item?.fulfilled_qty ?? 0}</td>
                  <td className="py-2.5 px-3"><span className="text-xs capitalize">{item?.priority || '—'}</span></td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${FD_STATUS_BADGE?.[item?.item_status] || 'bg-gray-100 text-gray-700'}`}>
                      {item?.item_status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional Manager Review actions — only when actionable */}
      {(isAdmin || isRCM) && ['submitted', 'under_review']?.includes(selectedBatch?.batch_status) && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">Regional Manager Review</h4>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Front Desk Request</span>
          </div>

          {/* Reviewer notes textarea */}
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

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
          <Icon name="ClipboardList" size={16} className="text-blue-700" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Front Desk Request Review / History</h3>
          <p className="text-xs text-muted-foreground">Regional Manager review queue — Front Desk requests only</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-muted/20 rounded-xl border border-border">
        {/* Office filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Office</label>
          <select
            value={filterOffice}
            onChange={e => setFilterOffice(e?.target?.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
          >
            <option value="">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Month filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Request Month</label>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e?.target?.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e?.target?.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Statuses</option>
            {FD_REVIEW_STATUSES?.map(s => (
              <option key={s} value={s}>{s?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase())}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground">Search Requester / Office</label>
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={filterSearch}
              onChange={e => setFilterSearch(e?.target?.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            />
          </div>
        </div>

        {/* Clear filters */}
        {(filterOffice || filterMonth || filterStatus || filterSearch) && (
          <div className="flex flex-col justify-end">
            <button
              onClick={() => { setFilterOffice(''); setFilterMonth(''); setFilterStatus(''); setFilterSearch(''); }}
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Pending review count badge */}
      {!loading && (() => {
        const pendingCount = batches?.filter(b => b?.batch_status === 'submitted' || b?.batch_status === 'under_review')?.length;
        return pendingCount > 0 ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
            <Icon name="Clock" size={14} className="text-yellow-600" />
            <span className="font-semibold text-yellow-800">{pendingCount} request{pendingCount !== 1 ? 's' : ''} pending Regional Manager review</span>
          </div>
        ) : null;
      })()}

      {/* Requests table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedBatches?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="ClipboardList" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No Front Desk requests found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Office', 'Request Month', 'Requested By', 'Submitted Date', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedBatches?.map(b => (
                  <tr
                    key={b?.id}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => openDetail(b)}
                  >
                    <td className="py-3 px-4 font-medium">{b?.office_id || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{b?.request_month?.slice(0, 7) || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{b?.requested_by_profile?.full_name || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {b?.submitted_at ? new Date(b.submitted_at)?.toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${FD_STATUS_BADGE?.[b?.batch_status] || 'bg-gray-100 text-gray-700'}`}>
                        {b?.batch_status?.replace(/_/g, ' ')?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e?.stopPropagation()}>
                      <button
                        onClick={() => openDetail(b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors"
                      >
                        <Icon name="Eye" size={12} />
                        {(isAdmin || isRCM) && ['submitted', 'under_review']?.includes(b?.batch_status) ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Showing {displayedBatches?.length} Front Desk request{displayedBatches?.length !== 1 ? 's' : ''} — filtered to <span className="font-semibold">department_category = 'Front Desk'</span>
      </p>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const FrontDeskInventoryTab = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isRCM = userProfile?.role === 'regional_clinical_manager';
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'office_manager' || isSuperAdmin || isRCM;
  const isStaff = !isAdmin;
  const { hasPermission } = useRolePermissions();
  const canSubmitFrontDeskOrder = hasPermission('request:front_desk_order');

  // ── Sub-navigation state ──────────────────────────────────────────────────
  // 'new_request' | 'request_review' | 'request_history' | 'manage_catalog'
  const [activeSubTab, setActiveSubTab] = useState('new_request');

  // ── Requester identity from auth profile ──────────────────────────────────
  // user_profiles has: full_name, email (no separate first_name/last_name columns)
  const requesterName = userProfile?.full_name || null;
  const requesterEmail = userProfile?.email || null;

  const defaultOffice = isSuperAdmin || isRCM ? OFFICES?.[0] : (userProfile?.office_name || OFFICES?.[0]);

  // ── Admin catalog filter state (used only inside Admin: Manage Catalog) ───
  const [selectedOffice, setSelectedOffice] = useState(defaultOffice);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [search, setSearch] = useState('');

  // ── Urgent history state (Admin: Manage Catalog) ──────────────────────────
  const [urgentHistory, setUrgentHistory] = useState([]);
  const [urgentHistoryLoading, setUrgentHistoryLoading] = useState(false);
  const [urgentHistoryError, setUrgentHistoryError] = useState('');

  // ── Quick Request context state (independent from catalog filters) ─────────
  // These are the values used in the submit payload — staff sets them here.
  const [quickOffice, setQuickOffice] = useState(
    isSuperAdmin || isRCM ? '' : (userProfile?.office_name || '')
  );
  const [quickMonth, setQuickMonth] = useState('');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [urgentItem, setUrgentItem] = useState(null);
  const [showBulkUrgent, setShowBulkUrgent] = useState(false);
  const [showCatalogPanel, setShowCatalogPanel] = useState(false);

  // ── Request cart state ────────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const cartRef = useRef(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, sum] = await Promise.all([
        frontDeskInventoryService?.fetchInventory({
          officeLocation: selectedOffice,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
          search: search || undefined,
          month: selectedMonth || undefined,
        }),
        frontDeskInventoryService?.fetchSummary(selectedOffice, selectedMonth),
      ]);
      setItems(data);
      setSummary(sum);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [selectedOffice, selectedCategory, selectedStatus, search, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Load urgent history when manage_catalog tab is active ─────────────────
  const loadUrgentHistory = useCallback(async () => {
    if (!isAdmin) return;
    setUrgentHistoryLoading(true);
    setUrgentHistoryError('');
    try {
      const rows = await frontDeskInventoryService?.fetchFrontDeskUrgentHistory({
        officeLocation: selectedOffice,
        limit: 50,
      });
      setUrgentHistory(rows || []);
    } catch (err) {
      setUrgentHistoryError(err?.message || 'Failed to load urgent request history');
    } finally {
      setUrgentHistoryLoading(false);
    }
  }, [isAdmin, selectedOffice]);

  useEffect(() => {
    if (activeSubTab === 'manage_catalog') {
      loadUrgentHistory();
    }
  }, [activeSubTab, loadUrgentHistory]);

  // Group items by category
  const grouped = CATEGORIES?.reduce((acc, cat) => {
    const catItems = items?.filter(i => i?.category === cat);
    if (catItems?.length > 0 || selectedCategory === 'All') {
      acc[cat] = catItems;
    }
    return acc;
  }, {});

  const criticalItems = items?.filter(i => i?.status === 'Critically Low' || i?.status === 'Out of Stock');

  const refreshSummary = async () => {
    try {
      setSummary(await frontDeskInventoryService?.fetchSummary(selectedOffice, selectedMonth));
    } catch {
      setError('Item saved, but the summary could not refresh. Reload the page to retry.');
    }
  };

  const handleQtySave = async (id, qty) => {
    try {
      await frontDeskInventoryService?.updateQty(id, qty);
      setItems(prev => prev?.map(i => {
        if (i?.id !== id) return i;
        let newStatus = 'In Stock';
        if (qty === 0) newStatus = 'Out of Stock';
        else if (qty <= Math.floor(i?.min_required / 2)) newStatus = 'Critically Low';
        else if (qty <= i?.min_required) newStatus = 'Low';
        return { ...i, current_qty: qty, status: newStatus };
      }));
      await refreshSummary();
      showToast('Quantity updated');
    } catch (err) {
      setError(err?.message || 'Failed to update quantity');
    }
  };

  const handleRowSave = async (id, updates) => {
    try {
      const updated = await frontDeskInventoryService?.updateRow(id, updates);
      setItems(prev => prev?.map(i => i?.id === id ? { ...i, ...updated } : i));
      await refreshSummary();
      showToast('Item updated');
    } catch (err) {
      setError(err?.message || 'Failed to update item');
    }
  };

  const handleAddRow = async (rowData) => {
    try {
      const newItem = await frontDeskInventoryService?.insertRow(rowData);
      setItems(prev => [...prev, newItem]);
      await refreshSummary();
      showToast('Item added successfully');
    } catch (err) {
      throw err;
    }
  };

  // ── Add to request cart from inventory row ────────────────────────────────
  const handleAddToRequest = (item) => {
    setCart(prev => {
      const exists = prev?.find(c => c?.item_name?.toLowerCase() === item?.item_name?.toLowerCase());
      if (exists) {
        showToast(`"${item?.item_name}" is already in your request cart`);
        return prev;
      }
      return [...prev, {
        _id: Date.now() + Math.random(),
        item_name: item?.item_name,
        category: item?.category || 'Front Desk',
        qty: 1,
        priority: 'Normal',
        notes: '',
        is_custom: false,
        catalog_item_id: item?.id || null,
      }];
    });
    showToast(`"${item?.item_name}" added to request cart`);
    setTimeout(() => cartRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  };

  const handleRemoveFromCart = (cartId) => {
    setCart(prev => prev?.filter(c => c?._id !== cartId));
  };

  const handleEditCartItem = (cartId, updates) => {
    setCart(prev => prev?.map(c => c?._id === cartId ? { ...c, ...updates } : c));
  };

  // ── Submit request batch ──────────────────────────────────────────────────
  // IMPORTANT: Uses quickOffice / quickMonth — NOT the catalog filter selectedOffice/selectedMonth.
  const handleSubmitRequest = async () => {
    if (cart?.length === 0) return;

    // Validate required quick-request fields
    if (!quickOffice) {
      setSubmitResult({ success: false, message: 'Please select an Office Location before submitting.' });
      return;
    }
    if (!quickMonth) {
      setSubmitResult({ success: false, message: 'Please select a Request Month before submitting.' });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const { supabase } = await import('../../../lib/supabase');
      const { data: { user } } = await supabase?.auth?.getUser();

      // Use quickOffice / quickMonth — the values staff explicitly chose in the Quick Request panel
      const officeId = quickOffice;
      const requestMonth = quickMonth;
      const monthDate = requestMonth?.length === 7 ? `${requestMonth}-01` : requestMonth;

      // Check for existing draft batch for this office/month/Front Desk
      let existingBatch = null;
      try {
        existingBatch = await supplyRequestService?.checkExistingBatchForDept(officeId, requestMonth, 'Front Desk');
      } catch (_) {}

      // NOTE: Do NOT include a top-level `notes` field — supply_request_batches has no notes column.
      // Item-level notes are saved on supply_request_items below.
      // requested_by is set by saveDraftBatch to user?.id (FK to user_profiles.id).
      const batchPayload = {
        ...(existingBatch?.id ? { id: existingBatch?.id } : {}),
        office_id: officeId,
        request_type: 'monthly',
        request_month: monthDate,
        department_category: 'Front Desk',
        batch_status: 'draft',
      };

      // Map cart items to supply_request_items format — notes saved at item level
      // SCHEMA: supply_request_items has NO item_name column.
      // Supported fields: custom_item_name, item_id (FK supply_items.id), requested_qty,
      //   priority, reason_notes, item_status, department_category, office_id, batch_id.
      // front_desk_inventory items do NOT have a valid supply_items.id, so all items
      // (both catalog-matched and typed/custom) are submitted via custom_item_name.
      const itemsPayload = cart?.map(c => ({
        // item_name is NOT a column on supply_request_items — do not write it
        custom_item_name: c?.item_name,   // used for all FD items (no supply_items FK)
        department_category: 'Front Desk',
        requested_qty: c?.qty,
        priority: c?.priority?.toLowerCase() || 'normal',
        reason_notes: c?.notes || null,   // column is reason_notes, not notes
        item_status: 'pending',
        // item_id left null — front_desk_inventory rows are not supply_items rows
      }));

      const savedBatch = await supplyRequestService?.saveDraftBatch(batchPayload, itemsPayload);
      await supplyRequestService?.submitBatch(savedBatch?.id);

      // ── Fire order-request-notifications edge function (Front Desk → ny@thenudental.com, CC admasu@thenudental.com) ──
      let emailNotifError = null;
      if (!dashboardEnvironment.isQa) try {
        const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', user?.id)?.single();
        const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
        const notifPayload = {
          id: savedBatch?.id,
          office_name: officeId,
          request_type: 'Front Desk',
          priority: cart?.some(c => c?.priority === 'Critical' || c?.priority === 'Urgent') ? 'Urgent' : 'Normal',
          is_monthly_request: true,
          submitted_by_name: profile?.full_name || requesterName || 'Team Member',
          requester_email: requesterEmail || null,
          request_month: requestMonth,
          items: cart?.map(c => ({
            item_name: c?.item_name,
            requested_qty: c?.qty,
            priority: c?.priority || null,
            notes: c?.notes || null,
          })),
          created_at: new Date()?.toISOString(),
        };

        const notifRes = await fetch(`${supabaseUrl}/functions/v1/order-request-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(notifPayload),
        });

        if (!notifRes?.ok) {
          let errDetail = `HTTP ${notifRes?.status}`;
          try {
            const errBody = await notifRes?.json();
            errDetail = errBody?.error || errBody?.message || errDetail;
          } catch (_) {}
          emailNotifError = errDetail;
          console.error('[FrontDesk] order-request-notifications failed:', errDetail);
        } else {
          const notifData = await notifRes?.json();
          console.log('[FrontDesk] order-request-notifications response:', notifData);
          if (!notifData?.email_sent) {
            // Extract the most actionable error message from the errors array
            const errMsg = notifData?.errors?.join('; ') || 'Email not sent (no error detail)';
            emailNotifError = errMsg;
            console.warn('[FrontDesk] Email notification not delivered:', errMsg);
          } else if (notifData?.email_test_mode) {
            // Email delivered but only to Resend account owner (test-mode fallback)
            // Treat as a soft warning — DB save succeeded, email partially delivered
            emailNotifError = `Email delivered in test mode only (to Resend account owner). To enable full delivery to ny@thenudental.com: verify thenudental.com at resend.com/domains and set NUDENTAL_FROM_EMAIL in Supabase edge function secrets.`;
            console.warn('[FrontDesk] Email test-mode fallback used:', notifData?.email_warning);
          }
        }
      } catch (notifErr) {
        emailNotifError = notifErr?.message || 'Network error reaching notification service';
        console.error('[FrontDesk] order-request-notifications exception:', notifErr);
      }

      const cartLen = cart?.length;
      setCart([]);

      if (emailNotifError) {
        // DB save succeeded — show success but surface the email failure/warning as a message
        setSubmitResult({
          success: true,
          message: `Request submitted (${cartLen} item${cartLen !== 1 ? 's' : ''}) for ${officeId} — ${new Date(monthDate)?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — routed to Regional Manager for review. Batch ID: ${savedBatch?.id?.slice(0, 8)}… ⚠️ Request saved, but email notification failed: ${emailNotifError}`,
        });
        showToast(`Request saved — email notification failed: ${emailNotifError?.length > 80 ? emailNotifError?.slice(0, 80) + '…' : emailNotifError}`);
      } else {
        setSubmitResult({
          success: true,
          message: `Request submitted (${cartLen} item${cartLen !== 1 ? 's' : ''}) for ${officeId} — ${new Date(monthDate)?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — routed to Regional Manager for review. Batch ID: ${savedBatch?.id?.slice(0, 8)}…`,
        });
        showToast('Front Desk request submitted successfully!');
      }
    } catch (err) {
      setSubmitResult({
        success: false,
        message: err?.message || 'Failed to submit request. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    const headers = ['Category','Item Name','Current Qty','Min Required','Status','Priority','Last Supplied','Order Status','Notes','Requested By','Approved By'];
    const rows = items?.map(i => [
      i?.category,
      i?.item_name,
      i?.current_qty,
      i?.min_required,
      i?.status,
      i?.priority,
      i?.last_supplied_date || '',
      i?.order_status,
      (i?.notes || '')?.replace(/,/g, ';'),
      i?.requested_by || '',
      i?.approved_by || '',
    ]);
    const csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const monthLabel = selectedMonth || new Date()?.toISOString()?.slice(0, 7);
    a.download = `front-desk-inventory-${selectedOffice?.replace(/\s+/g, '-')}-${monthLabel}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const monthLabel = selectedMonth
      ? new Date(selectedMonth + '-01')?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : new Date()?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const categorySections = CATEGORIES?.map(cat => {
      const catItems = items?.filter(i => i?.category === cat);
      if (!catItems?.length) return '';
      const rows = catItems?.map(i => `
        <tr style="background:${i?.status==='Out of Stock'?'#fee2e2':i?.status==='Critically Low'?'#ffedd5':i?.status==='Low'?'#fef9c3':'#fff'}">
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${i?.item_name}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;">${i?.current_qty}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:center;">${i?.min_required}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${i?.status}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${i?.order_status}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;">${i?.last_supplied_date || '—'}</td>
        </tr>`)?.join('');
      return `
        <h3 style="margin:16px 0 6px;font-size:13px;color:#374151;border-bottom:1px solid #d1d5db;padding-bottom:4px;">${cat} (${catItems?.length} items)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Item</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;">Qty</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;">Min</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;">Status</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;">Order Status</th>
            <th style="padding:4px 8px;border:1px solid #e5e7eb;">Last Supplied</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })?.join('');

    const html = `<!DOCTYPE html><html><head><title>Front Desk Inventory Review</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}@media print{body{padding:0;}}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <h1 style="margin:0;font-size:18px;color:#1e293b;">Front Desk Inventory — Monthly Review</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${selectedOffice} &nbsp;|&nbsp; ${monthLabel}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#6b7280;">
          <p>Generated: ${new Date()?.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
          <p>Total Items: ${items?.length} &nbsp;|&nbsp; In Stock: ${summary?.totalInStock||0} &nbsp;|&nbsp; Critical: ${summary?.criticalOutOfStock||0}</p>
        </div>
      </div>
      ${categorySections}
      <div style="margin-top:32px;border-top:1px solid #d1d5db;padding-top:16px;display:flex;gap:48px;">
        <div><p style="font-size:11px;color:#6b7280;margin:0;">Reviewed By</p><div style="margin-top:24px;border-top:1px solid #374151;width:200px;"></div></div>
        <div><p style="font-size:11px;color:#6b7280;margin:0;">Date</p><div style="margin-top:24px;border-top:1px solid #374151;width:140px;"></div></div>
      </div>
      </body></html>`;

    const win = window.open('', '_blank');
    win?.document?.write(html);
    win?.document?.close();
    setTimeout(() => win?.print(), 500);
    showToast('PDF print dialog opened');
  };

  // ── Sub-navigation tabs config ────────────────────────────────────────────
  const subTabs = [
    {
      id: 'new_request',
      label: 'New Request',
      icon: 'Plus',
      show: true,
    },
    {
      id: 'request_review',
      label: 'Request Review',
      icon: 'ClipboardList',
      show: true,
      badge: null,
    },
    {
      id: 'request_history',
      label: 'Request History',
      icon: 'History',
      show: true,
    },
    {
      id: 'current_inventory',
      label: 'Current Inventory',
      icon: 'Package',
      show: true,
    },
    {
      id: 'amazon_order_history',
      label: 'Amazon Order History',
      icon: 'ShoppingBag',
      show: true,
    },
    {
      id: 'manage_catalog',
      label: 'Admin: Manage Catalog',
      icon: 'Settings',
      show: isAdmin,
    },
  ]?.filter(t => t?.show);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="ClipboardList" size={18} color="var(--color-primary)" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Front Desk Inventory</h2>
            <p className="text-xs text-muted-foreground">Track and manage all front desk supplies across Nu Dental locations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeSubTab === 'manage_catalog' && (
            <>
              {criticalItems?.length > 0 && isAdmin && canSubmitFrontDeskOrder && (
                <button
                  onClick={() => setShowBulkUrgent(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Icon name="AlertTriangle" size={14} />
                  Submit Urgent Request for All Critical Items ({criticalItems?.length})
                </button>
              )}
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-3 py-2 bg-success text-success-foreground rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors"
              >
                <Icon name="Download" size={14} />Export Inventory CSV
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Icon name="FileText" size={14} />Download Inventory Monthly Review
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Sub-navigation ── */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border w-fit flex-wrap">
        {subTabs?.map(tab => (
          <button
            key={tab?.id}
            onClick={() => setActiveSubTab(tab?.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === tab?.id
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Icon name={tab?.icon} size={14} />
            {tab?.label}
            {tab?.badge != null && tab?.badge > 0 && (
              <span className="px-1.5 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full leading-none">
                {tab?.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── New Request tab ── */}
      {activeSubTab === 'new_request' && (
        <>
          {canSubmitFrontDeskOrder ? (
            <QuickRequestPanel
              inventoryItems={items}
              quickOffice={quickOffice}
              setQuickOffice={setQuickOffice}
              quickMonth={quickMonth}
              setQuickMonth={setQuickMonth}
              requesterName={requesterName}
              requesterEmail={requesterEmail}
              canSubmitOrder={canSubmitFrontDeskOrder}
              onCartUpdated={setCart}
              cartCount={cart?.length}
            />
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-muted-foreground">
              <Icon name="Lock" size={15} />
              <span>You do not have permission to submit Front Desk supply requests (<code className="text-xs bg-muted px-1 rounded">request:front_desk_order</code>). Contact your administrator.</span>
            </div>
          )}

          <div ref={cartRef}>
            <RequestCart
              cart={cart}
              onRemove={handleRemoveFromCart}
              onEdit={handleEditCartItem}
              onSubmit={handleSubmitRequest}
              submitting={submitting}
              submitResult={submitResult}
              quickOffice={quickOffice}
              quickMonth={quickMonth}
              requesterName={requesterName}
              requesterEmail={requesterEmail}
            />
          </div>
        </>
      )}

      {/* ── Request Review tab ── */}
      {activeSubTab === 'request_review' && (
        <FrontDeskRequestReview isAdmin={isAdmin} isRCM={isRCM} />
      )}

      {/* ── Request History tab ── */}
      {activeSubTab === 'request_history' && (
        <FrontDeskRequestHistory />
      )}

      {/* ── Current Inventory tab ── */}
      {activeSubTab === 'current_inventory' && (
        <FrontDeskCurrentInventory />
      )}

      {/* ── Amazon Order History tab ── */}
      {activeSubTab === 'amazon_order_history' && (
        <FrontDeskAmazonOrderHistory />
      )}

      {/* ── Admin: Manage Catalog tab ── */}
      {activeSubTab === 'manage_catalog' && isAdmin && (
        <>
          {/* ── Admin Catalog Actions Helper Panel ── */}
          <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Info" size={15} className="text-primary flex-shrink-0" />
              <h3 className="text-sm font-bold text-foreground">Admin Catalog Actions — What Each Button Does</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Submit Urgent Request */}
              <div className="flex flex-col gap-1.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="AlertTriangle" size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-red-700">Submit Urgent Request for All Critical Items</span>
                </div>
                <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                  <li>Sends an immediate urgent alert for all critical/out-of-stock Front Desk catalog items for the selected office.</li>
                  <li>Sends <strong>SMS and Email immediately</strong> to Regional Managers and Super Admins.</li>
                  <li>Use only when management needs urgent attention.</li>
                  <li>The action is recorded in Urgent Request History below.</li>
                </ul>
              </div>
              {/* Export CSV */}
              <div className="flex flex-col gap-1.5 p-3 bg-success/10 border border-success/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-success rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="Download" size={12} className="text-success-foreground" />
                  </div>
                  <span className="text-xs font-bold text-success">Export Inventory CSV</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Downloads the current Front Desk inventory/catalog list as a spreadsheet.</li>
                  <li>Includes category, item name, quantities, status, priority, order status, and notes.</li>
                  <li><strong>Does not</strong> submit an order request.</li>
                  <li><strong>Does not</strong> notify management.</li>
                </ul>
              </div>
              {/* Download Monthly Review */}
              <div className="flex flex-col gap-1.5 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="FileText" size={12} className="text-primary-foreground" />
                  </div>
                  <span className="text-xs font-bold text-primary">Download Inventory Monthly Review</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Downloads a monthly Front Desk inventory review PDF for the selected office and month.</li>
                  <li>Includes categories, item quantities, stock status, order status, and Reviewed By/Date lines.</li>
                  <li><strong>Does not</strong> submit an order request.</li>
                  <li><strong>Does not</strong> notify management.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 bg-muted/20 rounded-xl border border-border">
            {/* Office */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Office Location</label>
              <select
                value={selectedOffice}
                onChange={e => setSelectedOffice(e?.target?.value)}
                disabled={isStaff}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
              >
                {(isSuperAdmin || isRCM) && <option value="All Offices">All Offices</option>}
                {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {/* Month */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e?.target?.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e?.target?.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="All">All Statuses</option>
                {['In Stock','Low','Critically Low','Out of Stock']?.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground">Search Item</label>
              <div className="relative">
                <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={search}
                  onChange={e => setSearch(e?.target?.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
                />
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {['All', ...CATEGORIES]?.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <Icon name="AlertCircle" size={15} />{error}
              <button onClick={() => setError('')} className="ml-auto"><Icon name="X" size={14} /></button>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-success mb-1">In Stock</p>
                <p className="text-2xl font-bold text-success">{summary?.totalInStock ?? 0}</p>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-warning mb-1">Low Items</p>
                <p className="text-2xl font-bold text-warning">{summary?.lowItems ?? 0}</p>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Critical / Out</p>
                <p className="text-2xl font-bold text-destructive">{summary?.criticalOutOfStock ?? 0}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-primary mb-1">Categories</p>
                <p className="text-2xl font-bold text-primary">{summary?.totalCategories ?? 10}</p>
              </div>
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-accent mb-1">Supplied This Month</p>
                <p className="text-2xl font-bold text-accent">{summary?.orderedThisMonth ?? 0}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && (
            <div>
              {CATEGORIES?.filter(cat => selectedCategory === 'All' || cat === selectedCategory)?.map(cat => {
                const catItems = items?.filter(i => i?.category === cat);
                if (catItems?.length === 0 && selectedCategory !== 'All') return null;
                return (
                  <CategoryAccordion
                    key={cat}
                    category={cat}
                    items={catItems}
                    isAdmin={isAdmin}
                    isStaff={isStaff}
                    officeLocation={selectedOffice !== 'All Offices' ? selectedOffice : OFFICES?.[0]}
                    onQtySave={handleQtySave}
                    onRowSave={handleRowSave}
                    onAddRow={handleAddRow}
                    onUrgentRequest={(item) => setUrgentItem(item)}
                    canSubmitOrder={canSubmitFrontDeskOrder}
                    onAddToRequest={handleAddToRequest}
                  />
                );
              })}
              {items?.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Icon name="Package" size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No items found for the selected filters.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Urgent Request History ── */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="History" size={16} className="text-red-600" />
                <h3 className="text-sm font-bold text-foreground">Urgent Request History</h3>
                <span className="text-xs text-muted-foreground">— Recent urgent alerts submitted from Admin: Manage Catalog</span>
              </div>
              <button
                onClick={loadUrgentHistory}
                disabled={urgentHistoryLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Icon name="RefreshCw" size={12} className={urgentHistoryLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {urgentHistoryError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <Icon name="AlertCircle" size={14} />{urgentHistoryError}
              </div>
            )}

            {urgentHistoryLoading && (
              <div className="flex items-center justify-center h-20">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!urgentHistoryLoading && !urgentHistoryError && urgentHistory?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-20 text-muted-foreground border border-dashed border-border rounded-xl">
                <Icon name="ClipboardList" size={24} className="mb-1 opacity-30" />
                <p className="text-xs">No urgent requests submitted yet for this office.</p>
              </div>
            )}

            {!urgentHistoryLoading && urgentHistory?.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Submitted</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Office</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Submitted By</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Type</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Item / Count</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Notes</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentHistory?.map((row, idx) => {
                      const nv = row?.new_values || {};
                      const submittedAt = row?.changed_at
                        ? new Date(row?.changed_at)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : '—';
                      const isBulkRow = nv?.is_bulk === true || row?.action === 'front_desk_urgent_all_critical_submitted';
                      const submitterName = row?.submitter?.full_name || nv?.submitted_by_name || '—';
                      const office = nv?.office || '—';
                      const itemDisplay = isBulkRow
                        ? `${nv?.bulk_item_count ?? '?'} critical items`
                        : (nv?.item_name || '—');
                      const notes = nv?.notes || '—';
                      const smsAttempted = nv?.sms_attempted === true;
                      const emailAttempted = nv?.email_attempted === true;
                      return (
                        <tr key={row?.id || idx} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                          <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{submittedAt}</td>
                          <td className="px-3 py-2.5 text-foreground">{office}</td>
                          <td className="px-3 py-2.5 text-foreground">{submitterName}</td>
                          <td className="px-3 py-2.5">
                            {isBulkRow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Bulk — All Critical</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">Single Item</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-foreground max-w-[180px] truncate" title={isBulkRow && nv?.bulk_item_names?.length ? nv?.bulk_item_names?.join(', ') : nv?.item_name}>
                            {itemDisplay}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={nv?.notes || ''}>{notes}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1 text-xs ${smsAttempted ? 'text-success' : 'text-muted-foreground'}`}>
                                <Icon name={smsAttempted ? 'CheckCircle' : 'Circle'} size={10} />SMS {smsAttempted ? 'sent' : '—'}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-xs ${emailAttempted ? 'text-success' : 'text-muted-foreground'}`}>
                                <Icon name={emailAttempted ? 'CheckCircle' : 'Circle'} size={10} />Email {emailAttempted ? 'sent' : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/10">
                  Showing {urgentHistory?.length} recent urgent submission{urgentHistory?.length !== 1 ? 's' : ''}. Notification result shows whether SMS/email was <em>attempted</em> — delivery confirmation depends on the SMS/email service response. Recipients: Regional Managers and Super Admins.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Urgent Request Modal — Single Item */}
      {urgentItem && (
        <FrontDeskUrgentModal
          item={urgentItem}
          isBulk={false}
          bulkItems={[]}
          officeLocation={selectedOffice !== 'All Offices' ? selectedOffice : urgentItem?.office_location}
          submittedBy={userProfile?.full_name || ''}
          onClose={() => setUrgentItem(null)}
          onSuccess={() => { setUrgentItem(null); showToast('Urgent request submitted!'); loadData(); }}
        />
      )}
      {/* Bulk Urgent Request Modal */}
      {showBulkUrgent && (
        <FrontDeskUrgentModal
          item={null}
          isBulk={true}
          bulkItems={criticalItems}
          officeLocation={selectedOffice !== 'All Offices' ? selectedOffice : OFFICES?.[0]}
          submittedBy={userProfile?.full_name || ''}
          onClose={() => setShowBulkUrgent(false)}
          onSuccess={() => { setShowBulkUrgent(false); showToast('Bulk urgent request submitted!'); loadData(); }}
        />
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-success text-success-foreground rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4">
          <Icon name="CheckCircle" size={16} />{toast}
        </div>
      )}
    </div>
  );
};

export default FrontDeskInventoryTab;
