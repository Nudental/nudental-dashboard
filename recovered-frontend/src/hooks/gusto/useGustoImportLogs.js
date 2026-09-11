import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoImportLogs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase?.from('gusto_import_logs')?.select('*')?.order('started_at', { ascending: false })?.limit(100);
      if (err) throw err;
      setData(rows || []);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
