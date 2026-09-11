import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchAdjustmentsReview, fmtCurrency, fmtDate } from '../../../services/rcmService';

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCOUNT_WRITEOFF_CATEGORIES = new Set([
  'insurance_writeoff',
  'ppo_contractual_writeoff',
  'discount_plan',
  'in_house_discount',
  'professional_courtesy',
  'family_friend_courtesy',
  'management_discount',
  'no_charge_courtesy',
]);

const ADJUSTMENT_CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'insurance_writeoff', label: 'Insurance Write-Off' },
  { value: 'ppo_contractual_writeoff', label: 'PPO Contractual Write-Off' },
  { value: 'discount_plan', label: 'Discount Plan' },
  { value: 'in_house_discount', label: 'In-House Discount' },
  { value: 'professional_courtesy', label: 'Professional Courtesy' },
  { value: 'family_friend_courtesy', label: 'Family / Friend Courtesy' },
  { value: 'management_discount', label: 'Management Discount' },
  { value: 'no_charge_courtesy', label: 'No Charge / Courtesy' },
  { value: 'charge_adjustment', label: 'Charge Adjustment' },
  { value: 'credit_adjustment', label: 'Credit Adjustment' },
  { value: 'refund', label: 'Refund / Credit' },
  { value: 'voided', label: 'Voided / Cancelled' },
];

const REVIEW_FLAG_OPTIONS = [
  { value: '', label: 'All Flags' },
  { value: 'missing_note', label: 'Missing Note' },
  { value: 'approval_evidence_missing', label: 'Approval Evidence Missing' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'requires_manager_review', label: 'Requires Manager Review' },
  { value: 'large_adjustment', label: 'Large Adjustment' },
  { value: 'late_posted', label: 'Late-Posted' },
  { value: 'correction_review', label: 'Correction Review' },
  { value: 'unmapped_adjustment', label: 'Unmapped Adjustment' },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const EXPORT_COLUMNS = [
  { key: 'adjustment_id', label: 'Adjustment ID' },
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'office', label: 'Office' },
  { key: 'provider_name', label: 'Provider' },
  { key: 'organization_ledger_type_name', label: 'OLT Name' },
  { key: 'adjustment_category_label', label: 'Category' },
  { key: 'signed_amount', label: 'Signed Amount' },
  { key: 'financial_amount', label: 'Financial Amount' },
  { key: 'transaction_date', label: 'Transaction Date' },
  { key: 'entry_date', label: 'Entry Date' },
  { key: 'modified_date', label: 'Modified Date' },
  { key: 'days_between_transaction_and_entry', label: 'Days Tx→Entry' },
  { key: 'is_late_posted', label: 'Late Posted' },
  { key: 'online_user_name', label: 'Staff Entered By' },
  { key: 'approval_evidence_status', label: 'Approval Evidence Status' },
  { key: 'approval_evidence_source', label: 'Approval Evidence Source' },
  { key: 'review_flag_labels', label: 'Review Flags' },
  { key: 'note', label: 'Note' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
  { key: 'is_voided', label: 'Voided' },
  { key: 'is_cancelled', label: 'Cancelled' },
  { key: 'is_reversal', label: 'Reversal' },
  { key: 'previous_transaction_id', label: 'Previous Transaction ID' },
  { key: 'replaced_by_transaction_id', label: 'Replaced By Transaction ID' },
];

// ─── Summary breakdown label maps ─────────────────────────────────────────────

const ADJUSTMENT_CATEGORY_LABEL_MAP = {
  insurance_writeoff: 'Insurance Adjustment',
  ppo_contractual_writeoff: 'PPO Contractual Write-Off',
  discount_plan: 'Discount Plan',
  in_house_discount: 'In-House Discount',
  professional_courtesy: 'Professional Courtesy',
  family_friend_courtesy: 'Family / Friend Courtesy',
  management_discount: 'Management Discount',
  no_charge_courtesy: 'No Charge / Courtesy',
  charge_adjustment: 'Charge Adjustment',
  credit_adjustment: 'Credit Adjustment',
  refund: 'Refund / Credit',
  voided: 'Voided / Reversal',
  balance_correction: 'Balance Correction',
  void_or_reversal: 'Voided / Reversal',
};

const REVIEW_FLAG_LABEL_MAP = {
  missing_note: 'Missing Note',
  approval_evidence_missing: 'Approval Evidence Missing',
  needs_review: 'Needs Review',
  requires_manager_review: 'Requires Manager Review',
  large_adjustment: 'Large Adjustment',
  late_posted: 'Late-Posted',
  correction_review: 'Correction Review',
  payment_method_changed: 'Payment Method Changed',
  cash_to_non_cash_correction_review: 'Cash-to-Noncash Correction Review',
  voided_transaction_review: 'Voided Transaction Review',
  same_day_void_repost: 'Same-Day Void / Repost',
  unmapped_adjustment_type: 'Unmapped Adjustment Type',
  unmapped_adjustment: 'Unmapped Adjustment Type',
  sign_review: 'Sign Review',
  repeated_adjustment_pattern: 'Repeated Adjustment Pattern',
  adjustment_after_payment: 'Adjustment After Payment',
};

const LATE_BUCKET_LABEL_MAP = {
  same_day: 'Same Day',
  '1_day': '1 Day',
  '2_7_days': '2–7 Days',
  '8_30_days': '8–30 Days',
  '31_90_days': '31–90 Days',
  over_90_days: 'Over 90 Days',
};

// Convert a raw snake_case key to Title Case as a last-resort fallback
const toTitleCase = (str) =>
  String(str)?.replace(/_/g, ' ')?.replace(/\b\w/g, (c) => c?.toUpperCase());

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmt = (v) => {
  const n = parseFloat(v) || 0;
  if (n < 0) return <span className="text-red-600 font-medium">({fmtCurrency(Math.abs(n))})</span>;
  if (n > 0) return <span className="text-green-600 font-medium">{fmtCurrency(n)}</span>;
  return <span className="text-muted-foreground">{fmtCurrency(0)}</span>;
};

const fmtAmtVoided = (v, isVoided) => {
  if (isVoided) return <span className="text-muted-foreground line-through text-xs">{fmtCurrency(Math.abs(parseFloat(v) || 0))}</span>;
  return fmtAmt(v);
};

const FinancialAmountCell = ({ row }) => {
  const val = row?.financial_amount != null
    ? row?.financial_amount
    : row?.signed_amount != null
      ? row?.signed_amount
      : row?.amount;
  let tooltip = 'Financial amount is 0 for voided/cancelled rows; otherwise equals signed amount.';
  return (
    <span
      className="cursor-help border-b border-dotted border-muted-foreground/50"
      title={tooltip}
    >
      {fmtAmt(val)}
    </span>
  );
};

const ReviewFlagBadges = ({ flags }) => {
  const list = Array.isArray(flags) ? flags : [];
  if (!list?.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list?.map((f, i) => {
        const key = String(f)?.toLowerCase()?.replace(/[\s-]/g, '_');
        const label = REVIEW_FLAG_LABEL_MAP?.[key] || f;
        return (
          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
            {label}
          </span>
        );
      })}
    </div>
  );
};

const ApprovalEvidenceBadge = ({ status }) => {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const s = String(status)?.toLowerCase();
  if (s === 'evidence_found' || s === 'found') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 cursor-help"
        title="Dentrix does not provide an approvedBy field. Evidence is inferred from notes or entered-by context only."
      >
        <Icon name="CheckCircle" size={10} />Evidence Present
      </span>
    );
  }
  if (s === 'evidence_missing' || s === 'missing' || s === 'not_found') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 cursor-help"
        title="Dentrix does not provide an approvedBy field. Evidence is inferred from notes or entered-by context only."
      >
        <Icon name="AlertCircle" size={10} />Approval Evidence Missing
      </span>
    );
  }
  if (s === 'not_required') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 cursor-help"
        title="Dentrix does not provide an approvedBy field. Evidence is inferred from notes or entered-by context only."
      >
        <Icon name="MinusCircle" size={10} />Not Required
      </span>
    );
  }
  if (s === 'unknown') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground cursor-help"
        title="Dentrix does not provide an approvedBy field. Evidence is inferred from notes or entered-by context only."
      >
        <Icon name="HelpCircle" size={10} />Unknown
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground cursor-help"
      title="Dentrix does not provide an approvedBy field. Evidence is inferred from notes or entered-by context only."
    >
      {status}
    </span>
  );
};

const SkeletonRow = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols })?.map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
    ))}
  </tr>
);

const SummaryStatCard = ({ label, amount, count, colorClass = 'text-foreground' }) => (
  <div className="bg-card border border-border rounded-lg p-3">
    <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
    <p className={`text-sm font-bold ${colorClass}`}>{fmtCurrency(amount || 0)}</p>
    {count != null && <p className="text-xs text-muted-foreground">{(count || 0)?.toLocaleString()} records</p>}
  </div>
);

