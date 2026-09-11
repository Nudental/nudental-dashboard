import React, { useState, useEffect, useCallback, useRef } from 'react';
import ManagementTable from './components/ManagementTable';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import RoleEditorModal from './RoleEditorModal';
import { usersService, officesService, profilePhotosService } from '../../services/managementService';
import { userOfficeService, emailService } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const ROLE_LABELS = { staff: 'Staff', admin: 'Admin', super_admin: 'Super Admin', office_manager: 'Office Manager' };
const ROLE_COLORS = {
  staff: 'bg-muted text-muted-foreground',
  admin: 'bg-primary/10 text-primary',
  super_admin: 'bg-warning/10 text-warning',
  office_manager: 'bg-blue-100 text-blue-700',
};

const STATUS_CONFIG = {
  Active: { color: 'bg-success/10 text-success', icon: 'CheckCircle' },
  Pending: { color: 'bg-amber-100 text-amber-700', icon: 'Clock' },
  Deactivated: { color: 'bg-muted text-muted-foreground', icon: 'XCircle' },
};

const JOB_TITLE_OPTIONS = [
  { value: '', label: 'Select Job Title' },
  { value: 'Office Manager', label: 'Office Manager' },
  { value: 'Front Desk', label: 'Front Desk' },
  { value: 'Assistant', label: 'Assistant' },
  { value: 'Dental Hygienist', label: 'Dental Hygienist' },
  { value: 'Dentist', label: 'Dentist' },
  { value: 'Billing Specialist', label: 'Billing Specialist' },
  { value: 'Other', label: 'Other' },
];

const COLUMNS = [
  {
    key: 'profile_photo_url',
    label: '',
    width: '48px',
    render: (val, row) => (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {val ? (
          <img src={val} alt={row?.full_name || 'Profile'} className="w-full h-full object-cover" />
        ) : (
          <Icon name="User" size={14} color="var(--color-muted-foreground)" />
        )}
      </div>
    ),
  },
  { key: 'full_name', label: 'Name', width: '16%' },
  { key: 'job_title', label: 'Job Title', width: '11%', render: (val) => val || <span className="text-muted-foreground">—</span> },
  { key: 'email', label: 'Email', width: '17%' },
  {
    key: 'role',
    label: 'Role',
    width: '9%',
    render: (val) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS?.[val] || 'bg-muted text-muted-foreground'}`}>
        {ROLE_LABELS?.[val] || val}
      </span>
    ),
  },
  {
    key: 'officeDisplay',
    label: 'Office Access',
    width: '16%',
    render: (val, row) => {
      if (row?.hasAllOffices) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
            <Icon name="Globe" size={10} />
            All Offices
          </span>
        );
      }
      return <span className="text-sm text-foreground">{row?.assignedOfficeNames || <span className="text-muted-foreground">—</span>}</span>;
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '10%',
    render: (val) => {
      const cfg = STATUS_CONFIG?.[val] || STATUS_CONFIG?.Pending;
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color}`}>
          <Icon name={cfg?.icon} size={10} />
          {val || 'Pending'}
        </span>
      );
    },
  },
];

// Multi-Office Selector Component
const OfficeAccessSelector = ({ offices, selectedOfficeIds, allOffices, onChangeOffices, onChangeAllOffices }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Office Access</label>
      <div className="space-y-2">
        <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
          allOffices ? 'bg-warning/5 border-warning/30' : 'border-border hover:bg-muted/30'
        }`}>
          <input
            type="checkbox"
            checked={allOffices}
            onChange={(e) => onChangeAllOffices(e?.target?.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
          />
          <div className="flex items-center gap-2">
            <Icon name="Globe" size={14} color={allOffices ? 'var(--color-warning)' : 'var(--color-muted-foreground)'} />
            <span className="text-sm font-medium text-foreground">All Offices</span>
            <span className="text-xs text-muted-foreground">(Management team)</span>
          </div>
        </label>
        {!allOffices && offices?.map((office) => (
          <label key={office?.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
            selectedOfficeIds?.includes(office?.id) ? 'bg-primary/5 border-primary/20' : 'border-border hover:bg-muted/30'
          }`}>
            <input
              type="checkbox"
              checked={selectedOfficeIds?.includes(office?.id)}
              onChange={(e) => {
                if (e?.target?.checked) {
                  onChangeOffices([...(selectedOfficeIds || []), office?.id]);
                } else {
                  onChangeOffices((selectedOfficeIds || [])?.filter((id) => id !== office?.id));
                }
              }}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-sm text-foreground">{office?.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

