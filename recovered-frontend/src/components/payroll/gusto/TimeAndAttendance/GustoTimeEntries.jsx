import React, { useState, useMemo } from 'react';
import { useGustoTimeEntries } from '../../../../hooks/gusto/useGustoTimeEntries';


const STATUS_BADGE = {
  approved: 'bg-[#DCFCE7] text-[#166534]',
  pending: 'bg-[#FEF9C3] text-[#854D0E]',
  rejected: 'bg-[#FEE2E2] text-[#991B1B]',
};

function fmtTimeET(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts)?.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch { return '—'; }
}

function fmtDateFromTS(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts)?.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return '—'; }
}

function getWeekKey(ts) {
  if (!ts) return 'Unknown';
  const d = new Date(ts);
  const day = d?.getDay();
  const diff = d?.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GustoTimeEntries({ isSuperAdmin }) {
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [weeklyView, setWeeklyView] = useState(false);
  const [expandedNote, setExpandedNote] = useState(null);

  const { data: allData, loading, error } = useGustoTimeEntries({});
  const data = useMemo(() => allData.filter(entry =>
    (employeeFilter === 'all' || entry.employee_name === employeeFilter) &&
    (officeFilter === 'all' || entry.office_name === officeFilter) &&
    (statusFilter === 'all' || entry.status === statusFilter)
  ), [allData, employeeFilter, officeFilter, statusFilter]);

  const employees = useMemo(() => {
    const names = [...new Set(allData?.map(e => e?.employee_name)?.filter(Boolean))];
    return names?.sort();
  }, [allData]);

  const offices = useMemo(() => {
    const names = [...new Set(allData?.map(e => e?.office_name)?.filter(Boolean))];
    return names?.sort();
  }, [allData]);

  // Per-employee subtotals
  const employeeTotals = useMemo(() => {
    const map = {};
    data?.forEach(e => {
      const name = e?.employee_name || e?.employee_id;
      if (!map?.[name]) map[name] = 0;
      map[name] += parseFloat(e?.hours_worked) || 0;
    });
    return map;
  }, [data]);

  // Weekly grouping
  const weeklyGroups = useMemo(() => {
    if (!weeklyView) return null;
    const groups = {};
    data?.forEach(e => {
      const wk = getWeekKey(e?.clockin_time);
      if (!groups?.[wk]) groups[wk] = { entries: [], totalHours: 0 };
      groups?.[wk]?.entries?.push(e);
      groups[wk].totalHours += parseFloat(e?.hours_worked) || 0;
    });
    return groups;
  }, [data, weeklyView]);

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

  const renderRow = (entry) => (
    <tr key={entry?.id} className="hover:bg-[#F0FAFB] transition-colors">
      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{entry?.employee_name || '—'}</td>
      <td className="px-4 py-2.5 text-sm text-gray-600">{fmtDateFromTS(entry?.clockin_time)}</td>
      <td className="px-4 py-2.5 text-sm text-gray-600">{fmtTimeET(entry?.clockin_time)}</td>
      <td className="px-4 py-2.5 text-sm text-gray-600">{fmtTimeET(entry?.clockout_time)}</td>
      <td className="px-4 py-2.5 text-sm text-gray-600">{entry?.break_minutes ? `${entry?.break_minutes} min` : '—'}</td>
      <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{entry?.hours_worked != null ? `${parseFloat(entry?.hours_worked)?.toFixed(1)} hrs` : '—'}</td>
      <td className="px-4 py-2.5 text-sm text-gray-600">{entry?.office_name || '—'}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE?.[entry?.status] || 'bg-gray-100 text-gray-600'}`}>
          {entry?.status || 'unknown'}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-500 max-w-[140px]">
        {entry?.note ? (
          <span
            className="cursor-pointer hover:text-[#00B5CC] truncate block"
            title={entry?.note}
            onClick={() => setExpandedNote(expandedNote === entry?.id ? null : entry?.id)}
          >
            {expandedNote === entry?.id ? entry?.note : entry?.note?.slice(0, 30) + (entry?.note?.length > 30 ? '…' : '')}
          </span>
        ) : '—'}
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={employeeFilter}
          onChange={e => setEmployeeFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Employees</option>
          {employees?.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={officeFilter}
          onChange={e => setOfficeFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Offices</option>
          {offices?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e?.target?.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          onClick={() => setWeeklyView(v => !v)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${weeklyView ? 'bg-[#00B5CC] text-white border-[#00B5CC]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          {weeklyView ? '✓ Weekly View' : 'Weekly View'}
        </button>
        <span className="text-xs text-gray-400 ml-auto">{data?.length} entries · All times in ET</span>
      </div>
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-gray-200">
              {['Employee','Date','Clock In','Clock Out','Break','Hours','Location','Status','Note']?.map(h => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!data.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No time entries found for the selected filters.</td></tr>
            ) : weeklyView && weeklyGroups ? (
              Object.entries(weeklyGroups)?.map(([week, group]) => (
                <React.Fragment key={week}>
                  <tr className="bg-blue-50">
                    <td colSpan={9} className="px-4 py-2 text-xs font-bold text-blue-700">
                      Week of {week} — {group?.totalHours?.toFixed(1)} hrs total
                    </td>
                  </tr>
                  {group?.entries?.map(renderRow)}
                </React.Fragment>
              ))
            ) : (
              data?.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
      {/* Per-employee subtotals */}
      {!weeklyView && Object.keys(employeeTotals)?.length > 0 && (
        <div className="bg-[#F8F9FA] rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Employee Subtotals</div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(employeeTotals)?.map(([name, hrs]) => (
              <div key={name} className="text-sm">
                <span className="font-medium text-gray-700">{name}:</span>{' '}
                <span className="text-[#00B5CC] font-bold">{hrs?.toFixed(1)} hrs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
