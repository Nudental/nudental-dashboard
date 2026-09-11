import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { getAllOfficesGoalStatus } from '../../../services/goalsService';

const STATUS_CONFIG = {
  Ahead: { icon: 'TrendingUp', color: '#22c55e', bg: '#22c55e20', label: 'Ahead' },
  'On Track': { icon: 'CheckCircle', color: '#3b82f6', bg: '#3b82f620', label: 'On Track' },
  Behind: { icon: 'TrendingDown', color: '#ef4444', bg: '#ef444420', label: 'Behind' },
  'No Goal': { icon: 'Minus', color: '#6b7280', bg: '#6b728020', label: 'No Goal' },
};

const OfficeGoalStatusBadge = ({ offices = [] }) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!offices?.length) {
      setLoading(false);
      return;
    }
    loadStatuses();
  }, [offices]);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const results = await getAllOfficesGoalStatus(offices);
      setStatuses(results);
    } catch (err) {
      console.error('Failed to load goal statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Target" size={16} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">Goal Status — All Offices</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!statuses?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Target" size={16} color="var(--color-primary)" />
        <h3 className="text-sm font-semibold text-foreground">Goal Status — All Offices</h3>
        <span className="ml-auto text-xs text-muted-foreground">Current Month</span>
      </div>
      <div className="space-y-2">
        {statuses?.map(office => {
          const config = STATUS_CONFIG?.[office?.status] || STATUS_CONFIG?.['No Goal'];
          return (
            <div
              key={office?.officeId}
              className="flex items-center justify-between gap-3 p-2 rounded-lg"
              style={{ backgroundColor: config?.bg }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="Building2" size={14} color={config?.color} />
                <span className="text-xs font-medium text-foreground truncate">{office?.officeName}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {office?.target > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {office?.percentage}%
                  </span>
                )}
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ color: config?.color }}
                >
                  <Icon name={config?.icon} size={12} />
                  {config?.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OfficeGoalStatusBadge;
