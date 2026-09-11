/**
 * executiveSummaryAutomatedService.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only automated data service for the Executive Summary tab.
 *
 * Sources:
 *   - Net Production      : ascendApi.getProduction()          → netProduction
 *   - Collections         : ascendApi.getCollections()         → totalCollections
 *   - New Patients        : ascendApi.getPatients()            → newPatients
 *   - Active Patients     : ascendApi.getPatients() (same call) → activePatients / uniquePatients
 *   - Broken Appointments : ascendApi.getAppointmentsSummary() → broken / brokenAppointments
 *   - Hygiene Production  : ascendApi.getProviderPerformance() → providerTypeMetrics.hygienist.netProduction
 *   - Doctor Production   : ascendApi.getProviderPerformance() (same call) → providerTypeMetrics.doctor.netProduction
 *   - Marketing Spend     : fetchMarketingAdSpendFromAmex()    → /v2/marketing/amex-spend → spend
 *   - AR Aging            : fetchAgingReceivablesLive()        → /v2/rcm/aging-receivables-live
 *   - Production Adjustments : ascendApi.getAdjustmentsSummary() → /v2/adjustments/summary → totalProductionAdjustments
 *   - Writeoffs           : ascendApi.getAdjustmentsSummary() (same call) → /v2/adjustments/summary → writeOffs
 *
 * Rules:
 *   - NO monthly_executive_analytics reads or writes.
 *   - NO daily_entries / EOD / manual fallback.
 *   - NO grossProduction fallback for netProduction.
 *   - NO /v2/rcm/claims as true AR.
 *   - NO guessing provider type by provider name.
 *   - Missing values → null (displayed as '—' by the tab).
 *   - Real backend 0 stays 0.
 *   - If netProduction is null or <= 0, collectionPct is null.
 *   - Promise.allSettled used so one failed endpoint does not break the page.
 *   - Payroll, Expenses Total, Net Income → null (Source Not Wired in Phase 1C).
 *   - Production Adjustments: uses totalProductionAdjustments ONLY — not totalAdjustments, not computed.
 *   - Writeoffs: uses writeOffs ONLY — signed, normally negative — not computed from production fields.
 *   - If /v2/adjustments/summary unavailable or field missing → null → displayed as N/A.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ascendApi } from './ascendApi';
import { fetchAgingReceivablesLive } from './rcmService';
import { fetchMarketingAdSpendFromAmex } from './operationsService';
import { LOCATION_ID_MAP } from '../constants/offices';

// ─── Known offices (same order used across all pages) ────────────────────────
const ALL_OFFICES = [
  { officeId: '220372a5-afae-49c9-8a0c-f4c0717ff352', name: 'Eatontown',     locationId: '14000000000433' },
  { officeId: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', name: 'Staten Island', locationId: '14000000000432' },
  { officeId: '54626997-57c2-4934-8743-1dabb4d176f4', name: 'Brick',         locationId: '14000000000435' },
  { officeId: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', name: 'Barnegat',      locationId: '14000000000434' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Translate a Supabase office UUID to a Dentrix locationId string.
 * Returns null for 'all' / empty / unknown values.
 */
function resolveLocationId(officeId) {
  if (!officeId || officeId === 'all') return null;
  return LOCATION_ID_MAP?.[officeId] || null;
}

/**
 * Build YYYY-MM-DD startDate / endDate strings.
 *
 * month mode : startDate = YYYY-MM-01, endDate = last day of that month
 * YTD mode   : startDate = YYYY-01-01, endDate = last day of selected month
 *              (capped at today if the selected month is in the future)
 */
function buildDateRange({ year, month, ytd }) {
  const pad = (n) => String(n)?.padStart(2, '0');

  // Last day of the selected month
  const lastDay = new Date(year, month, 0)?.getDate(); // month is 1-based; Date(y, m, 0) = last day of month m
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

  // Cap endDate at today for YTD when selected month is in the future
  const today = new Date();
  const todayStr = `${today?.getFullYear()}-${pad(today?.getMonth() + 1)}-${pad(today?.getDate())}`;
  const effectiveEndDate = ytd && endDate > todayStr ? todayStr : endDate;

  const startDate = ytd
    ? `${year}-01-01`
    : `${year}-${pad(month)}-01`;

  return { startDate, endDate: effectiveEndDate };
}

