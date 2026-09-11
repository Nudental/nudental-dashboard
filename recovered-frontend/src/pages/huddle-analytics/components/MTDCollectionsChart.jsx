import React from 'react';

const MTDCollectionsChart = ({ data }) => {
  const officeMap = {};
  data?.forEach(h => {
    const key = h?.office_id;
    if (!officeMap?.[key]) {
      officeMap[key] = { name: h?.offices?.name || 'Office', goal: 0, actual: 0, count: 0 };
    }
    officeMap[key].goal = Math.max(officeMap?.[key]?.goal, parseFloat(h?.collections_goal) || 0);
    officeMap[key].actual += parseFloat(h?.collections_actual) || 0;
    officeMap[key].count++;
  });

  const offices = Object.values(officeMap);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground mb-1">MTD Collections: Actual vs Goal</h3>
      <p className="text-xs text-muted-foreground mb-4">Month-to-date performance per office</p>
      {offices?.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No data available</div>
      ) : (
        <div className="space-y-4">
          {offices?.map((office, idx) => {
            const pct = office?.goal > 0 ? Math.min(100, Math.round((office?.actual / office?.goal) * 100)) : 0;
            const isAhead = pct >= 100;
            const isOnTrack = pct >= 70;
            const barColor = isAhead ? 'bg-success' : isOnTrack ? 'bg-warning' : 'bg-destructive';
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{office?.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      ${(office?.actual || 0)?.toLocaleString()} / ${(office?.goal || 0)?.toLocaleString()}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isAhead ? 'bg-success/10 text-success' : isOnTrack ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isAhead ? '✅ Ahead of goal' : isOnTrack ? '⚠️ On track' : '🔴 Behind goal'}
                  </span>
                  {office?.goal > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Remaining: ${Math.max(0, office?.goal - office?.actual)?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MTDCollectionsChart;
