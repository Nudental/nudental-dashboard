import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  error: { label: 'Error', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  info: { label: 'Info', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
};

const PAGE_SIZE = 25;

export default function ErrorLogViewer() {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [resolving, setResolving] = useState(null);

  // Resolve confirmation dialog state
  const [confirmResolveId, setConfirmResolveId] = useState(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('unresolved');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase?.from('error_logs')?.select('*', { count: 'exact' })?.order('created_at', { ascending: false })?.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (severityFilter !== 'all') {
        query = query?.eq('severity', severityFilter);
      }
      if (resolvedFilter === 'unresolved') {
        query = query?.eq('resolved', false);
      } else if (resolvedFilter === 'resolved') {
        query = query?.eq('resolved', true);
      }
      if (searchQuery?.trim()) {
        query = query?.ilike('message', `%${searchQuery?.trim()}%`);
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err?.message || 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, severityFilter, resolvedFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Page-level guard — placed AFTER all hooks
  if (!permLoading && userProfile && !isAdmin && !hasPermission('finance.error_logs.view')) {
    return <AccessDenied message="Error Logs is restricted to administrators." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center p-8">
          <Icon name="ShieldOff" size={48} className="mx-auto mb-4 text-neutral-400" />
          <h2 className="text-xl font-semibold text-neutral-700">Access Denied</h2>
          <p className="text-neutral-500 mt-2">You do not have permission to view error logs.</p>
        </div>
      </div>
    );
  }

  const handleResolve = async (logId) => {
    setResolving(logId);
    try {
      const { error: updateError } = await supabase?.from('error_logs')?.update({
          resolved: true,
          resolved_by: userProfile?.id,
          resolved_at: new Date()?.toISOString(),
        })?.eq('id', logId);
      if (updateError) throw updateError;
      setLogs(prev => prev?.map(l => l?.id === logId ? { ...l, resolved: true } : l));
      if (selectedLog?.id === logId) {
        setSelectedLog(prev => ({ ...prev, resolved: true }));
      }
    } catch (err) {
      // silently fail
    } finally {
      setResolving(null);
    }
  };

  // Request confirmation before resolving
  const requestResolve = (logId) => {
    setConfirmResolveId(logId);
  };

  const confirmResolve = () => {
    const id = confirmResolveId;
    setConfirmResolveId(null);
    handleResolve(id);
  };

  const cancelResolve = () => {
    setConfirmResolveId(null);
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts)?.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800 flex items-center gap-2">
            <Icon name="Bug" size={24} className="text-red-500" />
            Error Log Viewer
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Frontend runtime error logs with severity levels, stack traces, and user context.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <Icon name="RefreshCw" size={14} />
          Refresh
        </button>
      </div>

      {/* Scope Banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
        <Icon name="Info" size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          <span className="font-semibold">Scope: </span>
          Error Logs show frontend/browser runtime errors recorded in <code className="bg-blue-100 px-1 rounded text-xs">public.error_logs</code>. This page does not automatically capture Dentrix/FastAPI backend errors, Supabase/PostgREST errors, edge function errors, sync job failures, or Plaid/AmEx/Wells Fargo sync errors unless those errors are explicitly logged by frontend code.
        </p>
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(SEVERITY_CONFIG)?.map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => { setSeverityFilter(key); setPage(0); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              severityFilter === key ? cfg?.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${cfg?.dot}`} />
            {cfg?.label}
          </button>
        ))}
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search error messages..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e?.target?.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={severityFilter}
          onChange={e => { setSeverityFilter(e?.target?.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={resolvedFilter}
          onChange={e => { setResolvedFilter(e?.target?.value); setPage(0); }}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <Icon name="AlertCircle" size={16} />
          {error}
        </div>
      )}
      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-28">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Message</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-36">Component</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-32">User</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-40">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-24">Status</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                Array.from({ length: 8 })?.map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 })?.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                    <Icon name="CheckCircle" size={32} className="mx-auto mb-2 text-green-400" />
                    <p className="font-medium text-neutral-600">No error logs found</p>
                    <p className="text-sm mt-1">Adjust filters or check back later</p>
                  </td>
                </tr>
              ) : (
                logs?.map(log => {
                  const cfg = SEVERITY_CONFIG?.[log?.severity] || SEVERITY_CONFIG?.error;
                  return (
                    <tr
                      key={log?.id}
                      className={`hover:bg-neutral-50 cursor-pointer transition-colors ${log?.resolved ? 'opacity-60' : ''}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                          {cfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-neutral-800 font-medium truncate max-w-xs">{log?.message}</p>
                        {log?.page_url && (
                          <p className="text-neutral-400 text-xs truncate max-w-xs mt-0.5">{log?.page_url}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{log?.component_name || '—'}</td>
                      <td className="px-4 py-3">
                        {log?.user_email ? (
                          <div>
                            <p className="text-neutral-700 text-xs truncate max-w-28">{log?.user_email}</p>
                            {log?.user_role && <p className="text-neutral-400 text-xs">{log?.user_role}</p>}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs">Anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{formatDate(log?.created_at)}</td>
                      <td className="px-4 py-3">
                        {log?.resolved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Icon name="CheckCircle" size={12} />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <Icon name="Clock" size={12} />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e?.stopPropagation()}>
                        {!log?.resolved && (
                          <button
                            onClick={() => requestResolve(log?.id)}
                            disabled={resolving === log?.id}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {resolving === log?.id ? '...' : 'Resolve'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            <p className="text-sm text-neutral-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedLog(null)}>
          <div className="flex-1 bg-black/30" />
          <div
            className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={e => e?.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${SEVERITY_CONFIG?.[selectedLog?.severity]?.color}`}>
                  <span className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG?.[selectedLog?.severity]?.dot}`} />
                  {SEVERITY_CONFIG?.[selectedLog?.severity]?.label}
                </span>
                <h2 className="text-base font-semibold text-neutral-800">Error Detail</h2>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Message */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Message</h3>
                <p className="text-neutral-800 font-medium bg-neutral-50 rounded-lg p-3 text-sm">{selectedLog?.message}</p>
              </section>

              {/* Metadata grid */}
              <section>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Context</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Component', value: selectedLog?.component_name },
                    { label: 'Environment', value: selectedLog?.environment },
                    { label: 'User Email', value: selectedLog?.user_email },
                    { label: 'User Role', value: selectedLog?.user_role },
                    { label: 'Timestamp', value: formatDate(selectedLog?.created_at) },
                    { label: 'Status', value: selectedLog?.resolved ? 'Resolved' : 'Open' },
                  ]?.map(({ label, value }) => (
                    <div key={label} className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
                      <p className="text-sm text-neutral-800 font-medium">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Page URL */}
              {selectedLog?.page_url && (
                <section>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Page URL</h3>
                  <p className="text-sm text-blue-600 bg-blue-50 rounded-lg p-3 break-all">{selectedLog?.page_url}</p>
                </section>
              )}

              {/* Stack Trace */}
              {selectedLog?.stack_trace && (
                <section>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Stack Trace</h3>
                  <pre className="text-xs text-neutral-700 bg-neutral-900 text-green-400 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                    {selectedLog?.stack_trace}
                  </pre>
                </section>
              )}

              {/* Extra Context */}
              {selectedLog?.extra_context && (
                <section>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Extra Context</h3>
                  <pre className="text-xs bg-neutral-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 text-neutral-700">
                    {JSON.stringify(selectedLog?.extra_context, null, 2)}
                  </pre>
                </section>
              )}

              {/* Browser Info */}
              {selectedLog?.browser_info && (
                <section>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Browser</h3>
                  <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-3 break-all">{selectedLog?.browser_info}</p>
                </section>
              )}
            </div>

            {/* Footer actions */}
            {!selectedLog?.resolved && (
              <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                <button
                  onClick={() => requestResolve(selectedLog?.id)}
                  disabled={resolving === selectedLog?.id}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icon name="CheckCircle" size={16} />
                  {resolving === selectedLog?.id ? 'Resolving...' : 'Mark as Resolved'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolve Confirmation Dialog */}
      {confirmResolveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Icon name="CheckCircle" size={20} className="text-green-600" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800">Mark error as resolved?</h3>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              This will update the <code className="bg-neutral-100 px-1 rounded text-xs">error_logs</code> record as resolved. It will not delete the log.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelResolve}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResolve}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
