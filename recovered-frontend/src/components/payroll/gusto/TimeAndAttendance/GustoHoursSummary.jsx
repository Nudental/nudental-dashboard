import React, { useState, useMemo } from 'react';
import { useGustoHoursSummary } from '../../../../hooks/gusto/useGustoHoursSummary';
import { downloadCSV } from '../../../../lib/gusto/gustoFormatters';

function HrsCell({ value, warn }) {
  const v = parseFloat(value) || 0;
  return (
    <span className={warn && v > 0 ? 'text-orange-600 font-semibold' : 'text-gray-700'}>
      {v?.toFixed(1)}
    </span>
  );
}

export default function GustoHoursSummary({ isSuperAdmin }) {
  const currentYear = new Date()?.getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, loading, error } = useGustoHoursSummary({ year });

  const years = [2026, 2025, 2024, 2023, 2022, 2021];

  const totals = useMemo(() => ({
    regular_hours: data?.reduce((s, r) => s + (parseFloat(r?.regular_hours) || 0), 0),
    overtime_hours: data?.reduce((s, r) => s + (parseFloat(r?.overtime_hours) || 0), 0),
    pto_hours_used: data?.reduce((s, r) => s + (parseFloat(r?.pto_hours_used) || 0), 0),
    sick_hours_used: data?.reduce((s, r) => s + (parseFloat(r?.sick_hours_used) || 0), 0),
    vacation_hours_used: data?.reduce((s, r) => s + (parseFloat(r?.vacation_hours_used) || 0), 0),
    holiday_hours: data?.reduce((s, r) => s + (parseFloat(r?.holiday_hours) || 0), 0),
    total_hours_worked: data?.reduce((s, r) => s + (parseFloat(r?.total_hours_worked) || 0), 0),
    pay_periods_count: data?.reduce((s, r) => s + (parseInt(r?.pay_periods_count) || 0), 0),
  }), [data]);

  const handleExportCSV = () => {
    const headers = ['Employee','Regular Hrs','Overtime Hrs','PTO Used','Sick Used','Vacation Used','Holiday','Total Worked','Pay Periods'];
    const rows = [headers];
    data?.forEach(r => {
      rows?.push([
        r?.employee_name || r?.employee_id,
        parseFloat(r?.regular_hours || 0)?.toFixed(1),
        parseFloat(r?.overtime_hours || 0)?.toFixed(1),
        parseFloat(r?.pto_hours_used || 0)?.toFixed(1),
        parseFloat(r?.sick_hours_used || 0)?.toFixed(1),
        parseFloat(r?.vacation_hours_used || 0)?.toFixed(1),
        parseFloat(r?.holiday_hours || 0)?.toFixed(1),
        parseFloat(r?.total_hours_worked || 0)?.toFixed(1),
        r?.pay_periods_count || 0,
      ]);
    });
    rows?.push([
      'TOTAL',
      totals?.regular_hours?.toFixed(1),
      totals?.overtime_hours?.toFixed(1),
      totals?.pto_hours_used?.toFixed(1),
      totals?.sick_hours_used?.toFixed(1),
      totals?.vacation_hours_used?.toFixed(1),
      totals?.holiday_hours?.toFixed(1),
      totals?.total_hours_worked?.toFixed(1),
      totals?.pay_periods_count,
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_hours_summary_${year}_${today}.csv`, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1,2,3,4]?.map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
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
          className="px-4 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ↓ Export Hours Summary CSV
        </button>
      </div>
      {!data?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-gray-500 text-sm">No hours summary data for {year}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-gray-200">
                {['Employee','Regular Hrs','Overtime Hrs','PTO Used','Sick Used','Vacation Used','Holiday','Total Worked','Pay Periods']?.map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map(row => (
                <tr key={row?.id} className="hover:bg-[#F0FAFB] transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{row?.employee_name || row?.employee_id || '—'}</td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.regular_hours} /></td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.overtime_hours} warn /></td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.pto_hours_used} /></td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.sick_hours_used} /></td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.vacation_hours_used} /></td>
                  <td className="px-4 py-2.5 text-sm"><HrsCell value={row?.holiday_hours} /></td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-[#00B5CC]">{parseFloat(row?.total_hours_worked || 0)?.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{row?.pay_periods_count || 0}</td>
                </tr>
              ))}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr className="bg-[#F8F9FA] border-t-2 border-gray-300 font-bold">
                <td className="px-4 py-2.5 text-sm text-gray-800">TOTAL</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.regular_hours?.toFixed(1)}</td>
                <td className={`px-4 py-2.5 text-sm ${totals?.overtime_hours > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{totals?.overtime_hours?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.pto_hours_used?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.sick_hours_used?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.vacation_hours_used?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.holiday_hours?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-[#00B5CC]">{totals?.total_hours_worked?.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{totals?.pay_periods_count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
