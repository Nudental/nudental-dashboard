import React, { useState, useEffect, useCallback } from 'react';

import Icon from '../../../components/AppIcon';
import { fmtCurrency, fmtNum } from '../../../services/operationsService';
import { ascendApi } from '../../../services/ascendApi';
import { LOCATION_ID_MAP } from '../../../constants/offices';

// ─── Stage 2A: ProvidersTab ──────────────────────────────────────────────────
// Source: Dentrix /v2/reports/provider-performance (trusted fields only)
// Removed: daily_entries.production, daily_entries row-count visits,
//          daily_entries.treatment_accepted/presented, provider_type-as-production
// Missing fields → N/A (not 0)

const TYPE_COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6'];

// Safe display helpers — null/undefined → 'N/A', confirmed 0 → '$0'
const displayCurrency = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtCurrency(v);
};
const displayNum = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtNum(v);
};
const displayPct = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

const ProvidersTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('netProduction');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [procedureSelectorOpen, setProcedureSelectorOpen] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [procedureSearch, setProcedureSearch] = useState('');

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const resolveOfficeName = (officeId) => {
    if (!officeId) return null;
    return officeMap?.[officeId] || null;
  };

  // Build ISO date strings from dateRange year/month integers
  const buildDates = useCallback(() => {
    if (!dateRange) return null;
    const { startYear, startMonth, endYear, endMonth } = dateRange;
    const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
    const lastDay = new Date(endYear, endMonth, 0)?.getDate();
    const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
    return { startDate, endDate };
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth]);

  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    setApiError(null);
    try {
      const dates = buildDates();
      if (!dates) return;

      // Determine locationId(s) to fetch
      // If single office selected, pass its locationId; otherwise fetch all (null = all offices)
      const locationIds =
        officeIds?.length === 1
          ? [LOCATION_ID_MAP?.[officeIds?.[0]] || null]
          : officeIds?.length > 1
          ? officeIds?.map((id) => LOCATION_ID_MAP?.[id] || null)?.filter(Boolean)
          : [null]; // all offices

      // Fetch provider-performance for each locationId
      const results = await Promise.allSettled(
        locationIds?.map((locId) =>
          ascendApi?.getProviderPerformance(dates?.startDate, dates?.endDate, locId)
        )
      );

      // Collect all provider rows from fulfilled responses
      const allRows = [];
      results?.forEach((res, idx) => {
        if (res?.status === 'fulfilled') {
          const payload = res?.value;
          // API may return { rows: [...] } or { providers: [...] } or array directly
          const rows = Array.isArray(payload)
            ? payload
            : payload?.rows || payload?.providers || payload?.data || [];
          rows?.forEach((row) => {
            // Tag with the officeId used for this fetch (for display)
            const officeId = officeIds?.length > 1 ? officeIds?.[idx] : officeIds?.[0] || null;
            allRows?.push({ ...row, _officeId: officeId });
          });
        }
      });

      // Map to display-safe records using ONLY trusted fields
      const mapped = allRows?.map((row) => ({
        providerName: row?.providerName || row?.provider_name || row?.name || 'Unknown',
        providerType: row?.providerType || row?.provider_type || null,
        locationId: row?.locationId || row?.location_id || null,
        _officeId: row?._officeId || null,
        // Trusted financial fields — null if missing
        netProduction: row?.netProduction != null ? parseFloat(row?.netProduction) : null,
        collections: row?.collections != null ? parseFloat(row?.collections) : null,
        // Trusted appointment/visit fields — null if missing
        completedAppointmentCount:
          row?.completedAppointmentCount != null
            ? parseInt(row?.completedAppointmentCount)
            : row?.chairAppointmentCount != null
            ? parseInt(row?.chairAppointmentCount)
            : null,
        // Trusted efficiency fields — null if missing
        productionPerHour:
          row?.productionPerHour != null ? parseFloat(row?.productionPerHour) : null,
        scheduledChairHours:
          row?.scheduledChairHours != null ? parseFloat(row?.scheduledChairHours) : null,
      }));

      // V274 audit: Unattributed / Office-Level rows come from provider rows where:
      // - providerName is blank/null/empty, OR
      // - providerType is null/unmapped (no backend providerType field), OR
      // - provider_id is null in the backend response
      // These are NOT merged with named providers. They are kept as-is from the API.
      // Duplicate provider names (e.g., Admasu Gizachew, Temp Hygiene) appearing more than once
      // are different office/location rows returned by the API for different locationIds.
      // They are NOT merged here — each row represents a distinct office context.

      setData(mapped);
    } catch (e) {
      console.error('ProvidersTab error:', e);
      setApiError('Provider data unavailable. Dentrix connection required.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <Icon name="ChevronsUpDown" size={12} className="text-muted-foreground" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUp" size={12} className="text-primary" />
      : <Icon name="ChevronDown" size={12} className="text-primary" />;
  };

  const filtered = data
    ?.filter((r) => !search || r?.providerName?.toLowerCase()?.includes(search?.toLowerCase()))
    ?.sort((a, b) => {
      const av = a?.[sortKey] ?? -Infinity;
      const bv = b?.[sortKey] ?? -Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const COLS = [
    { key: 'providerName', label: 'Provider Name', sortable: false },
    { key: 'providerType', label: 'Type', sortable: false },
    { key: '_officeId', label: 'Office', sortable: false },
    { key: 'netProduction', label: 'Net Production', sortable: true },
    { key: 'collections', label: 'Collections', sortable: true },
    { key: 'completedAppointmentCount', label: 'Completed Appts', sortable: true },
    { key: 'productionPerHour', label: 'Prod / Hour', sortable: true },
    { key: 'scheduledChairHours', label: 'Chair Hours', sortable: true },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Icon name="AlertTriangle" size={24} className="text-yellow-500 mx-auto mb-2" />
        <div className="text-sm font-semibold text-yellow-800 mb-1">Dentrix Mapping Required</div>
        <div className="text-xs text-yellow-700">{apiError}</div>
        <div className="text-xs text-muted-foreground mt-2">
          Source: /v2/reports/provider-performance
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
        <Icon name="Info" size={13} />
        <span>
          Source: Dentrix /v2/reports/provider-performance — trusted fields only (netProduction, collections, completedAppointmentCount, productionPerHour, scheduledChairHours). Missing fields show N/A.
          <span className="ml-2 text-amber-700 font-medium">
            "Unattributed / Office-Level" rows = production not linked to a provider in Dentrix/provider-performance response (provider_id null, name blank, or provider type unmapped).
          </span>
          <span className="ml-2">
            Duplicate provider names (e.g., same provider at multiple offices) are separate rows per office/location — not merged.
          </span>
        </span>
      </div>
      {/* Provider Summary Table */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-foreground">Provider Summary</h3>
          <div className="text-xs text-muted-foreground">Click a row to view provider detail</div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <div className="relative max-w-xs">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search provider..."
              value={search}
              onChange={(e) => setSearch(e?.target?.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-3">
          {filtered?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No providers found</div>
          ) : (
            filtered?.map((r, i) => (
              <div
                key={i}
                onClick={() => setSelectedProvider(selectedProvider?.providerName === r?.providerName ? null : r)}
                className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${selectedProvider?.providerName === r?.providerName ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-foreground">{r?.providerName}</div>
                    <div className="text-xs text-muted-foreground">{r?.providerType || '—'}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Net Prod</div><div className="font-bold">{displayCurrency(r?.netProduction)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Collections</div><div className="font-bold">{displayCurrency(r?.collections)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Completed Appts</div><div className="font-bold">{displayNum(r?.completedAppointmentCount)}</div></div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {COLS?.map((c) => (
                  <th
                    key={c?.key}
                    className={`px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap ${c?.sortable ? 'cursor-pointer hover:bg-muted' : ''}`}
                    onClick={() => c?.sortable && handleSort(c?.key)}
                  >
                    <div className="flex items-center gap-1">
                      {c?.label}
                      {c?.sortable && <SortIcon col={c?.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered?.length === 0 ? (
                <tr>
                  <td colSpan={COLS?.length} className="text-center py-12 text-muted-foreground">
                    No provider data available for selected period
                  </td>
                </tr>
              ) : (
                filtered?.map((r, i) => {
                  const isSelected = selectedProvider?.providerName === r?.providerName;
                  return (
                    <tr
                      key={i}
                      onClick={() => setSelectedProvider(isSelected ? null : r)}
                      className={`border-t border-border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/30'}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {isSelected
                            ? <Icon name="ChevronDown" size={14} className="text-primary" />
                            : <Icon name="ChevronRight" size={14} className="text-muted-foreground" />}
                          {r?.providerName}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r?.providerType || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{officeMap?.[r?._officeId] || resolveOfficeName(r?._officeId) || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{displayCurrency(r?.netProduction)}</td>
                      <td className="px-3 py-2">{displayCurrency(r?.collections)}</td>
                      <td className="px-3 py-2">{displayNum(r?.completedAppointmentCount)}</td>
                      <td className="px-3 py-2">{displayCurrency(r?.productionPerHour)}</td>
                      <td className="px-3 py-2">{r?.scheduledChairHours != null ? parseFloat(r?.scheduledChairHours)?.toFixed(1) : 'N/A'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Provider Detail Panel — Stage 2A: daily_entries detail removed */}
      {selectedProvider && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">{selectedProvider?.providerName}</h3>
              <div className="text-xs text-muted-foreground mt-0.5">
                {selectedProvider?.providerType || '—'}
              </div>
            </div>
            <button
              onClick={() => setSelectedProvider(null)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          {/* Summary metrics from provider-performance row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Net Production', value: displayCurrency(selectedProvider?.netProduction) },
              { label: 'Collections', value: displayCurrency(selectedProvider?.collections) },
              { label: 'Completed Appts', value: displayNum(selectedProvider?.completedAppointmentCount) },
              { label: 'Prod / Hour', value: displayCurrency(selectedProvider?.productionPerHour) },
              { label: 'Chair Hours', value: selectedProvider?.scheduledChairHours != null ? parseFloat(selectedProvider?.scheduledChairHours)?.toFixed(1) : 'N/A' },
            ]?.map((item) => (
              <div key={item?.label} className="bg-muted/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{item?.label}</div>
                <div className="text-base font-bold text-foreground">{item?.value}</div>
              </div>
            ))}
          </div>

          {/* Detail charts — Stage 2A: not available without daily_entries; Dentrix mapping required */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              'Production by Procedure Type',
              'Patient Visit Trend (Last 6 Months)',
              'Case Acceptance Rate Trend',
            ]?.map((title) => (
              <div key={title} className="bg-muted/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-foreground mb-2">{title}</div>
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Icon name="Database" size={20} className="text-muted-foreground mb-2" />
                  <div className="text-xs text-muted-foreground">Dentrix mapping required</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    daily_entries source removed (Stage 2A)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvidersTab;
