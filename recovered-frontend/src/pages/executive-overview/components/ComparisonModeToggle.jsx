import React from 'react';
import Icon from '../../../components/AppIcon';

const ComparisonModeToggle = ({ isEnabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-smooth focus-ring ${
        isEnabled
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border text-foreground hover:bg-muted'
      }`}
      aria-pressed={isEnabled}
    >
      <Icon name="GitCompare" size={16} />
      <span className="hidden sm:inline">Period Comparison</span>
      <span className="sm:hidden">Compare</span>
    </button>
  );
};

export default ComparisonModeToggle;