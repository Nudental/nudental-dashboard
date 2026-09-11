import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Icon from '../../../components/AppIcon';

const RevenueTrendsChart = ({ data, chartType, goalData = null }) => {
  // goalData: { dailyTarget, paceTarget, daysInMonth, currentDay }
  const dailyTarget = goalData?.dailyTarget || 0;

  const CustomTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-3">
          <p className="text-sm font-medium text-popover-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <p key={index} className="text-xs text-muted-foreground">
              <span style={{ color: entry?.color }}>{entry?.name}:</span> ${entry?.value?.toLocaleString()}
            </p>
          ))}
          {dailyTarget > 0 && (
            <p className="text-xs text-muted-foreground mt-1 border-t border-border pt-1">
              <span style={{ color: '#f59e0b' }}>Daily Target:</span> ${dailyTarget?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Build cumulative pace data for the line chart
  const enrichedData = data?.map((item, index) => ({
    ...item,
    dailyTarget: dailyTarget > 0 ? Math.round(dailyTarget) : undefined,
    paceTarget: dailyTarget > 0 ? Math.round(dailyTarget * (index + 1)) : undefined,
  }));

  return (
    <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Revenue Trends Chart">
      {!data?.length ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="TrendingUp" size={28} className="text-muted-foreground" />
          </div>
          <h4 className="text-base font-semibold text-foreground mb-2">No data yet</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            No Dentrix data available for this date range and office.
          </p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'line' ? (
          <LineChart data={enrichedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip content={(props) => <CustomTooltipContent {...props} />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="collections" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Collections" />
            <Line type="monotone" dataKey="production" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Production" />
            {dailyTarget > 0 && (
              <>
                <Line
                  type="monotone"
                  dataKey="dailyTarget"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Daily Target"
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="paceTarget"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Pace Line"
                  activeDot={false}
                />
              </>
            )}
          </LineChart>
        ) : (
          <BarChart data={enrichedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <YAxis stroke="var(--color-muted-foreground)" style={{ fontSize: '12px' }} />
            <Tooltip content={(props) => <CustomTooltipContent {...props} />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="collections" fill="var(--color-primary)" name="Collections" />
            <Bar dataKey="production" fill="var(--color-accent)" name="Production" />
            {dailyTarget > 0 && (
              <ReferenceLine
                y={dailyTarget}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: 'Daily Target', position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }}
              />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
      )}
    </div>
  );
};

export default RevenueTrendsChart;