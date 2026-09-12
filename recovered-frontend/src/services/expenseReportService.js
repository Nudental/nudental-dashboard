/**
 * expenseReportService.js — CENTRALIZED EXPENSE REPORT SERVICE
 *
 * FILTER FIELD MAPPING (canonical):
 *   UI filter key    → service param       → DB column
 *   ─────────────────────────────────────────────────────────
 *   office           → officeIds (UUID[])  → expenses.office_id
 *   department       → departmentNames[]   → expenses.department_name
 *   category         → categoryNames[]     → expenses.category_name
 *   sourceType       → sourceTypes[]       → expenses.source_type
 *   paymentSource    → paymentSources[]    → expenses.payment_source
 *   cardholderName   → cardholderName str  → expenses.cardholder_name (ilike)
 *   merchantName     → merchantName str    → expenses.merchant_name  (ilike)
 *   status           → statuses[]          → expenses.expense_status
 *   datePreset       → startDate/endDate   → expenses.expense_date
 *
 * OFFICE NORMALIZATION:
 *   All office_name values are normalized via normalizeOfficeName() on read.
 *   Office filtering is done via office_id (UUID) — never by name string.
 *   UI string → UUID translation happens in ExpenseReport.jsx:buildServiceParams().
 *
 * WF ...3526 DOUBLE-COUNT PREVENTION:
 *   ...3526 is the Eatontown main operating account AND is used for company-wide
 *   payments. Each transaction is classified by what it actually represents:
 *
 *   1. AmEx bill payment → liability_payment_to_amex
 *      excluded: AmEx vendor transactions are already counted from AmEx source
 *   2. Gusto/payroll funding → payroll_funding
 *      excluded: Gusto payroll is already counted from Gusto source
 *   3. Internal transfer / EFT / deposit → internal_transfer
 *      excluded: not an expense, not revenue
 *   4. Benefits (Oxford/UHC/Human Interest/401k) → corporate_shared_benefit_expense
 *      included in company total ONLY if not already counted from Gusto benefits
 *   5. Other payroll/benefit vendor → corporate_shared_payroll_benefit_payment
 *      excluded until reviewed/allocated
 *   6. Other true corporate vendor payment → corporate_shared_vendor_expense
 *      included in company total, excluded from specific office totals until allocated
 */

import { supabase } from '../lib/supabase';
import { normalizeOfficeName } from '../utils/officeNormalizer';
import { enrichAmexRows, resolveAmexOfficeName, isAmexSource } from '../utils/amexCardMapping';

// ── CANONICAL OFFICE NAMES ────────────────────────────────────────────────────
export const CANONICAL_OFFICES = ['Brick', 'Barnegat', 'Staten Island', 'Eatontown'];

// ── AMEX CORPORATE CARD LAST4s ────────────────────────────────────────────────
// These cards are not assigned to a specific dental office.
// Their transactions are counted as company-level expenses, not office-level.
export const CORPORATE_AMEX_CARD_LAST4S = new Set(['1001', '1002', '1003', '1077']);

// ── WF ...3526 KEYWORD LISTS ──────────────────────────────────────────────────

// ── WF MAIN OPERATING ACCOUNT LAST4s ─────────────────────────────────────────
// These are the four main operating accounts used for cash-basis expense tracking.
// Only withdrawals/money-out from these accounts count as WF Main Money-Out expenses.
//   Eatontown:    ...3526
//   Barnegat:     ...6093
//   Brick:        ...8124
//   Staten Island: ...7975
export const WF_MAIN_ACCOUNT_LAST4S = new Set(['3526', '6093', '8124', '7975']);

/**
 * Returns true if a row is from one of the four WF main operating accounts.
 */
