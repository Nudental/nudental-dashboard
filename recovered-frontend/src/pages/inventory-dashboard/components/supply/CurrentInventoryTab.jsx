import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import MobileInventoryAdjustModal from './MobileInventoryAdjustModal';

const STATUS_CONFIG = {
  in_stock: { label: 'In Stock', color: 'bg-emerald-100 text-emerald-700', row: '' },
  low: { label: 'Low', color: 'bg-yellow-100 text-yellow-700', row: 'bg-yellow-50' },
  critically_low: { label: 'Critically Low', color: 'bg-orange-100 text-orange-700', row: 'bg-orange-50' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-700', row: 'bg-red-50' },
  discontinued: { label: 'Discontinued', color: 'bg-gray-100 text-gray-500', row: 'bg-gray-50' },
};

const AdjustModal = ({ item, onClose, onSaved }) => {
  const [qty, setQty] = useState(item?.quantity_on_hand ?? 0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (qty < 0) { setError('Quantity cannot be negative'); return; }
    setSaving(true);
    try {
      await supplyRequestService?.adjustInventory(item?.id, parseInt(qty), reason, reason);
      onSaved();
    } catch (e) { setError(e?.message || 'Failed to adjust'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Adjust Inventory</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">{item?.item_name}</p>
            <p className="text-xs text-muted-foreground">{item?.office_id}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Current Quantity: {item?.quantity_on_hand}</label>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Quantity</label>
            <input
              type="number" min="0" value={qty} onChange={e => setQty(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Reason / Notes</label>
            <textarea
              value={reason} onChange={e => setReason(e?.target?.value)} rows={3}
              placeholder="Reason for adjustment..."
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryPanel = ({ item, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supplyRequestService?.fetchInventoryHistory(item?.id)?.then(setHistory)?.catch(console.error)?.finally(() => setLoading(false));
  }, [item?.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Inventory History — {item?.item_name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : history?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No history yet</p>
          ) : (
            <div className="space-y-3">
              {history?.map(h => (
                <div key={h?.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h?.change_qty > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {h?.change_qty > 0 ? '+' : ''}{h?.change_qty} units ({h?.old_qty} → {h?.new_qty})
                    </p>
                    <p className="text-xs text-muted-foreground">{h?.change_type} · {h?.change_reason}</p>
                    <p className="text-xs text-muted-foreground">{h?.user_profiles?.full_name} · {new Date(h.created_at)?.toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CurrentInventoryTab = ({ isAdmin, onCreateUrgent }) => {
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ officeId: '', departmentId: '', status: '', lowStockOnly: false, expiringSoon: false, search: '', departmentCategory: 'Back Staff' });
  const [adjustItem, setAdjustItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const OFFICES = supplyRequestService?.getOffices();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, depts] = await Promise.all([
        supplyRequestService?.fetchInventory({
          officeId: filters?.officeId || undefined,
          departmentId: filters?.departmentId || undefined,
          status: filters?.status || undefined,
          lowStockOnly: filters?.lowStockOnly || undefined,
          expiringSoon: filters?.expiringSoon || undefined,
          search: filters?.search || undefined,
        }),
        supplyRequestService?.fetchDepartments(),
      ]);
      // Client-side filter by department category (joined field on supply_items)
      const filtered = filters?.departmentCategory
        ? inv?.filter(r => r?.supply_items?.department_category === filters?.departmentCategory)
        : inv;
      setRecords(filtered);
      setDepartments(depts);
    } catch (e) { setError(e?.message || 'Failed to load inventory'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  const statusCfg = (status) => STATUS_CONFIG?.[status] || STATUS_CONFIG?.in_stock;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon name="X" size={14} /></button>
        </div>
      )}
      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select value={filters?.officeId} onChange={e => setFilter('officeId', e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o?.split(' ')?.pop()}</option>)}
          </select>
          <select value={filters?.departmentId} onChange={e => setFilter('departmentId', e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">All Departments</option>
            {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name}</option>)}
          </select>
          <select value={filters?.status} onChange={e => setFilter('status', e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG)?.map(([k, v]) => <option key={k} value={k}>{v?.label}</option>)}
          </select>
          <input
            type="text" placeholder="Search item, brand, SKU..."
            value={filters?.search} onChange={e => setFilter('search', e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 col-span-2 sm:col-span-1"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={filters?.lowStockOnly} onChange={e => setFilter('lowStockOnly', e?.target?.checked)} className="rounded" />
            Low Stock Only
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={filters?.expiringSoon} onChange={e => setFilter('expiringSoon', e?.target?.checked)} className="rounded" />
            Expiring Soon
          </label>
        </div>
        {/* Department Category — Clinical Supply only (Back Staff / Clinical) */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs font-semibold text-muted-foreground">Showing:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-xl text-xs font-semibold">
            🦷 Back Staff / Clinical Inventory Only
          </span>
          <span className="text-xs text-muted-foreground">— Front Desk inventory is managed in the Front Desk tab</span>
        </div>
      </div>
      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-sm font-semibold text-foreground">{records?.length} items</span>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Icon name="RefreshCw" size={13} />Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="Package" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No inventory records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Office', 'Dept.', 'Category', 'Item Name', 'Brand', 'Unit', 'Qty', 'Min', 'Reorder', 'Crit.Low', 'Last Supplied', 'Expiry', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records?.map(r => {
                  const cfg = statusCfg(r?.inv_status);
                  const itemDeptCat = r?.supply_items?.department_category;
                  return (
                    <tr key={r?.id} className={`border-b border-border/50 hover:bg-muted/20 ${cfg?.row}`}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs">{r?.office_id?.split(' ')?.pop()}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs">{r?.supply_departments?.name?.split('/')?.[0]?.trim()}</td>
                      <td className="py-2.5 px-3">
                        {itemDeptCat ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                            itemDeptCat === 'Front Desk' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {itemDeptCat === 'Front Desk' ? '🖥' : '🦷'} {itemDeptCat}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground max-w-[160px] truncate">{r?.item_name}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.brand || '—'}</td>
                      <td className="py-2.5 px-3 text-xs">{r?.unit_type}</td>
                      <td className="py-2.5 px-3 font-bold text-foreground">{r?.quantity_on_hand}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.minimum_level}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.reorder_level}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.critically_low_threshold}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{r?.last_supplied_date || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{r?.expiration_date || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg?.color}`}>{cfg?.label}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setHistoryItem(r)} className="p-1 hover:bg-muted rounded-lg" title="View History">
                            <Icon name="History" size={13} className="text-muted-foreground" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setAdjustItem(r)} className="p-1 hover:bg-muted rounded-lg" title="Adjust Inventory">
                              <Icon name="Edit" size={13} className="text-muted-foreground" />
                            </button>
                          )}
                          {['critically_low', 'out_of_stock']?.includes(r?.inv_status) && (
                            <button
                              onClick={() => onCreateUrgent?.(r)}
                              className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 whitespace-nowrap"
                            >
                              <Icon name="AlertTriangle" size={11} />Urgent
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adjustItem && (
        isMobile ? (
          <MobileInventoryAdjustModal
            item={adjustItem}
            onClose={() => setAdjustItem(null)}
            onSaved={(result) => {
              setAdjustItem(null);
              if (result?.offline) {
                setSuccessMsg('Adjustment queued — will sync when back online');
              } else {
                setSuccessMsg('Inventory adjusted successfully');
                load();
              }
              setTimeout(() => setSuccessMsg(''), 4000);
            }}
          />
        ) : (
          <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onSaved={() => { setAdjustItem(null); load(); }} />
        )
      )}
      {historyItem && (
        <HistoryPanel item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[800] px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="CheckCircle" size={16} />{successMsg}
        </div>
      )}
    </div>
  );
};

export default CurrentInventoryTab;
