import React, { useState } from 'react';
import GustoPayrollRunTable, { GustoPayrollRunModal } from './GustoPayrollRunTable';
import { useGustoPayrollRuns, useGustoPayrollRunSummary } from '../../../../hooks/gusto/useGustoPayrollRuns';
import { downloadCSV, fmtCurrency, fmtDateCSV, getGustoYears } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

const YEARS = ['all', ...getGustoYears()?.map(String)];

export default function GustoPayrollRuns({ isSuperAdmin }) {
  const [selectedYear, setSelectedYear] = useState(String(new Date()?.getFullYear()));
  const [filters, setFilters] = useState({ type: 'all', status: 'all', runBy: 'all' });
  const [selectedRun, setSelectedRun] = useState(null);

  const { data, count, loading, error, page, setPage, pageSize } = useGustoPayrollRuns({ year: selectedYear, ...filters });
  const { summary } = useGustoPayrollRunSummary(selectedYear === 'all' ? null : selectedYear);

  // Get unique run_by values from data
  const runByOptions = [...new Set(data?.map(r => r?.run_by_user_name).filter(Boolean))];

  const handleExport = () => {
    const headers = ['ID','Pay Period Start','Pay Period End','Check Date','Net Pay','Taxes','Gross Debit','Reimbursements','Off Cycle','Processed','Reversed','Items Processed','Run By','Pay Schedule'];
    const rows = data?.map(r => [
      r?.id, fmtDateCSV(r?.pay_period_start), fmtDateCSV(r?.pay_period_end), fmtDateCSV(r?.check_date),
      r?.total_net_pay, r?.total_payable_tax, r?.total_debit_amount, r?.total_reimbursement,
      String(r?.off_cycle ?? ''), String(r?.processed ?? ''), String(r?.reversed ?? ''),
      r?.items_processed, r?.run_by_user_name, r?.pay_schedule_name,
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_payroll_runs_${today}.csv`, [headers, ...rows]);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Payroll Runs
        </h2>
        <button onClick={handleExport} disabled={!data?.length}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] disabled:opacity-50 transition-colors">
          ↓ Export Payroll Runs CSV
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
      {summary && (
        <div className="flex flex-wrap gap-4 bg-[#F8F9FA] border border-gray-200 rounded-xl px-4 py-3 text-sm">
          <span className="text-gray-600">Period totals (all runs): {summary?.runCount} runs</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Net Pay: <strong className="text-[#00B5CC]">{fmtCurrency(summary?.totalNetPay)}</strong></span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Taxes: <strong>{fmtCurrency(summary?.totalTaxes)}</strong></span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Gross: <strong>{fmtCurrency(summary?.totalGross)}</strong></span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Off-cycle: <strong>{summary?.offCycleCount}</strong></span>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
        {[
          { label: 'Type', key: 'type', options: [['all','All'],['regular','Regular'],['off_cycle','Off-Cycle']] },
          { label: 'Status', key: 'status', options: [['all','All'],['processed','Processed'],['reversed','Reversed'],['needs_reprocessing','Needs Reprocessing']] },
        ]?.map(({ label, key, options }) => (
          <div key={key} className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            <select value={filters?.[key]} onChange={e => { setPage(0); setFilters(f => ({ ...f, [key]: e?.target?.value })); }}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
              {options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        {runByOptions?.length > 0 && (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Run By</label>
            <select value={filters?.runBy} onChange={e => { setPage(0); setFilters(f => ({ ...f, runBy: e?.target?.value })); }}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]">
              <option value="all">All</option>
              {runByOptions?.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>}
      {!loading && !data?.length && !error ? (
        <GustoEmptyState message="No payroll runs match the current filters." />
      ) : (
        <GustoPayrollRunTable
          data={data} count={count} loading={loading}
          page={page} pageSize={pageSize} onPageChange={setPage}
          onRowClick={setSelectedRun}
        />
      )}
      {selectedRun && <GustoPayrollRunModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}
