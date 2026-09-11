import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

// ─── Session-level signed URL cache ──────────────────────────────────────
// Keyed by storage path, value: { signedUrl, expiresAt }
const signedUrlCache = {};

/**
 * Determine if a value is a raw storage object key/path (not a full URL).
 * Returns true when the value does NOT start with http/https.
 */
const isStoragePath = (value) => {
  if (!value) return false;
  return !value?.startsWith('http://') && !value?.startsWith('https://');
};

/**
 * Resolve a profile_photo_url to a usable src:
 *  - If it's a storage path → generate/return cached signed URL
 *  - If it's already a full URL → return as-is
 *  - Otherwise → return null
 */
const resolvePhotoUrl = async (rawValue) => {
  if (!rawValue) return null;

  // Already a full URL — use directly
  if (!isStoragePath(rawValue)) return rawValue;

  const path = rawValue;
  const now = Date.now();

  // Return cached URL if still valid (with 5-min buffer before expiry)
  const cached = signedUrlCache?.[path];
  if (cached && cached?.expiresAt > now + 5 * 60 * 1000) {
    return cached?.signedUrl;
  }

  try {
    const { data, error } = await supabase?.storage?.from('profile-photos')?.createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.warn('[UserTable] Failed to create signed URL for path:', path, error?.message);
      return null;
    }

    signedUrlCache[path] = {
      signedUrl: data?.signedUrl,
      expiresAt: now + 3600 * 1000,
    };
    return data?.signedUrl;
  } catch (err) {
    console.warn('[UserTable] Signed URL exception:', err?.message);
    return null;
  }
};

// ─── Avatar component with signed URL resolution + onError fallback ───────
const UserAvatar = ({ user }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgError, setImgError] = useState(false);
  const mountedRef = useRef(true);

  const initials = user?.full_name?.split(' ')?.map(n => n?.[0])?.join('')?.substring(0, 2) || 'U';

  useEffect(() => {
    mountedRef.current = true;
    setImgError(false);

    if (!user?.profile_photo_url) {
      setImgSrc(null);
      return;
    }

    resolvePhotoUrl(user?.profile_photo_url)?.then((resolved) => {
      if (mountedRef?.current) {
        setImgSrc(resolved);
      }
    });

    return () => { mountedRef.current = false; };
  }, [user?.profile_photo_url]);

  const showImage = imgSrc && !imgError;

  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
      {showImage ? (
        <img
          src={imgSrc}
          alt={user?.full_name || 'User avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-xs font-semibold text-primary">{initials}</span>
      )}
    </div>
  );
};

// ─── Existing constants (unchanged) ──────────────────────────────────────
const ROLE_LABELS = {
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
  office_manager: 'Office Manager',
  treatment_coordinator: 'Treatment Coordinator',
  rda: 'RDA',
  clinical_manager: 'Clinical Manager',
  dental_assistant: 'Dental Assistant',
  front_desk: 'Front Desk',
  doctor: 'Doctor',
  hygienist: 'Hygienist',
  regional_manager: 'Regional Manager',
  regional_clinical_manager: 'Regional Clinical Mgr',
  insurance_verifier: 'Insurance Verifier',
  marketing: 'Marketing',
};

const ROLE_COLORS = {
  staff: 'bg-muted text-muted-foreground',
  admin: 'bg-primary/10 text-primary',
  super_admin: 'bg-warning/10 text-warning',
  office_manager: 'bg-blue-100 text-blue-700',
  treatment_coordinator: 'bg-purple-100 text-purple-700',
  rda: 'bg-teal-100 text-teal-700',
  clinical_manager: 'bg-orange-100 text-orange-700',
  dental_assistant: 'bg-pink-100 text-pink-700',
  front_desk: 'bg-cyan-100 text-cyan-700',
  doctor: 'bg-green-100 text-green-700',
  hygienist: 'bg-emerald-100 text-emerald-700',
  regional_manager: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300',
  regional_clinical_manager: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300',
  insurance_verifier: 'bg-sky-100 text-sky-700',
  marketing: 'bg-rose-100 text-rose-700',
};

const REGIONAL_ROLES = new Set(['regional_manager', 'regional_clinical_manager', 'super_admin', 'admin']);

const STATUS_CONFIG = {
  Active: { color: 'bg-success/10 text-success', icon: 'CheckCircle', label: 'Active' },
  Pending: { color: 'bg-amber-100 text-amber-700', icon: 'Clock', label: 'Not Activated' },
  Inactive: { color: 'bg-amber-100 text-amber-700', icon: 'Clock', label: 'Not Activated' },
  Deactivated: { color: 'bg-muted text-muted-foreground', icon: 'XCircle', label: 'Deactivated' },
};

