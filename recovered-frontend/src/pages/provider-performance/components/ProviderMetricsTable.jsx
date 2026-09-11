import React, { useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

// V315 FIX #3: null-safe currency formatter
// null/undefined/NaN → '—'   |   real backend 0 → '$0'
const fmt = (v) => {
  if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);
};

// V315 FIX #6: Added 'unknown' and 'other' entries so unrecognized provider types
// do NOT silently fall back to the 'house' badge (amber, labeled "House").
const TYPE_COLORS = {
  doctor: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Doctor' },
  hygienist: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Hygienist' },
  house: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'House' },
  unattributed: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Unattributed' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unknown' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Other' },
};

// V315 FIX #6: Resolve provider type style — unknown/unrecognized types get 'Unknown' label,
// not the 'house' amber badge.
const getTypeStyle = (type) => {
  if (!type) return TYPE_COLORS?.unknown;
  const key = type?.toLowerCase();
  return TYPE_COLORS?.[key] || TYPE_COLORS?.unknown;
};

const SparkLine = ({ data, color = '#6366f1' }) => {
  if (!data?.length) {
    return <div className="w-24 h-8 flex items-center justify-center text-xs text-muted-foreground">No data</div>;
  }
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            label=""
            show={true}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-card border border-border rounded px-2 py-1 text-xs shadow-elevation-1">
                  <p className="font-medium">{fmt(payload?.[0]?.value)}</p>
                  <p className="text-muted-foreground">{payload?.[0]?.payload?.date}</p>
                </div>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const PerformanceBadge = ({ rate, label }) => {
  const val = parseFloat(rate);
  const color = val >= 80 ? 'text-success' : val >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <div className="flex items-center gap-1">
      <span className={`text-sm font-semibold ${color}`}>{rate !== null ? `${rate}%` : '—'}</span>
    </div>
  );
};

