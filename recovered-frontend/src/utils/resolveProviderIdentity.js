/**
 * resolveProviderIdentity.js
 *
 * Single source of truth for resolving provider identity from a row object.
 * Checks all known ID field variants and falls back to name-match from /v2/providers list.
 */

/**
 * Normalize a provider name for fuzzy matching:
 * - lowercase, trim, remove punctuation, remove "Dr.", collapse spaces
 */
export function normalizeProviderName(name) {
  if (!name) return '';
  return name?.toLowerCase()?.replace(/\bdr\.?\s*/g, '')?.replace(/[^a-z0-9 ]/g, '')?.replace(/\s+/g, ' ')?.trim();
}

/**
 * Extract provider ID from a row object by checking all known field variants.
 * Returns { providerId, source } where source is the field name that resolved it.
 */
function extractIdFromRow(row) {
  if (!row) return { providerId: null, source: null };

  const candidates = [
    ['providerId', row?.providerId],
    ['provider_id', row?.provider_id],
    ['dentrix_provider_id', row?.dentrix_provider_id],
    ['dentrixProviderId', row?.dentrixProviderId],
    ['ascend_provider_id', row?.ascend_provider_id],
    ['ascendProviderId', row?.ascendProviderId],
    ['providerGuid', row?.providerGuid],
    ['provider_guid', row?.provider_guid],
    ['guid', row?.guid],
    ['id', row?.id],
    ['providerMasterId', row?.providerMasterId],
  ];

  for (const [field, val] of candidates) {
    if (val !== null && val !== undefined && val !== '' && val !== 'null') {
      return { providerId: val, source: field };
    }
  }

  // Check nested raw object
  const raw = row?.raw;
  if (raw) {
    const rawCandidates = [
      ['raw.providerId', raw?.providerId],
      ['raw.provider_id', raw?.provider_id],
      ['raw.dentrix_provider_id', raw?.dentrix_provider_id],
      ['raw.dentrixProviderId', raw?.dentrixProviderId],
      ['raw.ascend_provider_id', raw?.ascend_provider_id],
      ['raw.ascendProviderId', raw?.ascendProviderId],
      ['raw.providerGuid', raw?.providerGuid],
      ['raw.provider_guid', raw?.provider_guid],
      ['raw.guid', raw?.guid],
      ['raw.id', raw?.id],
      ['raw.providerMasterId', raw?.providerMasterId],
    ];

    for (const [field, val] of rawCandidates) {
      if (val !== null && val !== undefined && val !== '' && val !== 'null') {
        return { providerId: val, source: field };
      }
    }
  }

  return { providerId: null, source: null };
}

/**
 * Build lookup maps from the /v2/providers list for name-based fallback.
 * Returns { byId, byNormalizedName }
 */
export function buildProviderLookupMaps(providersList = []) {
  const byId = {};
  const byNormalizedName = {};

  providersList?.forEach(p => {
    const id = p?.provider_id || p?.id;
    if (id) byId[id] = p;

    const rawName = p?.name || p?.provider_name || p?.display_name || '';
    const normalized = normalizeProviderName(rawName);
    if (normalized) {
      if (!byNormalizedName?.[normalized]) {
        byNormalizedName[normalized] = [];
      }
      byNormalizedName?.[normalized]?.push(p);
    }
  });

  return { byId, byNormalizedName };
}

/**
 * Resolve full provider identity from a row object.
 *
 * Resolution order:
 * 1. Direct ID field on row (all known variants)
 * 2. Name-match fallback from providersMap (built from /v2/providers)
 *
 * @param {object} row - normalized provider row
 * @param {{ byId: object, byNormalizedName: object }} providersMap - built via buildProviderLookupMaps
 * @returns {{ providerId, providerName, providerEmail, providerType, officeName, source, canPreview, canSend, reasonDisabled }}
 */
