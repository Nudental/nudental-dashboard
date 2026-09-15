import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin — Full system access' },
  { value: 'regional_manager', label: 'Regional Manager — Front Office / Global' },
  { value: 'regional_clinical_manager', label: 'Regional Clinical Manager — Back Office / Global' },
  { value: 'admin', label: 'Admin — Single office management' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'insurance_verifier', label: 'Insurance Verifier — Insurance verification specialists' },
  { value: 'marketing', label: 'Marketing — Marketing and performance analytics access' },
];

// Roles that always have All Offices access by role definition
const ALL_OFFICES_ROLES = ['regional_manager', 'regional_clinical_manager', 'super_admin', 'admin'];

const InviteUserModal = ({ isOpen, onClose, offices, onSubmit, loading }) => {
  const [values, setValues] = useState({ email: '', fullName: '', role: 'staff', phone: '', username: '', tempPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [allOffices, setAllOffices] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues({ email: '', fullName: '', role: 'staff', phone: '', username: '', tempPassword: '' });
      setErrors({});
      setSubmitError('');
      setSelectedOfficeIds([]);
      setAllOffices(false);
    }
  }, [isOpen]);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    // Auto-set All Offices for all-offices roles (regional + admin + super_admin)
    if (name === 'role' && ALL_OFFICES_ROLES?.includes(value)) {
      setAllOffices(true);
      setSelectedOfficeIds([]);
    } else if (name === 'role') {
      setAllOffices(false);
    }
  };

  const handleOfficeToggle = (officeId) => {
    setSelectedOfficeIds(prev =>
      prev?.includes(officeId) ? prev?.filter(id => id !== officeId) : [...prev, officeId]
    );
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const errs = {};
    if (!values?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(values?.email)) errs.email = 'Valid email is required';
    if (!values?.fullName?.trim() || values?.fullName?.length < 2) errs.fullName = 'Full name must be at least 2 characters';
    if (!values?.username?.trim() || values?.username?.length < 3) errs.username = 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9._-]+$/?.test(values?.username?.trim())) errs.username = 'Username can only contain letters, numbers, dots, hyphens, and underscores';
    if (!values?.tempPassword?.trim() || values?.tempPassword?.length < 8) errs.tempPassword = 'Temporary password must be at least 8 characters';
    if (!values?.role) errs.role = 'Role is required';
    if (values?.phone && !/^\+[1-9]\d{7,14}$/?.test(values?.phone?.trim())) errs.phone = 'Phone must be in E.164 format (e.g. +12015551234)';
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    try {
      await onSubmit({ ...values, selectedOfficeIds, allOffices });
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  const isAllOfficesRole = ALL_OFFICES_ROLES?.includes(values?.role);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="UserPlus" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Invite New User</h2>
              <p className="text-xs text-muted-foreground">A welcome email will be sent from alerts@nudashboard.com</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <Input
            label="Full Name"
            required
            value={values?.fullName}
            onChange={(e) => handleChange('fullName', e?.target?.value)}
            error={errors?.fullName}
            placeholder="e.g. Jane Doe"
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={values?.email}
            onChange={(e) => handleChange('email', e?.target?.value)}
            error={errors?.email}
            placeholder="jane@nudental.com"
          />

          <Input
            label="Username"
            required
            value={values?.username}
            onChange={(e) => handleChange('username', e?.target?.value?.toLowerCase()?.replace(/\s/g, ''))}
            error={errors?.username}
            placeholder="e.g. jdoe or jane.doe"
            hint="Unique username for login. Letters, numbers, dots, hyphens, underscores only."
          />

          <Input
            label="Temporary Password"
            type="password"
            required
            value={values?.tempPassword}
            onChange={(e) => handleChange('tempPassword', e?.target?.value)}
            error={errors?.tempPassword}
            placeholder="Set a temporary password"
            hint="User will be required to change this on first login."
          />

          <Input
            label="Phone Number (E.164 format)"
            value={values?.phone || ''}
            onChange={(e) => handleChange('phone', e?.target?.value)}
            error={errors?.phone}
            placeholder="e.g. +12015551234"
          />

          <Select
            label="Role"
            required
            options={ROLE_OPTIONS}
            value={values?.role}
            onChange={(val) => handleChange('role', val)}
            error={errors?.role}
          />

          {/* Office Assignment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Office Assignment</label>
            {isAllOfficesRole ? (
              /* All-offices roles: show locked All Offices indicator with helper text */
              <div className="border border-warning/30 rounded-lg p-3 bg-warning/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon name="Globe" size={14} color="var(--color-warning)" />
                  <span className="text-sm font-medium text-warning">All Offices</span>
                  <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
                    <Icon name="Lock" size={9} />
                    Role-based
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Admin and Super Admin roles have access to all offices.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                <label className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  allOffices ? 'bg-warning/5 border border-warning/20' : 'hover:bg-muted/50'
                }`}>
                  <input
                    type="checkbox"
                    checked={allOffices}
                    onChange={(e) => { setAllOffices(e?.target?.checked); if (e?.target?.checked) setSelectedOfficeIds([]); }}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Icon name="Globe" size={14} color={allOffices ? 'var(--color-warning)' : 'var(--color-muted-foreground)'} />
                    <span className="text-sm font-medium text-foreground">All Offices</span>
                  </div>
                </label>
                {!allOffices && (offices || [])?.map(office => (
                  <label key={office?.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedOfficeIds?.includes(office?.id) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedOfficeIds?.includes(office?.id)}
                      onChange={() => handleOfficeToggle(office?.id)}
                      className="w-4 h-4 rounded border-border text-primary"
                    />
                    <span className="text-sm text-foreground">{office?.name}</span>
                  </label>
                ))}
                {(offices || [])?.length === 0 && !allOffices && (
                  <p className="text-xs text-muted-foreground text-center py-2">No offices available</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="default" loading={loading}>
              <Icon name="UserPlus" size={14} className="mr-1.5" />
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;
