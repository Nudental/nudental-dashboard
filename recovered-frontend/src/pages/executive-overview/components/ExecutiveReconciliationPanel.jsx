/**
 * ExecutiveReconciliationPanel.jsx
 *
 * Super Admin-only debug panel for validating Executive Overview KPI values
 * against the Dentrix Ascend source-of-truth.
 *
 * Shows:
 *   - Selected filters (date range, location, locationId used in query)
 *   - Raw Dentrix API response values
 *   - Transformed backend totals
 *   - Final UI-rendered values
 *   - Source-of-truth validation against known PDF values
 *   - April partial-month warning
 */

import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { OFFICE_MAP } from '../../../constants/offices';
import { getReconciliationStatus } from '../../../services/backfillReconciliationService';
import StatusBadge from '../../bone-and-tissue-inventory/components/StatusBadge';

const fmt = (value) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(Number(value));
};

const fmtNum = (value) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US')?.format(Number(value));
};

const SOURCE_OF_TRUTH = {};

const TOLERANCE = 1.00;
const TOLERANCE_PCT = 5; // 5% tolerance for WARNING vs FAIL

const checkValue = (dashValue, sotValue) => {
  if (sotValue == null || dashValue == null) return null;
  const diff = Math.abs(Number(dashValue) - Number(sotValue));
  return diff <= TOLERANCE ? 'pass' : 'fail';
};

// ─── eAssist Apr 22 2026 Benchmark Reference ─────────────────────────────────
// These are REFERENCE-ONLY values from the attached workbook. Not hardcoded into production logic.
const EASSIST_BENCHMARK = {
  // April 22, 2026 daily totals (all 3 offices combined)
  daily: {
    daily_production: 16574.00,
    daily_adj: -10225.00,
    net_daily_production: 6349.00,
    daily_insurance_coll: 4302.70,
    daily_patient_coll: 3172.71,
    daily_total_coll: 7475.41,
  },
  // April 2026 MTD by office (as of Apr 22)
  offices: {
    Barnegat: {
      monthly_production: 179783.00,
      monthly_adj: -122446.89,
      net_monthly_production: 57336.11,
      total_monthly_coll: 64124.24,
      collection_ratio: 112,
      claims_submitted: 12,
      claim_rate_24h: 100,
      ins_ar_30_60: 3387.12,
      ins_ar_60_90: 2006.32,
      ins_ar_over_90: 2006.32,
      pat_ar_30_60: 5987.33,
      pat_ar_60_90: 5279.24,
      pat_ar_over_90: 5279.24,
    },
    Brick: {
      monthly_production: 117340.11,
      monthly_adj: -78499.81,
      net_monthly_production: 38840.30,
      total_monthly_coll: 91836.89,
      collection_ratio: 236,
      claims_submitted: 21,
      claim_rate_24h: 97.83,
      ins_ar_30_60: 6834.00,
      ins_ar_60_90: 11338.00,
      ins_ar_over_90: 11338.00,
      pat_ar_30_60: 8916.00,
      pat_ar_60_90: 8466.00,
      pat_ar_over_90: 8466.00,
    },
    Eatontown: {
      monthly_production: 146649.95,
      monthly_adj: -92721.05,
      net_monthly_production: 53928.90,
      total_monthly_coll: 65663.35,
      collection_ratio: 122,
      claims_submitted: 14,
      claim_rate_24h: 100,
      ins_ar_30_60: 213.34,
      ins_ar_60_90: 2471.58,
      ins_ar_over_90: 2471.58,
      pat_ar_30_60: 5458.10,
      pat_ar_60_90: 5290.91,
      pat_ar_over_90: 5290.91,
    },
  },
};

const getBenchmarkStatus = (dashValue, benchValue, endpointAvailable = true) => {
  if (!endpointAvailable) return 'ENDPOINT_MISSING';
  if (benchValue == null) return 'NOT_MAPPED';
  if (dashValue == null || dashValue === 0) return 'FAIL';
  const diff = Math.abs(Number(dashValue) - Number(benchValue));
  const pct = benchValue !== 0 ? (diff / Math.abs(Number(benchValue))) * 100 : 0;
  if (diff <= TOLERANCE) return 'PASS';
  if (pct <= TOLERANCE_PCT) return 'WARNING';
  return 'FAIL';
};

