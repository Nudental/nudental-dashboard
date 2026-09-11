/**
 * officeResolver.js
 *
 * Shared Office Resolution Utility — Single Source of Truth
 * ─────────────────────────────────────────────────────────────────────────────
 * This file now re-exports all normalization functions from the canonical
 * officeNormalizer module. All existing imports of normalizeOfficeName,
 * resolveProviderOffice, and resolveOfficeFromRow continue to work unchanged.
 *
 * NEW CODE should import directly from '../utils/officeNormalizer';
. * EXISTING CODE importing from'../utils/officeResolver' continues to work.
 *
 * Canonical offices:
 *   "Brick" | "Barnegat" | "Staten Island" | "Eatontown"
 */

// ─── Re-export canonical normalization functions ──────────────────────────────
export {
  normalizeOfficeName,
} from './officeNormalizer';

import { normalizeOfficeName, CANONICAL_OFFICES, getCanonicalOfficeName, isValidOfficeName, areOfficeValuesEquivalent, normalizeOfficeField, getOfficeDisplayName, normalizeOfficeArray, buildOfficeNormalizationReport, getUnmatchedOfficeDiagnostics, clearUnmatchedOfficeDiagnostics } from './officeNormalizer';

export {
  CANONICAL_OFFICES,
  getCanonicalOfficeName,
  isValidOfficeName,
  areOfficeValuesEquivalent,
  normalizeOfficeField,
  getOfficeDisplayName,
  normalizeOfficeArray,
  buildOfficeNormalizationReport,
  getUnmatchedOfficeDiagnostics,
  clearUnmatchedOfficeDiagnostics,
};

// ─── Provider Office Resolution ───────────────────────────────────────────────
// These functions use normalizeOfficeName internally and remain here because
// they depend on provider/staff/payroll record structures.

/**
 * resolveProviderOffice({ provider, location, staffRecord, payrollRecord })
 *
 * Resolves the correct canonical office using actual relational data already
 * present in the database. Uses normalizeOfficeName() on every candidate.
 *
 * Resolution priority:
 * 1. Explicit payroll-office mapping (payrollRecord.raw_payroll_office or .canonicalOffice)
 * 2. Provider's primary/default assigned office (provider_office_assignments, first active)
 * 3. Staff record office/location mapping (staffRecord.offices?.name or .office_id)
 * 4. Linked location record name/label (location.name)
 * 5. Normalized raw office text from any mapped source field
 * 6. null if all above fail
 *
 * @param {object} args
 * @param {object} [args.provider]      - provider_master or providers record
 * @param {object} [args.location]      - offices/location record
 * @param {object} [args.staffRecord]   - staff/providers record from Supabase
 * @param {object} [args.payrollRecord] - payroll_provider_mappings or enriched row
 * @returns {"Brick"|"Barnegat"|"Staten Island"|"Eatontown"|null}
 */
