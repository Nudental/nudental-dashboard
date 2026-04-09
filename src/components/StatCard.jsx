import React from 'react';

export function fmt$(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtNum(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

export default function StatCard({ label, value, sub, color = '#6366f1', icon: Icon }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        borderTop: `3px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 180,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={16} style={{ color }} />}
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{sub}</div>
      )}
    </div>
  );
}
