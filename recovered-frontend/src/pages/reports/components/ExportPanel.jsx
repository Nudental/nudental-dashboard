import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import useRolePermissions from '../../../hooks/useRolePermissions';
import WorkbookConfirmModal from './WorkbookConfirmModal';
import { resolveReportDateRange } from '../../../services/fullWorkbookService';
import { OFFICE_MAP } from '../../../constants/offices';
import {
  exportIndividualReport,
  exportFullWorkbook,
  ACTIVE_SECTION_TO_REPORT_TYPE,
  BLOCKED_SECTIONS,
  REPORT_TYPE_LABELS,
  SUPPORTED_REPORT_TYPES,
} from '../../../services/reportExportService';

// Navigation-only cards — no export functions, no fake/sample data
// generateCSVContent and generatePDFHTML removed: contained hardcoded sample rows
// that could be accidentally re-enabled. No live export logic replaces them.

const NAV_TEMPLATES = [
  {
    id: 'pl_summary',
    label: 'P&L Summary',
    desc: 'Monthly revenue, expenses & profit',
    category: 'financial',
    action: 'tab',
    tabId: 'pl_summary',
    available: true,
    sourceNote: 'monthly_executive_analytics + Gusto expense facts',
  },
  {
    id: 'expense_detail',
    label: 'Expense Detail',
    desc: 'Cost drivers & back staff orders',
    category: 'financial',
    action: 'scroll',
    anchorId: 'expense-breakdown',
    available: true,
    sourceNote: 'daily_entries + Gusto + WF Banking (mixed source)',
  },
  {
    id: 'office_breakdown',
    label: 'Office Comparison',
    desc: 'Collections, expenses, net profit, and margin by office',
    category: 'financial',
    action: 'navigate',
    path: '/office-comparison',
    available: true,
    sourceNote: 'Dentrix/FastAPI collections + Finance Expense Report office-scoped totals',
  },
  {
    id: 'collection_report',
    label: 'Provider Collections',
    desc: 'Provider production, collections, and collection rate',
    category: 'financial',
    action: 'tab',
    tabId: 'revenue_by_provider',
    available: true,
    sourceNote: 'Dentrix/FastAPI /v2/reports/provider-performance',
  },
  {
    id: 'full_workbook',
    label: 'Full Workbook',
    desc: 'Export all verified report sections as XLSX',
    category: 'financial',
    action: 'export',
    available: true, // RBAC-gated at render time
    sourceNote: 'Dentrix/FastAPI + Finance Expense Report; aggregate-only; RBAC + audit required',
  },
  {
    id: 'goal_leaderboard',
    label: 'Goal Achievement Leaderboard',
    desc: 'Goal hit rate, streaks & monthly targets',
    category: 'operational',
    action: 'tab',
    tabId: 'goal_leaderboard',
    available: true,
    sourceNote: 'office_goals targets + Dentrix/FastAPI collections actuals',
  },
  {
    id: 'period_comparison',
    label: 'Period Comparison',
    desc: 'Compare revenue & expenses across periods',
    category: 'operational',
    action: 'tab',
    tabId: 'period_comparison',
    available: true,
    sourceNote: 'Dentrix/FastAPI production and collections + Finance Expense Report protected expense totals',
  },
  {
    id: 'revenue_by_provider',
    label: 'Revenue by Provider',
    desc: 'Provider revenue drilldown by office',
    category: 'operational',
    action: 'tab',
    tabId: 'revenue_by_provider',
    available: true,
    sourceNote: 'revenue_entries manual/EOD submissions',
  },
  {
    id: 'case_acceptance',
    label: 'Treatment Plan Completion',
    desc: 'Planned treatment completed within selected window',
    category: 'operational',
    action: 'scroll',
    anchorId: 'treatment-plan-completion',
    available: true,
    sourceNote: 'Dentrix/FastAPI /v2/eod/treatment-plan-completion',
  },
  {
    id: 'patient_flow',
    label: 'Patient Flow Report',
    desc: 'New patients vs no-shows by date range',
    category: 'operational',
    action: 'scroll',
    anchorId: 'patient-flow',
    available: true,
    sourceNote: 'Dentrix/FastAPI /v2/patients/summary + /v2/appointments/summary',
  },
];

const FULL_WORKBOOK_PERMISSION = 'resources.reports.full_workbook.export';
const INDIVIDUAL_EXPORT_PERMISSION = 'resources.reports.individual_export';

