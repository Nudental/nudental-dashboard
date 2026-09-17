/**
 * NuDashboard Navigation Configuration
 * Data-driven grouped nav structure for the left sidebar.
 * Each group has children; each child supports label, shortLabel, icon, route, permissions, and badge.
 */

export const NAV_GROUPS = [
  {
    id: 'home',
    label: 'Home',
    icon: 'Home',
    children: [
      {
        id: 'overview',
        label: 'Executive Overview',
        shortLabel: 'Overview',
        icon: 'LayoutDashboard',
        route: '/executive-overview',
        permission: 'dashboard:executive_overview',
        permissionFallback: 'super_admin_only', // only super_admin or explicit permission
        description: 'Strategic dashboard for C-level financial oversight',
      },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: 'TrendingUp',
    children: [
      {
        id: 'kpis',
        label: 'KPIs',
        shortLabel: 'KPIs',
        icon: 'Target',
        route: '/kpis',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'performance.kpis.view',
        permissionAny: ['performance.kpis.view'],
        description: 'Key performance indicators — production, collections, patients, goals',
      },
      {
        id: 'operations',
        label: 'Operations',
        shortLabel: 'Operations',
        icon: 'Activity',
        route: '/operations',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'performance.operations.view',
        permissionAny: ['performance.operations.view'],
        description: 'Comprehensive operational analytics — offices, providers, AR, marketing',
      },
      {
        id: 'office-performance',
        label: 'Office Performance',
        shortLabel: 'Office Perf.',
        icon: 'Building2',
        route: '/office-performance',
        permission: 'performance:office_view',
        description: 'Operational analytics for practice managers',
      },
      {
        id: 'provider-performance',
        label: 'Provider Performance',
        shortLabel: 'Provider Metrics',
        icon: 'Stethoscope',
        route: '/provider-performance',
        permission: 'performance:provider_view',
        roles: ['admin', 'super_admin'],
        requireBothRoleAndPermission: true,
        description: 'Provider production, collections, and case acceptance',
      },
      {
        id: 'monthly-analytics',
        label: 'Monthly Analytics',
        shortLabel: 'Monthly Trends',
        icon: 'BarChart2',
        route: '/executive-monthly-analytics',
        roles: ['super_admin', 'admin', 'regional_clinical_manager', 'office_manager'],
        permission: 'performance.monthly_trends.view',
        permissionAny: ['performance.monthly_trends.view'],
        description: 'Executive monthly financial and operational analytics',
      },
      {
        id: 'regional-manager',
        label: 'Regional Manager',
        shortLabel: 'Regional Mgr',
        icon: 'ClipboardCheck',
        route: '/rcm-dashboard',
        roles: ['regional_clinical_manager', 'super_admin'],
        permission: 'performance.regional_manager.view',
        permissionAny: ['performance.regional_manager.view'],
        description: 'Regional Clinical Manager — Supply Request Approvals',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    children: [
      {
        id: 'payroll',
        label: 'Payroll',
        shortLabel: 'Payroll',
        icon: 'Banknote',
        route: '/payroll',
        roles: ['super_admin', 'admin'],
        permissionAny: [
          'finance.payroll.view',
          'finance.payroll.dentrix_ascend.view',
          'finance.payroll.gusto.view',
          'finance.payroll.gusto.overview.view',
          'finance.payroll.gusto.employees.view',
          'finance.payroll.gusto.payroll_runs.view',
          'finance.payroll.gusto.contractors.view',
          'finance.payroll.gusto.benefits.view',
          'finance.payroll.gusto.pay_schedules.view',
          'finance.payroll.gusto.import_history.view',
          'finance.payroll.gusto.time_attendance.view',
          'finance.payroll.comparison.view',
          'finance.payroll.provider_compensation.view',
        ],
        description: 'Provider-level payroll compensation reporting — doctors and hygienists. Super Administrator only.',
      },
      {
        id: 'financial-analytics',
        label: 'Financial Analytics',
        shortLabel: 'Finance',
        icon: 'TrendingUp',
        route: '/financial-analytics',
        permission: 'analytics:financial_view',
        description: 'Advanced analytical tools and forecasting',
      },
      {
        id: 'expense-report',
        label: 'Expense Report',
        shortLabel: 'Expenses',
        icon: 'DollarSign',
        route: '/financial-analytics/expense-report',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'finance.expenses.view',
        permissionAny: ['finance.expenses.view'],
        description: 'Centralized expense intelligence — payroll, AmEx, utilities, occupancy, insurance, and all operating costs',
      },
      {
        id: 'rcm',
        label: 'RCM',
        shortLabel: 'RCM',
        icon: 'CreditCard',
        route: '/rcm',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'finance.rcm.view',
        permissionAny: ['finance.rcm.view'],
        description: 'Revenue Cycle Management — claims, payments, statements, collections',
      },
      {
        id: 'transaction-audit',
        label: 'Transaction Audit',
        shortLabel: 'Audit',
        icon: 'ClipboardSearch',
        route: '/transaction-audit',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'finance.audit.view',
        permissionAny: ['finance.audit.view'],
        description: 'Full audit trail of daily entries, adjustments, and expenses for compliance',
      },
      {
        id: 'audit-dashboard',
        label: 'Audit Dashboard',
        shortLabel: 'Audit Log',
        icon: 'ShieldCheck',
        route: '/audit-dashboard',
        roles: ['super_admin', 'admin'],
        permission: 'finance.audit_log.view',
        permissionAny: ['finance.audit_log.view'],
        description: 'Who accessed which data, when, and what actions were taken across the platform',
      },
      {
        id: 'audit-reports',
        label: 'Audit Reports',
        shortLabel: 'Audit Reports',
        icon: 'FileBarChart2',
        route: '/audit-reports',
        roles: ['super_admin', 'admin'],
        permission: 'finance.audit_reports.view',
        permissionAny: ['finance.audit_reports.view'],
        description: 'Generate and email daily/weekly/monthly audit reports with configurable filters',
      },
      {
        id: 'compliance-retention',
        label: 'Compliance & Retention',
        shortLabel: 'Compliance',
        icon: 'Scale',
        route: '/compliance-retention',
        roles: ['super_admin', 'admin'],
        permission: 'finance.compliance.view',
        permissionAny: ['finance.compliance.view'],
        description: 'Audit log retention policies, purge schedules, and compliance status indicators',
      },
      {
        id: 'access-heatmap',
        label: 'Access Heatmap',
        shortLabel: 'Heatmap',
        icon: 'LayoutGrid',
        route: '/access-heatmap',
        roles: ['super_admin', 'admin'],
        permission: 'finance.heatmap.view',
        permissionAny: ['finance.heatmap.view'],
        description: 'Interactive heatmap of system access patterns by hour, day, and user',
      },
      {
        id: 'alert-rules',
        label: 'Alert Rules',
        shortLabel: 'Alerts',
        icon: 'ShieldAlert',
        route: '/alert-rules',
        roles: ['super_admin', 'admin'],
        permission: 'finance.alerts.view',
        permissionAny: ['finance.alerts.view'],
        description: 'Configure suspicious activity detection — mass deletions, after-hours access, bulk exports, failed logins, rapid role changes',
      },
      {
        id: 'error-logs',
        label: 'Error Logs',
        shortLabel: 'Error Logs',
        icon: 'Bug',
        route: '/error-logs',
        roles: ['super_admin', 'admin'],
        permission: 'finance.error_logs.view',
        permissionAny: ['finance.error_logs.view'],
        description: 'Structured production error logs with severity levels, stack traces, and user context',
      },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: 'Workflow',
    badge: 'pendingApprovals', // dynamic badge key
    children: [
      {
        id: 'morning-huddle',
        label: 'Morning Huddle',
        shortLabel: 'Huddle',
        icon: 'Sun',
        route: '/daily-morning-huddle',
        permission: 'huddle:view',
        description: 'Daily morning huddle report and management',
      },
      {
        id: 'insurance-verify',
        label: 'Insurance Verify',
        shortLabel: 'Insurance',
        icon: 'ShieldCheck',
        route: '/insurance-verify',
        permission: 'workflow.insurance.view',
        permissionAny: ['workflow.insurance.view'],
        description: 'Native insurance verification workflow — request queue, new request form, and legacy fallback',
      },
      {
        id: 'eod-report',
        label: 'EOD Report',
        shortLabel: 'EOD',
        icon: 'ClipboardList',
        route: '/daily-entry-form',
        permission: 'workflow.eod.view',
        permissionAny: ['workflow.eod.view'],
        description: 'Submit daily revenue and expense entries',
      },
      {
        id: 'team-assignments',
        label: 'Team Assignments',
        shortLabel: 'Tasks',
        icon: 'CheckSquare',
        route: '/team-assignments',
        permission: 'workflow.tasks.view',
        permissionAny: ['workflow.tasks.view'],
        description: 'Manage and track team action items',
      },
      {
        id: 'front-desk-approvals',
        label: 'Front Desk Approvals',
        shortLabel: 'Supply Review',
        icon: 'ClipboardCheck',
        route: '/front-desk-approvals',
        roles: ['super_admin', 'admin', 'regional_manager'],
        permission: 'workflow.approvals.view',
        requireBothRoleAndPermission: true,
        description: 'Review Front Desk supply requests; requester self-approval is prohibited',
      },
      {
        id: 'pending-approvals',
        label: 'EOD Approval Queue',
        shortLabel: 'EOD Queue',
        icon: 'ClipboardCheck',
        route: '/pending-approvals',
        badge: 'pendingApprovals',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'workflow.approvals.view',
        permissionAny: ['workflow.approvals.view'],
        description: 'Review and approve End-of-Day reports from all assigned offices',
      },
      {
        id: 'huddle-approvals',
        label: 'Workflow Approvals Queue',
        shortLabel: 'Approvals Queue',
        icon: 'Sun',
        route: '/huddle-approvals',
        roles: ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'],
        permission: 'workflow.huddle_queue.view',
        permissionAny: ['workflow.huddle_queue.view'],
        description: 'Review and approve pending Morning Huddle submissions by office with SLA tracking',
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: 'FolderOpen',
    children: [
      {
        id: 'reports',
        label: 'Reports',
        shortLabel: 'Reports',
        icon: 'FileBarChart',
        route: '/reports',
        permission: 'reports:financial_view',
        description: 'Monthly P&L reports and financial exports',
      },
      {
        id: 'inventory',
        label: 'Inventory Dashboard',
        shortLabel: 'Inventory',
        icon: 'LayoutGrid',
        route: '/inventory-dashboard',
        permission: 'inventory:view',
        description: 'Central inventory hub — bone, tissue, and implants across all locations',
      },
      {
        id: 'staff-directory',
        label: 'Staff Directory',
        shortLabel: 'Directory',
        icon: 'BookUser',
        route: '/staff-directory',
        description: 'View all active providers organized by office',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'Shield',
    children: [
      {
        id: 'users',
        label: 'Users',
        shortLabel: 'Users',
        icon: 'Users',
        route: '/users-management',
        roles: ['admin', 'super_admin'],
        permission: 'admin.users.view',
        permissionAny: ['admin.users.view'],
        description: 'Manage users, roles, and office assignments',
      },
      {
        id: 'manage-providers',
        label: 'Manage Providers',
        shortLabel: 'Providers',
        icon: 'UserCog',
        route: '/staff-management',
        roles: ['admin', 'super_admin'],
        permission: 'admin.providers.view',
        permissionAny: ['admin.providers.view'],
        description: 'Add, edit, and manage providers by office',
      },
      {
        id: 'settings',
        label: 'Management & Settings',
        shortLabel: 'Settings',
        icon: 'Settings',
        route: '/management',
        roles: ['super_admin'],
        permission: 'admin.settings.view',
        permissionAny: ['admin.settings.view'],
        description: 'System configuration for Super Admins',
      },
      {
        id: 'sync-dashboard',
        label: 'Sync Dashboard',
        shortLabel: 'Sync',
        icon: 'RefreshCw',
        route: '/sync-dashboard',
        roles: ['super_admin', 'admin'],
        permission: 'admin.sync.view',
        permissionAny: ['admin.sync.view'],
        description: 'Dentrix Ascend ↔ Supabase sync status, logs, and conflict resolution',
      },
      {
        id: 'data-health',
        label: 'Data Health',
        shortLabel: 'Data Health',
        icon: 'HeartPulse',
        route: '/data-health',
        roles: ['super_admin', 'admin'],
        permission: 'admin.data_health.view',
        permissionAny: ['admin.data_health.view'],
        description: 'Full data pipeline audit — endpoint mapping, backfill, reconciliation, and conflict resolution',
      },
      {
        id: 'import-audit',
        label: 'Import Audit',
        shortLabel: 'Import Audit',
        icon: 'ClipboardList',
        route: '/import-audit',
        roles: ['super_admin', 'admin'],
        permission: 'admin.import_audit.view',
        permissionAny: ['admin.import_audit.view'],
        description: 'Dentrix Ascend multi-location import pipeline — per-office, per-endpoint audit log with manual sync triggers',
      },
      {
        id: 'manual-production-entry',
        label: 'Manual Production Entry',
        shortLabel: 'Manual Entry',
        icon: 'FilePen',
        route: '/manual-production-entry',
        roles: ['super_admin', 'admin', 'regional_manager'],
        permission: 'admin.manual_entry.view',
        permissionAny: ['admin.manual_entry.view'],
        description: 'Enter UCR fee and production adjustment data manually when Dentrix Ascend API does not provide these values directly',
      },
      {
        id: 'admin-system-dashboard',
        label: 'System Dashboard',
        shortLabel: 'System',
        icon: 'LayoutDashboard',
        route: '/admin-system-dashboard',
        roles: ['super_admin', 'admin'],
        permission: 'admin.system.view',
        permissionAny: ['admin.system.view'],
        description: 'Dentrix sync status, notification delivery health, import failures, and endpoint coverage by office with real-time alerts',
      },
      {
        id: 'dentrix-diagnostics',
        label: 'Dentrix Ascend Reconciliation',
        shortLabel: 'Reconciliation',
        icon: 'FlaskConical',
        route: '/dentrix-diagnostics',
        roles: ['super_admin'],
        permission: 'admin.reconciliation.view',
        permissionAny: ['admin.reconciliation.view'],
        description: 'Full source-to-dashboard lineage, endpoint health checks, and eAssist benchmark reconciliation — PASS/WARNING/FAIL/ENDPOINT MISSING status for all metrics',
      },
      {
        id: 'metric-alert-thresholds',
        label: 'Metric Alert Thresholds',
        shortLabel: 'Alert Thresholds',
        icon: 'SlidersHorizontal',
        route: '/metric-alert-thresholds',
        roles: ['super_admin'],
        permission: 'admin.alert_thresholds.view',
        permissionAny: ['admin.alert_thresholds.view'],
        description: 'Define threshold-based alerts for collection ratio, 30+ day AR, and claims submission rate across offices with real-time breach notifications',
      },
    ],
  },
];

/**
 * Flat map of route -> nav item for breadcrumb/active state resolution
 */
export const ROUTE_TO_NAV = NAV_GROUPS?.reduce((acc, group) => {
  group?.children?.forEach(child => {
    acc[child.route] = { ...child, groupId: group?.id, groupLabel: group?.label };
  });
  return acc;
}, {});

/**
 * Check if a nav item is visible for a given user profile + permissions
 */
export function isNavItemVisible(item, userProfile, hasPermission) {
  const role = userProfile?.role;
  const isSuperAdmin = role === 'super_admin';

  // Super admin sees everything
  if (isSuperAdmin) return true;

  // Items with explicit permission check (no roles array, or permissionFallback)
  if (item?.permission && !item?.roles && !item?.permissionAny) {
    if (item?.permissionFallback === 'super_admin_only') {
      return hasPermission(item?.permission);
    }
    if (item?.requireBothRoleAndPermission) {
      const roleOk = item?.roles?.includes(role);
      return roleOk && hasPermission(item?.permission);
    }
    return hasPermission(item?.permission);
  }

  // Items with requireBothRoleAndPermission (roles + permission both required)
  if (item?.requireBothRoleAndPermission) {
    const roleOk = item?.roles?.includes(role);
    return roleOk && hasPermission(item?.permission);
  }

  // Items with permissionFallback: super_admin_only (permission-only check)
  if (item?.permissionFallback === 'super_admin_only') {
    return hasPermission(item?.permission);
  }

  // Items with roles array — check role first, then permissionAny as OR fallback
  if (item?.roles) {
    if (item?.roles?.includes(role)) return true;
    // permissionAny: visible if user has ANY of the listed permissions
    if (item?.permissionAny?.length) {
      return item?.permissionAny?.some(key => hasPermission(key));
    }
    return false;
  }

  // Items with only permissionAny (no roles array)
  if (item?.permissionAny?.length) {
    return item?.permissionAny?.some(key => hasPermission(key));
  }

  // Items with only permission key (no roles, no permissionAny)
  if (item?.permission) {
    return hasPermission(item?.permission);
  }

  // No restriction — visible to all authenticated users
  return true;
}

/**
 * Filter a group's children by visibility, return null if no children visible
 */
export function getVisibleGroup(group, userProfile, hasPermission) {
  const visibleChildren = group?.children?.filter(child =>
    isNavItemVisible(child, userProfile, hasPermission)
  );
  if (visibleChildren?.length === 0) return null;
  return { ...group, children: visibleChildren };
}
