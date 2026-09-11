import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../../../components/AppIcon';
import {
  fetchAmexPayments,
  fetchAmexPaymentKPIs,
  formatCurrency,
  formatDate,
  buildStatementPeriodLabel,
  getStatusMeta,
  formatPaymentsForCSV,
  PAYMENT_STATUSES,
  MONTHS,
} from '../../../../services/amexPaymentsService';
import AddPaymentModal from './AddPaymentModal';
import useRolePermissions from '../../../../hooks/useRolePermissions';
import { useAuth } from '../../../../contexts/AuthContext';

const CURRENT_YEAR = new Date()?.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const DEFAULT_FILTERS = {
  month: '',
  quarter: '',
  year: String(CURRENT_YEAR),
  statementPeriodStart: '',
  statementPeriodEnd: '',
  paymentStatus: 'All',
  cardLast4: '',
};

// View options
const VIEW_OPTIONS = [
  { key: 'deduped',   label: 'Deduplicated Payments',    icon: 'CheckCircle' },
  { key: 'dup_review', label: 'Duplicate Review',         icon: 'Copy' },
  { key: 'all_raw',   label: 'All Raw Payment Records',  icon: 'Database' },
];

// ── Duplicate Detection ───────────────────────────────────────────────────────
/**
 * A duplicate candidate is any row sharing the same:
 * payment_date + amount_paid + card_program + card_last4 + payment_reference
 *
 * Returns the same rows array with an added `_dupStatus` field:
 *   'unique'             — no duplicates *'possible_duplicate' — matches another row on all key fields
 * and `_dupGroupKey` for grouping.
 */
function detectDuplicates(rows) {
  const keyMap = {};
  rows?.forEach(row => {
    const key = [
      row?.payment_date || '',
      String(parseFloat(row?.amount_paid) || 0),
      (row?.card_program || '')?.toLowerCase()?.trim(),
      (row?.card_last4 || '')?.trim(),
      (row?.payment_reference || '')?.trim(),
    ]?.join('|');
    if (!keyMap?.[key]) keyMap[key] = [];
    keyMap?.[key]?.push(row?.id);
  });

  return rows?.map(row => {
    const key = [
      row?.payment_date || '',
      String(parseFloat(row?.amount_paid) || 0),
      (row?.card_program || '')?.toLowerCase()?.trim(),
      (row?.card_last4 || '')?.trim(),
      (row?.payment_reference || '')?.trim(),
    ]?.join('|');
    const group = keyMap?.[key] || [];
    const isDup = group?.length > 1;
    return {
      ...row,
      _dupStatus: isDup ? 'possible_duplicate' : 'unique',
      _dupGroupKey: key,
      _dupCount: group?.length,
      _dupGroupIds: group,
    };
  });
}

/**
 * Deduplicate rows for summary card calculations.
 * Keeps only the first occurrence of each duplicate group.
 */
function deduplicateForSummary(rows) {
  const seen = new Set();
  return rows?.filter(row => {
    if (row?._dupStatus === 'unique') return true;
    if (!seen?.has(row?._dupGroupKey)) {
      seen?.add(row?._dupGroupKey);
      return true;
    }
    return false;
  });
}

/**
 * Build the rows to display based on selected view.
 * 'deduped'    — one primary row per duplicate group (first occurrence)
 * 'dup_review'— only groups that have 2+ rows; show all rows in those groups *'all_raw'    — every row as stored
 */
function buildViewRows(sortedRows, view) {
  if (view === 'all_raw') return sortedRows;

  if (view === 'dup_review') {
    return sortedRows?.filter(r => r?._dupStatus === 'possible_duplicate');
  }

  // deduped (default): one primary row per group
  const seen = new Set();
  return sortedRows?.filter(row => {
    if (row?._dupStatus === 'unique') return true;
    if (!seen?.has(row?._dupGroupKey)) {
      seen?.add(row?._dupGroupKey);
      return true; // primary row
    }
    return false; // secondary duplicate — hidden
  });
}

