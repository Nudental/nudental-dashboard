import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import {
  fetchAutomatedKPIs,
  fetchAutomatedTrendData,
  fetchAutomatedOfficeChart,
} from '../../../services/executiveSummaryAutomatedService';
import { MONTH_NAMES } from '../../../services/executiveMonthlyAnalyticsService';

// ─── Display formatters ───────────────────────────────────────────────────────
// null/undefined → '—'   |   real 0 → '$0'   |   real value → formatted
const fmtCurrency = (val) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })?.format(val);
};

const fmtPct = (val) => {
  if (val === null || val === undefined) return '—';
  return `${(val * 100)?.toFixed(1)}%`;
};

const fmtCount = (val) => {
  if (val === null || val === undefined) return '—';
  return val?.toLocaleString();
};

// ─── Constants ────────────────────────────────────────────────────────────────
const currentYear  = new Date()?.getFullYear();
const YEARS        = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

// ─── Sub-components ───────────────────────────────────────────────────────────
const KPICard = ({ label, value, subtext, icon, highlight, sourceNote }) => (
  <div className={`bg-card border rounded-xl p-4 shadow-sm ${
    highlight ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-border'
  }`}>
    <div className="flex items-start justify-between mb-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={14} color="var(--color-primary)" />
      </div>
    </div>
    <p className={`text-xl font-bold ${highlight ? 'text-red-600' : 'text-foreground'}`}>
      {value}
    </p>
    {subtext && (
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
    )}
    {sourceNote && (
      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 italic">{sourceNote}</p>
    )}
  </div>
);

