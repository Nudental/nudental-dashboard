/**
 * ServiceCategoryGoalsManagement.jsx
 * V276 — Service Category Goals admin UI
 *
 * Location: Management & Settings → Goals → Service Category Goals
 *
 * Features:
 *  A. Goal Generator — seeds goals at 15% growth from prior-year same-month Dentrix actuals
 *  B. Preview table — shows proposed goals before saving
 *  C. Manual edit table — edit/clear individual goal rows
 *
 * Rules:
 *  - NULL goal = N/A (no goal configured)
 *  - 0 goal = intentional true zero
 *  - Admin/super_admin only (enforced by Management index.jsx guard)
 *  - No PHI displayed
 *  - Actuals source: /v2/production/by-cdt-category and /v2/patients/demographics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Icon from '../../components/AppIcon';
import { serviceCategoryGoalsService } from '../../services/serviceCategoryGoalsService';
import { officesService } from '../../services/managementService';


// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);
};
const fmtNum = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return Number(v)?.toLocaleString('en-US');
};
const fmtPct = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return `${(parseFloat(v) * 100)?.toFixed(1)}%`;
};

const STATUS_STYLES = {
  'Ready': 'bg-green-100 text-green-800',
  'Existing goal — skipped': 'bg-gray-100 text-gray-600',
  'Existing goal — will overwrite': 'bg-yellow-100 text-yellow-800',
  'Insufficient baseline': 'bg-red-100 text-red-700',
};

const CURRENT_YEAR = new Date()?.getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES?.[status] || 'bg-muted text-muted-foreground'}`}>
    {status}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ServiceCategoryGoalsManagement = () => {
  const [offices, setOffices] = useState([]);
  const [activeTab, setActiveTab] = useState('generator'); // 'generator' | 'edit'

  // Generator state
  const [genTargetYear, setGenTargetYear] = useState(CURRENT_YEAR);
  const [genGrowthRate, setGenGrowthRate] = useState(15);
  const [genOfficeMode, setGenOfficeMode] = useState('all'); // 'all' | 'single'
  const [genOfficeId, setGenOfficeId] = useState('');
  const [genCategoryMode, setGenCategoryMode] = useState('all'); // 'all' | 'single'
  const [genCategory, setGenCategory] = useState('');
  const [genIncludeNetProd, setGenIncludeNetProd] = useState(true);
  const [genIncludeProcCount, setGenIncludeProcCount] = useState(true);
  const [genIncludeUniquePat, setGenIncludeUniquePat] = useState(true);
  const [genOverwrite, setGenOverwrite] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  // Preview state
  const [previewRows, setPreviewRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Edit table state
  const [editYear, setEditYear] = useState(CURRENT_YEAR);
  const [editOfficeId, setEditOfficeId] = useState('');
  const [editRows, setEditRows] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState({});
  const [editSuccess, setEditSuccess] = useState(null);

  // Load offices
  useEffect(() => {
    officesService?.getAll()?.then((list) => {
      setOffices((list || [])?.filter((o) => o?.is_active));
    })?.catch(() => {});
  }, []);

  // ─── Generator ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenError(null);
    setShowPreview(false);
    setPreviewRows([]);

    const targetOfficeIds =
      genOfficeMode === 'all'
        ? offices?.map((o) => o?.id)
        : genOfficeId
        ? [genOfficeId]
        : [];

    if (targetOfficeIds?.length === 0) {
      setGenError('Please select at least one office.');
      return;
    }

    const serviceCategories =
      genCategoryMode === 'single' && genCategory ? [genCategory] : null;

    setGenerating(true);
    try {
      const rows = await serviceCategoryGoalsService?.generatePreview({
        targetYear: genTargetYear,
        growthRate: genGrowthRate / 100,
        officeIds: targetOfficeIds,
        serviceCategories,
        includeNetProduction: genIncludeNetProd,
        includeProcedureCount: genIncludeProcCount,
        includeUniquePatients: genIncludeUniquePat,
        overwriteExisting: genOverwrite,
      });
      setPreviewRows(rows);
      setShowPreview(true);
    } catch (e) {
      setGenError(e?.message || 'Failed to generate preview.');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmSave = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    const rowsToSave = previewRows?.filter(
      (r) => r?.status === 'Ready' || r?.status === 'Existing goal — will overwrite'
    );
    if (rowsToSave?.length === 0) {
      setSaveError('No rows to save (all skipped or insufficient baseline).');
      return;
    }
    setSaving(true);
    try {
      const saved = await serviceCategoryGoalsService?.bulkUpsert(rowsToSave);
      setSaveSuccess(`${saved?.length} goal rows saved successfully.`);
      setShowPreview(false);
      setPreviewRows([]);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save goals.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit Table ─────────────────────────────────────────────────────────────

  const loadEditRows = useCallback(async () => {
    setEditLoading(true);
    setEditError(null);
    try {
      const officeIds = editOfficeId ? [editOfficeId] : offices?.map((o) => o?.id);
      const rows = await serviceCategoryGoalsService?.getGoals({
        officeIds,
        year: editYear,
      });
      setEditRows(rows?.map((r) => ({ ...r, _dirty: false })));
    } catch (e) {
      setEditError(e?.message || 'Failed to load goals.');
    } finally {
      setEditLoading(false);
    }
  }, [editYear, editOfficeId, offices]);

  useEffect(() => {
    if (activeTab === 'edit' && offices?.length > 0) {
      loadEditRows();
    }
  }, [activeTab, loadEditRows]);

  const handleEditField = (rowId, field, value) => {
    setEditRows((prev) =>
      prev?.map((r) =>
        r?.id === rowId
          ? { ...r, [field]: value === '' ? null : value, _dirty: true }
          : r
      )
    );
  };

  const handleSaveRow = async (row) => {
    setEditSaving((prev) => ({ ...prev, [row?.id]: true }));
    setEditError(null);
    try {
      await serviceCategoryGoalsService?.upsertGoal({
        ...row,
        net_production_goal: row?.net_production_goal !== '' && row?.net_production_goal !== null
          ? parseFloat(row?.net_production_goal)
          : null,
        procedure_count_goal: row?.procedure_count_goal !== '' && row?.procedure_count_goal !== null
          ? parseInt(row?.procedure_count_goal, 10)
          : null,
        unique_patient_goal: row?.unique_patient_goal !== '' && row?.unique_patient_goal !== null
          ? parseInt(row?.unique_patient_goal, 10)
          : null,
        growth_rate: row?.growth_rate != null ? parseFloat(row?.growth_rate) : 0.15,
        generated_from: row?.generated_from || 'manual',
      });
      setEditRows((prev) =>
        prev?.map((r) => (r?.id === row?.id ? { ...r, _dirty: false } : r))
      );
      setEditSuccess('Goal saved.');
      setTimeout(() => setEditSuccess(null), 3000);
    } catch (e) {
      setEditError(e?.message || 'Failed to save goal.');
    } finally {
      setEditSaving((prev) => ({ ...prev, [row?.id]: false }));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const readyCount = previewRows?.filter((r) => r?.status === 'Ready')?.length;
  const overwriteCount = previewRows?.filter((r) => r?.status === 'Existing goal — will overwrite')?.length;
  const skippedCount = previewRows?.filter((r) => r?.status === 'Existing goal — skipped')?.length;
  const insufficientCount = previewRows?.filter((r) => r?.status === 'Insufficient baseline')?.length;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'generator', label: 'Generate Goals', icon: 'Zap' },
          { id: 'edit', label: 'Edit Goals', icon: 'Edit3' },
        ]?.map((tab) => (
          <button
            key={tab?.id}
            onClick={() => setActiveTab(tab?.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab?.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab?.icon} size={15} />
            {tab?.label}
          </button>
        ))}
      </div>
      {/* ── GENERATOR TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'generator' && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Icon name="Info" size={15} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 leading-relaxed">
              <strong>Formula:</strong> Current Year Goal = Same Month Prior Year Actual × (1 + Growth Rate).
              Actuals come from Dentrix <code>/v2/production/by-cdt-category</code> and <code>/v2/patients/demographics</code>.
              Missing baseline → goal left as null (N/A). Default growth rate: <strong>15%</strong>.
            </div>
          </div>

          {/* Generator form */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="Settings" size={15} color="var(--color-primary)" />
              Generator Settings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Target Year */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Target Year</label>
                <select
                  value={genTargetYear}
                  onChange={(e) => setGenTargetYear(Number(e?.target?.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {YEAR_OPTIONS?.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Baseline: {genTargetYear - 1}</p>
              </div>

              {/* Growth Rate */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Growth Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={genGrowthRate}
                    onChange={(e) => setGenGrowthRate(parseFloat(e?.target?.value) || 15)}
                    className="w-full pr-8 pl-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Default: 15%</p>
              </div>

              {/* Office selector */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Office</label>
                <select
                  value={genOfficeMode}
                  onChange={(e) => { setGenOfficeMode(e?.target?.value); setGenOfficeId(''); }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-1"
                >
                  <option value="all">All Offices</option>
                  <option value="single">Individual Office</option>
                </select>
                {genOfficeMode === 'single' && (
                  <select
                    value={genOfficeId}
                    onChange={(e) => setGenOfficeId(e?.target?.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select office…</option>
                    {offices?.map((o) => (
                      <option key={o?.id} value={o?.id}>{o?.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Service Category</label>
                <select
                  value={genCategoryMode}
                  onChange={(e) => { setGenCategoryMode(e?.target?.value); setGenCategory(''); }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-1"
                >
                  <option value="all">All Categories</option>
                  <option value="single">Individual Category</option>
                </select>
                {genCategoryMode === 'single' && (
                  <input
                    type="text"
                    placeholder="e.g. Preventive, Restorative…"
                    value={genCategory}
                    onChange={(e) => setGenCategory(e?.target?.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>

              {/* Goal types */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Goal Types to Generate</label>
                <div className="space-y-1.5">
                  {[
                    { key: 'genIncludeNetProd', label: 'Net Production Goal', val: genIncludeNetProd, set: setGenIncludeNetProd },
                    { key: 'genIncludeProcCount', label: 'Procedure Count Goal', val: genIncludeProcCount, set: setGenIncludeProcCount },
                    { key: 'genIncludeUniquePat', label: 'Unique Patient Goal', val: genIncludeUniquePat, set: setGenIncludeUniquePat },
                  ]?.map(({ key, label, val, set }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => set(e?.target?.checked)}
                        className="rounded border-border text-primary"
                      />
                      <span className="text-xs text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Overwrite */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Overwrite Behavior</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genOverwrite}
                    onChange={(e) => setGenOverwrite(e?.target?.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span className="text-xs text-foreground">Overwrite existing goals</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Default: existing goals are skipped.
                </p>
              </div>
            </div>

            {genError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
                <span className="text-xs text-destructive">{genError}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching baseline actuals…
                </>
              ) : (
                <>
                  <Icon name="Zap" size={15} />
                  Generate Preview
                </>
              )}
            </button>
          </div>

          {/* ── Preview Table ──────────────────────────────────────────────── */}
          {showPreview && previewRows?.length > 0 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Ready', count: readyCount, color: 'bg-green-100 text-green-800' },
                  { label: 'Will Overwrite', count: overwriteCount, color: 'bg-yellow-100 text-yellow-800' },
                  { label: 'Skipped', count: skippedCount, color: 'bg-gray-100 text-gray-600' },
                  { label: 'Insufficient Baseline', count: insufficientCount, color: 'bg-red-100 text-red-700' },
                ]?.map(({ label, count, color }) => (
                  <span key={label} className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
                    {label}: {count}
                  </span>
                ))}
              </div>

              {/* Save / cancel */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleConfirmSave}
                  disabled={saving || (readyCount + overwriteCount) === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <Icon name="Save" size={15} />
                      Confirm &amp; Save {readyCount + overwriteCount} Goals
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setShowPreview(false); setPreviewRows([]); }}
                  className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
                  <span className="text-xs text-destructive">{saveError}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                  <Icon name="CheckCircle" size={14} color="var(--color-success)" />
                  <span className="text-xs text-success">{saveSuccess}</span>
                </div>
              )}

              {/* Preview table */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Preview — {previewRows?.length} rows · {genTargetYear} goals at {genGrowthRate}% growth from {genTargetYear - 1} actuals
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 z-10">
                      <tr>
                        {[
                          'Office', 'Service Category', 'Target Month', 'Baseline Month',
                          'Baseline Net Prod', 'Proposed Net Prod Goal',
                          'Baseline Proc Count', 'Proposed Proc Count Goal',
                          'Baseline Unique Pts', 'Proposed Unique Pt Goal',
                          'Growth Rate', 'Status',
                        ]?.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap border-b border-border">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows?.map((r, i) => (
                        <tr
                          key={i}
                          className={`border-t border-border ${
                            r?.status === 'Existing goal — skipped' ? 'opacity-50' : 'hover:bg-muted/20'
                          }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{r?.officeName}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r?.service_category}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{r?.month_year}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-muted-foreground">{r?.baseline_month_year}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmtCurrency(r?.baseline_net_production)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-primary">
                            {fmtCurrency(r?.proposed_net_production_goal)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmtNum(r?.baseline_procedure_count)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-primary">
                            {fmtNum(r?.proposed_procedure_count_goal)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmtNum(r?.baseline_unique_patients)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-primary">
                            {fmtNum(r?.proposed_unique_patient_goal)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r?.growth_rate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <StatusBadge status={r?.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {showPreview && previewRows?.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No rows generated. Check that the selected offices have baseline actuals in {genTargetYear - 1}.
            </div>
          )}

          {saveSuccess && !showPreview && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
              <Icon name="CheckCircle" size={14} color="var(--color-success)" />
              <span className="text-xs text-success">{saveSuccess}</span>
            </div>
          )}
        </div>
      )}
      {/* ── EDIT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'edit' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Year</label>
                <select
                  value={editYear}
                  onChange={(e) => setEditYear(Number(e?.target?.value))}
                  className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {YEAR_OPTIONS?.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Office</label>
                <select
                  value={editOfficeId}
                  onChange={(e) => setEditOfficeId(e?.target?.value)}
                  className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All Offices</option>
                  {offices?.map((o) => (
                    <option key={o?.id} value={o?.id}>{o?.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadEditRows}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Icon name="RefreshCw" size={14} />
                Refresh
              </button>
            </div>
          </div>

          {editError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
              <span className="text-xs text-destructive">{editError}</span>
            </div>
          )}
          {editSuccess && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
              <Icon name="CheckCircle" size={14} color="var(--color-success)" />
              <span className="text-xs text-success">{editSuccess}</span>
            </div>
          )}

          {editLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : editRows?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="Target" size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No service category goals found for {editYear}.</p>
              <p className="text-xs mt-1">Use the Generate Goals tab to create goals.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  {editRows?.length} goal rows — {editYear}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Month', 'Office', 'Service Category', 'Net Prod Goal', 'Proc Count Goal', 'Unique Pt Goal', 'Growth Rate', 'Notes', 'Actions']?.map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap border-b border-border">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editRows?.map((row) => (
                      <tr key={row?.id} className={`border-t border-border ${row?._dirty ? 'bg-yellow-50/50' : 'hover:bg-muted/20'}`}>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{row?.month_year}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row?.officeName}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row?.service_category}</td>
                        {/* Net Production Goal */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={row?.net_production_goal ?? ''}
                            onChange={(e) => handleEditField(row?.id, 'net_production_goal', e?.target?.value)}
                            placeholder="N/A"
                            className="w-28 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        {/* Procedure Count Goal */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row?.procedure_count_goal ?? ''}
                            onChange={(e) => handleEditField(row?.id, 'procedure_count_goal', e?.target?.value)}
                            placeholder="N/A"
                            className="w-24 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        {/* Unique Patient Goal */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row?.unique_patient_goal ?? ''}
                            onChange={(e) => handleEditField(row?.id, 'unique_patient_goal', e?.target?.value)}
                            placeholder="N/A"
                            className="w-24 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        {/* Growth Rate */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={row?.growth_rate ?? 0.15}
                            onChange={(e) => handleEditField(row?.id, 'growth_rate', e?.target?.value)}
                            className="w-20 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        {/* Notes */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row?.notes ?? ''}
                            onChange={(e) => handleEditField(row?.id, 'notes', e?.target?.value)}
                            placeholder="Optional note"
                            className="w-36 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        {/* Save */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleSaveRow(row)}
                            disabled={!row?._dirty || editSaving?.[row?.id]}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                              row?._dirty && !editSaving?.[row?.id]
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                            }`}
                          >
                            {editSaving?.[row?.id] ? (
                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <Icon name="Save" size={11} />
                            )}
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Icon name="Info" size={14} color="var(--color-muted-foreground)" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Leave a goal field blank to set it to <strong>null (N/A)</strong> — meaning no goal is configured for that metric.
              Enter <strong>0</strong> only for an intentional zero goal. Not all three goal types need to be filled.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCategoryGoalsManagement;