export function isWFMainAccount(r) {
  const last4 = String(r?.card_last4 || r?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
  return WF_MAIN_ACCOUNT_LAST4S?.has(last4);
}

/**
 * Returns true if a Banking row is a true money-out / withdrawal from a main WF account.
 * Cash-basis: positive amounts stored as positive (debit), or negative amounts stored as negative.
 * Prefers allocation_metadata direction/type if present.
 */
export function isWFMainMoneyOut(r) {
  if (r?.source_tab !== 'Banking') return false;
  if (!isWFMainAccount(r)) return false;
  const meta = r?.allocation_metadata || {};
  // If explicit direction field exists, use it
  const direction = (meta?.direction || meta?.transaction_type || meta?.plaid_type || '')?.toLowerCase();
  if (direction) {
    if (direction === 'outflow' || direction === 'debit' || direction === 'withdrawal' || direction === 'money_out') return true;
    if (direction === 'inflow' || direction === 'credit' || direction === 'deposit' || direction === 'money_in') return false;
  }
  // Fall back to amount sign: positive = money-out (debit stored as positive)
  const amt = parseFloat(r?.amount);
  if (!isNaN(amt)) return amt > 0;
  return false;
}

/**
 * isWFMainMoneyOutCounted — SEPARATE from isIncludedInExpense().
 *
 * Cash-basis rule: WF Main Money-Out means true cash leaving the Wells Fargo MAIN
 * operating accounts (3526 / 6093 / 8124 / 7975).
 *
 * COUNTED:
 *   1. main_operating_direct_expense — direct vendor/operating expenses
 *   2. liability_payment_amex / liability_payment_to_amex — AmEx bill payments from WF main accounts
 *   3. payroll_funding — payroll funding from WF main accounts
 *   4. corporate_shared_vendor_expense — true corporate/shared vendor expenses from main account 3526
 *      (company total only, until allocated to an office)
 *
 * EXCLUDED:
 *   - deposits, income, transfer-in rows
 *   - internal transfers between company accounts
 *   - EFT clearing / reconciliation transfers
 *   - unassigned_needs_review / manual_entry_needs_review
 *   - any unclear/non-expense row that needs review
 *   - non-main-account WF rows (EFT clearing accounts 4083/9976/4416/0538)
 *
 * NOTE: This helper does NOT blindly exclude rows because
 * allocation_metadata.excluded_from_expense=true. AmEx liability payments and
 * payroll funding were originally excluded only to prevent double-counting under
 * the old AmEx/Gusto model. Under the cash-basis WF Money-Out model they ARE
 * counted as real cash leaving the bank.
 *
 * AmEx vendor detail rows and Gusto payroll detail rows are reconciliation/
 * supporting detail only — they must NOT be added again here.
 */
export function isWFMainMoneyOutCounted(r) {
  // Must be a Banking row from a main WF operating account
  if (r?.source_tab !== 'Banking') return false;
  if (!isWFMainAccount(r)) return false;

  const meta = r?.allocation_metadata || {};
  const wfCls = (meta?.wf_classification || '')?.toLowerCase();

  // ── ALWAYS EXCLUDE ────────────────────────────────────────────────────────
  // Needs-review / manual-entry / unclassified rows — not counted until reviewed
  if (
    wfCls === 'needs_review' ||
    wfCls === 'manual_entry_needs_review' ||
    wfCls === 'unassigned_needs_review' ||
    wfCls === ''
  ) return false;

  // Internal transfers, EFT clearing, deposits, income — never cash-out expenses
  if (
    wfCls === 'internal_transfer' ||
    wfCls === 'eft_clearing' ||
    wfCls === 'deposit' ||
    wfCls === 'income' ||
    wfCls === 'transfer_in' ||
    wfCls === 'transfer_out_internal'
  ) return false;

  // ── ALWAYS COUNT (regardless of excluded_from_expense flag) ───────────────
  // AmEx bill payments from main WF accounts = real cash leaving the bank
  if (
    wfCls === 'liability_payment_to_amex' ||
    wfCls === 'liability_payment_amex' ||
    wfCls === 'amex_bill_payment'
  ) {
    // Verify it is actually money-out (positive amount or explicit direction)
    return _isMoneyOutAmount(r);
  }

  // Payroll funding from main WF accounts = real cash leaving the bank
  if (wfCls === 'payroll_funding') {
    return _isMoneyOutAmount(r);
  }

  // ── STANDARD DIRECT EXPENSE ───────────────────────────────────────────────
  if (wfCls === 'main_operating_direct_expense') {
    return _isMoneyOutAmount(r);
  }

  // Corporate/shared vendor expense from main account (3526) — company total only
  if (
    wfCls === 'corporate_shared_vendor_expense' ||
    wfCls === 'corporate_shared_benefit_expense'
  ) {
    return _isMoneyOutAmount(r);
  }

  // ── FALLBACK: no wf_classification set ───────────────────────────────────
  // If excluded_from_expense is explicitly set, respect it for unclassified rows
  const excluded = meta?.excluded_from_expense;
  if (excluded === true || excluded === 1 || excluded === '1' || excluded === 'true') return false;

  // For unclassified rows that are not flagged excluded, use amount sign as proxy
  // Only count if it looks like a money-out (positive amount)
  return _isMoneyOutAmount(r);
}

/**
 * isWFDirectOperatingExpense — STRICT helper for verified operating expense totals.
 *
 * V290 FIX: This is the correct helper for Total Expenses / KPI totals.
 * It is STRICTER than isWFMainMoneyOutCounted() — it intentionally EXCLUDES:
 *   - payroll_funding  (same money as Gusto payroll, counted via Gusto source)
 *   - liability_payment_to_amex / amex_bill_payment  (same money as AmEx vendor charges)
 *
 * INCLUDED:
 *   - main_operating_direct_expense  (direct vendor/operating expenses)
 *   - corporate_shared_vendor_expense  (true corporate vendor expenses)
 *   - corporate_shared_benefit_expense  (direct benefit payments, if not from Gusto)
 *
 * EXCLUDED (in addition to isWFMainMoneyOutCounted exclusions):
 *   - payroll_funding  — WF bank debit funding Gusto; Gusto rows already counted
 *   - liability_payment_to_amex / liability_payment_amex / amex_bill_payment
 *     — WF payment to AmEx; AmEx vendor charges already counted from AmEx source
 *
 * V291 SIGN FIX: For confirmed direct operating classifications, use direction field
 * first (if present), then Math.abs(amount) > 0 — never raw amount > 0.
 * This ensures WF direct operating expenses stored as negative amounts are not
 * silently excluded before Math.abs() is reached in the summing loop.
 *
 * Use isWFMainMoneyOutCounted() only for cash-basis WF Money-Out display/reconciliation.
 * Use isWFDirectOperatingExpense() for Total Expenses, expense ratios, and KPI totals.
 */
export function isWFDirectOperatingExpense(r) {
  // Must be a Banking row from a main WF operating account
  if (r?.source_tab !== 'Banking') return false;
  if (!isWFMainAccount(r)) return false;

  const meta = r?.allocation_metadata || {};
  const wfCls = (meta?.wf_classification || '')?.toLowerCase();

  // ── ALWAYS EXCLUDE ────────────────────────────────────────────────────────
  // Needs-review / unclassified rows
  if (
    wfCls === 'needs_review' ||
    wfCls === 'manual_entry_needs_review' ||
    wfCls === 'unassigned_needs_review' ||
    wfCls === ''
  ) return false;

  // Internal transfers, EFT clearing, deposits, income
  if (
    wfCls === 'internal_transfer' ||
    wfCls === 'eft_clearing' ||
    wfCls === 'deposit' ||
    wfCls === 'income' ||
    wfCls === 'transfer_in' ||
    wfCls === 'transfer_out_internal'
  ) return false;

  // V290 FIX: Exclude payroll_funding — same money as Gusto payroll (counted once via Gusto source)
  if (wfCls === 'payroll_funding') return false;

  // V290 FIX: Exclude AmEx bill payments — same money as AmEx vendor charges (counted once via AmEx source)
  if (
    wfCls === 'liability_payment_to_amex' ||
    wfCls === 'liability_payment_amex' ||
    wfCls === 'amex_bill_payment'
  ) return false;

  // V292 FIX: Exclude high-confidence internal funding transfers and AmEx liability payments
  // detected by category/merchant/notes signals — even if wf_classification is set to
  // main_operating_direct_expense or corporate_shared_vendor_expense (misclassification).
  // This catches: ONLINE TRANSFER TO AGN DENTAL PRACTICES, NEW JERSEY - AME PAYMENT, etc.
  if (isInternalFundingTransfer(r)) return false;

  // ── INCLUDED: Direct operating expenses ──────────────────────────────────
  // V291 SIGN FIX: For confirmed direct operating classifications, check direction
  // field first (explicit inflow = exclude), then use Math.abs(amount) > 0.
  // Do NOT use raw amount > 0 — a valid WF expense stored as negative would be
  // incorrectly excluded before the Math.abs() summing step is ever reached.
  if (
    wfCls === 'main_operating_direct_expense' ||
    wfCls === 'corporate_shared_vendor_expense' ||
    wfCls === 'corporate_shared_benefit_expense'
  ) {
    // If direction explicitly indicates inflow/credit/deposit, exclude
    const direction = (meta?.direction || meta?.transaction_type || meta?.plaid_type || '')?.toLowerCase();
    if (direction) {
      if (direction === 'inflow' || direction === 'credit' || direction === 'deposit' || direction === 'money_in') return false;
      if (direction === 'outflow' || direction === 'debit' || direction === 'withdrawal' || direction === 'money_out') return true;
    }
    // No direction field — include if Math.abs(amount) > 0 (safe for negative-stored debits)
    return Math.abs(parseFloat(r?.amount) || 0) > 0;
  }

  // ── FALLBACK: no wf_classification set ───────────────────────────────────
  const excluded = meta?.excluded_from_expense;
  if (excluded === true || excluded === 1 || excluded === '1' || excluded === 'true') return false;

  // For unclassified rows not flagged excluded, use _isMoneyOutAmount (direction + sign)
  return _isMoneyOutAmount(r);
}

/**
 * Internal helper: returns true if the row represents a money-out (debit/withdrawal).
 * Checks explicit direction field first, falls back to amount sign.
 * Displays expenses as positive absolute values — stored positive = debit.
 */
function _isMoneyOutAmount(r) {
  const meta = r?.allocation_metadata || {};
  const direction = (meta?.direction || meta?.transaction_type || meta?.plaid_type || '')?.toLowerCase();
  if (direction) {
    if (direction === 'outflow' || direction === 'debit' || direction === 'withdrawal' || direction === 'money_out') return true;
    if (direction === 'inflow' || direction === 'credit' || direction === 'deposit' || direction === 'money_in') return false;
  }
  // Fall back to amount sign: positive = money-out (debit stored as positive)
  const amt = parseFloat(r?.amount);
  if (!isNaN(amt)) return amt > 0;
  return false;
}

// AmEx bill payment keywords — WF→AmEx payments are liability payments, NOT additional expenses
const AMEX_BILL_PAYMENT_KEYWORDS = [
  'american express',
  'amex',
  'amex payment',
  'american express payment',
  'amex bill',
  'amex card payment',
];

// Gusto / payroll funding keywords — WF→Gusto debits are payroll funding, NOT second expenses
const GUSTO_PAYROLL_FUNDING_KEYWORDS = [
  'gusto',
  'gusto payroll',
  'payroll funding',
  'payroll direct deposit',
  'payroll tax deposit',
  'irs payroll',
  'eftps',
];

// Benefits vendor keywords — direct benefit payments from ...3526
const BENEFITS_VENDOR_KEYWORDS = [
  'oxford',
  'uhc',
  'united healthcare',
  'united health',
  'health insurance',
  'human interest',
  '401k',
  '401(k)',
  'retirement',
  'benefits',
  'employee benefits',
];

// Internal transfer / reconciliation keywords
const INTERNAL_TRANSFER_KEYWORDS = [
  'transfer',
  'eft to main',
  'eft deposit',
  'bank transfer',
  'internal transfer',
  'main account deposit',
  'insurance eft',
  'wells fargo transfer',
  'eft clearing',
  'reconciliation',
  'income deposit',
  'deposit',
];

// ── V292: INTERNAL FUNDING TRANSFER EXCLUSION SIGNALS ────────────────────────
// Category names that indicate an internal transfer (not an operating expense)
const INTERNAL_TRANSFER_CATEGORY_SIGNALS = [
  'internal transfer',
  'transfer in',
  'transfer out',
  'account transfer',
  'eft clearing',
  'inter-office transfer',
  'interoffice transfer',
  'office transfer',
  'funding transfer',
];

// Merchant / vendor / notes / description signals for internal funding transfers
const INTERNAL_FUNDING_MERCHANT_SIGNALS = [
  'online transfer to agn dental practices',
  'online transfer from nu dental',
  'online transfer from nu dental of barnegat',
  'online transfer from nu dental of brick',
  'transfer to 3526',
  'transfer from 6093',
  'transfer from 8124',
  'transfer from 7975',
  'bankcard sys coms dep',
  'synchony bank mtot dep',
  'synchrony bank mtot dep',
  'recurring transfer to td bank',
  'inter-office funding',
  'interoffice funding',
  'office to 3526',
  'office-to-3526',
  'agn dental practices',
  'nu dental of barnegat',
  'nu dental of brick',
  'nu dental barnegat',
  'nu dental brick',
];

// wf_classification values that indicate internal funding transfers
const INTERNAL_FUNDING_WF_CLASSIFICATIONS = [
  'internal_transfer',
  'transfer_out_internal',
  'transfer_in',
  'eft_clearing',
  'deposit',
  'office_to_3526_funding_transfer',
];

// AmEx liability payment signals (merchant/vendor/notes/description)
const AMEX_LIABILITY_MERCHANT_SIGNALS = [
  'new jersey - ame payment',
  'new jersey - amex payment',
  'nj - ame payment',
  'nj - amex payment',
  'american express payment',
  'amex payment',
  'amex bill payment',
  'american express bill',
];

/**
 * isInternalFundingTransfer — V292 targeted exclusion helper.
 *
 * Returns true if a row is a high-confidence internal funding transfer or
 * AmEx liability payment that must NOT feed Total Verified Operating Expenses.
 *
 * Detection signals (any one match = excluded):
 * 1. category_name contains an internal transfer signal
 * 2. merchant_name / vendor_name / notes / description contains an internal
 *    funding transfer signal (ONLINE TRANSFER TO AGN DENTAL PRACTICES, etc.)
 * 3. allocation_metadata.wf_classification is an internal transfer classification
 * 4. merchant/notes contains an AmEx liability payment signal
 *    (NEW JERSEY - AME PAYMENT, etc.) — only when source is NOT amex_api/amex_statement_import
 *    to avoid excluding legitimate AmEx vendor charges
 *
 * SAFE: Does NOT exclude rows based on positive/negative amount sign alone.
 * SAFE: Does NOT exclude Brick Rent, Barnegat Rent, FirstEnergy, Patterson Dental,
 *       or other legitimate vendor/rent/utility rows unless they match the above signals.
 */
export function isInternalFundingTransfer(r) {
  const meta = r?.allocation_metadata || {};
  const wfCls = (meta?.wf_classification || '')?.toLowerCase();
  const category = (r?.category_name || '')?.toLowerCase();
  const merchant = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
  const notes = (r?.notes || r?.description || '')?.toLowerCase();
  const haystack = `${category} ${merchant} ${notes}`;

  // Signal 1: wf_classification is an internal transfer classification
  if (INTERNAL_FUNDING_WF_CLASSIFICATIONS?.includes(wfCls)) return true;

  // Signal 2: category_name contains an internal transfer signal
  if (INTERNAL_TRANSFER_CATEGORY_SIGNALS?.some(sig => category?.includes(sig))) return true;

  // Signal 3: merchant/vendor/notes contains an internal funding transfer signal
  if (INTERNAL_FUNDING_MERCHANT_SIGNALS?.some(sig => haystack?.includes(sig))) return true;

  // Signal 4: AmEx liability payment misclassified as direct expense
  // Only apply when source is NOT a real AmEx source (amex_api / amex_statement_import)
  // to avoid excluding legitimate AmEx vendor charges
  const sourceType = (r?.source_type || '')?.toLowerCase();
  if (
    sourceType !== 'amex_api' &&
    sourceType !== 'amex_statement_import' &&
    AMEX_LIABILITY_MERCHANT_SIGNALS?.some(sig => haystack?.includes(sig))
  ) return true;

  return false;
}

// General payroll/benefit vendor keywords (broader set for corporate_shared_payroll_benefit_payment)
const WF_3526_CORPORATE_VENDORS = [
  'gusto',
  'payroll',
  'payroll tax',
  'payroll taxes',
  'oxford',
  'uhc',
  'united healthcare',
  'united health',
  'health insurance',
  'human interest',
  '401k',
  '401(k)',
  'retirement',
  'benefits',
  'employee benefits',
];

const WF_3526_CORPORATE_CATEGORIES = [
  'payroll',
  'payroll taxes',
  'employee benefits',
  'health insurance',
  'retirement',
  '401k',
  '401(k)',
  'benefits',
];

// ── WF ...3526 CLASSIFICATION HELPERS ────────────────────────────────────────

function _get3526Haystack(r) {
  const vendor   = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
  const notes    = (r?.notes || '')?.toLowerCase();
  const category = (r?.category_name || '')?.toLowerCase();
  return { vendor, notes, category, haystack: `${vendor} ${notes} ${category}` };
}

function _is3526(r) {
  const last4 = String(r?.card_last4 || r?.account_last4 || '')?.replace(/\D/g, '')?.slice(-4);
  return last4 === '3526';
}

/**
 * Returns true if this WF ...3526 transaction is an AmEx bill payment.
 * Liability payment — NOT an additional expense.
 */
export function isWF3526AmexBillPayment(r) {
  if (!_is3526(r)) return false;
  const { haystack } = _get3526Haystack(r);
  return AMEX_BILL_PAYMENT_KEYWORDS?.some(kw => haystack?.includes(kw));
}

/**
 * Returns true if this WF ...3526 transaction is Gusto payroll funding.
 * Payroll funding — NOT a second expense (Gusto payroll already counted).
 */
export function isWF3526GustoPayrollFunding(r) {
  if (!_is3526(r)) return false;
  const { haystack } = _get3526Haystack(r);
  return GUSTO_PAYROLL_FUNDING_KEYWORDS?.some(kw => haystack?.includes(kw));
}

/**
 * Returns true if this WF ...3526 transaction is an internal transfer / reconciliation.
 * Not an expense, not revenue.
 *
 * V291 FIX: Removed blanket "parseFloat(amount) < 0 => internal_transfer" rule.
 * A negative amount alone does not prove a row is an internal transfer — it could be
 * a legitimate Eatontown/corporate expense stored as a negative debit.
 * Classification now relies on direction field and keyword/description evidence only.
 */
export function isWF3526InternalTransfer(r) {
  if (!_is3526(r)) return false;
  // V291 FIX: Do NOT classify as internal transfer based solely on negative amount sign.
  // If direction explicitly indicates inflow/credit/deposit, treat as reconciliation/credit.
  const meta = r?.allocation_metadata || {};
  const direction = (meta?.direction || meta?.transaction_type || meta?.plaid_type || '')?.toLowerCase();
  if (direction === 'inflow' || direction === 'credit' || direction === 'deposit' || direction === 'money_in') return true;
  // Use keyword/description evidence only
  const { haystack } = _get3526Haystack(r);
  return INTERNAL_TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
}

/**
 * Returns true if this WF ...3526 transaction is a direct benefits payment
 * (Oxford, UHC, Human Interest, 401k, etc.).
 */
export function isWF3526BenefitsPayment(r) {
  if (!_is3526(r)) return false;
  const { haystack } = _get3526Haystack(r);
  return BENEFITS_VENDOR_KEYWORDS?.some(kw => haystack?.includes(kw));
}

/**
 * Returns true if this WF ...3526 transaction matches general payroll/benefit vendors
 * (broader check used for corporate_shared_payroll_benefit_payment classification).
 */
function isWF3526CorporateSharedRow(r) {
  if (!_is3526(r)) return false;
  const { haystack, category } = _get3526Haystack(r);
  return (
    WF_3526_CORPORATE_VENDORS?.some(kw => haystack?.includes(kw)) ||
    WF_3526_CORPORATE_CATEGORIES?.some(kw => category?.includes(kw))
  );
}

/**
 * Full WF ...3526 classification hierarchy.
 * Returns a classification string for any WF ...3526 transaction.
 * Returns null if the row is NOT from ...3526.
 *
 * Priority order (first match wins):
 * 1. AmEx bill payment      → liability_payment_to_amex
 *    excluded: AmEx vendor txns already counted from AmEx source
 * 2. Gusto/payroll funding  → payroll_funding
 *    excluded: Gusto payroll already counted from Gusto source
 * 3. Internal transfer/EFT  → internal_transfer
 *    excluded: not an expense, not revenue
 * 4. Benefits payment       → corporate_shared_benefit_expense
 *    included in company total ONLY if not already from Gusto benefits
 * 5. Other payroll/benefit  → corporate_shared_payroll_benefit_payment
 *    excluded until reviewed/allocated
 * 6. Other corporate vendor → corporate_shared_vendor_expense
 *    included in company total, excluded from specific office totals until allocated
 */
export function classify3526Transaction(r) {
  if (!_is3526(r)) return null;
  if (isWF3526AmexBillPayment(r))    return 'liability_payment_to_amex';
  if (isWF3526GustoPayrollFunding(r)) return 'payroll_funding';
  if (isWF3526InternalTransfer(r))   return 'internal_transfer';
  if (isWF3526BenefitsPayment(r))    return 'corporate_shared_benefit_expense';
  if (isWF3526CorporateSharedRow(r)) return 'corporate_shared_payroll_benefit_payment';
  // Any remaining ...3526 transaction that is a true vendor expense
  return 'corporate_shared_vendor_expense';
}

/**
 * Returns true if this ...3526 row should be INCLUDED in company-level expense totals.
 * Only true corporate vendor expenses and direct benefit payments (not already from Gusto) qualify.
 */
export function isWF3526IncludedInCompanyExpense(r, hasGustoBenefitsSource = false) {
  const cls = classify3526Transaction(r);
  if (!cls) return false;
  if (cls === 'corporate_shared_benefit_expense') return !hasGustoBenefitsSource;
  if (cls === 'corporate_shared_vendor_expense') return true;
  return false;
}

// ── EXPENSE CATEGORY GROUPS ───────────────────────────────────────────────────
export const EXPENSE_CATEGORY_GROUPS = {
  PAYROLL: 'Payroll',
  BENEFITS: 'Employee Benefits',
  AMEX: 'American Express / Corporate Card',
  UTILITIES: 'Utilities',
  OCCUPANCY: 'Occupancy',
  INSURANCE: 'Insurance',
  COMPLIANCE: 'Regulatory / Compliance',
  SUPPLIES: 'Supplies',
  MARKETING: 'Marketing',
  OTHER: 'Other',
};

// ── SOURCE TYPE LABELS ────────────────────────────────────────────────────────
export const SOURCE_TYPE_LABELS = {
  manual: 'Manual Entry — Needs Review',
  gusto: 'Gusto Payroll',
  gusto_payroll: 'Gusto Payroll',
  payroll: 'Payroll',
  quickbooks: 'QuickBooks',
  amex_api: 'AmEx API',
  amex_statement_import: 'AmEx Statement Import',
  utility_import: 'Utility Import',
  insurance_import: 'Insurance Import',
  recurring: 'Recurring',
  banking: 'WF Main Money-Out',
  wells_fargo: 'WF Main Money-Out',
  other: 'Other',
};

// ── WF BANKING HELPERS ────────────────────────────────────────────────────────
/**
 * Returns true if a row is a valid WF Banking direct expense to include.
 * source_tab = 'Banking'
 * allocation_metadata.wf_classification = 'main_operating_direct_expense'
 * allocation_metadata.excluded_from_expense !== true
 */
export function isWFBankingIncluded(r) {
  if (r?.source_tab !== 'Banking') return false;
  // Must be from one of the four main operating accounts
  if (!isWFMainAccount(r)) return false;
  const meta = r?.allocation_metadata || {};
  if (meta?.excluded_from_expense === true) return false;
  return meta?.wf_classification === 'main_operating_direct_expense';
}

/**
 * Returns true if a row should be excluded from all totals/charts.
 * Applies to both Banking rows and existing rows.
 */
export function isExcludedFromExpense(r) {
  const meta = r?.allocation_metadata || {};
  return meta?.excluded_from_expense === true;
}

/**
 * Resolve source_type_label for a row, handling WF Banking rows
 * that may have source_type = null or 'manual'.
 * V291: WF Banking rows that pass isWFDirectOperatingExpense are labeled
 * "WF Direct Operating Expense". Broad cash-basis rows retain "WF Main Money-Out"
 * label only in reconciliation/cash-movement contexts.
 */
export function resolveSourceTypeLabel(r) {
  if (r?.source_tab === 'Banking') {
    if (isWFDirectOperatingExpense(r)) return 'WF Direct Operating Expense';
    return 'WF Main Money-Out';
  }
  return SOURCE_TYPE_LABELS?.[r?.source_type] || r?.source_type || 'Other';
}

// ── MIDDLEWARE API BASE ───────────────────────────────────────────────────────
const MIDDLEWARE_API_BASE = 'https://api.nudashboard.com/v2';

// V564: Module-level store for extra summary fields returned by fetchExpenseSummary.
// These are populated during the API call and consumed by fetchExpenseKPIs.
let _lastSummaryExtras = {
  amexCharges: null,
  amexCredits: null,
  payrollTaxes: null,
  benefits: null,
  wfReferenceBuckets: null,
  expenseModel: null,
};
function _middlewareHeaders() {
  return {
    'X-API-Key': import.meta.env?.VITE_ASCEND_API_KEY || '',
    'Content-Type': 'application/json',
  };
}

// ── FETCH EXPENSE SUMMARY (aggregate endpoint — no pagination trap) ────────────
/**
 * fetchExpenseSummary — V295 FIX
 *
 * Calls /v2/expenses/summary to get aggregate KPI totals.
 * This endpoint returns pre-aggregated totals server-side, bypassing the
 * client-side pagination trap (limit=500 / limit=2000 row caps).
 *
 * For AmEx: returns live posted-only AmEx total from API/Supabase reconciliation.
 * For Total Expenses: payrollExpense + amex (from summary) + wfBankingExpense.
 *
 * @returns {{ amex: number|null, payroll: number|null, wfDirect: number|null, error: string|null }}
 */
async function fetchExpenseSummary({ startDate, endDate, officeIds = [] } = {}) {
  // ── Step 1: Try the middleware aggregate API ──────────────────────────────
  // V297 FIX: Send recognized backend parameters only.
  // Backend accepts: date_from, date_to, startDate, endDate, year, month, quarter
  // Do NOT send unrecognized params like timeRange, period, range.
  // V559 FIX: Always send startDate/endDate — never send year= alone.
  // Sending year= causes the backend to return the full calendar year total,
  // ignoring endDate. This broke YTD ranges (e.g. 2026-01-01 to 2026-05-18)
  // by returning the full 2026 total instead of the clipped YTD total.
  let apiAmex = null;
  let apiPayroll = null;
  let apiWfDirect = null;
  let apiTotalExpenses = null;
  let apiSucceeded = false;

  try {
    const params = new URLSearchParams();

    // Always send exact startDate/endDate — never override with year= alone.
    // The year= param causes the backend to ignore endDate and return the full
    // calendar year, which breaks partial-year ranges (YTD, monthly rows, etc.).
    if (startDate) params?.set('startDate', startDate);
    if (endDate) params?.set('endDate', endDate);
    if (officeIds?.length === 1) params?.set('officeId', officeIds?.[0]);

    const url = `${MIDDLEWARE_API_BASE}/expenses/summary?${params?.toString()}`;
    console.log('[expenseReportService] fetchExpenseSummary: calling API', url);
    const res = await fetch(url, { headers: _middlewareHeaders() });

    if (res?.ok) {
      const json = await res?.json();

      // V297 FIX: Backend returns AmEx at response.totals.amex — check that path FIRST.
      // Also check legacy flat paths for backward compatibility.
      const totals = json?.totals || {};
      const payload = json?.data || json || {};

      const amexRaw =
        totals?.amex ??                  // PRIMARY: response.totals.amex (confirmed by Yabezy curl)
        totals?.amex_expense ??
        totals?.amexExpense ??
        payload?.amex ??                 // legacy flat
        payload?.amex_expense ??
        payload?.amexExpense ??
        payload?.amex_total ??
        null;

      const payrollRaw =
        totals?.payroll ??
        totals?.payroll_expense ??
        payload?.payroll ??
        payload?.payroll_expense ??
        payload?.payrollExpense ??
        null;

      const wfDirectRaw =
        totals?.wf_banking ??             // PRIMARY: response.totals.wf_banking (Yabezy V564 patch)
        totals?.wf_direct ??
        totals?.wf_direct_expense ??
        payload?.wf_direct ??
        payload?.wf_direct_expense ??
        payload?.wfDirectExpense ??
        payload?.wf_banking ??
        payload?.wfBankingExpense ??
        null;

      // V560: Also read totals.total_expenses — the canonical pre-aggregated total
      // from the backend. This is the official expense figure for Reports KPI cards
      // and P&L monthly rows. Using this field ensures the top card and each P&L row
      // use the exact same server-side total, guaranteeing reconciliation.
      const totalExpensesRaw =
        totals?.total_expenses ??
        totals?.totalExpenses ??
        totals?.total ??
        payload?.total_expenses ??
        payload?.totalExpenses ??
        null;

      // V564: Read new backend fields from Yabezy's protected operating-expense model
      const amexChargesRaw = totals?.amex_charges ?? payload?.amex_charges ?? null;
      const amexCreditsRaw = totals?.amex_credits ?? payload?.amex_credits ?? null;
      const payrollTaxesRaw = totals?.payroll_taxes ?? payload?.payroll_taxes ?? null;
      const benefitsRaw = totals?.benefits ?? payload?.benefits ?? null;
      const wfReferenceBuckets = json?.wf_reference_buckets ?? json?.wfReferenceBuckets ?? null;
      const expenseModel = json?.expense_model ?? json?.expenseModel ?? null;

      const amex = parseFloat(amexRaw);
      const payroll = parseFloat(payrollRaw);
      const wfDirect = parseFloat(wfDirectRaw);
      let totalExpenses = parseFloat(totalExpensesRaw);
      const amexCharges = parseFloat(amexChargesRaw);
      const amexCredits = parseFloat(amexCreditsRaw);
      const payrollTaxes = parseFloat(payrollTaxesRaw);
      const benefits = parseFloat(benefitsRaw);

      if (!isNaN(amex) && amex !== null) {
        console.log('[expenseReportService] fetchExpenseSummary: API succeeded, totals.amex =', amex, '(source field:', amexRaw !== null ? 'totals.amex or payload.amex' : 'unknown', ')');
        apiAmex = amex;
        apiPayroll = isNaN(payroll) ? null : payroll;
        apiWfDirect = isNaN(wfDirect) ? null : wfDirect;
        apiTotalExpenses = isNaN(totalExpenses) ? null : totalExpenses;
        apiSucceeded = true;
        console.log('[expenseReportService] fetchExpenseSummary: totals.total_expenses =', apiTotalExpenses);
        console.log('[expenseReportService] fetchExpenseSummary: totals.wf_banking =', apiWfDirect);
        console.log('[expenseReportService] fetchExpenseSummary: totals.amex_charges =', amexCharges, 'totals.amex_credits =', amexCredits);
        console.log('[expenseReportService] fetchExpenseSummary: totals.payroll_taxes =', payrollTaxes, 'totals.benefits =', benefits);
        // Store extra fields on module-level for access in fetchExpenseKPIs
        _lastSummaryExtras = {
          amexCharges: isNaN(amexCharges) ? null : amexCharges,
          amexCredits: isNaN(amexCredits) ? null : amexCredits,
          payrollTaxes: isNaN(payrollTaxes) ? null : payrollTaxes,
          benefits: isNaN(benefits) ? null : benefits,
          wfReferenceBuckets,
          expenseModel,
        };
      } else {
        console.warn('[expenseReportService] fetchExpenseSummary: API returned ok but amex field missing/null in totals and payload — falling back to Supabase aggregate');
      }
    } else {
      console.warn('[expenseReportService] fetchExpenseSummary: API returned', res?.status, '— falling back to Supabase aggregate');
    }
  } catch (apiErr) {
    console.warn('[expenseReportService] fetchExpenseSummary: API fetch error:', apiErr?.message, '— falling back to Supabase aggregate');
  }

  // ── Step 2: Direct Supabase aggregate fallback (V296 — always run for mismatch guard) ──
  // V297 FIX: Always compute the Supabase posted-AmEx total so we can compare it
  // against the API value. If they differ by more than the tolerance, prefer Supabase
  // (the verified checkpoint: $251,648.75) and log a warning.
  const MISMATCH_TOLERANCE = 5.00; // dollars — rounding/timing differences are acceptable
  let supabaseAmex = null;

  try {
    let amexQuery = supabase
      ?.from('expenses')
      ?.select('amount')
      ?.in('source_type', ['amex_api', 'amex_statement_import'])
      ?.eq('expense_status', 'posted')
      ?.neq('source_tab', 'Banking')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate);

    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) {
      amexQuery = amexQuery?.in('office_id', activeOffices);
    }

    const { data: amexRows, error: amexErr } = await amexQuery?.range(0, 9999);

    if (amexErr) {
      console.warn('[expenseReportService] fetchExpenseSummary Supabase fallback error:', amexErr?.message);
    } else {
      supabaseAmex = (amexRows || [])?.reduce((sum, r) => {
        const amt = parseFloat(r?.amount);
        return isNaN(amt) || amt <= 0 ? sum : sum + amt;
      }, 0);
      console.log('[expenseReportService] fetchExpenseSummary: Supabase posted-AmEx =', supabaseAmex, '(', (amexRows || [])?.length, 'rows)');
    }
  } catch (supabaseErr) {
    console.warn('[expenseReportService] fetchExpenseSummary Supabase fallback exception:', supabaseErr?.message);
  }

  // ── Step 3: Mismatch guard — prefer Supabase fallback if difference exceeds tolerance ──
  if (apiSucceeded && supabaseAmex !== null) {
    const diff = Math.abs(apiAmex - supabaseAmex);
    if (diff > MISMATCH_TOLERANCE) {
      console.warn(
        `[expenseReportService] fetchExpenseSummary: MISMATCH GUARD — API totals.amex ($${apiAmex?.toFixed(2)}) differs from Supabase posted-AmEx ($${supabaseAmex?.toFixed(2)}) by $${diff?.toFixed(2)} (tolerance: $${MISMATCH_TOLERANCE}). Preferring Supabase verified fallback. Investigate before accepting API value.`
      );
      // Expose diagnostic note for debug panel if available
      if (typeof window !== 'undefined') {
        window.__AMEX_MISMATCH_DIAGNOSTIC__ = {
          apiValue: apiAmex,
          supabaseValue: supabaseAmex,
          difference: diff,
          tolerance: MISMATCH_TOLERANCE,
          preferring: 'supabase',
          timestamp: new Date()?.toISOString(),
        };
      }
      return {
        amex: supabaseAmex,
        payroll: apiPayroll,
        wfDirect: apiWfDirect,
        totalExpenses: apiTotalExpenses,
        error: null,
        _source: 'supabase_mismatch_guard',
        _apiAmex: apiAmex,
        _mismatch: diff,
        // V564: pass through extra fields even on mismatch guard path
        amexCharges: _lastSummaryExtras?.amexCharges ?? null,
        amexCredits: _lastSummaryExtras?.amexCredits ?? null,
        payrollTaxes: _lastSummaryExtras?.payrollTaxes ?? null,
        benefits: _lastSummaryExtras?.benefits ?? null,
        wfReferenceBuckets: _lastSummaryExtras?.wfReferenceBuckets ?? null,
        expenseModel: _lastSummaryExtras?.expenseModel ?? null,
      };
    } else {
      // Values reconcile within tolerance — API is trustworthy
      console.log(`[expenseReportService] fetchExpenseSummary: API and Supabase reconcile within $${MISMATCH_TOLERANCE} tolerance (diff: $${diff?.toFixed(2)}). Using API value.`);
      return {
        amex: apiAmex,
        payroll: apiPayroll,
        wfDirect: apiWfDirect,
        totalExpenses: apiTotalExpenses,
        error: null,
        _source: 'api',
        _supabaseAmex: supabaseAmex,
        _mismatch: diff,
        // V564: new backend fields
        amexCharges: _lastSummaryExtras?.amexCharges ?? null,
        amexCredits: _lastSummaryExtras?.amexCredits ?? null,
        payrollTaxes: _lastSummaryExtras?.payrollTaxes ?? null,
        benefits: _lastSummaryExtras?.benefits ?? null,
        wfReferenceBuckets: _lastSummaryExtras?.wfReferenceBuckets ?? null,
        expenseModel: _lastSummaryExtras?.expenseModel ?? null,
      };
    }
  }

  // API succeeded but Supabase fallback failed — use API value as-is
  if (apiSucceeded) {
    return {
      amex: apiAmex,
      payroll: apiPayroll,
      wfDirect: apiWfDirect,
      totalExpenses: apiTotalExpenses,
      error: null,
      _source: 'api_only',
      // V564: new backend fields
      amexCharges: _lastSummaryExtras?.amexCharges ?? null,
      amexCredits: _lastSummaryExtras?.amexCredits ?? null,
      payrollTaxes: _lastSummaryExtras?.payrollTaxes ?? null,
      benefits: _lastSummaryExtras?.benefits ?? null,
      wfReferenceBuckets: _lastSummaryExtras?.wfReferenceBuckets ?? null,
      expenseModel: _lastSummaryExtras?.expenseModel ?? null,
    };
  }

  // API failed — use Supabase fallback if available
  if (supabaseAmex !== null) {
    return {
      amex: supabaseAmex,
      payroll: null,
      wfDirect: null,
      totalExpenses: null,
      error: null,
      _source: 'supabase_aggregate',
      amexCharges: null,
      amexCredits: null,
      payrollTaxes: null,
      benefits: null,
      wfReferenceBuckets: null,
      expenseModel: null,
    };
  }

  // Both failed
  return { amex: null, payroll: null, wfDirect: null, totalExpenses: null, error: 'both_sources_failed', _source: 'none', amexCharges: null, amexCredits: null, payrollTaxes: null, benefits: null, wfReferenceBuckets: null, expenseModel: null };
}

