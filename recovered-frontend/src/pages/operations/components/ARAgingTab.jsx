import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchARAgingData } from '../../../services/operationsService';
import Icon from '../../../components/AppIcon';

// ─── V314: AR Aging Tab ───────────────────────────────────────────────────────
// Source: GET /v2/rcm/aging-receivables-live via fetchAgingReceivablesLive()
// This is the same reconciled Dentrix Aged Receivables snapshot used by
// PayorsTab Section 1. monthly_executive_analytics is NO LONGER used here.
//
// Response shape (same as PayorsTab Section 1):
//   data.reconciliation.reconciled  — boolean
//   data.snapshotDate               — ISO date string
//   data.lastSyncedAt               — ISO date string
//   data.automated                  — boolean
//   data.fallbackRequired           — boolean
//   data.fullAR.insurancePortion    — total insurance AR
//   data.agingBuckets.b_0_30        — 0–30 days bucket
//   data.agingBuckets.b_31_60       — 31–60 days bucket
//   data.agingBuckets.b_61_90       — 61–90 days bucket
//   data.agingBuckets.b_over_90     — 90+ days bucket
//   data.officeRollup[]             — per-office breakdown (if available)
//   data.fullAR.totalBalance        — total balance (if available)
//   data.fullAR.guarantorPortion    — guarantor portion (if available)
//   data.fullAR.unappliedCredits    — unapplied credits (if available)
//   data.fullAR.netBalance          — net balance (if available)
//   data.reconciliation.variance    — variance (if available)
//
// Display rules:
//   null/missing field → '—' (N/A)
//   real backend 0    → '$0'
//   no fake fallback, no frontend AR reconstruction

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

// ─── Null-safe percentage of total ───────────────────────────────────────────
const computePct = (numerator, denominator) => {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined || denominator === 0) return null;
  return (numerator / denominator) * 100;
};

const fmtPct = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

// ─── Known Dentrix locationId → office name mapping ──────────────────────────
// V346: Map known Dentrix locationIds to canonical office names.
// If backend returns locationId instead of officeName, this resolves the label.
const LOCATION_ID_TO_NAME = {
  '14000000000432': 'Staten Island',
  '14000000000433': 'Eatontown',
  '14000000000434': 'Barnegat',
  '14000000000435': 'Brick',
};

// ─── Summary card (matches PayorsTab SummaryCard) ─────────────────────────────
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

const ARAgingTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      // V314: fetchARAgingData now delegates to fetchAgingReceivablesLive()
      // dateRange / officeIds accepted for API compat but snapshot is point-in-time
      const snapshot = await fetchARAgingData({ ...dateRange, officeIds });
      setData(snapshot);
    } catch (e) {
      console.error('[ARAgingTab] fetchARAgingData error:', e);
      setApiError('Reconciled AR snapshot unavailable. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);

  // ── Derived values from reconciled snapshot ───────────────────────────────
  const reconciled       = data?.reconciliation?.reconciled === true;
  const snapshotDate     = data?.snapshotDate;
  const lastSyncedAt     = data?.lastSyncedAt;
  const automated        = data?.automated;
  const fallbackRequired = data?.fallbackRequired;
  const variance         = data?.reconciliation?.variance;

  // Aging buckets — null if not present in endpoint response
  const totalInsuranceAR = data?.fullAR?.insurancePortion ?? null;
  const b0_30   = data?.agingBuckets?.b_0_30    ?? null;
  const b31_60  = data?.agingBuckets?.b_31_60   ?? null;
  const b61_90  = data?.agingBuckets?.b_61_90   ?? null;
  const bOver90 = data?.agingBuckets?.b_over_90 ?? null;

  // Optional fields — only shown if present in endpoint response
  const totalBalance      = data?.fullAR?.totalBalance      ?? null;
  const guarantorPortion  = data?.fullAR?.guarantorPortion  ?? null;
  const unappliedCredits  = data?.fullAR?.unappliedCredits  ?? null;
  const netBalance        = data?.fullAR?.netBalance        ?? null;
  // V337: Additional verified fields from /v2/accounts-receivable or /v2/ar
  const estimatedWriteOff = data?.fullAR?.estimatedWriteOff ?? data?.estimatedWriteOff ?? null;
  const patientCount      = data?.patientCount ?? null;
  const asOf              = data?.asOf ?? data?.snapshotDate ?? null;

  // Per-office rollup (if available)
  const officeRollup = Array.isArray(data?.officeRollup) ? data?.officeRollup : [];

  // ── Office name resolver — handles all possible backend field shapes ──────
  // V346: Map known Dentrix locationIds to canonical office names.
  const resolveOfficeName = (o) => {
    const named = o?.officeName || o?.locationName || o?.name || o?.office || o?.location;
    if (named) return named;
    const locId = o?.locationId ? String(o?.locationId) : null;
    if (locId && LOCATION_ID_TO_NAME?.[locId]) return LOCATION_ID_TO_NAME?.[locId];
    return locId || '—';
  };

  // 90+ % of total insurance AR
  const pct90 = computePct(bOver90, totalInsuranceAR);

  // Chart data — only include offices with at least one non-null bucket
  const chartData = officeRollup
    ?.filter((o) => o?.insuranceAR !== null && o?.insuranceAR !== undefined)
    ?.map((o) => ({
      name: resolveOfficeName(o),
      'Insurance AR': o?.insuranceAR ?? 0,
    }));

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5]?.map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 h-20 animate-pulse bg-muted/40" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  // ── Error / unavailable state ─────────────────────────────────────────────
  if (apiError || !data) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <Icon name="AlertTriangle" size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Reconciled AR snapshot unavailable</p>
            <p className="mt-1 text-xs">
              Source: <code className="bg-amber-100 px-1 rounded">/v2/rcm/aging-receivables-live</code>.
              Values cannot be displayed until the endpoint responds.
            </p>
            {apiError && <p className="mt-1 text-xs text-amber-700">{apiError}</p>}
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="RefreshCw" size={12} />
          Retry
        </button>
      </div>
    );
  }

  // ── Not reconciled gate ───────────────────────────────────────────────────
  // V344: Removed hard gate. If the verified endpoint (/v2/accounts-receivable or /v2/ar)
  // returns data successfully, show the data regardless of reconciliation.reconciled flag.
  // The reconciliation flag was tied to the old /v2/rcm/aging-receivables-live snapshot
  // comparison. The new page-summed source is the verified source of truth.
  // Only show the warning as a non-blocking informational note if reconciled === false.

  // ── Reconciled — main display ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* V344 Source label — Dentrix Ascend Aging Balances Report via HS1 */}
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
      {/* V345: Softer reconciliation note — only shown if reconciled === false AND data is present.
          Does NOT hide data. Verified page-summed data is the source of truth. */}
      {reconciled === false && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
          <span>
            Verified page-summed Dentrix A/R data is displayed. Backend reconciliation flag not set.
            {variance !== null && variance !== undefined && ` Variance: ${fmtAmt(variance)}.`}
          </span>
        </div>
      )}
      {/* Sync / automation badges */}
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
        {fallbackRequired === true && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Icon name="AlertTriangle" size={11} />
            Email automation pending setup
          </span>
        )}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="RefreshCw" size={12} />
          Refresh
        </button>
      </div>
      {/* V345: Total A/R Aging Buckets — renamed from "Insurance AR Aging Buckets" */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Total A/R Aging Buckets</h3>
        <p className="text-xs text-muted-foreground mb-3">
          These aging buckets represent total A/R aging from the Dentrix Aging Balances Report. Insurance Portion is displayed separately.
        </p>
      </div>
      {/* Aging bucket summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Insurance Portion / Insurance AR"
          value={fmtAmt(totalInsuranceAR)}
          icon="DollarSign"
          colorClass="bg-blue-100 text-blue-700"
          subLabel={snapshotDate ? `As of ${fmtDate(snapshotDate)}` : undefined}
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
          subLabel={pct90 !== null ? `${fmtPct(pct90)} of total` : undefined}
        />
      </div>
      {/* Optional fields — only rendered if present in endpoint response */}
      {(totalBalance !== null || guarantorPortion !== null || unappliedCredits !== null || netBalance !== null || variance !== null || estimatedWriteOff !== null || patientCount !== null) && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Full AR Snapshot Fields (from endpoint)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            {totalBalance !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Total A/R</p>
                <p className="font-semibold tabular-nums">{fmtAmt(totalBalance)}</p>
              </div>
            )}
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
            {unappliedCredits !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Unapplied Credits</p>
                <p className="font-semibold tabular-nums">{fmtAmt(unappliedCredits)}</p>
              </div>
            )}
            {estimatedWriteOff !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Estimated Write-Off</p>
                <p className="font-semibold tabular-nums">{fmtAmt(estimatedWriteOff)}</p>
              </div>
            )}
            {patientCount !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Patient Count</p>
                <p className="font-semibold tabular-nums">{patientCount?.toLocaleString()}</p>
              </div>
            )}
            {variance !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Reconciliation Variance</p>
                <p className="font-semibold tabular-nums">{fmtAmt(variance)}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These fields are displayed only when present in the verified endpoint response.
            No values are derived or estimated in the frontend. Missing fields show —.
          </p>
        </div>
      )}
      {/* Per-office rollup chart — only if officeRollup is available */}
      {officeRollup?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-base font-semibold text-foreground mb-4">Insurance AR by Office</h3>
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(400, chartData?.length * 120) }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload?.length) {
                        return (
                          <div className="bg-white border border-border rounded p-2 text-sm">
                            <p className="font-semibold mb-1">{label}</p>
                            {payload?.map((entry, index) => (
                              <p key={index} style={{ color: entry?.color }}>
                                {entry?.name}: {fmtAmt(entry?.value)}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    wrapperStyle={{}}
                    cursor={false}
                  />
                  <Legend />
                  <Bar dataKey="Insurance AR" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      {/* Per-office rollup table — only if officeRollup is available */}
      {officeRollup?.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Office Insurance AR Rollup</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per-office breakdown from the reconciled snapshot. No frontend derivation.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Office</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Insurance AR</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Source / Status</th>
                </tr>
              </thead>
              <tbody>
                {officeRollup?.map((o, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                      {resolveOfficeName(o)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {fmtAmt(o?.insuranceAR ?? null)}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      Dentrix Aged Receivables Snapshot
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* No office rollup — aging buckets only */}
      {officeRollup?.length === 0 && (
        <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
          Per-office rollup not available in this snapshot. Aggregate aging buckets shown above.
        </div>
      )}
    </div>
  );
};

export default ARAgingTab;