/**
 * Safely extract a numeric value from a settled Promise result.
 * Returns null on rejection or if the field is missing/undefined.
 * Real backend 0 is preserved as 0.
 */
function safeField(settledResult, extractor) {
  if (settledResult?.status !== 'fulfilled') {
    if (settledResult?.reason) {
      console.warn('[executiveSummaryAutomatedService] endpoint failed:', settledResult?.reason?.message || settledResult?.reason);
    }
    return null;
  }
  const value = extractor(settledResult?.value);
  // undefined / null → null; 0 → 0; number → number
  return value === undefined ? null : value ?? null;
}

/**
 * Safely parse a numeric value.
 * Returns null for undefined/null/NaN. Real 0 returns 0.
 */
function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// ─── Provider-performance two-strategy extraction ─────────────────────────────
/**
 * Extract hygiene and doctor netProduction from a single provider-performance response.
 *
 * Strategy 1 (preferred): providerTypeMetrics pre-aggregated by backend.
 * Strategy 2 (fallback):  sum rows where providerType is explicitly hygienist/hygiene or doctor.
 *
 * Rules:
 *   - Use netProduction only. No grossProduction.
 *   - Do NOT guess provider type by provider name.
 *   - Do NOT double-count Strategy 1 and Strategy 2.
 *   - Returns { hygieneProd: number|null, doctorProd: number|null }
 */
function extractProviderSplit(ppData) {
  let hygieneProd = null;
  let doctorProd  = null;

  if (!ppData) return { hygieneProd, doctorProd };

  const summary = ppData?.summary ?? ppData;
  const rows = Array.isArray(ppData?.rows)      ? ppData?.rows
             : Array.isArray(ppData?.providers) ? ppData?.providers
             : Array.isArray(ppData?.data)      ? ppData?.data
             : null;

  // Strategy 1: providerTypeMetrics (pre-aggregated by backend — preferred)
  const ptm = summary?.providerTypeMetrics;
  if (ptm) {
    const docMetrics = ptm?.doctor    ?? ptm?.Doctor    ?? null;
    const hygMetrics = ptm?.hygienist ?? ptm?.Hygienist ?? ptm?.hygiene ?? ptm?.Hygiene ?? null;
    if (docMetrics) doctorProd  = safeNum(docMetrics?.netProduction);
    if (hygMetrics) hygieneProd = safeNum(hygMetrics?.netProduction);
  }

  // Strategy 2: sum rows by providerType — only if Strategy 1 left a gap
  if ((doctorProd === null || hygieneProd === null) && rows) {
    let docSum = null;
    let hygSum = null;

    rows?.forEach((row) => {
      const pt  = row?.providerType ?? row?.provider_type ?? null;
      if (!pt) return; // Do NOT guess by name — skip rows without explicit providerType
      const net = safeNum(row?.netProduction ?? row?.net_production);
      if (net === null) return;

      const ptLower = String(pt)?.toLowerCase();
      if (ptLower === 'doctor' || ptLower === 'dentist') {
        docSum = (docSum ?? 0) + net;
      } else if (ptLower === 'hygienist' || ptLower === 'hygiene') {
        hygSum = (hygSum ?? 0) + net;
      }
      // All other providerType values are ignored — no name guessing
    });

    if (doctorProd  === null && docSum !== null) doctorProd  = docSum;
    if (hygieneProd === null && hygSum !== null) hygieneProd = hygSum;
  }

  return { hygieneProd, doctorProd };
}

// ─── fetchAutomatedKPIs ───────────────────────────────────────────────────────

/**
 * Fetch KPI card values for the Executive Summary tab.
 *
 * @param {{ officeId: string, year: number, month: number, ytd: boolean }} params
 * @returns {Promise<{
 *   netProduction: number|null,
 *   totalCollections: number|null,
 *   collectionPct: number|null,
 *   newPatients: number|null,
 *   activePatients: number|null,
 *   brokenAppointments: number|null,
 *   hygieneProduction: number|null,
 *   doctorProduction: number|null,
 *   marketingSpend: number|null,
 *   costPerNewPatient: number|null,
 *   ar: object,
 *   caseAcceptance: null,
 * }>}
 */
