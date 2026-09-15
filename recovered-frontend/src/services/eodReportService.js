import { dashboardFetch as fetch } from '../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';
/**
 * eodReportService.js
 * ══════════════════════════════════════════════════════════════════════════════
 * Dentrix Daily Closeout Report — Frontend Service
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Calls GET /v2/eod/daily-report?officeId={uuid}&date=YYYY-MM-DD
 * This is a Dentrix/FastAPI-sourced daily closeout report.
 * It is NOT Supabase daily_entries. Do NOT use daily_entries as fallback.
 *
 * Response sections:
 *   1. metadata
 *   2. source_freshness
 *   3. production
 *   4. collections
 *   5. deposit_slip
 *   6. appointments
 *   7. voided_transactions
 *   8. warnings
 *
 * Null/zero rules:
 *   - null / undefined / NaN → caller should render as N/A or —
 *   - actual 0 → caller should render as $0.00 or 0
 *   - Do NOT use `value || 0` for display — use safeDisplayNum / formatEodCurrency
 */

const API_BASE = DASHBOARD_API_ORIGIN + "/v2";
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

const buildHeaders = () => ({
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
});

/**
 * Fetch the Dentrix daily closeout report for a given office UUID and date.
 *
 * @param {string} officeId  Supabase office UUID (e.g. "1c719b5b-fd77-4da8-a1b9-2209f1cea63e")
 * @param {string} date      YYYY-MM-DD
 * @returns {Promise<object>} Full endpoint response with all sections
 * @throws {Error} with message if request fails
 */
export async function fetchEodDailyReport(officeId, date) {
  if (!officeId) throw new Error('officeId is required');
  if (!date) throw new Error('date is required');

  const url = `${API_BASE}/eod/daily-report?officeId=${encodeURIComponent(officeId)}&date=${encodeURIComponent(date)}`;

  const res = await fetch(url, { headers: buildHeaders() });

  if (!res?.ok) {
    let errMsg = `Dentrix daily closeout could not be loaded. (HTTP ${res?.status})`;
    try {
      const body = await res?.json();
      if (body?.detail || body?.message || body?.error) {
        errMsg = body?.detail || body?.message || body?.error || errMsg;
      }
    } catch {
      // ignore parse error — use default message
    }
    throw new Error(errMsg);
  }

  const data = await res?.json();
  return data;
}

// ─── Safe display helpers ─────────────────────────────────────────────────────

/**
 * Returns the numeric value if it is a finite number (including 0),
 * or null if the value is null / undefined / NaN / non-finite.
 * Use this before formatting — never use `value || 0` for display.
 */
export function safeDisplayNum(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(n) || isNaN(n)) return null;
  return n;
}

/**
 * Format a currency value for display.
 * - null / undefined / NaN → returns fallback (default '—')
 * - actual 0 → '$0.00' * - negative →'-$13,751.85'
 */
export function formatEodCurrency(value, fallback = '—') {
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  const abs = Math.abs(n);
  const formatted = abs?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format an integer count for display.
 * - null / undefined / NaN → returns fallback (default '—')
 * - actual 0 → '0'
 */
export function formatEodCount(value, fallback = '—') {
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  return Math.round(n)?.toLocaleString('en-US');
}

/**
 * Format a date string for display (YYYY-MM-DD → "May 14, 2026").
 * Returns '—' for null/empty.
 */
export function formatEodDate(dateStr, fallback = '—') {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr + (dateStr?.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d?.getTime())) return fallback;
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return fallback;
  }
}

/**
 * Format a datetime string for display.
 * Returns '—' for null/empty.
 */
export function formatEodDateTime(dtStr, fallback = '—') {
  if (!dtStr) return fallback;
  try {
    const d = new Date(dtStr);
    if (isNaN(d?.getTime())) return fallback;
    return d?.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return fallback;
  }
}
