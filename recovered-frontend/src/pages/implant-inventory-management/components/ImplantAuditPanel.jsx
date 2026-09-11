import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchAuditLogs } from '../../../services/implantInventoryService';

const ACTION_CONFIG = {
  created:   { cls: 'bg-emerald-100 text-emerald-700', icon: 'Plus' },
  updated:   { cls: 'bg-blue-100 text-blue-700',       icon: 'Edit' },
  deleted:   { cls: 'bg-red-100 text-red-700',         icon: 'Trash2' },
  restocked: { cls: 'bg-violet-100 text-violet-700',   icon: 'PackagePlus' },
  used:      { cls: 'bg-orange-100 text-orange-700',   icon: 'CheckCircle' },
  adjusted:  { cls: 'bg-gray-100 text-gray-700',       icon: 'RefreshCw' },
};

const ImplantAuditPanel = ({ recordId, isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && recordId) {
      setLoading(true);
      fetchAuditLogs(recordId)?.then(setLogs)?.catch(console.error)?.finally(() => setLoading(false));
    }
  }, [isOpen, recordId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-card shadow-2xl flex flex-col" onClick={e => e?.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="History" size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Edit History</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3]?.map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="History" size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs?.map(log => {
                const cfg = ACTION_CONFIG?.[log?.action] || ACTION_CONFIG?.updated;
                return (
                  <div key={log?.id} className="bg-muted/40 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.cls}`}>
                        <Icon name={cfg?.icon} size={10} />
                        {log?.action}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {log?.changed_at ? new Date(log?.changed_at)?.toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium">{log?.changed_by_name || 'Unknown user'}</p>
                    {log?.new_values && (
                      <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                        {JSON.stringify(log?.new_values, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImplantAuditPanel;
