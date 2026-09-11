import React, { useState } from 'react';
import Icon from '../AppIcon';

const NumericKeypad = ({ value, onChange, label, min = 0, max = 9999, allowDecimal = false }) => {
  const [showPad, setShowPad] = useState(false);
  const displayVal = value?.toString() || '0';

  const handleKey = (key) => {
    let current = displayVal === '0' ? '' : displayVal;
    if (key === 'backspace') {
      current = current?.slice(0, -1) || '0';
    } else if (key === '.' && allowDecimal) {
      if (!current?.includes('.')) current += '.';
    } else if (key !== '.') {
      current += key;
    }
    const num = allowDecimal ? parseFloat(current) : parseInt(current);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange?.(num);
    } else if (current === '' || current === '0') {
      onChange?.(0);
    }
  };

  const keys = ['7','8','9','4','5','6','1','2','3', allowDecimal ? '.' : null,'0','backspace'];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPad(!showPad)}
        className="w-full flex items-center justify-between px-4 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{ minHeight: '52px' }}
      >
        <span className="text-lg font-semibold">{displayVal}</span>
        <Icon name="Hash" size={18} className="text-muted-foreground" />
      </button>
      {showPad && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-[600] p-3">
          {label && <p className="text-xs font-semibold text-muted-foreground mb-2 text-center">{label}</p>}
          <div className="text-center text-2xl font-bold text-foreground mb-3 py-2 bg-muted rounded-lg">
            {displayVal}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {keys?.map((key, i) => (
              key !== null ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleKey(key)}
                  className={`flex items-center justify-center rounded-xl text-lg font-semibold transition-colors active:scale-95 ${
                    key === 'backspace' ?'bg-red-100 text-red-700 hover:bg-red-200' :'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                  style={{ minHeight: '52px' }}
                >
                  {key === 'backspace' ? <Icon name="Delete" size={20} /> : key}
                </button>
              ) : <div key={i} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPad(false)}
            className="w-full mt-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default NumericKeypad;
