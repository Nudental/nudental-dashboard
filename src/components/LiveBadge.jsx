import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';

export default function LiveBadge() {
  const [status, setStatus] = useState('checking'); // 'live' | 'offline' | 'checking'

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const ok = await checkHealth();
        if (mounted) setStatus(ok ? 'live' : 'offline');
      } catch {
        if (mounted) setStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 60_000); // re-check every minute
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const colors = {
    live: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    offline: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    checking: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
  };

  const c = colors[status];
  const label = status === 'live' ? 'Live' : status === 'offline' ? 'API Offline' : '…';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: c.bg,
        color: c.text,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: c.dot,
          display: 'inline-block',
          ...(status === 'live'
            ? { animation: 'pulse-dot 2s ease-in-out infinite' }
            : {}),
        }}
      />
      {label}
    </span>
  );
}
