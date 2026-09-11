import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchAuditLog } from '../../../services/boneTissueService';

const formatTs = (ts) => {
  if (!ts) return '—';
  return new Date(ts)?.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const ACTION_CONFIG = {
  created: { cls: 'bg-emerald-100 text-emerald-700', icon: 'Plus' },
  updated: { cls: 'bg-blue-100 text-blue-700', icon: 'Pencil' },
  deleted: { cls: 'bg-red-100 text-red-700', icon: 'Trash2' },
};

const AuditPanel = ({ recordId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    fetchAuditLog(recordId)?.then(setLogs)?.catch(console.error)?.finally(() => setLoading(false));
  }, [recordId]);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="History" size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit History</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2]?.map(i => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : logs?.length === 0 ? (
        <p className="text-xs text-muted-foreground">No history available.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {logs?.map(log => {
            const cfg = ACTION_CONFIG?.[log?.action] || ACTION_CONFIG?.updated;
            return (
              <div key={log?.id} className="flex items-start gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${cfg?.cls}`}>
                  <Icon name={cfg?.icon} size={10} />
                  {log?.action}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{log?.changed_by_name || 'Unknown'}</span>
                  <span className="text-muted-foreground ml-1">{formatTs(log?.changed_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AuditPanel;
