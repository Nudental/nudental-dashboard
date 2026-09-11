import React from 'react';
import { Clock, Users, AlertTriangle, Calendar, TrendingUp, Leaf } from 'lucide-react';












function SummaryCard({ icon: IconComponent, label, value, color, warn }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-500', val: 'text-blue-700' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-500', val: 'text-orange-700' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', val: 'text-yellow-700' },
    teal: { bg: 'bg-teal-50', icon: 'text-teal-500', val: 'text-teal-700' },
    green: { bg: 'bg-green-50', icon: 'text-green-500', val: 'text-green-700' },
  };
  const c = colorMap?.[color] || colorMap?.blue;
  return (
    <div className={`${c?.bg} border border-gray-200 rounded-xl p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
        {IconComponent && <IconComponent size={18} className={c?.icon} />}
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold ${c?.val}`}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
        {warn && <div className="text-xs text-orange-600 font-semibold mt-1">⚠ Review recommended</div>}
      </div>
    </div>
  );
}

export default function GustoTASummaryCards({ timeEntries = [], timeOffRequests = [], hoursSummary = [], timeOffBalances = [] }) {
  const currentYear = new Date()?.getFullYear();

  // Unique employees across all imported time entries.
  const uniqueEmployees = new Set(timeEntries?.map(e => e?.employee_id))?.size;

  // Total hours across all imported time entries.
  const totalHours = timeEntries?.reduce((sum, e) => sum + (parseFloat(e?.hours_worked) || 0), 0);

  // Overtime hours (from hours_summary current year)
  const currentYearSummary = hoursSummary?.filter(h => h?.year === currentYear);
  const overtimeHours = currentYearSummary?.reduce((sum, h) => sum + (parseFloat(h?.overtime_hours) || 0), 0);

  // Pending time off requests
  const pendingRequests = timeOffRequests?.filter(r => r?.status === 'pending')?.length;

  // PTO used YTD (all employees, current year)
  const ptoUsedYTD = currentYearSummary?.reduce((sum, h) => sum + (parseFloat(h?.pto_hours_used) || 0), 0);

  // PTO remaining (sum of balance_hours from time_off_balances)
  const ptoRemaining = timeOffBalances?.reduce((sum, b) => sum + (parseFloat(b?.balance_hours) || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <SummaryCard
        icon={Users}
        label="Employees with Imported Time Entries"
        value={uniqueEmployees}
        color="blue"
      />
      <SummaryCard
        icon={Clock}
        label="Total Imported Hours"
        value={`${totalHours?.toFixed(1)} hrs`}
        color="blue"
      />
      <SummaryCard
        icon={AlertTriangle}
        label="Overtime Hours YTD"
        value={`${overtimeHours?.toFixed(1)} hrs`}
        color={overtimeHours > 0 ? 'orange' : 'blue'}
        warn={overtimeHours > 0}
      />
      <SummaryCard
        icon={Calendar}
        label="Pending Time Off Requests"
        value={pendingRequests}
        color="yellow"
      />
      <SummaryCard
        icon={TrendingUp}
        label="PTO Used YTD (All Employees)"
        value={`${ptoUsedYTD?.toFixed(1)} hrs`}
        color="teal"
      />
      <SummaryCard
        icon={Leaf}
        label="PTO Remaining (All Employees)"
        value={`${ptoRemaining?.toFixed(1)} hrs`}
        color="green"
      />
    </div>
  );
}
