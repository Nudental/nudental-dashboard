/**
 * officeNormalizer.js
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * CENTRALIZED OFFICE NORMALIZATION — SINGLE SOURCE OF TRUTH
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the ONLY place where office/location/practice_location
 * aliases are resolved to canonical office names.
 *
 * Canonical offices (the ONLY valid display values):
 *   "Brick" | "Barnegat" | "Staten Island" | "Eatontown"
 *
 * All of the following field names represent the SAME business dimension:
 *   office, location, office_location, practice_location, location_name,
 *   provider_office, officeName, locationName, practiceLocation, office_name
 *
 * Usage:
 *   import { normalizeOfficeName, getCanonicalOfficeName,
 *            isValidOfficeName, areOfficeValuesEquivalent }
 *     from '../utils/officeNormalizer';
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * NORMALIZATION RULES
 * ══════════════════════════════════════════════════════════════════════════════
 * 1. Trim whitespace
 * 2. Collapse repeated spaces
 * 3. Ignore case
 * 4. Normalize punctuation inconsistencies
 * 5. Accept both long ("Nu Dental of Brick") and short ("Brick") names
 * 6. Map all aliases to canonical values
 * 7. Handle all field name variants consistently
 * 8. Never return "Unknown Office" for a valid alias
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── Canonical Office Names ───────────────────────────────────────────────────

/**
 * The four canonical office names. These are the ONLY values that may appear
 * in the UI, charts, tables, exports, filters, and analytics.
 */
export const CANONICAL_OFFICES = ['Brick', 'Barnegat', 'Staten Island', 'Eatontown'];

// ─── Alias Map ────────────────────────────────────────────────────────────────

/**
 * Complete alias → canonical mapping.
 * Keys are lowercase, trimmed, whitespace-collapsed.
 * This is the ONLY place aliases are defined — never in component code.
 *
 * To add a new alias: add it here. Nowhere else.
 */
const OFFICE_ALIAS_MAP = {
  // ── Brick ──────────────────────────────────────────────────────────────────
  'brick':                    'Brick',
  'nu dental of brick':       'Brick',
  'nudental of brick':        'Brick',
  'nu dental brick':          'Brick',
  'nudental brick':           'Brick',
  'brick nj':                 'Brick',
  'brick new jersey':         'Brick',
  'brick, nj':                'Brick',
  'brick, new jersey':        'Brick',

  // ── Barnegat ───────────────────────────────────────────────────────────────
  'barnegat':                 'Barnegat',
  'nu dental of barnegat':    'Barnegat',
  'nudental of barnegat':     'Barnegat',
  'nu dental barnegat':       'Barnegat',
  'nudental barnegat':        'Barnegat',
  'barnegat nj':              'Barnegat',
  'barnegat new jersey':      'Barnegat',
  'barnegat, nj':             'Barnegat',
  'barnegat, new jersey':     'Barnegat',

  // ── Staten Island ──────────────────────────────────────────────────────────
  'staten island':            'Staten Island',
  'nu dental of staten island': 'Staten Island',
  'nudental of staten island':  'Staten Island',
  'nu dental staten island':    'Staten Island',
  'nudental staten island':     'Staten Island',
  'staten island ny':           'Staten Island',
  'staten island new york':     'Staten Island',
  'staten island, ny':          'Staten Island',
  'staten island, new york':    'Staten Island',
  'si':                         'Staten Island',

  // ── Eatontown ──────────────────────────────────────────────────────────────
  'eatontown':                'Eatontown',
  'nu dental of eatontown':   'Eatontown',
  'nudental of eatontown':    'Eatontown',
  'nu dental eatontown':      'Eatontown',
  'nudental eatontown':       'Eatontown',
  'eatontown nj':             'Eatontown',
  'eatontown new jersey':     'Eatontown',
  'eatontown, nj':            'Eatontown',
  'eatontown, new jersey':    'Eatontown',
};

/**
 * UUID → canonical office name map.
 * Mirrors src/constants/offices.js OFFICE_MAP.
 */
const OFFICE_UUID_MAP = {
  '220372a5-afae-49c9-8a0c-f4c0717ff352': 'Eatontown',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': 'Staten Island',
  '54626997-57c2-4934-8743-1dabb4d176f4': 'Brick',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': 'Barnegat',
};

/**
 * Non-office fallback strings that must never resolve to a canonical office.
 */
const INVALID_OFFICE_STRINGS = new Set([
  'unknown office', 'unknown', 'n/a', 'none', 'null', 'undefined',
  'unassigned', 'corporate', 'needs review', 'all offices', 'all',
  '', ' ',
]);

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a raw string for alias lookup:
 * - trim whitespace
 * - lowercase
 * - collapse internal whitespace
 * - strip leading/trailing non-alphanumeric characters
 */
