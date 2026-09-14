import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';
/**
 * reportExportService.js
 * V582 — Individual report export via POST /v2/reports/export
 *
 * Rules:
 * - Uses the same API_BASE and API_KEY pattern as ascendApi.js
 * - No service role key
 * - No PHI
 * - No old CSV/PDF export code
 * - No yearComparisonExportService
 * - No daily_entries / MEA / manual sources
 * - Backend enforces RBAC and audit logging
 * - Missing values are whatever backend returns — no fake zeros
 */

const API_BASE = DASHBOARD_API_ORIGIN + "/v2";
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

/**
 * Supported report_type values for individual export.
 * Patient Flow is now supported via verified API source (/v2/patients/summary + /v2/appointments/summary).
 */
export const SUPPORTED_REPORT_TYPES = [
  'executive_summary',
  'pl_summary',
  'expense_breakdown',
  'goal_leaderboard',
  'period_comparison',
  'provider_production_collections',
  'office_comparison',
  'treatment_plan_completion',
  'patient_flow',
  'full_workbook',
];

/**
 * Map from active Reports tab/section identifier to backend report_type.
 * Returns null for unsupported/blocked sections.
 */
export const ACTIVE_SECTION_TO_REPORT_TYPE = {
  // Tab IDs
  pl_summary: 'pl_summary',
  goal_leaderboard: 'goal_leaderboard',
  period_comparison: 'period_comparison',
  revenue_by_provider: 'provider_production_collections',
  office_comparison: 'office_comparison',
  patient_flow: 'patient_flow',
  'patient-flow': 'patient_flow',

  // Scroll-section / anchor IDs
  'expense-breakdown': 'expense_breakdown',
  'expense_breakdown': 'expense_breakdown',
  'treatment-plan-completion': 'treatment_plan_completion',
  'treatment_plan_completion': 'treatment_plan_completion',
  'patient-flow-section': 'patient_flow',

  // Top-level / overview
  executive_summary: 'executive_summary',
  overview: 'executive_summary',
};

/**
 * Sections that are explicitly blocked from export.
 * case_acceptance: legacy, not present.
 * patient_flow has been removed — backend now supports it via verified API source.
 */
export const BLOCKED_SECTIONS = new Set([
  'case_acceptance',
  'case-acceptance',
]);

/**
 * Human-readable labels for report types (used in UI).
 */
export const REPORT_TYPE_LABELS = {
  executive_summary: 'Executive Summary',
  pl_summary: 'P&L Summary',
  expense_breakdown: 'Expense Breakdown',
  goal_leaderboard: 'Goal Leaderboard',
  period_comparison: 'Period Comparison',
  provider_production_collections: 'Provider Production & Collections',
  office_comparison: 'Office Comparison',
  treatment_plan_completion: 'Treatment Plan Completion',
  patient_flow: 'Patient Flow',
  full_workbook: 'Full Workbook',
};

/**
 * Build the export request payload.
 * @param {object} params
 * @param {string} params.reportType - backend report_type value
 * @param {string} params.exportFormat - 'csv' or 'xlsx'
 * @param {string} params.dateRangeStart - YYYY-MM-DD
 * @param {string} params.dateRangeEnd - YYYY-MM-DD
 * @param {string[]} params.officeFilter - array of office IDs or ['all']
 * @param {string} params.userId - authenticated user id (from Supabase session)
 * @param {string} params.userEmail - authenticated user email (from Supabase session)
 * @param {string} params.userRole - user role from userProfile.role
 * @param {object} [params.periodComparison] - { periodAStart, periodAEnd, periodBStart, periodBEnd }
 * @param {number} [params.completionWindowDays] - for treatment_plan_completion, default 90
 */
