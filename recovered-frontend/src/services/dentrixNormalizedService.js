/**
 * dentrixNormalizedService.js
 * ══════════════════════════════════════════════════════════════════════════════
 * NORMALIZED DENTRIX SOURCE-OF-TRUTH LAYER
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This is the SINGLE canonical service for all Dentrix Ascend metrics.
 * Every dashboard tab (Executive Overview, Financial Analytics, RCM, Payroll,
 * Office Performance, KPIs, Reports) MUST read from this service.
 *
 * Metric definitions match eAssist Daily Report output exactly:
 *   - Daily Production       = grossProduction from /v2/production/summary
 *   - Daily Adj              = adjustments (negative) from /v2/adjustments/summary
 *   - Net Daily Production   = Daily Production + Daily Adj
 *   - Daily Insurance Coll   = insuranceCollections from /v2/collections/summary
 *   - Daily Patient Coll     = patientCollections from /v2/collections/summary
 *   - Daily Total Coll       = totalCollections from /v2/collections/summary
 *   - Monthly variants       = same fields over MTD date range
 *
 * Sign rules (CRITICAL):
 *   - Production: POSITIVE (raw Dentrix value)
 *   - Adjustments: NEGATIVE (reductions stored as negative, displayed as negative)
 *   - Collections: POSITIVE for display (Dentrix may return negative — we abs() for display)
 *   - Net Production = Production + Adjustments (where Adj is negative)
 *
 * Date field rules:
 *   - Production: uses Entry Date / Applied Date / Dentrix Modified Applied Date (V353 official basis)
 *   - Adjustments: uses adjustment date (NOT service date)
 *   - Collections: uses payment posted date / applied date
 *   - AR Aging: uses aging as-of date (snapshot date)
 *   - Claims: uses claim submitted date for submission metrics
 *
 * Office location IDs (canonical):
 *   - Staten Island  → 14000000000432
 *   - Eatontown      → 14000000000433
 *   - Barnegat       → 14000000000434
 *   - Brick          → 14000000000435
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { ascendApi } from './ascendApi';
import { supabase } from '../lib/supabase';
import { LOCATION_ID_MAP, OFFICE_MAP } from '../constants/offices';


// ─── Safe math helpers ────────────────────────────────────────────────────────

export const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

export const safeDivide = (n, d) => {
  const num = parseFloat(n);
  const den = parseFloat(d);
  if (!isFinite(num) || !isFinite(den) || den === 0) return null;
  return num / den;
};

// ─── Office resolution ────────────────────────────────────────────────────────

/**
 * Resolve Dentrix locationId from a Supabase office UUID array.
 * - Exactly 1 office → return its locationId
 * - 0 or 2+ offices → return null (API returns all-office aggregate)
 */
export const resolveLocationId = (officeIds = []) => {
  if (!Array.isArray(officeIds) || officeIds?.length !== 1) return null;
  return LOCATION_ID_MAP?.[officeIds?.[0]] || null;
};

/**
 * Resolve canonical office name from a Dentrix locationId.
 */
export const locationIdToOfficeName = (locationId) => {
  const entry = Object.entries(LOCATION_ID_MAP)?.find(([, lid]) => lid === String(locationId));
  if (!entry) return null;
  return OFFICE_MAP?.[entry?.[0]]?.name || null;
};

/**
 * All 4 offices for fan-out fetches.
 */
