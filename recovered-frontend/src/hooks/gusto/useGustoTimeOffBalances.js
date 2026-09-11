import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoTimeOffBalances(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        ?.from('gusto_time_off_balances')
        ?.select('*')
        ?.order('employee_name', { ascending: true });

      if (filters?.employeeId && filters?.employeeId !== 'all') {
        query = query?.eq('employee_id', filters?.employeeId);
      }
      if (filters?.timeOffType && filters?.timeOffType !== 'all') {
        query = query?.eq('time_off_type', filters?.timeOffType);
      }
      if (filters?.snapshotDate) {
        query = query?.eq('snapshot_date', filters?.snapshotDate);
      }

      const { data: rows, error: err } = await query;
      if (err) throw err;
      setData(rows || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [filters?.employeeId, filters?.timeOffType, filters?.snapshotDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
