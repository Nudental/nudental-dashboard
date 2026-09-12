/**
 * PeriodComparisonView.jsx — V568
 *
 * Sources:
 *   Net Production / Gross Production / Production Adjustments:
 *     Dentrix/FastAPI  ascendApi.getProduction(start, end, locationId)
 *   Collections:
 *     Dentrix/FastAPI  ascendApi.getCollections(start, end, locationId)
 *   Total Expenses:
 *     Finance Expense Report protected source — fetchExpenseKPIs({ startDate, endDate, officeIds })
 *     (same function used by Reports top Total Expenses card, P&L Summary, Expense Breakdown)
 *
 * NOT USED:
 *   revenue_entries, daily_entries, MEA — none of these are used here.
 *
 * Unsupported legacy filters (Category Group, Provider Type) are disabled and
 * labeled so they cannot silently produce fake $0 results.
 */

import React, { useState, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { ascendApi } from '../../../services/ascendApi';
import { fetchExpenseKPIs } from '../../../services/expenseReportService';
import { getLocationIdByOfficeId, OFFICE_MAP } from '../../../constants/offices';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (v) =>
  v !== null && v !== undefined && !isNaN(v)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v)
    : '—';

const fmtPct = (v) =>
  v !== null && v !== undefined && !isNaN(v)
    ? `${v?.toFixed(1)}%`
    : '—';

const fmtVarPct = (v) =>
  v !== null && v !== undefined && !isNaN(v)
    ? `${v >= 0 ? '+' : ''}${v?.toFixed(1)}%`
    : '—';

const fmtPpDiff = (a, b) => {
  if (a === null || b === null || isNaN(a) || isNaN(b)) return '—';
  const diff = b - a;
  return `${diff >= 0 ? '+' : ''}${diff?.toFixed(1)} pp`;
};

// ── Office helpers ────────────────────────────────────────────────────────────
const ALL_OFFICE_IDS = Object.keys(OFFICE_MAP);

/**
 * Resolve locationId and officeIds arrays from the internal office dropdown value.
 * Returns { locationId, officeIds } suitable for ascendApi and fetchExpenseKPIs.
 *
 * officeFilterLocal values:
 *   'all'  → All Offices (locationId=null, officeIds=[])
 *   UUID   → single office
 */
function resolveOfficeParams(officeFilterLocal) {
  if (!officeFilterLocal || officeFilterLocal === 'all') {
    return { locationId: null, officeIds: [] };
  }
  const locationId = getLocationIdByOfficeId(officeFilterLocal) || null;
  return { locationId, officeIds: [officeFilterLocal] };
}

