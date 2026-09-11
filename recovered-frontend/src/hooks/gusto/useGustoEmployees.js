import { useState, useEffect, useCallback } from 'react';

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

export function useGustoEmployees(filters = {}) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort: 'last_name:asc',
      };
      if (filters?.status && filters?.status !== 'all') params.status = filters?.status;
      if (filters?.workState && filters?.workState !== 'all') params.work_state = filters?.workState;
      if (filters?.employmentType && filters?.employmentType !== 'all') params.employment_type = filters?.employmentType;
      if (filters?.benefitsEnrolled === 'enrolled') params.benefits_enrolled = true;
      if (filters?.benefitsEnrolled === 'not_enrolled') { params.benefits_enrolled = false; params.benefits_eligible = true; }
      if (filters?.benefitsEnrolled === 'not_eligible') params.benefits_eligible = false;
      if (filters?.search) params.search = filters?.search;

      const json = await apiFetch('/employees', params);
      setData(json?.data || []);
      setCount(json?.total || 0);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [page, JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, count, loading, error, page, setPage, pageSize: PAGE_SIZE, refetch: fetch };
}

export function useGustoEmployeeDetail(employeeId) {
  const [employee, setEmployee] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [crosswalk, setCrosswalk] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    Promise.all([
      // Employee detail from middleware
      apiFetch('/employees', { id: employeeId, limit: 1 }),
      // Crosswalk from middleware
      apiFetch('/crosswalk', { gusto_employee_id: employeeId, limit: 1 }),
    ])?.then(([empJson, crossJson]) => {
        const empRows = empJson?.data || [];
        setEmployee(empRows?.[0] || null);
        // enrollments not exposed via middleware — keep empty, populated by benefits hook if needed
        setEnrollments([]);
        const crossRows = crossJson?.data || [];
        setCrosswalk(crossRows?.[0] || null);
      })?.catch(console.error)?.finally(() => setLoading(false));
  }, [employeeId]);

  return { employee, enrollments, crosswalk, loading };
}
