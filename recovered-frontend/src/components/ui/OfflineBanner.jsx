import React, { useState } from 'react';
import Icon from '../AppIcon';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

const OfflineBanner = () => {
  const { isOnline, pendingCount, syncResult, failedEntries, retryFailed, discardFailed } = useOfflineStatus();
  const [showErrors, setShowErrors] = useState(false);
  const [retrying, setRetrying] = useState(null);

  if (isOnline && !syncResult && failedEntries?.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[500] flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-500 text-yellow-950 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="WifiOff" size={16} />
            <span className="text-sm font-semibold">
              You are offline — entries will sync when connection is restored
            </span>
            {pendingCount > 0 && (
              <span className="bg-yellow-700 text-yellow-100 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      )}
      {/* Sync success toast */}
      {syncResult && syncResult?.synced > 0 && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center gap-2">
          <Icon name="CheckCircle" size={16} />
          <span className="text-sm font-semibold">
            {syncResult?.synced} {syncResult?.synced === 1 ? 'entry' : 'entries'} synced successfully
          </span>
        </div>
      )}
      {/* Sync errors panel */}
      {failedEntries?.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900"
          >
            <Icon name="AlertCircle" size={16} />
            {failedEntries?.length} sync {failedEntries?.length === 1 ? 'error' : 'errors'} — click to review
            <Icon name={showErrors ? 'ChevronUp' : 'ChevronDown'} size={14} />
          </button>

          {showErrors && (
            <div className="mt-2 space-y-2">
              {failedEntries?.map(entry => (
                <div key={entry?.id} className="bg-white border border-red-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-800">
                      {entry?.type === 'implant_usage' ? 'Implant Usage' :
                       entry?.type === 'bone_tissue_usage' ? 'Bone/Tissue Usage' :
                       entry?.type === 'supply_adjustment' ? 'Supply Adjustment' :
                       entry?.type === 'supply_urgent_request' ? 'Urgent Supply Request' :
                       entry?.type === 'supply_receipt' ? 'Supply Receipt' :
                       entry?.type}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5 truncate">{entry?.error || 'Unknown error'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.created_at)?.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={async () => { setRetrying(entry?.id); await retryFailed(entry?.id); setRetrying(null); }}
                      disabled={retrying === entry?.id}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
                    >
                      {retrying === entry?.id ? 'Retrying…' : 'Retry'}
                    </button>
                    <button
                      onClick={() => discardFailed(entry?.id)}
                      className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