const AmexPaymentsTab = () => {
  const { userProfile } = useAuth();
  const { hasPermission } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [payments, setPayments] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortField, setSortField] = useState('payment_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [activeView, setActiveView] = useState('deduped');
  const PAGE_SIZE = 25;

  const setFilter = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, kpiData] = await Promise.allSettled([
        fetchAmexPayments({
          month:                 appliedFilters?.month ? parseInt(appliedFilters?.month) : null,
          quarter:               appliedFilters?.quarter ? parseInt(appliedFilters?.quarter) : null,
          year:                  appliedFilters?.year ? parseInt(appliedFilters?.year) : null,
          statementPeriodStart:  appliedFilters?.statementPeriodStart || null,
          statementPeriodEnd:    appliedFilters?.statementPeriodEnd || null,
          paymentStatus:         appliedFilters?.paymentStatus !== 'All' ? appliedFilters?.paymentStatus : null,
          cardLast4:             appliedFilters?.cardLast4 || null,
          limit: 500,
        }),
        fetchAmexPaymentKPIs({ year: appliedFilters?.year ? parseInt(appliedFilters?.year) : null }),
      ]);
      setPayments(rows?.status === 'fulfilled' ? rows?.value : []);
      setKpis(kpiData?.status === 'fulfilled' ? kpiData?.value : {});
    } catch (err) {
      console.warn('[AmexPaymentsTab] load error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApply = () => {
    setAppliedFilters({ ...filters });
    setPage(0);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    setPage(0);
  };

  // Apply duplicate detection to all rows
  const paymentsWithDupFlags = useMemo(() => detectDuplicates(payments), [payments]);

  const hasDuplicates = useMemo(
    () => paymentsWithDupFlags?.some(r => r?._dupStatus === 'possible_duplicate'),
    [paymentsWithDupFlags]
  );

  const sortedPayments = useMemo(() => [...paymentsWithDupFlags]?.sort((a, b) => {
    let av = a?.[sortField] ?? '';
    let bv = b?.[sortField] ?? '';
    if (sortField === 'amount_paid') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }), [paymentsWithDupFlags, sortField, sortDir]);

  // Deduplicated rows for summary cards (always deduped regardless of view)
  const dedupedForSummary = useMemo(() => deduplicateForSummary(sortedPayments), [sortedPayments]);

  // Rows to display based on active view
  const viewRows = useMemo(() => buildViewRows(sortedPayments, activeView), [sortedPayments, activeView]);

  // Compute deduplicated summary values
  const summaryStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now?.getMonth() + 1;
    const currentYear = appliedFilters?.year ? parseInt(appliedFilters?.year) : now?.getFullYear();

    const nonVoid = dedupedForSummary?.filter(r => r?.payment_status !== 'void');
    const monthRows = nonVoid?.filter(r => r?.statement_month === currentMonth && r?.statement_year === currentYear);

    const totalPaidThisMonth = monthRows?.reduce((s, r) => s + (parseFloat(r?.amount_paid) || 0), 0);
    const totalPaidThisYear  = nonVoid?.reduce((s, r) => s + (parseFloat(r?.amount_paid) || 0), 0);
    const numberOfPayments   = nonVoid?.length;
    const sortedDates = nonVoid?.map(r => r?.payment_date)?.filter(Boolean)?.sort((a, b) => new Date(b) - new Date(a));
    const latestPaymentDate  = sortedDates?.[0] || null;

    return { totalPaidThisMonth, totalPaidThisYear, numberOfPayments, latestPaymentDate };
  }, [dedupedForSummary, appliedFilters?.year]);

  const paged = viewRows?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(viewRows?.length / PAGE_SIZE);

  const handleExportCSV = () => {
    const exportRows = activeView === 'deduped'
      ? dedupedForSummary
      : activeView === 'dup_review'
        ? sortedPayments?.filter(r => r?._dupStatus === 'possible_duplicate')
        : sortedPayments;
    const csv = formatPaymentsForCSV(exportRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const viewLabel = activeView === 'deduped' ? 'deduplicated' : activeView === 'dup_review' ? 'duplicate-review' : 'all-raw';
    a.download = `amex-payments-${viewLabel}-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }) => (
    <Icon
      name={sortField === field ? (sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'}
      size={11}
      className={sortField === field ? 'text-primary' : 'text-muted-foreground/50'}
    />
  );

  // Table columns — Duplicate Review gets extra columns
  const TABLE_COLS_BASE = [
    { key: 'statement_period_start', label: 'Statement Period',      sortable: true },
    { key: 'payment_date',           label: 'Payment Date',          sortable: true },
    { key: 'amount_paid',            label: 'Amount Paid',           sortable: true },
    { key: 'payment_status',         label: 'Status',                sortable: true },
    { key: 'card_program',           label: 'Card / Account',        sortable: false },
    { key: 'card_last4',             label: 'Last 4',                sortable: false },
    { key: 'source_bank_account',    label: 'Source Bank Account',   sortable: false },
    { key: 'classification',         label: 'Classification',        sortable: false },
    { key: 'included_in_expense',    label: 'Included in Expense',   sortable: false },
    { key: 'expense_treatment',      label: 'Expense Treatment',     sortable: false },
    { key: 'dup_status',             label: 'Duplicate Status',      sortable: false },
    { key: 'payment_reference',      label: 'Reference #',           sortable: false },
    { key: 'notes',                  label: 'Notes',                 sortable: false },
    { key: 'createdByName',          label: 'Created By',            sortable: false },
    { key: 'created_at',             label: 'Created At',            sortable: true },
  ];

  const TABLE_COLS_DUP_REVIEW = [
    { key: 'payment_date',           label: 'Payment Date',          sortable: true },
    { key: 'amount_paid',            label: 'Amount Paid',           sortable: true },
    { key: 'card_program',           label: 'Card / Account',        sortable: false },
    { key: 'card_last4',             label: 'Last 4',                sortable: false },
    { key: 'payment_reference',      label: 'Reference #',           sortable: false },
    { key: 'dup_count',              label: 'Duplicate Count',       sortable: false },
    { key: 'created_at',             label: 'Created At',            sortable: true },
    { key: 'createdByName',          label: 'Created By',            sortable: false },
    { key: 'payment_status',         label: 'Status',                sortable: true },
  ];

  const TABLE_COLS = activeView === 'dup_review' ? TABLE_COLS_DUP_REVIEW : TABLE_COLS_BASE;

  // Duplicate group counts for Duplicate Review view
  const dupGroupCounts = useMemo(() => {
    const counts = {};
    sortedPayments?.filter(r => r?._dupStatus === 'possible_duplicate')?.forEach(r => {
      counts[r?._dupGroupKey] = r?._dupCount;
    });
    return counts;
  }, [sortedPayments]);

  // View label for display
  const viewLabel = activeView === 'deduped' ?'Deduplicated Payments'
    : activeView === 'dup_review' ?'Duplicate Review' :'All Raw Payment Records';

  return (
    <div className="space-y-5">

      {/* ── Liability Banner ──────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="AlertTriangle" size={14} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">
            AmEx Payments — Wells Fargo ...3526 Liability / Card Payments
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            AmEx Payments are <span className="font-mono font-semibold">Wells Fargo ...3526</span> liability/card payments.
            They are <strong>excluded from expense totals</strong> because the underlying AmEx vendor transactions are already counted as expenses.
            These records are for reconciliation purposes only.
          </p>
          <p className="text-[10px] text-amber-600 mt-1">
            Included in Expense: <strong>No</strong> &nbsp;·&nbsp; Classification: <strong>Liability Payment to AmEx</strong> &nbsp;·&nbsp; Expense Treatment: <strong>Excluded — AmEx vendor transactions are counted separately</strong>
          </p>
        </div>
      </div>

      {/* ── Duplicate Warning Banner (conditional) ────────── */}
      {hasDuplicates && (
        <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon name="Copy" size={12} className="text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-800 mb-0.5">
              Potential duplicate AmEx payment records detected. Totals are deduplicated. Raw duplicate records are preserved for review.
            </p>
            <p className="text-xs text-orange-700">
              One or more payment rows share the same date, amount, card, and reference number.
              Summary cards use deduplicated totals. Use <strong>Duplicate Review</strong> to inspect grouped duplicates.
              No records have been deleted.
            </p>
            <p className="text-[10px] text-orange-600 mt-1 italic">
              Duplicate detection is display/reconciliation only. No payment records are deleted.
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards (always deduplicated) ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Paid This Month',
            value: hasDuplicates ? (
              <span className="text-orange-600 text-sm font-bold">{formatCurrency(summaryStats?.totalPaidThisMonth)}<span className="text-[10px] font-normal ml-1">(deduped)</span></span>
            ) : formatCurrency(summaryStats?.totalPaidThisMonth),
            icon: 'TrendingUp',
            color: 'text-success',
            bg: 'bg-success/10',
          },
          {
            label: 'Total Paid This Year',
            value: hasDuplicates ? (
              <span className="text-orange-600 text-sm font-bold">{formatCurrency(summaryStats?.totalPaidThisYear)}<span className="text-[10px] font-normal ml-1">(deduped)</span></span>
            ) : formatCurrency(summaryStats?.totalPaidThisYear),
            icon: 'DollarSign',
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Number of Payments',
            value: hasDuplicates ? (
              <span className="text-orange-600 text-sm font-bold">{summaryStats?.numberOfPayments?.toLocaleString()}<span className="text-[10px] font-normal ml-1">(unique groups)</span></span>
            ) : (summaryStats?.numberOfPayments || 0)?.toLocaleString(),
            icon: 'Hash',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Latest Payment Date',
            value: summaryStats?.latestPaymentDate ? formatDate(summaryStats?.latestPaymentDate) : '—',
            icon: 'Calendar',
            color: 'text-warning',
            bg: 'bg-warning/10',
          },
        ]?.map(card => (
          <div key={card?.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${card?.bg} flex items-center justify-center`}>
                <Icon name={card?.icon} size={13} className={card?.color} />
              </div>
              <p className="text-xs text-muted-foreground leading-tight">{card?.label}</p>
            </div>
            {typeof card?.value === 'string' || typeof card?.value === 'number'
              ? <p className="text-lg font-bold text-foreground">{card?.value}</p>
              : <div className="text-lg font-bold text-foreground">{card?.value}</div>
            }
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-elevation-1">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Icon name="Filter" size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Month */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Month</label>
            <select
              value={filters?.month}
              onChange={e => setFilter('month', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Months</option>
              {MONTHS?.map(m => <option key={m?.value} value={m?.value}>{m?.label}</option>)}
            </select>
          </div>

          {/* Quarter */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Quarter</label>
            <select
              value={filters?.quarter}
              onChange={e => setFilter('quarter', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Quarters</option>
              <option value="1">Q1 (Jan–Mar)</option>
              <option value="2">Q2 (Apr–Jun)</option>
              <option value="3">Q3 (Jul–Sep)</option>
              <option value="4">Q4 (Oct–Dec)</option>
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Year</label>
            <select
              value={filters?.year}
              onChange={e => setFilter('year', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Years</option>
              {YEARS?.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select
              value={filters?.paymentStatus}
              onChange={e => setFilter('paymentStatus', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              {PAYMENT_STATUSES?.map(s => <option key={s?.value} value={s?.value}>{s?.label}</option>)}
            </select>
          </div>

          {/* Card Last 4 */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Card Last 4</label>
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. 1234"
              value={filters?.cardLast4}
              onChange={e => setFilter('cardLast4', e?.target?.value?.replace(/\D/g, ''))}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleApply}
              className="flex-1 text-xs font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── View Selector ─────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-elevation-1">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Icon name="Layers" size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">View</span>
          <span className="text-xs text-muted-foreground ml-1">Select how payment records are displayed</span>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {VIEW_OPTIONS?.map(opt => {
            const isActive = activeView === opt?.key;
            const isDupReviewWithCount = opt?.key === 'dup_review' && hasDuplicates;
            const dupCount = isDupReviewWithCount
              ? sortedPayments?.filter(r => r?._dupStatus === 'possible_duplicate')?.length
              : 0;
            return (
              <button
                key={opt?.key}
                onClick={() => handleViewChange(opt?.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon name={opt?.icon} size={11} />
                {opt?.label}
                {isDupReviewWithCount && dupCount > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>
                    {dupCount}
                  </span>
                )}
                {opt?.key === 'deduped' && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                    Default
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View description */}
        <div className="px-4 pb-3">
          {activeView === 'deduped' && (
            <p className="text-[10px] text-muted-foreground">
              <strong>Deduplicated Payments:</strong> Shows one primary row per duplicate group. Duplicate groups display a badge with the record count. Summary totals use one payment from each duplicate group.
            </p>
          )}
          {activeView === 'dup_review' && (
            <p className="text-[10px] text-orange-700">
              <strong>Duplicate Review:</strong> Shows only rows that belong to a duplicate group (same payment date, amount, card, and reference number). Use this view to audit and reconcile duplicate records.
            </p>
          )}
          {activeView === 'all_raw' && (
            <p className="text-[10px] text-muted-foreground">
              <strong>All Raw Payment Records:</strong> Shows every row exactly as stored in the database. For audit purposes only. Totals in this view may include duplicates.
            </p>
          )}
        </div>
      </div>

      {/* ── Payments Table ────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-elevation-1">
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="Table" size={14} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">AmEx Payments</span>
            <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {viewRows?.length} record{viewRows?.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted/30 border border-border/50 px-2 py-0.5 rounded-full">
              {viewLabel}
            </span>
            {hasDuplicates && activeView !== 'dup_review' && (
              <span className="text-[10px] font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                Duplicates Flagged
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
            >
              <Icon name="Download" size={12} />
              Export CSV
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
              >
                <Icon name="Plus" size={12} />
                Add New Payment
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Empty */}
        {!loading && viewRows?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
              <Icon name="CreditCard" size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {activeView === 'dup_review' ? 'No duplicate groups found' : 'No payments found'}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeView === 'dup_review' ?'No payment rows share the same date, amount, card, and reference number.'
                : isAdmin
                  ? 'Register your first AmEx payment using the button above.' :'No AmEx payment records match the current filters.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && viewRows?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {TABLE_COLS?.map(col => (
                    <th
                      key={col?.key}
                      className={`px-4 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap ${col?.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                      onClick={col?.sortable ? () => handleSort(col?.key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col?.label}
                        {col?.sortable && <SortIcon field={col?.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged?.map((row, i) => {
                  const statusMeta = getStatusMeta(row?.payment_status);
                  const isDup = row?._dupStatus === 'possible_duplicate';

                  // ── Duplicate Review view rows ──
                  if (activeView === 'dup_review') {
                    return (
                      <tr
                        key={row?.id || i}
                        className="border-b border-border/50 bg-orange-50/40 hover:bg-orange-50 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{formatDate(row?.payment_date)}</td>
                        <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">{formatCurrency(row?.amount_paid)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row?.card_program || '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">{row?.card_last4 ? `••••${row?.card_last4}` : '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">{row?.payment_reference || '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-300">
                            <Icon name="Copy" size={9} />
                            {row?._dupCount} records
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-[10px]">
                          {row?.created_at ? new Date(row?.created_at)?.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row?.createdByName || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta?.color}`}>
                            {statusMeta?.label}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // ── Deduplicated / All Raw view rows ──
                  // In deduped view, isDup means this is the primary row of a duplicate group
                  const isPrimaryDupRow = activeView === 'deduped' && isDup;

                  return (
                    <tr
                      key={row?.id || i}
                      className={`border-b border-border/50 transition-colors ${
                        isPrimaryDupRow
                          ? 'bg-orange-50/30 hover:bg-orange-50/60'
                          : activeView === 'all_raw'&& isDup ?'bg-orange-50/60 hover:bg-orange-50' :'hover:bg-muted/20'
                      }`}
                    >
                      {/* Statement Period */}
                      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                        {buildStatementPeriodLabel(row?.statement_period_start, row?.statement_period_end)}
                      </td>

                      {/* Payment Date */}
                      <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                        {formatDate(row?.payment_date)}
                      </td>

                      {/* Amount Paid */}
                      <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(row?.amount_paid)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta?.color}`}>
                          {statusMeta?.label}
                        </span>
                      </td>

                      {/* Card / Account */}
                      <td className="px-4 py-2.5 text-muted-foreground">{row?.card_program || '—'}</td>

                      {/* Last 4 */}
                      <td className="px-4 py-2.5 text-muted-foreground font-mono">{row?.card_last4 ? `••••${row?.card_last4}` : '—'}</td>

                      {/* Source Bank Account */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Icon name="Building2" size={9} />
                          Wells Fargo ...3526
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          <Icon name="CreditCard" size={9} />
                          Liability Payment to AmEx
                        </span>
                      </td>

                      {/* Included in Expense */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                          <Icon name="X" size={9} />
                          No
                        </span>
                      </td>

                      {/* Expense Treatment */}
                      <td className="px-4 py-2.5 min-w-[200px]">
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          Excluded — AmEx vendor transactions are counted separately
                        </span>
                      </td>

                      {/* Duplicate Status */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {isDup ? (
                          <div className="flex flex-col gap-0.5">
                            {isPrimaryDupRow ? (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-300">
                                  <Icon name="Copy" size={9} />
                                  Duplicate group: {row?._dupCount} records
                                </span>
                                <span className="text-[9px] text-muted-foreground pl-1 italic">
                                  Summary totals use one payment from this duplicate group.
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-300">
                                  <Icon name="Copy" size={9} />
                                  Possible Duplicate
                                </span>
                                {row?._dupCount > 1 && (
                                  <span className="text-[9px] text-orange-600 pl-1">{row?._dupCount} matching rows</span>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                            <Icon name="Check" size={9} />
                            Unique
                          </span>
                        )}
                      </td>

                      {/* Reference # */}
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">{row?.payment_reference || '—'}</td>

                      {/* Notes */}
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[160px] truncate">{row?.notes || '—'}</td>

                      {/* Created By */}
                      <td className="px-4 py-2.5 text-muted-foreground">{row?.createdByName || '—'}</td>

                      {/* Created At */}
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {row?.created_at ? new Date(row?.created_at)?.toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, viewRows?.length)} of {viewRows?.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
              >
                <Icon name="ChevronLeft" size={12} />
              </button>
              <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
              >
                <Icon name="ChevronRight" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Duplicate Detection Note ──────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border/50 rounded-lg">
        <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>Duplicate detection</strong> is display/reconciliation only. No payment records are deleted.
          Rows are flagged as duplicates when they share the same payment date, amount, card/account, last 4, and reference number.
          The <strong>Deduplicated Payments</strong> view (default) shows one primary row per group with a badge.
          Use <strong>Duplicate Review</strong> to inspect all rows in duplicate groups.
          Use <strong>All Raw Payment Records</strong> for full audit access.
        </p>
      </div>

      {/* ── Source Note ───────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border/50 rounded-lg">
        <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          AmEx Payments are stored as a separate ledger from AmEx spend transactions.
          Payment records are exposed as <code className="font-mono bg-muted px-1 rounded">amex_payment</code> source type for downstream expense analysis without affecting existing AmEx spend reporting.
          The <strong>AmEx / Corporate Card</strong> expense KPI continues to use vendor-level AmEx transactions, not these bill payment records.
        </p>
      </div>

      {/* ── Reconciliation Note ───────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
        <Icon name="GitMerge" size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-700 leading-relaxed">
          <strong>Reconciliation note:</strong> When Wells Fargo/Plaid mapping is complete, AmEx payments from Wells Fargo <span className="font-mono font-semibold">...3526</span> should reconcile to this table but remain excluded from expense totals.
        </p>
      </div>

      {/* ── Add Payment Modal ─────────────────────────────── */}
      {showModal && (
        <AddPaymentModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setRefreshKey(k => k + 1);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

export default AmexPaymentsTab;
