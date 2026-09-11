import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { fetchExpenseKPIs } from '../../../services/expenseReportService';
import { getExpenseDateRange } from '../../../services/expenseService';

// ── Color palette ─────────────────────────────────────────────────────────────
const BUCKET_COLORS = {
  'Payroll + Payroll Taxes': '#6366f1',
  'Benefits':                '#00B5CC',
  'AmEx / Corporate Card':   '#f59e0b',
  'WF Direct Operating':     '#10b981',
};
const FALLBACK_COLORS = ['#6366f1', '#00B5CC', '#f59e0b', '#10b981', '#a78bfa', '#fb923c'];

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const fmtRaw = (v) =>
  v == null || isNaN(v)
    ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);

const pct = (v, total) => (total > 0 ? ((v / total) * 100)?.toFixed(1) : '0.0');

// Hover highlight only — no text inside the donut
const ActiveShape = (props) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
  } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 11}
        outerRadius={outerRadius + 15}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload?.[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-elevation-2">
      <p className="text-sm font-semibold text-foreground">{d?.name}</p>
      <p className="text-sm text-primary font-bold">{fmt(d?.value)}</p>
      <p className="text-xs text-muted-foreground">{(d?.payload?.percent * 100 || 0)?.toFixed(1)}% of total</p>
      {d?.payload?.subtext && (
        <p className="text-xs text-muted-foreground mt-0.5">{d?.payload?.subtext}</p>
      )}
      {d?.payload?.source && (
        <p className="text-xs text-[#00B5CC] font-medium mt-0.5">{d?.payload?.source}</p>
      )}
    </div>
  );
};

/**
 * ExpenseBreakdownChart — V566
 *
 * Uses Finance Expense Report protected summary buckets from fetchExpenseKPIs().
 * Buckets: Payroll+Taxes, Benefits, AmEx net, WF Direct Operating.
 * Total reconciles to top Total Expenses card (same source).
 *
 * Donut center shows only "Total Expenses" + total value.
 * All category names/values/percentages are in the right-side list only.
 * No crowded labels inside or over the donut.
 *
 * Drilldown into sub-categories is labeled "pending verified source" per hard rules.
 * No daily_entries (MEA) expenses used. No old row-summed logic.
 */
