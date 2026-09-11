import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoTimeEntries(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const fetch = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        ?.from('gusto_time_entries')
        ?.select('*', { count: 'exact' })
        ?.order('clockin_time', { ascending: false })
        ?.order('id', { ascending: false });

      if (filters?.employeeId && filters?.employeeId !== 'all') {
        query = query?.eq('employee_id', filters?.employeeId);
      }
      if (filters?.officeName && filters?.officeName !== 'all') {
        query = query?.eq('office_name', filters?.officeName);
      }
      if (filters?.status && filters?.status !== 'all') {
        query = query?.eq('status', filters?.status);
      }
      if (filters?.payPeriodStart) {
        query = query?.gte('pay_period_start', filters?.payPeriodStart);
      }
      if (filters?.payPeriodEnd) {
        query = query?.lte('pay_period_end', filters?.payPeriodEnd);
      }

      const rows = [];
      let expectedCount = null;
      while (true) {
        const { data: page, error: err, count } = await query.range(rows.length, rows.length + 999);
        if (request !== requestId.current) return;
        if (err) throw err;
        if (!Number.isSafeInteger(count) || (expectedCount !== null && count !== expectedCount)) {
          throw new Error('Time entries changed or the result is incomplete. Please refresh.');
        }
        expectedCount = count;
        rows.push(...(page || []));
        if (rows.length > count || new Set(rows.map(row => row.id)).size !== rows.length) {
          throw new Error('Time entries changed or the result is incomplete. Please refresh.');
        }
        if (rows.length === count) break;
        if (!page?.length) throw new Error('Time entries result is incomplete. Please refresh.');
      }
      setData(rows);
    } catch (err) {
      if (request !== requestId.current) return;
      setData([]);
      setError(err?.message);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [
    filters?.employeeId,
    filters?.officeName,
    filters?.status,
    filters?.payPeriodStart,
    filters?.payPeriodEnd,
  ]);

  useEffect(() => { fetch(); return () => { requestId.current++; }; }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
