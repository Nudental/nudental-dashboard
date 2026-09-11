import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ascendApi } from '../../services/ascendApi';
import { fetchExpenseKPIs } from '../../services/expenseReportService';
import ComparisonDateRangePicker from './components/ComparisonDateRangePicker';
import CollectionExpenseBarChart from './components/CollectionExpenseBarChart';
import NetProfitLineChart from './components/NetProfitLineChart';
import YTDLeaderboardTable from './components/YTDLeaderboardTable';
import RoleAccessBanner from './components/RoleAccessBanner';
import useHomeNavigation from '../../hooks/useHomeNavigation';
import { LOCATION_ID_MAP } from '../../constants/offices';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDateRange = (preset, customStart, customEnd) => {
  const now = new Date();
  const year = now?.getFullYear();
  const month = now?.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        start: new Date(year, month, 1)?.toISOString()?.split('T')?.[0],
        end: new Date(year, month + 1, 0)?.toISOString()?.split('T')?.[0],
      };
    case 'last_month':
      return {
        start: new Date(year, month - 1, 1)?.toISOString()?.split('T')?.[0],
        end: new Date(year, month, 0)?.toISOString()?.split('T')?.[0],
      };
    case 'last_quarter': {
      const qStart = month - (month % 3) - 3;
      return {
        start: new Date(year, qStart, 1)?.toISOString()?.split('T')?.[0],
        end: new Date(year, qStart + 3, 0)?.toISOString()?.split('T')?.[0],
      };
    }
    case 'ytd':
      return {
        start: `${year}-01-01`,
        end: now?.toISOString()?.split('T')?.[0],
      };
    case 'custom':
      return { start: customStart || `${year}-01-01`, end: customEnd || now?.toISOString()?.split('T')?.[0] };
    default:
      return {
        start: new Date(year, month, 1)?.toISOString()?.split('T')?.[0],
        end: new Date(year, month + 1, 0)?.toISOString()?.split('T')?.[0],
      };
  }
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Safely extract totalCollections from ascendApi.getCollections response.
 * Handles multiple API response shapes.
 * Returns null if the call failed or the field is missing/NaN.
 */
