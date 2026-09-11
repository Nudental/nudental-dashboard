import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoTimeEntries(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        ?.from('gusto_time_entries')
        ?.select('*')
        ?.order('clockin_time', { ascending: false });

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

      const { data: rows, error: err } = await query;
      if (err) throw err;
      setData(rows || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [
    filters?.employeeId,
    filters?.officeName,
    filters?.status,
    filters?.payPeriodStart,
    filters?.payPeriodEnd,
  ]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
