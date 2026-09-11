import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const OFFICES = [
  'All Offices',
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const OFFICE_SHORT = {
  'Nu Dental of Eatontown':    'Eatontown',
  'Nu Dental of Brick':        'Brick',
  'Nu Dental of Barnegat':     'Barnegat',
  'Nu Dental of Staten Island':'Staten Island',
};

const OFFICE_KEYS = [
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

const STATUS_OPTIONS = ['All', 'In Stock', 'Low', 'Critically Low', 'Out of Stock', 'Discontinued'];
const ORDER_STATUS_OPTIONS = ['All', 'Not Ordered', 'Draft', 'Submitted', 'Approved', 'Ordered', 'Partially Fulfilled', 'Fulfilled', 'Rejected'];

const STATUS_CFG = {
  'In Stock':       { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Low':            { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  'Critically Low': { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200' },
  'Out of Stock':   { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200' },
  'Discontinued':   { bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-200' },
};

const ORDER_STATUS_CFG = {
  'Not Ordered':         { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Draft':               { bg: 'bg-gray-100',   text: 'text-gray-600' },
  'Submitted':           { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Approved':            { bg: 'bg-blue-100',   text: 'text-blue-700' },
  'Ordered':             { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'Partially Fulfilled': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Fulfilled':           { bg: 'bg-emerald-100',text: 'text-emerald-700' },
  'Rejected':            { bg: 'bg-red-100',    text: 'text-red-700' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG?.[status] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      {status || '—'}
    </span>
  );
};

const OrderStatusBadge = ({ status }) => {
  const cfg = ORDER_STATUS_CFG?.[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.bg} ${cfg?.text}`}>
      {status || '—'}
    </span>
  );
};

// Aggregate worst status across offices for a grouped row
const worstStatus = (statuses) => {
  const priority = ['Out of Stock', 'Critically Low', 'Low', 'In Stock', 'Discontinued'];
  for (const s of priority) {
    if (statuses?.includes(s)) return s;
  }
  return statuses?.[0] || '—';
};

// Group all raw rows by item_name + category into one row per unique item
const groupByUniqueItem = (rows) => {
  const map = new Map();
  rows?.forEach(row => {
    const key = `${row?.item_name || ''}|||${row?.category || ''}`;
    if (!map?.has(key)) {
      map?.set(key, {
        _key: key,
        item_name: row?.item_name,
        category: row?.category,
        offices: {},
        allStatuses: [],
        allOrderStatuses: [],
        priority: row?.priority,
        min_required: row?.min_required,
        notes: row?.notes,
      });
    }
    const entry = map?.get(key);
    const officeKey = row?.office_location || 'Unknown';
    entry.offices[officeKey] = {
      current_qty: row?.current_qty,
      status: row?.status,
      order_status: row?.order_status,
      last_supplied_date: row?.last_supplied_date,
    };
    if (row?.status) entry?.allStatuses?.push(row?.status);
    if (row?.order_status) entry?.allOrderStatuses?.push(row?.order_status);
  });
  return Array.from(map?.values());
};

const FrontDeskCurrentInventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Filters
  const [filterOffice, setFilterOffice] = useState('All Offices');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOrderStatus, setFilterOrderStatus] = useState('All');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLowOnly, setFilterLowOnly] = useState(false);
  const [filterOutOnly, setFilterOutOnly] = useState(false);

  const isAllOffices = filterOffice === 'All Offices';

  // Always load all rows (no server-side office filter when All Offices)
  // so we can group client-side. When a specific office is selected, filter server-side.
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        ?.from('front_desk_inventory')
        ?.select('*')
        ?.order('category')
        ?.order('item_name')
        ?.order('office_location');

      // Only apply server-side office filter when a specific office is selected
      if (!isAllOffices) {
        query = query?.eq('office_location', filterOffice);
      }
      if (filterCategory && filterCategory !== 'All') {
        query = query?.eq('category', filterCategory);
      }
      // Status/order_status filters: apply server-side only in single-office mode
      // In all-office grouped mode, we filter after grouping
      if (!isAllOffices) {
        if (filterStatus && filterStatus !== 'All') {
          query = query?.eq('status', filterStatus);
        }
        if (filterOrderStatus && filterOrderStatus !== 'All') {
          query = query?.eq('order_status', filterOrderStatus);
        }
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setItems(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterCategory, filterStatus, filterOrderStatus, isAllOffices]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Toggle row expansion for grouped view
  const toggleExpand = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next?.has(key)) next?.delete(key);
      else next?.add(key);
      return next;
    });
  };

  // ── All-offices grouped view ──────────────────────────────────────────────
  const groupedItems = isAllOffices ? groupByUniqueItem(items) : null;

  // Apply client-side filters to grouped rows
  const filteredGrouped = groupedItems?.filter(g => {
    if (filterSearch?.trim()) {
      const term = filterSearch?.toLowerCase();
      if (!(g?.item_name?.toLowerCase()?.includes(term) || g?.category?.toLowerCase()?.includes(term))) return false;
    }
    if (filterStatus !== 'All') {
      if (!g?.allStatuses?.includes(filterStatus)) return false;
    }
    if (filterOrderStatus !== 'All') {
      if (!g?.allOrderStatuses?.includes(filterOrderStatus)) return false;
    }
    if (filterLowOnly && filterStatus === 'All') {
      if (!g?.allStatuses?.some(s => s === 'Low' || s === 'Critically Low')) return false;
    }
    if (filterOutOnly && filterStatus === 'All') {
      if (!g?.allStatuses?.includes('Out of Stock')) return false;
    }
    return true;
  });

  // ── Single-office view ────────────────────────────────────────────────────
  const displayedItems = !isAllOffices ? items?.filter(item => {
    if (filterSearch?.trim()) {
      const term = filterSearch?.toLowerCase();
      const name = item?.item_name?.toLowerCase() || '';
      if (!name?.includes(term)) return false;
    }
    if (filterLowOnly && filterStatus === 'All') {
      if (item?.status !== 'Low' && item?.status !== 'Critically Low') return false;
    }
    if (filterOutOnly && filterStatus === 'All') {
      if (item?.status !== 'Out of Stock') return false;
    }
    return true;
  }) : null;

  // ── Summary cards ─────────────────────────────────────────────────────────
  // Always computed from the full raw items array (before grouping/filtering)
  const totalRecords = items?.length;                                                   // Office Inventory Records
  const uniqueItemCount = isAllOffices
    ? new Set(items?.map(i => `${i?.item_name || ''}|||${i?.category || ''}`))?.size
    : items?.length;                                                                    // In single-office mode, each row is unique per that office
  const inStock = items?.filter(i => i?.status === 'In Stock')?.length;
  const lowCritical = items?.filter(i => i?.status === 'Low' || i?.status === 'Critically Low')?.length;
  const outOfStock = items?.filter(i => i?.status === 'Out of Stock')?.length;
  const orderedPending = items?.filter(i =>
    i?.order_status === 'Ordered' || i?.order_status === 'Submitted' || i?.order_status === 'Approved'
  )?.length;
  const uniqueCategories = [...new Set(items?.map(i => i?.category)?.filter(Boolean))]?.length;

  const handleClearFilters = () => {
    setFilterOffice('All Offices');
    setFilterCategory('All');
    setFilterStatus('All');
    setFilterOrderStatus('All');
    setFilterSearch('');
    setFilterLowOnly(false);
    setFilterOutOnly(false);
  };

  const hasActiveFilters = filterOffice !== 'All Offices' || filterCategory !== 'All' ||
    filterStatus !== 'All' || filterOrderStatus !== 'All' || filterSearch?.trim() ||
    filterLowOnly || filterOutOnly;

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    let csv = '';
    if (isAllOffices) {
      // Grouped export: one row per unique item with per-office columns
      const headers = [
        'Category', 'Item Name',
        'Eatontown Qty', 'Eatontown Status',
        'Brick Qty', 'Brick Status',
        'Barnegat Qty', 'Barnegat Status',
        'Staten Island Qty', 'Staten Island Status',
        'Worst Status', 'Priority', 'Min Qty', 'Notes',
      ];
      const rows = (filteredGrouped || [])?.map(g => {
        const et = g?.offices?.['Nu Dental of Eatontown'] || {};
        const br = g?.offices?.['Nu Dental of Brick'] || {};
        const ba = g?.offices?.['Nu Dental of Barnegat'] || {};
        const si = g?.offices?.['Nu Dental of Staten Island'] || {};
        return [
          `"${(g?.category || '')?.replace(/"/g, '""')}"`,
          `"${(g?.item_name || '')?.replace(/"/g, '""')}"`,
          et?.current_qty != null ? et?.current_qty : '—',
          et?.status || '—',
          br?.current_qty != null ? br?.current_qty : '—',
          br?.status || '—',
          ba?.current_qty != null ? ba?.current_qty : '—',
          ba?.status || '—',
          si?.current_qty != null ? si?.current_qty : '—',
          si?.status || '—',
          worstStatus(g?.allStatuses),
          g?.priority || '—',
          g?.min_required != null ? g?.min_required : '—',
          `"${(g?.notes || '')?.replace(/"/g, '""')}"`,
        ];
      });
      csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    } else {
      // Single-office export
      const headers = [
        'Office', 'Category', 'Item Name', 'Current Qty', 'Status', 'Order Status',
        'Priority', 'Min Qty', 'Last Supplied', 'Notes',
      ];
      const rows = (displayedItems || [])?.map(i => [
        i?.office_location || '',
        i?.category || '',
        `"${(i?.item_name || '')?.replace(/"/g, '""')}"`,
        i?.current_qty ?? '',
        i?.status || '',
        i?.order_status || '',
        i?.priority || '',
        i?.min_required ?? '',
        i?.last_supplied_date || '',
        `"${(i?.notes || '')?.replace(/"/g, '""')}"`,
      ]);
      csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = isAllOffices ? 'all-offices-grouped' : filterOffice?.replace('Nu Dental of ', '')?.toLowerCase()?.replace(/\s+/g, '-');
    a.download = `front-desk-current-inventory-${suffix}-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  const exportRowCount = isAllOffices ? (filteredGrouped?.length || 0) : (displayedItems?.length || 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Current Inventory</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live Front Desk catalog/inventory state from <code className="text-xs bg-muted px-1 rounded">front_desk_inventory</code>
            {isAllOffices && <span className="ml-1 text-blue-600 font-medium">· Grouped by unique item (All Offices)</span>}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exportRowCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="Download" size={14} />Export CSV ({exportRowCount} rows)
        </button>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Unique Items — primary count */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Unique Items</p>
          <p className="text-2xl font-bold text-blue-700">{loading ? '—' : uniqueItemCount}</p>
          <p className="text-xs text-blue-500 mt-0.5">{isAllOffices ? 'distinct catalog items' : 'this office'}</p>
        </div>
        {/* Office Inventory Records — raw row count, only meaningful in all-offices mode */}
        {isAllOffices && (
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Office Inventory Records</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : totalRecords}</p>
            <p className="text-xs text-muted-foreground mt-0.5">rows in table</p>
          </div>
        )}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">In Stock</p>
          <p className="text-2xl font-bold text-emerald-700">{loading ? '—' : inStock}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-yellow-700 mb-1">Low / Critically Low</p>
          <p className="text-2xl font-bold text-yellow-700">{loading ? '—' : lowCritical}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700">{loading ? '—' : outOfStock}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-indigo-700 mb-1">Ordered / Pending</p>
          <p className="text-2xl font-bold text-indigo-700">{loading ? '—' : orderedPending}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-700 mb-1">Categories</p>
          <p className="text-2xl font-bold text-purple-700">{loading ? '—' : uniqueCategories}</p>
        </div>
      </div>
      {/* All-offices grouping info banner */}
      {isAllOffices && !loading && (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
          <Icon name="Info" size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <span>
            <strong>All Offices view</strong> groups items by unique catalog item. Each row represents one distinct item across all offices.
            Expand a row to see per-office quantities and statuses. <strong>Office Inventory Records = {totalRecords}</strong> (one row per item per office in the database).
            Select a specific office to see that office's rows individually.
          </span>
        </div>
      )}
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
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Category</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
            >
              {CATEGORIES?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e?.target?.value); setFilterLowOnly(false); setFilterOutOnly(false); }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
            >
              {STATUS_OPTIONS?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Order Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Order Status</label>
            <select
              value={filterOrderStatus}
              onChange={e => setFilterOrderStatus(e?.target?.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
              {ORDER_STATUS_OPTIONS?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-muted-foreground">Search Item</label>
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search item name..."
                value={filterSearch}
                onChange={e => setFilterSearch(e?.target?.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
              />
            </div>
          </div>
        </div>
        {/* Quick toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterLowOnly}
              onChange={e => { setFilterLowOnly(e?.target?.checked); if (e?.target?.checked) { setFilterOutOnly(false); setFilterStatus('All'); } }}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-xs font-semibold text-yellow-700">Low stock only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOutOnly}
              onChange={e => { setFilterOutOnly(e?.target?.checked); if (e?.target?.checked) { setFilterLowOnly(false); setFilterStatus('All'); } }}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-xs font-semibold text-red-700">Out of stock only</span>
          </label>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1 text-xs font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors"
            >
              Clear Filters
            </button>
          )}
          {!loading && (
            <span className="text-xs text-muted-foreground ml-auto">
              {isAllOffices
                ? <>Showing <span className="font-semibold text-foreground">{filteredGrouped?.length}</span> unique items (from {totalRecords} office records)</>
                : <>Showing <span className="font-semibold text-foreground">{displayedItems?.length}</span> of <span className="font-semibold text-foreground">{items?.length}</span> items</>
              }
            </span>
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
      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isAllOffices ? (
          /* ── GROUPED ALL-OFFICES TABLE ── */
          (filteredGrouped?.length === 0 ? (<div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="Package" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No items match the current filters.</p>
            {hasActiveFilters && (
              <button onClick={handleClearFilters} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>) : (<div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Item Name</th>
                  {OFFICE_KEYS?.map(ok => (
                    <th key={ok} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {OFFICE_SHORT?.[ok]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Worst Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Priority</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Min Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGrouped?.map(g => {
                  const ws = worstStatus(g?.allStatuses);
                  const isExpanded = expandedRows?.has(g?._key);
                  const officeCount = Object.keys(g?.offices || {})?.length;
                  return (
                    <React.Fragment key={g?._key}>
                      <tr
                        className={`hover:bg-muted/10 transition-colors cursor-pointer ${
                          ws === 'Out of Stock' ? 'bg-red-50/40' :
                          ws === 'Critically Low' ? 'bg-orange-50/40' :
                          ws === 'Low' ? 'bg-yellow-50/30' : ''
                        }`}
                        onClick={() => toggleExpand(g?._key)}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <Icon
                            name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                            size={14}
                            className="text-muted-foreground"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{g?.category || '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px]">
                          <span className="block truncate" title={g?.item_name || ''}>{g?.item_name || '—'}</span>
                          <span className="text-xs text-muted-foreground font-normal">{officeCount} office{officeCount !== 1 ? 's' : ''}</span>
                        </td>
                        {OFFICE_KEYS?.map(ok => {
                          const od = g?.offices?.[ok];
                          return (
                            <td key={ok} className="px-3 py-2.5 text-center">
                              {od ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`text-sm font-bold ${
                                    od?.current_qty === 0 ? 'text-red-600' :
                                    od?.current_qty != null && g?.min_required != null && od?.current_qty <= g?.min_required ? 'text-yellow-600' : 'text-foreground'
                                  }`}>
                                    {od?.current_qty != null ? od?.current_qty : '—'}
                                  </span>
                                  <StatusBadge status={od?.status} />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5"><StatusBadge status={ws} /></td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{g?.priority || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{g?.min_required != null ? g?.min_required : '—'}</td>
                      </tr>
                      {/* Expanded per-office breakdown */}
                      {isExpanded && (
                        <tr className="bg-muted/5">
                          <td colSpan={8 + OFFICE_KEYS?.length} className="px-6 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {OFFICE_KEYS?.map(ok => {
                                const od = g?.offices?.[ok];
                                return (
                                  <div key={ok} className={`rounded-lg border p-3 text-xs ${od ? 'bg-card border-border' : 'bg-muted/20 border-dashed border-border'}`}>
                                    <p className="font-semibold text-foreground mb-1">{OFFICE_SHORT?.[ok]}</p>
                                    {od ? (
                                      <>
                                        <p className="text-muted-foreground">Qty: <span className={`font-bold ${od?.current_qty === 0 ? 'text-red-600' : 'text-foreground'}`}>{od?.current_qty != null ? od?.current_qty : '—'}</span></p>
                                        <div className="mt-1"><StatusBadge status={od?.status} /></div>
                                        <div className="mt-1"><OrderStatusBadge status={od?.order_status} /></div>
                                        {od?.last_supplied_date && (
                                          <p className="text-muted-foreground mt-1">Last supplied: {new Date(od?.last_supplied_date + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-muted-foreground italic">Not in catalog</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {g?.notes && (
                              <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Notes:</span> {g?.notes}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>))
        ) : (
          /* ── SINGLE-OFFICE TABLE ── */
          (displayedItems?.length === 0 ? (<div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Icon name="Package" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No items match the current filters.</p>
            {hasActiveFilters && (
              <button onClick={handleClearFilters} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>) : (<div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {['Office', 'Category', 'Item Name', 'Current Qty', 'Status', 'Order Status', 'Priority', 'Min Qty', 'Last Supplied', 'Notes']?.map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedItems?.map(item => (
                  <tr
                    key={item?.id}
                    className={`hover:bg-muted/10 transition-colors ${
                      item?.status === 'Out of Stock' ? 'bg-red-50/40' :
                      item?.status === 'Critically Low' ? 'bg-orange-50/40' :
                      item?.status === 'Low' ? 'bg-yellow-50/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {item?.office_location
                        ? item?.office_location?.replace('Nu Dental of ', '')
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{item?.category || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px]">
                      <span className="block truncate" title={item?.item_name || ''}>{item?.item_name || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-bold text-base ${
                        item?.current_qty === 0 ? 'text-red-600' :
                        item?.current_qty != null && item?.min_required != null && item?.current_qty <= item?.min_required ? 'text-yellow-600' : 'text-foreground'
                      }`}>
                        {item?.current_qty != null ? item?.current_qty : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={item?.status} /></td>
                    <td className="px-3 py-2.5"><OrderStatusBadge status={item?.order_status} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{item?.priority || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{item?.min_required != null ? item?.min_required : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {item?.last_supplied_date
                        ? new Date(item?.last_supplied_date + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px]">
                      <span className="block truncate" title={item?.notes || ''}>
                        {item?.notes || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>))
        )}
        {!loading && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/10 text-xs text-muted-foreground">
            {isAllOffices
              ? <>{filteredGrouped?.length} unique item{filteredGrouped?.length !== 1 ? 's' : ''} shown{hasActiveFilters ? ' (filtered)' : ''} · {totalRecords} office inventory records total</>
              : <>{displayedItems?.length} item{displayedItems?.length !== 1 ? 's' : ''} shown{hasActiveFilters ? ' (filtered)' : ''}</>
            } — data source: <code className="bg-muted px-1 rounded">front_desk_inventory</code>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrontDeskCurrentInventory;
