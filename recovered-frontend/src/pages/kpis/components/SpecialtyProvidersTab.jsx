import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * SpecialtyProvidersTab — Provider-by-CDT-Category breakdown
 * Source: GET /v2/production/by-provider-and-cdt-category
 *
 * Rules:
 * - Do NOT use /v2/production/by-cdt-category with providerId filter.
 * - Do NOT guess provider specialty from names — use backend specialtyGroup/specialtyLabel only.
 * - Unknown providers show "Unknown / Unmapped Provider Specialty".
 * - Unattributed office-level rows are clearly labeled.
 * - reconciliationDiff when filters are active may be expected — do not show error
 *   unless reconciliationNote explicitly says it is a true error.
 * - totalNetProduction here = provider-attributed net production only.
 *   It does NOT equal /v2/production/summary netProduction.
 * - Gross/UCR is sub-label only, not primary.
 */

const fmtCurrencyOrNA = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n) || isNaN(n)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtCount = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? new Intl.NumberFormat('en-US')?.format(Math.round(n)) : 'N/A';
};

const fmtPctOrNA = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n) || isNaN(n)) return 'N/A';
  return `${n?.toFixed(1)}%`;
};

const PROVIDER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'hygienist', label: 'Hygienist' },
];

const SpecialtyProvidersTab = ({
  specialtyProvidersData,
  loading = false,
  providerTypeFilter,
  specialtyGroupFilter,
  onProviderTypeChange,
  onSpecialtyGroupChange,
}) => {
  const [expandedProviders, setExpandedProviders] = useState({});

  const responseData = specialtyProvidersData?.data;
  const endpointAvailable = specialtyProvidersData?.endpointAvailable;
  const multiOfficePending = specialtyProvidersData?.multiOfficePending;

  const providers = responseData?.providers || [];
  const totalNetProduction = responseData?.totalNetProduction ?? null;
  const totalGrossProduction = responseData?.totalGrossProduction ?? null;
  const totalAdjustments = responseData?.totalAdjustments ?? null;
  const reconciliationOk = responseData?.reconciliationOk ?? null;
  const reconciliationNote = responseData?.reconciliationNote ?? null;
  const adjustmentMethod = responseData?.adjustmentMethod ?? null;
  const source = responseData?.source ?? null;

  // Derive available specialtyGroups from the response — do NOT hardcode
  const availableSpecialtyGroups = useMemo(() => {
    const groups = new Set();
    providers?.forEach((p) => {
      if (p?.specialtyGroup) groups?.add(p?.specialtyGroup);
    });
    return Array.from(groups)?.sort();
  }, [providers]);

  const specialtyGroupOptions = useMemo(() => [
    { value: 'all', label: 'All Specialties' },
    ...availableSpecialtyGroups?.map((g) => ({ value: g, label: g })),
  ], [availableSpecialtyGroups]);

  const toggleProvider = (key) => {
    setExpandedProviders((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  // Reconciliation warning — only show if reconciliationOk is explicitly false AND
  // reconciliationNote indicates a true error (not just filter-induced difference)
  const showReconciliationWarning =
    reconciliationOk === false &&
    reconciliationNote &&
    reconciliationNote?.toLowerCase()?.includes('error');

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Specialty Providers by Service Category</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Source: Dentrix provider attribution + HS1 ADA-CDT mapping
            {source ? ` · ${source}` : ''}
          </p>
        </div>
      </div>
      {/* Filter controls */}
      <div className="flex flex-wrap gap-3">
        {/* Provider type filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Provider Type:</label>
          <select
            value={providerTypeFilter || 'all'}
            onChange={(e) => onProviderTypeChange?.(e?.target?.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {PROVIDER_TYPE_OPTIONS?.map((opt) => (
              <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
            ))}
          </select>
        </div>

        {/* Specialty group filter — derived from backend response, not hardcoded */}
        {availableSpecialtyGroups?.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">Specialty:</label>
            <select
              value={specialtyGroupFilter || 'all'}
              onChange={(e) => onSpecialtyGroupChange?.(e?.target?.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {specialtyGroupOptions?.map((opt) => (
                <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {/* Endpoint unavailable banner */}
      {endpointAvailable === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-medium">Endpoint unavailable:</span> /v2/production/by-provider-and-cdt-category is not reachable. Specialty provider data shows N/A.
        </div>
      )}
      {/* Multi-office pending banner */}
      {multiOfficePending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          Multi-office provider data is being merged across selected offices.
        </div>
      )}
      {/* Reconciliation warning — only shown when backend explicitly flags a true error */}
      {showReconciliationWarning && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          <span className="font-medium">Reconciliation note:</span> {reconciliationNote}
        </div>
      )}
      {/* Reconciliation info note — when filters are active and diff is expected */}
      {reconciliationOk === false && !showReconciliationWarning && reconciliationNote && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium">Note:</span> {reconciliationNote} Provider-attributed net production does not equal office-level summary (unattributed residual exists — this is expected).
        </div>
      )}
      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3]?.map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/4 mb-2" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}
      {/* Summary totals */}
      {!loading && responseData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Provider-Attributed Net</p>
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
            <p className="text-xs text-muted-foreground mb-1">Providers</p>
            <p className="text-lg font-bold text-foreground">{providers?.length ?? 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">In selected period</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Attribution Note</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Provider-attributed net only. Office-level unattributed residual excluded — this is expected.
            </p>
          </div>
        </div>
      )}
      {/* Provider rows */}
      {!loading && providers?.length > 0 && (
        <div className="space-y-3">
          {providers?.map((provider, idx) => {
            const providerKey = `${provider?.providerId || idx}-${provider?.locationId || ''}`;
            const isExpanded = expandedProviders?.[providerKey] || false;

            const providerNet = provider?.netProduction ?? null;
            const providerGross = provider?.grossProduction ?? null;
            const providerAdj = provider?.adjustments ?? null;
            const categories = provider?.categories || [];

            // Specialty label — use backend fields only, never guess from name
            const specialtyLabel = provider?.specialtyLabel || null;
            const specialtyGroup = provider?.specialtyGroup || null;
            const isSpecialtyProvider = provider?.isSpecialtyProvider ?? null;
            const mappingSource = provider?.mappingSource || null;

            // Display specialty — use backend label, fall back to group, then Unknown
            const specialtyDisplay =
              specialtyLabel ||
              specialtyGroup ||
              'Unknown / Unmapped Provider Specialty';

            const providerType = provider?.providerType || 'unattributed';
            const officeName = provider?.officeName || '—';

            // Top categories by netProduction
            const topCategories = [...categories]?.sort((a, b) => (parseFloat(b?.netProduction) || 0) - (parseFloat(a?.netProduction) || 0))?.slice(0, 3);

            const totalProcedureCount = categories?.reduce(
              (s, c) => s + (parseFloat(c?.procedureCount) || 0),
              0
            );

            return (
              <div key={providerKey} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                {/* Provider header row */}
                <button
                  onClick={() => toggleProvider(providerKey)}
                  className="w-full text-left px-4 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 text-muted-foreground flex-shrink-0">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground">
                            {provider?.providerName || 'Unknown Provider'}
                          </span>
                          {/* Provider type badge */}
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            providerType === 'doctor'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : providerType === 'hygienist' ?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :'bg-muted text-muted-foreground'
                          }`}>
                            {providerType}
                          </span>
                          {/* Specialty badge — from backend only */}
                          {isSpecialtyProvider && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              Specialty
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{specialtyDisplay}</span>
                          {officeName !== '—' && <span>· {officeName}</span>}
                          {mappingSource && <span>· {mappingSource}</span>}
                        </div>
                        {/* Top categories preview */}
                        {topCategories?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {topCategories?.map((cat, ci) => (
                              <span key={ci} className="text-xs bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5">
                                {cat?.serviceCategory || 'Unknown'}
                              </span>
                            ))}
                            {categories?.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{categories?.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Production summary */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-foreground">{fmtCurrencyOrNA(providerNet)}</p>
                      <p className="text-xs text-muted-foreground">Net Production</p>
                      {providerGross !== null && (
                        <p className="text-xs text-muted-foreground">UCR: {fmtCurrencyOrNA(providerGross)}</p>
                      )}
                      {totalProcedureCount > 0 && (
                        <p className="text-xs text-muted-foreground">{fmtCount(totalProcedureCount)} procedures</p>
                      )}
                    </div>
                  </div>
                </button>
                {/* Expanded category breakdown */}
                {isExpanded && categories?.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Service Category Breakdown
                    </p>
                    <div className="space-y-2">
                      {[...categories]?.sort((a, b) => (parseFloat(b?.netProduction) || 0) - (parseFloat(a?.netProduction) || 0))?.map((cat, ci) => {
                          const catNet = cat?.netProduction ?? null;
                          const catPct = cat?.percentageOfProviderNetProduction ?? null;
                          const catProc = cat?.procedureCount ?? null;
                          const catAda = cat?.adaCodeCount ?? null;
                          const catName = cat?.serviceCategory || 'Unknown / Unmapped';

                          return (
                            <div key={ci} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{catName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtCount(catProc)} procedures · {fmtCount(catAda)} ADA codes
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-semibold text-foreground">{fmtCurrencyOrNA(catNet)}</p>
                                {catPct !== null && (
                                  <p className="text-xs text-teal-600 dark:text-teal-400">{fmtPctOrNA(catPct)} of provider</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {providerAdj !== null && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Adjustments: {fmtCurrencyOrNA(providerAdj)}
                      </p>
                    )}
                  </div>
                )}
                {/* Expanded but no categories */}
                {isExpanded && categories?.length === 0 && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    <p className="text-xs text-muted-foreground">No service category breakdown available for this provider.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* No providers state */}
      {!loading && endpointAvailable !== false && !multiOfficePending && providers?.length === 0 && responseData && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">No provider data available for the selected period and filters.</p>
        </div>
      )}
      {/* Endpoint unavailable — no data fallback */}
      {!loading && endpointAvailable === false && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <p className="text-sm font-medium text-foreground mb-1">Specialty Provider Data — N/A</p>
          <p className="text-xs text-muted-foreground">The /v2/production/by-provider-and-cdt-category endpoint is not reachable in this environment.</p>
        </div>
      )}
    </div>
  );
};

export default SpecialtyProvidersTab;
