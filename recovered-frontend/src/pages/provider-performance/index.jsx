import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useOffice } from '../../contexts/OfficeContext';
import PerformanceFilters from './components/PerformanceFilters';
import ProviderMetricsTable from './components/ProviderMetricsTable';
import ServiceCategoryTabs from './components/ServiceCategoryTabs';
import { supabase } from '../../lib/supabase';
import { format, subDays } from 'date-fns';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useNavigate } from 'react-router-dom';
import { ascendApi } from '../../services/ascendApi';
import { getLocationIdByOfficeId, getOfficeNameById } from '../../constants/offices';
import { AccessDenied } from '../../hooks/useRbacGuard';

// V315: null-safe currency formatter
// null/undefined/NaN → '—'   |   real backend 0 → '$0'
const fmt = (v) => {
  if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);
};
const fmtPct = (v) => v != null ? `${parseFloat(v)?.toFixed(1)}%` : '—';

const UNATTRIBUTED_ID = 'UNATTRIBUTED_OFFICE_LEVEL';

// Merge disjoint office activity, keeping one row per provider (including unattributed).
const mergeProviderOfficeResults = (results) => {
  if (!results.length || results.some(result => !Array.isArray(result?.providers))) {
    throw new Error('Provider data is unavailable for a selected office.');
  }
  const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const sum = values => values.some(value => number(value) === null) ? null : values.reduce((total, value) => total + number(value), 0);
  const providers = new Map();
  for (const result of results) {
    for (const provider of result.providers) {
      const id = provider.providerId ?? provider.provider_id ?? provider.id;
      if (!id) throw new Error('A provider identifier is missing from the selected office data.');
      const existing = providers.get(id);
      if (existing) {
        existing.netProduction = sum([existing.netProduction, provider.netProduction]);
        existing.collections = sum([existing.collections, provider.collections]);
      } else {
        providers.set(id, { ...provider, netProduction: number(provider.netProduction), collections: number(provider.collections) });
      }
    }
  }
  for (const provider of providers.values()) {
    provider.collectionRate = provider.netProduction > 0 && provider.collections !== null
      ? Math.round(provider.collections / provider.netProduction * 1000) / 10 : null;
  }
  const summary = {};
  for (const field of ['grossProduction', 'netProduction', 'totalCollections', 'providerAttributedCollections', 'unattributedCollections', 'providerAttributedNetProduction', 'unattributedNetProduction']) {
    summary[field] = sum(results.map(result => result[field] ?? result.summary?.[field]));
  }
  const reconciled = results.map(result => result.reconcilesToOfficeTotals ?? result.summary?.reconcilesToOfficeTotals);
  summary.reconcilesToOfficeTotals = reconciled.every(value => value === true) ? true : reconciled.some(value => value === false) ? false : null;
  return { providers: [...providers.values()], summary };
};

const getProviderSummaryTotals = (summary, rows, types, loading, error) => {
  const unavailable = { production: null, collections: null };
  if (loading || error || !Array.isArray(rows)) return unavailable;
  const sum = field => rows.some(row => row?.[field] == null || !Number.isFinite(row[field]))
    ? null : rows.reduce((total, row) => total + row[field], 0);
  if (!types?.includes('all')) return { production: sum('production'), collections: sum('collections') };
  return { production: summary?.netProduction ?? null, collections: summary?.totalCollections ?? sum('collections') };
};

