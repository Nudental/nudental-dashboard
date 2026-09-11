import React from 'react';
import Icon from '../../../components/AppIcon';

const CollectionRateChart = () => (
  <div className="bg-card rounded-lg border border-border shadow-elevation-2 p-4 md:p-5">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-foreground">Collection Rate by Office</h3>
      <p className="text-xs text-muted-foreground mt-0.5">YTD average — target: 93%</p>
    </div>
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon name="BarChart2" size={22} className="text-muted-foreground" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">No data yet</h4>
      <p className="text-xs text-muted-foreground max-w-xs">
        Submit Daily Entries to see collection rates by office.
      </p>
    </div>
    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span>≥93% (On Target)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>91–93% (Near)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>&lt;91% (Below)</span>
    </div>
  </div>
);

export default CollectionRateChart;
