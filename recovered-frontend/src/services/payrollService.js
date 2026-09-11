import { ascendApi } from './ascendApi';
import { supabase } from '../lib/supabase';
import { enrichPayrollRows, classifyEnrichedRows, buildImportDiagnostics } from './providerMappingService';
import { normalizeOfficeName } from '../utils/officeResolver';
import { fetchProductionMetrics, fetchCollectionMetrics } from './dentrixNormalizedService';

// ─── Explicit Payroll Schedule ────────────────────────────────────────────────
// Source of truth: exact pay periods and paydays as provided.
// payroll_type: 'regular' | 'tax_reconciliation' | 'special_correction' | 'provider_specific'

export const PAYROLL_SCHEDULE = [
  // ── 2025 ──────────────────────────────────────────────────────────────────
  {
    id: 'pp-2025-q4-tax',
    payroll_type: 'tax_reconciliation',
    payroll_name: 'Q4 2025 Tax Reconciliation',
    pay_period_start: '2025-10-01',
    pay_period_end: '2025-12-31',
    payday: '2025-12-31',
    year: 2025,
    is_regular: false,
    notes: 'Q4 2025 tax reconciliation run',
  },
  {
    id: 'pp-2025-23',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Nov 24 – Dec 7, 2025',
    pay_period_start: '2025-11-24',
    pay_period_end: '2025-12-07',
    payday: '2025-12-12',
    year: 2025,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2025-24',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Dec 8 – Dec 21, 2025',
    pay_period_start: '2025-12-08',
    pay_period_end: '2025-12-21',
    payday: '2025-12-26',
    year: 2025,
    is_regular: true,
    notes: null,
  },
  // ── 2026 ──────────────────────────────────────────────────────────────────
  {
    id: 'pp-2026-01',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Dec 22, 2025 – Jan 4, 2026',
    pay_period_start: '2025-12-22',
    pay_period_end: '2026-01-04',
    payday: '2026-01-09',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-02',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jan 5 – Jan 18, 2026',
    pay_period_start: '2026-01-05',
    pay_period_end: '2026-01-18',
    payday: '2026-01-23',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-03',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jan 19 – Feb 1, 2026',
    pay_period_start: '2026-01-19',
    pay_period_end: '2026-02-01',
    payday: '2026-02-06',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-04',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Feb 2 – Feb 15, 2026',
    pay_period_start: '2026-02-02',
    pay_period_end: '2026-02-15',
    payday: '2026-02-20',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-05',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Feb 16 – Mar 1, 2026',
    pay_period_start: '2026-02-16',
    pay_period_end: '2026-03-01',
    payday: '2026-03-06',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-06',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Mar 2 – Mar 15, 2026',
    pay_period_start: '2026-03-02',
    pay_period_end: '2026-03-15',
    payday: '2026-03-20',
    year: 2026,
    is_regular: true,
    notes: 'John Fitzpatrick payroll run',
  },
  {
    id: 'pp-2026-special-margolies',
    payroll_type: 'special_correction',
    payroll_name: 'Norman Margolies Payroll Correction',
    pay_period_start: '2026-03-02',
    pay_period_end: '2026-03-13',
    payday: '2026-03-24',
    year: 2026,
    is_regular: false,
    notes: 'Fixing Norman Margolies payroll correction run',
  },
  {
    id: 'pp-2026-q1-tax',
    payroll_type: 'tax_reconciliation',
    payroll_name: 'Q1 2026 Tax Reconciliation',
    pay_period_start: '2026-01-01',
    pay_period_end: '2026-03-31',
    payday: '2026-03-31',
    year: 2026,
    is_regular: false,
    notes: 'Q1 2026 tax reconciliation run',
  },
  {
    id: 'pp-2026-07',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Mar 16 – Mar 29, 2026',
    pay_period_start: '2026-03-16',
    pay_period_end: '2026-03-29',
    payday: '2026-04-03',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-08',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Mar 30 – Apr 12, 2026',
    pay_period_start: '2026-03-30',
    pay_period_end: '2026-04-12',
    payday: '2026-04-17',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-09',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Apr 13 – Apr 26, 2026',
    pay_period_start: '2026-04-13',
    pay_period_end: '2026-04-26',
    payday: '2026-05-01',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-10',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Apr 27 – May 10, 2026',
    pay_period_start: '2026-04-27',
    pay_period_end: '2026-05-10',
    payday: '2026-05-15',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-11',
    payroll_type: 'regular',
    payroll_name: 'Pay Period May 11 – May 24, 2026',
    pay_period_start: '2026-05-11',
    pay_period_end: '2026-05-24',
    payday: '2026-05-29',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-12',
    payroll_type: 'regular',
    payroll_name: 'Pay Period May 25 – Jun 7, 2026',
    pay_period_start: '2026-05-25',
    pay_period_end: '2026-06-07',
    payday: '2026-06-12',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-13',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jun 8 – Jun 21, 2026',
    pay_period_start: '2026-06-08',
    pay_period_end: '2026-06-21',
    payday: '2026-06-26',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-14',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jun 22 – Jul 5, 2026',
    pay_period_start: '2026-06-22',
    pay_period_end: '2026-07-05',
    payday: '2026-07-10',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-15',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jul 6 – Jul 19, 2026',
    pay_period_start: '2026-07-06',
    pay_period_end: '2026-07-19',
    payday: '2026-07-24',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-16',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Jul 20 – Aug 2, 2026',
    pay_period_start: '2026-07-20',
    pay_period_end: '2026-08-02',
    payday: '2026-08-07',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-17',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Aug 3 – Aug 16, 2026',
    pay_period_start: '2026-08-03',
    pay_period_end: '2026-08-16',
    payday: '2026-08-21',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-18',
    payroll_type: 'regular',
    payroll_name: 'Pay Period Aug 17 – Aug 30, 2026',
    pay_period_start: '2026-08-17',
    pay_period_end: '2026-08-30',
    payday: '2026-09-04',
    year: 2026,
    is_regular: true,
    notes: null,
  },
  {
    id: 'pp-2026-custom',
    payroll_type: 'regular',
    payroll_name: 'Custom range',
    pay_period_start: '',
    pay_period_end: '',
    payday: '',
    year: 2026,
    is_regular: true,
    notes: 'Custom date range',
  },
];

export const PAYROLL_TYPE_LABELS = {
  regular: 'Regular',
  tax_reconciliation: 'Tax Reconciliation',
  special_correction: 'Special Correction',
  provider_specific: 'Provider-Specific',
};

