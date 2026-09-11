/**
 * DentrixDataSourceBanner.jsx
 *
 * Displays a clear data source indicator on dashboard pages showing:
 * - Whether Dentrix Ascend API is connected and returning live data
 * - Last sync timestamp
 * - Any data integrity warnings
 * - "Not verified" state when API is unavailable
 *
 * This component must appear on all P0 dashboard sections:
 * Executive Overview, Office Performance, Financial Analytics,
 * Production, Collections, Provider Performance
 */

import React from 'react';
import Icon from './AppIcon';

const DentrixDataSourceBanner = ({
  dentrixAvailable = null,
  dentrixError = null,
  lastSyncAt = null,
  locationId = null,
  officeName = null,
  startDate = null,
  endDate = null,
  compact = false,
}) => {
  // null = loading, true = connected, false = error/unavailable
  if (dentrixAvailable === null) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <Icon name="Loader2" size={compact ? 11 : 13} className="animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Connecting to Dentrix Ascend…</span>
      </div>
    );
  }

  if (!dentrixAvailable) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <Icon name="AlertTriangle" size={compact ? 11 : 13} className="text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-amber-800">Dentrix Ascend data unavailable</span>
          {dentrixError && (
            <span className="ml-1 text-amber-700 truncate"> — {dentrixError}</span>
          )}
        </div>
        <span className="text-amber-600 font-medium whitespace-nowrap">Not currently verified</span>
      </div>
    );
  }

  const dateLabel = startDate && endDate ? `${startDate} → ${endDate}` : null;
  const officeLabel = officeName || (locationId ? `locationId: ${locationId}` : 'All Offices');

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
      <span className="font-semibold text-emerald-800">
        Verified via Dentrix Ascend
      </span>
      <span className="text-emerald-600">·</span>
      <span className="text-emerald-700">{officeLabel}</span>
      {dateLabel && (
        <>
          <span className="text-emerald-600">·</span>
          <span className="text-emerald-700">{dateLabel}</span>
        </>
      )}
      {lastSyncAt && (
        <>
          <span className="text-emerald-600">·</span>
          <span className="text-emerald-600">
            Synced {new Date(lastSyncAt)?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </>
      )}
    </div>
  );
};

export default DentrixDataSourceBanner;
