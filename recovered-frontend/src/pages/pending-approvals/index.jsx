import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { format, parseISO } from 'date-fns';

// ─── Send EOD rejection email to Office Manager ───────────────────────────────
const sendRejectionEmail = async ({ entry, rejectionReason, rejectedByName }) => {
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
        office_name: entry?.offices?.name ? `Nu Dental of ${entry?.offices?.name}` : 'your office',
        entry_date: entry?.entry_date,
        rejection_reason: rejectionReason,
        rejected_by: rejectedByName,
        entry_id: entry?.id,
      }),
    });
    if (!response?.ok) return false;
    const result = await response.json();
    return result?.success === true && typeof result?.id === 'string' && result.id.trim().length > 0;
  } catch (err) {
    console.warn('[eod-rejection-email] Failed to send rejection email:', err?.message);
    return false;
  }
};

// ─── API-synced row detector ──────────────────────────────────────────────────
// Reliable detection: submitter_name === 'Ascend API Sync'
// This is the field populated by the Dentrix/FastAPI sync pipeline.
const isApiSyncedRow = (entry) => {
  return entry?.submitter_name === 'Ascend API Sync';
};

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:                    { label: 'Draft',                  cls: 'bg-gray-100 text-gray-700 border-gray-200',         icon: 'FileEdit' },
  pending:                  { label: 'Pending Approval',       cls: 'bg-yellow-100 text-yellow-800 border-yellow-200',   icon: 'Clock' },
  pending_review:           { label: 'Pending Approval',       cls: 'bg-yellow-100 text-yellow-800 border-yellow-200',   icon: 'Clock' },
  approved:                 { label: 'Approved',               cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'CheckCircle' },
  rejected:                 { label: 'Rejected',               cls: 'bg-red-100 text-red-800 border-red-200',            icon: 'XCircle' },
  pending_reapproval:       { label: 'Pending Re-Approval',    cls: 'bg-orange-100 text-orange-800 border-orange-200',   icon: 'RefreshCw' },
  rejected_after_approval:  { label: 'Rejected After Approval',cls: 'bg-rose-100 text-rose-800 border-rose-200',         icon: 'AlertTriangle' },
};

