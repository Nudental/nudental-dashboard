import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { fetchExpenseKPIs } from '../../../services/expenseReportService';
import { getLocationIdByOfficeId } from '../../../constants/offices';
import { format, startOfYear, startOfMonth, subMonths, endOfMonth, startOfQuarter, subQuarters } from 'date-fns';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Null-safe currency formatter.
 * Returns '—' for null/undefined — never '$0' for missing data.
 */
const fmt = (v) => {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v)?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPct = (v) =>
  v == null || !isFinite(v) ? '—' : `${Number(v)?.toFixed(1)}%`;

/**
 * Derive the report-level date range from a dateFilter preset string.
 * Returns { reportStart: 'YYYY-MM-DD', reportEnd: 'YYYY-MM-DD' }
 * This mirrors the same logic used in index.jsx getReportDateRange() so
 * the P&L table always clips to the exact same range as the top KPI cards.
 */
const getReportDateRange = (dateFilter) => {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  if (!dateFilter || dateFilter === 'ytd_2026' || dateFilter === 'ytd') {
    return { reportStart: format(startOfYear(now), 'yyyy-MM-dd'), reportEnd: todayStr };
  }
  if (dateFilter === 'this_month') {
    return { reportStart: format(startOfMonth(now), 'yyyy-MM-dd'), reportEnd: todayStr };
  }
  if (dateFilter === 'last_month') {
    const lm = subMonths(now, 1);
    return { reportStart: format(startOfMonth(lm), 'yyyy-MM-dd'), reportEnd: format(endOfMonth(lm), 'yyyy-MM-dd') };
  }
  if (dateFilter === 'this_quarter') {
    return { reportStart: format(startOfQuarter(now), 'yyyy-MM-dd'), reportEnd: todayStr };
  }
  if (dateFilter === 'last_quarter') {
    const lq = subQuarters(now, 1);
    return {
      reportStart: format(startOfQuarter(lq), 'yyyy-MM-dd'),
      reportEnd: format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd'),
    };
  }
  const qMatch = dateFilter?.match(/^q([1-4])_(\d{4})$/);
  if (qMatch) {
    const q = Number(qMatch?.[1]);
    const yr = Number(qMatch?.[2]);
    const startMonth = (q - 1) * 3;
    return {
      reportStart: format(new Date(yr, startMonth, 1), 'yyyy-MM-dd'),
      reportEnd: format(new Date(yr, startMonth + 3, 0), 'yyyy-MM-dd'),
    };
  }
  const ytdMatch = dateFilter?.match(/^ytd_(\d{4})$/);
  if (ytdMatch) {
    const yr = parseInt(ytdMatch?.[1], 10);
    const now2 = new Date();
    const end = yr === now2?.getFullYear() ? format(now2, 'yyyy-MM-dd') : `${yr}-12-31`;
    return { reportStart: `${yr}-01-01`, reportEnd: end };
  }
  const fyMatch = dateFilter?.match(/^fy_(\d{4})$/);
  if (fyMatch) {
    const yr = parseInt(fyMatch?.[1], 10);
    return { reportStart: `${yr}-01-01`, reportEnd: `${yr}-12-31` };
  }
  // fallback: YTD current year
  return { reportStart: format(startOfYear(now), 'yyyy-MM-dd'), reportEnd: todayStr };
};

/**
 * Parse a dateFilter preset string into { year, months: number[]|null }
 * months=null means "all months for that year"
 */
