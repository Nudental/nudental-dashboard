import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const OFFICES = [
  'All Offices',
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const CATEGORIES = [
  'All',
  'General Office',
  'Printing & Forms',
  'Patient Check-In/Out',
  'Insurance/Billing',
  'Technology/Equipment',
  'Reception/Waiting',
  'Cleaning/Maintenance',
  'Mail/Shipping',
  'Security/Financial',
  'Emergency/Backup',
];

const AMAZON_STATUS_OPTIONS = ['All', 'Closed', 'Pending Fulfillment', 'Pending'];
const RECEIVING_STATUS_OPTIONS = ['All', 'Received', 'Pending', 'Not Received', 'Partial'];

const PENDING_STATUSES = ['Pending', 'Pending Fulfillment'];

const fmt = (val) => (val == null || val === '' ? '—' : val);
const fmtDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val + 'T00:00:00' : val)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return val; }
};
const fmtMonth = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val + (val?.length === 7 ? '-01T00:00:00' : val?.length === 10 ? 'T00:00:00' : ''));
    return d?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return val; }
};
const fmtCurrency = (val) => {
  if (val == null || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return `$${n?.toFixed(2)}`;
};

const AmazonStatusBadge = ({ status }) => {
  const cfg =
    status === 'Closed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    status === 'Pending Fulfillment' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    status === 'Pending' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg}`}>
      {status || '—'}
    </span>
  );
};

