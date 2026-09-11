/**
 * calculateProviderCompensation — single shared compensation calculation helper.
 *
 * Used by:
 *   - Provider Compensation table (ProviderCompensationNew.jsx)
 *   - Preview modal (LocalPreviewModal)
 *   - Send confirmation modal + payload (SendConfirmModal / handleConfirmSend)
 *
 * Rules:
 *   - Doctors: tier % based on MONTHLY collection (32/33/34/35%)
 *   - Hygienists: flat % (40% default, 45% for Sheryl Dubman)
 *   - Unattributed: excluded (compensationAmount = 0)
 *   - Unknown: excluded (compensationAmount = 0, needs mapping)
 */

// ─── Provider-specific hygienist default percentages ─────────────────────────
// Default is 40% for all hygienists unless listed here.
const HYGIENIST_DEFAULT_PCT_MAP = {
  'sheryl dubman': 45,
};

/**
 * Returns the default hygienist compensation % for a given provider name.
 * @param {string} providerName
 * @returns {number} 40 or 45
 */
export function getHygienistDefaultPct(providerName) {
  const key = (providerName || '')?.toLowerCase()?.trim();
  return HYGIENIST_DEFAULT_PCT_MAP?.[key] ?? 40;
}

/**
 * Returns the doctor monthly tier % based on monthly collection amount.
 * @param {number} monthlyCollection
 * @returns {number} 32 | 33 | 34 | 35
 */
export function getDoctorTierPct(monthlyCollection) {
  const c = parseFloat(monthlyCollection) || 0;
  if (c <= 50000) return 32;
  if (c <= 65000) return 33;
  if (c <= 80000) return 34;
  return 35;
}

/**
 * Returns a human-readable label for the doctor tier.
 * @param {number} monthlyCollection
 * @returns {string}
 */
export function getDoctorTierLabel(monthlyCollection) {
  const c = parseFloat(monthlyCollection) || 0;
  if (c <= 50000) return '$0–$50K → 32%';
  if (c <= 65000) return '$50K–$65K → 33%';
  if (c <= 80000) return '$65K–$80K → 34%';
  return '$80K+ → 35%';
}

/**
 * Main compensation calculation helper.
 *
 * @param {object} params
 * @param {string}      params.providerName              - Display name of the provider
 * @param {string}      params.providerType              - 'Doctor' | 'Hygienist' | 'Unknown' | 'Unattributed'
 * @param {number}      params.payPeriodCollection       - Collections for this pay period
 * @param {number}      params.monthlyTierCollection     - Monthly collection used for doctor tier
 * @param {number|null} params.selectedHygienistPct      - User-selected hygienist % override (null = use default)
 * @param {number|null} params.selectedDoctorOverridePct - User-selected doctor % override (null = use tier)
 * @param {boolean}     params.isUnattributed            - True for unattributed/office-level rows
 * @param {boolean}     params.isUnknown                 - True for unmapped/unknown providers
 *
 * @returns {{
 *   payPeriodCollection: number,
 *   monthlyTierCollection: number|null,
 *   compensationPercent: number|null,
 *   compensationAmount: number,
 *   calculationType: string,
 *   reason: string
 * }}
 */
export function calculateProviderCompensation({
  providerName,
  providerType,
  payPeriodCollection,
  monthlyTierCollection,
  selectedHygienistPct = null,
  selectedDoctorOverridePct = null,
  isUnattributed = false,
  isUnknown = false,
}) {
  const ppColl = parseFloat(payPeriodCollection) || 0;
  const moColl = parseFloat(monthlyTierCollection) || ppColl;

  // ── Unattributed ──────────────────────────────────────────────────────────
  if (isUnattributed || providerType === 'Unattributed') {
    return {
      payPeriodCollection: ppColl,
      monthlyTierCollection: null,
      compensationPercent: null,
      compensationAmount: 0,
      calculationType: 'Excluded',
      reason: 'Unattributed office-level collection',
    };
  }

  // ── Unknown / Needs Mapping ───────────────────────────────────────────────
  if (isUnknown || providerType === 'Unknown') {
    return {
      payPeriodCollection: ppColl,
      monthlyTierCollection: null,
      compensationPercent: null,
      compensationAmount: 0,
      calculationType: 'Needs Mapping',
      reason: 'Provider type unknown — do not default to Doctor',
    };
  }

  // ── Doctor ────────────────────────────────────────────────────────────────
  if (providerType === 'Doctor') {
    const tierPct = getDoctorTierPct(moColl);
    const pct = selectedDoctorOverridePct != null ? selectedDoctorOverridePct : tierPct;
    const amount = ppColl * pct / 100;
    return {
      payPeriodCollection: ppColl,
      monthlyTierCollection: moColl,
      compensationPercent: pct,
      compensationAmount: amount,
      calculationType: 'Doctor monthly tier',
      reason: getDoctorTierLabel(moColl),
    };
  }

  // ── Hygienist ─────────────────────────────────────────────────────────────
  if (providerType === 'Hygienist') {
    const defaultPct = getHygienistDefaultPct(providerName);
    // User-selected override takes priority; otherwise use provider-specific default
    const pct = selectedHygienistPct != null ? selectedHygienistPct : defaultPct;
    const amount = ppColl * pct / 100;
    return {
      payPeriodCollection: ppColl,
      monthlyTierCollection: null, // N/A for hygienists — never uses doctor tier logic
      compensationPercent: pct,
      compensationAmount: amount,
      calculationType: 'Hygienist selected/provider rate',
      reason: selectedHygienistPct != null
        ? `User-selected ${pct}%`
        : `Provider default ${pct}%${pct === 45 ? ' (Sheryl Dubman exception)' : ''}`,
    };
  }

  // ── Fallback (should not reach here) ─────────────────────────────────────
  return {
    payPeriodCollection: ppColl,
    monthlyTierCollection: null,
    compensationPercent: null,
    compensationAmount: 0,
    calculationType: 'Needs Mapping',
    reason: `Unrecognized provider type: ${providerType}`,
  };
}
