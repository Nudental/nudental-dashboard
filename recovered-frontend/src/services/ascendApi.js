const API_BASE = 'https://api.nudashboard.com/v2';
const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';

const buildHeaders = () => ({
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
});

const safeFetch = async (url) => {
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res?.ok) throw new Error(`Ascend API error: ${res.status}`);
  return res?.json();
};

/**
 * Appends &locationId=<id> to a URL when a locationId is provided.
 * When locationId is null/undefined (All Offices), the param is omitted entirely.
 */
const withLocation = (url, locationId) => {
  if (!locationId) return url;
  const separator = url?.includes('?') ? '&' : '?';
  return `${url}${separator}locationId=${locationId}`;
};

export const ascendApi = {
  health: () =>
    fetch(`${API_BASE?.replace('/v2', '')}/health`, { headers: buildHeaders() })?.then((r) => {
      if (!r?.ok) throw new Error(`health check failed: ${r.status}`);
      return r?.json();
    }),

  /**
   * GET /v2/huddle/prefill
   * Returns prefilled huddle data for a given office and date.
   * Source of truth for provider goals, actuals, collections, new patients, and checklists.
   *
   * @param {string} officeId  Dashboard UUID (office_id from public.offices)
   * @param {string} date      YYYY-MM-DD
   * @returns {Promise<{
   *   office, date, month, goals,
   *   providers: { doctors: [], hygienists: [] },
   *   office_totals: { production, collections, new_patients },
   *   checklists: { front_desk: [], back_office: [] },
   *   sync, warnings
   * }>}
   */
  getHuddlePrefill: ({ officeId, date }) =>
    safeFetch(`${API_BASE}/huddle/prefill?officeId=${encodeURIComponent(officeId)}&date=${encodeURIComponent(date)}`),

  getDailySummary: (date, locationId) =>
    safeFetch(withLocation(`${API_BASE}/reports/daily-summary?date=${date}`, locationId)),

  getMonthlySummary: (year, month, locationId) =>
    safeFetch(withLocation(`${API_BASE}/reports/monthly-summary?year=${year}&month=${month}`, locationId)),

  getProduction: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/production/summary?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getCollections: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/collections/summary?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getAppointments: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/appointments?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getAppointmentsSummary: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/appointments/summary?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getProviders: (locationId) =>
    safeFetch(withLocation(`${API_BASE}/providers`, locationId)),

  getOffices: () =>
    safeFetch(`${API_BASE}/offices`),

  getProductionByProvider: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/reports/provider-performance?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getGoals: (locationId) =>
    safeFetch(withLocation(`${API_BASE}/goals`, locationId)),

  getProviderPerformance: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/reports/provider-performance?startDate=${startDate}&endDate=${endDate}`, locationId)),

  getPatients: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/patients/summary?startDate=${startDate}&endDate=${endDate}`, locationId)),

  /**
   * GET /v2/patients/demographics
   * Returns aggregate-only age buckets and ZIP code distribution.
   * No PHI is returned — only counts and percentages.
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   * @param {string|null} locationId  Dentrix location ID (omit for all offices)
   * @param {string} [mode]     'seen' | 'new' | 'active'  (default: 'seen')
   * @param {string} [serviceCategory]  optional CDT service category filter
   */
  getPatientDemographics: (startDate, endDate, locationId, mode = 'seen', serviceCategory = null) => {
    let url = `${API_BASE}/patients/demographics?startDate=${startDate}&endDate=${endDate}&mode=${mode}`;
    if (serviceCategory) url += `&serviceCategory=${encodeURIComponent(serviceCategory)}`;
    return safeFetch(withLocation(url, locationId));
  },

  // ─── Adjustment Endpoints ─────────────────────────────────────────────────

  /**
   * GET /v2/adjustments/summary
   * Returns aggregated adjustment totals broken down by type.
   */
  getAdjustmentsSummary: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/adjustments/summary?startDate=${startDate}&endDate=${endDate}`, locationId)),

  /**
   * GET /v2/adjustments
   * Returns individual adjustment records (paginated).
   */
  getAdjustments: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/adjustments?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/ledger/adjustments
   */
  getLedgerAdjustments: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/ledger/adjustments?startDate=${startDate}&endDate=${endDate}`, locationId)),

  /**
   * GET /v2/write-offs
   */
  getWriteOffs: (startDate, endDate, locationId) =>
    safeFetch(withLocation(`${API_BASE}/write-offs?startDate=${startDate}&endDate=${endDate}`, locationId)),

  /**
   * GET /v2/rcm/adjustments-review
   * Phase 1 Adjustment Review endpoint.
   * Returns data[], pagination, metadata, summary, and review_queues.
   *
   * Rules:
   *  - summary is full-filter-scope (not page-scoped)
   *  - data[] is paginated
   *  - review_queues are full-scope, capped at 200 per queue
   *  - For All Offices: call once with no locationId — backend handles full scope
   *  - Do NOT fan out for this endpoint
   *
   * @param {string} startDate
   * @param {string} endDate
   * @param {string|null} locationId  — omit for All Offices
   * @param {number} page
   * @param {number} pageSize
   * @param {boolean} includeVoided
   * @param {string|null} adjustmentCategory  — optional filter
   * @param {string|null} reviewFlag          — optional filter
   */
  getAdjustmentsReview: (startDate, endDate, locationId, page = 1, pageSize = 50, includeVoided = false, adjustmentCategory = null, reviewFlag = null) => {
    let url = `${API_BASE}/rcm/adjustments-review?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}&includeVoided=${includeVoided}`;
    if (adjustmentCategory) url += `&adjustmentCategory=${encodeURIComponent(adjustmentCategory)}`;
    if (reviewFlag) url += `&reviewFlag=${encodeURIComponent(reviewFlag)}`;
    return safeFetch(withLocation(url, locationId));
  },

  // ─── RCM Endpoints ────────────────────────────────────────────────────────

  /**
   * GET /v2/rcm/claims
   * Returns insurance claim records for the given date range and location.
   * Expected fields per record:
   *   claimId, patientId, patientName, locationId, payorName, payorId,
   *   dateCreated, dateSubmitted, dateReceived, lastVisitDate, dateOfService,
   *   amountBilled, amountPaid, status, claimType, denialReason
   */
  getClaims: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/claims?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/rcm/claim-submissions
   * True claim lifecycle endpoint sourced from insurance_claims.
   * Supports service date, sent date, and created date basis.
   *
   * Rules:
   *  - summary is full-filter-scope (not page-scoped)
   *  - data[] is paginated via real backend pagination
   *  - For All Offices: call ONCE with no officeId param — backend handles full scope
   *  - Do NOT fan out for this endpoint
   *  - Pass officeId as dashboard UUID (not locationId)
   *
   * @param {string} startDate    YYYY-MM-DD
   * @param {string} endDate      YYYY-MM-DD
   * @param {string} dateBasis    'serviceDate' | 'sentDate' | 'createdDate' (default 'serviceDate')
   * @param {string|null} officeId  Dashboard UUID — omit for All Offices
   * @param {string|null} status    Optional comma-separated normalized statuses
   * @param {string|null} payor     Optional partial payor match
   * @param {number} page
   * @param {number} pageSize
   */
  getClaimSubmissions: (startDate, endDate, dateBasis = 'serviceDate', officeId = null, status = null, payor = null, page = 1, pageSize = 50) => {
    let url = `${API_BASE}/rcm/claim-submissions?startDate=${startDate}&endDate=${endDate}&dateBasis=${dateBasis}&page=${page}&pageSize=${pageSize}`;
    if (officeId) url += `&officeId=${encodeURIComponent(officeId)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (payor) url += `&payor=${encodeURIComponent(payor)}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/daily-comparison
   * Dentrix/API-integrated daily comparison endpoint.
   * Sources: Dentrix Ascend only. Does NOT use daily_entries, monthly_executive_analytics, or eAssist.
   *
   * @param {string} date             YYYY-MM-DD selected date
   * @param {string|null} officeId    Dashboard UUID — omit for All Offices
   * @param {string|null} providerId  Optional provider filter
   * @param {string} comparisonMode   'daily' | 'mtd' | 'monthly_yoy' | 'yearly_yoy'
   * @param {number} comparisonYears  Number of years to compare (default 3)
   * @param {string|null} metrics     Comma-separated metric keys
   * @param {number} page
   * @param {number} pageSize
   */
  getDailyComparison: (date, officeId = null, providerId = null, comparisonMode = 'daily', comparisonYears = 3, metrics = null, page = 1, pageSize = null) => {
    let url = `${API_BASE}/rcm/daily-comparison?date=${date}&comparisonMode=${comparisonMode}&comparisonYears=${comparisonYears}&page=${page}`;
    if (officeId) url += `&officeId=${encodeURIComponent(officeId)}`;
    if (providerId) url += `&providerId=${encodeURIComponent(providerId)}`;
    if (metrics) url += `&metrics=${encodeURIComponent(metrics)}`;
    if (pageSize) url += `&pageSize=${pageSize}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/payment-arrangements
   * Returns patient payment plan / arrangement records.
   * Expected fields:
   *   arrangementId, patientId, patientName, locationId,
   *   arrangementAmount, amountPaid, dueDate, status, createdDate
   */
  getPaymentArrangements: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/payment-arrangements?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/rcm/patient-statements
   * Returns patient statement / balance follow-up records.
   * Expected fields:
   *   statementId, patientId, patientName, locationId,
   *   statementDate, balance, lastContactDate, status
   */
  getPatientStatements: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/patient-statements?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/rcm/pos-collections
   * Returns point-of-service / same-day collection records.
   * Expected fields:
   *   collectionId, patientId, patientName, locationId, claimId,
   *   dateOfService, providerId, providerName, lineOfBusiness,
   *   serviceCodes, amountCollected, expectedAmount
   */
  getPosCollections: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/pos-collections?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/rcm/collection-refunds
   * Returns envelope: { data, summary, pagination, metadata, _source }
   * Supported params: startDate, endDate, officeId, locationId, refundType,
   *   includeNonRefundAdjustments, minAmount, search, page, pageSize
   */
  getCollectionRefunds: ({
    startDate,
    endDate,
    officeId = null,
    locationId = null,
    refundType = 'all',
    includeNonRefundAdjustments = false,
    minAmount = null,
    search = null,
    page = 1,
    pageSize = 50,
  } = {}) => {
    let url = `${API_BASE}/rcm/collection-refunds?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`;
    if (refundType && refundType !== 'all') url += `&refundType=${refundType}`;
    if (includeNonRefundAdjustments) url += `&includeNonRefundAdjustments=true`;
    if (minAmount !== null && minAmount !== '') url += `&minAmount=${minAmount}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    // Pass officeId (UUID) if a specific office is selected — do NOT pass UUID as locationId
    if (officeId) url += `&officeId=${officeId}`;
    // Only pass locationId if it is a real Dentrix locationId (not a UUID)
    if (locationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i?.test(locationId)) {
      url += `&locationId=${locationId}`;
    }
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/dashboard
   * Returns aggregated RCM KPI summary for the dashboard tab.
   * Expected fields:
   *   totalClaimsSubmitted, totalClaimsPaid, totalOutstandingAR,
   *   avgDaysToPayment, collectionRate, denialRate,
   *   byOffice: [{ locationId, submitted, paid, billed, collected }],
   *   arAging: [{ locationId, bucket0_30, bucket31_60, bucket61_90, bucket90plus }]
   */
  getRcmDashboard: (startDate, endDate, locationId) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/dashboard?startDate=${startDate}&endDate=${endDate}`,
      locationId
    )),

  /**
   * GET /v2/rcm/ar-aging
   * Returns patient AR aging records bucketed by days outstanding.
   *
   * Expected fields per record (Dentrix may return pre-bucketed or raw balance):
   *   arId, patientId, patientName, locationId,
   *   balance / patientBalance / outstandingBalance,
   *   bucketCurrent, bucket30, bucket60, bucket90  (optional — computed if absent),
   *   daysOutstanding / balanceAgingDate / dueDate / statementDate / dateOfService,
   *   providerName, payorName, claimId,
   *   lastStatementDate, lastPaymentDate, lastContactDate,
   *   collectionStatus, paymentArrangement
   *
   * If this endpoint returns 404, rcmService.fetchArAging() will automatically
   * fall back to /v2/rcm/patient-statements and then /v2/rcm/claims.
   */
  getArAging: (startDate, endDate, locationId, page = 1, pageSize = 500) =>
    safeFetch(withLocation(
      `${API_BASE}/rcm/ar-aging?startDate=${startDate}&endDate=${endDate}&page=${page}&pageSize=${pageSize}`,
      locationId
    )),

  /**
   * GET /v2/rcm/ar-aging-official
   * Returns official Dentrix Ascend Aged Receivables / Aging Balances data
   * from GET /v1/agingbalances/report.
   *
   * Query behavior:
   *   - All Offices: call with no officeId
   *   - Selected office: pass dashboard officeId UUID (NOT locationId)
   *
   * Response shape:
   *   { ar_aging: { as_of_date, source, total, insurance, patient,
   *                 unapplied_credits, estimated_writeoff, net_balance },
   *     by_office: [], metadata: { ... }, _source }
   */
  getArAgingOfficial: (officeId) => {
    const base = `${API_BASE}/rcm/ar-aging-official`;
    let url = officeId ? `${base}?officeId=${officeId}` : base;
    return safeFetch(url);
  },

  /**
   * GET /v2/financial/filter-options
   * Returns verified filter options for Financial Analytics:
   *   offices, providers, providerTypes, paymentMethods, collectionStatuses,
   *   serviceCategories, savedAnalyses
   *
   * @param {string} startDate  - ISO date string e.g. "2026-04-01"
   * @param {string} endDate    - ISO date string e.g. "2026-04-25"
   * @param {string|null} locationId - optional Dentrix locationId; omit for All Offices
   */
  getFinancialFilterOptions: (startDate, endDate, locationId) =>
    safeFetch(withLocation(
      `${API_BASE}/financial/filter-options?startDate=${startDate}&endDate=${endDate}`,
      locationId
    )),

  /**
   * GET /v2/expenses/summary
   * Returns WF Main Money-Out cash-basis expense totals.
   * Fields:
   *   totals.total_expenses  — WF Main Money-Out true cash-basis total (source of truth)
   *   totals.wf_banking      — fallback alias for total_expenses
   *   totals.payroll         — Gusto payroll detail (review only, NOT added to total)
   *   totals.payroll_taxes   — payroll taxes detail
   *   totals.benefits        — payroll benefits detail
   *   totals.amex            — AmEx bill payments detail
   *   ratios.payroll_pct_of_collections — Gusto payroll ÷ Dentrix collections
   *   ratios.expense_pct_of_collections
   *   ratios.expense_pct_of_production
   */
  getExpensesSummary: (startDate, endDate, locationId) =>
    safeFetch(withLocation(
      `${API_BASE}/expenses/summary?startDate=${startDate}&endDate=${endDate}`,
      locationId
    )),

  /**
   * GET /v2/production/by-cdt-category
   * Returns production grouped by normalized ADA/CDT service category.
   * Supports filters: startDate, endDate, locationId, officeId, providerId, serviceCategory
   * Expected fields per record:
   *   serviceCategory, adaCodeCount, procedureCount,
   *   grossProduction, adjustments, netProduction, percentageOfTotalNetProduction
   */
  getProductionByCdtCategory: (startDate, endDate, locationId, { providerId, serviceCategory } = {}) => {
    let url = `${API_BASE}/production/by-cdt-category?startDate=${startDate}&endDate=${endDate}`;
    if (providerId && providerId !== 'all') url += `&providerId=${encodeURIComponent(providerId)}`;
    if (serviceCategory && serviceCategory !== 'all') url += `&serviceCategory=${encodeURIComponent(serviceCategory)}`;
    return safeFetch(withLocation(url, locationId));
  },

  /**
   * GET /v2/hygiene/retention-metrics
   * Returns hygiene reappointment and retention metrics.
   * Source: sqlite_appointments_patients / appointments_based_retention
   *
   * Confirmed fields:
   *   hygieneCompletedVisits, hygieneReappointedCount, hygieneReappointmentPct,
   *   perioCompletedVisits, perioReappointedCount, perioReappointmentPct,
   *   adultHygieneRetention6moBase, adultHygieneRetention6moReturned, adultHygieneRetention6moPct,
   *   adultHygieneRetention12moBase, adultHygieneRetention12moReturned, adultHygieneRetention12moPct,
   *   childHygieneRetention6moBase, childHygieneRetention6moReturned, childHygieneRetention6moPct,
   *   childHygieneRetention12moBase, childHygieneRetention12moReturned, childHygieneRetention12moPct,
   *   retentionBaseline6mo, retentionBaseline12mo, source, method
   *
   * @param {string} startDate  - ISO date string e.g. "2026-03-01"
   * @param {string} endDate    - ISO date string e.g. "2026-03-31"
   * @param {string|null} locationId - Dentrix locationId; omit for all offices
   */
  getHygieneRetentionMetrics: (startDate, endDate, locationId) =>
    safeFetch(withLocation(
      `${API_BASE}/hygiene/retention-metrics?startDate=${startDate}&endDate=${endDate}`,
      locationId
    )),

  /**
   * GET /v2/hygiene/procedure-metrics
   * Returns hygiene procedure counts and production metrics.
   * Source: Dentrix Ascend procedure records
   *
   * Confirmed fields:
   *   fmxCount, fmxPerDay, srpCount, srpPerDay,
   *   sealantCount, whiteningCount, fluorideCount, prophyCount,
   *   fluoridePct, antimicrobialCount, perioCount, hygieneBaseCount,
   *   perioPct, hygieneProcedureCount, hygieneProduction,
   *   hygieneProductionPerProcedure, hygieneProductionPerAppointment,
   *   mappingCoverage
   *
   * @param {string} startDate  - ISO date string e.g. "2026-03-01"
   * @param {string} endDate    - ISO date string e.g. "2026-03-31"
   * @param {string|null} locationId - Dentrix locationId; omit for all offices
   */
  getHygieneProcedureMetrics: (startDate, endDate, locationId) =>
    safeFetch(withLocation(
      `${API_BASE}/hygiene/procedure-metrics?startDate=${startDate}&endDate=${endDate}`,
      locationId
    )),

  /**
   * GET /v2/production/by-provider-and-cdt-category
   * Returns provider-level production broken down by ADA/CDT service category.
   * Use for: Performance → KPIs → Specialty Providers tab.
   *
   * Supported filters:
   *   locationId  — optional Dentrix locationId; omit for all offices
   *   providerType — optional: doctor | hygienist
   *   specialtyGroup — optional: GP | Oral Surgery | Pediatric Dentistry | Hygiene | Unknown | etc.
   *
   * Response top-level keys:
   *   startDate, endDate, locationId, providerTypeFilter, specialtyGroupFilter,
   *   totalGrossProduction, totalAdjustments, totalNetProduction,
   *   providerPerfNetTotal, reconciliationDiff, reconciliationOk, reconciliationNote,
   *   adjustmentMethod, source, providers[]
   *
   * Provider row fields:
   *   providerId, providerName, providerType, specialtyGroup, specialtyLabel,
   *   isSpecialtyProvider, mappingSource, locationId, officeName, officeId,
   *   grossProduction, adjustments, netProduction, categories[], source
   *
   * Provider category row fields:
   *   serviceCategory, adaCodeCount, procedureCount, grossProduction,
   *   adjustments, netProduction, percentageOfProviderNetProduction
   *
   * IMPORTANT: totalNetProduction here = provider-attributed net production only.
   * It does NOT equal /v2/production/summary netProduction (office-level unattributed residual exists).
   * reconciliationDiff when filters are active may be expected — do not treat as error
   * unless reconciliationNote explicitly says it is a true error.
   *
   * @param {string} startDate
   * @param {string} endDate
   * @param {string|null} locationId
   * @param {string|null} providerType  — 'doctor' | 'hygienist' | null
   * @param {string|null} specialtyGroup — 'GP' | 'Oral Surgery' | 'Pediatric Dentistry' | 'Hygiene' | 'Unknown' | null
   */
  getProductionByProviderAndCdtCategory: (startDate, endDate, locationId, providerType, specialtyGroup) => {
    let url = `${API_BASE}/production/by-provider-and-cdt-category?startDate=${startDate}&endDate=${endDate}`;
    if (providerType && providerType !== 'all') url += `&providerType=${encodeURIComponent(providerType)}`;
    if (specialtyGroup && specialtyGroup !== 'all') url += `&specialtyGroup=${encodeURIComponent(specialtyGroup)}`;
    return safeFetch(withLocation(url, locationId));
  },

  // ─── Contact Attempt Tracking (Phase 1C) ─────────────────────────────────

  /**
   * POST /v2/rcm/contact-attempts
   * Log a new manual contact attempt for a patient balance row.
   * Does NOT send SMS, email, or trigger Dentrix. Tracking only.
   */
  postContactAttempt: (body) => {
    return fetch(`${API_BASE}/rcm/contact-attempts`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    })?.then(res => {
      if (!res?.ok) throw new Error(`Contact attempt POST failed: ${res.status}`);
      return res?.json();
    });
  },

  /**
   * GET /v2/rcm/contact-attempts/summary
   * Returns one summary row per patient_id with last contact info.
   * Used to enrich Patient Balances rows.
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   * @param {string|null} locationId  Dentrix locationId; omit for all offices
   */
  getContactAttemptSummary: (startDate, endDate, locationId) => {
    let url = `${API_BASE}/rcm/contact-attempts/summary?start_date=${startDate}&end_date=${endDate}`;
    if (locationId) url += `&location_id=${locationId}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/contact-attempts
   * Returns all contact attempts for a specific patient.
   * @param {string} patientId
   * @param {string|null} locationId
   */
  getContactAttemptsByPatient: (patientId, locationId) => {
    let url = `${API_BASE}/rcm/contact-attempts?patient_id=${encodeURIComponent(patientId)}`;
    if (locationId) url += `&location_id=${locationId}`;
    return safeFetch(url);
  },

  /**
   * PATCH /v2/rcm/contact-attempts/{id}
   * Update outcome, note, next_followup_date, or is_resolved on an existing attempt.
   * Does NOT allow patient_id changes.
   * @param {string} id  attempt UUID
   * @param {object} updates  { contact_outcome, contact_note, next_followup_date, is_resolved }
   */
  patchContactAttempt: (id, updates) => {
    return fetch(`${API_BASE}/rcm/contact-attempts/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(updates),
    })?.then(res => {
      if (!res?.ok) throw new Error(`Contact attempt PATCH failed: ${res.status}`);
      return res?.json();
    });
  },

  // ─── Dentrix Statement History (Phase 1D) ─────────────────────────────────

  /**
   * GET /v2/rcm/patient-balance-outreach-summary
   * Returns merged contact-attempt + Dentrix statement history per patient.
   * Read-only. Does NOT trigger Dentrix or send anything.
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   * @param {string|null} locationId  Dentrix locationId; omit for all offices
   */
  getPatientBalanceOutreachSummary: (startDate, endDate, locationId) => {
    let url = `${API_BASE}/rcm/patient-balance-outreach-summary?start_date=${startDate}&end_date=${endDate}`;
    if (locationId) url += `&location_id=${locationId}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/dentrix-statements
   * Returns Dentrix-originated statement records. Read-only.
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   * @param {string|null} locationId  Dentrix locationId; omit for all offices
   */
  getDentrixStatements: (startDate, endDate, locationId) => {
    let url = `${API_BASE}/rcm/dentrix-statements?start_date=${startDate}&end_date=${endDate}`;
    if (locationId) url += `&location_id=${locationId}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/dentrix-statements/summary
   * Returns aggregated Dentrix statement summary per patient. Read-only.
   * @param {string} startDate  YYYY-MM-DD
   * @param {string} endDate    YYYY-MM-DD
   * @param {string|null} locationId  Dentrix locationId; omit for all offices
   */
  getDentrixStatementsSummary: (startDate, endDate, locationId) => {
    let url = `${API_BASE}/rcm/dentrix-statements/summary?start_date=${startDate}&end_date=${endDate}`;
    if (locationId) url += `&location_id=${locationId}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/rcm/patient-balances
   * Returns true patient-responsible balances from Dentrix live aging balances report.
   *
   * Source fields:
   *   patient_responsible_balance = Dentrix guarantorPortionBalance
   *   insurance_portion_balance   = Dentrix insurancePortionBalance
   *   total_balance               = Dentrix total balance
   *
   * Rules:
   *  - No startDate/endDate — this is an as-of/current live Dentrix balance snapshot
   *  - All Offices: call once with no officeId — backend handles full scope
   *  - Selected office: pass dashboard officeId UUID (NOT locationId)
   *  - Do NOT pass UUID as locationId
   *  - Do NOT expose balanceType=unapplied_review (backend returns 403)
   *
   * @param {string|null} officeId         Dashboard UUID — omit for All Offices
   * @param {string}      balanceType      'patient_responsible' | 'all' (default: 'patient_responsible')
   * @param {boolean}     includeZeroBalances  default false
   * @param {number|null} minBalance       optional minimum balance filter
   * @param {string|null} agingBucket      'current' | 'b30' | 'b60' | 'b90'
   * @param {string|null} search           optional patient name / chart # search
   * @param {number}      page             default 1
   * @param {number}      pageSize         default 50
   */
  getPatientBalances: ({
    officeId = null,
    balanceType = 'patient_responsible',
    includeZeroBalances = false,
    minBalance = null,
    agingBucket = null,
    search = null,
    page = 1,
    pageSize = 50,
  } = {}) => {
    let url = `${API_BASE}/rcm/patient-balances?balanceType=${encodeURIComponent(balanceType)}&includeZeroBalances=${includeZeroBalances}&page=${page}&pageSize=${pageSize}`;
    if (officeId) url += `&officeId=${encodeURIComponent(officeId)}`;
    if (minBalance !== null && minBalance !== undefined) url += `&minBalance=${minBalance}`;
    if (agingBucket) url += `&agingBucket=${encodeURIComponent(agingBucket)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/eassist/daily
   * Returns eAssist email-ingested daily report rows.
   * Source: eAssist Daily Report emails parsed by NU Dashboard ingestion pipeline.
   * Expected offices: Barnegat, Brick, Eatontown only. Staten Island is not handled by eAssist.
   *
   * @param {string|null} reportDate       YYYY-MM-DD exact date
   * @param {string|null} startDate        YYYY-MM-DD range start
   * @param {string|null} endDate          YYYY-MM-DD range end
   * @param {string|null} office           'Barnegat' | 'Brick' | 'Eatontown'
   * @param {string}      parseStatus      'all' | 'success' | 'partial' | 'failed' | 'missing'
   * @param {string}      validationStatus 'all' | 'pending' | 'validated' | 'mismatch' | 'override' | 'conflict'
   * @param {number}      page             default 1
   * @param {number}      pageSize         default 50
   */
  getEAssistDailyReports: ({
    reportDate = null,
    startDate = null,
    endDate = null,
    office = null,
    parseStatus = 'all',
    validationStatus = 'all',
    page = 1,
    pageSize = 50,
  } = {}) => {
    let url = `${API_BASE}/eassist/daily?page=${page}&pageSize=${pageSize}`;
    if (reportDate) url += `&reportDate=${encodeURIComponent(reportDate)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    if (office && office !== 'all') url += `&office=${encodeURIComponent(office)}`;
    if (parseStatus && parseStatus !== 'all') url += `&parseStatus=${encodeURIComponent(parseStatus)}`;
    if (validationStatus && validationStatus !== 'all') url += `&validationStatus=${encodeURIComponent(validationStatus)}`;
    return safeFetch(url);
  },

  /**
   * GET /v2/eassist/ingest/status
   * Returns eAssist ingestion pipeline status including latest runs, coverage,
   * missing reports, staged/conflict counts, and latest report by office.
   * Source: eAssist email report ingestion pipeline.
   */
  getEAssistIngestStatus: () =>
    safeFetch(`${API_BASE}/eassist/ingest/status`),
};
