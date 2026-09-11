import React from 'react';
import Icon from '../../../components/AppIcon';

const RevenueExpenseChart = () => {
  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-2 p-4 md:p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Revenue &amp; Expense Trends</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly performance overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'revenue', label: 'Revenue', color: '#3b82f6' },
            { key: 'expenses', label: 'Expenses', color: '#ef4444' },
            { key: 'profit', label: 'Net Profit', color: '#22c55e' },
          ]?.map(item => (
            <div
              key={item?.key}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-transparent"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item?.color }} />
              {item?.label}
            </div>
          ))}
        </div>
      </div>
      <div className="h-64 md:h-80 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon name="TrendingUp" size={28} className="text-muted-foreground" />
        </div>
        <h4 className="text-base font-semibold text-foreground mb-2">No data yet</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          Submit Daily Entries to see revenue and expense trends here.
        </p>
      </div>
    </div>
  );
};

export default RevenueExpenseChart;
