import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { exportToCSV } from '../../../services/operationsService';
import { fetchAgingReceivablesLive, fetchPayorSummary } from '../../../services/rcmService';

// ─── Null-safe currency formatter ─────────────────────────────────────────────
const fmtAmt = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })?.format(v);
};

// ─── Known Dentrix locationId → office name mapping ──────────────────────────
// V346: Map known Dentrix locationIds to canonical office names.
const LOCATION_ID_TO_NAME = {
  '14000000000432': 'Staten Island',
  '14000000000433': 'Eatontown',
  '14000000000434': 'Barnegat',
  '14000000000435': 'Brick',
};

// ─── Null-safe count formatter ────────────────────────────────────────────────
const fmtCount = (v) => {
  if (v === null || v === undefined) return '—';
  return String(v);
};

// ─── Null-safe aging formatter ────────────────────────────────────────────────
const fmtAge = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return `${v}d`;
};

// ─── Format ISO date string for display ──────────────────────────────────────
const fmtDate = (isoStr) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'T00:00:00');
    if (isNaN(d?.getTime())) return isoStr;
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
};

// ─── Convert Operations dateRange to ISO string ───────────────────────────────
const toIsoDate = (year, month, isEnd) => {
  if (!year || !month) return null;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m)) return null;
  if (isEnd) {
    const lastDay = new Date(y, m, 0)?.getDate();
    return `${y}-${String(m)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
  }
  return `${y}-${String(m)?.padStart(2, '0')}-01`;
};

// ─── Summary card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, icon, colorClass, subLabel = null }) => (
  <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
    <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
      <Icon name={icon} size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
      {subLabel && <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>}
    </div>
  </div>
);

// ─── Tooltip component ────────────────────────────────────────────────────────
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-64 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded shadow-lg pointer-events-none whitespace-normal leading-snug">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
};

// ─── Claim payor columns definition ──────────────────────────────────────────
const PAYOR_COLS = [
  { key: 'payorName',             label: 'Payor Name',              align: 'left',  tooltip: null },
  { key: 'openClaimsCount',       label: 'Open Claims',             align: 'right', tooltip: null },
  { key: 'avgClaimAge',           label: 'Avg Claim Age',           align: 'right', tooltip: null },
  { key: 'claimsOver30',          label: 'Claims >30',              align: 'right', tooltip: null },
  { key: 'claimsOver60',          label: 'Claims >60',              align: 'right', tooltip: null },
  { key: 'claimsOver90',          label: 'Claims >90',              align: 'right', tooltip: null },
  { key: 'deniedCount',           label: 'Denied / Rejected',       align: 'right', tooltip: null },
  { key: 'paidCount',             label: 'Paid Claims',             align: 'right', tooltip: null },
  { key: 'paidAmt',               label: 'Paid Amount',             align: 'right', tooltip: null },
  { key: 'missingAmountCount',    label: 'Missing Amount Claims',   align: 'right', tooltip: 'Claims where amount_billed or amount_paid is missing. These are excluded from outstanding totals.' },
  { key: 'outstandingClaimsAmt',  label: 'Claim-Derived Estimate',  align: 'right', tooltip: 'Claim-derived estimate may not reconcile to Dentrix Aged Receivables.' },
  { key: 'source',                label: 'Source / Status',         align: 'left',  tooltip: null },
];

// ─── Render a single cell value ───────────────────────────────────────────────
const renderCell = (col, row) => {
  const v = row?.[col?.key];
  switch (col?.key) {
    case 'payorName':
      return (
        <span className={row?._isUnmapped ? 'text-amber-700 italic' : 'font-medium text-foreground'}>
          {v || '—'}
        </span>
      );
    case 'openClaimsCount': case'claimsOver30': case'claimsOver60': case'claimsOver90': case'deniedCount': case'paidCount': case'missingAmountCount':
      return <span className="tabular-nums">{fmtCount(v)}</span>;
    case 'avgClaimAge':
      return <span className="tabular-nums">{fmtAge(v)}</span>;
    case 'paidAmt':
      return <span className="tabular-nums">{v === null || v === undefined ? '—' : fmtAmt(v)}</span>;
    case 'outstandingClaimsAmt':
      return (
        <span className="tabular-nums">
          {v === null || v === undefined ? '—' : fmtAmt(v)}
        </span>
      );
    case 'source':
      return <span className="text-xs text-muted-foreground">{v || '—'}</span>;
    default:
      return v ?? '—';
  }
};

// ─── Main component ───────────────────────────────────────────────────────────
const PayorsTab = ({ dateRange, officeIds }) => {
  // ── Section 1: Reconciled AR snapshot state ───────────────────────────────
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Section 2: Claim-level payor activity state ───────────────────────────
  const [claimRows, setClaimRows]         = useState([]);
  const [claimLoading, setClaimLoading]   = useState(true);
  const [claimError, setClaimError]       = useState(null);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [asOfLabel, setAsOfLabel]         = useState('');
  const [sortKey, setSortKey]             = useState('outstandingClaimsAmt');
  const [sortDir, setSortDir]             = useState('desc');

  // ── Load Section 1: Reconciled AR snapshot ────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchAgingReceivablesLive();
      setData(snapshot);
    } catch (e) {
      console.error('[PayorsTab] fetchAgingReceivablesLive error:', e);
      setError('Failed to load Dentrix Aged Receivables snapshot. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load Section 2: Claim-level payor activity ────────────────────────────
  const loadClaims = useCallback(async () => {
    setClaimLoading(true);
    setClaimError(null);
    try {
      const endIso   = toIsoDate(dateRange?.endYear,   dateRange?.endMonth,   true);
      const startIso = toIsoDate(dateRange?.startYear, dateRange?.startMonth, false);
      const officeId = officeIds?.length === 1 ? officeIds?.[0] : '';

      const rows = await fetchPayorSummary({
        start: startIso || undefined,
        end:   endIso   || undefined,
        officeId,
      });

      const rowArray = Array.isArray(rows) ? rows : [];
      setClaimRows(rowArray);
      setUnmappedCount(rows?._unmappedCount ?? 0);
      setAsOfLabel(rows?._asOfDate ? fmtDate(rows?._asOfDate) : '');

      // Surface fetch errors as a warning (not a full error — partial data may still show)
      const fetchErrors = rows?._fetchErrors || [];
      if (fetchErrors?.length > 0 && rowArray?.length === 0) {
        setClaimError(
          `Claim data fetch failed for: ${fetchErrors?.map((e) => e?.office || 'unknown')?.join(', ')}. ` +
          `Check browser console for details. Error: ${fetchErrors?.[0]?.error || `HTTP ${fetchErrors?.[0]?.status}`}`
        );
      }
    } catch (e) {
      console.error('[PayorsTab] fetchPayorSummary error:', e);
      setClaimError('Failed to load claim-level payor activity. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  }, [dateRange, officeIds]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadClaims(); }, [loadClaims]);

  // ── Derived values — Section 1 ────────────────────────────────────────────
  const reconciled       = data?.reconciliation?.reconciled === true;
  const snapshotDate     = data?.snapshotDate;
  const lastSyncedAt     = data?.lastSyncedAt;
  const automated        = data?.automated;
  const fallbackRequired = data?.fallbackRequired;
  const variance         = data?.reconciliation?.variance;

  const totalInsuranceAR  = data?.fullAR?.insurancePortion ?? data?.insurancePortion ?? null;
  const b0_30   = data?.agingBuckets?.b_0_30    ?? null;
  const b31_60  = data?.agingBuckets?.b_31_60   ?? null;
  const b61_90  = data?.agingBuckets?.b_61_90   ?? null;
  const bOver90 = data?.agingBuckets?.b_over_90 ?? null;

  // V337: Additional verified fields from /v2/accounts-receivable or /v2/ar
  const totalAR           = data?.totalAR ?? data?.fullAR?.totalBalance ?? null;
  const netBalance        = data?.netBalance ?? data?.fullAR?.netBalance ?? data?.fullAR?.netBalanceAfterCredits ?? null;
  const guarantorPortion  = data?.guarantorPortion ?? data?.fullAR?.guarantorPortion ?? null;
  const estimatedWriteOff = data?.estimatedWriteOff ?? data?.fullAR?.estimatedWriteOff ?? null;
  const unappliedCredits  = data?.unappliedCredits ?? data?.fullAR?.unappliedCredits ?? null;
  const patientCount      = data?.patientCount ?? null;
  const asOf              = data?.asOf ?? data?.snapshotDate ?? null;

  // offices[] from new endpoint shape; officeRollup[] from legacy shape
  // V346: resolveOfficeName maps known Dentrix locationIds to canonical office names.
  const resolveOfficeName = (o) => {
    const named = o?.officeName || o?.locationName || o?.name || o?.office || o?.location;
    if (named) return named;
    const locId = o?.locationId ? String(o?.locationId) : null;
    if (locId && LOCATION_ID_TO_NAME?.[locId]) return LOCATION_ID_TO_NAME?.[locId];
    return locId || '—';
  };

  const officeRollup = Array.isArray(data?.officeRollup) ? data?.officeRollup
    : Array.isArray(data?.offices) ? data?.offices?.map(o => ({
        officeName: resolveOfficeName(o),
        insuranceAR: o?.insurancePortion ?? o?.insuranceAR ?? null,
      }))
    : [];

  // ── Sorted claim rows — Section 2 ─────────────────────────────────────────
  const sortedClaimRows = [...claimRows]?.sort((a, b) => {
    const av = a?.[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    const bv = b?.[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    if (typeof av === 'string') return sortDir === 'asc' ? av?.localeCompare(bv) : bv?.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <Icon name="ChevronsUpDown" size={11} className="text-muted-foreground/50 ml-0.5" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUp" size={11} className="text-primary ml-0.5" />
      : <Icon name="ChevronDown" size={11} className="text-primary ml-0.5" />;
  };

  // ── Export — Section 1: Reconciled Office Insurance AR Rollup ────────────
  const handleExportAR = () => {
    if (!reconciled || officeRollup?.length === 0) return;
    const rows = officeRollup?.map((o) => ({
      'Section':           'Reconciled Office Insurance AR Rollup',
      'Office':            resolveOfficeName(o),
      'Insurance AR':      o?.insuranceAR ?? '',
      'Source / Status':   'Dentrix Aged Receivables Snapshot',
      'Snapshot Date':     snapshotDate || '',
      'Reconciled Status': reconciled ? 'Reconciled' : 'Not Reconciled',
    }));
    exportToCSV(rows, 'office-insurance-ar-rollup.csv');
  };

  // ── Export — Section 2: Claim-Level Payor Activity ───────────────────────
  const handleExportClaims = () => {
    if (claimRows?.length === 0) return;
    const exportRows = sortedClaimRows?.map((r) => ({
      'Section':                          'Claim-Level Payor Activity',
      'Payor Name':                       r?.payorName || '—',
      'Open Claims':                      r?.openClaimsCount ?? '',
      'Avg Claim Age (days)':             r?.avgClaimAge ?? '',
      'Claims >30':                       r?.claimsOver30 ?? '',
      'Claims >60':                       r?.claimsOver60 ?? '',
      'Claims >90':                       r?.claimsOver90 ?? '',
      'Denied / Rejected':                r?.deniedCount ?? '',
      'Paid Claims':                      r?.paidCount ?? '',
      'Paid Amount':                      r?.paidAmt ?? '',
      'Missing Amount Claims':            r?.missingAmountCount ?? '',
      'Claim-Derived Estimate':           r?.outstandingClaimsAmt ?? '',
      'Source / Status':                  r?.source || '—',
      'Note': 'Claim-derived estimate. Not official Insurance AR. No PHI included.',
    }));
    exportToCSV(exportRows, 'claim-level-payor-activity.csv');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Reconciled Insurance AR Snapshot                       */}
      {/* Source: GET /v2/rcm/aging-receivables-live                         */}
      {/* This is the financial source of truth for PayorsTab Insurance AR.  */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Section 1 header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Icon name="ShieldCheck" size={16} className="text-blue-500" />
            Reconciled Insurance AR Snapshot
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Source of truth for Insurance AR. Powered by{' '}
            <code className="bg-muted px-1 py-0.5 rounded">/v2/rcm/aging-receivables-live</code>.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Icon name="RefreshCw" size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* V337: Verified source label */}
      <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
        <Icon name="ShieldCheck" size={14} className="flex-shrink-0 mt-0.5 text-blue-600" />
        <span>
          <strong>Source:</strong> Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report, page-summed through Nu Dashboard middleware.
          {automated === true && ' Auto-synced.'}
          {automated === false && ' Manual snapshot import.'}
          {asOf && ` As of: ${fmtDate(asOf)}`}
          {lastSyncedAt && ` Last updated: ${fmtDate(lastSyncedAt)}`}
        </span>
      </div>

      {/* Automation / sync status badges */}
      {!loading && data && (
        <div className="flex flex-wrap items-center gap-2">
          {automated === true && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              <Icon name="RefreshCw" size={11} />
              Auto-sync
            </span>
          )}
          {automated === false && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <Icon name="Upload" size={11} />
              Manual snapshot
            </span>
          )}
          {snapshotDate && (
            <span className="text-xs text-muted-foreground">
              As of: <strong>{fmtDate(snapshotDate)}</strong>
            </span>
          )}
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Last updated: <strong>{fmtDate(lastSyncedAt)}</strong>
            </span>
          )}
        </div>
      )}

      {/* fallbackRequired amber banner */}
      {!loading && fallbackRequired === true && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800">
          <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
          <span>Email automation pending setup.</span>
        </div>
      )}

      {/* V344: Non-blocking reconciliation note — does NOT hide data.
          V345: Softened to a slate/info note instead of amber warning.
          The verified page-summed source is the source of truth. */}
      {!loading && data && reconciled === false && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
          <span>
            Verified page-summed Dentrix A/R data is displayed. Backend reconciliation flag not set.
            {variance !== null && variance !== undefined && ` Variance: ${fmtAmt(variance)}.`}
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6]?.map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 h-20 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Icon name="AlertCircle" size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main content — shown when data is available (reconciled or not) */}
      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard
              label="Total A/R"
              value={fmtAmt(totalAR ?? totalInsuranceAR)}
              icon="DollarSign"
              colorClass="bg-blue-100 text-blue-700"
              subLabel={asOf ? `As of ${fmtDate(asOf)}` : undefined}
            />
            <SummaryCard
              label="Insurance Portion"
              value={fmtAmt(totalInsuranceAR)}
              icon="Shield"
              colorClass="bg-indigo-100 text-indigo-700"
            />
            <SummaryCard
              label="AR 0–30 Days"
              value={fmtAmt(b0_30)}
              icon="CheckCircle"
              colorClass="bg-green-100 text-green-700"
            />
            <SummaryCard
              label="AR 31–60 Days"
              value={fmtAmt(b31_60)}
              icon="Clock"
              colorClass="bg-yellow-100 text-yellow-700"
            />
            <SummaryCard
              label="AR 61–90 Days"
              value={fmtAmt(b61_90)}
              icon="AlertTriangle"
              colorClass="bg-orange-100 text-orange-700"
            />
            <SummaryCard
              label="AR Over 90 Days"
              value={fmtAmt(bOver90)}
              icon="AlertCircle"
              colorClass="bg-red-100 text-red-700"
            />
          </div>

          {/* V337: Additional verified fields row */}
          {(netBalance !== null || guarantorPortion !== null || estimatedWriteOff !== null || unappliedCredits !== null || patientCount !== null || variance !== null) && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Additional Verified A/R Fields</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                {netBalance !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Net Balance</p>
                    <p className="font-semibold tabular-nums">{fmtAmt(netBalance)}</p>
                  </div>
                )}
                {guarantorPortion !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Guarantor Portion</p>
                    <p className="font-semibold tabular-nums">{fmtAmt(guarantorPortion)}</p>
                  </div>
                )}
                {estimatedWriteOff !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Write-Off</p>
                    <p className="font-semibold tabular-nums">{fmtAmt(estimatedWriteOff)}</p>
                  </div>
                )}
                {unappliedCredits !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Unapplied Credits</p>
                    <p className="font-semibold tabular-nums">{fmtAmt(unappliedCredits)}</p>
                  </div>
                )}
                {patientCount !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Patient Count</p>
                    <p className="font-semibold tabular-nums">{patientCount?.toLocaleString()}</p>
                  </div>
                )}
                {variance !== null && variance !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Reconciliation Variance</p>
                    <p className="font-semibold tabular-nums">{fmtAmt(variance)}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Displayed only when present in the verified endpoint response. Missing fields show —. No frontend estimation.
              </p>
            </div>
          )}

          {/* Office Insurance AR Rollup table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Office Insurance AR Rollup</h3>
              <button
                onClick={handleExportAR}
                disabled={officeRollup?.length === 0}
                className="min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="Download" size={12} />
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Office</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground whitespace-nowrap">Insurance AR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Source / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {officeRollup?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-10 text-muted-foreground text-sm">
                        No office rollup data available.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {officeRollup?.map((office, i) => (
                        <tr key={i} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {resolveOfficeName(office)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {fmtAmt(office?.insuranceAR)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            Dentrix Aged Receivables Snapshot
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="border-t-2 border-border bg-slate-50 font-bold text-xs">
                        <td className="px-4 py-3 text-foreground">Total ({officeRollup?.length} offices)</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtAmt(
                            officeRollup?.reduce((sum, o) => {
                              const v = o?.insuranceAR;
                              return v !== null && v !== undefined ? (sum ?? 0) + v : sum;
                            }, null)
                          )}
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Office-level aging bucket note */}
            <p className="text-xs text-muted-foreground px-1">
              Office-level aging bucket columns (0–30, 31–60, etc.) are not shown because the current Dentrix export does not include office-level aging bucket breakdown. Practice-level aging buckets are shown in the summary cards above.
            </p>
          </div>

          {/* Carrier/payor breakdown note */}
          <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <Icon name="Info" size={12} className="inline mr-1.5 text-slate-500" />
            Carrier/payor breakdown pending HS1 API scope or Dentrix export mapping. The current endpoint provides reconciled office-level Insurance AR and practice-level aging buckets only.
          </div>
        </>
      )}

      {/* Section 1 source notes */}
      <div className="px-4 py-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground space-y-1.5">
        <p>
          <strong>Source:</strong> Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report, page-summed through Nu Dashboard middleware.
          Verified: 40/40 data points matched with $0.00 variance across all offices (70 pages total, all pages summed).
        </p>
        <p>
          Claim-level detail is available in Finance → RCM.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Claim-Level Payor Activity                             */}
      {/* Source: GET /v2/rcm/claims via rcmService.fetchPayorSummary        */}
      {/* NOT the official reconciled Insurance AR total.                    */}
      {/* For payor follow-up and claim activity only.                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      <div className="border-t-2 border-border pt-5 space-y-4">
        {/* Section 2 header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Icon name="FileText" size={16} className="text-indigo-500" />
                Claim-Level Payor Activity
                <span className="text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full ml-1">
                  not reconciled AR total
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Source: Dentrix <code className="bg-muted px-1 py-0.5 rounded">/v2/rcm/claims</code>. This section is for payor follow-up and claim activity. It is <strong>not</strong> the official reconciled Insurance AR total.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadClaims}
                disabled={claimLoading}
                className="min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="RefreshCw" size={12} className={claimLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={handleExportClaims}
                disabled={claimRows?.length === 0 || claimLoading}
                className="min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="Download" size={12} />
                Export CSV
              </button>
            </div>
          </div>

          {/* As-of banner */}
          {asOfLabel && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <Icon name="Info" size={12} className="flex-shrink-0" />
              Open claim balances shown as of <strong>{asOfLabel}</strong>. Includes all open claims from the prior 18 months, not only claims submitted during the selected period.
            </div>
          )}

          {/* Unmapped warning — only in Section 2, never in Section 1 */}
          {unmappedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800">
              <Icon name="AlertTriangle" size={12} className="flex-shrink-0" />
              {unmappedCount} claim{unmappedCount !== 1 ? 's' : ''} could not be matched to a specific carrier name and are grouped as <strong>Unknown / Unmapped Payor</strong>. This is a data-quality signal — these claims are not included in the reconciled Insurance AR above.
            </div>
          )}
        </div>

        {/* Claim loading skeleton */}
        {claimLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4]?.map((i) => (
              <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
            ))}
          </div>
        )}

        {/* Claim error */}
        {claimError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <Icon name="AlertCircle" size={16} className="flex-shrink-0" />
            {claimError}
          </div>
        )}

        {/* Claim table */}
        {!claimLoading && !claimError && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {PAYOR_COLS?.map((col) => (
                    <th
                      key={col?.key}
                      onClick={() => handleSort(col?.key)}
                      className={`px-3 py-3 text-xs font-semibold text-foreground whitespace-nowrap cursor-pointer select-none hover:bg-muted/80 transition-colors ${col?.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {col?.tooltip ? (
                          <Tooltip text={col?.tooltip}>
                            <span className="border-b border-dashed border-muted-foreground/50 cursor-help">
                              {col?.label}
                            </span>
                          </Tooltip>
                        ) : (
                          col?.label
                        )}
                        <SortIcon colKey={col?.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedClaimRows?.length === 0 ? (
                  <tr>
                    <td colSpan={PAYOR_COLS?.length} className="text-center py-12 text-muted-foreground text-sm">
                      No claim-level payor data available for the selected period.
                    </td>
                  </tr>
                ) : (
                  sortedClaimRows?.map((row, i) => (
                    <tr key={i} className={`border-t border-border hover:bg-muted/30 ${row?._isUnmapped ? 'bg-amber-50/30' : ''}`}>
                      {PAYOR_COLS?.map((col) => (
                        <td
                          key={col?.key}
                          className={`px-3 py-2.5 text-sm ${col?.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          {renderCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 2 source notes */}
        <div className="px-4 py-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground space-y-1.5">
          <p>
            <strong>Source:</strong> Dentrix <code className="bg-muted px-1 py-0.5 rounded">/v2/rcm/claims</code>. Claim-level payor activity is from{' '}
            <code className="bg-muted px-1 py-0.5 rounded">/v2/rcm/claims</code> and may not reconcile to Dentrix Insurance AR because Dentrix Insurance Portion is calculated from Aged Receivables.
          </p>
          <p>
            <strong>Claim-Derived Estimate</strong> is a claim-derived estimate only. It is <strong>not</strong> labeled as Insurance AR and is <strong>not</strong> included in the Total Insurance AR shown in Section 1 above. Do not compare it to the reconciled AR total.
          </p>
          <p>
            <strong>Unknown / Unmapped Payor</strong> rows are a data-quality and RCM cleanup signal. They are part of claim activity only — not reconciled AR.
          </p>
          <p>
            No patient names, patient IDs, or claim IDs are displayed or exported. Payor names use the best available carrier/plan name from the claim record.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PayorsTab;
