import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { huddleService } from '../../../services/huddleService';

// Roles allowed to view and use approval controls
const ALLOWED_APPROVAL_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'];

// ─── Checklist templates — mirrors actual Daily Morning Huddle form ────────────
const FRONT_DESK_TEMPLATES = [
  'Did any patients leave without scheduling their next hygiene appointment? If so, and they should have been scheduled, follow up and get them scheduled as soon as you can.',
  'Are there unconfirmed patients 48 hours out? If so, decide as a team what needs to be done. Do you make multiple calls for the next 48 hours until confirmed? Do you do nothing because a patient is known to be responsible and reliable? Do you double book? Each patient is different. Do not be afraid to call multiple times if a patient has cancelled before.',
  "Were there any last-minute calls from patients that led to changes in today\'s schedule?",
  "Do any of the day\'s patients have outstanding balances?",
  'Who are the new patients that day? Do you have the proper information about them?',
  'Is there any personal information about patients that should be known, i.e., upcoming vacations, birthdays, etc.?',
  'Are there any openings today in the doctor/hygiene schedule? What are the solutions?',
  "What is the financial information on today\'s patients? Are there financial arrangements needed? Does anyone have a poor payment history?",
  'Did any patients leave the office yesterday without paying their balance in full?',
  'Which patient should receive a quality control survey today?',
];

const BACK_OFFICE_TEMPLATES = [
  'Is there enough time scheduled for each procedure?',
  'Are there adequate supplies available?',
  'Do you need premedication information about a patient or any other pertinent medical info, such as allergies?',
  'Do any patients need additional x rays?',
  "Is there any pending treatment for any of today's patients that can be added to the schedule to fill in for cancellations or no-shows if needed?",
  'When can emergencies be scheduled?',
  'Have all lab cases for the day been checked in?',
  'Are photos needed for any patients?',
  'Are any family members overdue for recare?',
];

// Merge DB checklist rows with templates — same pattern as the actual huddle form.
// Items with DB rows show their saved completed/notes state.
// Items without DB rows render as template text with unchecked/blank state.
const mergeChecklistWithTemplate = (section, templates, dbItems) => {
  const existing = dbItems?.filter(i => i?.section === section) || [];
  return templates?.map((text, idx) => {
    const itemNumber = idx + 1;
    const dbRow = existing?.find(i => i?.item_number === itemNumber)
      || existing?.find(i => i?.item_text?.trim() === text?.trim());
    if (dbRow) {
      return { ...dbRow, item_text: text };
    }
    return {
      id: null,
      isPlaceholder: true,
      section,
      item_number: itemNumber,
      item_text: text,
      completed: false,
      notes: '',
    };
  });
};

