import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ title, value, change, changeType, icon, iconColor, threshold, subtitle }) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-error';
    return 'text-muted-foreground';
  };

  const getThresholdColor = () => {
    if (!threshold) return 'bg-card';
    if (threshold === 'good') return 'bg-success/10 border-success/20';
    if (threshold === 'warning') return 'bg-warning/10 border-warning/20';
    if (threshold === 'critical') return 'bg-error/10 border-error/20';
    return 'bg-card';
  };

  return (
    <div className={`${getThresholdColor()} border border-border rounded-lg p-4 md:p-6 transition-smooth hover:shadow-elevation-2`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-xs md:text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${iconColor}15` }}>
          <Icon name={icon} size={20} color={iconColor} />
        </div>
      </div>
      {change && (
        <div className="flex items-center gap-2">
          <Icon 
            name={changeType === 'positive' ? 'TrendingUp' : changeType === 'negative' ? 'TrendingDown' : 'Minus'} 
            size={16} 
            color={changeType === 'positive' ? 'var(--color-success)' : changeType === 'negative' ? 'var(--color-error)' : 'var(--color-muted-foreground)'} 
          />
          <span className={`text-xs md:text-sm font-medium ${getChangeColor()}`}>{change}</span>
        </div>
      )}
      {subtitle && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default KPICard;