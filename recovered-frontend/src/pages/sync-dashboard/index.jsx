import { DASHBOARD_API_ORIGIN } from '../../config/dashboardEnvironment';
import React, { useState, useEffect, useCallback } from 'react';

import { ascendApi } from '../../services/ascendApi';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import { fetchSyncLogs, fetchConflicts, resolveConflict as resolveConflictDB, validateAllEndpoints } from '../../services/ascendSyncService';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { supabase } from '../../lib/supabase';

// ─── API base for new endpoint ────────────────────────────────────────────────
const API_BASE_V2 = DASHBOARD_API_ORIGIN + "/v2";
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

const buildHeaders = () => ({
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
});

// Fetch the new sync-dashboard endpoint
const fetchSyncDashboard = async () => {
  const res = await fetch(`${API_BASE_V2}/admin/sync-dashboard`, { headers: buildHeaders() });
  if (!res?.ok) throw new Error(`Sync Dashboard endpoint error: ${res.status}`);
  return res?.json();
};

// ─── Status / freshness config ────────────────────────────────────────────────
const STATUS_CONFIG = {
  success:           { label: 'Success',            bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  healthy:           { label: 'Healthy',            bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  warning:           { label: 'Warning',            bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  error:             { label: 'Error',              bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
  failed:            { label: 'Failed',             bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500' },
  conflict:          { label: 'Conflict',           bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  stale:             { label: 'Stale',              bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  running:           { label: 'Running',            bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-400' },
  partial:           { label: 'Partial',            bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' },
  pending:           { label: 'Pending',            bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  skipped:           { label: 'Skipped',            bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-300' },
  awaiting_first_run:{ label: 'Awaiting First Run', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  manual_only:       { label: 'Manual Only',        bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-300' },
  not_instrumented:  { label: 'Run Logging Not Wired', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200',   dot: 'bg-slate-300' },
  unknown:           { label: 'Unknown',            bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-300' },
};

const FRESHNESS_CONFIG = {
  fresh:             { label: 'Fresh',              bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  stale:             { label: 'Stale',              bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  approaching:       { label: 'Approaching SLA',    bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  running:           { label: 'Running',            bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  awaiting_first_run:{ label: 'Awaiting First Run', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  manual_only:       { label: 'Manual Only',        bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200' },
  not_applicable:    { label: 'N/A',                bg: 'bg-slate-50',   text: 'text-slate-400',   border: 'border-slate-200' },
  not_instrumented:  { label: 'Run Logging Not Wired', bg: 'bg-slate-50', text: 'text-slate-500',  border: 'border-slate-200' },
  unknown:           { label: 'Unknown',            bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {cfg?.label}
    </span>
  );
}

function FreshnessBadge({ freshness }) {
  const cfg = FRESHNESS_CONFIG?.[freshness] || FRESHNESS_CONFIG?.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      {cfg?.label}
    </span>
  );
}

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000)?.toFixed(1)}s`;
}

function formatRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTimestamp(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso)?.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Rewrite notes to Phase 2 user-facing wording ────────────────────────────
function formatJobNotes(notes, status) {
  if (!notes && !status) return '—';
  const lower = (notes || '')?.toLowerCase();
  // Awaiting first run — wired but not yet naturally run
  if (
    status === 'awaiting_first_run' || lower?.includes('awaiting first run') ||
    lower?.includes('waiting for') ||
    lower?.includes('not yet naturally run')
  ) {
    return 'Instrumentation is live; waiting for the next natural scheduled run.';
  }
  // Manual-only jobs
  if (
    status === 'manual_only' || lower?.includes('manual-only') ||
    lower?.includes('manual only') ||
    lower?.includes('no scheduled run')
  ) {
    return 'Manual-only job — no scheduled run expected.';
  }
  // True not-instrumented (exceptional/legacy)
  if (
    status === 'not_instrumented' || lower?.includes('not yet instrumented') ||
    lower?.includes('not instrumented') ||
    lower?.includes('no dashboard') ||
    lower?.includes('no last-run') ||
    lower?.includes('no last run')
  ) {
    return 'Run logging is not wired for this job.';
  }
  return notes || '—';
}

// ─── Non-blocking audit log helper ───────────────────────────────────────────
const writeAuditLog = async ({ action, tableName, recordId, oldValues, newValues, changeSummary }) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: tableName,
      record_id: recordId ?? null,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.warn('[SyncDashboard] Audit log write failed (non-blocking):', err?.message);
  }
};

// ─── Confirmation Dialog (V689 preserved) ────────────────────────────────────
function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Icon name="AlertTriangle" className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
function CollapsibleSection({ title, subtitle, icon, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon name={icon} className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{title}</span>
              {badge != null && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{badge}</span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 text-slate-400" />
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SyncDashboard() {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('jobs');

  // ── API proxy health ───────────────────────────────────────────────────────
  const [apiStatus, setApiStatus] = useState('checking');

  // ── New endpoint state ─────────────────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  // ── Legacy Supabase state (V689 preserved) ─────────────────────────────────
  const [syncLogs, setSyncLogs] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [logFilter, setLogFilter] = useState('all');
  const [conflictFilter, setConflictFilter] = useState('unresolved');
  const [resolvingConflict, setResolvingConflict] = useState(null);
  const [legacyLoading, setLegacyLoading] = useState(true);

  // ── Job table filters ──────────────────────────────────────────────────────
  const [jobSourceFilter, setJobSourceFilter] = useState('all');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');

  // ── Action state ───────────────────────────────────────────────────────────
  const [reSyncingAll, setReSyncingAll] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Confirmation dialog state (V689 preserved) ────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', message: '', confirmLabel: '', cancelLabel: 'Cancel', onConfirm: null,
  });

  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  // Page-level guard (V689 preserved)
  if (!permLoading && userProfile && !isAdmin && !hasPermission('admin.sync.view')) {
    return <AccessDenied message="Sync Dashboard is restricted to administrators." />;
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }));

  // ── Fetch new /v2/admin/sync-dashboard endpoint ────────────────────────────
  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await fetchSyncDashboard();
      setDashboardData(data);
    } catch (err) {
      setDashboardError(err?.message || 'Failed to load sync dashboard data');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // ── Fetch legacy Supabase data (V689 preserved) ────────────────────────────
  const loadLegacyData = useCallback(async () => {
    setLegacyLoading(true);
    try {
      const [logsData, conflictsData] = await Promise.allSettled([
        fetchSyncLogs({ limit: 200 }),
        fetchConflicts({ limit: 300 }),
      ]);
      setSyncLogs(logsData?.status === 'fulfilled' ? logsData?.value : []);
      setConflicts(conflictsData?.status === 'fulfilled' ? conflictsData?.value : []);
    } catch (err) {
      showToast(`Failed to load legacy sync data: ${err?.message}`, 'error');
    } finally {
      setLegacyLoading(false);
    }
  }, []);

  // ── Check Ascend API proxy health ──────────────────────────────────────────
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await ascendApi?.health();
        setApiStatus('online');
      } catch {
        setApiStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);
  useEffect(() => { loadLegacyData(); }, [loadLegacyData]);

  // ── Full Re-Sync: confirmation + audit (V689 preserved) ───────────────────
  const executeFullReSync = useCallback(async () => {
    if (!isAdmin) return;
    setReSyncingAll(true);
    try {
      await validateAllEndpoints();
      await Promise.all([loadDashboardData(), loadLegacyData()]);
      await writeAuditLog({
        action: 'SYNC_VALIDATION_TRIGGERED',
        tableName: 'api_endpoint_registry',
        recordId: null,
        oldValues: null,
        newValues: {
          trigger_type: 'full_validation',
          source: 'Sync Dashboard',
          note: 'Validates all Dentrix Ascend API endpoints and updates health timestamps.',
        },
        changeSummary: 'Triggered Sync Dashboard endpoint validation for all Dentrix Ascend endpoints',
      });
      showToast('Full validation and sync check complete');
    } catch (err) {
      showToast(`Full validation failed: ${err?.message}`, 'error');
    } finally {
      setReSyncingAll(false);
    }
  }, [isAdmin, loadDashboardData, loadLegacyData]);

  const triggerFullReSync = useCallback(() => {
    if (!isAdmin) return;
    setConfirmDialog({
      open: true,
      title: 'Validate All Endpoints',
      message: 'This will validate all Dentrix Ascend API endpoints and update Sync Dashboard health timestamps. It may make live read-only API calls. Continue?',
      confirmLabel: 'Validate All Endpoints',
      cancelLabel: 'Cancel',
      onConfirm: () => { closeConfirm(); executeFullReSync(); },
    });
  }, [isAdmin, executeFullReSync]);

  // ── Conflict resolution with audit (V689 preserved) ───────────────────────
  const handleResolveConflict = useCallback(async (conflictId, resolution) => {
    setResolvingConflict(conflictId);
    const conflictRow = conflicts?.find(c => c?.id === conflictId);
    try {
      await resolveConflictDB(conflictId, resolution, userProfile?.id);
      setConflicts(prev => prev?.map(c =>
        c?.id === conflictId ? { ...c, resolution, resolved: true } : c
      ));
      showToast('Conflict resolved');
      const resolutionLabel = resolution === 'use_ascend' ? 'Dentrix Ascend' : 'Supabase';
      const entityType = conflictRow?.entity_type || '—';
      const fieldName = conflictRow?.field_name || '—';
      const severity = conflictRow?.severity || 'low';
      await writeAuditLog({
        action: 'SYNC_CONFLICT_RESOLVED',
        tableName: 'reconciliation_conflicts',
        recordId: conflictId,
        oldValues: conflictRow ? {
          id: conflictRow?.id, entity_type: entityType, field_name: fieldName, severity,
          ascend_value: conflictRow?.ascend_value ?? null, manual_value: conflictRow?.manual_value ?? null,
          resolution: conflictRow?.resolution ?? 'pending', detected_at: conflictRow?.detected_at ?? null,
        } : null,
        newValues: {
          id: conflictId, resolution, resolved_by: userProfile?.id ?? null,
          resolved_at: new Date()?.toISOString(), entity_type: entityType, field_name: fieldName, severity,
        },
        changeSummary: `Resolved sync conflict for ${entityType}.${fieldName} using ${resolutionLabel}`,
      });
    } catch (err) {
      showToast(`Failed to resolve conflict: ${err?.message}`, 'error');
    } finally {
      setResolvingConflict(null);
    }
  }, [userProfile?.id, conflicts]);

  // ── Derived values from new endpoint ──────────────────────────────────────
  const summary = dashboardData?.summary || {};
  const jobs = dashboardData?.jobs || [];
  const apiEndpointHealth = dashboardData?.api_endpoint_health || [];
  const legacySyncLogs = dashboardData?.legacy_sync_logs || [];
  const generatedAt = dashboardData?.generated_at || null;

  // Filter jobs
  const filteredJobs = jobs?.filter(job => {
    const sourceMatch = jobSourceFilter === 'all' || job?.source_system === jobSourceFilter;
    const statusMatch = jobStatusFilter === 'all'
      || (jobStatusFilter === 'healthy' && ['success', 'completed'].includes(job?.status)
        && (job?.freshness_status || job?.freshness) === 'fresh')
      || (jobStatusFilter === 'manual_only' && job?.is_manual_only === true)
      || job?.status === jobStatusFilter
      || job?.freshness_status === jobStatusFilter
      || job?.freshness === jobStatusFilter;
    return sourceMatch && statusMatch;
  });

  // Unique source systems for filter
  const sourceSystems = [...new Set(jobs?.map(j => j?.source_system)?.filter(Boolean))];

  // Legacy Supabase derived values
  const filteredLogs = syncLogs?.filter(l => logFilter === 'all' || l?.status === logFilter);
  const filteredConflicts = conflicts?.filter(c => {
    if (conflictFilter === 'all') return true;
    if (conflictFilter === 'unresolved') return c?.resolution === 'pending' || !c?.resolution;
    if (conflictFilter === 'resolved') return c?.resolution && c?.resolution !== 'pending';
    return true;
  });
  const unresolvedCount = conflicts?.filter(c => c?.resolution === 'pending' || !c?.resolution)?.length;
  const errorCount = syncLogs?.filter(l => l?.status === 'error')?.length;

  const tabs = [
    { key: 'jobs',      label: 'Job Status',      icon: 'Activity' },
    { key: 'conflicts', label: 'Conflicts',        icon: 'AlertTriangle', badge: unresolvedCount > 0 ? unresolvedCount : null },
    { key: 'legacy',    label: 'Legacy Sync Logs', icon: 'ScrollText',    badge: errorCount > 0 ? errorCount : null },
  ];

  const isLoading = dashboardLoading || legacyLoading;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Confirmation Dialog (V689 preserved) */}
      <ConfirmDialog
        open={confirmDialog?.open}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast?.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast?.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sync Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Dentrix Ascend ↔ Supabase data synchronization
              {generatedAt && (
                <span className="ml-2 text-slate-400">· Data as of {formatTimestamp(generatedAt)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* API Proxy Status — health check only (V689 preserved) */}
            <div className={`flex flex-col items-start px-3 py-1.5 rounded-lg border text-sm font-medium ${
              apiStatus === 'online'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              apiStatus === 'offline'? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  apiStatus === 'online'  ? 'bg-emerald-500 animate-pulse' :
                  apiStatus === 'offline' ? 'bg-red-500' : 'bg-slate-400 animate-pulse'
                }`} />
                {apiStatus === 'checking' ? 'Ascend API: Checking…'
                  : apiStatus === 'online' ? 'API Proxy Online' : 'API Proxy Offline'}
              </div>
              <span className="text-xs font-normal opacity-70 mt-0.5">
                Health check only — sync freshness is shown by entity logs below.
              </span>
            </div>
            {/* Full Re-Sync — requires confirmation (V689 preserved) */}
            <button
              onClick={triggerFullReSync}
              disabled={reSyncingAll || apiStatus === 'offline'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="RefreshCw" className={`w-4 h-4 ${reSyncingAll ? 'animate-spin' : ''}`} />
              {reSyncingAll ? 'Validating…' : 'Full Re-Sync'}
            </button>
          </div>
        </div>

        {/* ── Summary cards from new endpoint ── */}
        {dashboardLoading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              {Array.from({ length: 6 })?.map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-3 h-20 animate-pulse" />
              ))}
            </div>
            {/* Exception card: only show if backend reports not_instrumented > 0 */}
            {(summary?.jobs_not_instrumented ?? 0) > 0 && (
              <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                <Icon name="AlertTriangle" className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span>
                  <strong>Run Logging Not Wired: {summary?.jobs_not_instrumented}</strong> — these jobs exist but do not yet report reliable last-run status to this dashboard.
                </span>
              </div>
            )}
          </>
        ) : dashboardError ? (
          <div className="mt-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <Icon name="AlertCircle" className="w-4 h-4 flex-shrink-0" />
            <span>Failed to load sync dashboard: {dashboardError}</span>
            <button onClick={loadDashboardData} className="ml-auto text-xs underline hover:no-underline">Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mt-5">
            {[
              {
                label: 'Jobs Healthy',
                value: summary?.jobs_healthy ?? '—',
                icon: 'CheckCircle2',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Jobs Running',
                value: summary?.jobs_running ?? '—',
                icon: 'RefreshCw',
                color: (summary?.jobs_running ?? 0) > 0 ? 'text-blue-600' : 'text-slate-500',
                bg: (summary?.jobs_running ?? 0) > 0 ? 'bg-blue-50' : 'bg-slate-50',
              },
              {
                label: 'Jobs Failed',
                value: summary?.jobs_failed ?? '—',
                icon: 'XCircle',
                color: (summary?.jobs_failed ?? 0) > 0 ? 'text-red-600' : 'text-slate-500',
                bg: (summary?.jobs_failed ?? 0) > 0 ? 'bg-red-50' : 'bg-slate-50',
              },
              {
                label: 'Last Successful Run',
                value: formatRelative(summary?.last_successful_run),
                icon: 'CalendarCheck',
                color: 'text-slate-700',
                bg: 'bg-slate-50',
              },
              {
                label: 'Reliable Jobs',
                value: summary?.jobs_with_reliable_last_run ?? summary?.jobs_with_reliable_data ?? '—',
                icon: 'ShieldCheck',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                subtext: 'with real timestamps',
              },
              {
                label: 'Awaiting First Run',
                value: summary?.jobs_awaiting_first_run ?? '—',
                icon: 'Clock',
                color: 'text-slate-600',
                bg: 'bg-slate-50',
                subtext: 'wired, not yet naturally run',
              },
              {
                label: 'Manual Only',
                value: summary?.jobs_manual_only ?? '—',
                icon: 'Hand',
                color: 'text-slate-500',
                bg: 'bg-slate-50',
                subtext: 'run on demand',
              },
            ]?.map(stat => (
              <div key={stat?.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${stat?.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon name={stat?.icon} className={`w-4 h-4 ${stat?.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 truncate">{stat?.label}</p>
                  <p className={`text-base font-bold ${stat?.color} truncate`}>{stat?.value}</p>
                  {stat?.subtext && (
                    <p className="text-xs text-slate-400 leading-tight truncate">{stat?.subtext}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 w-fit overflow-x-auto">
        {tabs?.map(tab => (
          <button
            key={tab?.key}
            onClick={() => setActiveTab(tab?.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab?.key
                ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Icon name={tab?.icon} className="w-4 h-4" />
            {tab?.label}
            {tab?.badge != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab?.key ? 'bg-white text-slate-900' : 'bg-red-100 text-red-700'
              }`}>
                {tab?.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Job Status ── */}
      {activeTab === 'jobs' && (
        <div className="space-y-5">
          {/* Job status table from new endpoint */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Sync / Import Job Status</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real job status from <code className="bg-slate-100 px-1 rounded">GET /v2/admin/sync-dashboard</code>
                    {jobs?.length > 0 && <span className="ml-2">· {jobs?.length} total jobs</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 leading-relaxed max-w-2xl">
                    Jobs marked <strong>Awaiting First Run</strong> are wired for Sync Dashboard logging and will show timestamps after their next natural scheduled run.
                    {' '}<strong>Manual Only</strong> jobs run on demand and may not have scheduled timestamps.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source system filter */}
                  {sourceSystems?.length > 0 && (
                    <select
                      value={jobSourceFilter}
                      onChange={e => setJobSourceFilter(e?.target?.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
                    >
                      <option value="all">All Sources</option>
                      {sourceSystems?.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {/* Status/freshness filter */}
                  <select
                    value={jobStatusFilter}
                    onChange={e => setJobStatusFilter(e?.target?.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="all">All Statuses</option>
                    <option value="success">Success</option>
                    <option value="healthy">Healthy</option>
                    <option value="running">Running</option>
                    <option value="warning">Warning</option>
                    <option value="partial">Partial</option>
                    <option value="stale">Stale</option>
                    <option value="failed">Failed</option>
                    <option value="awaiting_first_run">Awaiting First Run</option>
                    <option value="manual_only">Manual Only</option>
                    <option value="unknown">Unknown</option>
                    {(summary?.jobs_not_instrumented ?? 0) > 0 && (
                      <option value="not_instrumented">Run Logging Not Wired</option>
                    )}
                  </select>
                  <button
                    onClick={loadDashboardData}
                    disabled={dashboardLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="RefreshCw" className={`w-3.5 h-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {dashboardLoading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="RefreshCw" className="w-5 h-5 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-500 text-sm">Loading job status…</span>
              </div>
            ) : dashboardError ? (
              <div className="flex items-center justify-center py-16 flex-col gap-3">
                <Icon name="AlertCircle" className="w-8 h-8 text-red-400" />
                <p className="text-sm text-slate-500">{dashboardError}</p>
                <button onClick={loadDashboardData} className="text-xs text-blue-600 underline">Retry</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Job Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Source</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Trigger</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Freshness</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Last Success</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Last Failure</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Duration</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Rows</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Log Source</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredJobs?.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-slate-400 text-sm">
                          {jobs?.length === 0
                            ? 'No job data returned from endpoint.'
                            : 'No jobs match the selected filters.'}
                        </td>
                      </tr>
                    ) : filteredJobs?.map((job, idx) => (
                      <tr key={job?.job_id || job?.job_name || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap max-w-[200px] truncate" title={job?.job_name}>
                          {job?.job_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job?.source_system || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job?.trigger_type || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={job?.status || 'unknown'} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FreshnessBadge freshness={job?.freshness_status || job?.freshness || 'unknown'} />
                        </td>
                        {/* Reliable jobs show real timestamps; uninstrumented show — */}
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {job?.last_success_at ? formatTimestamp(job?.last_success_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {job?.last_failure_at ? formatTimestamp(job?.last_failure_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                          {job?.avg_duration_ms
                            ? job?.avg_duration_ms < 1000
                              ? `${job?.avg_duration_ms}ms`
                              : `${(job?.avg_duration_ms / 1000)?.toFixed(1)}s`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {job?.rows_processed != null ? Number(job?.rows_processed)?.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{job?.log_source || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate" title={job?.notes}>
                          {formatJobNotes(job?.notes, job?.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* API Endpoint Health — separate section, NOT sync freshness */}
          <CollapsibleSection
            title="API Endpoint Health"
            subtitle="Endpoint reachability only — not sync freshness."
            icon="Wifi"
            badge={apiEndpointHealth?.length > 0 ? `${apiEndpointHealth?.length} endpoints` : null}
            defaultOpen={true}
          >
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon name="RefreshCw" className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-500 text-xs">Loading…</span>
              </div>
            ) : apiEndpointHealth?.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                No API endpoint health data returned.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoint</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Tested</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Success</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Response Time</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {apiEndpointHealth?.map((ep, idx) => (
                      <tr key={ep?.endpoint_key || ep?.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 font-mono text-xs">{ep?.endpoint_key || ep?.endpoint || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={ep?.health_status || ep?.status || 'unknown'} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{ep?.last_tested_at ? formatTimestamp(ep?.last_tested_at) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{ep?.last_success_at ? formatTimestamp(ep?.last_success_at) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {ep?.avg_response_ms != null
                            ? ep?.avg_response_ms < 1000
                              ? `${ep?.avg_response_ms}ms`
                              : `${(ep?.avg_response_ms / 1000)?.toFixed(1)}s`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{ep?.notes || ep?.last_error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* ── TAB: Conflicts (V689 preserved) ── */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Show:</span>
            {['unresolved', 'resolved', 'all']?.map(f => (
              <button
                key={f}
                onClick={() => setConflictFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                  conflictFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {legacyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="RefreshCw" className="w-5 h-5 text-slate-400 animate-spin" />
              <span className="ml-2 text-slate-500 text-sm">Loading conflicts…</span>
            </div>
          ) : filteredConflicts?.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
              <Icon name="CheckCircle2" className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No conflicts found</p>
              <p className="text-slate-400 text-sm mt-1">
                {conflicts?.length === 0
                  ? 'No reconciliation conflicts detected.' :'All records are in sync between Ascend and Supabase'}
              </p>
            </div>
          ) : (
            filteredConflicts?.map(conflict => {
              const isResolved = conflict?.resolution && conflict?.resolution !== 'pending';
              return (
                <div
                  key={conflict?.id}
                  className={`bg-white rounded-xl border p-4 ${isResolved ? 'border-slate-200 opacity-60' : 'border-amber-200'}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isResolved ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <Icon name={isResolved ? 'CheckCircle2' : 'AlertTriangle'} className={`w-4 h-4 ${isResolved ? 'text-emerald-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 capitalize">{(conflict?.entity_type || '—')?.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-slate-400 font-mono">{conflict?.record_date || '—'}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">field: {conflict?.field_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            conflict?.severity === 'high' ? 'bg-red-100 text-red-700' :
                            conflict?.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>{conflict?.severity || 'low'}</span>
                          {isResolved && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Resolved: {conflict?.resolution}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {conflict?.offices?.name || 'Unknown office'} · Detected {formatRelative(conflict?.detected_at)}
                        </p>
                        {conflict?.recommended_action && (
                          <p className="text-xs text-slate-500 mt-1 italic">{conflict?.recommended_action}</p>
                        )}
                      </div>
                    </div>
                    {!isResolved && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveConflict(conflict?.id, 'use_ascend')}
                          disabled={resolvingConflict === conflict?.id}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Use Ascend
                        </button>
                        <button
                          onClick={() => handleResolveConflict(conflict?.id, 'use_supabase')}
                          disabled={resolvingConflict === conflict?.id}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          Keep Supabase
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1">
                        <Icon name="Cloud" className="w-3 h-3" /> Dentrix Ascend
                      </p>
                      <p className="text-sm font-mono text-blue-900">{conflict?.ascend_value ?? '—'}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <Icon name="Database" className="w-3 h-3" /> Supabase
                      </p>
                      <p className="text-sm font-mono text-slate-800">{conflict?.manual_value ?? '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: Legacy Sync Logs ── */}
      {activeTab === 'legacy' && (
        <div className="space-y-4">
          {/* Legacy data_sync_logs from Supabase */}
          <CollapsibleSection
            title="Legacy Sync Logs"
            subtitle="Historical logs from the older data_sync_logs table. Not the primary sync-job status source."
            icon="ScrollText"
            badge={syncLogs?.length > 0 ? `${syncLogs?.length} entries` : null}
            defaultOpen={true}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap">
              <span className="text-xs font-medium text-slate-500 mr-1">Filter:</span>
              {['all', 'success', 'error', 'conflict', 'skipped']?.map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                    logFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400">{filteredLogs?.length} entries</span>
            </div>
            {legacyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Icon name="RefreshCw" className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-500 text-xs">Loading…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entity</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Office</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fetched</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Inserted</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLogs?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                          {syncLogs?.length === 0 ? 'No legacy sync logs found.' : 'No logs match the selected filter.'}
                        </td>
                      </tr>
                    ) : filteredLogs?.map(log => (
                      <tr key={log?.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 capitalize">{(log?.entity_type || log?.endpoint_key || '—')?.replace(/_/g, ' ')}</td>
                        {/* V689 preserved: Unknown Office instead of raw UUID */}
                        <td className="px-4 py-3 text-slate-500 text-xs">{log?.offices?.name || 'Unknown Office'}</td>
                        <td className="px-4 py-3"><StatusBadge status={log?.status} /></td>
                        <td className="px-4 py-3 text-slate-600">{(log?.records_fetched ?? 0)?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium">{(log?.records_inserted ?? 0)?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log?.duration_ms ? `${(log?.duration_ms / 1000)?.toFixed(1)}s` : formatDuration(log?.started_at, log?.completed_at)}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatRelative(log?.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Legacy sync logs from new endpoint (if any) */}
          {legacySyncLogs?.length > 0 && (
            <CollapsibleSection
              title="Legacy Sync Logs (from endpoint)"
              subtitle="Historical logs from the older data_sync_logs table. Not the primary sync-job status source."
              icon="Archive"
              badge={`${legacySyncLogs?.length} entries`}
              defaultOpen={false}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entity</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Started</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {legacySyncLogs?.map((log, idx) => (
                      <tr key={log?.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 capitalize">{(log?.entity_type || log?.endpoint_key || '—')?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3"><StatusBadge status={log?.status || 'unknown'} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{log?.started_at ? formatTimestamp(log?.started_at) : '—'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{log?.records_inserted != null ? Number(log?.records_inserted)?.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
