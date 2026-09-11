import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'https://api.nudashboard.com/v2/payroll';
const API_KEY = 'nudashboard_prod_key';

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params)?.forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url?.searchParams?.set(k, v); });
  const res = await fetch(url?.toString(), { headers: { 'X-API-Key': API_KEY } });
  if (!res?.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res?.json();
}

/**
 * Phase 2B: Fetches /v2/payroll/comparison with all required filters.
 * Supported filters:
 *   startDate      — pay period start date (YYYY-MM-DD)
 *   endDate        — pay period end date (YYYY-MM-DD)
 *   providerType   — 'doctor' | 'hygienist' | 'all'
 *   providerId     — specific provider ID
 *   checkDate      — specific check date (YYYY-MM-DD)
 *   payrollRunId   — specific payroll run ID
 *
 * Source rules (Phase 2B):
 *   actualGrossPay  = from backend (Gusto Payroll Export XLSX)
 *   expectedPay     = from backend (Existing Provider Compensation result)
 *   varianceAmount  = from backend
 *   variancePercent = from backend
 *   Frontend does NOT recalculate Provider Compensation.
 */
export function getComparisonDateMessage(filters = {}) {
  const { startDate, endDate } = filters;
  if (!startDate || !endDate) return 'Select both a start date and an end date to load payroll comparison.';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate)) return 'Enter valid start and end dates.';
  if (startDate > endDate) return 'Start date must be on or before end date.';
  return '';
}

export function useGustoComparison(filters = {}) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const requestGeneration = useRef(0);
  const dateRangeMessage = getComparisonDateMessage(filters);

  const fetchData = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError(null);
    setData([]);
    setCount(0);
    if (dateRangeMessage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort: 'check_date:desc',
      };

      // Phase 2B required filters
      if (filters?.startDate) params.startDate = filters?.startDate;
      if (filters?.endDate) params.endDate = filters?.endDate;
      if (filters?.providerType && filters?.providerType !== 'all') params.providerType = filters?.providerType;
      if (filters?.providerId && filters?.providerId !== 'all') params.providerId = filters?.providerId;
      if (filters?.checkDate) params.checkDate = filters?.checkDate;
      if (filters?.payrollRunId && filters?.payrollRunId !== 'all') params.payrollRunId = filters?.payrollRunId;

      // Legacy filters kept for backward compat
      if (filters?.officeId && filters?.officeId !== 'all') params.office_id = filters?.officeId;

      const json = await apiFetch('/comparison', params);
      if (generation !== requestGeneration.current) return;
      setData(json?.data || []);
      setCount(json?.total || 0);
    } catch (err) {
      if (generation !== requestGeneration.current) return;
      setError(err?.message);
      setData([]);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [page, JSON.stringify(filters), dateRangeMessage]);

  useEffect(() => {
    fetchData();
    return () => { requestGeneration.current += 1; };
  }, [fetchData]);

  return { data: dateRangeMessage ? [] : data, count: dateRangeMessage ? 0 : count, loading: dateRangeMessage ? false : loading, error, dateRangeMessage, page, setPage, pageSize: PAGE_SIZE, refetch: fetchData };
}

export function useGustoCrosswalk() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch('/crosswalk', { limit: 1000, sort: 'created_at:desc' });
      setData(json?.data || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
