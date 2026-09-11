import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import {
  officeGoalsService,
  getGoalAchievement,
  getProductionGoalValue,
} from '../../../services/goalsService';
import { startOfYear, startOfMonth, endOfMonth, subMonths, startOfQuarter, subQuarters, format, eachMonthOfInterval,  } from 'date-fns';

// ─── Formatters ───────────────────────────────────────────────────────────────
const formatCurrency = (val) =>
  val != null && !isNaN(val)
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })?.format(val)
    : '—';

// ─── Derive month list from dateFilter ────────────────────────────────────────
const getMonthsFromDateFilter = (dateFilter) => {
  const now = new Date();

  let rangeStart = null;
  let rangeEnd = null;

  if (!dateFilter || dateFilter === 'ytd_2026' || dateFilter === 'ytd') {
    rangeStart = startOfYear(now);
    rangeEnd = now;
  } else if (dateFilter === 'this_month') {
    rangeStart = startOfMonth(now);
    rangeEnd = now;
  } else if (dateFilter === 'last_month') {
    const lm = subMonths(now, 1);
    rangeStart = startOfMonth(lm);
    rangeEnd = endOfMonth(lm);
  } else if (dateFilter === 'this_quarter') {
    rangeStart = startOfQuarter(now);
    rangeEnd = now;
  } else if (dateFilter === 'last_quarter') {
    const lq = subQuarters(now, 1);
    rangeStart = startOfQuarter(lq);
    rangeEnd = endOfMonth(subMonths(now, (now?.getMonth() % 3) + 1));
  } else if (/^q([1-4])_(\d{4})$/?.test(dateFilter)) {
    const m = dateFilter?.match(/^q([1-4])_(\d{4})$/);
    const q = Number(m?.[1]);
    const yr = Number(m?.[2]);
    const startMo = (q - 1) * 3;
    rangeStart = new Date(yr, startMo, 1);
    rangeEnd = new Date(yr, startMo + 3, 0);
  } else if (/^ytd_(\d{4})$/?.test(dateFilter)) {
    const yr = parseInt(dateFilter?.replace('ytd_', ''), 10);
    rangeStart = new Date(yr, 0, 1);
    rangeEnd = yr === now?.getFullYear() ? now : new Date(yr, 11, 31);
  } else if (/^fy_(\d{4})$/?.test(dateFilter)) {
    const yr = parseInt(dateFilter?.replace('fy_', ''), 10);
    rangeStart = new Date(yr, 0, 1);
    rangeEnd = new Date(yr, 11, 31);
  } else if (dateFilter === 'custom') {
    // Custom range not supported for leaderboard — return null to signal N/A
    return null;
  } else {
    rangeStart = startOfYear(now);
    rangeEnd = now;
  }

  // Build array of 'YYYY-MM' strings for each month in the range
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  return months?.map((d) => format(d, 'yyyy-MM'));
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const StreakBadge = ({ streak }) => {
  if (streak === 0 || streak == null)
    return <span className="text-xs text-muted-foreground">—</span>;
  if (streak >= 3)
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
        <Icon name="Flame" size={11} />
        {streak} 🔥
      </span>
    );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success rounded-full text-xs font-semibold">
      <Icon name="TrendingUp" size={11} />
      {streak}
    </span>
  );
};

