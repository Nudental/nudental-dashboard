import React, { useState, useMemo } from 'react';
import { Search, Download, AlertTriangle } from 'lucide-react';
import { fmtCurrency, fmtPct } from '../../../services/kpiService';

// Performance tier legend
const TIERS = [
  { label: 'Top 20%', bg: '#90EE90', text: '#166534' },
  { label: 'Mid Tier', bg: '#FFFF99', text: '#713f12' },
  { label: 'Bottom 20%', bg: '#FFB6C1', text: '#9f1239' },
];

// Calculate percentile rank for each value in an array
const calcPercentileRanks = (values) => {
  const sorted = [...values]?.filter((v) => v !== null && v !== undefined)?.sort((a, b) => a - b);
  return values?.map((v) => {
    if (v === null || v === undefined) return null;
    const rank = sorted?.indexOf(v);
    return sorted?.length > 1 ? (rank / (sorted?.length - 1)) * 100 : 50;
  });
};

const getCellStyle = (percentile) => {
  if (percentile === null || percentile === undefined) return {};
  if (percentile >= 80) return { backgroundColor: '#90EE90', color: '#166534' };
  if (percentile >= 20) return { backgroundColor: '#FFFF99', color: '#713f12' };
  return { backgroundColor: '#FFB6C1', color: '#9f1239' };
};

const DOCTOR_COLUMNS = [
  { key: 'officeName', label: 'Location', format: (v) => v || '—', noColor: true },
  { key: 'providerName', label: 'Provider', format: (v) => v || '—', noColor: true },
  { key: 'caseAcceptanceSameDay', label: 'Case Acceptance Same Day', format: (v) => v != null ? fmtPct(v) : '—' },
  { key: 'caseAcceptanceRate', label: 'Case Acceptance Rate', format: (v) => v != null ? fmtPct(v) : '—' },
  { key: 'newPtsWithTxPlans', label: '$ New Pts with TX Plans', format: (v) => v != null ? fmtCurrency(v) : '—' },
  { key: 'existingPtsWithTxPlans', label: '$ Existing Pts with TX Plans', format: (v) => v != null ? fmtCurrency(v) : '—' },
  { key: 'avgTimePerAppt', label: 'Avg Time per Appt (min)', format: (v) => v != null ? `${v?.toFixed(0)} min` : '—' },
  // PATCH C: avgProdPerHour uses row.productionPerHour from provider-performance.
  // null for unattributed rows — shows N/A. DO NOT calculate from 8-hour assumption.
  { key: 'avgProdPerHour', label: 'Avg Doctor Prod per Hour', format: (v) => v != null ? fmtCurrency(v) : 'N/A' },
  { key: 'prodPerPatient', label: 'Avg Production per Appt', format: (v) => v != null ? fmtCurrency(v) : '—' },
];

const HYGIENE_COLUMNS = [
  { key: 'officeName', label: 'Location', format: (v) => v || '—', noColor: true },
  { key: 'providerName', label: 'Provider', format: (v) => v || '—', noColor: true },
  { key: 'perioPct', label: 'Perio %', format: (v) => v != null ? fmtPct(v) : '—' },
  { key: 'avgProdPerDay', label: 'Avg Production per Day', format: fmtCurrency },
  { key: 'prodPerPatient', label: 'Production per Patient Visit', format: (v) => v != null ? fmtCurrency(v) : '—' },
  { key: 'reappointmentPct', label: 'Hygiene Reappointment %', format: (v) => v != null ? fmtPct(v) : '—' },
  { key: 'caseAcceptanceRate', label: 'Case Acceptance Rate', format: (v) => v != null ? fmtPct(v) : '—' },
  // PATCH C: avgProdPerHour uses row.productionPerHour from provider-performance.
  // null for unattributed rows — shows N/A. DO NOT calculate from 8-hour assumption.
  { key: 'avgProdPerHour', label: 'Avg Hygiene Prod per Hour', format: (v) => v != null ? fmtCurrency(v) : 'N/A' },
  { key: 'fluoridePct', label: 'Fluoride %', format: (v) => v != null ? fmtPct(v) : '—' },
];

