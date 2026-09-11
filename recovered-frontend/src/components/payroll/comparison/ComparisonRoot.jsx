import React, { useState, useMemo } from 'react';
import { useGustoComparison, useGustoCrosswalk } from '../../../hooks/gusto/useGustoComparison';
import { fmtDate, fmtDateRange, fmtDateCSV, downloadCSV } from '../../../lib/gusto/gustoFormatters';
import { resolveOfficeName } from '../../../constants/offices';
import { useRealtimeSubscription } from '../../../hooks/useRealtimeSubscription';

// ─── Null-safe currency formatter ─────────────────────────────────────────────
// CRITICAL: null/undefined → "N/A", not $0.
// Real 0 from backend → "$0.00" only when backend explicitly returns 0.
function fmtMoney(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })?.format(num);
}

// Null-safe percent formatter
function fmtPct(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return `${num?.toFixed(2)}%`;
}

// ─── Pay % formatter — handles "32%", 32, and 0.32 from backend ──────────────
// "32%" → display "32%"
// 32    → display "32%"
// 0.32  → display "32%"
// null/undefined → "N/A"
function fmtPayPercent(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  // If it's already a string with a % sign, strip and re-format
  if (typeof value === 'string') {
    const stripped = value?.replace('%', '')?.trim();
    const num = parseFloat(stripped);
    if (isNaN(num)) return 'N/A';
    // If the number is already in whole-number form (e.g. "32"), display as-is with %
    return `${num}%`;
  }
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  // Decimal form: 0.32 → 32%
  if (num > 0 && num < 1) return `${(num * 100)?.toFixed(2)?.replace(/\.00$/, '')}%`;
  // Whole number form: 32 → 32%
  return `${num}%`;
}

// ─── Status config (Phase 2B) ─────────────────────────────────────────────────
// Includes all backend status values per Phase 2B spec.
// excluded / not_a_provider rows are filtered out in the table (not shown unless
// backend explicitly returns them for audit — handled by isSuperAdmin gate).
const STATUS_CONFIG = {
  matched: {
    label: 'Matched',
    badge: 'bg-emerald-100 text-emerald-800',
    row: '',
  },
  overpaid: {
    label: 'Overpaid',
    badge: 'bg-red-100 text-red-800',
    row: 'bg-red-50',
  },
  underpaid: {
    label: 'Underpaid',
    badge: 'bg-amber-100 text-amber-800',
    row: 'bg-amber-50',
  },
  needs_mapping: {
    label: 'Needs Mapping',
    badge: 'bg-orange-100 text-orange-800',
    row: 'bg-orange-50',
  },
  no_gusto_actual: {
    label: 'No Gusto Actual',
    badge: 'bg-gray-100 text-gray-600',
    row: 'bg-gray-50',
  },
  no_collections_this_period: {
    label: 'No Collections This Period',
    badge: 'bg-blue-100 text-blue-700',
    row: '',
  },
  source_not_wired: {
    label: 'Source Not Wired',
    badge: 'bg-red-100 text-red-700',
    row: 'bg-red-50',
  },
  missing_actual: {
    label: 'No Gusto Actual',
    badge: 'bg-gray-100 text-gray-600',
    row: 'bg-gray-50',
  },
  missing_expected: {
    label: 'Needs Review',
    badge: 'bg-amber-100 text-amber-800',
    row: 'bg-amber-50',
  },
  correction_run: {
    label: 'Correction / Review',
    badge: 'bg-orange-100 text-orange-800',
    row: 'bg-orange-50',
  },
  off_cycle_review: {
    label: 'Off-Cycle / Review',
    badge: 'bg-purple-100 text-purple-800',
    row: 'bg-purple-50',
  },
  needs_review: {
    label: 'Needs Review',
    badge: 'bg-amber-100 text-amber-800',
    row: 'bg-amber-50',
  },
  excluded: {
    label: 'Excluded',
    badge: 'bg-gray-100 text-gray-500',
    row: '',
  },
  not_a_provider: {
    label: 'Not a Provider',
    badge: 'bg-gray-100 text-gray-500',
    row: '',
  },
};

function getStatusConfig(status) {
  return STATUS_CONFIG?.[status?.toLowerCase?.()] || {
    label: status || '—',
    badge: 'bg-gray-100 text-gray-600',
    row: '',
  };
}