export async function fetchAutomatedKPIs({ officeId, year, month, ytd }) {
  const { startDate, endDate } = buildDateRange({ year, month, ytd });
  const locationId = resolveLocationId(officeId);
  const isAllOffices = !officeId || officeId === 'all';

  let netProduction    = null;
  let totalCollections = null;
  let newPatients      = null;
  let activePatients   = null;

  // ── Phase 1B: Broken Appointments ─────────────────────────────────────────
  let brokenAppointments = null;

  // ── Phase 1B: Hygiene + Doctor Production ─────────────────────────────────
  let hygieneProduction = null;
  let doctorProduction  = null;

  // ── Phase 1C: Production Adjustments + Writeoffs ──────────────────────────
  // Source: /v2/adjustments/summary → totalProductionAdjustments / writeOffs
  // Do NOT use totalAdjustments. Do NOT compute from production fields.
  let productionAdjustments = null;
  let writeoffs             = null;

  if (isAllOffices) {
    // Org-wide call: omit locationId — single call, no double-counting
    // Phase 1B: add getAppointmentsSummary + getProviderPerformance in same allSettled batch
    // Phase 1C: add getAdjustmentsSummary for Production Adjustments + Writeoffs
    const [prodResult, collResult, patResult, apptResult, ppResult, adjResult] = await Promise.allSettled([
      ascendApi?.getProduction(startDate, endDate, null),
      ascendApi?.getCollections(startDate, endDate, null),
      ascendApi?.getPatients(startDate, endDate, null),
      ascendApi?.getAppointmentsSummary(startDate, endDate, null),
      ascendApi?.getProviderPerformance(startDate, endDate, null),
      ascendApi?.getAdjustmentsSummary(startDate, endDate, null),
    ]);

    netProduction    = safeField(prodResult, (d) => d?.netProduction);
    totalCollections = safeField(collResult, (d) => d?.totalCollections);
    newPatients      = safeField(patResult,  (d) => d?.newPatients);

    // Active Patients — from the same /v2/patients/summary call (no extra API call)
    activePatients = safeField(patResult, (d) => d?.activePatients ?? d?.uniquePatients);

    // Broken Appointments — /v2/appointments/summary
    // Field priority: broken → brokenAppointments → broken_appointments
    // Pattern proven in CancellationsTab.jsx
    if (apptResult?.status === 'fulfilled' && apptResult?.value) {
      const payload = apptResult?.value;
      const raw =
        payload?.broken != null ? payload?.broken :
        payload?.brokenAppointments != null ? payload?.brokenAppointments :
        payload?.broken_appointments != null ? payload?.broken_appointments :
        null;
      brokenAppointments = raw !== null ? parseInt(raw) : null;
    }

    // Hygiene + Doctor Production — single /v2/reports/provider-performance call
    // Two-strategy extraction proven in fetchProductionDetails + fetchScorecardData
    if (ppResult?.status === 'fulfilled' && ppResult?.value) {
      const { hygieneProd, doctorProd } = extractProviderSplit(ppResult?.value);
      hygieneProduction = hygieneProd;
      doctorProduction  = doctorProd;
    }

    // Phase 1C: Production Adjustments + Writeoffs — /v2/adjustments/summary
    // Use ONLY totalProductionAdjustments for Production Adjustments.
    // Use ONLY writeOffs for Writeoffs.
    // Do NOT use totalAdjustments. Do NOT compute from production fields.
    // If endpoint unavailable or field missing → null → displayed as N/A.
    if (adjResult?.status === 'fulfilled' && adjResult?.value != null) {
      const adjPayload = adjResult?.value;
      const rawAdj = adjPayload?.totalProductionAdjustments;
      productionAdjustments = (rawAdj !== undefined && rawAdj !== null) ? safeNum(rawAdj) : null;
      const rawWO = adjPayload?.writeOffs;
      writeoffs = (rawWO !== undefined && rawWO !== null) ? safeNum(rawWO) : null;
    }

  } else {
    // Single-office call using resolved Dentrix locationId
    // Phase 1C: add getAdjustmentsSummary for Production Adjustments + Writeoffs
    const [prodResult, collResult, patResult, apptResult, ppResult, adjResult] = await Promise.allSettled([
      ascendApi?.getProduction(startDate, endDate, locationId),
      ascendApi?.getCollections(startDate, endDate, locationId),
      ascendApi?.getPatients(startDate, endDate, locationId),
      ascendApi?.getAppointmentsSummary(startDate, endDate, locationId),
      ascendApi?.getProviderPerformance(startDate, endDate, locationId),
      ascendApi?.getAdjustmentsSummary(startDate, endDate, locationId),
    ]);

    netProduction    = safeField(prodResult, (d) => d?.netProduction);
    totalCollections = safeField(collResult, (d) => d?.totalCollections);
    newPatients      = safeField(patResult,  (d) => d?.newPatients);

    // Active Patients — from the same /v2/patients/summary call (no extra API call)
    activePatients = safeField(patResult, (d) => d?.activePatients ?? d?.uniquePatients);

    // Broken Appointments — /v2/appointments/summary
    if (apptResult?.status === 'fulfilled' && apptResult?.value) {
      const payload = apptResult?.value;
      const raw =
        payload?.broken != null ? payload?.broken :
        payload?.brokenAppointments != null ? payload?.brokenAppointments :
        payload?.broken_appointments != null ? payload?.broken_appointments :
        null;
      brokenAppointments = raw !== null ? parseInt(raw) : null;
    }

    // Hygiene + Doctor Production — single /v2/reports/provider-performance call
    if (ppResult?.status === 'fulfilled' && ppResult?.value) {
      const { hygieneProd, doctorProd } = extractProviderSplit(ppResult?.value);
      hygieneProduction = hygieneProd;
      doctorProduction  = doctorProd;
    }

    // Phase 1C: Production Adjustments + Writeoffs — /v2/adjustments/summary
    // Use ONLY totalProductionAdjustments for Production Adjustments.
    // Use ONLY writeOffs for Writeoffs.
    // Do NOT use totalAdjustments. Do NOT compute from production fields.
    // If endpoint unavailable or field missing → null → displayed as N/A.
    if (adjResult?.status === 'fulfilled' && adjResult?.value != null) {
      const adjPayload = adjResult?.value;
      const rawAdj = adjPayload?.totalProductionAdjustments;
      productionAdjustments = (rawAdj !== undefined && rawAdj !== null) ? safeNum(rawAdj) : null;
      const rawWO = adjPayload?.writeOffs;
      writeoffs = (rawWO !== undefined && rawWO !== null) ? safeNum(rawWO) : null;
    }
  }

  // Collection % — null if netProduction is null or <= 0
  let collectionPct = null;
  if (netProduction !== null && netProduction > 0 && totalCollections !== null) {
    collectionPct = totalCollections / netProduction;
  }

  // ── Phase 1B: Marketing Spend — /v2/marketing/amex-spend ──────────────────
  // Source: fetchMarketingAdSpendFromAmex from operationsService.js
  // For All Offices: sum spend across all office rows.
  // For single office: use matching office row only.
  // Do NOT use MEA marketing_spend. Do NOT query expenses directly.
  let marketingSpend = null;
  try {
    const officeIds = isAllOffices ? [] : [locationId]?.filter(Boolean);
    const marketingRows = await fetchMarketingAdSpendFromAmex({
      startYear:  year,
      startMonth: month,
      endYear:    year,
      endMonth:   month,
      officeIds,
    });

    if (Array.isArray(marketingRows) && marketingRows?.length > 0) {
      if (isAllOffices) {
        // Sum spend across all office rows
        let total = null;
        marketingRows?.forEach((row) => {
          const s = safeNum(row?.spend);
          if (s !== null) total = (total ?? 0) + s;
        });
        marketingSpend = total;
      } else {
        // Single office: use the first (and typically only) matching row
        const s = safeNum(marketingRows?.[0]?.spend);
        marketingSpend = s;
      }
    }
  } catch (err) {
    console.warn('[executiveSummaryAutomatedService] fetchMarketingAdSpendFromAmex failed:', err?.message || err);
    marketingSpend = null;
  }

  // Cost per New Patient — only if marketingSpend is not null and newPatients > 0
  // Uses Dentrix newPatients from /v2/patients/summary (already wired in Phase 1A)
  let costPerNewPatient = null;
  if (marketingSpend !== null && newPatients !== null && newPatients > 0) {
    costPerNewPatient = marketingSpend / newPatients;
  }

  // AR — always org-wide snapshot from /v2/rcm/aging-receivables-live
  let ar = {};
  try {
    const arData = await fetchAgingReceivablesLive();

    // ── AR field mapping ────────────────────────────────────────────────────
    // Field names are identical to the verified mapping used by:
    //   - Operations → AR Aging tab (ARAgingTab.jsx, V314)
    //   - Operations → Payors tab Section 1 (PayorsTab.jsx)
    // Source: data?.agingBuckets?.b_0_30 / b_31_60 / b_61_90 / b_over_90
    // Do NOT use assumed names. Do NOT use /v2/rcm/claims. Do NOT fake 0.
    const current = arData?.agingBuckets?.b_0_30    ?? null;
    const b30_60  = arData?.agingBuckets?.b_31_60   ?? null;
    const b60_90  = arData?.agingBuckets?.b_61_90   ?? null;
    const b90plus = arData?.agingBuckets?.b_over_90 ?? null;

    // Total AR: prefer fullAR.totalBalance (same as ARAgingTab / PayorsTab),
    // fall back to sum of buckets only if all four buckets are present.
    let totalAR = arData?.fullAR?.totalBalance ?? null;
    if (totalAR === null && current !== null && b30_60 !== null && b60_90 !== null && b90plus !== null) {
      totalAR = current + b30_60 + b60_90 + b90plus;
    }

    // 90+ % — computed only from endpoint-provided buckets; null if unavailable
    let pct90plus = null;
    if (totalAR !== null && totalAR > 0 && b90plus !== null) {
      pct90plus = b90plus / totalAR;
    }

    ar = {
      totalAR,
      current,
      b30_60,
      b60_90,
      b90plus,
      pct90plus,
      snapshotDate:      arData?.snapshotDate  || null,
      lastSyncedAt:      arData?.lastSyncedAt  || null,
      asOf:              arData?.asOf || arData?.snapshotDate || null,
      reconciled:        arData?.reconciliation?.reconciled ?? null,
      // V337: Additional verified fields from /v2/accounts-receivable or /v2/ar
      netBalance:        safeNum(arData?.netBalance ?? arData?.fullAR?.netBalance ?? arData?.fullAR?.netBalanceAfterCredits),
      insurancePortion:  safeNum(arData?.insurancePortion ?? arData?.fullAR?.insurancePortion),
      guarantorPortion:  safeNum(arData?.guarantorPortion ?? arData?.fullAR?.guarantorPortion),
      estimatedWriteOff: safeNum(arData?.estimatedWriteOff ?? arData?.fullAR?.estimatedWriteOff),
      unappliedCredits:  safeNum(arData?.unappliedCredits ?? arData?.fullAR?.unappliedCredits),
      patientCount:      arData?.patientCount != null ? arData?.patientCount : null,
      // Per-office rollup — passed through as-is from endpoint; no frontend reconstruction.
      // Shape: Array<{ officeName: string, insuranceAR: number, insuranceARCurrent: number|null, ... }>
      // Used by ExecutiveSummaryTab to render per-office AR bars when available.
      officeRollup:  Array.isArray(arData?.officeRollup) ? arData?.officeRollup : [],
      offices:       Array.isArray(arData?.offices) ? arData?.offices : [],
    };
  } catch (err) {
    console.warn('[executiveSummaryAutomatedService] fetchAgingReceivablesLive failed:', err?.message || err);
    ar = {
      totalAR: null, current: null, b30_60: null, b60_90: null,
      b90plus: null, pct90plus: null, snapshotDate: null,
      lastSyncedAt: null, reconciled: null,
    };
  }

  return {
    netProduction,
    totalCollections,
    collectionPct,
    newPatients,
    // ── Phase 1B ──────────────────────────────────────────────────────────
    activePatients,        // /v2/patients/summary → activePatients ?? uniquePatients
    brokenAppointments,    // /v2/appointments/summary → broken ?? brokenAppointments ?? broken_appointments
    hygieneProduction,     // /v2/reports/provider-performance → providerTypeMetrics.hygienist.netProduction
    doctorProduction,      // /v2/reports/provider-performance → providerTypeMetrics.doctor.netProduction
    marketingSpend,        // /v2/marketing/amex-spend → spend (summed or single-office)
    costPerNewPatient,     // marketingSpend / newPatients — null if either is null or newPatients <= 0
    // ── Phase 1C ──────────────────────────────────────────────────────────
    productionAdjustments, // /v2/adjustments/summary → totalProductionAdjustments (signed, net)
    writeoffs,             // /v2/adjustments/summary → writeOffs (signed, normally negative)
    // ── Source Not Wired in Phase 1C ──────────────────────────────────────
    payrollTotal:      null, // Source Not Wired — requires gusto_expense_facts backfill confirmation
    expensesTotal:     null, // Source Not Wired — requires Finance monthly total verification
    netIncomeEstimate: null, // Source Not Wired — requires expensesTotal first
    ar,
    caseAcceptance: null, // Source Not Wired — requires Dentrix TxCase integration
  };
}

