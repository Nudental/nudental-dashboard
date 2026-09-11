import React, { useState } from 'react';
import { useGustoBenefits } from '../../../../hooks/gusto/useGustoBenefits';
import { fmtCurrency, downloadCSV } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

function Badge({ children, className, badge }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children || badge}</span>;
}

function getCategoryBadge(category) {
  const map = {
    health: 'bg-blue-100 text-blue-700',
    dental: 'bg-cyan-100 text-cyan-700',
    vision: 'bg-purple-100 text-purple-700',
    '401k': 'bg-emerald-100 text-emerald-700',
  };
  const key = (category || '')?.toLowerCase();
  return map?.[key] || 'bg-gray-100 text-gray-600';
}

export default function GustoBenefits({ isSuperAdmin }) {
  const { plans, enrollments, loading, error } = useGustoBenefits();
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterActive, setFilterActive] = useState('all');

  const handleExport = () => {
    const headers = ['Employee','Plan','Employee/Paycheck','Company/Paycheck','Annual Employee','Annual Company','Active'];
    const rows = enrollments?.map(e => [
      `${e?.gusto_employees?.first_name || ''} ${e?.gusto_employees?.last_name || ''}`?.trim(),
      e?.gusto_benefit_plans?.plan_name || e?.benefit_plan_id,
      e?.employee_deduction, e?.company_contribution,
      (parseFloat(e?.employee_deduction || 0) * 26)?.toFixed(2),
      (parseFloat(e?.company_contribution || 0) * 26)?.toFixed(2),
      String(e?.active ?? ''),
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_benefits_${today}.csv`, [headers, ...rows]);
  };

  const filteredEnrollments = enrollments?.filter(e => {
    if (filterPlan !== 'all' && e?.benefit_plan_id !== filterPlan) return false;
    if (filterActive === 'active' && !e?.active) return false;
    if (filterActive === 'inactive' && e?.active) return false;
    return true;
  });

  // Compute per-plan stats
  const planStats = {};
  enrollments?.forEach(e => {
    const pid = e?.benefit_plan_id;
    if (!planStats?.[pid]) planStats[pid] = { enrolled: 0, empDeduction: 0, compContrib: 0 };
    if (e?.active) {
      planStats[pid].enrolled++;
      planStats[pid].empDeduction += parseFloat(e?.employee_deduction || 0);
      planStats[pid].compContrib += parseFloat(e?.company_contribution || 0);
    }
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3]?.map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!plans?.length && !loading) {
    return <GustoEmptyState message="No benefit plans imported yet." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Benefits</h2>
        <button onClick={handleExport} disabled={!enrollments?.length}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] disabled:opacity-50 transition-colors">
          ↓ Export Benefits CSV
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>}
      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans?.map(plan => {
          const stats = planStats?.[plan?.id] || { enrolled: 0, empDeduction: 0, compContrib: 0 };
          const monthlyCompCost = stats?.compContrib * 2; // bi-weekly × 2 ≈ monthly
          return (
            <div key={plan?.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-gray-900 text-sm">{plan?.plan_name}</div>
                <div className="flex flex-wrap gap-1">
                  {plan?.benefit_category && (
                    <Badge className={getCategoryBadge(plan?.benefit_category)} badge={plan?.benefit_category}>{plan?.benefit_category}</Badge>
                  )}
                  {plan?.active ? (
                    <Badge className="bg-[#DCFCE7] text-[#166534]" badge="Active">Active</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500" badge="Inactive">Inactive</Badge>
                  )}
                </div>
              </div>
              {plan?.carrier_name && <div className="text-xs text-gray-500">Carrier: {plan?.carrier_name}</div>}
              {plan?.renewal_month && <div className="text-xs text-gray-400">Renewal: Month {plan?.renewal_month}</div>}
              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div><span className="text-gray-400">Enrolled:</span> <strong>{stats?.enrolled}</strong></div>
                <div><span className="text-gray-400">Avg Emp/check:</span> <strong>{fmtCurrency(stats?.enrolled ? stats?.empDeduction / stats?.enrolled : 0)}</strong></div>
                <div><span className="text-gray-400">Avg Co/check:</span> <strong>{fmtCurrency(stats?.enrolled ? stats?.compContrib / stats?.enrolled : 0)}</strong></div>
                <div><span className="text-gray-400">Est. Mo. Cost:</span> <strong className="text-[#00B5CC]">{fmtCurrency(monthlyCompCost)}</strong></div>
                <div className="col-span-2"><span className="text-gray-400">Est. Annual Cost:</span> <strong className="text-[#00B5CC]">{fmtCurrency(monthlyCompCost * 12)}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Enrollment Table */}
      {enrollments?.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</label>
              <select value={filterPlan} onChange={e => setFilterPlan(e?.target?.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
                <option value="all">All Plans</option>
                {plans?.map(p => <option key={p?.id} value={p?.id}>{p?.plan_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
              <select value={filterActive} onChange={e => setFilterActive(e?.target?.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Employee','Plan','Emp / Paycheck','Co / Paycheck','Annual Emp','Annual Co','Active']?.map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEnrollments?.map((e, i) => (
                  <tr key={e?.id || i} className="hover:bg-[#F0FAFB]" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8F9FA' }}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {e?.gusto_employees?.first_name} {e?.gusto_employees?.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e?.gusto_benefit_plans?.plan_name || e?.benefit_plan_id}</td>
                    <td className="px-4 py-3 font-mono text-gray-800">{fmtCurrency(e?.employee_deduction)}</td>
                    <td className="px-4 py-3 font-mono text-gray-800">{fmtCurrency(e?.company_contribution)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{fmtCurrency((parseFloat(e?.employee_deduction || 0) * 26))}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{fmtCurrency((parseFloat(e?.company_contribution || 0) * 26))}</td>
                    <td className="px-4 py-3">
                      <Badge className={e?.active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-gray-100 text-gray-500'} badge={e?.active ? 'Active' : 'Inactive'}>
                        {e?.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                  <td className="px-4 py-3 text-gray-900" colSpan={2}>Totals</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{fmtCurrency(filteredEnrollments?.reduce((s, e) => s + (parseFloat(e?.employee_deduction) || 0), 0))}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{fmtCurrency(filteredEnrollments?.reduce((s, e) => s + (parseFloat(e?.company_contribution) || 0), 0))}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{fmtCurrency(filteredEnrollments?.reduce((s, e) => s + (parseFloat(e?.employee_deduction || 0) * 26), 0))}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{fmtCurrency(filteredEnrollments?.reduce((s, e) => s + (parseFloat(e?.company_contribution || 0) * 26), 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
