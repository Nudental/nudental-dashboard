import React from 'react';
import Icon from '../../../components/AppIcon';
import TaskCard from './TaskCard';


// Kanban columns aligned to lifecycle stages
// pending/submitted → Submitted column (display resolver handles both)
const COLUMNS = [
  {
    id: 'pending',
    dbValues: ['pending', 'submitted'],
    label: 'Submitted',
    icon: 'Clock',
    color: 'text-muted-foreground',
    bg: 'bg-muted/30 border-border',
  },
  {
    id: 'acknowledged',
    dbValues: ['acknowledged'],
    label: 'Acknowledged',
    icon: 'Eye',
    color: 'text-blue-600',
    bg: 'bg-blue-50/50 border-blue-200',
  },
  {
    id: 'in_progress',
    dbValues: ['in_progress'],
    label: 'In Progress',
    icon: 'Zap',
    color: 'text-primary',
    bg: 'bg-primary/5 border-primary/20',
  },
  {
    id: 'completed',
    dbValues: ['completed'],
    label: 'Completed',
    icon: 'CheckCircle2',
    color: 'text-success',
    bg: 'bg-success/5 border-success/20',
  },
];

const KanbanBoard = ({ tasks, onStatusChange, onEdit, canManage, currentUserId }) => {
  const getColumnTasks = (dbValues) =>
    tasks?.filter(t => dbValues?.includes(t?.task_status)) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS?.map(col => {
        const colTasks = getColumnTasks(col?.dbValues);
        return (
          <div key={col?.id} className={`border rounded-xl p-3 ${col?.bg}`}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Icon name={col?.icon} size={15} className={col?.color} />
                <span className={`text-sm font-semibold ${col?.color}`}>{col?.label}</span>
              </div>
              <span className="text-xs font-bold bg-card border border-border rounded-full px-2 py-0.5 text-foreground">
                {colTasks?.length}
              </span>
            </div>

            {/* Task Cards */}
            <div className="space-y-2 min-h-[120px]">
              {colTasks?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Icon name="Inbox" size={24} className="text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No tasks</p>
                </div>
              ) : (
                colTasks?.map(task => (
                  <TaskCard
                    key={task?.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                    canManage={canManage}
                    currentUserId={currentUserId}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