const ReviewCountCard = ({ label, count, icon = 'AlertCircle', colorClass = 'text-amber-600' }) => (
  <div className="bg-card border border-border rounded-lg p-3 flex items-start gap-2">
    <Icon name={icon} size={16} className={`mt-0.5 flex-shrink-0 ${colorClass}`} />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${colorClass}`}>{(count || 0)?.toLocaleString()}</p>
    </div>
  </div>
);

const BreakdownTable = ({ title, data, keyField = 'key', labelField = 'label', countField = 'count', amountField = 'amount' }) => {
  if (!data || !Array.isArray(data) || data?.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {data?.map((item, i) => (
          <div key={item?.[keyField] || i} className="flex items-center justify-between text-xs">
            <span className="text-foreground truncate max-w-[60%]">{item?.[labelField] || item?.[keyField] || '—'}</span>
            <div className="flex items-center gap-3 text-right">
              {item?.[countField] != null && <span className="text-muted-foreground">{Number(item?.[countField])?.toLocaleString()}</span>}
              {item?.[amountField] != null && <span className="font-medium text-foreground">{fmtCurrency(item?.[amountField])}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Normalize object-shaped breakdown fields to array (same pattern as POS Collections)
const normalizeBreakdown = (value, keyField = 'key') => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.entries(value)?.map(([k, v]) => {
      if (typeof v === 'object' && v !== null) return { [keyField]: k, label: k, ...v };
      return { [keyField]: k, label: k, count: v };
    });
  }
  return [];
};

// ─── Sub-panels ───────────────────────────────────────────────────────────────

const AdjustmentSummaryPanel = ({ summary }) => {
  // Normalize raw breakdown arrays/objects
  const rawByCategory = normalizeBreakdown(summary?.by_adjustment_category, 'key');
  const rawByOlt = normalizeBreakdown(summary?.by_organization_ledger_type, 'key');
  const rawByOffice = normalizeBreakdown(summary?.by_office, 'key');
  const rawByUser = normalizeBreakdown(summary?.by_online_user, 'key');
  const rawByFlag = normalizeBreakdown(summary?.by_review_flag, 'key');
  const rawByLateBucket = normalizeBreakdown(summary?.by_late_posted_bucket, 'key');

  // Enrich each breakdown with a human-readable display_label
  const byCategory = rawByCategory?.map(item => ({
    ...item,
    display_label:
      item?.label && item?.label !== item?.key
        ? item?.label
        : item?.adjustment_category_label
        || ADJUSTMENT_CATEGORY_LABEL_MAP?.[item?.key]
        || toTitleCase(item?.key || ''),
  }));

  const byOlt = rawByOlt?.map(item => ({
    ...item,
    display_label:
      item?.organization_ledger_type_name
      || item?.name
      || (item?.label && item?.label !== item?.key ? item?.label : null)
      || (item?.key ? toTitleCase(item?.key) : '—'),
  }));

  const byOffice = rawByOffice?.map(item => ({
    ...item,
    display_label:
      item?.office
      || item?.office_name
      || item?.name
      || (item?.label && item?.label !== item?.key ? item?.label : null)
      || (item?.key ? toTitleCase(item?.key) : '—'),
  }));

  const byUser = rawByUser?.map(item => ({
    ...item,
    display_label:
      item?.online_user_name
      || item?.name
      || (item?.label && item?.label !== item?.key ? item?.label : null)
      || item?.key
      || 'Unknown Staff',
  }));

  const byFlag = rawByFlag?.map(item => ({
    ...item,
    display_label:
      REVIEW_FLAG_LABEL_MAP?.[item?.key]
      || (item?.label && item?.label !== item?.key ? item?.label : null)
      || toTitleCase(item?.key || ''),
  }));

  const byLateBucket = rawByLateBucket?.map(item => ({
    ...item,
    display_label:
      LATE_BUCKET_LABEL_MAP?.[item?.key]
      || (item?.label && item?.label !== item?.key ? item?.label : null)
      || toTitleCase(item?.key || ''),
  }));

  return (
    <div className="space-y-5">
      {/* Top Amount Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Adjustment Totals</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryStatCard
            label="Total Adjustments"
            amount={summary?.total_adjustments_amount}
            count={summary?.total_adjustments_count}
            colorClass={summary?.total_adjustments_amount < 0 ? 'text-red-600' : 'text-foreground'}
          />
          <SummaryStatCard label="Write-Offs" amount={summary?.writeoff_amount} count={summary?.writeoff_count} colorClass="text-red-600" />
          <SummaryStatCard label="Discounts" amount={summary?.discount_amount} count={summary?.discount_count} colorClass="text-blue-600" />
          <SummaryStatCard label="Charge Adjustments" amount={summary?.charge_adjustment_amount} count={summary?.charge_adjustment_count} colorClass="text-orange-600" />
          <SummaryStatCard label="Refunds / Credits" amount={summary?.refund_amount} count={summary?.refund_count} colorClass="text-green-600" />
          <SummaryStatCard label="Voided / Cancelled" amount={summary?.voided_amount} count={summary?.voided_count} colorClass="text-muted-foreground" />
        </div>
      </div>

      {/* Review Count Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Operational Review Indicators</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <ReviewCountCard label="Missing Notes" count={summary?.missing_note_count} icon="FileX" />
          <ReviewCountCard label="Approval Evidence Missing" count={summary?.approval_evidence_missing_count} icon="ShieldAlert" />
          <ReviewCountCard label="Needs Review" count={summary?.needs_review_count} icon="Eye" />
          <ReviewCountCard label="Requires Manager Review" count={summary?.requires_manager_review_count} icon="UserCheck" colorClass="text-red-600" />
          <ReviewCountCard label="Large Adjustments" count={summary?.large_adjustment_count} icon="TrendingDown" colorClass="text-orange-600" />
          <ReviewCountCard label="Late-Posted" count={summary?.late_posted_count} icon="Clock" colorClass="text-yellow-600" />
          <ReviewCountCard label="Payment Method Reviews" count={summary?.payment_method_review_count} icon="CreditCard" colorClass="text-blue-600" />
          <ReviewCountCard label="Voided Tx Reviews" count={summary?.voided_transaction_review_count} icon="RotateCcw" colorClass="text-purple-600" />
        </div>
      </div>

      {/* Breakdowns */}
      <div>
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-muted/50 border border-border rounded-lg">
          <Icon name="Info" size={13} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Summary breakdowns are calculated from the full selected date range, not the current table page.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <BreakdownTable title="By Adjustment Category" data={byCategory} labelField="display_label" />
          <BreakdownTable title="By OLT Type" data={byOlt} labelField="display_label" />
          <BreakdownTable title="By Office" data={byOffice} labelField="display_label" />
          <BreakdownTable title="By Staff Entered By" data={byUser} labelField="display_label" />
          <BreakdownTable title="By Review Flag" data={byFlag} labelField="display_label" />
          <BreakdownTable title="By Late-Posted Bucket" data={byLateBucket} labelField="display_label" />
        </div>
      </div>
    </div>
  );
};

// ─── Discount / Write-Off Review — export columns ─────────────────────────────
const DW_EXPORT_COLUMNS = [
  { key: 'adjustment_id', label: 'Adjustment ID' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'office', label: 'Office' },
  { key: 'provider_name', label: 'Provider' },
  { key: 'adjustment_category_label', label: 'Category' },
  { key: 'organization_ledger_type_name', label: 'OLT Name' },
  { key: 'signed_amount', label: 'Signed Amount' },
  { key: 'financial_amount', label: 'Financial Amount' },
  { key: 'transaction_date', label: 'Transaction Date' },
  { key: 'entry_date', label: 'Entry Date' },
  { key: 'days_between_transaction_and_entry', label: 'Days Tx→Entry' },
  { key: 'is_late_posted', label: 'Late Posted' },
  { key: 'online_user_name', label: 'Staff Entered By' },
  { key: 'documentation_status', label: 'Documentation Status' },
  { key: 'approval_evidence_status', label: 'Approval Evidence Status' },
  { key: 'review_priority', label: 'Review Priority' },
  { key: 'review_reason', label: 'Review Reason' },
  { key: 'review_flag_labels', label: 'Review Flags' },
  { key: 'note', label: 'Note' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
  { key: 'is_voided', label: 'Voided' },
  { key: 'previous_transaction_id', label: 'Previous Transaction ID' },
  { key: 'replaced_by_transaction_id', label: 'Replaced By Transaction ID' },
];

const exportDwQueueCsv = (items) => {
  const headers = DW_EXPORT_COLUMNS?.map(c => c?.label)?.join(',');
  const rowsCsv = items?.map(item =>
    DW_EXPORT_COLUMNS?.map(c => {
      let v = item?.[c?.key];
      if (c?.key === 'review_flag_labels') {
        const flags = item?.review_flag_labels || item?.review_flags || [];
        v = Array.isArray(flags) ? flags?.join('; ') : (flags || '');
      }
      if (v == null) return '';
      const s = String(v)?.replace(/"/g, '""');
      return s?.includes(',') || s?.includes('"') || s?.includes('\n') ? `"${s}"` : s;
    })?.join(',')
  )?.join('\n');
  const csv = `${headers}\n${rowsCsv}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `discount_writeoff_review.csv`;
  a?.click();
  URL.revokeObjectURL(url);
};