function buildExportPayload({
  reportType,
  exportFormat,
  dateRangeStart,
  dateRangeEnd,
  officeFilter,
  userId,
  userEmail,
  userRole,
  periodComparison,
  completionWindowDays,
}) {
  const isAllOffices = !officeFilter || officeFilter?.includes('all') || officeFilter?.length === 0;

  const payload = {
    report_type: reportType,
    export_format: exportFormat,
    date_range_start: dateRangeStart,
    date_range_end: dateRangeEnd,
    office_filter: isAllOffices ? 'all' : officeFilter,
    user_id: userId,
    user_email: userEmail,
    user_role: userRole,
  };

  // Period comparison extra params
  if (reportType === 'period_comparison' && periodComparison) {
    payload.period_a_start = periodComparison?.periodAStart;
    payload.period_a_end = periodComparison?.periodAEnd;
    payload.period_b_start = periodComparison?.periodBStart;
    payload.period_b_end = periodComparison?.periodBEnd;
  }

  // Treatment plan completion window
  if (reportType === 'treatment_plan_completion') {
    payload.completion_window_days = completionWindowDays ?? 90;
  }

  return payload;
}

/**
 * Sanitize a string for use in a filename.
 */
function sanitizeForFilename(str) {
  return (str || 'unknown')
    ?.replace(/[^a-zA-Z0-9_\-]/g, '_')
    ?.replace(/_+/g, '_')
    ?.slice(0, 40);
}

/**
 * Extract filename from Content-Disposition header.
 * Returns null if not present or cannot be parsed.
 */
function extractFilenameFromHeader(contentDisposition) {
  if (!contentDisposition) return null;
  // Try filename*=UTF-8''<name> first, then filename="<name>"
  const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match?.[1]);
  const plainMatch = contentDisposition?.match(/filename="?([^";\s]+)"?/i);
  if (plainMatch) return plainMatch?.[1];
  return null;
}

/**
 * Trigger a browser file download from a Blob.
 */
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Call POST /v2/reports/export and trigger a browser download.
 *
 * @param {object} params
 * @param {string} params.reportType
 * @param {string} params.exportFormat - 'csv' or 'xlsx'
 * @param {string} params.dateRangeStart
 * @param {string} params.dateRangeEnd
 * @param {string[]} params.officeFilter
 * @param {string} params.userId - from Supabase auth session
 * @param {string} params.userEmail - from Supabase auth session
 * @param {string} params.userRole - from userProfile.role
 * @param {object} [params.periodComparison]
 * @param {number} [params.completionWindowDays]
 * @throws {Error} with a user-facing message on failure
 */
export async function exportIndividualReport({
  reportType,
  exportFormat,
  dateRangeStart,
  dateRangeEnd,
  officeFilter,
  userId,
  userEmail,
  userRole,
  periodComparison,
  completionWindowDays,
}) {
  // Guard: all three user audit fields must be present before calling backend
  if (!userId || !userEmail || !userRole) {
    throw new Error('User profile is still loading. Please try again.');
  }

  if (!SUPPORTED_REPORT_TYPES?.includes(reportType)) {
    throw new Error(`Export is not available for this section yet. (report_type: ${reportType})`);
  }
  if (!['csv', 'xlsx', 'pdf']?.includes(exportFormat)) {
    throw new Error(`Unsupported export format: ${exportFormat}`);
  }

  const payload = buildExportPayload({
    reportType,
    exportFormat,
    dateRangeStart,
    dateRangeEnd,
    officeFilter,
    userId,
    userEmail,
    userRole,
    periodComparison,
    completionWindowDays,
  });

  const res = await fetch(`${API_BASE}/reports/export`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res?.ok) {
    // Try to extract backend error message
    let errMsg = `Export failed (HTTP ${res?.status})`;
    try {
      const errBody = await res?.json();
      if (errBody?.message) errMsg = errBody?.message;
      else if (errBody?.error) errMsg = errBody?.error;
      else if (errBody?.detail) errMsg = errBody?.detail;
    } catch {
      // ignore JSON parse error — use status-based message
      if (res?.status === 403) errMsg = 'Individual exports require admin permission.';
      else if (res?.status === 422) errMsg = 'Export is not available for this section yet.';
      else if (res?.status === 500) errMsg = 'Export failed: audit logging failed on the server.';
    }
    throw new Error(errMsg);
  }

  // Read response as blob
  const blob = await res?.blob();

  // Determine filename
  const contentDisposition = res?.headers?.get('Content-Disposition');
  const headerFilename = extractFilenameFromHeader(contentDisposition);

  const ext = exportFormat === 'xlsx' ? 'xlsx' : exportFormat === 'pdf' ? 'pdf' : 'csv';
  const safeStart = sanitizeForFilename(dateRangeStart);
  const safeEnd = sanitizeForFilename(dateRangeEnd);
  const safeType = sanitizeForFilename(reportType);
  const fallbackFilename = `nu_reports_${safeType}_${safeStart}_${safeEnd}.${ext}`;

  const filename = headerFilename || fallbackFilename;

  triggerBlobDownload(blob, filename);
}