// ── FETCH EXPENSE TOTAL FOR RANGE (V560 — direct totals.total_expenses path) ──
/**
 * fetchExpenseTotalForRange — V560
 *
 * Calls /v2/expenses/summary with exact startDate/endDate and returns
 * totals.total_expenses directly from the API response.
 *
 * This is the canonical single-call path for both the Reports top Total Expenses
 * KPI card and each P&L monthly row. Using the same function for both guarantees
 * they always use the exact same server-side total and will reconcile perfectly.
 *
 * Hard rules:
 *   - Always sends startDate + endDate (never year= alone)
 *   - Uses totals.total_expenses as the primary field
 *   - Returns null (not 0) if the API fails or the field is missing
 *   - Real backend zero returns 0
 *
 * @param {{ startDate: string, endDate: string, officeIds?: string[] }} params
 * @returns {Promise<number|null>} totalExpenses or null on failure
 */
export async function fetchExpenseTotalForRange({ startDate, endDate, officeIds = [] } = {}) {
  if (!startDate || !endDate) {
    console.warn('[fetchExpenseTotalForRange] Missing startDate or endDate — returning null');
    return null;
  }

  try {
    const params = new URLSearchParams();
    params?.set('startDate', startDate);
    params?.set('endDate', endDate);
    if ((officeIds || [])?.filter(o => o && o !== 'all')?.length === 1) {
      params?.set('officeId', officeIds?.filter(o => o && o !== 'all')?.[0]);
    }

    const url = `${MIDDLEWARE_API_BASE}/expenses/summary?${params?.toString()}`;
    console.log('[fetchExpenseTotalForRange] V560 calling API:', url, '| officeIds:', officeIds);

    const res = await fetch(url, { headers: _middlewareHeaders() });

    if (!res?.ok) {
      console.warn('[fetchExpenseTotalForRange] API returned', res?.status, 'for', url, '— returning null');
      return null;
    }

    const json = await res?.json();
    const totals = json?.totals || {};
    const payload = json?.data || json || {};

    // Read totals.total_expenses — the canonical pre-aggregated total from the backend
    const raw =
      totals?.total_expenses ??
      totals?.totalExpenses ??
      totals?.total ??
      payload?.total_expenses ??
      payload?.totalExpenses ??
      null;

    const val = parseFloat(raw);

    if (raw === null || raw === undefined || isNaN(val)) {
      console.warn('[fetchExpenseTotalForRange] totals.total_expenses missing in API response for', url, '— full totals:', totals, '— returning null');
      return null;
    }

    console.log('[fetchExpenseTotalForRange] V560 result:', {
      startDate,
      endDate,
      officeIds,
      url,
      totalExpenses: val,
      _source: 'totals.total_expenses',
    });

    return val;
  } catch (err) {
    console.warn('[fetchExpenseTotalForRange] fetch error:', err?.message, '— returning null');
    return null;
  }
}

// ── DATE RANGE HELPERS ────────────────────────────────────────────────────────
export function buildDateRange(preset, customStart, customEnd) {
  const now = new Date();
  const y = now?.getFullYear();
  let m = now?.getMonth();

  if (preset === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  switch (preset) {
    case 'this_month':
      return {
        start: new Date(y, m, 1)?.toISOString()?.slice(0, 10),
        end: new Date(y, m + 1, 0)?.toISOString()?.slice(0, 10),
      };
    case 'last_month':
      return {
        start: new Date(y, m - 1, 1)?.toISOString()?.slice(0, 10),
        end: new Date(y, m, 0)?.toISOString()?.slice(0, 10),
      };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return {
        start: new Date(y, q * 3, 1)?.toISOString()?.slice(0, 10),
        end: now?.toISOString()?.slice(0, 10),
      };
    }
    case 'q1': return { start: `${y}-01-01`, end: `${y}-03-31` };
    case 'q2': return { start: `${y}-04-01`, end: `${y}-06-30` };
    case 'q3': return { start: `${y}-07-01`, end: `${y}-09-30` };
    case 'q4': return { start: `${y}-10-01`, end: `${y}-12-31` };
    case 'this_year':
      return { start: `${y}-01-01`, end: now?.toISOString()?.slice(0, 10) };
    case 'last_year':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default:
      return { start: `${y}-01-01`, end: now?.toISOString()?.slice(0, 10) };
  }
}

// ── INTERNAL: apply all shared filter predicates to a Supabase query ──────────
function _applyFilters(query, {
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
  if (activeOffices?.length > 0) query = query?.in('office_id', activeOffices);

  const activeDepts = (departmentNames || [])?.filter(d => d && d !== 'all');
  if (activeDepts?.length > 0) query = query?.in('department_name', activeDepts);

  const activeCats = (categoryNames || [])?.filter(c => c && c !== 'all');
  if (activeCats?.length > 0) query = query?.in('category_name', activeCats);

  const activeSources = (sourceTypes || [])?.filter(s => s && s !== 'all');
  if (activeSources?.length > 0) query = query?.in('source_type', activeSources);

  const activePayment = (paymentSources || [])?.filter(p => p && p !== 'all');
  if (activePayment?.length > 0) query = query?.in('payment_source', activePayment);

  const activeStatuses = (statuses || [])?.filter(s => s && s !== 'all');
  if (activeStatuses?.length > 0) query = query?.in('expense_status', activeStatuses);

  if (cardholderName) query = query?.ilike('cardholder_name', `%${cardholderName}%`);
  if (merchantName) query = query?.ilike('merchant_name', `%${merchantName}%`);

  return query;
}

// ── FETCH EXPENSE RECORDS (main table) ───────────────────────────────────────
export async function readCompleteExpenseQuery(query, pageSize = 500) {
  const rows = [], seen = new Set();
  let expected = null;
  do {
    const result = await query.range(rows.length, rows.length + pageSize - 1);
    if (result?.error) throw new Error('Expense transactions could not be loaded completely. Refresh to retry.');
    const count = result?.count, page = result?.data;
    if (!Number.isSafeInteger(count) || count < 0 || count > 50000 || !Array.isArray(page)) {
      throw new Error('Unable to confirm all expense transactions. Narrow the date or office filter and retry.');
    }
    if (expected === null) expected = count;
    if (count !== expected || page.length > pageSize || rows.length + page.length > expected || (!page.length && rows.length < expected)) {
      throw new Error('Expense transactions changed or were incomplete. Refresh to retry.');
    }
    for (const row of page) {
      if (!row?.id || seen.has(row.id)) throw new Error('Expense transactions were duplicated or incomplete. Refresh to retry.');
      seen.add(row.id);
      rows.push(row);
    }
  } while (rows.length < expected);
  return { data: rows };
}

export async function fetchExpenseRecords({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  cardholderName = null,
  merchantName = null,
  statuses = [],
  statementPeriodStart = null,
  statementPeriodEnd = null,
  limit = 500,
  offset = 0,
  postedOnly = false,
  complete = false,
} = {}) {
  // Determine if WF Banking source is requested
  const wfBankingRequested =
    sourceTypes?.length === 0 ||
    sourceTypes?.includes('banking') ||
    sourceTypes?.includes('wells_fargo') ||
    sourceTypes?.includes('All Sources');

  // Determine if ONLY banking/wells_fargo is selected (no other source types)
  // When true, the main (non-Banking) query must be skipped entirely — no AmEx/Gusto rows
  const nonBankingSourceTypes = (sourceTypes || [])?.filter(s => s !== 'banking' && s !== 'wells_fargo');
  const bankingOnlySelected = sourceTypes?.length > 0 && nonBankingSourceTypes?.length === 0;

  // Resolve office name for WF Banking filter (WF rows have office_id = NULL)
  let wfOfficeName = null;
  if (officeIds?.length > 0) {
    // Import OFFICE_MAP lazily to avoid circular deps — use dynamic import pattern
    // We'll resolve office name from the OFFICE_MAP constant
    const { OFFICE_MAP } = await import('../constants/offices');
    const officeEntry = Object.entries(OFFICE_MAP || {})?.find(([id]) => officeIds?.includes(id));
    wfOfficeName = officeEntry?.[1]?.name || null;
  }

  // Build main query (existing sources, excluding Banking source_tab)
  let query = supabase?.from('expenses')?.select(`
      id, office_id, office_name, department_id, department_name,
      category_id, category_name, subcategory_name, vendor_id, vendor_name,
      source_type, payment_source, source_reference_id, source_table, source_tab,
      import_batch_id, expense_date, posted_date, service_period_start, service_period_end,
      statement_period_start, statement_period_end, amount,
      cardholder_name, cardholder_id, cardholder_role, card_last4, merchant_name,
      allocation_method, allocation_metadata, notes, created_by, approved_by, expense_status,
      is_recurring, created_at, updated_at
    `, complete ? { count: 'exact' } : undefined)
    ?.gte('expense_date', startDate)
    ?.lte('expense_date', endDate)
    // V290: postedOnly=true uses eq('posted') to exclude draft rows from verified expense totals.
    // postedOnly=false (default, used by Transactions tab) uses neq('archived') to show draft rows for review.
    ?.[postedOnly ? 'eq' : 'neq']('expense_status', postedOnly ? 'posted' : 'archived')
    ?.neq('source_tab', 'Banking')
    ?.order('expense_date', { ascending: false })
    ?.range(offset, offset + limit - 1);

  query = _applyFilters(query, {
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes: nonBankingSourceTypes,
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
  });

  if (statementPeriodStart) query = query?.gte('statement_period_start', statementPeriodStart);
  if (statementPeriodEnd) query = query?.lte('statement_period_end', statementPeriodEnd);
  if (complete) query = query.order('id', { ascending: true });

  // Build WF Banking query (separate — filters by office_name, not office_id)
  let bankingQuery = null;
  if (wfBankingRequested) {
    let bq = supabase?.from('expenses')?.select(`
        id, office_id, office_name, department_id, department_name,
        category_id, category_name, subcategory_name, vendor_id, vendor_name,
        source_type, payment_source, source_reference_id, source_table, source_tab,
        import_batch_id, expense_date, posted_date, service_period_start, service_period_end,
        statement_period_start, statement_period_end, amount,
        cardholder_name, cardholder_id, cardholder_role, card_last4, merchant_name,
        allocation_method, allocation_metadata, notes, created_by, approved_by, expense_status,
        is_recurring, created_at, updated_at
      `, complete ? { count: 'exact' } : undefined)
      ?.eq('source_tab', 'Banking')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate)
      // V290: match postedOnly setting — posted-only for KPI totals, neq-archived for Transactions tab
      ?.[postedOnly ? 'eq' : 'neq']('expense_status', postedOnly ? 'posted' : 'archived')
      ?.order('expense_date', { ascending: false })
      ?.limit(500);

    if (wfOfficeName) {
      bq = bq?.ilike('office_name', `%${wfOfficeName}%`);
    }

    // ── V305 PATCH: Apply applicable filters to WF Banking rows ──────────────
    // Department filter — Banking rows have department_name when classified
    if (departmentNames?.length > 0) {
      bq = bq?.in('department_name', departmentNames);
    }
    // Category filter — Banking rows have category_name when classified
    if (categoryNames?.length > 0) {
      bq = bq?.in('category_name', categoryNames);
    }
    // Cardholder filter — Banking rows may have cardholder_name
    if (cardholderName) {
      bq = bq?.ilike('cardholder_name', `%${cardholderName}%`);
    }
    // Vendor/Merchant filter — Banking rows use merchant_name and/or vendor_name
    if (merchantName) {
      bq = bq?.or(`merchant_name.ilike.%${merchantName}%,vendor_name.ilike.%${merchantName}%`);
    }
    // NOTE: Payment Source (payment_source / source_type) filter is intentionally NOT applied
    // to Banking rows. WF Banking rows may have source_type='manual' due to a DB enum constraint
    // and are routed by source_tab='Banking', not source_type. Applying a source_type filter
    // here would incorrectly exclude valid Banking rows.
    // ── END V305 PATCH ────────────────────────────────────────────────────────

    bankingQuery = complete ? bq.order('id', { ascending: true }) : bq;
  }

  const [mainRes, bankingRes] = await Promise.allSettled([
    // If banking-only is selected, skip the main query entirely (no AmEx/Gusto rows)
    bankingOnlySelected ? Promise.resolve({ data: [] }) : complete ? readCompleteExpenseQuery(query) : query,
    bankingQuery ? (complete ? readCompleteExpenseQuery(bankingQuery) : bankingQuery) : Promise.resolve({ data: [] }),
  ]);

  if (complete && (mainRes.status === 'rejected' || bankingRes.status === 'rejected')) {
    throw new Error('Expense transactions could not be loaded completely. Narrow the date or office filter and refresh.');
  }

  const mainRows = mainRes?.status === 'fulfilled' ? (mainRes?.value?.data || []) : [];
  const bankingRaw = bankingRes?.status === 'fulfilled' ? (bankingRes?.value?.data || []) : [];

  // Filter Banking rows: return ALL WF Banking rows so the table sub-tab logic
  // can route them to the correct view (Included Expenses, Transfers, Manual Exceptions, etc.)
  // The table's isIncludedInExpense() already guards the Included Expenses view.
  const bankingRows = bankingRaw || [];

  // Filter existing rows: exclude rows where allocation_metadata.excluded_from_expense = true
  const filteredMain = mainRows?.filter(r => !isExcludedFromExpense(r));

  // Merge and deduplicate by id
  const seenIds = new Set();
  const merged = [];
  for (const r of [...filteredMain, ...bankingRows]) {
    if (!seenIds?.has(r?.id)) {
      seenIds?.add(r?.id);
      merged?.push(r);
    }
  }

  if (mainRes?.status === 'rejected') {
    console.warn('[expenseReportService] fetchExpenseRecords error:', mainRes?.reason?.message);
  }

  return merged?.map(r => ({
    ...r,
    office_name: normalizeOfficeName(r?.office_name) || r?.office_name || 'Unassigned',
    source_type_label: resolveSourceTypeLabel(r),
  }));
}

