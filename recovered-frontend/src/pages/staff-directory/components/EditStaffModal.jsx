import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const ROLE_CATEGORIES = [
  'Doctor/Dentist',
  'Hygienist',
  'Dental Assistant',
  'Front Office',
  'Management/Admin',
  'Contractor',
];

const LOCATIONS = [
  'Barnegat',
  'Brick',
  'Eatontown',
  'Staten Island',
  'Management',
  'Construction',
];

const WORKER_TYPES = ['Employee', 'Contractor'];

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-foreground">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground";
const selectCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground";

const EditStaffModal = ({ member, onClose, onSave }) => {
  const [form, setForm] = useState({
    full_name: '',
    directory_display_name: '',
    contact_list_employee_name: '',
    office_location_normalized: '',
    job_title: '',
    role_category: '',
    worker_type: '',
    preferred_email: '',
    work_email: '',
    personal_email: '',
    phone: '',
    date_of_birth: '',
    notes: '',
    is_active: true,
    employee_pronouns: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member) {
      setForm({
        full_name: member?.full_name || '',
        directory_display_name: member?.directory_display_name || '',
        contact_list_employee_name: member?.contact_list_employee_name || '',
        office_location_normalized: member?.office_location_normalized || '',
        job_title: member?.job_title || '',
        role_category: member?.role_category || '',
        worker_type: member?.worker_type || '',
        preferred_email: member?.preferred_email || '',
        work_email: member?.work_email || '',
        personal_email: member?.personal_email || '',
        phone: member?.phone || '',
        date_of_birth: member?.date_of_birth || '',
        notes: member?.notes || '',
        is_active: member?.is_active !== undefined ? member?.is_active : true,
        employee_pronouns: member?.employee_pronouns || '',
      });
    }
  }, [member]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    if (!form?.full_name?.trim()) return 'Full name is required.';
    if (!form?.office_location_normalized?.trim()) return 'Office location is required.';
    if (form?.preferred_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(form?.preferred_email?.trim())) {
      return 'Preferred email is not a valid email address.';
    }
    if (form?.work_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(form?.work_email?.trim())) {
      return 'Work email is not a valid email address.';
    }
    if (form?.personal_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(form?.personal_email?.trim())) {
      return 'Personal email is not a valid email address.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(member?.id, form);
      onClose();
    } catch (ex) {
      setError(ex?.message || 'Failed to update staff member.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = member?.directory_display_name || member?.full_name || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Icon name="Pencil" size={16} color="var(--color-amber-600, #d97706)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit Staff Member</h2>
              <p className="text-xs text-muted-foreground">{displayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={14} color="var(--color-destructive)" className="flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Identity */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={form?.full_name} onChange={e => set('full_name', e?.target?.value)} placeholder="Full legal name" />
              </Field>
              <Field label="Display Name">
                <input className={inputCls} value={form?.directory_display_name} onChange={e => set('directory_display_name', e?.target?.value)} placeholder="Preferred display name" />
              </Field>
              <Field label="Roster Name (Gusto)">
                <input className={inputCls} value={form?.contact_list_employee_name} onChange={e => set('contact_list_employee_name', e?.target?.value)} placeholder="Name as it appears in Gusto" />
              </Field>
              <Field label="Pronouns">
                <input className={inputCls} value={form?.employee_pronouns} onChange={e => set('employee_pronouns', e?.target?.value)} placeholder="e.g. she/her" />
              </Field>
            </div>
          </div>

          {/* Role & Location */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role & Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Office Location">
                <select className={selectCls} value={form?.office_location_normalized} onChange={e => set('office_location_normalized', e?.target?.value)}>
                  <option value="">Select location…</option>
                  {LOCATIONS?.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Job Title">
                <input className={inputCls} value={form?.job_title} onChange={e => set('job_title', e?.target?.value)} placeholder="e.g. Dental Hygienist" />
              </Field>
              <Field label="Role Category">
                <select className={selectCls} value={form?.role_category} onChange={e => set('role_category', e?.target?.value)}>
                  <option value="">Select role…</option>
                  {ROLE_CATEGORIES?.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Worker Type">
                <select className={selectCls} value={form?.worker_type} onChange={e => set('worker_type', e?.target?.value)}>
                  <option value="">Select type…</option>
                  {WORKER_TYPES?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Preferred Email">
                <input type="email" className={inputCls} value={form?.preferred_email} onChange={e => set('preferred_email', e?.target?.value)} placeholder="preferred@example.com" />
              </Field>
              <Field label="Work Email">
                <input type="email" className={inputCls} value={form?.work_email} onChange={e => set('work_email', e?.target?.value)} placeholder="work@nudental.com" />
              </Field>
              <Field label="Personal Email">
                <input type="email" className={inputCls} value={form?.personal_email} onChange={e => set('personal_email', e?.target?.value)} placeholder="personal@example.com" />
              </Field>
              <Field label="Phone">
                <input type="tel" className={inputCls} value={form?.phone} onChange={e => set('phone', e?.target?.value)} placeholder="(555) 000-0000" />
              </Field>
              <Field label="Date of Birth">
                <input type="date" className={inputCls} value={form?.date_of_birth} onChange={e => set('date_of_birth', e?.target?.value)} />
              </Field>
            </div>
          </div>

          {/* Other */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Other</p>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Notes">
                <textarea className={`${inputCls} resize-none`} rows={2} value={form?.notes} onChange={e => set('notes', e?.target?.value)} placeholder="Internal notes…" />
              </Field>
              <Field label="Status">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form?.is_active} onChange={e => set('is_active', e?.target?.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30" />
                  <span className="text-sm text-foreground">Active</span>
                </label>
              </Field>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <Icon name="Check" size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditStaffModal;
