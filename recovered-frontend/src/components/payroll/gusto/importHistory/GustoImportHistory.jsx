import React, { useState } from 'react';
import { useGustoImportLogs } from '../../../../hooks/gusto/useGustoImportLogs';
import { fmtDateTime, getImportStatusBadgeClass, getImportTypeBadgeClass } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

function ImportBadge({ children, className }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}

function ImportLogRow({ log, isSuperAdmin }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#F8F9FA] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <ImportBadge className={getImportTypeBadgeClass(log?.import_type)}>
            {log?.import_type || 'unknown'}
          </ImportBadge>
          <ImportBadge className={getImportStatusBadgeClass(log?.status)}>
            {log?.status}
          </ImportBadge>
          <span className="text-sm text-gray-600">{fmtDateTime(log?.started_at)}</span>
          {log?.imported_by_name && (
            <span className="text-xs text-gray-400">by {log?.imported_by_name}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>✅ {log?.records_inserted ?? 0} inserted</span>
          <span>🔄 {log?.records_updated ?? 0} updated</span>
          {(log?.records_failed ?? 0) > 0 && <span className="text-red-600">❌ {log?.records_failed} failed</span>}
          {log?.duration_seconds != null && <span>⏱ {parseFloat(log?.duration_seconds)?.toFixed(1)}s</span>}
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-[#F8F9FA]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            {[
              ['Attempted', log?.records_attempted],
              ['Inserted', log?.records_inserted],
              ['Updated', log?.records_updated],
              ['Skipped', log?.records_skipped],
              ['Failed', log?.records_failed],
              ['Source', log?.source],
              ['Completed', fmtDateTime(log?.completed_at)],
              ['Duration', log?.duration_seconds ? `${parseFloat(log?.duration_seconds)?.toFixed(1)}s` : '—'],
            ]?.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-gray-400">{label}</div>
                <div className="font-medium text-gray-800">{value ?? '—'}</div>
              </div>
            ))}
          </div>
          {log?.error_details && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Error Details</div>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                {JSON.stringify(log?.error_details, null, 2)}
              </pre>
            </div>
          )}
          {isSuperAdmin && (
            <div className="mt-3 flex flex-col gap-1">
              <button
                disabled
                className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed opacity-60"
                title="Import re-run is disabled during source verification."
              >
                Re-run Import
              </button>
              <span className="text-xs text-amber-600">Import re-run is disabled during source verification.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GustoImportHistory({ isSuperAdmin }) {
  const { data, loading, error, refetch } = useGustoImportLogs();

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1,2,3]?.map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!data?.length) {
    return <GustoEmptyState message="No import history yet. Import data to see logs here." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Import History
        </h2>
        <button onClick={refetch}
          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          ↻ Refresh
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">Error: {error}</div>}
      <div className="flex flex-col gap-3">
        {data?.map(log => (
          <ImportLogRow key={log?.id} log={log} isSuperAdmin={isSuperAdmin} />
        ))}
      </div>
    </div>
  );
}
