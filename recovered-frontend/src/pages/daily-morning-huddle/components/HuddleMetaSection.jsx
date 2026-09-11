import React from 'react';
import Icon from '../../../components/AppIcon';

const HuddleMetaSection = ({ huddleDate, officeId, offices, onDateChange, onOfficeChange, disabled }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="CalendarDays" size={18} color="var(--color-primary)" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Huddle Information</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
          <input
            type="date"
            value={huddleDate}
            onChange={(e) => onDateChange?.(e?.target?.value)}
            disabled={disabled}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Office</label>
          <select
            value={officeId}
            onChange={(e) => onOfficeChange?.(e?.target?.value)}
            disabled={disabled}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select Office</option>
            {offices?.map((o) => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default HuddleMetaSection;
