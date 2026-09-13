import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import {
  fetchPayrollData,
  fetchPayrollOffices,
  getPayrollScheduleForYear,
  getScheduleYears,
  getCurrentPayrollRun,
  formatPayrollRunLabel,
  formatDateShort,
  formatDateRange,
  PAYROLL_TYPE_LABELS,
  PAYROLL_TYPE_COLORS,
} from '../../services/payrollService';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { getDentrixCollectionWindow } from '../../utils/calendarDateHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtCurrencyShort = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(parseFloat(v) || 0);

const fmtPct = (v) => `${(parseFloat(v) || 0)?.toFixed(2)}%`;

const YEARS = getScheduleYears();

// Discrepancy threshold — flag if variance exceeds this percentage
const DISCREPANCY_THRESHOLD_PCT = 2.0;

// ─── Discrepancy Badge ────────────────────────────────────────────────────────
function DiscrepancyBadge({ status, variance, variancePct }) {
  if (status === 'match') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <Icon name="CheckCircle" size={11} />
        Match
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        <Icon name="MinusCircle" size={11} />
        No Payroll Entry
      </span>
    );
  }
  const isOver = variance > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      isOver
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      <Icon name={isOver ? 'TrendingUp' : 'TrendingDown'} size={11} />
      {isOver ? '+' : ''}{fmtCurrency(variance)} ({isOver ? '+' : ''}{fmtPct(variancePct)})
    </span>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${map?.[severity] || map?.info}`}>
      {severity}
    </span>
  );
}

// ─── Payroll Type Badge ───────────────────────────────────────────────────────
function PayrollTypeBadge({ type }) {
  const label = PAYROLL_TYPE_LABELS?.[type] || type;
  const color = PAYROLL_TYPE_COLORS?.[type] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function AuditKPICard({ label, value, sub, icon, color, highlight }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-5 flex flex-col gap-2 shadow-sm ${
      highlight
        ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800' :'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon name={icon} size={16} className="text-white" />
        </span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TableSkeleton({ cols = 8 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <tbody>
          {[...Array(5)]?.map((_, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
              {[...Array(cols)]?.map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <Icon name="SearchX" size={32} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ─── Manual Payroll Entry Modal ───────────────────────────────────────────────
function ManualPayrollEntryModal({ row, onClose, onSave }) {
  const [actualGross, setActualGross] = useState(row?.actualGrossProduction ?? '');
  const [actualAdj, setActualAdj] = useState(row?.actualAdjustedProduction ?? '');
  const [actualCollections, setActualCollections] = useState(row?.actualCollections ?? '');
  const [notes, setNotes] = useState(row?.auditNotes ?? '');

  const handleSave = () => {
    onSave({
      providerId: row?.providerId,
      providerName: row?.providerName,
      actualGrossProduction: parseFloat(actualGross) || 0,
      actualAdjustedProduction: parseFloat(actualAdj) || 0,
      actualCollections: parseFloat(actualCollections) || 0,
      auditNotes: notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Enter Actual Payroll Run Values</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{row?.providerName} — {row?.officeName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="X" size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
            <strong>Dentrix Calculated:</strong> Gross {fmtCurrency(row?.grossProduction)} · Adj {fmtCurrency(row?.adjustedProduction)} · Collections {fmtCurrency(row?.totalCollections)}
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual Gross Production (Payroll Run)</label>
              <input
                type="number"
                step="0.01"
                value={actualGross}
                onChange={e => setActualGross(e?.target?.value)}
                placeholder="0.00"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual Adjusted Production (Payroll Run)</label>
              <input
                type="number"
                step="0.01"
                value={actualAdj}
                onChange={e => setActualAdj(e?.target?.value)}
                placeholder="0.00"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual Total Collections (Payroll Run)</label>
              <input
                type="number"
                step="0.01"
                value={actualCollections}
                onChange={e => setActualCollections(e?.target?.value)}
                placeholder="0.00"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Audit Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e?.target?.value)}
                rows={2}
                placeholder="Optional notes about this payroll entry..."
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors">
            Save & Compare
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Row Builder ────────────────────────────────────────────────────────
function buildAuditRow(dentrixRow, actualEntry) {
  const hasActual = actualEntry != null;

  const calcGross = dentrixRow?.grossProduction || 0;
  const calcAdj = dentrixRow?.adjustedProduction || 0;
  const calcCollections = dentrixRow?.totalCollections || 0;

  const actGross = hasActual ? (actualEntry?.actualGrossProduction || 0) : null;
  const actAdj = hasActual ? (actualEntry?.actualAdjustedProduction || 0) : null;
  const actCollections = hasActual ? (actualEntry?.actualCollections || 0) : null;

  const grossVariance = hasActual ? actGross - calcGross : null;
  const adjVariance = hasActual ? actAdj - calcAdj : null;
  const collectionsVariance = hasActual ? actCollections - calcCollections : null;

  const grossVariancePct = hasActual && calcGross !== 0 ? (grossVariance / calcGross) * 100 : null;
  const adjVariancePct = hasActual && calcAdj !== 0 ? (adjVariance / calcAdj) * 100 : null;
  const collectionsVariancePct = hasActual && calcCollections !== 0 ? (collectionsVariance / calcCollections) * 100 : null;

  const hasDiscrepancy = hasActual && (
    Math.abs(grossVariancePct) > DISCREPANCY_THRESHOLD_PCT ||
    Math.abs(adjVariancePct) > DISCREPANCY_THRESHOLD_PCT ||
    Math.abs(collectionsVariancePct) > DISCREPANCY_THRESHOLD_PCT
  );

  const getStatus = (variance, variancePct) => {
    if (!hasActual) return 'missing';
    if (Math.abs(variancePct) <= DISCREPANCY_THRESHOLD_PCT) return 'match';
    return 'discrepancy';
  };

  const getSeverity = () => {
    if (!hasActual) return 'info';
    const maxPct = Math.max(
      Math.abs(grossVariancePct || 0),
      Math.abs(adjVariancePct || 0),
      Math.abs(collectionsVariancePct || 0)
    );
    if (maxPct > 10) return 'critical';
    if (maxPct > DISCREPANCY_THRESHOLD_PCT) return 'warning';
    return 'ok';
  };

  return {
    ...dentrixRow,
    actualGrossProduction: actGross,
    actualAdjustedProduction: actAdj,
    actualCollections: actCollections,
    grossVariance,
    adjVariance,
    collectionsVariance,
    grossVariancePct,
    adjVariancePct,
    collectionsVariancePct,
    grossStatus: getStatus(grossVariance, grossVariancePct),
    adjStatus: getStatus(adjVariance, adjVariancePct),
    collectionsStatus: getStatus(collectionsVariance, collectionsVariancePct),
    hasDiscrepancy,
    severity: getSeverity(),
    auditNotes: actualEntry?.auditNotes || '',
    hasActual,
  };
}

// ─── Audit Table ──────────────────────────────────────────────────────────────
function AuditTable({ entries, loading, onRowClick, showOnlyDiscrepancies }) {
  if (loading) return <TableSkeleton cols={10} />;

  const displayRows = showOnlyDiscrepancies
    ? entries?.filter(r => r?.hasDiscrepancy || !r?.hasActual)
    : entries;

  if (!displayRows?.length) {
    return <EmptyState label={showOnlyDiscrepancies ? 'No discrepancies found for selected period.' : 'No provider data for selected period.'} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">Provider</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Office</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Type</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Severity</th>
            {/* Gross Production */}
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap border-l border-blue-100 dark:border-blue-900">
              <div>Gross Prod.</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Dentrix Calc.</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">
              <div>Gross Prod.</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Actual Payroll</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-500 whitespace-nowrap">Gross Variance</th>
            {/* Collections */}
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-500 whitespace-nowrap border-l border-emerald-100 dark:border-emerald-900">
              <div>Collections</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Dentrix Calc.</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-500 whitespace-nowrap">
              <div>Collections</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Actual Payroll</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-500 whitespace-nowrap">Collections Variance</th>
            {/* Adjusted Production */}
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-violet-500 whitespace-nowrap border-l border-violet-100 dark:border-violet-900">
              <div>Adj. Prod.</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Dentrix Calc.</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-violet-500 whitespace-nowrap">
              <div>Adj. Prod.</div>
              <div className="text-gray-400 font-normal normal-case text-xs">Actual Payroll</div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-violet-500 whitespace-nowrap">Adj. Variance</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Notes</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {displayRows?.map((row, i) => (
            <tr
              key={row?.providerId || i}
              className={`transition-colors ${
                row?.severity === 'critical' ?'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : row?.severity === 'warning' ?'bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20' :'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 bg-inherit z-10">
                {row?.providerName}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.officeName}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  row?.classification === 'hygienist' ?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {row?.classification === 'hygienist' ? 'Hygienist' : 'Doctor'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <SeverityBadge severity={row?.severity} />
              </td>
              {/* Gross Production */}
              <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap border-l border-blue-50 dark:border-blue-900/30">
                {fmtCurrency(row?.grossProduction)}
              </td>
              <td className="px-4 py-3 font-mono whitespace-nowrap">
                {row?.hasActual ? fmtCurrency(row?.actualGrossProduction) : <span className="text-gray-400 dark:text-gray-600 italic text-xs">Not entered</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <DiscrepancyBadge
                  status={row?.grossStatus}
                  variance={row?.grossVariance}
                  variancePct={row?.grossVariancePct}
                />
              </td>
              {/* Collections */}
              <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap border-l border-emerald-50 dark:border-emerald-900/30">
                {fmtCurrency(row?.totalCollections)}
              </td>
              <td className="px-4 py-3 font-mono whitespace-nowrap">
                {row?.hasActual ? fmtCurrency(row?.actualCollections) : <span className="text-gray-400 dark:text-gray-600 italic text-xs">Not entered</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <DiscrepancyBadge
                  status={row?.collectionsStatus}
                  variance={row?.collectionsVariance}
                  variancePct={row?.collectionsVariancePct}
                />
              </td>
              {/* Adjusted Production */}
              <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap border-l border-violet-50 dark:border-violet-900/30">
                {fmtCurrency(row?.adjustedProduction)}
              </td>
              <td className="px-4 py-3 font-mono whitespace-nowrap">
                {row?.hasActual ? fmtCurrency(row?.actualAdjustedProduction) : <span className="text-gray-400 dark:text-gray-600 italic text-xs">Not entered</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <DiscrepancyBadge
                  status={row?.adjStatus}
                  variance={row?.adjVariance}
                  variancePct={row?.adjVariancePct}
                />
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate" title={row?.auditNotes}>
                {row?.auditNotes || '—'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button
                  onClick={() => onRowClick(row)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-400 text-xs font-semibold transition-colors border border-violet-200 dark:border-violet-700"
                >
                  <Icon name={row?.hasActual ? 'Pencil' : 'Plus'} size={12} />
                  {row?.hasActual ? 'Edit' : 'Enter Actual'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Discrepancy Summary Panel ────────────────────────────────────────────────
function DiscrepancySummaryPanel({ auditRows }) {
  const total = auditRows?.length || 0;
  const withActual = auditRows?.filter(r => r?.hasActual)?.length || 0;
  const critical = auditRows?.filter(r => r?.severity === 'critical')?.length || 0;
  const warnings = auditRows?.filter(r => r?.severity === 'warning')?.length || 0;
  const matched = auditRows?.filter(r => r?.severity === 'ok')?.length || 0;
  const missing = auditRows?.filter(r => !r?.hasActual)?.length || 0;

  const totalCalcCollections = auditRows?.reduce((s, r) => s + (r?.totalCollections || 0), 0);
  const totalActualCollections = auditRows?.filter(r => r?.hasActual)?.reduce((s, r) => s + (r?.actualCollections || 0), 0);
  const totalCollectionsVariance = totalActualCollections - (auditRows?.filter(r => r?.hasActual)?.reduce((s, r) => s + (r?.totalCollections || 0), 0));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Icon name="BarChart3" size={14} className="text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Audit Summary</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Providers</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{total}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Payroll Entered</span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{withActual}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Missing Entry</span>
          <span className="text-xl font-bold text-gray-500 dark:text-gray-400">{missing}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Critical Flags</span>
          <span className={`text-xl font-bold ${critical > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{critical}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Warnings</span>
          <span className={`text-xl font-bold ${warnings > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{warnings}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Matched</span>
          <span className={`text-xl font-bold ${matched > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{matched}</span>
        </div>
      </div>
      {withActual > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-6 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Dentrix Calc. Collections</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">{fmtCurrency(totalCalcCollections)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Actual Payroll Collections</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">{fmtCurrency(totalActualCollections)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Net Variance</span>
            <span className={`font-mono font-semibold ${Math.abs(totalCollectionsVariance) > 100 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {totalCollectionsVariance >= 0 ? '+' : ''}{fmtCurrency(totalCollectionsVariance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportAuditCSV(auditRows, selectedRun) {
  const fmtNum = (n) => (parseFloat(n) || 0)?.toFixed(2);
  const payday = selectedRun?.payday || '';
  const periodStart = selectedRun?.pay_period_start || '';
  const periodEnd = selectedRun?.pay_period_end || '';
  const payrollType = PAYROLL_TYPE_LABELS?.[selectedRun?.payroll_type] || 'Regular';

  const metaHeader = [
    `Payroll Audit Report`,
    `Payroll Run:,${selectedRun?.payroll_name || ''}`,
    `Payroll Type:,${payrollType}`,
    `Pay Period:,${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)}`,
    `Payday:,${formatDateShort(payday)}`,
    `Discrepancy Threshold:,${DISCREPANCY_THRESHOLD_PCT}%`,
    `Generated:,${new Date()?.toLocaleString()}`,
    '',
  ]?.join('\n');

  const header = 'Provider,Office,Type,Severity,Dentrix Gross,Actual Gross,Gross Variance,Gross Variance %,Dentrix Collections,Actual Collections,Collections Variance,Collections Variance %,Dentrix Adj Prod,Actual Adj Prod,Adj Variance,Adj Variance %,Gross Status,Collections Status,Adj Status,Notes';

  const dataRows = auditRows?.map(r => [
    r?.providerName,
    r?.officeName,
    r?.classification,
    r?.severity,
    fmtNum(r?.grossProduction),
    r?.hasActual ? fmtNum(r?.actualGrossProduction) : '',
    r?.hasActual ? fmtNum(r?.grossVariance) : '',
    r?.hasActual ? fmtNum(r?.grossVariancePct) : '',
    fmtNum(r?.totalCollections),
    r?.hasActual ? fmtNum(r?.actualCollections) : '',
    r?.hasActual ? fmtNum(r?.collectionsVariance) : '',
    r?.hasActual ? fmtNum(r?.collectionsVariancePct) : '',
    fmtNum(r?.adjustedProduction),
    r?.hasActual ? fmtNum(r?.actualAdjustedProduction) : '',
    r?.hasActual ? fmtNum(r?.adjVariance) : '',
    r?.hasActual ? fmtNum(r?.adjVariancePct) : '',
    r?.grossStatus,
    r?.collectionsStatus,
    r?.adjStatus,
    `"${r?.auditNotes || ''}"`,
  ]?.join(','));

  const csv = `${metaHeader}${header}\n${dataRows?.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (selectedRun?.id || 'audit')?.replace(/[^a-z0-9]/gi, '_');
  link.download = `payroll_audit_${safeName}.csv`;
  link?.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PayrollAudit() {
  const { user, userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const { hasPermission, loading: permLoading } = useRolePermissions();

  // Page-level guard: require finance.payroll_audit.view or super_admin
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('finance.payroll_audit.view')) {
    return <AccessDenied message="Payroll Audit is restricted. Contact your administrator to request access." />;
  }

  const [selectedYear, setSelectedYear] = useState(new Date()?.getFullYear());
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [selectedProviderType, setSelectedProviderType] = useState('all');
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dentrixRows, setDentrixRows] = useState([]);
  const [actualEntries, setActualEntries] = useState({}); // keyed by providerId
  const [offices, setOffices] = useState([]);

  const [modalRow, setModalRow] = useState(null);

  // ── Schedule ───────────────────────────────────────────────────────────────
  const scheduleForYear = getPayrollScheduleForYear(selectedYear);

  useEffect(() => {
    if (!selectedRunId && scheduleForYear?.length > 0) {
      const current = getCurrentPayrollRun();
      const match = scheduleForYear?.find(r => r?.id === current?.id);
      setSelectedRunId(match?.id || scheduleForYear?.[scheduleForYear?.length - 1]?.id);
    }
  }, [selectedYear]);

  const selectedRun = scheduleForYear?.find(r => r?.id === selectedRunId) || scheduleForYear?.[0];

  // ── Load Offices ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPayrollOffices()?.then(setOffices);
  }, []);

  // ── Load Dentrix Data ──────────────────────────────────────────────────────
  const loadDentrixData = useCallback(async () => {
    if (!selectedRun) return;
    setLoading(true);
    setError(null);
    try {
      // The service accepts final Ascend dates; preserve the live payroll offset once.
      const { dentrixStart, dentrixEnd } = getDentrixCollectionWindow(
        selectedRun?.pay_period_start,
        selectedRun?.pay_period_end
      );
      const { doctors, hygienists, error: fetchError } = await fetchPayrollData({
        startDate: dentrixStart,
        endDate: dentrixEnd,
        locationId: selectedOffice || undefined,
        providerType: selectedProviderType !== 'all' ? selectedProviderType : undefined,
        payrollRun: selectedRun,
      });
      if (fetchError) setError(fetchError);
      setDentrixRows([...(doctors || []), ...(hygienists || [])]);
    } catch (err) {
      setError(err?.message);
      setDentrixRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRun?.id, selectedOffice, selectedProviderType]);

  useEffect(() => {
    if (isSuperAdmin) loadDentrixData();
  }, [loadDentrixData, isSuperAdmin]);

  // ── Build Audit Rows ───────────────────────────────────────────────────────
  const auditRows = dentrixRows?.map(row => {
    const actual = actualEntries?.[row?.providerId] || null;
    return buildAuditRow(row, actual);
  });

  const discrepancyCount = auditRows?.filter(r => r?.hasDiscrepancy)?.length || 0;
  const criticalCount = auditRows?.filter(r => r?.severity === 'critical')?.length || 0;

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  const totalCalcGross = dentrixRows?.reduce((s, r) => s + (r?.grossProduction || 0), 0);
  const totalCalcAdj = dentrixRows?.reduce((s, r) => s + (r?.adjustedProduction || 0), 0);
  const totalCalcCollections = dentrixRows?.reduce((s, r) => s + (r?.totalCollections || 0), 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEnterActual = (row) => setModalRow(row);

  const handleSaveActual = (entry) => {
    setActualEntries(prev => ({ ...prev, [entry?.providerId]: entry }));
  };

  const handleExportCSV = () => {
    exportAuditCSV(auditRows, selectedRun);
  };

  const goToPrevRun = () => {
    const idx = scheduleForYear?.findIndex(r => r?.id === selectedRunId);
    if (idx > 0) {
      setSelectedRunId(scheduleForYear?.[idx - 1]?.id);
    } else {
      const prevYear = selectedYear - 1;
      const prevSchedule = getPayrollScheduleForYear(prevYear);
      if (prevSchedule?.length > 0) {
        setSelectedYear(prevYear);
        setSelectedRunId(prevSchedule?.[prevSchedule?.length - 1]?.id);
      }
    }
  };

  const goToNextRun = () => {
    const idx = scheduleForYear?.findIndex(r => r?.id === selectedRunId);
    if (idx < scheduleForYear?.length - 1) {
      setSelectedRunId(scheduleForYear?.[idx + 1]?.id);
    } else {
      const nextYear = selectedYear + 1;
      const nextSchedule = getPayrollScheduleForYear(nextYear);
      if (nextSchedule?.length > 0) {
        setSelectedYear(nextYear);
        setSelectedRunId(nextSchedule?.[0]?.id);
      }
    }
  };

  // ── RBAC Gate ──────────────────────────────────────────────────────────────
  if (!isSuperAdmin) return <AccessDenied />;

  const payPeriodLabel = selectedRun
    ? formatDateRange(selectedRun?.pay_period_start, selectedRun?.pay_period_end)
    : '';
  const paydayLabel = selectedRun ? formatDateShort(selectedRun?.payday) : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Finance' }, { label: 'Payroll' }, { label: 'Payroll Audit' }]} />
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
              <Icon name="ShieldCheck" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payroll Audit</h1>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-widest">
                Super Administrator Only · Dentrix Data Accuracy Verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm font-semibold">
                <Icon name="AlertOctagon" size={15} />
                {criticalCount} Critical {criticalCount === 1 ? 'Flag' : 'Flags'}
              </div>
            )}
            {discrepancyCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-sm font-semibold">
                <Icon name="AlertTriangle" size={15} />
                {discrepancyCount} {discrepancyCount === 1 ? 'Discrepancy' : 'Discrepancies'}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Year */}
          <div className="flex flex-col gap-1 min-w-[90px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Year</label>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e?.target?.value)); setSelectedRunId(null); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {YEARS?.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Pay Period Selector */}
          <div className="flex flex-col gap-1 flex-1 min-w-[320px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pay Period (Payday | Type | Period)
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevRun}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="Previous pay period"
              >
                <Icon name="ChevronLeft" size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
              <select
                value={selectedRunId || ''}
                onChange={e => setSelectedRunId(e?.target?.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {scheduleForYear?.map(run => (
                  <option key={run?.id} value={run?.id}>
                    {formatPayrollRunLabel(run)}
                  </option>
                ))}
              </select>
              <button
                onClick={goToNextRun}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="Next pay period"
              >
                <Icon name="ChevronRight" size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Office Filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</label>
            <select
              value={selectedOffice}
              onChange={e => setSelectedOffice(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">All Offices</option>
              {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
            </select>
          </div>

          {/* Provider Type Filter */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider Type</label>
            <select
              value={selectedProviderType}
              onChange={e => setSelectedProviderType(e?.target?.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">All Types</option>
              <option value="doctor">Doctors</option>
              <option value="hygienist">Hygienists</option>
            </select>
          </div>

          {/* Discrepancy Toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">View</label>
            <button
              onClick={() => setShowOnlyDiscrepancies(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                showOnlyDiscrepancies
                  ? 'bg-rose-600 border-rose-600 text-white' :'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <Icon name="AlertTriangle" size={14} />
              {showOnlyDiscrepancies ? 'Showing Flags Only' : 'Show Flags Only'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto items-end">
            <button
              onClick={loadDentrixData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || !auditRows?.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Icon name="Download" size={15} />
              Export Audit CSV
            </button>
          </div>
        </div>
      </div>
      {/* Pay Period Banner */}
      {selectedRun && (
        <div className="flex flex-wrap items-center gap-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-xl px-4 py-3 text-sm">
          <PayrollTypeBadge type={selectedRun?.payroll_type} />
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
            <Icon name="Calendar" size={13} />
            <span>Pay Period: <strong>{payPeriodLabel}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
            <Icon name="Banknote" size={13} />
            <span>Payday: <strong>{paydayLabel}</strong></span>
          </div>
          <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <Icon name="Info" size={12} />
            <span>Dentrix data filtered by pay period dates — not payday. Discrepancy threshold: ±{DISCREPANCY_THRESHOLD_PCT}%</span>
          </div>
          {selectedRun?.notes && (
            <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
              <Icon name="FileText" size={12} />
              <span>{selectedRun?.notes}</span>
            </div>
          )}
        </div>
      )}
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Icon name="AlertTriangle" size={16} />
          <span>Data may be partial: {error}. Showing available data from fallback sources.</span>
        </div>
      )}
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AuditKPICard
          label="Dentrix Gross Prod."
          value={fmtCurrencyShort(totalCalcGross)}
          sub="Calculated from Dentrix Ascend"
          icon="TrendingUp"
          color="bg-blue-500"
        />
        <AuditKPICard
          label="Dentrix Adj. Prod."
          value={fmtCurrencyShort(totalCalcAdj)}
          sub="After production adjustments"
          icon="BarChart2"
          color="bg-violet-500"
        />
        <AuditKPICard
          label="Dentrix Collections"
          value={fmtCurrencyShort(totalCalcCollections)}
          sub="Actual collected per Dentrix"
          icon="DollarSign"
          color="bg-emerald-500"
        />
        <AuditKPICard
          label="Discrepancies"
          value={discrepancyCount}
          sub={`>${DISCREPANCY_THRESHOLD_PCT}% variance flagged`}
          icon="AlertTriangle"
          color={discrepancyCount > 0 ? 'bg-amber-500' : 'bg-gray-400'}
          highlight={discrepancyCount > 0}
        />
        <AuditKPICard
          label="Critical Flags"
          value={criticalCount}
          sub=">10% variance — requires review"
          icon="AlertOctagon"
          color={criticalCount > 0 ? 'bg-red-500' : 'bg-gray-400'}
          highlight={criticalCount > 0}
        />
      </div>
      {/* Audit Summary Panel */}
      <DiscrepancySummaryPanel auditRows={auditRows} />
      {/* Audit Table */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <Icon name="ClipboardCheck" size={14} className="text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Provider Compensation Audit</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Dentrix Calculated vs. Actual Payroll Run · {auditRows?.length} providers
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              Critical (&gt;10%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              Warning (&gt;{DISCREPANCY_THRESHOLD_PCT}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Match
            </span>
          </div>
        </div>
        <AuditTable
          entries={auditRows}
          loading={loading}
          onRowClick={handleEnterActual}
          showOnlyDiscrepancies={showOnlyDiscrepancies}
        />
      </section>
      {/* How to Use */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="HelpCircle" size={15} className="text-gray-400" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">How to Use This Audit Screen</h3>
        </div>
        <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-decimal list-inside">
          <li>Select the pay period you want to audit using the selector above.</li>
          <li>The <strong className="text-gray-700 dark:text-gray-300">Dentrix Calculated</strong> columns are pulled directly from Dentrix Ascend using the pay period start/end dates.</li>
          <li>Click <strong className="text-gray-700 dark:text-gray-300">Enter Actual</strong> for each provider to input the values from the actual payroll run (e.g., from your payroll processor or Gusto).</li>
          <li>The system automatically flags discrepancies exceeding <strong className="text-gray-700 dark:text-gray-300">±{DISCREPANCY_THRESHOLD_PCT}%</strong> variance between Dentrix data and actual payroll values.</li>
          <li>Critical flags (&gt;10% variance) require immediate review and reconciliation before finalizing payroll.</li>
          <li>Use <strong className="text-gray-700 dark:text-gray-300">Export Audit CSV</strong> to download the full reconciliation report for record-keeping.</li>
        </ol>
      </div>
      {/* Data Source Note */}
      <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
        <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
        <div>
          <strong className="text-gray-600 dark:text-gray-300">Data Source:</strong>{' '}
          Dentrix Ascend data filtered by <strong>pay period dates</strong> (not payday) via{' '}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/v2/reports/provider-performance</code> and{' '}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/v2/collections/summary</code>.
          Actual payroll values are entered manually per pay period and stored in session only — not persisted to the database.
          Gross Production = full production before adjustments. Adjusted Production = production after adjustments.
          Total Collections = actual collected amount.
        </div>
      </div>
      {/* Manual Entry Modal */}
      {modalRow && (
        <ManualPayrollEntryModal
          row={modalRow}
          onClose={() => setModalRow(null)}
          onSave={handleSaveActual}
        />
      )}
    </div>
  );
}
