/**
 * MappingReviewTool.jsx — v2
 *
 * Super Admin-only mapping review tool.
 * Upgrades: bulk actions, failure reasons, office/type filters,
 * ignore action, diagnostics panel, confidence scoring, placeholder isolation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import {
  getPendingMappings,
  getAllProviderMasters,
  resolveMapping,
  addProviderAlias,
  getMappingStats,
  ignoreMapping,
  bulkIgnoreMappings,
  bulkResolveMappings,
  markAsNonProvider,
  FAILURE_REASON_LABELS,
} from '../../../services/providerMappingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  mapped:        { label: 'Mapped',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  needs_review:  { label: 'Needs Mapping',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  unknown_type:  { label: 'Unknown Type',   color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  unknown_office:{ label: 'Unknown Office', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  pending:       { label: 'Pending',        color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  placeholder:   { label: 'Placeholder',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  ignored:       { label: 'Ignored',        color: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.color}`}>
      {cfg?.label}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = value || 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
    </div>
  );
}

// ─── Resolve Modal ────────────────────────────────────────────────────────────
function ResolveModal({ mapping, providerMasters, onClose, onSaved }) {
  const [selectedMasterId, setSelectedMasterId] = useState(mapping?.provider_master_id || '');
  const [selectedType, setSelectedType] = useState(mapping?.normalized_type || '');
  const [reviewNotes, setReviewNotes] = useState(mapping?.review_notes || '');
  const [aliasName, setAliasName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resolve');

  useEffect(() => {
    if (tab === 'alias' && !aliasName && mapping?.raw_payroll_name) {
      setAliasName(mapping?.raw_payroll_name);
    }
  }, [tab]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const effectiveType = selectedType ||
        (selectedMasterId ? providerMasters?.find(p => p?.id === selectedMasterId)?.provider_type || null : null);

      await resolveMapping(mapping?.id, {
        providerMasterId: selectedMasterId || null,
        normalizedType: effectiveType || null,
        reviewNotes,
      });

      if (aliasName?.trim() && selectedMasterId) {
        await addProviderAlias(selectedMasterId, aliasName?.trim(), 'manual');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save mapping. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && (!!selectedMasterId || !!selectedType);
  const selectedMaster = providerMasters?.find(pm => pm?.id === selectedMasterId);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Icon name="Link" size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Resolve Provider Mapping</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Map raw payroll name to canonical provider</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="X" size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Raw Values */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold">Raw Payroll Name</span>
              <p className="mt-0.5 font-mono text-gray-900 dark:text-white font-medium">{mapping?.raw_payroll_name || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold">Raw Office</span>
              <p className="mt-0.5 font-mono text-gray-900 dark:text-white font-medium">{mapping?.raw_payroll_office || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold">Status</span>
              <div className="mt-0.5"><StatusBadge status={mapping?.mapping_status} /></div>
            </div>
            <div>
              <span className="text-gray-400 uppercase tracking-wider font-semibold">Confidence</span>
              <div className="mt-1"><ConfidenceBar value={mapping?.confidence} /></div>
            </div>
          </div>
          {/* Failure Reason */}
          {mapping?.failure_reason && (
            <div className="mt-3 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Icon name="AlertTriangle" size={13} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Failure Reason: </span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {FAILURE_REASON_LABELS?.[mapping?.failure_reason] || mapping?.failure_reason}
                </span>
              </div>
            </div>
          )}
          {/* Source system / pay period */}
          {(mapping?.source_system || mapping?.pay_period) && (
            <div className="mt-2 flex gap-3 text-xs text-gray-400">
              {mapping?.source_system && <span>Source: <strong>{mapping?.source_system}</strong></span>}
              {mapping?.pay_period && <span>Period: <strong>{mapping?.pay_period}</strong></span>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {[
            { key: 'resolve', label: 'Map to Provider' },
            { key: 'alias', label: 'Add Alias' },
          ]?.map(t => (
            <button
              key={t?.key}
              onClick={() => setTab(t?.key)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                tab === t?.key
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t?.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-400">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}

          {tab === 'resolve' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Map to Canonical Provider
                </label>
                <select
                  value={selectedMasterId}
                  onChange={e => {
                    const val = e?.target?.value;
                    setSelectedMasterId(val);
                    if (val) {
                      const pm = providerMasters?.find(p => p?.id === val);
                      if (pm?.provider_type && pm?.provider_type !== 'unknown') {
                        setSelectedType(pm?.provider_type);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— Select provider —</option>
                  {(providerMasters || [])?.map(pm => (
                    <option key={pm?.id} value={pm?.id}>
                      {pm?.display_name} ({pm?.provider_type || 'unknown'})
                    </option>
                  ))}
                </select>
                {selectedMaster && (
                  <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-xs text-violet-700 dark:text-violet-400">
                    <strong>Offices:</strong>{' '}
                    {(selectedMaster?.provider_office_assignments || [])?.filter(a => a?.is_active)?.map(a => a?.offices?.name || a?.office_name_raw)?.filter(Boolean)?.join(', ') || 'No office assigned'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Payroll Type {selectedMasterId ? '(auto-set, override if needed)' : '(required if no provider selected)'}
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'doctor',         label: 'Doctor',       icon: 'Stethoscope', color: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
                    { value: 'hygienist',      label: 'Hygienist',    icon: 'Heart',       color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
                    { value: 'temp_hygienist', label: 'Temp Hygiene', icon: 'UserCheck',   color: 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' },
                    { value: 'unknown',        label: 'Unknown',      icon: 'HelpCircle',  color: 'border-gray-400 bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
                  ]?.map(opt => (
                    <button
                      key={opt?.value}
                      type="button"
                      onClick={() => setSelectedType(prev => prev === opt?.value ? '' : opt?.value)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        selectedType === opt?.value ? opt?.color : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon name={opt?.icon} size={12} />
                      {opt?.label}
                    </button>
                  ))}
                </div>
                {!selectedMasterId && !selectedType && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    Select a provider above, or choose a type to save.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Review Notes (optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e?.target?.value)}
                  rows={2}
                  placeholder="e.g. Confirmed match with Dentrix import name variant"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </>
          )}

          {tab === 'alias' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Add Alias Name
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Add the raw payroll name as an alias so future imports auto-match.
                {!selectedMasterId && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                    Go to "Map to Provider" tab and select a provider first.
                  </span>
                )}
              </p>
              <input
                type="text"
                value={aliasName}
                onChange={e => setAliasName(e?.target?.value)}
                placeholder={`e.g. ${mapping?.raw_payroll_name || 'Fitzpatrick, John'}`}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {!selectedMasterId && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Select a provider on the "Map to Provider" tab before saving an alias.
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                This alias will be stored and used for automatic matching in future payroll runs.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Check" size={14} />}
            {saving ? 'Saving…' : 'Save Mapping'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Resolve Modal ───────────────────────────────────────────────────────
function BulkResolveModal({ selectedIds, providerMasters, onClose, onSaved }) {
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedMasterId && !selectedType) return;
    setSaving(true);
    setError('');
    try {
      const effectiveType = selectedType ||
        (selectedMasterId ? providerMasters?.find(p => p?.id === selectedMasterId)?.provider_type || null : null);
      const result = await bulkResolveMappings(selectedIds, {
        providerMasterId: selectedMasterId || null,
        normalizedType: effectiveType || null,
        reviewNotes,
      });
      if (result?.failed?.length > 0) {
        setError(`${result?.failed?.length} record(s) failed to save.`);
      } else {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err?.message || 'Bulk resolve failed.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && (!!selectedMasterId || !!selectedType);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Icon name="Layers" size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Bulk Map {selectedIds?.length} Records</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Map all selected rows to the same provider</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icon name="X" size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-xs text-red-700 dark:text-red-400">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Map All To Provider</label>
            <select
              value={selectedMasterId}
              onChange={e => {
                const val = e?.target?.value;
                setSelectedMasterId(val);
                if (val) {
                  const pm = providerMasters?.find(p => p?.id === val);
                  if (pm?.provider_type && pm?.provider_type !== 'unknown') setSelectedType(pm?.provider_type);
                }
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— Select provider —</option>
              {(providerMasters || [])?.map(pm => (
                <option key={pm?.id} value={pm?.id}>{pm?.display_name} ({pm?.provider_type || 'unknown'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Override Type</label>
            <div className="flex gap-2">
              {[
                { value: 'doctor', label: 'Doctor', color: 'border-blue-500 bg-blue-50 text-blue-700' },
                { value: 'hygienist', label: 'Hygienist', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                { value: 'temp_hygienist', label: 'Temp', color: 'border-teal-500 bg-teal-50 text-teal-700' },
              ]?.map(opt => (
                <button
                  key={opt?.value}
                  type="button"
                  onClick={() => setSelectedType(prev => prev === opt?.value ? '' : opt?.value)}
                  className={`flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    selectedType === opt?.value ? opt?.color : 'border-gray-200 dark:border-gray-600 text-gray-500'
                  }`}
                >
                  {opt?.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <input
              type="text"
              value={reviewNotes}
              onChange={e => setReviewNotes(e?.target?.value)}
              placeholder="Bulk mapping note…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Check" size={14} />}
            {saving ? 'Saving…' : `Map ${selectedIds?.length} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mark as Non-Provider Button ─────────────────────────────────────────────
function MarkAsNonProviderButton({ rawName, onDone }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    if (!rawName || saving || done) return;
    setSaving(true);
    try {
      await markAsNonProvider(rawName, 'Permanently marked as non-provider by Super Admin via Mapping Review Tool');
      setDone(true);
      if (onDone) onDone();
    } catch (err) {
      console.error('[MarkAsNonProviderButton] error:', err?.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Icon name="CheckCircle2" size={11} />
        Saved
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      title="Permanently mark as non-provider — will never trigger mapping review again"
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
    >
      {saving ? <Icon name="Loader2" size={11} className="animate-spin" /> : <Icon name="ShieldOff" size={11} />}
      {saving ? 'Saving…' : 'Mark Non-Provider'}
    </button>
  );
}

// ─── Diagnostics Panel ────────────────────────────────────────────────────────
function DiagnosticsPanel({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Total Mappings',       value: stats?.total,          color: 'text-gray-700 dark:text-gray-300',         icon: 'Database' },
    { label: 'Mapped',               value: stats?.mapped,         color: 'text-emerald-600 dark:text-emerald-400',   icon: 'CheckCircle2' },
    { label: 'Needs Review',         value: stats?.needs_review,   color: 'text-amber-600 dark:text-amber-400',       icon: 'AlertTriangle' },
    { label: 'Unknown Type',         value: stats?.unknown_type,   color: 'text-rose-600 dark:text-rose-400',         icon: 'HelpCircle' },
    { label: 'Unknown Office',       value: stats?.unknown_office, color: 'text-orange-600 dark:text-orange-400',     icon: 'MapPin' },
    { label: 'Placeholder',          value: stats?.placeholder,    color: 'text-purple-600 dark:text-purple-400',     icon: 'Ghost' },
    { label: 'Ignored',              value: stats?.ignored,        color: 'text-gray-400 dark:text-gray-500',         icon: 'EyeOff' },
  ];
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
      {items?.map(item => (
        <div key={item?.label} className="flex flex-col items-center gap-0.5 text-center">
          <Icon name={item?.icon} size={13} className={item?.color} />
          <span className={`text-base font-bold ${item?.color}`}>{item?.value ?? 0}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{item?.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Mapping Review Tool ─────────────────────────────────────────────────
export default function MappingReviewTool({ onClose }) {
  const [pendingMappings, setPendingMappings] = useState([]);
  const [providerMasters, setProviderMasters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [showBulkResolve, setShowBulkResolve] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappings, masters, mappingStats] = await Promise.allSettled([
        getPendingMappings(),
        getAllProviderMasters(),
        getMappingStats(),
      ]);
      setPendingMappings(mappings?.status === 'fulfilled' ? mappings?.value : []);
      setProviderMasters(masters?.status === 'fulfilled' ? masters?.value : []);
      setStats(mappingStats?.status === 'fulfilled' ? mappingStats?.value : null);
    } catch (err) {
      console.error('[MappingReviewTool] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Unique offices from mappings for filter
  const uniqueOffices = useMemo(() => {
    const offices = new Set();
    pendingMappings?.forEach(m => { if (m?.raw_payroll_office) offices?.add(m?.raw_payroll_office); });
    return Array.from(offices)?.sort();
  }, [pendingMappings]);

  const filteredMappings = useMemo(() => pendingMappings?.filter(m => {
    if (statusFilter !== 'all' && m?.mapping_status !== statusFilter) return false;
    if (officeFilter && m?.raw_payroll_office !== officeFilter) return false;
    if (typeFilter !== 'all' && m?.normalized_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery?.toLowerCase();
      return (
        m?.raw_payroll_name?.toLowerCase()?.includes(q) ||
        m?.raw_payroll_office?.toLowerCase()?.includes(q) ||
        m?.normalized_name?.toLowerCase()?.includes(q) ||
        m?.provider_master?.display_name?.toLowerCase()?.includes(q)
      );
    }
    return true;
  }), [pendingMappings, statusFilter, officeFilter, typeFilter, searchQuery]);

  const allFilteredSelected = filteredMappings?.length > 0 && filteredMappings?.every(m => selectedIds?.has(m?.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMappings.map(m => m.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next?.has(id)) next?.delete(id); else next?.add(id);
      return next;
    });
  };

  const handleBulkIgnore = async () => {
    if (!selectedIds?.size) return;
    setBulkActionLoading(true);
    try {
      await bulkIgnoreMappings(Array.from(selectedIds), 'Bulk ignored by admin');
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error('[MappingReviewTool] bulk ignore error:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleIgnoreSingle = async (mappingId) => {
    try {
      await ignoreMapping(mappingId, 'Ignored by admin');
      await loadData();
    } catch (err) {
      console.error('[MappingReviewTool] ignore error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Icon name="GitMerge" size={18} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Provider Mapping Review</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Super Admin · Resolve unmatched payroll provider records · All changes are audited
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="X" size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Mark as Non-Provider Button */}
        <MarkAsNonProviderButton rawName={selectedMapping?.raw_payroll_name} onDone={loadData} />

        {/* Diagnostics Panel */}
        <DiagnosticsPanel stats={stats} />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e?.target?.value)}
                placeholder="Search by name, office, or mapped provider…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e?.target?.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Statuses</option>
            <option value="needs_review">Needs Review</option>
            <option value="unknown_type">Unknown Type</option>
            <option value="unknown_office">Unknown Office</option>
            <option value="placeholder">Placeholder</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={officeFilter}
            onChange={e => setOfficeFilter(e?.target?.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Offices</option>
            {uniqueOffices?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e?.target?.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Types</option>
            <option value="doctor">Doctor</option>
            <option value="hygienist">Hygienist</option>
            <option value="temp_hygienist">Temp Hygienist</option>
            <option value="unknown">Unknown</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
          >
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds?.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-700 flex-shrink-0">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
              {selectedIds?.size} selected
            </span>
            <button
              onClick={() => setShowBulkResolve(true)}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Icon name="Link" size={12} />
              Bulk Map
            </button>
            <button
              onClick={handleBulkIgnore}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {bulkActionLoading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="EyeOff" size={12} />}
              Bulk Ignore
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-auto"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="Loader2" size={24} className="animate-spin text-violet-500" />
            </div>
          ) : filteredMappings?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Icon name="CheckCircle2" size={40} className="text-emerald-400 mb-3" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">All mappings resolved</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No pending provider mappings require review.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Raw Payroll Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Raw Office</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Failure Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Mapped To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredMappings?.map(mapping => (
                  <tr
                    key={mapping?.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      selectedIds?.has(mapping?.id) ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(mapping?.id)}
                        onChange={() => toggleSelect(mapping?.id)}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white text-xs">{mapping?.raw_payroll_name}</div>
                      <div className="text-gray-400 dark:text-gray-300 text-xs font-mono">{mapping?.normalized_name}</div>
                      {mapping?.is_placeholder && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
                          <Icon name="Ghost" size={10} /> Placeholder
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {mapping?.raw_payroll_office || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={mapping?.mapping_status} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBar value={mapping?.confidence} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px]">
                      {mapping?.failure_reason
                        ? <span title={FAILURE_REASON_LABELS?.[mapping?.failure_reason] || mapping?.failure_reason} className="cursor-help underline decoration-dotted">
                            {FAILURE_REASON_LABELS?.[mapping?.failure_reason] || mapping?.failure_reason}
                          </span>
                        : <span className="text-gray-300 dark:text-gray-600 italic">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {mapping?.provider_master?.display_name
                        ? <>
                            <div className="font-medium">{mapping?.provider_master?.display_name}</div>
                            <div className="text-gray-400">{mapping?.provider_master?.provider_type}</div>
                          </>
                        : <span className="text-gray-400 italic">Not mapped</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* For placeholder rows: show Mark as Non-Provider as primary action */}
                        {mapping?.is_placeholder || mapping?.mapping_status === 'placeholder' ? (
                          <MarkAsNonProviderButton
                            rawName={mapping?.raw_payroll_name}
                            onDone={loadData}
                          />
                        ) : (
                          <button
                            onClick={() => setSelectedMapping(mapping)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                          >
                            <Icon name="Edit3" size={11} />
                            Resolve
                          </button>
                        )}
                        <button
                          onClick={() => handleIgnoreSingle(mapping?.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
                          title="Ignore this mapping"
                        >
                          <Icon name="EyeOff" size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filteredMappings?.length} record{filteredMappings?.length !== 1 ? 's' : ''} shown
            {selectedIds?.size > 0 && ` · ${selectedIds?.size} selected`}
            {' · '}All changes are audited and non-destructive
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      {/* Resolve Modal */}
      {selectedMapping && (
        <ResolveModal
          mapping={selectedMapping}
          providerMasters={providerMasters}
          onClose={() => setSelectedMapping(null)}
          onSaved={loadData}
        />
      )}
      {/* Bulk Resolve Modal */}
      {showBulkResolve && (
        <BulkResolveModal
          selectedIds={Array.from(selectedIds)}
          providerMasters={providerMasters}
          onClose={() => setShowBulkResolve(false)}
          onSaved={() => { setSelectedIds(new Set()); loadData(); }}
        />
      )}
    </div>
  );
}
