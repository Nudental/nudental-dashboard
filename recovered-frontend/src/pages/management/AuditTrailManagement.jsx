import React, { useState, useEffect, useCallback } from 'react';
import { auditLogsService } from '../../services/managementService';
import Icon from '../../components/AppIcon';

const ACTION_COLORS = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-primary/10 text-primary',
  TOGGLE_ACTIVE: 'bg-warning/10 text-warning',
  SOFT_DELETE: 'bg-destructive/10 text-destructive',
  INVITE: 'bg-accent/10 text-accent-foreground',
};

const ACTION_LABELS = {
  CREATE: 'Create',
  UPDATE: 'Update',
  TOGGLE_ACTIVE: 'Status Change',
  SOFT_DELETE: 'Delete',
  INVITE: 'Invite',
};

const TABLE_LABELS = {
  user_profiles: 'Users & Staff',
  offices: 'Offices',
  providers: 'Providers',
  cost_drivers: 'Cost Drivers',
  back_staff_orders: 'Back Staff Orders',
};

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d?.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const AuditTrailManagement = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await auditLogsService?.getAll();
      setLogs(data);
    } catch (err) {
      setLogs([]);
      setError(err?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setPage(1); setExpandedRow(null); }, [searchQuery, actionFilter, tableFilter]);

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = !searchQuery ||
      log?.userName?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      log?.change_summary?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    const matchesAction = actionFilter === 'all' || log?.action === actionFilter;
    const matchesTable = tableFilter === 'all' || log?.table_name === tableFilter;
    return matchesSearch && matchesAction && matchesTable;
  });
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / 25));
  const currentPage = Math.min(page, pageCount);
  const pagedLogs = filteredLogs.slice((currentPage - 1) * 25, currentPage * 25);

  const uniqueActions = [...new Set(logs?.map(l => l?.action))];
  const uniqueTables = [...new Set(logs?.map(l => l?.table_name))];

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={16} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by user or change summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e?.target?.value)}
          className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          <option value="all">All Actions</option>
          {uniqueActions?.map(a => (
            <option key={a} value={a}>{ACTION_LABELS?.[a] || a}</option>
          ))}
        </select>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e?.target?.value)}
          className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
        >
          <option value="all">All Sections</option>
          {uniqueTables?.map(t => (
            <option key={t} value={t}>{TABLE_LABELS?.[t] || t}</option>
          ))}
        </select>
        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground"
        >
          <Icon name="RefreshCw" size={14} />
          Refresh
        </button>
      </div>
      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="ClipboardList" size={18} color="var(--color-primary)" />
            <h3 className="text-lg font-semibold text-foreground">Audit Trail</h3>
          </div>
          <span className="text-sm text-muted-foreground">{filteredLogs?.length} entries</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading audit logs...</span>
            </div>
          </div>
        ) : filteredLogs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon name="ClipboardList" size={40} color="var(--color-muted-foreground)" />
            <p className="mt-3 text-sm">No audit log entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Section</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change Summary</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedLogs.map((log) => (
                  <React.Fragment key={log?.id}>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log?.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground truncate block max-w-[130px]">{log?.userName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS?.[log?.action] || 'bg-muted text-muted-foreground'}`}>
                          {ACTION_LABELS?.[log?.action] || log?.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{TABLE_LABELS?.[log?.table_name] || log?.table_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{log?.change_summary || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(log?.old_values || log?.new_values) && (
                          <button
                            onClick={() => setExpandedRow(expandedRow === log?.id ? null : log?.id)}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="View diff"
                          >
                            <Icon name={expandedRow === log?.id ? 'ChevronUp' : 'ChevronDown'} size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === log?.id && (
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="px-4 py-3">
                          <DiffView oldValues={log?.old_values} newValues={log?.new_values} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredLogs.length > 0 && (
          <nav aria-label="Audit Trail pagination" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">Page {currentPage} of {pageCount}</span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
              <button className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>Previous</button>
              <button className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))}>Next</button>
              <button className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}>Last</button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

const IGNORED_KEYS = ['updated_at', 'created_at', 'id'];

const DiffView = ({ oldValues, newValues }) => {
  if (!oldValues && !newValues) return null;

  const allKeys = [...new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ])]?.filter(k => !IGNORED_KEYS?.includes(k));

  const changedKeys = allKeys?.filter(k => String(oldValues?.[k] ?? '') !== String(newValues?.[k] ?? ''));

  if (changedKeys?.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No field-level changes detected.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Changed Fields</p>
      <div className="grid gap-1">
        {changedKeys?.map(key => (
          <div key={key} className="flex items-start gap-3 text-xs">
            <span className="font-medium text-foreground w-32 flex-shrink-0">
              {key?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase())}
            </span>
            {oldValues && (
              <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded line-through">
                {String(oldValues?.[key] ?? '—')}
              </span>
            )}
            <Icon name="ArrowRight" size={12} color="var(--color-muted-foreground)" className="mt-0.5 flex-shrink-0" />
            <span className="px-2 py-0.5 bg-success/10 text-success rounded">
              {String(newValues?.[key] ?? '—')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTrailManagement;
