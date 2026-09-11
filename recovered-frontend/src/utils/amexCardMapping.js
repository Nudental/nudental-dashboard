/**
 * CENTRAL AMEX CARD MAPPING
 *
 * Official cardholder / card-to-office mapping for Nu Dental AmEx corporate cards.
 * This is the single source of truth for all AmEx office resolution in the Expense Report.
 *
 * MAPPING PRIORITY (enforced in resolveAmexCard and enrichAmexRow):
 *   1. If transaction has an employee card last4 → use it to determine office.
 *   2. If employee card last4 is missing → use cardholder + known card mapping when reliable.
 *   3. Only classify as Corporate / Shared when the ACTUAL card last4 is 1001, 1002, 1003,
 *      or 1077 AND no office-specific employee card last4 is available.
 *
 * IMPORTANT:
 *   - ...1002 is the corporate PARENT account. Employee cards may exist under ...1002.
 *     Do NOT classify a transaction as Corporate/Shared solely because it is associated
 *     with parent account ...1002 if the transaction also has an employee card last4.
 *   - ...1003 is a SEPARATE corporate card and always remains Corporate / Shared.
 *
 * Usage:
 *   import { resolveAmexCard, AMEX_CARD_MAP } from '../utils/amexCardMapping';
 *   const info = resolveAmexCard({ cardLast4: '2067', cardholderName: 'Kelly Mundorff' });
 *   // → { office: 'Barnegat', isCorporate: false, allocationStatus: 'mapped_to_office', accountRole: 'amex_card' }
 */

// ── OFFICIAL AMEX CARD MAP ────────────────────────────────────────────────────
// Key: card last 4 digits (string)
// Value: { cardholder, office, isCorporate }
//
// Corporate / Shared cards are NOT assigned to a specific dental office.
// They must be shown as "Corporate / Shared — Needs Allocation" and included
// in All Offices totals but NOT in any specific office total unless explicitly allocated.
export const AMEX_CARD_MAP = {
  // ── Corporate / Shared ────────────────────────────────────────────────────
  // 1002 = corporate PARENT account (not an employee card).
  // Only classify as Corporate/Shared if the ACTUAL transaction card last4 is 1002
  // and no employee card last4 is present.
  '1001': { cardholder: 'Admasu Gizachew',  office: 'Corporate / Shared', isCorporate: true },
  '1002': { cardholder: 'Admasu Gizachew',  office: 'Corporate / Shared', isCorporate: true },
  '1003': { cardholder: 'Admasu Gizachew',  office: 'Corporate / Shared', isCorporate: true },
  '1077': { cardholder: 'Allison Whalen',   office: 'Corporate / Shared', isCorporate: true },

  // ── Eatontown ─────────────────────────────────────────────────────────────
  '1085': { cardholder: 'Allison Whalen',   office: 'Eatontown', isCorporate: false },
  '1127': { cardholder: 'Ny Velez',         office: 'Eatontown', isCorporate: false },
  '1168': { cardholder: 'Maia Dolidze',     office: 'Eatontown', isCorporate: false },

  // ── Barnegat ──────────────────────────────────────────────────────────────
  '1093': { cardholder: 'Allison Whalen',   office: 'Barnegat', isCorporate: false },
  '1143': { cardholder: 'Ny Velez',         office: 'Barnegat', isCorporate: false },
  '1192': { cardholder: 'Maia Dolidze',     office: 'Barnegat', isCorporate: false },
  '2067': { cardholder: 'Kelly Mundorff',   office: 'Barnegat', isCorporate: false },

  // ── Brick ─────────────────────────────────────────────────────────────────
  '1101': { cardholder: 'Allison Whalen',   office: 'Brick', isCorporate: false },
  '1150': { cardholder: 'Ny Velez',         office: 'Brick', isCorporate: false },
  '1176': { cardholder: 'Maia Dolidze',     office: 'Brick', isCorporate: false },

  // ── Staten Island ─────────────────────────────────────────────────────────
  '1119': { cardholder: 'Allison Whalen',   office: 'Staten Island', isCorporate: false },
  '1135': { cardholder: 'Ny Velez',         office: 'Staten Island', isCorporate: false },
  '1184': { cardholder: 'Maia Dolidze',     office: 'Staten Island', isCorporate: false },
  '2059': { cardholder: 'Kelly Mundorff',   office: 'Staten Island', isCorporate: false },
};

