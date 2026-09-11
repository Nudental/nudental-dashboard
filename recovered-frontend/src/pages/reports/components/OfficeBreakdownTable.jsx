import React from 'react';
import Icon from '../../../components/AppIcon';

const OfficeBreakdownTable = ({ officeFilter }) => {
  return (
    <div className="bg-card rounded-lg border border-border shadow-elevation-2">
      <div className="p-4 md:p-5 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Office-Level Profit &amp; Expense Breakdown</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Expand each office to view granular category details</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon name="Building2" size={28} className="text-muted-foreground" />
        </div>
        <h4 className="text-base font-semibold text-foreground mb-2">No data yet</h4>
        <p className="text-sm text-muted-foreground max-w-xs">
          Submit Daily Entries to see the office-level profit and expense breakdown here.
        </p>
      </div>
    </div>
  );
};

export default OfficeBreakdownTable;
