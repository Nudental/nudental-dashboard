import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchImportBatches, fetchImportRows } from '../../../services/bulkImportService';

const StatusBadge = ({ status }) => {
  const map = {
    completed: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    pending: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map?.[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
};

const RowStatusBadge = ({ status }) => {
  const map = {
    valid: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    skipped: 'bg-muted text-muted-foreground',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map?.[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
};

const ImportHistoryTab = ({ importType = 'bone_tissue' }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchRows, setBatchRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [filters, setFilters] = useState({ officeId: '', status: '', dateFrom: '', dateTo: '' });

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchImportBatches({ importType, ...filters });
      setBatches(data);
    } catch (err) {
      setError(err?.message || 'Failed to load import history');
    } finally {
      setLoading(false);
    }
  }, [importType, filters]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const handleViewDetails = async (batch) => {
    setSelectedBatch(batch);
    setRowsLoading(true);
    try {
      const rows = await fetchImportRows(batch?.id);
      setBatchRows(rows);
    } catch (err) {
      console.error('Failed to load batch rows:', err);
    } finally {
      setRowsLoading(false);
    }
  };

  const formatDate = (dt) => {
    if (!dt) return '—';
    return new Date(dt)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={filters?.status}
            onChange={e => setFilters(f => ({ ...f, status: e?.target?.value }))}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
          <input type="date" value={filters?.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e?.target?.value }))} className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
          <input type="date" value={filters?.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e?.target?.value }))} className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button onClick={loadBatches} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Icon name="RefreshCw" size={14} />Refresh
        </button>
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />{error}
        </div>
      )}
      {/* Batches table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader" size={24} className="animate-spin text-primary" />
        </div>
      ) : batches?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="History" size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No import history found</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Imported By</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Office</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Valid</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Warnings</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Errors</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {batches?.map(batch => (
                <tr key={batch?.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-foreground">{formatDate(batch?.imported_at)}</td>
                  <td className="px-4 py-3 text-foreground">{batch?.imported_by_name || '—'}</td>
                  <td className="px-4 py-3 text-foreground">{batch?.office_name || '—'}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{batch?.source?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-center font-semibold">{batch?.total_rows}</td>
                  <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{batch?.valid_rows}</td>
                  <td className="px-4 py-3 text-center text-amber-700 font-semibold">{batch?.warning_rows}</td>
                  <td className="px-4 py-3 text-center text-red-700 font-semibold">{batch?.error_rows}</td>
                  <td className="px-4 py-3"><StatusBadge status={batch?.batch_status} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewDetails(batch)}
                      className="flex items-center gap-1 px-3 py-1 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Icon name="Eye" size={12} />Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Batch detail modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Import Batch Details</h3>
                <p className="text-xs text-muted-foreground">{formatDate(selectedBatch?.imported_at)} · {selectedBatch?.imported_by_name} · {selectedBatch?.office_name}</p>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="p-2 hover:bg-muted rounded-lg">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {rowsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="Loader" size={24} className="animate-spin text-primary" />
                </div>
              ) : batchRows?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No row details available</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Row</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Product / Company</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">ID Number</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows?.map(row => (
                        <tr key={row?.id} className="border-t border-border">
                          <td className="px-3 py-2 text-muted-foreground">{row?.row_number}</td>
                          <td className="px-3 py-2"><RowStatusBadge status={row?.validation_status} /></td>
                          <td className="px-3 py-2">{row?.parsed_data?.product_name || row?.parsed_data?.company || row?.raw_data?.product_name || row?.raw_data?.implant_company_name || '—'}</td>
                          <td className="px-3 py-2">{row?.raw_data?.identification_number || '—'}</td>
                          <td className="px-3 py-2 max-w-xs">
                            {Array.isArray(row?.validation_messages) ? row?.validation_messages?.map((m, i) => (
                              <div key={i} className="text-xs text-muted-foreground">{m}</div>
                            )) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportHistoryTab;
