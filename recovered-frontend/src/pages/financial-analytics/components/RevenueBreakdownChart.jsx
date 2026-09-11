import React from 'react';
import Icon from '../../../components/AppIcon';

const RevenueBreakdownChart = () => {
  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="BarChart2" size={16} color="var(--color-primary)" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Revenue Breakdown</h3>
          <p className="text-xs text-muted-foreground">Production vs Collections by category</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-48 gap-3 bg-amber-50 border border-amber-200 rounded-lg p-6">
        <Icon name="AlertTriangle" size={24} color="#d97706" />
        <p className="text-sm text-amber-800 text-center font-medium">
          This section is temporarily disabled because service-category revenue breakdown is not yet mapped to verified Dentrix Ascend live data.
        </p>
      </div>
    </div>
  );
};

export default RevenueBreakdownChart;
