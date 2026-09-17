import { supabase } from '../lib/supabase';
import { notificationsService } from './notificationsService';

// ─── Role helpers ─────────────────────────────────────────────────────────────
// Roles that can manage tasks (create/edit/assign/select office)
export const TASK_MANAGER_ROLES = ['super_admin', 'admin', 'office_manager', 'regional_manager', 'regional_clinical_manager', 'clinical_manager'];
// Roles that can select any office
export const TASK_OFFICE_SELECT_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager', 'clinical_manager'];
// Roles that can create/edit tasks
export const TASK_CREATE_ROLES = ['super_admin', 'admin', 'office_manager', 'regional_manager', 'regional_clinical_manager', 'clinical_manager'];

export const canManageTasks = (role) => TASK_MANAGER_ROLES?.includes(role);
export const canSelectOffice = (role) => TASK_OFFICE_SELECT_ROLES?.includes(role);
export const canCreateTasks = (role) => TASK_CREATE_ROLES?.includes(role);

// ─── Status display resolver ──────────────────────────────────────────────────
// Maps DB status values (old and new) to display labels
// pending → Submitted (legacy mapping — do not mutate DB records)
export const TASK_STATUS_DISPLAY = {
  pending: 'Submitted',
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const resolveStatusDisplay = (status) => TASK_STATUS_DISPLAY?.[status] || status || '—';

// Status config for UI styling
export const TASK_STATUS_CONFIG = {
  pending:      { label: 'Submitted',    cls: 'bg-muted text-muted-foreground',    icon: 'Clock',        color: 'text-muted-foreground' },
  submitted:    { label: 'Submitted',    cls: 'bg-muted text-muted-foreground',    icon: 'Clock',        color: 'text-muted-foreground' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-blue-50 text-blue-700',          icon: 'Eye',          color: 'text-blue-600' },
  in_progress:  { label: 'In Progress',  cls: 'bg-primary/10 text-primary',        icon: 'Zap',          color: 'text-primary' },
  completed:    { label: 'Completed',    cls: 'bg-success/10 text-success',        icon: 'CheckCircle2', color: 'text-success' },
};

export const resolveStatusConfig = (status) => TASK_STATUS_CONFIG?.[status] || TASK_STATUS_CONFIG?.pending;

// ─── Lifecycle timestamp fields ───────────────────────────────────────────────
// Migration confirmed complete (V538). All lifecycle columns now exist in action_items:
// acknowledged_at, acknowledged_by, in_progress_at, in_progress_by,
// completed_at, completed_by, submitted_at
// task_status CHECK now allows: pending, submitted, acknowledged, in_progress, completed

// Build lifecycle timestamp payload for a status transition
// Returns only fields that should be set for the given transition
// Does NOT overwrite existing timestamps (no-overwrite rule)
const buildLifecyclePayload = (newStatus, actorId, existingTask) => {
  const now = new Date()?.toISOString();
  const payload = {};

  if (newStatus === 'acknowledged') {
    // Only set acknowledged_at if not already set (no overwrite)
    if (!existingTask?.acknowledged_at) {
      payload.acknowledged_at = now;
      payload.acknowledged_by = actorId || null;
    }
  }
  if (newStatus === 'in_progress') {
    if (!existingTask?.in_progress_at) {
      payload.in_progress_at = now;
      payload.in_progress_by = actorId || null;
    }
  }
  if (newStatus === 'completed') {
    if (!existingTask?.completed_at) {
      payload.completed_at = now;
      payload.completed_by = actorId || null;
    }
  }
  return payload;
};

// ─── Non-blocking audit log helper ───────────────────────────────────────────
// Uses existing audit_logs table (fn_audit_trigger already covers DB-level changes).
// This adds application-level semantic audit entries for task workflow actions.
const logTaskAudit = async ({ actorId, action, taskId, officeId, assignedOwnerId, previousStatus, newStatus, changedFields }) => {
  try {
    await supabase?.from('audit_logs')?.insert({
      user_id: actorId || null,
      action,
      table_name: 'action_items',
      record_id: taskId || null,
      old_values: previousStatus ? { task_status: previousStatus } : null,
      new_values: newStatus ? { task_status: newStatus, office_id: officeId, assigned_owner_id: assignedOwnerId } : null,
      changed_fields: changedFields || null,
      created_at: new Date()?.toISOString(),
    });
  } catch (auditErr) {
    // Audit failure must never block the task action
    console.warn('[actionItemsService] Audit log insert failed (non-blocking):', auditErr?.message);
  }
};

export const actionItemsService = {
  // Fetch action items with RBAC filtering
  async getActionItems({ officeId, assignedOwnerId, status, priority, overdue, myTasksOnly, userId } = {}) {
    try {
      let query = supabase
        ?.from('action_items')
        ?.select(`
          *,
          assigned_owner:user_profiles!action_items_assigned_owner_id_fkey(id, full_name, email, job_title),
          created_by_user:user_profiles!action_items_created_by_fkey(id, full_name),
          office:offices(id, name),
          checklist_item:huddle_checklist_items(id, item_text, section)
        `)
        ?.order('created_at', { ascending: false });

      if (officeId) query = query?.eq('office_id', officeId);
      if (assignedOwnerId) query = query?.eq('assigned_owner_id', assignedOwnerId);
      if (status) query = query?.eq('task_status', status);
      if (priority) query = query?.eq('priority_level', priority);
      if (myTasksOnly && userId) query = query?.eq('assigned_owner_id', userId);
      if (overdue) {
        const today = new Date()?.toISOString()?.split('T')?.[0];
        query = query?.lt('due_date', today)?.neq('task_status', 'completed');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getActionItems error:', err);
      return [];
    }
  },

  // Create a new action item
  async createActionItem({ checklistItemId, huddleId, officeId, actionRequired, sourceText, assignedOwnerId, dueDate, priorityLevel = 'medium', notes, createdBy }) {
    try {
      const now = new Date()?.toISOString();
      const { data, error } = await supabase
        ?.from('action_items')
        ?.insert({
          checklist_item_id: checklistItemId || null,
          huddle_id: huddleId || null,
          office_id: officeId,
          action_required: actionRequired,
          source_text: sourceText || '',
          assigned_owner_id: assignedOwnerId || null,
          due_date: dueDate || null,
          priority_level: priorityLevel,
          task_status: 'submitted',
          submitted_at: now,
          created_by: createdBy,
          notes: notes || null,
        })
        ?.select(`
          *,
          assigned_owner:user_profiles!action_items_assigned_owner_id_fkey(id, full_name, email),
          office:offices(id, name)
        `)
        ?.single();

      if (error) throw error;

      // Non-blocking audit log
      await logTaskAudit({
        actorId: createdBy,
        action: 'task_created',
        taskId: data?.id,
        officeId,
        assignedOwnerId,
        newStatus: 'submitted',
        changedFields: ['action_required', 'assigned_owner_id', 'due_date', 'priority_level', 'office_id', 'submitted_at'],
      });

      // Trigger in-app notification for assigned owner
      if (assignedOwnerId && data) {
        const dueDateStr = dueDate ? new Date(dueDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date';
        await notificationsService?.createNotification({
          userId: assignedOwnerId,
          officeId,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `New task assigned: "${actionRequired?.substring(0, 80)}${actionRequired?.length > 80 ? '...' : ''}" — Due ${dueDateStr}`,
          metadata: { action_item_id: data?.id, due_date: dueDate, priority: priorityLevel },
        });
      }

      return { data, error: null };
    } catch (err) {
      console.error('createActionItem error:', err);
      return { data: null, error: err };
    }
  },

  // Update action item status or fields
  // actorId and existingTask are optional — used for lifecycle timestamp writes
  async updateActionItem(itemId, updates, { actorId, existingTask } = {}) {
    try {
      const previousStatus = existingTask?.task_status;
      const newStatus = updates?.task_status;

      // Build lifecycle payload when status is changing and actor is known
      // Migration V538 confirmed: acknowledged_at/by, in_progress_at/by, completed_at/by all exist
      // Existing timestamps are preserved (no-overwrite rule enforced inside buildLifecyclePayload)
      const lifecyclePayload = (newStatus && actorId && existingTask)
        ? buildLifecyclePayload(newStatus, actorId, existingTask)
        : {};

      let query = supabase
        ?.from('action_items')
        ?.update({ ...updates, ...lifecyclePayload, updated_at: new Date()?.toISOString() })
        ?.eq('id', itemId);
      // A stale view must not repeat or overwrite a transition completed elsewhere.
      if (previousStatus) query = query?.eq('task_status', previousStatus);
      const { data, error } = await query
        ?.select(`
          *,
          assigned_owner:user_profiles!action_items_assigned_owner_id_fkey(id, full_name, email),
          office:offices(id, name)
        `)
        ?.single();
      if (error) throw error;

      // Determine audit action type
      let auditAction = 'task_updated';
      if (newStatus && newStatus !== previousStatus) {
        if (newStatus === 'acknowledged') auditAction = 'task_acknowledged';
        else if (newStatus === 'in_progress') auditAction = 'task_started';
        else if (newStatus === 'completed') auditAction = 'task_completed';
        else auditAction = 'task_status_changed';
      }
      // Check for reassignment
      if (updates?.assigned_owner_id && existingTask?.assigned_owner_id !== updates?.assigned_owner_id) {
        auditAction = 'task_reassigned';
      }

      // Non-blocking audit log
      await logTaskAudit({
        actorId,
        action: auditAction,
        taskId: itemId,
        officeId: data?.office_id,
        assignedOwnerId: data?.assigned_owner_id,
        previousStatus,
        newStatus,
        changedFields: Object.keys(updates),
      });

      return { data, error: null };
    } catch (err) {
      console.error('updateActionItem error:', err);
      return { data: null, error: err };
    }
  },

  // Delete action item — hard delete, NOT exposed in UI
  // Kept for service completeness only. Do not add UI for this.
  async deleteActionItem(itemId) {
    try {
      const { error } = await supabase
        ?.from('action_items')
        ?.delete()
        ?.eq('id', itemId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('deleteActionItem error:', err);
      return { success: false, error: err };
    }
  },

  // Get task counts for dashboard
  async getTaskCounts(officeId) {
    try {
      const today = new Date()?.toISOString()?.split('T')?.[0];
      let query = supabase?.from('action_items')?.select('task_status, due_date, priority_level');
      if (officeId) query = query?.eq('office_id', officeId);
      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      return {
        total: items?.length,
        pending: items?.filter(i => i?.task_status === 'pending' || i?.task_status === 'submitted')?.length,
        inProgress: items?.filter(i => i?.task_status === 'in_progress')?.length,
        completed: items?.filter(i => i?.task_status === 'completed')?.length,
        overdue: items?.filter(i => i?.task_status !== 'completed' && i?.due_date && i?.due_date < today)?.length,
        highPriority: items?.filter(i => i?.priority_level === 'high' && i?.task_status !== 'completed')?.length,
      };
    } catch (err) {
      console.error('getTaskCounts error:', err);
      return { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, highPriority: 0 };
    }
  },

  // Get staff list for office (for assignment dropdown)
  async getOfficeStaff(officeId) {
    try {
      let query = supabase
        ?.from('user_profiles')
        ?.select('id, full_name, email, job_title, role')
        ?.eq('is_active', true)
        ?.order('full_name');

      if (officeId) query = query?.eq('office_id', officeId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getOfficeStaff error:', err);
      return [];
    }
  },

  // Send task assignment email via edge function
  async sendTaskAssignmentEmail({ assigneeEmail, assigneeName, taskTitle, dueDate, priority, officeName, appUrl }) {
    try {
      const { data, error } = await supabase?.functions?.invoke('send-task-email', {
        body: {
          assignee_email: assigneeEmail,
          assignee_name: assigneeName,
          task_title: taskTitle,
          due_date: dueDate,
          priority,
          office_name: officeName,
          app_url: appUrl || 'https://nudentalr1699.builtwithrocket.new',
        },
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('sendTaskAssignmentEmail error:', err);
      return { success: false, error: err };
    }
  },
};

export default actionItemsService;
