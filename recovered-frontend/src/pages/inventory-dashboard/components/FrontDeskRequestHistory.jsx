import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { frontDeskInventoryService } from '../../../services/frontDeskInventoryService';

// ── Constants ─────────────────────────────────────────────────────────────────
const OFFICES = frontDeskInventoryService?.getOffices();

const FD_HISTORY_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'partially_fulfilled',
  'fulfilled',
];

const STATUS_BADGE = {
  draft:               'bg-gray-100 text-gray-700',
  submitted:           'bg-blue-100 text-blue-700',
  under_review:        'bg-yellow-100 text-yellow-700',
  approved:            'bg-green-100 text-green-700',
  partially_fulfilled: 'bg-orange-100 text-orange-700',
  fulfilled:           'bg-emerald-100 text-emerald-700',
  rejected:            'bg-red-100 text-red-700',
  pending:             'bg-gray-100 text-gray-600',
};

const STATUS_LABEL = {
  draft:               'Draft',
  submitted:           'Submitted',
  under_review:        'Under Review',
  approved:            'Approved',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled:           'Fulfilled',
  rejected:            'Rejected',
  pending:             'Pending',
};

const fmt = (v) => (v == null || v === '' ? '—' : v);
const fmtQty = (v) => (v == null || v === '' ? '—' : Number(v));
const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch (_) { return '—'; }
};
const fmtMonth = (v) => {
  if (!v) return '—';
  const s = String(v)?.slice(0, 7);
  try { return new Date(s + '-01T00:00:00')?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  catch (_) { return s; }
};

// ── Data fetcher ──────────────────────────────────────────────────────────────
// Fetches item-level rows by joining supply_request_batches + supply_request_items
// strictly filtered to department_category = 'Front Desk'.
const fetchFrontDeskItemHistory = async ({ office, month, status }) => {
  // Step 1: fetch matching batches (server-side filters)
  let batchQuery = supabase
    ?.from('supply_request_batches')
    ?.select(`
      id,
      office_id,
      request_month,
      batch_status,
      submitted_at,
      created_at,
      reviewer_notes,
      requested_by_profile:user_profiles!supply_request_batches_requested_by_fkey(full_name),
      reviewer_profile:user_profiles!supply_request_batches_reviewer_id_fkey(full_name)
    `)
    ?.eq('department_category', 'Front Desk')
    ?.order('created_at', { ascending: false });

  if (office) batchQuery = batchQuery?.eq('office_id', office);
  if (status) batchQuery = batchQuery?.eq('batch_status', status);
  if (month) {
    const monthDate = month?.length === 7 ? `${month}-01` : month;
    batchQuery = batchQuery?.eq('request_month', monthDate);
  }

  const { data: batches, error: batchErr } = await batchQuery;
  if (batchErr) throw batchErr;
  if (!batches?.length) return [];

  const batchIds = batches?.map(b => b?.id);

  // Step 2: fetch all items for those batches
  const { data: items, error: itemErr } = await supabase
    ?.from('supply_request_items')
    ?.select(`
      id,
      batch_id,
      custom_item_name,
      requested_qty,
      approved_qty,
      fulfilled_qty,
      item_status,
      priority,
      reason_notes,
      created_at,
      supply_items(name)
    `)
    ?.in('batch_id', batchIds)
    ?.order('created_at', { ascending: false });

  if (itemErr) throw itemErr;

  // Step 3: build a lookup map for batches
  const batchMap = {};
  (batches || [])?.forEach(b => { batchMap[b?.id] = b; });

  // Step 4: flatten into item-level rows
  return (items || [])?.map(item => {
    const batch = batchMap?.[item?.batch_id] || {};
    return {
      item_row_id: item?.id,
      batch_id: item?.batch_id,
      office: batch?.office_id || '—',
      request_month: batch?.request_month || null,
      item_name: item?.custom_item_name || item?.supply_items?.name || null,
      requested_qty: item?.requested_qty,
      approved_qty: item?.approved_qty,
      fulfilled_qty: item?.fulfilled_qty,
      item_status: item?.item_status,
      batch_status: batch?.batch_status,
      priority: item?.priority,
      reason_notes: item?.reason_notes,
      requested_by: batch?.requested_by_profile?.full_name || null,
      reviewed_by: batch?.reviewer_profile?.full_name || null,
      reviewer_notes: batch?.reviewer_notes || null,
      submitted_at: batch?.submitted_at || batch?.created_at || null,
    };
  });
};

// ── Summary cards ─────────────────────────────────────────────────────────────
const SummaryCards = ({ rows }) => {
  const totalItems = rows?.length ?? 0;
  const totalQtyRequested = rows?.reduce((s, r) => s + (Number(r?.requested_qty) || 0), 0);
  const totalQtyApproved  = rows?.reduce((s, r) => s + (Number(r?.approved_qty)  || 0), 0);
  const totalQtyFulfilled = rows?.reduce((s, r) => s + (Number(r?.fulfilled_qty) || 0), 0);
  const rejectedItems     = rows?.filter(r => r?.batch_status === 'rejected' || r?.item_status === 'rejected')?.length ?? 0;

  const hasApproved   = rows?.some(r => r?.approved_qty  != null);
  const hasFulfilled  = rows?.some(r => r?.fulfilled_qty != null);

  const cards = [
    { label: 'Total Items Requested', value: totalItems,        icon: 'ClipboardList', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Total Qty Requested',   value: totalQtyRequested, icon: 'Package',       color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { label: 'Approved Qty',          value: hasApproved  ? totalQtyApproved  : null, icon: 'CheckCircle', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Fulfilled Qty',         value: hasFulfilled ? totalQtyFulfilled : null, icon: 'Truck',       color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Rejected Items',        value: rejectedItems,     icon: 'XCircle',       color: 'bg-red-50 border-red-200 text-red-700' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards?.map(c => (
        <div key={c?.label} className={`flex flex-col gap-1 p-3 rounded-xl border ${c?.color}`}>
          <div className="flex items-center gap-1.5">
            <Icon name={c?.icon} size={13} />
            <span className="text-xs font-semibold">{c?.label}</span>
          </div>
          <p className="text-xl font-bold leading-none mt-0.5">
            {c?.value == null ? '—' : c?.value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ── CSV export ────────────────────────────────────────────────────────────────
const exportCSV = (rows) => {
  const headers = [
    'Office',
    'Request Month',
    'Item',
    'Qty Requested',
    'Qty Approved',
    'Qty Fulfilled',
    'Batch Status',
    'Item Status',
    'Requested By',
    'Reviewed By',
    'Reviewer Notes',
    'Submitted Date',
  ];

  const escape = (v) => {
    if (v == null || v === '') return '';
    const s = String(v)?.replace(/"/g, '""');
    return s?.includes(',') || s?.includes('"') || s?.includes('\n') ? `"${s}"` : s;
  };

  const dataRows = rows?.map(r => [
    escape(r?.office),
    escape(fmtMonth(r?.request_month)),
    escape(r?.item_name || '—'),
    escape(r?.requested_qty ?? ''),
    escape(r?.approved_qty  ?? ''),
    escape(r?.fulfilled_qty ?? ''),
    escape(STATUS_LABEL?.[r?.batch_status] || r?.batch_status || ''),
    escape(STATUS_LABEL?.[r?.item_status]  || r?.item_status  || ''),
    escape(r?.requested_by || ''),
    escape(r?.reviewed_by  || ''),
    escape(r?.reviewer_notes || ''),
    escape(fmtDate(r?.submitted_at)),
  ]);

  const csv = [headers?.join(','), ...dataRows?.map(r => r?.join(','))]?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL?.createObjectURL(blob);
  const a = document?.createElement('a');
  a.href = url;
  a.download = `front-desk-request-history-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
  a?.click();
  URL?.revokeObjectURL(url);
};

// ── Main component ────────────────────────────────────────────────────────────
const FrontDeskRequestHistory = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Filters
  const [filterOffice,  setFilterOffice]  = useState('');
  const [filterMonth,   setFilterMonth]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterSearch,  setFilterSearch]  = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchFrontDeskItemHistory({
        office: filterOffice || undefined,
        month:  filterMonth  || undefined,
        status: filterStatus || undefined,
      });
      setRows(data);
    } catch (e) {
      setError(e?.message || 'Failed to load request history');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterMonth, filterStatus]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Client-side search on item name
  const displayedRows = rows?.filter(r => {
    if (!filterSearch?.trim()) return true;
    const term = filterSearch?.toLowerCase();
    const itemName = (r?.item_name || '')?.toLowerCase();
    const office   = (r?.office    || '')?.toLowerCase();
    const reqBy    = (r?.requested_by || '')?.toLowerCase();
    return itemName?.includes(term) || office?.includes(term) || reqBy?.includes(term);
  });

  const hasActiveFilters = filterOffice || filterMonth || filterStatus || filterSearch;

  const clearFilters = () => {
    setFilterOffice('');
    setFilterMonth('');
    setFilterStatus('');
    setFilterSearch('');
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Icon name="History" size={16} className="text-indigo-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Request History</h3>
            <p className="text-xs text-muted-foreground">
              Item-level order history — Front Desk requests only (department_category = 'Front Desk')
            </p>
          </div>
        </div>
        <button
          onClick={() => exportCSV(displayedRows)}
          disabled={displayedRows?.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-success text-success-foreground rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export filtered rows as CSV"
        >
          <Icon name="Download" size={14} />
          Export CSV ({displayedRows?.length})
        </button>
      </div>
      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
            <Icon name="X" size={12} />
          </button>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-muted/20 rounded-xl border border-border">
        {/* Office */}
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

        {/* Month */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Request Month</label>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e?.target?.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e?.target?.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Statuses</option>
            {FD_HISTORY_STATUSES?.map(s => (
              <option key={s} value={s}>{STATUS_LABEL?.[s] || s}</option>
            ))}
          </select>
        </div>

        {/* Search item */}
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground">Search Item / Requester</label>
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search item name, office, requester..."
              value={filterSearch}
              onChange={e => setFilterSearch(e?.target?.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
            />
          </div>
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <div className="flex flex-col justify-end">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Refresh */}
        <div className="flex flex-col justify-end">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-40"
          >
            <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {/* Summary cards — based on filtered (displayed) rows */}
      {!loading && displayedRows?.length > 0 && (
        <SummaryCards rows={displayedRows} />
      )}
      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedRows?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Icon name="History" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No Front Desk request history found</p>
            <p className="text-xs mt-1">
              {hasActiveFilters ? 'Try adjusting your filters' : 'No requests have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  {[
                    'Office',
                    'Request Month',
                    'Item',
                    'Qty Requested',
                    'Qty Approved',
                    'Qty Fulfilled',
                    'Status',
                    'Requested By',
                    'Reviewed By',
                    'Reviewer Notes',
                    'Submitted Date',
                  ]?.map(h => (
                    <th
                      key={h}
                      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedRows?.map((r, idx) => (
                  <tr
                    key={r?.item_row_id || idx}
                    className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                  >
                    {/* Office */}
                    <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                      {fmt(r?.office)}
                    </td>

                    {/* Request Month */}
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {fmtMonth(r?.request_month)}
                    </td>

                    {/* Item — custom_item_name when item_id is null */}
                    <td className="py-2.5 px-3 font-medium max-w-[200px]">
                      {r?.item_name ? (
                        <span>{r?.item_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">—</span>
                      )}
                    </td>

                    {/* Qty Requested */}
                    <td className="py-2.5 px-3 text-center font-semibold">
                      {fmtQty(r?.requested_qty)}
                    </td>

                    {/* Qty Approved */}
                    <td className="py-2.5 px-3 text-center">
                      {r?.approved_qty != null ? (
                        <span className="font-semibold text-green-700">{r?.approved_qty}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Qty Fulfilled */}
                    <td className="py-2.5 px-3 text-center">
                      {r?.fulfilled_qty != null ? (
                        <span className="font-semibold text-emerald-700">{r?.fulfilled_qty}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status — shows batch status */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                          STATUS_BADGE?.[r?.batch_status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATUS_LABEL?.[r?.batch_status] || fmt(r?.batch_status)}
                      </span>
                    </td>

                    {/* Requested By */}
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {fmt(r?.requested_by)}
                    </td>

                    {/* Reviewed By */}
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {fmt(r?.reviewed_by)}
                    </td>

                    {/* Reviewer Notes */}
                    <td className="py-2.5 px-3 text-muted-foreground max-w-[200px]">
                      {r?.reviewer_notes ? (
                        <span
                          className="block truncate text-xs"
                          title={r?.reviewer_notes}
                        >
                          {r?.reviewer_notes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-xs">
                      {fmtDate(r?.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Footer note */}
      {!loading && (
        <p className="text-xs text-muted-foreground px-1">
          Showing <span className="font-semibold">{displayedRows?.length}</span> item row{displayedRows?.length !== 1 ? 's' : ''} from{' '}
          <span className="font-semibold">department_category = 'Front Desk'</span> requests.
          {hasActiveFilters && ' Filters active — summary cards reflect filtered rows only.'}
          {' '}Missing values show —.
        </p>
      )}
    </div>
  );
};

export default FrontDeskRequestHistory;
