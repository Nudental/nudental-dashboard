import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import { getGoalAchievement } from '../../../services/goalsService';

const getGoalColor = (percentage) => {
  if (percentage <= 30) return '#ef4444'; // Red
  if (percentage <= 70) return '#f59e0b'; // Yellow/Orange
  return '#22c55e'; // Bright Green
};

const getGoalLabel = (percentage) => {
  if (percentage <= 30) return { text: 'Needs Attention', color: '#ef4444' };
  if (percentage <= 70) return { text: 'In Progress', color: '#f59e0b' };
  return { text: 'On Track', color: '#22c55e' };
};

const GoalDonutChart = ({ officeId, officeName = '', monthYear = null, refreshKey = 0 }) => {
  const [achievement, setAchievement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!officeId) {
      setLoading(false);
      return;
    }
    loadAchievement();
  }, [officeId, monthYear, refreshKey]);

  const loadAchievement = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGoalAchievement(officeId, monthYear);
      setAchievement(data);
    } catch (err) {
      setError(err?.message || 'Failed to load goal data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-center min-h-[220px]">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[220px] gap-2">
        <Icon name="AlertCircle" size={24} color="var(--color-destructive)" />
        <p className="text-sm text-muted-foreground">Unable to load goal data</p>
      </div>
    );
  }

  if (!achievement) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[220px] gap-2">
        <Icon name="Target" size={32} color="var(--color-muted-foreground)" />
        <p className="text-sm font-medium text-foreground">No Goal Set</p>
        <p className="text-xs text-muted-foreground text-center">
          {officeName ? `No monthly target set for ${officeName}` : 'No monthly target configured for this month'}
        </p>
      </div>
    );
  }

  // A real production_goal of $0 is a valid goal record — distinguish from missing/null
  if (achievement?.target === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[220px] gap-2">
        <Icon name="Target" size={32} color="var(--color-muted-foreground)" />
        <p className="text-sm font-medium text-foreground">$0 Production Goal</p>
        <p className="text-xs text-muted-foreground text-center">
          {officeName ? `Production goal for ${officeName} is set to $0` : 'Production goal is set to $0 for this month'}
        </p>
      </div>
    );
  }

  const { collected, target, collectionGoal } = achievement;

  // ── Collection progress: collected ÷ collectionGoal (95% of prior month production_goal)
  // MUST NOT use production_goal (target) as the collection denominator.
  // collectionGoal = collections_goal from office_goals (stored as 95% of prior month production_goal)
  // If collectionGoal is null (no prior month goal exists), show N/A state for collection progress.
  const hasCollectionGoal = collectionGoal !== null && collectionGoal !== undefined && collectionGoal > 0;
  const collectionPercentage = hasCollectionGoal
    ? Math.min(Math.round((collected / collectionGoal) * 100), 100)
    : 0;
  const collectionRemaining = hasCollectionGoal ? Math.max(collectionGoal - collected, 0) : null;

  // Use collection percentage for donut color/label when collection goal exists
  const displayPercentage = hasCollectionGoal ? collectionPercentage : 0;
  const goalColor = getGoalColor(displayPercentage);
  const goalLabel = getGoalLabel(displayPercentage);

  const chartData = [
    { name: 'Collected', value: displayPercentage },
    { name: 'Remaining', value: Math.max(100 - displayPercentage, 0) },
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-2 shadow-elevation-3">
          <p className="text-xs font-medium text-popover-foreground">
            {payload?.[0]?.name}: {payload?.[0]?.value?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Target" size={18} color="var(--color-primary)" />
        <h3 className="text-base font-semibold text-foreground">
          {officeName ? `${officeName} — ` : ''}Monthly Goal Achievement
        </h3>
        {hasCollectionGoal && (
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${goalColor}20`, color: goalColor }}
          >
            {goalLabel?.text}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart — shows collection progress vs collection goal */}
        <div className="relative w-44 h-44 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={hasCollectionGoal ? goalColor : 'var(--color-muted)'} />
                <Cell fill="var(--color-muted)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hasCollectionGoal ? (
              <>
                <span className="text-2xl font-bold" style={{ color: goalColor }}>
                  {collectionPercentage}%
                </span>
                <span className="text-xs text-muted-foreground">of coll. goal</span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-muted-foreground">N/A</span>
                <span className="text-xs text-muted-foreground">no coll. goal</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3 w-full">
          {/* Collected */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Collected</span>
            <span className="text-sm font-semibold text-foreground">
              ${collected?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Collection Goal — primary denominator for collection progress */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Collection Goal</span>
            <span className="text-sm font-semibold text-foreground">
              {hasCollectionGoal
                ? `$${collectionGoal?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : <span className="text-muted-foreground">N/A</span>}
            </span>
          </div>

          {/* Production Goal — informational only, not used as collection denominator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Production Goal</span>
            <span className="text-sm font-semibold text-foreground">
              {target === 0 ? '$0 Production Goal' : `${target?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </span>
          </div>

          <div className="h-px bg-border"></div>

          {/* Remaining to Collection Goal */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Remaining to Coll. Goal</span>
            <span className="text-sm font-bold" style={{ color: collectionRemaining != null && collectionRemaining > 0 ? '#f59e0b' : '#22c55e' }}>
              {collectionRemaining != null
                ? `$${collectionRemaining?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : '—'}
            </span>
          </div>

          {/* Progress bar — collection progress vs collection goal */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${hasCollectionGoal ? collectionPercentage : 0}%`,
                backgroundColor: hasCollectionGoal ? goalColor : 'var(--color-muted-foreground)',
              }}
            />
          </div>
          {!hasCollectionGoal && (
            <p className="text-xs text-muted-foreground">Collection goal requires prior month production goal to be set.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalDonutChart;
