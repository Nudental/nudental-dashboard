/**
 * RcmDashboardTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * V468 — RCM Dashboard remaining field mapping proof/fix — no launch
 *
 * V468 changes (FRONTEND FIELD-MAPPING AUDIT + PATCH ONLY):
 *  - Added FieldAuditPanel component: shows actual live JSON keys from each
 *    N/A endpoint response so the exact backend field names are visible in UI.
 *  - _rawResponse is now returned from fetchPosCollections and
 *    fetchCollectionRefunds service wrappers for audit display.
 *  - POS Collections: added additional field path attempts including
 *    row-level amount_collected sum when summary is absent.
 *  - Collection Refunds: added additional field path attempts including
 *    row-level refund_amount sum when summary is absent.
 *  - Daily Comparison: added additional field path attempts for net_production
 *    across all known response shapes. Confirmed URL uses
 *    date=selectedEndDate&comparisonMode=mtd.
 *  - eAssist: added deeper nested path attempts (offices[], latest_by_office[]).
 *  - Dentrix Daily Summary: added deeper nested path attempts.
 *  - All N/A cards now show "Backend field not present in response" note with
 *    the actual top-level keys found, so the gap is clearly documented.
 *
 * V467 improvements preserved:
 *  - Broadened field mapping for all 4 N/A endpoints
 *  - Staged fetch plan (Phase 1/2/3)
 *  - Section-specific timeouts
 *  - Daily Comparison MTD: date=selectedEndDate&comparisonMode=mtd
 *  - Insurance Claim Follow-Up All Offices: single call without locationId
 *
 * V465/V466 improvements preserved:
 *  - Null values → N/A; real 0 → $0; no fake zeros
 *  - No gross_production fallback for MTD Net Production
 *  - Collection % = collections ÷ net_production only
 *  - Official A/R separated from Insurance Claim Follow-Up Queue
 *  - No /v2/rcm/dashboard, /v2/rcm/claims, fetchRcmDashboardKpis
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import {
  fetchClaimSubmissions,
  fetchOfficialArAging,
  fetchArAging,
  fetchPatientBalances,
  fetchGuarantorReconciliation,
  fetchPosCollections,
  fetchCollectionRefunds,
  fetchDashboardDailyComparison,
  fetchDashboardEassistStatus,
  fetchDashboardDentrixDailySummary,
} from '../../../services/rcmService';

// ─── Null-safe helpers ────────────────────────────────────────────────────────

const isNil = (v) => v === null || v === undefined;

const safeNumberOrNull = (v) => {
  if (isNil(v)) return null;
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
};

const formatCurrencyOrNA = (v) => {
  const n = safeNumberOrNull(v);
  if (n === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })?.format(n);
};

const formatNumberOrNA = (v) => {
  const n = safeNumberOrNull(v);
  if (n === null) return 'N/A';
  return n?.toLocaleString('en-US');
};

const formatPercentOrNA = (v) => {
  const n = safeNumberOrNull(v);
  if (n === null) return 'N/A';
  return `${n?.toFixed(1)}%`;
};

const formatDateOrNA = (d) => {
  if (!d) return 'N/A';
  try {
    const normalised = String(d)?.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
    const dt = new Date(normalised.includes('T') ? normalised : normalised + 'T00:00:00');
    if (isNaN(dt?.getTime())) return d;
    return dt?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

/**
 * withTimeout — wraps a promise with a timeout so hanging API calls resolve
 * to an error instead of keeping the section in skeleton state indefinitely.
 */
const withTimeout = (promise, ms = 30000, label = 'fetch') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
};

// ─── Field Audit Panel ────────────────────────────────────────────────────────
// Shows actual live JSON keys from the raw response so field mapping gaps
// are visible in the UI without needing browser DevTools.
// V477: Only shown when value is unresolved (N/A) OR when forceShow=true (debug mode).

