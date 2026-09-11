import { supabase } from '../lib/supabase';
import { subMonths, format } from 'date-fns';

// Format growth pct with division-by-zero handling
export const calcGrowthPct = (current, previous) => {
  if (previous === 0 && current === 0) return null; // N/A
  if (previous === 0 && current > 0) return 100;
  return parseFloat((((current - previous) / previous) * 100)?.toFixed(1));
};

// Fetch all active offices as { id, name } pairs — single source of truth
const fetchAllOffices = async () => {
  const { data, error } = await supabase
    ?.from('offices')
    ?.select('id, name')
    ?.eq('is_active', true)
    ?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY SOURCE: monthly_executive_analytics (MEA)
// MEA stores Dentrix Ascend net_production, collections_total, new_patients
// per office per month. This is the integrated source of truth.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate MEA records for a given month/year and list of office IDs.
 * Returns a map keyed by office UUID: { production, collection, new_patients, hasData }
 * production = net_production (Dentrix Ascend net production / true production)
 * collection = collections_total (Dentrix Ascend actual collections)
 */
const aggregateMEAForMonth = async (offices, year, month) => {
  const officeIds = offices?.map((o) => o?.id);

  const { data, error } = await supabase
    ?.from('monthly_executive_analytics')
    ?.select('office_id, net_production, collections_total, new_patients')
    ?.eq('report_year', year)
    ?.eq('report_month', month)
    ?.in('office_id', officeIds);

  if (error) throw error;

  // Initialize result map keyed by UUID
  const result = {};
  offices?.forEach((o) => {
    result[o?.id] = { production: 0, collection: 0, new_patients: 0, hasData: false };
  });

  (data || [])?.forEach((row) => {
    if (result?.[row?.office_id] !== undefined) {
      result[row?.office_id].production += parseFloat(row?.net_production || 0);
      result[row?.office_id].collection += parseFloat(row?.collections_total || 0);
      result[row?.office_id].new_patients += parseInt(row?.new_patients || 0, 10);
      result[row?.office_id].hasData = true;
    }
  });

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK SOURCE: daily_entries (Manual/EOD)
// Used only when MEA has no data for the requested period/office.
// Clearly labeled as Manual/EOD fallback in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { endOfMonth } from 'date-fns';

/**
 * Aggregate daily_entries for a given month and list of office IDs.
 * FALLBACK ONLY — used when MEA has no data.
 */
const aggregateDailyEntriesForMonth = async (offices, year, month) => {
  const monthStart = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
  const officeIds = offices?.map((o) => o?.id);

  const { data, error } = await supabase
    ?.from('daily_entries')
    ?.select('office_id, production, collection, new_patients')
    ?.gte('entry_date', monthStart)
    ?.lte('entry_date', monthEnd)
    ?.in('office_id', officeIds);

  if (error) throw error;

  const result = {};
  offices?.forEach((o) => {
    result[o?.id] = { production: 0, collection: 0, new_patients: 0, hasData: false };
  });

  (data || [])?.forEach((row) => {
    if (result?.[row?.office_id] !== undefined) {
      result[row?.office_id].production += parseFloat(row?.production || 0);
      result[row?.office_id].collection += parseFloat(row?.collection || 0);
      result[row?.office_id].new_patients += parseInt(row?.new_patients || 0, 10);
      result[row?.office_id].hasData = true;
    }
  });

  return result;
};

/**
 * fetchMonthlyGrowth(selectedMonth: 1-12, selectedYear: number)
 * PRIMARY: monthly_executive_analytics (MEA) — net_production + collections_total
 * FALLBACK: daily_entries (Manual/EOD) — only when MEA has no data for that period
 * Returns array of office objects with MoM growth + GROUP TOTAL row + dataSource flag
 */
export const fetchMonthlyGrowth = async (selectedMonth, selectedYear) => {
  const offices = await fetchAllOffices();

  const prevDate = subMonths(new Date(selectedYear, selectedMonth - 1, 1), 1);
  const prevMonth = prevDate?.getMonth() + 1;
  const prevYear = prevDate?.getFullYear();

  // Attempt MEA first for both months
  const [meaCurr, meaPrev] = await Promise.all([
    aggregateMEAForMonth(offices, selectedYear, selectedMonth),
    aggregateMEAForMonth(offices, prevYear, prevMonth),
  ]);

  // Determine if MEA has data for either month
  const meaCurrHasAny = offices?.some((o) => meaCurr?.[o?.id]?.hasData);
  const meaPrevHasAny = offices?.some((o) => meaPrev?.[o?.id]?.hasData);
  const meaAvailable = meaCurrHasAny || meaPrevHasAny;

  let currData = meaCurr;
  let prevData = meaPrev;
  let dataSource = 'MEA'; // Dentrix-backed monthly_executive_analytics

  if (!meaAvailable) {
    // Fallback to daily_entries only when MEA has no data at all
    const [deCurr, dePrev] = await Promise.all([
      aggregateDailyEntriesForMonth(offices, selectedYear, selectedMonth),
      aggregateDailyEntriesForMonth(offices, prevYear, prevMonth),
    ]);
    currData = deCurr;
    prevData = dePrev;
    dataSource = 'daily_entries_fallback';
  }

  const officeRows = offices?.map((o) => {
    const curr = currData?.[o?.id];
    const prev = prevData?.[o?.id];
    return {
      office_id: o?.id,
      office_name: o?.name,
      current_production: curr?.production ?? 0,
      prev_production: prev?.production ?? 0,
      production_growth_pct: calcGrowthPct(curr?.production ?? 0, prev?.production ?? 0),
      current_collection: curr?.collection ?? 0,
      prev_collection: prev?.collection ?? 0,
      collection_growth_pct: calcGrowthPct(curr?.collection ?? 0, prev?.collection ?? 0),
      current_new_patients: curr?.new_patients ?? 0,
      prev_new_patients: prev?.new_patients ?? 0,
      new_patients_growth_pct: calcGrowthPct(curr?.new_patients ?? 0, prev?.new_patients ?? 0),
    };
  });

  // Sort by production_growth_pct descending for leaderboard (nulls last)
  const sorted = [...officeRows]?.sort((a, b) => {
    const aVal = a?.production_growth_pct ?? -Infinity;
    const bVal = b?.production_growth_pct ?? -Infinity;
    return bVal - aVal;
  });

  // GROUP TOTAL row
  const groupTotal = {
    office_name: 'Group Total',
    current_production: officeRows?.reduce((s, o) => s + o?.current_production, 0),
    prev_production: officeRows?.reduce((s, o) => s + o?.prev_production, 0),
    current_collection: officeRows?.reduce((s, o) => s + o?.current_collection, 0),
    prev_collection: officeRows?.reduce((s, o) => s + o?.prev_collection, 0),
    current_new_patients: officeRows?.reduce((s, o) => s + o?.current_new_patients, 0),
    prev_new_patients: officeRows?.reduce((s, o) => s + o?.prev_new_patients, 0),
  };
  groupTotal.production_growth_pct = calcGrowthPct(groupTotal?.current_production, groupTotal?.prev_production);
  groupTotal.collection_growth_pct = calcGrowthPct(groupTotal?.current_collection, groupTotal?.prev_collection);
  groupTotal.new_patients_growth_pct = calcGrowthPct(groupTotal?.current_new_patients, groupTotal?.prev_new_patients);

  return { rankedOffices: sorted, groupTotal, prevMonth, prevYear, dataSource };
};

/**
 * fetchMonthlyGrowthHistory(officeFilter, months=12)
 * PRIMARY: monthly_executive_analytics (MEA) — net_production + collections_total
 * FALLBACK: daily_entries — only when MEA has no data for a given month
 * officeFilter: 'all' | office UUID
 * Returns month-by-month production/collection for trend sparklines
 */
export const fetchMonthlyGrowthHistory = async (officeFilter = 'all', months = 12) => {
  const now = new Date();
  const results = [];

  // Build month list
  const monthList = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    monthList?.push({ year: d?.getFullYear(), month: d?.getMonth() + 1, label: format(d, 'MMM yy') });
  }

  // Fetch MEA records for the full range in one query
  const minYear = monthList?.[0]?.year;
  const maxYear = monthList?.[monthList?.length - 1]?.year;

  let meaQuery = supabase
    ?.from('monthly_executive_analytics')
    ?.select('office_id, net_production, collections_total, report_month, report_year')
    ?.gte('report_year', minYear)
    ?.lte('report_year', maxYear);

  if (officeFilter !== 'all') {
    meaQuery = meaQuery?.eq('office_id', officeFilter);
  }

  const { data: meaData } = await meaQuery;
  const meaRows = meaData || [];

  // Build a lookup: "year-month" → { production, collection }
  const meaLookup = {};
  meaRows?.forEach((r) => {
    const key = `${r?.report_year}-${r?.report_month}`;
    if (!meaLookup?.[key]) {
      meaLookup[key] = { production: 0, collection: 0, hasData: false };
    }
    meaLookup[key].production += parseFloat(r?.net_production || 0);
    meaLookup[key].collection += parseFloat(r?.collections_total || 0);
    meaLookup[key].hasData = true;
  });

  for (const { year: yr, month: mo, label: monthLabel } of monthList) {
    const key = `${yr}-${mo}`;
    const meaEntry = meaLookup?.[key];

    if (meaEntry?.hasData) {
      results?.push({ month: monthLabel, production: meaEntry?.production, collection: meaEntry?.collection, source: 'MEA' });
    } else {
      // Fallback: daily_entries for this month
      const monthStart = format(new Date(yr, mo - 1, 1), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date(yr, mo - 1, 1)), 'yyyy-MM-dd');

      let deQuery = supabase
        ?.from('daily_entries')
        ?.select('office_id, production, collection')
        ?.gte('entry_date', monthStart)
        ?.lte('entry_date', monthEnd);

      if (officeFilter !== 'all') {
        deQuery = deQuery?.eq('office_id', officeFilter);
      }

      const { data: deData } = await deQuery;
      const rows = deData || [];
      const production = rows?.reduce((s, r) => s + parseFloat(r?.production || 0), 0);
      const collection = rows?.reduce((s, r) => s + parseFloat(r?.collection || 0), 0);
      results?.push({ month: monthLabel, production, collection, source: 'daily_entries_fallback' });
    }
  }

  return results;
};