// ─── Variance styling ─────────────────────────────────────────────────────────
function getVarianceClass(varianceAmount, variancePct) {
  const amt = parseFloat(varianceAmount);
  const pct = Math.abs(parseFloat(variancePct) || 0);
  if (isNaN(amt)) return 'text-gray-400';
  if (amt < 0) return 'text-red-600 font-semibold';
  if (pct > 5) return 'text-red-600 font-semibold';
  if (pct > 1) return 'text-amber-600 font-semibold';
  return 'text-emerald-600 font-semibold';
}

// ─── Display helpers ──────────────────────────────────────────────────────────
function resolveOfficeDisplay(officeIdOrName) {
  if (!officeIdOrName) return '—';
  const resolved = resolveOfficeName(officeIdOrName);
  if (resolved && resolved !== 'Unknown Office') return resolved;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i?.test(officeIdOrName);
  if (isUUID) return 'Unknown Office';
  return resolved || officeIdOrName || '—';
}

// Resolve provider display name — supports both camelCase and snake_case
function resolveProviderDisplay(row) {
  if (!row) return 'Unmapped';
  const name =
    row?.providerName?.trim() ||
    row?.provider_name?.trim() ||
    row?.dentrixProviderName?.trim() ||
    row?.dentrix_provider_name?.trim() ||
    row?.employeeName?.trim() ||
    row?.employee_name?.trim() ||
    '';
  return name || 'Unmapped';
}

// Resolve Gusto employee display name — supports both camelCase and snake_case
function resolveGustoEmployeeName(row) {
  if (!row) return 'N/A';
  if (row?.gustoEmployeeName?.trim()) return row?.gustoEmployeeName?.trim();
  if (row?.gusto_employee_name?.trim()) return row?.gusto_employee_name?.trim();
  const first = row?.gustoFirstName || row?.gusto_first_name || row?.first_name || '';
  const last = row?.gustoLastName || row?.gusto_last_name || row?.last_name || '';
  if (first || last) return `${first} ${last}`?.trim();
  return 'N/A';
}

// Resolve provider type — supports both camelCase and snake_case
function resolveProviderType(row) {
  const t =
    row?.providerType ||
    row?.provider_type ||
    row?.roleClassification ||
    row?.role_classification ||
    row?.roleType ||
    row?.role_type ||
    '';
  if (!t) return '—';
  const lower = t?.toLowerCase();
  if (lower === 'doctor') return 'Doctor';
  if (lower === 'hygienist') return 'Hygienist';
  return t;
}

// Resolve comparison status — supports comparisonStatus, comparison_status, status
function resolveStatus(row) {
  return (
    row?.comparisonStatus ||
    row?.comparison_status ||
    row?.status ||
    ''
  );
}

// Resolve payroll run ID — supports camelCase and snake_case
function resolvePayrollRunId(row) {
  return row?.payrollRunId || row?.payroll_run_id || row?.run_id || '—';
}

// Resolve check date — supports camelCase and snake_case
function resolveCheckDate(row) {
  return row?.checkDate || row?.check_date || null;
}

// Resolve pay period start — supports camelCase and snake_case
function resolvePayPeriodStart(row) {
  return (
    row?.payrollPeriodStart ||
    row?.payroll_period_start ||
    row?.payPeriodStart ||
    row?.pay_period_start ||
    null
  );
}

// Resolve pay period end — supports camelCase and snake_case
function resolvePayPeriodEnd(row) {
  return (
    row?.payrollPeriodEnd ||
    row?.payroll_period_end ||
    row?.payPeriodEnd ||
    row?.pay_period_end ||
    null
  );
}

// ─── Phase 2B field resolvers ─────────────────────────────────────────────────

// Actual Gusto Gross Pay — Phase 2B primary field: actualGustoGrossPay
// Falls back to actualGrossPay / actual_gross_pay for backward compat.
// NEVER use gustoNetPay as Actual Paid.
function resolveActualGustoGrossPay(row) {
  const v =
    row?.actualGustoGrossPay ??
    row?.actual_gusto_gross_pay ??
    row?.actualGrossPay ??
    row?.actual_gross_pay ??
    null;
  return v;
}

// Gusto Net Pay — informational only, never used as Actual Paid or in variance
function resolveGustoNetPay(row) {
  return row?.gustoNetPay ?? row?.gusto_net_pay ?? row?.netPay ?? row?.net_pay ?? null;
}

// Expected Pay — from Dentrix Ascend charge-allocated provider collections
function resolveExpectedPay(row) {
  const v = row?.expectedPay ?? row?.expected_pay ?? null;
  return v;
}

