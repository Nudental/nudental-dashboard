import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const API_BASE = 'https://api.nudashboard.com/v2/payroll';
const API_KEY = 'nudashboard_prod_key';

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params)?.forEach(([k, v]) => {
    if (v !== undefined && v !== null) url?.searchParams?.set(k, String(v));
  });
  const session = path === '/contractors' ? (await supabase.auth.getSession()).data?.session : null;
  if (path === '/contractors' && !session?.access_token) throw new Error('Sign in to view contractor data.');
  const res = await fetch(url?.toString(), { headers: { ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), 'X-API-Key': API_KEY } });
  if (!res?.ok) {
    const body = await res?.text()?.catch(() => '');
    throw new Error(`API ${res.status} on ${path}: ${body?.substring(0, 200)}`);
  }
  return res?.json();
}

export function useGustoSummaryTotals(year) {
  const [kpis, setKpis] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [annualData, setAnnualData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const currentYear = year || new Date()?.getFullYear();
    const today = new Date()?.toISOString()?.split('T')?.[0];
    const isCurrentYear = currentYear === new Date().getFullYear();
    const periodEnd = year === 0 || isCurrentYear ? today : `${currentYear}-12-31`;
    const periodParams = year === 0 ? {} : { startDate: `${currentYear}-01-01`, endDate: periodEnd };
    const periodLabel = year === 0 ? 'All Time' : `${currentYear}${isCurrentYear ? ' YTD' : ''}`;
    const chartEnd = new Date(`${periodEnd}T12:00:00Z`);
    const last12Start = new Date(Date.UTC(chartEnd.getUTCFullYear(), chartEnd.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);

    console.log('[useGustoSummaryTotals] Fetching for year:', currentYear, { today, last12Start });

    // Use Promise.allSettled so one failed sub-query never crashes the whole hook
    Promise.allSettled([
      // [0] Active employees count from middleware
      apiFetch('/employees', { status: 'active', limit: 1 }),
      // [1] YTD payroll runs from middleware
      apiFetch('/runs', { ...periodParams, limit: 1000 }),
      // [2] YTD contractor spend — via middleware (replaces direct gusto_contractor_payments query)
      apiFetch('/contractors', { ...periodParams, summaryOnly: true }),
      // [3] Active benefit enrollments — via Supabase (gusto_employee_benefit_enrollments is not a blocked table)
      supabase?.from('gusto_employee_benefit_enrollments')?.select('company_contribution')?.eq('active', true),
      // [4] Next payroll from middleware
      apiFetch('/runs', { startDate: today, limit: 1, sort: 'check_date:asc' }),
      // [5] Last 12 months for monthly chart from middleware
      apiFetch('/runs', { startDate: last12Start, endDate: periodEnd, limit: 1000, sort: 'check_date:asc' }),
      // [6] Annual data for bar chart from middleware
      apiFetch('/runs', { startDate: '2021-01-01', limit: 5000, sort: 'check_date:asc' }),
      // Contractor chart uses actual funded, non-canceled payments across all years.
      apiFetch('/contractors', { summaryOnly: true }),
    ])
      ?.then(results => {
        if (cancelled) return;

        const [empResult, runsResult, contractorResult, benefitsResult, nextResult, monthlyResult, annualResult, contractorAnnualResult] = results;

        // Log any individual failures for diagnostics — do not throw
        results?.forEach((r, i) => {
          const labels = ['employees', 'ytd-runs', 'contractors', 'benefits-enrollments', 'next-run', 'monthly-runs', 'annual-runs', 'annual-contractors'];
          if (r?.status === 'rejected') {
            console.warn(`[useGustoSummaryTotals] Sub-query [${labels?.[i]}] failed (non-fatal):`, r?.reason?.message);
          }
        });

        // Extract data safely with fallbacks
        const empJson = empResult?.status === 'fulfilled' ? empResult?.value : null;
        const runsJson = runsResult?.status === 'fulfilled' ? runsResult?.value : null;
        const contractorJson = contractorResult?.status === 'fulfilled' ? contractorResult?.value : null;
        const benefitsRes = benefitsResult?.status === 'fulfilled' ? benefitsResult?.value : null;
        const nextJson = nextResult?.status === 'fulfilled' ? nextResult?.value : null;
        const monthlyJson = monthlyResult?.status === 'fulfilled' ? monthlyResult?.value : null;
        const annualJson = annualResult?.status === 'fulfilled' ? annualResult?.value : null;

        const runs = runsJson?.data || [];
        const contractorAnnual = contractorAnnualResult?.status === 'fulfilled' ? contractorAnnualResult.value?.summary?.annualPaid : null;
        const benefits = benefitsRes?.data || [];

        const totalNetPay = runs?.reduce((s, r) => s + (parseFloat(r?.total_net_pay) || 0), 0);
        const totalTaxes = runs?.reduce((s, r) => s + (parseFloat(r?.total_payable_tax) || 0), 0);
        const totalGross = runs?.reduce((s, r) => s + (parseFloat(r?.total_debit_amount) || 0), 0);
        const contractorSpend = Number.isFinite(contractorJson?.summary?.paidAmount) ? contractorJson.summary.paidAmount : null;
        const benefitsCostMonth = benefits?.reduce((s, b) => s + (parseFloat(b?.company_contribution) || 0), 0);

        setKpis({
          periodLabel,
          monthlyPeriodEnd: periodEnd,
          activeEmployees: empJson?.total || 0,
          totalNetPayYTD: totalNetPay,
          totalTaxesYTD: totalTaxes,
          totalGrossCostYTD: totalGross,
          payrollRunsYTD: runs?.length,
          offCycleCount: runs.filter(run => run?.off_cycle === true).length,
          contractorSpendYTD: contractorSpend,
          contractorAnnualData: Array.isArray(contractorAnnual) ? contractorAnnual : null,
          benefitsCostMonth,
          nextPayrollDate: nextJson?.data?.[0]?.check_date || null,
        });

        // Build monthly chart data (last 12 months)
        const monthMap = {};
        (monthlyJson?.data || [])?.forEach(r => {
          const month = r?.check_date?.substring(0, 7);
          if (!month) return;
          if (!monthMap?.[month]) monthMap[month] = { month, netPay: 0, taxes: 0 };
          monthMap[month].netPay += parseFloat(r?.total_net_pay) || 0;
          monthMap[month].taxes += parseFloat(r?.total_payable_tax) || 0;
        });
        setMonthlyData(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12));

        // Build annual chart data
        const yearMap = {};
        (annualJson?.data || [])?.forEach(r => {
          const yr = r?.check_date?.substring(0, 4);
          if (!yr) return;
          if (!yearMap?.[yr]) yearMap[yr] = { year: yr, netPay: 0, taxes: 0 };
          yearMap[yr].netPay += parseFloat(r?.total_net_pay) || 0;
          yearMap[yr].taxes += parseFloat(r?.total_payable_tax) || 0;
        });
        setAnnualData(Object.values(yearMap));

        console.log('[useGustoSummaryTotals] Loaded successfully', {
          year: currentYear,
          runs: runs?.length,
          contractors: contractorJson?.total ?? null,
          benefits: benefits?.length,
        });
      })
      ?.catch(err => {
        if (cancelled) return;
        console.error('[useGustoSummaryTotals] Fatal error:', err?.message);
        setError(err?.message);
      })
      ?.finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year]);

  return { kpis, monthlyData, annualData, loading, error };
}
