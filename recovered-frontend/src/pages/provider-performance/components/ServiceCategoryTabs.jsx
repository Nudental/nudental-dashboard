import React from 'react';
import Icon from '../../../components/AppIcon';

const ServiceCategoryTabs = ({ categories, activeCategory, onCategoryChange }) => {
  const tabs = [
    { id: 'all', name: 'All Categories', icon: 'LayoutGrid' },
    ...categories?.map(c => ({ id: c?.id, name: c?.name, icon: 'Tag' })),
  ];

  return (
    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 mb-4 overflow-x-auto">
      {tabs?.map(tab => (
        <button
          key={tab?.id}
          onClick={() => onCategoryChange(tab?.id)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-smooth flex-shrink-0 ${
            activeCategory === tab?.id
              ? 'bg-card text-foreground shadow-elevation-1'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name={tab?.icon} size={14} />
          {tab?.name}
        </button>
      ))}
    </div>
  );
};

export default ServiceCategoryTabs;
