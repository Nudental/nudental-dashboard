import React from 'react';
import Icon from '../../../components/AppIcon';

const CollectionsGoalSection = ({ collectionsGoal, collectionsActual, onChange, disabled }) => {
  const plusMinus = (parseFloat(collectionsActual) || 0) - (parseFloat(collectionsGoal) || 0);
  const isPositive = plusMinus >= 0;

  const formatCurrency = (val) => {
    const n = parseFloat(val) || 0;
    return n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="DollarSign" size={18} color="var(--color-primary)" />
        <h3 className="text-sm font-semibold text-foreground">B) Collections Goal</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly Collections Goal</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number" inputMode="decimal"
              value={collectionsGoal || ''}
              onChange={(e) => onChange?.('collections_goal', e?.target?.value)}
              disabled={disabled}
              placeholder="0"
              className="w-full h-9 pl-6 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly Collections Actual</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number" inputMode="decimal"
              value={collectionsActual || ''}
              onChange={(e) => onChange?.('collections_actual', e?.target?.value)}
              disabled={disabled}
              placeholder="0"
              className="w-full h-9 pl-6 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Plus/Minus Goal (Auto)</label>
        <div className={`h-9 px-3 rounded-md border flex items-center text-sm font-semibold ${
          isPositive ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'
        }`}>
          {isPositive ? '+' : ''}{formatCurrency(plusMinus)}
        </div>
      </div>
    </div>
  );
};

export default CollectionsGoalSection;
