import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const ACTION_META = {
  CREATE:        { label: 'Create',        color: 'bg-success/10 text-success' },
  UPDATE:        { label: 'Update',        color: 'bg-primary/10 text-primary' },
  DELETE:        { label: 'Delete',        color: 'bg-destructive/10 text-destructive' },
  SOFT_DELETE:   { label: 'Soft Delete',   color: 'bg-destructive/10 text-destructive' },
  INVITE:        { label: 'Invite',        color: 'bg-accent/10 text-accent-foreground' },
  TOGGLE_ACTIVE: { label: 'Status Change', color: 'bg-warning/10 text-warning' },
  APPROVE:       { label: 'Approve',       color: 'bg-success/10 text-success' },
  EXPORT:        { label: 'Export',        color: 'bg-blue-500/10 text-blue-600' },
  EDIT:          { label: 'Edit',          color: 'bg-primary/10 text-primary' },
  VIEW:          { label: 'View',          color: 'bg-muted text-muted-foreground' },
};

const RESOURCE_LABELS = {
  user_profiles: 'Users & Staff',
  offices: 'Offices',
  providers: 'Providers',
  cost_drivers: 'Cost Drivers',
  daily_entries: 'Daily Entries',
  action_items: 'Team Tasks',
  huddles: 'Morning Huddles',
  supply_requests: 'Supply Requests',
  back_staff_orders: 'Back Staff Orders',
  implant_inventory: 'Implant Inventory',
  bone_tissue_stock: 'Bone & Tissue',
  monthly_executive_analytics: 'Monthly Analytics',
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', icon: 'Calendar' },
  { value: 'weekly', label: 'Weekly', icon: 'CalendarDays' },
  { value: 'monthly', label: 'Monthly', icon: 'CalendarRange' },
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: 'FileSpreadsheet', desc: 'Spreadsheet-compatible' },
  { value: 'pdf', label: 'PDF', icon: 'FileText', desc: 'Print-ready report' },
];

const SAVED_REPORTS_KEY = 'audit_report_configs';

const loadSavedConfigs = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_REPORTS_KEY) || '[]'); } catch { return []; }
};
const saveConfigs = (configs) => {
  localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(configs));
};