// ── FETCH KPI TOTALS ──────────────────────────────────────────────────────────
export async function fetchExpenseKPIs({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  // ── V295 FIX: Fetch /v2/expenses/summary in parallel with row data ──────
  // /v2/expenses/summary returns pre-aggregated posted-only AmEx total server-side.
  // This bypasses the pagination trap: 681 posted AmEx rows exceed the 500-row
  // default limit and would be undercounted if summed from a paginated lines response.
  // Summary endpoint is used ONLY for the AmEx KPI total override.
  // All other KPI buckets (payroll, WF direct, categories) continue to use row data.
  const [expRowsResult, summaryResult] = await Promise.allSettled([
    fetchExpenseRecords({
      startDate,
      endDate,
      officeIds,
      departmentNames,
      categoryNames,
      sourceTypes,
      paymentSources,
      statuses,
      cardholderName,
      merchantName,
      limit: 2000,
      offset: 0,
      postedOnly: true,
    }),
    // Only call summary when no narrow filters are active that would make it inapplicable.
    // If specific sourceTypes, statuses, cardholderName, or merchantName are set,
    // the summary endpoint may not honor those sub-filters — fall back to row sum.
    (
      sourceTypes?.length === 0 &&
      statuses?.length === 0 &&
      !cardholderName &&
      !merchantName
    )
      ? fetchExpenseSummary({ startDate, endDate, officeIds })
      : Promise.resolve({ amex: null, payroll: null, wfDirect: null, error: 'filters_active' }),
  ]);

  const expRows = expRowsResult?.status === 'fulfilled' ? expRowsResult?.value : [];
  const summary = summaryResult?.status === 'fulfilled' ? summaryResult?.value : { amex: null, payroll: null, wfDirect: null, error: 'allSettled_rejected' };

  // Log summary result for diagnostics
  if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
    console.log('[fetchExpenseKPIs] V295 summary result:', summary);
  }

  // Gusto expense facts (only if not already in expenses table)
  const gustoExcluded =
    (sourceTypes?.length > 0 && !sourceTypes?.includes('gusto') && !sourceTypes?.includes('gusto_payroll')) ||
    (paymentSources?.length > 0 && !paymentSources?.includes('gusto'));

  let gustoRows = [];
  if (!gustoExcluded) {
    let gq = supabase
      ?.from('gusto_expense_facts')
      ?.select('expense_amount, expense_category, expense_source, office_name, office_id, expense_date, gusto_run_id')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate);
    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) gq = gq?.in('office_id', activeOffices);
    const gustoRes = await gq;
    gustoRows = gustoRes?.data || [];
  }

  // ── V_PAYROLL_FIX: Fetch authoritative payroll total from gusto_payroll_runs ──
  // The Payroll Overview (Finance → Payroll → Gusto → Overview) uses:
  //   totalGrossCostYTD = SUM(total_debit_amount) from gusto_payroll_runs
  // total_debit_amount = net pay + employer taxes + employer-paid deductions
  // This is the SAME authoritative source the Expense Report must use.
  //
  // gusto_expense_facts only stores total_net_pay (Payroll), total_payable_tax (Payroll Taxes),
  // and total_reimbursement (Benefit Paid) as separate rows. Summing them from gusto_expense_facts
  // can miss rows that were not synced or have category mismatches.
  //
  // Using total_debit_amount directly from gusto_payroll_runs guarantees reconciliation
  // with the Payroll Overview and includes all 15 YTD payroll runs.
  //
  // Exclusion rules (matching Payroll Overview):
  //   - processed = true (only completed runs)
  //   - reversed = false or null (no reversed runs)
  //   - needs_reprocessing = false or null
  //   - processing = false or null
  //
  // Benefits (total_reimbursement) are tracked separately to avoid double-counting
  // with the Benefits Expense card. They are included in total_debit_amount but
  // the Benefits card shows them for visibility — they are NOT added again to totalExpenses.
  let gustoRunsPayrollTotal = null;
  let gustoRunsBenefitsTotal = 0;
  let gustoRunsNetPayTotal = 0;
  let gustoRunsTaxesTotal = 0;
  let gustoRunsCount = 0;
  let gustoRunsUsed = false;
  // V_BENEFITS_FIX: separate health benefits and payroll reimbursements
  let payrollReimbursements = 0;          // total_reimbursement — employee expense reimbursements via payroll
  let healthBenefitsExpense = 0;          // employer healthcare contribution from enrollments
  let healthBenefitsEnrolledCount = 0;    // number of active enrolled employees
  let healthBenefitsIsEstimated = false;  // true when using current enrollment data for historical range
  let healthBenefitsAnnualTotal = 0;      // annualized employer healthcare contribution

  if (!gustoExcluded) {
    try {
      let runsQuery = supabase
        ?.from('gusto_payroll_runs')
        ?.select('id, check_date, total_debit_amount, total_net_pay, total_payable_tax, total_reimbursement, processed, reversed, needs_reprocessing, processing')
        ?.eq('processed', true)
        ?.gte('check_date', startDate)
        ?.lte('check_date', endDate);

      const { data: runsData, error: runsError } = await runsQuery;

      if (!runsError && runsData && runsData?.length > 0) {
        const validRuns = runsData?.filter(r =>
          r?.processed === true &&
          (r?.reversed === null || r?.reversed === false) &&
          (r?.needs_reprocessing === null || r?.needs_reprocessing === false) &&
          (r?.processing === null || r?.processing === false)
        );

        gustoRunsCount = validRuns?.length;
        gustoRunsNetPayTotal = validRuns?.reduce((s, r) => s + (parseFloat(r?.total_net_pay) || 0), 0);
        gustoRunsTaxesTotal = validRuns?.reduce((s, r) => s + (parseFloat(r?.total_payable_tax) || 0), 0);
        gustoRunsBenefitsTotal = validRuns?.reduce((s, r) => s + (parseFloat(r?.total_reimbursement) || 0), 0);
        // V_BENEFITS_FIX: payrollReimbursements = total_reimbursement (employee expense reimbursements via payroll)
        // This is NOT health insurance — it is mileage, expense reports, etc. paid through payroll.
        payrollReimbursements = gustoRunsBenefitsTotal;
        // total_debit_amount = net pay + employer taxes + employer-paid deductions (full employer cost)
        gustoRunsPayrollTotal = validRuns?.reduce((s, r) => s + (parseFloat(r?.total_debit_amount) || 0), 0);
        gustoRunsUsed = true;

        console.log('[fetchExpenseKPIs] V_PAYROLL_FIX: gusto_payroll_runs authoritative total:', {
          runs: gustoRunsCount,
          netPay: gustoRunsNetPayTotal,
          taxes: gustoRunsTaxesTotal,
          benefits: gustoRunsBenefitsTotal,
          totalDebit: gustoRunsPayrollTotal,
          startDate,
          endDate,
        });
      } else if (runsError) {
        console.warn('[fetchExpenseKPIs] V_PAYROLL_FIX: gusto_payroll_runs query error:', runsError?.message, '— falling back to gusto_expense_facts');
      }
    } catch (runsErr) {
      console.warn('[fetchExpenseKPIs] V_PAYROLL_FIX: gusto_payroll_runs fetch exception:', runsErr?.message, '— falling back to gusto_expense_facts');
    }
  }

  // V297 FIX: When gusto_expense_facts has rows for the period, treat it as the
  // authoritative payroll source and skip ALL source_type='gusto'/'gusto_payroll'
  // rows from the expenses table. Those are old aggregate rows superseded by the
  // corrected department-split backfill in gusto_expense_facts.
  // This prevents double-counting: old expenses rows (~$264,900) + gusto_expense_facts ($570,109) = $837,649.
  const useGustoFactsAsSource = gustoRows?.length > 0;

  // When gusto_expense_facts is authoritative, use all its rows directly.
  // When it is empty (no backfill), fall back to run/category/date dedup against expenses table.
  const gustoContrib = useGustoFactsAsSource
    ? gustoRows
    : (() => {
        const gustoKeysInExpenses = new Set();
        expRows?.forEach(r => {
          if (r?.source_type !== 'gusto' && r?.source_type !== 'gusto_payroll') return;
          const runId = r?.allocation_metadata?.gusto_run_id || r?.source_reference_id || '';
          const cat = (r?.category_name || '')?.toLowerCase();
          const dt = r?.expense_date || '';
          if (runId) gustoKeysInExpenses?.add(`${runId}|${cat}|${dt}`);
        });
        return gustoRows?.filter(g => {
          const runId = g?.gusto_run_id || '';
          const cat = (g?.expense_category || '')?.toLowerCase();
          const dt = g?.expense_date || '';
          if (!runId) return true;
          return !gustoKeysInExpenses?.has(`${runId}|${cat}|${dt}`);
        });
      })();

  // Detect if Gusto benefits are already present — prevents double-counting direct benefit payments
  const hasGustoBenefits = expRows?.some(r =>
    (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll') &&
    (r?.category_name || '')?.toLowerCase()?.includes('benefit')
  ) || gustoRows?.some(r =>
    (r?.expense_category || '')?.toLowerCase()?.includes('benefit')
  );

  // ── RECONCILIATION BUCKETS ────────────────────────────────────────────────
  let totalExpenses = 0;
  let payrollExpense = 0;
  let benefitsExpense = 0;
  let amexVendorExpense = 0;
  let corporateSharedAmexExpense = 0;
  let corporateSharedWFExpense = 0;
  let utilitiesExpense = 0;
  let occupancyExpense = 0;
  let insuranceExpense = 0;
  let complianceExpense = 0;
  let bankDirectExpense = 0;
  let reviewedManualExpense = 0;
  let wfBankingExpense = 0;

  let excludedAmexBillPayments = 0;
  let excludedPayrollFunding = 0;
  let excludedInternalTransfers = 0;
  let excludedManualEntries = 0;
  let excludedUnreviewedCorporate = 0;

  let manualCount = 0;
  let manualTotal = 0;

  // ── WF Direct Operating Expense: sum rows passing isWFDirectOperatingExpense ──
  // V290 FIX: Use isWFDirectOperatingExpense() (NOT isWFMainMoneyOutCounted()) so that:
  //   - payroll_funding rows are EXCLUDED (same money as Gusto payroll, counted once via Gusto source)
  //   - liability_payment_to_amex / amex_bill_payment rows are EXCLUDED (same money as AmEx vendor charges)
  // isWFMainMoneyOutCounted() is preserved for cash-basis WF Money-Out display/reconciliation only.
  expRows?.forEach(r => {
    if (r?.source_tab !== 'Banking') return;
    if (!isWFDirectOperatingExpense(r)) {
      // Track excluded payroll_funding and AmEx bill payments for reconciliation diagnostics
      const meta = r?.allocation_metadata || {};
      const wfCls = (meta?.wf_classification || '')?.toLowerCase();
      const rawAmt = Math.abs(parseFloat(r?.amount) || 0);
      if (rawAmt > 0) {
        if (wfCls === 'payroll_funding') excludedPayrollFunding += rawAmt;
        else if (
          wfCls === 'liability_payment_to_amex' ||
          wfCls === 'liability_payment_amex' ||
          wfCls === 'amex_bill_payment'
        ) excludedAmexBillPayments += rawAmt;
        // V292: Track internal funding transfers (office-to-3526, AmEx liability payments by merchant signal)
        else if (isInternalFundingTransfer(r)) excludedInternalTransfers += rawAmt;
      }
      return;
    }
    const amt = Math.abs(parseFloat(r?.amount) || 0);
    if (amt <= 0) return;
    wfBankingExpense += amt;
    // V291 Part 4: Also populate occupancyExpense for WF Banking rent rows.
    // This does NOT add to totalExpenses again — only affects category breakdown KPI.
    const cat = (r?.category_name || '')?.toLowerCase();
    const merchant = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
    const notes = (r?.notes || '')?.toLowerCase();
    const wfCls = (r?.allocation_metadata?.wf_classification || '')?.toLowerCase();
    const rentHaystack = `${cat} ${merchant} ${notes} ${wfCls}`;
    if (
      rentHaystack?.includes('rent') ||
      rentHaystack?.includes('lease') ||
      rentHaystack?.includes('occupancy') ||
      rentHaystack?.includes('landlord') ||
      rentHaystack?.includes('property management') ||
      rentHaystack?.includes('realty') ||
      rentHaystack?.includes('building')
    ) {
      occupancyExpense += amt;
    }
  });

  expRows?.forEach(r => {
    const amt = parseFloat(r?.amount) || 0;
    if (amt <= 0) return;

    if (isExcludedFromExpense(r)) {
      excludedInternalTransfers += amt;
      return;
    }

    // Banking rows already summed above — track excluded ones for diagnostics only
    if (r?.source_tab === 'Banking') {
      if (!isWFDirectOperatingExpense(r)) {
        const meta = r?.allocation_metadata || {};
        const wfCls = (meta?.wf_classification || '')?.toLowerCase();
        if (
          wfCls === 'internal_transfer' || wfCls === 'eft_clearing' ||
          wfCls === 'deposit' || wfCls === 'income' ||
          wfCls === 'transfer_in' || wfCls === 'transfer_out_internal'
        ) {
          excludedInternalTransfers += amt;
        } else {
          excludedManualEntries += amt;
        }
      }
      return;
    }

    // MANUAL ENTRY EXCLUSION
    if (r?.source_type === 'manual') {
      manualCount += 1;
      manualTotal += amt;
      excludedManualEntries += amt;
      return;
    }

    // V297 FIX: Skip old aggregate gusto/gusto_payroll rows from expenses table
    // when gusto_expense_facts is the authoritative source for this period.
    // This prevents double-counting the old pre-backfill aggregate rows.
    if (useGustoFactsAsSource && (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll')) {
      // Track as excluded payroll funding for reconciliation diagnostics
      excludedPayrollFunding += amt;
      return;
    }

    // WF ...3526 FULL CLASSIFICATION HIERARCHY
    const cls3526 = classify3526Transaction(r);
    if (cls3526) {
      if (cls3526 === 'liability_payment_to_amex') { excludedAmexBillPayments += amt; return; }
      if (cls3526 === 'payroll_funding') { excludedPayrollFunding += amt; return; }
      if (cls3526 === 'internal_transfer') { excludedInternalTransfers += amt; return; }
      if (cls3526 === 'corporate_shared_payroll_benefit_payment') { excludedUnreviewedCorporate += amt; return; }
      if (cls3526 === 'corporate_shared_benefit_expense') {
        if (hasGustoBenefits) { excludedPayrollFunding += amt; return; }
        corporateSharedWFExpense += amt;
        totalExpenses += amt;
        benefitsExpense += amt;
        return;
      }
      if (cls3526 === 'corporate_shared_vendor_expense') {
        corporateSharedWFExpense += amt;
        totalExpenses += amt;
        bankDirectExpense += amt;
        const cat = (r?.category_name || '')?.toLowerCase();
        if (cat?.includes('utilit') || cat?.includes('electric') || cat?.includes('gas') || cat?.includes('water') || cat?.includes('internet') || cat?.includes('phone')) utilitiesExpense += amt;
        else if (cat?.includes('occupancy') || cat?.includes('rent')) occupancyExpense += amt;
        else if (cat?.includes('insurance')) insuranceExpense += amt;
        else if (cat?.includes('compliance') || cat?.includes('regulatory') || cat?.includes('license') || cat?.includes('dep')) complianceExpense += amt;
      }
      return;
    }

    // V295 FIX: AmEx rows from the paginated lines response are used ONLY for
    // category/subcategory breakdown KPIs (utilitiesExpense, occupancyExpense, etc.).
    // The AmEx KPI total (amexExpense) is overridden below by /v2/expenses/summary.
    // We still accumulate amexVendorExpense / corporateSharedAmexExpense here so that
    // category breakdowns remain accurate; the grand total override happens after all loops.
    if (isAmexSource(r?.source_type)) {
      const cardLast4 = String(r?.card_last4 || '')?.replace(/\D/g, '')?.slice(-4);
      const isCorporateCard = CORPORATE_AMEX_CARD_LAST4S?.has(cardLast4);
      const cat = (r?.category_name || '')?.toLowerCase();
      // NOTE: totalExpenses is NOT incremented here for AmEx rows.
      // The correct AmEx total from /v2/expenses/summary is added after the loops.
      if (isCorporateCard) {
        corporateSharedAmexExpense += amt;
        if (cat?.includes('payroll') || cat?.includes('wages') || cat?.includes('salary')) payrollExpense += amt;
        else if (cat?.includes('benefit') || cat?.includes('health') || cat?.includes('401')) benefitsExpense += amt;
        else if (cat?.includes('utilit') || cat?.includes('electric') || cat?.includes('gas') || cat?.includes('water') || cat?.includes('internet') || cat?.includes('phone')) utilitiesExpense += amt;
        else if (cat?.includes('occupancy') || cat?.includes('rent')) occupancyExpense += amt;
        else if (cat?.includes('insurance')) insuranceExpense += amt;
        else if (cat?.includes('compliance') || cat?.includes('regulatory') || cat?.includes('license') || cat?.includes('dep')) complianceExpense += amt;
      } else {
        amexVendorExpense += amt;
        if (cat?.includes('payroll') || cat?.includes('wages') || cat?.includes('salary')) payrollExpense += amt;
        else if (cat?.includes('benefit') || cat?.includes('health') || cat?.includes('401')) benefitsExpense += amt;
        else if (cat?.includes('utilit') || cat?.includes('electric') || cat?.includes('gas') || cat?.includes('water') || cat?.includes('internet') || cat?.includes('phone')) utilitiesExpense += amt;
        else if (cat?.includes('occupancy') || cat?.includes('rent')) occupancyExpense += amt;
        else if (cat?.includes('insurance')) insuranceExpense += amt;
        else if (cat?.includes('compliance') || cat?.includes('regulatory') || cat?.includes('license') || cat?.includes('dep')) complianceExpense += amt;
      }
      return;
    }

    // TRANSFER / RECONCILIATION EXCLUSION
    const cat = (r?.category_name || '')?.toLowerCase();
    const merchant = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
    const notes = (r?.notes || '')?.toLowerCase();
    const haystack = `${cat} ${merchant} ${notes}`;
    const isTransfer = INTERNAL_TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
    if (isTransfer) { excludedInternalTransfers += amt; return; }

    if (
      AMEX_BILL_PAYMENT_KEYWORDS?.some(kw => haystack?.includes(kw)) &&
      r?.source_type !== 'amex_api' &&
      r?.source_type !== 'amex_statement_import'
    ) { excludedAmexBillPayments += amt; return; }

    // GUSTO / PAYROLL SOURCE ROWS
    if (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll') {
      totalExpenses += amt;
      payrollExpense += amt;
      if (cat?.includes('benefit')) benefitsExpense += amt;
      return;
    }

    // ALL OTHER INCLUDED EXPENSE ROWS
    totalExpenses += amt;
    bankDirectExpense += amt;
    if (cat?.includes('payroll') || cat?.includes('wages') || cat?.includes('salary') || cat?.includes('contractor')) payrollExpense += amt;
    else if (cat?.includes('benefit') || cat?.includes('health') || cat?.includes('401')) benefitsExpense += amt;
    else if (cat?.includes('utilit') || cat?.includes('electric') || cat?.includes('gas') || cat?.includes('water') || cat?.includes('internet') || cat?.includes('phone')) utilitiesExpense += amt;
    else if (cat?.includes('occupancy') || cat?.includes('rent')) occupancyExpense += amt;
    else if (cat?.includes('insurance')) insuranceExpense += amt;
    else if (cat?.includes('compliance') || cat?.includes('regulatory') || cat?.includes('license') || cat?.includes('dep')) complianceExpense += amt;
  });

  // ── V_PAYROLL_FIX: Use authoritative gusto_payroll_runs total when available ──
  // Priority: gusto_payroll_runs.total_debit_amount (same source as Payroll Overview)
  // Fallback: gusto_expense_facts row-sum (used when runs query fails)
  //
  // total_debit_amount = net pay + employer taxes + employer-paid deductions
  // This is the full employer payroll cost that reconciles with the Payroll Overview.
  //
  // Benefits (total_reimbursement) are INCLUDED in total_debit_amount.
  // The Benefits Expense card shows them for visibility only — they are NOT
  // added again to totalExpenses to prevent double-counting.
  if (gustoRunsUsed && gustoRunsPayrollTotal !== null && gustoRunsPayrollTotal > 0) {
    // Use authoritative gusto_payroll_runs total
    // total_debit_amount already includes benefits — do NOT add benefits separately to totalExpenses
    totalExpenses += gustoRunsPayrollTotal;
    payrollExpense += gustoRunsPayrollTotal;
    // Track benefits for the Benefits card (visibility only — already included in payrollExpense)
    // benefitsExpense is set below from gustoRunsBenefitsTotal
    console.log('[fetchExpenseKPIs] V_PAYROLL_FIX: Using gusto_payroll_runs.total_debit_amount as payroll expense:', gustoRunsPayrollTotal, '(', gustoRunsCount, 'runs)');
  } else {
    // Fallback: gusto_expense_facts row-sum (when runs query fails or no runs found)
    // This path preserves the previous behavior for backward compatibility.
    gustoContrib?.forEach(r => {
      const amt = parseFloat(r?.expense_amount) || 0;
      if (amt <= 0) return;
      totalExpenses += amt;
      payrollExpense += amt;
      const cat = (r?.expense_category || '')?.toLowerCase();
      if (cat?.includes('benefit')) benefitsExpense += amt;
    });
    console.log('[fetchExpenseKPIs] V_PAYROLL_FIX: Falling back to gusto_expense_facts row-sum (gusto_payroll_runs unavailable)');
  }

  // ── V_BENEFITS_FIX: Health Benefits from gusto_employee_benefit_enrollments ──
  //
  // Health Benefits Expense = employer (company) healthcare contribution per enrolled employee,
  // annualized using 26 biweekly pay periods, then prorated for the selected date range.
  //
  // Formula:
  //   Monthly employer healthcare cost per employee = company_contribution × 26 / 12
  //   (company_contribution is stored as the per-paycheck employer contribution)
  //
  // For the selected period:
  //   If single month: use the fixed monthly contribution for active enrollments.
  //   If multi-month range: prorate based on months in the selected period.
  //
  // Only includes:
  //   - active = true enrollments
  //   - health insurance plans (benefit_category includes 'health' or 'medical')
  //   - employer/company contribution only (not employee_deduction)
  //
  // Excludes:
  //   - employee-paid deductions
  //   - retirement / 401(k) plans
  //   - dental / vision (unless benefit_category = 'health')
  //   - payroll reimbursements (total_reimbursement — tracked separately above)
  if (!gustoExcluded) {
    try {
      const { data: enrollmentData, error: enrollmentError } = await supabase
        ?.from('gusto_employee_benefit_enrollments')
        ?.select(`
          id,
          employee_id,
          benefit_plan_id,
          company_contribution,
          active,
          gusto_employees(first_name, last_name),
          gusto_benefit_plans(plan_name, benefit_category, active)
        `)
        ?.eq('active', true);

      if (!enrollmentError && enrollmentData && enrollmentData?.length > 0) {
        // Filter to health insurance plans only
        // Include plans where benefit_category contains 'health' or 'medical'
        // Exclude retirement, 401k, dental-only, vision-only
        const healthEnrollments = enrollmentData?.filter(e => {
          const planCategory = (e?.gusto_benefit_plans?.benefit_category || '')?.toLowerCase();
          const planName = (e?.gusto_benefit_plans?.plan_name || '')?.toLowerCase();
          // Include health/medical plans
          const isHealthPlan = planCategory?.includes('health') || planCategory?.includes('medical') ||
            planName?.includes('health') || planName?.includes('medical');
          // Exclude retirement/401k
          const isRetirement = planCategory?.includes('401') || planCategory?.includes('retirement') ||
            planCategory?.includes('ira') || planName?.includes('401') || planName?.includes('retirement');
          // Exclude dental/vision only (unless also health)
          const isDentalVisionOnly = (planCategory?.includes('dental') || planCategory?.includes('vision')) &&
            !isHealthPlan;
          // Note: terminated employees are excluded via active=true filter on the enrollment itself
          return isHealthPlan && !isRetirement && !isDentalVisionOnly &&
            (parseFloat(e?.company_contribution) || 0) > 0;
        });

        healthBenefitsEnrolledCount = healthEnrollments?.length;

        // Calculate annualized employer healthcare contribution per enrollment
        // company_contribution is stored as per-paycheck (biweekly) amount
        // Annual = per-paycheck × 26 pay periods
        // Monthly = per-paycheck × 26 / 12
        const annualContributionPerEnrollment = healthEnrollments?.map(e => {
          const perPaycheck = parseFloat(e?.company_contribution) || 0;
          return perPaycheck * 26; // annualized using 26 biweekly pay periods
        });

        healthBenefitsAnnualTotal = annualContributionPerEnrollment?.reduce((s, v) => s + v, 0);
        const monthlyHealthBenefitsTotal = healthBenefitsAnnualTotal / 12;

        // Prorate for the selected date range
        // Calculate the number of months (or partial months) in the selected period
        const periodStart = new Date(startDate);
        const periodEnd = new Date(endDate);
        const msPerDay = 24 * 60 * 60 * 1000;
        const totalDaysInPeriod = Math.max(1, Math.round((periodEnd - periodStart) / msPerDay) + 1);

        // Calculate months in period (fractional)
        // Use exact day count / average days per month (365.25/12 ≈ 30.44)
        const avgDaysPerMonth = 365.25 / 12;
        const monthsInPeriod = totalDaysInPeriod / avgDaysPerMonth;

        healthBenefitsExpense = monthlyHealthBenefitsTotal * monthsInPeriod;

        // Mark as estimated when using current enrollment data for a historical range
        // (we don't have exact historical enrollment start/end dates in the current schema)
        const today = new Date()?.toISOString()?.split('T')?.[0];
        healthBenefitsIsEstimated = endDate < today; // historical period uses current enrollment snapshot

        console.log('[fetchExpenseKPIs] V_BENEFITS_FIX: Health Benefits from enrollments:', {
          enrolledCount: healthBenefitsEnrolledCount,
          annualTotal: healthBenefitsAnnualTotal,
          monthlyTotal: monthlyHealthBenefitsTotal,
          monthsInPeriod: monthsInPeriod?.toFixed(2),
          healthBenefitsExpense: healthBenefitsExpense?.toFixed(2),
          isEstimated: healthBenefitsIsEstimated,
          startDate,
          endDate,
        });
      } else if (enrollmentError) {
        console.warn('[fetchExpenseKPIs] V_BENEFITS_FIX: gusto_employee_benefit_enrollments query error:', enrollmentError?.message);
      }
    } catch (benefitsErr) {
      console.warn('[fetchExpenseKPIs] V_BENEFITS_FIX: health benefits fetch exception:', benefitsErr?.message);
    }
  }

  // ── V564 FIX: Override WF Banking with backend totals.wf_banking when available ──
  // summary.wfDirect is now populated from totals.wf_banking (primary path in fetchExpenseSummary).
  // The Supabase row-sum (wfBankingExpense) is kept as fallback/debug only.
  const summaryWfBankingAvail =
    summary?.wfDirect !== null &&
    summary?.wfDirect !== undefined &&
    !isNaN(summary?.wfDirect) &&
    summary?.wfDirect > 0;

  const wfBankingFinal = summaryWfBankingAvail ? summary?.wfDirect : wfBankingExpense;
  const wfBankingFallback = !summaryWfBankingAvail; // true = using row-sum fallback

  if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
    console.log('[fetchExpenseKPIs] V564: WF Banking source:', summaryWfBankingAvail ? 'backend totals.wf_banking' : 'Supabase row-sum (fallback)', {
      backendWfBanking: summary?.wfDirect,
      rowSumWfBanking: wfBankingExpense,
    });
  }

  // Add WF Banking into grand total (using backend value when available)
  totalExpenses += wfBankingFinal;

  // ── V295/V564 FIX: Override AmEx KPI total with /v2/expenses/summary ─────
  // summary.amex = net AmEx (charges minus credits/refunds) after Yabezy's V564 backend patch.
  // amexCharges and amexCredits are now also available for sublabel display.
  let amexExpense;
  const amexCharges = summary?.amexCharges ?? null;
  const amexCredits = summary?.amexCredits ?? null;

  if (summary?.amex !== null && summary?.amex !== undefined && !isNaN(summary?.amex)) {
    // Summary API succeeded — use authoritative net AmEx total (posted charges minus credits)
    const rowSummedAmex = amexVendorExpense + corporateSharedAmexExpense;
    amexExpense = summary?.amex;
    // AmEx rows were excluded from totalExpenses in the loop above — add net AmEx now
    totalExpenses += summary?.amex;
    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.log('[fetchExpenseKPIs] V564: AmEx KPI overridden by backend summary (net)', {
        rowSummedAmex,
        summaryAmexNet: summary?.amex,
        amexCharges,
        amexCredits,
        delta: summary?.amex - rowSummedAmex,
      });
    }
  } else {
    // Summary API unavailable — fall back to row-summed total
    amexExpense = amexVendorExpense + corporateSharedAmexExpense;
    totalExpenses += amexExpense;
    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.warn('[fetchExpenseKPIs] V564: summary API unavailable, using row-summed AmEx:', amexExpense, 'reason:', summary?.error);
    }
  }

  // ── V564 FIX: Override totalExpenses with backend totals.total_expenses when available ──
  // V_PAYROLL_FIX: When gustoRunsUsed=true, we have already built totalExpenses from the
  // authoritative gusto_payroll_runs.total_debit_amount. Do NOT override with the backend
  // total_expenses in this case — the backend may use the old (lower) payroll figure and
  // would undo the payroll fix. Only use the backend override on the fallback path.
  const backendTotalAvail =
    !gustoRunsUsed &&  // V_PAYROLL_FIX: skip backend override when using authoritative Gusto runs
    summary?.totalExpenses !== null &&
    summary?.totalExpenses !== undefined &&
    !isNaN(summary?.totalExpenses) &&
    summary?.totalExpenses > 0;

  const totalExpensesComponentBuilt = totalExpenses; // preserve for debug/reconciliation
  if (backendTotalAvail) {
    totalExpenses = summary?.totalExpenses;
    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.log('[fetchExpenseKPIs] V564: totalExpenses overridden by backend totals.total_expenses', {
        backendTotal: summary?.totalExpenses,
        componentBuiltTotal: totalExpensesComponentBuilt,
        delta: summary?.totalExpenses - totalExpensesComponentBuilt,
      });
    }
  } else {
    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.warn('[fetchExpenseKPIs] V564: backend totals.total_expenses unavailable — using component-built total:', totalExpenses, 'reason:', summary?.error);
    }
  }

  // ── V_PAYROLL_FIX: Benefits and payroll taxes breakdown ──────────────────────
  // When gustoRunsUsed=true, payrollExpense = total_debit_amount (net pay + taxes + deductions).
  // total_debit_amount includes total_reimbursement (payroll reimbursements).
  //
  // V_BENEFITS_FIX:
  // - healthBenefitsExpense = employer healthcare contribution from gusto_employee_benefit_enrollments
  //   (annualized using 26 pay periods, prorated for selected period)
  //   Health benefits are NOT included in total_debit_amount as a separate line — they may be
  //   paid directly to the insurance carrier outside of payroll. Do NOT double-count.
  //   Health Benefits are included in Total Expenses as a separate line item.
  //
  // - payrollReimbursements = total_reimbursement from gusto_payroll_runs
  //   These ARE already included in total_debit_amount (Gusto Payroll Funding).
  //   Show as visibility-only — do NOT add to totalExpenses again.
  //
  // When gustoRunsUsed=false (fallback path), use the previous benefitsExpense row-sum.
  const summaryPayrollTaxes = gustoRunsUsed ? gustoRunsTaxesTotal : (summary?.payrollTaxes ?? null);
  const summaryBenefits = summary?.benefits ?? null;

  // benefitsExpenseFinal: Health Benefits from enrollment company contributions.
  // When gustoRunsUsed=true: use healthBenefitsExpense (from gusto_employee_benefit_enrollments).
  //   Health benefits are a SEPARATE expense from Gusto Payroll Funding.
  //   They ARE included in Total Expenses (not visibility-only) unless already present
  //   in Wells Fargo or AmEx transactions — which is not detected here, so include them.
  // When gustoRunsUsed=false: use backend summary.benefits or row-sum fallback.
  const benefitsExpenseFinal = gustoRunsUsed
    ? healthBenefitsExpense
    : (summaryBenefits !== null && !isNaN(summaryBenefits) && summaryBenefits >= 0)
      ? summaryBenefits
      : benefitsExpense;

  // V_BENEFITS_FIX: Health benefits from enrollments are NOT already in payrollExpense (total_debit_amount).
  // total_debit_amount = net pay + payroll taxes + payroll reimbursements.
  // Employer healthcare premiums are paid directly to the carrier, not through the payroll debit.
  // Therefore benefitsAlreadyInPayroll = false — health benefits ARE included in Total Expenses.
  const benefitsAlreadyInPayroll = false; // V_BENEFITS_FIX: health benefits are separate from payroll funding

  // Add health benefits to totalExpenses (they are a separate expense, not in total_debit_amount)
  if (gustoRunsUsed && healthBenefitsExpense > 0) {
    totalExpenses += healthBenefitsExpense;
  }

  const corporateSharedTotal = corporateSharedAmexExpense + corporateSharedWFExpense;

  const otherExpense = Math.max(
    0,
    totalExpenses - payrollExpense - benefitsExpenseFinal - amexExpense - utilitiesExpense - occupancyExpense - insuranceExpense - complianceExpense - wfBankingFinal
  );

  return {
    totalExpenses,
    payrollExpense,
    benefitsExpense: benefitsExpenseFinal,
    benefitsAlreadyInPayroll,  // V_BENEFITS_FIX: false — health benefits are separate from payroll funding
    // V_BENEFITS_FIX: new fields for Health Benefits and Payroll Reimbursements
    healthBenefitsExpense: benefitsExpenseFinal,
    healthBenefitsEnrolledCount,
    healthBenefitsIsEstimated,
    healthBenefitsAnnualTotal,
    payrollReimbursements,  // total_reimbursement — visibility-only (already in Gusto Payroll Funding)
    amexExpense,
    amexCharges,
    amexCredits,
    utilitiesExpense,
    occupancyExpense,
    insuranceExpense,
    complianceExpense,
    corporateSharedTotal,
    otherExpense,
    wfBankingExpense: wfBankingFinal,
    manualEntryCount: manualCount,
    manualEntryTotal: manualTotal,
    // V_PAYROLL_FIX: expose Gusto runs breakdown for reconciliation
    _gustoRunsUsed: gustoRunsUsed,
    _gustoRunsCount: gustoRunsCount,
    _gustoRunsNetPay: gustoRunsNetPayTotal,
    _gustoRunsTaxes: gustoRunsTaxesTotal,
    _gustoRunsBenefits: gustoRunsBenefitsTotal,
    _gustoRunsPayrollTotal: gustoRunsPayrollTotal,
    // V564: expose all backend summary fields used
    _amexFromSummary: summary?.amex !== null && summary?.amex !== undefined && !isNaN(summary?.amex),
    _summaryAmex: summary?.amex ?? null,
    _summaryAmexCharges: amexCharges,
    _summaryAmexCredits: amexCredits,
    _summaryWfBanking: summary?.wfDirect ?? null,
    _summaryTotalExpenses: summary?.totalExpenses ?? null,
    _summaryPayrollTaxes: summaryPayrollTaxes,
    _summaryBenefits: summaryBenefits,
    _wfBankingFallback: wfBankingFallback,
    _backendTotalUsed: backendTotalAvail,
    _componentBuiltTotal: totalExpensesComponentBuilt,
    _wfReferenceBuckets: summary?.wfReferenceBuckets ?? null,
    _expenseModel: summary?.expenseModel ?? null,
    reconciliation: {
      payrollExpense,
      benefitsExpense: benefitsExpenseFinal,
      benefitsAlreadyInPayroll,
      // V_BENEFITS_FIX: reconciliation detail
      healthBenefitsExpense: benefitsExpenseFinal,
      healthBenefitsEnrolledCount,
      healthBenefitsIsEstimated,
      healthBenefitsAnnualTotal,
      payrollReimbursements,
      gustoRunsUsed,
      gustoRunsCount,
      gustoRunsNetPay: gustoRunsNetPayTotal,
      gustoRunsTaxes: gustoRunsTaxesTotal,
      gustoRunsBenefits: gustoRunsBenefitsTotal,
      gustoRunsPayrollTotal,
      amexVendorExpense,
      corporateSharedAmexExpense,
      corporateSharedWFExpense,
      bankDirectExpense,
      wfBankingExpense: wfBankingFinal,
      wfBankingRowSum: wfBankingExpense,
      wfBankingFromBackend: summaryWfBankingAvail ? summary?.wfDirect : null,
      reviewedManualExpense,
      excludedAmexBillPayments,
      excludedPayrollFunding,
      excludedInternalTransfers,
      excludedManualEntries,
      excludedUnreviewedCorporate,
      // V564: new backend fields for debug panel
      amexCharges,
      amexCredits,
      payrollTaxes: summaryPayrollTaxes,
      benefits: summaryBenefits,
      wfReferenceBuckets: summary?.wfReferenceBuckets ?? null,
      expenseModel: summary?.expenseModel ?? null,
      backendTotalExpenses: summary?.totalExpenses ?? null,
      componentBuiltTotal: totalExpensesComponentBuilt,
      calculatedTotal: totalExpenses,
      displayedTotal: totalExpenses,
    },
  };
}

