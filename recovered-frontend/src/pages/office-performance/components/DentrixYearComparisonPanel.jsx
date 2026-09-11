/**
 * DentrixYearComparisonPanel
 *
 * Source: Dentrix Ascend production, collections, and patients summary endpoints.
 * Expenses and provider metrics are not included until verified source mapping is complete.
 *
 * Allowed endpoints:
 *   - /v2/production/summary  → netProduction only (no grossProduction/UCR fallback)
 *   - /v2/collections/summary → totalCollections
 *   - /v2/patients/summary    → newPatients
 *
 * Forbidden sources (never used here):
 *   - monthly_executive_analytics
 *   - daily_entries
 *   - /v2/reports/kpi-summary
 *   - /v2/production/by-service
 *
 * Null/zero rules:
 *   - Missing/null/undefined/NaN → N/A or —
 *   - Real backend 0 → 0 / $0
 *   - Failed year/office → no fake 0; shows N/A with warning
 *
 * Collection % formula: totalCollections ÷ netProduction
 *   - N/A if either value is missing or netProduction is 0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ascendApi } from '../../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../../constants/offices';
import Icon from '../../../components/AppIcon';

// ─── Null-preserving helpers ──────────────────────────────────────────────────
const safeFloat = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
};
const safeInt = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
};
const fmtCurrency = (val) => {
  if (val === null || val === undefined) return '—';
  return `$${Math.round(val)?.toLocaleString('en-US')}`;
};
const fmtPct = (val) => {
  if (val === null || val === undefined) return 'N/A';
  return `${parseFloat(val)?.toFixed(1)}%`;
};
const fmtCount = (val) => {
  if (val === null || val === undefined) return 'N/A';
  return val?.toString();
};

/**
 * Derive the equivalent date range for a given year from the selected range descriptor.
 *
 * Rules:
 * - If selectedRange is a full year (this_year / last_year / full year), compare Jan 1–Dec 31.
 * - If selectedRange is YTD (this_year partial), compare Jan 1–same day-of-year.
 * - If selectedRange is a specific month, compare same month start–end.
 * - If selectedRange is a partial period, compare the equivalent partial span.
 * - Never silently compare a partial current period to a full prior year.
 *
 * Returns { startDate, endDate, isPartial, label }
 */
function deriveYearRange(selectedRange, targetYear, referenceStart, referenceEnd) {
  const now = new Date();
  // Use local date parts to avoid timezone off-by-one errors
  const todayStr = `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}-${String(now?.getDate())?.padStart(2, '0')}`;

  // Parse reference dates
  const refStart = new Date(referenceStart + 'T00:00:00');
  const refEnd = new Date(referenceEnd + 'T00:00:00');

  const refStartMonth = refStart?.getMonth(); // 0-indexed
  const refStartDay = refStart?.getDate();
  const refEndMonth = refEnd?.getMonth();
  const refEndDay = refEnd?.getDate();

  // Determine if the reference period is a full calendar year
  const isFullYear =
    refStartMonth === 0 && refStartDay === 1 &&
    refEndMonth === 11 && refEndDay === 31;

  // Determine if the reference period is a full month
  const isFullMonth =
    refStartMonth === refEndMonth &&
    refStartDay === 1 &&
    refEndDay === new Date(refStart.getFullYear(), refEndMonth + 1, 0)?.getDate();

  // Build equivalent dates for targetYear
  const startDate = `${targetYear}-${String(refStartMonth + 1)?.padStart(2, '0')}-${String(refStartDay)?.padStart(2, '0')}`;

  // For end date: if the reference end day exceeds the last day of that month in targetYear, clamp it
  const lastDayOfEndMonth = new Date(targetYear, refEndMonth + 1, 0)?.getDate();
  const clampedEndDay = Math.min(refEndDay, lastDayOfEndMonth);
  const endDate = `${targetYear}-${String(refEndMonth + 1)?.padStart(2, '0')}-${String(clampedEndDay)?.padStart(2, '0')}`;

  // A period is partial ONLY when its end date is today or in the future (has not fully completed yet).
  // Use string comparison on YYYY-MM-DD — safe and timezone-agnostic for local dates.
  const isPartial = endDate >= todayStr;

  // Build a human-readable label for the period
  let periodLabel;
  if (isFullYear) {
    periodLabel = `${targetYear}`;
  } else if (isFullMonth) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    periodLabel = `${monthNames?.[refStartMonth]} ${targetYear}`;
  } else {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (refStartMonth === refEndMonth) {
      periodLabel = `${monthNames?.[refStartMonth]} ${refStartDay}–${clampedEndDay}, ${targetYear}`;
    } else {
      periodLabel = `${monthNames?.[refStartMonth]} ${refStartDay} – ${monthNames?.[refEndMonth]} ${clampedEndDay}, ${targetYear}`;
    }
  }

  if (isPartial) {
    periodLabel += ' (partial)';
  }

  return { startDate, endDate, isPartial, label: periodLabel };
}

/**
 * Fetch all three Dentrix metrics for a single year + office.
 * Returns { netProduction, totalCollections, newPatients, collectionPct, error }
 * Missing values are null (not 0).
 */
