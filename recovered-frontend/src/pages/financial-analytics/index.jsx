import React, { useState, useEffect, useMemo } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import FilterPanel from './components/FilterPanel';
import ChartVisualization from './components/ChartVisualization';
import StatisticalSummary from './components/StatisticalSummary';
import HierarchicalFilter from './components/HierarchicalFilter';
import PivotTable from './components/PivotTable';
import BookmarkSystem from './components/BookmarkSystem';

import FinancialSectionBoundary from './components/FinancialSectionBoundary';
import RevenueBreakdownTab from './components/RevenueBreakdownTab';
import ProductionAdjustmentsTab from './components/ProductionAdjustmentsTab';
import CollectionsTab from './components/CollectionsTab';
import DentrixReconciliationTab from './components/DentrixReconciliationTab';
import ServiceCategoriesTab from './components/ServiceCategoriesTab';
import { useAuth } from '../../contexts/AuthContext';
import { getAccessibleOffices } from '../../services/dashboardService';
import { getFinancialGoalContext } from '../../services/goalsService';
import { format } from 'date-fns';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import Icon from '../../components/AppIcon';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useNavigate } from 'react-router-dom';
import { useOffice } from '../../contexts/OfficeContext';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import { ascendApi } from '../../services/ascendApi';
import { fetchFinancialReportForOffices } from '../../services/dentrixNormalizedService';
import { monthLabel } from '../../services/kpiService';
import { getLocationIdByOfficeId } from '../../constants/offices';
import { AccessDenied } from '../../hooks/useRbacGuard';

export const getFinancialTrendPeriods = (endDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') || !Number.isFinite(Date.parse(endDate))) return [];
  const anchor = new Date(`${endDate}T00:00:00Z`);
  if (anchor.toISOString().slice(0, 10) !== endDate) return [];
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(anchor);
    start.setUTCDate(1);
    start.setUTCMonth(anchor.getUTCMonth() - 11 + index);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const monthEnd = end.toISOString().slice(0, 10);
    return { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1,
      startDate: start.toISOString().slice(0, 10), endDate: monthEnd < endDate ? monthEnd : endDate };
  });
};

