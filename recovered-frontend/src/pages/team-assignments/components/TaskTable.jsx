import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { resolveStatusConfig } from '../../../services/actionItemsService';

const PRIORITY_CONFIG = {
  high:   { label: 'High',   cls: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Medium', cls: 'bg-warning/10 text-warning' },
  low:    { label: 'Low',    cls: 'bg-success/10 text-success' },
};

// Status options for the dropdown — includes all lifecycle stages
// acknowledged status now persists correctly (V538 migration confirmed)
const STATUS_OPTIONS = [
  { value: 'pending',      label: 'Submitted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'completed',    label: 'Completed' },
];

const TaskTable = ({ tasks, onStatusChange, onEdit, canManage, currentUserId }) => {
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const today = new Date()?.toISOString()?.split('T')?.[0];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = [...(tasks || [])]?.sort((a, b) => {
    let aVal = a?.[sortField] || '';
    let bVal = b?.[sortField] || '';
    if (sortField === 'assigned_owner') {
      aVal = a?.assigned_owner?.full_name || '';
      bVal = b?.assigned_owner?.full_name || '';
    }
    if (sortField === 'office') {
      aVal = a?.office?.name || '';
      bVal = b?.office?.name || '';
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }) => (
    <Icon
      name={sortField === field ? (sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'}
      size={13}
      className="ml-1 text-muted-foreground"
    />
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  };

  const formatTs = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return '—'; }
  };

  if (!sorted?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="ClipboardList" size={40} className="text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No tasks found matching your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('action_required')} className="flex items-center hover:text-foreground">
                Task <SortIcon field="action_required" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('office')} className="flex items-center hover:text-foreground">
                Office <SortIcon field="office" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('assigned_owner')} className="flex items-center hover:text-foreground">
                Assigned To <SortIcon field="assigned_owner" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              Priority
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('task_status')} className="flex items-center hover:text-foreground">
                Status <SortIcon field="task_status" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('created_at')} className="flex items-center hover:text-foreground">
                Submitted At <SortIcon field="created_at" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              <button onClick={() => handleSort('due_date')} className="flex items-center hover:text-foreground">
                Due Date <SortIcon field="due_date" />
              </button>
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              Acknowledged At
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              In Progress At
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              Completed At
            </th>
            <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
              Created By
            </th>
            {canManage && (
              <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted?.map(task => {
            const isOverdue = task?.due_date && task?.due_date < today && task?.task_status !== 'completed';
            const priority = PRIORITY_CONFIG?.[task?.priority_level] || PRIORITY_CONFIG?.medium;
            const statusCfg = resolveStatusConfig(task?.task_status);
            const isAssignedToMe = task?.assigned_owner_id === currentUserId;
            const canChangeStatus = canManage || isAssignedToMe;

            return (
              <tr key={task?.id} className={`hover:bg-muted/30 transition-smooth ${isOverdue ? 'bg-destructive/5' : ''}`}>
                {/* Task */}
                <td className="px-3 py-3 max-w-[200px]">
                  <p className="text-sm text-foreground font-medium line-clamp-2">{task?.action_required}</p>
                  {task?.source_text && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1 mt-0.5">
                      <Icon name="Link" size={9} className="inline mr-1" />
                      {task?.source_text}
                    </p>
                  )}
                </td>
                {/* Office */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-sm text-foreground">{task?.office?.name || '—'}</span>
                </td>
                {/* Assigned To */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-sm text-foreground">
                    {task?.assigned_owner?.full_name || <span className="text-muted-foreground italic">Unassigned</span>}
                  </span>
                </td>
                {/* Priority */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${priority?.cls}`}>
                    {priority?.label || '—'}
                  </span>
                </td>
                {/* Status */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {canChangeStatus ? (
                    <select
                      value={task?.task_status}
                      onChange={(e) => onStatusChange?.(task?.id, e?.target?.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary ${statusCfg?.cls}`}
                    >
                      {STATUS_OPTIONS?.map(opt => (
                        <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg?.cls}`}>
                      <Icon name={statusCfg?.icon} size={10} />
                      {statusCfg?.label}
                    </span>
                  )}
                </td>
                {/* Submitted At */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">
                    {task?.submitted_at ? formatTs(task?.submitted_at) : formatTs(task?.created_at)}
                  </span>
                </td>
                {/* Due Date */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-sm ${isOverdue ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                    {formatDate(task?.due_date)}
                    {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
                  </span>
                </td>
                {/* Acknowledged At */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">{formatTs(task?.acknowledged_at)}</span>
                </td>
                {/* In Progress At */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">{formatTs(task?.in_progress_at)}</span>
                </td>
                {/* Completed At */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">{formatTs(task?.completed_at)}</span>
                </td>
                {/* Created By */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">
                    {task?.created_by_user?.full_name || '—'}
                  </span>
                </td>
                {/* Actions */}
                {canManage && (
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onEdit?.(task)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                      title="Edit task"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTable;
