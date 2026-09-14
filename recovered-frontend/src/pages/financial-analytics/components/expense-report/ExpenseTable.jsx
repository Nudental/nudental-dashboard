import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../../../../components/AppIcon';
import { SOURCE_TYPE_LABELS, classify3526Transaction, isWFMainMoneyOutCounted } from '../../../../services/expenseReportService';
import { resolveAmexCard, isAmexSource } from '../../../../utils/amexCardMapping';

// ── FORMATTING ────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(n);
};

// ── WELLS FARGO ACCOUNT ROLE MAP ──────────────────────────────────────────────
// NOTE: ...3526 is the Eatontown main operating account BUT is also used as a
// corporate/shared payment account for payroll, benefits, and company-wide expenses.
// Do NOT automatically classify every ...3526 transaction as an Eatontown expense.
const WF_ACCOUNT_ROLES = {
  '3526': {
    label: 'Eatontown Main / Corporate Shared Payment Account',
    shortLabel: 'Eatontown Main Operating — also used for Corporate Shared Payments',
    type: 'main_operating_corporate_shared',
    office: 'Eatontown',
    isCorporateSharedCapable: true,
  },
  '6093': { label: 'Barnegat Main Operating',  type: 'main_operating', office: 'Barnegat', isCorporateSharedCapable: false },
  '8124': { label: 'Brick Main Operating',     type: 'main_operating', office: 'Brick',    isCorporateSharedCapable: false },
  '7975': { label: 'Staten Island Main Operating', type: 'main_operating', office: 'Staten Island', isCorporateSharedCapable: false },
  '4083': { label: 'Eatontown EFT Clearing',   type: 'eft_clearing', office: 'Eatontown', isCorporateSharedCapable: false },
  '9976': { label: 'Barnegat EFT Clearing',    type: 'eft_clearing', office: 'Barnegat',  isCorporateSharedCapable: false },
  '4416': { label: 'Brick EFT Clearing',       type: 'eft_clearing', office: 'Brick',     isCorporateSharedCapable: false },
  '0538': { label: 'Staten Island EFT Clearing', type: 'eft_clearing', office: 'Staten Island', isCorporateSharedCapable: false },
};

function getAccountRole(last4) {
  if (!last4) return null;
  const key = String(last4)?.replace(/\D/g, '')?.slice(-4);
  return WF_ACCOUNT_ROLES?.[key] || null;
}

// ── AMEX ACCOUNT ROLE HELPER ──────────────────────────────────────────────────
function getAmexAccountRole(row) {
  if (!isAmexSource(row?.source_type)) return null;
  const last4 = row?.card_last4 || row?.account_last4 || null;
  if (!last4) return null;
  return resolveAmexCard(last4, row?.cardholder_name);
}

/**
 * Returns true if this row is an AmEx corporate/shared card transaction
 * (cards 1001, 1002, 1003, 1077 — not assigned to a specific dental office).
 */
function isAmexCorporateRow(row) {
  const info = getAmexAccountRole(row);
  return info?.isCorporate === true;
}

// ── TRANSFER / RECONCILIATION DETECTION ──────────────────────────────────────
// Used for non-3526 rows. For 3526 rows, classify3526Transaction() handles this.
const TRANSFER_KEYWORDS = [
  'income', 'transfer in', 'internal transfer', 'eft deposit', 'bank transfer',
  'main account deposit', 'insurance eft', 'wells fargo transfer', 'transfer out',
  'eft clearing', 'eft to main', 'reconciliation',
];

