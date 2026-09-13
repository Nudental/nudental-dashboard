/**
 * DentrixDiagnosticsPage.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Admin-only Dentrix Diagnostics & Reconciliation Screen
 *
 * Shows for every major metric:
 *   - Source endpoint name
 *   - Source date field used
 *   - Source office/location mapping
 *   - Raw value
 *   - Normalized value
 *   - Displayed value
 *   - Benchmark workbook value when available
 *   - Last sync timestamp
 *   - Row counts / page counts
 *   - Mismatch flags
 *   - Endpoint health checks
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { ascendApi } from '../../services/ascendApi';
import {
  fetchNormalizedMetrics,
  fetchBenchmarkReconciliation,
  ALL_DENTRIX_OFFICES,
  safeNum,
} from '../../services/dentrixNormalizedService';
import { OFFICE_MAP, LOCATION_ID_MAP } from '../../constants/offices';
import { buildDateRange } from '../../services/metricsService';
import { supabase } from '../../lib/supabase';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// NOTE: backfillReconciliationService exports write-capable functions:
// - upsertMonthlyRow(): upserts into office_production_summary_monthly
// - markRowReconciled(): updates reconciled_at/source in office_production_summary_monthly
// Any future UI action that calls reconciliation write functions such as upsertMonthlyRow()
// or markRowReconciled() must require confirmation and platform audit logging.
// These functions are NOT wired to any UI action on this page.

// ─── eAssist Apr 22 2026 Benchmark Reference ─────────────────────────────────
const EASSIST_BENCHMARK_APR22 = {
  Barnegat: {
    monthly_production: 179783.00, monthly_adj: -122446.89, net_monthly_production: 57336.11,
    total_monthly_coll: 64124.24, collection_ratio: 112, claims_submitted: 12, claim_rate_24h: 100,
    ins_ar_30_60: 3387.12, ins_ar_60_90: 2006.32, ins_ar_over_90: 2006.32,
    pat_ar_30_60: 5987.33, pat_ar_60_90: 5279.24, pat_ar_over_90: 5279.24,
  },
  Brick: {
    monthly_production: 117340.11, monthly_adj: -78499.81, net_monthly_production: 38840.30,
    total_monthly_coll: 91836.89, collection_ratio: 236, claims_submitted: 21, claim_rate_24h: 97.83,
    ins_ar_30_60: 6834.00, ins_ar_60_90: 11338.00, ins_ar_over_90: 11338.00,
    pat_ar_30_60: 8916.00, pat_ar_60_90: 8466.00, pat_ar_over_90: 8466.00,
  },
  Eatontown: {
    monthly_production: 146649.95, monthly_adj: -92721.05, net_monthly_production: 53928.90,
    total_monthly_coll: 65663.35, collection_ratio: 122, claims_submitted: 14, claim_rate_24h: 100,
    ins_ar_30_60: 213.34, ins_ar_60_90: 2471.58, ins_ar_over_90: 2471.58,
    pat_ar_30_60: 5458.10, pat_ar_60_90: 5290.91, pat_ar_over_90: 5290.91,
  },
};

// Endpoint availability map (based on ascendApi.js audit)
const ENDPOINT_AVAILABILITY = {
  production: true,
  adjustments: true,
  net_production: true,
  collections: true,
  insurance_collections: true,
  patient_collections: true,
  claims_submitted: true,
  claim_submission_rate: true,
  claims_sent_electronically: true,
  claims_sent_by_mail: true,
  claims_corrected_resubmitted: true,
  preauths_sent: true,
  ar_aging: true,
  patient_balances: true,
  patient_credits: true,
  claims_followup: true,
  // No endpoints for these:
  eob_scans_24h: false,
  eft_scans_24h: false,
  eob_rate_24h: false,
  eft_rate_24h: false,
  claims_sent_by_fax: false,
  claims_sent_by_portal: false,
  projected_net_production: false,
  projected_total_coll: false,
};

const TOLERANCE = 1.00;
const TOLERANCE_PCT = 5;

const getReconcStatus = (dashVal, benchVal, endpointAvailable = true) => {
  if (!endpointAvailable) return 'ENDPOINT_MISSING';
  if (benchVal == null) return 'NOT_MAPPED';
  if (dashVal == null) return 'FAIL';
  const diff = Math.abs(Number(dashVal) - Number(benchVal));
  const pct = benchVal !== 0 ? (diff / Math.abs(Number(benchVal))) * 100 : 0;
  if (diff <= TOLERANCE) return 'PASS';
  if (pct <= TOLERANCE_PCT) return 'WARNING';
  return 'FAIL';
};

const ReconcBadge = ({ status }) => {
  const cfg = {
    PASS:             { cls: 'bg-emerald-100 text-emerald-700', label: '✓ PASS' },
    WARNING:          { cls: 'bg-amber-100 text-amber-700',     label: '⚠ WARNING' },
    FAIL:             { cls: 'bg-red-100 text-red-700',         label: '✗ FAIL' },
    ENDPOINT_MISSING: { cls: 'bg-slate-100 text-slate-500',     label: 'ENDPOINT MISSING' },
    NOT_MAPPED:       { cls: 'bg-purple-100 text-purple-600',   label: 'NOT MAPPED' },
  }?.[status] || { cls: 'bg-slate-100 text-slate-500', label: status };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg?.cls}`}>{cfg?.label}</span>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFull = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(safeNum(v));
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso)?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtRelative = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso)?.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Error Message Sanitizer ──────────────────────────────────────────────────
// Sanitizes API error messages for display: truncates to 200 chars and redacts
// obvious sensitive patterns. Display-only — does not modify stored data.
const sanitizeEndpointError = (errorMsg) => {
  if (!errorMsg) return null;
  const SENSITIVE_PATTERNS = [
    /token=[^\s&"']*/gi,
    /api_key=[^\s&"']*/gi,
    /authorization:\s*\S+/gi,
    /password=[^\s&"']*/gi,
    /secret=[^\s&"']*/gi,
    /bearer\s+\S+/gi,
    /access_token=[^\s&"']*/gi,
    /refresh_token=[^\s&"']*/gi,
  ];
  let sanitized = String(errorMsg);
  SENSITIVE_PATTERNS?.forEach(pattern => {
    sanitized = sanitized?.replace(pattern, '[redacted]');
  });
  if (sanitized?.length > 200) {
    sanitized = sanitized?.substring(0, 200) + '…';
  }
  return sanitized;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = {
    ok:       { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OK', dot: 'bg-emerald-500' },
    error:    { bg: 'bg-red-100',     text: 'text-red-700',     label: 'ERROR', dot: 'bg-red-500' },
    warning:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'WARN', dot: 'bg-amber-500' },
    checking: { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'CHECKING', dot: 'bg-slate-400 animate-pulse' },
    unknown:  { bg: 'bg-slate-100',   text: 'text-slate-500',   label: '—', dot: 'bg-slate-300' },
  }?.[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status, dot: 'bg-slate-300' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg?.bg} ${cfg?.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
      {cfg?.label}
    </span>
  );
};

// ─── Endpoint Health Card ─────────────────────────────────────────────────────

const EndpointCard = ({ endpoint, status, latencyMs, lastTestedAt, error, locationId, officeName }) => {
  // Sanitize error message before display — truncate to 200 chars and redact sensitive patterns
  const safeError = sanitizeEndpointError(error);
  return (
    <div className={`bg-card border rounded-xl p-4 ${status === 'error' ? 'border-red-200' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{endpoint}</p>
          {officeName && <p className="text-xs text-muted-foreground">{officeName} · locationId: {locationId}</p>}
        </div>
        <StatusBadge status={status} />
      </div>
      {latencyMs !== null && latencyMs !== undefined && (
        <p className="text-xs text-muted-foreground">Latency: {latencyMs}ms</p>
      )}
      {lastTestedAt && (
        <p className="text-xs text-muted-foreground">Last tested: {fmtRelative(lastTestedAt)}</p>
      )}
      {safeError && (
        <p className="text-xs text-red-600 mt-1 truncate" title={safeError}>{safeError}</p>
      )}
    </div>
  );
};

// ─── Metric Lineage Row ───────────────────────────────────────────────────────

const LineageRow = ({ metric, endpoint, dateField, officeMapping, rawValue, normalizedValue, displayedValue, benchmarkValue, lastSync, mismatch }) => (
  <tr className={`border-b border-border text-xs ${mismatch ? 'bg-red-50/30' : 'hover:bg-muted/30'}`}>
    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{metric}</td>
    <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{endpoint || '—'}</td>
    <td className="px-3 py-2.5 text-muted-foreground">{dateField || '—'}</td>
    <td className="px-3 py-2.5 text-muted-foreground">{officeMapping || '—'}</td>
    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{rawValue ?? '—'}</td>
    <td className="px-3 py-2.5 tabular-nums">{normalizedValue ?? '—'}</td>
    <td className="px-3 py-2.5 tabular-nums font-semibold text-foreground">{displayedValue ?? '—'}</td>
    <td className="px-3 py-2.5 tabular-nums text-blue-600">{benchmarkValue ?? '—'}</td>
    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{lastSync ? fmtRelative(lastSync) : '—'}</td>
    <td className="px-3 py-2.5">
      {mismatch !== null && mismatch !== undefined ? (
        mismatch
          ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700"><Icon name="XCircle" size={10} /> MISMATCH</span>
          : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700"><Icon name="CheckCircle2" size={10} /> OK</span>
      ) : <span className="text-muted-foreground">—</span>}
    </td>
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const OFFICE_OPTIONS = [
  { id: '', label: 'All Offices' },
  ...ALL_DENTRIX_OFFICES?.map(o => ({ id: o?.officeId, label: o?.officeName })),
];

const DentrixDiagnosticsPage = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');
  const [metrics, setMetrics] = useState(null);
  const [benchmarkRows, setBenchmarkRows] = useState([]);
  const [endpointHealth, setEndpointHealth] = useState([]);
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('lineage');
  const [supabaseRows, setSupabaseRows] = useState([]);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  useEffect(() => {
    if (userProfile && !isSuperAdmin) {
      navigate('/executive-overview', { replace: true });
    }
  }, [userProfile, isSuperAdmin, navigate]);

  // Additional permission guard
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('admin.reconciliation.view')) {
    return <AccessDenied message="Dentrix Ascend Reconciliation is restricted to Super Administrators." />;
  }

  const dateRange = buildDateRange(datePreset);
  const officeIds = selectedOfficeId ? [selectedOfficeId] : [];
  const officeName = selectedOfficeId ? (OFFICE_MAP?.[selectedOfficeId]?.name || selectedOfficeId) : 'All Offices';
  const locationId = selectedOfficeId ? LOCATION_ID_MAP?.[selectedOfficeId] : null;

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsResult, benchmarkResult, supabaseResult] = await Promise.allSettled([
        fetchNormalizedMetrics({ startDate: dateRange?.startDate, endDate: dateRange?.endDate, officeIds }),
        fetchBenchmarkReconciliation({ officeCanonical: officeName !== 'All Offices' ? officeName : null }),
        supabase?.from('benchmark_eassist_daily_reports_2026')
          ?.select('*')
          ?.order('report_date', { ascending: false })
          ?.limit(100),
      ]);
      if (metricsResult?.status === 'fulfilled') setMetrics(metricsResult?.value);
      if (benchmarkResult?.status === 'fulfilled') setBenchmarkRows(benchmarkResult?.value);
      if (supabaseResult?.status === 'fulfilled') setSupabaseRows(supabaseResult?.value?.data || []);
    } catch (err) {
      console.error('[DentrixDiagnostics] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate, selectedOfficeId]);

  const runEndpointHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    const results = [];
    const today = new Date()?.toISOString()?.split('T')?.[0];

    const checks = [
      { key: 'health', label: '/health', fn: () => ascendApi?.health() },
      { key: 'offices', label: '/v2/offices', fn: () => ascendApi?.getOffices() },
      ...ALL_DENTRIX_OFFICES?.map(o => ({
        key: `production_${o?.officeName}`,
        label: `/v2/production/summary (${o?.officeName})`,
        officeName: o?.officeName,
        locationId: o?.locationId,
        fn: () => ascendApi?.getProduction(dateRange?.startDate, dateRange?.endDate, o?.locationId),
      })),
      ...ALL_DENTRIX_OFFICES?.map(o => ({
        key: `collections_${o?.officeName}`,
        label: `/v2/collections/summary (${o?.officeName})`,
        officeName: o?.officeName,
        locationId: o?.locationId,
        fn: () => ascendApi?.getCollections(dateRange?.startDate, dateRange?.endDate, o?.locationId),
      })),
      ...ALL_DENTRIX_OFFICES?.map(o => ({
        key: `daily_${o?.officeName}`,
        label: `/v2/reports/daily-summary (${o?.officeName})`,
        officeName: o?.officeName,
        locationId: o?.locationId,
        fn: () => ascendApi?.getDailySummary(today, o?.locationId),
      })),
      ...ALL_DENTRIX_OFFICES?.map(o => ({
        key: `adjustments_${o?.officeName}`,
        label: `/v2/adjustments/summary (${o?.officeName})`,
        officeName: o?.officeName,
        locationId: o?.locationId,
        fn: () => ascendApi?.getAdjustmentsSummary(dateRange?.startDate, dateRange?.endDate, o?.locationId),
      })),
    ];

    for (const check of checks) {
      const start = Date.now();
      try {
        await check?.fn();
        results?.push({ ...check, status: 'ok', latencyMs: Date.now() - start, lastTestedAt: new Date()?.toISOString(), error: null });
      } catch (err) {
        results?.push({ ...check, status: 'error', latencyMs: Date.now() - start, lastTestedAt: new Date()?.toISOString(), error: err?.message });
      }
    }

    setEndpointHealth(results);
    setHealthLoading(false);
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  if (!isSuperAdmin) return null;

  // Build full reconciliation matrix
  const buildFullReconcMatrix = () => {
    const bm = EASSIST_BENCHMARK_APR22?.[officeName] || null;
    const rows = [];

    const addRow = (category, metric, endpoint, endpointKey, dashVal, supaVal, benchVal) => {
      const endpointAvail = ENDPOINT_AVAILABILITY?.[endpointKey] !== false;
      const status = getReconcStatus(dashVal, benchVal, endpointAvail);
      const diff = benchVal != null && dashVal != null ? Number(dashVal) - Number(benchVal) : null;
      const diffPct = benchVal != null && benchVal !== 0 && diff != null ? (diff / Math.abs(Number(benchVal))) * 100 : null;
      // Note: supaVal is not currently populated in this diagnostic view (see "Cached Value" column note)
      rows?.push({ category, metric, endpoint, status, dashVal, supaVal, benchVal, diff, diffPct });
    };

    // Production
    addRow('Production', 'Gross Monthly Production', '/v2/production/summary → grossProduction', 'production', metrics?.gross_production_mtd, null, bm?.monthly_production);
    addRow('Production', 'Monthly Production Adjustment', '/v2/adjustments/summary → totalAdjustments', 'adjustments', metrics?.production_adjustments_mtd, null, bm?.monthly_adj);
    addRow('Production', 'Net Monthly Production', '/v2/production/summary → netProduction', 'net_production', metrics?.net_production_mtd, null, bm?.net_monthly_production);
    addRow('Production', 'Projected Net Monthly Production', 'No endpoint available', 'projected_net_production', null, null, null);
    // Collections
    addRow('Collections', 'Monthly Insurance Collections', '/v2/collections/summary → insuranceCollections', 'insurance_collections', metrics?.insurance_collections_mtd, null, null);
    addRow('Collections', 'Monthly Patient Collections', '/v2/collections/summary → patientCollections', 'patient_collections', metrics?.patient_collections_mtd, null, null);
    addRow('Collections', 'Total Monthly Collections', '/v2/collections/summary → totalCollections', 'collections', metrics?.total_collections_mtd, null, bm?.total_monthly_coll);
    addRow('Collections', 'Overall Collection Ratio %', 'Derived: total_coll / net_production', 'collections', metrics?.practice_collection_ratio, null, bm?.collection_ratio);
    addRow('Collections', 'Projected Total Monthly Collections', 'No endpoint available', 'projected_total_coll', null, null, null);
    // Claims
    addRow('Claims', 'Total Claims Submitted (MTD)', '/v2/rcm/claims → count', 'claims_submitted', metrics?.claims_submitted_mtd, null, bm?.claims_submitted);
    addRow('Claims', '24hr Claim Submission Rate %', '/v2/rcm/claims → derived', 'claim_submission_rate', metrics?.claim_submission_rate_24h, null, bm?.claim_rate_24h);
    addRow('Claims', 'Claims Sent Electronically', '/v2/rcm/claims → submissionMethod', 'claims_sent_electronically', metrics?.claims_sent_electronically, null, null);
    addRow('Claims', 'Claims Sent By Mail', '/v2/rcm/claims → submissionMethod', 'claims_sent_by_mail', metrics?.claims_sent_by_mail, null, null);
    addRow('Claims', 'Claims Sent By Fax', 'No endpoint available', 'claims_sent_by_fax', null, null, null);
    addRow('Claims', 'Claims Sent By Portal', 'No endpoint available', 'claims_sent_by_portal', null, null, null);
    addRow('Claims', 'Claims Corrected & Resubmitted', '/v2/rcm/claims → status=corrected', 'claims_corrected_resubmitted', metrics?.claims_corrected_and_resubmitted, null, null);
    addRow('Claims', 'Total Pre-Auths Sent', '/v2/rcm/dashboard → preAuthsSent', 'preauths_sent', metrics?.preauths_sent, null, null);
    // EOB/EFT
    addRow('EOB/EFT Posting', 'EOB Scans Posted w/in 24hr', 'No endpoint available', 'eob_scans_24h', null, null, null);
    addRow('EOB/EFT Posting', 'EFT Scans Posted w/in 24hr', 'No endpoint available', 'eft_scans_24h', null, null, null);
    addRow('EOB/EFT Posting', 'EOB 24hr Rate %', 'No endpoint available', 'eob_rate_24h', null, null, null);
    addRow('EOB/EFT Posting', 'EFT 24hr Rate %', 'No endpoint available', 'eft_rate_24h', null, null, null);
    // Patient Finance
    addRow('Patient Finance', 'Patients with Balances', '/v2/rcm/patient-statements → count(balance>0)', 'patient_balances', metrics?.patients_with_balances_count, null, null);
    addRow('Patient Finance', 'Patients with Credits', '/v2/rcm/patient-statements → count(balance<0)', 'patient_credits', metrics?.patients_with_credits_count, null, null);
    // Claim Follow-Up
    addRow('Claim Follow-Up', '30+ Day Claims Followed Today', '/v2/rcm/dashboard → followUpToday', 'claims_followup', metrics?.claims_30_plus_followed_up_today, null, null);
    addRow('Claim Follow-Up', '30+ Day Claims Followed Month', '/v2/rcm/dashboard → followUpMtd', 'claims_followup', metrics?.claims_30_plus_followed_up_mtd, null, null);
    // AR Aging
    addRow('AR Aging', 'Insurance AR 30–60 Days', '/v2/rcm/ar-aging → insurance bucket', 'ar_aging', metrics?.ar_insurance_31_60, null, bm?.ins_ar_30_60);
    addRow('AR Aging', 'Insurance AR 60–90 Days', '/v2/rcm/ar-aging → insurance bucket', 'ar_aging', metrics?.ar_insurance_61_90, null, bm?.ins_ar_60_90);
    addRow('AR Aging', 'Insurance AR >90 Days', '/v2/rcm/ar-aging → insurance bucket', 'ar_aging', metrics?.ar_insurance_over_90, null, bm?.ins_ar_over_90);
    addRow('AR Aging', 'Patient AR 30–60 Days', '/v2/rcm/ar-aging → patient bucket', 'ar_aging', metrics?.ar_patient_31_60, null, bm?.pat_ar_30_60);
    addRow('AR Aging', 'Patient AR 60–90 Days', '/v2/rcm/ar-aging → patient bucket', 'ar_aging', metrics?.ar_patient_61_90, null, bm?.pat_ar_60_90);
    addRow('AR Aging', 'Patient AR >90 Days', '/v2/rcm/ar-aging → patient bucket', 'ar_aging', metrics?.ar_patient_over_90, null, bm?.pat_ar_over_90);
    return rows;
  };

  const reconcMatrix = metrics ? buildFullReconcMatrix() : [];
  const passCount = reconcMatrix?.filter(r => r?.status === 'PASS')?.length;
  const warnCount = reconcMatrix?.filter(r => r?.status === 'WARNING')?.length;
  const failCount = reconcMatrix?.filter(r => r?.status === 'FAIL')?.length;
  const missingCount = reconcMatrix?.filter(r => r?.status === 'ENDPOINT_MISSING')?.length;

  // Build lineage matrix from metrics diagnostics
  const lineageRows = metrics ? [
    {
      metric: 'Gross Production (MTD)',
      endpoint: '/v2/production/summary',
      dateField: 'procedure_date / service_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.production?.rawProduction?.grossProduction),
      normalizedValue: fmtFull(metrics?.gross_production_mtd),
      displayedValue: fmtFull(metrics?.gross_production_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.monthly_production) : null,
      lastSync: metrics?._diagnostics?.production?.fetchedAt,
      mismatch: benchmarkRows?.[0] ? Math.abs(safeNum(metrics?.gross_production_mtd) - safeNum(benchmarkRows?.[0]?.monthly_production)) > 1 : null,
    },
    {
      metric: 'Production Adjustments (MTD)',
      endpoint: '/v2/adjustments/summary',
      dateField: 'adjustment_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.production?.rawAdjustments?.totalAdjustments),
      normalizedValue: fmtFull(metrics?.production_adjustments_mtd),
      displayedValue: fmtFull(metrics?.production_adjustments_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.monthly_adj) : null,
      lastSync: metrics?._diagnostics?.production?.fetchedAt,
      mismatch: null,
    },
    {
      metric: 'Net Production (MTD)',
      endpoint: '/v2/production/summary → netProduction',
      dateField: 'procedure_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.production?.rawProduction?.netProduction),
      normalizedValue: fmtFull(metrics?.net_production_mtd),
      displayedValue: fmtFull(metrics?.net_production_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.net_monthly_production) : null,
      lastSync: metrics?._diagnostics?.production?.fetchedAt,
      mismatch: benchmarkRows?.[0] ? Math.abs(safeNum(metrics?.net_production_mtd) - safeNum(benchmarkRows?.[0]?.net_monthly_production)) > 1 : null,
    },
    {
      metric: 'Insurance Collections (MTD)',
      endpoint: '/v2/collections/summary → insuranceCollections',
      dateField: 'payment_posted_date / applied_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.collections?.rawCollections?.insuranceCollections),
      normalizedValue: fmtFull(metrics?.insurance_collections_mtd),
      displayedValue: fmtFull(metrics?.insurance_collections_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.monthly_insurance_coll) : null,
      lastSync: metrics?._diagnostics?.collections?.fetchedAt,
      mismatch: benchmarkRows?.[0] ? Math.abs(safeNum(metrics?.insurance_collections_mtd) - safeNum(benchmarkRows?.[0]?.monthly_insurance_coll)) > 1 : null,
    },
    {
      metric: 'Patient Collections (MTD)',
      endpoint: '/v2/collections/summary → patientCollections',
      dateField: 'payment_posted_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.collections?.rawCollections?.patientCollections),
      normalizedValue: fmtFull(metrics?.patient_collections_mtd),
      displayedValue: fmtFull(metrics?.patient_collections_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.monthly_patient_coll) : null,
      lastSync: metrics?._diagnostics?.collections?.fetchedAt,
      mismatch: benchmarkRows?.[0] ? Math.abs(safeNum(metrics?.patient_collections_mtd) - safeNum(benchmarkRows?.[0]?.monthly_patient_coll)) > 1 : null,
    },
    {
      metric: 'Total Collections (MTD)',
      endpoint: '/v2/collections/summary → totalCollections',
      dateField: 'payment_posted_date',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: fmtFull(metrics?._diagnostics?.collections?.rawCollections?.totalCollections),
      normalizedValue: fmtFull(metrics?.total_collections_mtd),
      displayedValue: fmtFull(metrics?.total_collections_mtd),
      benchmarkValue: benchmarkRows?.[0] ? fmtFull(benchmarkRows?.[0]?.total_monthly_coll) : null,
      lastSync: metrics?._diagnostics?.collections?.fetchedAt,
      mismatch: benchmarkRows?.[0] ? Math.abs(safeNum(metrics?.total_collections_mtd) - safeNum(benchmarkRows?.[0]?.total_monthly_coll)) > 1 : null,
    },
    {
      metric: 'Claims Submitted (MTD)',
      endpoint: '/v2/rcm/claims → count(dateSubmitted)',
      dateField: 'date_submitted',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: metrics?._diagnostics?.claims?.totalClaimsLoaded,
      normalizedValue: metrics?.claims_submitted_mtd,
      displayedValue: metrics?.claims_submitted_mtd,
      benchmarkValue: null,
      lastSync: metrics?._diagnostics?.claims?.fetchedAt,
      mismatch: null,
    },
    {
      metric: 'AR Total (0-30)',
      endpoint: '/v2/rcm/ar-aging → bucket0_30',
      dateField: 'aging_as_of_date (snapshot)',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: null,
      normalizedValue: fmtFull(metrics?.ar_total_0_30),
      displayedValue: fmtFull(metrics?.ar_total_0_30),
      benchmarkValue: null,
      lastSync: metrics?._diagnostics?.ar_aging?.fetchedAt,
      mismatch: null,
    },
    {
      metric: 'AR Total (Over 90)',
      endpoint: '/v2/rcm/ar-aging → bucket90plus',
      dateField: 'aging_as_of_date (snapshot)',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: null,
      normalizedValue: fmtFull(metrics?.ar_total_over_90),
      displayedValue: fmtFull(metrics?.ar_total_over_90),
      benchmarkValue: null,
      lastSync: metrics?._diagnostics?.ar_aging?.fetchedAt,
      mismatch: null,
    },
    {
      metric: 'Practice Collection Ratio',
      endpoint: 'Derived: total_collections_mtd / net_production_mtd',
      dateField: 'N/A (derived)',
      officeMapping: `locationId=${locationId ?? 'ALL'}`,
      rawValue: null,
      normalizedValue: metrics?.practice_collection_ratio !== null ? `${safeNum(metrics?.practice_collection_ratio)?.toFixed(2)}%` : '—',
      displayedValue: metrics?.practice_collection_ratio !== null ? `${safeNum(metrics?.practice_collection_ratio)?.toFixed(2)}%` : '—',
      benchmarkValue: null,
      lastSync: metrics?._fetchedAt,
      mismatch: null,
    },
  ] : [];

  const healthOk = endpointHealth?.filter(e => e?.status === 'ok')?.length;
  const healthErr = endpointHealth?.filter(e => e?.status === 'error')?.length;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="FlaskConical" size={16} className="text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Dentrix Ascend Reconciliation</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Super Admin Only</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Full source-to-dashboard lineage, endpoint health checks, and eAssist benchmark reconciliation (Feb–Apr 2026).
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Building2" size={14} className="text-muted-foreground" />
            <select
              value={selectedOfficeId}
              onChange={e => setSelectedOfficeId(e?.target?.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {OFFICE_OPTIONS?.map(o => <option key={o?.id} value={o?.id}>{o?.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Calendar" size={14} className="text-muted-foreground" />
            <select
              value={datePreset}
              onChange={e => setDatePreset(e?.target?.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[
                { value: 'today', label: 'Today' },
                { value: 'this_month', label: 'This Month' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'this_quarter', label: 'This Quarter' },
                { value: 'ytd', label: 'YTD' },
              ]?.map(p => <option key={p?.value} value={p?.value}>{p?.label}</option>)}
            </select>
          </div>
          <span className="text-xs text-muted-foreground">{dateRange?.startDate} – {dateRange?.endDate}</span>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={13} className={loading ? 'animate-spin' : ''} />
            Refresh Metrics
          </button>
          <div className="flex flex-col gap-1">
            <button
              onClick={runEndpointHealthCheck}
              disabled={healthLoading}
              className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Icon name={healthLoading ? 'Loader2' : 'Activity'} size={13} className={healthLoading ? 'animate-spin' : ''} />
              Run Health Check
            </button>
            {/* Quota/rate-limit notice — Run Health Check makes multiple live read-only API calls */}
            <p className="text-[10px] text-amber-700 max-w-xs leading-tight">
              Run Health Check makes multiple live read-only calls to the Dentrix Ascend API. Use sparingly to avoid unnecessary rate-limit pressure.
            </p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <Icon name="CheckCircle2" size={18} className="text-emerald-600" />
            <div><p className="text-xs text-muted-foreground">PASS</p><p className="text-xl font-bold text-emerald-700">{passCount}</p></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <Icon name="AlertTriangle" size={18} className="text-amber-600" />
            <div><p className="text-xs text-muted-foreground">WARNING</p><p className="text-xl font-bold text-amber-700">{warnCount}</p></div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
            <Icon name="XCircle" size={18} className="text-red-600" />
            <div><p className="text-xs text-muted-foreground">FAIL</p><p className="text-xl font-bold text-red-700">{failCount}</p></div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
            <Icon name="Unplug" size={18} className="text-slate-500" />
            <div><p className="text-xs text-muted-foreground">ENDPOINT MISSING</p><p className="text-xl font-bold text-slate-600">{missingCount}</p></div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
            <Icon name="Database" size={18} className="text-blue-600" />
            <div><p className="text-xs text-muted-foreground">Benchmark Rows</p><p className="text-xl font-bold text-blue-700">{benchmarkRows?.length}</p></div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit mb-5 overflow-x-auto">
          {[
            { id: 'reconciliation', label: 'Dentrix Ascend Reconciliation', icon: 'ClipboardCheck' },
            { id: 'lineage', label: 'Source Lineage Matrix', icon: 'GitBranch' },
            { id: 'health', label: 'Endpoint Health', icon: 'Activity' },
            { id: 'benchmark', label: 'Benchmark Row Data', icon: 'FlaskConical' },
            { id: 'office_mapping', label: 'Office / Provider Mapping', icon: 'Building2' },
          ]?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab?.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={13} />
              {tab?.label}
            </button>
          ))}
        </div>

        {/* ── Dentrix Ascend Reconciliation Tab ─────────────────────────────── */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-4">
            {/* Benchmark-staleness warning banner */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex gap-3">
              <Icon name="AlertTriangle" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Benchmark Snapshot — Historical Reference Only</p>
                <p className="text-sm text-amber-700">
                  The eAssist benchmark reference used in this Reconciliation tab is a static snapshot from <strong>Apr 22, 2026 MTD</strong>.
                  Comparing live current-month values against this historical snapshot may show <strong>FAIL</strong> for many metrics.
                  This does not necessarily indicate a dashboard error. This benchmark is intended for historical validation of Apr 2026 data only.
                </p>
              </div>
            </div>

            {/* Source-distinction note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
              <Icon name="Info" size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                <strong>Benchmark source note:</strong> The Reconciliation tab uses the hardcoded Apr 22, 2026 eAssist MTD snapshot for PASS/FAIL comparison.
                The <strong>Benchmark Row Data</strong> tab shows imported eAssist daily workbook rows from <code className="bg-blue-100 px-1 rounded">benchmark_eassist_daily_reports_2026</code> for Feb–Apr 2026.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Icon name="ClipboardCheck" size={14} className="text-primary" />
                    Dentrix Ascend API → Supabase → Dashboard → eAssist Benchmark
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Benchmark reference: eAssist Complete Reports 2026 — All Data.xlsx · Apr 22, 2026 MTD values
                    {officeName !== 'All Offices' ? ` · Office: ${officeName}` : ' · Select a single office for benchmark comparison'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">PASS = ±$1</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">WARNING = ±5%</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">FAIL = &gt;5%</span>
                </div>
              </div>
              {loading ? (
                <div className="p-8 text-center">
                  <Icon name="Loader2" size={20} className="animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading metrics…</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[1100px]">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        {['Category', 'Metric', 'Source Endpoint', 'API Value', 'Cached Value', 'Dashboard Value', 'eAssist Benchmark', 'Δ Diff', 'Δ %', 'Status']?.map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reconcMatrix?.map((row, i) => {
                        const isMissing = row?.status === 'ENDPOINT_MISSING';
                        const isFail = row?.status === 'FAIL';
                        const isWarn = row?.status === 'WARNING';
                        return (
                          <tr key={i} className={`hover:bg-muted/30 ${isFail ? 'bg-red-50/30' : isWarn ? 'bg-amber-50/30' : isMissing ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row?.category}</td>
                            <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{row?.metric}</td>
                            <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[200px] truncate" title={row?.endpoint}>{row?.endpoint || '—'}</td>
                            <td className="px-3 py-2 tabular-nums text-right">
                              {row?.dashVal != null ? (typeof row?.dashVal === 'number' ? fmtFull(row?.dashVal) : row?.dashVal) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-right text-muted-foreground">
                              {row?.supaVal != null ? fmtFull(row?.supaVal) : <span className="text-muted-foreground/50">—</span>}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-right font-semibold">
                              {row?.dashVal != null ? (typeof row?.dashVal === 'number' ? fmtFull(row?.dashVal) : row?.dashVal) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-right text-blue-700 font-semibold">
                              {row?.benchVal != null ? (typeof row?.benchVal === 'number' ? fmtFull(row?.benchVal) : row?.benchVal) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={`px-3 py-2 tabular-nums text-right text-[10px] ${row?.diff == null ? 'text-muted-foreground' : Math.abs(row?.diff) <= TOLERANCE ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                              {row?.diff != null ? `${row?.diff >= 0 ? '+' : ''}${fmtFull(row?.diff)}` : '—'}
                            </td>
                            <td className={`px-3 py-2 tabular-nums text-right text-[10px] ${row?.diffPct == null ? 'text-muted-foreground' : Math.abs(row?.diffPct) <= TOLERANCE_PCT ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                              {row?.diffPct != null ? `${row?.diffPct >= 0 ? '+' : ''}${row?.diffPct?.toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <ReconcBadge status={row?.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-4 py-3 border-t border-border bg-muted/20 text-[10px] text-muted-foreground space-y-1">
                <p><strong>ENDPOINT MISSING:</strong> No Dentrix Ascend API endpoint found for this metric. EOB/EFT posting, fax/portal claim methods, and projected values are not available via the Dentrix Ascend API.</p>
                <p><strong>NOT MAPPED:</strong> Endpoint exists but no benchmark reference value available in the eAssist workbook for this metric.</p>
                <p><strong>Cached Value:</strong> Cached comparison value is not currently populated in this diagnostic view. All comparison values are sourced live from the Dentrix Ascend API. Staten Island is excluded from benchmark (not in eAssist workbook).</p>
              </div>
            </div>
          </div>
        )}

        {/* Source Lineage Matrix */}
        {activeTab === 'lineage' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="GitBranch" size={14} className="text-primary" />
                Source-to-Dashboard Lineage Matrix
              </h3>
              <span className="text-xs text-muted-foreground">{officeName} · {dateRange?.label}</span>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <Icon name="Loader2" size={20} className="animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading metrics…</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1400px]">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      {['Metric', 'Source Endpoint', 'Date Field', 'Office Mapping', 'Raw Value', 'Normalized Value', 'Displayed Value', 'Benchmark Value', 'Last Sync', 'Status']?.map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineageRows?.map((row, i) => (
                      <LineageRow key={i} {...row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Endpoint Health */}
        {activeTab === 'health' && (
          <div>
            {endpointHealth?.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="Activity" size={24} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Click "Run Health Check" to test all Dentrix Ascend endpoints.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {endpointHealth?.map((ep, i) => (
                  <EndpointCard key={i} endpoint={ep?.label} status={ep?.status} latencyMs={ep?.latencyMs} lastTestedAt={ep?.lastTestedAt} error={ep?.error} locationId={ep?.locationId} officeName={ep?.officeName} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Benchmark Row Data */}
        {activeTab === 'benchmark' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="FlaskConical" size={14} className="text-amber-500" />
                eAssist Benchmark Row Data — Supabase Table
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                benchmark_eassist_daily_reports_2026 · {benchmarkRows?.length} rows · Offices: Barnegat, Brick, Eatontown · Feb–Apr 2026
              </p>
            </div>
            {benchmarkRows?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Icon name="Database" size={24} className="mx-auto mb-2 opacity-40" />
                No benchmark rows loaded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1000px]">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      {['Date', 'Office', 'BM Daily Prod', 'BM Net MTD', 'BM Total Coll MTD', 'Dashboard Net MTD', 'Dashboard Total Coll', 'Δ Net MTD', 'Δ Total Coll', 'Reconciled']?.map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {benchmarkRows?.map(row => {
                      const deltaNMtd = row?.net_monthly_production == null || row?.dashboard_net_monthly_production == null ? null : safeNum(row?.net_monthly_production) - safeNum(row?.dashboard_net_monthly_production);
                      const deltaTColl = row?.total_monthly_coll == null || row?.dashboard_total_monthly_coll == null ? null : safeNum(row?.total_monthly_coll) - safeNum(row?.dashboard_total_monthly_coll);
                      const hasMismatch = row?.mismatch_net_monthly_production || row?.mismatch_total_monthly_coll;
                      return (
                        <tr key={row?.id} className={`hover:bg-muted/30 ${hasMismatch ? 'bg-red-50/30' : ''}`}>
                          <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{row?.report_date}</td>
                          <td className="px-3 py-2.5">{row?.office_canonical}</td>
                          <td className="px-3 py-2.5 tabular-nums">{fmtFull(row?.daily_production)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-emerald-700 font-semibold">{fmtFull(row?.net_monthly_production)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-blue-700 font-semibold">{fmtFull(row?.total_monthly_coll)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{fmtFull(row?.dashboard_net_monthly_production)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{fmtFull(row?.dashboard_total_monthly_coll)}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            <span className={deltaNMtd == null ? 'text-muted-foreground' : Math.abs(deltaNMtd) <= 1 ? 'text-emerald-600' : 'text-red-600'}>
                              {deltaNMtd == null ? '—' : `${deltaNMtd >= 0 ? '+' : ''}${fmtFull(deltaNMtd)}`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            <span className={deltaTColl == null ? 'text-muted-foreground' : Math.abs(deltaTColl) <= 1 ? 'text-emerald-600' : 'text-red-600'}>
                              {deltaTColl == null ? '—' : `${deltaTColl >= 0 ? '+' : ''}${fmtFull(deltaTColl)}`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row?.reconciled_at
                              ? <span className="text-emerald-600 text-[10px] font-bold">✓ {fmtRelative(row?.reconciled_at)}</span>
                              : <span className="text-amber-600 text-[10px]">Pending</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Office / Provider Mapping */}
        {activeTab === 'office_mapping' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Icon name="Building2" size={14} className="text-primary" />
                  Office / Location ID Mapping
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      {['Canonical Name', 'Supabase UUID', 'Dentrix locationId', 'Aliases', 'In eAssist Workbook']?.map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ALL_DENTRIX_OFFICES?.map(o => (
                      <tr key={o?.officeId} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-semibold text-foreground">{o?.officeName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o?.officeId}</td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-600">{o?.locationId}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          Nu Dental of {o?.officeName}, NuDental {o?.officeName}, {o?.officeName} NJ/NY
                        </td>
                        <td className="px-4 py-3">
                          {['Barnegat', 'Brick', 'Eatontown']?.includes(o?.officeName)
                            ? <span className="text-emerald-600 text-xs font-semibold">✓ Yes (Feb–Apr 2026)</span>
                            : <span className="text-muted-foreground text-xs">Not in workbook</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <Icon name="Info" size={14} className="inline mr-2" />
              <strong>Date field rules:</strong> Production uses procedure_date. Adjustments use adjustment_date.
              Collections use payment_posted_date. AR Aging uses aging_as_of_date (snapshot). Claims use date_submitted.
              Mixing these date fields is the primary cause of production/collections mismatches.
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DentrixDiagnosticsPage;
