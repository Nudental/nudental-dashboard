import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import PhoneVerificationModal from './PhoneVerificationModal';
import { supabase } from '../../../lib/supabase';


const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin — Full system access' },
  { value: 'regional_manager', label: 'Regional Manager — Front Office / Global' },
  { value: 'regional_clinical_manager', label: 'Regional Clinical Manager — Back Office / Global' },
  { value: 'admin', label: 'Admin — Single office management' },
  { value: 'doctor', label: 'Doctor / Provider' },
  { value: 'hygienist', label: 'Hygienist' },
  { value: 'dental_assistant', label: 'Dental Assistant' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'treatment_coordinator', label: 'Treatment Coordinator' },
  { value: 'rda', label: 'RDA' },
  { value: 'clinical_manager', label: 'Clinical Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'insurance_verifier', label: 'Insurance Verifier — Insurance verification specialists' },
  { value: 'marketing', label: 'Marketing — Marketing and performance analytics access' },
];

// Roles that always have All Offices access by role definition
const ALL_OFFICES_ROLES = ['regional_manager', 'regional_clinical_manager', 'super_admin', 'admin'];

// Allowed photo file types
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_PHOTO_EXTS = '.jpg, .jpeg, .png, .webp';

/**
 * Determine if a value is a raw storage object key/path (not a full URL).
 */
const isStoragePath = (value) => {
  if (!value) return false;
  return !value?.startsWith('http://') && !value?.startsWith('https://');
};

/**
 * Verify the storage path belongs to the given user profile id.
 * Safe path format: {user_profile_id}/{timestamp}.ext
 */
const isSafePathForUser = (path, userId) => {
  if (!path || !userId) return false;
  const parts = path?.split('/');
  return parts?.length >= 2 && parts?.[0] === userId;
};

/**
 * Resolve a profile_photo_url to a signed URL for preview.
 */
const resolvePreviewUrl = async (rawValue) => {
  if (!rawValue) return null;
  if (!isStoragePath(rawValue)) return rawValue; // already a full URL
  try {
    const { data, error } = await supabase?.storage?.from('profile-photos')?.createSignedUrl(rawValue, 3600);
    if (error || !data?.signedUrl) return null;
    return data?.signedUrl;
  } catch {
    return null;
  }
};

/**
 * Write a photo audit log entry.
 */
const logPhotoAudit = async (action, userId, userName, oldPath, newPath) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    const summaryMap = {
      PHOTO_UPLOAD: `Uploaded profile photo for ${userName || userId}`,
      PHOTO_REPLACE: `Replaced profile photo for ${userName || userId}`,
      PHOTO_REMOVE: `Removed profile photo for ${userName || userId}`,
    };
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: 'user_profiles',
      record_id: userId,
      old_values: oldPath ? { profile_photo_url: oldPath } : null,
      new_values: newPath ? { profile_photo_url: newPath } : null,
      change_summary: summaryMap?.[action] || `Photo action ${action} for ${userName || userId}`,
    });
  } catch (err) {
    console.warn('[EditUserModal] Photo audit log error:', err?.message);
  }
};

