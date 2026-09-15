import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInHours, isAfter } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { huddleService } from '../../services/huddleService';

// ─── SLA helpers ──────────────────────────────────────────────────────────────
const SLA_HOURS = 24;

const getSLAStatus = (submittedAt) => {
  if (!submittedAt) return { label: 'Unknown', color: 'gray', icon: 'Clock', urgent: false };
  const submitted = parseISO(submittedAt);
  const due = new Date(submitted.getTime() + SLA_HOURS * 60 * 60 * 1000);
  const now = new Date();
  const hoursLeft = differenceInHours(due, now);

  if (isAfter(now, due)) {
    return { label: 'Overdue', color: 'red', icon: 'AlertTriangle', urgent: true, hoursLeft: 0 };
  }
  if (hoursLeft <= 4) {
    return { label: `${hoursLeft}h left`, color: 'orange', icon: 'AlertCircle', urgent: true, hoursLeft };
  }
  if (hoursLeft <= 12) {
    return { label: `${hoursLeft}h left`, color: 'yellow', icon: 'Clock', urgent: false, hoursLeft };
  }
  return { label: `${hoursLeft}h left`, color: 'green', icon: 'CheckCircle', urgent: false, hoursLeft };
};

const SLA_COLOR_MAP = {
  red:    { badge: 'bg-red-100 text-red-800 border-red-200',       dot: 'bg-red-500' },
  orange: { badge: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  yellow: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  green:  { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  gray:   { badge: 'bg-gray-100 text-gray-600 border-gray-200',    dot: 'bg-gray-400' },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (val) => (val === null || val === undefined || val === '') ? '—' : val;

const fmtCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseFloat(val);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(num);
};

const fmtDate = (val, formatStr = 'EEE, MMM d, yyyy') => {
  if (!val) return '—';
  try { return format(parseISO(val), formatStr); } catch { return '—'; }
};

const fmtDateTime = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'MMM d, yyyy h:mm a'); } catch { return '—'; }
};

// ─── Status badge helpers ─────────────────────────────────────────────────────
const DR_STATUS_STYLES = {
  pending:             'bg-amber-100 text-amber-800 border-amber-200',
  pending_reapproval:  'bg-orange-100 text-orange-800 border-orange-200',
  approved:            'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:            'bg-red-100 text-red-800 border-red-200',
};

const DR_STATUS_LABELS = {
  pending:             'Pending Review',
  pending_reapproval:  'Pending Re-Approval',
  approved:            'Approved',
  rejected:            'Rejected',
};

const DRStatusBadge = ({ status }) => {
  const style = DR_STATUS_STYLES?.[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  const label = DR_STATUS_LABELS?.[status] || status || '—';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
};

// ─── Actionable Daily Review statuses ────────────────────────────────────────
// Only pending and pending_reapproval rows get approve/reject actions.
const DR_ACTIONABLE_STATUSES = ['pending', 'pending_reapproval'];

const isDRActionable = (entry) =>
  DR_ACTIONABLE_STATUSES?.includes(entry?.status) &&
  entry?.submitter_name !== 'Ascend API Sync';

// ─── EOD audit trail logger (reused from EOD Queue) ──────────────────────────
const logDRStatusChange = async ({
  entryId, fromStatus, toStatus, changedBy, changerName, changerRole,
  note, eventType, rejectionReason,
}) => {
  try {
    await supabase?.from('eod_status_history')?.insert({
      entry_id: entryId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      changer_name: changerName,
      changer_role: changerRole,
      note: note || null,
      event_type: eventType || null,
      rejection_reason: rejectionReason || null,
      changed_at: new Date()?.toISOString(),
    });
  } catch (err) {
    console.warn('[dr-audit] Failed to log status change:', err?.message);
  }
};

// ─── EOD rejection email (reused from EOD Queue — same edge function path) ───
// Sends via eod-rejection-notification edge function (Resend).
// Only called on reject. Confirms request acceptance, not recipient delivery.
const sendDRRejectionEmail = async ({ entry, rejectionReason, rejectedByName }) => {
  try {
    if (!entry?.submitted_by) return false;
    const { data: omProfile } = await supabase
      ?.from('user_profiles')
      ?.select('email, full_name')
      ?.eq('id', entry?.submitted_by)
      ?.maybeSingle();
    if (!omProfile?.email) return false;
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/eod-rejection-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        office_manager_email: omProfile?.email,
        office_manager_name: omProfile?.full_name || entry?.submitter_name,
        office_name: entry?.offices?.name ? `Nu Dental of ${entry?.offices?.name}` : (entry?.office_name ? `Nu Dental of ${entry?.office_name}` : 'your office'),
        entry_date: entry?.entry_date,
        rejection_reason: rejectionReason,
        rejected_by: rejectedByName,
        entry_id: entry?.id,
      }),
    });
    if (!response?.ok) return false;
    const result = await response.json();
    return result?.success === true && typeof result?.id === 'string' && result.id.length > 0;
  } catch (err) {
    console.warn('[dr-rejection-email] Failed to send rejection email:', err?.message);
    return false;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const SLABadge = ({ submittedAt }) => {
  const sla = getSLAStatus(submittedAt);
  const colors = SLA_COLOR_MAP?.[sla?.color] || SLA_COLOR_MAP?.gray;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors?.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot}`} />
      {sla?.label}
    </span>
  );
};

const ActionButton = ({ icon, label, onClick, variant = 'default', disabled = false }) => {
  const variants = {
    approve: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    unlock:  'bg-blue-600 hover:bg-blue-700 text-white',
    reject:  'bg-red-600 hover:bg-red-700 text-white',
    view:    'bg-surface-secondary hover:bg-surface-tertiary text-text-primary border border-border',
    default: 'bg-surface-secondary hover:bg-surface-tertiary text-text-primary border border-border',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants?.[variant]}`}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
};