function resolveOfficeLabel(officeFilter) {
  if (!officeFilter || officeFilter?.includes('all') || officeFilter?.length === 0) return 'All Offices';
  if (officeFilter?.length === 1) return OFFICE_MAP?.[officeFilter?.[0]]?.name || officeFilter?.[0];
  return officeFilter?.map(id => OFFICE_MAP?.[id]?.name || id)?.join(', ');
}

/**
 * Resolve the backend report_type for the currently active tab/section.
 * Returns { reportType, blocked, unsupported } where:
 *   - reportType: string if mappable and supported
  *   - blocked: true if section is explicitly blocked (legacy Case Acceptance)
 *   - unsupported: true if section has no mapping
 */
function resolveActiveReportType(activeTab, activeAnchor) {
  // Check blocked sections first
  if (BLOCKED_SECTIONS?.has(activeTab) || BLOCKED_SECTIONS?.has(activeAnchor)) {
    return { reportType: null, blocked: true, unsupported: false };
  }

  // Try tab mapping
  const fromTab = ACTIVE_SECTION_TO_REPORT_TYPE?.[activeTab];
  if (fromTab && SUPPORTED_REPORT_TYPES?.includes(fromTab)) {
    return { reportType: fromTab, blocked: false, unsupported: false };
  }

  // Try anchor mapping
  if (activeAnchor) {
    const fromAnchor = ACTIVE_SECTION_TO_REPORT_TYPE?.[activeAnchor];
    if (fromAnchor && SUPPORTED_REPORT_TYPES?.includes(fromAnchor)) {
      return { reportType: fromAnchor, blocked: false, unsupported: false };
    }
  }

  return { reportType: null, blocked: false, unsupported: true };
}

