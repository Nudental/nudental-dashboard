import React from 'react';
import Icon from '../../../components/AppIcon';

const PreviousOpenDay = ({ prevDayWrong, prevDayRight, onChange, disabled }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="History" size={18} color="var(--color-primary)" />
        <h3 className="text-sm font-semibold text-foreground">G) Previous Open Day</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Did anything go wrong?</label>
          <textarea
            value={prevDayWrong || ''}
            onChange={(e) => onChange?.('prev_day_wrong', e?.target?.value)}
            disabled={disabled}
            placeholder="Describe any issues from the previous day..."
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">What went right?</label>
          <textarea
            value={prevDayRight || ''}
            onChange={(e) => onChange?.('prev_day_right', e?.target?.value)}
            disabled={disabled}
            placeholder="Highlight successes from the previous day..."
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
};

export default PreviousOpenDay;
