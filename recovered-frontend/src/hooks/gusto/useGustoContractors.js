import { supabase } from '../../lib/supabase';
import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'https://api.nudashboard.com/v2/payroll';
const API_KEY = 'nudashboard_prod_key';
const PAGE_SIZE = 50;

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params)?.forEach(([k, v]) => {
    if (v !== undefined && v !== null) url?.searchParams?.set(k, String(v));
  });
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in to view contractor data.');
  const res = await fetch(url?.toString(), { headers: { Authorization: `Bearer ${session.access_token}`, 'X-API-Key': API_KEY } });
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
  const [summary, setSummary] = useState(null);
  const generation = useRef(0);

  const fetchData = useCallback(async () => {
    const current = ++generation.current;
    setData([]);
    setCount(0);
    setSummary(null);
    setLoading(true);
    setError(null);
    try {
      const params = { summaryOnly: false, offset: page * PAGE_SIZE, limit: PAGE_SIZE, sort: 'check_date:desc' };
      if (filters?.year && filters.year !== 'all') {
        params.startDate = `${filters.year}-01-01`;
        params.endDate = `${filters.year}-12-31`;
      }
      if (filters?.search) params.search = filters.search;
      if (filters?.wageType && filters.wageType !== 'all') params.wage_type = filters.wageType;
      if (filters?.status === 'funded') params.funded = true;
      if (filters?.status === 'cancelled') params.cancelled = true;
      const json = await apiFetch('/contractors', params);
      if (!Number.isFinite(json?.summary?.paidAmount) || !Number.isInteger(json?.total)) {
        throw new Error('Contractor totals are unavailable. Please retry.');
      }
      if (current !== generation.current) return;
      setData(json.data || []);
      setCount(json.total);
      setSummary(json.summary);
    } catch (err) {
      if (current === generation.current) setError(err?.message || 'Contractor data is unavailable.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetchData(); return () => { generation.current++; }; }, [fetchData]);

  return { data, count, summary, loading, error, page, setPage, pageSize: PAGE_SIZE, refetch: fetchData };
}
