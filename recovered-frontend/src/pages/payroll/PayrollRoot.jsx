import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import PayrollSourceSwitcher from '../../components/payroll/PayrollSourceSwitcher';
import GustoPayrollRoot from '../../components/payroll/gusto/GustoPayrollRoot';
import ComparisonRoot from '../../components/payroll/comparison/ComparisonRoot';
import ExistingPayrollPage from './index';
import ProviderCompensationNew from './components/ProviderCompensationNew';

/**
 * PayrollRoot — RBAC Phase 2A
 *
 * SAFETY GUARANTEE:
 * - When source === 'dentrix', renders <ExistingPayrollPage /> with ZERO changes.
 * - Gusto and Comparison tabs are completely isolated sub-trees.
 * - A failed Gusto import or render NEVER affects the Dentrix tab.
 *
 * RBAC (Phase 2A):
 * - super_admin: sees all tabs (via __all)
 * - admin: sees all tabs (DB keys all true from Phase 1C)
 * - other roles: sees only tabs their role_permissions allow
 * - No tabs allowed → Access Denied message
 * - Default tab = first allowed tab (never defaults unauthorized user into Dentrix)
 */
export default function PayrollRoot() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';
  const { hasPermission, loading: permLoading } = useRolePermissions();

  // ── Compute which top-level tabs this role may see ──────────────────────────
  const allowedTabs = useMemo(() => {
    if (permLoading) return null; // null = still loading

    const tabs = [];

    // Dentrix Ascend
    if (isSuperAdmin || hasPermission('finance.payroll.dentrix_ascend.view')) {
      tabs?.push('dentrix');
    }

    // Imported from Gusto — visible if role has gusto.view OR any gusto sub-tab permission
    const gustoSubTabKeys = [
      'finance.payroll.gusto.overview.view',
      'finance.payroll.gusto.employees.view',
      'finance.payroll.gusto.payroll_runs.view',
      'finance.payroll.gusto.contractors.view',
      'finance.payroll.gusto.benefits.view',
      'finance.payroll.gusto.pay_schedules.view',
      'finance.payroll.gusto.import_history.view',
      'finance.payroll.gusto.time_attendance.view',
    ];
    const hasAnyGustoSubTab = gustoSubTabKeys?.some(k => hasPermission(k));
    if (isSuperAdmin || hasPermission('finance.payroll.gusto.view') || hasAnyGustoSubTab) {
      tabs?.push('gusto');
    }

    // Comparison
    if (isSuperAdmin || hasPermission('finance.payroll.comparison.view')) {
      tabs?.push('comparison');
    }

    // Provider Compensation
    if (isSuperAdmin || hasPermission('finance.payroll.provider_compensation.view')) {
      tabs?.push('provider_compensation');
    }

    return tabs;
  }, [isSuperAdmin, hasPermission, permLoading]);

  // ── Check top-level Payroll page access ─────────────────────────────────────
  const hasPayrollAccess = useMemo(() => {
    if (permLoading) return null;
    if (isSuperAdmin) return true;
    if (hasPermission('finance.payroll.view')) return true;
    if (allowedTabs && allowedTabs?.length > 0) return true;
    return false;
  }, [isSuperAdmin, hasPermission, allowedTabs, permLoading]);

  // ── Active tab state — default to first allowed tab ──────────────────────────
  const defaultTab = useMemo(() => {
    if (!allowedTabs || allowedTabs?.length === 0) return null;
    return allowedTabs?.[0];
  }, [allowedTabs]);

  const [source, setSource] = useState(null); // null = not yet initialized

  // Once allowedTabs resolves, initialize source to first allowed tab
  const effectiveSource = useMemo(() => {
    if (source !== null && allowedTabs && allowedTabs?.includes(source)) return source;
    return defaultTab;
  }, [source, allowedTabs, defaultTab]);

  const handleSourceChange = (newSource) => {
    if (allowedTabs && allowedTabs?.includes(newSource)) {
      setSource(newSource);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00B5CC] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading payroll permissions…</p>
        </div>
      </div>
    );
  }

  // ── Access Denied — no payroll access at all ─────────────────────────────────
  if (!hasPayrollAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA] px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm">
            You do not have permission to view the Payroll module. Contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  // ── No tabs enabled (has payroll.view but no tab permissions) ────────────────
  if (!allowedTabs || allowedTabs?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA] px-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Payroll Tabs Enabled</h2>
          <p className="text-gray-500 text-sm">
            Your role has Payroll access but no specific tab permissions are enabled. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 min-h-screen bg-[#F8F9FA]">
      {/* Source switcher — only shows tabs the role is allowed to see */}
      <PayrollSourceSwitcher
        active={effectiveSource}
        onChange={handleSourceChange}
        allowedTabs={allowedTabs}
      />

      {/* ── Dentrix Ascend: renders existing page EXACTLY as-is ── */}
      {effectiveSource === 'dentrix' && (
        <div className="-mx-6 -mt-5">
          <ExistingPayrollPage />
        </div>
      )}

      {/* ── Imported from Gusto: completely isolated sub-app ── */}
      {effectiveSource === 'gusto' && (
        <GustoPayrollRoot
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
          hasPermission={hasPermission}
        />
      )}

      {/* ── Comparison: read-only derived view ── */}
      {effectiveSource === 'comparison' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <ComparisonRoot isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
        </div>
      )}

      {/* ── Provider Compensation ── */}
      {effectiveSource === 'provider_compensation' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <ProviderCompensationNew />
        </div>
      )}
    </div>
  );
}