// ── FETCH WF/AMEX OPERATING EXPENSES (Office Performance — V286) ──────────────
/**
 * fetchWFAmexOperatingExpenses — ISOLATED helper for Office Performance Expense Ratio KPI.
 *
 * Scope: AmEx vendor charges + WF Banking direct operating expenses ONLY.
 * Gusto/payroll rows are EXCLUDED to prevent double-counting.
 * Only posted/finalized rows are included (expense_status = 'posted').
 *
 * This helper does NOT modify fetchExpenseKPIs() behavior and does NOT affect
 * Expense Report, Financial Analytics, or any other module.
 *
 * Formula consumer: (amexExpense + wfBankingExpense) ÷ netProduction × 100
 *
 * @param {object} params
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate   - YYYY-MM-DD
 * @param {string[]} params.officeIds - UUID array (AmEx rows filtered by office_id)
 *                                      WF Banking rows filtered by office_name via OFFICE_MAP
 * @returns {{ amexExpense: number, wfBankingExpense: number, totalWFAmexExpense: number,
 *             rowCount: number, hasData: boolean, error: string|null }}
 */
export async function fetchWFAmexOperatingExpenses({
  startDate,
  endDate,
  officeIds = [],
} = {}) {
  try {
    if (!startDate || !endDate) {
      return { amexExpense: null, wfBankingExpense: null, totalWFAmexExpense: null, rowCount: 0, hasData: false, error: 'Missing date range' };
    }

    // ── AmEx query: source_type IN ('amex_api', 'amex_statement_import'), posted only ──
    let amexQuery = supabase
      ?.from('expenses')
      ?.select('id, amount, source_type, source_tab, office_id, office_name, expense_status, allocation_metadata, card_last4, cardholder_name, category_name, merchant_name, vendor_name, notes')
      ?.in('source_type', ['amex_api', 'amex_statement_import'])
      ?.eq('expense_status', 'posted')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate)
      ?.neq('source_tab', 'Banking');

    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) {
      amexQuery = amexQuery?.in('office_id', activeOffices);
    }

    // ── WF Banking query: source_tab = 'Banking', posted only ──
    // WF Banking rows have office_id = NULL — filter by office_name via OFFICE_MAP
    let wfOfficeName = null;
    if (activeOffices?.length > 0) {
      const { OFFICE_MAP } = await import('../constants/offices');
      const officeEntry = Object.entries(OFFICE_MAP || {})?.find(([id]) => activeOffices?.includes(id));
      wfOfficeName = officeEntry?.[1]?.name || null;
    }

    let wfQuery = supabase
      ?.from('expenses')
      ?.select('id, amount, source_type, source_tab, office_id, office_name, expense_status, allocation_metadata, card_last4, cardholder_name, category_name, merchant_name, vendor_name, notes')
      ?.eq('source_tab', 'Banking')
      ?.eq('expense_status', 'posted')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate)
      ?.limit(1000);

    if (wfOfficeName) {
      wfQuery = wfQuery?.ilike('office_name', `%${wfOfficeName}%`);
    }

    const [amexRes, wfRes] = await Promise.allSettled([amexQuery, wfQuery]);

    const amexRows = amexRes?.status === 'fulfilled' ? (amexRes?.value?.data || []) : [];
    const wfRawRows = wfRes?.status === 'fulfilled' ? (wfRes?.value?.data || []) : [];

    // ── Sum AmEx vendor charges ──
    // Exclude rows with excluded_from_expense = true
    // Include both office-assigned and corporate AmEx cards (amexVendorExpense + corporateSharedAmexExpense)
    let amexExpense = 0;
    for (const r of amexRows) {
      const meta = r?.allocation_metadata || {};
      if (meta?.excluded_from_expense === true) continue;
      const amt = parseFloat(r?.amount);
      if (isNaN(amt) || amt <= 0) continue;
      amexExpense += amt;
    }

    // ── Sum WF Banking direct operating expenses ──
    // V288/V290 FIX: Use isWFDirectOperatingExpense() and Math.abs() so that:
    //   - WF withdrawals stored as negative (e.g., -8500 rent) are correctly included
    //   - payroll_funding and AmEx bill payments are excluded (handled by isWFDirectOperatingExpense)
    //   - Only main_operating_direct_expense (and safe corporate vendor rows) pass
    let wfBankingExpense = 0;
    for (const r of wfRawRows) {
      if (!isWFDirectOperatingExpense(r)) continue;
      const meta = r?.allocation_metadata || {};
      if (meta?.excluded_from_expense === true) continue;
      const amt = Math.abs(parseFloat(r?.amount) || 0);
      if (amt <= 0) continue;
      wfBankingExpense += amt;
    }

    const totalWFAmexExpense = amexExpense + wfBankingExpense;
    const rowCount = amexRows?.length + wfRawRows?.length;

    return {
      amexExpense,
      wfBankingExpense,
      totalWFAmexExpense,
      rowCount,
      hasData: rowCount > 0,
      error: null,
    };
  } catch (err) {
    console.error('[fetchWFAmexOperatingExpenses] Error:', err?.message);
    return {
      amexExpense: null,
      wfBankingExpense: null,
      totalWFAmexExpense: null,
      rowCount: 0,
      hasData: false,
      error: err?.message || 'Expense fetch failed',
    };
  }
}

