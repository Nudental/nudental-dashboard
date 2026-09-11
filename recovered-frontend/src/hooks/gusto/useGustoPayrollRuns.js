import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'https://api.nudashboard.com/v2/payroll';
const API_KEY = 'nudashboard_prod_key';

const PAGE_SIZE = 50;

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params)?.forEach(([k, v]) => { if (v !== undefined && v !== null) url?.searchParams?.set(k, v); });
  const res = await fetch(url?.toString(), { headers: { 'X-API-Key': API_KEY } });
  if (!res?.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res?.json();
}

export function useGustoPayrollRuns(filters = {}) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const requestGeneration = useRef(0);

  const fetch = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    setData([]);
    setCount(0);
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
      if (filters?.type === 'regular') params.off_cycle = false;
      if (filters?.type === 'off_cycle') params.off_cycle = true;
      if (filters?.status) params.status = filters?.status;
      if (filters?.runBy && filters?.runBy !== 'all') params.run_by_user_name = filters?.runBy;

      const json = await apiFetch('/runs', params);
      if (generation !== requestGeneration.current) return;
      setData(json?.data || []);
      setCount(json?.total || 0);
    } catch (err) {
      if (generation === requestGeneration.current) setError(err?.message);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetch(); return () => { requestGeneration.current += 1; }; }, [fetch]);

  return { data, count, loading, error, page, setPage, pageSize: PAGE_SIZE, refetch: fetch };
}

export function useGustoPayrollRunSummary(year) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummary(null);
    const params = { limit: 1000 };
    if (year && year !== 'all') {
      params.startDate = `${year}-01-01`;
      params.endDate = `${year}-12-31`;
    }
    apiFetch('/runs', params)?.then(json => {
        if (cancelled) return;
        const runs = json?.data || [];
        setSummary({
          runCount: runs?.length,
          offCycleCount: runs?.filter(r => r?.off_cycle)?.length,
          totalNetPay: runs?.reduce((s, r) => s + (parseFloat(r?.total_net_pay) || 0), 0),
          totalTaxes: runs?.reduce((s, r) => s + (parseFloat(r?.total_payable_tax) || 0), 0),
          totalGross: runs?.reduce((s, r) => s + (parseFloat(r?.total_debit_amount) || 0), 0),
        });
      })?.catch(() => { if (!cancelled) setSummary(null); })?.finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  return { summary, loading };
}
