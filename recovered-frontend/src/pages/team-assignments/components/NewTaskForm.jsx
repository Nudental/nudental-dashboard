import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-success' },
  { value: 'medium', label: 'Medium', color: 'text-warning' },
  { value: 'high', label: 'High', color: 'text-destructive' },
];

const NewTaskForm = ({ staffList = [], onSubmit, onCancel, loading = false }) => {
  const [formData, setFormData] = useState({
    action_required: '',
    assigned_owner_id: '',
    due_date: '',
    priority_level: 'medium',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData?.action_required?.trim()) errs.action_required = 'Task description is required';
    if (!formData?.due_date) errs.due_date = 'Due date is required';
    return errs;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs)?.length > 0) {
      setErrors(errs);
      return;
    }
    const success = await onSubmit(formData);
    if (success) {
      setFormData({ action_required: '', assigned_owner_id: '', due_date: '', priority_level: 'medium', notes: '' });
      setErrors({});
    }
  };

  const handleCancel = () => {
    setFormData({ action_required: '', assigned_owner_id: '', due_date: '', priority_level: 'medium', notes: '' });
    setErrors({});
    onCancel?.();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Icon name="ClipboardPlus" size={17} className="text-primary" />
          Create New Task
        </h3>
        <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="X" size={18} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Task Description <span className="text-destructive">*</span>
          </label>
          <textarea
            value={formData?.action_required}
            onChange={e => handleChange('action_required', e?.target?.value)}
            placeholder="Describe the action required..."
            rows={3}
            className={`w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
              errors?.action_required ? 'border-destructive' : 'border-border'
            }`}
          />
          {errors?.action_required && (
            <p className="text-xs text-destructive mt-1">{errors?.action_required}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assigned Team Member */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Assign To
            </label>
            <select
              value={formData?.assigned_owner_id}
              onChange={e => handleChange('assigned_owner_id', e?.target?.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            >
              <option value="">Unassigned</option>
              {staffList?.map(member => (
                <option key={member?.id} value={member?.id}>
                  {member?.full_name}{member?.job_title ? ` — ${member?.job_title}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Due Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={formData?.due_date}
              onChange={e => handleChange('due_date', e?.target?.value)}
              className={`w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                errors?.due_date ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors?.due_date && (
              <p className="text-xs text-destructive mt-1">{errors?.due_date}</p>
            )}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Priority</label>
          <div className="flex items-center gap-2">
            {PRIORITY_OPTIONS?.map(opt => (
              <button
                key={opt?.value}
                type="button"
                onClick={() => handleChange('priority_level', opt?.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  formData?.priority_level === opt?.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                <span className={formData?.priority_level === opt?.value ? 'text-primary-foreground' : opt?.color}>●</span>
                {opt?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Notes <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </label>
          <textarea
            value={formData?.notes}
            onChange={e => handleChange('notes', e?.target?.value)}
            placeholder="Any additional context or instructions..."
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewTaskForm;