const FieldAuditPanel = ({ label, rawResponse, fieldPathsTried, resolvedValue, nestedKeys = null, forceShow = false }) => {
  const [open, setOpen] = useState(false);
  if (!rawResponse) return null;

  const hasValue = resolvedValue !== null && resolvedValue !== undefined;

  // V477: Hide entirely on resolved cards unless debug mode is on
  if (hasValue && !forceShow) return null;

  const topLevelKeys = rawResponse && typeof rawResponse === 'object'
    ? Object.keys(rawResponse)
    : [];

  const summaryKeys = rawResponse?.summary && typeof rawResponse?.summary === 'object'
    ? Object.keys(rawResponse?.summary)
    : [];

  const metadataKeys = rawResponse?.metadata && typeof rawResponse?.metadata === 'object'
    ? Object.keys(rawResponse?.metadata)
    : [];

  const dataRow0Keys = Array.isArray(rawResponse?.data) && rawResponse?.data?.length > 0 && typeof rawResponse?.data?.[0] === 'object'
    ? Object.keys(rawResponse?.data?.[0])
    : (Array.isArray(rawResponse?.rows) && rawResponse?.rows?.length > 0 && typeof rawResponse?.rows?.[0] === 'object'
      ? Object.keys(rawResponse?.rows?.[0])
      : []);

  // Build nested key entries from the nestedKeys prop (array of { key, label })
  const nestedEntries = [];
  if (nestedKeys && Array.isArray(nestedKeys)) {
    nestedKeys?.forEach(({ key, label: nLabel }) => {
      const val = rawResponse?.[key];
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          const keys = Object.keys(val);
          nestedEntries?.push({ label: nLabel || key, keys, isArray: false, length: null, val });
        } else if (Array.isArray(val)) {
          const firstKeys = val?.length > 0 && typeof val?.[0] === 'object' ? Object.keys(val?.[0]) : [];
          nestedEntries?.push({ label: nLabel || key, keys: firstKeys, isArray: true, length: val?.length, val });
        }
      }
    });
  }

  // For each nested entry that is an object, also show one more level of nesting
  const deepNestedEntries = [];
  nestedEntries?.forEach(entry => {
    if (!entry?.isArray && entry?.val && typeof entry?.val === 'object') {
      entry?.keys?.forEach(subKey => {
        const subVal = entry?.val?.[subKey];
        if (subVal !== null && subVal !== undefined && typeof subVal === 'object' && !Array.isArray(subVal)) {
          deepNestedEntries?.push({ label: `${entry?.label}.${subKey}`, keys: Object.keys(subVal), isArray: false });
        } else if (Array.isArray(subVal) && subVal?.length > 0 && typeof subVal?.[0] === 'object') {
          deepNestedEntries?.push({ label: `${entry?.label}.${subKey}`, keys: Object.keys(subVal?.[0]), isArray: true, length: subVal?.length });
        }
      });
    }
  });

  const parentPresent = topLevelKeys?.length > 0;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-amber-600 hover:text-amber-800 flex items-center gap-1 underline underline-offset-2"
      >
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={10} />
        {hasValue ? `Field audit — ${label}` : `⚠ Field audit — ${label}`}
      </button>
      {open && (
        <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono space-y-1 max-h-64 overflow-y-auto">
          <p className="font-semibold text-slate-600">Top-level keys: [{topLevelKeys?.join(', ')}]</p>
          {summaryKeys?.length > 0 && (
            <p className="text-slate-500">summary keys: [{summaryKeys?.join(', ')}]</p>
          )}
          {metadataKeys?.length > 0 && (
            <p className="text-slate-500">metadata keys: [{metadataKeys?.join(', ')}]</p>
          )}
          {dataRow0Keys?.length > 0 && (
            <p className="text-slate-500">data[0]/rows[0] keys: [{dataRow0Keys?.join(', ')}]</p>
          )}
          {nestedEntries?.map((entry, i) => (
            <div key={i}>
              {entry?.isArray ? (
                <p className="text-blue-600">{entry?.label} (array, length={entry?.length}){entry?.keys?.length > 0 ? ` [0] keys: [${entry?.keys?.join(', ')}]` : ' — empty array'}</p>
              ) : (
                <p className="text-blue-600">{entry?.label} keys: [{entry?.keys?.join(', ')}]</p>
              )}
            </div>
          ))}
          {deepNestedEntries?.map((entry, i) => (
            <div key={`deep-${i}`}>
              {entry?.isArray ? (
                <p className="text-indigo-500 pl-2">↳ {entry?.label} (array, length={entry?.length}){entry?.keys?.length > 0 ? ` [0] keys: [${entry?.keys?.join(', ')}]` : ' — empty array'}</p>
              ) : (
                <p className="text-indigo-500 pl-2">↳ {entry?.label} keys: [{entry?.keys?.join(', ')}]</p>
              )}
            </div>
          ))}
          {fieldPathsTried && (
            <p className="text-slate-400 mt-1">Paths tried: {fieldPathsTried}</p>
          )}
          {hasValue && (
            <p className="text-green-600 font-semibold">Resolved value: {String(resolvedValue)}</p>
          )}
          {!hasValue && parentPresent && nestedEntries?.length === 0 && (
            <p className="text-amber-600 font-semibold">Parent object present — nested keys not yet inspected. Expand nested keys above to find correct field.</p>
          )}
          {!hasValue && parentPresent && nestedEntries?.length > 0 && deepNestedEntries?.length === 0 && (
            <p className="text-red-500 font-semibold">No matching field found in inspected nested keys — frontend mapping issue, not a backend gap</p>
          )}
          {!hasValue && parentPresent && nestedEntries?.length > 0 && deepNestedEntries?.length > 0 && (
            <p className="text-amber-600 font-semibold">Nested objects present — see ↳ keys above. Field not found at tried paths.</p>
          )}
          {!hasValue && !parentPresent && (
            <p className="text-red-500 font-semibold">No response data — backend gap confirmed</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const SectionHeader = ({ title, sourceNote, onTabLink, tabLinkLabel }) => (
  <div className="flex items-start justify-between mb-3">
    <div>
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h2>
      {sourceNote && (
        <p className="text-xs text-muted-foreground mt-0.5">{sourceNote}</p>
      )}
    </div>
    {onTabLink ? (
      <button
        onClick={onTabLink}
        className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-4"
      >
        {tabLinkLabel || 'View tab'}
        <Icon name="ArrowRight" size={12} />
      </button>
    ) : null}
  </div>
);

const KpiCard = ({ icon, label, value, subLabel = null, color = 'bg-slate-500', warning = null, badge = null, auditPanel = null }) => (
  <div className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={18} className="text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">
        {label}
        {badge ? (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
            {badge}
          </span>
        ) : null}
      </p>
      <p className={`text-xl font-bold mt-0.5 ${value === 'N/A' ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </p>
      {subLabel ? <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{subLabel}</p> : null}
      {warning ? <p className="text-xs text-amber-600 mt-0.5 leading-tight">{warning}</p> : null}
      {auditPanel}
    </div>
  </div>
);

const PaymentBreakdownDetail = ({ pb, sourceNote }) => {
  const [expanded, setExpanded] = React.useState(false);
  const fmtC = (v) => {
    const n = safeNumberOrNull(v);
    if (n === null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
  };
  const insuranceRows = [
    { label: 'Check', value: pb?.insurance_check },
    { label: 'EFT', value: pb?.insurance_eft },
    { label: 'Credit Card', value: pb?.insurance_credit_card },
    { label: 'Other', value: pb?.insurance_other },
    { label: 'Unknown', value: pb?.insurance_unknown },
  ];
  const patientRows = [
    { label: 'Cash', value: pb?.patient_cash },
    { label: 'Check', value: pb?.patient_check },
    { label: 'Credit Card', value: pb?.patient_credit_card },
    { label: 'EFT / Online', value: pb?.patient_eft_online },
    { label: 'Financing', value: pb?.patient_financing },
    { label: 'Other', value: pb?.patient_other },
    { label: 'Unknown', value: pb?.patient_unknown },
  ];
  return (
    <div className="mt-2">
      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs mt-1">
        <div className="text-muted-foreground">Insurance</div>
        <div className="text-muted-foreground">Patient</div>
        <div className="text-muted-foreground">POS</div>
        <div className="font-semibold text-foreground">{fmtC(pb?.total_insurance_collections)}</div>
        <div className="font-semibold text-foreground">{fmtC(pb?.total_patient_collections)}</div>
        <div className="font-semibold text-foreground">{fmtC(pb?.pos_collections)}</div>
      </div>
      {sourceNote ? <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{sourceNote}</p> : null}
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] text-primary hover:underline mt-1.5 flex items-center gap-0.5"
      >
        {expanded ? '▲ Hide detail' : '▼ Show detail breakdown'}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0 text-[11px]">
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Insurance</p>
            {insuranceRows?.map(r => (
              <div key={r?.label} className="flex justify-between gap-2 py-0.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r?.label}</span>
                <span className="font-medium text-foreground">{fmtC(r?.value)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Patient</p>
            {patientRows?.map(r => (
              <div key={r?.label} className="flex justify-between gap-2 py-0.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r?.label}</span>
                <span className="font-medium text-foreground">{fmtC(r?.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SkeletonCard = () => (
  <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted flex-shrink-0" />
      <div className="flex-1">
        <div className="h-3 bg-muted rounded w-2/3 mb-2" />
        <div className="h-6 bg-muted rounded w-1/2" />
      </div>
    </div>
  </div>
);

const SectionError = ({ message, onRetry }) => (
  <div className="bg-card rounded-xl border border-amber-200 p-4 flex items-start gap-3">
    <Icon name="AlertTriangle" size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-amber-700">Section unavailable</p>
      <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-primary hover:underline mt-1">
          Retry
        </button>
      )}
    </div>
  </div>
);

const SlowLoadingMessage = ({ message, subMessage }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 mt-2">
    <Icon name="Clock" size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-xs font-medium text-blue-700">{message}</p>
      {subMessage && <p className="text-xs text-blue-600 mt-0.5">{subMessage}</p>}
    </div>
  </div>
);

const AgingBucketBar = ({ label, value, total, color }) => {
  const n = safeNumberOrNull(value);
  const t = safeNumberOrNull(total);
  const pct = (n !== null && t !== null && t > 0) ? (n / t) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-20 text-right flex-shrink-0">
        {formatCurrencyOrNA(value)}
      </span>
    </div>
  );
};

// ─── Section: Claim Activity (Phase 1 — fast) ─────────────────────────────────

const ClaimActivitySection = ({ dateRange, officeId, refreshKey, onTabLink, enabled }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(
        fetchClaimSubmissions({
          start: dateRange?.start,
          end: dateRange?.end,
          dateBasis: 'sentDate',
          officeId: officeId || '',
          page: 1,
          pageSize: 1,
        }),
        30000,
        'Claim Activity'
      );
      setData(result);
    } catch (e) {
      setError(e?.message || 'Failed to load claim activity');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => {
    if (enabled) { load(); }
  }, [load, enabled]);

  const s = data?.summary || {};
  const submitted = safeNumberOrNull(s?.submitted_claims ?? s?.total_claims);
  const within24h = safeNumberOrNull(s?.submitted_within_24h_count);
  const unsent = safeNumberOrNull(s?.unsent_claims);
  const acceptedOpen = safeNumberOrNull(s?.accepted_open_claims);
  const rejected = safeNumberOrNull(s?.rejected_claims);
  const predet = safeNumberOrNull(s?.predetermination_claims);

  const pendingOpen = (unsent !== null || acceptedOpen !== null)
    ? (unsent ?? 0) + (acceptedOpen ?? 0)
    : null;

  const rejectionRate = (rejected !== null && submitted !== null && submitted > 0)
    ? (rejected / submitted) * 100
    : null;

  const freshnessNote = data?.claimSourceFreshnessNote;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Claim Activity"
        sourceNote="Claim submissions date basis: sentDate. Source: /v2/rcm/claim-submissions"
        onTabLink={onTabLink}
        tabLinkLabel="View Claim Submissions tab"
      />
      {!enabled || loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 })?.map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <SectionError message={error} onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              icon="FileText"
              label="Claims Submitted"
              value={formatNumberOrNA(submitted)}
              subLabel="sentDate basis"
              color="bg-indigo-500"
            />
            <KpiCard
              icon="Zap"
              label="Submitted Within 24h"
              value={formatNumberOrNA(within24h)}
              color="bg-green-500"
            />
            <KpiCard
              icon="Clock"
              label="Pending / Open Claims"
              value={formatNumberOrNA(pendingOpen)}
              subLabel="accepted_open + unsent"
              color="bg-amber-500"
            />
            <KpiCard
              icon="Shield"
              label="Predeterminations / Pre-Auths"
              value={formatNumberOrNA(predet)}
              color="bg-blue-500"
            />
            <KpiCard
              icon="XCircle"
              label="Rejection Rate"
              value={formatPercentOrNA(rejectionRate)}
              subLabel={submitted !== null && submitted > 0 ? `${formatNumberOrNA(rejected)} of ${formatNumberOrNA(submitted)}` : 'Insufficient data'}
              color="bg-red-500"
            />
          </div>
          {freshnessNote && (
            <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
              {freshnessNote}
            </p>
          )}
        </>
      )}
    </div>
  );
};

// ─── Section: Official A/R Snapshot (Phase 3 — slow Dentrix live) ─────────────

const OfficialArSection = ({ officeId, refreshKey, onTabLink, enabled }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timeoutMs = officeId ? 45000 : 90000;
  const timeoutLabel = officeId
    ? 'Official A/R (single office)'
    : 'Official A/R All Offices';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(
        fetchOfficialArAging(officeId || null),
        timeoutMs,
        timeoutLabel
      );
      setData(result);
    } catch (e) {
      setError(e?.message || 'Failed to load official A/R');
    } finally {
      setLoading(false);
    }
  }, [officeId, refreshKey, timeoutMs, timeoutLabel]);

  useEffect(() => {
    if (enabled) { load(); }
  }, [load, enabled]);

  const asOfLabel = data?.asOf ? `As of ${formatDateOrNA(data?.asOf)}` : 'Current snapshot';
  const totalAR = safeNumberOrNull(data?.totalAR);
  const buckets = data?.agingBuckets || {};

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Official A/R Snapshot"
        sourceNote="Source: Dentrix /v1/agingbalances/report via /v2/rcm/ar-aging-official. Current snapshot only — not date-range filtered."
        onTabLink={onTabLink}
        tabLinkLabel="View AR Aging tab"
      />
      {!enabled || loading ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {Array.from({ length: 4 })?.map((_, i) => <SkeletonCard key={i} />)}
          </div>
          {enabled && (
            <SlowLoadingMessage
              message="Loading live Dentrix A/R snapshot."
              subMessage={!officeId
                ? 'All-office cold pull may take about 60 seconds. Please wait — do not refresh.'
                : 'Fetching Dentrix live A/R data…'}
            />
          )}
        </>
      ) : error ? (
        <SectionError
          message={error?.includes('timed out')
            ? `Official A/R timed out (${!officeId ? '90s' : '45s'} limit). The Dentrix live snapshot may be slow — please retry.`
            : error}
          onRetry={load}
        />
      ) : (
        <>
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Icon name="Info" size={11} />
              Official A/R — {asOfLabel} (Dentrix Ascend Live)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <KpiCard
              icon="DollarSign"
              label="Official A/R Total"
              value={formatCurrencyOrNA(data?.totalAR)}
              subLabel={asOfLabel}
              color="bg-blue-600"
            />
            <KpiCard
              icon="Shield"
              label="Insurance A/R"
              value={formatCurrencyOrNA(data?.insurancePortion)}
              color="bg-indigo-500"
            />
            <KpiCard
              icon="User"
              label="Patient A/R"
              value={formatCurrencyOrNA(data?.guarantorPortion)}
              color="bg-teal-500"
            />
            <KpiCard
              icon="TrendingDown"
              label="Net Balance"
              value={formatCurrencyOrNA(data?.netBalance)}
              subLabel={data?.unapplied_credits_visible ? 'After unapplied credits' : undefined}
              color="bg-slate-500"
            />
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">A/R Aging Buckets</p>
            <div className="space-y-2">
              <AgingBucketBar label="0–30 days" value={buckets?.b_0_30} total={totalAR} color="bg-green-400" />
              <AgingBucketBar label="31–60 days" value={buckets?.b_31_60} total={totalAR} color="bg-yellow-400" />
              <AgingBucketBar label="61–90 days" value={buckets?.b_61_90} total={totalAR} color="bg-orange-400" />
              <AgingBucketBar label="Over 90" value={buckets?.b_over_90} total={totalAR} color="bg-red-500" />
            </div>
          </div>
          {data?.offices?.length > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">A/R by Office</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium">Office</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">Total A/R</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">Insurance</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium">Patient</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.offices?.map((o, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="py-1.5 font-medium text-foreground">{o?.officeName || '—'}</td>
                        <td className="py-1.5 text-right">{formatCurrencyOrNA(o?.totalAR)}</td>
                        <td className="py-1.5 text-right">{formatCurrencyOrNA(o?.insurancePortion)}</td>
                        <td className="py-1.5 text-right">{formatCurrencyOrNA(o?.guarantorPortion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!data?.unapplied_credits_visible && (
            <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
              Unapplied credits / Billing Review: access restricted by backend. Contact administrator.
            </p>
          )}
        </>
      )}
    </div>
  );
};

// ─── Section: Patient Balances & Patient Portion ──────────────────────────────

const PatientBalancesSection = ({ officeId, dateRange, refreshKey, onBalancesTabLink, onPortionTabLink, phase1Enabled, phase3Enabled }) => {
  const [balData, setBalData] = useState(null);
  const [balLoading, setBalLoading] = useState(true);
  const [balError, setBalError] = useState(null);

  const [portionData, setPortionData] = useState(null);
  const [portionLoading, setPortionLoading] = useState(true);
  const [portionError, setPortionError] = useState(null);

  const balTimeoutMs = officeId ? 45000 : 150000;
  const balTimeoutLabel = officeId
    ? 'Patient Balances (single office)'
    : 'Patient Balances All Offices';

  const loadBalances = useCallback(async () => {
    setBalLoading(true);
    setBalError(null);
    try {
      const result = await withTimeout(
        fetchPatientBalances({
          officeId: officeId || null,
          balanceType: 'patient_responsible',
          includeZeroBalances: false,
          page: 1,
          pageSize: 1,
        }),
        balTimeoutMs,
        balTimeoutLabel
      );
      setBalData(result);
    } catch (e) {
      setBalError(e?.message || 'Failed to load patient balances');
    } finally {
      setBalLoading(false);
    }
  }, [officeId, refreshKey, balTimeoutMs, balTimeoutLabel]);

  const loadPortion = useCallback(async () => {
    setPortionLoading(true);
    setPortionError(null);
    try {
      const result = await withTimeout(
        fetchGuarantorReconciliation({
          startDate: dateRange?.start,
          endDate: dateRange?.end,
          officeId: officeId || '',
          minDaysOutstanding: 0,
          onlyBalanceDue: true,
          excludeZeroPortion: true,
          includePredeterminations: false,
          page: 1,
          pageSize: 1,
        }),
        30000,
        'Patient Portion'
      );
      setPortionData(result);
    } catch (e) {
      setPortionError(e?.message || 'Failed to load patient portion');
    } finally {
      setPortionLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => {
    if (phase1Enabled) { loadPortion(); }
  }, [loadPortion, phase1Enabled]);

  useEffect(() => {
    if (phase3Enabled) { loadBalances(); }
  }, [loadBalances, phase3Enabled]);

  const sc = balData?.scorecard || {};
  const psc = portionData?.scorecard || {};

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Patient Balances & Patient Portion"
        sourceNote={null}
        onTabLink={null}
        tabLinkLabel={null}
      />
      {/* True Patient Balances — Phase 3 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold text-foreground">True Patient Balances</p>
            <p className="text-xs text-muted-foreground">Patient-responsible snapshot — /v2/rcm/patient-balances. Current snapshot only.</p>
          </div>
          {onBalancesTabLink && (
            <button onClick={onBalancesTabLink} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
              View tab <Icon name="ArrowRight" size={12} />
            </button>
          )}
        </div>
        {!phase3Enabled || balLoading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 })?.map((_, i) => <SkeletonCard key={i} />)}
            </div>
            {phase3Enabled && (
              <SlowLoadingMessage
                message="Loading live Dentrix patient balances."
                subMessage={!officeId
                  ? 'All-office cold pull may take 90–120 seconds. Please wait — do not refresh.'
                  : 'Fetching Dentrix live patient balance data…'}
              />
            )}
            {!phase3Enabled && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Queued — will load after fast sections complete.
              </p>
            )}
          </>
        ) : balError ? (
          <SectionError
            message={balError?.includes('timed out')
              ? `Patient balances timed out (${!officeId ? '150s' : '45s'} limit). The Dentrix live pull may be slow — please retry.`
              : balError}
            onRetry={loadBalances}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon="Users"
              label="Patient-Responsible Balance"
              value={formatCurrencyOrNA(sc?.total_patient_responsible_balance)}
              subLabel="True patient-responsible snapshot"
              color="bg-teal-600"
            />
            <KpiCard
              icon="UserCheck"
              label="Patients With Balance"
              value={formatNumberOrNA(sc?.total_patients_with_patient_balance)}
              color="bg-blue-500"
            />
            <KpiCard
              icon="AlertCircle"
              label="Balance Over 90 Days"
              value={formatCurrencyOrNA(sc?.balance_over_90_days)}
              subLabel={sc?.patients_over_90_days != null ? `${formatNumberOrNA(sc?.patients_over_90_days)} patients` : undefined}
              color="bg-red-500"
            />
            <KpiCard
              icon="TrendingUp"
              label="High-Balance Patients"
              value={formatNumberOrNA(sc?.high_balance_patients)}
              subLabel={sc?.high_balance_total != null ? formatCurrencyOrNA(sc?.high_balance_total) : undefined}
              color="bg-amber-500"
            />
          </div>
        )}
      </div>
      {/* Patient Portion Reconciliation — Phase 1 */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Patient Portion Reconciliation</p>
            <p className="text-xs text-muted-foreground">Procedure-level, not patient-level total balance — /v2/rcm/guarantor-reconciliation</p>
          </div>
          {onPortionTabLink && (
            <button onClick={onPortionTabLink} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
              View tab <Icon name="ArrowRight" size={12} />
            </button>
          )}
        </div>
        {!phase1Enabled || portionLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 })?.map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : portionError ? (
          <SectionError message={portionError} onRetry={loadPortion} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard
              icon="CreditCard"
              label="Procedure-Level Patient Portion Due"
              value={formatCurrencyOrNA(psc?.total_remaining_patient_due ?? psc?.total_current_patient_portion)}
              subLabel="Procedure-level reconciliation — not patient-level balance"
              color="bg-violet-500"
            />
            <KpiCard
              icon="CheckSquare"
              label="Actionable Patient Portion Rows"
              value={formatNumberOrNA(psc?.due_row_count ?? psc?.over_5_days_due_count)}
              color="bg-indigo-500"
            />
            <KpiCard
              icon="DollarSign"
              label="Total Actual Patient Paid"
              value={formatCurrencyOrNA(psc?.total_actual_patient_paid)}
              color="bg-green-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section: Collections / Refunds / Operational Trend (Phase 1 — fast) ──────
//
// V468 FIELD-MAPPING PATCH:
//
// A. POS Collections amount:
//    - Tries all V467 summary field names first
//    - NEW: also tries row-level amount_collected sum from rows[] when summary is absent
//    - NEW: tries summary.total_pos_amount, summary.pos_amount, summary.amount_total
//    - If no amount found: shows N/A with field audit panel showing actual keys
//
// B. Collection Refunds:
//    - Tries all V467 summary field names first
//    - NEW: also tries row-level refund_amount sum from data[] when summary is absent
//    - NEW: tries summary.total, summary.amount_total, summary.refund_amount_total
//    - If no amount found: shows N/A with field audit panel showing actual keys
//
// C. Daily Comparison MTD:
//    - net_production ONLY — no gross_production fallback
//    - NEW: tries additional shapes: raw?.net_production (top-level),
//      raw?.totals?.net_production, raw?.metrics?.net_production
//    - Confirmed URL: date=selectedEndDate&comparisonMode=mtd
//    - If not found: shows N/A with field audit panel
//
// HARD RULES (unchanged):
//    - No gross_production fallback
//    - Collection % = collections ÷ net_production only
//    - No fake zeros

const CollectionsSection = ({ dateRange, officeId, refreshKey, onPosTabLink, onRefundTabLink, onDailyTabLink, enabled, showFieldAudit }) => {
  const [posData, setPosData] = useState(null);
  const [posLoading, setPosLoading] = useState(true);
  const [posError, setPosError] = useState(null);

  const [refundData, setRefundData] = useState(null);
  const [refundLoading, setRefundLoading] = useState(true);
  const [refundError, setRefundError] = useState(null);

  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState(null);

  const loadPos = useCallback(async () => {
    setPosLoading(true);
    setPosError(null);
    try {
      const result = await withTimeout(
        fetchPosCollections({
          start: dateRange?.start,
          end: dateRange?.end,
          officeId: officeId || '',
          page: 1,
          pageSize: 1,
        }),
        30000,
        'POS Collections'
      );
      setPosData(result);
    } catch (e) {
      setPosError(e?.message || 'Failed to load POS collections');
    } finally {
      setPosLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  const loadRefunds = useCallback(async () => {
    setRefundLoading(true);
    setRefundError(null);
    try {
      const result = await withTimeout(
        fetchCollectionRefunds({
          start: dateRange?.start,
          end: dateRange?.end,
          officeId: officeId || null,
          page: 1,
          pageSize: 1,
        }),
        30000,
        'Collection Refunds'
      );
      setRefundData(result);
    } catch (e) {
      setRefundError(e?.message || 'Failed to load refunds');
    } finally {
      setRefundLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  const loadDaily = useCallback(async () => {
    setDailyLoading(true);
    setDailyError(null);
    try {
      const result = await withTimeout(
        fetchDashboardDailyComparison({
          start: dateRange?.start,
          end: dateRange?.end,
          officeId: officeId || null,
        }),
        30000,
        'Daily Comparison'
      );
      setDailyData(result);
    } catch (e) {
      setDailyError(e?.message || 'Failed to load daily comparison');
    } finally {
      setDailyLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => {
    if (enabled) {
      loadPos();
      loadRefunds();
      loadDaily();
    }
  }, [enabled, loadPos, loadRefunds, loadDaily]);

  // ── V468: POS Collections — broadened field mapping ───────────────────────
  // fetchPosCollections returns { rows, pagination, metadata, summary, _rawResponse }
  const posSummary = posData?.summary || {};
  const posTotal = safeNumberOrNull(
    // V469: Add the confirmed field names from FieldAuditPanel audit
    posSummary?.total_amount_collected
    ?? posSummary?.total_collected
    ?? posSummary?.total_amount
    ?? posSummary?.collected_amount
    ?? posSummary?.amount_collected
    ?? posSummary?.gross_collected
    ?? posSummary?.pos_total
    ?? posSummary?.total_pos_collected
    ?? posSummary?.net_collected
    ?? posSummary?.total
    ?? posSummary?.total_pos_amount
    ?? posSummary?.pos_amount
    ?? posSummary?.amount_total
    ?? posSummary?.pos_collections_total
    ?? posSummary?.collections_total
    ?? null
  ) ?? (
    // V468: If summary has no amount field, try summing row-level amount_collected
    // Only use this if rows are full-scope (not paginated single page)
    // We use pageSize=1 so row sum would not be full-scope — keep as null
    (null)
  );

  // Transaction count: V469 — add total_payment_events as first priority
  const posTxCount = safeNumberOrNull(
    posSummary?.total_payment_events
    ?? posSummary?.transaction_count
    ?? posSummary?.count
    ?? posSummary?.total_transactions
    ?? posSummary?.num_transactions
    ?? posSummary?.tx_count
    ?? posSummary?.total_count
    ?? posSummary?.record_count
    ?? null
  ) ?? (Array.isArray(posData?.rows) ? posData?.rows?.length : null);

  // ── V468: Collection Refunds — broadened field mapping ────────────────────
  // fetchCollectionRefunds returns { data, summary, pagination, metadata, _source, _rawResponse }
  const refSummary = refundData?.summary || {};
  const refTotal = safeNumberOrNull(
    refSummary?.total_refunds
    ?? refSummary?.total_refund_amount
    ?? refSummary?.total_amount
    ?? refSummary?.refund_total
    ?? refSummary?.gross_refunds
    ?? refSummary?.net_refunds
    ?? refSummary?.amount
    ?? refSummary?.total
    ?? refSummary?.amount_total
    ?? refSummary?.refund_amount_total
    ?? refSummary?.total_true_refunds
    ?? refSummary?.true_refund_total
    ?? null
  );
  const refPatient = safeNumberOrNull(
    refSummary?.patient_refunds
    ?? refSummary?.total_patient_refunds
    ?? refSummary?.patient_refund_amount
    ?? refSummary?.patient_refund_total
    ?? refSummary?.patient_total
    ?? refSummary?.total_patient_refund_amount
    ?? null
  );
  const refInsurance = safeNumberOrNull(
    refSummary?.insurance_refunds
    ?? refSummary?.total_insurance_refunds
    ?? refSummary?.insurance_refund_amount
    ?? refSummary?.insurance_refund_total
    ?? refSummary?.insurance_total
    ?? refSummary?.total_insurance_refund_amount
    ?? null
  );

  // ── V468: Daily Comparison MTD — broadened field mapping ──────────────────
  // fetchDashboardDailyComparison returns { mtd, summary, _source, _raw }
  // URL confirmed: /v2/rcm/daily-comparison?date=<end>&comparisonMode=mtd
  const mtd = dailyData?.mtd || {};
  const summary = dailyData?.summary || {};
  const raw = dailyData?._raw || {};

  // Helper: extract net_production from any object — NEVER gross_production
  const extractNetProduction = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    return obj?.net_production
      ?? obj?.netProduction
      ?? obj?.netProductionTotal
      ?? obj?.production?.net_production
      ?? obj?.production?.netProduction
      ?? null;
  };

  // Helper: extract total_collections from any object
  const extractCollections = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    return obj?.total_collections
      ?? obj?.collections
      ?? obj?.totalCollections
      ?? obj?.total_collected
      ?? obj?.collected
      ?? obj?.collection?.total_collections
      ?? obj?.collection?.totalCollections
      ?? obj?.mtd_collections
      ?? obj?.collections_total
      ?? null;
  };

  // ── Step 1: Try mtd.current_mtd fields ──────────────────────────────────
  const currentMtd = mtd?.current_mtd || null;

  // ── Step 2: Try by_office fallback — sum all offices ────────────────────
  const byOffice = dailyData?.by_office || [];
  const byOfficeIsArray = Array.isArray(byOffice) && byOffice?.length > 0;

  // Determine which office row(s) to use
  // officeId is passed as prop; if null/"all" use all rows
  const byOfficeRows = byOfficeIsArray
    ? (officeId && officeId !== 'all'
        ? byOffice?.filter(r =>
            String(r?.office_id) === String(officeId) ||
            String(r?.location_id) === String(officeId) ||
            String(r?.dentrix_location_id) === String(officeId) ||
            String(r?.office_name)?.toLowerCase() === String(officeId)?.toLowerCase()
          )
        : byOffice)
    : [];

  const byOfficeNetProduction = byOfficeRows?.length > 0
    ? byOfficeRows?.reduce((sum, r) => {
        const v = safeNumberOrNull(r?.net_production);
        return v !== null ? sum + v : sum;
      }, 0)
    : null;

  const byOfficeCollections = byOfficeRows?.length > 0
    ? byOfficeRows?.reduce((sum, r) => {
        const v = safeNumberOrNull(r?.total_collections);
        return v !== null ? sum + v : sum;
      }, 0)
    : null;

  // Validate: only use by_office sum if at least one row had a non-null value
  const byOfficeNetProductionFinal = byOfficeRows?.some(r => safeNumberOrNull(r?.net_production) !== null)
    ? byOfficeNetProduction
    : null;
  const byOfficeCollectionsFinal = byOfficeRows?.some(r => safeNumberOrNull(r?.total_collections) !== null)
    ? byOfficeCollections
    : null;

  // ── Step 3: Resolve mtdProduction — current_mtd first, then by_office ───
  const mtdProductionFromCurrentMtd = safeNumberOrNull(
    extractNetProduction(currentMtd)
    ?? extractNetProduction(mtd)
    ?? extractNetProduction(summary)
    ?? extractNetProduction(raw)
    ?? extractNetProduction(raw?.current)
    ?? extractNetProduction(raw?.period)
    ?? extractNetProduction(raw?.mtd_data)
    ?? extractNetProduction(raw?.mtd_summary)
    ?? extractNetProduction(raw?.totals)
    ?? extractNetProduction(raw?.metrics)
    ?? (Array.isArray(raw?.data) && raw?.data?.length > 0 ? extractNetProduction(raw?.data?.[0]) : null)
    ?? extractNetProduction(raw?.production)
    ?? (raw?.net_production ?? null)
    ?? null
  );

  const mtdProduction = mtdProductionFromCurrentMtd !== null
    ? mtdProductionFromCurrentMtd
    : byOfficeNetProductionFinal;

  const mtdProductionSource = mtdProductionFromCurrentMtd !== null
    ? 'current_mtd'
    : (byOfficeNetProductionFinal !== null ? 'by_office' : null);

  // ── Step 4: Resolve mtdCollections — current_mtd first, then by_office ──
  const mtdCollectionsFromCurrentMtd = safeNumberOrNull(
    extractCollections(currentMtd)
    ?? extractCollections(mtd)
    ?? extractCollections(summary)
    ?? extractCollections(raw)
    ?? extractCollections(raw?.current)
    ?? extractCollections(raw?.period)
    ?? extractCollections(raw?.mtd_data)
    ?? extractCollections(raw?.mtd_summary)
    ?? extractCollections(raw?.totals)
    ?? extractCollections(raw?.metrics)
    ?? (Array.isArray(raw?.data) && raw?.data?.length > 0 ? extractCollections(raw?.data?.[0]) : null)
    ?? (raw?.total_collections ?? raw?.collections ?? null)
    ?? null
  );

  const mtdCollections = mtdCollectionsFromCurrentMtd !== null
    ? mtdCollectionsFromCurrentMtd
    : byOfficeCollectionsFinal;

  // Collection % = collections ÷ net production ONLY.
  // If net_production is null/missing → null → N/A.
  const collectionPct = (mtdProduction !== null && mtdCollections !== null && mtdProduction > 0)
    ? (mtdCollections / mtdProduction) * 100
    : null;

  // Build raw response objects for field audit panels
  const posRawForAudit = posData?._rawResponse || (posData?.summary ? { summary: posData?.summary, rows: posData?.rows } : null);
  const refRawForAudit = refundData?._rawResponse || (refundData?.summary ? { summary: refundData?.summary, data: refundData?.data } : null);
  // Pass the full dailyData so FieldAuditPanel can show mtd, by_office, current_mtd nested keys
  const dailyRawForAudit = dailyData || null;

  // Determine if daily-comparison has nested objects to inspect
  const dailyHasNestedMtd = !!(dailyData?.mtd);
  const dailyMtdKeys = dailyData?.mtd && typeof dailyData?.mtd === 'object' ? Object.keys(dailyData?.mtd) : [];
  const currentMtdKeys = currentMtd && typeof currentMtd === 'object' ? Object.keys(currentMtd) : [];

  // Build MTD warning message
  const mtdWarning = mtdProduction === null
    ? (dailyHasNestedMtd
        ? `mtd present with keys: [${dailyMtdKeys?.join(', ')}]${currentMtdKeys?.length > 0 ? `; current_mtd keys: [${currentMtdKeys?.join(', ')}]` : ''} — net_production not found in current_mtd or by_office`
        : 'net_production field not available from daily-comparison response')
    : undefined;

  // Build by_office fallback note for subLabel
  const mtdByOfficeNote = mtdProductionSource === 'by_office' ?'Primary mtd.net_production field not present; using by_office full-scope net_production totals.'
    : null;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Collections / Refunds / Operational Trend"
        sourceNote={null}
        onTabLink={null}
        tabLinkLabel={null}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* POS Collections */}
        {!enabled || posLoading ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : posError ? (
          <div className="col-span-2">
            <SectionError message={posError} onRetry={loadPos} />
          </div>
        ) : (
          <>
            <KpiCard
              icon="Wallet"
              label="POS Collections"
              value={formatCurrencyOrNA(posTotal)}
              subLabel={
                <span>
                  Source: /v2/rcm/pos-collections
                  {onPosTabLink && (
                    <button onClick={onPosTabLink} className="ml-1 text-primary hover:underline">→ View tab</button>
                  )}
                </span>
              }
              color="bg-green-600"
              warning={posTotal === null ? 'POS amount field not present in response — check audit panel' : undefined}
              auditPanel={
                <FieldAuditPanel
                  label="POS amount"
                  rawResponse={posRawForAudit}
                  fieldPathsTried="summary.total_amount_collected, summary.total_collected, total_amount, collected_amount, amount_collected, gross_collected, pos_total, total_pos_collected, net_collected, total, total_pos_amount, pos_amount, amount_total"
                  resolvedValue={posTotal}
                  nestedKeys={[{ key: 'summary', label: 'summary' }, { key: 'metadata', label: 'metadata' }]}
                  forceShow={showFieldAudit}
                />
              }
            />
            <KpiCard
              icon="Hash"
              label="POS Transaction Count"
              value={formatNumberOrNA(posTxCount)}
              color="bg-green-500"
              auditPanel={
                <FieldAuditPanel
                  label="POS transaction count"
                  rawResponse={posRawForAudit}
                  fieldPathsTried="summary.total_payment_events, summary.transaction_count, summary.count, summary.total_transactions, summary.num_transactions, summary.tx_count"
                  resolvedValue={posTxCount}
                  nestedKeys={[{ key: 'summary', label: 'summary' }]}
                  forceShow={showFieldAudit}
                />
              }
            />
          </>
        )}

        {/* Refunds */}
        {!enabled || refundLoading ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : refundError ? (
          <div className="col-span-2">
            <SectionError message={refundError} onRetry={loadRefunds} />
          </div>
        ) : (
          <>
            <KpiCard
              icon="RotateCcw"
              label="Total Refunds"
              value={formatCurrencyOrNA(refTotal)}
              subLabel={
                <span>
                  Dentrix adjustment ledger
                  {onRefundTabLink && (
                    <button onClick={onRefundTabLink} className="ml-1 text-primary hover:underline">→ View tab</button>
                  )}
                </span>
              }
              color="bg-red-500"
              warning={refTotal === null ? 'Refund total field not present in response — backend gap' : undefined}
              auditPanel={
                <FieldAuditPanel
                  label="refund total"
                  rawResponse={refRawForAudit}
                  fieldPathsTried="summary.total_refunds, total_refund_amount, total_amount, refund_total, gross_refunds, net_refunds, amount, total, amount_total, refund_amount_total, total_true_refunds"
                  resolvedValue={refTotal}
                  forceShow={showFieldAudit}
                />
              }
            />
            <KpiCard
              icon="User"
              label="Patient Refunds"
              value={formatCurrencyOrNA(refPatient)}
              color="bg-rose-400"
              warning={refPatient === null ? 'Patient refund field not present in response — backend gap' : undefined}
              auditPanel={
                <FieldAuditPanel
                  label="patient refunds"
                  rawResponse={refRawForAudit}
                  fieldPathsTried="summary.patient_refunds, total_patient_refunds, patient_refund_amount, patient_refund_total, patient_total"
                  resolvedValue={refPatient}
                  forceShow={showFieldAudit}
                />
              }
            />
          </>
        )}

        {/* MTD from Daily Comparison */}
        {!enabled || dailyLoading ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : dailyError ? (
          <div className="col-span-2">
            <SectionError message={dailyError} onRetry={loadDaily} />
          </div>
        ) : (
          <>
            <KpiCard
              icon="TrendingUp"
              label="MTD Net Production"
              value={formatCurrencyOrNA(mtdProduction)}
              subLabel={
                <span>
                  {mtdByOfficeNote
                    ? mtdByOfficeNote
                    : 'Source: Daily Comparison'}
                  {onDailyTabLink && (
                    <button onClick={onDailyTabLink} className="ml-1 text-primary hover:underline">→ View tab</button>
                  )}
                </span>
              }
              color="bg-blue-600"
              warning={mtdWarning}
              auditPanel={
                <FieldAuditPanel
                  label="net_production"
                  rawResponse={dailyRawForAudit}
                  fieldPathsTried="mtd.current_mtd.net_production, mtd.current_mtd.netProduction, mtd.current_mtd.netProductionTotal, mtd.current_mtd.production.net_production, mtd.net_production, summary.net_production, by_office[].net_production (sum)"
                  resolvedValue={mtdProduction}
                  nestedKeys={[
                    { key: 'mtd', label: 'mtd' },
                    { key: 'by_office', label: 'by_office' },
                    { key: 'source_notes', label: 'source_notes' },
                    { key: 'summary', label: 'summary' },
                  ]}
                  forceShow={showFieldAudit}
                />
              }
            />
            <KpiCard
              icon="Percent"
              label="Collection %"
              value={collectionPct !== null ? formatPercentOrNA(collectionPct) : 'N/A'}
              subLabel={
                collectionPct !== null
                  ? 'Collections ÷ Net Production'
                  : mtdProduction === 0 && mtdCollections !== null
                    ? 'N/A — net production is zero'
                    : 'N/A — net production or collections not available'
              }
              color={collectionPct !== null ? 'bg-teal-600' : 'bg-slate-400'}
              warning={collectionPct === null && (mtdProduction !== 0 || mtdCollections === null) ? 'Source not wired or net_production field unavailable' : undefined}
            />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-2">
        Refund classification from Dentrix adjustment ledger / organization ledger types. Write-offs and balance corrections excluded from refund totals by default.
      </p>
    </div>
  );
};

// ─── Section: Insurance Claim Follow-Up Queue (Phase 1 — fast) ───────────────

const FollowUpQueueSection = ({ dateRange, officeId, refreshKey, onTabLink, enabled }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(
        fetchArAging({
          start: dateRange?.start,
          end: dateRange?.end,
          officeId: officeId || '',
        }),
        30000,
        'Insurance Claim Follow-Up Queue'
      );
      setData(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e?.message || 'Failed to load follow-up queue');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => {
    if (enabled) { load(); }
  }, [load, enabled]);

  const rows = Array.isArray(data) ? data : [];
  const count = rows?.length;
  const claimDerivedBalance = rows?.reduce((sum, r) => {
    const b = safeNumberOrNull(r?.balance);
    return sum + (b ?? 0);
  }, 0);
  const over60 = rows?.filter(r => (safeNumberOrNull(r?.days_outstanding) ?? 0) > 60)?.length;
  const over90 = rows?.filter(r => (safeNumberOrNull(r?.days_outstanding) ?? 0) > 90)?.length;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Insurance Claim Follow-Up Queue"
        sourceNote="Claim-derived follow-up balance — not official A/R. Source: /v2/rcm/ar-aging"
        onTabLink={onTabLink}
        tabLinkLabel="View AR Aging tab"
      />
      <div className="mb-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Icon name="AlertTriangle" size={11} />
          Claim-derived follow-up balance — not official A/R
        </span>
      </div>
      {!enabled || loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 })?.map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <SectionError message={error} onRetry={load} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            icon="FileSearch"
            label="Open Claim Follow-Up Count"
            value={formatNumberOrNA(count)}
            subLabel="rows.length from /v2/rcm/ar-aging"
            color="bg-amber-500"
          />
          <KpiCard
            icon="DollarSign"
            label="Claim-Derived Follow-Up Balance"
            value={formatCurrencyOrNA(claimDerivedBalance)}
            subLabel="Sum of row.balance — not official A/R"
            color="bg-orange-500"
          />
          <KpiCard
            icon="Clock"
            label="Over 60 Days Count"
            value={formatNumberOrNA(over60)}
            color="bg-red-400"
          />
          <KpiCard
            icon="AlertCircle"
            label="Over 90 Days Count"
            value={formatNumberOrNA(over90)}
            color="bg-red-600"
          />
        </div>
      )}
    </div>
  );
};

// ─── Section: Data Source Status ──────────────────────────────────────────────
// Dentrix Daily Summary = Phase 1; eAssist = Phase 2
//
// V468 FIELD-MAPPING PATCH:
//
// D. eAssist Status — broadened field mapping + field audit panel:
//    - All V467 paths preserved
//    - NEW: tries offices[].latest_report_date, latest_by_office[].date
//    - NEW: tries status_by_office, coverage, last_successful_run
//    - Field audit panel shows actual top-level keys from live response
//
// E. Dentrix Daily Summary — broadened field mapping + field audit panel:
//    - All V467 paths preserved
//    - NEW: tries report.latest_date, data.date, latest_run.report_date
//    - NEW: tries payments.breakdown_available, payment_methods (object)
//    - Field audit panel shows actual top-level keys from live response

const DataSourceStatusSection = ({ officeId, refreshKey, onEassistTabLink, onDentrixTabLink, phase1Enabled, phase2Enabled, showFieldAudit }) => {
  const [eassistData, setEassistData] = useState(null);
  const [eassistLoading, setEassistLoading] = useState(true);
  const [eassistError, setEassistError] = useState(null);

  const [dentrixData, setDentrixData] = useState(null);
  const [dentrixLoading, setDentrixLoading] = useState(true);
  const [dentrixError, setDentrixError] = useState(null);

  const loadEassist = useCallback(async () => {
    setEassistLoading(true);
    setEassistError(null);
    try {
      const result = await withTimeout(
        fetchDashboardEassistStatus(officeId),
        45000,
        'eAssist Status'
      );
      setEassistData(result);
    } catch (e) {
      setEassistError(e?.message || 'Failed to load eAssist status');
    } finally {
      setEassistLoading(false);
    }
  }, [refreshKey, officeId]);

  const loadDentrix = useCallback(async () => {
    setDentrixLoading(true);
    setDentrixError(null);
    try {
      const result = await withTimeout(
        fetchDashboardDentrixDailySummary(officeId),
        30000,
        'Dentrix Daily Summary'
      );
      setDentrixData(result);
    } catch (e) {
      setDentrixError(e?.message || 'Failed to load Dentrix Daily Summary status');
    } finally {
      setDentrixLoading(false);
    }
  }, [refreshKey, officeId]);

  useEffect(() => {
    if (phase1Enabled) { loadDentrix(); }
  }, [loadDentrix, phase1Enabled]);

  useEffect(() => {
    if (phase2Enabled) { loadEassist(); }
  }, [loadEassist, phase2Enabled]);

  // ── V468: eAssist — broadened field mapping ───────────────────────────────
  // The raw response from /v2/eassist/ingest/status is returned directly.
  // V469: Show nested keys for latestRuns, coverage, staging, latestReportByOffice
  // before declaring backend gap.

  // latestReportByOffice — try camelCase and snake_case variants
  const latestReportByOffice = eassistData?.latestReportByOffice || eassistData?.latest_report_by_office || null;
  const latestRuns = eassistData?.latestRuns || eassistData?.latest_runs || null;
  const coverageObj = eassistData?.coverage || null;
  const stagingObj = eassistData?.staging || null;

  // eAssist expected offices — Barnegat, Brick, Eatontown ONLY. Staten Island is NOT expected.
  const EASSIST_EXPECTED_OFFICES = ['Brick', 'Barnegat', 'Eatontown'];

  // Extract latest date from latestReportByOffice — prefer Brick/Barnegat/Eatontown keys directly
  const latestDateFromReportByOffice = (() => {
    if (!latestReportByOffice || typeof latestReportByOffice !== 'object') return null;
    if (Array.isArray(latestReportByOffice)) {
      const dates = latestReportByOffice
        ?.map(o => o?.report_date ?? o?.reportDate ?? o?.date ?? o?.latest_date ?? null)
        ?.filter(Boolean)?.sort()?.reverse();
      return dates?.[0] ?? null;
    }
    // Object keyed by office name — extract report_date from each expected office
    const officeDates = EASSIST_EXPECTED_OFFICES
      ?.map(officeName => {
        const officeVal = latestReportByOffice?.[officeName];
        if (!officeVal) return null;
        if (typeof officeVal === 'string') return officeVal;
        if (officeVal && typeof officeVal === 'object') {
          return officeVal?.report_date ?? officeVal?.reportDate ?? officeVal?.date ?? officeVal?.latest_date ?? null;
        }
        return null;
      })
      ?.filter(Boolean)
      ?.sort()
      ?.reverse();
    if (officeDates?.length > 0) return officeDates?.[0];
    // Fallback: try all values in the object (excluding Staten Island)
    const vals = Object.entries(latestReportByOffice)
      ?.filter(([k]) => k !== 'Staten Island' && k !== 'staten_island')
      ?.map(([, v]) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') return v?.report_date ?? v?.reportDate ?? v?.date ?? v?.latest_date ?? null;
        return null;
      })
      ?.filter(Boolean)
      ?.sort()
      ?.reverse();
    return vals?.[0] ?? null;
  })();

  // Extract latest date from latestRuns array
  const latestDateFromRuns = (() => {
    if (!latestRuns) return null;
    if (Array.isArray(latestRuns) && latestRuns?.length > 0) {
      const dates = latestRuns
        ?.map(r => r?.run_date ?? r?.runDate ?? r?.date ?? r?.report_date ?? r?.reportDate ?? null)
        ?.filter(Boolean)?.sort()?.reverse();
      return dates?.[0] ?? null;
    }
    if (typeof latestRuns === 'object') {
      return latestRuns?.run_date ?? latestRuns?.runDate ?? latestRuns?.date ?? latestRuns?.report_date ?? null;
    }
    return null;
  })();

  // Extract missing count from coverage object
  // V470: Use coverage.missingCount first, then coverage.missingReports.length as fallback
  const missingFromCoverage = (() => {
    if (!coverageObj || typeof coverageObj !== 'object') return null;
    // Primary: coverage.missingCount (camelCase)
    const missingCount = safeNumberOrNull(coverageObj?.missingCount);
    if (missingCount !== null) return missingCount;
    // Fallback: coverage.missingReports.length
    if (Array.isArray(coverageObj?.missingReports)) {
      return coverageObj?.missingReports?.length;
    }
    // Legacy snake_case fallbacks
    return safeNumberOrNull(
      coverageObj?.missing_count
      ?? coverageObj?.missing_reports
      ?? coverageObj?.missing
      ?? coverageObj?.gaps
      ?? coverageObj?.gap_count
      ?? null
    );
  })();

  // Extract missing office names from coverage.missingReports[].office_canonical
  const missingOfficeNames = (() => {
    if (!coverageObj?.missingReports || !Array.isArray(coverageObj?.missingReports)) return [];
    return coverageObj?.missingReports
      ?.map(r => r?.office_canonical ?? r?.office ?? r?.office_name ?? null)
      ?.filter(Boolean);
  })();

  const eLatestDate =
    latestDateFromReportByOffice
    ?? latestDateFromRuns
    ?? eassistData?.latest_report_date
    ?? eassistData?.last_report_date
    ?? eassistData?.latest_run_date
    ?? eassistData?.last_run_date
    ?? eassistData?.latest_ingestion_date
    ?? eassistData?.last_ingestion_date
    ?? eassistData?.latest_date
    ?? eassistData?.last_date
    ?? eassistData?.run_date
    ?? eassistData?.status?.latest_report_date
    ?? eassistData?.latest_run?.date
    ?? eassistData?.latest_run?.run_date
    ?? eassistData?.last_run?.date
    ?? eassistData?.last_run?.run_date
    ?? eassistData?.last_successful_run?.date
    ?? eassistData?.last_successful_run?.run_date
    ?? coverageObj?.latest_date
    ?? coverageObj?.lastBusinessDay
    ?? coverageObj?.last_date
    // V468: try offices[] array — find latest date across offices (exclude Staten Island)
    ?? (() => {
      const offices = eassistData?.offices || eassistData?.latest_by_office || eassistData?.status_by_office || [];
      if (!Array.isArray(offices) || offices?.length === 0) return null;
      const dates = offices
        ?.filter(o => o?.office !== 'Staten Island' && o?.office_canonical !== 'Staten Island')
        ?.map(o => o?.latest_report_date ?? o?.last_report_date ?? o?.latest_date ?? o?.date ?? null)
        ?.filter(Boolean)?.sort()?.reverse();
      return dates?.[0] ?? null;
    })()
    ?? null;

  // V470: Missing count — use missingFromCoverage (which uses coverage.missingCount first)
  // Show 0 as 0, not N/A
  const eMissing = missingFromCoverage !== null
    ? missingFromCoverage
    : safeNumberOrNull(
        eassistData?.missing_reports
        ?? eassistData?.missing_count
        ?? eassistData?.missing_report_count
        ?? eassistData?.missing
        ?? eassistData?.gaps
        ?? eassistData?.gap_count
        ?? null
      );

  const eConflicts = safeNumberOrNull(
    stagingObj?.conflict_count
    ?? stagingObj?.conflicts
    ?? eassistData?.conflicts
    ?? eassistData?.conflict_count
    ?? eassistData?.staged_conflicts
    ?? eassistData?.staged_count
    ?? eassistData?.conflict_reports
    ?? null
  );

  const eConfidence = safeNumberOrNull(
    eassistData?.parser_confidence
    ?? eassistData?.confidence
    ?? eassistData?.avg_confidence
    ?? eassistData?.average_confidence
    ?? eassistData?.parse_confidence
    ?? null
  );

  // Determine if we have nested objects to inspect (don't call backend gap if parent present)
  const eassistHasNestedObjects = !!(latestRuns || coverageObj || stagingObj || latestReportByOffice);

  // Build missing reports subLabel — list office names if count > 0
  const eMissingSubLabel = (() => {
    if (eMissing === null) return eConflicts !== null ? `${formatNumberOrNA(eConflicts)} conflicts` : undefined;
    if (eMissing === 0) return `No missing reports recorded${coverageObj?.lastBusinessDay ? ` for ${formatDateOrNA(coverageObj.lastBusinessDay)}` : ''}; receipt not confirmed.`;
    if (missingOfficeNames?.length > 0) return `Missing: ${missingOfficeNames?.join(', ')}`;
    return `${eMissing} office(s) missing — expected: Barnegat, Brick, Eatontown`;
  })();

  // ── V468: Dentrix Daily Summary — broadened field mapping ─────────────────
  const dLatestDate =
    dentrixData?.latest_report_date
    ?? dentrixData?.report_date
    ?? dentrixData?.date
    ?? dentrixData?.latest_date
    ?? dentrixData?.summary_date
    ?? dentrixData?.as_of_date
    ?? dentrixData?.report?.date
    ?? dentrixData?.summary?.date
    ?? dentrixData?.data?.date
    ?? dentrixData?.latest_run?.report_date
    ?? null;

  const pb = (dentrixData?.payment_breakdown && typeof dentrixData?.payment_breakdown === 'object' && !Array.isArray(dentrixData?.payment_breakdown))
    ? dentrixData?.payment_breakdown
    : null;

  const pbTotalDaily = pb ? safeNumberOrNull(pb?.total_daily_collections) : null;
  const pbTotalInsurance = pb ? safeNumberOrNull(pb?.total_insurance_collections) : null;
  const pbTotalPatient = pb ? safeNumberOrNull(pb?.total_patient_collections) : null;
  const pbPOS = pb ? safeNumberOrNull(pb?.pos_collections) : null;

  const pbHasAnyNumeric = pb && [pbTotalDaily, pbTotalInsurance, pbTotalPatient, pbPOS,
    safeNumberOrNull(pb?.insurance_check), safeNumberOrNull(pb?.insurance_eft),
    safeNumberOrNull(pb?.insurance_credit_card), safeNumberOrNull(pb?.patient_cash),
    safeNumberOrNull(pb?.patient_check), safeNumberOrNull(pb?.patient_credit_card)
  ]?.some(v => v !== null);

  const dPaymentBreakdownSourceNote = dentrixData?.payment_breakdown_source_note ?? null;

  // V474: Status-only — do NOT show dollar totals from today's daily summary
  // under a date-range dashboard. The endpoint always returns today's data (no
  // date param is passed), so showing $0 insurance/patient/POS would imply it
  // is the selected period total — it is not. Show availability status only.
  const dPaymentBreakdownStatus = (() => {
    if (!pb) return 'Not Available';
    if (pbHasAnyNumeric) return 'Available';
    return 'Present — no values';
  })();

  const dPaymentBreakdownColor = pb && pbHasAnyNumeric ? 'bg-green-500' : pb ? 'bg-amber-500' : 'bg-slate-400';

  const dClaimsStatus =
    dentrixData?.claims_status
    ?? dentrixData?.claims?.status
    ?? dentrixData?.summary?.claims_status
    ?? null;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader
        title="Data Source Status"
        sourceNote={null}
        onTabLink={null}
        tabLinkLabel={null}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* eAssist — Phase 2 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-foreground">eAssist Report Status</p>
              <p className="text-xs text-muted-foreground">eAssist email reports — Barnegat, Brick, Eatontown only. Not Dentrix source.</p>
            </div>
            {onEassistTabLink && (
              <button onClick={onEassistTabLink} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
                View tab <Icon name="ArrowRight" size={12} />
              </button>
            )}
          </div>
          {!phase2Enabled || eassistLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : eassistError ? (
            <SectionError message={eassistError} onRetry={loadEassist} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                icon="Mail"
                label="Latest eAssist Report"
                value={eLatestDate ? formatDateOrNA(eLatestDate) : 'N/A'}
                subLabel={eLatestDate ? `Expected: Barnegat, Brick, Eatontown` : 'Expected offices: Barnegat, Brick, Eatontown'}
                color="bg-purple-500"
                warning={eLatestDate === null ? (eassistHasNestedObjects ? 'Nested keys present — see audit panel. This is a frontend mapping issue, not a backend gap.' : 'latest_report_date field not found in /v2/eassist/ingest/status response') : undefined}
                auditPanel={
                  <FieldAuditPanel
                    label="latest_report_date"
                    rawResponse={eassistData}
                    fieldPathsTried="latestReportByOffice.Brick.report_date, latestReportByOffice.Barnegat.report_date, latestReportByOffice.Eatontown.report_date, latestReportByOffice.*.email_received_at, coverage.missingCount, coverage.missingReports, coverage.missingReports.length, latestRuns[].run_date, coverage.lastBusinessDay, coverage.latest_date, latest_report_date, last_report_date, latest_run_date, last_run.date"
                    resolvedValue={eLatestDate}
                    nestedKeys={[
                      { key: 'latestRuns', label: 'latestRuns' },
                      { key: 'latest_runs', label: 'latest_runs' },
                      { key: 'coverage', label: 'coverage' },
                      { key: 'staging', label: 'staging' },
                      { key: 'latestReportByOffice', label: 'latestReportByOffice' },
                      { key: 'latest_report_by_office', label: 'latest_report_by_office' },
                    ]}
                    forceShow={showFieldAudit}
                  />
                }
              />
              <KpiCard
                icon="AlertTriangle"
                label="Missing Reports"
                value={eMissing !== null ? String(eMissing) : 'N/A'}
                subLabel={eMissingSubLabel}
                color={eMissing !== null && eMissing > 0 ? 'bg-red-500' : 'bg-slate-500'}
                warning={eMissing === null ? (eassistHasNestedObjects ? 'Nested keys present — see audit panel. This is a frontend mapping issue, not a backend gap.' : 'missing_reports field not found in /v2/eassist/ingest/status response') : undefined}
                auditPanel={
                  <FieldAuditPanel
                    label="missing_reports"
                    rawResponse={eassistData}
                    fieldPathsTried="coverage.missingCount, coverage.missingReports, coverage.missingReports.length, coverage.missing_count, coverage.missing_reports, coverage.gaps, missing_reports, missing_count, missing_report_count, missing, gaps, gap_count"
                    resolvedValue={eMissing}
                    nestedKeys={[
                      { key: 'latestRuns', label: 'latestRuns' },
                      { key: 'latest_runs', label: 'latest_runs' },
                      { key: 'coverage', label: 'coverage' },
                      { key: 'staging', label: 'staging' },
                      { key: 'latestReportByOffice', label: 'latestReportByOffice' },
                      { key: 'latest_report_by_office', label: 'latest_report_by_office' },
                    ]}
                    forceShow={showFieldAudit}
                  />
                }
              />
              {eConfidence !== null && (
                <KpiCard
                  icon="CheckCircle"
                  label="Parser Confidence"
                  value={formatPercentOrNA(eConfidence)}
                  color="bg-teal-500"
                />
              )}
            </div>
          )}
        </div>

        {/* Dentrix Daily Summary — Phase 1 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Dentrix Daily Summary Status</p>
              <p className="text-xs text-muted-foreground">Dentrix Daily Summary — Dentrix/FastAPI source only, not eAssist.</p>
            </div>
            {onDentrixTabLink && (
              <button onClick={onDentrixTabLink} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-4">
                View tab <Icon name="ArrowRight" size={12} />
              </button>
            )}
          </div>
          {!phase1Enabled || dentrixLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : dentrixError ? (
            <SectionError message={dentrixError} onRetry={loadDentrix} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                icon="Calendar"
                label="Latest Report Date"
                value={dLatestDate ? formatDateOrNA(dLatestDate) : 'N/A'}
                subLabel="Today's daily report — not selected date range"
                color="bg-blue-500"
                warning={dLatestDate === null ? 'report_date field not found in /v2/reports/daily-summary response — backend gap' : undefined}
                auditPanel={
                  <FieldAuditPanel
                    label="report_date"
                    rawResponse={dentrixData}
                    fieldPathsTried="latest_report_date, report_date, date, latest_date, summary_date, as_of_date, report.date, summary.date, data.date, latest_run.report_date"
                    resolvedValue={dLatestDate}
                    forceShow={showFieldAudit}
                  />
                }
              />
              <KpiCard
                icon="Database"
                label="Payment Breakdown"
                value={dPaymentBreakdownStatus}
                subLabel={
                  !pb
                    ? 'payment_breakdown not found in response'
                    : 'Latest daily report only — not selected date range'
                }
                color={dPaymentBreakdownColor}
                warning={!pb ? 'payment_breakdown field not found in /v2/reports/daily-summary response — check audit panel' : undefined}
                auditPanel={
                  <FieldAuditPanel
                    label="payment_breakdown"
                    rawResponse={dentrixData}
                    fieldPathsTried="payment_breakdown.total_daily_collections, payment_breakdown.total_insurance_collections, payment_breakdown.total_patient_collections, payment_breakdown.pos_collections, payment_breakdown.insurance_check, payment_breakdown.insurance_eft, payment_breakdown.insurance_credit_card, payment_breakdown.insurance_other, payment_breakdown.insurance_unknown, payment_breakdown.patient_cash, payment_breakdown.patient_check, payment_breakdown.patient_credit_card, payment_breakdown.patient_eft_online, payment_breakdown.patient_financing, payment_breakdown.patient_other, payment_breakdown.patient_unknown, payment_breakdown_source_note"
                    resolvedValue={pb ? (pbTotalDaily !== null ? pbTotalDaily : 'object present') : null}
                    nestedKeys={[
                      { key: 'payment_breakdown', label: 'payment_breakdown' },
                      { key: 'summary', label: 'summary' },
                      { key: 'report', label: 'report' },
                      { key: 'payments', label: 'payments' },
                      { key: 'payment_methods', label: 'payment_methods' },
                    ]}
                    forceShow={showFieldAudit}
                  />
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard Component ─────────────────────────────────────────────────
/**
 * Staged fetch plan (V466 — preserved in V468):
 *
 * Phase 1 — fires immediately (fast/high-value sections):
 *   Claim Activity, Patient Portion Reconciliation, POS Collections,
 *   Collection Refunds, Daily Comparison, Dentrix Daily Summary,
 *   Insurance Claim Follow-Up Queue
 *
 * Phase 2 — fires after 200ms (medium):
 *   eAssist Status
 *
 * Phase 3 — fires after 400ms (slow Dentrix live snapshot calls):
 *   Official A/R Snapshot, True Patient Balances
 */
const RcmDashboardTab = ({ dateRange, officeId, refreshKey, offices, onTabChange }) => {
  const officeLabel = officeId
    ? (offices?.find(o => o?.id === officeId)?.name || 'Selected Office')
    : 'All Offices';

  const [phase1, setPhase1] = useState(false);
  const [phase2, setPhase2] = useState(false);
  const [phase3, setPhase3] = useState(false);

  // V477: Field audit debug toggle — default OFF (hidden from normal executive view)
  const [showFieldAudit, setShowFieldAudit] = useState(false);

  const phase2TimerRef = useRef(null);
  const phase3TimerRef = useRef(null);

  useEffect(() => {
    setPhase1(false);
    setPhase2(false);
    setPhase3(false);

    if (phase2TimerRef?.current) clearTimeout(phase2TimerRef?.current);
    if (phase3TimerRef?.current) clearTimeout(phase3TimerRef?.current);

    const p1 = setTimeout(() => setPhase1(true), 0);
    phase2TimerRef.current = setTimeout(() => setPhase2(true), 200);
    phase3TimerRef.current = setTimeout(() => setPhase3(true), 400);

    return () => {
      clearTimeout(p1);
      if (phase2TimerRef?.current) clearTimeout(phase2TimerRef?.current);
      if (phase3TimerRef?.current) clearTimeout(phase3TimerRef?.current);
    };
  }, [refreshKey, officeId, dateRange?.start, dateRange?.end]);

  const handleTabLink = (tabId) => {
    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1 — RCM Command Center Header */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">RCM Command Center</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dashboard uses verified RCM endpoints. Official A/R is current snapshot; date-ranged cards follow selected date range.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon name="Calendar" size={13} />
              {dateRange?.start} — {dateRange?.end}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="Building2" size={13} />
              {officeLabel}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${phase1 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {phase1 ? '✓' : '○'} Fast sections
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${phase2 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
            {phase2 ? '✓' : '○'} eAssist
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${phase3 ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
            {phase3 ? '✓' : '⏳'} Live Dentrix snapshots
          </span>
        </div>
      </div>

      {/* Section 2 — Claim Activity (Phase 1) */}
      <ClaimActivitySection
        dateRange={dateRange}
        officeId={officeId}
        refreshKey={refreshKey}
        onTabLink={() => handleTabLink('claims')}
        enabled={phase1}
      />

      {/* Section 3 — Official A/R Snapshot (Phase 3 — slow Dentrix live) */}
      <OfficialArSection
        officeId={officeId}
        refreshKey={refreshKey}
        onTabLink={() => handleTabLink('ar_aging')}
        enabled={phase3}
      />

      {/* Section 4 — Patient Balances (Phase 3) & Patient Portion (Phase 1) */}
      <PatientBalancesSection
        officeId={officeId}
        dateRange={dateRange}
        refreshKey={refreshKey}
        onBalancesTabLink={() => handleTabLink('patient_balances')}
        onPortionTabLink={() => handleTabLink('patient_portion_recon')}
        phase1Enabled={phase1}
        phase3Enabled={phase3}
      />

      {/* Section 5 — Collections / Refunds / Operational Trend (Phase 1) */}
      <CollectionsSection
        dateRange={dateRange}
        officeId={officeId}
        refreshKey={refreshKey}
        onPosTabLink={() => handleTabLink('pos')}
        onRefundTabLink={() => handleTabLink('refund')}
        onDailyTabLink={() => handleTabLink('daily_comparison')}
        enabled={phase1}
        showFieldAudit={showFieldAudit}
      />

      {/* Section 6 — Follow-Up Queues (Phase 1) */}
      <FollowUpQueueSection
        dateRange={dateRange}
        officeId={officeId}
        refreshKey={refreshKey}
        onTabLink={() => handleTabLink('ar_aging')}
        enabled={phase1}
      />

      {/* Section 7 — Data Source Status (Dentrix=Phase1, eAssist=Phase2) */}
      <DataSourceStatusSection
        officeId={officeId}
        refreshKey={refreshKey}
        onEassistTabLink={() => handleTabLink('eassist_reports')}
        onDentrixTabLink={() => handleTabLink('eassist_daily')}
        phase1Enabled={phase1}
        phase2Enabled={phase2}
        showFieldAudit={showFieldAudit}
      />

      {/* V477: Field Audit Debug Toggle — collapsed by default */}
      <div className="border-t border-border pt-3 pb-1">
        <button
          onClick={() => setShowFieldAudit(v => !v)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name={showFieldAudit ? 'EyeOff' : 'Eye'} size={13} />
          {showFieldAudit ? 'Hide field audit panels' : 'Show field audit (debug)'}
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium">
            {showFieldAudit ? 'ON' : 'OFF'}
          </span>
        </button>
        {showFieldAudit && (
          <p className="text-[10px] text-amber-600 mt-1">
            Field audit mode active — showing raw response key inspection panels on all cards. Turn off for normal executive view.
          </p>
        )}
      </div>
    </div>
  );
};

export default RcmDashboardTab;
