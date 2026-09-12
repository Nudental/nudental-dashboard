import React, { useState, useEffect, useCallback } from 'react';
import { ascendApi } from '../services/ascendApi';
import { getLocationIdByOfficeId } from '../constants/offices';
import { format } from 'date-fns';

const fmt = (val) =>
  val != null
    ? `$${Number(val)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const readScopedMonthlySummary = async (api, start, end, selectedLocations, fallbackLocation) => {
  const ids = selectedLocations === undefined ? [fallbackLocation] : [...new Set(selectedLocations)];
  if (!ids.length || (!(ids.length === 1 && ids[0] === null) && ids.some(id => typeof id !== 'string' || !id))) {
    throw new Error('Production and collections are unavailable for a selected office.');
  }
  const results = await Promise.all(ids.map(id => Promise.all([
    api.getProduction(start, end, id), api.getCollections(start, end, id),
  ])));
  if (results.length === 1) return results[0];
  const sum = values => values.some(value => value == null || value === '' || !Number.isFinite(Number(value)))
    ? null : values.reduce((total, value) => total + Number(value), 0);
  return [
    Object.fromEntries(['grossProduction','adjustments','netProduction'].map(field => [field, sum(results.map(result => result[0]?.[field]))])),
    Object.fromEntries(['insuranceCollections','patientCollections','totalCollections'].map(field => [field, sum(results.map(result => result[1]?.[field]))])),
  ];
};

/**
 * Displays the 6 production/collections fields from the middleware API.
 *
 * Props:
 *   mode: 'daily' | 'monthly'
 *   date: string (YYYY-MM-DD) — required for daily mode
 *   startDate: string (YYYY-MM-DD) — required for monthly mode
 *   endDate: string (YYYY-MM-DD) — required for monthly mode
 *   locationId: string | null — Dentrix Ascend locationId (null = all offices)
 *   locationIds: optional selected location list for monthly combined-office reports
 *   officeId: string | null — Supabase office UUID (auto-resolves locationId if provided)
 *   className: string — optional extra wrapper class
 */
const ProductionCollectionsPanel = ({
  mode = 'monthly',
  date,
  startDate,
  endDate,
  locationId: locationIdProp,
  locationIds,
  officeId,
  className = '',
  periodLabel,
  onDataLoaded,
  refreshKey = 0,
}) => {
  const [production, setProduction] = useState(null);
  const [collections, setCollections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolve locationId: explicit prop takes priority, then resolve from officeId UUID
  const resolvedLocationId =
    locationIdProp !== undefined
      ? locationIdProp
      : officeId
      ? getLocationIdByOfficeId(officeId)
      : null;

  const prefix = periodLabel != null ? periodLabel : (mode === 'daily' ? 'Daily' : 'Monthly');

  const fetchData = useCallback(async (isCurrent = () => true) => {
    setLoading(true);
    setError(null);
    setProduction(null);
    setCollections(null);
    try {
      if (mode === 'daily') {
        const effectiveDate = date || format(new Date(), 'yyyy-MM-dd');
        const data = await ascendApi?.getDailySummary(effectiveDate, resolvedLocationId);
        if (!isCurrent()) return;
        setProduction({
          grossProduction: data?.grossProduction ?? data?.production?.gross ?? null,
          adjustments: data?.adjustments ?? data?.production?.adjustments ?? null,
          netProduction: data?.netProduction ?? data?.production?.net ?? null,
        });
        setCollections({
          insuranceCollections: data?.insuranceCollections ?? data?.collections?.insurance ?? null,
          patientCollections: data?.patientCollections ?? data?.collections?.patient ?? null,
          totalCollections: data?.totalCollections ?? data?.collections?.total ?? null,
        });
      } else {
        const effectiveStart =
          startDate ||
          format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
        const effectiveEnd = endDate || format(new Date(), 'yyyy-MM-dd');
        const [prodData, collData] = await readScopedMonthlySummary(ascendApi, effectiveStart, effectiveEnd, locationIds, resolvedLocationId);
        if (!isCurrent()) return;
        const prodState = {
          grossProduction: prodData?.grossProduction ?? null,
          adjustments: prodData?.adjustments ?? null,
          netProduction: prodData?.netProduction ?? null,
        };
        const collState = {
          insuranceCollections: collData?.insuranceCollections ?? null,
          patientCollections: collData?.patientCollections ?? null,
          totalCollections: collData?.totalCollections ?? null,
        };
        setProduction(prodState);
        setCollections(collState);
        // Lift data to parent if callback provided
        if (typeof onDataLoaded === 'function') {
          onDataLoaded({
            netProduction: prodState?.netProduction,
            grossProduction: prodState?.grossProduction,
            totalCollections: collState?.totalCollections,
          });
        }
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.warn('[ProductionCollectionsPanel] fetch error:', err?.message);
      setError(err?.message || 'Failed to load data');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [mode, date, startDate, endDate, resolvedLocationId, refreshKey, JSON.stringify(locationIds)]);

  useEffect(() => {
    let cancelled = false;
    fetchData(() => !cancelled);
    return () => { cancelled = true; };
  }, [fetchData]);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
        {[0, 1]?.map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            {[0, 1, 2]?.map((j) => (
              <div key={j} className="flex justify-between">
                <div className="h-3 bg-muted rounded w-2/5" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error && !production && !collections) {
    return (
      <div className={`bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground ${className}`}>
        Unable to load production &amp; collections data.
      </div>
    );
  }

  const adjustmentsVal = production?.adjustments;
  const adjustmentsDisplay =
    adjustmentsVal != null
      ? adjustmentsVal < 0
        ? `-$${Math.abs(adjustmentsVal)?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : fmt(adjustmentsVal)
      : '—';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Production Summary */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Production Summary
        </h3>
        <div className="space-y-2">
          {/* Gross Production */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{prefix} Production</span>
            <span className="text-sm font-medium text-foreground">
              {fmt(production?.grossProduction)}
            </span>
          </div>
          {/* Adjustments — red when negative */}
          {/* V312: adjustment here is from /v2/production/summary — distinct from the
              Prod. Adjustments KPI card which uses /v2/adjustments/summary totalProductionAdjustments */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{prefix} Production Adjustment</span>
            <span
              className={`text-sm font-medium ${
                adjustmentsVal != null && adjustmentsVal < 0
                  ? 'text-red-500' :'text-foreground'
              }`}
            >
              {adjustmentsDisplay}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">Adjustment sourced from /v2/production/summary</div>
          {/* Net Production — green bold */}
          <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
            <span className="text-sm font-semibold text-foreground">
              Net {prefix} Production
            </span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {fmt(production?.netProduction)}
            </span>
          </div>
        </div>
      </div>

      {/* Collections */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Collections
        </h3>
        <div className="space-y-2">
          {/* Insurance Collections */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {prefix} Insurance Collections
            </span>
            <span className="text-sm font-medium text-foreground">
              {fmt(collections?.insuranceCollections)}
            </span>
          </div>
          {/* Patient Collections */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {prefix} Patient Collections
            </span>
            <span className="text-sm font-medium text-foreground">
              {fmt(collections?.patientCollections)}
            </span>
          </div>
          {/* Total Collections — bold */}
          <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
            <span className="text-sm font-semibold text-foreground">
              {prefix} Total Collections
            </span>
            <span className="text-sm font-bold text-foreground">
              {fmt(collections?.totalCollections)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionCollectionsPanel;
