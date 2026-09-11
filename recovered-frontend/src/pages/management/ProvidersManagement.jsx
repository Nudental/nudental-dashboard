import React, { useState, useEffect, useCallback } from 'react';
import ManagementTable from './components/ManagementTable';
import ManagementModal from './components/ManagementModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { providersService, officesService } from '../../services/managementService';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const COLUMNS = [
  { key: 'name', label: 'Name', width: '18%' },
  {
    key: 'provider_type',
    label: 'Type',
    width: '10%',
    render: (val) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        val === 'doctor' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'
      }`}>
        {val === 'doctor' ? 'Doctor' : 'Hygienist'}
      </span>
    ),
  },
  { key: 'specialization', label: 'Specialization', width: '14%' },
  { key: 'license_number', label: 'License #', width: '12%' },
  {
    key: 'phone',
    label: 'Phone',
    width: '12%',
    render: (val) => val ? <a href={`tel:${val}`} className="text-primary hover:underline">{val}</a> : <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'email',
    label: 'Email',
    width: '16%',
    render: (val) => val ? <a href={`mailto:${val}`} className="text-primary hover:underline truncate block max-w-[140px]">{val}</a> : <span className="text-muted-foreground">—</span>,
  },
  { key: 'officeName', label: 'Office', width: '12%' },
  {
    key: 'is_active',
    label: 'Status',
    width: '8%',
    render: (val) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        val ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
      }`}>
        {val ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

// ─── ADD PROVIDER MODAL ────────────────────────────────────────────────────
const AddProviderModal = ({ isOpen, onClose, providerType, offices, onSaved }) => {
  const [values, setValues] = useState({ name: '', specialization: '', license_number: '', phone: '', email: '', office_ids: [], is_active: true });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValues({ name: '', specialization: '', license_number: '', phone: '', email: '', office_ids: [], is_active: true });
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen]);

  const handleChange = (field, val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const errs = {};
    if (!values?.name?.trim()) errs.name = 'Name is required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const errs = validateForm();
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const officeIds = Array.isArray(values?.office_ids) ? values?.office_ids : [];
      if (officeIds?.length === 0) {
        await providersService?.create({
          name: values?.name?.trim(),
          provider_type: providerType,
          office_id: null,
          specialization: values?.specialization || '',
          license_number: values?.license_number || '',
          phone: values?.phone || '',
          email: values?.email || '',
          is_active: values?.is_active,
        });
      } else {
        for (const officeId of officeIds) {
          await providersService?.create({
            name: values?.name?.trim(),
            provider_type: providerType,
            office_id: officeId,
            specialization: values?.specialization || '',
            license_number: values?.license_number || '',
            phone: values?.phone || '',
            email: values?.email || '',
            is_active: values?.is_active,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err?.message || 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const officeSelectOptions = offices?.map(o => ({ value: o?.id, label: o?.name })) || [];
  const typeLabel = providerType === 'doctor' ? 'Doctor' : 'Hygienist';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Add New {typeLabel}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
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
            label="Full Name"
            required
            placeholder={providerType === 'doctor' ? 'e.g. Dr. John Smith' : 'e.g. Jane Doe'}
            value={values?.name}
            onChange={(e) => handleChange('name', e?.target?.value)}
            error={errors?.name}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="e.g. (732) 555-0100"
            value={values?.phone}
            onChange={(e) => handleChange('phone', e?.target?.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="e.g. provider@thenudental.com"
            value={values?.email}
            onChange={(e) => handleChange('email', e?.target?.value)}
          />
          <Input
            label="Specialization"
            placeholder="e.g. General Dentistry, Orthodontics"
            value={values?.specialization}
            onChange={(e) => handleChange('specialization', e?.target?.value)}
          />
          <Input
            label="License Number"
            placeholder="e.g. NJ-12345"
            value={values?.license_number}
            onChange={(e) => handleChange('license_number', e?.target?.value)}
          />
          <Select
            label="Office Assignment (select one or more)"
            options={officeSelectOptions}
            value={values?.office_ids}
            onChange={(val) => handleChange('office_ids', val)}
            multiple
            searchable
            clearable
            placeholder="Select offices..."
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange('is_active', !values?.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                values?.is_active ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                values?.is_active ? 'translate-x-4' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-foreground">Active</span>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="default" loading={saving}>Add {typeLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
const ProvidersManagement = () => {
  const [providers, setProviders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterField, setFilterField] = useState('none');
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [addHygienistOpen, setAddHygienistOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [provData, offData] = await Promise.all([
        providersService?.getAll(),
        officesService?.getAll(),
      ]);
      setProviders(provData);
      setOffices(offData);
    } catch (err) {
      setError(err?.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const officeOptions = offices?.map(o => ({ value: o?.id, label: o?.name }));

  const FIELDS = [
    { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Dr. John Smith' },
    {
      name: 'provider_type',
      label: 'Provider Type',
      type: 'select',
      required: true,
      options: [
        { value: 'doctor', label: 'Doctor' },
        { value: 'hygienist', label: 'Hygienist' },
      ],
    },
    { name: 'specialization', label: 'Specialization', placeholder: 'e.g. General Dentistry, Orthodontics' },
    { name: 'license_number', label: 'License Number', placeholder: 'e.g. NJ-12345' },
    { name: 'phone', label: 'Phone', type: 'tel', placeholder: 'e.g. (732) 555-0100' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'e.g. doctor@thenudental.com' },
    {
      name: 'office_id',
      label: 'Office',
      type: 'select',
      options: officeOptions,
      placeholder: 'Select Office',
    },
  ];

  const VALIDATION = {
    name: { required: true, label: 'Name', minLength: 2, maxLength: 100 },
    provider_type: { required: true, label: 'Provider Type' },
    email: { email: true, label: 'Email' },
    phone: {
      label: 'Phone',
      pattern: /^[\+]?[\d\s\-\(\)]{7,20}$/,
      patternMessage: 'Please enter a valid phone number',
    },
  };

  const filteredProviders = providers?.filter(p => {
    const matchesType = filterType === 'all' || p?.provider_type === filterType;
    const matchesSearch = !searchQuery || p?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    const matchesFilter = filterField === 'none' || !filterValue ||
      (filterField === 'specialization' && p?.specialization?.toLowerCase()?.includes(filterValue?.toLowerCase())) ||
      (filterField === 'license_number' && p?.license_number?.toLowerCase()?.includes(filterValue?.toLowerCase()));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p?.is_active === true) ||
      (statusFilter === 'inactive' && p?.is_active === false);
    return matchesType && matchesSearch && matchesFilter && matchesStatus;
  });

  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);

  const handleToggleActive = async (id, isActive) => {
    try {
      await providersService?.toggleActive(id, isActive);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name: values?.name,
        provider_type: values?.provider_type,
        office_id: values?.office_id || null,
        specialization: values?.specialization || '',
        license_number: values?.license_number || '',
        phone: values?.phone || '',
        email: values?.email || '',
      };
      if (editRow) {
        await providersService?.update(editRow?.id, payload);
      } else {
        await providersService?.create(payload);
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
      await providersService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate provider');
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

      {/* Add Provider Buttons */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button
          variant="default"
          size="sm"
          iconName="UserPlus"
          iconPosition="left"
          onClick={() => setAddDoctorOpen(true)}
        >
          Add New Doctor
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconName="UserPlus"
          iconPosition="left"
          onClick={() => setAddHygienistOpen(true)}
        >
          Add New Hygienist
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {['all', 'doctor', 'hygienist']?.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {type === 'all' ? 'All Providers' : type === 'doctor' ? 'Doctors' : 'Hygienists'}
            <span className="ml-1.5 text-xs opacity-70">
              ({type === 'all' ? providers?.length : providers?.filter(p => p?.provider_type === type)?.length})
            </span>
          </button>
        ))}
      </div>

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={16} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e?.target?.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={filterField}
            onChange={(e) => { setFilterField(e?.target?.value); setFilterValue(''); }}
            className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
          >
            <option value="none">Filter by...</option>
            <option value="specialization">Specialization</option>
            <option value="license_number">License Number</option>
          </select>
          {filterField !== 'none' && (
            <div className="relative">
              <input
                type="text"
                placeholder={filterField === 'specialization' ? 'e.g. General Dentistry' : 'e.g. NJ-12345'}
                value={filterValue}
                onChange={(e) => setFilterValue(e?.target?.value)}
                className="pl-3 pr-8 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground w-48"
              />
              {filterValue && (
                <button onClick={() => setFilterValue('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ManagementTable
        title="Providers"
        columns={COLUMNS}
        data={filteredProviders}
        loading={loading}
        onAdd={null}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        showActiveToggle
        extraRowActions={[]}
      />

      {/* Edit Modal */}
      <ManagementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edit Provider' : 'Add New Provider'}
        fields={FIELDS}
        validationSchema={VALIDATION}
        initialValues={editRow}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editRow ? 'Update' : 'Create'}
      />

      {/* Add Doctor Modal */}
      <AddProviderModal
        isOpen={addDoctorOpen}
        onClose={() => setAddDoctorOpen(false)}
        providerType="doctor"
        offices={offices}
        onSaved={loadData}
      />

      {/* Add Hygienist Modal */}
      <AddProviderModal
        isOpen={addHygienistOpen}
        onClose={() => setAddHygienistOpen(false)}
        providerType="hygienist"
        offices={offices}
        onSaved={loadData}
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

export default ProvidersManagement;
