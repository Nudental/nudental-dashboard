import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { buildMonthlyComparisonData } from '../../../services/yearComparisonService';

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const CHART_FIELDS = [
  { key: 'production_total', label: 'Production' },
  { key: 'collections_total', label: 'Collections' },
  { key: 'expenses_total', label: 'Expenses' },
  { key: 'new_patients', label: 'New Patients', format: 'number' },
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
            {entry?.value != null
              ? (entry?.name?.includes('Patients') ? entry?.value?.toLocaleString() : fmt(entry?.value))
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * MultiYearRevenueChart — overlays up to 3 years of monthly data on the same chart.
 */
const MultiYearRevenueChart = ({ yearDataMap = {}, selectedYears = [], getYearColor }) => {
  const [activeField, setActiveField] = useState('production_total');
  const [chartType, setChartType] = useState('line');

  const chartData = buildMonthlyComparisonData(yearDataMap, activeField);
  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);
  const isNumberField = CHART_FIELDS?.find(f => f?.key === activeField)?.format === 'number';

  const tickFormatter = isNumberField
    ? (v) => v?.toLocaleString()
    : (v) => `$${(v / 1000)?.toFixed(0)}K`;

  return (
    <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Multi-Year Monthly Trends</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Month-by-month comparison across selected years</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Field selector */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {CHART_FIELDS?.map(f => (
              <button
                key={f?.key}
                onClick={() => setActiveField(f?.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeField === f?.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f?.label}
              </button>
            ))}
          </div>
          {/* Chart type toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-md transition-colors ${chartType === 'line' ? 'bg-card shadow-sm' : 'hover:bg-muted/80'}`}
              title="Line chart"
            >
              <Icon name="TrendingUp" size={13} className={chartType === 'line' ? 'text-foreground' : 'text-muted-foreground'} />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-card shadow-sm' : 'hover:bg-muted/80'}`}
              title="Bar chart"
            >
              <Icon name="BarChart3" size={13} className={chartType === 'bar' ? 'text-foreground' : 'text-muted-foreground'} />
            </button>
          </div>
        </div>
      </div>
      {/* Year legend pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {sortedYears?.map(year => (
          <span
            key={year}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getYearColor(year) }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            {year}
          </span>
        ))}
      </div>
      <div className="w-full h-64 md:h-80">
        {!chartData?.some(d => sortedYears?.some(y => d?.[y] !== null)) ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <Icon name="BarChart3" size={28} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No data for selected years</p>
          </div>
        ) : chartType === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '11px' }} />
              <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '11px' }} tickFormatter={tickFormatter} />
              <Tooltip content={(props) => <CustomTooltip {...props} />} />
              <Legend />
              {sortedYears?.map(year => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  name={String(year)}
                  stroke={getYearColor(year)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: getYearColor(year) }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" style={{ fontSize: '11px' }} />
              <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '11px' }} tickFormatter={tickFormatter} />
              <Tooltip content={(props) => <CustomTooltip {...props} />} />
              <Legend />
              {sortedYears?.map(year => (
                <Bar
                  key={year}
                  dataKey={year}
                  name={String(year)}
                  fill={getYearColor(year)}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default MultiYearRevenueChart;
