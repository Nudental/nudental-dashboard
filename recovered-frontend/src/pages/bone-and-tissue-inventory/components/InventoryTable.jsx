import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import StatusBadge from './StatusBadge';
import RestockModal from './RestockModal';

const PAGE_SIZES = [10, 25, 50];

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

const patientDisplay = (name) => {
  if (!name) return '—';
  const parts = name?.trim()?.split(' ');
  if (parts?.length === 1) return name;
  return `${parts?.[0]?.[0]}. ${parts?.slice(1)?.join(' ')}`;
};

const isExpired = (expDate) => {
  if (!expDate) return false;
  return new Date(expDate) < new Date();
};

const InventoryTable = ({ records, loading, onEdit, onDelete, canDelete, isAdmin, stockMap, userId, userName, onStockUpdated, onImportCSV }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [restockRecord, setRestockRecord] = useState(null);

  const totalPages = Math.ceil((records?.length || 0) / pageSize);
  const paginated = (records || [])?.slice((page - 1) * pageSize, page * pageSize);

  const handlePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const getStockForRecord = (record) => {
    if (!stockMap || !record?.identification_number) return null;
    const key = `${record?.identification_number}__${record?.office_id || ''}`;
    return stockMap?.[key] || null;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading inventory…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Table Header with Import CSV button */}
        {isAdmin && (
          <div className="flex items-center justify-end px-4 py-3 border-b border-border bg-muted/20">
            <button
              onClick={onImportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-semibold shadow-sm"
            >
              <Icon name="FileUp" size={14} />
              Import CSV
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID / Serial</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lot #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">In Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated?.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Package" size={32} className="opacity-30" />
                      <span className="text-sm">No inventory records found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated?.map(record => {
                  const expired = isExpired(record?.expiration_date);
                  const missingId = !record?.identification_number;
                  const stockItem = getStockForRecord(record);
                  const stockCount = stockItem?.current_stock ?? null;
                  const isLowStock = stockCount !== null && stockCount <= 2;

                  let rowCls = '';
                  if (isLowStock) rowCls = 'bg-red-50/60';
                  else if (missingId) rowCls = 'bg-red-50/40';

                  return (
                    <tr
                      key={record?.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${rowCls}`}
                      onClick={() => onEdit(record)}
                    >
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{formatDate(record?.procedure_date)}</td>
                      <td className="px-4 py-3 text-foreground max-w-[120px] truncate" title={record?.office_name}>
                        {record?.office_name?.replace('Nu Dental of ', '') || '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[120px] truncate" title={record?.provider_name}>
                        {record?.provider_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">{patientDisplay(record?.patient_name)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                          {record?.bone_tissue_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[140px] truncate" title={record?.product_name}>
                        {record?.product_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {missingId ? (
                          <span className="text-red-600 font-medium text-xs flex items-center gap-1">
                            <Icon name="AlertCircle" size={12} />
                            Missing
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-foreground">{record?.identification_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{record?.lot_number || '—'}</td>
                      <td className="px-4 py-3 text-foreground max-w-[100px] truncate" title={record?.staff_assistant_name}>
                        {record?.staff_assistant_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {expired && record?.item_status === 'In Stock' ? (
                          <StatusBadge status="Expired" />
                        ) : (
                          <StatusBadge status={record?.item_status} />
                        )}
                      </td>
                      {/* In Stock column */}
                      <td className="px-4 py-3 text-center" onClick={e => e?.stopPropagation()}>
                        {stockCount !== null ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            isLowStock
                              ? 'bg-red-100 text-red-700 border border-red-300' :'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isLowStock && <Icon name="AlertTriangle" size={10} />}
                            {stockCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e?.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Restock button — admin/super_admin only */}
                          {isAdmin && record?.identification_number && (
                            <button
                              onClick={() => setRestockRecord(record)}
                              className="p-1.5 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                              title="Restock"
                            >
                              <Icon name="PackagePlus" size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(record)}
                            className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Icon name="Pencil" size={14} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => onDelete(record)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <Icon name="Trash2" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {records?.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              {PAGE_SIZES?.map(s => (
                <button
                  key={s}
                  onClick={() => handlePageSize(s)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    pageSize === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, records?.length)} of {records?.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronLeft" size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="ChevronRight" size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockRecord && (
        <RestockModal
          record={restockRecord}
          stockRecord={getStockForRecord(restockRecord)}
          userId={userId}
          userName={userName}
          onClose={() => setRestockRecord(null)}
          onRestocked={() => {
            setRestockRecord(null);
            onStockUpdated?.();
          }}
        />
      )}
    </>
  );
};

export default InventoryTable;