const getDateRange = (frequency) => {
  const now = new Date();
  if (frequency === 'daily') return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)), label: 'Yesterday' };
  if (frequency === 'weekly') return { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)), label: 'Last Week' };
  if (frequency === 'monthly') return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)), label: 'Last Month' };
  return { start: startOfDay(subDays(now, 7)), end: endOfDay(now), label: 'Last 7 Days' };
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportToCSV = (logs, filename) => {
  const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Resource', 'Record ID', 'Summary'];
  const rows = logs?.map(l => [
    format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
    l?.user_profiles?.full_name || '—',
    l?.user_profiles?.email || '—',
    l?.user_profiles?.role || '—',
    l?.action,
    RESOURCE_LABELS?.[l?.table_name] || l?.table_name,
    l?.record_id || '—',
    (l?.change_summary || '')?.replace(/,/g, ';'),
  ]);
  const csv = [headers, ...rows]?.map(r => r?.map(v => `"${v}"`)?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a?.click();
  URL.revokeObjectURL(url);
};

// ─── PDF Export ───────────────────────────────────────────────────────────────
const exportToPDF = async (logs, config, dateLabel) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc?.internal?.pageSize?.getWidth();

  // Header
  doc?.setFillColor(15, 23, 42);
  doc?.rect(0, 0, pageW, 22, 'F');
  doc?.setTextColor(255, 255, 255);
  doc?.setFontSize(14);
  doc?.setFont('helvetica', 'bold');
  doc?.text('NU Dental — Audit Report', 14, 14);
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'normal');
  doc?.text(`${config?.frequency?.toUpperCase()} | ${dateLabel} | Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageW - 14, 14, { align: 'right' });

  // Summary
  doc?.setTextColor(30, 30, 30);
  doc?.setFontSize(10);
  doc?.setFont('helvetica', 'bold');
  doc?.text(`Total Events: ${logs?.length}`, 14, 32);
  const uniqueUsers = new Set(logs.map(l => l.user_id))?.size;
  doc?.text(`Unique Users: ${uniqueUsers}`, 60, 32);
  doc?.text(`Actions: ${config?.actionFilters?.length ? config?.actionFilters?.join(', ') : 'All'}`, 110, 32);

  // Table
  const colWidths = [38, 38, 22, 22, 40, 30, 80];
  const headers = ['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Record ID', 'Summary'];
  let y = 42;
  doc?.setFillColor(240, 242, 245);
  doc?.rect(14, y - 5, pageW - 28, 8, 'F');
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'bold');
  doc?.setTextColor(60, 60, 60);
  let x = 14;
  headers?.forEach((h, i) => { doc?.text(h, x + 1, y); x += colWidths?.[i]; });
  y += 5;
  doc?.setFont('helvetica', 'normal');
  doc?.setFontSize(7);

  logs?.slice(0, 200)?.forEach((l, idx) => {
    if (y > 190) { doc?.addPage(); y = 20; }
    if (idx % 2 === 0) { doc?.setFillColor(250, 251, 252); doc?.rect(14, y - 4, pageW - 28, 7, 'F'); }
    doc?.setTextColor(40, 40, 40);
    x = 14;
    const row = [
      format(new Date(l.created_at), 'MM/dd/yy HH:mm'),
      (l?.user_profiles?.full_name || '—')?.substring(0, 20),
      (l?.user_profiles?.role || '—')?.substring(0, 12),
      l?.action,
      (RESOURCE_LABELS?.[l?.table_name] || l?.table_name || '—')?.substring(0, 22),
      (l?.record_id || '—')?.substring(0, 14),
      (l?.change_summary || '—')?.substring(0, 45),
    ];
    row?.forEach((v, i) => { doc?.text(String(v), x + 1, y); x += colWidths?.[i]; });
    y += 7;
  });

  doc?.save(`audit-report-${config?.frequency}-${format(new Date(), 'yyyyMMdd')}.pdf`);
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AuditReports = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  // Page-level guard
  if (!permLoading && userProfile && !isAdmin && !hasPermission('finance.audit_reports.view')) {
    return <AccessDenied message="Audit Reports is restricted to administrators." />;
  }

  const [savedConfigs, setSavedConfigs] = useState(loadSavedConfigs);
  const [activeTab, setActiveTab] = useState('generate'); // generate | scheduled
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewLogs, setPreviewLogs] = useState([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Report config state
  const [config, setConfig] = useState({
    frequency: 'weekly',
    exportFormat: 'csv',
    actionFilters: [],
    resourceFilters: [],
    recipients: userProfile?.email ? [userProfile?.email] : [],
    recipientInput: '',
    includeDetails: true,
    includeStats: true,
  });

  const updateConfig = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const toggleAction = (action) => {
    setConfig(prev => ({
      ...prev,
      actionFilters: prev?.actionFilters?.includes(action)
        ? prev?.actionFilters?.filter(a => a !== action)
        : [...prev?.actionFilters, action],
    }));
  };

  const toggleResource = (res) => {
    setConfig(prev => ({
      ...prev,
      resourceFilters: prev?.resourceFilters?.includes(res)
        ? prev?.resourceFilters?.filter(r => r !== res)
        : [...prev?.resourceFilters, res],
    }));
  };

  const addRecipient = () => {
    const email = config?.recipientInput?.trim();
    if (!email || !email?.includes('@')) return;
    if (config?.recipients?.includes(email)) return;
    updateConfig('recipients', [...config?.recipients, email]);
    updateConfig('recipientInput', '');
  };

  const removeRecipient = (email) => {
    updateConfig('recipients', config?.recipients?.filter(r => r !== email));
  };

  const fetchLogs = useCallback(async () => {
    setGenerating(true);
    try {
      const { start, end } = getDateRange(config?.frequency);
      let query = supabase?.from('audit_logs')?.select(`
        id, user_id, action, table_name, record_id, change_summary, created_at,
        user_profiles!audit_logs_user_id_fkey(full_name, email, role)
      `)?.gte('created_at', start?.toISOString())?.lte('created_at', end?.toISOString())?.order('created_at', { ascending: false });

      if (config?.actionFilters?.length > 0) query = query?.in('action', config?.actionFilters);
      if (config?.resourceFilters?.length > 0) query = query?.in('table_name', config?.resourceFilters);

      const { data, error } = await query;
      if (error) throw error;
      setPreviewLogs(data || []);
      setPreviewLoaded(true);
    } catch (err) {
      showToast('Failed to load audit data: ' + err?.message, 'error');
    } finally {
      setGenerating(false);
    }
  }, [config?.frequency, config?.actionFilters, config?.resourceFilters]);

  const handleExport = async () => {
    if (!previewLoaded) await fetchLogs();
    const { label } = getDateRange(config?.frequency);
    const filename = `audit-report-${config?.frequency}-${format(new Date(), 'yyyyMMdd')}`;
    if (config?.exportFormat === 'csv') {
      exportToCSV(previewLogs, filename);
      showToast('CSV report downloaded successfully');
    } else {
      await exportToPDF(previewLogs, config, label);
      showToast('PDF report downloaded successfully');
    }
  };

  const handleSendEmail = async () => {
    if (config?.recipients?.length === 0) { showToast('Add at least one recipient', 'error'); return; }
    setSendingEmail(true);
    try {
      if (!previewLoaded) await fetchLogs();
      const { label } = getDateRange(config?.frequency);
      const stats = {
        total: previewLogs?.length,
        uniqueUsers: new Set(previewLogs.map(l => l.user_id))?.size,
        topActions: Object.entries(
          previewLogs?.reduce((acc, l) => { acc[l.action] = (acc?.[l?.action] || 0) + 1; return acc; }, {})
        )?.sort((a, b) => b?.[1] - a?.[1])?.slice(0, 5),
      };

      const { error } = await supabase?.functions?.invoke('send-email', {
        body: {
          email_type: 'audit_report',
          recipient_email: config?.recipients?.[0],
          recipient_name: 'Admin',
          data: {
            frequency: config?.frequency,
            date_label: label,
            total_events: stats?.total,
            unique_users: stats?.uniqueUsers,
            top_actions: stats?.topActions?.map(([a, c]) => `${a}: ${c}`)?.join(', '),
            recipients: config?.recipients,
            export_format: config?.exportFormat,
            app_url: 'https://nudentalr1699.builtwithrocket.new',
          },
        },
      });

      // Log to email_logs
      for (const email of config?.recipients) {
        await supabase?.from('email_logs')?.insert({
          recipient_email: email,
          recipient_name: email,
          email_type: 'audit_report',
          subject: `NU Dental ${config?.frequency?.charAt(0)?.toUpperCase() + config?.frequency?.slice(1)} Audit Report — ${label}`,
          status: error ? 'failed' : 'sent',
          error_message: error?.message || '',
          metadata: { frequency: config?.frequency, total_events: stats?.total },
        });
      }

      if (error) throw error;
      showToast(`Report sent to ${config?.recipients?.length} recipient(s)`);
    } catch (err) {
      showToast('Email delivery failed: ' + err?.message, 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveConfig = () => {
    if (!saveName?.trim()) return;
    const newConfig = { id: Date.now(), name: saveName, config: { ...config, recipientInput: '' }, createdAt: new Date()?.toISOString() };
    const updated = [...savedConfigs, newConfig];
    setSavedConfigs(updated);
    saveConfigs(updated);
    setSaveName('');
    setShowSaveModal(false);
    showToast('Report configuration saved');
  };

  const handleLoadConfig = (saved) => {
    setConfig({ ...saved?.config, recipientInput: '' });
    setPreviewLoaded(false);
    setPreviewLogs([]);
    showToast(`Loaded: ${saved?.name}`);
  };

  const handleDeleteConfig = (id) => {
    const updated = savedConfigs?.filter(c => c?.id !== id);
    setSavedConfigs(updated);
    saveConfigs(updated);
  };

  const { label: dateLabel } = getDateRange(config?.frequency);
  const uniqueUsers = new Set(previewLogs.map(l => l.user_id))?.size;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Audit Dashboard', path: '/audit-dashboard' },
    { label: 'Report Generation' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast?.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-white'}`}>
          <Icon name={toast?.type === 'error' ? 'AlertCircle' : 'CheckCircle2'} size={16} />
          {toast?.msg}
        </div>
      )}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="FileBarChart2" size={20} color="var(--color-primary)" />
                </div>
                Audit Report Generation
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Preview and export audit_logs reports using date-range presets. Saved configurations are local browser presets, not scheduled reports.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Icon name="Bookmark" size={15} /> Save Config
              </button>
            </div>
          </div>
        </div>

        {/* Part 5 — Scope info banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <Icon name="Info" size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Audit Reports scope:</strong> Uses <code className="text-xs bg-blue-100 px-1 rounded">audit_logs</code> database mutation events. Does not include logins, page views, PHI-view events, exports, failed access attempts, Dentrix/FastAPI events, or system errors.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {[{ id: 'generate', label: 'Generate Report', icon: 'FileBarChart2' }, { id: 'scheduled', label: 'Saved Configs', icon: 'Bookmark', badge: savedConfigs?.length }]?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab?.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
              {tab?.badge > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{tab?.badge}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config Panel */}
            <div className="lg:col-span-1 space-y-5">
              {/* Frequency */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="Clock" size={15} color="var(--color-primary)" /> Report Frequency
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCY_OPTIONS?.map(opt => (
                    <button
                      key={opt?.value}
                      onClick={() => { updateConfig('frequency', opt?.value); setPreviewLoaded(false); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${config?.frequency === opt?.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                    >
                      <Icon name={opt?.icon} size={16} />
                      {opt?.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Coverage: <span className="font-medium text-foreground">{dateLabel}</span></p>
                <p className="text-xs text-muted-foreground mt-1">Daily, Weekly, and Monthly are date-range presets for preview and export — not scheduled reports.</p>
              </div>

              {/* Export Format */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="Download" size={15} color="var(--color-primary)" /> Export Format
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_FORMATS?.map(fmt => (
                    <button
                      key={fmt?.value}
                      onClick={() => updateConfig('exportFormat', fmt?.value)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-xs transition-all ${config?.exportFormat === fmt?.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon name={fmt?.icon} size={14} color={config?.exportFormat === fmt?.value ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
                        <span className={`font-semibold ${config?.exportFormat === fmt?.value ? 'text-primary' : 'text-foreground'}`}>{fmt?.label}</span>
                      </div>
                      <span className="text-muted-foreground">{fmt?.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Filters */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="Filter" size={15} color="var(--color-primary)" /> Action Filters
                  <span className="text-xs text-muted-foreground font-normal">(empty = all)</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ACTION_META)?.map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => { toggleAction(key); setPreviewLoaded(false); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${config?.actionFilters?.includes(key) ? meta.color + ' border-current' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resource Filters */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="Database" size={15} color="var(--color-primary)" /> Resource Filters
                  <span className="text-xs text-muted-foreground font-normal">(empty = all)</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(RESOURCE_LABELS)?.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { toggleResource(key); setPreviewLoaded(false); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${config?.resourceFilters?.includes(key) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Part 7 — Resource filter warning */}
                <p className="text-xs text-muted-foreground mt-2">Resource options reflect <code className="bg-muted px-1 rounded">audit_logs.table_name</code> labels. Some app areas may not have audit triggers yet.</p>
              </div>

              {/* Email Recipients */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="Mail" size={15} color="var(--color-primary)" /> Email Recipients
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={config?.recipientInput}
                    onChange={e => updateConfig('recipientInput', e?.target?.value)}
                    onKeyDown={e => e?.key === 'Enter' && addRecipient()}
                    placeholder="Add recipient email"
                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button onClick={addRecipient} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                    <Icon name="Plus" size={15} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {config?.recipients?.map(email => (
                    <div key={email} className="flex items-center justify-between px-3 py-1.5 bg-muted/40 rounded-lg">
                      <span className="text-xs text-foreground truncate">{email}</span>
                      <button onClick={() => removeRecipient(email)} className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0">
                        <Icon name="X" size={13} />
                      </button>
                    </div>
                  ))}
                  {config?.recipients?.length === 0 && <p className="text-xs text-muted-foreground italic">No recipients added</p>}
                </div>
                {/* Part 2 — Recipient helper text */}
                <p className="text-xs text-muted-foreground mt-2">Recipients are saved only in this browser report configuration. Email sending is currently disabled.</p>
              </div>
            </div>

            {/* Preview + Actions */}
            <div className="lg:col-span-2 space-y-5">
              {/* Stats + Actions */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Icon name="Eye" size={15} color="var(--color-primary)" /> Report Preview
                    {previewLoaded && <span className="text-xs font-normal text-muted-foreground">— {previewLogs?.length} events</span>}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={fetchLogs}
                      disabled={generating}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <Icon name={generating ? 'Loader2' : 'RefreshCw'} size={14} className={generating ? 'animate-spin' : ''} />
                      Preview
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={generating || !previewLoaded}
                      title={!previewLoaded ? 'Click Preview first to load audit data before exporting.' : undefined}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="Download" size={14} /> Export {config?.exportFormat?.toUpperCase()}
                    </button>
                    {/* Part 1 — Disabled Send button */}
                    <button
                      disabled
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-muted text-muted-foreground border border-border rounded-lg opacity-60 cursor-not-allowed"
                      title="Email sending is disabled until the audit_report template, confirmation step, and multi-recipient send/logging behavior are completed."
                    >
                      <Icon name="MailX" size={14} />
                      Email Disabled — Template Not Configured
                    </button>
                  </div>
                </div>
                {/* Part 1 — Send button helper text */}
                <p className="text-xs text-muted-foreground mb-3">Email delivery is disabled until the audit_report email template, confirmation step, and multi-recipient send/logging behavior are completed.</p>
                {/* Part 3 — Export helper text */}
                <p className="text-xs text-muted-foreground mb-4">Exports use the loaded audit_logs preview results. CSV includes loaded rows; PDF includes up to 200 rows. <span className="font-medium">Preview must be loaded before exporting.</span></p>
                {/* Part 6 — Large query warning */}
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Large date ranges may load many audit rows. Use date, action, and resource filters before exporting.</p>

                {previewLoaded && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Total Events', value: previewLogs?.length, icon: 'Activity', color: 'bg-primary/10 text-primary' },
                      { label: 'Unique Users', value: uniqueUsers, icon: 'Users', color: 'bg-success/10 text-success' },
                      { label: 'Resources', value: new Set(previewLogs.map(l => l.table_name))?.size, icon: 'Database', color: 'bg-warning/10 text-warning' },
                    ]?.map(stat => (
                      <div key={stat?.label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${stat?.color}`}>
                          <Icon name={stat?.icon} size={15} />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{stat?.value}</p>
                          <p className="text-xs text-muted-foreground">{stat?.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!previewLoaded && !generating && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <Icon name="FileBarChart2" size={24} color="var(--color-muted-foreground)" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Configure and preview your report</p>
                    <p className="text-xs text-muted-foreground mt-1">Click Preview to load audit data for {dateLabel}</p>
                  </div>
                )}

                {generating && (
                  <div className="flex items-center justify-center py-16">
                    <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading audit data…</span>
                  </div>
                )}

                {previewLoaded && previewLogs?.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          {['Timestamp', 'User', 'Action', 'Resource', 'Summary']?.map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewLogs?.slice(0, 20)?.map(log => (
                          <tr key={log?.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, h:mm a')}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-foreground">{log?.user_profiles?.full_name || '—'}</div>
                              <div className="text-muted-foreground">{log?.user_profiles?.role || ''}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_META?.[log?.action]?.color || 'bg-muted text-muted-foreground'}`}>
                                {ACTION_META?.[log?.action]?.label || log?.action}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-foreground">{RESOURCE_LABELS?.[log?.table_name] || log?.table_name}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{log?.change_summary || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewLogs?.length > 20 && (
                      <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground text-center border-t border-border">
                        Showing 20 of {previewLogs?.length} events — full data included in export
                      </div>
                    )}
                  </div>
                )}

                {previewLoaded && previewLogs?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Icon name="SearchX" size={24} color="var(--color-muted-foreground)" />
                    <p className="text-sm text-muted-foreground mt-2">No audit events found for the selected filters</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="space-y-4">
            {/* Part 4 — Saved Configs helper text */}
            <p className="text-xs text-muted-foreground">Saved in this browser only. Does not schedule automatic reports.</p>
            {savedConfigs?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Icon name="Bookmark" size={24} color="var(--color-muted-foreground)" />
                </div>
                <p className="text-sm font-medium text-foreground">No saved configurations</p>
                <p className="text-xs text-muted-foreground mt-1">Save a report configuration from the Generate tab to reuse it</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedConfigs?.map(saved => (
                  <div key={saved?.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{saved?.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(saved.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                      <button onClick={() => handleDeleteConfig(saved?.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon name="Clock" size={12} /> <span className="capitalize">{saved?.config?.frequency}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon name="Download" size={12} /> <span className="uppercase">{saved?.config?.exportFormat}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon name="Mail" size={12} /> <span>{saved?.config?.recipients?.length || 0} recipient(s)</span>
                      </div>
                      {saved?.config?.actionFilters?.length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon name="Filter" size={12} /> <span>{saved?.config?.actionFilters?.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { handleLoadConfig(saved); setActiveTab('generate'); }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <Icon name="Upload" size={13} /> Load Configuration
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Save Config Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-foreground mb-4">Save Report Configuration</h3>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e?.target?.value)}
              onKeyDown={e => e?.key === 'Enter' && handleSaveConfig()}
              placeholder="e.g. Weekly Admin Report"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={handleSaveConfig} disabled={!saveName?.trim()} className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditReports;
