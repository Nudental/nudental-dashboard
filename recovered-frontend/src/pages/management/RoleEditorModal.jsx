import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { rolePermissionsService } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
  { id: 'admin', label: 'Admin', icon: 'ShieldCheck', color: 'text-primary', bg: 'bg-primary/10', description: 'Office administrators with elevated access' },
  { id: 'super_admin', label: 'Super Admin', icon: 'ShieldAlert', color: 'text-warning', bg: 'bg-warning/10', description: 'Full system access and configuration' },
  { id: 'regional_manager', label: 'Regional Manager', icon: 'Globe', color: 'text-violet-600', bg: 'bg-violet-100', description: 'Front Office / Global — Nyasiah\'s role' },
  { id: 'regional_clinical_manager', label: 'Regional Clinical Manager', icon: 'Stethoscope', color: 'text-indigo-600', bg: 'bg-indigo-100', description: 'Back Office / Global — Maia\'s role (Eatontown, Brick, Barnegat, Staten Island)' },
  { id: 'front_desk', label: 'Front Desk', icon: 'ConciergeBell', color: 'text-cyan-600', bg: 'bg-cyan-100', description: 'Front desk staff managing patient check-in and supplies' },
  { id: 'staff', label: 'Staff', icon: 'Users', color: 'text-muted-foreground', bg: 'bg-muted', description: 'Front desk, assistants, and general staff' },
  { id: 'doctor', label: 'Doctor', icon: 'Stethoscope', color: 'text-success', bg: 'bg-success/10', description: 'Dentists and dental hygienists' },
  { id: 'hygienist', label: 'Hygienist', icon: 'HeartHandshake', color: 'text-emerald-600', bg: 'bg-emerald-100', description: 'Dental hygienists providing preventive care' },
  { id: 'office_manager', label: 'Office Manager', icon: 'Briefcase', color: 'text-blue-600', bg: 'bg-blue-100', description: 'Manages office operations and staff' },
  { id: 'treatment_coordinator', label: 'Treatment Coordinator', icon: 'ClipboardCheck', color: 'text-purple-600', bg: 'bg-purple-100', description: 'Coordinates patient treatment plans' },
  { id: 'rda', label: 'RDA', icon: 'Syringe', color: 'text-teal-600', bg: 'bg-teal-100', description: 'Registered Dental Assistant' },
  { id: 'clinical_manager', label: 'Clinical Manager', icon: 'Activity', color: 'text-orange-600', bg: 'bg-orange-100', description: 'Oversees clinical operations and quality' },
  { id: 'dental_assistant', label: 'Dental Assistant', icon: 'HeartPulse', color: 'text-pink-600', bg: 'bg-pink-100', description: 'Assists dentists during procedures' },
  { id: 'insurance_verifier', label: 'Insurance Verifier', icon: 'FileCheck', color: 'text-sky-600', bg: 'bg-sky-100', description: 'Insurance verification specialists' },
  { id: 'marketing', label: 'Marketing', icon: 'TrendingUp', color: 'text-rose-600', bg: 'bg-rose-100', description: 'Marketing and performance analytics access' },
];

// ─── STALE / SHADOW KEY REGISTRY ─────────────────────────────────────────────
// Keys identified as likely stale, shadow, or not fully enforced.
// These are labeled visually in the UI but NOT removed or renamed.
const STALE_KEYS = new Set([
  'manage_users',
  'approve_entries',
  'manage_categories',
  'view_audit_logs',
  'edit_entries',
  'performance.office_performance.view',
  'finance.finance.view',
  'resources.reports.view',
  'resources.inventory.view',
  'admin.users.role_editor.view',
]);

// ─── EXISTING ENFORCED PERMISSION SECTIONS ───────────────────────────────────
// These sections are currently enforced in the application.
const PERMISSION_SECTIONS = [
  {
    id: 'general',
    label: 'General Access',
    icon: 'Shield',
    permissions: [
      { id: 'view_reports', label: 'View Reports', description: 'Access financial and performance reports', icon: 'BarChart2' },
      { id: 'edit_entries', label: 'Edit Entries', description: 'Create and modify EOD Report forms', icon: 'Edit3' },
      { id: 'manage_users', label: 'Manage Users', description: 'Create, edit, and deactivate user accounts', icon: 'UserCog' },
      { id: 'approve_entries', label: 'Approve Entries', description: 'Review and approve submitted EOD Reports', icon: 'CheckCircle' },
      { id: 'manage_categories', label: 'Manage Categories', description: 'Edit cost drivers and expense categories', icon: 'Tag' },
      { id: 'view_audit_logs', label: 'View Audit Logs', description: 'Access system audit trail and change history', icon: 'ClipboardList' },
    ],
  },
  {
    id: 'meetings_operations',
    label: 'Meetings & Operations',
    icon: 'Sun',
    permissions: [
      { id: 'huddle:view', label: 'View Morning Huddle', description: 'Ability to open and read the Morning Huddle dashboard', icon: 'Eye' },
      { id: 'huddle:edit', label: 'Edit Morning Huddle', description: 'Ability to input data, update goals, and save huddle notes', icon: 'Edit3' },
    ],
  },
  {
    id: 'financial_performance',
    label: 'Financial & Performance Data',
    icon: 'TrendingUp',
    permissions: [
      { id: 'analytics:financial_view', label: 'Financial Analytics Dashboard', description: 'Access to the main Financial Analytics Dashboard', icon: 'BarChart2' },
      { id: 'reports:financial_view', label: 'Financial Reports', description: 'Access to detailed Financial Reports and export functions', icon: 'FileBarChart' },
      { id: 'performance:office_view', label: 'Office Performance', description: "Access to the \'Office Performance\' overview", icon: 'Building2' },
      { id: 'performance:provider_view', label: 'Provider Performance', description: "Access to individual \'Provider Performance\' metrics and rankings", icon: 'Activity' },
    ],
  },
  {
    id: 'inventory_management',
    label: 'Inventory Management',
    icon: 'Package',
    permissions: [
      { id: 'inventory:view', label: 'View Inventory', description: 'Access to view stock levels across all categories', icon: 'Eye' },
      { id: 'inventory:edit', label: 'Edit Inventory', description: 'Access to update stock levels, add items, and manage the master supply list', icon: 'PackagePlus' },
    ],
  },
  {
    id: 'supply_chain',
    label: 'Supply Chain & Ordering',
    icon: 'ShoppingCart',
    permissions: [
      { id: 'request:front_desk_order', label: 'Submit Front Desk Requests', description: 'View, fill out, and submit the Front Desk Inventory Checklist', icon: 'ClipboardList' },
      { id: 'request:back_staff_order', label: 'Submit Back Staff Requests', description: 'View, fill out, and submit the Clinical/Back Staff Supply Request', icon: 'Package' },
    ],
  },
];

