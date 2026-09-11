import React, { useState, useEffect } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import OfficeSelector from './components/OfficeSelector';
import TimeRangePicker from './components/TimeRangePicker';
import KPICard from './components/KPICard';
import RevenueTrendsChart from './components/RevenueTrendsChart';
import ExpenseCategoryChart from './components/ExpenseCategoryChart';
import ProviderProductivityChart from './components/ProviderProductivityChart';
import ActivityFeed from './components/ActivityFeed';
import TransactionGrid from './components/TransactionGrid';
import ExportControls from './components/ExportControls';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { getAccessibleOffices } from '../../services/dashboardService';
import GoalDonutChart from '../executive-overview/components/GoalDonutChart';
import { getGoalAchievement } from '../../services/goalsService';
import { format, startOfMonth, subDays, startOfWeek, endOfWeek, subWeeks, startOfQuarter, subQuarters, startOfYear, subYears, endOfMonth, subMonths } from 'date-fns';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useNavigate } from 'react-router-dom';
import { ascendApi } from '../../services/ascendApi';
import { getLastNMonths, monthLabel } from '../../services/kpiService';
import ProductionCollectionsPanel from '../../components/ProductionCollectionsPanel';
import { getLocationIdByOfficeId } from '../../constants/offices';
import DentrixDataSourceBanner from '../../components/DentrixDataSourceBanner';
import DentrixYearComparisonPanel from './components/DentrixYearComparisonPanel';
import { fetchWFAmexOperatingExpenses } from '../../services/expenseReportService';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── V281: Null-preserving parse helpers ─────────────────────────────────────
// These helpers return null (not 0) when the value is missing/null/undefined/NaN.
// Real backend 0 is preserved as 0.
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
// Format currency — returns '—' for null, '$0.00' for real 0
const fmtCurrency = (val) => {
  if (val === null || val === undefined) return '—';
  return `$${val?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
// Format percent — returns 'N/A' for null
const fmtPct = (val) => {
  if (val === null || val === undefined) return 'N/A';
  return `${val}%`;
};
// Format integer count — returns 'N/A' for null
const fmtCount = (val) => {
  if (val === null || val === undefined) return 'N/A';
  return val?.toString();
};
// ─────────────────────────────────────────────────────────────────────────────

const OfficePerformance = () => {
  const { userProfile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading, permissionsMap } = useRolePermissions();
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [selectedRange, setSelectedRange] = useState('this_month');
  const [activeTab, setActiveTab] = useState('revenue');
  const [chartType, setChartType] = useState('line');
  const [isLoading, setIsLoading] = useState(true);
  const [accessibleOffices, setAccessibleOffices] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [goalData, setGoalData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveKPIs, setLiveKPIs] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [officeManuallySelected, setOfficeManuallySelected] = useState(false);
  const [monthlyTrendData, setMonthlyTrendData] = useState([]);
  // V281: Track real API success/failure for DentrixDataSourceBanner
  const [dentrixApiStatus, setDentrixApiStatus] = useState(null); // null=loading, true=ok, false=fail
  const [dentrixApiError, setDentrixApiError] = useState(null);
  // V285: Custom date range state
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customRangeError, setCustomRangeError] = useState('');
  // V286: WF/AmEx expense ratio state
  const [expenseRatioData, setExpenseRatioData] = useState(null); // { amexExpense, wfBankingExpense, totalWFAmexExpense, error }
  const [expenseRatioLoading, setExpenseRatioLoading] = useState(false);

  // Page-level guard: replace navigate redirect with AccessDenied panel
  if (!permLoading && userProfile && permissionsMap && Object.keys(permissionsMap)?.length > 0 && !hasPermission('performance:office_view') && !hasPermission('performance.office_performance.view')) {
    return <AccessDenied message="Office Performance is restricted. Contact your administrator to request access." />;
  }

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Office Performance' }
  ];

  // Load accessible offices based on user role
  useEffect(() => {
    const loadOffices = async () => {
      if (profileLoading) return;
      if (!userProfile) {
        setAccessibleOffices([]);
        setOfficesLoading(false);
        return;
      }
      setOfficesLoading(true);
      try {
        const offices = await getAccessibleOffices(userProfile);
        setAccessibleOffices(offices);
        if (offices?.length > 0 && !officeManuallySelected) {
          setSelectedOffice(offices?.[0]?.id);
        }
      } catch (err) {
        console.error('Failed to load offices:', err);
        setAccessibleOffices([]);
      } finally {
        setOfficesLoading(false);
      }
    };
    loadOffices();
  }, [userProfile, profileLoading]);

  // Load goal data when office or date range changes
  useEffect(() => {
    if (!selectedOffice) return;
    const loadGoal = async () => {
      try {
        const now = new Date();
        let goalMonth;
        if (selectedRange === 'last_month') {
          const lastMonth = subMonths(now, 1);
          goalMonth = format(startOfMonth(lastMonth), 'yyyy-MM');
        } else if (selectedRange === 'custom' && customStart) {
          // V285: For custom range, use the start date's month as the goal month
          goalMonth = customStart?.substring(0, 7);
        } else {
          goalMonth = format(now, 'yyyy-MM');
        }
        const data = await getGoalAchievement(selectedOffice, goalMonth);
        setGoalData(data);
      } catch (err) {
        console.warn('Could not load goal data:', err?.message);
      }
    };
    loadGoal();
  }, [selectedOffice, selectedRange, customStart]);

  // V281: Load live KPI data — null-preserving, no gross/UCR fallback for net production
  useEffect(() => {
    if (!selectedOffice) return;
    const loadLiveKPIs = async () => {
      setKpiLoading(true);
      setDentrixApiStatus(null);
      setDentrixApiError(null);
      try {
        const now = new Date();
        let start, end;
        if (selectedRange === 'today') {
          start = format(now, 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'yesterday') {
          const yesterday = subDays(now, 1);
          start = format(yesterday, 'yyyy-MM-dd');
          end = format(yesterday, 'yyyy-MM-dd');
        } else if (selectedRange === 'this_week') {
          start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'last_week') {
          const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
          const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
          start = format(lastWeekStart, 'yyyy-MM-dd');
          end = format(lastWeekEnd, 'yyyy-MM-dd');
        } else if (selectedRange === 'this_month') {
          start = format(startOfMonth(now), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'last_month') {
          const lastMonth = subMonths(now, 1);
          start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
          end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        } else if (selectedRange === 'last_30') {
          start = format(subDays(now, 30), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'last_90') {
          start = format(subDays(now, 90), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'this_quarter') {
          start = format(startOfQuarter(now), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'last_quarter') {
          const lastQ = subQuarters(now, 1);
          start = format(startOfQuarter(lastQ), 'yyyy-MM-dd');
          end = format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd');
        } else if (selectedRange === 'this_year') {
          start = format(startOfYear(now), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        } else if (selectedRange === 'last_year') {
          const lastYear = subYears(now, 1);
          start = format(startOfYear(lastYear), 'yyyy-MM-dd');
          end = format(new Date(lastYear.getFullYear(), 11, 31), 'yyyy-MM-dd');
        } else if (selectedRange === 'custom') {
          // V285: Only fetch when both custom dates are valid
          if (customStart && customEnd && customStart <= customEnd) {
            start = customStart;
            end = customEnd;
          } else {
            // Incomplete or invalid custom range — skip fetch
            setKpiLoading(false);
            return;
          }
        } else {
          start = format(startOfMonth(now), 'yyyy-MM-dd');
          end = format(now, 'yyyy-MM-dd');
        }

        const dentrixLocationId = getLocationIdByOfficeId(selectedOffice);
        if (!dentrixLocationId) {
          console.warn('[OfficePerformance] No Dentrix locationId found for office:', selectedOffice);
          setLiveKPIs(null);
          setDentrixApiStatus(false);
          setDentrixApiError('Office not mapped to Dentrix location');
          setKpiLoading(false);
          return;
        }

        // V281: Fetch all three core Dentrix calls; track individual success/failure
        const [prodResult, collResult, patientsResult] = await Promise.allSettled([
          ascendApi?.getProduction(start, end, dentrixLocationId),
          ascendApi?.getCollections(start, end, dentrixLocationId),
          ascendApi?.getPatients(start, end, dentrixLocationId),
        ]);

        const prodOk = prodResult?.status === 'fulfilled';
        const collOk = collResult?.status === 'fulfilled';
        const patientsOk = patientsResult?.status === 'fulfilled';

        const prod = prodOk ? prodResult?.value : null;
        const coll = collOk ? collResult?.value : null;
        const patients = patientsOk ? patientsResult?.value : null;

        // V281 FIX #1: netProduction ONLY — no grossProduction/UCR fallback
        // If netProduction is missing/null → null (will render N/A / —)
        const netProduction = safeFloat(prod?.netProduction);

        // Collections — null-preserving, Math.abs only when value exists
        const rawCollections = safeFloat(coll?.totalCollections);
        const totalCollections = rawCollections !== null ? Math.abs(rawCollections) : null;

        // New patients — null-preserving
        const newPatients = safeInt(patients?.newPatients);

        // V281 FIX #2: Collection % — N/A when either value is missing
        // Real formula: actual collections ÷ actual net production
        let collectionRate = null;
        if (netProduction !== null && netProduction > 0 && totalCollections !== null) {
          collectionRate = ((totalCollections / netProduction) * 100)?.toFixed(1);
        }

        // V281: Banner is green only if all three core calls succeeded AND returned usable data
        const allCoreCallsOk = prodOk && collOk && patientsOk;
        const hasUsableData = prod !== null || coll !== null || patients !== null;
        if (allCoreCallsOk && hasUsableData) {
          setDentrixApiStatus(true);
          setDentrixApiError(null);
        } else {
          const failedCalls = [
            !prodOk && 'production summary',
            !collOk && 'collections summary',
            !patientsOk && 'patients summary',
          ]?.filter(Boolean);
          setDentrixApiStatus(false);
          setDentrixApiError(
            failedCalls?.length > 0
              ? `API call(s) failed: ${failedCalls?.join(', ')}`
              : 'One or more required fields missing'
          );
        }

        setLiveKPIs({
          _source: 'dentrix_ascend_fastapi',
          _dentrixLocationId: dentrixLocationId,
          totals: {
            // V281: netProduction only — null if missing
            netProduction,
            collection: totalCollections,
            new_patients: newPatients,
            collectionRate,
            // V286: expenseRatio computed separately via fetchWFAmexOperatingExpenses
            expenseRatio: null,
            expenses: null,
          },
          // V281 FIX #6: pendingApprovals — no hardcoded 0; null = source not wired
          pendingApprovals: null,
          // V286: store netProduction for expense ratio calculation
          _netProduction: netProduction,
        });
      } catch (err) {
        console.warn('[OfficePerformance] Failed to load live KPIs from Dentrix:', err?.message);
        setLiveKPIs(null);
        setDentrixApiStatus(false);
        setDentrixApiError(err?.message || 'Dentrix API unavailable');
      } finally {
        setKpiLoading(false);
      }
    };
    loadLiveKPIs();
  }, [selectedOffice, selectedRange, refreshKey, customStart, customEnd]);

  // V286: Fetch WF/AmEx operating expenses for Expense Ratio KPI
  useEffect(() => {
    if (!selectedOffice) return;
    const { start: rangeStartVal, end: rangeEndVal } = (() => {
      const now = new Date();
      if (selectedRange === 'today') {
        const d = format(now, 'yyyy-MM-dd');
        return { start: d, end: d };
      } else if (selectedRange === 'yesterday') {
        const d = format(subDays(now, 1), 'yyyy-MM-dd');
        return { start: d, end: d };
      } else if (selectedRange === 'this_week') {
        return { start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_week') {
        return { start: format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      } else if (selectedRange === 'this_month') {
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_month') {
        const lm = subMonths(now, 1);
        return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_30') {
        return { start: format(subDays(now, 30), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_90') {
        return { start: format(subDays(now, 90), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'this_quarter') {
        return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_quarter') {
        const lq = subQuarters(now, 1);
        return { start: format(startOfQuarter(lq), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd') };
      } else if (selectedRange === 'this_year') {
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      } else if (selectedRange === 'last_year') {
        const ly = subYears(now, 1);
        return { start: format(startOfYear(ly), 'yyyy-MM-dd'), end: format(new Date(ly.getFullYear(), 11, 31), 'yyyy-MM-dd') };
      } else if (selectedRange === 'custom') {
        if (customStart && customEnd && customStart <= customEnd) {
          return { start: customStart, end: customEnd };
        }
        return { start: null, end: null };
      }
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    })();

    if (!rangeStartVal || !rangeEndVal) {
      setExpenseRatioData(null);
      return;
    }

    const loadExpenseRatio = async () => {
      setExpenseRatioLoading(true);
      try {
        const result = await fetchWFAmexOperatingExpenses({
          startDate: rangeStartVal,
          endDate: rangeEndVal,
          officeIds: [selectedOffice],
        });
        setExpenseRatioData(result);
      } catch (err) {
        console.warn('[OfficePerformance] WF/AmEx expense fetch failed:', err?.message);
        setExpenseRatioData({ amexExpense: null, wfBankingExpense: null, totalWFAmexExpense: null, error: err?.message || 'Expense fetch failed' });
      } finally {
        setExpenseRatioLoading(false);
      }
    };
    loadExpenseRatio();
  }, [selectedOffice, selectedRange, refreshKey, customStart, customEnd]);

  // V281 FIX #8: Revenue Trends — null gaps instead of fake zeros
  useEffect(() => {
    const loadMonthlyTrend = async () => {
      try {
        const now = new Date();
        const months = getLastNMonths(12);
        const dentrixLocationId = selectedOffice ? getLocationIdByOfficeId(selectedOffice) : null;
        const currentMonthStr = format(now, 'yyyy-MM');

        const results = await Promise.allSettled(
          months?.map(({ year, month }) => {
            const startDate = `${year}-${String(month)?.padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0)?.getDate();
            const endDate = `${year}-${String(month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
            const monthStr = `${year}-${String(month)?.padStart(2, '0')}`;
            const isCurrentMonth = monthStr === currentMonthStr;
            const label = isCurrentMonth
              ? `${monthLabel(year, month)} (partial)`
              : monthLabel(year, month);

            return Promise.all([
              ascendApi?.getProduction(startDate, endDate, dentrixLocationId)?.catch(() => null),
              ascendApi?.getCollections(startDate, endDate, dentrixLocationId)?.catch(() => null),
            ])?.then(([prod, coll]) => {
              // V281 FIX #8: netProduction only — null for failed/missing months (chart gap)
              // No fallback to prod.production or 0
              const netProd = safeFloat(prod?.netProduction);
              const rawColl = safeFloat(coll?.totalCollections ?? coll?.collections);
              const totalColl = rawColl !== null ? Math.abs(rawColl) : null;

              return {
                date: label,
                // null values render as chart gaps, not fake zero bars/points
                production: netProd,
                collections: totalColl,
              };
            });
          })
        );
        const trendPoints = results
          ?.filter((r) => r?.status === 'fulfilled')
          ?.map((r) => r?.value);
        setMonthlyTrendData(trendPoints);
      } catch (err) {
        console.warn('[OfficePerformance] Monthly trend fetch error:', err);
      }
    };
    loadMonthlyTrend();
  }, [refreshKey, selectedOffice]);

  // Listen for bulk import completion to trigger live KPI refresh
  useEffect(() => {
    const handleDailyEntriesUpdated = (e) => {
      setRefreshKey(k => k + 1);
      if (selectedOffice) {
        const now = new Date();
        let goalMonth = selectedRange === 'last_month'
          ? format(startOfMonth(subMonths(now, 1)), 'yyyy-MM')
          : format(now, 'yyyy-MM');
        getGoalAchievement(selectedOffice, goalMonth)?.then(data => setGoalData(data))?.catch(() => {});
      }
    };
    window.addEventListener('daily-entries-updated', handleDailyEntriesUpdated);
    return () => window.removeEventListener('daily-entries-updated', handleDailyEntriesUpdated);
  }, [selectedOffice]);

  // Real-time subscriptions for financial data
  const { isPulsing, isConnected: rtConnected } = useRealtimeSubscription(
    [
      { table: 'revenue_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
      { table: 'expense_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
      { table: 'daily_entries', events: ['INSERT', 'UPDATE', 'DELETE'] },
    ],
    () => {
      setRefreshKey(k => k + 1);
      if (selectedOffice) {
        const now = new Date();
        let goalMonth = selectedRange === 'last_month'
          ? format(startOfMonth(subMonths(now, 1)), 'yyyy-MM')
          : format(now, 'yyyy-MM');
        getGoalAchievement(selectedOffice, goalMonth)?.then(data => setGoalData(data))?.catch(() => {});
      }
    },
    !!selectedOffice
  );

  const officeOptions = accessibleOffices?.map(o => ({
    value: o?.id,
    label: o?.name
  }));

  const canSelectOffice = accessibleOffices?.length > 1;

  // V281: KPI cards — null-preserving display, no fake $0 / 0%
  // V286: Expense Ratio — computed from WF/AmEx operating expenses ÷ Dentrix netProduction
  const netProductionForRatio = liveKPIs?.totals?.netProduction ?? null;
  const wfAmexTotal = expenseRatioData?.totalWFAmexExpense ?? null;
  const expenseRatioError = expenseRatioData?.error ?? null;

  // Compute ratio: (amexExpense + wfBankingExpense) ÷ netProduction × 100
  // N/A if: netProduction is null/0, or expense data failed, or either component is null
  let computedExpenseRatio = null;
  if (
    !expenseRatioError &&
    wfAmexTotal !== null &&
    netProductionForRatio !== null &&
    netProductionForRatio > 0
  ) {
    computedExpenseRatio = ((wfAmexTotal / netProductionForRatio) * 100)?.toFixed(1);
  }

  const kpiData = [
    {
      title: 'Total Collections',
      // null → '—', real 0 → '$0'
      value: liveKPIs?.totals?.collection !== null && liveKPIs?.totals?.collection !== undefined
        ? fmtCurrency(liveKPIs?.totals?.collection)
        : (kpiLoading ? '…' : '—'),
      change: liveKPIs?.totals?.collectionRate !== null && liveKPIs?.totals?.collectionRate !== undefined
        ? `${liveKPIs?.totals?.collectionRate}% collection rate`
        : 'No data yet',
      changeType: liveKPIs?.totals?.collection > 0 ? 'positive' : 'neutral',
      icon: 'DollarSign',
      iconColor: 'var(--color-success)',
      threshold: 'good'
    },
    {
      // V281 FIX #3: Renamed from "Doctor Production" → "Net Production"
      // Value is office-level net production, not doctor-specific
      title: 'Net Production',
      value: liveKPIs?.totals?.netProduction !== null && liveKPIs?.totals?.netProduction !== undefined
        ? fmtCurrency(liveKPIs?.totals?.netProduction)
        : (kpiLoading ? '…' : '—'),
      change: liveKPIs?.totals?.netProduction !== null && liveKPIs?.totals?.netProduction !== undefined
        ? 'Dentrix Ascend / Production Summary' :'No data yet',
      changeType: liveKPIs?.totals?.netProduction > 0 ? 'positive' : 'neutral',
      icon: 'UserCheck',
      iconColor: 'var(--color-primary)',
      threshold: 'good'
    },
    {
      title: 'Collection %',
      // V281 FIX #2: N/A when netProduction or collections is missing
      value: liveKPIs?.totals?.collectionRate !== null && liveKPIs?.totals?.collectionRate !== undefined
        ? fmtPct(liveKPIs?.totals?.collectionRate)
        : (kpiLoading ? '…' : 'N/A'),
      change: liveKPIs?.totals?.collectionRate !== null
        ? 'Collections ÷ Net Production' :'Requires net production data',
      changeType: parseFloat(liveKPIs?.totals?.collectionRate) >= 90 ? 'positive' : 'neutral',
      icon: 'TrendingUp',
      iconColor: 'var(--color-accent)',
      threshold: 'good'
    },
    {
      title: 'New Patients',
      value: liveKPIs?.totals?.new_patients !== null && liveKPIs?.totals?.new_patients !== undefined
        ? fmtCount(liveKPIs?.totals?.new_patients)
        : (kpiLoading ? '…' : 'N/A'),
      // V281 FIX #4: Truthful source label — data comes from Dentrix /v2/patients/summary
      change: liveKPIs?.totals?.new_patients !== null
        ? 'Dentrix Ascend / Patients Summary' :'No data yet',
      changeType: liveKPIs?.totals?.new_patients > 0 ? 'positive' : 'neutral',
      icon: 'Users',
      iconColor: 'var(--color-secondary)',
      threshold: 'good'
    },
    {
      title: 'Expense Ratio',
      // V286: WF/AmEx operating expense ratio — truthful label, payroll excluded
      value: expenseRatioLoading
        ? '…'
        : computedExpenseRatio !== null
          ? `${computedExpenseRatio}%`
          : 'N/A',
      change: expenseRatioLoading
        ? 'Loading WF/AmEx expenses…'
        : expenseRatioError
          ? 'Expense data unavailable — check source'
          : computedExpenseRatio !== null
            ? `WF/AmEx Expenses: ${fmtCurrency(wfAmexTotal)} ÷ Net Production`
            : netProductionForRatio === null || netProductionForRatio === 0
              ? 'Net production required for ratio'
              : 'No posted WF/AmEx expenses found',
      changeType: expenseRatioError ? 'neutral' : computedExpenseRatio !== null ? 'neutral' : 'neutral',
      icon: 'TrendingDown',
      iconColor: 'var(--color-warning)',
      threshold: 'good',
      // V286: source note and payroll exclusion note passed as subtitle if KPICard supports it
      subtitle: computedExpenseRatio !== null
        ? 'Source: WF/AmEx posted operating expenses ÷ Dentrix net production. Payroll/Gusto not included in this ratio to avoid double-counting; payroll mapping pending.'
        : expenseRatioError
          ? 'WF/AmEx expense source unavailable. Verify posted expense rows exist for this period.'
          : null,
    },
    {
      title: 'Pending Approvals',
      // V281 FIX #6: No hardcoded 0 — source not wired
      value: 'N/A',
      change: 'Source Not Wired',
      changeType: 'neutral',
      icon: 'Clock',
      iconColor: 'var(--color-muted-foreground)',
      threshold: 'good'
    }
  ];

  const revenueTrendsData = monthlyTrendData?.length > 0 ? monthlyTrendData : (liveKPIs?.trend || []);

  const expenseCategoryData = [];
  const activityFeedData = [];
  const transactionData = [];

  // Derive date range strings for the selected time range
  const getDateRange = () => {
    const now = new Date();
    let start, end;
    if (selectedRange === 'today') {
      start = format(now, 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'yesterday') {
      const yesterday = subDays(now, 1);
      start = format(yesterday, 'yyyy-MM-dd');
      end = format(yesterday, 'yyyy-MM-dd');
    } else if (selectedRange === 'this_week') {
      start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'last_week') {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      start = format(lastWeekStart, 'yyyy-MM-dd');
      end = format(lastWeekEnd, 'yyyy-MM-dd');
    } else if (selectedRange === 'this_month') {
      start = format(startOfMonth(now), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'last_month') {
      const lastMonth = subMonths(now, 1);
      start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    } else if (selectedRange === 'last_30') {
      start = format(subDays(now, 30), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'last_90') {
      start = format(subDays(now, 90), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'this_quarter') {
      start = format(startOfQuarter(now), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'last_quarter') {
      const lastQ = subQuarters(now, 1);
      start = format(startOfQuarter(lastQ), 'yyyy-MM-dd');
      end = format(endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1)), 'yyyy-MM-dd');
    } else if (selectedRange === 'this_year') {
      start = format(startOfYear(now), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    } else if (selectedRange === 'last_year') {
      const lastYear = subYears(now, 1);
      start = format(startOfYear(lastYear), 'yyyy-MM-dd');
      end = format(new Date(lastYear.getFullYear(), 11, 31), 'yyyy-MM-dd');
    } else if (selectedRange === 'custom') {
      // V285: Use custom dates only when both are valid and end >= start
      if (customStart && customEnd && customStart <= customEnd) {
        start = customStart;
        end = customEnd;
      } else {
        // Incomplete or invalid custom range — return null to prevent fetching
        return { start: null, end: null };
      }
    } else {
      start = format(startOfMonth(now), 'yyyy-MM-dd');
      end = format(now, 'yyyy-MM-dd');
    }
    return { start, end };
  };

  // V285: Handler for range dropdown change — preserve custom dates in session
  const handleRangeChange = (val) => {
    setSelectedRange(val);
    // Clear validation error when switching presets
    if (val !== 'custom') {
      setCustomRangeError('');
    }
  };

  // V285: Handler for custom start date change
  const handleCustomStartChange = (val) => {
    setCustomStart(val);
    if (val && customEnd && val > customEnd) {
      setCustomRangeError('Start date must be on or before end date.');
    } else {
      setCustomRangeError('');
    }
  };

  // V285: Handler for custom end date change
  const handleCustomEndChange = (val) => {
    setCustomEnd(val);
    if (customStart && val && customStart > val) {
      setCustomRangeError('End date must be on or after start date.');
    } else {
      setCustomRangeError('');
    }
  };

  const isDailyRange = selectedRange === 'today' || selectedRange === 'yesterday';
  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const resolvedLocationId = selectedOffice ? getLocationIdByOfficeId(selectedOffice) : null;

  useEffect(() => {
    if (officesLoading) return;
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedOffice, selectedRange, officesLoading]);

  const handleEditTransaction = (id) => {
    console.log('Editing transaction:', id);
  };

  const handleBulkAction = (action) => {
    console.log('Bulk action:', action);
  };

  const handleExport = (options) => {
    console.log('Exporting report:', options);
  };

  const selectedOfficeName = accessibleOffices?.find(o => o?.id === selectedOffice)?.name || '';

  if (officesLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="main-content">
          <div className="loading-overlay">
            <div className="flex flex-col items-center gap-4">
              <div className="loading-spinner"></div>
              <p className="text-sm text-muted-foreground">Loading office performance data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (accessibleOffices?.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="main-content">
          <Breadcrumb items={breadcrumbItems} />
          <div className="px-4 md:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
            <Icon name="Building2" size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Office Assigned</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You are not currently assigned to any office. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="main-content">
        <Breadcrumb items={breadcrumbItems} />
        
        <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-foreground mb-2">
                  Office Performance Dashboard
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm md:text-base text-muted-foreground">
                    Detailed financial analytics and operational insights for practice management
                  </p>
                  {selectedOfficeName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Icon name="Building2" size={12} />
                      {selectedOfficeName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" iconName="RefreshCw" iconSize={16}>
                  Refresh Data
                </Button>
                <Button variant="default" iconName="Download" iconSize={16}>
                  Export Report
                </Button>
              </div>
            </div>
          </div>

          {/* Goal Donut Chart — V280 behavior: separate production/collection goals */}
          {selectedOffice && (
            <GoalDonutChart
              officeId={selectedOffice}
              officeName={selectedOfficeName}
              monthYear={(() => {
                const now = new Date();
                if (selectedRange === 'last_month') return format(startOfMonth(subMonths(now, 1)), 'yyyy-MM');
                return format(now, 'yyyy-MM');
              })()}
            />
          )}

          {/* V281 FIX #7: DentrixDataSourceBanner — real API success/failure, not hardcoded true */}
          <DentrixDataSourceBanner
            dentrixAvailable={kpiLoading ? null : dentrixApiStatus}
            dentrixError={dentrixApiError}
            officeName={selectedOfficeName || null}
            locationId={resolvedLocationId}
            startDate={rangeStart}
            endDate={rangeEnd}
            compact={false}
          />

          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-wrap">
              {canSelectOffice && officeOptions?.length > 1 ? (
                <OfficeSelector
                  selectedOffice={selectedOffice}
                  onOfficeChange={(val) => {
                    setOfficeManuallySelected(true);
                    setSelectedOffice(val);
                  }}
                  offices={officeOptions}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Building2" size={16} color="var(--color-primary)" />
                  <span className="font-medium text-foreground">{selectedOfficeName}</span>
                </div>
              )}
              <div className="h-8 w-px bg-border hidden lg:block"></div>
              {/* V283: Global provider filter removed — provider filtering lives inside
                  Financial Analytics → Productivity tab only (ProviderProductivityChart).
                  Office-level KPIs, production panel, revenue trends, and year comparison
                  are not affected by provider filter. */}
              <TimeRangePicker
                selectedRange={selectedRange}
                onRangeChange={handleRangeChange}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={handleCustomStartChange}
                onCustomEndChange={handleCustomEndChange}
                customRangeError={customRangeError}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {kpiData?.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </div>

          {/* Production & Collections Panel — 6 fields from middleware API */}
          {resolvedLocationId && (
          <ProductionCollectionsPanel
            mode={isDailyRange ? 'daily' : 'monthly'}
            date={isDailyRange ? rangeStart : undefined}
            startDate={!isDailyRange ? rangeStart : undefined}
            endDate={!isDailyRange ? rangeEnd : undefined}
            locationIdProp={resolvedLocationId}
            officeId={selectedOffice}
            periodLabel={selectedRange}
            onDataLoaded={() => {}}
          />
          )}

          {/* V282: Dentrix-backed Year Comparison — replaces V281 amber notice */}
          <DentrixYearComparisonPanel
            selectedOffice={selectedOffice}
            selectedOfficeName={selectedOfficeName}
            selectedRange={selectedRange}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-lg md:text-xl font-semibold text-foreground">Financial Analytics</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={activeTab === 'revenue' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveTab('revenue')}
                    >
                      Revenue Trends
                    </Button>
                    <Button
                      variant={activeTab === 'expenses' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveTab('expenses')}
                    >
                      Expenses
                    </Button>
                    <Button
                      variant={activeTab === 'productivity' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveTab('productivity')}
                    >
                      Productivity
                    </Button>
                  </div>
                </div>

                {activeTab === 'revenue' && (
                  <div>
                    <div className="flex items-center justify-end gap-2 mb-4">
                      <Button
                        variant={chartType === 'line' ? 'default' : 'outline'}
                        size="sm"
                        iconName="TrendingUp"
                        onClick={() => setChartType('line')}
                      >
                        Line
                      </Button>
                      <Button
                        variant={chartType === 'bar' ? 'default' : 'outline'}
                        size="sm"
                        iconName="BarChart3"
                        onClick={() => setChartType('bar')}
                      >
                        Bar
                      </Button>
                    </div>
                    <RevenueTrendsChart data={revenueTrendsData} chartType={chartType} goalData={goalData} />
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <ExpenseCategoryChart data={expenseCategoryData} />
                )}

                {activeTab === 'productivity' && (
                  <ProviderProductivityChart
                    selectedOffice={selectedOffice}
                    selectedOfficeName={selectedOfficeName}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    resolvedLocationId={resolvedLocationId}
                  />
                )}
              </div>

              <TransactionGrid
                transactions={transactionData}
                onEdit={handleEditTransaction}
                onBulkAction={handleBulkAction}
              />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <ActivityFeed activities={activityFeedData} />
              <ExportControls onExport={handleExport} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficePerformance;