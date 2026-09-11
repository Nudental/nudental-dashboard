import React, { useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';

const RevenueChart = ({ data, onOfficeClick, scheduledProductionData }) => {
  const [selectedMetric, setSelectedMetric] = useState('all');

  const metrics = [
    { value: 'all', label: 'All Metrics', icon: 'BarChart3' },
    { value: 'revenue', label: 'Revenue Only', icon: 'DollarSign' },
    { value: 'collection', label: 'Collection Rate', icon: 'TrendingUp' },
    { value: 'scheduled', label: 'Scheduled vs Actual', icon: 'CalendarCheck' },
  ];

  // Merge scheduled production data into chart data
  const mergedData = data?.map((d, i) => ({
    ...d,
    scheduledProduction: scheduledProductionData?.[i]?.scheduledProduction || null,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-3">
          <p className="text-sm font-medium text-popover-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span style={{ color: entry?.color }}>{entry?.name}:</span>
              <span className="font-medium text-popover-foreground">
                {entry?.name === 'Collection Rate'
                  ? `${entry?.value?.toFixed(1)}%`
                  : entry?.value != null ? `$${entry?.value?.toLocaleString('en-US')}` : 'N/A'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-foreground">Revenue & Collection Trends</h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Monthly performance analysis across all locations</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {metrics?.map((metric) => (
            <button
              key={metric?.value}
              onClick={() => setSelectedMetric(metric?.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-smooth flex-shrink-0 ${
                selectedMetric === metric?.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={metric?.icon} size={14} />
              <span className="whitespace-nowrap">{metric?.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Revenue and Collection Rate Trends Chart">
        {!mergedData?.length ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Icon name="BarChart3" size={28} className="text-muted-foreground" />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-2">No data yet</h4>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start by submitting an EOD Report to see your revenue trends here.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${(value / 1000)?.toFixed(0)}K`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip label="" show={false} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              {(selectedMetric === 'all' || selectedMetric === 'revenue') && (
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="Total Revenue"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => onOfficeClick && onOfficeClick(data)}
                  style={{ cursor: 'pointer' }}
                />
              )}
              {(selectedMetric === 'all' || selectedMetric === 'collection') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="collectionRate"
                  name="Collection Rate"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-accent)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              {(selectedMetric === 'all' || selectedMetric === 'scheduled') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="scheduledProduction"
                  name="Scheduled Production"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ fill: '#f59e0b', r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;