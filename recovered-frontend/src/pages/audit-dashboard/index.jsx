import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_META = {
  CREATE:        { label: 'Create',        color: 'bg-success/10 text-success border-success/20' },
  UPDATE:        { label: 'Update',        color: 'bg-primary/10 text-primary border-primary/20' },
  DELETE:        { label: 'Delete',        color: 'bg-destructive/10 text-destructive border-destructive/20' },
  SOFT_DELETE:   { label: 'Delete',        color: 'bg-destructive/10 text-destructive border-destructive/20' },
  INVITE:        { label: 'Invite',        color: 'bg-accent/10 text-accent-foreground border-accent/20' },
  TOGGLE_ACTIVE: { label: 'Status Change', color: 'bg-warning/10 text-warning border-warning/20' },
  APPROVE:       { label: 'Approve',       color: 'bg-success/10 text-success border-success/20' },
  EXPORT:        { label: 'Export',        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  EDIT:          { label: 'Edit',          color: 'bg-primary/10 text-primary border-primary/20' },
  VIEW:          { label: 'View',          color: 'bg-muted text-muted-foreground border-border' },
};

const RESOURCE_LABELS = {
  user_profiles:    'Users & Staff',
  offices:          'Offices',
  providers:        'Providers',
  cost_drivers:     'Cost Drivers',
  daily_entries:    'Daily Entries',
  action_items:     'Team Tasks',
  huddles:          'Morning Huddles',
  supply_requests:  'Supply Requests',
  back_staff_orders:'Back Staff Orders',
  implant_inventory:'Implant Inventory',
  bone_tissue_stock:'Bone & Tissue',
  monthly_executive_analytics: 'Monthly Analytics',
};

const DATE_RANGE_OPTIONS = [
  { value: 'today',    label: 'Today' },
  { value: '7d',       label: 'Last 7 Days' },
  { value: '30d',      label: 'Last 30 Days' },
  { value: '90d',      label: 'Last 90 Days' },
  { value: 'all',      label: 'All Time' },
];

const PAGE_SIZE = 50;

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  regional_manager: 2,
  regional_clinical_manager: 2,
  office_manager: 1,
  staff: 0,
};

const getRoleLevel = (role) => ROLE_HIERARCHY?.[role] ?? 0;

/**
 * Sensitive fields that staff/office_managers should not see in diff views.
 * These are redacted when the viewer's role is below admin.
 */
const SENSITIVE_FIELDS = ['password', 'encrypted_password', 'role', 'salary', 'ssn', 'bank_account', 'phone'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTs = (ts) => {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d, yyyy h:mm a'); } catch { return ts; }
};

const getDateFilter = (range) => {
  const now = new Date();
  if (range === 'today') return { gte: startOfDay(now)?.toISOString(), lte: endOfDay(now)?.toISOString() };
  if (range === '7d')    return { gte: subDays(now, 7)?.toISOString() };
  if (range === '30d')   return { gte: subDays(now, 30)?.toISOString() };
  if (range === '90d')   return { gte: subDays(now, 90)?.toISOString() };
  return null;
};

const redactSensitiveFields = (values, viewerRole) => {
  if (!values) return values;
  if (getRoleLevel(viewerRole) >= getRoleLevel('admin')) return values;
  const redacted = { ...values };
  SENSITIVE_FIELDS?.forEach(field => {
    if (field in redacted) redacted[field] = '[REDACTED]';
  });
  return redacted;
};

// ─── Role Access Banner ───────────────────────────────────────────────────────

const RoleAccessBanner = ({ role }) => {
  const messages = {
    staff: { icon: 'User', text: 'You are viewing your own activity only.', color: 'bg-blue-500/10 border-blue-500/20 text-blue-700' },
    office_manager: { icon: 'Building2', text: 'You are viewing audit logs for your office.', color: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700' },
  };
  const msg = messages?.[role];
  if (!msg) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${msg?.color}`}>
      <Icon name={msg?.icon} size={15} />
      <span>{msg?.text}</span>
    </div>
  );
};

// ─── ActionBadge ─────────────────────────────────────────────────────────────

const ActionBadge = ({ action }) => {
  const meta = ACTION_META?.[action] || { label: action, color: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.color}`}>
      {meta?.label}
    </span>
  );
};

