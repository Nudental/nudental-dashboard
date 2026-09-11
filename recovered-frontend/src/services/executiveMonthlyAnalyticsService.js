import { supabase } from '../lib/supabase';

// Kept only for CSV import example row — NOT used as dropdown values
export const OFFICE_OPTIONS = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Strip $, commas; return float or 0
// NOTE: Used for form submit / import payload — intentionally returns 0 for blank inputs.
// Do NOT use for display; use formatCurrencyDisplay in components instead.
export const sanitizeNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val)?.replace(/[$,]/g, '')?.trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Null-safe number parser for aggregation — returns null for missing/empty, preserves real 0
const parseNumericField = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
};

// Safe division — returns null on divide-by-zero or NaN
export const safeDivide = (numerator, denominator) => {
  const n = parseFloat(numerator);
  const d = parseFloat(denominator);
  if (!isFinite(n) || !isFinite(d) || d === 0) return null;
  return n / d;
};

export const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(val || 0);

export const formatPct = (val) => {
  if (val === null || val === undefined || !isFinite(val)) return '—';
  return `${parseFloat(val)?.toFixed(1)}%`;
};

// Fetch a single record by office + month + year
export const fetchRecord = async (officeId, month, year) => {
  const { data, error } = await supabase?.from('monthly_executive_analytics')?.select('*')?.eq('office_id', officeId)?.eq('report_month', month)?.eq('report_year', year)?.maybeSingle();
  if (error) throw error;
  return data;
};

// Upsert a record
export const upsertRecord = async (payload) => {
  const { data, error } = await supabase?.from('monthly_executive_analytics')?.upsert(payload, { onConflict: 'office_id,report_month,report_year' })?.select()?.single();
  if (error) throw error;
  return data;
};

