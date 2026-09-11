import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const SETTING_KEY = 'year_comparison_report_schedule';
const TEMPLATES_KEY = 'year_comparison_report_templates';

const METRIC_OPTIONS = [
  { key: 'production', label: 'Gross Production' },
  { key: 'collections', label: 'Collections' },
  { key: 'netIncome', label: 'Net Income' },
  { key: 'expenses', label: 'Total Expenses' },
  { key: 'newPatients', label: 'New Patients' },
  { key: 'caseAcceptance', label: 'Case Acceptance Rate' },
  { key: 'collectionRate', label: 'Collection Rate' },
  { key: 'payroll', label: 'Payroll Total' },
  { key: 'labFees', label: 'Lab Fees' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'totalAR', label: 'Total A/R (MEA — legacy, not live Dentrix)' },
  { key: 'outstandingClaims', label: 'Outstanding Claims' },
  { key: 'brokenAppts', label: 'Broken Appointments' },
  { key: 'chairUtilization', label: 'Chair Utilization' },
];

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly', description: 'Sent on the 1st of each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Sent on Jan 1, Apr 1, Jul 1, Oct 1' },
];

const YEAR_RANGE_OPTIONS = [
  { value: 2, label: 'Last 2 Years' },
  { value: 3, label: 'Last 3 Years' },
];

const DEFAULT_CONFIG = {
  enabled: false,
  paused: false,
  frequency: 'monthly',
  yearRange: 2,
  selectedMetrics: ['production', 'collections', 'newPatients', 'caseAcceptance', 'netIncome'],
  recipients: [],
  customRecipients: [],
  includeProviderBreakdown: true,
  includeMonthlyTrends: true,
  name: 'Default Schedule',
};

// ── Template Card ────────────────────────────────────────────────────────────
const TemplateCard = ({ template, onApply, onDelete }) => (
  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border hover:border-indigo-300 transition-colors group">
    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
      <Icon name="BookTemplate" size={14} color="#4f46e5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{template?.name}</p>
      <p className="text-xs text-muted-foreground">
        {template?.frequency} · {template?.yearRange}yr · {template?.selectedMetrics?.length} metrics
      </p>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onApply(template)}
        className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        Apply
      </button>
      <button
        onClick={() => onDelete(template?.id)}
        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
        title="Delete template"
      >
        <Icon name="Trash2" size={12} />
      </button>
    </div>
  </div>
);

// ── Schedule Item ────────────────────────────────────────────────────────────
const ScheduleItem = ({ schedule, onEdit, onTogglePause, onClone, onDelete, isActive }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
    isActive ? 'border-indigo-300 bg-indigo-50/50' : 'border-border bg-muted/20'
  }`}>
    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
      schedule?.paused ? 'bg-amber-400' : schedule?.enabled ? 'bg-emerald-500' : 'bg-slate-300'
    }`} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{schedule?.name || 'Unnamed Schedule'}</p>
      <p className="text-xs text-muted-foreground">
        {schedule?.frequency} · {schedule?.yearRange}yr ·{' '}
        <span className={`font-medium ${
          schedule?.paused ? 'text-amber-600' : schedule?.enabled ? 'text-emerald-600' : 'text-slate-500'
        }`}>
          {schedule?.paused ? 'Paused' : schedule?.enabled ? 'Active' : 'Disabled'}
        </span>
      </p>
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={() => onTogglePause(schedule?.id)}
        className={`p-1.5 rounded-md transition-colors text-xs font-medium ${
          schedule?.paused
            ? 'hover:bg-emerald-100 text-emerald-600' :'hover:bg-amber-100 text-amber-600'
        }`}
        title={schedule?.paused ? 'Resume schedule' : 'Pause schedule'}
      >
        <Icon name={schedule?.paused ? 'Play' : 'Pause'} size={13} />
      </button>
      <button
        onClick={() => onClone(schedule)}
        className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
        title="Clone this schedule"
      >
        <Icon name="Copy" size={13} />
      </button>
      <button
        onClick={() => onEdit(schedule)}
        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Edit schedule"
      >
        <Icon name="Pencil" size={13} />
      </button>
      <button
        onClick={() => onDelete(schedule?.id)}
        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
        title="Delete schedule"
      >
        <Icon name="Trash2" size={13} />
      </button>
    </div>
  </div>
);

