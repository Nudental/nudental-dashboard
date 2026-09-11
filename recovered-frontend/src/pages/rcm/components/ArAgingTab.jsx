/**
 * ArAgingTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * V451: RCM → AR Aging — official source alignment + restricted credits cleanup
 *
 * Official A/R source: GET /v2/rcm/ar-aging-official
 *   (Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report)
 *
 * Layout:
 *  Section A — Official KPI cards (verified Dentrix A/R via /v2/rcm/ar-aging-official)
 *  Section B — Bucket split table (Total / Insurance / Patient × 0-30/31-60/61-90/Over90)
 *  Section C — Donut / pie charts (verified Dentrix A/R aging distribution + office mix)
 *  Section D — Bar charts (office A/R totals, office insurance portion)
 *  Section E — Trend chart (Source: /v2/ar/trend — ar_snapshots)
 *  Section F — Claim Follow-Up Detail (legacy /v2/rcm/ar-aging — NOT official A/R)
 *
 * Unapplied Credits / Billing Review:
 *  - ONLY rendered when backend returns unapplied_credits_visible === true
 *  - If false, missing, or restricted: card is completely hidden — no placeholder, no N/A
 *
 * Date behavior:
 *  - Official AR is as-of current Dentrix Aging Balances report
 *  - Global date filter does NOT apply to official KPI section
 *  - Clear note displayed near official KPI section
 *
 * Office filter:
 *  - All Offices: call /v2/rcm/ar-aging-official with no officeId
 *  - Selected office: pass dashboard officeId (UUID) as officeId param
 *  - Do NOT pass UUID as locationId
 *
 * NOT official A/R:
 *  - /v2/rcm/ar-aging (claim follow-up detail only, Section F)
 *  - /v2/rcm/claims
 *  - /v2/rcm/patient-statements
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { fetchArAging, fetchOfficialArAging, fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';
import VerifiedArTrendChart from './VerifiedArTrendChart';

// ─── Known Dentrix locationId → office name mapping ──────────────────────────
const LOCATION_ID_TO_NAME = {
  '14000000000432': 'Staten Island',
  '14000000000433': 'Eatontown',
  '14000000000434': 'Barnegat',
  '14000000000435': 'Brick',
};

// ─── Bucket config ────────────────────────────────────────────────────────────
export const BUCKETS = [
  { key: 'b_0_30',    label: '0–30',   range: '0–30 days',   color: '#22C55E', bgClass: 'bg-green-100',  textClass: 'text-green-700'  },
  { key: 'b_31_60',   label: '31–60',  range: '31–60 days',  color: '#F59E0B', bgClass: 'bg-amber-100',  textClass: 'text-amber-700'  },
  { key: 'b_61_90',   label: '61–90',  range: '61–90 days',  color: '#FB923C', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { key: 'b_over_90', label: 'Over 90', range: '90+ days',   color: '#EF4444', bgClass: 'bg-red-100',    textClass: 'text-red-700'    },
];

// Legacy bucket keys for claim-level detail table
const LEGACY_BUCKETS = [
  { key: 'current', label: 'Current',  range: '0–29 days',   color: '#22C55E', bgClass: 'bg-green-100',  textClass: 'text-green-700'  },
  { key: 'b30',     label: '30',       range: '30–59 days',  color: '#F59E0B', bgClass: 'bg-amber-100',  textClass: 'text-amber-700'  },
  { key: 'b60',     label: '60',       range: '60–89 days',  color: '#FB923C', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { key: 'b90',     label: '90+',      range: '90+ days',    color: '#EF4444', bgClass: 'bg-red-100',    textClass: 'text-red-700'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAmt = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })?.format(v);
};

const fmtPct = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

const pct = (part, total) => (total > 0 ? ((part / total) * 100)?.toFixed(1) : '0.0');

const resolveOfficeName = (o) => {
  const named = o?.officeName || o?.locationName || o?.name || o?.office || o?.location;
  if (named) return named;
  const locId = o?.locationId ? String(o?.locationId) : null;
  if (locId && LOCATION_ID_TO_NAME?.[locId]) return LOCATION_ID_TO_NAME?.[locId];
  return locId || '—';
};

const bucketLabel = (key) => LEGACY_BUCKETS?.find(b => b?.key === key)?.label || key;
const bucketColor = (key) => LEGACY_BUCKETS?.find(b => b?.key === key)?.color || '#94a3b8';
const bucketBg   = (key) => LEGACY_BUCKETS?.find(b => b?.key === key)?.bgClass || 'bg-muted';
const bucketText = (key) => LEGACY_BUCKETS?.find(b => b?.key === key)?.textClass || 'text-muted-foreground';

// ─── Sub-components ───────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color, onClick, active }) => (
  <button
    onClick={onClick}
    className={`bg-card rounded-xl border p-4 flex items-start gap-3 text-left w-full transition-all
      ${active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={18} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5 truncate">{value}</p>
      {sub != null && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </button>
);

const SkeletonCard = () => (
  <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
    <div className="h-3 bg-muted rounded w-1/2 mb-3" />
    <div className="h-7 bg-muted rounded w-3/4" />
  </div>
);

const SkeletonRow = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols })?.map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
    ))}
  </tr>
);

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload?.[0];
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{d?.name}</p>
      <p className="text-muted-foreground">{fmtAmt(d?.value)}</p>
      <p className="text-muted-foreground">{d?.payload?.pct}% of total</p>
    </div>
  );
};

// ─── Detail table columns ─────────────────────────────────────────────────────
const DETAIL_COLUMNS = [
  { key: 'patient_name',          label: 'Patient' },
  { key: 'patient_id',            label: 'Patient ID' },
  { key: 'office_name',           label: 'Office' },
  { key: 'claim_id',              label: 'Claim ID' },
  { key: 'provider',              label: 'Provider' },
  { key: 'payor',                 label: 'Payor / Plan' },
  { key: 'plan_name',             label: 'Plan' },
  { key: 'date_of_service',       label: 'Date of Service' },
  { key: 'last_statement_date',   label: 'Last Statement' },
  { key: 'last_payment_date',     label: 'Last Payment Date' },
  { key: 'last_payment_amount',   label: 'Last Payment Amt' },
  { key: 'balance',               label: 'Balance' },
  { key: 'bucket_current',        label: 'Current' },
  { key: 'bucket_30',             label: '30' },
  { key: 'bucket_60',             label: '60' },
  { key: 'bucket_90',             label: '90+' },
  { key: 'days_outstanding',      label: 'Days Outstanding' },
  { key: 'aging_bucket',          label: 'Bucket' },
  { key: 'collection_status',     label: 'Collection Status' },
  { key: 'claim_followup_action', label: 'Follow-Up Action' },
  { key: 'payment_arrangement',   label: 'Payment Arrangement' },
];

const PAGE_SIZE = 30;

// ─── Main Component ───────────────────────────────────────────────────────────
const ArAgingTab = ({ dateRange, officeId, refreshKey, offices }) => {
  // ── Official A/R summary state (/v2/rcm/ar-aging-official) ───────────────
  const [arData, setArData]               = useState(null);
  const [arLoading, setArLoading]         = useState(true);
  const [arError, setArError]             = useState(null);

  // ── Legacy claim/patient detail state (NOT official A/R) ─────────────────
  const [rows, setRows]                   = useState([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyError, setLegacyError]     = useState(null);
  const [search, setSearch]               = useState('');
  const [activeBucket, setActiveBucket]   = useState(null);
  const [minBalance, setMinBalance]       = useState('');
  const [sortKey, setSortKey]             = useState('days_outstanding');
  const [sortDir, setSortDir]             = useState('desc');
  const [page, setPage]                   = useState(1);

  // Build office name map from prop
  const officeMap = useMemo(() => {
    const m = {};
    offices?.forEach(o => { m[o.id] = o?.name; });
    return m;
  }, [offices]);

  // ── Load official A/R summary via /v2/rcm/ar-aging-official ──────────────
  // V451: Uses new official endpoint. Passes officeId when selected.
  // All Offices: no officeId param. Does NOT pass UUID as locationId.
  const loadAr = useCallback(async () => {
    setArLoading(true);
    setArError(null);
    try {
      // Pass officeId (UUID) when a specific office is selected; omit for All Offices
      const data = await fetchOfficialArAging(officeId || null);
      setArData(data);
    } catch (e) {
      setArError('Official A/R summary unavailable — /v2/rcm/ar-aging-official did not respond.');
      setArData(null);
    } finally {
      setArLoading(false);
    }
  }, [officeId, refreshKey]);

  // ── Load legacy claim/patient detail ─────────────────────────────────────
  const loadLegacy = useCallback(async () => {
    setLegacyLoading(true);
    setLegacyError(null);
    try {
      const data = await fetchArAging({ start: dateRange?.start, end: dateRange?.end, officeId });
      setRows(data || []);
      setPage(1);
    } catch (e) {
      setLegacyError(e?.message || 'Failed to load claim follow-up detail');
    } finally {
      setLegacyLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => { loadAr(); }, [loadAr]);
  useEffect(() => { loadLegacy(); }, [loadLegacy]);

  // Clear stale data when entering multi-subset mode — removed (single-office only)

  // ── Official A/R derived values ───────────────────────────────────────────
  const verifiedFields = useMemo(() => {
    if (!arData) return null;
    return {
      totalAR:           arData?.totalAR           ?? null,
      netBalance:        arData?.netBalance         ?? null,
      insurancePortion:  arData?.insurancePortion   ?? null,
      guarantorPortion:  arData?.guarantorPortion   ?? null,
      estimatedWriteOff: arData?.estimatedWriteOff  ?? null,
      // Unapplied Credits: only expose when backend explicitly says visible
      unapplied_credits_visible: arData?.unapplied_credits_visible === true,
      unappliedCredits:  arData?.unapplied_credits_visible === true ? (arData?.unappliedCredits ?? null) : null,
      patientCount:      arData?.patientCount ?? null,
      b0_30:             arData?.agingBuckets?.b_0_30    ?? null,
      b31_60:            arData?.agingBuckets?.b_31_60   ?? null,
      b61_90:            arData?.agingBuckets?.b_61_90   ?? null,
      bOver90:           arData?.agingBuckets?.b_over_90 ?? null,
      // Insurance buckets (if returned)
      ins_b0_30:         arData?.insuranceBuckets?.b_0_30    ?? null,
      ins_b31_60:        arData?.insuranceBuckets?.b_31_60   ?? null,
      ins_b61_90:        arData?.insuranceBuckets?.b_61_90   ?? null,
      ins_bOver90:       arData?.insuranceBuckets?.b_over_90 ?? null,
      // Patient/Guarantor buckets (if returned)
      pat_b0_30:         arData?.patientBuckets?.b_0_30    ?? null,
      pat_b31_60:        arData?.patientBuckets?.b_31_60   ?? null,
      pat_b61_90:        arData?.patientBuckets?.b_61_90   ?? null,
      pat_bOver90:       arData?.patientBuckets?.b_over_90 ?? null,
      asOf:              arData?.asOf ?? null,
      lastSyncedAt:      arData?.lastSyncedAt ?? null,
      cacheAge:          arData?.cacheAge ?? null,
    };
  }, [arData]);

  // Whether insurance/patient bucket split table can be shown
  const hasBucketSplit = useMemo(() => {
    if (!verifiedFields) return false;
    return (
      verifiedFields?.ins_b0_30 !== null ||
      verifiedFields?.ins_b31_60 !== null ||
      verifiedFields?.ins_b61_90 !== null ||
      verifiedFields?.ins_bOver90 !== null ||
      verifiedFields?.pat_b0_30 !== null ||
      verifiedFields?.pat_b31_60 !== null ||
      verifiedFields?.pat_b61_90 !== null ||
      verifiedFields?.pat_bOver90 !== null
    );
  }, [verifiedFields]);

  // ── Verified donut chart data (aging distribution) ────────────────────────
  const agingDonutData = useMemo(() => {
    if (!verifiedFields) return [];
    const total = verifiedFields?.totalAR;
    return [
      { name: '0–30 Days',  value: verifiedFields?.b0_30,   color: '#22C55E', pct: pct(verifiedFields?.b0_30,   total) },
      { name: '31–60 Days', value: verifiedFields?.b31_60,  color: '#F59E0B', pct: pct(verifiedFields?.b31_60,  total) },
      { name: '61–90 Days', value: verifiedFields?.b61_90,  color: '#FB923C', pct: pct(verifiedFields?.b61_90,  total) },
      { name: 'Over 90 Days', value: verifiedFields?.bOver90, color: '#EF4444', pct: pct(verifiedFields?.bOver90, total) },
    ]?.filter(d => d?.value !== null && d?.value > 0);
  }, [verifiedFields]);

  // ── Insurance vs Patient/Guarantor donut data ────────────────────────────────────
  const insVsGuar = useMemo(() => {
    if (!verifiedFields) return [];
    return [
      { name: 'Insurance A/R',          value: verifiedFields?.insurancePortion,  color: '#6366f1' },
      { name: 'Patient / Guarantor A/R', value: verifiedFields?.guarantorPortion,  color: '#0ea5e9' },
    ]?.filter(d => d?.value !== null && d?.value > 0);
  }, [verifiedFields]);

  // ── Office bar chart data (from offices[] or officeRollup[]) ─────────────
  const officeBarData = useMemo(() => {
    if (!arData) return [];
    // V452 FIX: by_office[] is now normalized into arData.offices[] by fetchOfficialArAging
    const officeList = Array.isArray(arData?.offices) && arData?.offices?.length > 0
      ? arData?.offices
      : Array.isArray(arData?.officeRollup) ? arData?.officeRollup : [];
    return officeList?.map(o => ({
      name:          o?.officeName || resolveOfficeName(o),
      'Total A/R':   o?.totalAR          ?? null,
      'Insurance':   o?.insurancePortion ?? null,
    }))?.filter(o => o?.['Total A/R'] !== null || o?.['Insurance'] !== null);
  }, [arData]);

  // ── Legacy aggregations (for claim follow-up detail only) ─────────────────
  const legacySummary = useMemo(() => {
    if (rows?.length === 0) return null;
    const totalAR = rows?.reduce((s, r) => s + (r?.balance || 0), 0);
    const current = rows?.reduce((s, r) => s + (r?.bucket_current || 0), 0);
    const b30     = rows?.reduce((s, r) => s + (r?.bucket_30 || 0), 0);
    const b60     = rows?.reduce((s, r) => s + (r?.bucket_60 || 0), 0);
    const b90     = rows?.reduce((s, r) => s + (r?.bucket_90 || 0), 0);
    const avgDays = rows?.length > 0
      ? rows?.reduce((s, r) => s + (r?.days_outstanding || 0), 0) / rows?.length : 0;
    const patients = new Set(rows.map(r => r?.patient_id))?.size;
    return { totalAR, current, b30, b60, b90, avgDays: Math.round(avgDays), patients };
  }, [rows]);

  // ── Legacy detail table filtering ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q   = search?.toLowerCase();
    const min = parseFloat(minBalance) || 0;
    return rows?.filter(r => {
      if (activeBucket && r?.aging_bucket !== activeBucket) return false;
      if (min > 0 && (r?.balance || 0) < min) return false;
      if (q && !(
        r?.patient_name?.toLowerCase()?.includes(q) ||
        r?.patient_id?.toLowerCase()?.includes(q) ||
        r?.claim_id?.toLowerCase()?.includes(q) ||
        r?.office_name?.toLowerCase()?.includes(q) ||
        r?.payor?.toLowerCase()?.includes(q)
      )) return false;
      return true;
    });
  }, [rows, activeBucket, search, minBalance]);

  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted?.length / PAGE_SIZE));
  const paginated  = sorted?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleBucketClick = (bucketKey) => {
    setActiveBucket(prev => prev === bucketKey ? null : bucketKey);
    setPage(1);
  };

  // Export: claim follow-up detail rows only — does NOT include official AR summary or Unapplied Credits
  const handleExport = () => {
    const csv = rowsToCsv(sorted, DETAIL_COLUMNS);
    downloadCsv('ar_aging_claim_followup_detail_export.csv', csv);
  };

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION A — Official KPI Cards                                   */}
      {/* Source: GET /v2/rcm/ar-aging-official                            */}
      {/* V451: Replaces /v2/accounts-receivable → /v2/ar waterfall        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Source banner */}
      <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
        <Icon name="ShieldCheck" size={14} className="flex-shrink-0 mt-0.5 text-blue-600" />
        <div className="flex-1 space-y-1">
          <span>
            <strong>Official A/R Source:</strong> Dentrix Ascend Aging Balances Report via{' '}
            <code className="bg-blue-100 px-1 rounded">/v2/rcm/ar-aging-official</code>
            {verifiedFields?.asOf && ` · As of: ${fmtDate(verifiedFields?.asOf)}`}
            {verifiedFields?.lastSyncedAt && ` · Last updated: ${fmtDate(verifiedFields?.lastSyncedAt)}`}
            {verifiedFields?.cacheAge != null && ` · Cache: ${verifiedFields?.cacheAge}m`}
          </span>
          {/* As-of note — global date filter does not apply */}
          <p className="text-blue-700 font-medium">
            Official Dentrix A/R is current as-of the live Aging Balances report. The global date filter does not apply to this official A/R summary.
          </p>
          {/* Office filter note */}
          {officeId
            ? <p className="text-blue-700">Office filter applies to this official A/R summary.</p>
            : <p className="text-blue-600">Showing all offices (org-wide). Select an office above to filter this official A/R summary.</p>
          }
        </div>
        <button
          onClick={loadAr}
          className="ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded transition-colors"
        >
          <Icon name="RefreshCw" size={11} className={arLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {/* KPI cards loading */}
      {arLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 10 })?.map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {/* KPI cards error */}
      {arError && !arLoading && (
        <div className="bg-card rounded-xl border border-amber-200 p-6 text-center">
          <Icon name="AlertTriangle" size={28} className="text-amber-500 mx-auto mb-2" />
          <p className="text-amber-700 font-medium text-sm">{arError}</p>
          <button onClick={loadAr} className="mt-3 px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:bg-muted">Retry</button>
        </div>
      )}
      {/* KPI cards — official data */}
      {!arLoading && verifiedFields && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard icon="DollarSign"    label="Total A/R"                    color="bg-slate-600"   value={fmtAmt(verifiedFields?.totalAR)}           sub={null} onClick={() => {}} active={false} />
          <KpiCard icon="TrendingUp"    label="Net Balance"                  color="bg-blue-600"    value={fmtAmt(verifiedFields?.netBalance)}         sub={null} onClick={() => {}} active={false} />
          <KpiCard icon="Shield"        label="Insurance A/R"                color="bg-indigo-500"  value={fmtAmt(verifiedFields?.insurancePortion)}   sub={null} onClick={() => {}} active={false} />
          <KpiCard icon="User"          label="Patient / Guarantor A/R"      color="bg-sky-500"     value={fmtAmt(verifiedFields?.guarantorPortion)}   sub={null} onClick={() => {}} active={false} />
          <KpiCard icon="Scissors"      label="Estimated Write-Off"          color="bg-rose-500"    value={fmtAmt(verifiedFields?.estimatedWriteOff)}  sub={null} onClick={() => {}} active={false} />
          <KpiCard icon="CheckCircle2"  label="0–30"                         color="bg-green-500"   value={fmtAmt(verifiedFields?.b0_30)}
            sub={verifiedFields?.totalAR ? `${pct(verifiedFields?.b0_30, verifiedFields?.totalAR)}% of total` : null}
            onClick={() => {}} active={false}
          />
          <KpiCard icon="Clock"         label="31–60"                        color="bg-amber-500"   value={fmtAmt(verifiedFields?.b31_60)}
            sub={verifiedFields?.totalAR ? `${pct(verifiedFields?.b31_60, verifiedFields?.totalAR)}% of total` : null}
            onClick={() => {}} active={false}
          />
          <KpiCard icon="AlertCircle"   label="61–90"                        color="bg-orange-500"  value={fmtAmt(verifiedFields?.b61_90)}
            sub={verifiedFields?.totalAR ? `${pct(verifiedFields?.b61_90, verifiedFields?.totalAR)}% of total` : null}
            onClick={() => {}} active={false}
          />
          <KpiCard icon="AlertTriangle" label="Over 90"                      color="bg-red-500"     value={fmtAmt(verifiedFields?.bOver90)}
            sub={verifiedFields?.totalAR ? `${pct(verifiedFields?.bOver90, verifiedFields?.totalAR)}% of total` : null}
            onClick={() => {}} active={false}
          />
          {verifiedFields?.patientCount !== null && (
            <KpiCard icon="Users" label="Patient Count" color="bg-teal-500"
              value={verifiedFields?.patientCount?.toLocaleString()}
              sub={null} onClick={() => {}} active={false}
            />
          )}
          {/* Unapplied Credits / Billing Review — ONLY rendered when backend says visible */}
          {verifiedFields?.unapplied_credits_visible === true && verifiedFields?.unappliedCredits !== null && (
            <KpiCard icon="CreditCard" label="Unapplied Credits / Billing Review" color="bg-purple-500"
              value={fmtAmt(verifiedFields?.unappliedCredits)}
              sub={null} onClick={() => {}} active={false}
            />
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION B — Bucket Split Table (Total / Insurance / Patient)     */}
      {/* Rows: Total A/R · Insurance A/R · Patient/Guarantor A/R          */}
      {/* Columns: 0–30 · 31–60 · 61–90 · Over 90 · Total                 */}
      {/* Only shown when backend returns insurance/patient bucket splits   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!arLoading && verifiedFields && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">A/R Aging Bucket Split</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Official Dentrix A/R — Total, Insurance, and Patient / Guarantor aging buckets.
            Source: <code className="bg-muted px-1 rounded">/v2/rcm/ar-aging-official</code>
          </p>
          {hasBucketSplit ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">A/R Category</th>
                    {BUCKETS?.map(b => (
                      <th key={b?.key} className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide ${b?.textClass}`}>{b?.label}</th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Total A/R row */}
                  <tr className="hover:bg-muted/40 font-semibold">
                    <td className="px-4 py-3 text-foreground">Total A/R</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtAmt(verifiedFields?.b0_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtAmt(verifiedFields?.b31_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-700">{fmtAmt(verifiedFields?.b61_90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">{fmtAmt(verifiedFields?.bOver90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmtAmt(verifiedFields?.totalAR)}</td>
                  </tr>
                  {/* Insurance A/R row */}
                  <tr className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-foreground">Insurance A/R</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtAmt(verifiedFields?.ins_b0_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtAmt(verifiedFields?.ins_b31_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-700">{fmtAmt(verifiedFields?.ins_b61_90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">{fmtAmt(verifiedFields?.ins_bOver90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmtAmt(verifiedFields?.insurancePortion)}</td>
                  </tr>
                  {/* Patient / Guarantor A/R row */}
                  <tr className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-foreground">Patient / Guarantor A/R</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtAmt(verifiedFields?.pat_b0_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtAmt(verifiedFields?.pat_b31_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-700">{fmtAmt(verifiedFields?.pat_b61_90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">{fmtAmt(verifiedFields?.pat_bOver90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmtAmt(verifiedFields?.guarantorPortion)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Insurance and Patient / Guarantor aging bucket splits not returned by{' '}
              <code className="bg-muted px-1 rounded">/v2/rcm/ar-aging-official</code> for this selection.
              Total A/R buckets are shown in the KPI cards above.
            </div>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION C — Donut / Pie Charts (Verified Dentrix A/R)            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!arLoading && verifiedFields && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* A/R Aging Distribution donut */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">A/R Aging Distribution</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Official Dentrix A/R — 0–30, 31–60, 61–90, Over 90 buckets
            </p>
            {agingDonutData?.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                Aging bucket data not returned by endpoint
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={agingDonutData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={105}
                      paddingAngle={2} dataKey="value"
                    >
                      {agingDonutData?.map((entry, i) => (
                        <Cell key={i} fill={entry?.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<DonutTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center -mt-2">
                  <p className="text-xs text-muted-foreground">Total A/R</p>
                  <p className="text-lg font-bold text-foreground">{fmtAmt(verifiedFields?.totalAR)}</p>
                </div>
              </>
            )}
          </div>

          {/* Insurance vs Patient/Guarantor mix donut */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Insurance vs Patient / Guarantor Mix</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Official Dentrix A/R — Insurance A/R vs Patient / Guarantor A/R
            </p>
            {insVsGuar?.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                Insurance / Patient split not returned by endpoint
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={insVsGuar}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={105}
                      paddingAngle={2} dataKey="value"
                    >
                      {insVsGuar?.map((entry, i) => (
                        <Cell key={i} fill={entry?.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v, name) => [fmtAmt(v), name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center -mt-2">
                  <p className="text-xs text-muted-foreground">Total A/R</p>
                  <p className="text-lg font-bold text-foreground">{fmtAmt(verifiedFields?.totalAR)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION D — Bar Charts (Verified Dentrix A/R by Office)          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!arLoading && verifiedFields && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Office A/R Totals</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Official Dentrix A/R — Total A/R and Insurance A/R by office
          </p>
          {officeBarData?.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              Office-level breakdown not returned by endpoint
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={officeBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000)?.toFixed(0)}k`} />
                <RechartsTooltip formatter={(v, name) => [fmtAmt(v), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Total A/R"  fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Insurance"  fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Office-level aging bucket breakdown not shown — the current endpoint does not return office-level aging buckets.
            Practice-level aging buckets are shown in the KPI cards above.
          </p>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION E — Verified A/R Trend Chart                            */}
      {/* Source: GET /v2/ar/trend (ar_snapshots from HS1 Dentrix Ascend) */}
      {/* V348: Wired to real snapshot history endpoint.                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <VerifiedArTrendChart
        dateRange={dateRange}
        officeId={officeId}
        refreshKey={refreshKey}
      />
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION F — Claim Follow-Up Detail (NOT Official A/R)            */}
      {/* Source: /v2/rcm/ar-aging (claim/patient-level legacy)            */}
      {/* Clearly labeled: Not Official A/R                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="border-t-2 border-dashed border-amber-200 pt-6 space-y-4">
        {/* Section header */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground">Insurance Claim Follow-Up Queue</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Not Official A/R
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Source: /v2/rcm/ar-aging
              </span>
            </div>
            <p className="text-xs text-amber-700 font-medium mt-1">
              Not the official Dentrix A/R report. See Official A/R cards above for aged receivables.
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Source: <code className="bg-muted px-1 rounded">/v2/rcm/ar-aging</code>. This is an operational insurance claim follow-up queue calculated from claim/patient-level records. It is not the official Dentrix Aged Receivables report and should not be compared to official A/R totals.
            </p>
          </div>
          <button
            onClick={loadLegacy}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:bg-muted"
          >
            <Icon name="RefreshCw" size={12} className={legacyLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Legacy summary mini-cards (labeled as claim-derived) */}
        {!legacyLoading && legacySummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Claim-Derived Total',   value: fmtCurrency(legacySummary?.totalAR), color: 'bg-slate-500' },
              { label: 'Current (0–29)',         value: fmtCurrency(legacySummary?.current), color: 'bg-green-500' },
              { label: '30-Day',                 value: fmtCurrency(legacySummary?.b30),     color: 'bg-amber-500' },
              { label: '60-Day',                 value: fmtCurrency(legacySummary?.b60),     color: 'bg-orange-500' },
              { label: '90+ Day',                value: fmtCurrency(legacySummary?.b90),     color: 'bg-red-500' },
              { label: 'Avg Days Outstanding',   value: `${legacySummary?.avgDays} days`,    color: 'bg-blue-500' },
              { label: 'Patients w/ Open Bal.',  value: legacySummary?.patients?.toLocaleString(), color: 'bg-indigo-500' },
            ]?.map((card, i) => (
              <div key={i} className="bg-card rounded-lg border border-amber-100 p-3 flex items-start gap-2">
                <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${card?.color}`}>
                  <Icon name="FileText" size={13} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">{card?.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 tabular-nums">{card?.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legacy loading */}
        {legacyLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 })?.map((_, i) => (
              <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Legacy error */}
        {legacyError && !legacyLoading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <Icon name="AlertTriangle" size={16} className="flex-shrink-0" />
            {legacyError}
          </div>
        )}

        {/* Detail table toolbar */}
        {!legacyLoading && !legacyError && (
          <div className="bg-card rounded-xl border border-amber-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search patient, claim, payor..."
                  value={search}
                  onChange={e => { setSearch(e?.target?.value); setPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Min $</span>
                <input
                  type="number"
                  placeholder="0"
                  value={minBalance}
                  onChange={e => { setMinBalance(e?.target?.value); setPage(1); }}
                  className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => { setActiveBucket(null); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${activeBucket === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  All
                </button>
                {LEGACY_BUCKETS?.map(b => (
                  <button
                    key={b?.key}
                    onClick={() => handleBucketClick(b?.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${activeBucket === b?.key ? `${b?.bgClass} ${b?.textClass}` : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {b?.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Exports claim follow-up queue rows only, not official A/R summary values.</span>
                <button
                  onClick={handleExport}
                  title="Exports claim follow-up queue rows only, not official A/R summary values."
                  className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted whitespace-nowrap"
                >
                  <Icon name="Download" size={14} /> Export Claim Follow-Up Rows
                </button>
              </div>
            </div>

            {/* Detail table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    {DETAIL_COLUMNS?.map(col => (
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
                  {legacyLoading
                    ? Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} cols={DETAIL_COLUMNS?.length} />)
                    : paginated?.length === 0
                      ? (
                        <tr>
                          <td colSpan={DETAIL_COLUMNS?.length} className="px-4 py-12 text-center text-muted-foreground text-sm">
                            No claim follow-up records found for the selected filters
                          </td>
                        </tr>
                      )
                      : paginated?.map((row, idx) => {
                        const bk = row?.aging_bucket;
                        return (
                          <tr key={row?.id || idx} className="hover:bg-muted/50">
                            <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                              {row?.patient_name && row?.patient_name !== 'Unknown'
                                ? row?.patient_name
                                : <span className="text-muted-foreground italic">Unknown — use Patient ID</span>
                              }
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row?.patient_id || '—'}</td>
                            <td className="px-3 py-2.5 text-card-foreground whitespace-nowrap">{row?.office_name || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row?.claim_id || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{row?.provider_name || row?.provider || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate" title={row?.payor_name || row?.payor}>
                              {row?.payor_name || row?.payor || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate" title={row?.plan_name}>
                              {row?.plan_name || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.date_of_service)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.last_statement_date)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.last_payment_date)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.last_payment_amount != null ? fmtCurrency(row?.last_payment_amount) : '—'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{fmtCurrency(row?.balance)}</td>
                            <td className="px-3 py-2.5 text-green-600 font-medium">{fmtCurrency(row?.bucket_current)}</td>
                            <td className="px-3 py-2.5 text-amber-600 font-medium">{fmtCurrency(row?.bucket_30)}</td>
                            <td className="px-3 py-2.5 text-orange-600 font-medium">{fmtCurrency(row?.bucket_60)}</td>
                            <td className="px-3 py-2.5 text-red-600 font-medium">{fmtCurrency(row?.bucket_90)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${bucketBg(bk)} ${bucketText(bk)}`}>
                                {(row?.days_outstanding || 0)?.toLocaleString()}d
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: `${bucketColor(bk)}22`, color: bucketColor(bk) }}
                              >
                                {bucketLabel(bk)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row?.collection_status || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={row?.claim_followup_action}>
                              {row?.claim_followup_action || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">{row?.payment_arrangement || '—'}</td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} &nbsp;·&nbsp; {sorted?.length?.toLocaleString()} records
                {activeBucket && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: `${bucketColor(activeBucket)}22`, color: bucketColor(activeBucket) }}
                    >
                      {bucketLabel(activeBucket)} filter active
                    </span>
                    <button onClick={() => { setActiveBucket(null); setPage(1); }} className="text-xs text-muted-foreground hover:text-foreground ml-1">✕</button>
                  </span>
                )}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                  <Icon name="ChevronLeft" size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                  <Icon name="ChevronRight" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section F source note */}
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
          <p>
            <strong>Source:</strong> <code className="bg-amber-100 px-1 rounded">/v2/rcm/ar-aging</code>. This is an operational insurance claim follow-up queue calculated from claim/patient-level records. It is not the official Dentrix Aged Receivables report and should not be compared to official A/R totals.
          </p>
          <p>
            Export includes claim follow-up queue rows only — not official A/R summary values.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArAgingTab;
