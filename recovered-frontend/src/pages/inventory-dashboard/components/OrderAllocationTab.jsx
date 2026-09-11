import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────
const BONE_TISSUE_CATEGORIES = ['Bone', 'Tissue', 'Membrane', 'PRF', 'Kit'];
const IMPLANT_CATEGORIES = ['Implant'];

const TRACEABILITY_LABELS = {
  order_reference_only: 'Order Reference Only / Needs Scan Receive',
  sample_photo_only: 'Sample Photo Reference',
  exp_needs_confirmation: 'EXP Needs Confirmation',
  missing_lot: 'Missing LOT',
  missing_exp: 'Missing EXP',
  ready_to_scan_receive: 'Ready to Scan Receive',
  needs_scan_receive: 'Needs Scan Receive',
  needs_package_scan: 'Needs Package Scan',
};

const TRACEABILITY_COLORS = {
  order_reference_only: 'bg-amber-100 text-amber-700 border border-amber-200',
  sample_photo_only: 'bg-blue-100 text-blue-700 border border-blue-200',
  exp_needs_confirmation: 'bg-orange-100 text-orange-700 border border-orange-200',
  missing_lot: 'bg-red-100 text-red-700 border border-red-200',
  missing_exp: 'bg-red-100 text-red-700 border border-red-200',
  ready_to_scan_receive: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  needs_scan_receive: 'bg-amber-100 text-amber-700 border border-amber-200',
  needs_package_scan: 'bg-purple-100 text-purple-700 border border-purple-200',
};

const CATEGORY_COLORS = {
  Implant: 'bg-blue-100 text-blue-700',
  Bone: 'bg-amber-100 text-amber-700',
  Tissue: 'bg-teal-100 text-teal-700',
  Membrane: 'bg-purple-100 text-purple-700',
  PRF: 'bg-rose-100 text-rose-700',
  Kit: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-muted text-muted-foreground',
};

const PAGE_SIZES = [10, 25, 50];

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtCurrency = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })?.format(n);
};

const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n;
};