export const ALL_DENTRIX_OFFICES = [
  { officeId: '220372a5-afae-49c9-8a0c-f4c0717ff352', officeName: 'Eatontown',    locationId: '14000000000433' },
  { officeId: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', officeName: 'Staten Island', locationId: '14000000000432' },
  { officeId: '54626997-57c2-4934-8743-1dabb4d176f4', officeName: 'Brick',         locationId: '14000000000435' },
  { officeId: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', officeName: 'Barnegat',      locationId: '14000000000434' },
];

export const fetchFinancialReportForOffices = async (method, startDate, endDate, officeIds = []) => {
  if (!['getProduction', 'getCollections'].includes(method)) throw new Error('Unsupported financial report.');
  const ids = [...new Set(officeIds)];
  if (ids.length <= 1 || ids.includes('all')) {
    return ascendApi[method](startDate, endDate, ids.includes('all') ? null : resolveLocationId(ids));
  }
  if (ids.some(id => !LOCATION_ID_MAP[id])) throw new Error('Financial report unavailable: invalid office selection.');
  const rows = await Promise.all(ids.map(id => ascendApi[method](startDate, endDate, LOCATION_ID_MAP[id])));
  const sum = (keys, fallback) => rows.reduce((total, row) => {
    const value = keys.map(key => row?.[key]).find(value => value != null) ?? fallback;
    if (value == null || value === '' || !Number.isFinite(Number(value))) {
      throw new Error('Financial report unavailable for one or more selected offices.');
    }
    return total + Number(value);
  }, 0);
  // Aggregate signed source amounts; existing views apply their display rules afterward.
  return method === 'getProduction' ? {
    grossProduction: sum(['grossProduction']),
    netProduction: sum(['netProduction']),
    adjustments: sum(['adjustments', 'writeOffs'], 0),
  } : {
    insuranceCollections: sum(['insuranceCollections', 'insurance_collections']),
    patientCollections: sum(['patientCollections', 'patient_collections']),
    totalCollections: sum(['totalCollections', 'total_collections', 'collections']),
  };
};

// ─── Normalize raw API response ───────────────────────────────────────────────

const normalizeResponse = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw?.data;
  if (Array.isArray(raw?.records)) return raw?.records;
  if (Array.isArray(raw?.results)) return raw?.results;
  if (typeof raw === 'object' && Object.keys(raw)?.length > 0) return [raw];
  return [];
};

// ─── PRODUCTION METRICS ───────────────────────────────────────────────────────

/**
 * fetchProductionMetrics
 *
 * Returns all production and adjustment metrics for a date range and office.
 * This is the canonical source for:
 *   gross_production_daily / gross_production_mtd
 *   production_adjustments_daily / production_adjustments_mtd
 *   net_production_daily / net_production_mtd
 *
 * @param {{ startDate, endDate, officeIds?, dailyDate? }} params
 * @returns {Promise<ProductionMetrics>}
 */
// Multiple selected offices require separate scoped reads: null means All Offices.
const fetchSelectedFinancialMetrics = async (params, kind) => {
  const officeIds = [...new Set(params.officeIds)];
  if (officeIds.some(id => !LOCATION_ID_MAP[id])) {
    throw new Error('Financial metrics unavailable: an office selection is invalid.');
  }
  const reader = kind === 'production' ? fetchProductionMetrics : fetchCollectionMetrics;
  const rows = await Promise.all(officeIds.map(id => reader({ ...params, officeIds: [id] })));
  if (rows.some(row => row._diagnostics?.errors?.length || (params.dailyDate && !row._diagnostics?.rawDaily))) {
    throw new Error('Financial metrics unavailable for one or more selected offices. Please retry.');
  }
  const number = (row, keys, fallback) => {
    const value = keys.map(key => row?.[key]).find(value => value != null) ?? fallback;
    if (value === '' || value == null || !Number.isFinite(Number(value))) {
      throw new Error('Financial metrics incomplete for one or more selected offices. Please retry.');
    }
    return Number(value);
  };
  const result = {};
  for (const key of Object.keys(rows[0])) {
    if (key !== '_diagnostics' && key !== 'collection_rate') {
      result[key] = rows.reduce((total, row) => total + number(row, [key]), 0);
    }
  }
  const diagnostics = {};
  if (kind === 'production') {
    for (const row of rows) {
      number(row._diagnostics.rawProduction, ['grossProduction', 'gross_production']);
      number(row._diagnostics.rawProduction, ['netProduction', 'net_production', 'production']);
    }
    diagnostics.rawProduction = { grossProduction: result.gross_production_mtd, netProduction: result.net_production_mtd };
    diagnostics.rawAdjustments = { totalAdjustments: result.production_adjustments_mtd, writeOffs: result.write_offs_mtd, chargeAdjustments: result.charge_adjustments_mtd };
  } else {
    // Sum signed provider values before applying the existing display abs rule.
    const sumRaw = (source, keys, fallback) => rows.reduce((total, row) =>
      total + number(row._diagnostics[source], keys, fallback), 0);
    const insurance = sumRaw('rawCollections', ['insuranceCollections', 'insurance_collections']);
    const patient = sumRaw('rawCollections', ['patientCollections', 'patient_collections']);
    const total = sumRaw('rawCollections', ['totalCollections', 'total_collections', 'collections']);
    diagnostics.rawCollections = { insuranceCollections: insurance, patientCollections: patient, totalCollections: total };
    Object.assign(result, {
      insurance_collections_mtd: Math.abs(insurance), insuranceCollections: Math.abs(insurance),
      patient_collections_mtd: Math.abs(patient), patientCollections: Math.abs(patient),
      total_collections_mtd: Math.abs(total), totalCollections: Math.abs(total),
    });
    if (params.dailyDate) {
      result.insurance_collections_daily = Math.abs(sumRaw('rawDaily', ['insuranceCollections', 'dailyInsuranceCollections'], 0));
      result.patient_collections_daily = Math.abs(sumRaw('rawDaily', ['patientCollections', 'dailyPatientCollections'], 0));
      result.total_collections_daily = Math.abs(rows.reduce((sum, row) => {
        const raw = row._diagnostics.rawDaily;
        return sum + number(raw, ['totalCollections', 'dailyTotalCollections'],
          Math.abs(number(raw, ['insuranceCollections', 'dailyInsuranceCollections'], 0)) +
          Math.abs(number(raw, ['patientCollections', 'dailyPatientCollections'], 0)));
      }, 0));
    }
    // Rates are not additive; use the exact selected net-production denominator.
    const production = await Promise.all(officeIds.map(id =>
      ascendApi.getProduction(params.startDate, params.endDate, LOCATION_ID_MAP[id])));
    const net = production.reduce((sum, row) => sum + number(row, ['netProduction', 'net_production', 'production']), 0);
    result.collection_rate = net > 0 ? Math.round(total / net * 1000) / 10 : null;
    diagnostics.rawCollections.collectionRate = result.collection_rate;
  }
  result._diagnostics = {
    metric: kind, officeIds, locationIds: officeIds.map(id => LOCATION_ID_MAP[id]),
    startDate: params.startDate, endDate: params.endDate, dailyDate: params.dailyDate,
    fetchedAt: new Date().toISOString(), errors: [], ...diagnostics,
  };
  return result;
};

export const fetchProductionMetrics = async ({ startDate, endDate, officeIds = [], dailyDate = null }) => {
  if (officeIds.length > 1 && !officeIds.includes('all')) {
    return fetchSelectedFinancialMetrics({ startDate, endDate, officeIds, dailyDate }, 'production');
  }
  const locationId = resolveLocationId(officeIds);

  const diagnostics = {
    metric: 'production',
    endpoint: `/v2/production/summary`,
    adjustmentEndpoint: `/v2/adjustments/summary`,
    locationId,
    officeIds,
    startDate,
    endDate,
    dailyDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let productionData = null;
  let adjustmentsData = null;
  let dailyData = null;

  try {
    const fetches = [
      ascendApi?.getProduction(startDate, endDate, locationId)?.catch(e => { diagnostics?.errors?.push({ key: 'production', error: e?.message }); return null; }),
      ascendApi?.getAdjustmentsSummary(startDate, endDate, locationId)?.catch(e => { diagnostics?.errors?.push({ key: 'adjustments', error: e?.message }); return null; }),
    ];

    if (dailyDate) {
      fetches?.push(
        ascendApi?.getDailySummary(dailyDate, locationId)?.catch(e => { diagnostics?.errors?.push({ key: 'daily', error: e?.message }); return null; })
      );
    }

    const results = await Promise.all(fetches);
    productionData = results?.[0];
    adjustmentsData = results?.[1];
    dailyData = results?.[2] ? { ...results[2], ...(typeof results[2].production === 'object' ? results[2].production : {}) } : null;
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
  }

  // ── MTD / range values ────────────────────────────────────────────────────
  const grossProductionMtd = safeNum(
    productionData?.grossProduction ?? productionData?.gross_production ?? 0
  );
  const netProductionMtd = safeNum(
    productionData?.netProduction ?? productionData?.net_production ?? productionData?.production ?? grossProductionMtd
  );
  // Adjustments: keep as negative (reductions)
  const productionAdjMtd = safeNum(
    adjustmentsData?.totalAdjustments ?? productionData?.adjustments ?? (netProductionMtd - grossProductionMtd)
  );
  const writeOffsMtd = safeNum(adjustmentsData?.writeOffs ?? productionData?.writeOffs ?? 0);
  const chargeAdjMtd = safeNum(adjustmentsData?.chargeAdjustments ?? 0);

  // ── Daily values ──────────────────────────────────────────────────────────
  const grossProductionDaily = safeNum(
    dailyData?.grossProduction ?? dailyData?.dailyProduction ?? dailyData?.production ?? 0
  );
  const productionAdjDaily = safeNum(
    dailyData?.adjustments ?? dailyData?.dailyAdjustments ?? 0
  );
  const netProductionDaily = dailyData
    ? safeNum(dailyData?.netProduction ?? dailyData?.netDailyProduction ?? (grossProductionDaily + productionAdjDaily))
    : 0;

  diagnostics.rawProduction = productionData;
  diagnostics.rawAdjustments = adjustmentsData;
  diagnostics.rawDaily = dailyData;

  return {
    // MTD / range
    gross_production_mtd: grossProductionMtd,
    production_adjustments_mtd: productionAdjMtd,
    net_production_mtd: netProductionMtd,
    write_offs_mtd: writeOffsMtd,
    charge_adjustments_mtd: chargeAdjMtd,

    // Daily
    gross_production_daily: grossProductionDaily,
    production_adjustments_daily: productionAdjDaily,
    net_production_daily: netProductionDaily,

    // Aliases for backward compat
    grossProduction: grossProductionMtd,
    netProduction: netProductionMtd,
    totalAdjustments: productionAdjMtd,

    _diagnostics: diagnostics,
  };
};

// ─── COLLECTION METRICS ───────────────────────────────────────────────────────

/**
 * fetchCollectionMetrics
 *
 * Returns all collection metrics for a date range and office.
 * This is the canonical source for:
 *   insurance_collections_daily / insurance_collections_mtd
 *   patient_collections_daily / patient_collections_mtd
 *   total_collections_daily / total_collections_mtd
 *   payment_source_breakdown_daily / payment_source_breakdown_mtd
 *
 * @param {{ startDate, endDate, officeIds?, dailyDate? }} params
 * @returns {Promise<CollectionMetrics>}
 */
export const fetchCollectionMetrics = async ({ startDate, endDate, officeIds = [], dailyDate = null }) => {
  if (officeIds.length > 1 && !officeIds.includes('all')) {
    return fetchSelectedFinancialMetrics({ startDate, endDate, officeIds, dailyDate }, 'collections');
  }
  const locationId = resolveLocationId(officeIds);

  const diagnostics = {
    metric: 'collections',
    endpoint: `/v2/collections/summary`,
    locationId,
    officeIds,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let collectionsData = null;
  let dailyData = null;

  try {
    const fetches = [
      ascendApi?.getCollections(startDate, endDate, locationId)?.catch(e => { diagnostics?.errors?.push({ key: 'collections', error: e?.message }); return null; }),
    ];
    if (dailyDate) {
      fetches?.push(
        ascendApi?.getDailySummary(dailyDate, locationId)?.catch(e => { diagnostics?.errors?.push({ key: 'daily', error: e?.message }); return null; })
      );
    }
    const results = await Promise.all(fetches);
    collectionsData = results?.[0];
    dailyData = results?.[1] ? { ...results[1], ...(typeof results[1].collections === 'object' ? results[1].collections : {}) } : null;
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
  }

  // ── MTD / range values ────────────────────────────────────────────────────
  // Collections from Dentrix may be negative (payments reduce AR).
  // We store raw sign but expose abs() for display metrics.
  const insuranceCollMtd = Math.abs(safeNum(
    collectionsData?.insuranceCollections ?? collectionsData?.insurance_collections ?? 0
  ));
  const patientCollMtd = Math.abs(safeNum(
    collectionsData?.patientCollections ?? collectionsData?.patient_collections ?? 0
  ));
  const totalCollMtd = Math.abs(safeNum(
    collectionsData?.totalCollections ?? collectionsData?.total_collections ?? collectionsData?.collections ?? 0
  ));

  // Payment source breakdown
  const checksPostedMtd = safeNum(collectionsData?.checksPosted ?? collectionsData?.checks ?? 0);
  const eftsPostedMtd = safeNum(collectionsData?.eftsPosted ?? collectionsData?.efts ?? collectionsData?.eft ?? 0);
  const creditCardsMtd = safeNum(collectionsData?.creditCards ?? collectionsData?.credit_cards ?? 0);
  const cashMtd = safeNum(collectionsData?.cash ?? 0);

  // ── Daily values ──────────────────────────────────────────────────────────
  const insuranceCollDaily = Math.abs(safeNum(
    dailyData?.insuranceCollections ?? dailyData?.dailyInsuranceCollections ?? 0
  ));
  const patientCollDaily = Math.abs(safeNum(
    dailyData?.patientCollections ?? dailyData?.dailyPatientCollections ?? 0
  ));
  const totalCollDaily = Math.abs(safeNum(
    dailyData?.totalCollections ?? dailyData?.dailyTotalCollections ?? (insuranceCollDaily + patientCollDaily)
  ));
  const checksPostedDaily = safeNum(dailyData?.checksPosted ?? dailyData?.insuranceChecksPosted ?? 0);
  const eftsPostedDaily = safeNum(dailyData?.eftsPosted ?? dailyData?.eftPosted ?? 0);

  // Collection rate: use net production as denominator (eAssist style)
  const collectionRate = collectionsData?.collectionRate != null
    ? safeNum(collectionsData?.collectionRate)
    : null;

  diagnostics.rawCollections = collectionsData;
  diagnostics.rawDaily = dailyData;

  return {
    // MTD / range
    insurance_collections_mtd: insuranceCollMtd,
    patient_collections_mtd: patientCollMtd,
    total_collections_mtd: totalCollMtd,
    checks_posted_mtd: checksPostedMtd,
    efts_posted_mtd: eftsPostedMtd,
    credit_cards_mtd: creditCardsMtd,
    cash_mtd: cashMtd,

    // Daily
    insurance_collections_daily: insuranceCollDaily,
    patient_collections_daily: patientCollDaily,
    total_collections_daily: totalCollDaily,
    checks_posted_daily: checksPostedDaily,
    efts_posted_daily: eftsPostedDaily,

    // Ratio
    collection_rate: collectionRate,

    // Aliases
    totalCollections: totalCollMtd,
    insuranceCollections: insuranceCollMtd,
    patientCollections: patientCollMtd,

    _diagnostics: diagnostics,
  };
};

// ─── COMBINED DAILY SUMMARY ───────────────────────────────────────────────────

/**
 * fetchDailySummaryMetrics
 *
 * Fetches the complete eAssist-style daily summary for a specific date and office.
 * Returns all 6 production fields + all 6 collection fields + MTD totals.
 *
 * This is the canonical source for the eAssist Daily Report parity check.
 *
 * @param {{ date, officeIds? }} params
 * @returns {Promise<DailySummaryMetrics>}
 */
export const fetchDailySummaryMetrics = async ({ date, officeIds = [] }) => {
  const locationId = resolveLocationId(officeIds);

  // Compute MTD range: first day of month → date
  const d = new Date(date + 'T00:00:00');
  const year = d?.getFullYear();
  const month = String(d?.getMonth() + 1)?.padStart(2, '0');
  const mtdStart = `${year}-${month}-01`;
  const mtdEnd = date;

  const diagnostics = {
    metric: 'daily_summary',
    date,
    mtdStart,
    mtdEnd,
    locationId,
    officeIds,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  try {
    const [dailyRes, prodRes, collRes, adjRes] = await Promise.allSettled([
      ascendApi?.getDailySummary(date, locationId),
      ascendApi?.getProduction(mtdStart, mtdEnd, locationId),
      ascendApi?.getCollections(mtdStart, mtdEnd, locationId),
      ascendApi?.getAdjustmentsSummary(mtdStart, mtdEnd, locationId),
    ]);

    const daily = dailyRes?.status === 'fulfilled' ? dailyRes?.value : null;
    const prod = prodRes?.status === 'fulfilled' ? prodRes?.value : null;
    const coll = collRes?.status === 'fulfilled' ? collRes?.value : null;
    const adj = adjRes?.status === 'fulfilled' ? adjRes?.value : null;

    if (dailyRes?.status === 'rejected') diagnostics?.errors?.push({ key: 'daily', error: dailyRes?.reason?.message });
    if (prodRes?.status === 'rejected') diagnostics?.errors?.push({ key: 'production', error: prodRes?.reason?.message });
    if (collRes?.status === 'rejected') diagnostics?.errors?.push({ key: 'collections', error: collRes?.reason?.message });
    if (adjRes?.status === 'rejected') diagnostics?.errors?.push({ key: 'adjustments', error: adjRes?.reason?.message });

    // ── Daily production ──────────────────────────────────────────────────
    const dailyProduction = safeNum(daily?.grossProduction ?? daily?.production?.grossProduction ?? daily?.production?.totalProduction ?? daily?.dailyProduction ?? daily?.production ?? 0);
    const dailyAdj = safeNum(daily?.adjustments ?? daily?.production?.adjustments ?? daily?.dailyAdjustments ?? 0);
    const netDailyProduction = safeNum(daily?.netProduction ?? daily?.production?.netProduction ?? daily?.netDailyProduction ?? (dailyProduction + dailyAdj));

    // ── Daily collections ─────────────────────────────────────────────────
    const dailyInsuranceColl = Math.abs(safeNum(daily?.insuranceCollections ?? daily?.collections?.insuranceCollections ?? daily?.collections?.insurance ?? daily?.dailyInsuranceCollections ?? 0));
    const dailyPatientColl = Math.abs(safeNum(daily?.patientCollections ?? daily?.collections?.patientCollections ?? daily?.collections?.patient ?? daily?.dailyPatientCollections ?? 0));
    const dailyTotalColl = Math.abs(safeNum(daily?.totalCollections ?? daily?.collections?.totalCollections ?? daily?.collections?.total ?? daily?.dailyTotalCollections ?? (dailyInsuranceColl + dailyPatientColl)));

    // ── MTD production ────────────────────────────────────────────────────
    const monthlyProduction = safeNum(prod?.grossProduction ?? prod?.gross_production ?? 0);
    const monthlyAdj = safeNum(adj?.totalAdjustments ?? prod?.adjustments ?? 0);
    const netMonthlyProduction = safeNum(prod?.netProduction ?? prod?.net_production ?? monthlyProduction);

    // ── MTD collections ───────────────────────────────────────────────────
    const monthlyInsuranceColl = Math.abs(safeNum(coll?.insuranceCollections ?? 0));
    const monthlyPatientColl = Math.abs(safeNum(coll?.patientCollections ?? 0));
    const totalMonthlyColl = Math.abs(safeNum(coll?.totalCollections ?? (monthlyInsuranceColl + monthlyPatientColl)));

    // ── Payment breakdown (daily) ─────────────────────────────────────────
    const checksPostedToday = safeNum(daily?.checksPosted ?? daily?.collections?.checksPosted ?? daily?.insuranceChecksPosted ?? 0);
    const eftsPostedToday = safeNum(daily?.eftsPosted ?? daily?.collections?.eftsPosted ?? daily?.eftPosted ?? daily?.collections?.eftPosted ?? 0);

    // ── Structured payment_breakdown from /v2/reports/daily-summary ───────
    const pb = daily?.payment_breakdown ?? null;

    // Helper: returns null if pb is null/undefined (field not present),
    // returns the numeric value (including real 0) if pb exists.
    const pbField = (key) => {
      if (pb == null) return null;
      const v = pb?.[key];
      if (v === null || v === undefined) return null;
      const n = parseFloat(v);
      return isFinite(n) && !isNaN(n) ? n : null;
    };

    const paymentBreakdown = pb != null ? {
      insurance_check:              pbField('insurance_check'),
      insurance_eft:                pbField('insurance_eft'),
      insurance_credit_card:        pbField('insurance_credit_card'),
      insurance_other:              pbField('insurance_other'),
      insurance_unknown:            pbField('insurance_unknown'),
      patient_cash:                 pbField('patient_cash'),
      patient_check:                pbField('patient_check'),
      patient_credit_card:          pbField('patient_credit_card'),
      patient_eft_online:           pbField('patient_eft_online'),
      patient_financing:            pbField('patient_financing'),
      patient_other:                pbField('patient_other'),
      patient_unknown:              pbField('patient_unknown'),
      pos_collections:              pbField('pos_collections'),
      total_insurance_collections:  pbField('total_insurance_collections'),
      total_patient_collections:    pbField('total_patient_collections'),
      total_daily_collections:      pbField('total_daily_collections'),
    } : null;

    const paymentBreakdownSourceNote = daily?.payment_breakdown_source_note ?? null;
    const paymentMethodMappingStatus = daily?.payment_method_mapping_status ?? null;
    const unmappedPaymentMethodCount = daily?.unmapped_payment_method_count ?? null;
    const unmappedPaymentMethodAmount = daily?.unmapped_payment_method_amount ?? null;

    // ── Collection ratio (eAssist style: total_coll / net_production) ─────
    const collectionRatioMtd = netMonthlyProduction > 0
      ? (totalMonthlyColl / netMonthlyProduction) * 100
      : null;

    diagnostics.rawDaily = daily;
    diagnostics.rawProduction = prod;
    diagnostics.rawCollections = coll;
    diagnostics.rawAdjustments = adj;

    return {
      date,
      mtdStart,
      mtdEnd,
      locationId,

      // ── Daily production (eAssist format) ────────────────────────────────
      daily_production: dailyProduction,
      daily_adj: dailyAdj,
      net_daily_production: netDailyProduction,

      // ── Daily collections (eAssist format) ───────────────────────────────
      daily_insurance_coll: dailyInsuranceColl,
      daily_patient_coll: dailyPatientColl,
      daily_total_coll: dailyTotalColl,

      // ── MTD production (eAssist format) ──────────────────────────────────
      monthly_production: monthlyProduction,
      monthly_adj: monthlyAdj,
      net_monthly_production: netMonthlyProduction,

      // ── MTD collections (eAssist format) ─────────────────────────────────
      monthly_insurance_coll: monthlyInsuranceColl,
      monthly_patient_coll: monthlyPatientColl,
      total_monthly_coll: totalMonthlyColl,

      // ── Payment breakdown ─────────────────────────────────────────────────
      checks_posted_today: checksPostedToday,
      efts_posted_today: eftsPostedToday,
      insurance_collections_total_today: dailyInsuranceColl,
      patient_collections_total_today: dailyPatientColl,

      // ── Structured payment breakdown ──────────────────────────────────────
      payment_breakdown: paymentBreakdown,
      payment_breakdown_source_note: paymentBreakdownSourceNote,
      payment_method_mapping_status: paymentMethodMappingStatus,
      unmapped_payment_method_count: unmappedPaymentMethodCount,
      unmapped_payment_method_amount: unmappedPaymentMethodAmount,

      // ── Ratios ────────────────────────────────────────────────────────────
      collection_ratio_mtd: collectionRatioMtd,

      _diagnostics: diagnostics,
    };
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
    return {
      date, mtdStart, mtdEnd, locationId,
      daily_production: 0, daily_adj: 0, net_daily_production: 0,
      daily_insurance_coll: 0, daily_patient_coll: 0, daily_total_coll: 0,
      monthly_production: 0, monthly_adj: 0, net_monthly_production: 0,
      monthly_insurance_coll: 0, monthly_patient_coll: 0, total_monthly_coll: 0,
      checks_posted_today: 0, efts_posted_today: 0,
      insurance_collections_total_today: 0, patient_collections_total_today: 0,
      payment_breakdown: null,
      payment_breakdown_source_note: null,
      payment_method_mapping_status: null,
      unmapped_payment_method_count: null,
      unmapped_payment_method_amount: null,
      collection_ratio_mtd: null,
      _diagnostics: diagnostics,
    };
  }
};

// ─── CLAIMS / RCM METRICS ─────────────────────────────────────────────────────

/**
 * fetchClaimSubmissionsMetrics
 *
 * Fetches claim submission metrics from /v2/rcm/claim-submissions using
 * dateBasis=sentDate for the Dentrix Daily Summary Claims/Submission card.
 *
 * Source: Dentrix Ascend claim lifecycle (insurance_claims table).
 * Do NOT use for eAssist follow-up activity — that belongs in eAssist Reports.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<ClaimSubmissionsMetrics>}
 */
export const fetchClaimSubmissionsMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  // For claim-submissions, pass officeId (dashboard UUID), not locationId
  const officeId = (Array.isArray(officeIds) && officeIds?.length === 1) ? officeIds?.[0] : null;

  const diagnostics = {
    metric: 'claim_submissions',
    endpoint: `/v2/rcm/claim-submissions`,
    dateBasis: 'sentDate',
    officeId,
    officeIds,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let summary = null;

  try {
    const res = await ascendApi?.getClaimSubmissions(
      startDate,
      endDate,
      'sentDate',
      officeId,
      null,
      null,
      1,
      100
    );
    summary = res?.summary ?? res ?? null;
  } catch (err) {
    diagnostics?.errors?.push({ key: 'claim_submissions', error: err?.message });
  }

  diagnostics.rawSummary = summary;

  const s = summary ?? {};

  // Electronic = electronic + electronic_unconfirmed
  const electronicClaims = safeNum(s?.electronic_claims ?? 0);
  const electronicUnconfirmed = safeNum(s?.electronic_unconfirmed_claims ?? 0);
  const claimsSentElectronically = electronicClaims + electronicUnconfirmed;

  // Printed/mail — backend may use either key
  const claimsSentByMail = safeNum(s?.printed_mail_claims ?? s?.printed_mailed_claims ?? 0);

  return {
    // Total Claims Submitted (MTD)
    claims_submitted_mtd: safeNum(s?.submitted_claims ?? 0),
    // Claims Submitted Within 24 Hours
    claims_submitted_within_24h_mtd: safeNum(s?.submitted_within_24h_count ?? 0),
    // 24-Hour Claim Submission Rate
    claim_submission_rate_24h: s?.submission_24h_rate != null ? safeNum(s?.submission_24h_rate) : null,
    // Claims Pending Submission (unsent)
    claims_pending_submission: safeNum(s?.unsent_claims ?? 0),
    // Claims Sent Electronically (electronic + electronic_unconfirmed)
    claims_sent_electronically: claimsSentElectronically,
    // Claims Sent by Mail / Print
    claims_sent_by_mail: claimsSentByMail,
    // Claims Corrected & Resubmitted
    claims_corrected_and_resubmitted: safeNum(s?.resubmitted_claims ?? 0),
    // Total Pre-Auths Sent
    preauths_sent: safeNum(s?.predetermination_claims ?? 0),
    // Claims with Attachments
    claims_with_attachments: safeNum(s?.claims_with_attachments ?? 0),

    _diagnostics: diagnostics,
  };
};

/**
 * fetchClaimsMetrics
 *
 * Returns all claims submission and follow-up metrics.
 * This is the canonical source for eAssist claims section parity.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<ClaimsMetrics>}
 */
export const fetchClaimsMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = resolveLocationId(officeIds);

  const diagnostics = {
    metric: 'claims',
    endpoint: `/v2/rcm/claims`,
    locationId,
    officeIds,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let claims = [];
  let rcmDashboard = null;

  try {
    const [claimsRes, dashRes] = await Promise.allSettled([
      ascendApi?.getClaims(startDate, endDate, locationId),
      ascendApi?.getRcmDashboard(startDate, endDate, locationId),
    ]);

    if (claimsRes?.status === 'fulfilled') {
      claims = normalizeResponse(claimsRes?.value);
    } else {
      diagnostics?.errors?.push({ key: 'claims', error: claimsRes?.reason?.message });
    }
    if (dashRes?.status === 'fulfilled') {
      rcmDashboard = dashRes?.value;
    } else {
      diagnostics?.errors?.push({ key: 'rcm_dashboard', error: dashRes?.reason?.message });
    }
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
  }

  // ── Submission metrics ────────────────────────────────────────────────────
  const totalSubmitted = rcmDashboard?.totalClaimsSubmitted ?? claims?.filter(c => c?.dateSubmitted || c?.date_submitted)?.length;
  const submittedWithin24h = rcmDashboard?.claimsSubmittedWithin24h ?? claims?.filter(c => {
    const created = c?.dateCreated || c?.date_created;
    const submitted = c?.dateSubmitted || c?.date_submitted;
    if (!created || !submitted) return false;
    const diffMs = new Date(submitted) - new Date(created);
    return diffMs <= 86400000; // 24 hours
  })?.length;

  const submissionRate24h = totalSubmitted > 0
    ? (submittedWithin24h / totalSubmitted) * 100
    : null;

  const pendingSubmission = rcmDashboard?.claimsPendingSubmission
    ?? claims?.filter(c => ['pending', 'draft', 'not_submitted']?.includes(String(c?.status || '')?.toLowerCase()))?.length;

  const sentElectronically = rcmDashboard?.claimsSentElectronically
    ?? claims?.filter(c => ['electronic', 'edi', 'clearinghouse']?.includes(String(c?.submissionMethod || c?.claimType || '')?.toLowerCase()))?.length;

  const sentByMail = rcmDashboard?.claimsSentByMail
    ?? claims?.filter(c => ['mail', 'paper']?.includes(String(c?.submissionMethod || '')?.toLowerCase()))?.length;

  const correctedResubmitted = rcmDashboard?.claimsCorrectedResubmitted
    ?? claims?.filter(c => ['corrected', 'resubmitted', 'corrected_resubmitted']?.includes(String(c?.status || '')?.toLowerCase()))?.length;

  const preAuthsSent = rcmDashboard?.preAuthsSent ?? 0;

  diagnostics.rawClaims = claims?.slice(0, 5); // sample for diagnostics
  diagnostics.rawDashboard = rcmDashboard;
  diagnostics.totalClaimsLoaded = claims?.length;

  return {
    // Submission counts
    claims_submitted_mtd: totalSubmitted,
    claims_submitted_within_24h_mtd: submittedWithin24h,
    claim_submission_rate_24h: submissionRate24h,
    claims_pending_submission: pendingSubmission,
    claims_sent_electronically: sentElectronically,
    claims_sent_by_mail: sentByMail,
    claims_corrected_and_resubmitted: correctedResubmitted,
    preauths_sent: preAuthsSent,

    // Follow-up (from RCM dashboard if available)
    claims_30_plus_followed_up_today: rcmDashboard?.followUpToday ?? 0,
    claims_30_plus_followed_up_mtd: rcmDashboard?.followUpMtd ?? 0,

    // Raw claims for drill-down
    claims,

    _diagnostics: diagnostics,
  };
};

// ─── AR AGING METRICS ─────────────────────────────────────────────────────────

/**
 * fetchArAgingMetrics
 *
 * Returns AR aging buckets in eAssist format:
 *   Total: 0-30, 31-60, 61-90, Over 90
 *   Insurance: 0-30, 31-60, 61-90, Over 90
 *   Patient: 0-30, 31-60, 61-90, Over 90
 *
 * NOTE: eAssist uses 0-30/31-60/61-90/Over 90 buckets.
 * Dentrix may use 0-29/30-59/60-89/90+ — we normalize to eAssist format.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<ArAgingMetrics>}
 */
export const fetchArAgingMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = resolveLocationId(officeIds);

  const diagnostics = {
    metric: 'ar_aging',
    endpoint: `/v2/rcm/ar-aging`,
    locationId,
    officeIds,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let records = [];
  let dashboardAging = null;

  try {
    const [agingRes, dashRes] = await Promise.allSettled([
      ascendApi?.getArAging(startDate, endDate, locationId),
      ascendApi?.getRcmDashboard(startDate, endDate, locationId),
    ]);

    if (agingRes?.status === 'fulfilled') {
      records = normalizeResponse(agingRes?.value);
    } else {
      diagnostics?.errors?.push({ key: 'ar_aging', error: agingRes?.reason?.message });
    }
    if (dashRes?.status === 'fulfilled') {
      dashboardAging = dashRes?.value?.arAging;
    }
  } catch (err) {
    diagnostics?.errors?.push({ key: 'global', error: err?.message });
  }

  // ── Aggregate buckets ─────────────────────────────────────────────────────
  // eAssist bucket boundaries: 0-30, 31-60, 61-90, Over 90
  const bucketRecord = (r) => {
    const days = safeNum(r?.daysOutstanding ?? r?.days_outstanding ?? r?.balanceAgingDays ?? 0);
    if (days <= 30) return '0_30';
    if (days <= 60) return '31_60';
    if (days <= 90) return '61_90';
    return 'over_90';
  };

  // Prefer pre-bucketed data from dashboard endpoint
  const agingFromDash = dashboardAging?.[0] || dashboardAging;

  const ar_total_0_30 = safeNum(agingFromDash?.bucket0_30 ?? agingFromDash?.ar_0_30 ?? records?.filter(r => bucketRecord(r) === '0_30')?.reduce((s, r) => s + safeNum(r?.balance ?? r?.outstandingBalance ?? 0), 0));
  const ar_total_31_60 = safeNum(agingFromDash?.bucket31_60 ?? agingFromDash?.ar_31_60 ?? records?.filter(r => bucketRecord(r) === '31_60')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0));
  const ar_total_61_90 = safeNum(agingFromDash?.bucket61_90 ?? agingFromDash?.ar_61_90 ?? records?.filter(r => bucketRecord(r) === '61_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0));
  const ar_total_over_90 = safeNum(agingFromDash?.bucket90plus ?? agingFromDash?.ar_over_90 ?? records?.filter(r => bucketRecord(r) === 'over_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0));

  // Insurance vs patient split
  const insuranceRecords = records?.filter(r => r?.balanceType === 'insurance' || r?.claimId || r?.claim_id);
  const patientRecords = records?.filter(r => r?.balanceType === 'patient' || (!r?.claimId && !r?.claim_id));

  const ar_insurance_0_30 = insuranceRecords?.filter(r => bucketRecord(r) === '0_30')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_insurance_31_60 = insuranceRecords?.filter(r => bucketRecord(r) === '31_60')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_insurance_61_90 = insuranceRecords?.filter(r => bucketRecord(r) === '61_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_insurance_over_90 = insuranceRecords?.filter(r => bucketRecord(r) === 'over_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);

  const ar_patient_0_30 = patientRecords?.filter(r => bucketRecord(r) === '0_30')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_patient_31_60 = patientRecords?.filter(r => bucketRecord(r) === '31_60')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_patient_61_90 = patientRecords?.filter(r => bucketRecord(r) === '61_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);
  const ar_patient_over_90 = patientRecords?.filter(r => bucketRecord(r) === 'over_90')?.reduce((s, r) => s + safeNum(r?.balance ?? 0), 0);

  diagnostics.totalRecords = records?.length;

  return {
    // Total AR aging (eAssist format)
    ar_total_0_30,
    ar_total_31_60,
    ar_total_61_90,
    ar_total_over_90,
    ar_total: ar_total_0_30 + ar_total_31_60 + ar_total_61_90 + ar_total_over_90,

    // Insurance AR aging
    ar_insurance_0_30,
    ar_insurance_31_60,
    ar_insurance_61_90,
    ar_insurance_over_90,
    ar_insurance_total: ar_insurance_0_30 + ar_insurance_31_60 + ar_insurance_61_90 + ar_insurance_over_90,

    // Patient AR aging
    ar_patient_0_30,
    ar_patient_31_60,
    ar_patient_61_90,
    ar_patient_over_90,
    ar_patient_total: ar_patient_0_30 + ar_patient_31_60 + ar_patient_61_90 + ar_patient_over_90,

    // Raw records for drill-down
    records,

    _diagnostics: diagnostics,
  };
};

// ─── PATIENT FINANCE METRICS ──────────────────────────────────────────────────

/**
 * fetchOfficialArAgingMetrics
 *
 * Returns official Dentrix Ascend Aged Receivables data from
 * GET /v2/rcm/ar-aging-official (which proxies /v1/agingbalances/report).
 *
 * This is the source-of-truth AR for Dentrix Daily Summary.
 * It is NOT a date-range report — it returns current as-of A/R.
 *
 * @param {{ officeId?: string }} params
 *   officeId — Supabase UUID of the selected office, or omit for All Offices.
 *   Do NOT pass locationId here.
 * @returns {Promise<OfficialArAgingMetrics>}
 */
export const fetchOfficialArAgingMetrics = async ({ officeId = null } = {}) => {
  const diagnostics = {
    metric: 'official_ar_aging',
    endpoint: '/v2/rcm/ar-aging-official',
    officeId,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let raw = null;

  try {
    raw = await ascendApi?.getArAgingOfficial(officeId || null);
  } catch (err) {
    diagnostics?.errors?.push({ key: 'ar_aging_official', error: err?.message });
    return {
      ar_aging: null,
      metadata: null,
      _diagnostics: diagnostics,
    };
  }

  const aging = raw?.ar_aging || null;
  const meta = raw?.metadata || null;

  const total = aging?.total || {};
  const insurance = aging?.insurance || {};
  const patient = aging?.patient || {};

  return {
    // Total buckets
    ar_total_0_30:    safeNum(total?.current),
    ar_total_31_60:   safeNum(total?.b30),
    ar_total_61_90:   safeNum(total?.b60),
    ar_total_over_90: safeNum(total?.b90),
    ar_total_total:   safeNum(total?.total),

    // Insurance buckets
    ar_insurance_0_30:    safeNum(insurance?.current),
    ar_insurance_31_60:   safeNum(insurance?.b30),
    ar_insurance_61_90:   safeNum(insurance?.b60),
    ar_insurance_over_90: safeNum(insurance?.b90),
    ar_insurance_total:   safeNum(insurance?.total),

    // Patient buckets
    ar_patient_0_30:    safeNum(patient?.current),
    ar_patient_31_60:   safeNum(patient?.b30),
    ar_patient_61_90:   safeNum(patient?.b60),
    ar_patient_over_90: safeNum(patient?.b90),
    ar_patient_total:   safeNum(patient?.total),

    // Summary fields
    unapplied_credits:   safeNum(aging?.unapplied_credits),
    estimated_writeoff:  safeNum(aging?.estimated_writeoff),
    net_balance:         safeNum(aging?.net_balance),

    // Visibility flag — backend suppresses unapplied_credits unless super_admin context is available
    unapplied_credits_visible: raw?.unapplied_credits_visible === true,

    // Metadata
    as_of_date:          aging?.as_of_date || null,
    source_note:         meta?.source_note || null,
    cached_at:           meta?.cached_at || null,
    cache_ttl_minutes:   meta?.cache_ttl_minutes ?? null,
    from_cache:          meta?.from_cache ?? null,
    patient_count:       meta?.patient_count ?? null,
    is_official_ar:      meta?.is_official_ar ?? null,

    _diagnostics: diagnostics,
  };
};

/**
 * fetchPatientFinanceMetrics
 *
 * Returns patient balance and credit counts.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<PatientFinanceMetrics>}
 */
export const fetchPatientFinanceMetrics = async ({ startDate, endDate, officeIds = [] }) => {
  const locationId = resolveLocationId(officeIds);

  const diagnostics = {
    metric: 'patient_finance',
    locationId,
    officeIds,
    startDate,
    endDate,
    fetchedAt: new Date()?.toISOString(),
    errors: [],
  };

  let statementsData = null;

  try {
    const res = await ascendApi?.getPatientStatements(startDate, endDate, locationId);
    statementsData = normalizeResponse(res);
  } catch (err) {
    diagnostics?.errors?.push({ key: 'patient_statements', error: err?.message });
  }

  const withBalances = statementsData?.filter(r => safeNum(r?.balance ?? r?.patientBalance ?? 0) > 0) || [];
  const withCredits = statementsData?.filter(r => safeNum(r?.balance ?? r?.patientBalance ?? 0) < 0) || [];

  const balanceTotal = withBalances?.reduce((s, r) => s + safeNum(r?.balance ?? r?.patientBalance ?? 0), 0);
  const creditTotal = Math.abs(withCredits?.reduce((s, r) => s + safeNum(r?.balance ?? r?.patientBalance ?? 0), 0));

  diagnostics.totalRecords = statementsData?.length || 0;

  return {
    patients_with_balances_count: withBalances?.length,
    patients_with_credits_count: withCredits?.length,
    balance_total_amount: balanceTotal,
    credit_total_amount: creditTotal,
    _diagnostics: diagnostics,
  };
};

// ─── FULL NORMALIZED METRICS (all-in-one) ────────────────────────────────────

/**
 * fetchNormalizedMetrics
 *
 * Fetches ALL canonical metrics in one call.
 * This is the primary entry point for dashboard tabs.
 *
 * @param {{ startDate, endDate, officeIds?, dailyDate? }} params
 * @returns {Promise<NormalizedMetrics>}
 */
export const fetchNormalizedMetrics = async ({ startDate, endDate, officeIds = [], dailyDate = null }) => {
  const [prodResult, collResult, claimsResult, arResult, patientResult] = await Promise.allSettled([
    fetchProductionMetrics({ startDate, endDate, officeIds, dailyDate }),
    fetchCollectionMetrics({ startDate, endDate, officeIds, dailyDate }),
    fetchClaimsMetrics({ startDate, endDate, officeIds }),
    fetchArAgingMetrics({ startDate, endDate, officeIds }),
    fetchPatientFinanceMetrics({ startDate, endDate, officeIds }),
  ]);

  const prod = prodResult?.status === 'fulfilled' ? prodResult?.value : {};
  const coll = collResult?.status === 'fulfilled' ? collResult?.value : {};
  let claims = claimsResult?.status === 'fulfilled' ? claimsResult?.value : {};
  const ar = arResult?.status === 'fulfilled' ? arResult?.value : {};
  const patient = patientResult?.status === 'fulfilled' ? patientResult?.value : {};

  // ── Collection ratio (eAssist style) ─────────────────────────────────────
  // eAssist: Total Monthly Collections / Net Monthly Production
  const netProd = prod?.net_production_mtd ?? 0;
  const totalColl = coll?.total_collections_mtd ?? 0;
  const practice_collection_ratio = netProd > 0 ? (totalColl / netProd) * 100 : null;

  return {
    // Production
    ...prod,
    // Collections
    ...coll,
    // Claims
    ...claims,
    // AR Aging
    ...ar,
    // Patient Finance
    ...patient,
    // Ratio
    practice_collection_ratio,
    // Metadata
    startDate,
    endDate,
    officeIds,
    dailyDate,
    _fetchedAt: new Date()?.toISOString(),
    _diagnostics: {
      production: prod?._diagnostics,
      collections: coll?._diagnostics,
      claims: claims?._diagnostics,
      ar_aging: ar?._diagnostics,
      patient_finance: patient?._diagnostics,
    },
  };
};

// ─── BENCHMARK RECONCILIATION ─────────────────────────────────────────────────

/**
 * fetchBenchmarkReconciliation
 *
 * Fetches the eAssist benchmark rows from Supabase and compares against
 * live Dentrix API values for the same office/date combinations.
 *
 * @param {{ officeCanonical?, startDate?, endDate? }} params
 * @returns {Promise<ReconciliationResult[]>}
 */
export const fetchBenchmarkReconciliation = async ({ officeCanonical = null, startDate = null, endDate = null } = {}) => {
  let query = supabase?.from('benchmark_eassist_daily_reports_2026')?.select('*')?.order('report_date', { ascending: false });

  if (officeCanonical) query = query?.eq('office_canonical', officeCanonical);
  if (startDate) query = query?.gte('report_date', startDate);
  if (endDate) query = query?.lte('report_date', endDate);

  const { data, error } = await query?.limit(200);
  if (error) throw error;
  return data || [];
};

/**
 * fetchBenchmarkReconciliationSummary
 *
 * Returns the reconciliation view with mismatch flags.
 */
export const fetchBenchmarkReconciliationSummary = async () => {
  const { data, error } = await supabase?.from('v_benchmark_reconciliation_summary')?.select('*')?.order('report_date', { ascending: false })?.limit(200);

  if (error) {
    // View may not exist yet — return empty
    console.warn('[dentrixNormalizedService] v_benchmark_reconciliation_summary not available:', error?.message);
    return [];
  }
  return data || [];
};

// ─── OFFICE-LEVEL FAN-OUT ─────────────────────────────────────────────────────

/**
 * fetchNormalizedMetricsByOffice
 *
 * Fetches normalized metrics for each office individually and returns
 * an array of per-office results. Used for office comparison views.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<Array<{ officeName, officeId, metrics }>>}
 */
export const fetchNormalizedMetricsByOffice = async ({ startDate, endDate, officeIds = [] }) => {
  const officesToFetch = officeIds?.length > 0
    ? ALL_DENTRIX_OFFICES?.filter(o => officeIds?.includes(o?.officeId))
    : ALL_DENTRIX_OFFICES;

  const results = await Promise.allSettled(
    officesToFetch?.map(async (office) => {
      const metrics = await fetchNormalizedMetrics({
        startDate,
        endDate,
        officeIds: [office?.officeId],
      });
      return {
        officeName: office?.officeName,
        officeId: office?.officeId,
        locationId: office?.locationId,
        metrics,
      };
    })
  );

  return results?.filter(r => r?.status === 'fulfilled')?.map(r => r?.value);
};

/**
 * fetchDailyComparisonMetrics
 * ══════════════════════════════════════════════════════════════════════════════
 * Fetches Dentrix/API-integrated daily comparison data from:
 *   GET /v2/rcm/daily-comparison
 *
 * Source rules:
 *  - Does NOT use Supabase daily_entries
 *  - Does NOT use manual-entry data
 *  - Does NOT use monthly_executive_analytics
 *  - Does NOT use eAssist data
 *  - Null/unavailable metrics are preserved as null (display N/A)
 *
 * @param {{ date, officeId, providerId, comparisonMode, comparisonYears, metrics, page, pageSize }} params
 */
export const fetchDailyComparisonMetrics = async ({
  date,
  officeId = null,
  providerId = null,
  comparisonMode = 'daily',
  comparisonYears = 3,
  metrics = null,
  page = 1,
  pageSize = null,
} = {}) => {
  let raw = await ascendApi?.getDailyComparison(
    date,
    officeId,
    providerId,
    comparisonMode,
    comparisonYears,
    metrics,
    page,
    pageSize,
  );
  return raw;
};

export default {
  fetchProductionMetrics,
  fetchCollectionMetrics,
  fetchDailySummaryMetrics,
  fetchClaimsMetrics,
  fetchClaimSubmissionsMetrics,
  fetchArAgingMetrics,
  fetchOfficialArAgingMetrics,
  fetchPatientFinanceMetrics,
  fetchNormalizedMetrics,
  fetchNormalizedMetricsByOffice,
  fetchBenchmarkReconciliation,
  fetchBenchmarkReconciliationSummary,
  resolveLocationId,
  locationIdToOfficeName,
  ALL_DENTRIX_OFFICES,
  fetchDailyComparisonMetrics,
};
