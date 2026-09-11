import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import {
  fetchDataHealthSummary,
  fetchSyncLogs,
  fetchConflicts,
  validateAllEndpoints,
  runHistoricalBackfill,
  runReconciliation,
  resolveConflict,
} from '../../services/ascendSyncService';
import { OFFICE_MAP, getOfficeNameById } from '../../constants/offices';
import DataAuditPanel from '../../components/DataAuditPanel';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { supabase } from '../../lib/supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRelative = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDuration = (ms) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000)?.toFixed(1)}s`;
};

// ─── Non-blocking audit logger ────────────────────────────────────────────────
// Writes an audit row after a confirmed action. Failure is non-blocking.
// Does NOT log secrets, PHI, PII, or full response bodies.
const writeAuditLog = async ({ action, userId, metadata = {} }) => {
  try {
    await supabase?.from('audit_logs')?.insert({
      action,
      user_id: userId || null,
      new_values: {
        source: 'Data Health',
        ...metadata,
      },
      created_at: new Date()?.toISOString(),
    });
  } catch {
    // Non-blocking — audit failure must never interrupt the user action
  }
};

// ─── Endpoint staleness helper ────────────────────────────────────────────────
const isEndpointStale = (lastTestedAt) => {
  if (!lastTestedAt) return true;
  return Date.now() - new Date(lastTestedAt) > 24 * 60 * 60 * 1000;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  success: { label: 'Success', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  healthy: { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  error: { label: 'Error', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  failing: { label: 'Failing', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  conflict: { label: 'Conflict', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  degraded: { label: 'Degraded', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  running: { label: 'Running', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400 animate-pulse' },
  pending: { label: 'Pending', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  skipped: { label: 'Skipped', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-300' },
  untested: { label: 'Untested', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-300' },
  partial: { label: 'Partial', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
  use_ascend: { label: 'Use Ascend', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  use_manual: { label: 'Keep Manual', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  merged: { label: 'Merged', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  flagged: { label: 'Flagged', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  ignored: { label: 'Ignored', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-300' },
  low: { label: 'Low', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  high: { label: 'High', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-600' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG?.[status] || STATUS_CFG?.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
      {cfg?.label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon name={icon} className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, confirmLabel, confirmClassName, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Icon name="AlertTriangle" className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={confirmClassName || 'px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataHealthPage() {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);
  const [activeTab, setActiveTab] = useState('endpoints');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  // Page-level guard
  if (!permLoading && userProfile && !isAdmin && !hasPermission('admin.data_health.view')) {
    return <AccessDenied message="Data Health is restricted to administrators." />;
  }

  // Filters
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [conflictFilter, setConflictFilter] = useState('pending');
  const [conflictSeverity, setConflictSeverity] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('all');

  // Actions
  const [validating, setValidating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [backfillDryRun, setBackfillDryRun] = useState(true);
  const [backfillResult, setBackfillResult] = useState(null);

  // ─── Confirmation dialog state ────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmClassName: '',
    onConfirm: null,
  });

  const openConfirm = (opts) => setConfirmDialog({ open: true, ...opts });
  const closeConfirm = () => setConfirmDialog(d => ({ ...d, open: false, onConfirm: null }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthSummary, logs, cfls] = await Promise.all([
        fetchDataHealthSummary(),
        fetchSyncLogs({ status: logStatusFilter !== 'all' ? logStatusFilter : undefined, limit: 150 }),
        fetchConflicts({ resolution: conflictFilter !== 'all' ? conflictFilter : undefined, limit: 300 }),
      ]);
      setSummary(healthSummary);
      setSyncLogs(logs);
      setConflicts(cfls);
    } catch (err) {
      showToast(`Failed to load data: ${err?.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [logStatusFilter, conflictFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Validate Endpoints — requires confirmation ───────────────────────────
  const executeValidateEndpoints = async () => {
    closeConfirm();
    setValidating(true);
    try {
      const results = await validateAllEndpoints();
      const failed = results?.filter(r => r?.health === 'failing')?.length;
      showToast(failed > 0 ? `Validation complete — ${failed} endpoint(s) failing` : 'All endpoints validated successfully');
      // Non-blocking audit log — written only after confirmed action
      writeAuditLog({
        action: 'DATA_HEALTH_VALIDATE_ENDPOINTS_TRIGGERED',
        userId: userProfile?.id,
        metadata: { action_type: 'validate_endpoints' },
      });
      await loadData();
    } catch (err) {
      showToast(`Validation failed: ${err?.message}`, 'error');
    } finally {
      setValidating(false);
    }
  };

  const triggerValidateEndpoints = () => {
    openConfirm({
      title: 'Validate Endpoints',
      message: 'This will call live Dentrix/FastAPI endpoint checks and update endpoint health timestamps. This does not sync data, but it writes validation status to the Data Health registry. Continue?',
      confirmLabel: 'Validate Endpoints',
      confirmClassName: 'px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors',
      onConfirm: executeValidateEndpoints,
    });
  };

  // ─── Run Reconciliation — requires confirmation ───────────────────────────
  const executeReconcile = async () => {
    closeConfirm();
    setReconciling(true);
    try {
      const today = new Date()?.toISOString()?.split('T')?.[0];
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000)?.toISOString()?.split('T')?.[0];
      const result = await runReconciliation({
        startDate: sixMonthsAgo,
        endDate: today,
        triggeredByUserId: userProfile?.id,
      });
      showToast(`Reconciliation complete — ${result?.conflictCount} conflict(s) detected`);
      // Non-blocking audit log
      writeAuditLog({
        action: 'DATA_HEALTH_RECONCILIATION_TRIGGERED',
        userId: userProfile?.id,
        metadata: {
          action_type: 'reconciliation',
          date_range_start: sixMonthsAgo,
          date_range_end: today,
        },
      });
      await loadData();
    } catch (err) {
      showToast(`Reconciliation failed: ${err?.message}`, 'error');
    } finally {
      setReconciling(false);
    }
  };

  const triggerReconcile = () => {
    openConfirm({
      title: 'Run Reconciliation',
      message: 'This will compare Dentrix/FastAPI data with dashboard data and may write reconciliation conflict records. It may also trigger alert behavior if discrepancies are found. Continue?',
      confirmLabel: 'Run Reconciliation',
      confirmClassName: 'px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors',
      onConfirm: executeReconcile,
    });
  };

  // ─── Historical Backfill — requires confirmation when dry-run is OFF ──────
  const executeBackfill = async () => {
    closeConfirm();
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await runHistoricalBackfill({
        isDryRun: backfillDryRun,
        triggeredByUserId: userProfile?.id,
      });
      setBackfillResult(result);
      showToast(backfillDryRun
        ? `Dry run complete — ${result?.missingRanges?.length || 0} missing period(s) found`
        : `Backfill complete — ${result?.results?.filter(r => r?.status === 'success')?.length} months synced`
      );
      // Non-blocking audit log — only written after confirmed action path
      if (!backfillDryRun) {
        writeAuditLog({
          action: 'DATA_HEALTH_BACKFILL_TRIGGERED',
          userId: userProfile?.id,
          metadata: {
            action_type: 'historical_backfill',
            dry_run: false,
          },
        });
      }
      await loadData();
    } catch (err) {
      showToast(`Backfill failed: ${err?.message}`, 'error');
    } finally {
      setBackfilling(false);
    }
  };

  const triggerBackfill = () => {
    if (backfillDryRun) {
      // Dry-run is safe — no confirmation needed
      executeBackfill();
    } else {
      openConfirm({
        title: 'Run Live Historical Backfill',
        message: 'This will run a live historical backfill and may write monthly executive analytics, sync logs, endpoint backfill dates, and conflict records. Dry-run is recommended first. Continue with live backfill?',
        confirmLabel: 'Run Live Backfill',
        confirmClassName: 'px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors',
        onConfirm: executeBackfill,
      });
    }
  };

  // ─── Conflict resolution — requires confirmation ──────────────────────────
  const triggerResolveConflict = (conflictId, resolution) => {
    const labelMap = {
      use_ascend: 'Use Ascend',
      use_manual: 'Keep Manual',
      flagged: 'Flag for Review',
    };
    const confirmLabel = labelMap?.[resolution] || 'Confirm';
    openConfirm({
      title: 'Resolve Conflict',
      message: 'This will update the selected reconciliation conflict resolution. Continue?',
      confirmLabel,
      confirmClassName: 'px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors',
      onConfirm: () => executeResolveConflict(conflictId, resolution),
    });
  };

  const executeResolveConflict = async (conflictId, resolution) => {
    closeConfirm();
    setResolvingId(conflictId);
    try {
      await resolveConflict(conflictId, resolution, userProfile?.id);
      setConflicts(prev => prev?.map(c => c?.id === conflictId ? { ...c, resolution } : c));
      showToast('Conflict resolved');
      // Non-blocking audit log
      writeAuditLog({
        action: 'DATA_HEALTH_CONFLICT_RESOLVED',
        userId: userProfile?.id,
        metadata: {
          action_type: 'conflict_resolution',
          conflict_id: conflictId,
          resolution_selected: resolution,
        },
      });
    } catch (err) {
      showToast(`Failed to resolve: ${err?.message}`, 'error');
    } finally {
      setResolvingId(null);
    }
  };

  // Derived stats
  const healthyEndpoints = summary?.endpoints?.filter(e => e?.health_status === 'healthy')?.length || 0;
  const failingEndpoints = summary?.endpoints?.filter(e => e?.health_status === 'failing')?.length || 0;
  const unresolvedConflicts = conflicts?.filter(c => c?.resolution === 'pending')?.length;
  const errorLogs = syncLogs?.filter(l => l?.status === 'error')?.length;
  const lastSync = syncLogs?.[0]?.started_at;

  // Filtered data
  const filteredLogs = syncLogs?.filter(l => {
    if (logStatusFilter !== 'all' && l?.status !== logStatusFilter) return false;
    if (officeFilter !== 'all' && l?.office_id !== officeFilter) return false;
    return true;
  });

  const filteredConflicts = conflicts?.filter(c => {
    if (conflictFilter !== 'all' && c?.resolution !== conflictFilter) return false;
    if (conflictSeverity !== 'all' && c?.severity !== conflictSeverity) return false;
    if (officeFilter !== 'all' && c?.office_id !== officeFilter) return false;
    return true;
  });

  const tabs = [
    { key: 'endpoints', label: 'Endpoints', icon: 'Plug', badge: failingEndpoints > 0 ? failingEndpoints : null },
    { key: 'logs', label: 'Sync Logs', icon: 'ScrollText', badge: errorLogs > 0 ? errorLogs : null },
    { key: 'conflicts', label: 'Conflicts', icon: 'AlertTriangle', badge: unresolvedConflicts > 0 ? unresolvedConflicts : null },
    { key: 'backfill', label: 'Backfill', icon: 'History' },
    { key: 'alerts', label: 'Alerts', icon: 'Bell', badge: summary?.alerts?.length > 0 ? summary?.alerts?.length : null },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog?.open}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        confirmClassName={confirmDialog?.confirmClassName}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={closeConfirm}
      />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast?.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <Icon name={toast?.type === 'error' ? 'XCircle' : 'CheckCircle'} className="w-4 h-4" />
          {toast?.msg}
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Health & Reconciliation</h1>
            <p className="text-sm text-slate-500 mt-0.5">Dentrix Ascend API pipeline audit, backfill, and conflict resolution</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={triggerValidateEndpoints}
              disabled={validating}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Icon name="Plug" className={`w-4 h-4 ${validating ? 'animate-pulse' : ''}`} />
              {validating ? 'Validating…' : 'Validate Endpoints'}
            </button>
            <button
              onClick={triggerReconcile}
              disabled={reconciling}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Icon name="GitCompare" className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
              {reconciling ? 'Reconciling…' : 'Run Reconciliation'}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Icon name="RefreshCw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
          <SummaryCard label="Last Sync" value={formatRelative(lastSync)} icon="Clock" color="text-slate-700" />
          <SummaryCard label="Healthy Endpoints" value={healthyEndpoints} icon="CheckCircle" color="text-emerald-600" sub={`of ${summary?.endpoints?.length || 0} total`} />
          <SummaryCard label="Failing Endpoints" value={failingEndpoints} icon="XCircle" color={failingEndpoints > 0 ? 'text-red-600' : 'text-slate-400'} />
          <SummaryCard label="Open Conflicts" value={unresolvedConflicts} icon="AlertTriangle" color={unresolvedConflicts > 0 ? 'text-amber-600' : 'text-slate-400'} />
          <SummaryCard label="Sync Errors" value={errorLogs} icon="Bug" color={errorLogs > 0 ? 'text-red-600' : 'text-slate-400'} />
        </div>

        {/* Super Admin Data Audit Panel */}
        <div className="mt-5">
          <DataAuditPanel defaultOpen={false} />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs?.map(tab => (
          <button
            key={tab?.key}
            onClick={() => setActiveTab(tab?.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === tab?.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon name={tab?.icon} className="w-4 h-4" />
            {tab?.label}
            {tab?.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab?.key ? 'bg-white text-slate-900' : 'bg-red-500 text-white'
              }`}>{tab?.badge}</span>
            )}
          </button>
        ))}
      </div>
      {/* ── ENDPOINTS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'endpoints' && (
        <div className="space-y-3">
          {/* Endpoint health source label */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <Icon name="Info" className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Endpoint health shows the last validation result.</span>{' '}
              It is not live sync freshness. Status is only updated when "Validate Endpoints" is run.
              For current sync-job status, see <span className="font-semibold">Admin → Sync Dashboard</span>.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">API Endpoint Registry</h2>
              <span className="text-xs text-slate-500">{summary?.endpoints?.length || 0} endpoints</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoint</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Path</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Table</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Tested</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Backfill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading endpoints…</td></tr>
                  ) : (summary?.endpoints || [])?.map(ep => {
                    const stale = isEndpointStale(ep?.last_tested_at);
                    return (
                      <tr key={ep?.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{ep?.endpoint_key}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{ep?.description}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{ep?.endpoint_path}</td>
                        <td className="px-4 py-3 text-slate-600">{ep?.target_table || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ep?.health_status} />
                          {stale && (
                            <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Icon name="Clock" className="w-3 h-3" />
                              Health check stale
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          <span>{formatRelative(ep?.last_tested_at)}</span>
                          {stale && ep?.last_tested_at && (
                            <div className="text-amber-600 text-xs mt-0.5">Last tested &gt;24h ago</div>
                          )}
                          {!ep?.last_tested_at && (
                            <div className="text-slate-400 text-xs mt-0.5">Never tested</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ep?.backfill_completed
                            ? <span className="text-xs text-emerald-600 font-medium">✓ Complete</span>
                            : ep?.backfill_last_date
                            ? <span className="text-xs text-amber-600">Up to {formatDate(ep?.backfill_last_date)}</span>
                            : <span className="text-xs text-slate-400">Not started</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field Mapping Panel */}
          {(summary?.endpoints || [])?.filter(ep => ep?.field_mapping && Object.keys(ep?.field_mapping)?.length > 0)?.slice(0, 3)?.map(ep => (
            <div key={ep?.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-medium text-slate-800 text-sm">Field Mapping: <span className="font-mono text-indigo-600">{ep?.endpoint_key}</span> → <span className="font-mono text-emerald-600">{ep?.target_table}</span></h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(ep?.field_mapping || {})?.map(([ascendField, dbField]) => (
                  <div key={ascendField} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <span className="font-mono text-blue-600 truncate">{ascendField}</span>
                    <Icon name="ArrowRight" className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="font-mono text-emerald-700 truncate">{dbField}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── SYNC LOGS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Sync Logs source label */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <Icon name="Info" className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Historical logs from the older <code className="font-mono bg-amber-100 px-1 rounded">data_sync_logs</code> table.</span>{' '}
              For current job status, see <span className="font-semibold">Admin → Sync Dashboard</span>.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-slate-900">Sync Logs</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={logStatusFilter}
                  onChange={e => setLogStatusFilter(e?.target?.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="conflict">Conflict</option>
                  <option value="running">Running</option>
                  <option value="skipped">Skipped</option>
                </select>
                <select
                  value={officeFilter}
                  onChange={e => setOfficeFilter(e?.target?.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
                >
                  <option value="all">All Offices</option>
                  {Object.entries(OFFICE_MAP)?.map(([id, meta]) => (
                    <option key={id} value={id}>{meta.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Endpoint</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Office</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Range</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Records</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading logs…</td></tr>
                  ) : filteredLogs?.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No sync logs found</td></tr>
                  ) : filteredLogs?.map(log => (
                    <tr key={log?.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{log?.endpoint_key}</td>
                      <td className="px-4 py-3 text-slate-600">{log?.entity_type}</td>
                      <td className="px-4 py-3 text-slate-600">{log?.office_id ? getOfficeNameById(log?.office_id) : 'All'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log?.date_range_start ? `${formatDate(log?.date_range_start)} – ${formatDate(log?.date_range_end)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log?.status} />
                        {log?.is_backfill && <span className="ml-1 text-xs text-indigo-500 font-medium">backfill</span>}
                        {log?.is_dry_run && <span className="ml-1 text-xs text-amber-500 font-medium">dry-run</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="text-emerald-600">+{log?.records_inserted || 0}</span>
                        {' / '}
                        <span className="text-amber-600">{log?.records_conflicted || 0}⚠</span>
                        {' / '}
                        <span className="text-red-600">{log?.records_failed || 0}✗</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDuration(log?.duration_ms)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatRelative(log?.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ── CONFLICTS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={conflictFilter}
              onChange={e => setConflictFilter(e?.target?.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="all">All Resolutions</option>
              <option value="pending">Pending</option>
              <option value="use_ascend">Use Ascend</option>
              <option value="use_manual">Keep Manual</option>
              <option value="merged">Merged</option>
              <option value="flagged">Flagged</option>
            </select>
            <select
              value={conflictSeverity}
              onChange={e => setConflictSeverity(e?.target?.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={officeFilter}
              onChange={e => setOfficeFilter(e?.target?.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="all">All Offices</option>
              {Object.entries(OFFICE_MAP)?.map(([id, meta]) => (
                <option key={id} value={id}>{meta.name}</option>
              ))}
            </select>
            <span className="text-sm text-slate-500 ml-auto">{filteredConflicts?.length} conflict(s)</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading conflicts…</div>
          ) : filteredConflicts?.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Icon name="CheckCircle" className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No conflicts found</p>
              <p className="text-slate-400 text-sm mt-1">Run reconciliation to detect mismatches between manual and Ascend data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConflicts?.map(conflict => (
                <div key={conflict?.id} className={`bg-white rounded-xl border overflow-hidden ${
                  conflict?.severity === 'high' || conflict?.severity === 'critical' ? 'border-red-200' :
                  conflict?.severity === 'medium' ? 'border-amber-200' : 'border-slate-200'
                }`}>
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={conflict?.severity} />
                      <StatusBadge status={conflict?.resolution} />
                      <span className="text-sm font-medium text-slate-800">{conflict?.entity_type}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-500 font-mono">{conflict?.field_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Icon name="Building2" className="w-3.5 h-3.5" />
                      {conflict?.office_id ? getOfficeNameById(conflict?.office_id) : '—'}
                      <span>·</span>
                      {formatDate(conflict?.record_date)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                        <p className="text-xs font-semibold text-violet-600 mb-1">Manual Entry Value</p>
                        <p className="text-lg font-bold text-violet-900">{conflict?.manual_value || '—'}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-600 mb-1">Dentrix Ascend Value</p>
                        <p className="text-lg font-bold text-blue-900">{conflict?.ascend_value || '—'}</p>
                      </div>
                    </div>
                    {conflict?.recommended_action && (
                      <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-lg px-3 py-2">
                        <Icon name="Lightbulb" className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                        {conflict?.recommended_action}
                      </p>
                    )}
                    {conflict?.resolution === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerResolveConflict(conflict?.id, 'use_ascend')}
                          disabled={resolvingId === conflict?.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="Download" className="w-3.5 h-3.5" />
                          Use Ascend
                        </button>
                        <button
                          onClick={() => triggerResolveConflict(conflict?.id, 'use_manual')}
                          disabled={resolvingId === conflict?.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="Shield" className="w-3.5 h-3.5" />
                          Keep Manual
                        </button>
                        <button
                          onClick={() => triggerResolveConflict(conflict?.id, 'flagged')}
                          disabled={resolvingId === conflict?.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="Flag" className="w-3.5 h-3.5" />
                          Flag for Review
                        </button>
                        {resolvingId === conflict?.id && (
                          <Icon name="Loader" className="w-4 h-4 text-slate-400 animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── BACKFILL TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'backfill' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Historical Data Backfill</h2>
            <p className="text-sm text-slate-500 mb-5">Pull all available Dentrix Ascend data from April 1, 2022 to today. Missing periods will trigger an email alert to admasu@thenudental.com.</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
              <Icon name="AlertTriangle" className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Dry Run Mode Recommended First</p>
                <p className="text-xs text-amber-700 mt-1">Run in dry-run mode first to preview what would be imported without writing any data. This detects missing ranges and conflicts safely.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backfillDryRun}
                  onChange={e => setBackfillDryRun(e?.target?.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700">Dry Run (preview only, no data written)</span>
              </label>
            </div>

            {!backfillDryRun && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-start gap-2">
                <Icon name="AlertOctagon" className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <span className="font-semibold">Live backfill mode.</span>{' '}
                  Running will write monthly executive analytics, sync logs, endpoint backfill dates, and conflict records. A confirmation will be required before proceeding.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Backfill Start Date</p>
                <p className="font-semibold text-slate-800">April 1, 2022</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Backfill End Date</p>
                <p className="font-semibold text-slate-800">Today ({new Date()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</p>
              </div>
            </div>

            <button
              onClick={triggerBackfill}
              disabled={backfilling}
              className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
                backfillDryRun ? 'bg-slate-900 hover:bg-slate-800' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Icon name="History" className={`w-4 h-4 ${backfilling ? 'animate-spin' : ''}`} />
              {backfilling ? 'Running Backfill…' : backfillDryRun ? 'Run Dry-Run Preview' : 'Run Historical Backfill'}
            </button>
          </div>

          {/* Backfill Results */}
          {backfillResult && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Backfill Results {backfillResult?.isDryRun && <span className="ml-2 text-xs text-amber-600 font-medium">(Dry Run)</span>}</h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-600 font-medium">{backfillResult?.results?.filter(r => r?.status === 'success')?.length || 0} success</span>
                  <span className="text-red-600 font-medium">{backfillResult?.results?.filter(r => r?.status === 'error')?.length || 0} errors</span>
                  <span className="text-amber-600 font-medium">{backfillResult?.missingRanges?.length || 0} missing</span>
                </div>
              </div>
              {backfillResult?.missingRanges?.length > 0 && (
                <div className="p-4">
                  <p className="text-sm font-medium text-red-700 mb-3">Missing Data Periods (email alert sent to admasu@thenudental.com)</p>
                  <div className="space-y-2">
                    {backfillResult?.missingRanges?.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 bg-red-50 rounded-lg px-3 py-2 text-xs">
                        <Icon name="XCircle" className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-red-800">{r?.dateRange}</span>
                          <span className="text-red-600 ml-2">— {r?.issue}</span>
                          <p className="text-red-500 mt-0.5">{r?.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* ── ALERTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Loading alerts…</div>
          ) : (summary?.alerts || [])?.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Icon name="CheckCircle" className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No active alerts</p>
            </div>
          ) : (summary?.alerts || [])?.map(alert => (
            <div key={alert?.id} className={`bg-white rounded-xl border overflow-hidden ${
              alert?.severity === 'high' || alert?.severity === 'critical' ? 'border-red-200' :
              alert?.severity === 'medium' ? 'border-amber-200' : 'border-slate-200'
            }`}>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert?.severity === 'high' || alert?.severity === 'critical' ? 'bg-red-100' :
                    alert?.severity === 'medium' ? 'bg-amber-100' : 'bg-slate-100'
                  }`}>
                    <Icon name="AlertTriangle" className={`w-4 h-4 ${
                      alert?.severity === 'high' || alert?.severity === 'critical' ? 'text-red-600' :
                      alert?.severity === 'medium' ? 'text-amber-600' : 'text-slate-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{alert?.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{alert?.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{alert?.alert_type}</span>
                      {alert?.affected_module && <><span>·</span><span>{alert?.affected_module}</span></>}
                      {alert?.office_id && <><span>·</span><span>{getOfficeNameById(alert?.office_id)}</span></>}
                      <span>·</span>
                      <span>{formatRelative(alert?.created_at)}</span>
                      {alert?.email_sent && <span className="text-emerald-500">· Email sent</span>}
                    </div>
                  </div>
                </div>
                <StatusBadge status={alert?.severity} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
