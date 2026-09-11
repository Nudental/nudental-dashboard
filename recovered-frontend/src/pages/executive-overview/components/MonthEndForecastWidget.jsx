import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { getDaysInMonth, format, isAfter, isSameMonth, isSameYear } from 'date-fns';
import { officeGoalsService } from '../../../services/goalsService';
import { ascendApi } from '../../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../../constants/offices';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })?.format(val || 0);

const pad = (n) => String(n)?.padStart(2, '0');

/**
 * Resolve the production goal value from an office_goals row.
 */
function resolveProductionGoal(goal) {
  if (!goal) return null;
  const v =
    goal?.production_goal ??
    goal?.productionGoal ??
    goal?.monthly_target ??
    goal?.monthlyTarget ??
    null;
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : null;
}

/**
 * Extract net production from the /v2/production/summary response.
 * V352: Only production?.netProduction is used. net_production, production,
 * and ledgerProduction have been removed. grossProduction is never used.
 * If netProduction is missing, return null so the UI shows N/A.
 */
function resolveNetProduction(production) {
  if (production == null) return null;
  const raw = production?.netProduction ?? null;
  if (raw == null) return null;
  const n = parseFloat(raw);
  return isFinite(n) ? Math.abs(n) : null;
}

// ─── Working-Day / Holiday Helpers ───────────────────────────────────────────

/**
 * Returns the Nu Dental office-closed holidays for a given year as an array
 * of Date objects (time set to midnight local).
 *
 * Holidays:
 *   - New Year's Day:   January 1
 *   - Memorial Day:     Last Monday in May
 *   - Independence Day: July 4
 *   - Labor Day:        First Monday in September
 *   - Thanksgiving:     Fourth Thursday in November
 *   - Christmas Day:    December 25
 *
 * Observed Monday/Friday substitutions are NOT included unless explicitly
 * configured later.
 */
function getNuDentalHolidays(year) {
  const holidays = [];

  // New Year's Day — Jan 1
  holidays?.push(new Date(year, 0, 1));

  // Memorial Day — last Monday in May
  holidays?.push(lastWeekdayOfMonth(year, 4, 1)); // month=4 → May (0-indexed), day=1 → Monday

  // Independence Day — Jul 4
  holidays?.push(new Date(year, 6, 4));

  // Labor Day — first Monday in September
  holidays?.push(firstWeekdayOfMonth(year, 8, 1)); // month=8 → September, day=1 → Monday

  // Thanksgiving — fourth Thursday in November
  holidays?.push(nthWeekdayOfMonth(year, 10, 4, 4)); // month=10 → November, n=4, day=4 → Thursday

  // Christmas Day — Dec 25
  holidays?.push(new Date(year, 11, 25));

  return holidays;
}

/**
 * Returns the first occurrence of a given weekday (0=Sun…6=Sat) in a month.
 */
function firstWeekdayOfMonth(year, month, weekday) {
  const d = new Date(year, month, 1);
  const diff = (weekday - d?.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff);
}

/**
 * Returns the last occurrence of a given weekday in a month.
 */
function lastWeekdayOfMonth(year, month, weekday) {
  const lastDay = getDaysInMonth(new Date(year, month));
  const d = new Date(year, month, lastDay);
  const diff = (d?.getDay() - weekday + 7) % 7;
  return new Date(year, month, lastDay - diff);
}

/**
 * Returns the nth occurrence of a given weekday in a month.
 * e.g. nthWeekdayOfMonth(2026, 10, 4, 4) → 4th Thursday of November 2026
 */
function nthWeekdayOfMonth(year, month, n, weekday) {
  const first = firstWeekdayOfMonth(year, month, weekday);
  return new Date(year, month, first.getDate() + (n - 1) * 7);
}

/**
 * Returns true if two Date objects represent the same calendar day.
 */
function isSameDay(a, b) {
  return (a?.getFullYear() === b?.getFullYear() &&
  a?.getMonth() === b?.getMonth() && a?.getDate() === b?.getDate());
}

/**
 * Returns true if a Date is a Nu Dental office-closed holiday.
 * Only checks holidays whose year matches the date's year.
 */
function isNuDentalHoliday(date, holidaySet) {
  return holidaySet?.some((h) => isSameDay(date, h));
}

