import React, { useState, useEffect, useCallback } from 'react';
import ManagementTable from './components/ManagementTable';
import ManagementModal from './components/ManagementModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { costDriversService } from '../../services/managementService';
import Icon from '../../components/AppIcon';

const COLUMNS = [
  { key: 'name', label: 'Category Name', width: '30%' },
  { key: 'category', label: 'Group', width: '20%' },
  {
    key: 'officeName',
    label: 'Office',
    width: '25%',
    render: (val) => val ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{val}</span>
    ) : (
      <span className="text-xs text-muted-foreground">All Offices</span>
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
];

const FIELDS = [
  { name: 'name', label: 'Category Name', required: true, placeholder: 'e.g. Payroll Tax' },
  {
    name: 'category',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'Payroll', label: 'Payroll' },
      { value: 'Payment Processing', label: 'Payment Processing' },
      { value: 'Benefits', label: 'Benefits' },
      { value: 'Other', label: 'Other' },
    ],
    placeholder: 'Select Type',
  },
];

const VALIDATION = {
  name: { required: true, label: 'Category Name', minLength: 2, maxLength: 100 },
};

const CostDriversManagement = () => {
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
      const data = await costDriversService?.getAll();
      setItems(data);
    } catch (err) {
      setError(err?.message || 'Failed to load cost drivers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);
  const handleToggleActive = async (row) => {
    setSaving(true);
    try {
      await costDriversService?.update(row?.id, { is_active: !row?.is_active });
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to update cost driver status');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editRow) {
        await costDriversService?.update(editRow?.id, values);
      } else {
        await costDriversService?.create(values);
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
      await costDriversService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate cost driver');
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
        title="Cost Drivers"
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
      <ManagementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edit Cost Driver' : 'Add New Cost Driver'}
        fields={FIELDS}
        validationSchema={VALIDATION}
        initialValues={editRow}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editRow ? 'Update' : 'Create'}
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

export default CostDriversManagement;