const ReceivingBadge = ({ status }) => {
  const cfg =
    status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
    status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
    status === 'Pending' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg}`}>
      {status || '—'}
    </span>
  );
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
const MarkClosedModal = ({ rows, onConfirm, onCancel, loading }) => {
  const isBulk = rows?.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Icon name="AlertTriangle" size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isBulk ? `Mark ${rows?.length} Orders Closed?` : 'Mark Order Closed?'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Amazon order status update</p>
          </div>
        </div>

        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
          <strong>Important:</strong> This changes the Amazon order status to <strong>Closed</strong> for tracking purposes only. It does not mark the item received by the office and does not update current inventory.
        </div>

        {isBulk ? (
          <p className="text-sm text-foreground">
            You are about to mark <span className="font-semibold">{rows?.length} Amazon order line{rows?.length !== 1 ? 's' : ''}</span> as <span className="font-semibold text-emerald-700">Closed</span>.
          </p>
        ) : (
          <div className="text-sm text-foreground space-y-1">
            <p>You are about to mark this Amazon order line as <span className="font-semibold text-emerald-700">Closed</span>:</p>
            <p className="text-xs text-muted-foreground font-mono">{rows?.[0]?.order_id || '—'}</p>
            <p className="text-xs text-foreground font-medium truncate">{rows?.[0]?.item_name || '—'}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Only <code className="bg-muted px-1 rounded">front_desk_amazon_orders.amazon_order_status</code> will be updated. No inventory quantities, receiving status, or request workflows will be changed.
        </p>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-xl hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Updating...</>
            ) : (
              <><Icon name="CheckCircle" size={14} />Confirm Mark Closed</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const FrontDeskAmazonOrderHistory = () => {
  const { user, userProfile } = useAuth();

  // Permission: admin / super_admin / office_manager / regional_clinical_manager can mark closed
  const canMarkClosed =
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'office_manager' ||
    userProfile?.role === 'regional_clinical_manager';

  const [orders, setOrders] = useState([]);
  // Client-side inventory item map: front_desk_item_id → { item_name, category, office_location }
  const [inventoryMap, setInventoryMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mark Closed state
  const [markClosedRows, setMarkClosedRows] = useState(null); // null = modal closed, array = rows to close
  const [markClosedLoading, setMarkClosedLoading] = useState(false);
  const [markClosedError, setMarkClosedError] = useState('');
  const [markClosedSuccess, setMarkClosedSuccess] = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filters
  const [filterOffice, setFilterOffice] = useState('All Offices');
  const [filterMonthFrom, setFilterMonthFrom] = useState('');
  const [filterMonthTo, setFilterMonthTo] = useState('');
  const [filterAmazonStatus, setFilterAmazonStatus] = useState('All');
  const [filterReceivingStatus, setFilterReceivingStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRequester, setFilterRequester] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ── Step 1: Query front_desk_amazon_orders directly (no embedded join) ──
      let query = supabase
        ?.from('front_desk_amazon_orders')
        ?.select('*')
        ?.order('order_date', { ascending: false });

      if (filterOffice && filterOffice !== 'All Offices') {
        query = query?.eq('office_location', filterOffice);
      }
      if (filterAmazonStatus && filterAmazonStatus !== 'All') {
        query = query?.eq('amazon_order_status', filterAmazonStatus);
      }
      if (filterReceivingStatus && filterReceivingStatus !== 'All') {
        query = query?.eq('receiving_status', filterReceivingStatus);
      }
      if (filterCategory && filterCategory !== 'All') {
        query = query?.eq('front_desk_category', filterCategory);
      }

      const { data: orderData, error: qErr } = await query;
      if (qErr) throw qErr;

      const rows = orderData || [];
      setOrders(rows);

      // ── Step 2: Collect unique front_desk_item_ids from returned rows ──
      const itemIds = [...new Set(
        rows
          ?.map(o => o?.front_desk_item_id)
          ?.filter(id => id != null && id !== '')
      )];

      if (itemIds?.length > 0) {
        // ── Step 3: Query front_desk_inventory for those IDs separately ──
        const { data: invData, error: invErr } = await supabase
          ?.from('front_desk_inventory')
          ?.select('id, item_name, category, office_location')
          ?.in('id', itemIds);

        if (!invErr && invData) {
          // ── Step 4: Build client-side id → item map ──
          const map = {};
          invData?.forEach(inv => {
            map[inv?.id] = {
              item_name: inv?.item_name,
              category: inv?.category,
              office_location: inv?.office_location,
            };
          });
          setInventoryMap(map);
        } else {
          setInventoryMap({});
        }
      } else {
        setInventoryMap({});
      }
    } catch (err) {
      setError(err?.message || 'Failed to load Amazon order history');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterAmazonStatus, filterReceivingStatus, filterCategory]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Client-side filters: month range, search, requester
  const displayedOrders = orders?.filter(o => {
    if (filterMonthFrom) {
      const orderMonth = o?.order_month || o?.order_date?.slice(0, 7);
      if (orderMonth && orderMonth < filterMonthFrom) return false;
    }
    if (filterMonthTo) {
      const orderMonth = o?.order_month || o?.order_date?.slice(0, 7);
      if (orderMonth && orderMonth > filterMonthTo) return false;
    }
    if (filterSearch?.trim()) {
      const term = filterSearch?.toLowerCase();
      const name = (o?.item_name || '')?.toLowerCase();
      const asin = (o?.asin || '')?.toLowerCase();
      const orderId = (o?.order_id || '')?.toLowerCase();
      const seller = (o?.seller_name || '')?.toLowerCase();
      if (!name?.includes(term) && !asin?.includes(term) && !orderId?.includes(term) && !seller?.includes(term)) return false;
    }
    if (filterRequester?.trim()) {
      const term = filterRequester?.toLowerCase();
      const req = (o?.requester_name || '')?.toLowerCase();
      if (!req?.includes(term)) return false;
    }
    return true;
  });

  // ── Summary cards ─────────────────────────────────────────────────────────
  const totalSpend = displayedOrders?.reduce((sum, o) => sum + (parseFloat(o?.item_net_total) || 0), 0);
  const uniqueOrders = [...new Set(displayedOrders?.map(o => o?.order_id)?.filter(Boolean))]?.length;
  const totalLineItems = displayedOrders?.length;
  const pendingItems = displayedOrders?.filter(o =>
    PENDING_STATUSES?.includes(o?.amazon_order_status)
  )?.length;

  // Top office by spend
  const officeSpend = {};
  displayedOrders?.forEach(o => {
    const off = o?.office_location || 'Unknown';
    officeSpend[off] = (officeSpend?.[off] || 0) + (parseFloat(o?.item_net_total) || 0);
  });
  const topOffice = Object.entries(officeSpend)?.sort((a, b) => b?.[1] - a?.[1])?.[0];

  // Top category by spend — use front_desk_category from order row
  const catSpend = {};
  displayedOrders?.forEach(o => {
    const linkedItem = o?.front_desk_item_id ? inventoryMap?.[o?.front_desk_item_id] : null;
    const cat = o?.front_desk_category || linkedItem?.category || 'Uncategorized';
    catSpend[cat] = (catSpend?.[cat] || 0) + (parseFloat(o?.item_net_total) || 0);
  });
  const topCategory = Object.entries(catSpend)?.sort((a, b) => b?.[1] - a?.[1])?.[0];

  // Spend by office breakdown
  const spendByOffice = Object.entries(officeSpend)?.sort((a, b) => b?.[1] - a?.[1]);

  // Spend by month
  const monthSpend = {};
  displayedOrders?.forEach(o => {
    const m = o?.order_month || o?.order_date?.slice(0, 7) || 'Unknown';
    monthSpend[m] = (monthSpend?.[m] || 0) + (parseFloat(o?.item_net_total) || 0);
  });
  const spendByMonth = Object.entries(monthSpend)?.sort((a, b) => a?.[0]?.localeCompare(b?.[0]));

  // Spend by category
  const spendByCategory = Object.entries(catSpend)?.sort((a, b) => b?.[1] - a?.[1])?.slice(0, 10);

  // Top items by spend — use item_net_total per spec
  const itemSpend = {};
  displayedOrders?.forEach(o => {
    const name = o?.item_name || '—';
    itemSpend[name] = (itemSpend?.[name] || 0) + (parseFloat(o?.item_net_total) || 0);
  });
  const topItems = Object.entries(itemSpend)?.sort((a, b) => b?.[1] - a?.[1])?.slice(0, 10);

  // Pending orders
  const pendingOrders = displayedOrders?.filter(o =>
    PENDING_STATUSES?.includes(o?.amazon_order_status)
  );

  const hasActiveFilters = filterOffice !== 'All Offices' || filterMonthFrom || filterMonthTo ||
    filterAmazonStatus !== 'All' || filterReceivingStatus !== 'All' || filterCategory !== 'All' ||
    filterSearch?.trim() || filterRequester?.trim();

  const handleClearFilters = () => {
    setFilterOffice('All Offices');
    setFilterMonthFrom('');
    setFilterMonthTo('');
    setFilterAmazonStatus('All');
    setFilterReceivingStatus('All');
    setFilterCategory('All');
    setFilterSearch('');
    setFilterRequester('');
  };

  // ── Mark Closed logic ─────────────────────────────────────────────────────
  const handleMarkClosedClick = (row) => {
    setMarkClosedRows([row]);
    setMarkClosedError('');
    setMarkClosedSuccess('');
  };

  const handleBulkMarkClosedClick = () => {
    const selectedPendingRows = displayedOrders?.filter(o =>
      selectedIds?.has(o?.id) && PENDING_STATUSES?.includes(o?.amazon_order_status)
    );
    if (selectedPendingRows?.length === 0) return;
    setMarkClosedRows(selectedPendingRows);
    setMarkClosedError('');
    setMarkClosedSuccess('');
  };

  const handleMarkClosedConfirm = async () => {
    if (!markClosedRows?.length) return;
    setMarkClosedLoading(true);
    setMarkClosedError('');

    const ids = markClosedRows?.map(r => r?.id);
    const now = new Date()?.toISOString();
    const changedBy = user?.id;

    try {
      // ── Update only amazon_order_status = 'Closed' ──
      const { error: updateErr } = await supabase
        ?.from('front_desk_amazon_orders')
        ?.update({ amazon_order_status: 'Closed' })
        ?.in('id', ids);

      if (updateErr) throw updateErr;

      // ── Audit log — non-blocking, one row per updated record ──
      const auditRows = markClosedRows?.map(r => ({
        record_type: 'front_desk_amazon_order',
        action: 'amazon_status_marked_closed',
        record_id: r?.id,
        old_values: { amazon_order_status: r?.amazon_order_status },
        new_values: { amazon_order_status: 'Closed' },
        changed_by: changedBy,
        changed_at: now,
        metadata: {
          order_id: r?.order_id || null,
          item_name: r?.item_name || null,
          office_location: r?.office_location || null,
          note: 'Amazon status manually marked Closed in dashboard; does not indicate office receipt.',
        },
      }));

      const { error: auditErr } = await supabase
        ?.from('supply_audit_logs')
        ?.insert(auditRows);

      if (auditErr) {
        // Audit gap — update succeeded but log failed; report clearly, do not silently ignore
        console.warn(
          '[FrontDeskAmazonOrderHistory] supply_audit_logs insert failed (audit gap — update succeeded):',
          auditErr?.message,
          auditErr
        );
        setMarkClosedSuccess(
          `${ids?.length} order${ids?.length !== 1 ? 's' : ''} marked Closed. ⚠️ Audit log could not be written (${auditErr?.message}). The status update was saved.`
        );
      } else {
        setMarkClosedSuccess(
          `${ids?.length} order${ids?.length !== 1 ? 's' : ''} marked Closed. Audit log written.`
        );
      }

      // Update local state — change amazon_order_status in orders array
      setOrders(prev =>
        prev?.map(o =>
          ids?.includes(o?.id) ? { ...o, amazon_order_status: 'Closed' } : o
        )
      );

      // Clear selection
      setSelectedIds(new Set());
      setMarkClosedRows(null);
    } catch (err) {
      setMarkClosedError(err?.message || 'Failed to mark order(s) Closed');
    } finally {
      setMarkClosedLoading(false);
    }
  };

  // Bulk selection helpers
  const pendingDisplayedIds = displayedOrders
    ?.filter(o => PENDING_STATUSES?.includes(o?.amazon_order_status))
    ?.map(o => o?.id);

  const allPendingSelected =
    pendingDisplayedIds?.length > 0 &&
    pendingDisplayedIds?.every(id => selectedIds?.has(id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pendingDisplayedIds?.forEach(id => next?.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pendingDisplayedIds?.forEach(id => next?.add(id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next?.has(id)) next?.delete(id);
      else next?.add(id);
      return next;
    });
  };

  const selectedPendingCount = [...selectedIds]?.filter(id =>
    displayedOrders?.find(o => o?.id === id && PENDING_STATUSES?.includes(o?.amazon_order_status))
  )?.length;

  const handleExportCSV = () => {
    const headers = [
      'Order Date', 'Order Month', 'Office', 'Requester', 'Ordered By', 'Approved By',
      'Order ID', 'Amazon Status', 'Receiving Status', 'ASIN', 'Item Name',
      'Linked Inventory Item', 'Category', 'Quantity', 'Purchase PPU',
      'Item Subtotal', 'Tax', 'Net Total', 'Seller', 'Payment Card Ending',
    ];
    const rows = displayedOrders?.map(o => {
      const linkedItem = o?.front_desk_item_id ? inventoryMap?.[o?.front_desk_item_id] : null;
      const linkedName = linkedItem?.item_name || (o?.front_desk_item_id ? '—' : 'Unlinked');
      return [
        o?.order_date || '',
        o?.order_month || '',
        `"${(o?.office_location || '')?.replace(/"/g, '""')}"`,
        `"${(o?.requester_name || '')?.replace(/"/g, '""')}"`,
        `"${(o?.ordered_by || '')?.replace(/"/g, '""')}"`,
        `"${(o?.approved_by || '')?.replace(/"/g, '""')}"`,
        o?.order_id || '',
        o?.amazon_order_status || '',
        o?.receiving_status || '',
        o?.asin || '',
        `"${(o?.item_name || '')?.replace(/"/g, '""')}"`,
        `"${linkedName?.replace(/"/g, '""')}"`,
        o?.front_desk_category || '',
        o?.item_quantity ?? '',
        o?.purchase_ppu ?? '',
        o?.item_subtotal ?? '',
        o?.item_tax ?? '',
        o?.item_net_total ?? '',
        `"${(o?.seller_name || '')?.replace(/"/g, '""')}"`,
        o?.payment_card_ending || '',
      ];
    });
    const csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `front-desk-amazon-order-history-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Confirmation Modal */}
      {markClosedRows && (
        <MarkClosedModal
          rows={markClosedRows}
          onConfirm={handleMarkClosedConfirm}
          onCancel={() => { setMarkClosedRows(null); setMarkClosedError(''); }}
          loading={markClosedLoading}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Amazon Order History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Front Desk Amazon purchase records from <code className="text-xs bg-muted px-1 rounded">front_desk_amazon_orders</code>
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={displayedOrders?.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="Download" size={14} />Export CSV ({displayedOrders?.length} rows)
        </button>
      </div>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <Icon name="Info" size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Amazon Order History</strong> shows purchase/order records. It does not update current inventory quantities and does not prove office receipt unless a received status is present.
        </span>
      </div>

      {/* Mark Closed success/error feedback */}
      {markClosedSuccess && (
        <div className="flex items-start gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{markClosedSuccess}</span>
          <button onClick={() => setMarkClosedSuccess('')} className="ml-auto flex-shrink-0"><Icon name="X" size={13} /></button>
        </div>
      )}
      {markClosedError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <Icon name="AlertCircle" size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
          <span>{markClosedError}</span>
          <button onClick={() => setMarkClosedError('')} className="ml-auto flex-shrink-0"><Icon name="X" size={13} /></button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">Total Amazon Spend</p>
          <p className="text-xl font-bold text-emerald-700">{loading ? '—' : fmtCurrency(totalSpend)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : uniqueOrders}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Total Line Items</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : totalLineItems}</p>
        </div>
        {/* Renamed: "Pending Items" → "Amazon Pending Shipment Items" */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-yellow-700 mb-1">Amazon Pending Shipment Items</p>
          <p className="text-2xl font-bold text-yellow-700">{loading ? '—' : pendingItems}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Top Office</p>
          <p className="text-sm font-bold text-blue-700 truncate" title={topOffice?.[0] || '—'}>
            {loading ? '—' : topOffice ? topOffice?.[0]?.replace('Nu Dental of ', '') : '—'}
          </p>
          {!loading && topOffice && (
            <p className="text-xs text-blue-600">{fmtCurrency(topOffice?.[1])}</p>
          )}
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-700 mb-1">Top Category</p>
          <p className="text-sm font-bold text-purple-700 truncate" title={topCategory?.[0] || '—'}>
            {loading ? '—' : topCategory?.[0] || '—'}
          </p>
          {!loading && topCategory && (
            <p className="text-xs text-purple-600">{fmtCurrency(topCategory?.[1])}</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Office */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Office</label>
            <select
              value={filterOffice}
              onChange={e => setFilterOffice(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[190px]"
            >
              {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* Month From */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Month From</label>
            <input
              type="month"
              value={filterMonthFrom}
              onChange={e => setFilterMonthFrom(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {/* Month To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Month To</label>
            <input
              type="month"
              value={filterMonthTo}
              onChange={e => setFilterMonthTo(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {/* Amazon Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Amazon Status</label>
            <select
              value={filterAmazonStatus}
              onChange={e => setFilterAmazonStatus(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
              {AMAZON_STATUS_OPTIONS?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Receiving Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Receiving Status</label>
            <select
              value={filterReceivingStatus}
              onChange={e => setFilterReceivingStatus(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
            >
              {RECEIVING_STATUS_OPTIONS?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Category</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
              {CATEGORIES?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground">Search Item / ASIN / Order ID / Seller</label>
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
          {/* Requester */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-muted-foreground">Requester</label>
            <input
              type="text"
              placeholder="Filter by requester..."
              value={filterRequester}
              onChange={e => setFilterRequester(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {hasActiveFilters && (
            <div className="flex flex-col justify-end">
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
          {!loading && (
            <div className="flex flex-col justify-end ml-auto">
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{displayedOrders?.length}</span> of <span className="font-semibold text-foreground">{orders?.length}</span> rows
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <Icon name="AlertCircle" size={15} />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon name="X" size={14} /></button>
        </div>
      )}

      {/* Breakdown Tables */}
      {!loading && displayedOrders?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Spend by Office */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Icon name="MapPin" size={14} className="text-primary" />Spend by Office
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Office</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total Spend</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {spendByOffice?.map(([office, spend]) => (
                  <tr key={office} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium text-foreground">{office?.replace('Nu Dental of ', '')}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmtCurrency(spend)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                      {totalSpend > 0 ? `${((spend / totalSpend) * 100)?.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Spend by Month */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Icon name="Calendar" size={14} className="text-primary" />Spend by Month
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Month</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total Spend</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Line Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {spendByMonth?.map(([month, spend]) => {
                  const count = displayedOrders?.filter(o =>
                    (o?.order_month || o?.order_date?.slice(0, 7)) === month
                  )?.length;
                  return (
                    <tr key={month} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium text-foreground">{fmtMonth(month)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmtCurrency(spend)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Spend by Category */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Icon name="Tag" size={14} className="text-primary" />Spend by Category
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total Spend</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {spendByCategory?.map(([cat, spend]) => (
                  <tr key={cat} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium text-foreground">{cat}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmtCurrency(spend)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                      {totalSpend > 0 ? `${((spend / totalSpend) * 100)?.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Items by Spend */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Icon name="TrendingUp" size={14} className="text-primary" />Top Items by Spend
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Item Name</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Item Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topItems?.map(([name, spend]) => (
                  <tr key={name} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium text-foreground max-w-[240px]">
                      <span className="block truncate" title={name}>{name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fmtCurrency(spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Amazon Pending / Not Yet Closed section (renamed) ── */}
      {!loading && pendingOrders?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-100/60 space-y-1">
            {/* Renamed section header */}
            <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
              <Icon name="Clock" size={14} className="text-yellow-600" />
              Amazon Pending / Not Yet Closed ({pendingOrders?.length})
            </h4>
            {/* Clarifying note */}
            <p className="text-xs text-yellow-700">
              <Icon name="Info" size={11} className="inline mr-1 text-yellow-600" />
              Pending here is Amazon order status only. It does not mean the office received the item and it does not update current inventory.
            </p>
          </div>

          {/* Bulk action toolbar — admin only */}
          {canMarkClosed && (
            <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-yellow-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPendingSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                />
                Select all pending ({pendingDisplayedIds?.length})
              </label>
              {selectedPendingCount > 0 && (
                <button
                  onClick={handleBulkMarkClosedClick}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Icon name="CheckCircle" size={12} />
                  Mark Selected Closed ({selectedPendingCount})
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50">
                <tr>
                  {canMarkClosed && <th className="px-3 py-2 w-8" />}
                  {['Order Date', 'Office', 'Order ID', 'Item Name', 'Amazon Status', 'Qty', 'Net Total', ...(canMarkClosed ? ['Action'] : [])]?.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-yellow-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-200">
                {pendingOrders?.map((o, idx) => (
                  <tr key={o?.id || idx} className="hover:bg-yellow-100/40">
                    {canMarkClosed && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(o?.id)}
                          onChange={() => toggleSelectRow(o?.id)}
                          className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-xs text-yellow-900 whitespace-nowrap">{fmtDate(o?.order_date)}</td>
                    <td className="px-3 py-2.5 text-xs text-yellow-900">{o?.office_location?.replace('Nu Dental of ', '') || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-yellow-900">{fmt(o?.order_id)}</td>
                    <td className="px-3 py-2.5 text-xs text-yellow-900 max-w-[200px]">
                      <span className="block truncate" title={o?.item_name || ''}>{fmt(o?.item_name)}</span>
                    </td>
                    <td className="px-3 py-2.5"><AmazonStatusBadge status={o?.amazon_order_status} /></td>
                    <td className="px-3 py-2.5 text-xs text-yellow-900">{fmt(o?.item_quantity)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-yellow-900">{fmtCurrency(o?.item_net_total)}</td>
                    {canMarkClosed && (
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleMarkClosedClick(o)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-200 transition-colors whitespace-nowrap"
                          title="Mark this Amazon order as Closed (tracking only — does not affect inventory)"
                        >
                          <Icon name="CheckCircle" size={11} />Mark Closed
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Orders Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground">All Order Lines</h4>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {displayedOrders?.length} row{displayedOrders?.length !== 1 ? 's' : ''}
              {totalSpend > 0 && <> · Total: <span className="font-semibold text-emerald-700">{fmtCurrency(totalSpend)}</span></>}
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedOrders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="ShoppingBag" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No Amazon orders match the current filters.</p>
            {hasActiveFilters && (
              <button onClick={handleClearFilters} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {[
                    'Order Date', 'Month', 'Office', 'Requester', 'Ordered By', 'Approved By',
                    'Order ID', 'Amazon Status', 'Receiving', 'ASIN', 'Item Name',
                    'Linked Item', 'Category', 'Qty', 'PPU', 'Subtotal', 'Tax', 'Net Total',
                    'Seller', 'Card Ending',
                    ...(canMarkClosed ? ['Action'] : []),
                  ]?.map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedOrders?.map((o, idx) => {
                  // ── Step 5: Resolve linked item name from client-side map ──
                  const linkedItem = o?.front_desk_item_id ? inventoryMap?.[o?.front_desk_item_id] : null;
                  const linkedName = linkedItem?.item_name || null;
                  const isLinked = !!o?.front_desk_item_id;
                  const isPending = PENDING_STATUSES?.includes(o?.amazon_order_status);
                  return (
                    <tr key={o?.id || idx} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o?.order_date)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtMonth(o?.order_month)}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">{o?.office_location?.replace('Nu Dental of ', '') || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground">{fmt(o?.requester_name)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(o?.ordered_by)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(o?.approved_by)}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{fmt(o?.order_id)}</td>
                      <td className="px-3 py-2.5"><AmazonStatusBadge status={o?.amazon_order_status} /></td>
                      <td className="px-3 py-2.5"><ReceivingBadge status={o?.receiving_status} /></td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{fmt(o?.asin)}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground max-w-[200px]">
                        <span className="block truncate" title={o?.item_name || ''}>{fmt(o?.item_name)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px]">
                        {isLinked ? (
                          <div className="flex items-center gap-1.5">
                            <span className="block truncate text-foreground" title={linkedName || ''}>{linkedName || '—'}</span>
                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">Linked</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unlinked</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmt(o?.front_desk_category)}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground">{fmt(o?.item_quantity)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtCurrency(o?.purchase_ppu)}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground">{fmtCurrency(o?.item_subtotal)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtCurrency(o?.item_tax)}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-foreground">{fmtCurrency(o?.item_net_total)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px]">
                        <span className="block truncate" title={o?.seller_name || ''}>{fmt(o?.seller_name)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(o?.payment_card_ending)}</td>
                      {canMarkClosed && (
                        <td className="px-3 py-2.5">
                          {isPending ? (
                            <button
                              onClick={() => handleMarkClosedClick(o)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-200 transition-colors whitespace-nowrap"
                              title="Mark this Amazon order as Closed (tracking only)"
                            >
                              <Icon name="CheckCircle" size={11} />Mark Closed
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && displayedOrders?.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/10 text-xs text-muted-foreground">
            {displayedOrders?.length} row{displayedOrders?.length !== 1 ? 's' : ''} shown
            {hasActiveFilters ? ' (filtered)' : ''} — data source: <code className="bg-muted px-1 rounded">front_desk_amazon_orders</code>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrontDeskAmazonOrderHistory;
