import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const OfficeFilterSelect = ({ offices, selectedOffices, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOffice = (officeId) => {
    const newSelection = selectedOffices?.includes(officeId)
      ? selectedOffices?.filter(id => id !== officeId)
      : [...selectedOffices, officeId];
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    onSelectionChange(offices?.map(o => o?.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-smooth focus-ring"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon name="Building2" size={16} />
        <span className="hidden sm:inline">
          {selectedOffices?.length === 0 
            ? 'All Offices' 
            : selectedOffices?.length === offices?.length
            ? 'All Offices'
            : `${selectedOffices?.length} Selected`}
        </span>
        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground" />
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[190]" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-elevation-3 z-[200]">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-popover-foreground">Select Offices</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  All
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-primary hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {offices?.map((office) => (
                <label
                  key={office?.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-md cursor-pointer transition-smooth"
                >
                  <input
                    type="checkbox"
                    checked={selectedOffices?.includes(office?.id)}
                    onChange={() => toggleOffice(office?.id)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-popover-foreground truncate">{office?.name}</div>
                    <div className="text-xs text-muted-foreground">{office?.location}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OfficeFilterSelect;