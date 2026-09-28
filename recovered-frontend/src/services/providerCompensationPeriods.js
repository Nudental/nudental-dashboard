import { dashboardFetch } from '../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';

const dateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export function buildCompensationPeriods(calendar, year) {
  if (calendar?.complete !== true || calendar.year !== Number(year) || !calendar.calendar_version ||
      !Array.isArray(calendar.periods) || calendar.periods.length < 26 || calendar.periods.length > 27) {
    throw new Error('The complete compensation calendar is unavailable. Refresh to retry.');
  }
  const ids = new Set();
  for (const p of calendar.periods) {
    if (p?.source !== 'ascend_compensation_calendar' || p.id !== `compensation-${p.payday}` ||
        p.compensation_period_id !== p.id || ids.has(p.id) ||
        !dateOnly(p.payday) || !dateOnly(p.pay_period_start) || !dateOnly(p.pay_period_end) ||
        !dateOnly(p.ascend_start) || !dateOnly(p.ascend_end) ||
        Number(p.payday.slice(0, 4)) !== Number(year) ||
        p.pay_period_start > p.pay_period_end || p.pay_period_end > p.payday) {
      throw new Error('The compensation calendar returned an invalid period. Refresh to retry.');
    }
    ids.add(p.id);
  }
  return [...calendar.periods].sort((a, b) => b.payday.localeCompare(a.payday));
}

export function selectCompensationPeriod(periods, explicitId, today) {
  if (explicitId && periods.some(p => p.id === explicitId)) return explicitId;
  const upcoming = periods.filter(p => p.pay_period_end <= today && p.payday > today)
    .sort((a, b) => a.payday.localeCompare(b.payday));
  return upcoming[0]?.id || periods.find(p => p.payday <= today)?.id || '';
}

export async function fetchCompensationPeriods(year, { signal, readCalendar } = {}) {
  const read = readCalendar || (async () => {
    const url = new URL(`${DASHBOARD_API_ORIGIN}/v2/reports/provider-compensation`);
    Object.entries({ startDate: `${year}-01-01`, endDate: `${year}-12-31`,
      format: 'ledger-calendar', userEmail: 'verified-current-account' })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await dashboardFetch(url.toString(), { signal,
      headers: { 'X-API-Key': import.meta.env?.VITE_ASCEND_API_KEY || '' } });
    if (!response.ok) throw new Error(`Compensation calendar could not be loaded (${response.status}). Check your Payroll access or retry.`);
    return response.json();
  });
  return buildCompensationPeriods(await read(), year);
}
