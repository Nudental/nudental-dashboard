import React, { useState, lazy, Suspense, useCallback, useMemo } from 'react';
import GustoSubNav from './GustoSubNav';
import GustoOverview from './overview/GustoOverview';
import GustoEmployees from './employees/GustoEmployees';
import GustoPayrollRuns from './payrollRuns/GustoPayrollRuns';
import GustoContractors from './contractors/GustoContractors';
import { useRealtimeSubscription } from '../../../hooks/useRealtimeSubscription';

// Lazy load remaining sub-tabs for performance
const GustoBenefits = lazy(() => import('./benefits/GustoBenefits'));
const GustoPaySchedules = lazy(() => import('./paySchedules/GustoPaySchedules'));
const GustoImportHistory = lazy(() => import('./importHistory/GustoImportHistory'));
const GustoTimeAndAttendance = lazy(() => import('./TimeAndAttendance/GustoTimeAndAttendance'));

// ── Permission key map for each Gusto sub-tab ────────────────────────────────
const GUSTO_TAB_PERMISSION = {
  overview:        'finance.payroll.gusto.overview.view',
  employees:       'finance.payroll.gusto.employees.view',
  payroll_runs:    'finance.payroll.gusto.payroll_runs.view',
  contractors:     'finance.payroll.gusto.contractors.view',
  benefits:        'finance.payroll.gusto.benefits.view',
  pay_schedules:   'finance.payroll.gusto.pay_schedules.view',
  import_history:  'finance.payroll.gusto.import_history.view',
  time_attendance: 'finance.payroll.gusto.time_attendance.view',
};

const ALL_GUSTO_TAB_KEYS = Object.keys(GUSTO_TAB_PERMISSION);

function GustoLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4]?.map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}

