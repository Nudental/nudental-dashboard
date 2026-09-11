import React, { useState } from 'react';
import { useGustoContractors } from '../../../../hooks/gusto/useGustoContractors';
import { fmtCurrency, fmtDate, fmtDateCSV, downloadCSV, getGustoYears } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

const YEARS = ['all', ...getGustoYears()?.map(String)];

function Badge({ badge, className }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{badge}</span>;
}

export default function GustoContractors({ isSuperAdmin }) {
  const [selectedYear, setSelectedYear] = useState(String(new Date()?.getFullYear()));
  const [filters, setFilters] = useState({ search: '', wageType: 'all', status: 'all' });
  const { data, count, loading, error, page, setPage, pageSize } = useGustoContractors({ year: selectedYear, ...filters });

  // Summary stats
  const totalPaid = data?.reduce((s, p) => s + (parseFloat(p?.total_amount) || 0), 0);
  const uniqueContractors = new Set(data?.map(p => p?.contractor_id).filter(Boolean))?.size;

  // Contractor summary cards
  const contractorMap = {};
  data?.forEach(p => {
    const key = p?.contractor_id || p?.contractor_name;
    if (!contractorMap?.[key]) {
      contractorMap[key] = { name: p?.contractor_display_name || p?.contractor_name, total: 0, lastDate: p?.check_date, wageType: p?.wage_type };
    }
    contractorMap[key].total += parseFloat(p?.total_amount) || 0;
    if (p?.check_date > contractorMap?.[key]?.lastDate) contractorMap[key].lastDate = p?.check_date;
  });
  const contractorCards = Object.values(contractorMap)?.slice(0, 6);

  const handleExport = () => {
    const headers = ['ID','Contractor','Check Date','Wage Type','Hours','Rate','Wage','Bonus','Reimbursement','Total','Method','Funded','Cancelled','Memo'];
    const rows = data?.map(p => [
      p?.id, p?.contractor_display_name || p?.contractor_name, fmtDateCSV(p?.check_date),
      p?.wage_type, p?.hours_worked, p?.hourly_rate, p?.wage, p?.bonus, p?.reimbursement, p?.total_amount,
      p?.payment_method, String(p?.funded ?? ''), String(p?.cancelled ?? ''), p?.memo,
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_contractors_${today}.csv`, [headers, ...rows]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Contractors</h2>
        <button onClick={handleExport} disabled={!data?.length}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] disabled:opacity-50 transition-colors">
          ↓ Export Contractor Payments CSV
        </button>
      </div>
      {/* Year tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200">
        {YEARS?.map(y => (
          <button key={y} onClick={() => { setSelectedYear(y); setPage(0); }}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all ${
              selectedYear === y ? 'border-[#00B5CC] text-[#00B5CC]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {y === 'all' ? 'All' : y}
          </button>
        ))}
      </div>
      {/* Summary bar */}
      {!loading && data?.length > 0 && (
        <div className="flex flex-wrap gap-4 bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-3 text-sm">
          <span>{count} payments</span>
          <span className="text-gray-400">|</span>
          <span>Total Paid: <strong className="text-[#00B5CC]">{fmtCurrency(totalPaid)}</strong></span>
          <span className="text-gray-400">|</span>
          <span>{uniqueContractors} unique contractors</span>
        </div>
      )}
      {/* Contractor summary cards */}
      {contractorCards?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {contractorCards?.map((c, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="font-semibold text-gray-800 text-sm truncate">{c?.name}</div>
              <div className="text-[#00B5CC] font-bold text-lg mt-1">{fmtCurrency(c?.total)}</div>
              <div className="text-xs text-gray-400 mt-1">Last: {fmtDate(c?.lastDate)}</div>
              {c?.wageType && <Badge badge={c?.wageType} className="mt-2 bg-gray-100 text-gray-600" />}
            </div>
          ))}
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search Contractor</label>
          <input type="text" placeholder="Name…" value={filters?.search}
            onChange={e => setFilters(f => ({ ...f, search: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]" />
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Wage Type</label>
          <select value={filters?.wageType} onChange={e => setFilters(f => ({ ...f, wageType: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
            <option value="all">All</option>
            <option value="hourly">Hourly</option>
            <option value="salary">Salary</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
          <select value={filters?.status} onChange={e => setFilters(f => ({ ...f, status: e?.target?.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
            <option value="all">All</option>
            <option value="funded">Funded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>}
      {!loading && !data?.length && !error ? (
        <GustoEmptyState message="Gusto contractors endpoint not connected yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Contractor','Check Date','Wage Type','Hours','Rate','Wage','Bonus','Reimb.','Total','Method','Funded','Cancelled','Memo']?.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map((p, i) => (
                <tr key={p?.id || i} className="hover:bg-[#F0FAFB] transition-colors"
                  style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8F9FA' }}>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p?.contractor_display_name || p?.contractor_name}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p?.check_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge badge={p?.wage_type || '—'} className={p?.wage_type === 'hourly' ? 'bg-[#DBEAFE] text-[#1E40AF]' : 'bg-gray-100 text-gray-600'} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p?.hours_worked ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{p?.hourly_rate ? fmtCurrency(p?.hourly_rate) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-800">{fmtCurrency(p?.wage)}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{p?.bonus ? fmtCurrency(p?.bonus) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{p?.reimbursement ? fmtCurrency(p?.reimbursement) : '—'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-[#00B5CC] whitespace-nowrap">{fmtCurrency(p?.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{p?.payment_method || '—'}</td>
                  <td className="px-4 py-3">{p?.funded && <Badge badge="Funded" className="bg-[#DCFCE7] text-[#166534]" />}</td>
                  <td className="px-4 py-3">{p?.cancelled && <Badge badge="Cancelled" className="bg-[#FEE2E2] text-[#991B1B]" />}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate" title={p?.memo}>{p?.memo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