// ─── Photo Section Component ──────────────────────────────────────────────
const PhotoSection = ({ user, canManagePhoto, onPhotoChange }) => {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [imgLoadError, setImgLoadError] = useState(false);
  // pendingAction: { type: 'upload'|'remove', file?, newPath?, oldPath? }
  const [pendingAction, setPendingAction] = useState(null);

  const initials = user?.full_name?.split(' ')?.map(n => n?.[0])?.join('')?.substring(0, 2)?.toUpperCase() || 'U';
  const currentPath = user?.profile_photo_url || null;

  // Resolve signed URL for current photo on mount / user change
  useEffect(() => {
    let cancelled = false;
    setImgLoadError(false);
    setPendingAction(null);
    setPhotoError('');

    if (!currentPath) {
      setPreviewUrl(null);
      return;
    }

    resolvePreviewUrl(currentPath)?.then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });

    return () => { cancelled = true; };
  }, [currentPath, user?.id]);

  const handleFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_PHOTO_TYPES?.includes(file?.type)) {
      setPhotoError(`Invalid file type. Please upload ${ALLOWED_PHOTO_EXTS}.`);
      e.target.value = '';
      return;
    }

    // Validate file size (max 5 MB)
    if (file?.size > 5 * 1024 * 1024) {
      setPhotoError('File too large. Maximum size is 5 MB.');
      e.target.value = '';
      return;
    }

    setPhotoError('');
    setPhotoLoading(true);

    try {
      // Generate object key: {user_profile_id}/{timestamp}.ext
      const ext = file?.name?.split('.')?.pop()?.toLowerCase() || 'jpg';
      const newPath = `${user?.id}/${Date.now()}.${ext}`;

      // Upload to private profile-photos bucket
      const { error: uploadError } = await supabase?.storage
        ?.from('profile-photos')
        ?.upload(newPath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // Generate signed URL for immediate preview
      const { data: signedData } = await supabase?.storage
        ?.from('profile-photos')
        ?.createSignedUrl(newPath, 3600);

      setPreviewUrl(signedData?.signedUrl || null);
      setImgLoadError(false);

      const action = currentPath ? 'PHOTO_REPLACE' : 'PHOTO_UPLOAD';
      setPendingAction({ type: 'upload', newPath, oldPath: currentPath, auditAction: action });

      // Notify parent with new storage path (not signed URL)
      onPhotoChange?.({ newPath, oldPath: currentPath, action });
    } catch (err) {
      setPhotoError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setPhotoLoading(false);
      e.target.value = '';
    }
  };

  const handleRemove = () => {
    setPhotoError('');
    setPendingAction({ type: 'remove', oldPath: currentPath, auditAction: 'PHOTO_REMOVE' });
    setPreviewUrl(null);
    setImgLoadError(false);
    onPhotoChange?.({ newPath: null, oldPath: currentPath, action: 'PHOTO_REMOVE' });
  };

  const handleCancelPhotoChange = () => {
    setPendingAction(null);
    setPhotoError('');
    setImgLoadError(false);
    // Re-resolve original preview
    if (currentPath) {
      resolvePreviewUrl(currentPath)?.then(setPreviewUrl);
    } else {
      setPreviewUrl(null);
    }
    onPhotoChange?.(null); // cancel
  };

  const showImage = (previewUrl || (!pendingAction && currentPath)) && !imgLoadError;
  const hasPendingUpload = pendingAction?.type === 'upload';
  const hasPendingRemove = pendingAction?.type === 'remove';

  if (!canManagePhoto) {
    // Read-only avatar display for non-admin viewers (shouldn't reach here, but safe fallback)
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-border">
          {showImage ? (
            <img src={previewUrl} alt={user?.full_name} className="w-full h-full object-cover" onError={() => setImgLoadError(true)} />
          ) : (
            <span className="text-lg font-semibold text-primary">{initials}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">Profile Photo</label>

      <div className="flex items-start gap-4">
        {/* Avatar preview */}
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-border">
            {showImage ? (
              <img
                src={previewUrl}
                alt={user?.full_name}
                className="w-full h-full object-cover"
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <span className="text-xl font-semibold text-primary">{initials}</span>
            )}
          </div>
          {hasPendingUpload && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center border-2 border-card">
              <Icon name="Check" size={10} color="white" />
            </div>
          )}
          {hasPendingRemove && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center border-2 border-card">
              <Icon name="X" size={10} color="white" />
            </div>
          )}
          {photoLoading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex-1 space-y-2">
          {/* Pending state banner */}
          {hasPendingUpload && (
            <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-xs text-success">
              <Icon name="CheckCircle" size={13} />
              <span>New photo ready — will save when you click Save Changes.</span>
              <button type="button" onClick={handleCancelPhotoChange} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="X" size={12} />
              </button>
            </div>
          )}
          {hasPendingRemove && (
            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              <Icon name="AlertCircle" size={13} />
              <span>Photo will be removed when you click Save Changes.</span>
              <button type="button" onClick={handleCancelPhotoChange} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="X" size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Upload / Replace button */}
            <button
              type="button"
              disabled={photoLoading}
              onClick={() => fileInputRef?.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors text-foreground disabled:opacity-50"
            >
              <Icon name="Upload" size={13} />
              {currentPath && !hasPendingRemove ? 'Replace Photo' : 'Upload Photo'}
            </button>

            {/* Remove button — only if there's a current photo and no pending remove */}
            {(currentPath || hasPendingUpload) && !hasPendingRemove && (
              <button
                type="button"
                disabled={photoLoading}
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-destructive disabled:opacity-50"
              >
                <Icon name="Trash2" size={13} />
                Remove Photo
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Accepted: {ALLOWED_PHOTO_EXTS} · Max 5 MB
          </p>

          {photoError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />
              {photoError}
            </p>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_PHOTO_TYPES?.join(',')}
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};

// ─── Main EditUserModal ───────────────────────────────────────────────────
const EditUserModal = ({ isOpen, onClose, user, offices, onSubmit, loading, canManagePhoto = false }) => {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [allOffices, setAllOffices] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  // Photo change: { newPath, oldPath, action } | null
  const [photoChange, setPhotoChange] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      setValues({
        full_name: user?.full_name || '',
        role: user?.role || 'staff',
        status: user?.status || 'Pending',
        phone: user?.phone || '',
        username: user?.username || '',
      });
      setErrors({});
      setSubmitError('');
      setPhotoChange(null);
      setPhoneVerified(user?.phone_verified === true);
      const assignments = user?.officeAssignments || [];
      const isAllOfficesRole = ALL_OFFICES_ROLES?.includes(user?.role);
      const hasAll = isAllOfficesRole || assignments?.some(a => a?.all_offices);
      setAllOffices(hasAll);
      setSelectedOfficeIds(hasAll ? [] : assignments?.filter(a => a?.office_id)?.map(a => a?.office_id));
    }
  }, [isOpen, user]);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (name === 'phone') setPhoneVerified(false);
    // Auto-set All Offices for all-offices roles (regional + admin + super_admin)
    if (name === 'role' && ALL_OFFICES_ROLES?.includes(value)) {
      setAllOffices(true);
      setSelectedOfficeIds([]);
    } else if (name === 'role') {
      setAllOffices(false);
      setSelectedOfficeIds([]);
    }
  };

  const handleOfficeToggle = (officeId) => {
    setSelectedOfficeIds(prev =>
      prev?.includes(officeId) ? prev?.filter(id => id !== officeId) : [...prev, officeId]
    );
  };

  const handlePhotoChange = (change) => {
    // null means cancelled
    setPhotoChange(change);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    if (!values?.full_name?.trim()) { setErrors({ full_name: 'Full name is required' }); return; }
    if (!values?.role) { setErrors({ role: 'Role is required' }); return; }
    if (values?.username && !/^[a-zA-Z0-9._-]+$/?.test(values?.username?.trim())) {
      setErrors({ username: 'Username can only contain letters, numbers, dots, hyphens, and underscores' });
      return;
    }
    if (values?.phone && !/^\+[1-9]\d{7,14}$/?.test(values?.phone?.trim())) {
      setErrors({ phone: 'Phone must be in E.164 format (e.g. +12015551234)' });
      return;
    }
    try {
      await onSubmit({ ...values, selectedOfficeIds, allOffices, photoChange });
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
              <Icon name="UserCog" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Edit User</h2>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
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

          {/* ── Photo Section (admin/super_admin only) ── */}
          {canManagePhoto && (
            <div className="pb-2 border-b border-border">
              <PhotoSection
                user={user}
                canManagePhoto={canManagePhoto}
                onPhotoChange={handlePhotoChange}
              />
            </div>
          )}

          <Input
            label="Full Name"
            required
            value={values?.full_name || ''}
            onChange={(e) => handleChange('full_name', e?.target?.value)}
            error={errors?.full_name}
            placeholder="e.g. Jane Doe"
          />

          <Input
            label="Username"
            required
            value={values?.username || ''}
            onChange={(e) => handleChange('username', e?.target?.value?.toLowerCase()?.replace(/\s/g, ''))}
            error={errors?.username}
            placeholder="e.g. jdoe"
          />

          {/* Phone field with verification */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Phone Number (E.164 format)
            </label>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={values?.phone || ''}
                  onChange={(e) => handleChange('phone', e?.target?.value)}
                  error={errors?.phone}
                  placeholder="e.g. +12015551234"
                />
              </div>
              {values?.phone && /^\+[1-9]\d{7,14}$/?.test(values?.phone?.trim()) && (
                phoneVerified ? (
                  <div className="flex items-center gap-1.5 mt-2 px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-xs font-medium text-success whitespace-nowrap">
                    <Icon name="ShieldCheck" size={14} />
                    Verified
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVerifyModalOpen(true)}
                    className="mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                  >
                    Verify
                  </button>
                )
              )}
            </div>
            {errors?.phone && <p className="mt-1 text-xs text-destructive">{errors?.phone}</p>}
          </div>

          <Select
            label="Role"
            required
            options={ROLE_OPTIONS}
            value={values?.role || ''}
            onChange={(val) => handleChange('role', val)}
            error={errors?.role}
          />

          <Select
            label="Status"
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Deactivated', label: 'Deactivated' },
            ]}
            value={values?.status || ''}
            onChange={(val) => handleChange('status', val)}
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
            <Button type="submit" variant="default" loading={loading}>Save Changes</Button>
          </div>
        </form>
      </div>
      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        phone={values?.phone}
        userId={user?.id}
        onVerified={() => { setPhoneVerified(true); setVerifyModalOpen(false); }}
      />
    </div>
  );
};

export default EditUserModal;
