import React, { useEffect, Suspense } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, useNavigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import MainLayout from "./components/layout/MainLayout";
import ExecutiveOverview from './pages/executive-overview';
import FinancialAnalytics from './pages/financial-analytics';
import OfficePerformance from './pages/office-performance';
import ManagementSettings from './pages/management';
import DailyEntryForm from './pages/daily-entry-form';
import Reports from './pages/reports';
import Login from './pages/login';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import OfficeComparison from './pages/office-comparison';
import AlertCenter from './pages/alert-center';
import DailyMorningHuddle from './pages/daily-morning-huddle';
import HuddleHistory from './pages/huddle-history';
import HuddleAnalytics from './pages/huddle-analytics';
import TeamAssignments from './pages/team-assignments';
import ProfileSettings from './pages/profile-settings';
import AccountSettings from './pages/account-settings';
import UsersManagement from './pages/users-management';
import ServiceCategoriesManagement from './pages/service-categories-management';
import ProviderPerformance from './pages/provider-performance';
import BoneAndTissueInventory from './pages/bone-and-tissue-inventory';
import ImplantInventoryManagement from './pages/implant-inventory-management';
import UnifiedInventoryDashboard from './pages/unified-inventory-dashboard';
import InventoryDashboard from './pages/inventory-dashboard';
import RCMDashboard from './pages/rcm-dashboard';
import SupplyToast from './components/ui/SupplyToast';
import HelpCenter from './components/HelpCenter/HelpCenter';
import ExecutiveMonthlyAnalytics from './pages/executive-monthly-analytics';
import OperationsCenter from './pages/operations';
import KpisDashboard from './pages/kpis';
import RcmModule from './pages/rcm';
import StaffManagement from './pages/staff-management';
import StaffDirectory from './pages/staff-directory';
import InsuranceVerify from './pages/insurance-verify';
import TransactionAudit from './pages/transaction-audit';
import PendingApprovals from './pages/pending-approvals';
import AuditDashboard from './pages/audit-dashboard';
import AuditReports from './pages/audit-reports';
import ComplianceRetention from './pages/compliance-retention';
import AccessHeatmap from './pages/access-heatmap';
import AlertRulesPage from './pages/alert-rules';
import ErrorLogViewer from './pages/error-log-viewer';
import SyncDashboard from './pages/sync-dashboard';
import DataHealth from './pages/data-health';
import ImportAudit from './pages/import-audit';
import HuddleApprovals from './pages/huddle-approvals';
import AdminSystemDashboard from './pages/admin-system-dashboard';
import ManualProductionEntry from './pages/manual-production-entry';
import ChangePassword from './pages/change-password';
import OtpChallenge from './pages/otp-challenge';

import PayrollRoot from './pages/payroll/PayrollRoot';
import PayrollAudit from './pages/payroll-audit';
import ExpenseReport from './pages/financial-analytics/ExpenseReport';
import PayrollSyncDashboard from './pages/payroll-sync-dashboard';
import DentrixDiagnosticsPage from './pages/dentrix-diagnostics';
import MetricAlertThresholds from './pages/metric-alert-thresholds';

const HelpManual = React.lazy(() => import('./pages/help-manual'));

// Listens for SW messages and navigates to deep-link — must be inside BrowserRouter
function SWNavigationListener() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!navigator?.serviceWorker) return;
    const handler = (event) => {
      if (event?.data?.type === 'SUPPLY_NOTIF_NAVIGATE' && event?.data?.deepLink) {
        const path = event?.data?.deepLink?.replace(window.location?.origin, '');
        navigate(path);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [navigate]);
  return null;
}

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <SWNavigationListener />
        <SupplyToast />
        <HelpCenter />
        <RouterRoutes>
          {/* Public routes — no layout */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes — wrapped in MainLayout (sidebar + header) */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<ExecutiveOverview />} />
            <Route path="/executive-overview" element={<ExecutiveOverview />} />
            <Route path="/financial-analytics" element={<FinancialAnalytics />} />
            <Route path="/financial-analytics/expense-report" element={<ExpenseReport />} />
            <Route path="/office-performance" element={<OfficePerformance />} />
            <Route path="/management" element={<ManagementSettings />} />
            <Route path="/users-management" element={<UsersManagement />} />
            <Route path="/service-categories-management" element={<ServiceCategoriesManagement />} />
            <Route path="/provider-performance" element={<ProviderPerformance />} />
            <Route path="/bone-and-tissue-inventory" element={<BoneAndTissueInventory />} />
            <Route path="/implant-inventory-management" element={<ImplantInventoryManagement />} />
            <Route path="/unified-inventory-dashboard" element={<UnifiedInventoryDashboard />} />
            <Route path="/inventory-dashboard" element={<InventoryDashboard />} />
            <Route path="/rcm-dashboard" element={<RCMDashboard />} />
            <Route path="/rcm" element={<RcmModule />} />
            <Route path="/staff-management" element={<StaffManagement />} />
            <Route path="/staff-directory" element={<StaffDirectory />} />
            <Route path="/insurance-verify" element={<InsuranceVerify />} />
            <Route path="/executive-monthly-analytics" element={<ExecutiveMonthlyAnalytics />} />
            <Route path="/operations" element={<OperationsCenter />} />
            <Route path="/kpis" element={<KpisDashboard />} />
            <Route path="/daily-entry-form" element={<DailyEntryForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/office-comparison" element={<OfficeComparison />} />
            <Route path="/alert-center" element={<AlertCenter />} />
            <Route path="/daily-morning-huddle" element={<DailyMorningHuddle />} />
            <Route path="/huddle-history" element={<HuddleHistory />} />
            <Route path="/huddle-analytics" element={<HuddleAnalytics />} />
            <Route path="/team-assignments" element={<TeamAssignments />} />
            <Route path="/profile" element={<ProfileSettings />} />
            <Route path="/settings" element={<AccountSettings />} />
            <Route path="/transaction-audit" element={<TransactionAudit />} />
            <Route path="/pending-approvals" element={<PendingApprovals />} />
            <Route path="/audit-dashboard" element={<AuditDashboard />} />
            <Route path="/audit-reports" element={<AuditReports />} />
            <Route path="/compliance-retention" element={<ComplianceRetention />} />
            <Route path="/access-heatmap" element={<AccessHeatmap />} />
            <Route path="/alert-rules" element={<AlertRulesPage />} />
            <Route path="/error-logs" element={<ErrorLogViewer />} />
            <Route path="/sync-dashboard" element={<SyncDashboard />} />
            <Route path="/data-health" element={<DataHealth />} />
            <Route path="/import-audit" element={<ImportAudit />} />
            <Route path="/huddle-approvals" element={<HuddleApprovals />} />
            <Route path="/admin-system-dashboard" element={<AdminSystemDashboard />} />
            <Route path="/manual-production-entry" element={<ManualProductionEntry />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/otp-challenge" element={<OtpChallenge />} />
            <Route path="/payroll" element={<PayrollRoot />} />
            <Route path="/payroll-audit" element={<PayrollAudit />} />
            <Route path="/payroll-sync-dashboard" element={<PayrollSyncDashboard />} />
            <Route path="/dentrix-diagnostics" element={<DentrixDiagnosticsPage />} />
            <Route path="/metric-alert-thresholds" element={<MetricAlertThresholds />} />
            <Route
              path="/help/manual"
              element={
                <Suspense fallback={<div style={{ padding: 40, color: '#64748b' }}>Loading manual…</div>}>
                  <HelpManual />
                </Suspense>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
