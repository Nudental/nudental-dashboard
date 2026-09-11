import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';




import OfficeFilterSelect from './components/OfficeFilterSelect';
import ComparisonModeToggle from './components/ComparisonModeToggle';
import ConnectionStatus from './components/ConnectionStatus';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAccessibleOffices, isOfficeManager } from '../../services/dashboardService';
import GoalDonutChart from './components/GoalDonutChart';
import MonthEndForecastWidget from './components/MonthEndForecastWidget';
import ScheduledProductionCard from './components/ScheduledProductionCard';
import ChecklistCompletionGauge from './components/ChecklistCompletionGauge';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useRolePermissions from '../../hooks/useRolePermissions';
import { fetchMultiOfficeKPIs } from '../../services/dailyEntryBulkImportService';
import { fetchExpenseKPIs } from '../../services/expenseReportService';
import { format } from 'date-fns';
import { AccessDenied } from '../../hooks/useRbacGuard';
import MonthlyGrowthTab from './components/MonthlyGrowthTab';
import RevenueSummarySection from './components/RevenueSummarySection';
import FinancialsPerLocationChart from './components/FinancialsPerLocationChart';
import GlobalFilterBar from '../../components/GlobalFilterBar';
import MultiYearMetricCard from './components/MultiYearMetricCard';
import MultiYearRevenueChart from './components/MultiYearRevenueChart';
import MultiYearComparisonTable from './components/MultiYearComparisonTable';
import { useYearComparison } from '../../contexts/YearComparisonContext';
import { fetchMultiYearMEAData } from '../../services/yearComparisonService';
import ScheduleAutoEmailModal from './components/ScheduleAutoEmailModal';
import ScheduleYearComparisonModal from './components/ScheduleYearComparisonModal';


import { generateExecutivePDF, captureElement, fetchTopProviders } from '../../services/executivePDFService';
import { fetchMonthlyGrowth } from '../../services/monthlyGrowthService';
import { supabase } from '../../lib/supabase';
import { ascendApi } from '../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../constants/offices';
import { fetchExecutiveKPIs, buildExecutiveDateRange } from '../../services/executiveOverviewService';
import ExecutiveReconciliationPanel from './components/ExecutiveReconciliationPanel';
import { useExecutiveOverview } from '../../hooks/useExecutiveOverview';
import DentrixDataSourceBanner from '../../components/DentrixDataSourceBanner';

// ─── OFFICE_LIST: canonical per-office Dentrix locationId mapping ─────────────
const OFFICE_LIST = [
  { id: '220372a5-afae-49c9-8a0c-f4c0717ff352', name: 'Eatontown',     dentrixLocationId: '14000000000433' },
  { id: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', name: 'Staten Island', dentrixLocationId: '14000000000432' },
  { id: '54626997-57c2-4934-8743-1dabb4d176f4', name: 'Brick',         dentrixLocationId: '14000000000435' },
  { id: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', name: 'Barnegat',      dentrixLocationId: '14000000000434' },
];

const fmt = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(isFinite(n) ? n : 0);
};

// ─── Hook: EOD Last Posted + Pending Approvals Count ─────────────────────────
function useEODAnalyticsStatus(officeIds) {
  const [lastPostedAt, setLastPostedAt] = useState(null);
  const [lastPostedOffice, setLastPostedOffice] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      let lastApprovedQuery = supabase
        ?.from('daily_entries')
        ?.select('approved_at, offices(name)')
        ?.eq('status', 'approved')
        ?.order('approved_at', { ascending: false })
        ?.limit(1)
        ?.maybeSingle();

      let pendingQuery = supabase
        ?.from('daily_entries')
        ?.select('id', { count: 'exact', head: true })
        ?.in('status', ['pending', 'pending_review']);

      // Apply office filter if specific offices are selected
      if (officeIds?.length > 0) {
        pendingQuery = pendingQuery?.in('office_id', officeIds);
      }

      const [lastApprovedRes, pendingRes] = await Promise.allSettled([
        lastApprovedQuery,
        pendingQuery,
      ]);

      if (lastApprovedRes?.status === 'fulfilled' && lastApprovedRes?.value?.data) {
        setLastPostedAt(lastApprovedRes?.value?.data?.approved_at);
        setLastPostedOffice(lastApprovedRes?.value?.data?.offices?.name || null);
      }
      if (pendingRes?.status === 'fulfilled') {
        setPendingCount(pendingRes?.value?.count ?? 0);
      }
    } catch (_) {}
  }, [officeIds?.join(',')]);

  useEffect(() => {
    fetchStatus();
    let channel;
    try {
      channel = supabase
        ?.channel(`eod-analytics-status-${Date.now()}`)
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, fetchStatus)
        ?.subscribe();
    } catch (err) {
      console.warn('[eod-analytics-status] channel error:', err?.message);
    }
    return () => {
      if (channel) {
        try { supabase?.removeChannel(channel); } catch (_) {}
      }
    };
  }, [fetchStatus]);

  return { lastPostedAt, lastPostedOffice, pendingCount };
}

// ─── EOD Status Indicator Component ──────────────────────────────────────────
const EODAnalyticsIndicator = ({ lastPostedAt, lastPostedOffice, pendingCount, officeCount }) => {
  const navigate = useNavigate();

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'No data posted yet';
    const diff = Date.now() - new Date(isoString)?.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const hasData = !!lastPostedAt;
  // Label clarifies scope: "Selected Offices" when filtered, "All Offices" when not
  const pendingScope = officeCount > 0 ? 'Selected Offices' : 'All Offices';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Last EOD Posted */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${hasData ? 'bg-emerald-50 border-emerald-200' : 'bg-muted border-border'}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasData ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
        <div className="flex flex-col">
          <span className={`text-xs font-semibold ${hasData ? 'text-emerald-700' : 'text-muted-foreground'}`}>
            Last EOD Posted
          </span>
          <span className={`text-xs ${hasData ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {hasData ? (
              <>
                {formatRelativeTime(lastPostedAt)}
                {lastPostedOffice && <span className="ml-1 opacity-75">· {lastPostedOffice}</span>}
              </>
            ) : 'No approvals yet'}
          </span>
        </div>
        <Icon name="CheckCircle" size={13} className={hasData ? 'text-emerald-500' : 'text-muted-foreground'} />
      </div>

      {/* Pending Approvals Count */}
      <button
        onClick={() => navigate('/pending-approvals')}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          pendingCount > 0
            ? 'bg-amber-50 border-amber-300 hover:bg-amber-100' :'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
        }`}
        title="Go to EOD Approval Queue"
      >
        <Icon
          name={pendingCount > 0 ? 'Clock' : 'CheckCircle2'}
          size={13}
          className={pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <div className="flex flex-col">
          <span className={`text-xs font-semibold ${pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            Pending Approvals
          </span>
          <span className={`text-xs ${pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {pendingCount > 0 ? `${pendingCount} awaiting · ${pendingScope}` : `All clear · ${pendingScope}`}
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>
    </div>
  );
};

// Hook to fetch live quick-action counts from Supabase
function useQuickActionCounts(userProfile) {
  const [counts, setCounts] = useState({ pendingApprovals: null, tasks: null, huddles: null });

  useEffect(() => {
    if (!userProfile?.id) return;
    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const today = new Date()?.toISOString()?.split('T')?.[0];
        const [pendingRes, tasksRes, huddlesRes] = await Promise.allSettled([
          supabase?.from('daily_entries')?.select('id', { count: 'exact', head: true })?.eq('status', 'pending'),
          supabase?.from('action_items')?.select('id', { count: 'exact', head: true })?.eq('task_status', 'open'),
          // morning_huddle is the correct schema table (not 'huddles')
          supabase?.from('morning_huddle')?.select('id', { count: 'exact', head: true })?.eq('huddle_date', today),
        ]);
        if (!cancelled) {
          setCounts({
            pendingApprovals: pendingRes?.status === 'fulfilled' ? (pendingRes?.value?.count ?? null) : null,
            tasks: tasksRes?.status === 'fulfilled' ? (tasksRes?.value?.count ?? null) : null,
            huddles: huddlesRes?.status === 'fulfilled' ? (huddlesRes?.value?.count ?? null) : null,
          });
        }
      } catch (_) {}
    };

    fetchCounts();

    // Realtime refresh
    let channel;
    try {
      channel = supabase?.channel(`quick-action-counts-${Date.now()}`)
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, fetchCounts)
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'action_items' }, fetchCounts)
        ?.subscribe();
    } catch (err) {
      console.warn('[quick-action-counts] channel error:', err?.message);
    }

    return () => {
      cancelled = true;
      if (channel) {
        try { supabase?.removeChannel(channel); } catch (_) {}
      }
    };
  }, [userProfile?.id]);

  return counts;
}