// Variance amount — backend-computed, do not recalculate client-side
function resolveVarianceAmount(row) {
  return row?.varianceAmount ?? row?.variance_amount ?? null;
}

// Variance percent — backend-computed, do not recalculate client-side
function resolveVariancePercent(row) {
  return row?.variancePercent ?? row?.variance_percent ?? row?.variancePercentage ?? row?.variance_percentage ?? null;
}

// Dentrix Pay-Period Collections — charge-allocated collections for this pay period slice
function resolvePayPeriodCollections(row) {
  return (
    row?.payPeriodDentrixCollections ??
    row?.pay_period_dentrix_collections ??
    row?.payPeriodCollections ??
    row?.pay_period_collections ??
    row?.periodCollections ??
    row?.period_collections ??
    null
  );
}

// Monthly Tier Collections — full-month collections used for tier determination
function resolveMonthlyTierCollections(row) {
  return (
    row?.monthlyDentrixCollections ??
    row?.monthly_dentrix_collections ??
    row?.monthlyTierCollections ??
    row?.monthly_tier_collections ??
    row?.tierCollections ??
    row?.tier_collections ??
    null
  );
}

// Pay % — the tier rate or fixed percentage applied
// Phase 2B primary: compensationPercentage / compensation_percentage
function resolvePayPercent(row) {
  return (
    row?.compensationPercentage ??
    row?.compensation_percentage ??
    row?.payPercent ??
    row?.pay_percent ??
    row?.tierRate ??
    row?.tier_rate ??
    row?.compensationRate ??
    row?.compensation_rate ??
    null
  );
}

// Tier months — array of monthly tier detail objects for cross-month periods
function resolveTierMonths(row) {
  return row?.tierMonths ?? row?.tier_months ?? null;
}

// Source/notes — supports camelCase and snake_case
function resolveSourceNotes(row) {
  return row?.sourceNotes || row?.source_notes || row?.notes || '—';
}

