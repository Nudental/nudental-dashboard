import { get, set, del, keys, createStore } from 'idb-keyval';
import { createUsageLog as createImplantUsageLog } from './implantInventoryService';
import { createInventoryRecord as createBoneTissueRecord } from './boneTissueService';
import supplyRequestService from './supplyRequestService';

const offlineStore = createStore('nu-dental-offline', 'offline_queue');

let onlineStatusListeners = [];
let syncStatusListeners = [];
let isOnline = navigator.onLine;
let pendingCount = 0;

export const offlineQueueService = {
  isOnline: () => isOnline,

  getPendingCount: async () => {
    try {
      const allKeys = await keys(offlineStore);
      const items = await Promise.all(allKeys?.map(k => get(k, offlineStore)));
      return items?.filter(i => i?.status === 'pending' || i?.status === 'failed')?.length;
    } catch (_) { return 0; }
  },

  enqueue: async (type, payload) => {
    const id = `offline_${Date.now()}_${Math.random()?.toString(36)?.slice(2)}`;
    const entry = {
      id,
      type,
      payload,
      created_at: new Date()?.toISOString(),
      retry_count: 0,
      status: 'pending',
    };
    await set(id, entry, offlineStore);
    pendingCount++;
    offlineQueueService?._notifySyncListeners();
    return entry;
  },

  getAll: async () => {
    try {
      const allKeys = await keys(offlineStore);
      const items = await Promise.all(allKeys?.map(k => get(k, offlineStore)));
      return items?.filter(Boolean)?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (_) { return []; }
  },

  getPending: async () => {
    const all = await offlineQueueService?.getAll();
    return all?.filter(i => i?.status === 'pending');
  },

  getFailed: async () => {
    const all = await offlineQueueService?.getAll();
    return all?.filter(i => i?.status === 'failed');
  },

  updateStatus: async (id, status, error = null) => {
    const item = await get(id, offlineStore);
    if (item) {
      await set(id, { ...item, status, error, updated_at: new Date()?.toISOString() }, offlineStore);
    }
  },

  remove: async (id) => {
    await del(id, offlineStore);
    offlineQueueService?._notifySyncListeners();
  },

  syncAll: async () => {
    if (!isOnline) return { synced: 0, failed: 0, errors: [] };
    const pending = await offlineQueueService?.getPending();
    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const item of pending) {
      await offlineQueueService?.updateStatus(item?.id, 'syncing');
      try {
        if (item?.type === 'implant_usage') {
          await createImplantUsageLog(item?.payload);
        } else if (item?.type === 'bone_tissue_usage') {
          await createBoneTissueRecord(item?.payload);
        } else if (item?.type === 'supply_adjustment') {
          const p = item?.payload;
          await supplyRequestService?.adjustInventory(p?.inventory_id, p?.new_qty, p?.reason, p?.notes);
        } else if (item?.type === 'supply_urgent_request') {
          await supplyRequestService?.createUrgentRequest(item?.payload);
        } else if (item?.type === 'supply_receipt') {
          await supplyRequestService?.receiveSupplies(item?.payload);
        } else if (item?.type === 'supply_catalog_edit') {
          const p = item?.payload;
          if (p?.action === 'add_subsection') {
            await supplyRequestService?.upsertSubsection({
              name: p?.name,
              department_id: p?.department_id,
              is_active: true,
              is_custom: true,
              office_id: p?.office_id || null,
            });
          } else if (p?.action === 'add_item') {
            await supplyRequestService?.upsertItem({
              name: p?.name,
              brand: p?.brand || null,
              unit_type: p?.unit_type || 'Each',
              subsection_id: p?.subsection_id,
              department_id: p?.department_id,
              is_custom: true,
              is_active: true,
              office_id: p?.office_id || null,
            });
          } else if (p?.action === 'set_stock') {
            if (p?.inventory_id) {
              await supplyRequestService?.adjustInventory(p?.inventory_id, p?.new_qty, 'Offline stock update', '');
            } else {
              await supplyRequestService?.upsertInventoryItem({
                item_id: p?.item_id,
                item_name: p?.item_name,
                office_id: p?.office_id,
                quantity_on_hand: p?.new_qty,
              });
            }
          }
        }
        await offlineQueueService?.remove(item?.id);
        synced++;
      } catch (err) {
        const retryCount = (item?.retry_count || 0) + 1;
        await set(item?.id, { ...item, status: 'failed', retry_count: retryCount, error: err?.message || 'Sync failed' }, offlineStore);
        failed++;
        errors?.push({ id: item?.id, type: item?.type, error: err?.message });
      }
    }

    offlineQueueService?._notifySyncListeners();
    return { synced, failed, errors };
  },

  retryFailed: async (id) => {
    const item = await get(id, offlineStore);
    if (item) {
      await set(id, { ...item, status: 'pending', error: null }, offlineStore);
    }
    return offlineQueueService?.syncAll();
  },

  onOnlineStatusChange: (cb) => {
    onlineStatusListeners?.push(cb);
    return () => { onlineStatusListeners = onlineStatusListeners?.filter(l => l !== cb); };
  },

  onSyncStatusChange: (cb) => {
    syncStatusListeners?.push(cb);
    return () => { syncStatusListeners = syncStatusListeners?.filter(l => l !== cb); };
  },

  _notifyOnlineListeners: () => {
    onlineStatusListeners?.forEach(cb => cb(isOnline));
  },

  _notifySyncListeners: async () => {
    const count = await offlineQueueService?.getPendingCount();
    pendingCount = count;
    syncStatusListeners?.forEach(cb => cb(count));
  },
};

// Wire up online/offline events
window.addEventListener('online', async () => {
  isOnline = true;
  offlineQueueService?._notifyOnlineListeners();
  // Auto-sync when coming back online
  const result = await offlineQueueService?.syncAll();
  if (result?.synced > 0) {
    window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: result }));
  }
  // Refresh supply offline cache on reconnect
  try {
    const { default: supplyRequestService } = await import('./supplyRequestService');
    await supplyRequestService?.refreshOfflineCache?.();
  } catch (_) {}
});

window.addEventListener('offline', () => {
  isOnline = false;
  offlineQueueService?._notifyOnlineListeners();
});

export default offlineQueueService;
