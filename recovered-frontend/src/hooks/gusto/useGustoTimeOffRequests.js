import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoTimeOffRequests(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        ?.from('gusto_time_off_requests')
        ?.select('*')
        ?.order('request_date', { ascending: false });

      if (filters?.year) {
        query = query
          ?.gte('request_date', `${filters?.year}-01-01`)
          ?.lte('request_date', `${filters?.year}-12-31`);
      }
      if (filters?.employeeId && filters?.employeeId !== 'all') {
        query = query?.eq('employee_id', filters?.employeeId);
      }
      if (filters?.timeOffType && filters?.timeOffType !== 'all') {
        query = query?.eq('time_off_type', filters?.timeOffType);
      }
      if (filters?.status && filters?.status !== 'all') {
        query = query?.eq('status', filters?.status);
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
    filters?.year,
    filters?.employeeId,
    filters?.timeOffType,
    filters?.status,
  ]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