// ─── fetchAutomatedTrendData ──────────────────────────────────────────────────

/**
 * Fetch 6-month trend data ending with the selected report month.
 *
 * @param {{ officeId: string, year: number, month: number }} params
 * @returns {Promise<{
 *   months: Array<{ label: string, year: number, month: number }>,
 *   production: Array<number|null>,
 *   collections: Array<number|null>,
 *   newPatients: Array<number|null>,
 * }>}
 */
export async function fetchAutomatedTrendData({ officeId, year, month }) {
  const locationId = resolveLocationId(officeId);
  const isAllOffices = !officeId || officeId === 'all';

  // Build the 6 month descriptors ending at selected month
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months?.push({ label: d?.toLocaleString('default', { month: 'long' }), year: d?.getFullYear(), month: d?.getMonth() + 1 });
  }

  const pad = (n) => String(n)?.padStart(2, '0');

  // Build per-month date ranges
  const ranges = months?.map(({ year: y, month: m }) => {
    const lastDay = new Date(y, m, 0)?.getDate();
    return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(lastDay)}` };
  });

  // Fan out all 18 calls (6 months × 3 metrics) in parallel
  const effectiveLocationId = isAllOffices ? null : locationId;

  const prodCalls = ranges?.map(({ startDate, endDate }) =>
    ascendApi?.getProduction(startDate, endDate, effectiveLocationId)
  );
  const collCalls = ranges?.map(({ startDate, endDate }) =>
    ascendApi?.getCollections(startDate, endDate, effectiveLocationId)
  );
  const patCalls = ranges?.map(({ startDate, endDate }) =>
    ascendApi?.getPatients(startDate, endDate, effectiveLocationId)
  );

  const results = await Promise.allSettled([...prodCalls, ...collCalls, ...patCalls]);

  const prodResults = results?.slice(0, 6);
  const collResults = results?.slice(6, 12);
  const patResults  = results?.slice(12, 18);

  const production  = prodResults?.map((r) => safeField(r, (d) => d?.netProduction));
  const collections = collResults?.map((r) => safeField(r, (d) => d?.totalCollections));
  let newPatients = patResults?.map((r)  => safeField(r, (d) => d?.newPatients));

  return { months, production, collections, newPatients };
}

// ─── fetchAutomatedOfficeChart ────────────────────────────────────────────────

/**
 * Fetch per-office production and collections for the bar chart.
 * Always loops all 4 known offices — no double-counting.
 *
 * @param {{ year: number, month: number, ytd: boolean }} params
 * @returns {Promise<Array<{ name: string, netProduction: number|null, totalCollections: number|null }>>}
 */
export async function fetchAutomatedOfficeChart({ year, month, ytd }) {
  const { startDate, endDate } = buildDateRange({ year, month, ytd });

  // One production + one collections call per office = 8 calls total
  const calls = ALL_OFFICES?.flatMap(({ locationId }) => [
    ascendApi?.getProduction(startDate, endDate, locationId),
    ascendApi?.getCollections(startDate, endDate, locationId),
  ]);

  const results = await Promise.allSettled(calls);

  return ALL_OFFICES?.map(({ name }, i) => {
    const prodResult = results?.[i * 2];
    const collResult = results?.[i * 2 + 1];

    return {
      name,
      netProduction:    safeField(prodResult, (d) => d?.netProduction),
      totalCollections: safeField(collResult, (d) => d?.totalCollections),
    };
  });
}