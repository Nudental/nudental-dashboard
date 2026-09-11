import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

import { useAuth } from '../../contexts/AuthContext';
import { providersService, officesService } from '../../services/managementService';
import { supabase } from '../../lib/supabase';
import ProviderCSVImportModal from './components/ProviderCSVImportModal';
import { useToast } from '../../contexts/ToastContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';


// ─── PROVIDER FORM MODAL ───────────────────────────────────────────────────
const ProviderFormModal = ({ isOpen, onClose, editProvider, offices, onSaved }) => {
  const isEdit = !!editProvider;
  const [values, setValues] = useState({
    name: '',
    provider_type: 'doctor',
    office_id: '',
    specialization: '',
    license_number: '',
    phone: '',
    email: '',
    is_active: true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setValues({
          name: editProvider?.name || '',
          provider_type: editProvider?.provider_type || 'doctor',
          office_id: editProvider?.office_id || '',
          specialization: editProvider?.specialization || '',
          license_number: editProvider?.license_number || '',
          phone: editProvider?.phone || '',
          email: editProvider?.email || '',
          is_active: editProvider?.is_active !== false,
        });
      } else {
        setValues({ name: '', provider_type: 'doctor', office_id: '', specialization: '', license_number: '', phone: '', email: '', is_active: true });
      }
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen, isEdit, editProvider]);

  const handleChange = (field, val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!values?.name?.trim()) errs.name = 'Provider name is required';
    if (!values?.provider_type) errs.provider_type = 'Provider type is required';
    if (values?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(values?.email)) {
      errs.email = 'Please enter a valid email address';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const errs = validate();
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        name: values?.name?.trim(),
        provider_type: values?.provider_type,
        office_id: values?.office_id || null,
        specialization: values?.specialization?.trim() || '',
        license_number: values?.license_number?.trim() || '',
        phone: values?.phone?.trim() || '',
        email: values?.email?.trim() || '',
        is_active: values?.is_active,
      };
      if (isEdit) {
        await providersService?.update(editProvider?.id, payload);
      } else {
        await providersService?.create(payload);
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

  const officeOptions = offices?.map(o => ({ value: o?.id, label: o?.name })) || [];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name={isEdit ? 'UserCog' : 'UserPlus'} size={15} color="var(--color-primary)" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit Provider' : 'Add New Provider'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <Input
            label="Full Name"
            required
            placeholder="e.g. Dr. John Smith"
            value={values?.name}
            onChange={(e) => handleChange('name', e?.target?.value)}
            error={errors?.name}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Provider Type <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: 'doctor', label: 'Doctor', icon: 'Stethoscope' },
                { value: 'hygienist', label: 'Hygienist', icon: 'Heart' },
              ]?.map(opt => (
                <button
                  key={opt?.value}
                  type="button"
                  onClick={() => handleChange('provider_type', opt?.value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    values?.provider_type === opt?.value
                      ? 'border-primary bg-primary/5 text-primary' :'border-border bg-background text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <Icon name={opt?.icon} size={15} />
                  {opt?.label}
                </button>
              ))}
            </div>
            {errors?.provider_type && (
              <p className="mt-1 text-xs text-destructive">{errors?.provider_type}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Office</label>
            <select
              value={values?.office_id}
              onChange={(e) => handleChange('office_id', e?.target?.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground"
            >
              <option value="">— No office assigned —</option>
              {officeOptions?.map(o => (
                <option key={o?.value} value={o?.value}>{o?.label}</option>
              ))}
            </select>
          </div>

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
            error={errors?.email}
          />

          <div className="flex items-center gap-3 pt-1">
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
            <span className="text-sm text-foreground">
              {values?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="default" size="sm" loading={saving}>
              {isEdit ? 'Save Changes' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── DEACTIVATE CONFIRM MODAL ──────────────────────────────────────────────
const DeactivateModal = ({ isOpen, provider, onClose, onConfirm, loading }) => {
  if (!isOpen || !provider) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <Icon name="UserX" size={22} color="var(--color-warning)" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Deactivate Provider</h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to deactivate <strong className="text-foreground">{provider?.name}</strong>?
            They will no longer appear in active provider lists, dropdowns, or daily entry forms.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={onConfirm} loading={loading}>
            Deactivate
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── REMOVE CONFIRM MODAL ──────────────────────────────────────────────────
const RemoveModal = ({ isOpen, provider, onClose, onConfirm, loading }) => {
  if (!isOpen || !provider) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="Trash2" size={22} color="var(--color-destructive)" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Remove Provider</h3>
          <p className="text-sm text-muted-foreground">
            This will permanently remove <strong className="text-foreground">{provider?.name}</strong> from the system.
            Historical records linked to this provider will be preserved. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={onConfirm} loading={loading}>
            Remove Provider
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── BULK CONFIRM MODAL ────────────────────────────────────────────────────
const BulkConfirmModal = ({ isOpen, action, selectedProviders, onClose, onConfirm, loading, linkedDataIds }) => {
  if (!isOpen || !action) return null;

  const count = selectedProviders?.length || 0;
  const linkedCount = linkedDataIds?.length || 0;
  const safeDeleteCount = action === 'delete' ? count - linkedCount : 0;
  const convertedCount = action === 'delete' ? linkedCount : 0;

  const actionConfig = {
    deactivate: {
      icon: 'UserX',
      iconColor: 'var(--color-warning)',
      iconBg: 'bg-warning/10',
      title: 'Deactivate Selected Providers',
      confirmLabel: 'Deactivate Providers',
      confirmVariant: 'default',
      reversible: true,
      description: `This will deactivate ${count} provider${count !== 1 ? 's' : ''}. They will no longer appear in active dropdowns, daily entry forms, or schedules.`,
    },
    inactive: {
      icon: 'EyeOff',
      iconColor: 'var(--color-muted-foreground)',
      iconBg: 'bg-muted',
      title: 'Mark Selected Providers Inactive',
      confirmLabel: 'Mark Inactive',
      confirmVariant: 'default',
      reversible: true,
      description: `This will mark ${count} provider${count !== 1 ? 's' : ''} as inactive. Historical records will be preserved and this action is reversible.`,
    },
    delete: {
      icon: 'Trash2',
      iconColor: 'var(--color-destructive)',
      iconBg: 'bg-destructive/10',
      title: 'Delete Selected Providers',
      confirmLabel: 'Confirm Action',
      confirmVariant: 'destructive',
      reversible: false,
      description: linkedCount > 0
        ? `${safeDeleteCount} provider${safeDeleteCount !== 1 ? 's will be permanently deleted. ' : ' will be permanently deleted. '}${convertedCount} provider${convertedCount !== 1 ? 's have' : ' has'} linked historical data and will be marked inactive instead (soft delete) to preserve records.`
        : `This will permanently delete ${count} provider${count !== 1 ? 's' : ''}. Historical records will be preserved. This action cannot be undone.`,
    },
  };

  const cfg = actionConfig?.[action];
  if (!cfg) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md">
        <div className="p-6">
          <div className="flex flex-col items-center text-center gap-3 mb-5">
            <div className={`w-12 h-12 rounded-full ${cfg?.iconBg} flex items-center justify-center`}>
              <Icon name={cfg?.icon} size={22} color={cfg?.iconColor} />
            </div>
            <h3 className="text-base font-semibold text-foreground">{cfg?.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{cfg?.description}</p>
          </div>

          {/* Summary */}
          <div className="bg-muted/40 rounded-lg p-3 mb-5 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Providers selected</span>
              <span className="font-semibold text-foreground">{count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Action</span>
              <span className="font-medium text-foreground capitalize">{action === 'delete' && linkedCount > 0 ? 'Delete + Soft-deactivate' : action}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reversible</span>
              <span className={`font-medium ${cfg?.reversible || (action === 'delete' && linkedCount > 0) ? 'text-success' : 'text-destructive'}`}>
                {cfg?.reversible ? 'Yes' : (action === 'delete' && linkedCount > 0 ? 'Partially (linked records protected)' : 'No — permanent')}
              </span>
            </div>
            {action === 'delete' && linkedCount > 0 && (
              <>
                <div className="border-t border-border pt-1.5 mt-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Will be deleted</span>
                    <span className="font-medium text-destructive">{safeDeleteCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Converted to inactive (has data)</span>
                    <span className="font-medium text-warning">{convertedCount}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Provider list preview */}
          {count <= 8 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Affected providers:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedProviders?.map(p => (
                  <div key={p?.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                      p?.provider_type === 'doctor' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                    }`}>
                      {p?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-foreground truncate">{p?.name}</span>
                    {action === 'delete' && linkedDataIds?.includes(p?.id) && (
                      <span className="ml-auto text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded flex-shrink-0">→ inactive</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant={cfg?.confirmVariant} size="sm" className="flex-1" onClick={onConfirm} loading={loading}>
              {cfg?.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── BULK RESULTS MODAL ────────────────────────────────────────────────────
const BulkResultsModal = ({ isOpen, results, onClose }) => {
  if (!isOpen || !results) return null;
  const { updated, skipped, skippedReasons, action } = results;
  const total = (updated || 0) + (skipped || 0);
  const allSuccess = skipped === 0;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className={`w-12 h-12 rounded-full ${allSuccess ? 'bg-success/10' : 'bg-warning/10'} flex items-center justify-center`}>
            <Icon name={allSuccess ? 'CheckCircle2' : 'AlertTriangle'} size={22} color={allSuccess ? 'var(--color-success)' : 'var(--color-warning)'} />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {allSuccess ? 'Bulk Action Complete' : 'Action Completed with Warnings'}
          </h3>
        </div>

        <div className="bg-muted/40 rounded-lg p-3 mb-4 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Action applied</span>
            <span className="font-medium text-foreground capitalize">{action}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Providers updated</span>
            <span className="font-semibold text-success">{updated}</span>
          </div>
          {skipped > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Skipped</span>
              <span className="font-semibold text-warning">{skipped}</span>
            </div>
          )}
        </div>

        {skippedReasons?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Skipped reasons:</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {skippedReasons?.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Icon name="Info" size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="default" size="sm" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
};

// ─── BULK ACTION TOOLBAR ───────────────────────────────────────────────────
const BulkActionToolbar = ({ selectedCount, onDeactivate, onMarkInactive, onDelete, onClear, isSuperAdmin, isAdmin }) => {
  if (selectedCount === 0) return null;

  return (
    <>
      {/* Desktop toolbar — top bar (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">{selectedCount}</span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {selectedCount} provider{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {(isSuperAdmin || isAdmin) && (
            <>
              <button
                onClick={onDeactivate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-warning/10 text-warning hover:bg-warning/20 transition-colors border border-warning/20"
              >
                <Icon name="UserX" size={13} />
                Deactivate
              </button>
              <button
                onClick={onMarkInactive}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border"
              >
                <Icon name="EyeOff" size={13} />
                Mark Inactive
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
            >
              <Icon name="Trash2" size={13} />
              Delete
            </button>
          )}
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <Icon name="X" size={13} />
            Clear
          </button>
        </div>
      </div>

      {/* Mobile bottom-sheet toolbar (visible only on mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[200] safe-area-bottom">
        {/* Backdrop blur strip */}
        <div className="bg-card/95 backdrop-blur-md border-t border-border shadow-elevation-3 px-4 pt-3 pb-safe">
          {/* Header row: count + clear */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">{selectedCount}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {selectedCount} provider{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] justify-center rounded-lg bg-muted/60 text-muted-foreground active:bg-muted transition-colors"
              aria-label="Clear selection"
            >
              <Icon name="X" size={16} />
              <span className="text-xs font-medium">Clear</span>
            </button>
          </div>

          {/* Action buttons — stacked grid */}
          <div className={`grid gap-2 pb-3 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(isSuperAdmin || isAdmin) && (
              <>
                <button
                  onClick={onDeactivate}
                  className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 min-h-[64px] rounded-xl bg-warning/10 text-warning active:bg-warning/20 transition-colors border border-warning/20"
                >
                  <Icon name="UserX" size={20} />
                  <span className="text-xs font-semibold leading-tight">Deactivate</span>
                </button>
                <button
                  onClick={onMarkInactive}
                  className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 min-h-[64px] rounded-xl bg-muted text-muted-foreground active:bg-muted/80 transition-colors border border-border"
                >
                  <Icon name="EyeOff" size={20} />
                  <span className="text-xs font-semibold leading-tight">Mark Inactive</span>
                </button>
              </>
            )}
            {isSuperAdmin && (
              <button
                onClick={onDelete}
                className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 min-h-[64px] rounded-xl bg-destructive/10 text-destructive active:bg-destructive/20 transition-colors border border-destructive/20"
              >
                <Icon name="Trash2" size={20} />
                <span className="text-xs font-semibold leading-tight">Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── HELPER: check if provider has linked historical data ──────────────────
const checkProviderHasLinkedData = async (providerId) => {
  try {
    const { count } = await supabase
      ?.from('daily_entries')
      ?.select('id', { count: 'exact', head: true })
      ?.eq('provider_id', providerId);
    return (count || 0) > 0;
  } catch {
    return true; // assume linked if check fails — safer
  }
};

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────
const StaffManagement = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const [providers, setProviders] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Single-item modals
  const [formOpen, setFormOpen] = useState(false);
  const [editProvider, setEditProvider] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Swipe-select state
  const [swipeStartId, setSwipeStartId] = useState(null);
  const [swipeSelectMode, setSwipeSelectMode] = useState(false);
  const [swipeStartY, setSwipeStartY] = useState(null);

  // Bulk action modal state
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [linkedDataIds, setLinkedDataIds] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkResultsOpen, setBulkResultsOpen] = useState(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  // Page-level guard
  if (!permLoading && !authLoading && userProfile && !isAdmin && !hasPermission('admin.providers.view')) {
    return <AccessDenied message="Manage Providers is restricted to administrators." />;
  }

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Staff Management' },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [provData, offData] = await Promise.all([
        providersService?.getAll(),
        officesService?.getAll(),
      ]);
      setProviders(provData || []);
      setOffices(offData || []);
    } catch (err) {
      setError(err?.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterType, filterOffice, filterStatus, searchQuery]);

  // Access guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="ShieldOff" size={28} color="var(--color-destructive)" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-sm text-sm">
            This section is restricted to Admin and Super Admin users only.
          </p>
          <Button variant="default" size="sm" onClick={() => navigate('/executive-overview')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Filtered providers
  const filteredProviders = providers?.filter(p => {
    const matchType = filterType === 'all' || p?.provider_type === filterType;
    const matchOffice = filterOffice === 'all' || p?.office_id === filterOffice;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p?.is_active) ||
      (filterStatus === 'inactive' && !p?.is_active);
    const matchSearch = !searchQuery || p?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    return matchType && matchOffice && matchStatus && matchSearch;
  });

  // Selection helpers
  const allFilteredSelected = filteredProviders?.length > 0 && filteredProviders?.every(p => selectedIds?.has(p?.id));
  const someSelected = selectedIds?.size > 0;
  const selectedProviders = filteredProviders?.filter(p => selectedIds?.has(p?.id));

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selectedIds);
      filteredProviders?.forEach(p => newSet?.delete(p?.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filteredProviders?.forEach(p => newSet?.add(p?.id));
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet?.has(id)) {
      newSet?.delete(id);
    } else {
      newSet?.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  // Swipe-select handlers for mobile cards
  const handleCardTouchStart = (e, providerId) => {
    const touch = e?.touches?.[0];
    setSwipeStartY(touch?.clientY || null);
    setSwipeStartId(providerId);
    setSwipeSelectMode(false);
  };

  const handleCardTouchMove = (e, providerId) => {
    if (!swipeStartId || swipeStartId !== providerId) return;
    const touch = e?.touches?.[0];
    const deltaY = Math.abs((touch?.clientY || 0) - (swipeStartY || 0));
    // Activate swipe-select mode after 10px vertical movement
    if (deltaY > 10 && !swipeSelectMode) {
      setSwipeSelectMode(true);
      // Select the card where swipe started
      const newSet = new Set(selectedIds);
      newSet?.add(providerId);
      setSelectedIds(newSet);
    }
  };

  const handleCardTouchEnd = () => {
    setSwipeStartId(null);
    setSwipeStartY(null);
    setSwipeSelectMode(false);
  };

  // Open bulk confirm — check linked data for delete
  const handleBulkActionClick = async (action) => {
    if (!isAdmin) return;
    if (action === 'delete' && !isSuperAdmin) return;

    setBulkAction(action);

    if (action === 'delete') {
      setBulkLoading(true);
      try {
        const linkedChecks = await Promise.all(
          selectedProviders?.map(async (p) => {
            const hasData = await checkProviderHasLinkedData(p?.id);
            return hasData ? p?.id : null;
          })
        );
        setLinkedDataIds(linkedChecks?.filter(Boolean));
      } catch {
        setLinkedDataIds([]);
      } finally {
        setBulkLoading(false);
      }
    } else {
      setLinkedDataIds([]);
    }

    setBulkConfirmOpen(true);
  };

  // Execute bulk action
  const handleBulkConfirm = async () => {
    if (!bulkAction || selectedProviders?.length === 0) return;
    setBulkLoading(true);

    let updated = 0;
    let skipped = 0;
    const skippedReasons = [];

    try {
      for (const provider of selectedProviders) {
        try {
          if (bulkAction === 'deactivate') {
            await providersService?.toggleActive(provider?.id, false);
            updated++;
          } else if (bulkAction === 'inactive') {
            await providersService?.update(provider?.id, { is_active: false });
            updated++;
          } else if (bulkAction === 'delete') {
            const hasLinked = linkedDataIds?.includes(provider?.id);
            if (hasLinked) {
              // Soft-delete: provider has historical data — deactivate to preserve records
              await providersService?.toggleActive(provider?.id, false);
              updated++;
            } else {
              // Hard-delete: no linked data — permanently remove from database
              await providersService?.hardDelete(provider?.id);
              updated++;
            }
          }
        } catch (err) {
          skipped++;
          skippedReasons?.push(`${provider?.name}: ${err?.message || 'Unknown error'}`);
          console.error(`[BulkDelete] Failed for provider ${provider?.name} (${provider?.id}):`, err);
        }
      }

      setBulkConfirmOpen(false);
      setBulkAction(null);
      setSelectedIds(new Set());
      setLinkedDataIds([]);

      // Show toast feedback
      if (skipped === 0) {
        toastSuccess(
          `${bulkAction === 'delete' ? 'Providers Deleted' : 'Bulk Action Complete'}`,
          `${updated} provider${updated !== 1 ? 's' : ''} ${bulkAction === 'delete' ? 'deleted' : bulkAction === 'deactivate' ? 'deactivated' : 'marked inactive'} successfully.`
        );
      } else if (updated > 0) {
        toastWarning(
          'Action Completed with Warnings',
          `${updated} succeeded, ${skipped} failed. See details below.`
        );
      } else {
        toastError(
          'Bulk Action Failed',
          `All ${skipped} provider${skipped !== 1 ? 's' : ''} failed. ${skippedReasons?.[0] || 'Check console for details.'}`
        );
      }

      setBulkResults({ updated, skipped, skippedReasons, action: bulkAction });
      setBulkResultsOpen(true);

      await loadData();
    } catch (err) {
      console.error('[BulkDelete] Unexpected error during bulk action:', err);
      toastError('Bulk Action Failed', err?.message || 'An unexpected error occurred.');
      setError(err?.message || 'Bulk action failed');
      setBulkConfirmOpen(false);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditProvider(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (provider) => {
    setEditProvider(provider);
    setFormOpen(true);
  };

  const handleToggleActive = async (provider) => {
    setActionLoading(true);
    try {
      await providersService?.toggleActive(provider?.id, !provider?.is_active);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to update provider status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      await providersService?.toggleActive(deactivateTarget?.id, false);
      setDeactivateTarget(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate provider');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await providersService?.delete(removeTarget?.id);
      setRemoveTarget(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Failed to remove provider');
    } finally {
      setActionLoading(false);
    }
  };

  const officeFilterOptions = [
    { value: 'all', label: 'All Offices' },
    ...offices?.map(o => ({ value: o?.id, label: o?.name })),
  ];

  const doctorCount = providers?.filter(p => p?.provider_type === 'doctor')?.length;
  const hygienistCount = providers?.filter(p => p?.provider_type === 'hygienist')?.length;
  const activeCount = providers?.filter(p => p?.is_active)?.length;
  const inactiveCount = providers?.filter(p => !p?.is_active)?.length;

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        {/* Add bottom padding on mobile when bulk toolbar is visible */}
        <div className={`px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl mx-auto ${someSelected ? 'pb-40 md:pb-8' : ''}`}>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="Stethoscope" size={20} color="var(--color-primary)" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-foreground">Manage Providers</h1>
                <p className="text-sm text-muted-foreground">
                  View, add, edit, and manage provider status across all offices
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Upload"
                iconPosition="left"
                onClick={() => setImportOpen(true)}
              >
                Import Providers
              </Button>
              <Button
                variant="default"
                size="sm"
                iconName="UserPlus"
                iconPosition="left"
                onClick={handleOpenAdd}
              >
                Add Provider
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Providers', value: providers?.length, icon: 'Users', color: 'primary' },
              { label: 'Doctors', value: doctorCount, icon: 'Stethoscope', color: 'accent' },
              { label: 'Hygienists', value: hygienistCount, icon: 'Heart', color: 'success' },
              { label: 'Active', value: activeCount, icon: 'CheckCircle', color: 'success' },
            ]?.map(card => (
              <div key={card?.label} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{card?.label}</span>
                  <div className={`w-7 h-7 rounded-lg bg-${card?.color}/10 flex items-center justify-center`}>
                    <Icon name={card?.icon} size={14} color={`var(--color-${card?.color})`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{card?.value}</p>
              </div>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-muted-foreground hover:text-foreground">
                <Icon name="X" size={14} />
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Icon name="Search" size={15} color="var(--color-muted-foreground)" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e?.target?.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <Icon name="X" size={13} />
                  </button>
                )}
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-md p-1">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'doctor', label: 'Doctors' },
                  { value: 'hygienist', label: 'Hygienists' },
                ]?.map(opt => (
                  <button
                    key={opt?.value}
                    onClick={() => setFilterType(opt?.value)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterType === opt?.value
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt?.label}
                  </button>
                ))}
              </div>

              {/* Office Filter */}
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e?.target?.value)}
                className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground min-w-[150px]"
              >
                {officeFilterOptions?.map(o => (
                  <option key={o?.value} value={o?.value}>{o?.label}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e?.target?.value)}
                className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Toolbar (desktop top bar + mobile bottom sheet) */}
          <BulkActionToolbar
            selectedCount={selectedIds?.size}
            onDeactivate={() => handleBulkActionClick('deactivate')}
            onMarkInactive={() => handleBulkActionClick('inactive')}
            onDelete={() => handleBulkActionClick('delete')}
            onClear={handleClearSelection}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
          />

          {/* Providers Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading providers...</span>
              </div>
            ) : filteredProviders?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Icon name="Users" size={22} color="var(--color-muted-foreground)" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterType !== 'all' || filterOffice !== 'all' || filterStatus !== 'all' ? 'No providers match your filters' : 'No providers found'}
                </p>
                {!searchQuery && filterType === 'all' && filterOffice === 'all' && filterStatus === 'all' && (
                  <Button variant="outline" size="sm" iconName="UserPlus" iconPosition="left" onClick={handleOpenAdd}>
                    Add First Provider
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {/* Select All Checkbox */}
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                            title={allFilteredSelected ? 'Deselect all' : 'Select all'}
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Office</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specialization</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">License #</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProviders?.map(provider => {
                        const isSelected = selectedIds?.has(provider?.id);
                        return (
                          <tr
                            key={provider?.id}
                            className={`hover:bg-muted/20 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            {/* Row Checkbox */}
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectOne(provider?.id)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer flex-shrink-0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                                  provider?.provider_type === 'doctor'
                                    ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                                }`}>
                                  {provider?.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">{provider?.name}</span>
                                  {provider?.email && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{provider?.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                provider?.provider_type === 'doctor'
                                  ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                              }`}>
                                <Icon name={provider?.provider_type === 'doctor' ? 'Stethoscope' : 'Heart'} size={11} />
                                {provider?.provider_type === 'doctor' ? 'Doctor' : 'Hygienist'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">
                              {provider?.officeName || <span className="text-muted-foreground/50 italic">Unassigned</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">
                              {provider?.specialization || <span className="text-muted-foreground/50 italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm text-foreground">
                                  {provider?.email ? (
                                    <a href={`mailto:${provider?.email}`} className="hover:underline text-foreground" onClick={e => e?.stopPropagation()}>
                                      {provider?.email}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground/50 italic">—</span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {provider?.phone || <span className="text-muted-foreground/50 italic">—</span>}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {provider?.license_number || <span className="text-muted-foreground/50 italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                provider?.is_active
                                  ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${provider?.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
                                {provider?.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(provider)}
                                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                  title="Edit provider"
                                >
                                  <Icon name="Pencil" size={14} />
                                </button>
                                <button
                                  onClick={() => handleToggleActive(provider)}
                                  disabled={actionLoading}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    provider?.is_active
                                      ? 'hover:bg-warning/10 text-muted-foreground hover:text-warning'
                                      : 'hover:bg-success/10 text-muted-foreground hover:text-success'
                                  }`}
                                  title={provider?.is_active ? 'Deactivate provider' : 'Activate provider'}
                                >
                                  <Icon name={provider?.is_active ? 'UserX' : 'UserCheck'} size={14} />
                                </button>
                                <button
                                  onClick={() => setRemoveTarget(provider)}
                                  disabled={actionLoading}
                                  className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                  title="Remove provider"
                                >
                                  <Icon name="Trash2" size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-border">
                  {/* Mobile Select All — larger touch target */}
                  {filteredProviders?.length > 1 && (
                    <button
                      onClick={handleSelectAll}
                      className="w-full px-4 py-3 flex items-center gap-3 bg-muted/20 active:bg-muted/40 transition-colors text-left"
                    >
                      {/* Large touch-target checkbox wrapper */}
                      <span className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl flex-shrink-0">
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          allFilteredSelected
                            ? 'bg-primary border-primary' :'border-border bg-background'
                        }`}>
                          {allFilteredSelected && <Icon name="Check" size={12} color="white" />}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">
                        {allFilteredSelected ? 'Deselect all' : `Select all ${filteredProviders?.length} providers`}
                      </span>
                      {someSelected && !allFilteredSelected && (
                        <span className="ml-auto text-xs text-primary font-medium">
                          {selectedIds?.size} selected
                        </span>
                      )}
                    </button>
                  )}

                  {/* Mobile provider cards with swipe-select */}
                  {filteredProviders?.map(provider => {
                    const isSelected = selectedIds?.has(provider?.id);
                    return (
                      <div
                        key={provider?.id}
                        className={`relative flex items-center gap-0 transition-colors ${isSelected ? 'bg-primary/5' : 'bg-card'}`}
                        onTouchStart={(e) => handleCardTouchStart(e, provider?.id)}
                        onTouchMove={(e) => handleCardTouchMove(e, provider?.id)}
                        onTouchEnd={handleCardTouchEnd}
                      >
                        {/* Large touch-target checkbox area */}
                        <button
                          onClick={() => handleSelectOne(provider?.id)}
                          className="flex items-center justify-center w-14 h-full min-h-[72px] flex-shrink-0 active:bg-primary/10 transition-colors"
                          aria-label={isSelected ? `Deselect ${provider?.name}` : `Select ${provider?.name}`}
                        >
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary scale-110' :'border-border bg-background'
                          }`}>
                            {isSelected && <Icon name="Check" size={12} color="white" />}
                          </span>
                        </button>
                        {/* Provider info */}
                        <div className="flex flex-1 items-center gap-3 py-3 pr-2 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                            provider?.provider_type === 'doctor'
                              ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                          }`}>
                            {provider?.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{provider?.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                provider?.provider_type === 'doctor'
                                  ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                              }`}>
                                {provider?.provider_type === 'doctor' ? 'Doctor' : 'Hygienist'}
                              </span>
                              {provider?.officeName && (
                                <span className="text-xs text-muted-foreground">{provider?.officeName}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                provider?.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                              }`}>
                                {provider?.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {provider?.specialization && (
                              <p className="text-xs text-muted-foreground mt-0.5">{provider?.specialization}</p>
                            )}
                            {(provider?.email || provider?.phone || provider?.license_number) && (
                              <div className="flex flex-col gap-0.5 mt-1">
                                {provider?.email && (
                                  <p className="text-xs text-muted-foreground truncate">{provider?.email}</p>
                                )}
                                {provider?.phone && (
                                  <p className="text-xs text-muted-foreground">{provider?.phone}</p>
                                )}
                                {provider?.license_number && (
                                  <p className="text-xs text-muted-foreground">Lic: {provider?.license_number}</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action buttons — larger touch targets on mobile */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleOpenEdit(provider)}
                              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
                              aria-label="Edit provider"
                            >
                              <Icon name="Pencil" size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(provider)}
                              disabled={actionLoading}
                              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                                provider?.is_active
                                  ? 'hover:bg-warning/10 active:bg-warning/20 text-muted-foreground hover:text-warning'
                                  : 'hover:bg-success/10 active:bg-success/20 text-muted-foreground hover:text-success'
                              }`}
                              aria-label={provider?.is_active ? 'Deactivate provider' : 'Activate provider'}
                            >
                              <Icon name={provider?.is_active ? 'UserX' : 'UserCheck'} size={16} />
                            </button>
                            <button
                              onClick={() => setRemoveTarget(provider)}
                              disabled={actionLoading}
                              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-destructive/10 active:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                              aria-label="Remove provider"
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer count */}
                <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {someSelected
                      ? `${selectedIds?.size} selected · Showing ${filteredProviders?.length} of ${providers?.length} providers`
                      : `Showing ${filteredProviders?.length} of ${providers?.length} providers`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activeCount} active · {inactiveCount} inactive
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      {/* Single-item Modals */}
      <ProviderFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditProvider(null); }}
        editProvider={editProvider}
        offices={offices}
        onSaved={loadData}
      />
      <DeactivateModal
        isOpen={!!deactivateTarget}
        provider={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        loading={actionLoading}
      />
      <RemoveModal
        isOpen={!!removeTarget}
        provider={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={actionLoading}
      />
      <ProviderCSVImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        offices={offices}
        onImportComplete={loadData}
      />
      {/* Bulk Action Modals */}
      <BulkConfirmModal
        isOpen={bulkConfirmOpen}
        action={bulkAction}
        selectedProviders={selectedProviders}
        onClose={() => { setBulkConfirmOpen(false); setBulkAction(null); setLinkedDataIds([]); }}
        onConfirm={handleBulkConfirm}
        loading={bulkLoading}
        linkedDataIds={linkedDataIds}
      />
      <BulkResultsModal
        isOpen={bulkResultsOpen}
        results={bulkResults}
        onClose={() => { setBulkResultsOpen(false); setBulkResults(null); }}
      />
    </div>
  );
};

export default StaffManagement;