// User Edit Modal
const UserEditModal = ({ isOpen, onClose, editRow, offices, onSubmit, loading }) => {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [allOffices, setAllOffices] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && editRow) {
      setValues({
        full_name: editRow?.full_name || '',
        role: editRow?.role || 'staff',
        phone_number: editRow?.phone_number || '',
        work_email: editRow?.work_email || '',
        job_title: editRow?.job_title || '',
        profile_photo_url: editRow?.profile_photo_url || '',
      });
      setErrors({});
      setSubmitError('');
      setPhotoFile(null);
      setPhotoPreview(editRow?.profile_photo_url || null);
      // Load office assignments
      const assignments = editRow?.officeAssignments || [];
      const hasAll = assignments?.some((a) => a?.all_offices);
      setAllOffices(hasAll);
      setSelectedOfficeIds(hasAll ? [] : assignments?.filter((a) => a?.office_id)?.map((a) => a?.office_id));
    }
  }, [isOpen, editRow]);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePhotoChange = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (file?.size > 2097152) { setErrors((prev) => ({ ...prev, photo: 'Photo must be under 2MB' })); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, photo: '' }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    if (!values?.full_name?.trim()) { setErrors({ full_name: 'Full Name is required' }); return; }
    if (!values?.role) { setErrors({ role: 'Role is required' }); return; }
    try {
      let photoUrl = values?.profile_photo_url;
      if (photoFile && editRow?.id) {
        setUploadingPhoto(true);
        try {
          const filePath = await profilePhotosService?.upload(editRow?.id, photoFile);
          const signedUrl = await profilePhotosService?.getSignedUrl(filePath);
          photoUrl = signedUrl || filePath;
        } finally { setUploadingPhoto(false); }
      }
      await onSubmit({ ...values, profile_photo_url: photoUrl, selectedOfficeIds, allOffices });
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Edit User</h2>
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
          {/* Profile Photo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="User" size={24} color="var(--color-muted-foreground)" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef?.current?.click()}
                  className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground"
                >
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); handleChange('profile_photo_url', ''); }}
                    className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP · Max 2MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {errors?.photo && <p className="text-xs text-destructive mt-1">{errors?.photo}</p>}
          </div>

          <Input
            label="Full Name"
            required
            value={values?.full_name || ''}
            onChange={(e) => handleChange('full_name', e?.target?.value)}
            error={errors?.full_name}
            placeholder="e.g. Jane Doe"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="tel"
              value={values?.phone_number || ''}
              onChange={(e) => handleChange('phone_number', e?.target?.value)}
              placeholder="e.g. (732) 555-0100"
            />
            <Input
              label="Work Email"
              type="email"
              value={values?.work_email || ''}
              onChange={(e) => handleChange('work_email', e?.target?.value)}
              placeholder="e.g. jane@nudental.com"
            />
          </div>

          <Select
            label="Job Title"
            options={JOB_TITLE_OPTIONS}
            value={values?.job_title || ''}
            onChange={(val) => handleChange('job_title', val)}
            placeholder="Select Job Title"
          />

          <Select
            label="Role"
            required
            options={[
              { value: 'staff', label: 'Staff' },
              { value: 'admin', label: 'Admin' },
              { value: 'super_admin', label: 'Super Admin' },
            ]}
            value={values?.role || ''}
            onChange={(val) => handleChange('role', val)}
            error={errors?.role}
          />

          <OfficeAccessSelector
            offices={offices}
            selectedOfficeIds={selectedOfficeIds}
            allOffices={allOffices}
            onChangeOffices={setSelectedOfficeIds}
            onChangeAllOffices={(v) => { setAllOffices(v); if (v) setSelectedOfficeIds([]); }}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || uploadingPhoto}>Cancel</Button>
            <Button type="submit" variant="default" loading={loading || uploadingPhoto}>
              {uploadingPhoto ? 'Uploading...' : 'Update User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Invite Modal
const UserInviteModal = ({ isOpen, onClose, offices, onSubmit, loading }) => {
  const [values, setValues] = useState({ email: '', fullName: '', role: 'staff', phone_number: '', work_email: '', job_title: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [allOffices, setAllOffices] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues({ email: '', fullName: '', role: 'staff', phone_number: '', work_email: '', job_title: '' });
      setErrors({});
      setSubmitError('');
      setSelectedOfficeIds([]);
      setAllOffices(false);
    }
  }, [isOpen]);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const errs = {};
    if (!values?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(values?.email)) errs.email = 'Valid email is required';
    if (!values?.fullName?.trim() || values?.fullName?.length < 2) errs.fullName = 'Full Name must be at least 2 characters';
    if (!values?.role) errs.role = 'Role is required';
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    try {
      await onSubmit({ ...values, selectedOfficeIds, allOffices });
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Create New User</h2>
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
          <Input label="Email Address" type="email" required value={values?.email} onChange={(e) => handleChange('email', e?.target?.value)} error={errors?.email} placeholder="staff@nudental.com" />
          <Input label="Full Name" required value={values?.fullName} onChange={(e) => handleChange('fullName', e?.target?.value)} error={errors?.fullName} placeholder="e.g. Jane Doe" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone Number" type="tel" value={values?.phone_number} onChange={(e) => handleChange('phone_number', e?.target?.value)} placeholder="(732) 555-0100" />
            <Input label="Work Email" type="email" value={values?.work_email} onChange={(e) => handleChange('work_email', e?.target?.value)} placeholder="jane@nudental.com" />
          </div>
          <Select label="Job Title" options={JOB_TITLE_OPTIONS} value={values?.job_title} onChange={(val) => handleChange('job_title', val)} placeholder="Select Job Title" />
          <Select
            label="Role"
            required
            options={[
              { value: 'staff', label: 'Staff' },
              { value: 'admin', label: 'Admin' },
              { value: 'super_admin', label: 'Super Admin' },
            ]}
            value={values?.role}
            onChange={(val) => handleChange('role', val)}
            error={errors?.role}
          />
          <OfficeAccessSelector
            offices={offices}
            selectedOfficeIds={selectedOfficeIds}
            allOffices={allOffices}
            onChangeOffices={setSelectedOfficeIds}
            onChangeAllOffices={(v) => { setAllOffices(v); if (v) setSelectedOfficeIds([]); }}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="default" loading={loading}>Create User</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UsersManagement = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, offData] = await Promise.all([
        userOfficeService?.getAllUsersWithOffices(),
        officesService?.getAll(),
      ]);
      setUsers(userData);
      setOffices(offData);
    } catch (err) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredUsers = users?.filter((u) =>
    !searchQuery || u?.full_name?.toLowerCase()?.includes(searchQuery?.toLowerCase())
  );

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDelete = (row) => setDeleteRow(row);

  const handleToggleActive = async (id, isActive) => {
    try {
      await usersService?.toggleActive(id, isActive);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleApproveUser = async (userId) => {
    setApprovingId(userId);
    try {
      await usersService?.approveUser(userId);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to approve user');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeactivateUser = async (userId) => {
    setApprovingId(userId);
    try {
      await usersService?.deactivateUser(userId);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate user');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editRow) {
        await usersService?.update(editRow?.id, {
          full_name: values?.full_name,
          role: values?.role,
          phone_number: values?.phone_number || '',
          work_email: values?.work_email || '',
          job_title: values?.job_title || '',
          profile_photo_url: values?.profile_photo_url || '',
        });
        await userOfficeService?.setUserOfficeAssignments(
          editRow?.id,
          values?.selectedOfficeIds || [],
          values?.allOffices || false
        );
      } else {
        const newUser = await usersService?.invite({
          email: values?.email,
          fullName: values?.fullName,
          role: values?.role,
          phone_number: values?.phone_number || '',
          work_email: values?.work_email || '',
          job_title: values?.job_title || '',
        });
        if (newUser?.id) {
          await userOfficeService?.setUserOfficeAssignments(
            newUser?.id,
            values?.selectedOfficeIds || [],
            values?.allOffices || false
          );
          const officeName = values?.allOffices
            ? 'All Offices'
            : offices?.filter((o) => values?.selectedOfficeIds?.includes(o?.id))?.map((o) => o?.name)?.join(', ');
          await emailService?.sendWelcomeEmail({
            email: values?.email,
            full_name: values?.fullName,
            role: values?.role,
            office_name: officeName,
          });
        }
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
      await usersService?.delete(deleteRow?.id);
      setDeleteRow(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate user');
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = userProfile?.role === 'super_admin';

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
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
        {isSuperAdmin && (
          <Button
            variant="outline"
            onClick={() => setRoleEditorOpen(true)}
            className="flex items-center gap-2"
          >
            <Icon name="ShieldCog" size={15} />
            Role Permissions
          </Button>
        )}
      </div>

      <ManagementTable
        title="Users & Staff"
        columns={COLUMNS}
        data={filteredUsers}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        showActiveToggle
        extraRowActions={isSuperAdmin ? (row) => (
          <div className="flex items-center gap-1">
            {row?.status !== 'Active' && (
              <button
                onClick={() => handleApproveUser(row?.id)}
                disabled={approvingId === row?.id}
                title="Approve user"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
              >
                <Icon name="CheckCircle" size={12} />
                Approve
              </button>
            )}
            {row?.status === 'Active' && (
              <button
                onClick={() => handleDeactivateUser(row?.id)}
                disabled={approvingId === row?.id}
                title="Deactivate user"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                <Icon name="XCircle" size={12} />
                Deactivate
              </button>
            )}
          </div>
        ) : null}
      />

      {editRow ? (
        <UserEditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          editRow={editRow}
          offices={offices}
          onSubmit={handleSubmit}
          loading={saving}
        />
      ) : (
        <UserInviteModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          offices={offices}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleConfirmDelete}
        loading={saving}
        itemName={deleteRow?.full_name || deleteRow?.email}
      />

      {isSuperAdmin && (
        <RoleEditorModal
          isOpen={roleEditorOpen}
          onClose={() => setRoleEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default UsersManagement;