const FinancialAnalytics = () => {
  // ── Staged filter state (what the user is editing in the panel) ──────────
  const [selectedOffices, setSelectedOffices] = useState(['all']);
  const [selectedProviders, setSelectedProviders] = useState(['all']);
  const [selectedServices, setSelectedServices] = useState(['all']);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    end: format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd'),
  });
  const [analysisMode, setAnalysisMode] = useState('trend');

  // ── Applied (committed) filter state — only updated on Apply Filters ─────
  // All charts/tables/KPIs use this state, not the staged state above.
  const [appliedOffices, setAppliedOffices] = useState(['all']);
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    end: format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd'),
  });
  const [appliedAnalysisMode, setAppliedAnalysisMode] = useState('trend');

  // ── Service Categories filter options — fetched from /v2/financial/filter-options ──
  const [filterOptions, setFilterOptions] = useState(null);

  const [hierarchicalFilters, setHierarchicalFilters] = useState([]);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('charts');
  const [activeSectionTab, setActiveSectionTab] = useState('analytics');
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading, permissionsMap } = useRolePermissions();
  const { selectedOfficeId, canSwitchOffice } = useOffice();
  const [goalData, setGoalData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Separate version counter for PivotTable and StatisticalSummary — only bumped on Apply Filters
  const [pivotFetchVersion, setPivotFetchVersion] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [monthlyTrendData, setMonthlyTrendData] = useState([]);
  const [monthlyTrendLoading, setMonthlyTrendLoading] = useState(true);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // ── Financial Analytics section-tab permission map ──────────────────────────
  const FA_TAB_PERMISSION_MAP = {
    analytics:          'finance.finance.analytics.view',
    production:         'finance.finance.production.view',
    collections:        'finance.finance.collections.view',
    service_categories: 'finance.finance.service_categories.view',
    reconciliation:     'finance.finance.reconciliation.view',
  };

  const FA_SECTION_TABS = ['analytics', 'production', 'collections', 'service_categories'];

  // Compute allowed section tabs
  const allowedFaSectionTabs = React.useMemo(() => {
    if (isSuperAdmin) return FA_SECTION_TABS;
    return FA_SECTION_TABS?.filter(tab => hasPermission(FA_TAB_PERMISSION_MAP?.[tab]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  // Switch to first allowed section tab if current is restricted
  React.useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    if (allowedFaSectionTabs?.length > 0 && !allowedFaSectionTabs?.includes(activeSectionTab)) {
      setActiveSectionTab(allowedFaSectionTabs?.[0]);
    }
  }, [allowedFaSectionTabs, activeSectionTab, permLoading, isSuperAdmin]);

  // Resolve officeIds for normalized service tabs (exclude 'all' sentinel)
  // Uses APPLIED state so all tabs stay in sync
  const resolvedOfficeIds = appliedOffices?.filter(o => o !== 'all') || [];

  const datePreset = 'this_month';

  // Stable primitive props for PivotTable — derived from APPLIED state
  const pivotOfficeIdsKey = useMemo(
    () =>
      !appliedOffices || appliedOffices?.length === 0 || appliedOffices?.includes('all')
        ? 'all'
        : [...appliedOffices]?.sort()?.join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliedOffices?.join(',')]
  );
  const pivotStartDate = appliedDateRange?.start;
  const pivotEndDate = appliedDateRange?.end;

  // Listen for bulk import completion to trigger live refresh
  React.useEffect(() => {
    const handleDailyEntriesUpdated = () => {
      setRefreshKey(k => k + 1);
      setLastRefreshed(new Date());
    };
    window.addEventListener('daily-entries-updated', handleDailyEntriesUpdated);
    return () => window.removeEventListener('daily-entries-updated', handleDailyEntriesUpdated);
  }, []);

  // Listen for tab-switch requests from child components (e.g. RevenueBreakdownTab)
  React.useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e?.detail) setActiveSectionTab(e?.detail);
    };
    window.addEventListener('fa:switchTab', handleSwitchTab);
    return () => window.removeEventListener('fa:switchTab', handleSwitchTab);
  }, []);

  // Page-level guard: replace navigate redirect with AccessDenied panel
  // (handled below as inline render guard after permLoading check)

  // Sync office filter with user's assigned office for single-office users
  React.useEffect(() => {
    if (!canSwitchOffice && selectedOfficeId) {
      setSelectedOffices([selectedOfficeId]);
      setAppliedOffices([selectedOfficeId]);
    }
  }, [canSwitchOffice, selectedOfficeId]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Financial Analytics', path: '/financial-analytics' }
  ];

  // Goal context uses the selected offices and the explicitly labeled start month.
  React.useEffect(() => {
    let active = true;
    setGoalData(null);
    if (!userProfile || appliedAnalysisMode !== 'trend') return () => { active = false; };
    setGoalData({ loading: true });
    const loadGoalContext = async () => {
      try {
        const offices = await getAccessibleOffices(userProfile);
        if (!active) return;
        const data = await getFinancialGoalContext(offices, appliedOffices, appliedDateRange?.start?.substring(0, 7));
        if (active) setGoalData(data);
      } catch (err) {
        if (active) setGoalData({ error: 'Production goals are unavailable for the selected offices and month.' });
      }
    };
    loadGoalContext();
    return () => { active = false; };
  }, [userProfile, appliedOffices, appliedDateRange, appliedAnalysisMode]);


  // Fetch last 12 months trend data from middleware API — uses APPLIED office state
  React.useEffect(() => {
    const loadMonthlyTrend = async () => {
      setMonthlyTrendLoading(true);
      setMonthlyTrendData([]);
      try {
        const months = getFinancialTrendPeriods(appliedDateRange?.end);
        const locationId = appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
          ? getLocationIdByOfficeId(appliedOffices?.[0])
          : null;
        const results = await Promise.allSettled(
          months?.map(({ year, month, startDate, endDate }) => {
            return Promise.all([
              fetchFinancialReportForOffices('getProduction', startDate, endDate, appliedOffices)?.catch(() => null),
              fetchFinancialReportForOffices('getCollections', startDate, endDate, appliedOffices)?.catch(() => null),
              ascendApi?.getPatients(startDate, endDate, locationId)?.catch(() => null),
            ])?.then(([prod, coll, patients]) => ({
              month: monthLabel(year, month),
              startDate, endDate,
              productionAvailable: prod?.netProduction != null && Number.isFinite(Number(prod.netProduction)),
              // UCR / Gross Production — full billed fee before reductions
              ucrProduction: prod?.grossProduction ?? 0,
              // Net Production — after adjustments (primary display metric)
              revenue: prod?.netProduction ?? 0,
              // Production Adjustments — reductions (displayed as positive for chart)
              adjustments: Math.abs(prod?.adjustments ?? prod?.writeOffs ?? 0),
              collections: Math.abs(coll?.totalCollections ?? coll?.collections ?? 0),
              newPatients: patients?.newPatients ?? 0,
            }));
          })
        );
        const trendPoints = results?.filter((r) => r?.status === 'fulfilled')?.map((r) => r?.value);
        if (current) setMonthlyTrendData(trendPoints);
      } catch (err) {
        console.warn('[FinancialAnalytics] Monthly trend fetch error:', err);
      } finally {
        if (current) setMonthlyTrendLoading(false);
      }
    };
    let current = true;
    loadMonthlyTrend();
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, appliedOffices?.join(','), appliedDateRange?.end]);

  // Fetch filter options for Service Categories (serviceCategories + serviceCategoryMapping)
  // Re-fetches when applied date range or applied offices change
  React.useEffect(() => {
    const loadFilterOptions = async () => {
      if (!appliedDateRange?.start || !appliedDateRange?.end) return;
      try {
        const locationId =
          appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
            ? getLocationIdByOfficeId(appliedOffices?.[0])
            : null;
        const opts = await ascendApi?.getFinancialFilterOptions(
          appliedDateRange?.start,
          appliedDateRange?.end,
          locationId
        );
        setFilterOptions(opts ?? null);
      } catch (err) {
        console.warn('[FinancialAnalytics] filter-options fetch failed:', err?.message);
      }
    };
    loadFilterOptions();
  }, [appliedDateRange?.start, appliedDateRange?.end, appliedOffices?.join(',')]);

  // Real-time subscriptions — daily_entries disabled (quarantined sections)
  const { isPulsing, isConnected: rtConnected } = useRealtimeSubscription(
    [{ table: 'daily_entries', events: ['INSERT', 'UPDATE', 'DELETE'] }],
    () => {
      setRefreshKey(k => k + 1);
      setLastRefreshed(new Date());
    },
    false
  );

  const handleApplyFilters = () => {
    // Commit staged state → applied state
    setAppliedOffices([...selectedOffices]);
    setAppliedDateRange({ ...dateRange });
    setAppliedAnalysisMode(analysisMode);
    setRefreshKey(k => k + 1);
    setPivotFetchVersion(v => v + 1);
  };

  // Accepts explicit values to avoid async state race when sub-tabs call apply
  // after updating staged state in the same event handler.
  const handleApplyFiltersWithValues = ({ offices, start, end }) => {
    const newOffices = offices ?? selectedOffices;
    const newStart = start ?? dateRange?.start;
    const newEnd = end ?? dateRange?.end;
    // Sync staged state too so the filter panel stays consistent
    setSelectedOffices([...newOffices]);
    setDateRange({ start: newStart, end: newEnd });
    // Commit to applied state immediately (synchronous within this call)
    setAppliedOffices([...newOffices]);
    setAppliedDateRange({ start: newStart, end: newEnd });
    setAppliedAnalysisMode(analysisMode);
    setRefreshKey(k => k + 1);
    setPivotFetchVersion(v => v + 1);
  };

  const handleResetFilters = () => {
    const defaultOffices = ['all'];
    const defaultDateRange = {
      start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      end: format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd'),
    };
    setSelectedOffices(defaultOffices);
    setSelectedProviders(['all']);
    setSelectedServices(['all']);
    setSelectedServiceCategory('all');
    setDateRange(defaultDateRange);
    setAnalysisMode('trend');
    setHierarchicalFilters([]);
    // Also commit reset to applied state
    setAppliedOffices(defaultOffices);
    setAppliedDateRange(defaultDateRange);
    setAppliedAnalysisMode('trend');
    setPivotFetchVersion(v => v + 1);
  };

  const handleHierarchicalFilterChange = (filters) => {
    setHierarchicalFilters(Array.isArray(filters) ? filters : []);
  };

  // Sync office from drill-down filter selection to main Advanced Filters
  const handleOfficeSyncFromDrillDown = (officeId) => {
    if (!officeId) return;
    setSelectedOffices([officeId]);
    setAppliedOffices([officeId]);
    setRefreshKey(k => k + 1);
    setPivotFetchVersion(v => v + 1);
  };

  const handleLoadBookmark = (bookmark) => {
    if (bookmark?.filters?.mode) {
      setAnalysisMode(bookmark?.filters?.mode);
    }
  };

  if (permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading Financial Analytics…</p>
        </div>
      </div>
    );
  }

  // Page-level guard: show AccessDenied panel instead of redirect
  if (!isSuperAdmin && !hasPermission('analytics:financial_view') && !hasPermission('finance.finance.view')) {
    return <AccessDenied message="Financial Analytics is restricted. Contact your administrator to request access." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Financial Analytics Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Interactive data exploration tools for deep-dive analysis of revenue patterns, expense optimization, and forecasting insights
            </p>
          </div>

          {/* Data-source banner — always visible */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 mb-5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="font-semibold text-emerald-800">Live Dentrix data only.</span>
              <span className="text-emerald-700">Demo/sample data disabled.</span>
            </div>
            <span className="text-emerald-600 hidden sm:inline mx-1">·</span>
            <span className="text-emerald-700">Valid offices: Eatontown · Brick · Barnegat · Staten Island</span>
            <span className="text-emerald-600 hidden sm:inline mx-1">·</span>
            <span className="text-emerald-600 italic">Financial Analytics is calculated from Dentrix Ascend raw transaction data through FastAPI/SQLite.</span>
          </div>

          {/* Top-level section navigation */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit mb-6 overflow-x-auto">
            {(isSuperAdmin || hasPermission(FA_TAB_PERMISSION_MAP?.analytics)) && (
            <button
              onClick={() => setActiveSectionTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSectionTab === 'analytics' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="TrendingUp" size={14} />
              Analytics
            </button>
            )}
            {(isSuperAdmin || hasPermission(FA_TAB_PERMISSION_MAP?.production)) && (
            <button
              onClick={() => setActiveSectionTab('production')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSectionTab === 'production' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="BarChart2" size={14} />
              Production &amp; Adjustments
            </button>
            )}
            {(isSuperAdmin || hasPermission(FA_TAB_PERMISSION_MAP?.collections)) && (
            <button
              onClick={() => setActiveSectionTab('collections')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSectionTab === 'collections' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="DollarSign" size={14} />
              Collections
            </button>
            )}
            {(isSuperAdmin || hasPermission(FA_TAB_PERMISSION_MAP?.service_categories)) && (
            <button
              onClick={() => setActiveSectionTab('service_categories')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSectionTab === 'service_categories' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Tag" size={14} />
              Service Categories
            </button>
            )}
            {(isSuperAdmin || hasPermission('finance.expenses.view')) && (
            <button
              onClick={() => navigate('/financial-analytics/expense-report')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <Icon name="Receipt" size={14} />
              Expense Report
            </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveSectionTab('reconciliation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSectionTab === 'reconciliation' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name="FlaskConical" size={14} />
                Dentrix Reconciliation
              </button>
            )}
            {allowedFaSectionTabs?.length === 0 && !permLoading && (
              <span className="px-4 py-2 text-sm text-muted-foreground italic">No tabs enabled for your role</span>
            )}
          </div>

          {/* Service Categories subtab */}
          {activeSectionTab === 'service_categories' && (
            <FinancialSectionBoundary section="Service Categories">
              <ServiceCategoriesTab
                startDate={appliedDateRange?.start}
                endDate={appliedDateRange?.end}
                appliedOffices={appliedOffices}
                refreshKey={refreshKey}
                selectedProviders={selectedProviders}
                externalServiceCategory={selectedServiceCategory}
                onServiceCategoryChange={setSelectedServiceCategory}
                filterOptions={filterOptions}
              />
            </FinancialSectionBoundary>
          )}

          {/* Production & Adjustments subtab */}
          {activeSectionTab === 'production' && (
            <FinancialSectionBoundary section="Production & Adjustments">
              <ProductionAdjustmentsTab
                datePreset={datePreset}
                startDate={appliedDateRange?.start}
                endDate={appliedDateRange?.end}
                officeIds={resolvedOfficeIds}
                refreshKey={refreshKey}
                selectedOffices={selectedOffices}
                setSelectedOffices={setSelectedOffices}
                stagedDateRange={dateRange}
                setStagedDateRange={setDateRange}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                appliedOffices={appliedOffices}
                appliedDateRange={appliedDateRange}
                onApplyFiltersWithValues={handleApplyFiltersWithValues}
              />
            </FinancialSectionBoundary>
          )}

          {/* Collections subtab */}
          {activeSectionTab === 'collections' && (
            <FinancialSectionBoundary section="Collections">
              <CollectionsTab
                datePreset={datePreset}
                startDate={appliedDateRange?.start}
                endDate={appliedDateRange?.end}
                officeIds={resolvedOfficeIds}
                refreshKey={refreshKey}
                selectedOffices={selectedOffices}
                setSelectedOffices={setSelectedOffices}
                stagedDateRange={dateRange}
                setStagedDateRange={setDateRange}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                appliedOffices={appliedOffices}
                appliedDateRange={appliedDateRange}
                onApplyFiltersWithValues={handleApplyFiltersWithValues}
              />
            </FinancialSectionBoundary>
          )}

          {/* Dentrix Reconciliation subtab */}
          {activeSectionTab === 'reconciliation' && (
            <FinancialSectionBoundary section="Dentrix Reconciliation">
              <DentrixReconciliationTab isSuperAdmin={isSuperAdmin} />
            </FinancialSectionBoundary>
          )}

          {/* Analytics tab content */}
          {activeSectionTab === 'analytics' && (
            <>
              <FinancialSectionBoundary section="Year Comparison Panel">
                <YearComparisonPanel title="Year-over-Year Financial Analytics" />
              </FinancialSectionBoundary>

              <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                {/* Left sidebar — filters */}
                <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4 md:space-y-6">
                  <FinancialSectionBoundary section="Filter Panel">
                    <FilterPanel
                      selectedOffices={selectedOffices}
                      setSelectedOffices={setSelectedOffices}
                      selectedProviders={selectedProviders}
                      setSelectedProviders={setSelectedProviders}
                      selectedServices={selectedServices}
                      setSelectedServices={setSelectedServices}
                      dateRange={dateRange}
                      setDateRange={setDateRange}
                      analysisMode={analysisMode}
                      setAnalysisMode={setAnalysisMode}
                      onApplyFilters={handleApplyFilters}
                      onResetFilters={handleResetFilters}
                      appliedOffices={appliedOffices}
                      appliedDateRange={appliedDateRange}
                      hierarchicalFilters={hierarchicalFilters}
                      serviceCategories={filterOptions?.serviceCategories ?? []}
                      serviceCategoryMapping={filterOptions?.serviceCategoryMapping ?? null}
                      selectedServiceCategory={selectedServiceCategory}
                      setSelectedServiceCategory={setSelectedServiceCategory}
                    />
                  </FinancialSectionBoundary>

                  <FinancialSectionBoundary section="Drill-Down Filters">
                    <HierarchicalFilter
                      onFilterChange={handleHierarchicalFilterChange}
                      appliedOffices={appliedOffices}
                      appliedDateRange={appliedDateRange}
                      onOfficeSyncFromDrillDown={handleOfficeSyncFromDrillDown}
                    />
                  </FinancialSectionBoundary>

                  <FinancialSectionBoundary section="Saved Analyses">
                    <BookmarkSystem onLoadBookmark={handleLoadBookmark} />
                  </FinancialSectionBoundary>
                </div>

                {/* Main content area */}
                <div className="flex-1 min-w-0 space-y-4 md:space-y-6">
                  {/* Analytics Tab Switcher */}
                  <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit">
                    {[
                      { id: 'charts', label: 'Analytics Charts', icon: 'TrendingUp' },
                      { id: 'revenue_breakdown', label: 'Revenue Breakdown', icon: 'BarChart2' },
                    ]?.map(tab => (
                      <button
                        key={tab?.id}
                        onClick={() => setActiveAnalyticsTab(tab?.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-smooth ${
                          activeAnalyticsTab === tab?.id
                            ? 'bg-card text-foreground shadow-elevation-1'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon name={tab?.icon} size={15} />
                        {tab?.label}
                      </button>
                    ))}
                  </div>

                  {activeAnalyticsTab === 'charts' && (
                    <>
                      <FinancialSectionBoundary section="Analytics Charts">
                        <ChartVisualization
                          data={{ trendData: monthlyTrendData }}
                          loading={monthlyTrendLoading}
                          mode={appliedAnalysisMode}
                          goalData={appliedAnalysisMode === 'trend' ? goalData : null}
                          appliedDateRange={appliedDateRange}
                          appliedOffices={appliedOffices}
                        />
                      </FinancialSectionBoundary>
                      <FinancialSectionBoundary section="Revenue Pivot Table">
                        <PivotTable
                          officeIdsKey={pivotOfficeIdsKey}
                          startDate={pivotStartDate}
                          endDate={pivotEndDate}
                          fetchVersion={pivotFetchVersion}
                        />
                      </FinancialSectionBoundary>
                    </>
                  )}

                  {activeAnalyticsTab === 'revenue_breakdown' && (
                    <FinancialSectionBoundary section="Revenue Breakdown Chart">
                      <RevenueBreakdownTab
                        key={refreshKey}
                        dateRange={appliedDateRange}
                        selectedOffices={appliedOffices}
                        refreshKey={refreshKey}
                      />
                    </FinancialSectionBoundary>
                  )}
                </div>

                {/* Right sidebar — statistical summary */}
                <div className="w-full lg:w-64 xl:w-72 flex-shrink-0">
                  <FinancialSectionBoundary section="Statistical Summary">
                    <StatisticalSummary
                      selectedOffices={appliedOffices}
                      dateRange={appliedDateRange}
                      fetchVersion={pivotFetchVersion}
                    />
                  </FinancialSectionBoundary>
                </div>
              </div>

              {/* Live data status bar */}
              <div className="mt-6 md:mt-8 bg-card border border-border rounded-lg p-4 md:p-6 shadow-elevation-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2 h-2 rounded-full ${rtConnected ? 'bg-success animate-pulse' : 'bg-warning animate-pulse'}`}></div>
                  <span className="text-sm text-muted-foreground">
                    {rtConnected ? 'Live data — updates in real-time' : 'Data updates every 30 minutes'} • Last updated:{' '}
                    {lastRefreshed instanceof Date && !isNaN(lastRefreshed)
                      ? lastRefreshed?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300 ${isPulsing ? 'animate-pulse-flash' : ''}`}>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">—</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Records</p>
                      <p className="text-sm font-semibold text-foreground">Analyzed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-success bg-opacity-10 flex items-center justify-center">
                      <span className="text-lg font-bold text-success">—</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Active Offices</p>
                      <p className="text-sm font-semibold text-foreground">Monitored</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-accent bg-opacity-10 flex items-center justify-center">
                      <span className="text-lg font-bold text-accent">—</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Time Periods</p>
                      <p className="text-sm font-semibold text-foreground">Compared</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinancialAnalytics;
