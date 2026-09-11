import React from 'react';
import Icon from '../../../components/AppIcon';

const ActivityFeed = ({ activities }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'transaction':
        return 'DollarSign';
      case 'approval':
        return 'CheckCircle';
      case 'alert':
        return 'AlertTriangle';
      case 'update':
        return 'RefreshCw';
      default:
        return 'Activity';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'transaction':
        return 'var(--color-primary)';
      case 'approval':
        return 'var(--color-success)';
      case 'alert':
        return 'var(--color-warning)';
      case 'update':
        return 'var(--color-accent)';
      default:
        return 'var(--color-muted-foreground)';
    }
  };

  const getSeverityBadge = (severity) => {
    const severityStyles = {
      high: 'bg-error/10 text-error border-error/20',
      medium: 'bg-warning/10 text-warning border-warning/20',
      low: 'bg-success/10 text-success border-success/20'
    };

    return (
      <span className={`text-xs px-2 py-1 rounded border ${severityStyles?.[severity] || severityStyles?.low}`}>
        {severity?.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold text-foreground">Activity Feed</h3>
        <Icon name="Activity" size={20} color="var(--color-primary)" />
      </div>
      <div className="space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto">
        {!activities?.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="Activity" size={28} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : activities?.map((activity) => (
          <div key={activity?.id} className="flex gap-3 pb-4 border-b border-border last:border-b-0 last:pb-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getActivityColor(activity?.type)}15` }}>
              <Icon name={getActivityIcon(activity?.type)} size={16} color={getActivityColor(activity?.type)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground">{activity?.title}</p>
                {activity?.severity && getSeverityBadge(activity?.severity)}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{activity?.description}</p>
              <p className="text-xs text-muted-foreground">{activity?.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;