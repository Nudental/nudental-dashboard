import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  fetchKpiOffices,
  fetchKpiSummary,
  fetchSparklineData,
  fetchGoalVsActual,
  fetchTrendDataPerOffice,
  buildKpiDateRange,
  fetchHygieneKpis,
  fetchDoctorKpis,
  fetchProvidersHeatmap,
  buildDateRangeStrings,
  fetchAppointmentsSummary,
  fetchHygieneRetentionMetrics,
  fetchHygieneProcedureMetrics,
  fetchSpecialtyKpis,
  fetchServiceCategoryFilterOptions,
  fetchSpecialtyProviderKpis,
} from '../../services/kpiService';
import { supabase } from '../../lib/supabase';
import { ascendApi } from '../../services/ascendApi';
import KpiCards from './components/KpiCards';
import GoalVsActualTable from './components/GoalVsActualTable';
import SparklineSection from './components/SparklineSection';
import GlobalFilterBar from '../../components/GlobalFilterBar';
import HygieneSection from './components/HygieneSection';
import DoctorSection from './components/DoctorSection';
import ProvidersTab from './components/ProvidersTab';
import SpecialtySection from './components/SpecialtySection';
import SpecialtyProvidersTab from './components/SpecialtyProvidersTab';
import ScrollableTabBar from '../../components/ui/ScrollableTabBar';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import ProductionCollectionsPanel from '../../components/ProductionCollectionsPanel';
import { getLocationIdByOfficeId } from '../../constants/offices';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

const ALLOWED_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'];

const TAB_PERMISSION_MAP = {
  main:               'performance.kpis.main.view',
  specialty:          'performance.kpis.specialty.view',
  providers:          'performance.kpis.providers.view',
  specialty_providers:'performance.kpis.specialty_providers.view',
};

const KPI_TABS = [
  { id: 'main', label: 'Main' },
  { id: 'specialty', label: 'Specialty' },
  { id: 'providers', label: 'Providers' },
  { id: 'specialty_providers', label: 'Specialty Providers' },
];