export const PAYROLL_TYPE_COLORS = {
  regular: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tax_reconciliation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  special_correction: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  provider_specific: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// ─── Schedule Helpers ─────────────────────────────────────────────────────────

/**
 * Get all payroll schedule entries for a given year.
 * Includes entries whose payday falls in the year OR whose pay_period_start falls in the year.
 */
export function getPayrollScheduleForYear(year) {
  return PAYROLL_SCHEDULE?.filter(p => p?.year === year || new Date(p.payday)?.getFullYear() === year)?.sort((a, b) => {
      // Sort by payday ascending, then by pay_period_start
      const pd = new Date(a.payday) - new Date(b.payday);
      if (pd !== 0) return pd;
      return new Date(a.pay_period_start) - new Date(b.pay_period_start);
    });
}

/**
 * Get all unique years present in the schedule.
 */
export function getScheduleYears() {
  const years = new Set(PAYROLL_SCHEDULE.map(p => p.year));
  // Also include current year + 1 for future periods
  const currentYear = new Date()?.getFullYear();
  years?.add(currentYear);
  years?.add(currentYear + 1);
  return Array.from(years)?.sort((a, b) => a - b);
}

/**
 * Find the current or most recent payroll run based on today's date.
 */
export function getCurrentPayrollRun() {
  const today = new Date()?.toISOString()?.slice(0, 10);
  // Find the run whose pay period contains today
  const active = PAYROLL_SCHEDULE?.find(
    p => p?.is_regular && today >= p?.pay_period_start && today <= p?.pay_period_end
  );
  if (active) return active;
  // Otherwise find the most recent payday that has passed
  const past = PAYROLL_SCHEDULE?.filter(p => p?.payday <= today)?.sort((a, b) => new Date(b.payday) - new Date(a.payday));
  return past?.[0] || PAYROLL_SCHEDULE?.[PAYROLL_SCHEDULE?.length - 1];
}

/**
 * Format a payroll run for display in a dropdown selector.
 * Example: "Apr 17, 2026 | Regular | Mar 30 – Apr 12"
 */
export function formatPayrollRunLabel(run) {
  if (!run) return '';
  const payday = formatDateShort(run?.payday);
  const typeLabel = PAYROLL_TYPE_LABELS?.[run?.payroll_type] || run?.payroll_type;
  const periodStart = formatDateShort(run?.pay_period_start);
  const periodEnd = formatDateShort(run?.pay_period_end);
  return `${payday} | ${typeLabel} | ${periodStart} – ${periodEnd}`;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
  return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  return `${formatDateShort(startStr)} – ${formatDateShort(endStr)}`;
}

// ─── Provider Classification ──────────────────────────────────────────────────
const DOCTOR_TYPES = ['doctor', 'dentist', 'dds', 'dmd', 'oral_surgeon', 'orthodontist', 'periodontist', 'endodontist', 'prosthodontist', 'pediatric_dentist', 'general_dentist'];
const HYGIENIST_TYPES = ['hygienist', 'rdh', 'dental_hygienist', 'hygiene', 'temp_hygienist'];

// Known doctors by raw name (from Dentrix) — used in rescue pass when provider_type is missing/unknown
const KNOWN_DOCTOR_RAW_NAMES = [
  'mark henin', 'dr. mark henin', 'dr mark henin',
  'nelson wollek', 'dr. nelson wollek', 'dr nelson wollek',
  'amtul siddiqui', 'dr. amtul siddiqui', 'dr amtul siddiqui',
  'john fitzpatrick', 'dr. john fitzpatrick', 'dr john fitzpatrick',
  'glenn marie', 'dr. glenn marie', 'dr glenn marie',
  'james clifford rigby', 'james rigby', 'clifford rigby', 'j. clifford rigby',
];

export function classifyProvider(provider) {
  if (!provider) return 'unknown';
  const type = (provider?.provider_type || provider?.type || provider?.role || '')?.toLowerCase();
  const title = (provider?.title || provider?.credential || '')?.toLowerCase();
  const name = (provider?.name || provider?.display_name || '')?.toLowerCase();

  if (DOCTOR_TYPES?.some(t => type?.includes(t) || title?.includes(t))) return 'doctor';
  if (HYGIENIST_TYPES?.some(t => type?.includes(t) || title?.includes(t))) return 'hygienist';

  if (name?.includes('dds') || name?.includes('dmd') || name?.includes('dr.') || /^dr\.?\s+/i?.test(name)) return 'doctor';
  if (name?.includes('rdh') || name?.includes('hygienist')) return 'hygienist';

  // Check known doctor names list
  const nameTrimmed = name?.trim();
  if (KNOWN_DOCTOR_RAW_NAMES?.some(n => nameTrimmed?.includes(n) || n?.includes(nameTrimmed?.replace(/^dr\.?\s*/i, '')))) return 'doctor';

  return 'unknown';
}

// ─── Compensation Calculations ────────────────────────────────────────────────
export function calcDoctorCompensation(totalCollections) {
  const c = parseFloat(totalCollections) || 0;
  return {
    pct32: c * 0.32,
    pct33: c * 0.33,
    pct34: c * 0.34,
    pct35: c * 0.35,
  };
}

export function calcHygienistCompensation(totalCollections) {
  const c = parseFloat(totalCollections) || 0;
  return {
    pct40: c * 0.40,
    pct45: c * 0.45,
  };
}

// ─── Main Payroll Data Fetch ──────────────────────────────────────────────────
/**
 * Fetch payroll data for a given payroll run (or custom date range).
 * ALWAYS uses pay_period_start / pay_period_end for Dentrix data filtering.
 * Never uses payday as the transaction filter date.
 *
 * Provider identity (Name, Office, Type) is resolved through the canonical
 * mapping layer (providerMappingService) with Staff Management as source of truth.
 *
 * @param {object} params
 * @param {string} params.startDate - pay_period_start (YYYY-MM-DD)
 * @param {string} params.endDate   - pay_period_end   (YYYY-MM-DD)
 * @param {string} [params.locationId]
 * @param {string} [params.providerId]
 * @param {string} [params.providerType]
 * @param {object} [params.payrollRun] - the selected PAYROLL_SCHEDULE entry (for metadata)
 */
export async function fetchPayrollData({ startDate, endDate, locationId, providerId, providerType, payrollRun }) {
  try {
    const [providersRes, providerPerfRes] = await Promise.allSettled([
      ascendApi?.getProviders(locationId),
      ascendApi?.getProductionByProvider(startDate, endDate, locationId),
    ]);

    const rawProviders = providersRes?.status === 'fulfilled'
      ? (providersRes?.value?.providers || providersRes?.value?.data || providersRes?.value || [])
      : [];

    const rawPerformance = providerPerfRes?.status === 'fulfilled'
      ? (providerPerfRes?.value?.providers || providerPerfRes?.value?.data || providerPerfRes?.value || [])
      : [];

    // Build provider map from Ascend providers list
    const providerMap = {};
    rawProviders?.forEach(p => {
      const id = p?.provider_id || p?.id;
      if (id) providerMap[id] = p;
    });

    // Load providers from Supabase for classification + office name resolution
    const { data: supabaseProviders } = await supabase
      ?.from('providers')
      ?.select('id, name, provider_type, office_id, offices(name)')
      ?.order('name');

    const supabaseProviderMap = {};
    (supabaseProviders || [])?.forEach(p => {
      supabaseProviderMap[p.id] = p;
      if (p?.name) supabaseProviderMap[p.name.toLowerCase()] = p;
    });

    const rawRows = [];
    const performanceArray = Array.isArray(rawPerformance) ? rawPerformance : [];

    performanceArray?.forEach(perf => {
      const pid =
        perf?.providerId ||
        perf?.provider_id ||
        perf?.dentrix_provider_id ||
        perf?.dentrixProviderId ||
        perf?.ascend_provider_id ||
        perf?.ascendProviderId ||
        perf?.providerGuid ||
        perf?.provider_guid ||
        perf?.guid ||
        perf?.id ||
        null;

      const ascendProvider = providerMap?.[pid] || {};
      const supabaseProvider = supabaseProviderMap?.[pid] ||
        supabaseProviderMap?.[(perf?.provider_name || '')?.toLowerCase()] || {};

      const mergedProvider = { ...ascendProvider, ...supabaseProvider, ...perf };

      const providerName = mergedProvider?.name || mergedProvider?.provider_name ||
        mergedProvider?.display_name || `Provider ${pid}`;

      // ── Office: collect raw value only — do NOT pre-set "Unknown Office" ──
      // The enrichPayrollRows + officeResolver pipeline will normalize this.
      // Setting "Unknown Office" here would poison the resolver's input.
      const rawOfficeName =
        mergedProvider?.offices?.name ||
        mergedProvider?.office_name ||
        mergedProvider?.location_name ||
        null; // null = truly unknown, resolved later

      const providerTypeRaw = mergedProvider?.provider_type || mergedProvider?.type || '';

      const grossProduction = parseFloat(perf?.gross_production || perf?.grossProduction || perf?.production || 0);
      const adjustedProduction = parseFloat(perf?.adjusted_production || perf?.adjustedProduction || perf?.net_production || perf?.netProduction || grossProduction);
      const totalCollections = Math.abs(parseFloat(perf?.collections || perf?.total_collections || perf?.totalCollections || 0));
      const monthlyCollections = parseFloat((perf?.moCollections) || (perf?.monthlyCollections) || totalCollections);

      if (providerId && pid !== providerId) return;

      rawRows?.push({
        providerId: pid,
        provider_id: pid,
        providerName,
        officeName: rawOfficeName,
        provider_type: providerTypeRaw,
        // Preserve camelCase providerType from backend response — used by ProviderCompensationNew
        // to trust backend hygienist/doctor classification over stale Supabase enrichment.
        providerType: perf?.providerType || perf?.provider_type || perf?.type || providerTypeRaw,
        grossProduction,
        adjustedProduction,
        totalCollections,
        monthlyCollections,
        payPeriodStart: startDate,
        payPeriodEnd: endDate,
        payday: payrollRun?.payday || null,
        payrollType: payrollRun?.payroll_type || 'regular',
        payrollName: payrollRun?.payroll_name || `${startDate} – ${endDate}`,
      });
    });

    // If Dentrix/FastAPI returned no provider data, do NOT silently fall back to
    // Supabase daily_entries — that would mix manual EOD data into the Dentrix tab.
    // Instead return an empty result with a clear warning so the UI can display it.
    let sourceRows = rawRows;
    if (rawRows?.length === 0) {
      const enrichedEmpty = [];
      const diagnosticsEmpty = buildImportDiagnostics(enrichedEmpty);
      return {
        doctors: [],
        hygienists: [],
        placeholders: [],
        resolvedPlaceholders: [],
        summary: {
          totalGrossProduction: 0,
          totalAdjustedProduction: 0,
          totalCollections: 0,
          totalDoctorPayrollEstimate: 0,
          totalHygienistPayrollEstimate: 0,
          unmappedCount: 0,
          diagnostics: diagnosticsEmpty,
        },
        dataSource: 'dentrix_fastapi_empty',
        dataSourceWarning: 'Dentrix/FastAPI returned no provider payroll data for this pay period. Supabase daily_entries fallback is disabled to keep Dentrix and manual EOD data separate.',
        error: null,
      };
    }

    // ── Enrich with canonical identity from Staff Management mapping layer ──
    let enrichedRows = await enrichPayrollRows(sourceRows);

    // ── Classify into doctor / hygienist / unknown using canonical type ──────
    const { doctors: rawDoctors, hygienists: rawHygienists, unknowns, placeholders, resolvedPlaceholders } = classifyEnrichedRows(enrichedRows);

    // Apply provider type filter using canonical type
    const filterType = providerType && providerType !== 'all' ? providerType : null;

    const buildRows = (rows, classification) => rows?.filter(row => !filterType || row?.payrollBucket === filterType || row?.canonicalType === filterType)?.map(row => {
        // ── Office display: use shared resolver result, fall back to raw, never hardcode "Unknown Office" ──
        const resolvedOffice =
          row?.canonicalOffice ||
          normalizeOfficeName(row?.rawOffice) ||
          normalizeOfficeName(row?.officeName) ||
          row?.rawOffice ||
          row?.officeName ||
          null;

        const base = {
          ...row,
          providerName: row?.displayName,
          officeName: resolvedOffice || 'Unknown Office',
          classification,
        };
        if (classification === 'hygienist') {
          return { ...base, ...calcHygienistCompensation(row?.totalCollections) };
        }
        return { ...base, ...calcDoctorCompensation(row?.totalCollections) };
      });

    // Unknown type rows: visible but clearly flagged — not silently dropped
    // Placeholder rows: EXCLUDED from payroll totals by default
    const unknownRows = unknowns?.filter(row => !filterType)?.map(row => {
        const resolvedOffice =
          row?.canonicalOffice ||
          normalizeOfficeName(row?.rawOffice) ||
          normalizeOfficeName(row?.officeName) ||
          row?.rawOffice ||
          row?.officeName ||
          null;
        return {
          ...row,
          providerName: row?.displayName,
          officeName: resolvedOffice || 'Unknown Office',
          classification: 'unknown',
          ...calcDoctorCompensation(row?.totalCollections),
        };
      });

    const doctors = [...buildRows(rawDoctors, 'doctor'), ...unknownRows];
    const hygienists = buildRows(rawHygienists, 'hygienist');
    // Placeholders are returned separately — excluded from totals
    const placeholderRows = (placeholders || [])?.map(row => ({
      ...row,
      providerName: row?.displayName || row?.rawName,
      officeName: row?.canonicalOffice || row?.rawOffice || 'Unknown Office',
      classification: 'placeholder',
      alreadyResolved: false,
    }));

    // Resolved placeholders — diagnostics only, never shown in active banner
    const resolvedPlaceholderRows = (resolvedPlaceholders || [])?.map(row => ({
      ...row,
      providerName: row?.displayName || row?.rawName,
      officeName: row?.canonicalOffice || row?.rawOffice || 'Unknown Office',
      classification: 'placeholder',
      alreadyResolved: true,
    }));

    const allRows = [...doctors, ...hygienists];
    const diagnostics = buildImportDiagnostics(enrichedRows);

    // ── REAL unresolved count: EXCLUDE placeholders, ignored, and is_placeholder rows ──
    // Only rows with genuine mapping failures count toward the warning banner.
    // placeholder / ignored rows must NEVER trigger the banner.
    const REAL_UNRESOLVED_STATUSES = ['needs_review', 'unknown_type', 'unknown_office', 'pending'];
    const realUnresolvedCount = enrichedRows?.filter(r =>
      REAL_UNRESOLVED_STATUSES?.includes(r?.mappingStatus) &&
      !r?.isPlaceholder &&
      r?.mappingStatus !== 'placeholder' &&
      r?.mappingStatus !== 'ignored'
    )?.length || 0;

    const summary = {
      totalGrossProduction: allRows?.reduce((s, r) => s + r?.grossProduction, 0),
      totalAdjustedProduction: allRows?.reduce((s, r) => s + r?.adjustedProduction, 0),
      totalCollections: allRows?.reduce((s, r) => s + r?.totalCollections, 0),
      totalDoctorPayrollEstimate: doctors?.filter(r => r?.classification === 'doctor')?.reduce((s, r) => s + (r?.pct33 || 0), 0),
      totalHygienistPayrollEstimate: hygienists?.reduce((s, r) => s + (r?.pct40 || 0), 0),
      // unmappedCount now reflects ONLY real providers needing mapping — never placeholders
      unmappedCount: realUnresolvedCount,
      diagnostics,
    };

    return { doctors, hygienists, placeholders: placeholderRows, resolvedPlaceholders: resolvedPlaceholderRows, summary, dataSource: 'dentrix_fastapi', dataSourceWarning: null, error: null };
  } catch (err) {
    console.error('[payrollService] fetchPayrollData error:', err);
    return { doctors: [], hygienists: [], placeholders: [], resolvedPlaceholders: [], summary: {}, error: err?.message };
  }
}

/**
 * Fallback: aggregate payroll data from Supabase daily_entries
 */
async function fetchPayrollFromSupabase({ startDate, endDate, locationId, providerId, supabaseProviders, payrollRun }) {
  try {
    let query = supabase
      ?.from('daily_entries')
      ?.select('provider_id, provider_name, office_id, offices(name), doctor_production, hygiene_production, total_collections, adjustments')
      ?.gte('entry_date', startDate)
      ?.lte('entry_date', endDate)
      ?.in('status', ['approved', 'submitted', 'pending']);

    if (locationId) query = query?.eq('office_id', locationId);
    if (providerId) query = query?.eq('provider_id', providerId);

    const { data, error } = await query;
    if (error || !data?.length) return [];

    const grouped = {};
    data?.forEach(entry => {
      const pid = entry?.provider_id || 'unknown';
      if (!grouped?.[pid]) {
        const supabaseProvider = supabaseProviders?.find(p => p?.id === pid);
        grouped[pid] = {
          providerId: pid,
          providerName: entry?.provider_name || supabaseProvider?.name || `Provider ${pid}`,
          // Use null instead of 'Unknown Office' — officeResolver will handle normalization
          officeName: entry?.offices?.name || supabaseProvider?.offices?.name || null,
          provider_type: supabaseProvider?.provider_type || '',
          grossProduction: 0,
          adjustedProduction: 0,
          totalCollections: 0,
          payPeriodStart: startDate,
          payPeriodEnd: endDate,
          payday: payrollRun?.payday || null,
          payrollType: payrollRun?.payroll_type || 'regular',
          payrollName: payrollRun?.payroll_name || `${startDate} – ${endDate}`,
        };
      }
      const gp = parseFloat(entry?.doctor_production || 0) + parseFloat(entry?.hygiene_production || 0);
      const adj = parseFloat(entry?.adjustments || 0);
      grouped[pid].grossProduction += gp;
      grouped[pid].adjustedProduction += gp + adj;
      grouped[pid].totalCollections += parseFloat(entry?.total_collections || 0);
    });

    return Object.values(grouped);
  } catch (err) {
    console.error('[payrollService] fetchPayrollFromSupabase error:', err);
    return [];
  }
}

/**
 * Fetch available offices for filter dropdown
 */
export async function fetchPayrollOffices() {
  try {
    const { data } = await supabase?.from('offices')?.select('id, name')?.order('name');
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch available providers for filter dropdown
 */
export async function fetchPayrollProviders(locationId) {
  try {
    let query = supabase?.from('providers')?.select('id, name, provider_type, office_id')?.order('name');
    if (locationId) query = query?.eq('office_id', locationId);
    const { data } = await query;
    return data || [];
  } catch {
    return [];
  }
}

/**
 * fetchPayrollOfficeTotals
 *
 * Returns normalized production and collections totals for a pay period,
 * scoped to a specific office. Uses the canonical dentrixNormalizedService
 * so payroll always reads from the same source as Financial Analytics.
 *
 * @param {{ startDate, endDate, officeIds? }} params
 * @returns {Promise<{ grossProduction, netProduction, totalCollections, insuranceCollections, patientCollections }>}
 */
export async function fetchPayrollOfficeTotals({ startDate, endDate, officeIds = [] }) {
  const [prodResult, collResult] = await Promise.allSettled([
    fetchProductionMetrics({ startDate, endDate, officeIds }),
    fetchCollectionMetrics({ startDate, endDate, officeIds }),
  ]);

  const prod = prodResult?.status === 'fulfilled' ? prodResult?.value : {};
  const coll = collResult?.status === 'fulfilled' ? collResult?.value : {};

  return {
    grossProduction: prod?.gross_production_mtd ?? 0,
    netProduction: prod?.net_production_mtd ?? 0,
    productionAdjustments: prod?.production_adjustments_mtd ?? 0,
    totalCollections: coll?.total_collections_mtd ?? 0,
    insuranceCollections: coll?.insurance_collections_mtd ?? 0,
    patientCollections: coll?.patient_collections_mtd ?? 0,
    // Diagnostics for payroll audit trail
    _productionDiagnostics: prod?._diagnostics,
    _collectionsDiagnostics: coll?._diagnostics,
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
/**
 * Export payroll CSV with full payroll metadata per the requirements:
 * payroll_type, pay_period_start, pay_period_end, payday, provider, office,
 * gross production, adjusted production, total collections, percentage columns.
 */
export function exportPayrollCSV(doctors, hygienists, payrollRun, customLabel) {
  const fmtNum = (n) => (parseFloat(n) || 0)?.toFixed(2);

  const runLabel = payrollRun
    ? formatPayrollRunLabel(payrollRun)
    : (customLabel || 'Custom Date Range');

  const payday = payrollRun?.payday || '';
  const periodStart = payrollRun?.pay_period_start || (doctors?.[0]?.payPeriodStart || hygienists?.[0]?.payPeriodStart || '');
  const periodEnd = payrollRun?.pay_period_end || (doctors?.[0]?.payPeriodEnd || hygienists?.[0]?.payPeriodEnd || '');
  const payrollType = PAYROLL_TYPE_LABELS?.[payrollRun?.payroll_type] || 'Regular';
  const payrollName = payrollRun?.payroll_name || runLabel;

  const metaHeader = [
    `Payroll Report`,
    `Payroll Run:,${payrollName}`,
    `Payroll Type:,${payrollType}`,
    `Pay Period:,${formatDateShort(periodStart)} – ${formatDateShort(periodEnd)}`,
    `Payday:,${formatDateShort(payday)}`,
    `Generated:,${new Date()?.toLocaleString()}`,
    '',
  ]?.join('\n');

  const doctorRows = doctors?.map(r =>
    [
      r?.providerName,
      r?.officeName,
      payrollType,
      formatDateShort(r?.payPeriodStart || periodStart),
      formatDateShort(r?.payPeriodEnd || periodEnd),
      formatDateShort(r?.payday || payday),
      fmtNum(r?.grossProduction),
      fmtNum(r?.adjustedProduction),
      fmtNum(r?.totalCollections),
      fmtNum(r?.pct32),
      fmtNum(r?.pct33),
      fmtNum(r?.pct34),
      fmtNum(r?.pct35),
    ]?.join(',')
  );

  const hygienistRows = hygienists?.map(r =>
    [
      r?.providerName,
      r?.officeName,
      payrollType,
      formatDateShort(r?.payPeriodStart || periodStart),
      formatDateShort(r?.payPeriodEnd || periodEnd),
      formatDateShort(r?.payday || payday),
      fmtNum(r?.grossProduction),
      fmtNum(r?.adjustedProduction),
      fmtNum(r?.totalCollections),
      fmtNum(r?.pct40),
      fmtNum(r?.pct45),
    ]?.join(',')
  );

  const doctorSection = [
    'DOCTORS',
    'Provider Name,Office,Payroll Type,Pay Period Start,Pay Period End,Payday,Gross Production,Adjusted Production,Total Collections,32%,33%,34%,35%',
    ...doctorRows,
  ]?.join('\n');

  const hygienistSection = [
    '',
    'HYGIENISTS',
    'Provider Name,Office,Payroll Type,Pay Period Start,Pay Period End,Payday,Gross Production,Adjusted Production,Total Collections,40%,45%',
    ...hygienistRows,
  ]?.join('\n');

  const csv = `${metaHeader}${doctorSection}\n${hygienistSection}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (payrollRun?.id || customLabel || 'payroll')?.replace(/[^a-z0-9]/gi, '_');
  link.download = `payroll_${safeName}.csv`;
  link?.click();
  URL.revokeObjectURL(url);
}

// ─── Legacy compatibility exports ────────────────────────────────────────────
// Keep generatePayPeriods and getCurrentPayPeriodIndex for any other consumers
export function generatePayPeriods(year) {
  return getPayrollScheduleForYear(year)?.map((p, i) => ({
    index: i,
    label: formatPayrollRunLabel(p),
    startDate: p?.pay_period_start,
    endDate: p?.pay_period_end,
    payday: p?.payday,
    payrollRun: p,
    year,
  }));
}

export function getCurrentPayPeriodIndex(year) {
  const periods = generatePayPeriods(year);
  const run = getCurrentPayrollRun();
  const idx = periods?.findIndex(p => p?.payrollRun?.id === run?.id);
  return idx >= 0 ? idx : Math.max(0, periods?.length - 1);
}

// ─── Monthly Collection Tier Helpers ─────────────────────────────────────────

/**
 * Returns the flat doctor monthly tier rate based on total monthly collections.
 * No marginal/bracket calculation — one flat rate for the entire monthly amount.
 *
 * <= $50,000       → 32%
 * $50,001–$65,000  → 33%
 * $65,001–$80,000  → 34%
 * >= $80,001        → 35%
 */
export function getDoctorMonthlyTierRate(monthlyCollections) {
  const c = parseFloat(monthlyCollections) || 0;
  if (c <= 50000) return 0.32;
  if (c <= 65000) return 0.33;
  if (c <= 80000) return 0.34;
  return 0.35;
}

/**
 * Splits a pay period date range into calendar-month segments.
 * Returns an array of { segmentStart, segmentEnd, calendarMonth } objects.
 *
 * Example: splitPayPeriodByMonth('2026-03-30', '2026-04-12')
 * → [
 *     { segmentStart: '2026-03-30', segmentEnd: '2026-03-31', calendarMonth: '2026-03' },
 *     { segmentStart: '2026-04-01', segmentEnd: '2026-04-12', calendarMonth: '2026-04' }
 *   ]
 */
export function splitPayPeriodByMonth(startDate, endDate) {
  const segments = [];
  if (!startDate || !endDate) return segments;

  const toYYYYMM = (d) =>
    `${d?.getFullYear()}-${String(d?.getMonth() + 1)?.padStart(2, '0')}`;
  const toYYYYMMDD = (d) => d?.toISOString()?.slice(0, 10);

  let current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  let segStart = new Date(current);
  let currentMonth = toYYYYMM(current);

  while (current <= end) {
    const nextDay = new Date(current);
    nextDay?.setDate(nextDay?.getDate() + 1);

    const isLastDay = current?.getTime() === end?.getTime();
    const nextMonth = nextDay <= end ? toYYYYMM(nextDay) : null;

    if (isLastDay || nextMonth !== currentMonth) {
      segments?.push({
        segmentStart: toYYYYMMDD(segStart),
        segmentEnd: toYYYYMMDD(current),
        calendarMonth: currentMonth,
      });
      segStart = new Date(nextDay);
      currentMonth = nextMonth;
    }
    current = nextDay;
  }
  return segments;
}

/**
 * Returns true if the given calendar month (YYYY-MM) is fully closed
 * (i.e., today is strictly after the last day of that month).
 */
export function isMonthClosed(calendarMonth) {
  if (!calendarMonth) return false;
  const [year, month] = calendarMonth?.split('-')?.map(Number);
  // Last day of the month
  const lastDay = new Date(year, month, 0); // day 0 of next month = last day of this month
  const today = new Date();
  today?.setHours(0, 0, 0, 0);
  lastDay?.setHours(0, 0, 0, 0);
  return today > lastDay;
}

/**
 * Returns the first regular payday in PAYROLL_SCHEDULE that falls after
 * the last day of the given calendar month (YYYY-MM).
 * Used to determine the "Next Payroll True-Up Date".
 */
export function getNextPayrollAfterMonthClose(calendarMonth) {
  if (!calendarMonth) return null;
  const [year, month] = calendarMonth?.split('-')?.map(Number);
  const lastDay = new Date(year, month, 0);
  const lastDayStr = lastDay?.toISOString()?.slice(0, 10);

  const candidates = PAYROLL_SCHEDULE?.filter(p => p?.is_regular && p?.payday > lastDayStr)?.sort((a, b) => a?.payday?.localeCompare(b?.payday));

  return candidates?.[0] || null;
}

/**
 * Builds the Monthly Collection Tier data for the collapsible review section.
 *
 * IMPORTANT: Cross-month pay periods are split by calendar month and each segment
 * is fetched separately from Dentrix/FastAPI via ascendApi.getProductionByProvider().
 * NO proportional proration is used. Actual returned collections per segment are used.
 *
 * @param {Array}  payrollScheduleEntries  - array of PAYROLL_SCHEDULE entries to process
 * @param {string} locationId              - office/location filter (null = all)
 * @param {Function} enrichFn             - enrichPayrollRows function
 * @param {Function} classifyFn           - classifyEnrichedRows function
 * @returns {Promise<{
 *   doctorMonthlyTotals: object[],
 *   payPeriodBreakdown: object[],
 *   hygienistBreakdown: object[],
 *   unmappedRows: object[],
 *   segmentWarnings: object[]
 * }>}
 */
export async function buildMonthlyTierData(payrollScheduleEntries, locationId, enrichFn, classifyFn) {
  // Accumulator: keyed by `${providerId}__${calendarMonth}`
  const doctorMonthMap = {};
  const payPeriodBreakdown = [];
  const hygienistBreakdown = [];
  const unmappedRows = [];
  const segmentWarnings = [];

  // Process each pay period entry
  for (const payrollEntry of (payrollScheduleEntries || [])) {
    const { pay_period_start, pay_period_end, payday, payroll_name } = payrollEntry || {};
    if (!pay_period_start || !pay_period_end) continue;

    const payPeriodLabel = `${formatDateShort(pay_period_start)} – ${formatDateShort(pay_period_end)}`;

    // Split pay period into calendar-month segments
    const segments = splitPayPeriodByMonth(pay_period_start, pay_period_end);

    // Fetch each segment from Dentrix/FastAPI in parallel (Promise.allSettled so one failure doesn't crash all)
    const segmentResults = await Promise.allSettled(
      segments?.map(async (seg) => {
        const raw = await ascendApi?.getProductionByProvider(seg?.segmentStart, seg?.segmentEnd, locationId);
        const rawArray = Array.isArray(raw)
          ? raw
          : (raw?.providers || raw?.data || []);
        return { seg, rawArray };
      })
    );

    for (let si = 0; si < segmentResults?.length; si++) {
      const result = segmentResults?.[si];
      const seg = segments?.[si];

      if (result?.status === 'rejected' || !result?.value?.rawArray?.length) {
        // No data for this segment — show amber warning, no fallback
        segmentWarnings?.push({
          payday,
          payPeriodLabel,
          segmentStart: seg?.segmentStart,
          segmentEnd: seg?.segmentEnd,
          calendarMonth: seg?.calendarMonth,
          message: `Dentrix/FastAPI returned no provider collection data for ${seg?.segmentStart} – ${seg?.segmentEnd}. No manual or Gusto fallback is shown.`,
        });
        continue;
      }

      const { rawArray } = result?.value;

      // Build raw rows for enrichment
      const rawRows = rawArray?.map(perf => {
        const pid = perf?.provider_id || perf?.id;
        const providerName = perf?.name || perf?.provider_name || perf?.display_name || `Provider ${pid}`;
        const rawOfficeName = perf?.office_name || perf?.location_name || null;
        const grossProduction = parseFloat(perf?.gross_production || perf?.grossProduction || perf?.production || 0);
        const adjustedProduction = parseFloat(perf?.adjusted_production || perf?.adjustedProduction || perf?.net_production || grossProduction);
        const totalCollections = Math.abs(parseFloat(perf?.collections || perf?.total_collections || perf?.totalCollections || 0));
        return {
          providerId: pid,
          providerName,
          officeName: rawOfficeName,
          provider_type: perf?.provider_type || perf?.type || '',
          grossProduction,
          adjustedProduction,
          totalCollections,
          payPeriodStart: seg?.segmentStart,
          payPeriodEnd: seg?.segmentEnd,
          payday: payday || null,
          payrollType: payrollEntry?.payroll_type || 'regular',
          payrollName: payroll_name || payPeriodLabel,
        };
      });

      // Enrich + classify using existing mapping pipeline
      let enrichedRows = rawRows;
      try {
        if (typeof enrichFn === 'function') {
          enrichedRows = await enrichFn(rawRows);
        }
      } catch (e) {
        console.warn('[buildMonthlyTierData] enrichFn error:', e?.message);
      }

      let classified = { doctors: enrichedRows, hygienists: [], unknowns: [], placeholders: [] };
      try {
        if (typeof classifyFn === 'function') {
          classified = classifyFn(enrichedRows);
        }
      } catch (e) {
        console.warn('[buildMonthlyTierData] classifyFn error:', e?.message);
      }

      const { doctors: rawDoctors = [], hygienists: rawHygienists = [], unknowns = [], placeholders = [] } = classified;

      // ── Process doctor rows ──────────────────────────────────────────────
      for (const row of rawDoctors) {
        // NOTE: classifyEnrichedRows places rows in the doctors array based on payrollBucket.
        // The rows do NOT have a classification field set by classifyEnrichedRows.
        // Do NOT guard with row?.classification !== 'doctor' — that would skip every row.
        const pid = row?.providerId || row?.provider_id;
        const segCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
        const providerName = row?.displayName || row?.providerName || row?.rawName || `Provider ${pid}`;
        const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
        const key = `${pid}__${seg?.calendarMonth}__${officeName}`;

        if (!doctorMonthMap?.[key]) {
          doctorMonthMap[key] = {
            providerId: pid,
            providerName,
            officeName,
            calendarMonth: seg?.calendarMonth,
            monthlyCollections: 0,
            paidToDateEstimate: 0,
            mappingStatus: row?.mappingStatus || 'mapped',
            segments: [],
          };
        }
        doctorMonthMap[key].monthlyCollections += segCollections;

        // Provisional segment compensation (will be recalculated after all segments are summed)
        const provisionalRate = getDoctorMonthlyTierRate(doctorMonthMap?.[key]?.monthlyCollections);
        const segCompensation = segCollections * provisionalRate;
        doctorMonthMap[key].paidToDateEstimate += segCompensation;
        doctorMonthMap?.[key]?.segments?.push({
          segmentStart: seg?.segmentStart,
          segmentEnd: seg?.segmentEnd,
          segCollections,
          provisionalRate,
          segCompensation,
        });

        payPeriodBreakdown?.push({
          payday,
          payPeriodLabel,
          providerId: pid,
          providerName,
          officeName,
          calendarMonth: seg?.calendarMonth,
          segmentStart: seg?.segmentStart,
          segmentEnd: seg?.segmentEnd,
          segmentCollections: segCollections,
          appliedMonthlyTierRate: provisionalRate,
          segmentCompensation: segCompensation,
          status: isMonthClosed(seg?.calendarMonth) ? 'Final' : 'Provisional',
          mappingStatus: row?.mappingStatus || 'mapped',
        });
      }

      // ── Process hygienist rows ───────────────────────────────────────────
      for (const row of rawHygienists) {
        // NOTE: classifyEnrichedRows places rows in the hygienists array based on payrollBucket.
        // Do NOT guard with row?.classification !== 'hygienist' — that would skip every row.
        const pid = row?.providerId || row?.provider_id;
        const segCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
        const providerName = row?.displayName || row?.providerName || row?.rawName || `Provider ${pid}`;
        const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';

        hygienistBreakdown?.push({
          payday,
          payPeriodLabel,
          providerId: pid,
          providerName,
          officeName,
          payPeriodCollections: segCollections,
          pct40: segCollections * 0.40,
          pct45: segCollections * 0.45,
          mappingStatus: row?.mappingStatus || 'mapped',
        });
      }

      // ── Collect unmapped / excluded rows ────────────────────────────────
      const excludedRows = [...unknowns, ...placeholders];
      for (const row of excludedRows) {
        const pid = row?.providerId || row?.provider_id;
        const rawName = row?.rawName || row?.displayName || row?.providerName || `Provider ${pid}`;
        const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
        const segCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
        const reason = row?.classification === 'placeholder' ?'Placeholder / non-provider import label'
          : (row?.mappingStatus === 'unknown_type' ?'Unknown provider type — needs mapping' :'Unmapped / unattributed / office-level row');

        unmappedRows?.push({
          providerRawName: rawName,
          officeName,
          dateRange: `${seg?.segmentStart} – ${seg?.segmentEnd}`,
          collections: segCollections,
          reasonExcluded: reason,
        });
      }
    }
  }

  // ── Finalize doctor monthly totals ────────────────────────────────────────
  // Recalculate final tier rate and true-up now that all segments are accumulated
  const doctorMonthlyTotals = Object.values(doctorMonthMap)?.map(entry => {
    const finalTierRate = getDoctorMonthlyTierRate(entry?.monthlyCollections);
    const finalMonthlyCompensation = entry?.monthlyCollections * finalTierRate;
    const closed = isMonthClosed(entry?.calendarMonth);
    const status = closed ? 'Final' : 'Provisional';
    const trueUpAmount = closed ? (finalMonthlyCompensation - entry?.paidToDateEstimate) : null;
    const nextPayrollRun = closed ? getNextPayrollAfterMonthClose(entry?.calendarMonth) : null;

    return {
      providerId: entry?.providerId,
      providerName: entry?.providerName,
      officeName: entry?.officeName,
      calendarMonth: entry?.calendarMonth,
      monthlyCollections: entry?.monthlyCollections,
      tierRate: finalTierRate,
      monthlyCompensation: finalMonthlyCompensation,
      paidToDateEstimate: entry?.paidToDateEstimate,
      trueUpAmount,
      status,
      nextPayrollTrueUpDate: nextPayrollRun?.payday || null,
      mappingStatus: entry?.mappingStatus,
    };
  });

  // Also update payPeriodBreakdown with final tier rates for closed months
  const finalRateByKey = {};
  doctorMonthlyTotals?.forEach(d => {
    finalRateByKey[`${d.providerId}__${d.calendarMonth}`] = d?.tierRate;
  });
  payPeriodBreakdown?.forEach(row => {
    const key = `${row?.providerId}__${row?.calendarMonth}`;
    if (finalRateByKey?.[key] !== undefined) {
      row.appliedMonthlyTierRate = finalRateByKey?.[key];
      row.segmentCompensation = row?.segmentCollections * finalRateByKey?.[key];
    }
  });

  return {
    doctorMonthlyTotals,
    payPeriodBreakdown,
    hygienistBreakdown,
    unmappedRows,
    segmentWarnings,
  };
}

/**
 * Builds Monthly Collection Tier data with SEPARATE fetches for:
 *   1. Calendar-month collections  → Doctor Monthly Tier Table
 *   2. Pay-period segment collections → Pay Period Breakdown
 *
 * RULE: Monthly Collections = provider's total Dentrix/FastAPI collections for the
 *       full calendar month (or MTD for the current/open month).
 *       Pay-period segment collections are fetched separately for the exact segment range.
 *       These two numbers are intentionally different and must NOT be confused.
 *
 * NO proration. NO Gusto. NO Supabase daily_entries.
 *
 * @param {Array}    payrollScheduleEntries  - array of PAYROLL_SCHEDULE entries to process
 * @param {string}   locationId              - office/location filter (null = all)
 * @param {Function} enrichFn               - enrichPayrollRows
 * @param {Function} classifyFn             - classifyEnrichedRows
 * @returns {Promise<{
 *   doctorMonthlyTotals: object[],
 *   payPeriodBreakdown: object[],
 *   hygienistBreakdown: object[],
 *   unmappedRows: object[],
 *   segmentWarnings: object[],
 *   diagnostics: object
 * }>}
 */
export async function buildMonthlyTierDataSeparate(payrollScheduleEntries, locationId, enrichFn, classifyFn) {
  const today = new Date();
  today?.setHours(0, 0, 0, 0);
  const todayStr = today?.toISOString()?.slice(0, 10);

  // ── Step 1: Collect all unique calendar months touched by the pay periods ──
  const calendarMonthsNeeded = new Set();
  const allSegments = []; // { seg, payday, payPeriodLabel }

  for (const entry of (payrollScheduleEntries || [])) {
    const { pay_period_start, pay_period_end, payday, payroll_name } = entry || {};
    if (!pay_period_start || !pay_period_end) continue;
    const payPeriodLabel = `${formatDateShort(pay_period_start)} – ${formatDateShort(pay_period_end)}`;
    const segments = splitPayPeriodByMonth(pay_period_start, pay_period_end);
    for (const seg of segments) {
      calendarMonthsNeeded?.add(seg?.calendarMonth);
      allSegments?.push({ seg, payday, payPeriodLabel, payrollEntry: entry });
    }
  }

  // ── Step 2: Build month-range fetch params for each calendar month ─────────
  // For open/current month: endDate = today (MTD)
  // For closed month: endDate = last day of month
  const monthRanges = {}; // calendarMonth → { monthStart, monthEffectiveEnd, isClosed }
  for (const cm of calendarMonthsNeeded) {
    const [yr, mo] = cm?.split('-')?.map(Number);
    const monthStart = `${yr}-${String(mo)?.padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(yr, mo, 0); // day 0 of next month = last day of this month
    lastDayOfMonth?.setHours(0, 0, 0, 0);
    const isClosed = today > lastDayOfMonth;
    const monthEffectiveEnd = isClosed
      ? lastDayOfMonth?.toISOString()?.slice(0, 10)
      : todayStr; // MTD for open month
    monthRanges[cm] = { monthStart, monthEffectiveEnd, isClosed };
  }

  // ── Step 3: Fetch calendar-month collections (for Doctor Monthly Tier Table) ─
  const monthlyFetchResults = {}; // calendarMonth → { rawDoctors, rawHygienists, unknowns, placeholders }
  const monthlyFetchPromises = Object.entries(monthRanges)?.map(async ([cm, { monthStart, monthEffectiveEnd }]) => {
    try {
      const raw = await ascendApi?.getProductionByProvider(monthStart, monthEffectiveEnd, locationId);
      const rawArray = Array.isArray(raw) ? raw : (raw?.providers || raw?.data || []);
      return { cm, rawArray, error: null };
    } catch (e) {
      return { cm, rawArray: [], error: e?.message || 'fetch error' };
    }
  });

  const monthlyFetchSettled = await Promise.allSettled(monthlyFetchPromises);
  for (const settled of monthlyFetchSettled) {
    if (settled?.status === 'rejected') continue;
    const { cm, rawArray, error } = settled?.value;
    if (error || !rawArray?.length) {
      monthlyFetchResults[cm] = { rawDoctors: [], rawHygienists: [], unknowns: [], placeholders: [], fetchError: error };
      continue;
    }
    // Build raw rows
    const rawRows = rawArray?.map(perf => {
      const pid = perf?.provider_id || perf?.id;
      const providerName = perf?.name || perf?.provider_name || perf?.display_name || `Provider ${pid}`;
      const rawOfficeName = perf?.office_name || perf?.location_name || null;
      const totalCollections = Math.abs(parseFloat(perf?.collections || perf?.total_collections || perf?.totalCollections || 0));
      const grossProduction = parseFloat(perf?.gross_production || perf?.grossProduction || perf?.production || 0);
      const adjustedProduction = parseFloat(perf?.adjusted_production || perf?.adjustedProduction || perf?.net_production || grossProduction);
      return {
        providerId: pid,
        providerName,
        officeName: rawOfficeName,
        provider_type: perf?.provider_type || perf?.type || '',
        grossProduction,
        adjustedProduction,
        totalCollections,
        payPeriodStart: monthRanges?.[cm]?.monthStart,
        payPeriodEnd: monthRanges?.[cm]?.monthEffectiveEnd,
        payday: null,
        payrollType: 'monthly_tier_fetch',
        payrollName: `Monthly ${cm}`,
      };
    });
    let enrichedRows = rawRows;
    try { if (typeof enrichFn === 'function') enrichedRows = await enrichFn(rawRows); } catch (e) { /* ignore */ }
    let classified = { doctors: enrichedRows, hygienists: [], unknowns: [], placeholders: [] };
    try { if (typeof classifyFn === 'function') classified = classifyFn(enrichedRows); } catch (e) { /* ignore */ }

    // ── Rescue rows from unknowns[] when enrichment failed gracefully ──────
    // If enrichPayrollRows fails (e.g. Supabase unreachable), it returns rows
    // with payrollBucket:'unknown' / canonicalType:'unknown', causing all rows
    // to land in unknowns[]. Rescue them using:
    //   1. Raw provider_type keyword match (e.g. "dentist", "dds")
    //   2. Provider name starts with "Dr." prefix
    //   3. Known doctor name list (KNOWN_DOCTOR_RAW_NAMES)
    const rescuedDoctors = [];
    const rescuedHygienists = [];
    const remainingUnknowns = [];
    for (const row of (classified?.unknowns || [])) {
      const rawType = (row?.provider_type || row?.type || '')?.toLowerCase()?.trim();
      const rawName = (row?.displayName || row?.providerName || row?.rawName || '')?.toLowerCase()?.trim();
      const DOCTOR_KW = ['doctor', 'dentist', 'dds', 'dmd', 'orthodontist', 'periodontist', 'endodontist', 'prosthodontist', 'specialist', 'general dentist', 'general_dentist', 'pediatric'];
      const HYGIENIST_KW = ['hygienist', 'rdh', 'hygiene'];
      const isKnownDoctor = KNOWN_DOCTOR_RAW_NAMES?.some(n => rawName?.includes(n) || n?.includes(rawName?.replace(/^dr\.?\s*/i, '')));
      const hasDrPrefix = /^dr\.?\s+/i?.test(rawName);
      if (DOCTOR_KW?.some(k => rawType?.includes(k)) || isKnownDoctor || hasDrPrefix) {
        rescuedDoctors?.push({ ...row, payrollBucket: 'doctor', canonicalType: 'doctor' });
      } else if (HYGIENIST_KW?.some(k => rawType?.includes(k))) {
        rescuedHygienists?.push({ ...row, payrollBucket: 'hygienist', canonicalType: 'hygienist' });
      } else {
        remainingUnknowns?.push(row);
      }
    }

    monthlyFetchResults[cm] = {
      rawDoctors: [...(classified?.doctors || []), ...rescuedDoctors],
      rawHygienists: [...(classified?.hygienists || []), ...rescuedHygienists],
      unknowns: remainingUnknowns,
      placeholders: classified?.placeholders || [],
      fetchError: null,
      rowCount: rawArray?.length,
    };
  }

  // ── Step 4: Fetch pay-period segment collections (for Pay Period Breakdown) ─
  const segmentFetchResults = []; // { seg, payday, payPeriodLabel, rawDoctors, rawHygienists, unknowns, placeholders, fetchError }
  const segmentFetchPromises = allSegments?.map(async ({ seg, payday, payPeriodLabel, payrollEntry }) => {
    try {
      const raw = await ascendApi?.getProductionByProvider(seg?.segmentStart, seg?.segmentEnd, locationId);
      const rawArray = Array.isArray(raw) ? raw : (raw?.providers || raw?.data || []);
      return { seg, payday, payPeriodLabel, payrollEntry, rawArray, error: null };
    } catch (e) {
      return { seg, payday, payPeriodLabel, payrollEntry, rawArray: [], error: e?.message || 'fetch error' };
    }
  });

  const segmentFetchSettled = await Promise.allSettled(segmentFetchPromises);
  for (const settled of segmentFetchSettled) {
    if (settled?.status === 'rejected') continue;
    const { seg, payday, payPeriodLabel, payrollEntry, rawArray, error } = settled?.value;
    if (error || !rawArray?.length) {
      segmentFetchResults?.push({ seg, payday, payPeriodLabel, rawDoctors: [], rawHygienists: [], unknowns: [], placeholders: [], fetchError: error });
      continue;
    }
    const rawRows = rawArray?.map(perf => {
      const pid = perf?.provider_id || perf?.id;
      const providerName = perf?.name || perf?.provider_name || perf?.display_name || `Provider ${pid}`;
      const rawOfficeName = perf?.office_name || perf?.location_name || null;
      const totalCollections = Math.abs(parseFloat(perf?.collections || perf?.total_collections || perf?.totalCollections || 0));
      const grossProduction = parseFloat(perf?.gross_production || perf?.grossProduction || perf?.production || 0);
      const adjustedProduction = parseFloat(perf?.adjusted_production || perf?.adjustedProduction || perf?.net_production || grossProduction);
      return {
        providerId: pid,
        providerName,
        officeName: rawOfficeName,
        provider_type: perf?.provider_type || perf?.type || '',
        grossProduction,
        adjustedProduction,
        totalCollections,
        payPeriodStart: seg?.segmentStart,
        payPeriodEnd: seg?.segmentEnd,
        payday: payday || null,
        payrollType: payrollEntry?.payroll_type || 'regular',
        payrollName: payPeriodLabel,
      };
    });
    let enrichedRows = rawRows;
    try { if (typeof enrichFn === 'function') enrichedRows = await enrichFn(rawRows); } catch (e) { /* ignore */ }
    let classified = { doctors: enrichedRows, hygienists: [], unknowns: [], placeholders: [] };
    try { if (typeof classifyFn === 'function') classified = classifyFn(enrichedRows); } catch (e) { /* ignore */ }

    // ── Rescue rows from unknowns[] when enrichment failed gracefully ──────
    // Uses provider_type keywords, "Dr." name prefix, and known doctor name list.
    const rescuedDoctors = [];
    const rescuedHygienists = [];
    const remainingUnknowns = [];
    for (const row of (classified?.unknowns || [])) {
      const rawType = (row?.provider_type || row?.type || '')?.toLowerCase()?.trim();
      const rawName = (row?.displayName || row?.providerName || row?.rawName || '')?.toLowerCase()?.trim();
      const DOCTOR_KW = ['doctor', 'dentist', 'dds', 'dmd', 'orthodontist', 'periodontist', 'endodontist', 'prosthodontist', 'specialist', 'general dentist', 'general_dentist', 'pediatric'];
      const HYGIENIST_KW = ['hygienist', 'rdh', 'hygiene'];
      const isKnownDoctor = KNOWN_DOCTOR_RAW_NAMES?.some(n => rawName?.includes(n) || n?.includes(rawName?.replace(/^dr\.?\s*/i, '')));
      const hasDrPrefix = /^dr\.?\s+/i?.test(rawName);
      if (DOCTOR_KW?.some(k => rawType?.includes(k)) || isKnownDoctor || hasDrPrefix) {
        rescuedDoctors?.push({ ...row, payrollBucket: 'doctor', canonicalType: 'doctor' });
      } else if (HYGIENIST_KW?.some(k => rawType?.includes(k))) {
        rescuedHygienists?.push({ ...row, payrollBucket: 'hygienist', canonicalType: 'hygienist' });
      } else {
        remainingUnknowns?.push(row);
      }
    }

    segmentFetchResults?.push({
      seg, payday, payPeriodLabel,
      rawDoctors: [...(classified?.doctors || []), ...rescuedDoctors],
      rawHygienists: [...(classified?.hygienists || []), ...rescuedHygienists],
      unknowns: remainingUnknowns,
      placeholders: classified?.placeholders || [],
      fetchError: null,
      rowCount: rawArray?.length,
    });
  }

  // ── Step 5: Build Doctor Monthly Tier Table from calendar-month fetches ────
  const doctorMonthMap = {}; // key: `${providerId}__${calendarMonth}`
  const unmappedRows = [];
  const segmentWarnings = [];

  for (const [cm, fetchResult] of Object.entries(monthlyFetchResults)) {
    const { monthStart, monthEffectiveEnd, isClosed } = monthRanges?.[cm];
    if (fetchResult?.fetchError || !fetchResult?.rawDoctors?.length) {
      segmentWarnings?.push({
        calendarMonth: cm,
        monthStart,
        monthEffectiveEnd,
        message: fetchResult?.fetchError
          ? `Dentrix/FastAPI error for month ${cm}: ${fetchResult?.fetchError}`
          : `Dentrix/FastAPI returned no provider data for month ${cm} (${monthStart} – ${monthEffectiveEnd}). No fallback shown.`,
      });
    }
    for (const row of (fetchResult?.rawDoctors || [])) {
      const pid = row?.providerId || row?.provider_id;
      const monthCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
      const providerName = row?.displayName || row?.providerName || row?.rawName || `Provider ${pid}`;
      const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
      const key = `${pid}__${cm}__${officeName}`;
      if (!doctorMonthMap?.[key]) {
        doctorMonthMap[key] = {
          providerId: pid,
          providerName,
          officeName,
          calendarMonth: cm,
          monthStart,
          monthEffectiveEnd,
          isClosed,
          monthlyCollections: 0,
          mappingStatus: row?.mappingStatus || 'mapped',
          // ── Override transparency fields — passed through from backend response ──
          // These fields are set by the backend when a provider-specific payroll
          // override is active (e.g. Barnegat-only filter for Alan Schwartz).
          // They are NOT calculated or hardcoded in the frontend.
          officeFilterApplied: row?.officeFilterApplied ?? row?.raw?.officeFilterApplied ?? null,
          officeFilterLabel: row?.officeFilterLabel ?? row?.raw?.officeFilterLabel ?? null,
          officeFilterBasis: row?.officeFilterBasis ?? row?.raw?.officeFilterBasis ?? null,
          allowedLocationIds: row?.allowedLocationIds ?? row?.raw?.allowedLocationIds ?? null,
          excludedAmount: row?.excludedAmount ?? row?.raw?.excludedAmount ?? null,
        };
      }
      doctorMonthMap[key].monthlyCollections += monthCollections;
    }
    // Collect unmapped from monthly fetch
    for (const row of [...(fetchResult?.unknowns || []), ...(fetchResult?.placeholders || [])]) {
      const pid = row?.providerId || row?.provider_id;
      const rawName = row?.rawName || row?.displayName || row?.providerName || `Provider ${pid}`;
      const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
      const collections = Math.abs(parseFloat(row?.totalCollections) || 0);
      const reason = row?.classification === 'placeholder' ?'Placeholder / non-provider import label'
        : (row?.mappingStatus === 'unknown_type' ? 'Unknown provider type — needs mapping' : 'Unmapped / unattributed / office-level row');
      unmappedRows?.push({ providerRawName: rawName, officeName, dateRange: `${monthStart} – ${monthEffectiveEnd}`, collections, reasonExcluded: reason });
    }
  }

  // Finalize doctor monthly totals
  const doctorMonthlyTotals = Object.values(doctorMonthMap)?.map(entry => {
    const finalTierRate = getDoctorMonthlyTierRate(entry?.monthlyCollections);
    const finalMonthlyCompensation = entry?.monthlyCollections * finalTierRate;
    const status = entry?.isClosed ? 'Final' : 'Provisional';
    const trueUpAmount = entry?.isClosed ? null : null; // true-up calculated after segment compensation is known
    const nextPayrollRun = entry?.isClosed ? getNextPayrollAfterMonthClose(entry?.calendarMonth) : null;
    return {
      providerId: entry?.providerId,
      providerName: entry?.providerName,
      officeName: entry?.officeName,
      calendarMonth: entry?.calendarMonth,
      monthStart: entry?.monthStart,
      monthEffectiveEnd: entry?.monthEffectiveEnd,
      monthlyCollections: entry?.monthlyCollections,
      tierRate: finalTierRate,
      monthlyCompensation: finalMonthlyCompensation,
      status,
      trueUpAmount,
      nextPayrollTrueUpDate: nextPayrollRun?.payday || null,
      mappingStatus: entry?.mappingStatus,
      // ── Override transparency fields — forwarded from backend response ──
      officeFilterApplied: entry?.officeFilterApplied ?? null,
      officeFilterLabel: entry?.officeFilterLabel ?? null,
      officeFilterBasis: entry?.officeFilterBasis ?? null,
      allowedLocationIds: entry?.allowedLocationIds ?? null,
      excludedAmount: entry?.excludedAmount ?? null,
    };
  });

  // Build lookup: providerId+calendarMonth → finalTierRate (from monthly fetch)
  const monthlyTierRateByKey = {};
  doctorMonthlyTotals?.forEach(d => {
    monthlyTierRateByKey[`${d.providerId}__${d.calendarMonth}`] = d?.tierRate;
  });

  // ── Step 6: Build Pay Period Breakdown from segment fetches ───────────────
  const payPeriodBreakdown = [];
  const hygienistBreakdown = [];
  const segmentCompByMonthKey = {}; // key: `${providerId}__${calendarMonth}` → sum of segment compensation

  for (const sfr of segmentFetchResults) {
    const { seg, payday, payPeriodLabel, rawDoctors, rawHygienists, unknowns, placeholders, fetchError } = sfr;
    if (fetchError || (!rawDoctors?.length && !rawHygienists?.length)) {
      segmentWarnings?.push({
        payday,
        payPeriodLabel,
        segmentStart: seg?.segmentStart,
        segmentEnd: seg?.segmentEnd,
        calendarMonth: seg?.calendarMonth,
        message: fetchError
          ? `Dentrix/FastAPI error for segment ${seg?.segmentStart}–${seg?.segmentEnd}: ${fetchError}`
          : `Dentrix/FastAPI returned no provider data for segment ${seg?.segmentStart}–${seg?.segmentEnd}. No fallback shown.`,
      });
    }
    for (const row of (rawDoctors || [])) {
      const pid = row?.providerId || row?.provider_id;
      const key = `${pid}__${seg?.calendarMonth}`;
      const segCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
      const providerName = row?.displayName || row?.providerName || row?.rawName || `Provider ${pid}`;
      const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
      // Use the tier rate from the monthly fetch (not the segment)
      const appliedTierRate = monthlyTierRateByKey?.[key] ?? getDoctorMonthlyTierRate(segCollections);
      const segCompensation = segCollections * appliedTierRate;
      segmentCompByMonthKey[key] = (segmentCompByMonthKey?.[key] || 0) + segCompensation;
      payPeriodBreakdown?.push({
        payday,
        payPeriodLabel,
        providerId: pid,
        providerName,
        officeName,
        calendarMonth: seg?.calendarMonth,
        segmentStart: seg?.segmentStart,
        segmentEnd: seg?.segmentEnd,
        segmentCollections: segCollections,
        appliedMonthlyTierRate: appliedTierRate,
        segmentCompensation: segCompensation,
        status: isMonthClosed(seg?.calendarMonth) ? 'Final' : 'Provisional',
        mappingStatus: row?.mappingStatus || 'mapped',
      });
    }
    for (const row of (rawHygienists || [])) {
      const pid = row?.providerId || row?.provider_id;
      const segCollections = Math.abs(parseFloat(row?.totalCollections) || 0);
      const providerName = row?.displayName || row?.providerName || row?.rawName || `Provider ${pid}`;
      const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
      hygienistBreakdown?.push({
        payday,
        payPeriodLabel,
        providerId: pid,
        providerName,
        officeName,
        payPeriodCollections: segCollections,
        pct40: segCollections * 0.40,
        pct45: segCollections * 0.45,
        mappingStatus: row?.mappingStatus || 'mapped',
      });
    }
    // Collect unmapped from segment fetch
    for (const row of [...(unknowns || []), ...(placeholders || [])]) {
      const pid = row?.providerId || row?.provider_id;
      const rawName = row?.rawName || row?.displayName || row?.providerName || `Provider ${pid}`;
      const officeName = row?.canonicalOffice || row?.officeName || row?.rawOffice || 'Unknown Office';
      const collections = Math.abs(parseFloat(row?.totalCollections) || 0);
      const reason = row?.classification === 'placeholder' ?'Placeholder / non-provider import label'
        : (row?.mappingStatus === 'unknown_type' ? 'Unknown provider type — needs mapping' : 'Unmapped / unattributed / office-level row');
      // Avoid duplicate unmapped entries (monthly fetch already captured them)
      const alreadyAdded = unmappedRows?.some(u => u?.providerRawName === rawName && u?.dateRange?.includes(seg?.segmentStart));
      if (!alreadyAdded) {
        unmappedRows?.push({ providerRawName: rawName, officeName, dateRange: `${seg?.segmentStart} – ${seg?.segmentEnd}`, collections, reasonExcluded: reason });
      }
    }
  }

  // ── Step 7: Back-fill true-up on doctorMonthlyTotals using segment comp ────
  doctorMonthlyTotals?.forEach(d => {
    const key = `${d?.providerId}__${d?.calendarMonth}`;
    const paidToDateEstimate = segmentCompByMonthKey?.[key] || 0;
    d.paidToDateEstimate = paidToDateEstimate;
    if (d?.status === 'Final') {
      d.trueUpAmount = d?.monthlyCompensation - paidToDateEstimate;
    }
  });

  // ── Diagnostics ────────────────────────────────────────────────────────────
  const diagnostics = {
    calendarMonthsFetched: Array.from(calendarMonthsNeeded),
    monthRanges: Object.entries(monthRanges)?.map(([cm, r]) => ({ calendarMonth: cm, ...r })),
    segmentsFetched: allSegments?.map(s => ({ segmentStart: s?.seg?.segmentStart, segmentEnd: s?.seg?.segmentEnd, calendarMonth: s?.seg?.calendarMonth, payday: s?.payday })),
    monthlyProviderRowsReturned: Object.entries(monthlyFetchResults)?.reduce((acc, [cm, r]) => { acc[cm] = (r?.rawDoctors?.length || 0) + (r?.rawHygienists?.length || 0); return acc; }, {}),
    segmentProviderRowsReturned: segmentFetchResults?.map(s => ({ segmentStart: s?.seg?.segmentStart, segmentEnd: s?.seg?.segmentEnd, doctorRows: s?.rawDoctors?.length || 0, hygienistRows: s?.rawHygienists?.length || 0 })),
  };

  console.log('[MonthlyTierReview] Diagnostics:', diagnostics);

  return {
    doctorMonthlyTotals,
    payPeriodBreakdown,
    hygienistBreakdown,
    unmappedRows,
    segmentWarnings,
    diagnostics,
  };
}
