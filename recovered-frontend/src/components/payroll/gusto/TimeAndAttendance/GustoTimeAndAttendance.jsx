import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import GustoTASummaryCards from './GustoTASummaryCards';
import GustoTimeEntries from './GustoTimeEntries';
import GustoTimeOffRequests from './GustoTimeOffRequests';
import GustoTimeOffBalances from './GustoTimeOffBalances';
import GustoHoursSummary from './GustoHoursSummary';
import { useGustoTimeEntries } from '../../../../hooks/gusto/useGustoTimeEntries';
import { useGustoTimeOffRequests } from '../../../../hooks/gusto/useGustoTimeOffRequests';
import { useGustoTimeOffBalances } from '../../../../hooks/gusto/useGustoTimeOffBalances';
import { useGustoHoursSummary } from '../../../../hooks/gusto/useGustoHoursSummary';

const SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'time_entries', label: 'Time Entries' },
  { key: 'time_off_requests', label: 'Time Off Requests' },
  { key: 'time_off_balances', label: 'YTD Balances' },
  { key: 'hours_summary', label: 'Hours Summary' },
];

function SectionHeader({ title, expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3 bg-[#F8F9FA] hover:bg-[#F0FAFB] border-b border-gray-200 transition-colors text-left"
    >
      <span className="font-semibold text-gray-800 text-sm" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{title}</span>
      <span className="text-gray-400 text-xs">{expanded ? '▲ Collapse' : '▼ Expand'}</span>
    </button>
  );
}

export default function GustoTimeAndAttendance({ isSuperAdmin }) {
  const currentYear = new Date()?.getFullYear();
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    time_entries: true,
    time_off_requests: true,
    time_off_balances: true,
    hours_summary: true,
  });

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev?.[key] }));
  };

  // Load data for summary cards
  const { data: timeEntries } = useGustoTimeEntries({});
  const { data: timeOffRequests } = useGustoTimeOffRequests({});
  const { data: timeOffBalances } = useGustoTimeOffBalances({});
  const { data: hoursSummary } = useGustoHoursSummary({ year: currentYear });

  const hasAnyData = timeEntries?.length > 0 || timeOffRequests?.length > 0 || timeOffBalances?.length > 0 || hoursSummary?.length > 0;

  return (
    <div className="flex flex-col gap-0">
      {/* API availability banner */}
      <div className="mx-0 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-blue-500 mt-0.5 flex-shrink-0">ℹ️</span>
        <p className="text-sm text-blue-700">
          Imported time and attendance records are shown below. Time-entry totals cover all imported periods. Overtime and PTO used figures use current-year summaries.
        </p>
      </div>
      {/* Section 1: Summary Cards */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <SectionHeader
          title="Summary — Imported Records"
          expanded={expandedSections?.summary}
          onToggle={() => toggleSection('summary')}
        />
        {expandedSections?.summary && (
          <div className="p-5">
            <GustoTASummaryCards
              timeEntries={timeEntries}
              timeOffRequests={timeOffRequests}
              hoursSummary={hoursSummary}
              timeOffBalances={timeOffBalances}
            />
          </div>
        )}
      </div>
      {/* Section 2: Time Entries */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <SectionHeader
          title="Time Entries — Clock In / Clock Out"
          expanded={expandedSections?.time_entries}
          onToggle={() => toggleSection('time_entries')}
        />
        {expandedSections?.time_entries && (
          <div className="p-5">
            {!timeEntries?.length && !hasAnyData ? (
              <EmptyState isSuperAdmin={isSuperAdmin} />
            ) : (
              <GustoTimeEntries isSuperAdmin={isSuperAdmin} />
            )}
          </div>
        )}
      </div>
      {/* Section 3: Time Off Requests */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <SectionHeader
          title="Time Off Requests"
          expanded={expandedSections?.time_off_requests}
          onToggle={() => toggleSection('time_off_requests')}
        />
        {expandedSections?.time_off_requests && (
          <div className="p-5">
            <GustoTimeOffRequests isSuperAdmin={isSuperAdmin} />
          </div>
        )}
      </div>
      {/* Section 4: YTD Time Off Balances */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <SectionHeader
          title="Time Off Balances"
          expanded={expandedSections?.time_off_balances}
          onToggle={() => toggleSection('time_off_balances')}
        />
        {expandedSections?.time_off_balances && (
          <div className="p-5">
            <GustoTimeOffBalances isSuperAdmin={isSuperAdmin} />
          </div>
        )}
      </div>
      {/* Section 5: Hours Summary */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader
          title="Hours Summary"
          expanded={expandedSections?.hours_summary}
          onToggle={() => toggleSection('hours_summary')}
        />
        {expandedSections?.hours_summary && (
          <div className="p-5">
            <GustoHoursSummary isSuperAdmin={isSuperAdmin} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ isSuperAdmin }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Clock size={28} className="text-gray-400" />
      </div>
      <p className="text-gray-600 font-semibold mb-1">No time &amp; attendance data imported yet</p>
      <p className="text-gray-400 text-sm mb-4">Import data from Gusto to see time entries, time off requests, and balances.</p>
      {isSuperAdmin && (
        <button className="px-4 py-2 text-sm font-semibold bg-[#00B5CC] text-white rounded-lg hover:bg-[#009bb0] transition-colors">
          Import Time &amp; Attendance Data
        </button>
      )}
    </div>
  );
}
