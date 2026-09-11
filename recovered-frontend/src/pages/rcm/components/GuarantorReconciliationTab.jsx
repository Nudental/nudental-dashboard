import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchGuarantorReconciliation, fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';

// ─── Status badge colors ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  DUE:              'bg-red-100 text-red-700',
  PENDING:          'bg-amber-100 text-amber-700',
  COLLECTED:        'bg-green-100 text-green-700',
  NO_BALANCE:       'bg-gray-100 text-gray-600',
  PREDETERMINATION: 'bg-blue-100 text-blue-700',
};

const ESTIMATE_COLORS = {
  PRE_EOB_ESTIMATE:  'bg-amber-50 text-amber-700 border border-amber-200',
  POST_EOB:          'bg-green-50 text-green-700 border border-green-200',
  PREDETERMINATION:  'bg-blue-50 text-blue-700 border border-blue-200',
  UNKNOWN:           'bg-gray-50 text-gray-500 border border-gray-200',
};

// ─── Collection Signal badge colors ──────────────────────────────────────────
const COLLECTION_SIGNAL_COLORS = {
  COLLECTED_ALLOCATED:       'bg-green-100 text-green-800 border border-green-300',
  LIKELY_COLLECTED_SAME_DAY: 'bg-teal-100 text-teal-800 border border-teal-300',
  PARTIALLY_COLLECTED:       'bg-amber-100 text-amber-800 border border-amber-300',
  WITHIN_COLLECTION_WINDOW:  'bg-blue-100 text-blue-800 border border-blue-300',
  NOT_COLLECTED:             'bg-red-100 text-red-800 border border-red-300',
  NO_PORTION_DUE:            'bg-gray-100 text-gray-600 border border-gray-200',
};

const COLLECTION_SIGNAL_LABELS = {
  COLLECTED_ALLOCATED:       'Collected / Allocated',
  LIKELY_COLLECTED_SAME_DAY: 'Likely Collected Same Day',
  PARTIALLY_COLLECTED:       'Partially Collected',
  WITHIN_COLLECTION_WINDOW:  'Within 5-Day Window',
  NOT_COLLECTED:             'Not Collected',
  NO_PORTION_DUE:            'No Portion Due',
};

// ─── Currency helper: shows — for missing/null/undefined, $0.00 for real 0 ──
const fmtMoney = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(v);
};

// ─── Table columns ────────────────────────────────────────────────────────────
const TABLE_COLUMNS = [
  { key: 'office',                             label: 'Office' },
  { key: 'service_date',                      label: 'Service Date' },
  { key: 'patient_name',                      label: 'Patient Name' },
  { key: 'patient_id',                        label: 'Patient ID' },
  { key: 'procedure_code',                    label: 'Code' },
  { key: 'procedure_description',             label: 'Procedure' },
  { key: 'charge_amount',                     label: 'Charge' },
  { key: 'current_patient_portion',           label: 'Procedure Patient Portion' },
  { key: 'actual_patient_paid',               label: 'Allocated Patient Paid' },
  { key: 'remaining_patient_due',             label: 'Remaining Due' },
  { key: 'actual_insurance_paid',             label: 'Insurance Paid' },
  { key: 'days_since_service',                label: 'Days Since Service' },
  { key: 'reconciliation_status',             label: 'Status' },
  { key: 'claim_state',                       label: 'Claim Status' },
  { key: 'portion_label',                     label: 'Estimate Status' },
  { key: 'patient_portion_collection_status', label: 'Collection Signal' },
];

const PAGE_SIZE = 100;

const SkeletonRow = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols })?.map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-muted rounded w-full" />
      </td>
    ))}
  </tr>
);

// ─── Scorecard card ───────────────────────────────────────────────────────────
const ScorecardCard = ({ label, value, icon, accent = '' }) => (
  <div className={`bg-card border border-border rounded-xl p-4 flex flex-col gap-1 ${accent || ''}`}>
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
      {icon && <Icon name={icon} size={14} />}
      {label}
    </div>
    <div className="text-xl font-bold text-foreground">{value ?? '—'}</div>
  </div>
);

