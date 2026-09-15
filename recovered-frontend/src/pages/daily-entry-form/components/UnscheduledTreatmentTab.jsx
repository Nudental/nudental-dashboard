import { dashboardFetch as fetch } from '../../../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../../../config/dashboardEnvironment';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchUnscheduledTreatment } from '../../../services/eodTreatmentService';
import { OFFICE_LIST, getOfficeNameById } from '../../../constants/offices';
import { useOffice } from '../../../contexts/OfficeContext';
import { supabase } from '../../../lib/supabase';
import {
  safeDisplayNum,
  formatEodCurrency,
  formatEodCount,
  formatEodDate,
  formatEodDateTime,
} from '../../../services/eodReportService';

const NA = '—';
const API_BASE = DASHBOARD_API_ORIGIN + "/v2";
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

const buildHeaders = () => ({
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
});

function fmtPct(value, fallback = NA) {
  const n = safeDisplayNum(value);
  if (n === null) return fallback;
  return `${(n * (Math.abs(n) <= 1 ? 100 : 1))?.toFixed(1)}%`;
}

function fmtBool(value) {
  if (value === true || value === 'true' || value === 1) return 'Yes';
  if (value === false || value === 'false' || value === 0) return 'No';
  return NA;
}

// ─── Outcome options ──────────────────────────────────────────────────────────
const OUTCOME_OPTIONS = [
  { value: 'scheduled',        label: 'Scheduled' },
  { value: 'left_message',     label: 'Left Message' },
  { value: 'no_answer',        label: 'No Answer' },
  { value: 'not_interested',   label: 'Not Interested' },
  { value: 'wants_callback',   label: 'Wants Callback' },
  { value: 'financial_concern',label: 'Financial Concern' },
  { value: 'insurance_issue',  label: 'Insurance Issue' },
  { value: 'already_scheduled',label: 'Already Scheduled' },
  { value: 'wrong_number',     label: 'Wrong Number' },
  { value: 'do_not_call',      label: 'Do Not Call' },
  { value: 'other',            label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high',   label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low',    label: 'Low' },
];

// ─── Workflow status badge ────────────────────────────────────────────────────
const WORKFLOW_STATUS_STYLES = {
  pending:     'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  in_progress: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  scheduled:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  completed:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  deferred:    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  dismissed:   'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800',
  do_not_call: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
};

const PRIORITY_STYLES = {
  urgent: 'bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200',
  high:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  normal: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  low:    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
};

function WorkflowStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-muted-foreground">{NA}</span>;
  const style = WORKFLOW_STATUS_STYLES?.[status?.toLowerCase()] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200';
  const label = status?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${style}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-muted-foreground">{NA}</span>;
  const style = PRIORITY_STYLES?.[priority?.toLowerCase()] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
  const label = priority?.replace(/\b\w/g, c => c?.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style}`}>
      {label}
    </span>
  );
}

function NotSyncedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
      <Icon name="AlertCircle" size={9} />Not Synced
    </span>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────
const ScoreCard = ({ label, value, sub, accent }) => (
  <div className={`bg-card border rounded-xl p-4 flex flex-col gap-1 ${accent ? `border-l-4 ${accent}` : 'border-border'}`}>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className="text-lg font-bold text-foreground">{value ?? NA}</p>
    {sub && <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>}
  </div>
);

const WorkflowChip = ({ label, value, accent }) => {
  const n = safeDisplayNum(value);
  const display = n === null ? NA : String(n);
  return (
    <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg border text-center min-w-[80px] ${accent || 'bg-muted/30 border-border'}`}>
      <span className="text-base font-bold text-foreground leading-tight">{display}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</span>
    </div>
  );
};

const InfoNote = ({ children, variant = 'blue' }) => {
  const styles = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    gray: 'bg-muted/40 border-border text-muted-foreground',
    green: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
  };
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 border rounded-lg text-xs leading-relaxed ${styles?.[variant]}`}>
      <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <Icon name="Loader" size={28} className="animate-spin" color="var(--color-primary)" />
    <p className="text-sm text-muted-foreground">Loading unscheduled treatment queue…</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
      <Icon name="AlertCircle" size={22} color="var(--color-destructive)" />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold text-foreground mb-1">Failed to load</p>
      <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      <Icon name="RefreshCw" size={14} />Retry
    </button>
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const styles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${styles?.[type] || styles?.success}`}>
      <Icon name={type === 'error' ? 'AlertCircle' : 'CheckCircle'} size={16} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><Icon name="X" size={14} /></button>
    </div>
  );
};

// ─── Modal backdrop ───────────────────────────────────────────────────────────
const ModalBackdrop = ({ onClose, children }) => (
  <div
    className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    onClick={e => { if (e?.target === e?.currentTarget) onClose(); }}
  >
    {children}
  </div>
);

