import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const DonutGauge = ({ title, icon, pct, color }) => {
  const data = [
    { name: 'Completed', value: pct },
    { name: 'Remaining', value: 100 - pct },
  ];
  const COLORS = [color, 'var(--color-border)'];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={58}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              {data?.map((entry, index) => (
                <Cell key={index} fill={COLORS?.[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{pct}%</span>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground mt-2">{icon} {title}</p>
      <p className="text-xs text-muted-foreground">Completion Rate</p>
    </div>
  );
};

const ChecklistCompletionChart = ({ data }) => {
  let frontDeskCompleted = 0, frontDeskTotal = 0;
  let backOfficeCompleted = 0, backOfficeTotal = 0;

  data?.forEach(h => {
    h?.huddle_checklist_items?.forEach(item => {
      if (item?.section === 'front_desk') {
        frontDeskTotal++;
        if (item?.completed) frontDeskCompleted++;
      } else if (item?.section === 'back_office') {
        backOfficeTotal++;
        if (item?.completed) backOfficeCompleted++;
      }
    });
  });

  const fdPct = frontDeskTotal > 0 ? Math.round((frontDeskCompleted / frontDeskTotal) * 100) : 0;
  const boPct = backOfficeTotal > 0 ? Math.round((backOfficeCompleted / backOfficeTotal) * 100) : 0;

  const getColor = (pct) => pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-destructive)';

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground mb-1">Checklist Completion Rate</h3>
      <p className="text-xs text-muted-foreground mb-5">Average completion across selected period</p>
      <div className="flex items-center justify-around">
        <DonutGauge title="Front Desk" icon="🖥️" pct={fdPct} color={getColor(fdPct)} />
        <div className="w-px h-24 bg-border" />
        <DonutGauge title="Back Office" icon="🦷" pct={boPct} color={getColor(boPct)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Front Desk</p>
          <p className="text-sm font-semibold text-foreground">{frontDeskCompleted}/{frontDeskTotal} items</p>
        </div>
        <div className="text-center p-2 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Back Office</p>
          <p className="text-sm font-semibold text-foreground">{backOfficeCompleted}/{backOfficeTotal} items</p>
        </div>
      </div>
    </div>
  );
};

export default ChecklistCompletionChart;
