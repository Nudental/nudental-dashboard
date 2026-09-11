import React from 'react';
import Icon from '../../../components/AppIcon';

const TaskFilters = ({ filters, onFilterChange, offices, staffList, canSelectOffice, taskCounts }) => {
  const quickFilters = [
    { id: 'all', label: 'All Tasks', count: taskCounts?.total || 0 },
    { id: 'my_tasks', label: 'My Tasks', count: taskCounts?.myTasks || 0, icon: 'User' },
    { id: 'overdue', label: 'Overdue', count: taskCounts?.overdue || 0, icon: 'AlertCircle', danger: true },
    { id: 'completed', label: 'Completed', count: taskCounts?.completed || 0, icon: 'CheckCircle2', success: true },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      {/* Quick filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {quickFilters?.map(f => (
          <button
            key={f?.id}
            onClick={() => onFilterChange?.('quickFilter', f?.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-smooth border ${
              filters?.quickFilter === f?.id
                ? f?.danger ? 'bg-destructive text-white border-destructive' : f?.success ?'bg-success text-white border-success' :'bg-primary text-primary-foreground border-primary' : f?.danger ?'border-destructive/30 text-destructive hover:bg-destructive/10' : f?.success ?'border-success/30 text-success hover:bg-success/10' :'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f?.icon && <Icon name={f?.icon} size={12} />}
            {f?.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
              filters?.quickFilter === f?.id ? 'bg-white/20' : 'bg-muted'
            }`}>{f?.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Priority filter */}
        <select
          value={filters?.priority || ''}
          onChange={(e) => onFilterChange?.('priority', e?.target?.value)}
          className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        {/* Office filter (admin/super_admin) */}
        {canSelectOffice && offices?.length > 1 && (
          <select
            value={filters?.officeId || ''}
            onChange={(e) => onFilterChange?.('officeId', e?.target?.value)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Offices</option>
            {offices?.map(o => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
        )}

        {/* Assignee filter (managers+) */}
        {canSelectOffice && staffList?.length > 0 && (
          <select
            value={filters?.assigneeId || ''}
            onChange={(e) => onFilterChange?.('assigneeId', e?.target?.value)}
            className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Assignees</option>
            {staffList?.map(s => (
              <option key={s?.id} value={s?.id}>{s?.full_name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default TaskFilters;
