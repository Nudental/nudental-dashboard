import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/AppIcon';
import { emailService } from '../../services/emailService';

const EMAIL_TYPE_LABELS = {
  welcome: 'Welcome',
  password_reset: 'Password Reset',
  entry_submitted: 'Entry Submitted',
  entry_approved: 'Entry Approved',
  entry_rejected: 'Entry Rejected',
  entry_needs_review: 'Needs Review',
};

const EMAIL_TYPE_COLORS = {
  welcome: 'bg-primary/10 text-primary',
  password_reset: 'bg-warning/10 text-warning',
  entry_submitted: 'bg-blue-50 text-blue-600',
  entry_approved: 'bg-success/10 text-success',
  entry_rejected: 'bg-destructive/10 text-destructive',
  entry_needs_review: 'bg-orange-50 text-orange-600',
};

const EmailLogsManagement = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await emailService?.getEmailLogs({
        limit: 200,
        status: statusFilter || null,
        email_type: typeFilter || null,
      });
      setLogs(data);
    } catch (err) {
      setError(err?.message || 'Failed to load email logs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery?.toLowerCase();
    return (
      log?.recipient_email?.toLowerCase()?.includes(q) ||
      log?.recipient_name?.toLowerCase()?.includes(q) ||
      log?.subject?.toLowerCase()?.includes(q)
    );
  });

  const sentCount = logs?.filter((l) => l?.status === 'sent')?.length;
  const failedCount = logs?.filter((l) => l?.status === 'failed')?.length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon name="Mail" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{logs?.length}</p>
            <p className="text-xs text-muted-foreground">Total Emails</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-success/10 flex items-center justify-center">
            <Icon name="CheckCircle" size={16} color="var(--color-success)" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center">
            <Icon name="XCircle" size={16} color="var(--color-destructive)" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search recipient or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e?.target?.value)}
          className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e?.target?.value)}
          className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          <option value="">All Types</option>
          {Object.entries(EMAIL_TYPE_LABELS)?.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          onClick={loadLogs}
          className="px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground flex items-center gap-1.5"
        >
          <Icon name="RefreshCw" size={13} />
          Refresh
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Loading email logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="Inbox" size={32} color="var(--color-muted-foreground)" />
                      <p className="text-muted-foreground text-sm">No email logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs?.map((log) => (
                  <tr key={log?.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log?.created_at ? new Date(log?.created_at)?.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{log?.recipient_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{log?.recipient_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        EMAIL_TYPE_COLORS?.[log?.email_type] || 'bg-muted text-muted-foreground'
                      }`}>
                        {EMAIL_TYPE_LABELS?.[log?.email_type] || log?.email_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="text-sm text-foreground truncate">{log?.subject || '—'}</p>
                      {log?.error_message && (
                        <p className="text-xs text-destructive truncate mt-0.5">{log?.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log?.status === 'sent' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      }`}>
                        <Icon name={log?.status === 'sent' ? 'CheckCircle' : 'XCircle'} size={11} />
                        {log?.status === 'sent' ? 'Sent' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmailLogsManagement;
