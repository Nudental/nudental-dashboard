import React from 'react';

const ALL_TABS = [
  { key: 'dentrix', label: 'Dentrix Ascend', icon: '🦷' },
  { key: 'gusto', label: 'Imported from Gusto', icon: '📊' },
  { key: 'comparison', label: 'Comparison', icon: '⚖️' },
  { key: 'provider_compensation', label: 'Provider Compensation', icon: '💰' },
];

/**
 * Top-level source switcher: Dentrix Ascend | Imported from Gusto | Comparison | Provider Compensation
 *
 * RBAC Phase 2A: Only renders tabs present in the allowedTabs array.
 * If allowedTabs is not provided (legacy / super_admin shortcut), all tabs are shown.
 *
 * Active tab: underline in #00B5CC. Default: first allowed tab.
 */
export default function PayrollSourceSwitcher({ active, onChange, allowedTabs }) {
  // Filter to only allowed tabs; if allowedTabs not provided, show all (safe fallback)
  const visibleTabs = allowedTabs
    ? ALL_TABS?.filter(t => allowedTabs?.includes(t?.key))
    : ALL_TABS;

  if (visibleTabs?.length === 0) return null;

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm w-fit flex-wrap">
      {visibleTabs?.map(tab => (
        <button
          key={tab?.key}
          onClick={() => onChange(tab?.key)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            active === tab?.key
              ? 'bg-[#00B5CC] text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <span>{tab?.icon}</span>
          {tab?.label}
        </button>
      ))}
    </div>
  );
}
