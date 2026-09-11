// ─── Gusto Formatters ─────────────────────────────────────────────────────────
// Currency, date, badge color helpers for all Gusto UI components.

/**
 * Format a number as USD currency: $1,234,567.00
 * @param {number|string|null} value
 * @returns {string}
 */
export function fmtCurrency(value) {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })?.format(num);
}

/**
 * Format a number as USD currency without cents: $1,234,567
 * @param {number|string|null} value
 * @returns {string}
 */
export function fmtCurrencyShort(value) {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })?.format(num);
}

/**
 * Format a numeric value for CSV export (no $ sign)
 * @param {number|string|null} value
 * @returns {string}
 */
export function fmtCurrencyCSV(value) {
  const num = parseFloat(value) || 0;
  return num?.toFixed(2);
}

/**
 * Format a date as "Apr 18, 2026"
 * @param {string|null} dateStr
 * @returns {string}
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date as "YYYY-MM-DD" for CSV exports
 * @param {string|null} dateStr
 * @returns {string}
 */
export function fmtDateCSV(dateStr) {
  if (!dateStr) return '';
  return dateStr?.split('T')?.[0];
}

/**
 * Format a date range as "Dec 22 – Jan 4, 2026"
 * @param {string|null} start
 * @param {string|null} end
 * @returns {string}
 */
export function fmtDateRange(start, end) {
  if (!start || !end) return '—';
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const sStr = s?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eStr = e?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} – ${eStr}`;
}

/**
 * Format a datetime as "Apr 18, 2026 at 2:30 PM"
 * @param {string|null} dateStr
 * @returns {string}
 */
export function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d?.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get badge classes for employee status
 * @param {string|null} status
 * @returns {string}
 */
export function getStatusBadgeClass(status) {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-[#DCFCE7] text-[#166534]';
    case 'terminated': return 'bg-[#FEE2E2] text-[#991B1B]';
    default: return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Get badge classes for payroll run status
 * @param {Object} run
 * @returns {string}
 */
export function getRunStatusBadgeClass(run) {
  if (run?.reversed) return 'bg-[#FEE2E2] text-[#991B1B]';
  if (run?.needs_reprocessing) return 'bg-[#FEF9C3] text-[#854D0E]';
  if (run?.processed) return 'bg-[#DCFCE7] text-[#166534]';
  if (run?.processing) return 'bg-[#DBEAFE] text-[#1E40AF]';
  return 'bg-gray-100 text-gray-600';
}

/**
 * Get run status label
 * @param {Object} run
 * @returns {string}
 */
export function getRunStatusLabel(run) {
  if (run?.reversed) return 'Reversed';
  if (run?.needs_reprocessing) return 'Needs Reprocessing';
  if (run?.processed) return 'Processed';
  if (run?.processing) return 'Processing';
  return 'Pending';
}

/**
 * Get import log status badge class
 * @param {string} status
 * @returns {string}
 */
export function getImportStatusBadgeClass(status) {
  switch (status) {
    case 'success': return 'bg-[#DCFCE7] text-[#166534]';
    case 'partial': return 'bg-[#FEF9C3] text-[#854D0E]';
    case 'failed': return 'bg-[#FEE2E2] text-[#991B1B]';
    default: return 'bg-[#DBEAFE] text-[#1E40AF]';
  }
}

/**
 * Get import type badge color
 * @param {string} importType
 * @returns {string}
 */
export function getImportTypeBadgeClass(importType) {
  const map = {
    employees: 'bg-blue-100 text-blue-700',
    payroll_runs: 'bg-violet-100 text-violet-700',
    contractors: 'bg-orange-100 text-orange-700',
    benefits: 'bg-emerald-100 text-emerald-700',
    pay_schedules: 'bg-cyan-100 text-cyan-700',
    full: 'bg-gray-100 text-gray-700',
  };
  return map?.[importType] || 'bg-gray-100 text-gray-600';
}

/**
 * Get variance badge class based on percentage
 * @param {number|null} variancePct
 * @returns {string}
 */
export function getVarianceBadgeClass(variancePct) {
  const pct = Math.abs(parseFloat(variancePct) || 0);
  if (pct > 5) return 'text-red-600 font-semibold';
  if (pct > 1) return 'text-yellow-600 font-semibold';
  return 'text-green-600 font-semibold';
}

/**
 * Format a percentage value
 * @param {number|null} value
 * @returns {string}
 */
export function fmtPercent(value) {
  const num = parseFloat(value) || 0;
  return `${num?.toFixed(2)}%`;
}

/**
 * Get current year
 * @returns {number}
 */
export function getCurrentYear() {
  return new Date()?.getFullYear();
}

/**
 * Get available years for filter dropdowns
 * @returns {number[]}
 */
export function getGustoYears() {
  const current = getCurrentYear();
  const years = [];
  for (let y = current; y >= 2020; y--) {
    years?.push(y);
  }
  return years;
}

/**
 * Get month name from number (1-12)
 * @param {number} month
 * @returns {string}
 */
export function getMonthName(month) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months?.[(month - 1) % 12] || '';
}

/**
 * Download data as CSV file
 * @param {string} filename
 * @param {string[][]} rows - array of arrays (first row = headers)
 */
export function downloadCSV(filename, rows) {
  const csv = rows?.map(row =>
    row?.map(cell => {
      const str = String(cell ?? '');
      if (str?.includes(',') || str?.includes('"') || str?.includes('\n')) {
        return `"${str?.replace(/"/g, '""')}"`;
      }
      return str;
    })?.join(',')
  )?.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a?.click();
  URL.revokeObjectURL(url);
}
