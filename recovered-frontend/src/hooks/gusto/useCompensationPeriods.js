import { useState, useEffect, useRef, useCallback } from 'react';
import { getPayrollScheduleForYear } from '../../services/payrollService';
import { fetchCompensationPeriods, selectCompensationPeriod } from '../../services/providerCompensationPeriods';

export function useCompensationPeriods(year) {
  const [state, setState] = useState({ year, periods: [], selectedId: '', loading: true, error: null });
  const [revision, setRevision] = useState(0);
  const explicitSelection = useRef(null);
  const generation = useRef(0);
  const selectPeriod = useCallback(id => {
    explicitSelection.current = { year, id };
    setState(previous => ({ ...previous, selectedId: id }));
  }, [year]);
  const refresh = useCallback(() => {
    generation.current += 1;
    setState(previous => ({ ...previous, loading: true, error: null }));
    setRevision(previous => previous + 1);
  }, []);

  useEffect(() => {
    const request = ++generation.current;
    const controller = new AbortController();
    setState(previous => ({ year, periods: previous.year === year ? previous.periods : [],
      selectedId: previous.year === year ? previous.selectedId : '', loading: true, error: null }));
    fetchCompensationPeriods(year, getPayrollScheduleForYear(year), { signal: controller.signal })
      .then(periods => {
        if (request !== generation.current) return;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const explicitId = explicitSelection.current?.year === year ? explicitSelection.current.id : null;
        setState({ year, periods, selectedId: selectCompensationPeriod(periods, explicitId, today), loading: false, error: null });
      })
      .catch(error => {
        if (request === generation.current) setState({ year, periods: [], selectedId: '', loading: false, error: error.message });
      });
    return () => { generation.current += 1; controller.abort(); };
  }, [year, revision]);

  const current = state.year === year ? state : { periods: [], selectedId: '', loading: true, error: null };
  return { periods: current.periods, selectedId: current.selectedId, loading: current.loading,
    error: current.error, selectPeriod, refresh, revision };
}