// Office — supports camelCase and snake_case (Phase 2B: office field added)
function resolveOffice(row) {
  const raw =
    row?.office ||
    row?.officeName ||
    row?.office_name ||
    row?.officeId ||
    row?.office_id ||
    null;
  if (!raw) return '—';
  return resolveOfficeDisplay(raw);
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, className, badge }) {
  const cls = className || badge || '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

// ─── Tier Detail Row ──────────────────────────────────────────────────────────
// Expandable display for cross-month pay periods when backend returns tierMonths.
function TierDetailRow({ tierMonths, colSpan }) {
  const [open, setOpen] = useState(false);
  if (!tierMonths?.length) return null;
  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td colSpan={colSpan} className="px-4 py-1">
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
        >
          {open ? '▼' : '▶'} Tier Details ({tierMonths?.length} month{tierMonths?.length !== 1 ? 's' : ''})
        </button>
        {open && (
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs border border-blue-200 rounded-lg w-full">
              <thead>
                <tr className="bg-blue-100">
                  {['Month', 'Full-Month Collections', 'Pay-Period Slice Collections', 'Tier Rate', 'Expected Pay (Slice)']?.map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold text-blue-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tierMonths?.map((tm, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                      {tm?.month || tm?.monthLabel || '—'}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-800 whitespace-nowrap">
                      {fmtMoney(tm?.fullMonthCollections ?? tm?.full_month_collections)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-800 whitespace-nowrap">
                      {fmtMoney(tm?.payPeriodSliceCollections ?? tm?.pay_period_slice_collections ?? tm?.sliceCollections ?? tm?.slice_collections)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-800 whitespace-nowrap">
                      {fmtPct(tm?.tierRate ?? tm?.tier_rate ?? tm?.rate)}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-gray-900 whitespace-nowrap">
                      {fmtMoney(tm?.expectedPay ?? tm?.expected_pay ?? tm?.sliceExpectedPay ?? tm?.slice_expected_pay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Mapping Modal (V335 write gate preserved) ────────────────────────────────
function MappingModal({ employee, onClose, onSave }) {
  const [dentrixProviderId, setDentrixProviderId] = useState('');
  const [dentrixProviderName, setDentrixProviderName] = useState('');
  const [roleClassification, setRoleClassification] = useState('doctor');
  const [matchMethod, setMatchMethod] = useState('manual');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // V335 SAFETY GATE — crosswalk writes disabled during source-of-truth verification.
  const MAPPING_WRITES_DISABLED = true;

  const handleSave = async () => {
    if (MAPPING_WRITES_DISABLED) return;
    if (!dentrixProviderId) return;
    setSaving(true);
    try {
      const r2 = await fetch('https://api.nudashboard.com/v2/payroll/crosswalk', {
        method: 'POST',
        headers: { 'X-API-Key': 'nudashboard_prod_key', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gusto_employee_id: employee?.id,
          dentrix_provider_id: dentrixProviderId,
          dentrix_provider_name: dentrixProviderName,
          role_classification: roleClassification,
          mapping_status: 'matched',
          mapping_confidence: 'manual',
          match_method: matchMethod,
          manual_override: true,
          notes,
          mapped_at: new Date()?.toISOString(),
          created_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString(),
        }),
      });
      const crosswalk = (await r2?.json())?.data;
      if (!r2?.ok) throw new Error(crosswalk?.message || 'Crosswalk save failed');
      onSave?.();
      onClose();
    } catch (err) {
      console.error('[MappingModal] save error:', err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            Map to Dentrix Provider
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 text-base">⚠</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Crosswalk mapping writes are disabled during source-of-truth verification.</span>{' '}
              Save Mapping cannot POST to /v2/payroll/crosswalk until this gate is explicitly removed in an approved patch.
            </p>
          </div>
          <div className="bg-[#F0FAFB] border border-[#9BCBEB] rounded-xl p-4">
            <div className="text-xs font-semibold text-[#00B5CC] uppercase tracking-wider mb-1">Gusto Employee</div>
            <div className="font-bold text-gray-900">{employee?.first_name} {employee?.last_name}</div>
            <div className="text-sm text-gray-500">{employee?.email}</div>
            <div className="text-xs text-gray-400 mt-1">Hired: {fmtDate(employee?.hire_date)}</div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Dentrix Provider ID *</label>
              <input type="text" value={dentrixProviderId} onChange={e => setDentrixProviderId(e?.target?.value)}
                placeholder="Provider ID from Dentrix" disabled
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC] disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Dentrix Provider Name</label>
              <input type="text" value={dentrixProviderName} onChange={e => setDentrixProviderName(e?.target?.value)}
                placeholder="Display name" disabled
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC] disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Role</label>
                <select value={roleClassification} onChange={e => setRoleClassification(e?.target?.value)} disabled
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC] disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50">
                  <option value="doctor">Doctor</option>
                  <option value="hygienist">Hygienist</option>
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Match Method</label>
                <select value={matchMethod} onChange={e => setMatchMethod(e?.target?.value)} disabled
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC] disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50">
                  <option value="manual">Manual</option>
                  <option value="name">Name Match</option>
                  <option value="email">Email Match</option>
                  <option value="id">ID Match</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e?.target?.value)} rows={2} disabled
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC] resize-none disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button disabled title="Crosswalk mapping writes are disabled during source-of-truth verification."
              className="px-4 py-2 text-sm font-semibold bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed opacity-60">
              Save Mapping (Disabled)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Unmatched Employees Panel ────────────────────────────────────────────────
function UnmatchedEmployeesPanel({ crosswalkData, isSuperAdmin, onMapNow }) {
  const [expanded, setExpanded] = useState(false);
  const unmatched = crosswalkData?.filter(c => c?.mapping_status === 'unmatched') || [];
  if (!unmatched?.length) return null;
  return (
    <div className="bg-[#FEF9C3] border border-yellow-300 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-yellow-50 transition-colors">
        <span className="text-yellow-700 font-semibold text-sm">
          ⚠️ {unmatched?.length} unmatched employee{unmatched?.length !== 1 ? 's' : ''} — no Dentrix crosswalk mapping
        </span>
        <span className="text-yellow-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="border-t border-yellow-200 px-5 py-4 flex flex-col gap-2">
          {unmatched?.map(c => (
            <div key={c?.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
              <div>
                <div className="font-medium text-gray-800 text-sm">
                  {c?.gusto_employees?.first_name} {c?.gusto_employees?.last_name}
                </div>
                <div className="text-xs text-gray-400">{c?.gusto_employees?.email}</div>
              </div>
              {isSuperAdmin && (
                <button onClick={() => onMapNow?.(c?.gusto_employees)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#00B5CC] text-white rounded-lg hover:bg-[#0099b0] transition-colors">
                  Map Now
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payroll Comparison Table (Phase 2B) ──────────────────────────────────────
// Columns per Phase 2B spec:
//   Provider | Provider Type | Office | Pay Period |
//   Dentrix Pay-Period Collections | Monthly Tier Collections | Pay % |
//   Expected Pay | Actual Gusto Gross Pay | Gusto Net Pay (Info Only) |
//   Variance $ | Variance % | Status | Source / Notes
//
// Source labels:
//   Expected Pay           = Dentrix Ascend charge-allocated provider collections (Provider Compensation read-only)
//   Actual Gusto Gross Pay = Gusto Payroll Data Export XLSX (actualGustoGrossPay)
//   Gusto Net Pay          = Informational only — NOT used for variance
//
// Null rules:
//   null/undefined actualGustoGrossPay → N/A (not $0)
//   null/undefined expectedPay         → N/A (not $0)
//   null/undefined variance            → N/A
//   real 0 from backend                → $0.00 (only when backend returns 0)
//
// excluded / not_a_provider rows hidden unless isSuperAdmin
const TABLE_COLUMNS = [
  'Provider',
  'Provider Type',
  'Office',
  'Pay Period',
  'Dentrix Pay-Period Collections',
  'Monthly Tier Collections',
  'Pay %',
  'Expected Pay',
  'Actual Gusto Gross Pay',
  'Gusto Net Pay (Info Only)',
  'Variance $',
  'Variance %',
  'Status',
  'Source / Notes',
];

function PayrollComparisonTable({ data, loading, isSuperAdmin }) {
  if (loading) {
    return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  }

  // Filter out excluded/not_a_provider rows for non-admin users
  const visibleRows = isSuperAdmin
    ? data
    : data?.filter(row => {
        const s = resolveStatus(row)?.toLowerCase?.();
        return s !== 'excluded' && s !== 'not_a_provider';
      });

  if (!visibleRows?.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        No comparison data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {TABLE_COLUMNS?.map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
          {/* Source label sub-row */}
          <tr className="bg-blue-50 border-b border-blue-100">
            <td colSpan={7} />
            <td className="px-3 py-1 text-xs text-blue-600 italic whitespace-nowrap">
              Source: Dentrix Ascend collections (Provider Compensation)
            </td>
            <td className="px-3 py-1 text-xs text-blue-600 italic whitespace-nowrap">
              Source: Gusto Payroll Export XLSX
            </td>
            <td className="px-3 py-1 text-xs text-gray-400 italic whitespace-nowrap">
              Info only
            </td>
            <td colSpan={4} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visibleRows?.map((row, i) => {
            const status = resolveStatus(row);
            const statusCfg = getStatusConfig(status);
            const varClass = getVarianceClass(resolveVarianceAmount(row), resolveVariancePercent(row));
            const isCorrection = status === 'correction_run';
            const isOffCycle = status === 'off_cycle_review';
            const tierMonths = resolveTierMonths(row);

            // Row background: status-driven first, then alternating
            const rowBg = statusCfg?.row || (i % 2 === 0 ? 'bg-white' : 'bg-gray-50');
            const providerTypeLabel = resolveProviderType(row);

            return (
              <React.Fragment key={row?.id || i}>
                <tr className={`hover:bg-[#F0FAFB] transition-colors ${rowBg}`}>
                  {/* Provider */}
                  <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {resolveProviderDisplay(row)}
                  </td>
                  {/* Provider Type */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {providerTypeLabel !== '—' ? (
                      <Badge className={providerTypeLabel === 'Doctor' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'}>
                        {providerTypeLabel}
                      </Badge>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  {/* Office */}
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {resolveOffice(row)}
                  </td>
                  {/* Pay Period */}
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span>
                        {resolvePayPeriodStart(row)
                          ? fmtDateRange(resolvePayPeriodStart(row), resolvePayPeriodEnd(row))
                          : 'N/A'}
                      </span>
                      {isCorrection && (
                        <Badge className="bg-orange-100 text-orange-700">Correction</Badge>
                      )}
                      {isOffCycle && (
                        <Badge className="bg-purple-100 text-purple-700">Off-Cycle</Badge>
                      )}
                    </div>
                  </td>
                  {/* Dentrix Pay-Period Collections */}
                  <td className="px-3 py-3 font-mono text-gray-800 whitespace-nowrap">
                    {fmtMoney(resolvePayPeriodCollections(row))}
                  </td>
                  {/* Monthly Tier Collections */}
                  <td className="px-3 py-3 font-mono text-gray-800 whitespace-nowrap">
                    {fmtMoney(resolveMonthlyTierCollections(row))}
                  </td>
                  {/* Pay % */}
                  <td className="px-3 py-3 font-mono text-gray-700 whitespace-nowrap">
                    {fmtPayPercent(resolvePayPercent(row))}
                  </td>
                  {/* Expected Pay — Dentrix Ascend charge-allocated collections (Provider Compensation read-only) */}
                  <td className="px-3 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {fmtMoney(resolveExpectedPay(row))}
                  </td>
                  {/* Actual Gusto Gross Pay — from actualGustoGrossPay (Gusto Payroll Data Export XLSX) */}
                  <td className="px-3 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {fmtMoney(resolveActualGustoGrossPay(row))}
                  </td>
                  {/* Gusto Net Pay — informational only, not used for variance */}
                  <td className="px-3 py-3 font-mono text-gray-400 whitespace-nowrap text-xs">
                    {fmtMoney(resolveGustoNetPay(row))}
                  </td>
                  {/* Variance $ — backend-computed */}
                  <td className={`px-3 py-3 font-mono whitespace-nowrap ${varClass}`}>
                    {fmtMoney(resolveVarianceAmount(row))}
                  </td>
                  {/* Variance % — backend-computed */}
                  <td className={`px-3 py-3 font-mono whitespace-nowrap ${varClass}`}>
                    {fmtPct(resolveVariancePercent(row))}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge className={statusCfg?.badge}>{statusCfg?.label}</Badge>
                  </td>
                  {/* Source / Notes */}
                  <td className="px-3 py-3 text-gray-500 text-xs max-w-[160px]">
                    {resolveSourceNotes(row)}
                  </td>
                </tr>
                {/* Tier Detail expandable row — only when backend returns tierMonths */}
                {tierMonths?.length > 0 && (
                  <TierDetailRow tierMonths={tierMonths} colSpan={TABLE_COLUMNS?.length} />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Summary Cards (Phase 2B) ─────────────────────────────────────────────────
// Cards per spec:
//   Total Expected Pay       = sum expectedPay
//   Total Actual Gusto Gross = sum actualGustoGrossPay  (NOT gustoNetPay)
//   Total Variance           = sum varianceAmount
//   Matched / Overpaid / Underpaid / Needs Mapping counts from status
function ComparisonSummaryCards({ data }) {
  if (!data?.length) return null;

  const visibleRows = data?.filter(r => {
    const s = resolveStatus(r)?.toLowerCase?.();
    return s !== 'excluded' && s !== 'not_a_provider';
  });

  // Monetary totals — sum only rows where the value is a real number
  const totalExpectedPay = visibleRows?.reduce((sum, r) => {
    const v = parseFloat(resolveExpectedPay(r));
    return isNaN(v) ? sum : sum + v;
  }, 0);

  const totalActualGustoGross = visibleRows?.reduce((sum, r) => {
    const v = parseFloat(resolveActualGustoGrossPay(r));
    return isNaN(v) ? sum : sum + v;
  }, 0);

  const totalVariance = visibleRows?.reduce((sum, r) => {
    const v = parseFloat(resolveVarianceAmount(r));
    return isNaN(v) ? sum : sum + v;
  }, 0);

  // Status counts from backend status field
  const matchedCount = visibleRows?.filter(r => resolveStatus(r)?.toLowerCase() === 'matched')?.length;
  const overpaidCount = visibleRows?.filter(r => resolveStatus(r)?.toLowerCase() === 'overpaid')?.length;
  const underpaidCount = visibleRows?.filter(r => resolveStatus(r)?.toLowerCase() === 'underpaid')?.length;
  const needsMappingCount = visibleRows?.filter(r => resolveStatus(r)?.toLowerCase() === 'needs_mapping')?.length;

  const hasExpected = visibleRows?.some(r => resolveExpectedPay(r) !== null && resolveExpectedPay(r) !== undefined);
  const hasActual = visibleRows?.some(r => resolveActualGustoGrossPay(r) !== null && resolveActualGustoGrossPay(r) !== undefined);

  const cards = [
    {
      label: 'Total Expected Pay',
      value: hasExpected ? fmtMoney(totalExpectedPay) : 'N/A',
      sub: 'Dentrix Ascend collections',
      color: 'text-[#00B5CC]',
    },
    {
      label: 'Total Actual Gusto Gross Pay',
      value: hasActual ? fmtMoney(totalActualGustoGross) : 'N/A',
      sub: 'Gusto Payroll Export XLSX',
      color: 'text-emerald-600',
    },
    {
      label: 'Total Variance',
      value: (hasExpected || hasActual) ? fmtMoney(totalVariance) : 'N/A',
      sub: 'Actual − Expected',
      color: totalVariance < 0 ? 'text-red-600' : totalVariance > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      label: 'Matched',
      value: `${matchedCount} / ${visibleRows?.length}`,
      sub: null,
      color: 'text-emerald-600',
    },
    {
      label: 'Overpaid',
      value: overpaidCount?.toString(),
      sub: null,
      color: overpaidCount > 0 ? 'text-red-600' : 'text-gray-400',
    },
    {
      label: 'Underpaid',
      value: underpaidCount?.toString(),
      sub: null,
      color: underpaidCount > 0 ? 'text-amber-600' : 'text-gray-400',
    },
    {
      label: 'Needs Mapping',
      value: needsMappingCount?.toString(),
      sub: null,
      color: needsMappingCount > 0 ? 'text-orange-600' : 'text-gray-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards?.map((card, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{card?.label}</div>
          <div className={`text-lg font-bold ${card?.color}`}>{card?.value}</div>
          {card?.sub && <div className="text-xs text-gray-400 mt-0.5">{card?.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Comparison Root ──────────────────────────────────────────────────────────
export default function ComparisonRoot({ isSuperAdmin, isAdmin }) {
  // Phase 2B filters per spec
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    providerType: 'all',
    providerId: 'all',
    checkDate: '',
    payrollRunId: 'all',
    // Legacy
    officeId: 'all',
  });
  // Provider Name client-side filter (display name string, 'all' = no filter)
  const [selectedProviderName, setSelectedProviderName] = useState('all');
  const [mappingEmployee, setMappingEmployee] = useState(null);

  const { data, count, loading, error, page, setPage, pageSize, refetch } = useGustoComparison(filters);
  const { data: crosswalkData, refetch: refetchCrosswalk } = useGustoCrosswalk();

  // Real-time refresh
  useRealtimeSubscription(
    [
      { table: 'gusto_provider_crosswalk' },
      { table: 'gusto_comparison_results' },
    ],
    () => {
      refetchCrosswalk();
    },
    true
  );

  // Compute visibleRows using the exact same gate as PayrollComparisonTable.
  // excluded / not_a_provider rows are hidden for non-admin users.
  // CSV export MUST use this same filtered set — never raw data.
  const visibleRows = isSuperAdmin
    ? (data || [])
    : (data || [])?.filter(row => {
        const s = resolveStatus(row)?.toLowerCase?.();
        return s !== 'excluded' && s !== 'not_a_provider';
      });

  // Derive sorted provider name options from visibleRows only.
  // - Excludes excluded/not_a_provider rows (already gated above).
  // - Excludes rows that resolve to 'Unmapped' (no provider identity).
  // - Sorted alphabetically. No hardcoded names.
  const providerNameOptions = useMemo(() => {
    const names = new Set();
    (visibleRows || [])?.forEach(row => {
      const name = resolveProviderDisplay(row);
      if (name && name !== 'Unmapped') {
        names?.add(name);
      }
    });
    return Array.from(names)?.sort((a, b) => a?.localeCompare(b));
  }, [visibleRows]);

  // filteredRows = visibleRows further filtered by selected provider name.
  // This is the single source of truth for table, summary cards, and CSV.
  const filteredRows = useMemo(() => {
    if (selectedProviderName === 'all') return visibleRows;
    return visibleRows?.filter(row => resolveProviderDisplay(row) === selectedProviderName);
  }, [visibleRows, selectedProviderName]);

  // ─── CSV Export (Phase 2B) ────────────────────────────────────────────────
  // Headers match Phase 2B spec exactly.
  // Exports filteredRows only — same dataset rendered in the table.
  // null/undefined → empty string (not $0). Real 0 → 0.
  // Does not export: net pay as comparison basis, Gusto employee IDs, raw UUIDs,
  //   excluded/not_a_provider rows, Maia Dolidze (excluded at backend level).
  const handleExport = () => {
    const headers = [
      'Provider',
      'Provider Type',
      'Office',
      'Pay Period',
      'Dentrix Pay-Period Collections',
      'Monthly Tier Collections',
      'Pay %',
      'Expected Pay',
      'Actual Gusto Gross Pay',
      'Gusto Net Pay (Info Only)',
      'Variance $',
      'Variance %',
      'Status',
      'Source / Notes',
    ];
    const rows = filteredRows?.map(r => [
      resolveProviderDisplay(r),
      resolveProviderType(r),
      resolveOffice(r),
      resolvePayPeriodStart(r)
        ? `${fmtDateCSV(resolvePayPeriodStart(r))} - ${fmtDateCSV(resolvePayPeriodEnd(r))}`
        : '',
      // Raw numeric values for CSV — null/undefined → '' (not $0), 0 → 0
      resolvePayPeriodCollections(r) ?? '',
      resolveMonthlyTierCollections(r) ?? '',
      resolvePayPercent(r) ?? '',
      resolveExpectedPay(r) ?? '',
      resolveActualGustoGrossPay(r) ?? '',
      resolveGustoNetPay(r) ?? '',
      resolveVarianceAmount(r) ?? '',
      resolveVariancePercent(r) ?? '',
      resolveStatus(r) || '',
      resolveSourceNotes(r),
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`payroll_comparison_${today}.csv`, [headers, ...rows]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
            Payroll Comparison
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Read-only. Expected Pay (Dentrix Ascend) vs Actual Gusto Gross Pay (Gusto Payroll Export). No edits.
          </p>
        </div>
        <button onClick={handleExport} disabled={!filteredRows?.length}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] disabled:opacity-50 transition-colors">
          ↓ Export CSV
        </button>
      </div>

      {/* Source note — Phase 2B required wording */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
        <span className="font-semibold">Data Sources:</span>{' '}
        <span className="font-medium">Expected Pay</span> is calculated from Dentrix Ascend charge-allocated provider collections using Provider Compensation read-only logic.{' '}
        <span className="font-medium">Actual Paid</span> is imported from Gusto Payroll Data Export XLSX gross pay.{' '}
        Net pay is informational only and is not used for variance.
        Variance is computed by the backend. The frontend does not recalculate Provider Compensation.
        Missing values show <strong>N/A</strong>. Real $0 shows <strong>$0.00</strong> only when the backend returns 0.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</label>
          <input type="date" value={filters?.startDate}
            onChange={e => setFilters(f => ({ ...f, startDate: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]" />
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
          <input type="date" value={filters?.endDate}
            onChange={e => setFilters(f => ({ ...f, endDate: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]" />
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider Type</label>
          <select value={filters?.providerType}
            onChange={e => setFilters(f => ({ ...f, providerType: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
            <option value="all">All Types</option>
            <option value="doctor">Doctor</option>
            <option value="hygienist">Hygienist</option>
          </select>
        </div>
        {/* Provider Name filter — populated from live visibleRows, sorted alphabetically */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider Name</label>
          <select
            value={selectedProviderName}
            onChange={e => setSelectedProviderName(e?.target?.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
          >
            <option value="all">All Providers</option>
            {providerNameOptions?.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Check Date</label>
          <input type="date" value={filters?.checkDate}
            onChange={e => setFilters(f => ({ ...f, checkDate: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]" />
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payroll Run ID</label>
          <input type="text" value={filters?.payrollRunId === 'all' ? '' : filters?.payrollRunId}
            placeholder="All runs"
            onChange={e => setFilters(f => ({ ...f, payrollRunId: e?.target?.value || 'all' }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]" />
        </div>
        <div className="flex items-end">
          <button onClick={() => {
            setFilters({ startDate: '', endDate: '', providerType: 'all', providerId: 'all', checkDate: '', payrollRunId: 'all', officeId: 'all' });
            setSelectedProviderName('all');
          }}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors">
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Error loading comparison data: {error}
        </div>
      )}

      {/* Summary cards — driven by filteredRows so they update with provider name filter */}
      <ComparisonSummaryCards data={filteredRows} />

      {/* Payroll Comparison Table — driven by filteredRows */}
      <PayrollComparisonTable
        data={filteredRows}
        loading={loading}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Row count */}
      {!loading && data?.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          Showing {filteredRows?.length} of {count} rows
          {filters?.startDate || filters?.endDate || filters?.checkDate || selectedProviderName !== 'all' ? ' (filtered)' : ' (latest available)'}
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(count / pageSize) > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(page - 1)} disabled={page === 0}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {Math.ceil(count / pageSize)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(count / pageSize) - 1}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}

      {/* Mapping Modal */}
      {mappingEmployee && (
        <MappingModal
          employee={mappingEmployee}
          onClose={() => setMappingEmployee(null)}
          onSave={() => { refetchCrosswalk(); setMappingEmployee(null); }}
        />
      )}
    </div>
  );
}