const ProviderMetricsTable = ({ data, loading, trendDays, activeCategory, selectedOfficeName }) => {
  const [sortKey, setSortKey] = useState('production');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Separate unattributed row — always render it last, never rank it
  const attributed = (data || [])?.filter(p => !p?.isUnattributed);
  const unattributed = (data || [])?.filter(p => p?.isUnattributed);

  const sortedAttributed = [...attributed]?.sort((a, b) => {
    const av = parseFloat(a?.[sortKey]) || 0;
    const bv = parseFloat(b?.[sortKey]) || 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  // Unattributed rows always appended after sorted attributed rows
  const sorted = [...sortedAttributed, ...unattributed];

  const SortBtn = ({ col, label }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
    >
      {label}
      <Icon name={sortKey === col ? (sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown') : 'ChevronsUpDown'} size={12} />
    </button>
  );

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading provider data...</span>
        </div>
      </div>
    );
  }

  if (!sorted?.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Icon name="Users" size={24} color="var(--color-muted-foreground)" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No provider data found</p>
        <p className="text-xs text-muted-foreground">Try adjusting your filters or date range</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left"><SortBtn col="name" label="Provider" /></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service Office</th>
              <th className="px-4 py-3 text-right"><SortBtn col="production" label="Net Production" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="collections" label="Collections" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="collectionRate" label="Coll. Rate" /></th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Accept.</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{trendDays}d Trend</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted?.map((p, idx) => {
              // V315 FIX #6: use getTypeStyle() instead of TYPE_COLORS?.[p?.type] || TYPE_COLORS?.house
              const typeStyle = getTypeStyle(p?.type);
              const isExpanded = expandedId === p?.id;
              const isTop = !p?.isUnattributed && idx === 0 && sortedAttributed?.length > 0;

              const serviceOfficeName = selectedOfficeName
                ? selectedOfficeName
                : p?.isUnattributed
                  ? '—' : (p?.homeOffice || '—');

              const showHomeOfficeTooltip = !p?.isUnattributed
                && p?.homeOffice
                && selectedOfficeName
                && p?.homeOffice !== selectedOfficeName;

              return (
                <React.Fragment key={p?.id}>
                  <tr className={`hover:bg-muted/20 transition-colors ${
                    p?.isUnattributed
                      ? 'bg-slate-50/60 dark:bg-slate-800/20 border-t-2 border-dashed border-slate-200 dark:border-slate-700' : isTop ? 'bg-success/5' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isTop && <Icon name="Trophy" size={14} color="var(--color-warning)" />}
                        {p?.isUnattributed
                          ? (
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                              <Icon name="HelpCircle" size={14} color="var(--color-muted-foreground)" />
                            </div>
                          )
                          : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {p?.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )
                        }
                        <span className={`text-sm font-medium ${p?.isUnattributed ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                          {p?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeStyle?.bg} ${typeStyle?.text}`}>
                        {typeStyle?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">{serviceOfficeName}</span>
                        {showHomeOfficeTooltip && (
                          <span
                            title={`Provider home office: ${p?.homeOffice}`}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground cursor-help text-xs leading-none"
                          >
                            <Icon name="Info" size={10} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* V315 FIX #3: fmt() is null-safe — null → '—', real 0 → '$0' */}
                      <span className="text-sm font-semibold text-foreground">{fmt(p?.production)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-blue-600">{fmt(p?.collections)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p?.isUnattributed ? <span className="text-xs text-muted-foreground">—</span> : <PerformanceBadge rate={p?.collectionRate} label="Collection Rate" />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* V315 FIX #5: Case Acceptance always N/A — source not wired */}
                      <span className="text-xs text-muted-foreground italic">N/A</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {p?.isUnattributed
                          ? <span className="text-xs text-muted-foreground">—</span>
                          : (
                            <SparkLine
                              data={p?.trendData}
                              color={p?.type === 'doctor' ? '#3b82f6' : p?.type === 'hygienist' ? '#8b5cf6' : '#f59e0b'}
                            />
                          )
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p?.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                      >
                        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="px-4 py-3 bg-muted/20">
                        <div className="text-sm">
                          {p?.isUnattributed ? (
                            <div>
                              <p className="text-xs text-muted-foreground italic mb-1">
                                This row represents office-level Dentrix production, adjustments, or collections that cannot be attributed to a specific provider. No category breakdown is available.
                              </p>
                              {selectedOfficeName && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Service Office:</span> {selectedOfficeName} &nbsp;|&nbsp; <span className="font-medium">Type:</span> Unattributed
                                </p>
                              )}
                            </div>
                          ) : (
                            <>
                              <p className="font-semibold text-foreground mb-2">Category breakdown unavailable</p>
                              {showHomeOfficeTooltip && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  <span className="font-medium">Provider Home Office:</span> {p?.homeOffice}
                                </p>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(p?.categories || {})?.map(([catId, cat]) => (
                                  <div key={catId} className="bg-card border border-border rounded-md p-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">{cat?.name}</p>
                                    <p className="text-sm font-bold text-foreground">{fmt(cat?.production)}</p>
                                    <p className="text-xs text-blue-600">{fmt(cat?.collections)} collected</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile Card Layout */}
      <div className="lg:hidden divide-y divide-border">
        {sorted?.map((p, idx) => {
          // V315 FIX #6: use getTypeStyle() instead of TYPE_COLORS?.[p?.type] || TYPE_COLORS?.house
          const typeStyle = getTypeStyle(p?.type);
          const serviceOfficeName = selectedOfficeName
            ? selectedOfficeName
            : p?.isUnattributed
              ? '—' : (p?.homeOffice || '—');
          const showHomeOfficeTooltip = !p?.isUnattributed
            && p?.homeOffice
            && selectedOfficeName
            && p?.homeOffice !== selectedOfficeName;
          return (
            <div key={p?.id} className={`p-4 ${p?.isUnattributed ? 'bg-slate-50/60 dark:bg-slate-800/20' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  {p?.isUnattributed
                    ? (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <Icon name="HelpCircle" size={16} color="var(--color-muted-foreground)" />
                      </div>
                    )
                    : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {p?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )
                  }
                  <div>
                    <p className={`text-sm font-medium ${p?.isUnattributed ? 'text-muted-foreground italic' : 'text-foreground'}`}>{p?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {serviceOfficeName}
                      {showHomeOfficeTooltip && (
                        <span className="ml-1 text-muted-foreground/60" title={`Provider home office: ${p?.homeOffice}`}>
                          (Home: {p?.homeOffice})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeStyle?.bg} ${typeStyle?.text}`}>
                  {typeStyle?.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Net Production</p>
                  <p className="text-sm font-bold text-foreground">{fmt(p?.production)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collections</p>
                  <p className="text-sm font-bold text-blue-600">{fmt(p?.collections)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coll. Rate</p>
                  {p?.isUnattributed
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : <PerformanceBadge rate={p?.collectionRate} label="Collection Rate" />
                  }
                </div>
              </div>
              {!p?.isUnattributed && (
                <SparkLine
                  data={p?.trendData}
                  color={p?.type === 'doctor' ? '#3b82f6' : p?.type === 'hygienist' ? '#8b5cf6' : '#f59e0b'}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground">
          {sortedAttributed?.length} provider{sortedAttributed?.length !== 1 ? 's' : ''} shown
          {unattributed?.length > 0 && ' + office-level unattributed row'}
          {' · '}Provider rows are filtered by service/transaction office. Provider home office may differ.
        </p>
      </div>
    </div>
  );
};

export default ProviderMetricsTable;
