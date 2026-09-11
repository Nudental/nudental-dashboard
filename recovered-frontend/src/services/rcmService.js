/**
 * rcmService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Normalized RCM data layer for Nu Dashboard.
 *
 * Architecture:
 *  1. All RCM data is fetched from Dentrix Ascend via ascendApi.js
 *  2. When a selected office UUID is provided, it is resolved to the correct
 *     Dentrix locationId via LOCATION_ID_MAP before calling the API.
 *  3. When "All Offices" is selected (officeId = ''), we fan-out across all
 *     4 locations and merge the results client-side.
 *  4. Every fetch records diagnostic metadata (source, timing, counts, errors)
 *     that is exposed to the Super Admin diagnostic panel.
 *  5. Supabase is NOT used as the source of truth for RCM data — the tables
 *     (claims, payment_arrangements, etc.) do not exist in the schema.
 *     If a Supabase warehouse layer is added in the future, swap the fetcher
 *     functions below without changing the component interfaces.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ascendApi } from './ascendApi';
import { LOCATION_ID_MAP, OFFICE_MAP } from '../constants/offices';

// ─── Office definitions ───────────────────────────────────────────────────────

/**
 * All 4 Nu Dental offices with their Dentrix locationId values.
 * Used for fan-out when "All Offices" is selected.
 */
