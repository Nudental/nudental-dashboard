import React from 'react';

export default function GoalBar({ label, actual, goal, color = '#6366f1' }) {
  const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
  const display = isNaN(pct) ? 0 : pct;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {display}% of goal
        </span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div
          style={{
            width: `${display}%`,
            height: '100%',
            background: display >= 100 ? '#10b981' : color,
            borderRadius: 999,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          ${(actual || 0).toLocaleString()}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          Goal: ${(goal || 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
