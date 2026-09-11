import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';
import { alertRulesService, suspiciousActivityService } from '../../services/alertRulesService';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── Constants ────────────────────────────────────────────────────────────────

// Rule types that are actively monitored by the suspiciousActivityDetector
const MONITORED_RULE_TYPES = ['mass_deletion', 'after_hours', 'bulk_export', 'rapid_role_change'];

const RULE_TYPE_META = {
  mass_deletion:     {
    label: 'Mass Deletion',
    icon: 'Trash2',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    desc: 'Detects when a user deletes many records in a short time window',
    sourceNote: 'Source: audit_logs DELETE / SOFT_DELETE actions',
  },
  after_hours:       {
    label: 'After-Hours Activity',
    icon: 'Moon',
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    desc: 'Detects system access outside configured business hours',
    sourceNote: 'Source: audit_logs events outside configured business hours',
  },
  bulk_export:       {
    label: 'Bulk Export',
    icon: 'Download',
    color: 'bg-warning/10 text-warning border-warning/20',
    desc: 'Detects multiple data export actions in a short time window',
    sourceNote: 'Source: audit_logs EXPORT actions',
  },
  failed_login:      {
    label: 'Failed Login',
    icon: 'ShieldAlert',
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    desc: 'Detects repeated failed login attempts from any user',
    sourceNote: 'Not monitored: failed login events are not stored in public audit_logs.',
    notMonitored: true,
  },
  rapid_role_change: {
    label: 'Rapid Role Changes',
    icon: 'UserCog',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    desc: 'Detects rapid changes to user roles, a sign of privilege escalation',
    sourceNote: 'Source: audit_logs user_profiles role updates',
  },
};

