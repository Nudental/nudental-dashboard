/**
 * providerMappingService.js
 *
 * Provider Identity & Payroll Mapping Layer — v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Permanent fix for provider mapping failures.
 *
 * Key improvements over v1:
 * - Placeholder detection (NU Dental Provider, Provider NU Dental)
 * - temp_hygienist type support
 * - Dedup by raw_payroll_name (not normalized_name)
 * - Failure reason logging for every failed mapping
 * - Confidence-based flow: high → auto-map, medium → suggest, low → unresolved
 * - Persistent alias storage: once mapped, never re-appears as unmapped
 * - Multi-office resolution: never rejects valid rows for non-primary office
 * - Raw data preservation: raw_provider_name / raw_office_name never overwritten
 */

import { supabase } from '../lib/supabase';
import { normalizeOfficeName, resolveOfficeFromRow } from '../utils/officeResolver';

// ─── PLACEHOLDER DETECTION ────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  'nu dental provider',
  'provider nu dental',
  'provider, nu dental',
  'nu dental, provider',
  'nudental provider',
  'provider nudental',
  'nu dental',
  'nudental',
  // Generic non-person import labels
  'doctor payroll',
  'hygienist payroll',
  'unknown office',
  'unknown provider',
  'temp hygiene',
  'hygiene temp',
];

/**
 * Default non-provider labels that are ALWAYS treated as resolved/silent.
 * These never trigger the active banner regardless of DB state.
 * Normalized (trimmed, lowercase, collapsed whitespace, no punctuation).
 */
export const DEFAULT_NON_PROVIDER_LABELS = new Set([
  'nu dental provider',
  'nudental provider',
  'provider nu dental',
  'provider nudental',
  'nu dental',
  'nudental',
  'doctor payroll',
  'hygienist payroll',
  'unknown office',
  'unknown provider',
  'temp hygiene',
  'hygiene temp',
  'total',
  'totals',
  'subtotal',
  'subtotals',
  'section header',
  'import label',
  'generic provider',
  'provider placeholder',
]);

/**
 * Normalize a raw label for persistent rule matching:
 * - trim
 * - lowercase
 * - collapse whitespace
 * - remove punctuation
 */
export function normalizeLabel(label) {
  if (!label) return '';
  return label
    ?.trim()
    ?.toLowerCase()
    ?.replace(/[^a-z0-9 ]/g, '')
    ?.replace(/\s+/g, ' ')
    ?.trim();
}

/**
 * Returns true if the name is a known placeholder import label.
 * Placeholder rows are NOT valid final provider identities.
 * Checks both static patterns and dynamic non-provider rules.
 */
export function isPlaceholderName(name) {
  if (!name) return false;
  let n = normalizeLabel(name);
  // Default non-provider set check
  if (DEFAULT_NON_PROVIDER_LABELS?.has(n)) return true;
  // Static pattern check (prefix match)
  if (PLACEHOLDER_PATTERNS?.some(p => n === p || n?.startsWith(p + ' '))) return true;
  // Additional heuristics: all-caps section headers, blank-ish names, pure numbers
  if (/^\d+$/?.test(n)) return true; // pure numeric
  if (n?.length < 3) return true;   // too short to be a real name
  return false;
}

/**
 * Super Admin: permanently mark a raw import label as a non-provider.
 * Creates a persistent rule so the same label never re-triggers the warning.
 * Uses normalized label matching so variations of the same label all resolve.
 * @param {string} rawPayrollName - the exact raw import label to mark
 * @param {string} [reason] - optional admin note
 */
export async function markAsNonProvider(rawPayrollName, reason) {
  if (!rawPayrollName) throw new Error('rawPayrollName is required');

  let userId = null;
  try {
    const { data } = await supabase?.auth?.getUser();
    userId = data?.user?.id || null;
  } catch (_) {}

  const normalizedLabel = normalizeLabel(rawPayrollName);

  // 1. Update ALL payroll_provider_mappings records matching this normalized label
  //    This ensures all variations (with/without office suffix) are resolved together
  const { data: existingRows } = await supabase
    ?.from('payroll_provider_mappings')
    ?.select('id, raw_payroll_name')
    ?.eq('normalized_name', normalizedLabel);

  const payload = {
    mapping_status: 'placeholder',
    is_placeholder: true,
    is_ignored: true,
    needs_review: false,
    ignored_by: userId,
    ignored_at: new Date()?.toISOString(),
    review_notes: reason || 'Marked as non-provider by Super Admin',
    reviewed_by: userId,
    reviewed_at: new Date()?.toISOString(),
    failure_reason: 'placeholder_provider_label',
    confidence: 0,
    provider_master_id: null,
  };

  let result = null;

  if (existingRows?.length > 0) {
    // Update all matching rows by normalized label
    const ids = existingRows?.map(r => r?.id);
    const { data, error } = await supabase
      ?.from('payroll_provider_mappings')
      ?.update(payload)
      ?.in('id', ids)
      ?.select();
    if (error) throw error;
    result = data?.[0];
  } else {
    // Insert a new persistent rule record
    const { data, error } = await supabase
      ?.from('payroll_provider_mappings')
      ?.insert({ ...payload, raw_payroll_name: rawPayrollName, normalized_name: normalizedLabel })
      ?.select()
      ?.single();
    if (error && error?.code !== '23505') throw error;
    result = data;
  }

  // Also insert a rule for the exact raw name if not already covered
  const { data: exactRow } = await supabase
    ?.from('payroll_provider_mappings')
    ?.select('id')
    ?.eq('raw_payroll_name', rawPayrollName)
    ?.maybeSingle();

  if (!exactRow) {
    await supabase
      ?.from('payroll_provider_mappings')
      ?.insert({ ...payload, raw_payroll_name: rawPayrollName, normalized_name: normalizedLabel })
      ?.select()
      ?.single()
      ?.catch(() => {}); // ignore duplicate
  }

  // 2. Audit log — fire and forget
  supabase?.from('provider_mapping_audit')?.insert({
    action: 'MARK_AS_NON_PROVIDER',
    old_values: { raw_payroll_name: rawPayrollName, normalized_label: normalizedLabel },
    new_values: payload,
    performed_by: userId,
    notes: reason || 'Marked as non-provider by Super Admin',
  })?.catch(() => {});

  return result;
}

