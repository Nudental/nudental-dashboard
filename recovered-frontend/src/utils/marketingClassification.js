/**
 * marketingClassification.js
 * Stage 5B-B: Marketing spend classification rules for MarketingTab.
 *
 * Data source: existing `expenses` table populated by server-side Plaid/AmEx sync
 * (plaid_sync.py on DigitalOcean backend) and AmEx statement imports.
 *
 * Rules:
 *   A. TNT Dental — include posted office AmEx charges where merchant_name/description
 *      contains "TNT DENTAL", "TNT-DENTAL", or "TNTDENTAL".
 *   B. Google — include ALL posted Google charges on office AmEx cards regardless of category.
 *      Category is audit metadata only.
 *
 * Exclusions:
 *   - AmEx payments / transfers / statement payments / statement credits
 *   - Pending / draft / unposted transactions
 *   - Corporate/shared cards (1001, 1002, 1003, 1077)
 *   - Unmapped cards (card_last4 not in AMEX_CARD_MAP)
 *   - Missing amount (null) — never converted to 0
 *   - Refunds/credits (amount < 0) — handled as negative adjustment, not silently ignored
 */

import { AMEX_CARD_MAP, CORPORATE_CARD_LAST4S } from './amexCardMapping';

// ── Normalize a string for matching ──────────────────────────────────────────
const norm = (s) => (s ? String(s)?.toUpperCase()?.trim() : '');

// ── TNT Dental patterns ───────────────────────────────────────────────────────
const TNT_PATTERNS = ['TNT DENTAL', 'TNT-DENTAL', 'TNTDENTAL'];

// ── Google patterns ───────────────────────────────────────────────────────────
// Any merchant_name/description containing "GOOGLE" qualifies.
// Category is NOT required.
const GOOGLE_KEYWORD = 'GOOGLE';

// ── AmEx payment / transfer exclusion patterns ────────────────────────────────
const AMEX_PAYMENT_PATTERNS = [
  'AMERICAN EXPRESS',
  'AMEX PAYMENT',
  'AUTOPAY',
  'ONLINE PAYMENT',
  'STATEMENT PAYMENT',
  'STATEMENT CREDIT',
  'PAYMENT - THANK YOU',
  'PAYMENT THANK YOU',
];

/**
 * Normalize card last4 to 4-digit string.
 */
function normalizeCardLast4(raw) {
  if (!raw) return null;
  const digits = String(raw)?.replace(/\D/g, '')?.slice(-4);
  return digits?.length === 4 ? digits : null;
}

/**
 * Returns true if the card is a known office AmEx card (not corporate/shared).
 */
export function isOfficeAmexCard(cardLast4) {
  const last4 = normalizeCardLast4(cardLast4);
  if (!last4) return false;
  if (CORPORATE_CARD_LAST4S?.has(last4)) return false;
  return last4 in AMEX_CARD_MAP;
}

/**
 * Returns true if the merchant/description looks like an AmEx payment or transfer.
 * These must always be excluded from marketing spend.
 */
export function isAmexPaymentOrTransfer(row) {
  const merchant = norm(row?.merchant_name);
  const desc = norm(row?.vendor_name ?? row?.description);
  const combined = `${merchant} ${desc}`;
  return AMEX_PAYMENT_PATTERNS?.some((p) => combined?.includes(p));
}

/**
 * Returns true if the row matches TNT Dental marketing spend rules:
 *   - merchant_name or vendor_name contains TNT DENTAL / TNT-DENTAL / TNTDENTAL
 *   - office AmEx card (not corporate)
 *   - posted (expense_status = 'posted')
 *   - amount > 0 (charge, not refund/credit)
 *   - source_type is amex_api or amex_statement_import
 */
export function isTNTDentalSpend(row) {
  const merchant = norm(row?.merchant_name);
  const desc = norm(row?.vendor_name ?? row?.description);
  const combined = `${merchant} ${desc}`;

  const matchesTNT = TNT_PATTERNS?.some((p) => combined?.includes(p));
  if (!matchesTNT) return false;

  return isPostedOfficeAmexCharge(row);
}

/**
 * Returns true if the row matches Google marketing spend rules:
 *   - merchant_name or vendor_name contains "GOOGLE"
 *   - office AmEx card (not corporate)
 *   - posted
 *   - amount > 0
 *   - source_type is amex_api or amex_statement_import
 *
 * NOTE: Plaid category is NOT required. Category is audit metadata only.
 */
export function isGoogleSpend(row) {
  const merchant = norm(row?.merchant_name);
  const desc = norm(row?.vendor_name ?? row?.description);
  const combined = `${merchant} ${desc}`;

  if (!combined?.includes(GOOGLE_KEYWORD)) return false;

  return isPostedOfficeAmexCharge(row);
}

/**
 * Returns true if the row is a posted, positive-amount office AmEx charge
 * from an approved source type.
 */
