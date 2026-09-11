import React from 'react';
import Icon from '../../../components/AppIcon';
import { resolveStatusConfig } from '../../../services/actionItemsService';

const PRIORITY_CONFIG = {
  high:   { label: 'High',   cls: 'bg-destructive/10 text-destructive border border-destructive/20', dot: 'bg-destructive' },
  medium: { label: 'Medium', cls: 'bg-warning/10 text-warning border border-warning/20',             dot: 'bg-warning' },
  low:    { label: 'Low',    cls: 'bg-success/10 text-success border border-success/20',             dot: 'bg-success' },
};

// Status transition map — lifecycle-aware
// pending/submitted → acknowledged (V538: acknowledged status now persists in DB)
// acknowledged → in_progress
// in_progress → completed
// completed → pending (reopen)
const STATUS_NEXT = {
  pending:      'acknowledged',
  submitted:    'acknowledged',
  acknowledged: 'in_progress',
  in_progress:  'completed',
  completed:    'pending',
};

const STATUS_NEXT_LABEL = {
  pending:      'Acknowledge',
  submitted:    'Acknowledge',
  acknowledged: 'Start Task',
  in_progress:  'Mark Complete',
  completed:    'Reopen',
};

const formatTs = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return '—'; }
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TaskCard = ({ task, onStatusChange, onEdit, canManage, currentUserId }) => {
  const today = new Date()?.toISOString()?.split('T')?.[0];
  const isOverdue = task?.due_date && task?.due_date < today && task?.task_status !== 'completed';
  const priority = PRIORITY_CONFIG?.[task?.priority_level] || PRIORITY_CONFIG?.medium;
  const statusCfg = resolveStatusConfig(task?.task_status);

  // Staff can only change status on their own assigned tasks
  const isAssignedToMe = task?.assigned_owner_id === currentUserId;
  const canChangeStatus = canManage || isAssignedToMe;

  // Lifecycle timestamps — render if present, show — if missing (columns not yet in schema)
  const hasLifecycleData = task?.acknowledged_at || task?.in_progress_at || task?.completed_at;

  return (
    <div className={`bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-all group ${
      isOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-border'
    }`}>
      {/* Priority + Overdue */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${priority?.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority?.dot}`} />
          {priority?.label}
        </span>
        <div className="flex items-center gap-1.5">
          {isOverdue && (
            <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold">
              <Icon name="AlertCircle" size={12} />
              Overdue
            </span>
          )}
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg?.cls}`}>
            <Icon name={statusCfg?.icon} size={10} />
            {statusCfg?.label}
          </span>
        </div>
      </div>

      {/* Action Required */}
      <p className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-3">
        {task?.action_required}
      </p>

      {/* Source */}
      {task?.source_text && (
        <p className="text-xs text-muted-foreground mb-2 italic line-clamp-1">
          <Icon name="Link" size={10} className="inline mr-1" />
          {task?.source_text}
        </p>
      )}

      {/* Meta */}
      <div className="space-y-1 mb-2">
        {task?.assigned_owner?.full_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="User" size={11} />
            <span className="truncate">{task?.assigned_owner?.full_name}</span>
          </div>
        )}
        {task?.due_date && (
          <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
            <Icon name="Calendar" size={11} />
            <span>{formatDate(task?.due_date)}</span>
          </div>
        )}
        {task?.office?.name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="Building2" size={11} />
            <span className="truncate">{task?.office?.name}</span>
          </div>
        )}
        {/* Submitted/Assigned timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="Clock" size={11} />
          <span>Submitted: {task?.submitted_at ? formatTs(task?.submitted_at) : task?.created_at ? formatTs(task?.created_at) : '—'}</span>
        </div>
      </div>

      {/* Lifecycle timestamps — compact, only if any exist */}
      {hasLifecycleData && (
        <div className="border-t border-border pt-2 mb-2 space-y-0.5">
          {task?.acknowledged_at && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <Icon name="Eye" size={10} />
              <span>Ack: {formatTs(task?.acknowledged_at)}</span>
            </div>
          )}
          {task?.in_progress_at && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Icon name="Zap" size={10} />
              <span>Started: {formatTs(task?.in_progress_at)}</span>
            </div>
          )}
          {task?.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <Icon name="CheckCircle2" size={10} />
              <span>Done: {formatTs(task?.completed_at)}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        {canChangeStatus && (
          <button
            onClick={() => onStatusChange?.(task?.id, STATUS_NEXT?.[task?.task_status])}
            className="flex-1 text-xs py-1.5 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-smooth"
          >
            {STATUS_NEXT_LABEL?.[task?.task_status]}
          </button>
        )}
        {canManage && (
          <button
            onClick={() => onEdit?.(task)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
            title="Edit task"
          >
            <Icon name="Pencil" size={13} />
          </button>
        )}
        {!canChangeStatus && !canManage && (
          <span className="flex-1 text-xs text-muted-foreground italic text-center py-1">View only</span>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