// ─── TYPE CLASSIFICATION ──────────────────────────────────────────────────────

const DOCTOR_KEYWORDS = [
  'doctor', 'dentist', 'dds', 'dmd', 'oral surgeon', 'oral_surgeon',
  'orthodontist', 'periodontist', 'endodontist', 'prosthodontist',
  'pediatric dentist', 'pediatric_dentist', 'general dentist', 'general_dentist',
  'specialist',
];

const HYGIENIST_KEYWORDS = [
  'hygienist', 'rdh', 'dental hygienist', 'dental_hygienist',
  'hygiene', 'temp hygiene', 'temp_hygiene',
];

const TEMP_HYGIENIST_KEYWORDS = [
  'temp hygiene', 'temp_hygiene', 'temp hygienist', 'temp_hygienist',
  'hygiene temp', 'hygienist temp',
];

/**
 * Classify a provider type string.
 * Returns: 'doctor' | 'hygienist' | 'temp_hygienist' | 'unknown'
 * Does NOT silently guess — returns 'unknown' for unsupported types.
 */
export function classifyProviderType(typeStr) {
  if (!typeStr) return 'unknown';
  const t = typeStr?.toLowerCase()?.trim();
  if (TEMP_HYGIENIST_KEYWORDS?.some(k => t?.includes(k))) return 'temp_hygienist';
  if (DOCTOR_KEYWORDS?.some(k => t?.includes(k))) return 'doctor';
  if (HYGIENIST_KEYWORDS?.some(k => t?.includes(k))) return 'hygienist';
  return 'unknown';
}

/**
 * Normalize a canonical type for payroll classification.
 * temp_hygienist → 'hygienist' for payroll section assignment.
 * Returns the payroll bucket type.
 */
export function payrollBucketType(canonicalType) {
  if (canonicalType === 'temp_hygienist') return 'hygienist';
  return canonicalType; // 'doctor' | 'hygienist' | 'unknown'
}

// ─── NAME NORMALIZATION ───────────────────────────────────────────────────────

/**
 * Normalize a provider name for matching:
 * - Trim whitespace
 * - Lowercase
 * - Remove "Dr." / "Dr " prefix
 * - Remove punctuation
 * - Normalize "Last, First" → "first last"
 */
export function normalizeName(name) {
  if (!name) return '';
  let n = name?.trim()?.toLowerCase();

  // Remove "dr." or "dr " prefix
  n = n?.replace(/^dr\.?\s+/i, '');

  // Handle "Last, First" → "First Last"
  const commaIdx = n?.indexOf(',');
  if (commaIdx > 0) {
    const last = n?.slice(0, commaIdx)?.trim();
    const first = n?.slice(commaIdx + 1)?.trim();
    n = `${first} ${last}`;
  }

  // Remove non-alphanumeric except spaces
  n = n?.replace(/[^a-z0-9 ]/g, '')?.replace(/\s+/g, ' ')?.trim();
  return n;
}

/**
 * Compute token-overlap similarity score (0–1) between two normalized names.
 */
export function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));
  const intersection = [...tokensA]?.filter(t => tokensB?.has(t))?.length;
  const union = new Set([...tokensA, ...tokensB])?.size;
  return union === 0 ? 0 : intersection / union;
}

// ─── PROVIDER MASTER CRUD ─────────────────────────────────────────────────────

/**
 * Fetch all provider_master records with their office assignments.
 */