// ── Main Modal ───────────────────────────────────────────────────────────────
const ScheduleYearComparisonModal = ({ isOpen, onClose }) => {
  // View: 'schedules' | 'editor' | 'templates'
  const [view, setView] = useState('schedules');
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [roleRecipients, setRoleRecipients] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadAll();
  }, [isOpen]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load schedules
      const { data: schedSetting } = await supabase?.from('management_settings')
        ?.select('setting_value')?.eq('setting_key', SETTING_KEY)?.maybeSingle();

      if (schedSetting?.setting_value) {
        const val = typeof schedSetting?.setting_value === 'string'
          ? JSON.parse(schedSetting?.setting_value)
          : schedSetting?.setting_value;
        // Support both legacy single-config and new multi-schedule array
        if (Array.isArray(val)) {
          setSchedules(val);
        } else {
          setSchedules([{ ...DEFAULT_CONFIG, ...val, id: 'default', name: val?.name || 'Default Schedule' }]);
        }
      } else {
        setSchedules([]);
      }

      // Load templates
      const { data: tmplSetting } = await supabase?.from('management_settings')
        ?.select('setting_value')?.eq('setting_key', TEMPLATES_KEY)?.maybeSingle();

      if (tmplSetting?.setting_value) {
        const tval = typeof tmplSetting?.setting_value === 'string'
          ? JSON.parse(tmplSetting?.setting_value)
          : tmplSetting?.setting_value;
        setTemplates(Array.isArray(tval) ? tval : []);
      }

      // Load role-based recipients
      const { data: profiles } = await supabase?.from('user_profiles')
        ?.select('id, full_name, email, role')
        ?.in('role', ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'])
        ?.not('email', 'is', null)
        ?.order('full_name');
      setRoleRecipients(profiles || []);
    } catch (err) {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const persistSchedules = async (updatedSchedules) => {
    const { error: upsertErr } = await supabase?.from('management_settings')?.upsert(
      { setting_key: SETTING_KEY, setting_value: JSON.stringify(updatedSchedules) },
      { onConflict: 'setting_key' }
    );
    if (upsertErr) throw upsertErr;
  };

  const persistTemplates = async (updatedTemplates) => {
    const { error: upsertErr } = await supabase?.from('management_settings')?.upsert(
      { setting_key: TEMPLATES_KEY, setting_value: JSON.stringify(updatedTemplates) },
      { onConflict: 'setting_key' }
    );
    if (upsertErr) throw upsertErr;
  };

  // ── Schedule CRUD ──────────────────────────────────────────────────────────
  const handleNewSchedule = () => {
    setEditingSchedule(null);
    setConfig({ ...DEFAULT_CONFIG, id: `sched_${Date.now()}`, name: 'New Schedule' });
    setView('editor');
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setConfig({ ...DEFAULT_CONFIG, ...schedule });
    setView('editor');
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    setError(null);
    try {
      const scheduleToSave = { ...config, id: config?.id || `sched_${Date.now()}` };
      let updated;
      if (editingSchedule) {
        updated = schedules?.map(s => s?.id === scheduleToSave?.id ? scheduleToSave : s);
      } else {
        updated = [...schedules, scheduleToSave];
      }
      await persistSchedules(updated);
      setSchedules(updated);
      setSaved(true);
      setTimeout(() => { setSaved(false); setView('schedules'); }, 1500);
    } catch (err) {
      setError(err?.message || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePause = async (scheduleId) => {
    try {
      let updated = schedules?.map(s =>
        s?.id === scheduleId ? { ...s, paused: !s?.paused } : s
      );
      await persistSchedules(updated);
      setSchedules(updated);
    } catch (err) {
      setError('Failed to update schedule status.');
    }
  };

  const handleCloneSchedule = async (schedule) => {
    try {
      const cloned = {
        ...schedule,
        id: `sched_${Date.now()}`,
        name: `${schedule?.name} (Copy)`,
        enabled: false,
        paused: false,
      };
      let updated = [...schedules, cloned];
      await persistSchedules(updated);
      setSchedules(updated);
    } catch (err) {
      setError('Failed to clone schedule.');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      let updated = schedules?.filter(s => s?.id !== scheduleId);
      await persistSchedules(updated);
      setSchedules(updated);
    } catch (err) {
      setError('Failed to delete schedule.');
    }
  };

  // ── Template CRUD ──────────────────────────────────────────────────────────
  const handleSaveAsTemplate = async () => {
    if (!saveAsTemplateName?.trim()) return;
    try {
      const template = {
        id: `tmpl_${Date.now()}`,
        name: saveAsTemplateName?.trim(),
        frequency: config?.frequency,
        yearRange: config?.yearRange,
        selectedMetrics: config?.selectedMetrics,
        includeProviderBreakdown: config?.includeProviderBreakdown,
        includeMonthlyTrends: config?.includeMonthlyTrends,
        createdAt: new Date()?.toISOString(),
      };
      let updated = [...templates, template];
      await persistTemplates(updated);
      setTemplates(updated);
      setSaveAsTemplateName('');
      setShowSaveTemplate(false);
    } catch (err) {
      setError('Failed to save template.');
    }
  };

  const handleApplyTemplate = (template) => {
    setConfig(prev => ({
      ...prev,
      frequency: template?.frequency,
      yearRange: template?.yearRange,
      selectedMetrics: template?.selectedMetrics,
      includeProviderBreakdown: template?.includeProviderBreakdown,
      includeMonthlyTrends: template?.includeMonthlyTrends,
    }));
    setView('editor');
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      let updated = templates?.filter(t => t?.id !== templateId);
      await persistTemplates(updated);
      setTemplates(updated);
    } catch (err) {
      setError('Failed to delete template.');
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleSendTest = async () => {
    setSendingTest(true);
    setError(null);
    try {
      const allRecipients = [
        ...roleRecipients?.filter(r => config?.recipients?.includes(r?.id))?.map(r => ({ email: r?.email, name: r?.full_name })),
        ...(config?.customRecipients || []),
      ];
      if (!allRecipients?.length) {
        setError('Please add at least one recipient before sending a test.');
        setSendingTest(false);
        return;
      }
      await Promise.all(allRecipients?.map(async (recipient) => {
        await supabase?.functions?.invoke('send-email', {
          body: {
            email_type: 'year_comparison_report',
            recipient_email: recipient?.email,
            recipient_name: recipient?.name,
            data: {
              report_type: 'Year Comparison Report (Test)',
              frequency: config?.frequency,
              year_range: config?.yearRange,
              metrics: config?.selectedMetrics,
              app_url: 'https://nudentalr1699.builtwithrocket.new',
            },
          },
        });
      }));
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to send test email.');
    } finally {
      setSendingTest(false);
    }
  };

  const toggleMetric = (key) => {
    setConfig(prev => ({
      ...prev,
      selectedMetrics: prev?.selectedMetrics?.includes(key)
        ? prev?.selectedMetrics?.filter(k => k !== key)
        : [...(prev?.selectedMetrics || []), key],
    }));
  };

  const toggleRoleRecipient = (id) => {
    setConfig(prev => ({
      ...prev,
      recipients: prev?.recipients?.includes(id)
        ? prev?.recipients?.filter(r => r !== id)
        : [...(prev?.recipients || []), id],
    }));
  };

  const addCustomRecipient = () => {
    if (!newEmail?.trim() || !newEmail?.includes('@')) return;
    setConfig(prev => ({
      ...prev,
      customRecipients: [...(prev?.customRecipients || []), { email: newEmail?.trim(), name: newName?.trim() || newEmail?.trim() }],
    }));
    setNewEmail('');
    setNewName('');
  };

  const removeCustomRecipient = (email) => {
    setConfig(prev => ({
      ...prev,
      customRecipients: prev?.customRecipients?.filter(r => r?.email !== email),
    }));
  };

  const totalRecipients = (config?.recipients?.length || 0) + (config?.customRecipients?.length || 0);

  if (!isOpen) return null;

  // ── Schedules List View ────────────────────────────────────────────────────
  const renderSchedulesList = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader2" size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Icon name="AlertCircle" size={14} color="#dc2626" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Schedules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Report Schedules</p>
              <button
                onClick={handleNewSchedule}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Icon name="Plus" size={12} />
                New Schedule
              </button>
            </div>
            {schedules?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border rounded-xl">
                <Icon name="CalendarClock" size={32} className="text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">No schedules yet</p>
                <p className="text-xs text-muted-foreground mb-3">Create your first report schedule to get started</p>
                <button
                  onClick={handleNewSchedule}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create Schedule
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules?.map(schedule => (
                  <ScheduleItem
                    key={schedule?.id}
                    schedule={schedule}
                    onEdit={handleEditSchedule}
                    onTogglePause={handleTogglePause}
                    onClone={handleCloneSchedule}
                    onDelete={handleDeleteSchedule}
                    isActive={editingSchedule?.id === schedule?.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Report Templates
                <span className="ml-2 px-1.5 py-0.5 bg-muted rounded-full text-[10px]">{templates?.length}</span>
              </p>
              <button
                onClick={() => setView('templates')}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Manage Templates →
              </button>
            </div>
            {templates?.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No templates saved yet. Save a schedule configuration as a template to reuse it.</p>
            ) : (
              <div className="space-y-2">
                {templates?.slice(0, 3)?.map(template => (
                  <TemplateCard
                    key={template?.id}
                    template={template}
                    onApply={(t) => { handleApplyTemplate(t); handleNewSchedule(); }}
                    onDelete={handleDeleteTemplate}
                  />
                ))}
                {templates?.length > 3 && (
                  <button onClick={() => setView('templates')} className="text-xs text-indigo-600 hover:underline">
                    View all {templates?.length} templates →
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ── Templates Library View ─────────────────────────────────────────────────
  const renderTemplatesView = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Templates</p>
        <button
          onClick={() => setView('schedules')}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Icon name="ArrowLeft" size={12} /> Back
        </button>
      </div>
      {templates?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
          <Icon name="BookOpen" size={32} className="text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No templates yet</p>
          <p className="text-xs text-muted-foreground">Create a schedule and save it as a template to reuse configurations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates?.map(template => (
            <TemplateCard
              key={template?.id}
              template={template}
              onApply={(t) => { handleApplyTemplate(t); handleNewSchedule(); }}
              onDelete={handleDeleteTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Editor View ────────────────────────────────────────────────────────────
  const renderEditorView = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <Icon name="AlertCircle" size={14} color="#dc2626" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Schedule Name */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Schedule Name</label>
        <input
          type="text"
          value={config?.name || ''}
          onChange={e => setConfig(prev => ({ ...prev, name: e?.target?.value }))}
          placeholder="e.g. Monthly Executive Report"
          className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Enable + Pause Toggles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
          <div>
            <p className="text-xs font-semibold text-foreground">Enable</p>
            <p className="text-[10px] text-muted-foreground">Auto-send reports</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev?.enabled }))}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${config?.enabled ? 'bg-indigo-600' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config?.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
          <div>
            <p className="text-xs font-semibold text-foreground">Paused</p>
            <p className="text-[10px] text-muted-foreground">Temporarily stop</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, paused: !prev?.paused }))}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${config?.paused ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config?.paused ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Report Frequency</p>
        <div className="grid grid-cols-2 gap-3">
          {FREQUENCY_OPTIONS?.map(opt => (
            <button
              key={opt?.value}
              onClick={() => setConfig(prev => ({ ...prev, frequency: opt?.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                config?.frequency === opt?.value
                  ? 'border-indigo-500 bg-indigo-50' : 'border-border bg-muted/20 hover:border-indigo-300'
              }`}
            >
              <p className={`text-sm font-semibold ${config?.frequency === opt?.value ? 'text-indigo-700' : 'text-foreground'}`}>{opt?.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt?.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Year Range */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Year Range</p>
        <div className="flex items-center gap-2">
          {YEAR_RANGE_OPTIONS?.map(opt => (
            <button
              key={opt?.value}
              onClick={() => setConfig(prev => ({ ...prev, yearRange: opt?.value }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                config?.yearRange === opt?.value
                  ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-muted text-muted-foreground border-border hover:border-indigo-400'
              }`}
            >
              {opt?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Included Metrics</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfig(prev => ({ ...prev, selectedMetrics: METRIC_OPTIONS?.map(m => m?.key) }))}
              className="text-xs text-indigo-600 hover:underline"
            >
              Select All
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => setConfig(prev => ({ ...prev, selectedMetrics: [] }))}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {METRIC_OPTIONS?.map(metric => (
            <label
              key={metric?.key}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                config?.selectedMetrics?.includes(metric?.key)
                  ? 'border-indigo-300 bg-indigo-50' : 'border-border hover:bg-muted/30'
              }`}
            >
              <input
                type="checkbox"
                checked={config?.selectedMetrics?.includes(metric?.key)}
                onChange={() => toggleMetric(metric?.key)}
                className="w-3.5 h-3.5 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <span className={`text-xs font-medium ${config?.selectedMetrics?.includes(metric?.key) ? 'text-indigo-700' : 'text-foreground'}`}>
                {metric?.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Report Sections */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Report Sections</p>
        <div className="space-y-2">
          {[
            { key: 'includeProviderBreakdown', label: 'Provider Breakdown', desc: 'Per-provider production and collections by year' },
            { key: 'includeMonthlyTrends', label: 'Monthly Trends', desc: 'Month-by-month comparison charts (Jan–Dec)' },
          ]?.map(opt => (
            <label key={opt?.key} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={config?.[opt?.key]}
                onChange={() => setConfig(prev => ({ ...prev, [opt?.key]: !prev?.[opt?.key] }))}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{opt?.label}</p>
                <p className="text-xs text-muted-foreground">{opt?.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Role-based Recipients */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recipients — System Users</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {roleRecipients?.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No admin/regional users found</p>
          ) : roleRecipients?.map(profile => (
            <label
              key={profile?.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={config?.recipients?.includes(profile?.id)}
                onChange={() => toggleRoleRecipient(profile?.id)}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground capitalize">
                {profile?.role?.replace('_', ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Recipients */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Custom Recipients</p>
        {(config?.customRecipients || [])?.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {config?.customRecipients?.map(r => (
              <div key={r?.email} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border">
                <Icon name="Mail" size={13} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{r?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r?.email}</p>
                </div>
                <button
                  onClick={() => removeCustomRecipient(r?.email)}
                  className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                >
                  <Icon name="X" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e?.target?.value)}
            className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            placeholder="Email address"
            value={newEmail}
            onChange={e => setNewEmail(e?.target?.value)}
            onKeyDown={e => e?.key === 'Enter' && addCustomRecipient()}
            className="flex-[2] text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addCustomRecipient}
            disabled={!newEmail?.trim() || !newEmail?.includes('@')}
            className="px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Icon name="Plus" size={14} />
          </button>
        </div>
      </div>

      {totalRecipients > 0 && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <Icon name="Users" size={14} color="#4f46e5" />
          <p className="text-xs text-indigo-700">
            <strong>{totalRecipients}</strong> recipient{totalRecipients !== 1 ? 's' : ''} will receive this report
          </p>
        </div>
      )}

      {/* Save as Template */}
      <div className="border-t border-border pt-4">
        {showSaveTemplate ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Template name…"
              value={saveAsTemplateName}
              onChange={e => setSaveAsTemplateName(e?.target?.value)}
              onKeyDown={e => e?.key === 'Enter' && handleSaveAsTemplate()}
              className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSaveAsTemplate}
              disabled={!saveAsTemplateName?.trim()}
              className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setShowSaveTemplate(false); setSaveAsTemplateName(''); }}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveTemplate(true)}
            className="flex items-center gap-2 text-xs text-indigo-600 hover:underline font-medium"
          >
            <Icon name="BookmarkPlus" size={13} />
            Save current configuration as template
          </button>
        )}
      </div>
    </div>
  );

  // ── View Titles ────────────────────────────────────────────────────────────
  const viewTitles = {
    schedules: { title: 'Report Schedules', subtitle: 'Manage and configure auto-delivery schedules' },
    editor: { title: editingSchedule ? 'Edit Schedule' : 'New Schedule', subtitle: 'Configure report delivery settings' },
    templates: { title: 'Templates Library', subtitle: 'Saved report configurations for quick reuse' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="CalendarClock" size={18} color="#4f46e5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{viewTitles?.[view]?.title}</h2>
              <p className="text-xs text-muted-foreground">{viewTitles?.[view]?.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher for schedules/templates */}
            {view !== 'editor' && (
              <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-lg p-1">
                <button
                  onClick={() => setView('schedules')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${view === 'schedules' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Schedules
                </button>
                <button
                  onClick={() => setView('templates')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${view === 'templates' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Templates
                </button>
              </div>
            )}
            {view === 'editor' && (
              <button
                onClick={() => setView('schedules')}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="ArrowLeft" size={13} /> Back
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        {view === 'schedules' && renderSchedulesList()}
        {view === 'templates' && renderTemplatesView()}
        {view === 'editor' && renderEditorView()}

        {/* Footer */}
        {view === 'editor' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={handleSendTest}
              disabled={sendingTest || testSent || totalRecipients === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {testSent ? (
                <><Icon name="CheckCircle" size={13} className="text-emerald-500" /> Test Sent!</>
              ) : sendingTest ? (
                <><Icon name="Loader2" size={13} className="animate-spin" /> Sending…</>
              ) : (
                <><Icon name="Send" size={13} /> Send Test</>
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('schedules')}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSchedule}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleYearComparisonModal;
