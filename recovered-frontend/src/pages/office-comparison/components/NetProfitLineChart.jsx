import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import Icon from '../../../components/AppIcon';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `$${(value / 1000000)?.toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000)?.toFixed(0)}K`;
  if (value <= -1000000) return `-$${(Math.abs(value) / 1000000)?.toFixed(1)}M`;
  if (value <= -1000) return `-$${(Math.abs(value) / 1000)?.toFixed(0)}K`;
  return `$${value?.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label, lineKey }) => {
  if (!active || !payload?.length) return null;
  const val = payload?.[0]?.value;
  const key = payload?.[0]?.dataKey;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-elevation-2 p-3 min-w-[180px]">
      <p className="font-semibold text-sm text-popover-foreground mb-2">{label}</p>
      <div className="flex justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Net Profit</span>
        <span className={`font-semibold ${val !== null && val !== undefined ? (val >= 0 ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
          {val !== null && val !== undefined ? formatCurrency(val) : '—'}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">{key} · Collections − Expenses</p>
    </div>
  );
};

const NetProfitLineChart = ({ data, lineKey = 'All Offices', loading }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  const chartData = (data || [])?.map(d => ({
    ...d,
    [lineKey]: d?.[lineKey] !== null && d?.[lineKey] !== undefined ? d?.[lineKey] : undefined,
  }));

  const hasAnyData = chartData?.some(d => d?.[lineKey] !== undefined);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="TrendingUp" size={18} color="var(--color-success)" />
        <h3 className="font-semibold text-foreground">Monthly Net Profit Trend</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {lineKey} net profit per month — Dentrix/FastAPI collections minus Finance Expense Report office-scoped expenses
      </p>

      {!hasAnyData ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          <Icon name="TrendingUp" size={32} className="mr-2 opacity-30" />
          No data available for selected period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 2" />
            <Tooltip content={<CustomTooltip lineKey={lineKey} />} />
            <Line
              type="monotone"
              dataKey={lineKey}
              name={`${lineKey} Net Profit`}
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default NetProfitLineChart;
