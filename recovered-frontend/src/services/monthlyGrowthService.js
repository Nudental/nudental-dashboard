import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';

export const calcGrowthPct = (current, previous) => {
  if (previous === 0 && current === 0) return null; // N/A
  if (previous === 0 && current > 0) return 100;
  return parseFloat((((current - previous) / previous) * 100)?.toFixed(1));
};

const fetchAllOffices = async () => {
  const { data, error } = await supabase.from('offices').select('id, name').eq('is_active', true).order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Bound reads across rapid filter changes; stale queued reads never start.
let activeReads = 0;
const pendingReads = [];
const drainReads = () => {
  while (activeReads < 4 && pendingReads.length) {
    const { read, resolve, reject } = pendingReads.shift();
    activeReads += 1;
    Promise.resolve().then(read).then(resolve, reject).finally(() => { activeReads -= 1; drainReads(); });
  }
};
const makeContext = (isCurrent = () => true) => ({ pending: new Map(), isCurrent });
const monthDate = (year, month, offset = 0) => new Date(year, month - 1 + offset, 1);
const dateText = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const readMetric = (context, officeId, year, month, metric) => {
  const key = `${officeId || 'all'}:${year}:${month}:${metric}`;
  if (!context.pending.has(key)) {
    const task = new Promise((resolve, reject) => {
      pendingReads.push({ resolve, reject, read: async () => {
        if (!context.isCurrent()) throw new Error('Monthly growth request superseded');
        const start = dateText(monthDate(year, month));
        const end = dateText(new Date(year, month, 0));
        const method = metric === 'production' ? 'getProduction' : metric === 'collection' ? 'getCollections' : 'getPatients';
        const field = metric === 'production' ? 'netProduction' : metric === 'collection' ? 'totalCollections' : 'newPatients';
        const result = await ascendApi[method](start, end, officeId);
        const raw = result?.[field];
        if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean' || !Number.isFinite(Number(raw))) {
          throw new Error('Monthly growth data is unavailable for the selected period');
        }
        return Number(raw);
      }});
      drainReads();
    });
    context.pending.set(key, task);
  }
  return context.pending.get(key);
};
const aggregateMonth = async (offices, year, month, context, patients = true) => {
  const rows = await Promise.all(offices.map(async (office) => {
    const [production, collection, new_patients] = await Promise.all([
      readMetric(context, office.id, year, month, 'production'),
      readMetric(context, office.id, year, month, 'collection'),
      patients ? readMetric(context, office.id, year, month, 'new_patients') : 0,
    ]);
    return [office.id, { production, collection, new_patients }];
  }));
  return Object.fromEntries(rows);
};
const monthList = (year, month, length) => Array.from({ length }, (_, index) => monthDate(year, month, index - length + 1));
const shortMonth = (date, withYear = false) => date.toLocaleDateString('en-US', { month: 'short', ...(withYear ? { year: '2-digit' } : {}) });

export const fetchMonthlyGrowth = async (selectedMonth, selectedYear, officeFilter = 'all', includeTrends = false, isCurrent = () => true) => {
  const offices = (await fetchAllOffices()).filter((office) => officeFilter === 'all' || office.id === officeFilter);
  const context = makeContext(isCurrent);
  const previous = monthDate(selectedYear, selectedMonth, -1);
  const prevYear = previous.getFullYear(), prevMonth = previous.getMonth() + 1;
  const [currData, prevData, networkPatients, history, sparklines] = await Promise.all([
    aggregateMonth(offices, selectedYear, selectedMonth, context),
    aggregateMonth(offices, prevYear, prevMonth, context),
    officeFilter === 'all' && offices.length ? Promise.all([
      readMetric(context, null, selectedYear, selectedMonth, 'new_patients'),
      readMetric(context, null, prevYear, prevMonth, 'new_patients'),
    ]) : null,
    includeTrends ? fetchMonthlyGrowthHistory(officeFilter, 12, selectedMonth, selectedYear, context, offices) : [],
    includeTrends ? fetchSparklineData(officeFilter, selectedMonth, selectedYear, context, offices) : {},
  ]);
  const officeRows = offices.map((office) => {
    const current = currData[office.id], prior = prevData[office.id];
    return {
      office_id: office.id, office_name: office.name,
      current_production: current.production, prev_production: prior.production,
      production_growth_pct: calcGrowthPct(current.production, prior.production),
      current_collection: current.collection, prev_collection: prior.collection,
      collection_growth_pct: calcGrowthPct(current.collection, prior.collection),
      current_new_patients: current.new_patients, prev_new_patients: prior.new_patients,
      new_patients_growth_pct: calcGrowthPct(current.new_patients, prior.new_patients),
    };
  });
  const groupTotal = { office_name: 'Group Total' };
  for (const key of ['current_production', 'prev_production', 'current_collection', 'prev_collection', 'current_new_patients', 'prev_new_patients']) {
    groupTotal[key] = officeRows.reduce((sum, row) => sum + row[key], 0);
  }
  // A returning network patient can be new to another office; do not double-count the network total.
  if (networkPatients) [groupTotal.current_new_patients, groupTotal.prev_new_patients] = networkPatients;
  groupTotal.production_growth_pct = calcGrowthPct(groupTotal.current_production, groupTotal.prev_production);
  groupTotal.collection_growth_pct = calcGrowthPct(groupTotal.current_collection, groupTotal.prev_collection);
  groupTotal.new_patients_growth_pct = calcGrowthPct(groupTotal.current_new_patients, groupTotal.prev_new_patients);
  return { rankedOffices: officeRows.sort((a, b) => (b.production_growth_pct ?? -Infinity) - (a.production_growth_pct ?? -Infinity)), groupTotal, prevMonth, prevYear, dataSource: 'ascend_api', history, sparklines };
};

export const fetchMonthlyGrowthHistory = async (officeFilter = 'all', months = 12, selectedMonth = new Date().getMonth() + 1, selectedYear = new Date().getFullYear(), context = makeContext(), scopedOffices = null) => {
  const offices = scopedOffices || (await fetchAllOffices()).filter((office) => officeFilter === 'all' || office.id === officeFilter);
  return Promise.all(monthList(selectedYear, selectedMonth, months).map(async (date) => {
    const rows = Object.values(await aggregateMonth(offices, date.getFullYear(), date.getMonth() + 1, context, false));
    return { month: shortMonth(date, true), production: rows.reduce((sum, row) => sum + row.production, 0), collection: rows.reduce((sum, row) => sum + row.collection, 0), source: 'ascend_api' };
  }));
};

export const fetchSparklineData = async (officeFilter = 'all', selectedMonth = new Date().getMonth() + 1, selectedYear = new Date().getFullYear(), context = makeContext(), scopedOffices = null) => {
  const offices = scopedOffices || (await fetchAllOffices()).filter((office) => officeFilter === 'all' || office.id === officeFilter);
  const rows = await Promise.all(offices.map(async (office) => [office.id, {
    name: office.name,
    points: await Promise.all(monthList(selectedYear, selectedMonth, 6).map(async (date) => ({ month: shortMonth(date), production: await readMetric(context, office.id, date.getFullYear(), date.getMonth() + 1, 'production'), source: 'ascend_api' }))),
  }]));
  return Object.fromEntries(rows);
};
