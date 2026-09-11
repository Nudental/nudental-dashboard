import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import { calcPctChange } from '../../../services/yearComparisonService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useOffice } from '../../../contexts/OfficeContext';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

const fmtCurrency = (v) =>
  v == null || !isFinite(v) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);

const fmtPct = (v) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`;

/**
 * Fetches monthly breakdown for a specific provider across selected years from daily_entries
 */
const fetchProviderMonthlyData = async (providerName, years, officeIds = []) => {
  const result = {};
  await Promise.all(years?.map(async (year) => {
    let query = supabase?.from('daily_entries')?.select('entry_date, production, collection, treatment_presented, treatment_accepted, new_patients, provider_name')?.gte('entry_date', `${year}-01-01`)?.lte('entry_date', `${year}-12-31`);

    if (providerName && providerName !== 'All Providers') {
      query = query?.eq('provider_name', providerName);
    }
    if (officeIds?.length > 0) {
      query = query?.in('office_id', officeIds);
    }

    const { data, error } = await query;
    if (error || !data) { result[year] = []; return; }

    // Aggregate by month
    const monthMap = {};
    for (let m = 1; m <= 12; m++) {
      monthMap[m] = { production: 0, collection: 0, txPresented: 0, txAccepted: 0, newPatients: 0, hasData: false };
    }
    data?.forEach(row => {
      const month = new Date(row.entry_date)?.getMonth() + 1;
      if (monthMap?.[month]) {
        monthMap[month].production += parseFloat(row?.production || 0);
        monthMap[month].collection += parseFloat(row?.collection || 0);
        monthMap[month].txPresented += parseFloat(row?.treatment_presented || 0);
        monthMap[month].txAccepted += parseFloat(row?.treatment_accepted || 0);
        monthMap[month].newPatients += parseInt(row?.new_patients || 0);
        monthMap[month].hasData = true;
      }
    });
    result[year] = monthMap;
  }));
  return result;
};

const ProviderDrillDownModal = ({ isOpen, onClose, providerName, selectedYears = [], getYearColor, officeIds = [] }) => {
  const { offices: accessibleOffices } = useOffice();
  const [monthlyData, setMonthlyData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeMetric, setActiveMetric] = useState('production');
  const [chartType, setChartType] = useState('line');

  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);

  // Use passed officeIds if provided, otherwise fall back to accessible offices from context
  const effectiveOfficeIds = officeIds?.length > 0
    ? officeIds
    : accessibleOffices?.map(o => o?.id) || [];

  const loadData = useCallback(async () => {
    if (!providerName || !selectedYears?.length) return;
    setLoading(true);
    try {
      const data = await fetchProviderMonthlyData(providerName, selectedYears, effectiveOfficeIds);
      setMonthlyData(data);
    } catch (err) {
      console.warn('ProviderDrillDown fetch error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [providerName, selectedYears?.join(','), effectiveOfficeIds?.join(',')]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  // Build chart data: 12 months, each year as a series
  const chartData = MONTH_NAMES?.map((month, idx) => {
    const monthNum = idx + 1;
    const row = { month };
    sortedYears?.forEach(year => {
      const mData = monthlyData?.[year]?.[monthNum];
      if (activeMetric === 'production') row[year] = mData?.hasData ? mData?.production : null;
      else if (activeMetric === 'collection') row[year] = mData?.hasData ? mData?.collection : null;
      else if (activeMetric === 'acceptance') {
        const rate = mData?.txPresented > 0 ? (mData?.txAccepted / mData?.txPresented) * 100 : null;
        row[year] = mData?.hasData ? rate : null;
      }
    });
    return row;
  });

  // Build summary table rows: metric × year × month
  const summaryMetrics = [
    { key: 'production', label: 'Production', format: 'currency' },
    { key: 'collection', label: 'Collections', format: 'currency' },
    { key: 'acceptance', label: 'Acceptance Rate', format: 'percent' },
  ];

  const getMonthValue = (year, monthNum, metric) => {
    const mData = monthlyData?.[year]?.[monthNum];
    if (!mData?.hasData) return null;
    if (metric === 'production') return mData?.production;
    if (metric === 'collection') return mData?.collection;
    if (metric === 'acceptance') return mData?.txPresented > 0 ? (mData?.txAccepted / mData?.txPresented) * 100 : null;
    return null;
  };

  const getYearTotal = (year, metric) => {
    let total = 0;
    let hasAny = false;
    for (let m = 1; m <= 12; m++) {
      const v = getMonthValue(year, m, metric);
      if (v !== null) { total += v; hasAny = true; }
    }
    if (metric === 'acceptance') {
      // Average acceptance rate
      let count = 0;
      let sum = 0;
      for (let m = 1; m <= 12; m++) {
        const v = getMonthValue(year, m, metric);
        if (v !== null) { sum += v; count++; }
      }
      return count > 0 ? sum / count : null;
    }
    return hasAny ? total : null;
  };

  const handleDownloadCSV = () => {
    const lines = [];
    lines?.push(`"Provider Drill-Down: ${providerName}"`);
    lines?.push(`"Years: ${sortedYears?.join(', ')}"`);
    lines?.push(`"Generated: ${new Date()?.toLocaleString()}"`);
    lines?.push('');

    summaryMetrics?.forEach(metric => {
      lines?.push(`"=== ${metric?.label} ==="`);
      const header = ['Month', ...sortedYears?.flatMap((y, i) => {
        const cols = [String(y)];
        if (i > 0) cols?.push(`vs ${sortedYears?.[i - 1]}`);
        return cols;
      })];
      lines?.push(header?.map(h => `"${h}"`)?.join(','));

      MONTH_NAMES?.forEach((month, idx) => {
        const monthNum = idx + 1;
        const cells = [month];
        sortedYears?.forEach((year, yIdx) => {
          const v = getMonthValue(year, monthNum, metric?.key);
          cells?.push(v !== null ? (metric?.format === 'currency' ? fmtCurrency(v) : `${v?.toFixed(1)}%`) : 'N/A');
          if (yIdx > 0) {
            const olderYear = sortedYears?.[yIdx - 1];
            const olderV = getMonthValue(olderYear, monthNum, metric?.key);
            const pct = calcPctChange(v, olderV);
            cells?.push(pct !== null ? fmtPct(pct) : 'N/A');
          }
        });
        lines?.push(cells?.map(c => `"${c}"`)?.join(','));
      });

      // Totals row
      const totalCells = ['TOTAL / AVG'];
      sortedYears?.forEach((year, yIdx) => {
        let total = getYearTotal(year, metric?.key);
        totalCells?.push(total !== null ? (metric?.format === 'currency' ? fmtCurrency(total) : `${total?.toFixed(1)}%`) : 'N/A');
        if (yIdx > 0) {
          const olderYear = sortedYears?.[yIdx - 1];
          const olderTotal = getYearTotal(olderYear, metric?.key);
          const pct = calcPctChange(total, olderTotal);
          totalCells?.push(pct !== null ? fmtPct(pct) : 'N/A');
        }
      });
      lines?.push(totalCells?.map(c => `"${c}"`)?.join(','));
      lines?.push('');
    });

    const csv = lines?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `provider-drilldown-${providerName?.replace(/\s+/g, '-')}-${sortedYears?.join('-')}.csv`;
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const METRIC_TABS = [
    { key: 'production', label: 'Production', icon: 'DollarSign' },
    { key: 'collection', label: 'Collections', icon: 'TrendingUp' },
    { key: 'acceptance', label: 'Acceptance Rate', icon: 'CheckCircle' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="User" size={18} color="#4f46e5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{providerName}</h2>
              <p className="text-xs text-muted-foreground">
                Monthly Drill-Down — {sortedYears?.join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Icon name="Download" size={12} />
              Download CSV
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Metric Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-border flex-shrink-0">
          {METRIC_TABS?.map(tab => (
            <button
              key={tab?.key}
              onClick={() => setActiveMetric(tab?.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeMetric === tab?.key
                  ? 'border-indigo-600 text-indigo-600' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={12} />
              {tab?.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 mb-1">
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-md transition-colors ${chartType === 'line' ? 'bg-indigo-100 text-indigo-600' : 'text-muted-foreground hover:bg-muted'}`}
              title="Line chart"
            >
              <Icon name="TrendingUp" size={13} />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-indigo-100 text-indigo-600' : 'text-muted-foreground hover:bg-muted'}`}
              title="Bar chart"
            >
              <Icon name="BarChart2" size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="Loader2" size={28} className="animate-spin text-indigo-500" />
              <span className="ml-3 text-sm text-muted-foreground">Loading monthly data…</span>
            </div>
          ) : (
            <>
              {/* Chart */}
              <div className="bg-muted/20 rounded-xl border border-border p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {METRIC_TABS?.find(t => t?.key === activeMetric)?.label} — Month by Month
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  {chartType === 'line' ? (
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        tickFormatter={v => activeMetric === 'acceptance' ? `${v?.toFixed(0)}%` : `$${(v / 1000)?.toFixed(0)}k`}
                        width={55}
                      />
                      <Tooltip content={(props) => <CustomDrillDownTooltip {...props} activeMetric={activeMetric} />} cursor={false} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {sortedYears?.map((year, idx) => (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={year}
                          stroke={getYearColor(year)}
                          strokeWidth={2}
                          dot={{ r: 3, fill: getYearColor(year) }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        tickFormatter={v => activeMetric === 'acceptance' ? `${v?.toFixed(0)}%` : `$${(v / 1000)?.toFixed(0)}k`}
                        width={55}
                      />
                      <Tooltip content={(props) => <CustomDrillDownTooltip {...props} activeMetric={activeMetric} />} cursor={false} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {sortedYears?.map((year) => (
                        <Bar key={year} dataKey={year} fill={getYearColor(year)} radius={[3, 3, 0, 0]} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Detail Table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Monthly Detail Table — {METRIC_TABS?.find(t => t?.key === activeMetric)?.label}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] min-w-[80px]">Month</th>
                        {sortedYears?.map((year, idx) => (
                          <React.Fragment key={year}>
                            <th
                              className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide min-w-[100px]"
                              style={{ color: getYearColor(year) }}
                            >
                              {year}
                            </th>
                            {idx > 0 && (
                              <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[70px]">
                                Δ vs {sortedYears?.[idx - 1]}
                              </th>
                            )}
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONTH_NAMES?.map((month, idx) => {
                        const monthNum = idx + 1;
                        return (
                          <tr key={month} className={`border-b border-border/50 hover:bg-muted/20 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                            <td className="px-4 py-2.5 font-medium text-foreground">{month}</td>
                            {sortedYears?.map((year, yIdx) => {
                              const v = getMonthValue(year, monthNum, activeMetric);
                              const olderYear = sortedYears?.[yIdx - 1];
                              const olderV = yIdx > 0 ? getMonthValue(olderYear, monthNum, activeMetric) : null;
                              const pct = yIdx > 0 ? calcPctChange(v, olderV) : null;
                              return (
                                <React.Fragment key={year}>
                                  <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                                    {v !== null
                                      ? activeMetric === 'acceptance' ? `${v?.toFixed(1)}%` : fmtCurrency(v)
                                      : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  {yIdx > 0 && (
                                    <td className="px-2 py-2.5 text-center">
                                      {pct !== null ? (
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          pct > 0 ? 'text-emerald-600 bg-emerald-50' : pct < 0 ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40'
                                        }`}>
                                          <Icon name={pct > 0 ? 'TrendingUp' : pct < 0 ? 'TrendingDown' : 'Minus'} size={9} />
                                          {pct > 0 ? '+' : ''}{pct}%
                                        </span>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </td>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="border-t-2 border-border bg-muted/30 font-bold">
                        <td className="px-4 py-3 text-foreground text-xs font-bold">
                          {activeMetric === 'acceptance' ? 'Avg Rate' : 'Total'}
                        </td>
                        {sortedYears?.map((year, yIdx) => {
                          let total = getYearTotal(year, activeMetric);
                          const olderYear = sortedYears?.[yIdx - 1];
                          const olderTotal = yIdx > 0 ? getYearTotal(olderYear, activeMetric) : null;
                          const pct = yIdx > 0 ? calcPctChange(total, olderTotal) : null;
                          return (
                            <React.Fragment key={year}>
                              <td className="px-3 py-3 text-right font-bold text-foreground">
                                {total !== null
                                  ? activeMetric === 'acceptance' ? `${total?.toFixed(1)}%` : fmtCurrency(total)
                                  : '—'}
                              </td>
                              {yIdx > 0 && (
                                <td className="px-2 py-3 text-center">
                                  {pct !== null ? (
                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      pct > 0 ? 'text-emerald-600 bg-emerald-50' : pct < 0 ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40'
                                    }`}>
                                      <Icon name={pct > 0 ? 'TrendingUp' : pct < 0 ? 'TrendingDown' : 'Minus'} size={9} />
                                      {pct > 0 ? '+' : ''}{pct}%
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CustomDrillDownTooltip = ({ active, payload, label, activeMetric }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload?.map(entry => (
        <div key={entry?.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry?.color }} />
          <span className="text-muted-foreground">{entry?.dataKey}:</span>
          <span className="font-semibold text-foreground">
            {activeMetric === 'acceptance'
              ? `${entry?.value?.toFixed(1)}%`
              : fmtCurrency(entry?.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ProviderDrillDownModal;
