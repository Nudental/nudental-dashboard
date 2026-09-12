import React, { useState, useEffect, useCallback, useRef } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAccessibleOffices } from '../../services/dashboardService';
import { actionItemsService, canManageTasks, canSelectOffice as canSelectOfficeRole, canCreateTasks } from '../../services/actionItemsService';
import KanbanBoard from './components/KanbanBoard';
import TaskTable from './components/TaskTable';
import TaskFilters from './components/TaskFilters';
import EditTaskModal from './components/EditTaskModal';
import NewTaskForm from './components/NewTaskForm';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useHomeNavigation from '../../hooks/useHomeNavigation';
import { useRbacGuard, AccessDenied } from '../../hooks/useRbacGuard';

const TeamAssignmentsContent = () => {
  const taskRequestGeneration = useRef(0);
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const goHome = useHomeNavigation();
  const [viewMode, setViewMode] = useState('kanban');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [offices, setOffices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCounts, setTaskCounts] = useState({ total: 0, submitted: 0, inProgress: 0, completed: 0, overdue: 0, myTasks: 0 });

  const [filters, setFilters] = useState({
    quickFilter: 'all',
    priority: '',
    officeId: '',
    assigneeId: '',
  });

  // ─── RBAC role resolution ─────────────────────────────────────────────────
  // super_admin / admin: full access, all offices
  // regional_manager / regional_clinical_manager / clinical_manager: create/edit/status/select office
  // office_manager: create/edit/status for own office only
  // staff / non-manager: view assigned tasks, update status on own tasks only
  const userRole = userProfile?.role;
  const isAdmin = ['super_admin', 'admin']?.includes(userRole);
  const isRegional = ['regional_manager', 'regional_clinical_manager', 'clinical_manager']?.includes(userRole);
  const isOfficeManager = userRole === 'office_manager';
  const isManager = isOfficeManager;
  const canManage = canManageTasks(userRole);
  const canCreate = canCreateTasks(userRole);
  const officeSelectAllowed = canSelectOfficeRole(userRole);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Team Assignments' },
  ];

  // Load offices and staff
  useEffect(() => {
    const loadOffices = async () => {
      if (!userProfile) return;
      try {
        const data = await getAccessibleOffices(userProfile);
        setOffices(data || []);
        if (data?.length > 0) {
          // Admin/regional: load all staff; office_manager: load own office staff
          const officeId = (isAdmin || isRegional) ? null : userProfile?.office_id;
          const staff = await actionItemsService?.getOfficeStaff(officeId);
          setStaffList(staff || []);
        }
      } catch (err) {
        console.error('Failed to load offices:', err);
      }
    };
    loadOffices();
  }, [userProfile, isAdmin, isRegional]);

  // Load tasks with RBAC-aware scoping
  const loadTasks = useCallback(async () => {
    const generation = ++taskRequestGeneration.current;
    const isCurrent = () => generation === taskRequestGeneration.current;
    if (!userProfile || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const today = new Date()?.toISOString()?.split('T')?.[0];
      const params = {};

      // Query-level scoping:
      // staff → assigned_owner_id = current user
      // office_manager → office_id = userProfile.office_id
      // regional/admin → broader visibility (officeId filter optional)
      if (!canManage) {
        params.assignedOwnerId = user?.id;
      } else if (isOfficeManager) {
        params.officeId = userProfile?.office_id;
      } else if (filters?.officeId) {
        params.officeId = filters?.officeId;
      }

      if (filters?.assigneeId) params.assignedOwnerId = filters?.assigneeId;
      if (filters?.priority) params.priority = filters?.priority;

      if (filters?.quickFilter === 'my_tasks') {
        params.myTasksOnly = true;
        params.userId = user?.id;
      } else if (filters?.quickFilter === 'overdue') {
        params.overdue = true;
      } else if (filters?.quickFilter === 'completed') {
        params.status = 'completed';
      }

      const data = await actionItemsService?.getActionItems(params);
      if (!isCurrent()) return;
      setTasks(data || []);

      const allForCounts = await actionItemsService?.getActionItems(
        isAdmin || isRegional
          ? (filters?.officeId ? { officeId: filters?.officeId } : {})
          : isOfficeManager
          ? { officeId: userProfile?.office_id }
          : { assignedOwnerId: user?.id }
      );
      if (!isCurrent()) return;
      const myCount = allForCounts?.filter(t => t?.assigned_owner_id === user?.id)?.length || 0;
      const overdueCount = allForCounts?.filter(t => t?.task_status !== 'completed' && t?.due_date && t?.due_date < today)?.length || 0;
      const completedCount = allForCounts?.filter(t => t?.task_status === 'completed')?.length || 0;
      const inProgressCount = allForCounts?.filter(t => t?.task_status === 'in_progress')?.length || 0;
      setTaskCounts({
        total: allForCounts?.length || 0,
        submitted: allForCounts?.filter(t => t?.task_status === 'pending' || t?.task_status === 'submitted')?.length || 0,
        inProgress: inProgressCount,
        completed: completedCount,
        overdue: overdueCount,
        myTasks: myCount,
      });
    } catch (err) {
      if (isCurrent()) setError(err?.message || 'Failed to load tasks');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [userProfile, user?.id, filters, isAdmin, isRegional, isOfficeManager, canManage]);

  useEffect(() => {
    loadTasks();
    return () => { taskRequestGeneration.current += 1; };
  }, [loadTasks]);

  // Real-time subscription for action_items
  useRealtimeSubscription(
    [{ table: 'action_items', events: ['INSERT', 'UPDATE', 'DELETE'] }],
    useCallback(() => { loadTasks(); }, [loadTasks]),
    !!userProfile
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleStatusChange = async (taskId, newStatus) => {
    // RBAC: staff can only change status on their own assigned tasks
    const task = tasks?.find(t => t?.id === taskId);
    if (!canManage && task?.assigned_owner_id !== user?.id) {
      setError('You can only update status on tasks assigned to you.');
      return;
    }
    setSaving(true);
    try {
      const { data, error: err } = await actionItemsService?.updateActionItem(
        taskId,
        { task_status: newStatus },
        { actorId: user?.id, existingTask: task }
      );
      if (err) throw err;
      setTasks(prev => prev?.map(t => t?.id === taskId ? { ...t, ...data } : t));
    } catch (err) {
      setError('Failed to update task status');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (taskId, updates) => {
    setSaving(true);
    try {
      const existingTask = tasks?.find(t => t?.id === taskId);
      const { data, error: err } = await actionItemsService?.updateActionItem(
        taskId,
        updates,
        { actorId: user?.id, existingTask }
      );
      if (err) throw err;
      setTasks(prev => prev?.map(t => t?.id === taskId ? { ...t, ...data } : t));
      setEditingTask(null);
    } catch (err) {
      setError('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async (formData) => {
    setCreatingTask(true);
    try {
      // Resolve office_id: prefer filter selection, then user profile, then first available office
      const officeId =
        filters?.officeId ||
        userProfile?.office_id ||
        (offices?.length > 0 ? offices?.[0]?.id : null);

      if (!officeId) {
        const msg = 'Cannot create task: no office_id available. Please select an office in the filter or ensure your profile has an office assigned.';
        console.error('[NewTaskForm] Insert blocked —', msg);
        setError(msg);
        return false;
      }

      if (!user?.id) {
        const msg = 'Cannot create task: user session not found. Please refresh and try again.';
        console.error('[NewTaskForm] Insert blocked —', msg);
        setError(msg);
        return false;
      }

      const { data, error: err } = await actionItemsService?.createActionItem({
        officeId,
        actionRequired: formData?.action_required,
        assignedOwnerId: formData?.assigned_owner_id || null,
        dueDate: formData?.due_date || null,
        priorityLevel: formData?.priority_level || 'medium',
        notes: formData?.notes || null,
        createdBy: user?.id,
      });

      if (err) {
        console.error('[NewTaskForm] Supabase insert error:', err);
        const errorMsg = `Failed to create task: ${err?.message || 'Unknown error'}${err?.hint ? ` (Hint: ${err?.hint})` : ''}${err?.code ? ` [Code: ${err?.code}]` : ''}`;
        setError(errorMsg);
        throw err;
      }

      await loadTasks();
      setShowNewTaskForm(false);
      return true;
    } catch (err) {
      if (!err?.message?.includes('Failed to create task')) {
        const errorMsg = `Failed to create task: ${err?.message || 'Unknown error'}`;
        console.error('[NewTaskForm] Unexpected error:', err);
        setError(errorMsg);
      }
      return false;
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">

          {/* Source Clarity Banner */}
          <div className="flex items-start gap-2 p-3 mb-5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <Icon name="Info" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Tasks are internal workflow assignments</strong> stored in Supabase. They do not update Dentrix/FastAPI production, collections, RCM, payroll, or provider actuals.
            </span>
          </div>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <button
                onClick={goHome}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <Icon name="ChevronLeft" size={16} />
                Back to Home
              </button>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">Team Assignments</h1>
              <p className="text-sm text-muted-foreground">Manage and track action items from morning huddles</p>
            </div>
            <div className="flex items-center gap-2">
              {/* New Task Button — visible to all manager/admin/regional roles */}
              {canCreate && !showNewTaskForm && (
                <button
                  onClick={() => setShowNewTaskForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Icon name="Plus" size={16} />
                  New Task
                </button>
              )}
              {/* View Toggle */}
              <div className="flex items-center bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-smooth ${
                    viewMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name="Columns3" size={13} />
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-smooth ${
                    viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name="Table" size={13} />
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* New Task Form (manager/admin/regional roles only) */}
          {canCreate && showNewTaskForm && (
            <NewTaskForm
              staffList={staffList}
              onSubmit={handleCreateTask}
              onCancel={() => setShowNewTaskForm(false)}
              loading={creatingTask}
            />
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Tasks',  value: taskCounts?.total,      icon: 'ClipboardList', color: 'text-foreground' },
              { label: 'In Progress',  value: taskCounts?.inProgress,  icon: 'Zap',           color: 'text-primary' },
              { label: 'Overdue',      value: taskCounts?.overdue,     icon: 'AlertCircle',   color: 'text-destructive' },
              { label: 'Completed',    value: taskCounts?.completed,   icon: 'CheckCircle2',  color: 'text-success' },
            ]?.map((stat, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon name={stat?.icon} size={16} className={stat?.color} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${stat?.color}`}>{stat?.value}</p>
                  <p className="text-xs text-muted-foreground">{stat?.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <TaskFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              offices={offices}
              staffList={staffList}
              canSelectOffice={officeSelectAllowed || isOfficeManager}
              taskCounts={taskCounts}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <Icon name="AlertCircle" size={15} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto"><Icon name="X" size={14} /></button>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="Loader2" size={28} className="animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading tasks...</span>
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              tasks={tasks}
              onStatusChange={handleStatusChange}
              onEdit={setEditingTask}
              canManage={canManage}
              currentUserId={user?.id}
            />
          ) : (
            <TaskTable
              tasks={tasks}
              onStatusChange={handleStatusChange}
              onEdit={setEditingTask}
              canManage={canManage}
              currentUserId={user?.id}
            />
          )}

          {/* RBAC info banner for staff */}
          {!canManage && (
            <div className="mt-6 flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground">
              <Icon name="Info" size={14} />
              You are viewing tasks assigned to you. Contact your office manager to create or reassign tasks.
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          staffList={staffList}
          onSave={handleEditSave}
          onClose={() => setEditingTask(null)}
          loading={saving}
          canManage={canManage}
        />
      )}
    </div>
  );
};

const TeamAssignments = () => {
  const { canAccess, loading: rbacLoading } = useRbacGuard();
  if (rbacLoading) return null;
  if (!canAccess('workflow.tasks.view')) {
    return <AccessDenied title="Team Assignments" message="You don't have permission to access Team Assignments. Contact your administrator." />;
  }
  return <TeamAssignmentsContent />;
};

export default TeamAssignments;