function _normalizeRaw(raw) {
  if (!raw) return '';
  return raw?.trim()?.toLowerCase()?.replace(/\s+/g, ' ')?.replace(/^[^a-z0-9]+|[^a-z0-9\s]+$/g, '')?.trim();
}

// ─── Diagnostic / Audit Log ───────────────────────────────────────────────────

/**
 * Unmatched office diagnostic log.
 * Collects records that failed normalization for admin review.
 * Access via getUnmatchedOfficeDiagnostics().
 */
const _unmatchedLog = [];

/**
 * Log an unmatched office value for diagnostics.
 * @param {object} info
 */
function _logUnmatched({ rawValue, source, sourcePage, normalizedIntermediate, failReason }) {
  const entry = {
    rawValue,
    source: source || 'unknown',
    sourcePage: sourcePage || 'unknown',
    normalizedIntermediate: normalizedIntermediate || '',
    failReason: failReason || 'no_alias_match',
    timestamp: new Date()?.toISOString(),
  };
  _unmatchedLog?.push(entry);
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[officeNormalizer] UNMATCHED office value:', entry);
  }
}

/**
 * Returns all unmatched office diagnostic entries collected since page load.
 * Use this in admin audit tools to identify bad data sources.
 * @returns {Array}
 */
export function getUnmatchedOfficeDiagnostics() {
  return [..._unmatchedLog];
}

/**
 * Clears the unmatched office diagnostic log.
 */
export function clearUnmatchedOfficeDiagnostics() {
  _unmatchedLog.length = 0;
}

// ─── Core Public API ──────────────────────────────────────────────────────────

/**
 * normalizeOfficeName(rawValue)
 *
 * Takes any raw office/location value and returns the canonical office name,
 * or null when the value cannot be matched.
 *
 * Normalization steps:
 * 1. Null/undefined/empty → null
 * 2. UUID lookup (fast path)
 * 3. Reject known non-office fallback strings
 * 4. Exact alias match (case-insensitive, whitespace-normalized)
 * 5. Partial containment match (longest alias wins)
 * 6. Direct canonical name match
 * 7. null — never returns "Unknown Office"
 *
 * @param {string|null|undefined} rawValue
 * @param {{ source?: string, sourcePage?: string }} [diagnosticContext]
 * @returns {"Brick"|"Barnegat"|"Staten Island"|"Eatontown"|null}
 *
 * @example
 * normalizeOfficeName(" Nu Dental of Brick ")   // => "Brick"
 * normalizeOfficeName("brick")                  // => "Brick"
 * normalizeOfficeName("STATEN ISLAND")          // => "Staten Island"
 * normalizeOfficeName("Nu Dental of Eatontown") // => "Eatontown"
 * normalizeOfficeName("")                       // => null
 * normalizeOfficeName(null)                     // => null
 * normalizeOfficeName("Unknown Office")         // => null
 */
export function normalizeOfficeName(rawValue, diagnosticContext = {}) {
  // Step 1: null/undefined/non-string
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue !== 'string') return null;

  const trimmed = rawValue?.trim();
  if (!trimmed) return null;

  // Step 2: UUID lookup (fast path — avoids string normalization overhead)
  if (OFFICE_UUID_MAP?.[trimmed]) {
    return OFFICE_UUID_MAP?.[trimmed];
  }

  // Step 3: Reject known non-office strings
  const lowerTrimmed = trimmed?.toLowerCase();
  if (INVALID_OFFICE_STRINGS?.has(lowerTrimmed)) {
    return null;
  }

  // Step 4: Normalize for alias lookup
  const normalized = _normalizeRaw(trimmed);
  if (!normalized) return null;

  // Step 4a: Exact alias match
  if (OFFICE_ALIAS_MAP?.[normalized]) {
    return OFFICE_ALIAS_MAP?.[normalized];
  }

  // Step 4b: Partial containment — longest alias match wins
  // (prevents "si" from matching before "staten island")
  let bestMatch = null;
  let bestLen = 0;
  for (const [alias, canonical] of Object.entries(OFFICE_ALIAS_MAP)) {
    if (normalized?.includes(alias) && alias?.length > bestLen) {
      bestMatch = canonical;
      bestLen = alias?.length;
    }
  }
  if (bestMatch) return bestMatch;

  // Step 5: Direct canonical name match (case-insensitive)
  for (const canonical of CANONICAL_OFFICES) {
    if (canonical?.toLowerCase() === normalized) return canonical;
  }

  // Step 6: No match — log for diagnostics
  _logUnmatched({
    rawValue,
    normalizedIntermediate: normalized,
    failReason: 'no_alias_match',
    ...diagnosticContext,
  });

  return null;
}