function GustoErrorFallback({ error, errorInfo, onRetry, tab }) {
  const isNetworkError = error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch');
  const isAuthError = error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('unauthorized');
  const isNotFound = error?.message?.includes('404');
  const isServerError = error?.message?.includes('500') || error?.message?.includes('502') || error?.message?.includes('503');

  let errorType = 'render';
  if (isNetworkError) errorType = 'network';
  else if (isAuthError) errorType = 'auth';
  else if (isNotFound) errorType = 'not_found';
  else if (isServerError) errorType = 'server';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <span className="text-3xl">⚠️</span>
      </div>
      <p className="text-gray-700 font-semibold mb-1">
        {errorType === 'auth' ? 'Access denied — check permissions' :
         errorType === 'network' ? 'Network error — check connection' :
         errorType === 'not_found' ? 'Data endpoint not found' :
         errorType === 'server'? 'Server error — try again shortly' : 'An error occurred loading this tab'}
      </p>
      <p className="text-gray-400 text-sm mb-1">
        This error is isolated and does not affect Dentrix payroll data.
      </p>
      {error?.message && (
        <p className="text-red-400 text-xs font-mono mt-1 mb-4 max-w-md break-all">
          {error?.message}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * GustoErrorBoundary — resets when `resetKey` changes (i.e., when tab changes).
 */
class GustoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.handleRetry = this.handleRetry?.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (prevState?.resetKey !== nextProps?.resetKey) {
      return { hasError: false, error: null, errorInfo: null, resetKey: nextProps?.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    const tab = this.props?.activeTab || 'unknown';
    console.error('[GustoErrorBoundary] Render error caught', {
      tab,
      error: error?.message,
      stack: error?.stack?.substring(0, 500),
      componentStack: info?.componentStack?.substring(0, 300),
    });
    this.setState({ errorInfo: info });
  }

  handleRetry() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state?.hasError) {
      return (
        <GustoErrorFallback
          error={this.state?.error}
          errorInfo={this.state?.errorInfo}
          onRetry={this.handleRetry}
          tab={this.props?.activeTab}
        />
      );
    }
    return this.props?.children;
  }
}

/**
 * GustoPayrollRoot — renders Gusto sub-nav + active sub-tab.
 *
 * RBAC Phase 2A:
 * - Accepts hasPermission from PayrollRoot (already loaded, no double-fetch).
 * - Computes allowedGustoTabs from individual sub-tab permission keys.
 * - super_admin (isSuperAdmin=true) sees all sub-tabs.
 * - Defaults to first allowed sub-tab.
 * - If no sub-tabs allowed, shows Access Denied.
 *
 * Completely isolated from Dentrix payroll.
 */
export default function GustoPayrollRoot({ isSuperAdmin, isAdmin, hasPermission }) {
  // ── Compute allowed Gusto sub-tabs ──────────────────────────────────────────
  const allowedGustoTabs = useMemo(() => {
    if (isSuperAdmin) return ALL_GUSTO_TAB_KEYS;
    if (!hasPermission) return ALL_GUSTO_TAB_KEYS; // legacy fallback: no permission fn = show all
    return ALL_GUSTO_TAB_KEYS?.filter(key => hasPermission(GUSTO_TAB_PERMISSION?.[key]));
  }, [isSuperAdmin, hasPermission]);

  const defaultGustoTab = allowedGustoTabs?.length > 0 ? allowedGustoTabs?.[0] : null;

  const [activeTab, setActiveTab] = useState(null); // null = not yet initialized
  const [refreshKey, setRefreshKey] = useState(0);

  // Effective active tab — always within allowed set
  const effectiveTab = useMemo(() => {
    if (activeTab && allowedGustoTabs?.includes(activeTab)) return activeTab;
    return defaultGustoTab;
  }, [activeTab, allowedGustoTabs, defaultGustoTab]);

  const handleTabChange = (tab) => {
    if (allowedGustoTabs?.includes(tab)) {
      setActiveTab(tab);
    }
  };

  // ── Real-time: auto-refresh Gusto tab when upstream data changes ──────────
  const handleGustoRefresh = useCallback(() => {
    console.log('[Gusto Payroll] Real-time change detected — refreshing Gusto tab');
    setRefreshKey(k => k + 1);
  }, []);

  useRealtimeSubscription(
    [
      { table: 'gusto_employee_benefit_enrollments' },
      { table: 'gusto_payroll_runs' },
      { table: 'gusto_employees' },
    ],
    handleGustoRefresh,
    true
  );

  const renderTab = () => {
    switch (effectiveTab) {
      case 'overview':         return <GustoOverview key={refreshKey} />;
      case 'employees':        return <GustoEmployees key={refreshKey} isSuperAdmin={isSuperAdmin} />;
      case 'payroll_runs':     return <GustoPayrollRuns key={refreshKey} isSuperAdmin={isSuperAdmin} />;
      case 'contractors':      return <GustoContractors key={refreshKey} isSuperAdmin={isSuperAdmin} />;
      case 'benefits':         return <Suspense fallback={<GustoLoadingSkeleton />}><GustoBenefits key={refreshKey} isSuperAdmin={isSuperAdmin} /></Suspense>;
      case 'pay_schedules':    return <Suspense fallback={<GustoLoadingSkeleton />}><GustoPaySchedules key={refreshKey} isSuperAdmin={isSuperAdmin} /></Suspense>;
      case 'import_history':   return <Suspense fallback={<GustoLoadingSkeleton />}><GustoImportHistory key={refreshKey} isSuperAdmin={isSuperAdmin} /></Suspense>;
      case 'time_attendance':  return <Suspense fallback={<GustoLoadingSkeleton />}><GustoTimeAndAttendance key={refreshKey} isSuperAdmin={isSuperAdmin} /></Suspense>;
      default:                 return null;
    }
  };

  // ── No Gusto sub-tabs allowed ────────────────────────────────────────────────
  if (allowedGustoTabs?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">No Gusto Sub-Tabs Enabled</h3>
        <p className="text-gray-500 text-sm max-w-sm">
          Your role does not have permission to view any Gusto sub-tabs. Contact your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <GustoErrorBoundary resetKey={effectiveTab} activeTab={effectiveTab}>
      <div className="flex flex-col gap-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Sub-nav — only shows allowed sub-tabs */}
        <div className="px-6 pt-4">
          <GustoSubNav
            active={effectiveTab}
            onChange={handleTabChange}
            allowedTabs={allowedGustoTabs}
          />
        </div>
        {/* Tab content */}
        <div className="p-6">
          {renderTab()}
        </div>
      </div>
    </GustoErrorBoundary>
  );
}
