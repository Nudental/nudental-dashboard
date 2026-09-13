import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, RotateCcw, Filter, AlertTriangle, CheckCircle, XCircle, Clock, MinusCircle, ChevronDown, ChevronUp, Building2, Zap, BarChart3, Calendar, Search, Info, AlertCircle } from 'lucide-react';
import {
  runFullImport,
  runOfficeImport,
  runEndpointImport,
  retryFailedImports,
  fetchImportAuditLog,
  fetchImportSummary,
  DENTRIX_OFFICES,
  DENTRIX_ENDPOINTS,
} from '../../services/dentrixIngestionService';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';


















// ─── Sensitive key filter for error_details ───────────────────────────────────

const SENSITIVE_KEYS = ['token', 'api_key', 'authorization', 'password', 'secret', 'bearer', 'access_token', 'refresh_token'];

const sanitizeErrorDetails = (details) => {
  if (!details) return null;
  try {
    const obj = typeof details === 'string' ? JSON.parse(details) : details;
    const cleaned = JSON.parse(JSON.stringify(obj, (key, value) => {
      if (SENSITIVE_KEYS.includes(key?.toLowerCase())) return '[redacted]';
      return value;
    }));
    const raw = JSON.stringify(cleaned, null, 2);
    return raw?.length > 500 ? raw.slice(0, 500) + '\n… [truncated]' : raw;
  } catch {
    const raw = typeof details === 'string' ? details : JSON.stringify(details);
    return raw?.length > 500 ? raw.slice(0, 500) + '\n… [truncated]' : raw;
  }
};

// ─── Non-blocking audit log writer ───────────────────────────────────────────