// ── Performance indicator ─────────────────────────────────────────────────────
const PerfBadge = ({ favorable, neutral }) => {
  if (neutral) return <span className="text-xs text-muted-foreground px-2 py-0.5">No change</span>;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      favorable ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
    }`}>
      <Icon name={favorable ? 'TrendingUp' : 'TrendingDown'} size={11} />
      {favorable ? 'Favorable' : 'Unfavorable'}
    </div>
  );
};

// ── Row renderer helpers ──────────────────────────────────────────────────────
/**
 * Build a standard dollar-variance row.
 * isExpense=true → spending less is favorable.
 */
function buildDollarRow({ label, a, b, isExpense = false, isOptional = false }) {
  const aVal = a !== null && !isNaN(a) ? a : null;
  const bVal = b !== null && !isNaN(b) ? b : null;
  const varDollar = aVal !== null && bVal !== null ? bVal - aVal : null;
  const varPct = aVal !== null && bVal !== null && aVal !== 0
    ? ((bVal - aVal) / Math.abs(aVal)) * 100
    : null;
  const favorable = varDollar !== null
    ? (isExpense ? varDollar < 0 : varDollar > 0)
    : null;
  return { label, aVal, bVal, varDollar, varPct, favorable, isExpense, isPct: false, isOptional };
}

/**
 * Build a percentage-point row (Collection Rate, Net Margin %).
 * Higher is always favorable for these metrics.
 */
function buildPctRow({ label, a, b }) {
  const aVal = a !== null && !isNaN(a) ? a : null;
  const bVal = b !== null && !isNaN(b) ? b : null;
  const ppDiff = aVal !== null && bVal !== null ? bVal - aVal : null;
  const favorable = ppDiff !== null ? ppDiff > 0 : null;
  return { label, aVal, bVal, ppDiff, favorable, isPct: true };
}

// ── Main component ────────────────────────────────────────────────────────────
const PeriodComparisonView = ({ officeFilter: officeFilterProp }) => {
  const [periodA, setPeriodA] = useState({ start: '2026-01-01', end: '2026-01-31' });
  const [periodB, setPeriodB] = useState({ start: '2026-02-01', end: '2026-02-28' });
  // Internal office dropdown — defaults to 'all'. Prefers the Reports page scoped filter if passed.
  const [officeFilterLocal, setOfficeFilterLocal] = useState('all');
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Determine effective office scope:
  // If the Reports page passes a scoped officeFilter (office manager), use it.
  // Otherwise use the internal dropdown.
  const effectiveOfficeFilter = (() => {
    if (officeFilterProp && Array.isArray(officeFilterProp) && !officeFilterProp?.includes('all') && officeFilterProp?.length === 1) {
      return officeFilterProp?.[0]; // single UUID from Reports page scope
    }
    return officeFilterLocal;
  })();

  const isScopedByReportsPage =
    officeFilterProp && Array.isArray(officeFilterProp) && !officeFilterProp?.includes('all') && officeFilterProp?.length === 1;

  /**
   * Fetch all verified metrics for one period.
   * Returns { netProduction, grossProduction, productionAdjustments,
   *           totalCollections, collectionRate,
   *           totalExpenses, netProfit, marginPct,
   *           payrollExpense, benefitsExpense, amexExpense, wfBankingExpense,
   *           errors: string[] }
   */
  const fetchPeriodData = async (start, end) => {
    const { locationId, officeIds } = resolveOfficeParams(effectiveOfficeFilter);
    const errors = [];

    // ── 1. Dentrix/FastAPI Production ────────────────────────────────────────
    let netProduction = null;
    let grossProduction = null;
    let productionAdjustments = null;
    try {
      const prodResult = await ascendApi?.getProduction(start, end, locationId);
      netProduction = prodResult?.netProduction ?? prodResult?.net_production ?? null;
      grossProduction = prodResult?.grossProduction ?? prodResult?.gross_production ?? null;
      productionAdjustments = prodResult?.productionAdjustments ?? prodResult?.production_adjustments ?? null;
      // Derive adjustments if not returned directly
      if (productionAdjustments === null && grossProduction !== null && netProduction !== null) {
        productionAdjustments = netProduction - grossProduction;
      }
    } catch (err) {
      errors?.push(`Production (${start}–${end}): ${err?.message || 'fetch failed'}`);
    }

    // ── 2. Dentrix/FastAPI Collections ───────────────────────────────────────
    let totalCollections = null;
    let collectionRate = null;
    try {
      const collResult = await ascendApi?.getCollections(start, end, locationId);
      totalCollections = collResult?.totalCollections ?? collResult?.total_collections ?? null;
      // Backend may return collectionRate directly
      const backendRate = collResult?.collectionRate ?? collResult?.collection_rate ?? null;
      if (backendRate !== null && !isNaN(backendRate)) {
        collectionRate = backendRate * (backendRate <= 1 ? 100 : 1); // normalize to %
      } else if (totalCollections !== null && netProduction !== null && netProduction > 0) {
        collectionRate = (totalCollections / netProduction) * 100;
      }
    } catch (err) {
      errors?.push(`Collections (${start}–${end}): ${err?.message || 'fetch failed'}`);
    }

    // ── 3. Finance Expense Report protected source ───────────────────────────
    let totalExpenses = null;
    let payrollExpense = null;
    let benefitsExpense = null;
    let amexExpense = null;
    let wfBankingExpense = null;
    try {
      const kpis = await fetchExpenseKPIs({ startDate: start, endDate: end, officeIds });
      totalExpenses = kpis?.totalExpenses ?? null;
      // payrollExpense from Gusto facts includes benefits inside it.
      // "Payroll + Payroll Taxes" row = payrollExpense minus benefits to avoid double-counting.
      const rawPayroll = kpis?.payrollExpense ?? null;
      const rawBenefits = kpis?.benefitsExpense ?? null;
      // Separate benefits from payroll bucket
      if (rawPayroll !== null && rawBenefits !== null) {
        payrollExpense = rawPayroll - rawBenefits;
        benefitsExpense = rawBenefits;
      } else if (rawPayroll !== null) {
        payrollExpense = rawPayroll;
        benefitsExpense = null; // backend did not return benefits separately — show —
      } else {
        payrollExpense = null;
        benefitsExpense = rawBenefits ?? null;
      }
      amexExpense = kpis?.amexExpense ?? null;
      wfBankingExpense = kpis?.wfBankingExpense ?? null;
    } catch (err) {
      errors?.push(`Expenses (${start}–${end}): ${err?.message || 'fetch failed'}`);
    }

    // ── 4. Derived metrics ───────────────────────────────────────────────────
    const netProfit =
      totalCollections !== null && totalExpenses !== null
        ? totalCollections - totalExpenses
        : null;

    const marginPct =
      netProfit !== null && totalCollections !== null && totalCollections > 0
        ? (netProfit / totalCollections) * 100
        : null;

    return {
      netProduction,
      grossProduction,
      productionAdjustments,
      totalCollections,
      collectionRate,
      totalExpenses,
      netProfit,
      marginPct,
      payrollExpense,
      benefitsExpense,
      amexExpense,
      wfBankingExpense,
      errors,
    };
  };

  const handleCompare = useCallback(async () => {
    setLoading(true);
    setComparisonData(null);
    setWarnings([]);
    try {
      const [dataA, dataB] = await Promise.all([
        fetchPeriodData(periodA?.start, periodA?.end),
        fetchPeriodData(periodB?.start, periodB?.end),
      ]);
      setComparisonData({ a: dataA, b: dataB, periodA: { ...periodA }, periodB: { ...periodB }, office: effectiveOfficeFilter });
      const allWarnings = [
        ...(dataA?.errors || [])?.map(e => `Period A — ${e}`),
        ...(dataB?.errors || [])?.map(e => `Period B — ${e}`),
      ];
      setWarnings(allWarnings);
    } catch (err) {
      setWarnings([`Unexpected error: ${err?.message || 'unknown'}`]);
    } finally {
      setLoading(false);
    }
  }, [periodA, periodB, effectiveOfficeFilter]);

  // ── Build comparison rows ─────────────────────────────────────────────────
  const buildRows = () => {
    if (!comparisonData) return [];
    const { a, b } = comparisonData;

    const rows = [];

    // Core rows (always shown)
    rows?.push(buildDollarRow({ label: 'Net Production', a: a?.netProduction, b: b?.netProduction, isExpense: false }));
    rows?.push(buildDollarRow({ label: 'Production Adjustments', a: a?.productionAdjustments, b: b?.productionAdjustments, isExpense: false }));
    rows?.push(buildDollarRow({ label: 'Total Collections', a: a?.totalCollections, b: b?.totalCollections, isExpense: false }));
    rows?.push(buildPctRow({ label: 'Collection Rate', a: a?.collectionRate, b: b?.collectionRate }));
    rows?.push(buildDollarRow({ label: 'Total Expenses', a: a?.totalExpenses, b: b?.totalExpenses, isExpense: true }));
    rows?.push(buildDollarRow({ label: 'Est. Net Profit', a: a?.netProfit, b: b?.netProfit, isExpense: false }));
    rows?.push(buildPctRow({ label: 'Net Margin %', a: a?.marginPct, b: b?.marginPct }));

    // Optional rows — shown only if at least one period has a non-null value
    const optionals = [
      { label: 'Gross Production', a: a?.grossProduction, b: b?.grossProduction, isExpense: false },
      { label: 'Payroll + Payroll Taxes', a: a?.payrollExpense, b: b?.payrollExpense, isExpense: true },
      { label: 'Benefits', a: a?.benefitsExpense, b: b?.benefitsExpense, isExpense: true },
      { label: 'AmEx / Corporate Card (Net)', a: a?.amexExpense, b: b?.amexExpense, isExpense: true },
      { label: 'WF Direct Operating Expense', a: a?.wfBankingExpense, b: b?.wfBankingExpense, isExpense: true },
    ];
    optionals?.forEach(opt => {
      if (opt?.a !== null || opt?.b !== null) {
        rows?.push(buildDollarRow({ ...opt, isOptional: true }));
      }
    });

    return rows;
  };

  const rows = buildRows();
  const coreRows = rows?.filter(r => !r?.isOptional);
  const optionalRows = rows?.filter(r => r?.isOptional);

  const renderRow = (row, i) => {
    if (row?.isPct) {
      // Percentage-point row
      const neutral = row?.ppDiff === null || row?.ppDiff === 0;
      const ppDiff = row?.aVal !== null && row?.bVal !== null ? row?.bVal - row?.aVal : null;
      const ptLabel = ppDiff !== null
        ? `${ppDiff >= 0 ? '+' : ''}${ppDiff?.toFixed(1)} pts`
        : '—';
      return (
        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
          <td className="px-4 py-2.5">
            <span className="text-sm text-foreground">{row?.label}</span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-sm font-medium text-blue-600">{fmtPct(row?.aVal)}</span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-sm font-medium text-purple-600">{fmtPct(row?.bVal)}</span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-xs text-muted-foreground">—</span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className={`text-sm font-semibold ${
              ppDiff === null ? 'text-muted-foreground' :
              ppDiff > 0 ? 'text-success' :
              ppDiff < 0 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {ptLabel}
            </span>
          </td>
          <td className="px-4 py-2.5">
            <div className="flex justify-center">
              <PerfBadge favorable={row?.favorable} neutral={neutral} />
            </div>
          </td>
        </tr>
      );
    }

    // Dollar row
    const neutral = row?.varDollar === null || row?.varDollar === 0;
    const rowBg = !neutral && row?.favorable !== null
      ? (row?.favorable ? 'bg-success/5' : 'bg-destructive/5')
      : '';

    return (
      <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${rowBg}`}>
        <td className="px-4 py-2.5">
          <span className="text-sm text-foreground">{row?.label}</span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-sm font-medium text-blue-600">{fmt(row?.aVal)}</span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-sm font-medium text-purple-600">{fmt(row?.bVal)}</span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className={`text-sm font-semibold ${
            row?.varDollar === null ? 'text-muted-foreground' :
            neutral ? 'text-muted-foreground': row?.favorable ?'text-success' : 'text-destructive'
          }`}>
            {row?.varDollar !== null
              ? `${row?.varDollar >= 0 ? '+' : ''}${fmt(row?.varDollar)}`
              : '—'}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className={`text-sm font-semibold ${
            row?.varPct === null ? 'text-muted-foreground' :
            neutral ? 'text-muted-foreground': row?.favorable ?'text-success' : 'text-destructive'
          }`}>
            {fmtVarPct(row?.varPct)}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex justify-center">
            <PerfBadge favorable={row?.favorable} neutral={neutral} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Period Pickers + Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="GitCompare" size={16} color="var(--color-primary)" />
          Period Comparison Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Period A */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Period A</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={periodA?.start}
                onChange={(e) => setPeriodA(prev => ({ ...prev, start: e?.target?.value }))}
                className="flex-1 px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-blue-600">to</span>
              <input
                type="date"
                value={periodA?.end}
                onChange={(e) => setPeriodA(prev => ({ ...prev, end: e?.target?.value }))}
                className="flex-1 px-2 py-1.5 text-xs border border-blue-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          {/* Period B */}
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wider">Period B</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={periodB?.start}
                onChange={(e) => setPeriodB(prev => ({ ...prev, start: e?.target?.value }))}
                className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <span className="text-xs text-purple-600">to</span>
              <input
                type="date"
                value={periodB?.end}
                onChange={(e) => setPeriodB(prev => ({ ...prev, end: e?.target?.value }))}
                className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Office filter — only shown when not scoped by Reports page */}
          {!isScopedByReportsPage && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Office</label>
              <select
                value={officeFilterLocal}
                onChange={(e) => setOfficeFilterLocal(e?.target?.value)}
                className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Offices</option>
                {Object.entries(OFFICE_MAP)?.map(([id, meta]) => (
                  <option key={id} value={id}>{meta?.name}</option>
                ))}
              </select>
            </div>
          )}
          {isScopedByReportsPage && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Office</label>
              <div className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-muted text-muted-foreground">
                {OFFICE_MAP?.[officeFilterProp?.[0]]?.name || 'Scoped Office'} (from Reports filter)
              </div>
            </div>
          )}

          <div>
            <Button variant="default" size="sm" onClick={handleCompare} loading={loading} iconName="GitCompare">
              Compare Periods
            </Button>
          </div>
        </div>
      </div>
      {/* Non-blocking warnings */}
      {warnings?.length > 0 && (
        <div className="space-y-1">
          {warnings?.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
              <Icon name="AlertCircle" size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">{w} — metric shows — for this period.</p>
            </div>
          ))}
        </div>
      )}
      {/* Source Banner */}
      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
        <Icon name="Info" size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Source:</span> Dentrix/FastAPI production and collections (<code className="font-mono">/v2/production/summary</code>, <code className="font-mono">/v2/collections/summary</code>) + Finance Expense Report protected expense totals (<code className="font-mono">fetchExpenseKPIs</code> — same function as Reports top Total Expenses card, P&L Summary, and Expense Breakdown). Manual/EOD sources (<code className="font-mono">revenue_entries</code>, <code className="font-mono">daily_entries</code>) are <strong>not used</strong> for official Period Comparison values.
        </p>
      </div>
      {/* Comparison Table */}
      {comparisonData && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Comparison Results</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Period A: {comparisonData?.periodA?.start} → {comparisonData?.periodA?.end} &nbsp;|&nbsp; Period B: {comparisonData?.periodB?.start} → {comparisonData?.periodB?.end}
              {comparisonData?.office !== 'all'
                ? ` | Office: ${OFFICE_MAP?.[comparisonData?.office]?.name || comparisonData?.office}`
                : ' | All Offices'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metric</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">Period A</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-purple-600 uppercase tracking-wider">Period B</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variance ($)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variance (%)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody>
                {/* Core metrics section */}
                <tr className="bg-muted/30">
                  <td colSpan={6} className="px-4 py-2">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Core Metrics</span>
                  </td>
                </tr>
                {coreRows?.map((row, i) => renderRow(row, `core-${i}`))}

                {/* Optional metrics section */}
                {optionalRows?.length > 0 && (
                  <>
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="px-4 py-2">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Expense Detail</span>
                        <span className="text-xs text-muted-foreground ml-2 font-normal">(Finance Expense Report buckets)</span>
                      </td>
                    </tr>
                    {optionalRows?.map((row, i) => renderRow(row, `opt-${i}`))}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {rows?.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No data returned for the selected periods. Check that Dentrix/FastAPI and Finance Expense Report sources are available.</p>
            </div>
          )}
        </div>
      )}
      {!comparisonData && !loading && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Icon name="GitCompare" size={24} color="var(--color-muted-foreground)" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Select two periods and click Compare</p>
          <p className="text-xs text-muted-foreground">
            Verified metrics (Net Production, Collections, Total Expenses, Net Profit, Margin %) will be shown side by side.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sources: Dentrix/FastAPI + Finance Expense Report protected totals.
          </p>
        </div>
      )}
    </div>
  );
};

export default PeriodComparisonView;