// ── FETCH EXPENSE BY OFFICE ───────────────────────────────────────────────────
export async function fetchExpensesByOffice({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  // Reuse fetchExpenseRecords — same dual-query path ensures Banking rows are included
  // V295: postedOnly:true to match fetchExpenseKPIs — draft rows must not feed verified charts
  const data = await fetchExpenseRecords({
    startDate,
    endDate,
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes,
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
    limit: 2000,
    offset: 0,
    postedOnly: true,
  });

  // V295: Fetch gusto_expense_facts using same logic as fetchExpenseKPIs
  const gustoExcluded =
    (sourceTypes?.length > 0 && !sourceTypes?.includes('gusto') && !sourceTypes?.includes('gusto_payroll')) ||
    (paymentSources?.length > 0 && !paymentSources?.includes('gusto'));

  let gustoRows = [];
  if (!gustoExcluded) {
    let gq = supabase
      ?.from('gusto_expense_facts')
      ?.select('expense_amount, expense_category, expense_source, office_name, office_id, expense_date, gusto_run_id')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate);
    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) gq = gq?.in('office_id', activeOffices);
    const gustoRes = await gq;
    gustoRows = gustoRes?.data || [];
  }

  // V297 FIX: When gusto_expense_facts has rows for the period, treat it as the
  // authoritative payroll source. All gusto_expense_facts rows are included (no dedup needed
  // since we skip expenses-table gusto rows below). If gusto_expense_facts is empty,
  // fall back to expenses-table gusto rows with run/category/date dedup.
  const useGustoFactsAsSourceOffice = gustoRows?.length > 0;

  const gustoContrib = useGustoFactsAsSourceOffice
    ? gustoRows // use all gusto_expense_facts rows — expenses-table gusto rows will be skipped below
    : (() => {
        // Fallback: dedup by run/category/date against expenses-table gusto rows
        const gustoKeysInExpenses = new Set();
        data?.forEach(r => {
          if (r?.source_type !== 'gusto' && r?.source_type !== 'gusto_payroll') return;
          const runId = r?.allocation_metadata?.gusto_run_id || r?.source_reference_id || '';
          const cat = (r?.category_name || '')?.toLowerCase();
          const dt = r?.expense_date || '';
          if (runId) gustoKeysInExpenses?.add(`${runId}|${cat}|${dt}`);
        });
        return gustoRows?.filter(g => {
          const runId = g?.gusto_run_id || '';
          const cat = (g?.expense_category || '')?.toLowerCase();
          const dt = g?.expense_date || '';
          if (!runId) return true;
          return !gustoKeysInExpenses?.has(`${runId}|${cat}|${dt}`);
        });
      })();

  const byOffice = {};

  (data || [])?.forEach(r => {
    const amt = parseFloat(r?.amount) || 0;
    if (amt <= 0) return;

    if (isExcludedFromExpense(r)) return;
    // V290: Use isWFDirectOperatingExpense to exclude payroll_funding and AmEx bill payments from charts
    if (r?.source_tab === 'Banking' && !isWFDirectOperatingExpense(r)) return;
    // V292: Exclude internal funding transfers and AmEx liability payments by category/merchant signal
    if (isInternalFundingTransfer(r)) return;
    // V297 FIX: Skip old aggregate gusto/gusto_payroll rows from expenses table
    // when gusto_expense_facts is the authoritative source for this period.
    if (useGustoFactsAsSourceOffice && (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll')) return;

    if (r?.source_tab === 'Banking') {
      const office = normalizeOfficeName(r?.office_name) || 'Unassigned';
      byOffice[office] = (byOffice?.[office] || 0) + Math.abs(amt);
      return;
    }

    const cls3526 = classify3526Transaction(r);
    if (cls3526) {
      if (cls3526 === 'liability_payment_to_amex') return;
      if (cls3526 === 'payroll_funding') return;
      if (cls3526 === 'internal_transfer') return;
      if (cls3526 === 'corporate_shared_payroll_benefit_payment') return;
      const corpKey = 'Corporate / Shared — Needs Allocation';
      byOffice[corpKey] = (byOffice?.[corpKey] || 0) + amt;
      return;
    }

    if (isAmexSource(r?.source_type)) {
      const cardLast4 = String(r?.card_last4 || '')?.replace(/\D/g, '')?.slice(-4);
      if (CORPORATE_AMEX_CARD_LAST4S?.has(cardLast4)) {
        const corpKey = 'Corporate / Shared — Needs Allocation';
        byOffice[corpKey] = (byOffice?.[corpKey] || 0) + amt;
        return;
      }
      const resolvedOffice = resolveAmexOfficeName(r?.card_last4, r?.cardholder_name)
        || normalizeOfficeName(r?.office_name)
        || r?.office_name
        || 'Unassigned';
      byOffice[resolvedOffice] = (byOffice?.[resolvedOffice] || 0) + amt;
      return;
    }

    const merchant = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
    const notes = (r?.notes || '')?.toLowerCase();
    const cat = (r?.category_name || '')?.toLowerCase();
    const haystack = `${cat} ${merchant} ${notes}`;
    const isTransfer = INTERNAL_TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
    if (isTransfer) return;

    const office = normalizeOfficeName(r?.office_name) || 'Unassigned';
    byOffice[office] = (byOffice?.[office] || 0) + amt;
  });

  // V295: Add Gusto payroll rows by office_name from gusto_expense_facts
  // Corporate/Shared management payroll uses 'Corporate / Shared' key (not 'Needs Allocation')
  (gustoContrib || [])?.forEach(g => {
    const gAmt = parseFloat(g?.expense_amount) || 0;
    if (gAmt <= 0) return;
    const rawOffice = g?.office_name || '';
    let normalized = normalizeOfficeName(rawOffice) || rawOffice;
    // Gusto corporate/shared payroll is intentional — label it 'Corporate / Shared', not 'Needs Allocation'
    const officeKey = normalized === 'Corporate / Shared — Needs Allocation' ?'Corporate / Shared' : (normalized ||'Corporate / Shared');
    byOffice[officeKey] = (byOffice?.[officeKey] || 0) + gAmt;
  });

  return Object.entries(byOffice)?.map(([office, total]) => ({ office, total }));
}

// ── FETCH EXPENSE BY CATEGORY ─────────────────────────────────────────────────
export async function fetchExpensesByCategory({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  // Reuse fetchExpenseRecords — same dual-query path ensures Banking rows are included
  // V295: postedOnly:true to match fetchExpenseKPIs — draft rows must not feed verified charts
  const data = await fetchExpenseRecords({
    startDate,
    endDate,
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes,
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
    limit: 2000,
    offset: 0,
    postedOnly: true,
  });

  // V295: Fetch gusto_expense_facts using same logic as fetchExpenseKPIs
  const gustoExcluded =
    (sourceTypes?.length > 0 && !sourceTypes?.includes('gusto') && !sourceTypes?.includes('gusto_payroll')) ||
    (paymentSources?.length > 0 && !paymentSources?.includes('gusto'));

  let gustoRows = [];
  if (!gustoExcluded) {
    let gq = supabase
      ?.from('gusto_expense_facts')
      ?.select('expense_amount, expense_category, expense_source, office_name, office_id, expense_date, gusto_run_id')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate);
    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) gq = gq?.in('office_id', activeOffices);
    const gustoRes = await gq;
    gustoRows = gustoRes?.data || [];
  }

  // V297 FIX: When gusto_expense_facts has rows for the period, treat it as the
  // authoritative payroll source. Skip expenses-table gusto rows to prevent double-counting.
  const useGustoFactsAsSourceCat = gustoRows?.length > 0;

  const gustoContrib = useGustoFactsAsSourceCat
    ? gustoRows
    : (() => {
        const gustoKeysInExpenses = new Set();
        data?.forEach(r => {
          if (r?.source_type !== 'gusto' && r?.source_type !== 'gusto_payroll') return;
          const runId = r?.allocation_metadata?.gusto_run_id || r?.source_reference_id || '';
          const cat = (r?.category_name || '')?.toLowerCase();
          const dt = r?.expense_date || '';
          if (runId) gustoKeysInExpenses?.add(`${runId}|${cat}|${dt}`);
        });
        return gustoRows?.filter(g => {
          const runId = g?.gusto_run_id || '';
          const cat = (g?.expense_category || '')?.toLowerCase();
          const dt = g?.expense_date || '';
          if (!runId) return true;
          return !gustoKeysInExpenses?.has(`${runId}|${cat}|${dt}`);
        });
      })();

  const byCat = {};
  (data || [])?.forEach(r => {
    if (isExcludedFromExpense(r)) return;
    // V290: Use isWFDirectOperatingExpense to exclude payroll_funding and AmEx bill payments from category charts
    if (r?.source_tab === 'Banking' && !isWFDirectOperatingExpense(r)) return;
    // V292: Exclude internal funding transfers and AmEx liability payments by category/merchant signal
    if (isInternalFundingTransfer(r)) return;
    // V297 FIX: Skip old aggregate gusto/gusto_payroll rows from expenses table
    if (useGustoFactsAsSourceCat && (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll')) return;

    const cat = r?.category_name || 'Uncategorized';
    byCat[cat] = (byCat?.[cat] || 0) + Math.abs(parseFloat(r?.amount) || 0);
  });

  // V295: Add Gusto payroll/tax rows to their respective categories
  // Do not reintroduce internal transfers; do not double-count WF payroll_funding or AmEx bill payments
  (gustoContrib || [])?.forEach(g => {
    const gAmt = parseFloat(g?.expense_amount) || 0;
    if (gAmt <= 0) return;
    const cat = g?.expense_category || 'Payroll';
    byCat[cat] = (byCat?.[cat] || 0) + gAmt;
  });

  return Object.entries(byCat)
    ?.map(([category, total]) => ({ category, total }))
    ?.sort((a, b) => b?.total - a?.total);
}

// ── FETCH MONTHLY TREND ───────────────────────────────────────────────────────
export async function fetchMonthlyExpenseTrend({
  year,
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
} = {}) {
  const rangeStart = startDate || `${year}-01-01`;
  const rangeEnd = endDate || `${year}-12-31`;

  // Reuse fetchExpenseRecords — same dual-query path ensures Banking rows are included
  // V295: postedOnly:true to match fetchExpenseKPIs — draft rows must not feed verified charts
  const data = await fetchExpenseRecords({
    startDate: rangeStart,
    endDate: rangeEnd,
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes,
    paymentSources,
    statuses,
    limit: 2000,
    offset: 0,
    postedOnly: true,
  });

  // V295: Fetch gusto_expense_facts using same logic as fetchExpenseKPIs
  const gustoExcluded =
    (sourceTypes?.length > 0 && !sourceTypes?.includes('gusto') && !sourceTypes?.includes('gusto_payroll')) ||
    (paymentSources?.length > 0 && !paymentSources?.includes('gusto'));

  let gustoRows = [];
  if (!gustoExcluded) {
    let gq = supabase
      ?.from('gusto_expense_facts')
      ?.select('expense_amount, expense_category, expense_source, office_name, office_id, expense_date, gusto_run_id')
      ?.gte('expense_date', rangeStart)
      ?.lte('expense_date', rangeEnd);
    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) gq = gq?.in('office_id', activeOffices);
    const gustoRes = await gq;
    gustoRows = gustoRes?.data || [];
  }

  // V297 FIX: When gusto_expense_facts has rows for the period, treat it as the
  // authoritative payroll source. Skip expenses-table gusto rows to prevent double-counting.
  const useGustoFactsAsSourceTrend = gustoRows?.length > 0;

  const gustoContrib = useGustoFactsAsSourceTrend
    ? gustoRows
    : (() => {
        const gustoKeysInExpenses = new Set();
        data?.forEach(r => {
          if (r?.source_type !== 'gusto' && r?.source_type !== 'gusto_payroll') return;
          const runId = r?.allocation_metadata?.gusto_run_id || r?.source_reference_id || '';
          const cat = (r?.category_name || '')?.toLowerCase();
          const dt = r?.expense_date || '';
          if (runId) gustoKeysInExpenses?.add(`${runId}|${cat}|${dt}`);
        });
        return gustoRows?.filter(g => {
          const runId = g?.gusto_run_id || '';
          const cat = (g?.expense_category || '')?.toLowerCase();
          const dt = g?.expense_date || '';
          if (!runId) return true;
          return !gustoKeysInExpenses?.has(`${runId}|${cat}|${dt}`);
        });
      })();

  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { month: m, total: 0, payroll: 0, amex: 0, utilities: 0, other: 0 };
  }

  (data || [])?.forEach(r => {
    if (r?.source_tab === 'Banking') {
      // V290: Use isWFDirectOperatingExpense to exclude payroll_funding and AmEx bill payments from monthly trend
      if (!isWFDirectOperatingExpense(r)) return;
    }
    // V292: Exclude internal funding transfers and AmEx liability payments by category/merchant signal
    if (isInternalFundingTransfer(r)) return;
    // V297 FIX: Skip old aggregate gusto/gusto_payroll rows from expenses table
    if (useGustoFactsAsSourceTrend && (r?.source_type === 'gusto' || r?.source_type === 'gusto_payroll')) return;
    let m = new Date(r?.expense_date + 'T00:00:00')?.getMonth() + 1;
    if (!byMonth?.[m]) return;
    const amt = Math.abs(parseFloat(r?.amount) || 0);
    byMonth[m].total += amt;
    const cat = (r?.category_name || '')?.toLowerCase();
    if (cat?.includes('payroll') || cat?.includes('wages') || r?.source_type === 'gusto') byMonth[m].payroll += amt;
    else if (r?.source_type === 'amex_api' || r?.source_type === 'amex_statement_import') byMonth[m].amex += amt;
    else if (cat?.includes('utilit')) byMonth[m].utilities += amt;
    else byMonth[m].other += amt;
  });

  // V295: Add Gusto payroll rows to the Payroll bar for the correct month
  (gustoContrib || [])?.forEach(g => {
    const gAmt = parseFloat(g?.expense_amount) || 0;
    if (gAmt <= 0 || !g?.expense_date) return;
    let m = new Date(g?.expense_date + 'T00:00:00')?.getMonth() + 1;
    if (!byMonth?.[m]) return;
    byMonth[m].total += gAmt;
    byMonth[m].payroll += gAmt;
  });

  return Object.values(byMonth);
}

