import React from 'react';
import { useGustoPaySchedules } from '../../../../hooks/gusto/useGustoPaySchedules';
import { fmtDate, downloadCSV, fmtDateCSV } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

function Badge({ children, className, badge }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{badge || children}</span>;
}

export default function GustoPaySchedules({ isSuperAdmin }) {
  const { data, loading, error } = useGustoPaySchedules();

  const handleExport = () => {
    const headers = ['ID','Schedule Name','Label','Pay Period Type','Frequency','Auto Pilot','Next Auto Pilot Date','ACH Transfer Days','Last Period End'];
    const rows = data?.map(s => [
      s?.id, s?.schedule_name, s?.schedule_label, s?.pay_period_type,
      s?.pay_frequency_description, String(s?.auto_pilot ?? ''),
      fmtDateCSV(s?.next_auto_pilot_date), s?.ach_transfer_days,
      fmtDateCSV(s?.last_payment_period_end_date),
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_pay_schedules_${today}.csv`, [headers, ...rows]);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1,2]?.map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!data?.length) {
    return <GustoEmptyState message="No pay schedules imported yet." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>Pay Schedules</h2>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] transition-colors">
          ↓ Export Pay Schedules CSV
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data?.map(schedule => {
          const ineligible = schedule?.ineligible_employees || [];
          return (
            <div key={schedule?.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-gray-900">{schedule?.schedule_name || schedule?.schedule_label || schedule?.id}</div>
                  {schedule?.schedule_label && schedule?.schedule_label !== schedule?.schedule_name && (
                    <div className="text-xs text-gray-500">{schedule?.schedule_label}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  {schedule?.auto_pilot && <Badge badge="Auto Pilot" className="bg-[#DCFCE7] text-[#166534]">Auto Pilot</Badge>}
                  {schedule?.is_arrears && <Badge badge="Arrears" className="bg-[#FEF9C3] text-[#854D0E]">Arrears</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Pay Period Type', schedule?.pay_period_type || '—'],
                  ['Frequency', schedule?.pay_frequency_description || '—'],
                  ['Anchor Pay Day', fmtDate(schedule?.anchor_pay_day)],
                  ['Anchor Period End', fmtDate(schedule?.anchor_end_of_pay_period)],
                  ['Next Auto Pilot', fmtDate(schedule?.next_auto_pilot_date)],
                  ['ACH Transfer Days', schedule?.ach_transfer_days ?? '—'],
                  ['Last Period End', fmtDate(schedule?.last_payment_period_end_date)],
                ]?.map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="font-medium text-gray-800">{value}</div>
                  </div>
                ))}
              </div>
              {/* Ineligible employees */}
              {ineligible?.length > 0 && (
                <div className="bg-[#FEF9C3] rounded-lg p-3">
                  <div className="text-xs font-semibold text-[#854D0E] mb-2">
                    ⚠️ {ineligible?.length} employee{ineligible?.length !== 1 ? 's' : ''} ineligible for auto-pilot
                  </div>
                  <div className="flex flex-col gap-1">
                    {ineligible?.slice(0, 5)?.map((emp, i) => (
                      <div key={i} className="text-xs text-[#854D0E]">
                        {emp?.name || emp?.employee_id}
                        {emp?.reasons?.length > 0 && `: ${emp?.reasons?.join(', ')}`}
                      </div>
                    ))}
                    {ineligible?.length > 5 && (
                      <div className="text-xs text-[#854D0E] italic">+{ineligible?.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