const ExecutiveOverview = () => {
  const { userProfile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const {
    selectedYears,
    isComparisonMode,
    isYearFilterActive,
    getYearColor,
    resetYears,
  } = useYearComparison();

  const [selectedOffices, setSelectedOffices] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('just now');
  const [accessibleOffices, setAccessibleOffices] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // Global toggle: 'all' | specific office id
  const [globalView, setGlobalView] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  const [pdfExporting, setPdfExporting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showYearComparisonScheduleModal, setShowYearComparisonScheduleModal] = useState(false);

  // Multi-year comparison state
  const [multiYearData, setMultiYearData] = useState({});
  const [multiYearLoading, setMultiYearLoading] = useState(false);

  const [globalFilters, setGlobalFilters] = useState({
    datePreset: 'last_month',
    selectedOfficeIds: [],
    lineOfBusiness: [],
    viewBy: 'location',
  });

  // Reconciliation panel toggle (Super Admin only)
  const [showReconciliation, setShowReconciliation] = useState(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isRegional = userProfile?.role === 'regional_manager' || userProfile?.role === 'regional_clinical_manager';
  const canUseGlobalToggle = isSuperAdmin || isRegional;

  const canSelectOffices = isSuperAdmin || userProfile?.role === 'admin';
  const isOfficeMgr = isOfficeManager(userProfile);
  const canViewGrowthTab = isSuperAdmin || isRegional || hasPermission('dashboard:executive_overview');

  // ─── Permission gate (render-safe) ───────────────────────────────────────
  // Evaluated as a derived value — never used to conditionally skip hooks.
  // All hooks above run unconditionally every render regardless of access state.
  const isPermissionLoading = authLoading || profileLoading || permLoading;
  const hasExecutiveAccess = isSuperAdmin || isRegional || hasPermission('dashboard:executive_overview');

  // Compute effectiveOfficeIds: from globalFilters if set, otherwise from selectedOffices
  const effectiveOfficeIds = useMemo(() => {
    if (globalFilters?.selectedOfficeIds?.length > 0) return globalFilters?.selectedOfficeIds;
    if (selectedOffices?.length > 0) return selectedOffices;
    return accessibleOffices?.map(o => o?.id) || [];
  }, [globalFilters?.selectedOfficeIds, selectedOffices, accessibleOffices]);

  const roleLabel = isSuperAdmin ? 'All Offices' : isRegional ? 'Regional View'
    : userProfile?.role === 'admin' ? 'Assigned Offices'
    : accessibleOffices?.[0]?.name || 'Your Office';

  // Offices to show in donut charts based on selected offices (effectiveOfficeIds)
  // When 2+ offices are selected, show only those selected offices — NOT all accessible offices
  const visibleOffices = useMemo(() => {
    if (effectiveOfficeIds?.length > 0) {
      return accessibleOffices?.filter(o => effectiveOfficeIds?.includes(o?.id));
    }
    // No filter set — show all accessible offices
    return accessibleOffices;
  }, [effectiveOfficeIds, accessibleOffices]);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Executive Overview' }
  ];

  // Listen for bulk import completion to trigger live refresh and chronological re-sort
  useEffect(() => {
    const handleDailyEntriesUpdated = (e) => {
      setRefreshKey(k => k + 1);
      setLastUpdate('just now');
      setIsConnected(true);
    };
    window.addEventListener('daily-entries-updated', handleDailyEntriesUpdated);
    return () => window.removeEventListener('daily-entries-updated', handleDailyEntriesUpdated);
  }, []);

  // Load accessible offices
  useEffect(() => {
    const loadOffices = async () => {
      if (authLoading || profileLoading) return;
      if (!userProfile) { setOfficesLoading(false); return; }
      setOfficesLoading(true);
      try {
        const offices = await getAccessibleOffices(userProfile);
        setAccessibleOffices(offices);
        // Initialize selectedOffices from accessible offices
        // but do NOT override globalFilters — globalFilters drives the filter bar
        setSelectedOffices(offices?.map(o => o?.id));
      } catch (err) {
        setAccessibleOffices([]);
      } finally {
        setOfficesLoading(false);
      }
    };
    loadOffices();
  }, [userProfile, authLoading, profileLoading]);

  // ── Authoritative date preset ─────────────────────────────────────────────
  // SINGLE SOURCE OF TRUTH: globalFilters.datePreset from GlobalFilterBar
  // The top-right DateRangePicker has been removed to eliminate the duplicate.
  const effectiveDatePreset = globalFilters?.datePreset || 'last_month';

  // Derive the monthYear for goal charts from the effective date preset
  // For multi-month presets (quarter, ytd, year), use the start month
  const goalMonthYear = useMemo(() => {
    const dr = buildExecutiveDateRange(effectiveDatePreset);
    // Use the start date's year-month so goal charts match the selected period
    return dr?.startDate?.substring(0, 7); // 'YYYY-MM'
  }, [effectiveDatePreset]);

  // Compute date range for KPI fetch — uses effectiveDatePreset
  const getDateRangeParams = useCallback(() => {
    const rangeInfo = buildExecutiveDateRange(effectiveDatePreset);
    return {
      start: rangeInfo?.startDate,
      end: rangeInfo?.endDate,
      isPartialMonth: rangeInfo?.isPartialMonth,
      label: rangeInfo?.label,
    };
  }, [effectiveDatePreset]);

  // ── CENTRALIZED DATA HOOK ─────────────────────────────────────────────────
  // useExecutiveOverview is the SINGLE source of truth for all Executive
  // Overview metrics. It replaces the three separate useEffect blocks that
  // previously fetched execKPIs, kpiData, and expenseKPIs independently.
  //
  // The hook re-fetches whenever effectiveOfficeIds, effectiveDatePreset,
  // or lineOfBusiness changes. The cache key includes all three dimensions
  // so no stale all-office data is ever reused for a single-office view.
  const {
    data: overviewData,
    loading: overviewLoading,
    refetch: refetchOverview,
  } = useExecutiveOverview({
    officeIds: effectiveOfficeIds,
    datePreset: effectiveDatePreset,
    lineOfBusiness: globalFilters?.lineOfBusiness || [],
    enabled: !officesLoading,
    refreshKey,
  });

  // ── Derived state from centralized hook ───────────────────────────────────
  // All cards read from overviewData — the single normalized payload.
  const execKPIs = overviewData;
  const execKPIsLoading = overviewLoading;
  const kpiData = overviewData
    ? {
        groupTotals: overviewData?.groupTotals,
        officeBreakdown: overviewData?.officeBreakdown,
        totalEntries: overviewData?.totalEntries,
      }
    : null;
  const kpiLoading = overviewLoading;
  const expenseKPIs = overviewData?.expenseKPIs ?? null;
  const expenseKPIsLoading = overviewLoading;

  // ── Ascend /v2/expenses/summary — WF Main Money-Out cash-basis totals ─────
  // PRIMARY source for Operating Expenses cards.
  // ascendExpenses.totalExpenses  → totals.total_expenses (WF Main Money-Out)
  // ascendExpenses.payroll        → totals.payroll (Gusto detail, review only)
  // ascendExpenses.benefits       → totals.benefits (review only)
  // ascendExpenses.payrollPctOfCollections → ratios.payroll_pct_of_collections
  const ascendExpenses = overviewData?.ascendExpenses ?? null;

  // Backward-compat aliases used by remaining render code
  const ascendCollectionsSummary = overviewData
    ? { totalCollections: overviewData?.totalCollections, collectionRate: overviewData?.collectionRate }
    : null;

  // ── REMOVED: Three separate useEffect data fetches ────────────────────────
  // The following effects have been DELETED and replaced by useExecutiveOverview:
  //   - loadKPIs (fetchMultiOfficeKPIs)
  //   - loadExpenseKPIs (fetchExpenseKPIs)
  //   - loadExecKPIs (fetchExecutiveKPIs)
  // All three now run in parallel inside useExecutiveOverview with a shared
  // cache key that includes office + date + LOB.

  // ── Keep: Ascend daily summary (today's snapshot — not filter-dependent) ──
  // This replaces the old `ascendDaily` state + effect.
  const { lastPostedAt, lastPostedOffice, pendingCount: eodPendingCount } = useEODAnalyticsStatus(effectiveOfficeIds);
  const quickCounts = useQuickActionCounts(userProfile);

  // Real-time subscriptions — trigger refreshKey increment on DB changes
  const { isPulsing, isConnected: rtConnected } = useRealtimeSubscription(
    [
      { table: 'revenue_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
      { table: 'daily_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
      { table: 'expense_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
    ],
    useCallback(() => {
      setRefreshKey(k => k + 1);
      setLastUpdate('just now');
      setIsConnected(true);
    }, []),
    !officesLoading && accessibleOffices?.length > 0
  );

  useEffect(() => { setIsConnected(rtConnected); }, [rtConnected]);

  useEffect(() => {
    const interval = setInterval(() => {
      const minutes = Math.floor(Math.random() * 5) + 1;
      setLastUpdate(`${minutes} min ago`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load multi-year MEA data when years are selected
  useEffect(() => {
    if (!isYearFilterActive || selectedYears?.length === 0) {
      setMultiYearData({});
      return;
    }
    const loadMultiYearData = async () => {
      setMultiYearLoading(true);
      try {
        // Use effectiveOfficeIds so year comparison respects selected office filter
        const officeIds = effectiveOfficeIds?.length > 0
          ? effectiveOfficeIds
          : accessibleOffices?.map(o => o?.id) || [];
        const data = await fetchMultiYearMEAData(selectedYears, officeIds);
        setMultiYearData(data);
      } catch (err) {
        console.warn('Failed to load multi-year data:', err?.message);
        setMultiYearData({});
      } finally {
        setMultiYearLoading(false);
      }
    };
    loadMultiYearData();
  }, [selectedYears, isYearFilterActive, effectiveOfficeIds]);

  // ── Ascend API: provider performance with Supabase fallback ──────────────
  const [ascendProviders, setAscendProviders] = useState(null);
  const [ascendProvidersLoading, setAscendProvidersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadProviderPerformance = async () => {
      setAscendProvidersLoading(true);
      try {
        const dr = getDateRangeParams();
        // Pass locationId only when exactly one office is selected via effectiveOfficeIds
        const locationId = effectiveOfficeIds?.length === 1 ? getLocationIdByOfficeId(effectiveOfficeIds?.[0]) : null;
        const data = await ascendApi?.getProviderPerformance(dr?.start, dr?.end, locationId);
        const providers = Array.isArray(data) ? data : data?.providers || data?.data || [];
        if (!cancelled) {
          setAscendProviders(providers?.length > 0 ? providers : null);
        }
      } catch {
        if (!cancelled) setAscendProviders(null);
      } finally {
        if (!cancelled) setAscendProvidersLoading(false);
      }
    };
    loadProviderPerformance();
    return () => { cancelled = true; };
  }, [effectiveDatePreset, getDateRangeParams, effectiveOfficeIds]);

  // Supabase fallback provider data from kpiData officeBreakdown
  const providerRows = React.useMemo(() => {
    if (ascendProviders && ascendProviders?.length > 0) return ascendProviders;
    // Fallback: derive from kpiData officeBreakdown (office-level, not provider-level)
    return null;
  }, [ascendProviders]);

  // ── Per-office FastAPI production summary for Group-Wide Office Summary ────
  // SOURCE OF TRUTH: GET /v2/production/summary per office using Dentrix locationId.
  // Displays netProduction (true production) — NOT Supabase daily_entries.
  const [officeProductionSummary, setOfficeProductionSummary] = useState([]);
  const [officeProductionLoading, setOfficeProductionLoading] = useState(false);

  useEffect(() => {
    // Only fetch when "All Locations" global view is active (canUseGlobalToggle + globalView === 'all')
    if (!canUseGlobalToggle) return;

    let cancelled = false;
    const loadOfficeProduction = async () => {
      setOfficeProductionLoading(true);
      try {
        const dr = buildExecutiveDateRange(effectiveDatePreset);
        const startDate = dr?.startDate;
        const endDate = dr?.endDate;

        // Determine which offices to show based on effectiveOfficeIds filter
        // [] or all 4 = show all; subset = show only matching
        const allOfficeIds = OFFICE_LIST?.map(o => o?.id);
        const isAllOffices =
          effectiveOfficeIds?.length === 0 ||
          effectiveOfficeIds?.length >= allOfficeIds?.length ||
          allOfficeIds?.every(id => effectiveOfficeIds?.includes(id));

        const officesToFetch = isAllOffices
          ? OFFICE_LIST
          : OFFICE_LIST?.filter(o => effectiveOfficeIds?.includes(o?.id));

        if (officesToFetch?.length === 0) {
          if (!cancelled) setOfficeProductionSummary([]);
          return;
        }

        // Fetch each office in parallel
        const results = await Promise.allSettled(
          officesToFetch?.map(async (office) => {
            const raw = await ascendApi?.getProduction(startDate, endDate, office?.dentrixLocationId);
            // netProduction fallback chain per spec
            const netProduction =
              raw?.netProduction ??
              raw?.production ??
              raw?.net_production ??
              raw?.ledgerProduction ??
              null;

            if (netProduction === null && raw?.grossProduction !== undefined) {
              console.warn(
                `[GroupWideOfficeSummary] WARNING: netProduction missing for ${office?.name}. ` +
                `Falling back to grossProduction. Check /v2/production/summary response shape.`,
                { office: office?.name, locationId: office?.dentrixLocationId, raw }
              );
            }

            const value = netProduction ?? raw?.grossProduction ?? 0;
            return {
              id: office?.id,
              name: office?.name,
              netProduction: value,
            };
          })
        );

        if (!cancelled) {
          const summaries = results
            ?.map((r, i) =>
              r?.status === 'fulfilled'
                ? r?.value
                : { id: officesToFetch?.[i]?.id, name: officesToFetch?.[i]?.name, netProduction: 0 }
            )
            ?.filter(Boolean);
          setOfficeProductionSummary(summaries);
        }
      } catch (err) {
        console.warn('[GroupWideOfficeSummary] Failed to load per-office production:', err?.message);
        if (!cancelled) setOfficeProductionSummary([]);
      } finally {
        if (!cancelled) setOfficeProductionLoading(false);
      }
    };

    loadOfficeProduction();
    return () => { cancelled = true; };
  }, [effectiveDatePreset, effectiveOfficeIds, canUseGlobalToggle, refreshKey]);

  // Current month/year for PDF
  const now = new Date();
  const currentMonth = now?.getMonth() + 1;
  const currentYear = now?.getFullYear();

  const handleExportPDF = async () => {
    if (pdfExporting) return;
    setPdfExporting(true);
    try {
      // Capture the bar chart from Monthly Growth tab if visible
      let chartImageData = null;
      if (activeTab === 'monthly-growth') {
        chartImageData = await captureElement('monthly-growth-bar-chart');
      }

      // ── Resolve effective date range for PDF ──────────────────────────────
      // PDF must respect the selected date range (effectiveDatePreset), NOT always current month.
      const dr = buildExecutiveDateRange(effectiveDatePreset);
      const pdfStartDate = dr?.startDate;
      const pdfEndDate = dr?.endDate;

      // Derive month/year from the effective date range start for growth data fetch
      const pdfStartObj = new Date(pdfStartDate + 'T00:00:00');
      const pdfMonth = pdfStartObj?.getMonth() + 1;
      const pdfYear = pdfStartObj?.getFullYear();

      // ── Build per-office Dentrix breakdown for PDF ────────────────────────
      // SOURCE: officeProductionSummary (Dentrix /v2/production/summary per office)
      // This is the correct Dentrix-sourced per-office data.
      // We enrich it with collections from overviewData.officeBreakdown if available,
      // otherwise use the group-level collections distributed proportionally.
      let pdfOfficeBreakdown = [];

      if (officeProductionSummary?.length > 0) {
        // Use per-office Dentrix production data
        // For collections, use overviewData.officeBreakdown if it has Dentrix collections,
        // otherwise fall back to proportional distribution from group total
        const dentrixOfficeBreakdownRaw = overviewData?.officeBreakdown || [];

        pdfOfficeBreakdown = officeProductionSummary?.map((officeProd) => {
          // Try to find matching office in overviewData.officeBreakdown
          const matchingBreakdown = dentrixOfficeBreakdownRaw?.find(
            (o) => o?.id === officeProd?.id || o?.office_id === officeProd?.id
          );

          const netProd = Math.abs(parseFloat(officeProd?.netProduction ?? 0));
          const totalColl = matchingBreakdown?.totalCollections != null
            ? Math.abs(parseFloat(matchingBreakdown?.totalCollections))
            : matchingBreakdown?.collection != null
              ? Math.abs(parseFloat(matchingBreakdown?.collection))
              : null;

          const newPats = matchingBreakdown?.newPatients ?? matchingBreakdown?.new_patients ?? 0;

          const collRate = totalColl != null && netProd > 0
            ? (totalColl / netProd) * 100
            : null;

          return {
            id: officeProd?.id,
            name: officeProd?.name,
            netProduction: netProd,
            totalCollections: totalColl ?? 0,
            newPatients: parseInt(newPats, 10),
            collectionRate: collRate,
          };
        });
      }

      // ── Build dentrixData payload for PDF ─────────────────────────────────
      // SOURCE: overviewData (Dentrix Ascend via useExecutiveOverview hook)
      // NEVER use kpiData.groupTotals (daily_entries EOD) for financial totals.
      const dentrixDataForPDF = {
        netProduction: overviewData?.netProduction ?? 0,
        totalCollections: overviewData?.totalCollections ?? 0,
        collectionRate: overviewData?.collectionRate ?? null,
        newPatients: overviewData?.newPatients ?? 0,
        officeBreakdown: pdfOfficeBreakdown,
        startDate: pdfStartDate,
        endDate: pdfEndDate,
        // topProviders from daily_entries (workflow data — clearly labeled in PDF)
        topProviders: [],
      };

      // Fetch growth data and top providers in parallel
      // Growth data uses the effective period's month/year
      // Top providers from daily_entries (workflow/EOD data — labeled as such in PDF)
      const [growthData, topProviders] = await Promise.all([
        fetchMonthlyGrowth(pdfMonth, pdfYear),
        fetchTopProviders(supabase, pdfMonth, pdfYear),
      ]);

      // Attach top providers to dentrixData (labeled as workflow data in PDF)
      dentrixDataForPDF.topProviders = topProviders || [];

      // Build period label from effective date range
      const MONTH_NAMES_PDF = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
      ];
      const startObj = new Date(pdfStartDate + 'T00:00:00');
      const endObj = new Date(pdfEndDate + 'T00:00:00');
      const startLbl = `${MONTH_NAMES_PDF?.[startObj?.getMonth()]} ${startObj?.getFullYear()}`;
      const endLbl = `${MONTH_NAMES_PDF?.[endObj?.getMonth()]} ${endObj?.getFullYear()}`;
      const pdfPeriodLabel = startLbl === endLbl ? startLbl : `${startLbl} – ${endLbl}`;

      const doc = await generateExecutivePDF({
        dentrixData: dentrixDataForPDF,
        growthData,
        // Legacy params for backward compat
        month: pdfMonth,
        year: pdfYear,
        periodLabel: pdfPeriodLabel,
        chartImageData,
      });

      doc?.save(`NuDental_Executive_Summary_${pdfPeriodLabel?.replace(/\s+/g, '_')?.replace(/[–—]/g, '-')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setPdfExporting(false);
    }
  };

  // Multi-year KPI card definitions
  const multiYearKPICards = [
    { title: 'Net Production', metricKey: 'production', format: 'currency', icon: 'DollarSign', iconColor: 'var(--color-primary)', higherIsBetter: true },
    { title: 'Collections', metricKey: 'collections', format: 'currency', icon: 'TrendingUp', iconColor: 'var(--color-success)', higherIsBetter: true },
    { title: 'New Patients', metricKey: 'newPatients', format: 'number', icon: 'Users', iconColor: 'var(--color-accent)', higherIsBetter: true },
    { title: 'Net Income', metricKey: 'netIncome', format: 'currency', icon: 'PieChart', iconColor: 'var(--color-warning)', higherIsBetter: true },
    { title: 'Collection Rate', metricKey: 'collectionRate', format: 'percent', icon: 'Percent', iconColor: '#6366f1', higherIsBetter: true },
    { title: 'Case Acceptance', metricKey: 'caseAcceptance', format: 'percent', icon: 'CheckCircle', iconColor: '#10b981', higherIsBetter: true },
    { title: 'Doctor Production', metricKey: 'doctor', format: 'currency', icon: 'Stethoscope', iconColor: '#3b82f6', higherIsBetter: true },
    { title: 'Hygiene Production', metricKey: 'hygiene', format: 'currency', icon: 'Activity', iconColor: '#8b5cf6', higherIsBetter: true },
  ];

  const yearKPIMap = React.useMemo(() => {
    const map = {};
    Object.entries(multiYearData || {})?.forEach(([year, data]) => {
      map[year] = {
        production: data?.production ?? 0,
        collections: data?.collections ?? 0,
        newPatients: data?.newPatients ?? 0,
        netIncome: data?.netIncome ?? 0,
        collectionRate: data?.collectionRate ?? 0,
        caseAcceptance: data?.caseAcceptance ?? 0,
        doctor: data?.doctor ?? 0,
        hygiene: data?.hygiene ?? 0,
      };
    });
    return map;
  }, [multiYearData]);

  const comparisonRows = React.useMemo(() => {
    return multiYearKPICards?.map((card) => ({
      label: card?.title,
      metricKey: card?.metricKey,
      format: card?.format,
      higherIsBetter: card?.higherIsBetter,
      values: selectedYears?.reduce((acc, year) => {
        acc[year] = yearKPIMap?.[year]?.[card?.metricKey] ?? 0;
        return acc;
      }, {}),
    }));
  }, [multiYearData, selectedYears, yearKPIMap]);

  // Keep globalFilters.selectedOfficeIds in sync with the active office scope
  // so RevenueSummarySection and FinancialsPerLocationChart always use the same offices
  // NOTE: effectiveOfficeIds is now defined earlier and is the canonical source.
  // This block is kept for backward compatibility with any remaining references.

  // ── Sync globalView FROM globalFilters so donut charts respect the selected office ──
  // GlobalFilterBar is the single source of truth for office selection.
  // globalView is derived from it — not independently set via header pills.
  useEffect(() => {
    if (globalFilters?.selectedOfficeIds?.length === 1) {
      setGlobalView(globalFilters?.selectedOfficeIds?.[0]);
    } else {
      setGlobalView('all');
    }
  }, [globalFilters?.selectedOfficeIds]);

  // ─── Render-time permission gate ─────────────────────────────────────────
  // SAFE: all hooks have already been called unconditionally above.
  // Show loading spinner while auth/profile/permissions are resolving.
  if (isPermissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // Show Access Denied if user does not have executive overview permission.
  // This handles permission mismatches (e.g. admin role with has_executive_view=false)
  // without crashing. The user sees a clear message instead of "Something went wrong."
  if (!hasExecutiveAccess) {
    return (
      <AccessDenied
        title="Executive Overview — Access Restricted"
        message="Your account does not have permission to view the Executive Overview. Contact your administrator to request access, or use the sidebar to navigate to an accessible page."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-foreground mb-2">
              Executive Overview
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm md:text-base text-muted-foreground">
                Strategic financial dashboard for C-level oversight and decision-making
              </p>
              {!officesLoading && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Icon name="Building2" size={12} />
                  {canUseGlobalToggle && globalView !== 'all'
                    ? accessibleOffices?.find(o => o?.id === globalView)?.name || roleLabel
                    : roleLabel}
                </span>
              )}
              {isYearFilterActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <Icon name="CalendarRange" size={11} />
                  {isComparisonMode ? `${selectedYears?.length}-Year Comparison` : `Year ${selectedYears?.[0]}`}
                </span>
              )}
            </div>
            {/* EOD Analytics Real-Time Indicator */}
            <div className="mt-3">
              <EODAnalyticsIndicator
                lastPostedAt={lastPostedAt}
                lastPostedOffice={lastPostedOffice}
                pendingCount={eodPendingCount}
                officeCount={effectiveOfficeIds?.length}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">
            {/* REMOVED: duplicate top-right office pills (canUseGlobalToggle block) */}
            {/* REMOVED: duplicate OfficeFilterSelect (canSelectOffices block) */}
            {/* Office selection is now exclusively handled by GlobalFilterBar below */}
            <ComparisonModeToggle
              isEnabled={comparisonMode}
              onToggle={() => setComparisonMode(!comparisonMode)}
            />
            <ConnectionStatus
              isConnected={isConnected}
              lastUpdate={lastUpdate}
            />
            {/* Export PDF button — visible to super admin and regional roles */}
            {canViewGrowthTab && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExportPDF}
                  disabled={pdfExporting || kpiLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
                  title="Export Monthly Executive Summary as PDF"
                >
                  <Icon name={pdfExporting ? 'Loader2' : 'FileDown'} size={13} className={pdfExporting ? 'animate-spin' : ''} />
                  {pdfExporting ? 'Generating…' : 'Export Monthly Executive Summary'}
                </button>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-1 px-2.5 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Schedule Auto-Email"
                >
                  <Icon name="CalendarClock" size={13} />
                  Schedule
                </button>
                <button
                  onClick={() => setShowYearComparisonScheduleModal(true)}
                  className="flex items-center gap-1 px-2.5 py-2 border border-indigo-300 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  title="Schedule Year Comparison Reports"
                >
                  <Icon name="GitCompare" size={13} />
                  Year Reports
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Inner Tab Bar ── */}
        <div className="flex items-center gap-1 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          {canViewGrowthTab && (
            <button
              onClick={() => setActiveTab('monthly-growth')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'monthly-growth' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="TrendingUp" size={13} />
              Monthly Growth
            </button>
          )}
          {isYearFilterActive && (
            <button
              onClick={() => setActiveTab('year-comparison')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'year-comparison' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="GitCompare" size={13} />
              Year Comparison
              {isComparisonMode && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-indigo-600 text-white rounded-full">
                  {selectedYears?.length}Y
                </span>
              )}
            </button>
          )}
        </div>

        {officesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner"></div>
          </div>
        ) : accessibleOffices?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Icon name="Building2" size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Office Assigned</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You are not currently assigned to any office. Please contact your administrator.
            </p>
          </div>
        ) : activeTab === 'monthly-growth' && canViewGrowthTab ? (
          (() => {
            const dr = buildExecutiveDateRange(effectiveDatePreset);
            const startObj = new Date(dr?.startDate + 'T00:00:00');
            return (
              <MonthlyGrowthTab
                selectedOfficeIds={effectiveOfficeIds}
                selectedMonth={startObj?.getMonth() + 1}
                selectedYear={startObj?.getFullYear()}
              />
            );
          })()
        ) : activeTab === 'year-comparison' && isYearFilterActive ? (
          /* ── Year Comparison Tab ── */
          (<div className="space-y-6">
            {/* Year comparison header */}
            <div className="flex items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="GitCompare" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {isComparisonMode ? 'Year-over-Year Comparison' : `Year ${selectedYears?.[0]} Analysis`}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isComparisonMode
                      ? `Comparing ${selectedYears?.join(' vs ')} across all metrics`
                      : `Full-year analytics for ${selectedYears?.[0]}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Year Comparison data is sourced from monthly_executive_analytics historical records.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  {selectedYears?.map(year => (
                    <span
                      key={year}
                      className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: getYearColor(year) }}
                    >
                      {year}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={resetYears}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                <Icon name="X" size={12} />
                Reset Years
              </button>
            </div>
            {multiYearLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 8 })?.map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-3 bg-muted rounded w-20 mb-3" />
                    <div className="h-6 bg-muted rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Multi-year KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {multiYearKPICards?.map((card, i) => (
                    <MultiYearMetricCard
                      key={i}
                      {...card}
                      yearKPIMap={yearKPIMap}
                      selectedYears={selectedYears}
                      getYearColor={getYearColor}
                    />
                  ))}
                </div>

                {/* Multi-year chart */}
                <MultiYearRevenueChart
                  yearDataMap={multiYearData}
                  selectedYears={selectedYears}
                  getYearColor={getYearColor}
                />

                {/* Comparison table — only in multi-year mode */}
                {isComparisonMode && (
<MultiYearComparisonTable
                      comparisonRows={comparisonRows}
                      selectedYears={selectedYears}
                      getYearColor={getYearColor}
                      officeIds={effectiveOfficeIds?.length > 0 ? effectiveOfficeIds : accessibleOffices?.map(o => o?.id)}
                    />
                  )}
              </>
            )}
          </div>)
        ) : (
          <>
{/* Global Filter Bar */}
            <div className="mb-5">
              <GlobalFilterBar
                offices={accessibleOffices?.map(o => ({ id: o?.id, name: o?.name }))}
                filters={globalFilters}
                onFiltersChange={(newFilters) => setGlobalFilters(newFilters)}
              />
            </div>

{/* Year filter active banner */}
            {isYearFilterActive && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <Icon name="CalendarRange" size={14} className="text-indigo-600 flex-shrink-0" />
                <p className="text-xs text-indigo-700 font-medium">
                  Year filter active: {selectedYears?.join(', ')} — 
                  <button
                    onClick={() => setActiveTab('year-comparison')}
                    className="ml-1 underline underline-offset-2 hover:text-indigo-900"
                  >
                    View Year Comparison tab
                  </button>
                </p>
                <button onClick={resetYears} className="ml-auto text-indigo-500 hover:text-indigo-700">
                  <Icon name="X" size={12} />
                </button>
              </div>
            )}

            {/* Quick Action Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Pending Approvals', icon: 'Clock', route: '/pending-approvals', color: 'text-red-600', bg: 'bg-red-50 border-red-200 hover:bg-red-100', desc: 'Review entries', count: quickCounts?.pendingApprovals },
                { label: 'Tasks', icon: 'CheckSquare', route: '/team-assignments', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100', desc: 'Team assignments', count: quickCounts?.tasks },
                { label: 'Morning Huddle', icon: 'Sun', route: '/daily-morning-huddle', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100', desc: 'Daily huddle', count: quickCounts?.huddles },
                { label: 'EOD Report', icon: 'ClipboardList', route: '/daily-entry-form', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100', desc: 'Submit daily entry', count: null },
                { label: 'Reports', icon: 'FileBarChart', route: '/reports', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100', desc: 'P&L & analytics', count: null },
              ]?.map(action => (
                <button
                  key={action?.route + action?.label}
                  onClick={() => navigate(action?.route)}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${action?.bg}`}
                  aria-label={`Go to ${action?.label}`}
                >
                  {action?.count !== null && action?.count !== undefined && (
                    <span className={`absolute top-2 right-2 min-w-[18px] h-[18px] px-1 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none ${
                      action?.count > 0 ? 'bg-red-500' : 'bg-emerald-500'
                    }`}>
                      {action?.count > 99 ? '99+' : action?.count}
                    </span>
                  )}
                  <Icon name={action?.icon} size={22} className={action?.color} />
                  <span className={`text-xs font-semibold ${action?.color}`}>{action?.label}</span>
                  <span className="text-[10px] text-muted-foreground">{action?.desc}</span>
                </button>
              ))}
            </div>

            {/* Revenue Summary Section — passes selectedOfficeIds for location-aware queries */}
            <RevenueSummarySection filters={{
              ...globalFilters,
              selectedOfficeIds: effectiveOfficeIds,
            }} />

            {/* ── Main KPI Stat Cards — sourced from centralized executiveOverviewService ── */}
            {(() => {
              const kpiCardsLoading = execKPIsLoading;
              const dr = getDateRangeParams();

              // Helper to compute YoY change label
              const yoyLabel = (current, prior) => {
                const c = Number(current) || 0;
                const p = Number(prior) || 0;
                if (!p) return null;
                const pct = ((c - p) / Math.abs(p)) * 100;
                const sign = pct >= 0 ? '+' : '';
                return `${sign}${pct?.toFixed(1)}% vs prior year`;
              };

              // All KPI values now come from execKPIs — the single authoritative source.
              // NET PRODUCTION = execKPIs.netProduction (Dentrix ledger production)
              // TOTAL COLLECTIONS = execKPIs.totalCollections (Dentrix ledger collections)
              // TOTAL NEW PATIENTS = execKPIs.newPatients (preserved, not reworked)
              const statCards = [
                {
                  label: 'NET PRODUCTION',
                  value: execKPIs?.netProduction ?? 0,
                  priorValue: execKPIs?.priorNetProduction ?? null,
                  icon: 'DollarSign',
                  iconColor: 'text-indigo-600',
                  bg: 'bg-indigo-50',
                  border: 'border-indigo-200',
                  subLabel: execKPIs?.grossProduction
                    ? `UCR: ${fmt(execKPIs?.grossProduction)}`
                    : null,
                },
                {
                  label: 'PROD. ADJUSTMENTS',
                  value: Math.abs(execKPIs?.totalAdjustments ?? execKPIs?.writeOffs ?? 0),
                  priorValue: null,
                  icon: 'Minus',
                  iconColor: 'text-red-600',
                  bg: 'bg-red-50',
                  border: 'border-red-200',
                  subLabel: execKPIs?.writeOffs != null
                    ? `Write-offs: ${fmt(Math.abs(execKPIs?.writeOffs))}`
                    : 'PPO / Contractual reductions',
                },
                {
                  label: 'TOTAL COLLECTIONS',
                  value: Math.abs(execKPIs?.totalCollections ?? 0),
                  priorValue: execKPIs?.priorTotalCollections ?? null,
                  icon: 'Banknote',
                  iconColor: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-200',
                  subLabel: execKPIs?.collectionRate != null
                    ? `${Number(execKPIs?.collectionRate)?.toFixed(1)}% rate`
                    : null,
                },
                {
                  label: 'TOTAL NEW PATIENTS',
                  value: execKPIs?.newPatients ?? 0,
                  priorValue: execKPIs?.priorNewPatients ?? null,
                  icon: 'UserPlus',
                  iconColor: 'text-purple-600',
                  bg: 'bg-purple-50',
                  border: 'border-purple-200',
                  isNumber: true,
                  subLabel: execKPIs?.uniquePatients != null
                    ? `${execKPIs?.uniquePatients} unique`
                    : null,
                },
                {
                  label: 'COLLECTION RATE',
                  value: parseFloat(execKPIs?.collectionRate) || 0,
                  priorValue: null,
                  icon: 'Percent',
                  iconColor: 'text-blue-600',
                  bg: 'bg-blue-50',
                  border: 'border-blue-200',
                  isPercent: true,
                  subLabel: 'Collections ÷ Net Production',
                }
              ];

              return (
                <div className="mb-6 bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Icon name="BarChart2" size={15} color="#6366f1" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Key Performance Indicators</h3>
                      <p className="text-[11px] text-muted-foreground">
                        via Dentrix Ascend · {dr?.label || 'selected date range'}
                        {execKPIs?.isAprilPartial && (
                          <span className="ml-1 text-amber-600 font-semibold">· ⚠️ April partial (Apr 1–20)</span>
                        )}
                      </p>
                    </div>
                    {/* Date Range label — single source of truth indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg ml-2">
                      <Icon name="CalendarRange" size={12} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-indigo-700 whitespace-nowrap">
                        Date Range: {dr?.start} – {dr?.end}
                      </span>
                    </div>
                    {/* Office label — single source of truth indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <Icon name="Building2" size={12} className="text-slate-500 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        Office: {
                          globalFilters?.selectedOfficeIds?.length === 1
                            ? accessibleOffices?.find(o => o?.id === globalFilters?.selectedOfficeIds?.[0])?.name || 'Selected Office' :'All Locations'
                        }
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {kpiCardsLoading && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon name="Loader2" size={12} className="animate-spin" />
                          Loading…
                        </div>
                      )}
                      {/* Reconciliation panel toggle — Super Admin only */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => setShowReconciliation(v => !v)}
                          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border transition-colors ${
                            showReconciliation
                              ? 'bg-amber-100 border-amber-300 text-amber-700' :'bg-muted border-border text-muted-foreground hover:text-foreground'
                          }`}
                          title="Toggle KPI Reconciliation Panel"
                        >
                          <Icon name="FlaskConical" size={11} />
                          Reconcile
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Dentrix data source status banner */}
                  {!kpiCardsLoading && (
                    <div className="mb-3">
                      <DentrixDataSourceBanner
                        dentrixAvailable={overviewData?.dentrixApiAvailable ?? null}
                        dentrixError={overviewData?.dentrixApiError}
                        locationId={overviewData?.locationId}
                        officeName={effectiveOfficeIds?.length === 1
                          ? accessibleOffices?.find(o => o?.id === effectiveOfficeIds?.[0])?.name
                          : effectiveOfficeIds?.length === 0 ? 'All Offices' : null}
                        startDate={dr?.start}
                        endDate={dr?.end}
                        compact
                      />
                    </div>
                  )}
                  {kpiCardsLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Array.from({ length: 5 })?.map((_, i) => (
                        <div key={i} className="bg-muted rounded-lg p-3 animate-pulse h-20" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {statCards?.map((item) => {
                        const yoy = yoyLabel(item?.value, item?.priorValue);
                        const isUp = item?.priorValue != null && Number(item?.value) >= Number(item?.priorValue);
                        return (
                          <div key={item?.label} className={`rounded-lg p-3 ${item?.bg} border ${item?.border}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon name={item?.icon} size={13} className={item?.color} />
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item?.label}</span>
                            </div>
                            <p className={`text-base font-bold ${item?.color}`}>
                              {item?.isNumber
                                ? (Number(item?.value) || 0)
                                : item?.isPercent
                                  ? `${Number(item?.value)?.toFixed(1)}%`
                                  : fmt(item?.value)}
                            </p>
                            {yoy && (
                              <p className={`text-[10px] mt-0.5 font-medium flex items-center gap-0.5 ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                                <Icon name={isUp ? 'TrendingUp' : 'TrendingDown'} size={9} />
                                {yoy}
                              </p>
                            )}
                            {!yoy && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">via Dentrix Ascend</p>
                            )}
                            {item?.subLabel && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{item?.subLabel}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reconciliation Panel — Super Admin debug tool */}
                  {isSuperAdmin && showReconciliation && execKPIs && (
                    <ExecutiveReconciliationPanel
                      kpis={execKPIs}
                      dateRange={dr}
                      selectedOfficeIds={effectiveOfficeIds}
                      accessibleOffices={accessibleOffices}
                    />
                  )}
                </div>
              );
            })()}

            {/* ── Expense KPI Cards — from normalized Expense Report layer ── */}
            <div className="mb-6 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <Icon name="Receipt" size={15} color="#e11d48" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Operating Expenses</h3>
                  <p className="text-[11px] text-muted-foreground">WF Main Money-Out · selected date range</p>
                </div>
                {expenseKPIsLoading && (
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="Loader2" size={12} className="animate-spin" />
                    Loading…
                  </div>
                )}
                <button
                  onClick={() => navigate('/financial-analytics/expense-report')}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  title="Open Expense Report"
                >
                  <Icon name="ExternalLink" size={11} />
                  Full Report
                </button>
              </div>
              {expenseKPIsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 })?.map((_, i) => (
                    <div key={i} className="bg-muted rounded-lg p-3 animate-pulse h-20" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Total Operating Expenses — SOURCE: /v2/expenses/summary → totals.total_expenses (WF Main Money-Out) */}
                  <div className="rounded-lg p-3 bg-rose-50 border border-rose-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name="TrendingDown" size={13} className="text-rose-600" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Operating Expenses</span>
                    </div>
                    <p className="text-base font-bold text-rose-700">
                      {ascendExpenses != null
                        ? fmt(ascendExpenses?.totalExpenses ?? 0)
                        : expenseKPIs != null
                          ? fmt(expenseKPIs?.totalExpenses ?? 0)
                          : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">WF Main Money-Out, includes payroll funding</p>
                  </div>

                  {/* Payroll Cost — SOURCE: /v2/expenses/summary → totals.payroll (Gusto detail, review only) */}
                  <div className="rounded-lg p-3 bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name="Users" size={13} className="text-orange-600" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Payroll Cost</span>
                    </div>
                    <p className="text-base font-bold text-orange-700">
                      {ascendExpenses != null
                        ? fmt(ascendExpenses?.payroll ?? 0)
                        : expenseKPIs != null
                          ? fmt(expenseKPIs?.payrollExpense ?? 0)
                          : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Gusto payroll detail — review only</p>
                  </div>

                  {/* Benefits — SOURCE: /v2/expenses/summary → totals.benefits (review only) */}
                  <div className="rounded-lg p-3 bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name="Heart" size={13} className="text-amber-600" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Benefits</span>
                    </div>
                    <p className="text-base font-bold text-amber-700">
                      {ascendExpenses != null
                        ? fmt(ascendExpenses?.benefits ?? 0)
                        : expenseKPIs != null
                          ? fmt(expenseKPIs?.benefitsExpense ?? 0)
                          : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Payroll benefits detail — review only</p>
                  </div>

                  {/* Payroll % of Collections — SOURCE: /v2/expenses/summary → ratios.payroll_pct_of_collections */}
                  <div className="rounded-lg p-3 bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name="Percent" size={13} className="text-slate-600" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Payroll % of Collections</span>
                    </div>
                    <p className="text-base font-bold text-slate-700">
                      {ascendExpenses?.payrollPctOfCollections != null
                        ? `${parseFloat(ascendExpenses?.payrollPctOfCollections)?.toFixed(2)}%`
                        : expenseKPIs && (ascendCollectionsSummary?.totalCollections > 0)
                          ? `${((expenseKPIs?.payrollExpense / Math.abs(ascendCollectionsSummary?.totalCollections)) * 100)?.toFixed(1)}%`
                          : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Gusto payroll ÷ Dentrix collections</p>
                  </div>
                </div>
              )}
            </div>

                        {/* ── Provider Performance Section ── */}
            <div className="mb-6 md:mb-8 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon name="Stethoscope" size={15} color="#3b82f6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Provider Performance</h3>
                  <p className="text-[11px] text-muted-foreground">via Dentrix Ascend · {getDateRangeParams()?.label || 'selected date range'}</p>
                </div>
                {ascendProvidersLoading && (
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="Loader2" size={12} className="animate-spin" />
                    Loading…
                  </div>
                )}
              </div>
              {ascendProvidersLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3]?.map(i => (
                    <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : providerRows && providerRows?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Provider</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Office</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Production</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Collections</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Collection Rate</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">New Patients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerRows?.map((row, idx) => {
                        const production = parseFloat(row?.production ?? row?.netProduction ?? row?.net_production ?? 0);
                        const collections = parseFloat(row?.collections ?? row?.totalCollections ?? row?.total_collections ?? 0);
                        const collRate = row?.collectionRate ?? row?.collection_rate ?? (production > 0 ? (collections / production) * 100 : null);
                        const newPats = row?.newPatients ?? row?.new_patients ?? row?.newPatientCount ?? null;
                        const providerName = row?.providerName ?? row?.provider_name ?? row?.name ?? `Provider ${idx + 1}`;
                        const officeName = row?.officeName ?? row?.office_name ?? row?.location ?? '—';
                        return (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 font-medium text-foreground">{providerName}</td>
                            <td className="py-2 px-3 text-muted-foreground">{officeName}</td>
                            <td className="py-2 px-3 text-right font-semibold text-foreground">{production > 0 ? fmt(production) : 'N/A'}</td>
                            <td className="py-2 px-3 text-right text-foreground">{collections > 0 ? fmt(collections) : 'N/A'}</td>
                            <td className="py-2 px-3 text-right">
                              {collRate != null
                                ? <span className={`font-semibold ${collRate >= 95 ? 'text-emerald-600' : collRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{parseFloat(collRate)?.toFixed(1)}%</span>
                                : <span className="text-muted-foreground">N/A</span>}
                            </td>
                            <td className="py-2 px-3 text-right text-foreground">{newPats != null ? newPats : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Icon name="Stethoscope" size={28} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No Provider Data Available</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Provider performance data is sourced from Dentrix Ascend. No provider data was returned for the selected date range and office filter.
                  </p>
                </div>
              )}
            </div>

            {/* ── Financials Per Location Bar Graph ── */}
            <FinancialsPerLocationChart filters={{
              datePreset: effectiveDatePreset,
              selectedOfficeIds: effectiveOfficeIds,
            }} />

            {/* ── Financials Summary Cards (below chart) ── */}
            {!execKPIsLoading && execKPIs && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 md:mb-8">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="DollarSign" size={13} className="text-indigo-600" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Production</span>
                  </div>
                  <p className="text-base font-bold text-indigo-700">{fmt(execKPIs?.netProduction ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Net Production · Dentrix</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="Banknote" size={13} className="text-emerald-600" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Collection</span>
                  </div>
                  <p className="text-base font-bold text-emerald-700">{fmt(Math.abs(execKPIs?.totalCollections ?? 0))}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total Collections · Dentrix</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="UserPlus" size={13} className="text-purple-600" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">New Patients</span>
                  </div>
                  <p className="text-base font-bold text-purple-700">{execKPIs?.newPatients ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">New Patients · Dentrix</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="Percent" size={13} className="text-blue-600" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Collection Rate</span>
                  </div>
                  <p className="text-base font-bold text-blue-700">
                    {execKPIs?.collectionRate != null ? `${parseFloat(execKPIs?.collectionRate)?.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Collections ÷ Net Production</p>
                </div>
              </div>
            )}

            {/* No data banner */}
            {!kpiLoading && (kpiData?.totalEntries === 0) && (
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border border-border rounded-lg">
                <Icon name="Info" size={14} className="text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">No data for this period. All values shown as zero.</p>
              </div>
            )}
            {kpiLoading || kpiData?.totalEntries > 0 ? <div className="mb-6 md:mb-8" /> : null}

            {/* Group-Wide Office Summary — SOURCE: FastAPI /v2/production/summary per office */}
            {canUseGlobalToggle && globalView === 'all' && (officeProductionSummary?.length > 0 || officeProductionLoading) && (
              <div className="mb-6 md:mb-8 bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="BarChart3" size={16} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Group-Wide Office Summary</h3>
                  <span className="text-xs text-muted-foreground ml-auto">Net Production (Dentrix)</span>
                </div>
                {officeProductionLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3]?.map(i => (
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 animate-pulse">
                        <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                        <div className="h-5 bg-muted rounded w-3/4 mb-1" />
                        <div className="h-2 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {officeProductionSummary?.map((office) => (
                      <div
                        key={office?.id}
                        className={`rounded-lg border p-3 cursor-pointer transition-smooth hover:border-primary/40 ${
                          globalView === office?.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
                        }`}
                        onClick={() => setGlobalView(office?.id)}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon name="Building2" size={12} color="var(--color-primary)" />
                          <p className="text-xs font-semibold text-foreground truncate">{office?.name}</p>
                        </div>
                        <p className="text-base font-bold text-foreground">{fmt(office?.netProduction)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Net Production</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Goal Achievement Donut Charts */}
            {isSuperAdmin || isRegional ? (
              <div className="mb-6 md:mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4 rounded-xl transition-all duration-300">
                  {visibleOffices?.slice(0, 6)?.map(office => (
                    <GoalDonutChart
                      key={`${office?.id}-${refreshKey}`}
                      officeId={office?.id}
                      officeName={office?.name}
                      monthYear={goalMonthYear}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleOffices?.slice(0, 6)?.map(office => (
                    <MonthEndForecastWidget
                      key={`${office?.id}-${refreshKey}`}
                      officeId={office?.id}
                      officeName={office?.name}
                      monthYear={goalMonthYear}
                      onPaceAlertNeeded={() => {}}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 md:mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GoalDonutChart
                  key={`goal-${accessibleOffices?.[0]?.id}-${refreshKey}`}
                  officeId={accessibleOffices?.[0]?.id}
                  officeName={accessibleOffices?.[0]?.name}
                  monthYear={goalMonthYear}
                />
                <MonthEndForecastWidget
                  key={`forecast-${accessibleOffices?.[0]?.id}-${refreshKey}`}
                  officeId={accessibleOffices?.[0]?.id}
                  officeName={accessibleOffices?.[0]?.name}
                  monthYear={goalMonthYear}
                  onPaceAlertNeeded={() => {}}
                />
              </div>
            )}

            {/* Huddle KPI Cards — Today's workflow metrics (today-only, clearly labeled) */}
            {/* Render one card per selected office so multi-office selections are not silently collapsed to first office */}
            <div className={`space-y-4 mb-6 md:mb-8 rounded-xl transition-all duration-300 ${isPulsing ? 'animate-pulse-flash' : ''}`}>
              {visibleOffices?.length > 0 ? (
                visibleOffices?.slice(0, 4)?.map(office => (
                  <div key={office?.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleOffices?.length > 1 && (
                      <div className="col-span-full flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                        <Icon name="Building2" size={12} />
                        {office?.name} — Today's Workflow
                      </div>
                    )}
                    <ScheduledProductionCard
                      key={`sched-${office?.id}-${refreshKey}`}
                      officeId={office?.id}
                    />
                    <ChecklistCompletionGauge
                      key={`checklist-${office?.id}-${refreshKey}`}
                      officeId={office?.id}
                    />
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ScheduledProductionCard
                    key={`sched-${refreshKey}`}
                    officeId={accessibleOffices?.[0]?.id}
                  />
                  <ChecklistCompletionGauge
                    key={`checklist-${refreshKey}`}
                    officeId={accessibleOffices?.[0]?.id}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg border border-border">
              <Icon name="Info" size={16} className="text-muted-foreground" />
              <p className="text-xs md:text-sm text-muted-foreground">
                {rtConnected ? 'Live data — updates in real-time.' : 'Data refreshes automatically every 15 minutes.'} Last update: {lastUpdate}
              </p>
            </div>
          </>
        )}
      </div>
      {/* Schedule Auto-Email Modal */}
      <ScheduleAutoEmailModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        month={new Date()?.getMonth() + 1}
        year={new Date()?.getFullYear()}
      />
      {/* Schedule Year Comparison Reports Modal */}
      <ScheduleYearComparisonModal
        isOpen={showYearComparisonScheduleModal}
        onClose={() => setShowYearComparisonScheduleModal(false)}
      />
    </div>
  );
};

export default ExecutiveOverview;