const SourceNotWiredCard = ({ label, icon, reason }) => (
  <div className="bg-card border border-dashed border-border rounded-xl p-4 shadow-sm opacity-70">
    <div className="flex items-start justify-between mb-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={14} color="var(--color-muted-foreground)" />
      </div>
    </div>
    <p className="text-xl font-bold text-muted-foreground">N/A</p>
    <p className="text-[10px] text-muted-foreground mt-0.5 italic">{reason}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload?.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p?.color }}>
          {p?.name}:{' '}
          {p?.name?.toLowerCase()?.includes('patient')
            ? (p?.value === null ? '—' : p?.value?.toLocaleString())
            : (p?.value === null ? '—' : fmtCurrency(p?.value))}
        </p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ExecutiveSummaryTab = () => {
  const [officeFilter, setOfficeFilter]   = useState('all');
  const [yearFilter,   setYearFilter]     = useState(currentYear);
  const [monthFilter,  setMonthFilter]    = useState(new Date()?.getMonth() + 1);
  const [ytdMode,      setYtdMode]        = useState(false);

  const [kpis,         setKpis]           = useState(null);
  const [trendData,    setTrendData]      = useState(null);
  const [officeChart,  setOfficeChart]    = useState(null);
  const [loading,      setLoading]        = useState(false);
  const [error,        setError]          = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiResult, trendResult, officeResult] = await Promise.all([
        fetchAutomatedKPIs({
          officeId: officeFilter,
          year:     yearFilter,
          month:    monthFilter,
          ytd:      ytdMode,
        }),
        fetchAutomatedTrendData({
          officeId: officeFilter,
          year:     yearFilter,
          month:    monthFilter,
        }),
        fetchAutomatedOfficeChart({
          year:  yearFilter,
          month: monthFilter,
          ytd:   ytdMode,
        }),
      ]);
      setKpis(kpiResult);
      setTrendData(trendResult);
      setOfficeChart(officeResult);
    } catch (e) {
      setError(e?.message || 'Failed to load automated data.');
    } finally {
      setLoading(false);
    }
  }, [officeFilter, yearFilter, monthFilter, ytdMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Chart data builders ──────────────────────────────────────────────────
  // Production vs Collections by Office (All Offices view)
  const officeBarData = (officeChart || [])?.map((o) => ({
    name:        o?.name,
    Production:  o?.netProduction,
    Collections: o?.totalCollections,
  }));

  // 6-month trend (single office or all-offices aggregated)
  const trendLineData = (trendData?.months || [])?.map((m, i) => ({
    name:        m?.label,
    Production:  trendData?.production?.[i] ?? null,
    Collections: trendData?.collections?.[i] ?? null,
  }));

  const newPatientsTrendData = (trendData?.months || [])?.map((m, i) => ({
    name:          m?.label?.slice(0, 3), // "Jan", "Feb", …
    'New Patients': trendData?.newPatients?.[i] ?? null,
  }));

  // ─── AR values ───────────────────────────────────────────────────────────
  const ar = kpis?.ar || {};

  // ── AR Aging chart data ───────────────────────────────────────────────────
  // V344: Bucket fields mapped from agingBuckets.b_0_30/b_31_60/b_61_90/b_over_90
  // via executiveSummaryAutomatedService → ar.current / ar.b30_60 / ar.b60_90 / ar.b90plus
  // Show chart if any bucket has a non-null value (not gated on totalAR).
  const hasArBuckets = ar?.current !== null || ar?.b30_60 !== null || ar?.b60_90 !== null || ar?.b90plus !== null;

  const arBucketData = hasArBuckets
    ? [{
        name:              'AR Aging',
        'Current / 0–30':  ar?.current,
        '31–60':           ar?.b30_60,
        '61–90':           ar?.b60_90,
        '90+':             ar?.b90plus,
      }]
    : [];

  return (
    <div className="space-y-6">
      {/* ── Automated Source Banner ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-900/10 dark:border-emerald-800/30">
        <div className="flex-shrink-0 mt-0.5">
          <Icon name="CheckCircle" size={16} color="#059669" />
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Automated summary from verified Dentrix/Finance sources.
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
            Legacy manual <code className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">monthly_executive_analytics</code> data is <strong>not used</strong> for these actuals.
            Sources: Dentrix Ascend <code className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">/v2/production/summary</code>,{' '}
            <code className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">/v2/collections/summary</code>,{' '}
            <code className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">/v2/patients/summary</code>.
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
            A/R Summary: <strong>Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report, page-summed through Nu Dashboard middleware</strong>
            {ar?.asOf ? ` · As of: ${ar?.asOf}` : ''}.
          </p>
        </div>
      </div>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Filter" size={14} color="var(--color-muted-foreground)" />
            <span className="text-xs font-medium text-muted-foreground">Filters:</span>
          </div>

          {/* Office filter */}
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e?.target?.value)}
            className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            <option value="all">All Offices</option>
            <option value="220372a5-afae-49c9-8a0c-f4c0717ff352">Eatontown</option>
            <option value="b0abcc46-55e8-4529-a28f-eedf41c1d72e">Staten Island</option>
            <option value="54626997-57c2-4934-8743-1dabb4d176f4">Brick</option>
            <option value="1c719b5b-fd77-4da8-a1b9-2209f1cea63e">Barnegat</option>
          </select>

          {/* Year filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e?.target?.value))}
            className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          >
            {YEARS?.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Month filter (hidden in YTD mode) */}
          {!ytdMode && (
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(parseInt(e?.target?.value))}
              className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            >
              {MONTH_NAMES?.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          )}

          {/* YTD toggle */}
          <button
            onClick={() => setYtdMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              ytdMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <Icon name="Calendar" size={12} />
            YTD
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors ml-auto disabled:opacity-50"
          >
            <Icon name="RefreshCw" size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader" size={24} color="var(--color-primary)" className="animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Loading automated data…</span>
        </div>
      )}
      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      {!loading && !error && kpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Net Production */}
            <KPICard
              label="Net Production"
              value={fmtCurrency(kpis?.netProduction)}
              icon="TrendingUp"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix /v2/production/summary → netProduction"
            />

            {/* Collections Total */}
            <KPICard
              label="Collections Total"
              value={fmtCurrency(kpis?.totalCollections)}
              icon="DollarSign"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix /v2/collections/summary → totalCollections"
            />

            {/* Collection % */}
            <KPICard
              label="Collection %"
              value={fmtPct(kpis?.collectionPct)}
              icon="Percent"
              highlight={false}
              subtext={undefined}
              sourceNote={
                kpis?.collectionPct === null
                  ? 'N/A — requires both Production and Collections' : 'totalCollections ÷ netProduction'
              }
            />

            {/* New Patients */}
            <KPICard
              label="New Patients"
              value={fmtCount(kpis?.newPatients)}
              icon="UserPlus"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix /v2/patients/summary → newPatients"
            />

            {/* Total A/R */}
            <KPICard
              label="Total A/R"
              value={fmtCurrency(ar?.totalAR)}
              icon="CreditCard"
              highlight={false}
              subtext={undefined}
              sourceNote={
                ar?.asOf
                  ? `Source: Dentrix Ascend Aging Balances Report via HS1 · As of: ${ar?.asOf}`
                  : 'Source: Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report'
              }
            />

            {/* Net Balance */}
            <KPICard
              label="Net Balance"
              value={fmtCurrency(ar?.netBalance)}
              icon="TrendingDown"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix Ascend Aging Balances Report → netBalance"
            />

            {/* 90+ A/R % */}
            <KPICard
              label="90+ A/R %"
              value={fmtPct(ar?.pct90plus)}
              icon="AlertTriangle"
              highlight={ar?.pct90plus !== null && ar?.pct90plus > 0.10}
              subtext={ar?.pct90plus !== null && ar?.pct90plus > 0.10 ? 'High Risk' : undefined}
              sourceNote="Computed from verified aging buckets"
            />

            {/* AR Current */}
            <KPICard
              label="AR Current (0–30)"
              value={fmtCurrency(ar?.current)}
              icon="Clock"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix Ascend Aging Balances Report → agingBuckets.b_0_30"
            />

            {/* AR 90+ */}
            <KPICard
              label="AR 90+"
              value={fmtCurrency(ar?.b90plus)}
              icon="AlertCircle"
              highlight={ar?.b90plus !== null && ar?.b90plus > 0}
              subtext={undefined}
              sourceNote="Source: Dentrix Ascend Aging Balances Report → agingBuckets.b_over_90"
            />
          </div>

          {/* V337: Additional verified A/R fields */}
          {(ar?.insurancePortion !== null || ar?.guarantorPortion !== null || ar?.estimatedWriteOff !== null || ar?.unappliedCredits !== null || ar?.b30_60 !== null || ar?.b60_90 !== null || ar?.patientCount !== null) && (
            <div className="bg-card border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ShieldCheck" size={14} className="text-blue-600" />
                <p className="text-xs font-semibold text-blue-900">
                  Full A/R Breakdown — Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report, page-summed through Nu Dashboard middleware
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                {[
                  { label: 'Insurance Portion',   val: ar?.insurancePortion },
                  { label: 'Guarantor Portion',   val: ar?.guarantorPortion },
                  { label: 'Estimated Write-Off', val: ar?.estimatedWriteOff },
                  { label: 'Unapplied Credits',   val: ar?.unappliedCredits },
                  { label: '31–60 Days',          val: ar?.b30_60 },
                  { label: '61–90 Days',          val: ar?.b60_90 },
                  ...(ar?.patientCount != null ? [{ label: 'Patient Count', val: null, count: ar?.patientCount }] : []),
                ]?.map(({ label, val, count }, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums text-foreground">
                      {count != null
                        ? count?.toLocaleString()
                        : (val === null || val === undefined)
                          ? '—'
                          : fmtCurrency(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Phase 1B KPI Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Active Patients — /v2/patients/summary (same call as newPatients) */}
            <KPICard
              label="Active Patients"
              value={fmtCount(kpis?.activePatients)}
              icon="Users"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix /v2/patients/summary → activePatients / uniquePatients"
            />

            {/* Broken Appointments — /v2/appointments/summary */}
            <KPICard
              label="Broken Appointments"
              value={fmtCount(kpis?.brokenAppointments)}
              icon="CalendarX"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: Dentrix /v2/appointments/summary → broken / brokenAppointments"
            />

            {/* Hygiene Production — /v2/reports/provider-performance */}
            <KPICard
              label="Hygiene Production"
              value={fmtCurrency(kpis?.hygieneProduction)}
              icon="Activity"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: /v2/reports/provider-performance → providerTypeMetrics.hygienist.netProduction"
            />

            {/* Doctor Production — /v2/reports/provider-performance (same call) */}
            <KPICard
              label="Doctor Production"
              value={fmtCurrency(kpis?.doctorProduction)}
              icon="Stethoscope"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: /v2/reports/provider-performance → providerTypeMetrics.doctor.netProduction"
            />

            {/* Marketing Spend — /v2/marketing/amex-spend */}
            <KPICard
              label="Marketing Spend"
              value={fmtCurrency(kpis?.marketingSpend)}
              icon="Megaphone"
              highlight={false}
              subtext={undefined}
              sourceNote="Source: /v2/marketing/amex-spend → spend"
            />

            {/* Cost per New Patient — computed only if both values available */}
            <KPICard
              label="Cost / New Patient"
              value={fmtCurrency(kpis?.costPerNewPatient)}
              icon="TrendingDown"
              highlight={false}
              subtext={
                kpis?.costPerNewPatient === null
                  ? 'N/A — requires Marketing Spend + New Patients'
                  : undefined
              }
              sourceNote="marketingSpend ÷ newPatients (Dentrix) — null if either unavailable"
            />

            {/* Payroll Total — Source Not Wired in Phase 1B */}
            <SourceNotWiredCard
              label="Payroll Total"
              icon="Briefcase"
              reason="Source Not Wired — Requires gusto_expense_facts backfill confirmation before Phase 1B wiring."
            />

            {/* Expenses Total — Source Not Wired in Phase 1B */}
            <SourceNotWiredCard
              label="Expenses Total"
              icon="Receipt"
              reason="Source Not Wired — Requires Finance monthly total verification before Phase 1B wiring."
            />
          </div>

          {/* Net Income Estimate + Production Adjustments — Phase 1C */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceNotWiredCard
              label="Net Income Estimate"
              icon="BarChart2"
              reason="Source Not Wired — Requires verified Expenses Total. Will be computed as Collections − Expenses Total once both are confirmed."
            />
            {/* Production Adjustments — Phase 1C: /v2/adjustments/summary → totalProductionAdjustments */}
            <KPICard
              label="Production Adjustments"
              value={fmtCurrency(kpis?.productionAdjustments)}
              icon="Sliders"
              highlight={false}
              subtext="Net production adjustments · Signed · Already reflected in Net Production"
              sourceNote="Source: /v2/adjustments/summary → totalProductionAdjustments · Dentrix adjustment date"
            />
          </div>

          {/* Writeoffs — Phase 1C: /v2/adjustments/summary → writeOffs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Writeoffs — signed, normally negative, production reduction */}
            <KPICard
              label="Writeoffs / Production Reduction"
              value={fmtCurrency(kpis?.writeoffs)}
              icon="TrendingDown"
              highlight={false}
              subtext="Signed · Normally negative · Production reduction"
              sourceNote="Source: /v2/adjustments/summary → writeOffs · Dentrix adjustment date"
            />
            <SourceNotWiredCard
              label="Refunds"
              icon="RotateCcw"
              reason="Source Not Wired — /v2/rcm/collection-refunds covers insurance refunds only. May miss Rebill variants / patient refunds. Pending source confirmation."
            />
          </div>

          {/* Case Acceptance + Chair Utilization — Source Not Wired */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceNotWiredCard
              label="Case Acceptance %"
              icon="CheckCircle"
              reason="Source Not Wired — Requires Dentrix TxCase / case-acceptance integration. tx_diagnosed_value and tx_accepted_value from monthly_executive_analytics are not used."
            />
            <SourceNotWiredCard
              label="Chair Utilization %"
              icon="Layout"
              reason="Source Not Wired — No verified Dentrix chair-hour endpoint available in Phase 1A/1B."
            />
          </div>

          {/* AR reconciliation warning */}
          {ar?.reconciled === false && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-900/10 dark:border-amber-800/30">
              <Icon name="AlertTriangle" size={16} color="#d97706" className="flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>AR Reconciliation Warning:</strong> The aging-receivables-live snapshot reports <code className="font-mono text-[10px]">reconciled: false</code>. AR values above may be incomplete. Do not rely on these figures until the snapshot reconciles.
              </p>
            </div>
          )}

          {/* ── Charts ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Production vs Collections by Office */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Production vs Collections by Office
              </h3>
              <p className="text-[10px] text-muted-foreground mb-4">
                Source: Dentrix /v2/production/summary + /v2/collections/summary per office · netProduction / totalCollections
              </p>
              {officeBarData?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={officeBarData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Production"  fill="#4f46e5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Collections" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
                  Source not wired or no data available
                </div>
              )}
            </div>

            {/* AR Aging Buckets */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                A/R Aging Buckets
              </h3>
              <p className="text-[10px] text-muted-foreground mb-1">
                Source: /v2/rcm/aging-receivables-live · Org-wide snapshot
                {ar?.snapshotDate ? ` · Snapshot: ${ar?.snapshotDate}` : ''}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-3 italic">
                Office-level aging buckets not available in the current snapshot response · Showing org-wide AR aging
              </p>

              {arBucketData?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={arBucketData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Current / 0–30" stackId="ar" fill="#10b981" />
                    <Bar dataKey="31–60"          stackId="ar" fill="#f59e0b" />
                    <Bar dataKey="61–90"          stackId="ar" fill="#f97316" />
                    <Bar dataKey="90+"            stackId="ar" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
                  AR aging buckets unavailable — /v2/accounts-receivable or /v2/ar not responding
                </div>
              )}
            </div>

            {/* 6-Month Production / Collections Trend */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                6-Month Production / Collections Trend
              </h3>
              <p className="text-[10px] text-muted-foreground mb-4">
                Source: Dentrix /v2/production/summary + /v2/collections/summary per month · Missing months show as chart gap
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendLineData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Production"  stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="Collections" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* New Patients Trend */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                New Patients Trend (Last 6 Months)
              </h3>
              <p className="text-[10px] text-muted-foreground mb-4">
                Source: Dentrix /v2/patients/summary → newPatients per month · Missing months show as chart gap
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={newPatientsTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="New Patients"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#4f46e5' }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Metrics Not Included in Phase 1C — Source Not Wired ─────── */}
          <div className="bg-card border border-dashed border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Info" size={14} color="var(--color-muted-foreground)" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Metrics Not Wired — Source Not Wired
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'Lab Fees',
                'Supplies',
                'Refunds',
                'Outstanding Claims',
                'TX Diagnosed Value',
                'TX Accepted Value',
                'Chair Utilization',
              ]?.map((m) => (
                <div key={m} className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded-lg">
                  <Icon name="Minus" size={10} color="var(--color-muted-foreground)" />
                  <span className="text-[10px] text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 italic">
              These metrics require additional backend endpoint confirmation or new Dentrix integrations before they can be automated. They are not sourced from monthly_executive_analytics in this view.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ExecutiveSummaryTab;
