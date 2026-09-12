import React, { useState, useEffect, useCallback } from 'react';
import Icon from './AppIcon';
import { useYearComparison } from '../contexts/YearComparisonContext';
import {
  fetchMultiYearMEAData,
  aggregateYearKPIs,
  buildComparisonKPIRows,
  buildMonthlyComparisonData,
  formatComparisonValue,
  calcPctChange,
} from '../services/yearComparisonService';
import YearComparisonExportButton from './YearComparisonExportButton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,  } from 'recharts';

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const CHART_FIELDS = [
  { key: 'net_production', label: 'Net Production (MEA)' },
  { key: 'collections_total', label: 'Collections' },
  { key: 'expenses_total', label: 'Expenses' },
  { key: 'new_patients', label: 'New Patients', format: 'number' },
  { key: 'hygiene_prod', label: 'Hygiene' },
  { key: 'doctor_prod', label: 'Doctor' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload?.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry?.color }} />
            <span className="text-muted-foreground">{entry?.name}</span>
          </div>
          <span className="font-semibold text-foreground">
            {entry?.value != null ? (entry?.name?.includes('Patients') ? entry?.value?.toLocaleString() : fmt(entry?.value)) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * YearComparisonPanel — a reusable panel that can be embedded in any dashboard tab.
 * Shows multi-year KPI summary, chart, and comparison table when years are selected.
 * 
 * Props:
 *   officeIds: string[] — filter by office (optional)
 *   title: string — section title
 *   compact: boolean — compact mode (fewer metrics)
 */
const YearComparisonPanel = ({ officeIds = [], title = 'Year-over-Year Comparison', compact = false }) => {
  const {
    selectedYears,
    isComparisonMode,
    isYearFilterActive,
    getYearColor,
    resetYears,
  } = useYearComparison();

  const [yearDataMap, setYearDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState('net_production');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isYearFilterActive || selectedYears?.length === 0) {
      setYearDataMap({});
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchMultiYearMEAData(selectedYears, officeIds);
        setYearDataMap(data);
      } catch (err) {
        console.warn('YearComparisonPanel load error:', err?.message);
        setYearDataMap({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYears, isYearFilterActive, officeIds?.join(',')]);

  if (!isYearFilterActive) return null;

  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);
  const yearKPIMap = {};
  sortedYears?.forEach(year => {
    yearKPIMap[year] = aggregateYearKPIs(yearDataMap?.[year] || []);
  });

  const comparisonRows = isComparisonMode ? buildComparisonKPIRows(yearKPIMap) : [];
  const chartData = buildMonthlyComparisonData(yearDataMap, activeField);

  const topMetrics = [
    { key: 'production', label: 'Net Production (MEA)', format: 'currency', higherIsBetter: true },
    { key: 'collections', label: 'Collections', format: 'currency', higherIsBetter: true },
    { key: 'newPatients', label: 'New Patients', format: 'number', higherIsBetter: true },
    { key: 'collectionRate', label: 'Collection Rate', format: 'percent', higherIsBetter: true },
    ...(compact ? [] : [
      { key: 'caseAcceptance', label: 'Case Acceptance', format: 'percent', higherIsBetter: true },
      { key: 'expenses', label: 'Expenses', format: 'currency', higherIsBetter: false },
    ]),
  ];

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-2 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon name="GitCompare" size={15} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <div className="flex items-center gap-1.5 ml-1">
            {sortedYears?.map(year => (
              <span
                key={year}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: getYearColor(year) }}
              >
                {year}
              </span>
            ))}
          </div>
          {isComparisonMode && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              Comparison Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <YearComparisonExportButton
            officeIds={officeIds}
            reportTitle={title}
            compact
          />
          <button
            onClick={resetYears}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            <Icon name="X" size={10} />
            Reset
          </button>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 })?.map((_, i) => (
                <div key={i} className="bg-muted/40 rounded-lg p-3 animate-pulse h-16" />
              ))}
            </div>
          ) : (
            <>
              {/* KPI summary grid */}
              <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
                {topMetrics?.map(metric => (
                  <div key={metric?.key} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">{metric?.label}</p>
                    <div className="space-y-1.5">
                      {sortedYears?.map((year, idx) => {
                        const value = yearKPIMap?.[year]?.[metric?.key] ?? null;
                        const olderYear = sortedYears?.[idx + 1];
                        const olderValue = olderYear !== undefined ? (yearKPIMap?.[olderYear]?.[metric?.key] ?? null) : null;
                        const pct = calcPctChange(value, olderValue);
                        const isPos = pct !== null && pct > 0;
                        const isNeg = pct !== null && pct < 0;
                        const isGood = metric?.higherIsBetter ? isPos : isNeg;
                        const isBad = metric?.higherIsBetter ? isNeg : isPos;

                        return (
                          <div key={year} className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getYearColor(year) }}
                              />
                              <span className="text-xs font-semibold text-foreground truncate">
                                {formatComparisonValue(value, metric?.format)}
                              </span>
                            </div>
                            {pct !== null && (
                              <span className={`text-[9px] font-bold flex-shrink-0 ${isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {pct > 0 ? '+' : ''}{pct}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <p className="text-xs font-medium text-muted-foreground">Monthly trend:</p>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    {CHART_FIELDS?.map(f => (
                      <button
                        key={f?.key}
                        onClick={() => setActiveField(f?.key)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                          activeField === f?.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {f?.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '10px' }} />
                      <YAxis
                        stroke="var(--color-muted-foreground)"
                        style={{ fontSize: '10px' }}
                        tickFormatter={v => activeField === 'new_patients' ? v : `$${(v / 1000)?.toFixed(0)}K`}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {sortedYears?.map(year => (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={year}
                          name={String(year)}
                          stroke={getYearColor(year)}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparison table — only in multi-year mode, not compact */}
              {isComparisonMode && !compact && comparisonRows?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground text-[10px] uppercase">Metric</th>
                        {sortedYears?.map((year, idx) => (
                          <React.Fragment key={year}>
                            <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ color: getYearColor(year) }}>
                              {year}
                            </th>
                            {idx > 0 && (
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground text-[10px] uppercase">
                                vs {sortedYears?.[idx - 1]}
                              </th>
                            )}
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows?.slice(0, 12)?.map((row, i) => (
                        <tr key={row?.key} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-3 py-2 text-foreground font-medium">{row?.label}</td>
                          {sortedYears?.map((year, idx) => {
                            const pct = row?.changes?.[year];
                            const isPos = pct !== null && pct > 0;
                            const isNeg = pct !== null && pct < 0;
                            const isGood = row?.higherIsBetter ? isPos : isNeg;
                            const isBad = row?.higherIsBetter ? isNeg : isPos;
                            return (
                              <React.Fragment key={year}>
                                <td className="px-3 py-2 text-right font-semibold text-foreground">
                                  {formatComparisonValue(row?.values?.[year], row?.format)}
                                </td>
                                {idx > 0 && (
                                  <td className="px-2 py-2 text-center">
                                    {pct !== null ? (
                                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                        isGood ? 'text-emerald-600 bg-emerald-50' : isBad ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40'
                                      }`}>
                                        <Icon name={isPos ? 'TrendingUp' : isNeg ? 'TrendingDown' : 'Minus'} size={8} />
                                        {pct > 0 ? '+' : ''}{pct}%
                                      </span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default YearComparisonPanel;