// ─── Documentation Status Badge ───────────────────────────────────────────────
const DOC_STATUS_LABEL_MAP = {
  complete: 'Complete',
  missing_note: 'Missing Note',
  approval_evidence_missing: 'Approval Evidence Missing',
  review_recommended: 'Review Recommended',
};

const DOC_STATUS_COLOR_MAP = {
  complete: 'bg-green-100 text-green-700 border-green-200',
  missing_note: 'bg-slate-100 text-slate-600 border-slate-200',
  approval_evidence_missing: 'bg-amber-50 text-amber-700 border-amber-200',
  review_recommended: 'bg-blue-50 text-blue-600 border-blue-200',
};

const DocStatusBadge = ({ status }) => {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const key = String(status)?.toLowerCase();
  const label = DOC_STATUS_LABEL_MAP?.[key] || String(status)?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase());
  const colorCls = DOC_STATUS_COLOR_MAP?.[key] || 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorCls}`}>
      {label}
    </span>
  );
};

// ─── Review Priority Badge ─────────────────────────────────────────────────────
const PRIORITY_COLOR_MAP = {
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ReviewPriorityBadge = ({ priority }) => {
  if (!priority) return <span className="text-muted-foreground text-xs">—</span>;
  const key = String(priority)?.toLowerCase();
  const label = key?.charAt(0)?.toUpperCase() + key?.slice(1);
  const colorCls = PRIORITY_COLOR_MAP?.[key] || 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorCls}`}>
      {label}
    </span>
  );
};