const extractCollections = (result) => {
  if (!result) return null;

  let v = result?.totalCollections ?? result?.total_collections ?? null;

  if (v === null && result?.collections !== null && result?.collections !== undefined) {
    if (typeof result?.collections === 'object') {
      v = result?.collections?.total ?? result?.collections?.totalCollections ?? null;
    } else {
      v = result?.collections;
    }
  }

  if (v === null && result?.data) {
    v = result?.data?.totalCollections
      ?? result?.data?.total_collections
      ?? result?.data?.collections?.total
      ?? result?.data?.collections
      ?? null;
  }

  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const OfficeComparison = () => {
  const { userProfile } = useAuth();
  const goHome = useHomeNavigation();
  const [dateRange, setDateRange] = useState({ preset: 'this_month', startDate: null, endDate: null });
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState([]);
  const [officesLoaded, setOfficesLoaded] = useState(false);

  // Summary card state
  const [totalCollections, setTotalCollections] = useState(null);
  const [totalExpenses, setTotalExpenses] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Chart data
  const [barChartData, setBarChartData] = useState([]);
  const [lineChartData, setLineChartData] = useState([]);
  const [ytdData, setYtdData] = useState([]);
  const [error, setError] = useState(null);

  // Selected office for single-office view (null = All Offices)
  const [selectedOfficeId, setSelectedOfficeId] = useState(null);

  const role = userProfile?.role;
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Reports', path: '/reports' },
    { label: 'Office Comparison' },
  ];

  // ── Load accessible offices ──────────────────────────────────────────────
  useEffect(() => {
    const loadOffices = async () => {
      if (!userProfile) return;
      try {
        if (isSuperAdmin || isAdmin) {
          const { data, error } = await supabase
            ?.from('offices')
            ?.select('id, name')
            ?.eq('is_active', true)
            ?.order('name');
          if (error) throw error;
          setOffices(data || []);
        } else {
          const { data: assignments } = await supabase
            ?.from('user_office_assignments')
            ?.select('office_id, offices(id, name)')
            ?.eq('user_id', userProfile?.id);

          if (assignments?.length > 0) {
            const assignedOffices = assignments?.map(a => a?.offices)?.filter(Boolean);
            setOffices(assignedOffices);
          } else if (userProfile?.office_id) {
            const { data: office } = await supabase
              ?.from('offices')
              ?.select('id, name')
              ?.eq('id', userProfile?.office_id)
              ?.single();
            setOffices(office ? [office] : []);
          }
        }
      } catch (err) {
        console.error('[OfficeComparison] Failed to load offices:', err);
        setOffices([]);
      } finally {
        setOfficesLoaded(true);
      }
    };
    loadOffices();
  }, [userProfile, isSuperAdmin, isAdmin]);

  // ── Load financial data using verified sources ───────────────────────────
  const loadData = useCallback(async () => {
    if (!officesLoaded) return;

    if (!offices?.length) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);

    const { start, end } = getDateRange(dateRange?.preset, dateRange?.startDate, dateRange?.endDate);
    const newWarnings = [];

    // Determine which offices to show based on selectedOfficeId
    const activeOffices = selectedOfficeId
      ? offices?.filter(o => o?.id === selectedOfficeId)
      : offices;

    try {
      // ── 1. Summary cards ─────────────────────────────────────────────────
      // For All Offices: use null locationId (all-office) and empty officeIds
      // For single-office: use that office's locationId and officeId
      let summaryCollections = null;
      let summaryExpenses = null;

      if (selectedOfficeId) {
        // Single-office view
        const locationId = LOCATION_ID_MAP?.[selectedOfficeId] || null;
        try {
          const cResult = await ascendApi?.getCollections(start, end, locationId);
          summaryCollections = extractCollections(cResult);
        } catch (err) {
          newWarnings?.push('Collections data unavailable for selected office/period.');
        }
        try {
          const kpiResult = await fetchExpenseKPIs({ startDate: start, endDate: end, officeIds: [selectedOfficeId] });
          summaryExpenses = kpiResult?.totalExpenses ?? null;
        } catch (err) {
          newWarnings?.push('Expense data unavailable for selected office/period.');
        }
      } else {
        // All Offices view
        try {
          const cResult = await ascendApi?.getCollections(start, end, null);
          summaryCollections = extractCollections(cResult);
        } catch (err) {
          newWarnings?.push('Collections data unavailable for selected period.');
        }
        try {
          const kpiResult = await fetchExpenseKPIs({ startDate: start, endDate: end, officeIds: [] });
          summaryExpenses = kpiResult?.totalExpenses ?? null;
        } catch (err) {
          newWarnings?.push('Expense data unavailable for selected period.');
        }
      }

      setTotalCollections(summaryCollections);
      setTotalExpenses(summaryExpenses);

      // ── 2. Per-office collections + expenses for bar chart ───────────────
      // Fetch all-office expense total for shared/unallocated derivation
      let allOfficeExpenseTotal = null;
      if (!selectedOfficeId) {
        try {
          const kpiAll = await fetchExpenseKPIs({ startDate: start, endDate: end, officeIds: [] });
          allOfficeExpenseTotal = kpiAll?.totalExpenses ?? null;
        } catch (err) {
          // already warned above
        }
      }

      const perOfficeResults = await Promise.allSettled(
        activeOffices?.map(async (office) => {
          const locationId = LOCATION_ID_MAP?.[office?.id] || null;
          let collections = null;
          let expenses = null;

          if (locationId) {
            try {
              const cResult = await ascendApi?.getCollections(start, end, locationId);
              collections = extractCollections(cResult);
            } catch (err) {
              // leave null
            }
          }

          // Per-office expenses via verified backend office-scoped endpoint
          try {
            const eResult = await fetchExpenseKPIs({ startDate: start, endDate: end, officeIds: [office?.id] });
            expenses = eResult?.totalExpenses ?? null;
          } catch (err) {
            // leave null
          }

          const netProfit = (collections !== null && expenses !== null) ? collections - expenses : null;
          const margin = (netProfit !== null && collections !== null && collections > 0)
            ? (netProfit / collections) * 100
            : null;

          return {
            officeId: office?.id,
            officeName: office?.name,
            collections,
            expenses,
            netProfit,
            margin,
          };
        })
      );

      const barData = perOfficeResults?.map(r =>
        r?.status === 'fulfilled' ? r?.value : { officeName: '?', collections: null, expenses: null, netProfit: null, margin: null }
      );

      // Derive unallocated/shared if All Offices view
      if (!selectedOfficeId && allOfficeExpenseTotal !== null) {
        const sumOfficeExpenses = barData?.reduce((sum, d) => {
          return d?.expenses !== null ? sum + d?.expenses : sum;
        }, 0);
        const hasAllOfficeExpenses = barData?.every(d => d?.expenses !== null);
        if (hasAllOfficeExpenses) {
          const shared = allOfficeExpenseTotal - sumOfficeExpenses;
          if (shared > 0.01) {
            barData?.push({
              officeId: '__shared__',
              officeName: 'Corporate / Shared Expense',
              collections: null,
              expenses: shared,
              netProfit: null,
              margin: null,
              isShared: true,
            });
          }
        }
      }

      setBarChartData(barData);

      // ── 3. Monthly net profit trend ──────────────────────────────────────
      const startDt = new Date(start + 'T00:00:00');
      const endDt = new Date(end + 'T00:00:00');
      const months = [];
      const cur = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
      while (cur <= endDt) {
        months?.push({ year: cur?.getFullYear(), month: cur?.getMonth() });
        cur?.setMonth(cur?.getMonth() + 1);
      }

      const monthlyResults = await Promise.allSettled(
        months?.map(async ({ year, month }) => {
          const mStart = new Date(year, month, 1)?.toISOString()?.split('T')?.[0];
          const mEnd = new Date(year, month + 1, 0)?.toISOString()?.split('T')?.[0];
          const label = `${MONTH_LABELS?.[month]}${year !== new Date()?.getFullYear() ? ` ${year}` : ''}`;

          let mCollections = null;
          let mExpenses = null;

          if (selectedOfficeId) {
            const locationId = LOCATION_ID_MAP?.[selectedOfficeId] || null;
            try {
              const cResult = await ascendApi?.getCollections(mStart, mEnd, locationId);
              mCollections = extractCollections(cResult);
            } catch (e) { /* gap */ }
            try {
              const eResult = await fetchExpenseKPIs({ startDate: mStart, endDate: mEnd, officeIds: [selectedOfficeId] });
              mExpenses = eResult?.totalExpenses ?? null;
            } catch (e) { /* gap */ }
          } else {
            try {
              const cResult = await ascendApi?.getCollections(mStart, mEnd, null);
              mCollections = extractCollections(cResult);
            } catch (e) { /* gap */ }
            try {
              const eResult = await fetchExpenseKPIs({ startDate: mStart, endDate: mEnd, officeIds: [] });
              mExpenses = eResult?.totalExpenses ?? null;
            } catch (e) { /* gap */ }
          }

          const netProfit = (mCollections !== null && mExpenses !== null)
            ? mCollections - mExpenses
            : null;

          const lineKey = selectedOfficeId
            ? (activeOffices?.[0]?.name || 'Selected Office')
            : 'All Offices';

          return { month: label, [lineKey]: netProfit };
        })
      );

      const lineData = monthlyResults
        ?.map(r => r?.status === 'fulfilled' ? r?.value : null)
        ?.filter(Boolean);
      setLineChartData(lineData);

      // ── 4. YTD per-office leaderboard ────────────────────────────────────
      const ytdStart = `${new Date()?.getFullYear()}-01-01`;
      const ytdEnd = new Date()?.toISOString()?.split('T')?.[0];

      // Fetch all-office YTD expense total for shared derivation
      let ytdAllOfficeExpenses = null;
      try {
        const ytdAllKpi = await fetchExpenseKPIs({ startDate: ytdStart, endDate: ytdEnd, officeIds: [] });
        ytdAllOfficeExpenses = ytdAllKpi?.totalExpenses ?? null;
      } catch (err) { /* leave null */ }

      const ytdResults = await Promise.allSettled(
        offices?.map(async (office) => {
          const locationId = LOCATION_ID_MAP?.[office?.id] || null;
          let ytdCollections = null;
          let ytdExpenses = null;

          if (locationId) {
            try {
              const cResult = await ascendApi?.getCollections(ytdStart, ytdEnd, locationId);
              ytdCollections = extractCollections(cResult);
            } catch (err) { /* leave null */ }
          }

          try {
            const eResult = await fetchExpenseKPIs({ startDate: ytdStart, endDate: ytdEnd, officeIds: [office?.id] });
            ytdExpenses = eResult?.totalExpenses ?? null;
          } catch (err) { /* leave null */ }

          const ytdNetProfit = (ytdCollections !== null && ytdExpenses !== null)
            ? ytdCollections - ytdExpenses
            : null;
          const ytdMargin = (ytdNetProfit !== null && ytdCollections !== null && ytdCollections > 0)
            ? (ytdNetProfit / ytdCollections) * 100
            : null;

          return {
            officeId: office?.id,
            officeName: office?.name,
            ytdCollections,
            ytdExpenses,
            ytdNetProfit,
            ytdMargin,
          };
        })
      );

      const ytd = ytdResults?.map(r =>
        r?.status === 'fulfilled' ? r?.value : { officeName: '?', ytdCollections: null, ytdExpenses: null, ytdNetProfit: null, ytdMargin: null }
      );

      // Add unallocated/shared row to YTD leaderboard
      if (ytdAllOfficeExpenses !== null) {
        const sumYtdOfficeExpenses = ytd?.reduce((sum, d) => d?.ytdExpenses !== null ? sum + d?.ytdExpenses : sum, 0);
        const hasAllYtdExpenses = ytd?.every(d => d?.ytdExpenses !== null);
        if (hasAllYtdExpenses) {
          const ytdShared = ytdAllOfficeExpenses - sumYtdOfficeExpenses;
          if (ytdShared > 0.01) {
            ytd?.push({
              officeId: '__shared__',
              officeName: 'Corporate / Shared Expense',
              ytdCollections: null,
              ytdExpenses: ytdShared,
              ytdNetProfit: null,
              ytdMargin: null,
              isShared: true,
            });
          }
        }
      }

      setYtdData(ytd);

      if (newWarnings?.length) setWarnings(newWarnings);
    } catch (err) {
      console.error('[OfficeComparison] Failed to load comparison data:', err);
      setError('Failed to load comparison data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [offices, officesLoaded, dateRange, selectedOfficeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived summary values ────────────────────────────────────────────────
  const netProfit = (totalCollections !== null && totalExpenses !== null)
    ? totalCollections - totalExpenses
    : null;
  const profitMargin = (netProfit !== null && totalCollections !== null && totalCollections > 0)
    ? ((netProfit / totalCollections) * 100)?.toFixed(1)
    : null;

  const formatCurrency = (v) => {
    if (v === null || v === undefined) return '—';
    if (v >= 1000000) return `$${(v / 1000000)?.toFixed(2)}M`;
    if (v >= 1000) return `$${(v / 1000)?.toFixed(1)}K`;
    return `$${v?.toFixed(0)}`;
  };

  const selectedOfficeName = selectedOfficeId
    ? offices?.find(o => o?.id === selectedOfficeId)?.name || 'Selected Office'
    : null;

  // Determine line key for net profit chart
  const lineKey = selectedOfficeId ? (selectedOfficeName || 'Selected Office') : 'All Offices';

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-5">
            <div>
              <button
                onClick={goHome}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <Icon name="ChevronLeft" size={16} />
                Back to Home
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                <Icon name="GitCompare" size={22} color="var(--color-primary)" />
                Office Comparison
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Side-by-side analytics across all locations — collections, expenses, and profitability
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Office selector */}
              {offices?.length > 1 && (
                <select
                  value={selectedOfficeId || ''}
                  onChange={e => setSelectedOfficeId(e?.target?.value || null)}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All Offices</option>
                  {offices?.map(o => (
                    <option key={o?.id} value={o?.id}>{o?.name}</option>
                  ))}
                </select>
              )}
              <ComparisonDateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>

          {/* Source Banner — neutral, no amber guardrail */}
          <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-5 text-xs text-blue-700 dark:text-blue-300">
            <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Source:</strong> Dentrix/FastAPI collections + Finance Expense Report protected office-scoped expense totals.
              Corporate / Shared Expenses are shown separately and are not allocated to individual offices.
            </span>
          </div>

          {/* Role Access Banner */}
          <RoleAccessBanner
            role={role}
            officeCount={offices?.length}
            officeName={offices?.[0]?.name}
          />

          {/* Non-blocking warnings */}
          {warnings?.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-5">
              <Icon name="AlertTriangle" size={14} color="var(--color-warning)" className="mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                {warnings?.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-5">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={loadData}
                className="ml-auto text-xs text-destructive underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: 'Total Collections',
                value: loading ? '—' : (totalCollections !== null ? formatCurrency(totalCollections) : '—'),
                sub: selectedOfficeName ? `${selectedOfficeName} · Dentrix/FastAPI` : 'All Offices · Dentrix/FastAPI',
                icon: 'DollarSign',
                color: 'text-blue-600',
                bg: 'bg-blue-50 dark:bg-blue-950/30',
              },
              {
                label: 'Total Expenses',
                value: loading ? '—' : (totalExpenses !== null ? formatCurrency(totalExpenses) : '—'),
                sub: selectedOfficeName ? `${selectedOfficeName} · Finance Expense Report` : 'All Offices · Finance Expense Report',
                icon: 'TrendingDown',
                color: 'text-red-500',
                bg: 'bg-red-50 dark:bg-red-950/30',
              },
              {
                label: 'Net Profit',
                value: loading ? '—' : (netProfit !== null ? formatCurrency(netProfit) : '—'),
                sub: 'Collections − Expenses',
                icon: 'TrendingUp',
                color: netProfit === null ? 'text-muted-foreground' : netProfit >= 0 ? 'text-success' : 'text-destructive',
                bg: 'bg-green-50 dark:bg-green-950/30',
              },
              {
                label: 'Profit Margin',
                value: loading ? '—' : (profitMargin !== null ? `${profitMargin}%` : '—'),
                sub: 'Net Profit ÷ Collections',
                icon: 'Percent',
                color: 'text-primary',
                bg: 'bg-primary/5',
              },
            ]?.map(kpi => (
              <div key={kpi?.label} className={`${kpi?.bg} border border-border rounded-xl px-4 py-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={kpi?.icon} size={14} color="currentColor" className={kpi?.color} />
                  <p className="text-xs text-muted-foreground">{kpi?.label}</p>
                </div>
                <p className={`text-xl font-bold ${kpi?.color}`}>{kpi?.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi?.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <CollectionExpenseBarChart data={barChartData} loading={loading} />
            <NetProfitLineChart data={lineChartData} lineKey={lineKey} loading={loading} />
          </div>

          {/* YTD Leaderboard */}
          <YTDLeaderboardTable data={ytdData} loading={loading} />

          {/* Footer note */}
          <p className="text-xs text-muted-foreground mt-4 text-center">
            YTD data calculated from January 1, {new Date()?.getFullYear()} to today.
            Collections: Dentrix/FastAPI. Expenses: Finance Expense Report protected office-scoped totals.
            Corporate / Shared Expense: company-level expenses not assigned to a specific office, derived from all-office total minus sum of office totals.
          </p>
        </div>
      </main>
    </div>
  );
};

export default OfficeComparison;