const ALL_OFFICES = [
  { officeId: '220372a5-afae-49c9-8a0c-f4c0717ff352', officeName: 'Eatontown',    locationId: '14000000000433' },
  { officeId: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', officeName: 'Staten Island', locationId: '14000000000432' },
  { officeId: '54626997-57c2-4934-8743-1dabb4d176f4', officeName: 'Brick',         locationId: '14000000000435' },
  { officeId: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', officeName: 'Barnegat',      locationId: '14000000000434' },
];

/**
 * Resolve a Supabase office UUID to a Dentrix locationId.
 * Returns null when officeId is empty/undefined (All Offices).
 */
const resolveLocationId = (officeId) => {
  if (!officeId) return null;
  return LOCATION_ID_MAP?.[officeId] || null;
};

/**
 * Resolve a Dentrix locationId back to the canonical office display name.
 */
const locationIdToOfficeName = (locationId) => {
  const office = ALL_OFFICES?.find(o => o?.locationId === String(locationId));
  return office?.officeName || locationId || '—';
};

/**
 * Resolve a Dentrix locationId back to the Supabase office UUID.
 */
const locationIdToOfficeId = (locationId) => {
  const office = ALL_OFFICES?.find(o => o?.locationId === String(locationId));
  return office?.officeId || null;
};

// ─── Diagnostic store (in-memory, per session) ────────────────────────────────

/**
 * Lightweight in-memory diagnostic log.
 * Each entry records the last fetch attempt for a given subtab.
 * Exposed via getRcmDiagnostics() for the Super Admin panel.
 */
const _diagnostics = {};

const recordDiagnostic = (subtab, info) => {
  _diagnostics[subtab] = {
    subtab,
    timestamp: new Date()?.toISOString(),
    ...info,
  };
};

export const getRcmDiagnostics = () => ({ ..._diagnostics });

// ─── eAssist Email Report Service Functions ───────────────────────────────────

/**
 * Fetch eAssist email-ingested daily report rows.
 * Source: eAssist Daily Report emails parsed by NU Dashboard ingestion pipeline.
 * Expected offices: Barnegat, Brick, Eatontown only.
 * Staten Island is NOT handled by eAssist — do not pass Staten Island as an office filter.
 *
 * Returns the full envelope: { data, summary, pagination, metadata, _source }
 */
export const fetchEAssistDailyReports = async (params = {}) => {
  const t0 = Date.now();
  try {
    const raw = await ascendApi?.getEAssistDailyReports(params);
    recordDiagnostic('eassist_reports', {
      source: raw?._source || 'eassist_email_report',
      rowCount: raw?.data?.length ?? 0,
      durationMs: Date.now() - t0,
      ok: true,
    });
    return {
      data: raw?.data || [],
      summary: raw?.summary || {},
      pagination: raw?.pagination || {},
      metadata: raw?.metadata || {},
      _source: raw?._source || 'eassist_email_report',
    };
  } catch (err) {
    recordDiagnostic('eassist_reports', {
      source: 'eassist_email_report',
      rowCount: 0,
      durationMs: Date.now() - t0,
      ok: false,
      error: err?.message,
    });
    throw err;
  }
};

/**
 * Fetch eAssist ingestion pipeline status.
 * Returns coverage, missing reports, staged/conflict counts, latest run info.
 * Source: eAssist email report ingestion pipeline.
 */
export const fetchEAssistIngestStatus = async () => {
  const t0 = Date.now();
  try {
    const raw = await ascendApi?.getEAssistIngestStatus();
    recordDiagnostic('eassist_ingest_status', {
      source: raw?._source || 'eassist_email_report',
      durationMs: Date.now() - t0,
      ok: true,
    });
    return raw || {};
  } catch (err) {
    recordDiagnostic('eassist_ingest_status', {
      source: 'eassist_email_report',
      durationMs: Date.now() - t0,
      ok: false,
      error: err?.message,
    });
    throw err;
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export const safeDivide = (n, d) => {
  const num = parseFloat(n);
  const den = parseFloat(d);
  if (!isFinite(num) || !isFinite(den) || den === 0) return 0;
  return num / den;
};

export const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(v || 0);

export const fmtDate = (d) => {
  if (!d) return '—';
  // Normalise both "2026-04-30T16:16:31" and "2026-04-30 16:16:31" (space separator)
  // by replacing the first space between date and time with 'T'.
  // If there is no time component at all, append T00:00:00 so the date is parsed
  // in local time rather than UTC midnight (which can shift the displayed day).
  const normalised = String(d)?.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
  const dt = new Date(normalised?.includes('T') ? normalised : normalised + 'T00:00:00');
  if (isNaN(dt?.getTime())) return '—';
  return dt?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

export const buildRcmDateRange = (preset, customStart, customEnd) => {
  const now = new Date();
  const y = now?.getFullYear();
  const m = now?.getMonth();

  switch (preset) {
    case 'this_month': {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      return { start: s?.toISOString()?.slice(0, 10), end: e?.toISOString()?.slice(0, 10) };
    }
    case 'last_month': {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: s?.toISOString()?.slice(0, 10), end: e?.toISOString()?.slice(0, 10) };
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      const s = new Date(y, q * 3, 1);
      const e = new Date(y, q * 3 + 3, 0);
      return { start: s?.toISOString()?.slice(0, 10), end: e?.toISOString()?.slice(0, 10) };
    }
    case 'q1': {
      return { start: `${y}-01-01`, end: `${y}-03-31` };
    }
    case 'q2': {
      return { start: `${y}-04-01`, end: `${y}-06-30` };
    }
    case 'q3': {
      return { start: `${y}-07-01`, end: `${y}-09-30` };
    }
    case 'q4': {
      return { start: `${y}-10-01`, end: `${y}-12-31` };
    }
    case 'ytd': {
      const s = new Date(y, 0, 1);
      const e = new Date(y, m + 1, 0);
      return { start: s?.toISOString()?.slice(0, 10), end: e?.toISOString()?.slice(0, 10) };
    }
    case 'custom':
      return { start: customStart || new Date(y, m, 1)?.toISOString()?.slice(0, 10), end: customEnd || new Date()?.toISOString()?.slice(0, 10) };
    default: {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: s?.toISOString()?.slice(0, 10), end: e?.toISOString()?.slice(0, 10) };
    }
  }
};

/**
 * Normalize a raw Dentrix API response to a flat array.
 * Handles: array, { data: [] }, { records: [] }, { results: [] }, single object.
 */
const normalizeResponse = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw?.data;
  if (Array.isArray(raw?.records)) return raw?.records;
  if (Array.isArray(raw?.results)) return raw?.results;
  if (Array.isArray(raw?.claims)) return raw?.claims;
  if (Array.isArray(raw?.rows)) return raw?.rows;
  if (Array.isArray(raw?.items)) return raw?.items;
  if (Array.isArray(raw?.arrangements)) return raw?.arrangements;
  if (Array.isArray(raw?.statements)) return raw?.statements;
  if (Array.isArray(raw?.collections)) return raw?.collections;
  if (Array.isArray(raw?.refunds)) return raw?.refunds;
  if (Array.isArray(raw?.adjustments)) return raw?.adjustments;
  if (typeof raw === 'object' && Object.keys(raw)?.length > 0) return [raw];
  return [];
};

/**
 * Fan-out fetcher: calls the provided fetcher for each office when
 * officeId is empty (All Offices). Merges results and tags each record
 * with the correct officeName and officeId.
 *
 * When a specific officeId is provided, calls the fetcher once with the
 * resolved locationId and tags records with that office.
 *
 * @param {string} officeId - Supabase office UUID or '' for all
 * @param {Function} fetcher - async (locationId) => raw API response
 * @param {Function} normalizer - (record, officeName, officeId) => normalized record
 * @returns {Promise<Array>}
 */
const fanOutFetch = async (officeId, fetcher, normalizer) => {
  const officesToFetch = officeId
    ? ALL_OFFICES?.filter(o => o?.officeId === officeId)
    : ALL_OFFICES;

  if (officesToFetch?.length === 0) {
    // officeId provided but not in our map — try with null locationId
    let raw = await fetcher(null);
    return normalizeResponse(raw)?.map(r => normalizer(r, '—', officeId));
  }

  const results = await Promise.allSettled(
    officesToFetch?.map(async (office) => {
      let raw = await fetcher(office?.locationId);
      return normalizeResponse(raw)?.map(r => normalizer(r, office?.officeName, office?.officeId));
    })
  );

  const merged = [];
  let errors = [];

  results?.forEach((result, idx) => {
    if (result?.status === 'fulfilled') {
      merged?.push(...(result?.value || []));
    } else {
      errors?.push({ office: officesToFetch?.[idx]?.officeName, error: result?.reason?.message });
    }
  });

  if (errors?.length > 0) {
    console.warn('[RCM fanOutFetch] Partial failures:', errors);
  }

  return { records: merged, errors };
};

// ─── Fetch Offices ────────────────────────────────────────────────────────────

export const fetchRcmOffices = async () => {
  return ALL_OFFICES?.map(o => ({ id: o?.officeId, name: o?.officeName }));
};

// ─── Claims ──────────────────────────────────────────────────────────────────

/**
 * Normalize a raw Dentrix claim record into the stable dashboard schema.
 * Field mapping handles both camelCase (Dentrix) and snake_case variants.
 */
const normalizeClaim = (raw, officeName, officeId) => {
  const id = raw?.claimId || raw?.claim_id || raw?.id || crypto.randomUUID();

  // ── Payor name resolution: try every known carrier/plan field in priority order ──
  // Primary fields from the /v2/rcm/claims flat array contract are snake_case.
  // camelCase variants are also checked for forward-compatibility.
  // Do NOT fall back to generic strings like "Insurance" — those are filtered below.
  const rawPayorCandidates = [
    // Primary snake_case fields from backend contract
    raw?.payor,
    raw?.insurance_company,
    raw?.group_plan_name,
    // camelCase variants
    raw?.payorName,
    raw?.payerName,
    raw?.carrierName,
    raw?.carrier,
    raw?.insuranceCarrier,
    raw?.insuranceName,
    raw?.planName,
    raw?.plan_name,
    raw?.insurancePlan,
    raw?.benefitPlan,
    raw?.primaryCarrier,
    raw?.claimPayer,
    raw?.payer,
    raw?.insurance,
    // nested objects
    raw?.insurance?.name,
    raw?.insurance?.carrierName,
    raw?.insurance?.planName,
    raw?.payor?.name,
    raw?.carrier?.name,
  ];

  // Pick the first non-empty, non-generic value
  const GENERIC_LABELS = new Set([
    'insurance', 'insurance (eft)', 'ins', 'insur', 'carrier', 'plan', 'unknown', 'n/a', 'na', 'none', '', '—',
  ]);

  let resolvedPayor = null;
  for (const candidate of rawPayorCandidates) {
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate?.trim();
      if (trimmed && !GENERIC_LABELS?.has(trimmed?.toLowerCase())) {
        resolvedPayor = trimmed;
        break;
      }
    }
  }
  // If all candidates are generic/empty, mark as unmapped (not "Insurance")
  const payorDisplay = resolvedPayor || null; // null = unmapped, handled in fetchPayorSummary

  // ── Amount fields: preserve null when missing — do NOT use || 0 ──
  const parseMaybeFloat = (v) => {
    if (v === null || v === undefined || v === '' || v === '—') return null;
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  };

  return {
    id,
    claim_id: String(raw?.claimId || raw?.claim_id || raw?.id || id),
    patient_id: String(raw?.patientId || raw?.patient_id || ''),
    patient_name: raw?.patientName || raw?.patient_name || raw?.patientFullName || '—',
    office_id: officeId,
    office_name: officeName,
    payor: payorDisplay,
    payor_id: raw?.payorId || raw?.payor_id || raw?.payerId || raw?.payer_id || null,
    date_created: raw?.dateCreated || raw?.date_created || raw?.createdDate || null,
    date_submitted: raw?.dateSubmitted || raw?.date_submitted || raw?.submittedDate || null,
    date_received: raw?.dateReceived || raw?.date_received || raw?.receivedDate || null,
    last_visit_date: raw?.lastVisitDate || raw?.last_visit_date || null,
    date_of_service: raw?.dateOfService || raw?.date_of_service || raw?.serviceDate || null,
    amount_billed: parseMaybeFloat(raw?.amountBilled ?? raw?.amount_billed ?? raw?.billedAmount),
    amount_paid: parseMaybeFloat(raw?.amountPaid ?? raw?.amount_paid ?? raw?.paidAmount),
    status: normalizeClaimStatus(raw?.status || raw?.claimStatus || raw?.claim_status),
    claim_type: raw?.claimType || raw?.claim_type || null,
    denial_reason: raw?.denialReason || raw?.denial_reason || null,
    _source: 'dentrix_ascend',
    _raw_location_id: raw?.locationId || raw?.location_id || null,
  };
};

const normalizeClaimStatus = (raw) => {
  if (!raw) return 'unknown';
  const s = String(raw)?.toLowerCase()?.trim();
  if (['paid', 'payment posted', 'closed', 'finalized']?.includes(s)) return 'paid';
  if (['denied', 'rejected', 'denial']?.includes(s)) return 'denied';
  if (['submitted', 'sent', 'transmitted', 'billed']?.includes(s)) return 'submitted';
  if (['pending', 'in process', 'in_process', 'processing']?.includes(s)) return 'pending';
  if (['partial', 'partially paid', 'partial payment']?.includes(s)) return 'partial';
  if (['voided', 'void', 'deleted', 'cancelled', 'canceled']?.includes(s)) return 'voided';
  return s;
};

export const fetchClaims = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    let records = [];
    let errors = [];

    if (officeId && locationId) {
      // Single office
      let raw = await ascendApi?.getClaims(start, end, locationId);
      records = normalizeResponse(raw)?.map(r => normalizeClaim(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
    } else {
      // All offices — fan out
      const result = await fanOutFetch(
        officeId,
        (locId) => ascendApi?.getClaims(start, end, locId),
        normalizeClaim
      );
      records = result?.records || result || [];
      errors = result?.errors || [];
    }

    // Deduplicate by claim_id
    const seen = new Set();
    const deduped = records?.filter(r => {
      if (seen?.has(r?.claim_id)) return false;
      seen?.add(r?.claim_id);
      return true;
    });

    recordDiagnostic('claims', {
      source: 'Dentrix Ascend /v2/rcm/claims',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: records?.length,
      recordsAfterDedup: deduped?.length,
      durationMs: Date.now() - t0,
      errors: errors?.length > 0 ? errors : null,
      lastError: errors?.[0]?.error || null,
    });

    return deduped;
  } catch (err) {
    recordDiagnostic('claims', {
      source: 'Dentrix Ascend /v2/rcm/claims',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      recordsAfterDedup: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Claim Submissions (true claim lifecycle, /v2/rcm/claim-submissions) ─────

/**
 * fetchClaimSubmissions
 * Calls GET /v2/rcm/claim-submissions — the true claim lifecycle endpoint.
 * Source: insurance_claims (Dentrix Ascend).
 *
 * For All Offices (officeId = ''): calls the endpoint ONCE with no officeId.
 * For a selected office: passes officeId as the dashboard UUID (NOT locationId).
 * Does NOT use fanOutFetch.
 *
 * Returns { rows, pagination, summary, dateBasis, dateRange, asOfDate,
 *           claimSourceLastSyncedAt, claimSourceLastSyncedDate, isSameDayData,
 *           sameDaySyncWarning, claimSourceFreshnessNote, source }
 *
 * @param {object} params
 * @param {string} params.start       YYYY-MM-DD
 * @param {string} params.end         YYYY-MM-DD
 * @param {string} params.dateBasis   'serviceDate' | 'sentDate' | 'createdDate'
 * @param {string} params.officeId    Dashboard UUID or '' for All Offices
 * @param {string|null} params.status Optional comma-separated normalized statuses
 * @param {string|null} params.payor  Optional partial payor match
 * @param {number} params.page
 * @param {number} params.pageSize
 */
export const fetchClaimSubmissions = async ({
  start,
  end,
  dateBasis = 'serviceDate',
  officeId = '',
  status = null,
  payor = null,
  page = 1,
  pageSize = 50,
}) => {
  const t0 = Date.now();
  // All Offices: pass null so no officeId param is appended.
  // Selected office: pass the dashboard UUID directly (not locationId).
  const resolvedOfficeId = officeId || null;

  try {
    const raw = await ascendApi?.getClaimSubmissions(
      start, end, dateBasis, resolvedOfficeId, status, payor, page, pageSize
    );

    const rows = Array.isArray(raw?.data) ? raw?.data : [];
    let summary = raw?.summary || {};
    let pagination = raw?.pagination || {};

    recordDiagnostic('claim_submissions', {
      source: raw?._source || 'dentrix_ascend/insurance_claims',
      endpoint: '/v2/rcm/claim-submissions',
      dateBasis,
      dateRange: raw?.date_range || `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: rows?.length,
      paginationTotal: pagination?.total_count ?? pagination?.total_rows ?? null,
      durationMs: Date.now() - t0,
    });

    return {
      rows,
      summary,
      pagination,
      dateBasis: raw?.date_basis || dateBasis,
      dateRange: raw?.date_range || `${start} – ${end}`,
      asOfDate: raw?.as_of_date || null,
      claimSourceLastSyncedAt: raw?.claim_source_last_synced_at || null,
      claimSourceLastSyncedDate: raw?.claim_source_last_synced_date || null,
      isSameDayData: raw?.is_same_day_data ?? false,
      sameDaySyncWarning: raw?.same_day_sync_warning ?? false,
      claimSourceFreshnessNote: raw?.claim_source_freshness_note || null,
      source: raw?._source || 'dentrix_ascend/insurance_claims',
    };
  } catch (err) {
    recordDiagnostic('claim_submissions', {
      source: 'dentrix_ascend/insurance_claims',
      endpoint: '/v2/rcm/claim-submissions',
      dateBasis,
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Payor Summary (Stage 5C-B, patched V266) ────────────────────────────────

/**
 * fetchPayorSummary({ start, end, officeId })
 *
 * Fetches ALL currently open claims as of `end` date using an 18-month lookback
 * window. The Operations date range (start→end) defines the "as of" date only —
 * it does NOT limit which claims are included to only those submitted during that
 * period. A claim submitted 14 months ago that is still open/unpaid as of `end`
 * IS included.
 *
 * Key fixes vs. original Stage 5C-B:
 *  1. Lookback window: fetches from (end − 18 months) to end, not start→end.
 *  2. Aging anchor: computed as of `end` date, not today.
 *  3. Payor name: uses expanded field resolution from normalizeClaim; null payor
 *     is grouped as "Unknown / Unmapped Payor", not "Insurance".
 *  4. amount_billed / amount_paid: null-preserved in normalizeClaim; no fake $0.
 *
 * Does NOT use monthly_executive_analytics, daily_entries, or any MEA source.
 * Source: Dentrix Ascend /v2/rcm/claims
 */
// ─── Dentrix Aged Receivables Snapshot (V267 temporary AR source) ─────────────

/**
 * fetchAgingReceivablesLive()
 *
 * V337: Updated to prefer the verified page-summed Dentrix Ascend source:
 *   Primary:   GET /v2/accounts-receivable
 *   Secondary: GET /v2/ar
 *   Fallback:  GET /v2/rcm/aging-receivables-live
 *   Alias 1:   GET /v2/rcm/payor-aging
 *   Alias 2:   GET /v2/aging-receivables/live
 *   Alias 3:   GET /v2/aging-receivables/by-payor
 *
 * Verified source: Dentrix Ascend Aging Balances Report via HS1 /v1/agingbalances/report,
 * page-summed through Nu Dashboard middleware. Yabezy verified 40/40 data points with
 * $0.00 variance across all offices (70 pages total, all pages summed).
 *
 * Expected response shape (verified fields):
 * {
 *   totalAR:            number,   // Total A/R (all offices, all pages summed)
 *   netBalance:         number,   // Net Balance after unapplied credits
 *   insurancePortion:   number,   // Insurance Portion
 *   guarantorPortion:   number,   // Guarantor Portion
 *   estimatedWriteOff:  number,   // Estimated Write-Off
 *   unappliedCredits:   number,   // Unapplied Credits (typically negative)
 *   patientCount:       number,   // Patient Count (summary only)
 *   asOf:               string,   // Snapshot timestamp
 *   snapshotDate:       string,   // ISO date string
 *   lastSyncedAt:       string,   // ISO date string
 *   automated:          boolean,
 *   fallbackRequired:   boolean,
 *   fullAR: {
 *     totalBalance:               number,
 *     totalBalanceBeforeCredits:  number,
 *     insurancePortion:           number,
 *     guarantorPortion:           number,
 *     estimatedWriteOff:          number,
 *     unappliedCredits:           number,
 *     netBalanceAfterCredits:     number,
 *     netBalance:                 number,
 *   },
 *   agingBuckets: {
 *     b_0_30:    number,
 *     b_31_60:   number,
 *     b_61_90:   number,
 *     b_over_90: number,
 *   },
 *   offices: Array<{ officeName: string, totalAR: number, insurancePortion: number, ... }>,
 *   officeRollup: Array<{ officeName: string, insuranceAR: number, ... }>,
 *   reconciliation: {
 *     reconciled: boolean,
 *     variance:   number,
 *   },
 * }
 *
 * IMPORTANT: Caller MUST check reconciliation.reconciled === true before
 * displaying any AR values. If false, hide all data and show warning.
 *
 * Does NOT use /v2/rcm/claims, MEA, daily_entries, or any claim-derived source.
 * Does NOT expose PHI, patient names, or claim IDs.
 * /v2/ar/patients is disabled (returns 403) and is never called.
 */
export const fetchAgingReceivablesLive = async () => {
  const API_BASE_V2 = 'https://api.nudashboard.com/v2';
  const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';
  const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

  // V337: Verified page-summed endpoints first, then legacy aliases
  const endpoints = [
    `${API_BASE_V2}/accounts-receivable`,
    `${API_BASE_V2}/ar`,
    `${API_BASE_V2}/rcm/aging-receivables-live`,
    `${API_BASE_V2}/rcm/payor-aging`,
    `${API_BASE_V2}/aging-receivables/live`,
    `${API_BASE_V2}/aging-receivables/by-payor`,
  ];

  let lastError = null;
  let sourceUsed = null;

  for (let url of endpoints) {
    try {
      const res = await fetch(url, { headers });
      if (!res?.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`);
        continue;
      }
      const json = await res?.json();
      // Normalize: unwrap common envelope shapes
      const payload = json?.data ?? json?.result ?? json?.snapshot ?? json;

      // V337: Normalize top-level verified fields into the shape expected by all consumers.
      // Some endpoints return flat top-level fields; others nest under fullAR/agingBuckets.
      // Merge both shapes so all consumers get a consistent object.
      const normalized = normalizeArPayload(payload);

      sourceUsed = url;
      recordDiagnostic('aging-receivables-live', {
        source: url,
        reconciled: normalized?.reconciliation?.reconciled,
        snapshotDate: normalized?.snapshotDate,
        lastSyncedAt: normalized?.lastSyncedAt,
        sourceEndpoint: url,
        timestamp: new Date()?.toISOString(),
      });
      return normalized;
    } catch (err) {
      lastError = err;
    }
  }

  recordDiagnostic('aging-receivables-live', {
    source: 'all endpoints failed',
    lastError: lastError?.message,
    timestamp: new Date()?.toISOString(),
  });
  throw lastError || new Error('fetchAgingReceivablesLive: all endpoints failed');
};

/**
 * fetchOfficialArAging(officeId?)
 *
 * V451: Official AR Aging source — Dentrix Ascend Aging Balances via
 *   GET /v2/rcm/ar-aging-official
 *
 * Provides:
 *  - official Dentrix Ascend Aging Balances data
 *  - Total A/R buckets (0-30, 31-60, 61-90, over_90)
 *  - Insurance A/R buckets
 *  - Patient / Guarantor A/R buckets
 *  - Net Balance, Estimated Write-Off
 *  - restricted Unapplied Credits visibility (unapplied_credits_visible flag)
 *  - office filter support
 *  - 15-minute cache metadata
 *
 * Office behavior:
 *  - All Offices: call with no officeId param
 *  - Selected office: pass dashboard officeId (UUID) as officeId query param
 *  - Do NOT pass UUID as locationId
 *
 * Unapplied Credits:
 *  - Only expose unapplied_credits / unapplied_credits_value when
 *    unapplied_credits_visible === true in the response.
 *  - If false, missing, or restricted: return unapplied_credits_visible: false,
 *    unapplied_credits: null.
 *
 * Does NOT use /v2/accounts-receivable, /v2/ar, or any claim-derived source.
 */
export const fetchOfficialArAging = async (officeId) => {
  const API_BASE_V2 = 'https://api.nudashboard.com/v2';
  const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';
  const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

  let url = new URL(`${API_BASE_V2}/rcm/ar-aging-official`);
  if (officeId) {
    url?.searchParams?.set('officeId', officeId);
  }

  const t0 = Date.now();
  let lastError = null;

  try {
    const res = await fetch(url?.toString(), { method: 'GET', headers });
    if (!res?.ok) {
      throw new Error(`fetchOfficialArAging: HTTP ${res.status} from /v2/rcm/ar-aging-official`);
    }
    const raw = await res?.json();

    // Enforce restricted Unapplied Credits visibility
    const creditsVisible = raw?.unapplied_credits_visible === true;

    // V452 FIX: API returns nested shape: { ar_aging: { total, insurance, patient, ... }, by_office, metadata }
    // Previous code read flat fields (raw?.total_ar, raw?.net_balance, etc.) which don't exist → all null → all dashes
    const ar = raw?.ar_aging || {};
    const meta = raw?.metadata || {};

    const normalized = {
      // Core totals — read from nested ar_aging.*
      totalAR:           ar?.total?.total        ?? null,
      netBalance:        ar?.net_balance          ?? null,
      insurancePortion:  ar?.insurance?.total     ?? null,
      guarantorPortion:  ar?.patient?.total       ?? null,
      estimatedWriteOff: ar?.estimated_writeoff   ?? null,
      patientCount:      meta?.patient_count      ?? null,

      // Unapplied Credits — only expose when backend explicitly says visible
      unapplied_credits_visible: creditsVisible,
      unappliedCredits: creditsVisible ? (ar?.unapplied_credits ?? raw?.unapplied_credits ?? null) : null,

      // Total A/R aging buckets — ar_aging.total.{current, b30, b60, b90}
      agingBuckets: {
        b_0_30:    ar?.total?.current ?? null,
        b_31_60:   ar?.total?.b30     ?? null,
        b_61_90:   ar?.total?.b60     ?? null,
        b_over_90: ar?.total?.b90     ?? null,
      },

      // Insurance A/R buckets — ar_aging.insurance.{current, b30, b60, b90}
      insuranceBuckets: (ar?.insurance) ? {
        b_0_30:    ar?.insurance?.current ?? null,
        b_31_60:   ar?.insurance?.b30     ?? null,
        b_61_90:   ar?.insurance?.b60     ?? null,
        b_over_90: ar?.insurance?.b90     ?? null,
      } : null,

      // Patient / Guarantor A/R buckets — ar_aging.patient.{current, b30, b60, b90}
      patientBuckets: (ar?.patient) ? {
        b_0_30:    ar?.patient?.current ?? null,
        b_31_60:   ar?.patient?.b30     ?? null,
        b_61_90:   ar?.patient?.b60     ?? null,
        b_over_90: ar?.patient?.b90     ?? null,
      } : null,

      // Office-level breakdown — by_office[]
      // Each entry: { office_name, total: { current, b30, b60, b90, total }, insurance: { total }, patient: { total } }
      offices: Array.isArray(raw?.by_office) ? raw?.by_office?.map(o => {
        // V473: Expanded office name resolver — tries every known field shape
        // before falling back to '—'. Uses ALL_OFFICES (defined above) for
        // office_id UUID → name and location_id → name lookups.
        const resolveByOfficeOfficeName = (row) => {
          if (!row) return '—';
          // 1. Direct string name fields
          const direct =
            row?.office ||
            row?.office_name ||
            row?.officeName ||
            row?.name ||
            row?.location_name ||
            row?.locationName;
          if (direct && typeof direct === 'string' && direct?.trim() && direct?.trim() !== '—') {
            return direct?.trim();
          }
          // 2. Map office_id (UUID) through ALL_OFFICES
          const officeUuid = row?.office_id ?? row?.officeId;
          if (officeUuid) {
            const match = ALL_OFFICES?.find(a => a?.officeId === String(officeUuid));
            if (match?.officeName) return match?.officeName;
          }
          // 3. Map location_id (Dentrix numeric) through ALL_OFFICES
          const locId = row?.location_id ?? row?.locationId ?? row?.dentrix_location_id ?? row?.dentrixLocationId;
          if (locId !== null && locId !== undefined) {
            const match = ALL_OFFICES?.find(a => a?.locationId === String(locId));
            if (match?.officeName) return match?.officeName;
          }
          return '—';
        };
        return {
          officeName:       resolveByOfficeOfficeName(o),
          totalAR:          o?.total?.total       ?? null,
          insurancePortion: o?.insurance?.total   ?? null,
          guarantorPortion: o?.patient?.total     ?? null,
        };
      }) : [],

      // Metadata
      asOf:         ar?.as_of_date   ?? raw?.as_of ?? null,
      lastSyncedAt: meta?.cached_at  ?? null,
      cacheAge:     meta?.cache_ttl_minutes ?? null,
      officeId:     officeId || null,
      _source:      '/v2/rcm/ar-aging-official',
      _durationMs:  Date.now() - t0,
    };

    recordDiagnostic('ar-aging-official', {
      source: '/v2/rcm/ar-aging-official',
      officeId: officeId || 'all',
      unapplied_credits_visible: creditsVisible,
      durationMs: normalized?._durationMs,
      ok: true,
    });

    return normalized;
  } catch (err) {
    lastError = err;
    recordDiagnostic('ar-aging-official', {
      source: '/v2/rcm/ar-aging-official',
      officeId: officeId || 'all',
      error: err?.message,
      durationMs: Date.now() - t0,
      ok: false,
    });
    throw lastError;
  }
};

/**
 * V337: Normalize AR payload from any endpoint shape into a consistent object.
 * Handles both flat top-level fields (from /v2/accounts-receivable, /v2/ar)
 * and nested fields (from /v2/rcm/aging-receivables-live legacy shape).
 * Missing fields remain null — no fake $0.
 */

// ─── V347: Known Dentrix locationId → canonical office name ──────────────────
// Used inside normalizeArPayload so officeRollup entries always have a resolved
// display name even when the backend only returns a numeric locationId.
const DENTRIX_LOCATION_ID_TO_NAME = {
  '14000000000432': 'Staten Island',
  '14000000000433': 'Eatontown',
  '14000000000434': 'Barnegat',
  '14000000000435': 'Brick',
};

// ─── V347: Dashboard UUID → canonical office name ─────────────────────────────
const DASHBOARD_UUID_TO_NAME = {
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': 'Staten Island',
  '220372a5-afae-49c9-8a0c-f4c0717ff352': 'Eatontown',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': 'Barnegat',
  '54626997-57c2-4934-8743-1dabb4d176f4': 'Brick',
};

/**
 * V347: Resolve a display name from an office object returned by any AR endpoint.
 * Checks every known field shape before falling back to '—'.
 * This is the authoritative resolver used inside normalizeArPayload.
 */
const resolveOfficeDisplayName = (o) => {
  if (!o) return '—';

  // 1. Direct name fields (most reliable)
  const direct = o?.officeName || o?.locationName || o?.name || o?.office || o?.location;
  if (direct && typeof direct === 'string' && direct?.trim() && direct?.trim() !== '—') {
    return direct?.trim();
  }

  // 2. Dentrix numeric locationId (string or number)
  const locId = o?.locationId ?? o?.location_id ?? o?.dentrixLocationId ?? o?.dentrix_location_id;
  if (locId !== null && locId !== undefined) {
    const key = String(locId)?.trim();
    if (DENTRIX_LOCATION_ID_TO_NAME?.[key]) return DENTRIX_LOCATION_ID_TO_NAME?.[key];
  }

  // 3. Dashboard UUID (officeId / id)
  const uuid = o?.officeId ?? o?.id;
  if (uuid && typeof uuid === 'string') {
    if (DASHBOARD_UUID_TO_NAME?.[uuid?.trim()]) return DASHBOARD_UUID_TO_NAME?.[uuid?.trim()];
  }

  // 4. location object with nested id or name
  if (o?.location && typeof o?.location === 'object') {
    const locName = o?.location?.name || o?.location?.officeName;
    if (locName && typeof locName === 'string' && locName?.trim()) return locName?.trim();
    const nestedId = o?.location?.id;
    if (nestedId !== null && nestedId !== undefined) {
      const key = String(nestedId)?.trim();
      if (DENTRIX_LOCATION_ID_TO_NAME?.[key]) return DENTRIX_LOCATION_ID_TO_NAME?.[key];
      if (DASHBOARD_UUID_TO_NAME?.[key]) return DASHBOARD_UUID_TO_NAME?.[key];
    }
  }

  return '—';
};

function normalizeArPayload(payload) {
  if (!payload) return payload;

  const safeN = (v) => (v === undefined ? null : v ?? null);

  // Top-level verified fields (from /v2/accounts-receivable or /v2/ar)
  const topTotalAR           = safeN(payload?.totalAR);
  const topNetBalance        = safeN(payload?.netBalance);
  const topInsurancePortion  = safeN(payload?.insurancePortion);
  const topGuarantorPortion  = safeN(payload?.guarantorPortion);
  const topEstimatedWriteOff = safeN(payload?.estimatedWriteOff);
  const topUnappliedCredits  = safeN(payload?.unappliedCredits);
  const topPatientCount      = safeN(payload?.patientCount);
  const topAsOf              = safeN(payload?.asOf);

  // Nested fullAR fields (from legacy /v2/rcm/aging-receivables-live shape)
  const fullAR = payload?.fullAR || {};
  const nestedInsurance  = safeN(fullAR?.insurancePortion);
  const nestedGuarantor  = safeN(fullAR?.guarantorPortion);
  const nestedWriteOff   = safeN(fullAR?.estimatedWriteOff);
  const nestedCredits    = safeN(fullAR?.unappliedCredits);
  const nestedNetBalance = safeN(fullAR?.netBalanceAfterCredits ?? fullAR?.netBalance);
  const nestedTotalBal   = safeN(fullAR?.totalBalance ?? fullAR?.totalBalanceBeforeCredits);

  // Merge: prefer top-level verified fields, fall back to nested
  const mergedFullAR = {
    totalBalance:              topTotalAR           ?? nestedTotalBal,
    totalBalanceBeforeCredits: safeN(fullAR?.totalBalanceBeforeCredits),
    insurancePortion:          topInsurancePortion  ?? nestedInsurance,
    guarantorPortion:          topGuarantorPortion  ?? nestedGuarantor,
    estimatedWriteOff:         topEstimatedWriteOff ?? nestedWriteOff,
    unappliedCredits:          topUnappliedCredits  ?? nestedCredits,
    netBalanceAfterCredits:    topNetBalance        ?? nestedNetBalance,
    netBalance:                topNetBalance        ?? nestedNetBalance,
  };

  // offices[] from /v2/accounts-receivable or /v2/ar (new shape)
  // officeRollup[] from legacy /v2/rcm/aging-receivables-live shape
  const offices     = Array.isArray(payload?.offices)     ? payload?.offices     : [];
  const officeRollup = Array.isArray(payload?.officeRollup) ? payload?.officeRollup?.map(o => ({
    // Preserve all raw fields so component-level resolvers still have access
    ...o,
    // V347: Ensure officeName is always resolved — never left as '—' when a
    // known locationId or UUID is present in the raw object.
    officeName: resolveOfficeDisplayName(o),
    insuranceAR: safeN(o?.insurancePortion ?? o?.insuranceAR),
  })) : offices?.map(o => ({
    // Preserve all raw fields
    ...o,
    // V347: Full resolution — checks officeName, locationName, name, office,
    // location, locationId, dentrixLocationId, officeId, location.id, etc.
    officeName: resolveOfficeDisplayName(o),
    insuranceAR: safeN(o?.insurancePortion ?? o?.insuranceAR),
  }));

  return {
    // Preserve all original fields
    ...payload,
    // Merged/normalized fullAR
    fullAR: mergedFullAR,
    // Top-level convenience fields (for consumers that read top-level)
    totalAR:           topTotalAR           ?? nestedTotalBal,
    netBalance:        topNetBalance        ?? nestedNetBalance,
    insurancePortion:  topInsurancePortion  ?? nestedInsurance,
    guarantorPortion:  topGuarantorPortion  ?? nestedGuarantor,
    estimatedWriteOff: topEstimatedWriteOff ?? nestedWriteOff,
    unappliedCredits:  topUnappliedCredits  ?? nestedCredits,
    patientCount:      topPatientCount,
    asOf:              topAsOf ?? safeN(payload?.snapshotDate),
    // offices[] normalized
    offices,
    officeRollup,
    // V344: Normalize agingBuckets — prefer nested agingBuckets shape,
    // fall back to flat field names returned by /v2/accounts-receivable or /v2/ar:
    //   current_0_30 / agingBuckets.b_0_30
    //   aged_31_60   / agingBuckets.b_31_60
    //   aged_61_90   / agingBuckets.b_61_90
    //   aged_over_90 / agingBuckets.b_over_90
    agingBuckets: {
      b_0_30:    safeN(payload?.agingBuckets?.b_0_30)    ?? safeN(payload?.current_0_30)  ?? null,
      b_31_60:   safeN(payload?.agingBuckets?.b_31_60)   ?? safeN(payload?.aged_31_60)    ?? null,
      b_61_90:   safeN(payload?.agingBuckets?.b_61_90)   ?? safeN(payload?.aged_61_90)    ?? null,
      b_over_90: safeN(payload?.agingBuckets?.b_over_90) ?? safeN(payload?.aged_over_90)  ?? null,
    },
    // Preserve reconciliation as-is
    reconciliation: payload?.reconciliation || {},
    // Preserve timestamps
    snapshotDate: safeN(payload?.snapshotDate ?? topAsOf),
    lastSyncedAt: safeN(payload?.lastSyncedAt),
    automated:    payload?.automated ?? null,
    fallbackRequired: payload?.fallbackRequired ?? null,
  };
}

export const fetchPayorSummary = async ({ start, end, officeId }) => {
  const API_BASE_V2 = 'https://api.nudashboard.com/v2';
  const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';
  // ── IMPORTANT: Do NOT include Content-Type on GET requests. ──────────────
  // Content-Type: application/json on a GET triggers a CORS preflight OPTIONS
  // request. The /v2/rcm/claims endpoint does not have CORS/OPTIONS support
  // for Content-Type (unlike /v2/rcm/aging-receivables-live which works).
  // Using only X-API-Key minimizes the preflight surface area.
  const FETCH_HEADERS = { 'X-API-Key': API_KEY };

  const PAGE_SIZE = 500;
  const MAX_PAGES = 30; // safety limit — 30 × 500 = 15,000 rows max

  // ── As-of date: use selected end date for aging computation ──────────────
  const asOfDate = end ? new Date(end + 'T00:00:00') : new Date();
  if (isNaN(asOfDate?.getTime())) asOfDate?.setTime(new Date()?.getTime());
  asOfDate?.setHours(0, 0, 0, 0);

  // ── Lookback window: 18 months before end date ────────────────────────────
  // This ensures open claims submitted before the selected period start are included.
  // UI text: "Includes all open claims from the prior 18 months, not only claims
  // submitted during the selected period."
  const lookbackStart = new Date(asOfDate);
  lookbackStart?.setMonth(lookbackStart?.getMonth() - 18);
  const arStart = lookbackStart?.toISOString()?.slice(0, 10);
  const arEnd = end || asOfDate?.toISOString()?.slice(0, 10);

  console.log(`[fetchPayorSummary] 18-month window: ${arStart} → ${arEnd} | asOf: ${asOfDate?.toISOString()?.slice(0, 10)} | officeId: ${officeId || 'All Offices'}`);

  // ── Step 1: Paginated fetch across all offices using direct fetch ─────────
  // Uses the same direct fetch pattern as fetchAgingReceivablesLive to avoid
  // the safeFetch wrapper which can cause "Failed to fetch" CORS/network issues.
  const allClaims = [];
  const seenIds = new Set();
  let totalRawRows = 0;
  let fetchErrors = [];

  const addClaims = (claims) => {
    (claims || [])?.forEach((c) => {
      if (!seenIds?.has(c?.claim_id)) {
        seenIds?.add(c?.claim_id);
        allClaims?.push(c);
      }
    });
  };

  /**
   * Safe defensive response parser per backend contract.
   * Primary expected shape: flat Array<Claim>
   * Defensive fallbacks for envelope shapes.
   */
  const parseClaimsResponse = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.claims)) return raw?.claims;
    if (Array.isArray(raw?.rows)) return raw?.rows;
    if (Array.isArray(raw?.data)) return raw?.data;
    if (Array.isArray(raw?.items)) return raw?.items;
    if (Array.isArray(raw?.records)) return raw?.records;
    if (Array.isArray(raw?.results)) return raw?.results;
    return [];
  };

  const officesToFetch = officeId
    ? ALL_OFFICES?.filter((o) => o?.officeId === officeId)
    : ALL_OFFICES;

  for (const office of officesToFetch) {
    let page = 1;
    let keepFetching = true;
    let officeRawCount = 0;

    while (keepFetching && page <= MAX_PAGES) {
      let url = `${API_BASE_V2}/rcm/claims?startDate=${arStart}&endDate=${arEnd}&page=${page}&pageSize=${PAGE_SIZE}&locationId=${office?.locationId}`;
      console.log(`[fetchPayorSummary] Fetching: ${url}`);

      try {
        const res = await fetch(url, { headers: FETCH_HEADERS });
        console.log(`[fetchPayorSummary] ${office?.officeName} page ${page} → HTTP ${res?.status}`);

        if (!res?.ok) {
          console.warn(`[fetchPayorSummary] HTTP ${res?.status} for ${office?.officeName} page ${page} — stopping pagination for this office`);
          fetchErrors?.push({ office: office?.officeName, page, status: res?.status });
          keepFetching = false;
          break;
        }

        const json = await res?.json();
        let records = parseClaimsResponse(json);
        console.log(`[fetchPayorSummary] ${office?.officeName} page ${page} → raw records: ${records?.length}`);

        totalRawRows += records?.length;
        officeRawCount += records?.length;

        const normalized = records?.map((r) => normalizeClaim(r, office?.officeName, office?.officeId));
        addClaims(normalized);

        // Continue paginating only if we got a full page (backend supports pagination)
        // If backend returns all rows at once (e.g., 12,943 on page 1), keepFetching = false
        keepFetching = records?.length === PAGE_SIZE;
        page += 1;
      } catch (err) {
        console.warn(`[fetchPayorSummary] Network error for ${office?.officeName} page ${page}:`, err?.message);
        fetchErrors?.push({ office: office?.officeName, page, error: err?.message });
        keepFetching = false;
      }
    }

    console.log(`[fetchPayorSummary] ${office?.officeName} total raw rows: ${officeRawCount}`);
  }

  console.log(`[fetchPayorSummary] Total raw rows across all offices: ${totalRawRows} | After dedup: ${allClaims?.length} | Fetch errors: ${fetchErrors?.length}`);
  if (fetchErrors?.length > 0) {
    console.warn('[fetchPayorSummary] Fetch errors:', fetchErrors);
  }

  // ── Step 2: Filter voided claims ─────────────────────────────────────────
  const activeClaims = allClaims?.filter((c) => c?.status !== 'voided');
  console.log(`[fetchPayorSummary] Active (non-voided) claims: ${activeClaims?.length}`);

  // ── Step 3: Compute agingDays per claim as of selectedEndDate ────────────
  const computeAgingDays = (claim) => {
    const anchor = claim?.date_submitted || claim?.date_of_service || claim?.date_created;
    if (!anchor) return null;
    const anchorDate = new Date(anchor + (anchor?.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(anchorDate?.getTime())) return null;
    const diffMs = asOfDate?.getTime() - anchorDate?.getTime();
    if (diffMs < 0) return 0; // future-dated claim — treat as 0
    return Math.floor(diffMs / 86400000);
  };

  // ── Step 4: Group by payor ────────────────────────────────────────────────
  // null payor from normalizeClaim → "Unknown / Unmapped Payor"
  let unmappedCount = 0;
  const payorMap = {};

  for (const claim of activeClaims) {
    const rawPayor = claim?.payor; // null if unmapped
    const isUnmapped = rawPayor === null || rawPayor === undefined;

    if (isUnmapped) unmappedCount += 1;

    const normalizedKey = isUnmapped ? '__unmapped__' : rawPayor?.trim()?.toLowerCase();
    const displayName = isUnmapped ? 'Unknown / Unmapped Payor' : rawPayor?.trim();

    if (!payorMap?.[normalizedKey]) {
      payorMap[normalizedKey] = {
        payorName: displayName,
        _isUnmapped: isUnmapped,
        _openClaims: [],
        _paidClaims: [],
        _deniedClaims: [],
        _missingAmountCount: 0,
      };
    }

    const group = payorMap?.[normalizedKey];
    const isOpen = claim?.status !== 'paid' && claim?.status !== 'voided';
    const isPaid = claim?.status === 'paid';
    const isDenied = claim?.status === 'denied' || (claim?.denial_reason && claim?.denial_reason !== '—');

    if (isOpen) {
      group?._openClaims?.push(claim);
      // Track claims with missing billed/paid amounts as a data-quality signal
      if (claim?.amount_billed === null || claim?.amount_billed === undefined) {
        group._missingAmountCount += 1;
      }
    }
    if (isPaid) group?._paidClaims?.push(claim);
    if (isDenied) group?._deniedClaims?.push(claim);
  }

  // ── Step 5: Compute per-payor metrics ────────────────────────────────────
  const rows = Object.values(payorMap)?.map((group) => {
    const openClaims = group?._openClaims;
    const paidClaims = group?._paidClaims;
    const deniedClaims = group?._deniedClaims;

    let outstandingClaimsAmt = null;
    let arCurrent = null;
    let ar30_60 = null;
    let ar60_90 = null;
    let ar90plus = null;
    let claimsOver30 = 0;
    let claimsOver60 = 0;
    let claimsOver90 = 0;
    const validAgingDays = [];

    for (const claim of openClaims) {
      const billed = claim?.amount_billed; // null if missing (not 0)
      const paid = claim?.amount_paid;     // null if missing (not 0)
      const agingDays = computeAgingDays(claim);

      // Outstanding: null if billed is missing; use billed alone if paid is missing
      let outstanding = null;
      if (billed !== null && billed !== undefined) {
        const paidVal = (paid !== null && paid !== undefined) ? paid : 0;
        const diff = billed - paidVal;
        outstanding = diff < 0 ? 0 : diff; // no negative AR
      }
      // If billed is null → outstanding stays null (do not fake $0)

      if (outstanding !== null) {
        outstandingClaimsAmt = (outstandingClaimsAmt ?? 0) + outstanding;
      }

      // AR buckets — only if outstanding is not null and agingDays is valid
      if (outstanding !== null && agingDays !== null) {
        if (agingDays <= 30) {
          arCurrent = (arCurrent ?? 0) + outstanding;
        } else if (agingDays <= 60) {
          ar30_60 = (ar30_60 ?? 0) + outstanding;
        } else if (agingDays <= 90) {
          ar60_90 = (ar60_90 ?? 0) + outstanding;
        } else {
          ar90plus = (ar90plus ?? 0) + outstanding;
        }
      }

      if (agingDays !== null) {
        validAgingDays?.push(agingDays);
        if (agingDays > 30) claimsOver30 += 1;
        if (agingDays > 60) claimsOver60 += 1;
        if (agingDays > 90) claimsOver90 += 1;
      }
    }

    const avgClaimAge = validAgingDays?.length > 0
      ? Math.round(validAgingDays?.reduce((a, b) => a + b, 0) / validAgingDays?.length)
      : null;

    let paidAmt = null;
    for (const claim of paidClaims) {
      const p = claim?.amount_paid;
      if (p !== null && p !== undefined) {
        paidAmt = (paidAmt ?? 0) + p;
      }
    }

    return {
      payorName: group?.payorName,
      openClaimsCount: openClaims?.length,
      outstandingClaimsAmt,
      arCurrent,
      ar30_60,
      ar60_90,
      ar90plus,
      avgClaimAge,
      claimsOver30,
      claimsOver60,
      claimsOver90,
      deniedCount: deniedClaims?.length,
      paidCount: paidClaims?.length,
      paidAmt,
      missingAmountCount: group?._missingAmountCount ?? 0,
      source: 'Dentrix Ascend /v2/rcm/claims',
      _isUnmapped: group?._isUnmapped,
    };
  });

  // Sort by outstandingClaimsAmt descending (nulls last)
  rows?.sort((a, b) => {
    const av = a?.outstandingClaimsAmt ?? -1;
    const bv = b?.outstandingClaimsAmt ?? -1;
    return bv - av;
  });

  console.log(`[fetchPayorSummary] Payor groups: ${rows?.length} | Unmapped claims: ${unmappedCount}`);

  // Attach metadata for UI display
  rows._unmappedCount = unmappedCount;
  rows._asOfDate = arEnd;
  rows._lookbackStart = arStart;
  rows._totalRawRows = totalRawRows;
  rows._fetchErrors = fetchErrors;

  return rows;
};

export const exportClaimsCsv = (rows) => {
  const headers = ['Patient','Patient ID','Claim ID','Office','Payor','Date Created','Date Submitted','Date Received','Last Visit Date','Date of Service','Amount Billed','Amount Paid','Status'];
  const lines = [headers?.join(',')];
  rows?.forEach(r => {
    lines?.push([
      `"${r?.patient_name || ''}"`,
      `"${r?.patient_id || ''}"`,
      `"${r?.claim_id || ''}"`,
      `"${r?.office_name || ''}"`,
      `"${r?.payor || ''}"`,
      fmtDate(r?.date_created),
      fmtDate(r?.date_submitted),
      fmtDate(r?.date_received),
      fmtDate(r?.last_visit_date),
      fmtDate(r?.date_of_service),
      r?.amount_billed || 0,
      r?.amount_paid || 0,
      `"${r?.status || ''}"`,
    ]?.join(','));
  });
  return lines?.join('\n');
};

// ─── Payment Arrangements ────────────────────────────────────────────────────

/**
 * Normalize a raw Dentrix payment arrangement record.
 * NOTE: Dentrix Ascend may not expose a dedicated payment-arrangements endpoint.
 * If the API returns 404, the UI will surface a structured diagnostic instead
 * of silently showing zeros.
 */
const normalizePaymentArrangement = (raw, officeName, officeId) => {
  const id = raw?.arrangementId || raw?.arrangement_id || raw?.id || crypto.randomUUID();
  const arrangementAmount = parseFloat(raw?.arrangementAmount || raw?.arrangement_amount || raw?.totalAmount || 0) || 0;
  const amountPaid = parseFloat(raw?.amountPaid || raw?.amount_paid || raw?.paidAmount || 0) || 0;
  const remainingBalance = Math.max(0, arrangementAmount - amountPaid);

  return {
    id,
    patient_id: String(raw?.patientId || raw?.patient_id || ''),
    patient_name: raw?.patientName || raw?.patient_name || '—',
    office_id: officeId,
    office_name: officeName,
    arrangement_amount: arrangementAmount,
    amount_paid: amountPaid,
    remaining_balance: remainingBalance,
    due_date: raw?.dueDate || raw?.due_date || raw?.nextDueDate || null,
    status: normalizeArrangementStatus(raw?.status),
    created_at: raw?.createdDate || raw?.created_at || raw?.dateCreated || null,
    _source: 'dentrix_ascend',
  };
};

const normalizeArrangementStatus = (raw) => {
  if (!raw) return 'unknown';
  const s = String(raw)?.toLowerCase()?.trim();
  if (['active', 'open', 'in_progress', 'in progress']?.includes(s)) return 'active';
  if (['completed', 'paid', 'closed', 'fulfilled']?.includes(s)) return 'completed';
  if (['overdue', 'past_due', 'past due', 'delinquent']?.includes(s)) return 'overdue';
  if (['cancelled', 'canceled', 'voided', 'void']?.includes(s)) return 'cancelled';
  return s;
};

export const fetchPaymentArrangements = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    let records = [];
    let errors = [];

    if (officeId && locationId) {
      let raw = await ascendApi?.getPaymentArrangements(start, end, locationId);
      records = normalizeResponse(raw)?.map(r => normalizePaymentArrangement(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
    } else {
      const result = await fanOutFetch(
        officeId,
        (locId) => ascendApi?.getPaymentArrangements(start, end, locId),
        normalizePaymentArrangement
      );
      records = result?.records || result || [];
      errors = result?.errors || [];
    }

    // Deduplicate by id
    const seen = new Set();
    const deduped = records?.filter(r => { if (seen?.has(r?.id)) return false; seen?.add(r?.id); return true; });

    recordDiagnostic('payment_arrangements', {
      source: 'Dentrix Ascend /v2/rcm/payment-arrangements',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: records?.length,
      recordsAfterDedup: deduped?.length,
      durationMs: Date.now() - t0,
      errors: errors?.length > 0 ? errors : null,
      lastError: errors?.[0]?.error || null,
      note: 'If Dentrix does not expose this endpoint, a 404 error will appear above. This is expected and documented.',
    });

    return deduped;
  } catch (err) {
    recordDiagnostic('payment_arrangements', {
      source: 'Dentrix Ascend /v2/rcm/payment-arrangements',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      recordsAfterDedup: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
      note: 'Dentrix Ascend may not expose a dedicated payment-arrangements resource. Check API docs.',
    });
    throw err;
  }
};

// ─── Patient Statements ───────────────────────────────────────────────────────

const normalizePatientStatement = (raw, officeName, officeId) => {
  const id = raw?.statementId || raw?.statement_id || raw?.id || crypto.randomUUID();
  const statementDate = raw?.statementDate || raw?.statement_date || raw?.date || null;
  const balance = parseFloat(raw?.balance || raw?.patientBalance || raw?.amount || 0) || 0;

  // Calculate days outstanding from statement date to today
  let daysOutstanding = raw?.daysOutstanding || raw?.days_outstanding || null;
  if (daysOutstanding == null && statementDate) {
    const diff = (Date.now() - new Date(statementDate)?.getTime()) / (1000 * 60 * 60 * 24);
    daysOutstanding = isFinite(diff) ? Math.max(0, Math.round(diff)) : 0;
  }

  // Payment fields — pass through from backend; do not invent or default unknown values
  const paymentDate = raw?.payment_date || raw?.payment_datetime || null;
  const paymentAmount = (raw?.payment_amount !== undefined && raw?.payment_amount !== null)
    ? parseFloat(raw?.payment_amount)
    : null;
  const paymentMethod = raw?.payment_method || null;
  const paymentMethodLabel = raw?.payment_method_label || null;
  const paidAtVisit = raw?.paid_at_visit !== undefined ? raw?.paid_at_visit : null;
  const cardType = raw?.card_type || null;
  // masked_card_number is safe to display; never expose full card numbers
  const maskedCardNumber = raw?.masked_card_number || null;
  const checkNumber = raw?.check_number || null;

  return {
    id,
    patient_id: String(raw?.patientId || raw?.patient_id || ''),
    patient_name: raw?.patientName || raw?.patient_name || '—',
    office_id: officeId,
    office_name: officeName,
    statement_date: statementDate,
    balance,
    days_outstanding: daysOutstanding ?? 0,
    last_contact_date: raw?.lastContactDate || raw?.last_contact_date || null,
    status: normalizeStatementStatus(raw?.status),
    // New payment fields from backend
    payment_date: paymentDate,
    payment_amount: isNaN(paymentAmount) ? null : paymentAmount,
    payment_method: paymentMethod,
    payment_method_label: paymentMethodLabel,
    paid_at_visit: paidAtVisit,
    card_type: cardType,
    masked_card_number: maskedCardNumber,
    check_number: checkNumber,
    _source: 'dentrix_ascend',
  };
};

const normalizeStatementStatus = (raw) => {
  if (!raw) return 'open';
  const s = String(raw)?.toLowerCase()?.trim();
  if (['paid', 'closed', 'zero balance']?.includes(s)) return 'paid';
  if (['sent', 'mailed', 'emailed', 'delivered']?.includes(s)) return 'sent';
  if (['overdue', 'past_due', 'past due', 'delinquent']?.includes(s)) return 'overdue';
  if (['collections', 'in collections', 'collection']?.includes(s)) return 'collections';
  return 'open';
};

export const fetchPatientStatements = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    let records = [];
    let errors = [];

    if (officeId && locationId) {
      let raw = await ascendApi?.getPatientStatements(start, end, locationId);
      records = normalizeResponse(raw)?.map(r => normalizePatientStatement(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
    } else {
      const result = await fanOutFetch(
        officeId,
        (locId) => ascendApi?.getPatientStatements(start, end, locId),
        normalizePatientStatement
      );
      records = result?.records || result || [];
      errors = result?.errors || [];
    }

    const seen = new Set();
    const deduped = records?.filter(r => { if (seen?.has(r?.id)) return false; seen?.add(r?.id); return true; });

    recordDiagnostic('patient_statements', {
      source: 'Dentrix Ascend /v2/rcm/patient-statements',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: records?.length,
      recordsAfterDedup: deduped?.length,
      durationMs: Date.now() - t0,
      errors: errors?.length > 0 ? errors : null,
      lastError: errors?.[0]?.error || null,
    });

    return deduped;
  } catch (err) {
    recordDiagnostic('patient_statements', {
      source: 'Dentrix Ascend /v2/rcm/patient-statements',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      recordsAfterDedup: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Point of Service Collections ────────────────────────────────────────────

const normalizePosCollection = (raw, officeName, officeId) => {
  const id = raw?.collectionId || raw?.collection_id || raw?.id || crypto.randomUUID();
  const amountCollected = parseFloat(raw?.amountCollected || raw?.amount_collected || raw?.collectedAmount || 0) || 0;

  return {
    id,
    patient_id: String(raw?.patientId || raw?.patient_id || ''),
    patient_name: raw?.patientName || raw?.patient_name || '—',
    office_id: officeId,
    office_name: officeName,
    claim_id: raw?.claimId || raw?.claim_id || null,
    payment_date: raw?.payment_date || raw?.paymentDate || raw?.dateOfService || raw?.date_of_service || raw?.serviceDate || null,
    // Phase 2: true service date (not payment date)
    service_date: raw?.service_date || raw?.serviceDate || null,
    // Phase 2: enriched provider fields
    provider_id: raw?.providerId || raw?.provider_id || null,
    provider_name: raw?.provider_name || raw?.providerName || null,
    provider: raw?.providerName || raw?.provider_name || raw?.provider || '—',
    multi_provider: raw?.multi_provider ?? raw?.multiProvider ?? false,
    // Phase 2: enriched service/procedure fields
    ada_code: raw?.ada_code || raw?.adaCode || null,
    service_code: raw?.service_code || raw?.serviceCode || null,
    service_codes: Array.isArray(raw?.serviceCodes)
      ? raw?.serviceCodes?.join(', ')
      : (raw?.service_codes || raw?.serviceCodes || raw?.procedureCodes || null),
    procedure_description: raw?.procedure_description || raw?.procedureDescription || null,
    service_category: raw?.service_category || raw?.serviceCategory || null,
    line_of_business: raw?.lineOfBusiness || raw?.line_of_business || raw?.insuranceType || '—',
    // Phase 2: enriched payment method fields
    payment_method_label: raw?.payment_method_label || raw?.paymentMethodLabel || null,
    payment_method_detail: raw?.payment_method_detail || raw?.paymentMethodDetail || null,
    payment_method: raw?.payment_method || raw?.paymentMethod || null,
    is_pos_terminal: raw?.is_pos_terminal ?? raw?.isPosTerminal ?? false,
    is_auto_posted: raw?.is_auto_posted ?? raw?.isAutoPosted ?? false,
    is_ach_or_eft: raw?.is_ach_or_eft ?? raw?.isAchOrEft ?? false,
    auto_posted: raw?.auto_posted ?? raw?.autoPosted ?? false,
    // Phase 2: distribution fields
    distribution_count: raw?.distribution_count ?? raw?.distributionCount ?? null,
    has_multiple_distributions: raw?.has_multiple_distributions ?? raw?.hasMultipleDistributions ?? false,
    primary_applied_amount: raw?.primary_applied_amount != null ? parseFloat(raw?.primary_applied_amount) : null,
    distribution_total_applied_amount: raw?.distribution_total_applied_amount != null ? parseFloat(raw?.distribution_total_applied_amount) : null,
    procedure_amount: raw?.procedure_amount != null ? parseFloat(raw?.procedure_amount) : null,
    procedure_list_fee: raw?.procedure_list_fee != null ? parseFloat(raw?.procedure_list_fee) : null,
    // Core fields
    amount_collected: amountCollected,
    ledger_type: raw?.ledger_type || raw?.ledgerType || null,
    is_rebill: raw?.is_rebill || raw?.isRebill || false,
    paid_at_visit: raw?.paid_at_visit ?? raw?.paidAtVisit ?? null,
    source_transaction_id: raw?.source_transaction_id || raw?.sourceTransactionId || null,
    patient_payment_id: raw?.patient_payment_id || raw?.patientPaymentId || null,
    primary_charge_id: raw?.primary_charge_id || raw?.primaryChargeId || null,
    charge_id: raw?.charge_id || raw?.chargeId || null,
    // Phase 4: payment method model fields
    payment_method_group: raw?.payment_method_group || raw?.paymentMethodGroup || null,
    payment_channel: raw?.payment_channel || raw?.paymentChannel || null,
    payment_method_confidence: raw?.payment_method_confidence || raw?.paymentMethodConfidence || null,
    card_brand: raw?.card_brand || raw?.cardBrand || null,
    // Phase 4: provider/service fallback fields
    resolved_charge_id: raw?.resolved_charge_id || raw?.resolvedChargeId || null,
    resolved_distribution_index: raw?.resolved_distribution_index ?? raw?.resolvedDistributionIndex ?? null,
    primary_charge_is_adjustment: raw?.primary_charge_is_adjustment ?? raw?.primaryChargeIsAdjustment ?? null,
    unresolved_reason: raw?.unresolved_reason || raw?.unresolvedReason || null,
    enrichment_resolution_method: raw?.enrichment_resolution_method || raw?.enrichmentResolutionMethod || null,
    _source: 'dentrix_ascend',
  };
};

export const fetchPosCollections = async ({ start, end, officeId, page = 1, pageSize = 100 }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    let records = [];
    let errors = [];
    let pagination = {};
    let metadata = {};
    let summary = null;
    let _rawResponse = null;

    if (officeId && locationId) {
      // Single office — pass locationId to scope the request
      let raw = await ascendApi?.getPosCollections(start, end, locationId, page, pageSize);
      _rawResponse = raw;
      // V468 AUDIT: Log raw response shape
      console.info('[V468 AUDIT] /v2/rcm/pos-collections (single office) raw top-level keys:', raw ? Object.keys(raw) : 'null/undefined');
      if (raw?.summary) console.info('[V468 AUDIT] pos-collections raw.summary keys:', Object.keys(raw?.summary), 'values:', JSON.stringify(raw?.summary));
      if (raw?.metadata) console.info('[V468 AUDIT] pos-collections raw.metadata keys:', Object.keys(raw?.metadata));
      if (Array.isArray(raw?.data) && raw?.data?.length > 0) console.info('[V468 AUDIT] pos-collections raw.data[0] keys:', Object.keys(raw?.data?.[0]));
      if (Array.isArray(raw?.rows) && raw?.rows?.length > 0) console.info('[V468 AUDIT] pos-collections raw.rows[0] keys:', Object.keys(raw?.rows?.[0]));
      console.info('[V468 AUDIT] pos-collections full raw (truncated):', JSON.stringify(raw)?.slice(0, 3000));
      // Unwrap new response shape { data, pagination, metadata, summary } defensively
      if (raw && !Array.isArray(raw) && Array.isArray(raw?.data)) {
        pagination = raw?.pagination || {};
        metadata = raw?.metadata || {};
        summary = raw?.summary || null;
        records = raw?.data?.map(r => normalizePosCollection(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
      } else {
        records = normalizeResponse(raw)?.map(r => normalizePosCollection(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
      }
    } else {
      // All Offices — call once without locationId so backend returns full-scope
      // aggregated summary, pagination, and data in a single response.
      // Do NOT fan-out: fanOutFetch cannot extract summary from individual office responses.
      let raw = await ascendApi?.getPosCollections(start, end, null, page, pageSize);
      _rawResponse = raw;
      // V468 AUDIT: Log raw response shape
      console.info('[V468 AUDIT] /v2/rcm/pos-collections (All Offices) raw top-level keys:', raw ? Object.keys(raw) : 'null/undefined');
      if (raw?.summary) console.info('[V468 AUDIT] pos-collections raw.summary keys:', Object.keys(raw?.summary), 'values:', JSON.stringify(raw?.summary));
      if (raw?.metadata) console.info('[V468 AUDIT] pos-collections raw.metadata keys:', Object.keys(raw?.metadata));
      if (Array.isArray(raw?.data) && raw?.data?.length > 0) console.info('[V468 AUDIT] pos-collections raw.data[0] keys:', Object.keys(raw?.data?.[0]));
      if (Array.isArray(raw?.rows) && raw?.rows?.length > 0) console.info('[V468 AUDIT] pos-collections raw.rows[0] keys:', Object.keys(raw?.rows?.[0]));
      console.info('[V468 AUDIT] pos-collections full raw (truncated):', JSON.stringify(raw)?.slice(0, 3000));
      if (raw && !Array.isArray(raw) && Array.isArray(raw?.data)) {
        pagination = raw?.pagination || {};
        metadata = raw?.metadata || {};
        summary = raw?.summary || null;
        records = raw?.data?.map(r => normalizePosCollection(r, null, null));
      } else {
        // Fallback: legacy flat array response
        records = normalizeResponse(raw)?.map(r => normalizePosCollection(r, null, null));
      }
    }

    const seen = new Set();
    const deduped = records?.filter(r => { if (seen?.has(r?.id)) return false; seen?.add(r?.id); return true; });

    recordDiagnostic('pos_collections', {
      source: 'Dentrix Ascend /v2/rcm/pos-collections',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: records?.length,
      recordsAfterDedup: deduped?.length,
      durationMs: Date.now() - t0,
      errors: errors?.length > 0 ? errors : null,
      lastError: errors?.[0]?.error || null,
    });

    return { rows: deduped, pagination, metadata, summary, _rawResponse };
  } catch (err) {
    recordDiagnostic('pos_collections', {
      source: 'Dentrix Ascend /v2/rcm/pos-collections',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      recordsAfterDedup: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Adjustments ─────────────────────────────────────────────────────────────

/**
 * Adjustment type classification map.
 * Maps raw adjustment_type strings from Dentrix Ascend to canonical categories.
 */
export const ADJUSTMENT_TYPE_MAP = {
  'ppo_writeoff': 'PPO Write-Off',
  'ppo write-off': 'PPO Write-Off',
  'contractual_adjustment': 'Contractual Adjustment',
  'contractual adjustment': 'Contractual Adjustment',
  'insurance_writeoff': 'Insurance Write-Off',
  'insurance write-off': 'Insurance Write-Off',
  'write_off': 'Write-Off',
  'write-off': 'Write-Off',
  'writeoff': 'Write-Off',
  'charge_adjustment': 'Charge Adjustment',
  'charge adjustment': 'Charge Adjustment',
  'fee_correction': 'Charge Adjustment',
  'credit_adjustment': 'Credit Adjustment',
  'credit adjustment': 'Credit Adjustment',
  'unapplied_credit': 'Unapplied Credit',
  'unapplied credit': 'Unapplied Credit',
  'insurance_payment_adjustment': 'Insurance Payment Adjustment',
  'insurance payment adjustment': 'Insurance Payment Adjustment',
  'eob_adjustment': 'Insurance Payment Adjustment',
  'discount': 'Discount',
  'discount_plan': 'Discount Plan',
  'discount plan': 'Discount Plan',
  'courtesy_discount': 'Courtesy Discount',
  'refund': 'Refund',
  'refund_adjustment': 'Refund',
  'patient_refund': 'Patient Refund',
  'reversal': 'Reversal',
  'void': 'Void',
  'voided': 'Void',
  'deleted': 'Void',
  'reversed': 'Reversal',
  'overpayment': 'Overpayment Correction',
  'overpayment_correction': 'Overpayment Correction',
  'manual_adjustment': 'Manual Adjustment',
  'manual adjustment': 'Manual Adjustment',
  'ledger_adjustment': 'Ledger Adjustment',
  'ledger adjustment': 'Ledger Adjustment',
};

export const classifyAdjustmentType = (rawType) => {
  if (!rawType) return 'Unknown';
  const key = String(rawType)?.toLowerCase()?.trim();
  return ADJUSTMENT_TYPE_MAP?.[key] || rawType;
};

export const getExpectedAdjustmentSign = (adjustmentType) => {
  const canonical = classifyAdjustmentType(adjustmentType);
  const negativeTypes = [
    'PPO Write-Off', 'Write-Off', 'Contractual Adjustment', 'Insurance Write-Off',
    'Charge Adjustment', 'Discount', 'Discount Plan', 'Courtesy Discount',
    'Void', 'Reversal',
  ];
  const positiveTypes = [
    'Credit Adjustment', 'Unapplied Credit', 'Patient Refund', 'Refund',
    'Overpayment Correction',
  ];
  if (negativeTypes?.includes(canonical)) return 'negative';
  if (positiveTypes?.includes(canonical)) return 'positive';
  return 'either';
};

export const validateAdjustmentSign = (amount, adjustmentType) => {
  const n = parseFloat(amount);
  if (!isFinite(n) || isNaN(n)) return { valid: false, warning: 'Amount is not a valid number' };
  const expected = getExpectedAdjustmentSign(adjustmentType);
  if (expected === 'negative' && n > 0) {
    return { valid: true, warning: `Sign may be flipped: ${classifyAdjustmentType(adjustmentType)} should be negative, got ${n}` };
  }
  if (expected === 'positive' && n < 0) {
    return { valid: true, warning: `Sign may be flipped: ${classifyAdjustmentType(adjustmentType)} should be positive, got ${n}` };
  }
  return { valid: true, warning: null };
};

const normalizeAdjustment = (raw, officeName, officeId) => {
  const id = raw?.adjustmentId || raw?.adjustment_id || raw?.id || crypto.randomUUID();
  const rawType = raw?.adjustmentType || raw?.adjustment_type || raw?.type || '';
  const canonicalType = classifyAdjustmentType(rawType);
  const amount = parseFloat(raw?.amount || raw?.adjustmentAmount || raw?.adjustment_amount || 0) || 0;
  const signCheck = validateAdjustmentSign(amount, rawType);
  const isVoided = raw?.isVoided === true || raw?.is_voided === true
    || raw?.status === 'voided' || raw?.status === 'deleted'
    || canonicalType === 'Void';

  return {
    id,
    patient_id: String(raw?.patientId || raw?.patient_id || ''),
    patient_name: raw?.patientName || raw?.patient_name || '—',
    claim_id: raw?.claimId || raw?.claim_id || null,
    office_id: officeId,
    office_name: officeName,
    payor: raw?.payorName || raw?.payor || raw?.insuranceName || '—',
    adjustment_type: rawType,
    adjustment_type_canonical: canonicalType,
    adjustment_amount: amount,
    financial_amount: isVoided ? 0 : amount,
    adjustment_date: raw?.adjustmentDate || raw?.adjustment_date || raw?.date || raw?.postedDate || null,
    reason: raw?.reason || raw?.note || raw?.description || null,
    status: isVoided ? 'voided' : (raw?.status || 'posted'),
    is_voided: isVoided,
    sign_warning: signCheck?.warning || null,
    _source: 'dentrix_ascend',
  };
};

export const fetchAdjustments = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    let records = [];
    let errors = [];

    if (officeId && locationId) {
      let raw = await ascendApi?.getAdjustments(start, end, locationId);
      records = normalizeResponse(raw)?.map(r => normalizeAdjustment(r, OFFICE_MAP?.[officeId]?.name || '—', officeId));
    } else {
      const result = await fanOutFetch(
        officeId,
        (locId) => ascendApi?.getAdjustments(start, end, locId),
        normalizeAdjustment
      );
      records = result?.records || result || [];
      errors = result?.errors || [];
    }

    const seen = new Set();
    const deduped = records?.filter(r => { if (seen?.has(r?.id)) return false; seen?.add(r?.id); return true; });

    recordDiagnostic('adjustments', {
      source: 'Dentrix Ascend /v2/adjustments',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: records?.length,
      recordsAfterDedup: deduped?.length,
      durationMs: Date.now() - t0,
      errors: errors?.length > 0 ? errors : null,
      lastError: errors?.[0]?.error || null,
    });

    return deduped;
  } catch (err) {
    recordDiagnostic('adjustments', {
      source: 'Dentrix Ascend /v2/adjustments',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      recordsAfterDedup: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

/**
 * Normalize a single adjustment row from /v2/rcm/adjustments-review data[].
 * Maps both snake_case and camelCase variants from the new backend contract.
 */
const normalizeAdjustmentReviewRow = (raw) => {
  const id = raw?.adjustment_id || raw?.adjustmentId || raw?.id || crypto.randomUUID();
  return {
    id,
    adjustment_id: id,
    patient_name: raw?.patient_name || raw?.patientName || '—',
    office: raw?.office || raw?.office_name || raw?.officeName || '—',
    provider_name: raw?.provider_name || raw?.providerName || '—',
    organization_ledger_type_name: raw?.organization_ledger_type_name || raw?.olt_name || raw?.oltName || '—',
    adjustment_category: raw?.adjustment_category || raw?.adjustmentCategory || null,
    adjustment_category_label: raw?.adjustment_category_label || raw?.adjustmentCategoryLabel || raw?.adjustment_category || '—',
    signed_amount: parseFloat(raw?.signed_amount ?? raw?.signedAmount ?? raw?.amount ?? 0) || 0,
    financial_amount: parseFloat(raw?.financial_amount ?? raw?.financialAmount ?? raw?.signed_amount ?? raw?.amount ?? 0) || 0,
    transaction_date: raw?.transaction_date || raw?.transactionDate || null,
    entry_date: raw?.entry_date || raw?.entryDate || null,
    days_between_transaction_and_entry: raw?.days_between_transaction_and_entry ?? raw?.daysBetweenTransactionAndEntry ?? null,
    is_late_posted: raw?.is_late_posted ?? raw?.isLatePosted ?? false,
    online_user_name: raw?.online_user_name || raw?.onlineUserName || raw?.staff_entered_by || '—',
    approval_evidence_status: raw?.approval_evidence_status || raw?.approvalEvidenceStatus || null,
    approval_evidence_source: raw?.approval_evidence_source || raw?.approvalEvidenceSource || null,
    review_flags: raw?.review_flags || raw?.reviewFlags || [],
    review_flag_labels: raw?.review_flag_labels || raw?.reviewFlagLabels || [],
    note: raw?.note || raw?.reason || raw?.description || null,
    status: raw?.status || (raw?.is_voided ? 'voided' : 'active'),
    is_voided: raw?.is_voided ?? raw?.isVoided ?? false,
    previous_transaction_id: raw?.previous_transaction_id || raw?.previousTransactionId || null,
    replaced_by_transaction_id: raw?.replaced_by_transaction_id || raw?.replacedByTransactionId || null,
  };
};

/**
 * fetchAdjustmentsReview
 * Calls GET /v2/rcm/adjustments-review.
 * For All Offices: calls the endpoint ONCE with no locationId.
 * Does NOT use fanOutFetch.
 * Returns { rows, pagination, metadata, summary, reviewQueues }
 */
export const fetchAdjustmentsReview = async ({ start, end, officeId, page = 1, pageSize = 50, includeVoided = false, adjustmentCategory = null, reviewFlag = null }) => {
  const t0 = Date.now();
  // For All Offices (officeId = ''), pass null locationId — backend handles full scope
  const locationId = officeId ? resolveLocationId(officeId) : null;

  try {
    const raw = await ascendApi?.getAdjustmentsReview(
      start, end, locationId, page, pageSize, includeVoided, adjustmentCategory, reviewFlag
    );

    const rows = (Array.isArray(raw?.data) ? raw?.data : [])?.map(normalizeAdjustmentReviewRow);
    let pagination = raw?.pagination || {};
    let metadata = raw?.metadata || {};
    let summary = raw?.summary || {};
    const reviewQueues = raw?.review_queues || {};

    recordDiagnostic('adjustments_review', {
      source: 'Dentrix Ascend /v2/rcm/adjustments-review',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      locationId: locationId || 'none (All Offices)',
      page,
      pageSize,
      includeVoided,
      rowsFetched: rows?.length,
      totalRows: pagination?.total_rows,
      durationMs: Date.now() - t0,
    });

    return { rows, pagination, metadata, summary, reviewQueues };
  } catch (err) {
    recordDiagnostic('adjustments_review', {
      source: 'Dentrix Ascend /v2/rcm/adjustments-review',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      page,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Collection Refunds ───────────────────────────────────────────────────────

/**
 * Normalize a single refund row from the new envelope data[] array.
 * Preserves all backend fields; adds office_name for display.
 */
const normalizeCollectionRefundRow = (raw) => {
  return {
    id: raw?.id || raw?.refund_id || raw?.refundId || crypto.randomUUID(),
    patient_id: raw?.patient_id || raw?.patientId || '',
    patient_name: raw?.patient_name || raw?.patientName || '—',
    office_id: raw?.office_id || null,
    office: raw?.office || null,
    location_id: raw?.location_id || null,
    refund_date: raw?.refund_date || raw?.refundDate || raw?.date || null,
    date_basis: raw?.date_basis || null,
    refund_amount: parseFloat(raw?.refund_amount || raw?.refundAmount || raw?.amount || 0) || 0,
    refund_amount_signed: raw?.refund_amount_signed ?? null,
    refund_type: raw?.refund_type || null,
    refund_type_label: raw?.refund_type_label || raw?.refund_type || null,
    is_true_refund: raw?.is_true_refund ?? null,
    is_patient_refund: raw?.is_patient_refund ?? null,
    is_insurance_refund: raw?.is_insurance_refund ?? null,
    is_credit_card_refund: raw?.is_credit_card_refund ?? null,
    is_non_refund_adjustment: raw?.is_non_refund_adjustment ?? false,
    non_refund_adjustment_type: raw?.non_refund_adjustment_type || null,
    ledger_type: raw?.ledger_type || null,
    organization_ledger_type_id: raw?.organization_ledger_type_id || null,
    organization_ledger_type_name: raw?.organization_ledger_type_name || null,
    reason: raw?.reason || raw?.note || raw?.description || null,
    note: raw?.note || null,
    status: raw?.status || null,
    is_active: raw?.is_active ?? null,
    is_voided_or_cancelled: raw?.is_voided_or_cancelled ?? null,
    provider_id: raw?.provider_id || null,
    provider_name: raw?.provider_name || null,
    entered_by_user_id: raw?.entered_by_user_id || null,
    entered_by_name: raw?.entered_by_name || null,
    insurance_payment_id: raw?.insurance_payment_id || null,
    is_automatically_posted: raw?.is_automatically_posted ?? null,
    claim_id: raw?.claim_id || raw?.claimId || null,
    payor: raw?.payor || null,
    payment_method: raw?.payment_method || null,
    source_note: raw?.source_note || null,
    _source: 'dentrix_ascend',
  };
};

/**
 * fetchCollectionRefunds — calls GET /v2/rcm/collection-refunds
 * Returns { data, summary, pagination, metadata, _source }
 *
 * For All Offices: calls once with no officeId/locationId (backend aggregates).
 * For a selected office: passes officeId (UUID) — NOT locationId.
 */
export const fetchCollectionRefunds = async ({
  start,
  end,
  officeId = null,
  refundType = 'all',
  includeNonRefundAdjustments = false,
  minAmount = null,
  search = null,
  page = 1,
  pageSize = 50,
} = {}) => {
  const t0 = Date.now();

  try {
    const params = {
      startDate: start,
      endDate: end,
      refundType,
      includeNonRefundAdjustments,
      minAmount,
      search,
      page,
      pageSize,
    };

    // Pass officeId UUID only when a specific office is selected
    if (officeId) {
      params.officeId = officeId;
    }

    const envelope = await ascendApi?.getCollectionRefunds(params);

    // V468 AUDIT: Log raw response shape
    console.info('[V468 AUDIT] /v2/rcm/collection-refunds raw top-level keys:', envelope ? Object.keys(envelope) : 'null/undefined');
    if (envelope?.summary) console.info('[V468 AUDIT] collection-refunds raw.summary keys:', Object.keys(envelope?.summary), 'values:', JSON.stringify(envelope?.summary));
    if (envelope?.metadata) console.info('[V468 AUDIT] collection-refunds raw.metadata keys:', Object.keys(envelope?.metadata));
    if (Array.isArray(envelope?.data) && envelope?.data?.length > 0) console.info('[V468 AUDIT] collection-refunds raw.data[0] keys:', Object.keys(envelope?.data?.[0]));
    console.info('[V468 AUDIT] collection-refunds full raw (truncated):', JSON.stringify(envelope)?.slice(0, 3000));

    // Normalize data rows
    const rawData = Array.isArray(envelope?.data) ? envelope?.data : [];
    const data = rawData?.map(normalizeCollectionRefundRow);

    let summary = envelope?.summary || {};
    let pagination = envelope?.pagination || { page, page_size: pageSize, total_count: data?.length, total_pages: 1 };
    let metadata = envelope?.metadata || {};
    const _source = envelope?._source || 'dentrix_ascend/adjustments';

    recordDiagnostic('collection_refunds', {
      source: 'Dentrix Ascend /v2/rcm/collection-refunds',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      rowsFetched: data?.length,
      totalCount: pagination?.total_count,
      durationMs: Date.now() - t0,
    });

    return { data, summary, pagination, metadata, _source, _rawResponse: envelope };
  } catch (err) {
    recordDiagnostic('collection_refunds', {
      source: 'Dentrix Ascend /v2/rcm/collection-refunds',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      rowsFetched: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

/**
 * Fetch RCM dashboard KPIs from Dentrix Ascend.
 *
 * Strategy:
 *  1. Try the dedicated /v2/rcm/dashboard endpoint first (most efficient).
 *  2. If that fails (404 / not available), fall back to computing KPIs from
 *     the claims endpoint so the dashboard is never empty when claims data exists.
 */
export const fetchRcmDashboardKpis = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  try {
    // ── Attempt 1: dedicated dashboard endpoint ──────────────────────────────
    let dashboardRaw = null;
    try {
      dashboardRaw = await ascendApi?.getRcmDashboard(start, end, locationId);
    } catch (dashErr) {
      // 404 or not available — fall through to claims-based computation
      console.warn('[RCM Dashboard] Dedicated endpoint unavailable, falling back to claims:', dashErr?.message);
    }

    if (dashboardRaw && (dashboardRaw?.totalClaimsSubmitted != null || dashboardRaw?.total_claims_submitted != null)) {
      // Use the dedicated dashboard response
      const d = dashboardRaw;

      // ── Also fetch individual claims so allClaims-dependent components
      //    (bottom table, trend chart) have data even when Path A is active. ──
      let claimsRows = [];
      try {
        const claimsResult = await fetchClaims({ start, end, officeId });
        claimsRows = claimsResult || [];
      } catch (claimsErr) {
        console.warn('[RCM Dashboard] Path A: secondary claims fetch failed:', claimsErr?.message);
      }

      const byOfficeRaw = d?.byOffice || d?.by_office || [];
      const byOffice = byOfficeRaw?.map(o => {
        // Broaden office identifier candidates — check every known field name
        // the backend might use for the Dentrix locationId or Supabase office UUID.
        const rawLocationId =
          o?.locationId ||
          o?.location_id ||
          o?.dentrix_location_id ||
          o?.dentrixLocationId ||
          null;

        const rawOfficeId =
          o?.officeId ||
          o?.office_id ||
          o?.id ||
          o?.location ||
          null;

        // Prefer resolving via Dentrix locationId → Supabase UUID.
        // Fall back to rawOfficeId if locationId lookup returns null.
        const resolvedOfficeId =
          (rawLocationId ? locationIdToOfficeId(rawLocationId) : null) ||
          rawOfficeId ||
          null;

        return {
          office_id: resolvedOfficeId,
          submitted: parseInt(o?.submitted || o?.claimsSubmitted || 0) || 0,
          paid: parseInt(o?.paid || o?.claimsPaid || 0) || 0,
          billed: parseFloat(o?.billed || o?.amountBilled || 0) || 0,
          collected: parseFloat(o?.collected || o?.amountCollected || 0) || 0,
        };
      });

      // ── Safe fallback calculations — only when the dashboard aggregate is
      //    null/undefined/missing, NOT when the backend explicitly returns 0. ──
      const dashOutstandingAR = d?.totalOutstandingAR ?? d?.total_outstanding_ar ?? null;
      const dashCollectionRate = d?.collectionRate ?? d?.collection_rate ?? null;
      const dashAvgDays = d?.avgDaysToPayment ?? d?.avg_days_to_payment ?? null;
      const dashDenialRate = d?.denialRate ?? d?.denial_rate ?? null;

      // Compute from allClaims only when needed
      let computedOutstandingAR = null;
      let computedCollectionRate = null;
      let computedAvgDays = null;
      let computedDenialRate = null;

      if (claimsRows?.length > 0) {
        if (dashOutstandingAR === null || dashOutstandingAR === undefined) {
          computedOutstandingAR = claimsRows
            ?.filter(r => r?.status !== 'paid')
            ?.reduce((sum, r) => sum + Math.max(0, (r?.amount_billed || 0) - (r?.amount_paid || 0)), 0);
        }

        if (dashCollectionRate === null || dashCollectionRate === undefined) {
          const totalBilled = claimsRows?.reduce((sum, r) => sum + (r?.amount_billed || 0), 0);
          const totalAmountPaid = claimsRows?.reduce((sum, r) => sum + (r?.amount_paid || 0), 0);
          computedCollectionRate = safeDivide(totalAmountPaid, totalBilled) * 100;
        }

        if (dashAvgDays === null || dashAvgDays === undefined) {
          const paidRows = claimsRows?.filter(r => r?.status === 'paid' && r?.date_submitted && r?.date_received);
          if (paidRows?.length > 0) {
            const totalDiff = paidRows?.reduce((sum, r) => {
              const diff = (new Date(r.date_received) - new Date(r.date_submitted)) / (1000 * 60 * 60 * 24);
              return sum + (isFinite(diff) ? diff : 0);
            }, 0);
            computedAvgDays = totalDiff / paidRows?.length;
          } else {
            computedAvgDays = 0;
          }
        }

        if (dashDenialRate === null || dashDenialRate === undefined) {
          const totalDenied = claimsRows?.filter(r => r?.status === 'denied')?.length;
          computedDenialRate = safeDivide(totalDenied, claimsRows?.length) * 100;
        }
      }

      recordDiagnostic('dashboard', {
        source: 'Dentrix Ascend /v2/rcm/dashboard',
        dateRange: `${start} – ${end}`,
        officeFilter: officeId || 'All Offices',
        durationMs: Date.now() - t0,
        claimsSecondaryFetch: claimsRows?.length,
        lastError: null,
      });

      return {
        totalSubmitted: parseInt(d?.totalClaimsSubmitted || d?.total_claims_submitted || 0) || 0,
        totalPaid: parseInt(d?.totalClaimsPaid || d?.total_claims_paid || 0) || 0,
        // Use real backend value when present (including explicit 0); fall back to computed only when null/missing
        outstandingAR: dashOutstandingAR !== null && dashOutstandingAR !== undefined
          ? parseFloat(dashOutstandingAR) || 0
          : (computedOutstandingAR ?? 0),
        avgDays: dashAvgDays !== null && dashAvgDays !== undefined
          ? (isFinite(parseFloat(dashAvgDays)) ? Math.round(parseFloat(dashAvgDays)) : 0)
          : (isFinite(computedAvgDays) ? Math.round(computedAvgDays) : 0),
        collectionRate: dashCollectionRate !== null && dashCollectionRate !== undefined
          ? (isFinite(parseFloat(dashCollectionRate)) ? parseFloat(dashCollectionRate) : 0)
          : (isFinite(computedCollectionRate) ? computedCollectionRate : 0),
        denialRate: dashDenialRate !== null && dashDenialRate !== undefined
          ? (isFinite(parseFloat(dashDenialRate)) ? parseFloat(dashDenialRate) : 0)
          : (isFinite(computedDenialRate) ? computedDenialRate : 0),
        byOffice,
        allClaims: claimsRows,
      };
    }

    // ── Fallback: compute from claims ────────────────────────────────────────
    const claims = await fetchClaims({ start, end, officeId });
    const rows = claims || [];

    const totalSubmitted = rows?.length;
    const totalPaid = rows?.filter(r => r?.status === 'paid')?.length;
    const totalDenied = rows?.filter(r => r?.status === 'denied')?.length;
    const outstandingAR = rows
      ?.filter(r => r?.status !== 'paid')
      ?.reduce((sum, r) => sum + Math.max(0, (r?.amount_billed || 0) - (r?.amount_paid || 0)), 0);
    const totalBilled = rows?.reduce((sum, r) => sum + (r?.amount_billed || 0), 0);
    const totalAmountPaid = rows?.reduce((sum, r) => sum + (r?.amount_paid || 0), 0);
    const collectionRate = safeDivide(totalAmountPaid, totalBilled) * 100;
    const denialRate = safeDivide(totalDenied, totalSubmitted) * 100;

    const paidRows = rows?.filter(r => r?.status === 'paid' && r?.date_submitted && r?.date_received);
    const avgDays = paidRows?.length > 0
      ? paidRows?.reduce((sum, r) => {
          const diff = (new Date(r.date_received) - new Date(r.date_submitted)) / (1000 * 60 * 60 * 24);
          return sum + (isFinite(diff) ? diff : 0);
        }, 0) / paidRows?.length
      : 0;

    const byOffice = {};
    rows?.forEach(r => {
      const key = r?.office_id || 'unknown';
      if (!byOffice?.[key]) byOffice[key] = { office_id: key, submitted: 0, paid: 0, billed: 0, collected: 0 };
      byOffice[key].submitted += 1;
      if (r?.status === 'paid') byOffice[key].paid += 1;
      byOffice[key].billed += r?.amount_billed || 0;
      byOffice[key].collected += r?.amount_paid || 0;
    });

    recordDiagnostic('dashboard', {
      source: 'Dentrix Ascend /v2/rcm/claims (fallback computation)',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: rows?.length,
      durationMs: Date.now() - t0,
      lastError: null,
      note: 'Dedicated /v2/rcm/dashboard endpoint not available; KPIs computed from claims data.',
    });

    return {
      totalSubmitted,
      totalPaid,
      outstandingAR,
      avgDays: isFinite(avgDays) ? Math.round(avgDays) : 0,
      collectionRate: isFinite(collectionRate) ? collectionRate : 0,
      denialRate: isFinite(denialRate) ? denialRate : 0,
      byOffice: Object.values(byOffice),
      allClaims: rows,
    };
  } catch (err) {
    recordDiagnostic('dashboard', {
      source: 'Dentrix Ascend /v2/rcm/dashboard + /v2/rcm/claims',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      recordsFetched: 0,
      durationMs: Date.now() - t0,
      lastError: err?.message,
    });
    throw err;
  }
};

// ─── AR Aging ─────────────────────────────────────────────────────────────────

/**
 * Classify days outstanding into the exact AR aging buckets:
 *   Current = 0–29 days
 *   30      = 30–59 days
 *   60      = 60–89 days
 *   90+     = 90 days and older
 *
 * @param {number} days
 * @returns {'current'|'b30'|'b60'|'b90'}
 */
const classifyAgingBucket = (days) => {
  if (days < 30)  return 'current';
  if (days < 60)  return 'b30';
  if (days < 90)  return 'b60';
  return 'b90';
};

/**
 * Compute the aging date from a raw Dentrix AR record.
 *
 * Priority order (per spec):
 *  1. explicit balance aging date from Dentrix if available
 *  2. due date / statement date if Dentrix exposes that as the aging basis
 *  3. oldest unpaid patient-responsibility date
 *  4. date of service / claim posting date for unpaid patient balance
 *  5. never use sync timestamp as aging basis
 *
 * @param {object} raw - raw Dentrix AR record
 * @returns {string|null} ISO date string or null
 */
const resolveAgingDate = (raw) => {
  return (
    raw?.balanceAgingDate ||
    raw?.balance_aging_date ||
    raw?.agingDate ||
    raw?.aging_date ||
    raw?.dueDate ||
    raw?.due_date ||
    raw?.statementDate ||
    raw?.statement_date ||
    raw?.oldestUnpaidDate ||
    raw?.oldest_unpaid_date ||
    raw?.dateOfService ||
    raw?.date_of_service ||
    raw?.serviceDate ||
    raw?.service_date ||
    raw?.claimDate ||
    raw?.claim_date ||
    null
  );
};

/**
 * Normalize a raw Dentrix AR aging record into the stable dashboard schema.
 *
 * Balance logic:
 *   Net outstanding = charges - payments - credits - refunds - applicable adjustments
 *
 * Exclusions (applied here):
 *   - fully paid items (balance <= 0)
 *   - zero balance records
 *   - voided items (unless explicitly toggled on — not supported in v1)
 *
 * Bucket amounts are computed from the single balance value when Dentrix does
 * not return pre-bucketed amounts. The entire balance is assigned to the bucket
 * matching the record's days outstanding.
 *
 * @param {object} raw - raw Dentrix record
 * @param {string} officeName - canonical office display name
 * @param {string} officeId - Supabase office UUID
 * @returns {object} normalized AR aging record
 */
const normalizeArAgingRecord = (raw, officeName, officeId) => {
  const id = raw?.arId || raw?.ar_id || raw?.patientId || raw?.patient_id || raw?.id || crypto.randomUUID();

  // Compute net balance
  const charges    = parseFloat(raw?.charges    || raw?.totalCharges    || raw?.amountBilled    || 0) || 0;
  const payments   = parseFloat(raw?.payments   || raw?.totalPayments   || raw?.amountPaid      || 0) || 0;
  const credits    = parseFloat(raw?.credits    || raw?.totalCredits    || 0) || 0;
  const refunds    = parseFloat(raw?.refunds    || raw?.totalRefunds    || 0) || 0;
  const adjustments = parseFloat(raw?.adjustments || raw?.totalAdjustments || raw?.writeOffs || 0) || 0;

  // Use explicit balance if provided, otherwise compute
  const balance = parseFloat(
    raw?.patientBalance ??
    raw?.patient_balance ??
    raw?.outstandingBalance ??
    raw?.outstanding_balance ??
    raw?.balance ??
    (charges - payments - credits - refunds - adjustments)
  ) || 0;

  // Skip fully paid / zero balance records
  if (balance <= 0) return null;

  // Determine aging date
  const agingDateStr = resolveAgingDate(raw);
  const asOfDate     = new Date();
  let daysOutstanding = 0;

  if (agingDateStr) {
    const agingDate = new Date(agingDateStr + (agingDateStr.includes('T') ? '' : 'T00:00:00'));
    if (!isNaN(agingDate?.getTime())) {
      daysOutstanding = Math.max(0, Math.round((asOfDate - agingDate) / (1000 * 60 * 60 * 24)));
    }
  } else if (raw?.daysOutstanding != null) {
    daysOutstanding = Math.max(0, parseInt(raw?.daysOutstanding, 10) || 0);
  } else if (raw?.days_outstanding != null) {
    daysOutstanding = Math.max(0, parseInt(raw?.days_outstanding, 10) || 0);
  }

  const agingBucket = classifyAgingBucket(daysOutstanding);

  // Bucket amounts: use pre-bucketed values if Dentrix provides them,
  // otherwise assign the full balance to the appropriate bucket.
  const preBucketCurrent = parseFloat(raw?.bucketCurrent ?? raw?.bucket_current ?? raw?.current ?? -1);
  const preBucket30      = parseFloat(raw?.bucket30      ?? raw?.bucket_30      ?? raw?.days30  ?? -1);
  const preBucket60      = parseFloat(raw?.bucket60      ?? raw?.bucket_60      ?? raw?.days60  ?? -1);
  const preBucket90      = parseFloat(raw?.bucket90      ?? raw?.bucket_90      ?? raw?.days90plus ?? raw?.days90 ?? -1);

  const hasBuckets = preBucketCurrent >= 0 && preBucket30 >= 0 && preBucket60 >= 0 && preBucket90 >= 0;

  const bucketCurrent = hasBuckets ? preBucketCurrent : (agingBucket === 'current' ? balance : 0);
  const bucket30      = hasBuckets ? preBucket30      : (agingBucket === 'b30'     ? balance : 0);
  const bucket60      = hasBuckets ? preBucket60      : (agingBucket === 'b60'     ? balance : 0);
  const bucket90      = hasBuckets ? preBucket90      : (agingBucket === 'b90'     ? balance : 0);

  return {
    id: String(id),
    patient_id:           String(raw?.patientId    || raw?.patient_id    || ''),
    patient_name:         raw?.patientName         || raw?.patient_name  || raw?.patientFullName || '—',
    responsible_party:    raw?.responsibleParty    || raw?.responsible_party || raw?.guarantor || null,
    office_id:            officeId,
    office_name:          officeName,
    claim_id:             String(raw?.claimId      || raw?.claim_id      || raw?.id || ''),
    provider_id:          raw?.providerId          || raw?.provider_id   || null,
    provider:             raw?.providerName        || raw?.provider_name || raw?.provider || null,
    provider_name:        raw?.providerName        || raw?.provider_name || raw?.provider || null,
    payor:                raw?.payorName           || raw?.payor_name    || raw?.payor    || raw?.insuranceName || null,
    payor_name:           raw?.payorName           || raw?.payor_name    || raw?.payor    || raw?.insuranceName || null,
    plan_name:            raw?.planName            || raw?.plan_name     || raw?.insurancePlan || raw?.benefitPlan || null,
    date_of_service:      raw?.dateOfService       || raw?.date_of_service || raw?.serviceDate || null,
    last_statement_date:  raw?.lastStatementDate   || raw?.last_statement_date || raw?.statementDate || null,
    last_payment_date:    raw?.lastPaymentDate     || raw?.last_payment_date || null,
    last_payment_amount:  parseFloat(raw?.lastPaymentAmount || raw?.last_payment_amount || raw?.lastPayment) || null,
    balance,
    bucket_current:       bucketCurrent,
    bucket_30:            bucket30,
    bucket_60:            bucket60,
    bucket_90:            bucket90,
    days_outstanding:     daysOutstanding,
    aging_bucket:         agingBucket,
    collection_status:    raw?.collectionStatus    || raw?.collection_status || null,
    claim_followup_action: raw?.claimFollowupAction || raw?.claim_followup_action || raw?.followupAction || raw?.followup_action || null,
    payment_arrangement:  raw?.paymentArrangement  || raw?.payment_arrangement || null,
    last_contact_date:    raw?.lastContactDate     || raw?.last_contact_date || null,
    notes:                raw?.notes               || null,
    _aging_date_source:   agingDateStr ? 'dentrix_field' : (raw?.daysOutstanding != null ? 'dentrix_days' : 'computed'),
    _source:              'dentrix_ascend',
    _raw_location_id:     raw?.locationId          || raw?.location_id || null,
  };
};

/**
 * Fetch AR Aging data from Dentrix Ascend.
 *
 * Architecture:
 *  1. Calls /v2/rcm/ar-aging (dedicated endpoint) if available.
 *  2. Falls back to /v2/rcm/patient-statements for balance/aging data if the
 *     dedicated endpoint returns 404.
 *  3. Falls back to /v2/rcm/claims for unpaid claim balances as a last resort.
 *
 * Each fallback is documented in the diagnostic record so Super Admin can see
 * exactly which source was used.
 *
 * @param {{ start: string, end: string, officeId: string }} params
 * @returns {Promise<Array>} normalized AR aging records (balance > 0 only)
 */
export const fetchArAging = async ({ start, end, officeId }) => {
  const t0 = Date.now();

  try {
    let records = [];
    let errors  = [];
    let sourceUsed = 'Dentrix Ascend /v2/rcm/ar-aging';

    // ── Attempt 1: dedicated AR aging endpoint ──────────────────────────────
    // V466 fix: For All Offices, call /v2/rcm/ar-aging ONCE without locationId.
    // Do NOT fan out across all 4 offices — the endpoint supports All Offices
    // natively when no locationId is passed. Fan-out caused "Failed to fetch"
    // noise and blocked fast sections behind slow queued requests.
    try {
      if (officeId) {
        // Single office: resolve UUID → Dentrix locationId
        const locationId = resolveLocationId(officeId);
        let raw = await ascendApi?.getArAging(start, end, locationId);
        records = normalizeResponse(raw)
          ?.map(r => normalizeArAgingRecord(r, OFFICE_MAP?.[officeId]?.name || '—', officeId))
          ?.filter(Boolean);
      } else {
        // All Offices: single call without locationId — backend handles aggregation
        let raw = await ascendApi?.getArAging(start, end, null);
        records = normalizeResponse(raw)
          ?.map(r => normalizeArAgingRecord(r, r?.office_name || r?.officeName || '—', null))
          ?.filter(Boolean);
      }
    } catch (primaryErr) {
      // ── Attempt 2: patient statements fallback ────────────────────────────
      console.warn('[AR Aging] Primary endpoint unavailable, falling back to patient-statements:', primaryErr?.message);
      sourceUsed = 'Dentrix Ascend /v2/rcm/patient-statements (fallback — ar-aging endpoint unavailable)';

      try {
        if (officeId) {
          const locationId = resolveLocationId(officeId);
          let raw = await ascendApi?.getPatientStatements(start, end, locationId);
          records = normalizeResponse(raw)
            ?.map(r => normalizeArAgingRecord(r, OFFICE_MAP?.[officeId]?.name || '—', officeId))
            ?.filter(Boolean);
        } else {
          // All Offices fallback: single call without locationId
          let raw = await ascendApi?.getPatientStatements(start, end, null);
          records = normalizeResponse(raw)
            ?.map(r => normalizeArAgingRecord(r, r?.office_name || r?.officeName || '—', null))
            ?.filter(Boolean);
        }
      } catch (fallback1Err) {
        // ── Attempt 3: claims fallback ──────────────────────────────────────
        console.warn('[AR Aging] Patient-statements fallback failed, falling back to claims:', fallback1Err?.message);
        sourceUsed = 'Dentrix Ascend /v2/rcm/claims (fallback — ar-aging and patient-statements unavailable)';

        if (officeId) {
          const locationId = resolveLocationId(officeId);
          let raw = await ascendApi?.getClaims(start, end, locationId);
          records = normalizeResponse(raw)
            ?.filter(r => {
              const status = String(r?.status || '')?.toLowerCase();
              return !['paid', 'closed', 'finalized', 'voided', 'void']?.includes(status);
            })
            ?.map(r => normalizeArAgingRecord(r, OFFICE_MAP?.[officeId]?.name || '—', officeId))
            ?.filter(Boolean);
        } else {
          // All Offices claims fallback: single call without locationId
          let raw = await ascendApi?.getClaims(start, end, null);
          const allRecords = normalizeResponse(raw)
            ?.filter(r => {
              const status = String(r?.status || '')?.toLowerCase();
              return !['paid', 'closed', 'finalized', 'voided', 'void']?.includes(status);
            })
            ?.map(r => normalizeArAgingRecord(r, r?.office_name || r?.officeName || '—', null))
            ?.filter(Boolean);
          records = (allRecords || [])?.filter(r => r !== null && (r?.balance || 0) > 0);
        }
      }
    }

    // Deduplicate: prefer record with highest balance when same patient+claim appears
    const seen = new Map();
    records?.forEach(r => {
      const key = `${r?.patient_id}::${r?.claim_id}`;
      const existing = seen?.get(key);
      if (!existing || (r?.balance || 0) > (existing?.balance || 0)) {
        seen?.set(key, r);
      }
    });
    const deduped = Array.from(seen?.values());

    recordDiagnostic('ar_aging', {
      source:             sourceUsed,
      dateRange:          `${start} – ${end}`,
      officeFilter:       officeId || 'All Offices',
      recordsFetched:     records?.length,
      recordsAfterDedup:  deduped?.length,
      recordsExcluded:    records?.length - deduped?.length,
      durationMs:         Date.now() - t0,
      errors:             errors?.length > 0 ? errors : null,
      lastError:          errors?.[0]?.error || null,
      note: 'V466: All Offices uses single /v2/rcm/ar-aging call without locationId. Zero-balance and fully-paid records are excluded. Voided records excluded by default.',
    });

    return deduped;
  } catch (err) {
    recordDiagnostic('ar_aging', {
      source:            'Dentrix Ascend /v2/rcm/ar-aging (all fallbacks failed)',
      dateRange:         `${start} – ${end}`,
      officeFilter:      officeId || 'All Offices',
      recordsFetched:    0,
      recordsAfterDedup: 0,
      durationMs:        Date.now() - t0,
      lastError:         err?.message,
    });
    throw err;
  }
};

// ─── Generic CSV export ───────────────────────────────────────────────────────

export const downloadCsv = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a?.click();
  URL.revokeObjectURL(url);
};

export const rowsToCsv = (rows, columns) => {
  const headers = columns?.map(c => c?.label);
  const lines = [headers?.join(',')];
  rows?.forEach(r => {
    lines?.push(columns?.map(c => `"${(r?.[c?.key] ?? '')}"`)?.join(','));
  });
  return lines?.join('\n');
};

// ─── Guarantor / Patient Portion Reconciliation ───────────────────────────────

/**
 * fetchGuarantorReconciliation
 * Calls GET /v2/rcm/guarantor-reconciliation with query params.
 * Returns { data: [], scorecard: {}, total_count: N }.
 *
 * April 2026 full backfill complete: 4 offices · 1,000 claims · 2,962 procedure rows.
 * Patient names are returned by this endpoint.
 *
 * All Offices mode: omits location_id — backend returns merged all-office data,
 * scorecard, and meta.total in a single response.
 * Single-office mode: passes location_id as usual.
 */
export const fetchGuarantorReconciliation = async ({
  startDate,
  endDate,
  officeId,
  minDaysOutstanding = 0,
  onlyBalanceDue = false,
  excludeZeroPortion = true,
  includePredeterminations = false,
  page = 1,
  pageSize = 100,
} = {}) => {
  const t0 = Date.now();
  const locationId = resolveLocationId(officeId);

  const buildUrl = (locId) => {
    const API_BASE = 'https://api.nudashboard.com/v2';
    let url = `${API_BASE}/rcm/guarantor-reconciliation?page=${page}&page_size=${pageSize}`;
    if (startDate)              url += `&start_date=${startDate}`;
    if (endDate)                url += `&end_date=${endDate}`;
    if (locId)                  url += `&location_id=${locId}`;
        if (minDaysOutstanding !== null && minDaysOutstanding !== undefined && minDaysOutstanding !== '') url += `&min_days_outstanding=${minDaysOutstanding}`;
    if (onlyBalanceDue)         url += `&only_balance_due=true`;
    url += `&exclude_zero_portion=${excludeZeroPortion}`;
    url += `&include_predeterminations=${includePredeterminations}`;
    return url;
  };

  const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';
  const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

  const safeFetchJson = async (url) => {
    const res = await fetch(url, { headers });
    if (!res?.ok) throw new Error(`Guarantor reconciliation API error: ${res.status}`);
    return res?.json();
  };

  try {
    // Single call for both All Offices (no locationId) and single-office (with locationId).
    // When locationId is falsy, buildUrl omits location_id and the backend returns
    // all-office data, scorecard, and meta.total in one response.
    const raw = await safeFetchJson(buildUrl(locationId || ''));

    const data        = raw?.data || [];
    const scorecard   = raw?.scorecard || null;
    const total_count = raw?.meta?.total ?? raw?.total_count ?? raw?.totalCount ?? data?.length;

    recordDiagnostic('guarantor_reconciliation', {
      source: '/v2/rcm/guarantor-reconciliation',
      durationMs: Date.now() - t0,
      rowCount: data?.length,
      metaTotal: total_count,
      locationId: locationId || 'all',
    });

    return { data, scorecard, total_count };
  } catch (err) {
    recordDiagnostic('guarantor_reconciliation', {
      source: '/v2/rcm/guarantor-reconciliation',
      durationMs: Date.now() - t0,
      error: err?.message,
    });
    throw err;
  }
};

// ─── Percentile rank helper ───────────────────────────────────────────────────

export const computePercentileRanks = (rows, key) => {
  if (!rows || rows?.length === 0) return {};
  const sorted = [...rows]?.sort((a, b) => (a?.[key] || 0) - (b?.[key] || 0));
  const ranks = {};
  sorted?.forEach((r, i) => {
    const pct = (i / (sorted?.length - 1 || 1)) * 100;
    ranks[r.id] = pct;
  });
  return ranks;
};

export const getTierColor = (pct) => {
  if (pct >= 80) return 'bg-green-100 text-green-800';
  if (pct <= 20) return 'bg-red-100 text-red-700';
  return '';
};

// ─── Patient Balances (True Patient-Responsible — /v2/rcm/patient-balances) ──

/**
 * Fetch true patient-responsible balances from Dentrix live aging balances report.
 *
 * Endpoint: GET /v2/rcm/patient-balances
 * Source:
 *   patient_responsible_balance = Dentrix guarantorPortionBalance
 *   insurance_portion_balance   = Dentrix insurancePortionBalance
 *   total_balance               = Dentrix total balance
 *
 * Rules:
 *  - No startDate/endDate — as-of/current live snapshot only
 *  - All Offices: call once with no officeId (backend handles full scope)
 *  - Selected office: pass dashboard officeId UUID — do NOT pass UUID as locationId
 *  - balanceType=unapplied_review is NOT exposed (backend returns 403)
 *
 * @param {object} params
 * @param {string|null} params.officeId           Dashboard UUID or null for All Offices
 * @param {string}      params.balanceType         'patient_responsible' | 'all'
 * @param {boolean}     params.includeZeroBalances
 * @param {number|null} params.minBalance
 * @param {string|null} params.agingBucket         'current' | 'b30' | 'b60' | 'b90'
 * @param {string|null} params.search
 * @param {number}      params.page
 * @param {number}      params.pageSize
 * @returns {Promise<{ data: Array, scorecard: object, meta: object, sourceMeta: object }>}
 */
export const fetchPatientBalances = async ({
  officeId = null,
  balanceType = 'patient_responsible',
  includeZeroBalances = false,
  minBalance = null,
  agingBucket = null,
  search = null,
  page = 1,
  pageSize = 50,
} = {}) => {
  const t0 = Date.now();
  try {
    const raw = await ascendApi?.getPatientBalances({
      officeId,
      balanceType,
      includeZeroBalances,
      minBalance,
      agingBucket,
      search,
      page,
      pageSize,
    });

    const data = Array.isArray(raw?.data) ? raw?.data : [];
    const scorecard = raw?.scorecard || {};
    const meta = raw?.meta || {};
    const sourceMeta = {
      balance_source_freshness_note: raw?.balance_source_freshness_note || null,
      snapshot_timestamp: raw?.snapshot_timestamp || meta?.snapshot_timestamp || null,
      is_live_dentrix_pull: raw?.is_live_dentrix_pull ?? meta?.is_live_dentrix_pull ?? null,
      _source: raw?._source || 'dentrix_ascend/live_agingbalances_report',
    };

    recordDiagnostic('patient_balances', {
      source: sourceMeta?._source,
      endpoint: '/v2/rcm/patient-balances',
      rowCount: data?.length,
      totalCount: meta?.total_count,
      durationMs: Date.now() - t0,
      officeId: officeId || 'all',
      balanceType,
      page,
      pageSize,
    });

    return { data, scorecard, meta, sourceMeta };
  } catch (err) {
    recordDiagnostic('patient_balances', {
      source: 'error',
      endpoint: '/v2/rcm/patient-balances',
      error: err?.message,
      durationMs: Date.now() - t0,
      officeId: officeId || 'all',
    });
    throw err;
  }
};

// ─── Dashboard-specific service wrappers ─────────────────────────────────────

/**
 * fetchDashboardDailyComparison
 * Fetches MTD production, collections, and collection % for the Dashboard summary.
 * Source: GET /v2/rcm/daily-comparison
 * Uses the end date of the selected range as the "as of" date.
 * Collection % = collections ÷ net production ONLY.
 * If net production or collections are null/missing, collection % is null (show N/A).
 * Does NOT use daily_entries, monthly_executive_analytics, eAssist, or manual fallback.
 *
 * @param {{ start: string, end: string, officeId: string|null }} params
 * @returns {Promise<{ mtd: object, summary: object, _source: string }>}
 */
export const fetchDashboardDailyComparison = async ({ start, end, officeId }) => {
  const t0 = Date.now();
  try {
    const raw = await ascendApi?.getDailyComparison(
      end,           // date = end of selected range
      officeId || null,
      null,          // providerId
      'mtd',         // comparisonMode
      1,             // comparisonYears
      null,          // metrics
      1,             // page
      null           // pageSize
    );

    // V468 AUDIT: Log raw response shape so we can identify real field names
    console.info('[V468 AUDIT] /v2/rcm/daily-comparison raw response top-level keys:', raw ? Object.keys(raw) : 'null/undefined');
    if (raw?.mtd) console.info('[V468 AUDIT] daily-comparison raw.mtd keys:', Object.keys(raw?.mtd), 'values:', JSON.stringify(raw?.mtd)?.slice(0, 500));
    if (raw?.summary) console.info('[V468 AUDIT] daily-comparison raw.summary keys:', Object.keys(raw?.summary), 'values:', JSON.stringify(raw?.summary)?.slice(0, 500));
    if (raw?.current) console.info('[V468 AUDIT] daily-comparison raw.current keys:', Object.keys(raw?.current), 'values:', JSON.stringify(raw?.current)?.slice(0, 500));
    if (raw?.period) console.info('[V468 AUDIT] daily-comparison raw.period keys:', Object.keys(raw?.period), 'values:', JSON.stringify(raw?.period)?.slice(0, 500));
    if (raw?.data && Array.isArray(raw?.data) && raw?.data?.length > 0) console.info('[V468 AUDIT] daily-comparison raw.data[0] keys:', Object.keys(raw?.data?.[0]), 'values:', JSON.stringify(raw?.data?.[0])?.slice(0, 500));
    if (raw?.production) console.info('[V468 AUDIT] daily-comparison raw.production keys:', Object.keys(raw?.production));
    console.info('[V468 AUDIT] daily-comparison full raw (truncated):', JSON.stringify(raw)?.slice(0, 3000));

    // Extract MTD summary from response — handle multiple response shapes
    const mtd = raw?.mtd || raw?.mtd_summary || raw?.summary || raw?.current || {};
    let summary = raw?.summary || {};

    recordDiagnostic('dashboard_daily_comparison', {
      source: '/v2/rcm/daily-comparison',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      durationMs: Date.now() - t0,
      ok: true,
    });

    return { mtd, summary, _source: '/v2/rcm/daily-comparison', _raw: raw };
  } catch (err) {
    recordDiagnostic('dashboard_daily_comparison', {
      source: '/v2/rcm/daily-comparison',
      dateRange: `${start} – ${end}`,
      officeFilter: officeId || 'All Offices',
      durationMs: Date.now() - t0,
      ok: false,
      error: err?.message,
    });
    throw err;
  }
};

/**
 * fetchDashboardEassistStatus
 * Fetches eAssist ingestion pipeline status for the Dashboard status card.
 * Source: GET /v2/eassist/ingest/status
 * Expected offices: Barnegat, Brick, Eatontown only.
 * Staten Island is NOT handled by eAssist — do not flag as missing.
 *
 * @returns {Promise<object>}
 */
export const fetchDashboardEassistStatus = async () => {
  const t0 = Date.now();
  try {
    const raw = await ascendApi?.getEAssistIngestStatus();

    // V468 AUDIT: Log raw response shape
    console.info('[V468 AUDIT] /v2/eassist/ingest/status raw response top-level keys:', raw ? Object.keys(raw) : 'null/undefined');
    // Log all nested objects one level deep
    if (raw && typeof raw === 'object') {
      Object.entries(raw)?.forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          console.info(`[V468 AUDIT] eassist ingest status raw.${k} keys:`, Object.keys(v));
        } else if (Array.isArray(v) && v?.length > 0 && typeof v?.[0] === 'object') {
          console.info(`[V468 AUDIT] eassist ingest status raw.${k}[0] keys:`, Object.keys(v?.[0]));
        }
      });
    }
    console.info('[V468 AUDIT] eassist ingest status full raw (truncated):', JSON.stringify(raw)?.slice(0, 3000));

    recordDiagnostic('dashboard_eassist_status', {
      source: '/v2/eassist/ingest/status',
      durationMs: Date.now() - t0,
      ok: true,
    });
    return raw || {};
  } catch (err) {
    recordDiagnostic('dashboard_eassist_status', {
      source: '/v2/eassist/ingest/status',
      durationMs: Date.now() - t0,
      ok: false,
      error: err?.message,
    });
    throw err;
  }
};

/**
 * fetchDashboardDentrixDailySummary
 * Fetches the latest Dentrix Daily Summary status for the Dashboard status card.
 * Source: GET /v2/reports/daily-summary (today's date, no locationId = all offices)
 * Dentrix-only source — not eAssist.
 *
 * @returns {Promise<object>}
 */
export const fetchDashboardDentrixDailySummary = async () => {
  const t0 = Date.now();
  try {
    const today = new Date()?.toISOString()?.slice(0, 10);
    const raw = await ascendApi?.getDailySummary(today, null);

    // V468 AUDIT: Log raw response shape
    console.info('[V468 AUDIT] /v2/reports/daily-summary raw response top-level keys:', raw ? Object.keys(raw) : 'null/undefined');
    if (raw?.summary) console.info('[V468 AUDIT] daily-summary raw.summary keys:', Object.keys(raw?.summary), 'values:', JSON.stringify(raw?.summary)?.slice(0, 500));
    if (raw?.report) console.info('[V468 AUDIT] daily-summary raw.report keys:', Object.keys(raw?.report), 'values:', JSON.stringify(raw?.report)?.slice(0, 500));
    if (raw?.payment_breakdown) console.info('[V468 AUDIT] daily-summary raw.payment_breakdown:', JSON.stringify(raw?.payment_breakdown)?.slice(0, 500));
    if (raw?.payments) console.info('[V468 AUDIT] daily-summary raw.payments:', JSON.stringify(raw?.payments)?.slice(0, 500));
    // Log all nested objects one level deep
    if (raw && typeof raw === 'object') {
      Object.entries(raw)?.forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          console.info(`[V468 AUDIT] daily-summary raw.${k} keys:`, Object.keys(v));
        }
      });
    }
    console.info('[V468 AUDIT] daily-summary full raw (truncated):', JSON.stringify(raw)?.slice(0, 3000));

    recordDiagnostic('dashboard_dentrix_daily_summary', {
      source: '/v2/reports/daily-summary',
      date: today,
      durationMs: Date.now() - t0,
      ok: true,
    });
    return raw || {};
  } catch (err) {
    recordDiagnostic('dashboard_dentrix_daily_summary', {
      source: '/v2/reports/daily-summary',
      durationMs: Date.now() - t0,
      ok: false,
      error: err?.message,
    });
    throw err;
  }
};