const parseDateFilter = (dateFilter) => {
  const now = new Date();
  const currentYear = now?.getFullYear();
  const currentMonth = now?.getMonth() + 1;

  if (!dateFilter) return { year: currentYear, months: null };

  const ytdMatch = dateFilter?.match(/^ytd_(\d{4})$/);
  if (ytdMatch) {
    const year = Number(ytdMatch?.[1]);
    const maxMonth = year === currentYear ? currentMonth : 12;
    return { year, months: Array.from({ length: maxMonth }, (_, i) => i + 1) };
  }

  const fyMatch = dateFilter?.match(/^fy_(\d{4})$/);
  if (fyMatch) {
    return { year: Number(fyMatch?.[1]), months: null };
  }

  const qMatch = dateFilter?.match(/^q([1-4])_(\d{4})$/);
  if (qMatch) {
    const q = Number(qMatch?.[1]);
    const year = Number(qMatch?.[2]);
    const startMonth = (q - 1) * 3 + 1;
    return { year, months: [startMonth, startMonth + 1, startMonth + 2] };
  }

  if (dateFilter === 'this_month') {
    return { year: currentYear, months: [currentMonth] };
  }

  if (dateFilter === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d?.getFullYear(), months: [d?.getMonth() + 1] };
  }

  if (dateFilter === 'this_quarter') {
    const q = Math.ceil(currentMonth / 3);
    const startMonth = (q - 1) * 3 + 1;
    return { year: currentYear, months: [startMonth, startMonth + 1, startMonth + 2]?.filter(m => m <= currentMonth) };
  }

  return { year: currentYear, months: null };
};

/**
 * Build the FULL ISO date range for a specific month+year (used only for
 * reference — actual row ranges are clipped to reportStart/reportEnd below).
 */