async function fetchYearMetrics(startDate, endDate, locationId) {
  const [prodResult, collResult, patientsResult] = await Promise.allSettled([
    ascendApi?.getProduction(startDate, endDate, locationId),
    ascendApi?.getCollections(startDate, endDate, locationId),
    ascendApi?.getPatients(startDate, endDate, locationId),
  ]);

  const prod = prodResult?.status === 'fulfilled' ? prodResult?.value : null;
  const coll = collResult?.status === 'fulfilled' ? collResult?.value : null;
  const patients = patientsResult?.status === 'fulfilled' ? patientsResult?.value : null;

  // netProduction ONLY — no grossProduction/UCR fallback
  const netProduction = safeFloat(prod?.netProduction);

  // totalCollections — Math.abs only when value exists
  const rawColl = safeFloat(coll?.totalCollections);
  const totalCollections = rawColl !== null ? Math.abs(rawColl) : null;

  // newPatients
  const newPatients = safeInt(patients?.newPatients);

  // Collection % = totalCollections ÷ netProduction
  // N/A if either is missing or netProduction is 0
  let collectionPct = null;
  if (netProduction !== null && netProduction > 0 && totalCollections !== null) {
    collectionPct = (totalCollections / netProduction) * 100;
  }

  const anyFailed =
    prodResult?.status === 'rejected' ||
    collResult?.status === 'rejected' ||
    patientsResult?.status === 'rejected';

  return {
    netProduction,
    totalCollections,
    newPatients,
    collectionPct,
    hasError: anyFailed,
    errorDetails: [
      prodResult?.status === 'rejected' && 'production',
      collResult?.status === 'rejected' && 'collections',
      patientsResult?.status === 'rejected' && 'patients',
    ]?.filter(Boolean),
  };
}

// ─── Year selector options ────────────────────────────────────────────────────
const currentYear = new Date()?.getFullYear();
const AVAILABLE_YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

