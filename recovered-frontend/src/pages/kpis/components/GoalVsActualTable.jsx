import React, { useState } from 'react';
import { fmtCurrency, fmtPct, fmtNum } from '../../../services/kpiService';
import { Info } from 'lucide-react';

// Color coding based on % to goal — uses semantic colors that work in both light and dark
const getCellClass = (pct) => {
  if (pct === null || pct === undefined) return '';
  if (pct >= 100) return 'bg-success/15 text-success';
  if (pct >= 90) return 'bg-warning/10 text-warning';
  if (pct >= 75) return 'bg-warning/20 text-warning';
  return 'bg-error/15 text-error';
};

const MetricCell = ({ actual, goal, pct, formatActual, formatGoal }) => {
  const cellClass = getCellClass(pct);
  // V719B: null/undefined actual shows '—', not $0 or 0
  const displayActual = actual !== null && actual !== undefined
    ? (formatActual ? formatActual(actual) : actual)
    : '—';
  // V728D FIX: goal=0 is a valid goal (e.g. new_patients_goal=0 for May).
  // Show goal row when goal is a non-null number (including 0).
  // Only hide goal row when goal is null/undefined (no goals row in DB).
  const hasGoal = goal !== null && goal !== undefined;
  return (
    <td className={`px-3 py-3 text-center ${cellClass}`}>
      <div className="font-semibold text-sm">{displayActual}</div>
      {hasGoal ? (
        <>
          <div className="text-xs opacity-70">Goal: {formatGoal ? formatGoal(goal) : goal}</div>
          <div className="text-xs font-bold mt-0.5">
            {pct !== null && pct !== undefined ? `${pct?.toFixed(1)}%` : '—'}
          </div>
        </>
      ) : (
        <div className="text-xs opacity-50">—</div>
      )}
    </td>
  );
};

const BenchmarkCell = ({ value, benchmark, formatValue }) => {
  const pct = benchmark > 0 && value !== null ? (value / benchmark) * 100 : null;
  const cellClass = getCellClass(pct);
  return (
    <td className={`px-3 py-3 text-center ${cellClass}`}>
      <div className="font-semibold text-sm">{value !== null && value !== undefined ? formatValue(value) : '—'}</div>
      <div className="text-xs opacity-70">Bench: {benchmark}%</div>
      {pct !== null && (
        <div className="text-xs font-bold mt-0.5">{pct?.toFixed(1)}%</div>
      )}
    </td>
  );
};

