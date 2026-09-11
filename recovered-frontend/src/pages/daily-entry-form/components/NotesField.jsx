import React from 'react';
import Icon from '../../../components/AppIcon';

const MAX_CHARS = 1000;

const NotesField = ({ value, onChange, disabled }) => {
  const remaining = MAX_CHARS - (value?.length || 0);
  const isNearLimit = remaining <= 100;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="FileText" size={18} color="var(--color-primary)" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Daily Notes / Exceptions</h3>
          <p className="text-xs text-muted-foreground">Workflow notes, exceptions, and items needing manager review</p>
        </div>
      </div>
      <div className="relative">
        <textarea
          value={value || ''}
          onChange={e => onChange('notes', e?.target?.value?.slice(0, MAX_CHARS))}
          disabled={disabled}
          placeholder="Enter staffing issues, deposit discrepancies, void concerns, patient issues, unscheduled treatment notes, or other items needing manager review."
          rows={5}
          className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth placeholder:text-muted-foreground"
        />
        <div className={`absolute bottom-3 right-3 text-xs ${
          isNearLimit ? 'text-warning font-medium' : 'text-muted-foreground'
        }`}>
          {remaining} / {MAX_CHARS}
        </div>
      </div>
    </div>
  );
};

export default NotesField;