/**
 * fetchSparklineData — last 6 months per office, keyed by office UUID
 * PRIMARY: MEA net_production; FALLBACK: daily_entries
 */
export const fetchSparklineData = async () => {
  const offices = await fetchAllOffices();
  const now = new Date();
  const sparklines = {};

  // Build month list for last 6 months
  const monthList = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    monthList?.push({ year: d?.getFullYear(), month: d?.getMonth() + 1, label: format(d, 'MMM') });
  }

  const minYear = monthList?.[0]?.year;
  const maxYear = monthList?.[monthList?.length - 1]?.year;

  // Fetch all MEA records for the range in one query
  const { data: meaData } = await supabase
    ?.from('monthly_executive_analytics')
    ?.select('office_id, net_production, report_month, report_year')
    ?.gte('report_year', minYear)
    ?.lte('report_year', maxYear)
    ?.in('office_id', offices?.map((o) => o?.id));

  const meaRows = meaData || [];

  // Build lookup: "officeId-year-month" → net_production
  const meaLookup = {};
  meaRows?.forEach((r) => {
    const key = `${r?.office_id}-${r?.report_year}-${r?.report_month}`;
    meaLookup[key] = parseFloat(r?.net_production || 0);
  });

  for (const office of offices) {
    const points = [];
    for (const { year: yr, month: mo, label } of monthList) {
      const key = `${office?.id}-${yr}-${mo}`;
      if (meaLookup?.[key] !== undefined) {
        points?.push({ month: label, production: meaLookup?.[key], source: 'MEA' });
      } else {
        // Fallback: daily_entries for this office/month
        const monthStart = format(new Date(yr, mo - 1, 1), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(new Date(yr, mo - 1, 1)), 'yyyy-MM-dd');
        const { data: deData } = await supabase
          ?.from('daily_entries')
          ?.select('production')
          ?.eq('office_id', office?.id)
          ?.gte('entry_date', monthStart)
          ?.lte('entry_date', monthEnd);
        const production = (deData || [])?.reduce((s, r) => s + parseFloat(r?.production || 0), 0);
        points?.push({ month: label, production, source: 'daily_entries_fallback' });
      }
    }
    sparklines[office?.id] = { name: office?.name, points };
  }

  return sparklines;
};
