import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import ImplantStatusBadge from './ImplantStatusBadge';
import AddImplantModal from './AddImplantModal';

const PAGE_SIZES = [10, 25, 50];

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isExpired = (d) => d && new Date(d) < new Date();
const isExpiringSoon = (d, days) => {
  if (!d) return false;
  const exp = new Date(d);
  const cutoff = new Date(); cutoff?.setDate(cutoff?.getDate() + days);
  return exp >= new Date() && exp <= cutoff;
};

const ImplantInventoryTab = ({ records, loading, offices, companies, systems, platformSizes, lengths, diameters, userId, userName, isAdmin, isSuperAdmin, onRefresh }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [restockRecord, setRestockRecord] = useState(null);
  const [restockQty, setRestockQty] = useState(1);
  const [restocking, setRestocking] = useState(false);

  const filtered = records?.filter(r => {
    if (filters?.officeId && r?.office_id !== filters?.officeId) return false;
    if (filters?.companyId && r?.company_id !== filters?.companyId) return false;
    if (filters?.status && r?.item_status !== filters?.status) return false;
    if (filters?.lowStockOnly && (r?.quantity_in_stock || 0) > (r?.minimum_stock_level || 2)) return false;
    if (search) {
      const s = search?.toLowerCase();
      return (
        r?.identification_number?.toLowerCase()?.includes(s) ||
        r?.lot_number?.toLowerCase()?.includes(s) ||
        r?.company_name?.toLowerCase()?.includes(s) ||
        r?.system_name?.toLowerCase()?.includes(s) ||
        r?.sku_reference?.toLowerCase()?.includes(s)
      );
    }
    return true;
  });

  const totalPages = Math.ceil((filtered?.length || 0) / pageSize);
  const paginated = filtered?.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      const { deleteInventoryRecord } = await import('../../../services/implantInventoryService');
      await deleteInventoryRecord(id);
      setDeleteId(null);
      onRefresh?.();
    } catch (err) {
      alert(err?.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestock = async () => {
    if (!restockRecord || restockQty < 1) return;
    setRestocking(true);
    try {
      const { restockInventoryItem } = await import('../../../services/implantInventoryService');
      await restockInventoryItem(restockRecord?.id, restockQty, userId, userName);
      setRestockRecord(null);
      setRestockQty(1);
      onRefresh?.();
    } catch (err) {
      alert(err?.message);
    } finally {
      setRestocking(false);
    }
  };

  return (
    <div>
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e?.target?.value); setPage(1); }} placeholder="Search ID, lot, company, system…" className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filters?.officeId || ''} onChange={e => setFilters(f => ({ ...f, officeId: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All Locations</option>
          {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
        </select>
        <select value={filters?.companyId || ''} onChange={e => setFilters(f => ({ ...f, companyId: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All Companies</option>
          {companies?.filter(c => c?.is_active)?.map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
        </select>
        <select value={filters?.status || ''} onChange={e => setFilters(f => ({ ...f, status: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All Statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="used">Used</option>
          <option value="returned">Returned</option>
          <option value="wasted">Wasted</option>
          <option value="expired">Expired</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
          <input type="checkbox" checked={!!filters?.lowStockOnly} onChange={e => setFilters(f => ({ ...f, lowStockOnly: e?.target?.checked || undefined }))} className="rounded" />
          Low Stock Only
        </label>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors ml-auto">
            <Icon name="Plus" size={16} /> Add Implant
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading inventory…</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Location','Company','System','Platform','Length','Diameter','SKU','Lot #','ID Number','Expiration','Qty','Min','Status','Actions']?.map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated?.length === 0 ? (
                  <tr><td colSpan={14} className="px-4 py-10 text-center text-muted-foreground text-sm">No implants found</td></tr>
                ) : paginated?.map(r => {
                  const lowStock = (r?.quantity_in_stock || 0) <= (r?.minimum_stock_level || 2);
                  const expired = isExpired(r?.expiration_date);
                  const exp30 = isExpiringSoon(r?.expiration_date, 30);
                  const exp60 = isExpiringSoon(r?.expiration_date, 60);
                  return (
                    <tr key={r?.id} className={`hover:bg-muted/20 transition-colors ${lowStock ? 'bg-red-50/50' : ''}`}>
                      <td className="px-3 py-2.5 text-xs">{r?.office_name?.replace('Nu Dental of ', '') || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-medium">{r?.company_name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r?.system_name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r?.platform_size_name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r?.length_label || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{r?.diameter_label || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r?.sku_reference || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r?.lot_number || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r?.identification_number || '—'}</td>
                      <td className={`px-3 py-2.5 text-xs ${expired ? 'text-red-600 font-semibold' : exp30 ? 'text-red-500' : exp60 ? 'text-orange-500' : ''}`}>
                        {formatDate(r?.expiration_date)}
                        {expired && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1 rounded">EXP</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-xs font-bold ${lowStock ? 'text-red-600' : 'text-foreground'}`}>
                        {r?.quantity_in_stock ?? 0}
                        {lowStock && <Icon name="AlertTriangle" size={10} className="inline ml-1 text-red-500" />}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r?.minimum_stock_level ?? 2}</td>
                      <td className="px-3 py-2.5"><ImplantStatusBadge status={r?.item_status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <>
                              <button onClick={() => setEditRecord(r)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Edit">
                                <Icon name="Edit" size={13} className="text-muted-foreground" />
                              </button>
                              <button onClick={() => { setRestockRecord(r); setRestockQty(1); }} className="p-1.5 rounded hover:bg-muted transition-colors" title="Restock">
                                <Icon name="PackagePlus" size={13} className="text-emerald-600" />
                              </button>
                            </>
                          )}
                          {isSuperAdmin && (
                            <button onClick={() => setDeleteId(r?.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Delete">
                              <Icon name="Trash2" size={13} className="text-red-500" />
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

        {/* Pagination */}
        {!loading && filtered?.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows:</span>
              {PAGE_SIZES?.map(s => (
                <button key={s} onClick={() => { setPageSize(s); setPage(1); }} className={`px-2 py-1 text-xs rounded ${pageSize === s ? 'bg-primary text-white' : 'hover:bg-muted'}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered?.length)} of {filtered?.length}</span>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40">
                <Icon name="ChevronLeft" size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-40">
                <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6">
            <h3 className="font-bold text-foreground mb-1">Restock Implant</h3>
            <p className="text-xs text-muted-foreground mb-4">{restockRecord?.company_name} — {restockRecord?.identification_number || restockRecord?.sku_reference}</p>
            <label className="block text-xs font-semibold text-foreground mb-1">Quantity to Add</label>
            <input type="number" min="1" value={restockQty} onChange={e => setRestockQty(parseInt(e?.target?.value) || 1)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRestockRecord(null)} className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleRestock} disabled={restocking} className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
                {restocking ? 'Restocking…' : 'Restock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={20} className="text-red-600" />
            </div>
            <h3 className="font-bold text-foreground text-center mb-2">Delete Implant Record?</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editRecord) && (
        <AddImplantModal
          record={editRecord}
          offices={offices}
          companies={companies}
          systems={systems}
          platformSizes={platformSizes}
          lengths={lengths}
          diameters={diameters}
          userId={userId}
          userName={userName}
          isSuperAdmin={isSuperAdmin}
          onClose={() => { setShowAddModal(false); setEditRecord(null); }}
          onSaved={() => { setShowAddModal(false); setEditRecord(null); onRefresh?.(); }}
        />
      )}
    </div>
  );
};

export default ImplantInventoryTab;
