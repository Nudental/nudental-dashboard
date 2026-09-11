import React from 'react';
import { Clock } from 'lucide-react';

const ALL_GUSTO_TABS = [
  { key: 'overview',        label: 'Overview' },
  { key: 'employees',       label: 'Employees' },
  { key: 'payroll_runs',    label: 'Payroll Runs' },
  { key: 'contractors',     label: 'Contractors' },
  { key: 'benefits',        label: 'Benefits' },
  { key: 'pay_schedules',   label: 'Pay Schedules' },
  { key: 'import_history',  label: 'Import History' },
  { key: 'time_attendance', label: 'Time & Attendance', icon: Clock },
];

/**
 * Sub-navigation for the Gusto payroll section.
 *
 * RBAC Phase 2A: Only renders tabs present in the allowedTabs array.
 * If allowedTabs is not provided (legacy fallback), all tabs are shown.
 *
 * Underline style, active underline #00B5CC.
 */
export default function GustoSubNav({ active, onChange, allowedTabs }) {
  const visibleTabs = allowedTabs
    ? ALL_GUSTO_TABS?.filter(t => allowedTabs?.includes(t?.key))
    : ALL_GUSTO_TABS;

  if (visibleTabs?.length === 0) return null;

  return (
    <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto">
      {visibleTabs?.map(tab => (
        <button
          key={tab?.key}
          onClick={() => onChange(tab?.key)}
          className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-1.5 ${
            active === tab?.key
              ? 'border-[#00B5CC] text-[#00B5CC]'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          {tab?.icon && <tab.icon size={14} />}
          {tab?.label}
        </button>
      ))}
    </div>
  );
}