/**
 * Returns true if a Date is a production day:
 *   - Monday through Friday (weekday 1–5)
 *   - NOT a Nu Dental office-closed holiday
 */
function isProductionDay(date, holidaySet) {
  const dow = date?.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false;
  return !isNuDentalHoliday(date, holidaySet);
}

/**
 * Count production days (Mon–Fri minus Nu Dental holidays) in a date range [start, end] inclusive.
 */
function countProductionDays(startDate, endDate) {
  // Collect holidays for all years that span the range
  const startYear = startDate?.getFullYear();
  const endYear = endDate?.getFullYear();
  const holidaySet = [];
  for (let y = startYear; y <= endYear; y++) {
    holidaySet?.push(...getNuDentalHolidays(y));
  }

  let count = 0;
  const cur = new Date(startDate);
  cur?.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end?.setHours(0, 0, 0, 0);

  while (cur <= end) {
    if (isProductionDay(cur, holidaySet)) count++;
    cur?.setDate(cur?.getDate() + 1);
  }
  return count;
}

/**
 * Returns the list of Nu Dental holidays (weekday-only) that fall within
 * [startDate, endDate] inclusive, for audit/display purposes.
 */
function getHolidaysInRange(startDate, endDate) {
  const startYear = startDate?.getFullYear();
  const endYear = endDate?.getFullYear();
  const holidaySet = [];
  for (let y = startYear; y <= endYear; y++) {
    holidaySet?.push(...getNuDentalHolidays(y));
  }
  const start = new Date(startDate);
  start?.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end?.setHours(0, 0, 0, 0);

  return holidaySet?.filter((h) => {
    const dow = h?.getDay();
    if (dow === 0 || dow === 6) return false; // weekend holiday — no impact on count
    return h >= start && h <= end;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * MonthEndForecastWidget
 *
 * Production-pace forecast card for the Executive Overview.
 *
 * Working days = Monday–Friday, excluding Nu Dental office-closed holidays:
 *   New Year's Day, Memorial Day, Independence Day, Labor Day,
 *   Thanksgiving Day, Christmas Day.
 * Observed holidays and office-specific closures are NOT included unless
 * explicitly configured.
 *
 * Net production source: /v2/production/summary → netProduction field only.
 * grossProduction is NOT used as a fallback.
 */
const MonthEndForecastWidget = ({
  officeId,
  officeName,
  onPaceAlertNeeded,
  monthYear: monthYearProp,
}) => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) return;
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, monthYearProp]);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthYear = monthYearProp || format(now, 'yyyy-MM');
      const [yearNum, monthNum] = monthYear?.split('-')?.map(Number);

      // ── Determine if this is an active (current) or completed month ────────
      const selectedMonthStart = new Date(yearNum, monthNum - 1, 1);
      const isCurrentMonth =
        isSameYear(selectedMonthStart, now) && isSameMonth(selectedMonthStart, now);
      const isCompletedPeriod = !isCurrentMonth && isAfter(now, selectedMonthStart);

      const daysInSelectedMonth = getDaysInMonth(new Date(yearNum, monthNum - 1));
      const monthStart = new Date(yearNum, monthNum - 1, 1);
      const monthEnd = new Date(yearNum, monthNum - 1, daysInSelectedMonth);

      // ── Date range for production fetch ───────────────────────────────────
      const startDate = `${monthYear}-01`;
      let endDate;
      let elapsedProductionDays;
      let remainingProductionDays;
      let totalProductionDays;

      // Pre-compute total production days for the full selected month
      totalProductionDays = countProductionDays(monthStart, monthEnd);

      if (isCurrentMonth) {
        // Active month: MTD — end at today
        const todayDay = now?.getDate();
        endDate = `${now?.getFullYear()}-${pad(now?.getMonth() + 1)}-${pad(todayDay)}`;

        // Elapsed = production days from month start through today inclusive
        // (if today is a weekend/holiday, it still counts days up to and including today
        //  but today itself won't be a production day — countProductionDays handles this)
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        elapsedProductionDays = countProductionDays(monthStart, todayMidnight);

        // Remaining = production days after today through month end
        const tomorrow = new Date(todayMidnight);
        tomorrow?.setDate(tomorrow?.getDate() + 1);
        remainingProductionDays =
          tomorrow <= monthEnd ? countProductionDays(tomorrow, monthEnd) : 0;
      } else {
        // Completed month: full month
        endDate = `${monthYear}-${pad(daysInSelectedMonth)}`;
        elapsedProductionDays = totalProductionDays;
        remainingProductionDays = 0;
      }

      // ── Fetch production goal from Supabase ───────────────────────────────
      const goal = await officeGoalsService?.getByOfficeAndMonth(officeId, monthYear);
      const productionGoal = resolveProductionGoal(goal);

      // ── Fetch net production from Dentrix via /v2/production/summary ──────
      const locationId = getLocationIdByOfficeId(officeId);
      let actualProduction = null;
      let netProductionMissing = false;

      try {
        const productionRes = await ascendApi?.getProduction(startDate, endDate, locationId);
        actualProduction = resolveNetProduction(productionRes);
        if (actualProduction === null) {
          netProductionMissing = true;
        }
      } catch (err) {
        console.warn('[MonthEndForecastWidget] ascendApi.getProduction failed:', err?.message);
        actualProduction = null;
        netProductionMissing = true;
      }

      // ── Guard: missing net production — do NOT substitute gross production ─
      if (actualProduction === null) {
        setForecast({
          missingProduction: true,
          netProductionMissing,
          monthYear,
          isCompletedPeriod,
        });
        return;
      }

      // ── Guard: no goal set ────────────────────────────────────────────────
      if (!productionGoal) {
        setForecast({ noGoal: true, actualProduction, monthYear, isCompletedPeriod });
        return;
      }

      // ── Completed period: show actual vs goal, no extrapolation ───────────
      if (isCompletedPeriod) {
        const variance = actualProduction - productionGoal;
        const goalMet = actualProduction >= productionGoal;
        const holidaysExcluded = getHolidaysInRange(monthStart, monthEnd);
        setForecast({
          isCompletedPeriod: true,
          monthYear,
          actualProduction,
          productionGoal,
          variance,
          goalMet,
          totalProductionDays,
          holidaysExcluded,
        });
        return;
      }

      // ── Active month: production-pace forecast ────────────────────────────

      // Guard: elapsed production days = 0
      if (elapsedProductionDays === 0) {
        setForecast({
          noElapsedDays: true,
          monthYear,
          productionGoal,
          actualProduction,
          isCompletedPeriod: false,
          totalProductionDays,
          remainingProductionDays,
        });
        return;
      }

      const averageDailyProduction = actualProduction / elapsedProductionDays;
      const projectedMonthEnd = actualProduction + averageDailyProduction * remainingProductionDays;
      const projectedVsTarget = projectedMonthEnd - productionGoal;

      const remainingProductionNeeded = Math.max(productionGoal - actualProduction, 0);
      const dailyAverageNeeded =
        remainingProductionDays > 0
          ? remainingProductionNeeded / remainingProductionDays
          : actualProduction >= productionGoal
          ? 0
          : null;

      const isBehindPace = projectedVsTarget < 0;

      const holidaysExcluded = getHolidaysInRange(monthStart, monthEnd);

      const result = {
        isCompletedPeriod: false,
        monthYear,
        actualProduction,
        productionGoal,
        elapsedProductionDays,
        remainingProductionDays,
        totalProductionDays,
        averageDailyProduction,
        projectedMonthEnd,
        projectedVsTarget,
        dailyAverageNeeded,
        isBehindPace,
        holidaysExcluded,
      };

      setForecast(result);

      if (isBehindPace && onPaceAlertNeeded) {
        onPaceAlertNeeded({ officeId, officeName, ...result });
      }
    } catch (err) {
      console.error('[MonthEndForecastWidget] Forecast load error:', err);
      setForecast({ error: true });
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-3" />
        <div className="h-8 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (forecast?.error) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <CardHeader officeName={officeName} isBehindPace={false} />
        <p className="text-xs text-muted-foreground mt-2">Unable to load forecast data.</p>
      </div>
    );
  }

  // ── Missing net production ─────────────────────────────────────────────────
  if (forecast?.missingProduction) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <CardHeader officeName={officeName} isBehindPace={false} />
        <p className="text-xs text-muted-foreground mt-2">
          Net production unavailable — N/A
        </p>
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
          Net production unavailable from Dentrix endpoint. Gross production is not substituted.
        </p>
        {forecast?.isCompletedPeriod && (
          <p className="text-xs text-muted-foreground mt-1">Completed period.</p>
        )}
        <HelperText />
      </div>
    );
  }

  // ── No goal set ────────────────────────────────────────────────────────────
  if (forecast?.noGoal) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <CardHeader officeName={officeName} isBehindPace={false} />
        <p className="text-xs text-muted-foreground mt-2">
          No monthly production goal set. Set a goal in Management to see forecasting.
        </p>
        {forecast?.actualProduction != null && (
          <p className="text-xs text-muted-foreground mt-1">
            Net Production: {formatCurrency(forecast?.actualProduction)}
          </p>
        )}
        <HelperText />
      </div>
    );
  }

  // ── Elapsed production days = 0 (no production days yet) ──────────────────
  if (forecast?.noElapsedDays) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <CardHeader officeName={officeName} isBehindPace={false} />
        <p className="text-xs text-muted-foreground mt-2">
          No elapsed production days yet — forecast not available (N/A).
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Monthly Production Target: {formatCurrency(forecast?.productionGoal)}
        </p>
        {forecast?.totalProductionDays != null && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Total production days this month: {forecast?.totalProductionDays}
          </p>
        )}
        <HelperText />
      </div>
    );
  }

  // ── Completed period view ──────────────────────────────────────────────────
  if (forecast?.isCompletedPeriod) {
    const variancePositive = (forecast?.variance || 0) >= 0;
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <CardHeader officeName={officeName} isBehindPace={false} completedPeriod />
        <div className="mt-3 space-y-2">
          {/* Completed period label */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
            <Icon name="CheckCircle" size={14} color="var(--color-muted-foreground)" />
            <span className="text-xs font-medium text-muted-foreground">
              Completed period — forecast not applicable
            </span>
          </div>

          {/* Actual vs Goal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Actual Net Production</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(forecast?.actualProduction)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Source: Dentrix net production
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Production Goal</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(forecast?.productionGoal)}
              </p>
            </div>
          </div>

          {/* Variance */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg ${
              variancePositive
                ? 'bg-success/10 border border-success/20' :'bg-destructive/10 border border-destructive/20'
            }`}
          >
            <span className="text-xs font-medium text-foreground">Variance vs Production Goal</span>
            <span
              className={`text-sm font-bold flex items-center gap-1 ${
                variancePositive ? 'text-success' : 'text-destructive'
              }`}
            >
              <Icon name={variancePositive ? 'ArrowUp' : 'ArrowDown'} size={13} />
              {variancePositive ? '+' : '-'}
              {formatCurrency(Math.abs(forecast?.variance || 0))}
            </span>
          </div>

          {/* Goal met / shortfall */}
          {forecast?.goalMet ? (
            <p className="text-xs text-success font-medium px-1">✓ Production goal met</p>
          ) : (
            <p className="text-xs text-destructive font-medium px-1">
              Shortfall: {formatCurrency(Math.abs(forecast?.variance || 0))} below production goal
            </p>
          )}

          {/* Production days info */}
          {forecast?.totalProductionDays != null && (
            <p className="text-[10px] text-muted-foreground px-1">
              Production days in period: {forecast?.totalProductionDays}
              {forecast?.holidaysExcluded?.length > 0 &&
                ` (${forecast?.holidaysExcluded?.length} holiday${forecast?.holidaysExcluded?.length > 1 ? 's' : ''} excluded)`}
            </p>
          )}
        </div>
        <HelperText />
      </div>
    );
  }

  // ── Active month forecast view ─────────────────────────────────────────────
  const variancePositive = (forecast?.projectedVsTarget || 0) >= 0;

  return (
    <div
      className={`bg-card border rounded-xl p-5 ${
        forecast?.isBehindPace ? 'border-destructive/40 bg-destructive/5' : 'border-border'
      }`}
    >
      <CardHeader officeName={officeName} isBehindPace={forecast?.isBehindPace} />
      {/* Source note */}
      <p className="text-[10px] text-muted-foreground mb-3 mt-1">
        Net Production forecast · Source: Dentrix net production (/v2/production/summary)
      </p>
      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Projected Month-End</p>
          <p
            className={`text-lg font-bold ${
              variancePositive ? 'text-success' : 'text-destructive'
            }`}
          >
            {formatCurrency(forecast?.projectedMonthEnd)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Based on {formatCurrency(forecast?.averageDailyProduction)}/production day avg
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Monthly Production Target</p>
          <p className="text-lg font-bold text-foreground">
            {formatCurrency(forecast?.productionGoal)}
          </p>
        </div>
      </div>
      {/* Projected vs Target */}
      <div
        className={`flex items-center justify-between p-3 rounded-lg mb-3 ${
          variancePositive
            ? 'bg-success/10 border border-success/20' :'bg-destructive/10 border border-destructive/20'
        }`}
      >
        <span className="text-xs font-medium text-foreground">Projected vs Target</span>
        <span
          className={`text-sm font-bold flex items-center gap-1 ${
            variancePositive ? 'text-success' : 'text-destructive'
          }`}
        >
          <Icon name={variancePositive ? 'ArrowUp' : 'ArrowDown'} size={13} />
          {variancePositive ? '+' : '-'}
          {formatCurrency(Math.abs(forecast?.projectedVsTarget || 0))}
        </span>
      </div>
      {/* Daily Production Needed */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Daily Production Needed</p>
            <p className="text-xs text-muted-foreground">
              {forecast?.remainingProductionDays} production day{forecast?.remainingProductionDays !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <div className="text-right">
            {forecast?.dailyAverageNeeded != null ? (
              <>
                <p className="text-xl font-bold text-primary">
                  {forecast?.dailyAverageNeeded === 0
                    ? '$0'
                    : formatCurrency(forecast?.dailyAverageNeeded)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast?.dailyAverageNeeded === 0 ? 'Goal already met' : '/day to hit goal'}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">N/A</p>
            )}
          </div>
        </div>
      </div>
      {/* Actual net production so far */}
      <div className="mt-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            Net Production ({forecast?.elapsedProductionDays} production day{forecast?.elapsedProductionDays !== 1 ? 's' : ''}):{' '}
            {formatCurrency(forecast?.actualProduction)}
          </span>
          {forecast?.productionGoal > 0 && (
            <span>
              {Math.round((forecast?.actualProduction / forecast?.productionGoal) * 100)}% of
              production goal
            </span>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              forecast?.isBehindPace ? 'bg-destructive' : 'bg-success'
            }`}
            style={{
              width: `${
                forecast?.productionGoal > 0
                  ? Math.min(
                      (forecast?.actualProduction / forecast?.productionGoal) * 100,
                      100
                    )
                  : 0
              }%`,
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Monthly Production Target: {formatCurrency(forecast?.productionGoal)}
        </p>
        {/* Production days summary */}
        {forecast?.totalProductionDays != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Production days: {forecast?.elapsedProductionDays} elapsed · {forecast?.remainingProductionDays} remaining · {forecast?.totalProductionDays} total
            {forecast?.holidaysExcluded?.length > 0 &&
              ` · ${forecast?.holidaysExcluded?.length} holiday${forecast?.holidaysExcluded?.length > 1 ? 's' : ''} excluded`}
          </p>
        )}
      </div>
      <HelperText />
    </div>
  );
};

// ─── Sub-component: Card Header ───────────────────────────────────────────────
function CardHeader({ officeName, isBehindPace, completedPeriod }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            completedPeriod
              ? 'bg-muted'
              : isBehindPace
              ? 'bg-destructive/10' :'bg-primary/10'
          }`}
        >
          <Icon
            name={completedPeriod ? 'Calendar' : isBehindPace ? 'TrendingDown' : 'TrendingUp'}
            size={16}
            color={
              completedPeriod
                ? 'var(--color-muted-foreground)'
                : isBehindPace
                ? 'var(--color-destructive)'
                : 'var(--color-primary)'
            }
          />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Month-End Forecast</h4>
          {officeName && <p className="text-xs text-muted-foreground">{officeName}</p>}
        </div>
      </div>
      {isBehindPace && !completedPeriod && (
        <span className="flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-full">
          <Icon name="AlertTriangle" size={11} />
          Behind Pace
        </span>
      )}
    </div>
  );
}

// ─── Sub-component: Helper Text ───────────────────────────────────────────────
function HelperText() {
  return (
    <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed border-t border-border/50 pt-2">
      Forecast uses Dentrix net production and Nu Dental production days: Monday–Friday excluding
      New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving Day, and Christmas
      Day. Observed holidays and office-specific closures are not included unless configured.
    </p>
  );
}

export default MonthEndForecastWidget;