const writeAuditLog = async ({ actionType, userId, metadata = {} }) => {
  try {
    await supabase.from('audit_logs').insert({
      action_type: actionType,
      user_id: userId || null,
      new_values: { ...metadata, source: 'Import Audit' },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking — audit failure must not interrupt the user action
  }
};

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

const ConfirmDialog = ({ open, title, message, confirmLabel, onConfirm, onCancel, confirmClassName = '' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${confirmClassName || 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  'Success':         { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle,  dot: 'bg-emerald-500' },
  'Partial Success': { color: 'bg-amber-100 text-amber-800 border-amber-200',       icon: AlertTriangle, dot: 'bg-amber-500' },
  'No Data Returned':{ color: 'bg-slate-100 text-slate-700 border-slate-200',       icon: MinusCircle,  dot: 'bg-slate-400' },
  'Failed':          { color: 'bg-red-100 text-red-800 border-red-200',             icon: XCircle,      dot: 'bg-red-500' },
  'Skipped':         { color: 'bg-blue-100 text-blue-800 border-blue-200',          icon: MinusCircle,  dot: 'bg-blue-400' },
  'pending':         { color: 'bg-gray-100 text-gray-600 border-gray-200',          icon: Clock,        dot: 'bg-gray-400' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.['pending'];
  const StatusIcon = cfg?.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg?.color}`}>
      <StatusIcon size={11} />
      {status}
    </span>
  );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub = null, color = 'text-slate-800', icon: Icon = null }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
    {Icon && (
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-slate-600" />
      </div>
    )}
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Admin Import Summary ─────────────────────────────────────────────────────

const AdminImportSummary = ({ summary, onRefresh }) => {
  if (!summary) return null;
  const { lastSyncByOffice, lastSyncByEndpoint, totalImportedToday, totalFailuresToday, totalNoDataToday, totalPartialToday } = summary;

  const fmtTime = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-500" />
          Import Summary — Today
        </h2>
        <button onClick={onRefresh} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Records Imported Today" value={totalImportedToday?.toLocaleString()} color="text-emerald-700" icon={CheckCircle} />
        <SummaryCard label="Failures Today" value={totalFailuresToday} color={totalFailuresToday > 0 ? 'text-red-600' : 'text-slate-800'} icon={XCircle} />
        <SummaryCard label="No Data Endpoints" value={totalNoDataToday} color="text-slate-600" icon={MinusCircle} />
        <SummaryCard label="Partial Successes" value={totalPartialToday} color={totalPartialToday > 0 ? 'text-amber-600' : 'text-slate-800'} icon={AlertTriangle} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Last sync by office */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Last Sync by Office</p>
          <div className="space-y-1.5">
            {DENTRIX_OFFICES?.map((o) => {
              const info = lastSyncByOffice?.[o?.officeId];
              return (
                <div key={o?.officeId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{o?.officeName}</span>
                  <span className="text-slate-500 text-xs">{fmtTime(info?.lastSync)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Last sync by endpoint */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Last Sync by Endpoint</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {DENTRIX_ENDPOINTS?.map((ep) => {
              const info = lastSyncByEndpoint?.[ep?.key];
              return (
                <div key={ep?.key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium truncate max-w-[160px]">{ep?.name}</span>
                  <span className="text-slate-500 text-xs">{fmtTime(info?.lastSync)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Location ID display helper ───────────────────────────────────────────────

const LocationDisplay = ({ officeName, locationId }) => {
  if (officeName) {
    return (
      <span className="text-slate-700 font-medium">
        {officeName}
        {locationId && (
          <span className="block text-xs text-slate-400 font-normal">
            Internal Location ID: {locationId}
          </span>
        )}
      </span>
    );
  }
  if (locationId) {
    return (
      <span className="text-slate-500 text-xs">
        Internal Location ID: {locationId}
      </span>
    );
  }
  return <span className="text-slate-400">—</span>;
};

// ─── Audit Log Row ────────────────────────────────────────────────────────────

const AuditRow = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso)?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const sanitizedDetails = sanitizeErrorDetails(entry?.error_details);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 text-sm whitespace-nowrap">
          <LocationDisplay officeName={entry?.office_name} locationId={entry?.location_id} />
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{entry?.endpoint_name || entry?.endpoint_key}</td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtTime(entry?.started_at)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
            entry?.sync_type === 'historical' ? 'bg-purple-100 text-purple-700' :
            entry?.sync_type === 'incremental' ? 'bg-blue-100 text-blue-700' :
            entry?.sync_type === 'scheduled'? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {entry?.sync_type || 'manual'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={entry?.status} /></td>
        <td className="px-4 py-3 text-sm text-slate-600 text-right tabular-nums">{(entry?.records_fetched ?? 0)?.toLocaleString()}</td>
        <td className="px-4 py-3 text-sm text-emerald-700 text-right tabular-nums font-medium">{(entry?.records_imported ?? 0)?.toLocaleString()}</td>
        <td className="px-4 py-3 text-sm text-amber-600 text-right tabular-nums">{(entry?.records_skipped ?? 0)?.toLocaleString()}</td>
        <td className="px-4 py-3 text-sm text-red-600 text-right tabular-nums">{(entry?.records_failed ?? 0)?.toLocaleString()}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={10} className="px-4 py-3">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-700">{entry?.reason || 'No reason provided'}</p>
                {sanitizedDetails ? (
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2 overflow-x-auto max-w-2xl whitespace-pre-wrap break-words">
                    {sanitizedDetails}
                  </pre>
                ) : null}
                {entry?.retry_count > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Retry attempts: {entry?.retry_count}</p>
                )}
                {entry?.next_retry_at && (
                  <p className="text-xs text-slate-500">Next retry: {new Date(entry.next_retry_at)?.toLocaleString()}</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Import Audit Page ───────────────────────────────────────────────────

const ImportAuditPage = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);
  const [auditLog, setAuditLog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [runningAction, setRunningAction] = useState(null);
  const [toast, setToast] = useState(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmClassName: '',
    onConfirm: null,
  });

  // Page-level guard
  if (!permLoading && userProfile && !isAdmin && !hasPermission('admin.import_audit.view')) {
    return <AccessDenied message="Import Audit is restricted to administrators." />;
  }

  // Filters
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterEndpoint, setFilterEndpoint] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSyncType, setFilterSyncType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchText, setSearchText] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openConfirm = ({ title, message, confirmLabel, confirmClassName, onConfirm }) => {
    setConfirmDialog({ open: true, title, message, confirmLabel, confirmClassName: confirmClassName || '', onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog({ open: false, title: '', message: '', confirmLabel: '', confirmClassName: '', onConfirm: null });
  };

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchImportAuditLog({
        officeId: filterOffice !== 'all' ? filterOffice : null,
        endpointKey: filterEndpoint !== 'all' ? filterEndpoint : null,
        status: filterStatus !== 'all' ? filterStatus : null,
        syncType: filterSyncType !== 'all' ? filterSyncType : null,
        dateFrom: filterDateFrom || null,
        dateTo: filterDateTo || null,
        limit: 300,
      });
      setAuditLog(data);
    } catch (err) {
      showToast(`Failed to load audit log: ${err?.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterEndpoint, filterStatus, filterSyncType, filterDateFrom, filterDateTo]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await fetchImportSummary();
      setSummary(data);
    } catch (err) {
      console.error('[loadSummary]', err?.message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLog();
    loadSummary();
  }, [loadAuditLog, loadSummary]);

  // ── Execute functions (called only after confirmation) ──────────────────────

  const executeFullImport = async () => {
    closeConfirm();
    setRunningAction('full');
    try {
      const result = await runFullImport({ syncType: 'manual', triggeredBy: 'admin' });
      showToast(`Full import complete — ${result?.totalEndpoints} endpoint/office combinations processed`);
      await writeAuditLog({
        actionType: 'IMPORT_AUDIT_FULL_IMPORT_TRIGGERED',
        userId: userProfile?.id,
        metadata: { action_type: 'IMPORT_AUDIT_FULL_IMPORT_TRIGGERED', sync_type: 'manual' },
      });
      await loadAuditLog();
      await loadSummary();
    } catch (err) {
      showToast(`Full import failed: ${err?.message}`, 'error');
    } finally {
      setRunningAction(null);
    }
  };

  const executeOfficeImport = async () => {
    closeConfirm();
    if (filterOffice === 'all') {
      showToast('Select a specific office first to run an office import', 'error');
      return;
    }
    setRunningAction('office');
    try {
      const officeObj = DENTRIX_OFFICES?.find((o) => o?.officeId === filterOffice);
      const result = await runOfficeImport({ officeId: filterOffice, syncType: 'manual', triggeredBy: 'admin' });
      showToast(`Office import complete — ${result?.totalEndpoints} endpoints processed`);
      await writeAuditLog({
        actionType: 'IMPORT_AUDIT_OFFICE_IMPORT_TRIGGERED',
        userId: userProfile?.id,
        metadata: {
          action_type: 'IMPORT_AUDIT_OFFICE_IMPORT_TRIGGERED',
          office_id: filterOffice,
          office_name: officeObj?.officeName || null,
          sync_type: 'manual',
        },
      });
      await loadAuditLog();
      await loadSummary();
    } catch (err) {
      showToast(`Office import failed: ${err?.message}`, 'error');
    } finally {
      setRunningAction(null);
    }
  };

  const executeEndpointImport = async () => {
    closeConfirm();
    if (filterEndpoint === 'all') {
      showToast('Select a specific endpoint first to run an endpoint import', 'error');
      return;
    }
    setRunningAction('endpoint');
    try {
      const result = await runEndpointImport({ endpointKey: filterEndpoint, syncType: 'manual', triggeredBy: 'admin' });
      showToast(`Endpoint import complete — ${result?.totalEndpoints} office(s) processed`);
      await writeAuditLog({
        actionType: 'IMPORT_AUDIT_ENDPOINT_IMPORT_TRIGGERED',
        userId: userProfile?.id,
        metadata: {
          action_type: 'IMPORT_AUDIT_ENDPOINT_IMPORT_TRIGGERED',
          endpoint_key: filterEndpoint,
          sync_type: 'manual',
        },
      });
      await loadAuditLog();
      await loadSummary();
    } catch (err) {
      showToast(`Endpoint import failed: ${err?.message}`, 'error');
    } finally {
      setRunningAction(null);
    }
  };

  const executeRetryFailed = async () => {
    closeConfirm();
    setRunningAction('retry');
    try {
      const result = await retryFailedImports({
        officeId: filterOffice !== 'all' ? filterOffice : null,
        endpointKey: filterEndpoint !== 'all' ? filterEndpoint : null,
      });
      showToast(`Retry complete — ${result?.retried} failed import(s) retried`);
      await writeAuditLog({
        actionType: 'IMPORT_AUDIT_RETRY_TRIGGERED',
        userId: userProfile?.id,
        metadata: {
          action_type: 'IMPORT_AUDIT_RETRY_TRIGGERED',
          office_id: filterOffice !== 'all' ? filterOffice : null,
          endpoint_key: filterEndpoint !== 'all' ? filterEndpoint : null,
          sync_type: 'retry',
        },
      });
      await loadAuditLog();
      await loadSummary();
    } catch (err) {
      showToast(`Retry failed: ${err?.message}`, 'error');
    } finally {
      setRunningAction(null);
    }
  };

  // ── Trigger functions (open confirmation first) ─────────────────────────────

  const handleRunFullImport = () => {
    openConfirm({
      title: 'Run Full Import',
      message: 'This will trigger live Dentrix Ascend API calls for all offices and all available endpoints, and write import records to the database. This is a live data operation. Continue?',
      confirmLabel: 'Run Full Import',
      confirmClassName: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: executeFullImport,
    });
  };

  const handleRunOfficeImport = () => {
    if (filterOffice === 'all') {
      showToast('Select a specific office first to run an office import', 'error');
      return;
    }
    openConfirm({
      title: 'Run Office Import',
      message: 'This will trigger live Dentrix Ascend API calls for the selected office across all endpoints and write import records to the database. Continue?',
      confirmLabel: 'Run Office Import',
      confirmClassName: 'bg-teal-600 hover:bg-teal-700',
      onConfirm: executeOfficeImport,
    });
  };

  const handleRunEndpointImport = () => {
    if (filterEndpoint === 'all') {
      showToast('Select a specific endpoint first to run an endpoint import', 'error');
      return;
    }
    openConfirm({
      title: 'Run Endpoint Import',
      message: 'This will trigger live Dentrix Ascend API calls for the selected endpoint across all offices and write import records to the database. Continue?',
      confirmLabel: 'Run Endpoint Import',
      confirmClassName: 'bg-violet-600 hover:bg-violet-700',
      onConfirm: executeEndpointImport,
    });
  };

  const handleRetryFailed = () => {
    openConfirm({
      title: 'Retry Failed Imports',
      message: 'This will retry up to 100 failed import entries by calling live Dentrix Ascend API endpoints and writing new import records. Continue?',
      confirmLabel: 'Retry Failed Imports',
      confirmClassName: 'bg-amber-600 hover:bg-amber-700',
      onConfirm: executeRetryFailed,
    });
  };

  // Filter audit log by search text
  const filteredLog = auditLog?.filter((entry) => {
    if (!searchText) return true;
    const q = searchText?.toLowerCase();
    return (entry?.office_name?.toLowerCase()?.includes(q) ||
    entry?.endpoint_name?.toLowerCase()?.includes(q) ||
    entry?.endpoint_key?.toLowerCase()?.includes(q) ||
    entry?.reason?.toLowerCase()?.includes(q) ||
    entry?.status?.toLowerCase()?.includes(q) || entry?.location_id?.includes(q));
  });

  const statusCounts = auditLog?.reduce((acc, e) => {
    acc[e.status] = (acc?.[e?.status] || 0) + 1;
    return acc;
  }, {});

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
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast?.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast?.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />}
          {toast?.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Zap size={20} className="text-indigo-500" />
          Dentrix Ascend Import Audit
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Multi-location data ingestion pipeline — all 4 offices × all available endpoints
        </p>
      </div>

      {/* Source-of-truth helper note */}
      <div className="mb-5 flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <span>
          Import Audit shows raw Dentrix import attempt history from <code className="font-mono text-xs bg-blue-100 px-1 rounded">import_audit_log</code>.
          For current job-level sync health, use <strong>Admin → Sync Dashboard</strong>.
        </span>
      </div>

      {/* Admin Summary */}
      {!summaryLoading && summary && (
        <AdminImportSummary summary={summary} onRefresh={loadSummary} />
      )}

      {/* Status Overview Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(statusCounts)?.map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filterStatus === status
                ? 'ring-2 ring-indigo-400 ' + (STATUS_CONFIG?.[status]?.color || 'bg-slate-100 text-slate-700 border-slate-200')
                : (STATUS_CONFIG?.[status]?.color || 'bg-slate-100 text-slate-700 border-slate-200')
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG?.[status]?.dot || 'bg-slate-400'}`} />
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={handleRunFullImport}
          disabled={!!runningAction}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {runningAction === 'full' ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          Run Full Import
        </button>
        <button
          onClick={handleRunOfficeImport}
          disabled={!!runningAction || filterOffice === 'all'}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          title={filterOffice === 'all' ? 'Select an office first' : ''}
        >
          {runningAction === 'office' ? <RefreshCw size={14} className="animate-spin" /> : <Building2 size={14} />}
          Run Office Import
        </button>
        <button
          onClick={handleRunEndpointImport}
          disabled={!!runningAction || filterEndpoint === 'all'}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          title={filterEndpoint === 'all' ? 'Select an endpoint first' : ''}
        >
          {runningAction === 'endpoint' ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
          Run Endpoint Import
        </button>
        <button
          onClick={handleRetryFailed}
          disabled={!!runningAction}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {runningAction === 'retry' ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Retry Failed Imports
        </button>
        <button
          onClick={loadAuditLog}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh Audit Log
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Office filter */}
          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All Offices</option>
            {DENTRIX_OFFICES?.map((o) => (
              <option key={o?.officeId} value={o?.officeId}>{o?.officeName}</option>
            ))}
          </select>

          {/* Endpoint filter */}
          <select
            value={filterEndpoint}
            onChange={(e) => setFilterEndpoint(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All Endpoints</option>
            {DENTRIX_ENDPOINTS?.map((ep) => (
              <option key={ep?.key} value={ep?.key}>{ep?.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Partial Success">Partial Success</option>
            <option value="No Data Returned">No Data Returned</option>
            <option value="Failed">Failed</option>
            <option value="Skipped">Skipped</option>
          </select>

          {/* Sync type filter */}
          <select
            value={filterSyncType}
            onChange={(e) => setFilterSyncType(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">All Sync Types</option>
            <option value="historical">Historical</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
            <option value="incremental">Incremental</option>
            <option value="streaming">Streaming</option>
          </select>

          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="From"
          />

          {/* Date to */}
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e?.target?.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="To"
          />
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e?.target?.value)}
            placeholder="Search by office, endpoint, status, or reason..."
            className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {filteredLog?.length} of {auditLog?.length} entries
          </p>
          <button
            onClick={() => {
              setFilterOffice('all');
              setFilterEndpoint('all');
              setFilterStatus('all');
              setFilterSyncType('all');
              setFilterDateFrom('');
              setFilterDateTo('');
              setSearchText('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Calendar size={14} className="text-slate-500" />
            Import Audit Log
          </h2>
          <span className="text-xs text-slate-400">{filteredLog?.length} entries</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-indigo-500 mr-2" />
            <span className="text-sm text-slate-500">Loading audit log...</span>
          </div>
        ) : filteredLog?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <MinusCircle size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No audit entries found</p>
            <p className="text-xs mt-1">Run an import or adjust your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Office / Location</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Endpoint</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date / Time</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Sync Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Fetched</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Imported</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Skipped</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Failed</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLog?.map((entry) => (
                  <AuditRow key={entry?.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Office × Endpoint Coverage Grid */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Building2 size={14} className="text-slate-500" />
          Office × Endpoint Coverage
        </h2>
        {/* Coverage Grid helper note */}
        <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
          <Info size={12} className="text-slate-400 flex-shrink-0" />
          Coverage grid reflects the most recent status within the current 300-entry audit log window. Older entries may not appear.
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="pr-4 pb-2 text-left text-slate-500 font-medium">Endpoint</th>
                {DENTRIX_OFFICES?.map((o) => (
                  <th key={o?.officeId} className="px-3 pb-2 text-center text-slate-500 font-medium whitespace-nowrap">{o?.officeName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DENTRIX_ENDPOINTS?.map((ep) => (
                <tr key={ep?.key} className="border-t border-slate-50">
                  <td className="pr-4 py-2 text-slate-700 font-medium whitespace-nowrap">{ep?.name}</td>
                  {DENTRIX_OFFICES?.map((o) => {
                    const entry = auditLog?.find(
                      (e) => e?.endpoint_key === ep?.key && e?.office_id === o?.officeId
                    );
                    const status = entry?.status;
                    const cfg = STATUS_CONFIG?.[status];
                    return (
                      <td key={o?.officeId} className="px-3 py-2 text-center">
                        {status ? (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${cfg?.dot || 'bg-slate-300'}`} title={status}>
                            <span className="sr-only">{status}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100" title="No data">
                            <span className="text-slate-300">—</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(STATUS_CONFIG)?.slice(0, 5)?.map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-3 h-3 rounded-full ${cfg?.dot}`} />
                {status}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportAuditPage;