// ── Service ──────────────────────────────────────────────────────────────────
const fetchAllocations = async (categories) => {
  const { data, error } = await supabase?.from('implant_grafting_order_allocations')?.select('*')?.in('product_category', categories)?.order('order_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = (rows) => {
  const headers = [
    'Order #', 'Order Date', 'Office', 'Product Category', 'Product Name',
    'System', 'Platform', 'Diameter (mm)', 'Length (mm)', 'Size',
    'REF / SKU', 'Allocated Qty', 'Unit Cost', 'Allocated Cost',
    'LOT', 'EXP', 'Traceability Status', 'Notes',
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s?.includes(',') || s?.includes('"') || s?.includes('\n')) return `"${s?.replace(/"/g, '""')}"`;
    return s;
  };
  const csvRows = [
    headers?.join(','),
    ...rows?.map(r => [
      escape(r?.order_number),
      escape(r?.order_date),
      escape(r?.allocated_office),
      escape(r?.product_category),
      escape(r?.product_name),
      escape(r?.system),
      escape(r?.platform),
      escape(r?.diameter_mm),
      escape(r?.length_mm),
      escape(r?.size_desc),
      escape(r?.ref_sku),
      escape(r?.allocated_qty),
      escape(r?.unit_cost),
      escape(r?.allocated_cost),
      escape(r?.lot_number),
      escape(r?.expiration_date),
      escape(TRACEABILITY_LABELS?.[r?.traceability_status] || r?.traceability_status),
      escape(r?.notes),
    ]?.join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `order_allocation_${new Date()?.toISOString()?.slice(0, 10)}.csv`;
  a?.click();
  URL.revokeObjectURL(url);
};

// ── Summary Cards ─────────────────────────────────────────────────────────────
const AllocationSummaryCards = ({ rows, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[...Array(5)]?.map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-muted rounded w-3/4 mb-2" />
            <div className="h-6 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const totalUnits = rows?.reduce((s, r) => s + (Number(r?.allocated_qty) || 0), 0);
  const missingLotExp = rows?.filter(r => !r?.lot_number || !r?.expiration_date)?.length;
  const readyOrPhoto = rows?.filter(r =>
    r?.traceability_status === 'ready_to_scan_receive' ||
    r?.traceability_status === 'sample_photo_only'
  )?.length;
  const estimatedCost = rows?.reduce((s, r) => s + (parseFloat(r?.allocated_cost) || 0), 0);

  // By office
  const byOffice = {};
  rows?.forEach(r => {
    const office = r?.allocated_office || 'Unknown';
    byOffice[office] = (byOffice?.[office] || 0) + (Number(r?.allocated_qty) || 0);
  });

  const cards = [
    {
      label: 'Total Allocated Units',
      value: totalUnits,
      icon: 'Package',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Missing LOT / EXP',
      value: missingLotExp,
      icon: 'AlertTriangle',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Ready / Sample Photo',
      value: readyOrPhoto,
      icon: 'CheckCircle',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Est. Allocated Cost',
      value: estimatedCost > 0 ? fmtCurrency(estimatedCost) : '—',
      icon: 'DollarSign',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Allocation Rows',
      value: rows?.length,
      icon: 'ClipboardList',
      color: 'text-slate-600',
      bg: 'bg-slate-50',
    },
  ];

  return (
    <div className="space-y-3 mb-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards?.map(c => (
          <div key={c?.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${c?.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={c?.icon} size={14} className={c?.color} />
              </div>
              <span className="text-xs text-muted-foreground leading-tight">{c?.label}</span>
            </div>
            <p className={`text-lg font-bold ${c?.color}`}>{c?.value}</p>
          </div>
        ))}
      </div>
      {/* By Office breakdown */}
      {Object.keys(byOffice)?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="MapPin" size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Expected Supplies by Office</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byOffice)?.sort((a, b) => b?.[1] - a?.[1])?.map(([office, qty]) => (
                <div key={office} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border border-border rounded-lg">
                  <span className="text-xs font-medium text-foreground">{office}</span>
                  <span className="text-xs font-bold text-primary ml-1">{qty} units</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Filters ───────────────────────────────────────────────────────────────────
const AllocationFilters = ({ filters, setFilters, rows, categoryMode }) => {
  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const offices = [...new Set(rows.map(r => r?.allocated_office).filter(Boolean))]?.sort();
  const orderNumbers = [...new Set(rows.map(r => r?.order_number).filter(Boolean))]?.sort();
  const categories = categoryMode === 'implant' ? IMPLANT_CATEGORIES : BONE_TISSUE_CATEGORIES;
  const traceabilityStatuses = [...new Set(rows.map(r => r?.traceability_status).filter(Boolean))]?.sort();

  const hasFilters = filters?.search || filters?.office || filters?.category ||
    filters?.orderNumber || filters?.traceabilityStatus ||
    filters?.dateFrom || filters?.dateTo;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search product / SKU / LOT / REF…"
            value={filters?.search || ''}
            onChange={e => update('search', e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Office */}
        <select
          value={filters?.office || ''}
          onChange={e => update('office', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Offices</option>
          {offices?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Product Category */}
        <select
          value={filters?.category || ''}
          onChange={e => update('category', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Categories</option>
          {categories?.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Order # */}
        <select
          value={filters?.orderNumber || ''}
          onChange={e => update('orderNumber', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Order #s</option>
          {orderNumbers?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Traceability Status */}
        <select
          value={filters?.traceabilityStatus || ''}
          onChange={e => update('traceabilityStatus', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Traceability Statuses</option>
          {traceabilityStatuses?.map(s => (
            <option key={s} value={s}>{TRACEABILITY_LABELS?.[s] || s}</option>
          ))}
        </select>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground pl-1">Order Date From</label>
          <input
            type="date"
            value={filters?.dateFrom || ''}
            onChange={e => update('dateFrom', e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground pl-1">Order Date To</label>
          <input
            type="date"
            value={filters?.dateTo || ''}
            onChange={e => update('dateTo', e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button
              onClick={() => setFilters({})}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="X" size={12} />
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Table ─────────────────────────────────────────────────────────────────────
const AllocationTable = ({ rows, loading, categoryMode, onExportCSV }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil((rows?.length || 0) / pageSize);
  const paginated = (rows || [])?.slice((page - 1) * pageSize, page * pageSize);

  const isImplant = categoryMode === 'implant';

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading allocation data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Table toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {rows?.length} allocation row{rows?.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onExportCSV}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-semibold"
        >
          <Icon name="Download" size={13} />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Order #</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Order Date</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Office</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Category</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Product Name</th>
              {isImplant && (
                <>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">System</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Platform</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Ø (mm)</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">L (mm)</th>
                </>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Size</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">REF / SKU</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Allocated Qty</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Unit Cost</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Allocated Cost</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">LOT</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">EXP</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Traceability Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated?.length === 0 ? (
              <tr>
                <td colSpan={isImplant ? 18 : 14} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Icon name="ClipboardList" size={32} className="opacity-30" />
                    <span className="text-sm font-medium">No allocation rows found</span>
                    <span className="text-xs text-muted-foreground">Try adjusting your filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated?.map(r => (
                <tr key={r?.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs font-mono font-medium whitespace-nowrap">{r?.order_number || '—'}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtDate(r?.order_date)}</td>
                  <td className="px-3 py-2.5 text-xs max-w-[110px] truncate" title={r?.allocated_office}>
                    {r?.allocated_office || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS?.[r?.product_category] || 'bg-muted text-muted-foreground'}`}>
                      {r?.product_category || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[160px] truncate font-medium" title={r?.product_name}>
                    {r?.product_name || '—'}
                  </td>
                  {isImplant && (
                    <>
                      <td className="px-3 py-2.5 text-xs max-w-[100px] truncate">{r?.system || '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[100px] truncate">{r?.platform || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-center">{fmtNum(r?.diameter_mm)}</td>
                      <td className="px-3 py-2.5 text-xs text-center">{fmtNum(r?.length_mm)}</td>
                    </>
                  )}
                  <td className="px-3 py-2.5 text-xs">{r?.size_desc || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-mono">{r?.ref_sku || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-center font-bold text-foreground">
                    {fmtNum(r?.allocated_qty)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right">{fmtCurrency(r?.unit_cost)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-medium">{fmtCurrency(r?.allocated_cost)}</td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    {r?.lot_number ? (
                      <span>{r?.lot_number}</span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <Icon name="AlertCircle" size={11} />N/A
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {r?.expiration_date ? (
                      <span>{fmtDate(r?.expiration_date)}</span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <Icon name="AlertCircle" size={11} />N/A
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${TRACEABILITY_COLORS?.[r?.traceability_status] || 'bg-muted text-muted-foreground'}`}>
                      {TRACEABILITY_LABELS?.[r?.traceability_status] || r?.traceability_status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[160px] truncate text-muted-foreground" title={r?.notes}>
                    {r?.notes || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {!loading && rows?.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page:</span>
            {PAGE_SIZES?.map(s => (
              <button
                key={s}
                onClick={() => { setPageSize(s); setPage(1); }}
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
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows?.length)} of {rows?.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="ChevronLeft" size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
/**
 * OrderAllocationTab
 *
 * Displays order allocation / receiving checklist data from
 * `implant_grafting_order_allocations`. View-only — no data writes.
 *
 * Props:
 *   categoryMode: 'bone_tissue' | 'implant' *     -'bone_tissue'→ shows Bone, Tissue, Membrane, PRF, Kit rows *     -'implant'     → shows Implant rows only
 */
const OrderAllocationTab = ({ categoryMode = 'bone_tissue' }) => {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({});

  const categories = categoryMode === 'implant' ? IMPLANT_CATEGORIES : BONE_TISSUE_CATEGORIES;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllocations(categories);
      setAllRows(data);
    } catch (err) {
      setError(err?.message || 'Failed to load allocation data');
    } finally {
      setLoading(false);
    }
  }, [categoryMode]);

  useEffect(() => { load(); }, [load]);

  // Apply filters client-side
  const filteredRows = allRows?.filter(r => {
    if (filters?.office && r?.allocated_office !== filters?.office) return false;
    if (filters?.category && r?.product_category !== filters?.category) return false;
    if (filters?.orderNumber && r?.order_number !== filters?.orderNumber) return false;
    if (filters?.traceabilityStatus && r?.traceability_status !== filters?.traceabilityStatus) return false;
    if (filters?.dateFrom && (r?.order_date || '') < filters?.dateFrom) return false;
    if (filters?.dateTo && (r?.order_date || '') > filters?.dateTo) return false;
    if (filters?.search) {
      const s = filters?.search?.toLowerCase();
      return (
        r?.product_name?.toLowerCase()?.includes(s) ||
        r?.ref_sku?.toLowerCase()?.includes(s) ||
        r?.lot_number?.toLowerCase()?.includes(s) ||
        r?.order_number?.toLowerCase()?.includes(s) ||
        r?.product_category?.toLowerCase()?.includes(s) ||
        r?.system?.toLowerCase()?.includes(s) ||
        r?.platform?.toLowerCase()?.includes(s)
      );
    }
    return true;
  });

  const handleExportCSV = () => exportCSV(filteredRows);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Icon name="ClipboardCheck" size={18} className="text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Order Allocation — Receiving Checklist
          </h3>
          <p className="text-xs text-muted-foreground">
            {categoryMode === 'implant' ?'Expected implant supplies by order. View-only — not active inventory.' :'Expected bone, tissue, membrane, PRF, and kit supplies by order. View-only — not active inventory.'}
          </p>
        </div>
      </div>

      {/* ⚠️ Warning Banner — must be prominent */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
        <Icon name="AlertTriangle" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-900">
            Order Allocation / Receiving Checklist — NOT Active Inventory
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">
            This tab shows <strong>order allocation data only</strong>. It is not active inventory, not on-hand stock, not consumed inventory, and not patient usage.
          </p>
          <ul className="text-xs text-amber-800 space-y-0.5 mt-1">
            <li>• Items become <strong>active inventory</strong> only after <strong>Scan Receive</strong>.</li>
            <li>• Items become <strong>used / consumed</strong> only after <strong>Scan Consume</strong>.</li>
            <li>• This data is for receiving reference and traceability planning only.</li>
          </ul>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />{error}
          <button onClick={load} className="ml-auto text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <AllocationSummaryCards rows={filteredRows} loading={loading} />

      {/* Filters */}
      <AllocationFilters
        filters={filters}
        setFilters={setFilters}
        rows={allRows}
        categoryMode={categoryMode}
      />

      {/* Table */}
      <AllocationTable
        rows={filteredRows}
        loading={loading}
        categoryMode={categoryMode}
        onExportCSV={handleExportCSV}
      />

      {/* Footer note */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
        <Icon name="Info" size={13} className="flex-shrink-0" />
        <span>
          Data source: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">implant_grafting_order_allocations</code>.
          To move items to active inventory, use <strong>Scan Receive</strong>.
          To record patient usage, use <strong>Scan Consume</strong>.
          This tab is view-only — no data is written from here.
        </span>
      </div>
    </div>
  );
};

export default OrderAllocationTab;