// ─── Reject / Unlock modal (Huddles) ─────────────────────────────────────────
const ActionModal = ({ isOpen, title, placeholder, onConfirm, onCancel, confirmLabel, confirmVariant, requireReason = true }) => {
  const [reason, setReason] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-primary rounded-xl shadow-2xl w-full max-w-md border border-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-3">{title}</h3>
          {requireReason && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e?.target?.value)}
              placeholder={placeholder || 'Enter reason...'}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(reason); setReason(''); }}
            disabled={requireReason && !reason?.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${confirmVariant === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Huddle Detail Review Modal ───────────────────────────────────────────────
const HuddleDetailReviewModal = ({ isOpen, huddle, submittedByName, onConfirmApprove, onCancel, approveLoading }) => {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    if (!isOpen || !huddle?.id) return;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    huddleService?.getHuddleById(huddle?.id)?.then((data) => setDetail(data))?.catch((err) => setDetailError(err?.message || 'Failed to load huddle detail.'))?.finally(() => setDetailLoading(false));
  }, [isOpen, huddle?.id]);

  if (!isOpen) return null;

  const officeName = huddle?.offices?.name || detail?.office_name || '—';
  const huddleDate = (detail?.huddle_date || huddle?.huddle_date)
    ? format(parseISO(detail?.huddle_date || huddle?.huddle_date), 'EEEE, MMMM d, yyyy')
    : '—';
  const submittedAt = (detail?.submitted_at || huddle?.submitted_at)
    ? format(parseISO(detail?.submitted_at || huddle?.submitted_at), 'MMM d, yyyy h:mm a')
    : '—';

  const providerBlocks = detail?.providerBlocks || [];
  const checklistItems = detail?.checklistItems || [];
  const frontDeskItems = checklistItems?.filter(i => i?.section === 'front_desk');
  const backOfficeItems = checklistItems?.filter(i => i?.section === 'back_office');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl border border-border flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="Sun" size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Review Morning Huddle</h2>
              <p className="text-xs text-text-tertiary">{officeName} — {huddleDate}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-text-tertiary">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Confirmation note */}
        <div className="mx-6 mt-4 flex-shrink-0 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Icon name="Info" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Review the submitted huddle details before approving. Approval records the huddle as approved and writes to huddle audit history.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {detailLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-secondary">Loading huddle details...</p>
              </div>
            </div>
          )}

          {detailError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <Icon name="AlertCircle" size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{detailError}</p>
            </div>
          )}

          {!detailLoading && !detailError && (
            <>
              {/* Meta section */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Huddle Information</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-text-tertiary">Office</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{officeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Huddle Date</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{huddleDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Submitted By</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{fmt(submittedByName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Submitted At</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{submittedAt}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary">Status</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5 capitalize">{huddle?.status || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Provider blocks */}
              {providerBlocks?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Provider Blocks</h3>
                  {providerBlocks?.map((block, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-text-primary">{block?.provider_name || `Provider ${idx + 1}`}</span>
                        {block?.provider_type && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 capitalize">{block?.provider_type}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-text-tertiary">Daily Goal</p>
                          <p className="text-sm font-medium text-text-primary mt-0.5">{fmtCurrency(block?.daily_goal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">Monthly Goal</p>
                          <p className="text-sm font-medium text-text-primary mt-0.5">{fmtCurrency(block?.monthly_goal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">Scheduled</p>
                          <p className="text-sm font-medium text-text-primary mt-0.5">{fmtCurrency(block?.scheduled_production)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">New Patients</p>
                          <p className="text-sm font-medium text-text-primary mt-0.5">{fmt(block?.new_patients_today)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Front desk checklist */}
              {frontDeskItems?.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Front Desk Checklist</h3>
                  <div className="space-y-2">
                    {frontDeskItems?.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <Icon
                          name={item?.is_complete ? 'CheckCircle' : 'Circle'}
                          size={14}
                          className={item?.is_complete ? 'text-emerald-500 mt-0.5 flex-shrink-0' : 'text-gray-300 mt-0.5 flex-shrink-0'}
                        />
                        <span className="text-xs text-text-primary leading-relaxed">{item?.item_text || item?.template_text || `Item ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Back office checklist */}
              {backOfficeItems?.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Back Office Checklist</h3>
                  <div className="space-y-2">
                    {backOfficeItems?.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <Icon
                          name={item?.is_complete ? 'CheckCircle' : 'Circle'}
                          size={14}
                          className={item?.is_complete ? 'text-emerald-500 mt-0.5 flex-shrink-0' : 'text-gray-300 mt-0.5 flex-shrink-0'}
                        />
                        <span className="text-xs text-text-primary leading-relaxed">{item?.item_text || item?.template_text || `Item ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detail?.notes && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">Notes</h3>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{detail?.notes}</p>
                </div>
              )}

              {/* No detail loaded but no error */}
              {!detail && !detailLoading && !detailError && (
                <div className="text-center py-8 text-text-tertiary text-sm">
                  Huddle detail not available in current record.
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-slate-50 dark:bg-slate-700 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-white dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmApprove}
            disabled={approveLoading || detailLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approveLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Icon name="CheckCircle" size={15} />
                Approve Huddle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Daily Review — View Details Modal (read-only, for non-actionable rows) ───
const DailyReviewDetailModal = ({ isOpen, entry, onClose }) => {
  if (!isOpen || !entry) return null;

  const officeName = entry?.office_name || entry?.offices?.name || '—';
  const entryDate = fmtDate(entry?.entry_date, 'EEEE, MMMM d, yyyy');
  const submittedAt = fmtDateTime(entry?.submitted_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Icon name="ClipboardList" size={18} className="text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">Daily Review — View Details</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  <Icon name="Lock" size={10} />
                  Read-Only
                </span>
              </div>
              <p className="text-xs text-text-tertiary">{officeName} — {entryDate}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-text-tertiary">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Submission info */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Submission Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-text-tertiary">Office</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{officeName}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Entry Date</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{entryDate}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Submitted By</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{fmt(entry?.submitter_name)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Submitted At</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{submittedAt}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Status</p>
                <div className="mt-0.5"><DRStatusBadge status={entry?.status} /></div>
              </div>
              {entry?.provider_name && (
                <div>
                  <p className="text-xs text-text-tertiary">Provider</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.provider_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financials */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Financials</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-text-tertiary">Production</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{fmtCurrency(entry?.total_production)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Collection</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{fmtCurrency(entry?.collection)}</p>
              </div>
              {(entry?.new_patients !== null && entry?.new_patients !== undefined) && (
                <div>
                  <p className="text-xs text-text-tertiary">New Patients</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.new_patients}</p>
                </div>
              )}
              {(entry?.no_shows !== null && entry?.no_shows !== undefined) && (
                <div>
                  <p className="text-xs text-text-tertiary">No Shows</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.no_shows}</p>
                </div>
              )}
            </div>
          </div>

          {/* Expense info if present */}
          {(entry?.expense_category || entry?.expense_amount) && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Expense</h3>
              <div className="grid grid-cols-2 gap-3">
                {entry?.expense_category && (
                  <div>
                    <p className="text-xs text-text-tertiary">Category</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.expense_category}</p>
                  </div>
                )}
                {entry?.expense_amount !== null && entry?.expense_amount !== undefined && (
                  <div>
                    <p className="text-xs text-text-tertiary">Amount</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{fmtCurrency(entry?.expense_amount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes / Attestation */}
          {entry?.notes && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Notes / Attestation</h3>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{entry?.notes}</p>
            </div>
          )}

          {/* Rejection reason if present */}
          {entry?.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Prior Rejection Reason</h3>
              <p className="text-sm text-red-800 leading-relaxed">{entry?.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Footer — close only, no actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-slate-50 dark:bg-slate-700 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-white dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Daily Review — Review & Approve Modal (Phase 2B) ─────────────────────────
// Full review modal for actionable (pending / pending_reapproval) rows.
// Approve button is ONLY inside this modal — no single-click row approval.
// Does NOT update monthly_executive_analytics. Does NOT invoke Dentrix/FastAPI.
const DailyReviewApproveModal = ({ isOpen, entry, onConfirmApprove, onCancel, approveLoading }) => {
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    if (!isOpen) setApprovalNote('');
  }, [isOpen]);

  if (!isOpen || !entry) return null;

  const officeName = entry?.office_name || entry?.offices?.name || '—';
  const entryDate = fmtDate(entry?.entry_date, 'EEEE, MMMM d, yyyy');
  const submittedAt = fmtDateTime(entry?.submitted_at);
  const isPendingReapproval = entry?.status === 'pending_reapproval';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Icon name="ClipboardCheck" size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Review Daily Report{isPendingReapproval ? ' — Re-Approval' : ''}
              </h2>
              <p className="text-xs text-text-tertiary">{officeName} — {entryDate}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-text-tertiary">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Approval notice */}
        <div className="mx-6 mt-4 flex-shrink-0 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Icon name="Info" size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            Review the Daily Review submission below before approving. Approval updates <strong>daily_entries</strong> workflow status and writes to <strong>eod_status_history</strong> only. It does <strong>not</strong> update Dentrix/FastAPI actuals or monthly_executive_analytics (analytics sync trigger is disabled).
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Submission info */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Submission Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-text-tertiary">Office</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{officeName}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Entry Date</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{entryDate}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Submitted By</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{fmt(entry?.submitter_name)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Submitted At</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">{submittedAt}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Status</p>
                <div className="mt-0.5"><DRStatusBadge status={entry?.status} /></div>
              </div>
              {entry?.provider_name && (
                <div>
                  <p className="text-xs text-text-tertiary">Provider</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.provider_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financials */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Financials</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-text-tertiary">Production</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{fmtCurrency(entry?.total_production)}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">Collection</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{fmtCurrency(entry?.collection)}</p>
              </div>
              {(entry?.new_patients !== null && entry?.new_patients !== undefined) && (
                <div>
                  <p className="text-xs text-text-tertiary">New Patients</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.new_patients}</p>
                </div>
              )}
              {(entry?.no_shows !== null && entry?.no_shows !== undefined) && (
                <div>
                  <p className="text-xs text-text-tertiary">No Shows</p>
                  <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.no_shows}</p>
                </div>
              )}
            </div>
          </div>

          {/* Expense info if present */}
          {(entry?.expense_category || entry?.expense_amount) && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Expense</h3>
              <div className="grid grid-cols-2 gap-3">
                {entry?.expense_category && (
                  <div>
                    <p className="text-xs text-text-tertiary">Category</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{entry?.expense_category}</p>
                  </div>
                )}
                {entry?.expense_amount !== null && entry?.expense_amount !== undefined && (
                  <div>
                    <p className="text-xs text-text-tertiary">Amount</p>
                    <p className="text-sm font-medium text-text-primary mt-0.5">{fmtCurrency(entry?.expense_amount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes / Attestation */}
          {entry?.notes && (
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">Notes / Attestation</h3>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{entry?.notes}</p>
            </div>
          )}

          {/* Prior rejection reason if pending_reapproval */}
          {isPendingReapproval && entry?.rejection_reason && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Prior Rejection Reason</h3>
              <p className="text-sm text-orange-800 leading-relaxed">{entry?.rejection_reason}</p>
            </div>
          )}

          {/* Optional approval note */}
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">Approval Note (optional)</h3>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e?.target?.value)}
              placeholder="Add an optional note for this approval..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white dark:bg-slate-600 text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-slate-50 dark:bg-slate-700 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-white dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmApprove(approvalNote)}
            disabled={approveLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approveLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Icon name="CheckCircle" size={15} />
                {isPendingReapproval ? 'Re-Approve Daily Report' : 'Approve Daily Report'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Daily Review — Reject Modal (Phase 2B) ───────────────────────────────────
// Rejection reason is required. Reuses eod-rejection-notification behavior.
const DailyReviewRejectModal = ({ isOpen, entry, onConfirmReject, onCancel, rejectLoading }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen || !entry) return null;

  const officeName = entry?.office_name || entry?.offices?.name || '—';
  const entryDate = fmtDate(entry?.entry_date, 'EEE, MMM d, yyyy');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <Icon name="XCircle" size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Reject Daily Report</h2>
              <p className="text-xs text-text-tertiary">{officeName} — {entryDate}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-text-tertiary">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <Icon name="AlertTriangle" size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-800 leading-relaxed">
              Rejecting this Daily Report will update its workflow status to <strong>rejected</strong> and write to <strong>eod_status_history</strong>. An email notification will be requested for the submitter; delivery is not guaranteed. This does <strong>not</strong> update Dentrix/FastAPI actuals or monthly_executive_analytics.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e?.target?.value)}
              placeholder="Enter rejection reason (required)..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white dark:bg-slate-700 text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400/30"
            />
            {!reason?.trim() && (
              <p className="text-xs text-text-tertiary mt-1">A rejection reason is required before rejecting.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 pb-5 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmReject(reason)}
            disabled={!reason?.trim() || rejectLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rejectLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <Icon name="XCircle" size={15} />
                Reject Daily Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Office group card (Morning Huddles) ──────────────────────────────────────
const OfficeGroup = ({ officeName, huddles, onReviewApprove, onUnlock, onReject, actionLoading }) => {
  const overdueCount = huddles?.filter(h => getSLAStatus(h?.submitted_at)?.color === 'red')?.length;
  return (
    <div className="bg-surface-primary rounded-xl border border-border overflow-hidden">
      {/* Office header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Building2" size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{officeName}</h3>
            <p className="text-xs text-text-tertiary">{huddles?.length} pending {huddles?.length === 1 ? 'huddle' : 'huddles'}</p>
          </div>
        </div>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <Icon name="AlertTriangle" size={11} />
            {overdueCount} overdue
          </span>
        )}
      </div>
      {/* Huddle rows */}
      <div className="divide-y divide-border">
        {huddles?.map((huddle) => {
          const sla = getSLAStatus(huddle?.submitted_at);
          const huddleDate = huddle?.huddle_date
            ? format(parseISO(huddle?.huddle_date), 'EEE, MMM d, yyyy')
            : '—';
          const submittedAt = huddle?.submitted_at
            ? format(parseISO(huddle?.submitted_at), 'MMM d, h:mm a')
            : '—';
          const dueDate = huddle?.submitted_at
            ? format(new Date(parseISO(huddle.submitted_at).getTime() + SLA_HOURS * 60 * 60 * 1000), 'MMM d, h:mm a')
            : '—';

          return (
            <div key={huddle?.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${sla?.urgent ? 'bg-red-50/30' : ''}`}>
              {/* Type badge + Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Icon name="Sun" size={10} />
                    Morning Huddle
                  </span>
                  <span className="text-sm font-medium text-text-primary">{huddleDate}</span>
                  <SLABadge submittedAt={huddle?.submitted_at} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-tertiary">
                  <span>Submitted: {submittedAt}</span>
                  <span>Due: {dueDate}</span>
                  {huddle?.submitted_by_name && <span>By: {huddle?.submitted_by_name}</span>}
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <ActionButton
                  icon="Eye"
                  label="Review & Approve"
                  variant="approve"
                  disabled={actionLoading}
                  onClick={() => onReviewApprove(huddle)}
                />
                <ActionButton
                  icon="Unlock"
                  label="Unlock"
                  variant="unlock"
                  disabled={actionLoading}
                  onClick={() => onUnlock(huddle)}
                />
                <ActionButton
                  icon="XCircle"
                  label="Reject"
                  variant="reject"
                  disabled={actionLoading}
                  onClick={() => onReject(huddle)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Daily Review row (Phase 2B) ──────────────────────────────────────────────
// Actionable rows (pending / pending_reapproval): Review & Approve + Reject
// Non-actionable rows: View Details only
const DailyReviewRow = ({ entry, onReviewApprove, onReject, onViewDetails, actionLoading }) => {
  const officeName = entry?.office_name || entry?.offices?.name || '—';
  const entryDate = fmtDate(entry?.entry_date);
  const submittedAt = entry?.submitted_at ? format(parseISO(entry?.submitted_at), 'MMM d, h:mm a') : '—';
  const notesPreview = entry?.notes ? (entry?.notes?.length > 80 ? entry?.notes?.slice(0, 80) + '…' : entry?.notes) : null;
  const actionable = isDRActionable(entry);

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Icon name="ClipboardList" size={10} />
            Daily Review
          </span>
          <span className="text-sm font-medium text-text-primary">{entryDate}</span>
          <DRStatusBadge status={entry?.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-tertiary">
          <span>Office: {officeName}</span>
          <span>Submitted: {submittedAt}</span>
          {entry?.submitter_name && <span>By: {entry?.submitter_name}</span>}
          {entry?.total_production !== null && entry?.total_production !== undefined && (
            <span>Production: {fmtCurrency(entry?.total_production)}</span>
          )}
          {entry?.collection !== null && entry?.collection !== undefined && (
            <span>Collection: {fmtCurrency(entry?.collection)}</span>
          )}
          {entry?.new_patients !== null && entry?.new_patients !== undefined && (
            <span>New Pts: {entry?.new_patients}</span>
          )}
        </div>
        {notesPreview && (
          <p className="mt-1 text-xs text-text-tertiary italic truncate max-w-lg">"{notesPreview}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actionable ? (
          <>
            <ActionButton
              icon="ClipboardCheck"
              label="Review & Approve"
              variant="approve"
              disabled={actionLoading}
              onClick={() => onReviewApprove(entry)}
            />
            <ActionButton
              icon="XCircle"
              label="Reject"
              variant="reject"
              disabled={actionLoading}
              onClick={() => onReject(entry)}
            />
          </>
        ) : (
          <ActionButton
            icon="Eye"
            label="View Details"
            variant="view"
            onClick={() => onViewDetails(entry)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Daily Review office group (Phase 2B) ─────────────────────────────────────
const DailyReviewOfficeGroup = ({ officeName, entries, onReviewApprove, onReject, onViewDetails, actionLoading }) => {
  const actionableCount = entries?.filter(isDRActionable)?.length;
  return (
    <div className="bg-surface-primary rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon name="Building2" size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{officeName}</h3>
            <p className="text-xs text-text-tertiary">{entries?.length} pending {entries?.length === 1 ? 'review' : 'reviews'}</p>
          </div>
        </div>
        {actionableCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Icon name="CheckSquare" size={10} />
            {actionableCount} actionable
          </span>
        )}
      </div>
      <div className="divide-y divide-border">
        {entries?.map((entry) => (
          <DailyReviewRow
            key={entry?.id}
            entry={entry}
            onReviewApprove={onReviewApprove}
            onReject={onReject}
            onViewDetails={onViewDetails}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const HuddleApprovalsPage = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();

  // Morning Huddle state
  const [huddles, setHuddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Daily Review state
  const [dailyReviews, setDailyReviews] = useState([]);
  const [drLoading, setDrLoading] = useState(false);
  const [drActionLoading, setDrActionLoading] = useState(false);

  // Filters
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterSLA, setFilterSLA] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [offices, setOffices] = useState([]);

  // Huddle modal state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);

  // Daily Review modal state (Phase 2B)
  const [drDetailTarget, setDrDetailTarget] = useState(null);       // read-only view details
  const [drApproveTarget, setDrApproveTarget] = useState(null);     // Review & Approve modal
  const [drRejectTarget, setDrRejectTarget] = useState(null);       // Reject modal

  const role = userProfile?.role;
  const isAuthorized = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(role);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Workflow', path: '/daily-morning-huddle' },
    { label: 'Workflow Approvals Queue' },
  ];

  // ─── Fetch submitted huddles ────────────────────────────────────────────────
  const fetchHuddles = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      let query = supabase?.from('huddles')?.select(`
          id, huddle_date, status, submitted_at, submitted_by,
          office_id, offices(id, name)
        `)?.eq('status', 'submitted')?.order('submitted_at', { ascending: true });

      if (role === 'regional_manager' || role === 'regional_clinical_manager') {
        const { data: assignments } = await supabase?.from('user_office_assignments')?.select('office_id')?.eq('user_id', userProfile?.id);
        const officeIds = assignments?.map(a => a?.office_id) || [];
        if (officeIds?.length > 0) {
          query = query?.in('office_id', officeIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all(
        (data || [])?.map(async (h) => {
          if (!h?.submitted_by) return h;
          try {
            const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', h?.submitted_by)?.maybeSingle();
            return { ...h, submitted_by_name: profile?.full_name || null };
          } catch {
            return h;
          }
        })
      );

      setHuddles(enriched);
    } catch (err) {
      console.error('[HuddleApprovals] fetch error:', err);
      toastError('Load Failed', err?.message || 'Could not load pending huddles.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, role, userProfile?.id]);

  // ─── Fetch Daily Reviews ────────────────────────────────────────────────────
  // Fetches daily_entries with status IN ('pending', 'pending_reapproval')
  // Excludes Ascend API Sync rows. Applies regional office scoping.
  const fetchDailyReviews = useCallback(async () => {
    if (!isAuthorized) return;
    setDrLoading(true);
    try {
      let query = supabase
        ?.from('daily_entries')
        ?.select(`
          id, entry_date, status, submitted_at, submitted_by, submitter_name,
          total_production, collection, new_patients, no_shows,
          provider_name, expense_category, expense_amount, notes,
          rejection_reason, office_id, offices(id, name)
        `)
        ?.in('status', ['pending', 'pending_reapproval'])
        ?.order('submitted_at', { ascending: true });

      if (role === 'regional_manager' || role === 'regional_clinical_manager') {
        const { data: assignments } = await supabase
          ?.from('user_office_assignments')
          ?.select('office_id')
          ?.eq('user_id', userProfile?.id);
        const officeIds = assignments?.map(a => a?.office_id) || [];
        if (officeIds?.length > 0) {
          query = query?.in('office_id', officeIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Exclude Ascend API Sync rows
      const filtered = (data || [])?.filter(
        (entry) => entry?.submitter_name !== 'Ascend API Sync'
      );

      const enriched = filtered?.map((entry) => ({
        ...entry,
        office_name: entry?.offices?.name || null,
      }));

      setDailyReviews(enriched);
    } catch (err) {
      console.error('[HuddleApprovals] daily_entries fetch error:', err);
      setDailyReviews([]);
    } finally {
      setDrLoading(false);
    }
  }, [isAuthorized, role, userProfile?.id]);

  const fetchOffices = useCallback(async () => {
    try {
      const { data } = await supabase?.from('offices')?.select('id, name')?.order('name');
      setOffices(data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchHuddles();
    fetchDailyReviews();
    fetchOffices();
  }, [fetchHuddles, fetchDailyReviews, fetchOffices]);

  // Realtime for huddles
  useEffect(() => {
    let channel;
    try {
      channel = supabase?.channel(`huddle-approvals-${Date.now()}`)?.on('postgres_changes', { event: '*', schema: 'public', table: 'huddles' }, () => fetchHuddles())?.subscribe();
    } catch (_) {}
    return () => {
      try {
        if (channel && typeof channel?.unsubscribe === 'function') {
          channel?.unsubscribe();
        } else if (channel) {
          supabase?.removeChannel(channel);
        }
      } catch (_) {}
    };
  }, [fetchHuddles]);

  // ─── Huddle actions ─────────────────────────────────────────────────────────
  const handleOpenReview = (huddle) => {
    setReviewTarget({ huddle, submittedByName: huddle?.submitted_by_name || null });
  };

  const handleApprove = async () => {
    if (!reviewTarget?.huddle) return;
    const huddle = reviewTarget?.huddle;
    setActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const { error } = await supabase?.from('huddles')?.update({
          status: 'approved',
          approved_by: userProfile?.id,
          approved_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString(),
        })?.eq('id', huddle?.id)?.eq('status', huddle?.status)?.select('id')?.single();
      if (error?.code === 'PGRST116') throw new Error('This Huddle changed since it was reviewed. Refresh and review its current status.');
      if (error) throw error;

      await supabase?.from('huddle_audit_log')?.insert({
        huddle_id: huddle?.id,
        action_type: 'approve',
        changed_by: userProfile?.id,
        reason: 'Approved via Huddle Approvals queue after full detail review',
        diff_summary: `Status changed to approved by ${approverName}`,
      });

      success('Approved', `Huddle for ${huddle?.offices?.name || 'office'} has been approved.`);
      setReviewTarget(null);
      fetchHuddles();
    } catch (err) {
      toastError('Approve Failed', err?.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async (huddle, reason) => {
    setActionLoading(true);
    try {
      const { error } = await supabase?.from('huddles')?.update({ status: 'unlocked', updated_at: new Date()?.toISOString() })?.eq('id', huddle?.id)?.eq('status', huddle?.status)?.select('id')?.single();
      if (error?.code === 'PGRST116') throw new Error('This Huddle changed since it was reviewed. Refresh and review its current status.');
      if (error) throw error;

      await supabase?.from('huddle_audit_log')?.insert({
        huddle_id: huddle?.id,
        action_type: 'unlock',
        changed_by: userProfile?.id,
        reason: reason || 'Unlocked via Huddle Approvals queue',
        diff_summary: `Status changed to unlocked`,
      });

      success('Unlocked', `Huddle for ${huddle?.offices?.name || 'office'} has been unlocked for editing.`);
      setUnlockTarget(null);
      fetchHuddles();
    } catch (err) {
      toastError('Unlock Failed', err?.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (huddle, reason) => {
    setActionLoading(true);
    try {
      const { error } = await supabase?.from('huddles')?.update({ status: 'rejected', updated_at: new Date()?.toISOString() })?.eq('id', huddle?.id)?.eq('status', huddle?.status)?.select('id')?.single();
      if (error?.code === 'PGRST116') throw new Error('This Huddle changed since it was reviewed. Refresh and review its current status.');
      if (error) throw error;

      await supabase?.from('huddle_audit_log')?.insert({
        huddle_id: huddle?.id,
        action_type: 'reject',
        changed_by: userProfile?.id,
        reason,
        diff_summary: `Status changed to rejected. Reason: ${reason}`,
      });

      success('Rejected', `Huddle for ${huddle?.offices?.name || 'office'} has been rejected.`);
      setRejectTarget(null);
      fetchHuddles();
    } catch (err) {
      toastError('Reject Failed', err?.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Daily Review actions (Phase 2B) ────────────────────────────────────────
  // Reuses EOD Queue field mapping, eod_status_history writes, and rejection email behavior.
  // Does NOT update monthly_executive_analytics.
  // Does NOT invoke Dentrix/FastAPI.

  const handleDRApprove = async (note = '') => {
    if (!drApproveTarget) return;
    const entry = drApproveTarget;
    if (!isDRActionable(entry)) {
      toastError('Not Actionable', 'This Daily Review is not in an actionable status.');
      return;
    }
    setDrActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const fromStatus = entry?.status;
      const isReapproval = fromStatus === 'pending_reapproval';

      // Field mapping reused from EOD Queue handleApprove
      const { data: updatedEntry, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'approved',
          approved_by: userProfile?.id,
          approver_name: approverName,
          approved_at: new Date()?.toISOString(),
          approval_note: note || null,
          status_changed_by: userProfile?.id,
          status_changed_by_name: approverName,
        })
        ?.eq('id', entry?.id)
        ?.eq('status', fromStatus)
        ?.select('id')
        ?.maybeSingle();
      if (error) throw error;
      if (!updatedEntry) throw new Error('This Daily Report changed while you were reviewing it. Refresh and review its current status.');

      // eod_status_history write — same pattern as EOD Queue
      await logDRStatusChange({
        entryId: entry?.id,
        fromStatus,
        toStatus: 'approved',
        changedBy: userProfile?.id,
        changerName: approverName,
        changerRole: userProfile?.role,
        note: note || null,
        eventType: isReapproval ? 'reapproval' : 'approval',
      });

      success(
        isReapproval ? 'Re-Approved' : 'Approved',
        `Daily Report for ${entry?.office_name || entry?.offices?.name || 'office'} has been ${isReapproval ? 're-approved' : 'approved'}.`
      );
      setDrApproveTarget(null);
      fetchDailyReviews();
    } catch (err) {
      toastError('Approval Failed', err?.message || 'Could not approve Daily Report.');
    } finally {
      setDrActionLoading(false);
    }
  };

  const handleDRReject = async (reason) => {
    if (!drRejectTarget) return;
    const entry = drRejectTarget;
    if (!reason?.trim()) {
      toastError('Reason Required', 'A rejection reason is required.');
      return;
    }
    if (!isDRActionable(entry)) {
      toastError('Not Actionable', 'This Daily Review is not in an actionable status.');
      return;
    }
    setDrActionLoading(true);
    try {
      const rejectorName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const fromStatus = entry?.status;

      // Field mapping uses rejection-specific columns from daily_entries schema:
      // rejected_by, rejected_at, rejection_by_name, rejection_reason
      // Does NOT stamp approved_by / approver_name / approved_at on a rejection.
      // Does NOT set approval_note on rejection.
      const { data: updatedEntry, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'rejected',
          rejected_by: userProfile?.id,
          rejection_by_name: rejectorName,
          rejected_at: new Date()?.toISOString(),
          rejection_reason: reason,
          status_changed_by: userProfile?.id,
          status_changed_by_name: rejectorName,
        })
        ?.eq('id', entry?.id)
        ?.eq('status', fromStatus)
        ?.select('id')
        ?.maybeSingle();
      if (error) throw error;
      if (!updatedEntry) throw new Error('This Daily Report changed while you were reviewing it. Refresh and review its current status.');

      // eod_status_history write — same pattern as EOD Queue
      await logDRStatusChange({
        entryId: entry?.id,
        fromStatus,
        toStatus: 'rejected',
        changedBy: userProfile?.id,
        changerName: rejectorName,
        changerRole: userProfile?.role,
        note: reason,
        rejectionReason: reason,
        eventType: 'rejection',
      });

      // Rejection email — reuses existing eod-rejection-notification edge function
      const notificationAccepted = await sendDRRejectionEmail({ entry, rejectionReason: reason, rejectedByName: rejectorName });

      success('Rejected', `Daily Report rejected. ${notificationAccepted ? 'Notification request accepted.' : 'Notification could not be confirmed.'}`);
      setDrRejectTarget(null);
      fetchDailyReviews();
    } catch (err) {
      toastError('Rejection Failed', err?.message || 'Could not reject Daily Report.');
    } finally {
      setDrActionLoading(false);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filteredHuddles = huddles?.filter((h) => {
    if (filterOffice !== 'all' && h?.office_id !== filterOffice) return false;
    if (filterSLA !== 'all') {
      const sla = getSLAStatus(h?.submitted_at);
      if (filterSLA === 'overdue' && sla?.color !== 'red') return false;
      if (filterSLA === 'urgent' && !sla?.urgent) return false;
      if (filterSLA === 'ok' && sla?.urgent) return false;
    }
    return true;
  });

  const filteredDailyReviews = dailyReviews?.filter((e) => {
    if (filterOffice !== 'all' && e?.office_id !== filterOffice) return false;
    return true;
  });

  // Group huddles by office
  const huddleGrouped = filteredHuddles?.reduce((acc, h) => {
    const name = h?.offices?.name || 'Unknown Office';
    if (!acc?.[name]) acc[name] = [];
    acc?.[name]?.push(h);
    return acc;
  }, {});
  const huddleOfficeNames = Object.keys(huddleGrouped)?.sort();

  // Group daily reviews by office
  const drGrouped = filteredDailyReviews?.reduce((acc, e) => {
    const name = e?.office_name || e?.offices?.name || 'Unknown Office';
    if (!acc?.[name]) acc[name] = [];
    acc?.[name]?.push(e);
    return acc;
  }, {});
  const drOfficeNames = Object.keys(drGrouped)?.sort();

  // Summary counts
  const overdueTotal = huddles?.filter(h => getSLAStatus(h?.submitted_at)?.color === 'red')?.length;
  const huddlePendingCount = huddles?.length;
  const drPendingCount = dailyReviews?.length;
  const totalAwaitingReview = huddlePendingCount + drPendingCount;

  const showHuddles = filterType === 'all' || filterType === 'morning_huddles';
  const showDailyReviews = filterType === 'all' || filterType === 'daily_reviews';

  // ─── Access guard ───────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Icon name="ShieldOff" size={48} className="text-text-tertiary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Access Restricted</h2>
          <p className="text-text-secondary text-sm">You do not have permission to view workflow approvals.</p>
          <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Icon name="CheckSquare" size={24} className="text-primary" />
              Workflow Approvals Queue
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              Review submitted workflow items. Morning Huddles and actionable Daily Reviews can be reviewed, approved, and rejected here.
            </p>
          </div>
          {/* Summary badges */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {overdueTotal > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-200">
                <Icon name="AlertTriangle" size={14} />
                {overdueTotal} overdue
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-surface-secondary text-text-primary border border-border">
              <Icon name="Clock" size={14} />
              {totalAwaitingReview} awaiting review
            </span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-primary rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Total Awaiting Review</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{totalAwaitingReview}</p>
            <p className="text-xs text-text-tertiary mt-0.5">All pending items</p>
          </div>
          <div className="bg-surface-primary rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Morning Huddles</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{huddlePendingCount}</p>
            <p className="text-xs text-text-tertiary mt-0.5">Submitted, awaiting approval</p>
          </div>
          <div className="bg-surface-primary rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Daily Reviews</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {drLoading ? <span className="text-base text-text-tertiary">…</span> : drPendingCount}
            </p>
            <p className="text-xs text-text-tertiary mt-0.5">Pending / pending re-approval</p>
          </div>
          <div className="bg-surface-primary rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Morning Huddle Overdue</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{overdueTotal}</p>
            <p className="text-xs text-text-tertiary mt-0.5">Past 24h SLA</p>
          </div>
        </div>

        {/* Phase 2B source clarity banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Icon name="Info" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Workflow Approvals Queue — Phase 2B.</span> This queue shows Supabase workflow approval records. Morning Huddles and actionable Daily Reviews can be reviewed here. Daily Review approval/rejection updates <strong>daily_entries</strong> workflow status and <strong>eod_status_history</strong> only; it does not update Dentrix/FastAPI actuals or monthly_executive_analytics because the analytics sync trigger is disabled.
          </p>
        </div>

        {/* Type filter — segmented control */}
        <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1 w-fit">
          {[
            { value: 'all', label: 'All', count: totalAwaitingReview },
            { value: 'morning_huddles', label: 'Morning Huddles', count: huddlePendingCount },
            { value: 'daily_reviews', label: 'Daily Reviews', count: drPendingCount },
          ]?.map((tab) => (
            <button
              key={tab?.value}
              onClick={() => setFilterType(tab?.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === tab?.value
                  ? 'bg-surface-primary text-text-primary shadow-sm border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab?.label}
              <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold ${
                filterType === tab?.value ? 'bg-primary/10 text-primary' : 'bg-surface-tertiary text-text-tertiary'
              }`}>
                {tab?.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap gap-3 items-center bg-surface-primary rounded-xl border border-border px-4 py-3">
          <Icon name="Filter" size={15} className="text-text-tertiary" />
          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e?.target?.value)}
            className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Offices</option>
            {offices?.map(o => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
          {(filterType === 'all' || filterType === 'morning_huddles') && (
            <select
              value={filterSLA}
              onChange={(e) => setFilterSLA(e?.target?.value)}
              className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All SLA Status</option>
              <option value="overdue">Overdue</option>
              <option value="urgent">Urgent (&lt;4h)</option>
              <option value="ok">On Track</option>
            </select>
          )}
          {(filterOffice !== 'all' || filterSLA !== 'all') && (
            <button
              onClick={() => { setFilterOffice('all'); setFilterSLA('all'); }}
              className="text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Morning Huddles section ── */}
        {showHuddles && (
          <div className="space-y-4">
            {filterType === 'all' && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <Icon name="Sun" size={11} />
                  Morning Huddles
                </span>
                <span className="text-xs text-text-tertiary">{filteredHuddles?.length} item{filteredHuddles?.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-text-secondary">Loading Morning Huddles...</p>
                </div>
              </div>
            ) : huddleOfficeNames?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-surface-primary rounded-xl border border-border">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <Icon name="CheckCircle" size={28} className="text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">All caught up!</h3>
                <p className="text-sm text-text-secondary">No pending Morning Huddle approvals at this time.</p>
              </div>
            ) : (
              huddleOfficeNames?.map((officeName) => (
                <OfficeGroup
                  key={officeName}
                  officeName={officeName}
                  huddles={huddleGrouped?.[officeName]}
                  onReviewApprove={handleOpenReview}
                  onUnlock={(h) => setUnlockTarget(h)}
                  onReject={(h) => setRejectTarget(h)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        )}

        {/* ── Daily Reviews section ── */}
        {showDailyReviews && (
          <div className="space-y-4">
            {filterType === 'all' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  <Icon name="ClipboardList" size={11} />
                  Daily Reviews
                </span>
                <span className="text-xs text-text-tertiary">{filteredDailyReviews?.length} item{filteredDailyReviews?.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {drLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-text-secondary">Loading Daily Reviews...</p>
                </div>
              </div>
            ) : drOfficeNames?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-surface-primary rounded-xl border border-border">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <Icon name="ClipboardList" size={28} className="text-indigo-400" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">No Daily Reviews Awaiting Review</h3>
                <p className="text-sm text-text-secondary max-w-md leading-relaxed">
                  No Daily Review submissions with status <span className="font-medium">pending</span> or <span className="font-medium">pending re-approval</span> are currently in the queue.
                </p>
              </div>
            ) : (
              drOfficeNames?.map((officeName) => (
                <DailyReviewOfficeGroup
                  key={officeName}
                  officeName={officeName}
                  entries={drGrouped?.[officeName]}
                  onReviewApprove={(entry) => setDrApproveTarget(entry)}
                  onReject={(entry) => setDrRejectTarget(entry)}
                  onViewDetails={(entry) => setDrDetailTarget(entry)}
                  actionLoading={drActionLoading}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Huddle Detail Review Modal */}
      <HuddleDetailReviewModal
        isOpen={!!reviewTarget}
        huddle={reviewTarget?.huddle}
        submittedByName={reviewTarget?.submittedByName}
        onConfirmApprove={handleApprove}
        onCancel={() => setReviewTarget(null)}
        approveLoading={actionLoading}
      />

      {/* Daily Review — Review & Approve Modal (Phase 2B, actionable rows only) */}
      <DailyReviewApproveModal
        isOpen={!!drApproveTarget}
        entry={drApproveTarget}
        onConfirmApprove={handleDRApprove}
        onCancel={() => setDrApproveTarget(null)}
        approveLoading={drActionLoading}
      />

      {/* Daily Review — Reject Modal (Phase 2B, actionable rows only) */}
      <DailyReviewRejectModal
        isOpen={!!drRejectTarget}
        entry={drRejectTarget}
        onConfirmReject={handleDRReject}
        onCancel={() => setDrRejectTarget(null)}
        rejectLoading={drActionLoading}
      />

      {/* Daily Review — View Details Modal (read-only, non-actionable rows) */}
      <DailyReviewDetailModal
        isOpen={!!drDetailTarget}
        entry={drDetailTarget}
        onClose={() => setDrDetailTarget(null)}
      />

      {/* Huddle Reject Modal */}
      <ActionModal
        isOpen={!!rejectTarget}
        title={`Reject Huddle — ${rejectTarget?.offices?.name || ''}`}
        placeholder="Enter rejection reason (required)..."
        confirmLabel="Reject Huddle"
        confirmVariant="reject"
        onConfirm={(reason) => handleReject(rejectTarget, reason)}
        onCancel={() => setRejectTarget(null)}
      />

      {/* Huddle Unlock Modal */}
      <ActionModal
        isOpen={!!unlockTarget}
        title={`Unlock Huddle — ${unlockTarget?.offices?.name || ''}`}
        placeholder="Enter reason for unlocking (required)..."
        confirmLabel="Unlock Huddle"
        confirmVariant="unlock"
        onConfirm={(reason) => handleUnlock(unlockTarget, reason)}
        onCancel={() => setUnlockTarget(null)}
      />
    </div>
  );
};

export default HuddleApprovalsPage;
