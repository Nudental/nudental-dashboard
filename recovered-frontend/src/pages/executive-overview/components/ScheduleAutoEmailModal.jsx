import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const RECIPIENTS = [
  { key: 'ny', label: 'Ny (Regional Manager)', role: 'regional_manager' },
  { key: 'maia', label: 'Maia (Regional Clinical Manager)', role: 'regional_clinical_manager' },
];

const ScheduleAutoEmailModal = ({ isOpen, onClose, month, year }) => {
  const [enabled, setEnabled] = useState(false);
  const [recipients, setRecipients] = useState({ ny: true, maia: true });
  const [recipientEmails, setRecipientEmails] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load existing schedule setting from management_settings
      const { data: setting } = await supabase?.from('management_settings')?.select('setting_value')?.eq('setting_key', 'monthly_executive_email_schedule')?.maybeSingle();

      if (setting?.setting_value) {
        const val = typeof setting?.setting_value === 'string'
          ? JSON.parse(setting?.setting_value)
          : setting?.setting_value;
        setEnabled(val?.enabled ?? false);
        setRecipients(val?.recipients ?? { ny: true, maia: true });
      }

      // Load actual emails for regional roles
      const { data: profiles } = await supabase?.from('user_profiles')?.select('full_name, email, role')?.in('role', ['regional_manager', 'regional_clinical_manager'])?.not('email', 'is', null);

      const emailMap = {};
      (profiles || [])?.forEach((p) => {
        if (p?.role === 'regional_manager') emailMap.ny = p?.email;
        if (p?.role === 'regional_clinical_manager') emailMap.maia = p?.email;
      });
      setRecipientEmails(emailMap);
    } catch (err) {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const settingValue = JSON.stringify({ enabled, recipients });
      const { error: upsertErr } = await supabase?.from('management_settings')?.upsert(
          { setting_key: 'monthly_executive_email_schedule', setting_value: settingValue },
          { onConflict: 'setting_key' }
        );
      if (upsertErr) throw upsertErr;
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1800);
    } catch (err) {
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRecipient = (key) => {
    setRecipients((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Icon name="CalendarClock" size={16} color="#4f46e5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Schedule Auto-Email</h2>
              <p className="text-xs text-muted-foreground">Monthly Executive Summary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader2" size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Auto-Generate & Email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically send the Monthly Executive Summary on the 1st of each month
                  </p>
                </div>
                <button
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    enabled ? 'bg-indigo-600' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Schedule info */}
              {enabled && (
                <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <Icon name="Info" size={14} color="#4f46e5" className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700">
                    The PDF will be auto-generated on the <strong>1st of every month</strong> covering
                    the previous month's data and emailed to the selected recipients.
                  </p>
                </div>
              )}

              {/* Recipients */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Email Recipients
                </p>
                <div className="space-y-2">
                  {RECIPIENTS?.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={recipients?.[key] ?? true}
                        onChange={() => toggleRecipient(key)}
                        className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        {recipientEmails?.[key] && (
                          <p className="text-xs text-muted-foreground truncate">{recipientEmails?.[key]}</p>
                        )}
                        {!recipientEmails?.[key] && (
                          <p className="text-xs text-amber-600 italic">Email not found in system</p>
                        )}
                      </div>
                      {recipients?.[key] && (
                        <Icon name="CheckCircle" size={14} color="#059669" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Current month preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 mb-1">Next Report Preview</p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Report:</span> Monthly Performance Summary —{' '}
                  {MONTH_NAMES?.[month - 1]} {year}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-medium">Delivery:</span> 1st of next month, 8:00 AM
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <Icon name="AlertCircle" size={14} color="#dc2626" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saved ? (
                <><Icon name="CheckCircle" size={14} /> Saved!</>
              ) : saving ? (
                <><Icon name="Loader2" size={14} className="animate-spin" /> Saving…</>
              ) : (
                <><Icon name="Save" size={14} /> Save Schedule</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleAutoEmailModal;