/**
 * Call POST /v2/reports/export for the Full Workbook (report_type: full_workbook).
 *
 * V590 — Backend branded Full Workbook export.
 *
 * Backend handles:
 *   - 10 sheets with Nu Dental branding, logo, brand colors, freeze panes, autofilter
 *   - Patient Flow sheet included (no PHI)
 *   - Source Notes sheet
 *   - Confidential footer
 *   - Audit insert before file return
 *   - RBAC: resources.reports.full_workbook.export
 *   - CSV/PDF not supported for full_workbook — XLSX only
 *
 * IMPORTANT: Do NOT call generateFullWorkbook / fullWorkbookService for this path.
 * IMPORTANT: Do NOT insert a separate frontend audit row — backend handles audit logging.
 *            If backend audit fails, backend returns an error; frontend shows the error
 *            and does NOT download the file.
 *
 * @param {object} params
 * @param {string} params.dateRangeStart - YYYY-MM-DD
 * @param {string} params.dateRangeEnd - YYYY-MM-DD
 * @param {string[]} params.officeFilter - array of office IDs or ['all']
 * @param {string} params.userId - from Supabase auth session
 * @param {string} params.userEmail - from Supabase auth session
 * @param {string} params.userRole - from userProfile.role
 * @param {string} [params.officeLabel] - human-readable office label for fallback filename
 * @throws {Error} with a user-facing message on failure
 */
export async function exportFullWorkbook({
  dateRangeStart,
  dateRangeEnd,
  officeFilter,
  userId,
  userEmail,
  userRole,
  officeLabel,
}) {
  if (!userId || !userEmail || !userRole) {
    throw new Error('User profile is still loading. Please try again.');
  }

  const isAllOffices = !officeFilter || officeFilter?.includes('all') || officeFilter?.length === 0;

  const payload = {
    report_type: 'full_workbook',
    export_format: 'xlsx',
    date_range_start: dateRangeStart,
    date_range_end: dateRangeEnd,
    office_filter: isAllOffices ? 'all' : officeFilter,
    user_id: userId,
    user_email: userEmail,
    user_role: userRole,
  };

  const res = await fetch(`${API_BASE}/reports/export`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res?.ok) {
    let errMsg = `Full Workbook export failed (HTTP ${res?.status})`;
    try {
      const errBody = await res?.json();
      if (errBody?.message) errMsg = errBody?.message;
      else if (errBody?.error) errMsg = errBody?.error;
      else if (errBody?.detail) errMsg = errBody?.detail;
    } catch {
      if (res?.status === 403) errMsg = 'Full Workbook export requires admin permission.';
      else if (res?.status === 422) errMsg = 'Full Workbook export is not supported for the selected parameters.';
      else if (res?.status === 500) errMsg = 'Export failed: audit logging failed on the server.';
    }
    throw new Error(errMsg);
  }

  const blob = await res?.blob();

  const contentDisposition = res?.headers?.get('Content-Disposition');
  const headerFilename = extractFilenameFromHeader(contentDisposition);

  const safeStart = sanitizeForFilename(dateRangeStart);
  const safeEnd = sanitizeForFilename(dateRangeEnd);
  const safeOffice = sanitizeForFilename(officeLabel || 'all_offices');
  const fallbackFilename = `nu_reports_full_workbook_${safeStart}_${safeEnd}_${safeOffice}.xlsx`;

  const filename = headerFilename || fallbackFilename;

  triggerBlobDownload(blob, filename);
}
