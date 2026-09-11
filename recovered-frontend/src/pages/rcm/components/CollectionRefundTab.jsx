import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchCollectionRefunds, fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const REFUND_TYPE_OPTIONS = [
  { value: 'all', label: 'All Refunds' },
  { value: 'patient_refund', label: 'Patient Refunds' },
  { value: 'insurance_refund', label: 'Insurance Refunds' },
  { value: 'credit_card_refund', label: 'Credit Card Refunds' },
  { value: 'refund_review', label: 'Refund Review' },
];

const COLUMNS = [
  { key: 'patient_name',                label: 'Patient' },
  { key: 'patient_id',                  label: 'Patient ID' },
  { key: 'office',                      label: 'Office' },
  { key: 'refund_date',                 label: 'Refund Date' },
  { key: 'refund_amount',               label: 'Refund Amount' },
  { key: 'refund_type_label',           label: 'Refund Type' },
  { key: 'organization_ledger_type_name', label: 'OLT / Ledger Type' },
  { key: 'reason',                      label: 'Reason / Note' },
  { key: 'status',                      label: 'Status' },
  { key: 'provider_name',               label: 'Provider' },
  { key: 'entered_by_name',             label: 'Entered By' },
  { key: 'claim_id',                    label: 'Claim ID' },
  { key: 'payor',                       label: 'Payor' },
  { key: 'payment_method',              label: 'Payment Method' },
  { key: 'is_automatically_posted',     label: 'Auto-Posted' },
];

const COL_COUNT = COLUMNS?.length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtN = (v) => (v === null || v === undefined ? 'N/A' : Number(v)?.toLocaleString());
const fmtAmt = (v) => (v === null || v === undefined ? 'N/A' : fmtCurrency(v));

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: COL_COUNT })?.map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-muted rounded w-full" />
      </td>
    ))}
  </tr>
);

// ─── Scorecard ────────────────────────────────────────────────────────────────

