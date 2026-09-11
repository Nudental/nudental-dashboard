/**
 * calendarDateHelpers.js
 *
 * Timezone-safe calendar-date helpers for Nu Dashboard.
 *
 * IMPORTANT: All functions operate on YYYY-MM-DD strings using local calendar
 * arithmetic only. They do NOT use UTC conversion or Date.toISOString(), which
 * can shift dates by one day depending on the host timezone.
 *
 * The canonical approach: parse the date string into year/month/day integers,
 * perform arithmetic on those integers, then reformat. No timezone conversion
 * is ever involved.
 */

/**
 * Parse a YYYY-MM-DD string into { year, month, day } integers.
 * Throws if the string is not a valid YYYY-MM-DD date.
 *
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {{ year: number, month: number, day: number }}
 */
function parseYMD(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/?.test(dateStr)) {
    throw new TypeError(`calendarDateHelpers: expected YYYY-MM-DD, got "${dateStr}"`);
  }
  const year  = parseInt(dateStr?.slice(0, 4), 10);
  const month = parseInt(dateStr?.slice(5, 7), 10); // 1–12
  const day   = parseInt(dateStr?.slice(8, 10), 10);
  return { year, month, day };
}

/**
 * Format { year, month, day } back to YYYY-MM-DD.
 *
 * @param {{ year: number, month: number, day: number }} ymd
 * @returns {string}
 */
function formatYMD({ year, month, day }) {
  return (String(year)?.padStart(4, '0') +
  '-'+ String(month)?.padStart(2,'0') +
  '-' + String(day)?.padStart(2,'0'));
}

/**
 * Returns the number of days in a given month (1-indexed), accounting for leap years.
 *
 * @param {number} year
 * @param {number} month  1–12
 * @returns {number}
 */
function daysInMonth(year, month) {
  // Day 0 of the next month = last day of this month
  return new Date(year, month, 0)?.getDate();
}

/**
 * Subtract exactly one calendar day from a YYYY-MM-DD string.
 *
 * Timezone-safe: uses integer calendar arithmetic only.
 * Handles month boundaries, year boundaries, and leap days correctly.
 *
 * Examples:
 *   subtractCalendarDay('2026-08-17') → '2026-08-16'  (ordinary)
 *   subtractCalendarDay('2026-09-01') → '2026-08-31'  (month boundary)
 *   subtractCalendarDay('2027-01-01') → '2026-12-31'  (year boundary)
 *   subtractCalendarDay('2024-03-01') → '2024-02-29'  (leap day)
 *   subtractCalendarDay('2025-03-01') → '2025-02-28'  (non-leap year)
 *
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}        YYYY-MM-DD (one calendar day earlier)
 */
export function subtractCalendarDay(dateStr) {
  const { year, month, day } = parseYMD(dateStr);

  if (day > 1) {
    // Simple case: same month
    return formatYMD({ year, month, day: day - 1 });
  }

  // day === 1: roll back to last day of previous month
  if (month > 1) {
    const prevMonth = month - 1;
    return formatYMD({ year, month: prevMonth, day: daysInMonth(year, prevMonth) });
  }

  // month === 1, day === 1: roll back to Dec 31 of previous year
  return formatYMD({ year: year - 1, month: 12, day: 31 });
}

/**
 * Given a Gusto pay period (start, end as YYYY-MM-DD strings), returns the
 * corresponding Dentrix Ascend provider-compensation collection window.
 *
 * Business rule (approved by Dr. G, Sep 2026):
 *   Dentrix collection start = Gusto pay period start − 1 calendar day
 *   Dentrix collection end   = Gusto pay period end   − 1 calendar day
 *
 * Canonical example:
 *   Gusto Aug 17–Aug 30, 2026  →  Dentrix Aug 16–Aug 29, 2026
 *
 * @param {string} gustoStart  YYYY-MM-DD  (pay_period_start)
 * @param {string} gustoEnd    YYYY-MM-DD  (pay_period_end)
 * @returns {{ dentrixStart: string, dentrixEnd: string }}
 */
export function getDentrixCollectionWindow(gustoStart, gustoEnd) {
  return {
    dentrixStart: subtractCalendarDay(gustoStart),
    dentrixEnd:   subtractCalendarDay(gustoEnd),
  };
}
