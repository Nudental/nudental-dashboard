import { useState, useEffect } from 'react';
import { offlineQueueService } from '../services/offlineQueueService';

export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncResult, setSyncResult] = useState(null);
  const [failedEntries, setFailedEntries] = useState([]);

  useEffect(() => {
    // Load initial pending count
    offlineQueueService?.getPendingCount()?.then(setPendingCount);
    offlineQueueService?.getFailed()?.then(setFailedEntries);

    const unsubOnline = offlineQueueService?.onOnlineStatusChange(setIsOnline);
    const unsubSync = offlineQueueService?.onSyncStatusChange(async (count) => {
      setPendingCount(count);
      const failed = await offlineQueueService?.getFailed();
      setFailedEntries(failed);
    });

    const handleSyncComplete = (e) => {
      setSyncResult(e?.detail);
      setTimeout(() => setSyncResult(null), 5000);
    };
    window.addEventListener('offline-sync-complete', handleSyncComplete);

    return () => {
      unsubOnline();
      unsubSync();
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, []);

  const retryFailed = async (id) => {
    const result = await offlineQueueService?.retryFailed(id);
    setSyncResult(result);
    setTimeout(() => setSyncResult(null), 5000);
    return result;
  };

  const discardFailed = async (id) => {
    await offlineQueueService?.remove(id);
    const failed = await offlineQueueService?.getFailed();
    setFailedEntries(failed);
  };

  return { isOnline, pendingCount, syncResult, failedEntries, retryFailed, discardFailed };
};

export default useOfflineStatus;