export function resolveProviderOffice({ provider, location, staffRecord, payrollRecord } = {}) {
  const DEV = typeof process !== 'undefined'
    ? process.env?.NODE_ENV === 'development'
    : (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

  const candidates = [];

  // ── Priority 1: Explicit payroll-office mapping ───────────────────────────
  if (payrollRecord) {
    const p1a = payrollRecord?.canonicalOffice;
    const p1b = payrollRecord?.raw_payroll_office || payrollRecord?.rawOffice;
    const p1c = payrollRecord?.officeName || payrollRecord?.office_name;
    if (p1a) candidates?.push({ value: p1a, source: 'payrollRecord.canonicalOffice' });
    if (p1b) candidates?.push({ value: p1b, source: 'payrollRecord.raw_payroll_office' });
    if (p1c) candidates?.push({ value: p1c, source: 'payrollRecord.officeName' });
  }

  // ── Priority 2: Provider's primary/default assigned office ────────────────
  if (provider) {
    const assignments = provider?.provider_office_assignments || [];
    const activeAssignment = assignments?.find(a => a?.is_active);
    if (activeAssignment) {
      const p2a = activeAssignment?.offices?.name;
      const p2b = activeAssignment?.office_name_raw;
      if (p2a) candidates?.push({ value: p2a, source: 'provider.provider_office_assignments[active].offices.name' });
      if (p2b) candidates?.push({ value: p2b, source: 'provider.provider_office_assignments[active].office_name_raw' });
    }
    for (const a of assignments) {
      if (!a?.is_active) continue;
      if (a?.offices?.name) candidates?.push({ value: a?.offices?.name, source: 'provider.provider_office_assignments[].offices.name' });
    }
    const p2c = provider?.offices?.name;
    const p2d = provider?.office_name || provider?.office_name_raw;
    const p2e = provider?.primary_office;
    if (p2c) candidates?.push({ value: p2c, source: 'provider.offices.name' });
    if (p2d) candidates?.push({ value: p2d, source: 'provider.office_name' });
    if (p2e) candidates?.push({ value: p2e, source: 'provider.primary_office' });
  }

  // ── Priority 3: Staff record office/location mapping ─────────────────────
  if (staffRecord) {
    const p3a = staffRecord?.offices?.name;
    const p3b = staffRecord?.office_name || staffRecord?.office_name_raw;
    const p3c = staffRecord?.location_name;
    if (p3a) candidates?.push({ value: p3a, source: 'staffRecord.offices.name' });
    if (p3b) candidates?.push({ value: p3b, source: 'staffRecord.office_name' });
    if (p3c) candidates?.push({ value: p3c, source: 'staffRecord.location_name' });
  }

  // ── Priority 4: Linked location record ───────────────────────────────────
  if (location) {
    const p4a = location?.name;
    const p4b = location?.display_name || location?.label;
    if (p4a) candidates?.push({ value: p4a, source: 'location.name' });
    if (p4b) candidates?.push({ value: p4b, source: 'location.display_name' });
  }

  // ── Priority 5: Normalize each candidate in order ────────────────────────
  let resolved = null;
  let resolvedSource = null;
  const debugLog = [];

  for (const { value, source } of candidates) {
    const normalized = normalizeOfficeName(value);
    debugLog?.push({ value, source, normalized });
    if (normalized && !resolved) {
      resolved = normalized;
      resolvedSource = source;
    }
  }

  // ── Dev-mode debug logging ────────────────────────────────────────────────
  if (DEV) {
    const providerName =
      provider?.display_name ||
      staffRecord?.name ||
      payrollRecord?.displayName ||
      payrollRecord?.providerName ||
      '(unknown)';
    const providerId =
      provider?.id ||
      staffRecord?.id ||
      payrollRecord?.providerId ||
      '(unknown)';

    if (!resolved) {
      console.warn(
        '[officeResolver] UNRESOLVED office for provider:',
        { providerId, providerName, candidates: debugLog }
      );
    } else if (debugLog?.length > 0) {
      console.debug(
        '[officeResolver] Resolved office for provider:',
        { providerId, providerName, resolved, resolvedSource, candidates: debugLog }
      );
    }
  }

  return resolved;
}

/**
 * resolveOfficeFromRow(row)
 *
 * Convenience wrapper: resolves office from a single enriched payroll row
 * using all available fields on that row.
 *
 * @param {object} row - enriched payroll row
 * @returns {"Brick"|"Barnegat"|"Staten Island"|"Eatontown"|null}
 */
export function resolveOfficeFromRow(row) {
  if (!row) return null;

  // Try direct canonical office first (already resolved upstream)
  const direct = normalizeOfficeName(row?.canonicalOffice);
  if (direct) return direct;

  // Try all raw office fields on the row
  const candidates = [
    row?.officeName,
    row?.office_name,
    row?.rawOffice,
    row?.raw_payroll_office,
    row?.location_name,
    row?.locationName,
    row?.practice_location,
    row?.practiceLocation,
    row?.provider_office,
  ];

  for (const c of candidates) {
    const n = normalizeOfficeName(c);
    if (n) return n;
  }

  return null;
}