function isPostedOfficeAmexCharge(row) {
  // Must be posted
  const status = norm(row?.expense_status);
  if (status !== 'POSTED') return false;

  // Must be AmEx source — accept source_tab='amex', source_type amex_api/amex_statement_import,
  // or payment_source='amex'. This ensures rows are not excluded due to how plaid_sync.py
  // wrote the source fields.
  const sourceType = row?.source_type;
  const sourceTab  = norm(row?.source_tab);
  const paymentSrc = norm(row?.payment_source);
  const isAmex =
    sourceType === 'amex_api' ||
    sourceType === 'amex_statement_import' ||
    sourceTab === 'AMEX' ||
    paymentSrc === 'AMEX';
  if (!isAmex) return false;

  // Must be office AmEx card (not corporate/shared)
  const cardLast4 = normalizeCardLast4(row?.card_last4);
  if (!isOfficeAmexCard(cardLast4)) return false;

  // Must not be an AmEx payment/transfer
  if (isAmexPaymentOrTransfer(row)) return false;

  // Amount must be present and > 0 (charge, not refund/credit)
  const amt = row?.amount;
  if (amt === null || amt === undefined) return false;
  const n = parseFloat(amt);
  if (!isFinite(n) || n <= 0) return false;

  return true;
}

/**
 * Returns true if the row is a posted negative-amount (refund/credit) on an office AmEx card
 * for a TNT Dental or Google merchant. These are negative marketing adjustments.
 */
export function isMarketingCreditAdjustment(row) {
  const status = norm(row?.expense_status);
  if (status !== 'POSTED') return false;

  const sourceType = row?.source_type;
  const sourceTab  = norm(row?.source_tab);
  const paymentSrc = norm(row?.payment_source);
  const isAmex =
    sourceType === 'amex_api' ||
    sourceType === 'amex_statement_import' ||
    sourceTab === 'AMEX' ||
    paymentSrc === 'AMEX';
  if (!isAmex) return false;

  const cardLast4 = normalizeCardLast4(row?.card_last4);
  if (!isOfficeAmexCard(cardLast4)) return false;

  if (isAmexPaymentOrTransfer(row)) return false;

  const amt = row?.amount;
  if (amt === null || amt === undefined) return false;
  const n = parseFloat(amt);
  if (!isFinite(n) || n >= 0) return false;

  // Only flag as marketing credit if it matches TNT or Google
  const merchant = norm(row?.merchant_name);
  const desc = norm(row?.vendor_name ?? row?.description);
  const combined = `${merchant} ${desc}`;
  const isTNT = TNT_PATTERNS?.some((p) => combined?.includes(p));
  const isGoogle = combined?.includes(GOOGLE_KEYWORD);

  return isTNT || isGoogle;
}

/**
 * isMarketingAdSpend
 * Returns true if the row should be included in finalized marketing spend totals.
 * Includes positive TNT Dental and Google charges on office AmEx cards.
 */
export function isMarketingAdSpend(row) {
  return isTNTDentalSpend(row) || isGoogleSpend(row);
}

/**
 * isMarketingReviewCandidate
 * Returns true if the row should be placed in the review bucket
 * (likely marketing but not auto-classified).
 * These are NOT included in finalized totals.
 */
export function isMarketingReviewCandidate(row) {
  // Already classified — not a review candidate
  if (isMarketingAdSpend(row)) return false;
  if (isMarketingCreditAdjustment(row)) return false;

  const merchant = norm(row?.merchant_name);
  const desc = norm(row?.vendor_name ?? row?.description);
  const combined = `${merchant} ${desc}`;
  const categoryName = norm(row?.category_name);

  // TNT-like spelling mismatch
  if (combined?.includes('TNT') && !TNT_PATTERNS?.some((p) => combined?.includes(p))) return true;

  // Advertising/marketing category but unknown merchant
  if (
    (categoryName?.includes('ADVERTIS') || categoryName?.includes('MARKETING')) &&
    !combined?.includes(GOOGLE_KEYWORD) &&
    !TNT_PATTERNS?.some((p) => combined?.includes(p))
  ) return true;

  // Missing card-office mapping
  const cardLast4 = normalizeCardLast4(row?.card_last4);
  if (cardLast4 && !(cardLast4 in AMEX_CARD_MAP)) return true;

  // Google credit/refund (negative amount on Google merchant)
  if (combined?.includes(GOOGLE_KEYWORD)) {
    const amt = row?.amount;
    if (amt !== null && amt !== undefined) {
      const n = parseFloat(amt);
      if (isFinite(n) && n < 0) return true;
    }
  }

  return false;
}

/**
 * getOfficeFromRow
 * Returns the resolved office name for a row using AMEX_CARD_MAP.
 * Falls back to row.office_name if card_last4 is not in the map.
 */
export function getOfficeFromRow(row) {
  const cardLast4 = normalizeCardLast4(row?.card_last4);
  if (cardLast4 && AMEX_CARD_MAP?.[cardLast4]) {
    return AMEX_CARD_MAP?.[cardLast4]?.office;
  }
  return row?.office_name || null;
}
