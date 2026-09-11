import { supabase } from '../lib/supabase';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Fetch all monthly_executive_analytics records for given years and optional office filter.
 * Returns a map: { [year]: records[] }
 */
export const fetchMultiYearMEAData = async (years = [], officeIds = []) => {
  if (!years?.length) return {};

  try {
    let query = supabase
      ?.from('monthly_executive_analytics')
      ?.select('*')
      ?.in('report_year', years);

    if (officeIds?.length > 0) {
      query = query?.in('office_id', officeIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const result = {};
    years?.forEach(y => { result[y] = []; });
    (data || [])?.forEach(r => {
      const y = parseInt(r?.report_year);
      if (result?.[y]) result?.[y]?.push(r);
    });
    return result;
  } catch (err) {
    console.warn('fetchMultiYearMEAData error:', err?.message);
    return {};
  }
};

/**
 * Aggregate records for a single year into KPI totals.
 */
export const aggregateYearKPIs = (records = []) => {
  if (!records?.length) return null;

  const sum = (field) => records?.reduce((acc, r) => acc + (parseFloat(r?.[field]) || 0), 0);

  const production = sum('net_production');
  const collections = sum('collections_total');
  const expenses = sum('expenses_total');
  const adjustments = sum('adjustments_net');
  const hygiene = sum('hygiene_prod');
  const doctor = sum('doctor_prod');
  const newPatients = sum('new_patients');
  const activePatients = sum('active_patients');
  const payroll = sum('payroll_total');
  const labFees = sum('lab_fees_total');
  const supplies = sum('supplies_total');
  const marketing = sum('marketing_spend');
  const txDiag = sum('tx_diagnosed_value');
  const txAcc = sum('tx_accepted_value');
  const arCurrent = sum('ar_current');
  const ar3060 = sum('ar_30_60');
  const ar6090 = sum('ar_60_90');
  const ar90plus = sum('ar_90_plus');
  const outstandingClaims = sum('outstanding_claims_value');
  const usedHours = sum('used_chair_hours');
  const availHours = sum('available_chair_hours');
  const brokenAppts = sum('broken_appointments');
  const totalAR = arCurrent + ar3060 + ar6090 + ar90plus;

  return {
    production,
    collections,
    expenses,
    adjustments,
    hygiene,
    doctor,
    newPatients,
    activePatients,
    payroll,
    labFees,
    supplies,
    marketing,
    txDiag,
    txAcc,
    arCurrent,
    ar3060,
    ar6090,
    ar90plus,
    totalAR,
    outstandingClaims,
    usedHours,
    availHours,
    brokenAppts,
    netIncome: collections - expenses + adjustments,
    collectionRate: production > 0 ? (collections / production) * 100 : null,
    caseAcceptance: txDiag > 0 ? (txAcc / txDiag) * 100 : null,
    chairUtilization: availHours > 0 ? (usedHours / availHours) * 100 : null,
    ar90Pct: totalAR > 0 ? (ar90plus / totalAR) * 100 : null,
    hygienePct: production > 0 ? (hygiene / production) * 100 : null,
    doctorPct: production > 0 ? (doctor / production) * 100 : null,
  };
};

/**
 * Build month-by-month chart data for multiple years.
 * Returns array of 12 objects: { month: 'Jan', 2024: val, 2025: val, ... }
 */
export const buildMonthlyComparisonData = (yearDataMap = {}, field = 'net_production') => {
  const years = Object.keys(yearDataMap)?.map(Number);

  return MONTH_NAMES_SHORT?.map((monthName, idx) => {
    const monthNum = idx + 1;
    const row = { month: monthName };

    years?.forEach(year => {
      const records = yearDataMap?.[year] || [];
      const monthRecords = records?.filter(r => parseInt(r?.report_month) === monthNum);
      const total = monthRecords?.reduce((acc, r) => acc + (parseFloat(r?.[field]) || 0), 0);
      row[year] = monthRecords?.length > 0 ? total : null;
    });

    return row;
  });
};

/**
 * Calculate % change between two values.
 * Returns null if base is 0 or either value is null.
 */
export const calcPctChange = (current, previous) => {
  if (previous === null || previous === undefined || previous === 0) return null;
  if (current === null || current === undefined) return null;
  return parseFloat((((current - previous) / Math.abs(previous)) * 100)?.toFixed(1));
};

/**
 * Build comparison KPI rows for a set of years.
 * Returns: { [metricKey]: { label, format, values: { [year]: value }, changes: { [year]: pct } } }
 */
export const buildComparisonKPIRows = (yearKPIMap = {}) => {
  const years = Object.keys(yearKPIMap)?.map(Number)?.sort((a, b) => b - a);

  const metrics = [
    // production maps to net_production in monthly_executive_analytics (MEA).
    // net_production = UCR fee minus production adjustments — confirmed Dentrix Ascend net production field.
    { key: 'production', label: 'Net Production (MEA)', format: 'currency', higherIsBetter: true },
    { key: 'collections', label: 'Collections (MEA)', format: 'currency', higherIsBetter: true },
    { key: 'netIncome', label: 'Net Income', format: 'currency', higherIsBetter: true },
    { key: 'expenses', label: 'Total Expenses', format: 'currency', higherIsBetter: false },
    { key: 'hygiene', label: 'Hygiene Production', format: 'currency', higherIsBetter: true },
    { key: 'doctor', label: 'Doctor Production', format: 'currency', higherIsBetter: true },
    { key: 'newPatients', label: 'New Patients', format: 'number', higherIsBetter: true },
    { key: 'activePatients', label: 'Active Patients', format: 'number', higherIsBetter: true },
    { key: 'payroll', label: 'Payroll Total', format: 'currency', higherIsBetter: false },
    { key: 'labFees', label: 'Lab Fees', format: 'currency', higherIsBetter: false },
    { key: 'supplies', label: 'Supplies', format: 'currency', higherIsBetter: false },
    // collectionRate from MEA: collections_total / net_production — correct net production denominator
    { key: 'collectionRate', label: 'Collection Rate (MEA)', format: 'percent', higherIsBetter: true },
    { key: 'caseAcceptance', label: 'Case Acceptance', format: 'percent', higherIsBetter: true },
    { key: 'chairUtilization', label: 'Chair Utilization', format: 'percent', higherIsBetter: true },
    { key: 'txDiag', label: 'Treatment Diagnosed', format: 'currency', higherIsBetter: true },
    { key: 'txAcc', label: 'Treatment Accepted', format: 'currency', higherIsBetter: true },
    { key: 'arCurrent', label: 'A/R Current (MEA — legacy)', format: 'currency', higherIsBetter: false },
    { key: 'ar3060', label: 'A/R 30-60 (MEA — legacy)', format: 'currency', higherIsBetter: false },
    { key: 'ar6090', label: 'A/R 60-90 (MEA — legacy)', format: 'currency', higherIsBetter: false },
    { key: 'ar90plus', label: 'A/R 90+ (MEA — legacy)', format: 'currency', higherIsBetter: false },
    { key: 'totalAR', label: 'Total A/R (MEA — legacy)', format: 'currency', higherIsBetter: false },
    { key: 'outstandingClaims', label: 'Outstanding Claims', format: 'currency', higherIsBetter: false },
    { key: 'brokenAppts', label: 'Broken Appointments', format: 'number', higherIsBetter: false },
  ];

  return metrics?.map(metric => {
    const values = {};
    const changes = {};

    years?.forEach((year, idx) => {
      const kpis = yearKPIMap?.[year];
      values[year] = kpis?.[metric?.key] ?? null;

      // Compare to next older year
      const olderYear = years?.[idx + 1];
      if (olderYear !== undefined) {
        const olderVal = yearKPIMap?.[olderYear]?.[metric?.key] ?? null;
        changes[year] = calcPctChange(values?.[year], olderVal);
      }
    });

    return { ...metric, values, changes, years };
  });
};

/**
 * Format a value for display based on its format type.
 */
export const formatComparisonValue = (value, format) => {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(value);
  }
  if (format === 'percent') {
    return `${parseFloat(value)?.toFixed(1)}%`;
  }
  return new Intl.NumberFormat('en-US')?.format(Math.round(value));
};
