import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { resolveStatusConfig } from '../../../services/actionItemsService';

const formatTs = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return '—'; }
};

const EditTaskModal = ({ task, staffList, onSave, onClose, loading, canManage }) => {
  const [form, setForm] = useState({
    action_required: '',
    assigned_owner_id: '',
    due_date: '',
    priority_level: 'medium',
    task_status: 'pending',
    notes: '',
  });

  useEffect(() => {
    if (task) {
      setForm({
        action_required: task?.action_required || '',
        assigned_owner_id: task?.assigned_owner_id || '',
        due_date: task?.due_date || '',
        priority_level: task?.priority_level || 'medium',
        task_status: task?.task_status || 'pending',
        notes: task?.notes || '',
      });
    }
  }, [task]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSave?.(task?.id, form);
  };

  const statusCfg = resolveStatusConfig(task?.task_status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Icon name="Pencil" size={16} color="var(--color-primary)" />
            Edit Task
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-smooth">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Lifecycle Timestamps — read-only display */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Task Timeline</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Submitted:</span>
                <span className="ml-1 text-foreground font-medium">
                  {task?.submitted_at ? formatTs(task?.submitted_at) : formatTs(task?.created_at)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Acknowledged:</span>
                <span className="ml-1 text-foreground font-medium">{formatTs(task?.acknowledged_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">In Progress:</span>
                <span className="ml-1 text-foreground font-medium">{formatTs(task?.in_progress_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-1 text-foreground font-medium">{formatTs(task?.completed_at)}</span>
              </div>
            </div>
            <div className="pt-1 border-t border-border">
              <span className="text-muted-foreground text-xs">Current Status: </span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${statusCfg?.cls}`}>
                <Icon name={statusCfg?.icon} size={10} />
                {statusCfg?.label}
              </span>
            </div>
            {task?.created_by_user?.full_name && (
              <div className="text-xs text-muted-foreground">
                Created by: <span className="text-foreground">{task?.created_by_user?.full_name}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Action Required</label>
            <textarea
              value={form?.action_required}
              onChange={(e) => handleChange('action_required', e?.target?.value)}
              rows={3}
              required
              disabled={!canManage}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select
                value={form?.priority_level}
                onChange={(e) => handleChange('priority_level', e?.target?.value)}
                disabled={!canManage}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select
                value={form?.task_status}
                onChange={(e) => handleChange('task_status', e?.target?.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="pending">Submitted</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {canManage && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned Owner</label>
              <select
                value={form?.assigned_owner_id}
                onChange={(e) => handleChange('assigned_owner_id', e?.target?.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {staffList?.map(s => (
                  <option key={s?.id} value={s?.id}>{s?.full_name} {s?.job_title ? `(${s?.job_title})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {canManage && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
              <input
                type="date"
                value={form?.due_date}
                onChange={(e) => handleChange('due_date', e?.target?.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea
              value={form?.notes}
              onChange={(e) => handleChange('notes', e?.target?.value)}
              rows={2}
              disabled={!canManage}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-smooth"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Icon name="Loader2" size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;
