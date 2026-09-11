import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { actionItemsService } from '../../../services/actionItemsService';

const ConvertToTaskModal = ({ item, huddleId, officeId, officeName, onClose, onSuccess, createdBy }) => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [form, setForm] = useState({
    action_required: item?.notes || item?.item_text || '',
    assigned_owner_id: '',
    due_date: '',
    priority_level: 'medium',
  });

  useEffect(() => {
    const loadStaff = async () => {
      setStaffLoading(true);
      try {
        const data = await actionItemsService?.getOfficeStaff(officeId);
        setStaffList(data || []);
      } catch (err) {
        console.error('Failed to load staff:', err);
      } finally {
        setStaffLoading(false);
      }
    };
    if (officeId) loadStaff();
  }, [officeId]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form?.action_required?.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await actionItemsService?.createActionItem({
        checklistItemId: item?.id,
        huddleId,
        officeId,
        actionRequired: form?.action_required,
        sourceText: `${item?.section === 'front_desk' ? 'Front Desk' : 'Back Office'} Checklist #${item?.item_number}`,
        assignedOwnerId: form?.assigned_owner_id || null,
        dueDate: form?.due_date || null,
        priorityLevel: form?.priority_level,
        createdBy,
      });

      if (error) throw error;

      // Send email notification if owner assigned
      if (form?.assigned_owner_id && data) {
        const assignee = staffList?.find(s => s?.id === form?.assigned_owner_id);
        if (assignee?.email) {
          await actionItemsService?.sendTaskAssignmentEmail({
            assigneeEmail: assignee?.email,
            assigneeName: assignee?.full_name,
            taskTitle: form?.action_required,
            dueDate: form?.due_date,
            priority: form?.priority_level,
            officeName,
          });
        }
      }

      onSuccess?.(data);
      onClose?.();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Icon name="ClipboardList" size={16} color="var(--color-primary)" />
            Convert to Task
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-smooth">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Source reference */}
        <div className="px-5 pt-4">
          <div className="p-3 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Source:</span> {item?.section === 'front_desk' ? 'Front Desk' : 'Back Office'} Checklist — Item #{item?.item_number}
            <p className="mt-1 italic line-clamp-2">{item?.item_text}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Action Required *</label>
            <textarea
              value={form?.action_required}
              onChange={(e) => handleChange('action_required', e?.target?.value)}
              rows={3}
              required
              placeholder="Describe the action needed..."
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select
                value={form?.priority_level}
                onChange={(e) => handleChange('priority_level', e?.target?.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
              <input
                type="date"
                value={form?.due_date}
                onChange={(e) => handleChange('due_date', e?.target?.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assign To</label>
            {staffLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Icon name="Loader2" size={12} className="animate-spin" /> Loading staff...
              </div>
            ) : (
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
            )}
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
              disabled={loading || !form?.action_required?.trim()}
              className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-smooth disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Icon name="Loader2" size={14} className="animate-spin" /> Creating...</> : <><Icon name="Plus" size={14} /> Create Task</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToTaskModal;
