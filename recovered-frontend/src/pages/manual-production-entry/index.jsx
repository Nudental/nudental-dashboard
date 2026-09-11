/**
 * Manual Production Entry Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows authorized users (super_admin, admin, regional_manager) to manually
 * enter UCR fee and production adjustment data for periods where Dentrix Ascend
 * API does not provide these values directly.
 *
 * V708: Exception-only guardrails + audit logging added.
 *   - Manual Entry is NOT encouraged. It is a last-resort exception only.
 *   - All write actions require ConfirmDialog before executing.
 *   - Non-blocking audit logging to audit_logs for all confirmed write actions.
 *   - Dentrix/FastAPI remains the preferred source of truth.
 *
 * BUSINESS RULES ENFORCED:
 *   - UCR Fee = full usual/customary billed fee before any reductions
 *   - Production Adjustments = reductions (stored as negative values)
 *   - Net Production = UCR Fee + Production Adjustments (auto-calculated)
 *   - Manual entries are clearly labeled and never overwrite API data
 *   - Full audit trail with edit history
 *   - Office-specific, date-specific, provider-aware
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  fetchManualProductionEntries,
  saveManualProductionEntry,
  deleteManualProductionEntry,
  applyManualEntryToAnalytics,
} from '../../services/manualProductionService';
import { supabase } from '../../lib/supabase';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const ALLOWED_ROLES = ['super_admin', 'admin', 'regional_manager'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(parseFloat(v) || 0);

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

// ─── Non-blocking audit log writer ───────────────────────────────────────────
const writeAuditLog = async (actionType, metadata) => {
  try {
    await supabase?.from('audit_logs')?.insert({
      action_type: actionType,
      metadata: {
        source: 'Manual Production Entry',
        action_type: actionType,
        ...metadata,
      },
      created_at: new Date()?.toISOString(),
    });
  } catch {
    // Non-blocking: audit failure must not block user action
  }
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, confirmVariant = 'primary' }) => {
  const variantClass =
    confirmVariant === 'danger' ?'bg-red-600 hover:bg-red-700 text-white' :'bg-primary hover:bg-primary/90 text-primary-foreground';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Icon name="AlertTriangle" size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variantClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Entry Form Modal ─────────────────────────────────────────────────────────

const EntryFormModal = ({ entry, offices, onSave, onClose, userId }) => {
  const now = new Date();
  const [officeId, setOfficeId] = useState(entry?.office_id || offices?.[0]?.id || '');
  const [reportMonth, setReportMonth] = useState(entry?.report_month || now?.getMonth() + 1);
  const [reportYear, setReportYear] = useState(entry?.report_year || now?.getFullYear());
  const [ucrFee, setUcrFee] = useState(entry?.ucr_fee_amount != null ? String(entry?.ucr_fee_amount) : '');
  const [adjAmount, setAdjAmount] = useState(
    entry?.production_adjustment_amount != null ? String(Math.abs(entry?.production_adjustment_amount)) : ''
  );
  const [writeOffs, setWriteOffs] = useState(
    entry?.write_offs != null ? String(Math.abs(entry?.write_offs)) : ''
  );
  const [chargeAdj, setChargeAdj] = useState(entry?.charge_adjustments != null ? String(entry?.charge_adjustments) : '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const ucrVal = safeNum(ucrFee);
  const adjVal = safeNum(adjAmount);
  const netProduction = ucrVal - adjVal;

  const isEdit = !!entry;
  const officeMap = {};
  offices?.forEach((o) => { officeMap[o?.id] = o?.name; });
  const officeName = officeMap?.[officeId] || officeId || 'selected office';
  const periodLabel = `${MONTH_NAMES?.[parseInt(reportMonth) - 1]} ${reportYear}`;

  const handleSaveClick = () => {
    if (!officeId) { setError('Please select an office'); return; }
    if (ucrVal <= 0 && adjVal <= 0) { setError('Enter at least UCR Fee or Adjustment Amount'); return; }
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        officeId,
        reportMonth: parseInt(reportMonth),
        reportYear: parseInt(reportYear),
        ucrFeeAmount: ucrVal,
        productionAdjustmentAmount: -adjVal,
        writeOffs: safeNum(writeOffs),
        chargeAdjustments: safeNum(chargeAdj),
        notes,
        userId,
        isEdit,
        officeId,
        officeName,
        periodLabel,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const years = [now?.getFullYear(), now?.getFullYear() - 1, now?.getFullYear() - 2, now?.getFullYear() - 3];

  const confirmMessage = isEdit
    ? `Manual entry is not encouraged. Update this exception-only manual production entry for ${periodLabel} at ${officeName}? Prior values will be preserved in the edit history. Continue only if verified Dentrix/FastAPI values are unavailable.`
    : `Manual entry is not encouraged. Save this exception-only manual production entry for ${periodLabel} at ${officeName} only if verified Dentrix/FastAPI values are unavailable?`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {entry ? 'Edit Manual Entry' : 'New Manual Production Entry'}
              </h2>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                Exception use only — use only when Dentrix/FastAPI data is unavailable
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Office + Period */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="block text-xs font-medium text-foreground mb-1">Office *</label>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e?.target?.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select office…</option>
                  {offices?.map((o) => (
                    <option key={o?.id} value={o?.id}>{o?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Month *</label>
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(parseInt(e?.target?.value))}
                  className="w-full min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {MONTH_NAMES?.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Year *</label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(parseInt(e?.target?.value))}
                  className="w-full min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {years?.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Formula explanation */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
              <p className="font-semibold mb-1">Formula: Net Production = UCR Fee − Production Adjustments</p>
              <p>UCR Fee = full billed fee before any reductions (Dentrix "Gross Production")</p>
              <p>Production Adjustments = PPO write-offs, contractual reductions, discounts</p>
            </div>

            {/* UCR Fee */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                UCR Fee / Gross Billed Amount ($)
                <span className="ml-1 text-muted-foreground font-normal">— full fee before reductions</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ucrFee}
                onChange={(e) => setUcrFee(e?.target?.value)}
                placeholder="e.g. 290816"
                className="w-full min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Production Adjustments */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Total Production Adjustments ($)
                <span className="ml-1 text-muted-foreground font-normal">— enter as positive, stored as negative</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e?.target?.value)}
                placeholder="e.g. 193472"
                className="w-full min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Net Production (calculated) */}
            <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Net Production (calculated)</span>
                <span className={`text-sm font-bold ${netProduction >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(netProduction)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmt(ucrVal)} UCR − {fmt(adjVal)} Adjustments = {fmt(netProduction)}
              </p>
            </div>

            {/* Write-offs breakdown (optional) */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Adjustment Breakdown (Optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">PPO / Write-offs ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={writeOffs}
                    onChange={(e) => setWriteOffs(e?.target?.value)}
                    placeholder="0"
                    className="w-full min-h-[36px] px-2 py-1.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Charge Adjustments ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={chargeAdj}
                    onChange={(e) => setChargeAdj(e?.target?.value)}
                    placeholder="0"
                    className="w-full min-h-[36px] px-2 py-1.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e?.target?.value)}
                placeholder="Reason for manual entry, data source, etc."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <Icon name="AlertCircle" size={14} />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving && <Icon name="Loader2" size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title={isEdit ? 'Update Exception-Only Manual Entry?' : 'Save Exception-Only Manual Entry?'}
          message={confirmMessage}
          confirmLabel="Save Entry"
          cancelLabel="Cancel"
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ManualProductionEntry = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const [offices, setOffices] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterOfficeId, setFilterOfficeId] = useState('');
  const [filterYear, setFilterYear] = useState(new Date()?.getFullYear());
  const [applyingId, setApplyingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmLabel, onConfirm, variant }

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Manual Production Entry — Exception Use Only' },
  ];

  // Role guard
  useEffect(() => {
    if (!authLoading && userProfile && !ALLOWED_ROLES?.includes(userProfile?.role)) {
      navigate('/executive-overview', { replace: true });
    }
  }, [authLoading, userProfile, navigate]);

  // Permission-based guard
  if (!permLoading && !authLoading && userProfile && ALLOWED_ROLES?.includes(userProfile?.role) && !hasPermission('admin.manual_entry.view') && userProfile?.role !== 'super_admin') {
    return <AccessDenied message="Manual Production Entry requires the admin.manual_entry.view permission." />;
  }

  // Load offices
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase?.from('offices')?.select('id, name')?.order('name');
      setOffices(data || []);
    };
    load();
  }, []);

  // Load entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchManualProductionEntries({
        officeIds: filterOfficeId ? [filterOfficeId] : [],
        startYear: filterYear,
        startMonth: 1,
        endYear: filterYear,
        endMonth: 12,
      });
      setEntries(data || []);
    } catch (err) {
      console.error('Failed to load manual entries:', err);
    } finally {
      setLoading(false);
    }
  }, [filterOfficeId, filterYear]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o?.id] = o?.name; });

  // ── Save handler (called from EntryFormModal after its own confirm) ──────────
  const handleSave = async (payload) => {
    const isEdit = payload?.isEdit;
    await saveManualProductionEntry({ ...payload, userId: userProfile?.id });
    // Non-blocking audit log
    await writeAuditLog(
      isEdit ? 'MANUAL_ENTRY_UPDATED' : 'MANUAL_ENTRY_CREATED',
      {
        office_id: payload?.officeId,
        office_name: payload?.officeName || officeMap?.[payload?.officeId] || null,
        report_month: payload?.reportMonth,
        report_year: payload?.reportYear,
        entry_id: null, // entry_id not available at save time without return value
      }
    );
    await loadEntries();
    showToast(isEdit ? 'Entry updated successfully' : 'Entry saved successfully');
  };

  // ── Apply to Analytics ────────────────────────────────────────────────────────
  const handleApply = (entry) => {
    const officeName = officeMap?.[entry?.office_id] || entry?.office_id || 'selected office';
    const periodLabel = `${MONTH_NAMES?.[entry?.report_month - 1]} ${entry?.report_year}`;
    setConfirmState({
      title: 'Apply to Analytics — Exception-Only Action',
      message: `Manual entry is not encouraged. This exception-only action will push manual UCR fee and production adjustment values for ${periodLabel} at ${officeName} into analytics. This may affect Executive Overview and financial dashboards. Continue only if verified Dentrix/FastAPI values are unavailable.`,
      confirmLabel: 'Apply to Analytics',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmState(null);
        setApplyingId(entry?.id);
        try {
          const result = await applyManualEntryToAnalytics({ entryId: entry?.id, userId: userProfile?.id });
          if (result?.applied) {
            // Non-blocking audit log
            await writeAuditLog('MANUAL_ENTRY_APPLIED_TO_ANALYTICS', {
              entry_id: entry?.id,
              office_id: entry?.office_id,
              office_name: officeName,
              report_month: entry?.report_month,
              report_year: entry?.report_year,
            });
            showToast('Entry applied to analytics');
          } else {
            showToast(result?.reason || 'Not applied', 'warn');
          }
          await loadEntries();
        } catch (err) {
          showToast(err?.message || 'Failed to apply entry', 'error');
        } finally {
          setApplyingId(null);
        }
      },
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = (entry) => {
    const officeName = officeMap?.[entry?.office_id] || entry?.office_id || 'selected office';
    const periodLabel = `${MONTH_NAMES?.[entry?.report_month - 1]} ${entry?.report_year}`;
    setConfirmState({
      title: 'Delete Manual Entry?',
      message: `Permanently delete the manual entry for ${periodLabel} at ${officeName}? This cannot be undone.`,
      confirmLabel: 'Delete Entry',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(null);
        setDeletingId(entry?.id);
        try {
          await deleteManualProductionEntry({ entryId: entry?.id, userId: userProfile?.id });
          // Non-blocking audit log
          await writeAuditLog('MANUAL_ENTRY_DELETED', {
            entry_id: entry?.id,
            office_id: entry?.office_id,
            office_name: officeName,
            report_month: entry?.report_month,
            report_year: entry?.report_year,
          });
          await loadEntries();
          showToast('Entry deleted');
        } catch (err) {
          showToast(err?.message || 'Failed to delete', 'error');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const years = [new Date()?.getFullYear(), new Date()?.getFullYear() - 1, new Date()?.getFullYear() - 2];

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                Manual Production Entry
                <span className="ml-2 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md align-middle">
                  Exception Use Only
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Last-resort fallback only when verified Dentrix/FastAPI values are unavailable
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => { setEditEntry(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Icon name="Plus" size={15} />
                New Entry
              </button>
              <p className="text-xs text-amber-600 font-medium">
                Use only for verified API data gaps. Do not use when Dentrix/FastAPI data is available.
              </p>
            </div>
          </div>

          {/* Strong Source-of-Truth Warning Banner */}
          <div className="mb-5 flex items-start gap-3 px-4 py-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-sm text-amber-900">
            <Icon name="AlertTriangle" size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold text-amber-800 mb-1">⚠ Manual production entry is not encouraged</p>
              <p className="text-xs leading-relaxed">
                Manual production entry should only be used as a <strong>last-resort exception</strong> when verified Dentrix/FastAPI values are unavailable.{' '}
                <strong>Dentrix/FastAPI remains the preferred source of truth.</strong>{' '}
                Applied manual entries may affect Executive Overview and financial dashboards and must be reviewed carefully.
                Do not use manual entry when Dentrix/FastAPI data is available.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={filterOfficeId}
              onChange={(e) => setFilterOfficeId(e?.target?.value)}
              className="min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Offices</option>
              {offices?.map((o) => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e?.target?.value))}
              className="min-h-[40px] px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {years?.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-sm text-muted-foreground">{entries?.length} entries</span>
          </div>

          {/* Entries Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Icon name="Loader2" size={20} className="animate-spin mx-auto mb-2" />
                Loading entries…
              </div>
            ) : entries?.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="FileX" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No manual entries found</p>
                <p className="text-xs text-muted-foreground mt-1">Create an entry when API data is unavailable</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {['Office', 'Period', 'UCR Fee', 'Adjustments', 'Net Production', 'Write-offs', 'Status', 'Actions']?.map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries?.map((e) => (
                      <tr key={e?.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                          {officeMap?.[e?.office_id] || e?.office_id}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {MONTH_NAMES?.[e?.report_month - 1]} {e?.report_year}
                        </td>
                        <td className="px-3 py-3 font-medium text-indigo-600 whitespace-nowrap">
                          {fmt(e?.ucr_fee_amount)}
                        </td>
                        <td className="px-3 py-3 text-red-600 whitespace-nowrap">
                          {e?.production_adjustment_amount != null ? fmt(Math.abs(e?.production_adjustment_amount)) : '—'}
                        </td>
                        <td className="px-3 py-3 font-semibold text-emerald-600 whitespace-nowrap">
                          {fmt(e?.net_production)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {e?.write_offs ? fmt(Math.abs(e?.write_offs)) : '—'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {e?.is_applied_to_analytics ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded cursor-help"
                              title="Applied entries are live in Executive Overview and financial dashboards."
                            >
                              <Icon name="CheckCircle" size={11} /> Applied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                              <Icon name="Clock" size={11} /> Pending
                            </span>
                          )}
                          <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Manual</span>
                          {e?.is_applied_to_analytics && (
                            <p className="text-xs text-green-700 mt-0.5">Live in dashboards</p>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {!e?.is_applied_to_analytics && (
                              <button
                                onClick={() => handleApply(e)}
                                disabled={applyingId === e?.id}
                                title="Apply to analytics (exception-only)"
                                className="p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50"
                              >
                                {applyingId === e?.id
                                  ? <Icon name="Loader2" size={14} className="animate-spin" />
                                  : <Icon name="Upload" size={14} />}
                              </button>
                            )}
                            <button
                              onClick={() => { setEditEntry(e); setShowForm(true); }}
                              title="Edit entry"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                            >
                              <Icon name="Pencil" size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(e)}
                              disabled={deletingId === e?.id}
                              title="Delete entry"
                              className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                            >
                              {deletingId === e?.id
                                ? <Icon name="Loader2" size={14} className="animate-spin" />
                                : <Icon name="Trash2" size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Formula Reference */}
          <div className="mt-6 bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="BookOpen" size={15} className="text-primary" />
              Production Metric Definitions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'UCR Fee / Gross Production', color: 'bg-indigo-50 border-indigo-200 text-indigo-800', desc: 'Full usual/customary billed fee before any reductions. Source: Dentrix Ascend grossProduction.' },
                { label: 'Production Adjustments', color: 'bg-red-50 border-red-200 text-red-800', desc: 'All reductions: PPO write-offs, contractual adjustments, discounts. Stored as negative values.' },
                { label: 'Net Production', color: 'bg-emerald-50 border-emerald-200 text-emerald-800', desc: 'UCR Fee minus adjustments. What the practice actually earned. Formula: UCR − Adjustments.' },
                { label: 'Collections', color: 'bg-blue-50 border-blue-200 text-blue-800', desc: 'Actual money collected. Always separate from production. Collection Rate = Collections ÷ UCR Fee.' },
              ]?.map((item) => (
                <div key={item?.label} className={`border rounded-lg p-3 ${item?.color}`}>
                  <p className="font-semibold mb-1">{item?.label}</p>
                  <p className="opacity-80">{item?.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Form Modal */}
      {showForm && (
        <EntryFormModal
          entry={editEntry}
          offices={offices}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEntry(null); }}
          userId={userProfile?.id}
        />
      )}

      {/* Global Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState?.title}
          message={confirmState?.message}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel="Cancel"
          confirmVariant={confirmState?.variant || 'primary'}
          onConfirm={confirmState?.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast?.type === 'error' ? 'bg-destructive text-destructive-foreground' :
          toast?.type === 'warn'? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <Icon name={toast?.type === 'error' ? 'AlertCircle' : toast?.type === 'warn' ? 'AlertTriangle' : 'CheckCircle'} size={15} />
          {toast?.msg}
        </div>
      )}
    </div>
  );
};

export default ManualProductionEntry;