function isTransferOrReconciliation(row) {
  // For 3526 rows, use the full hierarchy — don't apply generic transfer detection
  const last4 = String(row?.card_last4 || row?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
  if (last4 === '3526') {
    const cls = classify3526Transaction(row);
    return cls === 'internal_transfer' || cls === 'liability_payment_to_amex' || cls === 'payroll_funding';
  }

  const cat = (row?.category_name || '')?.toLowerCase();
  const src = (row?.source_type || '')?.toLowerCase();
  const merchant = (row?.merchant_name || row?.vendor_name || '')?.toLowerCase();
  const notes = (row?.notes || '')?.toLowerCase();
  const classification = (row?.classification || '')?.toLowerCase();

  if (parseFloat(row?.amount) < 0) return true;

  if (
    classification?.includes('internal_transfer') ||
    classification?.includes('eft') ||
    classification?.includes('liability_payment') ||
    classification?.includes('payroll_funding') ||
    classification?.includes('reconciliation')
  ) return true;

  const haystack = `${cat} ${src} ${merchant} ${notes}`;
  return TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
}

// ── OFFICE DISPLAY HELPER ─────────────────────────────────────────────────────
function displayOffice(officeName) {
  if (!officeName) return 'Unassigned / Needs Office Mapping';
  const lower = officeName?.toLowerCase()?.trim();
  if (lower === 'corp' || lower === 'corporate' || lower === 'unknown' || lower === 'unmapped') {
    return 'Unassigned / Needs Office Mapping';
  }
  if (lower === 'corporate / shared') return 'Corporate / Shared';
  return officeName;
}

function isCorpOrUnmapped(officeName) {
  if (!officeName) return true;
  const lower = officeName?.toLowerCase()?.trim();
  return lower === 'corp' || lower === 'corporate' || lower === 'unknown' || lower === 'unmapped';
}

// ── CLASSIFICATION HELPER ─────────────────────────────────────────────────────
/**
 * Returns a classification string for a row.
 *
 * WF ...3526 hierarchy (from expenseReportService.classify3526Transaction):
 *   liability_payment_to_amex       — WF pays AmEx bill (excluded: AmEx vendor txns already counted)
 *   payroll_funding                 — WF pays Gusto/payroll (excluded: Gusto payroll already counted)
 *   internal_transfer               — EFT/transfer/deposit (excluded: not an expense)
 *   corporate_shared_benefit_expense — direct benefit payment (Oxford/UHC/etc.) — included if not from Gusto
 *   corporate_shared_payroll_benefit_payment — other payroll/benefit vendor (excluded until reviewed)
 *   corporate_shared_vendor_expense — true corporate vendor expense (included in company total)
 *
 * AmEx rows:
 *   corporate_shared_vendor_expense   — AmEx corporate card (1001/1002/1003/1077) true vendor purchase
 *   operating_expense                 — AmEx office-mapped card
 *
 * Other:
 *   manual_exception_needs_review
 *   payroll (Gusto source)
 *   internal_transfer_or_reconciliation
 *   operating_expense
 */
function getClassification(row) {
  // If DB has a classification field, use it as a hint but still apply our logic
  const dbCls = row?.classification;

  // ── WF Banking rows: classify by wf_classification from allocation_metadata ──
  // IMPORTANT: source_type='manual' exists only due to DB enum constraints.
  // Banking rows must NEVER be classified as manual_exception_needs_review.
  if (row?.source_tab === 'Banking') {
    const meta = row?.allocation_metadata || {};
    const wfCls = (meta?.wf_classification || '')?.toLowerCase();
    switch (wfCls) {
      case 'main_operating_direct_expense':
        return 'wf_direct_operating_expense';
      case 'liability_payment_amex': case'liability_payment_to_amex': case'amex_bill_payment':
        return 'wf_amex_payment';
      case 'payroll_funding':
        return 'wf_payroll_funding';
      case 'corporate_shared_needs_allocation':
        return 'wf_corporate_shared_needs_allocation';
      case 'internal_transfer': case'eft_clearing': case'transfer_out_internal':
        return 'internal_transfer';
      case 'deposit': case'income': case'transfer_in':
        return 'internal_transfer_or_reconciliation';
      case 'needs_review': case'manual_entry_needs_review': case'unassigned_needs_review': case'':
        return 'wf_api_imported_needs_category_review';
      default:
        // Unknown wf_classification — treat as needs review, not manual entry
        return 'wf_api_imported_needs_category_review';
    }
  }

  // WF ...3526 — apply full hierarchy
  const cls3526 = classify3526Transaction(row);
  if (cls3526) return cls3526;

  const src = row?.source_type || '';
  const cat = (row?.category_name || '')?.toLowerCase();
  const merchant = (row?.merchant_name || row?.vendor_name || '')?.toLowerCase();

  if (src === 'manual') return 'manual_exception_needs_review';
  if (src === 'gusto' || src === 'gusto_payroll') return 'payroll';

  // AmEx corporate card — true vendor purchase on corporate/shared card
  // Classified as corporate_shared_vendor_expense: Company Expense Yes, Office Expense No until allocated
  if (isAmexCorporateRow(row)) return 'corporate_shared_vendor_expense';

  // AmEx office-mapped card
  if (src === 'amex_api' || src === 'amex_statement_import') return 'operating_expense';

  // Non-3526 AmEx bill payment (e.g. another WF account paying AmEx)
  if (merchant?.includes('american express') || merchant?.includes('amex')) return 'liability_payment_to_amex';

  // Non-3526 Gusto/payroll funding
  if (merchant?.includes('gusto') || cat?.includes('payroll funding')) return 'payroll_funding';

  if (isTransferOrReconciliation(row)) return 'internal_transfer_or_reconciliation';

  if (dbCls) return dbCls;
  return 'operating_expense';
}

/**
 * Returns true if this row should be INCLUDED in expense totals.
 *
 * Excluded:
 * - manual entries (until reviewed)
 * - internal transfers / reconciliation
 * - liability_payment_to_amex (WF→AmEx bill payment — AmEx vendor txns already counted)
 * - payroll_funding (WF→Gusto — Gusto payroll already counted)
 * - corporate_shared_payroll_benefit_payment (excluded until reviewed/allocated)
 * - negative amounts
 *
 * Included (company level, not office level):
 * - corporate_shared_benefit_expense (direct benefit payment, not from Gusto)
 * - corporate_shared_vendor_expense (true corporate vendor expense — AmEx corp cards + WF 3526 vendor)
 *
 * Included (office level):
 * - operating_expense with a mapped office
 * - payroll (Gusto source)
 *
 */
function isIncludedInExpense(row) {
  // WF Banking rows: included if wf_classification = main_operating_direct_expense and not excluded
  if (row?.source_tab === 'Banking') {
    const meta = row?.allocation_metadata || {};
    if (isExcluded(meta)) return false;
    return meta?.wf_classification === 'main_operating_direct_expense';
  }
  // Skip rows excluded via allocation_metadata
  const meta = row?.allocation_metadata || {};
  if (isExcluded(meta)) return false;

  const cls = getClassification(row);
  if (row?.source_type === 'manual') return false;
  if (cls === 'manual_exception_needs_review') return false;
  if (cls === 'internal_transfer_or_reconciliation') return false;
  if (cls === 'internal_transfer') return false;
  if (cls === 'liability_payment_to_amex') return false;
  if (cls === 'payroll_funding') return false;
  if (cls === 'corporate_shared_payroll_benefit_payment') return false;
  if (isTransferOrReconciliation(row)) return false;
  if (parseFloat(row?.amount) < 0) return false;
  return true;
}

// ── EXCLUDED_FROM_EXPENSE NORMALIZER ─────────────────────────────────────────
// DB may store excluded_from_expense as boolean true, string "true", number 1, etc.
// Always use this helper instead of === true / !== true to avoid silent filter failures.
function isExcluded(meta) {
  const v = meta?.excluded_from_expense;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
}

/**
 * Returns true if this row is a transfer/reconciliation/funding row
 * (goes to Transfers / Reconciliation view).
 *
 * IMPORTANT: Under the cash-basis WF Main Money-Out model, AmEx bill payments
 * and payroll funding from main WF accounts are counted as WF Money-Out, NOT
 * routed to Transfers. Only true internal transfers, EFT clearing, deposits,
 * income, and needs-review rows go to Transfers.
 */
function isTransferRow(row) {
  // WF Banking rows: route by wf_classification / excluded_from_expense
  if (row?.source_tab === 'Banking') {
    const meta = row?.allocation_metadata || {};
    const wfCls = (meta?.wf_classification || '')?.toLowerCase();

    // Needs-review rows go to Manual Exceptions, not Transfers
    if (wfCls === 'needs_review' || wfCls === 'manual_entry_needs_review' || wfCls === 'unassigned_needs_review') return false;

    // AmEx bill payments and payroll funding from main WF accounts → WF Money-Out; NOT Transfers
    if (
      wfCls === 'liability_payment_to_amex' ||
      wfCls === 'liability_payment_amex' ||
      wfCls === 'amex_bill_payment' ||
      wfCls === 'payroll_funding'
    ) {
      // Only route to Transfers if NOT from a main WF account
      const last4 = String(row?.card_last4 || row?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
      const isMain = ['3526', '6093', '8124', '7975']?.includes(last4);
      return !isMain; // main account → WF Money-Out; non-main → Transfers
    }

    // Corporate/shared rows go to Corporate/Shared, not Transfers
    if (wfCls?.startsWith('corporate_shared')) return false;

    // Direct expenses go to WF Money-Out, not Transfers
    if (wfCls === 'main_operating_direct_expense') return false;

    // Internal transfers, EFT clearing, deposits, income → Transfers
    if (
      wfCls === 'internal_transfer' ||
      wfCls === 'eft_clearing' ||
      wfCls === 'deposit' ||
      wfCls === 'income' ||
      wfCls === 'transfer_in' ||
      wfCls === 'transfer_out_internal'
    ) return true;

    // Fallback: if excluded_from_expense is set and not a counted classification → Transfers
    if (!isExcluded(meta)) return false;
    return true;
  }
  if (row?.source_type === 'manual') return false;
  // 3526 transfers/funding
  const cls3526 = classify3526Transaction(row);
  if (cls3526 === 'internal_transfer' || cls3526 === 'liability_payment_to_amex' || cls3526 === 'payroll_funding') return true;
  // Non-3526 transfers
  const last4 = String(row?.card_last4 || row?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
  if (last4 === '3526') return false; // handled above
  return isTransferOrReconciliation(row);
}

/**
 * Returns true if this row is a corporate/shared row that belongs in the
 * Corporate / Shared view tab (not in Included Expenses, not in Transfers).
 */
function isCorporateSharedRow(row) {
  // WF Banking rows: route by wf_classification
  if (row?.source_tab === 'Banking') {
    const meta = row?.allocation_metadata || {};
    const wfCls = meta?.wf_classification || '';
    return wfCls?.startsWith('corporate_shared');
  }
  if (row?.source_type === 'manual') return false;
  const cls = classify3526Transaction(row);
  if (cls) {
    // Transfers/funding from 3526 go to Transfers view, not Corporate/Shared view
    if (cls === 'internal_transfer' || cls === 'liability_payment_to_amex' || cls === 'payroll_funding') return false;
    // True corporate/shared expenses from 3526 go to Corporate/Shared view
    return true;
  }
  // AmEx corporate cards go to Corporate/Shared view
  return isAmexCorporateRow(row);
}

// ── VIEW TYPES ────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'included',       label: 'WF Main Money-Out',                   icon: 'CheckCircle' },
  { id: 'corporate',      label: 'Corporate / Shared',                  icon: 'Building2' },
  { id: 'manual',         label: 'Manual Exceptions',                   icon: 'AlertTriangle' },
  { id: 'transfers',      label: 'Transfers / Reconciliation',          icon: 'ArrowLeftRight' },
  { id: 'all',            label: 'All Transactions',                    icon: 'Table' },
];

// ── AMEX-MODE VIEW TYPES ──────────────────────────────────────────────────────
// Used when isAmexMode=true (AmEx Detail / Reconciliation tab).
// No WF labels — all views are AmEx-only.
const AMEX_VIEWS = [
  { id: 'included',       label: 'AmEx Charges',                        icon: 'CreditCard' },
  { id: 'corporate',      label: 'Corporate / Shared AmEx',             icon: 'Building2' },
  { id: 'manual',         label: 'Unassigned / Needs Review',           icon: 'AlertTriangle' },
  { id: 'transfers',      label: 'Credits / Refunds',                   icon: 'ArrowLeftRight' },
  { id: 'all',            label: 'All AmEx Rows',                       icon: 'Table' },
];

// ── STATUS / SOURCE COLORS ────────────────────────────────────────────────────
const STATUS_COLORS = {
  posted:   'bg-success/10 text-success',
  draft:    'bg-warning/10 text-warning',
  archived: 'bg-muted text-muted-foreground',
};

const SOURCE_COLORS = {
  manual:                 'bg-amber-500/15 text-amber-700 border border-amber-400/40',
  gusto:                  'bg-purple-500/10 text-purple-600',
  gusto_payroll:          'bg-purple-500/10 text-purple-600',
  amex_api:               'bg-green-500/10 text-green-600',
  amex_statement_import:  'bg-emerald-500/10 text-emerald-600',
  banking:                'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30',
  wells_fargo:            'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30',
  wf_main_money_out:      'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30',
  recurring:              'bg-orange-500/10 text-orange-600',
  utility_import:         'bg-yellow-500/10 text-yellow-600',
  insurance_import:       'bg-teal-500/10 text-teal-600',
  other:                  'bg-muted text-muted-foreground',
};

const COLUMNS = [
  { key: 'expense_date',    label: 'Date',             sortable: true },
  { key: 'posted_date',     label: 'Posted',           sortable: true },
  { key: 'office_name',     label: 'Office',           sortable: true },
  { key: 'department_name', label: 'Department',       sortable: false },
  { key: 'category_name',   label: 'Category',         sortable: true },
  { key: 'merchant_name',   label: 'Vendor / Merchant',sortable: true },
  { key: 'cardholder_name', label: 'Cardholder',       sortable: true },
  { key: 'card_last4',      label: 'Card / Account',   sortable: false },
  { key: 'source_type',     label: 'Source Type',      sortable: true },
  { key: '_account_role',   label: 'Account Role',     sortable: false },
  { key: '_classification', label: 'Classification',   sortable: false },
  { key: '_company_exp',    label: 'Company Expense',  sortable: false },
  { key: '_office_exp',     label: 'Office Expense',   sortable: false },
  { key: 'amount',          label: 'Amount',           sortable: true },
  { key: 'expense_status',  label: 'Status',           sortable: true },
  { key: 'notes',           label: 'Notes',            sortable: false },
];

// ── CSV EXPORT ────────────────────────────────────────────────────────────────
function exportViewToCSV(rows, viewLabel) {
  const headers = [
    'Date', 'Posted Date', 'Office', 'Department', 'Category',
    'Vendor / Merchant', 'Cardholder', 'Card / Account', 'Account Role',
    'Allocation Status', 'Source Type', 'Classification',
    'Company Expense', 'Office Expense', 'Office Allocation',
    'Amount', 'Status', 'Notes', 'View',
  ];
  const escape = (v) => `"${String(v ?? '')?.replace(/"/g, '""')}"`;
  const lines = [headers?.map(escape)?.join(',')];
  rows?.forEach(row => {
    const wfAcctRole = getAccountRole(row?.card_last4 || row?.account_last4);
    const amexInfo = getAmexAccountRole(row);
    const cls = getClassification(row);
    const cls3526 = classify3526Transaction(row);
    const isAmexCorp = isAmexCorporateRow(row);
    const isCorpShared = isCorporateSharedRow(row);

    let officeDisplay;
    if (amexInfo?.isMapped) officeDisplay = amexInfo?.office;
    else if (isCorpShared) officeDisplay = 'Corporate / Shared — Needs Allocation';
    else if (wfAcctRole) officeDisplay = wfAcctRole?.office;
    else officeDisplay = displayOffice(row?.office_name);

    let accountRoleLabel;
    if (amexInfo) {
      accountRoleLabel = amexInfo?.isMapped ? `amex_card — ${amexInfo?.office}` : 'amex_card — unknown card';
    } else if (cls3526) {
      accountRoleLabel = 'Eatontown Main / Corporate Shared Payment Account';
    } else if (wfAcctRole) {
      accountRoleLabel = wfAcctRole?.label;
    } else if (row?.card_last4) {
      accountRoleLabel = 'Account mapping not available yet.';
    } else {
      accountRoleLabel = '';
    }

    // Company Expense / Office Expense / Office Allocation
    let companyExpense = 'No';
    let officeExpense = 'No';
    let officeAllocation = 'Not Applicable';

    if (cls === 'corporate_shared_benefit_expense' || cls === 'corporate_shared_vendor_expense') {
      companyExpense = 'Yes';
      officeExpense = 'No';
      officeAllocation = 'Needed';
    } else if (cls === 'operating_expense' && !isAmexCorp) {
      companyExpense = 'Yes';
      officeExpense = 'Yes';
      officeAllocation = 'Mapped';
    } else if (cls === 'payroll') {
      companyExpense = 'Yes';
      officeExpense = 'Yes';
      officeAllocation = 'Mapped';
    } else if (cls === 'liability_payment_to_amex') {
      companyExpense = 'No';
      officeExpense = 'No';
      officeAllocation = 'Not Applicable';
    } else if (cls === 'payroll_funding') {
      companyExpense = 'No';
      officeExpense = 'No';
      officeAllocation = 'Not Applicable';
    }

    lines?.push([
      row?.expense_date || '',
      row?.posted_date || '',
      officeDisplay,
      row?.department_name || '',
      row?.category_name || '',
      row?.merchant_name || row?.vendor_name || '',
      row?.cardholder_name || '',
      row?.card_last4 ? `...${row?.card_last4}` : '',
      accountRoleLabel,
      isCorpShared ? 'Needs Review / Needs Allocation' : (amexInfo?.allocationStatus || ''),
      SOURCE_TYPE_LABELS?.[row?.source_type] || row?.source_type || '',
      cls,
      companyExpense,
      officeExpense,
      officeAllocation,
      parseFloat(row?.amount || 0)?.toFixed(2),
      row?.expense_status || '',
      row?.notes || '',
      viewLabel,
    ]?.map(escape)?.join(','));
  });
  return lines?.join('\n');
}

// ── CLASSIFICATION DISPLAY HELPERS ────────────────────────────────────────────

/**
 * Returns human-readable label and color for a classification string.
 */
function getClassificationDisplay(cls) {
  switch (cls) {
    // ── WF Banking-specific labels ──────────────────────────────────────────
    case 'wf_direct_operating_expense':
      return { label: 'WF Direct Operating Expense', color: 'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30', icon: 'Landmark' };
    case 'wf_amex_payment':
      return { label: 'WF AmEx Payment', color: 'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30', icon: 'CreditCard' };
    case 'wf_payroll_funding':
      return { label: 'WF Payroll Funding', color: 'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30', icon: 'Users' };
    case 'wf_corporate_shared_needs_allocation':
      return { label: 'WF Corporate / Shared — Needs Allocation', color: 'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30', icon: 'Building2' };
    case 'wf_api_imported_needs_category_review':
      return { label: 'WF API Imported — Needs Category Review', color: 'bg-amber-500/10 text-amber-700 border border-amber-400/30', icon: 'AlertCircle' };
    // ── Existing labels ─────────────────────────────────────────────────────
    case 'liability_payment_to_amex':
      return { label: 'Liability Payment to AmEx', color: 'bg-blue-500/10 text-blue-600 border border-blue-400/20', icon: 'CreditCard' };
    case 'payroll_funding':
      return { label: 'Payroll Funding', color: 'bg-purple-500/10 text-purple-600 border border-purple-400/20', icon: 'Users' };
    case 'internal_transfer':
      return { label: 'Internal Transfer / EFT', color: 'bg-blue-500/10 text-blue-600 border border-blue-400/20', icon: 'ArrowLeftRight' };
    case 'corporate_shared_benefit_expense':
      return { label: 'Corporate Shared Benefit Expense', color: 'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30', icon: 'Heart' };
    case 'corporate_shared_payroll_benefit_payment':
      return { label: 'Corporate Shared Payroll/Benefit', color: 'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30', icon: 'Users' };
    case 'corporate_shared_vendor_expense':
      return { label: 'Corporate Shared Vendor Expense', color: 'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30', icon: 'Building2' };
    case 'corporate_shared_needs_allocation':
      return { label: 'Corporate / Shared — AmEx', color: 'bg-purple-500/10 text-purple-700 border border-purple-400/30', icon: 'CreditCard' };
    case 'manual_exception_needs_review':
      return { label: 'Manual Entry — Needs Review', color: 'bg-amber-500/15 text-amber-700 border border-amber-400/30', icon: 'AlertTriangle' };
    case 'internal_transfer_or_reconciliation':
      return { label: 'Reconciliation / Not Expense', color: 'bg-blue-500/10 text-blue-600 border border-blue-400/20', icon: 'ArrowLeftRight' };
    case 'payroll':
      return { label: 'Payroll (Gusto)', color: 'bg-purple-500/10 text-purple-600 border border-purple-400/20', icon: 'Users' };
    case 'operating_expense':
      return { label: 'Operating Expense', color: 'bg-green-500/10 text-green-700 border border-green-400/20', icon: 'CheckCircle' };
    default:
      return { label: cls?.replace(/_/g, ' ') || 'Unknown', color: 'bg-muted text-muted-foreground', icon: 'Circle' };
  }
}

/**
 * Returns sub-row note text for a given classification.
 */
function getSubRowNote(cls, row) {
  const vendor = (row?.merchant_name || row?.vendor_name || '')?.toLowerCase();
  switch (cls) {
    case 'liability_payment_to_amex':
      return 'Excluded: AmEx vendor transactions are counted separately from the AmEx source. This WF payment is a liability payment, not an additional expense.';
    case 'payroll_funding':
      return 'Excluded: Gusto payroll is the payroll expense source. This WF debit is payroll funding, not a second expense.';
    case 'internal_transfer':
      return 'Excluded: Internal transfer, EFT, or bank deposit. Not an expense and not Dentrix revenue.';
    case 'corporate_shared_benefit_expense':
      return 'Corporate shared benefit expense (Oxford / UHC / Human Interest / 401k). Counted in company total. Needs office allocation.';
    case 'corporate_shared_payroll_benefit_payment':
      return 'Excluded until reviewed/allocated. Corporate shared payroll or benefit payment — not automatically counted as Eatontown or any office expense.';
    case 'corporate_shared_vendor_expense':
      return 'Corporate/shared vendor expense. Counted in company totals. Excluded from specific office totals until allocated to an office.';
    default:
      return null;
  }
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const ExpenseTable = ({ rows = [], loading = false, onExportCSV, isAmexMode = false }) => {
  const [activeView, setActiveView] = useState('included');
  const [sortKey, setSortKey] = useState('expense_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { setPage(0); }, [rows]);

  // Use AmEx-specific view labels when in AmEx mode
  const activeViews = isAmexMode ? AMEX_VIEWS : VIEWS;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  // Partition rows into view buckets
  // WF Banking rows have source_type='manual' (DB enum constraint) but must NOT go to manualRows —
  // they are routed by isTransferRow / isCorporateSharedRow / isIncludedInExpense().
  const manualRows = useMemo(() =>
    rows?.filter(r => {
      if (r?.source_tab === 'Banking') {
        // WF Banking needs-review rows go here — check wf_classification directly,
        // do NOT require isExcluded(meta) since some rows may not have excluded_from_expense set
        const meta = r?.allocation_metadata || {};
        const wfCls = (meta?.wf_classification || '')?.toLowerCase();
        return (
          wfCls === 'needs_review' ||
          wfCls === 'manual_entry_needs_review' ||
          wfCls === 'unassigned_needs_review' ||
          wfCls === ''
        );
      }
      return r?.source_type === 'manual';
    }),
    [rows]
  );

  // Transfers / Reconciliation: WF 3526 liability/funding/transfer rows + non-3526 transfers + WF Banking excluded transfer rows
  const transferRows = useMemo(() =>
    rows?.filter(r => isTransferRow(r)),
    [rows]
  );

  // Corporate / Shared: true corporate vendor/benefit expenses from 3526 + AmEx corporate cards + WF Banking corporate rows
  const corporateSharedRows = useMemo(() =>
    rows?.filter(r => !isTransferRow(r) && isCorporateSharedRow(r)),
    [rows]
  );

  // Included Expenses / WF Main Money-Out:
  // For WF Banking rows: use isWFMainMoneyOutCounted() — separate from isIncludedInExpense().
  // This counts AmEx bill payments and payroll funding from main WF accounts as cash-out.
  // For non-Banking rows: use the existing isIncludedInExpense() logic.
  const includedRows = useMemo(() =>
    rows?.filter(r => {
      const isWFBanking = r?.source_tab === 'Banking';
      if (!isWFBanking && r?.source_type === 'manual') return false;
      if (!isWFBanking && isTransferRow(r)) return false;
      if (!isWFBanking && isCorporateSharedRow(r)) return false;
      // WF Banking rows: use the new cash-basis WF Money-Out helper
      if (isWFBanking) {
        return isWFMainMoneyOutCounted(r);
      }
      return isIncludedInExpense(r);
    }),
    [rows]
  );

  const viewRows = useMemo(() => {
    switch (activeView) {
      case 'included':   return includedRows;
      case 'corporate':  return corporateSharedRows;
      case 'manual':     return manualRows;
      case 'transfers':  return transferRows;
      case 'all':        return rows;
      default:           return includedRows;
    }
  }, [activeView, includedRows, corporateSharedRows, manualRows, transferRows, rows]);

  const sorted = useMemo(() => {
    const copy = [...viewRows];
    copy?.sort((a, b) => {
      let av = a?.[sortKey] ?? '';
      let bv = b?.[sortKey] ?? '';
      if (sortKey === 'amount') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [viewRows, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted?.length / PAGE_SIZE);
  const pageRows = sorted?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Display expenses as positive absolute values even if stored as negative
  const viewTotal = useMemo(() =>
    viewRows?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0),
    [viewRows]
  );

  const handleExport = () => {
    if (loading || !viewRows?.length) return;
    const viewLabel = activeViews?.find(v => v?.id === activeView)?.label || activeView;
    const csv = exportViewToCSV(viewRows, viewLabel);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${activeView}-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* ── BANNER: WF mode vs AmEx mode ────────────────────────────────────── */}
      {isAmexMode ? (
        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-500/6 border border-indigo-500/20 rounded-xl text-xs text-indigo-700">
          <Icon name="CreditCard" size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" />
          <span>
            <strong>AmEx Detail / Reconciliation Transactions.</strong>{' '}
            Showing AmEx API and AmEx imported rows only. These rows are <em>reconciliation / supporting detail only</em> — not added to WF Main Money-Out expense totals.
            Source labels: AmEx API · AmEx Imported.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/6 border border-blue-500/20 rounded-xl text-xs text-blue-700">
          <Icon name="ShieldAlert" size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
          <span>
            <strong>Cash-Basis WF Main Money-Out model active.</strong>{' '}
            Total Expenses = withdrawals from WF main accounts (…3526 / …6093 / …8124 / …7975) only.
            Deposits, income, transfer-in, EFT clearing, and needs-review rows are excluded.
            AmEx and Gusto tabs are <em>reconciliation / supporting detail only</em> — not added again to the expense total.
          </span>
        </div>
      )}
      {/* ── MANUAL ENTRIES BANNER ───────────────────────────────────────────── */}
      {!isAmexMode && manualRows?.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/8 border border-amber-400/30 rounded-xl text-xs text-amber-700">
          <Icon name="AlertTriangle" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong>Manual entries found: {manualRows?.length}.</strong>{' '}
            These are excluded from totals until reviewed. Switch to the <em>Manual Exceptions</em> view to inspect them.
          </span>
        </div>
      )}
      {/* ── CORPORATE/SHARED ENTRIES BANNER ────────────────────────────────── */}
      {!isAmexMode && corporateSharedRows?.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-500/8 border border-indigo-400/30 rounded-xl text-xs text-indigo-700">
          <Icon name="Building2" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong>Corporate / Shared transactions found: {corporateSharedRows?.length}.</strong>{' '}
            Corporate / Shared is not an office. These transactions require allocation and are excluded from office totals until reviewed.
            Switch to the <em>Corporate / Shared</em> view to inspect them.
          </span>
        </div>
      )}
      {/* ── MAIN TABLE CARD ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-elevation-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="Table" size={15} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {isAmexMode ? 'AmEx Detail / Reconciliation Transactions' : 'Expense Transactions'}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{rows?.length?.toLocaleString()} total</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{fmt(viewTotal)}</span>
            <button
              onClick={handleExport}
              disabled={loading || !viewRows?.length}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="Download" size={13} />
              Export CSV
            </button>
          </div>
        </div>

        {/* ── VIEW SELECTOR ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border overflow-x-auto">
          {activeViews?.map(v => {
            const count = v?.id === 'included'  ? includedRows?.length
              : v?.id === 'corporate' ? corporateSharedRows?.length
              : v?.id === 'manual'    ? manualRows?.length
              : v?.id === 'transfers' ? transferRows?.length
              : rows?.length;
            const isActive = activeView === v?.id;
            return (
              <button
                key={v?.id}
                onClick={() => { setActiveView(v?.id); setPage(0); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={v?.icon} size={12} />
                {v?.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View-specific context notes */}
        {activeView === 'manual' && (
          <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-400/20 text-xs text-amber-700 flex items-center gap-2">
            <Icon name="Info" size={12} />
            <span>
              {isAmexMode
                ? 'AmEx rows with unassigned cardholder or needing review are shown below.' :'Manual Entry — Needs Review rows are shown below.'}{' '}
              <strong>Excluded from totals until reviewed.</strong>
            </span>
          </div>
        )}
        {activeView === 'transfers' && (
          <div className="px-4 py-2 bg-blue-500/5 border-b border-blue-500/20 text-xs text-blue-700 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon name="Info" size={12} />
              <span>
                {isAmexMode
                  ? <strong>AmEx Credits / Refunds.</strong>
                  : <strong>Reconciliation / Not Expense.</strong>}{' '}
                {isAmexMode
                  ? 'AmEx credit and refund rows (negative amounts). These reduce net AmEx spend.'
                  : 'Excluded from expense totals and not counted as Dentrix revenue.'}
              </span>
            </div>
            {!isAmexMode && (
              <div className="pl-5 text-blue-600 text-[11px]">
                Includes: WF ...3526 AmEx bill payments (liability payments — AmEx vendor txns already counted),
                Gusto payroll funding (Gusto payroll already counted), EFT transfers, bank deposits, and internal transfers.
              </div>
            )}
          </div>
        )}
        {activeView === 'included' && (
          <div className="px-4 py-2 bg-success/5 border-b border-success/20 text-xs text-success flex items-center gap-2">
            <Icon name="CheckCircle" size={12} />
            <span>
              {isAmexMode ? (
                <>
                  <strong>AmEx Charge Rows.</strong>{' '}
                  Showing AmEx API and AmEx imported charge rows (positive amounts). Source: AmEx API · AmEx Imported.
                  These are reconciliation detail only — not added to WF Main Money-Out totals.
                </>
              ) : (
                <>
                  <strong>WF Main Money-Out (cash-basis).</strong>{' '}
                  Showing true cash withdrawals from main WF accounts (…3526 / …6093 / …8124 / …7975).
                  Includes direct expenses, AmEx bill payments, and payroll funding from main accounts.
                  Deposits, income, transfer-ins, EFT clearing, and needs-review rows are excluded.
                </>
              )}
            </span>
          </div>
        )}
        {activeView === 'corporate' && (
          <div className="px-4 py-2 bg-indigo-500/5 border-b border-indigo-400/20 text-xs text-indigo-700 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon name="Building2" size={12} className="flex-shrink-0" />
              <span>
                {isAmexMode ? (
                  <strong>Corporate / Shared AmEx cards (…1001, …1002, …1003, …1077). Needs office allocation.</strong>
                ) : (
                  <strong>Corporate/shared vendor expenses are included in company totals but excluded from office totals until allocated.</strong>
                )}{' '}
                {!isAmexMode && 'Transfers, funding, and reconciliation rows are excluded from all expense totals.'}
              </span>
            </div>
            {!isAmexMode && (
              <div className="pl-5 text-indigo-600 text-[11px]">
                Includes: AmEx corporate cards (...1001, ...1002, ...1003, ...1077) — true vendor purchases counted as company expenses.
                WF ...3526 true corporate/shared vendor and benefit expenses also counted in company totals.
                WF ...3526 AmEx bill payments and Gusto payroll funding are in the <em>Transfers / Reconciliation</em> view (excluded as duplicates).
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={col?.sortable ? () => handleSort(col?.key) : undefined}
                    className={`px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap ${col?.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col?.label}
                      {col?.sortable && sortKey === col?.key && (
                        <Icon name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={11} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS?.length} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading expenses…
                    </div>
                  </td>
                </tr>
              ) : pageRows?.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS?.length} className="px-4 py-8 text-center text-muted-foreground">
                    No records in this view for the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows?.map((row, i) => {
                  const isManual = row?.source_type === 'manual' && row?.source_tab !== 'Banking';
                  const isTransfer = !isManual && isTransferRow(row);
                  const isCorpShared = !isManual && !isTransfer && isCorporateSharedRow(row);
                  const isAmexCorp = isAmexCorporateRow(row);
                  const isCorpOffice = isCorpOrUnmapped(row?.office_name);
                  const wfAcctRole = getAccountRole(row?.card_last4 || row?.account_last4);
                  const amexInfo = getAmexAccountRole(row);
                  const cls = getClassification(row);
                  const cls3526 = classify3526Transaction(row);
                  const included = isIncludedInExpense(row);
                  const clsDisplay = getClassificationDisplay(cls);
                  const subNote = getSubRowNote(cls, row);

                  // Determine Company Expense / Office Expense
                  const isCompanyExpense = included ||
                    cls === 'corporate_shared_benefit_expense' ||
                    cls === 'corporate_shared_vendor_expense';
                  const isOfficeExpense = included && !isCorpShared && !isAmexCorp;

                  // Resolve display office
                  const resolvedOfficeName = amexInfo?.isMapped
                    ? amexInfo?.office
                    : isCorpShared
                    ? 'Corporate / Shared — Needs Allocation'
                    : (row?.office_name || null);

                  const rowBg = isManual
                    ? 'bg-amber-500/5 hover:bg-amber-500/10'
                    : isTransfer
                    ? 'bg-blue-500/4 hover:bg-blue-500/8'
                    : isCorpShared
                    ? 'bg-indigo-500/5 hover:bg-indigo-500/10' :'hover:bg-muted/20';

                  return (
                    <React.Fragment key={row?.id || i}>
                      <tr className={`border-b border-border/50 transition-colors ${rowBg}`}>
                        {/* Date */}
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{row?.expense_date || '—'}</td>
                        {/* Posted */}
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row?.posted_date || '—'}</td>
                        {/* Office */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isAmexCorp ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-700 border border-purple-400/30">
                                <Icon name="Building2" size={9} />
                                Corporate / Shared
                              </span>
                              <span className="text-[9px] text-orange-500 flex items-center gap-0.5">
                                <Icon name="AlertCircle" size={8} />
                                Needs office allocation
                              </span>
                            </div>
                          ) : isCorpShared ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-700 border border-indigo-400/30">
                                <Icon name="Building2" size={9} />
                                Corporate / Shared
                              </span>
                              <span className="text-[9px] text-indigo-500 flex items-center gap-0.5">
                                <Icon name="AlertCircle" size={8} />
                                Needs Allocation
                              </span>
                            </div>
                          ) : isTransfer && cls3526 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 border border-blue-400/20">
                              <Icon name="ArrowLeftRight" size={9} />
                              Eatontown / Corp Shared
                            </span>
                          ) : row?.source_tab === 'Banking' && wfAcctRole ? (
                            (() => {
                              // Resolve display office for WF Banking rows by account mask.
                              // ...3526 is Eatontown Main but also used as a corporate/shared payment account.
                              // For payroll funding, AmEx bill payments, and corporate/shared rows → "Eatontown / Corp Shared"
                              // For direct operating expenses from 3526 → "Eatontown"
                              // For other main accounts → their mapped office name
                              const last4 = String(row?.card_last4 || row?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
                              const meta = row?.allocation_metadata || {};
                              const wfCls = (meta?.wf_classification || '')?.toLowerCase();
                              const isCorporateOrShared =
                                wfCls === 'liability_payment_amex' ||
                                wfCls === 'liability_payment_to_amex' ||
                                wfCls === 'amex_bill_payment' ||
                                wfCls === 'payroll_funding'|| wfCls?.startsWith('corporate_shared');
                              const officeLabel =
                                last4 === '3526' ? (isCorporateOrShared ?'Eatontown / Corp Shared' : 'Eatontown')
                                  : wfAcctRole?.office || wfAcctRole?.label;
                              const color =
                                last4 === '3526' && isCorporateOrShared ?'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30' :'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30';
                              return (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
                                  <Icon name="Landmark" size={9} />
                                  {officeLabel}
                                </span>
                              );
                            })()
                          ) : isCorpOffice ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 border border-orange-400/30">
                              <Icon name="AlertCircle" size={9} />
                              Unassigned / Needs Office Mapping
                            </span>
                          ) : (
                            <span className="font-medium text-foreground">{resolvedOfficeName}</span>
                          )}
                        </td>
                        {/* Department */}
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row?.department_name || '—'}</td>
                        {/* Category */}
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{row?.category_name || '—'}</td>
                        {/* Vendor */}
                        <td className="px-3 py-2 whitespace-nowrap text-foreground max-w-[140px] truncate" title={row?.merchant_name || row?.vendor_name}>
                          {row?.merchant_name || row?.vendor_name || '—'}
                        </td>
                        {/* Cardholder */}
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">{row?.cardholder_name || '—'}</td>
                        {/* Card / Account */}
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {row?.card_last4 ? `...${row?.card_last4}` : '—'}
                        </td>
                        {/* Source Type */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row?.source_tab === 'Banking' ?'bg-cyan-500/10 text-cyan-700 border border-cyan-400/30'
                              : SOURCE_COLORS?.[row?.source_type] || 'bg-muted text-muted-foreground'
                          }`}>
                            {row?.source_tab === 'Banking' && <Icon name="Landmark" size={9} />}
                            {isManual && row?.source_tab !== 'Banking' && <Icon name="AlertTriangle" size={9} />}
                            {row?.source_tab === 'Banking' ?'Wells Fargo Banking'
                              : (row?.source_type_label || SOURCE_TYPE_LABELS?.[row?.source_type] || row?.source_type || '—')}
                          </span>
                        </td>
                        {/* Account Role */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {amexInfo ? (
                            amexInfo?.isMapped ? (
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  amexInfo?.isCorporate
                                    ? 'bg-purple-500/10 text-purple-700 border border-purple-400/30' :'bg-green-500/10 text-green-700 border border-green-400/30'
                                }`}>
                                  <Icon name="CreditCard" size={9} />
                                  amex_card
                                </span>
                                <span className={`text-[9px] ${amexInfo?.isCorporate ? 'text-orange-500' : 'text-muted-foreground'}`}>
                                  {amexInfo?.allocationStatus === 'needs_office_allocation' ? 'needs_office_allocation' : 'mapped_to_office'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 border border-amber-400/30">
                                  <Icon name="CreditCard" size={9} />
                                  amex_card
                                </span>
                                <span className="text-[9px] text-muted-foreground">unknown_amex_card</span>
                              </div>
                            )
                          ) : cls3526 ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-700 border border-indigo-400/30">
                                <Icon name="Building2" size={9} />
                                Eatontown Main / Corp Shared
                              </span>
                              <span className="text-[9px] text-indigo-500">...3526</span>
                            </div>
                          ) : wfAcctRole ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              wfAcctRole?.type === 'eft_clearing' ?'bg-blue-500/10 text-blue-600 border border-blue-400/30'
                                : wfAcctRole?.isCorporateSharedCapable
                                ? 'bg-indigo-500/10 text-indigo-700 border border-indigo-400/30' :'bg-green-500/10 text-green-700 border border-green-400/30'
                            }`}>
                              {wfAcctRole?.type === 'eft_clearing'
                                ? <Icon name="ArrowLeftRight" size={9} />
                                : <Icon name="Building2" size={9} />}
                              {wfAcctRole?.label}
                            </span>
                          ) : row?.card_last4 ? (
                            <span className="text-[10px] text-muted-foreground italic">Account mapping not available yet.</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        {/* Classification */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${clsDisplay?.color}`}>
                              <Icon name={clsDisplay?.icon} size={9} />
                              {clsDisplay?.label}
                            </span>
                            {/* Extra badges for corporate/shared rows */}
                            {isCorpShared && (
                              <>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 border border-orange-400/20">
                                  <Icon name="Clock" size={9} />
                                  Needs Allocation
                                </span>
                                {/* Only show "Not in Office Totals" — NOT "Not Included in Totals" for company expenses */}
                                {(cls === 'corporate_shared_vendor_expense' || cls === 'corporate_shared_benefit_expense') ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                                    <Icon name="Check" size={9} />
                                    Company Expense
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                    <Icon name="X" size={9} />
                                    Not Included in Totals
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                  <Icon name="X" size={9} />
                                  Not in Office Totals
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        {/* Company Expense */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isCorpShared ? (
                            <div className="flex flex-col gap-0.5">
                              {(cls === 'corporate_shared_benefit_expense' || cls === 'corporate_shared_vendor_expense') ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                                    <Icon name="Check" size={9} />
                                    Yes
                                  </span>
                                  <span className="text-[9px] text-indigo-500 leading-tight">
                                    Office Expense: No
                                  </span>
                                  <span className="text-[9px] text-orange-500 leading-tight">
                                    Allocation: Needed
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                    <Icon name="X" size={9} />
                                    No
                                  </span>
                                  <span className="text-[9px] text-indigo-500 leading-tight">
                                    Excluded until reviewed
                                  </span>
                                </>
                              )}
                            </div>
                          ) : cls === 'liability_payment_to_amex' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                <Icon name="X" size={9} />
                                No
                              </span>
                              <span className="text-[9px] text-blue-500 leading-tight">
                                AmEx vendor txns counted separately
                              </span>
                            </div>
                          ) : cls === 'payroll_funding' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                <Icon name="X" size={9} />
                                No
                              </span>
                              <span className="text-[9px] text-purple-500 leading-tight">
                                Gusto payroll counted separately
                              </span>
                            </div>
                          ) : isManual ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              <Icon name="X" size={9} />
                              No
                            </span>
                          ) : included ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                                <Icon name="Check" size={9} />
                                Yes
                              </span>
                              <span className="text-[9px] text-success/70 leading-tight">
                                Office Expense: Yes
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              <Icon name="X" size={9} />
                              No
                            </span>
                          )}
                        </td>
                        {/* Office Expense (simplified column) */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isOfficeExpense ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                              <Icon name="Check" size={9} />
                              Yes
                            </span>
                          ) : isCorpShared ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                <Icon name="X" size={9} />
                                No
                              </span>
                              <span className="text-[9px] text-orange-500 leading-tight">Until allocated</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              <Icon name="X" size={9} />
                              No
                            </span>
                          )}
                        </td>
                        {/* Amount */}
                        <td className={`px-3 py-2 whitespace-nowrap font-semibold text-right ${
                          isManual
                            ? 'text-amber-600 line-through decoration-amber-400/60'
                            : isTransfer
                            ? 'text-blue-500/70'
                            : isCorpShared && (cls === 'corporate_shared_payroll_benefit_payment')
                            ? 'text-indigo-500/80 line-through decoration-indigo-400/50'
                            : isCorpShared
                            ? 'text-indigo-600 font-semibold' :'text-foreground'
                        }`}>
                          {fmt(row?.amount)}
                        </td>
                        {/* Status */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS?.[row?.expense_status] || 'bg-muted text-muted-foreground'}`}>
                            {row?.expense_status || '—'}
                          </span>
                        </td>
                        {/* Notes */}
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate" title={row?.notes}>{row?.notes || '—'}</td>
                      </tr>
                      {/* Sub-row notes */}
                      {isManual && (
                        <tr className="border-b border-amber-400/20 bg-amber-500/5">
                          <td colSpan={COLUMNS?.length} className="px-3 py-1">
                            <span className="text-[10px] text-amber-600 flex items-center gap-1">
                              <Icon name="Info" size={9} />
                              Not included in totals unless reviewed.
                            </span>
                          </td>
                        </tr>
                      )}
                      {isTransfer && subNote && (
                        <tr className="border-b border-blue-400/20 bg-blue-500/4">
                          <td colSpan={COLUMNS?.length} className="px-3 py-1">
                            <span className="text-[10px] text-blue-600 flex items-center gap-1">
                              <Icon name="Info" size={9} />
                              {subNote}
                            </span>
                          </td>
                        </tr>
                      )}
                      {isCorpShared && subNote && (
                        <tr className="border-b border-indigo-400/20 bg-indigo-500/4">
                          <td colSpan={COLUMNS?.length} className="px-3 py-1">
                            <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                              <Icon name="Info" size={9} />
                              {subNote}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted?.length)} of {sorted?.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="ChevronLeft" size={14} />
              </button>
              <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseTable;