const UserTable = ({
  users,
  loading,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onEdit,
  onApprove,
  onDeactivate,
  onToggleActive,
  actionLoadingId,
  sortField,
  sortDir,
  onSort,
  canManageAll,
}) => {
  const allSelected = users?.length > 0 && users?.every(u => selectedIds?.includes(u?.id));
  const someSelected = users?.some(u => selectedIds?.includes(u?.id)) && !allSelected;

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <Icon name="ChevronsUpDown" size={12} color="var(--color-muted-foreground)" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUp" size={12} color="var(--color-primary)" />
      : <Icon name="ChevronDown" size={12} color="var(--color-primary)" />;
  };

  const SortableHeader = ({ field, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  if (!users?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon name="Users" size={24} color="var(--color-muted-foreground)" />
        </div>
        <p className="text-base font-medium text-foreground mb-1">No users found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your filters or invite a new user.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => onSelectAll(e?.target?.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
              />
            </th>
            <th className="px-4 py-3 w-10" />
            <SortableHeader field="full_name">Name</SortableHeader>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</th>
            <SortableHeader field="email">Email / Phone</SortableHeader>
            <SortableHeader field="role">Role</SortableHeader>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Offices</th>
            <SortableHeader field="status">Status</SortableHeader>
            <SortableHeader field="updated_at">Last Updated</SortableHeader>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users?.map(user => {
            const isSelected = selectedIds?.includes(user?.id);
            const statusCfg = STATUS_CONFIG?.[user?.status] || STATUS_CONFIG?.Pending;
            const isLoading = actionLoadingId === user?.id;
            const isRegional = REGIONAL_ROLES?.has(user?.role);

            return (
              <tr
                key={user?.id}
                className={`transition-colors hover:bg-muted/30 ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                {/* Checkbox */}
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectRow(user?.id, e?.target?.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                </td>
                {/* Avatar — signed URL + onError fallback to initials */}
                <td className="px-4 py-3">
                  <UserAvatar user={user} />
                </td>
                {/* Name */}
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{user?.full_name || '—'}</p>
                    {user?.job_title && <p className="text-xs text-muted-foreground">{user?.job_title}</p>}
                  </div>
                </td>
                {/* Username */}
                <td className="px-4 py-3">
                  {user?.username ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                      <Icon name="AtSign" size={11} color="var(--color-muted-foreground)" />
                      {user?.username}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">not set</span>
                  )}
                </td>
                {/* Email + Phone (stacked) */}
                <td className="px-4 py-3">
                  <p className="text-sm text-foreground">{user?.email || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Icon name="Phone" size={10} color="var(--color-muted-foreground)" />
                    {user?.phone ? user?.phone : '—'}
                  </p>
                </td>
                {/* Role — color-coded with Regional scope indicator */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      ROLE_COLORS?.[user?.role] || 'bg-muted text-muted-foreground'
                    }`}>
                      {isRegional && <Icon name="Globe" size={9} />}
                      {ROLE_LABELS?.[user?.role] || user?.role || '—'}
                    </span>
                    {isRegional && user?.role !== 'super_admin' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">
                        <Icon name="MapPin" size={8} />
                        Regional Scope
                      </span>
                    )}
                  </div>
                </td>
                {/* Offices */}
                <td className="px-4 py-3">
                  {user?.hasAllOffices ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                      <Icon name="Globe" size={10} />
                      All Offices
                    </span>
                  ) : user?.assignedOfficeNames ? (
                    <span className="text-sm text-foreground">{user?.assignedOfficeNames}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                {/* Status + Toggle */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg?.color}`}>
                      <Icon name={statusCfg?.icon} size={10} />
                      {statusCfg?.label || user?.status || 'Not Activated'}
                    </span>
                    {/* Active Toggle */}
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onToggleActive(user?.id, !user?.is_active)}
                      title={user?.is_active ? 'Deactivate' : 'Activate'}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        user?.is_active ? 'bg-success' : 'bg-border'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        user?.is_active ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </td>
                {/* Last Updated */}
                <td className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {user?.updated_at
                      ? new Date(user?.updated_at)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(user)}
                      title="Edit user"
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>

                    {canManageAll && user?.status !== 'Active' && (
                      <button
                        onClick={() => onApprove(user?.id)}
                        disabled={isLoading}
                        title="Approve user"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Icon name="Loader2" size={11} className="animate-spin" /> : <Icon name="CheckCircle" size={11} />}
                        Approve
                      </button>
                    )}

                    {canManageAll && user?.status === 'Active' && (
                      <button
                        onClick={() => onDeactivate(user?.id)}
                        disabled={isLoading}
                        title="Deactivate user"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Icon name="Loader2" size={11} className="animate-spin" /> : <Icon name="XCircle" size={11} />}
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