// ─── DiffView ─────────────────────────────────────────────────────────────────

const IGNORED_KEYS = ['updated_at', 'created_at', 'id'];

const DiffView = ({ oldValues, newValues, viewerRole }) => {
  const safeOld = redactSensitiveFields(oldValues, viewerRole);
  const safeNew = redactSensitiveFields(newValues, viewerRole);

  if (!safeOld && !safeNew) return <p className="text-xs text-muted-foreground italic">No field-level data available.</p>;

  const allKeys = [...new Set([
    ...Object.keys(safeOld || {}),
    ...Object.keys(safeNew || {}),
  ])]?.filter(k => !IGNORED_KEYS?.includes(k));

  const changedKeys = allKeys?.filter(k => String(safeOld?.[k] ?? '') !== String(safeNew?.[k] ?? ''));

  if (changedKeys?.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No field-level changes detected.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Changed Fields</p>
      {changedKeys?.map(key => (
        <div key={key} className="flex items-start gap-3 text-xs flex-wrap">
          <span className="font-medium text-foreground w-32 flex-shrink-0 capitalize">
            {key?.replace(/_/g, ' ')}
          </span>
          {safeOld && (
            <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded line-through max-w-[200px] truncate">
              {String(safeOld?.[key] ?? '—')}
            </span>
          )}
          <Icon name="ArrowRight" size={12} color="var(--color-muted-foreground)" className="mt-0.5 flex-shrink-0" />
          <span className="px-2 py-0.5 bg-success/10 text-success rounded max-w-[200px] truncate">
            {String(safeNew?.[key] ?? '—')}
          </span>
        </div>
      ))}
      {getRoleLevel(viewerRole) < getRoleLevel('admin') && (
        <p className="text-xs text-muted-foreground italic mt-2 flex items-center gap-1">
          <Icon name="Lock" size={11} />
          Some sensitive fields are hidden based on your role.
        </p>
      )}
    </div>
  );
};

// ─── Summary Cards ────────────────────────────────────────────────────────────

