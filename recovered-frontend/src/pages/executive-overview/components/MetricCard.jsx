import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricCard = ({ 
  title, 
  value, 
  trend, 
  trendValue, 
  icon, 
  iconColor,
  format = 'currency'
}) => {
  const safeValue = value ?? 0;

  const formatValue = (val) => {
    const n = typeof val === 'number' && isFinite(val) ? val : 0;
    if (format === 'currency') {
      return `$${n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (format === 'percentage') {
      return `${n?.toFixed(1)}%`;
    }
    return n?.toLocaleString('en-US');
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-error';
    return 'text-muted-foreground';
  };

  const getTrendIcon = () => {
    if (trend === 'up') return 'TrendingUp';
    if (trend === 'down') return 'TrendingDown';
    return 'Minus';
  };

  // trendValue can be a number, a string like "85.2% rate", or null
  const renderTrendValue = () => {
    if (trendValue === null || trendValue === undefined) return null;
    if (typeof trendValue === 'string') return trendValue;
    if (typeof trendValue === 'number' && isFinite(trendValue)) {
      return `${trendValue > 0 ? '+' : ''}${trendValue?.toFixed(1)}%`;
    }
    return null;
  };

  const trendDisplay = renderTrendValue();

  return (
    <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border transition-smooth hover:shadow-elevation-3">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">{title}</p>
          <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground truncate">
            {formatValue(safeValue)}
          </h3>
        </div>
        <div 
          className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Icon name={icon} size={20} color={iconColor} />
        </div>
      </div>
      <div className={`flex items-center gap-1 ${getTrendColor()}`}>
        <Icon name={getTrendIcon()} size={14} />
        {trendDisplay ? (
          <span className="text-xs md:text-sm font-medium whitespace-nowrap">
            {trendDisplay}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No trend data</span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;