/**
 * getCanonicalOfficeName(rawValue)
 *
 * Alias for normalizeOfficeName. Returns the canonical office name or null.
 * Provided for semantic clarity in contexts where "canonical" is the intent.
 *
 * @param {string|null|undefined} rawValue
 * @returns {"Brick"|"Barnegat"|"Staten Island"|"Eatontown"|null}
 */
export function getCanonicalOfficeName(rawValue) {
  return normalizeOfficeName(rawValue);
}

/**
 * isValidOfficeName(rawValue)
 *
 * Returns true if rawValue resolves to a known canonical office name.
 * Returns false for null, empty, unknown, or unmatched values.
 *
 * @param {string|null|undefined} rawValue
 * @returns {boolean}
 *
 * @example
 * isValidOfficeName("Brick")                  // => true
 * isValidOfficeName("Nu Dental of Barnegat")  // => true
 * isValidOfficeName("Unknown Office")         // => false
 * isValidOfficeName(null)                     // => false
 */
export function isValidOfficeName(rawValue) {
  return normalizeOfficeName(rawValue) !== null;
}

/**
 * areOfficeValuesEquivalent(a, b)
 *
 * Returns true if two office values (in any format) resolve to the same
 * canonical office. This is the ONLY correct way to compare office values
 * across different data sources.
 *
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 *
 * @example
 * areOfficeValuesEquivalent("Brick", "Nu Dental of Brick")  // => true
 * areOfficeValuesEquivalent("brick", "BRICK")               // => true
 * areOfficeValuesEquivalent("Brick", "Barnegat")            // => false
 * areOfficeValuesEquivalent(null, "Brick")                  // => false
 */
export function areOfficeValuesEquivalent(a, b) {
  const canonA = normalizeOfficeName(a);
  const canonB = normalizeOfficeName(b);
  if (canonA === null || canonB === null) return false;
  return canonA === canonB;
}

/**
 * normalizeOfficeField(row, fieldNames)
 *
 * Normalizes an office value from a data row by trying multiple field names
 * in priority order. Returns the first canonical match found, or null.
 *
 * This handles the case where different data sources use different field names
 * for the same business dimension (office/location/practice_location/etc.).
 *
 * @param {object} row - data row from any source
 * @param {string[]} [fieldNames] - field names to try in priority order
 * @returns {"Brick"|"Barnegat"|"Staten Island"|"Eatontown"|null}
 *
 * @example
 * normalizeOfficeField(row, ['office_name', 'location_name', 'practice_location'])
 */
export function normalizeOfficeField(row, fieldNames = [
  'canonicalOffice',
  'office_name',
  'officeName',
  'location',
  'location_name',
  'locationName',
  'office_location',
  'practice_location',
  'practiceLocation',
  'provider_office',
]) {
  if (!row) return null;
  for (const field of fieldNames) {
    const val = row?.[field];
    if (val) {
      const canonical = normalizeOfficeName(val);
      if (canonical) return canonical;
    }
  }
  return null;
}

/**
 * getOfficeDisplayName(rawValue)
 *
 * Returns the canonical display name for UI rendering.
 * Falls back to "Unknown Office" only after normalization has failed.
 *
 * Use this for ALL UI display of office names.
 *
 * @param {string|null|undefined} rawValue
 * @returns {string} canonical name or "Unknown Office"
 */
export function getOfficeDisplayName(rawValue) {
  return normalizeOfficeName(rawValue) || 'Unknown Office';
}

/**
 * normalizeOfficeArray(values)
 *
 * Normalizes an array of raw office values, deduplicating by canonical name.
 * Useful for filter dropdowns and group-by operations.
 *
 * @param {Array<string|null|undefined>} values
 * @returns {string[]} unique canonical office names
 */
export function normalizeOfficeArray(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const v of values) {
    const canonical = normalizeOfficeName(v);
    if (canonical && !seen?.has(canonical)) {
      seen?.add(canonical);
      result?.push(canonical);
    }
  }
  return result;
}

/**
 * buildOfficeNormalizationReport()
 *
 * Returns a diagnostic report of all unmatched office values collected
 * since page load. Use in admin audit panels to identify bad data sources.
 *
 * @returns {{ unmatchedCount: number, entries: Array, uniqueRawValues: string[] }}
 */
export function buildOfficeNormalizationReport() {
  const entries = getUnmatchedOfficeDiagnostics();
  const uniqueRawValues = [...new Set(entries.map(e => e.rawValue))];
  return {
    unmatchedCount: entries?.length,
    uniqueRawValues,
    entries,
  };
}
function directly(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: directly is not implemented yet.', args);
  return null;
}

export default directly;