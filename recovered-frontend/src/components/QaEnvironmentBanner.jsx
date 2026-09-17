import React from 'react';
import { QA_BANNER } from '../config/environmentPolicy';

export default function QaEnvironmentBanner() {
  return (
    <div role="status" aria-label="Nonproduction environment" style={{
      position: 'fixed', bottom: 12, right: 12, zIndex: 2147483647,
      maxWidth: 'calc(100vw - 24px)', padding: '8px 14px', borderRadius: 6,
      border: '2px solid #92400e', background: '#fef3c7', color: '#78350f',
      fontSize: 12, fontWeight: 800, textAlign: 'center', pointerEvents: 'none',
    }}>
      {QA_BANNER}
    </div>
  );
}
