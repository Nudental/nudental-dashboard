import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoPaySchedules() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    supabase?.from('gusto_pay_schedules')?.select('*')?.order('schedule_name')?.then(({ data: rows, error: err }) => {
        if (err) throw err;
        setData(rows || []);
      })?.catch(err => setError(err?.message))?.finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
