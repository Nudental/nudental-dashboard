import React, { useMemo } from 'react';
import { parseApiField } from '../../../services/kpiService';

/**
 * SpecialtySection — Specialty / Service Category Performance
 * Source: GET /v2/production/by-cdt-category + GET /v2/financial/filter-options
 *
 * Rules:
 * - Net production is primary; gross/UCR is sub-label only.
 * - Display Unknown / Unmapped exactly as backend returns it — do not hide or relabel.
 * - Do not hardcode category names — use backend categories[] dynamically.
 * - If mapping disabled, display backend reason (not "Coming Soon").
 * - If endpoint unavailable, show N/A and an endpoint unavailable banner.
 * - Do not use providerId filter on this endpoint.
 */

const fmtCount = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? new Intl.NumberFormat('en-US')?.format(Math.round(n)) : 'N/A';
};

const fmtCurrencyOrNA = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n) || isNaN(n)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtPctOrNA = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n) || isNaN(n)) return 'N/A';
  return `${n?.toFixed(1)}%`;
};

const SpecialtySection = ({
  specialtyData,
  filterOptions,
  loading = false,
}) => {
  const cdtData = specialtyData?.data;
  const endpointAvailable = specialtyData?.endpointAvailable;
  const multiOfficePending = specialtyData?.multiOfficePending;

  const filterData = filterOptions?.data;
  const mappingEnabled = filterData?.serviceCategoryMapping?.enabled !== false;
  const mappingDisabledReason = filterData?.serviceCategoryMapping?.disabledReason || null;
  const mappingCoverage = filterData?.serviceCategoryMapping?.coverageActiveProcedures ?? null;

  // Sort categories by netProduction descending
  const sortedCategories = useMemo(() => {
    const cats = cdtData?.categories || [];
    return [...cats]?.sort((a, b) => (parseFloat(b?.netProduction) || 0) - (parseFloat(a?.netProduction) || 0));
  }, [cdtData]);

  const totalNetProduction = parseApiField(cdtData?.totalNetProduction);
  const totalGrossProduction = parseApiField(cdtData?.totalGrossProduction);
  const totalAdjustments = parseApiField(cdtData?.totalAdjustments);
  const adjustmentMethod = cdtData?.adjustmentMethod || null;
  const source = cdtData?.source || null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Specialty / Service Category Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Source: Dentrix Ascend / HS1 ADA-CDT mapping
            {source ? ` · ${source}` : ''}
          </p>
        </div>
        {mappingCoverage !== null && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 self-start">
            Mapping coverage: <span className="font-medium text-foreground">{fmtPctOrNA(mappingCoverage)}</span> of active procedures
          </div>
        )}
      </div>
      {/* Mapping disabled banner */}
      {!mappingEnabled && mappingDisabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-medium">Service category mapping unavailable:</span> {mappingDisabledReason}
        </div>
      )}
      {/* Endpoint unavailable banner */}
      {endpointAvailable === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-medium">Endpoint unavailable:</span> /v2/production/by-cdt-category is not reachable. Specialty category data shows N/A.
        </div>
      )}
      {/* Multi-office pending banner */}
      {multiOfficePending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          Multi-office aggregation in progress. Specialty category data may be incomplete.
        </div>
      )}
      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6]?.map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-6 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      )}
      {/* Summary totals */}
      {!loading && cdtData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Net Production</p>
            <p className="text-lg font-bold text-foreground">{fmtCurrencyOrNA(totalNetProduction)}</p>
            {totalGrossProduction !== null && (
              <p className="text-xs text-muted-foreground mt-0.5">UCR/Gross: {fmtCurrencyOrNA(totalGrossProduction)}</p>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Adjustments</p>
            <p className="text-lg font-bold text-foreground">{fmtCurrencyOrNA(totalAdjustments)}</p>
            {adjustmentMethod && (
              <p className="text-xs text-muted-foreground mt-0.5">{adjustmentMethod}</p>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Categories</p>
            <p className="text-lg font-bold text-foreground">{sortedCategories?.length ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Service categories</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Procedures</p>
            <p className="text-lg font-bold text-foreground">
              {fmtCount(sortedCategories?.reduce((s, c) => s + (parseFloat(c?.procedureCount) || 0), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Across all categories</p>
          </div>
        </div>
      )}
      {/* Category cards — sorted by netProduction descending */}
      {!loading && sortedCategories?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCategories?.map((cat, idx) => {
            const catNet = parseApiField(cat?.netProduction);
            const catGross = parseApiField(cat?.grossProduction);
            const catAdj = parseApiField(cat?.adjustments);
            const catPct = parseApiField(cat?.percentageOfTotalNetProduction);
            const catProcCount = parseApiField(cat?.procedureCount);
            const catAdaCount = parseApiField(cat?.adaCodeCount);
            const catName = cat?.serviceCategory || 'Unknown / Unmapped';

            return (
              <div
                key={`${catName}-${idx}`}
                className="bg-card rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                {/* Category name — display exactly as backend returns it */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{catName}</h3>
                  {catPct !== null && (
                    <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {fmtPctOrNA(catPct)}
                    </span>
                  )}
                </div>

                {/* Net production — primary */}
                <div className="mb-2">
                  <p className="text-xl font-bold text-foreground">{fmtCurrencyOrNA(catNet)}</p>
                  <p className="text-xs text-muted-foreground">Net Production</p>
                  {catGross !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">UCR/Gross: {fmtCurrencyOrNA(catGross)}</p>
                  )}
                </div>

                {/* Procedure count + ADA code count */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{fmtCount(catProcCount)}</p>
                    <p className="text-xs text-muted-foreground">Procedures</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{fmtCount(catAdaCount)}</p>
                    <p className="text-xs text-muted-foreground">ADA Codes</p>
                  </div>
                  {catAdj !== null && (
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fmtCurrencyOrNA(catAdj)}</p>
                      <p className="text-xs text-muted-foreground">Adjustments</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* No data state */}
      {!loading && endpointAvailable !== false && !multiOfficePending && sortedCategories?.length === 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">No specialty category data available for the selected period.</p>
        </div>
      )}
      {/* Endpoint unavailable — no data fallback */}
      {!loading && endpointAvailable === false && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <p className="text-sm font-medium text-foreground mb-1">Specialty Category Data — N/A</p>
          <p className="text-xs text-muted-foreground">The /v2/production/by-cdt-category endpoint is not reachable in this environment.</p>
        </div>
      )}
    </div>
  );
};

export default SpecialtySection;