const TooltipHeader = ({ label, tooltip }) => {
  const [show, setShow] = useState(false);
  return (
    <th className="px-3 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        {tooltip && (
          <div className="relative">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
              onClick={() => setShow((v) => !v)}
              aria-label={`Info about ${label}`}
            >
              <Info size={11} />
            </button>
            {show && (
              <div className="absolute left-1/2 -translate-x-1/2 top-5 z-50 w-64 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs text-foreground leading-relaxed font-normal normal-case tracking-normal">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
};

const GoalVsActualTable = ({ rows, loading }) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="h-5 bg-muted rounded w-48 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 })?.map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium">No data for selected period</p>
      </div>
    );
  }

  // V719B FIX: Null-safe Group Total reducer
  // Replace null || 0 pattern — null/unavailable stays null, true zero stays zero
  // Only sum valid numeric values; if no valid values exist, total stays null
  const totals = rows?.reduce(
    (acc, r) => {
      // Production
      if (r?.production !== null && r?.production !== undefined) {
        acc.production = (acc?.production ?? 0) + r?.production;
      }
      acc.productionGoal += r?.productionGoal || 0;

      // Collections
      if (r?.collections !== null && r?.collections !== undefined) {
        acc.collections = (acc?.collections ?? 0) + r?.collections;
      }
      acc.collectionsGoal += r?.collectionsGoal || 0;

      // New Patients
      if (r?.newPatients !== null && r?.newPatients !== undefined) {
        acc.newPatients = (acc?.newPatients ?? 0) + r?.newPatients;
      }
      acc.newPatientsGoal += r?.newPatientsGoal || 0;

      // Collection % — only accumulate valid numeric values
      if (r?.collectionPct !== null && r?.collectionPct !== undefined) {
        acc.collectionPctSum = (acc?.collectionPctSum ?? 0) + r?.collectionPct;
        acc.collectionPctCount += 1;
      }

      // TAR — only accumulate valid numeric values (V719B fix: null stays null)
      if (r?.tarPct !== null && r?.tarPct !== undefined) {
        acc.tarPctSum = (acc?.tarPctSum ?? 0) + r?.tarPct;
        acc.tarPctCount += 1;
      }

      acc.count += 1;
      return acc;
    },
    {
      production: null,
      productionGoal: 0,
      collections: null,
      collectionsGoal: 0,
      newPatients: null,
      newPatientsGoal: 0,
      collectionPctSum: null,
      collectionPctCount: 0,
      tarPctSum: null,
      tarPctCount: 0,
      count: 0,
    }
  );

  // V719B FIX: avgCollectionPct — only average valid values; null when none exist
  const avgCollectionPct = totals?.collectionPctCount > 0
    ? totals?.collectionPctSum / totals?.collectionPctCount
    : null;

  // V719B FIX: avgTarPct — only average valid values; null when none exist → shows '—' not 0.0%
  const avgTarPct = totals?.tarPctCount > 0
    ? totals?.tarPctSum / totals?.tarPctCount
    : null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-base">Goal vs. Actual by Office</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20 border border-success/40 inline-block" /> ≥100%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/15 border border-warning/30 inline-block" /> 90–99%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/25 border border-warning/40 inline-block" /> 75–89%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-error/15 border border-error/30 inline-block" /> &lt;75%</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">Office</th>
              <th className="px-3 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">Production</th>
              <th className="px-3 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">Collections</th>
              <TooltipHeader
                label="New Patients"
                tooltip="Office-level new patient counts may sum higher than the top card because patients can appear in more than one office."
              />
              <TooltipHeader
                label="Collection %"
                tooltip="Avg Office Collection % — simple average of each office's collection rate. The top card shows weighted aggregate collections ÷ net production."
              />
              <th className="px-3 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">Treatment Acceptance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows?.map((row) => (
              <tr key={row?.officeName} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground text-sm whitespace-nowrap">
                  {row?.officeName}
                </td>
                <MetricCell
                  actual={row?.production}
                  goal={row?.productionGoal}
                  pct={row?.productionPct}
                  formatActual={fmtCurrency}
                  formatGoal={fmtCurrency}
                />
                <MetricCell
                  actual={row?.collections}
                  goal={row?.collectionsGoal}
                  pct={row?.collectionsPct}
                  formatActual={fmtCurrency}
                  formatGoal={fmtCurrency}
                />
                <MetricCell
                  actual={row?.newPatients}
                  goal={row?.newPatientsGoal}
                  pct={row?.newPatientsPct}
                  formatActual={fmtNum}
                  formatGoal={fmtNum}
                />
                <BenchmarkCell
                  value={row?.collectionPct}
                  benchmark={92}
                  formatValue={fmtPct}
                />
                <BenchmarkCell
                  value={row?.tarPct}
                  benchmark={65}
                  formatValue={fmtPct}
                />
              </tr>
            ))}
          </tbody>
          {/* Summary footer */}
          <tfoot>
            <tr className="bg-muted border-t-2 border-border font-bold">
              <td className="px-4 py-3 text-foreground text-sm">Group Total / Avg</td>
              <td className="px-3 py-3 text-center text-sm text-foreground">
                {/* V719B: null total shows '—' not $0 */}
                <div>{totals?.production !== null ? fmtCurrency(totals?.production) : '—'}</div>
                {totals?.productionGoal > 0 && (
                  <div className="text-xs text-muted-foreground">Goal: {fmtCurrency(totals?.productionGoal)}</div>
                )}
              </td>
              <td className="px-3 py-3 text-center text-sm text-foreground">
                <div>{totals?.collections !== null ? fmtCurrency(totals?.collections) : '—'}</div>
                {totals?.collectionsGoal > 0 && (
                  <div className="text-xs text-muted-foreground">Goal: {fmtCurrency(totals?.collectionsGoal)}</div>
                )}
              </td>
              <td className="px-3 py-3 text-center text-sm text-foreground">
                <div>{totals?.newPatients !== null ? fmtNum(totals?.newPatients) : '—'}</div>
                {totals?.newPatientsGoal > 0 && (
                  <div className="text-xs text-muted-foreground">Goal: {fmtNum(totals?.newPatientsGoal)}</div>
                )}
              </td>
              <td className="px-3 py-3 text-center text-sm text-foreground">
                {/* V719B: avgCollectionPct null → '—' */}
                <div>{fmtPct(avgCollectionPct)}</div>
                <div className="text-xs text-muted-foreground font-normal">Avg Office Collection %</div>
              </td>
              <td className="px-3 py-3 text-center text-sm text-foreground">
                {/* V719D FIX: avgTarPct null → '—' not 0.0%; primary = value-based */}
                <div>{fmtPct(avgTarPct)}</div>
                {avgTarPct !== null && (
                  <div className="text-xs text-muted-foreground font-normal">Avg by value</div>
                )}
              </td>
            </tr>
            {/* V719D: Source label row */}
            <tr className="bg-muted/50">
              <td colSpan={6} className="px-4 py-2 text-xs text-muted-foreground">
                Treatment Acceptance: Source: Dentrix/FastAPI /v2/eod/treatment-plan-completion — completion_rate_by_value (primary), 90-day window. Count-based rate available in tooltip.
                {' '}New Patients: office-level counts may sum higher than top card (cross-location deduplication).
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default GoalVsActualTable;
