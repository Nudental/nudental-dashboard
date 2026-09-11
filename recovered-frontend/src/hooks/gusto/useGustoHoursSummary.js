import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoHoursSummary(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        ?.from('gusto_hours_summary')
        ?.select('*')
        ?.order('employee_name', { ascending: true });

      if (filters?.year) {
        query = query?.eq('year', filters?.year);
      }
      if (filters?.employeeId && filters?.employeeId !== 'all') {
        query = query?.eq('employee_id', filters?.employeeId);
      }

      const { data: rows, error: err } = await query;
      if (err) throw err;
      setData(rows || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [filters?.year, filters?.employeeId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