// ─── Discount / Write-Off Review Panel ────────────────────────────────────────
const DiscountWriteOffPanel = ({ queue, summary }) => {
  const items = Array.isArray(queue) ? queue : [];

  // Panel count: prefer summary.discount_writeoff_review_count, fallback to _queue_counts_full_scope
  const fullScopeCount =
    summary?.discount_writeoff_review_count ??
    summary?.review_queues?._queue_counts_full_scope?.discount_writeoff_reviews ??
    null;

  const isCapped = fullScopeCount != null && fullScopeCount > items?.length;

  // Client-side filter state
  const [search, setSearch] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDocStatus, setFilterDocStatus] = useState('');
  const [filterFlag, setFilterFlag] = useState('');

  // Derive unique filter options from queue
  const officeOptions = [...new Set(items?.map(r => r?.office)?.filter(Boolean))]?.sort();
  const categoryOptions = [...new Set(items?.map(r => r?.adjustment_category_label)?.filter(Boolean))]?.sort();
  const priorityOptions = [...new Set(items?.map(r => r?.review_priority)?.filter(Boolean))]?.sort();
  const docStatusOptions = [...new Set(items?.map(r => r?.documentation_status)?.filter(Boolean))]?.sort();

  // Apply client-side filters (does NOT affect backend summary counts)
  const filtered = items?.filter(r => {
    const searchLower = search?.toLowerCase();
    if (searchLower && !(
      r?.patient_name?.toLowerCase()?.includes(searchLower) ||
      r?.office?.toLowerCase()?.includes(searchLower) ||
      r?.online_user_name?.toLowerCase()?.includes(searchLower) ||
      r?.adjustment_category_label?.toLowerCase()?.includes(searchLower)
    )) return false;
    if (filterPatient && !r?.patient_name?.toLowerCase()?.includes(filterPatient?.toLowerCase())) return false;
    if (filterOffice && r?.office !== filterOffice) return false;
    if (filterStaff && !r?.online_user_name?.toLowerCase()?.includes(filterStaff?.toLowerCase())) return false;
    if (filterCategory && r?.adjustment_category_label !== filterCategory) return false;
    if (filterPriority && String(r?.review_priority)?.toLowerCase() !== filterPriority?.toLowerCase()) return false;
    if (filterDocStatus && r?.documentation_status !== filterDocStatus) return false;
    if (filterFlag) {
      const flags = r?.review_flag_labels || r?.review_flags || [];
      const flagKeys = Array.isArray(flags) ? flags?.map(f => String(f)?.toLowerCase()?.replace(/[\s-]/g, '_')) : [];
      if (!flagKeys?.includes(filterFlag)) return false;
    }
    return true;
  });

  const hasFilters = search || filterPatient || filterOffice || filterStaff || filterCategory || filterPriority || filterDocStatus || filterFlag;

  const clearFilters = () => {
    setSearch('');
    setFilterPatient('');
    setFilterOffice('');
    setFilterStaff('');
    setFilterCategory('');
    setFilterPriority('');
    setFilterDocStatus('');
    setFilterFlag('');
  };

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">Discount / Write-Off Review</h3>
            {/* Count badge */}
            {fullScopeCount != null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                {isCapped
                  ? `Showing ${items?.length} of ${fullScopeCount?.toLocaleString()} review items`
                  : `${fullScopeCount?.toLocaleString()} review items`}
              </span>
            )}
            {fullScopeCount == null && items?.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                {items?.length} items
              </span>
            )}
          </div>
          {/* Full-scope note */}
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            This review queue is calculated from the full selected date range, not the current table page. It is capped at 200 items and sorted by review priority.
          </p>
        </div>
        {/* Export button */}
        {filtered?.length > 0 && (
          <button
            onClick={() => exportDwQueueCsv(filtered)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted flex-shrink-0"
          >
            <Icon name="Download" size={13} />Export Discount / Write-Off Review
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient, office, staff, category…"
              value={search}
              onChange={e => setSearch(e?.target?.value)}
              className="pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-56"
            />
          </div>
          {/* Office filter */}
          <select
            value={filterOffice}
            onChange={e => setFilterOffice(e?.target?.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Offices</option>
            {officeOptions?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e?.target?.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {categoryOptions?.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Review Priority filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e?.target?.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Priorities</option>
            {priorityOptions?.map(p => <option key={p} value={p}>{p?.charAt(0)?.toUpperCase() + p?.slice(1)}</option>)}
          </select>
          {/* Documentation Status filter */}
          <select
            value={filterDocStatus}
            onChange={e => setFilterDocStatus(e?.target?.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Doc Statuses</option>
            {docStatusOptions?.map(s => (
              <option key={s} value={s}>
                {DOC_STATUS_LABEL_MAP?.[s] || s?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase())}
              </option>
            ))}
          </select>
          {/* Review Flag filter */}
          <select
            value={filterFlag}
            onChange={e => setFilterFlag(e?.target?.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Flags</option>
            {Object.entries(REVIEW_FLAG_LABEL_MAP)?.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted"
            >
              <Icon name="X" size={11} />Clear
            </button>
          )}
        </div>
        {hasFilters && (
          <p className="text-[10px] text-muted-foreground">
            Showing {filtered?.length} of {items?.length} queue items — client-side filter only, does not affect summary counts
          </p>
        )}
      </div>

      {/* Empty state */}
      {items?.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">
          No discount / write-off review items in queue
        </div>
      ) : filtered?.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">
          No items match the selected filters
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                {[
                  'Patient',
                  'Office',
                  'Category',
                  'OLT Name',
                  'Signed Amount',
                  'Transaction Date',
                  'Entry Date',
                  'Staff Entered By',
                  'Documentation Status',
                  'Review Priority',
                  'Review Reason',
                  'Review Flags',
                  'Note / Reason',
                ]?.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered?.map((row, i) => {
                const signedAmt = row?.signed_amount != null ? row?.signed_amount : row?.amount;
                const note = row?.note || row?.reason;
                const reviewFlags = row?.review_flag_labels || row?.review_flags || [];
                // Map raw flag keys to human labels using REVIEW_FLAG_LABEL_MAP
                const mappedFlags = Array.isArray(reviewFlags)
                  ? reviewFlags?.map(f => {
                      const key = String(f)?.toLowerCase()?.replace(/[\s-]/g, '_');
                      return REVIEW_FLAG_LABEL_MAP?.[key] || f;
                    })
                  : [];

                return (
                  <tr key={row?.id || row?.adjustment_id || i} className="hover:bg-muted/40">
                    {/* Patient */}
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {row?.patient_name || '—'}
                    </td>
                    {/* Office */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {row?.office || '—'}
                    </td>
                    {/* Category */}
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-100">
                        {row?.adjustment_category_label || '—'}
                      </span>
                    </td>
                    {/* OLT Name */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {row?.organization_ledger_type_name || '—'}
                    </td>
                    {/* Signed Amount */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtAmt(signedAmt)}
                    </td>
                    {/* Transaction Date */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(row?.transaction_date) || '—'}
                    </td>
                    {/* Entry Date */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(row?.entry_date) || '—'}
                    </td>
                    {/* Staff Entered By */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {row?.online_user_name || '—'}
                    </td>
                    {/* Documentation Status */}
                    <td className="px-3 py-2">
                      <DocStatusBadge status={row?.documentation_status} />
                    </td>
                    {/* Review Priority */}
                    <td className="px-3 py-2">
                      <ReviewPriorityBadge priority={row?.review_priority} />
                    </td>
                    {/* Review Reason */}
                    <td
                      className="px-3 py-2 text-muted-foreground max-w-[160px] truncate"
                      title={row?.review_reason || undefined}
                    >
                      {row?.review_reason || '—'}
                    </td>
                    {/* Review Flags */}
                    <td className="px-3 py-2">
                      {mappedFlags?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mappedFlags?.map((f, fi) => (
                            <span key={fi} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {/* Note / Reason */}
                    <td className="px-3 py-2 max-w-[180px]">
                      {note ? (
                        <span
                          className="text-muted-foreground truncate block max-w-[160px] cursor-help"
                          title={note}
                        >
                          {note?.length > 55 ? `${note?.slice(0, 55)}…` : note}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          No note found
                          {(row?.documentation_status === 'missing_note' || (Array.isArray(row?.review_flag_labels) && row?.review_flag_labels?.some(f => String(f)?.toLowerCase()?.replace(/[\s-]/g, '_') === 'missing_note'))) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-slate-100 text-slate-600 border-slate-200 ml-1">
                              Missing Note
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Voided Transaction Type Labels ───────────────────────────────────────────
const VOID_TYPE_LABEL_MAP = {
  reversal_chain: 'Reversal Chain',
  voided_inactive: 'Voided / Inactive',
  cancellation_patientcreditadjustment: 'Patient Credit Adjustment Cancellation',
  cancellation_patientchargeadjustment: 'Patient Charge Adjustment Cancellation',
};

const fmtVoidType = (raw) => {
  if (!raw) return 'Other Review Type';
  const mapped = VOID_TYPE_LABEL_MAP?.[raw];
  if (mapped) return mapped;
  // title-case fallback
  return String(raw)?.replace(/_/g, ' ')?.replace(/\b\w/g, (c) => c?.toUpperCase());
};

// ─── Void/Reversal Date Cell with source tooltip and fallback chain ────────────
const VoidDateCell = ({ item }) => {
  // Fallback chain per V409 spec:
  // 1. void_or_reversal_date (snake_case — primary backend key)
  // 2. voidOrReversalDate   (camelCase variant)
  // 3. modified_date        (snake_case — show ~approx tooltip)
  // 4. modifiedDate         (camelCase variant — show ~approx tooltip)
  // 5. entry_date           (last resort — show fallback tooltip)
  let date = null;
  let tooltip = null;
  let approxBadge = false;

  const src = item?.void_or_reversal_date_source;

  if (item?.void_or_reversal_date != null && item?.void_or_reversal_date !== '') {
    date = item?.void_or_reversal_date;
    tooltip = src === 'void_or_reversal_date' ? 'Source: void/reversal date' : null;
  } else if (item?.voidOrReversalDate != null && item?.voidOrReversalDate !== '') {
    date = item?.voidOrReversalDate;
    tooltip = 'Source: void/reversal date';
  } else if (item?.modified_date != null && item?.modified_date !== '') {
    date = item?.modified_date;
    tooltip = 'Approximate date based on modifiedDate';
    approxBadge = true;
  } else if (item?.modifiedDate != null && item?.modifiedDate !== '') {
    date = item?.modifiedDate;
    tooltip = 'Approximate date based on modifiedDate';
    approxBadge = true;
  } else if (item?.entry_date != null && item?.entry_date !== '') {
    date = item?.entry_date;
    tooltip = 'Fallback date based on entryDate — void/reversal date unavailable';
    approxBadge = true;
  }

  // Also honour modified_date_approximate source flag from backend
  if (src === 'modified_date_approximate') {
    tooltip = 'Approximate date based on modifiedDate';
    approxBadge = true;
  }

  if (!date) return <span className="text-muted-foreground">—</span>;

  return (
    <span
      className={`whitespace-nowrap ${tooltip ? 'cursor-help underline decoration-dotted decoration-muted-foreground' : ''}`}
      title={tooltip || undefined}
    >
      {fmtDate(date)}
      {approxBadge && (
        <span className="ml-1 text-[9px] text-amber-600 font-medium">~approx</span>
      )}
    </span>
  );
};

// ─── Chain Context Tooltip ─────────────────────────────────────────────────────
const ChainContextTooltip = ({ item }) => {
  const [open, setOpen] = React.useState(false);
  const hasPrev = item?.previous_transaction_id || item?.previous_transaction_type || item?.previous_transaction_amount || item?.previous_transaction_date;
  const hasReplacement = item?.replaced_by_transaction_id || item?.replacement_transaction_type || item?.replacement_transaction_amount || item?.replacement_transaction_date;
  const hasChain = hasPrev || hasReplacement || item?.organization_ledger_type_name || item?.correction_source;
  if (!hasChain) return <span className="text-muted-foreground text-xs">—</span>;

  const differentUser =
    item?.previous_online_user_name &&
    item?.online_user_name &&
    item?.previous_online_user_name !== item?.online_user_name;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
        title="View chain context"
      >
        <Icon name="Link" size={10} />
        Chain
      </button>
      {open && (
        <div
          className="absolute z-50 left-0 top-6 w-72 bg-card border border-border rounded-lg shadow-lg p-3 text-xs space-y-2"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-1">Chain Context</p>

          {differentUser && (
            <div className="flex items-start gap-1.5 p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px]">
              <Icon name="Info" size={10} className="mt-0.5 flex-shrink-0" />
              <span>Linked transaction entered by different user</span>
            </div>
          )}

          {hasPrev && (
            <div className="space-y-0.5">
              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">Previous Transaction</p>
              {item?.previous_transaction_id && <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-[10px] text-foreground">{item?.previous_transaction_id}</span></div>}
              {item?.previous_transaction_type && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{item?.previous_transaction_type}</span></div>}
              {item?.previous_transaction_amount != null && <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-foreground">{fmtCurrency(item?.previous_transaction_amount)}</span></div>}
              {item?.previous_transaction_date && <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="text-foreground">{fmtDate(item?.previous_transaction_date)}</span></div>}
              {item?.previous_online_user_name && <div className="flex justify-between"><span className="text-muted-foreground">Entered By</span><span className="text-foreground">{item?.previous_online_user_name}</span></div>}
            </div>
          )}

          {hasReplacement && (
            <div className="space-y-0.5">
              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[9px]">Replacement Transaction</p>
              {item?.replaced_by_transaction_id && <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-[10px] text-foreground">{item?.replaced_by_transaction_id}</span></div>}
              {item?.replacement_transaction_type && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{item?.replacement_transaction_type}</span></div>}
              {item?.replacement_transaction_amount != null && <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-foreground">{fmtCurrency(item?.replacement_transaction_amount)}</span></div>}
              {item?.replacement_transaction_date && <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="text-foreground">{fmtDate(item?.replacement_transaction_date)}</span></div>}
              {item?.replacement_online_user_name && <div className="flex justify-between"><span className="text-muted-foreground">Entered By</span><span className="text-foreground">{item?.replacement_online_user_name}</span></div>}
            </div>
          )}

          {(item?.organization_ledger_type_name || item?.correction_source) && (
            <div className="space-y-0.5 border-t border-border pt-1.5">
              {item?.organization_ledger_type_name && <div className="flex justify-between"><span className="text-muted-foreground">OLT Name</span><span className="text-foreground">{item?.organization_ledger_type_name}</span></div>}
              {item?.correction_source && <div className="flex justify-between"><span className="text-muted-foreground">Correction Source</span><span className="text-foreground">{item?.correction_source}</span></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const VoidedTransactionPanel = ({ queue }) => {
  const items = Array.isArray(queue) ? queue : [];
  if (items?.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Voided Transaction Review</h3>
        <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">No voided transaction review items in queue</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Voided Transaction Review</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          These rows represent voided or cancelled transactions that may warrant operational review. Queue capped at 200 items.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs min-w-[1200px]">
          <thead className="bg-muted border-b border-border">
            <tr>
              {[
                'Patient',
                'Office',
                'Signed Amount',
                'Transaction Date',
                'Entry Date',
                'Void / Reversal Date',
                'Type',
                'Category',
                'Entered By',
                'Confidence',
                'Review Reason',
                'Chain',
              ]?.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items?.map((item, i) => {
              // Signed amount: prefer signed_amount, fallback to amount
              const signedAmt = item?.signed_amount != null ? item?.signed_amount : item?.amount;
              return (
                <tr key={item?.id || i} className="hover:bg-muted/40">
                  {/* Patient */}
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    {item?.patient_name || '—'}
                  </td>
                  {/* Office */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {item?.office || '—'}
                  </td>
                  {/* Signed Amount */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fmtAmt(signedAmt)}
                  </td>
                  {/* Transaction Date */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtDate(item?.transaction_date)}
                  </td>
                  {/* Entry Date */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtDate(item?.entry_date) || '—'}
                  </td>
                  {/* Void / Reversal Date with source tooltip */}
                  <td className="px-3 py-2">
                    <VoidDateCell item={item} />
                  </td>
                  {/* Type — human-readable */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                      {fmtVoidType(item?.void_or_reversal_type)}
                    </span>
                  </td>
                  {/* Category */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {item?.adjustment_category_label || '—'}
                  </td>
                  {/* Entered By */}
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                    {item?.online_user_name || '—'}
                  </td>
                  {/* Confidence */}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                      {item?.confidence || '—'}
                    </span>
                  </td>
                  {/* Review Reason */}
                  <td
                    className="px-3 py-2 text-muted-foreground max-w-[180px] truncate"
                    title={item?.review_reason || undefined}
                  >
                    {item?.review_reason || '—'}
                  </td>
                  {/* Chain Context */}
                  <td className="px-3 py-2">
                    <ChainContextTooltip item={item} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PaymentMethodReviewPanel = ({ queue }) => {
  const items = Array.isArray(queue) ? queue : [];

  // Channel badge helper
  const ChannelBadge = ({ channel }) => {
    if (!channel) return null;
    const colorMap = {
      'pos terminal': 'bg-violet-100 text-violet-700 border-violet-200',
      'auto-posted': 'bg-sky-100 text-sky-700 border-sky-200',
      'manual': 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const key = String(channel)?.toLowerCase();
    const cls = colorMap?.[key] || 'bg-gray-100 text-gray-600 border-gray-200';
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${cls} mt-0.5`}>
        {channel}
      </span>
    );
  };

  // Method cell: label (with group fallback) + channel badge as subtext
  const MethodCell = ({ label, group, channel }) => {
    const display = label || group || '—';
    return (
      <div className="flex flex-col gap-0.5">
        <span className={display === '—' ? 'text-muted-foreground' : 'text-foreground font-medium'}>{display}</span>
        <ChannelBadge channel={channel} />
      </div>
    );
  };

  // Transaction ID tooltip cell
  const TxIdTooltip = ({ ids }) => {
    const present = ids?.filter(({ val }) => val);
    if (!present?.length) return <span className="text-muted-foreground text-xs">—</span>;
    const tip = present?.map(({ label, val }) => `${label}: ${val}`)?.join('\n');
    return (
      <span
        className="inline-flex items-center gap-1 cursor-help text-xs text-blue-600 underline decoration-dotted"
        title={tip}
      >
        <Icon name="Hash" size={11} />
        {present?.length}ID{present?.length > 1 ? 's' : ''}
      </span>
    );
  };

  if (items?.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Payment Method Review</h3>
        <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">No payment method review items in queue</div>
      </div>
    );
  }

  const COLS = [
    'Patient',
    'Office',
    'Original Method',
    'Replacement Method',
    'Original Amount',
    'Replacement Amount',
    'Original Date',
    'Correction Date',
    'Original Staff',
    'Replacement Staff',
    'Correction Entered By',
    'Confidence',
    'Source / Reason',
    'Transaction IDs',
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Payment Method Review</h3>
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mt-1">
          <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0" />
          <span>These rows may represent corrections or reposting activity and should be reviewed with deposit/payment records.</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs min-w-[1400px]">
          <thead className="bg-muted border-b border-border">
            <tr>
              {COLS?.map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items?.map((item, i) => {
              // Method labels — use label first, fall back to group
              const origLabel = item?.original_payment_method_label || item?.originalPaymentMethodLabel || item?.original_method || item?.originalMethod || null;
              const origGroup = item?.original_payment_method_group || item?.originalPaymentMethodGroup || null;
              const replLabel = item?.replacement_payment_method_label || item?.replacementPaymentMethodLabel || item?.replacement_method || item?.replacementMethod || null;
              const replGroup = item?.replacement_payment_method_group || item?.replacementPaymentMethodGroup || null;

              // Channels
              const origChannel = item?.original_payment_channel || item?.originalPaymentChannel || null;
              const replChannel = item?.replacement_payment_channel || item?.replacementPaymentChannel || null;

              // Staff
              const origStaff = item?.original_online_user_name || item?.originalOnlineUserName || item?.original_staff || null;
              const replStaff = item?.replacement_online_user_name || item?.replacementOnlineUserName || item?.replacement_staff || null;
              const correctionBy = item?.correction_entered_by_user_name || item?.correctionEnteredByUserName || item?.correction_entered_by || null;

              // Dates
              const origDate = item?.original_transaction_date || item?.originalTransactionDate || item?.transaction_date || item?.transactionDate || null;
              const corrDate = item?.replacement_transaction_date || item?.replacementTransactionDate || item?.correction_date || item?.correctionDate || null;

              // Source / Reason
              const corrSource = item?.correction_source || item?.correctionSource || null;
              const reviewReason = item?.review_reason || item?.reviewReason || null;
              const sourceReason = [corrSource, reviewReason]?.filter(Boolean)?.join(' · ') || '—';

              // Transaction IDs for tooltip
              const txIds = [
                { label: 'Original Tx', val: item?.original_transaction_id || item?.originalTransactionId },
                { label: 'Replacement Tx', val: item?.replacement_transaction_id || item?.replacementTransactionId },
                { label: 'Previous Tx', val: item?.previous_transaction_id || item?.previousTransactionId },
                { label: 'Replaced By Tx', val: item?.replaced_by_transaction_id || item?.replacedByTransactionId },
              ];

              return (
                <tr key={item?.id || i} className="hover:bg-muted/40">
                  {/* Patient */}
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                    {item?.patient_name || item?.patientName || '—'}
                  </td>
                  {/* Office */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {item?.office || item?.office_name || item?.officeName || '—'}
                  </td>
                  {/* Original Method */}
                  <td className="px-3 py-2">
                    <MethodCell label={origLabel} group={origGroup} channel={origChannel} />
                  </td>
                  {/* Replacement Method */}
                  <td className="px-3 py-2">
                    <MethodCell label={replLabel} group={replGroup} channel={replChannel} />
                  </td>
                  {/* Original Amount */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fmtAmt(item?.original_amount ?? item?.originalAmount)}
                  </td>
                  {/* Replacement Amount */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {fmtAmt(item?.replacement_amount ?? item?.replacementAmount)}
                  </td>
                  {/* Original Date */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtDate(origDate) || '—'}
                  </td>
                  {/* Correction Date */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {fmtDate(corrDate) || '—'}
                  </td>
                  {/* Original Staff */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {origStaff || '—'}
                  </td>
                  {/* Replacement Staff */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {replStaff || '—'}
                  </td>
                  {/* Correction Entered By */}
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {correctionBy || '—'}
                  </td>
                  {/* Confidence */}
                  <td className="px-3 py-2">
                    {item?.confidence
                      ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border">{item?.confidence}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  {/* Source / Reason */}
                  <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate" title={sourceReason}>
                    {sourceReason}
                  </td>
                  {/* Transaction IDs (tooltip) */}
                  <td className="px-3 py-2">
                    <TxIdTooltip ids={txIds} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Neutral flag label map ────────────────────────────────────────────────────
const FLAG_LABEL_MAP = {
  missing_note: 'Missing Note',
  approval_evidence_missing: 'Approval Evidence Missing',
  needs_review: 'Needs Review',
  requires_manager_review: 'Requires Manager Review',
  large_adjustment: 'Large Adjustment',
  late_posted: 'Late-Posted',
  correction_review: 'Correction Review',
  unmapped_adjustment_type: 'Unmapped Adjustment Type',
  unmapped_adjustment: 'Unmapped Adjustment Type',
};

const FLAG_COLOR_MAP = {
  missing_note: 'bg-slate-100 text-slate-600 border-slate-200',
  approval_evidence_missing: 'bg-amber-50 text-amber-700 border-amber-200',
  needs_review: 'bg-blue-50 text-blue-600 border-blue-200',
  requires_manager_review: 'bg-orange-50 text-orange-600 border-orange-200',
  large_adjustment: 'bg-purple-50 text-purple-600 border-purple-200',
  late_posted: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  correction_review: 'bg-teal-50 text-teal-600 border-teal-200',
  unmapped_adjustment_type: 'bg-gray-100 text-gray-600 border-gray-200',
  unmapped_adjustment: 'bg-gray-100 text-gray-600 border-gray-200',
};

const NeutralFlagBadges = ({ flags }) => {
  const list = Array.isArray(flags) ? flags : [];
  if (!list?.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list?.map((f, i) => {
        const key = String(f)?.toLowerCase()?.replace(/[\s-]/g, '_');
        const label = FLAG_LABEL_MAP?.[key] || f;
        const colorCls = FLAG_COLOR_MAP?.[key] || 'bg-slate-100 text-slate-600 border-slate-200';
        return (
          <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorCls}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
};

// ─── Documentation Queue Filter Chips ─────────────────────────────────────────
const DOC_FILTER_CHIPS = [
  { key: 'missing_note', label: 'Missing Note' },
  { key: 'approval_evidence_missing', label: 'Approval Evidence Missing' },
  { key: 'requires_manager_review', label: 'Requires Manager Review' },
  { key: 'large_adjustment', label: 'Large Adjustment' },
  { key: 'late_posted', label: 'Late-Posted' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'correction_review', label: 'Correction Review' },
  { key: 'unmapped_adjustment', label: 'Unmapped Adjustment' },
];

// ─── Documentation Queue CSV Export ───────────────────────────────────────────
const DOC_EXPORT_COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'office', label: 'Office' },
  { key: 'adjustment_category_label', label: 'Category' },
  { key: 'amount', label: 'Amount' },
  { key: 'transaction_date', label: 'Transaction Date' },
  { key: 'entry_date', label: 'Entry Date' },
  { key: 'online_user_name', label: 'Staff Entered By' },
  { key: 'approval_evidence_status', label: 'Approval Evidence' },
  { key: 'triggered_flag_labels', label: 'Triggered Flags' },
  { key: 'note', label: 'Note' },
  { key: 'reason', label: 'Reason' },
];

const exportDocQueueCsv = (items) => {
  const headers = DOC_EXPORT_COLUMNS?.map(c => c?.label)?.join(',');
  const rowsCsv = items?.map(item =>
    DOC_EXPORT_COLUMNS?.map(c => {
      let v = item?.[c?.key];
      if (c?.key === 'triggered_flag_labels') {
        const flags = item?.triggered_flag_labels || item?.triggered_flags || item?.review_flag_labels || [];
        v = Array.isArray(flags) ? flags?.join('; ') : (flags || '');
      }
      if (v == null) return '';
      const s = String(v)?.replace(/"/g, '""');
      return s?.includes(',') || s?.includes('"') || s?.includes('\n') ? `"${s}"` : s;
    })?.join(',')
  )?.join('\n');
  const csv = `${headers}\n${rowsCsv}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `documentation_queue.csv`;
  a?.click();
  URL.revokeObjectURL(url);
};

// ─── Days Late helper ──────────────────────────────────────────────────────────
const calcDaysLate = (item) => {
  if (item?.days_between_transaction_and_entry != null) return item?.days_between_transaction_and_entry;
  const txDate = item?.transaction_date || item?.transactionDate;
  const entryDate = item?.entry_date || item?.entryDate;
  if (!txDate || !entryDate) return null;
  const diff = Math.round((new Date(entryDate) - new Date(txDate)) / (1000 * 60 * 60 * 24));
  return isNaN(diff) ? null : diff;
};

const DocumentationQueuePanel = ({ queue, summary }) => {
  const items = Array.isArray(queue) ? queue : [];
  const [activeChips, setActiveChips] = useState(new Set());

  const toggleChip = (key) => {
    setActiveChips(prev => {
      const next = new Set(prev);
      if (next?.has(key)) next?.delete(key);
      else next?.add(key);
      return next;
    });
  };

  // Client-side filter by active chips
  const filteredItems = activeChips?.size === 0 ? items : items?.filter(item => {
    const flags = item?.triggered_flag_labels || item?.triggered_flags || item?.review_flag_labels || [];
    const flagKeys = Array.isArray(flags) ? flags?.map(f => String(f)?.toLowerCase()?.replace(/[\s-]/g, '_')) : [];
    // Also check approval_evidence_status for evidence_missing chip
    const evidenceStatus = String(item?.approval_evidence_status || '')?.toLowerCase();
    return Array.from(activeChips)?.some(chip => {
      if (chip === 'missing_note') return flagKeys?.includes('missing_note') || !item?.note;
      if (chip === 'approval_evidence_missing') return flagKeys?.includes('approval_evidence_missing') || evidenceStatus === 'evidence_missing' || evidenceStatus === 'missing' || evidenceStatus === 'not_found';
      if (chip === 'requires_manager_review') return flagKeys?.includes('requires_manager_review');
      if (chip === 'large_adjustment') return flagKeys?.includes('large_adjustment');
      if (chip === 'late_posted') return flagKeys?.includes('late_posted');
      if (chip === 'needs_review') return flagKeys?.includes('needs_review');
      if (chip === 'correction_review') return flagKeys?.includes('correction_review');
      if (chip === 'unmapped_adjustment') return flagKeys?.includes('unmapped_adjustment_type') || flagKeys?.includes('unmapped_adjustment');
      return false;
    });
  });

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Missing Documentation / Approval Queue</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review queue for adjustments with documentation or approval evidence indicators.
        </p>
      </div>

      {/* Panel Summary Strip — from response.summary only */}
      {summary && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full-Scope Summary Counts</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: 'Missing Notes', count: summary?.missing_note_count, icon: 'FileX', color: 'text-slate-600' },
              { label: 'Approval Evidence Missing', count: summary?.approval_evidence_missing_count, icon: 'ShieldAlert', color: 'text-amber-600' },
              { label: 'Requires Manager Review', count: summary?.requires_manager_review_count, icon: 'UserCheck', color: 'text-orange-600' },
              { label: 'Large Adjustments', count: summary?.large_adjustment_count, icon: 'TrendingDown', color: 'text-purple-600' },
              { label: 'Late-Posted', count: summary?.late_posted_count, icon: 'Clock', color: 'text-yellow-600' },
              { label: 'Needs Review', count: summary?.needs_review_count, icon: 'Eye', color: 'text-blue-600' },
            ]?.map(card => (
              <div key={card?.label} className="bg-card border border-border rounded-lg p-2.5 flex items-start gap-2">
                <Icon name={card?.icon} size={14} className={`mt-0.5 flex-shrink-0 ${card?.color}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{card?.label}</p>
                  <p className={`text-sm font-bold ${card?.color}`}>{(card?.count || 0)?.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Queue displays up to 200 review items. Summary counts reflect the full selected date range.
          </p>
        </div>
      )}

      {/* Filter Chips */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Filter queue by flag type:</p>
        <div className="flex flex-wrap gap-1.5">
          {DOC_FILTER_CHIPS?.map(chip => {
            const isActive = activeChips?.has(chip?.key);
            return (
              <button
                key={chip?.key}
                onClick={() => toggleChip(chip?.key)}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {isActive && <Icon name="Check" size={10} className="mr-1" />}
                {chip?.label}
              </button>
            );
          })}
          {activeChips?.size > 0 && (
            <button
              onClick={() => setActiveChips(new Set())}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-muted-foreground border border-border hover:bg-muted"
            >
              <Icon name="X" size={10} className="mr-1" />Clear
            </button>
          )}
        </div>
        {activeChips?.size > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Showing {filteredItems?.length} of {items?.length} queue items matching selected filters
          </p>
        )}
      </div>

      {/* Source Note */}
      <div className="flex items-start gap-2 p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
        <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0 text-blue-500" />
        <span>
          Documentation and approval review is based on Dentrix adjustment notes, entered-by user, adjustment category, amount, and posting timing.
          Dentrix does not provide a structured approvedBy field. These are neutral review indicators, not accusations.
        </span>
      </div>

      {/* Export Button */}
      {filteredItems?.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => exportDocQueueCsv(filteredItems)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Icon name="Download" size={13} />Export Documentation Queue
          </button>
        </div>
      )}

      {/* Queue Table */}
      {filteredItems?.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">
          {items?.length === 0
            ? 'No documentation review items in queue'
            : 'No items match the selected filters'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                {['Patient','Office','Category','Amount','Transaction Date','Entry Date','Days Late','Staff Entered By','Approval Evidence','Triggered Flags','Note / Reason']?.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems?.map((item, i) => {
                const daysLate = calcDaysLate(item);
                const note = item?.note || item?.reason;
                const triggeredFlags = item?.triggered_flag_labels || item?.triggered_flags || item?.review_flag_labels || [];
                const hasMissingNoteFlag = Array.isArray(triggeredFlags) && triggeredFlags?.some(f => String(f)?.toLowerCase()?.replace(/[\s-]/g, '_') === 'missing_note');

                return (
                  <tr key={item?.id || i} className="hover:bg-muted/40">
                    {/* Patient */}
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {item?.patient_name || item?.patientName || '—'}
                    </td>
                    {/* Office */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {item?.office || item?.office_name || '—'}
                    </td>
                    {/* Category */}
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item?.adjustment_category_label || item?.category || '—'}
                      </span>
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtAmt(item?.amount)}
                    </td>
                    {/* Transaction Date */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(item?.transaction_date || item?.transactionDate) || '—'}
                    </td>
                    {/* Entry Date */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(item?.entry_date || item?.entryDate) || '—'}
                    </td>
                    {/* Days Late */}
                    <td className="px-3 py-2 text-center">
                      {daysLate != null
                        ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${daysLate > 7 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-muted text-muted-foreground'}`}>
                            {daysLate}d
                          </span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    {/* Staff Entered By */}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {item?.online_user_name || item?.staff_entered_by || '—'}
                    </td>
                    {/* Approval Evidence */}
                    <td className="px-3 py-2">
                      <ApprovalEvidenceBadge status={item?.approval_evidence_status || item?.approvalEvidenceStatus} />
                    </td>
                    {/* Triggered Flags */}
                    <td className="px-3 py-2">
                      <NeutralFlagBadges flags={triggeredFlags} />
                    </td>
                    {/* Note / Reason */}
                    <td className="px-3 py-2 max-w-[200px]">
                      {note ? (
                        <span
                          className="text-muted-foreground truncate block max-w-[180px] cursor-help"
                          title={note}
                        >
                          {note?.length > 60 ? `${note?.slice(0, 60)}…` : note}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          No note found
                          {hasMissingNoteFlag && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-slate-100 text-slate-600 border-slate-200 ml-1">
                              Missing Note
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Source Note ──────────────────────────────────────────────────────────────

const MetadataNote = ({ metadata }) => {
  if (!metadata || Object.keys(metadata)?.length === 0) return null;
  const fields = [
    { key: 'source', label: 'Source' },
    { key: 'classification_source', label: 'Classification Source' },
    { key: 'user_source', label: 'User Source' },
    { key: 'approved_by_note', label: 'Approved By Note' },
    { key: 'approval_evidence_note', label: 'Approval Evidence Note' },
    { key: 'review_flags_note', label: 'Review Flags Note' },
    { key: 'summary_scope', label: 'Summary Scope' },
  ];
  const present = fields?.filter(f => metadata?.[f?.key]);
  if (!present?.length) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground">
      <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0 text-blue-500" />
      <div className="space-y-0.5">
        {present?.map(f => (
          <div key={f?.key}><span className="font-medium text-foreground">{f?.label}:</span> {metadata?.[f?.key]}</div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Table ───────────────────────────────────────────────────────────────

const LatePostedCell = ({ row }) => {
  if (row?.is_late_posted == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (row?.is_late_posted) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
        <Icon name="Clock" size={10} />Late
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">No</span>;
};

const StatusCell = ({ row }) => {
  if (row?.is_voided) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Voided
      </span>
    );
  }
  if (row?.is_cancelled) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Cancelled
      </span>
    );
  }
  if (row?.is_reversal) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
        Reversal
      </span>
    );
  }
  const status = row?.status;
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
      {status}
    </span>
  );
};

const RowDetailTooltip = ({ row }) => {
  const [open, setOpen] = React.useState(false);
  const hasDetail = row?.transaction_id || row?.adjustment_id || row?.days_between_transaction_and_entry != null || row?.approval_evidence_source || row?.modified_date;
  if (!hasDetail) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
        title="View row details"
      >
        <Icon name="Info" size={10} />
      </button>
      {open && (
        <div
          className="absolute z-50 right-0 top-6 w-64 bg-card border border-border rounded-lg shadow-lg p-3 text-xs space-y-1.5"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-1">Row Details</p>
          {row?.adjustment_id && <div className="flex justify-between"><span className="text-muted-foreground">Adjustment ID</span><span className="font-mono text-[10px] text-foreground">{row?.adjustment_id}</span></div>}
          {row?.transaction_id && <div className="flex justify-between"><span className="text-muted-foreground">Transaction ID</span><span className="font-mono text-[10px] text-foreground">{row?.transaction_id}</span></div>}
          {row?.days_between_transaction_and_entry != null && <div className="flex justify-between"><span className="text-muted-foreground">Days Tx→Entry</span><span className="text-foreground">{row?.days_between_transaction_and_entry}d</span></div>}
          {row?.approval_evidence_source && <div className="flex justify-between"><span className="text-muted-foreground">Evidence Source</span><span className="text-foreground">{row?.approval_evidence_source}</span></div>}
          {row?.modified_date && <div className="flex justify-between"><span className="text-muted-foreground">Modified Date</span><span className="text-foreground">{fmtDate(row?.modified_date)}</span></div>}
        </div>
      )}
    </div>
  );
};

const MAIN_TABLE_COLS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'office', label: 'Office' },
  { key: 'provider_name', label: 'Provider' },
  { key: 'adjustment_category_label', label: 'Category' },
  { key: 'organization_ledger_type_name', label: 'OLT Name' },
  { key: 'signed_amount', label: 'Signed Amount' },
  { key: 'financial_amount', label: 'Financial Amount' },
  { key: 'transaction_date', label: 'Transaction Date' },
  { key: 'entry_date', label: 'Entry Date' },
  { key: 'is_late_posted', label: 'Late Posted' },
  { key: 'online_user_name', label: 'Staff Entered By' },
  { key: 'approval_evidence_status', label: 'Approval Evidence' },
  { key: 'review_flag_labels', label: 'Review Flags' },
  { key: 'note', label: 'Note / Reason' },
  { key: 'status', label: 'Status' },
  { key: 'chain', label: 'Chain' },
];

const getCategoryBadgeColor = (cat) => {
  if (!cat) return 'bg-muted text-muted-foreground';
  const c = cat?.toLowerCase();
  if (c?.includes('writeoff') || c?.includes('write_off') || c?.includes('contractual')) return 'bg-red-100 text-red-700';
  if (c?.includes('discount') || c?.includes('courtesy') || c?.includes('no_charge')) return 'bg-blue-100 text-blue-700';
  if (c?.includes('refund') || c?.includes('credit')) return 'bg-green-100 text-green-700';
  if (c?.includes('charge_adjustment')) return 'bg-orange-100 text-orange-700';
  if (c?.includes('voided') || c?.includes('cancelled')) return 'bg-gray-100 text-gray-600';
  return 'bg-muted text-muted-foreground';
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'summary', label: 'Adjustment Summary' },
  { id: 'discount_writeoff', label: 'Discount / Write-Off Review' },
  { id: 'voided', label: 'Voided Transaction Review' },
  { id: 'payment_method', label: 'Payment Method Review' },
  { id: 'documentation', label: 'Missing Documentation' },
  { id: 'table', label: 'Adjustment Detail Table' },
];

const AdjustmentTab = ({ dateRange, officeId, refreshKey }) => {
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [metadata, setMetadata] = useState({});
  const [summary, setSummary] = useState({});
  const [reviewQueues, setReviewQueues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [includeVoided, setIncludeVoided] = useState(false);
  const [adjustmentCategory, setAdjustmentCategory] = useState('');
  const [reviewFlag, setReviewFlag] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const load = useCallback(async (pg = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdjustmentsReview({
        start: dateRange?.start,
        end: dateRange?.end,
        officeId,
        page: pg,
        pageSize,
        includeVoided,
        adjustmentCategory: adjustmentCategory || null,
        reviewFlag: reviewFlag || null,
      });
      setRows(result?.rows || []);
      setPagination(result?.pagination || {});
      setMetadata(result?.metadata || {});
      // Only update summary when it's non-empty (it's full-scope, not page-scoped)
      if (result?.summary && Object.keys(result?.summary)?.length > 0) {
        setSummary(result?.summary);
      }
      setReviewQueues(result?.reviewQueues || {});
      setPage(pg);
    } catch (e) {
      setError(e?.message || 'Failed to load adjustment review data');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, pageSize, includeVoided, adjustmentCategory, reviewFlag]);

  useEffect(() => {
    load(1);
  }, [load, refreshKey]);

  // Clear stale data when entering multi-subset mode — removed (single-office only)

  // CSV export for main table
  const handleExportCsv = () => {
    const headers = EXPORT_COLUMNS?.map(c => c?.label)?.join(',');
    const rowsCsv = rows?.map(row =>
      EXPORT_COLUMNS?.map(c => {
        let v = row?.[c?.key];
        if (Array.isArray(v)) return `"${v?.join('; ')}"`;
        if (v == null) return '';
        const s = String(v)?.replace(/"/g, '""');
        return s?.includes(',') || s?.includes('"') || s?.includes('\n') ? `"${s}"` : s;
      })?.join(',')
    )?.join('\n');
    const csv = `${headers}\n${rowsCsv}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adjustments_review_p${page}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  // Client-side search on current page only
  const visibleRows = search
    ? rows?.filter(r =>
        r?.patient_name?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.office?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.provider_name?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.organization_ledger_type_name?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.adjustment_category_label?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.online_user_name?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.note?.toLowerCase()?.includes(search?.toLowerCase()) ||
        r?.reason?.toLowerCase()?.includes(search?.toLowerCase())
      )
    : rows;

  const totalPages = pagination?.total_pages || 1;
  const totalRows = pagination?.total_rows || 0;
  const hasNext = pagination?.has_next_page ?? (page < totalPages);

  return (
    <div className="space-y-4">
      {/* Global Filters */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={includeVoided}
            onChange={e => { setIncludeVoided(e?.target?.checked); load(1); }}
            className="rounded"
          />
          Include Voided
        </label>
        <select
          value={adjustmentCategory}
          onChange={e => { setAdjustmentCategory(e?.target?.value); load(1); }}
          className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {ADJUSTMENT_CATEGORY_OPTIONS?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
        </select>
        <select
          value={reviewFlag}
          onChange={e => { setReviewFlag(e?.target?.value); load(1); }}
          className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {REVIEW_FLAG_OPTIONS?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
        </select>
        <select
          value={pageSize}
          onChange={e => { setPageSize(Number(e?.target?.value)); load(1); }}
          className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {PAGE_SIZE_OPTIONS?.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {!loading && totalRows > 0 && (
            <span>{totalRows?.toLocaleString()} total rows</span>
          )}
          {loading && <span className="flex items-center gap-1"><Icon name="Loader" size={12} className="animate-spin" />Loading…</span>}
        </div>
      </div>
      {/* Metadata Note */}
      <MetadataNote metadata={metadata} />
      {/* Sub-tab Navigation */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {SUB_TABS?.map(tab => (
          <button
            key={tab?.id}
            onClick={() => setActiveSubTab(tab?.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === tab?.id
                ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tab?.label}
            {tab?.id === 'discount_writeoff' && (
              (() => {
                const dwCount =
                  summary?.discount_writeoff_review_count ??
                  (Array.isArray(reviewQueues?.discount_writeoff_reviews) ? reviewQueues?.discount_writeoff_reviews?.length : null);
                return dwCount > 0 ? (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold min-w-[16px]">
                    {dwCount?.toLocaleString()}
                  </span>
                ) : null;
              })()
            )}
            {tab?.id === 'voided' && Array.isArray(reviewQueues?.voided_transaction_reviews) && reviewQueues?.voided_transaction_reviews?.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold">
                {reviewQueues?.voided_transaction_reviews?.length}
              </span>
            )}
            {tab?.id === 'payment_method' && Array.isArray(reviewQueues?.payment_method_reviews) && reviewQueues?.payment_method_reviews?.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
                {reviewQueues?.payment_method_reviews?.length}
              </span>
            )}
            {tab?.id === 'documentation' && Array.isArray(reviewQueues?.documentation_reviews) && reviewQueues?.documentation_reviews?.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                {reviewQueues?.documentation_reviews?.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Icon name="AlertCircle" size={15} />
          {error}
        </div>
      )}
      {/* Sub-panel Content */}
      <div className="bg-card border border-border rounded-xl p-4">
        {activeSubTab === 'summary' && (
          loading
            ? <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2"><Icon name="Loader" size={16} className="animate-spin" />Loading summary…</div>
            : <AdjustmentSummaryPanel summary={summary} />
        )}

        {activeSubTab === 'discount_writeoff' && (
          loading
            ? <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2"><Icon name="Loader" size={16} className="animate-spin" />Loading…</div>
            : <DiscountWriteOffPanel queue={reviewQueues?.discount_writeoff_reviews} summary={summary} />
        )}

        {activeSubTab === 'voided' && (
          <VoidedTransactionPanel queue={reviewQueues?.voided_transaction_reviews} />
        )}

        {activeSubTab === 'payment_method' && (
          <PaymentMethodReviewPanel queue={reviewQueues?.payment_method_reviews} />
        )}

        {activeSubTab === 'documentation' && (
          <DocumentationQueuePanel queue={reviewQueues?.documentation_reviews} summary={summary} />
        )}

        {activeSubTab === 'table' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search patient, office, provider, OLT, category, staff, note…"
                  value={search}
                  onChange={e => setSearch(e?.target?.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
              </div>
              {search && (
                <span className="text-xs text-muted-foreground">Searching current page only</span>
              )}
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                <Icon name="Download" size={14} /> Export Page CSV
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs min-w-[1400px]">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    {MAIN_TABLE_COLS?.map(col => (
                      <th key={col?.key} className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {col?.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading
                    ? Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} cols={MAIN_TABLE_COLS?.length} />)
                    : visibleRows?.length === 0
                      ? <tr><td colSpan={MAIN_TABLE_COLS?.length} className="px-4 py-12 text-center text-muted-foreground text-sm">No adjustments found for selected filters</td></tr>
                      : visibleRows?.map(row => (
                          <tr key={row?.id || row?.adjustment_id} className={`hover:bg-muted/40 ${row?.is_voided ? 'opacity-70' : ''}`}>
                            {/* Patient */}
                            <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{row?.patient_name || '—'}</td>
                            {/* Office */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row?.office || '—'}</td>
                            {/* Provider */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row?.provider_name || '—'}</td>
                            {/* Category */}
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getCategoryBadgeColor(row?.adjustment_category)}`}>
                                {row?.adjustment_category_label || '—'}
                              </span>
                            </td>
                            {/* OLT Name */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row?.organization_ledger_type_name || '—'}</td>
                            {/* Signed Amount */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              {(() => {
                                let v = row?.signed_amount != null ? row?.signed_amount : row?.amount;
                                return fmtAmtVoided(v, row?.is_voided);
                              })()}
                            </td>
                            {/* Financial Amount */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              <FinancialAmountCell row={row} />
                            </td>
                            {/* Transaction Date */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row?.transaction_date) || '—'}</td>
                            {/* Entry Date */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row?.entry_date) || '—'}</td>
                            {/* Late Posted */}
                            <td className="px-3 py-2">
                              <LatePostedCell row={row} />
                            </td>
                            {/* Staff Entered By */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row?.online_user_name || 'Unknown Staff'}</td>
                            {/* Approval Evidence */}
                            <td className="px-3 py-2"><ApprovalEvidenceBadge status={row?.approval_evidence_status} /></td>
                            {/* Review Flags */}
                            <td className="px-3 py-2"><ReviewFlagBadges flags={row?.review_flag_labels} /></td>
                            {/* Note / Reason */}
                            <td className="px-3 py-2 max-w-[180px]">
                              {(() => {
                                const note = row?.note || row?.reason;
                                if (note) {
                                  return (
                                    <span
                                      className="text-muted-foreground truncate block max-w-[160px] cursor-help"
                                      title={note}
                                    >
                                      {note?.length > 55 ? `${note?.slice(0, 55)}…` : note}
                                    </span>
                                  );
                                }
                                return <span className="text-[10px] text-slate-500 italic">No note found</span>;
                              })()}
                            </td>
                            {/* Status */}
                            <td className="px-3 py-2">
                              <StatusCell row={row} />
                            </td>
                            {/* Chain */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <ChainContextTooltip item={row} />
                                <RowDetailTooltip row={row} />
                              </div>
                            </td>
                          </tr>
                        ))
                  }
                </tbody>
              </table>
            </div>

            {/* Backend Pagination */}
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
              <span>
                Page {page} of {totalPages} &nbsp;·&nbsp; {totalRows?.toLocaleString()} total rows
                {search && visibleRows?.length !== rows?.length && ` (${visibleRows?.length} matching search on this page)`}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => load(1)}
                  disabled={page === 1 || loading}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  title="First page"
                >
                  <Icon name="ChevronsLeft" size={15} />
                </button>
                <button
                  onClick={() => load(page - 1)}
                  disabled={page === 1 || loading}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                >
                  <Icon name="ChevronLeft" size={15} />
                </button>
                <span className="px-2 py-1 text-xs">{page} / {totalPages}</span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={!hasNext || loading}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                >
                  <Icon name="ChevronRight" size={15} />
                </button>
                <button
                  onClick={() => load(totalPages)}
                  disabled={page === totalPages || loading}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  title="Last page"
                >
                  <Icon name="ChevronsRight" size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdjustmentTab;
