import React, { useState, useRef, useEffect } from 'react';
import Icon from '../AppIcon';

const TouchDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  error,
  disabled,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options?.find(o => o?.value === value);

  useEffect(() => {
    const handler = (e) => {
      if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const handleSelect = (optValue) => {
    onChange?.(optValue);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 text-base border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
          error ? 'border-red-400' : 'border-border'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
        style={{ minHeight: '52px' }}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected?.label || placeholder}
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={20} className="text-muted-foreground flex-shrink-0 ml-2" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg z-[600] max-h-64 overflow-y-auto">
          {options?.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No options available</div>
          ) : (
            options?.map(opt => (
              <button
                key={opt?.value}
                type="button"
                onClick={() => handleSelect(opt?.value)}
                className={`w-full text-left px-4 py-3.5 text-base hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl ${
                  opt?.value === value ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                }`}
                style={{ minHeight: '48px' }}
              >
                {opt?.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TouchDropdown;