// ── FETCH AMEX TRANSACTIONS ───────────────────────────────────────────────────
export async function fetchAmexTransactions({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
  limit = 2000,
  offset = 0,
} = {}) {
  // ── PRIMARY: Backend API /v2/expenses/amex ────────────────────────────────
  // V295 FIX: Pass status=posted to the API so the official AmEx Detail tab
  // shows posted-only rows for the official Net AmEx Spend total.
  // Draft/pending Plaid rows ($4,660.52 across 21 rows) must NOT be included
  // in the official Net AmEx Spend — they are fetched separately below.
  try {
    const params = new URLSearchParams();
    if (startDate) params?.set('startDate', startDate);
    if (endDate) params?.set('endDate', endDate);
    if (cardholderName) params?.set('cardholderName', cardholderName);
    if (merchantName) params?.set('merchantName', merchantName);
    if (officeIds?.length === 1) params?.set('officeId', officeIds?.[0]);
    if (departmentNames?.length > 0) params?.set('department', departmentNames?.[0]);
    if (categoryNames?.length > 0) params?.set('category', categoryNames?.[0]);
    // V295 FIX: If no explicit status filter is set by the user, default to posted-only
    // for the official AmEx Detail tab. This ensures Net AmEx Spend = $251,648.75 (posted only),
    // not $256,309.27 (posted + draft).
    const effectiveStatus = statuses?.length > 0 ? statuses?.[0] : 'posted';
    params?.set('status', effectiveStatus);

    const apiUrl = `${MIDDLEWARE_API_BASE}/expenses/amex?${params?.toString()}`;
    const res = await fetch(apiUrl, { headers: _middlewareHeaders() });

    if (res?.ok) {
      const json = await res?.json();
      // API may return { data: [...] } or directly [...]
      const rawRows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json?.data : null);

      if (rawRows !== null) {
        // Normalize and enrich rows from API response
        let normalized = rawRows?.map(r => ({
          ...r,
          office_name: normalizeOfficeName(r?.office_name) || r?.office_name || 'Unassigned',
        }));
        return enrichAmexRows(normalized);
      }
      // If API returned unexpected shape, fall through to Supabase
      console.warn('[expenseReportService] fetchAmexTransactions: unexpected API response shape, falling back to Supabase');
    } else {
      console.warn('[expenseReportService] fetchAmexTransactions: API returned', res?.status, '— falling back to Supabase');
    }
  } catch (apiErr) {
    console.warn('[expenseReportService] fetchAmexTransactions: API fetch failed, falling back to Supabase:', apiErr?.message);
  }

  // ── FALLBACK: Complete, exact-count Supabase pages ────────────────────────
  // V295 FIX: Use eq('expense_status', 'posted') instead of neq('archived').
  // This ensures the fallback path also returns posted-only rows, consistent with
  // the API path and the KPI summary source. Draft/pending Plaid rows are excluded.
  let query = supabase
    ?.from('expenses')?.select(`
      id, expense_date, posted_date, statement_period_start, statement_period_end,
      office_name, department_name, category_name, merchant_name,
      cardholder_name, cardholder_role, card_last4, amount,
      source_type, source_reference_id, notes, expense_status
    `, { count: 'exact' })
    ?.in('source_type', ['amex_api', 'amex_statement_import'])
    ?.gte('expense_date', startDate)
    ?.lte('expense_date', endDate)
    ?.eq('expense_status', 'posted')
    ?.order('expense_date', { ascending: false })
    ?.order('id', { ascending: true });

  query = _applyFilters(query, {
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes: [],   // AmEx tab is AmEx-only — never filter by UI sourceType here
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
  });

  const { data } = await readCompleteExpenseQuery(query);

  let normalized = (data || [])?.map(r => ({
    ...r,
    office_name: normalizeOfficeName(r?.office_name) || r?.office_name || 'Unassigned',
  }));
  return enrichAmexRows(normalized);
}

// ── FETCH AMEX DRAFT/PENDING ROWS (excluded from official totals) ─────────────
/**
 * fetchAmexDraftRows — V295 FIX
 *
 * Fetches AmEx rows with expense_status = 'draft' AND pending_plaid = true.
 * These rows are excluded from the official posted AmEx total. Draft/pending AmEx rows are excluded from the official posted AmEx total.
 * They are displayed in the AmEx Detail tab with a clear "Draft / Pending — excluded * from official totals" label for audit transparency.
 *
 * Expected: $4,660.52 across 21 rows for YTD / All Offices.
 */
export async function fetchAmexDraftRows({
  startDate,
  endDate,
  officeIds = [],
  cardholderName = null,
  merchantName = null,
  limit = 500,
  offset = 0,
} = {}) {
  try {
    let query = supabase
      ?.from('expenses')
      ?.select(`
        id, expense_date, posted_date, office_name, department_name, category_name,
        merchant_name, cardholder_name, cardholder_role, card_last4, amount,
        source_type, source_reference_id, notes, expense_status, allocation_metadata
      `)
      ?.in('source_type', ['amex_api', 'amex_statement_import'])
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate)
      ?.eq('expense_status', 'draft')
      ?.neq('expense_status', 'archived')
      ?.order('expense_date', { ascending: false })
      ?.range(offset, offset + limit - 1);

    const activeOffices = (officeIds || [])?.filter(o => o && o !== 'all');
    if (activeOffices?.length > 0) query = query?.in('office_id', activeOffices);
    if (cardholderName) query = query?.ilike('cardholder_name', `%${cardholderName}%`);
    if (merchantName) query = query?.ilike('merchant_name', `%${merchantName}%`);

    const { data, error } = await query;
    if (error) {
      console.warn('[expenseReportService] fetchAmexDraftRows error:', error?.message);
      return [];
    }

    let normalized = (data || [])?.map(r => ({
      ...r,
      office_name: normalizeOfficeName(r?.office_name) || r?.office_name || 'Unassigned',
      _isDraftPending: true,
    }));
    return enrichAmexRows(normalized);
  } catch (err) {
    console.warn('[expenseReportService] fetchAmexDraftRows error:', err?.message);
    return [];
  }
}

