import { dashboardFetch } from '../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';

const PAGE_SIZE = 50;
const dateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};
const periodKey = p => `${p.payday}|${p.pay_period_start}|${p.pay_period_end}`;

export function isEligibleCompensationRun(run) {
  return Boolean(run?.id && run.off_cycle === false && run.processed === true &&
    run.reversed !== true && run.needs_reprocessing !== true &&
    !run.off_cycle_reason && dateOnly(run.check_date) &&
    dateOnly(run.pay_period_start) && dateOnly(run.pay_period_end) &&
    run.pay_period_start <= run.pay_period_end && run.pay_period_end <= run.check_date);
}

// Only run identity/date/status metadata enters compensation. Gusto amounts are
// intentionally not copied: collections and tier inputs still come from Ascend.
export function buildCompensationPeriods(runs, historicalPeriods, year) {
  const importedKeys = new Set(runs.map(r => periodKey({ ...r, payday: r.check_date })));
  const periods = runs.filter(isEligibleCompensationRun).map(run => ({
    id: `gusto-${run.id}`, gusto_run_id: run.id, source: 'imported_gusto',
    payroll_type: 'regular', is_regular: true, processed: true,
    pay_period_start: run.pay_period_start, pay_period_end: run.pay_period_end,
    payday: run.check_date, year: Number(run.check_date.slice(0, 4)),
    payroll_name: `Pay Period ${run.pay_period_start} – ${run.pay_period_end}`,
  }));
  // Retain dated legacy periods absent from imports, explicitly labeled as such.
  // An imported reversed/off-cycle/unprocessed run must never reappear via fallback.
  for (const p of historicalPeriods) {
    if (p.is_regular && dateOnly(p.payday) && dateOnly(p.pay_period_start) &&
        dateOnly(p.pay_period_end) && !importedKeys.has(periodKey(p))) {
      periods.push({ ...p, source: 'historical_schedule', processed: false });
    }
  }
  return periods.filter(p => Number(p.payday.slice(0, 4)) === Number(year))
    .sort((a, b) => b.payday.localeCompare(a.payday) || b.pay_period_end.localeCompare(a.pay_period_end) || a.id.localeCompare(b.id));
}

export function selectCompensationPeriod(periods, explicitId, today) {
  if (explicitId && periods.some(p => p.id === explicitId)) return explicitId;
  const applicable = periods.filter(p => p.payday <= today);
  return (applicable.find(p => p.processed) || applicable[0])?.id || '';
}

export async function fetchCompensationPeriods(year, historicalPeriods, { signal, fetchPage } = {}) {
  const readPage = fetchPage || (async params => {
    const url = new URL(`${DASHBOARD_API_ORIGIN}/v2/payroll/runs`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await dashboardFetch(url.toString(), {
      signal, headers: { 'X-API-Key': import.meta.env?.VITE_ASCEND_API_KEY || '' },
    });
    if (!response.ok) throw new Error(`Imported payroll periods could not be loaded (${response.status}). Check your Payroll access or retry.`);
    return response.json();
  });
  const runs = [], ids = new Set();
  let total;
  for (let offset = 0; offset < 10000;) {
    const page = await readPage({ startDate: `${year}-01-01`, endDate: `${year}-12-31`,
      sort: 'check_date:desc', limit: PAGE_SIZE, offset });
    if (!Array.isArray(page?.data) || !Number.isInteger(page.total) || page.total < 0 ||
        page.offset !== offset || (total !== undefined && total !== page.total)) {
      throw new Error('Imported payroll periods changed or returned an incomplete page. Refresh to retry.');
    }
    total = page.total;
    for (const run of page.data) {
      if (!run.id || ids.has(run.id)) throw new Error('Imported payroll pagination is incomplete. Refresh to retry.');
      ids.add(run.id); runs.push(run);
    }
    offset += page.data.length;
    if (offset === total) return buildCompensationPeriods(runs, historicalPeriods, year);
    if (offset > total || page.data.length === 0) break;
  }
  throw new Error('The complete imported payroll period list is unavailable. Refresh to retry.');
}