export function resolveProviderIdentity(row, providersMap = {}) {
  const rowName = row?.name || row?.providerName || row?.displayName || row?.rawName || '';
  const rowOffice = row?.office || row?.officeName || row?.canonicalOffice || '';

  // Step 1: Try direct ID extraction
  const { providerId: directId, source: directSource } = extractIdFromRow(row);

  let providerId = directId;
  let source = directSource;
  let resolvedProvider = null;

  // Step 2: If no direct ID, try name-match from providers map
  if (!providerId && providersMap?.byNormalizedName) {
    const normalizedRowName = normalizeProviderName(rowName);
    const matches = providersMap?.byNormalizedName?.[normalizedRowName] || [];

    if (matches?.length === 1) {
      resolvedProvider = matches?.[0];
      providerId = resolvedProvider?.provider_id || resolvedProvider?.id || null;
      source = 'name_match';
    } else if (matches?.length > 1) {
      // Multiple matches — try to disambiguate by office
      if (rowOffice) {
        const normalizedRowOffice = rowOffice?.toLowerCase()?.trim();
        const officeMatch = matches?.find(m => {
          const mOffice = (m?.office_name || m?.location_name || '')?.toLowerCase()?.trim();
          return mOffice && normalizedRowOffice?.includes(mOffice?.split(' ')?.[0]);
        });
        if (officeMatch) {
          resolvedProvider = officeMatch;
          providerId = resolvedProvider?.provider_id || resolvedProvider?.id || null;
          source = 'name_office_match';
        } else {
          // Still ambiguous
          source = 'ambiguous_name_match';
        }
      } else {
        source = 'ambiguous_name_match';
      }
    }
  }

  // Step 3: Try direct ID lookup in byId map if we have an ID
  if (providerId && providersMap?.byId && !resolvedProvider) {
    resolvedProvider = providersMap?.byId?.[providerId] || null;
  }

  const providerName = rowName ||
    resolvedProvider?.name ||
    resolvedProvider?.provider_name ||
    resolvedProvider?.display_name ||
    'Unknown';

  const providerEmail = row?.providerEmail ||
    row?.email ||
    row?.raw?.providerEmail ||
    row?.raw?.email ||
    resolvedProvider?.email ||
    resolvedProvider?.provider_email ||
    null;

  const providerType = row?.type ||
    row?.providerType ||
    row?.canonicalType ||
    resolvedProvider?.provider_type ||
    null;

  const officeName = rowOffice ||
    resolvedProvider?.office_name ||
    resolvedProvider?.location_name ||
    null;

  // Determine if this is an unattributed/office-level row
  const isUnattributed = isUnattributedRow(rowName);

  // Determine canPreview / canSend
  let canPreview = true;
  let canSend = !!(providerId);
  let reasonDisabled = null;

  if (isUnattributed) {
    canPreview = false;
    canSend = false;
    reasonDisabled = 'Unattributed office-level collections cannot be sent as provider compensation.';
  } else if (source === 'ambiguous_name_match') {
    canSend = false;
    reasonDisabled = 'Provider ID could not be resolved because multiple providers match this name.';
  } else if (!providerId) {
    canSend = false;
    reasonDisabled = `Provider ID could not be resolved for ${providerName}.`;
  }

  console.log('[ProviderComp Identity] resolved', {
    providerName,
    providerId,
    source,
    isUnattributed,
    canPreview,
    canSend,
    rawKeys: Object.keys(row || {}),
    rawNestedKeys: Object.keys(row?.raw || {}),
  });

  return {
    providerId,
    providerName,
    providerEmail,
    providerType,
    officeName,
    source,
    isUnattributed,
    canPreview,
    canSend,
    reasonDisabled,
  };
}

/**
 * Detect if a row is an unattributed / office-level row (not a real provider).
 */
export function isUnattributedRow(name = '') {
  const n = name?.toLowerCase()?.trim();
  return (n?.includes('unattributed') ||
  n?.includes('office-level') ||
  n?.includes('office level') ||
  n === 'office'|| n?.includes('location total') ||
  n?.includes('office total') || n?.includes('practice total'));
}