const ExpenseBreakdownChart = ({ dateFilter = 'ytd_2026', officeFilter = ['all'] }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [kpisRaw, setKpisRaw] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getExpenseDateRange(dateFilter);
      const activeOffices = (officeFilter || [])?.filter(o => o && o !== 'all');

      console.log('[ExpenseBreakdownChart] fetchExpenseKPIs params:', {
        startDate: start,
        endDate: end,
        officeIds: activeOffices,
      });

      const kpis = await fetchExpenseKPIs({
        startDate: start,
        endDate: end,
        officeIds: activeOffices,
      });

      console.log('[ExpenseBreakdownChart] fetchExpenseKPIs result:', {
        totalExpenses: kpis?.totalExpenses,
        payrollExpense: kpis?.payrollExpense,
        payrollTaxes: kpis?.payrollTaxes,
        benefitsExpense: kpis?.benefitsExpense,
        amexExpense: kpis?.amexExpense,
        amexCharges: kpis?.amexCharges,
        amexCredits: kpis?.amexCredits,
        wfBankingExpense: kpis?.wfBankingExpense,
      });

      setKpisRaw(kpis);

      // Build the four official buckets from Finance protected summary
      // Payroll + Payroll Taxes (combined — benefits shown separately)
      const payrollAndTaxes = (kpis?.payrollExpense ?? 0) + (kpis?.payrollTaxes ?? 0);
      const benefits = kpis?.benefitsExpense ?? 0;
      const amexNet = kpis?.amexExpense ?? 0;
      const wfDirect = kpis?.wfBankingExpense ?? 0;

      const rawBuckets = [
        {
          name: 'Payroll + Payroll Taxes',
          value: payrollAndTaxes,
          source: 'Finance Expense Report — Gusto payroll facts',
          subtext: null,
        },
        {
          name: 'Benefits',
          value: benefits,
          source: 'Finance Expense Report — backend totals.benefits',
          subtext: null,
        },
        {
          name: 'AmEx / Corporate Card',
          value: amexNet,
          source: 'Finance Expense Report — net totals.amex (charges minus credits)',
          subtext: kpis?.amexCharges != null && kpis?.amexCredits != null
            ? `Charges ${fmtRaw(kpis?.amexCharges)} minus credits ${fmtRaw(Math.abs(kpis?.amexCredits))}`
            : null,
        },
        {
          name: 'WF Direct Operating',
          value: wfDirect,
          source: 'Finance Expense Report — backend totals.wf_banking',
          subtext: 'WF→AmEx and WF→Gusto funding excluded',
        },
      ]?.filter(b => b?.value > 0);

      const grandTotal = rawBuckets?.reduce((s, b) => s + b?.value, 0);
      setBuckets(rawBuckets?.map(b => ({ ...b, percent: grandTotal > 0 ? b?.value / grandTotal : 0 })));
    } catch (e) {
      console.error('[ExpenseBreakdownChart] fetch error:', e);
      setError(e?.message || 'Failed to load expense breakdown');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, officeFilter]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const grandTotal = buckets?.reduce((s, b) => s + b?.value, 0);

  const getBucketColor = (name, index) =>
    BUCKET_COLORS?.[name] || FALLBACK_COLORS?.[index % FALLBACK_COLORS?.length];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="PieChart" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Expense Breakdown</h3>
            <p className="text-xs text-muted-foreground">Finance Expense Report protected summary buckets</p>
          </div>
        </div>
      </div>

      {/* Source note */}
      <div className="flex items-start gap-2 px-3 py-2 bg-[#E0F7FA]/50 border border-[#00B5CC]/20 rounded-lg mb-4">
        <Icon name="CheckCircle" size={12} className="text-[#00B5CC] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#00B5CC] leading-relaxed">
          Expense Breakdown uses the Finance Expense Report protected summary totals for selected-period category buckets. Transaction-level drilldown is supporting only and may be limited until fully wired. Total reconciles to the top Total Expenses card.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Icon name="Loader" size={24} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading expense breakdown…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg mb-4">
          <Icon name="AlertCircle" size={15} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
          <button onClick={fetchBuckets} className="ml-auto text-xs text-primary hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && buckets?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon name="PieChart" size={32} className="text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No expense data</p>
          <p className="text-xs text-muted-foreground">No expenses returned from Finance protected source for the selected period</p>
        </div>
      )}

      {!loading && !error && buckets?.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Donut chart — center shows Total Expenses + total value only */}
          <div className="flex-shrink-0 w-full lg:w-[260px]">
            <div className="relative">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={ActiveShape}
                    data={buckets}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={104}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    style={{ cursor: 'default' }}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={600}
                    label={false}
                    labelLine={false}
                  >
                    {buckets?.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBucketColor(entry?.name, index)}
                        stroke="var(--color-card)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <CustomTooltip {...props} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Static center label — always shows Total Expenses + total value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight text-center px-2">
                  Total Expenses
                </p>
                <p className="text-base font-bold text-foreground mt-0.5">{fmt(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Bucket list — all category names, values, percentages, and source notes here */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Category Buckets
            </p>
            <div className="space-y-2">
              {buckets?.map((entry, index) => (
                <div
                  key={entry?.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-smooth"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getBucketColor(entry?.name, index) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium">{entry?.name}</p>
                    {entry?.subtext && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{entry?.subtext}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{entry?.source}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs font-semibold text-foreground">{fmt(entry?.value)}</p>
                    <p className="text-[11px] text-muted-foreground">{pct(entry?.value, grandTotal)}%</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Expenses</span>
              <span className="text-sm font-bold text-foreground">{fmt(grandTotal)}</span>
            </div>

            {/* Drilldown disabled note */}
            <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-muted/30 border border-border/60 rounded-lg">
              <Icon name="Info" size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Detailed drilldown pending verified source. Category totals above are from the Finance Expense Report protected summary.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseBreakdownChart;
