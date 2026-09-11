import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function useGustoBenefits() {
  const [plans, setPlans] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log('[useGustoBenefits] Fetching benefit plans and enrollments');

    // Use allSettled so one failed query does not crash the hook
    Promise.allSettled([
      supabase?.from('gusto_benefit_plans')?.select('*')?.order('plan_name'),
      supabase?.from('gusto_employee_benefit_enrollments')?.select('*, gusto_employees(first_name, last_name), gusto_benefit_plans(plan_name, benefit_category)'),
    ])
      ?.then(([plansResult, enrollResult]) => {
        if (cancelled) return;

        if (plansResult?.status === 'rejected') {
          console.warn('[useGustoBenefits] gusto_benefit_plans query failed (non-fatal):', plansResult?.reason?.message);
        } else if (plansResult?.value?.error) {
          console.warn('[useGustoBenefits] gusto_benefit_plans error (non-fatal):', plansResult?.value?.error?.message);
        } else {
          setPlans(plansResult?.value?.data || []);
        }

        if (enrollResult?.status === 'rejected') {
          console.warn('[useGustoBenefits] gusto_employee_benefit_enrollments query failed (non-fatal):', enrollResult?.reason?.message);
        } else if (enrollResult?.value?.error) {
          console.warn('[useGustoBenefits] gusto_employee_benefit_enrollments error (non-fatal):', enrollResult?.value?.error?.message);
        } else {
          setEnrollments(enrollResult?.value?.data || []);
        }

        // Only set error if BOTH queries failed
        const bothFailed =
          (plansResult?.status === 'rejected' || plansResult?.value?.error) &&
          (enrollResult?.status === 'rejected' || enrollResult?.value?.error);

        if (bothFailed) {
          const msg = plansResult?.reason?.message || plansResult?.value?.error?.message || 'Benefits data unavailable';
          console.error('[useGustoBenefits] Both queries failed:', msg);
          setError(msg);
        }
      })
      ?.catch(err => {
        if (cancelled) return;
        console.error('[useGustoBenefits] Unexpected error:', err?.message);
        setError(err?.message);
      })
      ?.finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { plans, enrollments, loading, error };
}
