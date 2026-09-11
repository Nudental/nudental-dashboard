import React, { useState } from 'react';
import { Info, Maximize2 } from 'lucide-react';

const MetricKpiCard = ({ label, value, tooltip, loading }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-3/4 mb-2" />
        <div className="h-6 bg-muted rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 relative group hover:shadow-md transition-shadow">
      {/* Top-right icons */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-0.5 text-muted-foreground hover:text-foreground rounded"
            aria-label="Info"
          >
            <Info size={12} />
          </button>
          {showTooltip && tooltip && (
            <div className="absolute right-0 top-5 z-50 bg-popover text-popover-foreground text-xs rounded px-2 py-1 w-48 shadow-lg border border-border">
              {tooltip}
            </div>
          )}
        </div>
        <button className="p-0.5 text-muted-foreground hover:text-foreground rounded" aria-label="Expand">
          <Maximize2 size={12} />
        </button>
      </div>

      {/* Metric name */}
      <p className="text-xs text-muted-foreground font-medium leading-tight pr-8 mb-1">{label}</p>

      {/* Value */}
      <p className="text-lg font-bold text-foreground leading-tight">
        {value !== null && value !== undefined ? value : '—'}
      </p>
    </div>
  );
};

export default MetricKpiCard;
