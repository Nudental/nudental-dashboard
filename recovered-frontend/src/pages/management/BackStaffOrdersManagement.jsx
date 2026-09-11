import React, { useState, useEffect, useCallback } from 'react';
import ManagementTable from './components/ManagementTable';
import ManagementModal from './components/ManagementModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { backStaffOrdersService, officesService } from '../../services/managementService';
import Icon from '../../components/AppIcon';

const COLUMNS = [
  { key: 'name', label: 'Vendor / Expense Name', width: '35%' },
  { key: 'category', label: 'Category', width: '25%' },
  {
    key: 'officeName',
    label: 'Office',
    width: '25%',
    render: (val) => (
      <span className="text-sm text-foreground">{val || <span className="text-muted-foreground italic">—</span>}</span>
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
  { name: 'name', label: 'Vendor / Expense Name', required: true, placeholder: 'e.g. Amazon' },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'Dental Supplies', label: 'Dental Supplies' },
      { value: 'Lab Fees', label: 'Lab Fees' },
      { value: 'Office Supplies', label: 'Office Supplies' },
      { value: 'Facilities', label: 'Facilities' },
      { value: 'Equipment', label: 'Equipment' },
      { value: 'Other', label: 'Other' },
    ],
    placeholder: 'Select Category',
  },
];

const VALIDATION = {
  name: { required: true, label: 'Vendor / Expense Name', minLength: 2, maxLength: 100 },
};

const BackStaffOrdersManagement = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
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
      const [data, officeList] = await Promise.all([
        backStaffOrdersService?.getAll(),
        officesService?.getAll(),
      ]);
      setItems(data);
      setOffices(officeList);
    } catch (err) {
      setError(err?.message || 'Failed to load back staff orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedOfficeId) {
      setFilteredItems(items?.filter(item => item?.office_id === selectedOfficeId));
    } else {
      setFilteredItems(items);
    }
  }, [items, selectedOfficeId]);

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editRow) {
        await backStaffOrdersService?.update(editRow?.id, values);
      } else {
        await backStaffOrdersService?.create(values);
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
      await backStaffOrdersService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate item');
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

      {/* Office Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Building2" size={15} color="var(--color-muted-foreground)" />
          <span className="text-sm font-medium text-foreground">Filter by Office:</span>
        </div>
        <select
          value={selectedOfficeId}
          onChange={(e) => setSelectedOfficeId(e?.target?.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary min-w-[220px]"
        >
          <option value="">All Offices</option>
          {offices?.map(office => (
            <option key={office?.id} value={office?.id}>{office?.name}</option>
          ))}
        </select>
        {selectedOfficeId && (
          <button
            type="button"
            onClick={() => setSelectedOfficeId('')}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={12} />
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredItems?.length} {filteredItems?.length === 1 ? 'item' : 'items'}
          {selectedOfficeId ? ` for ${offices?.find(o => o?.id === selectedOfficeId)?.name || ''}` : ' total'}
        </span>
      </div>

      <ManagementTable
        title="Back Staff Orders"
        columns={COLUMNS}
        data={filteredItems}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={() => {}}
        showActiveToggle={false}
        extraRowActions={[]}
      />
      <ManagementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edit Item' : 'Add New Item'}
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

export default BackStaffOrdersManagement;
