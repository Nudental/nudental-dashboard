import React, { useState, useEffect, useCallback } from 'react';
import ManagementTable from './components/ManagementTable';
import ManagementModal from './components/ManagementModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { officesService } from '../../services/managementService';
import Icon from '../../components/AppIcon';

const COLUMNS = [
  { key: 'name', label: 'Office Name', width: '20%' },
  { key: 'address', label: 'Address', width: '25%' },
  {
    key: 'phone',
    label: 'Phone / Fax',
    width: '18%',
    render: (val, row) => (
      <div className="text-sm">
        {val && <div>{val}</div>}
        {row?.fax && <div className="text-muted-foreground text-xs">Fax: {row?.fax}</div>}
      </div>
    ),
  },
  {
    key: 'email',
    label: 'Email / Website',
    width: '22%',
    render: (val, row) => (
      <div className="text-sm">
        {val && (
          <a href={`mailto:${val}`} className="text-primary hover:underline block truncate max-w-[180px]">
            {val}
          </a>
        )}
        {row?.website && (
          <a
            href={row?.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:underline block truncate max-w-[180px]"
          >
            {row?.website}
          </a>
        )}
      </div>
    ),
  },
  {
    key: 'is_active',
    label: 'Status',
    width: '10%',
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
  { name: 'name', label: 'Office Name', required: true, placeholder: 'e.g. Nu Dental of Eatontown' },
  { name: 'address', label: 'Address', placeholder: 'e.g. 178 NJ-35, Unit 6, Eatontown, NJ 07724' },
  { name: 'phone', label: 'Phone', placeholder: 'e.g. (732) 945-7999' },
  { name: 'fax', label: 'Fax', placeholder: 'e.g. (732) 945-7999' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'e.g. office@thenudental.com' },
  { name: 'website', label: 'Website', placeholder: 'e.g. https://www.thenudental.com/' },
];

const VALIDATION = {
  name: { required: true, label: 'Office Name', minLength: 2, maxLength: 100 },
  email: { email: true, label: 'Email' },
  phone: {
    label: 'Phone',
    pattern: /^[\d\s().+\-]{7,20}$/,
    patternMessage: 'Please enter a valid phone number',
  },
  fax: {
    label: 'Fax',
    pattern: /^[\d\s().+\-]{7,20}$/,
    patternMessage: 'Please enter a valid fax number',
  },
};

const OfficesManagement = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOffices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await officesService?.getAll();
      setOffices(data);
    } catch (err) {
      setError(err?.message || 'Failed to load offices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOffices(); }, [loadOffices]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);

  const handleToggleActive = async (id, isActive) => {
    try {
      await officesService?.toggleActive(id, isActive);
      await loadOffices();
    } catch (err) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editRow) {
        await officesService?.update(editRow?.id, values);
      } else {
        await officesService?.create(values);
      }
      setModalOpen(false);
      await loadOffices();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    try {
      await officesService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadOffices();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate office');
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
        title="Offices"
        columns={COLUMNS}
        data={offices}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        showActiveToggle
        extraRowActions={undefined}
      />
      <ManagementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edit Office' : 'Add New Office'}
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

export default OfficesManagement;
