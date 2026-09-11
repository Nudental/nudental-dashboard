import React, { useState, useEffect, useCallback } from 'react';
import { fetchScorecardData, fmtCurrency, fmtPct, fmtNum } from '../../../services/operationsService';
import { resolveOfficeName } from '../../../constants/offices';

const BADGE_STYLES = {
  PASS: 'bg-green-100 text-green-800 border-green-200',
  WARN: 'bg-amber-100 text-amber-800 border-amber-200',
  FAIL: 'bg-red-100 text-red-800 border-red-200',
};

const Badge = ({ badge }) => {
  if (!badge) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${BADGE_STYLES?.[badge] || ''}`}>
      {badge}
    </span>
  );
};

const MetricRow = ({ label, actual, goal, pct, badge, fmtFn, benchmark }) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{fmtFn ? fmtFn(actual) : (actual !== null ? fmtPct(actual) : '—')}</div>
        {goal !== undefined && goal !== null && goal > 0 && (
          <div className="text-xs text-muted-foreground">Goal: {fmtFn ? fmtFn(goal) : goal}</div>
        )}
        {benchmark !== undefined && benchmark !== null && (
          <div className="text-xs text-muted-foreground">Benchmark: {fmtPct(benchmark)}</div>
        )}
        {pct !== null && pct !== undefined && (
          <div className="text-xs text-muted-foreground">{fmtPct(pct)} attainment</div>
        )}
      </div>
      <Badge badge={badge} />
    </div>
  </div>
);

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ScorecardsTab = ({ dateRange, officeIds, offices, lastAvailablePeriod }) => {
  const now = new Date();
  // Default to last month instead of current month
  const defaultDate = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { month: d?.getMonth() + 1, year: d?.getFullYear() };
  })();

  const [selectedMonth, setSelectedMonth] = useState(defaultDate?.month);
  const [selectedYear, setSelectedYear] = useState(defaultDate?.year);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noDataMsg, setNoDataMsg] = useState(null);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  // When lastAvailablePeriod is loaded, check if selected month has no data
  useEffect(() => {
    if (!lastAvailablePeriod) return;
    const selectedVal = selectedYear * 100 + selectedMonth;
    const lastAvailVal = lastAvailablePeriod?.year * 100 + lastAvailablePeriod?.month;
    const thisMonthVal = now?.getFullYear() * 100 + (now?.getMonth() + 1);

    if (selectedVal === thisMonthVal && lastAvailVal < thisMonthVal) {
      // Auto-switch to last available period
      setSelectedYear(lastAvailablePeriod?.year);
      setSelectedMonth(lastAvailablePeriod?.month);
      setNoDataMsg(`No data yet for this month. Showing last available period (${lastAvailablePeriod?.label}).`);
    }
  }, [lastAvailablePeriod]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchScorecardData({ year: selectedYear, month: selectedMonth, officeIds });
      setData(records || []);
      // If no records returned and we know the last available period, show message
      if ((records || [])?.length === 0 && lastAvailablePeriod) {
        const selectedVal = selectedYear * 100 + selectedMonth;
        const lastAvailVal = lastAvailablePeriod?.year * 100 + lastAvailablePeriod?.month;
        if (selectedVal > lastAvailVal) {
          setNoDataMsg(`No data yet for ${MONTH_NAMES?.[selectedMonth - 1]} ${selectedYear}. Showing last available period (${lastAvailablePeriod?.label}).`);
          // Auto-switch to last available period
          setSelectedYear(lastAvailablePeriod?.year);
          setSelectedMonth(lastAvailablePeriod?.month);
          return;
        }
      }
      setNoDataMsg(null);
    } catch (e) {
      console.error('ScorecardsTab error:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, officeIds?.join(','), lastAvailablePeriod]);

  useEffect(() => { load(); }, [load]);

  const years = [now?.getFullYear(), now?.getFullYear() - 1, now?.getFullYear() - 2];

  return (
    <div>
      {/* Month/Year Selector */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(parseInt(e?.target?.value)); setNoDataMsg(null); }}
          className="min-h-[44px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {MONTH_NAMES?.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => { setSelectedYear(parseInt(e?.target?.value)); setNoDataMsg(null); }}
          className="min-h-[44px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {years?.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">
          Showing scorecards for {MONTH_NAMES?.[selectedMonth - 1]} {selectedYear}
        </span>
        <span className="ml-auto text-xs text-muted-foreground italic">
          Source: Dentrix Ascend API for actuals · office_goals for targets
        </span>
      </div>

      {/* No-data warning */}
      {noDataMsg && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="flex-shrink-0">⚠️</span>
          {noDataMsg}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3]?.map((i) => <div key={i} className="h-80 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No scorecard data for {MONTH_NAMES?.[selectedMonth - 1]} {selectedYear}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.map((r) => {
            const officeName = officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id);
            const overallBadges = [
              r?.production?.badge,
              r?.collections?.badge,
              r?.new_patients?.badge,
              r?.collection_rate?.badge,
              r?.case_acceptance?.badge,
              r?.utilization?.badge,
            ]?.filter(Boolean);
            const passCount = overallBadges?.filter((b) => b === 'PASS')?.length;
            const failCount = overallBadges?.filter((b) => b === 'FAIL')?.length;
            const warnCount = overallBadges?.filter((b) => b === 'WARN')?.length;

            return (
              <div key={r?.office_id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Card Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{officeName}</h3>
                    <div className="flex items-center gap-1.5">
                      {passCount > 0 && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">{passCount} PASS</span>}
                      {warnCount > 0 && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">{warnCount} WARN</span>}
                      {failCount > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-medium">{failCount} FAIL</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{MONTH_NAMES?.[selectedMonth - 1]} {selectedYear}</div>
                </div>
                {/* Metrics */}
                <div className="px-4 py-2">
                  <MetricRow
                    label="Net Production"
                    actual={r?.production?.actual}
                    goal={r?.production?.goal}
                    pct={r?.production?.pct}
                    badge={r?.production?.badge}
                    fmtFn={fmtCurrency}
                    benchmark={null}
                  />
                  {r?.production?.ucr != null && r?.production?.ucr > 0 && (
                    <div className="flex items-center justify-between py-1 pl-4 border-b border-border/50 last:border-0">
                      <div className="text-xs text-muted-foreground">↳ UCR / Gross Fee</div>
                      <div className="text-xs font-medium text-indigo-600">{fmtCurrency(r?.production?.ucr)}</div>
                    </div>
                  )}
                  {r?.production?.adjustment != null && r?.production?.adjustment !== 0 && (
                    <div className="flex items-center justify-between py-1 pl-4 border-b border-border/50 last:border-0">
                      <div className="text-xs text-muted-foreground">↳ Prod. Adjustments</div>
                      <div className="text-xs font-medium text-red-500">{fmtCurrency(r?.production?.adjustment)}</div>
                    </div>
                  )}
                  <MetricRow
                    label="Collections"
                    actual={r?.collections?.actual}
                    goal={r?.collections?.goal}
                    pct={r?.collections?.pct}
                    badge={r?.collections?.badge}
                    fmtFn={fmtCurrency}
                    benchmark={null}
                  />
                  <MetricRow
                    label="New Patients"
                    actual={r?.new_patients?.actual}
                    goal={r?.new_patients?.goal}
                    pct={r?.new_patients?.pct}
                    badge={r?.new_patients?.badge}
                    fmtFn={fmtNum}
                    benchmark={null}
                  />
                  <MetricRow
                    label="Collection Rate"
                    actual={r?.collection_rate?.actual}
                    goal={null}
                    pct={null}
                    badge={r?.collection_rate?.badge}
                    fmtFn={null}
                    benchmark={r?.collection_rate?.benchmark}
                  />
                  <MetricRow
                    label="Case Acceptance"
                    actual={r?.case_acceptance?.actual}
                    goal={null}
                    pct={null}
                    badge={r?.case_acceptance?.badge}
                    fmtFn={null}
                    benchmark={r?.case_acceptance?.benchmark}
                  />
                  <MetricRow
                    label="Chair Utilization"
                    actual={r?.utilization?.actual}
                    goal={null}
                    pct={null}
                    badge={r?.utilization?.badge}
                    fmtFn={null}
                    benchmark={r?.utilization?.benchmark}
                  />
                </div>
                {/* Key Ratios */}
                <div className="px-4 py-3 bg-slate-50 border-t border-border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Ratios</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Hygiene Split</div>
                      <div className="font-semibold text-foreground">{r?.hygiene_split !== null ? fmtPct(r?.hygiene_split) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Doctor Split</div>
                      <div className="font-semibold text-foreground">{r?.doctor_split !== null ? fmtPct(r?.doctor_split) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Adj % of UCR</div>
                      <div className="font-semibold text-foreground">{r?.adj_pct !== null ? fmtPct(r?.adj_pct) : '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScorecardsTab;
