import React from 'react';
import Icon from '../../../components/AppIcon';

const NewPatientsSection = ({ newPtGoal, newPtActual, newPtToday, onChange, disabled }) => {
  const plusMinus = (parseInt(newPtActual) || 0) - (parseInt(newPtGoal) || 0);
  const isPositive = plusMinus >= 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="UserPlus" size={18} color="var(--color-primary)" />
        <h3 className="text-sm font-semibold text-foreground">C) New Patients Goal</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly New Patient Goal (#)</label>
          <input
            type="number" inputMode="numeric"
            value={newPtGoal || ''}
            onChange={(e) => onChange?.('new_pt_goal', e?.target?.value)}
            disabled={disabled}
            placeholder="0"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly New Patients Actual (#)</label>
          <input
            type="number" inputMode="numeric"
            value={newPtActual || ''}
            onChange={(e) => onChange?.('new_pt_actual', e?.target?.value)}
            disabled={disabled}
            placeholder="0"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Today's New Patients Actual (#)</label>
          <input
            type="number" inputMode="numeric"
            value={newPtToday || ''}
            onChange={(e) => onChange?.('new_pt_today', e?.target?.value)}
            disabled={disabled}
            placeholder="0"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Plus/Minus Goal (Auto)</label>
          <div className={`h-9 px-3 rounded-md border flex items-center text-sm font-semibold ${
            isPositive ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'
          }`}>
            {isPositive ? '+' : ''}{plusMinus}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPatientsSection;
