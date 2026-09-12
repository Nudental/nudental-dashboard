import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchClaimSubmissions, fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_BASIS_OPTIONS = [
  { value: 'serviceDate',  label: 'Service Date',   note: 'Claims for services performed in the selected period.' },
  { value: 'sentDate',     label: 'Submitted Date', note: 'Claims electronically sent/submitted in the selected period.' },
  { value: 'createdDate',  label: 'Created Date',   note: 'Claims created in Dentrix in the selected period.' },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const NORMALIZED_STATUS_OPTIONS = [
  { value: '',                        label: 'All Statuses' },
  { value: 'unsent',                  label: 'Unsent / Pending Submission' },
  { value: 'ready_to_send',           label: 'Ready to Send' },
  { value: 'submitted',               label: 'Submitted' },
  { value: 'printed_mailed',          label: 'Printed / Mailed' },
  { value: 'accepted_open',           label: 'Accepted / Open' },
  { value: 'additional_info_requested', label: 'Additional Info Requested' },
  { value: 'unprocessable',           label: 'Needs Correction / Unprocessable' },
  { value: 'settled',                 label: 'Settled' },
  { value: 'paid_closed',             label: 'Paid / Closed' },
  { value: 'rejected',                label: 'Rejected' },
  { value: 'deleted',                 label: 'Deleted' },
  { value: 'unknown',                 label: 'Unknown' },
];

const STATUS_BADGE_COLORS = {
  unsent:                    'bg-slate-100 text-slate-600',
  ready_to_send:             'bg-blue-50 text-blue-600',
  submitted:                 'bg-blue-100 text-blue-700',
  printed_mailed:            'bg-indigo-100 text-indigo-700',
  accepted_open:             'bg-cyan-100 text-cyan-700',
  additional_info_requested: 'bg-amber-100 text-amber-700',
  unprocessable:             'bg-orange-100 text-orange-700',
  settled:                   'bg-teal-100 text-teal-700',
  paid_closed:               'bg-green-100 text-green-700',
  rejected:                  'bg-red-100 text-red-700',
  deleted:                   'bg-slate-100 text-slate-400',
  unknown:                   'bg-gray-100 text-gray-500',
};

const NORMALIZED_STATUS_LABELS = {
  unsent:                    'Unsent',
  ready_to_send:             'Ready to Send',
  submitted:                 'Submitted',
  printed_mailed:            'Printed / Mailed',
  accepted_open:             'Accepted / Open',
  additional_info_requested: 'Additional Info Requested',
  unprocessable:             'Needs Correction',
  settled:                   'Settled',
  paid_closed:               'Paid / Closed',
  rejected:                  'Rejected',
  deleted:                   'Deleted',
  unknown:                   'Unknown',
};

const EXPORT_COLUMNS = [
  { key: 'claim_id',                  label: 'Claim ID' },
  { key: 'patient_id',                label: 'Patient ID' },
  { key: 'patient_name',              label: 'Patient' },
  { key: 'office',                    label: 'Office' },
  { key: 'provider_name',             label: 'Provider' },
  { key: 'payor',                     label: 'Carrier / Payor' },
  { key: 'group_plan_name',           label: 'Group Plan' },
  { key: 'member_id',                 label: 'Member ID' },
  { key: 'service_date',              label: 'Service Date' },
  { key: 'claim_created_date',        label: 'Created On' },
  { key: 'claim_submitted_date',      label: 'Submitted/Sent Date' },
  { key: 'claim_last_modified_date',  label: 'Last Modified' },
  { key: 'raw_claim_state',           label: 'Raw Dentrix State' },
  { key: 'normalized_claim_status',   label: 'Status' },
  { key: 'is_predetermination',       label: 'Pre-Auth/Predet' },
  { key: 'submission_method',         label: 'Submission Method' },
  { key: 'total_billed',              label: 'Total Billed' },
  { key: 'insurance_paid_to_date',    label: 'Insurance Paid to Date' },
  { key: 'writeoff_amount',           label: 'Write-Off Amount' },
  { key: 'estimated_insurance_balance', label: 'Est. Insurance Balance' },
  { key: 'days_since_service',        label: 'Days Since Service' },
  { key: 'days_since_submitted',      label: 'Days Since Submitted' },
  { key: 'submitted_within_24h',      label: 'Submitted Within 24h' },
  { key: 'aging_bucket_service',      label: 'Aging Bucket (Service)' },
  { key: 'aging_bucket_submitted',    label: 'Aging Bucket (Submitted)' },
  { key: 'claim_followup_action',     label: 'Follow-Up Action' },
  { key: 'followup_due_date',         label: 'Follow-Up Due Date' },
  { key: 'message_text',              label: 'Claim Message' },
  { key: 'status_message',            label: 'Status Message' },
  { key: 'etrans_claim_id',           label: 'eTrans Claim ID' },
  { key: 'payer_requested_resubmit',  label: 'Payer Requested Resubmit' },
  { key: 'payer_requested_void',      label: 'Payer Requested Void' },
  { key: 'resubmit_date',             label: 'Resubmit Date' },
  { key: 'has_attachment',            label: 'Has Attachment' },
  { key: 'attachment_status',         label: 'Attachment Status' },
  { key: 'payment_count',             label: 'Payment Count' },
  { key: 'last_payment_date',         label: 'Last Payment Date' },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

const fmtNA = (v) => (v === null || v === undefined || v === '') ? '—' : v;
const fmtBool = (v) => (v === true || v === 'true' || v === 1) ? 'Yes' : (v === false || v === 'false' || v === 0) ? 'No' : '—';
const fmtPct = (v) => {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const pct = n > 1 ? n : n * 100;
  return `${pct?.toFixed(1)}%`;
};
const fmtNum = (v) => (v === null || v === undefined) ? '—' : Number(v)?.toLocaleString();

// Helper: is this row unsent?
const isUnsent = (row) =>
  row?.normalized_claim_status === 'unsent' ||
  (row?.raw_claim_state && row?.raw_claim_state?.toUpperCase() === 'UNSENT');

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonRow = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols })?.map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-muted rounded w-full" />
      </td>
    ))}
  </tr>
);

