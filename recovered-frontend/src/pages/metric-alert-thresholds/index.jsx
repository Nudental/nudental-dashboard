import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';


// ─── Constants ────────────────────────────────────────────────────────────────

const OFFICES = ['All Offices', 'Barnegat', 'Brick', 'Eatontown', 'Staten Island'];

const METRICS = [
  {
    key: 'collection_ratio',
    label: 'Collection Ratio',
    unit: '%',
    description: 'Total collections ÷ net production',
    direction: 'below', // breach when value goes below threshold
    defaultWarning: 85,
    defaultCritical: 70,
    icon: 'TrendingUp',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    key: 'ar_30_plus',
    label: '30+ Day AR',
    unit: '$',
    description: 'Outstanding insurance AR aged 30+ days',
    direction: 'above', // breach when value goes above threshold
    defaultWarning: 15000,
    defaultCritical: 25000,
    icon: 'Clock',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  {
    key: 'claims_submission_rate',
    label: 'Claims Submission Rate',
    unit: '%',
    description: 'Claims submitted within 24 hours',
    direction: 'below',
    defaultWarning: 90,
    defaultCritical: 75,
    icon: 'FileCheck',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
];

const SEVERITY_META = {
  warning: {
    label: 'Warning',
    color: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    dot: 'bg-amber-500',
    icon: 'AlertTriangle',
  },
  critical: {
    label: 'Critical',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    dot: 'bg-destructive',
    icon: 'AlertOctagon',
  },
};

const STATUS_META = {
  active: { label: 'Active (prototype/local)', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  inactive: { label: 'Inactive', color: 'bg-muted text-muted-foreground border-border' },
};

const formatValue = (value, unit) => {
  if (unit === '$') return `$${Number(value)?.toLocaleString()}`;
  if (unit === '%') return `${value}%`;
  return value;
};

const formatTs = (ts) => {
  if (!ts) return '—';
  try { return format(new Date(ts), 'MMM d, yyyy h:mm a'); } catch { return ts; }
};

// ─── Mock breach data (simulated — NOT live production metrics) ───────────────
// These reference values are hardcoded constants used for UI demonstration only.
// They are NOT sourced from any Supabase table, live API, or daily_entries data.

const generateMockBreaches = (thresholds) => {
  const mockOfficeValues = {
    Barnegat: { collection_ratio: 112, ar_30_plus: 3387, claims_submission_rate: 100 },
    Brick: { collection_ratio: 236, ar_30_plus: 6834, claims_submission_rate: 97.83 },
    Eatontown: { collection_ratio: 122, ar_30_plus: 213, claims_submission_rate: 100 },
    'Staten Island': { collection_ratio: 88, ar_30_plus: 18500, claims_submission_rate: 72 },
  };

  const breaches = [];
  thresholds?.forEach(threshold => {
    if (!threshold?.enabled) return;
    const metric = METRICS?.find(m => m?.key === threshold?.metric_key);
    if (!metric) return;

    const offices = threshold?.office === 'All Offices'
      ? ['Barnegat', 'Brick', 'Eatontown', 'Staten Island']
      : [threshold?.office];

    offices?.forEach(office => {
      const currentValue = mockOfficeValues?.[office]?.[threshold?.metric_key];
      if (currentValue === undefined) return;

      let breached = false;
      let severity = null;

      if (metric?.direction === 'below') {
        if (currentValue < threshold?.critical_value) { breached = true; severity = 'critical'; }
        else if (currentValue < threshold?.warning_value) { breached = true; severity = 'warning'; }
      } else {
        if (currentValue > threshold?.critical_value) { breached = true; severity = 'critical'; }
        else if (currentValue > threshold?.warning_value) { breached = true; severity = 'warning'; }
      }

      if (breached) {
        breaches?.push({
          id: `${threshold?.id}-${office}`,
          threshold_id: threshold?.id,
          metric_key: threshold?.metric_key,
          metric_label: metric?.label,
          office,
          current_value: currentValue,
          threshold_value: severity === 'critical' ? threshold?.critical_value : threshold?.warning_value,
          severity,
          unit: metric?.unit,
          direction: metric?.direction,
          detected_at: new Date(Date.now() - Math.random() * 3600000)?.toISOString(),
          acknowledged: false,
        });
      }
    });
  });

  return breaches?.sort((a, b) => {
    if (a?.severity === 'critical' && b?.severity !== 'critical') return -1;
    if (b?.severity === 'critical' && a?.severity !== 'critical') return 1;
    return new Date(b?.detected_at) - new Date(a?.detected_at);
  });
};

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

const ConfirmDialog = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
      <div className="p-5 border-b border-border">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-5">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          {cancelLabel || 'Cancel'}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            danger
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {confirmLabel || 'Confirm'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Threshold Form Modal ─────────────────────────────────────────────────────

const ThresholdFormModal = ({ threshold, onSave, onClose }) => {
  const defaultMetric = METRICS?.[0];
  const [form, setForm] = useState(threshold || {
    name: '',
    metric_key: defaultMetric?.key,
    office: 'All Offices',
    warning_value: defaultMetric?.defaultWarning,
    critical_value: defaultMetric?.defaultCritical,
    notify_email: true,
    notify_in_app: true,
    enabled: true,
    recipient_emails: [],
  });
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const selectedMetric = METRICS?.find(m => m?.key === form?.metric_key) || defaultMetric;

  const handleMetricChange = (key) => {
    const m = METRICS?.find(m => m?.key === key);
    set('metric_key', key);
    if (!threshold) {
      set('warning_value', m?.defaultWarning);
      set('critical_value', m?.defaultCritical);
    }
  };

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
    if (!form?.name?.trim()) { setError('Threshold name is required'); return; }
    if (form?.warning_value === '' || form?.critical_value === '') { setError('Both threshold values are required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save threshold');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {threshold?.id ? 'Edit Alert Threshold' : 'New Alert Threshold'}
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Threshold Name *</label>
            <input
              type="text"
              value={form?.name}
              onChange={e => set('name', e?.target?.value)}
              placeholder="e.g. Low Collection Ratio Alert"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            />
          </div>

          {/* Metric */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Metric</label>
            <select
              value={form?.metric_key}
              onChange={e => handleMetricChange(e?.target?.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              {METRICS?.map(m => (
                <option key={m?.key} value={m?.key}>{m?.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">{selectedMetric?.description}</p>
          </div>

          {/* Office */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Office Scope</label>
            <select
              value={form?.office}
              onChange={e => set('office', e?.target?.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              {OFFICES?.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Threshold Values */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Threshold Values ({selectedMetric?.unit})
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                Breach triggers when value goes {selectedMetric?.direction} threshold
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-amber-600 mb-1.5 flex items-center gap-1">
                  <Icon name="AlertTriangle" size={11} />
                  Warning Level
                </label>
                <input
                  type="number"
                  min={0}
                  value={form?.warning_value}
                  onChange={e => set('warning_value', parseFloat(e?.target?.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-background border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-destructive mb-1.5 flex items-center gap-1">
                  <Icon name="AlertOctagon" size={11} />
                  Critical Level
                </label>
                <input
                  type="number"
                  min={0}
                  value={form?.critical_value}
                  onChange={e => set('critical_value', parseFloat(e?.target?.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-background border border-destructive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-destructive/30 text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Notification Channels */}
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
            {/* V714: Notification delivery disclaimer */}
            <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Icon name="AlertTriangle" size={13} color="var(--color-foreground)" className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Email and in-app notification delivery is not active yet. Recipient configuration is stored locally and will only be useful when live alert delivery is implemented.
              </p>
            </div>
          </div>

          {/* Recipient Emails */}
          {form?.notify_email && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Recipient Emails</label>
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
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
              {form?.recipient_emails?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form?.recipient_emails?.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                      {email}
                      <button onClick={() => removeEmail(email)} className="hover:text-destructive transition-colors ml-0.5">
                        <Icon name="X" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Threshold</p>
              <p className="text-xs text-muted-foreground">Active thresholds are checked against reference values (prototype only)</p>
            </div>
            <button
              onClick={() => set('enabled', !form?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form?.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Icon name="Loader2" size={14} className="animate-spin" />}
            {threshold?.id ? 'Save Changes' : 'Create Threshold'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Breach Notification Row ──────────────────────────────────────────────────

const BreachRow = ({ breach, onAcknowledge }) => {
  const meta = SEVERITY_META?.[breach?.severity];
  const metric = METRICS?.find(m => m?.key === breach?.metric_key);

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${breach?.acknowledged ? 'opacity-50' : ''} ${meta?.color}`}>
      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${meta?.dot} ${!breach?.acknowledged ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{breach?.metric_label}</span>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/30 border border-current/20">
            {breach?.office}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta?.color}`}>
            {meta?.label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 border border-current/20 italic">
            simulated
          </span>
        </div>
        <p className="text-xs mt-0.5 opacity-80">
          Current: <strong>{formatValue(breach?.current_value, breach?.unit)}</strong>
          {' '}— Threshold: <strong>{formatValue(breach?.threshold_value, breach?.unit)}</strong>
          {' '}({breach?.direction === 'below' ? 'below' : 'above'} limit)
        </p>
        <p className="text-xs opacity-60 mt-0.5">{formatTs(breach?.detected_at)}</p>
      </div>
      {!breach?.acknowledged && (
        <button
          onClick={() => onAcknowledge(breach?.id)}
          className="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-white/20 hover:bg-white/40 border border-current/20 rounded-lg transition-colors"
        >
          Ack
        </button>
      )}
    </div>
  );
};

// ─── Threshold Card ───────────────────────────────────────────────────────────

const ThresholdCard = ({ threshold, onEdit, onDelete, onToggle }) => {
  const metric = METRICS?.find(m => m?.key === threshold?.metric_key);
  const statusMeta = STATUS_META?.[threshold?.enabled ? 'active' : 'inactive'];

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${metric?.bgColor} border ${metric?.borderColor}`}>
            <Icon name={metric?.icon || 'Bell'} size={16} color={`var(--color-foreground)`} className={metric?.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate">{threshold?.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta?.color}`}>
                {statusMeta?.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{metric?.label} · {threshold?.office}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">
                  Warning: <strong className="text-foreground">{formatValue(threshold?.warning_value, metric?.unit)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">
                  Critical: <strong className="text-foreground">{formatValue(threshold?.critical_value, metric?.unit)}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {threshold?.notify_in_app && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon name="Bell" size={10} /> In-App
                </span>
              )}
              {threshold?.notify_email && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon name="Mail" size={10} /> Email
                  {threshold?.recipient_emails?.length > 0 && ` (${threshold?.recipient_emails?.length})`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggle(threshold)}
            title={threshold?.enabled ? 'Disable' : 'Enable'}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name={threshold?.enabled ? 'PauseCircle' : 'PlayCircle'} size={15} color="var(--color-muted-foreground)" />
          </button>
          <button
            onClick={() => onEdit(threshold)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="Pencil" size={15} color="var(--color-muted-foreground)" />
          </button>
          <button
            onClick={() => onDelete(threshold)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <Icon name="Trash2" size={15} color="var(--color-destructive)" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MetricAlertThresholds = () => {
  const { user, userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const [thresholds, setThresholds] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(null);
  const [activeTab, setActiveTab] = useState('thresholds');
  const [filterMetric, setFilterMetric] = useState('all');
  const [filterOffice, setFilterOffice] = useState('All Offices');
  const [lastChecked, setLastChecked] = useState(null);
  const [newBreachCount, setNewBreachCount] = useState(0);
  const pollingRef = useRef(null);

  // V714: ConfirmDialog state
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, threshold, onConfirm }

  // Page-level guard: super_admin only
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('admin.alert_thresholds.view')) {
    return <AccessDenied message="Metric Alert Thresholds is restricted to Super Administrators." />;
  }

  // ── Load thresholds from localStorage ──────────────────────────────────────
  // NOTE: This page is prototype/localStorage only. Future production implementation
  // should use a Supabase-backed metric alert rules table with RBAC, confirmation,
  // and platform audit logging.
  const loadThresholds = useCallback(() => {
    try {
      const stored = localStorage?.getItem('metric_alert_thresholds');
      const parsed = stored ? JSON.parse(stored) : [];
      setThresholds(parsed);
      return parsed;
    } catch {
      return [];
    }
  }, []);

  const saveThresholds = useCallback((updated) => {
    // localStorage only — not shared across users, devices, or browsers
    localStorage?.setItem('metric_alert_thresholds', JSON.stringify(updated));
    setThresholds(updated);
  }, []);

  // ── Breach simulation polling (NOT live monitoring) ──
  const checkBreaches = useCallback((currentThresholds) => {
    const detected = generateMockBreaches(currentThresholds);
    const prevIds = new Set(breaches?.map(b => b?.id));
    const newCount = detected?.filter(b => !prevIds?.has(b?.id))?.length;
    if (newCount > 0) setNewBreachCount(prev => prev + newCount);
    setBreaches(detected);
    setLastChecked(new Date());
  }, [breaches]);

  useEffect(() => {
    setLoading(true);
    const loaded = loadThresholds();
    // Seed defaults if empty
    if (loaded?.length === 0) {
      const defaults = METRICS?.map((m, i) => ({
        id: `default-${i}`,
        name: `${m?.label} Alert`,
        metric_key: m?.key,
        office: 'All Offices',
        warning_value: m?.defaultWarning,
        critical_value: m?.defaultCritical,
        notify_email: true,
        notify_in_app: true,
        enabled: true,
        recipient_emails: [],
        created_at: new Date()?.toISOString(),
      }));
      saveThresholds(defaults);
      setThresholds(defaults);
      checkBreaches(defaults);
    } else {
      checkBreaches(loaded);
    }
    setLoading(false);
  }, []);

  // Poll every 30s — recalculates simulated breaches from reference values
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      const current = loadThresholds();
      checkBreaches(current);
    }, 30000);
    return () => clearInterval(pollingRef?.current);
  }, [loadThresholds, checkBreaches]);

  const handleSave = async (form) => {
    const updated = form?.id
      ? thresholds?.map(t => t?.id === form?.id ? { ...form, updated_at: new Date()?.toISOString() } : t)
      : [...thresholds, { ...form, id: `threshold-${Date.now()}`, created_at: new Date()?.toISOString() }];
    saveThresholds(updated);
    checkBreaches(updated);
  };

  // V714: Delete requires confirmation
  const handleDeleteRequest = (threshold) => {
    setConfirmDialog({
      type: 'delete',
      title: 'Delete Threshold',
      message: `Delete '${threshold?.name}'? This removes the locally stored prototype threshold from this browser only. This cannot be undone.`,
      confirmLabel: 'Delete Threshold',
      cancelLabel: 'Cancel',
      danger: true,
      onConfirm: () => {
        const updated = thresholds?.filter(t => t?.id !== threshold?.id);
        saveThresholds(updated);
        checkBreaches(updated);
        setConfirmDialog(null);
      },
    });
  };

  // V714: Toggle requires confirmation
  const handleToggleRequest = (threshold) => {
    setConfirmDialog({
      type: 'toggle',
      title: 'Change Threshold Status',
      message: `Change status for '${threshold?.name}'? This only changes the locally stored prototype threshold in this browser and does not affect live alerting.`,
      confirmLabel: 'Change Status',
      cancelLabel: 'Cancel',
      danger: false,
      onConfirm: () => {
        const updated = thresholds?.map(t =>
          t?.id === threshold?.id ? { ...t, enabled: !t?.enabled } : t
        );
        saveThresholds(updated);
        checkBreaches(updated);
        setConfirmDialog(null);
      },
    });
  };

  const handleAcknowledge = (breachId) => {
    setBreaches(prev => prev?.map(b => b?.id === breachId ? { ...b, acknowledged: true } : b));
    setNewBreachCount(prev => Math.max(0, prev - 1));
  };

  const handleAcknowledgeAll = () => {
    setBreaches(prev => prev?.map(b => ({ ...b, acknowledged: true })));
    setNewBreachCount(0);
  };

  // V714: Export requires confirmation
  const handleExportRequest = () => {
    setConfirmDialog({
      type: 'export',
      title: 'Export Prototype Data',
      message: 'This export contains prototype threshold settings and simulated breach data from this browser only. It does not represent live production alerts. Continue?',
      confirmLabel: 'Export Prototype Data',
      cancelLabel: 'Cancel',
      danger: false,
      onConfirm: () => {
        doExport();
        setConfirmDialog(null);
      },
    });
  };

  const doExport = () => {
    const rows = [
      // V714: First row note that breach data is simulated
      ['NOTE: Breach data in this export is simulated from reference values, not live production metrics.'],
      [],
      ['Threshold Name', 'Metric', 'Office', 'Warning', 'Critical', 'Status', 'Notify Email', 'Notify In-App', 'Created'],
      ...thresholds?.map(t => {
        const m = METRICS?.find(m => m?.key === t?.metric_key);
        return [
          t?.name,
          m?.label || t?.metric_key,
          t?.office,
          `${t?.warning_value}${m?.unit}`,
          `${t?.critical_value}${m?.unit}`,
          t?.enabled ? 'Active (prototype/local)' : 'Inactive',
          t?.notify_email ? 'Yes' : 'No',
          t?.notify_in_app ? 'Yes' : 'No',
          formatTs(t?.created_at),
        ];
      }),
    ];

    const breachRows = [
      [],
      ['--- SIMULATED BREACH EVENTS (not live production data) ---'],
      ['Metric', 'Office', 'Severity', 'Current Value (simulated)', 'Threshold', 'Detected At', 'Acknowledged'],
      ...breaches?.map(b => [
        b?.metric_label,
        b?.office,
        b?.severity?.toUpperCase(),
        `${b?.current_value}${b?.unit}`,
        `${b?.threshold_value}${b?.unit}`,
        formatTs(b?.detected_at),
        b?.acknowledged ? 'Yes' : 'No',
      ]),
    ];

    const csv = [...rows, ...breachRows]
      ?.map(row => row?.map(cell => `"${String(cell ?? '')?.replace(/"/g, '""')}"`)?.join(','))
      ?.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    a.href = url;
    a.download = `metric-alert-thresholds-prototype-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a?.click();
    URL?.revokeObjectURL(url);
  };

  // ── Filtered data ──
  const filteredThresholds = thresholds?.filter(t => {
    if (filterMetric !== 'all' && t?.metric_key !== filterMetric) return false;
    if (filterOffice !== 'All Offices' && t?.office !== 'All Offices' && t?.office !== filterOffice) return false;
    return true;
  });

  const activeBreaches = breaches?.filter(b => !b?.acknowledged);
  const criticalBreaches = activeBreaches?.filter(b => b?.severity === 'critical');

  const tabs = [
    { id: 'thresholds', label: 'Thresholds', icon: 'SlidersHorizontal' },
    {
      id: 'breaches',
      label: 'Breach Notifications',
      icon: 'Bell',
      badge: activeBreaches?.length > 0 ? activeBreaches?.length : null,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Breadcrumb items={[{ label: 'Admin' }, { label: 'Metric Alert Thresholds' }]} />
              <h1 className="text-2xl font-bold text-foreground mt-1">Metric Alert Thresholds</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Define threshold-based alerts for critical metrics across offices
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportRequest}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors"
              >
                <Icon name="Download" size={15} />
                Export
              </button>
              <button
                onClick={() => { setEditingThreshold(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Icon name="Plus" size={15} />
                New Threshold
              </button>
            </div>
          </div>

          {/* V714: Top-level Prototype / Not Live warning banner */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Icon name="AlertTriangle" size={18} color="var(--color-foreground)" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Prototype / Not Live</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Alert Thresholds is currently a configuration prototype. Threshold rules are stored in this browser only using localStorage and are not shared across users or devices. Breach notifications shown here are simulated from reference values and do not reflect live production metrics. No email or in-app notifications are sent from this page yet.
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Thresholds', value: thresholds?.length, icon: 'SlidersHorizontal', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
              { label: 'Active (local)', value: thresholds?.filter(t => t?.enabled)?.length, icon: 'CheckCircle', color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { label: 'Simulated Breaches', value: activeBreaches?.length, icon: 'Bell', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { label: 'Critical (simulated)', value: criticalBreaches?.length, icon: 'AlertOctagon', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
            ]?.map(card => (
              <div key={card?.label} className={`bg-card border ${card?.border} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card?.bg}`}>
                    <Icon name={card?.icon} size={14} className={card?.color} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{card?.value}</p>
                <p className="text-xs text-muted-foreground">{card?.label}</p>
              </div>
            ))}
          </div>

          {/* V714: Fixed status bar — no longer says "Real-time monitoring active" */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Breach simulation active — recalculating from reference values every 30s. Live monitoring is not connected yet.</span>
            </div>
            <span>Last checked: {lastChecked ? format(lastChecked, 'h:mm:ss a') : '—'}</span>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-1">
              {tabs?.map(tab => (
                <button
                  key={tab?.id}
                  onClick={() => { setActiveTab(tab?.id); if (tab?.id === 'breaches') setNewBreachCount(0); }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab?.id
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={tab?.icon} size={14} />
                  {tab?.label}
                  {tab?.badge && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full">
                      {tab?.badge}
                    </span>
                  )}
                  {tab?.id === 'breaches' && newBreachCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold bg-amber-500 text-white rounded-full">
                      +{newBreachCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: Thresholds */}
          {activeTab === 'thresholds' && (
            <div className="space-y-4">
              {/* V714: Prototype storage label */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Icon name="Info" size={13} color="var(--color-foreground)" className="text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Prototype storage: thresholds saved here are browser-local only and are not live alert rules.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterMetric}
                  onChange={e => setFilterMetric(e?.target?.value)}
                  className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  <option value="all">All Metrics</option>
                  {METRICS?.map(m => (
                    <option key={m?.key} value={m?.key}>{m?.label}</option>
                  ))}
                </select>
                <select
                  value={filterOffice}
                  onChange={e => setFilterOffice(e?.target?.value)}
                  className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                >
                  {OFFICES?.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : filteredThresholds?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Icon name="SlidersHorizontal" size={20} color="var(--color-muted-foreground)" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No thresholds found</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a threshold to start monitoring metrics</p>
                  <button
                    onClick={() => { setEditingThreshold(null); setShowModal(true); }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="Plus" size={14} />
                    New Threshold
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredThresholds?.map(threshold => (
                    <ThresholdCard
                      key={threshold?.id}
                      threshold={threshold}
                      onEdit={(t) => { setEditingThreshold(t); setShowModal(true); }}
                      onDelete={handleDeleteRequest}
                      onToggle={handleToggleRequest}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Breach Notifications */}
          {activeTab === 'breaches' && (
            <div className="space-y-4">
              {/* V714: Simulated breach disclaimer */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Icon name="AlertTriangle" size={13} color="var(--color-foreground)" className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Breach events shown below are simulated from reference values for UI demonstration purposes. These are not live alerts from production data.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {activeBreaches?.length} simulated breach{activeBreaches?.length !== 1 ? 'es' : ''} detected
                  {criticalBreaches?.length > 0 && (
                    <span className="ml-2 text-destructive font-medium">
                      · {criticalBreaches?.length} critical
                    </span>
                  )}
                </p>
                {activeBreaches?.length > 0 && (
                  <button
                    onClick={handleAcknowledgeAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors"
                  >
                    <Icon name="CheckCheck" size={13} />
                    Acknowledge All
                  </button>
                )}
              </div>

              {breaches?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <Icon name="CheckCircle" size={20} color="var(--color-foreground)" className="text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No active breaches</p>
                  <p className="text-xs text-muted-foreground mt-1">All metrics are within defined thresholds</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Critical first */}
                  {criticalBreaches?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5">
                        <Icon name="AlertOctagon" size={12} />
                        Critical Breaches (simulated)
                      </p>
                      {criticalBreaches?.map(breach => (
                        <BreachRow key={breach?.id} breach={breach} onAcknowledge={handleAcknowledge} />
                      ))}
                    </div>
                  )}

                  {/* Warning */}
                  {activeBreaches?.filter(b => b?.severity === 'warning')?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
                        <Icon name="AlertTriangle" size={12} />
                        Warning Breaches (simulated)
                      </p>
                      {activeBreaches?.filter(b => b?.severity === 'warning')?.map(breach => (
                        <BreachRow key={breach?.id} breach={breach} onAcknowledge={handleAcknowledge} />
                      ))}
                    </div>
                  )}

                  {/* Acknowledged */}
                  {breaches?.filter(b => b?.acknowledged)?.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5">
                        <Icon name="ChevronRight" size={12} />
                        {breaches?.filter(b => b?.acknowledged)?.length} acknowledged
                      </summary>
                      <div className="space-y-2 mt-2">
                        {breaches?.filter(b => b?.acknowledged)?.map(breach => (
                          <BreachRow key={breach?.id} breach={breach} onAcknowledge={handleAcknowledge} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      {/* Modal */}
      {showModal && (
        <ThresholdFormModal
          threshold={editingThreshold}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingThreshold(null); }}
        />
      )}
      {/* V714: ConfirmDialog for Delete / Toggle / Export */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmLabel={confirmDialog?.confirmLabel}
          cancelLabel={confirmDialog?.cancelLabel}
          danger={confirmDialog?.danger}
          onConfirm={confirmDialog?.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default MetricAlertThresholds;