/**
 * The set of card last4 values that are ALWAYS Corporate / Shared.
 * These are the only values that should trigger a Corporate/Shared classification.
 * 1002 is included here as the parent account, but ONLY when no employee card last4
 * is present on the transaction (enforced in enrichAmexRow).
 */
export const CORPORATE_CARD_LAST4S = new Set(['1001', '1002', '1003', '1077']);

/**
 * Normalize a card last4 string to exactly 4 digits.
 * Handles inputs like "...1085", "1085", "  1085 ".
 */
function normalizeCardLast4(raw) {
  if (!raw) return null;
  const digits = String(raw)?.replace(/\D/g, '')?.slice(-4);
  return digits?.length === 4 ? digits : null;
}

/**
 * resolveAmexCard
 *
 * Resolves office info for an AmEx card using the correct priority:
 *   1. cardLast4 (the actual transaction/employee card) is checked first.
 *   2. If cardLast4 resolves to a non-corporate office card → use it (employee card wins).
 *   3. If cardLast4 is a known corporate card (1001/1002/1003/1077) → Corporate/Shared.
 *   4. If cardLast4 is unknown → fall back to cardholder name lookup.
 *
 * NOTE: parentAccountLast4 (e.g. 1002) must NOT override a resolved employee card last4.
 * The caller (enrichAmexRow) is responsible for passing the employee card last4 as cardLast4,
 * not the parent account number.
 *
 * @param {string|null} cardLast4 - The ACTUAL transaction card last4 (employee card takes priority)
 * @param {string|null} cardholderName - Cardholder name (used as fallback when cardLast4 is unknown)
 * @returns {{
 *   office: string | null,
 *   isCorporate: boolean,
 *   allocationStatus: 'mapped_to_office' | 'needs_office_allocation' | 'unknown_amex_card',
 *   accountRole: 'amex_card',
 *   cardholder: string | null,
 *   cardLast4Normalized: string | null,
 *   isMapped: boolean,
 * } | null}
 */
export function resolveAmexCard(cardLast4, cardholderName = null) {
  const last4 = normalizeCardLast4(cardLast4);
  if (!last4) return null;

  const entry = AMEX_CARD_MAP?.[last4];

  if (!entry) {
    // Card last4 not in the official mapping — unknown AmEx card
    // Try cardholder name fallback for disambiguation
    return {
      office: null,
      isCorporate: false,
      allocationStatus: 'unknown_amex_card',
      accountRole: 'amex_card',
      cardholder: cardholderName || null,
      cardLast4Normalized: last4,
      isMapped: false,
    };
  }

  return {
    office: entry?.office,
    isCorporate: entry?.isCorporate,
    allocationStatus: entry?.isCorporate ? 'needs_office_allocation' : 'mapped_to_office',
    accountRole: 'amex_card',
    cardholder: entry?.cardholder,
    cardLast4Normalized: last4,
    isMapped: true,
  };
}

/**
 * resolveAmexOfficeName
 *
 * Convenience wrapper — returns the display office name for an AmEx card.
 * For corporate/shared cards, returns 'Corporate / Shared'.
 * For mapped office cards, returns the office name (Eatontown, Barnegat, Brick, Staten Island).
 * For unknown cards, returns null (caller should fall back to existing office_name).
 *
 * @param {string|null} cardLast4
 * @param {string|null} cardholderName
 * @returns {string | null}
 */
export function resolveAmexOfficeName(cardLast4, cardholderName = null) {
  const info = resolveAmexCard(cardLast4, cardholderName);
  if (!info) return null;
  if (!info?.isMapped) return null;
  return info?.office;
}

/**
 * isAmexSource
 * Returns true if the source_type indicates an AmEx transaction.
 */
export function isAmexSource(sourceType) {
  return sourceType === 'amex_api' || sourceType === 'amex_statement_import';
}