const StatusBadge = ({ status, isApiSynced }) => {
  if (isApiSynced) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-violet-100 text-violet-800 border-violet-200">
        <Icon name="Zap" size={11} />
        Dentrix API Synced
      </span>
    );
  }
  const cfg = STATUS_CONFIG?.[status] || { label: status || 'Unknown', cls: 'bg-muted text-muted-foreground border-border', icon: 'Circle' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.cls}`}>
      <Icon name={cfg?.icon} size={11} />
      {cfg?.label}
    </span>
  );
};

// ─── Null-safe currency formatter (V541 — preserved) ─────────────────────────
const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })?.format(n);
};

// ─── Audit trail logger ───────────────────────────────────────────────────────
const logStatusChange = async ({
  entryId, fromStatus, toStatus, changedBy, changerName, changerRole, note,
  eventType, oldValues, newValues, rejectionReason, approvalReversalReason, editReason,
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
      old_values: oldValues || null,
      new_values: newValues || null,
      rejection_reason: rejectionReason || null,
      approval_reversal_reason: approvalReversalReason || null,
      edit_reason: editReason || null,
      changed_at: new Date()?.toISOString(),
    });
  } catch (err) {
    console.warn('[eod-audit] Failed to log status change:', err?.message);
  }
};

// ─── Editable fields config ───────────────────────────────────────────────────
const EDITABLE_FIELDS = [
  { key: 'entry_date',        label: 'EOD Date',       type: 'date' },
  { key: 'production',        label: 'Production',     type: 'number' },
  { key: 'collection',        label: 'Collection',     type: 'number' },
  { key: 'total_production',  label: 'Total Production', type: 'number' },
  { key: 'total_collection',  label: 'Total Collection', type: 'number' },
  { key: 'new_patients',      label: 'New Patients',   type: 'number' },
  { key: 'no_shows',          label: 'No Shows',       type: 'number' },
  { key: 'provider_name',     label: 'Provider',       type: 'text' },
  { key: 'expense_category',  label: 'Expense Category', type: 'text' },
  { key: 'expense_amount',    label: 'Expense Amount', type: 'number' },
  { key: 'notes',             label: 'Comments / Notes', type: 'textarea' },
];

const PENDING_STATUSES = ['pending', 'pending_review'];
const POST_APPROVAL_ACTOR_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'];

// ─── API-synced grouping helper ───────────────────────────────────────────────
// Groups API-synced entries by office_id + entry_date.
// Returns an ordered list of group objects, each with:
//   key, officeName, entryDate, officeGrossProduction, totalCollections, rows
// officeGrossProduction = one representative total_production (NOT summed)
// totalCollections = sum(collection) across provider rows
const buildApiSyncedGroups = (entries) => {
  const groupMap = new Map();
  entries?.forEach(entry => {
    if (!isApiSyncedRow(entry)) return;
    const key = `${entry?.office_id}__${entry?.entry_date}`;
    if (!groupMap?.has(key)) {
      groupMap?.set(key, {
        key,
        officeName: entry?.offices?.name || '—',
        entryDate: entry?.entry_date,
        // One representative office-level total — NOT summed across rows
        officeGrossProduction: entry?.total_production ?? null,
        totalCollections: 0,
        rows: [],
      });
    }
    const g = groupMap?.get(key);
    // Sum provider-level collection shares
    if (entry?.collection != null && !Number.isNaN(Number(entry?.collection))) {
      g.totalCollections += Number(entry?.collection);
    }
    g?.rows?.push(entry);
  });
  return Array.from(groupMap?.values());
};

const readCompleteEodQuery = async (query, isCurrent = () => true, pageSize = 500) => {
  const rows = [], seen = new Set();
  let expected = null;
  do {
    if (!isCurrent()) return null;
    const result = await query.range(rows.length, rows.length + pageSize - 1);
    if (!isCurrent()) return null;
    if (result?.error) throw new Error('EOD entries could not be loaded completely. Refresh to retry.');
    const count = result?.count, page = result?.data;
    if (!Number.isSafeInteger(count) || count < 0 || count > 50000 || !Array.isArray(page)) {
      throw new Error('Unable to confirm all EOD entries. Narrow the date or office filter and retry.');
    }
    if (expected === null) expected = count;
    if (count !== expected || page.length > pageSize || rows.length + page.length > expected || (!page.length && rows.length < expected)) {
      throw new Error('EOD entries changed or were incomplete. Refresh to retry.');
    }
    for (const row of page) {
      if (!row?.id || seen.has(row.id)) throw new Error('EOD entries were duplicated or incomplete. Refresh to retry.');
      seen.add(row.id);
      rows.push(row);
    }
  } while (rows.length < expected);
  return rows;
};

const getEodPage = (entries, requestedPage, pageSize = 25) => {
  const manual = entries.filter(entry => !isApiSyncedRow(entry));
  const groups = buildApiSyncedGroups(entries);
  const pageCount = Math.max(1, Math.ceil((manual.length + groups.length) / pageSize));
  const page = Math.min(pageCount, Math.max(1, requestedPage || 1));
  const start = (page - 1) * pageSize, end = start + pageSize;
  return {
    page, pageCount,
    manualEntries: manual.slice(start, end),
    apiSyncedGroups: groups.slice(Math.max(0, start - manual.length), Math.max(0, end - manual.length)),
  };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PendingApprovalsPage = () => {
  const entriesGeneration = useRef(0);
  const countsGeneration = useRef(0);
  const [displayPage, setDisplayPage] = useState(1);
  const [loadError, setLoadError] = useState(null);
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // ─── Full-scope counts (independent of active status filter) ───────────────
  const [fullCounts, setFullCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    pending_reapproval: 0,
    api_synced: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);

  // Review modal
  const [reviewEntry, setReviewEntry] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  // Post-approval modals
  const [rejectAfterApprovalEntry, setRejectAfterApprovalEntry] = useState(null);
  const [rejectAfterApprovalReason, setRejectAfterApprovalReason] = useState('');
  const [showRejectWarning, setShowRejectWarning] = useState(false);

  const [editApprovedEntry, setEditApprovedEntry] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [editReason, setEditReason] = useState('');
  const [showEditWarning, setShowEditWarning] = useState(false);

  // History modal
  const [historyEntry, setHistoryEntry] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Workflow', path: '/daily-entry-form' },
    { label: 'EOD Approval Queue' },
  ];

  const canApprove = POST_APPROVAL_ACTOR_ROLES?.includes(userProfile?.role);
  const canPostApprovalAction = POST_APPROVAL_ACTOR_ROLES?.includes(userProfile?.role);

  // ─── Fetch full-scope counts (independent of active status filter) ──────────
  // Uses Supabase count queries per status so counts are never capped by the
  // active status filter or the 1000-row default list limit.
  const fetchFullCounts = useCallback(async () => {
    const generation = ++countsGeneration.current;
    setCountsLoading(true);
    try {
      // Build shared base filters (office + date only — NOT status)
      const applyBaseFilters = (q) => {
        if (filterOffice !== 'all') q = q?.eq('office_id', filterOffice);
        if (filterDate) q = q?.eq('entry_date', filterDate);
        return q;
      };

      const [pendingRes, approvedRes, rejectedRes, reapprovalRes, apiSyncedRes] = await Promise.all([
        // Pending Approval: pending + pending_review, NOT api-synced
        applyBaseFilters(
          supabase?.from('daily_entries')
            ?.select('id', { count: 'exact', head: true })
            ?.in('status', ['pending', 'pending_review'])
            ?.neq('submitter_name', 'Ascend API Sync')
        ),
        // Workflow Approved: approved, NOT api-synced
        applyBaseFilters(
          supabase?.from('daily_entries')
            ?.select('id', { count: 'exact', head: true })
            ?.eq('status', 'approved')
            ?.neq('submitter_name', 'Ascend API Sync')
        ),
        // Rejected (all rejection statuses), NOT api-synced
        applyBaseFilters(
          supabase?.from('daily_entries')
            ?.select('id', { count: 'exact', head: true })
            ?.in('status', ['rejected', 'rejected_after_approval'])
            ?.neq('submitter_name', 'Ascend API Sync')
        ),
        // Pending Re-Approval, NOT api-synced
        applyBaseFilters(
          supabase?.from('daily_entries')
            ?.select('id', { count: 'exact', head: true })
            ?.eq('status', 'pending_reapproval')
            ?.neq('submitter_name', 'Ascend API Sync')
        ),
        // Dentrix API Synced: any status, submitted by Ascend API Sync
        applyBaseFilters(
          supabase?.from('daily_entries')
            ?.select('id', { count: 'exact', head: true })
            ?.eq('submitter_name', 'Ascend API Sync')
        ),
      ]);

      if (generation !== countsGeneration.current) return;
      setFullCounts({
        pending:           pendingRes?.count ?? 0,
        approved:          approvedRes?.count ?? 0,
        rejected:          rejectedRes?.count ?? 0,
        pending_reapproval: reapprovalRes?.count ?? 0,
        api_synced:        apiSyncedRes?.count ?? 0,
      });
    } catch (err) {
      if (generation === countsGeneration.current) console.warn('[eod-queue] Failed to fetch full counts:', err?.message);
    } finally {
      if (generation === countsGeneration.current) setCountsLoading(false);
    }
  }, [filterOffice, filterDate]);

  // ─── Fetch entries (filtered by active status card) ─────────────────────────
  const fetchEntries = useCallback(async () => {
    const generation = ++entriesGeneration.current;
    const isCurrent = () => generation === entriesGeneration.current;
    setLoading(true);
    setLoadError(null);
    setEntries([]);
    try {
      let query = supabase
        ?.from('daily_entries')
        ?.select(`
          id, entry_date, office_id, status, production, collection,
          total_production, total_collection, new_patients, no_shows,
          treatment_presented, treatment_accepted, notes,
          submitted_by, submitted_at, submitter_name,
          approved_by, approved_at, approver_name,
          rejected_by, rejected_at, rejection_by_name,
          rejection_reason, approval_note, provider_name, provider_type,
          expense_category, expense_amount,
          previous_status, status_changed_at, status_changed_by_name,
          edited_by, edited_at, edited_by_name, edit_reason,
          reapproval_note, reapproved_by, reapproved_at, reapproved_by_name,
          offices(name)
        `, { count: 'exact' })
        ?.order('submitted_at', { ascending: false, nullsFirst: false })
        ?.order('id', { ascending: true });

      if (filterStatus === 'pending') {
        query = query?.in('status', ['pending', 'pending_review'])
          ?.neq('submitter_name', 'Ascend API Sync');
      } else if (filterStatus === 'pending_reapproval') {
        query = query?.eq('status', 'pending_reapproval')
          ?.neq('submitter_name', 'Ascend API Sync');
      } else if (filterStatus === 'approved') {
        query = query?.eq('status', 'approved')
          ?.neq('submitter_name', 'Ascend API Sync');
      } else if (filterStatus === 'rejected') {
        query = query?.in('status', ['rejected', 'rejected_after_approval'])
          ?.neq('submitter_name', 'Ascend API Sync');
      } else if (filterStatus === 'api_synced') {
        query = query?.eq('submitter_name', 'Ascend API Sync');
      } else if (filterStatus !== 'all') {
        query = query?.eq('status', filterStatus);
      }

      if (filterOffice !== 'all') query = query?.eq('office_id', filterOffice);
      if (filterDate) query = query?.eq('entry_date', filterDate);

      const data = await readCompleteEodQuery(query, isCurrent);
      if (!isCurrent() || data === null) return;
      setEntries(data);
    } catch (err) {
      if (!isCurrent()) return;
      setLoadError(err?.message || 'Could not load EOD entries.');
      console.error('Failed to fetch EOD entries:', err);
      toastError('Load Failed', err?.message || 'Could not load EOD entries.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [filterStatus, filterOffice, filterDate]);

  const fetchOffices = useCallback(async () => {
    try {
      const { data } = await supabase?.from('offices')?.select('id, name')?.order('name');
      setOffices(data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  // Fetch both entries and full counts whenever filters change
  useEffect(() => {
    fetchEntries();
    fetchFullCounts();
    return () => { entriesGeneration.current += 1; countsGeneration.current += 1; };
  }, [fetchEntries, fetchFullCounts]);

  useEffect(() => {
    setDisplayPage(1);
    setSelectedIds([]);
  }, [filterStatus, filterOffice, filterDate, searchQuery]);

  useEffect(() => {
    let channel;
    try {
      channel = supabase?.channel(`eod-approval-queue-${Date.now()}`);
      if (channel) {
        channel?.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, () => {
          fetchEntries();
          fetchFullCounts();
        })?.subscribe();
      }
    } catch (err) {
      console.warn('[eod-approval-queue] channel error:', err?.message);
    }
    return () => {
      if (channel && typeof supabase?.removeChannel === 'function') {
        try { supabase?.removeChannel(channel); } catch (_) {}
      }
    };
  }, [fetchEntries, fetchFullCounts]);

  // ─── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (entry, note = '') => {
    if (entry?.status === 'approved') {
      toastError('Already Approved', 'This entry has already been approved.');
      return;
    }
    setActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const fromStatus = entry?.status;
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
      if (!updatedEntry) throw new Error('This EOD report has changed. Refresh and review its current status.');
      await logStatusChange({
        entryId: entry?.id, fromStatus, toStatus: 'approved',
        changedBy: userProfile?.id, changerName: approverName, changerRole: userProfile?.role,
        note: note || null, eventType: fromStatus === 'pending_reapproval' ? 'reapproval' : 'approval',
      });
      success('Approved', `EOD report for ${entry?.offices?.name || 'office'} has been approved.`);
      setReviewEntry(null);
      setReviewNote('');
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Approval Failed', err?.message || 'Could not approve entry.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Reject (pending → rejected) ──────────────────────────────────────────
  const handleReject = async (entry, note = '') => {
    if (!note?.trim()) {
      toastError('Note Required', 'A rejection reason is required.');
      return;
    }
    setActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const fromStatus = entry?.status;
      const { data: updatedEntry, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'rejected',
          approved_by: userProfile?.id,
          approver_name: approverName,
          approved_at: new Date()?.toISOString(),
          rejection_reason: note,
          approval_note: note,
          status_changed_by: userProfile?.id,
          status_changed_by_name: approverName,
        })
        ?.eq('id', entry?.id)
        ?.eq('status', fromStatus)
        ?.select('id')
        ?.maybeSingle();
      if (error) throw error;
      if (!updatedEntry) throw new Error('This EOD report has changed. Refresh and review its current status.');
      await logStatusChange({
        entryId: entry?.id, fromStatus, toStatus: 'rejected',
        changedBy: userProfile?.id, changerName: approverName, changerRole: userProfile?.role,
        note, rejectionReason: note, eventType: 'rejection',
      });
      const notificationAccepted = await sendRejectionEmail({ entry, rejectionReason: note, rejectedByName: approverName });
      success('Rejected', `Entry rejected. ${notificationAccepted ? 'Notification request accepted.' : 'Notification could not be confirmed.'}`);
      setReviewEntry(null);
      setReviewNote('');
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Rejection Failed', err?.message || 'Could not reject entry.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Reject AFTER Approval ─────────────────────────────────────────────────
  const openRejectAfterApproval = (entry) => {
    setRejectAfterApprovalEntry(entry);
    setRejectAfterApprovalReason('');
    setShowRejectWarning(true);
  };

  const handleRejectAfterApproval = async () => {
    if (!rejectAfterApprovalReason?.trim()) {
      toastError('Reason Required', 'A rejection reason is required to reverse an approved record.');
      return;
    }
    setActionLoading(true);
    try {
      const actorName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const entry = rejectAfterApprovalEntry;
      const { data: updatedEntry, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'rejected_after_approval',
          rejected_by: userProfile?.id,
          rejected_at: new Date()?.toISOString(),
          rejection_by_name: actorName,
          rejection_reason: rejectAfterApprovalReason,
          status_changed_by: userProfile?.id,
          status_changed_by_name: actorName,
        })
        ?.eq('id', entry?.id)
        ?.eq('status', 'approved')
        ?.select('id')
        ?.maybeSingle();
      if (error) throw error;
      if (!updatedEntry) throw new Error('This EOD report has changed. Refresh and review its current status.');
      await logStatusChange({
        entryId: entry?.id, fromStatus: 'approved', toStatus: 'rejected_after_approval',
        changedBy: userProfile?.id, changerName: actorName, changerRole: userProfile?.role,
        note: rejectAfterApprovalReason,
        rejectionReason: rejectAfterApprovalReason,
        approvalReversalReason: rejectAfterApprovalReason,
        eventType: 'rejection_after_approval',
        oldValues: { status: 'approved', approved_by: entry?.approved_by, approved_at: entry?.approved_at },
        newValues: { status: 'rejected_after_approval', rejected_by: userProfile?.id },
      });
      const notificationAccepted = await sendRejectionEmail({ entry, rejectionReason: rejectAfterApprovalReason, rejectedByName: actorName });
      success('Approval Reversed', `Record changed to Rejected After Approval. ${notificationAccepted ? 'Notification request accepted.' : 'Notification could not be confirmed.'}`);
      setShowRejectWarning(false);
      setRejectAfterApprovalEntry(null);
      setRejectAfterApprovalReason('');
      setReviewEntry(null);
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Reversal Failed', err?.message || 'Could not reverse approval.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Edit Approved EOD (→ Pending Re-Approval) ────────────────────────────
  const openEditApproved = (entry) => {
    const initial = {};
    EDITABLE_FIELDS?.forEach(f => { initial[f?.key] = entry?.[f?.key] ?? ''; });
    setEditFields(initial);
    setEditReason('');
    setEditApprovedEntry(entry);
    setShowEditWarning(true);
  };

  const handleEditApproved = async () => {
    if (!editReason?.trim()) {
      toastError('Edit Reason Required', 'Please provide a reason for editing this approved record.');
      return;
    }
    setActionLoading(true);
    try {
      const actorName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const entry = editApprovedEntry;

      const oldValues = {};
      const newValues = {};
      EDITABLE_FIELDS?.forEach(f => {
        const oldVal = entry?.[f?.key];
        const newVal = editFields?.[f?.key];
        const normalizedNew = f?.type === 'number' ? (newVal === '' ? null : Number(newVal)) : (newVal || null);
        if (String(oldVal ?? '') !== String(normalizedNew ?? '')) {
          oldValues[f?.key] = oldVal;
          newValues[f?.key] = normalizedNew;
        }
      });

      const updatePayload = { status: 'pending_reapproval' };
      EDITABLE_FIELDS?.forEach(f => {
        const val = editFields?.[f?.key];
        updatePayload[f?.key] = f?.type === 'number' ? (val === '' ? null : Number(val)) : (val || null);
      });
      updatePayload.edited_by = userProfile?.id;
      updatePayload.edited_at = new Date()?.toISOString();
      updatePayload.edited_by_name = actorName;
      updatePayload.edit_reason = editReason;
      updatePayload.reapproval_note = `Edited by ${actorName}: ${editReason}`;
      updatePayload.status_changed_by = userProfile?.id;
      updatePayload.status_changed_by_name = actorName;

      const { data: updatedEntry, error } = await supabase
        ?.from('daily_entries')
        ?.update(updatePayload)
        ?.eq('id', entry?.id)
        ?.eq('status', 'approved')
        ?.select('id')
        ?.maybeSingle();
      if (error) throw error;
      if (!updatedEntry) throw new Error('This EOD report has changed. Refresh and review its current status.');

      await logStatusChange({
        entryId: entry?.id, fromStatus: 'approved', toStatus: 'pending_reapproval',
        changedBy: userProfile?.id, changerName: actorName, changerRole: userProfile?.role,
        note: editReason, editReason,
        eventType: 'edit_after_approval',
        oldValues: Object.keys(oldValues)?.length > 0 ? oldValues : null,
        newValues: Object.keys(newValues)?.length > 0 ? newValues : null,
      });

      success('Sent for Re-Approval', 'Approved record has been edited and moved to Pending Re-Approval.');
      setShowEditWarning(false);
      setEditApprovedEntry(null);
      setEditFields({});
      setEditReason('');
      setReviewEntry(null);
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Edit Failed', err?.message || 'Could not edit approved entry.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Bulk approve ──────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    if (selectedIds?.length === 0) return;
    setActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const reviewedEntries = entries?.filter(entry => selectedIds?.includes(entry?.id) && ['pending', 'pending_review', 'pending_reapproval']?.includes(entry?.status)) || [];
      if (!reviewedEntries?.length) throw new Error('These EOD reports have changed. Refresh and review their current status.');
      const { data: updatedEntries, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'approved',
          approved_by: userProfile?.id,
          approver_name: approverName,
          approved_at: new Date()?.toISOString(),
          status_changed_by: userProfile?.id,
          status_changed_by_name: approverName,
        })
        ?.in('id', selectedIds)
        ?.or(reviewedEntries?.map(entry => `and(id.eq.${entry?.id},status.eq.${entry?.status})`)?.join(','))
        ?.select('id');
      if (error) throw error;
      if (!updatedEntries?.length) throw new Error('These EOD reports have changed. Refresh and review their current status.');
      await Promise.all(updatedEntries?.map(({ id }) => {
        const entry = reviewedEntries?.find(e => e?.id === id);
        return logStatusChange({
          entryId: id, fromStatus: entry?.status, toStatus: 'approved',
          changedBy: userProfile?.id, changerName: approverName, changerRole: userProfile?.role,
          note: 'Bulk approval', eventType: 'bulk_approval',
        });
      }));
      const skipped = selectedIds?.length - updatedEntries?.length;
      success('Bulk Approved', `${updatedEntries?.length} EOD report${updatedEntries?.length === 1 ? '' : 's'} approved.${skipped ? ` ${skipped} skipped because they changed; refresh and review them.` : ''}`);
      setSelectedIds([]);
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Bulk Approve Failed', err?.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Bulk reject ───────────────────────────────────────────────────────────
  const handleBulkReject = async () => {
    if (selectedIds?.length === 0) return;
    const note = bulkRejectReason;
    if (!note?.trim()) return;
    setActionLoading(true);
    try {
      const approverName = userProfile?.full_name || userProfile?.email || 'Unknown';
      const reviewedEntries = entries?.filter(entry => selectedIds?.includes(entry?.id) && ['pending', 'pending_review', 'pending_reapproval']?.includes(entry?.status)) || [];
      if (!reviewedEntries?.length) throw new Error('These EOD reports have changed. Refresh and review their current status.');
      const { data: updatedEntries, error } = await supabase
        ?.from('daily_entries')
        ?.update({
          status: 'rejected',
          approved_by: userProfile?.id,
          approver_name: approverName,
          approved_at: new Date()?.toISOString(),
          rejection_reason: note,
          approval_note: note,
          status_changed_by: userProfile?.id,
          status_changed_by_name: approverName,
        })
        ?.in('id', selectedIds)
        ?.or(reviewedEntries?.map(entry => `and(id.eq.${entry?.id},status.eq.${entry?.status})`)?.join(','))
        ?.select('id');
      if (error) throw error;
      if (!updatedEntries?.length) throw new Error('These EOD reports have changed. Refresh and review their current status.');
      await Promise.all(updatedEntries?.map(({ id }) => {
        const entry = reviewedEntries?.find(e => e?.id === id);
        return logStatusChange({
          entryId: id, fromStatus: entry?.status, toStatus: 'rejected',
          changedBy: userProfile?.id, changerName: approverName, changerRole: userProfile?.role,
          note, rejectionReason: note, eventType: 'bulk_rejection',
        });
      }));
      const skipped = selectedIds?.length - updatedEntries?.length;
      success('Bulk Rejected', `${updatedEntries?.length} entr${updatedEntries?.length === 1 ? 'y' : 'ies'} rejected.${skipped ? ` ${skipped} skipped because they changed; refresh and review them.` : ''}`);
      setBulkRejectOpen(false);
      setBulkRejectReason('');
      setSelectedIds([]);
      fetchEntries();
      fetchFullCounts();
    } catch (err) {
      toastError('Bulk Reject Failed', err?.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Status history ────────────────────────────────────────────────────────
  const openHistory = async (entry) => {
    setHistoryEntry(entry);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('eod_status_history')
        ?.select('*')
        ?.eq('entry_id', entry?.id)
        ?.order('changed_at', { ascending: true });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev?.includes(id) ? prev?.filter(x => x !== id) : [...prev, id]);
  };

  const filteredEntries = entries?.filter(entry => {
    if (!searchQuery?.trim()) return true;
    let q = searchQuery?.toLowerCase();
    return (
      entry?.offices?.name?.toLowerCase()?.includes(q) ||
      entry?.entry_date?.includes(q) ||
      entry?.submitter_name?.toLowerCase()?.includes(q) ||
      entry?.status?.includes(q)
    );
  });

  const pageView = getEodPage(filteredEntries, displayPage);
  const { manualEntries, apiSyncedGroups } = pageView;

  // Only visible manual rows can be selected for approval.
  const selectableIds = manualEntries
    ?.filter(e =>
      !isApiSyncedRow(e) &&
      (PENDING_STATUSES?.includes(e?.status) || e?.status === 'pending_reapproval')
    )
    ?.map(e => e?.id);

  if (!canApprove) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Icon name="ShieldOff" size={48} className="text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">You don't have permission to view the EOD approval queue.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Breadcrumb items={breadcrumbItems} />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Icon name="ClipboardCheck" size={24} className="text-primary" />
            EOD Approval Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review, approve, reject, or edit End-of-Day report submissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/daily-entry-form')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <Icon name="ClipboardList" size={16} />Submit EOD
          </button>
          <button
            onClick={() => { fetchEntries(); fetchFullCounts(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium transition-colors"
          >
            <Icon name="RefreshCw" size={16} />Refresh
          </button>
        </div>
      </div>
      {/* Source Clarity Banner — context-aware based on active filter */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-sm text-blue-800">
        <Icon name="Info" size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <span>
          {filterStatus === 'api_synced' ? (
            <>
              <strong>Dentrix API Synced view:</strong> These rows are system-synced from Ascend API into <code className="text-xs bg-blue-100 px-1 rounded">daily_entries</code>.{' '}
              They are provider-level rows and do not require human approval. Office gross production is shown once per office/date; provider rows show provider production and provider collection share.{' '}
              These records are read-only in this workflow and do not update <code className="text-xs bg-blue-100 px-1 rounded">monthly_executive_analytics</code>.
            </>
          ) : filterStatus === 'all' ? (
            <>
              <strong>Data source:</strong> This page contains Supabase <code className="text-xs bg-blue-100 px-1 rounded">daily_entries</code> workflow records.{' '}
              Manual EOD submissions are review/attestation workflow only. Dentrix API Synced rows are system-synced provider-level records and do not require human approval.{' '}
              Neither workflow actions nor API-synced rows update <code className="text-xs bg-blue-100 px-1 rounded">monthly_executive_analytics</code> while the analytics sync trigger is disabled.
            </>
          ) : (
            <>
              <strong>Manual EOD workflow:</strong> These are office-manager EOD submissions stored in Supabase <code className="text-xs bg-blue-100 px-1 rounded">daily_entries</code> for review/attestation only.{' '}
              Production and Collection values are staff-entered, not Dentrix/FastAPI actuals.{' '}
              Approval/rejection updates workflow status/history only and does not update <code className="text-xs bg-blue-100 px-1 rounded">monthly_executive_analytics</code> because the analytics sync trigger is disabled.
            </>
          )}
        </span>
      </div>
      {/* Summary Cards — counts from full-scope count queries, independent of active status filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          {
            label: 'Pending Approval',
            count: fullCounts?.pending,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50 border-yellow-200',
            icon: 'Clock',
            val: 'pending',
          },
          {
            label: 'Workflow Approved',
            count: fullCounts?.approved,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 border-emerald-200',
            icon: 'CheckCircle',
            val: 'approved',
          },
          {
            label: 'Rejected',
            count: fullCounts?.rejected,
            color: 'text-red-600',
            bg: 'bg-red-50 border-red-200',
            icon: 'XCircle',
            val: 'rejected',
          },
          {
            label: 'Pending Re-Approval',
            count: fullCounts?.pending_reapproval,
            color: 'text-orange-600',
            bg: 'bg-orange-50 border-orange-200',
            icon: 'RefreshCw',
            val: 'pending_reapproval',
          },
          {
            label: 'Dentrix API Synced',
            count: fullCounts?.api_synced,
            color: 'text-violet-600',
            bg: 'bg-violet-50 border-violet-200',
            icon: 'Zap',
            val: 'api_synced',
          },
        ]?.map(card => (
          <button
            key={card?.val}
            onClick={() => setFilterStatus(card?.val)}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${card?.bg} ${filterStatus === card?.val ? 'ring-2 ring-offset-1 ring-current' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon name={card?.icon} size={16} className={card?.color} />
              <span className="text-xs font-medium text-muted-foreground leading-tight">{card?.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card?.color}`}>
              {countsLoading ? <span className="text-base opacity-50">…</span> : card?.count}
            </p>
          </button>
        ))}
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e?.target?.value)}
            placeholder="Search by office, submitter, date..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e?.target?.value)}
          className="px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Workflow Approved</option>
          <option value="rejected">Rejected</option>
          <option value="pending_reapproval">Pending Re-Approval</option>
          <option value="rejected_after_approval">Rejected After Approval</option>
          <option value="api_synced">Dentrix API Synced</option>
        </select>
        <select
          value={filterOffice}
          onChange={e => setFilterOffice(e?.target?.value)}
          className="px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Offices</option>
          {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e?.target?.value)}
          className="px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {filterDate && (
          <button onClick={() => setFilterDate('')} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="X" size={16} />
          </button>
        )}
      </div>
      {/* Bulk Actions Bar */}
      {selectedIds?.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium text-primary">{selectedIds?.length} selected</span>
          <div className="flex-1" />
          <button onClick={handleBulkApprove} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Icon name="CheckCheck" size={16} />Approve All
          </button>
          <button onClick={() => { setBulkRejectReason(''); setBulkRejectOpen(true); }} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Icon name="XCircle" size={16} />Reject All
          </button>
          <button onClick={() => setSelectedIds([])} className="text-sm text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}
      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div role="alert" className="p-5 text-sm text-destructive">{loadError}</div>
        ) : filteredEntries?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Icon name="Inbox" size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No EOD reports found</p>
            <p className="text-xs mt-1">{filterStatus === 'pending' ? 'No pending submissions — all caught up!' : 'Try adjusting your filters'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectableIds?.length > 0 && selectedIds?.length === selectableIds?.length}
                      onChange={() => setSelectedIds(selectedIds?.length === selectableIds?.length ? [] : selectableIds)}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Office</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">EOD Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted At</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Production</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collection</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* ── Manual workflow rows ── */}
                {manualEntries?.map(entry => {
                  const isPending = PENDING_STATUSES?.includes(entry?.status) || entry?.status === 'pending_reapproval';
                  const isApproved = entry?.status === 'approved';
                  return (
                    <tr
                      key={entry?.id}
                      className={`hover:bg-muted/30 transition-colors ${selectedIds?.includes(entry?.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {isPending && (
                          <input type="checkbox" checked={selectedIds?.includes(entry?.id)} onChange={() => toggleSelect(entry?.id)} className="rounded border-border" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{entry?.offices?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {entry?.entry_date ? format(parseISO(entry?.entry_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{entry?.submitter_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {entry?.submitted_at ? format(parseISO(entry?.submitted_at), 'MMM d, h:mm a') : '—'}
                      </td>
                      {/* Manual rows: use total_production || production (existing behavior) */}
                      <td className="px-4 py-3 text-right font-medium text-foreground">{fmt(entry?.total_production ?? entry?.production)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmt(entry?.total_collection ?? entry?.collection)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={entry?.status} isApiSynced={false} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setReviewEntry(entry); setReviewNote(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Icon name="Eye" size={13} />
                            {isPending ? 'Review' : 'View'}
                          </button>
                          {isPending && (
                            <>
                              <button onClick={() => handleApprove(entry)} disabled={actionLoading} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Quick Approve">
                                <Icon name="Check" size={16} />
                              </button>
                              <button onClick={() => { setReviewEntry(entry); setReviewNote(''); }} disabled={actionLoading} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Reject">
                                <Icon name="X" size={16} />
                              </button>
                            </>
                          )}
                          {isApproved && canPostApprovalAction && (
                            <>
                              <button onClick={() => openEditApproved(entry)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Approved Record">
                                <Icon name="Pencil" size={14} />
                              </button>
                              <button onClick={() => openRejectAfterApproval(entry)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Reject After Approval">
                                <Icon name="AlertTriangle" size={14} />
                              </button>
                            </>
                          )}
                          <button onClick={() => openHistory(entry)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors" title="Audit Trail">
                            <Icon name="History" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* ── Dentrix API Synced rows — grouped by office + date ── */}
                {apiSyncedGroups?.map(group => (
                  <React.Fragment key={group?.key}>
                    {/* Group header row */}
                    <tr className="bg-violet-50/60 border-t-2 border-violet-200">
                      <td colSpan={9} className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800">
                            <Icon name="Zap" size={13} className="text-violet-600" />
                            Dentrix API Synced
                          </span>
                          <span className="text-xs font-semibold text-violet-900">
                            {group?.officeName}
                          </span>
                          <span className="text-xs text-violet-700">
                            {group?.entryDate ? format(parseISO(group?.entryDate), 'MMM d, yyyy') : '—'}
                          </span>
                          <span className="text-xs text-violet-700">
                            <span className="font-medium">Office Gross Production:</span>{' '}
                            {fmt(group?.officeGrossProduction)}
                            <span className="ml-1 text-violet-500 font-normal">(office daily total — not summed per provider)</span>
                          </span>
                          <span className="text-xs text-violet-700">
                            <span className="font-medium">Total Collections:</span>{' '}
                            {group?.totalCollections > 0 ? fmt(group?.totalCollections) : '—'}
                          </span>
                          <span className="text-xs text-violet-500 font-normal">
                            {group?.rows?.length} provider row{group?.rows?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Provider rows under this group */}
                    {group?.rows?.map(entry => (
                      <tr
                        key={entry?.id}
                        className="hover:bg-violet-50/40 transition-colors bg-violet-50/20"
                      >
                        {/* No checkbox — API-synced rows are read-only */}
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 font-medium text-foreground pl-8 text-xs text-muted-foreground">
                          {/* Indented under group header — office already shown in header */}
                          {entry?.provider_name ? (
                            <span className="inline-flex items-center gap-1 text-violet-800 font-semibold text-sm">
                              <Icon name="User" size={12} className="text-violet-500" />
                              {entry?.provider_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">No provider name</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {entry?.entry_date ? format(parseISO(entry?.entry_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="inline-flex items-center gap-1 text-violet-700 font-medium text-xs">
                            <Icon name="Zap" size={11} className="text-violet-500" />
                            Ascend API Sync
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {entry?.submitted_at ? format(parseISO(entry?.submitted_at), 'MMM d, h:mm a') : '—'}
                        </td>
                        {/* API-synced: show provider-level production (entry.production), NOT total_production */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-medium text-foreground">{fmt(entry?.production)}</span>
                            <span className="text-xs text-violet-600 font-normal" title="Provider-level production. Office total shown in grouped header above.">
                              Provider production
                            </span>
                          </div>
                        </td>
                        {/* API-synced: show provider-level collection share (entry.collection) */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-muted-foreground">{fmt(entry?.collection)}</span>
                            <span className="text-xs text-violet-600 font-normal">Provider share</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={entry?.status} isApiSynced={true} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {/* View and Audit only — no approval/rejection/edit actions */}
                            <button
                              onClick={() => { setReviewEntry(entry); setReviewNote(''); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Icon name="Eye" size={13} />
                              View
                            </button>
                            <button onClick={() => openHistory(entry)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors" title="Audit Trail">
                              <Icon name="History" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !loadError && filteredEntries.length > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span>{filteredEntries.length.toLocaleString()} entries · Page {pageView.page} of {pageView.pageCount}</span>
          <div className="flex gap-2">
            <button disabled={pageView.page <= 1} onClick={() => { setSelectedIds([]); setDisplayPage(pageView.page - 1); }} className="px-3 py-2 rounded-lg border border-border disabled:opacity-50">Previous page</button>
            <button disabled={pageView.page >= pageView.pageCount} onClick={() => { setSelectedIds([]); setDisplayPage(pageView.page + 1); }} className="px-3 py-2 rounded-lg border border-border disabled:opacity-50">Next page</button>
          </div>
        </div>
      )}
      {bulkRejectOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-reject-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-popover border border-border rounded-xl shadow-2xl p-5 space-y-4">
            <h2 id="bulk-reject-title" className="text-base font-bold text-foreground">Reject selected reports</h2>
            <p className="text-sm text-muted-foreground">Provide a reason for all {selectedIds?.length} selected reports.</p>
            <label htmlFor="bulk-reject-reason" className="block text-sm font-medium text-foreground">Rejection reason (required)</label>
            <textarea id="bulk-reject-reason" value={bulkRejectReason} onChange={e => setBulkRejectReason(e?.target?.value)} rows={3} autoFocus disabled={actionLoading}
              className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="flex gap-3">
              <button onClick={() => { setBulkRejectOpen(false); setBulkRejectReason(''); }} disabled={actionLoading}
                className="flex-1 py-2 border border-border rounded-lg text-sm disabled:opacity-50">Cancel</button>
              <button onClick={handleBulkReject} disabled={actionLoading || !bulkRejectReason?.trim()}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50">{actionLoading ? 'Processing...' : 'Reject selected'}</button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Review / Approve / Reject Modal ─────────────────────────────────── */}
      {reviewEntry && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewEntry(null)} />
          <div className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">EOD Report Review</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{reviewEntry?.offices?.name || 'Unknown Office'}</p>
              </div>
              <button onClick={() => setReviewEntry(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* API-synced notice */}
              {isApiSyncedRow(reviewEntry) && (
                <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <Icon name="Zap" size={15} className="text-violet-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-violet-800">Dentrix API Synced Record</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      This record was submitted by the Ascend API Sync pipeline (Dentrix system source). It does not require human approval and is read-only in this workflow.
                    </p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current Status</span>
                <StatusBadge status={reviewEntry?.status} isApiSynced={isApiSyncedRow(reviewEntry)} />
              </div>

              {/* Key fields grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Office</p>
                  <p className="text-sm font-semibold text-foreground">{reviewEntry?.offices?.name || '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">EOD Date</p>
                  <p className="text-sm font-semibold text-foreground">
                    {reviewEntry?.entry_date ? format(parseISO(reviewEntry?.entry_date), 'MMMM d, yyyy') : '—'}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Submitted By</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isApiSyncedRow(reviewEntry) ? (
                      <span className="text-violet-700">Ascend API Sync (System)</span>
                    ) : (
                      reviewEntry?.submitter_name || '—'
                    )}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Submitted At</p>
                  <p className="text-sm font-semibold text-foreground">
                    {reviewEntry?.submitted_at ? format(parseISO(reviewEntry?.submitted_at), 'MMM d, h:mm a') : '—'}
                  </p>
                </div>

                {/* ── Production display: API-synced vs manual ── */}
                {isApiSyncedRow(reviewEntry) ? (
                  <>
                    {/* Provider-level production — the actual per-provider value */}
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                      <p className="text-xs text-violet-700 mb-1 font-medium">Provider Production</p>
                      <p className="text-sm font-bold text-violet-900">{fmt(reviewEntry?.production)}</p>
                      <p className="text-xs text-violet-600 mt-0.5">Provider-level gross production for this row</p>
                    </div>
                    {/* Provider-level collection share */}
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                      <p className="text-xs text-violet-700 mb-1 font-medium">Provider Collection Share</p>
                      <p className="text-sm font-bold text-violet-900">{fmt(reviewEntry?.collection)}</p>
                      <p className="text-xs text-violet-600 mt-0.5">Proportional collection share for this provider</p>
                    </div>
                    {/* Office gross production — context field, shown once */}
                    <div className="col-span-2 bg-muted/40 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Office Daily Gross Production</p>
                      <p className="text-sm font-bold text-foreground">{fmt(reviewEntry?.total_production)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        Office daily gross production — repeated context field, not row-level. Do not sum across provider rows.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Manual rows: existing behavior */}
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Production</p>
                      <p className="text-sm font-bold text-foreground">{fmt(reviewEntry?.total_production ?? reviewEntry?.production)}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Collection</p>
                      <p className="text-sm font-bold text-foreground">{fmt(reviewEntry?.total_collection ?? reviewEntry?.collection)}</p>
                    </div>
                  </>
                )}

                {(reviewEntry?.new_patients !== null && reviewEntry?.new_patients !== undefined) && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">New Patients</p>
                    <p className="text-sm font-semibold text-foreground">{reviewEntry?.new_patients}</p>
                  </div>
                )}
                {(reviewEntry?.no_shows !== null && reviewEntry?.no_shows !== undefined) && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">No Shows</p>
                    <p className="text-sm font-semibold text-foreground">{reviewEntry?.no_shows}</p>
                  </div>
                )}
                {reviewEntry?.expense_category && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Expense</p>
                    <p className="text-sm font-semibold text-foreground">
                      {reviewEntry?.expense_category} — {fmt(reviewEntry?.expense_amount)}
                    </p>
                  </div>
                )}
                {reviewEntry?.provider_name && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Provider</p>
                    <p className="text-sm font-semibold text-foreground">{reviewEntry?.provider_name}</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {reviewEntry?.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Notes from Office Manager</p>
                  <p className="text-sm text-foreground bg-muted rounded-lg p-3">{reviewEntry?.notes}</p>
                </div>
              )}

              {/* Approval info (if already actioned and NOT api-synced) */}
              {!isApiSyncedRow(reviewEntry) && reviewEntry?.status === 'approved' && reviewEntry?.approver_name && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Approved by {reviewEntry?.approver_name}</p>
                  {reviewEntry?.approved_at && (
                    <p className="text-xs text-emerald-600">{format(parseISO(reviewEntry?.approved_at), 'MMM d, yyyy h:mm a')}</p>
                  )}
                  {reviewEntry?.approval_note && (
                    <p className="text-xs text-emerald-700 mt-1">{reviewEntry?.approval_note}</p>
                  )}
                </div>
              )}

              {/* Rejection info */}
              {reviewEntry?.status === 'rejected' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    Rejected {reviewEntry?.approver_name ? `by ${reviewEntry?.approver_name}` : ''}
                  </p>
                  {reviewEntry?.rejection_reason && (
                    <p className="text-xs text-red-700 mt-1">Reason: {reviewEntry?.rejection_reason}</p>
                  )}
                </div>
              )}

              {/* Comment field for pending entries — only for non-api-synced */}
              {!isApiSyncedRow(reviewEntry) && ['pending', 'pending_review', 'pending_reapproval']?.includes(reviewEntry?.status) && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Comment <span className="text-muted-foreground font-normal">(required for rejection)</span>
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e?.target?.value)}
                    rows={3}
                    placeholder="Add approval note or rejection reason..."
                    className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Footer actions — only for non-api-synced pending entries */}
            {!isApiSyncedRow(reviewEntry) && ['pending', 'pending_review', 'pending_reapproval']?.includes(reviewEntry?.status) && (
              <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-muted/30 flex-shrink-0">
                <button
                  onClick={() => handleApprove(reviewEntry, reviewNote)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Icon name="CheckCircle" size={16} />
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(reviewEntry, reviewNote)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Icon name="XCircle" size={16} />
                  {actionLoading ? 'Processing...' : 'Reject'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ─── Reject After Approval Warning Modal ─────────────────────────────── */}
      {showRejectWarning && rejectAfterApprovalEntry && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-popover border border-rose-300 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-rose-50 border-b border-rose-200">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Icon name="AlertTriangle" size={20} className="text-rose-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-800">Reverse Approval Warning</h2>
                <p className="text-xs text-rose-600 mt-0.5">This action cannot be undone without re-approval</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800 space-y-1">
                <p className="font-semibold">⚠ You are about to reverse an approved EOD record.</p>
                <p>This will:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                  <li>Change status from <strong>Approved</strong> → <strong>Rejected After Approval</strong></li>
                  <li>Notify the Office Manager</li>
                  <li>Record the full audit trail</li>
                </ul>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{rejectAfterApprovalEntry?.offices?.name} — {rejectAfterApprovalEntry?.entry_date ? format(parseISO(rejectAfterApprovalEntry?.entry_date), 'MMM d, yyyy') : ''}</p>
                <p>Production: {isApiSyncedRow(rejectAfterApprovalEntry) ? fmt(rejectAfterApprovalEntry?.production) : fmt(rejectAfterApprovalEntry?.total_production ?? rejectAfterApprovalEntry?.production)}</p>
                <p>Approved by: {rejectAfterApprovalEntry?.approver_name || '—'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={rejectAfterApprovalReason}
                  onChange={e => setRejectAfterApprovalReason(e?.target?.value)}
                  rows={3}
                  placeholder="Required: Explain why this approved record is being rejected..."
                  className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-muted/30">
              <button
                onClick={() => { setShowRejectWarning(false); setRejectAfterApprovalEntry(null); setRejectAfterApprovalReason(''); }}
                className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAfterApproval}
                disabled={actionLoading || !rejectAfterApprovalReason?.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Icon name="AlertTriangle" size={16} />
                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Edit Approved EOD Warning + Form Modal ───────────────────────────── */}
      {showEditWarning && editApprovedEntry && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl bg-popover border border-blue-300 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 border-b border-blue-200 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon name="Pencil" size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-blue-800">Edit Approved EOD Record</h2>
                <p className="text-xs text-blue-600 mt-0.5">Record will move to Pending Re-Approval after saving</p>
              </div>
              <button onClick={() => { setShowEditWarning(false); setEditApprovedEntry(null); }} className="ml-auto p-1.5 rounded-lg hover:bg-blue-100 text-blue-600">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-1">
                <p className="font-semibold">ℹ Workflow: Option 1 (Safer)</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                  <li>Editing moves this record to <strong>Pending Re-Approval</strong></li>
                  <li>Full audit trail of all changes is preserved</li>
                  <li>Record must be re-approved to post to analytics</li>
                </ul>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">{editApprovedEntry?.offices?.name} — {editApprovedEntry?.entry_date ? format(parseISO(editApprovedEntry?.entry_date), 'MMM d, yyyy') : ''}</p>
                <p>Approved by: {editApprovedEntry?.approver_name || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {EDITABLE_FIELDS?.map(field => (
                  <div key={field?.key} className={field?.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="text-xs font-medium text-foreground mb-1 block">{field?.label}</label>
                    {field?.type === 'textarea' ? (
                      <textarea
                        value={editFields?.[field?.key] ?? ''}
                        onChange={e => setEditFields(prev => ({ ...prev, [field?.key]: e?.target?.value }))}
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      />
                    ) : (
                      <input
                        type={field?.type}
                        value={editFields?.[field?.key] ?? ''}
                        onChange={e => setEditFields(prev => ({ ...prev, [field?.key]: e?.target?.value }))}
                        className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Edit Reason <span className="text-blue-600">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={e => setEditReason(e?.target?.value)}
                  rows={2}
                  placeholder="Required: Explain why this approved record is being edited..."
                  className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-muted/30 flex-shrink-0">
              <button
                onClick={() => { setShowEditWarning(false); setEditApprovedEntry(null); setEditFields({}); setEditReason(''); }}
                className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditApproved}
                disabled={actionLoading || !editReason?.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Icon name="Save" size={16} />
                {actionLoading ? 'Saving...' : 'Save & Send for Re-Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Audit History Modal ──────────────────────────────────────────────── */}
      {historyEntry && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryEntry(null)} />
          <div className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">Status History & Audit Trail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {historyEntry?.offices?.name} — {historyEntry?.entry_date ? format(parseISO(historyEntry?.entry_date), 'MMM d, yyyy') : ''}
                </p>
              </div>
              <button onClick={() => setHistoryEntry(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {/* Current status summary */}
              <div className="flex items-center justify-between mb-4 p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground">Current Status</span>
                <StatusBadge status={historyEntry?.status} isApiSynced={isApiSyncedRow(historyEntry)} />
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="History" size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No status changes recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.map((h, i) => {
                    const isApprovalEvent = h?.to_status === 'approved';
                    const isRejectionEvent = ['rejected', 'rejected_after_approval']?.includes(h?.to_status);
                    const isEditEvent = h?.event_type === 'edit_after_approval';
                    const isReapprovalEvent = h?.to_status === 'pending_reapproval';
                    const iconName = isApprovalEvent ? 'CheckCircle' : isRejectionEvent ? 'XCircle' : isEditEvent ? 'Pencil' : isReapprovalEvent ? 'RefreshCw' : 'Clock';
                    const iconColor = isApprovalEvent ? 'text-emerald-600' : isRejectionEvent ? 'text-red-500' : isEditEvent ? 'text-blue-500' : isReapprovalEvent ? 'text-orange-500' : 'text-yellow-600';
                    return (
                      <div key={h?.id || i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon name={iconName} size={14} className={iconColor} />
                          </div>
                          {i < history?.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {h?.from_status ? (
                                  <span>
                                    <span className="capitalize">{STATUS_CONFIG?.[h?.from_status]?.label || h?.from_status}</span>
                                    <span className="text-muted-foreground mx-1">→</span>
                                    <span className="capitalize">{STATUS_CONFIG?.[h?.to_status]?.label || h?.to_status}</span>
                                  </span>
                                ) : (
                                  <span className="capitalize">{STATUS_CONFIG?.[h?.to_status]?.label || h?.to_status}</span>
                                )}
                              </p>
                              {h?.event_type && (
                                <span className="text-xs text-muted-foreground capitalize">{h?.event_type?.replace(/_/g, ' ')}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              {h?.changed_at ? format(parseISO(h?.changed_at), 'MMM d, h:mm a') : ''}
                            </span>
                          </div>
                          {h?.changer_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              by {h?.changer_name}{h?.changer_role ? ` (${h?.changer_role?.replace(/_/g, ' ')})` : ''}
                            </p>
                          )}
                          {(h?.note || h?.rejection_reason || h?.edit_reason || h?.approval_reversal_reason) && (
                            <p className="text-xs text-foreground bg-muted rounded px-2 py-1 mt-1">
                              {h?.rejection_reason || h?.edit_reason || h?.approval_reversal_reason || h?.note}
                            </p>
                          )}
                          {h?.old_values && Object.keys(h?.old_values)?.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View changed fields</summary>
                              <div className="mt-1 space-y-0.5">
                                {Object.entries(h?.old_values)?.map(([key, oldVal]) => (
                                  <div key={key} className="text-xs bg-muted/50 rounded px-2 py-0.5">
                                    <span className="font-medium">{key}:</span>{' '}
                                    <span className="text-red-500 line-through">{String(oldVal ?? '—')}</span>
                                    {' → '}
                                    <span className="text-emerald-600">{String(h?.new_values?.[key] ?? '—')}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovalsPage;