// ─── Log Contact Modal ────────────────────────────────────────────────────────
const LogContactModal = ({ patient, onClose, onSuccess }) => {
  const workflow = patient?.workflow;
  const queueId = workflow?.queue_id;

  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledApptId, setScheduledApptId] = useState('');
  const [treatmentValue, setTreatmentValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const showScheduledDate = outcome === 'scheduled' || outcome === 'already_scheduled';
  const showFollowUpHelper = ['wants_callback', 'financial_concern', 'insurance_issue']?.includes(outcome) && !followUpDate;
  const showScheduledHelper = showScheduledDate && !scheduledDate;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!outcome) { setSubmitError('Outcome is required.'); return; }
    if (!queueId) { setSubmitError('No queue ID found for this patient. Run queue sync first.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase?.rpc('log_unscheduled_treatment_contact', {
        p_queue_id: queueId,
        p_outcome: outcome,
        p_notes: notes || null,
        p_follow_up_date: followUpDate || null,
        p_scheduled_date: scheduledDate || null,
        p_scheduled_appt_id: scheduledApptId || null,
        p_treatment_value: treatmentValue !== '' ? parseFloat(treatmentValue) : null,
      });
      if (error) throw error;
      onSuccess('Contact logged successfully.');
    } catch (err) {
      setSubmitError(err?.message || 'Failed to log contact. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="Phone" size={16} color="var(--color-primary)" />
            <h2 className="text-base font-semibold text-foreground">Log Contact</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Patient info */}
        <div className="px-5 py-3 bg-muted/20 border-b border-border">
          <p className="text-sm font-semibold text-foreground">{patient?.patient_name ?? NA}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>Total Value: <strong className="text-foreground">{formatEodCurrency(patient?.total_value)}</strong></span>
            <span>Procedures: <strong className="text-foreground">{formatEodCount(patient?.procedure_count)}</strong></span>
          </div>
        </div>

        {/* Safety note */}
        <div className="px-5 pt-3">
          <InfoNote variant="gray">
            Logging an outcome records an internal follow-up note only. No external message is sent.
          </InfoNote>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={outcome}
              onChange={e => setOutcome(e?.target?.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select outcome…</option>
              {OUTCOME_OPTIONS?.map(o => (
                <option key={o?.value} value={o?.value}>{o?.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e?.target?.value)}
              rows={3}
              placeholder="Internal follow-up notes…"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Follow-up date */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Follow-Up Date <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="date"
              value={followUpDate}
              onChange={e => setFollowUpDate(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showFollowUpHelper && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Icon name="AlertCircle" size={11} />Follow-up date is recommended for this outcome.
              </p>
            )}
          </div>

          {/* Scheduled date — prominent when outcome is scheduled */}
          <div className={showScheduledDate ? 'p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-700 rounded-lg' : ''}>
            <label className={`block text-xs font-semibold mb-1.5 ${showScheduledDate ? 'text-green-800 dark:text-green-200' : 'text-foreground'}`}>
              Scheduled Date <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showScheduledHelper && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-1 flex items-center gap-1">
                <Icon name="Info" size={11} />Add scheduled date if known.
              </p>
            )}
          </div>

          {/* Advanced fields */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none flex items-center gap-1">
              <Icon name="ChevronRight" size={12} className="group-open:rotate-90 transition-transform" />
              Advanced fields (optional)
            </summary>
            <div className="mt-3 space-y-3 pl-4 border-l border-border">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Scheduled Appointment ID</label>
                <input
                  type="text"
                  value={scheduledApptId}
                  onChange={e => setScheduledApptId(e?.target?.value)}
                  placeholder="Appointment ID if known…"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Treatment Value Discussed ($)</label>
                <input
                  type="number"
                  value={treatmentValue}
                  onChange={e => setTreatmentValue(e?.target?.value)}
                  placeholder="e.g. 1200"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </details>

          {/* Error */}
          {submitError && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-300">
              <Icon name="AlertCircle" size={13} className="flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">
              Internal workflow only. Does not call/text/email patients or write to Dentrix.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !outcome}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
                {submitting ? 'Saving…' : 'Log Contact'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
};

// ─── Assign Modal ─────────────────────────────────────────────────────────────
const AssignModal = ({ patient, officeId, onClose, onSuccess }) => {
  const workflow = patient?.workflow;
  const queueId = workflow?.queue_id;

  const [assignees, setAssignees] = useState([]);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [assigneesError, setAssigneesError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [priority, setPriority] = useState(workflow?.priority || 'normal');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!officeId) {
      setAssigneesError('No office ID available. Cannot load assignees.');
      setAssigneesLoading(false);
      return;
    }
    const fetchAssignees = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/eod/unscheduled-treatment/assignees?officeId=${encodeURIComponent(officeId)}`,
          { headers: buildHeaders() }
        );
        if (!res?.ok) throw new Error(`Failed to load assignees: ${res.status}`);
        const json = await res?.json();
        setAssignees(Array.isArray(json) ? json : json?.assignees || []);
      } catch (err) {
        setAssigneesError(err?.message || 'Failed to load assignees.');
      } finally {
        setAssigneesLoading(false);
      }
    };
    fetchAssignees();
  }, [officeId]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedUserId) { setSubmitError('Please select an assignee.'); return; }
    if (!queueId) { setSubmitError('No queue ID found for this patient.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase?.rpc('assign_unscheduled_treatment_queue_item', {
        p_queue_id: queueId,
        p_assigned_to: selectedUserId,
        p_priority: priority || null,
      });
      if (error) throw error;
      onSuccess('Patient assigned successfully.');
    } catch (err) {
      const msg = err?.message || 'Failed to assign. Please try again.';
      const isPermission = msg?.toLowerCase()?.includes('permission') || msg?.toLowerCase()?.includes('policy') || msg?.toLowerCase()?.includes('denied');
      setSubmitError(isPermission ? 'Office manager or admin role required to assign patients.' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="UserCheck" size={16} color="var(--color-primary)" />
            <h2 className="text-base font-semibold text-foreground">Assign Patient</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Patient info */}
        <div className="px-5 py-3 bg-muted/20 border-b border-border">
          <p className="text-sm font-semibold text-foreground">{patient?.patient_name ?? NA}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>Total Value: <strong className="text-foreground">{formatEodCurrency(patient?.total_value)}</strong></span>
            {workflow?.assigned_to_name && (
              <span>Currently: <strong className="text-foreground">{workflow?.assigned_to_name}</strong></span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Assignee picker */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Assign To <span className="text-red-500">*</span>
            </label>
            {assigneesLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground">
                <Icon name="Loader" size={13} className="animate-spin" />Loading assignees…
              </div>
            ) : assigneesError ? (
              <div className="px-3 py-2 border border-red-200 rounded-lg text-xs text-red-600 dark:text-red-400">
                {assigneesError}
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e?.target?.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select assignee…</option>
                {assignees?.map(a => (
                  <option key={a?.user_id} value={a?.user_id}>
                    {a?.name}{a?.role ? ` (${a?.role?.replace(/_/g, ' ')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PRIORITY_OPTIONS?.map(p => (
                <option key={p?.value} value={p?.value}>{p?.label}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {submitError && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-300">
              <Icon name="AlertCircle" size={13} className="flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-tight max-w-[180px]">
              Internal workflow only. Does not write to Dentrix.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedUserId || assigneesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="UserCheck" size={14} />}
                {submitting ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
};

// ─── Contact History Drawer ───────────────────────────────────────────────────
const ContactHistoryDrawer = ({ patient, onClose }) => {
  const workflow = patient?.workflow;
  const queueId = workflow?.queue_id;

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!queueId) {
      setError('No queue ID available for this patient.');
      setLoading(false);
      return;
    }
    const fetchContacts = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/eod/unscheduled-treatment/${encodeURIComponent(queueId)}/contacts`,
          { headers: buildHeaders() }
        );
        if (!res?.ok) throw new Error(`Failed to load contact history: ${res.status}`);
        const json = await res?.json();
        setContacts(Array.isArray(json) ? json : json?.contacts || []);
      } catch (err) {
        setError(err?.message || 'Failed to load contact history.');
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [queueId]);

  const outcomeLabel = (outcome) => {
    const found = OUTCOME_OPTIONS?.find(o => o?.value === outcome);
    return found ? found?.label : (outcome?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase()) || NA);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="History" size={16} color="var(--color-primary)" />
            <h2 className="text-base font-semibold text-foreground">Contact History</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Patient summary */}
        <div className="px-5 py-3 bg-muted/20 border-b border-border flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">{patient?.patient_name ?? NA}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            <span>Value: <strong className="text-foreground">{formatEodCurrency(patient?.total_value)}</strong></span>
            <span>Procedures: <strong className="text-foreground">{formatEodCount(patient?.procedure_count)}</strong></span>
            {workflow?.queue_status && (
              <span className="flex items-center gap-1">Status: <WorkflowStatusBadge status={workflow?.queue_status} /></span>
            )}
            {safeDisplayNum(workflow?.contact_attempt_count) !== null && (
              <span>Attempts: <strong className="text-foreground">{safeDisplayNum(workflow?.contact_attempt_count)}</strong></span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Icon name="Loader" size={18} className="animate-spin" />
              <span className="text-sm">Loading contact history…</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-300">
              <Icon name="AlertCircle" size={13} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && contacts?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Icon name="MessageSquare" size={28} color="var(--color-muted-foreground)" />
              <p className="text-sm text-muted-foreground">No contacts logged yet.</p>
            </div>
          )}
          {!loading && !error && contacts?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{contacts?.length} contact{contacts?.length !== 1 ? 's' : ''} — most recent first</p>
              {contacts?.map((c, i) => (
                <div key={c?.contact_id || i} className="bg-muted/20 border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <WorkflowStatusBadge status={c?.outcome} />
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {c?.contact_at ? formatEodDateTime(c?.contact_at) : NA}
                    </span>
                  </div>
                  <div className="text-xs text-foreground font-medium">
                    {outcomeLabel(c?.outcome)}
                  </div>
                  {c?.contacted_by_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="User" size={11} />
                      <span>{c?.contacted_by_name}</span>
                    </div>
                  )}
                  {c?.notes && (
                    <p className="text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2 leading-relaxed">
                      {c?.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {c?.follow_up_date && (
                      <span className="flex items-center gap-1">
                        <Icon name="Calendar" size={10} />Follow-up: <strong className="text-foreground">{formatEodDate(c?.follow_up_date)}</strong>
                      </span>
                    )}
                    {c?.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Icon name="CalendarCheck" size={10} />Scheduled: <strong className="text-foreground">{formatEodDate(c?.scheduled_date)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Workflow Cell (compact summary for table column) ─────────────────────────
const WorkflowCell = ({ workflow }) => {
  if (!workflow || workflow?.has_workflow_row === false) {
    return <NotSyncedBadge />;
  }

  const isFollowUpOverdue = (() => {
    const fd = workflow?.follow_up_date;
    if (!fd) return false;
    return new Date(fd) < new Date();
  })();

  const attempts = safeDisplayNum(workflow?.contact_attempt_count);

  return (
    <div className="flex flex-col gap-1 min-w-[130px]">
      {/* Status + Priority row */}
      <div className="flex flex-wrap items-center gap-1">
        <WorkflowStatusBadge status={workflow?.queue_status} />
        {workflow?.priority && workflow?.priority !== 'normal' && (
          <PriorityBadge priority={workflow?.priority} />
        )}
      </div>
      {/* Assigned To */}
      {workflow?.assigned_to_name && (
        <div className="text-[11px] text-muted-foreground leading-tight truncate max-w-[160px]" title={workflow?.assigned_to_name}>
          <span className="text-muted-foreground/70">Assigned:</span> {workflow?.assigned_to_name}
        </div>
      )}
      {/* Attempts */}
      <div className="text-[11px] text-muted-foreground leading-tight">
        <span className="text-muted-foreground/70">Attempts:</span> {attempts !== null ? attempts : 0}
      </div>
      {/* Follow-up date */}
      {workflow?.follow_up_date ? (
        <div className={`text-[11px] leading-tight font-medium ${isFollowUpOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          <span className="font-normal opacity-80">Follow-up:</span> {formatEodDate(workflow?.follow_up_date)}
          {isFollowUpOverdue && <span className="ml-1 text-[10px] font-semibold">(Overdue)</span>}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground/60 leading-tight">
          <span className="opacity-70">Follow-up:</span> {NA}
        </div>
      )}
      {/* Last outcome */}
      {workflow?.last_contact_outcome && (
        <div className="text-[11px] text-muted-foreground leading-tight truncate max-w-[160px]" title={workflow?.last_contact_outcome}>
          <span className="opacity-70">Outcome:</span> {workflow?.last_contact_outcome?.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
};

// ─── Procedure details (expanded row) ────────────────────────────────────────
const ExpandedProcedures = ({ procedures }) => {
  if (!procedures?.length) return <p className="text-xs text-muted-foreground py-2">No procedure details available.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {['ADA Code', 'Description', 'Category', 'Amount', 'Provider', 'Entry Date', 'Service Date', 'Teeth', 'Oral Cavity', 'Bill to Ins.', 'Referred Out']?.map(h => (
              <th key={h} className="text-left py-1.5 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {procedures?.map((proc, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-1.5 px-2 font-mono">{proc?.ada_code ?? NA}</td>
              <td className="py-1.5 px-2">{proc?.description ?? NA}</td>
              <td className="py-1.5 px-2">{proc?.category ?? NA}</td>
              <td className="py-1.5 px-2 font-semibold">{formatEodCurrency(proc?.amount)}</td>
              <td className="py-1.5 px-2">{proc?.provider_name ?? proc?.provider ?? NA}</td>
              <td className="py-1.5 px-2 whitespace-nowrap">{formatEodDate(proc?.entry_date)}</td>
              <td className="py-1.5 px-2 whitespace-nowrap">{formatEodDate(proc?.service_date)}</td>
              <td className="py-1.5 px-2">{proc?.teeth ?? NA}</td>
              <td className="py-1.5 px-2">{proc?.oral_cavity ?? NA}</td>
              <td className="py-1.5 px-2">{fmtBool(proc?.bill_to_insurance)}</td>
              <td className="py-1.5 px-2">{fmtBool(proc?.referred_out)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Source Details panel (inside expanded row) ───────────────────────────────
const SourceDetailsPanel = ({ patient }) => {
  const primaryCategory = derivePrimaryCategory(patient);
  const latestPlanDate = deriveLatestPlanDate(patient);

  const DetailRow = ({ label, value }) => (
    <div className="flex gap-2">
      <span className="text-[11px] text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-foreground font-medium">{value ?? NA}</span>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
        <DetailRow label="Primary Category" value={primaryCategory} />
        <DetailRow label="Latest Plan Date" value={latestPlanDate ? formatEodDate(latestPlanDate) : null} />
        <DetailRow label="Bill to Insurance" value={fmtBool(patient?.bill_to_insurance)} />
        <DetailRow label="Referred Out" value={fmtBool(patient?.referred_out)} />
        {patient?.has_future_appointment !== undefined && patient?.has_future_appointment !== null && (
          <DetailRow label="Future Appointment" value={fmtBool(patient?.has_future_appointment)} />
        )}
      </div>
    </div>
  );
};

// ─── Workflow Details panel (inside expanded row) ─────────────────────────────
const WorkflowDetailsPanel = ({ workflow }) => {
  if (!workflow) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Workflow Details</p>
        <p className="text-xs text-muted-foreground italic">No workflow row for this patient.</p>
      </div>
    );
  }

  const latest = workflow?.latest_contact;

  const DetailRow = ({ label, value }) => (
    <div className="flex gap-2">
      <span className="text-[11px] text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-foreground font-medium">{value ?? NA}</span>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Workflow Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
        <DetailRow label="Queue Status" value={workflow?.queue_status ? <WorkflowStatusBadge status={workflow?.queue_status} /> : NA} />
        <DetailRow label="Priority" value={workflow?.priority ? <PriorityBadge priority={workflow?.priority} /> : NA} />
        <DetailRow label="Assigned To" value={workflow?.assigned_to_name ?? NA} />
        <DetailRow label="Assigned At" value={workflow?.assigned_at ? formatEodDateTime(workflow?.assigned_at) : NA} />
        <DetailRow label="Contact Attempts" value={safeDisplayNum(workflow?.contact_attempt_count) !== null ? String(safeDisplayNum(workflow?.contact_attempt_count)) : NA} />
        <DetailRow label="Last Contact" value={workflow?.last_contact_at ? formatEodDateTime(workflow?.last_contact_at) : NA} />
        <DetailRow label="Last Outcome" value={workflow?.last_contact_outcome ?? NA} />
        <DetailRow label="Follow-Up Date" value={workflow?.follow_up_date ? formatEodDate(workflow?.follow_up_date) : NA} />
        <DetailRow label="Last Synced At" value={workflow?.last_synced_at ? formatEodDateTime(workflow?.last_synced_at) : NA} />
      </div>

      {latest && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Latest Contact Notes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            <DetailRow label="Contacted By" value={latest?.contacted_by_name ?? NA} />
            <DetailRow label="Contact At" value={latest?.contact_at ? formatEodDateTime(latest?.contact_at) : NA} />
            <DetailRow label="Outcome" value={latest?.outcome ?? NA} />
            <DetailRow label="Follow-Up Date" value={latest?.follow_up_date ? formatEodDate(latest?.follow_up_date) : NA} />
            <DetailRow label="Scheduled Date" value={latest?.scheduled_date ? formatEodDate(latest?.scheduled_date) : NA} />
            {latest?.notes && (
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <span className="text-[11px] text-muted-foreground w-36 flex-shrink-0">Notes</span>
                <span className="text-[11px] text-foreground">{latest?.notes}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Derive helpers ───────────────────────────────────────────────────────────
function deriveHighestValueProc(patient) {
  if (patient?.highest_value_procedure && typeof patient?.highest_value_procedure === 'string' && patient?.highest_value_procedure?.trim()) {
    return patient?.highest_value_procedure?.trim();
  }
  const procs = patient?.procedures;
  if (!procs?.length) return null;
  const top = procs?.reduce((best, p) => {
    const amt = typeof p?.amount === 'number' ? p?.amount : parseFloat(p?.amount) || 0;
    const bestAmt = typeof best?.amount === 'number' ? best?.amount : parseFloat(best?.amount) || 0;
    return amt > bestAmt ? p : best;
  }, procs?.[0]);
  const label = [top?.ada_code, top?.description]?.filter(Boolean)?.join(' ')?.trim();
  return label || null;
}

function deriveLatestPlanDate(patient) {
  if (patient?.latest_treatment_plan_date) return patient?.latest_treatment_plan_date;
  const procs = patient?.procedures;
  if (procs?.length) {
    const dates = procs?.map(p => p?.entry_date)?.filter(Boolean)?.sort();
    if (dates?.length) return dates?.[dates?.length - 1];
  }
  if (patient?.treatment_plan_date) return patient?.treatment_plan_date;
  return null;
}

function deriveProvider(patient) {
  if (patient?.provider_name) return patient?.provider_name;
  if (patient?.provider) return patient?.provider;
  const procs = patient?.procedures;
  if (procs?.length) {
    const found = procs?.find(p => p?.provider_name);
    if (found) return found?.provider_name;
  }
  return null;
}

function derivePrimaryCategory(patient) {
  if (patient?.primary_category) return patient?.primary_category;
  const procs = patient?.procedures;
  if (procs?.length) {
    const found = procs?.find(p => p?.category);
    if (found) return found?.category;
  }
  return null;
}

// ─── Patient row ──────────────────────────────────────────────────────────────
const PatientRow = ({ patient, officeId, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [showLogContact, setShowLogContact] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);

  const highestValueProc = deriveHighestValueProc(patient);
  const latestPlanDate = deriveLatestPlanDate(patient);
  const providerName = deriveProvider(patient);
  const workflow = patient?.workflow;
  const hasWorkflowRow = workflow?.has_workflow_row !== false;

  const colSpan = 9;

  const handleActionSuccess = (message) => {
    setShowLogContact(false);
    setShowAssign(false);
    setToast({ message, type: 'success' });
    onRefresh?.();
  };

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Patient */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            <Icon name={expanded ? 'ChevronDown' : 'ChevronRight'} size={13} color="var(--color-muted-foreground)" />
            <span className="text-sm font-medium text-foreground">{patient?.patient_name ?? NA}</span>
          </div>
        </td>
        {/* Dentrix columns */}
        <td className="py-2.5 px-3 text-sm font-semibold">{formatEodCurrency(patient?.total_value)}</td>
        <td className="py-2.5 px-3 text-sm">{formatEodCount(patient?.procedure_count)}</td>
        <td className="py-2.5 px-3 text-sm max-w-[160px] truncate" title={highestValueProc ?? ''}>{highestValueProc ?? NA}</td>
        <td className="py-2.5 px-3 text-sm whitespace-nowrap">{formatEodDate(patient?.treatment_plan_date)}</td>
        <td className="py-2.5 px-3 text-sm max-w-[120px] truncate" title={providerName ?? ''}>{providerName ?? NA}</td>
        <td className="py-2.5 px-3 text-sm">
          {patient?.has_future_appointment === true ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
              <Icon name="Check" size={10} />Yes
            </span>
          ) : patient?.has_future_appointment === false ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
              <Icon name="X" size={10} />No
            </span>
          ) : NA}
        </td>

        {/* ── Compact Workflow column ── */}
        <td className="py-2.5 px-3 text-sm border-l border-blue-100 dark:border-blue-900/40">
          <WorkflowCell workflow={workflow} />
        </td>

        {/* Actions */}
        <td className="py-2.5 px-3 text-sm" onClick={e => e?.stopPropagation()}>
          {!hasWorkflowRow ? (
            <span
              className="text-xs text-muted-foreground italic cursor-help"
              title="No workflow row yet. Run queue sync first."
            >
              Not Synced
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-nowrap">
              <button
                onClick={() => setShowLogContact(true)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
                title="Log a contact outcome"
              >
                <Icon name="Phone" size={10} />Log
              </button>
              <button
                onClick={() => setShowAssign(true)}
                className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
                title="Assign this patient"
              >
                <Icon name="UserCheck" size={10} />Assign
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1 px-2 py-1 border border-border hover:bg-muted text-foreground rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
                title="View contact history"
              >
                <Icon name="History" size={10} />History
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={colSpan} className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Procedure Details</p>
            <ExpandedProcedures procedures={patient?.procedures} />
            <SourceDetailsPanel patient={patient} />
            <WorkflowDetailsPanel workflow={patient?.workflow} />
          </td>
        </tr>
      )}
      {/* Modals / Drawer */}
      {showLogContact && (
        <LogContactModal
          patient={patient}
          onClose={() => setShowLogContact(false)}
          onSuccess={handleActionSuccess}
        />
      )}
      {showAssign && (
        <AssignModal
          patient={patient}
          officeId={officeId}
          onClose={() => setShowAssign(false)}
          onSuccess={handleActionSuccess}
        />
      )}
      {showHistory && (
        <ContactHistoryDrawer
          patient={patient}
          onClose={() => setShowHistory(false)}
        />
      )}
      {toast && (
        <Toast
          message={toast?.message}
          type={toast?.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

// ─── Workflow Summary Section ─────────────────────────────────────────────────
const WorkflowSummarySection = ({ workflowSummary }) => {
  if (!workflowSummary) return null;
  const ws = workflowSummary;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="GitBranch" size={15} color="var(--color-primary)" />
          <p className="text-sm font-semibold text-foreground">Follow-Up Workflow Status</p>
          {safeDisplayNum(ws?.workflow_rows_matched) !== null && (
            <span className="text-xs text-muted-foreground">
              ({formatEodCount(ws?.workflow_rows_matched)} queue rows matched)
            </span>
          )}
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <WorkflowChip label="Pending"     value={ws?.pending}     accent="bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700" />
        <WorkflowChip label="In Progress" value={ws?.in_progress} accent="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700" />
        <WorkflowChip label="Scheduled"   value={ws?.scheduled}   accent="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-700" />
        <WorkflowChip label="Completed"   value={ws?.completed}   accent="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-700" />
        <WorkflowChip label="Deferred"    value={ws?.deferred}    accent="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700" />
        <WorkflowChip label="Dismissed"   value={ws?.dismissed}   accent="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" />
        <WorkflowChip label="Do Not Call" value={ws?.do_not_call} accent="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" />
      </div>

      {/* Assignment + follow-up chips */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
        <WorkflowChip label="Assigned"   value={ws?.assigned}   accent="bg-muted/30 border-border" />
        <WorkflowChip label="Unassigned" value={ws?.unassigned} accent="bg-muted/30 border-border" />
        {safeDisplayNum(ws?.follow_ups_overdue) !== null && safeDisplayNum(ws?.follow_ups_overdue) > 0 ? (
          <WorkflowChip label="Follow-Ups Overdue" value={ws?.follow_ups_overdue} accent="bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700" />
        ) : (
          <WorkflowChip label="Follow-Ups Overdue" value={ws?.follow_ups_overdue} accent="bg-muted/30 border-border" />
        )}
        {safeDisplayNum(ws?.follow_ups_due) !== null && safeDisplayNum(ws?.follow_ups_due) > 0 ? (
          <WorkflowChip label="Follow-Ups Due" value={ws?.follow_ups_due} accent="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700" />
        ) : (
          <WorkflowChip label="Follow-Ups Due" value={ws?.follow_ups_due} accent="bg-muted/30 border-border" />
        )}
      </div>

      {/* Source note */}
      <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
        Workflow status comes from Supabase queue/contact records. Treatment plan values remain Dentrix/FastAPI source data.
      </p>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const UnscheduledTreatmentTab = ({ selectedOfficeId: propOfficeId, selectedDate: propDate }) => {
  const { canSwitchOffice, selectedOfficeId: ctxOfficeId } = useOffice();

  const getTodayStr = () => new Date()?.toISOString()?.split('T')?.[0];

  const [localOfficeId, setLocalOfficeId] = useState(propOfficeId || ctxOfficeId || '');
  const [localDate, setLocalDate] = useState(propDate || getTodayStr());
  const [lookbackDays, setLookbackDays] = useState(90);
  const [search, setSearch] = useState('');
  const [minValue, setMinValue] = useState('');
  const [includeScheduled, setIncludeScheduled] = useState(false);
  const [includeReferredOut, setIncludeReferredOut] = useState(false);
  const [page, setPage] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);

  // Workflow filters (client-side)
  const [filterQueueStatus, setFilterQueueStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterFollowUp, setFilterFollowUp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (propOfficeId && !localOfficeId) setLocalOfficeId(propOfficeId);
  }, [propOfficeId]);

  useEffect(() => {
    if (propDate && !localDate) setLocalDate(propDate);
  }, [propDate]);

  const doFetch = useCallback(async () => {
    if (!localOfficeId || !localDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUnscheduledTreatment({
        officeId: localOfficeId,
        date: localDate,
        lookbackDays,
        includeScheduled,
        includeReferredOut,
        minValue: minValue !== '' ? parseFloat(minValue) : undefined,
        search: search || undefined,
        page,
        pageSize: 50,
      });
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load unscheduled treatment data.');
    } finally {
      setLoading(false);
    }
  }, [localOfficeId, localDate, lookbackDays, includeScheduled, includeReferredOut, minValue, search, page, fetchKey]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleRefresh = () => {
    setPage(1);
    setFetchKey(k => k + 1);
  };

  // Called after successful write actions to refresh the overlay
  const handleWriteSuccess = useCallback(() => {
    setFetchKey(k => k + 1);
  }, []);

  const summary = data?.summary;
  const workflowSummary = data?.workflow_summary;
  const rawPatients = data?.patients || [];
  const pagination = data?.pagination;
  const warnings = data?.warnings || [];
  const sourceFreshness = data?.source_freshness;
  const officeName = getOfficeNameById(localOfficeId) || localOfficeId;

  // Client-side workflow filter
  const patients = useMemo(() => {
    let list = rawPatients;
    if (filterQueueStatus) {
      list = list?.filter(p => p?.workflow?.queue_status === filterQueueStatus);
    }
    if (filterPriority) {
      list = list?.filter(p => p?.workflow?.priority === filterPriority);
    }
    if (filterAssignedTo) {
      const q = filterAssignedTo?.toLowerCase();
      list = list?.filter(p => (p?.workflow?.assigned_to_name || '')?.toLowerCase()?.includes(q));
    }
    if (filterFollowUp === 'overdue') {
      const now = new Date();
      list = list?.filter(p => {
        const fd = p?.workflow?.follow_up_date;
        return fd && new Date(fd) < now;
      });
    } else if (filterFollowUp === 'due') {
      const now = new Date();
      list = list?.filter(p => {
        const fd = p?.workflow?.follow_up_date;
        return fd && new Date(fd) >= now;
      });
    }
    return list;
  }, [rawPatients, filterQueueStatus, filterPriority, filterAssignedTo, filterFollowUp]);

  const hasWorkflowFilters = filterQueueStatus || filterPriority || filterAssignedTo || filterFollowUp;

  return (
    <div className="space-y-4">
      {/* Source Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-xl">
        <Icon name="Database" size={15} color="#2563EB" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong>Source:</strong> Dentrix/FastAPI treatment-plan procedures and appointment data. Workflow actions (Log Contact, Assign) are internal only — no external communications, no Dentrix writes.
        </p>
      </div>
      {/* Safety label */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border rounded-lg text-[11px] text-muted-foreground">
        <Icon name="ShieldCheck" size={12} />
        <span>Internal workflow only. This does not call/text/email patients and does not write to Dentrix.</span>
      </div>
      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Office Picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Office</label>
            {canSwitchOffice ? (
              <select
                value={localOfficeId}
                onChange={e => { setLocalOfficeId(e?.target?.value); setPage(1); }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select office…</option>
                {OFFICE_LIST?.map(o => (
                  <option key={o?.id} value={o?.id}>{o?.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm text-foreground">
                <Icon name="Lock" size={13} color="var(--color-muted-foreground)" />
                {officeName || 'Your office'}
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">As-of Date</label>
            <input
              type="date"
              value={localDate}
              onChange={e => { setLocalDate(e?.target?.value); setPage(1); }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Lookback */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Lookback Period</label>
            <select
              value={lookbackDays}
              onChange={e => { setLookbackDays(Number(e?.target?.value)); setPage(1); }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[
                { value: 30,   label: '30 days' },
                { value: 60,   label: '60 days' },
                { value: 90,   label: '90 days' },
                { value: 180,  label: '180 days' },
                { value: 365,  label: '365 days / 1 year' },
                { value: 730,  label: '730 days / 2 years' },
                { value: 1095, label: '1095 days / 3 years' },
                { value: 1460, label: '1460 days / 4 years' },
                { value: 1825, label: '1825 days / 5 years' },
                { value: 2190, label: '2190 days / 6 years' },
              ]?.map(opt => (
                <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
              ))}
            </select>
            {lookbackDays > 365 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 leading-snug">
                ⚠️ Historical lookback may include stale treatment plans and may take longer to load. Workflow queue/contact rows may only exist for synced patients.
              </p>
            )}
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Search Patient</label>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e?.target?.value); setPage(1); }}
              placeholder="Name or ID…"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Min Value */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Min Value ($)</label>
            <input
              type="number"
              value={minValue}
              onChange={e => { setMinValue(e?.target?.value); setPage(1); }}
              placeholder="e.g. 500"
              min="0"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Refresh */}
          <div className="flex items-end">
            <button
              onClick={handleRefresh}
              disabled={loading || !localOfficeId || !localDate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Icon name={loading ? 'Loader' : 'RefreshCw'} size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeScheduled}
              onChange={e => { setIncludeScheduled(e?.target?.checked); setPage(1); }}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-xs text-foreground">Include Scheduled</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeReferredOut}
              onChange={e => { setIncludeReferredOut(e?.target?.checked); setPage(1); }}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-xs text-foreground">Include Referred Out</span>
          </label>
        </div>
      </div>
      {/* Warnings */}
      {warnings?.length > 0 && (
        <div className="space-y-1.5">
          {warnings?.map((w, i) => (
            <InfoNote key={i} variant="amber">{typeof w === 'string' ? w : w?.message || JSON.stringify(w)}</InfoNote>
          ))}
        </div>
      )}
      {/* Source Freshness */}
      {sourceFreshness && (
        <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {sourceFreshness?.patient_procedures_sync && (
            <span><strong>Procedures sync:</strong> {formatEodDateTime(sourceFreshness?.patient_procedures_sync)}</span>
          )}
          {sourceFreshness?.appointments_sync && (
            <span><strong>Appointments sync:</strong> {formatEodDateTime(sourceFreshness?.appointments_sync)}</span>
          )}
        </div>
      )}
      {/* Limitation Note */}
      <InfoNote variant="gray">
        No procedure-to-appointment linkage for scheduled-not-completed detection. Nightly sync delay may be up to 24 hours.
      </InfoNote>
      {/* Loading / Error */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={handleRefresh} />}
      {/* Data sections */}
      {!loading && !error && data && (
        <>
          {/* ── Workflow Summary Section ── */}
          {workflowSummary && <WorkflowSummarySection workflowSummary={workflowSummary} />}

          {/* ── Dentrix Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <ScoreCard
              label="Unscheduled Patients"
              value={formatEodCount(summary?.total_unscheduled_patients ?? summary?.unscheduled_patients)}
              accent="border-l-primary"
              sub={undefined}
            />
            <ScoreCard
              label="Unscheduled Procedures"
              value={formatEodCount(summary?.total_unscheduled_procedures ?? summary?.unscheduled_procedures)}
              sub={undefined}
              accent={undefined}
            />
            <ScoreCard
              label="Unscheduled Value"
              value={formatEodCurrency(summary?.total_unscheduled_value ?? summary?.unscheduled_value)}
              accent="border-l-amber-400"
              sub={undefined}
            />
            <ScoreCard
              label="With Future Appt"
              value={formatEodCount(summary?.patients_with_future_appointment)}
              sub="Patients with a scheduled appointment"
              accent={undefined}
            />
            <ScoreCard
              label="Without Future Appt"
              value={formatEodCount(summary?.patients_without_future_appointment)}
              sub="Patients with no upcoming appointment"
              accent={undefined}
            />
            {(() => {
              const topCat = Array.isArray(summary?.top_categories)
                ? (summary?.top_categories?.[0]?.category ?? summary?.top_categories?.[0]?.name ?? summary?.top_categories?.[0])
                : summary?.top_category;
              const topProv = Array.isArray(summary?.top_providers)
                ? (summary?.top_providers?.[0]?.provider_name ?? summary?.top_providers?.[0]?.name ?? summary?.top_providers?.[0])
                : summary?.top_provider;
              if (topCat && typeof topCat === 'string') {
                return <ScoreCard label="Top Category" value={topCat} sub={undefined} accent={undefined} />;
              }
              if (topProv && typeof topProv === 'string') {
                return <ScoreCard label="Top Provider" value={topProv} sub={undefined} accent={undefined} />;
              }
              return null;
            })()}
          </div>

          {/* ── Workflow Filters (client-side) ── */}
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Filter" size={13} color="var(--color-muted-foreground)" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow Filters</p>
              {hasWorkflowFilters && (
                <button
                  onClick={() => { setFilterQueueStatus(''); setFilterPriority(''); setFilterAssignedTo(''); setFilterFollowUp(''); }}
                  className="ml-auto text-[11px] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Queue Status</label>
                <select
                  value={filterQueueStatus}
                  onChange={e => setFilterQueueStatus(e?.target?.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="deferred">Deferred</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="do_not_call">Do Not Call</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Priority</label>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e?.target?.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Assigned To</label>
                <input
                  type="text"
                  value={filterAssignedTo}
                  onChange={e => setFilterAssignedTo(e?.target?.value)}
                  placeholder="Name…"
                  className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Follow-Up</label>
                <select
                  value={filterFollowUp}
                  onChange={e => setFilterFollowUp(e?.target?.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="due">Due</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            {hasWorkflowFilters && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Showing {patients?.length} of {rawPatients?.length} patients (client-side filter applied)
              </p>
            )}
          </div>

          {/* ── Patient Queue Table ── */}
          {patients?.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Icon name="Users" size={28} color="var(--color-muted-foreground)" className="mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasWorkflowFilters
                  ? 'No patients match the current workflow filters.' : 'No unscheduled patients found for the selected filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Patient Queue
                  {pagination?.total_count !== undefined && pagination?.total_count !== null && !hasWorkflowFilters && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({formatEodCount(pagination?.total_count)} total)
                    </span>
                  )}
                  {hasWorkflowFilters && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({patients?.length} filtered)
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Click a row to expand procedures &amp; workflow</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      {/* Dentrix columns */}
                      {['Patient', 'Total Value', 'Procedures', 'Highest Value Proc.', 'Plan Date', 'Provider', 'Future Appt?']?.map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                      {/* Compact Workflow column */}
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap border-l border-blue-200 dark:border-blue-800">Workflow</th>
                      {/* Actions */}
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients?.map((patient, i) => (
                      <PatientRow
                        key={patient?.patient_id || i}
                        patient={patient}
                        officeId={localOfficeId}
                        onRefresh={handleWriteSuccess}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && !hasWorkflowFilters && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Page {pagination?.page ?? page} of {pagination?.total_pages ?? NA}
                    {pagination?.total_count !== undefined && pagination?.total_count !== null && (
                      <span className="ml-1">· {formatEodCount(pagination?.total_count)} total patients</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Icon name="ChevronLeft" size={13} />Prev
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(pagination?.page >= pagination?.total_pages) || loading}
                      className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next<Icon name="ChevronRight" size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {/* Empty state before first load */}
      {!loading && !error && !data && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Icon name="Calendar" size={28} color="var(--color-muted-foreground)" className="mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select an office and date, then click Refresh to load the queue.</p>
        </div>
      )}
    </div>
  );
};

export default UnscheduledTreatmentTab;
