import React, { useState, useEffect, useCallback } from 'react';
import ManagementTable from './components/ManagementTable';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

// ─── Audit Logging Helper ──────────────────────────────────────────────────
const IGNORED_DIFF_KEYS = ['updated_at', 'created_at', 'id'];

const buildServiceCategoryChangeSummary = (action, oldValues, newValues, recordName) => {
  if (action === 'CREATE') return `Created new service category${recordName ? `: ${recordName}` : ''}`;
  if (action === 'SOFT_DELETE') return `Deleted service category${recordName ? `: ${recordName}` : ''}`;
  if (action === 'TOGGLE_ACTIVE') {
    const isNowActive = newValues?.is_active;
    return `${isNowActive ? 'Activated' : 'Deactivated'} service category${recordName ? `: ${recordName}` : ''}`;
  }
  if (!oldValues || !newValues) return `UPDATE on service_categories${recordName ? ` (${recordName})` : ''}`;
  const changes = [];
  const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  for (const key of allKeys) {
    if (IGNORED_DIFF_KEYS?.includes(key)) continue;
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      const label = key?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase());
      if (key === 'is_active') {
        changes?.push(`Changed ${recordName || 'record'} status to ${newVal ? 'Active' : 'Inactive'}`);
      } else {
        changes?.push(`Changed ${label} from "${oldVal ?? '—'}" to "${newVal ?? '—'}"`);
      }
    }
  }
  return changes?.length > 0
    ? changes?.join('; ')
    : `Updated service category${recordName ? `: ${recordName}` : ''}`;
};

const logServiceCategoryAudit = async (action, recordId, oldValues, newValues, recordName) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    const changeSummary = buildServiceCategoryChangeSummary(action, oldValues, newValues, recordName);
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: 'service_categories',
      record_id: recordId ?? null,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.warn('Service category audit log error (non-blocking):', err);
  }
};

// ─── Service Categories Service ────────────────────────────────────────────
const serviceCategoriesService = {
  async getAll() {
    const { data, error } = await supabase
      ?.from('service_categories')
      ?.select('*')
      ?.order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      ?.from('service_categories')
      ?.select('*')
      ?.eq('id', id)
      ?.single();
    if (error) return null;
    return data;
  },

  async create(payload) {
    const { data, error } = await supabase
      ?.from('service_categories')
      ?.insert(payload)
      ?.select()
      ?.single();
    if (error) throw error;
    logServiceCategoryAudit('CREATE', data?.id, null, data, data?.name);
    return data;
  },

  async update(id, payload) {
    const oldRow = await this.getById(id);
    const { data, error } = await supabase
      ?.from('service_categories')
      ?.update(payload)
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    logServiceCategoryAudit('UPDATE', id, oldRow, data, data?.name || oldRow?.name);
    return data;
  },

  async toggleActive(id, isActive) {
    const oldRow = await this.getById(id);
    const { data, error } = await supabase
      ?.from('service_categories')
      ?.update({ is_active: isActive })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    logServiceCategoryAudit('TOGGLE_ACTIVE', id, oldRow, data, data?.name || oldRow?.name);
    return data;
  },

  async delete(id) {
    const oldRow = await this.getById(id);
    const { error } = await supabase
      ?.from('service_categories')
      ?.update({ is_active: false })
      ?.eq('id', id);
    if (error) throw error;
    const newValues = oldRow ? { ...oldRow, is_active: false } : { is_active: false };
    logServiceCategoryAudit('SOFT_DELETE', id, oldRow, newValues, oldRow?.name);
  },
};

// ─── Columns ───────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'name', label: 'Category Name', width: '30%' },
  {
    key: 'description',
    label: 'Description',
    width: '35%',
    render: (val) => val ? (
      <span className="text-sm text-muted-foreground truncate block max-w-xs">{val}</span>
    ) : (
      <span className="text-xs text-muted-foreground italic">No description</span>
    ),
  },
  {
    key: 'is_active',
    label: 'Status',
    width: '15%',
    render: (val) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        val ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
      }`}>
        {val ? 'Active' : 'Inactive'}
      </span>
    ),
  },
  {
    key: 'created_at',
    label: 'Created Date',
    width: '20%',
    render: (val) => val ? (
      <span className="text-sm text-muted-foreground">
        {new Date(val)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    ) : '—',
  },
];

// ─── Category Modal ────────────────────────────────────────────────────────
const CategoryModal = ({ isOpen, onClose, editRow, onSubmit, loading }) => {
  const [values, setValues] = useState({ name: '', description: '', is_active: true });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValues({
        name: editRow?.name || '',
        description: editRow?.description || '',
        is_active: editRow ? (editRow?.is_active ?? true) : true,
      });
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen, editRow]);

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const newErrors = {};
    if (!values?.name?.trim()) newErrors.name = 'Category name is required';
    else if (values?.name?.trim()?.length < 2) newErrors.name = 'Name must be at least 2 characters';
    else if (values?.name?.trim()?.length > 100) newErrors.name = 'Name must be at most 100 characters';
    if (Object.keys(newErrors)?.length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editRow ? 'Edit Service Category' : 'Add New Service Category'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <Input
            label="Category Name"
            required
            placeholder="e.g. Implants"
            value={values?.name || ''}
            onChange={(e) => handleChange('name', e?.target?.value)}
            error={errors?.name}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              value={values?.description || ''}
              onChange={(e) => handleChange('description', e?.target?.value)}
              placeholder="Brief description of this service category..."
              rows={3}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Active Status</p>
              <p className="text-xs text-muted-foreground">Active categories appear in service dropdowns</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('is_active', !values?.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                values?.is_active ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  values?.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="default" loading={loading}>
              {editRow ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const ServiceCategoriesManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await serviceCategoriesService?.getAll();
      setItems(data);
    } catch (err) {
      setError(err?.message || 'Failed to load service categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);

  const handleToggleActive = async (id, isActive) => {
    setSaving(true);
    try {
      await serviceCategoriesService?.toggleActive(id, isActive);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editRow) {
        await serviceCategoriesService?.update(editRow?.id, values);
      } else {
        await serviceCategoriesService?.create(values);
      }
      setModalOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    try {
      await serviceCategoriesService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate service category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <ManagementTable
        title="Service Categories"
        columns={COLUMNS}
        data={items}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        showActiveToggle={true}
        extraRowActions={[]}
      />
      <CategoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editRow={editRow}
        onSubmit={handleSubmit}
        loading={saving}
      />
      <ConfirmDeleteModal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleConfirmDelete}
        loading={saving}
        itemName={deleteRow?.name}
      />
    </div>
  );
};

export default ServiceCategoriesManagement;
