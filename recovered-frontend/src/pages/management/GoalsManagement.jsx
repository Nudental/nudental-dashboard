import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Icon from '../../components/AppIcon';
import { officesService } from '../../services/managementService';
import { officeGoalsService, getCollectionGoalValue } from '../../services/goalsService';

const GoalsManagement = () => {
  const [offices, setOffices] = useState([]);
  const [goals, setGoals] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Generate month options (current month + 11 future months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d?.setMonth(d?.getMonth() + i);
    return format(d, 'yyyy-MM');
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [officeList, goalList] = await Promise.all([
        officesService?.getAll(),
        officeGoalsService?.getAll(selectedMonth),
      ]);
      setOffices(officeList?.filter(o => o?.is_active));
      // Build a map: officeId -> goal record
      const goalMap = {};
      goalList?.forEach(g => {
        goalMap[g?.office_id] = g;
      });
      setGoals(goalMap);
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetChange = (officeId, value) => {
    setGoals(prev => ({
      ...prev,
      [officeId]: {
        ...(prev?.[officeId] || {}),
        monthly_target: value,
        production_goal: value,
        _dirty: true,
      },
    }));
  };

  const handleSave = async (officeId) => {
    const goalData = goals?.[officeId];
    const targetValue = parseFloat(goalData?.monthly_target ?? goalData?.production_goal);
    if (isNaN(targetValue) || targetValue < 0) {
      setError('Please enter a valid positive number for the target.');
      return;
    }
    setSaving(prev => ({ ...prev, [officeId]: true }));
    setError(null);
    try {
      // Pass office name so audit change_summary shows human-readable name instead of UUID
      const officeName = offices?.find(o => o?.id === officeId)?.name;
      const saved = await officeGoalsService?.upsert(officeId, selectedMonth, targetValue, officeName);
      setGoals(prev => ({
        ...prev,
        [officeId]: { ...saved, _dirty: false },
      }));
      setSuccessMsg('Goal saved! Collection goal auto-calculated as 95% of previous month\'s production goal.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err?.message || 'Failed to save goal');
    } finally {
      setSaving(prev => ({ ...prev, [officeId]: false }));
    }
  };

  const formatMonthLabel = (monthYear) => {
    const [year, month] = monthYear?.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(d, 'MMMM yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon name="Calendar" size={18} color="var(--color-primary)" />
            <span className="text-sm font-medium text-foreground">Select Month:</span>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e?.target?.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {monthOptions?.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Set monthly production goals for each office
          </span>
        </div>
      </div>
      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
          <Icon name="CheckCircle" size={16} color="var(--color-success)" />
          <span className="text-sm text-success">{successMsg}</span>
        </div>
      )}
      {/* Goals Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      ) : offices?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="Building2" size={40} className="mx-auto mb-3 opacity-40" />
          <p>No active offices found.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Monthly Production Goals — {formatMonthLabel(selectedMonth)}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {offices?.map(office => {
              const goal = goals?.[office?.id];
              const currentTarget = goal?.production_goal ?? goal?.monthly_target ?? '';
              const collGoal = getCollectionGoalValue(goal);
              const isDirty = goal?._dirty;
              const isSaving = saving?.[office?.id];

              return (
                <div key={office?.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="Building2" size={16} color="var(--color-primary)" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{office?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{office?.address || 'No address'}</p>
                      {collGoal > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Collection Goal: ${collGoal?.toLocaleString('en-US', { maximumFractionDigits: 2 })} (95% of prev month)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={currentTarget}
                        onChange={e => handleTargetChange(office?.id, e?.target?.value)}
                        placeholder="Enter production goal"
                        className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <button
                      onClick={() => handleSave(office?.id)}
                      disabled={isSaving || !isDirty}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isDirty && !isSaving
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <Icon name="Save" size={14} />
                      )}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>

                    {/* Status indicator */}
                    {goal?.id && !isDirty && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <Icon name="CheckCircle" size={14} color="var(--color-success)" />
                        Saved
                      </span>
                    )}
                    {!goal?.id && !isDirty && (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
        <Icon name="Info" size={16} color="var(--color-muted-foreground)" className="mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Set the <strong>production goal</strong> for each office. The <strong>collection goal</strong> is automatically calculated as 95% of the previous month's production goal per office. Both goals are used across all dashboards, charts, and KPI cards.
        </p>
      </div>
    </div>
  );
};

export default GoalsManagement;