const ExportPanel = ({
  activeTab,
  setActiveTab,
  currentExportReport,
  setCurrentExportReport,
  dateFilter,
  officeFilter,
  netProduction = null,
  totalCollections = null,
  totalExpenses = null,
}) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState('pl_summary');
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  // Full Workbook export state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Individual export state
  const [indivExporting, setIndivExporting] = useState(false); // 'csv' | 'xlsx' | 'pdf' | false
  const [indivError, setIndivError] = useState(null);
  const [indivSuccess, setIndivSuccess] = useState(null); // 'csv' | 'xlsx' | 'pdf' | null

  // ── Resolved date range and office label — computed at component scope ────
  // These must be at component level (not inside handlers) because they are
  // referenced in both handleConfirmExport AND the WorkbookConfirmModal JSX.
  const { start: dateStart, end: dateEnd } = resolveReportDateRange(dateFilter);
  const officeLabel = resolveOfficeLabel(officeFilter);

  // RBAC: super_admin and admin always allowed; others need explicit permission
  // Only evaluate after permissions have loaded to prevent false-locked flash
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin';
  const hasWorkbookPermission = !permLoading && (
    isSuperAdmin || isAdmin || hasPermission(FULL_WORKBOOK_PERMISSION)
  );
  // While loading, treat as "pending" — show skeleton card instead of locked card
  const workbookPermPending = permLoading || !userProfile;

  // Individual export RBAC — same roles: super_admin and admin
  const hasIndivExportPermission = !permLoading && (
    isSuperAdmin || isAdmin || hasPermission(INDIVIDUAL_EXPORT_PERMISSION)
  );
  const indivPermPending = permLoading || !userProfile;

  // Auto-select template when active tab changes (one-way sync: tab → panel)
  React.useEffect(() => {
    const match = NAV_TEMPLATES?.find(t => t?.action === 'tab' && t?.tabId === activeTab);
    if (match) setSelectedTemplate(match?.id);
  }, [activeTab]);

  // Clear individual export success/error when export context changes
  useEffect(() => {
    setIndivError(null);
    setIndivSuccess(null);
  }, [currentExportReport]);

  const handleCardClick = (template) => {
    if (template?.id === 'full_workbook') {
      if (!hasWorkbookPermission) return; // blocked by RBAC
      setExportError(null);
      setExportSuccess(false);
      setShowConfirmModal(true);
      return;
    }

    if (!template?.available) return;
    setSelectedTemplate(template?.id);

    if (template?.action === 'navigate' && template?.path) {
      navigate(template?.path);
    } else if (template?.action === 'tab' && setActiveTab) {
      setActiveTab(template?.tabId);
      // V587: update export context when a tab card is clicked
      if (setCurrentExportReport) setCurrentExportReport(template?.tabId);
    } else if (template?.action === 'scroll' && template?.anchorId) {
      // V587: update export context to the scroll section's report_type key BEFORE scrolling
      if (setCurrentExportReport) {
        // Map anchorId to the export context key used in ACTIVE_SECTION_TO_REPORT_TYPE
        const anchorToExportKey = {
          'expense-breakdown': 'expense-breakdown',
          'treatment-plan-completion': 'treatment-plan-completion',
          'patient-flow': 'patient-flow',
        };
        const exportKey = anchorToExportKey?.[template?.anchorId] || template?.anchorId;
        setCurrentExportReport(exportKey);
      }

      if (
        setActiveTab &&
        (activeTab === 'period_comparison' || activeTab === 'revenue_by_provider')
      ) {
        setActiveTab('pl_summary');
        setTimeout(() => {
          const el = document.getElementById(template?.anchorId);
          if (el) el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        const el = document.getElementById(template?.anchorId);
        if (el) el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    // V590: Route Full Workbook to backend branded export endpoint.
    // POST /v2/reports/export with report_type: full_workbook, export_format: xlsx.
    // Backend handles: 10 sheets, Nu Dental logo/branding, audit insert, RBAC.
    // Do NOT call generateFullWorkbook / fullWorkbookService.
    // Do NOT insert a separate frontend audit row — backend handles audit logging.
    // If backend audit fails, backend returns error; frontend shows error, no download.
    const userId = user?.id;
    const userEmail = user?.email;
    const userRole = userProfile?.role;

    try {
      setExportProgress('Requesting branded workbook from backend…');
      await exportFullWorkbook({
        dateRangeStart: dateStart,
        dateRangeEnd: dateEnd,
        officeFilter,
        userId,
        userEmail,
        userRole,
        officeLabel,
      });

      setExportSuccess(true);
      setExportProgress(null);
      // Close modal after brief success pause
      setTimeout(() => {
        setShowConfirmModal(false);
        setIsExporting(false);
        setExportSuccess(false);
      }, 1500);
    } catch (err) {
      const msg = err?.message || 'Export failed.';
      // Distinguish audit failure from other errors
      const isAuditFailure = msg?.toLowerCase()?.includes('audit');
      setExportError(
        isAuditFailure
          ? 'Export audit logging failed. Workbook was not downloaded.'
          : `Export failed: ${msg}`
      );
      setExportProgress(null);
      setIsExporting(false);
    }
  };

  const handleCloseModal = () => {
    if (isExporting) return;
    setShowConfirmModal(false);
    setExportError(null);
    setExportProgress(null);
    setExportSuccess(false);
  };

  // Individual export handler
  const handleIndividualExport = async (format) => {
    if (indivExporting) return; // prevent double-click

    setIndivError(null);
    setIndivSuccess(null);

    // Guard: user audit fields must be available before calling backend
    const userId = user?.id;
    const userEmail = user?.email;
    const userRole = userProfile?.role;

    if (!userId || !userEmail || !userRole) {
      setIndivError('User profile is still loading. Please try again.');
      return;
    }

    // V587: use explicit currentExportReport context (not just activeTab)
    // This ensures scroll-section cards (Patient Flow, Treatment Plan, Expense Breakdown)
    // export the correct report_type instead of defaulting to the activeTab (pl_summary).
    const exportContext = currentExportReport || activeTab;
    const { reportType, blocked, unsupported } = resolveActiveReportType(exportContext, null);

    if (blocked) {
      setIndivError('Export is not available for this section.');
      return;
    }

    if (unsupported || !reportType) {
      setIndivError('Export is not available for this section yet.');
      return;
    }

    const { start: dateRangeStart, end: dateRangeEnd } = resolveReportDateRange(dateFilter);

    setIndivExporting(format);
    try {
      await exportIndividualReport({
        reportType,
        exportFormat: format,
        dateRangeStart,
        dateRangeEnd,
        officeFilter,
        userId,
        userEmail,
        userRole,
      });
      setIndivSuccess(format);
      // Clear success after 3 seconds
      setTimeout(() => setIndivSuccess(null), 3000);
    } catch (err) {
      setIndivError(err?.message || 'Export failed. Please try again.');
    } finally {
      setIndivExporting(false);
    }
  };

  const financialTemplates = NAV_TEMPLATES?.filter(t => t?.category === 'financial');
  const operationalTemplates = NAV_TEMPLATES?.filter(t => t?.category === 'operational');

  // V587: Determine current section export state using explicit currentExportReport context
  const exportContext = currentExportReport || activeTab;
  const { reportType: activeReportType, blocked: activeBlocked } = resolveActiveReportType(exportContext, null);
  const activeReportLabel = activeReportType ? REPORT_TYPE_LABELS?.[activeReportType] : null;

  const renderCard = (t) => {
    const isSelected = selectedTemplate === t?.id;

    // Full Workbook card — always visible, RBAC-gated state
    if (t?.id === 'full_workbook') {
      // While permissions are loading, show a neutral skeleton card
      if (workbookPermPending) {
        return (
          <div
            key={t?.id}
            className="w-full text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/10 animate-pulse"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-muted-foreground/30 rounded-full flex-shrink-0" />
              <p className="text-xs font-medium text-muted-foreground">Full Workbook XLSX</p>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Checking permissions…</p>
          </div>
        );
      }

      if (!hasWorkbookPermission) {
        // Unauthorized — visible locked card
        return (
          <div
            key={t?.id}
            className="w-full text-left px-3 py-2 rounded-lg border border-border bg-muted/20 cursor-not-allowed"
            title="Full Workbook export requires admin permission."
          >
            <div className="flex items-center gap-1.5">
              <Icon name="Lock" size={11} className="text-muted-foreground flex-shrink-0" />
              <p className="text-xs font-medium text-muted-foreground">Full Workbook XLSX</p>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium">XLSX</span>
            </div>
            <p className="text-xs text-muted-foreground/80 mt-0.5">Aggregate workbook with verified report sections</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Requires admin permission</p>
          </div>
        );
      }

      // Authorized — enabled export card
      return (
        <button
          key={t?.id}
          onClick={() => handleCardClick(t)}
          disabled={isExporting}
          className={`w-full text-left px-3 py-2 rounded-lg border transition-smooth ${
            exportSuccess
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :'border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center gap-1.5">
            {isExporting ? (
              <div className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : exportSuccess ? (
              <Icon name="CheckCircle" size={11} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <Icon name="Download" size={11} className="text-primary flex-shrink-0" />
            )}
            <p className="text-xs font-medium text-foreground">Full Workbook XLSX</p>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">XLSX</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Aggregate workbook with verified report sections</p>
          <p className="text-xs text-primary/70 mt-1 font-medium">
            {isExporting ? 'Exporting…' : exportSuccess ? 'Downloaded!' : 'Export Full Workbook'}
          </p>
        </button>
      );
    }

    const isUnavailable = !t?.available;

    if (isUnavailable) {
      return (
        <div
          key={t?.id}
          className="w-full text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 opacity-50 cursor-not-allowed"
          title={t?.unavailableReason}
        >
          <div className="flex items-center gap-1.5">
            <Icon name="Lock" size={11} className="text-muted-foreground flex-shrink-0" />
            <p className="text-xs font-medium text-muted-foreground">{t?.label}</p>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{t?.unavailableReason}</p>
        </div>
      );
    }

    return (
      <button
        key={t?.id}
        onClick={() => handleCardClick(t)}
        className={`w-full text-left px-3 py-2 rounded-lg border transition-smooth ${
          isSelected
            ? 'border-primary bg-primary/5 text-primary' :'border-border hover:bg-muted/50 text-foreground'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {t?.action === 'scroll' && (
            <Icon name="ArrowDown" size={11} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
          )}
          {t?.action === 'tab' && (
            <Icon name="LayoutDashboard" size={11} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
          )}
          {t?.action === 'navigate' && (
            <Icon name="ExternalLink" size={11} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
          )}
          <p className="text-xs font-medium">{t?.label}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t?.desc}</p>
        {t?.available && (
          <p className="text-xs text-primary/70 mt-1 font-medium">
            {t?.action === 'tab' ? 'View Report Section' : t?.action === 'navigate' ? 'Go to Report' : 'Scroll to Section'}
          </p>
        )}
      </button>
    );
  };

  // ── Individual Export Section renderer ────────────────────────────────────
  const renderIndividualExportSection = () => {
    // Loading permissions
    if (indivPermPending) {
      return (
        <div className="space-y-2">
          <div className="h-9 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-9 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-9 bg-muted/30 rounded-lg animate-pulse" />
        </div>
      );
    }

    // Unauthorized
    if (!hasIndivExportPermission) {
      return (
        <div className="space-y-2">
          <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg cursor-not-allowed">
            <Icon name="Lock" size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Export Current Report CSV</span>
          </div>
          <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg cursor-not-allowed">
            <Icon name="Lock" size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Export Current Report XLSX</span>
          </div>
          <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg cursor-not-allowed">
            <Icon name="Lock" size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Export Current Report PDF</span>
          </div>
          <p className="text-xs text-muted-foreground text-center px-1">Individual exports require admin permission.</p>
        </div>
      );
    }

    // Unsupported section
    if (!activeReportType && !activeBlocked) {
      return (
        <div className="space-y-2">
          <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg cursor-not-allowed opacity-60">
            <Icon name="FileSpreadsheet" size={13} />
            Export Current Report CSV
          </button>
          <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg cursor-not-allowed opacity-60">
            <Icon name="FileSpreadsheet" size={13} />
            Export Current Report XLSX
          </button>
          <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted text-muted-foreground text-xs font-medium rounded-lg cursor-not-allowed opacity-60">
            <Icon name="FileText" size={13} />
            Export Current Report PDF
          </button>
          <p className="text-xs text-muted-foreground text-center px-1">PDF export is not available for this section.</p>
        </div>
      );
    }

    const csvLoading = indivExporting === 'csv';
    const xlsxLoading = indivExporting === 'xlsx';
    const pdfLoading = indivExporting === 'pdf';
    const csvSuccess = indivSuccess === 'csv';
    const xlsxSuccess = indivSuccess === 'xlsx';
    const pdfSuccess = indivSuccess === 'pdf';
    const anyLoading = !!indivExporting;

    return (
      <div className="space-y-2">
        {/* Current report label */}
        {activeReportLabel && (
          <p className="text-[10px] text-muted-foreground text-center">
            Current: <span className="font-medium text-foreground">{activeReportLabel}</span>
          </p>
        )}

        {/* CSV button */}
        <button
          onClick={() => handleIndividualExport('csv')}
          disabled={anyLoading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-smooth disabled:opacity-60 disabled:cursor-not-allowed ${
            csvSuccess
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' :'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
          }`}
        >
          {csvLoading ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : csvSuccess ? (
            <Icon name="CheckCircle" size={13} className="text-emerald-600" />
          ) : (
            <Icon name="FileSpreadsheet" size={13} />
          )}
          {csvLoading ? 'Preparing export…' : csvSuccess ? 'Downloaded!' : 'Export Current Report CSV'}
        </button>

        {/* XLSX button */}
        <button
          onClick={() => handleIndividualExport('xlsx')}
          disabled={anyLoading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-smooth disabled:opacity-60 disabled:cursor-not-allowed ${
            xlsxSuccess
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' :'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
          }`}
        >
          {xlsxLoading ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : xlsxSuccess ? (
            <Icon name="CheckCircle" size={13} className="text-emerald-600" />
          ) : (
            <Icon name="FileSpreadsheet" size={13} />
          )}
          {xlsxLoading ? 'Preparing export…' : xlsxSuccess ? 'Downloaded!' : 'Export Current Report XLSX'}
        </button>

        {/* PDF button */}
        <button
          onClick={() => handleIndividualExport('pdf')}
          disabled={anyLoading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-smooth disabled:opacity-60 disabled:cursor-not-allowed ${
            pdfSuccess
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' :'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
          }`}
        >
          {pdfLoading ? (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          ) : pdfSuccess ? (
            <Icon name="CheckCircle" size={13} className="text-emerald-600" />
          ) : (
            <Icon name="FileText" size={13} />
          )}
          {pdfLoading ? 'Preparing export…' : pdfSuccess ? 'Downloaded!' : 'Export Current Report PDF'}
        </button>

        {/* Error message */}
        {indivError && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded-md">
            <Icon name="AlertCircle" size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-600 leading-relaxed">{indivError}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border shadow-elevation-2 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="Navigation" size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Report Sections</h3>
        </div>
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Financial Reports</p>
          <div className="space-y-1.5">
            {financialTemplates?.map(renderCard)}
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">Operational Reports</p>
          <div className="space-y-1.5">
            {operationalTemplates?.map(renderCard)}
          </div>
        </div>

        {/* ── Individual Export Controls (V582/V584) ── */}
        <div className="border-t border-border pt-3 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Export Current Report</p>
          {renderIndividualExportSection()}
        </div>

        {/* ── PDF Export button removed — now integrated into individual export section above ── */}

        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border/60 rounded-lg">
          <Icon name="Info" size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            CSV, XLSX, and PDF exports are available for verified report sections. Patient Flow is now enabled for export.
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">Navigation respects current date range and office filters</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      <WorkbookConfirmModal
        isOpen={showConfirmModal}
        onClose={handleCloseModal}
        onConfirm={handleConfirmExport}
        dateStart={dateStart}
        dateEnd={dateEnd}
        officeLabel={officeLabel}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
      />
    </>
  );
};

export default ExportPanel;