const KpisDashboard = () => {
  const { userProfile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Compute allowed KPI tabs
  const allowedKpiTabs = React.useMemo(() => {
    if (isSuperAdmin) return KPI_TABS;
    return KPI_TABS?.filter(tab => hasPermission(TAB_PERMISSION_MAP?.[tab?.id]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  const [activeKpiTab, setActiveKpiTab] = useState('main');
  const [period, setPeriod] = useState('last_month');
  const [offices, setOffices] = useState([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
  const officeDropdownRef = useRef(null);

  // Global filter bar state
  const [globalFilters, setGlobalFilters] = useState({
    datePreset: 'last_month',
    selectedOfficeIds: [],
    lineOfBusiness: [],
    viewBy: 'location',
    customStartDate: null,
    customEndDate: null,
  });

  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState({ production: 0, collections: 0, newPatients: 0 });
  const [sparklineData, setSparklineData] = useState([]);
  const [goalVsActualRows, setGoalVsActualRows] = useState([]);
  const [trendData, setTrendData] = useState({ chartData: [], officeNames: [] });

  // Hygiene & Doctor KPI state
  const [hygieneData, setHygieneData] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [hygieneLoading, setHygieneLoading] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);

  // Hygiene retention metrics state (from /v2/hygiene/retention-metrics)
  const [hygieneRetentionMetrics, setHygieneRetentionMetrics] = useState(null);

  // Hygiene procedure metrics state (from /v2/hygiene/procedure-metrics)
  const [hygieneProcedureMetrics, setHygieneProcedureMetrics] = useState(null);

  // Providers heatmap state
  const [providersData, setProvidersData] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  // Patients summary from middleware API (for Active Patients / New Patients)
  const [patientsSummary, setPatientsSummary] = useState(null);
  const [productionSummary, setProductionSummary] = useState(null);
  const [apptSummary, setApptSummary] = useState(null);

  // Specialty tab state
  const [specialtyData, setSpecialtyData] = useState(null);
  const [specialtyFilterOptions, setSpecialtyFilterOptions] = useState(null);
  const [specialtyLoading, setSpecialtyLoading] = useState(false);

  // Specialty Providers tab state
  const [specialtyProvidersData, setSpecialtyProvidersData] = useState(null);
  const [specialtyProvidersLoading, setSpecialtyProvidersLoading] = useState(false);
  const [specialtyProviderTypeFilter, setSpecialtyProviderTypeFilter] = useState('all');
  const [specialtyGroupFilter, setSpecialtyGroupFilter] = useState('all');

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [officesLoading, setOfficesLoading] = useState(true);

  // V729B: API error/retry banner state
  const [coreApiFailedEndpoints, setCoreApiFailedEndpoints] = useState([]);
  const [showApiErrorBanner, setShowApiErrorBanner] = useState(false);
  const [goalSessionWarning, setGoalSessionWarning] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'KPIs' },
  ];

  // Page-level guard: replace navigate redirect with AccessDenied panel
  if (!authLoading && !profileLoading && !permLoading && userProfile && !isSuperAdmin && !ALLOWED_ROLES?.includes(userProfile?.role) && !hasPermission('performance.kpis.view')) {
    return <AccessDenied message="KPIs Dashboard is restricted. Contact your administrator to request access." />;
  }

  // Switch to first allowed tab if current is restricted
  useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    if (allowedKpiTabs?.length > 0 && !allowedKpiTabs?.find(t => t?.id === activeKpiTab)) {
      setActiveKpiTab(allowedKpiTabs?.[0]?.id);
    }
  }, [allowedKpiTabs, activeKpiTab, permLoading, isSuperAdmin]);

  // Load offices
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchKpiOffices();
        setOffices(data || []);
      } catch (e) {
        console.error('Failed to load offices:', e);
      } finally {
        setOfficesLoading(false);
      }
    };
    load();
  }, []);

  // Close office dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (officeDropdownRef?.current && !officeDropdownRef?.current?.contains(e?.target)) {
        setOfficeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch aggregated goals for selected offices + period
  const fetchAggregatedGoals = useCallback(async (dateRange, officeIds) => {
    try {
      const { startYear, startMonth, endYear, endMonth } = dateRange;
      const monthYears = [];
      for (let y = startYear; y <= endYear; y++) {
        const mStart = y === startYear ? startMonth : 1;
        const mEnd = y === endYear ? endMonth : 12;
        for (let m = mStart; m <= mEnd; m++) {
          monthYears?.push(`${y}-${String(m)?.padStart(2, '0')}`);
        }
      }

      // V729B: Auth/session gating — verify session before querying office_goals
      let sessionReady = false;
      let sessionWarning = null;
      try {
        const { data: sessionData } = await supabase?.auth?.getSession();
        if (sessionData?.session?.access_token) {
          sessionReady = true;
        } else {
          console.warn('[fetchAggregatedGoals] No active session — attempting refreshSession');
          const { data: refreshData, error: refreshError } = await supabase?.auth?.refreshSession();
          if (refreshData?.session?.access_token) {
            sessionReady = true;
          } else {
            console.warn('[fetchAggregatedGoals] Session refresh failed:', refreshError?.message);
            sessionWarning = 'Goal data could not load because the session was not ready. Please refresh or sign in again.';
            setGoalSessionWarning(sessionWarning);
            setGoals({ production: 0, collections: null, newPatients: 0 });
            return;
          }
        }
      } catch (sessionErr) {
        console.warn('[fetchAggregatedGoals] Session check threw:', sessionErr?.message);
        sessionWarning = 'Goal data could not load because the session was not ready. Please refresh or sign in again.';
        setGoalSessionWarning(sessionWarning);
        setGoals({ production: 0, collections: null, newPatients: 0 });
        return;
      }

      setGoalSessionWarning(null);

      let query = supabase
        ?.from('office_goals')
        ?.select('office_id, month_year, production_goal, collections_goal, new_patients_goal, monthly_target')
        ?.in('month_year', monthYears);

      if (officeIds?.length > 0) {
        query = query?.in('office_id', officeIds);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[fetchAggregatedGoals] office_goals query error:', error?.message, '— code:', error?.code);
      }

      let production = 0, collections = 0, newPatients = 0;
      (data || [])?.forEach((g) => {
        production += parseFloat(g?.production_goal ?? g?.monthly_target ?? 0);
        // Skip null collection goals (e.g. May 2024 has no prior-month production goal)
        // so they don't count as $0 failed goals or corrupt the total
        const collGoal = g?.collections_goal !== null && g?.collections_goal !== undefined
          ? parseFloat(g?.collections_goal) || 0
          : null;
        if (collGoal !== null) collections += collGoal;
        // V728D: new_patients_goal = 0 is valid — preserve as 0, not dropped
        newPatients += parseFloat(g?.new_patients_goal ?? 0);
      });

      // If all collection goals were null, keep collections as null (not 0)
      const validCollGoals = (data || [])?.filter(g => g?.collections_goal !== null && g?.collections_goal !== undefined);
      const finalCollections = validCollGoals?.length > 0 ? collections : null;

      setGoals({ production, collections: finalCollections, newPatients });
    } catch (e) {
      console.error('Failed to load goals:', e);
      setGoals({ production: 0, collections: 0, newPatients: 0 });
    }
  }, []);

  // Main data fetch
  const loadData = useCallback(async () => {
    const { datePreset: currentPreset, customStartDate, customEndDate } = globalFilters;

    // Build date range — support custom preset
    let dateRange;
    let startDate, endDate;

    if (currentPreset === 'custom' && customStartDate && customEndDate && customStartDate <= customEndDate) {
      // Custom date range: derive year/month from ISO strings
      const [sy, sm] = customStartDate?.split('-')?.map(Number);
      const [ey, em] = customEndDate?.split('-')?.map(Number);
      dateRange = { startYear: sy, startMonth: sm, endYear: ey, endMonth: em };
      startDate = customStartDate;
      endDate = customEndDate;
    } else if (currentPreset === 'custom') {
      // Invalid custom range — do not fetch, clear loading
      setSummaryLoading(false);
      setTableLoading(false);
      setTrendLoading(false);
      setHygieneLoading(false);
      setDoctorLoading(false);
      setProvidersLoading(false);
      setSpecialtyLoading(false);
      setSpecialtyProvidersLoading(false);
      return;
    } else {
      dateRange = buildKpiDateRange(period);
      const built = buildDateRangeStrings(period);
      startDate = built?.startDate;
      endDate = built?.endDate;
    }

    const officeIds = selectedOfficeIds;

    // P0-5 FIX: resolve Dentrix locationId from selected Supabase office UUID
    const dentrixLocationId = officeIds?.length === 1 ? getLocationIdByOfficeId(officeIds?.[0]) : null;

    setSummaryLoading(true);
    setTableLoading(true);
    setTrendLoading(true);
    setHygieneLoading(true);
    setDoctorLoading(true);
    setProvidersLoading(true);
    setSpecialtyLoading(true);
    setSpecialtyProvidersLoading(true);
    // V729B: Reset error banner on new load
    setCoreApiFailedEndpoints([]);
    setShowApiErrorBanner(false);
    setGoalSessionWarning(null);

    // V726: DECOUPLED LOADING — Core KPI cards and Goal vs Actual render as soon as
    // production/collections/patients/appointments/adjustments/treatment-acceptance return.
    // Slow provider-performance (~1.3s/office), hygiene procedure (~1.9s), trend (72 requests),
    // and specialty calls do NOT block core card or table rendering.

    // ── PHASE 1: Core KPI data (fast endpoints) ──────────────────────────────
    const corePromise = Promise.allSettled([
      fetchKpiSummary({ ...dateRange, officeIds }),                                          // [0] summary
      fetchGoalVsActual({ ...dateRange, officeIds }),                                        // [1] table
      fetchSparklineData({ officeIds }),                                                     // [2] sparkline
      ascendApi?.getPatients(startDate, endDate, dentrixLocationId)?.catch(() => null),      // [3] patients
      ascendApi?.getProduction(startDate, endDate, dentrixLocationId)?.catch(() => null),    // [4] production
      fetchAppointmentsSummary({ startDate, endDate, locationId: dentrixLocationId }),       // [5] appointments
    ]);

    // ── PHASE 2: Slow/optional data (independent — does not block Phase 1) ───
    const slowPromise = Promise.allSettled([
      fetchTrendDataPerOffice({ officeIds }),                                                // [0] trend
      fetchHygieneKpis({ startDate, endDate, officeIds }),                                  // [1] hygiene
      fetchDoctorKpis({ startDate, endDate, officeIds }),                                   // [2] doctor
      fetchProvidersHeatmap({ startDate, endDate, officeIds }),                             // [3] providers
      fetchHygieneRetentionMetrics({ startDate, endDate, officeIds }),                      // [4] retention
      fetchHygieneProcedureMetrics({ startDate, endDate, officeIds }),                      // [5] procedure
      fetchSpecialtyKpis({ startDate, endDate, officeIds }),                                // [6] specialty
      fetchServiceCategoryFilterOptions({ startDate, endDate, officeIds }),                 // [7] specialty filters
      fetchSpecialtyProviderKpis({                                                          // [8] specialty providers
        startDate,
        endDate,
        officeIds,
        providerType: specialtyProviderTypeFilter !== 'all' ? specialtyProviderTypeFilter : null,
        specialtyGroup: specialtyGroupFilter !== 'all' ? specialtyGroupFilter : null,
      }),
    ]);

    // ── Resolve Phase 1 first — clear core loading states immediately ─────────
    try {
      const [summaryResult, tableResult, sparklineResult, patientsResult, productionResult, apptResult] = await corePromise;

      if (summaryResult?.status === 'fulfilled') {
        const summaryVal = summaryResult?.value;
        setSummary(summaryVal);
        // V729B: Check for core API failures and show banner
        if (summaryVal?.hasApiFailure && summaryVal?.coreEndpointsFailed?.length > 0) {
          setCoreApiFailedEndpoints(summaryVal?.coreEndpointsFailed);
          setShowApiErrorBanner(true);
        }
      } else {
        console.error('Summary error:', summaryResult?.reason);
        setSummary(null);
        // V729B: Summary itself failed — show banner
        setCoreApiFailedEndpoints(['production', 'collections', 'patients', 'appointments']);
        setShowApiErrorBanner(true);
      }

      if (tableResult?.status === 'fulfilled') {
        const tableVal = tableResult?.value;
        setGoalVsActualRows(tableVal || []);
        // V729B: Check for session warning from goal vs actual
        const sessionWarn = tableVal?._sessionWarning;
        if (sessionWarn) setGoalSessionWarning(sessionWarn);
      } else {
        console.error('Table error:', tableResult?.reason);
        setGoalVsActualRows([]);
      }

      if (sparklineResult?.status === 'fulfilled') setSparklineData(sparklineResult?.value || []);
      else { console.error('Sparkline error:', sparklineResult?.reason); setSparklineData([]); }

      if (patientsResult?.status === 'fulfilled') setPatientsSummary(patientsResult?.value || null);
      else { console.warn('Patients API error:', patientsResult?.reason); setPatientsSummary(null); }

      if (productionResult?.status === 'fulfilled') setProductionSummary(productionResult?.value || null);
      else { console.warn('Production API error:', productionResult?.reason); setProductionSummary(null); }

      if (apptResult?.status === 'fulfilled') setApptSummary(apptResult?.value || null);
      else { console.warn('Appointments API error:', apptResult?.reason); setApptSummary(null); }

      // Fetch goals separately (needs office UUIDs)
      await fetchAggregatedGoals(dateRange, officeIds)?.catch((e) => console.warn('Goals fetch error:', e));
    } catch (err) {
      console.warn('[loadData] Core fetch error — KPI cards will show N/A:', err);
      setSummary(null);
      setGoalVsActualRows([]);
      setSparklineData([]);
      setPatientsSummary(null);
      setProductionSummary(null);
      setApptSummary(null);
      setCoreApiFailedEndpoints(['production', 'collections', 'patients', 'appointments']);
      setShowApiErrorBanner(true);
    } finally {
      // V726: Clear core loading states as soon as core data resolves
      // Hygiene/Doctor/Trend/Providers loading states cleared separately below
      setSummaryLoading(false);
      setTableLoading(false);
    }

    // ── Resolve Phase 2 — slow/optional sections resolve independently ────────
    try {
      const [trendResult, hygieneResult, doctorResult, providersResult, retentionResult, procedureResult, specialtyResult, specialtyFilterResult, specialtyProvidersResult] = await slowPromise;

      if (trendResult?.status === 'fulfilled') setTrendData(trendResult?.value || { chartData: [], officeNames: [] });
      else { console.error('Trend error:', trendResult?.reason); setTrendData({ chartData: [], officeNames: [] }); }

      if (hygieneResult?.status === 'fulfilled') setHygieneData(hygieneResult?.value);
      else { console.error('Hygiene error:', hygieneResult?.reason); setHygieneData(null); }

      if (doctorResult?.status === 'fulfilled') setDoctorData(doctorResult?.value);
      else { console.error('Doctor error:', doctorResult?.reason); setDoctorData(null); }

      if (providersResult?.status === 'fulfilled') setProvidersData(providersResult?.value || []);
      else { console.error('Providers error:', providersResult?.reason); setProvidersData([]); }

      if (retentionResult?.status === 'fulfilled') setHygieneRetentionMetrics(retentionResult?.value);
      else { console.warn('Hygiene retention error:', retentionResult?.reason); setHygieneRetentionMetrics(null); }

      if (procedureResult?.status === 'fulfilled') setHygieneProcedureMetrics(procedureResult?.value);
      else { console.warn('Hygiene procedure metrics error:', procedureResult?.reason); setHygieneProcedureMetrics(null); }

      if (specialtyResult?.status === 'fulfilled') setSpecialtyData(specialtyResult?.value);
      else { console.warn('Specialty CDT error:', specialtyResult?.reason); setSpecialtyData({ data: null, endpointAvailable: false }); }

      if (specialtyFilterResult?.status === 'fulfilled') setSpecialtyFilterOptions(specialtyFilterResult?.value);
      else { console.warn('Specialty filter options error:', specialtyFilterResult?.reason); setSpecialtyFilterOptions(null); }

      if (specialtyProvidersResult?.status === 'fulfilled') setSpecialtyProvidersData(specialtyProvidersResult?.value);
      else { console.warn('Specialty providers error:', specialtyProvidersResult?.reason); setSpecialtyProvidersData({ data: null, endpointAvailable: false }); }
    } catch (err) {
      console.warn('[loadData] Slow fetch error — hygiene/doctor/trend sections will show unavailable:', err);
      setTrendData({ chartData: [], officeNames: [] });
      setHygieneData(null);
      setHygieneProcedureMetrics(null);
      setHygieneRetentionMetrics(null);
      setDoctorData(null);
      setProvidersData([]);
      setSpecialtyData({ data: null, endpointAvailable: false });
      setSpecialtyFilterOptions(null);
      setSpecialtyProvidersData({ data: null, endpointAvailable: false });
    } finally {
      // V726: Clear slow-section loading states after Phase 2 resolves
      setTrendLoading(false);
      setHygieneLoading(false);
      setDoctorLoading(false);
      setProvidersLoading(false);
      setSpecialtyLoading(false);
      setSpecialtyProvidersLoading(false);
    }
  }, [period, selectedOfficeIds, fetchAggregatedGoals, specialtyProviderTypeFilter, specialtyGroupFilter, globalFilters]);

  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (!ALLOWED_ROLES?.includes(userProfile?.role)) return;
    loadData()?.catch((e) => console.warn('[KPIs useEffect] loadData error:', e));
  }, [loadData, authLoading, userProfile]);

  const toggleOffice = (id) => {
    setSelectedOfficeIds((prev) =>
      prev?.includes(id) ? prev?.filter((x) => x !== id) : [...prev, id]
    );
  };

  const officeLabel = selectedOfficeIds?.length === 0
    ? 'All Offices'
    : selectedOfficeIds?.length === 1
      ? offices?.find((o) => o?.id === selectedOfficeIds?.[0])?.name || '1 Office'
      : `${selectedOfficeIds?.length} Offices`;

  // V729B: Retry handler — re-runs loadData (same as Update behavior)
  const handleRetry = useCallback(() => {
    setShowApiErrorBanner(false);
    setCoreApiFailedEndpoints([]);
    loadData()?.catch((e) => console.warn('[KPIs handleRetry] loadData error:', e));
  }, [loadData]);

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">KPIs</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Key performance indicators across all offices</p>
            </div>
          </div>

          {/* V729B: Visible API Error/Retry Banner */}
          {showApiErrorBanner && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">Some KPI data could not load because the API was temporarily unavailable.</span>
                <span className="ml-1">Please click Update to retry.</span>
                {coreApiFailedEndpoints?.length > 0 && (
                  <span className="ml-1 text-amber-700 text-xs">
                    (Affected: {coreApiFailedEndpoints?.join(', ')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update
                </button>
                <button
                  onClick={() => setShowApiErrorBanner(false)}
                  className="p-1 rounded hover:bg-amber-200 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5 text-amber-600" />
                </button>
              </div>
            </div>
          )}

          {/* V729B: Goal session warning banner */}
          {goalSessionWarning && !showApiErrorBanner && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-orange-50 border border-orange-300 text-orange-800 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
              <div className="flex-1 min-w-0">
                {goalSessionWarning}
              </div>
              <button
                onClick={() => setGoalSessionWarning(null)}
                className="p-1 rounded hover:bg-orange-200 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5 text-orange-600" />
              </button>
            </div>
          )}

          {/* Global Filter Bar */}
          <GlobalFilterBar
            offices={offices}
            filters={globalFilters}
            disableLineOfBusiness={true}
            onFiltersChange={(newFilters) => {
              setGlobalFilters(newFilters);
              const presetMap = {
                this_month: 'this_month',
                last_month: 'last_month',
                this_quarter: 'this_quarter',
                ytd: 'ytd',
              };
              if (newFilters?.datePreset === 'custom') {
                // Custom date range — period state is not used; loadData reads from globalFilters directly
                setPeriod('last_month'); // keep period as fallback default
              } else if (presetMap?.[newFilters?.datePreset]) {
                setPeriod(presetMap?.[newFilters?.datePreset]);
              }
              setSelectedOfficeIds(Array.isArray(newFilters?.selectedOfficeIds) ? newFilters?.selectedOfficeIds : []);
              // View By: 'provider_type' → switch to Providers tab; 'location' → back to main
              if (newFilters?.viewBy === 'provider_type' && activeKpiTab !== 'providers') {
                setActiveKpiTab('providers');
              } else if (newFilters?.viewBy === 'location' && activeKpiTab === 'providers') {
                setActiveKpiTab('main');
              }
            }}
          />

          {/* Year Comparison Panel */}
          <YearComparisonPanel
            officeIds={selectedOfficeIds}
            title="Year-over-Year KPI Comparison"
          />

          {/* KPI Sub-Tab Navigation */}
          <div className="border-b border-border">
            <ScrollableTabBar
              tabs={allowedKpiTabs}
              activeTab={activeKpiTab}
              onTabChange={setActiveKpiTab}
              variant="teal"
            />
          </div>

          {allowedKpiTabs?.length === 0 && !permLoading && (
            <AccessDenied message="No KPI tabs are enabled for your role. Contact your administrator." />
          )}

          {/* ── MAIN TAB ── */}
          {activeKpiTab === 'main' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.main)) && (
            <>
              {/* Section 1: KPI Cards */}
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Performance Overview</h2>
                <KpiCards
                  summary={summary}
                  goals={goals}
                  sparklineData={sparklineData}
                  loading={summaryLoading}
                  patientsSummary={patientsSummary}
                  productionSummary={productionSummary}
                  apptSummary={apptSummary}
                />
              </section>

              {/* Production & Collections — 6 fields from middleware API */}
              <section>
                {(() => {
                  const { startDate: kpiStart, endDate: kpiEnd } = buildDateRangeStrings(period);
                  const isDaily = period === 'today' || period === 'yesterday';
                  const singleOfficeId = selectedOfficeIds?.length === 1 ? selectedOfficeIds?.[0] : null;
                  const locId = singleOfficeId ? getLocationIdByOfficeId(singleOfficeId) : null;
                  return (
                    <ProductionCollectionsPanel
                      mode={isDaily ? 'daily' : 'monthly'}
                      date={isDaily ? kpiStart : undefined}
                      startDate={!isDaily ? kpiStart : undefined}
                      endDate={!isDaily ? kpiEnd : undefined}
                      locationIdProp={locId}
                      officeId={singleOfficeId}
                      periodLabel={period}
                      onDataLoaded={() => {}}
                    />
                  );
                })()}
              </section>

              {/* Section 2: Goal vs Actual Table */}
              <section>
                <GoalVsActualTable
                  rows={goalVsActualRows}
                  loading={tableLoading}
                />
              </section>

              {/* Section 3: 6-Month Trend Charts */}
              <section>
                <SparklineSection
                  trendData={trendData}
                  loading={trendLoading}
                />
              </section>

              {/* Section 4: Hygiene KPIs */}
              <section className="bg-card rounded-xl border border-border shadow-sm p-5">
                <HygieneSection data={hygieneData} loading={hygieneLoading} retentionMetrics={hygieneRetentionMetrics} procedureMetrics={hygieneProcedureMetrics} />
              </section>

              {/* Section 5: Doctor KPIs */}
              <section className="bg-card rounded-xl border border-border shadow-sm p-5">
                <DoctorSection data={doctorData} loading={doctorLoading} />
              </section>
            </>
          )}

          {/* ── SPECIALTY TAB ── */}
          {activeKpiTab === 'specialty' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.specialty)) && (
            <section className="bg-card rounded-xl border border-border shadow-sm p-5">
              <SpecialtySection
                specialtyData={specialtyData}
                filterOptions={specialtyFilterOptions}
                loading={specialtyLoading}
              />
            </section>
          )}

          {/* ── PROVIDERS TAB ── */}
          {activeKpiTab === 'providers' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.providers)) && (
            <section className="bg-card rounded-xl border border-border shadow-sm p-5">
              <ProvidersTab data={providersData} loading={providersLoading} />
            </section>
          )}

          {/* ── SPECIALTY PROVIDERS TAB ── */}
          {activeKpiTab === 'specialty_providers' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.specialty_providers)) && (
            <section className="bg-card rounded-xl border border-border shadow-sm p-5">
              <SpecialtyProvidersTab
                specialtyProvidersData={specialtyProvidersData}
                loading={specialtyProvidersLoading}
                providerTypeFilter={specialtyProviderTypeFilter}
                specialtyGroupFilter={specialtyGroupFilter}
                onProviderTypeChange={(val) => setSpecialtyProviderTypeFilter(val)}
                onSpecialtyGroupChange={(val) => setSpecialtyGroupFilter(val)}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default KpisDashboard;
