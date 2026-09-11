import React, { useState, useEffect, useMemo } from 'react';
import { ascendApi } from '../../../services/ascendApi';
import Icon from '../../../components/AppIcon';

// ─── Null-preserving helpers (local, same rules as index.jsx V281) ────────────
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
  return `$${val?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtPct = (val) => {
  if (val === null || val === undefined) return 'N/A';
  return `${val?.toFixed(1)}%`;
};
const fmtCount = (val) => {
  if (val === null || val === undefined) return '—';
  return val?.toString();
};
const fmtHours = (val) => {
  if (val === null || val === undefined) return '—';
  return `${parseFloat(val)?.toFixed(1)}h`;
};

/**
 * Compute collection % from provider row.
 * Formula: collections ÷ netProduction
 * Returns null if either is missing or netProduction is 0.
 */
const computeCollectionPct = (row) => {
  const net = safeFloat(row?.netProduction);
  const coll = safeFloat(row?.collections ?? row?.totalCollections);
  if (net === null || coll === null || net === 0) return null;
  return (coll / net) * 100;
};

/**
 * Normalize a provider row from the /v2/reports/provider-performance response.
 * Only uses fields the backend actually returns — no guessing from provider name.
 */
const normalizeRow = (row) => ({
  providerId: row?.providerId ?? row?.provider_id ?? null,
  providerName: row?.providerName ?? row?.provider_name ?? '—',
  // providerType only if backend returns it — never inferred from name
  providerType: row?.providerType ?? row?.providerCategory ?? row?.provider_type ?? null,
  locationId: row?.locationId ?? row?.location_id ?? null,
  locationName: row?.locationName ?? row?.officeName ?? row?.location_name ?? null,
  netProduction: safeFloat(row?.netProduction ?? row?.net_production),
  collections: safeFloat(row?.collections ?? row?.totalCollections ?? row?.total_collections),
  completedAppointmentCount: safeInt(row?.completedAppointmentCount ?? row?.completed_appointment_count ?? row?.completedVisits ?? row?.visits),
  chairAppointmentCount: safeInt(row?.chairAppointmentCount ?? row?.chair_appointment_count),
  scheduledChairHours: safeFloat(row?.scheduledChairHours ?? row?.scheduled_chair_hours),
  productionPerHour: safeFloat(row?.productionPerHour ?? row?.production_per_hour),
  productionPerAppointment: safeFloat(row?.productionPerAppointment ?? row?.production_per_appointment),
});

/**
 * ProviderProductivityChart
 *
 * Self-contained component for the Financial Analytics → Productivity tab.
 * Fetches from /v2/reports/provider-performance.
 * Provider filter lives here — does NOT affect office-level KPIs, production panel,
 * revenue trends, or year comparison.
 *
 * Props:
 *   selectedOffice      — office UUID (used for display only)
 *   selectedOfficeName  — display name string
 *   rangeStart          — YYYY-MM-DD
 *   rangeEnd            — YYYY-MM-DD
 *   resolvedLocationId  — Dentrix locationId (null = all offices)
 */
const ProviderProductivityChart = ({
  selectedOffice,
  selectedOfficeName,
  rangeStart,
  rangeEnd,
  resolvedLocationId,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);

  // Provider filter state — lives here, does NOT affect other sections
  const [selectedProviderIds, setSelectedProviderIds] = useState([]); // [] = all
  const [selectedProviderType, setSelectedProviderType] = useState('all'); // 'all' | 'Doctor' | 'Hygienist'

  // Fetch provider performance data
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setEndpointUnavailable(false);
      setPartialFailure(false);
      setRows([]);

      try {
        const data = await ascendApi?.getProviderPerformance(rangeStart, rangeEnd, resolvedLocationId);

        // Response may be an array of rows, or { providers: [...] }, or { data: [...] }
        let rawRows = [];
        if (Array.isArray(data)) {
          rawRows = data;
        } else if (Array.isArray(data?.providers)) {
          rawRows = data?.providers;
        } else if (Array.isArray(data?.data)) {
          rawRows = data?.data;
        } else if (Array.isArray(data?.results)) {
          rawRows = data?.results;
        } else if (data && typeof data === 'object') {
          // Single row returned as object
          rawRows = [data];
        }

        if (rawRows?.length === 0) {
          setRows([]);
          setError('No provider data returned for this date range and office.');
          return;
        }

        const normalized = rawRows?.map(normalizeRow);

        // Check for partial failure: if some rows have null netProduction, warn
        const hasPartial = normalized?.some(
          (r) => r?.netProduction === null && r?.collections === null
        );
        if (hasPartial) setPartialFailure(true);

        setRows(normalized);
      } catch (err) {
        const status = err?.message?.match(/(\d{3})/)?.[1];
        if (status === '404' || status === '501' || status === '503') {
          setEndpointUnavailable(true);
        } else {
          setError(err?.message || 'Failed to load provider performance data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [rangeStart, rangeEnd, resolvedLocationId]);

  // Derive available provider types from backend data (only if backend returns providerType)
  const availableTypes = useMemo(() => {
    const types = new Set();
    rows?.forEach((r) => {
      if (r?.providerType) types?.add(r?.providerType);
    });
    return Array.from(types)?.sort();
  }, [rows]);

  const hasProviderTypeFromBackend = availableTypes?.length > 0;

  // Filtered rows based on provider filter selections
  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by provider type (only if backend provides it)
    if (hasProviderTypeFromBackend && selectedProviderType !== 'all') {
      result = result?.filter((r) => r?.providerType === selectedProviderType);
    }

    // Filter by specific provider IDs
    if (selectedProviderIds?.length > 0) {
      result = result?.filter((r) => selectedProviderIds?.includes(r?.providerId ?? r?.providerName));
    }

    return result;
  }, [rows, selectedProviderIds, selectedProviderType, hasProviderTypeFromBackend]);

  const isAllOffice = !resolvedLocationId;

  // Toggle a specific provider in/out of the filter
  const toggleProvider = (key) => {
    setSelectedProviderIds((prev) =>
      prev?.includes(key) ? prev?.filter((k) => k !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    setSelectedProviderIds([]);
    setSelectedProviderType('all');
  };

  // ─── Render: endpoint unavailable ────────────────────────────────────────
  if (endpointUnavailable) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="AlertTriangle" size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            Provider performance endpoint unavailable / mapping required
          </p>
        </div>
        <p className="text-xs text-amber-700 leading-relaxed">
          The <code className="bg-amber-100 px-1 rounded">/v2/reports/provider-performance</code> endpoint
          returned an error or is not yet available for this office. Provider productivity data cannot be
          displayed until the endpoint is confirmed and mapped.
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Source: Dentrix Ascend / provider-performance endpoint. Contact your system administrator to
          verify endpoint availability.
        </p>
      </div>
    );
  }

  // ─── Render: loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="loading-spinner" />
        <p className="text-sm text-muted-foreground">Loading provider performance data…</p>
      </div>
    );
  }

  // ─── Render: error (non-404) ──────────────────────────────────────────────
  if (error && rows?.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="AlertTriangle" size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">Provider data unavailable</p>
        </div>
        <p className="text-xs text-amber-700">{error}</p>
        <p className="text-xs text-amber-600 mt-1">
          Source: Dentrix Ascend / provider-performance endpoint.
        </p>
      </div>
    );
  }

  // ─── Render: data table ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Provider Productivity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedOfficeName ? `${selectedOfficeName} · ` : ''}
            {rangeStart} – {rangeEnd}
          </p>
        </div>
        {rows?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Provider type filter — only shown if backend returns providerType */}
            {hasProviderTypeFromBackend && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Type:</span>
                {['all', ...availableTypes]?.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedProviderType(t)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      selectedProviderType === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            )}
            {/* Clear filters */}
            {(selectedProviderIds?.length > 0 || selectedProviderType !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      {/* Partial data warning */}
      {partialFailure && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <Icon name="AlertTriangle" size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Some provider rows are missing production or collections data. Those fields show — and are
            excluded from collection % calculations.
          </p>
        </div>
      )}
      {/* Provider name filter chips — shown when there are multiple providers */}
      {rows?.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {rows?.map((r) => {
            const key = r?.providerId ?? r?.providerName;
            const active = selectedProviderIds?.length === 0 || selectedProviderIds?.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleProvider(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-primary/10 border-primary/30 text-primary' :'bg-muted border-border text-muted-foreground opacity-50'
                }`}
              >
                {r?.providerName}
                {r?.providerType ? (
                  <span className="ml-1 opacity-60">· {r?.providerType}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {/* Data table */}
      {filteredRows?.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No providers match the current filter selection.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Provider
                </th>
                {isAllOffice && (
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Office
                  </th>
                )}
                {hasProviderTypeFromBackend && (
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    Type
                  </th>
                )}
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Net Production
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Collections
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Collection %
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Visits
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Chair Hours
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Prod / Hour
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Prod / Visit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows?.map((row, idx) => {
                const collPct = computeCollectionPct(row);
                const rowKey = row?.providerId ?? `${row?.providerName}-${idx}`;
                return (
                  <tr key={rowKey} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                      {row?.providerName}
                    </td>
                    {isAllOffice && (
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                        {row?.locationName ?? '—'}
                      </td>
                    )}
                    {hasProviderTypeFromBackend && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {row?.providerType ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {row?.providerType}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtCurrency(row?.netProduction)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtCurrency(row?.collections)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {collPct !== null ? (
                        <span
                          className={`font-medium ${
                            collPct >= 90
                              ? 'text-green-600'
                              : collPct >= 75
                              ? 'text-amber-600' :'text-red-600'
                          }`}
                        >
                          {fmtPct(collPct)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-foreground whitespace-nowrap">
                      {fmtCount(row?.completedAppointmentCount)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-foreground whitespace-nowrap">
                      {fmtHours(row?.scheduledChairHours)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtCurrency(row?.productionPerHour)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                      {fmtCurrency(row?.productionPerAppointment)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Source note */}
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">Source:</span> Dentrix Ascend /
        provider-performance endpoint. Net Production uses{' '}
        <code className="bg-muted px-1 rounded">netProduction</code> only — no gross/UCR fallback.
        Collection % = Collections ÷ Net Production (N/A when either is missing or Net Production is
        zero). Provider type is shown only when returned by backend mapping — never inferred from
        provider name. Missing values show — or N/A; real backend 0 shows $0.
      </div>
    </div>
  );
};

export default ProviderProductivityChart;