const ProvidersHeatmapTable = ({ rows, columns, loading }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search?.trim()) return rows;
    const q = search?.toLowerCase();
    return rows?.filter(
      (r) =>
        r?.providerName?.toLowerCase()?.includes(q) ||
        r?.officeName?.toLowerCase()?.includes(q)
    );
  }, [rows, search]);

  // Calculate percentile ranks per metric column
  const percentilesByCol = useMemo(() => {
    const result = {};
    columns?.forEach((col) => {
      if (col?.noColor) return;
      const vals = filtered?.map((r) => r?.[col?.key]);
      result[col?.key] = calcPercentileRanks(vals);
    });
    return result;
  }, [filtered, columns]);

  const exportCsv = () => {
    const headers = columns?.map((c) => c?.label)?.join(',');
    const rowsCsv = filtered?.map((r) =>
      columns?.map((c) => {
        const v = r?.[c?.key];
        return `"${c?.format ? c?.format(v) : (v ?? '—')}"`;
      })?.join(',')
    )?.join('\n');
    const blob = new Blob([`${headers}\n${rowsCsv}`], { type: 'text/csv' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    a.href = url;
    a.download = 'providers_heatmap.csv';
    a?.click();
    URL?.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 })?.map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!filtered?.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">No provider data found for the selected period.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search provider or location..."
            value={search}
            onChange={(e) => setSearch(e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted text-foreground whitespace-nowrap"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted border-b border-border">
              {columns?.map((col) => (
                <th
                  key={col?.key}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {col?.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered?.map((row, rowIdx) => (
              <tr key={row?.providerId || rowIdx} className="border-b border-border hover:bg-muted/50">
                {columns?.map((col) => {
                  const val = row?.[col?.key];
                  const pctRanks = percentilesByCol?.[col?.key];
                  const pct = pctRanks ? pctRanks?.[rowIdx] : null;
                  const cellStyle = col?.noColor ? {} : getCellStyle(pct);

                  return (
                    <td
                      key={col?.key}
                      className="px-3 py-2 text-xs font-medium whitespace-nowrap"
                      style={cellStyle}
                    >
                      {col?.format ? col?.format(val) : (val ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProvidersTab = ({ data, loading }) => {
  const [subTab, setSubTab] = useState('doctor');

  // data is { rows, unattributedCount, unattributedNetProduction, dataSource }
  // Support both old flat array shape (fallback) and new object shape (Dentrix)
  const allRows = Array.isArray(data) ? data : (data?.rows || []);
  const unattributedCount = data?.unattributedCount || 0;
  const unattributedNetProduction = data?.unattributedNetProduction || 0;
  const dataSource = data?.dataSource || 'unknown';

  const isDentrixUnavailable = dataSource === 'dentrix_unavailable' || dataSource === 'no_dentrix_provider_data';

  const doctorRows = allRows?.filter((r) => r?.providerType === 'doctor');
  const hygieneRows = allRows?.filter((r) => r?.providerType === 'hygienist');

  return (
    <div>
      {/* Dentrix source banner — shown when data is from Dentrix */}
      {(dataSource === 'dentrix_provider_api' || dataSource === 'dentrix') && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
          <span className="mt-0.5 shrink-0">✓</span>
          <span>
            <strong>Dentrix Ascend</strong> — Provider production and collections sourced from Dentrix provider API (net production).
          </span>
        </div>
      )}
      {/* Dentrix unavailable banner — shown when Dentrix returned no rows or errored */}
      {isDentrixUnavailable && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <span>
            <strong>Dentrix provider data unavailable</strong> — provider production and collections are hidden to avoid showing manual or estimated values.
          </span>
        </div>
      )}
      {/* Unattributed providers warning */}
      {unattributedCount > 0 && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Unattributed Dentrix provider rows are excluded from Doctor/Hygiene tabs.</strong>{' '}
            {unattributedCount} unattributed provider{unattributedCount !== 1 ? 's' : ''} with{' '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(unattributedNetProduction)} net production
            are not shown in either tab.
          </span>
        </div>
      )}
      {/* Performance tier legend */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Performance Tier:</span>
        {TIERS?.map((tier) => (
          <span
            key={tier?.label}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: tier?.bg, color: tier?.text }}
          >
            {tier?.label}
          </span>
        ))}
      </div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {['doctor', 'hygiene']?.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              subTab === tab
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'doctor' ? 'Doctor' : 'Hygiene'}
          </button>
        ))}
      </div>
      {subTab === 'doctor' && (
        <ProvidersHeatmapTable
          rows={doctorRows}
          columns={DOCTOR_COLUMNS}
          loading={loading}
        />
      )}
      {subTab === 'hygiene' && (
        <ProvidersHeatmapTable
          rows={hygieneRows}
          columns={HYGIENE_COLUMNS}
          loading={loading}
        />
      )}
    </div>
  );
};

export default ProvidersTab;