// Executive section — only rendered when activeRole === 'super_admin'
const EXECUTIVE_SECTION = {
  id: 'executive_ownership',
  label: 'High-Level Reporting',
  icon: 'Crown',
  permissions: [
    {
      id: 'dashboard:executive_overview',
      label: 'Executive Overview',
      description: 'High-level summary of all 4 locations with aggregated revenue, new patients, and net collection rate',
      icon: 'LayoutDashboard',
      tooltip: 'Warning: This grants access to sensitive aggregate financial data across all office locations.',
    },
  ],
};

// ─── ENFORCED NAVIGATION & SUB-TAB PERMISSION SECTIONS ───────────────────────
// These sections define permission keys for all navigation items and sub-tabs.
// ✅ ENFORCED — navigation and sub-tab permissions are active for supported modules.
const FUTURE_PERMISSION_SECTIONS = [
  // ── Navigation Access ──────────────────────────────────────────────────────
  {
    id: 'nav_home',
    label: 'Navigation — Home',
    icon: 'Home',
    future: true,
    permissions: [
      { id: 'home.overview.view', label: 'Home: Overview', description: 'Access to the Executive Overview / Home dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    id: 'nav_performance',
    label: 'Navigation — Performance',
    icon: 'TrendingUp',
    future: true,
    permissions: [
      { id: 'performance.kpis.view', label: 'Performance: KPIs', description: 'Access to the KPIs page', icon: 'BarChart2' },
      { id: 'performance.operations.view', label: 'Performance: Operations', description: 'Access to the Operations page', icon: 'Activity' },
      { id: 'performance.office_performance.view', label: 'Performance: Office Performance', description: 'Access to the Office Performance page', icon: 'Building2' },
      { id: 'performance.provider_performance.view', label: 'Performance: Provider Performance', description: 'Access to the Provider Performance page', icon: 'UserCheck' },
      { id: 'performance.monthly_trends.view', label: 'Performance: Monthly Trends', description: 'Access to the Monthly Analytics page', icon: 'CalendarDays' },
      { id: 'performance.regional_manager.view', label: 'Performance: Regional Manager', description: 'Access to the Regional Manager / RCM Dashboard page', icon: 'Globe' },
    ],
  },
  {
    id: 'nav_finance',
    label: 'Navigation — Finance',
    icon: 'DollarSign',
    future: true,
    permissions: [
      { id: 'finance.payroll.view', label: 'Finance: Payroll', description: 'Access to the Payroll page', icon: 'Wallet' },
      { id: 'finance.payroll_audit.view', label: 'Finance: Payroll Audit', description: 'Access to the Payroll Audit page', icon: 'ClipboardList' },
      { id: 'finance.payroll_sync.view', label: 'Finance: Payroll Sync', description: 'Access to the Payroll Sync Dashboard', icon: 'RefreshCw' },
      { id: 'finance.finance.view', label: 'Finance: Financial Analytics', description: 'Access to the Financial Analytics page', icon: 'BarChart2' },
      { id: 'finance.expenses.view', label: 'Finance: Expenses', description: 'Access to the Expense Report page', icon: 'Receipt' },
      { id: 'finance.rcm.view', label: 'Finance: RCM', description: 'Access to the RCM page', icon: 'FileText' },
      { id: 'finance.audit.view', label: 'Finance: Transaction Audit', description: 'Access to the Transaction Audit page', icon: 'Search' },
      { id: 'finance.audit_log.view', label: 'Finance: Audit Dashboard', description: 'Access to the Audit Dashboard page', icon: 'ClipboardCheck' },
      { id: 'finance.audit_reports.view', label: 'Finance: Audit Reports', description: 'Access to the Audit Reports page', icon: 'FileBarChart' },
      { id: 'finance.compliance.view', label: 'Finance: Compliance & Retention', description: 'Access to the Compliance & Retention page', icon: 'ShieldCheck' },
      { id: 'finance.heatmap.view', label: 'Finance: Access Heatmap', description: 'Access to the Access Heatmap page', icon: 'Map' },
      { id: 'finance.alerts.view', label: 'Finance: Alert Rules', description: 'Access to the Alert Rules page', icon: 'Bell' },
      { id: 'finance.error_logs.view', label: 'Finance: Error Logs', description: 'Access to the Error Logs page', icon: 'AlertTriangle' },
    ],
  },
  {
    id: 'nav_workflow',
    label: 'Navigation — Workflow',
    icon: 'Workflow',
    future: true,
    permissions: [
      { id: 'workflow.huddle.view', label: 'Workflow: Morning Huddle', description: 'Access to the Morning Huddle page', icon: 'Sun' },
      { id: 'workflow.insurance.view', label: 'Workflow: Insurance Verify', description: 'Access to the Insurance Verify page', icon: 'FileCheck' },
      { id: 'workflow.eod.view', label: 'Workflow: EOD Report', description: 'Access to the EOD Report / Daily Entry Form', icon: 'ClipboardEdit' },
      { id: 'workflow.tasks.view', label: 'Workflow: Team Assignments', description: 'Access to the Team Assignments / Tasks page', icon: 'CheckSquare' },
      { id: 'workflow.eod_queue.view', label: 'Workflow: EOD Approval Queue', description: 'Access to the EOD Approval Queue', icon: 'ListChecks' },
      { id: 'workflow.approvals.view', label: 'Workflow: Pending Approvals', description: 'Access to the Pending Approvals page', icon: 'CheckCircle' },
      { id: 'workflow.huddle_queue.view', label: 'Workflow: Huddle Approvals', description: 'Access to the Huddle Approvals page', icon: 'MessageSquare' },
    ],
  },
  {
    id: 'nav_resources',
    label: 'Navigation — Resources',
    icon: 'FolderOpen',
    future: true,
    permissions: [
      { id: 'resources.reports.view', label: 'Resources: Reports', description: 'Access to the Reports page', icon: 'FileBarChart' },
      { id: 'resources.inventory.view', label: 'Resources: Inventory', description: 'Access to the Inventory Dashboard', icon: 'Package' },
      { id: 'resources.directory.view', label: 'Resources: Staff Directory', description: 'Access to the Staff Directory page', icon: 'Users' },
    ],
  },
  {
    id: 'nav_admin',
    label: 'Navigation — Admin',
    icon: 'Settings',
    future: true,
    permissions: [
      { id: 'admin.users.view', label: 'Admin: Users', description: 'Access to the Users Management page', icon: 'UserCog' },
      { id: 'admin.users.role_editor.view', label: 'Admin: Role Editor', description: 'Access to the Role Permission Editor within Users Management', icon: 'ShieldCog' },
      { id: 'admin.providers.view', label: 'Admin: Providers', description: 'Access to the Manage Providers page', icon: 'Stethoscope' },
      { id: 'admin.settings.view', label: 'Admin: Settings', description: 'Access to the Management & Settings page', icon: 'Settings' },
      { id: 'admin.sync.view', label: 'Admin: Sync Dashboard', description: 'Access to the Sync Dashboard', icon: 'RefreshCw' },
      { id: 'admin.data_health.view', label: 'Admin: Data Health', description: 'Access to the Data Health page', icon: 'HeartPulse' },
      { id: 'admin.import_audit.view', label: 'Admin: Import Audit', description: 'Access to the Import Audit page', icon: 'Upload' },
      { id: 'admin.manual_entry.view', label: 'Admin: Manual Production Entry', description: 'Access to the Manual Production Entry page', icon: 'Edit3' },
      { id: 'admin.system.view', label: 'Admin: System Dashboard', description: 'Access to the Admin System Dashboard', icon: 'Monitor' },
      { id: 'admin.reconciliation.view', label: 'Admin: Reconciliation', description: 'Access to the Dentrix Diagnostics / Reconciliation page', icon: 'GitMerge' },
      { id: 'admin.alert_thresholds.view', label: 'Admin: Alert Thresholds', description: 'Access to the Metric Alert Thresholds page', icon: 'Sliders' },
    ],
  },
  // ── Sub-Tab Access ─────────────────────────────────────────────────────────
  {
    id: 'subtab_payroll',
    label: 'Sub-Tabs — Payroll',
    icon: 'Wallet',
    future: true,
    permissions: [
      { id: 'finance.payroll.dentrix_ascend.view', label: 'Payroll: Dentrix Ascend tab', description: 'Access to the Dentrix Ascend sub-tab inside Payroll', icon: 'Database' },
      { id: 'finance.payroll.gusto.view', label: 'Payroll: Imported from Gusto tab', description: 'Access to the Imported from Gusto sub-tab inside Payroll', icon: 'Users' },
      { id: 'finance.payroll.gusto.overview.view', label: 'Payroll › Gusto: Overview', description: 'Access to the Gusto Overview sub-tab', icon: 'LayoutDashboard' },
      { id: 'finance.payroll.gusto.employees.view', label: 'Payroll › Gusto: Employees', description: 'Access to the Gusto Employees sub-tab', icon: 'Users' },
      { id: 'finance.payroll.gusto.payroll_runs.view', label: 'Payroll › Gusto: Payroll Runs', description: 'Access to the Gusto Payroll Runs sub-tab', icon: 'Play' },
      { id: 'finance.payroll.gusto.contractors.view', label: 'Payroll › Gusto: Contractors', description: 'Access to the Gusto Contractors sub-tab', icon: 'Briefcase' },
      { id: 'finance.payroll.gusto.benefits.view', label: 'Payroll › Gusto: Benefits', description: 'Access to the Gusto Benefits sub-tab', icon: 'Heart' },
      { id: 'finance.payroll.gusto.pay_schedules.view', label: 'Payroll › Gusto: Pay Schedules', description: 'Access to the Gusto Pay Schedules sub-tab', icon: 'Calendar' },
      { id: 'finance.payroll.gusto.import_history.view', label: 'Payroll › Gusto: Import History', description: 'Access to the Gusto Import History sub-tab', icon: 'History' },
      { id: 'finance.payroll.gusto.time_attendance.view', label: 'Payroll › Gusto: Time & Attendance', description: 'Access to the Gusto Time & Attendance sub-tab', icon: 'Clock' },
      { id: 'finance.payroll.comparison.view', label: 'Payroll: Comparison tab', description: 'Access to the Comparison sub-tab inside Payroll', icon: 'GitCompare' },
      { id: 'finance.payroll.provider_compensation.view', label: 'Payroll: Provider Compensation tab', description: 'Access to the Provider Compensation sub-tab inside Payroll', icon: 'DollarSign' },
    ],
  },
  {
    id: 'subtab_operations',
    label: 'Sub-Tabs — Operations',
    icon: 'Activity',
    future: true,
    permissions: [
      { id: 'performance.operations.offices.view', label: 'Operations: Offices tab', description: 'Access to the Offices sub-tab inside Operations', icon: 'Building2' },
      { id: 'performance.operations.production.view', label: 'Operations: Production tab', description: 'Access to the Production sub-tab inside Operations', icon: 'TrendingUp' },
      { id: 'performance.operations.performance.view', label: 'Operations: Performance tab', description: 'Access to the Performance sub-tab inside Operations', icon: 'BarChart2' },
      { id: 'performance.operations.providers.view', label: 'Operations: Providers tab', description: 'Access to the Providers sub-tab inside Operations', icon: 'Stethoscope' },
      { id: 'performance.operations.services.view', label: 'Operations: Services tab', description: 'Access to the Services sub-tab inside Operations', icon: 'Layers' },
      { id: 'performance.operations.payors.view', label: 'Operations: Payors tab', description: 'Access to the Payors sub-tab inside Operations', icon: 'CreditCard' },
      { id: 'performance.operations.trends.view', label: 'Operations: Trends tab', description: 'Access to the Trends sub-tab inside Operations', icon: 'TrendingUp' },
      { id: 'performance.operations.cancellations.view', label: 'Operations: Cancellations tab', description: 'Access to the Cancellations sub-tab inside Operations', icon: 'XCircle' },
      { id: 'performance.operations.ar_aging.view', label: 'Operations: AR Aging tab', description: 'Access to the AR Aging sub-tab inside Operations', icon: 'Clock' },
      { id: 'performance.operations.marketing.view', label: 'Operations: Marketing tab', description: 'Access to the Marketing sub-tab inside Operations', icon: 'Megaphone' },
      { id: 'performance.operations.scorecards.view', label: 'Operations: Scorecards tab', description: 'Access to the Scorecards sub-tab inside Operations', icon: 'Award' },
    ],
  },
  {
    id: 'subtab_finance_analytics',
    label: 'Sub-Tabs — Financial Analytics & Expenses',
    icon: 'BarChart2',
    future: true,
    permissions: [
      { id: 'finance.finance.analytics.view', label: 'Finance: Analytics tab', description: 'Access to the Analytics sub-tab inside Financial Analytics', icon: 'BarChart2' },
      { id: 'finance.finance.production.view', label: 'Finance: Production tab', description: 'Access to the Production & Adjustments sub-tab inside Financial Analytics', icon: 'TrendingUp' },
      { id: 'finance.finance.collections.view', label: 'Finance: Collections tab', description: 'Access to the Collections sub-tab inside Financial Analytics', icon: 'DollarSign' },
      { id: 'finance.finance.service_categories.view', label: 'Finance: Service Categories tab', description: 'Access to the Service Categories sub-tab inside Financial Analytics', icon: 'Tag' },
      { id: 'finance.finance.reconciliation.view', label: 'Finance: Reconciliation tab', description: 'Access to the Dentrix Reconciliation sub-tab inside Financial Analytics', icon: 'GitMerge' },
      { id: 'finance.expenses.overview.view', label: 'Expenses: Overview tab', description: 'Access to the Overview sub-tab inside Expense Report', icon: 'Eye' },
      { id: 'finance.expenses.transactions.view', label: 'Expenses: Transactions tab', description: 'Access to the Transactions sub-tab inside Expense Report', icon: 'List' },
      { id: 'finance.expenses.amex.view', label: 'Expenses: AmEx Detail tab', description: 'Access to the AmEx Detail sub-tab inside Expense Report', icon: 'CreditCard' },
      { id: 'finance.expenses.amex_payments.view', label: 'Expenses: AmEx Payments tab', description: 'Access to the AmEx Payments sub-tab inside Expense Report', icon: 'CreditCard' },
      { id: 'finance.expenses.import.view', label: 'Expenses: Import tab', description: 'Access to the Import sub-tab inside Expense Report', icon: 'Upload' },
    ],
  },
  {
    id: 'subtab_rcm',
    label: 'Sub-Tabs — RCM',
    icon: 'FileText',
    future: true,
    permissions: [
      { id: 'finance.rcm.claims.view', label: 'RCM: Claims tab', description: 'Access to the Claim Submissions sub-tab inside RCM', icon: 'FileText' },
      { id: 'finance.rcm.payment.view', label: 'RCM: Payment Arrangement tab', description: 'Access to the Payment Arrangement sub-tab inside RCM', icon: 'DollarSign' },
      { id: 'finance.rcm.statements.view', label: 'RCM: Patient Statements tab', description: 'Access to the Patient Statements sub-tab inside RCM', icon: 'FileText' },
      { id: 'finance.rcm.pos.view', label: 'RCM: Point of Service tab', description: 'Access to the Point of Service Collection sub-tab inside RCM', icon: 'CreditCard' },
      { id: 'finance.rcm.adjustment.view', label: 'RCM: Adjustment tab', description: 'Access to the Adjustment sub-tab inside RCM', icon: 'Edit3' },
      { id: 'finance.rcm.dashboard.view', label: 'RCM: Dashboard tab', description: 'Access to the Dashboard sub-tab inside RCM', icon: 'LayoutDashboard' },
      { id: 'finance.rcm.ar_aging.view', label: 'RCM: AR Aging tab', description: 'Access to the AR Aging sub-tab inside RCM', icon: 'Clock' },
      { id: 'finance.rcm.refund.view', label: 'RCM: Collection Refund tab', description: 'Access to the Collection Refund sub-tab inside RCM', icon: 'RotateCcw' },
      { id: 'finance.rcm.daily_comparison.view', label: 'RCM: Daily Comparison tab', description: 'Access to the Daily Comparison sub-tab inside RCM', icon: 'GitCompare' },
      { id: 'finance.rcm.eassist_daily.view', label: 'RCM: eAssist Daily Summary tab', description: 'Access to the eAssist Daily Summary sub-tab inside RCM', icon: 'FileCheck' },
    ],
  },
  {
    id: 'subtab_kpis_monthly',
    label: 'Sub-Tabs — KPIs & Monthly Trends',
    icon: 'BarChart2',
    future: true,
    permissions: [
      { id: 'performance.kpis.main.view', label: 'KPIs: Main tab', description: 'Access to the Main KPI cards sub-tab', icon: 'BarChart2' },
      { id: 'performance.kpis.specialty.view', label: 'KPIs: Specialty tab', description: 'Access to the Specialty sub-tab inside KPIs', icon: 'Star' },
      { id: 'performance.kpis.providers.view', label: 'KPIs: Providers tab', description: 'Access to the Providers sub-tab inside KPIs', icon: 'Stethoscope' },
      { id: 'performance.kpis.specialty_providers.view', label: 'KPIs: Specialty Providers tab', description: 'Access to the Specialty Providers sub-tab inside KPIs', icon: 'UserCheck' },
      { id: 'performance.monthly_trends.summary.view', label: 'Monthly Trends: Executive Summary tab', description: 'Access to the Executive Summary sub-tab inside Monthly Analytics', icon: 'FileText' },
      { id: 'performance.monthly_trends.import_export.view', label: 'Monthly Trends: Import/Export tab', description: 'Access to the Legacy Import/Export sub-tab inside Monthly Analytics', icon: 'ArrowUpDown' },
      { id: 'performance.monthly_trends.manual_override.view', label: 'Monthly Trends: Manual Override tab', description: 'Access to the Legacy Manual Override sub-tab inside Monthly Analytics', icon: 'Edit3' },
    ],
  },
  {
    id: 'subtab_office_performance',
    label: 'Sub-Tabs — Office Performance',
    icon: 'Building2',
    future: true,
    permissions: [
      { id: 'performance.office_performance.revenue.view', label: 'Office Performance: Revenue tab', description: 'Access to the Revenue Trends sub-tab inside Office Performance', icon: 'TrendingUp' },
      { id: 'performance.office_performance.expenses.view', label: 'Office Performance: Expenses tab', description: 'Access to the Expenses sub-tab inside Office Performance', icon: 'Receipt' },
      { id: 'performance.office_performance.productivity.view', label: 'Office Performance: Productivity tab', description: 'Access to the Productivity sub-tab inside Office Performance', icon: 'Activity' },
    ],
  },
  {
    id: 'subtab_reports_inventory',
    label: 'Sub-Tabs — Reports & Inventory',
    icon: 'FolderOpen',
    future: true,
    permissions: [
      { id: 'resources.reports.pl_summary.view', label: 'Reports: P&L Summary tab', description: 'Access to the P&L Summary sub-tab inside Reports', icon: 'FileBarChart' },
      { id: 'resources.reports.office_breakdown.view', label: 'Reports: Office Breakdown tab', description: 'Access to the Detailed Breakdown sub-tab inside Reports', icon: 'Building2' },
      { id: 'resources.reports.goal_leaderboard.view', label: 'Reports: Goal Leaderboard tab', description: 'Access to the Goal Leaderboard sub-tab inside Reports', icon: 'Award' },
      { id: 'resources.reports.period_comparison.view', label: 'Reports: Period Comparison tab', description: 'Access to the Period Comparison sub-tab inside Reports', icon: 'GitCompare' },
      { id: 'resources.reports.revenue_by_provider.view', label: 'Reports: Revenue by Provider tab', description: 'Access to the Revenue by Provider sub-tab inside Reports', icon: 'Stethoscope' },
      { id: 'resources.inventory.overview.view', label: 'Inventory: Overview tab', description: 'Access to the Overview sub-tab inside Inventory Dashboard', icon: 'Eye' },
      { id: 'resources.inventory.bone_tissue.view', label: 'Inventory: Bone & Tissue tab', description: 'Access to the Bone & Tissue Inventory sub-tab', icon: 'Package' },
      { id: 'resources.inventory.implant.view', label: 'Inventory: Implant tab', description: 'Access to the Implant Inventory sub-tab', icon: 'Package' },
      { id: 'resources.inventory.front_desk.view', label: 'Inventory: Front Desk tab', description: 'Access to the Front Desk sub-tab inside Inventory Dashboard', icon: 'ConciergeBell' },
      { id: 'resources.inventory.usage_log.view', label: 'Inventory: Usage Log tab', description: 'Access to the Usage Log sub-tab inside Inventory Dashboard', icon: 'History' },
      { id: 'resources.inventory.bulk_import.view', label: 'Inventory: Bulk Import tab', description: 'Access to the Bulk Import sub-tab inside Inventory Dashboard', icon: 'Upload' },
      { id: 'resources.inventory.settings.view', label: 'Inventory: Settings tab', description: 'Access to the Settings sub-tab inside Inventory Dashboard', icon: 'Settings' },
      { id: 'resources.inventory.reports.view', label: 'Inventory: Reports tab', description: 'Access to the Reports sub-tab inside Inventory Dashboard', icon: 'FileBarChart' },
      { id: 'resources.inventory.monthly_supply.view', label: 'Inventory: Monthly Supply tab', description: 'Access to the Monthly Supply sub-tab inside Inventory Dashboard', icon: 'CalendarDays' },
    ],
  },
];

// Flat list of all EXISTING (enforced) permissions for counting
const ALL_PERMISSIONS = PERMISSION_SECTIONS?.flatMap(s => s?.permissions);

// Flat list of all FUTURE (not-yet-enforced) permissions
const ALL_FUTURE_PERMISSIONS = FUTURE_PERMISSION_SECTIONS?.flatMap(s => s?.permissions);

// ─── ACTION & HIDDEN PERMISSION SECTION ──────────────────────────────────────
// These keys exist in the DB (role_permissions) but are NOT rendered in any
// existing visible section. They are exposed here so Dr. G can manually toggle
// them. No new keys are created — only existing DB rows are surfaced.
//
// Display order (top-to-bottom):
//   A. Office Scope
//   B. Insurance Verify Actions
//   C. Any additional unknown hidden keys (catch-all, rendered dynamically)
const ACTION_HIDDEN_KNOWN_KEYS = [
  // ── A. Office Scope ────────────────────────────────────────────────────────
  {
    id: 'view_all_offices',
    label: 'View All Offices',
    description: 'Allows this role to see/select all offices instead of only assigned offices.',
    icon: 'Globe',
    badge: 'elevated',
    badgeColor: 'warning',
    tooltip: 'Elevated: Grants cross-office data access. Toggling ON exposes data across all office locations.',
  },
  {
    id: 'office_scoped',
    label: 'Office Scoped',
    description: 'Internal/legacy office-scoping permission.',
    icon: 'Building2',
    badge: 'internal / legacy',
    badgeColor: 'slate',
  },
  // ── B. Insurance Verify Actions ────────────────────────────────────────────
  {
    id: 'workflow.insurance.assign',
    label: 'Insurance: Assign',
    description: 'Allows assigning insurance verification requests.',
    icon: 'UserCheck',
  },
  {
    id: 'workflow.insurance.submit',
    label: 'Insurance: Submit',
    description: 'Allows submitting insurance verification requests.',
    icon: 'Send',
  },
  {
    id: 'workflow.insurance.complete',
    label: 'Insurance: Complete',
    description: 'Allows marking insurance verification requests complete.',
    icon: 'CheckCircle',
  },
  {
    id: 'workflow.insurance.cancel',
    label: 'Insurance: Cancel',
    description: 'Allows canceling insurance verification requests.',
    icon: 'XCircle',
  },
  {
    id: 'workflow.insurance.email_office',
    label: 'Insurance: Email Office',
    description: 'Allows emailing insurance verification information/PDF to the office.',
    icon: 'Mail',
  },
  {
    id: 'workflow.insurance.mark_uploaded',
    label: 'Insurance: Mark Uploaded',
    description: 'Allows marking a verification as uploaded.',
    icon: 'Upload',
  },
  {
    id: 'workflow.insurance.upload_to_dentrix',
    label: 'Insurance: Upload to Dentrix',
    description: 'Elevated Dentrix write action.',
    icon: 'Database',
    badge: 'Dentrix write / elevated',
    badgeColor: 'warning',
    tooltip: 'Elevated: Triggers a Dentrix upload action. Keep OFF unless explicitly approved.',
  },
];

// Set of all known visible permission IDs (used to compute hidden keys per role)
const ALL_VISIBLE_PERMISSION_IDS = new Set([
  ...ALL_PERMISSIONS?.map(p => p?.id),
  ...EXECUTIVE_SECTION?.permissions?.map(p => p?.id),
  ...ALL_FUTURE_PERMISSIONS?.map(p => p?.id),
]);

// Set of known hidden key IDs (the ones we explicitly define above)
const ACTION_HIDDEN_KNOWN_IDS = new Set(ACTION_HIDDEN_KNOWN_KEYS?.map(k => k?.id));

// Build a lookup map: permissionId → label (for diff display)
const ALL_PERM_LABEL_MAP = {};
[...ALL_PERMISSIONS, ...EXECUTIVE_SECTION?.permissions, ...ALL_FUTURE_PERMISSIONS, ...ACTION_HIDDEN_KNOWN_KEYS]?.forEach(p => {
  ALL_PERM_LABEL_MAP[p.id] = p?.label;
});

// ─── STALE KEY BADGE ─────────────────────────────────────────────────────────
const StaleKeyBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 ml-1.5 leading-none">
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4.5" cy="4.5" r="4" stroke="#d97706" strokeWidth="1"/>
      <path d="M4.5 2.5v2.5" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="4.5" cy="6.5" r="0.5" fill="#d97706"/>
    </svg>
    stale/shadow
  </span>
);

// ─── HIDDEN PERMISSION BADGE ──────────────────────────────────────────────────
const HiddenPermBadge = ({ text, color }) => {
  const colorMap = {
    warning: 'bg-amber-100 text-amber-700 border-amber-300',
    slate: 'bg-slate-100 text-slate-500 border-slate-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
  };
  const cls = colorMap?.[color] || colorMap?.slate;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1.5 leading-none ${cls}`}>
      {text}
    </span>
  );
};

// ─── HIDDEN PERMISSION TOGGLE ─────────────────────────────────────────────────
// Renders a toggle for a hidden/action permission key that exists in the DB
// but is not part of any existing visible section.
const HiddenPermToggle = ({ perm, enabled, onChange, disabled, isSuperAdminRole }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isEffectivelyDisabled = disabled || isSuperAdminRole;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
      isSuperAdminRole
        ? 'bg-slate-50 border-slate-200 opacity-75'
        : enabled
          ? 'bg-violet-50 border-violet-200'
          : 'bg-muted/30 border-border'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
          isSuperAdminRole ? 'bg-slate-100' : enabled ? 'bg-violet-100' : 'bg-muted'
        }`}>
          <Icon name={perm?.icon || 'Key'} size={15} color={isSuperAdminRole ? '#94a3b8' : enabled ? '#7c3aed' : 'var(--color-muted-foreground)'} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-1">
            <p className={`text-sm font-medium ${isSuperAdminRole ? 'text-slate-400' : 'text-foreground'}`}>{perm?.label}</p>
            {perm?.badge && <HiddenPermBadge text={perm?.badge} color={perm?.badgeColor} />}
            {isSuperAdminRole && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-300 leading-none">
                decorative
              </span>
            )}
            {perm?.tooltip && (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  className="w-4 h-4 rounded-full bg-warning/20 flex items-center justify-center text-warning hover:bg-warning/30 transition-colors"
                  aria-label="Permission warning"
                >
                  <Icon name="AlertTriangle" size={10} color="var(--color-warning)" />
                </button>
                {showTooltip && (
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 p-2.5 bg-foreground text-background text-xs rounded-lg shadow-lg">
                    <div className="flex items-start gap-1.5">
                      <Icon name="AlertTriangle" size={12} color="var(--color-warning)" className="flex-shrink-0 mt-0.5" />
                      <span>{perm?.tooltip}</span>
                    </div>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
          <p className={`text-xs ${isSuperAdminRole ? 'text-slate-400' : 'text-muted-foreground'}`}>{perm?.description}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60">{perm?.id}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={isEffectivelyDisabled}
        onClick={() => !isSuperAdminRole && onChange(perm?.id, !enabled)}
        title={isSuperAdminRole ? 'Super admin uses __all runtime bypass — DB toggles have no effect' : undefined}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-3 ${
          isSuperAdminRole ? 'bg-slate-200 cursor-not-allowed' : enabled ? 'bg-violet-500' : 'bg-border'
        }`}
        aria-label={`Toggle ${perm?.label}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
};

// ─── PERMISSION TOGGLE ────────────────────────────────────────────────────────
const PermissionToggle = ({ permission, enabled, onChange, disabled, isSuperAdminRole }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isStale = STALE_KEYS?.has(permission?.id);
  // super_admin toggles are always disabled — DB values have no runtime effect
  const isEffectivelyDisabled = disabled || isSuperAdminRole;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
      isSuperAdminRole
        ? 'bg-slate-50 border-slate-200 opacity-75' : enabled ?'bg-success/5 border-success/20' : 'bg-muted/30 border-border'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
          isSuperAdminRole ? 'bg-slate-100' : enabled ? 'bg-success/10' : 'bg-muted'
        }`}>
          <Icon name={permission?.icon} size={15} color={isSuperAdminRole ? '#94a3b8' : enabled ? 'var(--color-success)' : 'var(--color-muted-foreground)'} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-1">
            <p className={`text-sm font-medium ${isSuperAdminRole ? 'text-slate-400' : 'text-foreground'}`}>{permission?.label}</p>
            {isStale && <StaleKeyBadge />}
            {isSuperAdminRole && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-300 leading-none">
                decorative
              </span>
            )}
            {permission?.tooltip && (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  className="w-4 h-4 rounded-full bg-warning/20 flex items-center justify-center text-warning hover:bg-warning/30 transition-colors"
                  aria-label="Permission warning"
                >
                  <Icon name="AlertTriangle" size={10} color="var(--color-warning)" />
                </button>
                {showTooltip && (
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 p-2.5 bg-foreground text-background text-xs rounded-lg shadow-lg">
                    <div className="flex items-start gap-1.5">
                      <Icon name="AlertTriangle" size={12} color="var(--color-warning)" className="flex-shrink-0 mt-0.5" />
                      <span>{permission?.tooltip}</span>
                    </div>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
          <p className={`text-xs ${isSuperAdminRole ? 'text-slate-400' : 'text-muted-foreground'}`}>{permission?.description}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={isEffectivelyDisabled}
        onClick={() => !isSuperAdminRole && onChange(permission?.id, !enabled)}
        title={isSuperAdminRole ? 'Super admin uses __all runtime bypass — DB toggles have no effect' : undefined}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-3 ${
          isSuperAdminRole ? 'bg-slate-200 cursor-not-allowed' : enabled ? 'bg-success' : 'bg-border'
        }`}
        aria-label={`Toggle ${permission?.label}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
};

// ─── SAVE CONFIRMATION DIALOG ─────────────────────────────────────────────────
const SaveConfirmDialog = ({ isOpen, roleName, isSuperAdminRole, changedKeys, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Icon name="ShieldAlert" size={16} color="var(--color-warning)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Confirm Permission Save</h3>
            <p className="text-xs text-muted-foreground">Review changes before saving</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {isSuperAdminRole && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <Icon name="Info" size={14} color="#64748b" className="flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Super Admin note:</span> These DB values are decorative. Super admin uses the <code className="bg-slate-100 px-1 rounded text-[10px]">__all</code> runtime bypass — saving will not change super admin access.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-foreground mb-1">
              Role: <span className="text-primary">{roleName}</span>
            </p>
            {changedKeys?.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No changes detected.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">{changedKeys?.length} permission{changedKeys?.length !== 1 ? 's' : ''} changed:</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {changedKeys?.map(({ id, label, before, after }) => (
                    <div key={id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 border border-border">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{label}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${before ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {before ? 'ON' : 'OFF'}
                        </span>
                        <Icon name="ArrowRight" size={10} color="var(--color-muted-foreground)" />
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${after ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {after ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" onClick={onCancel} size="sm">Cancel</Button>
          <Button
            variant="default"
            onClick={onConfirm}
            size="sm"
            disabled={changedKeys?.length === 0}
          >
            {changedKeys?.length === 0 ? 'No Changes' : `Save ${roleName}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── ROLE EDITOR MODAL ────────────────────────────────────────────────────────
const RoleEditorModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState('admin');
  const [permissions, setPermissions] = useState({});
  const [savedPermissions, setSavedPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showFutureSections, setShowFutureSections] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await rolePermissionsService?.getAll();
      const grouped = {};
      data?.forEach((p) => {
        if (!grouped?.[p?.role]) grouped[p.role] = {};
        grouped[p.role][p.permission] = p?.enabled;
      });
      // Ensure all roles/permissions have defaults
      const allPermsWithExecutive = [
        ...ALL_PERMISSIONS,
        ...EXECUTIVE_SECTION?.permissions,
        ...ALL_FUTURE_PERMISSIONS,
      ];
      ROLES?.forEach((r) => {
        if (!grouped?.[r?.id]) grouped[r.id] = {};
        allPermsWithExecutive?.forEach((p) => {
          if (grouped?.[r?.id]?.[p?.id] === undefined) {
            grouped[r.id][p.id] = p?.id === 'dashboard:executive_overview'
              ? r?.id === 'super_admin'
              : false;
          }
        });
      });
      setPermissions(grouped);
      // Deep-clone for before/after diff tracking
      setSavedPermissions(JSON.parse(JSON.stringify(grouped)));
    } catch (err) {
      setError(err?.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
      setSaveSuccess(false);
    }
  }, [isOpen, loadPermissions]);

  const handleToggle = (permissionId, value) => {
    setPermissions((prev) => ({
      ...prev,
      [activeRole]: { ...prev?.[activeRole], [permissionId]: value },
    }));
    setSaveSuccess(false);
  };

  // Compute changed keys between current state and last-saved state for a given role
  const getChangedKeys = (role) => {
    const current = permissions?.[role] || {};
    const saved = savedPermissions?.[role] || {};
    const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)]);
    const changed = [];
    allKeys?.forEach(id => {
      const before = !!saved?.[id];
      const after = !!current?.[id];
      if (before !== after) {
        changed?.push({ id, label: ALL_PERM_LABEL_MAP?.[id] || id, before, after });
      }
    });
    return changed;
  };

  const handleSaveClick = () => {
    const changedKeys = getChangedKeys(activeRole);
    if (changedKeys?.length === 0) {
      // No changes — show dialog to inform user
      setConfirmDialog({ open: true, changedKeys: [] });
      return;
    }
    setConfirmDialog({ open: true, changedKeys });
  };

  const handleConfirmSave = async () => {
    const changedKeys = confirmDialog?.changedKeys || [];
    if (changedKeys?.length === 0) {
      setConfirmDialog({ open: false });
      return;
    }
    const saveBatchId = crypto.randomUUID();
    setConfirmDialog({ open: false });
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      await rolePermissionsService?.saveRolePermissions(activeRole, permissions?.[activeRole] || {});
      // Update saved snapshot for this role
      setSavedPermissions(prev => ({
        ...prev,
        [activeRole]: { ...(permissions?.[activeRole] || {}) },
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Fire-and-forget audit log — never blocks or rolls back the save
      try {
        await rolePermissionsService?.logPermissionChanges({
          actorId: user?.id || null,
          targetRole: activeRole,
          changedKeys,
          saveBatchId,
          source: 'role_editor',
        });
      } catch (auditErr) {
        console.warn('[RoleEditor] Audit log insert failed (non-blocking):', auditErr);
      }
    } catch (err) {
      setError(err?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // handleSaveAll is intentionally kept but NOT wired to any active button
  // eslint-disable-next-line no-unused-vars
  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      await Promise.all(
        ROLES?.map((r) => rolePermissionsService?.saveRolePermissions(r?.id, permissions?.[r?.id] || {}))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const activeRoleData = ROLES?.find((r) => r?.id === activeRole);
  const activePerms = permissions?.[activeRole] || {};
  const enabledCount = Object.values(activePerms)?.filter(Boolean)?.length;
  const isSuperAdminRole = activeRole === 'super_admin';

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Icon name="ShieldCog" size={18} color="var(--color-warning)" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Role Permission Editor</h2>
                <p className="text-xs text-muted-foreground">Super Admin only — configure access for each role</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* ── SAFETY WARNING BANNER ── */}
          <div className="mx-4 mt-3 flex-shrink-0 flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-300">
            <Icon name="AlertTriangle" size={15} color="#d97706" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Role permissions affect dashboard access.</span>{' '}
              Some legacy keys may be navigation-only or not enforced yet. Keys labeled{' '}
              <span className="inline-flex items-center gap-0.5 font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1 rounded text-[10px]">stale/shadow</span>{' '}
              may not change actual access. Super admin access is protected by a system{' '}
              <code className="bg-amber-100 px-1 rounded text-[10px]">__all</code> runtime bypass — DB toggles do not affect super admin.
            </p>
          </div>

          {/* ── SUPER ADMIN PROTECTED NOTICE ── */}
          {isSuperAdminRole && (
            <div className="mx-4 mt-2 flex-shrink-0 flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-300">
              <Icon name="ShieldAlert" size={15} color="#64748b" className="flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                <p>
                  <span className="font-semibold text-slate-800">Super Admin — Protected / Decorative.</span>{' '}
                  Super admin uses the <code className="bg-slate-100 px-1 rounded text-[10px]">__all</code> runtime bypass.
                  All permission checks return <code className="bg-slate-100 px-1 rounded text-[10px]">true</code> for super admin regardless of DB values.
                </p>
                <p className="text-slate-500">
                  Toggles shown below are read-only and reflect DB state only. Saving super admin rows has <span className="font-semibold">no runtime effect</span> on dashboard access.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-1 min-h-0 mt-2">
            {/* Role Selector Sidebar */}
            <div className="w-48 border-r border-border flex-shrink-0 p-3 space-y-1 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Roles</p>
              {ROLES?.map((role) => {
                const rolePerms = permissions?.[role?.id] || {};
                const count = Object.values(rolePerms)?.filter(Boolean)?.length;
                const isSA = role?.id === 'super_admin';
                return (
                  <button
                    key={role?.id}
                    onClick={() => setActiveRole(role?.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      activeRole === role?.id
                        ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                      activeRole === role?.id ? 'bg-primary/20' : role?.bg
                    }`}>
                      <Icon name={role?.icon} size={14} color={activeRole === role?.id ? 'var(--color-primary)' : 'currentColor'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{role?.label}</p>
                        {isSA && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 leading-none flex-shrink-0">
                            bypass
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{count}/{ALL_PERMISSIONS?.length + EXECUTIVE_SECTION?.permissions?.length + ALL_FUTURE_PERMISSIONS?.length + Object.keys(permissions?.[role?.id] || {})?.filter(k => !ALL_VISIBLE_PERMISSION_IDS?.has(k))?.length} on</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Permissions Panel */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${activeRoleData?.bg}`}>
                      <Icon name={activeRoleData?.icon || 'Shield'} size={14} color="currentColor" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{activeRoleData?.label}</p>
                        {isSuperAdminRole && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-300 leading-none">
                            __all bypass — DB values decorative
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{activeRoleData?.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    enabledCount > 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {enabledCount} of {ALL_PERMISSIONS?.length + EXECUTIVE_SECTION?.permissions?.length + ALL_FUTURE_PERMISSIONS?.length + Object.keys(activePerms)?.filter(k => !ALL_VISIBLE_PERMISSION_IDS?.has(k))?.length} enabled
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : (
                  <>
                    {/* ── EXISTING ENFORCED SECTIONS ── */}
                    {PERMISSION_SECTIONS?.map((section) => (
                      <div key={section?.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon name={section?.icon} size={13} color="var(--color-primary)" />
                          </div>
                          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{section?.label}</h3>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="space-y-2">
                          {section?.permissions?.map((perm) => (
                            <PermissionToggle
                              key={perm?.id}
                              permission={perm}
                              enabled={!!activePerms?.[perm?.id]}
                              onChange={handleToggle}
                              disabled={saving}
                              isSuperAdminRole={isSuperAdminRole}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Executive & Ownership Access — Super Admin only */}
                    {isSuperAdminRole && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center flex-shrink-0">
                            <Icon name={EXECUTIVE_SECTION?.icon} size={13} color="var(--color-warning)" />
                          </div>
                          <h3 className="text-xs font-semibold text-warning uppercase tracking-wider">{EXECUTIVE_SECTION?.label}</h3>
                          <div className="flex-1 h-px bg-warning/20" />
                          <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-medium">decorative — bypass active</span>
                        </div>
                        <div className="space-y-2">
                          {EXECUTIVE_SECTION?.permissions?.map((perm) => (
                            <PermissionToggle
                              key={perm?.id}
                              permission={perm}
                              enabled={!!activePerms?.[perm?.id]}
                              onChange={handleToggle}
                              disabled={saving}
                              isSuperAdminRole={isSuperAdminRole}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── ENFORCED NAVIGATION & SUB-TAB SECTIONS ── */}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowFutureSections(v => !v)}
                        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition-colors text-left"
                      >
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 flex-shrink-0">
                          <Icon name={showFutureSections ? 'ChevronDown' : 'ChevronRight'} size={12} color="#d97706" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-700">
                            Navigation &amp; Sub-Tab Access — Enforced
                          </p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            Navigation and sub-tab permissions are enforced for supported dashboard modules.
                          </p>
                        </div>
                        <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          Enforced
                        </span>
                      </button>

                      {showFutureSections && (
                        <div className="mt-3 space-y-5">
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <Icon name="Info" size={14} color="#2563eb" className="flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700">
                              These permissions control dashboard navigation, direct page access, and supported internal tabs/sub-tabs. Changes take effect after saving the role and refreshing/reloading the affected user session.
                            </p>
                          </div>

                          {FUTURE_PERMISSION_SECTIONS?.map((section) => {
                            const isNavWorkflow = section?.id === 'nav_workflow';
                            return (
                              <React.Fragment key={section?.id}>
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                                      <Icon name={section?.icon} size={13} color="#d97706" />
                                    </div>
                                    <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{section?.label}</h3>
                                    <div className="flex-1 h-px bg-amber-200" />
                                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-medium">enforced</span>
                                  </div>
                                  <div className="space-y-2">
                                    {section?.permissions?.map((perm) => (
                                      <PermissionToggle
                                        key={perm?.id}
                                        permission={perm}
                                        enabled={!!activePerms?.[perm?.id]}
                                        onChange={handleToggle}
                                        disabled={saving}
                                        isSuperAdminRole={isSuperAdminRole}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {/* ── ACTION & HIDDEN PERMISSIONS — injected after nav_workflow ── */}
                                {isNavWorkflow && (() => {
                                  // Compute which hidden keys exist for this role in the DB
                                  const roleDbKeys = Object.keys(activePerms);
                                  const knownHiddenForRole = ACTION_HIDDEN_KNOWN_KEYS?.filter(k => roleDbKeys?.includes(k?.id));
                                  // Catch-all: any DB key not in visible sections and not in known hidden list
                                  const unknownHiddenForRole = roleDbKeys?.filter(
                                    k => !ALL_VISIBLE_PERMISSION_IDS?.has(k) && !ACTION_HIDDEN_KNOWN_IDS?.has(k)
                                  );
                                  if (knownHiddenForRole?.length === 0 && unknownHiddenForRole?.length === 0) return null;
                                  return (
                                    <div className="border border-violet-200 rounded-lg overflow-hidden">
                                      {/* Section header */}
                                      <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border-b border-violet-200">
                                        <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center flex-shrink-0">
                                          <Icon name="EyeOff" size={13} color="#7c3aed" />
                                        </div>
                                        <h3 className="text-xs font-semibold text-violet-700 uppercase tracking-wider flex-1">Action &amp; Hidden Permissions</h3>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 border border-violet-300 leading-none">
                                          hidden from visible count
                                        </span>
                                      </div>
                                      <div className="p-3 bg-violet-50/30">
                                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-violet-50 border border-violet-200 mb-3">
                                          <Icon name="Info" size={13} color="#7c3aed" className="flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-violet-700">
                                            These permission keys exist in the DB for this role but are not shown in any other section. Toggle them here to enable or disable. No new keys are created — only existing DB rows are surfaced.
                                          </p>
                                        </div>
                                        <div className="space-y-2">
                                          {knownHiddenForRole?.map((perm) => (
                                            <HiddenPermToggle
                                              key={perm?.id}
                                              perm={perm}
                                              enabled={!!activePerms?.[perm?.id]}
                                              onChange={handleToggle}
                                              disabled={saving}
                                              isSuperAdminRole={isSuperAdminRole}
                                            />
                                          ))}
                                          {unknownHiddenForRole?.map((keyId) => (
                                            <HiddenPermToggle
                                              key={keyId}
                                              perm={{
                                                id: keyId,
                                                label: keyId,
                                                description: 'Unknown/internal permission key.',
                                                icon: 'Key',
                                                badge: 'internal / unknown',
                                                badgeColor: 'slate',
                                              }}
                                              enabled={!!activePerms?.[keyId]}
                                              onChange={handleToggle}
                                              disabled={saving}
                                              isSuperAdminRole={isSuperAdminRole}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
              {!loading && enabledCount > 0 && (
                <div className="px-4 py-2 bg-muted/30 border-t border-border flex-shrink-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{activeRoleData?.label}</span> can:{' '}
                    {[...ALL_PERMISSIONS, ...EXECUTIVE_SECTION?.permissions]
                      ?.filter((p) => activePerms?.[p?.id])
                      ?.map((p) => p?.label)
                      ?.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              {error && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <Icon name="AlertCircle" size={14} />
                  <span className="text-xs">{error}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-success">
                  <Icon name="CheckCircle" size={14} />
                  <span className="text-xs">Permissions saved successfully</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
              {/* Save All Roles — DISABLED pending audit logging and rollback */}
              <div className="relative group">
                <Button
                  variant="ghost"
                  disabled
                  className="opacity-50 cursor-not-allowed"
                  title="Bulk save disabled until permission audit logging and rollback are complete."
                >
                  Save All Roles
                </Button>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2.5 bg-foreground text-background text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  <div className="flex items-start gap-1.5">
                    <Icon name="Lock" size={11} color="var(--color-warning)" className="flex-shrink-0 mt-0.5" />
                    <span>Bulk save disabled until permission audit logging and rollback are complete.</span>
                  </div>
                  <div className="absolute right-4 top-full border-4 border-transparent border-t-foreground" />
                </div>
              </div>
              {isSuperAdminRole ? (
                <div className="relative group">
                  <Button
                    variant="default"
                    disabled
                    className="opacity-50 cursor-not-allowed"
                    title="Super admin DB values are decorative — __all bypass is always active."
                  >
                    Save Super Admin
                  </Button>
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-2.5 bg-foreground text-background text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <div className="flex items-start gap-1.5">
                      <Icon name="ShieldAlert" size={11} color="var(--color-warning)" className="flex-shrink-0 mt-0.5" />
                      <span>Super admin uses <code className="bg-white/10 px-0.5 rounded">__all</code> runtime bypass. These DB values are decorative and saving has no runtime effect on super admin access.</span>
                    </div>
                    <div className="absolute right-4 top-full border-4 border-transparent border-t-foreground" />
                  </div>
                </div>
              ) : (
                <Button variant="default" onClick={handleSaveClick} loading={saving} disabled={loading}>
                  Save {activeRoleData?.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Save Confirmation Dialog */}
      <SaveConfirmDialog
        isOpen={confirmDialog?.open}
        roleName={activeRoleData?.label}
        isSuperAdminRole={isSuperAdminRole}
        changedKeys={confirmDialog?.changedKeys || []}
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmDialog({ open: false })}
      />
    </>
  );
};

export default RoleEditorModal;
