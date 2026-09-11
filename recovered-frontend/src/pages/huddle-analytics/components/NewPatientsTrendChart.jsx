import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const NewPatientsTrendChart = ({ data }) => {
  const chartData = data?.map(h => ({
    date: new Date(h?.huddle_date + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    newPatients: parseInt(h?.new_pt_today) || 0,
    goal: parseInt(h?.new_pt_goal) || 0,
  })) || [];

  const avgNewPts = chartData?.length > 0
    ? Math.round(chartData?.reduce((s, d) => s + d?.newPatients, 0) / chartData?.length)
    : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-2 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        <p className="text-primary">New Patients: {payload?.[0]?.value}</p>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-foreground">New Patients Today — Trend</h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Avg: {avgNewPts}/day</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Daily new patient count over selected period</p>
      {chartData?.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
            <Tooltip content={<CustomTooltip label="" show={false} />} />
            {avgNewPts > 0 && (
              <ReferenceLine y={avgNewPts} stroke="var(--color-warning)" strokeDasharray="4 4" label={{ value: 'Avg', position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
            )}
            <Line
              type="monotone"
              dataKey="newPatients"
              name="New Patients"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'var(--color-primary)' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default NewPatientsTrendChart;