// ── FETCH AMEX BY CARDHOLDER ──────────────────────────────────────────────────
export async function fetchAmexByCardholder({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  let query = supabase
    ?.from('expenses')
    ?.select('cardholder_name, cardholder_role, card_last4, amount, office_name, department_name')
    ?.in('source_type', ['amex_api', 'amex_statement_import'])
    ?.gte('expense_date', startDate)
    ?.lte('expense_date', endDate)
    ?.neq('expense_status', 'archived');

  query = _applyFilters(query, {
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes: [],
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
  });

  const { data, error } = await query;
  if (error) return [];

  const byCardholder = {};
  (data || [])?.forEach(r => {
    const name = r?.cardholder_name || 'Unassigned Cardholder';
    // Resolve office via AmEx card mapping; fall back to DB office_name
    const resolvedOffice = resolveAmexOfficeName(r?.card_last4, r?.cardholder_name)
      || normalizeOfficeName(r?.office_name)
      || r?.office_name
      || 'Unassigned';
    if (!byCardholder?.[name]) {
      byCardholder[name] = {
        cardholder: name,
        role: r?.cardholder_role || 'amex_card',
        office: resolvedOffice,
        total: 0,
        transactions: 0,
      };
    }
    byCardholder[name].total += parseFloat(r?.amount) || 0;
    byCardholder[name].transactions += 1;
  });

  return Object.values(byCardholder)?.sort((a, b) => b?.total - a?.total);
}

// ── FETCH AMEX BY MERCHANT ────────────────────────────────────────────────────
export async function fetchAmexByMerchant({
  startDate,
  endDate,
  officeIds = [],
  departmentNames = [],
  categoryNames = [],
  sourceTypes = [],
  paymentSources = [],
  statuses = [],
  cardholderName = null,
  merchantName = null,
} = {}) {
  let query = supabase
    ?.from('expenses')
    ?.select('merchant_name, amount')
    ?.in('source_type', ['amex_api', 'amex_statement_import'])
    ?.gte('expense_date', startDate)
    ?.lte('expense_date', endDate)
    ?.neq('expense_status', 'archived');

  query = _applyFilters(query, {
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes: [],
    paymentSources,
    statuses,
    cardholderName,
    merchantName,
  });

  const { data, error } = await query;
  if (error) return [];

  const byMerchant = {};
  (data || [])?.forEach(r => {
    let m = r?.merchant_name || 'Unknown Merchant';
    byMerchant[m] = (byMerchant?.[m] || 0) + (parseFloat(r?.amount) || 0);
  });

  return Object.entries(byMerchant)
    ?.map(([merchant, total]) => ({ merchant, total }))
    ?.sort((a, b) => b?.total - a?.total)
    ?.slice(0, 20);
}

// ── IMPORT AMEX CSV ───────────────────────────────────────────────────────────
export async function importAmexCSV({ rows, importedBy, statementPeriodStart = null, statementPeriodEnd = null, filename } = {}) {
  if (!rows?.length) return { imported: 0, duplicates: 0, errors: 0, batchId: null };

  const { data: batch, error: batchErr } = await supabase
    ?.from('expense_import_batches')
    ?.insert({
      source_type: 'amex_statement_import',
      import_filename: filename,
      statement_period_start: statementPeriodStart,
      statement_period_end: statementPeriodEnd,
      imported_by: importedBy,
      import_status: 'processing',
      total_rows: rows?.length,
      total_amount: rows?.reduce((s, r) => s + (parseFloat(r?.amount) || 0), 0),
    })
    ?.select('id')
    ?.single();

  if (batchErr || !batch?.id) {
    console.warn('[expenseReportService] importAmexCSV batch create error:', batchErr?.message);
    return { imported: 0, duplicates: 0, errors: 1, batchId: null };
  }

  const batchId = batch?.id;
  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  const chunks = [];
  for (let i = 0; i < rows?.length; i += 50) chunks?.push(rows?.slice(i, i + 50));

  for (const chunk of chunks) {
    const stagingRows = chunk?.map(r => ({
      import_batch_id: batchId,
      cardholder_name: r?.cardholder_name || r?.card_member || null,
      card_last4: r?.card_last4 || (r?.account_number ? String(r?.account_number)?.slice(-4) : null),
      merchant_name: r?.merchant_name || r?.description || null,
      transaction_date: r?.transaction_date || r?.date || null,
      posted_date: r?.posted_date || r?.date || null,
      statement_period_start: r?.statement_period_start || null,
      statement_period_end: r?.statement_period_end || null,
      amount: parseFloat(r?.amount) || 0,
      description: r?.description || null,
      reference_number: r?.reference_number || r?.ref || null,
      source_type: 'amex_statement_import',
      raw_data: r,
      needs_review: !r?.cardholder_name && !r?.card_member,
      review_reason: !r?.cardholder_name && !r?.card_member ? 'Missing cardholder' : null,
      // Phase 1/2 columns — left NULL; backend preflight RPC populates these later
      // review_status: NULL (not set here)
      // source_fingerprint: NULL (not set here)
      // duplicate_status: NULL (not set here)
      // proposed_office: NULL (not set here)
    }));

    const { data: inserted, error: insertErr } = await supabase
      ?.from('amex_raw_transactions')
      ?.insert(stagingRows)
      ?.select('id');

    if (insertErr) {
      if (insertErr?.code === '23505') {
        // Phase 3A fix: chunk-level 23505 — fall back to row-by-row so only true
        // duplicate rows are counted as duplicates; clean rows still insert.
        for (let ri = 0; ri < stagingRows?.length; ri++) {
          const { data: singleInserted, error: singleErr } = await supabase
            ?.from('amex_raw_transactions')
            ?.insert(stagingRows?.[ri])
            ?.select('id');
          if (singleErr) {
            if (singleErr?.code === '23505') {
              duplicates += 1; // true duplicate
            } else {
              errors += 1; // non-duplicate failure
            }
          } else {
            imported += (singleInserted || [])?.length;
          }
        }
      } else {
        errors += chunk?.length;
      }
    } else {
      imported += (inserted || [])?.length;
    }
  }

  await supabase
    ?.from('expense_import_batches')
    ?.update({
      import_status: errors > 0 ? 'partial' : 'completed',
      duplicate_rows: duplicates,
      rejected_rows: errors,
      updated_at: new Date()?.toISOString(),
    })
    ?.eq('id', batchId);

  return { imported, duplicates, errors, batchId };
}

// ── NORMALIZE AMEX STAGING → EXPENSES ────────────────────────────────────────
export async function normalizeAmexBatch({ batchId, officeId, officeName, departmentId, departmentName, categoryId, categoryName } = {}) {
  const { data: rawRows, error } = await supabase
    ?.from('amex_raw_transactions')
    ?.select('*')
    ?.eq('import_batch_id', batchId)
    ?.eq('is_duplicate', false);

  if (error || !rawRows?.length) return { normalized: 0, skipped: 0 };

  let normalized = 0;
  let skipped = 0;

  const expenseRows = rawRows?.map(r => ({
    office_id: officeId || null,
    office_name: officeName ? normalizeOfficeName(officeName) : null,
    department_id: departmentId || null,
    department_name: departmentName || null,
    category_id: categoryId || null,
    category_name: categoryName || 'American Express / Corporate Card',
    source_type: 'amex_statement_import',
    payment_source: 'amex',
    source_reference_id: r?.reference_number || r?.id,
    source_table: 'amex_raw_transactions',
    source_tab: 'Expense Report / AmEx Import',
    import_batch_id: batchId,
    expense_date: r?.transaction_date || r?.posted_date,
    posted_date: r?.posted_date,
    statement_period_start: r?.statement_period_start,
    statement_period_end: r?.statement_period_end,
    amount: r?.amount,
    cardholder_name: r?.cardholder_name || 'Unassigned Cardholder',
    card_last4: r?.card_last4,
    merchant_name: r?.merchant_name,
    allocation_method: 'direct_to_office',
    expense_status: 'posted',
    notes: r?.description,
  }));

  const { data: inserted, error: insertErr } = await supabase
    ?.from('expenses')
    ?.insert(expenseRows)
    ?.select('id');

  if (insertErr) {
    if (insertErr?.code === '23505') skipped = expenseRows?.length;
    else console.warn('[expenseReportService] normalizeAmexBatch error:', insertErr?.message);
  } else {
    normalized = (inserted || [])?.length;
    for (let i = 0; i < rawRows?.length; i++) {
      if (inserted?.[i]?.id) {
        await supabase
          ?.from('amex_raw_transactions')
          ?.update({ normalized_expense_id: inserted?.[i]?.id })
          ?.eq('id', rawRows?.[i]?.id);
      }
    }
  }

  return { normalized, skipped };
}

// ── MANUAL EXPENSE ENTRY ──────────────────────────────────────────────────────
export async function createManualExpense({
  officeId, officeName, departmentId, departmentName,
  categoryId, categoryName, subcategoryName,
  vendorId, vendorName, expenseDate, amount,
  notes, createdBy, isRecurring = false,
  recurringTemplateId = null,
} = {}) {
  const { data, error } = await supabase
    ?.from('expenses')
    ?.insert({
      office_id: officeId || null,
      office_name: officeName ? normalizeOfficeName(officeName) : null,
      department_id: departmentId || null,
      department_name: departmentName || null,
      category_id: categoryId || null,
      category_name: categoryName || null,
      subcategory_name: subcategoryName || null,
      vendor_id: vendorId || null,
      vendor_name: vendorName || null,
      source_type: isRecurring ? 'recurring' : 'manual',
      payment_source: 'manual',
      source_tab: 'Expense Report / Manual Entry',
      expense_date: expenseDate,
      amount: parseFloat(amount) || 0,
      notes: notes || null,
      created_by: createdBy || null,
      expense_status: 'posted',
      is_recurring: isRecurring,
      recurring_template_id: recurringTemplateId || null,
      allocation_method: 'direct_to_office',
    })
    ?.select('id')
    ?.single();

  if (error) {
    console.warn('[expenseReportService] createManualExpense error:', error?.message);
    return { success: false, error: error?.message };
  }
  return { success: true, id: data?.id };
}

// ── UPDATE EXPENSE ────────────────────────────────────────────────────────────
export async function updateExpense(id, updates = {}) {
  const { error } = await supabase
    ?.from('expenses')
    ?.update({ ...updates, updated_at: new Date()?.toISOString() })
    ?.eq('id', id);

  if (error) {
    console.warn('[expenseReportService] updateExpense error:', error?.message);
    return { success: false, error: error?.message };
  }
  return { success: true };
}

// ── FETCH CATEGORIES ──────────────────────────────────────────────────────────
export async function fetchExpenseCategories() {
  const { data, error } = await supabase
    ?.from('expense_categories')
    ?.select('id, name, parent_category_id, sort_order, is_active')
    ?.eq('is_active', true)
    ?.order('sort_order');

  if (error) return [];
  return data || [];
}

// ── FETCH DEPARTMENTS ─────────────────────────────────────────────────────────
export async function fetchExpenseDepartments(officeId = null) {
  let query = supabase
    ?.from('expense_departments')
    ?.select('id, name, office_id, sort_order, is_active')
    ?.eq('is_active', true)
    ?.order('sort_order');

  if (officeId) query = query?.or(`office_id.eq.${officeId},office_id.is.null`);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ── FETCH VENDORS ─────────────────────────────────────────────────────────────
export async function fetchExpenseVendors() {
  const { data, error } = await supabase
    ?.from('expense_vendors')
    ?.select('id, vendor_name, default_category_id, default_department_name, is_active')
    ?.eq('is_active', true)
    ?.order('vendor_name');

  if (error) return [];
  return data || [];
}

// ── FETCH IMPORT BATCHES ──────────────────────────────────────────────────────
export async function fetchImportBatches({ sourceType = null, limit = 50 } = {}) {
  let query = supabase
    ?.from('expense_import_batches')
    ?.select('id, source_type, import_filename, statement_month, import_status, imported_at, total_rows, total_amount, duplicate_rows, rejected_rows, notes')
    ?.order('imported_at', { ascending: false })
    ?.limit(limit);

  if (sourceType) query = query?.eq('source_type', sourceType);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ── FETCH AMEX RAW TRANSACTIONS (for review) ──────────────────────────────────
export async function fetchAmexRawForReview({ batchId = null, needsReview = null } = {}) {
  let query = supabase
    ?.from('amex_raw_transactions')
    ?.select('id, import_batch_id, cardholder_name, card_last4, merchant_name, transaction_date, posted_date, amount, needs_review, review_reason, is_duplicate, normalized_expense_id')
    ?.order('transaction_date', { ascending: false })
    ?.limit(200);

  if (batchId) query = query?.eq('import_batch_id', batchId);
  if (needsReview !== null) query = query?.eq('needs_review', needsReview);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ── FETCH AMEX SYNC LOGS ──────────────────────────────────────────────────────
// Read bounded administrative audit pages without hiding records after the first page.
export async function fetchExpenseAuditPage(view, page = 0) {
  if (!['unmatched', 'sync_logs'].includes(view) || !Number.isSafeInteger(page) || page < 0) {
    throw new Error('Invalid expense audit page.');
  }
  const pageSize = view === 'unmatched' ? 100 : 20;
  const offset = page * pageSize;
  if (!Number.isSafeInteger(offset + pageSize)) throw new Error('Invalid expense audit page.');
  let query;
  if (view === 'unmatched') {
    query = supabase.from('expenses')
      .select('id, expense_date, amount, category_name, source_type, office_name, department_name, cardholder_name, merchant_name', { count: 'exact' })
      .or('office_id.is.null,department_id.is.null')
      .neq('expense_status', 'archived')
      .order('expense_date', { ascending: false });
  } else {
    query = supabase.from('amex_sync_logs')
      .select('id, sync_type, status, records_fetched, records_imported, duplicates_skipped, errors, started_at, completed_at', { count: 'exact' })
      .order('started_at', { ascending: false });
  }
  const { data, count, error } = await query.order('id', { ascending: true }).range(offset, offset + pageSize - 1);
  if (error || !Number.isSafeInteger(count) || count < 0 || !Array.isArray(data)) {
    throw new Error('Expense audit records could not be loaded. Please retry.');
  }
  const expected = Math.min(pageSize, Math.max(0, count - offset));
  const ids = new Set(data.map(row => row?.id));
  if (data.length !== expected || ids.size !== data.length || data.some(row => !row?.id)) {
    throw new Error('Expense audit page was incomplete. Please retry.');
  }
  return { data, count, page, pageSize };
}

export async function fetchAmexSyncLogs(limit = 20) {
  const { data, error } = await supabase
    ?.from('amex_sync_logs')
    ?.select('*')
    ?.order('started_at', { ascending: false })
    ?.limit(limit);

  if (error) return [];
  return data || [];
}

// ── FETCH UNMATCHED RECORDS (admin audit) ─────────────────────────────────────
export async function fetchUnmatchedExpenses() {
  const { data, error } = await supabase
    ?.from('expenses')
    ?.select('id, expense_date, amount, category_name, source_type, office_name, department_name, cardholder_name, merchant_name, notes')
    ?.or('office_id.is.null,department_id.is.null')
    ?.neq('expense_status', 'archived')
    ?.order('expense_date', { ascending: false })
    ?.limit(100);

  if (error) return [];
  return data || [];
}

// ── FETCH RECURRING TEMPLATES ─────────────────────────────────────────────────
export async function fetchRecurringTemplates() {
  const { data, error } = await supabase
    ?.from('recurring_expense_templates')
    ?.select('*')
    ?.eq('is_active', true)
    ?.order('name');

  if (error) return [];
  return data || [];
}

// ── CREATE RECURRING TEMPLATE ─────────────────────────────────────────────────
export async function createRecurringTemplate(template = {}) {
  const { data, error } = await supabase
    ?.from('recurring_expense_templates')
    ?.insert(template)
    ?.select('id')
    ?.single();

  if (error) return { success: false, error: error?.message };
  return { success: true, id: data?.id };
}

// ── EXPORT HELPERS ────────────────────────────────────────────────────────────
export function formatExpensesForCSV(rows = []) {
  const headers = [
    'Date', 'Posted Date', 'Statement Period', 'Office', 'Department',
    'Category', 'Subcategory', 'Vendor / Merchant', 'Cardholder', 'Card Last 4',
    'Source Type', 'Source Tab', 'Amount', 'Allocation Type', 'Status', 'Notes',
  ];

  const csvRows = rows?.map(r => [
    r?.expense_date || '',
    r?.posted_date || '',
    r?.statement_period_start ? `${r?.statement_period_start} – ${r?.statement_period_end}` : '',
    r?.office_name || '',
    r?.department_name || '',
    r?.category_name || '',
    r?.subcategory_name || '',
    r?.merchant_name || r?.vendor_name || '',
    r?.cardholder_name || '',
    r?.card_last4 || '',
    SOURCE_TYPE_LABELS?.[r?.source_type] || r?.source_type || '',
    r?.source_tab || '',
    parseFloat(r?.amount || 0)?.toFixed(2),
    r?.allocation_method || '',
    r?.expense_status || '',
    (r?.notes || '')?.replace(/,/g, ';'),
  ]);

  return [headers, ...csvRows]?.map(row => row?.join(','))?.join('\n');
}

export default {
  fetchExpenseRecords,
  fetchExpenseKPIs,
  fetchExpenseTotalForRange,
  fetchExpensesByOffice,
  fetchExpensesByCategory,
  fetchMonthlyExpenseTrend,
  fetchAmexTransactions,
  fetchAmexByCardholder,
  fetchAmexByMerchant,
  importAmexCSV,
  normalizeAmexBatch,
  createManualExpense,
  updateExpense,
  fetchExpenseCategories,
  fetchExpenseDepartments,
  fetchExpenseVendors,
  fetchImportBatches,
  fetchAmexRawForReview,
  fetchAmexSyncLogs,
  fetchUnmatchedExpenses,
  fetchRecurringTemplates,
  createRecurringTemplate,
  formatExpensesForCSV,
  buildDateRange,
  CANONICAL_OFFICES,
  EXPENSE_CATEGORY_GROUPS,
  SOURCE_TYPE_LABELS,
  CORPORATE_AMEX_CARD_LAST4S,
  classify3526Transaction,
  isWF3526AmexBillPayment,
  isWF3526GustoPayrollFunding,
  isWF3526InternalTransfer,
  isWF3526BenefitsPayment,
  isWF3526IncludedInCompanyExpense,
  isInternalFundingTransfer,
};