const HitRateBar = ({ rate }) => {
  const color =
    rate >= 70 ? 'bg-success' : rate >= 40 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span
        className={`text-xs font-semibold w-10 text-right ${
          rate >= 70
            ? 'text-success'
            : rate >= 40
            ? 'text-warning' :'text-destructive'
        }`}
      >
        {rate?.toFixed(0)}%
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const GoalLeaderboard = ({ officeFilter, dateFilter }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('hitRate');
  const [partialWarnings, setPartialWarnings] = useState(0);
  const [isCustomRange, setIsCustomRange] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setPartialWarnings(0);
    setIsCustomRange(false);

    // Custom date range — not supported, show N/A message
    if (dateFilter === 'custom') {
      setIsCustomRange(true);
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    const months = getMonthsFromDateFilter(dateFilter);
    if (!months || months?.length === 0) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch active offices
      const { data: offices, error: officesError } = await supabase
        ?.from('offices')
        ?.select('id, name')
        ?.eq('is_active', true);

      if (officesError || !offices?.length) {
        setLeaderboard([]);
        return;
      }

      // Apply office filter
      const filteredOffices =
        !officeFilter || officeFilter?.includes('all')
          ? offices
          : offices?.filter((o) => officeFilter?.includes(o?.id));

      if (!filteredOffices?.length) {
        setLeaderboard([]);
        return;
      }

      // Fetch current month target for each office
      const now = new Date();
      const currentMonthYear = format(now, 'yyyy-MM');

      let totalPartialFailures = 0;

      // Process each office
      const results = await Promise.all(
        filteredOffices?.map(async (office) => {
          let monthsTracked = 0;
          let monthsAchieved = 0;
          let officePartialFailures = 0;

          // Per-month results for streak calculation (newest first)
          const monthResults = [];

          // Process each month in the selected range
          await Promise.all(
            months?.map(async (monthYear) => {
              try {
                const result = await getGoalAchievement(office?.id, monthYear);

                // A month is "tracked" only if:
                // 1. A valid goal target exists (target > 0)
                // 2. The Dentrix/FastAPI fetch succeeded (collected is a number)
                if (result?.target > 0) {
                  const achieved = result?.collected >= result?.target;
                  monthResults?.push({ monthYear, achieved, tracked: true });
                  monthsTracked++;
                  if (achieved) monthsAchieved++;
                }
                // If target === 0 or no goal row, skip month (not tracked)
              } catch (err) {
                // Dentrix fetch failed for this month — exclude from tracking
                officePartialFailures++;
                console.warn(
                  `[GoalLeaderboard] fetch failed for office ${office?.name} month ${monthYear}:`,
                  err?.message
                );
              }
            })
          );

          totalPartialFailures += officePartialFailures;

          // Compute hit rate — only if we have tracked months
          const hitRate =
            monthsTracked > 0 ? (monthsAchieved / monthsTracked) * 100 : null;

          // Compute winning streak: consecutive most-recent tracked months where achieved = true
          const sortedResults = [...monthResults]?.sort((a, b) =>
            b?.monthYear?.localeCompare(a?.monthYear)
          );
          let streak = 0;
          for (const r of sortedResults) {
            if (r?.tracked && r?.achieved) streak++;
            else if (r?.tracked) break; // streak broken
          }

          // Current month target from office_goals
          let currentTarget = 0;
          try {
            const currentGoal = await officeGoalsService?.getByOfficeAndMonth(
              office?.id,
              currentMonthYear
            );
            currentTarget = getProductionGoalValue(currentGoal);
          } catch {
            currentTarget = 0;
          }

          return {
            officeId: office?.id,
            officeName: office?.name,
            hitRate,
            monthsAchieved,
            monthsTracked,
            streak,
            currentTarget,
            hasPartialFailures: officePartialFailures > 0,
          };
        })
      );

      setPartialWarnings(totalPartialFailures);
      setLeaderboard(results);
    } catch (err) {
      console.error('[GoalLeaderboard] load error:', err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, [officeFilter, dateFilter]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const sorted = [...leaderboard]?.sort((a, b) => {
    if (sortBy === 'hitRate') {
      // Offices with no tracked months go to bottom
      if (a?.hitRate == null && b?.hitRate == null) return 0;
      if (a?.hitRate == null) return 1;
      if (b?.hitRate == null) return -1;
      return b?.hitRate - a?.hitRate;
    }
    if (sortBy === 'achieved') return b?.monthsAchieved - a?.monthsAchieved;
    if (sortBy === 'streak') return b?.streak - a?.streak;
    return 0;
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Icon name="Trophy" size={16} color="#d97706" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Goal Achievement Leaderboard
            </h3>
            <p className="text-xs text-muted-foreground">
              Monthly collection goal performance by office
            </p>
          </div>
        </div>
        {/* Sort controls */}
        <div className="flex items-center gap-1">
          {[
            { key: 'hitRate', label: 'Hit Rate' },
            { key: 'achieved', label: 'Achieved' },
            { key: 'streak', label: 'Streak' },
          ]?.map((s) => (
            <button
              key={s?.key}
              onClick={() => setSortBy(s?.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-smooth ${
                sortBy === s?.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {s?.label}
            </button>
          ))}
        </div>
      </div>
      {/* Partial failure warning */}
      {partialWarnings > 0 && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <Icon name="AlertTriangle" size={13} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            {partialWarnings} month fetch{partialWarnings > 1 ? 'es' : ''} failed — those months are excluded from tracked counts. Remaining data is accurate.
          </p>
        </div>
      )}
      {/* Custom range not supported */}
      {isCustomRange && (
        <div className="p-8 text-center">
          <Icon name="CalendarX" size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Custom date range not supported</p>
          <p className="text-xs text-muted-foreground mt-1">
            The Goal Leaderboard requires a standard date filter (YTD, This Month, Quarter, etc.) to compute monthly achievements. Please select a standard period.
          </p>
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div className="p-6 space-y-3">
          {[1, 2, 3]?.map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      )}
      {/* Empty state */}
      {!loading && !isCustomRange && sorted?.length === 0 && (
        <div className="p-8 text-center">
          <Icon name="Trophy" size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No offices found for the selected filter.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adjust the office or date filter to see leaderboard data.
          </p>
        </div>
      )}
      {/* Table */}
      {!loading && !isCustomRange && sorted?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">
                  Rank
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">
                  Office
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3 min-w-[140px]">
                  Goal Hit Rate
                </th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">
                  Months Achieved
                </th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">
                  Winning Streak
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">
                  Current Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted?.map((office, idx) => (
                <tr
                  key={office?.officeId}
                  className="hover:bg-muted/20 transition-smooth"
                >
                  <td className="px-5 py-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                          ? 'bg-slate-100 text-slate-600'
                          : idx === 2
                          ? 'bg-orange-100 text-orange-700' :'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx === 0
                        ? '🥇'
                        : idx === 1
                        ? '🥈'
                        : idx === 2
                        ? '🥉'
                        : idx + 1}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {office?.officeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {office?.monthsTracked > 0
                        ? `${office?.monthsTracked} month${office?.monthsTracked !== 1 ? 's' : ''} tracked`
                        : 'No tracked months'}
                      {office?.hasPartialFailures && (
                        <span className="ml-1 text-amber-600" title="Some months could not be fetched">⚠</span>
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {office?.hitRate != null ? (
                      <HitRateBar rate={office?.hitRate} />
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {office?.monthsTracked > 0 ? (
                      <>
                        <span className="text-sm font-semibold text-foreground">
                          {office?.monthsAchieved}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {' '}/ {office?.monthsTracked}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StreakBadge streak={office?.streak} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-semibold text-foreground">
                      {office?.currentTarget > 0
                        ? formatCurrency(office?.currentTarget)
                        : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GoalLeaderboard;