const SummaryCard = ({ icon, label, value, color, helper }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={18} />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {helper && <p className="text-xs text-muted-foreground/60 mt-0.5 leading-tight">{helper}</p>}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AuditDashboard = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const viewerRole = userProfile?.role || 'staff';
  const isAdminOrAbove = getRoleLevel(viewerRole) >= getRoleLevel('admin');
  const isOfficeManager = viewerRole === 'office_manager';

  // Page-level guard
  if (!permLoading && userProfile && !isAdminOrAbove && !hasPermission('finance.audit_log.view')) {
    return <AccessDenied message="Audit Dashboard is restricted to administrators." />;
  }

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [userFilter, setUserFilter] = useState('');

  // Expand row
  const [expandedRow, setExpandedRow] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Audit Dashboard' },
  ];

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase?.from('audit_logs')?.select(`
          id,
          user_id,
          action,
          table_name,
          record_id,
          old_values,
          new_values,
          change_summary,
          created_at,
          user_profiles!audit_logs_user_id_fkey (
            full_name,
            email,
            role
          )
        `, { count: 'exact' })?.order('created_at', { ascending: false })?.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Date filter
      const df = getDateFilter(dateRange);
      if (df?.gte) query = query?.gte('created_at', df?.gte);
      if (df?.lte) query = query?.lte('created_at', df?.lte);

      // Action filter
      if (actionFilter !== 'all') query = query?.eq('action', actionFilter);

      // Resource filter
      if (resourceFilter !== 'all') query = query?.eq('table_name', resourceFilter);

      // RLS on the DB side handles the scope restriction automatically.
      // Staff see only their own, office_managers see their office, admins see all.

      const { data, error: err, count } = await query;
      if (err) throw err;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, actionFilter, resourceFilter]);

  useEffect(() => { setPage(0); }, [dateRange, actionFilter, resourceFilter, searchQuery]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Client-side search + user filter
  const filteredLogs = useMemo(() => {
    return logs?.filter(log => {
      const userName = log?.user_profiles?.full_name || log?.user_profiles?.email || '';
      const matchesSearch = !searchQuery ||
        userName?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        (log?.change_summary || '')?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
        (log?.table_name || '')?.toLowerCase()?.includes(searchQuery?.toLowerCase());
      const matchesUser = !userFilter || userName?.toLowerCase()?.includes(userFilter?.toLowerCase());
      return matchesSearch && matchesUser;
    });
  }, [logs, searchQuery, userFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const uniqueUsers = new Set(filteredLogs?.map(l => l?.user_id))?.size;
    const uniqueResources = new Set(filteredLogs?.map(l => l?.table_name))?.size;
    return { total: filteredLogs?.length, uniqueUsers, uniqueResources };
  }, [filteredLogs]);

  const uniqueActions = useMemo(() => [...new Set(logs?.map(l => l?.action))]?.filter(Boolean), [logs]);
  const uniqueResources = useMemo(() => [...new Set(logs?.map(l => l?.table_name))]?.filter(Boolean), [logs]);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="ShieldCheck" size={20} color="var(--color-primary)" />
                </div>
                Audit Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdminOrAbove
                  ? 'Review Supabase database change events captured by audit triggers. This log tracks selected data inserts, updates, and deletes — not logins, page views, exports, or Dentrix/API activity.'
                  : isOfficeManager
                    ? 'View audit activity for your office.'
                    : 'View your own activity log.'}
              </p>
            </div>
            <button
              onClick={loadLogs}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted transition-colors text-foreground"
            >
              <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Scope info banner */}
        {isAdminOrAbove && (
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/8 border border-blue-500/20 rounded-lg">
            <Icon name="Info" size={15} color="var(--color-primary)" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">Audit Log scope:</span> Shows database mutation events from <code className="font-mono bg-blue-500/10 px-1 rounded">audit_logs</code>. It does not currently capture user login events, page-view/PHI-view events, exports, failed access attempts, or Dentrix/FastAPI backend activity. Resource labels reflect <code className="font-mono bg-blue-500/10 px-1 rounded">audit_logs.table_name</code> values — some app tables may not have audit triggers yet.
            </p>
          </div>
        )}

        {/* Role access banner for non-admins */}
        <RoleAccessBanner role={viewerRole} />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            icon="ClipboardList"
            label="Total Events"
            value={totalCount?.toLocaleString()}
            color="bg-primary/10 text-primary"
            helper="Supabase audit_logs count for selected backend filters"
          />
          {isAdminOrAbove && (
            <SummaryCard
              icon="Users"
              label="Unique Users on Page"
              value={stats?.uniqueUsers}
              color="bg-blue-500/10 text-blue-600"
              helper="Calculated from currently loaded page"
            />
          )}
          {isAdminOrAbove && (
            <SummaryCard
              icon="Database"
              label="Resources on Page"
              value={stats?.uniqueResources}
              color="bg-purple-500/10 text-purple-600"
              helper="Calculated from currently loaded page"
            />
          )}
          <SummaryCard
            icon="Activity"
            label="Shown on Page"
            value={filteredLogs?.length}
            color="bg-success/10 text-success"
            helper="After current-page search/user filter"
          />
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search current page…"
                value={searchQuery}
                onChange={e => setSearchQuery(e?.target?.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>

            {/* User filter — only for admin+ */}
            {isAdminOrAbove && (
              <div className="relative min-w-[160px]">
                <Icon name="User" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by user…"
                  value={userFilter}
                  onChange={e => setUserFilter(e?.target?.value)}
                  title="Filters currently loaded page only"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* Date range */}
            <select
              value={dateRange}
              onChange={e => setDateRange(e?.target?.value)}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              {DATE_RANGE_OPTIONS?.map(o => (
                <option key={o?.value} value={o?.value}>{o?.label}</option>
              ))}
            </select>

            {/* Action type */}
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e?.target?.value)}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              <option value="all">All Actions</option>
              {uniqueActions?.map(a => (
                <option key={a} value={a}>{ACTION_META?.[a]?.label || a}</option>
              ))}
            </select>

            {/* Resource type */}
            <select
              value={resourceFilter}
              onChange={e => setResourceFilter(e?.target?.value)}
              title="Resource labels reflect audit_logs table_name values. Some app tables may not have audit triggers yet."
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              <option value="all">All Resources</option>
              {uniqueResources?.map(r => (
                <option key={r} value={r}>{RESOURCE_LABELS?.[r] || r}</option>
              ))}
            </select>

            {/* Clear filters */}
            {(searchQuery || userFilter || actionFilter !== 'all' || resourceFilter !== 'all' || dateRange !== '30d') && (
              <button
                onClick={() => { setSearchQuery(''); setUserFilter(''); setActionFilter('all'); setResourceFilter('all'); setDateRange('30d'); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Icon name="X" size={13} />
                Clear
              </button>
            )}
          </div>
          {/* Filter scope helper */}
          <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
            <Icon name="Info" size={11} />
            Search and user filter apply to the current loaded page. Date, action, and resource filters query audit_logs.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="ClipboardList" size={18} color="var(--color-primary)" />
              <h3 className="text-base font-semibold text-foreground">Activity Log</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredLogs?.length} of {totalCount?.toLocaleString()} events
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-muted-foreground">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading audit events...</span>
              </div>
            </div>
          ) : filteredLogs?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Icon name="ShieldOff" size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No audit events found</p>
              <p className="text-xs mt-1">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-44">Timestamp</th>
                    {isAdminOrAbove && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">User</th>}
                    {isAdminOrAbove && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                        <span
                          title="Role shown is the user's current role, not necessarily the role at the time of the event."
                          className="cursor-help border-b border-dashed border-muted-foreground/50"
                        >
                          Role
                        </span>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs?.map(log => (
                    <React.Fragment key={log?.id}>
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatTs(log?.created_at)}
                        </td>
                        {isAdminOrAbove && (
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                                {log?.user_profiles?.full_name || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {log?.user_profiles?.email || ''}
                              </p>
                            </div>
                          </td>
                        )}
                        {isAdminOrAbove && (
                          <td className="px-4 py-3">
                            <span
                              className="text-xs text-muted-foreground capitalize cursor-help"
                              title="Role shown is the user's current role, not necessarily the role at the time of the event."
                            >
                              {(log?.user_profiles?.role || '')?.replace(/_/g, ' ')}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <ActionBadge action={log?.action} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground font-medium">
                            {RESOURCE_LABELS?.[log?.table_name] || log?.table_name || '—'}
                          </span>
                          {log?.record_id && isAdminOrAbove && (
                            <p className="text-xs text-muted-foreground/60 font-mono truncate max-w-[120px]">
                              #{String(log?.record_id)?.slice(0, 8)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{log?.change_summary || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(log?.old_values || log?.new_values) && (
                            <button
                              onClick={() => setExpandedRow(expandedRow === log?.id ? null : log?.id)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="View field changes"
                            >
                              <Icon name={expandedRow === log?.id ? 'ChevronUp' : 'ChevronDown'} size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRow === log?.id && (
                        <tr className="bg-muted/10">
                          <td colSpan={isAdminOrAbove ? 7 : 5} className="px-6 py-4">
                            <DiffView
                              oldValues={log?.old_values}
                              newValues={log?.new_values}
                              viewerRole={viewerRole}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {totalCount?.toLocaleString()} total events
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                >
                  <Icon name="ChevronLeft" size={14} />
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                >
                  Next
                  <Icon name="ChevronRight" size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditDashboard;