// ─── Collection Signal Badge ──────────────────────────────────────────────────
const CollectionSignalBadge = ({ status }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const label = COLLECTION_SIGNAL_LABELS?.[status] || status;
  const cls = COLLECTION_SIGNAL_COLORS?.[status] || 'bg-gray-100 text-gray-600 border border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

// ─── Expandable row detail ────────────────────────────────────────────────────
const ExpandedDetail = ({ row }) => {
  const payorDisplay = [row?.payor_name || row?.payor, row?.plan_name]?.filter(Boolean)?.join(' / ') || '—';
  const patientPaymentDates = Array.isArray(row?.patient_payment_dates)
    ? row?.patient_payment_dates?.join(', ') || '—'
    : row?.patient_payment_dates || '—';
  const insurancePaymentDates = Array.isArray(row?.insurance_payment_dates)
    ? row?.insurance_payment_dates?.join(', ') || '—'
    : row?.insurance_payment_dates || '—';
  const tagsDisplay = Array.isArray(row?.tags) ? row?.tags?.join(', ') || '—' : row?.tags || '—';

  // Same-day payment fields
  const sameDayDates = Array.isArray(row?.same_day_patient_payment_dates)
    ? row?.same_day_patient_payment_dates?.join(', ') || '—'
    : row?.same_day_patient_payment_dates || '—';
  const sameDayMethods = Array.isArray(row?.same_day_patient_payment_methods)
    ? row?.same_day_patient_payment_methods?.join(', ') || '—'
    : row?.same_day_patient_payment_methods || '—';

  return (
    <tr>
      <td colSpan={TABLE_COLUMNS?.length + 1} className="bg-muted/30 px-6 py-4 border-b border-border">
        {/* Same-day payment signal section */}
        <div className="mb-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Zap" size={13} className="text-teal-700" />
            <span className="text-xs font-semibold text-teal-800">Same-Day Payment Signal</span>
            <CollectionSignalBadge status={row?.patient_portion_collection_status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
            <div>
              <span className="text-teal-700 font-medium">Same-Day Payment Found:</span>{' '}
              <span className="font-semibold text-teal-900">{fmtMoney(row?.same_day_patient_payment)}</span>
            </div>
            <div>
              <span className="text-teal-700 font-medium">Same-Day Payment Date(s):</span>{' '}
              <span className="font-medium text-teal-900">{sameDayDates}</span>
            </div>
            <div>
              <span className="text-teal-700 font-medium">Same-Day Payment Method(s):</span>{' '}
              <span className="font-medium text-teal-900">{sameDayMethods}</span>
            </div>
            <div>
              <span className="text-teal-700 font-medium">Allocated Patient Paid:</span>{' '}
              <span className="font-semibold text-teal-900">{fmtMoney(row?.actual_patient_paid)}</span>
            </div>
            <div>
              <span className="text-teal-700 font-medium">Remaining Due:</span>{' '}
              <span className={`font-semibold ${(row?.remaining_patient_due ?? -1) > 0 ? 'text-red-700' : 'text-teal-900'}`}>
                {fmtMoney(row?.remaining_patient_due)}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-teal-700 leading-relaxed italic">
            <strong>Allocated Patient Paid</strong> is based on Dentrix charge-level payment allocation.{' '}
            <strong>Same-Day Payment Found</strong> shows patient payments made at the same office/date with paid-at-visit=true,
            even if Dentrix allocated the payment to another balance.
          </p>
        </div>

        {/* Standard detail fields */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
          <div><span className="text-muted-foreground">Payor / Plan:</span> <span className="font-medium">{payorDisplay}</span></div>
          <div><span className="text-muted-foreground">Claim ID:</span> <span className="font-medium font-mono">{row?.claim_id || '—'}</span></div>
          <div><span className="text-muted-foreground">Claim Sent Date:</span> <span className="font-medium">{fmtDate(row?.claim_sent_date)}</span></div>
          <div><span className="text-muted-foreground">Days Since Claim Sent:</span> <span className="font-medium">{row?.days_since_claim_sent ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Est. Patient Portion:</span> <span className="font-medium">{fmtMoney(row?.original_patient_portion)}</span></div>
          <div><span className="text-muted-foreground">Current Patient Portion:</span> <span className="font-medium">{fmtMoney(row?.current_patient_portion)}</span></div>
          <div><span className="text-muted-foreground">Est. Insurance Portion:</span> <span className="font-medium">{fmtMoney(row?.original_primary_insurance_portion)}</span></div>
          <div><span className="text-muted-foreground">Current Insurance Portion:</span> <span className="font-medium">{fmtMoney(row?.current_primary_insurance_portion)}</span></div>
          <div><span className="text-muted-foreground">Claim Write-Off:</span> <span className="font-medium">{fmtMoney(row?.write_off)}</span></div>
          <div><span className="text-muted-foreground">Ledger Write-Off:</span> <span className="font-medium">{fmtMoney(row?.ledger_write_off)}</span></div>
          <div><span className="text-muted-foreground">Patient Payment Dates:</span> <span className="font-medium">{patientPaymentDates}</span></div>
          <div><span className="text-muted-foreground">Insurance Payment Dates:</span> <span className="font-medium">{insurancePaymentDates}</span></div>
          <div><span className="text-muted-foreground">Tags:</span> <span className="font-medium">{tagsDisplay}</span></div>
        </div>
      </td>
    </tr>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const GuarantorReconciliationTab = ({ dateRange, officeId, refreshKey }) => {
  // ── Server-side state ──
  const [rows, setRows]               = useState([]);
  const [scorecard, setScorecard]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [page, setPage]               = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  // ── Server-side filter params ──
  const [balanceDueOnly, setBalanceDueOnly]               = useState(false);
  const [excludeZeroPortion, setExcludeZeroPortion]       = useState(true);
  const [includePredeterminations, setIncludePredeterminations] = useState(false);
  const [minDaysOutstanding, setMinDaysOutstanding]       = useState(0);
  const [minDaysInput, setMinDaysInput]                   = useState('0');

  // ── Client-side filter state ──
  const [statusFilter, setStatusFilter]           = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('');
  const [estimateStatusFilter, setEstimateStatusFilter] = useState('');
  const [collectionSignalFilter, setCollectionSignalFilter] = useState('');
  const [search, setSearch]                       = useState('');

  // ── Sort / expand ──
  const [sortKey, setSortKey]   = useState('service_date');
  const [sortDir, setSortDir]   = useState('desc');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (pg = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchGuarantorReconciliation({
        startDate: dateRange?.start,
        endDate: dateRange?.end,
        officeId,
        minDaysOutstanding,
        onlyBalanceDue: balanceDueOnly,
        excludeZeroPortion,
        includePredeterminations,
        page: pg,
        pageSize: PAGE_SIZE,
      });
      setRows(result?.data || []);
      setScorecard(result?.scorecard || null);
      setTotalCount(result?.total_count ?? result?.data?.length ?? 0);
      setPage(pg);
    } catch (e) {
      setError(e?.message || 'Failed to load guarantor reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, minDaysOutstanding, balanceDueOnly, excludeZeroPortion, includePredeterminations]);

  useEffect(() => {
    load(1);
  }, [load, refreshKey]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows?.filter(r => {
      if (statusFilter && r?.reconciliation_status !== statusFilter) return false;
      if (claimStatusFilter && r?.claim_state !== claimStatusFilter) return false;
      if (estimateStatusFilter && r?.portion_label !== estimateStatusFilter) return false;
      if (collectionSignalFilter && r?.patient_portion_collection_status !== collectionSignalFilter) return false;
      if (search) {
        const q = search?.toLowerCase();
        const haystack = [r?.patient_name, r?.patient_id, r?.office || r?.office_name, r?.procedure_code, r?.procedure_description, r?.claim_state]
          ?.map(v => String(v || '')?.toLowerCase())
          ?.join(' ');
        if (!haystack?.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, claimStatusFilter, estimateStatusFilter, collectionSignalFilter, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Unique filter options (client-side) ───────────────────────────────────
  const uniqueStatuses            = useMemo(() => [...new Set(rows?.map(r => r?.reconciliation_status)?.filter(Boolean))], [rows]);
  const uniqueClaimStatuses       = useMemo(() => [...new Set(rows?.map(r => r?.claim_state)?.filter(Boolean))], [rows]);
  const uniqueEstimateLabels      = useMemo(() => [...new Set(rows?.map(r => r?.portion_label)?.filter(Boolean))], [rows]);
  const uniqueCollectionSignals   = useMemo(() => [...new Set(rows?.map(r => r?.patient_portion_collection_status)?.filter(Boolean))], [rows]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleRow = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next?.has(idx) ? next?.delete(idx) : next?.add(idx);
      return next;
    });
  };

  const handleMinDaysBlur = () => {
    const val = parseInt(minDaysInput, 10);
    if (!isNaN(val) && val >= 0) setMinDaysOutstanding(val);
    else setMinDaysInput(String(minDaysOutstanding));
  };

  const handleExportCsv = () => {
    downloadCsv(`patient_portion_reconciliation_${dateRange?.start}_${dateRange?.end}.csv`, rowsToCsv(sorted, TABLE_COLUMNS));
  };

  // ── Scorecard values ──────────────────────────────────────────────────────
  const sc = scorecard;

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* ── Source Note ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Icon name="Info" size={13} className="text-blue-400 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Source: Dentrix/HS1 claim procedure portions via /v2/rcm/guarantor-reconciliation. Totals reflect selected date range and filters.
        </p>
      </div>
      {/* ── Procedure-level subtitle / source clarification ───────────────── */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Icon name="Info" size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold">Procedure-level patient portion reconciliation</span> from Dentrix/HS1 claim procedure portions.
          This is not the same as patient-level Patient Balances.
          Each row represents one procedure on a claim. Scorecards reflect the full backend-filtered dataset for the selected date range.
        </p>
      </div>
      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-background min-w-[180px]">
          <Icon name="Search" size={14} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patient name, ID, code, office…"
            value={search}
            onChange={e => setSearch(e?.target?.value)}
            className="text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full"
          />
        </div>

        {/* Balance Due Only */}
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={balanceDueOnly}
            onChange={e => setBalanceDueOnly(e?.target?.checked)}
            className="rounded border-border"
          />
          Balance Due Only
        </label>

        {/* Show Zero / No Balance */}
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!excludeZeroPortion}
            onChange={e => setExcludeZeroPortion(!e?.target?.checked)}
            className="rounded border-border"
          />
          Show Zero / No Balance
        </label>

        {/* Show Predeterminations */}
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePredeterminations}
            onChange={e => setIncludePredeterminations(e?.target?.checked)}
            className="rounded border-border"
          />
          Show Predeterminations
        </label>

        {/* Min Days Outstanding */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted-foreground whitespace-nowrap">Min Days Outstanding:</span>
            <input
              type="number"
              min="0"
              value={minDaysInput}
              onChange={e => setMinDaysInput(e?.target?.value)}
              onBlur={handleMinDaysBlur}
              className="w-16 border border-border rounded-lg px-2 py-1 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground">0 = include same-day/current procedure patient portion rows in the selected service-date range.</span>
        </div>

        {/* Status filter (client-side) */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e?.target?.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {uniqueStatuses?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Claim Status filter (client-side) */}
        <select
          value={claimStatusFilter}
          onChange={e => setClaimStatusFilter(e?.target?.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Claim Statuses</option>
          {uniqueClaimStatuses?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Estimate Status filter (client-side) */}
        <select
          value={estimateStatusFilter}
          onChange={e => setEstimateStatusFilter(e?.target?.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Estimate Statuses</option>
          {uniqueEstimateLabels?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Collection Signal filter (client-side) */}
        <select
          value={collectionSignalFilter}
          onChange={e => setCollectionSignalFilter(e?.target?.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Collection Signals</option>
          {uniqueCollectionSignals?.map(s => (
            <option key={s} value={s}>{COLLECTION_SIGNAL_LABELS?.[s] || s}</option>
          ))}
        </select>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => load(1)}
            disabled={loading}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={sorted?.length === 0}
            className="flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-foreground text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Icon name="Download" size={13} />
            Export loaded rows
          </button>
        </div>
      </div>
      {/* ── Primary Scorecards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ScorecardCard
          label="Total Patient Portion"
          value={sc ? fmtCurrency(sc?.total_current_patient_portion) : loading ? '…' : '—'}
          icon="DollarSign"
        />
        <ScorecardCard
          label="Collected"
          value={sc ? fmtCurrency(sc?.total_actual_patient_paid) : loading ? '…' : '—'}
          icon="CheckCircle"
          accent="border-green-200"
        />
        <ScorecardCard
          label="Remaining Due"
          value={sc ? fmtCurrency(sc?.total_remaining_patient_due) : loading ? '…' : '—'}
          icon="AlertCircle"
          accent="border-red-200"
        />
        <ScorecardCard
          label="Procedures Due"
          value={sc ? (sc?.due_row_count ?? '—') : loading ? '…' : '—'}
          icon="FileText"
        />
        <ScorecardCard
          label="Same-Day Collections"
          value={sc ? (sc?.collected_same_day_count ?? '—') : loading ? '…' : '—'}
          icon="Zap"
        />
        <ScorecardCard
          label="Over 5 Days Due"
          value={sc ? (sc?.over_5_days_due_count ?? '—') : loading ? '…' : '—'}
          icon="Clock"
          accent="border-amber-200"
        />
      </div>
      {/* ── Secondary Scorecards (Same-Day Payment Signal) ────────────────── */}
      {(sc?.same_day_patient_payment_total !== undefined || sc?.likely_collected_same_day_count !== undefined || sc?.allocation_review_count !== undefined) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-teal-700 text-xs font-medium">
              <Icon name="Zap" size={14} />
              Same-Day Payments Found
            </div>
            <div className="text-xl font-bold text-teal-900">
              {sc?.same_day_patient_payment_total !== undefined ? fmtCurrency(sc?.same_day_patient_payment_total) : '—'}
            </div>
            <div className="text-[10px] text-teal-600">Total same-day patient payments detected</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-teal-700 text-xs font-medium">
              <Icon name="CheckCircle" size={14} />
              Likely Collected Same Day
            </div>
            <div className="text-xl font-bold text-teal-900">
              {sc?.likely_collected_same_day_count ?? '—'}
            </div>
            <div className="text-[10px] text-teal-600">Procedures with same-day payment signal</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-medium">
              <Icon name="AlertTriangle" size={14} />
              Allocation Review
            </div>
            <div className="text-xl font-bold text-indigo-900">
              {sc?.allocation_review_count ?? '—'}
            </div>
            <div className="text-[10px] text-indigo-600">Same-day payment found but not allocated to this charge</div>
          </div>
        </div>
      )}
      {/* ── Office Collection Scorecard ───────────────────────────────────── */}
      {sc?.by_office && Array.isArray(sc?.by_office) && sc?.by_office?.length > 0 && (
        <OfficeCollectionScorecard scorecard={sc} />
      )}
      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <Icon name="AlertCircle" size={15} />
          {error}
        </div>
      )}
      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Patient Portion Reconciliation</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {loading ? '…' : `${sorted?.length} rows`}
              {!loading && totalCount > rows?.length ? ` of ${totalCount} total` : ''}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {dateRange?.start && dateRange?.end
                ? `${dateRange?.start} – ${dateRange?.end}`
                : 'Selected range'}{' '}
              · Backend Reconciliation Active
              {totalCount > 0 ? ` · ${totalCount?.toLocaleString()} matching records` : ''}
            </span>
          </div>
          {/* Client-side filter note */}
          <span className="text-xs text-muted-foreground italic">
            Status, Claim Status, Estimate Status, and Collection Signal filters are client-side only. Client-side filters apply to loaded rows only.
          </span>
        </div>

        {/* ── Payment allocation helper note ──────────────────────────────── */}
        <div className="px-4 py-2 bg-teal-50/60 border-b border-teal-100 flex items-start gap-2">
          <Icon name="Info" size={13} className="text-teal-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-teal-800 leading-relaxed">
            <strong>Allocated Patient Paid</strong> is based on Dentrix charge-level payment allocation.{' '}
            <strong>Same-Day Payment Found</strong> (visible in expanded row) shows patient payments made at the same office/date with paid-at-visit=true,
            even if Dentrix allocated the payment to another balance.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {/* Expand toggle column */}
                <th className="w-8 px-2 py-2" />
                {TABLE_COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => handleSort(col?.key)}
                    className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap select-none"
                  >
                    {col?.label}
                    <SortIcon col={col?.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows?.length === 0 && (
                Array.from({ length: 8 })?.map((_, i) => <SkeletonRow key={i} cols={TABLE_COLUMNS?.length + 1} />)
              )}
              {!loading && sorted?.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COLUMNS?.length + 1} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {error ? 'Error loading data.' : 'No records match the current filters.'}
                  </td>
                </tr>
              )}
              {sorted?.map((row, idx) => {
                const isExpanded = expandedRows?.has(idx);
                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={`border-b border-border hover:bg-muted/30 transition-colors ${isExpanded ? 'bg-muted/20' : ''}`}
                    >
                      {/* Expand toggle */}
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleRow(idx)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand details'}
                        >
                          <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
                        </button>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-foreground">{row?.office || row?.office_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground">{fmtDate(row?.service_date) || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground font-medium">{row?.patient_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-foreground">{row?.patient_id || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-foreground">{row?.procedure_code || '—'}</td>
                      <td className="px-3 py-2 text-foreground max-w-[160px] truncate" title={row?.procedure_description}>{row?.procedure_description || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground text-right">{fmtMoney(row?.charge_amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground text-right font-medium">{fmtMoney(row?.current_patient_portion)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-green-700 text-right">{fmtMoney(row?.actual_patient_paid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <span className={`font-semibold ${(row?.remaining_patient_due ?? -1) > 0 ? 'text-red-600' : 'text-foreground'}`}>
                          {fmtMoney(row?.remaining_patient_due)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-foreground text-right">{fmtMoney(row?.actual_insurance_paid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-center text-foreground">{row?.days_since_service ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row?.reconciliation_status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS?.[row?.reconciliation_status] || 'bg-gray-100 text-gray-600'}`}>
                            {row?.reconciliation_status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-foreground">{row?.claim_state || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row?.portion_label ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTIMATE_COLORS?.[row?.portion_label] || 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                            {row?.portion_label}
                          </span>
                        ) : '—'}
                      </td>
                      {/* Collection Signal column */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <CollectionSignalBadge status={row?.patient_portion_collection_status} />
                      </td>
                    </tr>
                    {isExpanded && <ExpandedDetail row={row} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} · {rows?.length} of {totalCount} records loaded</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={rows?.length < PAGE_SIZE || loading}
                className="px-3 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── Known Limitations Footer ──────────────────────────────────────────── */}
      <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-start gap-2">
        <Icon name="Info" size={14} className="text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Known limitations:</span>{' '}
          some rows may have missing charge links;
          payment method not populated yet; some server-side filters are not yet fully scoped.
          Provider, claim status, and tag filters are not fully wired server-side — client-side filtering is applied.
        </p>
      </div>
    </div>
  );
};

// ─── Office Collection Scorecard helpers ─────────────────────────────────────

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return null;
  return `${(parseFloat(v) * 100)?.toFixed(1)}%`;
};

const patientSameDayColor = (rate) => {
  if (rate === null || rate === undefined) return '';
  const pct = parseFloat(rate) * 100;
  if (pct >= 70) return 'text-green-700 font-semibold';
  if (pct >= 40) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
};

const patientSameDayBg = (rate) => {
  if (rate === null || rate === undefined) return '';
  const pct = parseFloat(rate) * 100;
  if (pct >= 70) return 'bg-green-50';
  if (pct >= 40) return 'bg-amber-50';
  return 'bg-red-50';
};

const insurancePostEobColor = (rate) => {
  if (rate === null || rate === undefined) return '';
  const pct = parseFloat(rate) * 100;
  if (pct >= 85) return 'text-green-700 font-semibold';
  if (pct >= 60) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
};

const insurancePostEobBg = (rate) => {
  if (rate === null || rate === undefined) return '';
  const pct = parseFloat(rate) * 100;
  if (pct >= 85) return 'bg-green-50';
  if (pct >= 60) return 'bg-amber-50';
  return 'bg-red-50';
};

// ─── Tooltip component ────────────────────────────────────────────────────────
const InfoTooltip = ({ text }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="More information"
      >
        <Icon name="HelpCircle" size={12} />
      </button>
      {show && (
        <span className="absolute z-50 left-5 top-0 w-72 bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs text-foreground leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
};

// ─── Office Collection Scorecard section ─────────────────────────────────────
const OfficeCollectionScorecard = ({ scorecard }) => {
  const byOffice = scorecard?.by_office;
  if (!byOffice || !Array.isArray(byOffice) || byOffice?.length === 0) return null;

  const fmtRateCell = (rate, colorFn, bgFn, denominator) => {
    if (denominator === 0 || denominator === null || denominator === undefined) {
      return <span className="text-muted-foreground text-xs">N/A</span>;
    }
    const display = fmtPct(rate);
    if (display === null) return <span className="text-muted-foreground text-xs">N/A</span>;
    return <span className={`text-xs px-1.5 py-0.5 rounded ${bgFn(rate)} ${colorFn(rate)}`}>{display}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Icon name="Building2" size={15} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Office Collection Scorecard</h3>
        <span className="text-xs text-muted-foreground italic">— uses scorecard.by_office from backend; not calculated from visible rows</span>
      </div>
      {/* Panel 1: Patient Portion Collection by Office */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
          <Icon name="UserCheck" size={13} className="text-teal-600" />
          <span className="text-xs font-semibold text-foreground">Patient Portion Collection by Office</span>
          <InfoTooltip text="Allocation Rate uses Dentrix charge-level payment allocation. Same-Day Rate uses paid-at-visit payments on the same office/date, even if Dentrix allocated the payment to another balance." />
          <span className="ml-auto text-[10px] text-muted-foreground italic">
            Same-Day Rate: <span className="text-green-700 font-medium">≥70% green</span> · <span className="text-amber-600 font-medium">40–69% yellow</span> · <span className="text-red-600 font-medium">&lt;40% red</span> · N/A when denominator is 0/null
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Office</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Patient Portion</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Allocated Paid
                  <InfoTooltip text="total_actual_patient_paid — Dentrix charge-level payment allocation" />
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Same-Day Found
                  <InfoTooltip text="same_day_patient_payment_total — paid-at-visit payments on same office/date" />
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Remaining Due</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Procedures Due</th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Allocation Rate
                  <InfoTooltip text="patient_portion_collection_rate — based on Dentrix charge-level allocation" />
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Same-Day Rate
                  <InfoTooltip text="operational_same_day_collection_rate — paid-at-visit on same office/date, even if Dentrix allocated elsewhere" />
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Likely Same-Day</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Allocation Review</th>
              </tr>
            </thead>
            <tbody>
              {byOffice?.map((row, i) => (
                <tr key={row?.office || i} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{row?.office || '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtMoney(row?.total_current_patient_portion)}</td>
                  <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{fmtMoney(row?.total_actual_patient_paid)}</td>
                  <td className="px-3 py-2 text-right text-teal-700 whitespace-nowrap">{fmtMoney(row?.same_day_patient_payment_total)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={(row?.total_remaining_patient_due ?? -1) > 0 ? 'text-red-600 font-semibold' : 'text-foreground'}>
                      {fmtMoney(row?.total_remaining_patient_due)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.due_count ?? '—'}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {fmtRateCell(
                      row?.patient_portion_collection_rate,
                      () => '',
                      () => 'bg-muted',
                      row?.due_count
                    )}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {fmtRateCell(
                      row?.operational_same_day_collection_rate,
                      patientSameDayColor,
                      patientSameDayBg,
                      row?.due_count
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.likely_collected_same_day_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {(row?.allocation_review_count ?? 0) > 0
                      ? <span className="text-amber-700 font-semibold">{row?.allocation_review_count}</span>
                      : <span className="text-foreground">{row?.allocation_review_count ?? '—'}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-teal-50/50 border-t border-teal-100 flex items-start gap-2">
          <Icon name="Info" size={12} className="text-teal-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-teal-800 leading-relaxed">
            <strong>Allocation Rate</strong> uses Dentrix charge-level payment allocation.{' '}
            <strong>Same-Day Rate</strong> uses paid-at-visit payments on the same office/date, even if Dentrix allocated the payment to another balance.
          </p>
        </div>
      </div>
      {/* Panel 2: Insurance Collection by Office */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
          <Icon name="ShieldCheck" size={13} className="text-blue-600" />
          <span className="text-xs font-semibold text-foreground">Insurance Collection by Office</span>
          <InfoTooltip text="POST-EOB Collection Rate is based on adjudicated rows. Pre-EOB insurance amounts are estimates and may change after insurance payment." />
          <span className="ml-auto text-[10px] text-muted-foreground italic">
            POST-EOB Rate: <span className="text-green-700 font-medium">≥85% green</span> · <span className="text-amber-600 font-medium">60–84% yellow</span> · <span className="text-red-600 font-medium">&lt;60% red</span> · N/A when denominator is 0/null
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Office</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Insurance Portion</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Insurance Paid</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Insurance Remaining</th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  POST-EOB Rate
                  <InfoTooltip text="insurance_collection_rate_post_eob — primary rate based on adjudicated rows only" />
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  All Rows Rate
                  <InfoTooltip text="insurance_collection_rate_all — includes pre-EOB estimates; can exceed 100% when Dentrix zeroes current insurance portion after payment. Secondary indicator only." />
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Claims</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Accepted</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">PAYRECVD</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Settled</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Avg Days Sent</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Pre-EOB Rows</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Post-EOB Rows</th>
              </tr>
            </thead>
            <tbody>
              {byOffice?.map((row, i) => (
                <tr key={row?.office || i} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{row?.office || '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtMoney(row?.total_current_primary_insurance_portion)}</td>
                  <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{fmtMoney(row?.total_actual_insurance_paid)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={(row?.total_remaining_insurance_due ?? -1) > 0 ? 'text-red-600 font-semibold' : 'text-foreground'}>
                      {fmtMoney(row?.total_remaining_insurance_due)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {fmtRateCell(
                      row?.insurance_collection_rate_post_eob,
                      insurancePostEobColor,
                      insurancePostEobBg,
                      row?.post_eob_row_count
                    )}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className="text-muted-foreground text-[10px] italic">
                      {fmtPct(row?.insurance_collection_rate_all) ?? 'N/A'}
                    </span>
                    <span className="block text-[9px] text-muted-foreground/70">All Rows — includes estimates</span>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.claim_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.claims_accepted ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.claims_payrecvd ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.claims_settled ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">
                    {row?.avg_days_since_claim_sent !== null && row?.avg_days_since_claim_sent !== undefined
                      ? Number(row?.avg_days_since_claim_sent)?.toFixed(1)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.pre_eob_row_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{row?.post_eob_row_count ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-blue-50/50 border-t border-blue-100 flex items-start gap-2">
          <Icon name="Info" size={12} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-blue-800 leading-relaxed">
            <strong>POST-EOB Collection Rate</strong> is based on adjudicated rows and is the primary insurance collection metric.{' '}
            <strong>All Rows Rate</strong> includes pre-EOB estimates and may exceed 100% when Dentrix zeroes current insurance portion after payment — treat as secondary indicator only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuarantorReconciliationTab;
