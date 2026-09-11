import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ScheduledVsGoalChart = ({ data }) => {
  const chartData = data?.map(h => {
    const scheduledTotal = h?.huddle_provider_blocks?.reduce((sum, b) => sum + (parseFloat(b?.scheduled_today) || 0), 0);
    const goalTotal = h?.huddle_provider_blocks?.reduce((sum, b) => sum + (parseFloat(b?.daily_goal) || 0), 0);
    return {
      date: new Date(h?.huddle_date + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      scheduled: scheduledTotal,
      goal: goalTotal,
      variance: scheduledTotal - goalTotal,
    };
  }) || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-elevation-2 text-xs">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload?.map((p, i) => (
          <p key={i} style={{ color: p?.color }}>
            {p?.name}: ${(p?.value || 0)?.toLocaleString()}
          </p>
        ))}
        {payload?.[0] && payload?.[1] && (
          <p className={`mt-1 font-medium ${(payload?.[0]?.value - payload?.[1]?.value) >= 0 ? 'text-success' : 'text-destructive'}`}>
            Variance: ${((payload?.[0]?.value || 0) - (payload?.[1]?.value || 0))?.toLocaleString()}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground mb-1">Scheduled Today vs Daily Adjusted Goal</h3>
      <p className="text-xs text-muted-foreground mb-4">Summed across all 3 provider blocks</p>
      {chartData?.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
            <Tooltip content={<CustomTooltip label="" show={false} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="scheduled" name="Scheduled Today" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="goal" name="Daily Adjusted Goal" fill="var(--color-muted-foreground)" radius={[4, 4, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ScheduledVsGoalChart;
