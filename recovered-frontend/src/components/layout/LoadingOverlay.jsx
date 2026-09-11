import React from 'react';

const LoadingOverlay = ({ message = 'Loading analytics data...' }) => {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-spinner" aria-hidden="true"></div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;