const PendingApprovals = () => {
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const [entries, setEntries] = useState([]);
  const [huddles, setHuddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [activeSection, setActiveSection] = useState('entries'); // 'entries' | 'huddles'

  // Confirmation modal state for Daily Review approval
  const [entryApproveModal, setEntryApproveModal] = useState(null); // { entry }

  // Confirmation modal state for Huddle approval
  const [huddleApproveModal, setHuddleApproveModal] = useState(null); // { huddle, detail, detailLoading, detailError }

  // ─── Internal Role Guard ───────────────────────────────────────────────────
  const userRole = userProfile?.role;
  const canApprove = ALLOWED_APPROVAL_ROLES?.includes(userRole);

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Icon name="ShieldOff" size={28} color="var(--color-destructive)" />
        </div>
        <h4 className="text-base font-semibold text-foreground mb-1">Access Denied</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          You do not have permission to view or manage approval queues. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const fetchPendingEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch daily entries
      const { data: entriesData, error: entriesError } = await supabase
        ?.from('daily_entries')
        ?.select(
          'id, entry_date, office_id, submitted_by, production, collection, notes, created_at, submitted_at, provider_name, service_category, offices(name), user_profiles!submitted_by(full_name, email)'
        )
        ?.eq('status', 'submitted')
        ?.order('created_at', { ascending: false });
      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Fetch huddle submissions — MINIMAL known-safe fields only (V533A).
      // Do NOT select optional huddle content columns — they may not exist in schema.
      // Full huddle detail is loaded only inside the confirmation modal via huddleService.getHuddleById.
      const { data: huddlesData, error: huddlesError } = await supabase
        ?.from('huddles')
        ?.select(
          'id, huddle_date, office_id, submitted_by, status, created_at, offices(name), user_profiles!submitted_by(full_name, email)'
        )
        ?.eq('status', 'submitted')
        ?.order('created_at', { ascending: false });
      if (huddlesError) throw huddlesError;
      setHuddles(huddlesData || []);
    } catch (err) {
      console.error('Failed to fetch pending items:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEntries();
  }, [fetchPendingEntries]);

  // ─── Daily Review Approval (after confirmation) ────────────────────────────
  const handleApprove = async (entryId) => {
    setActionLoading(entryId + '_approve');
    try {
      const { error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'approved',
          approved_by: userProfile?.id,
          approved_at: new Date()?.toISOString(),
          rejection_reason: null,
        })
        ?.eq('id', entryId);
      if (error) throw error;
      setEntries(prev => prev?.filter(e => e?.id !== entryId));
      setEntryApproveModal(null);
      success('Entry Approved', 'The daily review has been approved successfully.');
    } catch (err) {
      toastError('Approval Failed', 'Failed to approve entry: ' + err?.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Huddle Approval (after confirmation) — writes huddle_audit_log ────────
  const handleApproveHuddle = async (huddleId) => {
    setActionLoading(huddleId + '_approve_huddle');
    try {
      const { error } = await supabase
        ?.from('huddles')
        ?.update({
          status: 'approved',
          approved_by: userProfile?.id,
          approved_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', huddleId);
      if (error) throw error;

      // Write audit log
      try {
        await supabase?.from('huddle_audit_log')?.insert({
          huddle_id: huddleId,
          action_type: 'approve',
          changed_by: userProfile?.id,
          reason: 'Huddle approved via EOD Approvals tab',
          diff_summary: `Status changed to approved by ${userProfile?.full_name || userProfile?.email || 'approver'}`,
        });
      } catch (auditErr) {
        console.warn('[PendingApprovals] huddle_audit_log insert failed:', auditErr?.message);
      }

      setHuddles(prev => prev?.filter(h => h?.id !== huddleId));
      setHuddleApproveModal(null);
      success('Huddle Approved', 'The morning huddle has been approved successfully.');
    } catch (err) {
      toastError('Approval Failed', 'Failed to approve huddle: ' + err?.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Huddle Rejection — writes huddle_audit_log ────────────────────────────
  const handleRejectHuddle = async (huddleId, reason) => {
    setActionLoading(huddleId + '_reject_huddle');
    try {
      const { error } = await supabase
        ?.from('huddles')
        ?.update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: userProfile?.id,
          approved_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString(),
        })
        ?.eq('id', huddleId);
      if (error) throw error;

      try {
        await supabase?.from('huddle_audit_log')?.insert({
          huddle_id: huddleId,
          action_type: 'reject',
          changed_by: userProfile?.id,
          reason,
          diff_summary: `Status changed to rejected by ${userProfile?.full_name || userProfile?.email || 'approver'}. Reason: ${reason}`,
        });
      } catch (auditErr) {
        console.warn('[PendingApprovals] huddle_audit_log insert failed:', auditErr?.message);
      }

      setHuddles(prev => prev?.filter(h => h?.id !== huddleId));
      setRejectModal(null);
      success('Huddle Rejected', 'The huddle has been rejected.');
    } catch (err) {
      toastError('Rejection Failed', 'Failed to reject huddle: ' + err?.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Shared Reject Submit ──────────────────────────────────────────────────
  const handleRejectSubmit = async () => {
    if (!rejectModal?.entryId && !rejectModal?.huddleId) return;
    const reason = rejectModal?.reason?.trim();
    if (!reason) {
      setRejectModal(prev => ({ ...prev, error: 'Please enter a rejection reason.' }));
      return;
    }

    if (rejectModal?.huddleId) {
      await handleRejectHuddle(rejectModal?.huddleId, reason);
      return;
    }

    setActionLoading(rejectModal?.entryId + '_reject');
    try {
      const { error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: userProfile?.id,
          approved_at: new Date()?.toISOString(),
        })
        ?.eq('id', rejectModal?.entryId);
      if (error) throw error;
      setEntries(prev => prev?.filter(e => e?.id !== rejectModal?.entryId));
      setRejectModal(null);
      success('Entry Rejected', 'The entry has been rejected.');
    } catch (err) {
      toastError('Rejection Failed', 'Failed to reject entry: ' + err?.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Open Daily Review Confirmation Modal ──────────────────────────────────
  const openEntryApproveModal = (entry) => {
    setEntryApproveModal({ entry });
  };

  // ─── Open Huddle Confirmation Modal + Load Full Detail ─────────────────────
  const openHuddleApproveModal = async (huddle) => {
    setHuddleApproveModal({ huddle, detail: null, detailLoading: true, detailError: null });
    try {
      const detail = await huddleService?.getHuddleById(huddle?.id);
      setHuddleApproveModal(prev => prev ? { ...prev, detail, detailLoading: false } : null);
    } catch (err) {
      console.error('[PendingApprovals] getHuddleById failed:', err?.message);
      setHuddleApproveModal(prev =>
        prev ? { ...prev, detail: null, detailLoading: false, detailError: 'Full huddle details could not be loaded from the current frontend service.' } : null
      );
    }
  };

  // ─── Formatters ───────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimestamp = (ts) => {
    if (!ts) return null;
    try {
      return new Date(ts)?.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch {
      return null;
    }
  };

  const formatCurrency = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return '$' + n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPlusMinus = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}$${Math.abs(n)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const plusMinusColor = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return 'text-muted-foreground';
    return n >= 0 ? 'text-success' : 'text-destructive';
  };

  const totalPending = entries?.length + huddles?.length;

  // ─── Detect attestation block in notes ────────────────────────────────────
  const hasAttestationBlock = (notes) => {
    return notes && notes?.includes('Daily Review Attestation');
  };

  // ─── Huddle Detail Section: safe field accessor ────────────────────────────
  // Returns value if present and non-empty, otherwise null
  const safeVal = (v) => (v !== null && v !== undefined && v !== '') ? v : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
            <Icon name="Clock" size={18} color="var(--color-warning)" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Awaiting Approval</h3>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${totalPending} item${totalPending === 1 ? '' : 's'} awaiting review`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchPendingEntries}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-smooth px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50"
        >
          <Icon name={loading ? 'Loader' : 'RefreshCw'} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Section Tabs */}
      {!loading && (
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveSection('entries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
              activeSection === 'entries' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon name="FileText" size={14} />
            Daily Reviews
            {entries?.length > 0 && (
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                activeSection === 'entries' ? 'bg-white/20 text-white' : 'bg-warning/20 text-warning'
              }`}>
                {entries?.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('huddles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
              activeSection === 'huddles' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon name="Sun" size={14} />
            Morning Huddles
            {huddles?.length > 0 && (
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                activeSection === 'huddles' ? 'bg-white/20 text-white' : 'bg-warning/20 text-warning'
              }`}>
                {huddles?.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Icon name="Loader" size={28} className="animate-spin" color="var(--color-primary)" />
            <p className="text-sm text-muted-foreground">Loading pending items...</p>
          </div>
        </div>
      )}

      {/* ── Daily Reviews Section ─────────────────────────────────────────── */}
      {!loading && activeSection === 'entries' && (
        <>
          {entries?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Icon name="CheckCircle2" size={28} color="var(--color-success)" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">All caught up!</h4>
              <p className="text-sm text-muted-foreground">No daily reviews require approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <Icon name="AlertTriangle" size={13} color="#D97706" className="flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  Approving this workflow submission does not update official Dentrix/FastAPI analytics. Dentrix Closeout remains the source of truth for production, collections, appointments, deposit slip, and voided transactions.
                </p>
              </div>

              {entries?.map((entry) => {
                const submitterName = entry?.user_profiles?.full_name || entry?.user_profiles?.email || 'Unknown';
                const officeName = entry?.offices?.name || '—';
                const isRejectingThis = actionLoading === entry?.id + '_reject';
                const submittedAt = formatTimestamp(entry?.submitted_at || entry?.created_at);
                const attestation = hasAttestationBlock(entry?.notes);

                return (
                  <div
                    key={entry?.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-smooth"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold border border-warning/20">
                          <Icon name="Clock" size={11} />
                          Submitted
                        </span>
                        <span className="text-sm font-semibold text-foreground">{formatDate(entry?.entry_date)}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{officeName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        by {submitterName}
                      </span>
                    </div>

                    {submittedAt && (
                      <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                        <Icon name="Calendar" size={10} />
                        Submitted: {submittedAt}
                      </p>
                    )}

                    <div className="mb-3 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Icon name="AlertTriangle" size={10} />
                        Manual office-submitted workflow data — not Dentrix actuals.
                      </p>
                    </div>

                    {attestation && (
                      <div className="mb-3 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
                          <Icon name="ClipboardCheck" size={10} />
                          Attestation checklist included — view full details before approving.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-muted/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Manual Production</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(entry?.production)}</p>
                        <p className="text-[10px] text-muted-foreground">Legacy reference only</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Manual Collection</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(entry?.collection)}</p>
                        <p className="text-[10px] text-muted-foreground">Legacy reference only</p>
                      </div>
                    </div>

                    {entry?.notes && (
                      <div className="mb-3 px-3 py-2 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-0.5">Notes Preview</p>
                        <p className="text-xs text-foreground line-clamp-2">{entry?.notes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEntryApproveModal(entry)}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                      >
                        <Icon name="Eye" size={14} />
                        Review &amp; Approve
                      </button>
                      <button
                        onClick={() => setRejectModal({ entryId: entry?.id, reason: '', error: '' })}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                      >
                        {isRejectingThis ? (
                          <><Icon name="Loader" size={14} className="animate-spin" />Rejecting...</>
                        ) : (
                          <><Icon name="XCircle" size={14} />Reject Workflow Submission</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Morning Huddles Section ───────────────────────────────────────── */}
      {!loading && activeSection === 'huddles' && (
        <>
          {huddles?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Icon name="CheckCircle2" size={28} color="var(--color-success)" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">All caught up!</h4>
              <p className="text-sm text-muted-foreground">No morning huddles require approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {huddles?.map((huddle) => {
                const submitterName = huddle?.user_profiles?.full_name || huddle?.user_profiles?.email || 'Unknown';
                const officeName = huddle?.offices?.name || '—';
                const isRejectingThis = actionLoading === huddle?.id + '_reject_huddle';
                const submittedAt = formatTimestamp(huddle?.created_at);

                return (
                  <div
                    key={huddle?.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-smooth"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold border border-warning/20">
                          <Icon name="Sun" size={11} />
                          Submitted
                        </span>
                        <span className="text-sm font-semibold text-foreground">{formatDate(huddle?.huddle_date)}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{officeName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        by {submitterName}
                      </span>
                    </div>

                    {submittedAt && (
                      <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                        <Icon name="Calendar" size={10} />
                        Submitted: {submittedAt}
                      </p>
                    )}

                    <div className="mb-3 px-3 py-2 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                      <p className="text-xs text-foreground font-medium">Morning Huddle</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Click "Review &amp; Approve Huddle" to see full huddle content before approving.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openHuddleApproveModal(huddle)}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                      >
                        <Icon name="Eye" size={14} />
                        Review &amp; Approve Huddle
                      </button>
                      <button
                        onClick={() => setRejectModal({ huddleId: huddle?.id, reason: '', error: '' })}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                      >
                        {isRejectingThis ? (
                          <><Icon name="Loader" size={14} className="animate-spin" />Rejecting...</>
                        ) : (
                          <><Icon name="XCircle" size={14} />Reject Huddle</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DAILY REVIEW CONFIRMATION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {entryApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 p-6 border-b border-border flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Icon name="ClipboardCheck" size={20} color="var(--color-success)" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-foreground">Review Daily Attestation Before Approval</h4>
                <p className="text-xs text-muted-foreground">Confirm all details before approving this workflow submission.</p>
              </div>
              <button
                onClick={() => setEntryApproveModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground transition-smooth flex-shrink-0"
              >
                <Icon name="X" size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <Icon name="AlertTriangle" size={13} color="#D97706" className="flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  <strong>Workflow-only:</strong> This approval does not update official Dentrix/FastAPI analytics. Dentrix Closeout remains the source of truth.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Office</p>
                  <p className="text-sm font-semibold text-foreground">{entryApproveModal?.entry?.offices?.name || '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Entry Date</p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(entryApproveModal?.entry?.entry_date)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitter</p>
                  <p className="text-sm font-semibold text-foreground">
                    {entryApproveModal?.entry?.user_profiles?.full_name || entryApproveModal?.entry?.user_profiles?.email || 'Unknown'}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitted</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTimestamp(entryApproveModal?.entry?.submitted_at || entryApproveModal?.entry?.created_at) || '—'}
                  </p>
                </div>
              </div>

              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <Icon name="AlertTriangle" size={10} />
                    Legacy Manual Financial Reference — not Dentrix actuals
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Manual Production</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(entryApproveModal?.entry?.production)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Manual Collection</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(entryApproveModal?.entry?.collection)}</p>
                  </div>
                </div>
              </div>

              {entryApproveModal?.entry?.notes ? (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Icon name="FileText" size={11} />
                    Full Notes / Attestation
                  </p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {entryApproveModal?.entry?.notes}
                  </pre>
                </div>
              ) : (
                <div className="bg-muted/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">No notes submitted with this entry.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-6 border-t border-border flex-shrink-0">
              <button
                onClick={() => setEntryApproveModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-smooth"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(entryApproveModal?.entry?.id)}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
              >
                {actionLoading === entryApproveModal?.entry?.id + '_approve' ? (
                  <><Icon name="Loader" size={14} className="animate-spin" />Approving...</>
                ) : (
                  <><Icon name="CheckCircle" size={14} />Confirm Approval</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MORNING HUDDLE CONFIRMATION MODAL — mirrors actual Daily Morning Huddle form
      ═══════════════════════════════════════════════════════════════════════ */}
      {huddleApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Icon name="Sun" size={20} color="var(--color-success)" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-foreground">Review Morning Huddle Before Approval</h4>
                <p className="text-xs text-muted-foreground">Review all huddle sections before confirming approval.</p>
              </div>
              <button
                onClick={() => setHuddleApproveModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground transition-smooth flex-shrink-0"
              >
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* ── A. Huddle Metadata ──────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Office</p>
                  <p className="text-sm font-semibold text-foreground">{huddleApproveModal?.huddle?.offices?.name || '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Huddle Date</p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(huddleApproveModal?.huddle?.huddle_date)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitter</p>
                  <p className="text-sm font-semibold text-foreground">
                    {huddleApproveModal?.huddle?.user_profiles?.full_name || huddleApproveModal?.huddle?.user_profiles?.email || 'Unknown'}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitted</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatTimestamp(huddleApproveModal?.huddle?.created_at) || '—'}
                  </p>
                </div>
              </div>

              {/* Detail loading state */}
              {huddleApproveModal?.detailLoading && (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Icon name="Loader" size={20} className="animate-spin" color="var(--color-primary)" />
                  <p className="text-sm text-muted-foreground">Loading huddle details...</p>
                </div>
              )}

              {/* Detail error */}
              {huddleApproveModal?.detailError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <Icon name="AlertTriangle" size={13} color="#D97706" className="flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    {huddleApproveModal?.detailError}
                  </p>
                </div>
              )}

              {/* ── Full huddle detail sections ─────────────────────────── */}
              {!huddleApproveModal?.detailLoading && huddleApproveModal?.detail && (() => {
                const d = huddleApproveModal?.detail;
                const blocks = d?.providerBlocks || [];
                const dbChecklist = d?.checklistItems || [];
                // Mirror the actual huddle form: always show all template items,
                // merging with DB rows where they exist (same as mergeChecklistWithTemplate in daily-morning-huddle/index.jsx)
                const frontDeskItems = mergeChecklistWithTemplate('front_desk', FRONT_DESK_TEMPLATES, dbChecklist);
                const backOfficeItems = mergeChecklistWithTemplate('back_office', BACK_OFFICE_TEMPLATES, dbChecklist);
                const frontDeskCompleted = frontDeskItems?.filter(i => i?.completed)?.length;
                const backOfficeCompleted = backOfficeItems?.filter(i => i?.completed)?.length;
                const doctorBlocks = blocks?.filter(b => b?.block_type === 'doctor');
                const hygienistBlocks = blocks?.filter(b => b?.block_type === 'hygienist');
                const filledBlocks = blocks?.filter(b => b?.provider_name?.trim());

                // Helper: render a value or "Not available in current huddle record."
                const renderVal = (label, value, isCurrency = false, isPlusMinus = false) => {
                  const v = safeVal(value);
                  let display = '—';
                  let colorCls = 'text-foreground';
                  if (v !== null) {
                    if (isPlusMinus) {
                      display = formatPlusMinus(v);
                      colorCls = plusMinusColor(v);
                    } else if (isCurrency) {
                      display = formatCurrency(v);
                    } else {
                      display = String(v);
                    }
                  }
                  return (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className={`text-xs font-semibold ${colorCls}`}>{display}</p>
                    </div>
                  );
                };

                // ── B. Office Production Summary ──────────────────────────
                // Note: Office-level production summary (goal_monthly, actual_mtd, expected_mtd, plus_minus)
                // comes from the /v2/huddle/prefill API at form-fill time and is NOT stored in the huddles table.
                // The huddle record stores provider-level block data (monthly_goal, daily_goal, monthly_actual, etc.)
                // We show what is available from the detail record and provider blocks.

                return (
                  <div className="space-y-4">

                    {/* ── B. Office Production Summary ─────────────────── */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Icon name="TrendingUp" size={13} color="var(--color-primary)" />
                        <p className="text-xs font-semibold text-foreground">Office Production Summary</p>
                      </div>
                      <div className="p-3">
                        {filledBlocks?.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {renderVal('Monthly Production Goal', filledBlocks?.reduce((sum, b) => sum + (parseFloat(b?.monthly_goal) || 0), 0) || null, true)}
                            {renderVal('MTD Net Production Actual', filledBlocks?.reduce((sum, b) => sum + (parseFloat(b?.monthly_actual) || 0), 0) || null, true)}
                            {renderVal('Expected MTD Production', filledBlocks?.reduce((sum, b) => sum + (parseFloat(b?.expected_mtd) || 0), 0) || null, true)}
                            {renderVal('Production Plus/Minus', filledBlocks?.reduce((sum, b) => sum + (parseFloat(b?.plus_minus) || 0), 0) || null, false, true)}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-2">Aggregated from provider blocks. Office-level prefill totals are not stored in the huddle record.</p>
                      </div>
                    </div>

                    {/* ── C. Production Blocks ─────────────────────────── */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Icon name="Activity" size={13} color="var(--color-primary)" />
                        <p className="text-xs font-semibold text-foreground">Production Blocks</p>
                        {filledBlocks?.length > 0 && (
                          <span className="ml-auto text-[10px] text-muted-foreground">{filledBlocks?.length} provider{filledBlocks?.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className="p-3">
                        {filledBlocks?.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                        ) : (
                          <div className="space-y-3">
                            {/* Doctors */}
                            {doctorBlocks?.filter(b => b?.provider_name?.trim())?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                  Doctors
                                </p>
                                <div className="space-y-2">
                                  {doctorBlocks?.filter(b => b?.provider_name?.trim())?.map((block) => (
                                    <div key={block?.id} className="bg-muted/30 rounded-lg p-2.5">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-foreground">{block?.provider_name}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">Doctor</span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {renderVal('Monthly Goal', block?.monthly_goal, true)}
                                        {renderVal('Daily Projected Goal', block?.daily_goal, true)}
                                        {renderVal('MTD Net Production', block?.monthly_actual, true)}
                                        {renderVal('Expected MTD', block?.expected_mtd, true)}
                                        {renderVal('Plus/Minus', block?.plus_minus, false, true)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Hygienists */}
                            {hygienistBlocks?.filter(b => b?.provider_name?.trim())?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                                  Hygienists
                                </p>
                                <div className="space-y-2">
                                  {hygienistBlocks?.filter(b => b?.provider_name?.trim())?.map((block) => (
                                    <div key={block?.id} className="bg-muted/30 rounded-lg p-2.5">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-foreground">{block?.provider_name}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 capitalize">Hygienist</span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {renderVal('Monthly Goal', block?.monthly_goal, true)}
                                        {renderVal('Daily Projected Goal', block?.daily_goal, true)}
                                        {renderVal('MTD Net Production', block?.monthly_actual, true)}
                                        {renderVal('Expected MTD', block?.expected_mtd, true)}
                                        {renderVal('Plus/Minus', block?.plus_minus, false, true)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── D. Collections Goal ──────────────────────────── */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Icon name="DollarSign" size={13} color="var(--color-primary)" />
                        <p className="text-xs font-semibold text-foreground">Collections Goal</p>
                      </div>
                      <div className="p-3">
                        {safeVal(d?.collections_goal) === null && safeVal(d?.collections_actual) === null ? (
                          <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                        ) : (
                          (() => {
                            const goal = parseFloat(d?.collections_goal) || 0;
                            const actual = parseFloat(d?.collections_actual) || 0;
                            const plusMinus = actual - goal;
                            const collRate = goal > 0 ? (actual / goal) * 100 : null;
                            // Expected MTD collections not stored separately — show available fields
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {renderVal('Monthly Collection Goal', d?.collections_goal, true)}
                                {renderVal('MTD Collections Actual', d?.collections_actual, true)}
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Expected MTD Collections</p>
                                  <p className="text-xs font-semibold text-muted-foreground italic">Not available in current huddle record.</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Collection Plus/Minus</p>
                                  <p className={`text-xs font-semibold ${plusMinusColor(plusMinus)}`}>
                                    {safeVal(d?.collections_goal) !== null || safeVal(d?.collections_actual) !== null ? formatPlusMinus(plusMinus) : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Collection Rate %</p>
                                  <p className="text-xs font-semibold text-foreground">
                                    {collRate !== null ? `${collRate?.toFixed(1)}%` : '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>

                    {/* ── E. New Patients ──────────────────────────────── */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Icon name="UserPlus" size={13} color="var(--color-primary)" />
                        <p className="text-xs font-semibold text-foreground">New Patients</p>
                      </div>
                      <div className="p-3">
                        {safeVal(d?.new_pt_goal) === null && safeVal(d?.new_pt_actual) === null && safeVal(d?.new_pt_today) === null ? (
                          <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                        ) : (
                          (() => {
                            const goal = parseInt(d?.new_pt_goal) || 0;
                            const actual = parseInt(d?.new_pt_actual) || 0;
                            const plusMinus = actual - goal;
                            // Expected MTD new patients not stored separately
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {renderVal('Monthly New Patient Goal', d?.new_pt_goal)}
                                {renderVal('MTD Actual New Patients', d?.new_pt_actual)}
                                {renderVal("Today's New Patients", d?.new_pt_today)}
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Expected MTD New Patients</p>
                                  <p className="text-xs font-semibold text-muted-foreground italic">Not available in current huddle record.</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">New Patients Plus/Minus</p>
                                  <p className={`text-xs font-semibold ${plusMinusColor(plusMinus)}`}>
                                    {safeVal(d?.new_pt_goal) !== null || safeVal(d?.new_pt_actual) !== null
                                      ? `${plusMinus >= 0 ? '+' : ''}${plusMinus}`
                                      : '—'}
                                  </p>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>

                    {/* ── F. Front Desk Checklist ──────────────────────── */}
                    {/* Always shows all 10 items — mirrors actual huddle form template merge */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🖥️</span>
                          <p className="text-xs font-semibold text-foreground">Front Desk Checklist</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          frontDeskCompleted === frontDeskItems?.length
                            ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}>
                          {frontDeskCompleted}/{frontDeskItems?.length} checked
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="space-y-2">
                          {frontDeskItems?.map((item, idx) => (
                            <div key={item?.id || `fd-${idx}`} className="flex items-start gap-2">
                              <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                                item?.completed ? 'bg-success border-success' : 'border-border bg-background'
                              }`}>
                                {item?.completed && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs leading-snug ${item?.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  <span className="font-medium text-muted-foreground mr-1">{idx + 1}.</span>
                                  {item?.item_text}
                                </p>
                                {item?.notes && (
                                  <p className="text-[10px] text-primary mt-0.5 pl-3">
                                    <span className="font-medium">Notes:</span> {item?.notes}
                                  </p>
                                )}
                                {item?.task_id && (
                                  <p className="text-[10px] text-success mt-0.5 pl-3 flex items-center gap-1">
                                    <Icon name="CheckCircle2" size={9} />Task created
                                  </p>
                                )}
                                {item?.isPlaceholder && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-3 italic">Not checked during huddle</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── G. Back Office Checklist ─────────────────────── */}
                    {/* Always shows all 9 items — mirrors actual huddle form template merge */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🦷</span>
                          <p className="text-xs font-semibold text-foreground">Back Office Checklist</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          backOfficeCompleted === backOfficeItems?.length
                            ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}>
                          {backOfficeCompleted}/{backOfficeItems?.length} checked
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="space-y-2">
                          {backOfficeItems?.map((item, idx) => (
                            <div key={item?.id || `bo-${idx}`} className="flex items-start gap-2">
                              <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                                item?.completed ? 'bg-success border-success' : 'border-border bg-background'
                              }`}>
                                {item?.completed && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs leading-snug ${item?.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  <span className="font-medium text-muted-foreground mr-1">{idx + 1}.</span>
                                  {item?.item_text}
                                </p>
                                {item?.notes && (
                                  <p className="text-[10px] text-primary mt-0.5 pl-3">
                                    <span className="font-medium">Notes:</span> {item?.notes}
                                  </p>
                                )}
                                {item?.task_id && (
                                  <p className="text-[10px] text-success mt-0.5 pl-3 flex items-center gap-1">
                                    <Icon name="CheckCircle2" size={9} />Task created
                                  </p>
                                )}
                                {item?.isPlaceholder && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-3 italic">Not checked during huddle</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── H. Previous Open Day ─────────────────────────── */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Icon name="History" size={13} color="var(--color-primary)" />
                        <p className="text-xs font-semibold text-foreground">Previous Open Day</p>
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Did anything go wrong?</p>
                          {safeVal(d?.prev_day_wrong) ? (
                            <p className="text-xs text-foreground leading-relaxed bg-muted/30 rounded p-2">{d?.prev_day_wrong}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">What went right?</p>
                          {safeVal(d?.prev_day_right) ? (
                            <p className="text-xs text-foreground leading-relaxed bg-muted/30 rounded p-2">{d?.prev_day_right}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Not available in current huddle record.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes Addendum if present */}
                    {safeVal(d?.notes_addendum) && (
                      <div className="border border-warning/30 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-warning/5 border-b border-warning/20 flex items-center gap-2">
                          <Icon name="FileEdit" size={13} color="var(--color-warning)" />
                          <p className="text-xs font-semibold text-foreground">Notes Addendum</p>
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-foreground leading-relaxed">{d?.notes_addendum}</p>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* No detail loaded and no error */}
              {!huddleApproveModal?.detailLoading && !huddleApproveModal?.detail && !huddleApproveModal?.detailError && (
                <div className="bg-muted/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Huddle detail is not available. Review the summary above before confirming.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2 p-5 border-t border-border flex-shrink-0">
              <button
                onClick={() => setHuddleApproveModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-smooth"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApproveHuddle(huddleApproveModal?.huddle?.id)}
                disabled={!!actionLoading || huddleApproveModal?.detailLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
              >
                {actionLoading === huddleApproveModal?.huddle?.id + '_approve_huddle' ? (
                  <><Icon name="Loader" size={14} className="animate-spin" />Approving...</>
                ) : (
                  <><Icon name="CheckCircle" size={14} />Confirm Approval</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          REJECT MODAL (shared — Daily Review + Huddle)
      ═══════════════════════════════════════════════════════════════════════ */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Icon name="XCircle" size={20} color="var(--color-destructive)" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  {rejectModal?.huddleId ? 'Reject Huddle' : 'Reject Workflow Submission'}
                </h4>
                <p className="text-xs text-muted-foreground">A reason is required before rejecting.</p>
              </div>
            </div>
            <textarea
              value={rejectModal?.reason || ''}
              onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e?.target?.value, error: '' }))}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
            />
            {rejectModal?.error && (
              <p className="text-xs text-destructive mb-3">{rejectModal?.error}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-smooth"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!!actionLoading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
              >
                {actionLoading ? 'Rejecting...' : rejectModal?.huddleId ? 'Reject Huddle' : 'Reject Workflow Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;
