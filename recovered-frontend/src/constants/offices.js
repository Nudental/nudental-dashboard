// ─── Office UUID → Name + Color Mapping ──────────────────────────────────────
// Single source of truth for all office display names and chart colors.
// Used across all pages to prevent raw UUIDs from appearing in the UI.

import {
  normalizeOfficeName,
  getCanonicalOfficeName,
  isValidOfficeName,
  areOfficeValuesEquivalent,
  CANONICAL_OFFICES,
} from '../utils/officeNormalizer';

export const OFFICE_MAP = {
  "220372a5-afae-49c9-8a0c-f4c0717ff352": { name: "Eatontown", color: "#00B5CC" },
  "b0abcc46-55e8-4529-a28f-eedf41c1d72e": { name: "Staten Island", color: "#6ECEB2" },
  "54626997-57c2-4934-8743-1dabb4d176f4": { name: "Brick", color: "#F59E0B" },
  "1c719b5b-fd77-4da8-a1b9-2209f1cea63e": { name: "Barnegat", color: "#EF4444" },
};

// ─── Office UUID → Dentrix Ascend locationId Mapping ─────────────────────────
// Maps internal Supabase office UUIDs to the Dentrix Ascend locationId values
// used as query parameters in all Ascend API calls.
export const LOCATION_ID_MAP = {
  "220372a5-afae-49c9-8a0c-f4c0717ff352": "14000000000433", // Eatontown
  "b0abcc46-55e8-4529-a28f-eedf41c1d72e": "14000000000432", // Staten Island
  "54626997-57c2-4934-8743-1dabb4d176f4": "14000000000435", // Brick
  "1c719b5b-fd77-4da8-a1b9-2209f1cea63e": "14000000000434", // Barnegat
};

/**
 * Returns the Dentrix Ascend locationId for a given Supabase office UUID.
 * Returns null if the office UUID is not found (e.g. "All Offices" selection).
 */
export function getLocationIdByOfficeId(officeId) {
  if (!officeId) return null;
  return LOCATION_ID_MAP?.[officeId] || null;
}

export const DEFAULT_OFFICE_META = {
  name: "Unknown Office",
  color: "#9CA3AF",
};

/**
 * Returns { name, color } for a given office UUID.
 * Falls back to DEFAULT_OFFICE_META if the ID is missing or unknown.
 */
export function getOfficeMetaById(officeId) {
  if (!officeId) return DEFAULT_OFFICE_META;
  return OFFICE_MAP?.[officeId] || DEFAULT_OFFICE_META;
}

/**
 * Returns the display name for a given office UUID.
 * Falls back to "Unknown Office" if not found.
 */
export function getOfficeNameById(officeId) {
  return getOfficeMetaById(officeId)?.name;
}

/**
 * Returns the chart color for a given office UUID.
 * Falls back to #9CA3AF if not found.
 */
export function getOfficeColorById(officeId) {
  return getOfficeMetaById(officeId)?.color;
}

/**
 * Resolves an office display name from either:
 * - A UUID (looked up in OFFICE_MAP)
 * - A plain string name (normalized via officeNormalizer)
 * - null/undefined (returns "Unknown Office")
 *
 * This handles the mixed case where some DB fields store UUIDs
 * and others store plain office names.
 */
export function resolveOfficeName(officeIdOrName) {
  if (!officeIdOrName) return DEFAULT_OFFICE_META?.name;
  // If it looks like a UUID, map it
  if (OFFICE_MAP?.[officeIdOrName]) return OFFICE_MAP?.[officeIdOrName]?.name;
  // Try canonical normalization first
  const canonical = normalizeOfficeName(officeIdOrName);
  if (canonical) return canonical;
  // Otherwise return as-is (already a name)
  return officeIdOrName;
}

// Re-export normalization utilities for convenience
export {
  normalizeOfficeName,
  getCanonicalOfficeName,
  isValidOfficeName,
  areOfficeValuesEquivalent,
  CANONICAL_OFFICES,
};

/**
 * Returns an ordered array of all offices for consistent rendering.
 */
export const OFFICE_LIST = Object.entries(OFFICE_MAP)?.map(([id, meta]) => ({
  id,
  name: meta.name,
  color: meta.color,
}));