const SEVERITY_META = {
  low:      { label: 'Low',      color: 'bg-muted text-muted-foreground border-border' },
  medium:   { label: 'Medium',   color: 'bg-warning/10 text-warning border-warning/20' },
  high:     { label: 'High',     color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  critical: { label: 'Critical', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const DEFAULT_RULE = {
  name: '',
  rule_type: 'mass_deletion',
  description: '',
  enabled: true,
  threshold_count: 5,
  threshold_minutes: 10,
  business_start_hour: 8,
  business_end_hour: 18,
  notify_email: true,
  notify_in_app: true,
  recipient_emails: [],
};

const formatTs = (ts) => {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d, yyyy h:mm a'); } catch { return ts; }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const meta = SEVERITY_META?.[severity] || SEVERITY_META?.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meta?.color}`}>
      {meta?.label}
    </span>
  );
};

const RuleTypeBadge = ({ ruleType }) => {
  const meta = RULE_TYPE_META?.[ruleType] || { label: ruleType, icon: 'Bell', color: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta?.color}`}>
      <Icon name={meta?.icon} size={11} />
      {meta?.notMonitored ? 'Failed Login — Not Monitored' : meta?.label}
    </span>
  );
};

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

const RuleFormModal = ({ rule, onSave, onClose }) => {
  const [form, setForm] = useState(rule || DEFAULT_RULE);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const addEmail = () => {
    const email = emailInput?.trim();
    if (!email || !email?.includes('@')) return;
    if (!form?.recipient_emails?.includes(email)) {
      set('recipient_emails', [...(form?.recipient_emails || []), email]);
    }
    setEmailInput('');
  };

  const removeEmail = (email) => {
    set('recipient_emails', form?.recipient_emails?.filter(e => e !== email));
  };

  const handleSave = async () => {
    if (!form?.name?.trim()) { setError('Rule name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const isAfterHours = form?.rule_type === 'after_hours';
  const isFailedLogin = form?.rule_type === 'failed_login';
  const selectedMeta = RULE_TYPE_META?.[form?.rule_type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {rule?.id ? 'Edit Alert Rule' : 'New Alert Rule'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={18} color="var(--color-muted-foreground)" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Rule Name *</label>
            <input
              type="text"
              value={form?.name}
              onChange={e => set('name', e?.target?.value)}
              placeholder="e.g. Mass Deletion Alert"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            />
          </div>

          {/* Rule Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Alert Type</label>
            <select
              value={form?.rule_type}
              onChange={e => set('rule_type', e?.target?.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              {Object.entries(RULE_TYPE_META)?.map(([key, meta]) => (
                <option key={key} value={key} disabled={meta?.notMonitored}>
                  {meta?.notMonitored ? `${meta?.label} — Not monitored yet` : meta?.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{selectedMeta?.desc}</p>
            {/* Source note for monitored types */}
            {!isFailedLogin && selectedMeta?.sourceNote && (
              <p className="text-xs text-primary/70 mt-1 flex items-center gap-1">
                <Icon name="Database" size={10} />
                {selectedMeta?.sourceNote}
              </p>
            )}
            {/* Warning for failed_login */}
            {isFailedLogin && (
              <div className="mt-2 flex items-start gap-2 p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <Icon name="AlertTriangle" size={13} color="rgb(234 88 12)" className="flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  <strong>Not currently monitored.</strong> Failed login monitoring is not active because failed login events are not stored in public audit_logs. This rule type will not trigger.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              value={form?.description}
              onChange={e => set('description', e?.target?.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground resize-none"
            />
          </div>

          {/* Thresholds */}
          {!isAfterHours && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Threshold Count</label>
                <input
                  type="number"
                  min={1}
                  value={form?.threshold_count}
                  onChange={e => set('threshold_count', parseInt(e?.target?.value) || 1)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Events to trigger</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Time Window (min)</label>
                <input
                  type="number"
                  min={1}
                  value={form?.threshold_minutes}
                  onChange={e => set('threshold_minutes', parseInt(e?.target?.value) || 1)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Rolling window</p>
              </div>
            </div>
          )}

          {/* After-hours config */}
          {isAfterHours && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Business Start (hour)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form?.business_start_hour}
                  onChange={e => set('business_start_hour', parseInt(e?.target?.value) || 8)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">0–23 (e.g. 8 = 8am)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Business End (hour)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form?.business_end_hour}
                  onChange={e => set('business_end_hour', parseInt(e?.target?.value) || 18)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">0–23 (e.g. 18 = 6pm)</p>
              </div>
            </div>
          )}

          {/* Notification channels */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Notification Channels</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form?.notify_in_app}
                  onChange={e => set('notify_in_app', e?.target?.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground flex items-center gap-1.5">
                  <Icon name="Bell" size={13} color="var(--color-primary)" />
                  In-App
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form?.notify_email}
                  onChange={e => set('notify_email', e?.target?.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground flex items-center gap-1.5">
                  <Icon name="Mail" size={13} color="var(--color-primary)" />
                  Email
                </span>
              </label>
            </div>
          </div>

          {/* Email recipients */}
          {form?.notify_email && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Recipients</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e?.target?.value)}
                  onKeyDown={e => e?.key === 'Enter' && addEmail()}
                  placeholder="admin@nudental.com"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
                <button
                  onClick={addEmail}
                  className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              {form?.recipient_emails?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form?.recipient_emails?.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">
                      {email}
                      <button onClick={() => removeEmail(email)} className="hover:text-destructive ml-0.5">
                        <Icon name="X" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Rule Enabled</p>
              <p className="text-xs text-muted-foreground">
                Evaluation depends on the application alert detector. No backend scheduler is currently shown on this page.
              </p>
            </div>
            <button
              onClick={() => set('enabled', !form?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form?.enabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <><Icon name="Loader2" size={14} className="animate-spin" />Saving...</> : <><Icon name="Save" size={14} />Save Rule</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AlertRulesPage = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  // ── All hooks declared before any conditional return (React Rules of Hooks) ──
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rules');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState('');
  const [resolveLoading, setResolveLoading] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Alert Rules' },
  ];

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await alertRulesService?.getAll();
      setRules(data);
    } catch (err) {
      setError(err?.message || 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await suspiciousActivityService?.getEvents({ resolved: false });
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadEvents();
  }, [loadRules, loadEvents]);

  // Real-time subscription for new suspicious events
  useRealtimeSubscription(
    [{ table: 'suspicious_activity_events', events: ['INSERT', 'UPDATE'] }],
    useCallback((payload) => {
      if (payload?.eventType === 'INSERT') {
        setEvents(prev => [payload?.new, ...prev]);
      } else if (payload?.eventType === 'UPDATE') {
        setEvents(prev => prev?.map(e => e?.id === payload?.new?.id ? { ...e, ...payload?.new } : e));
      }
    }, []),
    true
  );

  // ── Page-level guard — placed AFTER all hooks ──
  if (!permLoading && userProfile && !isAdmin && !hasPermission('finance.alerts.view')) {
    return <AccessDenied message="Alert Rules is restricted to administrators." />;
  }

  const handleSaveRule = async (form) => {
    if (form?.id) {
      const updated = await alertRulesService?.update(form?.id, form);
      setRules(prev => prev?.map(r => r?.id === updated?.id ? updated : r));
    } else {
      const created = await alertRulesService?.create(form);
      setRules(prev => [created, ...prev]);
    }
  };

  const handleToggle = async (rule) => {
    try {
      const updated = await alertRulesService?.toggleEnabled(rule?.id, !rule?.enabled);
      setRules(prev => prev?.map(r => r?.id === updated?.id ? updated : r));
    } catch (err) {
      setError(err?.message || 'Failed to toggle rule');
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertRulesService?.delete(id);
      setRules(prev => prev?.filter(r => r?.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err?.message || 'Failed to delete rule');
    }
  };

  const handleResolve = async (eventId) => {
    setResolveLoading(eventId);
    try {
      await suspiciousActivityService?.resolve(eventId);
      setEvents(prev => prev?.filter(e => e?.id !== eventId));
    } catch (err) {
      setError(err?.message || 'Failed to resolve event');
    } finally {
      setResolveLoading(null);
    }
  };

  const unresolvedCount = events?.length;
  const enabledRules = rules?.filter(r => r?.enabled)?.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Icon name="ShieldAlert" size={20} color="var(--color-destructive)" />
                </div>
                Alert Rules
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure suspicious activity detection with email and in-app notifications
              </p>
            </div>
            <button
              onClick={() => { setEditingRule(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Icon name="Plus" size={15} />
              New Rule
            </button>
          </div>
        </div>

        {/* ── Scope Banner (Part 1) ── */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Icon name="Info" size={16} color="rgb(37 99 235)" className="flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Alert Rules use <strong>audit_logs mutation/action events</strong> to flag configured security patterns. Current rules do not monitor user logins, page views, PHI-view events, Dentrix/FastAPI activity, system errors, or patient records.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="Shield" size={17} color="var(--color-primary)" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{rules?.length}</p>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
              <Icon name="CheckCircle" size={17} color="var(--color-success)" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{enabledRules}</p>
              <p className="text-xs text-muted-foreground">Active Rules</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Icon name="AlertTriangle" size={17} color="var(--color-destructive)" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{unresolvedCount}</p>
              <p className="text-xs text-muted-foreground">Open Alerts</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
              <Icon name="Bell" size={17} color="var(--color-warning)" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">
                {rules?.filter(r => r?.notify_email || r?.notify_in_app)?.length}
              </p>
              <p className="text-xs text-muted-foreground">With Notifications</p>
            </div>
          </div>
        </div>

        {/* ── Evaluation Status Note (Part 5) ── */}
        <p className="text-xs text-muted-foreground px-1">
          Rule definitions are stored in Supabase. Open Alerts show unresolved suspicious_activity_events. Last evaluation time is not currently tracked.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border w-fit">
          {[
            { id: 'rules', label: 'Alert Rules', icon: 'Shield' },
            { id: 'events', label: `Open Alerts${unresolvedCount > 0 ? ` (${unresolvedCount})` : ''}`, icon: 'AlertTriangle' },
          ]?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab?.id
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={14} />
              {tab?.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Icon name="AlertCircle" size={15} color="var(--color-destructive)" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* ── Rules Tab ── */}
        {activeTab === 'rules' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="Shield" size={17} color="var(--color-primary)" />
                <h3 className="text-base font-semibold text-foreground">Configured Rules</h3>
              </div>
              <span className="text-sm text-muted-foreground">{rules?.length} rules</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">Loading rules...</span>
                </div>
              </div>
            ) : rules?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Icon name="ShieldOff" size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No alert rules configured</p>
                <p className="text-xs mt-1">Create your first rule to start monitoring suspicious activity.</p>
                <button
                  onClick={() => { setEditingRule(null); setShowModal(true); }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Icon name="Plus" size={14} />New Rule
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rules?.map(rule => {
                  const meta = RULE_TYPE_META?.[rule?.rule_type] || { icon: 'Bell', color: 'bg-muted text-muted-foreground border-border' };
                  const isNotMonitored = meta?.notMonitored;
                  return (
                    <div key={rule?.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-muted/20 transition-colors ${isNotMonitored ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta?.color}`}>
                        <Icon name={meta?.icon} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{rule?.name}</p>
                          <RuleTypeBadge ruleType={rule?.rule_type} />
                          {!rule?.enabled && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Disabled</span>
                          )}
                          {/* Not Monitored badge for failed_login rows */}
                          {isNotMonitored && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                              <Icon name="AlertTriangle" size={10} />
                              Not Monitored
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{rule?.description || meta?.desc}</p>
                        {/* Not-monitored helper text */}
                        {isNotMonitored && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            Failed login monitoring is not active because failed login events are not stored in public audit_logs.
                          </p>
                        )}
                        {/* Source note for monitored types */}
                        {!isNotMonitored && meta?.sourceNote && (
                          <p className="text-xs text-primary/60 mt-1 flex items-center gap-1">
                            <Icon name="Database" size={10} />
                            {meta?.sourceNote}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {rule?.rule_type !== 'after_hours' && (
                            <span className="text-xs text-muted-foreground">
                              Threshold: <span className="font-medium text-foreground">{rule?.threshold_count} events</span> in <span className="font-medium text-foreground">{rule?.threshold_minutes} min</span>
                            </span>
                          )}
                          {rule?.rule_type === 'after_hours' && (
                            <span className="text-xs text-muted-foreground">
                              Business hours: <span className="font-medium text-foreground">{rule?.business_start_hour}:00–{rule?.business_end_hour}:00</span>
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            {rule?.notify_in_app && <span className="text-xs text-primary flex items-center gap-0.5"><Icon name="Bell" size={10} />In-App</span>}
                            {rule?.notify_email && <span className="text-xs text-primary flex items-center gap-0.5"><Icon name="Mail" size={10} />Email{rule?.recipient_emails?.length > 0 ? ` (${rule?.recipient_emails?.length})` : ''}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(rule)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule?.enabled ? 'bg-primary' : 'bg-muted'}`}
                          title={rule?.enabled ? 'Disable rule' : 'Enable rule'}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule?.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                        <button
                          onClick={() => { setEditingRule(rule); setShowModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit rule"
                        >
                          <Icon name="Pencil" size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(rule?.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete rule"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Events Tab ── */}
        {activeTab === 'events' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="AlertTriangle" size={17} color="var(--color-destructive)" />
                <h3 className="text-base font-semibold text-foreground">Open Security Alerts</h3>
              </div>
              <button onClick={loadEvents} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                <Icon name="RefreshCw" size={12} className={eventsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {eventsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">Loading alerts...</span>
                </div>
              </div>
            ) : events?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Icon name="ShieldCheck" size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No open security alerts</p>
                <p className="text-xs mt-1">All clear — no suspicious activity detected.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {events?.map(event => {
                  const meta = RULE_TYPE_META?.[event?.rule_type] || { icon: 'Bell', color: 'bg-muted text-muted-foreground border-border' };
                  const userName = event?.user_profiles?.full_name || event?.user_profiles?.email || 'Unknown User';
                  return (
                    <div key={event?.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta?.color}`}>
                        <Icon name={meta?.icon} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{meta?.label || event?.rule_type}</p>
                          <SeverityBadge severity={event?.severity} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Triggered by <span className="font-medium text-foreground">{userName}</span>
                          {event?.offices?.name && <> · <span>{event?.offices?.name}</span></>}
                        </p>
                        {event?.details?.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event?.details?.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{formatTs(event?.created_at)}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleResolve(event?.id)}
                          disabled={resolveLoading === event?.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success border border-success/30 rounded-lg hover:bg-success/10 disabled:opacity-50 transition-colors"
                        >
                          {resolveLoading === event?.id
                            ? <><Icon name="Loader2" size={12} className="animate-spin" />Resolving...</>
                            : <><Icon name="CheckCircle" size={12} />Resolve</>
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rule Form Modal */}
      {showModal && (
        <RuleFormModal
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icon name="Trash2" size={18} color="var(--color-destructive)" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Rule</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-foreground">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertRulesPage;