const ScorecardPrimary = ({ label, value, sub, icon, colorClass = 'text-foreground' }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 min-w-0">
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
      {icon && <Icon name={icon} size={13} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${colorClass} leading-tight`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

const ScorecardSecondary = ({ label, value, colorClass = '' }) => (
  <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
    <div className="text-xs text-muted-foreground truncate">{label}</div>
    <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cls = STATUS_BADGE_COLORS?.[status] || 'bg-gray-100 text-gray-500';
  const label = NORMALIZED_STATUS_LABELS?.[status] || status || '—';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const PreAuthBadge = ({ value }) => {
  if (!value && value !== true && value !== 'true' && value !== 1) return null;
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 whitespace-nowrap">
      Pre-Auth
    </span>
  );
};

const Within24hBadge = ({ value }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const yes = value === true || value === 'true' || value === 1;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${yes ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {yes ? '✓ Yes' : '✗ No'}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ClaimSubmissionsTab = ({ dateRange, officeId, refreshKey }) => {
  const requestGeneration = useRef(0);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({});
  const [freshness, setFreshness] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [dateBasis, setDateBasis] = useState('serviceDate');
  const [statusFilter, setStatusFilter] = useState('');
  const [payorFilter, setPayorFilter] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Table UI
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('service_date');
  const [sortDir, setSortDir] = useState('desc');

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (pg = 1) => {
    const generation = ++requestGeneration.current;
    try {
      setLoading(true);
      setError(null);
      setRows([]);
      setSummary({});
      setPagination({});
      setFreshness({});
      const result = await fetchClaimSubmissions({
        start: dateRange?.start,
        end: dateRange?.end,
        dateBasis,
        officeId: officeId || '',
        status: statusFilter || null,
        payor: payorFilter || null,
        page: pg,
        pageSize,
      });
      if (generation !== requestGeneration.current) return;
      setRows(result?.rows || []);
      setSummary(result?.summary || {});
      setPagination(result?.pagination || {});
      setFreshness({
        lastSyncedAt: result?.claimSourceLastSyncedAt,
        lastSyncedDate: result?.claimSourceLastSyncedDate,
        freshnessNote: result?.claimSourceFreshnessNote,
        sameDaySyncWarning: result?.sameDaySyncWarning,
        isSameDayData: result?.isSameDayData,
        asOfDate: result?.asOfDate,
        source: result?.source,
      });
      setPage(pg);
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setError(e?.message || 'Failed to load claim submissions');
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, dateBasis, officeId, statusFilter, payorFilter, pageSize]);

  useEffect(() => {
    load(1);
    return () => { requestGeneration.current += 1; };
  }, [load, refreshKey]);

  // Client-side search on current page
  const filtered = useMemo(() => {
    const q = search?.toLowerCase()?.trim();
    if (!q) return rows;
    return rows?.filter(r =>
      r?.patient_name?.toLowerCase()?.includes(q) ||
      r?.patient_id?.toLowerCase()?.includes(q) ||
      r?.claim_id?.toLowerCase()?.includes(q) ||
      r?.office?.toLowerCase()?.includes(q) ||
      r?.payor?.toLowerCase()?.includes(q) ||
      r?.provider_name?.toLowerCase()?.includes(q) ||
      r?.normalized_claim_status?.toLowerCase()?.includes(q) ||
      r?.raw_claim_state?.toLowerCase()?.includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExport = () => {
    const csv = rowsToCsv(sorted, EXPORT_COLUMNS);
    const officeLabel = officeId ? officeId : 'all-offices';
    downloadCsv(`claim-submissions-${officeLabel}.csv`, csv);
  };

  const totalPages = pagination?.total_pages ?? Math.max(1, Math.ceil((pagination?.total_count ?? pagination?.total_rows ?? 0) / pageSize));
  const totalCount = pagination?.total_count ?? pagination?.total_rows ?? null;
  const dateBasisNote = DATE_BASIS_OPTIONS?.find(o => o?.value === dateBasis)?.note || '';

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* ── Source Freshness Banner ─────────────────────────────────────────── */}
      {freshness?.sameDaySyncWarning && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Icon name="AlertTriangle" size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>
            Claim status reflects Dentrix Ascend claim sync. Same-day submissions may not yet appear if eAssist batch was submitted after the last claim sync.
          </span>
        </div>
      )}
      {/* ── Source Metadata Strip ───────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon name="RefreshCw" size={12} />
          <span className="font-medium">Last claim sync:</span>
          <span>{freshness?.lastSyncedAt ? fmtDate(freshness?.lastSyncedAt) : (freshness?.lastSyncedDate || '—')}</span>
        </span>
        {freshness?.freshnessNote && (
          <span className="flex items-center gap-1.5">
            <Icon name="Info" size={12} />
            <span>{freshness?.freshnessNote}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Icon name="Database" size={12} />
          <span>Source: {freshness?.source || 'dentrix_ascend/insurance_claims'}</span>
        </span>
      </div>
      {/* ── Filters Row ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-end gap-3">
        {/* Date Basis */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Date Basis</label>
          <select
            value={dateBasis}
            onChange={e => { setDateBasis(e?.target?.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            {DATE_BASIS_OPTIONS?.map(o => (
              <option key={o?.value} value={o?.value}>{o?.label}</option>
            ))}
          </select>
          {dateBasisNote && <p className="text-[11px] text-muted-foreground leading-tight">{dateBasisNote}</p>}
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e?.target?.value); setPage(1); }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            {NORMALIZED_STATUS_OPTIONS?.map(o => (
              <option key={o?.value} value={o?.value}>{o?.label}</option>
            ))}
          </select>
        </div>

        {/* Payor Filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-muted-foreground">Payor</label>
          <input
            type="text"
            placeholder="Filter by payor…"
            value={payorFilter}
            onChange={e => setPayorFilter(e?.target?.value)}
            onBlur={() => { if (payorFilter !== '') load(1); }}
            onKeyDown={e => { if (e?.key === 'Enter') load(1); }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          />
        </div>

        {/* Page Size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Page Size</label>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e?.target?.value)); setPage(1); }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            {PAGE_SIZE_OPTIONS?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button
          onClick={() => load(1)}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors mt-auto"
        >
          <Icon name="Search" size={14} />
          Apply
        </button>
      </div>
      {/* ── Primary Scorecards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScorecardPrimary
          label={`Total Claims — ${DATE_BASIS_OPTIONS?.find(o => o?.value === dateBasis)?.label || 'Selected Date Basis'}`}
          value={fmtNum(summary?.total_claims)}
          sub={undefined}
          icon="FileText"
        />
        <ScorecardPrimary
          label="Submitted / Sent"
          value={fmtNum(summary?.submitted_claims)}
          sub={undefined}
          icon="Send"
          colorClass="text-blue-600"
        />
        <ScorecardPrimary
          label="Submitted Within 24h"
          value={fmtNum(summary?.submitted_within_24h_count)}
          sub={summary?.submission_24h_rate != null ? `Rate: ${fmtPct(summary?.submission_24h_rate)}` : undefined}
          icon="Clock"
          colorClass="text-green-600"
        />
        <ScorecardPrimary
          label="24-Hour Submission Rate"
          value={fmtPct(summary?.submission_24h_rate)}
          sub={undefined}
          icon="TrendingUp"
          colorClass="text-teal-600"
        />
      </div>
      {/* ── Secondary Scorecards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <ScorecardSecondary label="Unsent / Pending" value={fmtNum(summary?.unsent_claims)} colorClass="text-slate-600" />
        <ScorecardSecondary label="Needs Correction" value={fmtNum(summary?.unprocessable_claims)} colorClass="text-orange-600" />
        <ScorecardSecondary label="Additional Info Requested" value={fmtNum(summary?.additional_info_requested_claims)} colorClass="text-amber-600" />
        <ScorecardSecondary label="Predeterminations / Pre-Auths" value={fmtNum(summary?.predetermination_claims)} colorClass="text-purple-600" />
        <ScorecardSecondary label="Accepted / Open" value={fmtNum(summary?.accepted_open_claims)} colorClass="text-cyan-600" />
        <ScorecardSecondary label="Paid / Closed" value={fmtNum(summary?.paid_closed_claims)} colorClass="text-green-600" />
        <ScorecardSecondary label="Printed / Mailed" value={fmtNum(summary?.printed_mailed_claims)} colorClass="text-indigo-600" />
        <ScorecardSecondary label="Rejected" value={fmtNum(summary?.rejected_claims)} colorClass="text-red-600" />
      </div>
      {/* ── Aging / Balance Scorecards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ScorecardSecondary label="Claims Over 30 Days" value={fmtNum(summary?.claims_over_30_days)} />
        <ScorecardSecondary label="Claims Over 60 Days" value={fmtNum(summary?.claims_over_60_days)} />
        <ScorecardSecondary label="Claims Over 90 Days" value={fmtNum(summary?.claims_over_90_days)} colorClass="text-red-600" />
        <ScorecardSecondary
          label="Est. Insurance Balance"
          value={
            summary?.total_estimated_insurance_balance != null
              ? fmtCurrency(summary?.total_estimated_insurance_balance)
              : summary?.estimated_insurance_balance != null
              ? fmtCurrency(summary?.estimated_insurance_balance)
              : 'N/A'
          }
          colorClass="text-amber-700"
        />
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2 px-1">
        Scorecards reflect the full selected date range and filters, not the current table page. Estimated insurance balance is claim-derived and is not official A/R — see the AR Aging tab for verified A/R.
      </p>
      {/* ── Table Panel ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search current page (patient, claim, payor, status)…"
              value={search}
              onChange={e => setSearch(e?.target?.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>
          {search && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Searching current page only — use filters above for full-scope filtering
            </span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="Download" size={14} />
            Export CSV (current page)
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[2400px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                {[
                  { key: 'patient_name',              label: 'Patient' },
                  { key: 'patient_id',                label: 'Patient ID' },
                  { key: 'claim_id',                  label: 'Claim ID' },
                  { key: 'office',                    label: 'Office' },
                  { key: 'provider_name',             label: 'Provider' },
                  { key: 'service_date',              label: 'Service Date' },
                  { key: 'claim_created_date',        label: 'Created On' },
                  { key: 'claim_submitted_date',      label: 'Submitted/Sent Date' },
                  { key: 'payor',                     label: 'Carrier / Payor' },
                  { key: 'is_predetermination',       label: 'Claim Type' },
                  { key: 'raw_claim_state',           label: 'Raw Dentrix State' },
                  { key: 'normalized_claim_status',   label: 'Status' },
                  { key: 'claim_followup_action',     label: 'Follow-Up Action' },
                  { key: 'followup_due_date',         label: 'Follow-Up Due' },
                  { key: 'total_billed',              label: 'Total Billed' },
                  { key: 'insurance_paid_to_date',    label: 'Ins. Paid to Date' },
                  { key: 'writeoff_amount',           label: 'Write-Off' },
                  { key: 'estimated_insurance_balance', label: 'Est. Ins. Balance' },
                  { key: 'days_since_service',        label: 'Days Since Service' },
                  { key: 'days_since_submitted',      label: 'Days Since Submitted' },
                  { key: 'submitted_within_24h',      label: 'Within 24h' },
                  { key: 'status_message',            label: 'Status Message' },
                ]?.map(col => (
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
              {loading ? (
                Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} cols={22} />)
              ) : error ? (
                <tr>
                  <td colSpan={22} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td>
                </tr>
              ) : sorted?.length === 0 ? (
                <tr>
                  <td colSpan={22} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No claim records found for the selected date basis and filters.
                  </td>
                </tr>
              ) : (
                sorted?.map((row, idx) => (
                  <tr key={row?.claim_id || idx} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{fmtNA(row?.patient_name)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtNA(row?.patient_id)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">{fmtNA(row?.claim_id)}</td>
                    <td className="px-3 py-2.5 text-card-foreground whitespace-nowrap">{fmtNA(row?.office)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtNA(row?.provider_name)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.service_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.claim_created_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{isUnsent(row) ? '—' : fmtDate(row?.claim_submitted_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={row?.payor || undefined}>
                      {fmtNA(row?.payor)}
                    </td>
                    <td className="px-3 py-2.5">
                      {row?.is_predetermination === true || row?.is_predetermination === 'true' || row?.is_predetermination === 1
                        ? <PreAuthBadge value={true} />
                        : row?.claim_type
                        ? <span className="text-xs text-muted-foreground">{row?.claim_type}</span>
                        : <span className="text-xs text-muted-foreground">Standard</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{fmtNA(row?.raw_claim_state)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row?.normalized_claim_status} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[140px] truncate" title={row?.claim_followup_action || undefined}>
                      {fmtNA(row?.claim_followup_action)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.followup_due_date)}</td>
                    <td className="px-3 py-2.5 text-card-foreground font-medium whitespace-nowrap">{row?.total_billed != null ? fmtCurrency(row?.total_billed) : '—'}</td>
                    <td className="px-3 py-2.5 text-green-700 font-medium whitespace-nowrap">{row?.insurance_paid_to_date != null ? fmtCurrency(row?.insurance_paid_to_date) : '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{row?.writeoff_amount != null ? fmtCurrency(row?.writeoff_amount) : '—'}</td>
                    <td className="px-3 py-2.5 text-amber-700 font-medium whitespace-nowrap">{row?.estimated_insurance_balance != null ? fmtCurrency(row?.estimated_insurance_balance) : '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-center">{fmtNA(row?.days_since_service)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-center">{isUnsent(row) ? '—' : fmtNA(row?.days_since_submitted)}</td>
                    <td className="px-3 py-2.5 text-center">{isUnsent(row) ? <span className="text-muted-foreground">—</span> : <Within24hBadge value={row?.submitted_within_24h} />}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[180px] truncate" title={row?.status_message || row?.message_text || undefined}>
                      {fmtNA(row?.status_message || row?.message_text)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of{' '}
            <span className="font-medium text-foreground">{totalPages}</span>
            {totalCount != null && (
              <span> · {totalCount?.toLocaleString()} total claims</span>
            )}
            {rows?.length > 0 && (
              <span className="ml-2 text-xs">({rows?.length} on this page)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => load(1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >«</button>
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >‹ Prev</button>
            <span className="px-3 py-1 text-xs bg-primary/10 text-primary rounded font-medium">{page}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >Next ›</button>
            <button
              onClick={() => load(totalPages)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >»</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimSubmissionsTab;