// ─── Component ────────────────────────────────────────────────────────────────
const DentrixYearComparisonPanel = ({
  selectedOffice,
  selectedOfficeName,
  selectedRange,
  rangeStart,
  rangeEnd,
  refreshKey = 0,
}) => {
  const [comparisonYears, setComparisonYears] = useState([currentYear, currentYear - 1]);
  const [yearData, setYearData] = useState({});
  const [loading, setLoading] = useState(false);
  const [partialWarning, setPartialWarning] = useState(false);
  const [anyFailed, setAnyFailed] = useState(false);

  const locationId = selectedOffice ? getLocationIdByOfficeId(selectedOffice) : null;

  const loadYearData = useCallback(async () => {
    if (!rangeStart || !rangeEnd) return;
    setLoading(true);
    setAnyFailed(false);

    const results = {};
    let hasAnyPartial = false;
    let hasAnyFailed = false;

    await Promise.all(
      comparisonYears?.map(async (year) => {
        const { startDate, endDate, isPartial, label } = deriveYearRange(
          selectedRange, year, rangeStart, rangeEnd
        );

        if (isPartial) hasAnyPartial = true;

        try {
          const metrics = await fetchYearMetrics(startDate, endDate, locationId);
          if (metrics?.hasError) hasAnyFailed = true;
          results[year] = { ...metrics, isPartial, label, startDate, endDate };
        } catch (err) {
          hasAnyFailed = true;
          results[year] = {
            netProduction: null,
            totalCollections: null,
            newPatients: null,
            collectionPct: null,
            hasError: true,
            errorDetails: ['all'],
            isPartial,
            label,
            startDate,
            endDate,
          };
        }
      })
    );

    setYearData(results);
    setPartialWarning(hasAnyPartial);
    setAnyFailed(hasAnyFailed);
    setLoading(false);
  }, [comparisonYears, selectedOffice, selectedRange, rangeStart, rangeEnd, locationId, refreshKey]);

  useEffect(() => {
    loadYearData();
  }, [loadYearData]);

  const toggleYear = (year) => {
    setComparisonYears((prev) => {
      if (prev?.includes(year)) {
        if (prev?.length <= 1) return prev; // keep at least 1 year
        return prev?.filter((y) => y !== year);
      }
      if (prev?.length >= 4) return prev; // max 4 years
      return [...prev, year]?.sort((a, b) => b - a);
    });
  };

  const metrics = [
    {
      key: 'netProduction',
      label: 'Net Production',
      format: fmtCurrency,
      icon: 'TrendingUp',
    },
    {
      key: 'totalCollections',
      label: 'Total Collections',
      format: fmtCurrency,
      icon: 'DollarSign',
    },
    {
      key: 'collectionPct',
      label: 'Collection %',
      format: fmtPct,
      icon: 'Percent',
      note: 'Collections ÷ Net Production',
    },
    {
      key: 'newPatients',
      label: 'New Patients',
      format: fmtCount,
      icon: 'Users',
    },
  ];

  const sortedYears = [...comparisonYears]?.sort((a, b) => b - a);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="BarChart2" size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Year Comparison — Dentrix Ascend
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Source: Dentrix Ascend production, collections, and patients summary endpoints.
            Expenses and provider metrics are not included until verified source mapping is complete.
          </p>
        </div>
        <button
          onClick={loadYearData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-50"
        >
          <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {/* Year selector chips */}
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium mr-1">Compare years:</span>
        {AVAILABLE_YEARS?.map((year) => {
          const selected = comparisonYears?.includes(year);
          return (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {year}
            </button>
          );
        })}
      </div>
      {/* Warnings */}
      {partialWarning && !loading && (
        <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Icon name="AlertTriangle" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            One or more periods are <strong>partial</strong> — the current period has not ended yet.
            Partial periods are labeled "(partial)" and should not be directly compared to completed periods.
          </p>
        </div>
      )}
      {anyFailed && !loading && (
        <div className="mx-5 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <Icon name="AlertCircle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            One or more API calls failed for some years. Failed values show as N/A or —.
            Partial data warning: do not treat N/A as $0.
          </p>
        </div>
      )}
      {/* Table */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">
              Loading Dentrix data for {comparisonYears?.length} year{comparisonYears?.length > 1 ? 's' : ''}…
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40">
                    Metric
                  </th>
                  {sortedYears?.map((year) => {
                    const d = yearData?.[year];
                    return (
                      <th
                        key={year}
                        className="text-right py-2 px-3 text-xs font-semibold text-foreground min-w-[130px]"
                      >
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{d?.label || year}</span>
                          {d?.isPartial && (
                            <span className="text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                              partial
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {metrics?.map((metric, idx) => (
                  <tr
                    key={metric?.key}
                    className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Icon name={metric?.icon} size={14} className="text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="font-medium text-foreground text-xs">{metric?.label}</span>
                          {metric?.note && (
                            <p className="text-[10px] text-muted-foreground">{metric?.note}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {sortedYears?.map((year) => {
                      const d = yearData?.[year];
                      const rawVal = d ? d?.[metric?.key] : undefined;
                      const formatted = d ? metric?.format(rawVal) : '—';
                      const isMissing = rawVal === null || rawVal === undefined;
                      const isZero = rawVal === 0;

                      return (
                        <td
                          key={year}
                          className={`py-3 px-3 text-right font-mono text-sm ${
                            isMissing
                              ? 'text-muted-foreground'
                              : isZero
                              ? 'text-foreground'
                              : 'text-foreground font-medium'
                          }`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Year-over-year delta row (only when exactly 2 years selected and both have data) */}
        {!loading && sortedYears?.length === 2 && (() => {
          const [yr1, yr2] = sortedYears; // yr1 is more recent
          const d1 = yearData?.[yr1];
          const d2 = yearData?.[yr2];
          if (!d1 || !d2) return null;

          const deltas = metrics?.map((metric) => {
            const v1 = d1?.[metric?.key];
            const v2 = d2?.[metric?.key];
            if (v1 === null || v1 === undefined || v2 === null || v2 === undefined || v2 === 0) {
              return { key: metric?.key, label: metric?.label, delta: null, pct: null };
            }
            const delta = v1 - v2;
            const pct = (delta / Math.abs(v2)) * 100;
            return { key: metric?.key, label: metric?.label, delta, pct };
          });

          const hasAnyDelta = deltas?.some((d) => d?.delta !== null);
          if (!hasAnyDelta) return null;

          return (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Year-over-Year Change ({yr1} vs {yr2})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {deltas?.map((d) => {
                  if (d?.delta === null) {
                    return (
                      <div key={d?.key} className="bg-muted/30 rounded-md p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">{d?.label}</p>
                        <p className="text-sm text-muted-foreground">N/A</p>
                      </div>
                    );
                  }
                  const isPositive = d?.delta >= 0;
                  return (
                    <div
                      key={d?.key}
                      className={`rounded-md p-3 ${
                        isPositive ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                      }`}
                    >
                      <p className="text-[10px] text-muted-foreground mb-1">{d?.label}</p>
                      <div className="flex items-center gap-1">
                        <Icon
                          name={isPositive ? 'TrendingUp' : 'TrendingDown'}
                          size={12}
                          className={isPositive ? 'text-green-600' : 'text-red-500'}
                        />
                        <span
                          className={`text-sm font-semibold ${
                            isPositive ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? '+' : ''}{d?.pct?.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Source note */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">
            <strong>Source:</strong> Dentrix Ascend{' '}
            <code className="bg-muted px-1 rounded text-[10px]">/v2/production/summary</code>,{' '}
            <code className="bg-muted px-1 rounded text-[10px]">/v2/collections/summary</code>,{' '}
            <code className="bg-muted px-1 rounded text-[10px]">/v2/patients/summary</code>.{' '}
            Net Production uses <code className="bg-muted px-1 rounded text-[10px]">netProduction</code> field only — no gross/UCR fallback.{' '}
            Collection % = Total Collections ÷ Net Production.{' '}
            Missing values display as N/A or —; real backend $0 displays as $0.
            {selectedOfficeName && (
              <> Office: <strong>{selectedOfficeName}</strong>.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DentrixYearComparisonPanel;
