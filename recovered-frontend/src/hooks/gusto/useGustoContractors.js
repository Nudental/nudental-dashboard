import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://api.nudashboard.com/v2/payroll';
const API_KEY = 'nudashboard_prod_key';
const PAGE_SIZE = 50;

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params)?.forEach(([k, v]) => {
    if (v !== undefined && v !== null) url?.searchParams?.set(k, String(v));
  });
  const res = await fetch(url?.toString(), { headers: { 'X-API-Key': API_KEY } });
  if (!res?.ok) {
    const body = await res?.text()?.catch(() => '');
    const err = new Error(`API ${res.status} on ${path}: ${body?.substring(0, 200)}`);
    err.status = res?.status;
    throw err;
  }
  return res?.json();
}

export function useGustoContractors(filters = {}) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort: 'check_date:desc',
      };

      if (filters?.year && filters?.year !== 'all') {
        params.startDate = `${filters?.year}-01-01`;
        params.endDate = `${filters?.year}-12-31`;
      }
      if (filters?.search) params.search = filters?.search;
      if (filters?.wageType && filters?.wageType !== 'all') params.wage_type = filters?.wageType;
      if (filters?.status === 'funded') params.funded = true;
      if (filters?.status === 'cancelled') params.cancelled = true;

      console.log('[useGustoContractors] Fetching contractors', { page, filters });

      const json = await apiFetch('/contractors', params);
      const rows = json?.data || [];
      const total = json?.total || 0;

      // Empty data is a valid state — not a failure
      if (rows?.length === 0) {
        console.log('[useGustoContractors] No contractor data for filters:', filters);
      }

      setData(rows);
      setCount(total);
    } catch (err) {
      // 404 means the endpoint is not yet available — treat as empty, not an error
      if (err?.status === 404) {
        console.warn('[useGustoContractors] /contractors endpoint not available (404). Showing empty state.');
        setData([]);
        setCount(0);
        setError(null);
      } else {
        console.error('[useGustoContractors] Fetch failed:', {
          error: err?.message,
          page,
          filters,
        });
        setError(err?.message);
      }
    } finally {
      setLoading(false);
    }
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, count, loading, error, page, setPage, pageSize: PAGE_SIZE, refetch: fetchData };
}