const ReconcStatusBadge = ({ status }) => {
  const cfg = {
    PASS:             { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'PASS' },
    WARNING:          { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'WARNING' },
    FAIL:             { bg: 'bg-red-100',      text: 'text-red-700',     label: 'FAIL' },
    ENDPOINT_MISSING: { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'ENDPOINT MISSING' },
    NOT_MAPPED:       { bg: 'bg-purple-100',  text: 'text-purple-600',  label: 'NOT MAPPED' },
  }?.[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg?.bg} ${cfg?.text}`}>
      {cfg?.label}
    </span>
  );
};

const ExecutiveReconciliationPanel = ({ kpis, dateRange, selectedOfficeIds = [], accessibleOffices = [] }) => {
  const [expanded, setExpanded] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);

  const loadBackfillStatus = async () => {
    if (backfillStatus) { setShowBackfill(true); return; }
    setBackfillLoading(true);
    try {
      const status = await getReconciliationStatus({ startMonth: '2022-04-01' });
      setBackfillStatus(status);
      setShowBackfill(true);
    } catch (e) {
      console.error('[ExecutiveReconciliationPanel] backfill load error:', e?.message);
    } finally {
      setBackfillLoading(false);
    }
  };

  if (!kpis) return null;

  const diag = kpis?._diagnostics || {};

  // Determine office display name
  const officeLabel = selectedOfficeIds?.length === 1
    ? (OFFICE_MAP?.[selectedOfficeIds?.[0]]?.name || accessibleOffices?.find(o => o?.id === selectedOfficeIds?.[0])?.name || selectedOfficeIds?.[0])
    : 'All Offices';

  // Determine source-of-truth key for validation
  const startDate = dateRange?.start || kpis?.startDate || '';
  const endDate = dateRange?.end || kpis?.endDate || '';
  const isAprilPartial = kpis?.isAprilPartial || (startDate === '2026-04-01' && endDate <= '2026-04-20');

  let sotKey = null;
  if (startDate?.startsWith('2026-01') && endDate?.startsWith('2026-01')) {
    sotKey = selectedOfficeIds?.length === 1
      ? `2026-01-${officeLabel?.toLowerCase()?.replace(' ', '-')}`
      : '2026-01';
  } else if (startDate?.startsWith('2026-02') && endDate?.startsWith('2026-02')) {
    sotKey = selectedOfficeIds?.length === 1
      ? `2026-02-${officeLabel?.toLowerCase()?.replace(' ', '-')}`
      : '2026-02';
  } else if (startDate?.startsWith('2026-03') && endDate?.startsWith('2026-03')) {
    sotKey = selectedOfficeIds?.length === 1
      ? `2026-03-${officeLabel?.toLowerCase()?.replace(' ', '-')}`
      : '2026-03';
  } else if (isAprilPartial) {
    sotKey = selectedOfficeIds?.length === 1
      ? `2026-04-partial-${officeLabel?.toLowerCase()?.replace(' ', '-')}`
      : '2026-04-partial';
  }

  const sot = sotKey ? SOURCE_OF_TRUTH?.[sotKey] : null;
  const prodCheck = sot ? checkValue(kpis?.netProduction, sot?.production) : null;
  const collCheck = sot ? checkValue(kpis?.totalCollections, sot?.collection) : null;

  // ── eAssist Benchmark section ──────────────────────────────────────────────
  const benchmarkOffice = EASSIST_BENCHMARK?.offices?.[officeLabel] || null;
  const benchmarkDaily = EASSIST_BENCHMARK?.daily;

  // Build reconciliation rows for the benchmark table
  const buildBenchmarkRows = () => {
    const rows = [];
    const addRow = (category, metric, dashVal, benchVal, endpoint, endpointAvailable = true) => {
      const status = getBenchmarkStatus(dashVal, benchVal, endpointAvailable);
      const diff = benchVal != null && dashVal != null ? Number(dashVal) - Number(benchVal) : null;
      const diffPct = benchVal != null && benchVal !== 0 && diff != null ? (diff / Math.abs(Number(benchVal))) * 100 : null;
      rows?.push({ category, metric, dashVal, benchVal, endpoint, status, diff, diffPct });
    };

    // Production
    addRow('Production', 'Net Monthly Production', kpis?.netProduction, benchmarkOffice?.net_monthly_production, '/v2/production/summary');
    addRow('Production', 'Gross Monthly Production', kpis?.grossProduction, benchmarkOffice?.monthly_production, '/v2/production/summary');
    addRow('Production', 'Monthly Adj', kpis?.totalAdjustments, benchmarkOffice?.monthly_adj, '/v2/adjustments/summary');
    // Collections
    addRow('Collections', 'Total Monthly Collections', kpis?.totalCollections, benchmarkOffice?.total_monthly_coll, '/v2/collections/summary');
    addRow('Collections', 'Collection Ratio %', kpis?.collectionRate, benchmarkOffice?.collection_ratio, 'Derived: coll/net_prod');
    // Claims
    addRow('Claims', 'Claims Submitted (MTD)', kpis?.claims_submitted_mtd, benchmarkOffice?.claims_submitted, '/v2/rcm/claims');
    addRow('Claims', '24hr Submission Rate %', kpis?.claim_submission_rate_24h, benchmarkOffice?.claim_rate_24h, '/v2/rcm/claims → derived');
    // AR Aging — Insurance
    addRow('AR Aging', 'Insurance AR 30-60', kpis?.ar_insurance_31_60, benchmarkOffice?.ins_ar_30_60, '/v2/rcm/ar-aging');
    addRow('AR Aging', 'Insurance AR 60-90', kpis?.ar_insurance_61_90, benchmarkOffice?.ins_ar_60_90, '/v2/rcm/ar-aging');
    addRow('AR Aging', 'Insurance AR >90', kpis?.ar_insurance_over_90, benchmarkOffice?.ins_ar_over_90, '/v2/rcm/ar-aging');
    // AR Aging — Patient
    addRow('AR Aging', 'Patient AR 30-60', kpis?.ar_patient_31_60, benchmarkOffice?.pat_ar_30_60, '/v2/rcm/ar-aging');
    addRow('AR Aging', 'Patient AR 60-90', kpis?.ar_patient_61_90, benchmarkOffice?.pat_ar_60_90, '/v2/rcm/ar-aging');
    addRow('AR Aging', 'Patient AR >90', kpis?.ar_patient_over_90, benchmarkOffice?.pat_ar_over_90, '/v2/rcm/ar-aging');
    // EOB/EFT — no endpoint
    addRow('EOB/EFT', 'EOB Scans Posted w/in 24hr', null, null, null, false);
    addRow('EOB/EFT', 'EFT Scans Posted w/in 24hr', null, null, null, false);
    addRow('EOB/EFT', 'EOB 24hr Rate %', null, null, null, false);
    addRow('EOB/EFT', 'EFT 24hr Rate %', null, null, null, false);
    // Patient Balances
    addRow('Patient Finance', 'Patients with Balances', kpis?.patients_with_balances_count, null, '/v2/rcm/patient-statements');
    addRow('Patient Finance', 'Patients with Credits', kpis?.patients_with_credits_count, null, '/v2/rcm/patient-statements');
    // Claims Follow-Up
    addRow('Claim Follow-Up', '30+ Day Claims Followed Today', kpis?.claims_30_plus_followed_up_today, null, '/v2/rcm/dashboard → followUpToday');
    addRow('Claim Follow-Up', '30+ Day Claims Followed Month', kpis?.claims_30_plus_followed_up_mtd, null, '/v2/rcm/dashboard → followUpMtd');
    // Claim Methods — no dedicated endpoint
    addRow('Claim Methods', 'Claims Sent Electronically', kpis?.claims_sent_electronically, null, '/v2/rcm/claims → submissionMethod');
    addRow('Claim Methods', 'Claims Sent By Mail', kpis?.claims_sent_by_mail, null, '/v2/rcm/claims → submissionMethod');
    addRow('Claim Methods', 'Claims Corrected Resubmitted', kpis?.claims_corrected_and_resubmitted, null, '/v2/rcm/claims → status');
    addRow('Claim Methods', 'Total Pre-Auths Sent', kpis?.preauths_sent, null, '/v2/rcm/dashboard → preAuthsSent');
    return rows;
  };

  const benchmarkRows = buildBenchmarkRows();
  const passCount = benchmarkRows?.filter(r => r?.status === 'PASS')?.length;
  const warnCount = benchmarkRows?.filter(r => r?.status === 'WARNING')?.length;
  const failCount = benchmarkRows?.filter(r => r?.status === 'FAIL')?.length;
  const missingCount = benchmarkRows?.filter(r => r?.status === 'ENDPOINT_MISSING')?.length;

  return (
    <div className="mt-4 border border-amber-300 rounded-lg bg-amber-50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-amber-100 border-b border-amber-300 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Icon name="FlaskConical" size={14} className="text-amber-700" />
          <span className="text-xs font-bold text-amber-800">KPI Reconciliation Panel</span>
          <span className="text-[10px] text-amber-600 font-medium">Super Admin Only</span>
          {isAprilPartial && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-300 text-amber-900">
              ⚠️ APRIL PARTIAL MONTH (Apr 1–20)
            </span>
          )}
        </div>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-amber-700" />
      </div>
      {expanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* Filter State */}
          <div>
            <p className="font-bold text-amber-800 mb-2 flex items-center gap-1">
              <Icon name="Filter" size={12} /> Selected Filters
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Date Start', value: startDate },
                { label: 'Date End', value: endDate },
                { label: 'Period Label', value: dateRange?.label || '—' },
                { label: 'Office Scope', value: officeLabel },
                { label: 'Dentrix locationId', value: kpis?.locationId || 'null (All Offices)' },
                { label: 'Office UUIDs', value: selectedOfficeIds?.length > 0 ? selectedOfficeIds?.join(', ') : 'All' },
                { label: 'Partial Month?', value: isAprilPartial ? 'YES — Apr 1–20 only' : (dateRange?.isPartialMonth ? 'YES (MTD)' : 'No') },
                { label: 'Fetch Timestamp', value: diag?.timestamp ? new Date(diag.timestamp)?.toLocaleTimeString() : '—' },
              ]?.map(({ label, value }) => (
                <div key={label} className="bg-white border border-amber-200 rounded p-2">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase">{label}</p>
                  <p className="text-foreground font-mono text-[10px] break-all mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Endpoints Used */}
          <div>
            <p className="font-bold text-amber-800 mb-2 flex items-center gap-1">
              <Icon name="Link" size={12} /> Endpoints Called
            </p>
            <div className="space-y-1">
              {[diag?.endpointProduction, diag?.endpointCollections, diag?.endpointPatients]?.filter(Boolean)?.map((ep, i) => (
                <p key={i} className="font-mono text-[10px] bg-white border border-amber-200 rounded px-2 py-1 text-foreground break-all">{ep}</p>
              ))}
            </div>
          </div>

          {/* KPI Values */}
          <div>
            <p className="font-bold text-amber-800 mb-2 flex items-center gap-1">
              <Icon name="BarChart2" size={12} /> KPI Values (Transformed → UI)
            </p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-amber-100">
                  <th className="text-left px-2 py-1.5 font-semibold text-amber-800">Metric</th>
                  <th className="text-right px-2 py-1.5 font-semibold text-amber-800">UI Value</th>
                  {sot && <th className="text-right px-2 py-1.5 font-semibold text-amber-800">PDF Source-of-Truth</th>}
                  {sot && <th className="text-center px-2 py-1.5 font-semibold text-amber-800">Status</th>}
                  {sot && <th className="text-right px-2 py-1.5 font-semibold text-amber-800">Δ Diff</th>}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'Net Production',
                    value: kpis?.netProduction,
                    sotValue: sot?.production,
                    status: prodCheck,
                    isCurrency: true,
                  },
                  {
                    label: 'Gross Production (UCR)',
                    value: kpis?.grossProduction,
                    sotValue: null,
                    status: null,
                    isCurrency: true,
                  },
                  {
                    label: 'Total Collections',
                    value: kpis?.totalCollections,
                    sotValue: sot?.collection,
                    status: collCheck,
                    isCurrency: true,
                  },
                  {
                    label: 'Collection Rate',
                    value: kpis?.collectionRate != null ? `${Number(kpis?.collectionRate)?.toFixed(2)}%` : '—',
                    sotValue: null,
                    status: null,
                    isCurrency: false,
                  },
                  {
                    label: 'Total Adjustments',
                    value: kpis?.totalAdjustments,
                    sotValue: null,
                    status: null,
                    isCurrency: true,
                  },
                  {
                    label: 'Write-Offs',
                    value: kpis?.writeOffs,
                    sotValue: null,
                    status: null,
                    isCurrency: true,
                  },
                  {
                    label: 'New Patients',
                    value: kpis?.newPatients,
                    sotValue: null,
                    status: null,
                    isCurrency: false,
                    isNumber: true,
                  },
                ]?.map(({ label, value, sotValue, status, isCurrency, isNumber }) => {
                  const diff = sotValue != null && value != null
                    ? Number(value) - Number(sotValue)
                    : null;
                  return (
                    <tr key={label} className="border-b border-amber-100 hover:bg-amber-50">
                      <td className="px-2 py-1.5 font-medium text-foreground">{label}</td>
                      <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                        status === 'fail' ? 'text-red-600' : status === 'pass' ? 'text-emerald-700' : 'text-foreground'
                      }`}>
                        {isCurrency ? fmt(value) : isNumber ? fmtNum(value) : value}
                      </td>
                      {sot && (
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                          {sotValue != null ? (isCurrency ? fmt(sotValue) : fmtNum(sotValue)) : '—'}
                        </td>
                      )}
                      {sot && (
                        <td className="px-2 py-1.5 text-center">
                          <StatusBadge status={status} />
                        </td>
                      )}
                      {sot && (
                        <td className={`px-2 py-1.5 text-right font-mono text-[10px] ${
                          diff == null ? 'text-muted-foreground' :
                          Math.abs(diff) <= TOLERANCE ? 'text-emerald-600' : 'text-red-600 font-bold'
                        }`}>
                          {diff != null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Validation summary */}
          {sot && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              prodCheck === 'pass' && collCheck === 'pass' ?'bg-emerald-50 border-emerald-300 text-emerald-800' :'bg-red-50 border-red-300 text-red-800'
            }`}>
              <Icon
                name={prodCheck === 'pass' && collCheck === 'pass' ? 'CheckCircle2' : 'AlertTriangle'}
                size={14}
              />
              <p className="text-xs font-semibold">
                {prodCheck === 'pass' && collCheck === 'pass'
                  ? `✓ Both Net Production and Total Collections match the Dentrix PDF source-of-truth (±$${TOLERANCE})`
                  : `⚠ Mismatch detected — check API response and field mapping above`}
              </p>
            </div>
          )}

          {!sot && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted border-border text-muted-foreground">
              <Icon name="Info" size={13} />
              <p className="text-xs">No source-of-truth reference available for this date range / office combination. Validation only covers Jan–Apr 20, 2026.</p>
            </div>
          )}

          {/* ── eAssist Benchmark Reconciliation (Apr 22, 2026) ──────────────── */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowBenchmark(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Icon name="ClipboardCheck" size={13} className="text-blue-700" />
                <span className="text-xs font-bold text-blue-800">eAssist Workbook Reconciliation — Apr 22, 2026</span>
                {benchmarkOffice ? (
                  <span className="text-[10px] text-blue-600">Office: {officeLabel}</span>
                ) : (
                  <span className="text-[10px] text-amber-600">Select a single office (Barnegat/Brick/Eatontown) for benchmark comparison</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {benchmarkOffice && (
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">{passCount} PASS</span>
                    {warnCount > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">{warnCount} WARN</span>}
                    {failCount > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">{failCount} FAIL</span>}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">{missingCount} MISSING</span>
                  </div>
                )}
                <Icon name={showBenchmark ? 'ChevronUp' : 'ChevronDown'} size={13} className="text-blue-600" />
              </div>
            </button>

            {showBenchmark && (
              <div className="bg-white p-3">
                {!benchmarkOffice ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Icon name="Info" size={16} className="mx-auto mb-1 opacity-40" />
                    Select Barnegat, Brick, or Eatontown to compare against the Apr 22, 2026 benchmark.
                    Staten Island is not present in the eAssist workbook.
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Reference: eAssist Complete Reports 2026 — All Data.xlsx · Apr 22, 2026 MTD values · Tolerance: ±${TOLERANCE} (PASS), ±5% (WARNING), &gt;5% (FAIL)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-blue-50 border-b border-blue-200">
                            <th className="text-left px-2 py-1.5 font-semibold text-blue-800">Category</th>
                            <th className="text-left px-2 py-1.5 font-semibold text-blue-800">Metric</th>
                            <th className="text-right px-2 py-1.5 font-semibold text-blue-800">Dashboard Value</th>
                            <th className="text-right px-2 py-1.5 font-semibold text-blue-800">eAssist Benchmark</th>
                            <th className="text-right px-2 py-1.5 font-semibold text-blue-800">Δ Diff</th>
                            <th className="text-right px-2 py-1.5 font-semibold text-blue-800">Δ %</th>
                            <th className="text-center px-2 py-1.5 font-semibold text-blue-800">Status</th>
                            <th className="text-left px-2 py-1.5 font-semibold text-blue-800">Endpoint</th>
                          </tr>
                        </thead>
                        <tbody>
                          {benchmarkRows?.map((row, i) => (
                            <tr key={i} className={`border-b border-blue-50 hover:bg-blue-50/50 ${row?.status === 'FAIL' ? 'bg-red-50/30' : row?.status === 'WARNING' ? 'bg-amber-50/30' : ''}`}>
                              <td className="px-2 py-1.5 text-muted-foreground">{row?.category}</td>
                              <td className="px-2 py-1.5 font-medium text-foreground">{row?.metric}</td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {row?.dashVal != null ? (typeof row?.dashVal === 'number' ? fmt(row?.dashVal) : row?.dashVal) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-blue-700">
                                {row?.benchVal != null ? (typeof row?.benchVal === 'number' ? fmt(row?.benchVal) : row?.benchVal) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className={`px-2 py-1.5 text-right font-mono text-[10px] ${row?.diff == null ? 'text-muted-foreground' : Math.abs(row?.diff) <= TOLERANCE ? 'text-emerald-600' : 'text-red-600'}`}>
                                {row?.diff != null ? `${row?.diff >= 0 ? '+' : ''}${fmt(row?.diff)}` : '—'}
                              </td>
                              <td className={`px-2 py-1.5 text-right font-mono text-[10px] ${row?.diffPct == null ? 'text-muted-foreground' : Math.abs(row?.diffPct) <= TOLERANCE_PCT ? 'text-emerald-600' : 'text-red-600'}`}>
                                {row?.diffPct != null ? `${row?.diffPct >= 0 ? '+' : ''}${row?.diffPct?.toFixed(1)}%` : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <ReconcStatusBadge status={row?.status} />
                              </td>
                              <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{row?.endpoint || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground border-t border-blue-100 pt-2">
                      <span className="font-semibold text-blue-700">Note:</span>
                      <span>ENDPOINT MISSING = No Dentrix Ascend API endpoint found (EOB/EFT posting metrics).</span>
                      <span>NOT MAPPED = No benchmark reference value available for this metric.</span>
                      <span>Dashboard values reflect current date filter, not Apr 22 specifically.</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── 48-Month Backfill Coverage ─────────────────────────────────── */}
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <button
              onClick={loadBackfillStatus}
              disabled={backfillLoading}
              className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Icon name="CalendarRange" size={13} className="text-amber-700" />
                <span className="text-xs font-bold text-amber-800">48-Month Backfill Coverage (Apr 2022 → Present)</span>
                {backfillStatus && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    backfillStatus?.allPdfPassed
                      ? 'bg-emerald-100 text-emerald-700' :'bg-amber-200 text-amber-800'
                  }`}>
                    {backfillStatus?.coveragePct}% covered
                  </span>
                )}
              </div>
              {backfillLoading
                ? <Icon name="Loader2" size={13} className="text-amber-600 animate-spin" />
                : <Icon name={showBackfill ? 'ChevronUp' : 'ChevronDown'} size={13} className="text-amber-600" />
              }
            </button>

            {showBackfill && backfillStatus && (
              <div className="p-3 space-y-3 bg-white">
                {/* Coverage summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total Rows',       value: `${backfillStatus?.totalRows} / ${backfillStatus?.expectedRows}`, icon: 'Database',     color: 'text-blue-700' },
                    { label: 'PDF Validated',     value: `${backfillStatus?.validatedRows} rows`,                          icon: 'CheckCircle2',  color: 'text-emerald-700' },
                    { label: 'eAssist Imported',  value: `${backfillStatus?.importedRows} rows`,                           icon: 'FileText',      color: 'text-indigo-700' },
                    { label: 'Estimated',         value: `${backfillStatus?.estimatedRows} rows`,                          icon: 'TrendingUp',    color: 'text-amber-700' },
                  ]?.map(({ label, value, icon, color }) => (
                    <div key={label} className="bg-amber-50 border border-amber-200 rounded p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon name={icon} size={11} className={color} />
                        <p className="text-[10px] text-amber-600 font-semibold uppercase">{label}</p>
                      </div>
                      <p className={`text-xs font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* PDF validation results */}
                {backfillStatus?.pdfCheckedCount > 0 && (
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] font-semibold ${
                    backfillStatus?.allPdfPassed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :'bg-red-50 border-red-300 text-red-800'
                  }`}>
                    <Icon name={backfillStatus?.allPdfPassed ? 'CheckCircle2' : 'AlertTriangle'} size={12} />
                    PDF Validation: {backfillStatus?.pdfPassedCount}/{backfillStatus?.pdfCheckedCount} rows pass
                    {!backfillStatus?.allPdfPassed && ` — ${backfillStatus?.pdfFailedCount} mismatch(es) detected`}
                  </div>
                )}

                {/* Grand totals */}
                {backfillStatus?.grandTotals && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '48-Mo Net Production',  value: backfillStatus?.grandTotals?.totalProduction },
                      { label: '48-Mo Total Collections', value: backfillStatus?.grandTotals?.totalCollections },
                    ]?.map(({ label, value }) => (
                      <div key={label} className="bg-amber-50 border border-amber-200 rounded p-2">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase mb-0.5">{label}</p>
                        <p className="text-xs font-bold text-foreground font-mono">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data quality legend */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-100">
                  {[
                    { label: 'PDF Validated',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
                    { label: 'eAssist Imported', color: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
                    { label: 'Estimated',        color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
                  ]?.map(({ label, color, dot }) => (
                    <span key={label} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      {label}
                    </span>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Fetched {backfillStatus?.fetchedAt ? new Date(backfillStatus.fetchedAt)?.toLocaleTimeString() : '—'}
                  </span>
                </div>

                {backfillStatus?.error && (
                  <p className="text-[10px] text-red-600 font-mono bg-red-50 border border-red-200 rounded px-2 py-1">
                    Error: {backfillStatus?.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Raw API response toggle */}
          <div>
            <button
              onClick={() => setShowRaw(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
            >
              <Icon name={showRaw ? 'ChevronUp' : 'ChevronDown'} size={11} />
              {showRaw ? 'Hide' : 'Show'} Raw API Responses
            </button>
            {showRaw && (
              <div className="mt-2 space-y-2">
                {[
                  { label: 'Production API Response', data: diag?.rawProduction },
                  { label: 'Collections API Response', data: diag?.rawCollections },
                  { label: 'Patients API Response', data: diag?.rawPatients },
                ]?.map(({ label, data }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-amber-700 mb-1">{label}</p>
                    <pre className="bg-white border border-amber-200 rounded p-2 text-[10px] font-mono text-foreground overflow-x-auto max-h-32">
                      {data ? JSON.stringify(data, null, 2) : 'null (API call failed or returned no data)'}
                    </pre>
                  </div>
                ))}
                {diag?.error && (
                  <div>
                    <p className="text-[10px] font-semibold text-red-700 mb-1">Error</p>
                    <pre className="bg-red-50 border border-red-200 rounded p-2 text-[10px] font-mono text-red-800 overflow-x-auto">
                      {diag?.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveReconciliationPanel;