// Fetch records for summary (with optional filters)
export const fetchSummaryRecords = async ({ officeId, year, month, ytd } = {}) => {
  let query = supabase?.from('monthly_executive_analytics')?.select('*');

  if (officeId && officeId !== 'all') {
    query = query?.eq('office_id', officeId);
  }
  if (year) {
    query = query?.eq('report_year', parseInt(year));
  }
  if (ytd) {
    const currentMonth = new Date()?.getMonth() + 1;
    query = query?.lte('report_month', currentMonth);
  } else if (month) {
    query = query?.eq('report_month', parseInt(month));
  }

  query = query?.order('report_year', { ascending: false })?.order('report_month', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Fetch last 6 months of records for a given office (or all offices)
export const fetchLast6Months = async (officeId) => {
  const now = new Date();
  const records = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    records?.push({ year: d?.getFullYear(), month: d?.getMonth() + 1 });
  }
  const minYear = records?.[0]?.year;
  const minMonth = records?.[0]?.month;

  let query = supabase?.from('monthly_executive_analytics')?.select('*')?.gte('report_year', minYear);

  if (officeId && officeId !== 'all') {
    query = query?.eq('office_id', officeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter to last 6 months
  return (data || [])?.filter((r) => {
    if (r?.report_year > minYear) return true;
    if (r?.report_year === minYear && r?.report_month >= minMonth) return true;
    return false;
  });
};

// Compute live insights from form values
export const computeInsights = (vals) => {
  const txDiag = sanitizeNumber(vals?.tx_diagnosed_value);
  const txAcc = sanitizeNumber(vals?.tx_accepted_value);
  const arCurrent = sanitizeNumber(vals?.ar_current);
  const ar3060 = sanitizeNumber(vals?.ar_30_60);
  const ar6090 = sanitizeNumber(vals?.ar_60_90);
  const ar90plus = sanitizeNumber(vals?.ar_90_plus);
  const totalAR = arCurrent + ar3060 + ar6090 + ar90plus;
  const hygiene = sanitizeNumber(vals?.hygiene_prod);
  const doctor = sanitizeNumber(vals?.doctor_prod);
  const totalProd = hygiene + doctor;
  const usedHours = sanitizeNumber(vals?.used_chair_hours);
  const availHours = sanitizeNumber(vals?.available_chair_hours);
  const collections = sanitizeNumber(vals?.collections_total);
  const production = sanitizeNumber(vals?.production_total);
  const expenses = sanitizeNumber(vals?.expenses_total);
  const adjustments = sanitizeNumber(vals?.adjustments_net);

  const caseAcceptancePct = safeDivide(txAcc, txDiag);
  const ar90HealthPct = safeDivide(ar90plus, totalAR);
  const utilizationPct = safeDivide(usedHours, availHours);
  const hygienePct = safeDivide(hygiene, totalProd);
  const doctorPct = safeDivide(doctor, totalProd);
  const collectionsPct = safeDivide(collections, production);
  const netIncome = collections - expenses + adjustments;

  return {
    caseAcceptancePct: caseAcceptancePct !== null ? caseAcceptancePct * 100 : null,
    totalAR,
    ar90HealthPct: ar90HealthPct !== null ? ar90HealthPct * 100 : null,
    ar90HighRisk: ar90HealthPct !== null && ar90HealthPct * 100 > 10,
    utilizationPct: utilizationPct !== null ? utilizationPct * 100 : null,
    hygienePct: hygienePct !== null ? hygienePct * 100 : null,
    doctorPct: doctorPct !== null ? doctorPct * 100 : null,
    collectionsPct: collectionsPct !== null ? collectionsPct * 100 : null,
    netIncome,
    brokenAppointments: parseInt(vals?.broken_appointments || 0),
  };
};

// Aggregate multiple records into KPI totals
export const aggregateKPIs = (records) => {
  if (!records || records?.length === 0) return null;

  // sumNullable: returns null if ALL records have null for that field, otherwise sums (treating null as 0)
  const sumNullable = (field) => {
    const hasAny = records?.some((r) => parseNumericField(r?.[field]) !== null);
    if (!hasAny) return null;
    return records?.reduce((acc, r) => acc + (parseNumericField(r?.[field]) ?? 0), 0);
  };

  const production = sumNullable('production_total');
  const collections = sumNullable('collections_total');
  const expenses = sumNullable('expenses_total');
  const adjustments = sumNullable('adjustments_net');
  const txDiag = sumNullable('tx_diagnosed_value');
  const txAcc = sumNullable('tx_accepted_value');
  const arCurrent = sumNullable('ar_current');
  const ar3060 = sumNullable('ar_30_60');
  const ar6090 = sumNullable('ar_60_90');
  const ar90plus = sumNullable('ar_90_plus');
  const totalAR = (arCurrent !== null || ar3060 !== null || ar6090 !== null || ar90plus !== null)
    ? (arCurrent ?? 0) + (ar3060 ?? 0) + (ar6090 ?? 0) + (ar90plus ?? 0)
    : null;
  const newPatients = sumNullable('new_patients');
  const usedHours = sumNullable('used_chair_hours');
  const availHours = sumNullable('available_chair_hours');

  const netIncome = (collections !== null || expenses !== null || adjustments !== null)
    ? (collections ?? 0) - (expenses ?? 0) + (adjustments ?? 0)
    : null;

  return {
    production,
    collections,
    netIncome,
    collectionsPct: (collections !== null && production !== null)
      ? (safeDivide(collections, production) !== null ? (collections / production) * 100 : null)
      : null,
    caseAcceptancePct: (txAcc !== null && txDiag !== null)
      ? (safeDivide(txAcc, txDiag) !== null ? (txAcc / txDiag) * 100 : null)
      : null,
    newPatients,
    totalAR,
    ar90plus,
    ar90HealthPct: (ar90plus !== null && totalAR !== null)
      ? (safeDivide(ar90plus, totalAR) !== null ? (ar90plus / totalAR) * 100 : null)
      : null,
    utilizationPct: (usedHours !== null && availHours !== null)
      ? (safeDivide(usedHours, availHours) !== null ? (usedHours / availHours) * 100 : null)
      : null,
  };
};

// Fetch and aggregate MEA KPIs for a given month/year (used by Executive Overview)
export const fetchCurrentMonthMEAKPIs = async (month, year) => {
  const { data, error } = await supabase
    ?.from('monthly_executive_analytics')
    ?.select('office_id, production_total, collections_total, expenses_total, adjustments_net, new_patients, tx_diagnosed_value, tx_accepted_value, ar_current, ar_30_60, ar_60_90, ar_90_plus, used_chair_hours, available_chair_hours')
    ?.eq('report_month', month)
    ?.eq('report_year', year);
  if (error) throw error;
  const records = data || [];
  if (records?.length === 0) return null;
  return aggregateKPIs(records);
};

// Fetch and aggregate MEA KPIs for a date range (start/end as 'yyyy-MM-dd')
// Finds all monthly_executive_analytics records whose (report_year, report_month) fall within the range
export const fetchMEAKPIsForDateRange = async (startDate, endDate) => {
  try {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (isNaN(start?.getTime()) || isNaN(end?.getTime())) return null;

    const startYear = start?.getFullYear();
    const startMonth = start?.getMonth() + 1;
    const endYear = end?.getFullYear();
    const endMonth = end?.getMonth() + 1;

    // Fetch all records in the year range, then filter by month
    const { data, error } = await supabase
      ?.from('monthly_executive_analytics')
      ?.select('office_id, production_total, collections_total, expenses_total, adjustments_net, new_patients, tx_diagnosed_value, tx_accepted_value, ar_current, ar_30_60, ar_60_90, ar_90_plus, used_chair_hours, available_chair_hours, report_month, report_year')
      ?.gte('report_year', startYear)
      ?.lte('report_year', endYear);

    if (error) throw error;

    const allRecords = data || [];

    // Filter to records within the month range
    const records = allRecords?.filter((r) => {
      const rYear = parseInt(r?.report_year) || 0;
      const rMonth = parseInt(r?.report_month) || 0;
      // Convert to a comparable number: year*100 + month
      const rVal = rYear * 100 + rMonth;
      const startVal = startYear * 100 + startMonth;
      const endVal = endYear * 100 + endMonth;
      return rVal >= startVal && rVal <= endVal;
    });

    if (records?.length === 0) return null;
    return aggregateKPIs(records);
  } catch (err) {
    console.warn('fetchMEAKPIsForDateRange error:', err?.message);
    return null;
  }
};

// Build CSV template string
export const buildCSVTemplate = () => {
  const headers = [
    'office_id', 'report_month', 'report_year',
    'active_patients', 'new_patients', 'attrition_count',
    'tx_diagnosed_value', 'tx_accepted_value',
    'ar_current', 'ar_30_60', 'ar_60_90', 'ar_90_plus', 'outstanding_claims_value',
    'hygiene_prod', 'doctor_prod', 'available_chair_hours', 'used_chair_hours', 'broken_appointments',
    'production_total', 'collections_total', 'adjustments_net', 'refunds_total',
    'writeoffs_total', 'expenses_total', 'payroll_total', 'marketing_spend',
    'lab_fees_total', 'supplies_total', 'notes', 'data_source',
  ];
  const exampleRow = [
    'Nu Dental of Eatontown', '1', '2026',
    '450', '32', '5',
    '85000', '62000',
    '45000', '12000', '8000', '3500', '9000',
    '38000', '47000', '160', '148', '4',
    '85000', '78000', '-2500', '500',
    '1200', '22000', '35000', '3000',
    '4500', '2800', 'Monthly report', 'CSV Import',
  ];
  return [headers?.join(','), exampleRow?.join(',')]?.join('\n');
};

// Parse and validate CSV rows
// NOTE: office_id in CSV must be the UUID from the offices table (not the office name)
export const parseAndValidateCSV = (rows, officesList = []) => {
  const valid = [];
  const errors = [];

  // Build a lookup: name → id and id → id (accept both)
  const officeNameToId = {};
  const officeIdSet = new Set();
  officesList?.forEach((o) => {
    if (o?.name) officeNameToId[o.name.trim()] = o?.id;
    if (o?.id) officeIdSet?.add(o?.id);
  });

  // Fallback: accept legacy TEXT office names from OFFICE_OPTIONS if officesList not provided
  const legacyNames = new Set(OFFICE_OPTIONS);

  rows?.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header
    const r = { ...row };

    const rawOffice = r?.office_id?.trim();

    // Accept UUID directly
    if (officeIdSet?.has(rawOffice)) {
      r.office_id = rawOffice; // already a UUID
    } else if (officeNameToId?.[rawOffice]) {
      // Accept office name and convert to UUID
      r.office_id = officeNameToId?.[rawOffice];
    } else if (legacyNames?.has(rawOffice) && officesList?.length === 0) {
      // Legacy fallback when no offices list provided — keep as-is (will fail at DB if TEXT)
      r.office_id = rawOffice;
    } else {
      errors?.push({ ...r, error_reason: `Row ${rowNum}: Invalid office_id "${rawOffice}". Use a valid office UUID or office name.` });
      return;
    }

    // Sanitize all numeric fields
    const numericFields = [
      'active_patients', 'new_patients', 'attrition_count',
      'tx_diagnosed_value', 'tx_accepted_value',
      'ar_current', 'ar_30_60', 'ar_60_90', 'ar_90_plus', 'outstanding_claims_value',
      'hygiene_prod', 'doctor_prod', 'available_chair_hours', 'used_chair_hours', 'broken_appointments',
      'production_total', 'collections_total', 'adjustments_net', 'refunds_total',
      'writeoffs_total', 'expenses_total', 'payroll_total', 'marketing_spend',
      'lab_fees_total', 'supplies_total',
    ];
    numericFields?.forEach((f) => { r[f] = sanitizeNumber(r?.[f]); });

    // Clinical validation
    if (r?.tx_diagnosed_value > 0 && r?.tx_accepted_value > 0 && r?.tx_accepted_value > r?.tx_diagnosed_value) {
      errors?.push({ ...r, error_reason: `Row ${rowNum}: tx_accepted_value (${r?.tx_accepted_value}) exceeds tx_diagnosed_value (${r?.tx_diagnosed_value})` });
      return;
    }

    r.report_month = parseInt(r?.report_month);
    r.report_year = parseInt(r?.report_year);
    r.notes = r?.notes || '';
    r.data_source = r?.data_source || 'CSV Import';

    valid?.push(r);
  });

  return { valid, errors };
};

// Download a string as a file
export const downloadFile = (content, filename, mimeType = 'text/csv') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a?.click();
  URL.revokeObjectURL(url);
};

// Fetch all offices from Supabase (returns [{id, name}])
export const fetchOffices = async () => {
  const { data, error } = await supabase
    ?.from('offices')
    ?.select('id, name')
    ?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};