const monthRange = (year, month) => {
  const start = `${year}-${String(month)?.padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0)?.getDate();
  const end = `${year}-${String(month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
  return { start, end };
};

/**
 * Clip a row's date range to the report-level start/end.
 *
 *   rowStart = max(monthStart, reportStart)
 *   rowEnd   = min(monthEnd,   reportEnd)
 *
 * Returns null if the month is entirely outside the report range (skip it).
 */
const clipRowRange = (monthStart, monthEnd, reportStart, reportEnd) => {
  const rs = reportStart > monthStart ? reportStart : monthStart;
  const re = reportEnd   < monthEnd   ? reportEnd   : monthEnd;
  if (rs > re) return null; // month is completely outside the selected range
  return { start: rs, end: re };
};

/**
 * Determine whether the current office scope is safely supported by the
 * Finance Expense Report protected source for monthly expense rows.
 *
 * All Offices (officeIds=[]) → supported (V565 wired).
 * Single office → partially supported (WF Banking office filter has known limitations).
 * Multi-office → not yet safely supported (WF Banking multi-office filter broken).
 */
const getExpenseScopeSupport = (activeOffices) => {
  if (!activeOffices || activeOffices?.length === 0) {
    return { supported: true, reason: null };
  }
  if (activeOffices?.length === 1) {
    return {
      supported: true,
      reason: 'Single-office expense rows use the Finance protected source. WF Banking rows are filtered by office name — verify totals match Finance Expense Report for this office.',
    };
  }
  // Multi-office: WF Banking only uses first office name in ilike filter
  return {
    supported: false,
    reason: 'Monthly expense by this office scope is pending verified Finance Expense source support. Multi-office WF Banking filtering is not yet fully wired.',
  };
};

const readPLScopeMetric = async (method, field, start, end, locationIds) => {
  const results = await Promise.all(locationIds.map(id => method(start, end, id)));
  if (results.length === 1) return results[0];
  const values = results.map(result => result?.[field]);
  return { [field]: values.some(value => value == null || value === '' || !Number.isFinite(Number(value)))
    ? null : values.reduce((total, value) => total + Number(value), 0) };
};

const PLMonthlyTable = ({ officeFilter, dateFilter }) => {
  const currentYear = new Date()?.getFullYear();

  const derivedYear = parseDateFilter(dateFilter)?.year || currentYear;
  const [selectedYear, setSelectedYear] = useState(derivedYear);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelectedYear(parseDateFilter(dateFilter)?.year || currentYear);
  }, [dateFilter, currentYear]);

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    yearOptions?.push(y);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryYear = selectedYear;

      // ── Derive the exact report-level date range ──────────────────────────
      const { reportStart, reportEnd } = getReportDateRange(dateFilter);

      // Determine which months to display
      const filterMonths = parseDateFilter(dateFilter)?.months;
      const displayMonths = filterMonths
        ? filterMonths
        : Array.from({ length: 12 }, (_, i) => i + 1);

      // Resolve office filter
      const activeOffices = Array.isArray(officeFilter)
        ? officeFilter?.filter((o) => o && o !== 'all')
        : [];

      const locationIds = activeOffices.length
        ? [...new Set(activeOffices.map(id => getLocationIdByOfficeId(id)))] : [null];
      if (activeOffices.length && locationIds.some(id => !id)) {
        throw new Error('P&L data is unavailable for a selected office.');
      }

      // Check if this office scope is supported by the Finance protected source
      const scopeSupport = getExpenseScopeSupport(activeOffices);

      const monthResults = await Promise.allSettled(
        displayMonths?.map(async (m) => {
          const { start: monthStart, end: monthEnd } = monthRange(queryYear, m);

          // ── Clip to report range ──────────────────────────────────────────
          const clipped = clipRowRange(monthStart, monthEnd, reportStart, reportEnd);
          if (!clipped) {
            return { month: m, hasData: false, skipped: true };
          }
          const { start, end } = clipped;

          console.log(`[PLMonthlyTable] row ${MONTHS?.[m - 1]} params:`, {
            month: m,
            startDate: start,
            endDate: end,
            officeIds: activeOffices,
            reportStart,
            reportEnd,
            clippedFromMonthEnd: monthEnd !== end ? `${monthEnd} → ${end}` : 'no clip needed',
            scopeSupported: scopeSupport?.supported,
          });

          const [prodResult, collResult, expResult] = await Promise.allSettled([
            readPLScopeMetric(ascendApi?.getProduction, 'netProduction', start, end, locationIds),
            readPLScopeMetric(ascendApi?.getCollections, 'totalCollections', start, end, locationIds),
            // Use fetchExpenseKPIs — the EXACT same function Finance → Expense Report uses.
            // Only call if scope is supported; otherwise skip to preserve guardrail.
            scopeSupport?.supported
              ? fetchExpenseKPIs({ startDate: start, endDate: end, officeIds: activeOffices })
              : Promise.reject(new Error(scopeSupport?.reason || 'Scope not supported')),
          ]);

          const prod = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
          const coll = collResult?.status === 'fulfilled' ? collResult?.value : null;
          const expKpis = expResult?.status === 'fulfilled' ? expResult?.value : null;
          // Use totalExpenses from Finance protected source — null if fetch failed
          const totalExpenses = expKpis?.totalExpenses ?? null;
          // Track whether expense fetch failed vs. returned null
          const expFailed = expResult?.status === 'rejected';
          const expScopeBlocked = !scopeSupport?.supported;

          console.log(`[PLMonthlyTable] row ${MONTHS?.[m - 1]} results:`, {
            startDate: start,
            endDate: end,
            netProduction: prod?.netProduction ?? null,
            totalCollections: coll?.totalCollections ?? null,
            totalExpenses,
            expStatus: expResult?.status,
            expReason: expResult?.status === 'rejected' ? expResult?.reason?.message : undefined,
          });

          const netProduction    = prod?.netProduction    ?? null;
          const totalCollections = coll?.totalCollections ?? null;

          // Collection rate: collections ÷ net production (not gross)
          const collectionRate = (netProduction != null && netProduction > 0 && totalCollections != null)
            ? (totalCollections / netProduction) * 100
            : null;

          // Net Profit: totalCollections − totalExpenses
          // Only compute if BOTH are non-null — never fake $0
          const netProfit = (totalCollections != null && totalExpenses != null)
            ? totalCollections - totalExpenses
            : null;

          // Margin: netProfit / totalCollections × 100
          const margin = (netProfit != null && totalCollections != null && totalCollections > 0)
            ? (netProfit / totalCollections) * 100
            : null;

          const hasData = netProduction != null || totalCollections != null || totalExpenses != null;

          return {
            month: m,
            hasData,
            rowStart: start,
            rowEnd: end,
            netProduction,
            totalCollections,
            totalExpenses,
            collectionRate,
            netProfit,
            margin,
            prodFailed: prodResult?.status === 'rejected',
            collFailed: collResult?.status === 'rejected',
            expFailed,
            expScopeBlocked,
            expScopeReason: expScopeBlocked ? scopeSupport?.reason : null,
          };
        })
      );

      const result = monthResults?.map((r, i) => {
        if (r?.status === 'fulfilled') return r?.value;
        return { month: displayMonths?.[i], hasData: false };
      });

      setRows(result);
    } catch (err) {
      console.error('PLMonthlyTable fetch error:', err);
      setError(err?.message || 'Failed to load P&L data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, officeFilter, dateFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dataRows = rows?.filter((r) => r?.hasData);
  const hasAnyData = dataRows?.length > 0;

  // Determine if any row has expense data (to decide banner state)
  const hasAnyExpenseData = dataRows?.some((r) => r?.totalExpenses != null);
  const hasAnyScopeBlocked = rows?.some((r) => r?.expScopeBlocked);

  // Totals row — only sum non-null values; null months contribute nothing
  const totals = dataRows?.reduce(
    (acc, r) => ({
      netProduction:    acc?.netProduction    + (r?.netProduction    ?? 0),
      totalCollections: acc?.totalCollections + (r?.totalCollections ?? 0),
      totalExpenses:    acc?.totalExpenses    + (r?.totalExpenses    ?? 0),
      netProfit:        acc?.netProfit        + (r?.netProfit        ?? 0),
      hasProduction:    acc?.hasProduction    || r?.netProduction    != null,
      hasCollections:   acc?.hasCollections   || r?.totalCollections != null,
      hasExpenses:      acc?.hasExpenses      || r?.totalExpenses    != null,
      hasNetProfit:     acc?.hasNetProfit     || r?.netProfit        != null,
    }),
    { netProduction: 0, totalCollections: 0, totalExpenses: 0, netProfit: 0, hasProduction: false, hasCollections: false, hasExpenses: false, hasNetProfit: false }
  );

  // Total margin: total net profit ÷ total collections × 100
  const totalMargin = (totals?.hasNetProfit && totals?.hasCollections && totals?.totalCollections > 0)
    ? (totals?.netProfit / totals?.totalCollections) * 100
    : null;

  const filterLabel = (() => {
    const { months } = parseDateFilter(dateFilter);
    if (!months) return `Full Year ${selectedYear}`;
    if (months?.length === 1) return `${MONTHS?.[months?.[0] - 1]} ${selectedYear}`;
    if (months?.length === 3) {
      const q = Math.ceil(months?.[0] / 3);
      return `Q${q} ${selectedYear}`;
    }
    return `YTD ${selectedYear}`;
  })();

  // Resolve active offices for scope check in render
  const activeOfficesForRender = Array.isArray(officeFilter)
    ? officeFilter?.filter((o) => o && o !== 'all')
    : [];
  const scopeSupportForRender = getExpenseScopeSupport(activeOfficesForRender);

  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-2">
      {/* Scope guardrail — only shown when multi-office scope is not yet supported */}
      {!scopeSupportForRender?.supported && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-t-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            {scopeSupportForRender?.reason}
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 md:p-5 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Monthly P&L Summary — {filterLabel}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Net production, collections, expenses, and net profit by month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e?.target?.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {yearOptions?.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border rounded-lg transition-smooth"
            title="Refresh"
          >
            <Icon name="RefreshCw" size={13} />
          </button>
        </div>
      </div>
      {/* Source note */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#E0F7FA]/60 border-b border-[#00B5CC]/20">
        <Icon name="CheckCircle" size={13} className="text-[#00B5CC] flex-shrink-0" />
        <p className="text-xs text-[#00B5CC] font-medium">
          Source: Dentrix/FastAPI monthly net production and collections + Finance Expense Report protected expense totals. Monthly expense rows use the same protected Finance source as the top Total Expenses card. Legacy MEA is not used for official values.
        </p>
      </div>
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Icon name="Loader2" size={20} className="animate-spin" />
            <span className="text-sm">Loading P&L data from Dentrix/FastAPI…</span>
          </div>
        </div>
      )}
      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Icon name="AlertCircle" size={28} className="text-destructive mb-3" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}
      {/* Empty state */}
      {!loading && !error && !hasAnyData && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="BarChart2" size={28} className="text-muted-foreground" />
          </div>
          <h4 className="text-base font-semibold text-foreground mb-2">No data for {filterLabel}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            No production, collections, or expense data returned from verified sources for this period.
          </p>
        </div>
      )}
      {/* Table */}
      {!loading && !error && hasAnyData && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Month</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Net Production
                  <span className="block text-[10px] font-normal text-[#00B5CC] normal-case tracking-normal">Dentrix/FastAPI</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Collections
                  <span className="block text-[10px] font-normal text-[#00B5CC] normal-case tracking-normal">Dentrix/FastAPI</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Coll. Rate
                  <span className="block text-[10px] font-normal text-muted-foreground normal-case tracking-normal">÷ net prod.</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Total Expenses
                  <span className="block text-[10px] font-normal text-[#00B5CC] normal-case tracking-normal">Finance Exp. Report</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Net Profit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => {
                if (!row?.hasData) {
                  return (
                    <tr key={row?.month} className="border-b border-border/50 opacity-40">
                      <td className="px-4 py-3 font-medium text-foreground">{MONTHS?.[row?.month - 1]}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                    </tr>
                  );
                }
                const isNegative = row?.netProfit != null && row?.netProfit < 0;
                // Show row warning if expense fetch failed (non-blocking)
                const showExpWarning = row?.expFailed && !row?.expScopeBlocked;
                return (
                  <React.Fragment key={row?.month}>
                    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{MONTHS?.[row?.month - 1]}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(row?.netProduction)}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(row?.totalCollections)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtPct(row?.collectionRate)}</td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {row?.expScopeBlocked
                          ? <span className="text-muted-foreground" title={row?.expScopeReason}>—</span>
                          : fmt(row?.totalExpenses)
                        }
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${isNegative ? 'text-destructive' : 'text-emerald-600'}`}>
                        {row?.expScopeBlocked ? <span className="text-muted-foreground">—</span> : fmt(row?.netProfit)}
                      </td>
                      <td className={`px-4 py-3 text-right ${isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {row?.expScopeBlocked ? <span className="text-muted-foreground">—</span> : fmtPct(row?.margin)}
                      </td>
                    </tr>
                    {showExpWarning && (
                      <tr className="border-b border-amber-200/40">
                        <td colSpan={7} className="px-4 py-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                            <Icon name="AlertTriangle" size={11} className="flex-shrink-0" />
                            <span>{MONTHS?.[row?.month - 1]}: Finance Expense Report source unavailable for this month — expense, net profit, and margin show —</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                <td className="px-4 py-3 text-foreground text-xs uppercase tracking-wide">TOTAL</td>
                <td className="px-4 py-3 text-right text-foreground">{totals?.hasProduction ? fmt(totals?.netProduction) : '—'}</td>
                <td className="px-4 py-3 text-right text-blue-600">{totals?.hasCollections ? fmt(totals?.totalCollections) : '—'}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {totals?.hasProduction && totals?.hasCollections && totals?.netProduction > 0
                    ? fmtPct((totals?.totalCollections / totals?.netProduction) * 100)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {totals?.hasExpenses ? fmt(totals?.totalExpenses) : '—'}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${totals?.hasNetProfit && totals?.netProfit < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {totals?.hasNetProfit ? fmt(totals?.netProfit) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {fmtPct(totalMargin)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default PLMonthlyTable;