/**
 * enrichAmexRow
 *
 * Enriches a single expense row with AmEx card mapping data.
 * Implements the correct priority for card last4 resolution:
 *
 *   PRIORITY ORDER:
 *   1. card_last4 (employee/transaction card) — highest priority.
 *      If this resolves to a non-corporate office card, use it regardless of account_last4.
 *   2. account_last4 — used ONLY if card_last4 is absent or unresolvable.
 *      EXCEPTION: if account_last4 is 1002 (parent account) and card_last4 is a known
 *      employee card, the employee card wins. 1002 must NOT override an employee card.
 *   3. cardholder name fallback — used when both card_last4 and account_last4 are absent.
 *
 * Does not mutate the original row — returns a new object.
 *
 * @param {object} row - Expense row from Supabase
 * @returns {object} - Enriched row
 */
export function enrichAmexRow(row) {
  if (!isAmexSource(row?.source_type)) return row;

  const rawCardLast4    = row?.card_last4    || null;
  const rawAccountLast4 = row?.account_last4 || null;
  const cardholderName  = row?.cardholder_name || null;

  const normalizedCardLast4    = normalizeCardLast4(rawCardLast4);
  const normalizedAccountLast4 = normalizeCardLast4(rawAccountLast4);

  // ── PRIORITY 1: Resolve using card_last4 (employee/transaction card) ──────
  // If card_last4 is present and maps to a non-corporate office card, it wins.
  // This prevents parent account 1002 (in account_last4) from overriding an employee card.
  let resolvedInfo = null;

  if (normalizedCardLast4) {
    const cardInfo = resolveAmexCard(normalizedCardLast4, cardholderName);
    if (cardInfo?.isMapped && !cardInfo?.isCorporate) {
      // Employee card resolved to a specific office — use it (highest priority)
      resolvedInfo = cardInfo;
    } else if (cardInfo?.isMapped && cardInfo?.isCorporate) {
      // card_last4 itself is a known corporate card (1001/1002/1003/1077)
      // Only accept this as Corporate/Shared if account_last4 does NOT point to
      // an employee card that should take priority.
      // Check if account_last4 resolves to a non-corporate employee card.
      if (normalizedAccountLast4 && normalizedAccountLast4 !== normalizedCardLast4) {
        const accountInfo = resolveAmexCard(normalizedAccountLast4, cardholderName);
        if (accountInfo?.isMapped && !accountInfo?.isCorporate) {
          // account_last4 is an employee card — it takes priority over the corporate card_last4
          resolvedInfo = accountInfo;
        } else {
          resolvedInfo = cardInfo;
        }
      } else {
        resolvedInfo = cardInfo;
      }
    }
    // If cardInfo is not mapped (unknown card), fall through to priority 2
  }

  // ── PRIORITY 2: Fall back to account_last4 if card_last4 didn't resolve ──
  // EXCEPTION: Do NOT use account_last4 = 1002 as Corporate/Shared if we already
  // have a resolved employee card from card_last4.
  if (!resolvedInfo && normalizedAccountLast4) {
    // Skip if account_last4 is the parent account 1002 and card_last4 resolved to an employee card
    // (already handled above; this is a safety guard)
    const accountInfo = resolveAmexCard(normalizedAccountLast4, cardholderName);
    if (accountInfo?.isMapped) {
      resolvedInfo = accountInfo;
    }
  }

  // ── PRIORITY 3: Cardholder name fallback (no card last4 available) ────────
  // resolveAmexCard already accepts cardholderName for disambiguation,
  // but without a last4 we cannot look up the map. Leave resolvedInfo null
  // and let downstream consumers fall back to existing office_name.

  if (!resolvedInfo) {
    // No card last4 resolved — return row unchanged (no AmEx mapping applied)
    return row;
  }

  return {
    ...row,
    _amexInfo: resolvedInfo,
    _resolvedOffice: resolvedInfo?.office,
    _accountRole: resolvedInfo?.accountRole,
    _allocationStatus: resolvedInfo?.allocationStatus,
    // Override office_name for mapped cards so all downstream consumers see the correct office
    office_name: resolvedInfo?.isMapped
      ? resolvedInfo?.office
      : (row?.office_name || null),
  };
}

/**
 * enrichAmexRows
 * Enriches an array of expense rows with AmEx card mapping data.
 */
export function enrichAmexRows(rows = []) {
  return rows?.map(enrichAmexRow);
}

export default {
  AMEX_CARD_MAP,
  CORPORATE_CARD_LAST4S,
  resolveAmexCard,
  resolveAmexOfficeName,
  isAmexSource,
  enrichAmexRow,
  enrichAmexRows,
};