const Scorecard = ({ label, amount, count, icon, color = 'primary' }) => (
  <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-start gap-3">
    <div className={`p-2 rounded-full bg-${color}/10 mt-0.5 shrink-0`}>
      <Icon name={icon} size={16} className={`text-${color}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
      <p className="text-lg font-bold text-foreground leading-tight">{fmtAmt(amount)}</p>
      {count !== undefined && (
        <p className="text-xs text-muted-foreground mt-0.5">{fmtN(count)} records</p>
      )}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CollectionRefundTab = ({ dateRange, officeId, refreshKey }) => {
  // Data state
  const [rows, setRows]           = useState([]);
  const [summary, setSummary]     = useState({});
  const [pagination, setPagination] = useState({ page: 1, page_size: 50, total_count: 0, total_pages: 1 });
  const [metadata, setMetadata]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Filter state
  const [search, setSearch]       = useState('');
  const [refundType, setRefundType] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [includeNonRefund, setIncludeNonRefund] = useState(false);
  const [pageSize, setPageSize]   = useState(50);
  const [page, setPage]           = useState(1);

  // Sort state (client-side within current page)
  const [sortKey, setSortKey]     = useState('refund_date');
  const [sortDir, setSortDir]     = useState('desc');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (pg = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchCollectionRefunds({
        start: dateRange?.start,
        end: dateRange?.end,
        officeId: officeId || null,
        refundType,
        includeNonRefundAdjustments: includeNonRefund,
        minAmount: minAmount !== '' ? Number(minAmount) : null,
        search: search || null,
        page: pg,
        pageSize,
      });
      setRows(result?.data || []);
      setSummary(result?.summary || {});
      setPagination(result?.pagination || { page: pg, page_size: pageSize, total_count: 0, total_pages: 1 });
      setMetadata(result?.metadata || {});
      setPage(pg);
    } catch (e) {
      setError(e?.message || 'Failed to load collection refunds');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refundType, includeNonRefund, minAmount, search, pageSize]);

  // Re-fetch when date/office/refreshKey changes
  useEffect(() => {
    load(1);
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear stale data when entering multi-subset mode — removed (single-office only)

  // Re-fetch when filter params change (reset to page 1)
  useEffect(() => {
    load(1);
  }, [refundType, includeNonRefund, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side sort within current page ──────────────────────────────────

  const sorted = useMemo(() => {
    return [...rows]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Pagination controls ────────────────────────────────────────────────────

  const totalPages = pagination?.total_pages || 1;
  const totalCount = pagination?.total_count ?? rows?.length;
  const currentPage = pagination?.page || page;

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    if (clamped !== currentPage) load(clamped);
  };

  // ── Search / minAmount — trigger on Enter or blur ─────────────────────────

  const handleSearchKeyDown = (e) => {
    if (e?.key === 'Enter') load(1);
  };

  const handleMinAmountKeyDown = (e) => {
    if (e?.key === 'Enter') load(1);
  };

  // ── Sort icon ──────────────────────────────────────────────────────────────

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  // ── Row cell renderer ──────────────────────────────────────────────────────

  const renderCell = (row, col) => {
    const v = row?.[col?.key];
    switch (col?.key) {
      case 'refund_amount':
        return <span className="font-medium">{fmtCurrency(v)}</span>;
      case 'refund_date':
        return <span className="whitespace-nowrap">{fmtDate(v) || '—'}</span>;
      case 'is_automatically_posted':
        return v === true ? <span className="text-green-600 font-medium">Yes</span> : v === false ? <span className="text-muted-foreground">No</span> : '—';
      case 'refund_type_label':
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
            row?.is_non_refund_adjustment
              ? 'bg-amber-100 text-amber-700'
              : row?.is_patient_refund
              ? 'bg-blue-100 text-blue-700'
              : row?.is_insurance_refund
              ? 'bg-purple-100 text-purple-700'
              : row?.is_credit_card_refund
              ? 'bg-teal-100 text-teal-700' :'bg-muted text-muted-foreground'
          }`}>
            {row?.is_non_refund_adjustment ? 'Review — Not Refund Total' : (v || row?.refund_type || '—')}
          </span>
        );
      case 'status':
        return v ? (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
            ['processed','completed','posted','paid']?.includes(String(v)?.toLowerCase()) ? 'bg-green-100 text-green-700' :
            ['denied','rejected','declined','voided','cancelled']?.includes(String(v)?.toLowerCase()) ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          }`}>{v}</span>
        ) : '—';
      case 'reason':
        return <span className="max-w-[180px] truncate block" title={v || ''}>{v || '—'}</span>;
      default:
        return v !== null && v !== undefined && v !== '' ? String(v) : '—';
    }
  };

  // ── Date/source label ──────────────────────────────────────────────────────

  const dateBasisLabel = metadata?.date_label || metadata?.date_basis || 'transaction_date';

  // ── Non-refund summary visibility ─────────────────────────────────────────

  const hasNonRefundSummary = includeNonRefund &&
    (summary?.non_refund_adjustment_amount !== undefined || summary?.non_refund_adjustment_count !== undefined);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Source / Type Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Source:</span> Dentrix Ascend adjustment ledger via{' '}
            <code className="bg-blue-100 px-1 rounded">/v2/rcm/collection-refunds</code>.{' '}
            Refund totals include active true patient, insurance, and credit-card refund adjustment types only.
            Write-offs and balance corrections are excluded from refund totals unless review rows are explicitly included.
            <span className="block mt-1 text-blue-700">
              Date filter uses <strong>Refund Date</strong> / Dentrix adjustment transaction date
              {dateBasisLabel && dateBasisLabel !== 'transaction_date' ? ` (${dateBasisLabel})` : ''}.
            </span>
          </div>
        </div>
      </div>
      {/* Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Scorecard
          label="Total Refund Amount"
          amount={summary?.total_refund_amount}
          count={summary?.total_refund_count}
          icon="RotateCcw"
          color="primary"
        />
        <Scorecard
          label="Patient Refunds"
          amount={summary?.patient_refund_amount}
          count={summary?.patient_refund_count}
          icon="User"
          color="blue-500"
        />
        <Scorecard
          label="Insurance Refunds"
          amount={summary?.insurance_refund_amount}
          count={summary?.insurance_refund_count}
          icon="Shield"
          color="purple-500"
        />
        <Scorecard
          label="Credit Card Refunds"
          amount={summary?.credit_card_refund_amount}
          count={summary?.credit_card_refund_count}
          icon="CreditCard"
          color="teal-500"
        />
        <Scorecard
          label="High-Value Refunds"
          amount={summary?.high_value_refund_amount}
          count={summary?.high_value_refund_count}
          icon="AlertTriangle"
          color="amber-500"
        />
        {hasNonRefundSummary && (
          <Scorecard
            label="Non-Refund Review"
            amount={summary?.non_refund_adjustment_amount}
            count={summary?.non_refund_adjustment_count}
            icon="Eye"
            color="orange-500"
          />
        )}
      </div>
      {/* Main Table Card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">

        {/* Filters toolbar */}
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient, claim… (Enter)"
              value={search}
              onChange={e => setSearch(e?.target?.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>

          {/* Refund Type */}
          <select
            value={refundType}
            onChange={e => setRefundType(e?.target?.value)}
            className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {REFUND_TYPE_OPTIONS?.map(opt => (
              <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
            ))}
          </select>

          {/* Min Amount */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Min $</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={minAmount}
              onChange={e => setMinAmount(e?.target?.value)}
              onKeyDown={handleMinAmountKeyDown}
              className="w-24 text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Page Size */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Rows:</label>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e?.target?.value)); }}
              className="text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PAGE_SIZE_OPTIONS?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Include Non-Refund Review Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-muted-foreground whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeNonRefund}
              onChange={e => setIncludeNonRefund(e?.target?.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            Include Non-Refund Review Rows
          </label>

          {/* Export */}
          <button
            onClick={() => downloadCsv('collection_refunds.csv', rowsToCsv(sorted, COLUMNS))}
            className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted ml-auto"
          >
            <Icon name="Download" size={14} /> Export current page
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
            <thead className="bg-muted border-b border-border">
              <tr>
                {COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => handleSort(col?.key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap"
                  >
                    {col?.label}<SortIcon col={col?.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} />)
                : error
                ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td>
                  </tr>
                )
                : sorted?.length === 0
                ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No refund records found for the selected filters.
                    </td>
                  </tr>
                )
                : sorted?.map(row => (
                  <tr
                    key={row?.id}
                    className={`hover:bg-muted/50 ${row?.is_non_refund_adjustment ? 'bg-amber-50/40' : ''}`}
                  >
                    {COLUMNS?.map(col => (
                      <td key={col?.key} className="px-3 py-2.5 text-foreground">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              Page {currentPage} of {totalPages} &nbsp;·&nbsp; {totalCount?.toLocaleString()} total records
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              title="First page"
            >
              <Icon name="ChevronsLeft" size={16} />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              title="Previous page"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span className="px-2 text-xs">{currentPage} / {totalPages}</span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              title="Next page"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              title="Last page"
            >
              <Icon name="ChevronsRight" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionRefundTab;
