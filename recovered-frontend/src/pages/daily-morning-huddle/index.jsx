import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';

import { huddleService } from '../../services/huddleService';
import { ascendApi } from '../../services/ascendApi';
import { notifyHuddleSubmitted, notifyHuddleUnlocked } from '../../services/pushNotificationService';
import ProductionBlock from './components/ProductionBlock';
import ChecklistSection from './components/ChecklistSection';
import UnlockModal from './components/UnlockModal';
import HuddleHistory from './components/HuddleHistory';
import { useNavigate } from 'react-router-dom';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useOffice } from '../../contexts/OfficeContext';
import { fetchYesterdayActualsByOffice } from '../../services/dailyEntryBulkImportService';
import { supabase } from '../../lib/supabase';
import useHomeNavigation from '../../hooks/useHomeNavigation';

// ─── Approval notification helper ─────────────────────────────────────────
const sendHuddleApprovalNotification = async ({ submitterName, officeName, date, huddleId }) => {
  try {
    const { data: { session } } = await supabase?.auth?.getSession();
    const token = session?.access_token;
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/approval-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type: 'morning_huddle',
        submitter_name: submitterName,
        office_name: officeName,
        date,
        entry_id: huddleId,
      }),
    });
  } catch (err) {
    console.error('[approval-notification] morning_huddle email failed:', err?.message);
  }
};

// ─── Null-safe display helpers ─────────────────────────────────────────────
const fmtCurrency = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtNumber = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return n?.toLocaleString();
};

