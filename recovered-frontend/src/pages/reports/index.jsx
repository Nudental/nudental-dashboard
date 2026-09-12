import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import ReportsDateFilter from './components/ReportsDateFilter';
import ReportsOfficeFilter from './components/ReportsOfficeFilter';
import PLMonthlyTable from './components/PLMonthlyTable';



import ExportPanel from './components/ExportPanel';
import GoalLeaderboard from './components/GoalLeaderboard';
import TreatmentPlanCompletionSection from './components/TreatmentPlanCompletionSection';
import PatientFlowCard from './components/PatientFlowCard';
import ExpenseBreakdownChart from './components/ExpenseBreakdownChart';
import PeriodComparisonView from './components/PeriodComparisonView';
import RevenueByProviderChart from './components/RevenueByProviderChart';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useOffice } from '../../contexts/OfficeContext';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import ProductionCollectionsPanel from '../../components/ProductionCollectionsPanel';
import { format, startOfYear, startOfMonth, subMonths, endOfMonth, startOfQuarter, subQuarters } from 'date-fns';
import { getLocationIdByOfficeId } from '../../constants/offices';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { fetchExpenseKPIs } from '../../services/expenseReportService';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  v != null && !isNaN(v)
    ? `$${Number(v)?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

const KPIBadge = ({ label, value, sub, color, loading }) => (
  <div className="bg-card border border-border rounded-lg px-4 py-3 flex-1 min-w-[140px]">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    {loading ? (
      <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" />
    ) : (
      <p className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</p>
    )}
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

const SourceBanner = ({ text }) => (
  <div className="flex items-start gap-2 px-3 py-2 bg-muted/40 border border-border/60 rounded-md mb-4">
    <Icon name="Info" size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
  </div>
);

const TAB_PERMISSION_MAP = {
  pl_summary:         'resources.reports.pl_summary.view',
  office_breakdown:   'resources.reports.office_breakdown.view',
  goal_leaderboard:   'resources.reports.goal_leaderboard.view',
  period_comparison:  'resources.reports.period_comparison.view',
  revenue_by_provider:'resources.reports.revenue_by_provider.view',
};

const ALL_REPORTS_TAB_PERMISSION_KEYS = Object.values(TAB_PERMISSION_MAP);

const ALL_REPORT_TABS = [
  { id: 'pl_summary', label: 'P&L Summary', icon: 'BarChart2' },
  { id: 'goal_leaderboard', label: 'Goal Leaderboard', icon: 'Trophy' },
  { id: 'period_comparison', label: 'Period Comparison', icon: 'GitCompare' },
  { id: 'revenue_by_provider', label: 'Provider Production & Collections', icon: 'PieChart' },
];

const Reports = () => {
  const [activeTab, setActiveTab] = useState('pl_summary');
  const [dateFilter, setDateFilter] = useState('ytd_2026');
  const [officeFilter, setOfficeFilter] = useState(['all']);
  // V587: explicit export context — updated by tab clicks AND right-side card clicks (scroll sections)
  const [currentExportReport, setCurrentExportReport] = useState('pl_summary');
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const { selectedOfficeId, canSwitchOffice, officeDisplayName } = useOffice();

  // ── KPI card state ────────────────────────────────────────────────────────
  const [kpiNetProduction, setKpiNetProduction]     = useState(null);
  const [kpiTotalCollections, setKpiTotalCollections] = useState(null);
  const [kpiTotalExpenses, setKpiTotalExpenses]     = useState(null);
  const [kpiLoading, setKpiLoading]                 = useState(false);
  const [kpiExpenseError, setKpiExpenseError]       = useState(false);

  const isOfficeManager = userProfile?.role === 'office_manager';
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const canViewCrossOffice = isSuperAdmin || isAdmin;

  // Page-level access: super_admin always allowed; otherwise require resources.reports.view OR reports:financial_view OR any tab permission
  const hasPageAccess = React.useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission('resources.reports.view')) return true;
    if (hasPermission('reports:financial_view')) return true;
    return ALL_REPORTS_TAB_PERMISSION_KEYS?.some(key => hasPermission(key));
  }, [isSuperAdmin, hasPermission, permLoading]);

  // Compute allowed report tabs
  const allowedReportTabs = React.useMemo(() => {
    if (isSuperAdmin) return ALL_REPORT_TABS;
    return ALL_REPORT_TABS?.filter(tab => hasPermission(TAB_PERMISSION_MAP?.[tab?.id]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  // Switch to first allowed tab if current tab is restricted
  useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    if (allowedReportTabs?.length > 0 && !allowedReportTabs?.find(t => t?.id === activeTab)) {
      setActiveTab(allowedReportTabs?.[0]?.id);
    }
  }, [allowedReportTabs, activeTab, permLoading, isSuperAdmin]);

  // V587: keep currentExportReport in sync when activeTab changes via tab bar
  useEffect(() => {
    setCurrentExportReport(activeTab);
  }, [activeTab]);

  const VISIBLE_TABS = [
    ...allowedReportTabs,
    ...(canViewCrossOffice ? [{ id: 'office_comparison', label: 'Office Comparison', icon: 'GitCompare', isLink: true, path: '/office-comparison' }] : []),
  ];

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Reports' }
  ];

  const scopedOfficeFilter = isOfficeManager && userProfile?.office_id ? [userProfile?.office_id] : officeFilter;

  const getReportDateRange = () => {
    const now = new Date();
    if (dateFilter === 'ytd_2026' || dateFilter === 'ytd') {
      return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
    if (dateFilter === 'this_month') {
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
    if (dateFilter === 'last_month') {
      const lm = subMonths(now, 1);
      return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
    }
    if (dateFilter === 'this_quarter') {
      return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
    if (dateFilter === 'last_quarter') {
      const lq = subQuarters(now, 1);
      return { start: format(startOfQuarter(lq), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd') };
    }
    if (dateFilter?.startsWith('q') && dateFilter?.includes('_')) {
      const qMatch = dateFilter?.match(/^q([1-4])_(\d{4})$/);
      if (qMatch) {
        const q = Number(qMatch?.[1]);
        const yr = Number(qMatch?.[2]);
        const startMonth = (q - 1) * 3;
        const start = format(new Date(yr, startMonth, 1), 'yyyy-MM-dd');
        const end = format(new Date(yr, startMonth + 3, 0), 'yyyy-MM-dd');
        return { start, end };
      }
    }
    if (dateFilter?.startsWith('ytd_')) {
      const yr = parseInt(dateFilter?.replace('ytd_', ''), 10);
      if (!isNaN(yr)) {
        const now2 = new Date();
        const end = yr === now2?.getFullYear() ? format(now2, 'yyyy-MM-dd') : `${yr}-12-31`;
        return { start: `${yr}-01-01`, end };
      }
    }
    if (dateFilter?.startsWith('fy_')) {
      const yr = parseInt(dateFilter?.replace('fy_', ''), 10);
      if (!isNaN(yr)) return { start: `${yr}-01-01`, end: `${yr}-12-31` };
    }
    return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
  };

  const { start: reportStart, end: reportEnd } = getReportDateRange();

  // Derive a truthful period label for the Production & Collections panel
  const getPeriodLabel = (filter) => {
    if (!filter) return 'Monthly';
    if (filter === 'this_month' || filter === 'last_month') return 'Monthly';
    if (filter === 'this_quarter' || filter === 'last_quarter') return 'Quarterly';
    if (/^q[1-4]_\d{4}$/?.test(filter)) return 'Quarterly';
    if (filter === 'ytd' || filter === 'ytd_2026') return 'YTD';
    if (/^ytd_\d{4}$/?.test(filter)) return 'YTD';
    if (filter === 'full_year' || /^fy_\d{4}$/?.test(filter)) return 'Full Year';
    if (filter === 'custom') return 'Selected Period';
    return 'Monthly';
  };

  const periodLabel = getPeriodLabel(dateFilter);

  // Dynamic KPI card period suffix
  const kpiPeriodSuffix = (() => {
    if (!dateFilter) return '(YTD)';
    if (dateFilter === 'this_month' || dateFilter === 'last_month') return '(Monthly)';
    if (dateFilter === 'this_quarter' || dateFilter === 'last_quarter') return '(Quarterly)';
    if (/^q[1-4]_\d{4}$/?.test(dateFilter)) return '(Quarterly)';
    if (dateFilter === 'ytd' || dateFilter === 'ytd_2026') return '(YTD)';
    if (/^ytd_\d{4}$/?.test(dateFilter)) return '(YTD)';
    if (dateFilter === 'full_year' || /^fy_\d{4}$/?.test(dateFilter)) return '(Full Year)';
    if (dateFilter === 'custom') return '(Selected Period)';
    return '(YTD)';
  })();

  // Resolve locationId: if a single office is selected use its locationId, else null (all offices)
  const reportLocationId = (!scopedOfficeFilter || scopedOfficeFilter?.includes('all') || scopedOfficeFilter?.length !== 1)
    ? null
    : getLocationIdByOfficeId(scopedOfficeFilter?.[0]) || null;

  // ── Callback: ProductionCollectionsPanel lifts netProduction + totalCollections ──
  const handleProductionCollectionsData = useCallback((data) => {
    setKpiNetProduction(data?.netProduction ?? null);
    setKpiTotalCollections(data?.totalCollections ?? null);
  }, []);

  // ── Fetch Total Expenses from Finance Expense Report service ──────────────
  useEffect(() => {
    let cancelled = false;
    const activeOffices = (scopedOfficeFilter || [])?.filter(o => o && o !== 'all');

    const fetchExpenses = async () => {
      setKpiLoading(true);
      setKpiExpenseError(false);
      try {
        // Use fetchExpenseKPIs — the EXACT same function Finance → Expense Report uses.
        // Params: { startDate, endDate, officeIds } — identical to ExpenseReport.jsx.
        // Read result.totalExpenses — the same field Finance KPI cards display.
        console.log('[Reports KPI] top card fetchExpenseKPIs params:', {
          startDate: reportStart,
          endDate: reportEnd,
          officeIds: activeOffices,
        });
        const kpis = await fetchExpenseKPIs({
          startDate: reportStart,
          endDate: reportEnd,
          officeIds: activeOffices,
        });
        console.log('[Reports KPI] fetchExpenseKPIs result: totalExpenses =', kpis?.totalExpenses);
        if (!cancelled) {
          setKpiTotalExpenses(kpis?.totalExpenses ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[Reports KPI] fetchExpenseKPIs error:', err?.message);
          setKpiExpenseError(true);
          setKpiTotalExpenses(null);
        }
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    };

    fetchExpenses();
    return () => { cancelled = true; };
  }, [reportStart, reportEnd, scopedOfficeFilter]);

  // ── Reset production/collections when filters change ─────────────────────
  useEffect(() => {
    setKpiNetProduction(null);
    setKpiTotalCollections(null);
  }, [reportStart, reportEnd, reportLocationId]);

  // ── Derived: Est. Net Profit ──────────────────────────────────────────────
  const kpiEstNetProfit = (() => {
    if (kpiTotalCollections != null && kpiTotalExpenses != null) {
      return kpiTotalCollections - kpiTotalExpenses;
    }
    return null;
  })();

  if (permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Page-level access denied
  if (!hasPageAccess) {
    return (
      <div className="min-h-screen bg-background">
        <main className="main-content">
          <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
            <Breadcrumb items={breadcrumbItems} />
            <AccessDenied
              title="Reports Access Restricted"
              message="You don't have permission to view Financial Reports. Contact your administrator to request access."
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-6">
            <div>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <Icon name="ChevronLeft" size={16} />
                Back to Home
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Financial Reports</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isOfficeManager
                  ? 'P&L summaries, goal leaderboard, and clinical KPIs for your office'
                  : 'P&L summaries, office breakdowns, goal leaderboard, and clinical KPIs'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportsDateFilter value={dateFilter} onChange={setDateFilter} />
              {!isOfficeManager && (
                <ReportsOfficeFilter selected={officeFilter} onChange={setOfficeFilter} />
              )}
            </div>
          </div>

          {isOfficeManager && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-5">
              <Icon name="Building2" size={16} className="text-blue-600" />
              <p className="text-sm text-blue-700">
                <span className="font-semibold">Office View:</span> Showing data for your assigned office only.
              </p>
            </div>
          )}

          {/* KPI Summary Row — wired to verified sources */}
          <div className="mb-2">
            <SourceBanner text={`Source: Net Production & Total Collections from Dentrix/FastAPI (/v2/production/summary, /v2/collections/summary). Total Expenses from Finance Expense Report (fetchExpenseKPIs — same function as Finance tab, same params). Est. Net Profit = Total Collections − Total Expenses.${kpiExpenseError ? ' ⚠ Expense data unavailable — showing — for expense-dependent cards.' : ''}`} />
          </div>
          <div className="flex gap-3 flex-wrap mb-6">
            <KPIBadge
              label={`Net Production ${kpiPeriodSuffix}`}
              value={kpiNetProduction != null ? fmtCurrency(kpiNetProduction) : '—'}
              sub={kpiNetProduction != null ? 'Source: Dentrix/FastAPI /v2/production/summary → netProduction' : 'Loading from Dentrix/FastAPI…'}
              color={kpiNetProduction != null ? 'text-foreground' : 'text-muted-foreground'}
              loading={false}
            />
            <KPIBadge
              label={`Total Collections ${kpiPeriodSuffix}`}
              value={kpiTotalCollections != null ? fmtCurrency(kpiTotalCollections) : '—'}
              sub={kpiTotalCollections != null ? 'Source: Dentrix/FastAPI /v2/collections/summary → totalCollections' : 'Loading from Dentrix/FastAPI…'}
              color={kpiTotalCollections != null ? 'text-blue-600' : 'text-muted-foreground'}
              loading={false}
            />
            <KPIBadge
              label={`Total Expenses ${kpiPeriodSuffix}`}
              value={kpiTotalExpenses != null ? fmtCurrency(kpiTotalExpenses) : '—'}
              sub={kpiTotalExpenses != null ? 'Source: Finance Expense Report fetchExpenseKPIs → totalExpenses' : kpiExpenseError ? 'Expense source unavailable — showing —' : 'Loading from Finance Expense Report…'}
              color={kpiTotalExpenses != null ? 'text-red-500' : 'text-muted-foreground'}
              loading={kpiLoading}
            />
            <KPIBadge
              label={`Est. Net Profit ${kpiPeriodSuffix}`}
              value={kpiEstNetProfit != null ? fmtCurrency(kpiEstNetProfit) : '—'}
              sub={kpiEstNetProfit != null ? 'Formula: Total Collections − Total Expenses' : 'Requires both Collections and Expenses to load'}
              color={kpiEstNetProfit != null ? (kpiEstNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-muted-foreground'}
              loading={false}
            />
          </div>

          {/* Production & Collections — 6 fields from middleware API */}
          <div className="mb-1">
            <SourceBanner text="Source: Dentrix/FastAPI middleware. Production and collections actuals are pulled directly from the Ascend/Dentrix API." />
          </div>
          <ProductionCollectionsPanel
            mode="monthly"
            startDate={reportStart}
            endDate={reportEnd}
            locationIdProp={reportLocationId}
            date={reportStart}
            officeId={scopedOfficeFilter?.includes('all') ? null : scopedOfficeFilter?.[0]}
            className="mb-6"
            periodLabel={periodLabel}
            onDataLoaded={handleProductionCollectionsData}
          />

          {/* Year Comparison Panel */}
          <YearComparisonPanel
            title="Year-over-Year Financial Reports"
            compact={true}
          />

          {/* Main Content + Sidebar */}
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit flex-wrap">
                {VISIBLE_TABS?.map(tab => (
                  <button
                    key={tab?.id}
                    onClick={() => {
                      if (tab?.isLink) {
                        navigate(tab?.path);
                      } else {
                        setActiveTab(tab?.id);
                        setCurrentExportReport(tab?.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-smooth ${
                      activeTab === tab?.id
                        ? 'bg-card text-foreground shadow-elevation-1'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name={tab?.icon} size={15} />
                    {tab?.label}
                  </button>
                ))}
              </div>

              {allowedReportTabs?.length === 0 && !permLoading && (
                <AccessDenied message="No Report tabs are enabled for your role. Contact your administrator." />
              )}

              {/* Tab Content */}
              {activeTab === 'pl_summary' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.pl_summary)) && (
                <>
                  <SourceBanner text="Source: Dentrix/FastAPI monthly net production and collections + Finance Expense Report expense totals. Legacy MEA is not used for official values in this table." />
                  <PLMonthlyTable dateFilter={dateFilter} officeFilter={scopedOfficeFilter} />
                </>
              )}
              {activeTab === 'goal_leaderboard' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.goal_leaderboard)) && (
                <>
                  <SourceBanner text="Source: Office Performance goal logic — office_goals targets + Dentrix/FastAPI collections actuals via getGoalAchievement(). Date and office filters apply. Each month's achievement is computed live from Dentrix/FastAPI actuals vs. office_goals production target." />
                  <GoalLeaderboard officeFilter={scopedOfficeFilter} dateFilter={dateFilter} />
                </>
              )}
              {activeTab === 'period_comparison' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.period_comparison)) && (
                <>
                  <SourceBanner text="Source: Dentrix/FastAPI production and collections + Finance Expense Report protected expense totals. Manual/EOD sources (revenue_entries, daily_entries) are not used for official Period Comparison values." />
                  <PeriodComparisonView officeFilter={scopedOfficeFilter} />
                </>
              )}
              {activeTab === 'revenue_by_provider' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.revenue_by_provider)) && (
                <>
                  <SourceBanner text="Source: Dentrix/FastAPI /v2/reports/provider-performance. Provider production and collections actuals from Ascend middleware." />
                  <RevenueByProviderChart dateFilter={dateFilter} officeFilter={scopedOfficeFilter} locationId={reportLocationId} />
                </>
              )}

              {/* Charts Section — shown on non-comparison tabs */}
              {activeTab !== 'period_comparison' && activeTab !== 'revenue_by_provider' && (
                <>
                  <div id="expense-breakdown" className="mb-1">
                    <SourceBanner text="Expense Breakdown: supporting drilldown only — not the official Total Expenses source. Includes Gusto payroll, WF Direct Operating Expense (banking/middleware), and back-staff/expense entries from daily_entries." />
                  </div>
                  <ExpenseBreakdownChart
                    dateFilter={dateFilter}
                    officeFilter={scopedOfficeFilter}
                  />

                  <div id="treatment-plan-completion">
                    <TreatmentPlanCompletionSection
                      plannedStartDate={reportStart}
                      plannedEndDate={reportEnd}
                      officeFilter={scopedOfficeFilter}
                    />
                  </div>

                  <div id="patient-flow">
                    <PatientFlowCard
                      officeFilter={scopedOfficeFilter}
                      reportStart={reportStart}
                      reportEnd={reportEnd}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Right Sidebar — Export */}
            <div className="xl:w-64 flex-shrink-0">
              <ExportPanel
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentExportReport={currentExportReport}
                setCurrentExportReport={setCurrentExportReport}
                dateFilter={dateFilter}
                officeFilter={scopedOfficeFilter}
                netProduction={kpiNetProduction}
                totalCollections={kpiTotalCollections}
                totalExpenses={kpiTotalExpenses}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Reports;