export async function getAllProviderMasters() {
  const { data, error } = await supabase?.from('provider_master')?.select(`
      *,
      providers:staff_id ( id, name, provider_type, office_id, offices(name) ),
      provider_office_assignments (
        id, office_id, office_name_raw, is_active, effective_from, effective_to,
        offices:office_id ( id, name )
      ),
      provider_aliases ( id, alias_name, normalized_alias, source )
    `)?.order('display_name');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single provider_master by id.
 */
export async function getProviderMasterById(id) {
  const { data, error } = await supabase?.from('provider_master')?.select(`
      *,
      providers:staff_id ( id, name, provider_type, office_id, offices(name) ),
      provider_office_assignments (
        id, office_id, office_name_raw, is_active,
        offices:office_id ( id, name )
      ),
      provider_aliases ( id, alias_name, normalized_alias, source )
    `)?.eq('id', id)?.single();

  if (error) throw error;
  return data;
}

// ─── PAYROLL PROVIDER MAPPINGS CRUD ──────────────────────────────────────────

/**
 * Fetch all payroll_provider_mappings with their linked provider_master.
 * Used by the Super Admin review tool.
 */
export async function getAllPayrollMappings() {
  const { data, error } = await supabase?.from('payroll_provider_mappings')?.select(`
      *,
      provider_master (
        id, display_name, provider_type, is_active,
        provider_office_assignments (
          office_id, office_name_raw, is_active,
          offices:office_id ( id, name )
        )
      )
    `)?.order('mapping_status')?.order('raw_payroll_name');

  if (error) throw error;
  return data || [];
}

/**
 * Fetch only mappings that need review.
 */
export async function getPendingMappings() {
  const { data, error } = await supabase?.from('payroll_provider_mappings')?.select(`
      *,
      provider_master (
        id, display_name, provider_type,
        provider_office_assignments (
          office_id, office_name_raw, is_active,
          offices:office_id ( id, name )
        )
      )
    `)?.in('mapping_status', ['needs_review', 'unknown_type', 'unknown_office', 'pending', 'placeholder'])?.eq('is_ignored', false)?.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Super Admin: manually resolve a mapping.
 * Updates provider_master_id, normalized_type, mapping_status, and logs audit.
 */
export async function resolveMapping(mappingId, {
  providerMasterId,
  normalizedType,
  reviewNotes,
}) {
  // Safely get current user — don't throw if auth is unavailable
  let userId = null;
  try {
    const { data } = await supabase?.auth?.getUser();
    userId = data?.user?.id || null;
  } catch (_) {}

  // Fetch old values for audit
  const { data: old } = await supabase?.from('payroll_provider_mappings')?.select('*')?.eq('id', mappingId)?.single();

  const effectiveStatus = providerMasterId
    ? (normalizedType === 'unknown' ? 'unknown_type' : 'mapped')
    : (normalizedType ? 'mapped' : 'needs_review');

  const updates = {
    provider_master_id: providerMasterId || null,
    normalized_type: normalizedType || null,
    mapping_status: effectiveStatus,
    needs_review: effectiveStatus !== 'mapped',
    review_notes: reviewNotes || null,
    reviewed_by: userId,
    reviewed_at: new Date()?.toISOString(),
    failure_reason: effectiveStatus === 'mapped' ? null : old?.failure_reason,
    confidence: providerMasterId ? 100 : (normalizedType ? 50 : 0),
  };

  const { data, error } = await supabase?.from('payroll_provider_mappings')?.update(updates)?.eq('id', mappingId)?.select()?.single();

  if (error) throw error;

  // Audit log — fire and forget
  supabase?.from('provider_mapping_audit')?.insert({
    mapping_id: mappingId,
    action: 'RESOLVE_MAPPING',
    old_values: old,
    new_values: data,
    performed_by: userId,
    notes: reviewNotes || null,
  })?.catch(() => {});

  return data;
}

/**
 * Super Admin: ignore a mapping (exclude from review queue).
 */
export async function ignoreMapping(mappingId, reason) {
  let userId = null;
  try {
    const { data } = await supabase?.auth?.getUser();
    userId = data?.user?.id || null;
  } catch (_) {}

  const { data, error } = await supabase?.from('payroll_provider_mappings')?.update({
      is_ignored: true,
      ignored_by: userId,
      ignored_at: new Date()?.toISOString(),
      review_notes: reason || 'Ignored by admin',
      mapping_status: 'ignored',
    })?.eq('id', mappingId)?.select()?.single();

  if (error) throw error;
  return data;
}

/**
 * Super Admin: bulk ignore multiple mappings.
 */
export async function bulkIgnoreMappings(mappingIds, reason) {
  let userId = null;
  try {
    const { data } = await supabase?.auth?.getUser();
    userId = data?.user?.id || null;
  } catch (_) {}

  const { data, error } = await supabase?.from('payroll_provider_mappings')?.update({
      is_ignored: true,
      ignored_by: userId,
      ignored_at: new Date()?.toISOString(),
      review_notes: reason || 'Bulk ignored by admin',
      mapping_status: 'ignored',
    })?.in('id', mappingIds)?.select();

  if (error) throw error;
  return data || [];
}

/**
 * Super Admin: bulk resolve multiple mappings to the same provider.
 */
export async function bulkResolveMappings(mappingIds, { providerMasterId, normalizedType, reviewNotes }) {
  const results = await Promise.allSettled(
    mappingIds?.map(id => resolveMapping(id, { providerMasterId, normalizedType, reviewNotes }))
  );
  return {
    succeeded: results?.filter(r => r?.status === 'fulfilled')?.map(r => r?.value),
    failed: results?.filter(r => r?.status === 'rejected')?.map(r => r?.reason?.message),
  };
}

/**
 * Super Admin: add an alias to a provider_master record.
 */
export async function addProviderAlias(providerMasterId, aliasName, source = 'manual') {
  const normalized = normalizeName(aliasName);
  const { data, error } = await supabase?.from('provider_aliases')?.insert({
      provider_master_id: providerMasterId,
      alias_name: aliasName?.trim(),
      normalized_alias: normalized,
      source,
    })?.select()?.single();

  if (error) {
    // Ignore duplicate alias errors
    if (error?.code === '23505') return null;
    throw error;
  }
  return data;
}

/**
 * Super Admin: update a provider_master's type.
 */
export async function updateProviderMasterType(providerMasterId, providerType) {
  let userId = null;
  try {
    const { data } = await supabase?.auth?.getUser();
    userId = data?.user?.id || null;
  } catch (_) {}

  const { data: old } = await supabase?.from('provider_master')?.select('*')?.eq('id', providerMasterId)?.single();

  const { data, error } = await supabase?.from('provider_master')?.update({ provider_type: providerType })?.eq('id', providerMasterId)?.select()?.single();

  if (error) throw error;

  supabase?.from('provider_mapping_audit')?.insert({
    action: 'UPDATE_PROVIDER_TYPE',
    old_values: old,
    new_values: data,
    performed_by: userId,
  })?.catch(() => {});

  return data;
}

// ─── OFFICE RESOLUTION ────────────────────────────────────────────────────────

/**
 * Resolve the canonical office name for a provider using the shared officeResolver utility.
 * This replaces all inline office-matching logic with a single shared path.
 *
 * Priority:
 * 1. Match raw office against provider_office_assignments (relational)
 * 2. Provider primary/default active assignment
 * 3. Raw office normalized via normalizeOfficeName
 * 4. null — never returns "Unknown Office"
 */
function resolveOfficeFromMaster(providerMaster, rawOffice) {
  if (!providerMaster) {
    // No master record — normalize raw office directly
    return normalizeOfficeName(rawOffice) || null;
  }

  const assignments = providerMaster?.provider_office_assignments || [];

  // Try to match raw office against assignments using normalizeOfficeName
  if (rawOffice) {
    const normalizedRaw = normalizeOfficeName(rawOffice);

    if (normalizedRaw) {
      // Look for an assignment whose canonical name matches
      const match = assignments?.find(a => {
        if (!a?.is_active) return false;
        const assignmentCanonical =
          normalizeOfficeName(a?.offices?.name) ||
          normalizeOfficeName(a?.office_name_raw);
        return assignmentCanonical === normalizedRaw;
      });
      if (match) {
        return normalizeOfficeName(match?.offices?.name) ||
               normalizeOfficeName(match?.office_name_raw) ||
               normalizedRaw;
      }
      // Provider works in this office even if not in primary assignments (multi-office support)
      return normalizedRaw;
    }

    // rawOffice exists but didn't normalize — still try assignment partial match
    const rawLower = rawOffice?.toLowerCase()?.trim();
    const partialMatch = assignments?.find(a =>
      a?.is_active &&
      (
        a?.offices?.name?.toLowerCase()?.trim() === rawLower ||
        a?.office_name_raw?.toLowerCase()?.trim() === rawLower ||
        a?.offices?.name?.toLowerCase()?.includes(rawLower) ||
        rawLower?.includes(a?.offices?.name?.toLowerCase()?.trim() || '')
      )
    );
    if (partialMatch) {
      return normalizeOfficeName(partialMatch?.offices?.name) ||
             normalizeOfficeName(partialMatch?.office_name_raw) ||
             null;
    }
  }

  // No raw office — use first active assignment
  const active = assignments?.find(a => a?.is_active);
  if (active) {
    return normalizeOfficeName(active?.offices?.name) ||
           normalizeOfficeName(active?.office_name_raw) ||
           null;
  }

  return null;
}

// ─── CORE MAPPING ENGINE ──────────────────────────────────────────────────────

/**
 * Determine the failure reason for an unresolved mapping.
 */
function getFailureReason(rawName, rawOffice, rawType, normalizedRaw, providerMasters) {
  if (!rawName || rawName?.trim() === '') return 'no_provider_name';
  if (isPlaceholderName(rawName)) return 'placeholder_provider_label';

  const hasAnyMatch = providerMasters?.some(pm => {
    const score = nameSimilarity(normalizedRaw, pm?.normalized_name);
    return score > 0.3;
  });

  if (!hasAnyMatch) return 'no_provider_name_match';
  if (!rawOffice) return 'missing_source_office';
  if (!rawType) return 'missing_provider_type';
  return 'ambiguous_office_assignment';
}

/**
 * Resolve a raw payroll provider row to a canonical provider_master record.
 *
 * Matching priority:
 * 1. Existing payroll_provider_mappings record (already resolved by raw_payroll_name)
 * 2. Exact normalized name match in provider_master
 * 3. Alias match in provider_aliases
 * 4. Fuzzy name similarity ≥ 0.75 (high confidence → auto-map)
 * 5. Fuzzy name similarity 0.5–0.74 (medium confidence → suggest in review)
 * 6. Placeholder detection → placeholder queue
 * 7. Unresolved → needs_review with failure reason
 */
export function resolveProviderMapping(rawRow, providerMasters, existingMappings) {
  const rawName = rawRow?.provider_name || rawRow?.providerName || rawRow?.name || '';
  const rawOffice = rawRow?.office_name || rawRow?.officeName || '';
  const rawType = rawRow?.provider_type || rawRow?.type || '';

  const normalizedRaw = normalizeName(rawName);

  // ── Placeholder detection (before any matching) ───────────────────────────
  if (isPlaceholderName(rawName)) {
    return {
      providerMasterId: null,
      displayName: rawName,
      canonicalType: 'unknown',
      canonicalOffice: rawOffice || null,
      mappingStatus: 'placeholder',
      confidence: 0,
      mappingId: null,
      rawName,
      rawOffice,
      failureReason: 'placeholder_provider_label',
      isPlaceholder: true,
    };
  }

  // ── Priority 1: Existing mapping record (dedup by raw_payroll_name) ────────
  const existingMapping = existingMappings?.find(m =>
    m?.raw_payroll_name === rawName && m?.mapping_status === 'mapped'
  );
  if (existingMapping?.provider_master) {
    return {
      providerMasterId: existingMapping?.provider_master_id,
      displayName: existingMapping?.provider_master?.display_name || rawName,
      canonicalType: existingMapping?.normalized_type || existingMapping?.provider_master?.provider_type || 'unknown',
      canonicalOffice: resolveOfficeFromMaster(existingMapping?.provider_master, rawOffice) || rawOffice || null,
      mappingStatus: 'mapped',
      confidence: existingMapping?.confidence || 100,
      mappingId: existingMapping?.id,
      rawName,
      rawOffice,
      failureReason: null,
      isPlaceholder: false,
    };
  }

  // Also check by normalized name for existing mapped records
  const existingByNorm = existingMappings?.find(m =>
    m?.normalized_name === normalizedRaw && m?.mapping_status === 'mapped'
  );
  if (existingByNorm?.provider_master) {
    return {
      providerMasterId: existingByNorm?.provider_master_id,
      displayName: existingByNorm?.provider_master?.display_name || rawName,
      canonicalType: existingByNorm?.normalized_type || existingByNorm?.provider_master?.provider_type || 'unknown',
      canonicalOffice: resolveOfficeFromMaster(existingByNorm?.provider_master, rawOffice) || rawOffice || null,
      mappingStatus: 'mapped',
      confidence: existingByNorm?.confidence || 100,
      mappingId: existingByNorm?.id,
      rawName,
      rawOffice,
      failureReason: null,
      isPlaceholder: false,
    };
  }

  // ── Priority 2: Exact normalized name match in provider_master ────────────
  const exactMatch = providerMasters?.find(pm =>
    pm?.normalized_name === normalizedRaw && pm?.is_active
  );
  if (exactMatch) {
    const canonicalType = exactMatch?.provider_type !== 'unknown'
      ? exactMatch?.provider_type
      : classifyProviderType(rawType);
    return {
      providerMasterId: exactMatch?.id,
      displayName: exactMatch?.display_name,
      canonicalType,
      canonicalOffice: resolveOfficeFromMaster(exactMatch, rawOffice) || rawOffice || null,
      mappingStatus: canonicalType === 'unknown' ? 'unknown_type' : 'mapped',
      confidence: 100,
      mappingId: null,
      rawName,
      rawOffice,
      failureReason: canonicalType === 'unknown' ? 'missing_provider_type' : null,
      isPlaceholder: false,
    };
  }

  // ── Priority 3: Alias match ───────────────────────────────────────────────
  for (const pm of (providerMasters || [])) {
    if (!pm?.is_active) continue;
    const aliasMatch = (pm?.provider_aliases || [])?.find(a =>
      a?.normalized_alias === normalizedRaw
    );
    if (aliasMatch) {
      const canonicalType = pm?.provider_type !== 'unknown'
        ? pm?.provider_type
        : classifyProviderType(rawType);
      return {
        providerMasterId: pm?.id,
        displayName: pm?.display_name,
        canonicalType,
        canonicalOffice: resolveOfficeFromMaster(pm, rawOffice) || rawOffice || null,
        mappingStatus: canonicalType === 'unknown' ? 'unknown_type' : 'mapped',
        confidence: 95,
        mappingId: null,
        rawName,
        rawOffice,
        failureReason: canonicalType === 'unknown' ? 'missing_provider_type' : null,
        isPlaceholder: false,
      };
    }
  }

  // ── Priority 4 & 5: Fuzzy name similarity ────────────────────────────────
  let bestMatch = null;
  let bestScore = 0;
  for (const pm of (providerMasters || [])) {
    if (!pm?.is_active) continue;
    const score = nameSimilarity(normalizedRaw, pm?.normalized_name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pm;
    }
    // Also check aliases for fuzzy
    for (const alias of (pm?.provider_aliases || [])) {
      const aliasScore = nameSimilarity(normalizedRaw, alias?.normalized_alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        bestMatch = pm;
      }
    }
  }

  if (bestMatch && bestScore >= 0.75) {
    // High confidence → auto-map
    const canonicalType = bestMatch?.provider_type !== 'unknown'
      ? bestMatch?.provider_type
      : classifyProviderType(rawType);
    return {
      providerMasterId: bestMatch?.id,
      displayName: bestMatch?.display_name,
      canonicalType,
      canonicalOffice: resolveOfficeFromMaster(bestMatch, rawOffice) || rawOffice || null,
      mappingStatus: canonicalType === 'unknown' ? 'unknown_type' : 'mapped',
      confidence: Math.round(bestScore * 100),
      mappingId: null,
      rawName,
      rawOffice,
      failureReason: canonicalType === 'unknown' ? 'missing_provider_type' : null,
      isPlaceholder: false,
    };
  }

  if (bestMatch && bestScore >= 0.5) {
    // Medium confidence → suggest in review queue (do NOT auto-map)
    const canonicalType = bestMatch?.provider_type !== 'unknown'
      ? bestMatch?.provider_type
      : classifyProviderType(rawType);
    return {
      providerMasterId: null, // Don't auto-assign — send to review
      displayName: rawName,
      canonicalType: canonicalType !== 'unknown' ? canonicalType : classifyProviderType(rawType),
      canonicalOffice: rawOffice || null,
      mappingStatus: 'needs_review',
      confidence: Math.round(bestScore * 100),
      mappingId: null,
      rawName,
      rawOffice,
      suggestedMasterId: bestMatch?.id,
      suggestedMasterName: bestMatch?.display_name,
      failureReason: 'ambiguous_office_assignment',
      isPlaceholder: false,
    };
  }

  // ── Priority 6: Unresolved → needs_review with failure reason ────────────
  const fallbackType = classifyProviderType(rawType);
  const failureReason = getFailureReason(rawName, rawOffice, rawType, normalizedRaw, providerMasters || []);

  return {
    providerMasterId: null,
    displayName: rawName,
    canonicalType: fallbackType,
    canonicalOffice: rawOffice || null,
    mappingStatus: 'needs_review',
    confidence: 0,
    mappingId: null,
    rawName,
    rawOffice,
    failureReason,
    isPlaceholder: false,
  };
}

// ─── BATCH MAPPING WITH UPSERT ────────────────────────────────────────────────

/**
 * Upsert a payroll_provider_mappings record.
 * Dedup key: raw_payroll_name (exact string from import).
 * Never overwrites a Super Admin-reviewed mapping.
 */
export async function upsertPayrollMapping(resolvedRow) {
  const {
    rawName, rawOffice, providerMasterId,
    canonicalType, mappingStatus, confidence,
    failureReason, isPlaceholder,
  } = resolvedRow;

  if (!rawName) return null;

  // Check if a manually-reviewed mapping already exists — never overwrite
  const { data: existing } = await supabase?.from('payroll_provider_mappings')?.select('id, mapping_status, reviewed_at')?.eq('raw_payroll_name', rawName)?.maybeSingle();

  if (existing?.reviewed_at) {
    // Super Admin already reviewed — do not overwrite
    return existing;
  }

  const normalizedName = normalizeName(rawName);

  const payload = {
    raw_payroll_name: rawName,
    raw_payroll_office: rawOffice || null,
    normalized_name: normalizedName,
    normalized_type: canonicalType && canonicalType !== 'temp_hygienist' ? canonicalType : (canonicalType === 'temp_hygienist' ? 'temp_hygienist' : null),
    provider_master_id: providerMasterId || null,
    mapping_status: mappingStatus || 'pending',
    confidence: confidence || 0,
    needs_review: mappingStatus !== 'mapped',
    failure_reason: failureReason || null,
    is_placeholder: isPlaceholder || false,
  };

  if (existing) {
    // Only update if status changed or provider resolved
    if (existing?.mapping_status === mappingStatus && !providerMasterId) return existing;
    const { data, error } = await supabase?.from('payroll_provider_mappings')?.update(payload)?.eq('id', existing?.id)?.select()?.single();
    if (error) console.error('[providerMappingService] upsert error:', error?.message);
    return data;
  } else {
    const { data, error } = await supabase?.from('payroll_provider_mappings')?.insert(payload)?.select()?.single();
    if (error && error?.code !== '23505') {
      console.error('[providerMappingService] insert error:', error?.message);
    }
    return data;
  }
}

// ─── ENRICHMENT HELPER ────────────────────────────────────────────────────────

/**
 * Enrich an array of raw payroll rows with canonical identity.
 *
 * Returns enriched rows with:
 * - displayName (canonical from provider_master, or raw fallback)
 * - canonicalOffice (canonical from office assignments, or raw fallback — never "Unknown Office" if raw exists)
 * - canonicalType ('doctor' | 'hygienist' | 'temp_hygienist' | 'unknown')
 * - payrollBucket ('doctor' | 'hygienist' | 'unknown') — for payroll section assignment
 * - mappingStatus ('mapped' | 'needs_review' | 'unknown_type' | 'unknown_office' | 'placeholder')
 * - confidence (0–100)
 * - failureReason (string | null)
 * - rawName / rawOffice preserved for audit
 * - alreadyResolved (true if placeholder was previously marked non-provider by admin or is a default label)
 */
export async function enrichPayrollRows(rawRows) {
  if (!rawRows?.length) return [];

  try {
    const [mastersResult, mappingsResult] = await Promise.allSettled([
      getAllProviderMasters(),
      getAllPayrollMappings(),
    ]);

    const providerMasters = mastersResult?.status === 'fulfilled' ? mastersResult?.value : [];
    const existingMappings = mappingsResult?.status === 'fulfilled' ? mappingsResult?.value : [];

    // Build a fast lookup: normalized_name → mapping record (for resolved non-provider check)
    const resolvedNonProviderByNorm = new Map();
    const resolvedNonProviderByRaw = new Map();
    for (const m of existingMappings) {
      if (m?.is_ignored || m?.is_placeholder || m?.mapping_status === 'placeholder' || m?.mapping_status === 'ignored') {
        if (m?.normalized_name) resolvedNonProviderByNorm?.set(m?.normalized_name, m);
        if (m?.raw_payroll_name) resolvedNonProviderByRaw?.set(m?.raw_payroll_name, m);
      }
    }

    const enriched = rawRows?.map(row => {
      const resolved = resolveProviderMapping(row, providerMasters, existingMappings);
      const bucket = payrollBucketType(resolved?.canonicalType);

      // ── Office resolution via shared utility ──────────────────────────────
      // Use resolveOfficeFromRow which tries all available fields through normalizeOfficeName.
      // This is the SINGLE path for office resolution — no inline fallbacks.
      // Only falls back to null (never to "Unknown Office") when truly unresolvable.
      const finalOffice = resolveOfficeFromRow({
        canonicalOffice: resolved?.canonicalOffice,
        officeName: row?.officeName,
        office_name: row?.office_name,
        rawOffice: resolved?.rawOffice || row?.officeName || row?.office_name,
        raw_payroll_office: row?.raw_payroll_office,
        location_name: row?.location_name,
      });

      // ── Determine if this placeholder has already been resolved by admin ──
      let alreadyResolved = false;
      if (resolved?.isPlaceholder || resolved?.mappingStatus === 'placeholder') {
        const rawName = resolved?.rawName || '';
        const normLabel = normalizeLabel(rawName);
        // Check default labels — exact match OR prefix match (handles "Temp Hygiene - Unknown Office" etc.)
        if (DEFAULT_NON_PROVIDER_LABELS?.has(normLabel)) {
          alreadyResolved = true;
        }
        if (!alreadyResolved) {
          for (const defaultLabel of DEFAULT_NON_PROVIDER_LABELS) {
            if (normLabel === defaultLabel || normLabel?.startsWith(defaultLabel + ' ')) {
              alreadyResolved = true;
              break;
            }
          }
        }
        // Check DB resolved records by raw name
        if (!alreadyResolved && resolvedNonProviderByRaw?.has(rawName)) {
          alreadyResolved = true;
        }
        // Check DB resolved records by normalized name
        if (!alreadyResolved && resolvedNonProviderByNorm?.has(normLabel)) {
          alreadyResolved = true;
        }
        // Check if the existing mapping for this row is already ignored/placeholder
        const existingForRow = existingMappings?.find(m =>
          m?.raw_payroll_name === rawName ||
          m?.normalized_name === normLabel
        );
        if (!alreadyResolved && existingForRow && (existingForRow?.is_ignored || existingForRow?.is_placeholder || existingForRow?.mapping_status === 'placeholder' || existingForRow?.mapping_status === 'ignored')) {
          alreadyResolved = true;
        }
      }

      return {
        ...row,
        displayName: resolved?.displayName || row?.providerName || row?.name || 'Unknown Provider',
        canonicalOffice: finalOffice,
        canonicalType: resolved?.canonicalType || 'unknown',
        payrollBucket: bucket,
        mappingStatus: resolved?.mappingStatus,
        confidence: resolved?.confidence,
        providerMasterId: resolved?.providerMasterId,
        mappingId: resolved?.mappingId,
        failureReason: resolved?.failureReason,
        isPlaceholder: resolved?.isPlaceholder || false,
        alreadyResolved,
        suggestedMasterId: resolved?.suggestedMasterId || null,
        suggestedMasterName: resolved?.suggestedMasterName || null,
        rawName: resolved?.rawName,
        rawOffice: resolved?.rawOffice,
      };
    });

    // Async: upsert mapping records for unresolved rows (fire-and-forget)
    const needsUpsert = enriched?.filter(r => r?.mappingStatus !== 'mapped' && r?.rawName);
    if (needsUpsert?.length > 0) {
      Promise.allSettled(needsUpsert?.map(r => upsertPayrollMapping(r)))?.catch(() => {});
    }

    return enriched;
  } catch (err) {
    console.error('[providerMappingService] enrichPayrollRows error:', err?.message);
    // Graceful degradation: return raw rows with fallback fields
    return rawRows?.map(row => ({
      ...row,
      displayName: row?.providerName || row?.name || 'Unknown Provider',
      canonicalOffice: normalizeOfficeName(row?.officeName) || normalizeOfficeName(row?.office_name) || null,
      canonicalType: 'unknown',
      payrollBucket: 'unknown',
      mappingStatus: 'needs_review',
      confidence: 0,
      providerMasterId: null,
      mappingId: null,
      failureReason: 'enrichment_error',
      isPlaceholder: false,
      alreadyResolved: false,
      rawName: row?.providerName || row?.name || '',
      rawOffice: row?.officeName || row?.office_name || '',
    }));
  }
}

/**
 * Classify enriched rows into doctor / hygienist / unknown / placeholder buckets.
 * - temp_hygienist rows go into hygienists bucket (correct payroll section)
 * - placeholder rows are isolated — never included in payroll totals
 * - unknown type rows are NOT silently placed in either bucket
 * - placeholders are further split into activePlaceholders (need admin action) and
 *   resolvedPlaceholders (already marked non-provider — diagnostics only, no banner)
 */
export function classifyEnrichedRows(enrichedRows) {
  const doctors = [];
  const hygienists = [];
  const unknowns = [];
  const placeholders = [];          // active: need admin action → banner
  const resolvedPlaceholders = [];  // resolved: diagnostics only → no banner

  for (const row of (enrichedRows || [])) {
    if (row?.isPlaceholder || row?.mappingStatus === 'placeholder') {
      if (row?.alreadyResolved) {
        resolvedPlaceholders?.push(row);
      } else {
        placeholders?.push(row);
      }
      continue;
    }

    const bucket = row?.payrollBucket || payrollBucketType(row?.canonicalType);

    if (bucket === 'doctor') {
      doctors?.push(row);
    } else if (bucket === 'hygienist') {
      hygienists?.push(row);
    } else {
      unknowns?.push({
        ...row,
        mappingStatus: row?.mappingStatus === 'mapped' ? 'unknown_type' : row?.mappingStatus,
      });
    }
  }

  return { doctors, hygienists, unknowns, placeholders, resolvedPlaceholders };
}

// ─── IMPORT DIAGNOSTICS ───────────────────────────────────────────────────────

/**
 * Build import diagnostics from enriched rows.
 */
export function buildImportDiagnostics(enrichedRows) {
  const total = enrichedRows?.length || 0;
  const autoMapped = enrichedRows?.filter(r => r?.mappingStatus === 'mapped' && !r?.mappingId)?.length || 0;
  const manuallyMapped = enrichedRows?.filter(r => r?.mappingStatus === 'mapped' && r?.mappingId)?.length || 0;
  const unresolved = enrichedRows?.filter(r => ['needs_review', 'unknown_type', 'unknown_office']?.includes(r?.mappingStatus))?.length || 0;
  const ignored = enrichedRows?.filter(r => r?.mappingStatus === 'ignored')?.length || 0;
  const placeholders = enrichedRows?.filter(r => r?.isPlaceholder || r?.mappingStatus === 'placeholder')?.length || 0;
  const includedInTotals = enrichedRows?.filter(r => r?.mappingStatus === 'mapped')?.length || 0;

  const failureReasons = {};
  enrichedRows?.filter(r => r?.failureReason)?.forEach(r => {
    failureReasons[r.failureReason] = (failureReasons?.[r?.failureReason] || 0) + 1;
  });

  return {
    total,
    autoMapped,
    manuallyMapped,
    unresolved,
    ignored,
    placeholders,
    includedInTotals,
    excludedFromTotals: total - includedInTotals,
    failureReasons,
  };
}

// ─── MAPPING STATS ────────────────────────────────────────────────────────────

export async function getMappingStats() {
  try {
    const { data, error } = await supabase?.from('payroll_provider_mappings')?.select('mapping_status, is_placeholder, is_ignored');

    if (error) throw error;

    const stats = {
      mapped: 0, needs_review: 0, unknown_type: 0, unknown_office: 0,
      pending: 0, ignored: 0, placeholder: 0, total: 0,
      // real_unresolved: count of genuine provider mapping issues (excludes placeholders/ignored)
      real_unresolved: 0,
    };
    const REAL_UNRESOLVED_STATUSES = ['needs_review', 'unknown_type', 'unknown_office', 'pending'];
    (data || [])?.forEach(r => {
      const key = r?.mapping_status;
      stats[key] = (stats?.[key] || 0) + 1;
      stats.total++;
      // Only count as real unresolved if NOT a placeholder and NOT ignored
      if (
        REAL_UNRESOLVED_STATUSES?.includes(key) &&
        !r?.is_placeholder &&
        key !== 'placeholder' &&
        key !== 'ignored' &&
        !r?.is_ignored
      ) {
        stats.real_unresolved++;
      }
    });
    return stats;
  } catch {
    return {
      mapped: 0, needs_review: 0, unknown_type: 0, unknown_office: 0,
      pending: 0, ignored: 0, placeholder: 0, total: 0, real_unresolved: 0,
    };
  }
}

// ─── FAILURE REASON LABELS ────────────────────────────────────────────────────

export const FAILURE_REASON_LABELS = {
  no_provider_name: 'No provider name in import row',
  no_provider_name_match: 'No matching provider found in system',
  no_office_resolved: 'Office could not be resolved',
  conflicting_candidate_providers: 'Multiple candidate providers found',
  placeholder_provider_label: 'Placeholder import label (not a real provider)',
  missing_provider_type: 'Provider type not set or unknown',
  inactive_provider_conflict: 'Provider is marked inactive',
  alias_collision: 'Alias matches multiple providers',
  duplicate_canonical_candidate: 'Duplicate canonical provider candidates',
  missing_source_office: 'No office in source import row',
  ambiguous_office_assignment: 'Ambiguous office — possible match but low confidence',
  enrichment_error: 'System error during enrichment',
};
