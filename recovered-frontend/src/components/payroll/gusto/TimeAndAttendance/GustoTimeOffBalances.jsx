import React, { useState, useMemo } from 'react';
import { useGustoTimeOffBalances } from '../../../../hooks/gusto/useGustoTimeOffBalances';
import { downloadCSV, fmtDate } from '../../../../lib/gusto/gustoFormatters';

const TYPE_BADGE = {
  Vacation: 'bg-blue-100 text-blue-700',
  Sick: 'bg-red-100 text-red-700',
  PTO: 'bg-teal-100 text-teal-700',
  Unpaid: 'bg-gray-100 text-gray-600',
  Holiday: 'bg-purple-100 text-purple-700',
};

function getBalanceColor(hours) {
  const h = parseFloat(hours) || 0;
  if (h <= 0) return 'text-red-600 font-bold';
  if (h < 40) return 'text-orange-600 font-semibold';
  if (h < 80) return 'text-yellow-600 font-semibold';
  return 'text-green-600 font-semibold';
}

export default function GustoTimeOffBalances({ isSuperAdmin }) {
  const currentYear = new Date()?.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const { data, loading, error } = useGustoTimeOffBalances({});
  const filteredData = useMemo(() => data.filter(balance =>
    balance.snapshot_date?.slice(0, 4) === String(year)
  ), [data, year]);

  const years = [2026, 2025, 2024, 2023, 2022, 2021];

  // Group by employee
  const grouped = useMemo(() => {
    const map = {};
    filteredData?.forEach(b => {
      const key = b?.employee_id;
      if (!map?.[key]) {
        map[key] = {
          employee_id: b?.employee_id,
          employee_name: b?.employee_name || b?.employee_id,
          balances: [],
        };
      }
      map?.[key]?.balances?.push(b);
    });
    return Object.values(map)?.sort((a, b) => (a?.employee_name || '')?.localeCompare(b?.employee_name || ''));
  }, [filteredData]);

  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const headers = ['Employee', 'Type', 'Accrued YTD (hrs)', 'Used YTD (hrs)', 'Pending (hrs)', 'Remaining (hrs)', 'Remaining (days)', 'Snapshot Date'];
    const rows = [headers];
    filteredData?.forEach(b => {
      rows?.push([
        b?.employee_name || b?.employee_id,
        b?.time_off_type || '',
        parseFloat(b?.accrued_ytd_hours || 0)?.toFixed(2),
        parseFloat(b?.used_ytd_hours || 0)?.toFixed(2),
        parseFloat(b?.pending_hours || 0)?.toFixed(2),
        parseFloat(b?.balance_hours || 0)?.toFixed(2),
        parseFloat(b?.balance_days || 0)?.toFixed(2),
        b?.snapshot_date || '',
      ]);
    });
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_time_off_balances_${today}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1,2,3]?.map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-600">Year:</span>
          <div className="flex gap-1">
            {years?.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${year === y ? 'bg-[#00B5CC] text-white border-[#00B5CC]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!filteredData.length}
          className="px-4 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          ↓ Export Time Off Balances CSV
        </button>
      </div>
      {!grouped?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-gray-500 text-sm">No time off balance snapshots found for {year}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {grouped?.map(emp => (
            <div key={emp?.employee_id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Employee header */}
              <button
                className="w-full flex items-center justify-between px-5 py-3 bg-[#F8F9FA] hover:bg-[#F0FAFB] transition-colors text-left"
                onClick={() => setExpandedEmployee(expandedEmployee === emp?.employee_id ? null : emp?.employee_id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800 text-sm">{emp?.employee_name}</span>
                  <span className="text-xs text-gray-400">{emp?.balances?.length} balance record{emp?.balances?.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-gray-400 text-xs">{expandedEmployee === emp?.employee_id ? '▲' : '▼'}</span>
              </button>

              {/* Expanded balances */}
              {expandedEmployee === emp?.employee_id && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        {['Type','Accrued YTD','Used YTD','Pending','Remaining (hrs)','Remaining (days)','Snapshot Date']?.map(h => (
                          <th key={h} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {emp?.balances?.map((b, idx) => (
                        <tr key={idx} className="hover:bg-[#F8F9FA]">
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE?.[b?.time_off_type] || 'bg-gray-100 text-gray-600'}`}>
                              {b?.time_off_type || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{b?.accrued_ytd_hours != null ? `${parseFloat(b?.accrued_ytd_hours)?.toFixed(1)} hrs` : '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">
                            {b?.used_ytd_hours != null ? `${parseFloat(b?.used_ytd_hours)?.toFixed(1)} hrs` : '—'}
                            {b?.used_ytd_days != null ? <span className="text-gray-400 text-xs ml-1">({parseFloat(b?.used_ytd_days)?.toFixed(1)} days)</span> : null}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{b?.pending_hours != null ? `${parseFloat(b?.pending_hours)?.toFixed(1)} hrs` : '—'}</td>
                          <td className={`px-4 py-2.5 text-sm ${getBalanceColor(b?.balance_hours)}`}>
                            {b?.balance_hours != null ? `${parseFloat(b?.balance_hours)?.toFixed(1)} hrs` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{b?.balance_days != null ? `${parseFloat(b?.balance_days)?.toFixed(1)} days` : '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{fmtDate(b?.snapshot_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