const ProviderPerformance = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading, permissionsMap } = useRolePermissions();
  const { selectedOfficeId, canSwitchOffice } = useOffice();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [trendDays, setTrendDays] = useState(30);
  const [selectedOfficeName, setSelectedOfficeName] = useState(null);

  // Filters
  const [dateRange, setDateRange] = useState({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [officeFilter, setOfficeFilter] = useState(['all']);
  const [providerTypeFilter, setProviderTypeFilter] = useState(['all']);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');

  const isOfficeManager = userProfile?.role === 'office_manager';
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  // Page-level guard: replace navigate redirect with AccessDenied panel
  if (!permLoading && userProfile && permissionsMap && Object.keys(permissionsMap)?.length > 0 && !hasPermission('performance:provider_view') && !hasPermission('performance.provider_performance.view')) {
    return <AccessDenied message="Provider Performance is restricted. Contact your administrator to request access." />;
  }

  // Lock office filter for single-office users
  useEffect(() => {
    if (!canSwitchOffice && selectedOfficeId) {
      setOfficeFilter([selectedOfficeId]);
    }
  }, [canSwitchOffice, selectedOfficeId]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Provider Performance' },
  ];

  // Load reference data
  useEffect(() => {
    const loadRef = async () => {
      const [officesResult, providersResult, catsResult] = await Promise.all([
        supabase?.from('offices')?.select('id, name')?.eq('is_active', true)?.order('name'),
        supabase?.from('providers')?.select('id, name, provider_type, office_id')?.eq('is_active', true)?.order('name'),
        supabase?.from('service_categories')?.select('id, name')?.eq('is_active', true)?.order('name'),
      ]);
      setOffices(officesResult?.data || []);
      setProviders(providersResult?.data || []);
      setServiceCategories(catsResult?.data || []);
    };
    loadRef();
  }, []);

  const loadPerformanceData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Resolve every selected office; an unresolved selection must never become All Offices.
      const officeIds = isOfficeManager && userProfile?.office_id
        ? [userProfile?.office_id]
        : !officeFilter?.includes('all') && officeFilter?.length > 0
          ? officeFilter
          : [];

      // P0-6 FIX: resolve Dentrix locationId from Supabase office UUID
      // NEVER pass raw Supabase UUID as locationId to Ascend API
      const dentrixLocationIds = [...new Set(officeIds.map(id => getLocationIdByOfficeId(id)))];
      if (dentrixLocationIds.some(id => !id)) throw new Error('A selected office could not be resolved.');

      // Resolve the selected office display name for the Service Office column
      const resolvedOfficeName = officeIds.map(id => getOfficeNameById(id)).filter(Boolean).join(', ') || null;

      // Fetch provider performance from Ascend API
      const ascendData = await (dentrixLocationIds.length > 1
        ? Promise.all(dentrixLocationIds.map(locationId => ascendApi.getProviderPerformance(dateRange?.start, dateRange?.end, locationId))).then(mergeProviderOfficeResults)
        : ascendApi.getProviderPerformance(dateRange?.start, dateRange?.end, dentrixLocationIds[0] || null)
      ).catch(() => null);

      // Capture top-level summary fields from the API response if present
      const summaryFields = ascendData && !Array.isArray(ascendData) ? {
        grossProduction: ascendData?.grossProduction ?? ascendData?.summary?.grossProduction ?? null,
        netProduction: ascendData?.netProduction ?? ascendData?.summary?.netProduction ?? null,
        totalCollections: ascendData?.totalCollections ?? ascendData?.summary?.totalCollections ?? null,
        providerAttributedCollections: ascendData?.providerAttributedCollections ?? ascendData?.summary?.providerAttributedCollections ?? null,
        unattributedCollections: ascendData?.unattributedCollections ?? ascendData?.summary?.unattributedCollections ?? null,
        providerAttributedNetProduction: ascendData?.providerAttributedNetProduction ?? ascendData?.summary?.providerAttributedNetProduction ?? null,
        unattributedNetProduction: ascendData?.unattributedNetProduction ?? ascendData?.summary?.unattributedNetProduction ?? null,
        reconcilesToOfficeTotals: ascendData?.reconcilesToOfficeTotals ?? ascendData?.summary?.reconcilesToOfficeTotals ?? null,
      } : null;
      setApiSummary(summaryFields);

      const providerList = Array.isArray(ascendData)
        ? ascendData
        : ascendData?.providers || ascendData?.data || [];

      if (providerList?.length > 0) {
        // Apply provider type filter — always keep UNATTRIBUTED row visible in "All" view
        // Only exclude unattributed when a specific non-unattributed type filter is active
        const filtered = providerTypeFilter?.includes('all')
          ? providerList
          : providerList?.filter((p) => {
              const type = (p?.providerType ?? p?.provider_type ?? p?.type ?? '')?.toLowerCase();
              const id = p?.providerId ?? p?.provider_id ?? p?.id ?? '';
              // Always include unattributed row unless filter explicitly targets doctor/hygienist only
              if (id === UNATTRIBUTED_ID || type === 'unattributed') {
                return providerTypeFilter?.includes('unattributed');
              }
              return providerTypeFilter?.some((f) => type?.includes(f?.toLowerCase()));
            });

        const result = filtered?.map((p) => {
          const rawType = (p?.providerType ?? p?.provider_type ?? p?.type ?? '')?.toLowerCase();
          const rawId = p?.providerId ?? p?.provider_id ?? p?.id ?? p?.name;
          const isUnattributed = rawId === UNATTRIBUTED_ID || rawType === 'unattributed';
          // homeOffice: the provider's default/home office from the API response
          // This is stored separately and shown only in a tooltip — NOT in the Service Office column
          const homeOffice = p?.officeName ?? p?.office_name ?? p?.office ?? null;
          return {
            id: rawId,
            name: isUnattributed
              ? 'Unattributed / Office-Level' : (p?.providerName ?? p?.provider_name ?? p?.name ?? 'Unknown'),
            type: isUnattributed ? 'unattributed' : rawType,
            isUnattributed,
            // homeOffice is the provider's default office — used only for tooltip display
            homeOffice: isUnattributed ? null : homeOffice,
            offices: p?.offices ?? [],
            production: (() => { const rawNet = p?.netProduction ?? p?.net_production ?? null; return (rawNet !== null && rawNet !== undefined && rawNet !== '') ? parseFloat(rawNet) : null; })(),
            collections: (() => { const raw = p?.collections ?? p?.totalCollections ?? null; return raw == null || raw === '' ? null : parseFloat(raw); })(),
            newPatients: parseInt(p?.newPatients ?? p?.new_patients ?? 0),
            totalPatients: parseInt(p?.totalPatients ?? p?.total_patients ?? p?.patientVisits ?? 0),
            categories: { general: { name: 'General', production: (() => { const rawNet = p?.netProduction ?? p?.net_production ?? null; return (rawNet !== null && rawNet !== undefined && rawNet !== '') ? parseFloat(rawNet) : null; })(), collections: parseFloat(p?.collections ?? 0) } },
            trendData: [],
            entries: p?.entries ?? [],
            officeBreakdown: p?.officeBreakdown ?? [],
            caseAcceptanceRate: p?.caseAcceptanceRate ?? p?.case_acceptance_rate ?? null,
            collectionRate: p?.collectionRate ?? p?.collection_rate ?? null,
          };
        });
        setPerformanceData(result);
        // Store resolvedOfficeName in state so it can be passed to the table
        setSelectedOfficeName(resolvedOfficeName);
      } else {
        // P0-6 FIX: Ascend returned empty — show verified empty state
        // DO NOT fall back to Supabase daily_entries for live provider metrics
        console.info('[ProviderPerformance] Ascend API returned no provider data for the selected period/office. Showing empty state.');
        setPerformanceData([]);
        setSelectedOfficeName(resolvedOfficeName);
        if (ascendData === null) {
          setError('Dentrix Ascend provider data is currently unavailable. Please check API connectivity.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to load performance data');
      setPerformanceData([]);
      setApiSummary(null);
      setSelectedOfficeName(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeFilter?.join(','), providerTypeFilter?.join(','), serviceCategoryFilter, trendDays, isOfficeManager, userProfile?.office_id]);

  useEffect(() => { loadPerformanceData(); }, [loadPerformanceData]);

  // Listen for bulk import completion to reload provider scorecards
  useEffect(() => {
    const handleDailyEntriesUpdated = () => {
      loadPerformanceData();
    };
    window.addEventListener('daily-entries-updated', handleDailyEntriesUpdated);
    return () => window.removeEventListener('daily-entries-updated', handleDailyEntriesUpdated);
  }, [loadPerformanceData]);

  // Specific provider types use their displayed rows; All retains the office API totals.
  const { production: totalProduction, collections: totalCollections } = getProviderSummaryTotals(
    apiSummary, performanceData, providerTypeFilter, loading, error
  );

  // Avg collection rate only from attributed (non-unattributed) providers
  const attributedProviders = performanceData?.filter(p => !p?.isUnattributed);
  const avgCollectionRate = attributedProviders?.length > 0
    ? (attributedProviders?.reduce((s, p) => s + (parseFloat(p?.collectionRate) || 0), 0) / attributedProviders?.length)?.toFixed(1)
    : null;

  // V315 FIX #2: Summary Collection % — only compute when true netProduction is available
  // Do NOT use grossProduction as denominator
  const summaryCollectionPct = (totalProduction != null && totalProduction > 0 && totalCollections != null)
    ? ((totalCollections / totalProduction) * 100)?.toFixed(1)
    : null;

  // Filter by active category tab — always keep unattributed row visible
  const filteredData = activeCategory === 'all'
    ? performanceData
    : performanceData?.filter(p => p?.isUnattributed || p?.categories?.[activeCategory]);

  const hasReconciliationSummary = apiSummary && (
    apiSummary?.providerAttributedCollections != null ||
    apiSummary?.unattributedCollections != null ||
    apiSummary?.providerAttributedNetProduction != null ||
    apiSummary?.unattributedNetProduction != null ||
    apiSummary?.reconcilesToOfficeTotals != null
  );

  // V317: track collapsed state for the attribution note
  const [attributionNoteCollapsed, setAttributionNoteCollapsed] = React.useState(false);

  // V317: only show the note when at least one unattributed row has non-zero production or collections
  const hasNonZeroUnattributed = performanceData?.some(
    p => p?.isUnattributed && (
      (p?.production != null && p?.production !== 0) ||
      (p?.collections != null && p?.collections !== 0)
    )
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Provider Performance</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Production, collections, and case acceptance metrics by provider
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                {[30, 60, 90]?.map(d => (
                  <button
                    key={d}
                    onClick={() => setTrendDays(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      trendDays === d ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary KPI Cards — match the selected provider types */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Net Production</p>
              <p className="text-xl font-bold text-primary">{fmt(totalProduction)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{performanceData?.length} providers</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Total Collections</p>
              <p className="text-xl font-bold text-blue-600">{fmt(totalCollections)}</p>
              {/* V315 FIX #2: only show collection % when true netProduction is the denominator */}
              <p className="text-xs text-muted-foreground mt-0.5">
                {summaryCollectionPct != null ? `${summaryCollectionPct}% collection rate` : '— collection rate (net production unavailable)'}
              </p>
            </div>
            {/* V315 FIX #4: Renamed from "Avg Case Acceptance" → "Avg Collection Rate" */}
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Avg Collection Rate</p>
              <p className="text-xl font-bold text-success">{avgCollectionRate != null ? `${avgCollectionRate}%` : '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Attributed providers only</p>
            </div>
          </div>

          {/* Reconciliation Summary — shown when API returns attribution breakdown fields */}
          {hasReconciliationSummary && (
            <div className="bg-card border border-border rounded-lg px-4 py-3 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="BarChart2" size={14} color="var(--color-muted-foreground)" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attribution Reconciliation{!providerTypeFilter?.includes('all') ? ' · All provider types' : ''}</p>
                {apiSummary?.reconcilesToOfficeTotals != null && (
                  <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    apiSummary?.reconcilesToOfficeTotals ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    <Icon name={apiSummary?.reconcilesToOfficeTotals ? 'CheckCircle' : 'AlertTriangle'} size={11} />
                    {apiSummary?.reconcilesToOfficeTotals ? 'Reconciles to Office Totals' : 'Reconciliation Pending'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {apiSummary?.providerAttributedNetProduction != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Provider Net Production</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(apiSummary?.providerAttributedNetProduction)}</p>
                  </div>
                )}
                {apiSummary?.unattributedNetProduction != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Unattributed Net Production</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(apiSummary?.unattributedNetProduction)}</p>
                  </div>
                )}
                {apiSummary?.providerAttributedCollections != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Provider Collections</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(apiSummary?.providerAttributedCollections)}</p>
                  </div>
                )}
                {apiSummary?.unattributedCollections != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Unattributed Collections</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(apiSummary?.unattributedCollections)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Unattributed / Office-Level note — V317: blue/gray info style, collapsible, only when non-zero */}
          {hasNonZeroUnattributed && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/10 dark:border-blue-800/30">
              <button
                type="button"
                onClick={() => setAttributionNoteCollapsed(c => !c)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                aria-expanded={!attributionNoteCollapsed}
              >
                <Icon name="Info" size={14} color="#3b82f6" className="flex-shrink-0" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex-1">
                  Attribution note
                </span>
                <Icon
                  name={attributionNoteCollapsed ? 'ChevronDown' : 'ChevronUp'}
                  size={13}
                  color="#3b82f6"
                  className="flex-shrink-0"
                />
              </button>
              {!attributionNoteCollapsed && (
                <p className="px-3 pb-2.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  <span className="font-semibold">Unattributed / Office-Level</span> is valid Dentrix activity that cannot be tied to a specific provider. It remains included so provider totals reconcile to office totals.
                </p>
              )}
            </div>
          )}

          {/* Filters */}
          <PerformanceFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            officeFilter={officeFilter}
            onOfficeChange={setOfficeFilter}
            providerTypeFilter={providerTypeFilter}
            onProviderTypeChange={setProviderTypeFilter}
            serviceCategoryFilter={serviceCategoryFilter}
            onServiceCategoryChange={setServiceCategoryFilter}
            offices={offices}
            serviceCategories={serviceCategories}
            isOfficeManager={isOfficeManager}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Service Category Tabs */}
          <ServiceCategoryTabs
            categories={serviceCategories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Provider Metrics Table */}
          <ProviderMetricsTable
            data={filteredData}
            loading={loading}
            trendDays={trendDays}
            activeCategory={activeCategory}
            selectedOfficeName={selectedOfficeName}
          />
        </div>
      </main>

      {/* V315: Source note banner */}
      <div className="fixed inset-x-4 bottom-4 z-50">
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/10 dark:border-blue-800/30">
          <Icon name="ShieldCheck" size={15} color="#2563eb" className="flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <span className="font-semibold">Source:</span> Dentrix Ascend API · /v2/reports/provider-performance
            {' · '}Net Production uses Dentrix netProduction only (no gross/UCR fallback)
            {' · '}<span className="font-semibold">Case Acceptance source not wired</span> — shown as N/A until trusted Dentrix TxCase source is confirmed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProviderPerformance;