const fmtPlusMinus = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n)}`;
};

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return `${n?.toFixed(1)}%`;
};

const plusMinusColor = (v) => {
  if (v === null || v === undefined || v === '') return 'text-muted-foreground';
  const n = parseFloat(v);
  if (isNaN(n)) return 'text-muted-foreground';
  return n >= 0 ? 'text-success' : 'text-destructive';
};

const TABS = [
  { id: 'today', label: 'Today', icon: 'Sun' },
  { id: 'history', label: 'History', icon: 'Clock' },
  { id: 'reports', label: 'Reports', icon: 'BarChart2' },
];

const STATUS_BADGE = {
  draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', cls: 'bg-success/10 text-success border border-success/20' },
  unlocked: { label: 'Unlocked (Audit)', cls: 'bg-warning/10 text-warning border border-warning/20' },
};

// ─── Read-only prefill field ───────────────────────────────────────────────
const PrefillField = ({ label, value, helper, colorClass }) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <div className={`px-3 py-2 text-sm font-medium rounded-md bg-muted border border-border ${colorClass || 'text-foreground'}`}>
      {value}
    </div>
    {helper && <p className="text-[10px] text-muted-foreground mt-0.5">{helper}</p>}
  </div>
);

const DailyMorningHuddle = () => {
  const { userProfile, user } = useAuth();
  const goHome = useHomeNavigation();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading, permissionsMap } = useRolePermissions();
  const {
    offices,
    selectedOfficeId,
    switchOffice,
    canSwitchOffice,
    officesLoading,
    officeDisplayName,
  } = useOffice();

  const [activeTab, setActiveTab] = useState('today');
  const [huddle, setHuddle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date()?.toISOString()?.split('T')?.[0]);
  const [viewingHistoryId, setViewingHistoryId] = useState(null);
  const [yesterdayActuals, setYesterdayActuals] = useState(null);
  const [yesterdayLoading, setYesterdayLoading] = useState(false);

  // Prefill state
  const [prefill, setPrefill] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState(null);

  const isAdmin = ['super_admin', 'admin', 'office_manager', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);
  const isLocked = huddle?.status === 'submitted' && !isAdmin;
  const isFullyLocked = huddle?.status === 'submitted';
  const canUnlock = isAdmin && huddle?.status === 'submitted';
  const canEdit = huddle?.status === 'draft' || huddle?.status === 'unlocked' || (isAdmin && huddle?.status === 'submitted');
  const canHuddleEdit = hasPermission('huddle:edit');

  // Load today's huddle
  useEffect(() => {
    if (!selectedOfficeId || !user?.id) return;
    if (viewingHistoryId) return;
    if (activeTab === 'today') loadTodayHuddle();
  }, [selectedOfficeId, user?.id, activeTab, selectedDate, viewingHistoryId]);

  // Load prefill data from /v2/huddle/prefill
  useEffect(() => {
    if (!selectedOfficeId || !selectedDate || activeTab !== 'today') return;
    const loadPrefill = async () => {
      setPrefillLoading(true);
      setPrefillError(null);
      try {
        const data = await ascendApi?.getHuddlePrefill({ officeId: selectedOfficeId, date: selectedDate });
        setPrefill(data);
      } catch (err) {
        // Non-blocking — huddle still works without prefill
        setPrefillError(err?.message || 'Prefill unavailable');
        setPrefill(null);
      } finally {
        setPrefillLoading(false);
      }
    };
    loadPrefill();
  }, [selectedOfficeId, selectedDate, activeTab]);

  // Load yesterday's actuals from daily_entries for the selected office
  useEffect(() => {
    if (!selectedOfficeId) return;
    const loadYesterdayActuals = async () => {
      setYesterdayLoading(true);
      try {
        const actuals = await fetchYesterdayActualsByOffice(selectedOfficeId);
        setYesterdayActuals(actuals);
      } catch (err) {
        // Non-critical
      } finally {
        setYesterdayLoading(false);
      }
    };
    loadYesterdayActuals();
  }, [selectedOfficeId]);

  // Listen for bulk import completion to reload yesterday's actuals
  useEffect(() => {
    const handleDailyEntriesUpdated = () => {
      if (!selectedOfficeId) return;
      const loadYesterdayActuals = async () => {
        setYesterdayLoading(true);
        try {
          const actuals = await fetchYesterdayActualsByOffice(selectedOfficeId);
          setYesterdayActuals(actuals);
        } catch (err) {
          // Non-critical
        } finally {
          setYesterdayLoading(false);
        }
      };
      loadYesterdayActuals();
    };
    window.addEventListener('daily-entries-updated', handleDailyEntriesUpdated);
    return () => window.removeEventListener('daily-entries-updated', handleDailyEntriesUpdated);
  }, [selectedOfficeId]);

  // Redirect if user lacks huddle:view permission (after permissions loaded)
  useEffect(() => {
    if (!permLoading && userProfile && permissionsMap && Object.keys(permissionsMap)?.length > 0 && !hasPermission('huddle:view')) {
      navigate('/executive-overview', { replace: true });
    }
  }, [permLoading, userProfile, permissionsMap, hasPermission, navigate]);

  const loadTodayHuddle = async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await huddleService?.getOrCreateHuddleForDate(selectedOfficeId, user?.id, selectedDate);
      const full = await huddleService?.getHuddleById(h?.id);
      setHuddle(full);
    } catch (err) {
      setError(err?.message || 'Failed to load huddle');
    } finally {
      setLoading(false);
    }
  };

  const loadHuddleById = async (id) => {
    navigate(`/huddle-history?id=${id}`);
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Update huddle field
  const handleHuddleFieldChange = useCallback(async (field, value) => {
    if (!huddle?.id || isFullyLocked) return;
    setHuddle(prev => ({ ...prev, [field]: value }));
    try {
      await huddleService?.updateHuddle(huddle?.id, { [field]: value }, user?.id);
    } catch (err) {
      setError('Auto-save failed: ' + err?.message);
    }
  }, [huddle?.id, user?.id, isFullyLocked]);

  // Update provider block
  const handleBlockChange = useCallback(async (blockId, updates) => {
    if (isFullyLocked) return;
    if (!blockId) {
      // Placeholder block — need to create the DB row first
      // Find the placeholder by block_type from updates
      const blockType = updates?.block_type;
      if (!blockType || !huddle?.id) return;
      try {
        const { data: newBlock, error } = await supabase
          ?.from('huddle_provider_blocks')
          ?.insert({
            huddle_id: huddle?.id,
            block_type: blockType,
            block_order: updates?.block_order || (blockType === 'doctor' ? 1 : 3),
            ...updates,
          })
          ?.select()
          ?.single();
        if (error) throw error;
        // Add new block to state
        setHuddle(prev => ({
          ...prev,
          providerBlocks: [...(prev?.providerBlocks || []), newBlock],
        }));
      } catch (err) {
        setError('Failed to create provider block: ' + err?.message);
      }
      return;
    }
    setHuddle(prev => ({
      ...prev,
      providerBlocks: prev?.providerBlocks?.map(b => b?.id === blockId ? { ...b, ...updates } : b),
    }));
    try {
      await huddleService?.updateProviderBlock(blockId, updates);
    } catch (err) {
      setError('Failed to save block: ' + err?.message);
    }
  }, [isFullyLocked, huddle?.id]);

  // Toggle checklist item — creates missing row if placeholder
  const handleChecklistToggle = useCallback(async (itemId, completed, placeholderMeta) => {
    if (isFullyLocked) return;
    if (!itemId && placeholderMeta) {
      // Placeholder item — create the DB row
      try {
        const { data: newItem, error } = await supabase
          ?.from('huddle_checklist_items')
          ?.insert({
            huddle_id: placeholderMeta?.huddle_id,
            section: placeholderMeta?.section,
            item_number: placeholderMeta?.item_number,
            item_text: placeholderMeta?.item_text,
            completed,
            notes: placeholderMeta?.notes || '',
          })
          ?.select()
          ?.single();
        if (error) throw error;
        setHuddle(prev => ({
          ...prev,
          checklistItems: [...(prev?.checklistItems || []), newItem],
        }));
      } catch (err) {
        setError('Failed to create checklist item: ' + err?.message);
      }
      return;
    }
    setHuddle(prev => ({
      ...prev,
      checklistItems: prev?.checklistItems?.map(i => i?.id === itemId ? { ...i, completed } : i),
    }));
    try {
      await huddleService?.updateChecklistItem(itemId, { completed });
    } catch (err) {
      setError('Failed to update checklist: ' + err?.message);
    }
  }, [isFullyLocked]);

  // Update checklist notes — creates missing row if placeholder
  const handleChecklistNotes = useCallback(async (itemId, notes, placeholderMeta) => {
    if (isFullyLocked) return;
    if (!itemId && placeholderMeta) {
      // Placeholder item — create the DB row
      try {
        const { data: newItem, error } = await supabase
          ?.from('huddle_checklist_items')
          ?.insert({
            huddle_id: placeholderMeta?.huddle_id,
            section: placeholderMeta?.section,
            item_number: placeholderMeta?.item_number,
            item_text: placeholderMeta?.item_text,
            completed: placeholderMeta?.completed || false,
            notes,
          })
          ?.select()
          ?.single();
        if (error) throw error;
        setHuddle(prev => ({
          ...prev,
          checklistItems: [...(prev?.checklistItems || []), newItem],
        }));
      } catch (err) {
        setError('Failed to create checklist item: ' + err?.message);
      }
      return;
    }
    setHuddle(prev => ({
      ...prev,
      checklistItems: prev?.checklistItems?.map(i => i?.id === itemId ? { ...i, notes } : i),
    }));
    try {
      await huddleService?.updateChecklistItem(itemId, { notes });
    } catch (err) {
      setError('Failed to update notes: ' + err?.message);
    }
  }, [isFullyLocked]);

  // Submit huddle
  const handleSubmit = async () => {
    if (!huddle?.id) return;
    setSubmitting(true);
    try {
      const updated = await huddleService?.submitHuddle(huddle?.id, user?.id);
      setHuddle(prev => ({ ...prev, ...updated }));
      showSuccess('Huddle submitted successfully!');
      const officeName = offices?.find(o => o?.id === selectedOfficeId)?.name || officeDisplayName;
      await notifyHuddleSubmitted({
        officeName,
        huddleDate: huddle?.huddle_date,
        submittedBy: userProfile?.full_name || '',
        huddleId: huddle?.id,
      });
      sendHuddleApprovalNotification({
        submitterName: userProfile?.full_name || userProfile?.email || 'Staff',
        officeName,
        date: huddle?.huddle_date || selectedDate,
        huddleId: huddle?.id,
      });
    } catch (err) {
      setError('Submit failed: ' + err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Unlock huddle
  const handleUnlock = async (reason) => {
    if (!huddle?.id) return;
    setUnlockLoading(true);
    try {
      const updated = await huddleService?.unlockHuddle(huddle?.id, user?.id, reason);
      setHuddle(prev => ({ ...prev, ...updated }));
      setShowUnlockModal(false);
      showSuccess('Huddle unlocked for editing.');
      const officeName = offices?.find(o => o?.id === selectedOfficeId)?.name || officeDisplayName;
      await notifyHuddleUnlocked({
        officeName,
        huddleDate: huddle?.huddle_date,
        unlockedBy: userProfile?.full_name || '',
      });
    } catch (err) {
      setError('Unlock failed: ' + err?.message);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Notes addendum (always editable for submitted)
  const handleAddendumChange = async (value) => {
    setHuddle(prev => ({ ...prev, notes_addendum: value }));
    try {
      await huddleService?.updateHuddle(huddle?.id, { notes_addendum: value }, user?.id);
    } catch (err) {
      setError('Failed to save addendum');
    }
  };

  // Derive 2 doctor + 2 hygienist blocks — V497B compatibility fix
  // Group by block_type FIRST (ignore block_order for grouping), then take first 2 of each type.
  // This handles legacy huddles where block_order patterns differ from new 1–4 scheme.
  const allBlocks = huddle?.providerBlocks || [];

  const getDisplayBlocks = () => {
    // Group all blocks by type regardless of block_order
    const doctorBlocks = allBlocks?.filter(b => b?.block_type === 'doctor')?.slice(0, 2);
    const hygienistBlocks = allBlocks?.filter(b => b?.block_type === 'hygienist')?.slice(0, 2);

    // If block_type is not set on any blocks (very old legacy), fall back to block_order position
    if (doctorBlocks?.length === 0 && hygienistBlocks?.length === 0 && allBlocks?.length > 0) {
      const ordered = [...allBlocks]?.sort((a, b) => (a?.block_order || 0) - (b?.block_order || 0));
      return {
        doctors: ordered?.slice(0, 2),
        hygienists: ordered?.slice(2, 4),
      };
    }

    return { doctors: doctorBlocks, hygienists: hygienistBlocks };
  };

  const { doctors: doctorBlocksDisplay, hygienists: hygienistBlocksDisplay } = getDisplayBlocks();

  // Build placeholder blocks for missing slots (do NOT persist until provider is selected)
  // Placeholders are frontend-only objects — they have no DB id yet
  const buildPlaceholderBlock = (blockType, slotIndex) => ({
    id: null,
    isPlaceholder: true,
    block_type: blockType,
    block_order: blockType === 'doctor' ? slotIndex + 1 : slotIndex + 3,
    provider_name: '',
    provider_id: null,
    monthly_goal: null,
    daily_goal: null,
    monthly_actual: null,
    expected_mtd: null,
    plus_minus: null,
  });

  const doctorSlotsDisplay = [
    doctorBlocksDisplay?.[0] || buildPlaceholderBlock('doctor', 0),
    doctorBlocksDisplay?.[1] || buildPlaceholderBlock('doctor', 1),
  ];
  const hygienistSlotsDisplay = [
    hygienistBlocksDisplay?.[0] || buildPlaceholderBlock('hygienist', 0),
    hygienistBlocksDisplay?.[1] || buildPlaceholderBlock('hygienist', 1),
  ];

  // ── Checklist compatibility merge (V497B) ──────────────────────────────
  // Always show full 10 Front Desk + 9 Back Office items.
  // For existing huddles: merge DB rows with templates by section + item_number.
  // Missing rows render as template text with unchecked/blank — saved on first edit.
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
    'Is there any pending treatment for any of today\'s patients that can be added to the schedule to fill in for cancellations or no-shows if needed?',
    'When can emergencies be scheduled?',
    'Have all lab cases for the day been checked in?',
    'Are photos needed for any patients?',
    'Are any family members overdue for recare?',
  ];

  const mergeChecklistWithTemplate = (section, templates) => {
    const existing = huddle?.checklistItems?.filter(i => i?.section === section) || [];
    return templates?.map((text, idx) => {
      const itemNumber = idx + 1;
      // Match by item_number first, then fall back to item_text match
      const dbRow = existing?.find(i => i?.item_number === itemNumber)
        || existing?.find(i => i?.item_text?.trim() === text?.trim());
      if (dbRow) {
        // Existing row — preserve all data, just ensure item_text is current
        return { ...dbRow, item_text: text };
      }
      // Missing row — render as placeholder (frontend-only, no DB id yet)
      return {
        id: null,
        isPlaceholder: true,
        huddle_id: huddle?.id,
        section,
        item_number: itemNumber,
        item_text: text,
        completed: false,
        notes: '',
      };
    });
  };

  const frontDeskItems = mergeChecklistWithTemplate('front_desk', FRONT_DESK_TEMPLATES);
  const backOfficeItems = mergeChecklistWithTemplate('back_office', BACK_OFFICE_TEMPLATES);

  // Prefill-derived checklist text (use endpoint text if available, else keep existing item_text)
  const prefillFrontDesk = prefill?.checklists?.front_desk || [];
  const prefillBackOffice = prefill?.checklists?.back_office || [];

  const handlePrint = () => window.print();

  // Office production summary from prefill
  const prod = prefill?.office_totals?.production;
  const coll = prefill?.office_totals?.collections;
  const newPt = prefill?.office_totals?.new_patients;
  const warnings = prefill?.warnings || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
              aria-label="Back to Home"
            >
              <Icon name="ChevronLeft" size={18} />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="Sun" size={22} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Daily Morning Huddle</h1>
              <p className="text-xs text-muted-foreground">NU Dental Practice Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {huddle?.status && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_BADGE?.[huddle?.status]?.cls}`}>
                {STATUS_BADGE?.[huddle?.status]?.label}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-smooth print:hidden"
              >
                <Icon name="Printer" size={14} />
                Print
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg w-fit print:hidden">
          {TABS?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => { setActiveTab(tab?.id); setViewingHistoryId(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-smooth ${
                activeTab === tab?.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
            </button>
          ))}
        </div>

        {/* TODAY TAB */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-card border border-border rounded-xl">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e?.target?.value); setViewingHistoryId(null); }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Office</label>
                <select
                  value={selectedOfficeId}
                  onChange={(e) => switchOffice(e?.target?.value)}
                  disabled={!canSwitchOffice || offices?.length <= 1}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {offices?.map(o => (
                    <option key={o?.id} value={o?.id}>{o?.name}</option>
                  ))}
                </select>
                {userProfile?.role === 'office_manager' && offices?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Icon name="Lock" size={11} className="inline mr-1" />
                    Restricted to your assigned office
                  </p>
                )}
              </div>
            </div>

            {/* ── Source Banner ─────────────────────────────────────────── */}
            <div className="flex gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <Icon name="Info" size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                  Huddle goals and actuals are prefilled from <code className="font-mono bg-blue-500/10 px-1 rounded">/v2/huddle/prefill</code> using <code className="font-mono bg-blue-500/10 px-1 rounded">public.goals</code>, <code className="font-mono bg-blue-500/10 px-1 rounded">provider_schedules</code>, and Dentrix/FastAPI actuals. Huddle entries are workflow snapshots for the morning meeting and do not override official Dentrix KPI totals.
                </p>
                {prefill?.sync?.note && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 italic">{prefill?.sync?.note}</p>
                )}
                {prefillLoading && (
                  <p className="text-[11px] text-blue-500 flex items-center gap-1">
                    <Icon name="Loader2" size={11} className="animate-spin" /> Loading prefill data…
                  </p>
                )}
                {prefillError && !prefillLoading && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ Prefill unavailable: {prefillError}. Showing workflow snapshot only.</p>
                )}
              </div>
            </div>

            {/* ── Warnings Panel ────────────────────────────────────────── */}
            {warnings?.length > 0 && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="AlertTriangle" size={14} className="text-amber-500" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Prefill Notices</span>
                </div>
                {warnings?.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400 pl-5">• {typeof w === 'string' ? w : w?.message || JSON.stringify(w)}</p>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16">
                <Icon name="Loader2" size={28} className="animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading huddle...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <Icon name="AlertCircle" size={16} />
                {error}
                <button onClick={() => setError(null)} className="ml-auto"><Icon name="X" size={14} /></button>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
                <Icon name="CheckCircle" size={16} />
                {successMsg}
              </div>
            )}

            {!loading && huddle && (
              <>
                {/* Yesterday's Actuals — auto-populated from bulk import */}
                {(yesterdayActuals || yesterdayLoading) && (
                  <section className="bg-gradient-to-r from-indigo-500/5 to-primary/5 border border-indigo-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="History" size={15} color="#6366f1" />
                      <h3 className="text-sm font-semibold text-foreground">Yesterday's Actuals</h3>
                      {yesterdayActuals?.date && (
                        <span className="text-xs text-muted-foreground">({yesterdayActuals?.date})</span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-medium">
                        <Icon name="Zap" size={9} />Auto-populated from import
                      </span>
                    </div>
                    {yesterdayLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon name="Loader" size={13} className="animate-spin" />Loading yesterday's data...
                      </div>
                    ) : yesterdayActuals ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Production</p>
                          <p className="text-base font-bold text-primary">{fmtCurrency(yesterdayActuals?.production)}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Collection</p>
                          <p className="text-base font-bold text-success">{fmtCurrency(yesterdayActuals?.collection)}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">New Patients</p>
                          <p className="text-base font-bold text-foreground">{yesterdayActuals?.new_patients ?? '—'}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">No Shows</p>
                          <p className="text-base font-bold text-warning">{yesterdayActuals?.no_shows ?? '—'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No import data found for yesterday. Upload via EOD Report → Bulk Import.</p>
                    )}
                    {yesterdayActuals?.providers?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Providers: {yesterdayActuals?.providers?.join(', ')}
                      </p>
                    )}
                  </section>
                )}

                {/* ── Office Production Summary ──────────────────────────── */}
                {(prod || prefillLoading) && (
                  <section className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Icon name="TrendingUp" size={16} color="var(--color-primary)" />
                      Office Production Summary
                      <span className="ml-auto text-[10px] text-muted-foreground font-normal">Source: /v2/huddle/prefill → office_totals.production</span>
                    </h3>
                    {prefillLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="Loader2" size={13} className="animate-spin" /> Loading…</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <PrefillField label="Monthly Production Goal" value={fmtCurrency(prod?.goal_monthly)} helper={undefined} colorClass={undefined} />
                        <PrefillField label="MTD Net Production Actual" value={fmtCurrency(prod?.actual_mtd)} helper={undefined} colorClass={undefined} />
                        <PrefillField label="Expected MTD Production" value={fmtCurrency(prod?.expected_mtd)} helper={undefined} colorClass={undefined} />
                        <PrefillField
                          label="Production Plus/Minus"
                          value={fmtPlusMinus(prod?.plus_minus)}
                          helper={undefined}
                          colorClass={plusMinusColor(prod?.plus_minus)}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-3">Net production actuals use Dentrix/FastAPI entry_date basis. Do not use gross production.</p>
                  </section>
                )}

                {/* ── A) Production Blocks ──────────────────────────────── */}
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="Activity" size={16} color="var(--color-primary)" />
                    A) Production Blocks
                  </h3>

                  {/* Doctors */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      Doctors
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {doctorSlotsDisplay?.map((block, idx) => (
                        <ProductionBlock
                          key={block?.id || `doctor-placeholder-${idx}`}
                          block={block}
                          blockLabel={`Doctor ${idx + 1}`}
                          blockType="doctor"
                          colorScheme={idx === 0 ? 'blue' : 'indigo'}
                          prefillProviders={prefill?.providers?.doctors || []}
                          onChange={(blockId, updates) => handleBlockChange(blockId, { ...updates, block_type: 'doctor', block_order: idx + 1 })}
                          isLocked={isFullyLocked && !canEdit}
                          officeId={selectedOfficeId}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Hygienists */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                      Hygienists
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {hygienistSlotsDisplay?.map((block, idx) => (
                        <ProductionBlock
                          key={block?.id || `hygienist-placeholder-${idx}`}
                          block={block}
                          blockLabel={`Hygienist ${idx + 1}`}
                          blockType="hygienist"
                          colorScheme={idx === 0 ? 'teal' : 'emerald'}
                          prefillProviders={prefill?.providers?.hygienists || []}
                          onChange={(blockId, updates) => handleBlockChange(blockId, { ...updates, block_type: 'hygienist', block_order: idx + 3 })}
                          isLocked={isFullyLocked && !canEdit}
                          officeId={selectedOfficeId}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── B) Collections Goal ───────────────────────────────── */}
                <section className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="DollarSign" size={16} color="var(--color-primary)" />
                    B) Collections Goal
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">Source: /v2/huddle/prefill → office_totals.collections</span>
                  </h3>
                  {prefillLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="Loader2" size={13} className="animate-spin" /> Loading…</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <PrefillField
                        label="Monthly Collection Goal"
                        value={fmtCurrency(coll?.goal_monthly)}
                        helper="95% of previous month's production goal"
                        colorClass={undefined}
                      />
                      <PrefillField label="MTD Collections Actual" value={fmtCurrency(coll?.actual_mtd)} helper={undefined} colorClass={undefined} />
                      <PrefillField label="Expected MTD Collections" value={fmtCurrency(coll?.expected_mtd)} helper={undefined} colorClass={undefined} />
                      <PrefillField
                        label="Collection Plus/Minus"
                        value={fmtPlusMinus(coll?.plus_minus)}
                        helper={undefined}
                        colorClass={plusMinusColor(coll?.plus_minus)}
                      />
                      <PrefillField
                        label="Collection Rate %"
                        value={fmtPct(coll?.collection_rate_pct)}
                        helper="Collections ÷ net production. Never gross production."
                        colorClass={undefined}
                      />
                    </div>
                  )}
                  {!prefill && !prefillLoading && (
                    <p className="text-xs text-muted-foreground mt-2">Prefill data unavailable. Values will appear once the endpoint responds.</p>
                  )}
                </section>

                {/* ── C) New Patients ───────────────────────────────────── */}
                <section className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="Users" size={16} color="var(--color-primary)" />
                    C) New Patients
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">Source: /v2/huddle/prefill → office_totals.new_patients</span>
                  </h3>
                  {prefillLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="Loader2" size={13} className="animate-spin" /> Loading…</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      <PrefillField label="Monthly New Patient Goal" value={fmtNumber(newPt?.goal_monthly)} helper={undefined} colorClass={undefined} />
                      <PrefillField label="MTD Actual New Patients" value={fmtNumber(newPt?.actual_mtd)} helper={undefined} colorClass={undefined} />
                      <PrefillField label="Today's New Patients" value={fmtNumber(newPt?.actual_today)} helper="May lag until next Dentrix sync." colorClass={undefined} />
                      <PrefillField label="Expected MTD New Patients" value={fmtNumber(newPt?.expected_mtd)} helper={undefined} colorClass={undefined} />
                      <PrefillField
                        label="New Patients Plus/Minus"
                        value={newPt?.plus_minus !== null && newPt?.plus_minus !== undefined
                          ? `${parseFloat(newPt?.plus_minus) >= 0 ? '+' : ''}${fmtNumber(newPt?.plus_minus)}`
                          : '—'}
                        helper={undefined}
                        colorClass={plusMinusColor(newPt?.plus_minus)}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-3">Today's new patient count may lag until the next Dentrix sync.</p>
                  {!prefill && !prefillLoading && (
                    <p className="text-xs text-muted-foreground mt-1">Prefill data unavailable. Values will appear once the endpoint responds.</p>
                  )}
                </section>

                {/* ── E) Front Desk Checklist ───────────────────────────── */}
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="ClipboardCheck" size={16} color="var(--color-primary)" />
                    E) Front Desk Checklist
                  </h3>
                  <ChecklistSection
                    title="Front Desk"
                    icon="🖥️"
                    items={frontDeskItems}
                    onToggle={(itemId, completed, placeholderMeta) => handleChecklistToggle(itemId, completed, placeholderMeta)}
                    onNotesChange={(itemId, notes, placeholderMeta) => handleChecklistNotes(itemId, notes, placeholderMeta)}
                    isLocked={isFullyLocked && !canEdit}
                    huddleId={huddle?.id}
                    officeId={selectedOfficeId}
                    officeName={offices?.find(o => o?.id === selectedOfficeId)?.name || ''}
                    userId={user?.id}
                  />
                </section>

                {/* ── F) Back Office Checklist ──────────────────────────── */}
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="Stethoscope" size={16} color="var(--color-primary)" />
                    F) Back Office Checklist
                  </h3>
                  <ChecklistSection
                    title="Back Office"
                    icon="🦷"
                    items={backOfficeItems}
                    onToggle={(itemId, completed, placeholderMeta) => handleChecklistToggle(itemId, completed, placeholderMeta)}
                    onNotesChange={(itemId, notes, placeholderMeta) => handleChecklistNotes(itemId, notes, placeholderMeta)}
                    isLocked={isFullyLocked && !canEdit}
                    huddleId={huddle?.id}
                    officeId={selectedOfficeId}
                    officeName={offices?.find(o => o?.id === selectedOfficeId)?.name || ''}
                    userId={user?.id}
                  />
                </section>

                {/* ── G) Previous Open Day ──────────────────────────────── */}
                <section className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="History" size={16} color="var(--color-primary)" />
                    G) Previous Open Day
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Did anything go wrong?</label>
                      <textarea
                        value={huddle?.prev_day_wrong || ''}
                        onChange={(e) => handleHuddleFieldChange('prev_day_wrong', e?.target?.value)}
                        disabled={isFullyLocked && !canEdit}
                        placeholder="Describe any issues from the previous day..."
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">What went right?</label>
                      <textarea
                        value={huddle?.prev_day_right || ''}
                        onChange={(e) => handleHuddleFieldChange('prev_day_right', e?.target?.value)}
                        disabled={isFullyLocked && !canEdit}
                        placeholder="Celebrate wins from the previous day..."
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </section>

                {/* Notes Addendum (always editable after submission) */}
                {huddle?.status !== 'draft' && (
                  <section className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Icon name="FileEdit" size={16} color="var(--color-warning)" />
                      Notes Addendum
                      <span className="text-xs text-muted-foreground font-normal">(Always editable)</span>
                    </h3>
                    <textarea
                      value={huddle?.notes_addendum || ''}
                      onChange={(e) => handleAddendumChange(e?.target?.value)}
                      placeholder="Add notes or corrections after submission..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </section>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 print:hidden">
                  <div className="text-xs text-muted-foreground">
                    {huddle?.status === 'draft' && 'Auto-saving as you type'}
                    {huddle?.status === 'submitted' && `Submitted ${huddle?.submitted_at ? new Date(huddle?.submitted_at)?.toLocaleString() : ''}`}
                    {huddle?.status === 'unlocked' && 'Unlocked for editing (audit mode)'}
                  </div>
                  <div className="flex items-center gap-3">
                    {canUnlock && (
                      <button
                        onClick={() => setShowUnlockModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-warning text-warning rounded-lg hover:bg-warning/10 transition-smooth"
                      >
                        <Icon name="Unlock" size={15} />
                        Unlock
                      </button>
                    )}
                    {(huddle?.status === 'draft' || huddle?.status === 'unlocked') && (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !canHuddleEdit}
                        title={!canHuddleEdit ? 'You do not have permission to submit the huddle' : undefined}
                        className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-smooth ${
                          !canHuddleEdit
                            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
                        }`}
                      >
                        {submitting ? (
                          <><Icon name="Loader2" size={15} className="animate-spin" /> Submitting...</>
                        ) : (
                          <><Icon name="Send" size={15} /> Submit Huddle</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <HuddleHistory
            officeId={selectedOfficeId}
            offices={offices}
            onViewHuddle={loadHuddleById}
          />
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="text-center py-12">
            <Icon name="BarChart2" size={40} className="mx-auto mb-3 text-primary opacity-70" />
            <h3 className="font-semibold text-foreground mb-2">Huddle Analytics</h3>
            <p className="text-sm text-muted-foreground mb-4">View detailed analytics and performance trends</p>
            <button
              onClick={() => navigate('/huddle-analytics')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-smooth"
            >
              <Icon name="ExternalLink" size={15} />
              Open Analytics Dashboard
            </button>
          </div>
        )}
      </div>
      {/* Unlock Modal */}
      {showUnlockModal && (
        <UnlockModal
          onConfirm={handleUnlock}
          onCancel={() => setShowUnlockModal(false)}
          loading={unlockLoading}
        />
      )}
    </div>
  );
};

export default DailyMorningHuddle;
