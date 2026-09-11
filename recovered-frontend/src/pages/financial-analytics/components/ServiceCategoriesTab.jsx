import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../../constants/offices';

const fmt = (val, fallback = 'N/A') => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  if (!isFinite(n)) return fallback;
  return n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtPct = (val, fallback = 'N/A') => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  if (!isFinite(n)) return fallback;
  return `${n?.toFixed(2)}%`;
};

const fmtCount = (val, fallback = 'N/A') => {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  if (!isFinite(n)) return fallback;
  return n?.toLocaleString('en-US');
};

const ServiceCategoriesTab = ({
  startDate,
  endDate,
  appliedOffices,
  refreshKey,
  selectedProviders,
  selectedServiceCategory: externalServiceCategory,
}) => {
  const [filterOptions, setFilterOptions] = useState(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState(null);

  // Internal category selection (pill buttons in the tab) — overridden by external prop if provided
  const [internalCategory, setInternalCategory] = useState('all');

  // Effective selected category: external (from FilterPanel) takes precedence
  const selectedCategory = externalServiceCategory || internalCategory;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const locationId =
    appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
      ? getLocationIdByOfficeId(appliedOffices?.[0])
      : null;

  const providerId =
    selectedProviders?.length === 1 && selectedProviders?.[0] !== 'all'
      ? selectedProviders?.[0]
      : null;

  // ── Fetch filter options (serviceCategories + serviceCategoryMapping) ──
  const fetchFilterOptions = useCallback(async () => {
    if (!startDate || !endDate) return;
    setFilterOptionsLoading(true);
    setFilterOptionsError(null);
    try {
      const opts = await ascendApi?.getFinancialFilterOptions(startDate, endDate, locationId);
      setFilterOptions(opts ?? null);
    } catch (err) {
      setFilterOptionsError(err?.message || 'Failed to load filter options');
      setFilterOptions(null);
    } finally {
      setFilterOptionsLoading(false);
    }
  }, [startDate, endDate, locationId]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions, refreshKey]);

  // ── Fetch production by CDT category ────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    // Only fetch if mapping is enabled
    if (filterOptions && filterOptions?.serviceCategoryMapping?.enabled === false) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ascendApi?.getProductionByCdtCategory(
        startDate,
        endDate,
        locationId,
        {
          providerId: providerId || undefined,
          serviceCategory: selectedCategory !== 'all' ? selectedCategory : undefined,
        }
      );
      setData(result ?? null);
    } catch (err) {
      setError(err?.message || 'Failed to load service category data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationId, providerId, selectedCategory, filterOptions]);

  useEffect(() => {
    // Wait until filter options have been fetched before fetching data
    if (!filterOptionsLoading) {
      fetchData();
    }
  }, [fetchData, filterOptionsLoading, refreshKey]);

  const mapping = filterOptions?.serviceCategoryMapping ?? null;
  const serviceCategories = filterOptions?.serviceCategories ?? [];
  const mappingEnabled = mapping?.enabled !== false; // default true if not present

  // ── Disabled state ───────────────────────────────────────────────────────
  if (!filterOptionsLoading && !mappingEnabled) {
    const reason = mapping?.reason || 'Dentrix CDT mapping required';
    return (
      <div className="bg-card border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Icon name="Tag" size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Service Categories</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Icon name="AlertTriangle" size={22} className="text-amber-600" />
          </div>
          <p className="text-sm font-medium text-foreground">{reason}</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Service category filtering requires the Dentrix Ascend / HS1 ADA-CDT procedure mapping to be active.
          </p>
        </div>
      </div>
    );
  }

  // ── Rows from response ───────────────────────────────────────────────────
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.categories)
    ? data?.categories
    : Array.isArray(data?.data)
    ? data?.data
    : null;

  const coveragePct = mapping?.coveragePercent ?? mapping?.coverage ?? null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name="Tag" size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Service Categories</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production grouped by ADA/CDT procedure category
            </p>
          </div>
        </div>
        {/* Source note */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
            Source: Dentrix Ascend / HS1 ADA-CDT mapping
          </span>
          {coveragePct !== null && (
            <span className="text-xs text-muted-foreground">
              Mapping coverage: {typeof coveragePct === 'number' ? `${coveragePct?.toFixed(2)}%` : coveragePct} active production procedures
            </span>
          )}
        </div>
      </div>
      {/* Category filter — pill buttons for in-tab selection */}
      {!filterOptionsLoading && serviceCategories?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setInternalCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All Categories
          </button>
          {serviceCategories?.map((cat) => {
            const isEnabled = cat?.enabled !== false;
            return (
              <button
                key={cat?.value}
                onClick={() => isEnabled && setInternalCategory(cat?.value)}
                disabled={!isEnabled}
                title={!isEnabled ? 'No data for this category in selected range' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat?.value
                    ? 'bg-primary text-primary-foreground'
                    : isEnabled
                    ? 'bg-muted text-muted-foreground hover:text-foreground'
                    : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                {cat?.label}
                {cat?.procedureCount != null && (
                  <span className="ml-1 opacity-60">({fmtCount(cat?.procedureCount)})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {/* Show active filter from FilterPanel if set */}
      {externalServiceCategory && externalServiceCategory !== 'all' && (
        <div className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-xs text-primary font-medium">
            Filtered by: {serviceCategories?.find(c => c?.value === externalServiceCategory)?.label || externalServiceCategory}
            <span className="ml-1 text-muted-foreground font-normal">(set in Advanced Filters)</span>
          </p>
        </div>
      )}
      {/* Loading state */}
      {(filterOptionsLoading || loading) && (
        <div className="flex items-center justify-center py-16 gap-3">
          <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-muted-foreground">Loading service category data…</span>
        </div>
      )}
      {/* Error state */}
      {!loading && !filterOptionsLoading && (error || filterOptionsError) && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="AlertCircle" size={20} className="text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">
            {error || filterOptionsError}
          </p>
          <button
            onClick={() => { fetchFilterOptions(); }}
            className="text-xs text-primary underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      {/* Empty state */}
      {!loading && !filterOptionsLoading && !error && !filterOptionsError && rows !== null && rows?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="Inbox" size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No service category data returned for the selected filters.
          </p>
          <p className="text-xs text-muted-foreground">
            Try adjusting the date range, location, or category filter.
          </p>
        </div>
      )}
      {/* Data table */}
      {!loading && !filterOptionsLoading && !error && !filterOptionsError && rows !== null && rows?.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Service Category
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Procedures
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  ADA Codes
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Gross Production
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Adjustments
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Net Production
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  % of Total Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows?.map((row, idx) => {
                const catLabel = row?.serviceCategory ?? row?.category ?? `Row ${idx + 1}`;
                return (
                  <tr
                    key={`${catLabel}-${idx}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {catLabel}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmtCount(row?.procedureCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmtCount(row?.adaCodeCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmt(row?.grossProduction)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {row?.adjustments !== null && row?.adjustments !== undefined
                        ? fmt(row?.adjustments)
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {fmt(row?.netProduction)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row?.percentageOfTotalNetProduction !== null && row?.percentageOfTotalNetProduction !== undefined ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, Number(row?.percentageOfTotalNetProduction) || 0))}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs w-12 text-right">
                            {fmtPct(row?.percentageOfTotalNetProduction)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Footer note */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Icon name="Info" size={12} />
          <span>
            <strong>Gross Production</strong> = UCR / procedure charges before adjustments.{' '}
            <strong>Net Production</strong> = after production adjustments.
          </span>
        </div>
        <span className="hidden sm:inline text-muted-foreground/40">·</span>
        <span>Collections are not calculated here.</span>
      </div>
      <div className="flex items-start gap-1.5 pt-1 text-xs text-amber-600 dark:text-amber-400">
        <Icon name="AlertTriangle" size={12} className="mt-0.5 shrink-0" />
        <span>
          CDT category totals may not sum to full office net production. Unattributed or placeholder-provider production cannot be CDT-attributed and is excluded from this breakdown. This is not a frontend reconciliation error.
        </span>
      </div>
    </div>
  );
};

export default ServiceCategoriesTab;
